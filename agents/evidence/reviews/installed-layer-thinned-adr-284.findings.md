# Completion review — the installer's host axis recorded, and Phase 2/3 re-screened

**Skipped:** no code surface for this completion — the diff is one new decision record, one reciprocal frontmatter edit on the record it scopes, the two generated ADR consumers, one committed council reading and one roadmap's step text, and the gate itself measures zero code paths of six changed files, scope de2a00d7bb7f5f6405a2a48114aa71b7f2a8efd95dcab1512e97d550b93cf034, declared 2026-10-12

## Why a skip rather than a review

The change closes step 3.3 of `road-to-an-installed-layer-that-is-thinned` with
`docs/decisions/ADR-284-installer-honours-the-host-axis-on-an-explicit-opt-in.md`,
adds the reciprocal `superseded_by` / `superseded_scope` to ADR-228, regenerates
`docs/decisions/INDEX.md` and the ADR evidence census, commits one council
reading under `agents/evidence/council/`, and re-screens the remaining open steps
in the roadmap's own prose. No script, hook, config, test, or schema was touched.
The behaviour ADR-284 records shipped in Phase 1 and is unchanged here — this
change describes it, it does not alter it.

## What replaces a code review here

A skip is only honest if the record's claims were checked rather than asserted.
Each load-bearing one was, against the tree in this branch.

- **The supersession is scoped through the field, not a parenthetical.**
  `check_adr_frontmatter` exits 0 and emits **no new warning** for ADR-284 or
  ADR-228. Nineteen pre-existing warnings name other records writing a partial
  supersession as free text ("records a PARTIAL supersession as free text. Every
  reader of this field parses it as total"); this pair uses `supersedes_scope` /
  `superseded_scope`, so it is absent from that list. That absence is the check,
  and it is a negative worth stating because the gate is demonstrably sensitive
  to the defect — it reports nineteen live instances of it.
- **The reciprocity is real, from both ends.** `check_supersession_links` reports
  no one-sided link for either record. Three pre-existing one-sided links
  (ADR-209→030, ADR-281→268, ADR-281→118) remain and are untouched, which again
  shows the check can still fail.
- **The new-ADR evidence gate was run, not assumed.** `check_new_adr_evidence`
  reports "1 added record(s) since origin/main · 1 accepted and disclosing · 0
  violation(s)" — so `provenance.kind`, `evidence.strength` and the `## Evidence`
  section are present and the gate saw the file, rather than exiting on an empty
  diff.
- **Both generated consumers were regenerated, not just the obvious one.**
  `adr/regenerate_index --dir=docs/decisions` (223 numbered, 1 legacy) and
  `adr/evidence_census` (scanned 231). The census is the one whose staleness reds
  CI with no local preflight catching it.
- **The step's own verify was run:** `./scripts-run src/scripts/check_adr_frontmatter`
  → exit 0.
- **The claims ADR-284 makes about shipped behaviour were re-verified.**
  `npx vitest run tests/scripts/install_thin_layer.test.ts tests/scripts/installed_layer_report.test.ts`
  → 56/56 passing, which includes the seven-case `template-is-not-consent` block
  that is decision 2's evidence and the `standing-only` block that is decision
  5's. `check_host_tree_parity` → exit 0, "2 non-delivery host tree(s)
  byte-identical to eager-all", which is decision 1's second half.
- **The re-screen findings are measurements, not readings of the markers.** The
  roadmap's new Phase 2 note reports 16 dispatcher arrival files on this machine,
  all of them the fixture `injection-budget-dispatch-test.arrival.jsonl` under
  synthetic `injection-dispatch-*` project keys. That was counted
  (`find ~/.event4u/agent-config/state/rule-inject -name '*.jsonl'`), not
  inferred from the absence of a record elsewhere. Likewise 3.1's dead verify
  line: `-t default` matches no test name in `install_thin_layer.test.ts`, the
  word occurring only in a comment.

- **The council reading is reported degraded, and the degradation is read off
  the run rather than assumed.** `agents/runtime/council/events.log` records
  `quorum_result · concluded · total 2 · present 1`, and the response carries
  `openai … error: "os_error: ENOBUFS"` with an empty text field. The committed
  record under `agents/evidence/council/` says one seat in its second paragraph,
  not in a footnote.
- **One council finding was checked and found wrong, and the correction is in
  the record rather than silently dropped.** The seat made an "unexplained
  4,139-character environment variance" its blocking item. That figure is the
  stub-form change recorded in `thinned-layer-composition-2026-10.md`
  (111,197 → 107,058); the environment term is the separate 3,738 = 42 × 89 from
  the same page. Both numbers were read back before the correction was written.
  The correction is stated together with why it does not rescue the proposal.

Other gates green on this branch: `check_references` (2,627 scanned, no broken
reference), `check_estate_count` (+0 active / −0 disposed, within ratchet),
`lint_roadmap_blockers` (165 roadmaps blocker-contract-clean), `audit_adr_coverage`
(0 hard fail, 0 warn), `lint_decision_classes` (30 roadmaps, 0 violations — it
caught a real defect here: D7's `resolved by` first carried free prose naming
the degraded quorum, which is not one of the six legal values, and the fix was
to commit the council record and cite it by id rather than to loosen the field),
`check_council_references` (no forbidden runtime-path citation in a durable
artefact), `lint_evidence_artifacts` (1 added artifact, type declared).

## What this change does NOT claim

- **It does not flip any default, and ADR-284 says so in its own decision 6.**
  The owner's (a) of 2026-10-06 is *recorded* with its condition and with the
  fact that the condition is unmet. A record of a decision is not the decision
  taken.
- **It does not resolve either open blocker.** `default-flip-of-the-installed-layer`
  has its `Resolved when:` re-pointed, because it named step 3.3 as its producer
  and 3.3 is now closed — a resolution clause whose named producer is closed can
  never fire. Re-pointing a clause is not discharging it.
- **It does not supersede ADR-228's `paths:` limb**, and does not weigh the
  compaction objection that limb rests on. `## Not reopened` says this in the
  record itself, and ADR-228 keeps `status: accepted`.
- **It does not claim anything about what an installed layer LOADS.** Every
  figure here is about what is *written*. `agents/evidence/analysis/` still
  matches no `installed-arrival-*.md`, and `check_standing_rule_delivery.ts:289`
  still calls `InstructionsLoaded` a host feature this suite does not bind.
- **It does not land step 3.2's ceiling, and D7 is a one-seat reading.** The
  council was asked whether to build the ratchet and answered REQUEST_CHANGES;
  the step stays open. D7 records a reason, not a convergence — a second seat
  could disagree with it, and the record says where it came from so that a later
  reader can reopen it on that basis rather than on a re-derivation.

## Standing caveat

A skip declaration is a statement about the diff's surface, not a claim that the
prose is right. The strongest objection to this change is that ADR-284 closes
3.3 on three of the step's clauses while the `default-flip` blocker's
`Resolved when:` asked that same ADR for a fourth thing — the arrival record —
so a reader could call this a step closed by narrowing it. The counter is in the
step's own closure note: no clause of 3.3 mentions the flip, the fourth
condition was imported by a blocker written later, and reading it back onto the
step made a fully writable ADR look impossible. That is the
`## Blockers`-entry-as-verdict failure the capability screen exists to refuse.
The blocker is left open, with a clause that can now actually fire.
