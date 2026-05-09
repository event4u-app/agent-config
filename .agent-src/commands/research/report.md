---
name: research:report
cluster: research
sub: report
description: "Summarise per-item JSON results from `/research:deep` into `report.md`. Agent renders directly + emits an optional `jq` template for deterministic regeneration. No Python runtime."
disable-model-invocation: true
skills: [deep-reading-analyst]
suggestion:
  eligible: true
  trigger_description: "summarise research results, build research report, render outline.yaml results"
  trigger_context: "user has finished `/research:deep` and wants a single markdown summary"
---

# /research:report

Reads the per-item JSON files emitted by
[`/research:deep`](deep.md), asks the user which fields to surface in
the table of contents, then writes `{topic_slug}/report.md` directly.
Optionally emits `{topic_slug}/report-template.jq` so the same report
can be regenerated deterministically without re-invoking the agent.

## Trigger

`/research:report`

## Workflow

### Step 1 — Locate results

Find `$PROJECT_ROOT/agents/research/*/outline.yaml` (single match) or
ask via numbered options. Read `topic`, `topic_slug`, and
`execution.output_dir`.

### Step 2 — Scan summary-field candidates

Read every `*.json` in `{output_dir}/`. Collect field names whose
values are short / numeric (e.g. `github_stars`,
`google_scholar_cites`, `swe_bench_score`, `user_scale`, `valuation`,
`release_date`). Filter:

- numeric scalars (int / float),
- short strings (≤ 40 chars), or
- ISO-8601 dates.

### Step 3 — Ask user (numbered options)

Per [`user-interaction`](../../rules/user-interaction.md) Iron Law,
offer numbered options for **TOC summary fields** drawn from the
candidate list. Allow multi-select (e.g., *"1, 3, 5"*) plus *"none"*.

### Step 4 — Render `report.md` directly

The agent itself reads each JSON + `fields.yaml` + the user's TOC
choices, then writes `{topic_slug}/report.md`. **No `generate_report.py`
script, no Python runtime.**

#### Required structure

1. **Title** — `# {topic} — Research Report`.
2. **TOC** — every item, anchor-linked, with the chosen summary fields
   inline. Example:
   `1. [GitHub Copilot](#github-copilot) — Stars: 10k · Score: 85%`.
3. **Detailed sections** — one `## {item.name}` per item, then
   `### {category}` per category from `fields.yaml`, then field
   key/value rows.

#### Rendering rules

| Rule | Behaviour |
|---|---|
| **JSON shape** | Support flat (`{"name": "…"}`) and nested (`{"basic_info": {"name": "…"}}`) layouts. Lookup order: top-level → category mapping → recursive walk. |
| **Category mapping** | Maintain a bidirectional alias map between `fields.yaml` category labels and JSON keys (e.g. `"Basic info" ↔ "basic_info"`). Use language-neutral keys, no hard-coded English/Chinese. |
| **List of dicts** | One row per dict, `key:value` pairs joined with ` \| `. |
| **Plain list** | Short → comma-joined; long (> 5 items) → bullet list. |
| **Nested dict** | Recurse; render with `;` between sibling keys or hard-break on long values. |
| **Long text** | Strings > 100 chars → wrap in a blockquote or insert `<br>`. |
| **Extra fields** | JSON keys not declared in `fields.yaml` → group under `### Other info`. Filter `_source_file`, `uncertain`, and category-container keys. |
| **`uncertain` array** | Render each entry on its own line under `### Uncertain fields`; never compress to a one-liner. |
| **Skip conditions** | Field value contains `[uncertain]` · field name in `uncertain` · value is `null` / empty string. |

### Step 5 — Optional `jq` template (deterministic regenerate)

Also emit `{topic_slug}/report-template.jq` capturing the user's TOC
choices + rendering rules as a `jq` program. Document the regenerate
command in the file's leading comment:

```text
# Regenerate report.md without re-invoking the agent:
#   jq -rsf report-template.jq results/*.json > report.md
# Requires: jq ≥ 1.6. Skip this file if jq is unavailable —
# `report.md` from step 4 is the canonical artefact.
```

The template is **best-effort**. Agents that cannot fully express
the rendering rules in `jq` may emit a stub with a `# TODO` comment
and a pointer back to step 4. The primary deliverable is `report.md`;
the `jq` template is a power-user convenience.

### Step 6 — Confirm

Print:

- Path to `report.md`.
- Whether `report-template.jq` was emitted.
- Item count · category count · skipped-uncertain count.

## Output paths

```text
$PROJECT_ROOT/agents/research/{topic_slug}/
  ├── report.md             # primary artefact (agent-rendered)
  └── report-template.jq    # optional, deterministic regen
```

## Portability notes

- **No Python runtime** — upstream's `generate_report.py` was a
  Python conversion script; this port shifts the transformation to
  the agent (primary) + a `jq` template (optional). `augment-portability`
  Iron Law upheld.
- **No `~/.claude/` paths** — every reference is rooted at
  `$PROJECT_ROOT/agents/research/`.
- **`jq` is optional** — agents skip the template gracefully and
  surface `⚠️ jq template not emitted` in the summary if generation
  fails or the dependency is missing.

## ADOPT citation

Adopted from [`Weizhena/Deep-Research-skills`](https://github.com/Weizhena/Deep-Research-skills)
@ commit `dc18cf4` · upstream file
`skills/research-en/research-report/SKILL.md` · MIT License.
Refactored: dropped the `generate_report.py` Python script (replaced
with agent-side rendering + optional `jq` template), kept the
multilingual category mapping + complex-value formatting rules,
re-anchored every path under `$PROJECT_ROOT/agents/research/`.
