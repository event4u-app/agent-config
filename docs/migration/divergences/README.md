# Migration divergences — Python → TypeScript

This directory is the **divergence ledger** of the Python → TypeScript
migration (see
[ADR-092](../../decisions/ADR-092-python-to-typescript-migration.md)).
It is the single place where TypeScript-vs-Python behavior differences live.
An undocumented difference is a regression by definition.

## When a divergence doc is required

**Any golden-parity mismatch.** The parity harness runs the Python and the
TypeScript version of a script on identical fixtures and compares
stdout/stderr, exit code, and written files byte-exact (with opt-in JSON/YAML
normalization). If the comparison is not green for a script, that script
needs exactly one of:

1. a fix in the TS port that restores byte-exact parity, or
2. a divergence doc in this directory.

There is no third option. The quality floor is: **quality must not degrade;
documented improvements are allowed and explicitly approved.**

## Lifecycle

1. **Porter writes the doc.** When a porting (sub)agent or contributor hits a
   parity mismatch they believe is correct-to-keep (e.g. the TS port fixes a
   genuine Python bug, or a formatting library difference with no consumer
   impact), they copy [`_template.md`](_template.md) to
   `<script-path-slug>.md` in this directory and fill every section —
   including the evidence test or fixture that proves the verdict.
2. **Reviewer approves.** A human reviewer (or the independent verification
   subagent escalating to a human) checks the evidence and records approval
   (name + date) in the doc's Approval section. A doc without an approval
   line is not a documented divergence.
3. **Doc ships in the porting PR.** The divergence doc lands in the same PR
   as the TS port it covers, so the parity decision is reviewable next to
   the diff.

Verdicts of `regression-must-fix` never stay in this directory as an excuse —
they mean the port goes back to the porter; the doc may be kept only as a
record of an investigated-and-fixed mismatch.

## How CI consumes this directory

The parity harness treats a **documented, approved divergence as a pass** for
the affected comparison: golden parity for a script may be red only if a
matching divergence file exists here. An **undocumented mismatch fails CI**
(the `migration-gates` workflow blocks the PR).

## Naming

One doc per script (not per symptom): `src/scripts/foo/bar.py` →
`src-scripts-foo-bar.md`. If a script accumulates multiple divergences,
extend the existing doc with additional Symptom/Verdict blocks rather than
creating a second file.
