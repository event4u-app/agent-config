<!-- evidence-type: analysis -->
# What a fork pull request exposes that an issue does not

Step 4.2 of `road-to-one-upstream-that-checks-what-leaves`. D5 holds that a
consumer project sends issues and that a pull request comes only from a
checkout of this package, "until 4.2's matrix shows a fork PR adds no project
linkage over an issue". This is that matrix.

**How it was measured, 2026-10-17.** Read-only, against a live forge, without
opening anything: a public fork pull request and a public issue on
`cli/cli` (a large public repository with both in volume), the fork
repository behind that pull request, both authors' public event streams, the
pull request's timeline, its commits, and the upstream's `refs/pull/<n>/head`.
Nothing was created, so the observation does not perform the act it is
deciding about. The retention and deletion rows are GitHub's own documentation,
read the same day. The account names observed are other people's and are not
reproduced here — only the fields their objects carry.

| Exposed | Issue | Same-repository PR (push rights) | Fork PR | Source |
|---|---|---|---|---|
| Visible account | yes — `user.login` on the issue | yes | yes | `GET /repos/{o}/{r}/issues`, `/pulls` |
| Fork and repository linkage | none | none — the branch lives in the upstream | a **public repository** `<login>/<repo>`, `fork: true`, `parent` = upstream, with its own `created_at` and `pushed_at`; listed under the upstream's `/forks` | `GET /repos/<login>/<repo>`, `GET /repos/{o}/{r}/forks` |
| Branch name | none | upstream branch, `head.ref` | fork branch, `head.ref`, and a `CreateEvent` naming it in the account's public stream | `/pulls`, `GET /users/<login>/events/public` |
| Commit identity | none | author and committer name and e-mail on every commit | the same | `GET /repos/{o}/{r}/pulls/{n}/commits` |
| Activity events in the account's public stream | `IssuesEvent` (opened, closed, reopened), `IssueCommentEvent` | `PullRequestEvent`, `PushEvent`, `CreateEvent` | **`ForkEvent`** plus `CreateEvent`, `PushEvent`, `PullRequestEvent` | `GET /users/<login>/events/public` |
| Timestamps | issue and comment times | plus every commit's author and committer date with its timezone offset | the same, plus the fork's creation time | the endpoints above |
| Timeline events on the upstream item | commented, labeled, closed, reopened, subscribed | plus committed, review_requested, reviewed, merged | the same | `GET /repos/{o}/{r}/issues/{n}/timeline` |
| Notifications | watchers and mentioned users | plus requested reviewers and code owners — none while the PR is a draft | the same | timeline `review_requested`; GitHub's draft semantics |
| Retention | lives with the repository | the head commit stays reachable from `refs/pull/<n>/head` after the branch is deleted | the same — observed: the upstream still serves `refs/pull/<n>/head` for a merged fork PR — and a fork's git data "may be accessed from any repository in the same network … even after a fork is deleted" | `git ls-remote <upstream> refs/pull/<n>/head`; GitHub docs, *What happens to forks when a repository is deleted* |
| Deletion | an admin or owner can **permanently delete** an issue | **no delete endpoint** — a PR can be closed, not deleted | the same; deleting the fork does not remove its commits from the network | GitHub docs, *Deleting an issue*; REST *Pulls* lists no `DELETE` |

## What the release now controls, and what it cannot

Since steps 2.1 and 2.3 of the same roadmap, the commit a release pushes is
built from the net change on `origin/main`, on the branch `retro/<fingerprint>`,
under the signed-in account's noreply identity, dated in UTC and unsigned. So
the rows a fork PR adds over an issue carry, for a release:

- **branch name** — a fingerprint prefix, not a project word;
- **commit identity** — the account that is already visible, at its noreply address;
- **timestamps** — UTC, so no timezone offset;
- **the fork** — a repository named after the upstream, under the account that
  is already visible.

None of these names the consumer project. **In that literal sense the D5
condition is met: a fork PR, as this release builds it, adds no project
linkage over an issue.**

## What the condition did not name

Two rows differ in a way D5's condition does not mention, and they are about
**reversibility**, not linkage:

1. **An issue can be permanently deleted; a pull request cannot**, and its
   head commit stays reachable from the upstream after the branch, and even
   the fork, are gone. A finding the floor missed is recoverable on the issue
   route and permanent on the pull-request route.
2. **A fork is a second durable public object** under the account — a
   `ForkEvent` and a repository that outlives the pull request.

The first row means the payload floor's misses cost more on the pull-request
route than on the issue route. The floor reads credentials and the consumer's
own identifiers only (step 2.2); a company term that is neither still passes.

## Consequence for D5

D5's revisit condition fires in its literal form, and the reversibility
asymmetry is new evidence the condition did not anticipate. D5 was decided by
the council (`council:2026-10-12-upstream-account-visibility`), so reopening it
is the council's call, not this step's. Until it decides, option (b) stands:
the ladder opens a pull request only when the release runs from a checkout of
this package (`findAgentConfigCheckout`), and a consumer project reaches the
issue step.
