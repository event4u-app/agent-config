# token-quality-golden — held-out quality golden-set schema

Phase 0 contract for `agents/roadmaps/road-to-token-saving.md`. Unlike the
discipline-axis corpus (`SCHEMA-v2.md`, **deterministic** trap scoring), every
task here is scored by the **length-controlled paired judge** against
**hand-labelled** quality anchors. The set proves output quality is held
constant when a token lever changes the projection (thin vs eager, condense,
RTK).

## Operator gate

The `expected` anchors are **hand-labelled, never LLM-generated** (handoff:
"hand-labelled expected outcomes (not LLM-generated)"). The repo ships the
schema + example stubs; filling ~30 `labelled` tasks spanning all rules is
operator work. `label_status: stub` marks an unfilled task.

## Task entry (`token-quality-golden.yaml`)

```yaml
- id: tq-<area>-NN                 # tq-<kebab area>-<NN>
  rules: [<rule-id>, ...]          # ≥1 rule id (from dist/router.json); drives coverage
  scenario: single | multi-turn | conflicting-rule | corner-case
  prompt: "<task / turn(s) given to the agent>"   # multi-turn → one block, turns labelled
  context_files: ["<path>", ...]   # OPTIONAL — satisfies path_prefix/file_pattern triggers
  command: "/<slash-command>"      # OPTIONAL — satisfies command triggers
  no_fire: true                    # OPTIONAL — corner-case testing NON-activation:
                                   # the tagged rules must NOT fire (invalid on kernel)
  expected:                        # OPERATOR-FILLED
    rubric: "<one-line quality rubric the judge applies>"
    must_include: ["<anchor the good answer must satisfy>", ...]
    must_not: ["<anti-quality marker>", ...]
  label_status: stub | labelled    # stub ⇒ rubric is TODO / anchors empty
  notes: "<why this task; which rules it stresses — stubs carry the rule's Iron-Law line + the trigger the prompt exercises>"
```

## Prompt↔trigger falsifiability (always on)

"Covered" means **fires**, not mentioned: every tagged rule must have ≥1
router trigger the task provably exercises — keyword/phrase = case-insensitive
substring of the prompt; intent = every alpha word (>2 chars) present
(`trigger_coverage.ts` semantics); path_prefix/file_pattern match against
`context_files:`; command against `command:`. Kernel rules always fire.
`no_fire: true` inverts the check (the rule must NOT fire). A violation is a
structural error — nominal-only coverage cannot enter the corpus.

A `labelled` task MUST have a non-TODO `rubric` and at least one `must_include`
anchor. A `stub` task is structurally valid but excluded from a judge run.

### Authoring consequence — a path in the prompt is not a `path_prefix` match

`path_prefix` and `file_pattern` are matched **only** against `context_files:`.
Writing the path into the prompt text does not satisfy them, however literal it
looks: a prompt reading *"fix the typo in `dist/agent-src/rules/scope-control.md`"*
still fails the falsifiability check for `source-of-truth` unless the task also
carries `context_files: ["dist/agent-src/rules/scope-control.md"]`.

The sharp case is a rule whose trigger set is **path_prefix-only** — today
`skill-quality` (`src/skills/`), `rule-type-governance` (`src/rules/`), and
`source-of-truth` (`dist/agent-src/`, `.augment/`, `.claude/`, `.cursor/`). For
those, a task without `context_files:` is **not constructible at all**; there is
no prompt wording that can fire them. Author the `context_files:` entry first and
let the prompt describe the intent.

The same asymmetry applies in reverse: `keyword`/`phrase` triggers match the
prompt only, so adding a path to `context_files:` will not rescue a task whose
tagged rule fires on vocabulary the prompt never uses.

## Validation

```
./scripts-run src/scripts/check_token_quality_golden            # structure + coverage report
./scripts-run src/scripts/check_token_quality_golden --json
./scripts-run src/scripts/check_token_quality_golden --require-complete   # operator-completion gate
```

- **Always**: structural errors (unknown rule id, bad `scenario`, missing
  field, `labelled` task with a TODO rubric / no anchors) → exit 2.
- **Default**: stub count + uncovered rules + scenario mix are **reported**,
  exit 0 — the scaffold passes CI while the operator fills it.
- **`--require-complete`**: additionally fail (exit 2) if any stub remains, any
  rule is uncovered, or a required scenario type is absent. This is the gate the
  operator flips on once the golden set is filled (Phase 0 exit).

## Scope-aware completion (road-to-golden-set-coverage Phase 0)

`--scope consumer|maintainer|all` filters the coverage universe by the
router's v2 `workspaces:` fields (consumer = kernel + every rule not
exclusively `agent-config-maintainer`). **The consumer thin/scoped flips gate
on `--require-complete --scope consumer`; a maintainer-side flip would gate
on `--scope all`.** Default `all` keeps today's behaviour.

## Phase 0 exit composition

~30 `labelled` tasks · every rule in the gated scope covered ≥1× · all four
`scenario` types present (multi-turn, conflicting-rule, corner-case mandatory).
