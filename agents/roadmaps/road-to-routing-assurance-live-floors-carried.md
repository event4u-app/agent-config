---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_growth_exempt: "open_blockers +1: b-inline-arm-independence is the condition the AI council (2026-11-03, 2/2, option a) attached when it carried the parent's step 4.4 here — the next uniqueness rule must come from a session that did not author the mechanism. Counting it is the carry recorded, not new work: without it 4.4 would read as unblocked."
relates:
  - slug: road-to-routing-assurance-live-floors
    relation: extends
    note: "Archived parent. Carries its step 4.4 (AI council 2026-11-03, 2/2, option a) and the three units its 5.3 canary found that stopped firing."
---
# Road to routing assurance — what the live floors carried

> **Source:** the parent `road-to-routing-assurance-live-floors`, archived
> 2026-11-03. Two strands, carried rather than dropped:
> (1) its step 4.4, measured once and breached, carried by AI council verdict;
> (2) the stable regressions its 5.3 canary found
> (`agents/evidence/metrics/routing-canary-20261103.md` § Rerun).

## Phase 1 — five units the canary left unresolved

The parent's 5.3 canary classified nine units REGRESSION at one run each; a
rerun at three runs each cleared four as noise, left two at 2/3
(`dependency-upgrade`, `wireframe`), and left three at **0/3**: `type-design`,
`react-shadcn-ui`, `project-analysis-core`. All five fired on the same prompt
at the 2026-10-27 baseline; the three at 0/3 did not change their `description`
since. Phase 1 covers all five — the three stable regressions and the two
undecided ones — so nothing is fixed or dismissed on a single-run number.

- [x] **1.1 Read the traces.** For each 0/3 run, which skill (if any) the run <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=unrecognised path shape: agents/evidence/metrics/routing-carried-units-20261105.md -->
      invoked instead, from the kept trace (`invokedFromTrace`).
      verify: one table per unit — run, invoked skill, catalogue sha — committed
      under `agents/evidence/metrics/`.
      reach exempt: a measurement read from committed traces; no code changes.
      Done 2026-11-05: no miss invoked another skill — every one invoked none
      (`agents/evidence/metrics/routing-carried-units-20261105.md`).
- [x] **1.2 Separate host from catalogue.** Rerun the five units at three runs <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=unrecognised path shape: agents/evidence/metrics/routing-carried-units-20261105.md -->
      each on the frozen baseline catalogue (`1c967b17…`, materialised with
      `git archive 9e226440b6`) on today's host. Fires there → the catalogue
      change is the cause; does not fire → the host change is.
      verify: the rerun artefact names host version and catalogue sha, and the
      1.1 table gains the verdict column.
      reach exempt: a measurement run; no code changes.
      Done 2026-11-05: the host. On the frozen catalogue the units fail as on
      today's; every miss globs the empty sandbox and asks for the material the
      prompt names instead of routing.
- [ ] **1.3 Repair the cause 1.2 names** — a description edit that restores the
      routing criterion the competing skill took, or a recorded reason the
      prompt now belongs to that skill (a corpus edit moving the positive).
      verify: the five units at three runs each reach the rate floor
      (`docs/contracts/routing-assurance-metrics.md` § The floors restated as
      rates) on today's catalogue, classified by `compile_trigger_evals --classify`.

      2026-11-05: "Use when" descriptions changed nothing and were reverted; a
      fixture pilot restored `type-design` 0/3 → 3/3. The council's staged plan
      for the rest is in `routing-carried-units-20261105.md`.

## Phase 2 — the suggest-without-read gap (carried 4.4)

- [ ] **2.1 Close the suggest-without-read gap** (parent 4.4, verbatim). On a
      unique top hit, `suggest_skill_for_task` returns the skill body (or a
      bounded excerpt with its id) so the MCP path needs no second `read_skill`
      call; default-off until the 4.2 parity gate passes on it.
      verify: `jq -e '.parity.verdict.breached == false' <the --report --out file>` -> 0 (MCP recall ≥ native − 0.05 on the Phase 2 corpus)

      Carried 2026-11-03: built and default-off, breached once (delta 0.104;
      85 ties, 16 wrong bodies) — `agents/evidence/metrics/routing-arm-mcp-inline-20261103.md`.
      Blocked by `b-inline-arm-independence`, whose "Resolved when" names the
      three pre-registrations the next arm needs.

## Blockers

### blocker: b-inline-arm-independence

- **Status:** open — 2026-11-03.
- **Owner:** implementer — a session that did not author the inline-body mechanism.
- **Blocks:** 2.1.
- **Recommendation:** start such a session; it writes the three pre-registrations
  named under "Resolved when" and commits them before its arm runs.
- **If you do nothing:** the switch stays off and MCP-path parity stays at a
  0.10 deficit; nothing else in this file is affected.
- **What to do:** run Phase 2 from a session that authored none of
  `src/cli/mcp/dispatch.ts`'s inline path, `routing_arms --regrade-inline` or
  the 2026-11-03 arm.
- **Resolved when:** such a session commits, before its first arm case, a
  protocol fixing (i) the revised uniqueness rule; (ii) how a wrong-skill body
  counts — the 85 ties and the 16 wrong bodies are separate failure modes, and a
  rule that trades the first for the second fails the step's intent; (iii) a
  fresh native arm on today's host before the revised MCP arm. The switch stays
  off until that revised arm passes 2.1's verify.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-03 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A rule tuned to the gate | implementation | The tie diagnosis is known, so the next uniqueness rule can be picked to pass the parity gate rather than to deliver the right body | The rule, the wrong-body treatment and a fresh native arm are pre-registered by a session that did not author the mechanism, before its arm runs (`b-inline-arm-independence`) | Phase 2 — the suggest-without-read gap (carried 4.4) |
| 2 | Noise read as a regression | implementation | One run per unit makes every recall 0 or 1; a skill edited on a single-run miss is edited against noise | Every unit in Phase 1 is measured at three runs before and after any edit; 1.2 separates host from catalogue first | Phase 1 — five units the canary left unresolved |
| 3 | A skill edit that steals from a neighbour | product | Restoring one unit's routing criterion can take it from the skill that now wins the prompt | 1.3 allows the other outcome explicitly — a recorded reason the prompt now belongs to the competing skill — and classifies the five on today's catalogue, not the frozen one | Phase 1 — five units the canary left unresolved |

## Acceptance Criteria

- [x] AC-1 — No unit of the five stays REGRESSION at three runs without a
      recorded reason.
- [ ] AC-2 — 2.1's verify passes on an arm whose protocol was frozen by a
      session that did not author the mechanism, or 2.1 records why the gap is
      not closable on this path.
- [ ] AC-3 — Every live run goes through the host CLI, and its record names the
      CLI version.
