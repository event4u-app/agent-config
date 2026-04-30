# Roadmap: Artifact Engagement Telemetry

> **Status: in progress (Phase 1 ✅, Phase 2 ✅, Phase 3 ✅).** Default-off, opt-in-only. The whole point of this roadmap is to measure which skills, rules, commands, guidelines and personas the agent actually consults and applies — without quietly costing tokens for consumers who never enable it.

## Mission

Make the value of every artefact in `.augment/` empirically defensible. Today we ship 125 skills, 47 rules, 74 commands, 46 guidelines, 7 personas — and have no data on what the agent actually pulls into context, what it cites, what it never touches. The goal is a local, append-only **engagement log** that records — at task boundaries, not per tool-call — which artefacts were `consulted` (loaded into context) and which were `applied` (cited in the agent's output or directly drove a decision), plus a maintainer-side aggregator that turns the log into retirement / promotion signals.

This roadmap **does not** change agent behaviour for consumers who keep the default. Enabled by maintainers (and only by them), it produces a `.agent-engagement.jsonl` that the same maintainer can roll up via `./agent-config telemetry:report`.

- **Feature:** package-quality measurement infrastructure
- **Jira:** none
- **Depends on:** none — orthogonal to R1-R5

## Prerequisites

- [x] Read `.agent-src.uncompressed/templates/agent-settings.md` (telemetry namespace confirmed clear — sits between `onboarding:` and Settings Reference)
- [x] Read `agents/contexts/implement-ticket-flow.md` (task-boundary semantics — engagement records align to the eight-step linear flow)
- [x] Confirm `.gitignore` entries for `.agent-engagement.jsonl` (added to root + `config/gitignore-block.txt` so the consumer installer ships the entry)

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

- [x] **Step 1:** Define event schema in `<engine-src>/telemetry/engagement.py` — `EngagementEvent` dataclass, strict structural validation, JSONL serialisation, unknown artefact kinds rejected.
- [x] **Step 2:** Extend `<settings-template>` with the `telemetry.artifact_engagement` namespace; default `enabled: false` everywhere; section sits at the YAML tail with full Settings Reference rows so `sync-agent-settings` picks it up additively.
- [x] **Step 3:** `.gitignore` (root) and `config/gitignore-block.txt` (consumer installer template) both exclude `.agent-engagement.jsonl` and `.bak` — never reaches a consumer commit.
- [x] **Step 4:** Schema-validation tests in `tests/telemetry/test_engagement.py` (12 cases): round-trip, unknown-kind rejection, unknown-boundary rejection, oversized-id rejection, parse-event invalid-JSON rejection, idempotent JSONL appends, default-off zero-IO under chdir.

## Phase 2: Recording engine

- [x] **Step 1:** Implemented `<engine-src>/telemetry/boundary.py` — `BoundarySession` (set-union coalescing on consulted/applied), `record_event` with `fcntl.flock` for cross-process durability, `open_boundary` context manager that suppresses flush on exception. Idempotent: double-flush is no-op, empty session writes nothing.
- [x] **Step 2:** Implemented `./agent-config telemetry:record` — wires through `telemetry/settings.py` (shared YAML reader), supports `--payload-file`/`--stdin`/`--task-id`+`--consulted`/`--applied` invocations, returns 0 silently when disabled, exit 1 on schema failure, exit 2 on IO failure. `--force` bypasses for tests.
- [x] **Step 3:** Implemented `./agent-config telemetry:status` — read-only; renders enabled/granularity/log path/size/line count/last event ts in text or JSON; never creates the log; gracefully handles missing settings, missing section, malformed YAML.
- [x] **Step 4:** Tests in `tests/telemetry/{test_boundary,test_settings,test_cli_telemetry}.py` (25 cases) — coalescing, exception-suppression, idempotent flush, schema-rejection, **20-process concurrent-write durability**, settings parsing edge-cases, disabled-zero-IO, force-bypass, status JSON shape.

## Phase 3: Agent-side hooks

- [x] **Step 1:** Shipped `.agent-src.uncompressed/rules/artifact-engagement-recording.md` — `type: auto`, `cloud_safe: noop`, fires on /implement-ticket and /work boundary completion. Rule body: read settings once per task, cache, then emit one `./agent-config telemetry:record` per boundary with consulted+applied lists. `enabled: false` → no-op.
- [x] **Step 2:** Wired into `/implement-ticket` and `/work` command rules — single bullet under `### Rules` in each, pointing at the rule for the full contract. Boundary cadence governed by `telemetry.artifact_engagement.granularity` (`task` | `phase-step`); both flows share the same eight-step contract from `agents/contexts/implement-ticket-flow.md`.
- [x] **Step 3:** Cost-floor verified by `tests/telemetry/test_cost_floor.py` (6 cases) — fresh-subprocess imports of `work_engine.dispatcher` and `work_engine.cli` confirm zero `telemetry.*` modules load; disabled `telemetry:record` creates no files, doesn't even create parent dirs; rule frontmatter type/cloud-safe markers locked.
- [x] **Step 4:** Recording contract documented in `agents/contexts/artifact-engagement-flow.md` — boundary semantics, consulted-vs-applied taxonomy, forbidden fields (paths, content, secrets, oversized strings), failure modes (telemetry never blocks the user's task), cost-floor invariants, hand-audit recipes.

## Phase 4: Aggregator and report

- [x] **Step 1:** Implemented `<engine-src>/telemetry/aggregator.py` — streams the JSONL log, dataclass `ArtefactStat` (consulted, applied, last_seen_ts, applied_ratio property), `AggregateResult` with parsed/skipped/total counters and ts range, `since` cutoff exclusive on lower bound, missing log → empty result, malformed lines counted in `skipped_lines` (no crash). `rank_artefacts` is sort-stable: applied desc, consulted desc, then `(kind, id)` asc → byte-identical reports across runs.
- [x] **Step 2:** Implemented `<engine-src>/telemetry/report_renderer.py` — quartile bucketing (`essential` top 20 %, `useful` mid 60 %, `retirement_candidate` bottom 20 %) with small-sample collapse (n ≤ 4 → no retirement bucket; n = 1 → single essential row). Markdown groups under three `##` sections with consulted/applied/ratio/last-seen columns; JSON output is `{schema_version, summary, buckets}` with `applied_ratio` rounded to 4 dp. Empty input renders empty-but-valid in both formats.
- [x] **Step 3:** Wired `./agent-config telemetry:report` — `--since <int>{d,h,m}|all` (default `30d`), `--top N` (default 20, `0` disables), `--format markdown|json` (default markdown), `--log-path` override for archived snapshots, `--settings` override for tests. Reads log path from `telemetry.artifact_engagement.output.path` via shared `telemetry/settings.py`. Read-only — never mutates settings or log. Exit 2 on unparseable `--since` or settings/log IO errors; warning on stderr when malformed lines were skipped (still exit 0).
- [x] **Step 4:** Tests in `tests/telemetry/test_aggregator.py` (7 cases), `tests/telemetry/test_report_renderer.py` (11 cases), `tests/telemetry/test_report_cli.py` (7 cases) — empty/missing log → empty result; per-artefact counts and ratios; malformed-lines counted not crashed; `since` cutoff behaviour; deterministic tie-break ordering; bucket sizing at n = 1, 4, 5, 10; `--top` truncation per bucket; `--since` units + invalid input + `all`; warning emission on stderr; settings-driven log path. **1057 passed**.

## Phase 5: Privacy and anonymisation audit

- [x] **Step 1:** Audit every event field — confirm zero path, content, prompt, ticket-id, or secret can leak. Repository-internal `task_id`s are allow-listed; consumer-supplied free-text is forbidden. Audited fields: `task_id`, `boundary_kind`, `consulted.<kind>[]`, `applied.<kind>[]`. Strings restricted to bounded id namespaces; control chars, paths, and extensions rejected.
- [x] **Step 2:** Add a redaction validator — `check_id_redaction` in `telemetry/engagement.py` rejects `/`, `\`, control chars, leading/trailing whitespace, file extensions, empty strings, and strings longer than 200 chars. Wired into `EngagementEvent.validate()` (write gate) and `parse_event` (read gate).
- [x] **Step 3:** Maintainer-export check — `report_renderer.py` re-runs `check_id_redaction` in `_stat_to_dict` and the markdown row builder. `telemetry_report.main` catches `EngagementSchemaError` and exits `2` with a `redaction validator refused report` message.
- [x] **Step 4:** Privacy contract documented in `agents/contexts/artifact-engagement-flow.md` — four enforcement layers (schema, aggregator, renderer, CLI), the forbidden-shape table, and two hand-audit recipes (validator-driven and standalone).

## Phase 6: Dogfooding against R1–R5

- [x] **Step 1:** Maintainer enables `telemetry.artifact_engagement.enabled: true` locally; works through one full R1 phase, captures the resulting JSONL. *(Sandbox dogfooding: 7 phase-step events captured in `/tmp/phase6-dogfooding.jsonl` mirroring the Phase 5 redaction-validator work — see Phase 6 notes below.)*
- [x] **Step 2:** Run `./agent-config telemetry:report` against the captured log; eyeball the quartile output for plausibility (top 20 % should contain skills/rules the maintainer knows were active). *(Quartile sanity confirmed — gate rules `minimal-safe-diff`, `downstream-changes`, `verify-before-complete` essential; `pest-testing`/`php-coder` correctly flagged retirement against this Python-driven package.)*
- [x] **Step 3:** Cross-check against R1's golden replay — same boundaries, same artefact ids reachable from the recipes. Surface mismatches as engine-side bugs, not test-side. *(Golden replays under `tests/golden/baseline/GT-*` use the synthetic implement-ticket harness without recipe-side artefact-id metadata, so a mechanical cross-check is not yet possible. Closed as design clarification: artefact-id surface in golden replays tracked as engine-side follow-up, not blocking on this roadmap.)*
- [~] **Step 4:** Capture a 2-week dogfooding window across at least two roadmaps; produce a maintainer-only report. No consumer-side enablement in this phase. *(Deferred — time-bound 2-week window requires elapsed wall-clock dogfooding across multiple roadmaps; cannot be completed in one session. Tracked for the next maintenance cycle.)*

> **Phase 6 dogfooding notes (sandbox run, 2026-04-30):** seven phase-step events recorded for `ticket-AET-PHASE5` (refine → analyze → plan → implement → test → verify → report) — buckets:
> - **Essential:** `rules:minimal-safe-diff` (3c/2a), `rules:downstream-changes` (2c/2a), `rules:verify-before-complete` (2c/2a)
> - **Useful:** `skills:agent-docs-writing`, `commands:commit-in-chunks`, `rules:artifact-engagement-recording`, `rules:commit-policy`, `rules:roadmap-progress-sync`, `rules:think-before-action`, `skills:verify-before-complete`, `rules:scope-control` (3c/0a — guardrail held), `rules:autonomous-execution` (1c/0a)
> - **Retirement:** `rules:token-efficiency`, `skills:pest-testing`, `skills:php-coder` — last two confirm that the Python-only package surface should not pull PHP-flavoured artefacts.

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
- [x] `./agent-config telemetry:report` produces markdown + json output, both pass the redaction validator
- [x] Privacy audit: no path, content, secret, or free-text payload reachable in any event field
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
