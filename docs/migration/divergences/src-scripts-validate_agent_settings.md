# Divergence: validate_agent_settings

## Script

- Python: `src/scripts/validate_agent_settings.py`
- TypeScript: `src/scripts/validate_agent_settings.ts`

## Symptom

Only the **error-message prose** of a schema violation can differ. The exit
code, the GitHub `::error file=…::<loc>:` location prefix, the violation
count, the summary line, and the clean-pass line are byte-identical.

- **Python output (violation):** `::error file=…::rule_loading_tier: 'lean' is not one of ['minimal', 'balanced', 'full', 'custom']`
  — the trailing clause is produced verbatim by the `jsonschema` library and
  is Python-version-dependent.
- **TS output (violation):** same `::error file=…::rule_loading_tier:` prefix
  and field path; the enum/type clause is reproduced by a minimal Draft-07
  validator (`_iter_errors`) and may differ in exact wording from a given
  `jsonschema` release.
- Affected channel(s): stdout (only the prose tail of a violation line).

## Root cause

The Python script delegates message text to `jsonschema.Draft7Validator`,
whose `ValidationError.message` wording is not a stable contract (it has
changed across `jsonschema` releases). The package ships no `ajv`/jsonschema
dependency for the TS side and `package.json` is frozen for this wave, so the
twin implements the exact constraint subset the shared schema uses (`type`
object/string, string `enum`, `properties`, permissive `additionalProperties:
true`) and approximates the message text. Per ADR-090 §4 the parity contract
for schema-validation findings is **exit code + flagged field-paths**, not
byte-exact jsonschema prose.

## Verdict

`formatting-only` — the constraint set, the violating field path, the error
location prefix, the violation count, and both summary lines match exactly;
only the human-readable enum/type clause may differ, with no semantic or
consumer impact (CI greps the `::error file=…::<loc>:` location, not the tail).

## Evidence

- `tests/scripts/validate_agent_settings.test.ts` asserts: every valid
  `rule_loading_tier` accepted; an out-of-enum value rejected **at the
  `['rule_loading_tier']` path** with a message naming the allowed values;
  the legacy `cost_profile` key tolerated (shipped reality); nested enums
  (`memory.cadence`, `model.auto_switch`, `worktrees.mode`) enforced at the
  correct paths.
- Golden parity: the same test runs `python3 validate_agent_settings.py` vs
  `tsx validate_agent_settings.ts` on the real repo and asserts stdout, stderr,
  and exit code are byte-identical (the clean repo never triggers a violation
  line, so the only golden-parity surface is the OK summary — byte-identical).

## Approval

- Reviewer: <pending — porting subagent, ADR-090 Phase 4 / Wave 4c>
- Date: 2026-06-11
