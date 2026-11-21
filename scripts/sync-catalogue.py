#!/usr/bin/env python3
"""Validate an authorized Justine JSON feed and atomically update Pages data."""

import datetime as dt
import json
import os
from pathlib import Path
import re
import sys
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / 'public/data/catalogue.json'
ID = re.compile(r'[a-z0-9]+(?:-[a-z0-9]+)*')
MAX_BYTES = 5_000_000


def log(event, **details):
    print(json.dumps({'event': event, 'at': dt.datetime.now(dt.UTC).isoformat(), **details}))


def label(value, limit=160):
    if not isinstance(value, str) or not 0 < len(value.strip()) <= limit:
        raise ValueError('Invalid text field')
    return ' '.join(value.split())


def identifier(value):
    value = label(value, 100)
    if not ID.fullmatch(value):
        raise ValueError('Invalid identifier')
    return value


def https_url(value):
    parsed = urllib.parse.urlsplit(label(value, 2048))
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('Expected an HTTPS URL without credentials')
    return parsed


def justine_url(value):
    url = https_url(value)
    if url.hostname not in {'justine.co.za', 'www.justine.co.za', 'my.justine.co.za'}:
        raise ValueError('Catalogue URL is outside Justine South Africa')
    return url.geturl()


def timestamp(value):
    instant = dt.datetime.fromisoformat(label(value).replace('Z', '+00:00'))
    if instant.tzinfo is None:
        raise ValueError('Promotion timestamp requires a timezone')
    return instant.astimezone(dt.UTC)


def unique(records, namespace, key):
    entries = {}
    for record in records:
        identity = key(record)
        if identity in entries and entries[identity] != record:
            raise ValueError('Conflicting duplicate ' + namespace)
        entries[identity] = record
    return list(entries.values())


def validate(raw, now):
    products = []
    for item in raw['products']:
        product = {key: label(item[key]) for key in ('name', 'category')}
        product['id'] = identifier(item['id'])
        if item.get('sku'):
            product['sku'] = label(item['sku'], 60)
        if item.get('image'):
            image = label(item['image'], 2048)
            if re.fullmatch(r'/products/[a-z0-9-]+\.jpg', image):
                if not (ROOT / 'public' / image.lstrip('/')).is_file():
                    raise ValueError('Referenced product image is missing')
            else:
                image = justine_url(image)
            product['image'] = image
            if item.get('imageAlt'):
                product['imageAlt'] = label(item['imageAlt'])
        products.append(product)
    products = unique(products, 'product ID', lambda item: item['id'])
    unique([p for p in products if 'sku' in p], 'product SKU', lambda p: p['sku'].casefold())
    if not products:
        raise ValueError('Catalogue is empty')
    ids = {item['id'] for item in products}
    promotions = []
    for item in raw['promotions']:
        deal = {key: identifier(item[key]) for key in ('id', 'productId')}
        deal['title'] = label(item['title'])
        start, end = timestamp(item['startsAt']), timestamp(item['endsAt'])
        price = item['priceCents']
        if deal['productId'] not in ids or start >= end or type(price) is not int or price < 1:
            raise ValueError('Invalid promotion product, period or ZAR price')
        if end > now:
            deal.update(startsAt=start.isoformat(), endsAt=end.isoformat(), priceCents=price)
            promotions.append(deal)
    promotions = unique(promotions, 'promotion ID', lambda item: item['id'])
    promotions = unique(promotions, 'promotion placement', lambda item: (
        item['productId'], item['startsAt'], item['endsAt'], item['title'].casefold()
    ))
    catalogues = unique([
        {'title': label(item['title']), 'url': justine_url(item['url'])}
        for item in raw['catalogues']
    ], 'catalogue URL', lambda item: item['url'])
    return {'source': label(raw['source']), 'products': products,
            'promotions': promotions, 'catalogues': catalogues}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def download(url):
    request = urllib.request.Request(https_url(url).geturl(), headers={'Accept': 'application/json'})
    with urllib.request.build_opener(NoRedirect()).open(request, timeout=20) as response:
        if response.headers.get_content_type() != 'application/json':
            raise ValueError('Feed did not return JSON')
        data = response.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ValueError('Feed exceeds size limit')
    return json.loads(data)


def main():
    now = dt.datetime.now(dt.UTC)
    old = json.loads(PATH.read_text())
    snapshot = validate(old, now)
    feed = os.environ.get('JUSTINE_CATALOGUE_FEED_URL')
    event = 'fallback_no_authorized_feed'
    if feed:
        try:
            snapshot = validate(download(feed), now)
            event = 'feed_validated'
        except (ValueError, KeyError, TypeError, OSError) as error:
            # Log the exception type only. Upstream errors may include private feed URLs.
            log('feed_rejected', error=type(error).__name__, http_status=getattr(error, 'code', None))
            event = 'fallback_validation_or_fetch_error'
    if snapshot != old and '--check' not in sys.argv:
        temp = PATH.with_suffix('.tmp')
        temp.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n')
        temp.replace(PATH)
    log(event, product_count=len(snapshot['products']), pictured_count=sum('image' in p for p in snapshot['products']),
        promotion_count=len(snapshot['promotions']),
        active_count=sum(timestamp(p['startsAt']) <= now for p in snapshot['promotions']),
        changed=snapshot != old, wrote='--check' not in sys.argv and snapshot != old)


if __name__ == '__main__':
    main()
