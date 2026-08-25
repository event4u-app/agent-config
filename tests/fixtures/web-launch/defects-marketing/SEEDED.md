# Seeded defects — `defects-marketing`

A checked-in manifest rather than a comment, so a fixture that stops firing a
check is a visible diff rather than a quietly weaker test.

| check | how it is seeded | where |
|---|---|---|
| `https-enforcement` | a `<script src="http://…">` on a host we do not own | `index.html:5` |
| `custom-error-route` | no `404.html` anywhere in the build | (absence) |
| `per-route-metadata` | no `<meta name="description">` on either page, and BOTH pages carry the identical `<title>Acme</title>` — present, but not per-route | `index.html:4`, `pricing.html:4` |
| `image-alternative-text` | two `<img>` with no `alt` at all. Note `alt=""` is NOT seeded here: it is the ARIA-correct decorative marking and must stay a pass | `index.html:9`, `pricing.html:7` |
| `document-head-basics` | no `lang` on `<html>`, no `<meta charset>`, no viewport, on both pages | both |
| `canonical-and-sitemap-coherence` | no `rel="canonical"` on either page | both |
| `required-legal-pages` | no imprint and no privacy page | (absence) |
| `analytics-and-consent-wiring` | `gtag(` present and no consent mechanism anywhere in the build | `index.html:6` |

`staging-noindex-leftover` is deliberately NOT seeded here — it has its own
fixture (`staging-leftover`), and seeding it twice would make the two fixtures
non-independent.
