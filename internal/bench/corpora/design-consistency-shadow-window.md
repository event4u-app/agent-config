# Design consistency — the retroactive shadow window

The reading behind step 3.8 of `road-to-a-control-that-matches-its-neighbours`:
turning the consistency check on by default. Aggregates only. The rows name
files and commits of two private consumer repositories, so they stay local;
the repositories are not named here.

## The window

Six months of history of two consumer repositories, replayed with
`internal/bench/design-consistency/run.ts` on 2026-10-27. Every commit that
wrote a UI surface is replayed as the `design-pass` hook would have seen the
write: the role map from the tree at that commit, the written file at that
commit. This is a retroactive window, not a live one. The owner chose it
(2026-10-27) to reach the policy's sample floor in one session, and the live
recorder keeps the window open from here on.

| Repository | Shape | UI writes | Commits |
|---|---|---:|---:|
| A | server-rendered application with a React island | 250 | 143 |
| B | React monorepo with a component library | 1,315 | 215 |
| **Total** | | **1,565** | **358** |

## First reading — the rule as it shipped in shadow

Over a wider file set (every edited markup file, including server templates
the hook never sees), the raw-control rule fired on 184 of 1,137 edits in A
(16.2 %) and on 47 of 1,144 in B (4.1 %). Every introduced finding was read by
hand. Five were the failure the rule exists for. The rest came from six
defects in the rule, not in the repositories:

1. A server template measured against a JSX component it cannot render.
2. Markup inside a comment or docblock read as an element.
3. A TypeScript type argument (`Meta<typeof Popover>`) read as an element.
4. A file input compared with the text-input primitive. A JSX arrow
   attribute (`=>`) also ended the tag before `type="file"` was read.
5. A primitive exported through an export list (`export { Textarea }`), or
   named `NativeSelect`, not recognised as the primitive.
6. A design handover prototype and an agent reference copy treated as
   product UI.

Each class now has a synthetic test in the shape of what fired, with a
positive control (`tests/scripts/lint_design_consistency.test.ts`).

## The four conditions

The same window, with the six defects fixed, against
`docs/contracts/concern-activation-policy.md`:

1. **The failure is real and observed.** Five writes in B carried a raw
   control beside the project's own: two `<textarea>` in a feature view
   (three writes of that file) and three `<input>` in a login form (two
   writes). All five are kept by the fixed rule.
2. **False positives at most 1 %.** Three writes of one Storybook story that
   builds a fake field from a raw `<input>`: 3 of 1,560 legitimate writes,
   **0.19 %**. Nothing fires in A.
3. **The economics favour it.** The check never blocks: a false positive costs
   one advisory line, while a missed raw control costs a review round. This is
   the failure the roadmap was opened for.
4. **The window is met.** 1,565 observations over six months, against a floor
   of 100 or two weeks, and the targeted shape is in it.

All four hold for **consistency-raw-control**, which ships on.

## What this does not establish

- **The box-metrics rule has no reading.** Not one comparison in 1,565 writes
  had a box metric on both sides. The static parser cannot read sizes that a
  component library sets through `cn()` or variants, so there is no legitimate
  distribution to derive a tolerance from. That rule stays in shadow. AC-2
  ("box deviation within the shadow tolerance") stays open until render-sourced
  metrics (`ui:render --interact`) produce a distribution.
- **0.19 % is in-sample.** The six fixes were found in this window and then
  measured on it, so the rate is an upper bound on what was seen rather than a
  forecast. The live recorder is the out-of-sample check: every UI write adds
  a row to `agents/runtime/state/design-consistency-shadow.jsonl`.
- **The reverse trigger is a manual control, not code.** A false positive
  needs a human reading, so no automated evaluator can apply the threshold.
  How it runs is stated below.
- **Two repositories, one owner.** Neither is a third-party corpus. A third
  repository would widen the sample, not change its kind.

## The reverse trigger

Per `docs/contracts/concern-activation-policy.md` § Reverse trigger, run as a
manual control because classifying a firing write as false takes a reading.

- **Owner.** The maintainer of this repository.
- **Cadence.** Every two weeks. The first review is due 2026-11-10 (step 3.9
  of `road-to-a-control-that-matches-its-neighbours`).
- **Reading.** In each project where the check runs, from the project root:
  `npx tsx <agent-config>/src/scripts/lint_design_consistency.ts --shadow-report --days 14`.
  It prints the UI writes in the window (the denominator) and then every
  firing write on its own: when, which file, the git HEAD it was made on, and
  per finding the line, the message and the source line as written. It prints
  no rate, because it cannot tell a real finding from a false one.
- **Classification.** Read each firing write from what the row recorded, not
  from the file as it is now, and mark it real (a raw control beside the
  project's own) or false (anything else). The rate is false firing writes
  over all UI writes in the window.
- **Record.** One dated row in the roadmap's Decisions table: window,
  denominator, real, false, rate, outcome.
- **Rollback.** Above 1 %: set `hooks.design_consistency.shadow` to `true`
  in `src/config/agent-settings.template.yml` and as the default in
  `src/server/schemas/settings.ts`, in one PR. The rule then keeps running and
  recording on every UI write but delivers nothing, which is the shadow the
  policy returns it to, and the next window is measured the same way. An
  existing install does the same with `shadow: true` in its own
  `.agent-settings.yml`; `enabled: false` turns the check off entirely and
  stops the recording, so it is not the rollback. No fire in eight weeks
  opens a removal review instead.
