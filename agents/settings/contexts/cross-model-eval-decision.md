# Cross-model eval — vendor prereqs + tier decision (T-002)

> Roadmap: `road-to-operator-runtime-harvest`, Phase 0. This is the **human-gated**
> step's decision record, filled with the real environment state observed during
> autonomous Phase-0 execution. It is the gate the live smoke (T-004) and baseline
> (T-006) wait on.

## Vendor credential status (observed)

| Vendor | Role | Key present | Usable now |
|---|---|---|---|
| Anthropic (Claude) | host #1 / baseline | `~/.event4u/agent-config/anthropic.key` ✅ | ⚠️ **transport flaky** — `curl ETIMEDOUT` on 2 of 3 council calls in this environment |
| OpenAI (the roadmap's "Codex") | host #2 | `~/.event4u/agent-config/openai.key` ✅ | ✅ key works (council billed `gpt-4o` successfully) |
| Gemini | host #3 | — **absent** ❌ | ❌ no key at all |

## Decision — T-004 live smoke is BLOCKED

Per this roadmap's own Iron rule (*"no credits → explicit BLOCK on the smoke; never
claim parity on mocks"*), the cross-model parity smoke **cannot run** to a
trustworthy result in this environment:

- **Host #3 (Gemini) is hard-blocked** — no key. A two-host run cannot substantiate
  a "Claude/OpenAI/Gemini" parity claim.
- **Host #1 (Anthropic) transport is unstable here** — even the baseline leg would
  flap on `ETIMEDOUT`, so a green reading would be an artifact of the network, not
  parity.
- Host #2 (OpenAI) is the only fully-usable leg — insufficient alone.

Consequently the following are **deferred on credentials**, not done, not faked:
T-004 (smoke), T-006 (baseline + outcome read), and everything gated on T-006 —
Phase 1 (`finding_floor`), Phase G (overlays), Phase 0b (format governance).

## Tier decision (recorded; wiring deferred to when the smoke can run)

- **`gate`** — one cheap cross-vendor canary per PR (T-005), to surface vendor
  model-update drift fast. Net-new CI infra (no `EVALS_TIER` exists today).
- **`periodic`** — the full cross-vendor matrix (T-004), cost-bounded.
- **CI parallel-vs-serialize** — OPEN; decide when wiring T-005 (serial ≈ 3× build
  time across three vendors).
- **Per-run cost** — not estimable until a real run; OpenAI leg is the only priced
  reference so far (~cents per council-scale call).

## What unblocks this (the ask)

1. **Provide a Gemini API key** (install alongside `anthropic.key` / `openai.key`),
   or explicitly drop Gemini from the parity scope (and from the repositioning
   narrative — see the roadmap's Cursor honesty-coupling).
2. **Confirm the OpenAI key may be reused** by the eval `CodexRouter` (not only the
   council), or supply a dedicated eval key.
3. **Resolve the Anthropic transport timeout** in the execution environment (or run
   the smoke where Anthropic is reachable), so the baseline leg is stable.

Once 1–3 hold, T-004's `CodexRouter`/`GeminiRouter` can be built on the verified
injectable `TriggerRouter` seam (`skill_trigger_eval.ts:124`) — adding per-vendor
key gates *alongside* the `sk-ant-` gate (`:416`), never weakening it — and the
smoke can produce a real per-host result the rest of the chain calibrates on.

## UPDATE — RESOLVED (Gemini key provided)

The blocker is cleared. `gemini.key` is installed (`0600`); all three vendor
legs were confirmed reachable by direct call (`HTTP 200` each). The earlier
"Anthropic transport flaky" symptom was a **council-CLI transport artefact**,
not a reachability problem — direct HTTP to `api.anthropic.com` works.

T-004 was built (SDK-free fetch routers in `src/scripts/_lib/trigger_routers.ts`)
and **run live** — see `agents/evidence/cross-model-baseline.md`. Headline:
routing accuracy diverges (haiku 70% / gemini 90% / openai 100% on a thin 1-skill
slice — likely a tier/capability effect, not a behavior gap) and **Gemini
diverged on output format (80% parse)** → council outcome **(c) fired**, so
Phase 0b (format governance) is now evidence-backed. Overlays stay shelved
(no clean behavior-gap signal on a capability-confounded thin slice).

Remaining open (not credential-blocked any more — these are scope/cost calls):
T-005 gate-tier canary (running paid cross-vendor calls per-PR needs a
cost-bounded design first), wider coverage than 1/258 skills, and the
finding_floor calibration (needs the wider run).
