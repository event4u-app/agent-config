# Provider Budget Balancer — Verdict (2026-07-10)

Durable disposition of the cross-provider quota-aware distribution design.
Orthogonal to the 2026-07-08 `cost-aware-model-routing-verdict.md` (tier
downshift WITHIN Claude, shipped M1–M4) — this covers the PROVIDER dimension:
distribute calls so no subscription volume sits half-unused while another
provider is exhausted and billable API tokens get burned.

## Hard constraints (verified, not design choices)

1. **Host subagents are Claude-only.** The Claude Code Agent tool cannot
   dispatch a subagent to a non-Anthropic model. Cross-provider dispatch
   exists only on the AI-council client surface
   (`src/scripts/ai_council/clients.ts`; members anthropic/openai/gemini/
   xai/perplexity; transports `manual | api | cli`).
2. **No provider exposes remaining quota.** Balancing runs on
   self-maintained local counters + user-declared window/volume config —
   always an approximation, never a provider read.
3. **Billing asymmetry is the lever.** `cli` transport with vendor-official
   CLIs runs on subscription auth (billable=false); `api` transport and
   community CLI wrappers are pay-per-use (billable=true).

## Decision (v1, council-locked)

- **Q1 — Config + ledger:** `provider_budgets.<provider>: {window, max_calls}`
  with ROLLING windows (window starts at first call after reset), persisted
  in `~/.event4u/agent-config/cli-calls.json` alongside the existing UTC-day
  counter. UTC-day-only was rejected in round 2: for Claude-style 5h rolling
  windows a per-day counter marks the provider exhausted after the first
  window and wastes the remaining windows of the day — the exact failure the
  feature exists to prevent. Mitigation for window misalignment: declare
  **conservative buffers** (window slightly longer, max_calls slightly lower
  than the real plan — e.g. real 5h/40 → declare 5h15m/38) so error always
  fails safe (undercount availability, never overcount). Calls-only in v1;
  no token tracking (CLI transports don't report tokens reliably).
  Back-compat: `cli_call_budget.max_calls_per_day` keeps working;
  `provider_budgets` wins on conflict (validation warning).
- **Q2 — Balancing policy (unanimous):** **billability-first, then
  remaining-ratio.** Where one provider must be picked (solo dispatch,
  `solo_member_fallback_chain` ordering): non-billable members with
  remaining declared volume first, ranked by remaining-ratio; then billable
  members; exhausted members dropped; all-exhausted → existing `block_quota`
  path. `routing.balance: on|off`, **default on** (it only reorders an
  existing fallback chain; a reordering that saves money needs no opt-in).
  **Debate mode is exempt** — it polls all enabled members on purpose;
  perspective diversity outranks cost there.
- **Q3 — Host-subagent coupling: none in v1.** The quota report makes the
  pressure visible to the human; no advisory knob, no coupling into the
  M1–M4 tier policy. Revisit-if: telemetry shows recurring mid-session
  quota exhaustion where an advisory would have changed routing.
- **Q4 — Scope guard (unanimous):** v1 is exactly (a) rolling-window
  generalization of the counter, (b) billability-first ordering,
  (c) `council quota` report with remaining % + reset ETA. **Rejected for
  v1:** drain-expiring-first policy, token budgets, a policy engine,
  host-subagent advisory — all deferred until telemetry shows the fallback
  chain fires often enough to justify them.

## Revisit-if

- Fallback-chain traversal to a second provider becomes frequent (>~50/day)
  AND measured cost delta between remaining-ratio and drain-expiring is
  material → re-evaluate drain-expiring-first.
- CLI transports start reporting token counts reliably → re-evaluate
  `max_tokens` budgets.
- A host gains true multi-provider subagent dispatch → re-open Q3 (the
  Claude-only constraint is the only reason the subagent layer is excluded).

## Council provenance

anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-07-10, 2 rounds ($0.10):
Q2/Q4 unanimous round 1; Q1 contested (UTC-day vs rolling) and resolved in
round 2 for rolling-with-buffers; Q3 resolved by the Q4 minimal-scope
principle. Rejected: trained/preference routers, external proxy routers,
LLM classifiers (carried over from the 2026-07-08 routing verdict).
