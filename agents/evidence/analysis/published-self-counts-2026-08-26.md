---
complexity: lightweight
---

<!-- evidence-type: analysis -->

# Every self-count this package publishes — enumerated, with carrier shape

> Produced for `road-to-published-number-truth` step 0.1 on **2026-08-26**, at
> the branch head of `drain/published-number-truth`. D7 of that roadmap says no
> definition of "self-count" exists; this is the population a definition can be
> written against.

## Method, so the table is reproducible rather than asserted

- **Surfaces swept:** `README.md`, `CAPABILITIES.yaml`, `docs/comparison.yaml`,
  and the badge block — the four the step names.
- **Boolean column** is the live return of `is_quantified_claim(line)` from
  `src/scripts/check_claims.ts`, evaluated **before** this change widened it and
  **after**, so the widening's effect is visible rather than claimed.
- **Measured column** is the canonical counter, `src/scripts/update_counts.ts`
  → `count(kind)`, the same function `--check` compares badges against.

```bash
./scripts-run src/scripts/update_counts --check      # prints the truth line
./scripts-run src/scripts/check_claims --json        # the sweep's own view
```

Truth line at the time of writing:

```
📊  Truth: skills=299 skills_scoped=228 rules=120 commands=202
    commands_active=202 guidelines=114 personas=29 router_rules=114
```

## The population

| # | Noun | Number | `file:line` | Carrier shape | `is_quantified_claim` BEFORE | AFTER | Measured value | Match? |
|---|---|---|---|---|---|---|---|---|
| 1 | Skills | 299 | `README.md:7` | badge URL | **false** | true | 299 skill directories | ✅ |
| 2 | Rules | 120 | `README.md:7` | badge URL | **false** | true | 120 source rules · **119 projected** | ✅ to source; basis now stated |
| 3 | Commands | 202 | `README.md:7` | badge URL | **false** | true | 202 recursive · **61 top-level** | ✅ to recursive; basis now stated |
| 4 | Guidelines | 114 | `README.md:7` | badge URL | **false** | true | 114 under `docs/guidelines/` | ✅ |
| 5 | Personas | 29 | `README.md:7` | badge URL | **false** | true | 29 (README excluded) | ✅ |
| 6 | Advisors | 5 | `README.md:7` | badge URL | **false** | true | 5 | ✅ |
| 7 | Python scripts | ~112 | `README.md:327` | qualified noun | **false** | true | **0** | ❌ **removed** |
| 8 | Python version | 3.10+ | `README.md:600` | qualified noun | **false** | n/a | **0 Python files** | ❌ **removed** |
| 9 | Upgrade target | 6.0 | `README.md:89` | anchor text | false | false | current major **14** | ❌ **corrected** |

**Rows returning `false` before this change: 8 of 9.** That is the finding of
0.1 in one number — the sweep could not see the population it was supposed to
watch. Row 9 is the one shape still outside it and deliberately so: an anchor
naming a version is not a count, and widening the pattern to catch it would also
catch every semver in the file.

## What the enumeration refuted

**D1 — `badge/Personas-29` is wrong — is REFUTED.** The badge reads 29 and the
canonical counter reads 29. The roadmap's own verify for step 1.1
(`ls dist/agent-src/personas/*.md | wc -l`) returns **30** because it counts
`README.md`; `update_counts.ts:226` excludes it, with the comment *"personas live
as flat .md files, README excluded"*. **The measurement was wrong, not the
badge**, and `update_counts --check` was green on this row the whole time.

## What the enumeration found that the roadmap did not name

**The `Rules-120` badge has the same undeclared-basis defect as `Commands`.**
The badge integer is 120 and it links to `dist/agent-src/rules/`, which holds
**119** `.md` files. Both numbers are correct: `telegraph-speak.md` is a dormant
rule that is not projected. Nothing said so at the badge, so a reader following
the link and counting would find a discrepancy and no explanation — which is D7's
defect exactly, on a row D7 did not list.

Both bases are now stated under the badge block, together with the personas
exclusion.

## Carrier shapes, generalised

Three shapes carry every count above, and only one was matched before:

1. **Badge URL** — `badge/Skills-299`. No whitespace at all, so no prose pattern
   can see it. Six of the nine rows.
2. **Qualified noun** — `112 Python scripts`. A word sits between the number and
   the noun, and a pattern anchored on the noun reads straight past it.
3. **Bare noun** — `299 skills`. The shape the original `SELF_COUNT` was closest
   to, and even this was limited to three host-reach nouns.

`SELF_COUNT` now matches 1 and 2 and the artefact vocabulary of 3. Negative
fixtures pinned in the same change: a year (`in 2026`), an ordinal
(`the 3rd attempt`), a version string (`version 14.12.0`), an ADR id
(`ADR-240 is proposed`) and a section reference (`see section 4.2`) all stay
false.
