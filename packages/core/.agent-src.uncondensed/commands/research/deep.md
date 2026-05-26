---
name: research:deep
tier: 2
cluster: research
sub: deep
description: "Read `outline.yaml`, research each item in batches, write per-item JSON validated against the project-local research-schema. No Python runtime, no `~/.claude/` paths."
disable-model-invocation: true
skills: [deep-reading-analyst]
suggestion:
  eligible: true
  trigger_description: "deep research, populate the research scaffold, fill outline.yaml items"
  trigger_context: "user has run `/research <topic>` and now wants per-item depth"
workspaces:
  - agent-config-maintainer
packs:
  - meta
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---

# /research:deep

Reads the `outline.yaml` produced by [`/research`](../research.md), launches
batched per-item research, and writes one JSON per item under
`{output_dir}/`. Each JSON is self-validated against the
[`research-schema`](../../contexts/contracts/research-schema.md)
contract before write — **no `validate_json.py` script, no Python
runtime, no `~/.claude/` paths**.

## Trigger

`/research:deep [--batch-confirm=each|once|auto]`

`--batch-confirm` controls user gating between batches:

- `each` (default) — confirm before every batch.
- `once` — confirm only the first batch, then run the rest.
- `auto` — no confirmation, run all batches (only honoured under
  explicit `/roadmap process-full` autonomy).

## Workflow

### Step 1 — Auto-locate outline

Search `$PROJECT_ROOT/agents/research/*/outline.yaml` (single match) or
ask via numbered options if multiple `outline.yaml` files exist. Read:

- `topic`, `topic_slug`, `items[]`, `execution.batch_size`,
  `execution.items_per_agent`, `execution.output_dir` (default
  `./results` relative to the topic dir).

### Step 2 — Resume check

Scan `{output_dir}/` for `*.json` files; mark items whose
`{slug(item.name)}.json` exists as **complete**. Slugify by lowercasing,
replacing whitespace with `_`, and stripping characters outside
`[a-z0-9_-]`.

### Step 3 — Batch execution

Group remaining items by `batch_size` (each batch holds
`batch_size × items_per_agent` items at most). For each batch:

1. Show the batch summary: `[N/M] items: a, b, c …`.
2. Apply the `--batch-confirm` policy (default `each` — wait for the
   user; `once` after the first; `auto` skips).
3. For every item in the batch, run the per-item research using the
   agent's **native web-search** (no `web-search-agent` persona).

#### Per-item prompt template

Variables in `{xxx}` only — **do not modify structure or wording**.

```text
## Task
Research {item_related_info}, output structured JSON to {output_path}.

## Field definitions
Read {fields_path} to get all field definitions.

## Output requirements
1. Output JSON whose top-level keys map to the categories in
   `fields.yaml` (or to the `{slug(category)}` form — both are
   accepted by `/research:report`).
2. Mark uncertain field values with the literal string `[uncertain]`.
3. Append an `uncertain` array at the end of the JSON listing all
   field names whose value contains `[uncertain]` or could not be
   sourced.
4. All field values in English.

## Output path
{output_path}

## Validation (no Python, no host paths)
Self-validate the JSON against
`<package>/.agent-src.uncondensed/contexts/contracts/research-schema.md`
in memory before writing. The well-formedness escape hatch is
`jq -e '.[]' {output_path}` — agent runs it after write and re-tries
once on failure. Task is complete only after both checks pass.
```

#### Variable bindings

| Variable | Source |
|---|---|
| `{topic}` | `outline.yaml#/topic` |
| `{item_related_info}` | the item's full YAML block (`name`, `category`, `description`, etc.) |
| `{output_dir}` | `outline.yaml#/execution/output_dir` (default `./results`) |
| `{fields_path}` | `$PROJECT_ROOT/agents/research/{topic_slug}/fields.yaml` |
| `{output_path}` | `{output_dir}/{slug(item.name)}.json` |

### Step 4 — Wait and monitor

Wait for the current batch to finish (all per-item JSON files written
+ validated). Display per-item status (`✅ done`, `⚠️ uncertain`,
`❌ failed`) before moving on.

### Step 5 — Summary report

After all batches complete, print:

- Total items · completed · uncertain · failed.
- Output directory.
- Pointer to `/research:report` for the next phase.

## Output paths

```text
$PROJECT_ROOT/agents/research/{topic_slug}/
  ├── outline.yaml
  ├── fields.yaml
  └── {output_dir}/
        ├── {slug(item_a)}.json
        ├── {slug(item_b)}.json
        └── …
```

## Portability notes

- **No Python runtime** — validator dropped at adoption, replaced by
  the in-memory JSON-Schema check + `jq -e` escape hatch (`jq` is
  optional; agents skip it gracefully if not installed and report
  `⚠️ jq missing — well-formedness not verified`).
- **No `~/.claude/` paths** — every reference is rooted at
  `$PROJECT_ROOT/agents/research/`.
- **No `web-search-agent` persona** — uses the host agent's native
  web-search tool.

## ADOPT citation

Adopted from [`Weizhena/Deep-Research-skills`](https://github.com/Weizhena/Deep-Research-skills)
`@dc18cf4:skills/research-en/research-deep/SKILL.md` · MIT License.
Refactored:
dropped Pydantic validator + `~/.claude/` paths + `web-search-agent`
persona, added `--batch-confirm` flag, kept the per-item prompt
structure verbatim except for the validation block.
