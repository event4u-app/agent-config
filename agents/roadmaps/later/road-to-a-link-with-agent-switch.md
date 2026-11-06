---
complexity: structural
status: ready
tree_pin: 84ec63c93d
execution:
  mode: phase-checkpoints
review_by: 2026-12-31
estate_growth_exempt: "+1 later_roadmaps, +1 open_blockers, owner-directed 2026-11-05 (\"eine roadmap in ac anlegen und mergen\"; agents/evidence/owner-directives/2026-11-05-agent-switch-link.md): parked in later/ because the active estate is at the WIP cap of 5; its one blocker is agent-switch shipping contract v1."
estate_offset_exempt: "New work requested by the owner, agents/evidence/owner-directives/2026-11-05-agent-switch-link.md; no parked or active roadmap covers an agent-switch link (grep -rlF for 'mcp serve', 'switch_request', 'agent-switch link' over agents/roadmaps, later, stubs at 84ec63c93d returned nothing), so nothing is archived to offset it."
entry_condition:
  what: "agent-switch ships `mcp serve`, `limits --json` and `switch … --json` (contract v1) on its 2.x line"
  when: "the agent-switch release carrying road-to-the-agent-config-link phases 1–2"
  who: "owner"
relates:
  - slug: road-to-a-council-that-spreads-across-accounts
    relation: extends
    note: "Its per-seat `agent-switch dir` pick gains a limits pre-check; the pick itself stays agent-switch's."
  - slug: road-to-the-profile-the-session-runs-in
    relation: refines
    note: "K2/K4/K5/K8 stay: AC never moves a session, never switches automatically, runs no daemon, never depends on agent-switch."
  - slug: road-to-a-limit-the-host-actually-signals
    relation: disjoint
    note: "Owns host-signal observation; this reads limits from agent-switch instead."
---
# Road to a link with agent-switch

> **Source:** owner directive
> `agents/evidence/owner-directives/2026-11-05-agent-switch-link.md`.
> **Counterpart:** roadmap `road-to-the-agent-config-link` in
> `event4u-app/agent-switch`.

## Goal

When a session nears its plan limit, the user is told in-session and asked
whether to move; the same question is open in agent-switch. Answered in either
tool, it is answered in both, and agent-switch performs the move. AC also reads
every account's limits from agent-switch and uses them to place council and
judge-bracket seats. At the pin AC has no MCP client, the quota ledger carries no
account, and nothing models a two-way decision.

## Fences — what stays (mechanism-match)

The archived fences forbid AC from **moving** sessions (K2), **switching
automatically or routing by limits** (K4), running an account daemon (K5) and
**depending** on agent-switch (K8), and the limit stub keeps "no multi-account
routing, no unattended relaunch". This roadmap moves nothing, decides no target
on its own, and degrades when agent-switch is absent: agent-switch keeps the
routing and the move; AC reads, asks and relays. The unattended-spawn refusal
(`headless_invocation.ts` `LIVE_SPAWN_REFUSAL`) is not reopened.

## Phase 1 — Contract

- [ ] **1.1 `docs/contracts/agent-switch-link.md`.** Tools, JSON shapes
      (`limits_get`, `switch_*`, `session_whoami`, `link_status`), request
      states, first-decision-wins, contract version `1`, and the absence rules.
      verify: `./scripts-run src/scripts/check_references` -> 0
- [ ] **1.2 Guide update.** `docs/guides/works-with-agent-switch.md` § "What AC
      never does" keeps moving/automatic switching and adds what AC now does
      (read limits, ask, relay).
      verify: `./scripts-run src/scripts/check_references` -> 0

## Phase 2 — Automatic connection

- [ ] **2.1 Link probe.** `_lib/agent_switch_link.ts` `linkStatus()`: runs
      `agent-switch link status --json` (5 s timeout); absent binary, exit ≠ 0
      or `enabled:false` → `null`.
      verify: unit tests for present / disabled / missing / garbled output.
- [ ] **2.2 MCP entry.** Next to `mcpBridgeEntry`, an `agent-switch` entry
      (`{command:"agent-switch", args:["mcp","serve"]}`) written into
      `.mcp.json` by install when the probe is enabled, removed when it is not;
      recorded in `installed-tools.lock`.
      verify: install tests: enabled → entry; disabled → removed; absent → untouched.
- [ ] **2.3 MCP client.** `agentSwitchCall(tool, args)`: SDK stdio client
      (lazy, like `mcp_server/server.ts`), falling back to the CLI `--json`
      verbs, returning `null` on any failure. Fix the stale "SDK is NOT a
      dependency" comment at `mcp_server/server.ts:28`.
      verify: tests with a fake server and with the CLI fallback.
- [ ] **2.4 `mcp:available` / doctor row** showing the link state.
      verify: `tests/scripts/cmd_mcp_available.test.ts`.

## Phase 3 — Limits that know their account

- [ ] **3.1 Account on snapshots.** `quota_ledger.ts` gains optional
      `account` (from `agentSwitchProfile`), so two logins no longer share one
      pressure verdict; `pressure.ts` classifies per account.
      verify: ledger/pressure tests with two accounts interleaved.
- [ ] **3.2 Limits read.** `agentSwitchLimits()` via the client; stale or
      absent → `null`, never a guess.
      verify: unit tests.

## Phase 4 — Inform and ask

- [ ] **4.1 Raise.** At `hot`, `quota-notice` calls `switch_request` for the
      session's account and names the request in the notice: targets, and that
      the user can answer here or in agent-switch.
      verify: hook tests: hot + link → one request, one notice; no link → today's notice.
- [ ] **4.2 Decide in-session.** The notice tells the agent the request id; on
      the user's answer the agent calls `switch_decide`, which the host
      confirms with the user (never auto-allowed; checked by
      `lint_mcp_config_security`).
      verify: lint test rejecting an auto-allow entry for `switch_decide`.
- [ ] **4.3 Relay a decision from agent-switch.** On the next prompt, a request
      decided in agent-switch is reported once ("moving after this turn to …"),
      and its outcome once when `done|failed`.
      verify: hook tests over fixture request states.
- [ ] **4.4 Hand the work over.** Before an approved move, write the run
      checkpoint / handoff brief so the target session resumes the step.
      verify: test that an approved request triggers one checkpoint write.

## Phase 5 — Load distribution

- [ ] **5.1 Council seats.** `resolveSeatHome` / `resolveRoundSeatHome`
      exclude accounts the limits read marks unusable before spawning, instead
      of only retrying after a limit error; the account changes, the model of a
      seat never does.
      verify: seat-account tests with a limits fixture.
- [ ] **5.2 Necessity pressure.** `ratePressure` at `council_cli.ts:1859` also
      reads "every account of this provider hot" from the limits read.
      verify: necessity test.
- [ ] **5.3 Judge bracket.** `bracket/seats.ts` skips subscription seats whose
      provider has no usable account.
      verify: bracket seat tests.

## Decisions

| # | Decision | Class |
|---|---|---|
| D1 | No automatic move; the user decides, in either tool | owner, 2026-11-05 |
| D2 | agent-switch executes; AC reads, asks, relays | owner + fences K2/K4 |
| D3 | Connection is automatic, switched off only in agent-switch | owner |
| D4 | Seat account may change on limits; seat model never does | council 2026-11-05 (openai), host verdict accept |

revisit-if: agent-switch drops contract v1, or a host offers its own
cross-account continuation.

## Risk Register

| Risk | Mitigation |
|---|---|
| Agent decides without the user | `switch_decide` is host-confirmed; lint forbids auto-allow |
| Stale limits route a seat badly | Observations carry `stale`; stale reads count as `null` |
| agent-switch absent or link off | Every path returns `null` → today's behaviour (K8) |
| Notice noise | One request per `(account, window, resets_at)`, dedup in agent-switch |

## Blockers

### blocker: agent-switch-contract-v1
- what: agent-switch has no `mcp serve`, `limits --json` or `switch` verbs yet
- evidence: `event4u-app/agent-switch` `src/commands/mcp.ts` lists configs only
- owner: agent-switch road-to-the-agent-config-link phases 1–2
- closes-when: a released agent-switch answers `link status --json` with `contract: 1`
- since: 2026-11-05
