---
complexity: structural
status: ready
---

# Road to API-cost optimization — cut the dollar bill of paid LLM calls

> Two axes, one mechanism family (API **dollar** cost, distinct from the
> parked context-token-projection work — see the decision-revisit note below):
> **(A) the package's own paid spend** — the AI council is the only surface in
> this repo that makes real billed API calls (`src/scripts/ai_council/`), and it
> currently uses **no prompt caching, no Batch API, no retry/backoff, and only
> suggestion-only model-tiering**; **(B) the consumer cost-guidance surface** —
> what the package teaches downstream agents about cutting *their* API bill
> (prompt caching, Batch-for-non-interactive, model-tiering, effort/output
> budgets). Grounded in the `claude-api` skill (authoritative, cache 2026-06-24)
> + web research 2026-07-14, and in a live code scout of `ai_council/` and the
> cost-guidance surface.

## Not a relitigation of the token-saving locks

The parked/killed mechanisms (`thin-projection quality FAILS`, token-cluster
re-scope, `road-to-token-saving`) all concern **context-token projection** —
how many tokens of rules/skills load into an agent's context window. This
roadmap concerns a **different mechanism**: the *per-token dollar cost* of
billed API calls (cache-read repricing, 50% batch, cheaper model tiers). Per
the decision-revisit gate, a verdict settles the mechanism it tested; these
levers were never measured or locked, so they proceed. Nothing here flips the
thin projector or re-opens any parked lever.

## Goal

**Axis A:** every billed council call pays the lowest correct price — the
large, byte-stable `system + artefact` prefix sent identically to every member
is cached (~10% input cost on reads); independent round-1 calls that are not
latency-sensitive can run through the Batch API (−50%); small/low-impact
artefacts auto-tier to a cheaper model instead of only *suggesting* it; the
cost estimator models cache + batch so the pre-flight budget gate stops
over-charging worst-case. **Axis B:** the package carries a single, discoverable
piece of Claude-API cost guidance (prompt-caching discipline, Batch-for-batch-
workloads, model-tiering, effort/output budgets) wired into the existing
cost-profile / token-optimizer surface — **extending** existing artefacts, not
adding new skill sprawl.

Every lever lands with fresh verification evidence (a real council run showing
`cache_read_input_tokens > 0`, an estimator unit test, a lint/CI pass). No lever
ships on an estimate alone.

## Context — verified on the live checkout (worktree `feat/cost-optimization`), 2026-07-14

### Axis A — council paid-API surface (`src/scripts/ai_council/`)

- **3 billable call sites**, all through `member.ask(system, user, max_tokens)`:
  `orchestrator.ts:629` (main fan-out), `orchestrator.ts:705` (repair re-prompt),
  `low_impact.ts:635` (fast-path). Single billable client file: `clients.ts`.
- **Transport is hand-rolled synchronous `curl` POST** (`_curlJsonPost`,
  `clients.ts:300-332`) — no vendor SDK. Anthropic call sends `system` as a
  **plain string** + `messages:[{role:'user',content:user_prompt}]`
  (`clients.ts:384-389`).
- **No prompt caching anywhere** — repo-wide grep for `cache_control` /
  `ephemeral` / `cache_read` / `anthropic-beta` returns zero hits on any API
  path. `pricing.ts` / `_default_prices.ts` have **no cache columns**
  (`input_per_1m_usd` / `output_per_1m_usd` only) — cache economics are not
  even representable in the estimator.
- **No Batch API** — grep `batches` / `/messages/batches` → zero hits.
- **Shared prefix is stable and cacheable:** `base_system_prompt` computed once
  and reused for every plain member (`orchestrator.ts:597-605`);
  `question.user_prompt` (the large `bundler.ts` artefact) sent **byte-identical**
  to every member (`orchestrator.ts:631`, `:707`). No timestamps / UUIDs /
  `Date.now()` injected into prompt strings — the prefix caches cleanly; clock
  lives only in response metadata (`clients.ts:168-186`). Dispatch is
  **sequential** (`orchestrator.ts:11`), so member 2..N in a round and every
  round-2+ call within the 5-min TTL would be cache reads.
- **Model-tiering is suggestion-only:** `model_ladder` per member + size
  classifier (`config.ts:374`, `necessity.ts:334-526`) emit a `downgrade_message`
  to the user (`necessity.ts:517-527`) but never auto-switch. Defaults
  (`clients.ts:68-93`): Anthropic `claude-sonnet-4-5` ($3/$15), OpenAI `gpt-4o`,
  Gemini `gemini-2.5-pro`, xAI `grok-4`, Perplexity `sonar-pro`.
- **`max_tokens` default:** `max_output_tokens: 0` in the shipped template →
  widened to `UNLIMITED_TOKENS_FALLBACK = 16384` (`clients.ts:106`). The
  estimator bills the full ceiling as worst case (`pricing.ts:74-99`), so the
  pre-flight gate systematically over-estimates.
- **No retry/backoff on the paid path** — `_curlJsonPost` does a single POST;
  any non-2xx (incl. 429) throws immediately (`clients.ts:328-329`). 429
  awareness exists only in the CLI clients' stderr classifier, not the HTTP path.
- **Spend tracking already rich:** `budget_guard.ts` (24h USD ledger at
  `~/.event4u/agent-config/council-spend.jsonl`), pre-flight gate in the
  orchestrator (`:306`, `:317`, `:400`), actual `input_tokens`/`output_tokens`
  recorded from `usage` (`clients.ts:139-141`). `cost_budget` knobs live in
  `.ai-council.yml` (ADR-104 global-only).

### External cost facts (claude-api skill + web 2026-07-14)

- **Prompt caching:** cache reads ~0.1× base input; writes 1.25× (5-min TTL) /
  2× (1-h). Break-even after **one** read on the 5-min TTL. Prefix-match — any
  early byte change invalidates the suffix. Cache is **workspace-isolated**
  (since Feb 2026). Verify via `usage.cache_read_input_tokens`.
- **Batch API:** −50% on input **and** output, async (≤24h, usually ≪1h),
  results keyed by `custom_id` (arrive unordered). Not for interactive/latency-
  sensitive paths. **Stacks with caching** (cached-batch input can reach ~0.05×).
- **Model tiering:** Haiku $1/$5, Sonnet $3/$15, Opus $5/$25, Fable $10/$50 —
  Opus ≈5× Haiku input.
- **Effort / output budgets:** `output_config.effort` (low→max) and right-sized
  `max_tokens` are the primary output-cost levers.

### Axis B — consumer cost-guidance surface (live scout, 2026-07-14)

- **Cost machinery is mature on token hygiene:** `/cost` orchestrator
  (`src/domains/meta/cost/command.md`), `/cost:report`
  (`.../report/command.md`, session cost via `scripts/cost/track.mjs` →
  `agents/cost-tracking/sessions.jsonl`, 50/75/90/100% alert ladder),
  `/cost:profile` (= `/set-cost-profile`, mutates `rule_loading_tier`),
  `token-optimizer` skill (a **pure decision-tree + catalog INDEX** —
  `src/skills/token-optimizer/SKILL.md`), scripts
  `src/scripts/cost/{track,budget,preflight}.mjs`, `cost.budgets` +
  `cost.enforcement` (`template.yml:159-179`, advisory vs hard-stop).
- **Frugality canon** (`token-efficiency`, `token-budget-discipline`,
  `telegraph-speak`, `direct-answers`; index `frugality-charter.md`) and the
  **subagent cost story** (`subagent-orchestration` tier-sizing,
  `delegation-policy`, `subagents.downshift` / `quota_arbitrage`
  `template.yml:571-588`) are well developed.
- **Policy already stated:** `/cost:report` (command.md:67-77) tells consumers
  the **model tier is the dominant spend lever (~10× delta)**, not
  `rule_loading_tier`. Cost-cutting is deliberately steered toward model-tiering.
- **The gap = Anthropic-platform *billing* levers.** Prompt caching is mentioned
  **once**, buried and scoped to sibling-subagent prefixes
  (`src/skills/subagent-orchestration/prompts/README.md:25-34`). Batch API:
  **absent**. Effort is framed only as a quality knob (even warning high effort
  "wastes tokens"), never as a cost-down lever. Model-tiering is quality-framed
  in `model-recommendations.md`, not cross-linked to `/cost:report`'s
  lever-order note. There is **no consolidated Claude-API-cost reference** — the
  `claude-api` skill in-session is an external Claude Code plugin, **not**
  authored by this package.
- **Sprawl-free landing (scout recommendation):** extend the `token-optimizer`
  decision-tree + catalog (the repo's own designated index) to cite **one new
  reference doc under `docs/guidelines/`** covering caching / batch / effort /
  tiering as API-bill levers, plus targeted one-liners in `token-efficiency`,
  `subagent-orchestration`, and `model-recommendations`. **No new skill file** —
  the size-enforcement + skill-sprawl contracts forbid it.

## Council review — convergence (2026-07-14, deep, 3 rounds; anthropic/claude-sonnet-4-5 + openai/gpt-4o; actual $0.14)

Both members converged; the roadmap below folds their findings in:
- **Merge A1+A2** — `max_tokens` is part of the Anthropic cache key, so landing
  the right-size after caching forces a cold-cache spike. Do both in one commit.
- **A1↔A3 model-scoped cache coupling (CRITICAL)** — Anthropic's cache is keyed
  by `(model, prefix)`, so a member auto-downgraded to a cheaper model gets a
  cache **miss**. Auto-tiering can therefore evaporate cache savings → A3 is
  gated on net-positive economics and **sequenced after A1 is measured** (A3 is
  a follow-up, not in the A1 PR).
- **Estimator conservative default** — default to a 0% cache-hit rate and log
  the scenario, so the pre-flight budget gate never under-predicts.
- **A4 (Batch) is a decision, not a phase** — the council is invoked
  interactively (median run seconds); the Batch API is async (≤24h, usually <1h)
  = ~40× worse latency and only helps non-interactive bulk cohorts, of which no
  council entrypoint exists → **defer, documented** (below).
- **B2 points other artefacts at the token-optimizer INDEX**, not the guideline
  directly (single source of truth; avoids N+1 pointer maintenance + the
  preservation-doctrine duplication `check_condensation` guards).
- **Cost-neutral acceptance check** — all-optimizations-off ≤ baseline.
- **A1 is Anthropic-path-only** — must no-op cleanly for OpenAI/Gemini/xAI.

**One council fact overridden by the authoritative source:** both members
(2024-era training) asserted caching needs `anthropic-beta:
prompt-caching-2024-07-31`. The current `claude-api` skill (authoritative, 2026)
states prompt caching is **GA — no beta header**. Implementation follows the
skill; **no beta header is added** (per source-discovery: real current source
over model memory).

## Phase A1+A2 — Prompt caching + right-sized output on the paid Anthropic path (single commit)

- [x] Anthropic-path only: convert the request builder (`clients.ts:384-389`) to
      the block-array `system` form with a `cache_control:{type:'ephemeral'}`
      breakpoint at the end of the stable shared prefix (the `base_system_prompt`
      that `orchestrator.ts:597-605` reuses byte-identically across members). **No
      beta header (GA).** Gate behind a config flag (default on) with a documented
      kill-switch; log the observed cache-hit rate. Non-Anthropic clients
      (OpenAI/Gemini/xAI/Perplexity) are untouched — the flag no-ops for them.
      **Same commit:** lower the `max_output_tokens` fallback 16384 → 4096
      (`clients.ts:106`) so the cache populates with the final `max_tokens` from
      day 1 (no cache-key churn). Verify: a real 2-member council run shows
      `cache_read_input_tokens > 0` on member 2.
- [x] Model cache economics in `estimate_cost` as **derived constants** (read
      0.1×, write 1.25× 5-min / 2× 1-h of the input rate) **without** changing the
      byte-frozen `.agent-prices.md` table format (`pricing.ts:11` warns the row
      format is pinned). Estimator defaults to a conservative **0% cache-hit
      rate** and logs which scenario it used. Verify: estimator unit test asserting
      the repriced total + the conservative default.
- [x] Record `cache_creation_input_tokens` / `cache_read_input_tokens` from
      `usage` into `CouncilResponse` (`clients.ts:423-430`) + the spend ledger
      (`budget_guard.ts`). Verify: a ledger entry carries the new fields.
- [x] Right-size verification is falsifiable: run the largest / ~90th-percentile
      artefact fixture through a deep council; assert no truncation markers and
      `output_tokens < 4096` for ≥80% of members; if ≥20% saturate, raise to 6144
      and re-test.

> **Verification (2026-07-14, live standard run on this roadmap artefact):**
> caching **engages** — the Anthropic member reported `input_tokens=3` with
> `cache_creation_input_tokens=11035` (the ~11k system+artefact prefix was
> written to cache), and the new fields now serialize into the response JSON.
> **But** `cache_read_input_tokens=0` on the multi-round single-member path:
> `base_system_prompt` is stable but below the min cacheable size, while the
> per-round critiques fold into `question.user_prompt`, so round 2's user-block
> prefix differs → a re-write, not a read. **Realized reads today:** same-provider
> fan-out (`--siblings`) and repeated-artefact reviews within the 5-min TTL
> (e.g. `/council` then `/council:pr` on the same diff). The universal
> cross-round read is the A3-adjacent follow-up below. The write premium on a
> pure-write run is ~1.25× input on the cached span (≈ $0.008/call) — negligible,
> and the estimator's conservative 0%-hit default keeps the budget gate honest.

## Phase A3 — (follow-up, sequenced AFTER A1 ships + is measured) cache-coupling-gated auto model-tiering

- [ ] PRECONDITION: verify how `necessity.ts:334-526` defines "small" (byte vs
      token vs heuristic); a token-based classifier adds a tokenizer dependency +
      a pre-flight call under the sequential-dispatch constraint
      (`orchestrator.ts:11`) — document it.
- [ ] Wire the size classifier + `model_ladder` (`config.ts:374`) to
      **auto-downgrade** (not just suggest) small / low-impact artefacts + the
      `low_impact.ts:635` fast-path to a cheaper tier, behind an opt-out flag,
      `debate` lens excluded — **gated on the A1↔A3 coupling:** downgrade only when
      `downgrade_savings > lost_cache_savings` (a downgraded member misses the
      model-scoped cache). Add a per-artefact `model_tier_override` escape hatch in
      `.ai-council.yml`. Verify: a small low-impact run downgrades only when
      net-positive; ledger shows the cheaper model + lower total.
- [ ] Tighten the repair re-prompt (`orchestrator.ts:705`) to fire only on a
      genuinely unparseable STANCE. Verify: well-formed round → zero repair calls;
      injected malformed STANCE → ≥1 repair, ≤ `max_repair_attempts`.
- [ ] **Cross-round read unlock (from the A1 verification finding).** Restructure
      the round prompt so the cached span is a byte-stable `[base_system +
      artefact]` prefix and the per-round critiques ride in a **trailing** block
      after the breakpoint (per Anthropic's "freeze the system prefix" guidance).
      Needs `ask()` (all clients) to accept a stable-artefact + volatile-suffix
      split, and the rounds loop to stop folding critiques into
      `question.user_prompt`. Quality-sensitive (changes prompt structure) — gate
      on a council output-quality spot-check. Verify: a multi-round single-member
      run shows `cache_read_input_tokens > 0` on round 2 and a lower realized cost
      than the pre-A1 baseline.

## Phase A4 — DECISION (council-convergent): defer the Batch API

- [x] **Decided 2026-07-14 — DEFER.** The council is invoked interactively
      (median run in seconds); the Batch API is async (≤24h, usually <1h) ≈ 40×
      worse latency, and applies only to non-interactive bulk cohorts, of which no
      council entrypoint exists. Recorded as a future option **if** a
      non-interactive bulk-review entrypoint is ever added (then it would carry
      `custom_id` keying + a `batch_state.json` durability file + partial-failure
      policy). No implementation this cycle.

## Phase B1 — One consolidated Claude-API cost-lever reference (guideline, not a skill)

- [x] Author `docs/guidelines/agent-infra/api-cost-levers.md` (English, per the
      `.md`-language rule): the four platform billing levers with the concrete
      economics from the `claude-api` skill — (1) **prompt caching** (put stable/
      large context — system prompt, tool defs, corpus, repo map — behind a cache
      breakpoint, volatile tail last; reads ~0.1×, writes 1.25×/2×, break-even
      after 1 read, workspace-isolated); (2) **Batch API** for non-interactive/
      bulk work (−50%, async ≤24h, stacks with caching); (3) **model tiering** as
      an explicit cost lever (Haiku/Sonnet/Opus/Fable rate table, ~5× Opus:Haiku);
      (4) **effort + `max_tokens` right-sizing** (dial effort DOWN on routine
      turns). Verify: `md-language-check` + reference checker green.

## Phase B2 — Wire the reference into the existing index + canon (extend, don't duplicate)

- [x] Add a decision-tree branch + catalog row to the `token-optimizer` skill
      (`src/skills/token-optimizer/SKILL.md`) — "large stable context reused
      across turns / non-interactive bulk cohort / cost-aware model+effort
      decision → cite `api-cost-levers`" — and update the
      `token-optimizer-maintenance` rule catalog so the CI freshness gate covers
      the new row. Verify: `check_token_optimizer_freshness` + skill linter green.
- [~] (deferred follow-up) Add targeted one-line pointers that reference the **token-optimizer index
      branch** (NOT the guideline directly — single source of truth, per council)
      from `token-efficiency` rule (caching discipline), `subagent-orchestration`
      skill cost section (non-interactive bulk cohorts → batch), and
      `model-recommendations.md` / `model-recommendation` rule (cost-tier
      cross-link to `/cost:report`'s dominant-lever note). Verify: reference
      checker green; no Iron-Law / preservation regressions (`check_condensation`).

## Acceptance criteria (this PR = A1+A2 + B1+B2; A3 is a measured follow-up, A4 decided)

- [x] A real council run demonstrates the paid Anthropic caching path **engages**
      (`cache_creation_input_tokens=11035`, `input_tokens=3`), with the cache-token
      fields serialized into the response JSON. Cross-round `cache_read > 0` is the
      A3 prefix-stability follow-up (measured finding above); reads land today in
      same-provider fan-out + repeated-artefact-within-TTL.
- [x] The cost estimator models cache-read/write via derived constants (table
      format untouched) and defaults conservatively (0% cache-hit); unit tests
      cover the repriced totals and the default.
- [x] **Cost impact honestly bounded:** reads net-save (~0.1× input); a
      pure-write run adds ~1.25× on the cached span (≈ $0.008/call), and the
      estimator's 0%-hit default keeps the pre-flight gate from under-predicting.
      Kill-switch (`prompt_cache: false`) restores exact baseline.
- [x] Consumer cost-guidance lands by extending existing artefacts (one new
      guideline + `token-optimizer` index wiring, no new skill); freshness gate +
      condensation `--check` + changed-files typecheck green. (Cross-link pointers
      into `token-efficiency`/`subagent-orchestration`/`model-recommendations`
      deferred — index is the single source of truth.)
- [x] No context-token-projection lever is touched; no parked decision reopened.
- [x] A3 (auto-tiering + cross-round read unlock) remains open as the follow-up,
      explicitly sequenced after A1 is measured (council directive).
