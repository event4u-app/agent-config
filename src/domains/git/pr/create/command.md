---
model_tier: medium
name: git-pr-create
disable-model-invocation: true
argument-hint: "[description-only] [:draft|:ready|:final]"
pack: git
intent: "Open a pull request with a generated description and stripped attribution footers"
routes_to: [git-workflow]
replaces: [create-pr]
visibility: advanced
cluster: git-pr-create
skills: [git-workflow]
description: Create a GitHub PR with structured description from Jira ticket and code changes
suggestion:
  eligible: true
  trigger_description: "open a PR, create a pull request, make a PR for this branch, write a PR description"
  trigger_context: "branch is ahead of base and not yet on a PR"
workspaces:
  - agent-config-maintainer
packs:
  - git
---

# /git-pr-create

Top-level entry point for the `/create-pr` family. Bare `/create-pr`
runs the full create-PR flow described below. The `:description-only`
sub-command produces a copyable PR description without creating the PR.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/create-pr` (bare) | this file (`## Default flow`) | Full flow — generate description, push, create PR |
| `/create-pr:description-only` | `commands/pr/create/description-only.md` | Generate the PR description as a copyable markdown block, no PR creation |

## Dispatch

1. Parse the user's argument: `/create-pr[:<sub>] [args]`.
2. Bare `/create-pr` → run the `## Default flow` below verbatim.
3. `/create-pr:description-only` → load
   `commands/pr/create/description-only.md` and follow its
   `## Instructions` section verbatim.
4. Unknown sub-command → print the table above and ask which one.

## Default flow

Uses `/create-pr:description-only` to generate the PR content, then creates the PR via GitHub API.

### 1. Check prerequisites

- Verify the current branch is NOT the default branch (`main` / `master`).
- Run `git status` — warn if there are uncommitted changes.
- Run `git log origin/{default}..HEAD --oneline` to verify there are commits to push.
- **Secret-leak pre-flight (MANDATORY before push):** run
  `./scripts-run src/scripts/check_secret_leak`. On a high-confidence hit, STOP —
  do not push; hand to `.augment/rules/secret-vcs-guard.md` (show, ask, offer the
  alternative, rotate-first if already in history). Pushing publishes the secret.
- If the branch has not been pushed yet, ask the user (in their language) whether to push.

### 1b. Freshness gate — MANDATORY before opening any PR

The branch may have diverged from its target base while you were
working. A PR opened against a stale base creates merge conflicts the
moment another PR lands first — the exact failure that motivates this
gate.

Run, in order:

1. **Ask the gate, never hand-roll the comparison:**

   ```bash
   npx tsx node_modules/@event4u/agent-config/src/scripts/check_branch_freshness.ts
   ```

2. `gh pr list --state open --base {resolved-base} --limit 20 --json number,headRefName,files`
   — open PRs targeting the same base, for the overlap question below.

**Decision matrix:**

| Gate | Overlapping open PR touches same files? | Action |
|---|---|---|
| exit `0`, prints `branch is current` | — | Proceed to Step 2 |
| exit `1` | No | **Bring the base in** per `git.update_strategy` ([`branch-update`](../../../../skills/git-workflow/references/branch-update.md)). `merge` (default): `git fetch origin && git merge origin/{resolved-base} --no-edit` — no need to ask; state that you did it. `rebase`: ask first unless `git-history-discipline` already authorises the rewrite (see `branch-update` for the three cases), never fall back to a merge, and on an already-pushed branch run `branch-update`'s pre-rewrite stop and push with its `--force-with-lease` form. Then run the regeneration set (see the 1b pointer below), then proceed. |
| exit `1` | **Yes** | STOP — surface the overlapping PR number, ask: stack on top of it / wait for it to land / proceed-anyway-and-accept-conflicts / cancel |
| exit `0`, prints `NOT VERIFIED` | — | The base could not be reached, so freshness is **unknown** — not confirmed. Re-run once; if it persists, say the check did not run rather than reporting a pass. A base that `ls-remote` cannot resolve (deleted or renamed after the PR opened, or a fork base) lands here too. |
| warns `could not ask the forge` | — | The **default** base was checked and an open PR against a different base was **not** ruled out. Say so; do not report it as a clean freshness pass. |
| exit `0`, prints nothing, `--quiet` given | — | The success case for the preflight invocation. Any non-verifying path would have printed even under `--quiet`. |
| exit `0`, says `standing on <base> itself` / `detached HEAD` / `no-op in CI` | — | Nothing to check — a branch cannot be behind itself, a detached HEAD has no branch, and in CI the forge owns mergeability. Not a freshness pass; do not cite it as one. |

**1b. Freshness gate — MANDATORY before opening any PR** — on that branch, read [`pr-create-branches-freshness § 1b. Freshness gate — MANDATORY before opening any PR`](../../../../agent-src/contexts/execution/pr-create-branches-freshness.md#1b-freshness-gate--mandatory-before-opening-any-pr).

### 1b-ii. Update freshness — MANDATORY on EVERY later push to an open PR

**1b-ii. Update freshness — MANDATORY on EVERY later push to an open PR** — on that branch, read [`pr-create-branches-freshness § 1b-ii. Update freshness — MANDATORY on EVERY later push to an open PR`](../../../../agent-src/contexts/execution/pr-create-branches-freshness.md#1b-ii-update-freshness--mandatory-on-every-later-push-to-an-open-pr).

### 1c. PR-gate — archive completed roadmaps (MANDATORY)

A roadmap that reached 100% (`count_open == 0 && count_deferred == 0`) must
land **already archived** in this PR — never merged-but-unarchived into the
trunk (that rot is exactly what the PR-gate replaces; see
[`roadmap-progress-sync`](../../../rules/roadmap-progress-sync.md) § PR-gate).
Run the deterministic sweep:

```bash
./agent-config roadmap:archive   # --changed-only (default)
```

**1c. PR-gate — archive completed roadmaps (MANDATORY)** — on that branch, read [`pr-create-branches-freshness § 1c. PR-gate — archive completed roadmaps (MANDATORY)`](../../../../agent-src/contexts/execution/pr-create-branches-freshness.md#1c-pr-gate--archive-completed-roadmaps-mandatory).

### 1d. Completion review (Gate R2) — after the sweep, before the PR

Fixed sequence: (1) the § 1c archival sweep runs first, (2) the R2 review
runs on the post-archival state (the findings artifact references
post-archival paths), (3) the PR is created only with a valid findings
artifact, honest-null, or skip declaration **for the current review-scope
hash** per
[`plan-review-gates § 2`](../../../docs/contracts/plan-review-gates.md).

- A completion-review artifact from the roadmap-completion event
  (`agents/evidence/reviews/<slug>.findings.md`) is re-used when its
  `scope:` equals the current review-scope hash — one artifact covers
  both triggers. **Never compare the `diff:` sha**: it is provenance only
  (§ 2.1), and § 2.0 proves that comparison unsatisfiable — committing the
  artifact moves HEAD, and CI checks out a synthetic merge commit.
  Otherwise dispatch a fresh review via `dispatch_r2_reviewer` (fresh
  subagent, no implementation context, findings BEFORE fixes; every
  finding ends `fixed` / `accepted-risk` / `deferred`).
- **Review last.** Any content commit after the review changes the scope
  hash and invalidates the artifact — freeze the content, then review.
  Artifacts from earlier rounds stay as audit trail under a name outside
  the `*.findings.md` glob; the final round is the binding one.
- Docs-only / plan-only diffs take the explicit skip declaration, never
  a silent skip.
- The agent-side check here is advisory; `check_completion_review` at
  pre-push + CI is the enforcing layer (CI authoritative; advisory mode
  during the Stage-A baseline window). `planning.completion_review:
  false` is the settings escape hatch.
- Depth row: `review` and, for the findings and PR body, `evidence` in
  `src/config/step-depth-table.json`. The table is in `shadow` mode — run
  the review at full depth; `step_receipt` records what the change class
  would have skipped.

### 2. Generate PR content

Run `/create-pr:description-only` Steps 1–4 to generate the PR title and body.
This handles: Jira ticket extraction, diff analysis, commit messages, **PR template filling**.

**CRITICAL**: The PR body MUST use the project's PR template (`.github/pull_request_template.md`).
Read the template file and fill in its sections. If the template does not exist, use the
fallback structure defined in `/create-pr:description-only`. NEVER invent a custom body structure.

**2. Generate PR content** — on that branch, read [`pr-create-branches-content § 2. Generate PR content`](../../../../agent-src/contexts/execution/pr-create-branches-content.md#2-generate-pr-content).

### 2a. Scope delta — what grew, and why it was the agent's

```
AGENT-OWNED SCOPE GROWTH IS RECORDED IN THE PR BODY. ONE LINE PER ITEM.
GROWTH DONE AND NOT RECORDED IS INDISTINGUISHABLE FROM SCOPE CREEP.
A FOLLOW-UP ARTIFACT IS NAMED HERE TOO — IT IS WHAT THE MISSION DID NOT ABSORB.
```

**2a. Scope delta — what grew, and why it was the agent's** — on that branch, read [`pr-create-branches-content § 2a. Scope delta — what grew, and why it was the agent's`](../../../../agent-src/contexts/execution/pr-create-branches-content.md#2a-scope-delta--what-grew-and-why-it-was-the-agents).

### 2b. Council review — explicitly excluded

**2b. Council review — explicitly excluded** — on that branch, read [`pr-create-branches-content § 2b. Council review — explicitly excluded`](../../../../agent-src/contexts/execution/pr-create-branches-content.md#2b-council-review--explicitly-excluded).

### 3. Create the PR (draft-vs-ready, verbosity-gated)

- **Head branch**: EXACT output of `git branch --show-current` from step 1.
- **Base branch**: default branch (`main` / `master`).

`/create-pr` creates the PR as draft silently — draft-or-ready is a routine
confirmation with one obvious answer, so it is never asked. Override
per-invocation with `:ready` / `:final` / `:draft`.

Resolve `"draft"` (first match wins):

1. `:ready` / `:final` arg → `false`.
2. `:draft` arg → `true`.
3. Default → `true` (silent draft).

#### 3a. Tool selection — single-call mandate

```
POST THE PR WITH ONE github-api CALL.
NEVER COMPOSE THE BODY THROUGH SHELL, PYTHON, OR TEMP FILES.
```

**3a. Tool selection — single-call mandate** — on that branch, read [`pr-create-branches-content § 3a. Tool selection — single-call mandate`](../../../../agent-src/contexts/execution/pr-create-branches-content.md#3a-tool-selection--single-call-mandate).

#### 3b. Submit

Create the PR with the approved title/body and the resolved `draft`.

**Verify after `draft: false`** — the GitHub REST API sometimes ignores
the flag:

```bash
gh pr view {number} --json isDraft --jq '.isDraft'
# returns true → gh pr ready {number}
```

**Silent-draft postscript** (rule 3) → see step 4b.

### 4. After creation

#### 4a. Strip attribution footers (mandatory)

**4a. Strip attribution footers (mandatory)** — on that branch, read [`pr-create-branches-content § 4a. Strip attribution footers (mandatory)`](../../../../agent-src/contexts/execution/pr-create-branches-content.md#4a-strip-attribution-footers-mandatory).

#### 4b. Show the PR URL

`→ #N opened: <url>`. Append `→ created as draft — run \`gh pr ready N\` to
flip` when silent-draft (rule 3); omit on ready.

#### 4c. Status claims — verified facts only (MANDATORY)

```
NEVER STATE CI, CHECK, MERGEABILITY, OR DRAFT STATUS FROM ASSUMPTION.
EVERY STATUS CLAIM IN THE REPLY CITES A COMMAND RUN THIS TURN.
"BLOCKED" IS NEVER PARAPHRASED AS "CI IS STILL RUNNING".
```

**4c. Status claims — verified facts only (MANDATORY)** — on that branch, read [`pr-create-branches-content § 4c. Status claims — verified facts only (MANDATORY)`](../../../../agent-src/contexts/execution/pr-create-branches-content.md#4c-status-claims--verified-facts-only-mandatory).

#### 4d. Settle CI before the turn ends (MANDATORY)

```
A PUSH TO AN OPEN PR IS NOT DONE UNTIL CI IS SETTLED.
NEVER END THE TURN ON "CI IS RUNNING" — WAIT FOR THE VERDICT.
RED → DIAGNOSE AND FIX IN THE WORKING TREE. NEVER LEAVE A KNOWN FAILURE UNREAD.
```

**4d. Settle CI before the turn ends (MANDATORY)** — on that branch, read [`pr-create-branches-content § 4d. Settle CI before the turn ends (MANDATORY)`](../../../../agent-src/contexts/execution/pr-create-branches-content.md#4d-settle-ci-before-the-turn-ends-mandatory).

**On red** steps 1–4: see the 4d pointer above.

5. **The push stays gated — and a fix-the-CI instruction IS the gate being
   cleared.** `git push` is a Hard Floor
   ([`non-destructive-by-default`](../rules/non-destructive-by-default.md)) and a
   one-off authorization is spent on the push it was given for
   ([`commit-policy`](../rules/commit-policy.md)). What that forbids is a loop
   that re-pushes on its **own** authority. It does not forbid delivering the
   instruction the user actually gave.

   ```
   AN INSTRUCTION WHOSE DELIVERABLE IS A REMOTE STATE NAMES THE PUSH.
   "FIX THE CI" · "RESOLVE THE CONFLICT WITH MAIN" · "UPDATE THE PR" ·
   "MAKE THE CHECKS GREEN" → THE PUSH IS THAT INSTRUCTION, NOT A SECOND
   OPERATION ON TOP OF IT. DO NOT RAISE A SEPARATE ASK FOR IT.
   ```

6. **Re-verify remotely after the re-push — the fix is not done until the
   REMOTE says so.**

   ```
   A GREEN LOCAL RUN IS NOT THE VERDICT. A GREEN CI RUN ON AN EARLIER
   COMMIT IS NOT THE VERDICT EITHER. THE VERDICT IS A SETTLED CHECK SET
   WHOSE HEAD SHA IS THE BRANCH HEAD YOU JUST PUSHED.
   ```

#### 4e. Jira transition (only when transitioned)

Linked ticket + `routine_confirmations: true` → ask `1. Yes / 2. No`.
Default (`false`) → skip silently. **Only emit a transition line when
an actual Jira API call succeeded** — never announce "skipped".

#### 4f. Settings short-circuit — single read per run

**4f. Settings short-circuit — single read per run** — on that branch, read [`pr-create-branches-content § 4f. Settings short-circuit — single read per run`](../../../../agent-src/contexts/execution/pr-create-branches-content.md#4f-settings-short-circuit--single-read-per-run).

### Rules

- **Always use the PR template** from `.github/pull_request_template.md`.
- **Preview is opt-in** — `commands.create_pr.preview_description` (default `false`). `/create-pr:description-only` always previews.
- **Push the branch first** if needed (with permission).
- **No attribution footers** — see [`no-attribution-footers`](../rules/no-attribution-footers.md); strip-pass at 4a defends against tool injection.
- Only create the PR — never merge.
- Only commit or push with explicit permission.
