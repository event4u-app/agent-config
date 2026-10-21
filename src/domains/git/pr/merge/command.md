---
model_tier: medium
name: git-pr-merge
disable-model-invocation: true
argument-hint: "[all|<pr-number>] [--merge|--no-merge]"
pack: git
intent: "Prepare an open PR to mergeable — sync the base in, resolve conflicts semantically, drive required checks green — then merge what the invocation named"
routes_to: [git-workflow, github-ci]
replaces: []
visibility: advanced
cluster: git-pr-merge
skills: [git-workflow, github-ci]
description: Prepare one open PR to mergeable, or the whole open-PR queue with `all`, then merge what the invocation named — `--no-merge` stops at mergeable-and-open
suggestion:
  eligible: false
  rationale: "Merging is irreversible and gated on the user's own word in the invocation — a suggested merge would manufacture the authorization the Hard Floor requires the user to give."
workspaces:
  - agent-config-maintainer
packs:
  - git
---

# /git-pr-merge

Prepare an open pull request until it is genuinely mergeable — its base merged
in, its conflicts resolved by class rather than by taste, its required checks
green on the head that will actually be merged — and then merge it, if and only
if the invocation authorised that.

```
THE MERGE STEP (§ 9) IS ACTIVE. THE OWNER AUTHORISED IT ON 2026-09-08 AND
ADR-266 RECORDS THE AMENDMENT TO ADR-237 § 4 THAT ACTIVATED IT — THAT RECORD
IS WHAT ACTIVATED IT, NEVER A COMMAND EDIT AND NEVER A GUARD EDIT.
AN EXPLICIT `/pr:merge` INVOCATION IS THE THIS-TURN CONFIRMATION, AND IT
REACHES EXACTLY THE PRs § 1's MANIFEST SNAPSHOTTED FROM IT. IT NEVER REACHES
A PR THAT ARRIVED LATER, A HEAD THE MANIFEST DID NOT RECORD, OR ANY OTHER
HARD-FLOOR ACTION. `--no-merge` STILL STOPS BEFORE § 9.
ADR-282: AN OWNER AUTO-MERGE INSTRUCTION (`--merge`, OR THE OWNER'S OWN WORDS IN
THE SESSION) IS THE SAME CONFIRMATION FOR A `routine` PR. A `needs-council` PR
MERGES ONLY ON TWO CONVERGENT CLEARING SEATS (§ 9a) — OTHERWISE THE OWNER DECIDES.
A `needs-owner` PR IS NEVER SENT FOR CLEARANCE AND NEVER MERGES ON THIS COMMAND.
```

**Why the invocation authorizes** — read [`pr-merge-sync`](../../../../agent-src/contexts/execution/pr-merge-sync.md#why-the-invocation-authorizes).

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|

**Sub-commands rationale** — read [`pr-merge-sync`](../../../../agent-src/contexts/execution/pr-merge-sync.md#sub-commands-rationale).

## Dispatch

Every row below **prepares** first; the last column says whether it then
merges. A row that merges reaches only the PRs its own manifest snapshotted
(§ 1), and only once that PR's required checks are green on the head being
merged (§ 5).

| Invocation | Selects | Prepares | Merges |
|---|---|---|---|
| `/pr:merge <N>` | exactly PR N | yes | yes — PR N |
| `/pr:merge` | ONE PR: green first, then infrastructure/tooling before content, then smallest diff (`changedFiles`, then additions+deletions), tiebreak ascending number | yes | yes — the one PR it selected |
| `/pr:merge all` | the whole open-PR list, under § 6's cutoff | yes | yes — the manifest, in queue order |
| `… --merge` | as above | yes | yes, through § 9a's danger gate — the form [`/roadmap:process-full`](../../../product-basic/roadmap/process-full/command.md) calls when the owner gave an auto-merge instruction (ADR-282) |
| `… --no-merge` | as above | yes | **never**, explicitly. This is the form [`/roadmap:process-full`](../../../product-basic/roadmap/process-full/command.md) calls for its delivery loop without an auto-merge instruction. |

**Bare invocation** — read [`pr-merge-sync`](../../../../agent-src/contexts/execution/pr-merge-sync.md#bare-invocation).

## 1. Snapshot the target — a manifest re-checked before every merge

Compute the queue ONCE at invocation and record it as a manifest of
`(PR number, head SHA)` pairs:

```bash
gh pr list --state open --limit 100 \
  --json number,title,headRefName,headRefOid,baseRefName,additions,deletions,changedFiles,mergeable,updatedAt
gh api repos/:owner/:repo/git/ref/heads/<baseRefName> --jq .object.sha   # per distinct base
```

**Manifest fields, re-read** — read [`pr-merge-sync`](../../../../agent-src/contexts/execution/pr-merge-sync.md#manifest-fields).

## 2. Sync with the base

**Sync procedure, exits** — read [`pr-merge-sync`](../../../../agent-src/contexts/execution/pr-merge-sync.md#sync-procedure-and-exits).

## 3. Resolve conflicts by class, never by taste

**Conflict classes** — read [`pr-merge-sync`](../../../../agent-src/contexts/execution/pr-merge-sync.md#conflict-classes).

```
THE FOUR CLASSES ARE AIDS, NOT EXHAUSTIVE AUTHORITY.
AN UNENUMERATED CONFLICT IS ROUTED, NOT HALTED — AND NEVER RESOLVED SILENTLY.
UNDERSTAND BOTH INTENTS → INSPECT RECENCY, AUTHORS AND OPEN PRs →
PRESERVE BOTH WHERE COMPATIBLE → INDEPENDENT REVIEW FOR A RISKY MERGE →
COUNCIL OR TEAM → THE OWNER ONLY FOR A PRODUCT-SEMANTIC INCOMPATIBILITY.
```

```
A CONFLICT THE RUN CANNOT UNDERSTAND IS NOT AUTOMATICALLY OWNER-OWNED.
"I DO NOT KNOW WHICH SIDE IS RIGHT" IS A REASON TO ESCALATE INDEPENDENTLY,
NOT A REASON TO ASK. THE OWNER RUNG IS REACHED BY THE SEMANTIC TEST,
NEVER BY THE RUN'S OWN UNCERTAINTY.
```

## 4. Superseded check — before any CI is spent

**Superseded probe** — read [`pr-merge-sync`](../../../../agent-src/contexts/execution/pr-merge-sync.md#superseded-probe).

Empty **after that exclusion** ⇒ superseded. **Never merge an empty PR to make
the queue count fall — and never close one on a bare diff.**

```
CLOSING SOMEONE ELSE'S PR IS AN IRREVERSIBLE EXTERNAL ACTION AND IS NOT
GUARDED: `pr-close` IS NOT A `GitOp` AT ALL — NOT IN `BLOCK_OPS`, NOT EVEN
IN `WARN_OPS`. NOTHING WILL STOP IT, WHICH IS WHY THIS COMMAND MUST.

THE RUN NEVER CLOSES A PR ON ITS OWN HEURISTIC. IT STOPS AND ASKS, NAMING
THE EXACT OBJECT: THE PR NUMBER, ITS TITLE, ITS AUTHOR, AND THE PRs THE
CONTENT LANDED VIA. ONE CONFIRMATION PER PR, THIS TURN, PER
non-destructive-by-default. NEVER A BATCH APPROVAL FOR "THE SUPERSEDED ONES".
IT CANNOT NAME WHERE THE CONTENT LANDED → DO NOT EVEN ASK; LEAVE THE PR OPEN
AND RECORD IT AS `blocked-external`.
```

## 5. Drive CI green — bounded

Push, then wait for the verdict on the pushed head. Green means **the required
checks succeeded for the exact head SHA that will be merged** — never a local
run, never an earlier commit ([`/git-pr-create` § 4d](../create/command.md)).

```
THESE ARE HALTS, NOT OPTIONS OF LAST RESORT:
DEPENDENCY CHANGES · WORKFLOW CHANGES · DELETING OR SKIPPING A TEST ·
LOOSENING A THRESHOLD · WEAKENING A GATE · AN EXPECTED-FAIL MARKER ·
A BRANCH-PROTECTION CHANGE.
"DRIVE CI GREEN" AUTHORIZES DIAGNOSIS AND REPAIR, NEVER REMOVING THE CHECK
THAT WOULD HAVE CAUGHT THE PROBLEM.
```

**Red CI repair bounds** — read [`pr-merge-sync`](../../../../agent-src/contexts/execution/pr-merge-sync.md#red-ci-repair-bounds).

## 6. `all` — the queue, and the cutoff that ends it

```
THE CUTOFF IS THE TERMINATION PROOF.
WITHOUT IT, "THE QUEUE MUST SHRINK" DOES NOT TERMINATE AGAINST A SECOND
SESSION THAT KEEPS OPENING PRs — THE RECOMPUTE JUST REFILLS IT.
BOUND: INITIAL MANIFEST + ONE BATCH, WHATEVER ELSE IS HAPPENING IN THE REPO.
```

**The `all` queue** — read [`pr-merge-queue`](../../../../agent-src/contexts/execution/pr-merge-queue.md#the-all-queue).

## 7. Authorization is the owner's sentence, not a timer

```
THE RUN MERGES WHAT THE OWNER AUTHORIZED AND NOTHING ELSE. WHEN THE WORK LEFT
IS OUTSIDE WHAT WAS AUTHORIZED, THE RUN PAUSES, REPORTS, AND ASKS. IT NEVER
INFERS A WIDER MANDATE FROM A LONG RUN OR FROM MOMENTUM.
```

**Authorization rules** — read [`pr-merge-sync`](../../../../agent-src/contexts/execution/pr-merge-sync.md#authorization-rules).

## 8. Kill switches, and what happens after a merge

```
A COMPLETED MERGE IS THE COMMIT POINT.
NEVER AUTO-REVERT AN EARLIER MERGE AS "ROLLBACK" — AFTER FIVE MERGES THERE IS
NO ROLLBACK, ONLY COMPENSATION, AND COMPENSATION IS A SEPARATELY AUTHORIZED
HUMAN DECISION. STOP, EMIT THE MERGE SHAs AND THE REASON, HAND OVER.
```

**Kill switches** — read [`pr-merge-queue`](../../../../agent-src/contexts/execution/pr-merge-queue.md#kill-switches).

## 9a. Danger gate — before every merge (ADR-282)

Once required checks are green on the manifest head and the PR is mergeable,
classify it with the **base revision's** classifier, never the head's:

```bash
BASE="<manifest-base_sha>"
HEAD_SHA="<manifest-head-sha>"
run_base() {
  OUT="$("$@" "$BASE_DIR/src/scripts/classify_merge_risk.ts" --range "$BASE...$HEAD_SHA" --root "$PWD")"
  CODE=$?
  case "$CODE:$(printf '%s\n' "$OUT" | tail -n 1)" in
    "0:verdict: routine" | "1:verdict: needs-council ("* | "2:verdict: needs-owner ("*) printf '%s\n' "$OUT" ;;
    *) return 1 ;;
  esac
}
VERDICT="verdict: needs-owner (temp-dir-unavailable: no private temporary directory)"
if GATE_TMP="$(mktemp -d)" && [ -n "$GATE_TMP" ] && [ -d "$GATE_TMP" ]; then
  BASE_DIR="$GATE_TMP/classifier-base"
  trap 'git worktree remove --force "$BASE_DIR" 2>/dev/null; rm -rf "$GATE_TMP"' EXIT
  if REAL_TMP="$(cd "$GATE_TMP" && pwd -P)" && [ -n "$REAL_TMP" ]; then
    BASE_DIR="$REAL_TMP/classifier-base"
    VERDICT="verdict: needs-owner (base-unavailable: no classifier or no worktree at $BASE)"
    DEPS=2
    if git diff --name-only -z "$BASE...$HEAD_SHA" > "$REAL_TMP/changed" \
       && printf '\0' >> "$REAL_TMP/changed"; then
      FOUND=0
      END_SEEN=0
      while IFS= read -r -d '' CHANGED_PATH; do
        if [ -z "$CHANGED_PATH" ]; then
          END_SEEN=1
          break
        fi
        case "${CHANGED_PATH##*/}" in
          package.json | package-lock.json | npm-shrinkwrap.json | .npmrc | yarn.lock | .yarnrc.yml | \
          pnpm-lock.yaml | bun.lock | bun.lockb) FOUND=1 ;;
        esac
      done < "$REAL_TMP/changed"
      if [ "$END_SEEN" -eq 1 ]; then
        DEPS="$FOUND"
      fi
    fi
    if ! TRACKED="$(git ls-files -- node_modules)" || [ -n "$TRACKED" ]; then
      VERDICT="verdict: needs-owner (runtime-unverified: node_modules unreadable or tracked)"
    elif [ "$DEPS" -gt 1 ]; then
      VERDICT="verdict: needs-owner (manifest-unreadable: the changed-file list could not be read)"
    elif git cat-file -e "$BASE:src/scripts/classify_merge_risk.ts" \
         && git worktree add -q --detach "$BASE_DIR" "$BASE"; then
      cat > "$REAL_TMP/loader.mjs" <<'LOADER'
export async function resolve(specifier, context, next) {
  try { return await next(specifier, context); } catch (error) {
    if (/^\.{1,2}\//.test(specifier) && specifier.endsWith('.js')) return next(`${specifier.slice(0, -3)}.ts`, context);
    throw error;
  }
}
LOADER
      printf '%s\n' "import { register } from 'node:module';" "register('./loader.mjs', import.meta.url);" > "$REAL_TMP/register.mjs"
      if RUN="$(run_base node --experimental-strip-types --no-warnings --import "$REAL_TMP/register.mjs")"; then
        :
      elif [ "$DEPS" -eq 0 ] && RUN="$(run_base node_modules/.bin/tsx)"; then
        :
      elif [ "$DEPS" -eq 1 ] && RUN="$(run_base node_modules/.bin/tsx)"; then
        case "$(printf '%s\n' "$RUN" | tail -n 1)" in
          "verdict: needs-owner ("*) ;;
          *) RUN="verdict: needs-council (runtime-uncertain: no package-free runtime, and the head changes the manifest the checkout's runtime came from)" ;;
        esac
      else
        RUN="verdict: needs-owner (classifier-unusable: no valid verdict under either runtime)"
      fi
      printf '%s\n' "$RUN" | sed '$d'
      VERDICT="$(printf '%s\n' "$RUN" | tail -n 1)"
      if [ "$DEPS" -eq 1 ] && [ "$VERDICT" = "verdict: routine" ]; then
        VERDICT="verdict: needs-council (dependency-manifest: the head changes a dependency manifest)"
      fi
    fi
  fi
fi
echo "$VERDICT"
[ "$VERDICT" = "verdict: routine" ]
```

**Verdicts, gate mechanics** — read [`pr-merge-queue`](../../../../agent-src/contexts/execution/pr-merge-queue.md#danger-gate-verdicts).

## 9. Merge, and the summary

A `needs-council` PR merges only after the check passes for the manifest head:

```bash
node_modules/.bin/tsx src/scripts/merge_clearance.ts --check <N> --head <manifest-head-sha>
```

It runs without `./scripts-run`, whose dispatcher is the head's code; the
script and its record module are on the classifier's trust chain, so a head
that changes either is `needs-owner` and never reaches this check. It exits 0 only when the record for the PR's **live** head exists, parses,
re-derives to `cleared`, and that live head is the manifest head. A push after
the clearance — this run's own included — moves the head and voids it: § 9a
runs again on the new head. A non-zero exit is never overridden by the run's
reading of the replies; the PR is held (below). A `routine` PR needs no check,
and a `needs-owner` PR never reaches one.

**Method choice, drain summary** — read [`pr-merge-queue`](../../../../agent-src/contexts/execution/pr-merge-queue.md#merge-method-choice).

```bash
gh pr merge <N> --<detected-method> --delete-branch --match-head-commit <manifest-head-sha>
```

`--match-head-commit` makes the forge refuse a head the manifest did not record.

Detect the method once, at invocation, and reuse it for the whole queue:

```bash
gh repo view --json mergeCommitAllowed,squashMergeAllowed,rebaseMergeAllowed
```

Never force-merge past a
failing required check, never admin-bypass.

### The PR's worktree — removed after its merge

After a merge this invocation performed, remove the worktree that held the PR's
head branch, if one exists and the user armed it (`worktrees.cleanup: auto`,
ADR-295). If this session is inside that worktree, leave it first (the host's
`ExitWorktree`, or `cd` to the main checkout):

```bash
./scripts-run src/scripts/worktree_cleanup_check apply --branch=<head-branch> --no-delay --respect-setting
```

It removes only a tree that is proven merged, clean, holds no local-only ignored
file and has no other live session — and re-checks all of that immediately
before removing. It never uses force and never deletes the branch. Under
`notify` it prints one line and removes nothing; a refusal is reported, never
retried with force.

### The retro — once, after the last merge

After `/pr:merge <N>` merged, and after `/pr:merge all` reached queue empty or
terminal-only — **never between two merges of one queue** — enqueue every PR this
invocation merged as a retro unit, in one call:

```bash
./scripts-run src/scripts/retro enqueue-merged --pr <N> [--pr <M> …]
```

Depth row: `retro` in `src/config/step-depth-table.json`. The table is in
`shadow` mode, so the retro runs per merge as above; the row records that an
R0/R1 merge would batch it per drain. The § 9a danger gate has no row — it is
not ceremony and no class lowers it.

### Held for you — one block, at the end of the run

**Retro scope, Held for you** — read [`pr-merge-queue`](../../../../agent-src/contexts/execution/pr-merge-queue.md#retro-scope).

## Rules

- **Never merge a PR the invocation did not name.** The authorization is the
  owner's own `/pr:merge` sentence and reaches exactly the manifest § 1
  snapshotted from it; a PR that arrived afterwards needs its own go-ahead.
  `--no-merge` is the explicit way to say stop before § 9.
- **Never widen, patch, or rebuild-around the git guard.** Verification of the
  authorization window is read-only.
- **The base comes in per `git.update_strategy`**: under `merge` it is merged
  in; under `rebase` this command never rebases — a behind PR is reported
  (exit 3) and the rewrite stays the author's, under `git-history-discipline`.
- **Never hand-merge a generated artefact**; regenerate it.
- **Never resolve a conflict outside the four classes**; halt instead.
- **Never call CI green off a local run**; re-verify on the pushed head.
- **Never auto-revert a completed merge.**
- **Mergeability is per-PR against a recorded base SHA**, never a property of
  the queue: making PR *n* mergeable against base `M` says nothing about its
  state once PR *n−1* advances the base.

## See also

- [`/git-pr-create`](../create/command.md) — opens the PR this command finishes.
- [`/roadmap:process-full`](../../../product-basic/roadmap/process-full/command.md) — delegates here for its delivery loop.
- [`git-history-discipline`](../../../../rules/git-history-discipline.md) — never rewrite pushed history.
- [`non-destructive-by-default`](../../../../rules/non-destructive-by-default.md) — the Hard Floor a merge sits under.
