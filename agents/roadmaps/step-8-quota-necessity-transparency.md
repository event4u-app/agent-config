# Step 8 — Quota & Necessity Transparency

**Status:** open · **Owner:** Matze · **Depends on:** —

## Goal

The AI-Council's two pre-flight gates — **CLI quota** (`~/.event4u/agent-config/cli-calls.json`) and **Necessity classifier** (`scripts/ai_council/necessity.py`) — become **observable and aligned with the user's mental model**: `Council always active when enabled`. No silent skip, no silent quota burn, no audit-trail dependency on terminal scroll history.

## Why

- Quota gate is opt-in and surfaces `cli_quota_exhausted` *after* the budget runs out — usage between 0% and 100% has no visible signal until the wall hits.
- Necessity classifier default (`enabled=true`, `mode=educate`) auto-skips on `agent` invocation with one stdout line that vanishes on the next scroll. User mental model is "council fires when called"; current behaviour silently subtracts.
- Both events live only on stdout. No persistent record means no post-hoc audit ("how often did the council *not* run today?") and no learning signal for tuning.

## Non-goals

- No replacement of the keyword heuristic with an LLM judge.
- No per-month / per-week quotas (UTC daily reset stays the contract).
- No telemetry beaconing to an external service.
- No service-grade audit pipeline (rotating files / sinks / structured tracing).

## Acceptance criteria

- [ ] `agent-config council run` prints a one-line **pre-run quota summary** before the first member fires (`council:quota · anthropic 3/30 · openai 7/50` — only providers with a configured cap appear; uncapped providers omitted).
- [ ] New subcommand `agent-config council quota` dumps today's state from `~/.event4u/agent-config/cli-calls.json` plus the configured caps; `--reset <provider>` for manual rollover (opt-in, requires `--confirm`).
- [ ] New config knob `cli_call_budget.warn_at` (float, default `0.8`). When `used / max_calls_per_day >= warn_at`, the pre-run summary line is prefixed `⚠️` and a separate `council:quota · WARN` line names the provider near the limit.
- [ ] **Necessity tier split (D2):** `invocation=user_explicit` defaults to `warn-only` — classifier verdict is annotated in stdout but **never** skips (no exit-2 path). `invocation=agent` keeps `educate` default (current behaviour). Config knob `necessity_classifier.user_explicit_mode` (`warn-only` | `educate` | `off`) overrides this; default `warn-only`.
- [ ] Every dispatch — proceed AND skip AND quota-block — appends one JSON line to `agents/council-events.log` (gitignored by default; user owns presence). Schema versioned (`schema_version: 1`).
- [ ] Kill-switch `AGENT_CONFIG_NO_EVENTS_LOG=1` disables the events-log write (D5).
- [ ] Backward-compat: existing `.agent-settings.yml` and `agents/.ai-council.yml` work unchanged; new knobs are optional.
- [ ] Tests cover: warn-at threshold, pre-run summary shape, `council quota` output, two-tier necessity (agent vs user_explicit), events-log JSON schema, kill-switch.

## Phases

### Phase 1 — Quota observability

- [ ] Extend `CliClient.__init__` signature with `warn_at: float = 0.8`. Wire through `scripts/ai_council/config.py:CliCallBudgetConfig` (new field).
- [ ] `scripts/ai_council/clients.py` — add `quota_summary_line(clients)` helper producing the one-line `council:quota · …` digest.
- [ ] `scripts/council_cli.py:cmd_run` — invoke the helper **after** estimate / **before** dispatch. Per-lens override path mirrors `_resolve_necessity_mode` shape.
- [ ] New `cmd_quota(args)` in `scripts/council_cli.py`. Reads `cli-calls.json`, formats the table, prints. `--reset <provider>` mutates the file behind `--confirm`.
- [ ] `agent-config council quota` is the user-facing entrypoint.

### Phase 2 — Necessity tier split

- [ ] `scripts/ai_council/necessity.py` — add new mode `warn-only` to `NECESSITY_MODES` set. Keep `off` / `educate` / `block` for backward compat.
- [ ] `scripts/ai_council/config.py:NecessityClassifierConfig` — add `user_explicit_mode` field (default `warn-only`).
- [ ] `scripts/council_cli.py:_resolve_necessity_mode` — split into two helpers: agent-path returns the current value; user-explicit-path returns the new `user_explicit_mode`. `_necessity_gate` consumes the right one based on `invocation`.
- [ ] New stdout shape for `warn-only`: `council:necessity · warn-only (<category>) · <rationale>` then proceed.
- [ ] `educate_message()` stays untouched — only the dispatch path changes.

### Phase 3 — Persistent events log

- [ ] New module `scripts/ai_council/events_log.py`. Single function `append_event(event: dict, *, log_path: Path | None = None)`. Default path: `<project_root>/agents/council-events.log`. Honours `AGENT_CONFIG_NO_EVENTS_LOG=1`.
- [ ] Event schema v1: `{schema_version, ts_utc, lens, invocation, action, verdict, provider_caps, original_ask_hash}`. `action` ∈ `proceed | skip_necessity | block_quota`.
- [ ] Hook into `_necessity_gate` (skip + proceed paths) and `CliClient.ask` (quota-block path).
- [ ] `original_ask` is **hashed** (sha256, first 12 chars) — no prompt content leaks to the log per privacy floor.
- [ ] Append .gitignore entry `agents/council-events.log` to `templates/.gitignore` (consumer copy) — kept out of the user's `.gitignore` (D2 from Step 7).

### Phase 4 — Docs & release notes

- [ ] `docs/contracts/ai-council-config.md` — add the new knobs (`warn_at`, `user_explicit_mode`, events-log path + schema).
- [ ] `docs/installation.md` — mention `agents/council-events.log` and the kill-switch.
- [ ] `CHANGELOG.md` — entry under the current 2.13.x era.

### Phase 5 — Tests + CI

- [ ] `tests/test_cli_quota_warn.py` — warn_at threshold flips the summary-line prefix.
- [ ] `tests/test_council_quota_cmd.py` — `council quota` output shape + `--reset` flow.
- [ ] `tests/test_necessity_tier_split.py` — user_explicit + unnecessary → warn-only proceed; agent + unnecessary → skip (educate). Backward-compat: legacy `mode=block` still blocks both tiers.
- [ ] `tests/test_events_log_schema.py` — JSON schema fields present, `original_ask_hash` is sha256[:12], kill-switch disables write.
- [ ] CI `python-tests` covers these — no new workflow needed.

## Decisions (resolved via AI Council, analysis lens)

Council artefacts: two rounds of the quota-necessity audit under `agents/council-sessions/` (gitignored). Anthropic returned `OverloadedError 529` on both runs; OpenAI GPT-4o was consistent in both. Decisions encode the convergent verdict.

**D1 — Q1 verdict = `tighten`.** Pre-run summary line + `council quota` subcommand + `warn_at` knob (default 0.8). Per-call increment logging on stdout rejected (noise floor too high for the package's solo-dev audience).

**D2 — Q2 verdict = `redesign` via Option D (two-tier).** `agent` invocation keeps `educate` default; `user_explicit` invocation gets new `warn-only` default. Reconciles "Council always active when enabled" with "skip trivial agent-side requests".

**D3 — Q3 verdict = `tighten`.** Single JSON-line append to `agents/council-events.log`. Not `session.md` (different lifetime), not rolling files (out of scope for solo-dev tooling). Privacy floor enforced via sha256 hash of `original_ask`.

**D4 — Warn-at default is 0.8.** Survey-style data not available; 0.8 is the standard ops-monitoring threshold. User-tunable via `.agent-settings.yml`.

**D5 — Kill-switch `AGENT_CONFIG_NO_EVENTS_LOG=1`** mirrors Step 7's `AGENT_CONFIG_LEGACY_ANCHOR=1` pattern. Documented in `docs/installation.md`.

**D6 — Cross-validation follow-up.** When Anthropic capacity recovers, re-run the audit. If Anthropic disagrees with Option D or the events-log shape, the divergence lands as a follow-up roadmap (Step 8.1), not a Step 8 blocker.

## Phase-dependency map

```
Phase 1 (quota observability) ──┐
                                 ├──> Phase 4 (docs) ──> Phase 5 (tests + CI)
Phase 2 (necessity tier split) ─┤
                                 │
Phase 3 (events log) ───────────┘
```

Phases 1, 2, 3 are mutually independent — each touches a distinct symbol surface. Phase 4 + 5 fan-in after all three land.

## Council brief

Token usage OK. Polled lens: analysis (audit verdict). Two providers configured; Anthropic `OverloadedError 529` on both attempts (run-1 + run-2 with 8 s spacing). OpenAI GPT-4o consistent across both runs — verdict per Q1/Q2/Q3 unchanged between passes. Open follow-up: Anthropic cross-validation when capacity recovers (D6).
