---
stability: beta
keep-beta-until: 2026-08-12
---

# AI-Council Config (`.ai-council.yml`)

**Purpose.** Lock the schema, validation, and precedence rules for the
centralized council config file. Every phase of the AI-Council
consolidation work reads from this file; the contract here is the
boundary that prevents drift across the loader, the CLI, the
orchestrator, and the `.ai-council.yml` file itself.

**Audience.** Authors of `scripts/ai_council/config.py`, `council_cli.py`,
`scripts/ai_council/orchestrator.py`, and the `.ai-council.yml`
starter. Also reviewers checking that new providers / advisors / debate
features keep the schema intact.

**Status.** Internal-locked. Changes require a contract version bump and
a revision entry in the consuming roadmap.

## File location

The council is configured **once per user**, not per project. The config
lives in the user-global namespace:

```
~/.event4u/agent-config/settings/.ai-council.yml
```

(with the legacy `~/.config/agent-config/settings/.ai-council.yml` read as a
fallback during the v2.4 namespace transition). This is where a single
developer enables members, pins models, and sets caps once — and the
council then works in **every** project they open, with no per-project
file to check in or accidentally commit. See
[ADR-093](../decisions/ADR-093-ai-council-config-user-global.md) and
[ADR-104](../decisions/ADR-104-ai-council-config-global-only.md).

**The council config is ALWAYS user-global. The project tree is NEVER
searched for it.** `scripts/ai_council/config.ts:resolve_config_path`
resolves the active file with this precedence (first match wins):

1. **`$AI_COUNCIL_CONFIG`** — an explicit absolute path. Honoured even
   when the target is absent (so a typo surfaces as "create it here"
   rather than silently falling back). Primarily for tests / power users.
   This is an explicit path, not a project search.
2. **User-global** `~/.event4u/agent-config/settings/.ai-council.yml` — the
   canonical default described above.

There is **no project-local lookup.** A `<project_root>/agents/settings/.ai-council.yml`
in any project (including this package's own tree) is ignored — the
council never reads it (ADR-104, superseding the project-local override
ADR-093 had kept). The absence of a council file *in a project* therefore
says **nothing** about whether the council is configured; only the
user-global file (or the `$AI_COUNCIL_CONFIG` override) decides that.

When neither exists, the loader reports the user-global path as the place
to create it. `agents/templates/.ai-council.yml.example` ships the
documented shape to copy from. The legacy `ai_council.*` block under
`.agent-settings.yml` remains removed (Phase 0 Step 5); a one-line
breadcrumb there points at this contract.

> **Why user-global, not project-tracked.** A council config checked into
> the project tree (the pre-ADR-093 layout) (a) re-applied per-project
> instead of per-developer, (b) risked being committed to a public repo,
> and (c) was silently *not found* on cloud / headless / fresh-checkout
> surfaces with no project copy — the council then refused with
> "ai_council.enabled is false" even though the user had set it up. The
> user-global location fixes all three.

## Top-level schema

```yaml
enabled: <bool>                 # master switch, required
defaults:                       # per-invocation defaults, required
  # NO transport-mode key — transport is resolved, not configured. A file that
  # still carries one loads fine and reports it ignored. See Transport modes.
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
cli_call_budget:                # optional; per-day call-count guard for mode: cli/auto members
  max_calls_per_day:
    <provider>: <int >= 0>                # per-provider override; SHIPS POPULATED at 50/day for every known provider — see "cli_call_budget defaults" below
  warn_at: <float in [0.0, 1.0]>          # default 0.8 — pre-run summary line prefixes "⚠️" once used/limit >= warn_at (step-8 D4)
quorum: <"majority" | int >= 1>  # optional, default "majority"; see "Quorum" below
quorum_min_present: <int >= 1>   # optional, default 2; SHADOW only — enforces nothing
members:                        # per-provider blocks, at least one enabled
  <provider>:
    enabled: <bool>
    model: <string>
    api_key_ref: <string>                 # optional — the credential for the metered `api` fallback rung
    # no per-member `mode:` either — same reason as `defaults`
    binary: <string>                      # optional; only valid when effective mode == "cli" or "auto"
    verified_at: "<YYYY-MM-DD>"           # optional, MUST BE QUOTED — when a human last checked this member's pin
                                          # the provider's own surface. Read by `check_council_pin_staleness`
                                          # (cadence 100d). A malformed or impossible date fails CLOSED at load, and
                                          # an UNQUOTED value is rejected with the fix in the message: YAML 1.1 parses
                                          # it as a date and silently rolls impossible values over (2026-13-45 becomes
                                          # 2027-02-14), which would launder a malformed stamp into a valid one.
                                          # A member on a vendor sentinel (`codex-default`) or a documented
                                          # "latest in band" alias (`fable`/`opus`/`sonnet`/`haiku`) needs NO stamp:
                                          # it cannot go stale, so the gate exempts it rather than demanding a date
                                          # nobody would refresh.
    # THIS BLOCK IS NOT THE FULL ACCEPTED KEY SET — `_build_member` in
    # src/scripts/ai_council/config.ts IS AUTHORITATIVE. It accepts ten keys; six
    # are listed here. The four omitted (`mode` — read then ignored, `model_ladder`,
    # `participate_low_impact`, `tier`, `prompt_cache`) are each documented in their
    # own section further down, which is why the drift went unnoticed: nothing was
    # missing from the DOCUMENT, only from this summary. Stated rather than silently
    # completed, because a reader who trusts a summary block as exhaustive will
    # reject a valid config.
advisors:                       # Thinking-style replace-mode advisors
  <advisor-key>:
    enabled: <bool>
    member: <provider>                    # required; references members.<provider>
    model: <string>                       # optional; overrides member.model
    persona: <path>                       # optional; defaults to personas/advisors/<advisor-key>.md
necessity_classifier:           # Phase 6 — optional, default enabled+educate
  enabled: <bool>                         # master switch (default true)
  mode: <"off" | "educate" | "block" | "warn-only">       # default "educate" (agent invocation)
  user_explicit_mode: <"off" | "educate" | "block" | "warn-only">  # default "warn-only" — step-8 D2; applies when invocation=user_explicit
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
critic_protocol: <"legacy" | "load_bearing">  # optional, default "legacy" — critic posture for adversarial/skeptic review passes
```

Supported `<provider>` keys: `anthropic`, `openai`, `gemini`, `xai`,
`perplexity`. Unknown providers fail validation closed.

### Transport modes

**There is no transport-mode setting.** Transport is resolved per member per
machine per invocation, and the only layer above the resolver is a
per-invocation `--mode-override` flag.

It used to be configurable at two layers, `defaults.mode` and a per-member
`mode:`. The default was flipped to CLI-first — but a default only fires on an
ABSENT key, so every config that spelled the key out (the shipped template did,
and the setup wizard wrote it on every run) kept its old `api` value and went on
paying per token while a subscription CLI sat unused on the same machine. A knob
whose stale value silently costs money is worse than no knob, so both layers were
removed rather than re-defaulted a second time.

A config still carrying either key **loads** — the key is ignored and listed in
`CouncilConfig.ignored_transport_keys`, which `agent-config council status`
prints so it can be deleted. Validating a key nobody reads would have turned
every stale installation into a hard load failure, which is the breaking change
the ignore-list exists to avoid.

The three transports below are still the vocabulary of the resolver's output and
of `--mode-override`; they are simply no longer things a file can pin.

| Mode | Semantics | Billable | Auth | Cost gate |
|---|---|---|---|---|
| `manual` | Copy & paste — the human transports prompt + reply between the agent and an external chat surface. | No | None — human-in-the-loop | n/a |
| `api` | SDK call against a stored key, per-token billing on the provider's API. | Yes | `api_key_ref` (env or 0600 file) | `cost_budget` (full) |
| `cli` | Shell out to a locally-installed provider CLI. For `anthropic` / `openai` / `gemini` this runs under the user's subscription auth and is `billable=False`. For `xai` / `perplexity` (community wrappers) the CLI consumes the same API key as `mode: api` and remains `billable=True`. | Mixed — see below | CLI-managed OAuth (vendor) or API key in CLI env (community) | Vendor: `cli_call_budget.max_calls_per_day` only · Community: full `cost_budget` |
| `auto` | Not a transport — a selection rule. Per provider per invocation: the CLI binary resolves AND a credential is present → `cli`; else a key resolves → `api`; else the member is unavailable with a one-line reason. `manual` is never in the chain. **The only mode the loader emits**, and therefore what every member resolves through unless a `--mode-override` flag names one transport for one run. | Inherited from the selected rung's provider + credential — never from the fact that `auto` chose it | Whatever the selected rung needs | The selected rung's gate |

#### `auto` — the selection rule

Resolved by `src/scripts/ai_council/transport_resolver.ts` over the single
read-only environment report from `src/scripts/_lib/environment_detector.ts`.

- **`manual` is deliberately excluded.** It is always "available" (the human is
  the transport), so an availability-ranked chain would always terminate there
  and `auto` would silently mean "ask the human to copy-paste". Manual stays an
  explicit opt-in.
- **A per-member `mode:` still overrides it.** `auto` is a value of the same
  key, not a new precedence layer.
- **`binary:` is valid on an `auto` member** (the chain may pick the cli rung).
- **Billing is classified from (provider, detected auth source), never from the
  transport `auto` picked.** A vendor-official CLI under a subscription login is
  unmetered; a community wrapper is metered even though its transport is also
  spelled `cli`; an unrecognised or absent credential is metered — deliberately
  over-gated. This is what keeps the per-provider rules below intact under
  `auto`.
- **Mid-flight fallback is failure-class-gated.** Within one invocation an
  `auto` (or `cli`) member may fall through to the `api` rung **at most once**,
  and only for `binary_missing`, `auth_rejected`, `cli_unsupported`, or
  `model_unservable` — the classes where the CLI provably never reached the
  provider (or was rejected at the request boundary with no generation
  performed). A `timeout` or a 5xx does **not** fall through under any
  configuration: a half-completed call must never be paid for twice.
  Consumed by `orchestrator.ts::_run_round` via `ConsultOptions.cli_fallback`;
  `council_cli.ts::build_members` supplies the api-twin factory (out-param
  `fallback_out`), which enforces the same strict `api_key_ref` construction
  contract as the api branch — a provider whose api rung cannot construct
  simply surfaces the original failure. The retried call runs its **own**
  projected-spend gate (it is metered even when the failed cli call was not);
  a budget breach surfaces the original failure with
  `metadata.fallback_skipped: cost_budget`. A retried seat carries
  `metadata.fallback_from / fallback_reason / fallback_original_error` and is
  stamped, billed, and daily-ledgered as the api member that answered.
- **"At most once" is about ESTABLISHING the twin, not about answering once.**
  A provider that falls through is **substituted for the remainder of the
  invocation**: every later call in that invocation goes straight to the twin,
  so the dead binary is spawned once and the twin is constructed once. Those
  later responses carry `metadata.fallback_sticky: true` alongside the same
  `fallback_from / fallback_reason` stamp, which is how a reader separates the
  one escalation from the calls that merely reused it.

  Without the substitution the invocation scope would be strictly worse than a
  per-round one: the ledger grants `'api'` once per provider, so round 2 would
  call the dead binary again, fail again, be refused by the ledger, and lose
  the seat for the rest of the pass — having fallen back exactly once.
- **Which calls are covered.** `consult()` and all its rounds; `run_debate()`
  — its restate pass, every debate round, and the gate-repair re-prompts, all
  under ONE ledger and one twin map per `run_debate` invocation; the
  stance-repair re-prompt, on the same invocation-wide ledger as the rounds it
  repairs; and the chairman synthesis, which is a separate invocation with its
  own ledger and its own single-client member set. `cmd_estimate` is a decided
  non-goal — it prices members and never calls one.
- **A `billable: false` cli member is covered, and this is the load-bearing
  case.** Every vendor-official CLI client is `billable = false` +
  `transport = 'cli'`; only the two community CLI subclasses that consume an
  API key are billable. A fallback wired only into the billable path would
  therefore never fire for anthropic, openai, or gemini — the members the
  mechanism exists for. The establishing retry runs in the non-billable branch
  and then rejoins the metered path, so the twin's call is projected, gated,
  booked, and stamped like any other api call.
- **Quota fall-through is opt-in: `fallback.api_on_quota` (default `false`).**
  Both quota shapes — the local `cli_call_budget` refusal (pre-spawn, nothing
  sent) and the provider-side plan-quota reject (request boundary) — satisfy
  the no-double-charge property, so the gate here is not double-spend but
  **billing class**: a vendor CLI under a subscription is unmetered, its api
  twin is metered USD, and converting exhausted plan quota into API spend is a
  decision the operator states, never one `auto` infers. With the key set, the
  retry still passes the ordinary `cost_budget` gates.

  ```yaml
  # Top level of .ai-council.yml — NOT nested under an `ai_council:` root.
  fallback:
    api_on_quota: true   # default false
  ```

  The root matters and this example had it wrong (R2 round 6, finding 7):
  `config.ts` reads `fallback` off the TOP level of the file, and the shipped
  template puts it there, so a pasted `ai_council:` wrapper parses fine and
  resolves to the default `false` — the switch reads as set and is not.
- **`cli_call_budget` ships populated**, because `auto` prefers the rung it
  guards.

#### Two defaults, not one

Earlier revisions of this contract described a single built-in fallback
(`"api"`) while the resolver implemented `manual`. Both were right about
different layers. They are now named separately:

| Layer | When it applies | Value |
|---|---|---|
| **Loader value** | Unconditional — `config.ts::_build_defaults` no longer reads the file's `mode` at all, so this is what every config observes whether or not it carries the key. | `auto` |
| **Built-in fallback** in the resolver | No layer supplies a mode at all — a settings dict handed straight to `resolve_mode`, no config file involved. | `manual` |

The built-in fallback is the free transport by design: a caller who named no
transport has not asked to spend money (`modes.ts::DEFAULT_MODE`, pinned in
`tests/scripts/ai_council/modes.test.ts`). It did **not** flip alongside the
loader default: `auto` still resolves to a paying rung (`api`) when no CLI is
usable, so flipping the built-in fallback too would let a caller that bypassed
the config loader entirely spend money on a preference it never stated — the
exact violation the fallback exists to prevent. Every file-backed config now
resolves `auto` unconditionally, so this fallback is never reached on that path.

Both shapes of the global key resolve. `council_cli.ts` synthesizes the loaded
config into a block whose global mode sits at the top level (`mode`), while a
caller handing `build_members` a raw `.ai-council.yml`-shaped dict presents it
nested (`defaults.mode`). `modes.ts::resolve_global_mode` accepts either, flat
winning when both are present.

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
- **`binary:` is only valid when the effective mode is `cli` or `auto`.**
  Setting it on an `api` or `manual` member is a hard validation error — no
  silent ignore, no clutter. `auto` is admitted because its chain may resolve to
  the cli rung, and rejecting the override would make `auto` unusable for anyone
  whose CLI is not on `$PATH` under its default name.
- **Subscription quotas:** Claude Pro 5h usage windows, ChatGPT Plus
  message caps, Gemini free-tier per-day limits all live outside this
  loader's view. `cli_call_budget.max_calls_per_day.<provider>` lets the
  user override a per-provider cap; counter state persists at
  `~/.event4u/agent-config/cli-calls.json` with daily UTC reset (wired in
  Phase 1 of the CLI-transport roadmap). **SHIPS POPULATED at 50/day for
  every known provider** (road-to-always-on-orchestration Phase 3.4) — before
  this an unlisted provider ran uncapped, which is exactly the failure mode
  an always-on `auto` default needs a guard against. 50/day is a GUARD, not a
  brake: sized well above normal use, so an explicit override is only needed
  to tighten it (see the shipped `.ai-council.yml.example` for a
  worked-example tighter sizing) or to loosen it further.
- **Omitting `model:` for a vendor `cli` member is a PIN for `anthropic` and
  `gemini`, and NOT a pin for `openai`.** Each vendor CLI client falls back to
  a dedicated `DEFAULT_*_CLI_MODEL` constant when `model` is unset
  (`clients.ts`); `xai` / `perplexity` CLIs are community API wrappers and
  reuse their `DEFAULT_*_MODEL` API constant. For `anthropic` and `gemini` that
  value is a deliberate pin and the vendor CLI's own default may be newer —
  bump the constant intentionally rather than assuming it tracks the latest
  release.

  **`DEFAULT_OPENAI_CLI_MODEL` is `OPENAI_CLI_VENDOR_DEFAULT`
  (`'codex-default'`) since 2026-08-15, and that is the opposite of a pin.** It
  passes NO `--model` flag, so the codex CLI's own default applies. This
  paragraph previously cited "`openai` API `gpt-4o` vs CLI `gpt-5`" as the
  proof that the two constant families diverge; the divergence is real but that
  CLI value is gone, because a subscription-authed (ChatGPT) account refuses
  both ids with `400 invalid_request_error` — they and `gpt-5.1-codex` are
  recorded in `CODEX_MEASURED_UNSERVABLE`. A pinned id did not select a model
  there, it disabled the seat. Which ids an account serves is not knowable from
  inside this process, so no id is shipped for that transport.

- **`model: codex-default` is a SENTINEL, and both transports honour it.** The
  codex adapter omits `--model`; `OpenAIClient` (api) resolves it to
  `DEFAULT_OPENAI_MODEL` rather than sending a value no endpoint answers to.
  That symmetry is required, not cosmetic: one `model:` field feeds both, and
  which transport a member resolves to is decided at run time.

  `_build_member` also exempts the sentinel from the `model_ladder` membership
  check. A downgrade ladder holds concrete ids; requiring a sentinel to appear
  on one is a category error, and it is the check that would otherwise reject
  the shipped template outright. A real pin is still required to be on its own
  ladder, and a set value always passes through verbatim — the loader never
  rewrites a pin.

  **The low-impact fast path does not downgrade an unpinned member.** With
  `model_downgrade.enabled` (default `true`) it would otherwise write
  `model_ladder[0]` onto the client immediately before the call, re-creating the
  pinned-id shape on a member that deliberately carries none. An explicit
  `model_tier_override` still wins — that is a human naming a model.
- **Quota observability (step-8 D1, D4):** every `council run` /
  `council debate` prints a one-line `council:quota · <provider>
  used/limit · …` summary before the first member fires. Every provider now
  carries a cap by default (Phase 3.4's 50/day floor), so every provider
  appears in this line unless a caller explicitly zeroes its cap out via
  `max_calls_per_day.<provider>: 0` (an intentional "no calls" pin, not an
  omission). When `used / max_calls_per_day >= cli_call_budget.warn_at`
  (default `0.8`) the line is prefixed `⚠️` and lists the providers near the
  limit on the next line. The standalone `agent-config council
  quota` subcommand dumps the same state plus the configured caps,
  and `--reset <provider> --confirm` clears today's counter for that
  provider.

### Quorum (Phase 3.3, road-to-always-on-orchestration)

`quorum` (top-level, optional, default `"majority"`) is the number of
enabled members a pass needs to CONCLUDE. Below that threshold the pass is
`inconclusive` rather than a partial answer treated as complete — and at a
release gate, `inconclusive` HOLDS the gate for a human review; it is never
silently downgraded to advisory.

`"majority"` resolves to `ceil(n / 2)` for `n` enabled members — a SIMPLE
majority, deliberately **not** the stricter "more than half"
(`floor(n / 2) + 1`). The two definitions diverge exactly at `n = 2`: simple
majority needs 1-of-2, the stricter reading needs 2-of-2. Council-verified
2026-08-09: 2-of-2 turns any single absent member into a deadlocked release
gate, which is the failure mode this default is built to avoid. A fixed
integer `quorum: <k>` overrides `"majority"` outright and is clamped to
`[1, n]` by the resolver (never structurally unwinnable, never trivially met).

`quorum_min_present` (top-level, optional, default `2`) is a SHADOW floor and
enforces nothing. It configures a counterfactual only: whether a pass that
DID conclude reached that conclusion on fewer voices than a gate would want.
The answer is recorded on the `quorum_result` event line as
`floor_would_hold` and never acted on — no value of this key can hold, delay
or fail a pass, and `quorum` above remains the only setting that decides
whether a pass concludes.

It exists because ADR-224 chose a gate-scoped `min_present: 2` floor and its
review trigger asks for the floor's own fire-rate to accumulate; nothing in
the tree yet branches on quorum status to hold a gate, so the measurement
landed and the enforcement did not. Enforcement needs its own record. The
floor is judged against the larger of the constructed roster and the
configured entry count, so a member that fails to construct does not hide a
one-of-two conclusion behind a one-of-one reading.

**The configured value is recorded on every line** as `min_present`
(`quorum_result`, schema v4+), not only consumed. This key lives in the
user-global `.ai-council.yml`, so it varies per developer machine and is
invisible in any repository: without it on the line, two operators emit
byte-identical records for different counterfactuals, and a pooled
`shadow_floor_fire_rate` averages incomparable readings. It also makes a zero
rate attributable — `quorum_min_present: 1` is valid and can never hold
anything, so it drives the rate to a permanent zero that would otherwise be
indistinguishable from "the floor genuinely never would have fired". Group the
rate by `min_present` before reading it; treat pre-v4 lines as a stratum whose
floor is unknown rather than assuming the default.

Implemented in `src/scripts/ai_council/quorum.ts`
(`resolveQuorumThreshold` / `evaluateQuorum` / `wouldSoloFloorHold`) — pure
functions; the
caller supplies its own count of enabled members (`n`) and members that
actually produced a usable response (`present`). The verdict surfaces in
both artefact halves:

- **`manifest.json`** (`session.ts::save()`) carries a structured
  `quorum: {status, threshold, total, present} | null` field — machine-readable,
  `null` when the caller never evaluated one (e.g. a single-member solo
  dispatch has nothing to conclude quorum over).
- **The rendered report** (`orchestrator.ts::render()`) prepends one line —
  `**Quorum:** <present>/<total> present, needed <threshold> — concluded.` or
  `… — INCONCLUSIVE — release gate holds.` — right before the trailing
  Absent Members section (below), when the caller supplies a verdict.
  Omitting the option renders byte-identically to before this field existed.

**Attendance is telemetry, never a silent drop.** A member that never
produced a response still needs to be accounted for somewhere — see
"Graded degradation" below; quorum counts `present` against the total
regardless of *why* a member is missing.

**The live `council:run` / `council:estimate` path (Phase 3.1 reconciliation).**
The paragraph above describes `session.ts::save()`'s `manifest.json` — a
second, currently-unwired artefact writer. The artefact the shipped `/council`
CLI actually produces is a different file:
the gitignored, auto-pruned per-run responses JSON (the `--output` file `council_cli.ts::cmd_run` writes under the council runtime directory). That
path carries the SAME verdict shape, via `build_members`'s own `quorum_out`
out-parameter (`total_enabled` = enabled member-config entries this pass
considered, `present` = `total_enabled` minus every entry that ended up
`absent`, below) — surfaced as `payload['quorum']` in the JSON artefact and a
`council:quorum · <present>/<total> present, needed <threshold> — <verdict>.`
stdout line on `council:run`/`council:estimate`. `build_members` is also the
place `resolve_mode`'s literal `'auto'` value is expanded into a concrete
transport (`resolveMemberTransport`, road-to-always-on-orchestration
Phase 3.1) — before this reconciliation, EVERY invocation on the shipped
`auto` default (`config.ts::_build_defaults`) threw `no transport —
mode=auto` instead of resolving cli → api → absent.

### Graded degradation — absent members (Phase 3.2, road-to-always-on-orchestration)

A member that never produced a usable response — no CLI binary and no key
(`resolveTransport`'s `auto`-chain failure), or a call that started and then
timed out / hit an exhausted `cli_call_budget` quota mid-run — is recorded as
`absent` with a machine-readable `reason`, never silently dropped from the
pass. `src/scripts/ai_council/transport_resolver.ts` exports the shared
vocabulary:

```ts
type AbsentReason = 'no_binary' | 'no_auth' | 'timeout' | 'quota';
```

`no_binary` / `no_auth` come from `resolveTransport`'s static resolution (the
member never got a transport at all); `timeout` / `quota` come from
`absentReasonFromCliFailure`, which maps the existing mid-flight
`CliFailureClass` (`classifyCliFailure`) onto the same four values for a
call that WAS attempted and then failed. A failure class outside this
four-value enum (`cli_unsupported`, `server_error`, `other`) maps to `null`
— the caller falls back to the raw failure detail rather than
mis-classifying it into a bucket that doesn't fit.

Both artefact halves carry the same record shape
(`{member, reason, detail}`):

- **`manifest.json`** — `absent_members: [...]`, empty array when the caller
  never populates it (an old caller's manifest keeps its existing shape plus
  this one always-present, possibly-empty key).
- **The rendered report** — a trailing `### Absent Members` section, one row
  per absent member (`- **<member>** (<reason>) — <detail>`), omitted
  entirely when the list is empty.

The `council:run` / `council:estimate` responses artefact (see the Quorum
section above) carries the same shape as `payload['absent_members']` — the
`skipped` array `build_members` populates — omitted entirely when nothing was
absent, and additionally echoed to stdout via `format_install_hints`.

### Handoff envelope (Phase 4.1, road-to-always-on-orchestration)

A council verdict is a machine-readable work order, not only a report a
human reads and re-types into whatever executes next. `HandoffEnvelope`
(`src/scripts/ai_council/handoff.ts`) is that bridge:

```ts
interface RejectedAlternative {
    option: string;
    reason: string;
}
interface HandoffEnvelope {
    decision: string | null;
    rejected_alternatives: readonly RejectedAlternative[] | null;
    constraints: readonly string[] | null;
}
```

**The honesty constraint.** Every field is independently `null` when there
is no STRUCTURED source to populate it from — never a fabricated guess. The
only structured decision source this codebase has today is the option-level
stance tally (`stance_tally.ts`, opt-in via `ai_council.stance_tally.enabled`,
Phase 1): a chairman's prose synthesis, the default template, and
consensus-scoring's qualitative Strong/Findings/Minority buckets are all
free-text or non-decisional shapes with nothing to extract a `decision`
field from without parsing prose. So:

- Stance tally never ran, or it ran and SPLIT (no option cleared the ⅔
  threshold) → every field is `null` (`buildHandoffFromStanceTally`'s
  `EMPTY_HANDOFF`).
- Stance tally concluded → `decision` is the winning option's label;
  `rejected_alternatives` lists every other non-abstain option the tally
  counted, each with a `reason` built strictly from that option's OWN tally
  numbers (`backed by <n> member(s), weight <w> of <threshold> needed to
  conclude`) — a factual restatement of the tally, never a narrative guess
  at member motivation.
- `constraints` is always `null` — no structured "binding constraint" source
  exists anywhere in the current synthesis pipeline yet (a dealbreaker count
  describes objection PRESSURE on an option, not a named constraint on the
  winner).

**Where it lands** — additive, byte-identical when absent, same shape as the
quorum / absent-members fields above:

- **The responses artefact** (the gitignored, auto-pruned per-run responses JSON (`cmd_run`’s `--output` file),
  `cmd_run`) — `payload['handoff']` is ALWAYS written (a stable key beats a
  conditionally-present one for a machine consumer), even when every field
  is `null`.
- **The rendered report** (`orchestrator.ts::render()`, `opts.handoff`) — a
  `### Handoff` section right after the Convergence/Divergence slot, ahead
  of the de-anonymization map and the trailing quorum/absent-members
  bookkeeping. Rendered ONLY when at least one field is non-`null`
  (`isEmptyHandoff`) — an all-null envelope has nothing worth a section for,
  the same "only show when there's substance" call `### Absent Members`
  makes. Present but partial (e.g. a `decision` with no rejected
  alternatives) still renders every field, with an honest "none recorded."
  line for whichever are `null` — never silently dropped.
- **`council:render`** re-derives the section from a saved payload's
  `payload['handoff']` (`_deserialise_handoff`), so re-rendering an OLD
  artefact written before this field existed — no `handoff` key at all —
  produces byte-identical output; a payload carrying the honest all-null
  envelope also renders nothing new, by the same `isEmptyHandoff` check.

### Persistent events log (step-8 D3)

The orchestrator appends one JSON line to `agents/runtime/council/events.log`
on every necessity-gate decision (`proceed` / `skip_necessity`), on
every `cli_call_budget` block (`block_quota`), on each attendance reading
(`quorum_result`), and on each mid-flight transport escalation
(`transport_fallback`). The log is gitignored by default — it is a
local-only audit trail, never part of the repository contract.

Schema v1:

```json
{
  "schema_version": 1,
  "ts_utc": "2026-05-15T03:38:45Z",
  "lens": "analysis",
  "invocation": "user_explicit",
  "action": "proceed",
  "verdict": "necessary",
  "provider_caps": {"anthropic": {"mode": "cli", "model": "sonnet-4"}},
  "original_ask_hash": "abc123def456"
}
```

- `action` ∈ `proceed | skip_necessity | block_quota | quorum_result | transport_fallback`.
  (`quorum_result` was shipped and undocumented here until 2026-08-19;
  it is listed now rather than left for the next reader to find in the
  validator's error message.)
- A `transport_fallback` line carries `provider`, `failure_class`,
  `outcome` ∈ `retried | no_twin | cost_budget`, and `api_on_quota`. One
  line per ESTABLISHING escalation, not per substituted call — the
  substituted rounds are visible in the rendered artefact instead. Without
  it, attendance analysis cannot separate a seat SAVED by the fallback from
  a seat that was natively api, and only one of those spends unplanned USD.
- `original_ask_hash` is `sha256(original_ask)[:12]`. The raw prompt
  is **never** written — privacy floor per
  [`agents/decisions/low-impact-decisions.md`](../../agents/decisions/low-impact-decisions.md).
- Diagnostic fields outside the reserved set (`category`, `mode`,
  `cli_calls_used`, …) pass through verbatim. Consumers MUST treat
  unknown keys as forward-compatible.
- `AGENT_CONFIG_NO_EVENTS_LOG=1` (step-8 D5) disables every write
  in-process — useful for ephemeral worktrees, CI runners that
  shouldn't accumulate state, or sandbox testing.

### Advisor block (Phase 6, replace-mode)

Five built-in advisor keys ship under
[`.agent-src.uncondensed/personas/advisors/`](../../.agent-src.uncondensed/personas/advisors/):
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
[`scripts/ai_council/necessity.py`](../../src/scripts/ai_council/necessity.ts);
wired into `council_cli.cmd_run` and `cmd_debate` before any member
is invoked.

**Configuration.**

- `necessity_classifier.enabled` (bool, default `true`) — master switch.
  `false` short-circuits the gate entirely; legacy "always run" behaviour
  is restored.
- `necessity_classifier.mode` (`"off" | "educate" | "block" | "warn-only"`,
  default `"educate"`). Governs the **agent** invocation tier.
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
  - `warn-only` (step-8 D2) — annotate the verdict on stdout but
    **never** skip. Useful when the user wants observability without
    losing council coverage.
- `necessity_classifier.user_explicit_mode` (same enum, default
  `"warn-only"`, step-8 D2) — governs the **user_explicit** invocation
  tier. The two-tier split reconciles "Council always active when
  enabled" with "skip trivial agent-side requests": user-typed
  `/council` calls proceed by default, agent-initiated dispatches keep
  `educate` behaviour. Override via the resolved `.ai-council.yml`.
- `lens_overrides.necessity_classifier_mode.<lens>` — per-lens override.
  Wins over the global `mode` for the matching invocation tier (agent
  vs user_explicit follow the same lens map). Typical use: leave the
  global at `educate` and force `debate` lens to `block` because
  debate is the most expensive transport.

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
[`scripts/ai_council/necessity.py`](../../src/scripts/ai_council/necessity.ts)
as `NECESSARY_TRIGGERS` and `UNNECESSARY_TRIGGERS` — extend there with
a unit test; never edit downstream copies.

### Decision-replay artefact (Phase 9, audit trail)

Per-session `decision-replay.md` written next to `responses.json` whenever
the consensus round runs. Pure projection of consensus data plus the
final-round per-member texts — no extra model calls. The artefact
surfaces, per top finding, the verdict band (Strong/Moderate/Weak), the
evidence-quality bucket (H/M/L), the agree/dissent member split, and one
key argument per member. Implementation:
[`scripts/ai_council/replay.py`](../../src/scripts/ai_council/replay.ts).

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
The trailer additionally carries two aggregate lines — **Evidence spread**
(high/medium/low counts across findings) and **Provider spread** (distinct
providers that deliberated) — folded in beside `_artefact mode:_`.

### Consensus scoring — inline findings (Phase 1B)

The consensus round's pass 1 asks every member a SECOND time, in a separate
paid call, to restate its own analysis as a JSON findings array
(`FINDING_EXTRACTION_PROMPT`). `inline_findings` asks for that array in the
FIRST reply instead, and issues the extraction call only when the first reply
did not carry a usable one.

**Configuration.**

- `consensus_scoring.inline_findings` (bool, default `false`) — master switch.
  Active only when **all three** hold: `consensus_scoring.enabled` is true,
  this run's lens is in `consensus_scoring.lenses` (default `[analysis]`), and
  this key is true. Any one missing → the deliberation prompt is byte-identical
  to a run without the feature.

**Behavior when active.**

- The FINAL deliberation round appends `INLINE_FINDINGS_CONTRACT`, which
  restates the extraction schema — same `{"id", "text"}` shape, same 3–7 bound
  — and asks for it as the last thing in the reply. Composed with
  `stance_tally`, the findings block comes first and the `STANCE:` line stays
  last, because that contract requires the stance to be the final line.
- Between the deliberation and every consumer of its text, the trailing block
  is located, parsed, and **removed** from the response, leaving a one-line
  marker in its place. Peer review, chairman synthesis, and the rendered
  artifact therefore evaluate the member's argument, not the schema
  scaffolding that restates it. The removal is deliberately observable — a
  silent edit to what reads as a transcript is the failure this marker exists
  to prevent — and the raw reply is retained in the session record.
- The locator reads the LAST array-shaped span, not the first. The analysis
  lens exists to critique analyser OUTPUT, so a JSON array quoted in the prose
  above is ordinary; first-match would read that as the member's findings.
- A reply whose block is absent or unreadable is **not** modified, and takes
  the shipped extraction path — including its one bounded re-ask — against the
  full raw text. The worst case is therefore exactly today's call count.
- The per-member outcome is recorded as `parsed-inline` (read from the
  deliberation reply) versus `parsed` (read from the extraction call), so the
  two sources are distinguishable in the attendance data.

**Promotion status.** Default-off pending the Phase 1B gate: ≥ 10 real analysis
runs at ≥ 70 % inline parse rate, no `unparsed` regression, no substantive
finding-quality regression. The pre-registered rate is
`parsed-inline ÷ replies that received the contract` — a member that answered
`[]` counts in the denominator AND as a success, because an empty array from a
readable reply is a result, not a failure.

### Stance tally (Phase 1 — option-level verdict)

`consensus_scoring` scores *findings*; `stance_tally` produces an
*option-level* verdict for "A or B?" questions. **Default-off**; with the
block absent the council path is byte-identical to today.

**Configuration.**

- `stance_tally.enabled` (bool, default `false`) — master switch. A
  non-bool value is rejected at config load (`CouncilConfigError`); unknown
  values are not silently coerced.

**Behaviour when enabled.** The final round appends a mandatory closing-line
contract — `STANCE: <label> | CONFIDENCE: high|med|low | DEALBREAKER: yes|no`
— parsed deterministically (`stance_tally.ts`), never inferred from prose.
Weights are confidence factors (`high 1.0 / med 0.75 / low 0.5`); `W_total`
sums base weights over every member with a parseable stance (abstentions
included, so they raise the bar). Consensus requires an option to clear
`⅔ × W_total`; below threshold a structured **split** is returned to the
user — never a forced winner, never an auto-added round. The synthesis gains
a **Vote Tally** section (one line per option, the threshold, and a
cleared-or-escalated line). The final-round wiring is LIVE (2026-07-12): `consult` appends the contract to
the final round and `render` emits the Vote Tally block, threaded via
`payload.stance_tally`. A member whose stance line is missing or unparseable is
a repair-marker; the bounded stance-line-only repair CALL (policy: `repair_action`
— confirm-interactive / auto-fire under `--auto-continue`) and its estimate row
are the remaining dispatch wiring.

### Chairman synthesis (Phase 2 — opt-in)

The skill's own Iron Law argues the host, having framed the artefact, cannot
independently judge it. `chairman` lets a **non-deliberating member** author the
synthesis instead. **Default `host`** = today's behaviour, byte-identical.

**Configuration.**

- `chairman.mode` (enum `host` | `member` | `auto`, default `host`) — an unknown
  value is rejected at config load.
- `chairman.member` (string, required when `mode: member`) — must name a member
  that exists AND is enabled; **fails closed** at load otherwise.
- `members.<name>.tier` (int ≥ 1, optional) — capability rank used only as the
  `auto` tie-break (higher = stronger); non-integer / < 1 rejected at load.

**Selection** (`chairman.ts` `select_chairman`, pure): `host` → host synthesis;
`member` → the named member, but only if it did **not** deliberate this session
(a member that argued cannot self-judge — else host fallback with a visible
annotation); `auto` → **provider-family difference primary, tier tie-break,
config-order final** — decided by the contested-design council pass
(claude-sonnet-4-5 + gpt-4o, 2-round debate, 2026-07-12): independence from the
deliberators' priors is the binding constraint for a judge, so `auto` picks a
non-deliberating member (provider-different by construction under the
one-member-per-provider invariant); among candidates the optional
`members.<name>.tier` wins, else the deterministic config order; no
non-deliberating member → annotated host fallback. The billable chairman
dispatch (rendering the synthesis as one member call in `cmd_run`) is the
remaining wiring step.

**Blind synthesis — the default (road-to-council-blind-review adoption
U1, adopted 2026-07-28).** The chairman/synthesis stage is BLIND by default on
`council:run`: member responses reach the synthesizing stage as shuffled
A–E labels (`consensus.anonymize_responses`, deterministic question-hash
order), on both the member-chairman transcript and the host-path render.
The **post-verdict de-anonymization map is a mandatory audit step** — the
persisted artifact always carries the full `label → provider · model`
mapping after the synthesis slot; blind is only the synthesizer at
decision time, never the archive. Per-invocation opt-out:
`--no-blind-chairman`. Adoption basis: pre-registered n=10 A/B with
0/10 + 0/10 degradation triggers (`internal/bench/council-blind-review/`)
+ the measured self-preference/naming-bias literature; reverting the
default requires a new measured decision (test-pinned). Structural note:
at member count 2 a member chairman is impossible (both deliberate,
generator-cannot-self-judge) — blind rendering is then the host path's
protection. `--stances` / `--chairman-fields` remain default-off pending
the maintainer blind ratings (the roadmap's U2/U3 rules).

### Debate enforcement gates (Phase 3 — opt-in)

- `debate_gates.enabled` (bool, default `false`) — when on, round-2+ debate
  prompts carry the **anti-conformity directive** (`prompts.ANTI_CONFORMITY_DIRECTIVE`:
  defend a position; change only on a specific named flaw; agreement without a
  named reason is conformity). Byte-identical across api/cli/manual (it is part of
  the shared `user_prompt`). Default-off keeps the debate path byte-identical.
- `restate.enabled` (bool, default `false`) — or the `--restate` debate flag:
  a pre-round-1 pass collecting a ≤ 50-word restatement + one alternative
  framing per member (billable, through the same spend gate), rendered above
  the round-1 responses; a restatement with little token overlap vs the stated
  ask is flagged before further spend.

The deterministic post-round detectors — dissent-quota (`debate_gates.dissent_quota_met`)
and the novelty gate (`debate_gates.is_near_duplicate`, reusing the shared
Jaccard util) — are implemented and tested as pure functions.

**Repair-call policy** (`debate_gates.repair_action`) — decided by the
contested-design council pass (claude-sonnet-4-5 + gpt-4o, 2026-07-12): a cost
estimate is an upper bound, not a spend commitment, and repairs are failure-mode
responses — so **interactive runs get a one-line confirm** before each repair
call; **unattended runs (`--auto-continue`) auto-fire** under the hard cap
(≤ 1 repair per member per round, absolute — an already-repaired member is
skipped in every mode); manual-transport members follow the same policy. The repair dispatch is LIVE in `run_debate` (2026-07-12): post-round checks on
round 2+, ≤ 1 repair per member per round, dispatched via the CLI's
`_make_repair_confirm` transport (auto-fire under `--auto-continue`, one-line
confirm interactive); a successful repair replaces the member's round entry.

### Critic protocol (road-to-judgment-and-forensic-evidence Phase 2)

- `critic_protocol` (`"legacy" | "load_bearing"`, top-level, default
  `"legacy"`) — the declared critic posture for adversarial/skeptic review
  passes. HONEST SCOPE: today the only consumer is the A/B bench harness
  (`bench_critic_protocol.ts`, which runs both arms regardless of the
  configured value); no runtime surface reads the key yet, and none will
  until a passing arm is promoted — which the 2026-08-09 run did not do.
  Setting `load_bearing` therefore changes no shipped behaviour; the key
  exists so the selection surface and its default were fixed in the same
  change as the pre-registered experiment.
  - `legacy` — the shipped free-hunt skeptic ("assume this may hide a subtle
    defect; hunt for it"). Measured defect on record: 100 % false-positive
    rate on the frozen controversial-but-correct clean controls
    (`internal/bench/adversarial-council/corpus.json`, run 2026-07-21).
  - `load_bearing` — a fixed four-step protocol: state the invariant and name
    the single load-bearing assumption (tied to a named file/function), state
    the concrete failure scenario if it broke, state the cost of what the code
    is avoiding, then inspect the assumption and return `holds` (empty
    findings) or `flawed` (concrete findings). The discriminating property is
    that the protocol can return "this holds" as a completed review.
  - The A/B against the measured defect is pre-registered in `docs/CLAIMS.md`
    (`critic-protocol-load-bearing-ab`) and run by
    `src/scripts/bench_critic_protocol.ts` (`--mock` validates the pipeline in
    both directions without spend; `--run` is maintainer spend-gated). The
    default stays `legacy` regardless of the outcome — promotion is a
    separate, human decision.

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

**Optional second-model rung — `second_model`.** Absent by default. It
exists because the council was the ONLY rung between the agent and a
halt: a question below `high_impact` still stopped the run whenever no
council was configured or its quota was gone. One local pass fills that
gap without touching the locked classes.

Three constraints, each with its own reason:

- **The provider set is `anthropic | openai | gemini`** — narrower than
  the five `members:` accepts. `xai` and `perplexity` ship COMMUNITY CLI
  wrappers that consume an API key and are `billable = true`, so routing
  a resolution there would spend USD on the rung whose entire purpose is
  to be USD-neutral. The discriminator is `billable === false`, not "has
  a cli subclass".
- **Quota-bounded by the same `cli_call_budget` counter** the council's
  own cli transport books against. One subscription, one counter — a
  parallel count is how a plan quota gets spent twice.

  **This one is an OBLIGATION ON THE RUNG, not an enforced coupling, and
  the difference is stated because three surfaces asserted the stronger
  reading at once (R2 round 4, finding 4).** No TypeScript path reads
  `second_model` at runtime — the contract's own honesty note further
  down says so for `decision_resolution.classes[*]` generally — and
  `cli_call_budget.ts` declares its set of booking consumers closed at
  two, neither of them this. So a rung that books nothing is not
  prevented by a counter; it is required by this line to book against
  the counter when it is built. Until then, "quota-bounded" describes
  the contract the implementation must meet, never a guard that exists.
- **Rejected on `high_impact` / `user_required`**, not ignored, and even
  an explicit `null` is refused there. Same treatment `dispatch` gets on
  those classes, for the same reason: a key that is silently dropped
  reads to its author as configured, and this one would read as
  "high-impact questions may resolve without me".

**No self-adversarial fallback.** With neither a council nor a
second-model rung, the ambiguity halt stands. The gap is never filled by
the agent arguing both sides to itself — that produces a verdict with no
independent observer, which is the failure `evaluator-independence`
exists over, and it reads as convergence to whoever finds it later.

**Where the routing is enforced.** In this schema, and only here: no
TypeScript path reads `decision_resolution.classes[*]` at runtime — the
routing is agent-carried, and the loader is the one thing that can refuse
an illegal route before a model ever sees it. Stated so a reader does not
go looking for a resolver that does not exist.

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
      second_model: gemini  # optional local rung; USD-neutral
    high_impact:
      mode: user            # LOCKED — Iron Law
      confidence_threshold: 0.6
      # second_model here is a hard schema error, not a no-op
    user_required:
      mode: user            # LOCKED — Iron Law
      confidence_threshold: 0.6
```

**A resolution taken without contacting the user is recorded.**
`agent-config decision:memo write --run <id> --question … --chosen …
--reasoning … --resolver … --confidence high|medium|low` writes
`agents/runtime/state/decisions/<run>/NNN.md`. Local-only (the whole
`agents/runtime/` tree is gitignored), monotonic index per run, and the
writer refuses a memo missing any of the five fields — a record with no
reasoning is a log line pretending to be a decision record. It gates
nothing: the memo is what makes an autonomous resolution reviewable
afterwards, which is the condition under which it is legitimate at all.

### Prior negative result in the wild — and what would falsify OUR design

An unaffiliated agent project publicly DELETED its 6-judge LLM content
review, recording it as "cost without signal" (2026-07, external
AI-employee analysis intake; source anonymized per source-confidentiality).
External falsification pressure gets answered in writing, not left for
readers to notice:

- **The distinction.** That panel judged ARTIFACT CONTENT with free-form
  LLM opinions — N models reading the same text and emitting takes. This
  package's council judges CONFIG DELTAS and DECISIONS under a neutrality
  contract: pre-registered thresholds fixed before data, honest-null
  consequences that bind, stance tallies over free prose, necessity
  classifier gating whether a debate runs at all, and cost disclosure per
  call. Same word ("judges"), different mechanism class.
- **What would falsify OUR design** (recorded criterion): a measured run
  showing council-consulted decisions do not differ in outcome quality
  from solo-model decisions at matched cost — i.e. our own
  `council-vs-solo-baseline` claim failing its threshold on a
  pre-registered re-run — or the necessity classifier's "unnecessary"
  verdicts exceeding its budget while verdict quality stays flat. If that
  evidence lands, the honest disposition is the external project's:
  delete the cost, publish the null, keep the deterministic gates.

### Low-impact council opt-in

The default route for `low_impact` is `agent` — the host resolves locally
and the council is not invoked. Sending `low_impact` to the council is
an **explicit, two-knob opt-in**; missing either knob keeps the question
on the host:

1. `decision_resolution.classes.low_impact.mode: council` (default
   `agent`) — flips the class route.
2. **At least one** enabled member sets `participate_low_impact: true`
   (default `false`) — names which members run on the fast-path.

When both knobs are set, the lightweight-QA fast-path
(`ai_council.fast_path`) handles the resolution under hard caps:
`max_members ∈ {1, 2}`, `max_rounds: 1` (LOCKED — Iron Law of the
fast-path; the loader rejects any other value), `max_tokens: 2500`
combined input + output budget, `max_cost_usd: 0.05` per resolution.
No advisors, no peer-review, no consensus scoring run on this path.

`high_impact` and `user_required` cannot reach the fast-path at all —
the impact-class Iron Law above takes precedence.

Worked example — opt the Anthropic and OpenAI members in, leave the
others off, and switch the `low_impact` class to `council`:

```yaml
# In the resolved .ai-council.yml — keys are top-level (no `ai_council:` wrapper).
members:
  anthropic:
    enabled: true
    model: claude-sonnet-4-5
    api_key_ref: file:anthropic.key
    participate_low_impact: true   # eligible for fast-path
  openai:
    enabled: true
    model: gpt-4o
    api_key_ref: file:openai.key
    participate_low_impact: true   # eligible for fast-path
  gemini:
    enabled: false                  # disabled — opt-in ignored even if set

fast_path:
  max_members: 2          # 1 or 2 only
  max_rounds: 1           # LOCKED
  max_tokens: 2500
  max_cost_usd: 0.05

decision_resolution:
  classes:
    low_impact:
      mode: council          # ← flip from default `agent`
      confidence_threshold: 0.6
```

Validation behaviour:

- `participate_low_impact: true` on a member with `enabled: false`,
  or with the global council disabled, parses but is treated as
  `false` with a one-line loader warning — never silently runs.
- `fast_path.max_rounds != 1` → `CouncilConfigError` at load time.
- `fast_path.max_members ∉ {1, 2}` → `CouncilConfigError`.
- `low_impact.mode: council` with zero opted-in enabled members →
  the resolver falls back to `agent` (or escalates to user when the
  confidence gate trips), with the marker
  `> Low-impact council unavailable (no opted-in members) — escalating to user`.

Transparency markers on every fast-path attempt:

- **Resolved** — `> Resolved via low-impact council (<member>): <answer>`
- **Split** — `> Low-impact council split — escalating to user (<m1>: X / <m2>: Y):`
- **Aborted** — `> Low-impact council aborted (token cap) — escalating to user:`

The marker is mandatory; the agent never silently substitutes a
fast-path verdict for its own answer. See
[`ai-council § Lightweight-QA fast-path`](../../.agent-src.uncondensed/skills/ai-council/SKILL.md#lightweight-qa-fast-path-phase-11)
for the orchestration contract and session-artefact format.

### Solo-member dispatch (step-9 P8/P9 · U1 · U2 · U3)

Three new top-level settings cooperate to make low-impact decisions
optionally cheap by routing them to a single member instead of the
full council. Defaults preserve the prior shape — no behaviour
changes unless every knob is set explicitly.

| Key | Type | Default | Constraint |
|---|---|---|---|
| `defaults.member_mode` | `cli` \| `api` | `cli` | Per-member fallback when a member doesn't set `mode`. `manual` is rejected here (manual transport is full-council only). |
| `routing.solo_member_fallback_chain` | `list[str]` | `[]` | Ordered, unique provider names. Each entry must exist in the `members` block. Empty disables solo dispatch. |
| `routing.auth_check_timeout_seconds` | `int` | `3` | Range `[1, 30]`. Bounds the lazy auth probe per chain member. |
| `low_impact.dispatch` | `full` \| `single` | `full` | `single` requires at least one enabled member in the fallback chain — otherwise rejected at load. |
| `low_impact.shadow_sample_rate` | `float` | `0.1` | Range `[0.0, 1.0]`. Phase 10 shadow-mode sampling probability. |
| `low_impact.solo_confidence_floor` | `float` | `0.7` | Range `[0.0, 1.0]`. Phase 13 confidence-gate threshold. Solo responses scoring below this floor — or matching split / refusal patterns — auto-escalate to the full council. |

**Iron Law (LOCKED).** `decision_resolution.classes.high_impact.dispatch`
and `decision_resolution.classes.user_required.dispatch` are rejected
at load time — high-impact and user-required decisions always run the
full council, with no opt-out. Top-level `high_impact: { dispatch: … }`,
`high_impact: { solo_confidence_floor: … }`, `user_required: { dispatch: … }`,
and `user_required: { solo_confidence_floor: … }` are all rejected the
same way so a mistaken surface choice cannot bypass the lock — these
classes never run solo, so a solo-specific knob there is incoherent.

```yaml
defaults:
  mode: api
  member_mode: cli       # use CLI binaries by default for per-member calls

routing:
  solo_member_fallback_chain: [anthropic, openai]   # try anthropic first
  auth_check_timeout_seconds: 3

low_impact:
  dispatch: single             # route low_impact via solo dispatch
  shadow_sample_rate: 0.1      # 10% shadow to full council for SLO tracking
  solo_confidence_floor: 0.7   # auto-escalate if confidence < 0.7
```

### Confidence gate — auto-escalation on uncertain solo runs

When `low_impact.dispatch: single` is enabled, every solo response is
scored before the verdict is returned. Four escalation reasons can
trigger an automatic fallback to the full council, in priority order:

| Reason | Trigger | Source |
|---|---|---|
| `refusal` | Empty response or refusal markers (`I cannot decide`, `weiß ich nicht`, …). | `confidence_gate.is_refusal` |
| `split` | Two competing verdicts without a pick (`Option A … Option B`, `Verdict: ship / Verdict: hold`, `Variante 1 / Variante 2`). | `confidence_gate.is_split_response` |
| `short_response` | Response shorter than ~20 chars — treated as low-signal. | `confidence_gate.extract_confidence` length floor |
| `low_confidence` | Explicit `Confidence: 0.X` marker below the floor, or hedge-word density (`maybe`, `perhaps`, `not sure`, `vielleicht`) pulling the implicit score below the floor. | `confidence_gate.extract_confidence` |

Escalations are recorded in the shadow-mode log alongside the
disagreement signal — see the `escalated` and `escalation_reason`
fields in the `shadow.jsonl` row contract. The shadow SLO banner
appends a separate auto-escalation rate so a quiet uptick in solo
uncertainty cannot hide behind a flat disagreement rate.

The escalation path uses zero extra LLM calls — heuristics run on the
solo response text in process. The fallback `run_full()` only fires
when the gate flags the response.

### Low-impact corpus build pipeline (step-10)

[`agents/decisions/low-impact-decisions.md`](../../agents/decisions/low-impact-decisions.md)
remains the **human-editable source of truth** — Validated, Probation,
and Anti-Example phrases stay in Markdown so PR-reviewers diff prose,
not YAML. A build step compiles it into a generated YAML lockfile
[`agents/decisions/low-impact-decisions.lock.yaml`](../../agents/decisions/low-impact-decisions.lock.yaml)
that is the **runtime source of truth**: the necessity classifier and
the solo-dispatch fuzzy matcher load phrases from the lockfile, with
Markdown parsing reserved as fallback.

| Component | File | Role |
|---|---|---|
| Source | `agents/decisions/low-impact-decisions.md` | Hand-edited Markdown. Strict parser (step-9 P4) catches drift. |
| Build tool | `scripts/ai_council/compile_corpus.py` | `parse_corpus_strict()` → schema-v1 YAML. Deterministic output. |
| Lockfile | `agents/decisions/low-impact-decisions.lock.yaml` | Generated, **committed**. Schema `{schema_version: 1, provenance: {…}, validated, probation, anti_examples}`. |
| Runtime loader | `low_impact_corpus.load_corpus_lock()` + lenient `load_*` shims | YAML preferred; Markdown fallback when the lockfile is missing or schema-mismatched. |
| CI gate | `task check-corpus` (used by `task consistency`) | Fails on drift between source and lockfile. |

The committed lockfile is the contract: a stale lockfile fails CI the
same way `dist/agent-src/` drift does. The Markdown parser stays in the
repo as a build-time dependency, not a runtime dependency — a parser
regression breaks `task consistency`, never the live council.

`scripts/ai_council/learn_low_impact_preview.py` deliberately stays on
`parse_corpus_strict` (Markdown). It runs **before** `task sync`
rebuilds the lockfile, so it must read whatever the user just edited.

## `model_downgrade` — auto-tiering + the A1↔A3 cache coupling

Since the A3 slice of `road-to-api-cost-optimization` (2026-07-20):

```yaml
model_downgrade:
  enabled: true        # default; false disables the size-fit gate entirely
  auto_apply: false    # DEFAULT since 2026-07-28 — suggest, don't silently
                       # apply. The A3 auto-ON default (2026-07-20) shipped
                       # without a paired quality measurement (the only
                       # default-ON surface without one); it re-flips to true
                       # when a paired eval (full vs downgraded members,
                       # blind judge) shows held quality. Set true to opt in.
  model_tier_override: # per-run escape hatch: member -> pinned model id
    anthropic: claude-sonnet-4-5
```

- Small / low-complexity artefacts (per `necessity.classify_size_fit`,
  character-based) auto-downgrade one ladder rung; the `debate` lens never
  downgrades.
- **Cache coupling:** a downgrade is applied only when the model saving beats
  the forfeited model-scoped prompt-cache reads
  (`pricing.downgrade_coupling`: `downgrade_savings > lost_cache_savings`,
  expected reads = rounds − 1). One-shot paths (the low-impact fast-path)
  have no reads to lose and downgrade to the CHEAPEST ladder rung outright.
- `model_tier_override` pins a member to a model for the run — classifier and
  coupling both skipped. Set it per artefact when a specific tier is needed.
- Requires `model_ladder` on the member (smallest → largest, must include the
  active `model`).

## `prompt_cache.ttl` — cache-control TTL tier (Phase 4, road-to-cache-economy)

```yaml
members:
  anthropic:
    # prompt_cache: false                # pre-existing bare-bool form — unchanged
    prompt_cache:
      ttl: 5m                            # '5m' | '1h' — DEFAULT '5m'
```

`prompt_cache` accepts either its pre-existing bare boolean (enable/disable —
untouched by this section) or a mapping carrying `ttl`. When a mapping is
given without `ttl`, or the key is absent entirely, `ttl` resolves to `'5m'`.
The resolved value is threaded into **both** `cache_control` breakpoints
Anthropic's client builds (the neutral system prompt and the round-stable
artefact prefix — never the per-round volatile suffix); `'5m'` never appears
on the wire (omitting `ttl` is Anthropic's own 5-minute default), so an
unconfigured member's request is byte-identical to the pre-Phase-4 shape.
Anthropic's own ordering rule — any `1h` breakpoint must precede every `5m`
breakpoint in one request — is asserted defensively at construction time,
though this client can never violate it: both breakpoints always share the
same configured tier.

**Falsification condition — `'5m'` is the permanent default until this
clears.** Enable `'1h'` **only if** ≥40% of a 30-debate sample shows
inter-round gaps ≥5 minutes (measured via `run_debate`'s
`on_round_complete` third argument, recorded as `prompt_cache_round_gap_ms`
in each `debate-round-N.json` artefact; `null` on round 1). Even if that
sample clears, run the same debate at both `ttl: 5m` and `ttl: 1h` and
compare weighted cache-accounting units (`pricing.ts`'s 0.1×/1.25×/2.0×
multipliers): if `1h` costs more, `'5m'` stays the default **permanently**
and `ttl: 1h` ships only as a documented niche override. A blanket `1h`
default was measured **+8.6% worse** upstream
(anthropics/claude-code#74318) — this package does not repeat that mistake
without its own evidence.

**Host subagents are unaffected.** This key governs ONLY the council's own
Anthropic API calls (`clients.ts` builds the request; the council pays the
bill directly). Claude Code's host-dispatched subagents are pinned to a
5-minute TTL regardless of any config here or any environment variable —
see `docs/guidelines/agent-infra/api-cost-levers.md § Claude Code note`.

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
  - `auto` = pick one of the above per provider per invocation (cli → api →
    unavailable); `manual` is never in the chain. **The shipped default**
    (road-to-always-on-orchestration Phase 3.1, CLI-first doctrine) — a
    pinned `manual` / `api` / `cli` on `defaults.mode` or a per-member
    `mode:` still overrides it.

  Precedence: per-invocation flag > per-member override > defaults > built-in
  fallback. The loader fills `defaults.mode` with `auto` when the key is
  absent; the resolver's built-in fallback, reached only when no layer
  supplies a mode at all, is `manual`. See
  [Two defaults, not one](#two-defaults-not-one).
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
- **Session retention.** `agents/runtime/council/sessions/` audit folders older
  than `defaults.session_retention_days` are pruned automatically on the
  next `save()`. `0` disables pruning — disk grows unbounded.
- **`cost_budget` semantics.** The orchestrator pauses before any member
  whose projected spend would breach a cap and asks the user to continue.
  Each `0` value disables that single cap; other caps still apply.
  Prices come from [`agents/runtime/.agent-prices.md`](../../agents/runtime/.agent-prices.md)
  (gitignored, refreshed weekly by `./scripts-run src/scripts/update_prices`;
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
7. `defaults.mode` not in `{"api", "manual", "cli", "auto"}`; per-member `mode`
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
14. `quorum` is set and is neither the literal string `"majority"` nor a
    positive integer (`>= 1`) — road-to-always-on-orchestration Phase 3.3.

## Migration footprint (Phase 0)

> Historical record of the Step-2 consolidation. **The project-local file
> described below is no longer read** — ADR-104 (superseding ADR-093) moved
> the council config to the user-global location documented at the top of
> this contract. A `.ai-council.yml` under any project `agents/` tree is
> ignored. Read this section for provenance only, not for placement.

- `.agent-settings.yml` → 14-key inventory under `ai_council:` removed
  after a one-line breadcrumb comment is in place pointing at this
  contract.
- `.agent-settings.template.yml` → same removal.
- New file `agents/settings/.ai-council.yml` checked in with two enabled <!-- council-config-allowed -->
  providers (anthropic + openai) and three disabled
  (gemini + xai + perplexity). Models pre-filled from the Phase 0
  default set; comments mirror this contract. *(This project-tracked file
  was later removed; per ADR-104 the config is user-global only.)*
