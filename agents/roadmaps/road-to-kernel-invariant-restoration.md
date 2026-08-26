---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-24
estate_offset_exempt: "Offset by archiving road-to-canonical-terms in the same change, so the active count is net zero. The roadmap exists because the defect it records CANNOT be fixed by the run that found it: restoring a kernel-rule clause is governance-gated (own PR, >= 24 h soak, and `block_kernel_rule_writes` denies the agent write), so the only honest disposition available was a tracked follow-up."
---
# Road to kernel invariant restoration — two clauses a condensation reworded

> **Source:** found by `check_rule_invariants` during the 2026-08-26 roadmap
> drain, while running `task ci` on `drain/dr1`. Verified pre-existing: a
> detached `origin/main` checkout reports the identical four findings (two
> clauses x `src/` + `dist/`).

## Goal

`check_rule_invariants` exits 0 because the two protected clauses it names are
back in `non-destructive-by-default`, **or** because the invariant list was
changed through `docs/contracts/kernel-membership.md` § 10 with the reason
recorded. Not because the gate was edited green — the gate's own failure message
forbids exactly that, and it is the second-cheapest way to make this finding
disappear without fixing anything.

## What is actually broken

Two protected strings no longer appear in `src/rules/non-destructive-by-default.md`
or its `dist/` projection:

1. `**Never act while asking.** The ask and the action are strictly sequential:
   surface the confirmation, then WAIT for the answer.`
2. `an outbound, externally-visible, or money-moving action the user cannot un-see`

Both survive in **reworded** form. The rule today reads *"Ask and action are
strictly sequential: surface the confirmation, then WAIT."* and *"outbound,
externally-visible, or money-moving actions the user cannot un-see"* — the
meaning is intact and the literal is not. That distinction is the whole point of
a semantic-invariant gate: this class of gate exists because #840 and #844 lost
kernel content to a silent merge, and a gate that accepted "close enough" would
not have caught those either.

`git log -S` attributes the rewording to `4e4a5f0c0` (*"feat(rules): land the P4
migration the narrowed lock now permits"*) — a body-migration/condensation pass,
which is precisely the mechanism the gate's own header warns about.

## Why the drain run did not fix it

Not a judgement call, and not effort. Three independent blocks, any one of which
is sufficient:

- `scope-control` § Kernel-rule edits — own PR, >= 24 h between merges, and the
  soak guarantee is explicitly **not** lifted by an autonomous mandate.
- `block_kernel_rule_writes` denies the write on the one host that honours a
  deny.
- Deciding between *restore the literal* and *amend the invariant* is a
  kernel-membership § 10 decision about a protected string, which is
  owner-reserved.

## Phase 1 — Decide which of the two legal remedies applies

- [ ] **1.1 Choose per clause: restore, or amend the invariant.** They may
      differ. Clause 2 is a near-verbatim singular/plural difference and is a
      strong restore candidate; clause 1 lost a whole trailing phrase
      (*"for the answer"*) plus an article, and the current wording is arguably
      the better sentence — which is an argument for amending the invariant
      through § 10, not for leaving the gate red.
      verify: a decision record naming both clauses, the remedy chosen for each,
      and the reason — and for any amend, the § 10 process cited by section.

## Phase 2 — Land it under the kernel-edit process

- [ ] **2.1 Land the chosen remedy in its own PR, with the soak window.** No
      other change rides along; that is the process, not a preference.
      verify: `./scripts-run src/scripts/check_rule_invariants` exits 0 on the
      merged tree, and the PR carries the >= 24 h soak.
- [ ] **2.2 Close the loop on the mechanism, not only the instance.** A
      condensation pass reworded a protected string and nothing stopped it at
      write time. Record whether that is acceptable (the gate catches it, one
      merge later) or whether the P4 migration tooling should read
      `tests/golden/invariants.json` before it rewrites a kernel rule.
      verify: the answer is written down either way — an explicit "the gate is
      the control, no pre-write check" is a complete outcome here.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-26 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The gate is edited green instead of the rule restored | product | Deleting the two entries from `tests/golden/invariants.json` makes CI pass in one line and silently retires the protection that caught two real content losses | 1.1's verify demands a decision record per clause, and § 10 is the only legal amend path — a bare deletion satisfies neither | Phase 1 — Decide which of the two legal remedies applies |
| 2 | The restore is bundled into an unrelated PR | implementation | A kernel-rule edit riding along with other work defeats the soak window, which exists so a bad kernel change is visible before it compounds | 2.1 states the own-PR requirement as the step, not as advice | Phase 2 — Land it under the kernel-edit process |

## Acceptance Criteria

- [ ] AC-1 — `check_rule_invariants` exits 0 on `main`, and the reason is either
      a restored literal or a § 10 amendment with its record — never a deleted
      invariant entry.
- [ ] AC-2 — The mechanism question at 2.2 has a written answer, including the
      answer "no pre-write check; the gate is the control".
