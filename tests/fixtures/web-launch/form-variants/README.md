# form-variants

Eight copies of `clean-marketing/`, each changing ONE thing about how the markup
or `robots.txt` is written. The checks read the page's meaning, so a change in
form must never change the verdict, and a change in meaning must.

| fixture | what differs from `clean-marketing` | expected verdict |
|---|---|---|
| `reordered-description-canonical/` | `content` before `name` on the description, `href` before `rel` on the canonical | clean — no finding |
| `robots-content-first/` | `<meta content="noindex" name="robots">` | `staging-noindex-leftover` at `index.html:4` |
| `robots-none/` | `<meta name="robots" content="none">` — `none` means `noindex, nofollow` | `staging-noindex-leftover` at `index.html:4` |
| `googlebot-noindex/` | `<meta name="googlebot" content="noindex">` — a search crawler's own name | `staging-noindex-leftover` at `index.html:4` |
| `training-only-block/` | `robots.txt` adds blanket `Disallow: /` groups for `GPTBot` and `Google-Extended` only | clean — a training opt-out is not a staging leftover |
| `canonical-relative-and-conflicting/` | a relative canonical and a second canonical on another host | `canonical-and-sitemap-coherence` on `index.html` |
| `sitemap-lookalike-host/` | sitemap `<loc>` hosts are `example.com.evil.io`, canonicals stay `example.com` | `canonical-and-sitemap-coherence` — a substring is not the host |
| `robots-control/` | `<meta name="robots" content="noindex">` in the form the old regex read | `staging-noindex-leftover` at `index.html:4` (the control) |

This is a unit corpus of the instrument. It is not the benchmark corpus under
`web-launch-benchmark/`, whose protocol stays frozen.
