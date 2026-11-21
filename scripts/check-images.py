#!/usr/bin/env python3
"""Verify image references and check that Pages serves matching image files."""

import argparse
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from functools import partial
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
from threading import Thread
from urllib.parse import quote, unquote, urljoin, urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1] / 'public'
ORIGIN = 'https://jeanriesbeauty.pages.dev'
IMAGE = re.compile(r'\.(?:avif|gif|ico|jpe?g|png|svg|webp)(?:[?#].*)?$', re.I)


class HtmlImages(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = set()

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag in {'img', 'source'}:
            if attrs.get('src') and (tag == 'img' or IMAGE.search(attrs['src'])):
                self.urls.add(attrs['src'])
            if attrs.get('srcset') and not attrs['srcset'].strip().startswith('data:'):
                self.urls.update(entry.split()[0] for entry in attrs['srcset'].split(',') if entry.strip())
        if tag == 'link' and 'icon' in attrs.get('rel', '').split() and attrs.get('href'):
            self.urls.add(attrs['href'])
        if tag == 'meta' and attrs.get('property') == 'og:image' and attrs.get('content'):
            self.urls.add(attrs['content'])


def references():
    locations = {ORIGIN + '/favicon.ico': {'browser favicon'}}
    for path in ROOT.rglob('*'):
        if not path.is_file():
            continue
        relative = path.relative_to(ROOT).as_posix()
        suffix = path.suffix.lower()
        if suffix == '.html':
            doc = HtmlImages()
            doc.feed(path.read_text())
            urls = doc.urls
        elif suffix == '.css':
            candidates = re.findall(r'''url\(\s*["']?([^"')]+)["']?\s*\)''', path.read_text())
            urls = {url for url in candidates if IMAGE.search(url.strip())}
        elif suffix == '.js':
            literals = re.findall(r'''["']([^"'\n<>\s]+)["']''', path.read_text())
            urls = {url for url in literals if IMAGE.search(url)}
        elif IMAGE.search(relative):
            urls = {'/' + relative}
        else:
            continue
        for url in urls:
            if not url.startswith('data:'):
                absolute = urljoin(ORIGIN + '/' + relative, url.strip())
                locations.setdefault(absolute, set()).add(relative)

    catalogue = json.loads((ROOT / 'data/catalogue.json').read_text())
    for product in catalogue['products']:
        if product.get('image'):
            absolute = urljoin(ORIGIN, product['image'])
            locations.setdefault(absolute, set()).add('catalogue:' + product['id'])
    return catalogue, locations


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


@contextmanager
def local_server():
    handler = partial(QuietHandler, directory=ROOT)
    with ThreadingHTTPServer(('127.0.0.1', 0), handler) as server:
        worker = Thread(target=server.serve_forever, daemon=True)
        worker.start()
        try:
            yield f'http://127.0.0.1:{server.server_port}'
        finally:
            server.shutdown()
            worker.join()


def assert_payload(data, mime, name):
    signatures = {
        'image/jpeg': lambda b: b.startswith(b'\xff\xd8\xff'),
        'image/png': lambda b: b.startswith(b'\x89PNG\r\n\x1a\n'),
        'image/gif': lambda b: b.startswith((b'GIF87a', b'GIF89a')),
        'image/vnd.microsoft.icon': lambda b: b.startswith(b'\x00\x00\x01\x00'),
        'image/x-icon': lambda b: b.startswith(b'\x00\x00\x01\x00'),
        'image/webp': lambda b: b.startswith(b'RIFF') and b[8:12] == b'WEBP',
        'image/avif': lambda b: b[4:8] == b'ftyp' and b'avif' in b[:32],
        'image/svg+xml': lambda b: b'<svg' in b[:2048],
    }
    if mime not in signatures or not signatures[mime](data):
        raise ValueError(f'{name} has unexpected payload for {mime}')


def check(url, base):
    parsed = urlsplit(url)
    if parsed.netloc == urlsplit(ORIGIN).netloc:
        relative = unquote(parsed.path).lstrip('/')
        parts = Path(relative).parts
        path = ROOT
        for part in parts:
            if part in {'.', '..'} or not path.is_dir() or part not in {p.name for p in path.iterdir()}:
                raise ValueError('Missing or wrong-case path: ' + relative)
            path /= part
        if not path.is_file():
            raise ValueError('Image is not a file: ' + relative)
        expected = path.read_bytes()
        target = base + '/' + quote(relative, safe='/')
    else:
        if parsed.scheme != 'https' or parsed.hostname not in {'justine.co.za', 'www.justine.co.za', 'my.justine.co.za'}:
            raise ValueError('External images must use an authorized Justine HTTPS host')
        expected = None
        target = url
    request = Request(target, headers={'User-Agent': 'Mozilla/5.0'})
    with urlopen(request, timeout=15) as response:
        if response.status != 200:
            raise ValueError(f'HTTP {response.status}')
        mime = response.headers.get_content_type()
        data = response.read(10_000_001)
    if len(data) > 10_000_000:
        raise ValueError('Image exceeds 10 MB')
    assert_payload(data, mime, parsed.path)
    if expected is not None and data != expected:
        raise ValueError('Served image does not match the repository file')
    return f'HTTP 200 {mime}'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--production', action='store_true', help='HTTP-check the published Pages host')
    args = parser.parse_args()
    catalogue, locations = references()

    def audit(base):
        failures = 0
        with ThreadPoolExecutor(max_workers=6) as pool:
            futures = {url: pool.submit(check, url, base) for url in sorted(locations)}
            for url, future in futures.items():
                try:
                    print(f'{url}: {future.result()}')
                except (OSError, ValueError) as error:
                    print(f'{url}: FAIL ({error}), referenced by {", ".join(sorted(locations[url]))}')
                    failures += 1
        missing = sum(not item.get('image') for item in catalogue['products'])
        print(f'{len(locations)} image URLs checked, {failures} failures, {missing} catalogue placeholders')
        return bool(failures)

    if args.production:
        return audit(ORIGIN)
    with local_server() as base:
        return audit(base)


if __name__ == '__main__':
    raise SystemExit(main())
