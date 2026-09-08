---
complexity: structural
status: later
parent_roadmap: road-to-bounded-reference-harvest-loop
execution:
  mode: phase-checkpoints
review_by: 2026-12-08
entry_condition:
  what: "Both blockers fall, independently: (1) a full-strength council or the owner ratifies the corrected shadow comparator recorded in § Blockers -> shadow-pin-is-post-upgrade, and (2) the repository maintainer performs the outbound third-party fetch that step 1.1 requires. Neither clears the other."
  when: "Whenever the owner acts, or a full-strength council convenes on the comparator question. Not calendar-driven: this roadmap's § Reopening trigger records that both council seats refused a calendar trigger. The review_by date is a re-read obligation, never a wake condition."
  who: "Comparator ratification: a full-strength AI council convened on that question, or the repository maintainer. Fetch execution: the repository maintainer alone, operating an approved outbound-fetch environment - a Hard Floor act under non-destructive-by-default that no council verdict and no roadmap acceptance reaches. The two are separate trust boundaries and one actor satisfying one does not satisfy the other."
estate_growth_exempt: "Re-claimed 2026-09-08 for the park, replacing the creation-time reason which is preserved verbatim at the end of this sentence. Nothing was created: this is the same file, moved from agents/roadmaps/ into agents/roadmaps/later/ by AI-council decision (Q1 verdict (a), 1 of 2 seats present, recorded DEGRADED in the roadmap body). The gate nonetheless reads the move as pure growth, and the mechanism is worth naming because it will recur: this roadmap was status: draft, so it never counted toward active_roadmaps, which means the sanctioned parking allowance at check_estate_count.ts:63-66 — which raises the later_roadmaps allowance by one for a file that LEAVES the active top level — does not fire. The offsets ledger reads +0 active / -0 disposed and its parked set is empty, so parking a draft is indistinguishable from conjuring a later/ file. Measured on this change: later_roadmaps 83 to 84 (+1), open_blockers 38 to 40 (+2, the same two blockers this file already carried and which were uncounted while it was a draft), active_roadmaps 9 to 9 (+0). The estate is not larger by one roadmap or by two blockers; the same objects moved into the scan set. Original creation-time reason, unchanged: Receiver for two steps carried out of road-to-bounded-reference-harvest-loop, which is archived in the same change — the active count is unchanged by the pair."
---
# Road to the first reference-analysis observation

> **Source:** carried out of
> [`road-to-bounded-reference-harvest-loop`](road-to-bounded-reference-harvest-loop.md)
> steps 5.2 and 5.3 on 2026-09-07, by AI-council decision on a split verdict.
> Council record: `agents/evidence/council/bounded-harvest-observation-slot.md`
> (2 seats, anthropic + openai, subscription transport, $0.0000).

> **`complexity: lightweight` → `structural`, 2026-09-08.** Stated rather than
> flipped silently: the 2026-09-08 corrections took the file past the
> 600-line lightweight cap, and the two legal responses are to trim or to
> retag. Trimming to fit would have meant deleting council-verdict evidence and
> the pin verification, so retagging is the honest one — and the tag is accurate
> on substance, since this roadmap carries a frozen experimental protocol, a
> nine-condition authorization record, three frozen counting rules and two
> blockers. It stays one phase and six steps; the tag reflects the document,
> not a widened scope.

> **PARKED 2026-09-08, whole.** Every open item is carried intact — nothing was
> executed, nothing was deleted, no coordinate was changed and no slot was spent.
> Five of six steps are gated behind two blockers that no agent can clear at any
> effort, so this file is not active backlog and must stop appearing as one.
> **Resume when:** both blockers fall — see the three-part `entry_condition:` in
> the frontmatter above, which separates the two trust boundaries deliberately.
> **Owner:** the repository maintainer for the fetch; a full-strength AI council
> **or** the maintainer for the comparator ratification. The full disposition
> record, the per-step dependency chain and the council verdict that authorized
> this park are in § Disposition — parked 2026-09-08 below.
> **Why parked rather than archived:** the work is un-done and wanted. Archiving
> would have required either a `[x]` on an unexecuted step, an owner-reserved
> `[-]`, or a duplicate receiver file bought with an exemption claim. All three
> were rejected; see the council record.

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

### Pin status after council ratification — 2026-09-08

**The pin above stays exactly as frozen, and it is known-invalid.** Those are
not in tension: the frozen coordinate is preserved as the historically
authorized one, and its invalidity is recorded beside it rather than edited
into it. The corrected coordinates in § Blockers →
`shadow-pin-is-post-upgrade` are a **proposal**, deliberately NOT operative.

**Independently re-verified 2026-09-08**, on a second lane, against the actual
objects rather than against the prior lane's report — every element of the
diagnostic reproduces:

| Check | Result |
|---|---|
| Pinned blob at `537e7c86e` | `b2ea4fa61d4c8fa1ec737cad95699bd5d8be4a7f` — matches the pin |
| Pinned size / sha256 | 361 lines · 15466 bytes · `6ea17929…8134ba` — all match |
| Upgrade `5bee62a58` is an ancestor of the pin | **true** — the pin is post-upgrade |
| Five mechanism markers in the pinned text | **1 occurrence each** (all five present) |
| Corrected blob at `97e293760` | `0e805c5d6ee7139e76199738be67ed5c8a105a9e` · 207 lines · 6790 bytes · `ddb6c19b…2c6756` |
| Five mechanism markers in the corrected text | **0 occurrences each** |
| `93d63073e` (the corroborating tree) is post-upgrade | **true** |

One thing the earlier record did not establish, and it strengthens the
correction rather than changing it: `97e293760` is the **immediate parent** of
the upgrade commit `5bee62a58`. It is therefore not merely *a* pre-upgrade
commit but the last state of that text before the upgrade landed — the
uniquely determined comparator, fixed by ancestry rather than chosen.

**One precision, adopted from both council seats and correcting the framing
above.** "The observation could neither pass nor fail the bar" is too absolute.
An upgraded-versus-upgraded run could mechanically satisfy or miss the numeric
thresholds at `docs/CLAIMS.md:488`; what is true, and is the reason the defect
is fatal, is that **either result would be inadmissible for the pre-registered
causal comparison**, because the shadow arm would not be testing pre-upgrade
behaviour at all. The earlier wording is left standing above for the same
reason the corroboration paragraph is — it is the record — and this is the
correction to read it with.

**Council, 2026-09-08 — Q1 verdict (b), unanimous across 2 seats**
(anthropic/claude-sonnet-4-5, openai/codex-default; 2 rounds; quorum 2/2,
threshold 1; subscription transport, $0.0000). The question put was the narrow
one the blocker routed: does the granted verdict (c) survive replacing one
frozen coordinate? Answer: **no.** The comparator commit is part of the
experimental design, not clerical metadata, so replacing it materially changes
the shadow arm that the earlier unanimous round authorized. Both seats held
that the correction is right, uniquely determined and untainted by data — and
that ratifying it is nonetheless not a thing this round may do on its own.
Record the existing pin as invalid, keep the authorized protocol intact as
historical evidence, and carry the corrected coordinate as a fully specified
proposal awaiting ratification by a full-strength council or the owner.

Recorded and not adopted, because inventing it here is the thing the seat
warned against: one seat recommended that the project establish an explicit
standing rule for **pre-run, uniquely determined errata** — a class this defect
fits exactly — so that a future correction of this shape does not need a round
of its own. That is a governance change with no owner in this lane, and it is
noted here rather than written anywhere it would take effect.

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

### Authority boundary — appended 2026-09-08, nothing above is rewritten

The section above is preserved **verbatim**. This is an interpretive note about
what its verdict is authority for, not a revision of what it said: recasting a
stronger body's historical decision in weaker language is the failure this
whole apparatus exists to prevent, and it would be no better for being done in
a cautious direction.

**Verdict (c) is a readiness and protocol-adequacy clearance. It is NOT
authority to perform the outbound third-party fetch.** The fetch stays exactly
where the tree already put it: owner-reserved.

Three tree facts, none of which a council can vote away:

1. [`non-destructive-by-default`](../../src/rules/non-destructive-by-default.md)
   makes an **irreversible external action** — outbound, externally-visible acts
   the user cannot un-see — a **Hard Floor** trigger requiring explicit user
   confirmation **on this turn**, and states in its own Iron Law that no
   autonomy setting, no roadmap step and no standing instruction bypasses it.
2. [`roadmap-execution-contract`](../../src/agent-src/contexts/execution/roadmap-execution-contract.md)
   § 5 "What acceptance can NEVER cover" lists "Any
   `non-destructive-by-default` trigger beyond the two named grants". No
   roadmap-execution acceptance, at any mode, reaches an outbound fetch.
3. The parked stub already said so and was right: its **named re-entry
   producer** is the repository maintainer operating an approved outbound-fetch
   environment, "no command in this repository is permitted to spend on
   third-party fetches unattended", and "none of the three [probes] is
   agent-buildable".

So this is a **disambiguation, not a discovery of overreach**. The Hard Floor
constrained verdict (c) from the moment it was granted; what was missing was
any sentence saying so, and an autonomous lane reading "rungs 1.1, 1.3 and 1.4
are authorized" would reasonably have read it as permission. Step 1.1's own
`verify:` requires that "a read-only fetch of that commit succeeds", which is
the act in question — so the gap was not theoretical.

**Council, 2026-09-08 — Q2 verdict (b), unanimous across 2 seats**
(anthropic/claude-sonnet-4-5, openai/codex-default; 2 rounds; quorum 2/2,
threshold 1; subscription transport, $0.0000). One seat noted it was confident
here even under a degraded-attendance framing precisely because the finding
enforces a pre-existing constraint rather than creating one; the other supplied
the append-don't-rewrite refinement this note follows.

**What this changes in practice.** The three `UNBLOCKED 2026-09-07` notes on
steps 1.1, 1.3 and 1.4 are correct that the *protocol* question is settled and
wrong if read as "an agent may now run these". Each carries a 2026-09-08
correction below. The blocker `fetch-is-owner-reserved` records the act itself.

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
      **STILL NOT EXECUTABLE BY AN AGENT, corrected 2026-09-08.** The
      `UNBLOCKED 2026-09-07` line above is right about the protocol and wrong if
      read as permission. This step's own `verify:` requires that "a read-only
      fetch of that commit succeeds" — an outbound third-party fetch, which is a
      **Hard Floor** act reserved to the owner and reachable by no council
      verdict and no roadmap acceptance. Ratified 2026-09-08, Q2 verdict (b),
      2 seats unanimous: see § Authority boundary above and § Blockers →
      `fetch-is-owner-reserved`. Two blockers now stand between this step and
      execution — the pin must be ratified, and the fetch must be performed by
      the named producer. Neither is an effort question.
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
      **STILL NOT RUN, and re-checked 2026-09-08 on a second lane.** Condition 6
      holds: `agents/.harvest-local/` still does not exist, so the isolation
      baseline the previous lane left behind is intact and this lane added
      nothing to it. Beyond 1.1's incompleteness, this step is now also gated by
      § Blockers → `fetch-is-owner-reserved`: both arms it validates are
      fetch-dependent, so a harness check has nothing to invoke until the owner
      performs the run. Nothing was invoked and nothing was captured here either.
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
      **STILL NOT RUN 2026-09-08, STILL NO SLOT CONSUMED, and the reason is now
      two-fold rather than one.** The wrong-snapshot defect above stands and was
      re-verified independently. On top of it, this step is the one that spends
      money outbound to a third party, which § Authority boundary establishes is
      Hard Floor and owner-reserved: verdict (c) cleared the protocol, never the
      act. So even a ratified re-pin does not make this step agent-executable —
      it makes it ready for the named producer. Zero fetches were issued on this
      lane, no budget was spent, no reference was named or exposed, and the
      isolation baseline was left as it was found.
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
      **RE-CONFIRMED 2026-09-08, and deliberately left untouched.** Verified at
      this commit rather than recalled: `docs/CLAIMS.md:487` is the
      `reference-loop-upgrade-value` header, `:491` reads `- status: unbacked`
      and `:492` reads `- last_verified:` with nothing after the colon. Both
      council seats confirmed this is the state that matches what the run
      produced, which is nothing. `build_proof` is therefore **not** re-run:
      its trigger is a change to this file, and the correct action here was to
      make none.
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
      **STILL GATED 2026-09-08, and the disposal note this step owes has grown a
      second clause.** The stub stays in place, cross-referenced to this roadmap
      as point 2 of § Why this is carried requires — verified at this commit: the
      stub's § Status names this roadmap as the receiver and states the fetch
      boundary is NOT resolved. Q2 verdict (b) sharpens what the eventual note
      must say: the boundary is cleared by a run-specific authorization **plus**
      the owner performing the Hard-Floor act, never by the authorization alone.
      A note attributing the resolution to verdict (c) on its own would be the
      same category of false attribution as crediting Phases 3-4, which is the
      error this step was written to avoid.

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
- **Council answer, 2026-09-08 — point 2 is DISCHARGED; the blocker stays OPEN
  on a narrower question.** The re-pin was routed as instructed. Verdict on
  Q1: **(b)**, unanimous across 2 seats (anthropic/claude-sonnet-4-5,
  openai/codex-default; 2 rounds; quorum 2/2, threshold 1; subscription
  transport, $0.0000). **The grant does NOT carry over.** The comparator commit
  is part of the experimental design rather than clerical metadata, so replacing
  it materially changes the shadow arm the earlier unanimous round authorized.
  Both seats held the correction itself to be right, uniquely determined by
  ancestry, and untainted by data — and held equally that ratifying it was not
  theirs to do in that round.

  So point 1 above still binds and point 3's table stays a **proposal**: the
  frozen pin is untouched, marked invalid in place (§ Pin status after council
  ratification), and the corrected coordinates await ratification by a
  full-strength council convened on this question, or by the owner. Point 4 is
  likewise not executed — the corroboration sentence keeps its 361-line figure,
  with the refutation recorded beside it, because rewriting it is part of the
  re-freeze that has not been authorized.

  What this lane added to point 3 rather than acting on it: every coordinate in
  that table was re-verified independently against the objects, and
  `97e293760` was established to be the **immediate parent** of the upgrade
  commit — so the proposed comparator is fixed by ancestry, not chosen.

  **One defect in this round, recorded because it bears on the verdict's
  weight.** The round was framed to the seats as DEGRADED, 1 of 2 present, on
  the strength of a pre-run availability probe
  (`agents/runtime/state/council-probes.json` recorded the anthropic seat as an
  unclassifiable failure). Both seats then reasoned partly from that premise —
  one opened by naming its own insufficiency as a single seat. The probe was
  **stale**: the post-run quorum line reports `2/2 present`, and both seats
  answered. The verdict is therefore unanimous at full attendance while its
  stated reasoning leans on an attendance figure that was wrong.

  It is **not** re-run, and that is deliberate. Re-running a round after reading
  an unwelcome verdict — with a framing correction that happens to remove the
  objection blocking the answer this lane would prefer — is verdict shopping,
  which [`evaluator-independence`](../../src/rules/evaluator-independence.md)
  forbids in exactly this shape. Two things make (b) safe to adopt anyway: it is
  the conservative branch, so it sits inside both seats' authorized sets under
  either attendance reading, and its load-bearing argument does not depend on
  seat count at all — it depends on a **later** round amending an **earlier**
  frozen grant, which is true however many seats are present. A full-strength
  round convened without the stale framing is precisely the ratification venue
  verdict (b) asks for, so the discrepancy points at the next step rather than
  away from it.

  **The one field below that was REPLACED rather than appended to, with its
  original text preserved here.** Every other correction on 2026-09-08 sits
  beside what it corrects; `Resolved when:` could not, because a blocker may
  carry exactly one live resolution condition and two contradictory ones would
  be worse than either. The prior lane wrote, verbatim:

  > **Resolved when:** § Frozen protocol carries the pre-upgrade coordinates
  > above, the corroboration sentence states 207 lines against a pre-upgrade
  > tree, and the council has recorded whether verdict (c) carries over to the
  > corrected protocol or needs a new round.

  Its third clause is now satisfied — the council has recorded exactly that —
  and its first two describe the re-freeze that verdict (b) declined to
  authorize, so leaving the field as written would have read as though this lane
  were free to perform them.
- **Resolved when:** a ratification round (or the owner) has recorded whether
  the corrected coordinates may replace the frozen ones; and if so, § Frozen
  protocol carries the pre-upgrade coordinates as operative and the
  corroboration sentence states 207 lines against a pre-upgrade tree. Point 2 —
  routing the question to the council — is discharged as of 2026-09-08 and is
  not the open part any more.
- **Parked with its roadmap 2026-09-08.** This blocker is unchanged — still
  **OPEN**, same owner, same `Resolved when:`. A third autonomous lane confirmed
  it cannot be cleared from here: the ratification venue verdict (b) named is a
  full-strength council or the owner, and only 1 of 2 seats was available that
  day. The roadmap moved to `agents/roadmaps/later/` rather than being archived
  around the blocker; see § Disposition — parked 2026-09-08.

### blocker: fetch-is-owner-reserved
- **Status:** OPEN
- **Owner:** maintainer
- **Blocks:** steps 1.1, 1.3 and 1.4 directly, and 1.5 and 1.6 through them.
  Independent of `shadow-pin-is-post-upgrade`: ratifying the corrected pin does
  not clear this, and clearing this does not validate the pin. Both must fall.
- **What it is:** § Run-specific fetch authorization records verdict (c) as
  authorizing "rungs 1.1, 1.3 and 1.4", and step 1.1's own `verify:` requires
  that "a read-only fetch of that commit succeeds" against a third-party
  repository. An outbound third-party fetch is an **irreversible external
  action** — a Hard Floor trigger under
  [`non-destructive-by-default`](../../src/rules/non-destructive-by-default.md),
  requiring explicit user confirmation on the turn it happens, lifted by no
  autonomy setting, no roadmap step and no standing instruction.
  [`roadmap-execution-contract`](../../src/agent-src/contexts/execution/roadmap-execution-contract.md)
  § 5 says the same from the other side: no roadmap-execution acceptance, at any
  mode, reaches a `non-destructive-by-default` trigger. And the parked stub
  already named the right producer — the repository maintainer, operating an
  approved outbound-fetch environment — and stated that no command here may
  spend on third-party fetches unattended.

  This is a **disambiguation, not an overreach discovered after the fact**. The
  Hard Floor bounded verdict (c) from the moment it was granted; what was
  missing was a sentence saying so. An autonomous lane reading "rungs 1.1, 1.3
  and 1.4 are authorized" would reasonably have read it as permission to fetch,
  and two lanes have now stopped at this line instead.
- **What to do:** the named producer performs the run. Concretely, and in this
  order, because two of the three gate:
  1. Resolve `shadow-pin-is-post-upgrade` first — a fetch against an
     unratified protocol spends the slot on a comparison that cannot answer the
     pre-registered question.
  2. Confirm conditions 6 and 7 of § Run-specific fetch authorization
     (`agents/.harvest-local/` empty — verified absent at this commit; snapshot
     identity checked bidirectionally on both sides).
  3. Instrument the 40-fetch ceiling **before** invoking the shadow arm
     (condition 3), then run both arms as one atomic observation, then run the
     confidentiality test of condition 4 against the actual reference.
- **Recommendation:** leave this to the owner and do not attempt to route around
  it. There is no re-scoping that makes the observation reachable without the
  fetch: falsification criterion 1 at `docs/CLAIMS.md:490` decides the claim by
  comparing two runs **against the same external reference**, so the reference
  is constitutive of the measurement rather than an input to it. An
  upgraded-only or reference-free substitute is already inadmissible by point 4
  of § Why this is carried and consumes no slot. The honest options are the
  owner running it, or the claim's 180-day window expiring — which the claim
  itself pre-registers as the bar not cleared, with its bound reversions.
- **If you do nothing:** the window (180 days from 2026-08-12) expires, which
  falsification criterion 3 counts as the bar not cleared. The interop-probe,
  convergence and `--deep` mechanisms then revert per the pre-registered
  consequence bound; the anchor-table and bound-claim-gate mechanisms stay
  either way. That is a defined, non-catastrophic outcome and it is the reason
  this blocker is filed rather than escalated as urgent — but it is a real cost
  and it arrives by default rather than by decision.
- **Resolved when:** either an atomic upgraded-plus-shadow pair has been run by
  the named producer against a ratified protocol, or the owner has recorded a
  decision not to spend the slot and the claim's window consequence is allowed
  to fire.
- **Asked:** no. This lane is autonomous by mandate and routes every decision to
  the AI council rather than to the owner, so the question of whether to perform
  the fetch was never put to the person who alone may answer it. Recorded
  explicitly rather than left implicit: a decision only the owner can make,
  filed in a roadmap without ever being asked, is a park wearing a blocker's
  clothes. This one is genuinely un-askable from here, and the field says which
  of the two it is.
- **Parked with its roadmap 2026-09-08, and the `Asked:` field above still reads
  `no`.** A third autonomous lane ran under the same zero-round-trip mandate and
  did not ask either — so the honest record is unchanged rather than improved by
  repetition. What that lane did instead was stop calling this active backlog:
  the roadmap is now parked under `agents/roadmaps/later/` with the fetch named
  in its `entry_condition:` as a maintainer-only act, which is the closest an
  autonomous lane can get to putting the question where the owner will meet it.
  See § Disposition — parked 2026-09-08.

## Disposition — parked 2026-09-08

**Decision: PARK.** Moved from `agents/roadmaps/` to `agents/roadmaps/later/`
unchanged in substance. Steps stay `[ ]`, both blockers stay **OPEN**, the frozen
protocol is byte-untouched, and the corrected comparator stays a **proposal**.
Nothing in this change ratifies anything, spends anything, or moves a goalpost.

### The council round that authorized it

**AI council, 2026-09-08 — Q1 verdict (a) PARK, Q2 verdict (b) OUTSIDE.**
Members configured: 2 (`anthropic`, `openai`). **Present: 1 of 2 — this round is
DEGRADED and is recorded as such**, not as convergence. The `anthropic` seat was
skipped before dispatch as `unavailable` (live probe, 2026-09-08, outcome
`other`) and appears in the artefact's `absent_members`. 2 rounds plus blind peer
review, `--depth deep`, `--prompt-mode design`, subscription transport,
**$0.0000** — nothing billed.

**The quorum line is contradictory and the pessimistic reading is the one taken.**
The run printed `before the run · 1/2 present` and `after the run · 2/2 present`
for the same round. `absent_members` names `anthropic`, so 1/2 is the honest
figure and this record uses it. The identical discrepancy was recorded by the
previous lane on this file; it is a stale-probe artefact, and reporting the
flattering half of a contradiction would be the defect that record exists to
name.

**Q1 — what is the correct disposition?** Options put: (a) park in `later/`;
(b) create a parked receiver, mark the five steps `[~] carried-to=`, record
outcome `transferred` and archive this roadmap; (c) fold the steps into the
existing stub `stubs/road-to-first-reference-analysis-run.md`; (d) something else.
**Verdict (a)**, in both rounds and endorsed by both peer-review passes.
Rationale, in the seat's own order:

1. The standing user directive of 2026-06-16, recorded in the module docstring of
   `src/scripts/lint_roadmap_later_disposition.ts:69-71` — *"roadmaps with open
   tasks deferred for later are always moved to `later/`. The active tree holds
   only roadmaps …"* — describes this file exactly.
2. Parking is a **sanctioned** estate path, not a workaround:
   `src/scripts/check_estate_count.ts:63-66` raises the `later_roadmaps`
   allowance by one for a file moved from the active top level into `later/` in
   the same change, and needs no exemption claim. An archived parent explicitly
   does **not** buy a new `later/` file.
3. Option (b) buys the word "archived" with a second file that is substantially a
   copy of this one, an `estate_growth_exempt:` claim to pay for it, and a record
   split across two documents — for a roadmap whose entire substance is unexecuted.
4. Option (c) is mechanically unreachable and was verified so rather than
   asserted: `deferralProblems()` in
   `src/agent-src/scripts/archive_completed_roadmaps.ts:448-452` probes exactly
   two candidate paths for a `carried-to=` destination — `agents/roadmaps/<slug>.md`
   and `agents/roadmaps/later/<slug>.md`. A stub is neither. The only other
   closing glyph is `[-]`, which is owner-reserved.

**Q2 — may a degraded single-seat round take this decision at all?** The
2026-09-08 Q1 verdict (b) recorded in § Pin status reserved **ratification of the
corrected comparator** to a full-strength council or the owner, and this round is
not full-strength. **Verdict (b) — OUTSIDE the reserved set.** The reservation
binds the *experimental design* — which commit the shadow arm reads. Parking
selects no comparator, resolves no blocker, authorizes no fetch, consumes no
observation slot and touches no Hard Floor; it is reversible internal estate
management. Both rounds attached the same condition, and it is honoured
throughout this change: **the corrected comparator remains an unratified
proposal and is nowhere described as approved, selected, or frozen.**

**One council recommendation was NOT adopted, and the reason is a verified fact
rather than a preference.** Both rounds asked for per-step `blocked_by:`
metadata. `blocked_by` is a field of the **ticket** schema
(`agents/roadmaps/archive/road-to-ticket-bundles.md:121`), not of a roadmap step;
no roadmap in this tree carries it, and one peer-review pass flagged exactly this
as `needs-verification` — *"verify that `status: later`, `entry_condition`,
`review_by` and per-step `blocked_by` are valid schema rather than invented
structure"*. Three of the four are; the fourth is not. Inventing a step-level
frontmatter key to satisfy a recommendation would be the schema fabrication that
flag exists to catch, so the dependency chain is recorded as the table below
instead — the same information, in a form this repository already reads.

The second peer-review pass reached the same disposition from the other side:
lifecycle controls belong on a **reactivation** checklist, not on parking
prerequisites. They are recorded in § On the review_by date rather than imposed
as conditions of the park.

### The dependency chain, once, in full

| Step | Blocked by | Why it cannot be reached by an agent |
|---|---|---|
| 1.1 Pin the reference | `fetch-is-owner-reserved` (directly) · `shadow-pin-is-post-upgrade` (validity) | Its own `verify:` requires "a read-only fetch of that commit succeeds" — an outbound third-party fetch, a Hard Floor act. Running it against an unratified comparator would additionally spend the slot on an inadmissible comparison. |
| 1.3 Harness-only validation | 1.1, and `fetch-is-owner-reserved` directly | Its `verify:` requires that **both arms produce an artefact directory** under `agents/.harvest-local/`. Both arms are fetch-dependent, so there is nothing to invoke — the step is not merely waiting on 1.1's output, it is independently fetch-gated. (Recorded explicitly: one peer-review pass correctly noted the earlier text asserted 1.3's unreachability without demonstrating it.) |
| 1.4 Run both arms | 1.1 · 1.3 · `fetch-is-owner-reserved` · `shadow-pin-is-post-upgrade` | This is the step that spends outbound to a third party. Both blockers bear on it directly. |
| 1.5 Write the outcome into `docs/CLAIMS.md` | 1.4 | Its `verify:` requires the row to match "the branch of this step that actually fired". No branch has fired, so the matching state is the untouched row — which is what the tree already carries. |
| 1.6 Dispose of the parked stub | 1.4 | An authorization to fetch is not an observation, and point 2 of § Why this is carried forbids disposal while the fetch boundary survives. |

Step **1.2 is done** and stays done: the three counting rules are frozen, dated
before any arm ran, and byte-unchanged by this change.

### On the `review_by:` date

`review_by: 2026-12-08` is a **re-read obligation, never a wake condition** — the
wake condition is the `entry_condition:` mapping, and § Reopening trigger records
that both seats of the authorizing round refused a calendar trigger for this
roadmap.

The date is chosen rather than defaulted: the claim's 180-day window runs from
2026-08-12 (`docs/CLAIMS.md:488-490`) and therefore closes on 2027-02-08, so a
re-read on 2026-12-08 leaves roughly two months in which the owner can still act
before falsification criterion 3 fires by default.

**What happens on that date, named because a date with no action is a field that
certifies attention nobody paid.** The maintainer re-reads this file and records
one of exactly four outcomes: continue parking with a new date and a reason;
reactivate, because a blocker fell; replace, because the claim or the command
changed under it; or accept the window consequence deliberately rather than by
default. The fourth is a real option and is the one that arrives on its own if
nobody chooses — `blocker: fetch-is-owner-reserved` § If you do nothing states
its cost.

### What this park does NOT do

- It does not ratify the corrected comparator. That stays a proposal.
- It does not resolve either blocker. Both stay **OPEN**, with their owners and
  their `Resolved when:` fields unchanged.
- It does not touch `docs/CLAIMS.md`. The row keeps `status: unbacked` and an
  empty `last_verified`, verified again at this commit
  (`docs/CLAIMS.md:491-492`), which is the state point 3 of § Why this is carried
  requires while no valid observation exists.
- It does not edit R1-R3, the frozen protocol, the size envelope, the
  confidentiality rules or the authorization record. All are byte-unchanged.
- It spends no observation slot. The claim's two slots are both still unspent.

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

**Condition 1 is now known to be insufficient, 2026-09-08 — and it is left
standing.** "The shadow SHA and content hash still resolve and reproduce" was
satisfied on 2026-09-07, satisfied again on 2026-09-08, and satisfied a third
time on an independent re-verification — while the text those coordinates
identify is the wrong text. A pin can only attest that a coordinate still
points where it pointed; it cannot attest that the coordinate was ever the
right one. The condition is not amended here, for the same reason the pin is
not: it belongs to the authorizing seat's trigger set, and this lane holds no
authority to redraw that. What a ratification round should consider adding is
the check that would have caught it — *is the pinned commit an ancestor of the
upgrade commit?* — which is one command and has a decidable answer.

Two blockers now stand alongside these three conditions and neither is
observable-by-waiting: `shadow-pin-is-post-upgrade` needs a ratification
decision, and `fetch-is-owner-reserved` needs the owner. Reading the trigger
set alone would suggest this roadmap becomes workable when three observations
line up; it does not.

**Superseded as the operative wake condition, 2026-09-08 — and left standing as
the record.** The three conditions above belong to the authorizing seat's trigger
set and this lane holds no authority to redraw them, so they are not edited. What
changed is that they are no longer what a reader should act on: the frontmatter's
three-part `entry_condition:` is, because it names the two blockers, their two
distinct trust boundaries and the actor for each — which the three conditions
above predate and do not cover.

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
      STILL OPEN 2026-09-08, and the second limb is now fully discharged while
      the first is further from reach than it looked. The reason no pair has run
      is recorded in two blockers rather than one: the protocol's shadow arm was
      pinned to a post-upgrade text (`shadow-pin-is-post-upgrade`), and the
      outbound fetch is a Hard-Floor act reserved to the owner
      (`fetch-is-owner-reserved`) — which the 2026-09-07 note above got wrong in
      one direction, since a run-specific council authorization does now exist
      and is still not sufficient. Left unticked for the same reason as before.
      PARKED 2026-09-08 and still unticked. Neither limb moved: no pair has run,
      and the reason recorded in two blockers is unchanged. The roadmap left the
      active tree rather than this criterion changing — see § Disposition.
- [ ] AC-2 — The claim row at `docs/CLAIMS.md` states an outcome that matches
      what the run produced, with no rule edited after the data.
      OPEN 2026-09-07. The run produced nothing, so the matching state is the
      untouched row — `status: unbacked`, `last_verified` empty
      (`docs/CLAIMS.md:491-492`), which is what point 3 of § Why this is carried
      requires. The second limb is now checkable rather than aspirational: the
      counting rules were frozen and dated before any arm ran, so a later edit
      to them is detectable.
      STILL OPEN 2026-09-08, and the row is verified untouched at this commit:
      `docs/CLAIMS.md:491` reads `- status: unbacked` and `:492` reads
      `- last_verified:` with nothing after the colon. The second limb held
      under pressure, which is the part worth recording — a defect was found in
      a frozen element and the correction was NOT applied, because applying it
      after the authorizing grant is itself the class of edit this criterion
      exists to detect. R1-R3 are byte-unchanged.
      PARKED 2026-09-08, and the second limb held a third time. The park changed
      no rule, no coordinate and no claim row: `docs/CLAIMS.md:491-492` still
      reads `- status: unbacked` and an empty `- last_verified:`, verified at
      this commit, and R1-R3 are byte-unchanged again.
- [ ] AC-3 — The parked stub is disposed of, and its disposal note attributes
      the fetch boundary's resolution to a run-specific authorization rather
      than to Phases 3-4.
      OPEN 2026-09-07 — see 1.6. The stub stays, which is the outcome point 2 of
      § Why this is carried mandates while the fetch boundary survives.
      STILL OPEN 2026-09-08, with the criterion itself sharpened: Q2 verdict (b)
      establishes that a run-specific authorization is **necessary but not
      sufficient** for the fetch boundary, so the eventual disposal note must
      attribute the resolution to the authorization **plus** the owner's
      Hard-Floor act. Attributing it to verdict (c) alone would be the same
      false attribution as crediting Phases 3-4 — the error this criterion was
      written to catch, arriving in a new costume.
      PARKED 2026-09-08. The stub stays in place and was updated only to repoint
      its receiver link at the parked path and to record the park — no disposal,
      no attribution written, because neither is earned yet.
