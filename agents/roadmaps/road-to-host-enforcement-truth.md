---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_growth_exempt: "Third round on the same subject; the two earlier rounds produced prose corrections that this roadmap replaces with one table and one expiry field, so it exists to stop the recurrence rather than to add a surface."
estate_offset_exempt: "Offsets nothing — the estate holds one roadmap and zero ready at HEAD, so no swap candidate is displaced."
---
# Road to host enforcement truth

> **Source:** `agents/tmp.old/inbox-2026-09-i/` — verified against the tree at 5c539505d on 2026-09-05.

## Goal

Every statement this package makes about which host can enforce a hook decision is either backed by a row in one table, or is absent. Today six surfaces assert that one host "has no hook surface" and four assert a CLI limitation, none of those assertions carries an expiry, five hand-written binding constants disagree with the one generated bridge, and the `hooks:status` a consumer runs points them at a file deleted with the Python retirement. When this is done a reader can ask "can host H enforce decision D?" and get an answer from `host_lowering.yaml` with the date it was established and the date it expires, and no prose anywhere contradicts it. Prevented work, already shipped and therefore absent from the phases below: the in-process concern dispatcher, the `hooks:doctor/effect/status/replay/install` verb set, `check_enforcement_coverage --json`, the injection budget and emission-shaping rules, typed payload dependencies via `needs_payload_bodies`, and the probe-state model in `hook_effect_doctor` — six items the drafts planned that the tree already holds. Two draft figures were wrong and are not carried: the concern count is 56 rather than 72, and the estate is 1 rather than 8. Out of scope by decision: any policy-evaluation runtime, any event-vocabulary rename, and any promotion of a host to blocking enforcement.

## Phase 1 — Say what is true today

- [ ] **1.1 Rewrite the Copilot hook-surface claim at all six sites, not four.** `src/scripts/hook_manifest.yaml:629` and `:1322-1325`, `docs/enforcement-by-host.md:24`, `docs/contracts/host-tool-vocabulary.md:52`, `docs/contracts/hook-architecture-v1.md:424` and `:539-541`, `src/rules/autonomous-execution.md:70`, `src/rules/git-history-discipline.md:89` and `:91`. Each currently asserts the host carries no hook surface at all; the honest statement this tree can make is that this package binds nothing there and has measured nothing there. Neither rule is a kernel rule, so no slow-rollout gate applies. Tagged `corrected-from-reproduction` — the drafts counted four surfaces and the grep at HEAD returns six.
      verify: `grep -rn "no hook surface\|has no pre-tool surface" src/ docs/` returns zero lines that assert host incapability rather than package non-binding.
- [ ] **1.2 Remove the retired Python paths from user-visible output.** `src/scripts/hooks_status.ts:61-70` prints "hint: run src/scripts/install.py" for six hosts and its trailer at `:187` prints "Source of truth: scripts/hook_manifest.yaml"; `src/scripts/install.ts:2625` returns the string `src/scripts/install.py (self)`; `src/scripts/hook_manifest.yaml:2-5` names two `.py` consumers. None of those files has existed since the TypeScript port.
      verify: `./agent-config hooks:status | grep -c "install.py"` returns 0, and `grep -rn "install\.py\|dispatch_hook\.py" src/ --include=*.ts --include=*.yaml` returns only historical-note lines that say the file was retired.
- [ ] **1.3 Strike the false comment in the Cursor trampoline.** `src/scripts/hooks/cursor-dispatcher.sh:23-26` states "none of our concerns block"; the manifest carries eight `severity: blocking` concerns.
      verify: the comment names the actual state (concerns that would block are not bound on this host) and `grep -c "severity: blocking" src/scripts/hook_manifest.yaml` matches the number the comment cites.
- [ ] **1.4 Make the install smoke probe read the constant the installer writes.** `src/scripts/install.ts:1730` probes `['cursor','beforeShellExecution']`, an event `CURSOR_DISPATCHER_BINDINGS` (`:1133-1139`) never writes, so the probe cannot fail on a real regression.
      verify: a test that removes one entry from `CURSOR_DISPATCHER_BINDINGS` makes the smoke probe fail; the probe list contains no event absent from the constant.

## Phase 2 — One table instead of five constants

- [ ] **2.1 Add `src/scripts/hooks/host_lowering.yaml`, keyed `(host, surface, slot)`.** Columns: `block_exit`, `json_shape`, `entry_shape`, `fail_policy`, `timeout_unit`, `timeout_default`, and `verified: {docs_at, docs_url, probe_at, host_version, expires}`. Claude rows are transcribed from the behaviour `host_semantics.ts` implements today, so the table starts as a description, not a proposal. Every other host starts `verified: null`, which is the honest reading of `VERIFIED_PLATFORMS = {"claude"}` at `host_semantics.ts:54`.
      verify: `host_semantics.ts` reads `VERIFIED_PLATFORMS`, `isBlockCapable` and the emission shape from the table, and the Claude hook matrix generated from it is byte-identical to the one at HEAD.
- [ ] **2.2 Collapse the five `*_DISPATCHER_BINDINGS` constants into the table.** `src/scripts/install.ts:1025, 1133, 1203, 1310, 1384` each hold a private binding list; only Claude's bridge is generated (`claude_settings_hooks.ts:92`). Generalize that generator to read the manifest plus the table for every host and delete the five constants.
      verify: the five constant names return zero hits under `grep -rn "_DISPATCHER_BINDINGS" src/`, and golden files for each host bridge are unchanged from the pre-change output.
- [ ] **2.3 Add `surface` as an envelope field, not a platform key.** `src/scripts/_lib/session_register.ts:180` states the capability lattice has no IDE/CLI dimension; the table above is keyed on one. Detect it from payload and environment, default `unknown`, and record it in the journal. `--platform` and the eight platform identifiers stay exactly as they are.
      verify: a fixture payload carrying a background-agent marker resolves `surface: cloud`, an unmarked payload resolves `surface: unknown`, and `agent-config hooks:status` output for a known host is otherwise unchanged.

## Phase 3 — Facts that expire

- [ ] **3.1 Add an expiry to every host-capability fact.** `src/agent-src/contexts/execution/host-capability-manifest.md` requires a four-part citation (host, version, artefact, date) and no expiry — `grep -n "expir\|stale\|review_by\|lease"` over its 187 lines returns nothing. That absence is why the same stale claims returned across three rounds. Add the field to the observation protocol and to the `verified:` block from 2.1.
      verify: the context file specifies the field, and a table row whose `expires` is in the past is reported by the lint below.
- [ ] **3.2 Degrade an expired row to unverified.** A row past `expires` is treated exactly as `verified: null`: it cannot carry a blocking binding, and the lint names the row, the date and the re-establishment step.
      verify: a fixture row with `expires` set to yesterday and a blocking binding attached makes `lint_hook_manifest` exit non-zero with a message naming that row; the same row without a blocking binding warns and passes.
- [ ] **3.3 Re-establish or retire the Cursor CLI limitation claim.** `agents/settings/contexts/chat-history-platform-hooks.md:31, :214, :277` and `src/scripts/_lib/session_register.ts:178-180` assert the CLI fires only shell-execution hooks, sourced "as of 2026-01". This round could not verify the claim in either direction offline. Either attach a current four-part citation with an expiry, or replace the assertion with the package-side fact (this package binds no per-turn slot on that surface).
      verify: no line in those four locations asserts a host limitation without a citation carrying a date and an `expires`.

## Phase 4 — Prove the double-fire before guarding it

- [ ] **4.1 Measure whether a second host actually executes the Claude-shaped hook entry.** The drafts treat cross-loading as established; this round confirmed only the tree-side half — no environment guard exists anywhere in `src/` — and could not verify the host-side half. Record one observation per host: install into a scratch project, run one turn under the other host, and read the dispatcher journal for two entries with the same session and different platform tags. Tagged `corrected-from-reproduction`.
      verify: an evidence file records, per host, host version, date, and whether two journal entries appeared for one turn.
- [ ] **4.2 Add the guard only for hosts where 4.1 observed a second firing.** The insertion point is the single concatenated command string at `src/scripts/_lib/claude_settings_hooks.ts:136-149`; the guard is one leading clause, not a block. Tagged `corrected-from-reproduction` — the draft budgeted ten lines for a one-line change and asked for the PR before the measurement.
      verify: for each host 4.1 confirmed, a golden file shows the guard clause in the emitted command and a fixture with that host's environment variable set exits 0 before dispatch; for hosts 4.1 did not confirm, no guard is emitted.

## Blockers

### blocker: copilot-enforcement-promotion

- **Status:** open
- **Owner:** maintainer
- **Blocks:** nothing in this roadmap — it gates work deliberately excluded from it.
- **Recommendation:** run the live deny probe against a real Copilot installation before ever considering promotion; until it passes cleanly, Copilot stays advisory-only, which is the safe default this roadmap already ships.
- **If you do nothing:** Copilot stays advisory-only — the safe status quo — and the risk that a dispatcher crash reads as *deny* and locks every tool call is never tested, but also never triggered.
- **What to do:**
  1. Stand up a scratch workspace on a real Copilot installation and add one dedicated hook that always denies.
  2. Run the probe: confirm the marker file it tries to create does not exist, and that the deny reason surfaced to the user; record host version, date and outcome in `host_lowering.yaml`'s `verified` field (Phase 2.1).
- **Resolved when:** a live deny probe on a real Copilot installation is recorded (host version + date) in `host_lowering.yaml`'s `verified` field, confirming the marker never appears and the deny reason surfaces — or the owner records a decision not to pursue promotion.

Promoting any host to blocking enforcement requires a live deny probe on that host — a scratch workspace, a marker file the probe tries to create, a dedicated hook that denies, and confirmation that the marker does not exist and the reason arrived. For the Copilot surface specifically, the failure mode of getting it wrong is that a dispatcher crash reads as *deny* and locks every tool call, because that host's pre-tool hook treats any non-zero exit as a denial. The probe must run on a real installation of that host, which no step in this roadmap can perform. Phases 1–4 deliberately add no blocking binding on any host; this blocker records why, and what would lift it.

### blocker: gemini-exit-semantics-unverified

- **Status:** open
- **Owner:** maintainer
- **Blocks:** nothing in this roadmap — it gates work deliberately excluded from it.
- **Recommendation:** run the same live deny-probe pattern against a real Gemini CLI installation once host access is available; until then `verified: null` is the correct and honest state, not a gap to rush.
- **If you do nothing:** Gemini keeps the legacy exit-code pass-through with `verified: null` in `host_lowering.yaml`, and its alias row keeps six entries with no compaction alias — honest, but no capability claim can be made for it.
- **What to do:**
  1. When real Gemini CLI access becomes available, run the same scratch-workspace / marker-file / denying-hook probe described for Copilot above.
  2. Record host version, date and outcome in `host_lowering.yaml`'s `verified` field for the Gemini rows; leave `verified: null` until then.
- **Resolved when:** a live probe on a real Gemini CLI installation is recorded (host version + date) in `host_lowering.yaml`'s `verified` field — or the owner records a decision not to pursue verification.

Gemini is absent from `VERIFIED_PLATFORMS` (`src/scripts/hooks/host_semantics.ts:54`) and therefore receives the legacy exit-code pass-through, and its alias row (`src/scripts/hook_manifest.yaml:1399-1405`) carries six entries with no compaction alias. Phase 2.1 gives it a `verified: null` row, which is honest but not useful. Establishing a real row needs the same live probe as the blocker above.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-05 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Table-driving `host_semantics` changes Claude behaviour | implementation | The one host that currently enforces is the one whose emitter is being refactored; a transcription error silently downgrades real enforcement to advisory. | Claude rows are transcribed from existing behaviour and gated on byte-identical generated output before the constants are deleted. | Phase 2 — One table instead of five constants |
| 2 | Expiry turns green CI red on a date nobody chose | implementation | Rows expiring on a working day can block an unrelated PR. | 3.2 fails only where a blocking binding rests on the expired row; every other expiry warns. | Phase 3 — Facts that expire |
| 3 | The unverified cross-load claim drives an unnecessary guard | implementation | Emitting an environment guard for a host that never double-fires adds a silent early exit to the enforcing host's own command string. | 4.2 emits a guard only for hosts where 4.1 recorded an actual second firing. | Phase 4 — Prove the double-fire before guarding it |
| 4 | Correcting six surfaces weakens a claim a reader relies on | product | Two of the six are behavioural rules whose current wording tells the agent that a guard cannot bind on a host; a looser rewrite could read as permission. | 1.1 replaces host-incapability wording with package-non-binding wording, which is strictly narrower, and the verify grep asserts that direction. | Phase 1 — Say what is true today |
| 5 | The subject returns a fourth time | product | Two prior rounds produced prose corrections and no table; a third prose-only pass would repeat that. | Phase 3 is the structural answer — a fact without an expiry cannot be relied on — and Phase 2's table is the single place a future round reads. | Phase 3 — Facts that expire |

## Acceptance Criteria

- [ ] AC-1 — No file under `src/` or `docs/` asserts that a host lacks a hook capability; every such statement is either a package-non-binding statement or a table row carrying a citation and an expiry.
- [ ] AC-2 — `agent-config hooks:status` names no retired file path and no path that does not resolve from the repository root.
- [ ] AC-3 — `src/scripts/hooks/host_lowering.yaml` is the only place a host's block-exit, emission shape and fail policy are written, and `grep -rn "_DISPATCHER_BINDINGS" src/` returns zero hits.
- [ ] AC-4 — Every generated host bridge is byte-identical to its pre-change golden file.
- [ ] AC-5 — A host-capability row past its `expires` cannot carry a blocking binding, and the lint that enforces this fails on a fixture row and passes at HEAD.
- [ ] AC-6 — The install smoke probe fails when an entry is removed from the constant that writes the bridge.
- [ ] AC-7 — No host gained a blocking binding in this roadmap; `VERIFIED_PLATFORMS` still resolves to the same single host it resolved to at 93d63073e.
