# Roadmap: Artifact Engagement Telemetry

> **Status: not started.** Default-off, opt-in-only. The whole point of this roadmap is to measure which skills, rules, commands, guidelines and personas the agent actually consults and applies — without quietly costing tokens for consumers who never enable it.

## Mission

Make the value of every artefact in `.augment/` empirically defensible. Today we ship 125 skills, 47 rules, 74 commands, 46 guidelines, 7 personas — and have no data on what the agent actually pulls into context, what it cites, what it never touches. The goal is a local, append-only **engagement log** that records — at task boundaries, not per tool-call — which artefacts were `consulted` (loaded into context) and which were `applied` (cited in the agent's output or directly drove a decision), plus a maintainer-side aggregator that turns the log into retirement / promotion signals.

This roadmap **does not** change agent behaviour for consumers who keep the default. Enabled by maintainers (and only by them), it produces a `.agent-engagement.jsonl` that the same maintainer can roll up via `./agent-config telemetry:report`.

- **Feature:** package-quality measurement infrastructure
- **Jira:** none
- **Depends on:** none — orthogonal to R1-R5

## Prerequisites

- [ ] Read `.agent-src.uncompressed/templates/agent-settings.md` (telemetry namespace must not collide with existing keys)
- [ ] Read `agents/contexts/implement-ticket-flow.md` (task-boundary semantics — engagement records align to those boundaries)
- [ ] Confirm `.gitignore` entries for `.agent-engagement.jsonl` (must never reach a consumer's repo)

## Paths (canonical)

| Alias | Resolves to | Role |
|---|---|---|
| `<engine-src>` | `.agent-src.uncompressed/templates/scripts/` | Source of truth — engagement engine lives here |
| `<engine-mirror>` | `.agent-src/templates/scripts/` | Compressed projection — auto-generated |
| `<settings-template>` | `.agent-src.uncompressed/templates/agent-settings.md` | Settings schema lives here |
| `<engagement-log>` | `.agent-engagement.jsonl` (consumer repo root) | Append-only JSONL, gitignored, opt-in only |

## Context

Right now the only signal a maintainer has about artefact value is anecdotal: *"this skill seems useful"*, *"nobody ever invokes that command"*. The package linter checks structural validity (frontmatter, size budgets) but cannot tell what the agent reaches for in real work.

Three failure modes follow from that blindness: (1) artefacts go stale because no one notices their triggers stopped firing; (2) refactor effort is misallocated — large effort poured into rarely-touched skills, hot-path skills neglected; (3) consumer-side noise (auto-rules that always trigger but never change output) is invisible. Telemetry closes all three — but only if the cost stays close to zero for the 95 % of tasks where it is off.

## Target architecture

```text
<engine-src>/telemetry/
  __init__.py
  engagement.py            ← event schema + JSONL appender
  boundary.py              ← task / phase-step boundary detection
  aggregator.py            ← rollup → quartile report
  report_renderer.py       ← markdown / json output

scripts/agent-config
  telemetry:record         ← single-event append (called from agent at boundaries)
  telemetry:report         ← rollup over the local JSONL
  telemetry:status         ← print enabled flag, granularity, log size

.agent-engagement.jsonl    ← gitignored, append-only, one event per task boundary
.agent-settings.yml
  telemetry:
    artifact_engagement:
      enabled: false       ← default; absence == disabled
      granularity: task    ← task | phase-step | tool-call (cost ↑↑)
      record:
        consulted: true
        applied: true
      output:
        path: .agent-engagement.jsonl
```

Each event is a single JSONL line: `{ts, task_id, boundary_kind, consulted: {skills, rules, commands, guidelines, personas}, applied: {…same kinds…}, tokens_estimate?: {consulted_load}}`. Event emission is the agent's responsibility; the engine never introspects the agent context — it only validates and appends.

## Non-goals

- **No** server-side aggregation, cloud sync, or sharing platform — local JSONL only.
- **No** per-keystroke or per-tool-call recording in the default path; `tool-call` granularity exists but requires explicit opt-in and warns about cost.
- **No** content storage — only IDs (`skill:foo`, `rule:bar`). Never paths, prompts, file contents.
- **No** automatic artefact deletion. Reports surface retirement candidates; humans decide.
- **No** consumer-visible behaviour change when `enabled: false` — zero file IO, zero token overhead, zero log entries.
- **No** version numbers (per `roadmaps.md` rule 13).

## Phase 1: Schema and settings wireup

- [ ] **Step 1:** Define event schema in `<engine-src>/telemetry/engagement.py` — typed dict, strict validation, JSONL serialisation. Reject events with unknown artefact kinds.
- [ ] **Step 2:** Extend `<settings-template>` with the `telemetry.artifact_engagement` namespace; default `enabled: false` everywhere; `sync-agent-settings` skill picks the new section up additively.
- [ ] **Step 3:** Update `.gitignore` (root + template) to exclude `.agent-engagement.jsonl` — must never reach a consumer commit.
- [ ] **Step 4:** Schema-validation tests: round-trip, rejection of unknown kinds, idempotent JSONL appends, default-off behaviour proves zero file IO.

## Phase 2: Recording engine

- [ ] **Step 1:** Implement `<engine-src>/telemetry/boundary.py` — boundary detection, task vs phase-step granularity, idempotent within a single boundary (duplicate `record` calls coalesce).
- [ ] **Step 2:** Implement `./agent-config telemetry:record` — reads enabled-flag from settings, validates payload via Phase 1 schema, appends one JSONL line. Returns 0 silently when disabled.
- [ ] **Step 3:** Implement `./agent-config telemetry:status` — prints `enabled`, `granularity`, log size, last event timestamp. Read-only; safe even when disabled.
- [ ] **Step 4:** Tests: enabled-disabled symmetry (disabled → no file IO), append durability under concurrent writes (file-lock), schema rejection produces non-zero exit.

## Phase 3: Agent-side hooks

- [ ] **Step 1:** Define a rule (`artifact-engagement-recording`) that fires at task / phase-step boundaries when `enabled: true`. Rule body: emit one `telemetry:record` call with the consulted+applied artefact lists from the current task.
- [ ] **Step 2:** Wire into `/implement-ticket` boundary points — refine, plan, apply, test, verify, report — one event per phase-step when `granularity: phase-step`, one merged event when `granularity: task`.
- [ ] **Step 3:** Disabled-path verification: with `enabled: false`, no engagement-related rule loads, no telemetry helpers are imported, no JSONL is touched. Asserted by a dedicated cost-floor test that runs the engine end-to-end and counts file accesses.
- [ ] **Step 4:** Document the recording contract in `agents/contexts/artifact-engagement-flow.md` (new) — what triggers a record, what counts as `applied` vs `consulted`, what the agent must NOT record (paths, contents, secrets).

## Phase 4: Aggregator and report

- [ ] **Step 1:** Implement `<engine-src>/telemetry/aggregator.py` — reads JSONL, groups by artefact id, computes consulted-count, applied-count, applied/consulted ratio, est. cost (tokens × frequency).
- [ ] **Step 2:** Implement `<engine-src>/telemetry/report_renderer.py` — markdown table with quartiles (top 20 % essential, mid 60 % useful, bottom 20 % retirement candidates), `--json` for machine consumption.
- [ ] **Step 3:** Wire `./agent-config telemetry:report --since <duration> --top <n> --json` — defaults `--since 30d --top 20` markdown.
- [ ] **Step 4:** Tests: empty-log → empty-but-valid report; representative log → quartile boundaries match expected; corrupted JSONL line → skip with warning, not crash.

## Phase 5: Privacy and anonymisation audit

- [ ] **Step 1:** Audit every event field — confirm zero path, content, prompt, ticket-id, or secret can leak. Repository-internal `task_id`s are allow-listed; consumer-supplied free-text is forbidden.
- [ ] **Step 2:** Add a redaction validator — `telemetry:record` rejects payloads containing `/`, `\`, file extensions, or strings longer than 200 chars in id fields.
- [ ] **Step 3:** Maintainer-export check — `./agent-config telemetry:report --json` output passes the same validator before being written; safe to share without further review.
- [ ] **Step 4:** Document the privacy contract in `agents/contexts/artifact-engagement-flow.md` — what is recorded, what cannot be, how to audit a JSONL by hand.

## Phase 6: Dogfooding against R1–R5

- [ ] **Step 1:** Maintainer enables `telemetry.artifact_engagement.enabled: true` locally; works through one full R1 phase, captures the resulting JSONL.
- [ ] **Step 2:** Run `./agent-config telemetry:report` against the captured log; eyeball the quartile output for plausibility (top 20 % should contain skills/rules the maintainer knows were active).
- [ ] **Step 3:** Cross-check against R1's golden replay — same boundaries, same artefact ids reachable from the recipes. Surface mismatches as engine-side bugs, not test-side.
- [ ] **Step 4:** Capture a 2-week dogfooding window across at least two roadmaps; produce a maintainer-only report. No consumer-side enablement in this phase.

## Phase 7: Docs and onboarding

- [ ] **Step 1:** Update `README.md` and `AGENTS.md` — short note that telemetry exists, default-off, see context doc. No marketing prose.
- [ ] **Step 2:** Add a one-screen onboarding hint to `/onboard` — *"telemetry.artifact_engagement is off by default; maintainers enable it via `./agent-config set-cost-profile` or by editing settings"*. Consumers see no prompt.
- [ ] **Step 3:** Write ADR `agents/contexts/adr-artifact-engagement.md` — rationale, default-off doctrine, privacy contract, deprecation horizon for the schema.
- [ ] **Step 4:** Draft `CHANGELOG` entry under "Unreleased" — opt-in feature, default-off, maintainer-targeted.

## Acceptance criteria

- [ ] `enabled: false` (default) produces zero token cost, zero file IO, zero rule activations attributable to telemetry — proven by a dedicated cost-floor test
- [ ] Schema validates round-trip; unknown artefact kinds, malformed events, and oversized ids all rejected with non-zero exit
- [ ] `.agent-engagement.jsonl` is gitignored at root + template; CI fails on attempts to commit one
- [ ] `./agent-config telemetry:record` is idempotent within a boundary, durable under concurrent writes, silent when disabled
- [ ] `./agent-config telemetry:report` produces markdown + json output, both pass the redaction validator
- [ ] Privacy audit: no path, content, secret, or free-text payload reachable in any event field
- [ ] Dogfooding-window report exists; quartiles non-empty; at least one retirement candidate flagged
- [ ] Settings docs, ADR, README note, changelog entry all in place
- [ ] `task ci` exits 0 end-to-end including the cost-floor test

## Open decisions

- **Boundary definition for `task`** — `/implement-ticket` end vs. agent-self-declared task end. Lean: agent-self-declared, with `/implement-ticket` end as a forced flush.
- **`applied` semantics** — agent-self-reported (cheap, fuzzy) vs. cite-detected (post-hoc grep on agent output, expensive but objective). Lean: self-reported in v1, cite-detector deferred to a future-track.
- **Maintainer-only enforcement** — should `enabled: true` require a `package_dev: true` flag elsewhere in settings, or trust the operator? Lean: trust + warn-on-enable; package-dev-flag adds friction without preventing misuse.
- **JSONL retention** — automatic rotation at N MB or never-prune? Lean: never-prune; aggregator handles size.
- **Tool-call granularity** — ship the option from day one or defer? Lean: ship the option, default-off, warn loudly when enabled.

## Risks and mitigations

- **Silent token bleed when defaults change** → cost-floor test runs in CI, asserts zero file IO when `enabled: false`; a future settings-default flip would fail the test
- **Privacy leak via free-text task ids** → redaction validator on both `record` and `report` paths; hard 200-char limit; reject paths and extensions in id fields
- **Self-reporting drift** (agent inaccurate about what it `applied`) → dogfooding phase cross-checks against golden replay; mismatches are engine bugs, not data corrections
- **JSONL corruption** → aggregator skips bad lines with warning, never crashes; concurrent writes use file-lock
- **Consumer-side accidental enable** → onboarding hint stays maintainer-targeted; `enabled: true` prints a one-line stderr warning at first record
- **Aggregator gives misleading quartiles on small N** → report renderer suppresses quartile output below 50 events; raw counts only until threshold

## Future-track recipe (deferred)

- **Cite-detector** — post-hoc grep on agent output to verify `applied` claims. Bigger feature; lands as its own roadmap once self-reporting is established.
- **Cross-project rollup** — opt-in maintainer tool that aggregates JSONL from multiple repos into one report. Out of scope here; no cloud component.
- **Auto-deprecation suggestions** — proposing skills for retirement based on quartile output. Surfaces in `optimize-skills`, not here.
- **Engagement-aware skill loading** — using past engagement to bias the agent's context loading. Decoupled from this roadmap; would land alongside any context-aware loading work.
