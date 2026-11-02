---
complexity: structural
status: ready
tree_pin: f4cf5124b4
execution:
  mode: phase-checkpoints
review_by: 2026-12-15
estate_offset_exempt: "Operator asked in the invocation itself (2026-11-02) to process this round's roadmap with /roadmap:process-full in the same PR, so it is archived in the PR that adds it and never sits in the active tree. Owner search at f4cf5124b4 (grep -rlF for provider_home, Claude Code-credentials-, GEMINI_CLI_HOME, sessionList, codexSessionsRoot over agents/roadmaps/*.md, later, stubs) returned nothing."
relates:
  - slug: archive/road-to-reciprocal-ecosystem
    relation: extends
    note: "Delivered agentSwitchProfile.ts, sharedWriteCheck.ts and docs/guides/works-with-agent-switch.md. This continues its line: correct under a profile, no dependency."
  - slug: stubs/road-to-profile-reach-and-account-spikes
    relation: extends
    note: "Carries the owner-run spikes S0-S5, the global-layer reach phase and the Gemini path formula, which need real accounts."
---
# Road to the profile the session runs in

> **Source:** `agents/tmp.old/inbox-2026-11-l/` (transcript + supplied plan, verified at the pin).
> **Arrivals:** 1 — `inbox-2026-11-l` (2026-11-02).
>
> **Owner directive (2026-10-27, supersedes 2026-10-21):** the account tool stays a separate product; AC may use it but never depends on it. The 2026-10-21 plan that had AC replace it was never in the tree (grep over `agents/roadmaps` at the pin: no hit), so there is nothing to archive.

## Goal

AC works under any account profile as correctly as without one: it detects the right login, finds the profile's sessions, and reports which profile a session runs under — whether the account tool set `CLAUDE_CONFIG_DIR` / `CODEX_HOME` or the user did. **AC never switches accounts.**

## Ownership cut

| Task | Owner |
|---|---|
| Add, log in, keep accounts fresh; route by limits; move or rebind sessions; remote/SSH | the account tool |
| Right login, right paths, right session signal **under** the profile | agent-config (this roadmap) |
| Profile signal for external readers | agent-config emits, the account tool reads |

## Defects verified at the pin

| # | Defect | Evidence |
|---|---|---|
| P-1 | Keychain probe always asks the unsuffixed service; Claude Code under `CLAUDE_CONFIG_DIR` uses `Claude Code-credentials-<sha256(NFC(dir))[:8]>` | `environment_detector.ts:252`, `:370` |
| P-2 | Gemini login fixed at `~/.gemini` | `environment_detector.ts:381` |
| P-3 | `CODEX_HOME` pointing at a missing directory reads as "not logged in", doctor advises `codex login` | `environment_detector.ts:209-213`, `cmd_doctor.ts:2402-2406` |
| P-4 | `handoff` reads native sessions only from `~/.claude/projects` and `~/.codex/sessions` — for Codex the only source | `handoff_sessions.ts:272`, `:419` |
| P-5 | Two readers of the same Codex `auth.json` | `environment_detector.ts:335`; `cmd_doctor.ts:2101-2147` |
| P-7 | Session record carries no profile | `session_register.ts:208-253` |
| P-8 | `sessions:list --json` changes shape per flag, no schema version | `sessions_cli.ts:230-236` |
| P-9 | The config-dir resolver is bypassed: 4 files use `claude_config_dir`, 42 hardcoded joins in 33 files | grep below |

P-9 grep: `grep -rnE "(homedir\(\)|home[A-Za-z]*|HOME'\][^,]*)\s*,\s*'\.(claude|codex|gemini)'" src --include='*.ts' | grep -v '\.test\.ts' | grep -v CLAUDE_CONFIG_DIR`

## Phase 1 — One resolver, correct detection

- [x] **1.1 One module for provider homes.** `src/scripts/_lib/provider_home.ts`: `claudeHome(env)`, `codexHome(env)`, `geminiHome(env)` with a source (`env` | `default`). `claude_config_dir` and `environment_detector.codexHome` re-export, never redefine. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/provider_home.ts -->
      verify: `tests/scripts/_lib/provider_home.test.ts` (env set / empty / whitespace / `~`).
- [x] **1.2 P-1 suffixed Keychain service.** Derive the service from the raw `CLAUDE_CONFIG_DIR` (NFC, sha256, 8 hex); unsuffixed only when the variable is empty. Still no `-w`. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/environment_detector.ts -->
      verify: probe stub that only answers the unsuffixed service with env set → no `cli-subscription`; stub that only answers the suffixed one → `cli-subscription`.
- [x] **1.3 P-4 `handoff` through the resolver.** Defaults at `handoff_sessions.ts:272`, `:419` from 1.1. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_cli/handoff_sessions.ts -->
      verify: fixture Codex store under `$CODEX_HOME/sessions` with env set → session listed.
      reach exempt: is_substantive and SUBSTANTIVE_TOKEN_FLOOR are re-exports of _lib/session_eol.ts, which list_handoff_sessions and continuity_writer import by name.
- [x] **1.4 P-3 doctor finding.** `CODEX_HOME` set without a directory → "`CODEX_HOME` points at nothing (<path>)", no `codex login` advice. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_cli/cmd_doctor.ts -->
      verify: doctor test with `CODEX_HOME` set to a missing path → the finding, no login advice.
- [x] **1.5 P-5 one Codex auth reader.** Doctor reuses the detector's reader; return shape stays presence/class/expiry, no field value leaves the module. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/codex_auth.ts -->
      verify: `grep -c "readCodexAuth(" src/scripts/_cli/cmd_doctor.ts` -> /^1$/
- [x] **1.6 P-2 Gemini hint.** Doctor says "`GEMINI_CLI_HOME` is set and not evaluated yet"; the path formula waits for spike S4 (stub). <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_cli/cmd_doctor.ts -->
      verify: doctor test with `GEMINI_CLI_HOME` set → the hint line.
- [x] **1.7 P-9 runtime sites switched and locked.** Runtime paths only (`src/install/`, `src/scripts/_lib/`, `src/scripts/_cli/`, `src/scripts/hooks/`); maintainer measurement scripts stay. A check forbids new `homedir()` + `'.claude'|'.codex'|'.gemini'` joins there outside `provider_home.ts`, with a baseline of the existing sites. <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/provider-home-joins-baseline.json -->
      verify: the check goes red against an inserted line.

**Acceptance:** under `CLAUDE_CONFIG_DIR=<profile>` and `CODEX_HOME=<profile>` the billing class and `handoff` report the profile's login and sessions; the lock check is wired into CI. **Risk:** low — the Keychain formula is a Claude Code internal; on mismatch the probe degrades to "not found", never to "subscription".

## Phase 2 — Session signal for the account tool

- [x] **2.1 Profile in the record.** Optional `profile: { provider, name, via: 'agent-switch' | 'env' }` in `SessionRecord`, derived from the environment only. Absent → the record stays byte-identical. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/session_register.ts -->
      verify: `grep -c 'profile' tests/scripts/session_register.test.ts` -> /^[1-9]/
- [x] **2.2 Stable JSON contract, additive.** `sessions:list --json --schema 1` always prints `{ schema_version: 1, sessions, … }`. The existing shapes stay unchanged (a scripted screen pins the array form). Contract in `docs/contracts/session-list.md`. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/sessions_cli.ts -->
      verify: existing `sessions_cli` tests unchanged, new tests for `--schema 1` with and without `--branches`.
- [x] **2.3 Announce the capability.** `agent-config --version --json` and `/api/v1/ping` name `capabilities.sessionList: 1`, next to `configRoot`. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/shared/capabilities.ts -->
      verify: version/ping test asserts `capabilities.sessionList === 1`.
      reach exempt: buildVersionReadout is imported by src/cli/main.ts for `--version --json`, the CLI entry itself.

**Acceptance:** two sessions under two profiles appear in `sessions:list --json` with `profile`; `--schema 1` gives one object form with and without `--branches`.

## Phase 3 — Docs

- [x] **3.1** `docs/guides/works-with-agent-switch.md`: "What AC guarantees under a profile" and "What AC never does" (kill register). <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: .github/workflows/rule-backstops.yml -->
      verify: `grep -c '^## What AC never does' docs/guides/works-with-agent-switch.md` -> /^1$/
- [x] **3.2** Remote / Superset: point at the account tool's own CLI as the agent command, no AC snippet. <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: .github/workflows/rule-backstops.yml -->
      verify: `grep -c 'agent-switch run <name>' docs/guides/works-with-agent-switch.md` -> /^1$/

## Kill register

| # | Not in AC | Reason |
|---|---|---|
| K1 | account verb, account store, login flows | the account tool owns them; two writers on one profile tree |
| K2 | moving a session to another account | the account tool does it for Claude and Codex |
| K3 | adopting `~/.agent-switch`, uninstalling the account tool | directive 2026-10-27 |
| K4 | automatic switching, limit routing | the account tool's orchestrator |
| K5 | a daemon for accounts | AC runs inside a session, not above it |
| K6 | reading Codex identity from tokens | no consumer after K1; 1.5 shrinks the surface |
| K7 | writing into profile trees or the share manifest | `works-with-agent-switch.md` § 2 |
| K8 | a hard dependency on the account tool | every phase also holds for manually set env vars |
| K9 | a Superset adapter in AC | configuration, or the account tool's |

## Decisions

| # | Decision | Resolved by |
|---|---|---|
| D1 | Drop the 2026-10-21 account-writer plan | owner, 2026-10-27 (transcript turn 1); nothing to archive |
| D2 | Array form of `sessions:list --json` stays; schema 1 is additive only | tree evidence: `sessions_cli.ts:230-232` pins it |
| D3 | Global-layer reach (old P-6) and `kind`/`parent` wait for spikes S2/S3/S5 | carried to the stub, not guessed |
| D4 | The second supplied plan (headless runtime, GUI, multi-host) is the account tool's backlog, not AC work | owner directive 2026-10-27; K8 |
