#!/usr/bin/env python3
"""Local staff tool for issuing and recording confirmed gift-card transactions."""
import argparse
import datetime as dt
import fcntl
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import tempfile


def stamp():
    return dt.datetime.now(dt.UTC).isoformat()


def digest(code):
    return hashlib.sha256(code.strip().encode()).hexdigest()


def process(args, cards):
    if args.action == 'issue':
        if not args.confirm_paid or args.cents < 1:
            raise ValueError('Issuance requires a positive amount and explicit payment confirmation.')
        code = secrets.token_urlsafe(24)
        cards[digest(code)] = {'cents': args.cents, 'currency': 'ZAR', 'state': 'issued', 'issuedOn': stamp()}
        return {'code': code, 'cents': args.cents, 'currency': 'ZAR'}, True
    code = read_code()
    key = digest(code)
    record = next((value for stored, value in cards.items() if hmac.compare_digest(stored, key)), None)
    if not record:
        raise ValueError('Gift card code was not found.')
    if args.action == 'check':
        return record, False
    if record['state'] != 'issued':
        raise ValueError('Only an issued gift card can be redeemed or voided.')
    record.update(state={'redeem':'redeemed', 'void':'void'}[args.action], updatedOn=stamp())
    return record, True


def read_code():
    from getpass import getpass
    return getpass('Gift card code: ')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ledger', type=Path, required=True)
    sub = parser.add_subparsers(dest='action', required=True)
    issue = sub.add_parser('issue')
    issue.add_argument('--cents', type=int, required=True)
    issue.add_argument('--confirm-paid', action='store_true')
    for name in ('check', 'redeem', 'void'):
        sub.add_parser(name)
    args = parser.parse_args()
    path = args.ledger.expanduser().resolve()
    repo = Path(__file__).resolve().parents[1]
    if path.is_relative_to(repo):
        parser.error('Store the private gift-card ledger outside the repository.')
    if not path.parent.is_dir():
        parser.error('Create a private ledger directory first.')
    try:
        fd = os.open(str(path) + '.lock', os.O_CREAT | os.O_RDWR, 0o600)
        with os.fdopen(fd, 'r+') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            cards = json.loads(path.read_text()) if path.exists() else {}
            result, changed = process(args, cards)
            if changed:
                with tempfile.NamedTemporaryFile('w', dir=path.parent, delete=False) as tmp:
                    json.dump(cards, tmp, indent=2)
                    tmp.write('\n')
                    tmp.flush()
                    os.fsync(tmp.fileno())
                try:
                    os.replace(tmp.name, path)
                finally:
                    Path(tmp.name).unlink(missing_ok=True)
            print(json.dumps(result))
    except (OSError, ValueError) as error:
        parser.exit(1, f'{error}\n')


if __name__ == '__main__':
    main()
