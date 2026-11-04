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
3. **The economics favour it.** Friction and benefit, each measured where it
   can be:
   - *Latency on every UI write.* Timed on the shipped chunk (Darwin arm64).
     Cached map, 2026-10-27, n = 30: p50 111 ms and p95 118 ms, of which the
     porcelain status call is about 95 ms in this package's own tree and about
     25 ms in the larger consumer repository B. The map is recomputed only
     when HEAD moves or a dirty file gains, loses or changes a primitive
     (293 ms in this package's tree); a newly dirty feature file reuses it.
     Mixed session, 2026-10-29, every call timed: a scratch repository holding
     a copy of this package's `src/` and `docs/`, 20 new feature files with
     three edits each, one primitive change and one commit, n = 83: p50 40 ms,
     p95 44 ms, max 111 ms (the first call); the two recomputes took 94 and
     89 ms. Whole `post_tool_use` events, 2026-10-29, the shipped dispatch
     bundle spawned as the latency bench spawns it, the same kind of session
     (15 new files with two edits each and one primitive change, n = 47), the
     check on against the same session with it off, two runs on a laptop
     under other load: on p50 138 / 192 ms, p95 211 / 283 ms; off p50 100 /
     82 ms, p95 120 / 93 ms. In a cold process the check costs about 55 ms
     (porcelain status about 33 ms, `rev-parse` about 9 ms); the tail is the
     first UI write after HEAD moves, which recomputes the map. So the p95
     sits around the 250 ms budget of `src/config/hook-latency-budget.json`
     for a hook event on this machine, not clearly inside it; that budget is
     enforced on CI runners for a synthetic Read, which a UI write is not.
     This is owner-accepted latency (2026-11-03), not a demonstrated pass of
     that budget. Non-UI writes never load the chunk.
   - *A false positive.* One advisory line of about 150 characters (about 40
     tokens), never a block: the concern is `severity: advisory`, which the
     dispatcher enforces as a ceiling. Its findings carry `design-pass`'s
     priority label P1; in that pass only a P0 can ever be reported as
     would-block, and only at `stop`, which this check does not run on.
     Three such lines in 1,560 legitimate writes.
   - *A missed raw control.* It is the failure this roadmap was opened for: a
     raw `<select>` reached review beside the project's own `Select`, and the
     correction was a further review and rework round. The owner of both
     repositories puts that round at **about 30 minutes** (owner estimate,
     2026-10-29; not timed). Five such writes were in the window.
   The trade, over the whole window of 1,565 UI writes: about 3 minutes of
   added hook latency (1,565 × 0.11 s) and about 120 tokens of false-positive
   noise, against up to five rework rounds of about 30 minutes each. The
   conservative bound assumes only one of the five would have reached review
   at all: 30 minutes saved against 3 minutes spent, a factor of ten. The
   benefit side rests on the owner's estimate, not a measurement. The
   reverse trigger below counts real findings in every window, and no fire
   in eight weeks opens a removal review, so a benefit that does not
   materialise live is caught on the same cadence as excess noise.
4. **The window is met.** 1,565 observations over six months, against a floor
   of 100 or two weeks, and the targeted shape is in it.

Conditions 1, 2 and 4 hold for **consistency-raw-control**. Condition 3 holds
only as an estimate, and only for delivery: the check ships recording, not
delivering (§ Delivery held below), and recording pays the latency while
avoiding no review round itself, so its benefit is prospective (ratification
rounds 19 and 20). What ships is the shadow collection; delivery is decided
again when it is turned on.

## Second reading, 2026-11-03 — after the family boundary

Ratification round 14 found that the rule inferred which files can render a
canonical from the file extension alone, so a `.vue` file in a mixed repository
could be measured against a React `Select`. The role map now records the file
families (`jsx`, `vue`, `svelte`, `astro`, `blade`) of the files that define
each canonical (round 15: definitions only, since a same-named use in another
family may be another component; a single-file component is defined by its
file name). A file outside them is not measured, nor is a canonical the
project does not define (a library component), and a map without families is
not trusted. The window was replayed again with an explicit bound (2026-04-27
to 2026-10-27) on each repository's current HEAD, with the family check, with
it disabled, and with definition-only families:

- A: 262 writes in 147 commits, nothing fires. B: 1,443 writes in 239 commits,
  six firing writes, identical in all three replays. Both
  repositories are single-family, so the check removes nothing here; its
  effect is on mixed repositories, which this window does not contain.
- The counts differ from the first reading (1,565 writes) because B's HEAD is
  now another branch: the three `<textarea>` writes are not on it, and two new
  firing writes are. Of the six: two writes of the login form are real (three
  raw `<input>`), three writes of the Storybook story are false as before, and
  one raw `<input>` in a list molecule of the component library, used as a
  compact position field, is counted false as the worst case. False: at most
  4 of 1,703 legitimate writes, **0.23 %**. Conditions 1, 2 and 4 still hold
  on this reading. Condition 3 rests on its conservative bound, one avoided
  rework round, which the two real writes here still meet; the benefit side
  stays the owner's estimate.
- Round 16: a re-export (`export { Select } from '…'`, or an imported name
  exported again) was counted as a definition. An export list now names a
  definition only for a name declared in that file. Both replays were rerun
  and are identical.
- Round 17: a declaration inside a comment, a string or a nested function
  still made an imported name local. Definitions are now read from the code
  with comments and string contents blanked, a declaration must sit at module
  level, and a name an import binds is never local. The first version of that
  fix also discarded `function Input` beside `import { Input as InputPrimitive }`,
  which silenced every finding in B; the replay caught it, the import clause
  is now read by the names it binds, and both replays are identical again.

## Delivery held, 2026-11-04

Ratification round 18 split. One seat confirmed and named a gap: an `export`
inside a `namespace` or `declare module` block matches the module-level
pattern. The other refused: a declaration inside a regex literal
(`/export const Select/`) is read as code, and pattern repairs keep finding
the next case. Neither case occurs in either repository, and both replays are
unchanged. The owner chose (2026-11-04) to ship the check with
`hooks.design_consistency.shadow: true`: it runs and records every UI write,
so the live recorder and the reverse trigger work from the first day, and it
shows nothing until definitions are read by scope-aware syntax analysis. The
latency stated under condition 3 is paid either way, because recording runs
the same check. Delivery is the next step of the roadmap, a change of one
default.

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
- **The reverse trigger measures noise and inactivity, not savings.** Real
  findings in a window show the failure still occurs; they do not show that
  an advisory avoided a review round. The 30-minute figure stays an estimate.
- **The live recorder cannot prove its own coverage.** A row is written only
  after the role map is computed, and a failure in the check is swallowed so
  the hook event survives. The report catches a missing file, an empty window
  and unreadable rows, not a write that left no row. Mixed-framework
  repositories and library-only canonicals are also outside this window: the
  first is guarded by families, the second is not measured at all.
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
  per finding the line, the message and up to 200 characters of the source
  line around the control. It prints no rate, because it cannot tell a real
  finding from a false one. It exits 1 and says why when the evidence is not
  whole: no shadow file, an unreadable one, no UI write in the window, or
  rows it had to reject (listed by line, with the valid rows still counted).
  Such a window is read from those rows by hand before it is classified,
  never taken as clean.
- **Classification.** Read each firing write from what the row recorded, not
  from the file as it is now, and mark it real (a raw control beside the
  project's own) or false (anything else). The rate is false firing writes
  over the legitimate writes in the window (all UI writes less the real
  ones), the same denominator as the readings above.
- **Record.** One dated row in the roadmap's Decisions table: window,
  denominator, real, false, rate, outcome.
- **Rollback.** While delivery is held, the shipped default already is the
  rollback state, and the review classifies the recorded rows the same way.
  Once delivery is on, above 1 %: set `hooks.design_consistency.shadow` to
  `true` in `src/config/agent-settings.template.yml` and as the default in
  `src/server/schemas/settings.ts`, in one PR. The rule then keeps running and
  recording on every UI write but delivers nothing, which is the shadow the
  policy returns it to, and the next window is measured the same way. An
  existing install does the same with `shadow: true` in its own
  `.agent-settings.yml`; `enabled: false` turns the check off entirely and
  stops the recording, so it is not the rollback. No fire in eight weeks
  opens a removal review instead.
