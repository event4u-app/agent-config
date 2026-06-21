# Divergence: <script name>

> Copy this file to `<script-path-slug>.md` (e.g. `src/scripts/foo/bar.py` →
> `src-scripts-foo-bar.md`) and fill every section. A doc without an Approval
> line is not a documented divergence — CI treats the mismatch as a failure.

## Script

Path of the migrated script (Python original and TS port):

- Python: `src/scripts/<path>.py`
- TypeScript: `src/scripts/<path>.ts`

## Symptom

What differs, exactly. Quote or attach the mismatching output:

- **Python output:** <verbatim excerpt or fixture reference>
- **TS output:** <verbatim excerpt or fixture reference>
- Affected channel(s): stdout | stderr | exit code | written file(s)

## Root cause

Why the outputs differ (library behavior, Python bug fixed in the port,
formatting difference, encoding, ordering, ...). Cite the relevant code
lines in both versions.

## Verdict

Pick exactly one:

- `bug-fix-in-TS` — the Python behavior was wrong; the TS port is correct.
- `intentional-improvement` — both behaviors are defensible; the TS behavior
  is a deliberate, documented improvement.
- `formatting-only` — byte difference with no semantic or consumer impact
  (e.g. YAML/JSON serializer formatting).
- `regression-must-fix` — the TS port is wrong; the mismatch goes back to
  the porter. (This verdict never ships as an accepted divergence.)

## Evidence

The test or fixture that proves the verdict — a vitest test asserting the
correct behavior, a fixture pair demonstrating the Python bug, or a
normalization-layer comparison showing semantic equivalence. Name the file(s)
and what they assert.

## Approval

- Reviewer: <name>
- Date: <YYYY-MM-DD>
