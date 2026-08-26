---
model_tier: medium
name: playbook-authoring
description: "Use when a repo has its own generators, scripts or turbo tasks and an agent reaches for a generic skill instead — derive a Playbook context (ADR-244) from the real config, graded by the tree."
domain: engineering
workspaces:
  - engineering
packs:
  - engineering-base
---

# playbook-authoring

A shipped skill is a generic answer to a generic question. A **playbook** is *this*
repository's answer, and it outranks the shipped skill whenever both match — because it
carries decisions the repository already made (file layout, barrel exports, test
co-location, the project's own naming) that no generic skill can know.

This skill derives playbooks from the repository's own configuration. It is the procedure
half of `standards-from-config`'s Class-A rule: the config **is** the standard, so a
playbook step is only trustworthy when the thing it invokes was **seen in the tree**.

## The Iron Law

```
NEVER WRITE A `configured` STEP FOR A GENERATOR YOU DID NOT SEE IN THE TREE.
RESOLVE EVERY `invokes` ID TO A FILE OR A DECLARED TASK, OR GRADE IT `observed`.
INVOKE WHAT THE WRAPPER POINTS AT, NEVER THE WRAPPER.
A KIND THIS RELEASE CANNOT RESOLVE IS REPORTED, NEVER GUESSED AT.
```

## When to use

A repository carries its own generators, task-runner tasks, or creation scripts, **and** an
agent has been observed producing a generic component / module / package instead of running
them. Also on an explicit ask — *"write playbooks for this repo"*, *"why does the agent not
use our generator"*.

## Procedure

1. **Derive, and write nothing yet.** Enumerate the sources in the scope table below and
   list one candidate per repeated procedure, each with its grade — nothing written.
   - **Source of truth:** the repository's own task declarations — see the scope table below
     for which of them this release resolves.
   - **Verify:** every line printed names an id you can run by hand.
2. **Read every proposal, including the graded-`observed` ones.** An unresolved id means go
   look at the tree before deciding what it means.
   - **Verify:** each `configured` proposal's `source_of_truth` points at a file you opened.
3. **Drop the candidates that are not procedures.** A one-off, or a single command wearing a
   playbook's formatting, is a rename — delete it from the set.
   - **Verify:** every surviving candidate is something done repeatedly the same way.
4. **Write, then read the written file.** Write each surviving candidate, then open it.
   - **Verify:** the frontmatter `grade` matches what step 2 established, and a
     `configured` file has no step without an `invokes` entry.
5. **Register the staleness expectation.** The `invokes` ids are what the Phase-3 check
   resolves; a playbook whose ids you cannot name is not finished.
   - **Verify:** every written playbook's `invokes` list is non-empty, and each id can be
     run by hand in the repository.

## The derivation — deterministic, and maintainer-side today

A `derive_playbooks` script implements the enumeration above in this package's own source
tree. It is deterministic and makes no model call: it prints one line per proposal with its
grade, and `⚠️  … grade=observed` is a signal to go look rather than a warning to dismiss.

**It is not exposed as a consumer command.** A consumer install receives this skill and not
that script, so in a consumer repository the procedure above is carried out **by hand
against the grading rules below** — which is why those rules, not the script, are the
substance of this skill. Saying so is the point: a skill that told a consumer to run a
command they do not have would fail on their first attempt.

Either way, read every proposal before writing: the derivation finds *candidates*, and
whether a repeated procedure deserves a playbook is a judgement it does not make.

## Scope of the derivation — and what "not covered" means

A playbook is **ecosystem-neutral**: a Python monorepo's `nox`/`invoke` sessions, a Go
repo's `make` targets, a Rust workspace's `just` recipes and a PHP repo's console commands
are all repeated procedures a playbook can encode, and the artefact class does not care
which. What varies is whether a *deterministic* reader can resolve an invoked id **without
running a consumer binary** — the constraint that decides this release's set, per
[ADR-244](../../../docs/decisions/ADR-244-playbook-is-a-sixth-context-type.md).

| Declared where | Resolvable without a binary? |
|---|---|
| a Node manifest's script map (root and each workspace) | yes — read from the manifest |
| Turborepo task declarations | yes — read from the task file |
| Turborepo generator templates, by the **registered name** rather than the filename | yes — read from the config |
| Nx generators | **no** — the list comes from `nx list` |
| Plop generators | **no** — the list comes from `plop --help` |
| Make / just / nox / invoke / console targets in other ecosystems | **not yet read** — no reader written; the artefact class covers them |

The `no` rows are a decision, not an omission: their discovery requires running a binary the
consumer owns, and the Phase-3 staleness check must run without one. A repo carrying either
is **reported** on stdout, so its maintainer sees the gap rather than receiving a silently
partial set. The last row is honest scope: nothing reads those yet, and a playbook for them
is written by hand against this skill's grading rules.

## The wrapper trap — the one that silently rots

A script like `"new:component": "turbo gen component"` is a **pointer**, not a procedure. A
playbook that invoked `new:component` would keep passing the staleness check after the
generator is renamed, because the script still exists — the exact drift Phase 3 gates.
The derivation therefore unwraps a thin wrapper and records what it points at, and the
`source_of_truth` line on each step names where the id was resolved.

## Grading, in one sentence each

- **`configured`** — every step's id resolved to something in the tree, and each step cites
  where. The reader may follow it without checking.
- **`observed`** — at least one id did **not** resolve. The steps are a hypothesis to
  confirm, and the file says which id failed. Downgrading is the honest outcome; writing
  the stronger claim and hoping is the failure this skill exists to prevent.

## A confirmed canonical answer is a playbook — including the awkward one

A repository's answer to *"where does new code of this kind go"* is a playbook
once it has been **confirmed**, graded like any other: `configured` when every
cited id resolved, `observed` when one did not.

**The awkward case is the one worth writing down.** A public surface version and
an **implementation generation** are independent axes — a `v1` controller can
carry the current internal architecture while a `v2` one is half-migrated and
abandoned. So the canonical answer for a scope is frequently *"the
older-looking lane"*, and that is exactly the answer nobody records because it
reads as a mistake. **ADR-248** holds the evidence order that produces it: a live
decision record, then an executable architecture test, then a shared abstraction
in maintained code, then current tests and contracts, then several recent
analogous implementations, then migration docs, then git history, and **names and
paths last**.

Two bounds, both deliberate:

- **Per scope, never per artefact type.** A repository may legitimately have two
  right answers in two modules. There is no single global exemplar, and a
  playbook claiming one is over-reaching its own `scope`.
- **No second contract.** This is the ADR-244 playbook class unchanged — not a
  conventions map, not a canonicality registry. A confirmed answer is a
  playbook; an unconfirmed one is a hypothesis and belongs in the analysis that
  produced it.

## Output format

1. One playbook per file in the playbook home, frontmatter first: `task`, `scope`, `grade`,
  `invokes`.
2. Report the grade of every proposal in the reply, including the downgraded ones — a set
   reported as "playbooks written" with the `observed` ones unmentioned reads stronger than
   it is.
3. Name any out-of-scope kind the script reported (`nx`, `plop`) rather than dropping it.
4. State the count written and the count read — they must be the same number.

## Gotchas

- **The wrapper trap, and it is the common case.** `"new:component": "turbo gen component"`
  is a pointer. A playbook invoking `new:component` survives the generator being renamed —
  the script still exists — so the staleness check stays green over a broken procedure.
- **The filename is not the generator id.** A Turborepo generator config registers
  `component` inside the file; reading the *filename* yields `turbo gen config`, which
  nobody can run.
- **`observed` reads like a lesser `configured` and is not.** It means an id did not
  resolve. Shipping it unread is shipping a procedure nobody verified.
- **A playbook per declared script grows the estate for nothing.** `build` and `test` are
  one command each; the derivation deliberately proposes nothing for them.

## Do NOT

- Do NOT write `grade: configured` for an id you did not resolve in the tree.
- Do NOT invoke a wrapper script when it points at a generator — invoke the generator.
- Do NOT infer an Nx or Plop generator from a lockfile or a dependency, and do NOT hand a
  Make / just / nox target a `configured` grade this release cannot resolve — report the
  gap; that is the decision, not a shortfall to paper over.
- Do NOT write a playbook for a one-off, or for a procedure the repository does not
  actually repeat.
- Do NOT `--write` a proposal set you have not read.

## When NOT to use this

- The repository has no generators, no task runner, and a handful of one-line scripts —
  there is no repeated procedure to encode, and a playbook per npm script is a rename.
- The procedure is a **one-off**. A playbook is for something done repeatedly the same way.
- The question is *how should this be built in general* — that is the shipped skill's job,
  and a playbook that answers it is a generic skill in the wrong directory.

## See also

- [ADR-244](../../../docs/decisions/ADR-244-playbook-is-a-sixth-context-type.md) — the artefact class, its grades, its home, and the two deferred kinds.
- [`standards-from-config`](../standards-from-config/SKILL.md) — the Class-A rule this applies to procedure rather than to style.
- [`context-document`](../context-document/SKILL.md) — the contexts machinery a playbook reuses as its sixth type.
- [`command-writing`](../command-writing/SKILL.md) — the numbered-step shape the body follows.
