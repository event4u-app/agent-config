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
