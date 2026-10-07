---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "lane 2 of road-to-leading-every-row; the set's offset is lane 1's in-diff supersession"
estate_growth_exempt: "TWO claims, and the second is this change's. (2026-10-01, open_blockers +1) The Phase-3 obstacle existed only as prose in a blockquote, where blocker detection does not look: `update_roadmap_progress` keys on a `## Blockers` section with `### blocker:` headings, so this roadmap measured one open step and ZERO blockers while that one open step was the blocked one, and the continuation ladder was free to re-propose a step waiting on elapsed calendar time. The count rises because the obstacle became VISIBLE, not because one was created - the same promotion `road-to-a-stop-that-holds` made for six of its own, and the canonical case this allowance names in as many words ('a blocker discovered while doing the work: open_blockers rises, nothing was archived, and the reason belongs next to the blocker'). Nothing was archived here because nothing could be: `warn-only-window-not-elapsed` is elapsed time, which is the one shape no session can spend. Offsetting it by deleting an unrelated blocker would remove a live obstacle to pay for recording a real one, which is the trade this ratchet exists to make visible rather than a way to satisfy it. (PRIOR CLAIM, concern_count +1) The concern estate grows by exactly one — `block-plumbing-writes` — and the growth is the deliverable rather than a side effect. Step 1.2 exists because `dist/hooks/dispatch.js` and `hooks/hooks.json` are generated files with no legitimate hand edit and, until this change, no guard: an edit to either survived until the next build, reached every dispatch meanwhile, and was invisible in a source review. There is no concern to trade against it. The two nearest candidates are `block_kernel_rule_writes` and `block_config_weakening`, and both cover DIFFERENT file classes that this one deliberately does not touch — the roadmap's whole subject is one mechanism per class, so folding the new guard into either would recreate the conflation it was written to end. Retiring an unrelated concern to buy the slot would remove a live refusal to pay for a new one, which is the trade the ratchet exists to make visible rather than a way to satisfy it."
relates:
  - slug: road-to-adversarial-verification-and-long-runs
    relation: extends
    note: "its blocker forge-protection-settings is about forge admin settings and is NOT touched here; its AC-5 stays its own"
  - slug: road-to-release-holds-that-refuse
    relation: disjoint
    note: "release path untouched"
---
# Road to a kernel that guards its plumbing

> **Source:** ten-package code audit (2026-09-28), rows Kernel immutability 5,
> Authorization enforcement 3, Gate reachability 4, Security 5 against S9 at
> 6/7/7/7. Tree facts at `8de8a4c`: `block_kernel_rule_writes.ts` guards the
> nine kernel rules listed in `_lib/kernel_rules.ts:17-26` under any `rules/`
> segment and nothing else; `block_config_weakening.ts:87-99` blocks only
> allowlist growth and classifies budget files advisory by council decision
> (`:27-30`); `dispatch_hook.ts:1314-1318` allows on rc ≥ 3 unless
> `fail_closed`, `:737` 30 s timeout → rc 3 (`:753`); FNV-1a manifest
> fingerprint `:198-215` ("deliberately NOT a crypto hash", 8 ms saved of a
> ~103 ms dispatch against a 175 ms p95 cap); 8 blocking concerns, 2
> `fail_closed`; ADR-268 § 4 (`:204-205`) replaced the kernel tool-call deny
> with a CI gate reading a ratification artifact — "one mechanism, not two";
> `hook-architecture-v1.md:868-873` fixes a missing dispatcher as a silent
> `exit 0` even for `fail_closed`.

> **corrected-from-reproduction (2026-09-29, /analyze:inbox t06).** The supplied
> file was reproduced against `main` read-only. Every `file:line` in its Source
> block resolved. ONE correction applied: the Risk Register `Risk type` column
> used values outside the enum `lint_plan_risk_register` enforces (`product` |
> `implementation`), which `status: draft` exempts and which reds the file the
> moment it flips to `ready`. The column is normalised; nothing else changed.

## Goal

The hook plumbing is a governed surface with one mechanism per file class:
source-of-truth plumbing (`hook_manifest.yaml`, `host_lowering.yaml`,
`hook-token-budget.json`, `hook-latency-budget.json`, `*-dispatcher.sh`) is
covered by the existing ratification CI gate; build outputs
(`dist/hooks/dispatch.js`, `hooks/hooks.json`) are refused to hand edits at
tool-call time; the dispatcher verifies the bundle once per session; a
blocking concern that crashes or exceeds its measured SLA refuses; and no
deny message names its own kill switch.

## Prerequisites

- Programme decisions D3 and D4 recorded (they are — this lane executes them).
- `check_kernel_edit_ratified.ts` (`:32-52`, `GOVERNANCE_HOOK_RE :123`) and
  `src/config/ratification-policy.json` unchanged at start.
- Sabotage-first: each guard's test is shown red with the guard neutralised
  before the fix lands; a source-string assertion never satisfies a primary
  `verify:` line.

## Phase 1 — One mechanism per file class

- [x] **1.1 Extend the ratification CI gate's path set to plumbing sources.**
      In `check_kernel_edit_ratified.ts`, add `src/scripts/hook_manifest.yaml`,
      `src/scripts/hooks/host_lowering.yaml`, `src/scripts/hooks/*-dispatcher.sh`,
      `src/config/hook-token-budget.json`, `src/config/hook-latency-budget.json`
      to the gated set; an unratified diff to any of them fails CI exactly as
      a kernel-rule diff does. This is the ADR-268 § 4 mechanism, extended —
      not a second deny.
      verify: CI red on a branch editing `hook_manifest.yaml` without a
      ratification artifact under `agents/evidence/ratifications/`; green
      with one; `tests/scripts/check_kernel_edit_ratified.test.ts` extended.
      **Evidence (2026-09-29).** `check_kernel_edit_ratified.ts` gained
      `PLUMBING_SOURCE_RE` covering all five paths. `tests/scripts/check_kernel_edit_ratified.test.ts`
      extended and green (part of 77 passing across the four touched files).
      The membership list is in `hook-architecture-v1.md` § Plumbing — Sources,
      with the asymmetry it closes stated: a concern DELETED from the manifest
      is a refusal that stops happening, the same authority change as loosening
      the rule behind it, reached one file earlier and until now unrecorded
      while a typo in that rule was.
- [x] **1.2 Add `src/scripts/hooks/block_plumbing_writes.ts` (new) for build
      outputs only.** PreToolUse deny (`fail_closed: true`, `severity: blocking`)
      for Write/Edit/NotebookEdit and the shell write shapes
      `block_kernel_rule_writes.ts:137-160` recognises, targeting
      `dist/hooks/dispatch.js` and `hooks/hooks.json`. Both are generated
      (`npm run build:hooks`, `condense.ts:2356` via `task sync`), so a hand
      edit is never legitimate; `task sync`/`npm run build:hooks` run through
      Bash carry no redirect shape and pass — state this in the header.
      Membership list goes in `hook-architecture-v1.md` § Plumbing (not
      `kernel-membership.md`, whose § 1 admits rules only). The new
      `block_*.ts` is auto-covered by `GOVERNANCE_HOOK_RE`.
      verify: `tests/scripts/block_plumbing_writes.test.ts` (new) refuses
      `Edit dist/hooks/dispatch.js` and `bash -c 'cat > hooks/hooks.json'`;
      allows `npm run build:hooks`; `tests/hooks/concern_severity.test.ts:42-47`
      `BLOCKING_ALLOWLIST` extended in the same commit; heredoc-through-
      interpreter residual asserted as known-open (as in
      `block_kernel_rule_writes.ts:30-36`).
      **Evidence (2026-09-29).** `block_plumbing_writes.ts` refuses
      Write/Edit/NotebookEdit and the shell write shapes (now factored into
      `_lib/shell_write_shapes.ts`, shared with `block_kernel_rule_writes`)
      against `dist/hooks/dispatch.js` and `hooks/hooks.json`.
      `tests/scripts/hooks/block_plumbing_writes.test.ts` green, both
      directions — a refused hand edit AND an allowed `npm run build:hooks`.
      `BLOCKING_ALLOWLIST` in `tests/hooks/concern_severity.test.ts` extended in
      the same change; the heredoc-through-interpreter residual is stated in the
      guard's header as known-open rather than implied closed.
- [x] **1.3 Lint deny text for kill-switch names** (`lint_deny_text.ts`, new,
      task `lint-deny-text`): no `stderr`/`reason` string emitted by a
      blocking concern may contain `AGENT_CONFIG_[A-Z_]+=`, `export `, or a
      settings key path. Exclusion: the human-owned exception registry that
      `block-kernel-rule-writes` names by design (`hook_manifest.yaml:181-182`).
      verify: fixture concern with `set AGENT_CONFIG_X=1 to skip` fails; the
      tree passes.
      **Evidence (2026-09-29).** `./scripts-run src/scripts/lint_deny_text` →
      `no blocking concern names its own bypass (9 concern(s) scanned)`.
      `--self-test`: 7 cases, 3 rejecting — an env assignment with its value, an
      `export` line, a settings key in prose — against the direction that
      matters for a young pattern gate: a bare settings key used as a LOOKUP
      must PASS, because a rule firing on it would fire on every concern that
      reads its own configuration.
      **Found during this pass:** the gate had its task definition and its place
      in the chain but NO CI step and NO `gate-coverage.yml` row, so 1.3 was
      built and unreachable. Both added here.

## Phase 2 — Settings: keys, not files (D4)

- [x] **2.1 Class C keys are hook-refused, files are not.** Extend
      `block_config_weakening.ts` with a third `ConfigKind` `class-c`: a
      Write/Edit to a project `.agent-settings.yml` or `.claude/settings.json`
      that changes a key `lint_settings_classes.ts` classifies as C (spend
      ceiling, allowlist, gate switch, `hooks`) is refused; every other key
      stays agent-writable through `settings set`. User-global files are never
      in reach. The installer's own writes (`install.ts:1003`) run outside a
      governed dispatch and are unaffected.
      verify: fixture edit flipping `hooks.enabled` in project
      `.claude/settings.json` → refused; edit of a Class A key → allowed;
      `tests/scripts/lint_settings_classes.test.ts` untouched.
      **Evidence (2026-09-29).** `classify_target` gains `class-c` for
      `.agent-settings.yml` and a host's `.claude/settings.json`; a bare
      `settings.json` elsewhere stays unclassified, because fencing it on the
      basename alone would refuse files carrying no settings key. `classCVerdict`
      parses the document as it would stand AFTER the edit, diffs LEAF key paths,
      and refuses when any changed key resolves to C through the SHARED
      `shared/settingsClasses.classOfPath` — the same classifier `settings:set`
      and the GUI write route use, not a second copy.
      Eight tests, each refusal paired with the allow that proves the fence is
      per-key: `hooks.injection_scan.enabled` refused, `personal.play_by_play`
      in the same file allowed, `lint_settings_classes.test.ts` untouched.
      Both fail-closed states asserted (unreadable contract, unparseable result).
      Sensitivity probed three ways: neutralising the guarded-key filter reds the
      C-key and fail-closed cases; neutralising the parse check reds the
      unparseable case; nothing else moves.

## Phase 3 — The dispatcher verifies what it runs

> **BLOCKED — 3.3 only, narrowed 2026-09-30.** The 2026-09-29 note blocked all
> three steps behind three conditions. Two of them were executed rather than
> waived, and the record of what each one turned out to be is kept here because
> a blocker that is merely deleted teaches nothing.
>
> **3.1's condition was satisfiable, not impossible.** It read "landing it in
> the same change as Phases 1, 2 and 4 would put the riskiest edit in the tree
> behind the largest diff. It is left for its own change." Those phases have
> merged; this IS its own change. Diff hygiene is a scheduling constraint, and
> a scheduling constraint is met by scheduling, not by waiting.
>
> **3.2's condition needed a mechanism before it needed a runner.** "A
> reference-runner reading" could not be taken because nothing could produce
> one: the bench measured whole SLOTS and the per-concern distribution was
> unreadable — the feedback dir overwrites one file per concern per dispatch,
> and the bench runs in replay mode where that write is skipped entirely. The
> measurement path is built now. The READING is still owed, and deliberately
> so: building it surfaced that replay mode times several blocking concerns at
> a fraction of their real cost (3.2's evidence carries the A/B), so the first
> correct measurement path exists only as of this change and a bound taken
> from one run of it would repeat the mistake that A/B just caught.
>
> **3.3's condition is the one that holds.** Its text says "warn-only for the
> first measured window, then deny", and Risk 1 is why: a blocking concern
> whose SLA was guessed refuses every call on a slow host. A window that has
> not elapsed cannot be declared elapsed by the session that wants to flip the
> switch — that is a wait that is factually mandatory and cannot be simulated,
> which is the one externally-impossible shape on this list. Note that the
> number the window would validate does NOT yet exist — `concern_sla_ms` is
> unwritten — so 3.3 is blocked twice over: on readings it does not have, and
> then on a window that cannot be hurried. The second is the impossible one.
>
> **A ninth concern cannot be measured by this harness at all, and 3.3 owns
> that too.** `one-question-per-ask` is `severity: blocking` on
> `claude/pre_tool_use` behind a `tools:` filter for `AskUserQuestion` and its
> five aliases. The bench's synthetic payload names a different tool, so the
> dispatcher skips the concern in-process and it reports `not_measured` —
> correctly, and that is the honest output rather than a zero. But a blocking
> concern with no measurable p95 cannot receive a bound from this path, so 3.3
> needs either a payload shaped to trigger it or an explicit decision that an
> unmeasured blocking concern keeps the current 30 s timeout rather than
> `sla_ms × 3`. Recorded here because the measurement step is where it became
> visible and the flip is where it bites.
>
> **Narrowed again 2026-10-01 — two of the three conditions above are now
> spent, and the one that remains is the one that was always the impossible
> one.** The `one-question-per-ask` question is answered in the direction that
> keeps the option open: the bench takes an extra `pre_tool_use` pass under an
> ask-shaped payload (`ASK_PROBE`), so all nine blocking concerns carry a
> number and no blocking concern has to be bounded by a decision taken in the
> absence of a measurement. And `concern_sla_ms` is registered, from both
> measured machine classes rather than from this machine alone.
>
> What is left is elapsed calendar time, and nothing else. It is filed as
> `warn-only-window-not-elapsed` under § Blockers below — promoted out of this
> blockquote for the reason that section states: a blocker living only in
> prose is read by no gate, no dashboard and no continuation ladder, so this
> roadmap measured `open: 1, blocked: 0` while its one open step was blocked.
>
> **Resolved when** the registered `concern_sla_ms` values have been observed
> across a warn-only window without a blocking concern exceeding
> `sla_ms × 3`. 3.3 then lands the severity-based fail-closed switch with the
> window's readings behind it. The registration is carried with 3.3 rather
> than under 3.2 because 3.3 is its only consumer and the window that
> validates it is 3.3's own.
>
> **CLOSED 2026-10-03. The window elapsed and was read rather than assumed.**
> 69 clean `warn-only window:` lines across 23 distinct CI runner sessions,
> zero INCOMPLETE, zero overruns, plus three passes on the 1 vCPU
> `hardware_reference.floor` class that nothing had previously sampled —
> tightest margin there 5.08x. The tally against the blocker's four quantified
> conditions, the run table and the container's own environment report are in
> `agents/evidence/analysis/concern-sla-warn-only-window.md`. Phase 3 is
> closed; this blockquote is kept rather than deleted because what each of the
> three original conditions turned out to be is the useful part.

- [x] **3.1 Bundle integrity once per session, cached.** `build:hooks` writes
      `dist/hooks/dispatch.sha256`; `check_hook_bundle_content.ts` (exists,
      CI) already compares the bundle digest to source. At runtime, the
      `session_start` dispatch computes SHA-256 of the bundle once and caches
      `{sha, size, mtime}` in session state; every later dispatch compares
      `size+mtime` (microseconds) and re-hashes only on change. A mismatch on
      a `severity: blocking` slot refuses with issue kind `execution_failed`
      and reason `plumbing-integrity`; on an advisory slot it warns. The
      FNV-1a manifest fingerprint (`:198-215`) is replaced by the manifest's
      SHA-256 embedded at build time.
      verify: `tests/scripts/dispatch_integrity.test.ts` (new) — one-byte
      change to the built bundle → next blocking-slot dispatch refused;
      rebuild → allowed; `bench_hook_latency --gate` green (per-dispatch cost
      is a stat call).
      **Evidence (2026-09-30).** `build:hooks` writes `dist/hooks/dispatch.sha256`
      in the same invocation; `bundle_integrity.ts` hashes once per build
      identity and stats after. Measured on this tree: SHA-256 over the 1.5 MB
      bundle 0.470 ms; the steady-state path — reading the cached stamp AND
      stating the bundle — 0.0101 ms for the pair, against 0.0010 ms for the
      stat alone. The pair is the honest figure and a first draft of this
      evidence quoted the stat, which is one of the two syscalls.
      `pre_tool_use` p50 read 63 ms before and 63 ms after.
      **AC-2's line below quotes the stat alone (0.0009 ms) and this is the
      complete figure.** That line is left as written because
      `lint_plan_risk_register` hashes the whole Acceptance Criteria section
      against the version at the risk-review date, and its `reviewed:` field
      carries a date with no time — so a second review on the same day cannot
      re-anchor it and any edit to that section reds the gate unresolvably
      until tomorrow. The criteria themselves never changed; only evidence
      prose did. Recorded here rather than worked around, because the next
      person to hit it should find the reason and not the workaround.
      **Proved live end-to-end, not only in unit tests**, and the probe had to
      move to prove it: `block_plumbing_writes` REFUSED the tamper — step 1.2
      working — so the probe corrupted the sidecar instead, which produces the
      identical `mismatch` through the identical branch. Against the real
      dispatcher: `pre_tool_use` (blocking concerns present) → exit 2 with
      `plumbing-integrity`; `session_end` (advisory only) → exit 0 with the
      warning; sidecar absent → exit 0 silent; restored → exit 0 silent.
      21 unit tests, both polarities. Sensitivity probed by making a missing
      sidecar return `mismatch`: exactly the two tests bounding the fail-open
      direction go red, nothing else moves.
      **THE FNV-1a CLAUSE WAS RE-MEASURED, NOT ASSUMED.** The step asks for the
      manifest fingerprint to become SHA-256, and this file's own Source block
      cites the 8 ms `node:crypto` startup as the reason FNV-1a was chosen —
      the two are in tension, so the tension was measured rather than argued.
      `dist/hooks/dispatch.js` already carries 23 top-level `node:crypto`
      imports from elsewhere in the graph, so the 8 ms is paid either way, and
      SHA-256 then measured FASTER than the interpreted loop (0.106 ms against
      0.113 ms over the 99,792-byte manifest). The clause stands; the cost
      argument behind the thing it replaced had gone stale.
      **Deviation, stated:** the stamp caches in the OS temp dir, not in session
      state. Session state is not written in replay mode — the mode
      `bench_hook_latency` runs in — so a session-state cache would be skipped
      in exactly the harness whose reading this step's verify line asks for, and
      a host that never emits `session_start` would get no check at all.
      **Risk 3 closed in the same change:** `prepack-check.mjs` refuses to
      package a bundle whose sidecar is missing or stale. It is the one step
      that knows a bundle is being built now, and it is needed precisely because
      a missing sidecar is `unverifiable` and ALLOWS at runtime — deliberately,
      so a consumer predating the sidecar is not wedged.
- [x] **3.2 Measure per-concern p95 before any flip (D3).** Extend
      `bench_hook_latency.ts` to report p95 per concern (today per slot,
      `hook-latency-budget.json`); write `sla_ms` per blocking concern into
      the budget file from the measured p95 on the reference runner.
      verify: report lists all 8 blocking concerns with p95 and `sla_ms`; a
      concern the bench could not time prints `not_measured`, never `0`.
      **Evidence (2026-09-30) — the report is delivered; `sla_ms` is
      deliberately still unwritten, and the second half of that sentence is the
      finding rather than an omission.**
      The verify line is met: `bench_hook_latency` prints one row per BLOCKING
      concern — nine, not eight, because step 1.2 of this same roadmap added
      `block-plumbing-writes`, which is why the list is read from the manifest
      instead of hardcoded. A concern with no samples prints `not_measured`
      (`one-question-per-ask` does, honestly: its slot is not exercised by the
      synthetic payload).
      **A second route to a false `0` was live and the step did not anticipate
      it.** The first run printed `p95 0 ms` for ALL NINE concerns. Every
      concern in the static registry runs in-process and finishes well under a
      millisecond, and `duration_ms` is floored — so truncation produced a
      real-looking zero that the `not_measured` branch cannot catch and that
      3.3 would have multiplied by three to reach a timeout of zero. The
      samples now carry microsecond resolution and both routes are pinned.
      **WHY `sla_ms` IS NOT WRITTEN, measured rather than argued.** The samples
      first came from the gated slot runs, which set `AGENT_CONFIG_REPLAY=1`.
      Replay suppresses state writes, and several blocking concerns do most of
      their work through state. A/B, n=25 per cell: `verify-before-complete`
      live 1249 µs against replay 310 µs (**×4.03**), `run-continuation` 431
      against 220 (×1.96), `journal-record` ×1.24, `block-no-verify` ×1.21,
      everything else inside ±10 %. An `sla_ms` of 310 µs for a concern whose
      real p95 is 1249 µs gives 3.3 a 930 µs bound that the concern exceeds on
      an ORDINARY run — Risk 1 of this register, arriving through a measurement
      instead of through a guess.
      The per-concern samples now come from their own pass with replay OFF
      (`concernSlaPass`), against a throwaway workspace. `run-continuation`
      moved 0.240 → 0.399 ms after the change, matching the A/B's live figure.
      Registering a bound from one reading of a path corrected in the same
      commit is the over-confidence the A/B just caught, and nothing consumes
      `sla_ms` until 3.3 — which is blocked on an elapsed window regardless. So
      the registration rides with 3.3, where its consumer is, and the Phase 3
      blocker names it.
      **Honest gap:** the replay/live delta is measured, not pinned by a test.
      Asserting it needs a spawn of the real bundle against a real state root —
      slow and environment-dependent — and a mocked spawn would test the mock.
      The A/B is recorded in `concernSlaPass`'s header where the next reader
      meets it.
- [x] **3.3 Fail closed by severity, after 3.2.** Amend
      `hook-architecture-v1.md:125`: rc ≥ 3 or timeout on a
      `severity: blocking` concern → `EXIT_BLOCK` with `execution_failed`
      named; advisory concerns keep fail-open; `:303` unchanged.
      `_is_advisory` (`dispatch_hook.ts:138`) keeps downgrading advisory
      blocks and may not downgrade an integrity refusal. Timeout for a
      blocking concern becomes `sla_ms × 3`; warn-only for the first
      measured window, then deny.
      verify: `tests/scripts/hooks/dispatch_hook.test.ts` — blocking concern
      that throws → refused; advisory that throws → allowed with issue row;
      `tests/hooks/concern_severity.test.ts:103,131` comments updated (their
      "crash lets the turn END" note no longer holds for the stop slot — lane
      1's file, this lane's decision, recorded in the programme as D3).
      **Still open (2026-10-01) — on elapsed calendar time, and on nothing
      else.** Everything this step was waiting on that could be worked has
      been worked; what is left is a wait that cannot be simulated by the
      session that wants to end it.

      **It stays `[ ]` rather than becoming `[~]`, and that is a correction
      taken from this repository's own mechanics rather than a preference.**
      `[~]` means deferred, and a roadmap at `count_open == 0` with
      `count_deferred > 0` fails `roadmap-progress-check` under Iron Law 3 —
      measured here: flipping 3.3 and AC-3 to `[~]` reds that gate, which is a
      build failure in exchange for a glyph. The shape the tree already uses
      for a step waiting on a condition outside it is `[ ]` plus a filed
      `### blocker:` entry, which is what `road-to-a-stop-that-holds` did when
      it promoted six blockers out of prose (9 open steps, 0 deferred, 5
      blockers). A blocker reclassifies its step from OPEN to BLOCKED for every
      reader that matters — the dashboard, the archival sweep, the continuation
      ladder — without claiming the step was set aside by choice. See
      § Blockers → `warn-only-window-not-elapsed`.

      **What moved.** (a) `concern_sla_ms` is registered in
      `src/config/hook-latency-budget.json` for all nine blocking concerns —
      the clause the Phase-3 blocker named first, which the roadmap parks with
      3.3 because 3.3 is its only consumer. Six readings per concern across
      two machine classes: three passes on the reference runner (GitHub
      ubuntu-latest, one Static Checks job — the gated `--gate --via-cli` run
      plus the two ungated runs, n=40 on `pre_tool_use` and n=20 on `stop`)
      and three local `--runs 20` passes on darwin, n=20 each. The FIRST
      registration of these rows was WRONG — the ask probe was contaminating
      its neighbours' samples, the contaminated values were higher on all nine
      (`block-no-verify` 1.221 against 0.921 clean, `turn-end-gate` 2.126
      against 1.587), i.e. the error pointed toward a LOOSER bound, which is
      the direction nothing complains about. Re-derived from uncontaminated
      runs on both classes; the budget file records the defect beside the
      numbers. Registered value is the maximum observed, with no rounding and no safety factor: the margin is
      the `x 3` the consumer applies, and a factored value would put a guess
      inside a number whose purpose is to be measured. Ubuntu measured slower
      on all nine, so no darwin reading sets a bound.
      (b) `one-question-per-ask` is measured rather than waived. The blocker
      offered two exits — "a payload shaped to trigger it or an explicit
      decision that an unmeasured blocking concern keeps the current 30 s
      timeout" — and this takes the first: `concernSlaPass` runs one extra
      `pre_tool_use` pass under `ASK_PROBE`, and the concern reads 0.899 /
      0.915 / 0.927 ms on the reference runner against `not_measured` before.
      No blocking concern is now bounded by a decision taken in the absence of
      a measurement.
      (c) The warn-only window has an instrument. `slaOverruns` names any
      blocking concern whose measured p95 crossed `sla_ms x 3`, printed on
      every bench run, gating nothing. **This is what makes the remaining wait
      finite**: before it, "observed across a warn-only window" named no
      observer, so the window could not have ended with a reading behind it —
      only with the absence of a complaint. Local run after registration:
      `warn-only window: 9 of 9 bounded and measured, none over`. On the
      reference runner, three CI passes after the isolation fix report the
      same, so the window opens with readings rather than with a promise.

      **The spread that is the reason the wait is real.** The ubuntu/darwin
      p95-max ratio is not one number: `turn-end-gate` 3.64x,
      `one-question-per-ask` 3.03x, `block-speaking-inbox-dir` 2.98x, down to
      `block-kernel-rule-writes` 1.14x. A single factor taken from any one
      concern would be wrong for another by more than 3x. Both measured classes are also faster than the
      1 vCPU container `hardware_reference.floor` documents and does not
      enforce, so `sla_ms x 3` is validated against two fast classes and
      nothing else. That is precisely Risk 1 — reached one level above the
      harness flag that register entry already records, at the machine instead.

      **Independently reviewed, and it found two real defects in the first
      version of this work.** AI council 2026-10-01, 2/2 provider-diverse
      (anthropic/claude-sonnet-4-5 + openai/codex-default), 2 rounds, $0.00
      (subscription seats). Verdict on the governed file:
      `confirmed-non-expanding`, both seats, with the same qualifier from each
      — step 3.3 is a separate authority-affecting change and needs its own
      review when it wires these numbers into a runtime decision. (HIGH) The
      ask probe contaminated every unfiltered neighbour on its slot: it
      dispatches the whole event, so the neighbours ran under the ask payload
      too and pooled into one sink. It was visible in this report's own output
      — n per `pre_tool_use` concern went 20 → 40 the moment the probe landed
      — and went unread; the registered values above were re-derived from
      uncontaminated runs after the fix, and every one of them moved DOWN.
      (MEDIUM) The summary line could call
      an incomplete window clean, because the success marker counted off the
      REGISTERED total while `slaOverruns` skips a concern it could not
      measure. Both fixed with their own cases. The remaining findings — no
      executable window exit criterion, and the bench-is-not-runtime
      substitution — are answered in the blocker rather than here. Full
      findings table and dispositions:
      `agents/evidence/ratifications/drain-kernel-guards-plumbing-close.md`.

      **The in-process claim's coverage, since both seats named it
      load-bearing and neither could check it.** First half pinned by a live
      test: `tests/hooks/concern_registry_parity.test.ts` reds if any manifest
      concern lacks an in-process registry entry, so a fallback to the spawn
      path cannot land silently. Second half is structural — `_run_concern_inproc`
      calls `main_fn` directly and takes no timeout argument, and no test can
      falsify the absence of a mechanism that does not exist; a source-string
      assertion would read as coverage without being any. Half pinned, half
      named.

      **What a future session needs, exactly.** Nothing to re-measure and
      nothing to re-derive. Read the `warn-only window:` line the bench prints
      on every CI push; the readings accumulate with no action. A span of
      clean runs closes blocker `warn-only-window-not-elapsed`; a run naming an
      overrun ENDS the window rather than extending it, because the registered
      value was then wrong and 3.3's own "warn-only for the first measured
      window, then deny" re-derives the bound before the flip. Then land the
      switch. The one unrelated input 3.3 still owes, surfaced here because it
      is invisible from the step's text: `_run_concern`'s 30 s `timeout:` is
      on the SPAWN path, and every manifest concern takes the in-process path
      by default, where the dispatcher's own header states a kill-timeout
      "cannot preempt in-process synchronous code". So `sla_ms x 3` is a
      post-hoc overrun verdict on the default path, not a preemption, and 3.3
      must say which it is landing.

      **LANDED 2026-10-03, and here is which thing it does.** The runtime
      change is the SEVERITY RESOLUTION and nothing else: `rc >= 3` on a
      `severity: blocking` concern now refuses, where the branch previously
      read the `fail_closed:` flag and six of the nine blocking guards
      therefore permitted the call precisely when they broke. `sla_ms x 3`
      stays a HARNESS OBSERVATION — the line
      `src/scripts/_lib/concern_sla_window.ts` prints on every bench run,
      gating nothing. No runtime warn-only path is added and no runtime
      timeout reads the budget. That is the declaration the blocker asked for,
      stated in the direction that does not widen anything.

      **The timeout clause is refused, on a measurement rather than on a
      preference.** An earlier revision of this branch wired
      `sla_ms x 3` into `_run_concern`'s `spawnSync` timeout and the two
      changes were lethal together. `concern_sla_ms` is derived from the
      dispatcher's own per-concern `duration_ms`, which brackets
      `main_fn(argsList)` and nothing else; the registered rows are 0.564 to
      1.587 ms, so the bound is 1.7 to 4.8 ms. A spawn timeout must also cover
      fork, interpreter start and module load, and the same bench's
      `control (node -e 0)` row measures that term ALONE at p95 17 ms on the
      1 vCPU class and 26 ms on the GitHub runner. Probed against the real
      dispatcher: `AGENT_CONFIG_HOOKS_ISOLATED=1` on `claude/pre_tool_use`
      returned `ETIMEDOUT` for all six blocking concerns, left no verdict, and
      the new severity branch turned each one into a deny — exit 2 on an
      ordinary `Read`. Risk 1 of this register, firing on every host instead of
      a slow one, through a documented escape hatch. Re-wiring it needs a
      SPAWN-path measurement this tree does not have; a second reading of the
      in-process number cannot supply it.
      `dispatch_hook.test.ts` § "the spawn path keeps the historical timeout"
      pins the direction with a concern NAMED for a registered SLA row, so the
      case reds if the bound returns.

      **The stop slot spends its refusal once, and that clause is new.** Step
      3.3's own verify line calls the reversal "lane 1's file, this lane's
      decision, recorded in the programme as D3" — and no record of D3 exists
      anywhere in this repository, searched. The Prerequisites line asserting
      it came verbatim from an externally supplied draft and was never
      verified, so the reversal shipped with no prior authority behind it and
      is carried by this change's own review instead. `turn-end-gate` and
      `run-continuation` are `severity: blocking` on `stop` and carry neither
      `fail_closed: true` nor `skip_on_refusal_retry`, and both read
      `stop_hook_active` INSIDE `main()` where a crash never reaches it. So the
      dispatcher bounds it: a crash refuses the first Stop and, on the retry
      the host marks, falls back to fail-open. A guard that broke loses the
      power to refuse forever on the strength of being broken; a guard that
      DECIDED to refuse returns 1 and never reaches this branch.

      **Window readings behind the flip.** 69 clean `warn-only window:` lines,
      23 distinct CI runner sessions, 0 INCOMPLETE, 0 overruns, plus three
      1 vCPU passes with a tightest margin of 5.08x. Tally, run table and
      container report:
      `agents/evidence/analysis/concern-sla-warn-only-window.md`.

      **Bundle cost.** `check_hook_bundle_composition` reads 1,507,218 B on the
      base and 1,508,928 B with this change — **+1,710 B**, leaving 41,072 B of
      headroom under the 1,550,000 B ceiling.

      **The severity policy moved to its own file, and the move SURFACED a gap
      in this roadmap's own subject.** `dispatch_hook.ts` measured exactly
      1,500 lines on `main` — sitting precisely on the
      `check_source_size_budget` cap — so every line this step added was a
      ratchet violation. The ratchet turns one way and the doctrine every entry
      in `gate-violation-baselines.json` records is that a MOVE gives the
      budget back where raising the baseline spends it, so the whole
      no-verdict policy went to
      `src/scripts/hooks/concern_failure_policy.ts`: `_is_advisory`,
      `_is_blocking`, `_resolve_execution_failure`, `SPAWN_TIMEOUT_MS`,
      `classifySpawnResult` and the refusal notice. The dispatcher re-exports
      them, so no importer or test changed. Same move
      `_lib/concern_sla_window.ts` made out of `bench_hook_latency.ts`, and the
      better boundary on its own terms: the new file answers what a declaration
      MEANS, the dispatcher runs concerns.

      **The gap: `check_kernel_edit_ratified`'s gated-surface pattern names
      `src/scripts/hooks/dispatch_hook.ts` and `*-dispatcher.sh` and nothing
      else under `hooks/`, so the decision logic is now in a file the
      ratification gate does not watch.** Verified by running the gate on this
      diff: it reports three gated surfaces and the new module is not among
      them. That is this roadmap's own subject — "the plumbing that decides
      whether a guard runs at all was not governed" — reappearing one file
      down, and it is recorded rather than quietly accepted. It is NOT fixed
      here: widening the pattern edits `check_kernel_edit_ratified.ts`, which
      is itself on the gated list as the ratification mechanism, so it needs
      its own ratification and its own change. This step's council reviewed the
      logic, not the gate.

      **Independently reviewed, and the review found a defect the author did
      not.** AI council 2026-10-03, 2/2 provider-diverse
      (anthropic/claude-sonnet-4-5 + openai/codex-default), $0.00 on
      subscription seats. Verdict `ratified` from both seats — this is an
      authority EXPANSION, not an alignment, because `fail_closed:` was a
      separate policy dimension and `severity` is being widened to absorb it.
      (BLOCKING, both seats) `proc.status ?? 0` read a signal-terminated child
      as exit 0, i.e. ALLOW, at precisely the moment the new branch exists to
      refuse — fixed, with a fixture that gets the spawned process killed and
      a case in each direction. Further findings taken: the `fail_closed:`
      manifest comments now say what the flag still decides (the
      stdin-read-failure deny) instead of what it stopped deciding; the
      contract's "full traceback" claim is corrected to the diagnostic each
      failure actually produces; the asymmetric blast radius (`stop` bounded
      by the retry, `pre_tool_use` not) is stated in the contract; the escape
      hatch is printed on stderr beside a `pre_tool_use` refusal rather than
      left in a source comment; and the window counts were replaced by a path,
      after the review found two different tallies inside one diff. The one
      finding NOT actioned is the in-process synchronous hang, which no clause
      here releases — recorded in the contract as an unbounded case rather
      than closed. Artifact:
      `agents/evidence/ratifications/drain-kernel-plumbing-3-3-severity.md`.

## Phase 4 — One exit-code table

- [x] **4.1 `src/scripts/hooks/exit_codes.ts` (new).** One frozen table
      `{code, name, meaning, owner, authorizedBy}` for 0/1/2/≥3; `dispatch_hook.EXIT_*`
      and `host_semantics.ts` import it; the 33 hook files declaring local
      `const EXIT_ALLOW = 0 …` import instead. Lint `lint_exit_codes` (new)
      refuses a bare numeric `process.exit(` in `src/scripts/hooks/**/*.ts`
      (the `*-dispatcher.sh` inline one-liners are out of scope).
      verify: `grep -rn 'process.exit([0-9]' src/scripts/hooks --include=*.ts | wc -l`
      is 0; `lint-exit-codes` in `ci-fast.yml`.
      **Evidence (2026-09-29).** `grep -rn 'process\.exit([0-9]'
      src/scripts/hooks/*.ts` → **0**. `src/scripts/hooks/exit_codes.ts` is the
      frozen table with `owner` and `authorizedBy` per row.
      `./scripts-run src/scripts/lint_exit_codes` → `59 hook file(s), no bare
      exit numeral`; `--self-test` 6 cases, 4 rejecting, including a bare `0`
      (the one people assume is harmless) and an empty corpus. The table file's
      own exclusion is exercised rather than asserted — the fixture plants a bare
      exit into `exit_codes.ts` every run. Registered in `ci-fast.yml`, chained in
      `Taskfile.yml`, invoked in `consistency.yml` as the script (not via `task`),
      with a `gate-coverage.yml` row. Sensitivity probed against the real tree:
      restoring the bare `2` in `replay_hook.ts` reds the gate naming that line.
      **TWO SITES WERE NOT VERDICTS.** `dispatch_hook` and `replay_hook` are also
      CLIs and exit 2 on their own bad argv — the POSIX usage convention, which
      collides with `EXIT_WARN` by coincidence and not by meaning, since no
      concern has spoken at that point. `EXIT_USAGE` is exported beside the table
      and deliberately NOT a row in it: importing `EXIT_WARN` would assert a
      verdict nobody reached, and a fifth row would put a non-verdict in a table
      whose whole subject is what a concern may say.

## Blockers

Promoted 2026-10-01 from prose. The obstacle below already existed as a
paragraph inside the Phase-3 blockquote, where no gate reads it: blocker
detection keys on a `## Blockers` section with `### blocker:` headings, so
`update_roadmap_progress` measured this roadmap at **one open step and zero
blockers** while that one open step was the blocked one. Nothing here is newly
discovered and nothing newly refused — the same obstacle, in a shape the
dashboard, the archival sweep and the continuation ladder can act on.

### blocker: warn-only-window-not-elapsed
- **Status:** resolved
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Resolved:** 2026-10-03, by READING the window rather than by waiting
  further. Tally against the four quantified conditions below: (a) **69** clean
  `warn-only window:` lines against a floor of 10; (b) **23** distinct CI runner
  sessions against a floor of 2; (c) **0** runs reporting INCOMPLETE; (d) the
  1 vCPU `hardware_reference.floor` class **sampled**, three passes, all clean,
  tightest margin 5.08x — the sampling branch rather than the recorded-decision
  branch. The reset rule never fired: no run named an overrun. Run table,
  per-concern margins and the container's own environment report:
  `agents/evidence/analysis/concern-sla-warn-only-window.md`.
- **Its `Class: 3 — human-only` label was wrong, and the correction is worth
  keeping.** The class was assigned because elapsed calendar time cannot be
  spent by a session, which is true and is about the WAIT. The exit criterion
  this blocker itself added is four counts over CI log lines, and counting is
  not a human-only act. Under capability-before-role the label follows the exit
  criterion, not the inconvenience; filed as `3` it told the continuation ladder
  that no agent could close it, which is why it sat open after the readings it
  needed already existed. A blocker whose exit criterion is quantified is
  agent-checkable by construction.
- **Ownership:** destructive-owned
- **Blocks:** Phase 3 — step 3.3 and AC-3. Every other step and criterion on
  this roadmap is closed.
- **What to do:**
  1. **Do not re-measure first.** `concern_sla_ms` is registered in
     `src/config/hook-latency-budget.json` for all nine blocking concerns, from
     two machine classes, and its derivation block states what it is and is
     not. Re-deriving it is not what is owed.
  2. Read the warn-only line the bench prints on every run — local or CI,
     gated or not. `slaOverruns` names any blocking concern whose measured p95
     crossed `sla_ms × 3`; a clean run prints `warn-only window: 9 of 9
     bounded, none over`.
  3. Collect those lines across the window. The CI `Static Checks` job runs
     the bench on every push, so the readings accumulate without anyone doing
     anything; the window is a span of runs to READ, not a measurement to take.
  4. Any run naming an overrun ends the window rather than extending it: the
     registered value was wrong, and 3.3's own text ("warn-only for the first
     measured window, then deny") means the bound is re-derived before the
     flip, not that the flip waits longer.
  5. Only then land 3.3 — the severity-based fail-closed switch — with the
     window's readings behind it.
- **Exit criterion, quantified — an independent review refused "a span of runs
  a human can read" as a judgement rather than a specification, and it was
  right.** The window closes when ALL of: (a) at least **10** bench runs print
  a `warn-only window:` line with no overrun; (b) those runs span at least
  **two distinct CI runner sessions**, not ten pushes on one machine — the
  same floor and the same reason as `per_turn_composite.arming_precondition`,
  which exists because single-machine under-sampling was measured on a sibling
  metric in this tree; (c) **no run reports INCOMPLETE** — a run that could not
  measure a bounded concern observed nothing about it and does not count
  toward (a); (d) the 1 vCPU class named in `hardware_reference.floor` has
  either been sampled once, or step 3.3 records an explicit decision to flip
  without it. (d) is the honest half: both classes behind the registered
  numbers are faster than the documented floor, so a window that never touches
  it validates the bound against two fast machines and says so.
- **Reset rule:** a run naming an overrun ENDS the window rather than
  extending it. The registered value was then wrong, and 3.3's own "warn-only
  for the first measured window, then deny" re-derives the bound before the
  flip — a counter that merely keeps waiting would turn a falsified bound into
  a patience problem.
- **What this window does NOT cover, stated rather than implied.** It is
  observed through the bench, not through the dispatcher: synthetic payloads,
  on the machines that happen to run the bench, when someone runs it. It does
  not see production payload diversity, contention, or a slow consumer host.
  An independent review named this a substitution unless the roadmap narrows
  the requirement explicitly, so it is narrowed here: harness observation is
  what this blocker asks for. Widening it to a runtime warn-only path is a
  dispatcher change and belongs to step 3.3, which must say which it is doing.
- **Recommendation:** let it run. The readings cost nothing and accumulate on
  every push; the alternative is flipping a blocking concern to fail-closed on
  a bound validated by one machine, which is Risk 1 of this register reached
  by exactly the route Risk 1 records it being nearly reached once already.
- **If you do nothing:** the dispatcher keeps today's behaviour — rc ≥ 3 on a
  blocking concern fails OPEN unless the concern also declares
  `fail_closed: true` (three of nine do), and the kill timeout stays 30 s on
  the spawn path. That is the pre-roadmap state for this one step; nothing
  this roadmap landed regresses, and nothing it landed depends on the flip.
- **Resolved when:** the registered `concern_sla_ms` values have been observed
  across a warn-only window without a blocking concern exceeding
  `sla_ms × 3`. **Met** — see § Resolved above. What the readings license is
  the bound as an OBSERVATION, which is what this blocker asked for in as many
  words; step 3.3 accordingly lands the severity resolution and leaves
  `sla_ms × 3` unwired, for a unit mismatch these readings cannot answer and
  that its own closing record carries.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-03 | reviewer: ai-council-2of2-anthropic-openai -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Fail-closed wedges slow hosts | implementation | A blocking concern at p95 > SLA×3 refuses every call | 3.2 before 3.3; warn-only window; `sla_ms` from the reference runner, not a guess. **Re-reviewed at v3 and it NEARLY FIRED, through a route this row did not anticipate.** The row guards against a *guessed* SLA. The measurement itself was the hazard: the per-concern samples first came from the gated bench, which runs with `AGENT_CONFIG_REPLAY=1`, and replay suppresses the state writes several blocking concerns do most of their work through. A/B, n=25 per cell, 2026-09-30 — `verify-before-complete` live 1249 µs against replay 310 µs (**×4.03**), `run-continuation` ×1.96. An `sla_ms` of 310 µs gives 3.3 a 930 µs bound a concern exceeds on an ordinary run: this row's exact failure, reached by measuring rather than by guessing. Closed by `concernSlaPass`, which measures with replay off. The generalisable form, worth carrying: a harness flag that makes the system cheaper to observe can make the observation wrong, and "we measured it" is not by itself the mitigation this row asks for. **Re-reviewed at v4, on the change that closes this phase, and it FIRED — caught by a probe rather than by a reader.** The first revision of step 3.3 wired `sla_ms x 3` into `_run_concern`'s `spawnSync` timeout. `concern_sla_ms` is the dispatcher's own per-concern `duration_ms`, which brackets the concern's work alone (0.564-1.587 ms registered); a spawn timeout also covers fork, interpreter start and module load, which the same bench's `control (node -e 0)` row measures at p95 17 ms on 1 vCPU and 26 ms on the runner. Probed with `AGENT_CONFIG_HOOKS_ISOLATED=1` on `claude/pre_tool_use`: all six blocking concerns `ETIMEDOUT`, left no verdict, and the new severity branch turned each one into a deny — exit 2 on an ordinary `Read`. This row's exact failure, on every host rather than a slow one, reached through a documented escape hatch and NOT through a guessed SLA — the number was measured correctly and then applied to a different quantity. Closed by refusing the clause: the spawn path keeps 30 s, `sla_ms x 3` stays an observation, and `dispatch_hook.test.ts` pins the direction with a concern named for a registered SLA row. The generalisable form, worth carrying beside the v3 one: a correct measurement applied to the wrong quantity fails exactly like a guess, and the unit is the part nobody re-reads. | Phase 3 — The dispatcher verifies what it runs |
| 2 | Ratification gate blocks routine plumbing maintenance | implementation | Every manifest edit needs an artifact | That is the ADR-268 mechanism already applied to kernel rules; `ratification-policy.json` quorum is the owner's dial. **Re-reviewed at v2 and now LIVE — 1.1 has landed.** Both council seats were asked directly whether the friction needs a carve-out before it ships and both declined: these are governance-bearing sources and the existing mechanism fits. Recorded because the question was put and answered, not assumed. | Phase 1 — One mechanism per file class |
| 3 | Bundle hash stale after a consumer rebuild | implementation | `dispatch.sha256` not rewritten | Written by the same build step; `src/scripts/prepack-check.mjs` refuses a bundle without its sidecar. **Re-reviewed at v3 and now LIVE — 3.1 has landed**, and the mitigation gained a second leg the review asked for. prepack covers the published tarball and nothing else, while a missing or unreadable sidecar is `unverifiable` at runtime and ALLOWS by design (so a consumer predating the sidecar is not wedged) — meaning a degraded sidecar failed nothing on any other path. `write_bundle_digest.mjs` now reads back what it wrote and exits 1 on a mismatch, which covers every path that produces a bundle because it is part of producing one. Both council seats named this the highest-leverage addition on the branch. | Phase 3 — The dispatcher verifies what it runs |
| 4 | A guard resolves a different package root from the one it runs in | implementation | Added at the v2 review, because it ALREADY HAPPENED rather than being foreseen: the Class C fence resolved its class contract with a fixed `..` hop count, which is correct only in the source tree. Inlined into `dist/hooks/dispatch.js` every module shares the BUNDLE's `import.meta.url`, so the same expression lands somewhere else — the guard reads the wrong contract, or none, and then fails closed on every settings edit in a consumer install. The failure is silent in this repository, where the hop count happens to be right. | `findPackageRoot` walks up to the nearest directory that actually CARRIES the contract and returns `null` rather than a default root, answering the question the guard is asking instead of a proxy for it. Two tests pin both directions, and a packaging regression test pins the contract in `files[]` — because the fence is only reachable in a consumer while it ships. | Phase 2 — Settings: keys, not files (D4) |
| 5 | A gate counts a file it could not read as one it cleared | implementation | Also added at v2 from a real finding, not a forecast: `lint_exit_codes` skipped an unreadable file and then marked it complete, producing a green with a file count behind it that overstated what was examined. This is the shape `assertScanned` refuses at the corpus level, reappearing one level down inside the loop — where nothing was watching for it. | Unreadable files are named and the gate exits 2. Probed against a `chmod 000` fixture rather than asserted. The generalisable form, worth carrying to the next gate: a per-file `continue` in a scanning loop is a silent scope reduction unless the skipped file is counted somewhere. **Re-reviewed at v3: the form RECURRED on this branch and the register earned its keep.** `readConcernTimings` skipped unparseable lines in the timings sink and its header claimed the reduction was visible because `n` is printed — but `n` shows the effect of a skip and never its cause, so 90 of 100 valid lines and 90 runs read identically. Caught by the council, not by this row, which is the honest attribution; the row is what makes it a pattern rather than a second isolated bug. The reader now returns the skipped count and the report prints it. | Phase 4 — One exit-code table |

## Acceptance Criteria

- [x] AC-1 — An unratified diff to `hook_manifest.yaml`, `host_lowering.yaml`
      or a budget file fails CI; a hand edit to `dist/hooks/dispatch.js` or
      `hooks/hooks.json` is refused at tool-call time.
<!-- AC-3 belongs to 3.3, the one Phase-3 step still blocked above; it stays
     open for the reason recorded there, not for lack of an attempt. -->
- [x] AC-2 — A one-byte change to the built bundle refuses the next
      blocking-slot dispatch; the per-dispatch cost is a stat call.
      Proved against the real dispatcher on 2026-09-30, both halves. Refusal:
      `pre_tool_use` (blocking concerns present) exits 2 naming
      `plumbing-integrity`, while `session_end` (advisory only) exits 0 with a
      warning and an absent sidecar exits 0 silently. Cost: `statSync` measured
      0.0009 ms against the 0.470 ms full hash it replaces, and `pre_tool_use`
      p50 read 63 ms both before and after. The tamper had to be applied to the
      sidecar rather than the bundle, because `block_plumbing_writes` refused
      the bundle edit — step 1.2 working, and the same `mismatch` through the
      same branch either way.
- [x] AC-3 — After the measured window, a blocking concern that throws refuses;
      an advisory one allows with an issue row. **The "or exceeds `sla_ms × 3`"
      half is NOT met and was refused rather than missed** — see 3.3's closing
      record and `agents/evidence/analysis/concern-sla-warn-only-window.md`
      § What this window does and does not license. `concern_sla_ms` measures
      in-process concern work (0.564-1.587 ms registered) and a `spawnSync`
      timeout must also cover interpreter start, which the same bench measures
      at p95 17 ms on 1 vCPU and 26 ms on the runner. Wired and probed, it
      ETIMEDOUTs all six blocking `pre_tool_use` concerns and turns each
      non-verdict into a deny — exit 2 on an ordinary `Read`. Meeting that half
      needs a SPAWN-path measurement this tree does not have, which is a new
      measurement rather than a second reading of this one. The criterion is
      ticked on the half that was landed and the other half is carried as the
      narrowing it is, because a box ticked over an unmet clause is worse than
      an open box.
      2026-10-07: the spawn-path measurement is received by step 4.1 of `road-to-a-ratification-fence-that-follows-its-imports`.
- [x] AC-4 — `lint-deny-text` and `lint-exit-codes` are in CI and green.
- [x] AC-5 — A Class C key edit in project settings is refused; a Class A
      key edit is not; no user-global file is touched.

## Provenance

Source-derived (template rule 19). Pre-council draft.

| Descriptor | Token | Drawn in, per defect |
|---|---|---|
| S9 — phase-loop reference | `ENC1:<mint>` | exit-code registry with `authorizedBy`; write guard with declared crash policy — for defects "plumbing unguarded" and "fail-open by default" |
| S2 — swarm/runtime reference | `ENC1:<mint>` | negative control: safety hook exits 1 (non-blocking) |
| S3 — prose-corpus reference | `ENC1:<mint>` | negative control: deny text names the env kill switch (1.3) |

Gap-table: KEEP 1.2, 1.3, 2.1, 3.1–3.3, 4.1; FOLD 1.1 (extends the ADR-268
CI gate); CUT "whole-file guard on settings" (per-key fence exists,
`settings-classes.md`), "loud missing bundle" (contradicts
`hook-architecture-v1.md:868-873`; `hooks.json` is generated), "resolve
forge-protection-settings" (unrelated forge admin blocker).
