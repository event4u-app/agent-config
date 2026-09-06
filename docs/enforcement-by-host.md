# Enforcement by host — how governance is applied, per tool

Governance in this package is applied two ways, and which one a host gets
depends on what that host exposes. We say so plainly rather than imply
"deterministic everywhere".

- **Compile-time (every host).** Rules and Iron Laws are compiled into each
  host's native instruction format at projection time (`.cursorrules`,
  `.windsurfrules`, `copilot-instructions.md`, `GEMINI.md`, Claude/Augment
  native rule dirs). This is the universal layer — it works on all projection
  targets. It is **model-cooperative**: the agent is instructed, strongly, but
  the host does not hard-block the call.
- **Runtime hooks (hook-capable hosts only).** On hosts that expose a tool
  lifecycle (`PreToolUse` / `PostToolUse` / `Stop`), a small set of guards can
  **deterministically block** a call (e.g. `block_no_verify`). This is a
  superset on top of the compile-time layer, not a replacement.

| Host | Compile-time rules | Lifecycle slots bound | Deny honoured |
|---|---|---|---|
| Claude Code (plugin) | ✅ | 9 | ✅ the only host that refuses on a deny |
| Cowork | ✅ | 8 | ❌ trampoline discards dispatcher output, `exit 0` |
| Augment | ✅ native rules | 5 | ❌ bound, verdict not honoured |
| Cursor | ✅ `.cursorrules` | 5 | ❌ no `pre_tool_use` binding |
| Cline | ✅ `.clinerules` | 5 | ❌ no `pre_tool_use` binding |
| Gemini | ✅ `GEMINI.md` | 5 | ❌ no `pre_tool_use` binding |
| Windsurf | ✅ `.windsurfrules` | 3 | ❌ no tool-lifecycle surface at all |
| Copilot | ✅ `copilot-instructions.md` | 0 | — `fallback_only`, nothing bound |

**This table was wrong until 2026-09-07 and the correction is worth naming**,
because the old shape is the one a reader reconstructs from memory. It said
Cursor, Windsurf and Gemini were "— static only" while
`src/scripts/hook_manifest.yaml` binds 5, 3 and 5 lifecycle slots on them
respectively (`:1266-1271`, `:1300-1305`, `:1317-1322`); it attributed Cline's
hooks to MCP where the manifest documents native `.clinerules/hooks/<HookName>`
files (`:1273-1280`); and it omitted `cowork` entirely, which is a first-class
platform in the manifest (`:1231-1256`), in the architecture contract, and in
`lint_hook_manifest.ts`'s `KNOWN_PLATFORMS`.

**Static-only was never the right axis.** A host can bind many slots and honour
no refusal — which is exactly what `cowork` and `augment` do — so "does it have
hooks" and "can it stop me" are two questions, and the old single column
answered neither reliably. The last column is the one that carries the
enforcement claim.

**Why we lead with compile-time, not hooks.** Runtime hooks reach only a
minority of supported hosts. Building the governance story on hooks would make
it a two-tier experience — a deny is honoured on Claude and nowhere else,
and Copilot binds nothing at all.
So the universal lever is the compile-time layer; runtime hooks are an opt-in
**bonus** on the hosts that can run them, never the floor.

The ADR-124 code-graph nudge is a case in point: on hook-capable hosts the
default-off `code-graph` PreToolUse hook surfaces "query the graph first" once
per session; on instruction-file hosts the same intent rides the always-loaded
[`external-code-graph-interop`](../src/rules/external-code-graph-interop.md)
rule and the [`code-intelligence`](../src/skills/code-intelligence/SKILL.md)
skill — the capability degrades gracefully, it does not disappear.

**Where MCP fits.** MCP is a *transport* surface, not a third enforcement layer.
On a host that runs MCP servers, MCP is one path by which a tool lifecycle (and
therefore the runtime-hook column above) can become available — but MCP presence
does not by itself add enforcement. Which hosts consume which surface is tracked
authoritatively, per artifact type, in
[`capability-matrix.md`](capability-matrix.md) (derived from the projection
dispatcher, drift-checked in CI) — we do not restate per-host surface facts here,
to avoid drift between two hand-maintained tables.

## Lifecycle slots — three different truths, kept apart

A host×slot cell can be true in three independent senses, and collapsing them is
how a declaration comes to read as evidence of runtime behaviour:

1. **Declared** — the manifest binds concerns there
   (`src/scripts/hook_manifest.yaml`, `platforms:` at `:1179`). A declaration is
   a statement about *this package's configuration*, never about the host.
2. **Lowerable** — the installer can write a native binding for it
   (`src/scripts/hooks/host_lowering.yaml`, per-host `slots:`). This is what an
   install actually emits, and it is checkable from the tree.
3. **Observed** — the host really invokes it. This is the only sense that is
   evidence, and it requires access to the host.

`D` = declared · `L` = lowerable · `—` = neither. Sourced from the two files
above at `60e84da85`; nothing in this table is an observation claim.

| slot | claude | cowork | augment | cursor | cline | gemini | windsurf | copilot |
|---|---|---|---|---|---|---|---|---|
| `session_start` | D+L | D | D+L | D+L | D+L | D+L | D+L | — |
| `session_end` | D+L | D | D+L | D+L | D+L | D+L | — | — |
| `stop` | D+L | D | D+L | D+L | D+L | D+L | D+L | — |
| `user_prompt_submit` | D+L | D | — | D+L | D+L | D+L | D+L | — |
| `pre_tool_use` | D+L | D | D+L | — | — | — | — | — |
| `post_tool_use` | D+L | D | D+L | D+L | D+L | D+L | — | — |
| `pre_compact` | D+L | — | — | — | — | — | — | — |
| `subagent_start` / `subagent_stop` | D+L | D | — | — | — | — | — | — |

**`cowork` is `D` and never `L`.** `host_lowering.yaml:172` gives it `slots: {}`
against eight declared bindings. That is an internal disagreement between two
files in this repository, not a fact about Cowork, and it passes CI only because
`tests/scripts/install_snapshot.test.ts:175` loops over five hosts and omits
`claude` and `cowork`.

### Open internal inconsistency — `pre_compact` on cursor and cline

`native_event_aliases` carries `preCompact: pre_compact` for `cursor`
(`hook_manifest.yaml:1380`) and `PreCompact: pre_compact` for `cline` (`:1389`),
and `cowork` inherits Claude's `PreCompact` alias (`:1365`). None of the three
has a `pre_compact` entry in `host_lowering.yaml` (`:102-106`, `:120-124`,
`:172`), and none binds the slot in `platforms:`.

**Recorded as unverified, dated 2026-09-07, and deliberately not resolved.** An
alias row asserts that the host emits a native event by that name; the lowering
table asserts this package can bind it. Which of the two is wrong is a question
about Cursor and Cline, and neither host was reachable from the session that
found this. Writing a resolution either way — deleting the aliases, or adding
the slots — would record an unavailable observation as a verified one.

**Resolve by:** running the dispatcher on a Cursor and a Cline build and recording
whether a compaction event arrives, with host version and date. Until then the
honest reading of the pair is "declared in one file, absent from the other".

### What writes what at the two context-ending slots

Step 1.2 of `road-to-one-continuity-record` asks this question because two
external proposals assumed the slots were free. They are not, and the accurate
correction is that **none of the concerns bound there writes a continuity
record**:

| slot | bound on | concerns | what each writes |
|---|---|---|---|
| `pre_compact` | claude only (`:1210`) | `language-mirror` | a pin-lost marker re-emitted once by `post_tool_use` |
| | | `hot-context` | `agents/runtime/state/hot-context.md` — a 400-word redacted cache, `loss_class: ephemeral-lossy` |
| | | `rule-inject` | injected rule text; writes no state |
| | | `journal-record` | the runtime journal — **default-OFF** (`src/config/agent-settings.template.yml:1289`), so it writes nothing on a default install |
| `session_end` | claude, cowork, augment, cursor, cline, gemini (`:1182,1189,1233,1268,1283,1319`) | `chat-history` | appends to `agents/runtime/.agent-chat-history` |
| | | `memory-learn` | memory intake |
| | | `session-register` | deregisters this session's record |
| | | `roadmap-progress` | roadmap dashboard state |
| | | `telemetry-flush` | telemetry |
| | | `journal-record` (claude only) | as above — default-OFF |

`hot-context` is the closest thing to a continuity writer at either slot, and it
is keyed by workspace rather than by session, overwritten on every `stop`, and
declared lossy. `session-eol` is not in either row — it binds `stop`, on claude
only (`:1190`).

## Vocabulary — the enforcement ladder (glossary, not a migration)

An external "enforcement-first" architecture proposal (reviewed by AI
council 2026-07-26, road-to-self-critical; **not adopted** — disposition in
`agents/settings/contexts/enforcement-first-disposition.md`) contributed a
useful *vocabulary* for talking about how strongly a rule can be held. It
is recorded here as a glossary alongside the resolver taxonomy this repo
already measures with (`enforced_by:` → `validator` / `validator-local` /
`observer` / `none`, per
[ADR-127](decisions/ADR-127-enforcement-claims-must-resolve.md)). No
migration toward it is scheduled.

| Ladder level | Meaning | Nearest resolver tier today |
|---|---|---|
| L1 `impossible` | The violating action cannot be expressed (capability removed, API absent) | — (no per-rule tier; this is tool-grant design, see `tool-safety`) |
| L2 `blocked` | A deterministic gate rejects the action at call time | `validator` (CI-reachable), or a `fail_closed: true` hook |
| L3 `verified` | The action runs; a check detects the violation after the fact and fails a build | `validator` / `validator-local` |
| L4 `just-in-time` | The constraint is injected into context at the moment of relevance, not always-loaded | *no equivalent today* — the one genuinely new level; worth a future look (hook-capable hosts only) |
| L5 `prose` | The constraint is instructed, model-cooperatively | `observer` / `none` (honest prose, per the compile-time-first stance above) |

The ladder is descriptive vocabulary. The measured stance stands: lead
with compile-time prose everywhere, bind deterministic checks where a host
supports them, and never delete the prose from static-host projections —
that is where the measured discipline lift lives.

See also the artifact-projection view: [`capability-matrix.md`](capability-matrix.md).
Its `hooks` row records which host consumes the `hooks/` **artifact** — that is a
projection fact, not a runtime-capability claim, and reading it as the latter is
how the corrected table above went wrong in the first place.
