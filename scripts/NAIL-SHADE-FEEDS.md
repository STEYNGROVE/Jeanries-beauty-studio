# Nail Lab supplier shades

The committed file is a small set of shades manually verified against public Crystal Clawz and Maskscara Gel-It listings. The hex values are illustrative screen references. Supplier listings do not establish availability at Jeanrie’s studio.

Import only supplier-authorized CSV or JSON exports. JSON may be an array or an object with a `shades` array. Supply these fields as CSV column names or JSON keys:

- `brand` is `Crystal Clawz` or `Gel-It`.
- `name`, `code`, `collection`, `category` and `finish` identify the shade. Use `Unspecified` for an unknown finish.
- `colour` is a six-digit hex preview reference.
- `source` is a public HTTPS supplier listing URL. Keep private feed URLs out of the snapshot.
- `verifiedOn` is an ISO calendar date.
- `availability` is optional and accepts `Unconfirmed`, `Available`, `Unavailable` or `Discontinued`.

Run `python3 scripts/sync-nail-shades.py --crystal path/to/authorized.csv --gel path/to/authorized.json --check` to validate an export without publishing. Omit `--check` to update the snapshot. Imports merge by brand, collection and code. A missing row retains its previous state. Explicitly mark discontinued shades in the source when confirmed.

The workflow runs daily at 04:43 UTC. Configure `CRYSTAL_CLAWZ_SHADE_FEED` or `GEL_IT_SHADE_FEED` as GitHub Actions secrets only after a supplier grants access to an HTTPS CSV or JSON feed. A successful run without feed configuration validates the existing snapshot. A rejected feed leaves the snapshot intact and fails the workflow.
