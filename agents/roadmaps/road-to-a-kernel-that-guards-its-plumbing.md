---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "lane 2 of road-to-leading-every-row; the set's offset is lane 1's in-diff supersession"
estate_growth_exempt: "The concern estate grows by exactly one — `block-plumbing-writes` — and the growth is the deliverable rather than a side effect. Step 1.2 exists because `dist/hooks/dispatch.js` and `hooks/hooks.json` are generated files with no legitimate hand edit and, until this change, no guard: an edit to either survived until the next build, reached every dispatch meanwhile, and was invisible in a source review. There is no concern to trade against it. The two nearest candidates are `block_kernel_rule_writes` and `block_config_weakening`, and both cover DIFFERENT file classes that this one deliberately does not touch — the roadmap's whole subject is one mechanism per class, so folding the new guard into either would recreate the conflation it was written to end. Retiring an unrelated concern to buy the slot would remove a live refusal to pay for a new one, which is the trade the ratchet exists to make visible rather than a way to satisfy it."
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
> **Resolved when** `concern_sla_ms` has been registered in
> `hook-latency-budget.json` from repeated readings of the replay-OFF pass on
> the reference runner — not one, for the reason 3.2's evidence records — and
> those values have then been observed across a warn-only window without a
> blocking concern exceeding `sla_ms × 3`. 3.3 then lands the severity-based
> fail-closed switch with the window's readings behind it. The registration is
> carried here rather than under 3.2 because 3.3 is its only consumer and the
> window that validates it is 3.3's own.

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
- [ ] **3.3 Fail closed by severity, after 3.2.** Amend
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

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-30 | reviewer: ai-council-2of2-anthropic-openai -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Fail-closed wedges slow hosts | implementation | A blocking concern at p95 > SLA×3 refuses every call | 3.2 before 3.3; warn-only window; `sla_ms` from the reference runner, not a guess. **Re-reviewed at v3 and it NEARLY FIRED, through a route this row did not anticipate.** The row guards against a *guessed* SLA. The measurement itself was the hazard: the per-concern samples first came from the gated bench, which runs with `AGENT_CONFIG_REPLAY=1`, and replay suppresses the state writes several blocking concerns do most of their work through. A/B, n=25 per cell, 2026-09-30 — `verify-before-complete` live 1249 µs against replay 310 µs (**×4.03**), `run-continuation` ×1.96. An `sla_ms` of 310 µs gives 3.3 a 930 µs bound a concern exceeds on an ordinary run: this row's exact failure, reached by measuring rather than by guessing. Closed by `concernSlaPass`, which measures with replay off. The generalisable form, worth carrying: a harness flag that makes the system cheaper to observe can make the observation wrong, and "we measured it" is not by itself the mitigation this row asks for. | Phase 3 — The dispatcher verifies what it runs |
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
- [ ] AC-3 — After the measured window, a blocking concern that throws or
      exceeds `sla_ms × 3` refuses; an advisory one allows with an issue row.
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
