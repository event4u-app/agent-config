# research-schema

Project-local JSON-Schema reference for the
[`/research`](../../commands/research.md) command's two output files —
`outline.yaml` and `fields.yaml`. The agent reads the schemas below and
self-validates the YAML before writing; **no runtime Python validator
ships in this package** — the Pydantic validator from upstream was
dropped at adoption time and replaced with this reference contract.

## `outline.yaml` schema

```yaml
# JSON-Schema (YAML form) — outline.yaml
type: object
required: [topic, items, execution]
properties:
  topic:
    type: string
    description: Research topic, free-form.
  topic_slug:
    type: string
    pattern: "^[a-z0-9][a-z0-9-]*$"
    description: Lower-kebab slug used as the directory name.
  items:
    type: array
    minItems: 1
    items:
      type: object
      required: [name]
      properties:
        name: { type: string }
        explanation: { type: string }
        source: { type: string, format: uri }
  execution:
    type: object
    required: [batch_size, items_per_agent, output_dir]
    properties:
      batch_size:
        type: integer
        minimum: 1
        description: Number of parallel agents in the deep-research phase.
      items_per_agent:
        type: integer
        minimum: 1
        description: Items each agent processes per batch.
      output_dir:
        type: string
        default: "./results"
        description: Path (relative to the topic dir) for deep-research output.
```

## `fields.yaml` schema

```yaml
# JSON-Schema (YAML form) — fields.yaml
type: object
required: [categories]
properties:
  categories:
    type: array
    minItems: 1
    items:
      type: object
      required: [name, fields]
      properties:
        name:
          type: string
          description: Category label (e.g., "Basic info", "Technical features").
        fields:
          type: array
          minItems: 1
          items:
            type: object
            required: [name, description, detail_level]
            properties:
              name: { type: string }
              description: { type: string }
              detail_level:
                type: string
                enum: [brief, moderate, detailed]
  uncertain:
    type: array
    description: Reserved field, populated during deep-research phase.
    items:
      type: object
      properties:
        item: { type: string }
        field: { type: string }
        reason: { type: string }
```

## Self-validation procedure

1. Generate the YAML in memory.
2. Walk the schema above against the candidate object.
3. On mismatch, fix the YAML before writing — do not write invalid
   files and rely on a downstream check.
4. Validation diagnostics surface to the user inline (file path,
   field path, expected vs actual). No external dependencies.

## Why no Pydantic / runtime validator

Upstream (`Weizhena/Deep-Research-skills`) shipped a `validate_json.py`
Pydantic-based validator that assumed `~/.claude/` paths and a Python
runtime in the consumer environment. Both are
`augment-portability` violations for this package (zero-runtime-Python
goal, host-agnostic distribution). The schema reference above lets the
agent validate by reading; consumers needing programmatic validation
can pipe the YAML through any JSON-Schema validator they prefer
(`ajv`, `python-jsonschema`, `check-jsonschema`, etc.).

## Cross-references

- [`/research`](../../commands/research.md) — the command this schema
  validates.
- Future `/research:deep` and `/research:report` sub-commands will
  reference this same schema once ported.
