---
name: research
cluster: research
description: "Preliminary research scaffolder — pick objects, define fields, emit `outline.yaml` + `fields.yaml` for downstream deep research. Use for surveys, benchmarks, tech selection, competitive scans."
disable-model-invocation: true
skills: [project-analyzer, deep-reading-analyst]
suggestion:
  eligible: true
  trigger_description: "research a topic, scan competitors, benchmark X, do a tech-selection survey"
  trigger_context: "user names a research topic and wants a structured scaffold (objects + fields), not an immediate answer"
---

# /research

Entry point for **preliminary research**: pick the objects to study, name
the fields to fill, and emit a YAML scaffold that a downstream deep-research
run will populate. Use this when the user names a topic and wants a
structured plan, not an immediate answer.

Routes thinking-framework support to
[`deep-reading-analyst`](../skills/deep-reading-analyst/SKILL.md) (SCQA
for narrative structure, mental-models lens for object selection).

## Trigger

`/research <topic>`

## Workflow

### Step 1 — Initial framework from model knowledge

Generate, from the model's existing knowledge, the candidate object list
and field framework for the topic:

- **Objects / items** — entities, products, methods, datasets to compare.
- **Field framework** — dimensions to fill per item (basic info, technical
  features, evidence, etc.).

Output `{step1_output}` and confirm with the user via numbered options
(per [`user-interaction`](../rules/user-interaction.md) Iron Law):

1. Add or remove items?
2. Field framework adequate?

### Step 2 — Web-search supplement

Ask one numbered question for the time range (e.g., last 6 months,
since 2024, unlimited). Use the agent's native web-search tool — do
**not** spawn a separate `web-search-agent` persona.

Search prompt template (variables in `{xxx}` only — do not modify
structure):

```text
Research topic: {topic}
Current date: {YYYY-MM-DD}
Time range: {time_range}

Existing framework:
{step1_output}

Goals:
1. Verify existing items are not missing important objects.
2. Supplement items based on missing objects.
3. Continue searching for {topic}-related items within {time_range}.
4. Supplement new fields where helpful.

Output (return inline, do not write files):

### Supplementary items
- item_name: brief explanation (why it should be added)

### Recommended supplementary fields
- field_name: field description (why this dimension is needed)

### Sources
- [Source 1](url)
- [Source 2](url)
```

### Step 3 — Existing fields merge

Ask via numbered options whether the user has an existing field-definition
file. If yes, read the file and merge into the framework before Step 4.

### Step 4 — Generate outline (two files)

Merge `{step1_output}`, `{step2_output}`, and any user-provided fields,
then write two files into `$PROJECT_ROOT/agents/research/{topic_slug}/`:

**`outline.yaml`** (items + execution config):

- `topic`: research topic
- `items`: research-objects list
- `execution`: `batch_size`, `items_per_agent`, `output_dir`
  (defaults: `./results`; confirm with the user via numbered options)

**`fields.yaml`** (field definitions):

- field categories + definitions
- per field: `name`, `description`, `detail_level`
  (`brief` → `moderate` → `detailed`)
- `uncertain`: list reserved for the deep-research phase

YAML structure validation: see
[`research-schema`](../contexts/contracts/research-schema.md) for the
project-local JSON-Schema reference (no runtime Python validator; the
agent reads the schema and self-validates).

### Step 5 — Output + confirm

Create `agents/research/{topic_slug}/` if absent, write both YAML files,
and present a summary block to the user:

- Topic + slug.
- Item count + field count.
- Path to the two files.
- Next-step pointer: deep-research orchestration is a follow-up port;
  use the YAML scaffold as input when that lands.

## Output paths

```text
$PROJECT_ROOT/agents/research/{topic_slug}/
  ├── outline.yaml    # items list + execution config
  └── fields.yaml     # field definitions
```

## Out of scope (Phase 2)

`/research-deep`, `/research-add-items`, `/research-add-fields`, and the
Python `validate_json.py` validator are **not** ported in Phase 1 — they
are queued as follow-up cluster sub-commands.

## ADOPT citation

Adopted from [`Weizhena/Deep-Research-skills`](https://github.com/Weizhena/Deep-Research-skills)
@ commit `dc18cf4` · upstream file research/SKILL.md inside skills/research-en/ · MIT License.
Refactored: dropped `web-search-agent` persona (portability), dropped
Pydantic validator (replaced with JSON-Schema reference), repathed
`./` → `$PROJECT_ROOT/agents/research/`, deferred `/research-deep` +
`/research-add-*` to Phase 2.
