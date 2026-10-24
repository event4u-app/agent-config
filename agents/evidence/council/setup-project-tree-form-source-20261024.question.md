<!-- evidence-type: analysis -->

# Where the project tree's rule-layer form comes from — full-quorum review of a choice taken at one seat

Repository `event4u/agent-config`. Answer with one option letter and a short
rationale. Do not restate the question.

## Background

`road-to-a-setup-that-decides-itself` removed the settings keys that described
how the package loads its rule layer (ADR-293). The shipped settings template
was the last place the PROJECT tree on the first host (`claude-code`) got its
form from: `delivery`, chosen by ADR-267 on measured evidence (616/616
byte-equal deliveries, 101/101 labelled rules reachable, 0 of 212 near-misses
fired on the frozen routing-matrix corpus).

On 2026-10-20 a council round on this question had one of two seats present
(the other returned a quota error). That one seat chose option (a) below, and
(a) was built, because it changes no behaviour. The step that owns the question
(3.6, "the project tree uses the same function, with the project's own
dispatcher as its carrier") was left open because one seat is not a verdict.
This round is the full-quorum review.

## What is in the tree today

- `src/config/project-tree-form.json` — a package-owned record, no consumer
  layer, no cascade. One row: `claude-code` → `delivery`, basis ADR-267, with a
  `measured` block. Rows without a `measured` block are refused by the reader.
- `src/scripts/_lib/project_tree_form.ts`:
  - `shippedProjection(packageRoot)` — reads the record and returns the
    `{mode, hosts}` pair the projector consumes. This is the function on the
    live path (`resolveLeanProjection` calls it).
  - `projectTreeForm(packageRoot, host, verdict)` — the precedence rule: a
    layer-form verdict whose reason is anything other than
    `delivery-unobserved` decides (an observed `full` beats a record saying
    `delivery`); otherwise the record stands. Tested in
    `tests/scripts/project_tree_form.test.ts` in both directions.
  - **`projectTreeForm` has no caller outside its test.** The live path reads
    the record through `shippedProjection` and consults no verdict.
- The decision function (`_lib/layer_form_decision.ts`) answers
  `full (delivery-unobserved)` for every host today, because the first host's
  behavioural effect row in `src/config/host-injection-effect.json` is
  `unobserved`. Its inputs describe the INSTALLED user-global layer
  (`~/.claude/rules`) and the machine's carrier; it has no input that describes
  a project tree.
- The `InstructionsLoaded` observer is now bound (2026-10-23), so arrival
  records for the installed layer begin to exist; none describes a project
  tree.
- `check_host_tree_parity` is green: non-delivery hosts' trees are
  byte-identical to the full form; the delivery host is `claude-code`.

## Options

(a) **Confirm the record as the project tree's source.** The project tree keeps
    ADR-267's evidence as its proof through `project-tree-form.json`; step 3.6
    closes on that, with the record retired when an observed verdict exists.

(b) **Route the project tree through the decision function now.** It reads
    `full (delivery-unobserved)`; delivery stops on the first host's project
    tree; the record is removed in the same change.

(c) **Confirm (a) only together with a change** to how the record and the
    precedence rule meet the live path — state which change, and whether 3.6
    may close before it lands.

(d) Something else — state it.

## Constraints

- Owner directive of 2026-10-12: remove the keys, make the form default and
  dynamic, only if the package does not get worse and stays as reliable as
  today.
- ADR-267 decision point 4: an absent key resolves to the full form.
- Nothing here changes the INSTALLED user-global layer.

## What a usable answer contains

1. One option letter.
2. The single strongest reason for it and the single strongest reason against.
3. If (a) or (c): whether step 3.6 may be marked done on it, and what must be
   true of the tree for that.
4. The one condition that would reopen the choice.
