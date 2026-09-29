---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "lane 2 of road-to-leading-every-row; the set's offset is lane 1's in-diff supersession"
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

> **BLOCKED — all three steps, 2026-09-29.** Not for lack of a design: the
> blocker is that 3.3 cannot be closed by any amount of code, and 3.1 and 3.2
> are its prerequisites rather than independent work.
>
> **3.3 requires an elapsed measurement window.** Its own text says
> "warn-only for the first measured window, then deny", and Risk 1 of this
> file's register is the reason — a blocking concern whose SLA was guessed
> refuses every call on a slow host. A window that has not elapsed cannot be
> declared elapsed by the session that wants to flip the switch.
>
> **3.2 requires the REFERENCE RUNNER, not this machine.** It writes `sla_ms`
> per blocking concern "from the measured p95 on the reference runner", and the
> hook-latency baseline already carries the note that a locally recorded darwin
> baseline broke the regression gate once. A p95 measured here would be the
> guessed number Risk 1 names, wearing a measurement's clothes.
>
> **3.1 is buildable and was deliberately not built here.** It edits the hot
> path of every dispatch, and landing it in the same change as Phases 1, 2 and 4
> — which touch three governance surfaces and already carry a ratification —
> would put the riskiest edit in the tree behind the largest diff. It is left
> for its own change, where its own review can be about it.
>
> **Resolved when** 3.2 has a reference-runner reading, 3.1 lands on its own,
> and 3.3's warn-only window has actually elapsed.

- [ ] **3.1 Bundle integrity once per session, cached.** `build:hooks` writes
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
- [ ] **3.2 Measure per-concern p95 before any flip (D3).** Extend
      `bench_hook_latency.ts` to report p95 per concern (today per slot,
      `hook-latency-budget.json`); write `sla_ms` per blocking concern into
      the budget file from the measured p95 on the reference runner.
      verify: report lists all 8 blocking concerns with p95 and `sla_ms`; a
      concern the bench could not time prints `not_measured`, never `0`.
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
<!-- risk-review: v1 | reviewed: 2026-09-29 | reviewer: ai-council-2of2-anthropic-openai -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Fail-closed wedges slow hosts | implementation | A blocking concern at p95 > SLA×3 refuses every call | 3.2 before 3.3; warn-only window; `sla_ms` from the reference runner, not a guess. **Re-reviewed at v2: NOT yet live.** Phase 3 did not land, and this risk is the reason its blocker is worded as an elapsed window rather than as remaining work — a session that wants to flip the switch cannot also declare the window elapsed. | Phase 3 — The dispatcher verifies what it runs |
| 2 | Ratification gate blocks routine plumbing maintenance | implementation | Every manifest edit needs an artifact | That is the ADR-268 mechanism already applied to kernel rules; `ratification-policy.json` quorum is the owner's dial. **Re-reviewed at v2 and now LIVE — 1.1 has landed.** Both council seats were asked directly whether the friction needs a carve-out before it ships and both declined: these are governance-bearing sources and the existing mechanism fits. Recorded because the question was put and answered, not assumed. | Phase 1 — One mechanism per file class |
| 3 | Bundle hash stale after a consumer rebuild | implementation | `dispatch.sha256` not rewritten | Written by the same build step; `src/scripts/prepack-check.mjs` refuses a bundle without its sidecar | Phase 3 — The dispatcher verifies what it runs |
| 4 | A guard resolves a different package root from the one it runs in | implementation | Added at the v2 review, because it ALREADY HAPPENED rather than being foreseen: the Class C fence resolved its class contract with a fixed `..` hop count, which is correct only in the source tree. Inlined into `dist/hooks/dispatch.js` every module shares the BUNDLE's `import.meta.url`, so the same expression lands somewhere else — the guard reads the wrong contract, or none, and then fails closed on every settings edit in a consumer install. The failure is silent in this repository, where the hop count happens to be right. | `findPackageRoot` walks up to the nearest directory that actually CARRIES the contract and returns `null` rather than a default root, answering the question the guard is asking instead of a proxy for it. Two tests pin both directions, and a packaging regression test pins the contract in `files[]` — because the fence is only reachable in a consumer while it ships. | Phase 2 — Settings: keys, not files (D4) |
| 5 | A gate counts a file it could not read as one it cleared | implementation | Also added at v2 from a real finding, not a forecast: `lint_exit_codes` skipped an unreadable file and then marked it complete, producing a green with a file count behind it that overstated what was examined. This is the shape `assertScanned` refuses at the corpus level, reappearing one level down inside the loop — where nothing was watching for it. | Unreadable files are named and the gate exits 2. Probed against a `chmod 000` fixture rather than asserted. The generalisable form, worth carrying to the next gate: a per-file `continue` in a scanning loop is a silent scope reduction unless the skipped file is counted somewhere. | Phase 4 — One exit-code table |

## Acceptance Criteria

- [x] AC-1 — An unratified diff to `hook_manifest.yaml`, `host_lowering.yaml`
      or a budget file fails CI; a hand edit to `dist/hooks/dispatch.js` or
      `hooks/hooks.json` is refused at tool-call time.
<!-- AC-2 and AC-3 belong to Phase 3, which is blocked above; they stay open
     for the reasons recorded there, not for lack of an attempt. -->
- [ ] AC-2 — A one-byte change to the built bundle refuses the next
      blocking-slot dispatch; the per-dispatch cost is a stat call.
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
