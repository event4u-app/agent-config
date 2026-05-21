# Package Optimizer — design comparison

> Council poll: `agents/council-responses/package-optimizer-design.json`
> ($0.0327 actual, 2 members, 1 round)

## Existing optimization surface (siloed, by artifact type)

| Layer | Artifact | What it covers | What it misses |
|---|---|---|---|
| `/optimize skills` | skills only | duplicates by description, sizes, linter | rules·commands·contexts; cross-type contradictions |
| `/optimize agents` | rules + AGENTS.md | token overhead, always→auto candidates, duplicate triggers | skills, commands, contexts; deletion ranking |
| `/optimize augmentignore` · `/optimize rtk` | ignore/filter files | path scoping | not in audit scope at all |
| `skill-reviewer` skill | single skill | 7 Skill Killers checklist | per-skill only; no cross-cut |
| `skill-management` skill | single skill | compress/expand/refactor lifecycle | per-skill only |
| `rule-compliance-audit` skill | rules only | trigger quality, never-firing rules, overlaps | rule-only; doesn't see skills/commands |
| `preservation-guard` rule | merge/refactor surface | Iron Laws stay, every passage stays | reactive — fires during transformation, not before |
| `lint_rule_interactions.py` | `rule-interactions.yml` | pair-conflict matrix schema validation | only what's already in YAML |
| `skill_linter.py` | skill files | frontmatter, sections, exec-metadata | structural, not semantic |

**The cross-artifact gap (real):** rule X says "consult before action" while
skill Y dispatches without consulting. Today nothing detects this — Sonnet
flagged it as the sole load-bearing argument FOR a unified audit.

**The duplicate-detection gap (real):** today `/optimize skills` finds
description-level dupes; `/optimize agents` finds rule trigger dupes; nothing
correlates "rule + skill + command all triggered by same description" — that
class is invisible.

**The deletion-candidate gap (real):** no tool produces a ranked list of
"low-utility, ready-to-prune" assets across types. Maintainer must mentally
join `wc -l` output, last-touched dates, and lint-FAIL counts. Cognitive load
is the killer, not effort.

## Council synthesis

### Q1 — Architecture

| Vote | Pick | Rationale |
|---|---|---|
| Sonnet | **Refused to pick** | All three Q1 options conflate 3 orthogonal concerns (cross-artifact lint + deletion classifier + council orchestrator) into one mega-feature; demands phased rollout instead |
| GPT-4o | (b) extend `/optimize` with `package` sub-command | Leverages existing infrastructure, minimizes overlap |

**Synthesis pick: Sonnet's phased rollout wins on weight.** GPT's (b) is
correct *eventually* but premature. Phase 1 ships deterministic primitives
(no skill, no command, no council); Phase 2 (deferred-with-trigger) builds
the (b)+(c) consult surface only after Phase 1 proves the gap is real and
classification heuristics are stable.

### Q2 — Deletion gate

| Vote | Pick | Rationale |
|---|---|---|
| GPT-4o | (a) up-front prompt | Respects user agency, simple |
| Sonnet | (implicit b) two-pass with deterministic surface first | Aligns with phased rollout — pass 1 surfaces obvious dupes silently, pass 2 prompts on borderline cases |

**Synthesis pick: hybrid (a)+(b).** Phase 1 produces deterministic JSON
report (no prompt — that's a script output). Phase 2's `/optimize package`
front-ends with GPT's up-front prompt; Phase 2.3 layers council on tier-B
contradictions only.

### Q3 — AI Council integration

| Vote | Pick | Rationale |
|---|---|---|
| GPT-4o | (c) prompted only at flagged surfaces | Deterministic-first, council where judgment helps |
| Sonnet | (implicit c, deferred to Phase 3) separate `/council resolve-contradictions` command | Same "deterministic-first" but architecturally separate — council is a *resolver*, not a part of the audit |

**Synthesis pick: (c).** Council fires ONLY when Phase 1 linter produces
flagged-for-judgment list AND user approves cost estimate. Audit-trail goes
to `agents/council-questions/` per existing pattern.

### Q4 — Net-new candidate

- **Sonnet's net-new (Tier-S, ICE ~700):** prototype gate before any
  production work — `scripts/prototype_lint_contradictions.py` ≤200 LOC
  must flag ≥3 real cross-artifact contradictions in `event4u/agent-config`
  within 5s and <$0.01. Fail → unified design is premature, ship nothing.
  Pass → proceed to P1.2 production linter. **Adopted as P1.1.**
- **GPT-4o's net-new (Tier-A, ICE ~250):** stale-context detector for
  `agents/settings/contexts/` (last-touched > 90d AND zero inbound `[link]` refs).
  **Adopted as P3.2** (governance cross-cut, deferred — not blocking
  Phase 1).

## Phase shape (final)

- **Phase 1 (3/5 Hard-Cap, leaves 2 free for parallel plates):**
  prototype gate (P1.1) → production linter (P1.2) → deterministic
  deletion-candidate scorer (P1.3). All deterministic, no AI, no council,
  no skill, no command. Pure CLI scripts in `scripts/`. Cycle: ≤1.0 d.
- **Phase 2 (deferred-with-trigger):** `/optimize package` sub-command
  (P2.1) reopens after P1.2 + P1.3 each have ≥1 production run with
  maintainer-actioned output; `package-optimizer` skill (P2.2) reopens
  after P2.1 demonstrates need for procedural handbook; AI Council
  integration (P2.3) reopens after P2.1 logs ≥3 deterministic ambiguous
  cases. **None counted against Phase 1 plate.**
- **Phase 3 (governance cross-cut):** Sunset audit (P3.1) — if linter
  finds zero contradictions in 4 weeks live OR command invoked <2x/month,
  retire. Stale-context detector (P3.2, GPT's net-new) — lightweight
  bolt-on, low risk.

## Why this shape

- **Honors `verify-before-complete`** — Phase 1 produces evidence (real
  contradictions found, real deletion candidates ranked) before any
  consult-surface gets built. Sonnet's prototype-gate is the same gate.
- **Honors `non-destructive-by-default`** — Phase 1 is read-only JSON
  output; Phase 2's deletion gate is hard-floor protected by construction.
- **Honors Hard-Cap discipline** — 3/5 slots used, leaves room for the
  Mobile/Ruflo/Token-Optimizer plates already queued.
- **Honors `preservation-guard`** — Iron Laws never enter the deletion
  candidate pool, regardless of council vote. Already enforced by the
  rule's existing scope; no extra gate needed.
- **Disagreement budget spent productively:** Sonnet's refusal to pick
  Q1 was the highest-leverage signal in the poll. GPT-4o's clean picks
  ratify the Phase 2 shape but don't dispute Sonnet's gating. Both align
  on Q3=(c).
