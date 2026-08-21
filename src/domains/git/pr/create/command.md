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

   It resolves the base itself — explicit `--base`, else the base of the **open
   PR for this branch** as the forge reports it, else the repo default the server
   reports for `HEAD`. Do **not** substitute
   `git rev-list --count HEAD..origin/main`: that hardcodes a base this branch may
   not target, and it reads the local tracking ref, which is a fetch from earlier
   in the session — a memory, not a check (`direct-answers` Iron Law 2).

   **Exit `0` is not a verdict — it means only "did not refuse".** `1` = behind.
   `0` covers "current", "could not verify", and every path with nothing to
   check: a no-op in CI, a detached HEAD, and standing on the base branch
   itself. Read the line, not just the status. A run that could not reach the
   base prints `NOT VERIFIED` and still exits `0`, deliberately, so an offline
   push is never blocked by a network failure; treating that as a clean pass is
   the one misread this gate cannot protect you from.

   **And under `--quiet` a genuine pass prints nothing at all** — that is how
   `taskfiles/ci-fast.yml` invokes it, so silence there is the success case, not
   a missing verdict. Every path that has NOT verified stays loud even under
   `--quiet`. Run it without the flag when you need to read a verdict.

2. `gh pr list --state open --base {resolved-base} --limit 20 --json number,headRefName,files`
   — open PRs targeting the same base, for the overlap question below.

**Decision matrix:**

| Gate | Overlapping open PR touches same files? | Action |
|---|---|---|
| exit `0`, prints `branch is current` | — | Proceed to Step 2 |
| exit `1` | No | **Merge the base in** — `git fetch origin && git merge origin/{resolved-base} --no-edit` — then run the regeneration set below, then proceed. No need to ask; state that you did it. |
| exit `1` | **Yes** | STOP — surface the overlapping PR number, ask: stack on top of it / wait for it to land / proceed-anyway-and-accept-conflicts / cancel |
| exit `0`, prints `NOT VERIFIED` | — | The base could not be reached, so freshness is **unknown** — not confirmed. Re-run once; if it persists, say the check did not run rather than reporting a pass. A base that `ls-remote` cannot resolve (deleted or renamed after the PR opened, or a fork base) lands here too. |
| warns `could not ask the forge` | — | The **default** base was checked and an open PR against a different base was **not** ruled out. Say so; do not report it as a clean freshness pass. |
| exit `0`, prints nothing, `--quiet` given | — | The success case for the preflight invocation. Any non-verifying path would have printed even under `--quiet`. |
| exit `0`, says `standing on <base> itself` / `detached HEAD` / `no-op in CI` | — | Nothing to check — a branch cannot be behind itself, a detached HEAD has no branch, and in CI the forge owns mergeability. Not a freshness pass; do not cite it as one. |

A branch behind its base is **not** current — bring the base in **before** the PR
exists, never after. Auto-merge when there is no file overlap (the common case);
only ask when an overlapping open PR makes the base genuinely ambiguous. Never
improvise the base or silently proceed when behind **and** overlapping. The
10-second fetch beats hours of rebase reconciliation after the parent PR lands.

**After EVERY merge — not only on conflict — regenerate the derived files.**
This is the half that gets skipped, because a merge that lands cleanly *looks*
finished. It is not: these files are **generated**, so a clean auto-merge of
them produces a file that describes neither side's sources. The dashboard is the
usual casualty — it merges without a conflict marker and then reports a roadmap
set that no longer exists.

1. `./agent-config roadmap:progress` → the roadmap dashboard.
2. `./scripts-run src/scripts/build_proof` → `docs/proof.md`.
3. `bash src/scripts/condense.sh --sync`, then `--check` → re-projects
   `dist/agent-src/` from the merged source.
4. Stage the regenerated files, complete the merge, and re-run the touched
   verification before pushing.

On a **conflict**, the same four steps are the resolution — regenerate from the
merged sources, never hand-pick hunks. Only a conflict in **hand-authored**
content (source code, prose you or the other PR wrote) is surfaced to the user;
a generated-file conflict never is.

### 1b-ii. Update freshness — MANDATORY on EVERY later push to an open PR

The gate above is not creation-only. **Every subsequent push** to a branch with
an open PR (a CI fix, a review response, a follow-up commit) re-runs the same
sequence first: `check_branch_freshness` → on exit `1`, merge
`origin/{resolved-base}` in → regenerate the derived files → verify → push.
A PR that sits open while its base advances goes stale silently; keeping the
base merged **at every touch** means it stays `mergeStateStatus: CLEAN` instead
of accumulating conflicts for the moment the user wants to merge. If the gate
exits `0`, the step costs one `ls-remote` and nothing else.

Once the PR exists, this is also when the resolution gets *more* precise rather
than less: the gate can now read the PR's real `baseRefName` from the forge, so
a stacked or release-line PR is measured against the branch it will actually
merge into instead of against the repo default.

**The resolution is executable now, not just described.**
`./scripts-run src/scripts/sync_pr_branch` resolves the base from the open PR
(so a stacked or release-line PR is measured against what it actually merges
into), fetches, and merges it in when the branch is behind. On a conflict it
STOPS and splits the conflicted paths into generated, remeasured and authored —
the first has one correct resolution (regenerate), the second's is to re-run the
measurement on the merged tree (a ratchet baseline, where picking a side is how
the ratchet silently loosens), and the third has none a script may choose.

**On `CONFLICTING`, run this before touching the GitHub web editor.** The web
editor cannot tell generated from authored, so it presents a mechanical
regenerate and a real human decision as the same three-way merge — which is the
exact failure path observed on a branch 11 commits behind base
(road-to-merge-hotspot-drawdown § 0). Adoption of this line is not measurable
without telemetry this repository has ruled out; it is a checklist item, not a
gate.
Deliberately not in the pre-push hook: it mutates the tree, and a hook that
rewrites the tree mid-push turns one rejected push into an unreviewed commit.
Detection belongs in the hook and is already there; resolution is a step you run
with the result in front of you.

After it merges, REGENERATE — a clean auto-merge of a generated file is still
wrong, and this is the step that produced the one stale-dashboard conflict on
every merge of this branch.

Where the project wires this gate into its pre-push chain, a push that goes out
through the hook is covered without a separate step. Run it by hand when you push
with the hook bypassed, or when you are about to open the PR some time after the
last push — that gap is exactly where a base moves unseen.

### 1c. PR-gate — archive completed roadmaps (MANDATORY)

A roadmap that reached 100% (`count_open == 0 && count_deferred == 0`) must
land **already archived** in this PR — never merged-but-unarchived into the
trunk (that rot is exactly what the PR-gate replaces; see
[`roadmap-progress-sync`](../../../rules/roadmap-progress-sync.md) § PR-gate).
Run the deterministic sweep:

```bash
./agent-config roadmap:archive   # --changed-only (default)
```

It `git mv`s each completed roadmap (that this branch touched, per
`git log origin/main..HEAD`) into `agents/roadmaps/archive/`, rewrites inbound
`agents/roadmaps/<x>.md` references to the archive path, regenerates the
dashboard, and stages all of it. No agent-set annotation is involved —
completion is read from the checkbox counts.

- **It staged changes → commit them onto this branch** (`chore(roadmaps):
  archive completed roadmaps`) and include them in the push, so the PR carries
  the archival. Do **not** create the PR with completed-but-unarchived roadmaps
  in the working tree.
- **It reported nothing → proceed.** No completed roadmap in this branch.

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

### 2. Generate PR content

Run `/create-pr:description-only` Steps 1–4 to generate the PR title and body.
This handles: Jira ticket extraction, diff analysis, commit messages, **PR template filling**.

The generation honors the cached content flags from step 1 (§4f):
`detail_level` sets the Description tier (default `min`), `api_examples`
adds a grounded JSON block for API-endpoint changes, and `screenshots`
(capability-gated) adds frontend screenshots. Critical-info callouts
(breaking changes / migrations / security / rollback) appear at every tier.

**CRITICAL**: The PR body MUST use the project's PR template (`.github/pull_request_template.md`).
Read the template file and fill in its sections. If the template does not exist, use the
fallback structure defined in `/create-pr:description-only`. NEVER invent a custom body structure.

**Preview gate** — read `commands.create_pr.preview_description` from
`.agent-settings.yml` (default `false` when unset):

- `false` (default): skip Steps 5–6 of `/create-pr:description-only` (the
  copyable preview block + adjust loop). Use the generated title and body
  directly in Step 3 below. This saves agent tokens by avoiding a full
  re-render of the description in chat. The user can still edit the PR
  body in the GitHub UI after creation.
- `true`: run Steps 5–6 of `/create-pr:description-only` — present the
  title and body as copyable blocks and ask for adjustments before
  proceeding. The user reviews and adjusts the content in that step.

### 2b. Council review — explicitly excluded

`/create-pr` does **not** prompt for council review, even when
`ai_council.enabled: true`. Invoking the PR command is an explicit
delivery action; interrupting it with a billable opt-in question is
out of scope.

Users who want a council pass on the diff run `/council diff:<base>..<head>`
**before** `/create-pr`. Do not re-add the prompt here without an explicit
user request.

### 3. Create the PR (draft-vs-ready, verbosity-gated)

- **Head branch**: EXACT output of `git branch --show-current` from step 1.
- **Base branch**: default branch (`main` / `master`).

**Behavior change vs. legacy:** with `verbosity.routine_confirmations:
false` (default), `/create-pr` creates the PR as draft silently. Override
per-invocation with `:ready` / `:final` / `:draft`. Restore the prompt
by flipping `routine_confirmations: true`. See
[`docs/customization.md` § Verbosity](../../docs/customization.md#verbosity).

Resolve `"draft"` (first match wins):

1. `:ready` / `:final` arg → `false`.
2. `:draft` arg → `true`.
3. `routine_confirmations: true` → ask `1. draft / 2. ready`.
4. Default → `true` (silent draft).

#### 3a. Tool selection — single-call mandate

```
POST THE PR WITH ONE github-api CALL.
NEVER COMPOSE THE BODY THROUGH SHELL, PYTHON, OR TEMP FILES.
```

Use the `github-api` tool **directly** with the markdown body in the
JSON `data` field. The body is a regular JSON string — escaping is the
tool's job, not yours.

```
github-api
  method: POST
  path:   /repos/{owner}/{repo}/pulls
  data:   { "title": "...", "body": "<markdown>", "head": "<branch>",
            "base": "main", "draft": <bool> }
```

**Hard prohibitions** (each one cost 3+ extra tool calls in past runs):

- ❌ `node -e "..."` / shell heredoc hacks
  to serialize the body or POST it.
- ❌ `save-file PR_BODY.md` → read back → `curl -d @PR_BODY.md`.
- ❌ `gh pr create --body-file …` shelling out when `github-api` is
  available in this surface.
- ❌ Splitting `title` and `body` into two API calls (create + PATCH).

The body may contain any Markdown — code fences, tables, multi-line
HTML, emoji. Do **not** preprocess, escape, or strip newlines before
handing it to `github-api`.

If the surface genuinely lacks `github-api` (rare), fall back to
`gh pr create --title "..." --body-file <(echo -n "<body>")` as a
**single** shell call, never the python-urllib path.

#### 3b. Submit

Create the PR with the approved title/body and the resolved `draft`.

**Verify after `draft: false`** — the GitHub REST API sometimes ignores
the flag:

```bash
gh pr view {number} --json isDraft --jq '.isDraft'
# returns true → gh pr ready {number}
```

**Silent-draft postscript** (rule 4) → see step 4b.

### 4. After creation

#### 4a. Strip attribution footers (mandatory)

Some `github-api` tool surfaces append attribution server-side after
the agent has sent a clean body. Per
[`no-attribution-footers`](../rules/no-attribution-footers.md), every
PR body must be re-checked and stripped after every write.

Run this strip-pass **after PR creation and after every body PATCH**:

1. Re-fetch the PR body:
   ```
   GET /repos/{owner}/{repo}/pulls/{number}
   ```
2. Search the body (case-insensitive) for any of:
   - `Generated with [Augment Code]` / `🤖 Generated with`
   - `Pull Request opened by [Augment Code]`
   - `Co-authored by Augment Code`
   - Any `augmentcode.com` link the user did not ask for
3. **No match → done.** Skip steps 4–5; the body is already clean.
   This is the common path and **must not** spend a verify-GET.
4. Match found → remove the footer(s) together with surrounding
   `---` separators and trailing whitespace, then:
   ```
   PATCH /repos/{owner}/{repo}/pulls/{number}
   { "body": "<cleaned body>" }
   ```
   Re-fetch the body **once** to verify the strip stuck. If a
   pattern reappears (server re-injection), repeat the PATCH once;
   if it still reappears, surface the issue to the user and stop
   (do not enter a strip/PATCH loop).
5. Briefly note in the reply how many footers were removed (omit
   the line entirely when nothing was stripped — silence is the
   expected path, not "no footers found").

#### 4b. Show the PR URL (verbosity-gated)

Per `verbosity.post_action_reports` (default `minimal`):

- `off` → nothing.
- `minimal` → `→ #N opened: <url>`. Append `→ created as draft — run
  \`gh pr ready N\` to flip` when silent-draft (rule 4); omit on ready.
- `full` → multi-line: PR number, URL, draft state, base/head, ready-reminder.

#### 4c. Status claims — verified facts only (MANDATORY)

```
NEVER STATE CI, CHECK, MERGEABILITY, OR DRAFT STATUS FROM ASSUMPTION.
EVERY STATUS CLAIM IN THE REPLY CITES A COMMAND RUN THIS TURN.
"BLOCKED" IS NEVER PARAPHRASED AS "CI IS STILL RUNNING".
```

Any statement about the PR's state — in the creation reply, after a
conflict-resolution push, after ANY push to the PR branch — must be
backed by fresh command output from the same reply:

| Claim | Required evidence |
|---|---|
| Draft / ready | `gh pr view <n> --json isDraft` — quote the value |
| CI green / red / running | `gh pr checks <n>` — report the actual fail list; a single `fail` row means FAIL, not "running" |
| Mergeable / conflicts | `gh pr view <n> --json mergeable,mergeStateStatus` |

`mergeStateStatus: BLOCKED` has several distinct causes (failing
checks, draft state, missing reviews, branch protection). Resolving
WHICH one requires `gh pr checks` — never guess the cause. If checks
are still pending, say "pending" and name the pending jobs; never
declare an outcome the output does not show.

This is the [`direct-answers` Iron Law 2](../rules/direct-answers.md)
live-state clause applied to the PR surface: git/PR/CI state decays
silently and is NEVER reported from memory or inference.

#### 4d. Settle CI before the turn ends (MANDATORY)

```
A PUSH TO AN OPEN PR IS NOT DONE UNTIL CI IS SETTLED.
NEVER END THE TURN ON "CI IS RUNNING" — WAIT FOR THE VERDICT.
RED → DIAGNOSE AND FIX IN THE WORKING TREE. NEVER LEAVE A KNOWN FAILURE UNREAD.
```

§4c makes the REPORT honest. This makes the turn honest: a truthful
"checks are pending" is still an unfinished job, and reporting it as the
closing line hands the user a PR whose outcome nobody has looked at.
Pending is a reason to wait, never a reason to stop.

**Settled** means every check has reached a terminal state:

```bash
until [ "$(gh pr checks <n> --json state \
    --jq '[.[] | select(.state=="IN_PROGRESS" or .state=="QUEUED" or .state=="PENDING")] | length')" = "0" ]
do sleep 45; done
gh pr checks <n> --json name,state,link \
  --jq '.[] | select(.state!="SUCCESS" and .state!="SKIPPED") | "\(.state)  \(.name)  \(.link)"'
```

Run the wait as a BACKGROUND command so the turn resumes on its own when
the verdict lands. A foreground sleep-poll chain is blocked, and burning
turns on `gh pr checks` every minute is the tool-loop
[`token-efficiency`](../rules/token-efficiency.md) forbids.

**On red:**

1. **Verify it is yours before fixing it.** Check `origin/main` for the same
   failure and whether any of your files appear in the failing gate's inputs
   (`git diff origin/main --stat -- <path>`). A pre-existing trunk failure is
   reported, not silently adopted — and not silently ignored either.
2. **Get the real log, do not infer.** `gh run view --job <id> --log-failed`.
   Logs are unavailable until the whole run completes; a local repro is often
   faster but can differ from CI (a developer checkout carries settings and
   generated trees a clean runner does not — see the `SCOPE_GUARD_BYPASS` and
   untracked-`dist/` cases). When local and CI disagree, CI is authoritative.
3. **Fix, then re-verify locally** with the narrowest command that proves the
   target green.
4. **Bounded at N=3 per failing target** ([`autonomous-execution`](../rules/autonomous-execution.md)).
   Same failure signature twice → the hypothesis is wrong; change approach
   rather than spending the third attempt on a near-identical retry.
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

   The test is **where the deliverable lives**, and it is decidable: a red check,
   a `CONFLICTING` merge state and a stale PR head are all facts about the
   remote. An unpushed local fix leaves every one of them exactly as it was, so
   treating the push as optional turns the instruction into a no-op and hands the
   user back the state they asked to have changed. This is the same reading
   [`no-cheap-questions`](../rules/no-cheap-questions.md) IL 5 gives prerequisite
   work and IL 6 gives an already-named destination.

   **What is still NOT covered**, so the floor keeps its teeth: an instruction
   about the *code* only ("fix the type error", "use file X for the tests") — that
   authorizes the edit, never the push. A push to a branch or base the user did
   not name. A push after the named deliverable is already green. And a
   force-push over a commit you did not author, which
   [`git-history-discipline`](../rules/git-history-discipline.md) gates
   separately and which this clause never reaches.

6. **Re-verify remotely after the re-push — the fix is not done until the
   REMOTE says so.**

   ```
   A GREEN LOCAL RUN IS NOT THE VERDICT. A GREEN CI RUN ON AN EARLIER
   COMMIT IS NOT THE VERDICT EITHER. THE VERDICT IS A SETTLED CHECK SET
   WHOSE HEAD SHA IS THE BRANCH HEAD YOU JUST PUSHED.
   ```

   Loop back to the top of § 4d — settle again, on the new head. Two traps make
   this more than a restatement:

   - **Stale green.** `gh pr checks` reports the last run it has, which may have
     run against the pre-fix commit. Compare the SHA the checks ran against with
     the PR head before reading a green as yours.
   - **The re-push may not have landed.** A pre-push hook can refuse, and the
     branch can be behind its OWN remote counterpart because someone pressed
     *Update branch*. `git push` exiting non-zero means the PR still carries the
     failure — never report the fix as delivered off a local verification.

   `./scripts-run src/scripts/check_pr_ci_current` answers both in one call.

**When the verdict cannot be reached** — network down, `gh` failing, the run
never registering — say so plainly and name what is unverified. A background
waiter that exits because `gh` errored has NOT observed a green run; treat its
output as absent, not as a pass.

**Not gated by this:** posting the status anywhere. Progress narration belongs
in the chat reply, never as a PR comment
([`no-pr-progress-comments`](../rules/no-pr-progress-comments.md)).

#### 4e. Jira transition (only when transitioned)

Linked ticket + `routine_confirmations: true` → ask `1. Yes / 2. No`.
Default (`false`) → skip silently. **Only emit a transition line when
an actual Jira API call succeeded** — never announce "skipped".

#### 4f. Settings short-circuit — single read per run

`verbosity.routine_confirmations`, `verbosity.post_action_reports`,
`commands.create_pr.preview_description`, `commands.create_pr.detail_level`,
`commands.create_pr.api_examples`, `commands.create_pr.screenshots`,
`commands.create_pr.ui_paths`, and `commands.create_pr.api_paths` are read
**once** at the top of the run and cached for the whole `/create-pr`
invocation. Do **not** re-read `.agent-settings.yml` in Step 2 or 4b / 4e —
every branch resolves from the cached values from step 1. The content flags
(`detail_level`, `api_examples`, `screenshots`, `ui_paths`, `api_paths`) are
consumed by the `/create-pr:description-only` generation step (Step 2); the
confirmation/report flags by steps 3–4.

When all three resolve to their silent defaults (`false` / `minimal` /
`false`), steps 4b + 4e collapse to the single `→ #N opened: <url>` line
from 4b and a silent 4e. No extra file reads, no "checking settings…"
narration, no confirmation prompts. Step 4c is never collapsed — status
claims always carry evidence.

### Rules

- **Always use the PR template** from `.github/pull_request_template.md`.
- **Preview is opt-in** — `commands.create_pr.preview_description` (default `false`). `/create-pr:description-only` always previews.
- **Push the branch first** if needed (with permission).
- **No attribution footers** — see [`no-attribution-footers`](../rules/no-attribution-footers.md); strip-pass at 4a defends against tool injection.
- Only create the PR — never merge.
- Only commit or push with explicit permission.
