#!/usr/bin/env python3
"""Check the public gallery manifest. Consent evidence stays outside Git."""
import datetime as dt
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1] / 'public'


def validate(entries):
    if not isinstance(entries, list):
        raise ValueError('Expected a list of Glam Wall entries')
    seen = set()
    for item in entries:
        if item.get('state') != 'approved' or item.get('publicationConsent') is not True:
            raise ValueError('Only approved images with explicit publication consent may be published')
        for field in ('title', 'alt'):
            if not isinstance(item.get(field), str) or not 0 < len(item[field].strip()) <= 160:
                raise ValueError('Gallery title and image description are required')
        approved = dt.date.fromisoformat(item['approvedOn'])
        if approved > dt.datetime.now(dt.UTC).date():
            raise ValueError('Approval date is in the future')
        image = item['image']
        if not re.fullmatch(r'/glam-gallery/[a-z0-9-]+\.(?:jpg|png|webp)', image):
            raise ValueError('Expected an approved local image path')
        if image in seen or not (ROOT / image.lstrip('/')).is_file():
            raise ValueError('Duplicate or missing public gallery image')
        seen.add(image)
    for path in (ROOT / 'glam-gallery').glob('*'):
        if path.is_file() and '/' + path.relative_to(ROOT).as_posix() not in seen:
            raise ValueError('Unapproved or unlisted file in the public gallery')


if __name__ == '__main__':
    try:
        entries = json.loads((ROOT / 'data/glam-wall.json').read_text())['entries']
        validate(entries)
    except (KeyError, TypeError, ValueError) as error:
        print(f'Glam Wall validation failed: {error}', file=sys.stderr)
        raise SystemExit(1)
    print(f'Glam Wall: {len(entries)} approved public entries')
