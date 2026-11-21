# Justine catalogue feed

The daily workflow validates the committed snapshot at 04:17 UTC. Without an authorized feed it logs the fallback and retains the last valid listings. The storefront hides promotions when they expire even between runs.

Set the repository Actions secret `JUSTINE_CATALOGUE_FEED_URL` to an authorized HTTPS JSON endpoint. It must return the complete snapshot described below. The feed is fetched without credentials in request headers, so use a private signed URL if the provider requires one. Never include credentials in product image or catalogue links.

- `source` is the supplier name.
- `products` contains objects with `id`, `name`, `category`, and optional `sku`, `image`, and `imageAlt`. IDs must be lowercase hyphen-separated slugs and stable across imports.
- `promotions` contains objects with `id`, `productId`, `title`, `priceCents`, `startsAt`, and exclusive `endsAt`. Use integer South African cents and ISO 8601 timestamps with an offset.
- `catalogues` contains objects with `title` and an official Justine HTTPS `url`.

An invalid or unavailable feed cannot replace the committed snapshot. Run `python3 scripts/sync-catalogue.py --check` to validate without writing. A changed snapshot is committed by the daily workflow.
