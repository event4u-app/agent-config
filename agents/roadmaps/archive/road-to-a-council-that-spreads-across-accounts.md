---
complexity: structural
status: active
tree_pin: 23d66791da
execution:
  mode: phase-checkpoints
entry_condition:
  what: an active roadmap closes, so this one fits under the WIP limit of five
  when: at the next active-roadmap closure
  who: agent
review_by: 2027-02-04
estate_offset_exempt: >-
  Carries the owner's 2026-11-04 request (council runs on one Codex account); no active roadmap
  owns the finding, so merging into one was not available, and it is parked rather than active
  because the WIP limit is full. Owner search: a grep over agents/roadmaps/{*,later,stubs} for
  CODEX_HOME, "agent-switch dir" and council seat/account wording finds only CODEX_HOME isolation
  spikes (road-to-profile-reach-and-account-spikes, road-to-host-primitive-lowering), not seat
  account selection.
estate_growth_exempt: Parked carrier of the owner's 2026-11-04 request; adds one later roadmap, no active one.
relates:
  - slug: road-to-reciprocal-ecosystem
    relation: extends
    note: "Archived parent: taught AC to DETECT an agent-switch profile (src/install/agentSwitchProfile.ts). This makes AC's own CLI spawns USE agent-switch's account resolution."
---
# Road to a council that spreads across accounts

> **Unparked 2026-11-04** on the owner's explicit `/roadmap:process-full`
> request; executed and closed in the same change.
>
> **Source:** owner report 2026-11-04 — a council run used the Codex CLI on one
> account only, while agent-switch held two signed-in Codex accounts
> (`codex/Matze1`, `codex/Matze2`) with headroom.

## Goal

Every vendor-CLI seat AC spawns (council members, `ai_team`, bench runners)
starts on the account agent-switch would pick for that start — balanced by
headroom, honouring folder rules — and a seat that hits a usage limit retries
once on a different account. With agent-switch absent, behaviour is exactly as
at the pin.

## Context (verified at the pin, do not relitigate)

- The council's Codex seat runs `codex exec --json -` via `spawnSync`
  (`src/scripts/ai_council/clients.ts:1337`) with
  `env: withoutUngrantedCredentials(hardenedSpawnEnv({...}))`
  (`clients.ts:1322`). `hardenedSpawnEnv` copies `process.env` minus a deny list
  and applies overrides (`src/scripts/_lib/spawn_env.ts:140-154`); nothing sets
  `CODEX_HOME` or `CLAUDE_CONFIG_DIR`.
- So a seat inherits whatever the parent had. Run from a Claude session, the
  parent has no `CODEX_HOME` → every Codex seat lands on `~/.codex`, the default
  login. Run from a Codex session, every seat lands on that session's account.
  Either way: one account, every time.
- agent-switch's account choice lives in its **shell wrapper function**
  (`agent-switch shellenv`), which calls `agent-switch dir --provider <p> --guard`
  and exports the env var. A subprocess never runs a shell function, so the
  wrapper never fires for AC's spawns.
- agent-switch offers two non-shell entry points:
  - `agent-switch dir --provider <p> --json [--plain] [--exclude a,b]` →
    `{profile, configDir, why[], blocked?, note?}`; exit `86` when a folder rule
    cannot be served. `dir --json` ships in 2.11.0; `--exclude` ships with the
    next release.
  - `agent-switch exec --provider <p> [--exclude a,b] [--plain] -- <args…>` —
    resolves like `dir`, records the pick, runs the binary with the env var set,
    passes stdio and the exit code through. Comes with agent-switch PR #148 / #149.
- `src/install/agentSwitchProfile.ts` already detects "running under an
  agent-switch profile" from the env, but nothing consumes it for spawns.

## Phase 0 — Reproduce

- [x] **0.1 Evidence of the single account.** A fixture spawn through the same <!-- receipt: class=R1 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=test-only change -->
      env path as `clients.ts:1322` with a stub `codex` that prints
      `$CODEX_HOME`; parent env without `CODEX_HOME`.
      verify: the stub reports an empty `CODEX_HOME` (default login) — the
      failure this roadmap removes, red before Phase 1.

## Phase 1 — Resolve the account per spawn

- [x] **1.1 A resolver seam.** `src/scripts/_lib/agent_switch_account.ts`: <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/agent_switch_account.ts -->
      `resolveSeatHome(vendor, {exclude, cwd})` → `{envVar, dir, profile} | null`.
      Calls `agent-switch dir --provider <codex|claude> --json` (5 s timeout),
      returns null when the binary is missing, the call fails, the JSON has no
      `configDir`, or the vendor has no agent-switch provider. Exit `86` (folder
      rule cannot be served) is surfaced as a seat error naming the rule, never
      silently replaced by the default login.
      verify: unit tests with an injected runner — missing binary → null;
      `{configDir}` → env var set; exit 86 → typed refusal; malformed JSON → null.
- [x] **1.2 Wire it into the CLI seat spawn.** In the builder that produces the <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/agent_switch_account.ts -->
      spawn env (`clients.ts` ~1322), add `{[envVar]: dir}` to the
      `hardenedSpawnEnv` overrides when the resolver returns one. An env var the
      **user** set explicitly for the seat in `.ai-council.yml` wins over the
      resolver (owner config beats balancing). Same for the `claude` CLI seat
      (`CLAUDE_CONFIG_DIR`).
      verify: the Phase 0 fixture now reports the resolved dir; with the
      resolver returning null it still reports the inherited value.
- [x] **1.3 Record which account served.** The seat's journal / events-log row <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/agent_switch_account.ts -->
      carries `account: "codex/<name>"` (profile name only — never a path
      component beyond it, never a token). Absent when unresolved.
      verify: an events-log fixture shows the field; a privacy test asserts no
      `configDir` path is written.
- [x] **1.4 Folder rules — decide, then implement.** Default: respect them <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/agent_switch_account.ts -->
      (call `dir` from the project cwd, no `--plain`) — a project pinned to a
      work account must not spill council traffic onto a private one. Offer
      `council.agent_switch: rules | balance | off` (class A, default `rules`).
      verify: a unit test shows the resolver called with --plain under the balance
      value and not called at all under off.

## Phase 2 — Move on when a seat hits a limit

- [x] **2.1 Classify the limit error.** Codex `usage_limit_reached` / HTTP 429 <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/agent_switch_account.ts -->
      in the `--json` event stream, Claude "usage limit reached" — one typed
      `SeatLimitReached` with the profile that served.
      verify: fixtures of both vendors' real error lines classify; an ordinary
      failure does not.
- [x] **2.2 One retry on another account.** On `SeatLimitReached` with a <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/agent_switch_account.ts -->
      resolved profile, re-resolve with `--exclude <that profile>` (needs the
      agent-switch release that ships `--exclude`; older versions → no retry,
      reported as such) and re-run the seat once. Bounded: one retry per seat
      per round, never a loop.
      verify: a fake runner that limits on account A and succeeds on B yields
      B's answer and two journal rows; when no other account exists the seat
      fails with the original limit error.

## Phase 3 — Spread parallel seats

- [x] **3.1 Exclude accounts already serving this round.** When a round spawns <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/agent_switch_account.ts -->
      several seats of one vendor, pass the profiles already assigned in this
      round as `--exclude`, so they spread while free accounts exist; once none
      is left, fall back to the unexcluded pick (share, never fail).
      verify: two Codex seats with two accounts land on two accounts; three
      seats with two accounts land on both, the third shared.

## Phase 4 — Say it out loud

- [x] **4.1 `council:status` names the account source.** One line per CLI <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/agent_switch_account.ts -->
      vendor: "codex seats: agent-switch (2 accounts)" / "default login
      (agent-switch not found)".
      verify: status snapshot for both cases.
- [x] **4.2 Docs.** The council doc states that CLI seats follow agent-switch's <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      pick when it is installed, how folder rules apply, and the retry rule.
      verify: the doc names `dir --json`, the `council.agent_switch` key and the
      one-retry bound.

## Decisions

| id | decision | why | revisit if |
|---|---|---|---|
| D1 (1.4) | The mode key lives in `.ai-council.yml` as top-level `agent_switch:`, not in `.agent-settings.yml` | Council config is user-global and never lives in `.agent-settings.yml` (ADR-104); a council key there would split one config across two files | a non-council CLI consumer needs its own mode |
| D2 (1.2) | "An env var the user set for the seat wins" maps to `agent_switch: off` and the `AGENT_CONFIG_AGENT_SWITCH` env override | `.ai-council.yml` has no per-seat env block; adding one is scope this roadmap did not plan | someone needs different accounts per seat of one vendor |
| D3 (2.2) | A limit refusal is recognised on codex's `turn.failed` too, not only on a non-zero exit | codex exits 0 on a refused turn (contract § Quota exhaustion), so an exit-only check would never retry the case the owner reported | — |
| D4 (0.1) | The Phase 0 fixture went red by neutralising the env wiring after implementation, not before it | the seam the fixture needs is the one Phase 1 builds; 5 of 20 cases failed with the wiring removed, which is the sensitivity proof | — |

## Out of scope

- Writing any credential or login: AC only chooses an existing config dir.
- Antigravity / Gemini seats — no agent-switch provider env for them in AC yet.
- Switching to `agent-switch exec` as the spawn binary: possible once the
  release with `exec` is the floor; `dir --json` keeps the account observable
  for 1.3 and works from 2.11.0.
