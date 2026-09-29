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

- [x] **1.1 Emit a one-shot invocation-surface census.** Per projected command
      and skill: whether it declares inputs, whether it carries an
      `argument-hint`, and which placeholder syntaxes its body uses. Report
      only — no threshold, `report_` prefix so the gate population classifies
      it out.
      verify: the census totals reproduce `find dist/agent-src/commands -name
      '*.md' | wc -l` and the three placeholder greps in this Goal
      Done 2026-09-29. `src/scripts/report_invocation_surface.ts` →
      `agents/evidence/analysis/invocation-surface-census.md`, pinned, byte-equal
      on a re-run at one commit. · **First limb holds:** the census reads 203
      commands and `find dist/agent-src/commands -name '*.md' | wc -l` returns
      203; hint coverage reads 160/203, so 43 carry none, exactly as the Goal
      states. · **Second limb does NOT hold, and that is the finding.** None of
      the three placeholder figures reproduces: measured 5 `${…}` occurrences in
      2 files, 3 `<UPPER>` in 1, and 0 `{{…}}` — against 11 / 4 / 2 skills in the
      Goal. The cause is the same one each time: a natural grep counts tokens
      inside CODE. `${viewport.name}` in `playwright-testing` is a JS template
      literal, `${local.env.aws_account_id}` in `terragrunt` is HCL, `${user.id}`
      in `testing-anti-patterns` is another JS literal, and `` `<TBD>` `` in
      `livewire-architect` is a marker the prose is TALKING ABOUT ("no `<TBD>`
      cells"). So the census defines its unit before counting — **an occurrence
      in PROSE**, outside fenced blocks, indented blocks and inline code spans —
      publishes that definition above any number, prints the per-file breakdown
      so the definition is arguable, and carries NO figure forward from the
      Goal. Same discipline `ask_block_census` applies to its own subject, and
      the opposite fence decision, for the stated reason: there a fence IS the
      subject, here it is foreign territory.

- [x] **1.2 Seed a shrink-only placeholder-drift ratchet.** Foreign syntaxes
      only, seeded at the measured 4 and 2. It fails on growth, never on the
      absolute number, and never on the plurality form.
      verify: gate green at seed; a synthetic skill adding one `{{...}}` body
      reference fails it; removing one keeps it green
      Done 2026-09-29. `src/scripts/check_placeholder_drift.ts` +
      `src/config/placeholder-drift-budget.json`. Seeded at what this tree
      MEASURES — `<UPPER>` 3, `{{…}}` 0 — not at the Goal's 4 and 2, per 1.1;
      the step text says "the measured" and the budget file records why the
      source figures were not copied. All three limbs, with output: ·
      **green at seed** — `✅ foreign placeholder syntaxes within their ratchet
      (<UPPER> 3/3 · {{…}} 0/0)`. · **growth fails** — a synthetic skill with one
      `{{placeholder}}` in prose gives `❌ `{{…}}` grew to 1 prose occurrence(s),
      ceiling 0`. · **removal restores green** — exit 0, worktree clean. The
      plurality form is deliberately ungated and the gate never fails on the
      absolute number, so holding at the seed is permanently green and no body
      is under pressure to be rewritten (Risk 2).

## Phase 2 — Declare inputs once, structurally

- [x] **2.1 Add an optional `inputs:` frontmatter block.** Name, type,
      required, default, enum. Optional on every artifact, so nothing existing
      breaks and no migration is owed. Schema plus fixture.
      verify: an artifact with a well-formed block validates; one with an
      unknown input type fails; one with no block validates unchanged
      Done 2026-09-29. `inputs:` added to BOTH `command.schema.json` and
      `skill.schema.json` — both carry `additionalProperties: false`, so the key
      had to be declared in each. Inserted textually as pure additions (+39 lines
      each, zero deletions): a `json.dump` round-trip reformatted both files and
      was reverted, because 274 changed lines to add one block is the drive-by
      churn `minimal-safe-diff` forbids. Tests:
      `tests/scripts/inputs_declaration.test.ts`, 16 passed, run against BOTH
      schemas. Every limb: · well-formed block across all five types validates ·
      unknown type `regexp` fails · **no block validates unchanged**, which is
      the property that makes the block optional and the migration zero. Also
      constrained: a missing `name` or `type` fails, a non-snake_case name fails
      (it must be safe both as a wire key and as a `${ref}`), an unknown key
      inside a declaration fails, and an empty list fails. **Sensitivity
      checked:** replacing the `type` enum with a bare string turns exactly the
      unknown-type test red. Corpus: 451 artefacts, 0 failing.

- [x] **2.2 Fail an in-body reference that no declaration backs.** A `${x}`
      with no `inputs.x` is an error on an artifact that declares `inputs:` at
      all. Artifacts with no block are untouched, so the check arrives with
      zero findings and grows only with adoption.
      verify: a fixture declaring `inputs.a` and referencing `${b}` fails; the
      same fixture referencing `${a}` passes; the corpus stays green
      Done 2026-09-29. `src/scripts/check_input_references.ts`, fixtures under
      `tests/scripts/fixtures/input-references/`, 11 tests passing. All three
      limbs: · `unbacked.md` declares `inputs.a`, references `${b}` → one
      finding · `backed.md` references `${a}` → none · corpus `✅ every in-body
      reference is backed`. Scoped to artifacts that declare `inputs:` at all,
      so it arrived with zero findings over a corpus where nothing declared
      anything, and grows only with adoption. It imports `proseOnly` from the
      census rather than restating it — one definition, one place, because two
      copies of the counting rule is the drift this phase exists to prevent. The
      consequence is stated rather than hidden and has its own fixture
      (`fenced-foreign.md`): a `${…}` inside a fence is NOT checked, which is the
      conservative direction — reporting a skill's HCL example against a
      declaration it never claimed to satisfy is the false positive that gets a
      young gate switched off.

## Phase 3 — Derive every downstream form

- [x] **3.1 Generate `argument-hint` from `inputs:`.** Where a declaration
      exists, the hint is generated and hand-written hints on the same artifact
      are a conflict, not a merge. The 43 hintless commands become a generation
      gap that closes as declarations land, rather than 43 prose edits.
      verify: round-trip — generate, re-parse, compare; an artifact with a
      declaration and a conflicting hand-written hint fails
      Done 2026-09-29. `src/scripts/check_argument_hint.ts`. Form: `<name>`
      required · `[name]` optional · `:a|b` for an enum — the shape the corpus
      already writes (`[path]`, `[--force]`), so the derived hint is not a new
      dialect. Both limbs: · **round-trip** — `parseHint(hintFor(x))` recovers
      name, requiredness and enum over four cases, asserted rather than assumed,
      because a generator whose own parser cannot read its output would make the
      conflict check unfalsifiable. · **conflict fails** — a declaration of `a`
      beside a hand-written `[something-else]` returns `kind: 'conflict'`. An
      artifact with no declaration is untouched, hint or not.
      **Scoped to COMMANDS, and the reason is structural rather than a
      preference:** `argument-hint` is a key of `command.schema.json` and of no
      other schema, so reporting a SKILL that declares `inputs:` as "missing its
      hint" would demand a field the schema forbids. Skills reach the wire
      through 3.2 instead, which needs no hint at all. Found by running the gate
      after the first adopter landed, not by reading the schema first.

- [x] **3.2 Derive MCP `arguments` at `prompts.ts:551`.** Replace the hardcoded
      empty list with the declared set. Substitution, if any, happens at the
      `prompts/get` boundary only — a body delivered to a host as a file is
      never regex-rewritten, because the host executes it natively.
      verify: `prompts/list` carries a non-empty argument set for at least one
      artifact; an artifact with no declaration still serves `arguments: []`;
      no code path substitutes into a file-delivered body
      Done 2026-09-29. `src/scripts/mcp_server/prompts.ts`: `arguments: []` at
      the projection is now `prompt.inputs.map(...)`, fed by a new
      `_parse_inputs` and an `inputs` field on `SkillPrompt`.
      **A dedicated parser was required, not a shortcut.** `_strip_frontmatter`
      is a flat `key: value` line scanner, so a nested `inputs:` list cannot pass
      through it — `inputs:` would land as an empty string and its `- name:`
      lines as stray keys. The MCP server is deliberately stdlib-only and is
      bundled for the wire, so pulling in a YAML parser to read one optional
      block would pay a dependency on every install. `_parse_inputs` accepts
      exactly the grammar the schema permits and yields NO input rather than a
      guessed one, because inventing an argument a host then prompts a user for
      is strictly worse than declaring none.
      All three limbs, against the REAL corpus rather than a fixture: ·
      **non-empty set** — `command.work` serves
      `[{name: prompt, required: false}]` and `skill.markitdown` serves
      `[{name: source, required: true}]`, both derived from declarations on
      disk. · **undeclared still `[]`** — 500 of 502 prompts, and every one
      carries an array rather than an absent key. · **no substitution** —
      asserted as a negative over the module source (no write to `body`, no
      `${…}` near it) plus a byte-identity check on a declaring prompt's body,
      because Risk 3 fails in exactly that direction.
      Tests: `tests/scripts/invocation_derivation.test.ts`, 26 passed.
      **Sensitivity checked:** reverting the projection to a literal `[]` turns
      four tests red, including both corpus-level ones.

## Independent review — four defect classes, all in this change

An independent review of this branch found four classes of defect in the work
above. All four were real, all four reproduced, and all four are fixed here.
Recorded because the first of them makes two acceptance criteria below false as
originally shipped, and a closed roadmap that hides that is worse than an open
one.

1. **The gates ran nowhere.** `check_placeholder_drift`,
   `check_input_references` and `check_argument_hint` were registered in no
   Taskfile, no workflow and no coverage manifest. So "a hand-written hint
   contradicting a declaration is a **build failure**" and "the ratchet is
   **red** on one added occurrence" were claims about code nothing executed.
   They are now defined in `taskfiles/ci-fast.yml`, called in the `consistency`
   workflow, chained from `Taskfile.yml`, and registered in
   `src/config/gate-coverage.yml` — **called as scripts rather than through
   `task`**, because `check_gate_coverage` compares the manifest's argv against
   CI's literally, and a manifest that probes a gate differently from CI is a
   coverage claim about a run that never happened.
2. **The MCP reader invented an argument.** Its key scan ran at any depth, so a
   schema-valid `default:` MAPPING whose first child was `name:` overwrote the
   parameter's own name — the server offering a host an argument nobody
   declared, while the module header promised "no guessed input". It also
   misread `required: True` as optional, the flow form as empty, a block scalar
   as the literal `">"`, and truncated the block at a column-zero comment. Every
   one of those is schema-valid. Fixed at the root rather than case by case: the
   reader tracks depth, declines what it cannot model, and a NEW gate —
   `check_inputs_parity` — compares it against a real YAML parse for every
   declaring artifact, so a decline is a red gate with a named remedy instead of
   a wrong argument on the wire.
3. **The prose stripper leaked and over-stripped.** Its single regex needed the
   closing fence at the opener's own indent, so an unclosed fence, a fence closed
   at one-to-three spaces (legal CommonMark) and a four-backtick fence wrapping a
   three-backtick one all leaked — and the `{{…}}` ceiling of zero rests on it.
   In the other direction, blanking every four-space line removed **217**
   non-fence prose lines across the skill corpus, **74** of them list
   continuations, so a placeholder in a nested bullet was invisible. Replaced
   with a line scanner that follows the fence rules that matter and treats an
   indented run as code only outside a list. Both directions are now pinned by
   `tests/scripts/prose_only.test.ts` (14 cases, one per named leak).
4. **Two assertions could not fail, and one declaration was untrue.** A test
   asserted a guard clause a later null check already covered; another compared
   both sides of one `.map`, proving the map is the identity rather than that the
   declaration was read. Both replaced — the second now reads the frontmatter off
   disk. And `markitdown` declared `type: path` for what the skill's own body
   documents as a **URI** with four schemes; it is `string` with the schemes
   named, and no longer `required`, since the skill is also read for its
   scheme discipline rather than only invoked.

The round-trip gap the same review found is closed in the schema rather than in
the renderer: `enum` values may no longer contain `|`, `]` or `>`, the three
delimiters of the derived hint, so the property the hint gate asserts is true
for every declaration the schema accepts instead of for most of them.

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
