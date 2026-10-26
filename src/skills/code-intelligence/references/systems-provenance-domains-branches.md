# Systems, provenance, domains and branches — the four newer answers

Every answer below comes from files and the local git history. None of them
runs a package manager or reaches a network; ticket and PR text is never read.
Each answer names its witness. Treat it as an index and confirm it before acting.

## Systems — what runs, and why it is installed

| Question | Verb |
|---|---|
| Why is package X installed? | `agent-config code-graph why <package>` — every path from a declaration, read from the lockfiles |
| How much of X does the code use? | `code-graph usage <package>` — a share only when X is installed here; otherwise `surface unknown` |
| What does removing X touch? | `code-graph remove-plan <package>` — call sites, uses without an import, dependents, packages that would leave with it |
| The same on another branch | add `--branch <name>` to `why` / `remove-plan` |

Uses without an import count: scripts, CI steps, tool configs, framework
auto-discovery, type packages and peers. `SY-1` (no use found) is a candidate
for removal, never a verdict. Dynamic loading is invisible to a file reader.

## Provenance — since when, for which ticket

`code-graph provenance <ticket|#pr|file|symbol>`. For a ticket or PR it lists
what that ticket or PR introduced and what it changed. For a file or symbol it
gives the commit that introduced it, the last change, and a timeline. Without a
`ticket_keys` line in `.git-convention.yml`, ticket keys are read only from
branch names and the head of a commit subject, so prose such as `AC-1` is not
mistaken for a ticket. Ask the user's own tracker for the ticket's title and why.

## Domains — which business boundary

Declare domains in `agents/map/layers.yaml`:

```yaml
domains:
  - name: Orders
    paths: ["app/Orders/**"]
    public: ["app/Orders/Api/**"]
domain_allow:
  Billing: [Orders]
```

Without a declaration, folders such as `app/Domain/<X>` or `Modules/<X>` count
as domains. Without either, the map only *proposes* domains. A proposal is
never a breach and never reaches the context pack. The context pack and review
risk name the domains a change crosses.

## Branches — on which branch does it exist

| Question | Verb |
|---|---|
| Index branches without a checkout | `code-graph branches index [ref…]` — default: the current branch, its parent chain, branches checked out lately |
| What differs between two branches | `code-graph branch-diff <a> [<b>]` |
| Where does X exist | `code-graph on-branches <package\|table.column\|symbol\|file>` |
| Drop stale branches | `code-graph branches gc` — never deletes a git ref |
| Keep the chain current | `./scripts-run src/scripts/branch_chain status\|sync\|parent --set <p>` |

`branch_chain sync` merges a parent only into the user's own branches, top-down.
It stops below a lagging parent that is not the user's, aborts on a conflict,
and never pushes.
