<!-- evidence-type: analysis -->

# Ratification review — path filters that include their own local action, and a verification job before every deploy — round 2

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file in it, `.github/workflows/consistency.yml`, is on the ratification gate's list (it is the workflow that runs the ratification gate), so the change needs a two-provider verdict under ADR-268 § 4: an agent may change that workflow but may not ratify its own change. The ratification step itself is not touched.

subject: f21d4d7619a0ad4950403a6b54f1c556eda5ad8e2ae0840e847cd08be30e404f

(The digest covers `.github/workflows/consistency.yml` at commit `393a11d01b`, computed with `./scripts-run src/scripts/ratification_subject`.)

## Background

The repository's code-graph map has a delivery lane that reads the CI workflows. Two of its drift rules fired on `main`:

- **DL-5 (8 triggers):** a `paths:` filter excluded the workflow's own pipeline files. Bench Drift, Consistency (pull_request and push), glama MCP smoke, Proof demo (pull_request and push) and Skill Lint (pull_request and push) all use the local composite action `.github/actions/setup-task`, but their filters did not name it, so an edit to that action alone never ran them.
- **DL-4 (4 jobs):** a deploy job had no `needs:` chain from any test job: `deploy-mcp-worker.yml` `deploy`, `deploy-site.yml` `deploy`, `release.yml` `release`, `sync-visibility.yml` `apply`.

## What the change does

1. **Path filters.** Each of the eight triggers adds `.github/actions/setup-task/**`. In `consistency.yml` that is the only change: one added entry (plus a two-line comment) in the `pull_request` paths list and the same in the `push` paths list. Consistency is a required check; the edit can only make it run on more pull requests, never fewer. No step, job, permission, condition or trigger type changes.
2. **Delivery lane fix.** DL-5 tested a local action as the bare directory path, so a correct `dir/**` entry never cleared it. The workflow's own files now come from one helper, `ownPipelineFiles`, which stands a local action in by its `action.yml`. Test seen red before the fix.
3. **Gate extension.** `lint_workflow_paths` (strict, already in CI) now also rejects a filter that excludes the workflow's own file or a local action it uses, using the lane's functions. Two self-test cases, the rejecting one seen red before the check existed. On `origin/main` the extended check reports exactly the eight exclusions item 1 repairs; on this branch it reports none.
4. **Deploy gates.**
   - `deploy-mcp-worker.yml`: a new `verify` job (read-only token, no Cloudflare secret) resolves the ref exactly as `deploy` did, checks it out, runs the content packer's tests and typechecks the Worker; `deploy` now `needs: verify` and checks out `needs.verify.outputs.ref`.
   - `deploy-site.yml`: the `build` job (whose artifact `deploy` publishes) now also runs the internal-link check `site.yml` runs, before uploading the artifact. `site.yml`'s comment that described the gap is updated.
   - `release.yml`: a new `verify-source-checks` job (read-only token) resolves `main`'s tip, the merged pull request it came from, reads the required status checks from `main`'s live ruleset, and fails unless the latest run of each on that pull request's head is `success` or `skipped`; `release` now `needs:` it. Same `if:` as `release`. The release job's own wait on its release PR's checks (release.ts step 6) is unchanged.
   - `sync-visibility.yml`: `preview` runs the tests of `sync_github_metadata.ts` and `lint_topics_yaml.ts`; `apply` already `needs: preview`.

Verified locally: the delivery lane on this branch reports no DL-4 and no DL-5; `lint_workflow_paths` and its self-test pass; the release verification script was run against the live repository (both required checks found green on the head of the PR that `main`'s tip came from) and against a fabricated failing/in-progress input (refused, exit 1); the tests each new step runs pass.

## Round 1 and what changed

Prompt committed as `agents/evidence/council/workflow-delivery-findings-ratification-r1-20261026.question.md`. Refused 2/2. Both seats agreed the eight path-filter additions, the `consistency.yml` edit (trigger coverage only), and the site and visibility gates are sound and expand no authority. Defects named, each now fixed (commits `6f84b344bd`, `56508d12cc`):

- **Release not bound to the verified commit (both seats).** `verify-source-checks` now outputs the commit it verified (`main`'s tip, read once); the `release` job, right after checking out `main`, refuses to continue unless `git rev-parse HEAD` equals that output ("main moved — re-run").
- **Ambiguous pull-request selection (one seat).** The pull request is now the one whose `merge_commit_sha` equals the verified tip, not the first merged one associated with it.
- **Required-check app identity ignored (one seat).** Each ruleset entry is read as `context` plus `integration_id`; where an `integration_id` is set, only a check run from that app counts and no commit status can stand in for it. Run against the live repository: with the ruleset as it is (no integration ids) both required checks pass; with a fabricated id 15368 (GitHub Actions) it passes; with id 999 it refuses, exit 1.
- **MCP deploy bound to a name, not a commit (one seat).** `verify` records `git rev-parse HEAD` after checkout and outputs it; `deploy` checks out that commit.
- **Local action modelled by its manifest only (both seats).** The lane now lists every file under the action directory on disk, and `lint_workflow_paths` the tracked files under it; `action.yml` stands in only when nothing is listed, so `action.yaml` and implementation files are covered. New lane test (an `action.yaml` action with `dist/index.js`: a manifest-only filter fires DL-5 naming `dist/index.js`, adding `dist/**` clears it) and a gate self-test case (manifest-only filter with a sibling `run.sh` is rejected), both seen red before the change. On `origin/main` the gate still reports exactly the eight setup-task exclusions.

`consistency.yml` has not changed since round 1, so the `subject:` digest is the same.

## What to answer

1. Does the diff contain a defect — in the path filters, the lane fix, the gate extension, or any of the four deploy gates (a step that cannot pass on the runner, a wrong ref, a race, a token or permission problem)? Name file and line for each.
2. Does the change expand any agent's or workflow's authority, or weaken any existing gate? In particular: does the `consistency.yml` edit change anything other than when the check runs?
3. Is any of the four deploy gates a cosmetic gate that cannot actually stop a bad deploy?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## The diff (`git diff origin/main...fix/workflow-delivery-findings`, complete)

```diff
diff --git a/.github/workflows/bench-drift.yml b/.github/workflows/bench-drift.yml
index a8c268e2c6..2490121204 100644
--- a/.github/workflows/bench-drift.yml
+++ b/.github/workflows/bench-drift.yml
@@ -18,6 +18,7 @@ on:
       - "tests/eval/**"
       - "internal/bench/**"
       - ".github/workflows/bench-drift.yml"
+      - ".github/actions/setup-task/**"
   workflow_dispatch:
 
 # Write scope justified (road-to-ci-supply-chain-integrity 1.3, 2026-08-22):
diff --git a/.github/workflows/consistency.yml b/.github/workflows/consistency.yml
index d858d25dc7..5b9c57c4b7 100644
--- a/.github/workflows/consistency.yml
+++ b/.github/workflows/consistency.yml
@@ -41,6 +41,9 @@ on:
       # Any workflow-file change must trigger the REQUIRED Consistency check
       # too, or a workflow-only PR deadlocks on "Expected — Waiting for status".
       - ".github/workflows/**"
+      # The local composite action this workflow uses — an edit to it alone
+      # must run the check that depends on it.
+      - ".github/actions/setup-task/**"
       # Dependency manifests ANYWHERE, for the same deadlock reason — and
       # deliberately as a `**` glob rather than two more literal directories.
       # `.github/dependabot.yml` runs four ecosystems: npm at `/`, `/site` and
@@ -93,6 +96,9 @@ on:
       # Any workflow-file change must trigger the REQUIRED Consistency check
       # too, or a workflow-only PR deadlocks on "Expected — Waiting for status".
       - ".github/workflows/**"
+      # The local composite action this workflow uses — an edit to it alone
+      # must run the check that depends on it.
+      - ".github/actions/setup-task/**"
       # Dependency manifests anywhere — mirrors the pull_request list above so
       # a merged dependency bump is measured on `main` the same way it was on
       # the PR. See that list for why this is a glob and not two directories.
diff --git a/.github/workflows/deploy-mcp-worker.yml b/.github/workflows/deploy-mcp-worker.yml
index 12aebb1007..c583d6ef95 100644
--- a/.github/workflows/deploy-mcp-worker.yml
+++ b/.github/workflows/deploy-mcp-worker.yml
@@ -31,13 +31,18 @@ concurrency:
   cancel-in-progress: false
 
 jobs:
-  deploy:
+  # Tests what `deploy` ships, at the ref it ships, on the read-only token and
+  # with no Cloudflare secret in scope: the content packer's contract and the
+  # Worker's typecheck. `deploy` waits on it.
+  verify:
     runs-on: ubuntu-24.04
     timeout-minutes: 15
-    env:
-      CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
-      CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
-      R2_BUCKET: agent-config-mcp
+    permissions:
+      contents: read
+    outputs:
+      # The commit, not the name: a tag or branch that moves after this job
+      # cannot hand `deploy` code this job did not test.
+      sha: ${{ steps.sha.outputs.sha }}
     steps:
       - name: Resolve target ref
         id: ref
@@ -55,6 +60,48 @@ jobs:
         with:
           persist-credentials: false
           ref: ${{ steps.ref.outputs.ref }}
+
+      - name: Record the commit under test
+        id: sha
+        run: echo "sha=$(git rev-parse HEAD)" >> "$GITHUB_OUTPUT"
+
+      - name: Setup Node
+        uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1  # v7.1.0
+        with:
+          node-version: "22"
+          cache: npm
+          cache-dependency-path: |
+            package-lock.json
+            internal/workers/mcp/package-lock.json
+
+      - name: Install repo deps
+        run: npm ci --no-audit --no-fund --prefer-offline
+
+      - name: Install Worker deps
+        run: npm ci --no-audit --no-fund --prefer-offline
+        working-directory: internal/workers/mcp
+
+      - name: Test the content packer
+        run: npx vitest run tests/scripts/pack_mcp_content.test.ts
+
+      - name: Typecheck the Worker
+        run: npx tsc --noEmit
+        working-directory: internal/workers/mcp
+
+  deploy:
+    needs: verify
+    runs-on: ubuntu-24.04
+    timeout-minutes: 15
+    env:
+      CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
+      CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
+      R2_BUCKET: agent-config-mcp
+    steps:
+      - name: Checkout
+        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1  # v7.0.1
+        with:
+          persist-credentials: false
+          ref: ${{ needs.verify.outputs.sha }}
           fetch-depth: 0
 
       - name: Setup Node
diff --git a/.github/workflows/deploy-site.yml b/.github/workflows/deploy-site.yml
index 2b30e88ae9..0a3cd025ba 100644
--- a/.github/workflows/deploy-site.yml
+++ b/.github/workflows/deploy-site.yml
@@ -30,6 +30,10 @@ concurrency:
 
 jobs:
   build:
+    # The deploy publishes exactly this job's artifact, so the link check that
+    # `site.yml` runs gates it here too — a docs-only change this workflow
+    # deploys never reaches `site.yml`'s path filter.
+    name: Build and link-check
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1  # v7.0.1
@@ -48,6 +52,11 @@ jobs:
           cd site
           npm ci --no-audit --no-fund --prefer-offline
           npm run build
+      # Root deps provide node_modules/.bin/tsx for ./scripts-run.
+      - name: Install root dependencies (tsx for scripts-run)
+        run: npm ci --no-audit --no-fund --prefer-offline
+      - name: Internal-link check (no dangling links in the built site)
+        run: ./scripts-run src/scripts/check_site_links
       - uses: actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9  # v5.0.0
         with:
           path: site/dist
diff --git a/.github/workflows/glama-mcp-smoke.yml b/.github/workflows/glama-mcp-smoke.yml
index e1f21880b0..02a054954f 100644
--- a/.github/workflows/glama-mcp-smoke.yml
+++ b/.github/workflows/glama-mcp-smoke.yml
@@ -36,6 +36,7 @@ on:
       - ".dockerignore"
       - "taskfiles/mcp.yml"
       - ".github/workflows/glama-mcp-smoke.yml"
+      - ".github/actions/setup-task/**"
   schedule:
     # Weekly bitrot guard on the default branch: pinned toolchain
     # (node 24 / uv / python 3.11 / debian trixie) rots upstream.
diff --git a/.github/workflows/proof-demo.yml b/.github/workflows/proof-demo.yml
index e71e9f8108..67c9a29b51 100644
--- a/.github/workflows/proof-demo.yml
+++ b/.github/workflows/proof-demo.yml
@@ -20,6 +20,7 @@ on:
       - "docs/comparison.yaml"
       - "docs/proof.md"
       - ".github/workflows/proof-demo.yml"
+      - ".github/actions/setup-task/**"
   push:
     branches: [main, master]
     paths:
@@ -33,6 +34,7 @@ on:
       - "docs/comparison.yaml"
       - "docs/proof.md"
       - ".github/workflows/proof-demo.yml"
+      - ".github/actions/setup-task/**"
   workflow_dispatch:
 
 concurrency:
diff --git a/.github/workflows/release.yml b/.github/workflows/release.yml
index 473e99289b..45b8cc8ebf 100644
--- a/.github/workflows/release.yml
+++ b/.github/workflows/release.yml
@@ -92,8 +92,74 @@ permissions:
   actions: write
 
 jobs:
+  # The release job builds from `main`, and its own wait (release.ts step 6)
+  # covers the release PR it opens. This job makes the other half explicit:
+  # the commit `main` stands on is the merge commit of a pull request whose
+  # required checks — main's live ruleset, not a copied list, matched by name
+  # and, where the ruleset binds one, by the app that must report it — finished
+  # green. Latest run per check wins, so a re-run that went green counts and one
+  # that went red does not. It outputs the commit it verified, and `release`
+  # refuses to run on any other. Read-only token; nothing here can release.
+  verify-source-checks:
+    name: Verify source checks
+    runs-on: ubuntu-latest
+    if: github.event_name == 'workflow_dispatch' || (github.event.pull_request.merged == true && (contains(github.event.pull_request.labels.*.name, 'release') || contains(github.event.pull_request.labels.*.name, 'release:major') || contains(github.event.pull_request.labels.*.name, 'release:minor') || contains(github.event.pull_request.labels.*.name, 'release:patch')))
+    permissions:
+      contents: read
+      checks: read
+      pull-requests: read
+      statuses: read
+    outputs:
+      sha: ${{ steps.verify.outputs.sha }}
+    env:
+      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+      REPO: ${{ github.repository }}
+    steps:
+      - name: Required checks of the commit being released are green
+        id: verify
+        run: |
+          set -euo pipefail
+          TIP=$(gh api "repos/$REPO/commits/main" --jq .sha)
+          export TIP
+          # shellcheck disable=SC2016 # $ENV.TIP is jq, not shell
+          head=$(gh api "repos/$REPO/commits/$TIP/pulls" --jq '[.[] | select(.merged_at != null and .merge_commit_sha == $ENV.TIP)][0].head.sha // empty')
+          if [ -z "$head" ]; then
+            echo "::error title=No source checks::main at $TIP is not the merge commit of a pull request, so it has no pull-request checks to verify. Nothing was released."
+            exit 1
+          fi
+          required=$(gh api "repos/$REPO/rules/branches/main" --jq '[.[] | select(.type == "required_status_checks") | .parameters.required_status_checks[] | [.context, ((.integration_id // "") | tostring)] | @tsv] | unique | .[]')
+          if [ -z "$required" ]; then
+            echo "::error title=No required checks::main declares no required checks, so there is nothing to verify the release against. Nothing was released."
+            exit 1
+          fi
+          runs=$(gh api --paginate "repos/$REPO/commits/$head/check-runs?per_page=100" --jq '.check_runs[] | [.id, .name, .status, (.conclusion // "none"), ((.app.id // "") | tostring)] | @tsv')
+          statuses=$(gh api --paginate "repos/$REPO/commits/$head/statuses?per_page=100" --jq '.[] | [.id, .context, .state] | @tsv')
+          echo "main $TIP — merged from pull-request head $head"
+          failed=0
+          while IFS=$'\t' read -r ctx app; do
+            run=$(printf '%s\n' "$runs" | awk -F'\t' -v n="$ctx" -v a="$app" '$2 == n && (a == "" || $5 == a)' | sort -n -k1,1 | tail -n 1)
+            if [ -n "$run" ]; then
+              verdict=$(printf '%s' "$run" | awk -F'\t' '{ print $3 "/" $4 }')
+            elif [ -z "$app" ]; then
+              state=$(printf '%s\n' "$statuses" | awk -F'\t' -v n="$ctx" '$2 == n' | sort -n -k1,1 | tail -n 1 | cut -f3)
+              verdict="status/${state:-missing}"
+            else
+              verdict="missing-from-app-$app"
+            fi
+            case "$verdict" in
+              completed/success|completed/skipped|status/success) echo "  ok    $ctx ($verdict)" ;;
+              *) echo "::error title=Required check not green::$ctx is $verdict on $head"; failed=1 ;;
+            esac
+          done <<< "$required"
+          if [ "$failed" -ne 0 ]; then
+            echo "Nothing was released."
+            exit 1
+          fi
+          echo "sha=$TIP" >> "$GITHUB_OUTPUT"
+
   release:
     name: Release
+    needs: verify-source-checks
     runs-on: ubuntu-latest
     # PR path: only a MERGED pull_request carrying one of the exact release
     # labels — `contains(array, item)` against the labels array, never a
@@ -150,6 +216,16 @@ jobs:
           fetch-tags: true
           token: ${{ env.GH_TOKEN }}
 
+      - name: Release exactly the commit that was verified
+        env:
+          VERIFIED: ${{ needs.verify-source-checks.outputs.sha }}
+        run: |
+          actual=$(git rev-parse HEAD)
+          if [ -z "$VERIFIED" ] || [ "$actual" != "$VERIFIED" ]; then
+            echo "::error title=main moved::verify-source-checks verified ${VERIFIED:-nothing}, but main is now $actual. Nothing was released; re-run this workflow to verify the new tip."
+            exit 1
+          fi
+
       - name: Configure git identity for the release bump commit
         run: |
           git config --global user.name "github-actions[bot]"
diff --git a/.github/workflows/site.yml b/.github/workflows/site.yml
index 61a7030316..8cfa9aaa97 100644
--- a/.github/workflows/site.yml
+++ b/.github/workflows/site.yml
@@ -9,10 +9,10 @@ name: Site
 # — which has published the site to GitHub Pages on every push to `main` since
 # 2026-07-05 — additionally fires on the canonical docs that `site/sync-docs.mjs`
 # projects into the site (`docs/proof.md`, `docs/benchmark.md`, `docs/CLAIMS.md`,
-# `docs/catalog.md`, `docs/media/**`). That difference has a cost, stated rather
-# than implied: a change to one of those docs deploys without this link check
-# running, and is only link-checked on the next site-workspace push. Widening
-# this filter to match the deploy filter is the fix when that gap bites.
+# `docs/catalog.md`, `docs/media/**`). That difference no longer lets a broken
+# link ship: `deploy-site.yml`'s build job runs the same link check before its
+# artifact is published. What it still costs is timing — a broken link in one
+# of those docs is caught at deploy on `main`, not on the pull request.
 on:
   pull_request:
     branches: [main, master]
diff --git a/.github/workflows/skill-lint.yml b/.github/workflows/skill-lint.yml
index a684b34dd1..e6f77c1d77 100644
--- a/.github/workflows/skill-lint.yml
+++ b/.github/workflows/skill-lint.yml
@@ -20,6 +20,7 @@ on:
       - "Taskfile.yml"
       - "taskfiles/**"
       - ".github/workflows/skill-lint.yml"
+      - ".github/actions/setup-task/**"
   push:
     branches:
       - main
@@ -37,6 +38,7 @@ on:
       - "Taskfile.yml"
       - "taskfiles/**"
       - ".github/workflows/skill-lint.yml"
+      - ".github/actions/setup-task/**"
 
 concurrency:
   group: ${{ github.workflow }}-${{ github.ref }}
diff --git a/.github/workflows/sync-visibility.yml b/.github/workflows/sync-visibility.yml
index e2bcb986f8..12fc8d5006 100644
--- a/.github/workflows/sync-visibility.yml
+++ b/.github/workflows/sync-visibility.yml
@@ -95,6 +95,12 @@ jobs:
       - name: Lint topics.yml
         run: ./scripts-run src/scripts/lint_topics_yaml
 
+      # `apply` runs `sync_github_metadata.ts` with an admin-write token and
+      # `needs: preview`, so the script's own tests gate it here, not only the
+      # dry-run's exit code.
+      - name: Test the sync script and the topics linter
+        run: npx vitest run tests/scripts/sync_github_metadata.test.ts tests/scripts/lint_topics_yaml.test.ts
+
       - name: Dry-run preview
         env:
           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
diff --git a/src/scripts/code_graph/lanes/delivery/read_delivery.ts b/src/scripts/code_graph/lanes/delivery/read_delivery.ts
index 845ff4d176..c354b0fbac 100644
--- a/src/scripts/code_graph/lanes/delivery/read_delivery.ts
+++ b/src/scripts/code_graph/lanes/delivery/read_delivery.ts
@@ -18,7 +18,7 @@ import type { LaneOutput } from '../lane_fact.js';
 import { Emitter, posix } from '../runtime/emit.js';
 import { parseImageRef } from '../runtime/images.js';
 import { redactImage, redactOutput, redactText } from '../runtime/redact.js';
-import { excludedOwnFiles } from './self_trigger.js';
+import { excludedOwnFiles, ownPipelineFiles } from './self_trigger.js';
 
 const DEPLOY_NAME = /(^|[^a-z])(deploy|release|rollout|promote|ship)/i;
 const DEPLOY_CMD = /kubectl\s+(apply|set\s+image|rollout)|helm\s+(upgrade|install)|terraform\s+apply|aws\s+ecs\s+update-service|fly(ctl)?\s+deploy|vercel\s+.*--prod|gcloud\s+run\s+deploy|kamal\s+deploy|cap\s+\w+\s+deploy|serverless\s+deploy|sls\s+deploy/;
@@ -98,7 +98,7 @@ interface Read {
     model: PipelineModel;
 }
 
-function emitPipeline(em: Emitter, { file, model }: Read, all: Read[], protectedEnvs: Set<string>, byName: Map<string, string>): void {
+function emitPipeline(em: Emitter, { file, model }: Read, all: Read[], protectedEnvs: Set<string>, byName: Map<string, string>, filesUnder: (dir: string) => string[]): void {
     const wfId = em.fact(
         'workflow',
         file,
@@ -113,12 +113,10 @@ function emitPipeline(em: Emitter, { file, model }: Read, all: Read[], protected
         file,
         model.system === 'github' ? model.nameLine : 1,
     );
-    const ownFiles = [file];
+    const own = ownPipelineFiles(file, model, filesUnder);
     for (const t of model.triggers) {
         if (model.system !== 'github') break;
         const hasFilter = t.paths.length > 0 || t.pathsIgnore.length > 0;
-        const localUses = model.jobs.flatMap((j) => [j.uses?.ref, ...j.steps.map((s) => s.uses?.ref)]).filter((r): r is string => typeof r === 'string' && r.startsWith('./'));
-        const own = [...new Set([...ownFiles, ...localUses.map((u) => u.replace(/^\.\//, ''))])];
         const excluded = hasFilter ? excludedOwnFiles(t.paths.map((p) => p.glob), t.pathsIgnore.map((p) => p.glob), own) : [];
         const self = hasFilter ? excluded.length === 0 : null;
         const tid = em.fact(
@@ -288,6 +286,16 @@ export function readDelivery(root: string): LaneOutput {
     const byName = new Map<string, string>();
     for (const r of reads) if (r.model.name) byName.set(r.model.name, `workflow:${r.file}`);
     const protectedEnvs = protectedBySettings(em, root);
-    for (const r of reads) emitPipeline(em, r, reads, protectedEnvs, byName);
+    const filesUnder = (dir: string): string[] => {
+        try {
+            return (fs.readdirSync(path.join(root, dir), { recursive: true }) as string[])
+                .map((f) => `${dir}/${f.split(path.sep).join('/')}`)
+                .filter((f) => fs.statSync(path.join(root, f)).isFile())
+                .sort();
+        } catch {
+            return [];
+        }
+    };
+    for (const r of reads) emitPipeline(em, r, reads, protectedEnvs, byName, filesUnder);
     return redactOutput(em.output('delivery'));
 }
diff --git a/src/scripts/code_graph/lanes/delivery/self_trigger.ts b/src/scripts/code_graph/lanes/delivery/self_trigger.ts
index dca5170c86..a4039acb42 100644
--- a/src/scripts/code_graph/lanes/delivery/self_trigger.ts
+++ b/src/scripts/code_graph/lanes/delivery/self_trigger.ts
@@ -3,7 +3,7 @@
  * that excludes them means an edit to the workflow is never exercised by the
  * workflow it edits.
  */
-import { globToRegExp } from '../../../_lib/infra_files/pipeline.js';
+import { globToRegExp, type PipelineModel } from '../../../_lib/infra_files/pipeline.js';
 
 /** GitHub semantics: patterns apply in order, a `!` pattern negates, the last match wins. */
 function matchesFilter(globs: string[], file: string): boolean {
@@ -29,3 +29,27 @@ export function selfTriggers(paths: string[], pathsIgnore: string[], own: string
 export function excludedOwnFiles(paths: string[], pathsIgnore: string[], own: string[]): string[] {
     return own.filter((f) => !((paths.length === 0 || matchesFilter(paths, f)) && !(pathsIgnore.length > 0 && matchesFilter(pathsIgnore, f))));
 }
+
+/**
+ * The files a GitHub workflow is made of: itself, plus every local action and
+ * reusable workflow it calls. A local action is a directory, and a path filter
+ * sees the files in it, so each file `filesUnder` lists for it counts; when it
+ * lists none, the `action.yml` manifest stands in for the directory.
+ */
+export function ownPipelineFiles(
+    file: string,
+    model: PipelineModel,
+    filesUnder: (dir: string) => readonly string[] = () => [],
+): string[] {
+    const local = model.jobs
+        .flatMap((j) => [j.uses?.ref, ...j.steps.map((s) => s.uses?.ref)])
+        .filter((r): r is string => typeof r === 'string' && r.startsWith('./'))
+        .map((r) => r.replace(/^\.\//, ''))
+        .flatMap((r) => {
+            if (/\.ya?ml$/.test(r)) return [r];
+            const dir = r.replace(/\/$/, '');
+            const files = filesUnder(dir);
+            return files.length > 0 ? [...files] : [`${dir}/action.yml`];
+        });
+    return [...new Set([file, ...local])];
+}
diff --git a/src/scripts/lint_workflow_paths.ts b/src/scripts/lint_workflow_paths.ts
index 9a04e45f8b..577ee98439 100644
--- a/src/scripts/lint_workflow_paths.ts
+++ b/src/scripts/lint_workflow_paths.ts
@@ -60,7 +60,8 @@ import * as path from 'node:path';
 import { fileURLToPath, pathToFileURL } from 'node:url';
 
 import { GateLedger } from './_lib/gate_ledger.js';
-import { globMatchesAny, globToRegExp } from './_lib/infra_files/pipeline.js';
+import { globMatchesAny, globToRegExp, parsePipeline } from './_lib/infra_files/pipeline.js';
+import { excludedOwnFiles, ownPipelineFiles } from './code_graph/lanes/delivery/self_trigger.js';
 import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
 import { reportScanned } from './_lib/scan_scope.js';
 
@@ -76,7 +77,7 @@ export interface PathFinding {
     readonly file: string;
     readonly line: number;
     readonly glob: string;
-    readonly why: 'no-match' | 'thin-reason';
+    readonly why: 'no-match' | 'thin-reason' | 'excludes-own';
 }
 
 // Glob semantics are owned by the shared pipeline model so the delivery lane
@@ -187,6 +188,7 @@ export function scanWorkflowDir(
                 findings.push({ file: f, line: entry.line, glob: entry.glob, why: 'no-match' });
             }
         }
+        findings.push(...ownFileExclusions(`.github/workflows/${f}`, f, body, opts.tracked));
         if (findings.length > before) {
             ledger.fail(f, `${String(findings.length - before)} dead path filter(s)`);
         } else {
@@ -196,6 +198,36 @@ export function scanWorkflowDir(
     return findings;
 }
 
+/**
+ * The second way a filter stops firing: it matches files, but not the
+ * workflow's own — the workflow file, or a local action it uses. An edit to
+ * that file alone then never runs the workflow that depends on it. Same
+ * semantics as the delivery lane's DL-5, from the same function.
+ */
+export function ownFileExclusions(
+    workflowPath: string,
+    file: string,
+    body: string,
+    tracked: readonly string[],
+): PathFinding[] {
+    const model = parsePipeline(body, 'github');
+    if (model.error !== null) {
+        return [];
+    }
+    const own = ownPipelineFiles(workflowPath, model, (dir) => tracked.filter((t) => t.startsWith(`${dir}/`)));
+    const out: PathFinding[] = [];
+    for (const t of model.triggers) {
+        if (t.paths.length === 0 && t.pathsIgnore.length === 0) {
+            continue;
+        }
+        const line = t.paths[0]?.line ?? t.pathsIgnore[0]?.line ?? t.line;
+        for (const excluded of excludedOwnFiles(t.paths.map((p) => p.glob), t.pathsIgnore.map((p) => p.glob), own)) {
+            out.push({ file, line, glob: `${t.event} → ${excluded}`, why: 'excludes-own' });
+        }
+    }
+    return out;
+}
+
 interface Args {
     quiet: boolean;
     selfTest: boolean;
@@ -220,11 +252,17 @@ function _parseArgs(argv: readonly string[]): Args {
 
 function _selfTest(): number {
     const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lwp-selftest-'));
-    const mkRepo = (name: string, workflow: string): string => {
+    const mkRepo = (name: string, workflow: string, extra: Record<string, string> = {}): string => {
         const repo = path.join(tmp, name);
         fs.mkdirSync(path.join(repo, '.github', 'workflows'), { recursive: true });
+        fs.mkdirSync(path.join(repo, '.github', 'actions', 'setup'), { recursive: true });
         fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
         fs.writeFileSync(path.join(repo, 'src', 'real.ts'), '// real\n');
+        fs.writeFileSync(path.join(repo, '.github', 'actions', 'setup', 'action.yml'), 'runs:\n  using: composite\n  steps: []\n');
+        for (const [rel, body] of Object.entries(extra)) {
+            fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
+            fs.writeFileSync(path.join(repo, rel), body);
+        }
         execFileSync('git', ['init', '-q'], { cwd: repo });
         execFileSync('git', ['add', '-A'], { cwd: repo });
         fs.writeFileSync(path.join(repo, '.github', 'workflows', 'w.yml'), workflow, 'utf-8');
@@ -239,7 +277,8 @@ function _selfTest(): number {
             REAL_REPO_ROOT,
         );
 
-    const HEAD = 'on:\n  pull_request:\n    paths:\n';
+    // Every fixture names its own file, so only the case under test can fire.
+    const HEAD = 'on:\n  pull_request:\n    paths:\n      - ".github/workflows/w.yml"\n';
     try {
         const dead = mkRepo('dead', `${HEAD}      - "retired/tree/**"\n`);
         const live = mkRepo('live', `${HEAD}      - "src/**"\n`);
@@ -249,10 +288,21 @@ function _selfTest(): number {
         );
         const thin = mkRepo('thin', `${HEAD}      - "future/tree/**"  # workflow-path-allow: soon\n`);
         const bareDir = mkRepo('baredir', `${HEAD}      - "src"\n`);
+        const USES = 'jobs:\n  j:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: ./.github/actions/setup\n';
+        const actionExcluded = mkRepo('actionexcluded', `${HEAD}      - "src/**"\n${USES}`);
+        const manifestOnly = mkRepo(
+            'manifestonly',
+            `${HEAD}      - "src/**"\n      - ".github/actions/setup/action.yml"\n${USES}`,
+            { '.github/actions/setup/run.sh': 'echo setup\n' },
+        );
+        const actionCovered = mkRepo(
+            'actioncovered',
+            `${HEAD}      - "src/**"\n      - ".github/actions/setup/**"\n${USES}`,
+        );
         return runSelfTest({
             gate: 'lint_workflow_paths',
-            minCases: 4,
-            minRejectCases: 2,
+            minCases: 7,
+            minRejectCases: 4,
             cases: [
                 {
                     name: 'a filter naming a retired tree is rejected',
@@ -275,6 +325,21 @@ function _selfTest(): number {
                     expect: 'reject',
                     run: () => run(thin),
                 },
+                {
+                    name: 'a filter that excludes a local action the workflow uses is rejected',
+                    expect: 'reject',
+                    run: () => run(actionExcluded),
+                },
+                {
+                    name: 'a filter naming only the manifest misses the rest of the action and is rejected',
+                    expect: 'reject',
+                    run: () => run(manifestOnly),
+                },
+                {
+                    name: 'a filter that covers the local action directory passes',
+                    expect: 'accept',
+                    run: () => run(actionCovered),
+                },
             ],
         });
     } finally {
@@ -301,13 +366,16 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
             const why =
                 f.why === 'no-match'
                     ? 'matches no tracked file'
-                    : 'workflow-path-allow reason is too thin to classify';
+                    : f.why === 'excludes-own'
+                      ? 'the filter excludes this pipeline file — an edit to it alone never runs the workflow'
+                      : 'workflow-path-allow reason is too thin to classify';
             process.stdout.write(
                 `  ${f.file}:${String(f.line)}  ${f.glob}\n      ${why}\n`,
             );
         }
         process.stdout.write(
             '\n  Fix: delete the entry if the tree is retired, or repoint it if the path moved.\n' +
+                '  For an excluded pipeline file, add it (a local action as `<dir>/**`) to the filter.\n' +
                 '  A filter that matches nothing does not over-trigger — it never triggers.\n',
         );
     }
diff --git a/tests/scripts/code_graph_lane_delivery.test.ts b/tests/scripts/code_graph_lane_delivery.test.ts
index 35eeaf4ae3..fe04ec9b7b 100644
--- a/tests/scripts/code_graph_lane_delivery.test.ts
+++ b/tests/scripts/code_graph_lane_delivery.test.ts
@@ -143,4 +143,39 @@ describe('delivery drift DL-1 … DL-5', () => {
         const hits = evaluateRules(DELIVERY_RULES, [readDelivery(dir)]).filter((f) => f.rule === 'DL-3');
         expect(hits.map((h) => h.subjects[0])).toEqual([`environment:${GH}/ci.yml#staging`]);
     });
+
+    it('DL-5 counts a local action as the files under its directory, so a `dir/**` filter covers it', () => {
+        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-delivery-'));
+        tmpDirs.push(dir);
+        fs.mkdirSync(path.join(dir, GH), { recursive: true });
+        fs.mkdirSync(path.join(dir, '.github', 'actions', 'setup'), { recursive: true });
+        fs.writeFileSync(path.join(dir, '.github', 'actions', 'setup', 'action.yml'), 'runs:\n  using: composite\n  steps: []\n');
+        const wf = (extra: string) =>
+            `name: Lint\non:\n  pull_request:\n    paths:\n      - "src/**"\n      - ".github/workflows/lint.yml"\n${extra}jobs:\n  lint:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: ./.github/actions/setup\n`;
+        const dl5 = () => evaluateRules(DELIVERY_RULES, [readDelivery(dir)]).filter((f) => f.rule === 'DL-5');
+        fs.writeFileSync(path.join(dir, GH, 'lint.yml'), wf(''));
+        expect(dl5().map((h) => h.subjects[0])).toEqual([`trigger:${GH}/lint.yml#pull_request`]);
+        fs.writeFileSync(path.join(dir, GH, 'lint.yml'), wf('      - ".github/actions/setup/**"\n'));
+        expect(dl5()).toEqual([]);
+    });
+
+    it('DL-5 reads every file of a local action, so a manifest-only filter misses its implementation', () => {
+        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-delivery-'));
+        tmpDirs.push(dir);
+        const act = path.join(dir, '.github', 'actions', 'setup');
+        fs.mkdirSync(path.join(dir, GH), { recursive: true });
+        fs.mkdirSync(path.join(act, 'dist'), { recursive: true });
+        fs.writeFileSync(path.join(act, 'action.yaml'), 'runs:\n  using: node20\n  main: dist/index.js\n');
+        fs.writeFileSync(path.join(act, 'dist', 'index.js'), '// impl\n');
+        const wf = (extra: string) =>
+            `name: Lint\non:\n  pull_request:\n    paths:\n      - ".github/workflows/lint.yml"\n${extra}jobs:\n  lint:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: ./.github/actions/setup\n`;
+        const dl5 = () => evaluateRules(DELIVERY_RULES, [readDelivery(dir)]).filter((f) => f.rule === 'DL-5');
+        fs.writeFileSync(path.join(dir, GH, 'lint.yml'), wf('      - ".github/actions/setup/action.yaml"\n'));
+        const hits = dl5();
+        expect(hits.map((h) => h.subjects[0])).toEqual([`trigger:${GH}/lint.yml#pull_request`]);
+        expect(hits[0]!.message).toContain('.github/actions/setup/dist/index.js');
+        expect(hits[0]!.message).not.toContain('action.yaml');
+        fs.writeFileSync(path.join(dir, GH, 'lint.yml'), wf('      - ".github/actions/setup/action.yaml"\n      - ".github/actions/setup/dist/**"\n'));
+        expect(dl5()).toEqual([]);
+    });
 });
```
