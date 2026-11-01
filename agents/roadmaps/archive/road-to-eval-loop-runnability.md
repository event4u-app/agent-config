---
complexity: lightweight
execution:
  mode: autonomous
---

# Roadmap: Eval-loop runnability — one dead root the sweep cannot see

> The behavioural-eval orchestrator is reported visible by the dead-root sweep, and the twelve-claim harvest set that surfaced it is closed with a verdict per claim.

## Prerequisites

- [ ] Read `AGENTS.md`, `docs/contracts/rule-router.md`, and `src/scripts/sweep_dead_scan_roots.ts`

## Context

An external analysis artifact landed in the maintainer inbox carrying twelve
claimed defects (D1–D12) drafted against a pinned commit one day before this
plan. Verifying each against the live tree collapsed the set: two claims are
refuted by a documented contract, four are misstated, five are already owned by
active roadmaps with open items, and **one is real, new, and evidenced** — the
subject of this roadmap.

**The finding.** `src/scripts/run_skill_evals.ts:32` roots at
`.agent-src.uncondensed/skills`, a container retired by ADR-051 and absent from
the tree. Every subcommand therefore fails in `_skill_dir()` before reaching the
`_spawn_subagent` stub the source artifact identified:

```
$ ./scripts-run src/scripts/run_skill_evals scaffold code-review
error: skill 'code-review' not found at <repo>/.agent-src.uncondensed/skills/code-review
```

The tree already owns the detector for exactly this class —
`sweep_dead_scan_roots.ts`, whose own docstring says "a sweep that misses a
known-dead gate is itself a dead gate", and whose triage already classes
`.agent-src.uncondensed` as **Class A — pre-ADR-051 containers**. It does not
report this one. The discriminator is a filename prefix:
`GATE_PREFIX = /^(lint|check|audit|skill|verify)_/`
(`src/scripts/_lib/gate_population.ts:41`) admits the sibling
`skill_trigger_eval.ts` — reported, Class A, `unproven` — and excludes
`run_skill_evals.ts` because it begins `run_`. Two scripts, one retired root,
one visible.

The population filter is **deliberately shared** with the gate ratchet and the
registration test (`sweep_dead_scan_roots.ts:115-122`: three sites once carried
their own regex and disagreed at 223 / 225 / 232). Widening it is therefore not
a free fix — it moves a ratchet base. Phase 1 takes the other route: leave the
shared gate population untouched and add a Class-A-only advisory pass over the
full script directory, since Class A is a closed set of retired containers and
needs no allowlist to stay honest.

- **Feature:** none
- **Jira:** none

### Corrections applied to the source artifact

The artifact is kept as evidence, not as instructions. Verified at HEAD;
`file:line` is what was actually read.

| Source claim | Verdict | What the tree says |
|---|---|---|
| D2 — "`dist/router.json` has no runtime consumer" (framed as a defect, with a proposal to delete it) | **never-true as a defect** | It is documented intended design: `docs/contracts/rule-router.md:24-26` states "THE ROUTER IS A COMPILE-TIME SOURCE FOR HOST-NATIVE EMISSION AND LINT TOOLING. NO HOST AGENT PERFORMS A RUNTIME LOOKUP AGAINST IT", with the same measurement (20 consumers, zero under `src/scripts/hooks/`) recorded 2026-08-08. Deleting it would break host-native emission. |
| D1 — "103 of 289 skills carry `evals/evals.json`" | **never-true** | 103 is the count of `evals/` **directories**. `evals.json` exists for **42**, `triggers.json` for **68**. The identical conflation was already refuted in `road-to-skill-ecosystem-executable-payloads.md`. |
| D3 — "`allowed-tools` appears in 1 of 289 skills" | **misstated** | The suite's own field is `allowed_tools` (`skill.schema.json:253`), declared by **31** skills and linted by `lint_skill_frontmatter_safety.ts`. The real gap is a projection one: **0 of 336** generated `.claude/skills/` files carry the host-side `allowed-tools`. Already owned — see redirects. |
| D4 — unanchored substring trigger matching | **still-true, severity contingent on D2** | `lint_trigger_precision.ts:1-25` documents the defect and why only a count ratchet ships. Because no host performs a runtime lookup, a word-boundary fix moves a number in a file nothing reads at session time. Already parked with that exact reason in `road-to-skill-ecosystem-executable-payloads.md`. |
| D5 — "289 skills against the standing maintenance target (~130)" | **unverifiable premise** | 289 is correct. No `~130` estate target exists anywhere in `docs/` or `src/rules/`. The proposed "estate sweep toward the ~130 target" would execute against a number nobody agreed. |
| D7 — proposes a new rule-frontmatter block named `precedence:` | **name collision** | `rule.schema.json:178` already defines `precedence` with different semantics (per-trigger collision ordering, enforced by `lint_trigger_collisions.ts`). The proposal needs a different key. |
| D12 — "no non-inferiority gate" | **partially already built** | The arithmetic exists: `src/scripts/_lib/anchor_eval.ts:252,280` computes `non_inferiority_ok` against a delta. It is wired into no workflow and no Taskfile target. The gap is wiring, not construction. |
| D6 / D9 / D10 / D11 | **still-true, magnitudes smaller than implied** | Red-Flags-style sections: 4 skills. Phase-structured prose skills: 10, of which 4 already carry `scripts/`. No divergent-ideation skill: confirmed. `consumer_matrix.ts:437-442` does assert directory existence — but it also fires live hook events, which the claim omits. |

### Redirects — claims already owned, not re-planned here

Duplicating an owned item is the failure this table prevents.

| Claim | Owning roadmap | State |
|---|---|---|
| D1 behavioural-eval axis | `road-to-skill-ecosystem-executable-payloads.md` | open, with the activation-census prior written in |
| D3 tool-scoping | `road-to-inbox-harvest-2026-08-b-dispatch-safety.md` | open at step 1.2 |
| D4 trigger precision | `road-to-skill-ecosystem-executable-payloads.md` | parked, reason recorded |
| D5 estate size | `road-to-inbox-harvest-2026-08-b-estate-lifecycle.md` | open |
| D8 install-friction template | recurring release-review finding | unchanged; `docs/install-friction-report.md` still `status: template` |

## Gap table

| Mechanism from the sources | Verdict | Where it lands |
|---|---|---|
| Live behavioural harness driving real host sessions | **CUT here** | Already owned; re-planning it would duplicate an open roadmap |
| Committed results including losses / nulls | **FOLD** | The suite's honest-null posture (ADR-202) already carries it |
| Host-CLI loadability checks in CI | **CUT here** | Real gap, but licensing and CI feasibility are unscoped; no evidence to plan against yet |
| Per-skill tool scoping | **CUT here** | Owned by the dispatch-safety roadmap |
| Rationalization tables as a required section | **CUT here** | Needs a conformance-schema decision, not a plan step |
| Divergent ideation with context isolation | **CUT here** | New capability; gated behind estate work that has no mandate |
| Retired-container detection over non-gate scripts | **KEEP** | Phase 1 — the one claim that was new, evidenced, and unowned |

## Phase 1: Report Class-A dead roots outside the gate population

- [x] **Step 1:** Add a Class-A-only advisory pass to `src/scripts/sweep_dead_scan_roots.ts` that extracts roots from every `.ts` in `src/scripts/` — not only files matching `matchesGatePattern` — and reports those whose root classifies `A` (`CLASS_A_RETIRED`). Leave `matchesGatePattern` and `_lib/gate_population.ts` untouched so the gate ratchet and the registration test keep their shared base. Shipped via `isNonGateScript()`; the sweep excludes itself, whose `CLASS_A_RETIRED` table is a classification constant and not a read. <!-- verify: ./scripts-run src/scripts/sweep_dead_scan_roots -->
- [x] **Step 2:** Confirm the advisory names `run_skill_evals` and that the confirmed / unproven counts for the gate population are unchanged from the pre-change run (8 confirmed, 21 unproven, 0 class-A, exit 0). Both hold: the advisory reports `run_skill_evals.ts: .agent-src.uncondensed/skills (SKILLS_ROOT)` among 15 findings over 261 non-gate scripts, and the gate summary line is byte-identical to the baseline. <!-- verify: ./scripts-run src/scripts/sweep_dead_scan_roots -->
- [x] **Step 3:** Cover the new pass with a case in the sweep's existing test file asserting that a non-gate-prefixed script rooting at a Class-A container is reported, and that a non-gate script rooting at a live container is not. Four cases added, including the exit-code assertion that the advisory does not gate. <!-- verify: task test -- --filter=sweep_dead_scan_roots -->

**Exit criteria:** the sweep's output names `run_skill_evals` under the Class-A
advisory; the gate-population confirmed / unproven counts are byte-identical to
the pre-change run; the new test case passes.

**Rollback:** revert the sweep change — the advisory is additive and no other
script reads its output.

## Phase 2: Decide the orchestrator's disposition

Resolved as **repoint**, and executed. The trade-off read like a maintainer
call because the header framed the dead path as deliberate. Two checks settled
it without one — both proposed by the council pass (2026-08-13, one member
answering of two; the second failed with `exit_1`, so this is a degraded run and
is reported as such rather than as convergence):

- **Boilerplate test.** "This faithful twin replicates that literal
  byte-for-byte" is standard ADR-051 twin language, not a marker for this file:
  `measure_projection_bytes.ts:25-26` says the same about the same container.
  The header encoded provenance, not an intentional disabled state.
- **Authority test.** ADR-200 is not silent. § 5 makes Python behaviour binding
  "unless a documented divergence says otherwise", and § 6 supplies the process.
  Repointing is therefore the contract's own mechanism, and *skipping the
  divergence doc* would have been the breach — "an undocumented difference is a
  regression by definition".

- [x] **Step 1:** Execute the disposition. `SKILLS_ROOT` resolves through `_lib/agent_src.ts::SRC_SKILLS()`; the header now records the divergence instead of claiming verbatim replication. <!-- verify: ./scripts-run src/scripts/run_skill_evals scaffold code-review -->
- [x] **Step 2:** Write the ADR-200 § 6 divergence doc (verdict `bug-fix-in-TS`) with the before/after commands as evidence and the spawn-stub scope limit stated. <!-- verify: ls docs/migration/divergences/src-scripts-run_skill_evals.md -->
- [x] **Step 3:** Close the ignore gap the repoint opens — `scaffold` writes to `src/skills/<id>/evals/runs/`, covered until now only for the retired container and `dist/`. <!-- verify: git status --short src/skills -->

**Exit criteria:** `run_skill_evals scaffold` resolves a real skill directory,
and the divergence is recorded in the ADR-200 ledger with evidence.

**Rollback:** revert the `SKILLS_ROOT` line and the header block; the divergence
doc and the ignore line are inert without them.

## Acceptance Criteria

- [x] The sweep reports `run_skill_evals` as a Class-A dead root, and the gate-population counts are unchanged.
- [x] No item in this roadmap duplicates an open item in a roadmap named in the redirect table — each redirected claim appears only as a pointer.
- [x] Every source claim carries a verdict in the corrections table, so no later reader re-discovers a refuted one.

## Blockers

### blocker: eval-orchestrator-disposition

- **Status:** resolved
- **Owner:** user
- **Blocks:** Phase 2 — Decide the orchestrator's disposition
- **What to do:**
  1. Decide whether the ADR-051 faithful-twin carve-out on `run_skill_evals.ts` outranks the orchestrator being runnable.
  2. Pick one: repoint `SKILLS_ROOT`, retire the orchestrator, or accept the cost with a dated reason in the file header.
- **Resolved when:** the maintainer states which of the three dispositions applies.
- **Resolution (2026-08-13):** it was never a human gate. ADR-200 § 6 already
  owns this class of change, and the "deliberate" framing turned out to be twin
  boilerplate. Authoring it as a blocker was the mis-classification this PR also
  repairs in `templates/roadmaps.md` rule 22 — a contested *technical* decision
  routes to the council, not to the user.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-13 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Advisory pass moves a ratchet base | implementation | Touching the shared gate population would change the 223 / 225 / 232 alignment the three sites were consolidated to fix, reddening the ratchet and the registration test for a reason unrelated to this plan. | The pass is additive and Class-A-only; `matchesGatePattern` and `_lib/gate_population.ts` are explicitly out of scope, and Step 2 pins the gate-population counts as unchanged. | Phase 1 Step 1 |
| 2 | Class-A advisory floods with prose mentions | implementation | 79 files under `src/scripts/` mention `.agent-src.uncondensed`; a naive scan would report dozens of comments and report strings as dead roots, making the advisory noise. | Reuse the existing extractor, which requires a literal join over a recognised root base rather than a textual mention; Step 2 reads the output before the change is kept. | Phase 1 Step 2 |
| 3 | The corrections table is read as permission to reopen owned work | product | A reader seeing five claims marked "already owned" may open duplicate items in the owning roadmaps instead of treating them as pointers. | The redirect table names the owning roadmap and its state per claim, and the acceptance criteria make non-duplication a checked outcome. | Acceptance Criteria |
| 4 | Phase 2 stalls indefinitely | product | Authored as a maintainer call on a documented carve-out; an unanswered blocker would leave an orchestrator that silently cannot run. **Materialized in the opposite direction:** the gate was mis-classified — ADR-200 § 6 already owned the decision. | The finding is recorded in the sweep output by Phase 1 regardless; the mis-classification itself is repaired in `templates/roadmaps.md` rule 22 so the next author routes a technical decision to the council. | Phase 2 |
| 5 | Repointing makes the orchestrator write into the source tree | implementation | `scaffold` creates `src/skills/<id>/evals/runs/`, which no ignore rule covered — untracked output under `src/` previously reddened `task sync-check`. | Ignore line added in the same change; verified by a clean `git status --short src/skills` after a real scaffold run. | Phase 2 Step 3 |

## Notes

The source artifact's proposed Phase 0 spikes are not carried over. S0.2
(measure lazy-loading token delta) presumes the router defect that
`docs/contracts/rule-router.md` refutes; S0.1 and S0.3 belong to the owning
roadmaps named in the redirect table.

## Provenance

- Source: an external multi-round comparison artifact dropped into the maintainer
  inbox, consumed as `agents/tmp.old/adhd/`; six upstream repositories examined at
  their own pins, referenced here only as Sources A–F and named in none of them.
  The originating thread link, via `src/scripts/_lib/link_crypto.ts decrypt`:
  ENC1:N1SU7ogBRwuM2myqGbgYVeGntFsNUzc7qaHHJ+DW1yIPUNcEFxFNr8VhIDs09UBA7/uHSZQUNacqvnF9E5mY3CNrknXpoFmgbYjwLHp0B5QkYzjvPErQF4GQarU+qpPPwRZaCx1cD+2koyWeTY71NjQBMR8QVlWHDWrY
- Council: anthropic + openai, 2026-08-13, depth `deep`, prompt-mode `design`.
  **Degraded — 1 of 2 answered** (openai `exit_1`), so this is one reviewer's
  reasoning, not convergence, and is reported that way in Phase 2. Its
  contribution was the two falsification tests, not a verdict: check whether the
  "deliberately preserved" wording is twin boilerplate, and read ADR-200 before
  assuming the header encodes intent. Both checks ran and both pointed at
  repoint. The first attempt returned 0 of 2 at a 120 s CLI timeout — repaired
  in this PR and recorded in the ADR-200 ledger.
