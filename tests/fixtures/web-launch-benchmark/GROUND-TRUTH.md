# Benchmark ground truth — `web-launch-readiness` Phase 3.1

Three fixture sites of **known** defect state, seeded **before either arm runs**.
Both arms — the skill and the bare-prompt comparator — are scored against this
file, not against each other's output.

**This is the ground truth, not a report.** It is checked in so that a fixture
which quietly stops carrying a defect is a visible diff rather than a weaker
benchmark, and so that neither arm's author can adjust the target after seeing a
score. `tests/scripts/web_launch_benchmark_fixtures.test.ts` asserts every row
below is actually present in the tree.

Served locally in CI as static directories; nothing here is deployed.

## The decoy — the hard gate, and why it is a gate rather than a metric

> **`saas-app` is missing a team photo.** That is a site-type-IRRELEVANT
> omission: a marketing site owes its visitors a face, an authenticated
> bookkeeping app does not, and no launch check in this suite asks for one.

Flagging it is a **classification failure that DROPS the claim regardless of
recall**. A skill that finds everything by flagging everything scores well on
recall and is useless, and a recall threshold cannot see that failure — which is
exactly why the decoy is a gate and not another number.

**Present in exactly one fixture.** Seeding it twice would let an arm learn the
pattern rather than the principle, and would make the two fixtures
non-independent.

## `local-business/` — a static shop site, DE-targeted

| # | defect | where | check |
|---|---|---|---|
| 1 | staging `noindex` still in the head | `index.html:6` | `staging-noindex-leftover` |
| 2 | `robots.txt` blanket-blocks the whole site | `robots.txt:2` | `staging-noindex-leftover` |
| 3 | no custom 404 page anywhere in the build | (absence) | `custom-error-route` |
| 4 | no `<title>` and no description on `sortiment.html` | `sortiment.html` | `per-route-metadata` |
| 5 | no `<title>` and no description on `kontakt.html` | `kontakt.html` | `per-route-metadata` |
| 6 | three content images with no `alt` | `index.html:13`, `sortiment.html:9`, `sortiment.html:10` | `image-alternative-text` |
| 7 | no Datenschutz / privacy page (Impressum IS present) | (absence) | `required-legal-pages` |

Row 7 is the DE half-miss on purpose: a site with an Impressum and no
Datenschutzerklärung is the common real-world shape, and a check that only asked
"is there a legal page" would pass it.

## `saas-app/` — an authenticated product, marketing shell in front

| # | defect | where | check |
|---|---|---|---|
| 8 | a `<script src="http://…">` on a host they control | `index.html:7` | `https-enforcement` |
| 9 | no custom 404 page | (absence) | `custom-error-route` |
| 10 | `app/dashboard.html` has no `lang`, no viewport | `app/dashboard.html:2` | `document-head-basics` |
| 11 | `index.html` has no viewport | `index.html:3` | `document-head-basics` |
| 12 | three content images with no `alt` | `index.html:10`, `app/dashboard.html:8`, `app/dashboard.html:9` | `image-alternative-text` |
| 13 | the marketing shell and the dashboard share one `<title>` | `index.html:5`, `app/dashboard.html:5` | `per-route-metadata` |
| 14 | no privacy page (imprint IS present) | (absence) | `required-legal-pages` |
| **D** | **DECOY — no team photo** | (absence) | **none. Flagging this DROPS the claim.** |

## `docs/` — a documentation site

| # | defect | where | check |
|---|---|---|---|
| 15 | no custom 404 page | (absence) | `custom-error-route` |
| 16 | `api.html` has no description | `api.html` | `per-route-metadata` |
| 17 | both pages carry the identical `<title>` | `index.html:6`, `api.html:6` | `per-route-metadata` |
| 18 | one content image with no `alt` | `index.html:10` | `image-alternative-text` |
| 19 | `api.html`'s canonical points at `ledgerly.example`, a host that appears nowhere in `sitemap.xml` (`docs.ledgerly.example`) | `api.html:7` | `canonical-and-sitemap-coherence` |

Row 19 is the shape a presence check misses: the canonical is **present** and
**wrong**, copied from the marketing site, so the page that gets indexed is not
the page anyone chose.

## What this fixture set does NOT establish

Three fixtures on one model is **one measurement**, not a general result about
audit skills. It establishes whether this skill beats a bare prompt on **these**
defects, and generalises to neither another model nor another defect set. If the
fixtures cannot be scored against this ground truth at all, the claim is
**UNDERPOWERED** rather than dropped — an unbuildable fixture says nothing about
the skill.
