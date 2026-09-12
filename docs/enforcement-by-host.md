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
| Codex | ✅ skill bundle to `~/.codex/` | 0 | — no platform key in `hook_manifest.yaml` |

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

**Codex, stated from the manifest rather than by analogy.** The installer
detects Codex (`src/install/toolDetection.ts`) and deploys the same
Anthropic-shaped rule/skill/command bundle to `~/.codex/`
(`src/install/wizard-plan.ts`), so the compile-time layer reaches it exactly as
it reaches the rows above. The two runtime columns are a different fact, read
off `src/scripts/hook_manifest.yaml`: its `platforms:` block declares eight
keys — `augment`, `claude`, `cowork`, `cursor`, `cline`, `windsurf`, `gemini`,
`copilot` — and Codex is not among them. No slot is bound, so no guard runs,
and nothing here should be inferred from Claude Code sharing a bundle format
with it. Codex was previously absent from this table altogether, which read as
unsupported rather than as unlisted; the row says which of the two it is.

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
how a declaration comes to read as evidence of runtime behavior:

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
| | | `rule-inject` | injected rule text; writes no state |
| | | `journal-record` | the runtime journal — **default-OFF** (`src/config/agent-settings.template.yml:1289`), so it writes nothing on a default install |
| `session_end` | claude, cowork, augment, cursor, cline, gemini (`:1182,1189,1233,1268,1283,1319`) | `chat-history` | appends to `agents/runtime/.agent-chat-history` |
| | | `memory-learn` | memory intake |
| | | `session-register` | deregisters this session's record |
| | | `roadmap-progress` | roadmap dashboard state |
| | | `telemetry-flush` | telemetry |
| | | `journal-record` (claude only) | as above — default-OFF |

Neither slot carries a continuity writer any more. `hot-context` used to be the
closest thing to one — keyed by workspace rather than by session, overwritten on
every `stop`, and declared lossy — and step 3.1 of
road-to-continuity-writer-activation retired that half on 2026-09-09. The concern
survives on `session_start` only, where it restores the memory session index and
writes no state. `session-eol` is not in either row — it binds `stop`, on claude
only (`:1190`).

## Loop primitive — can this host be told to keep going, and by what

The enforcement columns above answer *can this host stop me*. This one answers
the opposite question — **can this host be told to keep going** — and until this
section existed the tree had nowhere to write the answer. It matters because
exactly one re-engagement authority exists today, and adopting a host's own loop
verb would silently create a second one. A row per host is where that becomes
visible before it happens.

### The closed value set, and why it has five members rather than four

`none` · `in-session` · `subagent` · `durable` · `unknown`.

The roadmap step that commissioned this table (`road-to-loop-governance-truth`
2.1) names four values and omits `unknown`; its next step (2.2) then requires
that an unverified host read `unknown` and never `none`. Both are right and the
reconciliation is stated here rather than left for a reader to discover as a
contradiction: the four are the **answers**, `unknown` is the **absence of one**,
and the effective closed set is therefore five.

| value | meaning |
|---|---|
| `none` | The host exposes no loop primitive. Requires a cited observation, exactly like a `false` in the capability registry — see the note below the table. |
| `in-session` | The host can be told to continue the turn or session it is already in. The loop has no wall between iterations. |
| `subagent` | The loop is driven by spawning child agents; each iteration is a fresh child, the parent is the driver. |
| `durable` | The loop survives the session — a scheduled, cron-shaped, or otherwise out-of-session wake that starts work nobody is sitting in front of. |
| `unknown` | **Not researched.** Never "absent". |

**`unknown` is the honest default and this table is expected to be mostly
`unknown`.** It is the same discipline
`src/scripts/_lib/host_capability.ts` already applies to its registry: seven of
the eight platform keys have **no row at all**, so every field resolves to the
safe default and `describeHostCapabilities` reports its source as `default` —
"never looked", recorded as a silence rather than as a table of negatives. A
row here written `none` on no evidence would convert an unasked question into a
measured absence, which is the single failure this section exists to prevent.

**The value names the strongest kind this tree has an observation for**, not the
result of an exhaustive audit. A host reading `in-session` has not been
researched for `durable`; the row says so by not claiming it.

### The table

| Host | Loop primitive | Host's own verb | Verified | Cited observation |
|---|---|---|---|---|
| Claude Code (plugin) | `in-session` | the `Stop` hook's exit-2 continuation channel, marked on the next payload by `stop_hook_active` — no user-facing verb name is recorded in this tree | 2026-09-12 | `agents/evidence/analysis/stop-slot-warn-continuation-2026-09-12.md` — one measured case: a warn-only `stop` fire returning exit 2 is followed by three dispatcher invocations with no `user_prompt_submit` among them. The turn continued. Tier 1 in [`hook-architecture-v1.md`](contracts/hook-architecture-v1.md) § Stop-event capability tiers. **n=1**, one host version, one date — the artifact states four things it does not establish. |
| Cowork | `unknown` | none recorded | 2026-09-12 | — |
| Augment | `unknown` | none recorded | 2026-09-12 | — |
| Cursor | `unknown` | none recorded | 2026-09-12 | — |
| Cline | `unknown` | none recorded | 2026-09-12 | — |
| Gemini | `unknown` | none recorded | 2026-09-12 | — |
| Windsurf | `unknown` | none recorded | 2026-09-12 | — |
| Copilot | `unknown` | none recorded | 2026-09-12 | — |
| Codex | `unknown` | none recorded | 2026-09-12 | — |

The nine hosts are the nine rows of the enforcement table at the top of this
file. The `2026-09-12` dates on the eight `unknown` rows are the date the tree
was searched and no observation was found — they are verification dates for the
search, not for a capability.

### Eight `unknown` rows, and one thing they are not

**No host reads `none`, and that is the finding rather than a gap.** `none`
would assert that a host has no loop primitive, and no such observation exists
for any host in this tree. Producing one requires reaching the host — the same
limit `src/scripts/_lib/host_capability.ts` records for the seven platforms it
calls not reachable from the session that wrote the registry.

**What is NOT evidence for a `none`, stated because it looks like it is.** The
stop-slot capability tiers in
[`hook-architecture-v1.md`](contracts/hook-architecture-v1.md) place `augment`
and `cowork` on tier 2 — their trampolines discard the dispatcher's verdict and
`exit 0`, so the turn ends. That is a fact about **this package's** reach on
those hosts, derived from code in this repository. It says nothing about whether
the host has a loop verb of its own, and reading it as a `none` would be exactly
the inference this section forbids.

**The one `/loop` reference in the tree names no host.**
`src/domains/engineering-base/fix/pr-comments-loop/command.md:60-63` instructs
the agent to drive iterations via "the host's `/loop` mechanism" in self-paced
mode "when available", and to iterate inline "on hosts without `/loop`". It is
written host-agnostically on purpose, so it cannot fill a cell here. A verb
column stays empty until some host's verb is observed, not until one is
plausible.

**Drift is a documentation defect, not a breakage.** No code reads this table.
The value set is closed and every row carries its date, so a host that renames
or re-scopes a loop verb makes a row stale and nothing else. Re-derive a row
from its cited observation rather than trusting the cell.

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
| L4 `just-in-time` | The constraint is injected into context at the moment of relevance, not always-loaded | per host — see the L4 table below; no host is measured as receiving one yet |
| L5 `prose` | The constraint is instructed, model-cooperatively | `observer` / `none` (honest prose, per the compile-time-first stance above) |

### L4 per host — what each one actually has (2026-09-08)

Replaces the L4 row's former "nothing here has one" cell, which was true when
the ladder was written and stopped being true when the delivery concern shipped.
Every cell cites the emitter or the binding that produces it.

| Host | L4 mechanism | Cited at | Measured to reach the model? |
|---|---|---|---|
| Claude Code | hook delivery — `rule-inject` on `user_prompt_submit`, re-armed on `pre_compact` | `src/scripts/hooks/rule_inject_hook.ts`, `hook_manifest.yaml:1221` | `unobserved` |
| Cursor | description-gated native form — `alwaysApply: false` plus globs, with the rule's own trigger terms lowered into the description | `src/scripts/condense.ts::_emit_cursor_mdc`, `src/install/claudePathsPlan.ts::applies_when` | n/a — no hook delivery bound |
| Windsurf | description-gated native form — `trigger: model_decision`, same lowering | `src/scripts/condense.ts::_emit_windsurf_rule` | n/a — no hook delivery bound |
| Cowork | none | — | `observed-false`: the trampoline discards dispatcher output and exits 0 |
| Cline · Gemini · Augment · Copilot · Codex | none — the full corpus is projected instead | `src/scripts/condense.ts` `TOOL_DIRS` loop | `unobserved` |

**No host is measured as receiving a just-in-time constraint yet, Claude Code
included.** The mechanism exists and its byte-equivalence is measured; what is
not measured is a model visibly acting on a delivered body, which is the bar
owner ruling E3 sets and which no transcript in this tree meets. The per-host
record and its citation requirement are
`src/config/host-injection-effect.json` and
`agents/evidence/analysis/host-injection-effect-2026-09.md`.

**A host without a measured injection path receives the full corpus, and that
is the cost of the host rather than a defect.** Nothing is withheld from it: the
projection writes every rule body, and `check_host_tree_parity` asserts per PR
that such a host's tree is byte-identical to an `eager-all` run.

**Expiry: 2026-12-08.** This table is a snapshot of an observation state that is
expected to change; re-derive it from the record above rather than trusting the
cells after that date.

The ladder is descriptive vocabulary. The measured stance stands: lead
with compile-time prose everywhere, bind deterministic checks where a host
supports them, and never delete the prose from static-host projections —
that is where the measured discipline lift lives.

## `one-question-per-ask` — reach, stated on the manifest's terms

The `one-question-per-ask` PreToolUse guard (road-to-asked-not-parked 5.1)
denies a structured-ask tool call carrying more than one question. Its reach is
the narrowest sentence the manifest supports and no wider:

- **Bound on `claude` only.** `hook_manifest.yaml` lists it in that platform's
  `pre_tool_use` array and nowhere else. `agent-config hooks:status` prints the
  binding for the host actually running, and it is the answer to prefer over
  this paragraph.
- **A deny only where the host honours one.** `claude` is the platform this
  repository has verified both binds `pre_tool_use` and acts on the
  dispatcher's verdict. Where a trampoline discards dispatcher output — augment
  and cowork both `exit 0` unconditionally — a bound guard runs and is ignored,
  which is why it is not bound there: dead weight wearing a guard's name is
  worse than an honest absence.
- **On every other host the constraint is prose**, carried by
  [`ask-when-uncertain`](../src/rules/ask-when-uncertain.md)'s one-question
  Iron Law and [`user-interaction`](../src/rules/user-interaction.md)'s
  one-decision-point clause. That is L5 on the ladder above, and it is the
  floor everywhere.
- **It fires on nothing today, on every host.** No host in the capability
  registry carries an OBSERVED structured-ask tool
  (`src/scripts/_lib/structured_ask.ts`), so there is no such call to intercept.
  The guard exists so the first host to ship a picker meets the rule already in
  force. A reader must not take its presence as evidence that any host has one.

See also the artifact-projection view: [`capability-matrix.md`](capability-matrix.md).
Its `hooks` row records which host consumes the `hooks/` **artifact** — that is a
projection fact, not a runtime-capability claim, and reading it as the latter is
how the corrected table above went wrong in the first place.
