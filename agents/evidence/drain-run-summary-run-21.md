<!-- evidence-type: analysis -->

# Autonomous roadmap drain — run 21, 2026-09-05

Autonomous drain under a written owner instruction: drive every active roadmap to
completion, route every open decision to the AI council rather than to the owner,
close gates only legitimately, one pull request per roadmap, no user round-trips.
Three worktrees, two subagent lanes, base `acf134119`.

**Filename.** The instruction named `agents/evidence/drain-run-summary.md`. That
path holds run 18's record and runs 19 and 20 already took suffixed files, so
this run follows the established convention rather than overwriting a prior
evidence artefact. The deviation is stated rather than made silently.

## The queue, recomputed

The instruction's seed table listed 36 roadmaps as verified at `c536dbd`. **Four
existed.** The seed was recomputed before use, as the instruction requires, and
is recorded here because the discrepancy is large enough that a reader would
otherwise assume the seed was followed.

| # | Roadmap | Open at start | Complexity | Lane | Outcome |
|---|---|---|---|---|---|
| 1 | `road-to-the-check-that-cannot-see` | 1 of 15 | lightweight | lead | archived `closed-with-cancellations` |
| 2 | `road-to-the-tenth-arrival` | 1 of 14 | structural | subagent A | archived `completed-with-deferrals` |
| 3 | `road-to-the-hook-that-was-never-installed` | 6 of 6 | lightweight | subagent B | archived `completed` |
| 4 | `road-to-council-topology-evidence-followups` | 38 | structural | — | **excluded by council** — see D-2 |

Queue order followed the instruction's rule: ≥10% progress descending (1, 2),
then <10% by ascending complexity (3, 4).

**Open blockers at start: zero.** `agent-config gates --all` reported no open
blockers anywhere in the tree, so the §2 unblocking sweep was a verified no-op
rather than a skipped step. Two blockers were created and resolved *during* the
run (D-4, D-5); both are recorded below.

## Terminal state

`agents/roadmaps/` holds **one** file: `road-to-council-topology-evidence-followups.md`.

The directory is **not** empty, and per D-2 it may not be. The instruction's
terminal condition ("run until the roadmap directory is empty") is therefore
**not met as literally written**, and the council ruled that condition
incompatible with an enforced repository invariant. Reported as an unmet literal
terminal condition rather than papered over, on the council's explicit
instruction. Every *executable* active roadmap was drained.

`check_estate_count`: `active_roadmaps` 4 → 1.

## Pull requests

| PR | Subject | CI | State |
|---|---|---|---|
| [#1860](https://github.com/event4u-app/agent-config/pull/1860) | `roadmap: complete road-to-the-check-that-cannot-see` | settled green, 6 checks | merged 13:00:36Z |
| [#1861](https://github.com/event4u-app/agent-config/pull/1861) | `roadmap: complete road-to-the-tenth-arrival` | settled green, 6 checks | merged 13:30:16Z |
| [#1864](https://github.com/event4u-app/agent-config/pull/1864) | `roadmap: close road-to-second-trigger-corpus-generation (W-NO)` | settled green, 6 checks | merged 13:49:54Z |
| [#1862](https://github.com/event4u-app/agent-config/pull/1862) | `roadmap: complete road-to-the-hook-that-was-never-installed` | settled green | merged 13:56:35Z |
| [#1863](https://github.com/event4u-app/agent-config/pull/1863) | `fix(roadmaps): land the AC-6 cancellation PR #1860 archived without` | settled green (6 checks) on its first run; re-running after two base updates | open at time of writing |
| [#1866](https://github.com/event4u-app/agent-config/pull/1866) | `docs(evidence): record the run-21 autonomous roadmap drain` | settled green | merged 14:25:20Z |
| [#1865](https://github.com/event4u-app/agent-config/pull/1865) | `fix: the installed-hook check reports, and stops prescribing a downgrade` | settled green, **42 checks** | open — repairs a defect #1862 put on the trunk |
| this PR | `docs(evidence): correct the run-21 record` | — | final PR of the run |

Seven PRs for four roadmaps. The two extra are **not** scope creep and are
explained where they arose: #1864 closes a roadmap this run itself created
(D-4 → D-5), and #1863 repairs a defect this run itself shipped (see § The
defect this run shipped).

**#1863 needed two base updates.** It was opened before #1861 and #1864 merged,
so GitHub reported it `BEHIND` and automerge would not take it; `main` then moved
again when #1862 merged. Each update re-triggered the six checks. One
consequence worth recording: `ci_settle` caps at 9 minutes and the
`Sync + Generate Tools Consistency` job runs ~10, so a first call returned exit
**2** — *not a verdict* — which must not be read as a failure or as a green.

## Council decisions

Five council runs, six decisions. Every seat pair was
`anthropic/claude-sonnet-4-5` + `openai/codex-default`, 2 rounds, `--depth deep`,
round 2 blind-peer-reviewed, quorum **concluded 2/2** in every case. **Total cost
$0.00** — both seats subscription-authed throughout; nothing was billed. Quota
consumed: anthropic 16/50, openai 16/50.

No decision was routed to the owner. No question was asked of the owner.

### D-1 — AC-6 of `road-to-the-check-that-cannot-see`: cancel under delegation

**Question.** AC-6 required denylist coverage of 25 external derivation sources
whose identities are irrecoverable (private, untracked third-party repositories —
`agents/evidence/analysis/inbox-2026-09-fg-verification.md:113`, `:187`). `[x]`
would be false; `[~]` had no genuine receiver; `[-]` is owner-reserved
(`src/agent-src/contexts/execution/roadmap-execution-contract.md:146`). A prior
council (2026-09-04, 2/2) had already ruled `[-]` semantically correct *and* that
an agent may not apply it to itself — decided with no owner delegation in force.
Four options offered unweighted.

**Verdict: split, resolved as A.** openai chose A (`[-]` + memo). anthropic chose
C (rewrite AC-6 to the evaluable mechanism-only criterion, tick `[x]`).

**Unanimous on three points:** the delegation *does* reach the owner-reserved
marker — anthropic conceded it explicitly (*"That language is strong enough to
reach a `[-]` authorization"*); the roadmap may archive; no follow-up stub is
warranted.

**A was taken**, on the evidence rather than the count: (1) the prior 2/2 had
already settled marker-correctness and blocked only on the authorization, which
now exists and neither seat disputed; (2) option C converts an unmet criterion
into a met one, which is the exact shape this roadmap's own subject condemns — a
check reporting `passed` on input it could not see; (3) `[-]` keeps the
unmet-ness and the residual risk legible without a later reader having to
reconstruct that the criterion had been narrowed. The split and anthropic's
dissent are preserved verbatim in the archived roadmap.

**Cancels the criterion, not the risk.** Residual risk that unidentified
derivation sources are absent from the denylist remains **open**.

*Revisit-if:* the 25 identities become recoverable; or a later denylist gap is
traced to this round's unverified sources; or policy establishes that a drop
requires direct human action and cannot be delegated.

### D-2 — the carrier roadmap is out of scope by construction

**Question.** `road-to-council-topology-evidence-followups.md` matches the
instruction's glob. Should the run drain it?

**Verdict: P1-A, unanimous.** Out of scope by construction.

`status: carrier` is **enforced** infrastructure, not a convention. The file is
the live destination for 38 `[~]` items deferred out of an already-archived
parent; moving it out of the tree produces `❌ 38 broken deferral carries` and
exit 1 from `lint_carrier_integrity.ts`, whose baseline names this file by path
as the reason its broken-destination class carries **no baseline at all**.
Promoting it to `ready` would schedule 38 items whose resumption triggers have
not fired, and the file's own header states the flip is a human action.
`lint_plan_risk_register` reports it `carrier-exempt`.

**Both seats required the completion claim to be qualified.** The run may report
completion of every *executable* roadmap; it may **not** report that the
directory is empty or that every top-level file was archived. openai added that
if the owner intended "directory empty" as an absolute filesystem condition, that
condition is incompatible with the enforced carrier invariant and **must be
reported as an unmet terminal condition** — which § Terminal state does.

*Revisit-if:* all relevant deferral triggers fire and the carrier is validly
promoted; or a later explicit decision cancels or safely re-homes all 38
deferrals while preserving carrier integrity.

### D-3 — the fired resume-probe is not resumed

**Question.** `agent-config gates --all` reported a **fired** resume-probe on
`later/road-to-elicitation-front-door.md` ("Fired because:
`road-to-suggestion-block-capture` archived"). Resume it?

**Verdict: do not resume.** anthropic P2-A, openai P2-D — same substance,
different framing, and openai's framing was taken.

The probe fired on a **proxy trigger** (the parent archived). The actual
condition is conjunctive: `claim:suggestion-capture-rate` must carry a resolved
non-DROP verdict **and** a citable figure. Parent archival establishes neither.
The file also sits outside the instruction's non-recursive glob, so importing it
would be estate *growth* mid-drain.

**openai's correction was adopted and is the reason P2-D won:** anthropic's P2-A
left the resume decision "to the maintainer", which under the delegation *fails
the assigned decision-making duty*. The council issues a **binding non-resume
disposition for this run**; evidence verification is reserved for an explicitly
scoped follow-up. Nothing is handed back.

*Revisit-if:* inspection establishes both required claim properties, at which
point resumption goes through an explicitly authorized follow-on run or scope
expansion.

### D-4 — AC-3 of `road-to-the-tenth-arrival`: defer, not cancel (lane A)

**Question.** AC-3 had three conjuncts; two were met. The third — *"expanded with
a positive and a near-miss fixture per addition"* — was blocked by a reproduced
constraint. Five options offered.

**Verdict: A, convergent.** Defer the conjunct `[~]` to a receiver created in the
same change, then archive.

The constraint was **reproduced first-hand at n=1** rather than inherited from
the prior 14-file record: restoring a single preserved corpus file turns **6 tests
red across three published pins**, while `check_routing_coverage` reports it as a
*rise* (`101/299 = 0.3378`) and `lint_skill_trigger_corpus` **passes**. That
asymmetry is the finding — the gates *about* the corpus cannot see the breakage.

Both seats independently routed a `[-]` cancellation **to the owner** on
`roadmap-progress-sync.md:82`, and both rejected the reading that
cancellation-with-a-finding is council-decidable. Both also recorded that
building generation 2 now is **technically feasible**, so the deferral is a scope
judgement and **not** an impossibility claim — stated in the PR, the evidence
file and the receiver rather than smoothed over.

Deferral wired both ends and verified: `[~]` AC-3 carries
`<!-- deferred-resolution: carried-to=road-to-second-trigger-corpus-generation -->`,
and the receiver carries `parent_roadmap` back plus the conjunct **verbatim** as
its own AC-3.

### D-5 — `b-second-generation-worth-building`: W-NO

**Question.** The receiver created by D-4 shipped with one Class-3
`Owner: maintainer` blocker gating every phase: should a second trigger-corpus
generation exist at all? Its own entry stated the inputs were on the record and
**no new measurement was needed**. Four options offered unweighted; the blocker's
own pre-existing `Recommendation:` line was flagged to the seats as an input to
weigh rather than a verdict to ratify.

**Verdict: W-NO, unanimous.**

Evidence: 0 Skill invocations and 0 of 299 distinct skills over 30 sessions and
11,049 assistant turns (`docs/CLAIMS.md § skill-activation-census-zero`); the
corpus is read by three gates and by **no host at routing time**; coverage
100/299; generation 2 costs a migration across 15 scripts and 10 test files;
doing nothing breaks nothing. The load-bearing input is an **absence** rather
than a measurement: nothing in this tree connects corpus coverage to host routing
behaviour.

**Counter-argument overridden, not dropped.** Both seats independently named it:
a versioned generation *would* decouple additions from the published holdout
hashes and make future growth safe. Not disputed — overridden because
safe-expansion infrastructure has no present value until expansion itself has a
demonstrated purpose.

**Frozen means coverage expansion, not immutability.** Bug fixes, corrections to
an entry shown wrong, and a gate-justified one-off addition remain permitted.

AC-3's third conjunct is **retired**, so the deferral chain ends here rather than
spawning a third receiver.

*Revisit-if:* a production host begins consuming the corpus at routing time; or a
controlled host-level evaluation shows broader coverage materially improves
correct skill invocation at an acceptable false-positive rate **and**
generation-1 pinning is what blocks it. **The seats split on the threshold and
the stricter reading is recorded:** one proposed `>0` invocations, the other
refuted it as too weak (a lone invocation could be accidental or manually
prompted). A single invocation is explicitly **not** enough.

### D-6 — git hooks are maintainer-only (lane B)

**Question.** AC-3 of the hook roadmap required the consumer question answered in
writing, either way. Four options: maintainer-only / ship-opt-in /
ship-by-default / leave-open.

**Verdict: maintainer-only, unanimous.** `leave-open` was **explicitly rejected**
as *"not a decision; deferred scope without evidence or an owner"*.

Premise re-verified on the branch rather than inherited:
`grep -rn "git/hooks\|install-hooks" src/install/ dist/install/` returns nothing,
and `package.json:96` guards `prepare` on `[ -d .git ]`, which a registry
dependency never satisfies — so a consumer install writes **no git hooks at all**
today. Reason recorded with the decision: the pre-push chain runs `task
consistency` and `task preflight`, which depend on this repository's Taskfile,
its `./scripts-run` shim and its generated trees, none of which exist in a
consumer project; and a dependency install should not establish persistent
repository execution.

Written in two places: `docs/development.md` § "Git hooks are maintainer-only —
consumers get none", and the file that raised the question, now closed, at
`src/skills/git-workflow/references/push-closes-its-loop.md` § "Answered
2026-09-05".

*Revisit-if:* a consumer-native gate set is designed with its own opt-in command
and consent step.

## Descopes and cancellations

| # | Item | Disposition | Authority |
|---|---|---|---|
| 1 | AC-6, `road-to-the-check-that-cannot-see` | `[-]` cancelled with memo. Criterion cancelled; **residual risk left open** | D-1 |
| 2 | `road-to-council-topology-evidence-followups` (38 items) | untouched, excluded from the run | D-2 |
| 3 | `later/road-to-elicitation-front-door` | binding non-resume for this run | D-3 |
| 4 | AC-3 third conjunct, `road-to-the-tenth-arrival` | `[~]` deferred to a receiver, then **retired** at D-5 | D-4, D-5 |
| 5 | 8 unstarted generation-2 steps + AC-2/AC-3/AC-4 | `[-]` cancelled, per-item memos | D-5 |

No item was dropped without a recorded decision, and no `[-]` was applied without
the delegation that authorizes it (D-1 establishes that reach; both seats agreed).

## The defect this run shipped

**PR #1860 archived its roadmap without the disposition it existed to apply.**
AC-6 was still `[ ]` on `main` after the merge, so an archived roadmap held an
open acceptance criterion and `build_archive_index` classified it
`archived-with-open-steps` rather than `closed-with-cancellations`. PR #1863 is
the repair.

**Cause — mechanical.** `roadmap:progress` archives by **moving** the file. The
staging call then named both the new and the old path; the old path no longer
existed. **`git add` fails atomically on an unknown pathspec** — it staged
*nothing*, and the commit captured only the rename git had already staged,
carrying the pre-edit content. `2>/dev/null` swallowed the error.

**Why verification missed it, which matters more than the cause.** Every check in
that run read the **working tree**, where the edit was present as an unstaged
modification. `build_archive_index` genuinely reported
`closed-with-cancellations` — from the working tree — and it is gitignored
(`.gitignore:126`), so it could produce no diff to contradict the commit.
**Nothing compared the commit against the working tree.** `git status` had said
so the whole time: `RM` means *renamed in the index, modified in the worktree —
not staged*.

This is the same defect class as the roadmap's own subject: a check reporting
green over input it could not see. It is recorded here rather than only in the
PR because the lesson is procedural, not incidental — **verify against the index
or the committed blob, never the working tree.** Every commit after this one in
the run was verified that way, and the verification output is quoted in each PR
body.

## Findings beyond the roadmaps

**The freshness detector caught a live defect on first run.** Lane B's
`src/scripts/check_installed_hooks_fresh.ts` was run against the maintainer
checkout immediately after #1862 merged and reported the installed `pre-push`
hook stale — `installed 6ea9f1174826 ≠ source 765e070cb6a9` — meaning every gate
that hook carries was **inert** on that checkout. `task install-hooks` fixed it;
the detector then reported 6 of 6 hooks matching. Sensitivity is therefore
demonstrated in **both directions on real input**, not only against fixtures.

**The detector then caught a cross-session hook revert, live.** After
`task install-hooks` brought the maintainer checkout to `pre-push 765e070cb6a9`
and the detector confirmed 6 of 6 matching, a later push from the drain worktree
**failed with a shell syntax error** in `.git/hooks/pre-push` at a line number
that did not match the file on disk. `bash -n` and `sh -n` both passed on that
file, and its mtime was **later than the install** — so the push had read the
hook while it was being rewritten. Re-running the detector reported the installed
hash back at the *original* stale value `6ea9f1174826`: another session had
overwritten the fresh hook with an older installer's output.

Linked worktrees share `$GIT_COMMON_DIR/hooks`, so every worktree on this
repository shares one hook set and any session can revert another's install. The
push succeeded once install and push were issued in a single narrow window.
Recorded for three reasons: it is a second instance of the shared-state hazard
the stash incident showed; it is a *validation* of lane B's detector, which
caught a real revert it was never written to anticipate; and a half-written hook
presents as a syntax error at a phantom line number, which is a confusing
signature worth naming. `--no-verify` was never used.

**Another session's stash was popped by accident, and preserved.** A
`git stash push` with an explicit pathspec **failed** (the untracked evidence file
did not match), so it created nothing; the following `git stash pop` then popped
an unrelated session's `stash@{0}` (*"dep-floor + ETARGET README/CONTRIBUTING"*)
into the drain worktree. The pop conflicted, so the stash was **not** dropped.
The four foreign files were restored to `HEAD` and `stash@{0}` was confirmed
intact. Nothing was lost. Recorded because the shared stash stack is a real
hazard for parallel lanes in this repository, and because it is the **same
failure mode** as the #1860 defect: a git command failing on a pathspec and the
next command proceeding as though it had succeeded.

**Three local-only gates are red on `main`, and not from this run.** Lane A ran
the 56 tasks ordered after `task ci`'s first failure individually and found
`lint-eval-freshness`, `check-gate-completeness` and `check-suppression-hygiene`
failing. `git diff origin/main -- src/ tests/ docs/` was **empty** on its branch,
and `grep "agents/"` in the two gate scripts returns nothing; the 12 un-adopted
entries follow 9 gate scripts added on `main` since 2026-08-28. None is invoked
by any workflow (`consistency.yml:159` states no workflow invokes `task ci`).
**Not fixed** — adopting ~12 gate scripts into the ledger and editing another
campaign's `SUPPRESSION_INVENTORY` is a different change with a different
subject. Flagged, not silently absorbed.

## Not claimed

- The directory is **not** empty. The instruction's literal terminal condition is
  **unmet**, by council decision (D-2), and is reported as such.
- AC-6's residual denylist-coverage risk is **not closed** and cannot be while
  the 25 identities are gone.
- Whether trigger-corpus coverage predicts host routing behaviour is **open**.
  Its absence is the *reason* for W-NO, not a finding produced by it.
- The generation-2 phases were **not performed**. `closed-with-cancellations` is
  the accurate disposition.
- The receiver's 38 carried items in the carrier file are **untouched and alive**.
- **No PR in this run was merged by the agent.** Merges were performed by the
  repository, not by this session; merge authorization was never requested and
  never assumed.
- Council response artefacts live under gitignored, TTL-pruned
  `agents/runtime/council/responses/`, so every decision above is reproduced in
  the tree (roadmaps, evidence files, PR bodies) rather than linked.

## Correction — added after this record first merged

**This summary merged (14:25:20Z) before lane B's completion review finished, so
its first version was wrong in one place and silent in several.** The corrections
are appended rather than rewritten in place, so what the record claimed and what
it now claims are both legible.

### #1862 put a defect on the trunk, and this run hit it live

Lane B's roadmap closed 3/3 steps and 3/3 ACs and merged as #1862 — but
**automerge landed it before its completion review completed**, and that review
found the change had shipped the freshness gate as **blocking**, placed **before**
base-freshness, prescribing `task install-hooks` for every mismatch.

That prescription is the bug. From a checkout standing **behind** the base,
`task install-hooks` writes the **older** hook set over the shared `.git/hooks` —
the exact regression the same change refuses auto-repair in order to avoid.
Verified on `origin/main` at `src/scripts/install-hooks.sh:113-133`: the block
ends `exit 1` and its remedy line is `task install-hooks`, ahead of the
BASE FRESHNESS block that follows it.

**[#1865](https://github.com/event4u-app/agent-config/pull/1865) repairs it**
(settled green, 42 checks, `CLEAN`): base-freshness moves first, the freshness
gate becomes **advisory** — *"nothing here sets fail=1 or exits"* — the three exit
codes are separated so a render failure is no longer reported as staleness, and a
third guard (`-d node_modules`) stops a missing-dependency exit from reading as a
mismatch. **Until #1865 merges, `main` carries the defect.**

### The hook revert named correctly

The § Findings entry above says another session "overwritten the fresh hook with
an older installer's output". That is true but stops one step short of the cause,
and the missing step is the point: **the revert is what the trunk defect's own
prescribed remedy does.** Lane B additionally records that the shared
`.git/hooks` was written **three times** during its run — once by a sabotage
probe whose neutralised guard let it install over the real shared directory, and
twice to get pushes through.

So the incident this run treated as an environmental race is better read as a
**reproduction of the defect #1865 fixes**, observed from the other side by the
lead lane. Both readings are kept because the sequence genuinely involved two
sessions; what changed is that the mechanism now has a name instead of an
attribution.

### AC-2 was descoped, and the descope was missing from the table

| # | Item | Disposition | Authority |
|---|---|---|---|
| 6 | AC-2, `road-to-the-hook-that-was-never-installed` — *"leaves the installed hooks matching it, without anyone running a command"* | **met as rewritten; original descoped** | lane B, reopen conditions named in the roadmap |

The original wording has **no unique referent**: eight worktrees share one
`.git/hooks`, so "the installed hooks" names no single object to leave matching.
**Nothing repairs the hooks by itself** — a human still runs the installer. The
run reports staleness and refuses to repair it, for two reasons, one of them
measured: a bash script `cat >`-overwriting its own path **stops executing and
exits 0** (probe: 3 of 5 lines lost, exit 0), so a repair placed in `post-merge`
would truncate `post-merge`.

Step 1.1 also **corrected its own method**: it does not compare against the
installer's heredocs, because `install-hooks.sh` writes `post-merge` /
`post-checkout` as a heredoc **plus** an appended block, so no heredoc slice
equals an installed body — slicing would have been wrong for two of six hooks.
It runs the real installer into a scratch directory through a new
`AGENT_CONFIG_HOOKS_DIR` seam and compares content **and mode** (git silently
*skips* a non-executable hook, so mode is load-bearing).

### Lane B's council and review, which the first version did not record

**Three council rounds**, 2/2 seats, $0.00. Round 1 blocked auto-repair and chose
a blocking gate. Round 2, given counter-facts, **still** chose report-not-repair —
on worktree arbitration rather than trust. Round 3, raised by the blind review,
chose **advisory**, *reversing round 1's own blocking decision*. Worth recording
plainly: **the council rejected two things the lane had already written**, one of
them already pushed.

**Blind review: 20 findings, 19 fixed, 1 accepted-risk.** Two fresh subagents,
dispatcher-authored prompts committed beside their verdicts. Sharpest findings:
`resolveHooksDir` ignored `core.hooksPath`; the executable bit was unchecked; two
test assertions were weaker than the roadmap claimed (one tautological, one
form-specific); and `git pull --rebase` reaches neither carrier — **named, not
closed**. Sensitivity re-proven on every guard (9 sabotages, each reverted, 26/26
restored green).

### Also flagged, not fixed

- **`dispatch_r2_reviewer` and `check_completion_review` disagree on the scope
  hash** unless dispatched with `--base origin/main`. Cost three rounds; reported.
- **The `core.hooksPath` branch of the new resolver is unverified.** This
  repository's own `block-no-verify` guard refuses any command carrying
  `core.hooksPath` — read-only probes included — and blocked the probe twice. The
  limitation is stated in the code. An over-broad guard preventing verification of
  a fix is worth its own look.
- **A `Co-Authored-By` trailer** the environment mandates but
  [`no-attribution-footers`](../../src/rules/no-attribution-footers.md) forbids
  sits on lane B's pushed commits. PR-body footers were stripped; published
  history was not rewritten to remove the trailers.
- The **9 pre-existing reds on `main`** are lane B's count against the lead lane's
  3. Both are un-reconciled readings of different task subsets, and neither is
  reached by any workflow. Not reconciled here rather than silently averaged.

### Still not claimed

- `main` **carries the trunk defect** until #1865 merges.
- **Nothing repairs the installed hooks automatically.** A human runs the
  installer; the gate only reports.
- The literal terminal condition remains **unmet** (§ Terminal state), unchanged.
