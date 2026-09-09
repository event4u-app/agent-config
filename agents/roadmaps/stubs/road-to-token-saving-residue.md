---
complexity: lightweight
review_by: 2026-12-09
---

# Stub: the token-saving residue E7 did not archive

> **Stub — not active work.** Created 2026-09-09 executing step 7.3 of
> `road-to-delivery-for-every-host`, which applies owner ruling **E7**:
> `later/road-to-token-saving.md` and
> `later/road-to-token-saving-HUMAN-MEASUREMENT.md` are *"archived for the rule
> layer once Phase 7.1 flips the claim; any non-rule-layer residue moves to a
> stub with a `review_by`."* Phase 7.1 flipped the claim on 2026-09-07, so the
> precondition was met; the archival was deliberately deferred to its own change
> because it moves three ratchets (the estate count, the risk-register floor and
> the archive index) that were not that change's subject. This is that change,
> and this file is the receiver E7 names.

## Why the rule layer is discharged, stated so the archive is not read as a drop

Both roadmaps existed to cut the standing rule payload. That was delivered by a
different mechanism: `lean_projection.mode: delivery` for `claude-code`, which
took `.claude/rules` from **99,598 tok to 24,166 tok, −75.7 %, 114 files on both
sides** (measured on a clean consumer-shaped root, `road-to-delivery-for-every-host`
step 4.2), while every non-Claude host keeps a byte-identical tree. The thin
lever those roadmaps were chasing is separately dead by measurement: two
pre-registered length-neutral judge runs returned inconclusive, and the gate is
recorded CLOSED-BY-DIAGNOSIS (`docs/benchmark.md` § Length-neutral judge RERUN).

So the rule-layer question is answered, not abandoned. What follows is what those
two files still carried that the delivery flip does not answer.

## The residue, one item per open box

**R1 — RTK golden-set validation, and the kernel promotion behind it.**
`road-to-token-saving.md`: run the Phase 0 golden set through RTK and confirm no
output-completeness regression (ANSI/structured output, the `git diff`
truncation denylist); clean → promote RTK wrapping to always-on, otherwise keep
it profile-gated and record the failing case. Doubly gated and neither gate is
this repository's to open: the validation run needs the RTK binary against live
outputs and is operator/cost-gated, and the promotion is a **kernel-rule edit**,
which `scope-control` gives its own PR and a ≥ 24 h soak that no autonomy lifts.
*Probe:* an operator runs the golden set and records the result.

**R2 — the live trigger-eval pass.** `road-to-token-saving.md`: the static
reconciliation is done; the LIVE trigger evaluation is a human gate. *Probe:* a
live pass is recorded, or the obligation is dropped with a reason.

**R3 — `telegraph-speak` removal, awaiting owner authorization.**
`road-to-token-saving-HUMAN-MEASUREMENT.md`: both the H2 (telegraph-speak) and
H3 (condensation-ROI) gates were measured RED and a council said remove both.
What is missing is the authorization to execute, not the measurement.
Deliberately carried here rather than left to lapse in an archive: an unexecuted
owner decision is not residue the delivery flip discharges. Note the correction
that file already carries — there is **no** CI gate for it
(`validate_telegraph_carveouts.ts` appears in no Taskfile target and no
workflow), so the deletable surface is 5 scripts, 4 test files and the rule.
*Probe:* the owner authorizes or declines; either closes it.
**Owner-reserved. This stub does not execute it and no mandate lets it.**

**R4 — zero-cost dormancy is available and was never taken.** Same file:
`COMPILE_TIME_TOGGLES['telegraph-speak']` gates on `telegraph.enabled` /
`telegraph.speak` and never reads `speak_scope`, so `speak_scope: off` kills the
behaviour while leaving the ~982-token cost, whereas `telegraph.speak: false`
omits the rule from `dist/router.json` entirely. A settings decision, not a
deletion. *Probe:* the flag is set either way, or R3 lands and moots it.

**R5 — 26 artifacts still reference the dead `.agent-src.uncondensed` tree**
(13 rules, 13 skills). The functional subset — 8 `path_prefix` trigger entries
compiled into `dist/router.json` — is already fixed. The remainder are prose
citations and declared `validator_ignore` exemptions, several deliberate with
stated reasons, so they need per-case judgement rather than a sweep. *Probe:* a
per-case pass lands, or the remainder is declared intentional.

**R6 — the unmeasured-lever acceptance.** "Every shipped lever carries a measured
before/after at held-constant quality." Kept because it is the criterion that
made both roadmaps honest, and because the delivery flip satisfies it for the
lever that actually shipped: the −75.7 % reading above is a before/after on the
tree a host loads. *Probe:* none needed for the shipped lever; it stays here as
the bar any future lever must clear.

## What this stub is NOT

Not a plan to resume the token-saving roadmaps. The rule-layer motivation is
discharged and the thin lever is dead by measurement; promoting this stub back
to an active roadmap would need a NEW reason, not these six items. Five of the
six are gated on an operator, a human pass or an owner decision — none of them
on engineering this repository is withholding.

## Provenance

Both source files are at
`agents/roadmaps/archive/road-to-token-saving.md` and
`agents/roadmaps/archive/road-to-token-saving-HUMAN-MEASUREMENT.md`, archived
with their full history intact; nothing in them was edited on the way except the
`phase-0-golden-set` blocker's status token, which read `RESOLVED NEGATIVE` and
now reads `resolved` so the machine-readable half matches the prose that was
already there.
