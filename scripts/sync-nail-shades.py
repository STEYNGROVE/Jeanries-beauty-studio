#!/usr/bin/env python3
"""Validate authorized supplier CSV/JSON exports and publish a merged shade snapshot."""
import argparse
import csv
from datetime import datetime, date, UTC
import io
import json
import os
from pathlib import Path
import re
from urllib.parse import urlsplit
from urllib.request import build_opener, Request, HTTPRedirectHandler

PATH = Path(__file__).resolve().parents[1] / 'public/data/nail-shades.json'
BRANDS = {'Crystal Clawz': ('crystalclawz.co.za', 'www.crystalclawz.co.za'),
          'Gel-It': ('maskscara.com', 'www.maskscara.com')}
LIMIT = 2_000_000


def log(event, **data):
    print(json.dumps({'event': event, 'at': datetime.now(UTC).isoformat(), **data}))


def identity(row):
    return tuple(row[key].casefold() for key in ('brand', 'collection', 'code'))


def validate(row, brand):
    required = ('brand', 'name', 'code', 'colour', 'category', 'finish', 'collection', 'source', 'verifiedOn')
    clean = {}
    for key in required:
        value = row[key]
        if not isinstance(value, str) or not 0 < len(value.strip()) <= (500 if key=='source' else 120):
            raise ValueError('Invalid shade field')
        clean[key] = ' '.join(value.split())
    url = urlsplit(clean['source'])
    if (clean['brand'] != brand or url.scheme != 'https' or url.hostname not in BRANDS[brand]
            or url.username or url.password or url.query or url.fragment):
        raise ValueError('Invalid supplier or public source')
    if not re.fullmatch(r'#[a-fA-F0-9]{6}', clean['colour']):
        raise ValueError('Invalid colour reference')
    if date.fromisoformat(clean['verifiedOn']) > datetime.now(UTC).date():
        raise ValueError('Verification date is in the future')
    clean['colour'] = clean['colour'].lower()
    availability = row.get('availability') or 'Unconfirmed'
    if availability not in {'Unconfirmed', 'Available', 'Unavailable', 'Discontinued'}:
        raise ValueError('Invalid availability')
    clean['availability'] = availability
    return clean


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None


def read_feed(location):
    if not location.startswith('https://'):
        raw = Path(location).read_bytes()
        csv_format = location.lower().endswith('.csv')
    else:
        url = urlsplit(location)
        if not url.hostname or url.username or url.password:
            raise ValueError('Invalid feed URL')
        opener = build_opener(NoRedirect())
        request = Request(location, headers={'Accept':'application/json, text/csv'})
        with opener.open(request, timeout=25) as response:
            kind = response.headers.get_content_type()
            if kind not in {'application/json','text/csv'}:
                raise ValueError('Unsupported feed content type')
            raw = response.read(LIMIT+1)
        csv_format = kind == 'text/csv'
    if len(raw) > LIMIT:
        raise ValueError('Feed too large')
    text = raw.decode('utf-8-sig')
    if csv_format:
        return list(csv.DictReader(io.StringIO(text)))
    doc = json.loads(text)
    return doc['shades'] if isinstance(doc, dict) else doc


def merge(snapshot, source, brand):
    if not isinstance(source, list) or not source:
        raise ValueError('Expected nonempty list')
    incoming = {}
    for row in source:
        clean = validate(row, brand)
        key = identity(clean)
        if key in incoming and incoming[key] != clean:
            raise ValueError('Conflicting duplicate shade')
        incoming[key] = clean
    original = {identity(row): row for row in snapshot}
    merged = dict(original)
    merged.update(incoming)
    return list(merged.values()), len(set(incoming)-set(original)), sum(
        key in original and original[key]!=row for key,row in incoming.items()
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--crystal', default=os.getenv('CRYSTAL_CLAWZ_SHADE_FEED'))
    parser.add_argument('--gel', default=os.getenv('GEL_IT_SHADE_FEED'))
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    snapshot = json.loads(PATH.read_text())
    rows = snapshot['shades']
    checked = [validate(row, row['brand']) for row in rows]
    if len(set(map(identity, checked))) != len(rows):
        raise ValueError('Duplicate snapshot shade')
    configured = False
    failed = False
    for brand, location in [('Crystal Clawz',args.crystal),('Gel-It',args.gel)]:
        if not location:
            continue
        configured = True
        try:
            rows,added,updated = merge(rows,read_feed(location),brand)
        except (OSError, KeyError, TypeError, ValueError) as error:
            failed = True
            log('feed_rejected', brand=brand, error=type(error).__name__)
        else:
            log('feed_validated',brand=brand,new=added,updated=updated,
                unavailable=sum(row['brand']==brand and row['availability'] in {'Unavailable','Discontinued'} for row in rows))
    if failed:
        log('snapshot_retained_after_failure', count=len(snapshot['shades']))
        return 1
    if not configured:
        log('snapshot_validated_no_authorized_feed', count=len(rows))
    if rows != snapshot['shades'] and not args.check:
        snapshot.update(shades=rows,lastSync=datetime.now(UTC).isoformat())
        temp=PATH.with_suffix('.tmp')
        temp.write_text(json.dumps(snapshot,ensure_ascii=False,indent=2)+'\n')
        temp.replace(PATH)
    return 0


if __name__=='__main__':
    raise SystemExit(main())
