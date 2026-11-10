---
complexity: structural
status: ready
tree_pin: 84ec63c93d
execution:
  mode: phase-checkpoints
review_by: 2026-12-31
estate_growth_exempt: "+1 active_roadmaps, owner-promoted 2026-11-07 out of later/ per agents/evidence/owner-directives/2026-11-05-agent-switch-link.md (\"parked in later/ until the WIP cap allows it or the owner promotes it citing this record\"); its entry condition was met when agent-switch 2.13.0 shipped link contract 1, and the move takes it from later/ to active (-1 later_roadmaps, -1 open_blockers)."
estate_offset_exempt: "New work requested by the owner, agents/evidence/owner-directives/2026-11-05-agent-switch-link.md; no parked or active roadmap covers an agent-switch link (grep -rlF for 'mcp serve', 'switch_request', 'agent-switch link' over agents/roadmaps, later, stubs at 84ec63c93d returned nothing), so nothing is archived to offset it."
entry_condition:
  what: "agent-switch ships `mcp serve`, `limits --json` and `switch … --json` (contract v1) on its 2.x line"
  when: "the agent-switch release carrying road-to-the-agent-config-link phases 1–2"
  who: "owner"
  met: "agent-switch 2.13.0 (npm @event4u/agent-switch, tag 2.13.0, 2026-11-06): `link status --json` answers `contract: 1`"
relates:
  - slug: road-to-a-council-that-spreads-across-accounts
    relation: extends
    note: "Its per-seat `agent-switch dir` pick gains a limits pre-check; the pick itself stays agent-switch's."
  - slug: road-to-the-profile-the-session-runs-in
    relation: extends
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

- [x] **1.1 `docs/contracts/agent-switch-link.md`.** <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural --> Tools, JSON shapes
      (`limits_get`, `switch_*`, `session_whoami`, `link_status`), request
      states, first-decision-wins, contract version `1`, and the absence rules.
      verify: `./scripts-run src/scripts/check_references` -> 0
- [x] **1.2 Guide update.** <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural --> `docs/guides/works-with-agent-switch.md` § "What AC
      never does" keeps moving/automatic switching and adds what AC now does
      (read limits, ask, relay).
      verify: `./scripts-run src/scripts/check_references` -> 0

## Phase 2 — Automatic connection

- [x] **2.1 Link probe.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_cli/cmd_mcp_available.ts --> `_lib/agent_switch_link.ts` `probeLink()`: runs
      `agent-switch link status --json` (5 s timeout) and returns
      present / disabled / incompatible / absent / failed. The client's
      `linkStatus()` (2.3) folds every state but present to `null`.
      verify: unit tests for present / disabled / missing / garbled output.
- [x] **2.2 MCP entry.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_cli/cmd_mcp_available.ts --> Next to `mcpBridgeEntry`, an `agent-switch` entry
      (`{command:"agent-switch", args:["mcp","serve"]}`) written into
      `.mcp.json` by install when the probe is enabled, removed when it is not;
      recorded in `installed-tools.lock`.
      verify: install tests: enabled → entry; disabled → removed; absent → untouched.
- [ ] **2.3 MCP client.** `agentSwitchCall(tool, args)`: SDK stdio client
      (lazy, like `mcp_server/server.ts`), falling back to the CLI `--json`
      verbs, returning `null` on any failure. Fix the stale "SDK is NOT a
      dependency" comment at `mcp_server/server.ts:28`.
      verify: tests with a fake server and with the CLI fallback.
      built, not wired: `_lib/agent_switch_client.ts` and
      `tests/scripts/agent_switch_client.test.ts` land with Phase 2, the stale
      comment is fixed. 3.2 `agentSwitchLimits()` calls it but is unwired
      itself; the first production caller is 4.1 (`switch_request` from
      quota-notice) or 5.1 (the limits read for seats), which ticks this step.
- [x] **2.4 `mcp:available` / doctor row** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_cli/cmd_mcp_available.ts --> showing the link state.
      verify: `tests/scripts/mcp_available.test.ts` (the verb's existing test file).

## Phase 3 — Limits that know their account

- [x] **3.1 Account on snapshots.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/quota_ledger.ts --> `quota_ledger.ts` gains optional
      `account` (from `agentSwitchProfile`), so two logins no longer share one
      pressure verdict; `pressure.ts` classifies per account.
      verify: ledger/pressure tests with two accounts interleaved —
      `tests/scripts/_lib/quota_account.test.ts`. The tap labels each snapshot
      `provider/name` (refused unless it is a plain label); the plan readers
      (status-line segment, pressure state, council bar, quota notice, the
      parked-run reset) read the account their process runs under, and a
      snapshot without one is the default login's bucket `''`.
- [ ] **3.2 Limits read.** `agentSwitchLimits()` via the client; stale or
      absent → `null`, never a guess.
      verify: unit tests.
      built, not wired: `_lib/agent_switch_limits.ts` and
      `tests/scripts/agent_switch_limits.test.ts` land with Phase 3 — a stale
      account and a window without a fill are left out, anything that is not a
      version-1 report is `null`. Its first production caller is 4.1 or 5.1,
      which ticks this step.

## Phase 4 — Inform and ask

- [x] **4.1 Raise.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/switch_relay.ts --> At `hot`, `quota-notice` calls `switch_request` for the
      session's account and names the request in the notice: targets, and that
      the user can answer here or in agent-switch.
      verify: hook tests: hot + link → one request, one notice; no link → today's notice.
      `tests/scripts/agent_switch_ask.test.ts` § 4.1. The hook is synchronous,
      so it reaches the link over the CLI verbs (`switch request --session
      provider/name/<id> --by ac`), never the MCP client; the raise is claimed
      once per `(account, window, resets_at)` on the machine, so AC adds no
      noise of its own even where agent-switch's own dedup misses.
- [x] **4.2 Decide in-session.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/lint_mcp_config_security.ts --> The notice tells the agent the request id; on
      the user's answer the agent calls `switch_decide`, which the host
      confirms with the user (never auto-allowed; checked by
      `lint_mcp_config_security`).
      verify: lint test rejecting an auto-allow entry for `switch_decide`.
      `tests/scripts/lint_mcp_config_security.test.ts` § switch_decide is never
      auto-allowed (by name, `__*`, or the whole server, in `.mcp.json` and
      `.claude/settings*.json`); the model's half of the notice is
      `additional_context`, pinned in `tests/scripts/agent_switch_ask.test.ts` § 4.2.
- [x] **4.3 Relay a decision from agent-switch.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/switch_relay.ts --> On the next prompt, a request
      decided in agent-switch is reported once ("moving after this turn to …"),
      and its outcome once when `done|failed`.
      verify: hook tests over fixture request states.
      `tests/scripts/agent_switch_ask.test.ts` § 4.3; a decision made here
      (`by: ac:…`) is not echoed back, a terminal request is forgotten.
- [x] **4.4 Hand the work over.** <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/session_eol_hook.ts --> Before an approved move, write the run
      checkpoint / handoff brief so the target session resumes the step.
      verify: test that an approved request triggers one checkpoint write.
      `tests/scripts/agent_switch_ask.test.ts` § 4.4. Written by the
      `session-eol` Stop hook, not by `quota-notice`: an approval given in the
      session is followed by a move after the turn, so no later prompt would
      come, while this turn's Stop always runs first.

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

## Phase 6 — Pace requests (agent-switch counterpart)

> **Source:** `road-to-limits-that-last-the-whole-run` 2.3 in
> `event4u-app/agent-switch`. agent-switch raises a second kind of switch
> request, `reason.kind: "pace"`: one account runs out well before its reset
> while another account of the same provider would let its room expire unused.
> The link contract stays `1`; the additions are fields and an optional
> argument — `switch_list` takes `session`, each request carries `kind` and a
> plain `summary`, `limits_get` windows carry `burnPerHour` and `etaFull`.

- [ ] **6.1 Render pace requests at prompt time.** The prompt-time hook reads
      the calling session's open requests with `switch_list {session}` and shows
      a pace request in plain words, using its `summary` as is instead of
      rebuilding it from raw fields. A pace request is not urgent: one line,
      after a limit request when both are open.
      verify: hook test — one open pace request → one line carrying its
      `summary`; a limit and a pace request → the limit first.
- [ ] **6.2 Answer through `switch_decide`.** On the user's answer the agent
      calls `switch_decide` (approve with a target, decline, or snooze),
      host-confirmed as in 4.2; agent-switch carries out the move. AC never
      raises a pace request: `switch_request` stays the limit path of 4.1.
      verify: the 4.2 lint covers `switch_decide` for both kinds; a test that no
      AC path raises a request with a pace reason.
- [ ] **6.3 Relay and one voice.** 4.3's relay reports a pace request decided
      in agent-switch like a limit one. agent-switch's own opt-in chat hook
      (`agent-switch hooks chat on`) stays silent when this link is wired into
      the session, so the user never sees the suggestion twice; agent-switch
      detects the wiring, so AC adds nothing for that.
      verify: relay test with a pace request decided in agent-switch.

## Phase 7 — Hardening the switch question

Carried from ratification rounds 1–5 of the Phase 4 budget raise
(`agents/evidence/council/agent-switch-ask-ratification-r{1..5}-*.question.md`,
all `refused`; merged on the owner's word, 2026-11-08). Each item is a
finding both seats or one seat repeated that the merged change does not close.

- [x] **7.1 Back off a failing link.** <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/hook-bundle-budget.json --> Consecutive failed `switch show` /
      `switch request` calls (each bounded at 5 s) stop the link for this
      session until the next reset, and say so once.
      verify: test with a fake agent-switch that exits non-zero three times.
      `tests/scripts/agent_switch_ask.test.ts` § 7.1: three unanswered calls rest
      the link until the next reset (five hours from the Stop path, which knows
      none), said once; the Stop path honours a rest; an answered call resets
      the count. A non-zero exit counts, per the contract's "absence for that
      call"; a raise runs once per cycle, so refusals alone rest it rarely.
- [x] **7.2 Measure the cost.** <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/hook-bundle-budget.json --> Measure whole-hook latency of `quota-notice`
      and `session-eol` with the link answering, failing and absent; record
      the figures and a rollback criterion next to the budget entry.
      verify: committed measurement record.
      `agents/evidence/metrics/agent-switch-link-latency-20261108.md` (harness
      `agents/evidence/analysis/agent-switch-link-latency.mjs`), cited by the
      2026-11-08 `raise_log` entry: ≤ 1 ms on a quiet prompt, ~170 ms p50 per
      prompt and Stop while a request is open, 5 s per hanging call capped at
      three by 7.1; rollback criterion in the record.
- [x] **7.3 Terminal versus checkpoint.** <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/hook-bundle-budget.json --> A request that turns terminal on a
      prompt before the Stop path checkpointed it no longer drops the record
      the Stop path needs; decide whether a checkpoint after a finished move
      is still useful and test the race.
      verify: test approved → done between prompt and Stop.
      Decided: still useful — the run checkpoint is the newest state of the run
      whichever session resumes it reads. A `done` record is kept (outcome told
      once) until the Stop path checkpointed it; `tests/scripts/agent_switch_ask.test.ts`
      § 7.3 covers both orders and a failed move.
- [x] **7.4 Consent at execution.** <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/hook-bundle-budget.json --> Show, per supported host, that a
      `switch_decide` call reaches the user's confirmation, or record where it
      does not.
      verify: evidence record per host.
      `agents/evidence/investigations/switch-decide-consent-per-host-20261108.md`:
      Claude Code is the only host; shown by documentation for an interactive
      default-mode session, not shown live; not reached under
      `bypassPermissions`, an allow rule the lint does not read, and possibly
      `auto` mode. The per-call gate (`requiresUserInteraction` on the tool)
      is agent-switch's to set.
- [x] **7.5 Record lifetime and interleaving.** <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/hook-bundle-budget.json --> The per-session record
      expires (e.g. after the request's `expiresAt` or seven days) so an
      orphaned one stops polling, and a prompt relay and a Stop checkpoint
      updating it at once cannot undo each other's flag or revive a deleted
      record.
      verify: tests for expiry and for interleaved relay / Stop writes.
      `tests/scripts/agent_switch_ask.test.ts` § 7.5: expiry at `expiresAt` + 1 day,
      at most seven days, legacy records by mtime; a relay inside the Stop
      write keeps both flags, a deleted record is not revived, a held lock
      defers and a stale one is broken.
- [x] **7.6 Default.** <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/hook-bundle-budget.json --> With 7.1–7.5 in hand, decide whether the question stays
      on by default or becomes opt-in (`AGENT_CONFIG_NO_SWITCH_QUESTION=1` is
      the off switch today).
      verify: owner decision recorded under Decisions.
      D5: opt-in. The question runs only with `AGENT_CONFIG_SWITCH_QUESTION=1`;
      `AGENT_CONFIG_NO_SWITCH_QUESTION=1` still wins. `tests/scripts/agent_switch_ask.test.ts`
      § 7.6.

## Phase 8 — Residuals of the hardening ratification

Carried from council rounds 1–6 of the Phase 7 budget raise
(`agents/evidence/council/agent-switch-hardening-ratification-r{1..6}-20261108.question.md`,
all `refused`; merged on the owner's word with the question opt-in, D5).

- [x] **8.1 A writer the lock cannot evict.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/switch_relay.ts --> A Stop whose checkpoint build
      outlives the two-second stale break can lose its lock to a second Stop and
      still publish an older snapshot after it (round 6). Serialize in a way
      that cannot evict a live writer, or write checkpoint generations so an
      older one never replaces a newer one.
      verify: a two-process test with a writer held past the stale break.
      Done: the lock names its holder's process and is never broken while that
      process runs (dead holder at once, unnamed after 2 s, any after 15 min);
      a waiter gives up and leaves the write to the next Stop.
      `tests/scripts/agent_switch_interprocess.test.ts` § 8.1, red against the
      age-only break.
- [x] **8.2 Interprocess evidence.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/switch_relay.ts --> The concurrency tests run in one process
      with reentrant callbacks and a racing fake agent-switch. Add tests that
      overlap two real hook processes for the relay claim, the back-off count
      and the checkpoint.
      verify: the two-process tests.
      Done: relay claim, back-off count and checkpoint, each with two or three
      `node` processes running the hook halves (`fixtures/switch_relay_driver.ts`)
      against the fake agent-switch at one instant; all three red with the lock
      removed, in three runs. Not the full dispatcher: its process start costs
      seconds per run and adds nothing to the lock under test.
- [ ] **8.3 Consent at execution, closed.** Ask agent-switch to mark
      `switch_decide` with `requiresUserInteraction` (counterpart roadmap
      `road-to-the-agent-config-link`), then show a live interactive prompt on
      Claude Code; until then the gaps in
      `agents/evidence/investigations/switch-decide-consent-per-host-20261108.md` stand.
      verify: evidence record updated with a live observation.
- [ ] **8.4 The ceiling.** One seat held across rounds that the implementer
      raising the `quota_notice` ceiling is not authorized by disclosure. Before
      the question leaves opt-in, either bring the chunk back under 41,000 B
      (for example the link in its own lazily loaded chunk with its own measured
      budget) or have the raise ratified.
      verify: the budget gate at the chosen ceiling, and a ratification record.
      Progress: the link is its own lazy chunk, `src/scripts/switch_link.ts`
      (27,951 B, ceiling 30,800); `quota_notice` measures 26,290 B, ceiling
      lowered to 29,000. Loaded only with the opt-in, and by the Stop path only
      for a session with a record; the digest check moved to
      `hooks/bundle_digest.ts` so the chunk does not carry the YAML reader.
      Open: the ratification record for the budget and plumbing change.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | product-owned | owner | No automatic move; the user decides, in either tool | owner directive 2026-11-05 | a host offers its own cross-account continuation |
| D2 | product-owned | owner | agent-switch executes; AC reads, asks, relays | owner directive 2026-11-05; fences K2/K4 | agent-switch drops contract v1 |
| D3 | product-owned | owner | Connection is automatic, switched off only in agent-switch | owner directive 2026-11-05 (default on) | the link is found to expose more than limits and requests |
| D4 | reversible-technical | council:2026-11-05 | Seat account may change on limits; seat model never does | council 2026-11-05 (openai), host verdict accept | a seat's account change is shown to change its verdicts |
| D5 | product-owned | owner | The switch question is opt-in (`AGENT_CONFIG_SWITCH_QUESTION=1`) | owner decision 2026-11-08 after council rounds 1–6 refused the Phase 7 raise | Phase 8 is closed and the raise ratified |

revisit-if: agent-switch drops contract v1, or a host offers its own
cross-account continuation.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-11-08 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Agent decides without the user | product | An agent that records a switch decision on its own moves work the user never agreed to move | `switch_decide` is host-confirmed; lint forbids an auto-allow entry for it | Phase 4 — Inform and ask |
| 2 | Stale limits route a seat badly | implementation | A cached limits read that is hours old can mark a full account usable and place a council seat on it | Observations carry `stale`; a stale read counts as `null`, never as usable | Phase 5 — Load distribution |
| 3 | agent-switch absent or link off | implementation | A hard dependency would break AC for every user without agent-switch, against fence K8 | Every path returns `null` and falls back to today's behaviour | Phase 2 — Automatic connection |
| 4 | Notice noise | product | Raising a request on every `hot` notice could flood both tools with duplicate questions | One request per `(account, window, resets_at)`, deduplicated in agent-switch | Phase 4 — Inform and ask |
| 5 | One pace request, two voices | product | agent-switch's own chat hook and AC's prompt-time hook could both put the same pace suggestion into one session | agent-switch's hook is silent wherever this link is wired; AC renders the request's `summary` once, after any limit request | Phase 6 — Pace requests (agent-switch counterpart) |

## Blockers

None open. `agent-switch-contract-v1` (since 2026-11-05) closed 2026-11-07:
agent-switch 2.13.0 is published and `link status --json` answers
`{"enabled":true,"version":"2.13.0","contract":1,"mcp":{"command":"agent-switch","args":["mcp","serve"]}}`.
