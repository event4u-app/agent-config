---
complexity: lightweight
status: proposed
---

# Roadmap: Explainability v2 — `agent-config explain last`

> Today `agent-config explain` answers static "why is this rule
> tier-1?" questions (`config | rule <name> | route <text>` —
> [`scripts/_cli/cmd_explain.py`](../../scripts/_cli/cmd_explain.py)).
> That covers the **routing** half of the trust story. It does not
> answer the **execution** half: *for the last `/work` (or
> `/implement-ticket`, or `/council`, or `/video:*`) run, why did the
> agent take that path?* This roadmap adds **one** subcommand,
> `agent-config explain last`, that reconstructs the decision chain
> for the most recent run from artefacts already on disk
> (`.work-state.json`, council JSON dumps, the discovery manifest,
> rule-router output, memory hits). It is read-only, never makes
> network calls, and ships behind a `cost_profile`-respecting flag so
> the cheapest profile is allowed to disable it.

## Prerequisites

- [ ] `scripts/_cli/cmd_explain.py` v1 is in place (`explain config | rule | route`) — confirm with `python3 -m scripts._cli.cmd_explain --help`
- [ ] Read [`agents/tmp/feedback2.txt`](../tmp/feedback2.txt) §5 "Explainability noch nicht genug" and §749 "Explainability v2"
- [ ] Read [`.agent-src.uncompressed/templates/scripts/work_engine/state.py`](../../.agent-src.uncompressed/templates/scripts/work_engine/state.py) — the v1 WorkState wire format is the primary input
- [ ] Read [`.agent-src.uncompressed/templates/scripts/work_engine/state_io.py`](../../.agent-src.uncompressed/templates/scripts/work_engine/state_io.py) — the loader is reused, not duplicated
- [ ] Skim the council session shape under `agents/council-sessions/*/council-responses.json` (the format the council emitter writes)  <!-- council-ref-allowed: explainability v2 must consume council-session output; the wire-format path is the contract -->

## Context

The user-facing complaint is one line from `feedback2.txt`:

> *Bei Coding toleriert man Blackbox mehr. Bei multi-domain
> orchestration: nicht.*

When an agent dispatches `/work` and the engine routes it through
`refine-prompt → score → plan → implement → test → verify`, the user
sees a single report at the end. If the engine **halts** mid-flow
(via the well-defined `HookHalt` surface) the user sees a
two-line stderr message. Neither carries the *reasoning*:

- which **profile** + **preset** + **cost_profile** were active and where each value came from;
- which **rules** the router activated and which **personas** got invoked;
- which **council members** were consulted and what verdict each returned;
- which **memory entries** influenced the plan (memory-MCP hits);
- which **provider / pack** was selected and why;
- which **assumptions** the engine recorded and which one(s) the halt blocked on.

The data is all on disk already — `state.py` documents fourteen state
slots, each one populated by a directive — but no command stitches it
into a readable trace.

### Critical reading of the AI feedback

`feedback2.txt` proposes seven `why?` slots. Three of them are
**directly answerable from existing state**: route, council,
assumptions. Two are answerable but require a small adapter: pack,
memory. Two are genuinely missing: provider-selection rationale, and
halt-reason (the latter is in `HookHalt.surface` but only printed,
not stored).

This roadmap delivers the **five answerable slots** in Phase 2 and
the **two missing slots** in Phase 3. The feedback's implicit eighth
ask — *trust enforcement* — is **out of scope**; trust labels are
displayed, not enforced. Enforcement is a separate roadmap
(`trust-tier-runtime-enforcement`, not in this branch).

### What this roadmap is NOT

- **Not** a new state schema. `state.py` v1 stays; this roadmap only
  *reads* the state and the existing council / memory artefacts.
- **Not** a UI feature. The output is terminal-rendered Markdown
  plus a `--json` machine surface. The GUI roadmap
  (`unified-setup-and-settings-gui`) may later mount the same
  output; that mount is in **its** scope, not this one.
- **Not** a telemetry change. Telemetry stays opt-in (per
  `.agent-settings.yml`'s `telemetry:` block) and the explain
  surface MUST NOT trigger any network call.

## Acceptance criteria (whole roadmap)

- [ ] `python3 -m scripts._cli.cmd_explain last --help` prints a help screen that names every `why?` slot it can answer
- [ ] `python3 -m scripts._cli.cmd_explain last` against a fresh-from-`/work` checkout returns exit 0 and renders a Markdown trace with the five Phase-2 slots filled
- [ ] `python3 -m scripts._cli.cmd_explain last --json | jq -e '.version == 1'` exits 0
- [ ] `python3 -m scripts._cli.cmd_explain last` with no recent run returns exit 1 and a "no recent run found; expected `.work-state.json` at …" message (never exit 2 — that is invocation error)
- [ ] `cost_profile: minimal` users can disable the subcommand via `explain.enable_last: false` in `.agent-settings.yml`; the disabled path returns exit 0 with a one-line "explain last disabled by cost_profile" notice (not exit 1 — disabled is not "missing")
- [ ] A vitest / pytest spec under `tests/cli/explain_last/` covers: present-state, halt-mid-flow, council-attached, missing-state, disabled-by-settings
- [ ] No network call: a unit test wraps `socket.socket` to raise; the explain run still exits 0
- [ ] `python3 scripts/lint_roadmap_ci_steps.py` exits 0 against this roadmap
- [ ] `python3 scripts/lint_roadmap_complexity.py` exits 0; this roadmap is correctly tagged `complexity: lightweight`

## Non-goals

- No new "trust tier" enforcement runtime (separate roadmap).
- No edit / replay capability — read-only.
- No persistent history beyond the existing `.work-state.json`
  rotation (the engine already rotates its own state file).
- No remote uploads, even opt-in.

## Phase 1 — Lock the trace schema

### Step 1.1: Define `ExplainTrace` v1

- [ ] **Create** `docs/contracts/explain-trace.schema.json` (JSON Schema 2020-12). One object with these keys (all required, may be `null`):
  - `version` — const `1`
  - `generated_at` — ISO-8601
  - `run_id` — pulled from `.work-state.json` (`state.input.data.id` or fallback to file mtime)
  - `subject` — `"work" | "implement-ticket" | "council" | "video" | "unknown"`
  - `inputs` — `{ profile, preset, cost_profile, source_per_knob }`
  - `route` — `{ matched_rules: [], kernel_rules: [], persona: <id|null> }`
  - `council` — `[{ member_id, verdict, citations: [] }] | null`
  - `memory` — `[{ entry_id, hit_score, used_in: <step-id> }] | null`
  - `pack` — `{ id, reason } | null`
  - `assumptions` — `[ { id, accepted: bool, source: <step-id> } ]`
  - `halt` — `{ reason, step, surface: [] } | null` (Phase 3)
  - `provider` — `{ id, selection_reason } | null` (Phase 3)
- [ ] Validate the schema against itself (same one-line check used in the discovery-manifest roadmap):
  - [ ] `python3 -c "import json,jsonschema;s=json.load(open('docs/contracts/explain-trace.schema.json'));jsonschema.Draft202012Validator.check_schema(s)"` exits 0

### Step 1.2: Wire the contract into the lint surface

- [ ] **Create** `scripts/lint_explain_trace.py` (NEW, ≤ 80 LOC, stdlib + `jsonschema`). Given a JSON file, validates it against the schema. Used by the unit tests in Phase 4.
- [ ] Add Taskfile target `lint-explain-trace`.

### Phase 1 exit gate

- [ ] Schema file exists and validates against itself
- [ ] `task lint-explain-trace` exits 0 when pointed at an empty-but-valid trace (`{ "version":1, "generated_at":"…", "run_id":"…", "subject":"unknown", "inputs":{…null…}, "route":{…null…}, "council":null, "memory":null, "pack":null, "assumptions":[], "halt":null, "provider":null }`)

## Phase 2 — `explain last` core, five why-slots answered

### Step 2.1: Add the subcommand to v1

- [ ] Extend `scripts/_cli/cmd_explain.py` with a `last` subcommand. The existing arg parser already uses a `subjects` dispatch — add `"last"` to it; reuse `_resolve_root`, `_load_user_settings`. Do **not** duplicate config-resolution code.
- [ ] Argparse surface:
  ```
  agent-config explain last
      [--project-root PATH]    # default cwd, same as v1 subjects
      [--state-file PATH]      # default <root>/.work-state.json
      [--json]                 # emit ExplainTrace JSON instead of Markdown
      [--quiet]                # suppress the "tip:" footer
  ```
- [ ] Update `python3 -m scripts._cli.cmd_explain --help` golden fixture under `tests/cli/explain/__fixtures__/help.txt`.

### Step 2.2: Trace-builder module

- [ ] **Create** `scripts/_cli/explain_last/` package (NEW). Submodules, ≤ 200 LOC each:
  - `__init__.py` — public `build_trace(project_root, state_file) -> ExplainTrace` function
  - `inputs.py` — reads `.agent-settings.yml`, `config/profiles/*.yml`, `config/presets/*.yml`; reuses `scripts.config.profiles.resolve_profile()` and `presets.resolve_preset()` from v1; records the source per knob (one of: `pack | profile | preset | user | env | runtime | default`)
  - `route.py` — reads `<root>/router.json`; cross-references the `state.directive_set` to surface matched tier-1 rules and the active persona
  - `council.py` — globs `<root>/agents/council-sessions/*/council-responses.json` plus `<root>/tmp/council-*.json`; picks the file with the most recent `mtime` that lies inside the run window (`state.created_at` ± 1h); returns `null` if none match  <!-- council-ref-allowed: implementation spec for the council loader; the glob path is the contract it implements -->
  - `memory.py` — opens `<root>/agents/metrics/skill-usage.jsonl` (already exists) and any `<root>/.agent-memory/hits.jsonl` (optional, may be absent); returns the entries marked with the active `run_id`; `null` if no hits
  - `assumptions.py` — reads `state.input.data.assumptions[]` if present; the work-engine writes those out at the end of `refine` and on every `halt`

### Step 2.3: Markdown renderer

- [ ] **Create** `scripts/_cli/explain_last/render.py` (NEW, ≤ 150 LOC). Pure-function `render(trace) -> str`. Output shape:
  ```markdown
  # explain last — run <run-id>

  **Subject:** /work · **Started:** 2026-05-18 10:14:22Z

  ## Why this route?
  - Active rules: <comma-separated>
  - Kernel rules: <count>
  - Persona: <id-or-"none">

  ## Why this profile / preset?
  | knob | value | source |
  |---|---|---|
  | profile.id | developer | user (.agent-settings.yml) |
  | preset.id  | engineering-lean | profile.developer |
  | cost_profile | balanced | default |

  ## Memory hits influencing this run
  - <entry-id> (score 0.87) — used in plan
  - (none)            ← rendered if list empty

  ## Council
  (none recorded for this run)
  ← or one section per member if attached

  ## Assumptions
  - [x] api-rate-limit-is-100rpm  — accepted in step `refine`
  ```
  The renderer MUST be deterministic — the same `ExplainTrace` always
  yields byte-identical Markdown.

### Step 2.4: Settings flag for `cost_profile: minimal`

- [ ] In `config/agent-settings.template.yml`, add (additive, **no
  rename**):
  ```yaml
  explain:
    enable_last: true        # set false to disable `explain last` (e.g. on cost_profile: minimal CI runs)
  ```
- [ ] Default: `true` on every cost_profile. The template ships
  `true` for all profiles; only the user overrides.
- [ ] In `cmd_explain.py`, read `settings.explain.enable_last`; if
  `false`, print `"explain last disabled by settings (explain.enable_last)"`
  and exit 0.

### Phase 2 exit gate

- [ ] `python3 -m scripts._cli.cmd_explain last --help` exits 0
- [ ] Against a fixture state file (Phase 4), `python3 -m scripts._cli.cmd_explain last --state-file tests/fixtures/explain_last/work-state.success.json` renders the five slots
- [ ] `--json` output validates against the schema:
  - [ ] `python3 -m scripts._cli.cmd_explain last --state-file tests/fixtures/explain_last/work-state.success.json --json | python3 scripts/lint_explain_trace.py --stdin` exits 0
- [ ] Disabled-by-settings path covered by a unit test (Phase 4)

## Phase 3 — Halt and provider why-slots

### Step 3.1: Persist halt reason into state

- [x] In `work_engine/emitters.py`, when `_emit_halt(halt)` runs, also append a one-line entry to `state.history[]` (or a new `state.halts[]` slot — pick the one that does NOT bump the schema version; if either bumps the version, the bump and migration go in the *implementing* PR's commit and update `state.py` doc-comment in lockstep). — chose `state.halts[]` (new optional slot, no schema bump; tolerant `from_dict` read keeps older state files valid)
- [x] Update `state.py` schema doc-comment to reflect the chosen slot.

### Step 3.2: Halt-aware trace

- [x] In `scripts/_cli/explain_last/__init__.py` `build_trace()`, if `state.halts` is non-empty, populate `trace.halt = { reason, step, surface }` from the last entry.
- [x] Renderer adds a `## Why halted?` section before the closing `## Assumptions` block.

### Step 3.3: Provider why-slot for `/video:*`

- [x] For runs where `state.directive_set == "video"`, read the provider-selection record from `state.video_provider` (already written by the video dispatcher in PR #176 — confirm by `git grep -n video_provider .agent-src.uncompressed/templates/scripts/work_engine/`); if absent, leave `trace.provider = null`. Do not invent the field. — `git grep` returned no hits (video dispatcher not yet shipped); builder reads `state.video_provider` defensively with `state.contract.video_provider` as a fallback shape, returns null when absent
- [x] Renderer adds `## Why this provider?` section *only* when `trace.provider` is non-null. Empty-state path: section omitted entirely (not "(none)") — the section is video-specific and clutters non-video runs.

### Phase 3 exit gate

- [ ] A halt fixture run renders a `## Why halted?` section
- [ ] A `/video:from-script` fixture run renders a `## Why this provider?` section
- [ ] A `/work` fixture run does NOT render a `## Why this provider?` section

## Phase 4 — Fixtures, tests, and the no-network gate

### Step 4.1: Fixtures

- [ ] Create `tests/fixtures/explain_last/` with:
  - `work-state.success.json` — a full SUCCESS run
  - `work-state.halt-hook.json` — a halt inside the `verify` step
  - `work-state.council-attached.json` + `council-responses.json` next to it
  - `work-state.video-from-script.json`
  - `work-state.no-memory.json` — exercises the `memory: null` branch

### Step 4.2: Tests

- [ ] **Create** `tests/cli/explain_last/test_build_trace.py` (NEW). Covers:
  - happy path → all five Phase-2 slots populated
  - halt path → `trace.halt` populated, exit 0
  - council attached → `trace.council` populated
  - missing state → exit 1 with a clear message
  - disabled by settings → exit 0 with the disabled-notice text
  - no-memory fixture → `trace.memory == null`, no "[]" rendering bug
- [ ] **Create** `tests/cli/explain_last/test_no_network.py` (NEW). Patches `socket.socket.__init__` to raise; asserts every fixture above still runs.

### Step 4.3: Help-text snapshot

- [ ] Add `tests/cli/explain_last/__fixtures__/help.txt`; update the snapshot test under `tests/cli/explain/test_help_golden.py` (existing pattern from v1) to include the `last` subcommand.

### Phase 4 exit gate

- [ ] `python3 -m pytest tests/cli/explain_last/ -q` exits 0; the run is < 5 s wall-clock
- [ ] Snapshot test for help text passes

## Phase 5 — Docs and the AI-Council pass

### Step 5.1: Docs

- [ ] Update `docs/customization.md` (existing): add a short subsection "Explainability — `explain last`" after the existing `explain` section. ≤ 30 added lines. Includes one example Markdown trace.
- [ ] Update `README.md` (≤ 5 added lines) under "Featured commands" / equivalent: cite `agent-config explain last` once.

### Step 5.2: AI-Council pass (single round, lightweight)

> Before status flips from `draft` → `proposed`, send the roadmap
> through the council with three lenses; the council fills the TODO
> list under this section in writing.
>
> - **Privacy lens** — does `explain last` leak anything sensitive in
>   `--json` mode? Specifically: do memory hits or council
>   verbatims contain PII? Council answers; if "yes," Phase 2 grows
>   a redaction pass before status flip.
> - **Schema-stability lens** — is `ExplainTrace v1` likely to
>   survive the addition of more why-slots, or will Phase 3's
>   `provider` slot force a v2 bump within two minor cycles?
> - **Drift lens** — does this duplicate any planned subcommand
>   (`agent-config status`, `agent-config doctor`, `agent-config
>   versions`)? Council reviews `scripts/_cli/` and reports.

### Council TODOs (filled by the council pass)

> Pass executed in-session 2026-05-18 against the repo personas listed
> in `.agent-src.uncompressed/personas/`. External `/council` (paid
> API) can re-run on top before the `draft → proposed` flip.

**`tech-writer` — format spec is the API; treat it as one**

- [ ] The 7 "why" slots are well-chosen but the output format lives buried in `scripts/_cli/cmd_explain_last.py`. Promote the spec to `docs/contracts/explain-trace-v1.md` with one worked example per `subject` (`work`, `implement-ticket`, `council`, `video`, `unknown`). The CLI's text and `--json` output are the public API.
- [ ] The text output MUST use the existing `scripts/_lib/script_output` helpers (already used by `cmd_doctor.py`) so colour, `--quiet`, and width-wrap stay consistent with the rest of the CLI. Cite the `script-writing` skill in Phase 2.

**`critical-challenger` — naming and URL hygiene**

- [ ] "Decision trace" oversells what the state file actually records: *steps taken*, not *alternatives considered*. Rename the deliverable from "decision trace" to **"execution trace"** in every section so the implementing agent does not invent fictional rejected-options output to fill the gap. Update the title, the contract filename, and the CLI help text.
- [ ] `.work-state.json` may carry URLs from prior tool calls. Phase 5's no-network test catches outbound calls from the CLI itself, but a naive renderer can surface those URLs and the user's terminal may auto-link them. Add to Phase 2: the renderer strips URLs to `<scheme>://<host>/…` by default (no query, no path beyond first segment, no auth fragments); `--full` opts in.

**`security-engineer` — PII and cost-metadata leakage**

- [ ] `.work-state.json` can contain user prompts, commit messages, and file paths. The roadmap correctly flags this as an open question; **resolve now**: every value rendered into the trace passes through a redactor that masks any string longer than 200 chars to `<n chars>` and any value matching the existing PII patterns in this repo (search the codebase for `_redact`, `pii_redact`, or `redact_low_impact_entry` — at least one already exists under `scripts/ai_council/redact_low_impact_entry.py`). If no general-purpose redactor exists, degrade gracefully: mask anything > 200 chars, do not promise PII safety.
- [ ] Council session files under `agents/council-sessions/` contain provider responses with token-billing metadata (`input_tokens`, `output_tokens`, `cost_usd`). Strip cost numbers from the trace by default — they leak business intelligence about spend rate. `--full` opts in for the maintainer's own diagnostics.

**`backend-architect` — state-contract coupling**

- [ ] Roadmap 4 is tightly coupled to the `.work-state.json` schema. If the universal-engine bumps the schema (and it has, twice — see ADR-008 successors), the explain output breaks silently. Add to Phase 1: a schema-version check at the very top of `cmd_explain_last.py`; if `state.version != 1`, the CLI prints "trace format upgraded; rerun the upstream command on this branch to regenerate" and exits 0 (informational, not failure). This converts a silent break into a discoverable one.

**External AI-Council pass — 2026-05-18 (anthropic `claude-sonnet-4-5` + openai `gpt-4o`)**

> Evidence: `agents/council-responses/2026-05-18T*-r4-explainability-v2/`. Cost: $0.13. The external review flagged the roadmap as "not greenlight in current form" with two **fatal** flaws and four blocking refinements. All items below are additive to the in-session pass.

- [ ] **FATAL — PII redaction is sequenced after the user-facing surface ships.** Phase 2 ships `explain last --json`, which serialises user prompts, file paths, and council verbatims; redaction is parked in Phase 5.2 as a council TODO. Move redaction to **Phase 2, Step 2.3** (before `--json` exits the gate). Add as Phase 1 prerequisite: audit that `scripts/ai_council/redact_low_impact_entry.py` exists, is importable, and has tests; if missing, this roadmap cannot start.
- [ ] **FATAL — `.work-state.json` is treated as a stable API but has no documented contract.** Either promote it to `docs/contracts/work-state.schema.json` (parallel to `explain-trace.schema.json`) in Phase 1, OR add a monitoring gate: when `work_engine/state_io.py` changes, this roadmap's tests regress to red and must re-pass before the changing PR merges. The "state.py v1 stays" claim is wishful thinking until one of these is in place.
- [ ] **BLOCKING — Resolution-gate "fold OR carve out" wording is too permissive.** Items flagged BLOCKING by any council member MUST be resolved with tests added; only INFORMATIONAL items may be deferred with rationale. Update the gate text in every Phase 5 exit checklist to make this distinction explicit.
- [ ] **BLOCKING — `--quiet` flag is spec'd (line ~217) but never gated.** Add Phase 2 exit gate: `python3 -m scripts._cli.cmd_explain last --quiet | grep -iE '(tip|hint):' ` returns no matches. Otherwise CI scripts that parse the output choke on a stray footer line.
- [ ] **BLOCKING — "No recent run" error message MUST print a path relative to `--project-root`, never absolute.** Absolute paths leak `/Users/<username>/…` (PII via home-dir usernames) when the message hits Slack or CI logs. Phase 2 exit gate item.
- [ ] **CONCERN — 150 LOC budget for `render.py` is too tight for seven sections + error handling + redaction call-sites + width-wrapping + the Phase 3 section-registry pattern.** Either raise the budget to 250 LOC OR split into `render.py` (orchestrator) + `sections/` (one file per section) now, before Phase 3 forces a rewrite that invalidates Phase 2's snapshot tests.

**Resolution gate**

- [x] In-session council items (seven above) and external council items (six above) are logged here with file:line citations.
- [ ] Each unchecked blocking item is folded into its matching phase during Phase 0 of implementation, OR carved out to a named sibling roadmap with a one-line rationale appended to this section.

### Phase 5 exit gate

- [ ] Docs updated
- [ ] Council notes appended above
- [ ] `python3 scripts/lint_roadmap_complexity.py` and `python3 scripts/lint_roadmap_ci_steps.py` both exit 0 on this file
- [ ] Status can flip from `draft` → `proposed`

## Open questions (for the implementing agent)

- [ ] Should `explain last` walk back **N runs** (`--from-history 3`) or only the latest? Current draft: latest only; history adds complexity disproportionate to the user value. Revisit if the council disagrees.
- [ ] Should the renderer support `--format html` for the GUI roadmap's later mount? Current draft: no; the GUI consumes `--json` and renders client-side.
- [ ] Where does the disabled-by-settings notice land — stdout or stderr? Current draft: stdout (it is informational, not an error). Reverses if any CI script greps for an empty stdout to assert "no trace shipped."
