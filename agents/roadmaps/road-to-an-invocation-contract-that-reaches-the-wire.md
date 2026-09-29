---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Archiving is wrong (three defects verified live at exact file:line today), parking is wrong (nothing gates them — they need no host observation, no council and no owner ruling to start), and merging is unavailable because no active or parked roadmap owns the MCP prompt-argument surface at all."
relates: []
---
# Road to an invocation contract that reaches the wire

> **Source:** `agents/tmp.old/inbox-2026-09-ab/t07/` — an external multi-loop
> planning session over the skill-reachability surface, delivered as a
> transcript plus four plan revisions.

## Goal

Three verified, independent, unowned defects sit on one surface: what a host or
an MCP client is told about how to invoke an artifact. The MCP prompt surface
emits a hardcoded empty argument list (`src/scripts/mcp_server/prompts.ts:551`,
`arguments: []`), so no prompt served by this package declares a single
parameter. Of 203 projected commands, 160 carry a free-text `argument-hint` and
43 carry none, and the hint is prose nothing validates. And in-body placeholder
syntax has drifted across three incompatible forms — 11 skills use `${...}`, 4
use `<UPPERCASE>`, 2 use `{{...}}` — with no lint. This roadmap makes the
declaration structured and machine-read, then derives every downstream form
from it, so hint-versus-reality drift becomes unrepresentable.

Falsifiable: after Phase 3, `prompts/list` declares at least one non-empty
argument set derived from a declaration, and a command carrying a declaration
but no hint acquires one without anybody typing it.

## Phase 1 — Measure the surface before changing it

- [ ] **1.1 Emit a one-shot invocation-surface census.** Per projected command
      and skill: whether it declares inputs, whether it carries an
      `argument-hint`, and which placeholder syntaxes its body uses. Report
      only — no threshold, `report_` prefix so the gate population classifies
      it out.
      verify: the census totals reproduce `find dist/agent-src/commands -name
      '*.md' | wc -l` and the three placeholder greps in this Goal

- [ ] **1.2 Seed a shrink-only placeholder-drift ratchet.** Foreign syntaxes
      only, seeded at the measured 4 and 2. It fails on growth, never on the
      absolute number, and never on the plurality form.
      verify: gate green at seed; a synthetic skill adding one `{{...}}` body
      reference fails it; removing one keeps it green

## Phase 2 — Declare inputs once, structurally

- [ ] **2.1 Add an optional `inputs:` frontmatter block.** Name, type,
      required, default, enum. Optional on every artifact, so nothing existing
      breaks and no migration is owed. Schema plus fixture.
      verify: an artifact with a well-formed block validates; one with an
      unknown input type fails; one with no block validates unchanged

- [ ] **2.2 Fail an in-body reference that no declaration backs.** A `${x}`
      with no `inputs.x` is an error on an artifact that declares `inputs:` at
      all. Artifacts with no block are untouched, so the check arrives with
      zero findings and grows only with adoption.
      verify: a fixture declaring `inputs.a` and referencing `${b}` fails; the
      same fixture referencing `${a}` passes; the corpus stays green

## Phase 3 — Derive every downstream form

- [ ] **3.1 Generate `argument-hint` from `inputs:`.** Where a declaration
      exists, the hint is generated and hand-written hints on the same artifact
      are a conflict, not a merge. The 43 hintless commands become a generation
      gap that closes as declarations land, rather than 43 prose edits.
      verify: round-trip — generate, re-parse, compare; an artifact with a
      declaration and a conflicting hand-written hint fails

- [ ] **3.2 Derive MCP `arguments` at `prompts.ts:551`.** Replace the hardcoded
      empty list with the declared set. Substitution, if any, happens at the
      `prompts/get` boundary only — a body delivered to a host as a file is
      never regex-rewritten, because the host executes it natively.
      verify: `prompts/list` carries a non-empty argument set for at least one
      artifact; an artifact with no declaration still serves `arguments: []`;
      no code path substitutes into a file-delivered body

## Acceptance criteria

- `prompts/list` declares arguments derived from a declaration for at least one
  skill and at least one command.
- A command that declares inputs and no hint acquires a generated one.
- A hand-written hint contradicting a declaration is a build failure.
- The foreign-placeholder ratchet is green at seed and red on one added
  occurrence.
- No artifact is required to declare `inputs:`; the corpus stays green
  throughout.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-29 | reviewer: agent -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | `inputs:` becomes a second authority beside the existing frontmatter contract | implementation | The tree already has a frontmatter contract with its own schema fleet, and `argument-hint` already describes invocation. Adding a structured input declaration creates a second place that answers what an artifact takes, and once two surfaces can answer the same question they drift — which is the exact failure, hint-versus-reality drift, this roadmap exists to make unrepresentable. | Step 2.1 puts `inputs:` in the same frontmatter block, validated by the same schema fleet, and adds no file, no index and no overlay. Step 3.1 makes the derived direction one-way: where a declaration exists the hint is generated, and a hand-written hint on the same artifact is a build failure rather than a merge, so the second authority cannot form. | Phase 2 — Declare inputs once, structurally |
| 2 | The placeholder ratchet is read as a canon ruling and drives a corpus-wide rewrite nobody authorised | product | Step 1.2 seeds a shrink-only ratchet at the measured 4 `<UPPERCASE>` and 2 `{{...}}` occurrences. A committed number naming two syntaxes as foreign reads as a decision that `${...}` is canon, and the obvious next move is rewriting those six bodies — a corpus-wide change to working skills that no step here authorises and that the census was never meant to justify. | Step 1.2 fails on growth only, never on the absolute number and never on the plurality form, so holding at the seeded 4 and 2 is permanently green and a rewrite buys nothing the gate asks for. Step 1.1 carries the `report_` prefix so the census classifies out of the gate population, and no step in this roadmap rewrites an existing body. | Phase 1 — Measure the surface before changing it |
| 3 | Substitution leaks from the prompt boundary into bodies a host executes natively | implementation | Once a declared argument set exists, filling those values into the artifact text is the natural next line, and the MCP server has both the declaration and the body in hand. A body delivered to a host as a file is executed by the host natively, so a regex rewrite on the way out corrupts a file the host parses itself — silently, and only for artifacts that happen to declare inputs. | Step 3.2 confines substitution to the `prompts/get` boundary and states the file-delivery case as never rewritten. Its verify asserts the negative directly rather than by inspection: no code path substitutes into a file-delivered body, alongside the positive check that `prompts/list` carries a non-empty argument set and an undeclared artifact still serves `arguments: []`. | Phase 3 — Derive every downstream form |
| 4 | Adoption stalls at zero declarations and the three generators sit unexercised | product | `inputs:` is optional on every artifact, so nothing forces a single declaration to exist. With zero adopters the hint generator, the in-body reference check and the MCP argument derivation all run over an empty set, stay green forever, and rot — while the 43 hintless commands and the hardcoded `arguments: []` remain exactly as they are today. | Each phase's verify runs against a fixture rather than against the corpus, so the mechanism is proven exercised without depending on adoption. Step 2.2 is scoped to artifacts that declare `inputs:` at all, which is what lets the check arrive with zero findings and grow only with adoption; adoption itself is named as a separate decision rather than assumed by this roadmap. | Phase 3 — Derive every downstream form |
