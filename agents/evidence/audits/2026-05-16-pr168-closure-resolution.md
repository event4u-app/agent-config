# PR #168 Closure-Audit — Resolution Report

**Date:** 2026-05-16
**Trigger:** User-initiated "Total Dominance" mandate; suspicion of phantom-shipping in PR #168 roadmap closures.
**Initial signal:** AI Council Slacker-Meter score 68/100 (Sonnet 3.5 + GPT-4o convergent).
**Final signal:** Realistic Slacker-Meter **~5/100** after filesystem verification.

## Method

1. Built `scripts/verify_roadmap_closure.py` — parses `## Closure decision` / `maintainer override` blocks and verifies every backticked token (paths, slash-commands, concepts, headings, md-links).
2. Iterated tool to v2 with **sentiment-aware claim extraction** (`shipped` / `dropped` / `mixed` / `neutral`), so dropped/sunset claims no longer count as phantoms.
3. Ran full-archive scan over 171 roadmaps.
4. Manually verified each non-verified hit against canonical source tree (`.agent-src.uncompressed/`, `.agent-src/`, `docs/contracts/`, `agents/`).

## Tool output (v2)

```
archive total: 171
with closure block: 8
phantom: 0
partial-phantom: 1
verified: 6
no-shipped-claims: 0
no-claims: 1
```

JSON: [`agents/evidence/audits/2026-05-16-archive-phantom-scan-v2.json`](2026-05-16-archive-phantom-scan-v2.json).

## Per-roadmap resolution

| Roadmap | Council verdict | Final verdict | Action taken |
|---|---|---|---|
| `step-2-skill-inventory-rationalization` | Type III phantom | verified | none — partial-completion closure clean |
| `step-5-schema-rigor` | Type II phantom | verified | none — Council misread sunset prose as shipped claim |
| `step-5-test-cleanup` | KEEP CLOSED + doc debt | verified | none — `road-to-test-consolidation` correctly described as "never materialised" |
| `step-10-caveman-parity` | — | verified | none |
| `step-13-non-dev-community-validation` | DEFER with trigger | verified | none — sunset clean |
| `step-14-mcp-runtime-stub` | KEEP CLOSED + cascade audit | no-claims | none — cascade parents verified clean |
| **`step-15-product-refinement`** | **Type I phantom (REVOKE + forensic)** | **partial-phantom 17 % (corrected)** | closure prose edited — `/explain` claim retracted explicitly; `/onboard` wizard / `cost_profile` presets / MCP-Registry / profile system all confirmed live |
| `step-99-north-star-restructure` | **Critical Partial — authority context missing** | **verified — Council phantom finding** | closure prose clarified — actual change was `.agent-src.uncompressed/contexts/authority/`, not a `agents/settings/contexts/` rename |

## Council findings re-assessed

| Council finding | Re-assessment | Evidence |
|---|---|---|
| step-15: 3/6 deliverables phantom (Wizard, `/explain`, install) | **1/6 phantom** — `/explain` only | `/wizard` is the `/onboard` flow (`.claude/skills/onboard/SKILL.md` exists); presets = `cost_profile` `minimal`/`balanced`/`research`/`custom` in `.agent-settings.yml`; install path = `npx @event4u/agent-config init` in README |
| step-5-schema: 0/210 skills adopt `model_tier:` pattern | **non-issue** — closure block explicitly drops the pattern as "never materialised" | sentiment-aware parser now classifies as `[DROP]`, not phantom |
| step-99: authority context dir missing → load-bearing gap | **Council looked at wrong path** | `.agent-src.uncompressed/contexts/authority/` has 4 files (~17 kB); compressed mirror exists; `docs/contracts/file-ownership-matrix.json` lists 34 entries; kernel rules load via `load_context:` frontmatter |
| step-2: only 1/210 skills archived after overlap analysis | inferred-moderate — kept as informational | no action required; tool ran, overlap report exists; the "no candidate" decision is itself a defensible verdict |

## Tool capabilities (v2)

| Claim kind | Verification method |
|---|---|
| `path`, `md-link` | filesystem check + `git log --all --full-history` fallback |
| `task` | regex against `Taskfile.yml` + `taskfiles/*.yml` |
| `slash-cmd` | search `.agent-src.uncompressed/commands/` + `.claude/skills/` |
| `concept` | `git grep` literal token across skill / rule / context tree |
| `heading` | regex against `## <heading>` in skill / rule body text |

Each claim now carries a `sentiment` field derived from the surrounding bullet:
`shipped` (must exist), `dropped` (allowed to be missing), `mixed` (both markers — flagged transparently), `neutral` (no signal — informational).

Phantom rate is computed **only over shipped claims** — eliminates the v1 false positives on sunset language.

## Slacker-Meter recalibration

| Source | Score | Basis |
|---|---|---|
| Council Sonnet 3.5 | 68/100 | "9/28 phantom phases" — pattern-inferred |
| Council GPT-4o (Round 2) | 66/100 | step-99 critical partial + step-5-tests doc debt |
| Tool v1 | ~17/100 | 1/8 closures with mixed evidence |
| **Tool v2 + manual** | **~5/100** | 1 real phantom token (`/explain`) in 8 closures, now retracted |

Interpretation: Council's "B-student drafts" framing was an artefact of pattern-matching without filesystem confirmation. The actual closure hygiene in PR #168 was sloppy in exactly one place (`/explain`) and unclear-but-defensible in one other (step-99's "rename" phrasing). Both are now corrected in tree.

## Artefacts shipped this audit

| File | Purpose |
|---|---|
| `scripts/verify_roadmap_closure.py` | Sentiment-aware closure verifier — re-runnable for future closure waves |
| `agents/evidence/audits/2026-05-16-archive-phantom-scan-v2.json` | Machine-readable scan output (171 roadmaps) |
| `agents/evidence/audits/2026-05-16-pr168-closure-resolution.md` | This report |
| `agents/runtime/council/questions/pr168-closure-audit.md` | Original Council prompt |
| `agents/runtime/council/responses/pr168-closure-audit.json` | Sonnet 3.5 + GPT-4o raw responses |

## Edits to closures

- `agents/roadmaps/archive/step-15-product-refinement.md` line 24 — replaced ambiguous one-line shipped-claim with file-cited list; `/explain` retracted with rationale.
- `agents/roadmaps/archive/step-99-north-star-restructure.md` line 18 — clarified that the Restructure Wave added `.agent-src.uncompressed/contexts/authority/`, not a rename of `agents/settings/contexts/`.

No checkboxes were flipped. No archive roadmaps were revoked.

## Recommendations for next closure wave

1. Run `python3 scripts/verify_roadmap_closure.py` against any new closure batch before PR.
2. When writing closure prose, **cite paths explicitly** (e.g., `.agent-src.uncompressed/skills/foo/SKILL.md`) — saves reviewer effort and prevents Council misreads.
3. Distinguish *shipped* from *dropped* lexically: use markers like "shipped at &lt;path&gt;", "sunset", "dropped on &lt;ground&gt;", "never materialised" — the v2 verifier reads these.
4. If a feature is sunset but referenced in prose by name, prefer the bullet form: dropped-marker first, then the name. The verifier classifies bullet sentiment, not document sentiment.
