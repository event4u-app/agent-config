# Enforcement by host — how governance is applied, per tool

Governance in this package is applied two ways, and which one a host gets
depends on what that host exposes. We say so plainly rather than imply
"deterministic everywhere".

- **Compile-time (every host).** Rules and Iron Laws are compiled into each
  host's native instruction format at projection time (`.cursor/rules/*.mdc`,
  `.windsurfrules`, `copilot-instructions.md`, `GEMINI.md`, Claude/Augment
  native rule dirs). This is the universal layer — it works on all projection
  targets. It is **model-cooperative**: the agent is instructed, strongly, but
  the host does not hard-block the call.
- **Runtime hooks (hook-capable hosts only).** On hosts that expose a tool
  lifecycle (`PreToolUse` / `PostToolUse` / `Stop`), a small set of guards can
  **deterministically block** a call (e.g. `block_no_verify`). This is a
  superset on top of the compile-time layer, not a replacement.

| Host | Compile-time rules | Lifecycle slots bound |
|---|---|---|
| Claude Code (plugin) | ✅ | 9 |
| Cowork | ✅ | 8 |
| Augment | ✅ native rules | 5 |
| Cursor | ✅ `.cursor/rules/*.mdc` | 5 |
| Cline | ✅ `.clinerules` | 5 |
| Gemini | ✅ `GEMINI.md` | 5 |
| Windsurf | ✅ `.windsurfrules` | 3 |
| Copilot | ✅ `copilot-instructions.md` | 0 |
| Codex | ✅ skill bundle to `~/.codex/` | 0 |

**The two columns carry different guarantees and the difference is the point.**
Every path named in the compile-time column is checked, per PR, against paths
generated from the emitters — `check_host_format_column` runs the two
install-time rule emitters into a throwaway tree and reads what they wrote, and
compares that against the tool-root registries the projection generators are
already bound to. A cell naming a path no emitter produces fails the gate. The
slot-count column beside it carries no such check: it is a hand-read of
`src/scripts/hook_manifest.yaml`'s `platforms:` bindings, measured elsewhere and
the subject of other work, so a reader must not carry the format column's
guarantee across to it.

**This table used to carry a fourth column, and it was removed on 2026-09-12
rather than corrected.** The column read `Deny honoured` and answered per HOST,
with one binary cell each — `✅ the only host that refuses on a deny` against
Claude Code, `❌` against the rest. It was measured against
`src/scripts/hooks/host_lowering.yaml`, the file the runtime resolver actually
reads, and the measurement is
[`enforcement-table-slot-drift-2026-09-12.md`](../agents/evidence/analysis/enforcement-table-slot-drift-2026-09-12.md):
1 mismatch of 8 comparable hosts, and the mismatched row was the one carrying
the enforcement claim. `claude` configures a refusal on 3 of its 9 lowerable
slots, not on 9.

No binary value would have fixed that cell. `✅` overclaims six slots and `❌`
denies three, because a host-level cell has to summarise a column of slot
values and no summary is faithful when the column disagrees with itself. So the
question moved to where its data lives — one row per host and bound slot, in
the generated region below — and the two columns that remain here stay
hand-written because neither is in the lowering file: compile-time projection
is a fact about `condense.ts`'s output, and the slot count is a fact about
declared bindings in `src/scripts/hook_manifest.yaml`.

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
answered neither reliably. The enforcement claim is the generated region below;
the slot count above is only how many slots exist to ask the question of.

**Codex, stated from the manifest rather than by analogy.** The installer
detects Codex (`src/install/toolDetection.ts`) and deploys the same
Anthropic-shaped rule/skill/command bundle to `~/.codex/`
(`src/install/wizard-plan.ts`), so the compile-time layer reaches it exactly as
it reaches the rows above. Its slot count is a different fact, read
off `src/scripts/hook_manifest.yaml`: its `platforms:` block declares eight
keys — `augment`, `claude`, `cowork`, `cursor`, `cline`, `windsurf`, `gemini`,
`copilot` — and Codex is not among them. No slot is bound, so no guard runs,
and nothing here should be inferred from Claude Code sharing a bundle format
with it. Codex was previously absent from this table altogether, which read as
unsupported rather than as unlisted; the row says which of the two it is.

**Why we lead with compile-time, not hooks.** Runtime hooks reach only a
minority of supported hosts. Building the governance story on hooks would make
it a two-tier experience — a refusal is configured on three slots of one host
and nowhere else, and Copilot binds nothing at all.
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

## Configured enforcement, per host and slot

Everything from here to the end marker below is a projection of
`src/scripts/hooks/host_lowering.yaml` — the file the runtime resolver reads.
The prose in this section is authored; the region after it is build output.

### What a generated table here can and cannot prove

**It proves agreement with the configuration. It proves nothing about a host.**
A drift check compares two artifacts in this repository. If a lowering rule is
wrong — if `claude` does not in fact act on exit 2 at `pre_tool_use` — the table
and the YAML stay in perfect agreement and are both false, and the check stays
green over it. That is why the region is titled **configured** behavior and
every cell is worded as a configuration fact, in a file whose own name says
`enforcement`. Reading a generated table as stronger evidence than the
hand-written one it replaced is the specific mistake available here, and the
wording is what is guarding against it.

What would establish the other half is a runtime conformance test: drive the
dispatcher on a real host, return the block exit, record whether the call was
refused. This tree has no such test for any host. The one adjacent measurement
it does have covers continuation rather than refusal and is `n=1` — see the
`Loop primitive` section's cited observation.

### The closed vocabulary

A cell carries exactly one of four values, and no cell may carry a value the
configuration cannot produce.

| Value | Means | Read off |
|---|---|---|
| `refusal` | This package has established an exit code the host honours as a refusal on this slot. A bound guard's deny is expected to stop the call. | a non-null `block_exit`, with the row's `verified` block unexpired |
| `halt-by-state` | The host halts because the dispatcher changed a state the host then reads — not because of an exit code, and not because of output. | **nothing. Currently unused — see below.** |
| `warning` | The dispatcher's verdict reaches the host and the run continues. A guard bound here can report; it cannot stop anything. | `block_exit: null` under `fail_policy: propagate` |
| `unenforced` | The trampoline exits 0 regardless, so the verdict reaches nothing. A guard bound here runs and is discarded. | `block_exit: null` under `fail_policy: discard` |

**`halt-by-state` is defined and unused, deliberately.** No field in the
lowering configuration expresses it, so nothing in this tree can produce it and
no cell below carries it. It is defined anyway, so that a reader who meets the
value later — when some host's lowering is written in those terms — meets a
category with a definition rather than an unexplained word. The risk that comes
with defining a value nothing emits is that a generator bug prints it into a
table that looks authoritative, so the gate rejects any cell carrying an
outcome no line in the configuration produces, before the write and again on
the committed file. Its self-test carries that case by name
(`./scripts-run src/scripts/check_enforcement_matrix --self-test`).

The guard's reach is narrow and worth stating: it catches a value the
derivation can never return. It cannot catch a value that is reachable but
wrong for its row — that is what the drift comparison covers, and behind that,
the configured-not-enforced caveat above.

### Why one row per pair, and not a matrix

Two shapes were built from the same data before this one was chosen.

A **host-by-slot matrix** — nine slot rows across six host columns, plus the
label column — was built first, and it is the more compact of the two: eleven
lines against forty-one. It was rejected on three counts. A one-cell change
rewrites a row of six values whose host must be recovered by counting columns,
which is the review surface where a wrong cell hides. There is no room for the
backing column, so no cell is checkable against the YAML without trusting the
derivation. And it needs a fifth glyph for "this host does not bind this slot",
sitting in the same visual column as the four real values — a layout that has
to invent a value outside the closed set in order to render is fighting the
vocabulary rather than carrying it.

The **long form** below is four times as long and its rows are no narrower in
characters, so the honest claim for a phone is not that it fits where the
matrix does not: it is that four columns degrade better than seven when a
viewport forces a wrap, because each row stays one readable fact. Its diff is
the stronger argument, and the decisive one: one fact per line, each line
naming its own host and slot, so a configuration change moves exactly the lines
it changed and a reviewer reads the change rather than reconstructing it.

**Codex now has a row, and the third kind of absence is gone.** This paragraph
used to read "No row for Codex ... it has no entry in the lowering file at
all". That stopped being true when the lowering file gained a `codex` row, and
the sentence then contradicted the region's own trailer two paragraphs down,
which lists `codex` among the hosts modelled with an empty `slots:` map. All
three of `cowork`, `copilot` and `codex` are now modelled the same way: a row
that exists, carrying a dated `verified:` block, with `slots: {}`.

What has NOT changed is the fact the old paragraph was reaching for: Codex
still has no `platforms:` key in `src/scripts/hook_manifest.yaml`, whose
`platforms:` block declares eight hosts and not Codex. So the slot count stays
0 — but it is now a 0 with a date and a citation on it rather than a silence,
which is the whole point of the row existing.

**And the 0 is now backed by a probe, not only by a reading.** The `codex` row
records a live deny probe on 2026-10-01 against `codex-cli 0.148.0`: a
`PreToolUse` hook bound to the documented `exit 2` refusal path did not block
the tool call, with the `hooks` feature reported `stable true` on that build.
That does **not** say the host cannot refuse — `host_lowering.yaml`'s header
forbids reading a row that way, and the probe left two explanations unexcluded
(an installed build 24 stable releases behind the documented one, and a matcher that
may never have matched). It says this package has demonstrated no refusal path
there, which is what a `0` in this table has always meant.

<!-- DO NOT EDIT BY HAND — generated by `./scripts-run src/scripts/check_enforcement_matrix --write`
     from `src/scripts/hooks/host_lowering.yaml`. Verified on every CI run by
     `check_enforcement_matrix`; a cell edited here is overwritten by the next
     regeneration and reported by that gate in between. Corrections belong in the
     YAML or in the generator. Everything OUTSIDE these two markers — including the
     `Loop primitive` section further down — is hand-written and untouched by a
     regeneration. -->
<!-- BEGIN GENERATED: enforcement-configured-by-slot -->
Projected from `src/scripts/hooks/host_lowering.yaml` — **configured behavior, not observed behavior.**
A cell says what this package has written down about a host, never what the host does.

**Configured: 3 of 32 host-slot pairs configure a refusal — `claude` on 3 of its 9 (`stop`, `user_prompt_submit`, `pre_tool_use`). 19 are `warning`, 10 are `unenforced`, 0 are `halt-by-state`. 1 of 9 modelled hosts configures a refusal on any slot; 0 configure one on every slot it binds.**

| Host | Slot | Configured outcome | Backing | Answered |
|---|---|---|---|---|
| `claude` | `session_start` | `warning` | `block_exit: null` · `fail_policy: propagate` | 2026-09-29 |
| `claude` | `session_end` | `warning` | `block_exit: null` · `fail_policy: propagate` | 2026-09-29 |
| `claude` | `stop` | `refusal` | `block_exit: 2` · `fail_policy: propagate` | 2026-09-29 |
| `claude` | `user_prompt_submit` | `refusal` | `block_exit: 2` · `fail_policy: propagate` | 2026-09-29 |
| `claude` | `pre_tool_use` | `refusal` | `block_exit: 2` · `fail_policy: propagate` | 2026-09-29 |
| `claude` | `post_tool_use` | `warning` | `block_exit: null` · `fail_policy: propagate` | 2026-09-29 |
| `claude` | `pre_compact` | `warning` | `block_exit: null` · `fail_policy: propagate` | 2026-09-29 |
| `claude` | `subagent_start` | `warning` | `block_exit: null` · `fail_policy: propagate` | 2026-09-29 |
| `claude` | `subagent_stop` | `warning` | `block_exit: null` · `fail_policy: propagate` | 2026-09-29 |
| `augment` | `session_start` | `unenforced` | `block_exit: null` · `fail_policy: discard` | 2026-09-29 |
| `augment` | `session_end` | `unenforced` | `block_exit: null` · `fail_policy: discard` | 2026-09-29 |
| `augment` | `stop` | `unenforced` | `block_exit: null` · `fail_policy: discard` | 2026-09-29 |
| `augment` | `pre_tool_use` | `unenforced` | `block_exit: null` · `fail_policy: discard` | 2026-09-29 |
| `augment` | `post_tool_use` | `unenforced` | `block_exit: null` · `fail_policy: discard` | 2026-09-29 |
| `cursor` | `session_start` | `warning` | `block_exit: null` · `fail_policy: propagate` | 2026-09-29 |
| `cursor` | `session_end` | `warning` | `block_exit: null` · `fail_policy: propagate` | 2026-09-29 |
| `cursor` | `stop` | `warning` | `block_exit: null` · `fail_policy: propagate` | 2026-09-29 |
| `cursor` | `user_prompt_submit` | `warning` | `block_exit: null` · `fail_policy: propagate` | 2026-09-29 |
| `cursor` | `post_tool_use` | `warning` | `block_exit: null` · `fail_policy: propagate` | 2026-09-29 |
| `cline` | `session_start` | `unenforced` | `block_exit: null` · `fail_policy: discard` | 2026-09-29 |
| `cline` | `session_end` | `unenforced` | `block_exit: null` · `fail_policy: discard` | 2026-09-29 |
| `cline` | `stop` | `unenforced` | `block_exit: null` · `fail_policy: discard` | 2026-09-29 |
| `cline` | `user_prompt_submit` | `unenforced` | `block_exit: null` · `fail_policy: discard` | 2026-09-29 |
| `cline` | `post_tool_use` | `unenforced` | `block_exit: null` · `fail_policy: discard` | 2026-09-29 |
| `windsurf` | `session_start` | `warning` | `block_exit: null` · `fail_policy: propagate` | 2026-09-29 |
| `windsurf` | `user_prompt_submit` | `warning` | `block_exit: null` · `fail_policy: propagate` | 2026-09-29 |
| `windsurf` | `stop` | `warning` | `block_exit: null` · `fail_policy: propagate` | 2026-09-29 |
| `gemini` | `session_start` | `warning` | `block_exit: null` · `fail_policy: propagate` | 2026-09-29 |
| `gemini` | `session_end` | `warning` | `block_exit: null` · `fail_policy: propagate` | 2026-09-29 |
| `gemini` | `stop` | `warning` | `block_exit: null` · `fail_policy: propagate` | 2026-09-29 |
| `gemini` | `user_prompt_submit` | `warning` | `block_exit: null` · `fail_policy: propagate` | 2026-09-29 |
| `gemini` | `post_tool_use` | `warning` | `block_exit: null` · `fail_policy: propagate` | 2026-09-29 |

**No row above for `cowork`, `copilot`, `codex`** — modelled in the configuration with an empty `slots:` map, so there is no host-slot pair to carry an outcome. That is an absence of bindings, not an outcome of `unenforced`.
<!-- END GENERATED: enforcement-configured-by-slot -->

### The slot rows are not a statement about any concern

A row above answers *can a refusal leave this slot on this host*. It does not
answer *is the concern bound here able to refuse*, and the two come apart in
both directions. `check_enforcement_matrix` prints that second reading on every
read-only run — per host, how many lowerable slots deny, and every concern bound
to a slot whose `block_exit` is null. It is a printed count and never an exit
code, for the same reason the estate and continuity ratchets report distance
instead of gating on it: these bindings predate the check, and reddening the
tree on them would punish whichever change added the reading.

### What a `blocking` severity means where a refusal cannot land

A concern's `severity` is a property of the **concern**; whether a refusal can
leave a slot is a property of the **host slot**. The table below publishes both,
side by side, and never folds them into one number.

That separation is the decision, not an artifact of the layout. An AI council
took the question on 2026-10-01 and both seats converged on publishing the
effective picture rather than editing the manifest or dropping the binding — and
one seat refused the phrase *effective severity* outright: severity has not
changed, enforcement strength has, and a generated page that silently redefines
the manifest's own vocabulary is worse than one that stays quiet. Hence two
columns with two different names.

Two values look similar and are not. **`warning-only`** says this package has a
lowering row for the slot and that row's `block_exit` is null — the host is
known not to refuse there. **`unverified`** says there is no row at all, which
is never-looked rather than cannot: `host_lowering.yaml` states in its own
header that an absence "does NOT mean the host cannot enforce". Publishing the
first where only the second is established would turn a gap in our measurement
into a claim about somebody else's product, and `check_enforcement_matrix`
**fails** on a row that does, in either direction.

A `blocking` concern on a slot that cannot refuse is not silent. It runs, and
its verdict reaches the agent as a warning. What it does not do is stop the
call, and that is the whole content of the right-hand column.

<!-- BEGIN GENERATED: blocking-severity-by-binding -->
Projected from `src/scripts/hook_manifest.yaml` (declared severity) and `src/scripts/hooks/host_lowering.yaml` (verified enforcement). **Two independent facts, never folded into one.**

The manifest declares what a concern is *meant* to do; the lowering table records what the host slot it is bound on *can* do. A `blocking` concern on a slot that cannot refuse still runs and still warns — it is not silent, and it is not a refusal either. These columns say which.

**21 binding(s) declare `blocking`: 9 refuse, 6 run and warn on a slot verified unable to refuse, 6 sit on a slot with no lowering row, 0 sit on a slot whose proof has lapsed.**

| Host | Slot | Concern | Declared severity | Verified enforcement | What that means |
|---|---|---|---|---|---|
| `augment` | `pre_tool_use` | `block-config-weakening` | `blocking` | `warning-only` | the slot is bound and `block_exit` is null — it runs and warns, it cannot refuse |
| `augment` | `pre_tool_use` | `block-kernel-rule-writes` | `blocking` | `warning-only` | the slot is bound and `block_exit` is null — it runs and warns, it cannot refuse |
| `augment` | `pre_tool_use` | `block-no-verify` | `blocking` | `warning-only` | the slot is bound and `block_exit` is null — it runs and warns, it cannot refuse |
| `augment` | `pre_tool_use` | `block-plumbing-writes` | `blocking` | `warning-only` | the slot is bound and `block_exit` is null — it runs and warns, it cannot refuse |
| `augment` | `pre_tool_use` | `block-speaking-inbox-dir` | `blocking` | `warning-only` | the slot is bound and `block_exit` is null — it runs and warns, it cannot refuse |
| `augment` | `pre_tool_use` | `evidence-independence` | `blocking` | `warning-only` | the slot is bound and `block_exit` is null — it runs and warns, it cannot refuse |
| `claude` | `pre_tool_use` | `block-config-weakening` | `blocking` | `refusal` | the slot denies — the concern does what it declares |
| `claude` | `pre_tool_use` | `block-kernel-rule-writes` | `blocking` | `refusal` | the slot denies — the concern does what it declares |
| `claude` | `pre_tool_use` | `block-no-verify` | `blocking` | `refusal` | the slot denies — the concern does what it declares |
| `claude` | `pre_tool_use` | `block-plumbing-writes` | `blocking` | `refusal` | the slot denies — the concern does what it declares |
| `claude` | `pre_tool_use` | `block-speaking-inbox-dir` | `blocking` | `refusal` | the slot denies — the concern does what it declares |
| `claude` | `pre_tool_use` | `evidence-independence` | `blocking` | `refusal` | the slot denies — the concern does what it declares |
| `claude` | `pre_tool_use` | `one-question-per-ask` | `blocking` | `refusal` | the slot denies — the concern does what it declares |
| `claude` | `stop` | `run-continuation` | `blocking` | `refusal` | the slot denies — the concern does what it declares |
| `claude` | `stop` | `turn-end-gate` | `blocking` | `refusal` | the slot denies — the concern does what it declares |
| `cowork` | `pre_tool_use` | `block-config-weakening` | `blocking` | `unverified` | no lowering row for this slot — nothing is bound natively, and nothing is established |
| `cowork` | `pre_tool_use` | `block-kernel-rule-writes` | `blocking` | `unverified` | no lowering row for this slot — nothing is bound natively, and nothing is established |
| `cowork` | `pre_tool_use` | `block-no-verify` | `blocking` | `unverified` | no lowering row for this slot — nothing is bound natively, and nothing is established |
| `cowork` | `pre_tool_use` | `block-plumbing-writes` | `blocking` | `unverified` | no lowering row for this slot — nothing is bound natively, and nothing is established |
| `cowork` | `pre_tool_use` | `block-speaking-inbox-dir` | `blocking` | `unverified` | no lowering row for this slot — nothing is bound natively, and nothing is established |
| `cowork` | `pre_tool_use` | `evidence-independence` | `blocking` | `unverified` | no lowering row for this slot — nothing is bound natively, and nothing is established |
<!-- END GENERATED: blocking-severity-by-binding -->

### Detector C's record path — is a failed exit visible, per host

Detector C refuses a turn that edited a file and then verified nothing. It has
two inputs: the RECORD written on `post_tool_use`, which carries an exit code,
and a transcript scan that sees only command names. Where the record is absent
or carries no exit code, the detector degrades to the name match — so this table
is the difference between a mechanism and its appearance.

**No row is inferred. An unprobed host reads `unknown`**, and one probed host
does not license a claim about its neighbours.

| Host | Output on `post_tool_use` | Failed exit distinguishable | Observed field | Probed |
|---|---|---|---|---|
| `claude` | yes | **undetermined** — see below | `exit_code` · `exit_source` · `stdout_tail` | 2026-09-30 |
| `augment` | unknown | unknown | — | never |
| `cursor` | unknown | unknown | — | never |
| `cline` | unknown | unknown | — | never |
| `gemini` | unknown | unknown | — | never |
| `windsurf` | unknown | unknown | — | never |
| `copilot` | unknown | unknown | — | never |
| `cowork` | unknown | unknown | — | never |

The `claude` row is a live reading of a real session's witness file, not a
fixture. Output is surfaced and the exit code arrives with its provenance
recorded. The middle column nevertheless reads `undetermined`, because across 24
records in that session **none carried a non-zero exit code** — including one
command that genuinely failed and does not appear in the record at all. The
per-turn cap does not explain it: `_cap_runs` preserves the earliest failing
record by design. Cause unresolved; the measurement and why it was not rounded
up to `yes` are in
[`verification-classifier-before-after-2026-09-30`](../agents/evidence/analysis/verification-classifier-before-after-2026-09-30.md).

An **advisory** concern on a null-block slot is consistent — most concerns are
advisory and belong on a reporting slot. Two readings are worth naming because
a reader looking only at the rows above would get them wrong:

- **`injection-scan` detects; it does not block, and nothing here claims it
  does.** It is bound to `post_tool_use` on all six hosts that carry it, and
  `post_tool_use` is `block_exit: null` everywhere. That is not a downgrade: the
  concern declares `severity: advisory`, its own header states it warns and
  never blocks, and it must read the tool *result* —
  `needs_payload_bodies: [input, result]` — which does not exist on a pre-call
  slot. So it cannot be moved to a slot that denies without losing the input it
  exists to inspect. The published claims elsewhere in this repository already
  read `warn-only` / `detected, not blocked`; this paragraph is where the slot
  reason is written down rather than re-derived by hand.
- **The same five `blocking` guards cannot refuse on `augment` or on `cowork`,
  for two different reasons.** `block-no-verify`, `block-kernel-rule-writes`,
  `block-config-weakening`, `block-speaking-inbox-dir` and
  `evidence-independence` are bound to `pre_tool_use` on both. On `augment` a
  lowering row exists and reads `block_exit: null` · `fail_policy: discard`, so
  they run and are ignored. On `cowork` there is **no row at all** —
  `host_lowering.yaml` gives it `slots: {}` against eight declared binding
  slots — so nothing is lowered natively in the first place. The audit reports
  those as distinct reasons (`null-block` versus `unlowerable`) and prints a
  bound-slot count beside the lowerable one, which is what keeps `cowork` from
  reading like `copilot`, the host that genuinely binds nothing.

A third class exists and is worded deliberately. When a row's literal
`block_exit` *can* deny but its `verified` block has expired, the audit says the
**proof** has lapsed and never that the host cannot deny — `host_lowering.yaml`
states in its own header that an absent `verified` "does NOT mean the host
cannot enforce", and the deny count is therefore taken from the literal.

## `destructive:` — which layer guards a typed op, per host

`road-to-adversarial-verification-and-long-runs` 7.2. The eleven typed ops need a
layer that can refuse one. Three values, and the column says which layer a host
actually has rather than asserting a floor it does not:

- **`hook`** — a `pre_tool_use` binding whose configured outcome is a refusal. A
  guard can deny the call.
- **`daemon`** — no such binding, but a guardrail daemon watches the host. **No
  host is `daemon` today**: 7.1's daemon ships observation-only and its enforcing
  mode is blocked on `daemon-host-kill-switch`, so the value exists in the
  vocabulary and describes nothing yet. Stated rather than omitted, because a
  column with no unreachable value reads as a complete taxonomy.
- **`manual-only`** — neither. The typed op is guarded by the model and by the
  human, and the package says so instead of implying a mechanism.

**Measured, not asserted**, from `src/scripts/hooks/host_lowering.yaml` — the file
the runtime resolver reads — on 2026-09-13:

| Host | `destructive:` | Measured from |
|---|---|---|
| `claude` | `hook` | `pre_tool_use` bound with `block_exit: 2` — a configured refusal |
| `augment` | `manual-only` | `pre_tool_use` bound, `block_exit: null` — it runs and is ignored |
| `cursor` | `manual-only` | no `pre_tool_use` slot (5 other slots bound) |
| `cline` | `manual-only` | no `pre_tool_use` slot (5 other slots bound) |
| `gemini` | `manual-only` | no `pre_tool_use` slot (5 other slots bound) |
| `windsurf` | `manual-only` | no `pre_tool_use` slot (3 other slots bound) |
| `cowork` | `manual-only` | empty `slots:` map — no bindings at all |
| `copilot` | `manual-only` | empty `slots:` map — no bindings at all |

**Seven of eight are `manual-only`, and the distinction inside that seven is worth
keeping.** `augment` binds the slot and discards the result; `cursor`, `cline` and
`gemini` do not bind it although `native_event_aliases` already maps their native
pre-tool events onto it — **unbound, not unbindable**; `windsurf` and `copilot`
have no alias row at all. Four states, one value, because what the column answers
is *can a typed op be refused here*, and for all four the answer is no.

**What this column is NOT.** It is not a measurement of whether a host's pre-tool
event can deny — nothing in this tree records that for an unbound host. It reads
this package's own configuration, which is the same honesty boundary the generated
region above states for itself: a cell says what has been written down about a
host, never what the host does.

`non-destructive-by-default`'s `enforced_by:` should name the live layer on the
current host. **It still reads `none` and this change did not move it**: that rule
is one of the nine kernel rules, and `block_kernel_rule_writes` refuses every agent
write to it — the denial was reproduced, not assumed. Lifting it is a human action
outside an agent session, so 7.2's second clause is recorded here as owed rather
than delivered.

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

### What happens when a bound hook on this slot runs too long

The tables above record which concerns are **bound** per slot. Binding is not
delivery, and the gap between them has a name: what the host does when a bound
hook runs too long. On `claude`'s `user_prompt_submit` that gap is the widest in
this tree, because `src/scripts/hook_manifest.yaml`'s
`platforms.claude.user_prompt_submit` binds **13 concerns** on that one slot —
`chat-history`, `verify-before-complete`, `minimal-safe-diff`,
`language-mirror`, `delegation-nudge`, `skill-route`, `git-authorization`,
`session-canary`, `self-repair`, `session-register`, `rule-inject`,
`suggestion-capture`, `journal-record` — and they share one process.

**Every row below is read from the host's documentation, not measured here.**
The provenance is the same for all three and is stated once rather than per
cell: host **Claude Code 2.1.286** (`claude --version`, 2026-09-30), page
**`https://code.claude.com/docs/en/hooks`**, retrieved **2026-09-30**, sections
named per row. The older path `docs.claude.com/en/docs/claude-code/hooks`
**301-redirects** to it, which is worth recording because the stale URL is the
one a reader reconstructs from memory.

| # | What the host documents | Section | Provenance |
|---|---|---|---|
| 1 | The default `timeout` for a `command` hook is 600 s, but Claude Code **lowers it to 30 s on `UserPromptSubmit`**. | § Common fields | `read-from-host-documentation` |
| 2 | A `command` hook that reaches its `timeout` is **cancelled and its output discarded**, "so on most events a timed-out hook renders no decision". The page scopes this to hooks not run with `async: true`. | § Timeouts | `read-from-host-documentation` |
| 3 | `UserPromptSubmit` is one of four events where **plain stdout is added as context Claude can see and act on**, rather than written to the debug log as on most events. | § Exit code 0 | `read-from-host-documentation` |

**Read together, rows 1–3 say the loss is total for this slot and not silent to
Claude in the ordinary case.** Because `hook_manifest.yaml` sets **no `timeout`
key anywhere** — grepped 2026-09-30, zero hits — all 13 concerns run inside the
one 30 s budget row 1 names, and row 2 discards the whole process output when it
is reached, so the 13 fail together or not at all. Row 3 is the half that
matters for the non-timeout path: this slot's stdout is a context channel, not a
log, so what a timeout destroys here is context Claude would otherwise have
acted on.

**Two things the page does not say, recorded as gaps rather than guessed.** It
does not state whether other hooks continue after one times out; and it does not
address transcript visibility in general terms — it distinguishes the debug log
from "context Claude can see", and says nothing about what a reader sees in
transcript mode. An earlier draft of this section asserted that neither the
plain-stdout nor the `additionalContext` channel produces a visible transcript
entry. **That claim does not reproduce against the page** and is withdrawn: for
this slot the stdout half is contradicted by row 3, and the transcript half is
simply unaddressed.

**Why the rows exist now and did not on 2026-09-29.** An independent
two-provider review refused an earlier draft on a ground this document could not
argue with: the citation was `Claude Code's own hooks reference, § hook
execution / timeout` with no URL, no host version and no retrieval date, in a
document whose every other column is read off a file in this repository. One
seat further held that the current primary source contradicts part of what the
rows asserted — **it does, and the withdrawal two paragraphs up is that
finding.** The refusal named its own return condition: the host and host version
observed, the exact page and section with its URL, and the date it was read. All
three are supplied above. A provenance marker on an unanchored claim marks it as
unanchored; the marker on these rows points at a page a reader can open.

**What is still not here, and it is the runtime half.** The same return
condition also asked, for the part that is a runtime claim rather than a
documentation claim, for a session in which the timeout was actually reached and
its effect on the 13 concerns recorded. No such session exists in this tree, so
no cell above is marked as measured here and none may be cited as one. The
distinction is
[`host-capability-manifest.md`](../src/agent-src/contexts/execution/host-capability-manifest.md)
§ Observation protocol's, and it is the reason every row carries the same
`read-from-host-documentation` marker instead of a stronger one.

**One measurement this tree does hold, and no conclusion is drawn from it.**
`docs/hook-latency.json` records `user_prompt_submit` at **p95 81 ms** over 50 CI
invocations on 2026-07-27, against the 30 s budget in row 1. The pair is stated
and left alone. A low p95 beside any timeout invites the reading that the
timeout is unreachable and slot-failure behavior therefore does not matter, and
that reading is refused here: a p95 is the 95th percentile of a synthetic bench
on an idle runner, silent about the tail, and the tail is the only part of the
distribution a timeout ever meets. Thirteen concerns sharing one process is a
failure mode to be designed against on its shape, not dismissed on a
median-adjacent statistic.

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
- **No host's delivered surface has been OBSERVED carrying a picker.** That is
  why `STRUCTURED_ASK_SHAPES` is empty (`src/scripts/_lib/structured_ask.ts`)
  and no per-host shape row exists. It is narrower than the claim this bullet
  used to make — "it fires on nothing today, on every host" — and the narrowing
  is the measurement base: `_lib/host_capability.ts` carries exactly one row,
  `structured_ask: false` for `claude`, observed-absent on Claude Code 2.1.263
  on 2026-09-07; the other eight hosts in the table at the top of this file have
  no row at all, which is never-looked rather than measured. One dated reading of
  one host version does not support a standing present-tense claim about nine
  hosts, and the registry's own comment says so — the observation "is not a claim
  that the vendor ships no such tool anywhere". The guard exists so the first
  host whose delivered surface carries a picker meets the rule already in force.
  A reader must not take its presence as evidence that any host has one.

See also the artifact-projection view: [`capability-matrix.md`](capability-matrix.md).
Its `hooks` row records which host consumes the `hooks/` **artifact** — that is a
projection fact, not a runtime-capability claim, and reading it as the latter is
how the corrected table above went wrong in the first place.
