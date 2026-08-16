# Completion review — source-first browser handover (road-to-source-first-frontend Phase 4 Steps 1–2)

**Skipped:** no code surface for this completion — the branch changes 8 files and 0 of them is a code path: one new guideline, the mechanics guideline it was split out of, one rule's body-migration pointer, that rule's byte-identical `dist/` projection, the roadmap with two checkboxes flipped plus a correction note, the regenerated dashboard, and the README + architecture guideline counts, scope 407b11820953732f8ccdef6af1767271a803477c065ca78ca928b0735baccb08, declared 2026-08-16

**Re-review, not a re-bind.** The first declaration covered scope
`676f86b3…` at 5 files. The content then genuinely changed — the section was
split into its own guideline after `check_depth_budget` reported it as a fifth
over-ceiling file — so contract §2.1 forces a fresh review rather than an
in-place re-bind. Nothing was carried across: there were no findings rows to
carry, and the verdict is unchanged because the split moved prose between two
docs and added no code path.

## Why there is no code to review

Both roadmap steps are written as prose deliverables. Step 1 asks for a section
in the mechanics guideline; Step 2 asks for a retrieval order and a producer
sentence in that same section. The step text is explicit that no new mechanism
may be built here — the extraction artifact is the existing
`design-system.json` contract and the consumer is the existing
`/design-system:import` adapter, cited rather than reimplemented, which is what
the roadmap calls program X4. Defining a second artifact shape would have been
the failure, not the deliverable.

The lock boundary is the other reason nothing executable landed: the package
ships the contract, the adapter and the instructions, and does not ship the
crawler, the Playwright runtime or a font-bundler. That sentence is in the new
section because it is exactly the line an implementing agent would cross.

## What a reviewer should check instead

Every load-bearing claim is falsifiable in-repo without reading code.

The stale-claim correction is the one worth checking first, because the whole
pick rested on it. The roadmap's Execution-status block said the import adapter
and the persistence discipline owned by `road-to-design-system-onramp` did not
exist. Verify the opposite: `ls agents/roadmaps/archive/road-to-design-system-onramp.md`
resolves and `grep -c '^- \[ \]'` over it returns 0; `ls src/scripts/design_system_import.ts
src/scripts/_lib/design_system_import.ts` resolves both; and
`grep 'never overwrite a confirmed' src/domains/engineering-base/design-system/generate/command.md`
hits. The correction note quotes commit `c4e95d36a` as the archive commit.

The contract the section cites exists at
`src/skills/design-system-capture/references/design-system-json.md`, and the
route it names is `path_prefix: ".claude/design-system/"` in
`src/rules/design-fidelity.md`. The adapter's three lanes and its offline
posture are quoted from that contract and from the import command body, not
paraphrased from memory.

The coverage line at the end of the section is deliberately negative and should
be read as such: no fixture scores the URL-handover class. The nearest one,
`daf-source-over-screenshot`, scores rung choice on an attached artifact and is
itself recorded as SKIPPED on 2026-08-13 for want of a page-reaching capture
primitive. Claiming a regression witness here would have been the fabrication.

## What did not land, and why that is correct

Phase 4 Step 3 stays withdrawn. Its own text records the withdrawal and states
what would close it — a verified share-path segment per vendor, or a matcher
that can express handover-word co-occurrence — and neither is available from
the repo. The phase is therefore 2 of 3, and the roadmap stays open at 6 of 18.

Phase 3 was not touched: its verifier exemption keys on a payload field that
`road-to-subagent-lifecycle-integrity` still has open behind a host-env
blocker, and its matcher would be built from a census that is still `[~]`.

## The one repair that did land

`check_depth_budget` went red on the first push: the new section took
`design-fidelity-mechanics.md` from 14,202 to 17,949 chars against a 16,000
per-file ceiling, making it the fifth over-ceiling file against a baseline of 4.
All three CI failures — `Rule backstops` plus `Node Tests` shard 4/4 on both
runners — were that one cause; the shard failure is the gate's own test
asserting the baseline equals the live count.

Repaired by splitting rather than compressing, which is the ceiling working as
intended: with 1,798 chars of headroom, fitting the contract citation, the lock
boundary, the retrieval order and the producer sentence into the remaining space
would have cost the parts that make them actionable. Raising the baseline is
what the gate's own message calls a defect, and was not done. Verified:
`check_depth_budget` back to `4 violation(s) at baseline`, its test 9/9,
`design_fidelity_routing` 23/23.

## Gates run on this change

`check_condensation` (444 scanned, dist byte-identical to the rewrite),
`check_references` (1260 scanned, no broken references),
`check_md_language` over the three edited markdown files (no German content),
`lint_hidden_unicode` (clean), `lint_plan_risk_register` (34 ready roadmaps
clean, no `stale_review` despite the roadmap edit), `check-roadmap-trackable`
(silent), and `design_fidelity_routing.test.ts` (23 passed, green before and
after — the trigger set was deliberately not touched).
