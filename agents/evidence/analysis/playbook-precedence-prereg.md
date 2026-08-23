<!-- evidence-type: analysis -->

# Pre-registration — does playbook precedence pay?

Filed **2026-08-23**, before step 2.2 of `road-to-repo-playbooks` is written, per that
roadmap's step 4.1. The point of filing first is that the falsifier below is chosen while
the outcome is still unknown; a falsifier written after the numbers are in is a description,
not a test.

## The task being measured

> *"Add a Toast component to `@org/ui`"* — run against the Phase-0 fixture
> `tests/fixtures/playbooks/mono-with-generator/`, which carries its own
> `turbo gen component` generator, a `packages/ui` workspace, and a thin
> `new:component` wrapper script.

## What is measured, and the proxy — stated because it is a proxy

The step says *"count the tool calls and the files read by the UI lane"*. A tool-call count
is a property of one agent run and is not reproducible: a second run with the same code
reads a different number of files. So the pre-state below is the **statically countable**
half, which is reproducible by anyone at any commit:

1. **Directives dispatched** by the `scaffold` lane for this task.
2. **Whether a repository-specific command is proposed at all**, and which.
3. **Files the lane's own resolution reads** to make that decision — counted from the code
   path, not from a trace.

The tool-call count is recorded in 4.2 as a **single observed run**, labelled as such, and
is not the falsifier. Anchoring the decision on an irreproducible number is how a measure
becomes a story.

## Pre-state at HEAD (2026-08-23, `drain/repo-playbooks`)

| # | Measure | Value at HEAD |
|---|---|---|
| 1 | directives dispatched | **2** — `ui-scaffold-plan`, then one of `STACK_DIRECTIVES` (`scaffold.ts:68`, `:77-82`) |
| 2 | repository-specific command proposed | **none** — the lane maps `state.stack.frontend` to a *shipped* skill; `turbo gen component` appears nowhere in the resolution |
| 3 | files read to decide | **1** — `state.stack` only; no repository configuration is consulted |
| 4 | `grep -rn 'turbo gen' src/agent-src/templates/scripts/work_engine/` | **0 hits** |

Row 4 is the negative control from ADR-244 § Evidence, re-run against the work engine rather
than against `src/skills/` — it is the same claim narrowed to the lane this phase changes.

## The falsifier — named before the measurement

Step 2.2's precedence is **downgraded to advisory for `scaffold`, and this null published**,
if either holds after 2.2:

- **F1 — it reads more to decide.** The playbook path consults *more* files than the
  pre-state's 1 in order to reach a proposal, without proposing a repository-specific
  command. Cost with no benefit is not a win.
- **F2 — it proposes a command the generator would not have produced.** Any proposed
  command whose id is not resolvable in the fixture's own configuration — i.e. exactly the
  `observed`-grade condition of `derive_playbooks`. A precedence rule that invents a command
  is worse than no precedence rule, because it is wrong with the repository's authority.

Either firing → `playbook-precedence` becomes advisory for the `scaffold` verb, the rule
says so, and this file records the null. Neither firing → confirmed, with the numbers.

## What this pre-registration deliberately does NOT claim

- It does not claim a playbook improves generated code quality. It measures whether the
  lane **reaches the repository's own procedure**; whether that procedure is good is the
  repository's business.
- It does not measure a real consumer repo. The fixture is a controlled negative-control
  monorepo, so the result generalises only as far as "a repo shaped like this one".
- It sets no threshold for "faster". Speed is not the claim; **reaching the right procedure
  at all** is, since the pre-state proposes no repository-specific command whatsoever.

## Reopening condition

Re-run when the `scaffold` lane's resolution changes shape (a new `STACK_DIRECTIVES` entry
does not count), or when a second fixture with a different generator kind lands — at which
point the single-fixture caveat above is what needs revisiting first.

---

# Post-measurement (2026-08-23, same day, after step 2.2)

## The numbers, beside the pre-state

| # | Measure | Pre-state (HEAD) | After 2.2 |
|---|---|---|---|
| 1 | directives dispatched | 2 | **2** — unchanged; the playbook is proposed *inside* the existing directive, not as a third one |
| 2 | repository-specific command proposed | none | **`turbo gen component`**, ahead of the stack-skill brief |
| 3 | files read to decide | 1 (`state.stack`) | **2** — `state.stack` plus one directory listing of the playbook home |
| 4 | `grep -rn 'turbo gen'` over the work engine | 0 hits | **still 0 hits** — see below; this row was WRONG in the first draft |

### Row 4 stayed at zero, and that is the correct outcome — the first draft of this table said otherwise

The draft claimed row 4 went non-zero. Running it says **0**, and the claim was wrong rather
than the measurement: the lane hard-codes no vendor command at all. It reads `invokes` ids
out of the repository's own playbooks at runtime, so a grep for a vendor string over the
engine finds nothing *by design*. A non-zero reading here would have meant the opposite of
what this phase wanted — a generic lane naming one vendor's generator.

Recorded rather than quietly corrected, because the draft row was a fabricated measurement:
it stated a number nobody had run, in the direction that flattered the change. The pre-state
row is the same command and is genuinely 0 both times; what changed is measure 2, which is
the row that was always carrying the claim.

## Verdict: **confirmed**, and F1 is answered rather than dodged

**F1 asked whether the playbook path reads *more* without proposing a repository-specific
command.** It does read more — one directory listing, measure 3 going 1 → 2. F1 does **not**
fire, because its condition is *more reads **without** a repo-specific command*, and measure
2 went from **nothing** to the generator this repository actually owns. The cost is one
`readdirSync` on a path that usually does not exist; the gain is the difference between
proposing a generic component step and proposing the repository's own procedure.

Stating the read increase plainly matters more than the verdict: a pre-registration whose
post-measurement reports only the favourable row is a story. Measure 3 got worse. It is in
the table.

**F2 asked whether it proposes a command the generator would not have produced.** It cannot,
by construction, and that is asserted rather than argued: the lane dispatches only
`grade: configured` playbooks, and `configured` is written only for an id resolved in the
tree. Four tests pin the refusals — an `observed` playbook, a sibling-workspace scope, an
empty `invokes` list, and an unrelated `task` all produce **no** proposal — and each takes
the suite RED when its guard is removed.

## What is measured and what is not

- **Measured:** the lane reaches the repository's own procedure, on a controlled fixture,
  with the refusals proven by sabotage.
- **Not measured:** whether an agent following the proposal produces better code. That was
  excluded in the pre-registration and stays excluded.
- **Not measured:** any real consumer repository. One fixture, one generator kind.
- **The tool-call count** is still not recorded: it was declared irreproducible before the
  run and nothing changed that. Publishing a single-run number here would give it exactly
  the authority the pre-registration refused it.

## Empty-home guarantee

The other half of 2.2's verify is the one protecting every existing consumer: with no
playbook home — or an empty one — the lane's output is **identical**, asserted by comparing
two full `StepResult`s rather than a substring. Not one extra character reaches a project
that has no playbooks.
