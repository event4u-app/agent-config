# Skill Quality

> Creating, editing, or reviewing skills — minimum quality standard, every skill must be executable, validated, and self-contained

_Origin: migrated from `.agent-src.uncompressed/rules/skill-quality.md` per P4.2 of `road-to-kernel-and-router.md`._

# Skill Quality

## Minimum Sharpness

Every skill must answer four questions. If ANY answer is weak, the skill is not done.

| # | Question | Section | Standard |
|---|---|---|---|
| 1 | When should I use this? | `When to use` | Concrete trigger, not generic |
| 2 | What exactly do I do? | `Procedure` | Executable steps with decisions |
| 3 | How do I verify it worked? | `Procedure` (validation step) | Concrete checks, not "verify it works" |
| 4 | What common failure must I avoid? | `Gotcha` + `Do NOT` | Real failure patterns, not platitudes |

## Required Sections

Every skill MUST have: `When to use`, `Procedure`, `Gotcha`, `Output format`, `Do NOT`.

## Frontmatter Contract

Every skill's YAML frontmatter MUST validate against `scripts/schemas/skill.schema.json`.
Violations are reported by `scripts/skill_linter.py` as `schema_<rule>` errors
and fail `python3 scripts/validate_frontmatter.py` and the full CI pipeline.

## Description Triggering

Claude routes skills by their frontmatter `description`. Pushy,
trigger-rich descriptions are required — polite or hedged ones cause
undertriggering. The full recipe (concrete verb phrase, ≥2 triggers,
`even if they don't explicitly ask for …` tail, ≤200 chars,
litmus test) lives in
[`contexts/communication/rules-auto/skill-quality-mechanics.md`](../contexts/communication/rules-auto/skill-quality-mechanics.md)
§ Description Triggering.

## Skill Independence

```
If a skill is not executable without opening a guideline, it is broken.
```

- Skills MAY reference guidelines for detailed conventions
- Skills MUST NOT outsource their core workflow to guidelines
- If removing guideline references makes the skill useless → the skill is too weak

**Litmus test:** Cover all guideline references in the Procedure. Is it still executable?
If not → the skill needs more own steps, decisions, and validation — not more guideline links.

## Merge & Compression Preservation

When merging or compressing skills, the result MUST preserve the
strongest validation, strongest examples, all anti-patterns, all
decision criteria, and trigger quality. Full preservation invariants
and "merge is invalid if …" / "compression may remove …" lists in
[`contexts/communication/rules-auto/skill-quality-mechanics.md`](../contexts/communication/rules-auto/skill-quality-mechanics.md)
§ Merge Preservation and § Compression Preservation.

## Refactor Safety

When refactoring or optimizing skills:

- NEVER weaken validation to pass linter
- NEVER remove anti-patterns to reduce size
- NEVER replace concrete checks with "verify it works"
- NEVER merge skills if the result is broader than either source
- ALWAYS run linter before and after — fail count must not increase

## Senior-Tier Required Structure

Skills with `tier: senior` in YAML frontmatter MUST carry four named
blocks beyond the standard required sections:

| # | Block | Heading / Location | Standard |
|---|---|---|---|
| 1 | Context-First lead | Frontmatter `description` | First sentence anchors the cognition cluster (domain + senior role); second sentence names the trigger. |
| 2 | Related Skills | `## Related Skills` | Two-list pattern — `**WHEN to use this**` (situations this skill resolves) + `**WHEN NOT to use this**` (route-elsewhere peers, named). |
| 3 | Proactive Triggers | `## When the agent should load this` | 3–5 concrete user-prompt patterns (paraphrases users actually type), not abstract categories. |
| 4 | Output Artifacts | `## Output` | 1–4 named artifacts with shape (file path, table, markdown structure) — orchestrator-citable identifier each. |

**Forward-only.** `scripts/skill_linter.py` enforces these blocks for
`tier: senior` skills only; mid-tier and untiered skills skip the
check. No retrofit pass on existing Wing-1 skills.

Subsection specs (≤ 6-line spec + 1 reference example each), good /
bad pattern pairs, and the WHEN-NOT routing peer rules live in
[`contexts/communication/rules-auto/skill-quality-mechanics.md`](../contexts/communication/rules-auto/skill-quality-mechanics.md)
§ Senior-tier patterns.

## Structural Malice Floor

`scripts/skill_linter.py` runs five regex patterns against every
skill / rule / command body — credential exfiltration, remote
execution, force-push to a protected ref, world-readable secret
files, and shell-injection in subprocess calls. A match emits
``Issue("error", "malice:<pattern>", "<line>:<matched>")`` and the
linter exits with code **3** (security-failure), distinct from
exit 2 (build-failure) so CI surfaces can split the two.

The check is **structural**, not semantic — it catches the shapes
the [`tool-safety`](tool-safety.md) rule denies in prose: hidden
credentials, arbitrary execution, write-without-approval. Fixtures
and the exit-code-3 contract live in
[`tests/test_skill_linter_malice.py`](../../tests/test_skill_linter_malice.py).

## Confidence Tagging

Senior-tier procedure steps MAY append `[CONFIDENCE: high|medium|low]`
at the end of multi-step chains where the agent's evidence varies
across steps. Optional but recommended when a step's output feeds a
downstream decision.

Text-tag form is deliberate. Emoji 🟢 / 🟡 / 🔴 is **not** allowed —
collides with [`direct-answers`](direct-answers.md) § Emoji scope
(functional markers only). Linter does not enforce the tag itself;
the rule documents the placement so authors converge on one form.
