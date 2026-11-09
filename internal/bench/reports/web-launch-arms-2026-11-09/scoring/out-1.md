You are a blind scorer for a launch-audit benchmark. Below are: the scoring rules (Sections 5 and 6 of a frozen protocol), the benchmark's manifest of real defects and its decoy, the site's files, and ONE audit report written about that site by an unknown auditor. Score the report against the manifest exactly as the rules say. Do not guess who or what wrote the report.

Return ONLY one JSON object, no prose around it, with this shape:

{
  "output_id": "<the id given below>",
  "truth_scorable": true | false,
  "truth_scorability_note": "<one sentence; why not, when false>",
  "findings": [
    {"n": 1, "claim": "<the atomic asserted defect, short>", "location": "<file(s) or site-wide>", "duplicate_of": null | <n>, "matches_row": "<manifest row id>" | null, "decoy": true | false, "note": "<one sentence of evidence>"}
  ],
  "decoy_flagged": true | false,
  "matched_rows": ["<row id>", ...],
  "false_positives": <count of deduplicated findings with no match, decoy flags included>
}

Use the manifest's own row identifiers. List every atomic asserted defect in the report, including those in summaries and recommendations; mark duplicates with duplicate_of rather than dropping them.

Output id: out-1
Site: saas-app

## Scoring rules

## 5. Shared ground truth and location requirement

Only after all six outputs and their hashes are sealed does a separate scoring coordinator receive the hidden manifest. Both arms use exactly the same real-defect rows and the same decoy row, without filtering by the treatment's capabilities or applicability declarations. No row can be deleted because neither arm found it. Unlisted findings cannot be added to the truth set after seeing outputs.

Scorers first assess whether the manifest identifies distinct real defects, their fixture and affected location/scope, and the decoy clearly enough to apply this rubric using the packaged evidence. Require at least one real row overall, coverage of the intended three-fixture evaluation, and a uniquely identifiable decoy. If a row requires evidence supplied to neither arm, cannot be distinguished from another row, or cannot be adjudicated from the shared evidence, the shared truth is not scorable: UNDERPOWERED. Do not quietly remove that row, repair fixtures, or obtain extra evidence for only one arm.

A match requires both the correct defect and the correct affected page/file. Accept relative-path normalization (`./`, slash direction) and an unambiguous route-to-file mapping established by the supplied files. Line numbers are helpful but not required. A correct issue on the wrong page receives no credit. For a genuinely site-wide manifest row, an explicit site-wide assertion suffices; for an absent resource, its correct expected path or an explicit correct site-wide absence suffices. A page-specific issue with no location does not match. Naming every page without tying the issue to supporting evidence is insufficient.

## 6. Semantic matching, credit, precision, recall, decoy

Scorers extract atomic asserted defects from the entire final answer, including summaries and recommendations. Split an item only when it independently asserts multiple concrete defects. A list of possible causes or alternative guesses is not multiple established findings. Mere stylistic advice, explicit nonapplicability, and an uncertainty that asserts no defect are not findings. Wording such as “might” cannot exempt an otherwise concrete claim that a specific launch problem exists and needs fixing.

An atomic finding matches a real manifest row only when it identifies the same underlying faulty condition, scope, and consequence sufficiently to distinguish that row, backed by the shared evidence. Exact terminology, severity, check IDs, and remediation wording need not agree. A matching fix alone without identifying the defective condition is insufficient. A generic category such as “improve accessibility,” “SEO is broken,” or “check compliance” gets no credit. A broad assertion is not matched to every row it could encompass; separately evidenced and localized subclaims may be split and matched individually. There is **no partial credit**: each match is 1 or 0.

Within each site and arm, collapse semantic duplicates with the same defect and affected scope into one finding; repetition neither gains recall nor adds false positives. Distinct unsupported claims remain distinct. Match deduplicated findings to real rows one-to-one, maximizing the number of valid matches. Resolve equally sized assignments by manifest row ID lexical order, then finding appearance order. Each real row contributes at most one true positive per arm. Every remaining asserted finding is a false positive, including a wrong-location finding, an unsupported extra claim, or a decoy flag. A real observation outside the frozen manifest remains a false positive relative to this benchmark; annotate it without changing scores.

Let N be the total number of real manifest rows across the three fixtures, TP the number of matched rows, and FP the unmatched deduplicated asserted findings. For each arm report `recall = TP/N` and `precision = TP/(TP+FP)` using exact fractions and decimals. When there are no findings, report precision as undefined and recall as zero. Also report per-site counts, the shared denominator, and `delta_recall = recall_treatment - recall_comparator`. Precision is descriptive and imposes no additional success threshold.

A decoy is flagged when an output asserts that the manifest's designated irrelevant condition is a launch defect, or recommends correcting its alleged absence/presence as a launch problem, on the decoy's fixture and scope. Explicitly saying it is irrelevant, correctly skipped, or merely unknown does not flag it. Detect this semantically across the whole answer, independent of formatting or matching real rows. Do not let a subsequent disclaimer cancel a concrete contradictory defect assertion. Record a binary decoy flag for each arm. Conservatively interpret the registered unqualified “the decoy is flagged” as a veto if **either arm** flags it; report which arm did so. No recall gain can offset that veto.


## Manifest

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


## Site files (saas-app)

### app/dashboard.html

~~~
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Ledgerly — close your books faster</title>
</head>
<body>
  <h1>Dashboard</h1>
  <img src="/icons/chart.svg" />
  <img src="/icons/export.svg" />
</body>
</html>

~~~

### imprint.html

~~~
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ledgerly — Imprint</title>
  <meta name="description" content="Company details and the responsible contact." />
</head>
<body><h1>Imprint</h1></body>
</html>

~~~

### index.html

~~~
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Ledgerly — close your books faster</title>
  <meta name="description" content="Bookkeeping automation for small finance teams." />
  <script src="http://cdn.ledgerly.example/widget.js"></script>
</head>
<body>
  <h1>Ledgerly</h1>
  <img src="/product-screenshot.png" />
  <a href="/app/dashboard.html">Open the app</a>
</body>
</html>

~~~

### robots.txt

~~~
User-agent: *
Disallow: /app/

~~~

## The audit report to score (out-1)

~~~
# Pre-launch audit: Ledgerly (saas-app)

I audited four files: `index.html`, `imprint.html`, `app/dashboard.html` and `robots.txt`.

## Established defects

1. **`index.html`: script loaded over insecure HTTP (mixed content).**
   - Evidence: `<script src="http://cdn.ledgerly.example/widget.js"></script>`
   - On an HTTPS site, browsers block this active mixed content, so the widget will not load. If it did load, it could be tampered with in transit. Use an `https://` URL.

2. **`index.html`: no viewport meta tag.**
   - Evidence: the `<head>` has only `charset`, `title`, `description` and the script. `imprint.html` does include `<meta name="viewport" ...>`.
   - Mobile browsers will render the landing page at desktop width.

3. **`app/dashboard.html`: missing `lang` attribute and viewport meta tag.**
   - Evidence: the page opens with `<html>` (no `lang`), and the `<head>` contains only `charset` and `title`.
   - This hurts screen-reader pronunciation and language detection, and the page will not render responsively on mobile.

4. **`index.html` and `app/dashboard.html`: images have no `alt` attribute.**
   - Evidence:
     - `index.html`: `<img src="/product-screenshot.png" />`
     - `app/dashboard.html`: `<img src="/icons/chart.svg" />` and `<img src="/icons/export.svg" />`
   - Screen-reader users get no description. Use meaningful alt text for informative images and `alt=""` for decorative ones.

5. **`app/dashboard.html`: the title is copied from the marketing homepage, and there is no meta description.**
   - Evidence: `<title>Ledgerly — close your books faster</title>` is identical to the title in `index.html`, while the page's `<h1>` is "Dashboard".
   - The title does not describe the page, and the two pages are indistinguishable in tabs, history and bookmarks. A title such as "Dashboard — Ledgerly" would fix this.
   - The page is disallowed in `robots.txt`, so the missing description is low priority.

6. **`imprint.html`: placeholder content.**
   - Evidence: `<body><h1>Imprint</h1></body>`, while the meta description promises "Company details and the responsible contact."
   - The page has no company name, address or contact. An imprint page without these fails its legal purpose in jurisdictions that require one.

7. **`imprint.html` is not linked from any supplied page.**
   - Evidence: the only link in the site files is `index.html` → `/app/dashboard.html`. Nothing links to `/imprint.html`.
   - A legal page must be easy to reach. Add a footer link on the landing page and in the app.

8. **Site-wide: no sitemap.**
   - Evidence: `/sitemap.xml` is absent from the supplied files, and `robots.txt` has no `Sitemap:` directive.
   - This is minor for a site this small, but it should be added or consciously skipped.

9. **Site-wide: no favicon.**
   - Evidence: `/favicon.ico` is absent, and no page has a `<link rel="icon">`.
   - Browsers will request `/favicon.ico` and get a 404, and the tab will show no brand icon.

## Uncertainties (not counted as defects)

- **Referenced assets are not in the supplied files:** `/product-screenshot.png`, `/icons/chart.svg` and `/icons/export.svg`. They may exist outside this snapshot. Confirm they are deployed, or the images will be broken.
- **`cdn.ledgerly.example/widget.js`:** I can't verify that the host serves HTTPS.
- **Privacy policy and terms pages:** none are supplied. A SaaS product normally needs them, but I can't tell whether they are meant to be part of this deployment.
- **`robots.txt` blocks `/app/`:** this looks intentional. It is not access control, so confirm the app requires authentication. `index.html` also links directly to `/app/dashboard.html`, and the dashboard HTML contains no sign of an auth gate.
~~~
