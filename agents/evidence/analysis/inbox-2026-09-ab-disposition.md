<!-- evidence-type: analysis -->

# Round `inbox-2026-09-ab` — disposition

Processed 2026-09-29. Eleven topic folders, 71 files, 2.2 MB — **5.4× the largest
round in `/analyze:inbox`'s own measured table**, where the measured adoption rate
at 2.0 MB was 10.5 %. The round was therefore split by topic rather than read in
one pass, one analysis slice per topic, each carrying its own census, its own
three-pass extraction and its own ledger.

Source identities are recorded once, `ENC1:`-encrypted, in the round's intake note
under `agents/tmp.old/inbox-2026-09-ab/`. Nothing here, and nothing in the emitted
roadmaps, carries a readable third-party name.

## Coverage — the source-side ledger

| Topic | Files | Anchors | Claims | Instructions | Demands | Roadmaps out |
|---|---:|---:|---:|---:|---:|---:|
| `t01` | 4 | 348 | 37 | 24 | 30 | 1 |
| `t02` | 5 | 80 | 26 | 12 | 20 | 1 |
| `t03` | 5 | 691 | 36 | 22 | 36 | 2 |
| `t04` | 3 | 777 | 18 | 8 | 24 | 3 |
| `t05` | 5 | 846 | 17 | 12 | 35 | 2 |
| `t06` | 24 | 1,290 | 32 | 14 | 12 | 5 |
| `t07` | 8 | 89 | 24 | 8 | 14 | 2 |
| `t08` | 3 | 280 | 27 | 15 | 30 | 1 |
| `t09` | 3 | 254 | 23 | 17 | 27 | 1 |
| `t10` | 3 | 275 | 44 | 80 | 37 | 2 |
| `t11` | 5 | 610 | 14 | 12 | 12 | 2 |
| **Total** | **68** | **5,540** | **298** | **224** | **277** | **22** |

`unaccounted` is 0 in every topic. Anchor totals differ from the intake census's
6,261 because each slice counted its own semantic anchor set rather than raw
structure; where a slice grouped anchors into class lines instead of judging them
one by one, its report says so — `t05` (571 grouped), `t06` (1,232 grouped),
`t04` (588 grouped) are the three where the discharge is a grouping and not 1,290
individual judgements.

**Extraction convergence, per the three-pass contract.** Converged before the cap:
`t01` (no — see below), `t02` (no), `t04`, `t06`, `t07`, `t10`, `t11`. Stopped **at**
the three-pass cap with rows still arriving: `t01` (+2 on pass 3), `t03` (+16 on
pass 2), `t05` (+3 on pass 3), `t08` (+1), `t09` (+1). Those five are the topics
where a fourth pass is owed if they are reopened; naming them is the point of
recording the pass counts at all.

## Demand disposition — 277 demands, none silent

| | Count | Share |
|---|---:|---:|
| `adopted` | 65 | 23.5 % |
| `already-satisfied` | 66 | 23.8 % |
| `declined` | 91 | 32.9 % |
| `owner-decision` | 55 | 19.9 % |

The 23.5 % adoption rate sits well above the 10.5 % the command's own table
measured for a 2.0 MB round, and the difference is attributable to the batch
split rather than to the sources being better: a slice that holds one topic reads
its transcript as a demand source, and the bucket ratios confirm it — claims to
demands ran between 0.75 : 1 and 1.7 : 1 across every topic, never the 8.5 : 1
inversion that marks a transcript read as background.

## What verification prevented

`already-satisfied` and `already-fixed` are the two columns that prevent work, and
together they removed more than a third of the round. The highest-value instances:

- **`t07`** — the proposal's own "cheapest first PR" already ships:
  `check_preamble_payload_budget.ts:172,186` already censuses the catalog bucket as
  a base-ref shrink-only ratchet. A second gate would have been the second
  authority the proposal's own kill register forbids.
- **`t07`** — the central unlock (`disable-model-invocation` as a skill exclusion
  contract) is refuted by an observed host session recorded in this tree six days
  *before* the source was drafted. Tenth-plus arrival of the same claim.
- **`t01`** — the round's central table is refuted by this tree's own shipped
  census: the real path-shaped split is 4 scoped / 108 unconditional / 9 always,
  not the 21 the proposal reasons from, and its foundational phase (a census gate)
  already ships as a hard ratchet.
- **`t06`** — two of the nine supplied lanes were rejected outright: one is
  already-fixed in three of its own steps, one is held by a stub at 25 arrivals
  with a posed owner question, where a fresh artifact is exactly what Phase 5
  forbids.
- **`t10`** is the counter-case and worth naming: its `already-fixed` fraction is
  near zero. Only four commits touched that surface in 110 since its pin, and
  every one of its twelve file-anchored defects is still true at the cited line.
  That artifact is not stale — it is unactioned.

## Defects reproduced live, not merely read

Five findings were confirmed by execution against the current tree rather than by
reading the source's claim, and each is carried by an emitted roadmap:

1. `turn_end_gate_hook.ts:709` `_VERIFY_RE` accepts all six commands it must
   reject (`ls tests`, `cat build.log`, `git checkout main`, `mkdir build`,
   `git commit -m "fix ci"`, `true # test`), and `before_complete_hook.ts:153`
   rejects all three it must accept. Both accept `npm test || true`.
2. `apply.ts:190` matches a declared inventory item against a coverage bucket by
   substring, so a declared `nav` is satisfied by any entry containing `canvas`.
3. `apply.ts:268` scans the porter's own `envelope['rendered']` rather than the
   files written, so a placeholder in a written file the envelope does not repeat
   is invisible.
4. `ui_conformance_probe.ts` records no digest of its inputs — zero matches for
   `sha256|createHash|digest` — while a sibling applies an mtime freshness rule to
   the artefact it writes.
5. `ui_conformance_probe.ts` `evaluate()` with an empty reference returns
   `structure_gate: passed` and five dimensions `exercised, findings: 0`.

Finding 1 was predicted by name in a roadmap this repository already archived,
whose Risk Register carries the row *"`_VERIFY_RE` widening turns detector C into
a rubber stamp"* with the mitigation *"additions carry a fixture each"*. The
widening shipped; the fixture's negative rows contain no token-as-argument case,
so the audit could not see it. Per `recurring-criticism` that is outcome 1 — the
disposition was right about the risk and wrong about the mitigation.

## Two gate contracts corrected mid-round

Both were discovered by running the gates rather than by reading the brief, and
both had been specified wrongly to the analysis slices:

- **The Risk Register takes six columns** (`Rank | Item | Risk type | Description
  | Mitigation | Anchored under`), not four. A four-column table is not recognised
  at all and reports as `empty_register`.
- **`estate_offset_exempt` clears only the one-in-one-out half.** The count half
  (`active_roadmaps 2 → 19` for this round) needs `estate_growth_exempt`, whose
  claim is read from the patch and therefore reads as absent until the commit
  exists.

## Arrival counters written onto held objects

Eighteen parked objects were matched by a survivor and had their arrival counter
written or incremented **onto the object itself**, not into this file. That is the
point: a count recorded only in a round-scoped artifact is a sentence the next
round re-derives from zero, which is how one subject reached its twenty-fifth
arrival still reading as new.

The heaviest: the subagent return gate at **26**, the code-graph benchmark rerun
at **72** (the most-recurring subject in the store), the mixed-trigger activation
cost at **20**, the executable-specification adapter at **17 (at least)**, batch
elicitation at **13 (at least)**, live trigger eval at **11 (at least)**.

## Honest limits of this round

- **Every recurrence count is a dated local reading.** `agents/tmp.old/` is
  gitignored, so a clone cannot reproduce any of them. The ordering is the
  finding, never the exact figure.
- **No network, on any slice.** Every claim the sources make *about* the external
  references they analysed is `unverifiable` here and was excluded from the
  ledgers rather than counted as verified. On several topics that is the largest
  single unverified block, and on `t09` and `t01` it is the half the owner's own
  turn asked for most emphatically.
- **Five topics stopped at the extraction cap, not at convergence** (named above).
- **Three topics discharged their anchors by class line rather than individually**
  (named above), so their `unaccounted 0` is a claim about the grouping.
- **The leak gate is blind to 80 % of one topic's subjects.** `t06` pattern-matched
  all ten of its subjects against every `deny` regex in
  `external_sources_denylist.json`: two hit, eight match nothing. The emitted
  roadmap `road-to-a-denylist-that-sees-every-subject` carries this; until it
  lands, the confidentiality assurance on that material rests on the opaque
  round-id discipline and on nothing automatic.
