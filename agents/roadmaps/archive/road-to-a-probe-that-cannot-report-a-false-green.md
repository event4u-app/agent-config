---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Archiving is not available — every active roadmap is mid-phase and none covers this file; parking would leave a reproduced false green live at HEAD, which is the one state the probe's own header forbids; merging into road-to-behaviour-evidence-over-pixels is impossible because that roadmap is already archived with both blockers resolved, so it has no open phase to absorb this."
relates:
  - slug: road-to-behaviour-evidence-over-pixels
    relation: extends
---
# Road to a probe that cannot report a false green

> **Source:** `agents/tmp.old/inbox-2026-09-ab/t08/` — an external deep-analysis pair (a long architecture memo plus a short phased plan) written against a pinned commit, with one of its measurements re-executed here.

## Goal

`ui_conformance_probe.evaluate()` stamps all five dimensions `status: 'exercised'` unconditionally and derives `structure_gate` solely from `unmatched.length`. Given a reference observation with zero nodes — which is what a design handover carrying no `data-probe-id` produces — it returns `structure_gate: 'passed'` and five rows of `findings: 0`. Its own header (`src/scripts/ui_conformance_probe.ts:29`) forbids that exact reading: *"`findings: null` — never 0, which would read as 'ran and found nothing'"*. This roadmap makes an empty comparison indistinguishable from no comparison, and makes a target-side element with no reference counterpart observable, so the probe can no longer claim to have exercised a dimension it never entered. It is falsified if, after the change, an empty-reference run still yields any `status: 'exercised'` row or a `structure_gate` of `passed`.

## Phase 1 — Red first

- [x] **1.1 Add a handle-less reference fixture under `tests/design-artifacts/fixtures/ui-conformance/`.** A copy of the existing `reference/index.html` with every `data-probe-id` attribute removed, so the capture collects zero nodes. Not already the case: all three fixture directories under that path — `reference/`, `variant-defects/`, `variant-renamed/` — carry handles, which is why the empty path has never been exercised by a test.
      verify: `node_modules/.bin/tsx -e "import {evaluate} from './src/scripts/ui_conformance_probe.ts'; const e={source:'x',nodes:[]}; console.log(JSON.stringify(evaluate(e,e,[]).dimensions))"` prints five `"status":"exercised","findings":0` rows — the defect, captured before anything changes
- [x] **1.2 Add a target-only-element case to the same fixture set.** A variant whose target carries one handle the reference does not. Not already the case: the evaluation loop iterates `reference.nodes` only (`ui_conformance_probe.ts:214`), so no existing fixture can produce a finding from the target side.
      verify: the new case runs green against the unmodified probe — the added element produces zero findings, which is the second defect captured
- [x] **1.3 Write the expected post-change reading beside each fixture as a comment, before Phase 2 starts.** Not already the case: the existing fixture README records what each variant plants, but neither of the two states above exists to be predicted.
      verify: `grep -c 'expected' tests/design-artifacts/fixtures/ui-conformance/README.md` rises by the number of cases added

## Phase 2 — An empty comparison reports as empty

- [x] **2.1 Return `not_applicable` with a reason when the reference collected zero nodes.** Every dimension carries `findings: null` and a reason naming the cause — the reference carries no handles — and `structure_gate` becomes `'stopped'`. The `unavailableArtefact()` helper at `ui_conformance_probe.ts:376` already models exactly this shape for a host with no browser; this reuses that shape for a second cause rather than inventing one. Not already the case: `dimensions` is built by an unconditional `DIMENSIONS.map` at `:352`.
      verify: 1.1's command prints five `"status":"not_applicable"` rows with `"findings":null`, and `structure_gate: stopped`
- [x] **2.2 Carry `reference_nodes` and `target_nodes` counts on the artefact, additively.** Two integers, so a reader of `agents/runtime/state/ui-conformance.json` can see the denominator the run had. Not already the case: `ProbeArtefact` carries `unmatched_nodes` but no count of what was collected, so a zero-node run and a fully-matched run are indistinguishable in the artefact.
      verify: the two fields appear in the artefact for both the handle-less and the existing four-defect fixture, and the existing fixture's other fields are byte-identical to before

## Phase 3 — Additions are findings

- [x] **3.1 Emit a `structure` finding for every target handle absent from the reference.** `expected: 'absent'`, `observed: 'present'`, mirroring the existing reference-side finding at `:216`. Not already the case: the loop never reads the target map's unclaimed keys. The rule this serves names it directly — `src/rules/design-fidelity.md` Iron Law: *"never omit or add an element"* — and only the omit half is currently observable.
      verify: 1.2's case turns exactly one `structure` row red and leaves every other dimension's count unchanged
- [x] **3.2 Report the added-element count in the design-pass line.** `src/scripts/hooks/design_pass_hook.ts` already prints `structure_gate` and already says *"Absent is not clean"* at `:165`; this adds the one number that line currently cannot show.
      verify: the hook's output for 1.2's case names the added element; the hook stays advisory and blocks nothing

## Phase 4 — Say what moved

- [x] **4.1 Record the two new artefact fields in the probe's header comment.** The header is where this file states its own contract, and the contract it stated at `:29` is what this roadmap restores. Not already the case: the header describes `not_applicable` as a host-capability outcome only.
      verify: `check_references` green; the probe's line count grows by less than the phase's diff, and no `src/rules/` or `src/skills/` file is edited
- [x] **4.2 Leave `design-fidelity`'s `enforced_by: instruction-only` untouched and add no gate row.** The probe is mounted in shadow by its own header's decision (`:10-13`), and promoting it is a separate decision with its own surfaces. Not already the case only in the sense that it must be actively not done.
      verify: `git diff --stat` names no file under `src/rules/`, and `src/config/gate-coverage.yml` is unchanged

## Acceptance criteria

- AC-1 A reference observation with zero nodes produces five `not_applicable` rows with `findings: null` and `structure_gate: stopped` — never an `exercised` row.
- AC-2 A target element with no reference counterpart produces exactly one `structure` finding.
- AC-3 The existing four-defect fixture's artefact is unchanged apart from the two additive count fields.
- AC-4 No skill, command verb, hook concern or rule was added, and no rule file was edited.
- AC-5 The probe remains shadow-mounted: nothing in this change makes it block.

## Evidence

Executed 2026-09-29 on branch `drain/probe-false-green`, host with Chromium
present (`chromiumAvailable() === true`), so the live capture layer ran rather
than skipping.

### The roadmap's own claims, checked before building on them

Every line-number claim in this file reproduced exactly at the branch point.
`:29` is the never-0 clause, `:214` the `for (const ref of reference.nodes)`
header, `:216` the `if (!got)` branch, `:352` the unconditional `DIMENSIONS.map`,
`:376` the `unavailableArtefact` signature, `:10-13` the shadow-mount decision,
and `design_pass_hook.ts:165` the "Absent is not clean" line. No figure had to be
re-measured and none was carried forward on trust.

### 1.1 — the defect, captured before anything changed

```
$ node_modules/.bin/tsx -e "import {evaluate} from './src/scripts/ui_conformance_probe.ts'; const e={source:'x',nodes:[]}; console.log(JSON.stringify(evaluate(e,e,[]).dimensions))"
[{"dimension":"structure","status":"exercised","findings":0},{"dimension":"computed_style","status":"exercised","findings":0},{"dimension":"interaction","status":"exercised","findings":0},{"dimension":"viewport_matrix","status":"exercised","findings":0},{"dimension":"media_emulation","status":"exercised","findings":0}]
structure_gate: passed
```

The same reading against the real captured fixture
(`observations/reference-no-handles.json`, **0 nodes**) was identical.

### 1.2 — the second defect, captured against the unmodified probe

```
$ ./scripts-run tests/design-artifacts/fixtures/ui-conformance/capture
captured reference: 7 node(s)
captured variant-defects: 6 node(s)
captured variant-renamed: 7 node(s)
captured reference-no-handles: 0 node(s)
captured variant-added: 8 node(s)

# evaluate(reference, variant-added, []) against the pre-change probe
1.2 findings: []
1.2 structure_gate: passed
```

The three pre-existing observation records re-captured **byte-identically** —
`git status` reported no modification to `reference.json`,
`variant-defects.json` or `variant-renamed.json`. The frozen records are still
true on this host, which is the second layer of the fixture test doing its job.

### 1.3 — expected readings recorded before Phase 2

```
$ grep -c 'expected' tests/design-artifacts/fixtures/ui-conformance/README.md
# before: 0     after: 2     (+2 = the two cases added)
```

### Red first, and each red for its own reason

The post-change assertions were written and run **before** the probe changed.
Nine assertion reds, one per intended behaviour:

```
× the frozen fixture > stops at structure on the renamed variant
  → expected [ { dimension: 'structure', …(6) } ] to have a length of 2 but got 1
× an empty comparison > never reports an exercised dimension …
  → expected 'exercised' to be 'not_applicable'
× an empty comparison > blames the handover, not the host …
  → expected '' to match /data-probe-id/
× an empty comparison > carries the node counts each side actually observed
  → expected undefined to be +0
× an empty comparison > reports the counts as null, never 0 …
  → expected undefined to be null
× an empty comparison > adds exactly two fields to the artefact and no more
  → expected [ 'declared_suppressed', …(9) ] to deeply equal [ …(11) ]
× additions are findings > turns exactly one structure row red …
  → expected [] to have a length of 1 but got +0
× additions are findings > leaves every other dimension at zero …
  → expected [] to have a length of 1 but got +0
× additions are findings > stops the structure gate …
  → expected 'passed' to be 'stopped'
Tests  10 failed | 12 passed (22)
```

The tenth red was a 120 s timeout on the live re-capture block, which now
captures five variants instead of three; its budget was raised to 300 s.

Two of the new assertions were **green before and after** on purpose and are
sensitivity guards rather than targets: *"fires on the reference side only"* (a
target with zero nodes must stay a real comparison with four structure findings,
not collapse into a shrug) and *"still reports a clean run when the two sides
carry the same handles"* (without it, "exactly one finding" would be satisfied by
a probe that reds on everything).

**Sabotage probe for the hook line (3.2).** `design_pass_hook.ts` was copied to
the scratchpad, the added-element branch was disabled in place, and the suite was
re-run: exactly one test failed —

```
× the ui-conformance shadow mount > names the elements the target added …
  → expected 'ui-conformance: 1 behavioural finding…' to match /1 element\(s\) present …/
Tests  1 failed | 6 passed | 35 skipped (42)
```

The file was then restored from the copy, never with `git checkout`. The paired
sensitivity test (*"does not read a missing element as an added one"*) stayed
green throughout, which is what proves the filter keys on the direction of
`expected`/`observed` and not on the dimension alone.

### 2.1 — the empty comparison after the change

```
structure:       status=not_applicable  findings=null
computed_style:  status=not_applicable  findings=null
interaction:     status=not_applicable  findings=null
viewport_matrix: status=not_applicable  findings=null
media_emulation: status=not_applicable  findings=null
structure_gate: stopped
reference_nodes: 0   target_nodes: 0

reason (per row): "<dimension> was never entered: the reference observation
carries no data-probe-id handles, so there was nothing to compare against. The
capture ran and collected zero nodes: this is a property of the handover, not of
this machine."
```

Risk 1 is discharged in both the ways the register asks for: the reason names the
handover and never the host — asserted by a test that also asserts
`unavailableArtefact`'s reason *does* say browser, so the two causes cannot
converge — and `reference_nodes: 0` carries the same cause in the data for a
reader who never reads prose.

### 2.2 — additive, and nothing else moved

Both revisions of `evaluate` were run over the same frozen four-defect
observations, **in separate processes**. That detail is load-bearing: run in one
process the old copy reports `host_class: "unknown"` because `@playwright/test`
throws on a second require — the probe's own header documents this — so a
single-process comparison would have shown a spurious difference. A copy placed
outside the repository root shows the same false difference for a different
reason (module resolution), so the comparison copy was placed inside the
worktree under gitignored `agents/runtime/` and deleted afterwards.

```
before keys: schema,generated_at,host_class,target,reference,structure_gate,unmatched_nodes,dimensions,findings,declared_suppressed
after  keys: schema,generated_at,host_class,target,reference,reference_nodes,target_nodes,structure_gate,unmatched_nodes,dimensions,findings,declared_suppressed
counts: reference_nodes=7 target_nodes=6
$ diff artefact_before.json artefact_after.json   # generated_at + the two counts excluded
AC-3: every other field is byte-identical
```

### 3.1 / 3.2

`evaluate(reference, variant-added, [])` after the change: exactly one
`structure` finding, `probe_id: "extra-badge"`, `expected: "absent"`,
`observed: "present"`; `computed_style`, `interaction`, `viewport_matrix` and
`media_emulation` all still 0; `structure_gate: stopped`; `unmatched_nodes: []`.
The hook's line for the same artefact reads
`· 1 element(s) present in the target and absent from the reference: extra-badge — added, not ported`.
The hook's exit path was not touched: `conformanceVerdict` is still consulted
only by the renderer, never by `decide`, and the existing test asserting the
verdict renders beside a P0 stop without changing `blocked` is unchanged and
green (AC-5).

### The one consequence the roadmap did not name

`variant-renamed` changes reading, and the change is intended rather than
tolerated: a rename **is** an omission plus an addition, so D5 now produces two
`structure` findings (`status-badge` absent, `status-chip` added) where it
produced one. The probe could previously see half of a rename. The existing test
was updated to assert both halves and their directions; every other assertion in
that suite — four-of-four planted defects, the declared-deviation suppression and
its sensitivity control, the hover and breakpoint rows, the no-aggregate scans —
is untouched and green, so the `ui-conformance-behavioral-catch` claim in
`docs/CLAIMS.md` still rests on the same evidence.

### 4.1 / 4.2

```
$ ./scripts-run src/scripts/check_references
scanned: 2120
✅  No broken references found.

$ git diff --numstat -- src/scripts/ui_conformance_probe.ts
125  1  src/scripts/ui_conformance_probe.ts        # 622 → 746 lines
```

Whole-file reading of 4.1's verify: growth 124 < diff 126. The Phase-4 header
edit taken alone is a pure insertion (31 added, 0 removed), where growth equals
the diff rather than falling below it — a degenerate case of that verify,
recorded rather than rounded in the right direction.

`git diff --stat` names six files: `src/scripts/ui_conformance_probe.ts`,
`src/scripts/hooks/design_pass_hook.ts`, and four under
`tests/design-artifacts/fixtures/ui-conformance/` and `tests/`. No file under
`src/rules/` or `src/skills/`, and `src/config/gate-coverage.yml` is unchanged —
no gate row was added, and the probe keeps its non-gate prefix and its shadow
mount (AC-4, AC-5).

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-29 | reviewer: agent -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | `not_applicable` on an empty reference reads as a host failure rather than a handover defect | product | Step 2.1 reuses the `unavailableArtefact()` shape that today means one thing only — no browser on this host. Reusing it for a second cause makes the two indistinguishable at a glance, and an operator who reads the row as an environment problem goes looking for a missing browser instead of fixing the handover that carries no `data-probe-id`. The probe would then be honest and still useless, because nobody acts on the reading. | Step 2.1 requires the reason string to name the handover rather than the host, so the two causes differ in the one field a reader looks at. Step 2.2 adds `reference_nodes` to the artefact, so `reference_nodes: 0` makes the cause readable from the data without depending on the prose being read at all. | Phase 2 — An empty comparison reports as empty |
| 2 | The added-element finding fires on wrapper nodes a legitimate framework port inserts | implementation | Step 3.1 turns every target node with no reference counterpart into a `structure` finding. A faithful port into a component framework routinely adds wrapper and portal nodes the handover never had, so a correct port would light up the structure dimension red. A dimension that reds on correct work gets ignored, and then the omission half it was already catching is ignored with it. | Step 3.1 keys on `data-probe-id` handles rather than on DOM nodes, so a wrapper that carries no handle produces nothing — the false-positive class is excluded by construction, not by a heuristic. A handle-less visible element is a real gap and is named as out of scope for this roadmap rather than papered over. | Phase 3 — Additions are findings |
| 3 | Changing the artefact shape breaks the design-pass hook's parser | implementation | `design_pass_hook.ts` reads `agents/runtime/state/ui-conformance.json` and prints `structure_gate`. Phase 2 adds a new `structure_gate` value and two new fields; a parser that switches exhaustively on the old value set, or that validates the artefact's keys, fails on the first run after the change — and the hook is the only surface where the probe's output is seen. | Step 2.2 is purely additive, and Step 2.1 reuses the `unavailableArtefact()` shape the hook already reads for the no-browser case, so `stopped` travels a path the parser has already handled. The verify line requires the existing four-defect fixture's artefact to be byte-identical apart from the two new counts, which fails if anything else moved. | Phase 2 — An empty comparison reports as empty |
| 4 | The change looks like it solves handover fidelity, and the real gap is read as closed | product | After this roadmap the probe stops lying, and a reader can easily take that for the probe now working. It does not: no design handover in this tree carries a `data-probe-id` at all, so every real run still lands in the `not_applicable` branch. Declaring fidelity covered on the strength of a fixed reporting bug would retire the actual correspondence problem unsolved. | Step 4.2 forbids any gate promotion and any edit under `src/rules/`, verified by `git diff --stat`, so nothing in this change can be mistaken for enforcement. The Goal states exactly what is falsified — the false report, never the missing correspondence — and Step 4.1 records the same boundary in the probe's own header. | Phase 4 — Say what moved |
