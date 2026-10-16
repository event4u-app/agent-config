---
complexity: lightweight
review_by: 2026-12-15
---

# Stub: road to a visibility sync that can actually write

> **Arrivals:** 3 — latest `inbox-2026-10-t` (2026-10-16): a round reading the
> update, badge and metadata surfaces found the About homepage, the repository
> description and the topic list all needing a push this channel cannot make.
> Third arrival, so the owner question is now live rather than latent. Earlier:
> 2026-08-03, recorded in `sync-visibility.yml`'s own header note as found
> "while repairing an about-description drift by hand".

> **Stub — not active work.** Found 2026-10-15 while clearing `drift-check` on
> PR #2318. Recorded here rather than repaired drive-by: the repair is a
> repository secret, which is the owner's act and not an edit this tree can
> make.

## The finding

`.github/workflows/sync-visibility.yml` is the declared mutation channel for
the repository's public description and topics. `.github/about.yml` calls
itself the "single source of truth" for them and says edits "are pushed via
`task sync-github-topics` ... on the manually-dispatched `sync-visibility.yml`
workflow", and *"Never edit description / homepage in the GitHub UI."*

**That channel cannot write.** The workflow authenticates with
`secrets.GITHUB_TOKEN` only (`:57`, `:75`, `:81`). Repository-metadata writes
(`PATCH /repos`, `PUT /topics`) need repo-admin rights the Actions token cannot
carry, which the workflow's own header note states — and that note describes
the state as "dispatchable and honest" rather than working. Nothing in the
repository supplies a token that can.

Dispatched 2026-10-15 with `dry_run=false` (run `38622457029`). It printed the
correct diff and then:

```
ERROR: PATCH /repos/{owner}/{repo} → HTTP 403:
{"message":"Resource not accessible by integration"}
```

## Why it matters more than one red check

- **The drift was eight weeks old and nobody could see it.** `about.yml` moved
  on 2026-08-30 (`dfdea863f`); the live description still carried the value
  from 2026-07-27. No one had edited the UI — the tree simply ran ahead of a
  channel that cannot push.
- **`drift-check` reds a PR for something no agent can clear.** It fires on any
  PR touching the visibility manifests or the sync tooling. A Dependabot bump
  across 32 workflow files is enough. The only repair is a human with admin
  rights doing the `PATCH` by hand, which is what happened on 2026-10-15.
- **The source-of-truth claim is not true in practice.** While the only working
  path is a hand-run API call, the live value is whatever a human last typed,
  and `about.yml` is a file that merely agrees with it most of the time.
- **Second hand-repair, same cause.** August's fix made the workflow parseable
  so it could be dispatched; it did not make it able to write. That is why the
  same drift came back.

## Sibling, deliberately not merged into this

`check-platform-anchor` sits in `src/config/gate-reachability-exemptions.json`
with the same shape — a gate that would run "given a PAT in a repository secret
carrying `administration: read`", recorded as the open half of blocker
`ratification-platform-anchor`. Same missing capability class, different scope
(`read` there, `write` here) and a different consumer. Worth deciding together
if a secret is created at all; not the same item, and merging them would hide
that one is a gate and one is a publishing channel.

## What the owner would have to decide

Not written as a blocker on an active roadmap, because nothing is currently
blocked on it — `drift-check` is green again and stays green until the next
drift. Three shapes, for whoever picks this up:

1. **Create the secret.** A PAT with `administration: write`, consumed by
   `sync-visibility.yml` in place of `GITHUB_TOKEN`. The channel then works as
   documented. Cost: a long-lived admin-scoped credential in repository
   secrets, on a public repository.
2. **Accept and say so.** Keep the manual procedure, and change `about.yml`'s
   header and the workflow's note to state that the mutating step requires a
   human with admin rights — so the next reader does not dispatch a workflow
   that is guaranteed to fail. Cheapest, and honest.
3. **Drop the mutating half.** Keep `check-visibility-drift.yml` as the
   detector, delete the apply step, and document the one `gh api` call that
   does the work. Removes a dispatchable surface that cannot do its job.

**Recommendation is deliberately absent:** option 1 trades a real credential
risk for convenience on a surface that changes about twice a year, and that
trade is the owner's to price.

## What would make this active

A third hand-repair, or a drift that reaches something that matters more than
the description — the topics list feeding discovery, for instance.
