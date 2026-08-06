# `agents/proposals/`

Curated self-improvement proposals — one `<proposal_id>.md` per proposal,
written against
[`templates/agents/proposal.example.md`](../../src/agent-src/templates/agents/proposal.example.md).

Seven artefacts named this directory as an output path before it existed. This
README is what makes it exist: git tracks files, not directories, so a contract
that points at an empty path points at nothing.

## The flow

| Stage | Owner | What lands here |
|---|---|---|
| Draft | [`learning-to-rule-or-skill`](../../src/skills/learning-to-rule-or-skill/SKILL.md) | a proposal with `stage: proposed` |
| Gate | `./agent-config proposal:check agents/proposals/<id>.md` | nothing — a hard refusal on non-zero exit |
| Upstream | [`upstream-contribute`](../../src/skills/upstream-contribute/SKILL.md) | nothing — it opens the PR |

The gate is not advisory: a non-zero `proposal:check` stops the proposal moving
to stage `gated`, and `upstream-contribute` refuses to open a PR.

## Why tracked

The `proposal-drift` workflow greps `stage:` out of every file here in CI, so a
gitignored proposal is invisible to the only thing that watches for drift. This
is the opposite of `agents/runtime/` and `agents/state/`, which are local-only
by design.

Note the current failure mode of that workflow, recorded rather than papered
over: its `find agents/proposals … 2>/dev/null || true` swallowed the missing
directory, so it reported *zero proposals* instead of *no proposal directory*.
An empty directory and an absent one were indistinguishable to it. They no
longer are.

## Not a scratch space

Drafts belong here; experiments do not. A proposal is a *considered* change to a
rule, skill, command, or guideline with a stated problem and a named artefact —
per [`self-improvement-pipeline`](../../docs/guidelines/agent-infra/self-improvement-pipeline.md).
Trying something out means editing `src/` on a branch, never dropping a
half-formed file here.
