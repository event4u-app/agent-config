---
stability: beta
keep-beta-until: 2026-08-12
---

# Linter Structural Model

**Status:** LOCKED — shipped 2026-05-08 on
`feat/road-to-structural-linter-reform`. The linter now applies the
structural model to skills, rules, and commands.

## Why a structural model

Council convergence (Sonnet + GPT-4o, 2026-05-06): raw line / word
counts produce ratchet drift. Three failure modes that the pure-size
gate cannot distinguish:

- A 500-line skill with **one** 10-step procedure (legitimate) vs a
  500-line skill with **ten** independent procedures (split candidate).
- A 1700-word command that **delegates** to a cluster (legitimate
  orchestrator) vs a 1700-word command that **inlines** the work.
- A 60-line rule whose body is a **verbatim Iron-Law block**
  (legitimate) vs a 60-line rule that is **prose explanation**
  (split candidate).

The structural model replaces the size threshold with four primitives.

## Primitives

### 1. Density score (0.0 – 1.0)

```
density = structured_lines / total_non_blank_lines
```

`structured_lines` = lines inside fenced blocks + markdown-table rows
+ bullet-list lines + numbered-list lines + section-heading lines.
Higher = more structured (catalogue, table, code, list); lower =
prose-dominant.

### 2. Multi-workflow detector (skills only)

Skills with **≥ 2 `## Procedure`** (or `## Procedure: <name>`)
sections ship multiple independently invocable procedures. Combined
with size, this is the cluster-split signal.

### 3. Delegation detector (commands only)

Command has a delegation signal when **either** holds:

- frontmatter declares `cluster:` or `routes_to:`
- body contains ≥ 3 markdown links to other `.md` files

Absence of both signals on a large command = inlined logic.

### 4. Iron-Law block detector (rules only)

A fenced block is an Iron-Law block when its body has **≥ 30
alphabetical characters** with **≥ 60 % uppercase** across **≥ 1
non-empty line**. The 30-character floor filters single ALL-CAPS
markers (`OK`, `WIP`); the 60 % uppercase floor catches verbatim
imperatives (`NEVER COMMIT.`).

## Phase 1 calibration (2026-05-08)

Sweep covered all 310 lintable artifacts via
[`scripts/measure_density.py`](../../scripts/measure_density.py); raw
data lives at `agents/.density-snapshot.jsonl` (local-only — re-run
`python3 scripts/measure_density.py --root .agent-src --jsonl
agents/.density-snapshot.jsonl` to regenerate).

| Type | Count | Avg density | Median | Bucket [0.4-0.6] | Bucket [0.6-1.0] |
|---|---|---|---|---|---|
| skill | 142 | 0.76 | 0.78 | 22 | 119 |
| command | 103 | 0.59 | 0.57 | 46 | 45 |
| rule | 58 | 0.47 | 0.48 | 25 | 11 |
| persona | 7 | 0.38 | 0.38 | 1 | 0 |

Iron-Law detector recall on 9 canonical Iron-Law rules: **8 / 9** (all
except `agent-authority`, which uses a markdown-table index instead of
a fenced block — correct miss).

`quality-tools` (411 lines, single workflow): density **0.83**, single
procedure → no warning under the new model. ✓ roadmap success criterion.

`optimize/augmentignore.md` (1679 words): delegation signal **present**
(frontmatter `routes_to:`) → no warning under the new model. ✓ roadmap
success criterion.

Of 13 commands ≥ 1000 words, only **2** lack a delegation signal —
both are candidates for Phase 4.1 review (`compress.md`,
`project-analyze.md`; the latter has density 0.86, exempt under the
density-AND-delegation gate).

## Warn rules (shipped Phase 3, 2026-05-08)

| Artifact | Warn condition |
|---|---|
| **skill** | `lines > 400` AND (`density < 0.6` OR `procedures ≥ 2`) |
| **command** | `words > 1000` AND no delegation signal AND `density < 0.65` |
| **rule** | `lines > 60` AND `density < 0.5` AND `iron_law_blocks == 0` |

The 200-line rule **error** stays unconditional. No new frontmatter
keys ship — the four structural primitives are the contract.

Calibration sweep on the 2026-05-08 corpus (310 artifacts):

| Type | Old warns | New warns | New band | Δ |
|---|---|---|---|---|
| rule | 23 | 2 | 3.4 % | −91 % |
| skill | 2 | 1 | 0.7 % | −50 % |
| command | 9 | 1 | 1.0 % | −89 % |
| **total** | **34** | **4** | **1.3 %** | **−88 %** |

Pass rate: 186 → 209 (`pass`); 124 → 101 (`pass_with_warnings`); 0
errors. Each remaining warning is a genuine structural defect:

- `compress.md` (1569 words, density 0.58, no delegation signal) —
  inlined logic in a non-orchestrator command.
- `artifact-drafting-protocol.md` rule (65 lines, density 0.37, no
  Iron-Law block) — prose-dominant long rule.
- `minimal-safe-diff.md` rule (69 lines, density 0.41, no Iron-Law
  block) — prose-dominant long rule.
- `ai-council/SKILL.md` (525 lines, density 0.37) — orchestrator
  skill below the density floor; refactor candidate.

Roadmap target ≤ 10 % rule-warning band. ✓ (3.4 %)

## Frontmatter contract — Phase 2 decisions (2026-05-08)

AI Council run (Claude Sonnet 4.5 + GPT-4o, 2 rounds, $0.046; raw
transcript local-only per the council-references convention).

**Key 1 — `iron_law:` frontmatter — DECISION: Option A (auto-detect, no tag).**

Both council members converged on Option A. The detector recall on
the canonical 9-rule set is 8 / 9, and the one miss
(`agent-authority`) uses a markdown-table priority index that is
**not** an Iron-Law imperative — its body delegates to the rules it
indexes. The detector is correct to skip it. No `iron_law:`
frontmatter key is added.

**Key 2 — `density_exempt:` frontmatter — DECISION: Option A (no flag).**

Council split:

- Sonnet 4.5: Reject any flag. Add **type-based density floors**
  (orchestrators 0.35, executors 0.6, imperatives 0.4) so the
  detector classifies structurally instead of relying on author
  declarations.
- GPT-4o: Adopt Option C (`density_exempt: true` + required
  `density_exempt_reason:`) with periodic re-audit.

Sonnet's structural argument carries: an escape hatch for a 1-in-142
corpus case ships maintenance debt across every future artifact that
brushes the boundary. The single failing skill (`ai-council`,
density 0.36) is a documentation-heavy reference-orchestrator and is
left as a Phase-4 review candidate — either restructure the skill or
add orchestrator-aware type-floors as a follow-up. No
`density_exempt:` key is added in Phase 3.

The Phase-3 implementation therefore ships **zero new frontmatter
keys** — the structural primitives are the contract.

## Out of scope

- Hard error thresholds beyond the 200-line rule cap.
- Automatic refactoring of artifacts that fail the new model.
- Cross-artifact dependency counts (a skill linking 4 other skills is
  `routes_to` doing its job, not a defect).

## References

- `scripts/measure_density.py` — Phase 1.1 measurement tool.
- `agents/.density-snapshot.jsonl` — full per-artifact metrics
  (gitignored, re-run the measurement script to regenerate).
- `scripts/skill_linter.py` — structural-model implementation
  (`_density_score`, `_count_procedure_sections`,
  `_command_delegation_signal`, `_iron_law_blocks`).
- `docs/guidelines/agent-infra/size-and-scope.md` — guideline now
  describes the structural model; Option 2 transition notes removed.
