# R2 completion review — evidence-based-adr-governance (round 2)
<!-- completion-review: v1 | reviewed: 2026-08-21 | scope: 9b4067df6a2433266fb4d1800d59bd56019e4b59278ad538b630fadadf21799d | diff: ae9dc4d45bbc78aff9914174d598b8e642345bb0 | reviewer: r2-fresh-subagent-evidence-based-adr-governance-round2 -->

<!-- context-manifest: v1
inputs:
  diff_sha: ae9dc4d45bbc78aff9914174d598b8e642345bb0
  scope_hash: 9b4067df6a2433266fb4d1800d59bd56019e4b59278ad538b630fadadf21799d
  roadmap: agents/roadmaps/road-to-evidence-based-adr-governance.md
  roadmap_hash: 800a9818d2d9b9d49a3aba039efd66f0b832e10b2de77b1d3fe18e48691ad9a3
  ac_hash: 8242b18b255db39bda653ae3500a284986007aa38a6e4976fdfb69048f710552
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-21T11:21:00Z
-->

Scope `9b4067df6a2433266fb4d1800d59bd56019e4b59278ad538b630fadadf21799d`, reviewed 2026-08-21.
Blind review: findings below were formed from the diff, the tree and executed probes only.

Verification actually run: `check_adr_frontmatter` (0 errors, 186 scanned) · `lint_provenance_vocabulary`
(11 at baseline) · `adr_cite_check ADR-239` · `adr/evidence_census --out <tmp>` (byte-identical to the
committed artifact) · `check_estate_count` · `check_claims` · `check_roadmap_trackable` ·
`lint_roadmap_blockers` · `lint_plan_risk_register` · `lint_roadmap_complexity` · `audit_adr_coverage` ·
`condense.sh --changed` (projection byte-exact) · `validate_frontmatter` (440 artefacts, 0 failing) ·
`typecheck-ts` + `eslint` on every changed `.ts` (clean) · the 7 changed test files (283 passed) ·
`routing_matrix.test.ts` + `rule_trigger_eval.test.ts` (207 passed). Two ad-hoc TypeScript probes
(malformed-axis acceptance, ADR-number collision) and four Python audits over the sweep table.

**Re-bound a fifth time — token baseline re-anchored.** `2ba1f6c6…` → `9b4067df…`,
for a 3-line change to `internal/bench/reports/token-baseline.json`. CI's second red
was `eager_rule_load: 118428 vs baseline 112694 (+5.1%)`, and the split was measured
rather than assumed: substituting main's version of the one always-loaded rule
projection this branch changes reports 117992 (+4.7%), so main alone had already spent
most of the 5% allowance and this branch's 436 tokens tipped it. Re-anchored itemised,
which is what main's own two most recent anchors did. Shrinking the prose to fit the
number was rejected on the sibling ratchet's own recorded convention, and extraction
had nowhere to land — both candidate targets are at their line caps.

**Re-bound a fourth time, second trunk merge (contract §2.7).** `b8cc9867…` →
`2ba1f6c6…`. main moved again while CI was running on this branch. Same measurement,
same answer: changed-file SET identical in both directions, whole content delta one
file (`estate-count-budget.json`, +24/-3 — the conflict resolution, main having walked
5/55/33 and this branch re-measuring +1/+2 on top for 6/55/35). And this time all four
manifest fields were checked before the commit, not three.

**`roadmap_hash` and `ac_hash` re-derived with it — and this is the step I missed.**
The manifest pins four inputs, not one: `scope_hash`, `diff_sha`, `roadmap_hash` and
`ac_hash`. All three re-binds above moved the scope and left the roadmap pair at the
round-2 values, while the fixes had edited the roadmap itself (AC-3, AC-6, 2.1's and
4.1's verify lines, blocker-lane row 5, the archive path). Locally
`check_completion_review` reported clean throughout, because it does NOT compare those
two — `dispatch_r2_reviewer --verify-current` does, and I ran it to READ the new scope
hash without re-running it afterwards to confirm the manifest. CI caught it:
`manifest mismatch (stale review): roadmap_hash, ac_hash diverged`.

Two green gates are not one green gate. The lesson is the re-bind checklist, not the
hashes: after editing the manifest, re-run `--verify-current` until it says verified,
rather than inferring it from the sibling check that happens to be cheaper to run.

**Re-bound a third time.** `deb847a3…` → `b8cc9867…`, for one path correction the merge
forced: the trunk archived `road-to-user-out-of-the-loop.md` mid-review and
`check_references` caught the now-broken citation. One line, in a roadmap note whose
cited fact (that roadmap names zero ADRs as blockers) is independent of where the file
lives. Recorded rather than folded into the merge re-bind above, because a re-bind that
quietly absorbs a later edit is how an artefact ends up bound to a scope nobody
measured.

**Re-bound a second time, after merging `origin/main` (contract §2.7).** `381b602e…`
→ `deb847a3…`. The scope is a merge-BASE diff, so it moves when the trunk moves even
with the branch untouched. Measured rather than asserted, because §2.1 forces a fresh
review on a CONTENT change and only a measurement separates the two: the changed-file
SET is identical (`comm -13` and `comm -23` over the pre- and post-merge scopes both
return nothing), and the whole content delta is one file —
`src/config/estate-count-budget.json`, +54/-5.

That file IS in scope, so this is stated as what it is rather than as "content
unchanged": the delta is the merge conflict's own resolution. `main` walked its estate
ratchet down from 9/55/41 to 6/55/33 during the review rounds, so the conflict was
resolved by taking main's 81-entry lineage whole and re-measuring this branch's delta
against it — `check_estate_count` reported `+1` active roadmap and `+2` open blockers,
which is exactly this branch's contribution, giving 7/55/35. No reviewable behaviour
changed: three integers and a `why` string in a budget ledger. A reviewer re-reading
the 21 findings against the new scope would read the same 48 files.

**Re-bound after the fix pass (contract §2.7).** The header `scope:`, the manifest
`scope_hash` and the prose line all moved from `7b8979d2…` to `381b602e…`; `diff:`
and `reviewer:` are unchanged, because they record WHEN the review ran and a
re-bind does not re-run it. This is the normal case: the 21 fixes changed the
reviewed content, so an artefact still bound to the pre-fix scope would read as
the live review of content that no longer exists. Renaming it aside instead would
leave the shipping content with no review at all.

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/scripts/check_adr_frontmatter.ts:352,382 | A malformed `provenance:` / `evidence:` written as an inline list is accepted with ZERO findings. The guard is `if (fm.scalars['provenance'] !== undefined && provenance === null)`, but the shared reader routes `provenance: [human]` into `nested` (an array), so `scalars` is undefined, `provenanceOf` returns null via its `Array.isArray` branch, and no branch fires. Probed directly: `provenance: [human]` + `evidence: [E9]` on an otherwise valid accepted record → `findings: 0`. Every downstream consumer then reads the axis as ABSENT — the exact silent-absence failure `regenerate_index.fm`'s new docstring says the extraction exists to prevent. The list shape is a plausible authoring slip because `protected_dimensions: [purpose]` in the same frontmatter block uses it. Test coverage stops at the scalar case (`adr_frontmatter.test.ts:284`). | fixed | fb8cc36bcd1d — `axisPresent()` reads both maps. Two tests, sabotage-verified: restoring the scalars-only guard reds both. The list shape is now rejected with a message naming both illegal shapes. |
| 2 | high | docs/decisions/adr-evidence-sweep-2026-08.md:158-165,422 | Coverage bookkeeping is wrong about the same two records, in two places and in opposite directions. ADR-239 DOES carry a full 11-column tranche row at `:204` with disposition `KEEP (as proposed)` — yet § "Records with no tranche row" lists it as having none, and § Coverage states "**The one record with no tranche row is ADR-239**". The record actually without a row is ADR-238. Verified by an escape-aware split of every table row: 165 flat + 13 anchors + 7 per-area = 185, and the single uncovered id is 238. AC-2 was re-worded precisely to fix a coverage miscount and the replacement text miscounts in the other direction. | fixed | fb8cc36bcd1d — both sites corrected — § "Records with no tranche row" lists ADR-238 alone, § Coverage names ADR-238, and ADR-239 is stated as carrying a tranche row added when its disposition was settled. Third revision of this paragraph; re-derived mechanically, which is why the inversion was caught rather than compounded. |
| 3 | high | docs/decisions/adr-evidence-sweep-2026-08.md:59-72 | The 13 anchor records are counted as "covered" by § Coverage, but the anchor table's columns are `ADR \| Provenance \| Strength \| Discovery \| Why this grade` — no `Disposition`, no `Blocking cost`, no `Current?` and no `Basis refs`. ADR-046, ADR-047, ADR-106, ADR-128 and ADR-229 each occur exactly ONCE in the whole artifact, in that row. AC-2 requires one disposition per record with basis refs, a `Blocking cost` that is sourced-or-`unknown`, and the would-we-accept-it-today answer; 13 of 186 records carry none of the four. Roadmap steps 4.3 / 4.4, which would dispose several of them, are `[ ]`. | fixed | fb8cc36bcd1d — the anchor table now carries Current? / Blocking cost / Disposition / Basis refs for all 13. Two verdicts changed on the per-record read (ADR-208 REVIEW-NOW — its own trigger (c) has fired at 5 MB vs a measured 7.805 MB; ADR-001 indefinite by construction, P4.1 cancelled). 2 cells `unknown` with the reason in the cell, 0 `none`. § Coverage now separates graded from dispositioned. Your "five records mentioned once" is six — ADR-208 was missing. |
| 4 | high | src/scripts/check_adr_frontmatter.ts:281-292 | AC-5's first clause has no mechanism. The docstring states plainly that "a fresh record with no `provenance`, no `evidence` and no `## Evidence` section passes every gate in this tree", and a grep for an `## Evidence`-section requirement across `src/scripts/**` returns that comment and nothing else. `check_descriptive_axes` validates only the SHAPE of an axis that is present. So "a newly added accepted ADR cannot pass CI without an Evidence section" is unenforced; only the `review_trigger` and permanence halves of AC-5 hold. Self-documented rather than hidden, and the stated blocker (a single-file linter has no notion of NEW) is real — but the criterion is not met. | fixed | fb8cc36bcd1d — `check_new_adr_evidence` is the two-ref diff your finding named as buildable-and-not-built: added + accepted records require provenance, evidence and an `## Evidence` heading with fences stripped; `owner_intent` buys no exemption. 7-case `--self-test` (4 rejecting) because zero added records is the state where a working and a broken gate print identically. Deliberately unregistered in gate-coverage.yml — `min_scanned: 0` is the shape that file rejects and two diff-scoped neighbours were excluded for it. |
| 5 | medium | src/scripts/check_adr_frontmatter.ts:778 | `check(dir)` is not hermetic. It honours `dir` for the flat tree but calls `listPerAreaRecords()` with no argument, so the per-area half always reads the real `REPO_ROOT/docs/adrs`. Any call with a temp dir silently mixes the live corpus into `findings`, into `corpus` (both reciprocal-link checks) and into the `assertScanned` denominator — so a moved or emptied `docs/decisions` can never trip `DeadScopeError`, which is the one thing that assertion exists for. `listPerAreaRecords`'s `root` parameter has no caller anywhere. | fixed | fb8cc36bcd1d — `listPerAreaRecords(path.resolve(dir, "..", ".."))` — the parameter existed and had no caller. This is the half that mattered: with the live corpus always contributing, `DeadScopeError` could never fire. |
| 6 | medium | src/scripts/check_adr_frontmatter.ts:667,690 | ADR-number collision across the two surfaces. `adr_number('0001')` returns `'1'`, and `check()` pushes flat records into `corpus` first and per-area last, so `byNumber.set` lets `docs/adrs/telegraph/0001` shadow flat ADR-001 (and `0002` shadow ADR-002) in both `check_amendment_links` and `check_supersession_links`. Probed with a 3-record corpus: `supersedes: ADR-001` reports "docs/adrs/telegraph/0001-default-off-until-bench.md carries no reciprocal `superseded_by`" — the wrong file. The inverse is worse: a per-area reciprocal would mask a genuinely broken flat link as fine. Latent only because no record currently cites ADR-001/002; introduced by folding per-area records into the shared corpus in this change. | fixed | fb8cc36bcd1d — the number index is flat-only. Wider than reported: SIX of seven per-area records carry `adr: 0001`, so one Map kept one of seven. Two tests; the second carries the sensitivity and the first is marked as NOT carrying it rather than counted as coverage. |
| 7 | medium | src/scripts/adr/evidence_census.ts:404-435 | `proposeStrength` falls through to the rationale "no evidence marker found" whenever the non-council marker set matches no rule — `repeated` alone, `owner` alone. `councilOnly` requires `graded.length === 0`, so a record with one non-council marker that no rule consumes gets the no-markers-at-all message. 12 of the 186 rows in the shipped artifact therefore print `E0 — no evidence marker found` beside a Matched-markers cell that lists markers (ADR-032, 056, 085, 093, 101, 104, 108, 111 and four more). Each such row contradicts itself, and the rationale is the reviewer's entry point for auditing the proposal. | fixed | fb8cc36bcd1d — a distinct rationale for "markers present, none graded", naming the classes and why no rule reads them. All 12 rows now agree with their Matched-markers cell; grade distribution unchanged. |
| 8 | medium | src/scripts/adr/evidence_census.ts | The census is wired into nothing: no `.github/workflows/**` step, no `Taskfile.yml` / `taskfiles/**` target, no `gate-coverage.yml` row and no stated exemption — contrast `adr_cite_check`, which got a workflow step, `task check-adr-citations` AND a long documented reason for its non-registration in the same change. So the committed 186-row artifact that AC-2 and AC-3 rest on can drift from the corpus with no signal, and the script's `GateLedger` + `assertScanned` instrumentation never executes. (It IS reproducible today — regenerated output is byte-identical — which is exactly the property that will rot unobserved.) | fixed | fb8cc36bcd1d — `task check-adr-evidence-census` + a `rule-backstops.yml` step regenerate and diff against the committed artifact. Inlined shell, not `task`, because no step in that workflow installs the binary. No gate-coverage row (prefix mismatch would red `gate_population`), with the loss recorded where the row would have gone. |
| 9 | medium | agents/roadmaps/road-to-evidence-based-adr-governance.md:443-446 | Step 2.1 is `[x]` with `verify: runs over all 177 flat + 7 per-area records and emits scanned: 184`. The tool emits `scanned: 186` over 179 flat + 7 per-area. A closed step's verification criterion does not match the shipped output, and the same 184 figure is the number AC-2's own note says was replaced because a bare count is falsified by the trunk moving. | fixed | fb8cc36bcd1d — the verify no longer names a bare count — it names the derivation (every flat record plus the 7 per-area, `scanned:` equal to that count at the run head, 179 + 7 = 186 today) and records why a fixed number was the wrong criterion. |
| 10 | medium | agents/roadmaps/road-to-evidence-based-adr-governance.md:648,664-672 | The roadmap and its own sweep artifact contradict each other on blocker-lane row 5. The lane table still asserts "**(c) fails one subcheck**: `release-install-e2e` exists … but is not named in `branch-protection-policy.md`'s release-PR row", and step 4.1 is `[x]` with `verify: … the branch-protection-policy.md diff merged`. The sweep at `:616-623` adjudicates (c) MET — the policy names the CHECK NAME `Release install E2E (pack → install → upgrade → boot)` at `branch-protection-policy.md:75`, which I confirmed — and no such diff exists (that file is not in the branch's changed set and needed no change). The substance is right; the closed step's verify line and the lane row both describe work that was correctly found unnecessary. | fixed | fb8cc36bcd1d — lane row 5 now records (c) as MET — the policy names the check at `:75` — and 4.1s verify no longer demands a diff that correctly does not exist. |
| 11 | medium | src/config/estate-count-budget.json | The newest `baseline_history` entry's `why` ends "ALSO RAISED active_roadmaps 12 -> 13 … **13** is the measured trunk-plus-this-change value and is now the number that must walk down", while that entry's own `active_roadmaps` field and `baseline.active_roadmaps` are both **10**. `check_estate_count` reports `active_roadmaps 10 (baseline 10, +0)` and prints this same `why` as the recorded reason for the raise. A ratchet ledger whose entire value is that the number can be checked against its stated reason is shipping a reason that names a different number. | fixed | fb8cc36bcd1d — the `why` now reads 9 -> 10 and names the leftover: the 12 -> 13 pair predated the trunk walking down to 9. |
| 12 | medium | src/rules/decision-revisit-gate.md:82-90 | "Step 2 reads … effective state → provenance → evidence strength → discovery → **current evidence (does the basis still resolve in a clone?)** → reversibility of the proposed transition → **reserved dimensions**. `adr_cite_check` prints all seven." It prints four. `CiteResult` has no field for `evidence.basis` at all, and `render()` never emits `reopen_policy` or `protected_dimensions`; reversibility is a property of the proposal, not the record. Confirmed on `adr_cite_check ADR-239`, whose four `basis:` refs and `protected_dimensions: [governance]` are both absent from the output. An agent following the rule cannot perform reads 5 and 7 from the tool the rule points it at. | fixed | fb8cc36bcd1d — the tool gained `evidence_basis` (path refs marked `[found]`/`[MISSING]`; URLs and `claim:` ids never resolved), `reopen_policy` with a defaulted flag, and `protected dims` — sabotage-verified per field. The rule now claims six and names reversibility as the agent read, because it is a property of the proposed transition. Detail lives in the script docstring: the rule is 2 lines under its 200-line cap and its routing skill 1 line under 400, so neither had room. |
| 13 | low | src/scripts/adr_cite_check.ts:37 | The module docstring still says the notice is printed "for an accepted + **agentic** + E0/E1 record". `isLowEvidenceAccepted` no longer reads provenance, and line 168 of this same file explicitly records that this wording was "caught in completion review" and corrected — one occurrence was fixed and the header one left, 130 lines apart. | fixed | fb8cc36bcd1d — header corrected, plus the sibling search your finding implies: exact construct `accepted + agentic`, 8 matches, 4 live, 2 fixed (header + two test names), 2 correctly left (a deliberate quote of the old wording inside the correction record, and a frozen review input). |
| 14 | low | src/scripts/adr_cite_check.ts:127-129,454 | `PARTIAL_COVERAGE` is emitted into machine output as `partial_coverage` (`:673`), and its only element is now prose saying there IS no partial coverage plus "remove on the next pass" — a TODO shipped inside a machine-readable field whose name asserts the opposite of its content. The comment at `:454` still describes a per-area record's frontmatter as absent ("quote-block header, see PARTIAL_COVERAGE"), which this change made false. | fixed | fb8cc36bcd1d — empty list, KEY kept — `--json` publishes `partial_coverage` and dropping the key breaks consumers. `:454` and one pointer my own earlier change orphaned both corrected. |
| 15 | low | src/scripts/adr/regenerate_index.ts:42 | `_stripChars` lost its only call site when `fm()` was rewritten to delegate to the shared reader, and the function was left in place — an own-orphan this diff created. Neither `tsc` nor `eslint` flags it (the `_` prefix exempts it). | fixed | fb8cc36bcd1d — deleted. Grepped first: 8 other `_stripChars` definitions exist, all with live call sites; this was the only orphan. |
| 16 | low | src/scripts/audit_adr_coverage.ts:155-161 | `parse_fm`'s new docstring claims "the `{}`-on-absent return and the quote/space stripping are the pinned part of the contract and **are preserved**". The stripping is not preserved: the removed `_stripChars(v, ' "\'')` stripped repeated and unbalanced quote characters from both ends (Python `str.strip`), while the shared reader's `stripQuotes` is `/^["'](.*)["']$/` — one balanced pair only. `key: "value` and `key: ''v''` now yield different values. No corpus record exercises it today, so this is a false preservation claim rather than a live break. | fixed | fb8cc36bcd1d — docstring split into what IS preserved and what changed, naming the two inputs that now differ (`key: "value`, `key: ''v''`) and that no corpus record exercises either. Old behaviour deliberately not restored. A test pins both so the claim cannot drift back to parity. |
| 17 | low | docs/decisions/adr-evidence-sweep-2026-08.md:383 | ADR-029's tranche row carries unescaped pipes inside a backtick span (`` `bench\|evals\|workers` ``), splitting the row into 13 cells against an 11-column header. Rendered, that record's `Disposition` and `Basis refs` land in the wrong columns. It is the only such row — an escape-aware audit of all 196 eleven-column rows found this one; the two other suspicious rows (ADR-016 `:185`, ADR-057 `:329`) escape their pipes correctly. | fixed | fb8cc36bcd1d — escaped. The escape-aware audit over all rows now returns a clean histogram: 205 eleven-column, 15 nine-column (the widened anchor table), 9 three-column, 5 five-column. |
| 18 | low | src/skills/adr-create/SKILL.md | "existing per-area records carry it alone, which is why every field in their generated README table renders `—`". This change gave all seven per-area records real frontmatter AND added `parse_blockquote_meta` as a fallback, so the claim is false in two independent ways: `docs/adrs/telegraph/README.md:9-10` renders `accepted` / `2026-05-16`. Stale guidance in the skill that authors will follow. | fixed | fb8cc36bcd1d — the claim is gone; the skill now cites `docs/adrs/telegraph/README.md` rendering real values and names `parse_blockquote_meta` as the fallback. |
| 19 | low | src/scripts/adr/evidence_census.ts:120-135,404-414 | The artifact published to `agents/evidence/analysis/` states the grades "are biased LOW on purpose", but `claim` and `external_standard` short-circuit to E3 — the second-highest grade — on a bare textual match, ahead of every other rule, and `EXTERNAL_STANDARD_RE` includes a plain `\bGDPR\b`. Checkable instance: the census proposes `E3 — cites a named external standard` for ADR-107, and the tranche reviewer adjudicated **E2** (`sweep:225`). Direction of the documented bias is not what the code does on these two classes. | fixed | fb8cc36bcd1d — the artifact and docstring now name which classes are biased low and which two are biased HIGH by construction, with ADR-107 (census E3, adjudicated E2) as the worked example. No grading rule changed. |
| 20 | low | docs/decisions/adr-evidence-sweep-2026-08.md:436-441,445-449 | AC-3 is partly unmet on its own numbers, both stated honestly in the artifact. (a) "≥10 % blinded overlap was graded twice": 17 records were assigned, **16 came back doubled**, over 173 non-anchor records — 9.2 %. (b) "an externally adjudicated anchor sample exists": the artifact records the anchor set's ADR-104 provenance error as having been "adjudicated by the party that wrote the schema", and `claim:adr-grade-accuracy-vs-gold` stays `unbacked` with the note that it "needs an externally adjudicated gold sample". The published-disagreement clause of AC-3 IS met (3 disagreements, adjudicated in-table). | fixed | fb8cc36bcd1d — AC-3 now states both unmet clauses on their own numbers, and the sweep section carries the 9.2 % arithmetic. Left open rather than re-scoped to fit the number that came out — clearing it needs a second blind grader, which is the same independence the overlap exists to measure. |
| 21 | low | agents/roadmaps/road-to-evidence-based-adr-governance.md:447 | AC-6's first clause is unmet: `adr:effective` ships nowhere — a grep across `Taskfile.yml`, `taskfiles/`, `src/`, `docs/` and `.github/` for `adr:effective` / `adr-effective` returns zero hits, and step 2.2 is `[ ]`. The other two AC-6 clauses ARE met and verified: `adr-layout.md`'s stale ADR-035 assertion is corrected in place (`:435-437`), and `adr_cite_check --cited` runs in `rule-backstops.yml` plus `task check-adr-citations` wired from `Taskfile.yml:117`. | fixed | fb8cc36bcd1d — AC-6 separates its two met clauses from the one gated on unstarted step 2.2, and says the verb ships nowhere. |

## What was checked and found sound

- **AC-7 holds.** No fixture, rule path or tool output lets a grade authorize anything: `isLowEvidenceAccepted`
  only gates a printed `authority_effect: disabled-shadow-mode` string, the rule text refuses the coupling
  explicitly, the two `grade-as-permission` routing cases pin the refusal positively, ADR-239 is
  `status: proposed`, and Phase 7 is `[~]`/unstarted.
- **AC-8 holds.** `adr-grade-accuracy-vs-gold`, `adr-evidence-discovery-recall`, `adr-beneficiary-grade-bias`
  and `adr-interruption-baseline` are all in `docs/CLAIMS.md` with metric, threshold, power floor,
  falsification conditions and an honest-null path; `check_claims` green.
- **AC-9 holds.** No ADR frontmatter backfill (`provenance`/`evidence` appear only on ADR-239 and on nothing
  else in `docs/decisions/`), ADR-239 is not accepted, `0B`-gated step 4.2 is `[~]`, and no Safety, Privacy,
  Legal or External-commitment floor is touched.
- **Projection integrity.** `condense.sh --changed` reports every `.md` projection byte-exact against `src/`.
- **Reproducibility.** Re-running the census produces a byte-identical artifact.
- **Corpus-equivalence discipline.** The shared reader's `consumeFolded` colon-hazard fix and the
  `>-`-strip parity tests are the right shape and are covered by real-corpus tests, not fixtures alone.

## Round-1 cross-check (read only after the findings above were formed)

Round 1's closed record marks 20 of 23 rows `fixed`. Two of those fixes were verified as landed here
(`gate-coverage.yml` re-derivation now reproduces — `grep -c '^  - id:'` returns 42, matching the note;
`generate_router_coverage_from_matrix --check` reports the derived corpus fresh at 305 prompts). Three
`fixed` rows do not hold as claimed, and each is already a row above rather than a new number:

- **Round-1 #4 (high, `fixed`) is not fixed — it inverted.** The disposition says the sweep now "names both
  uncovered records — ADR-239 with its disposition, ADR-238 as an explicit REVIEW-NOW gap". ADR-239 is not
  an uncovered record: it carries a full 11-column tranche row at `sweep:204`. So § "Records with no tranche
  row" now lists a record that HAS one, and § Coverage (`:422`) states "the one record with no tranche row is
  ADR-239" — dropping ADR-238, the only record that genuinely has none. See row 2. The class round 1 caught
  (a coverage claim that does not match the corpus) is still live, pointing the other way.
- **Round-1 #16 (medium, `fixed`) was fixed at one of two sites.** The `CiteResult.authority_effect`
  docstring was corrected, and the module docstring 130 lines above it (`adr_cite_check.ts:37`) still says
  "for an accepted + **agentic** + E0/E1 record". See row 13. A defect found in one place was not searched
  for in the file it was found in.
- **Round-1 #7 (medium, `fixed`) is partly fixed.** `PARTIAL_COVERAGE` no longer asserts empty metadata, but
  its replacement is a "remove on the next pass" TODO inside a field published as `partial_coverage` in
  `--json`, and the sibling comment at `:454` still describes a per-area record's frontmatter as absent.
  See row 14.

Two further observations about the round-1 fixes rather than about their claims:

- **Round-1 #1's fix (per-area records folded into `check_adr_frontmatter`) is effective and introduced two
  new defects** — the non-hermetic `check(dir)` (row 5) and the flat-versus-per-area ADR-number collision in
  both reciprocal-link checks (row 6). Neither is a reason to revert the fix; both are consequences of it.
- **Round-1 #3's defect class recurred.** It caught four `[x]` steps whose own `verify:` line was unmet and
  un-ticked one. Two more are live: step 2.1 (`scanned: 184` against an actual 186 — row 9) and step 4.1
  (a `branch-protection-policy.md` diff that does not exist and was correctly found unnecessary — row 10).
  Fixing the named instances did not close the population.

## Provenance note — the tree moved under this review

Row 1 was probed and written against the reviewed scope. Fourteen seconds after this artefact was first
written (13:49:02), a session other than this reviewer modified `src/scripts/check_adr_frontmatter.ts`
(13:49:16) and `tests/scripts/check_adr_frontmatter.test.ts` in the working tree, adding an `axisPresent`
helper that reads key presence from BOTH `scalars` and `nested` — which closes row 1 exactly, and whose
comment quotes this review's probe verbatim.

Recorded rather than absorbed, in both directions. Row 1 stands as a finding against the scope it is bound
to: `git show HEAD:src/scripts/check_adr_frontmatter.ts` still carries the scalars-only guard, so the defect
is real in the reviewed content and the fix is uncommitted work outside it. And row 1 is not this reviewer's
own edit: the reviewer wrote no code and touched no file but this one. Re-running the same probe against the
live working tree now returns 2 findings where it returned 0 against HEAD, which is the fix working.

The same session has since begun editing `src/scripts/adr/evidence_census.ts` and
`src/scripts/adr_cite_check.ts` as well (rows 7, 13, 14 territory). Every one of those files is left
exactly as that session left it — not reverted, not committed, not staged. A reader comparing a row
against the live working tree rather than against `HEAD` may therefore find it already closed; the
binding artefact for every row above is the scope hash in the header, not the working tree.
