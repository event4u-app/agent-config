# PR Create — Branch Mechanics

Moved body of the `/create-pr` default flow (`commands/pr/create.md`), per
progressive disclosure. Loaded from the command's pointer lines when a run
takes the branch a section covers — a later push, a merge, an archival sweep,
a scope delta, a footer strip, a red CI. The Iron-Law blocks and the default
flow skeleton stay in the command; this file carries the explanatory prose,
rationale, and per-branch procedure.

## 2. Generate PR content

The generation honors the cached content flags from step 1 (§4f):
`detail_level` sets the Description tier (default `min`) and `screenshots`
(capability-gated) adds frontend screenshots; a grounded JSON block for
API-endpoint changes is always added (`/create-pr:description-only` § 4.3). Critical-info callouts
(breaking changes / migrations / security / rollback) appear at every tier.

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

## 2a. Scope delta — what grew, and why it was the agent's

Where the run did work beyond the literal task, add a `## Scope delta` section
to the body — one line per item, naming what grew and which row of the
agent-owned list it matched (a necessary internal refactor · a missing test on
a touched path · a regression on a touched path · a small dependency
adjustment · a local API change inside defined semantics · a Boy-Scout cleanup
that is small, local, low blast radius, testable and carries no new product
decision). Full enumeration and the council / owner rows:
[`scope-mechanics`](../authority/scope-mechanics.md)
section Scope growth.

`./scripts-run src/scripts/scope_growth "<one-line description>"` classifies a
single item when the row is not obvious. `unknown` is a real verdict: growth
nothing classifies is growth nobody decided, and it does not silently become
agent work.

A larger unrelated opportunity is **not** a scope delta. It is a follow-up
artifact, named in the same section under *Not absorbed* with its roadmap path,
because a mission delivering everything it met would deliver none of it.

Omit the section entirely when the diff is the task and nothing grew.

## 2b. Council review — explicitly excluded

`/create-pr` does **not** prompt for council review, even when
`ai_council.enabled: true`. Invoking the PR command is an explicit
delivery action; interrupting it with a billable opt-in question is
out of scope.

Users who want a council pass on the diff run `/council diff:<base>..<head>`
**before** `/create-pr`. Do not re-add the prompt here without an explicit
user request.

## 3a. Tool selection — single-call mandate

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

## 4a. Strip attribution footers (mandatory)

Some `github-api` tool surfaces append attribution server-side after
the agent has sent a clean body. Per
[`no-attribution-footers`](../../rules/no-attribution-footers.md), every
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

## 4c. Status claims — verified facts only (MANDATORY)

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

This is the [`direct-answers` Iron Law 2](../../rules/direct-answers.md)
live-state clause applied to the PR surface: git/PR/CI state decays
silently and is NEVER reported from memory or inference.

## 4d. Settle CI before the turn ends (MANDATORY)

§4c makes the REPORT honest. This makes the turn honest: a truthful
"checks are pending" is still an unfinished job, and reporting it as the
closing line hands the user a PR whose outcome nobody has looked at.
Pending is a reason to wait, never a reason to stop.

**Settled** means every check has reached a terminal state:

```bash
npm exec --no -- agent-config ci:settle <n>
gh pr checks <n> --json name,state,link \
  --jq '.[] | select(.state!="SUCCESS" and .state!="SKIPPED") | "\(.state)  \(.name)  \(.link)"'
```

`ci_settle` is the one waiter for this condition, never a hand-written
`gh pr checks` loop, and it is never piped — its last output line is the
verdict. Exit 0: settled green for the named head. Exit 1: settled with a
failed check, listed by the second command — go to **On red**. Exit 2: not a
verdict (no settle within its budget, `gh` unreadable, or the PR merged, closed
or head-diverged); say that rather than reporting a result.

Run the wait as a BACKGROUND command so the turn resumes on its own when
the verdict lands. A foreground sleep-poll chain is blocked, and burning
turns on `gh pr checks` every minute is the tool-loop
[`token-efficiency`](../../rules/token-efficiency.md) forbids.

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
4. **Bounded by the `execution.fix_loop_max` budget (default 10) and its
   ladder, per failing target** ([`autonomous-execution`](../../rules/autonomous-execution.md)).
   Same failure signature twice → the hypothesis is wrong; change approach
   rather than spending the third attempt on a near-identical retry.

   The test is **where the deliverable lives**, and it is decidable: a red check,
   a `CONFLICTING` merge state and a stale PR head are all facts about the
   remote. An unpushed local fix leaves every one of them exactly as it was, so
   treating the push as optional turns the instruction into a no-op and hands the
   user back the state they asked to have changed. This is the same reading
   [`no-cheap-questions`](../../rules/no-cheap-questions.md) IL 5 gives prerequisite
   work and IL 6 gives an already-named destination.

   **What is still NOT covered**, so the floor keeps its teeth: an instruction
   about the *code* only ("fix the type error", "use file X for the tests") — that
   authorizes the edit, never the push. A push to a branch or base the user did
   not name. A push after the named deliverable is already green. And a
   force-push over a commit you did not author, which
   [`git-history-discipline`](../../rules/git-history-discipline.md) gates
   separately and which this clause never reaches.

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
([`no-pr-progress-comments`](../../rules/no-pr-progress-comments.md)).

## 4f. Settings short-circuit — single read per run

`commands.create_pr.preview_description`, `commands.create_pr.detail_level`
and `commands.create_pr.screenshots` are read **once** at the top of the run and cached for the whole `/create-pr`
invocation. Do **not** re-read `.agent-settings.yml` in Step 2 or 4b / 4e —
every branch resolves from the cached values from step 1. The content flags
(`detail_level`, `screenshots`) are consumed by the `/create-pr:description-only` generation step (Step 2); the
confirmation/report flags by steps 3–4.

When `preview_description` resolves to its silent default (`false`), steps
4b + 4e collapse to the single `→ #N opened: <url>` line
from 4b and a silent 4e. No extra file reads, no "checking settings…"
narration, no confirmation prompts. Step 4c is never collapsed — status
claims always carry evidence.
