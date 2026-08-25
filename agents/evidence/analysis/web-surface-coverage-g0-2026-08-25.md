<!-- evidence-type: analysis -->

# The web-surface vocabulary is absent from the estate — G0, re-measured

> `road-to-web-launch-readiness` Phase 0.1. Measured at **`4014008f7`** on
> **2026-08-25**, re-run rather than copied from the roadmap's Context section.
> Every figure below names the command that produced it.

## The measurement

```bash
grep -ril "<term>" src/skills/ src/rules/ src/domains/ | wc -l
```

| term | files matching | reading |
|---|---:|---|
| `robots` | **0** | zero coverage |
| `noindex` | **0** | zero coverage |
| `meta description` | **0** | zero coverage |
| `lighthouse` | **0** | zero coverage |
| `alt text` | 7 | accessibility prose, not a launch check |
| `404` | 19 | HTTP-status tables, not a custom-error-route check |

**The four zeroes are the finding**, and they reproduce exactly against the
roadmap's Context table — same terms, same counts, a different day and a
different commit.

## Two terms measured beyond the roadmap's list, and why they are not evidence

Recorded because a later reader would otherwise add them and reach a different
conclusion:

- **`canonical` → 115 files.** This word is load-bearing in this repository in a
  completely different sense — "the canonical rule", "the canonical list", "the
  canonical source of truth". None of the 115 is about a canonical **URL**. A
  term whose count is dominated by a homonym cannot serve as coverage evidence
  in either direction, which is presumably why the roadmap left it out.
- **`sitemap` → 2 files.** Non-zero but tiny. Not claimed as coverage; recorded
  so the next measurement does not read 2 as a change from an unrecorded 0.

## The nearest-named skill scores zero on every axis

`src/skills/launch-readiness/SKILL.md`, **220 lines**, case-insensitive
`grep -c` per term:

| `404` | `robots` | `noindex` | `canonical` | `meta` | `alt text` | `analytics` | `legal` |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

**Eight of eight.** Its own description says what it is instead: *"Use before
merging a release-shaped PR — pre-merge checklist, rollout plan, rollback
criteria, ops handoff."* A release-process skill, not a web-surface one. The name
collision is the only thing the two share.

## What this establishes, and what it does not

**Establishes:** the staging-`noindex` class, robots/sitemap coherence,
per-route metadata and Lighthouse-shaped checks have **no** coverage in the
skill, rule or domain estate, and the skill whose name suggests otherwise has
none either.

**Does not establish** that a new skill is the right remedy. That is the estate
decision (`b-estate-decision-web-launch`), and a coverage gap is its input rather
than its answer. Nor does it establish that the gap costs anything — the
pre-registered Phase 3 benchmark is what would show a skill finds more real
defects than a bare audit prompt, and it carries a hard DROP gate on a
site-type-irrelevant decoy.

**Reproduce the whole table** with the two commands above on a clean checkout of
`4014008f7`. If a count has moved, the estate has changed and the decision this
note feeds should be re-taken rather than inherited.
