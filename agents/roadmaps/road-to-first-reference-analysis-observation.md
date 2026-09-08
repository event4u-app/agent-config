---
complexity: lightweight
status: draft
parent_roadmap: road-to-bounded-reference-harvest-loop
execution:
  mode: phase-checkpoints
estate_growth_exempt: "Receiver for two steps carried out of road-to-bounded-reference-harvest-loop, which is archived in the same change — the active count is unchanged by the pair."
---
# Road to the first reference-analysis observation

> **Source:** carried out of
> [`road-to-bounded-reference-harvest-loop`](road-to-bounded-reference-harvest-loop.md)
> steps 5.2 and 5.3 on 2026-09-07, by AI-council decision on a split verdict.
> Council record: `agents/evidence/council/bounded-harvest-observation-slot.md`
> (2 seats, anthropic + openai, subscription transport, $0.0000).

## Goal

Spend exactly one of the two remaining observation slots of the pre-registered
claim `reference-loop-upgrade-value` (`docs/CLAIMS.md:487`) on a valid,
atomic upgraded-plus-shadow analysis pair, and write the outcome into the claim
row honestly. Done when: both arms have run against one pinned reference at one
pinned revision under the frozen protocol below, and the claim row records
either "observation 1/2 passed" or the pre-registered null with its bound
reversions — with no goalpost moved after the data.

## Why this is carried rather than done

The parent roadmap built the scaffolding (Phases 1-4: one analysis engine, a
bounded three-lens loop, opaque local-only artefacts, deterministic discovery
and a harvester). It did **not** clear the trust boundary the run needs.

The council was asked whether an autonomous lane may execute the run now, and
**split**: one seat recommended deferral, one authorized exactly one slot
subject to a readiness protocol. A split is an escalation condition, not a
verdict, so the disposition adopted is the intersection neither seat calls
unauthorized — **do the readiness work, defer the measured run**. The seat that
authorized execution states the deferral path itself ("if any prerequisite
fails, stop without running the measured analysis and defer"), so deferral sits
inside both seats' authorized sets while execute-now sits inside only one.

Unanimous across both seats, and therefore binding here:

1. The parent's step 5.3 premise is **false as written**. Phase 3 resolved the
   raw-named-evidence trust boundary; the **outbound third-party fetch boundary
   is untouched** by Phases 3 and 4. A fetch is still a fetch.
2. `agents/roadmaps/stubs/road-to-first-reference-analysis-run.md` may **not**
   be disposed of on the ground that Phases 3-4 resolved its two boundaries,
   because one survives. It stays, cross-referenced to this roadmap.
3. Until a valid run completes, the claim row keeps `status: unbacked` and an
   **empty** `last_verified`. Dating a partial observation would read as
   verification.
4. An upgraded-only run is **not** an acceptable substitute — it cannot answer
   the pre-registered comparison and must not consume a slot.
5. Both arms are **one atomic observation**. Neither arm alone consumes a slot;
   an invalid or incomplete run consumes none and is recorded outside the claim.

## Exactly what is carried here

Seven checkboxes from the parent, and nothing else. Each is carried because its
own `verify:` names an **observation of a run**, not a state of the tree — the
contract text every one of them describes is written, shipped and pinned by
`tests/scripts/analyze_repo_limits.test.ts`.

| Parent item | What is already done there | What this roadmap owes |
|---|---|---|
| step 2.2 | § 2a pins the revision once; `--deep` defaults under the loop; the read-ceiling line is required | a run's iteration record showing one revision repeated on every pass |
| step 2.3 | § 5b's three lenses, the per-loop delta block, the never-omit-a-zero rule | a run with three loops writing three delta blocks |
| step 5.2 | the readiness protocol below | the atomic upgraded-plus-shadow pair |
| step 5.3 | the boundary finding, recorded | the claim-row write and the stub disposal |
| AC-3 | contract + skeleton + never-omit rule | what a run leaves behind |
| AC-4 | `check_no_external_sources` green; the filename rule mechanically enforced | the `git status --porcelain` check after a full run |
| AC-8 | — (deliberately unwritten, see point 3 above) | the claim row and the stub |

Steps 1.4 (the pair), 1.3 (the `git status` check) and 1.5-1.6 (the claim row
and the stub) are where each lands.

## Frozen protocol — established 2026-09-07, before any arm runs

The shadow arm is pinned and reproducible. Recorded here so that a later run
cannot silently substitute a different text:

| Field | Value |
|---|---|
| Shadow base commit | `537e7c86e7646d50bf10d8b3e7ec8655239bceab` |
| Shadow blob id | `b2ea4fa61d4c8fa1ec737cad95699bd5d8be4a7f` |
| Shadow content sha256 | `6ea179291c79a96108d17faea27ecbbffed2f9a74d0d07236157d05bc68134ba` |
| Shadow size | 361 lines · 15466 bytes |
| Shadow path at that commit | `src/domains/analysis-workbench/analyze/reference-repo/command.md` <!-- ref-ignore --> (the pre-rename path; it exists at that commit and deliberately not at HEAD) |

Recover it with:

```bash
git show 537e7c86e7646d50bf10d8b3e7ec8655239bceab:src/domains/analysis-workbench/analyze/reference-repo/command.md
```

**Pin verified 2026-09-07, offline.** All four fields reproduce in a checkout of
this branch, so reopening-trigger condition 1 below is satisfied and needs no
network: `git rev-parse` on that path at that commit returns blob
`b2ea4fa61d4c8fa1ec737cad95699bd5d8be4a7f`, and the extracted text measures 361
lines / 15466 bytes with sha256
`6ea179291c79a96108d17faea27ecbbffed2f9a74d0d07236157d05bc68134ba`. Condition 1
is therefore the only one of the three that is currently observable; 2 and 3
both require the outbound fetch.

The 361-line figure independently corroborates the pin: the parent roadmap cited
"361 lines" for the pre-upgrade command when it was authored, against a tree it
verified at `93d63073e`.

> **REFUTED 2026-09-08 — this pin is a POST-upgrade text, and the corroboration
> above is why nobody noticed.** The paragraph is left standing rather than
> rewritten: it is the record of how the error survived, and deleting it would
> delete the evidence. The pin itself is NOT amended here — see
> § Blockers → `shadow-pin-is-post-upgrade` for the diagnostic, the correct
> coordinates, and why re-pinning is not this lane's call.
>
> The upgrade commit is `5bee62a5828ba6d3cf38a7d5d685004716d8addf` (2026-08-12,
> *"anchor-first direction, claim gate, interop probe and bounded --deep"*), and
> `git merge-base --is-ancestor 5bee62a58 537e7c86e` returns **true**: the
> pinned shadow post-dates the upgrade by almost a month. All five mechanisms the
> claim says were folded in are present in the pinned text — `### 1b. Anchor
> table first`, `### 2b. Deep verification tier`, `### 3b. Interop probe`,
> `### 5b. Converge the verdict table`, and the bound-claim collision gate inside
> § 5.
>
> `93d63073e` (2026-09-05) is ALSO post-upgrade, which is the whole mechanism of
> the error: 361 lines was measured twice, against two trees that both already
> carried the upgrade, and two measurements of the same wrong thing agreeing
> reads exactly like verification. A corroboration that shares the defect it is
> meant to catch confirms nothing.

## Frozen counting rules — established 2026-09-07, before either arm runs

Written while **no arm has been invoked and no arm output exists**, so nothing
here was tuned to data. They resolve the three scoring questions step 1.2 names,
and one defect found while resolving them. The bar itself is untouched: it stays
verbatim as `docs/CLAIMS.md:488` states it, and these rules only decide how an
arm's output is read against that bar.

### R1 — an interop-probe finding at `file:line` precision

Counts as **one positive** only when a single row of the § 3b table
(`src/domains/analysis-workbench/analyze/repo/command.md:220`) carries all four
of:

1. a named consumable artifact on the reference side (index, graph, manifest,
   lockfile, generated config) — not a capability described in prose;
2. **our** consumer named as `path:line`, in this repository, resolving at the
   analysis commit. `src/scripts/foo.ts` without a line is not `file:line`;
   "our validator" is explicitly ruled out at `:216`;
3. a `discovered?` and a `validates?` verdict, both filled;
4. either the exact failing axes, or the probe's own error text if it crashed —
   `:222` makes "incompatible" without the axes a non-finding and a crash a
   result rather than an empty row.

A row missing any of the four is scored **zero**, not partial. Two rows about
the same artifact and the same consumer are one positive; the bar counts
findings, not table lines.

### R2 — a bound-claim routing

Counts as **one positive** when an ADOPT/ADAPT row (a) extracts a concrete
surface identifier — file path, config key, schema field, settings key — (b)
cites the id of a `docs/CLAIMS.md` entry it collides with, and (c) states one of
the two dispositions the § 5 bound-claim gate allows at `:260-262`: it routes through that
claim's own reopen or amendment clause and says so, or it is reclassified
REJECT. A row that cites a claim id and states neither disposition is zero.

**A shared topic word is not a collision** (`:262`). The match is on the
identifier, so a row mentioning "skills" does not collide with every claim whose
prose contains the word.

**Defect found while freezing this rule, and repaired in the same change.** The
gate used to say: match the identifier against "the `consequence` field of every
`docs/CLAIMS.md` entry". **The ledger has no `consequence` field.** Its entry
schema is fixed at `docs/CLAIMS.md:56-66` — `claim`, `kind`, `evidence`,
`status`, `last_verified`, `retired_by`, `superseded_by`, `non_inference`,
`retires_phrasings` — and `grep -c '^- consequence:' docs/CLAIMS.md` returned 0.
Followed literally, a bound-claim routing could never be produced and the bar at
`docs/CLAIMS.md:488` would fail for a reason having nothing to do with the
mechanism's value: a probe looking for a field that does not exist finds nothing
and reports no collision, on every row, forever.

The repair names the fields that do exist — `claim` and `non_inference`, which
is where surface identifiers actually appear in this ledger — at
`src/domains/analysis-workbench/analyze/repo/command.md:255-260`.

**Why repairing it now is not goalpost-moving, stated because the objection is
fair.** The upgraded arm is HEAD's command text, so editing that text does move
the artifact under measurement. There is exactly one window in which that is
safe and this is it: **no arm has run**, so no data exists for the edit to have
been fitted to, and the pre-registered bar at `docs/CLAIMS.md:488` is untouched
— still `>= 1` interop-probe finding and `>= 1` bound-claim routing on each of
two analyses. The unsafe windows are between the two arms and after either arm's
output is read; both stay forbidden. If the ordering is ever disputed, the
commit that carries this repair carries the roadmap edit that records it, and
neither predates the other.

### R3 — `consumer not locatable`

Scored as an **honest result and not a positive**, which is the claim's own
falsification criterion 2 at `docs/CLAIMS.md:490` and is restated here only so a
later reader does not have to re-derive it. A probe that records it is not a
skip and must appear in the table (`:217-218`); it simply contributes zero to
the bar. An arm whose every probe records `consumer not locatable` has produced
a valid run and zero interop-probe findings — which fails the bar rather than
invalidating the observation.

### What these rules deliberately do not do

They fix no threshold, because the claim already fixes it: `>= 1` of each, on
**both** analyses. They say nothing about the shadow arm's scoring — the shadow
command has no interop probe and no bound-claim gate, so its count is zero by
construction and the comparison is a document diff (criterion 1 at `:490`), not
two scores. And they are frozen: an edit to any of R1-R3 after either arm's
output is read voids the observation under step 1.2's own verify.

### What this freezing produced besides the rules

- **One defect in shipped command text, found and fixed:** the bound-claim gate
  pointed at a `consequence` field the claims ledger has never had. See R2 for
  the repair and for why the pre-arm window is the only safe one to land it in.
  Sibling search, per the defect-pattern discipline, with the count reported
  rather than implied: `grep -rn consequence src/domains/ src/skills/` returns
  **37 lines across 24 files** at this commit, and **0** of them instruct a
  match against a named `docs/CLAIMS.md` field — the two `src/domains/` hits are
  `analyze/roadmap-repos/command.md:103` ("accepted consequence") and
  `FIRST_WIN.md:39` (a memory-record field list), and the rest are ordinary
  prose. One instance, not a population.

## Run-specific fetch authorization — AI council, 2026-09-07, GRANTED

Step 1.6 names the opener for this roadmap's one blocker: "the fetch boundary
was resolved by a **run-specific council authorization**, never structurally by
Phases 3-4". This section is that authorization, recorded before any arm runs.

**Verdict: (c) — rungs 1.1, 1.3 and 1.4 are authorized.** Two seats (anthropic,
openai), subscription transport, $0.0000, deep tier, unanimous on the rung and
convergent on the conditions.

**Why the earlier split does not stand.** The first round split because the
readiness protocol was not in place; that gap is closed. Step 1.2's three
counting rules are frozen and dated **before any arm ran**, which is verifiable
rather than asserted — no artefact directory exists under
`agents/.harvest-local/`, no reference is pinned, and 1.4 is unstarted. The
second round was also given a fact the first did not have: the bound-claim gate
instructed matching against a `docs/CLAIMS.md` `consequence` field that **does
not exist** (schema at `:56-66`; `grep -c '^- consequence:'` returns 0), so the
pre-registered bar's "≥ 1 bound-claim routing" half would have failed for a
reason unrelated to what it measures. Deferring again would have deferred on a
premise that no longer holds.

### The conditions — all of them, in the order they gate

Each is checkable before acting. None is caution.

1. **Freeze this protocol as a dated version before 1.1 pins anything.** The
   frozen set is complete only when all six elements are present: the counting
   rules (§ Frozen counting rules), the size envelope (2), the validity
   criteria (5), the confidentiality rules (4), the ceiling mechanism (3), and
   an amendment record. Missing any one = the freeze is incomplete and 1.1 does
   not start. **This section plus the two Frozen sections above ARE that
   version; its amendment record is the `consequence`-field repair recorded in
   1.2, landed in the pre-arm window and nowhere else.**
2. **Size is workload, never storage.** The reference must be under **2,000
   files and 10 MiB of analyzable text**. Both seats rejected a storage-based
   envelope (`< 5,000 files / < 100 MB`) as measuring the wrong thing: the
   constraint exists so the upgraded arm's `--deep` tier and the shadow arm's
   40-fetch ceiling both complete **without an extension request**, and an
   extension request is what makes the arms incomparable.
3. **The fetch ceiling is instrumented BEFORE 1.4, never retrofitted after.**
   Wrap the shadow command in a counted fetch proxy or a `GIT_TRACE` monitor
   that aborts at fetch 41. "Enforce mechanically" is not satisfied by counting
   afterwards — the mechanism must exist before the arm is invoked.
4. **Confidentiality, and a concrete test rather than a principle.** The tracked
   tree carries **no repository name, no URL, no commit SHA, no distinctive
   path, and not the opaque-ID mapping**. Before 1.4 runs, execute the test:
   *given the opaque id and the recorded aggregate counts, can a motivated
   reader derive the repository?* If yes → abort, record the diagnostic, return
   to 1.1. Note this is **stricter than the shadow pin above**, which records
   an in-tree commit of this repository and is not a third-party coordinate.
5. **Invalid ≠ failed, and this is the correction that matters most.** One seat
   named survivorship bias as the live risk in both prior drafts: treating every
   crash, non-zero exit, budget exhaustion or ceiling hit as "invalid, no slot
   consumed" allows unlimited zero-cost retries until both arms happen to
   complete, so the comparison would report only favourable executions. The
   split is therefore binding:
   - **Administrative invalidity → consumes NO slot.** Wrong snapshot, harness
     defect, unavailable infrastructure, confidentiality breach, corrupted
     capture, protocol deviation.
   - **Measured failure → a VALID completed observation, and that arm scores
     accordingly.** A correctly invoked arm that crashes, times out, exhausts
     its budget, or reaches its enforced fetch ceiling is telling you something
     about that arm — it is a result, not an accident.
6. **Isolation baseline.** Confirm `agents/.harvest-local/` is empty before 1.1.
   Neither prior draft required it, and without it a stale artefact from an
   earlier attempt is indistinguishable from this run's output.
7. **Snapshot identity is verified bidirectionally.** Not "both arms receive the
   same snapshot" but: `git rev-parse HEAD` matches the pinned SHA **on both
   sides, before analysis begins**. A shallow clone or partial checkout can
   diverge silently.
8. **1.3 inspects structure, never findings.** It verifies invocation, capture,
   evidence isolation and output *parseability*. It does not read the arms'
   substantive findings and does not use them to tune anything.
9. **Reference unavailable mid-run** — network transient, repo deleted, access
   revoked — is **administrative invalidity** under (5): no slot consumed,
   recorded outside the claim, return to 1.1. Named here because both prior
   drafts left it open and it is the one failure mode that looks like a measured
   failure and is not.

### What is unchanged

Round 1's unanimous rules still bind and this authorization does not touch them:
both arms are one atomic observation; an upgraded-only run is inadmissible;
until a valid run completes the claim row keeps `status: unbacked` with an
**empty** `last_verified`. The bar at `docs/CLAIMS.md:488` is untouched.

*Reopening condition:* the authorization is spent on **one** observation. A
second slot needs its own round. If the confidentiality test in (4) fails twice
on two different references, the boundary is reopened rather than worked around.

Council records: `2026-09-07-outbound-fetch-run-authorization.md` under
`agents/runtime/council/responses/` — local-only, since `agents/runtime/` is
gitignored, so the substance is transcribed here rather than linked.

## Phase 1 — Readiness, then the atomic pair

- [ ] **1.1 Pin the reference.** Name one small public repository and one
      commit, and record both. Small is a real criterion, not a preference: the
      upgraded arm's `--deep` tier and the shadow arm's 40-fetch ceiling must
      both complete without an extension request, or the arms are not comparable.
      verify: the reference and its commit are recorded in this roadmap, and a
      read-only fetch of that commit succeeds.
      UNBLOCKED 2026-09-07 — an autonomous lane correctly recorded that it
      cannot grant itself the run-specific council authorization step 1.6 names.
      That authorization has since been convened and **GRANTED**: see
      § Run-specific fetch authorization above — verdict (c), 2 seats, unanimous
      on the rung. This step is now executable, subject to conditions 1, 2, 4, 6
      and 7 there. In particular the reference must be under **2,000 files and
      10 MiB of analyzable text** (workload, never storage), `agents/.harvest-local/`
      is confirmed empty first, and the tracked tree records **no repository
      name, URL, commit SHA or distinctive path** for it.
      **NOT STARTED 2026-09-08 — halted at the gating condition, before anything
      was pinned and before any network operation.** Conditions 6 and 7 were run
      first, as they gate. Condition 6 passed: `agents/.harvest-local/` did not
      exist, so the isolation baseline was clean. Condition 7's shadow half then
      FAILED in a way no field of the pin can show — all four pinned fields
      reproduce exactly, and the text they identify is the wrong text. Diagnostic,
      correct coordinates and disposition: § Blockers →
      `shadow-pin-is-post-upgrade`.
      **No reference was named, no commit was pinned, no fetch was issued.** The
      confidentiality test of condition 4 was therefore never reached — there is
      no reference to test derivability against, and recording a "pass" for a test
      with no subject would be worse than recording that it was not reached.
- [x] **1.2 Freeze the counting rules before either arm is inspected.** What
      counts as an interop-probe finding at `file:line` precision, what counts
      as a bound-claim routing, and how a `consumer not locatable` probe is
      scored — the claim already fixes the last one as an honest result but not
      a positive.
      verify: the rules are written here and dated before the first arm runs;
      no rule is edited after either arm's output is read.
      Done 2026-09-07 — the three rules are frozen in
      § Frozen counting rules below, written **before either arm has run**:
      no artefact directory exists under `agents/.harvest-local/` for this
      observation, step 1.1 has not pinned a reference, and step 1.4 is
      unstarted. This is the readiness half of the disposition both council
      seats authorize, and it moves no goalpost: the bar itself stays exactly
      as `docs/CLAIMS.md:488` states it.
- [ ] **1.3 Harness-only validation.** Confirm invocation, capture and evidence
      isolation for both arms **without performing or inspecting the measured
      analysis** — the shadow command must be executable without adapting its
      substantive analysis instructions.
      verify: both arms produce an artefact directory under
      `agents/.harvest-local/` and `git status --porcelain` shows nothing new
      tracked; neither arm's analysis content has been read.
      UNBLOCKED 2026-09-07 — same boundary as 1.1, cleared by the same
      authorization: § Run-specific fetch authorization above, verdict (c). The
      half that needs no network **was** already run and stands — the shadow pin
      in § Frozen protocol reproduces on all four of its fields. Condition 8
      scopes what this step may look at: it verifies invocation, capture,
      evidence isolation and output PARSEABILITY, and it does not read either
      arm's substantive findings or use them to tune anything. Condition 6 runs
      first — `agents/.harvest-local/` is confirmed empty, so a stale artefact
      from an earlier attempt cannot be mistaken for this run's output.
      Executable once 1.1 is done.
      **NOT RUN 2026-09-08.** 1.1 did not complete, so this step has no reference
      snapshot to validate a harness against. Nothing was invoked, nothing was
      captured, and `agents/.harvest-local/` is back to not existing — the
      shadow-command extract taken while checking condition 7 was removed, so the
      next attempt's condition-6 check meets a clean baseline rather than this
      run's leftovers. That is condition 6 applied to my own working files, which
      is the point of it.
- [ ] **1.4 Run both arms as one observation.** Upgraded and shadow, identical
      reference snapshot and identical inputs.
      verify: two artefact sets exist under the gitignored area, the upgraded
      arm's iteration record shows three named-lens delta blocks and one
      repeated revision, and neither arm was abandoned part-way.
      UNBLOCKED 2026-09-07 — the boundary is cleared by § Run-specific fetch
      authorization above, verdict (c). Risk 1 is not dismissed, it is bound:
      condition 5 makes ADMINISTRATIVE invalidity (wrong snapshot, harness
      defect, unavailable reference, confidentiality breach, corrupted capture,
      protocol deviation) consume NO slot, while a MEASURED failure — a
      correctly invoked arm that crashes, times out, exhausts its budget or hits
      its enforced ceiling — is a valid completed observation that scores
      accordingly. That split is what stops unlimited zero-cost retries from
      reporting only the favourable executions. Conditions 3 and 7 gate this
      step specifically: the fetch ceiling is instrumented BEFORE the shadow arm
      is invoked, never counted afterwards, and `git rev-parse HEAD` is
      confirmed against the pinned SHA on BOTH sides before analysis begins.
      Executable once 1.1 and 1.3 are done.
      **NOT RUN 2026-09-08, and NO SLOT CONSUMED.** This is administrative
      invalidity under condition 5 in its clearest form — "wrong snapshot" — and
      it is the branch of that condition that carries no cost: the defect was
      found BEFORE any arm was invoked, so there was no correctly-invoked arm to
      score and nothing to distinguish from a measured failure. Zero fetches were
      issued, no budget was spent, no reference was exposed.
      Condition 3's ceiling instrumentation was consequently not built. Stating
      that plainly rather than reporting it as satisfied: the condition says the
      mechanism must exist BEFORE the arm is invoked, and no arm was invoked, so
      the honest record is "not reached", not "met".
- [ ] **1.5 Write the outcome into `docs/CLAIMS.md`.** Pass → keep
      `status: unbacked`, record "observation 1/2 passed" with opaque
      provenance, leave `last_verified` empty. Fail → record the pre-registered
      null, set `last_verified` to the run date, and initiate the bound
      reversions of the interop-probe, convergence and `--deep` mechanisms.
      Invalid → leave the row unchanged and record the protocol failure outside
      the claim.
      verify: the claim row's state matches the branch of this step that
      actually fired, and `./scripts-run src/scripts/build_proof` is re-run.
      BLOCKED 2026-09-07 — no branch has fired, because 1.4 has not run. Point 3
      of § Why this is carried is binding and is honoured by leaving this
      untouched: the row keeps `status: unbacked` and an EMPTY `last_verified`
      (`docs/CLAIMS.md:491-492`), because dating a partial observation would read as
      verification. Closes with 1.4.
- [ ] **1.6 Dispose of the parked stub.** Archive
      `agents/roadmaps/stubs/road-to-first-reference-analysis-run.md` and record
      that the fetch boundary was resolved by a **run-specific council
      authorization**, never structurally by Phases 3-4.
      verify: the stub is archived, the archive index is regenerated, and the
      disposal note names the run-specific authorization.
      UNBLOCKED 2026-09-07 — the run-specific authorization this step's disposal
      note must name now EXISTS: § Run-specific fetch authorization above,
      verdict (c), 2 seats. Point 2 of § Why this is carried is satisfied rather
      than circumvented — the stub is disposed of on the ground that the
      surviving boundary was cleared by a named authorization, never on the
      false ground that Phases 3-4 cleared it, and the disposal note must say
      exactly that. Still gated on 1.4 having actually run: an authorization to
      fetch is not an observation.

## Blockers

### blocker: shadow-pin-is-post-upgrade
- **Status:** OPEN
- **Owner:** council
- **Blocks:** steps 1.1, 1.3 and 1.4, and therefore 1.5 and 1.6. The
  authorization to fetch is unaffected and unspent — this is not a permission
  problem, it is a measurement-validity one.
- **What it is:** § Frozen protocol pins the shadow arm at commit
  `537e7c86e7646d50bf10d8b3e7ec8655239bceab`, and the text at that commit is a
  **post-upgrade** text. The upgrade landed in
  `5bee62a5828ba6d3cf38a7d5d685004716d8addf` on 2026-08-12 —
  *"anchor-first direction, claim gate, interop probe and bounded --deep"* — and
  that commit is an ANCESTOR of the pin, which post-dates it by almost a month.
  All five mechanisms `docs/CLAIMS.md:488` says were folded in are present in the
  pinned text: `### 1b. Anchor table first`, `### 2b. Deep verification tier`,
  `### 3b. Interop probe`, `### 5b. Converge the verdict table`, and the
  bound-claim collision gate in § 5.

  The consequence is not cosmetic. Falsification criterion 1 of the claim
  (`docs/CLAIMS.md:490`) decides "could not have produced" by **diffing two
  documents**. With this pin both documents carry the mechanisms, so the diff
  answers a question nobody asked and the observation could neither pass nor
  fail the bar it was pre-registered against. An upgraded-vs-upgraded comparison
  is not a weak measurement; it is a different measurement.

  All four pinned fields reproduce byte-exactly, which is why the pin verified
  clean on 2026-09-07 and again today. The fields identify the text correctly —
  the text is the wrong one, and no field of a pin can express that.
- **What to do:**
  1. Do **not** re-pin inside this roadmap on an autonomous lane's judgement.
     § Run-specific fetch authorization condition 1 makes the frozen protocol a
     dated version whose amendment record is named and closed; the council
     granted verdict (c) over that frozen set. Editing a frozen element after the
     grant, without a round, changes the basis the grant was given on.
  2. Route the re-pin to the council that granted (c) — it is the same body, the
     record is `2026-09-07-outbound-fetch-run-authorization.md`, and the question
     is narrow: does the grant survive replacing one frozen coordinate, or does
     the corrected protocol need its own round?
  3. The correct coordinates are already derived, so the re-freeze is one edit
     rather than an investigation:

     | Field | Correct pre-upgrade value |
     |---|---|
     | Shadow base commit | `97e293760e6b05af3a64b5a0cb34f581ab855e4c` (2026-08-12) |
     | Shadow blob id | `0e805c5d6ee7139e76199738be67ed5c8a105a9e` |
     | Shadow content sha256 | `ddb6c19b8d620caebd8e6c0dfbb3a2592528233274d790bcb4c104f6652c6756` |
     | Shadow size | 207 lines · 6790 bytes |
     | Shadow path at that commit | `src/domains/analysis-workbench/analyze/reference-repo/command.md` <!-- ref-ignore --> |

     Recover it with
     `git show 97e293760e6b05af3a64b5a0cb34f581ab855e4c:src/domains/analysis-workbench/analyze/reference-repo/command.md`.
     Verified 2026-09-08: that text contains **zero** occurrences of all five
     mechanism markers, against one each in the currently pinned text.
  4. When re-freezing, replace the corroboration sentence rather than keeping it.
     "361 lines" was measured against `93d63073e` (2026-09-05), which is **also**
     post-upgrade, so the two readings agreed because they measured the same
     wrong text twice. The pre-upgrade figure is 207 lines.
- **Recommendation:** re-pin and run, once the council answers point 2. Nothing
  about the reference, the counting rules, the size envelope or the
  confidentiality rules is affected by this defect — only the shadow coordinate
  is wrong, and the corrected one is above. The slot is unspent and the
  authorization is intact.
- **If you do nothing:** the roadmap stays executable-looking and its first real
  execution attempt spends the authorization on a comparison that cannot answer
  the pre-registered question. That is the one outcome condition 5 was written to
  prevent, arrived at from the direction it did not anticipate — not a retry
  after a failure, but a first run against a protocol that was wrong before it
  started.
- **Resolved when:** § Frozen protocol carries the pre-upgrade coordinates above,
  the corroboration sentence states 207 lines against a pre-upgrade tree, and the
  council has recorded whether verdict (c) carries over to the corrected protocol
  or needs a new round.

## Reopening trigger — observation-based, not calendar-based

This roadmap is `status: draft` and is worked when **all** of the following are
observable, per the authorizing seat:

1. The shadow SHA and content hash above still resolve and reproduce.
2. A specific reference commit satisfies the small-public-reference criterion of
   step 1.1.
3. The harness-only validation of step 1.3 confirms equivalent inputs and
   isolated capture for both arms.

The deferring seat added a fourth condition and it is recorded rather than
adopted: it proposed "30 days remain in the 180-day window" as a fallback. Both
seats agreed a calendar trigger conflicts with the observation-based
requirement, so it is **not** a trigger here. The window is a fact about the
claim, stated in `docs/CLAIMS.md`, and it is the maintainer's to act on.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-07 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A slot is spent on an invalid pair | product | A flawed shadow reconstruction or non-identical inputs produce a false data point that cannot be withdrawn from a pre-registered measurement, forcing a null and its bound reversions | Steps 1.1-1.3 are prerequisites, and an invalid run consumes no slot by the council's unanimous rule | Phase 1 — Readiness, then the atomic pair |
| 2 | The window expires unspent | product | The 180-day bound treats expiry as the bar not cleared, reverting three mechanisms | The protocol is frozen now, so the remaining work is execution rather than preparation | Phase 1 — Readiness, then the atomic pair |
| 3 | The shadow text drifts | implementation | A later run substitutes a different pre-upgrade text and the comparison silently answers a different question | The commit, blob id and content hash are pinned above and are checkable in one command | Phase 1 — Readiness, then the atomic pair |

## Acceptance Criteria

- [ ] AC-1 — One atomic upgraded-plus-shadow pair has run against one pinned
      reference at one pinned revision, or the roadmap records why it did not.
      OPEN 2026-09-07, second limb partially discharged: no pair has run, and
      the reason is recorded under 1.1 and 1.3 — the outbound third-party fetch
      boundary is untouched and needs a run-specific council authorization that
      does not exist. Left unticked rather than ticked on the "or" limb, because
      the tick would read as the observation being settled when the slot is
      still unspent.
- [ ] AC-2 — The claim row at `docs/CLAIMS.md` states an outcome that matches
      what the run produced, with no rule edited after the data.
      OPEN 2026-09-07. The run produced nothing, so the matching state is the
      untouched row — `status: unbacked`, `last_verified` empty
      (`docs/CLAIMS.md:491-492`), which is what point 3 of § Why this is carried
      requires. The second limb is now checkable rather than aspirational: the
      counting rules were frozen and dated before any arm ran, so a later edit
      to them is detectable.
- [ ] AC-3 — The parked stub is disposed of, and its disposal note attributes
      the fetch boundary's resolution to a run-specific authorization rather
      than to Phases 3-4.
      OPEN 2026-09-07 — see 1.6. The stub stays, which is the outcome point 2 of
      § Why this is carried mandates while the fetch boundary survives.
