---
adr: 244
status: proposed
date: 2026-08-23
decision: playbook-is-a-sixth-context-type
supersedes: —
superseded_by: —
phase: —
type: structural
reopen_policy: directional
provenance:
  kind: agentic
  decision_makers: [anthropic/claude-sonnet-4-5, openai/codex-default]
  human_directed: true
  agentic_mode: council
evidence:
  strength: E2
  basis:
    - tests/fixtures/playbooks/mono-with-generator/README.md
    - src/agent-src/templates/contexts.md
    - src/skills/react-shadcn-ui/SKILL.md
review_trigger: >-
  Reopen on any one of three observations, each of which falsifies a premise
  this record rests on rather than merely arguing against it. First — a playbook
  is observed needing a field the five existing context types cannot carry AND
  that the frontmatter below does not name, since the whole reuse argument is
  that the contexts machinery already fits. Second — the staleness check of
  Phase 3 is found to require a consumer binary to resolve an `invokes` id of
  one of the three supported kinds, since "resolvable without a binary" is what
  restricted the first release to scripts, turbo tasks and turbo generators.
  Third — a `configured` playbook is observed in a tree whose named generator is
  absent, since that is the Class-A rule failing and the grade would then be
  describing nothing. Explicitly NOT a reopen trigger: a consumer preferring a
  different directory name. The home is a placement decision, and re-litigating
  it does not change what a playbook IS.
---

# ADR-244 — a playbook is a sixth context type, not a new artefact class

## Status

**Proposed.** The name and the class are a proposal of `road-to-repo-playbooks`, and
this record says so rather than presenting them as settled.

## Context

The suite cannot reach a repository's own procedure. Verified against the negative
control at `tests/fixtures/playbooks/mono-with-generator/`:

```
$ grep -rn 'turbo gen\|turbo/generators\|plopfile' src/skills/ src/rules/
(no matches)
```

Asked to "add a Toast component to `@org/ui`" in a monorepo that ships
`turbo/generators/config.ts` and a `new:component` script, the suite routes to
`react-shadcn-ui` and writes files directly. The generator is not a stylistic
alternative — it is the **only** artefact that knows this repository's answers
(barrel export, co-located test, layout). The output compiles and is wrong in the
way that costs a reviewer their afternoon, and it fails **silently**: the result
looks like a component, so nothing signals the repository's own procedure was
bypassed.

## Decision

### The home — a sixth context type

A playbook is a **`Playbook` context**, living in the existing contexts directory
beside the five types `src/agent-src/templates/contexts.md` already defines (Module,
Domain, Service, Integration, Infrastructure). It reuses the `contexts.md` machinery
and adds only the frontmatter below.

Decided by AI council 2026-08-23, 2/2 quorum
(`anthropic/claude-sonnet-4-5` + `openai/codex-default`), convergent, over the
alternative of a new `agents/playbooks/` directory: *"reusing established context
machinery as a sixth type minimizes new surface area versus creating a parallel
structure in a new directory."*

**Every later step says "the playbook home" and never spells the path.** That is
deliberate: a step that hard-codes a directory has to be rewritten if the placement is
revisited, and the placement is the part of this decision least likely to survive
contact with a consumer.

### What a playbook is

A file in the playbook home with frontmatter:

| Key | Value | Rule |
|---|---|---|
| `task` | what the procedure accomplishes | free text, one line |
| `scope` | a workspace path, or `repo` | matched against `scope_root` by the precedence rule |
| `grade` | `configured` \| `observed` | see below — the grade is the honesty field |
| `invokes` | list of script / generator / task ids | a `configured` playbook may have **no** step without an entry here |

…and a numbered step body in the `command-writing` shape, where every step carries a
**Source of truth** line (the script, generator or task it invokes — or, for `observed`,
the commit it was seen in) and a **Verify** line in the roadmap `verify:` idiom.

### The grades, and why there are exactly two

- **`configured`** — every step invokes something **present in the tree and seen**. This
  is the Class-A rule of `standards-from-config` applied to procedure: an authoring pass
  may not write a `configured` step for a generator it did not observe.
- **`observed`** — the procedure was inferred from a worked example and cites the commit.
  Weaker, and honest about being weaker.

There is deliberately **no third grade for "recommended"**. A playbook nobody in the
repository follows is a suggestion, and labelling it would create the same
requested-rather-than-enforced label ADR-242's sibling reasoning rejects: a grade that is
neither derived from the tree nor from a commit is a claim with no basis, and every
consumer would have to honour it for it to mean anything.

### What the first release resolves — and the two it does not

`invokes` ids resolve against **`package.json#scripts`**, **`turbo.json` tasks**, and
**`turbo gen` templates**. Nx generators and Plop are **not covered**, and this is a
decision rather than an omission: their discovery needs a consumer binary (`nx list`,
`plop --help`), and the staleness check of `road-to-repo-playbooks` Phase 3 must run
**without one** — a gate that needs a consumer's toolchain installed is a gate that does
not run.

## Consequences

- **Precedence** (Phase 2): when a task matches a playbook whose `scope` contains the
  current `scope_root` (or is `repo`), the playbook is proposed **before** any shipped
  skill. A shipped skill is a generic answer; a playbook is this repository's answer.
- **Staleness** (Phase 3): a deterministic check resolves every `invokes` id and fails
  naming the id when it no longer exists — so renaming a generator surfaces as a failure
  rather than as a playbook that quietly instructs the wrong command. On failure the
  grade **downgrades**, which is the mechanism that keeps `configured` meaning what it
  says.
- **Per-workspace `AGENTS.md`** (Phase 1.3): allowed, subject to the same pointer-ratio
  rule, and its primary content is a pointer list to the playbooks scoped to that
  workspace — not a restatement of them.
- **The five existing context types are untouched.** Nothing about Module, Domain,
  Service, Integration or Infrastructure changes; this adds a row.

## Alternatives

**A new `agents/playbooks/` directory, a new type.** Rejected by the council: it creates
a parallel content system with its own discovery, validation and projection surface, for
an artefact the contexts machinery already fits. The cost is paid on every later change
to either system.

**A skill per procedure.** Rejected on sprawl: a procedure is per-repository, and the
suite's skills are shipped and generic. Encoding a consumer's generator invocation as a
shipped skill is the anti-pattern `size-enforcement` names — and it could not be graded,
because a shipped file cannot observe a consumer's tree.

**A third `recommended` grade.** Rejected above, in § The grades.

## Evidence

| Claim | Basis |
|---|---|
| The suite cannot reach a repository's own generator | `grep -rn 'turbo gen\|turbo/generators\|plopfile' src/skills/ src/rules/` → **no matches**, at this commit |
| It routes to a generic component skill instead | `src/skills/react-shadcn-ui/`, `src/skills/ui-component-architect/` are the only component-shaped dispatch targets |
| Five context types exist today | `src/agent-src/templates/contexts.md:25-29` |
| The failure is silent | the negative control's README § *Why that is a defect* — the output looks like a component |

**Strength E2.** The gap is a reproducible negative observation and the type list is read
from the tree. What is **not** measured is whether a playbook changes what an agent does —
that is `road-to-repo-playbooks` Phase 4, which pre-registers the measure with a named
falsifier before Phase 2 lands. This record does not claim the mechanism works; it decides
what the artefact is.
