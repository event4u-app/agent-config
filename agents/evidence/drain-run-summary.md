<!-- evidence-type: analysis -->

# Autonomous drain run — 2026-08-30

> **INTERIM, not final.** The run was asked to empty `agents/roadmaps/`. It
> closed three of the seven present and stopped with four open. This file
> records what shipped, every council decision, every descope, and — because
> they are the useful part — the defects the execution found in the roadmaps
> themselves.

## PRs

| PR | Roadmap | State |
|---|---|---|
| [#1742](https://github.com/event4u-app/agent-config/pull/1742) | `road-to-experience-loop-broadening` | 44/47, 3 carried, archived. CI **46 pass / 0 fail** |
| [#1743](https://github.com/event4u-app/agent-config/pull/1743) | `road-to-concern-admission-ratchet` | 13/13, nothing deferred, archived |
| [#1744](https://github.com/event4u-app/agent-config/pull/1744) | `road-to-gates-that-do-not-run` | 14/14, nothing deferred, archived |

## Council decisions (5 rounds, anthropic + openai, 2/2 convergent each)

| # | Question | Verdict |
|---|---|---|
| 1 | Does a parked ENFORCEMENT decision bind a RECORD-LABELLING change? | **(B) No** — different mechanism. Switch-back condition recorded at the stub; audited, not met. |
| 2 | Where do experience cards live? | **(A)** `agents/knowledge/` as a strict tagged union — never conditional fields. |
| 3 | AC-9 needs elapsed time — re-scope or descope? | **(b) Carry verbatim.** "Can close" is not "has closed". |
| 4 | *(within 1)* Cutover marker required before a labelling change | Lines carry `outcome_semantics`; append-only logs do not roll back. |
| 5 | *(within 3)* Data-quality gate before the lifecycle gate | A follow-up gated only on elapsed time never closes if the sensor cannot record what it waits for. |

Two pre-existing blockers were **not** re-run: both were already 2/2-decided on
2026-08-29 and record their remaining halves as owner-reserved. Re-running would
have been verdict shopping.

## Descopes — carried, never cancelled

| Item | Receiver | Why |
|---|---|---|
| AC-9 | `later/road-to-experience-lifecycle-operational-proof.md` | Needs elapsed operational time. No failure pattern exists to mine; nothing can have expired. |
| 7.6 | `later/road-to-experience-loop-owner-decisions.md` | Blocked on E8, an open maintainer decision. |
| 9.6 | same | Crosses a recorded architectural boundary — owner-reserved. |

## Defects the execution found, that the roadmaps did not

1. **Dispatch capture is an honest null at 85.7 %** against a 95 % pre-registered bar — a ~317× improvement over the 0.27 % prior, and still a fail.
2. **A denominator effect found by an impossible reading.** `CLAUDE_PROJECT_DIR` resolves to the parent checkout in a worktree; counting the main checkout alone returned **187 %**.
3. **A safety carve-out exempted 4 of 9 safety rules.** `domain-safety-pii`, `tool-safety`, `runtime-safety` and two others were REAP-eligible on low usage.
4. **`rules_applied` is a producer constant** while the contract called it an observation. Prose deleted, replaced by a checkable helper.
5. **The concern-ratchet roadmap's own reproduce command over-counts** — whole-file grep catches `roles:`/`platforms:`/`native_event_aliases:`. Exactly 16 at every pin: the axis is **55, not 71**. The finding survived; the figures did not.
6. **The gates roadmap's "32 unreachable" was 22** — a workflow can call the *script* directly, which a task-graph reading cannot see. 17 gates were running all along.
7. **`deps:` is a third task-edge kind**, missed by the first parser — and missing it reports a target as unreachable when CI does run it.
8. **Wiring into `task ci` is only half of reachable** — the parity ratchet caught the roadmap's own defect reproduced by its own fix.
9. **`check_estate_count`'s guidance names a key its parser does not read** (`estate_growth_exempt` vs `estate_offset_exempt`). **Not fixed — owner's call.**
10. **An archived roadmap claimed CI wiring that never existed.** Annotated in place.

## Not started, with the reason

| Roadmap | Steps | Why not |
|---|---|---|
| `road-to-retired-claims-stay-retired` | 14 | Depends on #1744's Phase 2.1; would have needed a stacked 4th PR on unmerged work. |
| `road-to-agent-turnaround` | 21 | Not reached. |
| `road-to-capability-native-execution` | 55 | **AC-14 hard stop**: all five blockers must read `resolved` before any Phase 1-9 code; `b-adr-088` is open and owner-reserved. Its `s7` fixture also makes AC-6 unsatisfiable against its own frozen corpus. |
| `road-to-governed-harness-evolution` | 58 | Phases 1-6 legal, ~12 decisions outstanding. |
| `road-to-inbox-harvest-2026-08-e-council-topology-evidence` | 77 | Not reached. |

Full briefs for capability-native and governed-harness were produced during the
run and are the cheapest resume point.

---

# Run 5 — 2026-08-30, later the same day

> Six PRs. **Four merged during the run** (#1744, #1746, #1747, #1748); two open
> at close (#1749, #1750). One roadmap closed and archived; four advanced; none
> abandoned. Five council rounds, one of which **split** and was resolved
> conservatively rather than by picking the convenient half.

## PRs

| PR | branch | what it carries | state at close |
|---|---|---|---|
| **#1744** | `drain/gates-that-do-not-run` | inherited from Run 4; this run fixed **three** CI defects in it and merged `main` twice | **merged** |
| **#1746** | `drain/retired-claims-stay-retired` | `road-to-retired-claims-stay-retired` **14/14**, archived | merged into a STALE BASE — **re-opened as #1751**, see the correction below |
| **#1747** | `drain/agent-turnaround` | `road-to-agent-turnaround` **19/21**, 2 deferred behind named blockers | **merged** |
| **#1748** | `drain/governed-harness` | `road-to-governed-harness-evolution` Phases 0–1, **12/58** | merged into a STALE BASE — **re-opened as #1752**, see the correction below |
| **#1749** | `drain/capability-native-2` | `road-to-capability-native-execution` step 0.6 — the only step AC-14 permits | open |
| **#1750** | `drain/council-topology-2` | council-topology Phase 0 + Phase 1A, **12/77**, and this file | open |

## Council decisions — five rounds, all seats present

| # | question | verdict | acted on as |
|---|---|---|---|
| 1 | Gate the user-scope bucket in the payload budget? | **(a)** gate + rebaseline, **2/2** | superseded by round 2 |
| 2 | …given the checker's actual bucket definitions | **(a′)** correct the false reason, add the reconciliation test, leave the baseline, **2/2** | implemented verbatim |
| 3 | E4 + E9 — activation-ladder and cascade arity | **(B)** six rungs, twelve stages, **2/2**, with an evidence-matrix condition | implemented; the condition is `LADDER` |
| 4 | Was closing governed-harness 0.4–0.6 premature? | **SPLIT 1/1** — (b) vs (d) | conservative side taken; see below |
| 5 | A 2-line feature vs a shrink-only source ratchet | **(c)** pay with a local behaviour-preserving reduction, **2/2** | paid; baseline untouched |

**Round 2 is the one worth reading.** Round 1 voted to gate the user-scope
bucket and rebaseline; its two seats explicitly deferred the arithmetic to "the
checker's exact calculation" and proposed baselines **~124k apart**, which is
the signal that neither had the bucket definitions. Given them, round 2 found
the 104 user-scope rules are a **subset** of a bucket the gate already measures
in full — gating them would have moved the baseline ~111k for zero additional
delivered payload. A council answering the question it was given, and a second
round answering the question that was actually there.

**Round 4 split, and a split is an escalation condition, not a verdict.** Both
seats agreed the guards work, that their tests prove the behaviour the verify
clauses name, and that **the gap is real** — nothing forces a future runner to
call them. They differed on whether 0.4/0.5 may close meanwhile. The
conservative side was taken **on asymmetry, not on agreement**: under-claiming a
closed step costs a checkbox; over-claiming one is the failure Run 4 named, with
*"never got built"* replaced by *"never got called"*. Both rationales are
recorded verbatim at `blocker: guard-call-site-integration`, and AC-8 — which
both seats asked for — is in the roadmap.

## Descopes and deferrals

| item | disposition | why it is not effort |
|---|---|---|
| `agent-turnaround` 2.4 | `[~]` → `post-change-window` | measures the effect of 2.2, which landed minutes earlier; the post-change sessions do not exist yet |
| `agent-turnaround` 5.3 | `[~]` → `authorization-shape-for-long-runs` | **owner-reserved**; put with both options and the measured spans, deliberately with no recommended value |
| the `paths:` wiring gap | carried to `road-to-turnaround-followups` | a consumer-facing installer change that would silently narrow three rules' activation, from inside a measurement roadmap |
| `governed-harness` 0.4, 0.5 | `[~]` → `guard-call-site-integration` | the split above |
| `governed-harness` 0.8 / Phase 7 | unchanged `[~]` | merge-authority is owner-reserved |
| `capability-native` Phases 1–9 | untouched | **AC-14**: all five blockers must read resolved first, and `b-adr-088`'s remaining half narrows an accepted ADR floor — owner-reserved, no council may close it |

## Twelve defects found, each by executing rather than reviewing

**In CI, on inherited work (#1744):**

1. `check_release_includes_discovery` wired as a bare workflow step; `dist/discovery/` is gitignored, so it died on a missing file on every PR run.
2. The same class again in `lint_mcp_registry_manifest` — and the first repair (a build step) fixed the gate and **broke CI↔local parity**. The dep on the task target settles both; `ci_only:` would have been the wrong shape, because a builder is not a gate.

**In the roadmaps' own premises:**

3. `retired-claims` said six `resolved-null` rows; there are **seven**.
4. It said four closed claims had published phrasings; measured, exactly **one** — `git log -S` over all five publish surfaces.
5. `agent-turnaround`'s risk register had ranks out of order (1, 2, 7, 6, 3, 4, 5), invisible while the file was a draft.
6. `non-destructive-by-default` cannot carry an `evidence:` block: it is `type: always`, and four frontmatter lines breached the kernel top-3 cap on a ratchet with **two characters** of headroom.

**In the instruments this run built:**

7. `probe_turnaround` **gated on its own execution** — baseline 81.42, re-run 81.61 minutes later with nothing changed but the clock.
8. `calls_per_request` is unratchetable even so: 81.42 → 72.67 → 73.73 across one afternoon as the mtime window slid. Now reported, never compared.
9. The census's derived rows were added to a **sum**, injecting ~123k phantom tokens and reddening the payload gate on the first run.

**In the re-council guard, found by probing the live CLI:**

10. The exact pass compared the **built prompt** against the hash of the question **file**, so both `exact-*` states were unreachable and every true repeat reported as a near-duplicate at similarity 1.00.
11. The config fingerprint used bare member names while the artefact writer records `name/model` — so `exact-same-config` could never fire. *Two states that can never both occur are one state with extra words.*

**In the tree, found by a gate:**

12. `task preflight` measures **36.05 s** against a declared `pre_push_budget_seconds: 25` — **44 % over** a ceiling whose own comment calls it "a real budget, not a wish", and nothing measures the hook. Recorded, not fixed: narrowing preflight is one edit from turning a push-blocking mirror into a partial one.

## What this run did NOT do

- **It closed one roadmap, not five.** `retired-claims-stay-retired` is archived
  at 14/14. The other four are advanced and open, and two of them are stopped at
  an owner decision no council may take.
- **It did not archive `road-to-agent-turnaround`,** and that is the mechanism
  working: `update_roadmap_progress` archives only at `deferred === 0`, which is
  Iron Law 3 refusing to bury planned-for-later work.
- **It reversed a Run 4 disposition and then partly un-reversed it.** Run 4 left
  governed-harness 0.4–0.6 open on purpose; this run closed all three, put the
  reversal to the council as `decision-revisit-gate` requires, and reopened two
  of them when the seats split. 0.6 stands — both seats agreed its clause names
  no run at all.
- **It wired no Phase 1–9 code into `capability-native`,** because AC-14 forbids
  it. One pre-registration step is the whole legal surface, and that is the
  roadmap working rather than stalling.

## Correction — two PRs read MERGED and their content was not on `main`

Found by re-reading the tree at the end of the run rather than by trusting the
PR list, which is the only way it could have been found: `gh pr view` reported
`MERGED` for both.

**The mechanism.** #1746 and #1748 were opened with `--base
drain/gates-that-do-not-run`, deliberately, because each needed something that
branch carried. #1744 then **squash-merged** to `main`, and GitHub did *not*
retarget the two children — it left them pointing at a branch that had already
shipped. Their merges therefore landed in that stale branch and went nowhere.

**What it looked like on `main`:** `check_claims.ts` with zero occurrences of
`retires_phrasings`, no `road-to-retired-claims-stay-retired.md` under
`agents/roadmaps/archive/`, the active copy still the 0/14 file from #1740, and
no `src/scripts/_lib/harness_evolution_guards.ts` at all. Every one of those is
a *file-level* check; the PR list said the opposite.

**The fix, and it is not a re-authoring.** Both branches still hold every
commit. `main` was merged into each, the conflicts resolved, and each re-opened
against `main`: **#1751** (retired-claims) and **#1752** (governed-harness).
`#1747`, `#1749` and `#1750` were based on `main` directly and did reach it —
verified the same way, by file presence rather than by PR state.

**The lesson, stated as a rule rather than an anecdote.** A stacked PR whose
base merges first does not follow it. Either re-target the child the moment the
parent merges, or verify the content on `main` by reading the tree — a PR
marked MERGED is a claim about a merge, never about which branch received it.
This repository's own `direct-answers` Iron Law 2 already says live state is
never asserted from memory; this is the same rule applied to a status field.

**One consequence for the numbers above.** The corpus count in
`lint_budget_ownership.test.ts` is **14** on the merged tree, not 13: two
independently added budgets — `turnaround-budget.json` and
`harness-evolution-budget.json` — met in the merge, and the number was measured
on the merged tree rather than taken from either side, which is the method this
repository's own ratchet entries prescribe.

---

# Run 6 — 2026-08-30

Five PRs. Three merged, two green and awaiting the maintainer. **One roadmap
archived, one parked, one advanced, two blockers closed by council, one split
taken conservatively.** Active estate **5 → 3**.

Every decision below was taken by the AI council or by a recorded rule, never by
the maintainer, per the run's mandate. Two questions the council was **not**
allowed to answer are named as such and left open.

## PRs

| PR | Subject | State |
|---|---|---|
| **#1753** | `road-to-agent-turnaround` closed and archived by MERGE disposition | merged |
| **#1754** | `road-to-capability-native-execution` parked in `later/` on a split council | merged |
| **#1756** | `road-to-turnaround-followups` Phase 3 — Claude host-form rules on the install path | merged |
| **#1755** | `road-to-governed-harness-evolution` Phase 2 (5/5) + six review findings | green, open |
| **#1757** | council-topology Phase 1B (2/4) + seven review findings | green, open |

## Council decisions

**#1753 — the disposition of two deferred items. 2/2 convergent, and it
overruled the plan.** The obvious reading was CARRY into the existing follow-up.
Both seats independently rejected it: the preservation test's CARRY branch
requires a follow-up *"created in the SAME change"*, and it lists *"merge into
existing active work"* as a **separate** branch — which would be redundant if
"SAME change" merely meant "the destination is active". So the lawful
disposition is MERGE. Both also drew the same line on the owner-reserved half:
relocating **where** a decision waits is not **answering** it, so the council may
move it and may not settle it.

**#1754 — does AC-14's global hard stop survive the amendment to the blocker it
names? SPLIT 1/1.** One seat: the `Blocks:` field exists to be authoritative, and
if an acceptance criterion can override it after scoping, *"the field serves no
function — it becomes decorative notation"*. The other: AC-14 is keyed on blocker
**status**, not **scope**; the amending council left the blocker open and did not
amend AC-14, and the edit would change the permitted state from *no Phase 1-9
code* to *almost all of it*, which is substantive rather than documentary.

A split is an escalation condition, not a tie to be broken by preference, so the
conservative side stands. **The one thing both seats named unprompted was the
disposition** — `later/` — and that is what shipped.

**#1755 — the scope of a "four-class corpus". 2/2 convergent on a RE-SCOPE.**
`failure` is an orthogonal axis: the other three describe *intended* routing,
`failure` describes *observed* behavior, one case can be both, and a known-wrong
case in a regression lock is red by construction. Both refused to close the step
on its first conjunct without a recorded rewrite; one killed the other's proposed
`known-failures.json` "schema TBD" as *"another vacuous mechanism"*, and nothing
was created for it.

**#1757 — strip the inline findings block, and type the vocabulary now. 2/2.**
The council also caught an ordering defect the implementing pass had missed:
peer review runs *before* consensus, so parsing inside `run_consensus_scoring`
left the block in the text peer review evaluated.

## What the reviews caught — and why that is the headline

Every branch carrying code went to a **fresh completion reviewer** dispatched by
`dispatch_r2_reviewer.ts`, which assembles the prompt so the implementing
session never authors its own evaluator's. **Three reviews, eighteen findings,
one critical and three high.** Two of the highs were regressions the drain
itself had just introduced.

- **critical (#1757)** — the inline-findings short-circuit tested
  `outcome !== 'parsed'`, and `parse_findings_outcome` returns `'parsed'` for
  *any* valid JSON array. A reply quoting an array as evidence was recorded as a
  successful extraction, its evidence **deleted** from what peer review read, and
  the failure counted as a **success** in the rate its own promotion gate reads.
- **high (#1756)** — the new rule rewrite **deleted the package ownership tag**
  that `reap_tagged_orphans` matches on, which that function's docblock calls
  *"the only path with ownership proof independent of inventory history"*. Every
  file under the host anchor would have lost it; doctor would have read `ok`
  there permanently.
- **high (#1755)** — the corpus gate silently no-opped wherever the base ref does
  not resolve, **while printing a success line asserting the discipline had run**.
- **high (#1757)** — the marker promised *"the raw reply is retained in the
  session record"* and nothing retained it.

All eighteen are fixed, each row terminal with its fix SHA and each artefact
re-bound in place rather than re-dispatched.

## What CI caught that nothing local did

Recorded rather than smoothed over, because the gap is the finding:

1. **`lint_eval_specs`** — the branch that introduced a three-class case
   vocabulary made the gate's own "near-miss" reading ambiguous, and six corpora
   were flagged. Fixing the *descriptions* would have made them contradict the
   classes the same branch added; the gate was made class-aware instead, which
   is strictly a tightening.
2. **`dist/install/`** — two freshness gates, neither in the local battery.
3. **A developer's home path in a shipped bundle.** The rebuild embedded
   `/Users/<name>/…` 189 times, caught by `check_bundle_path_leakage`. Cause: the
   worktree's `node_modules` was a symlink to another worktree's, itself a
   symlink to the main checkout's, so esbuild resolved every dependency outside
   the repo root. Produced entirely by worktree plumbing, by no source change.
4. **The base-ref fix was right about the defect and wrong about the remedy.**
   Turning a silent no-op into a hard `DeadScopeError` made every CI run red —
   the same wrong answer with the opposite sign. `_lib/ratchet_base_ref.ts`
   already existed for exactly this and names this exact cause in its docblock.

## Ratchets

Four moved, **every one paid by extraction and none by a baseline raise**:
source-size 18,440 → 18,437 → 18,266 → 18,249, and **18,246 on the merge** —
below both sides, because two branches paid independently against different
bases and picking either would have given back the other's gain. Routing
coverage 0.3144 → 0.3344 (94 → 100 of 299 skills carry a corpus).

One reversal is recorded rather than quietly made: the size-budget baseline was
first left alone on the *"never lower a ratchet on a local reading"* precedent.
That precedent is about an environment-dependent gate; this one counts lines in
tracked source and its own test asserts equality in both directions, so leaving
it high is a red test rather than safe conservatism.

## Descopes — none

No item was descoped, cancelled, or weakened. Two are **carried**, both with
their owner and class intact:

- `authorization-shape-for-long-runs` — owner-reserved, moved from an archived
  roadmap into an active one without being answered.
- `b-adr-088`'s browser-engine half — owner-reserved, and the roadmap it gates
  is parked with an entry condition naming the one owner sentence that releases
  it in either direction.

## Where the run stopped, and why

**Council quota is exhausted** — 50/50 on both seats against
`DEFAULT_CLI_CALLS_PER_DAY`. Raising that cap to fit a measurement is the one
thing the guard exists to prevent, so it was not raised. Two steps that need a
live run (`1B.1`, `1B.4`) are recorded as **not run**, explicitly *not* as nulls
— a null is what a measurement returns.

Three roadmaps remain active. Their open work is genuinely blocked in every case
this run could reach: `turnaround-followups` needs ten post-change sessions that
do not exist yet and an owner decision; `governed-harness` Phases 3-6 are
ungated but none are cheap, and Phase 7 waits on `merge-authority`;
`council-topology` needs council quota.

**One recurring shape, worth naming.** Three separate times this run, a criterion
was found with no phase, no step and no owner — a council condition recorded
inside a blocker and carried nowhere. It is the same failure Iron Law 3 exists
to prevent, one level up: not a deferred *step* that goes silently missing, but a
deferred *condition*.

---

# Autonomous drain run 7 — 2026-08-30/31

> **The queue was three roadmaps, not the thirty-six the run prompt named.** The
> prompt's seed table was pinned at `c536dbd`; `main` was at `de939f769` and
> earlier drain runs had already cleared the rest. Recomputed live before
> starting, per the prompt's own instruction not to trust the seed order.
>
> **Nothing was descoped, cancelled, or weakened.** Three roadmaps advanced,
> one closed a phase-pair, and the three items that did not close each have a
> named owner and a falsifiable release condition rather than a note.

## PRs

| PR | Roadmap | What it did | CI |
|---|---|---|---|
| [#1759](https://github.com/event4u-app/agent-config/pull/1759) | `road-to-turnaround-followups` | 2.1 + AC-2 closed on ADR-251; 1.1 deferred with an owner; AC-1 held open on a council verdict | 39 green · **merged** |
| [#1760](https://github.com/event4u-app/agent-config/pull/1760) | `road-to-inbox-harvest-…-council-topology-evidence` | Phase 3 → 4/6; 3.3 and 3.4 blocked with an owner | 43 green |
| [#1761](https://github.com/event4u-app/agent-config/pull/1761) | `road-to-governed-harness-evolution` | **Phase 0 → 8/8, Phase 3 → 6/6**; a split blocker resolved on its own terms; 5 maintainer decisions settled | 42 green |

## Council decisions — 7 across 3 passes

**The CLI quota was exhausted on entry** — anthropic 50/50, openai 51/50
against `DEFAULT_CLI_CALLS_PER_DAY`, resetting at UTC midnight. Every pass ran
on the metered API rung via `--mode-override api`, under the maintainer's
standing paid-council authorization. **Total spend $0.1266** against a $1.2564
estimate. The daily CLI cap was **not** raised — raising it to fit a
measurement is the one thing that guard exists to prevent, and a failed attempt
still increments the counter.

| # | Question | Verdict |
|---|---|---|
| 1 | E5 — minimality tie-break order, and is the fifth criterion in? | **2/2 — four criteria**, `tokens → artifacts → scope → precedence`; fifth out. By the time two candidates tie, both have survived selection and hygiene, so the constraint option B leads with is already satisfied and cost is what is left |
| 2 | E6 — curator operation set, 4 ops or 7? | **2/2 — seven.** Step 7.6 already specifies a verdict set including `SPLIT`, so a 4-op curator produces verdicts it cannot execute. **The 6-op middle was rejected, not adopted** — "an unstable equilibrium", since it contradicts 7.6 too |
| 3 | E7 — sealed-holdout cadence? | **2/2 — promotion candidates only.** The gate is free from the lifecycle enum, and the discordant-trial floor means an earlier read spends unbiased signal on runs that could not have concluded |
| 4 | E8 — state taxonomy, 4 classes or 5? | **2/2 — four plus a pointer.** *Taxonomies classify; validations enforce* |
| 5 | E10 — mutation alphabet, three dimensions or four? | **SPLIT 1/1.** Conservative side taken: three. Recorded as a split, not dressed as a verdict |
| 6 | The 30-minute git-authorization window — does the supported path stand? | **2/2 — Option B**, a different authorization SHAPE, never a wider window. Both seats proposed the same shape independently |
| 7 | Does a re-measurement close its AC when the change it measures reached nobody? | **2/2 — `not-met`.** "Post-change corpus" means EXPOSED to the change |

### The one that needed its authority checked before it was asked

Decision 6 sat behind a bound the roadmap states twice: *the agent proposes no
value and does not take the decision*, and a prior council had already ruled it
may only **move** the question, not settle it.

What made the rest settleable is that the reserved-decision table routes
**lowering** a security floor to the owner and **keeping or strengthening** one
to the council. Option B lowers nothing — `LEDGER_MAX_AGE_MS` stays at 30
minutes and raising it stays owner-reserved and untaken. Both seats reached
that reading independently and both classified their own verdict
`within-council-authority`. ADR-251 carries `reopen_policy: owner` and
`protected_dimensions: security_floor` so the substitution cannot later be read
as a grant of authority, and AC-2 says in the diff that its decision-maker was
the council rather than the owner.

The mechanism was **verified, not assumed**: `git_authorization_hook` is
stateless per prompt with no once-per-session latch, and every human-typed
prompt rewrites the session ledger with a fresh `detected_at` — so a mid-run
reply already renews the window. Option B is a behaviour and contract change,
not new machinery, and introduces no agent-writable authorization store.

## Descopes — none

No item was descoped, cancelled, weakened, or re-scoped to fit an answer. Three
are **held open with an owner**, which is the opposite disposition:

- `batching-corpus-never-received-the-obligation` — council-owned. AC-1 stays
  open; the delivery half is routed to its own stub.
- `leakage-bench-needs-quota-and-an-uncommittable-corpus` — council-owned. 3.3
  and 3.4 stay open.
- `merge-authority` — **owner-reserved and untouched.** The council ruled in a
  prior run that granting or refusing preauthorized merge authority is a
  resolution of ADR-239 § Decision 3, which a council may recommend and may not
  perform. It gates Phase 7 alone; this run did not reach Phase 7, so nothing
  waited on it.

Two roadmaps had a `[~]` re-closed rather than carried: **0.4 and 0.5**, whose
blocker turned out to be satisfiable in the same run that took the conservative
side on it.

## What the execution found — six defects that outlived their step

1. **Two acceptance criteria shared the number AC-8** on
   `road-to-governed-harness-evolution`, and neither referenced the other — so
   a blocker's *"AC-8 below is it"* pointed ambiguously at a call-site criterion
   and a programme-success criterion. Renumbered to AC-11, blocker repointed in
   a parenthesis rather than silently rewritten.

2. **The resume probe fires on a reference, not on the condition.**
   `gates --all` reports `later/road-to-elicitation-front-door` as `fired`
   because `road-to-suggestion-block-capture` archived — but that roadmap's
   resume condition names `claim:suggestion-capture-rate`, which carries
   `status: unbacked` and no figure. `resume_probe.ts:520` treats an archived
   reference as satisfaction. A roadmap can archive without its claim resolving,
   which is exactly what happened. Filed as a stub; a careless fix produces a
   probe that reports `unmet` forever, and `resumeUndecidable` already stands at
   72 of 73, so a regression would be invisible.

3. **`check_estate_count` cannot see a claim amended in place.**
   `growthClaims` reads only an **added** `+estate_growth_exempt:` key line from
   the patch, so amending an existing **block scalar** adds value lines and no
   key line — the claim is invisible and a legitimately claimed growth is
   refused. Worked around by writing the claim as a single-line scalar the
   parser reads, with the superseded narrative preserved in a sibling key. **The
   gate is unchanged**; the defect will bite every future in-place amendment.

4. **A guard was deleted because its red could not be produced.**
   `proposeCandidates` sorted its output by id as well as its input;
   neutralising the output sort changed nothing observable. A guard whose red
   cannot be produced is indistinguishable from one that does not work.

5. **A verify clause that cannot be met as written, recorded rather than
   stretched.** 3.6's *"every phase's exit criterion is reachable through a
   named verb"* cannot bind on Phases 4–7, which do not exist. The coverage map
   is scoped to the phases that do, and a **test asserts every key belongs to an
   existing phase** — that forcing function is what makes it a scope rather than
   a claim about unwritten phases.

6. **A budget ceiling enforced against a declaration.** `run` derives
   `candidates` from the record set but takes `trials` and `spend` from flags
   defaulting to 1 and 0. Honest today — the verb spends nothing — and a hole
   the moment something does. Landed as risk-register row 12 rather than a
   commit message, because the person wiring Phase 4 is not the person who found
   it.

## Sensitivity — 46 guards seen red

Every new guard across the three branches was neutralised in source, its named
test run, and the source restored from a scratchpad copy — never
`git checkout`. Twelve on the candidate schema, seventeen on the proposer and
verb set, ten on the guard call sites, and seven across the council-topology
work.

Two of those are the ones that settled a council split: neutralising **only**
the throw→process-exit conversion, leaving the guard call in place, still reds
the test — which is the property one seat held a unit test observing a thrown
exception cannot establish.

## Where the run stopped, and why

**Not on quota, and not on a wall.** All three roadmaps advanced and every gate
this run touched is green. What is left is bounded by things the run could not
manufacture:

- **`road-to-turnaround-followups`** — AC-1 needs ten sessions that actually
  received an obligation which, measured, reached at most one and plausibly
  zero. The reading was taken and recorded as a null **about an undelivered
  reminder**; the delivery question has its own stub.
- **`road-to-inbox-harvest-…-council-topology-evidence`** — 3.3 needs ≥ 30 real
  anonymised response bodies, and the council output directory is gitignored and
  auto-pruned, so that corpus cannot be committed. **This does not unblock at
  the quota reset**, which is the half a step-prose condition would have lost.
- **`road-to-governed-harness-evolution`** — Phases 4–7 are ungated and
  unstarted; Phase 7 waits on the owner-reserved `merge-authority`. Phase 4 is
  the natural next cut, and risk row 12 names the first thing it must do.

**One shape worth naming, because it recurred three times in one run.** Every
condition this run could not discharge was given a `## Blockers` entry with an
owner, a class and a `Resolved when` — never a sentence in a step. That is the
direct answer to the failure the previous run recorded, also three times: *"not
a deferred step that goes silently missing, but a deferred condition."* It cost
two `open_blockers` against the ratchet, both claimed in the diff with a real
reason, and it is the cheapest thing in this run.
