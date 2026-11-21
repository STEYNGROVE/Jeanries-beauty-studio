# Glam Wall review and publication

The website prepares a local review image and a WhatsApp draft. Jeanrie receives it only when the customer attaches it and sends the message. Review permission is separate from publication permission.

A repository maintainer can publish a reviewed image after obtaining explicit consent for public display. Keep the consent evidence private. Resize the approved image, remove metadata, and add it under `public/glam-gallery/`. Add a matching record to `public/data/glam-wall.json` with `state: "approved"`, `publicationConsent: true`, the ISO date `approvedOn`, a short public `title`, informative `alt` text, and the local `image` path. Use a neutral filename and keep customer names out of the public record unless they specifically consent to being named.

Run `python3 scripts/check-glam-wall.py` and `python3 scripts/check-images.py` before publishing. Remove both the file and its record if consent is withdrawn. Public assets enter the repository history when committed, so only publish images cleared for public distribution.
