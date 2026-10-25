---
complexity: structural
status: ready
tree_pin: c073ca2e5a
execution:
  mode: phase-checkpoints
estate_offset_exempt: >-
  Owner search before writing: grep -rlF for "rate_limits", "five_hour",
  "DEFAULT_CLI_CALLS_PER_DAY" and "billing class" over agents/roadmaps/*.md,
  agents/roadmaps/later and agents/roadmaps/stubs — no roadmap owns the
  status-line quota signal, the user notice on it, or the per-day call caps.
  Nearest neighbours set aside: later/road-to-billing-cliff-detection owns a
  stop-and-ask at the plan cliff (the owner ruled stopping out on 2026-10-22),
  later/road-to-a-cold-start-paid-once-carried owns only step 3.6. Active count
  3 → 4, inside the WIP cap of five; the operator asked for this round's roadmap
  to be executed in the same invocation.
estate_growth_exempt: >-
  concern_count 70 → 72: `quota-notice` and `metered-spawn-ask` are the two
  concerns the owner's 2026-10-22 directive needs (a notice the user sees, and
  one ask before a metered fan-out). They share one script and one lazy chunk,
  so the dispatch bundle carries a single LAZY_CONCERNS row for both.
---
# Road to a quota the user sees coming

> **Source:** `agents/tmp.old/inbox-2026-10-ax/` — an owner transcript (two
> turns) plus two supplied plans drafted against `447f8fd`, verified against
> `c073ca2e5a` (1,187 commits later).
>
> **Owner directive (2026-10-22, transcript turns 1–2):** AC warns when plan
> limits approach or a session grows too large; near the end of a window AC
> throttles its own subagent use; before work starts burning paid tokens AC
> warns and asks, so the user keeps full control of cost. Amended the same day:
> no hard call limits AC sets, no stopping — a counter AC manages itself, made
> adaptive rather than configured, with room for the planned free workers, and
> no dependence on a settings UI.

## Goal

A user of AC on Claude Code is told — in their own terminal, never in the
model's context — when the plan window is filling faster than it resets, when
one session's context is nearly full, and when the session bills metered money.
Near the end of a window AC stops pushing its own fan-out, without a number
anybody configured and without refusing work. No shipped default caps calls:
every limit in effect is the provider's or one the user wrote down.

## What the supplied plans claimed, at `c073ca2e5a`

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| D1 | Dispatcher can only address the model; `systemMessage` has 0 hits | already-fixed (overtaken) | `src/scripts/hooks/user_notice.ts:1-40` — a `notification` concern's `user_notice` reply goes to `systemMessage` on `claude` since 2026-10-24 (`03d20d6707`); used by `update_notice_hook.ts`, `star_ask_hook.ts` |
| D2 | The only session-size warning was retired | still-true | `src/scripts/hooks/session_eol_hook.ts:15-48` "says nothing" |
| D3 | The 800k recycle threshold is window-blind | still-true | `src/config/recycle-threshold-budget.json` `known_limitation` |
| D4 | Plan-window fill is never read | still-true | `rate_limits`, `five_hour`, `used_percentage`: 0 hits in `src/` |
| D5 | Quota marker only after the limit | partly overtaken | `host_rate_marker_hook.ts` (`StopFailure(rate_limit)`, cold-start 4.3) and spawn-guard shadow (4.5) shipped; both still fire only after the cliff |
| D6 | Vendor-CLI children booked unmetered while inheriting `ANTHROPIC_API_KEY` | still-true | `src/scripts/_lib/spawn_env.ts` scrubs by family and keeps the key on purpose; `clients.ts:22` `billable=false`; `self_review_gate.ts:1158` labels the path "subscription" |
| D7 | No session-start billing-class detection | still-true | `apiKeyHelper`, `CLAUDE_CODE_USE_BEDROCK`: 0 hits in `src/` |
| D8 | Extra usage (credits) undetectable | still-true, carried | owned by `later/road-to-billing-cliff-detection` (S-1…S-6) |
| D9 | Hard per-day call caps still ship | still-true | `cli_call_budget.ts:68` `DEFAULT_CLI_CALLS_PER_DAY = 50` seeded for every provider (`:94-99`); `ai_team/config.ts:80` default 50; template `:954` |
| D10 | A call count is the wrong unit for quota | still-true | follows from D9; addressed by reading the window instead |
| D11 | Resumes unbounded and uncounted | not addressed here | the spawn-guard shadow is the observer; nothing in this roadmap needs the count |
| D12 | Stale "recycle advisory … unaffected" description | still-true | `docs/settings-reference.md:88` (the `settings.ts:421` line the plan named moved; the doc line is the one left) |

Cold-start's 4.3, 4.5 and 5.3, which the first plan proposed to take over, are
`[x]` in `archive/road-to-a-cold-start-paid-once.md:372-419` — that hand-over
(its E1) is moot.

## Phase 1 — Call caps become counters (D9)

- [x] **1.1 An absent council cap is a counter, not a 50.**
      `resolveCliCallCaps` stops seeding `DEFAULT_CLI_CALLS_PER_DAY`; an absent
      or malformed entry yields no cap for that provider, so the gate books and
      never refuses on count. A user-written number keeps its contract exactly.
      The constant and its re-export in `ai_council/config.ts` go; the summary
      line already names `N/uncapped`. Tests: the 51st, 100th and 1,000th
      successful call on an unset provider are admitted; a written cap of 3
      still refuses the fourth.
      verify: `npx vitest run tests/scripts/ai_council/config.test.ts tests/scripts/council_cli.test.ts` -> 0
- [x] **1.2 The team ceiling defaults to unset.** `ai_team.max_calls_per_day`
      becomes optional (`null` = no team ceiling); `team_dispatch.ts` admits on
      `null`. Template, `docs/contracts/ai-team-config.md` and the team command
      docs say "unset = counted, never refused".
      verify: `grep -c "max_calls_per_day: 50" src/config/agent-settings.template.yml` -> /^0$/
- [x] **1.3 ADR-279 records the move.** One addendum: the owner moved the
      per-day call guards from § What stays to § Supersedes on 2026-10-22, via
      the record's own `review_trigger`. The billing-class half (`api_on_quota:
      false`, `billing_grant`) stays, and the addendum says why that is not an
      amount bound.
      verify: `grep -c "2026-10-22" docs/decisions/ADR-279-no-spend-bound-by-default.md` -> /^[1-9]/

## Phase 2 — The quota ledger and the status-line tap (D3, D4)

- [x] **2.1 `_lib/quota_ledger.ts`, machine-wide, counts only.** Snapshots
      under the user-global state directory (five parallel sessions share one
      plan, so not per repo): `{ts, session, five_hour, seven_day,
      context_used_pct, context_size, model}`, each window `{pct, resets_at}`
      or absent. No prompt, path or credential field exists. Line-sized
      appends, rewritten atomically without lines past eight hours.
      verify: `npx vitest run tests/scripts/_lib/quota_ledger.test.ts` -> 0
- [x] **2.2 A status-line tap that chains the user's line.**
      `agent-config statusline:tap` reads the host's status-line JSON on stdin,
      hands the same bytes to the recorded original command, prints its
      output unchanged, then writes one ledger snapshot. Any error of its own is
      swallowed: the wrapped line always prints. Without a wrapped command it
      prints one compact segment only while a band is active.
      verify: `npx vitest run tests/scripts/statusline_tap.test.ts` -> 0
- [x] **2.3 Install and uninstall the tap.** `agent-config statusline:install`
      wraps the existing `statusLine.command` in `~/.claude/settings.json` (or
      sets the tap alone when none exists) and records the original value;
      `statusline:uninstall` puts that value back, or removes the key it added. Whether `setup` runs it
      by default is owner question OQ-19 (`quota-tap-default`).
      verify: `npx vitest run tests/scripts/statusline_install.test.ts` -> 0

## Phase 3 — Pressure and the notice the user sees (D2, D3)

- [x] **3.1 `_lib/pressure.ts`, pure.** Per window: fill, burn rate (slope over
      the last 15 minutes, only with ≥3 snapshots), projected exhaustion,
      reset, and `state ∈ {ok, warm, hot, exhausted, unknown}`. Stale (no
      snapshot in 10 minutes) is `unknown`, never `ok`. `hot` = projected full
      before reset with fill ≥ 50 %, or fill ≥ 80 %; `warm` = fill ≥ 50 % or a
      projection that runs out before reset; `exhausted` = fill ≥ 100 %. Keyed by
      billing class (`plan | metered | free`), so a future free-worker pool
      reads the same state.
      verify: `npx vitest run tests/scripts/_lib/pressure.test.ts` -> 0
- [x] **3.2 `quota-notice` concern on `user_prompt_submit`.** A lazy
      `notification` concern, bound on `claude` only: one `user_notice` per
      `(window, state, resets_at)` across the machine, with numbers the user can
      act on — fill, projected-full clock time, reset clock time. Dedup stamps
      live beside the ledger.
      verify: `npx vitest run tests/scripts/quota_notice_hook.test.ts` -> 0
- [x] **3.3 Session size by window, not by token count.** The same concern
      notices once per session when `context_used_pct ≥ 80`, naming `/compact`.
      Window-relative, so a 200k session is served.
      verify: `npx vitest run tests/scripts/quota_notice_hook.test.ts -t "context"` -> 0
- [x] **3.4 Fix the stale description (D12).** `docs/settings-reference.md:88`
      and its generator source stop naming a recycle advisory that no longer
      exists.
      verify: `grep -c "the recycle advisory" docs/settings-reference.md` -> /^0$/

## Phase 4 — The billing class (D6, D7)

- [x] **4.1 Detect the session's billing class at `session_start`.** Presence
      only — `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `apiKeyHelper` in the
      host settings, `CLAUDE_CODE_USE_BEDROCK|VERTEX` — never a value. A
      metered session gets one `user_notice` on its first turn: it bills per
      token, and `/status` shows the auth source.
      verify: `npx vitest run tests/scripts/quota_notice_hook.test.ts` -> 0
- [x] **4.2 An unmetered vendor-CLI child cannot bill silently.** For
      Anthropic CLI children booked `billable=false`, `ANTHROPIC_API_KEY` and
      `ANTHROPIC_AUTH_TOKEN` are removed from the spawn env unless the run
      holds a `billing_grant`; the self-review gate's CLI label stops saying
      "subscription" when a key was present. A user who wants API-billed seats
      keeps them through the grant or `mode: api`.
      verify: `npx vitest run tests/scripts/ai_council/spawn_env.test.ts` -> 0
- [x] **4.3 One ask before AC fans out on metered money.** In a session whose
      billing class is metered and whose run holds no `billing_grant`, the first
      `Agent` spawn returns the host's native ask (`permissionDecision: "ask"`)
      naming the billing class and that the answer covers the session; the
      session is stamped asked, so later spawns pass. Never a deny, never an
      amount; plan and unknown sessions are untouched.
      verify: `npx vitest run tests/scripts/metered_spawn_ask_hook.test.ts` -> 0

## Phase 5 — Throttle by choosing differently (D10)

- [x] **5.1 No fan-out push into a hot window.** `delegation-nudge` reads
      the verdict the tap leaves in `state/quota/pressure.json` and, at `hot` or `exhausted`, emits no delegation push — it
      says instead, once, that the plan window is nearly spent and in-session
      work or a resume is the cheaper path. Nothing is refused.
      verify: `npx vitest run tests/scripts/delegation_nudge_hook.test.ts` -> 0
- [x] **5.2 The stricter council bar also fires on projection.** The
      window-threshold rule of cold-start 5.3 (`necessity.ts`) reads `hot`
      from `pressure` as well as the after-the-fact host marker.
      verify: `npx vitest run tests/scripts/ai_council/necessity.test.ts` -> 0
- [x] **5.3 The spawn-guard shadow records `would_wait` from pressure.**
      Shadow only: it records, never denies (a deny is a stop).
      verify: `npx vitest run tests/hooks/spawn_guard_shadow.test.ts` -> 0

## Decisions

| # | Decision | Alternatives | Reason | Revisit-if |
|---|---|---|---|---|
| E1 | Hand-over of cold-start 4.3/4.5/5.3 | take them over | already `[x]` in the archived parent | — |
| E2 | Tap installed by `setup` by default | opt-in command only | **owner** — `quota-tap-default` in `agents/owner-questions.md`; the command ships either way | owner answers |
| E3 | The metered notice is not an ADR-279 conflict | — | ADR-279 removed bounds on amounts; a billing-class change was always kept (`api_on_quota: false`, `billing_grant`) | — |
| E4 | The ask is once per session, on the first `Agent` spawn (4.3) | ask per spawn; ask per amount | the owner asked for full control without interruptions; AC-originated council and self-review calls already ask through `api_on_quota` and `billing_grant`, so the spawn is the one paid act without an ask | the ask fires in a plan session, or a user reports it more than once per session |
| E5 | Strip the key from unmetered CLI children (4.2) | wait for an observation that `claude -p` prefers the key | stripping is safe in both outcomes: if the child would use the subscription it loses nothing, if it would use the key it is stopped from billing unasked | a key-only user reports a broken council seat with no `mode: api` path |
| E6 | AIMD concurrency on AC's own transports | ship it | AC's transports issue at most a couple of seat calls; no queue exists to adapt, and `retry-after` is not read anywhere in `ai_council/` | a free-worker pool with real concurrency lands |
| E7 | Free workers read the same pressure (3.1 keys it by billing class) | route `hot` plan work to free workers in this roadmap | no free-worker pool exists in the tree to route to; the owner's point is carried as the `free` key, so the pool's router reads `plan` pressure on the day it lands | the pool lands |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-25 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Tap breaks the user's status line | implementation | An error or a slow write blanks or delays the line the user relies on | Passthrough first, ledger write after print, every own error swallowed; uninstall restores the recorded original | Phase 2 — The quota ledger and the status-line tap (D3, D4) |
| 2 | Notice fatigue across parallel sessions | product | Five sessions crossing a band print five lines | One stamp per `(window, state, resets_at)` on the machine | Phase 3 — Pressure and the notice the user sees (D2, D3) |
| 3 | `rate_limits` absent in a host build | implementation | Status line ships without the field; pressure reads `ok` and stays silent | Absent or stale is `unknown`, never `ok` | Phase 3 — Pressure and the notice the user sees (D2, D3) |
| 4 | Removing the cap drains a subscription unnoticed | product | An always-on pass runs past what a 50/day cap stopped | The window notice replaces the count with the provider's own fill; a written cap still works | Phase 1 — Call caps become counters (D9) |
| 5 | Key strip breaks a key-only council seat | product | A user running the Anthropic CLI seat on a key alone loses the seat | Grant or `mode: api` keeps it; the error names both | Phase 4 — The billing class (D6, D7) |

## Acceptance Criteria

- [x] AC-1 — No shipped default caps council or team calls: an unset provider admits its 1,000th successful call, a written cap still refuses.
- [x] AC-2 — A ledger fed with a window projected to fill before reset produces exactly one user notice per window state on the machine, never a model-context line.
- [x] AC-3 — A session whose context is ≥ 80 % of its window gets one notice, whatever its absolute size.
- [x] AC-4 — A session started with an API key in the environment gets a metered notice on its first turn, and its first `Agent` spawn asks once.
- [x] AC-5 — No AC-launched unmetered Anthropic CLI child receives an API key without a billing grant.
- [x] AC-6 — At `hot`, AC emits no delegation push and refuses nothing.
