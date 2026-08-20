---
complexity: structural
status: ready
estate_offset_exempt: "Every item was OBSERVED — in the transcripts of the 50 most recent sessions on this checkout, in a maintainer-supplied review of the 14.5.0 → HEAD window, or in a live measurement taken while writing this file. None has an owner today. Dropping them is not available under fix-what-you-see. The offset alternatives cost more than this line: no active roadmap sits at zero open steps, so archiving buys nothing; parking in later/ is what the estate register itself calls burial; and the roadmaps I could terminate belong to concurrent sessions, which is a judgement about their work rather than mine. Charged as one reviewable line, per this gate's own instruction."
execution:
  mode: phase-checkpoints
---
# Road to closing what fifty sessions left open

> **Source, and it is two.** (1) A read of the 50 most recent agent sessions on
> this checkout, 2026-08-17 → 2026-08-20. (2) A maintainer-supplied review of the
> `14.5.0 → HEAD` window, handed over on 2026-08-20.
>
> **Every number below was re-measured on this tree**, not carried over. Where
> the handed-over review and the tree disagree, the tree wins and the difference
> is stated — three of them are recorded in § 0.2, because a review quoting a
> branch and a file quoting the merged tree is exactly the staleness this
> repository refuses elsewhere.
>
> **Not a duplicate of anything active.** Where a finding already belongs to a
> live roadmap, this file routes it there and says so. What it owns is the
> residue: work interrupted mid-run, work declared finished while its own
> acceptance criterion said otherwise, and defects that were seen, written into
> a reply, and never given a home.
>
> **No blockers, by instruction — the three decisions were taken.** An earlier
> draft carried three `### blocker:` entries. The maintainer instructed that this
> file ship with none and that the decisions be taken by the AI council instead.
> They were, on 2026-08-20: two seats present, three independent verdicts
> (a blind third round included), $0.0370. The verdicts and their falsifiers are
> in § 0.4, and each one is a step below rather than a question above.

## Outcome — the up-front classification (2026-08-20 drain run)

Closed against explicit outcome states, per the framework of record in
[`agents/evidence/council/drain-blocker-dispositions-a.md`](../evidence/council/drain-blocker-dispositions-a.md) <!-- ref-ignore -->
and its batch-B sibling. **Archived does not mean achieved.** The dashboard
renders a file with no `[ ]` and no `[~]` at 100 %; that percentage describes
whether every line reached a *decided* state, never whether the goal was
reached. Most of this file did not reach its goal, and the rows below say which.

**The classification was written and committed before any execution work**, so
that a later reader can tell a disposition chosen on evidence from one chosen
to make a box flip. Four states, and they are not interchangeable:

- **satisfied** — landed work in this repository, citable by `file:line` or by
  real command output quoted in this file.
- **transferred** — the scope decision is made and the work is wanted; what is
  missing is something no repository automation supplies here (a live session, a
  host capability, a human observation, an owner's consent, or a destructive act
  on a shared machine). Moved to a stub with the criterion verbatim, the
  dependent steps, and a **named** producer plus a probe measured today.
- **terminal null / closed by events** — the instrument ran and returned zero, or
  the condition the step described no longer holds on this tree. An answer, not
  a failure.
- **abandoned** — a declared Non-goal with no committed producer.

### What this run corrected in the roadmap's own claims

Four of this file's premises are refuted by the tree it describes. Recording
them is the point: a drain run that only flips boxes launders a stale finding.

| This file said | Measured today | Consequence |
|---|---|---|
| 1.4b is "the half that genuinely has no gate" | `check_release_highlights.ts` exists, and on `--version 14.6.0` emits `⚠️ auto-derived head line(s) not yet rewritten for 14.6.0: Behaviour changes, Security and correctness, Honest nulls — advisory, not blocking.` | The gate sees the exact seven markers. It is **advisory by design**, with a documented reason. 1.4b is not "build a guard" but "promote a warn to a block" — a policy decision, not construction |
| 5.1 — `lint_roadmap_complexity` is red on the trunk | `exit 0`, 35 roadmaps clean; `road-to-hook-state-followups.md:2` now reads `complexity: lightweight` | Closed by events by the concurrent session that owned the file. Half of 5.1 no longer exists |
| Phase 3 — "91 rules in both layers, 91 duplicate and 0 divergent … zero divergent is the important half" | `overlap 110 rule(s) in both layers (0 duplicate, 110 divergent)` | The split is **inverted**, and I cannot tell from here whether that is a repo property or an artifact of this worktree's project layer being fresher than the global install. Recorded as seen; the conclusion is transferred rather than guessed |
| 3.2 — the partition "is blocked on `partition-current-layer-undecidable`" | `archive/road-to-single-delivery.md:828` reads `**Status:** resolved`, and `check_single_delivery` states "the partition shipped (ADR-236 Phase 2)" | Closed by events. The blocker 3.2 exists to unblock is already resolved and its roadmap archived |

A fifth number moved under my own hands and is worth stating because it is the
cleanest evidence in the file for Phase 3's machine-dependence claim:
`check_standing_rule_delivery` reported **115 781 tok (one layer, 105.3 %)** and
then **209 767 tok (two layers, 190.7 %)** on the *same tree in the same session*,
the difference being only which layers were installed where. The gate is
measuring the machine, not the repository.

### Phase-by-phase disposition of all 54 lines

42 steps + 12 acceptance criteria. **satisfied 14 · transferred 34 · terminal
null 4 · abandoned 2.**

| Line | State | Basis |
|---|---|---|
| 1.1 repair both published heads | **satisfied** | Seven markers rewritten with content derived from the real spans |
| 1.2 record `14.3.0` burned, machine-readably | **transferred** | No record surface exists (`grep -rl burned src/config/` → 0). Creating one *and* teaching `release.ts` to refuse is release-tooling design owned by the release runbook's owner |
| 1.3 verify stale release branches | **satisfied** on its own verify line | Verify asks for a recorded per-branch finding, not a deletion. All five verified and quoted below. The **deletion** is a Hard-Floor remote act → transferred |
| 1.4 decide the drift detection window | **transferred** | A policy decision about a cron window, owner: maintainer. Not an agent's to take and call landed |
| 1.4b placeholder guard | **transferred**, premise corrected | The gate exists and warns by design (table above). Turning a documented warn into a block is the same decision class as 1.4 |
| 1.5 why manual review failed twice | **transferred** | "Why did a human skip a step" is a human observation. No artefact in the tree answers it |
| 2.1–2.4 injection scanner (5 lines) | **transferred** | `b-injection-scan-unwrap-security` is `Owner: user`, `Class: 2 — consent-once`, `Status: open` in `road-to-per-turn-hook-economy`. Consent has not been given. Measured today: `payloadOf` × **0** in `src/scripts/injection_scan_hook.ts` vs × **2** in the fixed sibling — the defect is exactly as described and still there |
| 3.1 route the duplication measurement | **satisfied** | Filed once, with both of this session's layer readings and their machine-dependence |
| 3.1b reconcile the two instruments | **satisfied** | Populations named from the two scripts; they count different things and the narrower one now says so |
| 3.2 make the partition blocker decidable | **terminal null / closed by events** | `Status: resolved`; partition shipped under ADR-236 Phase 2 |
| 3.3 state the CI-blindness disposition | **satisfied** | The check's header now states where it is meaningful |
| 4.1 write the promised structure roadmap | **transferred** | Its verify demands an owner per question. Naming an owner who has not agreed is fabricating one |
| 4.2 close the `always`-vs-`auto` pricing gap | **transferred** | A budget-policy decision across two gates |
| 4.3 fix census staleness | **satisfied** | Re-measured; finding recorded below |
| 4.4 stop condition for three ratchets | **transferred** | "What would make a raise refusable" is a policy statement with a named owner |
| 5.1 fix the two live reds | **narrowed** — half terminal null, half transferred | Complexity: green, `exit 0`. Standing delivery: still `exit 1`, and its cause on this machine is two installed layers, which is Phase 3's subject and not a red anyone can fix in this file |
| 5.2 classify the 165 unreached gates | **narrowed** — baseline half **satisfied** | The ratchet is walked 166 → 165 (down, measured). Classifying 165 gates one by one is per-gate judgement at a scale this run cannot honestly do → transferred |
| 5.3 make a trunk red discoverable | **transferred** | Needs a scheduled workflow — a CI-surface decision, and the step itself forbids the migration shortcut |
| 6.1 scope `task consistency`'s diff check | **satisfied** | `taskfiles/content.yml` no longer ends in an unscoped `git diff --quiet` |
| 6.2 pathspec the commit flows | **transferred** | Changing agent-facing commit flows touches the flows every concurrent session is using right now |
| 6.3 state what a shared checkout costs | **satisfied** | The collision text names the shared index, the shared stash stack and the pre-push consequence |
| 7.1–7.10 (11 lines) | **transferred** | Three independent reasons, any one sufficient: the acts are Hard-Floor destructive on a machine with 18 open PRs and live peer sessions; `road-to-estate-drawdown` is **active** and carried an open PR during this run, so the work has a present owner; and every figure is stale — re-measured today **384** worktrees (was 346), **973** local branches (929), **267** remote (245), **18** open PRs (0), 5 stashes |
| 8.1 decide `run_continuation_hook`'s shape | **transferred** | Split-or-keep is a design decision. Measured: **1 502** lines |
| 8.2 make a findings re-bind derivable | **transferred** | A redesign of the R2 machinery, owned by the roadmap that ships it |
| 8.3 decide the evidence-to-product ratio band | **abandoned** | The step asks for "a stated acceptable band" for a ratio; no producer is committed to owning a band, and its own escape hatch — "a dated note says the ratio is not a quantity worth bounding" — is the honest answer. Recorded as such rather than transferred to nobody |
| 8.4 unreachable `triggers.json` | **satisfied** | Resolved in the direction the verify allows |
| 8.5 `hook_manifest.json` classed AUTHORED | **satisfied** | Now `GENERATED`; `isGenerated` returns true |
| 8.6 the AC extractor misses its corpus | **satisfied** | Fixed both halves; before **11** of **16**, after **16** of **16** |
| AC-1 | **transferred** | Its first half is satisfied by 1.1; its second half ("cannot be merged or published") is 1.4b's transferred decision |
| AC-2 | **transferred** | With 1.2 |
| AC-3 | **satisfied** | Five branches, each with a quoted finding |
| AC-4 | **transferred** | With 1.4 + 1.4b |
| AC-5 | **transferred** | With Phase 2; consent-once, owner: user |
| AC-6 | **narrowed** | Filed once (3.1) and the instruments reconciled (3.1b); the partition half is closed by events (3.2) |
| AC-7 | **transferred** | With 4.1, 4.2, 4.4; the no-pre-merge-figure half is satisfied by 4.3 |
| AC-8 | **transferred** | With 5.2's classification and 5.3 |
| AC-9 | **satisfied** | With 6.1, proven both directions |
| AC-10 | **transferred** | With Phase 7 |
| AC-11 | **transferred** | With Phase 7 |
| AC-12 | **narrowed** | Three of six Phase-8 items fixed; two transferred, one abandoned with a reason |

Two lines are marked **abandoned** rather than transferred: 8.3 above, and
Phase 7's implicit "storage target reached" state, which 7.10 already defines as
*separately owned and scheduled* — this file may not carry it, and creating a
stub for a state another roadmap owns would be filing the same work twice.

## 0.1 What the two reads found

The failure pattern is not "a task went wrong". Almost every session ended with
green CI and a merged PR. What accumulated is what happens **between** sessions —
and, in the review's words, a governance layer that documents deterioration
excellently and increasingly does not prevent it.

| # | Class | Measured on this tree, 2026-08-20 |
|---|---|---|
| 1 | ~~A release that reached nobody~~ **closed by events during authoring** | The `14.6.0` line completed at 10:00:08Z on 2026-08-20 — tag on origin, GitHub release, registry serving it. A gate for exactly this drift **exists and is wired**; it runs on a daily cron, so the ten-hour gap sat inside its detection window. See § 0.3 — the finding is the window, not an absence |
| 2 | An uncurated release head, shipped twice | seven `_auto-derived, rewrite before merge:_` / `fill before merge` markers across the `14.5.0` **and** `14.6.0` sections on `origin/main` — both now published |
| 3 | A version burned outright | `14.3.0`: no tag, no release, no registry version, no CHANGELOG section — and **five** stale release branches sit on origin: `release/1.30.0`, `release/3.0.0`, `release/3.1.1`, `release/5.4.0`, `release/14.3.0` |
| 4 | The security half of a fixed defect, unfixed | `injection_scan_hook.ts` uses `payloadOf` **zero** times and falls back to serialising the whole envelope; its sibling `ship_diff_volume_hook.ts` uses it twice |
| 5 | Double delivery, measured and still running | `check_standing_rule_delivery`: 195 383 tok against a 110 000 cap, **91 rules in both layers**; `generate-tools` reports **110 rules · 290 skills · 40 commands** delivered twice; the partition that would fix it is blocked |
| 6 | Budgets that ratchet upward | pack cap 6.4 → 6.9 → 7.8 → **8.4**; `unconditional_tokens` **108 130**; one allowlist entry has **2 characters** of headroom |
| 7 | Gates nobody sees run | **165** local gates that no workflow invokes, and two of them red on the trunk right now |
| 8 | Interrupted work still on disk | 12 worktrees hold uncommitted paths; 5 branches are not ancestors of the trunk |
| 9 | Estate growth | 346 worktrees · ≥54 GB · 929 local branches · 245 remote branches against **0** open PRs |
| 10 | A hook that became a subsystem | `run_continuation_hook.ts` at **1 499** lines after nine review rounds |
| 11 | Proof prose outweighing product | since `14.5.0`: 198 commits, +37 160/−1 499 lines, of which `agents/evidence` is **20 555 insertions (55 %)** against `src/scripts`' 4 979 — and **23** commits whose subject is a findings re-bind |

## 0.2 Where this file disagrees with the handed-over review

Three numbers differ, all because the review read a branch and this file reads
the merged tree. None of them changes a conclusion; they are recorded because an
unrecorded difference is how a stale figure gets quoted a third time.

| Claim in the review | This tree | Why |
|---|---|---|
| 173 commits, +33 061/−1 329 | 198 commits, +37 160/−1 499 | PR #1458 merged after the review was written |
| `agents/evidence` at 62 % of insertions | 55 % (20 555 / 37 160) | same merge; the ratio to `src/scripts` is ~4:1 |
| standing delivery at 185.3 % | 177.6 % here (195 383 / 110 000) | the figure is a property of the machine's two layers, not of the repo — which is itself the point of item 5 |

## 0.3 What closed itself while this file was being written

The `14.6.0` line completed between the first measurement and the rewrite: tag
on origin, GitHub release at 10:00:08Z, registry serving it, trunk agreeing.
Two steps of the original Phase 1 are therefore closed by events rather than by
work, and the blocker that guarded them is answered — option (a), carried out.

That is recorded rather than quietly deleted, for two reasons. It is exactly the
staleness § 0.2 objects to, caught on this file rather than on someone else's.

And the second reason is a correction this file owes itself. An earlier draft
said the ten-hour gap proved that "nothing reported it". **That was wrong, and
the tree said so within the hour**: `check_release_published.ts` exists, tests
both invariants — a tag on the **remote** and the registry's `latest` matching
`package.json` — and is wired into `.github/workflows/release-drift.yml`.

What it is not is a merge-time gate. Its triggers are a daily cron at 07:23 UTC
and manual dispatch, with a `push:` trigger deliberately omitted to avoid
phantom zero-job runs, and the workflow header states the consequence in its own
words: *"That is a 24h detection window, not a merge-time gate."* The gap was
about ten hours. It sat inside the window by design.

So step 1.4 is not "build a monitor". It is the narrower and more useful
question of whether a 24-hour window is the right one for this failure class,
given that a release which stops at the tag serves the previous version to
everyone for the whole window.

## 0.4 The three decisions, and how they were taken

Council, 2026-08-20, two seats plus a blind third round, $0.0370. Each verdict
below is a step in this file, not a question in it.

| Decision | Verdict | Falsified by |
|---|---|---|
| Injection scanner read contract | **(b)** — `payloadOf` primary, whole-envelope fallback retained as a **deliberate, sanitised, tested, rate-limited and time-limited** degradation. Unanimous across three independent answers: for a scanner, a missed injection is the worse error, so the fallback stays and stops being an accident | proof that `payloadOf` exhaustively covers every legitimate dispatcher envelope, or measured evidence that sanitised fallback scanning produces enough false positives to make the scanner ineffective |
| Hard-Floor bulk deletion | **split, and the split is the answer.** One seat: (b), deletion leaves the roadmap so the roadmap gets an honest completion boundary. Two: (c), because (b) as stated repeats the predecessor's failure — it completes while the disk stays full. Converged content: **two completion states**, `cleanup ready` and `storage target reached`; the roadmap may close on the first and must create a separately owned, scheduled action for the second; a prepared plan **expires** and is regenerated before confirmation | evidence that defining a storage target is impossible because disk is not the real constraint, or that the separately owned operation is never invoked |
| Burned version + stale branches | **(a)**, unanimous, with four additions: verify each stale branch for unique commits **before** deleting it, make the burned version machine-readable so release tooling refuses reuse, block placeholders at merge **and** at publication, and investigate why manual review failed twice rather than only adding the check | a binding policy that published CHANGELOG sections are immutable; unique commits on a stale branch falsify deleting *that* branch, not the rest |

One seat added a point neither of the others made and it is carried into 1.4:
the ten-hour version gap is a **release-integrity** failure distinct from the
placeholder failure, so the answer is a consistency monitor across trunk
version, tag, release and registry — not merely a placeholder guard.

## 0.5 Why this order

Acute-before-structural, and rescue-before-deletion:

1–2 are what someone outside this repository can see wrong **today**, and one of
them is a security surface. 3–4 are the two live cost curves — a defect that
runs in every session and the budgets that keep absorbing it. 5 is why 1–4 stay
invisible. 6 is why individual runs keep failing on things unrelated to their
work. 7 rescues before 7 deletes. 8 is the maintenance debt and the leftovers.

## Phase 1 — release integrity: what the completed release left behind

The `14.6.0` line completed during authoring (§ 0.3), so the two steps that
carried it are closed by events. What it left behind is not.

**The curated CHANGELOG head shipped uncurated, twice in a row.** Seven markers —
`_auto-derived, rewrite before merge:_` and `fill before merge` — sit across the
`14.5.0` and `14.6.0` sections on `origin/main`, and both are published. The
tooling generates those placeholders and expects a human to overwrite them before
merge. That did not happen, and then did not happen again.

**`14.3.0` is burned** — no tag, no release, no registry version, no CHANGELOG
section — and five release branches sit on origin: `release/1.30.0`,
`release/3.0.0`, `release/3.1.1`, `release/5.4.0`, `release/14.3.0`.

- [ ] **1.1 Repair both published heads.** The council was unanimous on option
      (a): a published section cannot be un-published, and it is also the file
      the next reader reads. Three placeholder lines in each of the two sections.
      verify: no `rewrite before merge` or `fill before merge` marker survives in
      any released section of the CHANGELOG.

- [ ] **1.2 Record `14.3.0` as burned, machine-readably, and make the tooling
      refuse to reuse it.** A prose note is what the last ten hours showed to be
      insufficient. The registry entry is what a release run can read.
      verify: a release run attempting `14.3.0` refuses, citing the record.

- [ ] **1.3 Verify each stale release branch, then delete the verified-empty
      ones.** The council's addition, and it is load-bearing: "old" is evidence
      for investigation, not proof that deletion is safe. Check
      `origin/main..origin/release/<v>` for unique commits per branch; a branch
      carrying any is reported rather than deleted.
      verify: every remaining release branch on origin has either a tag or a
      recorded unique-commit finding, and the check is quoted per branch.

- [ ] **1.4 Decide the detection window for release drift — the gate already
      exists.** `check_release_published.ts` tests both invariants and is wired
      into `release-drift.yml`; its triggers are a daily cron and manual
      dispatch, which the workflow header itself calls a 24-hour detection
      window rather than a merge-time gate. The `push:` trigger was omitted
      deliberately, to avoid phantom zero-job runs on a path-filtered push.
      Three options, and this step picks one with its reason: accept the window
      as correct for a drift that only a release run can cause; add a
      merge-time check on the release-PR path, which needs the phantom-run
      problem solved rather than re-encountered; or shorten the cron. What is
      not available is repeating "nothing reported it", which was this file's
      own error.
      verify: the chosen option is recorded with its reason, and — if the window
      changes — a fixture reproducing the ten-hour gap shows the new trigger
      firing inside it.

- [ ] **1.4b A placeholder guard, which is the half that genuinely has no
      gate.** A release head carrying `rewrite before merge` must not merge and
      must not publish. This is a different failure from 1.4's: the drift gate
      compares versions across systems and would pass a perfectly tagged release
      whose head is uncurated — which is exactly what happened twice.
      verify: the guard fails a release head carrying a marker, proven on a
      fixture built from the real `14.5.0` head.

- [ ] **1.5 Ask why manual review failed twice, and answer it in the checklist.**
      The council's sharpest point on this decision: a placeholder check treats
      the symptom, and a check added without knowing why the human step was
      skipped becomes the next thing bypassed under time pressure. Three
      questions it names — is the release checklist actually followed, does it
      carry "verify no placeholders" as a discrete step, and is there a
      documented path when a release ships with them anyway.
      verify: the checklist carries the discrete step and the escalation path,
      and the answer to "why twice" is written down rather than assumed.

## Phase 2 — the half of the payload defect that was left unfixed

PR #1455 fixed a real, measured bug: `ship_diff_volume_hook` read `tool_input`
and `command` from the envelope **root** instead of from `payload`, so under the
real dispatcher it never found anything — a dead hook that cost a dispatch per
turn and could never fire. The fix is sound and tested.

The security half was split off and is still open. `injection_scan_hook.ts`
reads its result keys from the root and falls back to serialising the whole
envelope; measured here, it calls `payloadOf` **zero** times while its fixed
sibling calls it twice. The council recommended fixing both; the recorded
decision was to fix one and file the other as `b-injection-scan-unwrap-security`
(owner: maintainer) on the grounds that narrowing a security surface needs a
contract plus fixtures first. That reasoning holds. The outcome does not: **the
only reader in the pair marked security-relevant is the one still working by
accident**, and nothing tests the accident.

**The council decided the shape: (b), unanimously across three independent
answers.** `payloadOf` becomes the primary path; the whole-envelope fallback is
**kept** — because for a scanner a missed injection is the worse error — and
stops being an accident: sanitised, tested, rate-limited and time-limited.

- [ ] **2.1 Write the contract the deferral asked for, to the council's shape.**
      What the scanner reads first, what the fallback is allowed to include, and
      what it excludes — known credentials and transport metadata are named out;
      unknown fields stay in, which is what preserves the false-negative
      preference without widening sensitive-data handling.
      verify: the contract names the primary path, the fallback's inclusion rule
      and its exclusion list.

- [ ] **2.2 Build the fixtures.** Real envelopes for each shape the dispatcher
      emits, including the wrapped shape the sibling fix revealed, plus a
      negative that must not scan clean.
      verify: a fixture exists per shape, and the negative fails against today's
      scanner.

- [ ] **2.3 Rewire the reader: `payloadOf` primary, fallback only on genuine
      extraction failure.** An empty payload is not an extraction failure — the
      council named that trap explicitly, and it is the one that would silently
      re-create today's behaviour.
      verify: the scanner reads through the payload accessor, the fixtures pass,
      and the negative fails before the change and passes after.

- [ ] **2.3b Make the fallback observable and bounded.** Its use emits telemetry
      carrying the envelope **shape and not its content**, and is rate-limited.
      Ten uses in thirty days is the council's threshold for treating a shape as
      one that needs canonical support — without it the fallback works, so
      nothing ever makes a new envelope shape canonical, and the contract rots
      while passing.
      verify: a fallback use emits a shape-only line, and crossing the threshold
      produces a signal rather than silence.

- [ ] **2.4 Close `b-injection-scan-unwrap-security` where it lives.** The
      blocker sits in `road-to-per-turn-hook-economy`. This phase does the work;
      that roadmap records the closure, citing the council verdict rather than
      re-deciding it.
      verify: the blocker's status is resolved, citing this phase.

## Phase 3 — double delivery: measured, gated, and still happening

`check_single_delivery` is good work: it reads both layers from the filesystem,
separates raw overlap from scope defeat, proves its own binding with a test that
corrected an earlier finding of its own, and found a third duplicated type. It
runs **report-only**, and in CI it finds **zero** layers — `.claude/` is
gitignored and no CI leg installs at user scope, so the overlap is a property of
the developer machine and CI is structurally blind to it. The partition that
would make the invariant true is Phase 2 of `road-to-single-delivery`, blocked
on `partition-current-layer-undecidable`.

Meanwhile the measurement on this machine: **195 383 tokens against a 110 000
cap, 91 rules in both layers, 91 duplicate and 0 divergent.** Zero divergent is
the important half — the duplication is pure waste, not a conflict. And the
generator says the same thing from the other side, unprompted, on every run:
`a global layer holds the same names (rules=110 skills=290 commands=40) — the
host loads both with no dedup, so these are delivered twice per session`. The
rule count in that line is larger than the delivery gate's 91 because the two
count different populations, which is itself worth resolving: two instruments
measuring one defect should not disagree silently about its size.

- [ ] **3.1 Route the 91-rule duplication measurement to the roadmap that owns
      it, with its provenance.** `road-to-single-delivery` owns the partition;
      `road-to-cost-parity-1-rule-payload-diet` and
      `road-to-request-scoped-rule-load` own parts of the payload surface. Read
      all three, file it once, and record here which took it. The figure is
      machine-dependent (§ 0.2) and must be filed as such.
      verify: the measurement appears in exactly one roadmap, with the layer
      counts and the machine-dependence stated.

- [ ] **3.1b Reconcile the two instruments that disagree about the size.** The
      delivery gate counts 91 duplicated rules; the generator's own warning
      counts 110 rules plus 290 skills plus 40 commands. Both are believable and
      they cannot both be the population. Whichever is right, one instrument is
      currently understating a defect it exists to size.
      verify: the two counts are derived from a stated shared population, or one
      of them names why its population is narrower.

- [ ] **3.2 Make `partition-current-layer-undecidable` decidable, or say plainly
      that it is not.** It has held Phase 2 twice. A blocker that cannot be
      decided is not a blocker, it is a deferral wearing one — and the estate
      register's own vocabulary distinguishes them.
      verify: the blocker either carries a decidable predicate or is converted to
      a recorded deferral naming what would make it decidable.

- [ ] **3.3 Give the CI-blindness a stated disposition.** A gate that finds zero
      layers in CI is not broken, but "report-only, and blind where it runs" is
      two facts that read as one. Either the CI leg grows a user-scope
      installation so the check has something to read, or the check declares
      itself developer-machine-only in its own header.
      verify: the check's header states where it is meaningful, or CI installs
      the second layer.

## Phase 4 — budgets that document deterioration instead of preventing it

Three ratchets moved the same way in one window, each with an honest,
falsifiable note attached:

- **Pack cap** 6.4 → 6.9 → 7.8 → **8.4**, the third consecutive raise. The note
  is exemplary — trip cause measured, alternative measured and rejected,
  decision-maker named — and it also records that the 2026-08-10 warning ("a cap
  pinned just above the measurement reds on the next commit and teaches the
  reader to raise it again") arrived **on schedule**. It names the real problem
  (`src/scripts/` is 14.9 of 26 MB unpacked, `src/agent-src/` partly duplicates
  `dist/agent-src/`, and whether a consumer needs the 846 KB `ai_council/` is
  unverified) and defers it to a structure roadmap that does not exist.
- **Standing context** `unconditional_tokens` **108 130**, raised twice inside
  24 hours.
- **`check_always_budget`** passes at 60.1 % on raw characters while its
  per-file allowlist entries sit flush against the measurement: one is
  `ext=8 864` against `≤ 8 866` — **two characters**. A new `always` rule
  therefore cannot land, which is recorded as the reason a rule shipped `auto`
  instead: the same 3 121 tokens moved from a budget that refuses them into one
  that only asks for a sentence. The census entry states this rather than hiding
  it, and stating it does not undo it — two gates price the same load
  differently and the load moved to the cheaper one.

- [ ] **4.1 Write the structure roadmap the pack note promised.** Three
      questions it already asked and did not answer: what of `src/scripts/`'s
      14.9 MB a consumer needs, whether `src/agent-src/` duplicating
      `dist/agent-src/` is intentional, and whether `ai_council/` ships at all.
      Before the fourth raise, not after.
      verify: the roadmap exists and each of the three questions has an owner.

- [ ] **4.2 Close the `always`-vs-`auto` pricing gap.** Either the two budgets
      price the same load the same way, or the `auto` side gains the ceiling the
      `always` side has. Left open, the `always` budget is bypassable by
      construction and its 2-character headroom stops being a constraint at all.
      verify: a rule that would exceed the `always` cap cannot land under `auto`
      without meeting an equivalent ceiling, or a dated decision records why the
      asymmetry is correct.

- [ ] **4.3 Fix the census staleness and pin the rule that prevents it.** One
      history entry records `103,265 → 106,386` while the file's own value is
      `108,130`: the entry describes a pre-merge branch, not the merged tree.
      `estate-count-budget.json` refuses exactly this in its own
      "RE-MEASURED AT MERGE" notes, twice. The rule exists; it is not applied
      here.
      verify: every budget history entry's figures match a measurement of the
      tree the entry landed on.

- [ ] **4.4 Give the three ratchets a stop condition, or record that they have
      none.** A budget raised three times in a row is on its way to being a
      formality however good the notes are — the notes say so themselves. What is
      missing is the sentence that says what would make a raise refusable.
      verify: each of the three budgets carries either a stop condition or a
      dated statement that raises are unconditional and why.

## Phase 5 — the gates nobody sees run

This phase exists because writing Phase 1 tripped over it. Two gates are red on
the trunk **right now**, and neither has reported it to anyone:

- `lint_roadmap_complexity` fails on `road-to-hook-state-followups.md`, whose
  frontmatter declares a complexity value the gate does not accept.
- `check_standing_rule_delivery` reports 195 383 tokens against a 110 000 cap.

Both are bound in the local task chain and in no workflow. The measurement:
`check_ci_local_parity` reports **165 local gates that no workflow runs**
(baseline 166), and separately **64 CI-enforced gates that `task preflight` does
not reach** — so a green preflight is not a prediction, and a green CI is not a
statement about the 165. The repository already knows: two workflow headers say
in their own comments that no workflow invokes `task ci`, and the
`lint_roadmap_blockers` baseline note records **twice** that a ratchet was found
red on main with nobody aware.

- [ ] **5.1 Fix the two live reds, each in its own change.** The complexity one
      is a frontmatter value in a file a concurrent session authored — one word,
      and not this roadmap's to sweep silently; surface it to that work or fix it
      with a stated reason.
      verify: both gates exit 0 on the trunk.

- [ ] **5.2 Classify the 165 unreached gates. Do not migrate them.** Three honest
      answers exist and they are not the same: a gate belongs in CI, or it is a
      developer aid and should say so in its own header, or it is dead. The
      current state makes all three look identical from outside. Migrating 165
      gates into CI would red the trunk on the landing day, which is how a result
      teaches people to ignore it.
      verify: every gate in the local-only set carries a recorded class, and the
      ratchet's baseline is walked to the measured number.

- [ ] **5.3 Make a trunk red discoverable without a person running the chain.**
      The minimum is that something runs the local-only set on a schedule and
      reports, even if it cannot block. A gate visible only to a developer who
      runs it by hand is, for anything that breaks between two runs, the same as
      no gate — which is what both recorded instances were.
      verify: a red in the local-only set produces a signal with no human
      invoking the chain.

## Phase 6 — the shared checkout, which is a cause and not a symptom

Three separate sessions lost time to one structural fact: several agents work in
**one** checkout on **one** branch. The session register reports the collision
and asks once; nothing downstream is built for it.

- [ ] **6.1 `task consistency` ends in a bare `git diff --quiet`.**
      `taskfiles/content.yml` closes the task with an unscoped working-tree
      check, and the pre-push hook runs *only* this task. A concurrent session's
      three uncommitted files therefore fail a check about **derived-output
      drift** — which is what blocked the `14.6.0` tag push, where the agent
      correctly refused `--no-verify` and went to a clean clone instead. Scope
      the check to the paths the task regenerates.
      verify: `task consistency` passes on a tree clean in the generated paths
      and dirty elsewhere, and still fails on real derived drift.

- [ ] **6.2 `git add -A` in a shared checkout stages another session's work.**
      Measured 2026-08-20: a peer session's untracked roadmap was swept into an
      unrelated merge commit and surfaced three commits later at an estate gate.
      The trunk carries the correction commit — "untrack the peer session's
      roadmap I committed by accident" — so the incident is in the history, not
      only in a transcript. The fix is not "be careful": the agent-facing commit
      flows use pathspecs, and a staged path outside the session's own diff is
      refused or surfaced.
      verify: a staged file no step in the session touched produces a refusal or
      an explicit surface, on a tree carrying a foreign untracked file.

- [ ] **6.3 State what a shared checkout costs, at the point the collision is
      announced.** The register's two options are "join anyway" and "spawn a
      worktree"; the first is chosen routinely and its real price — a shared
      index, a shared stash stack, a pre-push gate reading foreign files — is not
      in the text.
      verify: the collision text names the shared index, the shared stash stack
      and the pre-push consequence.

## Phase 7 — rescue, then deletion

Twelve worktrees hold uncommitted paths and five branches are not ancestors of
the trunk. Some of it is noise; some is a day's work. Rescue runs **before**
deletion because the two sets overlap.

346 registered worktrees, 52 GB under `.claude/worktrees/` plus 1.8 GB under
`.worktrees/`, 929 local branches, 245 remote branches — against **zero** open
pull requests. The inventory classifies today's set as **174 safe · 92 review ·
80 live**, the largest review reason being 73 entries in non-standard locations.

The uncomfortable part: this phase's ancestor was archived as done. It was — its
criteria asked whether the approved set had been removed, and it had. The
approved set was **2**, because a 60-day floor excluded 275 of 304. The file says
so itself: *"it never asked whether the disk problem was solved, and it is not."*
It also ruled a creation-side brake out of scope. The count went 249 → 346 in
fifteen days.

- [ ] **7.1 Classify all 12 dirty worktrees into rescue / discard / already-landed.**
      The four needing a real look, by size and recency: `feat/schema-erd-diff`
      (5 commits off-trunk plus 6 modified paths, 2026-08-20),
      `feat/subagent-lifecycle-envelope-split` (9 paths including both halves of
      the hook manifest, 2026-08-20),
      `feat/inbox-harvest-b-council-integrity-followup` (7 paths including an ADR
      rename), `feat/prompt-deinflation` (3 commits off-trunk). The other eight
      are untracked `dist/`, `.augment/`, `.claude/` and `.codex/` paths.
      verify: each of the 12 has a recorded verdict with a reason.

- [ ] **7.2 Land or discard the rescue set, one change per worktree.**
      Four unrelated pieces of work; a combined change would be unreviewable.
      verify: none appears in a fresh dirty-worktree scan, and each has a merged
      change or a recorded disposal.

- [ ] **7.3 Explain the untracked tool directories in old worktrees.** They are
      untracked in worktrees whose branches predate a `.gitignore` change.
      Harmless alone — and they are what makes eight worktrees read as "unsaved
      work" in the very inventory that has to be trusted before a bulk deletion.
      verify: a fresh inventory reports unsaved work only where real content
      exists.

- [ ] **7.4 Dispose of the five stashes.** All from 2026-05-25 to 2026-06-10, all
      from unrelated branches, and the stash stack is repo-wide — so they are
      visible to every session. Each is inspected and either restored or dropped
      by name.
      verify: `git stash list` holds nothing older than current work.

- [ ] **7.5 Re-run the inventory and record the classification with its date.**
      The verdict must be stable across two consecutive runs; the tool had a
      self-poisoning bug there once and carries a regression test for it.
      verify: two consecutive runs produce identical counts, recorded.

**The council split on how to model this, and the split is the answer.** One
seat said the deletion should leave the roadmap so the roadmap gets an honest
completion boundary. Two said that repeats the predecessor's failure — it
completes while the disk stays full. What all three converged on:

- **Two completion states, named separately.** `cleanup ready` — the mechanism,
  the classification, the location policy and the brake all exist — and
  `storage target reached`. This roadmap may close on the first. It may not
  report the first as the second, which is precisely what its ancestor did.
- **A separately owned, scheduled operation** carries the second, with an owner
  and a measurable outcome.
- **A prepared plan expires.** A worktree that was clean last week is not
  permanently safe, so the plan is regenerated immediately before confirmation
  rather than approved once and executed later.

The Hard Floor is untouched by all of this: the deletion is a human-initiated
action confirmed in the same turn it runs. What the council removed is the
indefinite wait, not the confirmation.

- [ ] **7.6 Define the storage target and the brake, in numbers.** Without a
      target, "done" means "the procedure exists", which is how the predecessor
      passed its own criteria over an unsolved problem. Without a rate, a brake
      is a word: if worktrees arrive at 5–10 a day and cleanup runs monthly, the
      growth is linear rather than exponential and nothing is braked.
      verify: a target figure and a creation-versus-removal rate are both
      recorded, with the measurement that produced each.

- [ ] **7.6b Prepare the removal plan as an expiring artefact, and hand it over.**
      `--plan` prints the commands; running them is a Hard-Floor action and stays
      with the maintainer, confirmed in the turn it runs. The plan uses
      `git branch -d`, never `-D`, so git re-checks each merge at execution time.
      It carries its generation timestamp and a stated validity window, and is
      regenerated rather than reused past it.
      verify: the plan names every entry, carries a generation stamp and a
      validity window, and a plan past its window refuses to be executed.

- [ ] **7.7 Decide the 73 non-standard locations.** They are the single largest
      review reason. Either the conventional roots grow to admit them or they are
      migrated — "non-standard" as a permanent state means 73 entries can never
      be classified safe, and the inventory is worth less with each addition.
      verify: location no longer dominates the review set's primary disqualifier.

- [ ] **7.8 Bound the growth, or record that it stays unbounded and why.** The
      ancestor deliberately did not, on the grounds that a growth brake needs its
      own evidence that the convention is what fails. That evidence now exists
      and is fifteen days long: 249 → 346 while the cleaning tool was available
      and unused. A brake at creation time, a periodic surface of the count, or
      an explicit decision to live with it — any of the three closes this.
      verify: a mechanism exists, or a dated decision to accept unbounded growth
      is recorded with the 249 → 346 measurement beside it.

- [ ] **7.10 Close this phase on `cleanup ready`, and create the operation that
      carries `storage target reached`.** The second is scheduled, owned, and
      reports its own outcome; the two are never reported as one. Continued
      growth after the brake ships falsifies the brake's effectiveness — not the
      separation, which is the distinction the council asked to keep visible.
      verify: both states exist as separate statements, the scheduled operation
      names an owner, and neither is reported in the other's words.

- [ ] **7.9 Sweep the local and remote branch sets after 7.6b has run.** 929 local
      branches, 245 on origin, zero open PRs. A local branch whose worktree is
      gone and whose content is on the trunk is pure residue; a remote branch
      with no PR and a merged head is the same thing on the server.
      verify: no remote branch survives whose head is an ancestor of the trunk,
      and the local count is recorded before and after.

## Phase 8 — maintenance risk, process economy, and the homeless defects

- [ ] **8.1 `run_continuation_hook.ts` is 1 499 lines and took nine review rounds.**
      Rounds 1–7 produced 55 findings, six of seven highs arriving in rounds 6–7;
      round 8 eight more, round 9 seven. The fixes were right — `blocked` as a
      terminal outcome, state keyed on the roadmap rather than the reader,
      session-tree walk-up. The size and the findings density are the finding:
      this is a subsystem living in a hook file. Decide whether it is split or
      deliberately kept whole, and record which.
      verify: either the file is decomposed, or a dated note states why a
      1 499-line hook is the right shape and what would change that.

- [ ] **8.2 Make a findings re-bind derivable instead of hand-written.** 23
      commits in this window carry a re-bind subject, one per base merge, and the
      three-anchor manifest means a partial re-bind reds CI while the local check
      stays green. A re-bind that is a pure function of merge-base and scope
      should not be an authored artefact.
      verify: a base merge with no content change produces no hand-authored
      re-bind commit.

- [ ] **8.3 Put a number on the evidence-to-product ratio, then decide it.**
      Measured: `agents/evidence` +20 555 insertions against `src/scripts` +4 979
      since `14.5.0` — roughly 4:1. The R2 process demonstrably works: in this
      window alone it caught a flat taskfile parser, a wrong blocker walk-down, a
      prose-instead-of-blocker disposition, and an unreachable WARN path. This
      step does not attack it. It asks the ratio to be a decision rather than a
      by-product.
      verify: the ratio is recorded per window with a stated acceptable band, or
      a dated note says the ratio is not a quantity worth bounding.

- [ ] **8.4 `src/domains/meta/contribution-precheck/evals/triggers.json` is
      unreachable.** Every consumer — nine scripts, including the freshness,
      presence and rotation checks — globs `src/skills/*/evals/triggers.json`.
      This file sits under `src/domains/`, so no gate reads it: no freshness
      check, no structure check, no rotation. Its prose is already stale and
      nothing will report that.
      verify: the file is either read by `check_trigger_eval_presence` or gone.

- [ ] **8.5 `sync_pr_branch` classifies `src/scripts/hook_manifest.json` as
      AUTHORED.** It is compiled from `hook_manifest.yaml`. The `GENERATED` list
      holds five entries and this is not one, so the tool says "read both sides"
      on a file where mixing hunks yields a concern table matching neither
      branch. One session resolved this same conflict three times and named it
      structural: main adds a concern and recompiles in the old form, so every
      open branch collides.
      verify: `isGenerated('src/scripts/hook_manifest.json')` is true and the
      tool prints it under GENERATED.

- [ ] **8.6 The acceptance-criteria extractor in `lint_plan_risk_register` misses
      most of its own corpus, and it has two independent halves.** The pattern at
      `lint_plan_risk_register.ts:118` is anchored at both ends **and**
      case-sensitive. So a heading carrying any suffix is invisible to it, and so
      is one whose second word is lower-case. Measured on the active tree:
      **12 roadmaps write the capitalised form and 10 write the lower-case one**,
      i.e. the extractor sees under half of them — and this file was one of the
      ten until the heading below was corrected. Fixing only the suffix half, as
      an earlier draft of this step proposed, would have left ten roadmaps
      unmatched and this one among them.
      verify: a roadmap whose heading carries a suffix is linted on its real
      criteria, a roadmap whose heading is lower-case likewise, and the count of
      matched roadmaps equals the count of roadmaps carrying such a section.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-20 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A rescue verdict destroys the only copy of some work | implementation | Phase 7 discards uncommitted paths and removes worktrees; a wrong verdict has no undo, and a cherry-pick gives the same content a different SHA so ancestry alone proves nothing | Rescue steps run before removal steps within the phase; the safe predicate requires trunk ancestry AND a clean tree; the plan uses `git branch -d` so git re-checks at execution time | Phase 7 — rescue, then deletion |
| 2 | Narrowing the scanner blinds it to a real shape | implementation | Phase 2 changes what a security reader looks at; a shape the contract does not anticipate would be scanned less than today, and the failure is silent | The council verdict RETAINS the fallback for exactly this reason; fixtures land before the rewire (2.2 before 2.3), the negative must fail against today's scanner first, and 2.3b bounds the fallback so it cannot quietly become the permanent path | Phase 2 — the half of the payload defect that was left unfixed |
| 3 | A council verdict is read as authority it does not have | product | Three decisions were taken by the council on the maintainer's instruction; a reader could take that as precedent for the council deciding a Hard-Floor action, which no verdict can | Section 0.4 states each verdict with its falsifier, and 7.6b keeps the deletion a human-initiated, same-turn-confirmed action — the council removed the indefinite wait, not the confirmation | Phase 7 — rescue, then deletion |
| 4 | This roadmap becomes the second one archived over an unsolved problem | product | Its Phase-7 ancestor was archived as done while the count it existed to reduce grew 249 → 346; criteria that ask "was the approved set removed" pass while the problem persists | The acceptance criteria are phrased on residual state rather than on approval, and 7.8 forces either a brake or a dated decision to accept growth | Phase 7 — rescue, then deletion |
| 5 | Classifying 165 gates becomes a migration | implementation | Phase 5.2 reads as an invitation to move the local-only set into CI; doing that would red the trunk on the landing day and teach the next reader to ignore the result | The step says classify and forbids migrating; 5.3 asks for a signal, not a blocking gate, so the cheap half can land without the expensive one | Phase 5 — the gates nobody sees run |
| 6 | Phase 4 reads as an attack on the notes rather than on the ratchets | product | The budget notes are unusually honest, and a step that looks like criticism of them invites a defensive rewrite instead of a stop condition | Every Phase-4 step asks for a missing artefact — a roadmap, a ceiling, a re-measurement, a stop condition — and none asks for a note to be reworded | Phase 4 — budgets that document deterioration instead of preventing it |
| 7 | Phase 3 or 8 duplicates work an active roadmap already owns | implementation | Three roadmaps hold parts of the delivery surface and one holds the injection blocker; restating a finding here would split its evidence across files | 3.1 and 2.4 route rather than implement and record which roadmap took the item; the remaining items were checked against the active set and have no owner | Phase 3 — double delivery: measured, gated, and still happening |
| 8 | Sweeping a worktree a live session is using | implementation | A concurrent agent loses state mid-task; liveness is a heuristic, not a lock | The inventory excludes live worktrees by git-dir mtime within 48 h, the safe set is a proposal for review rather than an action, and the session register names live sessions independently | Phase 7 — rescue, then deletion |

## Acceptance Criteria

- [ ] AC-1 — No released section of the CHANGELOG carries a template
      placeholder, and a release head carrying one cannot be merged or published.
- [ ] AC-2 — The burned version is recorded machine-readably and a release run
      attempting to reuse it refuses.
- [ ] AC-3 — Every release branch remaining on origin has either a tag or a
      recorded unique-commit finding, quoted per branch.
- [ ] AC-4 — The detection window for release drift is a recorded decision with
      its reason, and a release head carrying a template placeholder can neither
      be merged nor published — the latter proven on a fixture built from the
      real uncurated head.
- [ ] AC-5 — The injection scanner reads through a written contract with
      `payloadOf` primary and a sanitised, bounded fallback; its fixture set
      includes a negative that failed against the pre-change scanner; and the
      security blocker is resolved where it lives.
- [ ] AC-6 — The two-layer duplication is filed against exactly one roadmap with
      its layer counts and its machine-dependence stated, the two instruments
      that size it agree on a population, and the partition blocker is either
      decidable or converted to a recorded deferral.
- [ ] AC-7 — Each of the three moving budgets carries a stop condition or a
      dated statement that raises are unconditional, the promised structure
      roadmap exists, and no budget history entry quotes a pre-merge figure.
- [ ] AC-8 — No gate is red on the trunk without something reporting it, and
      every gate no workflow runs carries a recorded class.
- [ ] AC-9 — `task consistency` passes on a tree clean in the paths it
      regenerates and dirty elsewhere, and still fails on real derived drift.
- [ ] AC-10 — Every worktree holding uncommitted content on 2026-08-20 has a
      recorded verdict, and every rescued piece has landed or been disposed of
      in writing.
- [ ] AC-11 — `cleanup ready` and `storage target reached` exist as separate
      statements; a storage target and a creation-versus-removal rate are both
      recorded with their measurements; and neither state is reported in the
      other's words.
- [ ] AC-12 — Each Phase-8 item is fixed, routed to a named roadmap, or closed
      with a reason.
