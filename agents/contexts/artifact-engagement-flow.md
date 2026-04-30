# Artifact Engagement — Flow & Recording Contract

> Cross-cutting reference for the artifact-engagement telemetry system
> shipped under
> [`road-to-artifact-engagement-telemetry.md`](../roadmaps/road-to-artifact-engagement-telemetry.md).
> Phase 1 + 2 ship the schema, CLI, and engine. Phase 3 ships the
> agent-side hooks (this document).
>
> - **Created:** 2026-04-30
> - **Status:** Phase 5 — schema, engine, recording, aggregator, renderer,
>   and redaction validator are in place. Phase 6 (dogfooding) next.

This document is the stable reference for **what gets recorded, when, and
under which constraints**. The roadmap tracks phased delivery; the rule
([`artifact-engagement-recording`](../../.agent-src.uncompressed/rules/artifact-engagement-recording.md))
tells the agent when to fire; this doc explains the contract every
recording must honour.

## What this is

A measurement layer that tells maintainers which **skills, rules,
commands, guidelines and personas** the agent actually consults and
applies during a `/implement-ticket` or `/work` run. The output (a local
JSONL log) becomes the input to the Phase 4 aggregator + report renderer.

## What this is *not*

- Token-spend tracking — handled separately by the cost-profile system.
- Tool-call telemetry — out of scope.
- A retirement decision-maker — Phase 4's report surfaces signal; humans
  decide what to retire.
- A consumer-facing analytics product — local-only, opt-in, never
  uploaded.

## Threat model in one paragraph

Engagement data is **observation**, not delivery. A missed event is
cheap. A leaked prompt, a leaked path, or a leaked secret is not. Every
field in the schema is **id-only**: no free-text, no payloads, no paths.
The CLI rejects oversized strings on the input boundary; the agent must
not even attempt to write content.

## When the agent records

Two granularities, one per task or one per phase-step:

```
refine → memory → analyze → plan → implement → test → verify → report
                          ↑
            granularity: phase-step → 1 record per arrow crossed
            granularity: task        → 1 record on terminal state only
```

The setting lives at `telemetry.artifact_engagement.granularity` in
`.agent-settings.yml`. Default `task`. Both flows
([`/implement-ticket`](../../.agent-src.uncompressed/commands/implement-ticket.md)
and [`/work`](../../.agent-src.uncompressed/commands/work.md)) use the
same eight-step contract from
[`implement-ticket-flow.md`](implement-ticket-flow.md).

### Boundary semantics

A boundary is **closed** when:

- The dispatcher returns `SUCCESS`, `BLOCKED`, or `PARTIAL` for the
  current step (phase-step granularity), or
- The full eight-step flow reaches a terminal state (task granularity).

A boundary is **never** closed by:

- An error inside the agent's tool call (the user's task is paramount;
  see "failure modes" below).
- A model-side exception or timeout.
- Settings reload mid-flow — settings are read once per task and cached.

Within a single boundary, repeated `consulted` / `applied` mentions of
the same `<kind>:<id>` pair **dedupe**. Reading `php-coder` three times
records once.

## What counts as consulted vs applied

| Term | Meaning | Examples |
|---|---|---|
| **`consulted`** | The agent **read** the artefact this boundary | Opened `SKILL.md`, scanned a rule body, looked at a guideline, checked persona contract, cited the artefact id in reasoning |
| **`applied`** | The artefact **influenced the output** this boundary | A skill's procedure produced the code; a rule's gate halted a flow; a guideline's pattern shaped the diff |

`applied` is a strict subset of `consulted`. When in doubt → record as
`consulted` only. Over-recording `applied` inflates the engagement
signal and defeats the whole point of the system.

## Forbidden — what NEVER goes into a record

The privacy contract is enforced at **four** layers — schema (write
gate), aggregator (read gate via `parse_event`), renderer (export gate),
and CLI (surface gate). Each layer rejects the same set of shapes;
defense in depth means a leak has to bypass all four to escape:

- File paths — any string containing `/`, `\`, or a control character.
- File extensions — trailing `.md`, `.py`, `.json`, `.yaml`, `.yml`,
  `.php`, `.ts`, `.js`, etc. Detected by
  `re.compile(r"\.[a-z0-9]{1,10}$", re.IGNORECASE)` in
  `telemetry.engagement.check_id_redaction`.
- Source code, prompts, ticket bodies, AC text, comments.
- Branch names, commit shas, PR numbers, URLs.
- Secrets, env vars, credentials, customer data.
- Free-text strings longer than 200 chars.
- Leading or trailing whitespace, tabs, newlines.
- Empty strings.

The id namespaces are stable and bounded:

| Kind | Source | Example |
|---|---|---|
| `skills` | `.agent-src/skills/<id>/SKILL.md` | `php-coder`, `eloquent` |
| `rules` | `.agent-src/rules/<id>.md` | `scope-control`, `language-and-tone` |
| `commands` | `.agent-src/commands/<id>.md` | `commit`, `create-pr` |
| `guidelines` | `.agent-src/guidelines/<path>/<id>.md` | `agent-interaction-and-decision-quality` |
| `personas` | `.agent-src/personas/<id>.md` | `qa`, `senior-engineer` |

`task_id` is the ticket key (`PROJ-123`) for `/implement-ticket` or a
short opaque slug derived from the prompt for `/work`. Branch names,
file paths, and free-text titles are forbidden in `task_id` — see the
schema's `EngagementSchemaError` cases.

### The four enforcement layers

1. **Schema (write gate)** — `EngagementEvent.validate()` in
   `telemetry/engagement.py` runs `check_id_redaction` over `task_id`
   and every `consulted` / `applied` artefact id. The CLI exits `1`
   when this fires; nothing reaches the JSONL.
2. **Aggregator (read gate)** — `aggregator._iter_events` calls
   `parse_event`, which re-runs the same validator. A pre-validator
   line (e.g. an archived snapshot from before the validator landed)
   is **skipped** and counted in `result.skipped_lines`. The renderer
   never sees it.
3. **Renderer (export gate)** — `_stat_to_dict` (JSON) and the
   markdown row builder both call `check_id_redaction` again before
   emitting any id. If a caller bypasses `parse_event` and hand-builds
   an `AggregateResult`, the renderer raises `EngagementSchemaError`
   instead of producing the row.
4. **CLI (surface gate)** — `telemetry_report.main` catches
   `EngagementSchemaError` from the renderer and exits `2` with a
   `redaction validator refused report` message. A bad row is never
   written to stdout, never piped to a teammate.

A leak would have to defeat all four layers — write the JSONL outside
the CLI, parse it outside `parse_event`, render it outside the
project's renderer, and ship it to a teammate without the CLI in the
loop. The contract treats that as out of scope.

## How the agent records

```bash
./agent-config telemetry:record \
  --task-id "$TASK_ID" \
  --boundary task \
  --consulted skills:php-coder \
  --consulted rules:scope-control \
  --applied skills:php-coder
```

Exit codes (the agent must read these):

| Exit | Meaning | Action |
|---|---|---|
| `0` | Recorded, or telemetry disabled (silent no-op) | Continue |
| `1` | Schema validation failed | Log internally, **continue** the user's task — do not halt |
| `2` | IO failure (lock contention, disk full) | Same — observation, not delivery |

Schema-rejection messages go to stderr; the agent reads them once and
moves on. The user's task always takes priority.

## Failure modes — DO NOT block the user's task

- Telemetry is **observation**, not a delivery requirement.
- A missing event is cheap; a halted task because telemetry can't write
  is a critical failure mode that defeats the whole opt-in property.
- The only error the agent surfaces to the user: when the user asked
  for telemetry (`telemetry:status` confirms enabled) but no event
  reached the log over a full task — that is a real bug.

## Cost floor — what "default-off" means

When `telemetry.artifact_engagement.enabled: false` (or section absent):

- The rule is `auto` and the description does not match a typical
  conversation; the rule never loads. Cost floor: 0 tokens.
- The CLI exits `0` with no output and no file IO.
- The engine (`work_engine.dispatcher`, `work_engine.cli`) does not
  import any `telemetry.*` module — locked by
  [`tests/telemetry/test_cost_floor.py`](../../tests/telemetry/test_cost_floor.py).
- On cloud surfaces (Claude.ai Web, Skills API), the rule's
  `cloud_safe: noop` marker keeps the rule inert regardless of settings.

## Where the JSONL lives

Default path: `.agent-engagement.jsonl` in the consumer repo root.
Configurable via `telemetry.artifact_engagement.output.path`. The path
is **always** added to the consumer's `.gitignore` block by the
installer (Phase 1 wiring). Verify locally:

```
$ grep agent-engagement .gitignore
.agent-engagement.jsonl
```

## How to audit a JSONL by hand

The fastest path is the project's own validator — it enforces every
rule listed above:

```bash
# Validate every line against the schema + redaction floor
python3 -c '
import pathlib, sys
sys.path.insert(0, ".agent-src.uncompressed/templates/scripts")
from telemetry.engagement import EngagementSchemaError, parse_event
log = pathlib.Path(".agent-engagement.jsonl")
ok = bad = 0
for i, line in enumerate(log.read_text().splitlines(), 1):
    if not line.strip():
        continue
    try:
        parse_event(line + "\n")
        ok += 1
    except EngagementSchemaError as e:
        bad += 1
        print(f"line {i}: {e}", file=sys.stderr)
print(f"{ok} valid, {bad} rejected")
'

# A bad-line spot-check that does not depend on the validator
python3 -c '
import json, pathlib, re
forbidden = re.compile(r"[/\\\\]|\.[a-z0-9]{1,10}$", re.IGNORECASE)
for line in pathlib.Path(".agent-engagement.jsonl").read_text().splitlines():
    if not line.strip():
        continue
    obj = json.loads(line)
    for kind in ("consulted", "applied"):
        for ids in obj.get(kind, {}).values():
            for v in ids:
                if forbidden.search(v) or len(v) > 200:
                    print("LEAK:", v)
'
```

Either recipe is safe to run on a co-worker's archived JSONL — neither
writes anything, both surface the same shapes the four enforcement
layers reject.

## See also

- [`road-to-artifact-engagement-telemetry`](../roadmaps/road-to-artifact-engagement-telemetry.md) — phased delivery
- [`artifact-engagement-recording`](../../.agent-src.uncompressed/rules/artifact-engagement-recording.md) — agent-side trigger
- [`implement-ticket-flow`](implement-ticket-flow.md) — the eight-step contract this rule observes
- [`scripts/telemetry/`](../../.agent-src.uncompressed/templates/scripts/telemetry/) — schema, boundary session, settings reader
- [`tests/telemetry/`](../../tests/telemetry/) — contract enforcement (104 cases through Phase 5: schema, settings, aggregator, renderer, CLI, cost-floor, redaction)
