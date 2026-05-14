---
stability: beta
keep-beta-until: 2026-08-12
---

# AI-Council Config (`agents/.ai-council.yml`)

**Purpose.** Lock the schema, validation, and precedence rules for the
centralized council config file. Every later phase of
[`step-2-ai-council-consolidation.md`](../../agents/roadmaps/step-2-ai-council-consolidation.md)
reads from this file; the contract here is the boundary that prevents
drift across the loader, the CLI, the orchestrator, and the
`agents/.ai-council.yml` file itself.

**Audience.** Authors of `scripts/ai_council/config.py`, `council_cli.py`,
`scripts/ai_council/orchestrator.py`, and the `agents/.ai-council.yml`
starter. Also reviewers checking that new providers / advisors / debate
features keep the schema intact.

**Status.** Internal-locked. Changes require a contract version bump and
a revision entry in the consuming roadmap.

## File location

The single source of truth is **`agents/.ai-council.yml`** at the
project root. The legacy `ai_council.*` block under `.agent-settings.yml`
is removed by Phase 0 Step 5 and replaced by a one-line breadcrumb
pointing at this contract.

## Top-level schema

```yaml
enabled: <bool>                 # master switch, required
defaults:                       # per-invocation defaults, required
  mode: <"api" | "manual">
  min_rounds: <int >= 1>
  deep_min_rounds: <int >= min_rounds>
  max_output_tokens: <int >= 0>           # 0 widens to provider ceiling
  session_retention_days: <int >= 0>      # 0 disables pruning
  debate_max_rounds: <int >= 2>           # reserved by Phase 0, wired in Phase 7
cost_budget:                    # hard caps per /council invocation, required
  max_input_tokens: <int >= 0>            # 0 disables this cap
  max_output_tokens: <int >= 0>           # 0 disables this cap
  max_calls: <int >= 0>                   # 0 disables this cap
  max_total_usd: <number >= 0>            # 0 disables the USD ceiling
members:                        # per-provider blocks, at least one enabled
  <provider>:
    enabled: <bool>
    model: <string>
    api_key_ref: <string>                 # see `api_key_ref` forms below
    mode: <"api" | "manual">              # optional override of defaults.mode
advisors:                       # Thinking-style replace-mode advisors
  <advisor-key>:
    enabled: <bool>
    member: <provider>                    # required; references members.<provider>
    model: <string>                       # optional; overrides member.model
    persona: <path>                       # optional; defaults to personas/advisors/<advisor-key>.md
```

Supported `<provider>` keys: `anthropic`, `openai`, `gemini`, `xai`,
`perplexity`. Unknown providers fail validation closed.

### Advisor block (Phase 6, replace-mode)

Five built-in advisor keys ship under
[`.agent-src.uncompressed/personas/advisors/`](../../.agent-src.uncompressed/personas/advisors/):
`contrarian`, `first-principles`, `expansionist`, `outsider`,
`executor`. Each entry binds one advisor to one enabled provider. When
`enabled: true`, the orchestrator REPLACES that provider's plain-member
call with the advisor-persona call — the run keeps the same total call
count as a plain run.

- `member` is required and must name a known provider. The validator
  rejects an enabled advisor whose `member` is missing from the
  `members` block, OR exists but has `enabled: false` — silent skips
  on the spend path are not allowed.
- `model` is optional. When omitted, the advisor inherits its bound
  member's `model`. When set, it overrides for that advisor call only.
- `persona` is optional. When omitted, the loader resolves the file at
  `personas/advisors/<advisor-key>.md` relative to the package root.

### Advisor persona labels in peer-review (preserve-persona)

Phase 5 peer-review anonymisation strips provider/model identity per
the Iron Law of Neutrality. On an advisor-mode run, the anonymisation
step preserves the **advisor persona label** as signal — peer-review
output renders as `Response A (Contrarian)`, never
`Response A (Anthropic Opus)`. Plain runs strip identity entirely.
Hard-coded behaviour — no flag, no opt-out.

## `api_key_ref` forms

Exactly two forms. Raw keys in the yml are a hard validation error.

- `file:<path>` — read from a 0600 file. Relative paths resolve under
  `~/.event4u/agent-config/`; absolute paths are honored as
  written. The legacy `~/.config/agent-config/` location is still read
  as a fallback by `scripts/_lib/user_global_paths.py`.
- `env:<VAR>` — read from the named environment variable at load time.
  Missing or empty env var is a `KeyGateError`.

## Precedence

Resolution order for every member-level setting (mode, model, key):

```
invocation flag  >  per-member field  >  defaults block  >  built-in fallback
```

Same shape applies to round counts (`--rounds N` > `defaults.min_rounds`,
plus the `deep_min_rounds` floor when `--depth deep` or a consuming
artefact's `council_depth: deep` frontmatter fires).

## Normative behaviour — migrated verbatim

These rules are part of the contract; the consuming YAML reproduces them
as comments and the loader enforces them.

- **Iron Law of Neutrality.** Council members never see the host agent's
  reasoning — only the artefact + a neutral system prompt. Phase 6 Step 3a
  preserves advisor persona labels in peer-review but strips provider
  identity.
- **Autonomy carve-out — no silent spend.** The `/council` command always
  asks before invoking, even under autonomy: on. Cost is real and paid.
- **Manual vs API transport.** `api` = direct SDK call against the
  provider's API (billable). `manual` = copy-paste loop, user is the
  transport (free). Per-invocation flag > per-member override > defaults.
- **Tokens never stored in this yml.** Keys live in 0600 files
  (`~/.event4u/agent-config/<provider>.key`, installed via
  `bash scripts/install_<provider>_key.sh` for providers that ship an
  installer) or in env vars. Validation rejects any literal-looking key.
- **`max_output_tokens: 0` widening.** Internally widened to the safe
  provider ceiling (16384) because Anthropic rejects `max_tokens=0`. The
  CLI `--max-tokens` flag overrides this on a single invocation; the
  cost estimator uses the same value as its worst-case ceiling.
- **`deep_min_rounds` is monotonic.** Effective rounds =
  `max(deep_min_rounds, min_rounds)`. Lowering `deep_min_rounds` below
  `min_rounds` has no effect. Standard tasks keep `min_rounds`; cost
  rises only when an artefact opts in via `council_depth: deep` in
  frontmatter or `--depth deep` on the CLI.
- **Session retention.** `agents/council-sessions/` audit folders older
  than `defaults.session_retention_days` are pruned automatically on the
  next `save()`. `0` disables pruning — disk grows unbounded.
- **`cost_budget` semantics.** The orchestrator pauses before any member
  whose projected spend would breach a cap and asks the user to continue.
  Each `0` value disables that single cap; other caps still apply.
  Prices come from [`agents/.agent-prices.md`](../../agents/.agent-prices.md)
  (gitignored, refreshed weekly by `python3 scripts/update_prices.py`;
  bootstrapped from `scripts/ai_council/_default_prices.py` on first run).

## Validation rules

A loader call (`scripts/ai_council/config.py:load_council_config()`)
must reject the file with a clear `KeyGateError` (or equivalent typed
error) when any of these hold:

1. Required top-level key missing (`enabled`, `defaults`, `cost_budget`,
   `members`).
2. `members` block has no provider with `enabled: true`.
3. Unknown provider key under `members` or `advisors`.
4. `api_key_ref` missing for an enabled member, or in an unknown form
   (not `file:` and not `env:`), or pointing at a non-existent file /
   missing env var.
5. A value under `api_key_ref` looks like a raw secret (starts with
   `sk-`, `pk-`, `xai-`, or matches a provider's key prefix).
6. `defaults.deep_min_rounds < defaults.min_rounds` is allowed (clamped
   by the monotonic rule at runtime) but logged as a warning.
7. `defaults.mode` not in `{"api", "manual"}`; per-member `mode` override
   same constraint.
8. `advisors.<key>.member` missing, unknown, or pointing at a
   `members.<provider>` that does not exist or has `enabled: false`
   (when the advisor itself is `enabled: true`). Silent skips are not
   allowed — a typo never costs the user money on an unintended call
   plan.
9. `advisors.<key>.model` is set but not a string.

## Migration footprint (Phase 0)

- `.agent-settings.yml` → 14-key inventory under `ai_council:` removed
  after a one-line breadcrumb comment is in place pointing at this
  contract.
- `.agent-settings.template.yml` → same removal.
- New file `agents/.ai-council.yml` checked in with two enabled
  providers (anthropic + openai) and three disabled
  (gemini + xai + perplexity). Models pre-filled from the Phase 0
  default set; comments mirror this contract.
