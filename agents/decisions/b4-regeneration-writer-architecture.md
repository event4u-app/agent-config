# B4 — the post-merge regeneration writer: a decision packet, not an implementation

> **What this is.** A decision-ready comparison the maintainer can answer from,
> prepared under the one permission `B4` grants an autonomous run in as many
> words: *"An autonomous run may **design and propose** the writer; it may not
> merge it."* There is **no workflow file in this change**, and that is
> deliberate — the other half of the same council ruling is that
> *"'infrastructure ready' is not containment"*, so shipping an inert workflow
> would be the exact move that ruling refused.
>
> **Status:** awaiting maintainer decision. Nothing here is authorised.
>
> **Provenance:** AI council 2/2 on 2026-08-25 (`anthropic/claude-sonnet-4-5` +
> `openai/codex-default`, 3 rounds, blind chairman, $0.044) directed that this
> packet be prepared and bounded this way, while parking
> `road-to-merge-surface-zero` to `later/`. One seat: the packet *"IS the
> pressure — it makes B4 an explicit owner decision with a prepared analysis."*
> The other required it be treated as **blocker-resolution work, not completion
> progress** against steps 1.2 or 1.3, and it is recorded as such: no checkbox
> in that roadmap moves because this file exists.

## The question, in one line

Regenerated output (`docs/proof.md`, `docs/skills-catalog.md`, `llms.txt`,
`agents/reports/originality.{json,md}`, `src/domains/*/pack.yaml`, `agents/index.md`,
`docs/catalog.md`) is currently carried **inside** feature PRs, which is what
makes it the largest pairwise merge surface in the repository. Something must
write it instead. **What?**

## What is actually true today — measured, not assumed

| Fact | Evidence |
|---|---|
| **No workflow in this repository pushes to `main` automatically.** The B4 writer would be the first. | `grep -rln 'git push' .github/workflows/` returns exactly two files. `sync-visibility.yml:93` pushes, but its `on:` is **`workflow_dispatch` only** — a human starts it. `evaluator-umbrella.yml:121` pushes `HEAD:${GITHUB_REF_NAME}` on **pull-request** — that is the **PR branch**, never the trunk. |
| `main` is protected by an **active ruleset**, not classic branch protection. | `gh api repos/…/rulesets` → id `17749383`, `target=branch`, `enforcement=active`. |
| Its rules are `deletion`, **pull-request**, `required_status_checks`, `non_fast_forward`. | same call. **The **pull-request** rule means a direct push to `main` is refused for anyone without bypass.** |
| Exactly one bypass actor exists: a `RepositoryRole` with `bypass_mode: always`. | same call. So a direct-push writer requires the bot to hold that role — i.e. **granting a workflow standing permission to bypass the PR requirement**. |
| **55 % of recent PRs would fail the 1.2 gate today.** | 22 of the last 40 merged PRs touch a generated path (roadmap § 1.2, reproducible with `git log --merges --first-parent -40 origin/main` filtered through `isGenerated` from `src/scripts/sync_pr_branch.ts:198`). |

That fourth row is the crux and it is not a detail: **Option A does not merely
"push to main" — it requires the repository to grant a bot the standing bypass
of its own pull-request rule.** That is a larger authorisation than the
roadmap's phrase "privileged trunk mutation" conveys on first reading, and it is
why this packet exists rather than a workflow.

## The three architectures

### Option A — direct post-merge push to `main`

A workflow on `push: branches: [main]` regenerates and pushes one bot commit
when output changed.

- **Authorisation required:** the bot must bypass the ruleset's **pull-request**
  rule. Today that means adding it as a bypass actor, or running as the single
  existing `RepositoryRole` bypass. **This is the decision.**
- **Loop prevention:** the workflow must ignore its own commits. Conventional
  guard: skip when `github.actor` is the bot, *plus* an idempotence assertion
  (run the generator twice in-job, diff, fail if the second run changes
  anything) — the roadmap's step 1.3 already specifies both.
- **Concurrency:** `concurrency: { group: regen-main, cancel-in-progress: false }`.
  Cancelling mid-push is the failure mode that leaves the trunk half-written.
- **Failure recovery:** a failed push (raced by a human merge) must retry on the
  new tip rather than force. `non_fast_forward` is in the ruleset, so a force
  push is refused anyway — which is a safety property, not an obstacle.
- **Freshness-gate ordering:** step 1.4 moves originality-freshness and
  proof-drift to this job. They must run **after** the regeneration in the same
  job, or the gate measures the pre-regen tree.
- **Cost:** one extra CI run per merge to `main`.
- **What it buys:** the generated paths leave the PR surface entirely. This is
  the only option that fully delivers Phase 1's goal.
- **What it costs:** a standing trunk-write capability that did not previously
  exist, held by a workflow, bypassing the repository's own PR requirement.

### Option B — a bot-authored regeneration PR

The same workflow, but it opens a PR instead of pushing.

- **Authorisation required:** none beyond `contents: write` +
  `pull-requests: write` on a branch. **No ruleset bypass.** The trunk-mutation
  concern B4 names does not arise at all.
- **Loop prevention:** same actor guard; additionally the regen PR must not
  itself trigger the regen workflow.
- **Concurrency / recovery:** simpler — a stale regen PR is closed and reopened
  rather than raced.
- **Cost:** approval latency. Every merge to `main` produces a PR someone must
  merge, and until they do, `main` carries stale generated output — which is the
  state the freshness gates in 1.4 would then fail on.
- **The honest risk, named rather than glossed:** a regen PR that nobody merges
  promptly re-creates the staleness the writer exists to remove, and a **queue**
  of them re-creates the merge surface inside the regen PRs themselves. Whether
  that is acceptable depends on merge cadence, which this packet has not
  measured.
- **What it buys:** ~90 % of Phase 1's benefit (generated output leaves feature
  PRs) at a fraction of the authorisation.

### Option C — stop committing generated output at all

Untrack the generated paths; consumers read them from the npm artifact.

- **Authorisation required:** none, but it is gated on **B1**, which is open:
  untracking `dist/` changes the delivery path (the install one-liner,
  `dist/install/install.mjs`, the prepack chain, `ci-gate-dist-install-freshness`),
  and B1 requires a measured inventory of every consumer reading `dist/` from the
  git tree rather than from the artifact. **That inventory does not exist.**
- **Scope note:** `dist/` is the largest case but not the only one. `docs/proof.md`
  and `docs/catalog.md` are read by humans browsing the repository, so untracking
  them is a different question from untracking `dist/`.
- **What it buys:** the problem disappears rather than being managed.
- **Why it is listed anyway:** both council seats asked for it. If B1's inventory
  ever lands and comes back small, C dominates A and B, and a decision taken now
  without noting C would look arbitrary later.

## The comparison, on the axes that decide it

| Axis | A — direct push | B — regen PR | C — untrack |
|---|---|---|---|
| Ruleset bypass required | **yes** | no | no |
| First-of-its-kind trunk write | **yes** | no | no |
| Delivers Phase 1's goal fully | yes | mostly | yes |
| Staleness window on `main` | none | until the PR merges | n/a |
| New failure mode | half-written trunk on a raced push | unmerged regen-PR queue | consumers reading a path that vanished |
| Blocked on other work | no | no | **B1 (inventory absent)** |
| Reversible | yes — delete the workflow, revoke bypass | yes | **partially** — untracking is a delivery-path change |

## What the maintainer is being asked

**One question:** which architecture, if any, is authorised?

1. **Option A** — and with it, granting a workflow standing bypass of the
   **pull-request** rule on `main`.
2. **Option B** — no bypass; accept the approval-latency and queue risks.
3. **Option C** — first fund B1's consumer inventory, then decide.
4. **None** — the generated paths keep riding in feature PRs, and
   `road-to-merge-surface-zero` stays parked.

A **no** is a complete answer and closes nothing improperly: the roadmap is
parked in `later/` either way, and option 4 is its current de-facto state.

## What this packet deliberately does not do

- **No workflow file.** Not even disabled. *"'Infrastructure ready' is not
  containment"* — the council seat that refused the disabled-landing proposal was
  right that wiring a mechanism which *can* auto-commit to the trunk is the step
  needing authorisation, not switching it on afterwards.
- **No prototype.** One seat allowed a spike *"only to resolve a named technical
  uncertainty"*. No uncertainty here is technical — every open question is an
  authorisation question, and a prototype answers none of them.
- **No recommendation between A and B.** The two differ almost entirely on how
  much authority the maintainer wishes to delegate to CI, which is not a
  judgement an autonomous run should make on the maintainer's behalf. The packet
  is deliberately silent on the choice and loud on the consequences.
- **No claim about merge cadence.** Option B's central risk is
  approval-latency-dependent and that was not measured.

## Revisit-if

The maintainer answers; **or** B1's consumer inventory lands and makes Option C
assessable; **or** the ruleset's bypass configuration changes, which would change
what Option A actually costs.
