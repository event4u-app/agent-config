---
stability: beta
keep-beta-until: 2026-10-10
---

# AI-Team Config (`ai_team` block)

**Purpose.** Lock the schema, validation, and quota rules for the `/team`
cross-model review family — one strong external model (via the codex CLI,
subscription-authed) reviewing inside the repo. Team mode is the **depth**
complement to the council's **breadth**; this contract is the boundary that
prevents drift across the settings template, the loader, the `/team`
wrappers, and the quota counter.

**Audience.** Authors of `src/scripts/ai_team/config.ts`, the `/team`
command family, the doctor `team` section, and the setup wizard. Also
reviewers checking that new team features keep the schema intact.

**Status.** Internal-locked. Changes require a contract version bump and a
revision entry in the consuming roadmap.

## File location

Unlike the council (ALWAYS user-global `.ai-council.yml` — see
[ai-council-config.md](ai-council-config.md)), the `ai_team` block lives in
the **project settings cascade**:

```
<project>/.agent-settings.yml   →   ai_team: { … }
```

read via `load_agent_settings` (`src/scripts/_lib/agent_settings.ts`) and
validated by `src/scripts/ai_team/config.ts:load_ai_team_config`. Team mode
is a per-project posture (default-off), not a per-developer credential
store — the codex CLI carries the subscription auth itself, so there is
nothing secret to centralize. The shipped defaults live in
`src/config/agent-settings.template.yml` and are mirrored by the wizard
schema (`src/server/schemas/settings.ts`, enforced by the schema↔template
parity test).

## Schema

```yaml
ai_team:
  enabled: <bool>                 # master switch, default false
  model: <string>                 # default 'auto'
  allow_delegate: <bool>          # second opt-in for the write path, default false
  max_calls_per_day: <int >= 0>   # default 50; counts into the shared openai bucket
  suppress_setup_hint: <bool>     # default false; cosmetic wizard-hint suppression
  review_gate:                    # managed governance of the plugin's Stop-hook Review Gate
    managed: <bool>               # default false = byte-identical pre-Phase-4 behavior
    max_consecutive_blocks: <int >= 1>  # default 3; circuit-breaker loop bound
```

| Key | Type | Default | Semantics |
|---|---|---|---|
| `enabled` | bool | `false` | Master switch. `false` = `/team` commands are never suggested and every invocation refuses with an enable pointer — byte-identical to pre-feature behavior. `true` = the family is live; per-command gates below still apply. |
| `model` | string | `'auto'` | Model handed to the codex CLI. `'auto'` = pass **no** `--model` flag; the codex CLI's own default applies. Any other value passes through **verbatim** as `--model <value>`. |
| `allow_delegate` | bool | `false` | Second opt-in for the **only** wrapper that delegates write access (`/team:delegate`). Refuses with an enable pointer until BOTH `enabled` and `allow_delegate` are `true`. |
| `max_calls_per_day` | int ≥ 0 | `50` | Per-day ceiling on team calls, read against the **shared** `cli_call_budget` openai bucket (see § Quota). `0` blocks all team calls. |
| `suppress_setup_hint` | bool | `false` | Suppress the one-line wizard/init recommendation to install the codex plugin on Claude-Code hosts. Cosmetic only. |
| `review_gate.managed` | bool | `false` | Managed governance of the codex plugin's Stop-hook Review Gate (Phase 4). `false` = no counting, no circuit breaker — the Stop path is byte-identical to pre-Phase-4 dispatch. `true` = consecutive BLOCK verdicts are counted per session (first-line `ALLOW:`/`BLOCK:` contract of the gate transcript; anything else is honestly `UNKNOWN` and never counted) and the circuit breaker trips at the bound. |
| `review_gate.max_consecutive_blocks` | int ≥ 1 | `3` | Circuit-breaker bound. At this many CONSECUTIVE BLOCKs in one session a visible notice is injected **exactly once** and the managed layer stops re-blocking — the user decides, never an infinite Claude↔Codex loop. An ALLOW verdict resets the counter. Unknown keys inside `review_gate` are rejected fail-closed, same as the parent block. |

### Why `model: 'auto'` instead of a pinned ID

A hardcoded model ID rots silently (the council's own CLI default is a
deliberate, documented *pin* — `DEFAULT_OPENAI_CLI_MODEL` in
`src/scripts/ai_council/clients.ts`, see
[ai-council-config.md](ai-council-config.md)). Team mode inverts that:
under a subscription the *strongest* available model is the rational
default, and only the codex CLI knows what that currently is. `'auto'`
therefore delegates the choice to the CLI; a set value is a user pin and
passes through verbatim — the loader never rewrites or "corrects" it.

**`review_gate` (Phase 4, shipped):** the loop-bound governance block is
live — module `src/scripts/ai_team/review_gate.ts` (counter state under
`agents/runtime/state/team-review-gate.json`, ledger under
`agents/runtime/team/events.log`, one `team.gate: BLOCK 2/3` /
`ALLOW reset` line per gate verdict). The gate itself stays upstream's;
upstream's own warning applies while it is enabled unmanaged: "The
review gate can create a long-running Claude/Codex loop and may drain
usage limits quickly." Any other key stays rejected fail-closed.

## Role semantics — the council-verdict design constraint

Verbatim from the consuming roadmap's council verdict, binding on every
team-mode phase:

> **Council verdict on team-mode frontmatter (claude-sonnet-4-5 + gpt-4o,
> 2026-07-12, unanimous REJECT):** skills/commands get NO `team_mode` /
> role frontmatter. Role semantics belong in the `ai_team` config block +
> prompt library (reusing subagent-orchestration's implementer/judge frame
> and status envelope), not smeared across 271 skill files while the
> feature's role model does not operationally exist. Revisit-if: Phase 2
> execution turns out to be blocked SPECIFICALLY on artefact-level role
> metadata — then re-open via decision-revisit-gate, not by silently
> adding the key.

Operationally: ALL role semantics (builder/reviewer/verifier selection,
eligibility) live HERE — in this `ai_team` block — plus the prompt
library, reusing `subagent-orchestration`'s implementer/judge frame and
its `subagent-status.json` envelope. **No `team_mode`/role frontmatter key
is added to skill/command/rule schemas.**

## Quota — one machine, one counter

```
TEAM CALLS COUNT INTO THE EXISTING cli_call_budget OPENAI BUCKET.
ONE MACHINE-WIDE COUNTER ACROSS ALL SUBSCRIPTIONS/PROFILES.
NEVER A PARALLEL COUNTER.
```

The counter is deliberately **machine-wide spend across subscriptions**:
two `agent-switch` profiles on two accounts share the one
`cli-calls.json` bucket. That is the recorded semantics (2026-07-27,
resolving the wording/implementation contradiction the consumer-index
intake flagged) — the counter does NOT move under the profile.

The daily CLI-call counter is already **generic per-provider** — no
team-specific counting system exists or may be built:

- **State file:** `~/.event4u/agent-config/cli-calls.json`
  (`CLI_CALLS_FILENAME`, `src/scripts/ai_council/clients.ts:716`), shape
  `{ date: "YYYY-MM-DD", counts: { <provider>: <int> } }`, resets on UTC
  date rollover.
- **Read:** `load_cli_call_counts(path?)` —
  `src/scripts/ai_council/clients.ts:738`. Returns today's per-provider
  counts; empty on rollover.
- **Increment:** `record_cli_call(provider, path?)` —
  `src/scripts/ai_council/clients.ts:774`. Returns the new total.
- **Gate + increment on the transport itself:** `CliClient.ask()` checks
  the counter *before* spawning (`clients.ts` § quota gate, returns
  `error: 'cli_quota_exhausted'` + a `block_quota` events-log line when
  exhausted) and records the call *after* — even failed calls count, so a
  broken CLI cannot burn the budget in a tight loop.
- **The openai bucket:** `OpenAICliClient` (`clients.ts:1275`) has
  `name = 'openai'`; council CLI calls and team calls land on the **same**
  `counts.openai` entry.

A `/team` invocation therefore reuses the existing seams, in preference
order:

1. **Through the transport** — construct `OpenAICliClient` with
   `max_calls_per_day: <ai_team.max_calls_per_day>`; the gate, the
   exhausted-error, the events-log line, and the increment all come for
   free.
2. **Direct** (for `/team:status` rendering or a pre-flight check) —
   `load_cli_call_counts()['openai'] ?? 0` to read,
   `record_cli_call('openai')` to count. No new helper exists because
   none is needed; adding a team-side duplicate of this counter is a
   contract violation.

`ai_team.max_calls_per_day` and the council's
`cli_call_budget.max_calls_per_day.openai` are two *ceilings* over the
same *counter*: whichever path a call takes, it increments the one shared
bucket, and each surface enforces its own configured cap against that
shared count.

**Worked example — two ceilings, one counter.** Council ceiling
`cli_call_budget.max_calls_per_day.openai: 100`, team ceiling
`ai_team.max_calls_per_day: 50`, shared counter at 45 openai calls today:
both paths are open. Five team calls later the counter reads 50 — team
calls are now blocked (50 >= 50) while council CLI calls continue until
the counter reaches 100. Whichever path fires a call, the same counter
moves; each surface only decides where *its* ceiling sits on that shared
count. `/team status` renders exactly this state: the live counter, both
ceilings, and which path (if any) is currently blocked.

### Team-review envelope

Every `/team:review` return — plugin path and multi-host fallback alike — is emitted in the
team-review status envelope (`src/skills/subagent-orchestration/schemas/team-review-status.json`),
which extends the `subagent-status.json` frame: `status` (`DONE | DONE_WITH_CONCERNS |
NEEDS_CONTEXT | BLOCKED`), `findings[]` (`severity`/`evidence`/`suggested_fix`/`location?`),
`reviewed_ref` (HEAD sha of the bundle), `model` (`'auto'` = codex CLI default), and
`quota` (`{used, ceiling}` on the shared `cli_call_budget` openai bucket); unparseable model
output is preserved verbatim in `raw` with status `DONE_WITH_CONCERNS` — never silently dropped.
Plugin text is summarized INTO the envelope and preserved verbatim beneath — never rewritten.
<!-- PLACEHOLDER: the team-review-envelope subsection (review-gate ledger
     line format `team.gate: BLOCK n/N` read by /team status) is inserted
     here by the orchestrator in a later step. Do not remove this marker. -->

## Validation rules (fail-closed)

`load_ai_team_config` / `build_ai_team_config`
(`src/scripts/ai_team/config.ts`) raise `TeamConfigError` when:

1. `ai_team` is present but not a mapping,
2. any **unknown key** appears under `ai_team` (a typo must never
   silently disable a gate),
3. `enabled` / `allow_delegate` / `suppress_setup_hint` is not a boolean,
4. `model` is not a non-empty string,
5. `max_calls_per_day` is not a non-negative integer (booleans rejected).

An **absent** `ai_team` block is not an error — it yields the defaults
(`AI_TEAM_DEFAULTS`) and the feature stays off.

## Default-off posture

Every team-mode capability is default-off. With the block absent or
`enabled: false`, all paths are byte-identical to pre-feature behavior:
no command suggestions, no wrapper execution, no quota consumption, no
wizard nagging beyond the single suppressible setup hint.
`/team:delegate` is doubly gated (`enabled` AND `allow_delegate`).

## No-claims constraint

No public claim about cross-model review quality ("a second model finds
errors the first never sees", "two strongest models catch each other's
errors", or any review-lift assertion) may exist anywhere in the tree
until the pre-registered three-arm defect-finding benchmark has produced
a verdict bound in CLAIMS.md. Workflow-value prose is allowed; lift
claims are not. An honest null keeps the feature documented as workflow
value only.

## Boundary vs. the council

Team mode and the council are complements, not variants — the council's
neutrality contract is untouched by team mode:

| Axis | Council ([ai-council-config.md](ai-council-config.md)) | Team (`ai_team`) |
|---|---|---|
| Shape | N members, breadth | One strong reviewer, depth |
| Repo access | NEVER (artefact text + neutral preamble only) | Full (reviewer runs inside the working tree) |
| Config location | User-global `.ai-council.yml` (ADR-104) | Project `.agent-settings.yml` cascade |
| Default models | Mid-tier, cost-conscious | Subscription's strongest (`model: 'auto'`) |
| Quota | `cli_call_budget` per provider | Same counter — shared openai bucket |

This link is deliberately one-directional (team → council); the council
contract does not reference team mode.
