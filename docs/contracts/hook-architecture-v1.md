---
stability: beta
keep-beta-until: 2026-08-12
---

# Hook architecture v1

**Purpose.** Pin the contract that the universal hook dispatcher
implements, so concern scripts and per-platform trampolines can be
written, tested, and refactored against a stable surface.

**Scope.** Defines the dispatcher's stdin/stdout shape, exit-code
semantics, the `hook_manifest.yaml` schema, the concurrency contract
for `agents/runtime/state/` writes, and the Copilot fallback pattern. Does
**not** specify per-platform install paths — those live in
[`chat-history-platform-hooks.md`](../../agents/settings/contexts/chat-history-platform-hooks.md).

Last refreshed: 2026-08-17.

## Vocabulary

| Term | Meaning |
|---|---|
| **Platform** | Host agent surface — one of `augment`, `claude`, `cowork`, `cursor`, `cline`, `windsurf`, `gemini`, `copilot`. The `claude` value covers both Claude Code (CLI) and Claude.ai Web; `cowork` covers the Claude desktop app's local-agent-mode runtime separately so chat-history entries can attribute events to Cowork vs CLI Claude Code via the `agent` field. Cowork shares Claude Code's lifecycle vocabulary and payload shape but is upstream-blocked from reading any settings source as of writing (anthropics/claude-code#40495, #27398). The canonical platform identifier is `claude` for the CLI/IDE surface and `cowork` for the desktop sandbox (both match `chat_history.PLATFORM_EVENT_MAP`). |
| **Concern** | A single agent-config behaviour wired to one or more lifecycle events — e.g. `chat-history`, `roadmap-progress`, `verify-before-complete`. Lives as a Python script under `scripts/hooks/concerns/<name>.py`. |
| **Event** | The agent-config-internal event vocabulary the dispatcher exposes — `session_start`, `session_end`, `user_prompt_submit`, `pre_tool_use`, `post_tool_use`, `stop`, `pre_compact`, `agent_error`, `subagent_start`, `subagent_stop`. Per-platform native names map to these. `agent_error` is synthetic — fired by the agent (or wrapper) when the host crashes outside a concern, so chat-history can checkpoint partial sessions on abnormal exit. (Added in Round 2 — 2026-05-04.) `subagent_start` / `subagent_stop` bracket **one subagent dispatch**, not one session — the only pair in this vocabulary whose scope is narrower than a session. They are aliased on `claude` and `cowork` only; a platform that never sends them has no alias row, which is how the table expresses absence rather than a per-platform flag. (Added 2026-08-13 — `road-to-subagent-lifecycle-integrity` Phase 1.) |
| **Trampoline** | A 5–10 line per-platform shell script that reads the platform's native payload, calls the dispatcher with `--platform <name>`, and forwards the platform's exit-code semantics. |
| **Dispatcher** | `src/scripts/hooks/dispatch_hook.ts` — single Python entrypoint that reads the manifest, resolves which concerns fire on `(platform, event)`, runs each one with the contract envelope below, and reduces their exit codes. |

## Dispatcher invocation

```
./scripts-run src/scripts/hooks/dispatch_hook \
    --platform <name> \
    --event <agent-config-event> \
    [--native-event <platform-event>] \
    < platform-payload.json
```

`--native-event` is informational; the dispatcher does not branch on
it. The trampoline is responsible for translating the platform's
native event name to the agent-config vocabulary before invocation.

## Stdin contract — concern envelope

The dispatcher writes a single JSON object to each concern's stdin:

```json
{
  "schema_version": 1,
  "platform": "augment",
  "event": "stop",
  "native_event": "Stop",
  "session_id": "…",
  "workspace_root": "/abs/path",
  "payload": { /* opaque, platform-native */ },
  "settings": { /* materialized .agent-settings.yml subset */ }
}
```

Concerns MUST treat unknown top-level keys as forward-compat extensions
and MUST NOT raise on them. `payload` is passed through verbatim from
the platform — concerns extract what they need via their own helpers
(see `scripts/chat_history.py` `_extract_*` for the pattern).

## Stdout contract — concern reply

A concern MAY write a single JSON object to stdout. The dispatcher
reads it; non-JSON or empty stdout is treated as no-op (decision
inferred from exit code only).

```json
{
  "decision": "allow" | "block" | "warn",
  "reason": "human-readable, ≤ 200 chars",
  "additional_context": "optional — surfaces back to the model on platforms that support it",
  "state_writes": ["agents/runtime/state/chat-history.json", "…"]
}
```

`state_writes` is advisory; concerns still write the files themselves
under the concurrency rules below.

## Exit-code semantics

| Code | Meaning | Dispatcher action |
|---|---|---|
| `0` | allow | no-op; pass through |
| `1` | block | dispatcher exits 1, surfaces `reason` to platform's deny channel |
| `2` | warn | dispatcher exits 0, logs `reason` to stderr, sets `additionalContext` if platform supports it |
| `≥ 3` | error | dispatcher logs full traceback, exits 0 (fail-open) unless `concerns.<name>.fail_closed: true` in settings |

## What a concern may block on — severity follows the INPUT TYPE

```
A CONCERN MAY BLOCK ON STRUCTURED INPUT OR STRUCTURED STATE.
A CONCERN WHOSE DECISION RESTS ON FREE TEXT ALONE MAY ONLY WARN.
FREE TEXT MAY TRIGGER A LOOKUP. IT MAY NOT BE THE VERDICT.
```

Three shipped `blocking` concerns decided by running regular expressions over
natural-language or shell text. A cross-project audit over 129 sessions
(`agents/evidence/audits/session-audit-2026-08-12.md`) measured false positives
in **all three**, each one refusing work the operator had asked for:

| Concern | Input | What it refused |
|---|---|---|
| `evidence-independence` | a subagent **prompt** | 15 of 16 workers in an implementation fan-out |
| `block-unauthorized-git` | a **shell command** | a PR whose title said "publish", two read-only `gh api` GETs |
| `turn-end-gate` | the assistant's **reply prose** | honest "not done yet" status lines |

Each was fixed by narrowing its pattern. The council convened on the design
(anthropic + openai, 2026-08-12, quorum 2/2) rejected that as the durable
answer, and the reason is not stylistic:

> a finite pattern cannot bound an infinite false-positive set — narrowing is
> sampling from an unbounded error space, not converging on a solution.

The history supports it. `block-unauthorized-git` has now been narrowed three
times (quoted `|`, dotted path segments, unanchored verb) and
`evidence-independence`'s self-scope discriminator was *itself* the fix for an
earlier false positive of the same shape.

### The three tiers

- **Tier 1 — structured input may block.** The decision reads a schema-validated
  field, an enum, a tool name, a file path, an exit code. Nothing is inferred
  from prose. This is where a guard belongs whenever the ground truth exists at
  call time.
- **Tier 2 — free text triggers, structured state decides.** The pattern is a
  high-recall *trigger*; the block requires an independent structured fact to
  corroborate it. `turn-end-gate` is the shipped example: the completion pattern
  only fires as a trigger, and the refusal additionally requires an unsettled CI
  read. A Tier-2 guard may block.
- **Tier 3 — free text alone may only warn.** No structured corroboration is
  available, so the verdict rests on inferred intent. Warn, log, and use the log
  to decide whether a structured alternative can be built.

### Why a prompt cannot reach Tier 1 by pattern alone

Shell has positional grammar, so "verb at command position" is a real
structural discriminator — that is what the git guard's anchoring now uses. A
subagent **prompt has no grammar to anchor to**: `review this branch` is
ambiguous between an action, a topic, and a location, and the audited false
positive was exactly that ambiguity. The council's answer is to emit intent as
structured metadata at the call site (a `role` / `evidence_scope` field the
dispatcher sets), where the caller knows by construction what it is asking for —
not to keep guessing from the text.

Until such a field exists, a prompt-reading concern is Tier 3.

### What text a guard actually receives — pre- or post-expansion

The council raised this as the blind spot the audit missed: a guard reading
`rm $FILES` cannot know whether `$FILES` expands to `*.tmp` or `*`. Establishing
it matters because it decides whether a Tier-1 classification can be trusted at
the moment of the read. Measured 2026-08-12, and the answer splits:

**Transport adds nothing.** `dispatch_hook._build_envelope` `JSON.parse`s stdin
and places the object under `payload` unmodified; `envelope.unwrap` only
unwraps. Nothing between the host and a concern rewrites the text — which is
what "`payload` is passed through verbatim from the platform" above means, now
stated for expansion specifically because the word appeared nowhere in this
document.

**The shell guards are built for PRE-expansion text, and their own machinery is
the evidence.** `block_unauthorized_git` hand-parses `$(…)`, backticks and
process substitution out of the command string and unwraps `sh -c` / `eval`;
`block_no_verify` does its own tokenisation and heredoc stripping. That code is
dead on post-expansion input. Both headers additionally record
`P=publish; npm $P` as a **measured, still-open** vector — a hole that only
exists if the guard never sees the expanded form, and which their test suites
pin as an accepted gap rather than a bug.

**The host fact itself is undetermined, and this is stated rather than closed.**
No captured `PreToolUse` envelope carrying a `$VAR`, a `$(…)` or a `Task`
dispatch exists anywhere in the tree; the one hook fixture is hand-authored and
is required by its own README to carry no real content. So the tree proves the
guards' *design assumption*, not the platform's behaviour. What would settle it
is already shipped: `AGENT_HOOK_CAPTURE_DIR` makes `dispatch_hook` write raw
stdin to disk **before** the envelope is built, so one hook-bound session with a
`$HOME` still literal in the captured `tool_input.command` closes the question
for every guard at once. Setting that variable is a host-environment change, i.e.
a human action outside an agent session.

**A dispatch prompt has no expansion stage to worry about.** For `Agent` / `Task`
the model emits the final string into `tool_input.prompt`; a slash-command
template is expanded before the model writes the call, so no placeholder survives
to hook-read time. The template concern is therefore a **shell** concern in
practice, not a dispatch-prompt one.

**The consequence for the tier rule, either way the host answers:** a Tier-1
claim is a claim about the text *at the moment the guard reads it*. An input that
is a template variable at that moment is **not** structured, however structured
its eventual value — so a `role` / `evidence_scope` field carrying an
unsubstituted placeholder buys nothing over the prose it replaced, and a concern
reading one is Tier 3 for that read. A Tier-1 declaration must name a field whose
*value* is present in the payload, never one whose value is derivable only after
substitution.

### Authoring rule

A new concern declaring `severity: blocking` states which tier it is in and what
structured input or state carries the decision. "A regex over prose" is not an
answer to that question.

## Reduction across multiple concerns

When a `(platform, event)` tuple maps to ≥ 2 concerns, the dispatcher
runs them **sequentially** in manifest order and reduces:

- Any `block` → final decision is `block` (most-restrictive merge).
- Else any `warn` → final decision is `warn`.
- Else `allow`.

`additional_context` strings are concatenated with `\n\n` separators,
in manifest order. Concerns are never run in parallel — concurrency
guarantees rely on serial state writes.

## Emission shaping — what leaves is a subset of what was produced

Reduction decides the *verdict*. A second pass decides which of the collected
messages are actually emitted, because two independently-correct advisory
concerns can both fire on one event and nothing used to arbitrate between them.
Both policies live in `src/scripts/hooks/injection_budget.ts` and run after
reduction, in this order:

1. **Nudge exclusivity.** A concern may declare `nudge_rank: <n>` in the
   manifest. At most one ranked concern's message leaves per event: the lowest
   rank wins, the rest are suppressed. A concern without the field is not
   nudge-class and this policy never touches it.
2. **Per-turn byte ceiling.** `src/config/hook-token-budget.json §
   per_turn_aggregate_bytes` registers the bytes a representative turn may
   inject. When the running total would exceed it, advisory messages are dropped
   lowest-severity-first (`allow` before `warn`, then largest first) until it
   fits. The events named in that row's `excluded_slots` — `session_start` above
   all — are not shaped by volume at all.

**Neither policy can drop a `severity: blocking` or `fail_closed` concern.** That
exemption is by construction, not by configuration: a shaping layer able to
silence a safety warning would be worse than the stacking it was added to fix.

**Dropping only happens when it can help.** The irreducible floor of a turn is
the spend already carried in plus this dispatch's exempt concerns. When that
floor is already over the ceiling, no sequence of drops gets under it, so nothing
is dropped and the dispatcher reports the overflow on stderr naming which
component is responsible — `exempt-floor` (a question about the budget row) or
`carried-spend` (a question about what this turn already emitted).

**The candidate set is what would actually be emitted**, not every message
collected: only messages at the deciding severity reach the host, so shaping the
full set would make the ceiling govern bytes the dispatcher never writes.

**Three preconditions gate the volume policy**, because without them a per-turn
ceiling silently becomes something else: the platform's emission must carry
reasons at all (an unverified platform emits nothing, so there is nothing to
shape), a real `session_id` must have arrived (the synthetic fallback is unique
per invocation, so the counter could never be read back), and the platform must
bind the turn-start event (otherwise the counter only grows and every droppable
advisory is suppressed for the rest of the session). Any one missing → the volume
policy is off, which is the fail-open direction.

Every suppression is recorded as one `dispatch-issues.jsonl` line, so a reader
who expected a hook effect and did not see it can find out why. The two codes
are `nudge_interference_drop` and `injection_budget_drop`; unlike the four
concern-failure codes, they mean the concern ran correctly and the dispatcher
chose not to emit it. They are exported as `POLICY_OUTCOME_ISSUES` and
`hooks:doctor` filters them out of its "hooks tried to fire but couldn't" view —
that view's call to action is a reinstall, which fixes nothing here, and routine
policy traffic would otherwise push a real `script_not_found` out of its
last-20 window.

The running total lives in `agents/runtime/state/injection-turn.json` — one
session id and one integer, with no field capable of holding a prompt or an
emitted line — and is reset on `user_prompt_submit`, the event that starts a
turn. It is not written under replay, per § Replay mode. An unreadable or
missing counter reads as zero: an accounting failure must never be the reason an
advisory disappears.

## Feedback channel — `agents/runtime/state/.dispatcher/<session_id>/`

Exit-code reduction collapses the severity ladder to a single
platform-native code, which can hide a `warn` behind a `block` or
mask non-actioned reasons entirely. To preserve per-concern detail
without re-routing control flow, the dispatcher writes a feedback
directory per invocation:

```
agents/runtime/state/.dispatcher/<session_id>/
  <concern>.json     — one file per concern that ran
  summary.json       — capped LIST of per-invocation rollups (schema 2)
```

Each `<concern>.json` carries:

```json
{
  "concern": "chat-history",
  "exit_code": 0,
  "raw_exit_code": 0,
  "severity": "allow",
  "decision": "allow",
  "reason": "appended turn 12",
  "duration_ms": 47,
  "started_at": "2026-05-04T12:34:56Z",
  "completed_at": "2026-05-04T12:34:56Z",
  "fail_closed": false
}
```

`summary.json` is **schema 2**: `{ schema_version: 2, session_id,
invocations: [...] }`, where each entry carries a per-dispatch
`invocation` discriminator plus the platform / event tuple, the reduced
`final_exit_code` + `final_severity`, and a trimmed list of all concern
entries. Newest last; the oldest is dropped past
`SUMMARY_INVOCATION_CAP` (20). `session_id` falls back to
`dispatch-<unix_ts>-<pid>` when the envelope omits one. Path
traversal in `session_id` is collapsed (`/`, `\`, `..` → `_`).

Schema 1 was a single rollup object at this path, and it lost one
whenever two dispatches overlapped in a session — parallel tool calls
on one host, or two platforms installed into one workspace. The publish
was already atomic; the PATH was singular, so the later rename discarded
the earlier rollup. Changed by P3 of `b-stop-async-split-prerequisites`
(council 2026-08-20, option (a)), together with the lock on
`rule-trips.json` and on `dispatch-issues.jsonl`.

**The per-concern `<concern>.json` files still carry the schema-1
shape and the schema-1 defect**, and that is scope rather than an
oversight: `hooks_doctor._latest_feedback` resolves them by that exact
path and picks the newest mtime, so a name change there is a
consumer-visible change this pass did not take. Two overlapping
dispatches in one session still overwrite each other's per-concern
entry.

Feedback writes are non-fatal — IO errors log to stderr but never
change the dispatcher's exit code. The directory is gitignored and
consumed by `task hooks-status` (Phase 7.11). Added in Round 2
(2026-05-04) per Q1 of `tmp/council_round2/q1_feedback_channel.md`.

## Manifest schema — `scripts/hook_manifest.yaml`

```yaml
schema_version: 1
concerns:
  chat-history:
    script: scripts/hooks/concerns/chat_history.py
    fail_closed: false
roadmap-progress:
    script: scripts/hooks/concerns/roadmap_progress.py
    fail_closed: false

platforms:
  augment:
    session_start: [chat-history]
    stop:          [chat-history, roadmap-progress]
    post_tool_use: [chat-history]
  claude:
    session_start: [chat-history]
    user_prompt_submit: [chat-history]
    stop:          [chat-history, roadmap-progress]
  copilot:
    # No dispatcher — see "Copilot fallback" below.
```

Validated by `scripts/lint_hook_manifest.py` (Phase 7.10): every
concern script must exist on disk, every platform key must be a known
platform, every event key must be in the agent-config event vocabulary.

### Which hosts carry `pre_tool_use` — bound-and-denying, bound-only, capability-limited, unbound, absent

Five `severity: blocking` concerns sit on `pre_tool_use` — `block-no-verify`,
`block-unauthorized-git`, `block-kernel-rule-writes`, `block-config-weakening`
and `evidence-independence` (its blocking branch) — so "which hosts is this
actually enforced on" is asked of this manifest repeatedly. It has **four**
answers — **five since 2026-08-24** — and every collapse of them has produced a
false claim in shipped prose: collapsing the bottom two asserts a host limitation
nobody established, collapsing the top two asserts an enforcement nobody
measured.

| State | Hosts | What the tree records |
|---|---|---|
| **Bound, and can deny** | `claude` | a `pre_tool_use:` key in the `platforms:` row, **and** membership of `VERIFIED_PLATFORMS` in `src/scripts/hooks/host_semantics.ts` — the one host whose native block contract is documented and verified, so `EXIT_BLOCK` is the code that host honours |
| **Bound, cannot deny** | `augment`, `cowork` | a `pre_tool_use:` key, but outside `VERIFIED_PLATFORMS`, so the dispatcher falls through to the legacy pass-through whose own header documents `EXIT_BLOCK = 1` as *non-blocking*. Both trampolines (`augment-dispatcher.sh`, `cowork-dispatcher.sh`) additionally discard dispatcher output and `exit 0` unconditionally — "must never block the agent loop", in their own headers |
| **Aliased but unbound** | `cursor`, `cline`, `gemini` | a native pre-tool event in `native_event_aliases` — `preToolUse`, `PreToolUse`, `BeforeTool` respectively — mapped onto `pre_tool_use`, with **no** `pre_tool_use:` key in the platform row |
| **Bound-but-capability-limited** | `opencode` (upstream only — this package binds nothing) | the host honours a blocking result, but **invocation coverage or the availability of the canonical policy inputs is not guaranteed**. See below |
| **No pre-tool surface** | `windsurf`, `copilot` | no pre-tool alias row at all; `copilot` is additionally `fallback_only` |

The two middle rows are the ones that get lost. Row 2: a concern bound on
`augment` or `cowork` **runs and is then ignored** — the guard is real, the
denial is not, so "deterministically blocked on augment, claude, cowork" is an
over-claim of exactly two thirds. Row 3: on `cursor`, `cline` and `gemini` a
guard is **unbound, not unbindable** — the host sends a pre-tool event and the
translation table already accepts it; this package has simply never written the
binding.

#### The fifth state — `bound-but-capability-limited`

```
A HOOK IN THIS STATE IS NOT AN ENFORCEMENT CARRIER FOR A CONCERN UNTIL RUNTIME
EVIDENCE PROVES ALL THREE: THAT IT FIRES FOR THE GUARDED OPERATION, THAT IT
PROVIDES LOSSLESSLY NORMALIZABLE DECISION INPUTS, AND THAT IT HONOURS THE
CANONICAL SCRIPT'S DENIAL.
```

Added because opencode fits none of the four above and forcing it into one would
be a false claim in either direction. Established 2026-08-24 by reading
`@opencode-ai/plugin@1.18.21` and `@opencode-ai/sdk@1.18.21` — evidence and the
type signatures in
[`opencode-plugin-api-verification`](../../agents/evidence/analysis/opencode-plugin-api-verification.md).

**opencode — `permission.ask`: bound-but-capability-limited.** It honours
`{ status: "deny" }`, but **only when the host raises a permission request** —
`tool.execute.before` is mutate-only (`{ args }`, no refusal), so a concern gets
either every-call coverage or the ability to refuse, never both. And its declared
payload does not guarantee the tool name, arguments, path, command string or diff
the deny-dependent concerns decide on:

```ts
type Permission = { id, type, pattern?, sessionID, messageID, callID?,
                    title, metadata: Record<string, unknown>, time }
```

`shell.env` and `experimental.chat.system.transform` are **separate mutation
carriers** and do not establish `pre_tool_use` enforcement capability.

**The classification is per concern, never per host** — both council seats
insisted on this independently, and it is the part that keeps the state from
becoming a blanket claim:

| Concern | Decision input it needs | Hook | Input available? | Status |
|---|---|---|---|---|
| `hardenedSpawnEnv` | env mutations only | `shell.env` | ✅ dedicated hook | **writable** — mutate-only, exactly its shape |
| kernel projection | system-prompt mutations only | `experimental.chat.system.transform` | ✅ dedicated hook | **writable** — mutate-only |
| `block-kernel-rule-writes` | the written path | `permission.ask` | ⚠️ `pattern` / untyped `metadata` | **probe-gated** |
| `block-config-weakening` | path **and** diff | `permission.ask` | ⚠️ diff certainly absent | **probe-gated** |
| `block-no-verify` | the command string | `permission.ask` | ⚠️ not a typed field | **probe-gated** |
| `git-authorization` | the git operation | `permission.ask` | ⚠️ not a typed field | **probe-gated** |

**Translator or new authority — conditional, and the condition is behavioural.**
A plugin denial is a **new authority surface** if the plugin itself interprets
`pattern` or `metadata` and derives a verdict the canonical script did not
produce. It stays a **translator** only if it losslessly normalizes host input,
invokes the existing canonical script, and returns that script's verdict
unchanged. A type declaration cannot settle which; only the plugin's own
implementation can, so no classification is asserted here in advance.

**Scope, stated because the pin was substituted.** The blocker asked for git
`6386e67`; the published packages at `1.18.21` were read instead. Every statement
here is scoped to `1.18.21`, and **equivalence to that sha was not demonstrated**.
If it is shown to differ, this whole subsection is re-derived rather than patched.

**What is NOT established, in either direction:** whether an unbound host's
pre-tool event can *deny* a call. Nothing here records it, and `severity:
blocking` is a property of the concern, never of the host. So "bind it and the
guard enforces" is as unbacked as "there is nowhere to bind". Row 2 is the
standing evidence for that: those two hosts are bound and still do not deny.

### Transparent input rewrite — a fifth capability, and the tree's claim about it was wrong

Denial is not the only thing a pre-tool event can do. A host may also offer a
**transparent input rewrite**: the hook returns a modified tool input and the call
proceeds with it, unblocked. Three sites in this tree asserted that the contract has no
such field. Re-probed 2026-08-23 against **Claude Code 2.1.241**, that assertion is
**false for that build**.

| Host | Rewrite capability | What the probe recorded |
|---|---|---|
| `claude` | **offered** (2.1.241) | binary strings document `` `updatedInput` - Modified tool input (PreToolUse only) ``, the shape `{behavior: 'allow', updatedInput?: object}`, **schema validation** on the value, and a fallback when it is absent or empty |
| every other host | **unprobed** | no observation exists; absence of a claim, not a claim of absence |

**This dispatcher does not emit it, and that is the load-bearing distinction.**
`src/scripts/hooks/host_semantics.ts:107-117` builds exactly one envelope shape —
`hookSpecificOutput: { hookEventName, additionalContext }` — and nothing in
`src/scripts/hooks/` constructs an `updatedInput` or a `permissionDecision`. So:

- *"our dispatcher cannot rewrite tool input"* — **true**, and fixable by us.
- *"the host contract has no transparent rewrite"* — **false at 2.1.241**, and it was
  asserted with no date, which is why nobody could tell.

The same collapse this section warns about twice already: a fact about our plumbing was
written as a fact about the host. **What is still not established** is whether a
per-concern rewrite can compose — the dispatcher reduces many concerns per event to one
exit code, and what happens when two want to rewrite the same input is undecided. That
gap, not a missing host field, is why `rtk_wrap_hook` still only warns (AI council
2026-08-23, 2/2 convergent).

Evidence: `agents/evidence/analysis/host-input-rewrite-probe-2026-08-23.md`. Pinned to a
build and a date deliberately — an unpinned capability claim rots exactly the way the one
it replaces did.

**Slot presence is not slot firing, and `cursor` is the recorded case.**
`src/scripts/_lib/session_register.ts` notes that cursor's per-turn slots are
IDE-only — the CLI fires shell-execution hooks alone — and that a slot-presence
instrument "has no IDE/CLI dimension, so it reports cursor covered". The same
comment records `cowork` as structurally wired with lifecycle events that do not
fire. Read row 3 as "a binding could be written", never as "a binding would
fire".

`check_enforcement_coverage.ts` computes its `gap_platforms` from the **bound**
set and skips every `fallback_only` platform before it starts, so it reports
four gap hosts — `cursor`, `cline`, `windsurf`, `gemini` — and never `copilot`,
which is excluded by declaration. A rule quoting the join is therefore right
about coverage, silent about cause, and must not name copilot among the
platforms the join reports. `agent-config hooks:status` answers the same
question for the host the session is actually on.

### Optional per-concern `tools:` filter

A concern may declare which tools it applies to. The **dispatcher** skips it
in-process for any other tool — this is not projected into the host config as a
`matcher`:

```yaml
concerns:
  code-graph-nudge:
    script: src/scripts/hooks/code_graph_nudge_hook.ts
    fail_closed: false
    severity: advisory
    tools: [Grep, Glob, Read]
```

Semantics (`_concern_matches_tool` in `hooks/dispatch_hook.ts`):

| Declaration | Effect |
|---|---|
| key absent | runs on every event (the default; unchanged) |
| `["*"]` | the same, stated explicitly |
| `[A, B]` | runs only when the payload's `tool_name` is exactly `A` or `B` |
| non-tool event (no `tool_name`) | **never filtered** — a key describing tool events cannot skip a lifecycle concern |
| malformed / empty list | **runs anyway**, and `lint_hook_manifest` fails the build |

Two constraints worth stating, because both are load-bearing:

- **Not a host `matcher`.** `build_claude_hook_matrix` collapses each event to a
  single command and `claude_hook_matrix_parity.test.ts` asserts one group with
  one command per event; per-concern matchers would break that parity for a
  filter the dispatcher can apply itself. The in-process skip also covers all
  eight platforms, where a matcher would help only the two that support one.
- **Not a latency claim.** The measured hook cost that was repaired was the
  invocation path, not the concern bodies; nothing in the tree measures the
  concern share of the current p95. `bench_hook_latency` reads the manifest, so
  the claim is benchable — it is not asserted until it is benched.

The filter is deliberately absent from the blocking PreToolUse guards, whose
tool sets span host naming variants (`Bash` / `BashTool` / `launch-process` / …);
a list that misses one variant silently disables a guard on that host.

### The host's own `matcher` / `if`: a prefilter, never an enforcement

Claude Code offers two host-side filters that look like the `tools:` key above
and are not interchangeable with it. Verified against
`code.claude.com/docs/en/hooks`, fetched **2026-08-18**; re-read on a host bump,
because this is external documentation (road-to-per-turn-hook-economy risk 7).

| Field | Semantics as documented |
|---|---|
| `matcher` (group level) | a group runs when its matcher matches. **"All matching hooks run in parallel"** — several matching groups on one event means several processes, not one |
| `if` (handler level) | permission-rule syntax (`Bash(git *)`, `Edit(*.ts)`). **Only evaluated on tool events** — `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionRequest`, `PermissionDenied`. *"On other events, a hook with `if` set never runs."* Fails **open** — the hook runs regardless of the pattern — when the Bash command cannot be parsed |

Three invariants follow, and each one is a way this has already almost gone
wrong:

- **`if` is a prefilter, never the enforcement.** Its fail-open direction is
  correct for a fail-closed guard — unparseable means the hook runs and the hook
  decides — and useless as a replacement for the guard's own check. A guard's
  detection logic is never removed because an `if` was added in front of it.
- **`if` on a non-tool event disables the handler outright.** Not "runs
  unfiltered" — never runs. A `stop` or `session_start` handler that acquires an
  `if` is silently dead, which no test in this tree would notice.
- **Group splitting costs processes, it does not save them.** Because every
  matching group fires, a split only avoids a dispatch for a payload that matches
  **no** group. On `pre_tool_use` that is unreachable while any concern is
  unscoped — **nine** of the twelve claude concerns are, deliberately, per the
  paragraph above; only `code-graph-nudge`, `reread-guard` and
  `spawn-guard-shadow` declare `tools:` — so a group with no `matcher` must exist
  and fires on every tool call. `road-to-per-turn-hook-economy` step 5.1 was cancelled on exactly
  this reading.

### Optional `roles:` axis — session-role chain thinning

A top-level `roles:` block lets a marked session run a shorter chain
(road-to-token-economy-dispatch Phase 2):

```yaml
roles:
  worker:
    drop: [delegation-nudge, end-review-nudge, council-availability, team-review-gate, self-repair]
```

Semantics (`_role_drop_set` / `_resolve_concerns` in `hooks/dispatch_hook.ts`;
role read once per dispatch via `_lib/session_role.ts::resolveSessionRole`
from `AGENT_CONFIG_SESSION_ROLE`):

| Case | Effect |
|---|---|
| var unset / empty / unknown value | role `orchestrator` — chains byte-identical to a manifest without the block (fail-open) |
| known role with manifest entry | the role's `drop` names are filtered out of every slot **except `pre_tool_use`** |
| `pre_tool_use` | **never thinned, for any role** — the resolver refuses structurally, and `lint_hook_manifest` fails the build on a drop entry bound to that slot |
| known role without a manifest entry (e.g. `reviewer` today) | full chain |

The variable is set ONLY by suite-owned wrappers that launch a separate CLI
session (today: the council CLI transport in `ai_council/clients.ts`). An
in-process Agent-tool subagent shares the host process environment and cannot
be marked per-spawn — probed live 2026-08-10: `CLAUDE_CODE_CHILD_SESSION=1`
appears in BOTH parent and subagent tool environments (it marks the tool child
process, not the session), and a subagent leg creates no own feedback-dir
session — so no observed host discriminator exists, matching the judgment
ladder's caller-supplied `insideSubagentSession` stance. `--dry-run` prints the
resolved role alongside the concern plan.

## Stop-event capability tiers — where enforcement is REAL

> `road-to-skill-ecosystem-runtime-enforcement` Phase 5 Step 5.

A bounded loop driven from the stop event is only as strong as the host's answer
to one question: **can this host be told to keep going?** Three tiers, and the
distinction is not a nuance — a mechanism described as "enforced" on tier 2 or 3
is described wrongly.

| tier | what the host does with a stop-slot block | hosts |
|---|---|---|
| **1 — blocks** | the turn does not end; the concern's stderr is fed back and the agent continues in the SAME turn | `claude` |
| **2 — re-injects** | the turn ends; the text reaches the next turn as context, so continuation depends on the model reading it | hosts that bind a stop slot and discard the dispatcher's verdict — `augment`, `cowork` today |
| **3 — notifies only** | the event fires and nothing the concern returns changes what happens next | every host with a stop-adjacent event and no verdict channel |

**Enforcement is real on tier 1 and nowhere else.** On tier 2 the loop is a
suggestion the model may decline, and on tier 3 it is a log line. That is why
`run-continuation` carries `severity: blocking` and why the honest claim about it
is *"the loop is enforced on claude and advisory elsewhere"* — not *"the loop is
enforced"*.

Two consequences worth stating rather than leaving to be re-derived:

- **A budget is still worth keeping on tiers 2 and 3.** The iteration counter,
  the wall-clock cap and the stall window all still bound what the concern ASKS
  for, so a degraded tier produces fewer, better-targeted re-engagements rather
  than an unbounded stream of ignored ones.
- **`agent-config hooks:status` is the answer for the host you are on**, not this
  table. The table records what the manifest binds; the status command reads what
  is actually installed, and the two can differ on any given machine.

## Concurrency — atomic state writes

Concerns that write under `agents/runtime/state/` MUST use the pattern:

1. Acquire `fcntl.flock(LOCK_EX)` on `agents/runtime/state/.dispatcher.lock`.
2. Write to a sibling `<dest>.tmp.<pid>` file in the same directory.
3. `os.replace(tmp, dest)` — POSIX-atomic on the same filesystem.
4. Release the lock.

The single `.dispatcher.lock` is intentional: serialising state
writes across concerns is cheaper than per-file locks, and concerns
already run sequentially within one dispatcher invocation. The lock
file is gitignored.

### One exception — per-session read-modify-write

The rationale above is about CONCERNS inside one dispatcher invocation,
and for them it still holds. It does not reach concurrent SESSIONS, and
the per-session state split gave the directory a second population: it
used to hold one state file per concern, so a directory lock was
effectively a file lock; it now holds N per-session files, and a
directory lock there re-serialises the sessions the split exists to
decouple.

So `state_io.update_json_under_lock` — the read-modify-write helper, used
only for per-session concern state — keys its lock on the STATE FILE
(`<file>.lock`, with the `O_EXCL` companion `<file>.lock.held`) rather
than on the directory. `atomic_write_json` / `atomic_write_text`, the
path steps 1–4 above describe and the one concerns share, are unchanged.

Two writers to the same session file still take the same lock, so mutual
exclusion is unchanged where it is needed; two sessions writing different
files no longer block each other.

**Measured before choosing**, because the previous basis for the
directory lock at this granularity was "probably unmeasurable at
millisecond writes", which was a guess. 4 and 8 concurrent processes, 60
read-modify-writes each, every process writing its OWN per-session file
(macOS/APFS): slowest worker 68 ms under the shared directory lock vs
27 ms with no shared lock at 4 processes, and 138–267 ms vs 83–95 ms at
8. The guess was wrong in direction — it is measurable, and it grows with
the number of concurrent sessions — and roughly right in magnitude
(sub-millisecond to a few milliseconds per write). The decisive reading
is not the absolute number but the comparison: writes to DISTINCT files
under the shared lock came out at or above writes to the SAME file, i.e.
the directory lock was paying the full cost of mutual exclusion for
writes that require none.

Neither `<file>.lock` nor `<file>.lock.held` ends in `.json`, so
`prune_stale_session_states` skips both by its existing filter; it
removes them alongside the state file it prunes, so per-file locking does
not trade a serialised write path for an unbounded sentinel count.

`state_io.update_text_under_lock` — the text sibling, used for the
append-only `dispatch-issues.jsonl` — keys its lock the same way, for the
same measured reason: an append needs exclusion against writers of THAT
file and nothing else, and the directory lock would have serialised it
against every unrelated `atomic_write_text` in the state dir. Its
sentinel pair is bounded by construction rather than by the pruner (one
fixed filename, so exactly one `.lock` / `.lock.held`), which is why it
sits outside the per-session sweep described above.

Phase 7.4 ships a regression test that spawns two concurrent
dispatcher invocations against the same event and asserts no torn
writes (file ends with valid JSON, last-writer-wins).

## Performance doctrine — four rules, and why each is a rule

Added 2026-08-25 (`road-to-skill-ecosystem-runtime-enforcement` Phase 1 Step 5).
A hook runs on **every** matching event, and the overwhelming majority of those
events are legitimate. So the cost that matters is not the cost of acting — it is
the cost of **deciding not to act**, paid constantly.

1. **Prefer shell over an interpreted runtime, because startup dominates.** A
   node or python process start is paid on every invocation to say nothing in
   almost all of them. This is why the container-only shim
   (`src/scripts/hooks/shims/php`) is POSIX `sh` rather than a `.ts` sharing the
   dispatcher's helpers: the duplication is the cheaper mistake.
2. **Fast-pass non-matching invocations.** Decide *not mine* before doing any
   other work — before reading a file, before resolving a path. The shim's
   basename `case` is the shape: one comparison, then either a refusal or an
   exit.
3. **Prefer a regex over a parse, and accept rare false positives.** A parser is
   correct and slow; a regex is fast and occasionally wrong. On a hot path the
   regex wins, **provided the false positives are enumerated and asserted** —
   which is what a false-positive matrix is for
   (`tests/scripts/hook_shims.test.ts` § matrix). An unenumerated false positive
   is not an accepted trade, it is an unmeasured defect.
4. **Prefer a PATH prepend over a per-tool-call spawn where both are available.**
   A prepend costs nothing per call, works for any process the session starts —
   including ones no hook surface observes — and is reversible by closing the
   shell. A per-call hook is observable only where a slot exists and is bound.

**The trade these rules do NOT make:** none of them permits a hook to skip work
it should do. They govern how cheaply a hook reaches *no*, never whether it may
reach a wrong *yes*.

## Marker-hook convention — a hook that triggers work never does the work

Added 2026-08-25 (Phase 1 Step 6).

```
A HOOK THAT TRIGGERS WORK RECORDS A MARKER AND EXITS ZERO.
IT NEVER PERFORMS THE WORK, AND IT NEVER SPENDS.
```

The hook's job is to make a condition **visible** at the moment it is cheapest to
observe. Doing the work inside the hook puts an unbounded, unattributed cost on
an event the user did not ask to pay for — and on a per-tool-call slot, pays it
repeatedly.

**Why exiting zero is part of the convention, and not an afterthought.** The
recorded trap on this host is that an **advisory exit code 2 reads as a hard
block**: a hook that merely wanted to say "something is worth doing" can stop the
turn instead. So a marker hook exits 0 and writes its marker; the reader decides.
A hook that genuinely refuses — the container-only shim is one — is not a marker
hook and does exit non-zero, deliberately and with the refusal as its whole
purpose.

**Distinguishing the two, since the boundary is where mistakes happen:** if the
hook's output is *information for a later decision*, it is a marker hook and
exits 0. If the hook's output is *the decision*, it may exit non-zero, and it
must then be the kind of decision a human would recognise as a refusal rather
than a suggestion.

## Hook-resilience shim — every registered command degrades silently

Every hook command the installer registers (Claude managed block + plugin
`hooks/hooks.json`, Cursor, Windsurf, Gemini, the Augment trampoline) follows
one shape (road-to-opt-subagent-harvest P1.4):

1. **Resolve the dispatcher** — project-local binary first, PATH fallback
   where the platform supports it (Claude: `$CLAUDE_PROJECT_DIR/agent-config`
   → `agent-config`).
2. **Missing dispatcher → silent `exit 0`.** A hook must never error-spam or
   block the agent loop on a repo where the suite is not (yet) installed.
   This is the honest degrade even for `fail_closed` concerns: an absent
   dispatcher cannot evaluate anything, so there is nothing to fail closed
   ON — the deny power exists only where the suite exists.
3. **Present dispatcher → exit code PROPAGATES.** No `|| true` around the
   dispatch call itself: a `fail_closed: true` concern (e.g.
   `block-no-verify`) keeps its deny. Fail-open of crashed concerns is
   handled INSIDE `dispatch_hook.ts` per the manifest's `fail_closed` flag,
   never by the outer shim.

The Augment trampoline (`src/scripts/hooks/augment-dispatcher.sh`) is the
reference implementation of the same contract in shell form (`set -u`,
silent bails, unconditional `exit 0` — Augment concerns are all
observe-only, so blanket exit 0 is correct there).

## Copilot fallback pattern

Copilot has no hook surface. Concerns whose source rule cites
`agents/runtime/state/<concern>.json` MUST gain a "Copilot fallback" section
that:

- Names the state file the concern would have written.
- Names a manual command or task that reproduces the side effect
  (e.g. `task chat-history:append`).
- Includes no Iron-Law-changing prose.

The dispatcher silently no-ops when called with `--platform copilot`;
the fallback is consumed by reading the rule, not by hook invocation.

## Fixture corpus — `tests/fixtures/hooks/`

Replay-safe, platform-native payloads. One JSON file per event in the
agent-config event vocabulary. Consumed by `./agent-config hooks:replay`
and by the dispatcher replay tests
(`tests/hooks/test_hooks_replay.py` — Phase 2.4c).

```
tests/fixtures/hooks/
  session_start.json  · session_end.json  · user_prompt_submit.json
  pre_tool_use.json   · post_tool_use.json · stop.json
  pre_compact.json    · agent_error.json
  subagent_start.json · subagent_stop.json
  README.md           — corpus contract + platform-shape table
```

Each fixture is a **stdin payload** — the dispatcher wraps it via
`_build_envelope` before handing it to a concern. Required keys:

- Valid JSON object at the top level.
- `session_id` — string, non-empty (drives feedback dir naming).
- Event-specific fields realistic enough that the bound concerns
  (`chat-history`, `roadmap-progress`, `context-hygiene`,
  `verify-before-complete`, `minimal-safe-diff`) run without raising
  — primarily `tool_name` (for `*_tool_use`), `prompt` (for
  `user_prompt_submit`), `agent_id` + `agent_type` (for `subagent_*`,
  which `subagent-ledger` correlates on) and `last_assistant_message`
  (for `subagent_stop`, which it classifies without recording).
- No real user content. Committed alongside source; the redaction
  workflow in [`hook-payload-capture`](../hook-payload-capture.md)
  applies to **captured** payloads, not committed fixtures.

The corpus is platform-shape-representative, not platform-exhaustive
— multi-platform shape coverage lives in
`tests/hooks/test_event_shape_contract.py`. The replay test asserts
1:1 mapping between `EVENT_VOCABULARY` and this directory.

## Replay mode — `AGENT_CONFIG_REPLAY=1`

Concerns that write under `agents/runtime/state/` MUST honor the
`AGENT_CONFIG_REPLAY` env var: when set to `1`, skip all state
mutations and run as read-only. The dispatcher passes the env var
through to subprocess concerns unchanged. Concerns that do not honor
the flag are listed by `./agent-config hooks:doctor` as not
replay-safe; replay tests assert no `agents/runtime/state/` mutation
post-invocation.

## Regenerator location — canonical path (Phase 3 of `road-to-hooks-actually-fire-in-consumers`)

The `roadmap-progress` concern's resolver searches three locations
for `update_roadmap_progress.py`. The **canonical consumer-side
location is**:

```
<consumer_root>/.augment/scripts/update_roadmap_progress.py
```

Rationale:

- The auto-generated `agents/roadmaps-progress.md` already cites
  `.augment/scripts/update_roadmap_progress.py` in its header.
- `install.py`'s existing tool projection lays down `.augment/`
  unconditionally; piggy-backing on that directory means consumers
  do not need a separate "scripts" install step.
- The other two paths (`dist/agent-src/scripts/`,
  `.agent-src.uncondensed/scripts/`) only populate in
  source-checkouts of the package itself.

Source-of-truth in the package: `packages/core/.agent-src.uncondensed/scripts/update_roadmap_progress.py`.
Helper that copies source → consumer canonical:
`scripts/_lib/install_regenerator.py`. Consumed by `install.py` and
`hooks:install --regen`.

The resolver in `scripts/roadmap_progress_hook.py::_resolve_regenerator`
visits the canonical path FIRST; the other two are fallback for
maintainer / dev workflows. On `return None` the resolver writes a
`dispatch-issues.jsonl` entry (Phase 1 contract) with
`prerequisite_missing` so the user can discover the gap via
`./agent-config hooks:doctor`.

## Stability

Beta. Breaking changes between v1 and v2 are allowed in a minor
release if the change appears in `CHANGELOG.md` under a `### Breaking`
heading. Concerns MUST gate on `schema_version` and refuse unknown
majors.

## See also

- [`docs/hook-payload-capture.md`](../hook-payload-capture.md) —
  operational how-to for capturing redacted live payloads to upgrade
  a platform's chat-history extractor from `docs-verified` to
  `payload-verified`.
- [`tests/fixtures/hooks/README.md`](../../tests/fixtures/hooks/README.md)
  — fixture corpus contract.
