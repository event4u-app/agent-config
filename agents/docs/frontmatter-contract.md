# Frontmatter contract — skills, rules, commands, personas

> Human-readable reference for the YAML frontmatter every agent artefact
> must declare. This is the **source doc** for the JSON-Schemas in
> `scripts/schemas/` — keep them in sync when either side changes.
>
> - **Scope:** skills, rules, commands, personas. Guidelines have no
>   frontmatter and are out of scope.
> - **Generated inventory:** run `python3 scripts/inventory_frontmatter.py`
>   to re-derive key counts, percentages, and enum values from the live
>   `.agent-src.uncompressed/` tree.
> - **Definition of required:** a key is *required* if ≥ 95 % of files in
>   the type declare it. Everything else is *optional*.

## skills — `.agent-src.uncompressed/skills/*/SKILL.md`

**Inventory:** 124 files. All three required keys present in 100 %.

### Required

| key | type | shape | notes |
|---|---|---|---|
| `name` | string | `^[a-z][a-z0-9-]*$` | Must match the parent directory name. |
| `description` | string | ≤ 200 chars, starts with `Use when` or `ONLY when` | Loaded into every system prompt; keep it a trigger, not a summary. |
| `source` | enum | `package` \| `project` | `project` exists for 3 project-owned skills; default is `package`. |

### Optional

| key | type | shape | notes |
|---|---|---|---|
| `status` | enum | `active` \| `deprecated` \| `superseded` | Defaults to `active` when absent (linter default). |
| `replaced_by` | string | `^[a-z][a-z0-9-]*$` | Required *when* `status` is `deprecated` or `superseded`. |
| `personas` | list\<string\> | `[id, id, …]` | Each entry must match a file in `personas/`. |
| `execution` | object | see below | Controlled-runtime block; omit entirely for manual/instructional skills. |

### `execution` sub-schema (optional, 22/124 skills)

| key | type | enum / shape | notes |
|---|---|---|---|
| `type` | enum | `manual` \| `assisted` \| `automated` | Required *inside* `execution`. |
| `handler` | enum | `none` \| `shell` \| `php` \| `node` \| `internal` | Required when `type = automated` (must not be `none`). |
| `timeout_seconds` | integer | `> 0` | Optional; seen as `60`, `120`. |
| `safety_mode` | enum | `strict` | Required when `type = automated`. |
| `allowed_tools` | list\<string\> | `["github", …]` or `[]` | Required when `type = automated`. |
| `command` | list\<string\> | argv form, non-empty | Optional; enables runtime execution of the skill. |

### Example (happy path)

```yaml
name: adversarial-review
description: "ONLY when user explicitly requests adversarial review…"
source: package
```

## rules — `.agent-src.uncompressed/rules/*.md`

**Inventory:** 46 files.

### Required

| key | type | shape | notes |
|---|---|---|---|
| `description` | string | ≤ 200 chars recommended | For `type: auto`, this is the trigger matcher. |
| `source` | enum | `package` \| `project` | 43/43 currently `package`. |
| `type` | enum | `always` \| `auto` | `always` = loaded every turn; `auto` = matched by description. |

### Optional

| key | type | shape | notes |
|---|---|---|---|
| `alwaysApply` | boolean | `true` \| `false` | Sidecar for Cursor/Cline. `true` ↔ `type: always` by convention; redundant but accepted. |

### Cross-check with linter

- `type` enum is authoritative — the linter reads `type`, not `alwaysApply`.
- `type: auto` with empty `description` → linter error (`auto_missing_description`).
- `type: always` with ≥ 2 topic-specific keywords in description → linter
  `info` hint to reconsider as `auto`.

### Example

```yaml
type: auto
source: package
description: "Architecture rules for creating new files, classes, …"
```

## commands — `.agent-src.uncompressed/commands/*.md`

**Inventory:** 69 files.

### Required

| key | type | shape | notes |
|---|---|---|---|
| `name` | string | `^[a-z][a-z0-9-]*$` | Must match filename stem. |
| `description` | string | short, single line | 66/67 present; the one exception (`feature-dev.md`) is a known gap. |
| `disable-model-invocation` | boolean | `true` | Always `true` — commands are user-invoked only. |

### Optional

| key | type | shape | notes |
|---|---|---|---|
| `skills` | list\<string\> | `[skill-id, …]` | Skills this command delegates to; 63/67 declare it. Empty list `[]` allowed. |

### Example

```yaml
name: create-pr
description: Create a GitHub PR with structured description from Jira ticket and code changes
disable-model-invocation: true
skills: [git-workflow, create-pr-description]
```

## personas — `.agent-src.uncompressed/personas/*.md`

**Inventory:** 7 files (all required keys present in 100 %).

### Required

| key | type | shape | notes |
|---|---|---|---|
| `id` | string | `^[a-z][a-z0-9-]*$`, matches filename stem | Enforced by the linter (`id_filename_mismatch`). |
| `role` | string | human-readable | e.g. `Critical Challenger`. |
| `description` | string | ≤ 160 chars (linter warns above) | Starts with a voice noun (`The voice of …`). |
| `tier` | enum | `core` \| `specialist` | Drives the size budget (core ≤ 120 lines, specialist ≤ 80). |
| `mode` | enum | `developer` \| `reviewer` \| `tester` \| `product-owner` \| `incident` \| `planner` | Observed values: `developer`, `reviewer`, `product-owner`, `tester`, `planner`. Template also lists `incident`. |
| `version` | string | semver-ish, quoted (`"1.0"`) | Bump on breaking changes. |
| `source` | enum | `package` \| `project` | Same semantics as skills/rules. |

### Example

```yaml
id: critical-challenger
role: Critical Challenger
description: "The voice that refuses easy answers and drags hidden complexity back into the open."
tier: core
mode: reviewer
version: "1.0"
source: package
```

## Regenerating the inventory

```bash
python3 scripts/inventory_frontmatter.py > /tmp/frontmatter-inventory.md
```

Compare `/tmp/frontmatter-inventory.md` against this doc. A mismatch means
the contract has drifted and one of the two needs updating — typically
this doc, not the generator.
