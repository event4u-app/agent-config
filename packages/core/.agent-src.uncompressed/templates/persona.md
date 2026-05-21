# Persona Template

> Template for creating a new persona in
> `.agent-src.uncompressed/personas/{persona-id}.md`. Personas declare
> a *voice* — focus, mindset, unique questions, output expectations.
> Skills cite personas in a `personas:` frontmatter key. Users invoke
> them via `--personas=<id>`.

## Instructions

1. Create the file: `.agent-src.uncompressed/personas/{persona-id}.md`.
2. Copy the template below.
3. Replace all `{placeholders}` with real content.
4. Pass the Unique-Questions heuristic — ≥ 3 questions that no other
   persona asks verbatim. If you cannot write three unique questions,
   the persona is redundant; drop it.
5. Stay within the size budget: **Core ≤ 120 lines, Specialist ≤ 80 lines**.
6. Run `task sync` and `task ci` before commit.

## Template

````markdown
---
id: {persona-id}
role: {Human-readable role name}
description: "One line — the voice this persona brings to a review."
tier: core | specialist
mode: developer | reviewer | tester | product-owner | incident | planner
version: "1.0"
source: package
---

<!-- FRONTMATTER NOTES (delete this comment when done):
  - id              required — lowercase, hyphenated, matches filename
  - role            required — short human-readable role name
  - description     required — one sentence, ≤ 160 chars
  - tier            required — "core" (always-loaded cast) or "specialist" (opt-in)
  - mode            optional — advisory link to a role-contracts workflow mode
  - version         required — semantic version; bump on breaking changes
  - source          required — "package" for personas shipped in .agent-src/
-->

# {Role name}

## Focus

{One short paragraph — what this persona cares about above all else.
Name the lens, not the job title. Keep it tight.}

## Mindset

- {Bullet — a default assumption this persona makes.}
- {Bullet — a skepticism it carries into every review.}
- {Bullet — the trade-off it will defend when others bend.}

## Unique Questions

<!-- ≥ 3 questions nobody else asks. These are the reason the persona
     exists. If another persona asks one of these, rephrase or drop. -->

- {Question 1 — the one nobody else in the cast will ask.}
- {Question 2 — a concrete scenario, not a generality.}
- {Question 3 — rooted in this persona's unique lens.}

## Output Expectations

{How this persona phrases its findings. Blunt? Structured? With
numbered options? With a recommendation or a verdict? Keep it to
one short paragraph.}

## Anti-Patterns

- Do NOT {pattern this persona must avoid — e.g. "play code reviewer"}.
- Do NOT {pattern — e.g. "soften questions for politeness"}.
- Do NOT {pattern — e.g. "repeat what {other-persona} already said"}.

## Composes well with

<!-- Optional — advisory list of personas this one pairs well with.
     Not enforcing; skills may still combine any personas they want. -->

- `{other-persona-id}` — {why they complement each other}
````

## Quality checklist

Before considering a persona complete:

- [ ] **Unique Questions heuristic** — ≥ 3 questions that no other
  persona asks verbatim. The linter enforces this.
- [ ] **Size budget** — Core ≤ 120 lines, Specialist ≤ 80 lines.
- [ ] **Portability** — no project names, domains, stacks, teams.
- [ ] **English only** — all content in English.
- [ ] **One sentence description** — ≤ 160 chars, starts with a voice
  noun ("The voice of ...", "A … lens").
- [ ] **Anti-Patterns present** — spells out what this persona must
  refuse to do.
- [ ] **No "related skills" dump** — personas are referenced *by*
  skills, not the other way around.
