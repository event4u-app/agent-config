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

- [x] **1.1 State what a refusing content scan would cost.** Moving the concern
      to `pre_tool_use` puts a scan on the hottest slot, ahead of the tool call
      rather than after it, and changes what it can see: the input, not the
      result. Write down which of the two inputs the scan actually needs before
      the slot is chosen — a scanner that needs the result cannot move.
      verify: the concern's header names the input it reads, and the note says
      whether that input exists on `pre_tool_use`
      Done 2026-09-29. **The scan needs the tool RESULT, so it cannot move.**
      Both limbs: · **header names the input** — `hook_manifest.yaml` declares
      `needs_payload_bodies: [input, result]` for `injection-scan`, and
      `injection_scan_hook.ts`'s own header says it "scans the tool output (file
      reads, web fetches, MCP / tool responses)". A new header block on the
      concern now states the input and the consequence in the same place. ·
      **does that input exist on `pre_tool_use`** — no. The `result` body class
      resolves to `tool_response` / `toolResponse` / `tool_result` /
      `toolUseResult` (`hooks/payload_stub.ts:111`), none of which exist before
      the call runs. Rebinding would leave the scanner reading call arguments it
      was never written to inspect: more enforcing-looking and strictly less
      detecting, which is Risk 1 exactly. Option A is therefore refused AT 1.1,
      on evidence rather than preference — which is what this step is for.
- [x] **1.2 Take one of the two options and record the other as rejected.**
      (A) rebind to a block-capable slot, with the cost from 1.1 named; or
      (B) correct every published enforcement claim for this concern to
      `detected, not blocked`, and leave the binding where it is.
      verify: the chosen option lands as a diff; the rejected one is named with
      its reason in the same change
      Done 2026-09-29. **Chosen: (B).** The binding stays on `post_tool_use` and
      the claim is stated as `detected, not blocked`. **Rejected: (A) rebind to
      a block-capable slot** — refused at 1.1 because the only block-capable
      slot on this host is `pre_tool_use` and the scan's `result` input does not
      exist there; the deny it gained would fire on a payload without the
      fetched content it exists to inspect. Both land in this change: the
      concern's header carries the reason, and
      `docs/enforcement-by-host.md` § "The slot rows are not a statement about
      any concern" carries the reading.
      **An honest note on what B had to correct.** The published claims were
      ALREADY right: `docs/CLAIMS.md`, `docs/proof.md` and the
      `untrusted-input-defense` rule all read `warn-only` / "cannot refuse" /
      "neither figure is a claim that anything is blocked", and every
      `post_tool_use` row in the enforcement table already reads `warning` ·
      `block_exit: null`. Nothing overclaimed a denial. What was missing was the
      CONCERN layer: no published surface said which concern sits on which slot,
      so the slot→concern reasoning existed only in whoever had last done the
      hand comparison. That gap is what this change closes, and saying so is
      more useful than reporting a correction that was not needed.

## Phase 2 — Close the reporter's loop

- [x] **2.1 Make the mismatch count the assertion, not the prose.** The
      enforcement reporter already computes the strict comparison. Have it
      state, per host, how many lowerable slots deny and which concerns bind to
      slots that cannot — so the next drift is a number that moved rather than
      a sentence someone has to re-verify by hand.
      verify: run the reporter read-only; it prints the per-host slot count and
      names any concern bound to a null-block slot
      Done 2026-09-29. `concernSlotAudit` + `renderConcernAudit` in
      `src/scripts/check_enforcement_matrix.ts`, printed on every read-only run.
      Output, verbatim for two hosts: `claude  3/9 lowerable slot(s) deny · 0
      blocking + 45 non-blocking binding(s) on null-block slots` and `augment
      0/5 lowerable slot(s) deny · 5 blocking + 47 non-blocking binding(s)`.
      **It found a second, unrelated instance on its first run** — on `augment`,
      `block-no-verify`, `block-kernel-rule-writes`, `block-config-weakening`,
      `block-speaking-inbox-dir` and `evidence-independence` are all
      `severity: blocking` on a `pre_tool_use` that is `block_exit: null` ·
      `fail_policy: discard`. Individual rules admit this in prose; nothing
      counted it. `injection-scan` is correctly absent from the blocking list:
      it is advisory, so it appears in the non-blocking count.
      **Prints, never fails — deliberately.** The exit code is untouched.
      Failing would redden the tree on bindings that predate the check, which is
      the reason the estate and continuity ratchets report distance rather than
      gate on it. Tests: `tests/scripts/enforcement_concern_audit.test.ts`, 8
      passed, over a two-host fixture where the SAME blocking concern is bound on
      a denying and a discarding host — so the test can tell "names the right
      one" from "names every one". **Sensitivity checked:** removing the
      `block_exit` filter turned exactly those two asymmetry tests red.
- [x] **2.2 Confirm the published table matches the reporter's output.** One
      reading, two sources, no difference.
      verify: the reporter's per-host line and the published row agree for
      every host it covers
      Done 2026-09-29. `check_enforcement_matrix` is green — `32 host-slot
      row(s) in docs/enforcement-by-host.md match
      src/scripts/hooks/host_lowering.yaml` — and its `--self-test` reports
      `5/5 case(s) behaved (4 rejecting, floor 5)`. The prose added by 1.2 is
      checked against the same run rather than written beside it: the five
      `augment` blocking concerns, the `injection-scan` slot, and
      `post_tool_use` being `block_exit: null` on every host that carries it all
      come from the audit output quoted in 2.1 and from the generated slot rows
      directly above the new section.

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
