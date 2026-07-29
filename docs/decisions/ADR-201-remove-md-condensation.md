---
adr: 201
status: accepted
date: 2026-07-29
decision: remove-md-condensation
supersedes: —
superseded_by: —
phase: token-saving H3 · condensation ROI decision
type: structural
---

# ADR-201 — Remove the LLM `.md` condensation step; keep the deterministic path rewriter

## Status

**Accepted — decision recorded, execution NOT yet performed.** The removal steps
in § Decision are authorized in principle by this record but each needs the
operator's go-ahead before it lands, because they delete shipped CI machinery and
raise a follow-on question about whether `dist/agent-src/` should remain a
separate tree at all (§ Open question).

## Context

`src/**/*.md` → `dist/agent-src/**/*.md` was designed to condense prose and cut
the shipped token surface. The transform is **not a script**: per
`src/scripts/condense.ts:668` (`.md files are condensed by the agent, not copied
here`) and `/condense` Step 3, it is a natural-language instruction set executed
by an LLM.

The roadmap gate for keeping it (H3): saves ≥ 500 tok **AND** deterministic
**AND** readable.

### Measurement, 2026-07-29 (exact tiktoken `cl100k_base`, n = 429 artifacts)

| Sub-gate | Result |
|---|---|
| **Saving** | **FAIL.** 0 of 429 artifacts clear 500 tok; best case 368 (`skills/ai-council`, 3.0%); median per-artifact delta **0**; aggregate 5,930 tok = **0.86%** of 691,382. **267/429 pairs byte-identical** — a literal no-op for 62% of the corpus. 22 artifacts net-*negative*. On the 9 always-loaded kernel rules: 7,680 → 7,716 = **−36 tok**, i.e. the per-request surface gets *worse*. Body-only (frontmatter stripped): 0.92%, still 0/429 ≥ 500. |
| **Determinism** | **FAIL.** `effective_hash()` (`condense.ts:463`) hashes the **source**; the condensed **output is never hashed**. `--check-hashes` answers "has the source changed", never "would re-condensing reproduce the same bytes". |
| **Readability** | **PASS with defects** — 0/429 Iron Law headings lost, 0/429 fenced blocks lost, 424/429 keep every heading. But it passes largely *because* the transform is near-no-op. Content losses in 4 artifacts, incl. `rules/fast-path-marker-visibility` dropping 4 sections and redirecting the reader to a file that does not exist. |

### The determinism failure, observed twice — the second time is the sharper one

**Second instance, 2026-07-29, during execution prep.** A one-line fix to
`src/rules/model-recommendation.md` (normalising a `load_context` entry from the
disallowed `../contexts/…` to the canonical `contexts/…`) had been propagated to
`dist` and hash-marked. The dist half later vanished — src carried the fix, dist
matched `HEAD`. `--check-hashes` reported **"All condensation hashes are clean"**
throughout, and every gate passed: `lint_load_context` scans `src/`, so it saw the
fixed form, while `.claude/rules/model-recommendation.md` — a symlink into `dist` —
kept shipping the broken one.

The mechanism is now precisely nameable: **55 rule pairs legitimately differ**
(that is what condensation is *for*), so a source-keyed hash cannot distinguish
*intended* divergence from *drift*. A silently reverted file is indistinguishable
from a correctly condensed one. That is not a bug in the cache — it is the cache's
design boundary, and it is why Question C's verdict is DELETE rather than rename.

### The first instance

On 2026-07-29 a parallel agent accidentally reverted most of this session's work,
leaving three `dist/` files carrying repairs their `src/` counterparts no longer
had. `condense --check-hashes` reported **"All condensation hashes are clean"**
throughout. The drift was undetectable by construction — not a hypothetical.

### Two defects the measurement uncovered on the way

1. **The quality gate was blind.** `check_condensation.ts` hardcoded
   `SOURCE_DIR = '.agent-src.uncondensed'`, a tree holding **0 files** since the
   ADR-051 flat-`src/` migration. It scanned nothing, printed
   `TOTAL | 0 | 0 | 0 | 0%`, exited **0**, and was wired into CI at
   `.github/workflows/consistency.yml:179`. **Its own unit test pinned the bug**
   (`'missing root → clean (exit 0)'`). Retargeted at `src/` with a
   `scanned_nothing` error guard; on its first real run it found **9 hidden
   defects**, all since repaired — including **6 cases where telegraph
   condensation had leaked INTO fenced code blocks**, corrupting template blocks
   users are meant to copy verbatim (a violation of telegraph-speak's own
   carve-out #3 and `preservation-guard`'s byte-for-byte rule).
2. **A locked contract number was contradicted.**
   `docs/contracts/kernel-membership.md:66` locked median `r = 0.712` (a 28.8%
   saving). Re-measured on its own three pilot files: **1.000 / 0.997 / 0.998**.
   Blast radius verified as documentation-only — no code or config consumes `r`.

### Council

2026-07-29, `claude-sonnet-4-5` + `gpt-4o`, 2-round debate: **REMOVE, unanimous,
no dissent.** Cited reasoning: *"the locked number never existed"*; *"the
determinism claim is unfalsifiable by construction"*; *"readability passes only
because 62% of outputs are unchanged"*.

## Decision

Remove the **LLM condensation** of `.md`, and keep the deterministic transform.

Ordered steps both council members converged on:

1. **Preserve `apply_path_rewriter`** (`condense.ts:524`) as a standalone
   deterministic transform. It is the ONE load-bearing piece — a pure, idempotent
   string rewrite (`../../docs/…` → `../docs/…`) so references resolve from the
   *delivered* location, affecting ~38 artifacts. **Any removal that drops this
   breaks link resolution in the projected tree.**
2. Redirect `/condense` to copy `src/**/*.md` → `dist/agent-src/**/*.md` with
   path rewriting only.
3. Delete the LLM condensation instruction set from `condense.ts` and the
   `/condense` command's Step 3.
4. Delete `internal/.condensation-hashes.json` (744 source-hash keys) and the
   `--check-hashes` / `--mark-done` cache surface that depends on it.
5. Delete `check_condensation.ts` and its CI step.
6. Update `preservation-guard`'s condensation applicability (its checklist still
   names condensation as a covered transformation).
7. Verify all 430 pairs still pass structural checks (headings, fences intact).
8. Record the CHANGELOG note.

## Execution verdicts (council 2026-07-29, `claude-sonnet-4-5` + `gpt-4o`, 2 rounds)

| Question | Verdict | Convergence |
|---|---|---|
| **A** — keep `dist/agent-src/` or collapse it? | **KEEP**, as a deterministically-produced, git-diffable artifact | Converged in round 2: gpt-4o opened for *collapse*, then reversed — "collapsing introduces risks without significant benefits… maintains a comprehensible developer operations model" |
| **B** — delete `check_condensation` or repurpose it? | **REPURPOSE** into `dist == rewrite(src)` byte-exactness | Converged round 1, both members. "It enforces the property ADR-201 was trying to create… the old check was theater — it hashed sources but never verified outputs" |
| **C** — keep the source-hash cache? | **DELETE** | Converged round 1. "The cache is *why drift went undetected*… `.condensation-hashes.json` + `--check-hashes` will be *lies* after ADR-201" |

On **A**, the decisive argument against collapsing was scope discipline, not
aesthetics: collapsing touches the installer, the per-tool symlink layout, and the
`source-of-truth` Iron Rule's wording — "surface area for new bugs while fixing an
old one". The duplicated tree was never the smell; **non-determinism was**, and a
derived artifact that can be `git diff`ed is build hygiene.

### The dissent on D, and why it does not survive

One member rebutted the one-pass sweep in round 2 with a real argument, not a
strawman: *"ADR-051 establishes a dependency direction (src → dist), not a content
equivalence requirement… the sweep is not restoring source truth — it is discarding
162 deltas that may contain improvements never backported to src."*

That is correct about the measurement's limits: § Execution finding established the
delta's *size* (1.10% of words), not that its content is worthless. But the
objection assumes irreversibility, and **`dist/agent-src/` is tracked in git** — the
162 deltas survive in history, diffable and recoverable, after the sweep. An
improvement that was never backported is not destroyed by the collapse; it is one
`git show` away, and the sweep makes it *visible* as a diff instead of leaving it
silently divergent. The stop condition in § Execution finding (>5% word growth →
surface individually) catches the outliers regardless.

## Blast radius — measured 2026-07-29, larger than the 8 steps imply

The steps above name `condense.ts`, the hash file, `check_condensation`, and
`preservation-guard`. A `grep` for the mechanism's real consumers
(`should_condense` · `condensation-hashes` · `mark_done` · `check-hashes`) returns
**13 files**, including six the steps do not mention:

| File | Why it is in scope |
|---|---|
| `src/domains/meta/condense/command.md` | **The `/condense` source** — Step 3's prose rules live here (the dist copy is a projection) |
| `src/domains/meta/check-current-md/command.md` | consumes the staleness notion |
| `src/domains/meta/upstream-contribute/command.md` | same |
| `src/skills/upstream-contribute/SKILL.md` | same |
| `src/skills/git-workflow/SKILL.md` | references the `--mark-done` step in its flow |
| `src/scripts/install-hooks.sh` | wires a condensation-related hook |
| `src/scripts/annotate_discovery.ts` | uses `should_condense` |
| `src/scripts/check_references.ts` | same |
| `tests/scripts/condense.test.ts`, `annotate_discovery.test.ts` | pin the current behaviour |
| `taskfiles/content.yml`, `.github/workflows/consistency.yml` | invoke the gates + hash verification |

### The mechanism, so execution needs no rediscovery

`mark_done(rel)` (`condense.ts:511`) calls `apply_path_rewriter(rel)` on the
**target**, then stores the **source** hash. `sync_non_md` (`:663`) copies
everything for which `should_condense` is false — and `should_condense` (`:593`)
already has a `COPY_AS_IS` / `COPY_AS_IS_DIRS` escape (`:374`, `:376`).

So the switch is narrow: make `.md` flow through the copy path and then the
existing rewriter, and delete Step 3's prose rules. It is a **routing change plus a
command edit**, not a rewrite of `condense.ts`.

## Consequences

- The shipped token surface is unchanged in practice — condensation was saving
  0.86% aggregate and −36 tok on the always-loaded kernel, so removing it is
  approximately token-neutral and slightly *better* on the per-request surface.
- `dist/agent-src/**/*.md` becomes a path-rewritten copy of `src/`. The
  `source-of-truth` Iron Rule (never edit a projection) still holds — the
  projection is simply cheaper to produce and byte-predictable.
- The condensation-hash workflow (`--mark-done` after each edit) disappears, along
  with the class of failure where a stale hash blocked a commit.
- **A whole defect class becomes impossible:** condensation can no longer corrupt
  a code block, drop a section, or silently diverge from source, because it no
  longer rewrites prose.
- CI loses one step; the `consistency.yml` path filters referencing
  `.agent-src.uncondensed/**` become dead and should go with it.

## Execution finding (2026-07-29, added while preparing the sweep) — an uncosted content change

**This ADR does not state that executing it rewrites 162 shipped artifacts.** Of
the 429 pairs, 267 are byte-identical, so the copy is a no-op for 62% of the
corpus — but the remaining **162 files currently carry LLM-produced prose that
differs from source**. Collapsing `dist` to a copy replaces that prose with the
source prose. Cost: **+5,930 tok aggregate (0.86%)** and **+36 tok on the
always-loaded kernel** — trivial in tokens, but 162 unreviewed text changes in one
pass.

Two defensible readings, and the evidence does not settle between them:

- **It removes drift.** `src/` is the source of truth (ADR-051); dist carrying
  different prose is unreviewed divergence — including four artifacts with
  documented content LOSS and six where condensation corrupted fenced code blocks
  in copy-me templates. Collapsing is then a correctness *gain*.
- **It is 162 unreviewed edits.** Some condensed prose is genuinely better — the
  best case (`skills/ai-council`) kept all 43 headings while saving 368 tok.
  Reverting wholesale regresses those files.

**Answered by measurement 2026-07-29 — one pass is proportionate.** The question
was "one pass, or a per-file gate?", and the line count made the sweep look far
bigger than it is:

| Measure | Value |
|---|---|
| Files differing (`diff -rq`) | **164** (55 rules + 109 skills) |
| Diff lines (`^[<>]`) | **3,970** (505 + 3,465) |
| …of which involve a relative-path rewrite | **145** (~4%) |
| **Actual word delta**, src → dist (`wc -w`) | **381,401 → 377,188 = −4,213 words = 1.10%** |
| Median per-artifact word reduction | **0.00%** |

The 3,970 lines are **inflated by reflow**: a sampled diff shows pairs that differ
only in where the line breaks fall, carrying no semantic change in either
direction. Where words genuinely change it is telegraph — dropped articles,
abbreviations (`vulnerabilities`→`vulns`, `MCP servers`→`MCP`), removed framing —
occasionally at the cost of nuance (a lost italic emphasis, a dropped "a consumer
asks" frame).

So the revert is **large in lines, small in content**: 1.10% of words, 0.86% of
tokens, median artifact unchanged. A per-file gate would be ceremony over a 1.1%
delta. And in the four artifacts with documented content LOSS, the collapse runs
the *other* way — it **restores** dropped sections, so the sweep is a net content
gain there.

**Decision rule pre-registered before the first edit:** proceed in one pass; the
stop condition is any artifact whose word count *grows* by more than 5% on collapse
(would indicate dist held a substantive rewrite, not a condensation) — surface those
individually rather than sweeping them.

### A second finding that strengthens the removal

`/condense` Step 3 **already mandates** the byte-for-byte rule:
*"Copy-paste first, condense second … All code blocks — copy EVERY code block from
source to output FIRST … unchanged, byte-for-byte."* It was violated in **six**
artifacts anyway, undetected, because the checker that would have caught it was
scanning a dead root. A clearly-worded model-carried instruction with no
mechanical enforcement held for 62% of the corpus and failed silently on the rest —
which is the case for removing the rewrite rather than restating the instruction.

## Open question (deliberately NOT decided here)

If `dist/agent-src/**/*.md` is a copy plus a deterministic rewrite, **should
`dist/agent-src/` exist as a separate tree at all**, or should the per-tool
projectors read `src/` and apply the rewrite at projection time? That is a
larger architectural change (it touches the installer, the `.claude/` symlink
layout, and ADR-051's source-of-truth model) and is out of scope for this ADR.

## Alternatives considered

- **Keep condensation, fix the gate only.** Rejected: the retargeted gate proves
  the transform does ~1% and is 62% no-op. Keeping an LLM rewrite over shipped
  prose for a 0.86% aggregate gain buys a corruption class for no measurable
  return.
- **Keep it and set a lower savings bar.** Rejected: the per-request surface
  (the only one a consumer pays) is net **−36 tok**. There is no bar under which
  a negative result passes.
- **Make condensation deterministic** (a scripted rewriter instead of an LLM).
  Not rejected on merit — but it is a *new mechanism* needing its own
  justification and measurement, not a repair of this one. Nothing in the current
  measurement suggests the ceiling is worth the build: the best single artifact
  saving in the entire corpus is 368 tokens.

## References

- H3 measurement + incidental findings: `road-to-token-saving-HUMAN-MEASUREMENT.md`
- `docs/contracts/kernel-membership.md` § 2 — the contradicted `r` lock
- `src/scripts/condense.ts` (`:463` hash, `:524` path rewriter, `:668` LLM path)
- `src/scripts/check_condensation.ts` — retargeted + `scanned_nothing` guard
- ADR-051 — workspace vs package root boundary (`src/` as source of truth)
- [`adrs/telegraph/0002`](../adrs/telegraph/0002-dormant-by-default-removal-authorized.md)
  — the sibling decision on `telegraph-speak`, the runtime reply-prose analogue
  (filed in the telegraph area series because it extends its ADR 0001)
