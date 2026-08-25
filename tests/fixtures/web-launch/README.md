# web-launch fixtures

Three build trees for `check_web_launch_readiness`, and the pairing is the point:
`staging-leftover` and `clean-marketing` differ **only** in the indexability
signals, so a finding on the first and silence on the second isolates the check
rather than the fixture.

| fixture | carries | used for |
|---|---|---|
| `staging-leftover/` | a `noindex` robots meta **and** a blanket `Disallow: /` | the critical finding, with `file:line` |
| `clean-marketing/` | the same page minus those two, plus a path-scoped `Disallow: /admin/` and a `Sitemap:` line | the clean state — and it proves the check does not fire on *any* `Disallow` |
| `saas-app/` | an authenticated-app shell | the `applies_to` axis: local-business items skip with the site type as the reason |

`clean-marketing/robots.txt` deliberately keeps a `Disallow: /admin/`. A check
that matched any `Disallow` would pass the naive clean fixture and still be
wrong; this one has to distinguish a **blanket** block from a path rule.
