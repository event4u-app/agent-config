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
  mode: <"api" | "manual" | "cli">
  min_rounds: <int >= 1>
  deep_min_rounds: <int >= min_rounds>
  max_output_tokens: <int >= 0>           # 0 widens to provider ceiling
  session_retention_days: <int >= 0>      # 0 disables pruning
  debate_max_rounds: <int >= 2>           # reserved by Phase 0, wired in Phase 7
cost_budget:                    # hard caps per /council invocation, required
  max_input_tokens: <int >= 0>            # 0 disables this cap
  max_output_tokens: <int >= 0>           # 0 disables this cap
  max_calls: <int >= 0>                   # 0 disables this cap
  max_total_usd: <number >= 0>            # 0 disables the USD ceiling — applies to billable transports: all `mode: api`, plus `mode: cli` for xai/perplexity (community CLIs that still consume the API key). Does NOT apply to vendor-official `mode: cli` (anthropic/openai/gemini) or to `mode: manual`
cli_call_budget:                # optional; per-day call-count guard for mode: cli members
  max_calls_per_day:
    <provider>: <int >= 0>                # opt-in per provider; default unset = unlimited
members:                        # per-provider blocks, at least one enabled
  <provider>:
    enabled: <bool>
    model: <string>
    api_key_ref: <string>                 # required for mode: api; optional for cli/manual
    mode: <"api" | "manual" | "cli">      # optional override of defaults.mode
    binary: <string>                      # optional; only valid when effective mode == "cli"
advisors:                       # Thinking-style replace-mode advisors
  <advisor-key>:
    enabled: <bool>
    member: <provider>                    # required; references members.<provider>
    model: <string>                       # optional; overrides member.model
    persona: <path>                       # optional; defaults to personas/advisors/<advisor-key>.md
necessity_classifier:           # Phase 6 — optional, default enabled+educate
  enabled: <bool>                         # master switch (default true)
  mode: <"off" | "educate" | "block">     # default "educate"
decision_replay:                # Phase 9 — optional, default enabled+full
  enabled: <bool>                         # master switch (default true)
  include_member_arguments: <bool>        # default true; false = redacted view
lens_overrides:                 # Phase 6 — optional, per-lens nudges
  necessity_classifier_mode:
    <lens>: <"off" | "educate" | "block">
lenses:                         # Phase 9 — optional, per-lens overrides
  <lens>:
    decision_replay:
      enabled: <bool>
      include_member_arguments: <bool>
```

Supported `<provider>` keys: `anthropic`, `openai`, `gemini`, `xai`,
`perplexity`. Unknown providers fail validation closed.

### Transport modes

Three first-class transports on the `mode:` axis. Resolution per member:
`per-member mode > defaults.mode > "api"`.

| Mode | Semantics | Billable | Auth | Cost gate |
|---|---|---|---|---|
| `manual` | Copy & paste — the human transports prompt + reply between the agent and an external chat surface. | No | None — human-in-the-loop | n/a |
| `api` | SDK call against a stored key, per-token billing on the provider's API. | Yes | `api_key_ref` (env or 0600 file) | `cost_budget` (full) |
| `cli` | Shell out to a locally-installed provider CLI. For `anthropic` / `openai` / `gemini` this runs under the user's subscription auth and is `billable=False`. For `xai` / `perplexity` (community wrappers) the CLI consumes the same API key as `mode: api` and remains `billable=True`. | Mixed — see below | CLI-managed OAuth (vendor) or API key in CLI env (community) | Vendor: `cli_call_budget.max_calls_per_day` only · Community: full `cost_budget` |

Implications:

- **`cost_budget.max_total_usd` applies to `mode: cli` for `xai` and
  `perplexity`.** Their CLIs (`grok`, `perplexity`) are community-built
  wrappers around the same paid API — `mode: cli` is an ergonomic
  shortcut, NOT a billing change. The orchestrator still runs the
  pre-call USD estimate and the budget gate for these two providers.
- **`cost_budget.max_total_usd` does NOT apply to `mode: cli` for the
  vendor-official CLIs (`anthropic`, `openai`, `gemini`) or to
  `mode: manual`.** All four are `billable=False`; the USD ceiling is
  a token-billing concept they don't participate in.
- **`api_key_ref` is required for enabled members whose effective mode
  is `api`, AND for `xai` / `perplexity` even in `mode: cli`** — the
  community CLI reads the key from its own env, but the agent still
  surfaces missing-key as a validation error before the call. The
  vendor-official CLIs (`anthropic`, `openai`, `gemini`) authenticate
  via their own login flow and need no `api_key_ref` in `mode: cli`;
  manual members have no key at all.
- **`binary:` is only valid when the effective mode is `cli`.** Setting it
  on an `api` or `manual` member is a hard validation error — no silent
  ignore, no clutter.
- **Subscription quotas:** Claude Pro 5h usage windows, ChatGPT Plus
  message caps, Gemini free-tier per-day limits all live outside this
  loader's view. `cli_call_budget.max_calls_per_day.<provider>` lets the
  user opt into a per-day cap; counter state persists at
  `~/.event4u/agent-config/cli-calls.json` with daily UTC reset (wired in
  Phase 1 of the CLI-transport roadmap).

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

### Necessity classifier (Phase 6, pre-flight gate)

A heuristic pre-flight that decides whether the request actually
warrants a full council deliberation. Three verdicts (`necessary`,
`borderline`, `unnecessary`) drive three exit paths in the dispatcher
(skip silently, educate + block, or proceed). Implemented in
[`scripts/ai_council/necessity.py`](../../scripts/ai_council/necessity.py);
wired into `council_cli.cmd_run` and `cmd_debate` before any member
is invoked.

**Configuration.**

- `necessity_classifier.enabled` (bool, default `true`) — master switch.
  `false` short-circuits the gate entirely; legacy "always run" behaviour
  is restored.
- `necessity_classifier.mode` (`"off" | "educate" | "block"`, default
  `"educate"`).
  - `off` — gate disabled while keeping the classifier module loaded
    (cheap toggle for experiments).
  - `educate` — agent-initiated invocation + `unnecessary` verdict skips
    silently with `skipped_reason: necessity_unnecessary` in
    `session.md`. User-explicit invocation + `unnecessary` prints a
    one-paragraph rationale and exits non-zero; `--proceed-anyway`
    overrides on this single call.
  - `block` — same as `educate` for `necessary` / `borderline`, but
    `unnecessary` is rejected regardless of invocation source. Even
    `--proceed-anyway` is ignored (power-user opt-in for cost-strict
    environments).
- `lens_overrides.necessity_classifier_mode.<lens>` — per-lens override.
  Wins over the global `mode`. Typical use: leave the global at
  `educate` and force `debate` lens to `block` because debate is the
  most expensive transport.

**Invocation context (CLI flags).**

- `--invocation {agent,user_explicit}` — defaults to `user_explicit`.
  Agent orchestration MUST set `--invocation agent` so silent skips are
  available; user-typed `/council` keeps the default.
- `--proceed-anyway` — one-shot override of the `educate` block. Does
  NOT lift `block` mode.

**Classifier shape.**

Word-boundary regex matches against four `necessary` buckets
(architecture / tradeoff / ambiguity / strategic) and four
`unnecessary` buckets (bugfix / syntax / single_file / lookup).
Decision table:

| Necessary hits | Unnecessary hits | Lens strict? | Verdict |
|---|---|---|---|
| `> unnecessary` | any | n/a | `necessary` |
| `>= 1` | `== 0` | n/a | `necessary` |
| `== 0` | `>= 1` | n/a | `unnecessary` |
| equal `>= 1` each | both `>= 1` | n/a | `borderline` |
| `== 0` | `== 0` | yes (`debate`) | `unnecessary` |
| `== 0` | `== 0` | no | `borderline` |

Trigger word lists live in
[`scripts/ai_council/necessity.py`](../../scripts/ai_council/necessity.py)
as `NECESSARY_TRIGGERS` and `UNNECESSARY_TRIGGERS` — extend there with
a unit test; never edit downstream copies.

### Decision-replay artefact (Phase 9, audit trail)

Per-session `decision-replay.md` written next to `responses.json` whenever
the consensus round runs. Pure projection of consensus data plus the
final-round per-member texts — no extra model calls. The artefact
surfaces, per top finding, the verdict band (Strong/Moderate/Weak), the
evidence-quality bucket (H/M/L), the agree/dissent member split, and one
key argument per member. Implementation:
[`scripts/ai_council/replay.py`](../../scripts/ai_council/replay.py).

**Configuration.**

- `decision_replay.enabled` (bool, default `true`) — master switch.
  `false` skips the artefact for every lens.
- `decision_replay.include_member_arguments` (bool, default `true`) —
  when `false`, the artefact emits the redacted view: verdict +
  evidence-quality + counts only, no per-member arguments. Use for
  surfaces where attributing reasoning to a specific model would leak
  vendor preference signal.
- `lenses.<lens>.decision_replay.enabled` / `include_member_arguments`
  — per-lens overrides that beat the global block. Typical use: keep
  the audit trail on for `analysis` and turn it off for `default` /
  `prompt` where consensus rarely runs.

**CLI.**

- Written automatically by `council run` when consensus scoring fires.
- `council replay <responses.json>` re-renders the artefact from a saved
  session. `--output <path>` writes to a file (otherwise stdout);
  `--redact-member-arguments` / `--include-member-arguments` toggle the
  redacted view independent of config.

**Decision-replay schema.** The markdown body follows a fixed shape so
downstream tooling can scrape it:

```
# Decision Replay

> <original-ask truncated to 400 chars>

## <finding-id> — <finding-text truncated to 120 chars>

- **Consensus**: Strong|Moderate|Weak (<strength 0.00–1.00>)
- **Evidence quality**: H|M|L (mean <X>/10)
- **Agreement**: <concur>/<total> members concur, <dissent> dissent

**Agreeing members**:                        # full mode only
- _<provider:model>_ — <argument truncated to 200 chars>

**Dissenting members**:                      # full mode only
- _<provider:model>_ — <argument truncated to 200 chars>

**Synthesis verdict**: <band> consensus — <source> sourced.

---

_artefact mode: full|redacted (counts only)_
```

Findings are ranked by `consensus_strength` descending. Empty sessions
emit the heading plus `*No findings were extracted for this session.*`.

### Decision resolution by impact (Phase 10, ask-user routing)

Five-class impact classifier triages every pending agent question
before it surfaces. Heuristic, shape-based, keyword-driven — no LLM
call, fully explainable. Lives in `scripts/ai_council/necessity.py`
(`classify_impact`, `route_decision`).

| Class | Trigger shape | Default mode |
|---|---|---|
| `trivial` | naming, whitespace, comments, typo, indent | `agent` |
| `low_impact` | local idioms, DTO vs value object, test extensions | `agent` |
| `medium_impact` | API shape, contract change, breaking change, module boundary | `council` |
| `high_impact` | security, auth, tenant boundary, migration, billing, secrets, PII | `user` (**LOCKED**) |
| `user_required` | user-fence markers — "ask me", "review first", "plan only" | `user` (**LOCKED**) |

**Iron Law** — `high_impact` and `user_required` ALWAYS route to the
user. The schema loader rejects any `decision_resolution.classes.<cls>.mode`
that maps either class to `agent` or `council`. No override path, no
config flag, no autonomy setting can lift this lock.

**Confidence gate** — each entry carries a `confidence_threshold`
(default `0.6`). When the classifier's confidence is below the
threshold, the configured mode is upgraded one rung
(`agent` → `council` → `user`) so low-certainty calls escalate rather
than silently auto-resolve.

```yaml
decision_resolution:
  enabled: true
  classes:
    trivial:
      mode: agent
      confidence_threshold: 0.6
    low_impact:
      mode: agent
      confidence_threshold: 0.6
    medium_impact:
      mode: council
      confidence_threshold: 0.6
    high_impact:
      mode: user            # LOCKED — Iron Law
      confidence_threshold: 0.6
    user_required:
      mode: user            # LOCKED — Iron Law
      confidence_threshold: 0.6
```

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
- **Manual vs API vs CLI transport.** Three first-class modes on the
  `mode:` axis:
  - `manual` = copy & paste — the human transports prompt + reply between
    the agent and an external chat surface. Free, no key.
  - `api` = direct SDK call against a stored key (per-token billing).
  - `cli` = shell out to a locally-installed provider CLI under the
    user's subscription auth — spend is covered by the flat-rate
    subscription, not per-token. `billable=False` so the `cost_budget`
    USD ceiling does not apply; subscription quotas are guarded by
    `cli_call_budget.max_calls_per_day` instead.

  Precedence: per-invocation flag > per-member override > defaults > `api`.
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
7. `defaults.mode` not in `{"api", "manual", "cli"}`; per-member `mode`
   override same constraint.
8. `members.<provider>.binary` set when the member's effective mode is
   not `cli` — explicit error to keep config clutter-free.
9. `cli_call_budget` is not a mapping, or
   `cli_call_budget.max_calls_per_day.<key>` is an unknown provider, or
   any value is a negative integer / non-integer.
10. `advisors.<key>.member` missing, unknown, or pointing at a
    `members.<provider>` that does not exist or has `enabled: false`
    (when the advisor itself is `enabled: true`). Silent skips are not
    allowed — a typo never costs the user money on an unintended call
    plan.
11. `advisors.<key>.model` is set but not a string.
12. `necessity_classifier` is not a mapping, or `enabled` is not a bool,
    or `mode` is not one of `{"off", "educate", "block"}`.
13. `lens_overrides.necessity_classifier_mode` is not a mapping, or any
    value is not one of `{"off", "educate", "block"}`. Unknown lens keys
    are accepted (forward-compatible) but never silently rewrite the
    global default.

## Migration footprint (Phase 0)

- `.agent-settings.yml` → 14-key inventory under `ai_council:` removed
  after a one-line breadcrumb comment is in place pointing at this
  contract.
- `.agent-settings.template.yml` → same removal.
- New file `agents/.ai-council.yml` checked in with two enabled
  providers (anthropic + openai) and three disabled
  (gemini + xai + perplexity). Models pre-filled from the Phase 0
  default set; comments mirror this contract.
