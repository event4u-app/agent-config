---
adr: 283
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
    - agents/evidence/council/git-convention-target-resolution-2026-10.md
    - agents/roadmaps/archive/road-to-a-git-convention-that-reaches-every-checkout.md
    - src/scripts/_lib/branch_convergence.ts
    - src/scripts/_lib/git_convention.ts
    - src/scripts/_lib/git_convention_carrier.ts
    - src/scripts/sync_pr_branch.ts
    - tests/scripts/git_convention_carrier.test.ts
    - tests/scripts/git_convention_committed_carrier.test.ts
review_trigger: >-
  Three or more tracked, SHA-pinned team policies exist at the repository root —
  then they are consolidated into one repository-policy file instead of adding
  another. Also reopened if a council explicitly broadens the charter of
  `.branch-convergence.yml`, or if a team names a key it needs to override per
  developer (the revisit condition of the owner's decision D8), or if a
  pull-request caller is found that cannot pass its base as `--base` (D10).
---

# ADR-283 — A team's git convention is carried by a tracked root file of its own

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
| `git.update_strategy` | `.git-convention.yml` at the resolved target commit — the explicit `--base` when given, else the default branch — as the server reports it. Nothing asks a forge for a pull request's base: a caller acting on a pull request passes `--base origin/<its base>`, and the default-branch path is for operations that are not about a pull request (D10). Without a carrier that sets the key there, the developer layers read at the repository root decide, as before. | Only when the carrier at the target commit does not set the key. | A candidate, never adopted: an edit on the branch or in the working tree is shown by `git:convention show` and takes effect once it lands on the target. | The blob at the target commit does not parse → exit 4 from `sync_pr_branch`, `git-convention-malformed`. A blob that parses but whose `git:` is not a map is `invalid` (`git-convention-invalid`, exit 4): the file was read, its `git:` value is outside the schema. A target that resolves to no commit — no `--base` and no default branch, a ref the server does not know, no origin, or origin unreachable at the ref lookup — is exit 1, the base could not be resolved. A target the server names whose commit cannot be fetched is the `unverified` path: exit 0, a warning, nothing merged. A developer file that is itself a refusal is exit 4 whatever the target does. `sync_pr_branch`'s `strategyExit` is the one function that decides these exits. |
| `git.commit_format` | `.git-convention.yml` committed at `HEAD`, at the repository root; it overrides every developer layer, the local layer included (D8). Without a carrier that sets the key, the developer layers read at the repository root decide, never per subdirectory. | Only when the carrier does not set the key. | A committed edit is in force for the branch that carries it, because it shapes that branch's own commits; an uncommitted edit is a candidate shown by `show`. | The blob at `HEAD` does not parse → `malformed`; `show` exits 1 and names the file. |
| `git.branch_pattern` | As `git.commit_format`. | As `git.commit_format`. | As `git.commit_format`. | As `git.commit_format`; a pattern outside the closed alphabet is `invalid`. |

A value outside the schema — a `git:` that is not a map included — is `invalid`
on every key and is refused the same way `malformed` is. `malformed` is kept for
a file whose content is unknown because it does not parse.

### Target resolution (D10)

Until D10 the target without `--base` was the open pull request's base, asked
of the forge. Seven review rounds of that detection (12, 10, 6, 6, 6, 5 and 10
findings) did not converge: each fix to host matching, authentication or
offline classification opened a new case, and a wrong answer read a valid
carrier at the wrong commit and exited 0. The AI council (2/2 convergent,
`agents/evidence/council/git-convention-target-resolution-2026-10.md`) removed
the detection: every pull-request caller already knows its base and passes it.
`show --key` limits `show`'s exit to the requested keys, so `/pr:merge` reads
the strategy without being stopped by a `commit_format` or `branch_pattern` the
pull request's head breaks. The stated loss: a human who runs `sync` or `show`
on a stacked or release-line pull request without `--base` is judged against
the default branch; that usage is documented as non-pull-request only.

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
- `agents/evidence/council/git-convention-target-resolution-2026-10.md` — the
  2/2 reading that removed forge detection from target resolution (D10).
- `tests/scripts/git_convention_carrier.test.ts` — the carrier facts, before and
  after the carrier: a worktree that merged while the primary refused.
- `tests/scripts/git_convention_committed_carrier.test.ts` — the authority rows
  above as behaviour.

## References

- `src/scripts/_lib/git_convention_carrier.ts` — the reader of the carrier.
- `src/scripts/_lib/branch_convergence.ts` — the 2026-09-03 precedent for a
  policy read at the target commit only.
