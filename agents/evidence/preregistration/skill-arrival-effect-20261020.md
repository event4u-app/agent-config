# Pre-registration — reading the effect of the arrival work

**Roadmap step:** `road-to-skills-that-arrive-when-called` 5.1.
**Written:** 2026-10-20, before the first run of 5.2.
**Hash:** recorded in the commit message that lands this file; 5.2's result is
committed later, so the ordering is in the history.

## The primary arm cannot be measured, and that is a finding, not an excuse

5.1 names the primary as *skills reached with declared semantics per positive
**host-graded case***. **No artefact named "host-graded cases" exists in this
tree.** That is not this lane's guess: `road-to-a-setup-that-decides-itself`
step 2.x recorded exactly the same thing on 2026-10-16 — "no artefact named
'host-graded cases' exists in the tree (the only other mention is the skills
roadmap's own plan), and `tests/conformance/` holds a retrieval set only."

So the primary is declared **UNMEASURABLE TODAY**, up front, with its reopening
condition: it becomes measurable when a graded case set exists, and building
one is not this step. A primary quietly swapped for whatever happened to be
measurable is the failure pre-registration exists to prevent, so it is not
swapped — it is named absent, and the guards below carry the run.

## Arms

### Second host — today vs Phase 4

**Today.** The whole projected catalogue is offered to a host whose documented
skills-context budget is 8,000 characters. The host then drops every
description as a block and drops whole entries from the alphabetical tail,
behind a warning (0.3, `observed-true`, codex-cli 0.148.0).

**Phase 4 (4.1).** Every owned skill outside a computed resident set carries
`agents/openai.yaml` with `policy.allow_implicit_invocation: false`, which 0.3
measured as leaving the listing AND freeing budget.

Readings, each falsifiable:

- **S1 — listing characters.** Offline, deterministic: the resident listing is
  ≤ 8,000 and the whole catalogue is not. Falsifier: the resident listing is
  over budget.
- **S2 — the omission warning, live.** A `codex exec` session under a scratch
  `CODEX_HOME` carrying the resident set prints no
  `Exceeded skills context budget` warning. **Paired with a positive control**
  on the same scratch home WITHOUT the resident set, which must print it —
  without that control, "no warning" is indistinguishable from "the probe never
  loaded any skills", and reporting the first as success would be the hollow
  measurement this package's own gates exist to catch. Target: 0 warnings
  treated, control: ≥ 1.
- **S3 — a non-resident skill stays invocable.** It leaves the LISTING, not the
  install. Falsifier: a non-resident skill cannot be invoked by name.

### First host — today vs 3.2

3.2 closed **harm** and its render ships unwired, so the first host's state is
**unchanged by design**. The arm is therefore read as: nothing shipped, and a
test proves nothing shipped. Falsifier: any install path calls
`renderForkContext`, or any authored SKILL.md carries a `context:` key.

### Guards, all with target 0

- **G1 — skill-not-found at invocation.** Target 0.
- **G2 — any removal under a live lease.** Target 0. This is AC-5.
- **G3 — omission warnings on the second host.** Target 0, with the control
  above.

## What a failed guard means

A guard at non-zero does not fail this step; it is the step's output. G2 above
zero would be the one finding that stops Phase 4 shipping further, because
removal under a live lease is the single harm the lease exists to prevent.

## Honesty label

Every live reading here is a first-party observation of one host build on one
machine. Offline readings are deterministic over the committed tree and say so.
A reading that could not be taken is reported as not taken, with the reason —
never as a null and never as a zero.
