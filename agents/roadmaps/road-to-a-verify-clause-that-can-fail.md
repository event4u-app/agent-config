---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Nothing here can be archived — the 155 verify: lines are live contract surface and 0 of them state a machine-decidable expectation; parking costs the one cheap reading (a listing) that would tell the estate how bad it is; merging into road-to-release-holds-that-refuse would put a grammar change inside a release-gating roadmap that shares only the template file and none of the subject."
relates:
  - slug: road-to-release-holds-that-refuse
    relation: disjoint
---
# Road to a verify clause that can fail

> **Source:** `agents/tmp.old/inbox-2026-09-ab/t11/` — an external completion-contract analysis set (two competing model syntheses over the same two parents, plus their chat).

## Goal

A `verify:` clause names a command and never names what the command must produce, so a
step can be flipped on a command that cannot fail. Re-derived at this head: 155 `verify:`
lines across the 8 active roadmaps, 51 opening with a backticked command, and **zero**
carrying a machine-decidable expectation. `extractVerify`
(`src/scripts/hooks/run_continuation_hook.ts:485-493`) returns a bare string and has no
concept of an expectation. `closure_scan` checks that a `verify:` is present, never that
its oracle could have said no. Done: the arrow form `verify: \`<cmd>\` -> 0` and
`-> /regex/` is legal in rule 23 and parsed by one shared parser, a `closure_scan` family
reports the unfalsifiable share as a **listing that always exits 0**, and the runnable
share per roadmap is a published number rather than an impression.

## Phase 1 — The grammar, and one parser for it

- [ ] **1.1 Rule 23 accepts an expectation half.** `verify: \`<cmd>\` -> 0` and
      `-> /regex/`, in `src/agent-src/templates/roadmaps.md`. The arrow is the one `exec:`
      evidence already carries — not a new symbol. Prose after `verify:` stays legal and
      reads as MANUAL, because forbidding it would silently invalidate 104 existing lines.
      verify: `grep -c 'verify:.*->' src/agent-src/templates/roadmaps.md` -> /[1-9]/
- [ ] **1.2 One parser, two importers, one parity test.** `extractVerify` returns
      `{command, expect}` where the arrow is present and `{command, expect: null}` where it
      is not. Nothing may parse the arrow a second time.
      verify: fixture G4 — one step each of `-> 0`, `-> /regex/`, prose — yields three distinct shapes
- [ ] **1.3 Serialise the template edit.** `road-to-release-holds-that-refuse` writes six
      rules into the same file. Rebase onto whichever lands first; never merge both in one
      pass.
      verify: `git log --oneline -- src/agent-src/templates/roadmaps.md | head -3` shows the two touches ordered

## Phase 2 — Report the share; never gate on it

- [ ] **2.1 A listing family, exit 0 always.** `closure_scan` gains `unfalsifiable-verify`:
      a fixed-output command head, an expectation the failure output also prints, an
      unmeasured number in a manual step. It exits 0 unconditionally, for the reason
      `check_requirements_trace.ts`'s own header records about turning a young reader into
      a gate.
      verify: `./scripts-run src/scripts/closure_scan <fixture> --json` -> /unfalsifiable-verify/
- [ ] **2.2 Publish the runnable share per roadmap.** Baseline re-derived at this head:
      51 of 155 open with a command, 0 carry an expectation. Both numbers go in the
      evidence tree with their date, so the next reading is a delta and not a re-derivation.
      verify: the evidence page carries both figures with the command that produced them
- [ ] **2.3 An absence check names its positive control.** A `verify:` asserting that
      something is absent must name the input on which it fires, or it is a check that has
      never been seen working.
      verify: `grep -c 'positive control' src/agent-src/templates/roadmaps.md` -> /[1-9]/
- [ ] **[~] 2.4 A ratchet on the runnable share.** Deferred: a ratchet needs a measured
      false-positive rate, and 2.2 has not produced two readings yet. May bind only files
      created after this roadmap lands, and only after two quarters of data.

## Acceptance criteria

- The arrow form is legal in rule 23 and parsed in exactly one place.
- `closure_scan` reports the unfalsifiable family and exits 0 on a corpus that is entirely
  unfalsifiable, proven by running it against today's 8 roadmaps.
- The 51-of-155 baseline is committed with the command that produced it, before any fix
  moves the number.
- No existing `verify:` line is invalidated by this change; prose stays legal.
- No ratchet, no gate, no CI-blocking step lands in this roadmap.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-09-29 | reviewer: agent -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The arrow grammar is ceremony nobody writes, and the runnable share never moves | product | Step 1.1 makes the expectation half optional, because forbidding prose would invalidate 104 existing lines. Optional syntax in an authoring template is routinely skipped: the arrow costs the author a decision about what the command must print, and writing nothing stays legal and green. The measured baseline is 0 of 155 lines carrying an expectation today, so the null hypothesis is that it stays near zero and the grammar buys a template edit and nothing else. | Step 2.2 publishes the runnable share per roadmap with the command that produced it and its date, which makes the next reading a delta rather than an impression. The retirement condition is stated in advance: if the share has not moved over two quarters of new roadmaps, 1.1 is retired and only the listing from 2.1 is kept. | Phase 1 — The grammar, and one parser for it |
| 2 | The listing becomes a gate by accretion and reds CI on a corpus it was never calibrated against | implementation | A `closure_scan` family that reliably finds unfalsifiable verify lines looks one flag away from useful enforcement, and the whole corpus is currently unfalsifiable — 0 of 155 lines carry an expectation. Promoting the listing before a false-positive rate is measured turns every existing roadmap red at once, and the cheapest repair for a gate that reds on everything is to weaken it until it finds nothing. | Step 2.1 fixes exit 0 unconditionally as a property of the family rather than as a flag, following the reason `check_requirements_trace.ts`'s own header records about promoting a young reader. Step 2.4 stays deferred behind two readings and a measured false-positive rate, and the acceptance criteria state that no ratchet, gate or CI-blocking step lands in this roadmap. | Phase 2 — Report the share; never gate on it |
| 3 | Two roadmaps edit `templates/roadmaps.md` in the same window and one silently drops the other's rules | implementation | `road-to-release-holds-that-refuse` writes six rules into the same numbered rule list this roadmap's 1.1 extends. Git auto-merges additions to adjacent list items without a conflict marker, so one set of rules can disappear into a clean merge that nobody reviews — and a rule that vanished from a template fails no test, because the template is prose. | Step 1.3 serialises the two edits explicitly rather than trusting the merge: rebase onto whichever lands first and never merge both in one pass. Its verify reads `git log --oneline` on that one file and requires the two touches to appear ordered, so an unordered merge is visible in the step's own evidence. | Phase 1 — The grammar, and one parser for it |
| 4 | The grammar lands optional and changes nothing on its own | product | Because prose after `verify:` stays legal and reads as MANUAL, Phase 1 is a pure addition — no existing line is invalidated, no author is obliged to do anything differently, and the tree looks improved while every one of the 155 lines can still be flipped on a command that cannot fail. Shipping the syntax and stopping there would leave the actual defect untouched behind a green diff. | Step 1.1 keeps prose legal deliberately and labels it MANUAL so the unfalsifiable lines are named rather than hidden, and the value is carried by Step 2.2's published reading rather than by the syntax. The acceptance criteria require the 51-of-155 baseline to be committed with its producing command before any fix moves the number. | Phase 1 — The grammar, and one parser for it |
