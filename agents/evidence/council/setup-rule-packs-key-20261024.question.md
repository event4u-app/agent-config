<!-- evidence-type: analysis -->

# AC-1 of `road-to-a-setup-that-decides-itself` — what happens to `projection.rule_packs`

Repository `event4u/agent-config`. Answer with one option letter and a short rationale. Do not restate the question.

## Context

The owner's directive of 2026-10-12: remove the lean settings, make the rule-layer form default and dynamic, only if the package does not get worse. ADR-293 records the removal. Acceptance criterion AC-1:

> No projection key in template, schema, wizard or docs except `projection.mode` pending the skills completeness question; each removal has a tombstone; `doctor` names leftovers.

Phase 4 removed `lean_projection.mode`, `lean_projection.hosts` and `projection.rule_workspaces` (each with a tombstone; the release that removed them shipped as a major per a 2026-10-20 council round). `projection.mode` waits on its own blocker. One projection key remains that no step covers: `projection.rule_packs`.

What `projection.rule_packs` is (`src/config/agent-settings.template.yml`, `src/server/schemas/settings.ts:50`, readers `src/install/rule_scope.ts`, `src/scripts/_lib/scoped_projection.ts`, `src/scripts/condense.ts`):

- A second scoping axis for the RULE layer by pack ids: when set, a non-kernel rule also needs a `packs:` frontmatter intersection to project.
- Values: a list of pack ids, or the literal `auto`, which derives the list from the active-pack set (the same set the skill/command prune uses). Default `[]` (inactive). Settings class C.
- Measured 2026-08-02: `auto` drops 8 rules / 8,110 GPT tokens — six domain safety floors whose own text says they auto-activate only with their pack, plus two others.
- The template says flipping the default to `auto` changes what a consumer install receives and "inherits the same human release gate the workspace axis carries … Do not set this from automation."
- `BREAKING_CHANGES.md` names settings keys part of the public contract. A 2026-10-14 decision: a key may leave in a minor only when no consumer can rely on it; otherwise only in a major. A consumer may have written an explicit list or `auto`.

## Options

(a) Add a step that retires `projection.rule_packs`: derive the pack axis from the active-pack set (what `auto` does today) with a tombstone, a one-window read of explicit values, in the next major.

(b) Add a step that retires it but keeps today's default behaviour (no pack axis) — tombstone only, explicit values read once into an equivalent non-settings source.

(c) Carve `projection.rule_packs` out of AC-1, the way `projection.mode` is carved out, recording why it stays a setting.

(d) Something else — state it.

## What a usable answer contains

1. One option letter and the strongest reason for and against it.
2. **Routing:** is this decision council-decidable, or owner-reserved? Owner-reserved covers: changing the project's purpose or a declared non-negotiable outcome; lowering a security/privacy/safety floor; irreversible or destructive transitions; spend above a delegated threshold; creating/removing/weakening a legal, contractual, compatibility or public commitment; governance self-amendment; anything that cannot be bounded from evidence. Answer `council-decidable` or `owner-reserved` with one sentence.
3. The one condition that would reopen the choice.
