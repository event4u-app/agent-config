---
adr: 282
status: accepted
date: 2026-10-07
decision: a-teams-git-convention-is-carried-by-a-tracked-root-file-of-its-own
supersedes: —
superseded_by: —
phase: road-to-a-git-convention-that-reaches-every-checkout · 2.2
type: structural
reopen_policy: unclassified
protected_dimensions: none
provenance:
  kind: agentic
  agentic_mode: council
  decision_makers: [council, owner]
  human_directed: true
evidence:
  strength: E1
  basis:
    - agents/evidence/council/git-convention-carrier-2026-10.md
    - agents/roadmaps/road-to-a-git-convention-that-reaches-every-checkout.md
    - src/scripts/_lib/branch_convergence.ts
    - src/scripts/_lib/git_convention.ts
    - src/scripts/sync_pr_branch.ts
    - tests/scripts/git_convention_carrier.test.ts
review_trigger: >-
  Three or more tracked, SHA-pinned team policies exist at the repository root —
  then they are consolidated into one repository-policy file instead of adding
  another. Also reopened if a council explicitly broadens the charter of
  `.branch-convergence.yml`, or if a team names a key it needs to override per
  developer (the revisit condition of the owner's decision D8).
---

# ADR-282 — A team's git convention is carried by a tracked root file of its own

## Status

Accepted 2026-10-07. The carrier was chosen by the AI council; the precedence of
the carrier over the developer layers for two of the three keys is the owner's
decision D8 of `road-to-a-git-convention-that-reaches-every-checkout`, recorded
here, not re-decided.

The council evidence is **two single-seat readings, both DEGRADED**, not a
two-seat convergence: `anthropic/claude-sonnet-4-5` over the CLI and
`openai/gpt-4o` over the API, each the only seat that answered its run. Both
chose the same option independently.

## Context

`git.commit_format`, `git.branch_pattern` and `git.update_strategy` were read
from the developer settings layers only. Those files are gitignored in every
repository this package installs into, so a declared `rebase` reached the
checkout it was written in and nowhere else: a worktree, a fresh clone and CI
read no file and merged. The committed team file `.agent-project-settings.yml`
is read for `modules:` only and is labelled legacy.

The tree met the same problem on 2026-09-03 for the branch-convergence policy
and answered it with a tracked root file read at the resolved target commit
only (`src/scripts/_lib/branch_convergence.ts`). A setting that judges a pull
request must not come from that pull request.

## Decision

1. **The carrier is `.git-convention.yml`**, a tracked file at the repository
   root holding one `git:` section with any of the three keys. Its schema is the
   settings schema for those keys; the keys, their template block, schemas and
   contract rows stay where they are.
2. **Option (i) over (ii) and (iii).** A section in `.branch-convergence.yml`
   would put commit-message rules in a file named for branch convergence, and
   doing (ii) honestly means renaming that file. `.agent-project-settings.yml`
   is legacy-labelled, read for one section and outside the class-C fence.
3. **The carrier is behind the class-C fence**: the config-weakening guard
   classifies its basename like the project settings files.

### Authority per key

| Key | Deciding layer | Does the local layer participate? | A branch-local change | `malformed` |
|---|---|---|---|---|
| `git.update_strategy` | `.git-convention.yml` at the resolved target commit — the open pull request's base, else the default branch, else `--base` when given — as the server reports it. Without a carrier that sets the key there, the developer layers read at the repository root decide, as before. | Only when the carrier at the target commit does not set the key. | A candidate, never adopted: an edit on the branch or in the working tree is shown by `git:convention show` and takes effect once it lands on the target. | The blob at the target commit does not parse, or its `git:` is not a map → exit 4 from `sync_pr_branch`, `git-convention-malformed`. A target commit that cannot be resolved is exit 4 as well, `git-convention-unresolvable`, never `merge`. |
| `git.commit_format` | `.git-convention.yml` committed at `HEAD`, at the repository root; it overrides every developer layer, the local layer included (D8). Without a carrier that sets the key, the developer layers read at the repository root decide, never per subdirectory. | Only when the carrier does not set the key. | A committed edit is in force for the branch that carries it, because it shapes that branch's own commits; an uncommitted edit is a candidate shown by `show`. | The blob at `HEAD` does not parse → `malformed`; `show` exits 1 and names the file. |
| `git.branch_pattern` | As `git.commit_format`. | As `git.commit_format`. | As `git.commit_format`. | As `git.commit_format`; a pattern outside the closed alphabet is `invalid`. |

A value outside the schema is `invalid` on every key and is refused the same way
`malformed` is.

## Consequences

- A repository that commits `update_strategy: rebase` gets the same answer in
  the primary checkout, a worktree, a fresh clone and CI.
- The pull request that introduces or changes the carrier is judged by the
  target's old value; `show` names the commit it read and the candidate.
- A repository without the file behaves exactly as before.
- One more root file. The revisit condition caps how many of these exist.

## Alternatives

- **(ii) a section in `.branch-convergence.yml`** — rejected for the naming
  mismatch, not because the 2026-09-03 deferral forbids it; one seat noted the
  deferral concerned globs, inheritance and fallbacks, not the file's scope.
- **(iii) `.agent-project-settings.yml`** — rejected: legacy-labelled, read for
  `modules:` only, bootstrapped by copy, outside the class-C fence.
- **A machine-readable section in `AGENTS.md`** — raised by one seat and
  rejected by it: configuration inside prose.

## Evidence

- `agents/evidence/council/git-convention-carrier-2026-10.md` — both readings,
  with attendance stated per run.
- `tests/scripts/git_convention_carrier.test.ts` — the carrier facts, before and
  after the carrier: a worktree that merged while the primary refused.

## References

- `src/scripts/_lib/branch_convergence.ts` — the 2026-09-03 precedent for a
  policy read at the target commit only.
