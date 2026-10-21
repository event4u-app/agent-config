# PR Create — Branch Mechanics

Moved body of the `/create-pr` default flow (`commands/pr/create.md`), per
progressive disclosure. Loaded from the command's pointer lines when a run
takes the branch a section covers — a later push, a merge, an archival sweep,
a scope delta, a footer strip, a red CI. The Iron-Law blocks and the default
flow skeleton stay in the command; this file carries the explanatory prose,
rationale, and per-branch procedure.

## 1b. Freshness gate — MANDATORY before opening any PR

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

## 1b-ii. Update freshness — MANDATORY on EVERY later push to an open PR

The gate above is not creation-only. **Every subsequent push** to a branch with
an open PR (a CI fix, a review response, a follow-up commit) re-runs the same
sequence first: `check_branch_freshness` → on exit `1`, bring
`origin/{resolved-base}` in per `git.update_strategy` (merge by default; under
`rebase` a rebase that is asked for, never a merge, and `sync_pr_branch` refuses
a behind branch with exit 3)
→ regenerate the derived files → verify → push (after a rebase:
`git push --force-with-lease=refs/heads/<b>:<sha> <remote> HEAD:refs/heads/<b>`,
never a plain push). A rebase runs only through § The rebase sequence in
[`branch-update`](../../skills/git-workflow/references/branch-update.md):
the ref the branch publishes is resolved from `@{push}` or the pull request's
head repository — never `@{u}`, and an unresolved target means no rewrite — its
SHA is pinned once after the fetch, must already be in `HEAD`, and is the lease
unchanged — so a collaborator's push lands either before the pin and halts the
stop, or after it and fails the lease, and is never overwritten.
Its steps 1–3 rebase and report, then stop: the regenerate → verify above runs
on the rebased tree, and only then does its step 4 publish, re-running step 1
with the `SAVE` and `EXPECTED` step 3 printed.
A PR that sits open while its base advances goes stale silently; keeping the
base merged **at every touch** means it stays `mergeStateStatus: CLEAN` instead
of accumulating conflicts for the moment the user wants to merge. If the gate
exits `0`, the step costs one `ls-remote` and nothing else.

Once the PR exists, this is also when the resolution gets *more* precise rather
than less: the gate can now read the PR's real `baseRefName` from the forge, so
a stacked or release-line PR is measured against the branch it will actually
merge into instead of against the repo default.

**The whole SEQUENCE is executable now, not just this step.** All six steps —
fetch, integrate the base set, regenerate, verify, re-check freshness, then hand
the push back to you — sit behind one runner, and a dry mode prints each step
with its outcome without touching the tree. In this package that runner is the
`push-ready` target in `taskfiles/dev.yml`; a consumer project wires the same
six steps behind whatever its own task runner is, with steps 3 and 4 being its
own generator and verify commands. The pre-push hook refuses and points at the
runner; the hook never merges, because a merge inside `pre-push` rewrites the
tree at the moment you believe your work is finished.

**The resolution is executable now, not just described.**
`agent-config git:convention sync --base origin/<base>`, `<base>` being the
`baseRefName` of the branch's `OPEN` pull request (`gh pr view --json
state,baseRefName`; a closed or merged one does not count, and without an open
one the base is the default branch), fetches and merges that
base in when the branch is behind, so a stacked or release-line PR is measured
against what it actually merges into. It never asks the forge itself: without
`--base` the target is the default branch, which is right only for a PR into it. The base is a
**set**: when the PR targets something other than the default branch, whether
the default branch joins the set is a per-target policy read from the *target's
own commit*, never from this branch — see `src/scripts/_lib/branch_convergence.ts`.
A non-default target with no policy entry is refused, not guessed. The default
is merged first, so a conflict surfaces against the broader base first. On a conflict it
STOPS and splits the conflicted paths into generated, remeasured and authored —
the first has one correct resolution (regenerate), the second's is to re-run the
measurement on the merged tree (a ratchet baseline, where picking a side is how
the ratchet silently loosens), and the third has none a script may choose.

**On `CONFLICTING`, run this before touching the GitHub web editor.** The web
editor cannot tell generated from authored, so it presents a mechanical
regenerate and a real human decision as the same three-way merge — which is the
failure path road-to-merge-hotspot-drawdown was opened over — a branch resolved
in the web editor while behind its base. The observation itself lives in the
maintainer handover that roadmap cites as its Source, not in the roadmap's own
§ 0, so do not expect to find it there. Adoption of this line is not measurable
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

## 1c. PR-gate — archive completed roadmaps (MANDATORY)

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
