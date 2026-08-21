# skill-writing — section patterns

> Mode body of the [`skill-writing`](../SKILL.md) skill (router-head
> retrofit, 2026-08-20). Content moved VERBATIM from SKILL.md — load this
> file when the mode table in SKILL.md routes here.

## Description-optimizer loop (U1 — held-out, not vibes)

Descriptions are the trigger surface; tune them like a model, not like prose:

1. Draft 2-3 candidate descriptions for the skill.
2. Ensure `evals/triggers.json` has should- AND should-not-trigger queries
   (grow beyond the 5+5 stub when optimizing — more queries = a real test split).
3. Run the helper: `npx tsx src/scripts/optimize_skill_description.ts
   --skill <id> --candidate "…" [--candidate "…"] [--live]` — it splits the
   queries deterministically into train/held-out, scores every candidate
   (deterministic token-overlap proxy by default; `--live` = haiku judge,
   ~$0.001 per query·candidate), and picks the best **held-out** accuracy.
4. Adopt the pick ONLY if it beats the current description on the held-out
   split — a train-only win is overfitting to the queries you wrote.

## Self-QA loop for output-producing skills (optional pattern)

For skills whose product is a rendered/structural artifact (decks, docs,
diagrams, dashboards, generated UI): **assume there are problems** and have a
fresh-eyes pass find them before handing back. The author-context is blind to
its own omissions; a context-free verifier is not.

1. Produce the artifact.
2. Dispatch a fresh subagent (no authoring context) with ONLY the artifact +
   the acceptance criteria: "list every visual/structural defect; assume at
   least one exists."
3. Fix what it finds; re-run once. Two clean passes → done.

Worked example (deck skill): the author renders 12 slides; the fresh-eyes
pass gets the PDF + "check overflow, contrast, orphaned bullets, broken
images" — it flags a clipped title on slide 7 the author never re-read.
One fix, one re-check, done.

Scope: complements `verify-before-complete` (which gates the completion
claim); this pattern is HOW to get the fresh evidence for artifacts where no
deterministic checker exists. Skip it when a real validator covers the
surface (linter, schema, test) — deterministic checks beat judge passes.

## Known-pitfalls section (optional pattern, tool skills)

Tool/integration skills teach the happy path; the recurring support burden is
the *silent* failures — the ones that cost money, corrupt state, or fail with no
error. For a high-support-burden tool skill, add a `## Known pitfalls` section
in this micro-format:

1. **A Symptom → Root cause → Fix table.** Each row starts from the *observable
   symptom* (what the user sees), not the internal cause — the user greps for
   the symptom, not the fix.

   | Symptom | Root cause | Fix |
   |---|---|---|
   | `<what the user observes>` | `<why it happens>` | `<the concrete action>` |

2. **Optionally, a quick-reference anti-pattern checklist** (Anti-pattern ·
   cost/impact · fix difficulty) for traps worth scanning before shipping — add
   it only when it does not restate the skill's existing `## Gotcha` / `## Do
   NOT`; the table is the load-bearing part.

Sourcing floor — **real, not invented**: every entry names a genuinely common
failure (a high-vote community question, a documented incident class), never a
hypothetical. **≤ 5 entries per skill.** The value is a short, sourced,
high-signal list; a long one is noise. A pitfall is a *section on the existing
tool skill*, **never** a new skill per pitfall and never a generated grid (see
[`size-enforcement`](../../../rules/size-enforcement.md) § Per-tool pitfall
content).

## Rationalizations-to-reject section (recommended pattern, security-stop-routed skills)

A skill routed by `security-sensitive-stop` already carries a forbidden-moves or
failure-mode list. Those describe **what is wrong**. They do not answer the
sentence the agent actually produces at the moment it skips the control:
*"this one is internal, so the tenant check is not needed here."*

So those skills add `## Rationalizations to reject`, where each entry is a pair:

- **the shortcut, in the words it will be argued in** — not a label. "It is an
  internal endpoint" beats "insufficient authorization".
- **the mechanism that defeats it** — the concrete fact that makes the argument
  wrong. "Internal is a network claim, not an identity claim; the object id
  still comes from the request."

Writing the shortcut in its persuasive form is the whole point. A list of
labelled anti-patterns is matched against by a reader who has already decided;
a list of *arguments* is matched against by a reader mid-decision, which is when
the skip actually happens.

Keep it to the arguments that have really been made. An invented rationalization
teaches nothing and dilutes the ones that recur.

## Non-negotiable-deliverable section (recommended pattern, adjacent-technology clusters)

Some skills sit next to a technology that is a *tempting wrong answer* — close
enough to look interchangeable, different enough that picking it silently loses
something. The framework-cluster skills the routing rules already disambiguate
pairwise are the standing example.

For those, state the deliverable as a constraint rather than as a preference:

1. **What the output must use.** One sentence, unhedged.
2. **The substitutes to refuse, named.** The agent will meet them; naming them
   is what makes the refusal recognisable rather than a judgement call.
3. **What each substitute loses.** This is the load-bearing line. A prohibition
   without a cost reads as arbitrary and gets argued away the first time the
   substitute is more convenient; a named loss survives that conversation.

The routing rules answer *which skill loads*. This section answers *what the
skill may emit once it has loaded* — a different question, and the one that goes
wrong quietly.

## Destructive-operation gates belong in the description

If a skill performs an operation the user cannot undo — deleting, removing,
publishing, spending — the confirmation gate goes in the **description**, not
only in the body.

The reason is routing order: the description is what the agent reads when
choosing a skill, and the body loads afterwards. A gate stated only in the body
is invisible at exactly the moment the skill is being selected for a task whose
shape the gate might forbid.

One clause is enough — `worktree-lifecycle` carries "safe cleanup that refuses
while unique unmerged commits exist", which tells a router both what the skill
does and what it will not do. Verified by
`./scripts-run src/scripts/lint_skill_descriptions`.

## Upstream-version-notes section (optional pattern, wrapped fast-moving tools)

A skill that wraps an external tool is written against one version of it. When
the tool renames a flag, restructures its report, or drops a subcommand, the
skill does not fail loudly — it fails as **the agent concluding the skill is
wrong**, or, worse, inventing the removed surface so its own instructions still
make sense. Both are silent.

For a skill wrapping a tool that moves faster than this package's release
cadence, add `## Upstream version notes` carrying exactly three things:

1. **The version this skill was written against, and the date it was checked.**
   A version alone rots into a claim nobody can date.
2. **What was renamed** — old → new, one line each. This is the row that stops
   an agent inventing a flag that no longer exists.
3. **How to read older output** — the agent will meet reports from earlier
   versions in logs, issues and fixtures, and needs to know which fields moved
   rather than guessing.

State briefly what is **unchanged** too. "The subcommand set is unchanged since
X" is what lets an agent trust the rest of the skill after finding one stale
flag, instead of second-guessing every instruction that follows.

Scope floor — add it only where drift is **observed**, never anticipated. A
version-notes block on a stable tool is maintenance with no reader, and a stale
one is worse than none: it is a dated claim that is now false.

## Security-constraints section (required pattern, script-bearing skills)

A skill that ships an executable script carries its constraints in the
always-loaded rules — `tool-safety`, `runtime-safety`, `lethal-trifecta-guard`.
That holds while the skill is read inside this suite. It stops holding the
moment the script travels: vendored into a consumer, copied into another
project, or run by an agent whose rule set is not ours. The constraints stay
behind; the script does not.

So a skill with anything under its `scripts/` directory states them **on the
artifact**, in a `## Security constraints` section:

- **What it may touch** — the paths and hosts it legitimately reads or writes.
  Naming the boundary is what makes an overreach reviewable.
- **What it must never do** — the prohibitions specific to THIS script, not a
  restatement of the general rules. "Never writes outside the target directory"
  is checkable; "follows security best practice" is not.
- **Its default-invocation behaviour** — read-only or mutating. A script that
  mutates on a bare invocation already violates the `## Do NOT` list below; if
  it is gated behind a flag, name the flag here.
- **What it sends outbound, if anything** — the egress leg of the lethal
  trifecta. A script with no network access says so in four words, and that
  sentence is the cheapest possible answer to a reviewer's first question.

This duplicates the rules on purpose, and the duplication is the point: the
rules are the enforcement, the section is what survives the artifact leaving
their reach.

## Action-reference split (required pattern, `safety_mode: strict` skills)

`execution.safety_mode: strict` says the skill's execution path may mutate
something. That is a claim made in the frontmatter, and until the body backs it
the claim costs nothing: a reader who follows the procedure top to bottom finds
the mutating step sitting inline with every other step, indistinguishable from a
read.

A strict skill therefore takes one of exactly two shapes, and says which:

- **Gate it inline.** The mutating step carries its precondition in the same
  breath — propose the exact command first, `--dry-run` before the live run, the
  user confirms, verify the effect landed afterwards. The precondition is part of
  the step, never a general reassurance three sections away.
- **Defer it.** The SKILL.md states plainly that it **does not define the
  mutating workflow**, and points the write-path steps at a file under the
  skill's own `references/`. The pointer is the precondition's home: the
  reference opens with what must be true before its first step runs.

Deferring is the better shape once the write path has more than a couple of
steps, and for the reason the split exists at all — the main body stays readable
as the thing an agent loads to decide *whether* to act, while the steps that
change something live behind one deliberate extra read. What it must never
become is a second copy: the reference holds the write path, the SKILL.md holds
the pointer, and neither restates the other.

`skill_linter` nudges (`strict_mode_missing_write_gate`, warning) when a strict
skill's body carries neither shape. It is a warning and it matches on prose, so
treat it as a prompt to check the body rather than a verdict on it — a skill that
gates its write path some third way is doing the right thing and should say so
plainly enough that the next reader sees the gate without running the linter.

Read with § Security-constraints above: that section states what the script may
touch, this one states what must be true before it touches it.

## Mechanism-teaching section (optional pattern, skills whose subject has one)

A procedure tells the agent what to do in the cases you thought of. A
**mechanism** tells it why those steps work, which is the only thing that
transfers to the case you did not. Where a skill's subject has a mechanism worth
one screen — how the cascade resolves, why the queue drops the message, what the
scheduler actually orders — state it in a `## How it works` section, ahead of the
procedure that depends on it.

Keep it to one screen and to mechanisms only: no history, no alternatives-considered,
no restating the procedure in prose. If it takes more than a screen, the skill is
carrying a guideline's worth of material and should point at one instead.

The test for whether it earns its place: name a plausible situation the procedure
does not cover, and check whether this section is enough to answer it. If the
answer is still "read the source", the section is decoration.

Optional, and it gets no gate: "teaches a mechanism" is a prose judgement, and a
predicate over prose is the false-positive class this file's other patterns avoid.

## Illustrative-not-verbatim marker (optional pattern, reference code)

A code block in a skill is read as copy-me by default. When a block is teaching a
*shape* — a signature to mirror, a structure to follow, pseudocode standing in for
the real call — say so on the line above it:

```
<!-- illustrative: shape only, not a working snippet -->
```

One line, immediately above the fence, in the skill's own words if you prefer.
What matters is that the reader can tell shape-teaching code from code that runs,
because the failure mode is silent: an agent pastes the illustration, it almost
works, and the debugging starts from the wrong premise.

The inverse deserves the same care — a block that IS meant to be run verbatim,
where a reader might assume otherwise, says so too. See also `### 4. Add
safe/unsafe example`, which governs a different axis: safe-vs-unsafe, not
runnable-vs-illustrative.

## Headline metric + closing report (optional pattern, optimization skills)

A skill whose job is to make something better — smaller, faster, cheaper, quieter
— has to say **which single number it moves**. Without one, "optimized" is a
claim nobody can check and every run reports success.

So an optimization skill names, up front:

1. **The headline metric.** One number, with its unit and how it is measured.
   "Initial-context tokens, measured by `audit-tokens`" — not "context cost".
2. **The closing report shape.** Before, after, delta, and the command that
   produced both. The same command for both readings, or the delta is not a delta.

State what the metric does **not** capture, in one line. An optimization that
moves the headline number by degrading something it does not measure is the
failure this pattern exists to make visible, and only the author knows where that
edge is.

## Contrastive-example slot (optional pattern, authoring and behaviour skills)

Where a skill's guidance is easy to agree with and hard to apply — tone, phrasing,
question shape, what counts as evidence — a wrong/right pair does what prose
cannot: it shows the near-miss. Six live corpora already carry them:
[`direct-answers-demos`](../../../../../docs/guidelines/agent-infra/direct-answers-demos.md),
[`asking-and-brevity-examples`](../../../../../docs/guidelines/agent-infra/asking-and-brevity-examples.md),
[`language-and-tone-examples`](../../../../../docs/guidelines/agent-infra/language-and-tone-examples.md),
and `autonomy-examples` / `interrupt-examples` / `cheap-question-mechanics` under
`src/agent-src/contexts/execution/`.

Follow one of those rather than inventing a format. The shape they share: the
**wrong** version first, in the form it actually gets written; the **right**
version second; and one line of **why** — which is the load-bearing part, because
a pair without it teaches the specific case and not the rule.

Put the corpus in a guideline or context file and point at it from the skill when
it outgrows a section. A near-miss corpus is reference material read on demand,
not always-loaded prose.
