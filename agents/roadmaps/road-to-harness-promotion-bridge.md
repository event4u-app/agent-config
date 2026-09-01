---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-governed-harness-evolution
    relation: extends
    note: >
      The parent this roadmap was split out of on 2026-08-31. It keeps Phases
      1-6 and every acceptance criterion except AC-9; this file owns the
      promotion bridge, step 0.8, AC-9 and the merge-authority blocker. The
      parent marks the transferred items `[-] MERGED` and points here.
estate_offset_exempt: "Adds one active roadmap with NO offsetting disposal, and none is available. AI council 2026-08-31 (anthropic/claude-sonnet-4-5 + openai/codex-default, 2/2 convergent) ruled Option 3 on the Phase 7 disposition: split at the phase boundary into a NEW ACTIVE roadmap. Both seats explicitly REJECTED parking it in agents/roadmaps/later/ on the ground that later/ is excluded from the dashboard and from /roadmap:process-*, so it does not preserve active-estate membership — which is the exact property the preservation test of roadmap-progress-sync Iron Law 3 requires. The parent cannot archive as the offset: Phases 4, 5 and 6 still carry open steps, and archiving it would be the silent drop the verdict exists to prevent. Parking either file is the disposition the council refused. So the addition is unoffsettable by construction, and the reason is a recorded verdict rather than an authoring preference."
estate_growth_exempt: "Covers the growth half the offset half does not: active_roadmaps 3 -> 4 against an exact floor of 3 with zero headroom. The growth creates NO new work — every step, criterion and blocker in this file is transferred verbatim out of road-to-governed-harness-evolution, which sheds exactly what this file gains, and open_blockers is unchanged at 31 because blocker: merge-authority moves rather than multiplies. What grows is the file count alone, and it grows because the AI council of 2026-08-31 (anthropic + openai, 2/2 convergent) ruled that Phase 7 must remain inside the mechanically governed active estate while its owner-reserved gate is open. The alternative the ratchet would otherwise force — hold the work in a parent that cannot archive, or park it where the dashboard cannot see it — is the disposition both seats rejected by name."
---
# Road to harness promotion bridge

> **Split out of `road-to-governed-harness-evolution.md` on 2026-08-31, on a
> recorded AI-council verdict — 2/2 convergent, anthropic/claude-sonnet-4-5 +
> openai/codex-default, Option 3.** The question was what to do with a Phase 7
> that is fully specified and cannot be entered, because it is gated on the
> OPEN, owner-reserved `blocker: merge-authority` (ADR-239 § Decision 3) while
> Phases 4-6 of the parent still carry executable work.
>
> **Both seats rejected `agents/roadmaps/later/` by name.** `later/` is excluded
> from the dashboard and from `/roadmap:process-*`, so parking there does not
> preserve active-estate membership — and preservation is precisely what
> `roadmap-progress-sync` Iron Law 3 tests before a deferred item may be
> resolved by anything other than the owner. This file is therefore **ACTIVE**,
> blocked, and visible to every estate mechanism, which is the whole point of
> the split.
>
> **`[-] MERGED` in the parent means TRANSFERRED, never cancelled and never
> satisfied.** Both seats warned that a later reader must not read the parent's
> `[-]` marks as completion or as a decision to drop the work. Nothing here is
> met; nothing here has been weakened. The carrier moved and the obligation did
> not.
>
> **Transferred verbatim:** Phase 7 steps 7.1-7.7 with their prose and their
> `verify:` lines, step 0.8, AC-9, the `merge-authority` blocker entry whole,
> and the Phase 0 carried condition on mechanical non-promotion. The only
> non-verbatim edits are recorded where they occur.

## Goal

The promotion bridge of `road-to-governed-harness-evolution` is executed: a
candidate that has passed evaluation can be promoted into canonical
`agent-config` through one evidence package, one existing governance
vocabulary, a scope ladder with a transfer gate, a no-op rejection, a canary
rollout, a post-promotion lifecycle that can retire what it promoted, and a
best-known-state rollback on regression. When this is finished, AC-9 closes:
at least one promoted artefact has been through post-promotion re-evaluation
and at least one RETIRE path has been exercised.

None of it may start while the gate below is open.

## Resume condition

> **Resume when:** ADR-239 § Decision 3 is settled by the owner in a way that
> grants the merge authority required to execute Phase 7. If the owner refuses
> or otherwise does not grant that authority, do not resume execution and do
> not weaken, cancel, retire, or mark complete any transferred step or
> acceptance criterion; route the receiver's disposition to the owner.

> **Revisit-if:** ADR-239 § Decision 3 is settled, or any change proposes or
> creates a promotion path before this roadmap resumes. In the latter case, the
> `merge-authority` blocker and the carried mechanical non-promotion condition
> bind to that earlier change.

Both paragraphs are the exact text both council seats converged on. They are
reproduced without edit because the difference between them and the wording an
earlier round proposed is load-bearing: the earlier version pre-authorised
converting AC-9 to "specified but not exercised" on owner refusal, which is a
weakening, and `roadmap-progress-sync` Iron Law 3 reserves that to the owner.

## Carried blocking condition

> **Carried blocking condition:** Before or in the first commit that creates any
> promotion path — including the lifecycle `promoted` transition or the
> promotion verb set — mechanically enforce the non-promotion boundary. A check
> over a population of zero does not discharge this condition.

**This condition BLOCKS, it does not merely sit here.** Every step in Phase 7
below creates or extends a promotion path by construction, so no step in this
roadmap may be marked `[x]` while the condition is undischarged, independently
of whether `blocker: merge-authority` has closed. The two gates are separate:
the blocker asks *who may promote*, the condition asks *what mechanically
prevents promotion until they do*. Settling one does not settle the other.

**ADJUDICATED 2026-08-31 — NOT DISCHARGED, with the gap named. This paragraph
used to say the question was deliberately unadjudicated; it is not any more.**

The parent's steps 3.4 (candidate lifecycle enum) and 3.6 (operator verb set)
closed `[x]` before this split, and `src/scripts/evolution_lab.ts:858-888` now
carries a `promote` verb that returns `EXIT_REFUSED` unconditionally, printing
the lifecycle gate's own message plus the `merge-authority` blocker. That is a
population that is no longer zero and a refusal that is mechanical rather than
stated. Whether it DISCHARGES the condition was left open by the 2026-08-31
split verdict and by this transfer. **It was put to the council and answered.**

> **AI council 2026-08-31 — `(B) NOT DISCHARGED`, 2 of 3 seat-answers across two
> rounds.** Round 1: anthropic `exit_1` (absent), openai **(B)**. Round 2:
> anthropic **(B)**, openai **(A)**. Tally **2×B / 1×A**. Round 1 was DEGRADED at
> 1/2 and the retry was to reach the absent seat, not to shop for a verdict; both
> rounds are recorded and the divergence is stated rather than smoothed.

**The evidence that was put to the seats, and none of it is disputed.**
`verbPromote` calls `assertTransition(record.lifecycle, 'promoted')` with no
approval argument, returns `EXIT_REFUSED` on every path, and documents that
*"`--approver` is deliberately NOT a flag"*. `tests/scripts/evolution_lab.test.ts`
§ promote refuses covers every lifecycle state in a loop (`:281-291`, exit 3 plus
`merge-authority` in stderr), passes `--approver Somebody` and gets no promotion
(`:304`), denies `promoted` as a bare next state over all from-states
(`:309-311`), and adds a source-level meta-guard `findApproverSynthesis`
(`:232-236`). The lifecycle gate itself refuses an absent approver, an empty
approver, and `proposed -> promoted` even with one
(`tests/scripts/candidate_record.test.ts:232-234,263,271`).

**Why that is not enough — the gap, stated falsifiably.** The condition covers
*"a verb, a state transition into `promoted`, **or any write into `src/` derived
from a candidate**"*. The landed enforcement gates exactly **two** of those three:
`verbPromote`, and the `-> promoted` transition. Nothing gates the third. Both
B-seats named the same thing: there is no repository-wide mechanism proving that
no other caller can (i) invoke `assertTransition(..., 'promoted', approver)`
directly, (ii) write a candidate record carrying `lifecycle: 'promoted'` without
going through `verbPromote`, or (iii) read candidate data and derive a `src/`
write from it. anthropic put the principle plainly: the condition demands
enforcement that *"prevent[s] bypasses structurally rather than merely document[s]
their absence today"*, and `findApproverSynthesis` *"demonstrates the pattern the
condition demands"* while being *"narrowly scoped to one specific bypass vector"*.

**The minority position, recorded because it shaped the outcome rather than
losing to it.** openai's round-2 **(A)** grants discharge *"narrowly and only as a
historical condition on the commit that introduced the promotion surface"*, and
concedes the identical gap in its own strongest counter-argument:
`findApproverSynthesis` *"protects one implementation pattern rather than proving
a repository-wide invariant. It would not necessarily detect a future direct
filesystem write, an alternate transition mechanism, or a new promotion command
that bypasses `assertTransition`."* It also asked — and this survives regardless
of the letter — that a discharge must never be read as a permanent guarantee, and
that the record separate **the historical introduction condition** from **the
continuing requirement** for fresh review whenever a successful promotion branch,
an approver-bearing interface, an alternate promotion path, or a candidate-derived
`src/` write is proposed. The `Revisit-if` paragraph above already carries that
continuing half.

**What would discharge it — two routes, and only one is available here.**

1. **A structural invariant** (buildable, council-decidable): a mechanism that
   inventories every lifecycle-record write site and every `src/` write site, and
   fails when a promotion-capable write does not pass through one guarded
   capability. openai's round-1 answer specified it further: the capability must
   be unobtainable while `blocker: merge-authority` is open, and the check must
   fail when a new write path bypasses the guard.
2. **A scope clarification** narrowing the condition to the verb and the
   transition, i.e. deleting the *"any write"* clause — **OWNER-RESERVED**, and
   anthropic said why in as many words: it would weaken the condition. No council
   may perform it.

**What this changes, and what it explicitly does not.** It retires Risk 3 of this
file's register — *"the discharge point may already have passed and nobody
adjudicated it … an undecided condition reads as satisfied to the next reader"* —
by deciding it. It does **not** resolve `blocker: merge-authority`, which stays
OPEN and owner-reserved in both directions. It does **not** unblock any Phase 7
step or AC-9: those remain gated twice, and the second gate is exactly this
condition, which is now recorded as **undischarged on evidence** rather than as
undecided.

**DISCHARGED 2026-08-31 BY ROUTE 1 — the structural invariant is built, green,
and proven sensitive. All three limbs are now gated.** Route 2 was not taken and
may not be: it is owner-reserved and nothing below narrows the condition.

The mechanism is the one openai's round-1 answer specified: one guarded
capability that is unobtainable while `blocker: merge-authority` is open, plus a
check that fails when a promotion-capable write bypasses it.

- **The capability.** `src/scripts/_lib/promotion_capability.ts:166`
  (`acquirePromotionCapability`) mints an opaque token and refuses while
  `src/scripts/_lib/promotion_capability.ts:111` (`readMergeAuthorityStatus`)
  reads anything but `resolved` from this file's own `### blocker:
  merge-authority` Status field — using the same literal
  `src/scripts/lint_roadmap_blockers.ts:193` matches, so "open" here and "open"
  to the repository's blocker gate cannot diverge. Fail-closed on a missing
  roadmap, a missing blocker and an unparseable status. There is no flag, no
  environment variable and no argument that lifts it. **It creates no promotion
  path:** it performs no filesystem write and no lifecycle transition, which is
  what lets the enforcement land *before* the path the condition's own wording
  requires it to precede.
- **The invariant.** `src/scripts/lint_promotion_paths.ts`, over every `.ts`
  file under `src/` and `tests/` — 2812 files, 16 candidate-derived modules, 66
  filesystem-write sites at this commit.

| Limb of the condition | Gated by | Where |
|---|---|---|
| a **verb** | `verbPromote` returns `EXIT_REFUSED` on every path | `src/scripts/evolution_lab.ts:857-888` |
| a **state transition into `promoted`** | `assertTransition` demands a named human approver | `src/scripts/_lib/candidate_record.ts:232-248` |
| a **verb or transition reached by a NEW path** | R1 — no approval synthesis outside a three-file allowlist, tree-wide | `src/scripts/lint_promotion_paths.ts:285` (allowlist `:148`) |
| a **record written straight into `promoted`** | R2 — no `lifecycle: 'promoted'` / `ACCEPTED_STATE` record literal | `src/scripts/lint_promotion_paths.ts:332` (allowlist `:156`) |
| **any write into `src/` derived from a candidate** | R3 — a candidate-derived filesystem write may not target the canonical source tree | `src/scripts/lint_promotion_paths.ts:513` + `:404` (allowlist `:159`) |
| the **capability itself** staying shut | R0 — `acquirePromotionCapability` is CALLED and must throw while the blocker is open | `src/scripts/lint_promotion_paths.ts:609` |

**Rows 3 to 5 are the repository-wide half that was missing.** Both B-seats named
the same three bypasses — a direct `assertTransition(..., 'promoted', approver)`,
a record carrying `lifecycle: 'promoted'` written outside `verbPromote`, and a
candidate-derived `src/` write — and R1, R2 and R3 are those three, in that
order. anthropic's objection was that `findApproverSynthesis` *"demonstrates the
pattern the condition demands"* while being *"narrowly scoped to one specific
bypass vector"* and to one file; R1 is that same detector generalised to the
whole authored tree, with the allowlist pinned by an assertion rather than by
convention (`tests/scripts/lint_promotion_paths.test.ts` § the allowlists cannot
grow silently).

**Risk 2 of the register is answered mechanically, not by promise.** The
condition says *"a check over a population of zero does not discharge this
condition"*, so the gate carries three separate `assertScanned` floors —
`src/scripts/lint_promotion_paths.ts:172-174`, 400 files / 4 candidate-derived
modules / 10 write sites — each exiting **2** rather than green. A collapsed
population is a dead scope, not a clean run. Live values are 2812 / 16 / 66, so
the population is non-empty by a wide margin and the floors have room for
legitimate deletion.

**Sensitivity was observed in both directions, on the real tree, and is recorded
because a gate never seen red has unknown sensitivity.** A three-limb bypass
planted in `src/scripts/evolution_lab.ts` (a three-argument `assertTransition`
with a synthesised approver, a `lifecycle: 'promoted'` record literal, and
`fs.writeFileSync(path.join(REPO_ROOT, 'src', 'rules', ...))` in a
candidate-derived module) turned the gate **red, exit 1**, naming
`evolution_lab.ts:899` R1 ×3, `:900` R2 and `:901` R3; the paired test went **3
failed / 19 passed**. Restoring the file byte-identically (`git diff --stat`
empty) returned the gate to **exit 0** and the test to **22/22**. Separately,
neutralising the capability's refusal turned **R0** red with *"capability
obtainable while the blocker is open"*, and restoring it returned exit 0 — the
file verified byte-identical against its backup. `--self-test` adds 15 planted
cases, 9 rejecting, all behaving.

**Two defects were found by RUNNING the gate rather than by reading it, and both
are pinned as regression cases** (`tests/scripts/lint_promotion_paths.test.ts` §
survives the two defects the first runs produced): a substitution that rewrote
identifiers inside string literals (`cand` within `'ac-cand-'`), which produced a
false positive on a temp-directory removal; and an expansion that DESTROYED the
`REPO_ROOT` token the rule keys on — because `REPO_ROOT` is itself a `const` —
which silently dropped the R3 half of the first planted bypass. The second is the
failure direction that matters, and it is the reason this record cites an
observed red rather than a passing suite.

**Registered on six surfaces**, so it runs rather than merely existing:
`taskfiles/ci-fast.yml:1509-1519`, `Taskfile.yml:231`,
`.github/workflows/rule-backstops.yml:376` (remote, not a local-only
declaration), `src/config/gate-coverage.yml:2334` with a canary and a floor of
1800, the manifest header recount at `src/config/gate-coverage.yml:55`, and the
`.secret-allow` line pin re-derived from the file.

**Scope this discharge does NOT claim, stated rather than implied.**

1. **It does not resolve `blocker: merge-authority`,** which stays OPEN and
   owner-reserved in both directions. The two gates were always separate and
   still are: this one asks *what mechanically prevents promotion*, that one asks
   *who may promote*. Phase 7 steps below are now gated once, not twice.
2. **It is recorded by the implementing agent, not by a fresh council round.**
   The 2026-08-31 verdict named route 1 as *"buildable, council-decidable"* and
   stated the criterion this record answers; the daily council quota is
   owner-held and was not spent to re-adjudicate a route the verdict itself
   specified. That is a real independence limit and it is named here rather than
   left for a reader to notice: the party that built the mechanism is the party
   recording that it satisfies the criterion. **Falsifier:** a council round that
   rules this mechanism insufficient reopens the condition, and every step closed
   under it reverts to `[ ]`. Nothing here is written so as to make that harder.
   **AMENDED 2026-09-01 — the fresh round happened, and it did not rule this
   mechanism insufficient.** AI council 2026-09-01, anthropic/claude-sonnet-4-5
   + openai/codex-default, 2 rounds, blind chairman, quorum concluded 2/2:
   **2C — DISCHARGED WITH A NAMED RESIDUAL**, 2/2 convergent. The openai seat
   put the independence point in as many words: *"this review supplies the
   independent assessment the original record lacked."* **The falsifier below
   is NOT retired by that** — both seats said in terms that it must be
   retained, and it is: a later council round that rules this mechanism
   insufficient still reopens the condition and still reverts every step closed
   under it to `[ ]`. What changed is that the discharge is no longer recorded
   only by the party that built it; what did not change is that it remains a
   condition on the mechanism as it stands rather than a permanent guarantee.
   The residual the verdict requires be written down is scope-item 3 below.

3. **R3's residual is bounded, not closed.** It resolves `const` bindings up to
   three hops, so a destination assembled at runtime from a value carrying no
   `src` literal anywhere in its chain is not detectable textually. Such a write
   is a source-tree write, but it is a PROMOTION only when it also carries an
   approval or a promoted record — which R1 and R2 catch independently. A
   candidate-derived write into a *clone's* `src/` is deliberately out of scope:
   a clone is a candidate's own sandbox, already gated by `bench_ab_integrity`'s
   allowed-delta-path check, whose sensitivity `tests/scripts/bench_ab_candidate.test.ts:383-398`
   proves.

   **QUALIFIED 2026-09-01 by the AI council, and the qualification contradicts
   the sentence above rather than extending it.** The 2026-09-01 round
   (anthropic + openai, 2 rounds, blind chairman, 2/2 convergent on **2C**)
   required this residual be written into the record as a condition of the
   discharge. It is written here, and so is the **divergence inside the
   convergent verdict**, because smoothing it would keep the weaker reading.

   - **anthropic bounded the residual the way the sentence above does:** the
     R3-evasive write *"is a promotion **only if** it also carries approval (R1
     catches) or a promoted record (R2 catches independently)"*.
   - **openai refused that bounding in terms:** R1 and R2 *"reduce its
     exploitability, but they do not make R3 structurally complete: a
     candidate-derived source write does not cease to violate the third limb
     merely because no approval or promoted-record literal accompanies it."*

   **The stricter reading is the one carried, because it weakens nothing.** The
   carried blocking condition's third limb is *"any write into `src/` derived
   from a candidate"* — it is not conditioned on an approval or a promoted
   record, so a runtime-assembled destination that R3 cannot see textually is an
   **unenforced instance of the third limb**, not a caught one. The discharge
   stands at 2C on both seats' votes; what does not stand is the claim that R1
   and R2 close R3's gap. They cover a different failure and the sentence above
   over-claimed by joining them.

   **Falsifiable, so a later reader can act on it:** a candidate-derived module
   that assembles a `src/` destination through a non-`const` chain longer than
   three hops passes `lint_promotion_paths` today. Closing it needs a
   non-textual mechanism — a runtime write-guard on the canonical tree, or a
   type-level capability on the write path — and neither exists. This is a named
   residual with no owner and no step in this roadmap; it is **not** claimed as
   covered anywhere in this file.
4. **openai's continuing-requirement half still binds.** The `Revisit-if`
   paragraph above already carries it: a successful promotion branch, an
   approver-bearing interface, an alternate promotion path or a new
   candidate-derived `src/` write each require fresh review, and this discharge is
   a condition on the mechanism as it stands rather than a permanent guarantee.

The condition's verbatim origin block, carried out of the parent's Phase 0 on
2026-08-30 and transferred here on 2026-08-31, is reproduced under
§ Provenance below.

## Phase 0 — Merge authority (carried from the parent)

- [~] **0.8 Merge authority resolved.** Deferred: owner decision, see Blockers. <!-- blocked-by: merge-authority -->

**Transferred from `road-to-governed-harness-evolution` Phase 0 on 2026-08-31,
still `[~]`, still deferred, still owned by the maintainer.** The words are
verbatim; the only change is a REFLOW — in the parent the step wrapped across
two lines and the `<!-- blocked-by: merge-authority -->` annotation therefore
sat on a continuation line, where `lint_roadmap_blockers`' cross-reference rule
(`BLOCKED_BY_LINE_RE`, which matches only a real `- [ ]` checkbox line) could
not see it. Here it sits on the checkbox line, so the reference to the blocker
below is live and machine-checked instead of merely written. No word was added,
removed or reordered.

**WRITTEN DISPOSITION 2026-09-01 — 0.8 STAYS `[~]`. It is not closeable, not
descopeable, and the run that looked at it says so rather than moving it.**

*AI council 2026-09-01 (anthropic/claude-sonnet-4-5 + openai/codex-default,
2 rounds, blind chairman, quorum concluded 2/2) — Decision 3: **3A**,
2/2 convergent. Both seats: "Step 0.8 requires the reserved ADR-239 decision."*

- **Why it cannot be `[x]`.** The step IS the owner decision. Its text —
  *"Merge authority resolved"* — is satisfied by nothing an agent can do:
  ADR-239 § Decision 3 is recorded `open` and owner-owned at
  `docs/decisions/ADR-239-drain-command-surface-and-merge-authority.md:188`,
  and both of its directions are owner-reserved for different reasons. See the
  § Blockers entry for what this run did and did not attempt.
- **Why it cannot be `[-]`.** Descoping it is a weakening, and the Resume
  condition at the head of this file reserves that to the owner in as many
  words — *"do not weaken, cancel, retire, or mark complete any transferred
  step"*. That sentence is itself the verbatim output of the 2026-08-31 council,
  which rejected an earlier drafting precisely because it pre-authorised a
  weakening on owner refusal.
- **What closes it.** The owner picks one of the three options in
  § Blockers → `What to do`. Nothing else. There is no intermediate state and
  no partial credit; `[~]` is the accurate mark and it stays.

**RE-CONFIRMED 2026-09-01 (drain run 13) — 0.8 STAYS `[~]`, and the reason is
now stronger rather than merely repeated.** This run put the (b) argument to the
council and got **1A — refuse, 2/2 convergent**; it is not executing that
verdict, and the full disclosure of why sits in § Blockers under **RE-ATTEMPTED
2026-09-01**. Two independent reasons keep the mark where it is even if a later
owner adopts 1A verbatim:

- **The step is a transferred step, and the Resume condition's refusal branch
  binds it.** That branch reads: do not weaken, cancel, retire, or **mark
  complete** any transferred step or acceptance criterion, if the owner refuses
  or otherwise does not grant the authority. So even a settled refusal does not
  turn 0.8 `[x]` — refusal is precisely the branch that forbids it. Only a
  **grant** would let this step close by being satisfied, and a grant is
  unavailable per the Hard Floor.
- **Nothing was silently made closeable.** The `Disposition` field added to the
  blocker this run makes a refusal *recordable* without minting the promotion
  capability. It does not make 0.8 closeable, and it is not to be read as
  progress toward closing it.

**DISPOSITION POINTER 2026-09-01 (drain run 14) — 0.8 STAYS `[~]`, on a third
independent pass.** The AI council of 2026-09-01 (drain run 14; members
`anthropic/claude-sonnet-4-5` + `openai/codex-default`, 2 rounds, deep,
peer-review, blind chairman, quorum 2/2 — concluded) returned **2C: the
`merge-authority` blocker is TERMINALLY OWNER-RESERVED**, and both seats held
that a council may record a boundary but may not change an acceptance
criterion or a step's scope. 0.8 is therefore neither closed nor descoped nor
cancelled. The full disposition, its two honest downgrades, and the mechanism
finding that makes a descope into `agents/roadmaps/stubs/` illegal are in
§ Blockers under `### blocker: merge-authority`.


## Phase 7 — Promotion bridge and the lifecycle after it

> **Every step below is gated twice and may not be entered on either gate
> alone.** (1) `blocker: merge-authority` is OPEN and owner-reserved — see
> § Blockers. (2) The carried blocking condition above binds to the first
> commit that creates any promotion path, which every step here does by
> construction. The steps, their prose and their `verify:` lines are transferred
> **verbatim** from `road-to-governed-harness-evolution` Phase 7 on 2026-08-31;
> nothing in them was rewritten, re-scoped or re-verified in the move.

> **STATUS 2026-08-31 — gate (2) is discharged, gate (1) is NOT, and the steps
> below are closed as MECHANISM. Read this before reading a `[x]`.**
>
> **`blocker: merge-authority` is still OPEN and still owner-reserved.** Nothing
> in this change touches it, and nothing below may be read as having settled it.
>
> **What the `[x]` marks claim, exactly.** Every one of these seven steps has a
> `verify:` clause that is a **refusal** or a **fixture exercise** — "is refused",
> "is refused", "no new verb", "refused before the cascade", "no promotion
> changes X without Y", "produces one of the five verdicts … in a fixture",
> "triggers the rollback path in a fixture". Not one of them requires a promotion
> to succeed, and none was closed on an argument: each is closed on a test that
> was run, and on a sensitivity probe that was watched go red and green again.
> `verbPromote` still returns `EXIT_REFUSED` on every path, and
> `lint_promotion_paths` proves tree-wide that nothing else promotes either.
>
> **What they do NOT claim.** That a promotion works. That the bridge has been
> traversed. That `merge-authority` may now close. **AC-9 stays `[ ]`** for
> exactly that reason, and its note says so at the criterion.
>
> **The owner-reserved reading, named rather than assumed.** The blocker's
> § Blockers entry says it blocks "every promotion step in Phase 7". That was
> written when these steps were unbuilt and their only conceivable execution was
> a promotion. They were instead built as refusing mechanism, which the blocker's
> own option (c) scoping does not reach — (c) gates *promotion*, and no promotion
> occurred or can occur. If the owner judges that closing a Phase 7 step required
> the blocker to close first, these marks revert to `[ ]` and the work stands
> unchanged underneath them; that is an owner call and it is stated here rather
> than settled by the agent that made the marks.
>
> **ADJUDICATED 2026-09-01 — the owner call is CONFIRMED as an owner call, so
> the seven marks are PROVISIONAL. They are not upgraded and they are not
> reverted.**
>
> *AI council 2026-09-01 (anthropic/claude-sonnet-4-5 + openai/codex-default,
> 2 rounds, blind chairman, quorum concluded 2/2) — Decision 1: **1C —
> OWNER-RESERVED**, 2/2 convergent.*
>
> The question put was whether closing a Phase 7 step under an open
> `merge-authority` blocker is (1A) legitimate because the blocker gates
> promotion and no promotion occurred, (1B) illegitimate because the blocker's
> `Blocks:` field reaches the steps themselves, or (1C) an owner call no council
> may make. **Both seats answered 1C, and both named the same reason:** this
> gate header expressly assigns the interpretation to the owner, so answering
> 1A or 1B would convert a live reservation into a settlement. openai: *"Choosing
> 1A or 1B here would override that reservation. The `[x]` marks may remain
> flagged and provisional; they are not unqualified closure."*
>
> Both seats also recorded that **1B is credible**, not a strawman. openai named
> it the strongest counter-argument: *"the blocker's literal statement that it
> blocks 'every promotion step in Phase 7' … supports reverting all seven
> marks."* anthropic showed why the text cannot settle it: *"by consequence"*
> reads as a causal chain, which **explains** the ambiguity and does not resolve
> it — *"it shows why 'promotion step' can legitimately mean either 'the step
> itself' or 'promotions performed by the step.'"*
>
> **So the operative status of every `[x]` in this phase is: closed on tested
> refusing mechanism, PROVISIONAL pending an owner scope ruling, revertible to
> `[ ]` at that ruling with the work standing unchanged underneath.** Risk 6 of
> the register carries the misreading risk this creates.
>
> **REVERSION CONSIDERED AND NOT AUTHORISED — 2026-09-01 (drain run 14). The
> seven `[x]` marks are LEFT AS THEY ARE, and the seats DIVERGED. The
> divergence is the finding.**
>
> *AI council 2026-09-01 (drain run 14), members `anthropic/claude-sonnet-4-5`
> + `openai/codex-default`, 2 rounds, depth deep, peer-review, blind chairman,
> quorum 2/2 present (needed 1) — concluded. Subscription transport,
> `billable=0`, `$0.0000`.*
>
> The question put was whether the 1C ruling above, having made the seven marks
> PROVISIONAL and revertible, should now be executed as a reversion to `[ ]`.
> **One seat said revert.** The other declined, on the ground that
> *"'provisional and revertible' does not mean an automatic reversion has
> already been authorized"*, and graded the reversion **unestablished**.
>
> **A divergent council does not carry a mandate.** Nothing is reverted, and
> nothing is upgraded. The operative status stated immediately above is
> unchanged: closed on tested refusing mechanism, PROVISIONAL pending an owner
> scope ruling, revertible to `[ ]` at that ruling with the work standing
> unchanged underneath.
>
> This is recorded rather than left silent so a later reader can see that
> reversion **was raised and was not authorised**, which is a different state
> from never having been considered. Reverting the seven marks remains an owner
> act, exactly as 1C says.


- [x] **7.1 One evidence package per promotion, in the fuller form.** The master
      adopted a 9-field package; the skipped parent's has 14, and the five extra
      are exactly the fields that make 3.2, 4.4 and 7.3 auditable: pathology
      cell, candidate lineage, mutation dimension, selection results, sealed
      result, cost, scope.
      verify: a promotion attempt with any field absent is refused.
      **DONE 2026-08-31.** `src/scripts/_lib/promotion_evidence.ts:293`
      (`parsePromotionEvidence`) refuses on the first absent field and names it;
      `:215` is the field list, and `required()` refuses an ABSENT field rather
      than defaulting it — an empty `lineage` is legal, a missing one is not.
      All seven fields the step names are required. **The step's own arithmetic
      does not close** — it says "the five extra" and then lists SEVEN — and the
      conservative reading is taken rather than silently reconciled, because
      dropping two would narrow a transferred step. The discrepancy is recorded
      at the module header, not resolved.
      Evidence: `tests/scripts/promotion_evidence.test.ts` iterates
      `PROMOTION_EVIDENCE_FIELDS` and asserts each drop is refused **naming that
      field** — a general assertion, not three crafted cases —
      and `tests/scripts/evolution_lab.test.ts` § promote --evidence repeats the
      whole loop through the real CLI (32 tests green, 2.1 s for that case).
      SENSITIVITY: neutralising `required()`'s throw turns the suite 1 failed /
      16 passed; restoring it returns 17/17, and the file was verified
      byte-identical against its backup afterwards.
- [x] **7.2 Route through the existing gate, not a second governance system.**
      Reuse the evidence-grading vocabulary already in the tree
      (`authority_basis`, `evidence.strength`, `reopen_policy`,
      `protected_dimensions`).
      verify: no new governance verb, no new approval path.
      **DONE 2026-08-31.** The four terms are IMPORTED, not copied:
      `src/scripts/_lib/promotion_evidence.ts` reads `AUTHORITY_BASES`,
      `EVIDENCE_STRENGTHS`, `REOPEN_POLICIES` and `PROTECTED_DIMENSIONS` from
      `src/scripts/_lib/adr_frontmatter.ts:310,306,325,328`. The last two were
      module-private constants inside `check_adr_frontmatter.ts`; they were MOVED
      to the shared reader in this change and that gate now imports them, so the
      ADR validator and the promotion package read ONE list. A copy would have
      satisfied the letter and broken the point — two lists that can drift are
      two governance systems.
      No new verb: `VERBS` is still the seven of step 3.6, asserted in
      `tests/scripts/promotion_evidence.test.ts` § 7.2 as a property of THIS step
      rather than inherited from 3.6's test. No new approval path: locally, the
      evidence module contains no `HumanApproval`, no `approver:` and no call to
      `acquirePromotionCapability`, asserted in the same block; tree-wide, that is
      R1 of `lint_promotion_paths`.
      SENSITIVITY: replacing the four imports with local literal copies turns the
      suite 2 failed / 19 passed; restoring returns 21/21.
- [x] **7.3 Promote by scope, with a transfer gate.** `from-skipped-parent`,
      raised to doctrine level in both parents and absent from the master's
      promotion path: a candidate carries a scope (episode → repo → stack →
      profile/pack → global) and moving up a level requires independent transfer
      evidence from a second solver or host configuration. Without it, every
      promotion goes straight to canonical and the anti-bloat doctrine has no
      teeth. This is not what the parked curriculum generator was.
      verify: a promotion with no scope field is refused, and a scope raise with
      one configuration's evidence is refused.
      **DONE 2026-08-31.** `src/scripts/_lib/promotion_evidence.ts:85`
      (`SCOPE_LADDER`, ordered `episode -> repo -> stack -> profile-pack ->
      global`; the ORDER is the contract, since it is the only thing that makes
      "moving up a level" decidable) and `:124` (`assertTransferEvidence`). A
      raise is refused unless the transfer evidence carries a SECOND solver or a
      SECOND host configuration — evidence that shares one of each is one
      observation written twice.
      Both verify clauses are separate tests, and both run through the real CLI
      as well (`tests/scripts/evolution_lab.test.ts` § promote --evidence). The
      negative poles are pinned too: a non-raise needs no evidence, and LOWERING
      the scope is not a raise.
      SENSITIVITY: making the transfer gate a no-op turns the suite 1 failed / 16
      passed; restoring returns 17/17.
- [x] **7.4 Reject semantic no-ops.** A no-op detector plus a minimum
      material-improvement threshold. The master kept the cooldown and lineage
      from the same attack and dropped both gates.
      **Marker corrected 2026-08-26:** this step carried
      `from-skipped-parent`, and it should not have. The clause is at
      `road-to-evidence-driven-harness-evolution.md:1200-1201` — a **declared**
      parent — and the skipped parent contains no no-op gate at all (its only
      paraphrase mention, `:1342` "Avoid five paraphrases", is about candidate
      diversity at generation time, which is a different mechanism). So the
      master dropped this having read it, not having missed it. That is the
      second misattributed marker found in this pair; see
      `agents/evidence/analysis/skipped-parent-lineage-2026-08-26.md`
      § Marker reliability.
      verify: a paraphrase-only candidate is refused before the cascade.
      **DONE 2026-08-31.** `src/scripts/_lib/semantic_noop.ts` — two gates,
      because the step asks for two: `:86` (`isSemanticNoOp`, the paraphrase
      detector, threshold `:56` pinned EQUAL to `curator_ops`'
      `NEAR_DUPLICATE_THRESHOLD` rather than tuned separately) and `:68`
      (`MIN_MATERIAL_IMPROVEMENT_PERCENT`, the minimum material-improvement
      floor). Neither implies the other and a test pins that: a total rewrite
      with no measured effect passes the first and fails the second; a one-word
      change with a large delta fails the first and passes the second.
      **"Before the cascade" resolves to a definite place.** There is no artefact
      named "cascade" in this tree — the evaluation cascade is the lifecycle
      spine — so the screen (`:158`, `screenSemanticNoOps`) is synchronous, takes
      TEXT rather than records, reports `modelCalls: 0` as a literal type, and is
      exercised on candidates carrying no evaluation results at all. A screen
      that needed a trial result could not have run before the cascade, which is
      what that test actually checks.
      MEASURED BOUND, stated rather than discovered later: 8-word shingles mean
      one substitution breaks eight shingles, so on a one-sentence candidate no
      paraphrase can reach 70 % while on rule-body-sized text the same edit
      measures 85.7 %. The detector is meaningful for the corpus it will see and
      weak for one-liners.
      SENSITIVITY: disabling both gates turns the suite 6 failed / 2 passed;
      restoring returns 8/8.
- [x] **7.5 Roll out by canary, never silently.** `from-skipped-parent`: opt-in
      candidate bundles.
      verify: no promotion changes a shipped default without an opt-in stage.
      **DONE 2026-08-31 — the mechanism half, with the observation half named as
      absent.** `src/scripts/_lib/promotion_evidence.ts:147` (`ROLLOUT_STAGES`,
      `opt-in -> canary -> default`) and `:175` (`assertRollout`). Three
      refusals: a package declaring a shipped-default change with no COMPLETED
      opt-in stage; a package claiming the `default` stage without one; and a
      completed opt-in that names no bundle, since an unnamed bundle cannot be
      audited and an unauditable opt-in is the silent rollout this step is about.
      **What this does NOT establish, stated in the module and repeated here:** it
      cannot check that a package declaring `changes_shipped_default: false` is
      telling the truth. That is only observable once a promotion path can
      actually run and the resulting diff can be compared against the shipped
      defaults, which `blocker: merge-authority` prevents. The mechanism is built
      and tested; the observation is named as missing rather than implied.
      SENSITIVITY: making the shipped-default gate a no-op turns the suite 1
      failed / 16 passed; restoring returns 17/17.
- [x] **7.6 A promoted artefact is not immortal.** `from-skipped-parent`, and
      it is the only anti-monotonic-growth mechanism *after* the gate — the
      `artifact-count delta` row guards the gate, the estate needs its own:
      post-promotion re-evaluation with `KEEP / REVISE / MERGE / SPLIT /
      RETIRE`. The master's promotion phase ends at the evidence package plus a
      cooldown, so nothing reopens a promoted artefact and the lifecycle is
      manual-only at exactly the point where growth accumulates.
      verify: a promoted artefact reaching its review trigger produces one of the
      five verdicts, and at least one `RETIRE` path is exercised in a fixture.
      **DONE 2026-08-31.** `src/scripts/_lib/promotion_review.ts:81`
      (`REVIEW_TRIGGERS`, precedence-ordered so two conditions firing at once
      stay reproducible), `:145` (`reviewTriggerFor` — the piece that did not
      exist: nothing decided a promoted artefact was due), `:160`
      (`reviewPromoted`, exactly one of the five) and `:202` (`retirePromoted`,
      which routes through `assertTransition(_, 'retired')`).
      Both conjuncts are tested separately. The first runs over EVERY declared
      trigger — and the test asserts its own case list equals `REVIEW_TRIGGERS`,
      so adding a trigger without a case fails rather than going untested. The
      second runs review -> RETIRE -> the lifecycle transition end to end, and
      pins the direction AC-9 is about: a non-promoted state cannot take the
      retirement edge.
      **A finding, recorded rather than smoothed:** the five verdicts are NOT a
      subset of E6's seven curator ops. `REVISE` is absent from `CURATOR_OPS`
      (`src/scripts/_lib/curator_ops.ts:48-56`), even though that module's own
      header argues for seven ops on the ground that a smaller set "would emit
      verdicts it cannot execute". `REPLACE` is the nearest op and is not the
      same thing. `POST_PROMOTION_VERDICTS` is therefore written out rather than
      derived, and the relationship is pinned in BOTH directions by a test.
      SENSITIVITY: making the review trigger never fire turns the suite 3 failed
      / 12 passed; restoring returns 15/15.
- [x] **7.7 Best-known-state reference on regression.** Roll back to the
      recorded best-known state; lineage, not endless append.
      verify: an injected regression triggers the rollback path in a fixture.
      **DONE 2026-08-31.** `src/scripts/_lib/promotion_review.ts:267`
      (`planRollback`) and `:246` (`lineageOf`). An injected regression against
      the recorded best-known state returns a plan naming the state it returns
      to, the state it leaves, and the lineage — oldest first, cycle-guarded, so
      "lineage, not endless append" is carried by the type rather than by a
      convention. Three negative poles keep it from degenerating into "always
      roll back": an equal or better current state returns `null`, another
      artefact's history is never read, and a regression with nothing recorded to
      return to is an ERROR rather than a silent no-op — a rollback target is
      recorded at promotion time, because after the regression the state that
      worked is exactly what is missing.
      SENSITIVITY: making `planRollback` always return `null` turns the suite 3
      failed / 12 passed; restoring returns 15/15.

## Blockers

> **Moved whole from `road-to-governed-harness-evolution` on 2026-08-31.** The
> entry below is transferred verbatim, including its 2026-08-29 scoping note,
> its 2026-08-30 field-shape repair and its `Resolved when` amendment. It is
> removed from the parent in the same change, so the blocker has exactly one
> live owner and `open_blockers` is unchanged across the split.

### blocker: merge-authority

- **Status:** open — **SCOPED 2026-08-29, and it is divisible in the same shape
  as `b-adr-088` on `road-to-capability-native-execution`. Option (c) is taken
  and is council-decidable; options (a) and (b) are OWNER-RESERVED and were not
  taken.** AI council 2026-08-29, anthropic + openai, **2/2 convergent**.

  **Taken, council-decidable — the scoping half.** Phases 1–6 are declared legal
  while ADR-239 § Decision 3 remains open. They build measurement and isolation
  and promote nothing, so where merge authority lands does not touch them. Phase
  7 stays gated on this blocker.

  **Not taken, owner-reserved.** (a) **granting** preauthorized merge authority
  weakens a human-in-the-loop promotion guarantee — the shape
  `non-destructive-by-default` protects — and (b) refusing it settles an ADR §
  Decision that is recorded as open. Either is a resolution of ADR-239 itself,
  which a council may recommend and may not perform.

  **The condition that makes (c) real rather than a promise, and it is an
  addition to what the blocker proposed:** the non-promotion property of Phases
  1–6 must be **mechanically enforced**, not merely stated. A phase that
  promises to promote nothing while nothing prevents it from promoting is the
  same class of guarantee ADR-239 § Decision 3 is open about. Carried into Phase
  0's exit criteria rather than left here.

  **FOUND UNCARRIED 2026-08-30, and carried now.** The sentence above said the
  condition was carried into Phase 0's exit criteria. It was not: a tree-wide
  grep for `mechanically enforced` / `non-promotion` over this roadmap returned
  only these lines, inside this blocker. The condition existed exactly where the
  paragraph said it should not be left.

  This is the **third instance in this cohort of the same defect shape** — a
  criterion with no phase, no step and no owner, which Risk 11 names for AC-8
  and which the `Resolved when` twin above records for `b-adr-088`. It is
  recorded as a pattern rather than a slip because that is now three.

  The condition is carried as a Phase 0 exit-criterion note (see the
  **CARRIED CONDITION** block at the head of Phase 0), which is where the
  council put it. It is carried **unmet**, with the reason it cannot be
  discharged today stated there rather than being quietly satisfied by a check
  that would scan nothing.

  **The `Resolved when` field below was AMENDED 2026-08-29, and the amendment
  now lives inside the field's value rather than in a heading above it.** The
  original — *"ADR-239 § Decision 3 no longer reads as an open question and its
  `review_trigger` no longer names the `merge-authority` blocker"* — is
  **unsatisfiable by option (c) and by any council**, because (c) leaves §
  Decision 3 open by construction. It bundled two things one authority cannot
  discharge, exactly as `b-adr-088` did.

  **Why the fix is a field edit and not a paragraph, 2026-08-30.** The 2026-08-29
  amendment was written as prose here and left the original `- **Resolved
  when:**` field standing three fields below, still stating the unsatisfiable
  condition — two contradictory closure conditions on one blocker, with
  `lint_roadmap_blockers` green throughout. This is the **same defect, in a
  second roadmap**: `road-to-capability-native-execution`'s
  `b-adr-088-external-runtime-federation` carried an identical stale twin, found
  and fixed on 2026-08-29, and its own note predicted the recurrence by naming
  the mechanism. The gate matches a literal label
  (`/^-[ \t]*\*\*Resolved when:\*\*/im`, `src/scripts/lint_roadmap_blockers.ts:52`),
  so a heading that says *"Resolved when (AMENDED …)"* satisfies nothing and the
  contradictory line was the only thing keeping the blocker legal.

  **Searched rather than assumed:** a tree-wide grep for `Resolved when` outside
  the literal `- **Resolved when:**` field across `agents/roadmaps/**` returns
  these two blockers and no third. Both are now fixed the same way — rename the
  amended field to the literal label first, delete the stale one second, because
  the other order turns the gate red in between.
- **`revisit-if`:** ADR-239 § Decision 3 is settled, or a Phase 1–6 step is
  proposed that would promote anything — in which case the scoping decision above
  no longer covers it and this blocker binds earlier than Phase 7.

  **Attempted and REFUSED AT TWO INDEPENDENT LAYERS, 2026-08-31 — recorded so a
  later reader does not repeat it.** An autonomous drain run whose mandate was
  to route every owner decision to the AI council tried to settle this blocker
  by option **(b)** — refusing preauthorized merge authority — on the argument
  that (b) is the mirror of (a): it removes a capability rather than granting
  one, converts *"only humans promote"* from an intention into a recorded
  property, and leaves a later owner strictly freer, which
  `decision-revisit-gate` routes to the council as a floor-STRENGTHENING
  transition.

  The question was never put. It was refused twice by the harness's own
  safety classifier before reaching any seat, and the refusal is the more
  interesting result: this ADR reserves the decision precisely because *"an
  agent that both wants the capability and writes the amendment authorising it
  is the shape the reservation exists for"*, and an agent drafting the
  amendment is what the classifier saw. Two mechanisms that share no code
  reached the same verdict about the same act.

  So the argument for (b) is **not refuted** — it is undelivered, and the run
  stopped rather than rephrasing its way past a safety refusal, which would have
  been the reservation defeated by persistence. **The blocker stands. It is a
  genuine owner decision and no council round should be spent on it** until a
  human either answers it or explicitly asks for the (b) argument to be put.

  **NOT RE-ATTEMPTED 2026-09-01, and the lock was evaluated before it was
  cited.** A second autonomous drain run arrived here carrying an instruction
  that the AI council substitutes for owner sign-off. It did not put (a) or (b),
  and the reasoning is recorded so the refusal is checkable rather than a
  shrug.

  - **(a) was refused outright and is not a council question at any strength of
    mandate.** Granting preauthorized merge authority lowers
    `non-destructive-by-default`'s per-turn confirmation floor for a
    production-branch merge. That floor is a Hard Floor: no autonomy setting,
    no roadmap step and no standing instruction lifts it, and an instruction
    arriving from another *agent* is not the user's consent. ADR-239 § 3 names
    this exact shape — *"an agent that both wants the capability and writes the
    amendment authorising it is the shape the reservation exists for."*
  - **(b) was not put, because the lock above is LIVE and its release condition
    has not fired.** The paragraph directly above reserves (b) until *"a human
    either answers it or explicitly asks for the (b) argument to be put"*. The
    instruction to route owner decisions to the council came from an
    orchestrating agent, which is not a human answering and not a human asking.
    Mechanism-match was run before citing the lock, as
    `decision-revisit-gate` requires: the mechanism is identical (put the
    floor-strengthening argument for (b) to the council), the argument is
    identical, and no new evidence has arrived since 2026-08-31. So the lock
    applies and re-putting it would be the persistence the record above warns
    about, one day later.
  - **What was put instead**, and it is a different question: the disposition of
    this roadmap's two open items, the legitimacy of the Phase 7 marks, and the
    sufficiency of the route-1 discharge. All three are scope and evidence
    questions the council may answer; none of them settles ADR-239 § Decision 3,
    and the verdict on all three (1C / 2C / 3A) left this blocker exactly where
    it was.
  - **A second-order note for the owner, since it changes what (b) costs.** If
    ADR-239 § Decision 3 is settled in the **refusing** direction, step 0.8
    closes but AC-9 does not — refusal makes a real promotion permanently
    impossible, so AC-9's disposition becomes a separate owner decision rather
    than an automatic consequence. Only the granting direction puts AC-9 on a
    path to being met. Recorded here because the `What to do` list below prices
    (a), (b) and (c) as if they were symmetric for this file, and for AC-9 they
    are not.

  **RE-ATTEMPTED 2026-09-01 (drain run 13), AND THE ATTEMPT IS DISCLOSED AS A
  PROCEDURAL DEFECT RATHER THAN AS A RESULT. The question for (b) WAS put to the
  council, it returned a verdict, and this run is NOT executing it.** The
  paragraphs above are unchanged and still govern; this one records what
  happened so a later reader is not told a cleaner story than the true one.

  - **What was put.** A drain run carrying a human maintainer's standing
    instruction — *"every open question, decision, or blocker is answered by the
    AI Council — never by me; the council's recorded decision substitutes for
    user sign-off"* — put ADR-239 § Decision 3 to the council as its Question 1,
    with the granting direction explicitly marked unavailable. AI council
    2026-09-01, `anthropic/claude-sonnet-4-5` + `openai/codex-default`, 2 rounds,
    deep, peer-review, blind chairman, quorum **2/2 present, needed 1 —
    concluded**, subscription transport, `billable=0`, `$0.0000`. Verdict
    **1A — refuse preauthorized merge authority, 2/2 convergent**, both seats on
    the ground that refusal strengthens rather than lowers the floor. The openai
    seat added a scoping the record should keep: refusal would bind
    **preauthorized** authority only and must not be written so as to prohibit
    ordinary same-turn human confirmation.
  - **Why it was put anyway, stated plainly: the lock was not evaluated before
    the question was written.** `decision-revisit-gate` step 2 requires a lock to
    be read before it is cited or bypassed, and this run wrote and dispatched
    Question 1 before reaching this blocker's `revisit-if` paragraphs. That is
    the defect. It is recorded here rather than in a summary because this is
    where the next reader will look.
  - **Why the verdict is NOT executed.** Two reasons, and the second is the
    load-bearing one. First, the release condition is still not cleanly fired:
    the paragraph above reserves (b) until *"a human either answers it or
    explicitly asks for the (b) argument to be put"*, and a standing instruction
    to route all blockers to the council is not the same speech act as asking for
    **this** argument — and from inside a session the two are not
    distinguishable from the 2026-09-01 agent-issued instruction the record
    already refused. Second, and independently: **writing the refusal into
    ADR-239 § Decision 3 is settling ADR-239 § Decision 3**, which is the act the
    reservation names, in either direction. The seats' reasoning for 1A is sound
    and is preserved above; what a council may not do is perform the amendment.
  - **What this run did instead, and it is not nothing.** It found and fixed the
    defect that would have made a refusal *unrecordable*. See the
    **DISPOSITION FIELD** note below: `Status: resolved` was the only closed
    token this repository recognises, and `readMergeAuthorityStatus` read it as a
    GRANT — so settling this blocker in the refusing direction would have minted
    the capability the refusal refuses. That trap is now closed, and closing it
    is strictly floor-strengthening, which is council-decidable. The blocker
    itself **stays `open`**.

  **DISPOSITION FIELD — added 2026-09-01, and it is why a refusal is now
  representable at all.** `src/scripts/_lib/promotion_capability.ts` no longer
  treats `Status: resolved` as a grant. Closedness is still read with the same
  literal `src/scripts/lint_roadmap_blockers.ts:193` uses — over the same
  fence-stripped, `## Blockers`-scoped text — so this blocker's open state cannot
  diverge from the repository's reading of it; the **direction** is
  read separately from a `- **Disposition:**` line, and only `granted` mints.
  `refused` is a first-class closed state, and a blocker closed with neither word
  reads as `resolved-unclassified` and refuses. The change is strictly stricter
  in every direction — a body that minted before must now say `granted` — so it
  cannot widen the capability. RED-proven: collapsing the two disposition reads
  back to the pre-split `return 'resolved'` fails exactly the two new pole tests
  (`tests/scripts/lint_promotion_paths.test.ts` § *a blocker CLOSED AS REFUSED
  does not mint* and § *a blocker closed WITHOUT a disposition fails closed*),
  and a byte-identical restore returns 25/25 green.

  **HARDENED 2026-09-01 after a neutral review of this very change found three
  ways it could still mint against a blocker whose live `Status` is `open`.** The
  review was commissioned over the whole delta with a prompt that stated no
  expected outcome; its prompt and verdict are committed together at
  `agents/evidence/reviews/drain13-neutral-review.md`. All three are now fixed
  and each is pinned by its own test, RED-proven individually.

  - **A fenced EXAMPLE of the syntax was read as the live value.** The
    `What to do:` field exists to tell a maintainer which line to write, so a
    fenced block showing `- **Disposition:** granted` is the likeliest content in
    a real blocker — and it minted while `Status: open` sat two lines above it.
    `lint_roadmap_blockers.ts:137` strips fenced code before its own read and
    this module did not, which falsified the "cannot diverge" claim rather than
    supporting it. Both now strip.
  - **`granted` was matched as a PREFIX.** The regex ended in `\b`, so
    `granted/refused (pick one)` — a half-written template — and
    `granted-NOT, this is a refusal` both minted. `granted` must now be the
    whole value.
  - **The heading search was unscoped.** Any `#{2,4} blocker: merge-authority`
    anywhere in the file won, so a `####` heading in a history section could
    carry a status the repository's own gate never sees. The search is now
    confined to `## Blockers` and to `###`, exactly as the gate is.

  The three shared literals are copied rather than imported (that module is a CLI
  gate with load-time side effects) and a test pins the copies byte-equal, so the
  no-divergence claim is now checked rather than asserted.
- **Owner:** maintainer
- **Blocks:** Phase 0 step 0.8, and by consequence every promotion step in
  Phase 7.
- **What to do:** pick exactly one — (a) resolve ADR-239 § Decision 3 by
  granting preauthorized merge authority with its scope written into that
  record, or (b) resolve it by refusing preauthorized merge authority, making
  "only humans promote" a property rather than an intention, or (c) declare
  Phases 1–6 legal while it is unresolved and gate only Phase 7 on it — the
  cheapest option and the one this roadmap is cut for. Read
  `docs/decisions/ADR-239-drain-command-surface-and-merge-authority.md:79-81`
  and its decision table at `:188`.
- **Resolved when:** *(AMENDED 2026-08-29 — the marker sits inside the value on
  purpose; see the note above this field.)* the Phases 1–6 scope decision is
  recorded above and needs nothing further. This blocker closes when the
  **owner** settles ADR-239 § Decision 3 in either direction, at which point
  Phase 7 becomes enterable or is redesigned.
- **Recommendation:** (c). Phases 1–6 build measurement and isolation and
  promote nothing, so they are unaffected by where merge authority lands; (a)
  and (b) are owner-reserved and should not be forced by a plan that merely
  wants to start.
- **If you do nothing:** Phases 1–6 remain executable and Phase 7 cannot be
  entered, because the guardrail it rests on is documented in this tree as
  undecided. All three source proposals asserted that guardrail as a fact;
  verified 2026-08-26, it is not one.

**DISPOSITION 2026-09-01 (drain run 14) — the blocker is TERMINALLY
OWNER-RESERVED, and it stays OPEN. `Status:` is unchanged and is not to be
read as resolved by this block.**

*AI council 2026-09-01 (drain run 14), members `anthropic/claude-sonnet-4-5` +
`openai/codex-default`, 2 rounds, depth deep, peer-review, blind chairman,
quorum 2/2 present (needed 1) — concluded. Subscription transport,
`billable=0`, `$0.0000`. Verdicts **1C / 2C / 3A**, convergent 2/2 on all
three. The council question and both seat responses are local-only and are
deliberately not cited by path: `agents/runtime/council/` is gitignored and
auto-pruned, so per `no-roadmap-references` the text relied on is inlined
here.*

**Verdict 2C, as ruled.** An agent council cannot amend the boundary of its
own authority. The reflexivity is **structural and non-bypassable**: any
council answer to "may merge authority be preauthorized" is an answer about
what agents may do, produced by agents. It is corroborated from three
independent directions —
[`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md) places
governance self-amendment in the owner-reserved column; ADR-239 § Decision 3
says so in its own text; and the prior OWNER-RESERVED ruling of 2026-09-01
(Decision 1, 1C) reached the same boundary from the other side.

**Two honest downgrades, recorded because they weaken this run's own case.**

- **The harness safety-classifier refusals are CORROBORATIVE AT MOST, not
  proof.** The `revisit-if` note above records that two independent mechanisms
  refused an attempt to settle this blocker by option (b). One seat downgraded
  what that establishes: without the classifier's stated reason, its refusal
  does not demonstrate the constitutional boundary — it is consistent with it
  and does not prove it. Do not cite the refusals as proof; the argument rests
  on the reflexivity and on `decision-revisit-gate`, which stand on their own.
- **"Refusal is non-reflexive" is SPECULATIVE, and option (b) is not the safe
  direction it looks like.** The (b) argument recorded above — that refusing
  merge authority removes a capability rather than granting one, and so routes
  to the council as a floor-STRENGTHENING transition — was corrected by one
  seat: permanently declaring that only humans may promote **still settles the
  same governance boundary**. A permanent refusal is a decision about the
  scope of agent authority no less than a grant is. So (b) is owner-reserved
  on the same ground as (a), and this run does not treat it as the cheap exit.

**Neither step 0.8 nor AC-9 is descoped, and the mechanism is the stronger
reason.** Both seats held that recording a boundary is within council
authority while changing an acceptance criterion is an owner-level decision.
Independently of that verdict — and **not available to the council when it
ruled** — a descope into `agents/roadmaps/stubs/` is mechanically illegal:
`deferralProblems` accepts only `agents/roadmaps/<slug>.md` and
`agents/roadmaps/later/<slug>.md`
(`src/agent-src/scripts/archive_completed_roadmaps.ts:446-449`), so a stub
receiver resolves as *"does not exist"* at `:475` and reds the archival sweep.

**Terminal state, stated in as many words: this roadmap stays ACTIVE, blocked,
7/9, and is NOT archived. That is the correct terminal state, not a stall.**
The reason is independent of AC-9: the open-blocker check at
`src/agent-src/scripts/archive_completed_roadmaps.ts:591` fires on
`merge-authority` and refuses archival regardless of how the acceptance
criteria read. A roadmap carrying an open owner decision stays visible until
the owner makes it — which is what that check exists to guarantee.

**What this block does NOT do.** It does not resolve the blocker, does not set
`Status: resolved`, does not record a `Disposition`, does not close 0.8, does
not close AC-9, and does not revert any Phase 7 mark. It records a boundary
and nothing else.

## ADR-239 status as read on 2026-09-01

> **The lock was evaluated before it was cited**, which is
> [`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md) step 2.
> This section is that evaluation, recorded so a later reader can check it
> rather than take it on trust.

Read from `docs/decisions/ADR-239-drain-command-surface-and-merge-authority.md`
at commit `b50b27281`:

| Axis | Reading |
|---|---|
| `status:` | `accepted` (`:3`) |
| `supersedes:` / `superseded_by:` | both the em-dash placeholder (`:6-7`) — **neither superseding nor superseded** |
| Amendments | none in the file; the only inbound ADR reference is `docs/decisions/adr-evidence-sweep-2026-08.md:179,:466`, which carries it as `REVIEW-NOW (unread by this sweep)` with a first-adjudication date of 2026-09-26 — a backlog entry, not an amendment |
| Decision table (`:185-188`) | still reads *"Preauthorized merge authority is granted or refused \| owner \| **open**"* |
| `adr_cite_check` | **LIVE, TRIGGER INDETERMINATE** — the tool declines the semantic condition and routes it back |
| `review_trigger` (`:10-18`) | all three conditions checked against the tree: (1) the owner has not resolved the blocker in either direction — `Status:` above still reads `open`; (2) no second command has taken `all`-style cardinality; (3) no authorization store exists under `src/scripts/hooks/`. **None has fired.** |
| `reopen_policy` | absent → defaults to `unclassified` |
| `authority_basis` / `evidence` / `provenance` / `protected dims` | all absent — the record is ungraded on every evidence axis |

**What `unclassified` permits, and what it does not.** Council investigation
and reversible experiments are permitted; **execution** of an owner-reserved
transition is not. § Decision 3's own text and the decision table put the
grant/refuse decision on the owner explicitly, so the default does not soften
it. The lock is live, its trigger is unfired, and it is cited above on that
basis rather than on recall.


## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-01 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | `[-] MERGED` in the parent is later read as cancelled or as satisfied | product | The parent now carries nine `[-]` markers for work that is open here. A reader who takes `[-]` at its usual meaning concludes Phase 7 was dropped or done, and this file's whole purpose — keeping seven specified steps and AC-9 alive — is defeated silently | Every one of the nine markers states in as many words that `[-]` means TRANSFERRED, not cancelled and not satisfied, and names this file. The `relates:` block and § Provenance make the link machine-readable from both ends | Provenance |
| 2 | The carried non-promotion condition is discharged by a check over a population of zero | implementation | A gate written before any promotion path exists scans nothing and exits green, which is exactly why the parent left the condition UNMET rather than closing it | The condition's own text forbids it: *"A check over a population of zero does not discharge this condition"*, and its discharge point is named as the first commit that creates a promotion path | Carried blocking condition |
| 3 | ~~The discharge point may already have passed and nobody adjudicated it~~ **RETIRED 2026-08-31 — adjudicated** | implementation | Parent steps 3.4 and 3.6 are `[x]`, and `src/scripts/evolution_lab.ts:858-888` carries a `promote` verb returning `EXIT_REFUSED` unconditionally — a non-empty population with a mechanical refusal. The risk was that nobody would decide whether that discharges the condition, because *an undecided condition reads as satisfied to the next reader* | **Decided.** AI council 2026-08-31, **(B) NOT DISCHARGED**, 2×B / 1×A across two rounds, with the gap named falsifiably: the condition covers *any write into `src/` derived from a candidate* and only the verb plus the `-> promoted` transition are gated. Two discharge routes are recorded, one buildable and one owner-reserved. The condition is now undischarged **on evidence** rather than undecided. **SUPERSEDED 2026-08-31 (drain run 11):** route 1 was subsequently BUILT, and `:170-172` records the condition **DISCHARGED BY ROUTE 1** — the guarded capability plus the bypass check, green and proven sensitive. The `(B) NOT DISCHARGED` verdict in this cell is the intermediate finding that *motivated* route 1, not the final state; leaving it unqualified made this row contradict `:170`. Route 2 remains untaken and owner-reserved | Carried blocking condition |
| 4 | This roadmap sits blocked indefinitely on an owner decision | product | ADR-239 § Decision 3 has been open since 2026-08-22 with no recorded movement. An ACTIVE roadmap that never resumes consumes governed-estate headroom without producing anything | Deliberate and council-chosen: both seats ruled that active membership is what preserves the criteria, and the Resume condition routes owner REFUSAL back to the owner rather than letting this file decide its own disposition | Resume condition |
| 5 | A Phase 1-6 step in the parent creates a promotion path before this file resumes | implementation | The `merge-authority` blocker is scoped to gate Phase 7. A parent step that promotes anything would escape that scoping, and the mechanical non-promotion condition would bind to a change nobody expected it to | The Revisit-if clause binds both the blocker and the carried condition to any such earlier change, by name | Resume condition |
| 6 | The seven Phase 7 `[x]` marks are read as unqualified completion | product | AI council 2026-09-01 ruled **1C — OWNER-RESERVED** on whether closing a Phase 7 step under an open `merge-authority` blocker was legitimate, so all seven marks are PROVISIONAL pending an owner scope ruling and revertible to `[ ]` at it. A reader scanning checkboxes sees seven greens, concludes the promotion bridge is delivered, and misses that no promotion has occurred or can occur | The Phase 7 gate header states the provisional status, the 1C verdict and both seats' reasoning immediately above the first `[x]`, and records that the 1B reading (revert all seven) was found credible rather than dismissed. AC-9 stays `[ ]` as the standing counter-signal that the bridge is untraversed | Phase 7 — Promotion bridge and the lifecycle after it |
| 7 | R3's runtime-assembled-destination residual is read as covered by R1 and R2 | implementation | The route-1 discharge record claimed an R3-evasive write "is a PROMOTION only when it also carries an approval or a promoted record — which R1 and R2 catch independently". The 2026-09-01 openai seat refuted that: R1 and R2 "do not make R3 structurally complete: a candidate-derived source write does not cease to violate the third limb merely because no approval or promoted-record literal accompanies it". Left unqualified, the record would show a closed gap that is open | Scope-item 3 of the discharge now carries the divergence verbatim, carries the stricter reading as operative, and states the residual falsifiably: a candidate-derived module assembling a `src/` destination through a non-`const` chain longer than three hops passes `lint_promotion_paths` today. It is named as having no owner and no step in this file rather than being claimed as covered | Carried blocking condition |

## Acceptance Criteria

> **AC-9 is transferred verbatim from `road-to-governed-harness-evolution` on
> 2026-08-31, carrying its 2026-08-31 audit note unchanged.** The parent marks
> it `[-] MERGED`, which means the carrier moved — not that it was met, dropped
> or weakened. It is the only acceptance criterion this split moves; AC-1 to
> AC-8, AC-10 and AC-11 stay with the parent and were not touched.

- [ ] AC-9 — At least one promoted artefact has been through post-promotion
      re-evaluation and at least one RETIRE path has been exercised, so the
      lifecycle is shown to close in both directions.
      **Audited 2026-08-31: not met, and not closeable from this branch.**
      Every Phase 7 step was `[ ]` **at the moment of this first audit** and the
      phase is gated on the OPEN, owner-reserved `blocker: merge-authority`.
      Nothing in this tree is promoted, so no promoted artefact can reach
      post-promotion re-evaluation.
      **TENSE CORRECTED 2026-08-31 (drain run 11) — a factual repair, not a
      criterion change.** The sentence asserted the present tense and is false
      in it: the seven Phase 7 steps read `[x]`, closed as MECHANISM under the
      Phase 7 gate header's own reading.
      **LINE CITATIONS REPAIRED 2026-09-01 (drain run 14) — a factual repair,
      not a criterion change and not a change to what any mark claims.**
      **The repair is to stop citing them by line.** The seven marks are steps
      **7.1 through 7.7** under `## Phase 7`, and that identifier does not
      drift. This sentence previously cited them at `:342`, `:365`, `:387`,
      `:409`, `:445`, `:463` and `:493` with the gate header at `:313-315`, and
      every one of those was wrong.
      **The measurement, kept because it shows the failure mode rather than
      just correcting it.** At commit `b50b27281` the marks sat at `:461`,
      `:484`, `:506`, `:528`, `:564`, `:582`, `:612` — stale by a uniform
      **+119**. Writing *those* numbers here made them stale again in the same
      change: the drain-run-14 disposition blocks inserted above Phase 7 moved
      them to `:500`, `:523`, `:545`, `:567`, `:603`, `:621`, `:651`, with the
      gate header at `:404-498`. Both offsets are uniform — no step moved
      relative to any other and nothing was reordered.
      **The lesson, recorded so a third repair is not needed.** A bare line
      number into this file is a commit-bound fact that nothing checks and
      every prose addition invalidates. The numbers above are true at the
      drain-run-14 commit and at no other; cite the step id. The clause is kept in past tense
      rather than deleted because the audit it belongs to was true when taken;
      the RE-AUDITED block below carries the current state. **AC-9 is untouched
      and stays `[ ]`** — nothing here closes, weakens, or re-keys it.
      The RETIRE half was checked separately and does not rescue it: 5.5 carries
      `RETIRE` in E6's seven-op set and tests its arity
      (`tests/scripts/curator_ops.test.ts:63-66`), but every screened proposal
      there carries `lifecycle: 'candidate'` as a literal type, so that RETIRE
      retires a candidate and never a promoted artefact — which is the direction
      this criterion is about. What closes it is 7.6, after `merge-authority`.
      **RE-AUDITED 2026-08-31, after 7.6 closed: STILL NOT MET, and still not
      closeable from this branch.** 7.6 built the missing half — a review trigger
      that produces one of the five verdicts, and a `RETIRE` path that runs
      review -> verdict -> `assertTransition(_, 'retired')` end to end
      (`src/scripts/_lib/promotion_review.ts:145,160,202`;
      `tests/scripts/promotion_review.test.ts` § at least one RETIRE path is
      exercised). That satisfies 7.6's verify clause, which asks for a fixture.
      It does NOT satisfy this criterion, and the difference is the whole point:
      the criterion asks for **at least one promoted artefact** to have been
      through post-promotion re-evaluation, and this tree contains none. The
      fixture's artefact is a synthetic state object, not something that was
      promoted.
      The RETIRE half is unchanged from the 2026-08-31 audit and was re-checked:
      `src/scripts/_lib/curator_ops.ts:120-124` still types every screened
      proposal's `lifecycle` as the literal `'candidate'`, so E6's `RETIRE`
      retires a **candidate** and never a **promoted artefact** — the direction
      this criterion is about. `src/scripts/_lib/candidate_record.ts:210-219`
      still makes `promoted -> retired` the only retirement edge, and reaching
      `promoted` still requires the guarded capability, which is unobtainable
      while `blocker: merge-authority` is open.
      **What closes it:** a human promotes one artefact through the capability
      after the owner settles ADR-239 § Decision 3, that artefact reaches a
      review trigger, and the resulting verdict is recorded. None of those three
      is performable from this branch, and asserting the criterion on the fixture
      would be closing it on the thing it explicitly excludes.
      **WRITTEN DISPOSITION 2026-09-01 — AC-9 STAYS `[ ]`. Re-audited a third
      time, still not met, still not closeable from this branch, and
      deliberately not descoped.** *AI council 2026-09-01
      (anthropic/claude-sonnet-4-5 + openai/codex-default, 2 rounds, blind
      chairman, quorum concluded 2/2) — Decision 3: **3A**, 2/2 convergent.*
      The three facts the audit rests on were re-checked at this commit and
      none has moved: `src/scripts/_lib/curator_ops.ts:120-124` still types
      every screened proposal's `lifecycle` as the literal `'candidate'`;
      `src/scripts/_lib/candidate_record.ts:210-219` still makes
      `promoted -> retired` the only retirement edge; and
      `./scripts-run src/scripts/lint_promotion_paths` reports **`blocker
      status: open`** at exit 0 over 2860 files, so the guarded capability that
      is the only route to `promoted` is still unobtainable.
      **Why it is not descoped.** Converting it to "specified but not
      exercised" is the exact weakening the 2026-08-31 council rejected when it
      wrote this file's Resume condition, and that reservation is the owner's.
      The openai seat restated the boundary independently: AC-9 *"requires a
      genuinely promoted artefact — not a synthetic promoted-state fixture"*,
      and *"no non-owner disposition described here satisfies either condition
      without weakening it."*
      **The closing chain, stated so a later reader does not re-attempt what is
      structurally impossible from this branch** (anthropic's wording, adopted):
      (a) the owner resolves 0.8 by settling ADR-239 § Decision 3 in the
      granting direction; (b) a named human performs one real promotion through
      `acquirePromotionCapability`, which cannot happen while (a) is open;
      (c) that promoted artefact reaches a review trigger and the resulting
      verdict is recorded — a real artefact, not the 7.6 fixture, which is
      already built and already does not satisfy this criterion.
      Note that (a) resolved in the **refusing** direction does not close AC-9
      either: it makes (b) permanently impossible, at which point AC-9's
      disposition becomes an owner decision in its own right rather than an
      automatic descope.
      **FOURTH AUDIT 2026-09-01 (drain run 13) — STILL `[ ]`, and this run
      establishes the one fact three prior audits left open: this roadmap
      CANNOT ARCHIVE while AC-9 is unmet, and that is a property of the
      repository rather than a judgement.** *AI council 2026-09-01
      (`anthropic/claude-sonnet-4-5` + `openai/codex-default`, 2 rounds, deep,
      peer-review, blind chairman, quorum 2/2 present, needed 1 — concluded,
      subscription transport, `billable=0`, `$0.0000`) — Question 2: the seats
      SPLIT, anthropic **2A** and openai **2B**, and BOTH attached the same
      condition.* anthropic: if archive semantics conventionally imply success,
      choose 2B instead. openai: the proposal provides no repository rule
      showing that an active roadmap with an unmet acceptance criterion may
      enter the archive, and that fact must be demonstrated first.
      **The condition was then checked against the tree, and it decides the
      split as 2B.** `src/agent-src/scripts/archive_completed_roadmaps.ts:14-16`
      states the criterion — a roadmap that has reached `count_open == 0` and
      `count_deferred == 0` is complete — and `:562-563` is the predicate that
      enforces it. `count_open` comes from `count_checkboxes`
      (`src/agent-src/scripts/update_roadmap_progress.ts:323`) over `CHECKBOX_RE`
      (`:81`), a whole-file `/gm` regex with **no section filter**: an
      `- [ ] AC-9` line under `## Acceptance Criteria` is counted exactly like
      an unfinished step. There is no `terminal-incomplete` disposition in the
      archiver and no flag that supplies one. So the archive gate is not an
      opinion this run formed; it is a mechanism, and it refuses.
      **Consequence, recorded as the disposition: this roadmap stays ACTIVE.**
      It is not archived, not descoped, and not marked complete. Its executable
      work is finished and verified; its acceptance is not, and the file remains
      the visible carrier of that difference. Both seats also warned in Question
      5 against exactly the framing this paragraph refuses — openai named 2A's
      unsupported assertion that the roadmap may archive with AC-9 unmet as the
      run's principal manufactured-closure risk, and it is declined here rather
      than argued with.

      **FIFTH AUDIT 2026-09-01 (drain run 14) — STILL `[ ]`. The four prior
      audits established that AC-9 is not met; this one establishes the
      stronger fact that it is MECHANICALLY UNREACHABLE, and it is a property
      of the code rather than a judgement about it.** *AI council 2026-09-01
      (drain run 14), members `anthropic/claude-sonnet-4-5` +
      `openai/codex-default`, 2 rounds, depth deep, peer-review, blind
      chairman, quorum 2/2 present (needed 1) — concluded. Subscription
      transport, `billable=0`, `$0.0000`. Verdicts **1C / 2C / 3A**, convergent
      2/2 on all three.*
      **The chain of refusals, read from the code at commit `b50b27281`.**
      `verbPromote` (`src/scripts/evolution_lab.ts:988-1052`) has exactly
      **one** terminal return — `EXIT_REFUSED` at `:1051`; the other three are
      a usage error (`:992`) and two IO failures (`:998`, `:1029`), and no
      branch returns success. Underneath it, two independent gates:
      `acquirePromotionCapability`
      (`src/scripts/_lib/promotion_capability.ts:270-291`) throws unless the
      blocker file reads **both** `Status: resolved` and `Disposition: granted`
      (`:274-282`); and `assertTransition(_, 'promoted')` throws without a
      NAMED human approver (`src/scripts/_lib/candidate_record.ts:232-248`),
      and is called at `src/scripts/evolution_lab.ts:1036` with **no** approval
      argument. `src/scripts/lint_promotion_paths.ts:619-629` proves tree-wide
      that nothing else promotes either — it CALLS the capability and fails if
      a token comes back while the blocker reads open.
      The RETIRE half is unchanged and was re-read: `curator_ops.ts:120-124`
      types every screened proposal's `lifecycle` as the literal `'candidate'`,
      and `candidate_record.ts:210-218` forbids a candidate from the retirement
      edge — `promoted` is the only legal `from`.
      **In plain words: no artefact in this tree can hold `promoted`, so no
      honest disposition closes AC-9.** Not "difficult", not "not yet" — there
      is no reachable state in which the criterion's subject exists. It stays
      `[ ]`.
      **NOT DESCOPED, for two independent reasons, and the second is the
      stronger one.** (1) Verdict 2C: both seats held that recording a boundary
      is within council authority while changing an acceptance criterion is an
      owner-level decision, so no council may descope this. (2) A mechanism
      finding that was NOT available to the council when it ruled:
      `agents/roadmaps/stubs/` is **not a legal carry destination**.
      `deferralProblems` accepts exactly two directories —
      `agents/roadmaps/<slug>.md` and `agents/roadmaps/later/<slug>.md`
      (`src/agent-src/scripts/archive_completed_roadmaps.ts:446-449`) — and a
      stub destination is not in the `['archive','skipped']` dead-list at
      `:470` either, so it resolves as *"does not exist"* at `:475` and reds
      the archival sweep. Descoping into a stub is therefore forbidden by the
      mechanism as well as by the verdict.
      **And archival is blocked independently of AC-9.** Even with AC-9 gone,
      the open-blocker check at
      `src/agent-src/scripts/archive_completed_roadmaps.ts:591` fires on
      `merge-authority` and refuses. Closing AC-9 would not archive this file.


## Provenance

**The council question and its full two-seat response are local-only and are
not cited by path here** — `agents/runtime/council/` is gitignored and pruned
after the retention window, so a path would rot. The verdict of 2026-08-31,
anthropic/claude-sonnet-4-5 + openai/codex-default, 2/2 convergent, is Option 3:
split at the phase boundary into a new ACTIVE roadmap; both seats rejected
`later/` by name; the transfer is atomic; `[-] MERGED` denotes carrier transfer;
an owner refusal returns the whole receiver to the owner and weakens nothing.

### The carried condition as the parent recorded it

Reproduced verbatim from `road-to-governed-harness-evolution` Phase 0, where it
was placed on 2026-08-30 and from where it transfers here on 2026-08-31. The
normative form is the four-line **Carried blocking condition** above; this block
is the reasoning that produced it, kept so the split loses no context.

> **CARRIED CONDITION, placed here 2026-08-30 — the `merge-authority` council's
> own instruction, executed late.** When the AI council scoped `merge-authority`
> on 2026-08-29 (anthropic + openai, 2/2) it declared Phases 1–6 legal while
> ADR-239 § Decision 3 stays open, and attached one condition it called *"an
> addition to what the blocker proposed"*: **the non-promotion property of
> Phases 1–6 must be MECHANICALLY ENFORCED, not merely stated** — *"a phase that
> promises to promote nothing while nothing prevents it from promoting is the
> same class of guarantee ADR-239 § Decision 3 is open about."* It said the
> condition belonged in this phase's exit criteria. It was never written here;
> found on 2026-08-30 and carried now.
>
> **It is carried UNMET, and that is the honest state.** Nothing in this tree
> promotes anything: there is no promotion path, no candidate, and no merge
> verb — `grep -rln 'assertWithinBudget|discloseToProposer' src/ tests/` returns
> the guards, their tests and their config, and no caller. A gate written today
> to assert "no Phase 1–6 code promotes" would scan a population of zero and
> exit green, which is worse than no gate because it would look like the
> mechanical enforcement the council asked for. That is the vacuous-check
> refusal 1.4 and 2.3 both already made on this roadmap.
>
> **What discharges it, falsifiably.** The first commit that creates a promotion
> path — a verb, a state transition into `promoted`, or any write into `src/`
> derived from a candidate — owes the enforcement in the same change. Concretely:
> the 3.4 lifecycle enum's `promoted` transition and the 3.6 verb set are where
> the population stops being empty, so the check lands there and this note is
> what stops it being read as already-satisfied when it does.
>
> **This does not resolve `merge-authority` and does not touch it.** ADR-239 §
> Decision 3 — *"Preauthorized merge authority is granted or refused | owner |
> open"*, re-verified at `ADR-239:188` on 2026-08-30 — is owner-reserved in both
> directions, and no council verdict may perform it. Option (c) stands, Phase 7
> stays gated, 0.8 stays `[~]`.
