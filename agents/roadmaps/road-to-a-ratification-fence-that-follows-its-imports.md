---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "The kernel-edit ratification gate watches a hand-written list of plumbing paths, and the module that decides whether a crashed blocking concern refuses now sits outside it; no live roadmap owns the watched set. Archiving or parking another roadmap would free a slot without closing the gap, and merging into road-to-self-modification-that-a-council-must-pass was considered and rejected: it changes who may ratify and how, not which files need a record, and folding a path-set change into it would make one diff both widen the fence and redefine the gatekeeper."
estate_growth_exempt: "Grows active_roadmaps by one: the owner asked on 2026-10-06 for this round's roadmaps to land as ready in one change; the watched path set has no other owner."
relates:
  - slug: road-to-self-modification-that-a-council-must-pass
    relation: disjoint
    note: "Edits the same gate. That file owns who ratifies and how; this file only widens the set of paths that need a record, and edits none of its steps."
  - slug: road-to-a-kernel-that-guards-its-plumbing
    relation: extends
    note: "Receiver of the archived AC-3's spawn-path half, carried 'as the narrowing it is'. Step 4.1 is the measurement; step 4.2 is the archive's pointer back here."
---
# Road to a ratification fence that follows its imports

> **Source:** an external review round (opaque id inbox-2026-10-e), round
> `agents/tmp.old/inbox-2026-10-e/`. Every anchor below was re-read at `main` @
> `a75bb3210` on 2026-10-06; line numbers are as of that commit.

## Goal

A diff that changes how the hook dispatcher turns a crash, a timeout or a
stdin failure into an exit code needs a ratification record, whichever file
the logic currently lives in. The watched set is derived from what the
dispatcher imports, not from a list someone has to remember to extend. A
raised hook-bundle ceiling carries the reason the budget file already asks
for. The half of an archived criterion that was carried "as the narrowing"
gets a step that can close it.

## Context

- The gate's watched set is one regex:
  `src/scripts/check_kernel_edit_ratified.ts:187-188` (`PLUMBING_SOURCE_RE`)
  names `hook_manifest.(yaml|json)`, `host_lowering.(yaml|json)`,
  `hooks/dispatch_hook.ts`, `_lib/kernel_rules.ts`, `hooks/*-dispatcher.sh`
  and `config/hook-(token|latency)-budget.json`. Nothing else under `hooks/`.
- `dispatch_hook.ts` imports its failure semantics from siblings the regex
  does not name (`src/scripts/hooks/dispatch_hook.ts:60-75`):
  `stdin_failure_policy.ts`, `concern_failure_policy.ts`, `py_json_dumps.ts`,
  `fallback_yaml.ts`, `exit_codes.ts`. The verdict-bearing one is
  `_resolve_execution_failure`, which returns `EXIT_BLOCK` for a crashed
  blocking concern (`src/scripts/hooks/concern_failure_policy.ts:118-125`).
  Moving that function out of `dispatch_hook.ts` moved it out of the fence.
- The release review of 16.3.0 recorded this as finding `21900086c1a0`
  (medium, security) in `agents/evidence/release-findings/16.3.0.json`: the
  step 3.3 ratification itself noted the gap and left it, "because widening
  the pattern is itself a gated edit". It carries no disposition.
- The write guard is outputs-only by design: its header assigns plumbing
  sources to the record mechanism and build outputs to a deny
  (`src/scripts/hooks/block_plumbing_writes.ts:8-12`), and its deny list is
  four compiled artefacts (`:102-107`). Its header's list of sources mirrors
  the regex, so it describes the same narrower set.
- `src/config/hook-bundle-budget.json` is not in the watched set. Its ceiling
  was raised from 1,500,000 to 1,550,000 on its own registration day
  (`raise_log`, `registered_at: 2026-10-01`), and its note says a raise needs
  a `raise_log` entry but "the gate prints the rule but cannot enforce it"
  (`:10`); `check_hook_bundle_composition.ts:188` prints that rule.
- AC-3 of the archived plumbing roadmap is ticked although its own text says
  the "or exceeds `sla_ms × 3`" half "is NOT met" and needs a spawn-path
  measurement "this tree does not have", carried "as the narrowing it is"
  (`agents/roadmaps/archive/road-to-a-kernel-that-guards-its-plumbing.md:725-739`).
  A grep of `agents/roadmaps/` for that measurement finds only the archive
  itself: no receiver exists.
- The gate watches itself (`SELF_PATH`, `check_kernel_edit_ratified.ts:90`), so
  the change this roadmap makes to it needs a ratification record of its own.

## Phase 1 — The import closure, read

- [x] **1.1 Enumerate and classify.** A `report_` script walks the static
      import closure of `src/scripts/hooks/dispatch_hook.ts` (relative imports
      only, transitively) and prints each module with one class: decides an
      exit code or a verdict; shapes the payload a concern sees; neither. The
      reading at `a75bb3210` is written to
      `agents/evidence/analysis/dispatch-import-closure-2026-10.md` with its
      `evidence-type` marker and the command.
      verify: `npx vitest run tests/scripts/report_dispatch_import_closure.test.ts` -> 0

## Phase 2 — The gate watches what decides the verdict

- [x] **2.1 A red-first polarity test.** A fixture diff that touches only
      `src/scripts/hooks/concern_failure_policy.ts` and carries no record
      fails the gate; the same diff with a valid record passes; a diff that
      touches only an unrelated `hooks/` concern passes without one. The
      first case is shown red against the current regex before 2.2 lands.
      verify: `npx vitest run tests/scripts/check_kernel_edit_ratified_import_closure.test.ts` -> 0
- [x] **2.2 The set is derived, not listed.** The gate unions the existing
      regex with the verdict-deciding class from 1.1's closure, computed at
      run time from the import graph, plus
      `src/config/hook-bundle-budget.json`. A module newly imported by
      `dispatch_hook.ts` that returns an exit code joins the set without an
      edit to the gate.
      verify: `npx vitest run tests/scripts/check_kernel_edit_ratified.test.ts` -> 0
- [x] **2.3 The edit to the gate is ratified.** The diff that lands 2.2 carries
      a record under `agents/evidence/ratifications/` with `verdict: ratified`,
      named providers and the prompt, because the gate watches its own file.
      verify: `ls agents/evidence/ratifications/ | grep -c 'ratification-fence-imports'` -> /^[1-9]/

## Phase 3 — The write guard and the bundle ceiling

- [x] **3.1 The write guard states the derived set or the asymmetry.**
      `block_plumbing_writes.ts` stays outputs-only; its header's list of
      record-carrying sources is replaced by a pointer to the gate's derived
      set, so the two descriptions cannot drift apart again.
      verify: `grep -c 'import closure' src/scripts/hooks/block_plumbing_writes.ts` -> /^[1-9]/
- [x] **3.2 A raised ceiling needs a new log entry.**
      `check_hook_bundle_composition` reads `max_bytes` at the base ref; when
      the working value is higher, it fails unless `raise_log` gained an entry
      whose `to` equals the new value. Fixtures: raise with entry passes, raise
      without fails, lowering without entry passes.
      verify: `npx vitest run tests/scripts/hook_bundle_raise_log.test.ts` -> 0

## Phase 4 — What the archive left open

- [x] **4.1 A receiver for the spawn-path measurement.** A bench measures the
      wall time of one blocking `pre_tool_use` concern through the real
      `spawnSync` path (interpreter start included), p50 and p95, on the
      runner, and writes it to
      `agents/evidence/analysis/concern-spawn-path-2026-10.md`. Whether a
      timeout of `sla_ms × 3` is then tenable is stated as a reading, not
      wired.
      verify: `grep -c 'p95' agents/evidence/analysis/concern-spawn-path-2026-10.md` -> /^[1-9]/
      Done 2026-10-07: measured on a darwin laptop, not the GitHub runner;
      the page records the machine and says the runner reads slower. Warm
      p95 ~90-100 ms against an `sla_ms × 3` of 2.8 ms, so the reading is
      that the timeout is not tenable on the spawn path.
- [x] **4.2 The archive points at its receiver.** One dated line under AC-3 of
      the archived plumbing roadmap names step 4.1 of this file. No other line
      of that file changes.
      verify: `grep -c 'ratification-fence-that-follows-its-imports' agents/roadmaps/archive/road-to-a-kernel-that-guards-its-plumbing.md` -> /^[1-9]/
- [ ] **4.3 The finding gets its disposition.** <!-- blocked-by: finding-disposition-write-refused-for-the-agent | asked: no — a background drain lane has no owner channel; recorded for the next owner-facing turn --> `21900086c1a0` is recorded as
      `fixed` with the commit that lands 2.2.
      verify: `node -e 'const j=require("./agents/evidence/release-findings/16.3.0.json");const f=j.findings.find(x=>x.finding_id==="21900086c1a0");process.exit(f.status==="fixed"&&f.commit?0:1)'` -> 0

## What this roadmap deliberately does not do

- No change to who may ratify, how many providers are required, or what a
  record must contain; that is the sibling roadmap's.
- No deny on plumbing sources. Sources keep a record; outputs keep a deny.
- No timeout wired from `sla_ms`. 4.1 measures; wiring is a later decision.
- No widening to every file under `hooks/`; concerns stay outside the fence.

## Acceptance Criteria

- [x] AC-1 — A diff touching only `concern_failure_policy.ts` without a record
      fails the gate, and the test shows it red before the fix.
- [x] AC-2 — The watched set is computed from the dispatcher's import graph;
      a new verdict-deciding import joins it with no edit to the gate.
- [x] AC-3 — A raised `max_bytes` without a matching `raise_log` entry fails.
- [x] AC-4 — The spawn-path half of the archived AC-3 has a measurement page
      and the archive names it.
- [ ] AC-5 — Finding `21900086c1a0` carries a terminal disposition.

## Blockers

### blocker: finding-disposition-write-refused-for-the-agent
- **Status:** open — raised 2026-10-07 by the drain run that closed steps 1.1-4.2
- **Owner:** owner
- **Blocks:** 4.3, AC-5
- **What to do:** write the disposition into
  `agents/evidence/release-findings/16.3.0.json` for `21900086c1a0` —
  `status: fixed`, `commit` naming the commit that lands 2.2 on `main`, a
  `rationale` and `verified_by` — or authorise the agent to write it. The
  host's permission classifier refused the agent's write of that disposition
  in this run, and the run did not route around the refusal. Material for
  the entry: the fence change and its follow-up fix, the ratification record
  `agents/evidence/ratifications/drain-ratification-fence-imports-20261007.md`,
  and the polarity tests in
  `tests/scripts/check_kernel_edit_ratified_import_closure.test.ts`, each
  shown red with its mechanism neutralised.
- **Resolved when:** the finding carries `status: fixed` with a `commit`, and
  the step 4.3 verify exits 0.
- **Recommendation:** write it after this roadmap's PR merges, naming the
  merge commit on `main` rather than a branch commit, so the `commit` field
  points at an object every clone has. The residual the ratification record
  states (a module already in the closure that gains verdict logic under a
  neutral name) belongs in the `rationale`, not in a lower status.
- **If you do nothing:** the finding stays without a disposition, so the
  16.3.0 ledger keeps one undisposed medium security row although the gap it
  describes is closed in the tree.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | Derive the set from the import closure rather than extend the regex by hand | The regex stayed correct until one function moved files; a hand list fails the same way next time | The closure reading pulls in a module whose edits are routine and the record count becomes noise |
| D2 | reversible-technical | agent | The write guard stays outputs-only and points at the derived set | Its header records the split as the design (`block_plumbing_writes.ts:8-12`) | A source file is found with no legitimate hand edit |
| D3 | deterministic | evidence | The bundle budget joins the watched set and its raise rule is enforced against the base ref | Raised on its registration day; the note says the rule is unenforced | — |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-06 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The derived set is too wide | implementation | A payload helper reached through the closure turns routine edits into record-carrying ones. | 1.1 classifies before 2.2 includes; only the verdict-deciding class joins. | Phase 1 — The import closure, read |
| 2 | Both roadmaps edit the same gate | implementation | The sibling roadmap may change the same file in a parallel branch. | 2.2 touches the path set only; the later branch rebases onto the earlier. | Phase 2 — The gate watches what decides the verdict |
| 3 | The spawn reading is runner-dependent | product | One machine's p95 reads as a general figure. | 4.1 records the runner and states the reading licenses no wiring. | Phase 4 — What the archive left open |
| 4 | A ceiling is raised and lowered in one diff | implementation | Comparing only against the base ref misses intra-branch history. | The rule is about the merged value against the base; that is what ships. | Phase 3 — The write guard and the bundle ceiling |
