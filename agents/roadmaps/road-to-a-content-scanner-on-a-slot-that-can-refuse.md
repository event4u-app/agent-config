---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: >-
  Nothing in the active estate can be archived to pay for this one, and merging
  it into the enforcement-table work is what produced the gap: that work built
  the honest reporter and stopped at reporting, because the reporter's job ends
  where a binding decision begins. Parking it leaves a published enforcement
  claim standing on the one row the tree's own measurement says is wrong, which
  is the cheapest possible thing to fix and the most expensive to leave.
relates: []
---
# Road to a content scanner on a slot that can refuse

> **Source:** `agents/tmp.old/inbox-2026-09-ab/t04/` — a round of independent
> code-level review outputs against one pinned head. One of them verified this
> against the lowering table itself, slot by slot, and named it the finding
> that sits on the security row rather than the documentation row.

## Goal

The published host-enforcement claim and the slot the content scanner actually
binds to agree, by one of exactly two moves: the scanner moves to a slot that
can deny, or the claim is corrected to say `detected, not blocked`. Falsifiable:
after this roadmap, no reader can find a host row asserting a denial the
manifest's own binding cannot perform.

## The measurement, re-derived against this tree on 2026-09-29

- `src/scripts/hooks/host_lowering.yaml` — under `claude`, **3 of 9** lowerable
  slots carry a non-null `block_exit` (`stop`, `user_prompt_submit`,
  `pre_tool_use`). The other six are `block_exit: null` and cannot deny.
- `src/scripts/hook_manifest.yaml:1391` and five sibling host rows — the
  `injection-scan` concern is bound to **`post_tool_use`** on every one of them.
- `post_tool_use` is one of the six null-block slots.

So the scanner is bound where a deny has nowhere to go. This is not a doc
inaccuracy the reporter already published; it is the enforcement half that the
report deliberately stops short of, and the concern's own contract already
says it warns and never blocks — which makes option B below a correction of the
published table rather than a downgrade of the concern.

## Phase 1 — Decide which of the two moves

- [ ] **1.1 State what a refusing content scan would cost.** Moving the concern
      to `pre_tool_use` puts a scan on the hottest slot, ahead of the tool call
      rather than after it, and changes what it can see: the input, not the
      result. Write down which of the two inputs the scan actually needs before
      the slot is chosen — a scanner that needs the result cannot move.
      verify: the concern's header names the input it reads, and the note says
      whether that input exists on `pre_tool_use`
- [ ] **1.2 Take one of the two options and record the other as rejected.**
      (A) rebind to a block-capable slot, with the cost from 1.1 named; or
      (B) correct every published enforcement claim for this concern to
      `detected, not blocked`, and leave the binding where it is.
      verify: the chosen option lands as a diff; the rejected one is named with
      its reason in the same change

## Phase 2 — Close the reporter's loop

- [ ] **2.1 Make the mismatch count the assertion, not the prose.** The
      enforcement reporter already computes the strict comparison. Have it
      state, per host, how many lowerable slots deny and which concerns bind to
      slots that cannot — so the next drift is a number that moved rather than
      a sentence someone has to re-verify by hand.
      verify: run the reporter read-only; it prints the per-host slot count and
      names any concern bound to a null-block slot
- [ ] **2.2 Confirm the published table matches the reporter's output.** One
      reading, two sources, no difference.
      verify: the reporter's per-host line and the published row agree for
      every host it covers

## Acceptance criteria

- Either the `injection-scan` binding names a slot with a non-null `block_exit`,
  or every published claim about it reads `detected, not blocked`.
- The rejected option is recorded with a one-sentence reason in the same change.
- The reporter names, per host, any concern bound to a slot that cannot deny.
- No published host row asserts a denial its manifest binding cannot perform.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-29 | reviewer: agent -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The rebind loses the input the scan actually reads | implementation | The concern inspects what a tool call returned; `pre_tool_use` carries only what is about to be sent. A slot chosen for its non-null `block_exit` rather than for its input would leave the scanner running against a payload that does not contain the fetched content it exists to inspect, so the deny it gained would fire on nothing. The cost is a scanner that looks more enforcing than the one it replaced and detects less. | Step 1.1 forces the input question before the slot is chosen, and its verify requires the concern's own header to name the input it reads. A move whose input does not exist on the target slot is refused at 1.1 rather than discovered after the rebind has shipped. | Phase 1 — Decide which of the two moves |
| 2 | Option B is read as weakening a safety control | product | Correcting the published row to `detected, not blocked` looks, from the enforcement table alone, like a control being downgraded — a reader who stops at the table concludes injection scanning was switched off. Nothing about the concern changes; only the claim about it does. The cost of the misreading is a true correction being reverted to restore an overclaim. | The concern's own contract already states it warns and never blocks, so B removes nothing that ever existed. Step 1.2 requires that reason to be written into the same change beside the chosen option, rather than left for a later reader to infer from the diff. | Phase 1 — Decide which of the two moves |
| 3 | A rebind puts a content scan on the hottest slot | implementation | `pre_tool_use` runs ahead of every tool call, so a scan bound there is paid on calls that carry nothing to scan, not only on the fetches the concern cares about. Unbounded, that is a per-call cost on the slot this tree already loads most heavily — thirteen concerns on `claude` alone. | Step 1.1 requires the cost to be named before the option is taken, and the injection budget's aggregate ceiling already drops lowest-severity advisories, so any new cost is bounded by a mechanism that exists rather than one this roadmap would have to invent alongside the move. | Phase 1 — Decide which of the two moves |
| 4 | The same drift returns on a host nobody re-checked | implementation | The mismatch was found by an external reader comparing two files by hand. Repaired once and left as prose, it returns the next time a host row or a binding moves, and the next reader has the same hand comparison to do before they can even see that it drifted. | Step 2.1 turns the per-host comparison into a printed count and names any concern bound to a null-block slot, so the next drift surfaces as a number that moved; step 2.2 requires the published table and that output to agree for every host the reporter covers. | Phase 2 — Close the reporter's loop |
