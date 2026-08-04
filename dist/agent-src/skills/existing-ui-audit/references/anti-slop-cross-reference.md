# existing-ui-audit — anti-slop cross-reference

> Section-level entry point of the `existing-ui-audit` skill (progressive
> disclosure, 2026-08-04). Content moved VERBATIM from SKILL.md —
> load this file when the section index in SKILL.md routes here.

## Anti-slop cross-reference

When the audit inventory reveals an existing aesthetic direction (dominant color
scheme, border-radius convention, motion patterns), cross-check the findings
against
[`docs/guidelines/design-antipatterns.md`](../../../../docs/guidelines/design-antipatterns.md).
If the existing UI already uses a listed anti-pattern, surface it as a design-debt
finding (separate from the reuse inventory) — flag by entry ID and severity.

**What the design step may then do depends on whose aesthetic it is.** These
are two different situations and the sentence that used to cover both was
wrong about one of them:

| The anti-pattern lives in… | The design step may… |
|---|---|
| **The consumer's own legacy UI** (inventoried from the repo) | continue it for consistency, **or** propose a corrective direction change. Both are legitimate; it is their codebase and their debt. |
| **A supplied spec** (a handed-over artifact, a `design-system.json`, a registered brand token) | **neither.** Build it as given. The finding is recorded as informational, marked `artifact_covered`, and no polish round acts on it. |

A corrective direction change against a supplied spec is not a design
improvement, it is overriding a decision the user already made — the failure
[`design-fidelity`](../../rules/design-fidelity.md) exists to prevent, arriving
through the audit's side door. Precedence and its exact scope:
[`design-fidelity-mechanics`](../../../../docs/guidelines/design-fidelity-mechanics.md)
§ Provided-artifact precedence. Where the two sources disagree, surface the
conflict rather than picking (fixture `daf-slop-vs-provided`).
