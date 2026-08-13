---
model_tier: medium
name: design-system-import
pack: engineering-base
tier: 2
visibility: internal
cluster: design-system
sub: import
skills: [design-system-capture]
description: Run an extraction tool's output through the three-lane adapter into the design-system.json contract, then hand it to the per-field confirmation import.
argument-hint: "<file>"
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /cluster:sub name; not independently suggested (surface-consolidation)."
workspaces:
  - engineering
packs:
  - frontend-design
---

# /design-system:import

Transform an extracted design system into the `design-system.json` contract,
then import it per field. Args: `<file>`.

```bash
npx tsx node_modules/@event4u/agent-config/src/scripts/design_system_import.ts <file> \
    [--lane native|dtcg|dembrandt] \
    [--source-kind url|repo|dir --source-ref <ref>] [--captured-at <ISO>] \
    [--format json|summary]
```

The lane is detected from the file's own shape; `--lane` only forces which
mapper runs and never reshapes the input. Lane behaviour, the documented
producers, and the never-force-a-lane degradation are specified in
[`design-system-json.md`](../../skills/design-system-capture/references/design-system-json.md)
§ Extractor compatibility.

## The easy path, in two lines

1. Connect an extractor once — e.g.
   `claude mcp add --transport stdio dembrandt -- npx -y --package dembrandt dembrandt-mcp`.
2. Run `/design-system:import` over its output.

No extractor available? Skip step 1 and use
[`/design-system:generate`](../generate/command.md) from the corpus instead, or
[`/design-system:capture`](../capture/command.md) for this repo.

## Then hand it over

Pass the result to [`design-system-capture`](../../skills/design-system-capture/SKILL.md)'s
import step. Do not write `DESIGN.md` from here.

## Rules

- **Provenance is mandatory.** A file with no `source` and no `--source-ref` is
  rejected — you cannot confirm what you cannot trace. Supplying it by flag is
  recorded as caller-asserted, not extracted.
- **The artifact is observed, not authoritative.** Every field is confirmed by
  the human; a value conflicting with a registered brand token is flagged, never
  auto-applied.
- **The adapter is offline.** It reads a file and writes the contract shape — it
  never fetches, crawls, or launches a browser.
