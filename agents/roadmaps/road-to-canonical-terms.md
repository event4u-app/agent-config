---
complexity: structural
status: draft
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-25
estate_offset_exempt: "One-in-one-out is satisfied in the same change, not exempted: road-to-redundancy-governance is archived in this commit, so the active count does not rise. This file exists because that roadmap's last three [~] items are gated on conditions outside it — a maintainer dialect decision, another roadmap's 13 open steps, and a payload-budget milestone dated 2026-11-10 — and Iron Law 3 requires them resolved rather than carried inside an archived file. Nothing is claimed away: check_estate_count reads the archival in the same diff."
---
# Road to canonical terms — one dialect, one sweep, one budgeted row

> **Source:** the last three `[~]` items of `road-to-redundancy-governance`
> (4.5, 4.6 and the closed-set 5.3), carried here on 2026-08-25 so that roadmap
> could archive. Its other three deferrals were **resolved** rather than carried:
> 3.2 split into a `keep-duplicated` verdict plus
> `road-to-memory-twin-reconciliation.md`, 4.7 closed on a re-verified
> measurement, and the exhaustiveness 5.3 closed on a measurement that refuted
> its own premise.

## Goal

Three decisions that were correctly deferred, each on a condition **outside** the
roadmap that raised them. This file holds them until those conditions clear, so
the obligation stays in the active estate instead of inside an archive.

Nothing here needs re-measuring first. Every number below is in
`agents/evidence/analysis/redundancy-baseline-2026-08-25.md` with the command
that produced it.

## Phase 1 — The dialect decision (blocks the rest)

- [ ] **1.1 Decide the canonical side per mechanical pair.** Nine measured
      pairs. Seven have an obvious majority side; **two do not**, and they are
      the reason this is a decision rather than a sweep:
      - `behaviour` / `behavior` splits **57/43 with the BRITISH side ahead**, in
        a tree that is otherwise American. The majority rule and the consistency
        rule point in opposite directions here.
      - `license` / `licence` is a genuine noun/verb distinction in one dialect,
        plus quoted licence names that must not be rewritten at all.

      verify: a term map records all nine pairs with the chosen side and, for the
      two above, the reason the majority was followed or overruled. A map that
      silently applies "majority wins" to the two hard pairs does not satisfy
      this.

**Exit:** the term map exists and covers all nine pairs.

## Phase 2 — The sweep, and a gate so it stays swept

- [ ] **2.1 Sweep the prose layer.** ~5000 occurrences across the three largest
      pairs. **Sequenced behind `road-to-merge-surface-zero`** — a tree-wide text
      sweep against its 13 open steps multiplies the merge surface, which is the
      exact failure that roadmap exists to reduce.
      verify: the sweep lands after `road-to-merge-surface-zero` closes or its
      conflicting branches merge, and the PR states which of the two happened.
- [ ] **2.2 Gate it.** `lint_canonical_terms.ts` as the fourth member of the
      existing vocabulary-linter family, ratchet mode, reusing
      `check_md_language`'s frontmatter / fence / marker skip machinery rather
      than a second copy of it.
      verify: the gate reds on a planted wrong-dialect occurrence in prose and
      stays green on the same word inside a fence, a frontmatter value and a
      quoted licence name — all four states demonstrated.
- [ ] **2.3 Register it** — `gate-coverage.yml` row with a canary, a `ci-fast`
      task, the `Taskfile.yml` `ci:` list, and a workflow step.
      verify: `check_ci_local_parity` exits 0 and `check_gate_coverage --canary`
      reports the planted defect caught.

**Exit:** the prose layer is consistent and a new divergence fails a build.

## Phase 3 — The closed-set row, when the budget allows

- [ ] **3.1 Put the closed-set row in the rule.** It belongs in the rule's own
      table, next to the sweep it extends — that is where an agent looks. It
      costs **~95 tokens** and the gated payload has **zero headroom**.
      verify: the row is in the rule's table, and the payload budget still
      passes after it lands.

**Exit:** the row is where a reader finds it, or its blocker records why not.

## What this roadmap does NOT do

- **No concept-cluster sweep.** `route`, `dispatch`, `delegate`, `spawn` and
  `forward` read as synonyms and denote **five different mechanisms** here. Step
  4.1 of the parent measured them and found no defect; sweeping them would
  delete information. `keep-distinct` is the recorded verdict.
- **No identifier rename.** The `artefact` / `artifact` script split is closed as
  `keep-duplicated` on a re-verified measurement (0 cross-imports). A deliberate
  rename stays available and is not proposed here.
- **No memory-twin work.** That is `road-to-memory-twin-reconciliation.md`.

## Blockers

### blocker: b-dialect-decision-is-owner-reserved

- **Blocks:** 1.1, and by dependency all of Phase 2.
- **Owner:** maintainer.
- **What to do:** decide the two hard pairs — (1) follow the measured majority,
  making `behaviour` canonical and accepting a British spelling in an otherwise
  American tree; (2) follow tree consistency, making `behavior` canonical and
  rewriting 57 occurrences against the majority; (3) declare the pair
  `keep-distinct` and sweep only the seven unambiguous pairs. For
  `license`/`licence`, state whether the noun/verb distinction is preserved and
  whether quoted licence names are excluded from the sweep.
- **Recommendation:** (2) with quoted licence names excluded. A house dialect a
  reader can predict is worth more than a majority that a single large document
  can flip, and the sweep is mechanical once the direction is fixed. But this is
  a taste decision about the maintainer's own prose, which is why it is not the
  agent's.
- **If you do nothing:** Phase 2 cannot start, and the ~5000 occurrences keep
  drifting because no gate exists to hold a direction that was never chosen.
- **Status:** open.
- **Resolved when:** the term map at 1.1 records all nine pairs with a reason for
  the two hard ones.

### blocker: b-payload-headroom-for-the-closed-set-row

- **Blocks:** 3.1 only. Phases 1 and 2 proceed without it.
- **Owner:** maintainer.
- **What to do:** pick one — (1) free ~95 tokens in the gated payload, verified
  with `./scripts-run src/scripts/check_preamble_payload_budget`, then land the
  row in `src/rules/downstream-changes.md`'s own table; (2) accept the row
  staying in `docs/guidelines/agent-infra/downstream-changes-mechanics.md` and
  record that placement here as the outcome, with the reason.
- **Recommendation:** wait. This is the same blocker milestone 1 (2026-11-10)
  already carries in `preamble-payload-budget.json`, whose
  `committed_reduction_mechanism` reads **NONE** — so the honest position is that
  no reduction is scheduled, and pretending otherwise would put a second
  unfunded promise behind the first.
- **If you do nothing:** the row stays in the guideline, an agent reading the
  rule's table does not see it, and the gap is the one the step names.
- **Status:** open.
- **Resolved when:** the row lands with the budget passing, or the guideline
  placement is recorded as the accepted outcome.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-25 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A term sweep destroys a real distinction | product | `license`/`licence` is a noun/verb distinction in one dialect and appears inside quoted licence names; a mechanical substitution corrupts both | 1.1 requires a per-pair reason rather than a majority rule, and 2.2's verify demands the quoted-name case stay green | Phase 1 — The dialect decision |
| 2 | The sweep multiplies an active merge surface | implementation | ~5000 occurrences tree-wide against `road-to-merge-surface-zero`'s 13 open steps is the conflict amplification that roadmap exists to reduce | 2.1 is sequenced behind it explicitly, and its verify requires the PR to state which condition cleared | Phase 2 — The sweep, and a gate |
| 3 | The gate reds on fences and frontmatter | implementation | A wrong-dialect word inside a code fence or a frontmatter value is not prose and must not fire; a naive matcher turns every unrelated PR red | 2.2 reuses `check_md_language`'s skip machinery and its verify demands all four states demonstrated | Phase 2 — The sweep, and a gate |
| 4 | The closed-set row waits on an unfunded reduction | product | The payload milestone it depends on records `committed_reduction_mechanism: NONE`, so "waiting" could mean forever | Its blocker offers the guideline placement as a recordable outcome rather than an indefinite hold, and `review_by` bounds the wait | Phase 3 — The closed-set row |

## Acceptance Criteria

- [ ] AC-1 — The term map covers all nine mechanical pairs, and the two hard
      pairs each carry the reason the majority was followed or overruled.
- [ ] AC-2 — `lint_canonical_terms.ts` reds on a planted prose occurrence and
      stays green inside a fence, a frontmatter value and a quoted licence name.
- [ ] AC-3 — The gate is registered on all four surfaces, with the canary
      reporting the planted defect caught.
- [ ] AC-4 — The closed-set row is either in the rule's table with the payload
      budget passing, or its guideline placement is recorded as the accepted
      outcome with the reason.
