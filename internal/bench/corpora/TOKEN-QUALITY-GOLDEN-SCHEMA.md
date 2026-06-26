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
  expected:                        # OPERATOR-FILLED
    rubric: "<one-line quality rubric the judge applies>"
    must_include: ["<anchor the good answer must satisfy>", ...]
    must_not: ["<anti-quality marker>", ...]
  label_status: stub | labelled    # stub ⇒ rubric is TODO / anchors empty
  notes: "<why this task; which rules it stresses>"
```

A `labelled` task MUST have a non-TODO `rubric` and at least one `must_include`
anchor. A `stub` task is structurally valid but excluded from a judge run.

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

## Phase 0 exit composition

~30 `labelled` tasks · every rule in `dist/router.json` covered ≥1× · all four
`scenario` types present (multi-turn, conflicting-rule, corner-case mandatory).
