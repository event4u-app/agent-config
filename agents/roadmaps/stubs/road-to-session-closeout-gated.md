---
complexity: lightweight
review_by: 2026-09-19
probe: none
---

# Session-closeout residue that needs something this repository cannot supply

> **Transferred from** [`road-to-session-closeout.md`](../archive/road-to-session-closeout.md),
> 2026-08-20, by the autonomous drain run that closed it. **Outcome state:**
> `transferred`. The parent roadmap closed against explicit outcome states, so
> its completion can never be read as an achieved goal.
>
> Every criterion below is carried **verbatim** from the parent, with the
> complete set of dependent steps, a **named** producer, and a detection probe
> **measured on 2026-08-20 on this tree**. Promotion is **per item**, on that
> item's probe returning true — never per file, and never by the shared
> promotion criteria in [`README.md`](README.md) § Promotion criteria, which
> govern demand-gated stubs only.
>
> Two of these items are **Hard-Floor actions in their own right** (a remote
> branch deletion, a bulk worktree removal). Being listed here exempts them from
> the org-mode promotion gates; it does **not** exempt the act. When a human
> performs one it needs its own this-turn approval naming the exact object, per
> [`non-destructive-by-default`](../../../src/rules/non-destructive-by-default.md).

## A · Release integrity — four decisions and one missing record

**Producer:** the owner named in [`docs/release-runbook.md`](../../../docs/release-runbook.md)
and on `src/config/pack-size-budget.json` (`owner: maintainer`). Not the drain
run: each item below is a policy pick or a human recollection, and an agent
recording either as landed work would be fabricating it.

**Verbatim criteria** (parent steps 1.2, 1.4, 1.4b, 1.5; acceptance criteria
AC-1 second half, AC-2, AC-4):

- **1.2** *"Record `14.3.0` as burned, machine-readably, and make the tooling
  refuse to reuse it. A prose note is what the last ten hours showed to be
  insufficient. The registry entry is what a release run can read.
  verify: a release run attempting `14.3.0` refuses, citing the record."*
- **1.4** *"Decide the detection window for release drift — the gate already
  exists. […] Three options, and this step picks one with its reason: accept the
  window as correct for a drift that only a release run can cause; add a
  merge-time check on the release-PR path, which needs the phantom-run problem
  solved rather than re-encountered; or shorten the cron."*
- **1.4b** *"A placeholder guard […] A release head carrying `rewrite before
  merge` must not merge and must not publish."*
- **1.5** *"Ask why manual review failed twice, and answer it in the checklist."*

**What the drain run established, and it changes 1.4b's premise.** The parent
called 1.4b *"the half that genuinely has no gate"*. That is false.
`check_release_highlights.ts` exists, and on the uncurated head it emitted:

```
⚠️  auto-derived head line(s) not yet rewritten for 14.6.0: Behaviour changes,
    Security and correctness, Honest nulls — advisory, not blocking.
```

It sees the exact markers. It is **advisory by design**, and its docstring gives
the reason (a machine-written placeholder must not red every first run). So 1.4b
is not construction — it is a decision to promote a documented warning to a
block on the release path, which is the same decision class as 1.4.

A second, smaller correction the next reader needs: with no `--from`/`--to`, the
gate spans `<version>..HEAD`, so auditing a *published* section with
`--version 14.6.0` alone compares it against **post-release** commits. That is
where its `_none_` contradiction on `Default changes + migration` came from —
the commit it named, `319d339`, is not in `14.5.0..14.6.0` at all. On the correct
spans both published heads now pass.

**Probes, measured 2026-08-20:**

| Item | Probe | Baseline today |
|---|---|---|
| 1.2 | a machine-readable burned-version record exists and release tooling reads it | `grep -rl burned src/config/` → **0 files**. No record surface exists at all |
| 1.4 | `.github/workflows/release-drift.yml` gains a merge-time trigger, or its cron shortens | triggers are exactly `schedule: cron "23 7 * * *"` + `workflow_dispatch` — **no push/merge trigger**, i.e. the 24h window the workflow header itself names |
| 1.4b | a release head carrying a marker fails a gate rather than warning | `check_release_highlights` emits the advisory quoted above and **exits 0** on it |
| 1.5 | the release checklist carries a discrete "verify no placeholders" step and an escalation path | `grep -icE "placeholder\|rewrite before merge" docs/release-runbook.md` → **0**. The discrete step does not exist |

**Not transferred — already done.** Parent step 1.1 is satisfied: all seven
markers are gone from the two published sections and both heads pass
`check_release_highlights` on their correct spans.

## B · The injection scanner — a consent-once blocker owned by the user

**Producer:** the owner of blocker `b-injection-scan-unwrap-security` in
[`road-to-per-turn-hook-economy.md`](../road-to-per-turn-hook-economy.md), which
records `**Owner:** user` and `**Class:** 2 — consent-once`, status `open`. The
drain run may not spend that consent on the user's behalf, and this is a
security surface: `security-sensitive-stop` puts the threat pass before the
first edit, not after it.

**Verbatim criteria** (parent steps 2.1, 2.2, 2.3, 2.3b, 2.4; AC-5). The council
verdict that shapes them — `payloadOf` primary, the whole-envelope fallback
**retained** because for a scanner a missed injection is the worse error, and
made sanitised, tested, rate-limited and time-limited — is recorded in the
parent's § 0.4 with its falsifier and is **not** re-decided here.

- **2.1** *"Write the contract the deferral asked for, to the council's shape."*
- **2.2** *"Build the fixtures. […] plus a negative that must not scan clean."*
- **2.3** *"Rewire the reader: `payloadOf` primary, fallback only on genuine
  extraction failure."* — with the trap the council named explicitly: *"An empty
  payload is not an extraction failure."*
- **2.3b** *"Make the fallback observable and bounded."* Ten uses in thirty days
  is the council's threshold for treating a shape as one needing canonical
  support.
- **2.4** *"Close `b-injection-scan-unwrap-security` where it lives."*

**Probe, measured 2026-08-20:** `grep -c payloadOf src/scripts/injection_scan_hook.ts`
→ **0**, against **2** in the fixed sibling `src/scripts/hooks/ship_diff_volume_hook.ts`.
The defect is exactly as the parent describes and is still there: the only reader
of the pair marked security-relevant is the one working by accident, and nothing
tests the accident. **Promotes when** that count is non-zero *and* a fixture set
exists carrying a negative that failed against the pre-change scanner.

## C · Budgets — three policy statements and one field whose meaning is undecided

**Producer:** `owner: maintainer`, stated in the budget files themselves
(`src/config/pack-size-budget.json`, `src/config/rule-activation-census.json`).

**Verbatim criteria** (parent steps 4.1, 4.2, 4.4, and the repair half of 4.3;
AC-7):

- **4.1** *"Write the structure roadmap the pack note promised. […] verify: the
  roadmap exists and each of the three questions has an owner."* Transferred
  because that verify requires an **owner per question**, and naming an owner
  who has not agreed is fabricating one.
- **4.2** *"Close the `always`-vs-`auto` pricing gap."*
- **4.4** *"Give the three ratchets a stop condition, or record that they have
  none."*
- **4.3, repair half only.** The drain run **did** the measurement half and it is
  reported below; what it did not do is change the number, for a reason that is
  the transfer: nobody can tell from the file whether `unconditional_tokens` is a
  **cap** or a **record**. If it is a record, correcting it is routine. If it is
  a cap, writing a higher number is raising a baseline to admit a violation,
  which is forbidden. The owner decides which field it is.

**Probes, measured 2026-08-20:**

| Item | Probe | Baseline today |
|---|---|---|
| 4.1 | a structure roadmap exists and each of the three questions has a named owner | pack cap `packed_size_mb.max` = **8.4**, `last_measured` **7.805** — the third consecutive raise; no structure roadmap exists |
| 4.2 | a rule exceeding the `always` cap cannot land under `auto` without an equivalent ceiling, or a dated decision records the asymmetry | unchanged; the asymmetry is still the recorded reason a rule shipped `auto` |
| 4.3 | `measured_at_commit` names a real commit and the figure matches a measurement of that tree | file records `unconditional_tokens` **111 012** with `measured_at_commit: "unrecorded"`; `check_rule_activation_census` measures **111 035** on this tree — a 23-token gap, and no commit the figure can be checked against. The parent quoted 108 130, so the value has also moved **up** twice since it was written |
| 4.4 | each of the three budgets carries a stop condition or a dated unconditional-raise statement | none carries either |

## D · Gate visibility — the classification and the schedule

**Producer:** maintainer. Both items are decisions about the CI surface, and the
parent forbids the shortcut for one of them in the step text itself.

**Verbatim criteria** (parent steps 5.2 classification half, 5.3; the second red
of 5.1; AC-8):

- **5.2** *"Classify the 165 unreached gates. Do not migrate them. […] verify:
  every gate in the local-only set carries a recorded class, and the ratchet's
  baseline is walked to the measured number."* The **baseline half is done** —
  walked 166 → 165 on the measured tree. The classification half is 165
  independent per-gate judgements and is transferred.
- **5.3** *"Make a trunk red discoverable without a person running the chain."*
- **5.1, second red only.** `check_standing_rule_delivery` still exits 1. Its
  cause on any given machine is two installed layers, which is § C's and Phase
  3's subject, not a red a person can clear in this file.

**Probes, measured 2026-08-20:**

| Item | Probe | Baseline today |
|---|---|---|
| 5.2 | every local-only gate carries a recorded class | `check_ci_local_parity`: **165 violation(s) at baseline** (baseline now 165, age 7d); separately **64** CI-enforced gates that `task preflight` does not reach |
| 5.3 | a red in the local-only set produces a signal with nobody invoking the chain | no workflow runs the local-only set |
| 5.1 | `check_standing_rule_delivery` exits 0 | exits **1**. Read **115 781 tok** with one layer installed and **209 767 tok** with two, on the same tree in the same session — the gate measures the machine, not the repository |

**Closed by events, not transferred.** 5.1's *first* red is gone:
`lint_roadmap_complexity` exits **0** over 35 roadmaps, because
`road-to-hook-state-followups.md:2` now reads `complexity: lightweight`. The
concurrent session that owned that file fixed it.

## E · The estate — owned by an active roadmap, and every figure was stale

**Producer:** [`road-to-estate-drawdown.md`](../road-to-estate-drawdown.md), an
**active** roadmap with open steps, which carried an open pull request during
this drain run. This is a named producer that already exists, so no new one is
invented here.

**Verbatim criteria:** parent Phase 7 in full — steps 7.1, 7.2, 7.3, 7.4, 7.5,
7.6, 7.6b, 7.7, 7.8, 7.9, 7.10 — plus AC-10 and AC-11. The council's shape is
carried with them and is **not** re-decided: two completion states named
separately (`cleanup ready` and `storage target reached`), a separately owned
scheduled operation for the second, and a prepared plan that **expires** and is
regenerated immediately before confirmation rather than approved once and
executed later. `git branch -d`, never `-D`, so git re-checks each merge at
execution time.

**Three independent reasons, any one sufficient.** The acts are Hard-Floor
destructive on a machine carrying live peer sessions; the work has a present
owner; and every figure the parent reasoned from has moved.

**Probes, measured 2026-08-20 — beside the parent's own numbers:**

| Quantity | Parent | Measured today |
|---|---|---|
| registered worktrees | 346 | **384** |
| local branches | 929 | **973** |
| remote branches | 245 | **267** |
| open pull requests | 0 | **18** |
| stashes | 5 | **5**, oldest preserved 2026-05-27 (branch name elided — it carried an external source name) |

The open-PR count is the one that matters most for safety: the parent's Phase 7
reasoned about "929 local branches against **zero** open PRs", and a branch with
an open PR is not residue. Any plan built on the parent's figures must be
regenerated before it is executed — which is exactly what the council's
expiring-plan clause requires.

**Promotes when** `road-to-estate-drawdown` reaches its own `cleanup ready`
state, or its owner asks for these items back.

## F · Two maintenance decisions, and one finding whose population was wrong

**Producer:** maintainer for F1 and F2. F3 is a routing decision with a
five-member population and no owner today.

- **F1 — 8.1**, verbatim: *"`run_continuation_hook.ts` is 1 499 lines and took
  nine review rounds. […] Decide whether it is split or deliberately kept whole,
  and record which."* Probe: **1 502** lines today. Transferred because
  split-or-keep is a design decision, and either answer is a large change to a
  file that runs in every session.
- **F2 — 8.2**, verbatim: *"Make a findings re-bind derivable instead of
  hand-written. […] verify: a base merge with no content change produces no
  hand-authored re-bind commit."* Probe: **23** commits with a re-bind subject in
  `14.5.0..origin/main`, matching the parent's count exactly. Transferred: this
  is a redesign of the R2 machinery, owned by the roadmap that ships it.
- **F3 — 8.4**, verbatim: *"`src/domains/meta/contribution-precheck/evals/triggers.json`
  is unreachable. […] verify: the file is either read by
  `check_trigger_eval_presence` or gone."*

  **The parent's finding is a sample of one and the defect recurs.** Measured
  2026-08-20, `find src/domains -path "*/evals/*" -name "*.json"` returns **5**
  files, not 1:

  ```
  src/domains/analysis-workbench/analyze/inbox/evals/triggers.json
  src/domains/meta/contribution-precheck/evals/triggers.json
  src/domains/meta/optimize/deep/evals/triggers.json
  src/domains/meta/optimize/project/evals/triggers.json
  src/domains/product-basic/roadmap/next/evals/triggers.json
  ```

  Every consumer globs `src/skills/*/evals/triggers.json`, so all five are
  unreachable, not one. Deleting the single named file would be a fix of one
  instance rather than of the defect.

  And the widening option the verify offers is the **wrong** one:
  `check_trigger_eval_presence`'s contract is *"Every skill under `src/skills/`"*,
  while `contribution-precheck` is a **command** (`command.md`, no paired skill —
  `src/skills/contribution-precheck` does not exist) whose eval file
  self-declares `"skill": "contribution-precheck"`, a name nothing in the tree
  carries. Teaching a skill-presence gate to read a command's evals would make
  its own contract false.

  So the real choice is: delete five authored eval sets, or build command-eval
  coverage. Probe: the count above reaching 0, or a gate reading these paths.

## What was NOT transferred, and why

**Satisfied in the parent, with landed commits:** 1.1 · 1.3 (its verify asks for
a recorded per-branch finding, not a deletion) · 3.3 · 5.2's baseline half ·
6.1 · 6.3 · 8.5 · 4.3's measurement half.

**Closed by events, four of them:** 5.1's complexity red · 3.2's blocker, which
reads `**Status:** resolved` with its roadmap archived and the partition shipped
under ADR-236 Phase 2 · 8.6, fixed on `main` during this run by a peer session
that extracted the matcher into `src/scripts/_lib/ac_heading.ts` — a better fix
than the one this run had planned, and the population it now sees is 16 of 16 ·
and the `14.6.0` release line itself, which completed while the parent was being
written.

**Abandoned rather than transferred, two:** parent 8.3, whose own escape hatch
(*"a dated note says the ratio is not a quantity worth bounding"*) is the honest
answer and for which no producer is committed to owning a band; and Phase 7's
`storage target reached` state, which 7.10 already defines as separately owned
and scheduled — creating a stub for a state another roadmap owns would file the
same work twice.

**Deliberately left with its owner:** parent 6.2, the commit-flow pathspec
change. It rewrites the flows every concurrent session on this machine is using
right now, and 6.1 already removed the specific false failure that made the
shared checkout hurt.
