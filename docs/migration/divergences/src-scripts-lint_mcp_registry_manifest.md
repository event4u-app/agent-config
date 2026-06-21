# Divergence: lint_mcp_registry_manifest

## Script

- Python: `src/scripts/lint_mcp_registry_manifest.py`
- TypeScript: `src/scripts/lint_mcp_registry_manifest.ts`

## Symptom

**Conditional, latent divergence — not reached on the real repo.** Golden
parity (python3 vs tsx, no-arg and `--quiet`) is byte-identical today, because
`dist/mcp/` is absent in this worktree, so both versions short-circuit on the
first artefact check and emit:

- stderr: `❌  missing: dist/mcp/registry-manifest.json`
- exit: 1

The only branch where the two versions *would* differ is the schema-validation
failure message, which fires solely on a **structurally invalid** manifest
(after all four `dist/mcp/*` artefacts exist):

- **Python output:** `❌  schema validation: <jsonschema e.message> at <list(e.absolute_path)>`
  — wording produced by `jsonschema.Draft202012Validator`.
- **TS output:** `❌  schema validation: <subset-validator message> at [<path…>]`
  — wording produced by the hand-rolled Draft-2020-12 subset validator in the
  TS port.
- Affected channel(s): stderr (only on an invalid manifest)

The stable prefix `schema validation: ` and the surrounding control flow
(which artefact is checked, in what order, the exit code 1, the `❌  `
glyph + two-space prefix) are identical. Only the embedded
validator-specific error string and the `at [...]` path rendering can differ.

## Root cause

Python uses `jsonschema.Draft202012Validator(schema).validate(manifest)` and
formats `f"schema validation: {e.message} at {list(e.absolute_path)}"`. The TS
runtime has only `ajv` v6 (Draft-07) available — it cannot evaluate a
Draft-2020-12 schema with `jsonschema`-identical diagnostics. Following the
established Wave-4b pattern (`src/scripts/lint_discovery_manifest.ts`), the TS
port ships a faithful Draft-2020-12 **subset** validator that ACCEPTS every
valid manifest (the golden path) but renders rejection messages in its own
wording. Matching `jsonschema`'s per-keyword English message text + Python
`repr` of the instance + `list(absolute_path)` rendering byte-for-byte is out
of scope and provides no consumer value (the manifest is generated, so an
invalid manifest is a build bug surfaced equally by either version).

## Verdict

`intentional-improvement` — both behaviors reject an invalid manifest with a
non-zero exit and a `schema validation: …` stderr line; the TS wording is a
deliberate, documented substitute for the unavailable Draft-2020-12
`jsonschema` diagnostics. The accept/reject decision (the consumer-relevant
behavior) is preserved.

## Evidence

- `tests/scripts/lint_mcp_registry_manifest.test.ts`:
  - the behavioural-spec block asserts the subset validator ACCEPTS a fully
    valid manifest and REJECTS each malformed shape (wrong `version` const,
    missing required key, unknown additional property, bad `status` enum,
    `< minItems` registries) — i.e. the accept/reject contract holds.
  - the golden-parity block asserts byte-identical stdout + stderr + exit on
    the real repo for both the no-arg and `--quiet` invocations (the
    `missing:` branch), proving no actual mismatch ships today.

## Approval

- Reviewer: <pending>
- Date: <pending>
