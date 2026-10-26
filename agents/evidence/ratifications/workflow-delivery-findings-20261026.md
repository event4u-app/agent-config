---
proposed_by: the repository owner, in session on 2026-10-26 (answer "1" — fix both delivery findings in a separate PR)
implemented_by: claude-opus-5.5 subagent session on fix/workflow-delivery-findings
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), rounds 1-2 of 2026-10-26
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
subject: f21d4d7619a0ad4950403a6b54f1c556eda5ad8e2ae0840e847cd08be30e404f
---

<!-- evidence-type: ratification -->

# Ratification — path filters that include their own local action, and a verification job before every deploy

`check_kernel_edit_ratified` gates one file on this branch,
`.github/workflows/consistency.yml`, because that workflow also runs the
ratification gate. The ratification step itself is not touched. The `subject:`
digest above covers that file, computed with
`./scripts-run src/scripts/ratification_subject --files <the branch's changed files>`
at commit `56508d12cc`. Named for the branch, because the pre-push gate reads
this file before the pull request exists.

## What was ratified

The delivery lane of the code-graph map reported two drift classes on `main`:

- **DL-5, eight triggers:** Bench Drift, Consistency (pull_request and push),
  glama MCP smoke, Proof demo (pull_request and push) and Skill Lint
  (pull_request and push) use `.github/actions/setup-task` but their `paths:`
  filters excluded it. Each now names `.github/actions/setup-task/**`. In
  `consistency.yml` that is the whole edit: one entry and a two-line comment in
  each of the two path lists. The check can only run on more pull requests,
  never fewer; no step, job, permission or condition changes.
- **DL-4, four deploy jobs without a test before them:** `deploy-mcp-worker`
  gains a read-only `verify` job (packer tests, Worker typecheck) whose tested
  commit `deploy` checks out; `deploy-site`'s build job runs the internal-link
  check before its artifact is published; `release` gains
  `verify-source-checks`, which confirms `main`'s tip is the merge commit of a
  pull request whose required checks (from the live ruleset, matched by app
  where the ruleset binds one) are green, and `release` refuses any other
  commit; `sync-visibility`'s `preview`, which `apply` needs, runs the sync
  script's tests.

Also in the diff, not gated: the delivery lane counts every file of a local
action instead of the bare directory path, and `lint_workflow_paths` rejects a
filter that excludes the workflow's own file or any file of a local action it
uses. On `origin/main` the extended gate reports exactly the eight exclusions
above; on this branch none.

## The review

Two rounds, prompts committed beside the council record:
`agents/evidence/council/workflow-delivery-findings-ratification-r1-20261026.question.md`
and `-r2-`.

- **Round 1:** both seats `refused`. Both accepted the path filters, the
  `consistency.yml` edit as trigger coverage only, and the site and visibility
  gates. Named defects: the release was not bound to the commit it verified;
  the pull request was the first associated one, not the one whose merge
  commit is the tip; a required check's `integration_id` was ignored; the MCP
  deploy was bound to a tag name rather than a commit; a local action was
  modelled by its manifest only. All five fixed in commits `6f84b344bd` and
  `56508d12cc`, the model change with a lane test and a gate self-test case seen
  red first.
- **Round 2:** both seats `ratified`, no defect named. Both stated the
  `consistency.yml` edit changes only when the check runs, that no gate is
  weakened, that no authority expands and that none of the four deploy gates is
  cosmetic.

Non-blocking notes from round 2, not acted on in this change: the release
verifies the current `main` tip rather than the triggering pull request's merge
commit (a later merge must itself pass the same check, so this is policy, not a
bypass); and the lane's directory listing falls back to the manifest on a
filesystem error instead of reporting it (the strict gate reads tracked files
and does not share that fallback).
