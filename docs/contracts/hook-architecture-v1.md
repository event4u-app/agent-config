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

## Admitting a concern — the five questions

```
A CONCERN ADDED FROM 2026-08-30 ON CARRIES A RECORDED ANSWER, OR THE GATE FAILS.
```

`agents/decisions/concern-admissions.jsonl` is the ledger; `check_concern_admissions`
is the gate. The 55 concerns present when it landed are **grandfathered by
construction** — the scope is a set difference over concern ids between the base
ref and HEAD, so a pre-existing concern can neither demand a row nor be
forgotten off one.

The questions are deliberately **not** the skill ledger's questions. What makes
a concern risky is that it binds to a slot, on hosts that may or may not honour
a deny, inside a per-event budget — and none of that has a skill analogue.

| Field | The question |
|---|---|
| `slot` | Which lifecycle slot does it bind? |
| `binding_hosts` | Which hosts actually **bind** it — not which declare the slot. The two differ, and treating them as one is the usual over-claim this contract already documents. |
| `behaviour_where_deny_ignored` | What does it do where the host ignores a deny? A concern whose only answer is "it blocks" is describing one host. |
| `why_not_extend` | Why can no existing concern carry this? |
| `per_event_budget_impact` | What does it cost against the per-`(platform, event)` cap? |

`decision: rejected` is a **first-class row** — a recorded refusal is the point,
not an absence — and a rejected row naming a concern that exists is a hard
failure, because it means the refusal was overridden without the row being
updated.

The **total** count is ratcheted separately, as `concern_count` in
`check_estate_count`. Both exist because the per-event cap is blind to total
growth by construction: eight new concerns spread across eight events violate it
zero times.

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
| `≥ 3` | error | dispatcher logs whatever diagnostic the failure produced — a traceback for an in-process throw, the signal name for a killed spawn, the exit code for a child that simply exited in the band — plus an `execution_failed` issue row, then resolves by the concern's declared `severity`: `blocking` → `EXIT_BLOCK`, anything else → exits 0 (fail-open) |
| `continue: false` (field) | **not adopted as of 2026-09-12** | this suite does not emit this primitive and defines no precedence for it. Any proposal to emit it must reopen this decision and specify precedence, emitter ownership, supported-host behavior, and the use case that existing verdicts cannot express |

**`severity` decides the error row in BOTH directions, and `fail_closed:` no
longer decides it at all.** It was already the ceiling — an advisory concern
emitting `1` is downgraded to warn by `dispatch_hook._is_advisory` — and it is
now also the floor: a `severity: blocking` concern that crashed, timed out, or
otherwise could not decide refuses, whether or not it carries `fail_closed:
true`. The flag used to be the whole test, which left six of nine blocking
guards permitting the call precisely when they broke. All three concerns that
carry the flag are `severity: blocking`, so no verdict changed because the
branch stopped reading it.

**`sla_ms x 3` bounds nothing at runtime, and that is a measurement rather than
an omission.** `concern_sla_ms` in `src/config/hook-latency-budget.json` is
derived from the dispatcher's own per-concern `duration_ms`, which brackets the
concern's work and nothing else — the registered rows are 0.564 to 1.587 ms. A
`spawnSync` timeout also has to cover fork, interpreter start and module load,
and the bench's control row measures that term alone at p95 17 ms on the 1 vCPU
reference class and 26 ms on the GitHub runner. Wiring the bound was probed
against the real dispatcher on this branch: under `AGENT_CONFIG_HOOKS_ISOLATED=1`
all six blocking `pre_tool_use` concerns returned `ETIMEDOUT`, left no verdict,
and were resolved by the row above into a deny — exit 2 on an ordinary `Read`.
So the spawn path keeps its historical 30 s, the in-process route is unbounded
as it always was (a kill-timeout cannot preempt synchronous code there), and
`sla_ms x 3` stays what the warn-only window made it: a number the latency bench
prints beside each measured p95, gating nothing. Re-wiring it needs a SPAWN-path
measurement this tree does not have.

**The error row's discriminator is whether a VERDICT EXISTS**, not how slow the
concern was and not which route it took. A crash, a killed spawn and a child
terminated by a signal leave none, so they resolve by severity. A slow success
leaves one, so it is honoured. The third of those was a live fail-open until
2026-10-03: `proc.status ?? 0` coalesced a signalled child's `null` status into
exit 0, so an OOM kill or a supervisor SIGTERM read as ALLOW at exactly the
moment this row exists to refuse.

**`fail_closed:` is narrower now, not dead, and the difference matters to anyone
editing the manifest.** It no longer decides the error row. It still decides the
stdin-read-failure deny (`stdin_failure_policy._is_fail_closed_blocking`, the
2026-08-20 council's option (c)): a payload the dispatcher could not read denies
only where the slot is block-capable AND at least one selected concern is both
`severity: blocking` and `fail_closed: true`. Three concerns carry the flag and
all three are blocking, so nothing moved when the error row stopped reading it.

**The two slots carry different blast radii, and the asymmetry is deliberate.**
On `stop` a crash refuses once and the host's marked retry releases it, so the
worst case is one refused turn end. On `pre_tool_use` there is no retry marker
and a deterministically crashing blocking concern refuses EVERY tool call for as
long as it keeps crashing — a tool guard that permits while broken is not a
guard, so refusing is the right answer, but it is an unbounded denial and is
recorded as one rather than argued away. The dispatcher prints the escape
(`AGENT_CONFIG_HOOKS_ISOLATED=1`, and the `dispatch-issues.jsonl` row naming the
cause) on stderr beside the refusal, because an escape an operator cannot find
from inside a wedged session is not an escape. What is NOT bounded on either
slot is a synchronous in-process hang: it returns no code at all, so it never
reaches this row, and no clause here releases it.

**A blocking `stop` concern spends its refusal once.** On the retry the host
marks with `stop_hook_active`, an `rc >= 3` falls back to fail-open and the turn
ends. Without that clause a deterministic crash in a stop-slot guard would
refuse every turn end with no escape — a wedged session rather than a degraded
one. A concern that *decided* to refuse is unaffected: it returns `1` and never
reaches the error row.

**The `warn` row above says what the dispatcher does, and nothing about whether
the turn ends.** Read as a complete account it invites the conclusion that an
advisory verdict is free, which is how a slot carrying twelve advisory concerns
came to be treated as inert (`agents/evidence/analysis/stop-slot-continuation-census-2026-09-11.md`).
**Measured once on Claude Code — 2026-09-07, at commit
`9a0216f4c7b1655af72d4e7c03b0fdc30a9b03b3`.** After a warn-only
`end-review-nudge` result on `stop`, agent activity continued through three
further dispatcher invocations with no intervening `user_prompt_submit`. The
following `Stop` carried `stop_hook_active: true` — **derived, not directly
captured**, from the dispatcher's concern-drop signature, which at this revision
occurs only when `payload.stop_hook_active === true`
(`src/scripts/hooks/dispatch_hook.ts:355-366`, with the
`skip_on_refusal_retry` entries at `src/scripts/hook_manifest.yaml:921,1126`).

This is n=1. It establishes behavior for the measured session, host and
revision, and for nothing else: **not** that warn-only stops always continue,
not that any other host behaves this way, and not that a future Claude Code
version will. The continuation is observed; the payload value is a deterministic
inference. Working, event-level record, the 0-of-36 negative control and the
four limits:
`agents/evidence/analysis/stop-slot-warn-continuation-2026-09-12.md`.

So an advisory verdict on those two events is **not free** in the one case that
was measured, and a concern header that argues only about its exit code has
proved that it never **refuses** — never that it does not **extend**.

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
| `block-unauthorized-git` (removed 2026-09-04, ADR-254) | a **shell command** | a PR whose title said "publish", two read-only `gh api` GETs, and — the removal — a guardrail sentence inside the owner's own authorization |
| `turn-end-gate` | the assistant's **reply prose** | honest "not done yet" status lines |

Each was fixed by narrowing its pattern. The council convened on the design
(anthropic + openai, 2026-08-12, quorum 2/2) rejected that as the durable
answer, and the reason is not stylistic:

> a finite pattern cannot bound an infinite false-positive set — narrowing is
> sampling from an unbounded error space, not converging on a solution.

The history supports it, and its end point is the strongest evidence in the
table: `block-unauthorized-git` was narrowed three times (quoted `|`, dotted
path segments, unanchored verb) and then REMOVED outright on 2026-09-04
(ADR-254), because the fourth false positive was the owner's own authorization
revoking itself. Narrowing did not converge; it ran out. And
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

## Plumbing — one mechanism per file class

The files that decide **which** concern runs, on **which** host, under **which**
budget are the hook plumbing. They are governed, and they are governed in two
different ways, because they fail in two different ways.

```
A PLUMBING SOURCE CARRIES A RECORD. A PLUMBING BUILD OUTPUT CARRIES A DENY.
NEVER A DENY ON A FILE PEOPLE EDIT ON PURPOSE — THAT IS A WEDGE.
NEVER A RECORD ON A FILE WHOSE EVERY HAND EDIT IS A MISTAKE — THAT IS
A RECORD OF A MISTAKE.
```

**Sources** — edited legitimately, so a diff to one carries a ratification
artifact per [`ratification-artifact.md`](ratification-artifact.md), enforced in
CI by `check_kernel_edit_ratified.ts` (`PLUMBING_SOURCE_RE`):

| File | What it decides |
|---|---|
| `src/scripts/hook_manifest.yaml` | which concerns exist, their severity and `fail_closed`, and which host binds which slot |
| `src/scripts/hooks/host_lowering.yaml` | how a verdict is lowered onto each host's native exit contract |
| `src/scripts/hooks/*-dispatcher.sh` | the per-host trampolines that reach the dispatcher at all |
| `src/config/hook-token-budget.json` | the per-concern injection ceiling |
| `src/config/hook-latency-budget.json` | the per-slot latency ceiling the bench gate enforces |

The asymmetry this closes: a concern **deleted** from the manifest is a refusal
that stops happening, which is the same authority change as loosening the rule
behind it — reached one file earlier, and until 2026-09-29 it carried no record
while a typo in that rule did.

**Build outputs** — no legitimate hand edit exists, so they are refused at
tool-call time by `block_plumbing_writes.ts` (`PLUMBING_BUILD_OUTPUTS`):

| File | Written by | Why a hand edit is never legitimate |
|---|---|---|
| `dist/hooks/dispatch.js` | `npm run build:hooks` | every concern is inlined here; an edit survives until the next build, reaches every dispatch meanwhile, and is invisible in a source review |
| `hooks/hooks.json` | `condense.ts` via `task sync` | the host binding file; an edit here silently unbinds a guard |

The guard refuses edit-tool envelopes and the shell write shapes in
`_lib/shell_write_shapes.ts`. The legitimate builds pass because they reach
these files through a build tool rather than through a redirect, an in-place
`sed`, or a `tee`/`mv`/`cp` naming the path. Its declared residual — a write
built inside an interpreter's own argument is not detected — is stated in the
guard's header and pinned by its tests in both directions.

Adding a file to either list is itself a governance change and carries its own
ratification: the source list is watched by the gate that reads it, and the
guard is a `src/scripts/hooks/block_*.ts` and therefore already gated.

### The dispatcher verifies the bundle it is executing

Both controls above look at the bundle from outside it. `check_hook_bundle_content`
reads it in CI; `block_plumbing_writes` refuses an edit at tool-call time.
Neither is looking at the bundle **the running process was loaded from**, at the
moment that process is about to run a blocking guard — and a bundle that arrived
by some route neither of them watches is exactly the one worth doubting.

```
`npm run build:hooks` WRITES `dist/hooks/dispatch.sha256` BESIDE THE BUNDLE.
THE DISPATCHER HASHES THE BUNDLE ONCE PER BUILD IDENTITY AND STATS IT AFTER.
A MISMATCH REFUSES A SLOT CARRYING A BLOCKING CONCERN AND WARNS OTHERWISE.
A MISSING SIDECAR IS `unverifiable` AND ALLOWS — AN ABSENT CONTROL IS NOT
A TRIPPED ONE.
```

| Verdict | When | What the dispatch does |
|---|---|---|
| `ok` | bundle hashes to the sidecar | nothing; silent |
| `mismatch` | it does not | slot has ≥ 1 blocking concern → `EXIT_BLOCK`, `execution_failed`, reason `plumbing-integrity`; advisory-only slot → warn on stderr and continue |
| `unverifiable` | no sidecar, or it or the bundle is unreadable | allow, silent |

`unverifiable` allows for the same reason a missing dispatcher is a silent
allow even for a `fail_closed` concern (§ the missing-dispatcher clause below):
a consumer whose package predates the sidecar, or whose `dist/` came from
something other than `npm run build:hooks`, must not have its tooling wedged by
an artifact that was never there. The cost of that choice is that a bundle
published without its sidecar disables the check silently, which is why
`prepack-check.mjs` refuses to package one — the one place that knows the
bundle is being built *now* and had no excuse.

**What this is not.** It is not a signature. Anyone who can rewrite the bundle
can rewrite the sidecar beside it, and both files are `dist/`. It catches the
hand edit and the partial write — one file changed and not the other — and
claiming more would be the coverage inflation the rest of this section exists
to remove.

**Cost**, measured on this tree rather than asserted: SHA-256 over the 1.5 MB
bundle is 0.470 ms and is paid once per build identity; every dispatch after
that reads the cached stamp and stats the bundle, **0.0101 ms** for the pair
(the stat alone is 0.0010 ms — the pair is what the dispatcher pays, and an
earlier draft of this paragraph quoted the stat). `pre_tool_use` p50 measured
63 ms before and 63 ms after, so the addition is inside the run-to-run noise
of a single slot. The same measurement retired the
FNV-1a table fingerprint in `table_fingerprint.ts`: its header refused a
cryptographic hash because `node:crypto` costs 8 ms of process start, and the
bundle now carries 23 top-level imports of `node:crypto` from elsewhere in the
graph, so that cost is paid either way — SHA-256 then measured *faster* than
the interpreted FNV-1a loop (0.106 ms against 0.113 ms over the 99,792-byte
manifest).

### Settings: the key is the unit, never the file

A third file class sits beside the two above and takes a third mechanism, for a
reason the split makes visible: a project settings file is edited legitimately
many times a day AND carries a handful of keys that are policy dials. A deny on
the file would wedge ordinary work; a record on the file would be a record of
routine. So the fence is per KEY.

```
A CLASS C KEY IS REFUSED AT TOOL-CALL TIME. EVERY OTHER KEY IN THE SAME
FILE STAYS AGENT-WRITABLE. USER-GLOBAL FILES ARE NEVER IN REACH.
```

`block_config_weakening.ts` classifies `.agent-settings.yml` and a host's
`.claude/settings.json` as `class-c`, parses the document as it would stand
AFTER the edit, diffs the leaf key paths, and refuses when any changed key
resolves to C through `shared/settingsClasses.classOfPath` — the same shared
classifier `settings:set` and the GUI write route already use, rather than a
second copy of the rule. Class C is defined in
[`settings-classes.md`](settings-classes.md), which ships in `files[]` and is
therefore readable from a consumer install.

Two states fail closed, both because the alternative is a bypass with no
authorisation step in it: a class contract the guard cannot read leaves it
unable to tell a C key from an A key, and a post-edit document it cannot parse
leaves it with no key list at all. Either one refuses.

What it does not see: an edit applied through a shell redirect rather than an
edit tool. That is `block_plumbing_writes`' subject and its shapes are
`_lib/shell_write_shapes.ts`; this guard's corpus is `EDIT_TOOLS`.

### One exit-code table

`src/scripts/hooks/exit_codes.ts` is the single definition of 0 / 1 / 2 / ≥3,
with `owner` and `authorizedBy` per row — who decides a concern emits the code,
and what authorises the dispatcher to act on it. Thirty-three files previously
declared their own copies, and the numbers are not interchangeable across the
boundary: 1 and 2 mean the opposite things on Claude Code from what they mean
in this tree's internal language, which is why `host_semantics.ts` exists.
`lint_exit_codes` refuses a bare numeral in `src/scripts/hooks/*.ts`.

`EXIT_USAGE` sits beside the table and deliberately outside it: `dispatch_hook`
and `replay_hook` are also CLIs, and exit 2 on their own bad argv by POSIX
convention — a number that collides with `EXIT_WARN` by coincidence, not by
meaning, since no concern has spoken at that point.

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

Four `severity: blocking` concerns sit on `pre_tool_use` — `block-no-verify`,
`block-kernel-rule-writes`, `block-config-weakening` and
`evidence-independence` (its blocking branch) — so "which hosts is this
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
| **Neither aliased nor bound** | `windsurf`, `copilot` | no pre-tool alias row at all and nothing bound; `copilot` is additionally `fallback_only`. What the tree records is what this package binds — it has measured neither host's surface |

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

**This dispatcher does not emit `updatedInput`, and that is the load-bearing
distinction.** `src/scripts/hooks/host_semantics.ts` builds the
`hookSpecificOutput: { hookEventName, additionalContext }` envelope and no
`updatedInput`. So:

- *"our dispatcher cannot rewrite tool input"* — **true**, and fixable by us.
- *"the host contract has no transparent rewrite"* — **false at 2.1.241**, and it was
  asserted with no date, which is why nobody could tell.

The same collapse this section warns about twice already: a fact about our plumbing was
written as a fact about the host. **What is still not established** is whether a
per-concern rewrite can compose — the dispatcher reduces many concerns per event to one
exit code, and what happens when two want to rewrite the same input is undecided. That
gap, not a missing host field, is why `rtk_wrap_hook` still only warns (AI council
2026-08-23, 2/2 convergent).

**`permissionDecision` is now emitted, and its composition question is closed.**
Corrected 2026-09-06 (`road-to-authorization-that-reaches-further` 1.1): the
paragraph above used to name `permissionDecision` alongside `updatedInput` as a
field nothing in `src/scripts/hooks/` constructs. Re-probed against the running
host — **Claude Code 2.1.263**, whose own strings read `` `permissionDecision` -
"allow", "deny", or "ask" (PreToolUse only) `` — and the dispatcher now emits it
for a **category-A** call: a read, a navigation, a build, a test or a lint inside
the working tree with no consequence operation attached
(`src/scripts/hooks/category_a.ts`).

The composition policy is **one `ask` or `deny` beats every `allow`**
(`composePermissionDecision`), and the emission additionally requires the reduced
severity to already be `allow`, so an allow can never travel with a finding. This
answers the permission half of the undecided-composition gap above and **not** the
rewrite half, which stays open: two concerns rewriting one input still has no
answer, and no allow-composition result may be read as one.

An allow is not a grant. The host's own strings record
`permissionDecision=allow ignored: a confined session takes grants only from its
command line`, so a confined session ignores the field entirely, and no gate of
this package is removed by emitting it — category A names calls that nothing here
gated in the first place.

Evidence: `agents/evidence/analysis/permission-decision-probe-2026-09-06.md`.

Evidence: `agents/evidence/analysis/host-input-rewrite-probe-2026-08-23.md`. Pinned to a
build and a date deliberately — an unpinned capability claim rots exactly the way the one
it replaces did.

**Slot presence is not slot firing, and `cursor` is the recorded case.**
`src/scripts/_lib/session_register.ts` excludes cursor from the heartbeat set
because reachability there is **unestablished** — an earlier IDE-only claim was
retracted on 2026-09-06 as unverifiable in either direction — and records that a
slot-presence instrument "has no IDE/CLI dimension, so it would report cursor
covered". The same comment records `cowork` as structurally wired with lifecycle
events that do not fire. Read row 3 as "a binding could be written", never as "a
binding would fire". The envelope's `surface` field (`_lib/surface.ts`) is where
that dimension now lives; it answers `unknown` on cursor.

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
  code-graph-context:
    script: src/scripts/hooks/code_graph_context_hook.ts
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
  paragraph above; only `code-graph-context`, `reread-guard` and
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
   including ones no bound hook observes — and is reversible by closing the
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

This package binds no hook on Copilot and has measured none there. Concerns whose source rule cites
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
`tests/scripts/hooks/event_shape_contract.test.ts`. The replay test asserts
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

## Kill switches

Every `AGENT_CONFIG_*` identifier the hook layer reads from the process
environment, with the class of party that is expected to set it. One table so an
operator disabling one behavior does not have to grep for the name, and so a
reviewer can see at a glance which of these a human may legitimately set.

**The measurement unit, stated because the count is the contract.** One distinct
`AGENT_CONFIG_*` token appearing in a file under `src/scripts/hooks/` or
`src/scripts/_lib/`. Reproduce it with:

```bash
grep -rhoE "AGENT_CONFIG_[A-Z_]+" src/scripts/hooks src/scripts/_lib \
  | grep -vE '^AGENT_CONFIG_(BUNDLE|CLI_DELEGATE)__$' | sort -u | wc -l
```

**A gate keeps this equal, and it did not before.** `check_kill_switch_table`
compares the SET of switches in the tree against the SET of rows here on every
run — a set and not a count, because one switch added plus one row left behind
for a deleted switch is the pair a count cannot see, and it is the pair that
leaves a reader chasing a variable nothing reads. The table shipped at 28 == 28
and was stale within a day: a merge brought in one hook carrying one new switch,
and an independent review found it rather than a check. That is the argument for
the gate.

The two excluded names are esbuild `--define` identifiers
(`__AGENT_CONFIG_BUNDLE__`, `__AGENT_CONFIG_CLI_DELEGATE__`, see
`package.json`'s `build:*` scripts), not environment variables: nothing can set
one at runtime, so neither is a switch. The naive filter `grep -v
__AGENT_CONFIG_BUNDLE__` does **not** remove the first of them — `grep -o` emits
the match without its leading underscores — which is why the exclusion above is
anchored on the emitted token instead.

**Owner classes.** `maintainer` — a bypass a human may set knowingly, one
command or one run. `harness` — set by this package's own wrapper, dispatcher or
installer; a human setting it by hand is a debugging act, not a supported
configuration. `orphan` — the name survives only in prose; nothing reads it.

| Switch | Owner | What it does | Read at |
|---|---|---|---|
| `AGENT_CONFIG_ALLOW_SPEAKING_INBOX` | maintainer | Lets a write into the speaking-inbox directory through the PreToolUse block | `hooks/block_speaking_inbox_dir.ts:79` |
| `AGENT_CONFIG_DEPLOY_INVENTORY` | harness | Path override for the global deploy inventory | `_lib/global_deploy_inventory.ts:61` |
| `AGENT_CONFIG_DEV_MODE` | maintainer | Maintainer dev mode; forces `--scope=project` and is captured into the corpus manifest | `_lib/corpus_manifest.ts:89` |
| `AGENT_CONFIG_DISABLE_HOOKS` | maintainer | Bypasses every shim for one command | `_lib/runtime_wiring_checks.ts:315` |
| `AGENT_CONFIG_DOCTOR_NO_FORGE` | operator | `=1` stops `doctor --json` reading branch protection from the forge, before any subprocess starts; the five `forge_protection` rows then report `unread` | `_lib/forge_reader.ts:103` |
| `AGENT_CONFIG_EXEC_EVIDENCE` | maintainer | One-run opt-in to execution-evidence collection | `_lib/exec_evidence.ts:199` |
| `AGENT_CONFIG_OFFLINE` | operator | `=1` means this run makes no network calls. Pre-dates this table and is read in several places; it reaches a scanned root through the forge read, which honours it alongside `AGENT_CONFIG_DOCTOR_NO_FORGE` and on the same literal-`1` contract `update` and `versions` already use | `_lib/forge_reader.ts:103` |
| `AGENT_CONFIG_HOOKS_ISOLATED` | maintainer | `=1` forces every concern into a child process instead of the in-process fast path | `hooks/dispatch_hook.ts:690` |
| `AGENT_CONFIG_HOOK_TIMINGS` | harness | Path to a JSONL sink the dispatcher APPENDS one per-concern timing row to per dispatch; unset, nothing is written and the cost is one `process.env` lookup. Set by `bench_hook_latency` for the length of a bench run. Not a kill switch — it disables nothing — and it is in this table anyway, because the table's contract is every `AGENT_CONFIG_*` the hook layer reads, and an operator who finds the name in a process listing needs a row to look it up in | `hooks/dispatch_hook.ts:860` |
| `AGENT_CONFIG_INSTALLED_LOCK` | harness | Path override for the installed lockfile | `_lib/installed_lock.ts:56` |
| `AGENT_CONFIG_INSTALLED_TOOLS` | harness | Path override for the installed-tools manifest | `_lib/installed_tools.ts:46` |
| `AGENT_CONFIG_LEGACY_ANCHOR` | maintainer | Opts a settings read back onto the legacy anchor | `_lib/agent_settings.ts:449` |
| `AGENT_CONFIG_MEMORY_DIR` | harness | Directory override for memory recall | `hooks/memory_recall_hook.ts:309` |
| `AGENT_CONFIG_NO_EVENTS_LOG` | maintainer | Short-circuits council / team event-log appends to a no-op | `_lib/env_kill_switch.ts` names it; the readers are `ai_council/events_log.ts:109` and `ai_team/review_gate.ts:56`, both outside the two directories the unit covers |
| `AGENT_CONFIG_NO_PIN_REEXEC` | maintainer | Suppresses the pin re-exec | `_lib/pin_resolver.ts:43` |
| `AGENT_CONFIG_NO_RUN_CONTINUATION` | maintainer | `=1` makes the run-continuation concern allow unconditionally | `hooks/run_continuation_hook.ts:1018` |
| `AGENT_CONFIG_NO_UPDATE_CHECK` | maintainer | `=1` suppresses the update-availability check | `_lib/update_check.ts:239` |
| `AGENT_CONFIG_PACKAGE_ROOT` | harness | The package root the dispatcher hands each concern | `hooks/dispatch_hook.ts:647` |
| `AGENT_CONFIG_PACKAGE_VERSION` | harness | Version stamped into telemetry | `hooks/telemetry_usage_hook.ts:177` |
| `AGENT_CONFIG_PHP_SERVICE` | maintainer | Compose service the `php` shim runs in (default `php`) | `hooks/shims/php:84` |
| `AGENT_CONFIG_PIN_REEXEC_DEPTH` | harness | Re-exec depth counter, set by the re-exec itself | `_lib/pin_resolver.ts:44` |
| `AGENT_CONFIG_PROJECTION_MODE` | maintainer | Projection mode, captured into the corpus manifest | `_lib/corpus_manifest.ts:91` |
| `AGENT_CONFIG_PROJECT_ROOT` | harness | Wrapper-pinned project root for the settings cascade | `_lib/agent_settings.ts:699` |
| `AGENT_CONFIG_REPLAY` | maintainer | `=1` replay mode — state writes and emitters stand down | `hooks/replay_hook.ts:61` |
| `AGENT_CONFIG_ROOT_OVERRIDE` | maintainer | Overrides the resolved root for a settings read | `_lib/agent_settings.ts:700` |
| `AGENT_CONFIG_SCOPE` | maintainer | Install scope, captured into the corpus manifest | `_lib/corpus_manifest.ts:90` |
| `AGENT_CONFIG_SESSION_ID` | harness | Package-side session id, ahead of the host's own | `_lib/collector_denominator.ts:519` |
| `AGENT_CONFIG_SESSION_ROLE` | harness | Marks a spawn `worker`; unset, empty or unknown fails open to `orchestrator` | `_lib/session_role.ts:28` |
| `AGENT_CONFIG_SKIP_METADATA_GATE` | maintainer | Bypasses the pre-push metadata gate | `hooks/prepush_metadata_sources.sh:29` |
| `AGENT_CONFIG_TOOL_BYTE_CENSUS` | maintainer | `=1` opts a consumer into the tool-result byte census, which is otherwise written only inside the maintainer workspace | `hooks/tool_result_bytes_hook.ts:218` |
| `AGENT_CONFIG_SURFACE` | harness | Explicit surface, for a caller that already knows it | `_lib/surface.ts:47` |
| `AGENT_CONFIG_TRANSCRIPT_HOME` | orphan | Nothing reads it. The name survives in one comment in `hooks/turn_end_gate_hook.ts:1314` recording a widening this switch used to cause, and the switch itself is gone. Kept as a row so the count above stays reproducible, and marked so nobody sets it expecting an effect | — |

**What this table is not.** It is not an authorization list: a switch being
`maintainer`-class says a human is the expected setter, never that setting it is
free. A bypass of a safety floor stays governed by
[`non-destructive-by-default`](../../src/rules/non-destructive-by-default.md)
whichever variable spells it.

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
