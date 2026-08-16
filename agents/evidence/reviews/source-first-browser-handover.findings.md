# Completion review — source-first browser handover (road-to-source-first-frontend Phase 4 Steps 1–2)

**Skipped:** no code surface for this completion — the branch changes 5 files and 0 of them is a code path: one guideline section, one rule's body-migration pointer, that rule's byte-identical `dist/` projection, the roadmap with two checkboxes flipped plus a correction note, and the regenerated dashboard, scope 676f86b31a392f0ef38f9d2e03a947b06b21a71185830cc375929f5a97affcd6, declared 2026-08-16

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

## Gates run on this change

`check_condensation` (444 scanned, dist byte-identical to the rewrite),
`check_references` (1260 scanned, no broken references),
`check_md_language` over the three edited markdown files (no German content),
`lint_hidden_unicode` (clean), `lint_plan_risk_register` (34 ready roadmaps
clean, no `stale_review` despite the roadmap edit), `check-roadmap-trackable`
(silent), and `design_fidelity_routing.test.ts` (23 passed, green before and
after — the trigger set was deliberately not touched).
