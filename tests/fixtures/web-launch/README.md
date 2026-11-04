# web-launch fixtures

Build trees for `check_web_launch_readiness`, and the pairing is the point:
`staging-leftover` and `clean-marketing` differ **only** in the indexability
signals, so a finding on the first and silence on the second isolates the check
rather than the fixture.

| fixture | carries | used for |
|---|---|---|
| `staging-leftover/` | a `noindex` robots meta **and** a blanket `Disallow: /` | the critical finding, with `file:line` |
| `clean-marketing/` | the same page minus those two, plus a path-scoped `Disallow: /admin/`, a `Sitemap:` line and a valid JSON-LD block on `about.html` | the clean state — and it proves the check does not fire on *any* `Disallow` |
| `saas-app/` | an authenticated-app shell | the `applies_to` axis: local-business items skip with the site type as the reason |
| `consent-order-bad/` | the measurement tag **above** the gate script, in one page | the ordering assertion FIRES |
| `consent-order-good/` | the gate script **above** the measurement tag, same page otherwise | the ordering assertion stays silent — both directions, or the polarity is untested |
| `consent-minified/` | one 1,151-character bundle line carrying both | the `unknown` result: the instrument cannot order what a minifier put on one line |
| `snippet-blocked/` | `clean-marketing` plus `max-snippet:0` (robots, content first) and `nosnippet` (googlebot) | `snippet-eligibility` FIRES on both pages |
| `structured-data-broken/` | `clean-marketing` with a trailing comma in its JSON-LD block | `structured-data-parses` FIRES at the block's line |
| `form-variants/` | eight copies of `clean-marketing`, each changing how one thing is written | see `form-variants/README.md` |

`clean-marketing/robots.txt` deliberately keeps a `Disallow: /admin/`. A check
that matched any `Disallow` would pass the naive clean fixture and still be
wrong; this one has to distinguish a **blanket** block from a path rule.

`consent-order-bad/index.html` keeps the word *consent* in its `<meta
name="description">` on purpose. Prose describing a gate is not a gate, and a
detector that read the description as the gate's position would report the page
correctly ordered while the tag still fires first. The ordering pass therefore
only reads lines that carry executable markup, and this fixture is what proves
it. `consent-order-good/` deliberately avoids the word, so its pass is earned by
the script order rather than by a sentence.
