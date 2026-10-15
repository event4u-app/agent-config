<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-15 (round 4, the review of
     PR #2367's round-3 fixes, 939427f6c..55764e20a), committed verbatim below
     this header so the verdict recorded beside it can be checked against what
     was actually asked. The header is the only addition; the prompt was not
     edited after the run. -->

# Review PR #2367 — follow-up to council round 3 (round 4)

Review this change. Scope: the diff below, `939427f6c..HEAD` on PR #2367 (branch `fix/bytes-council-findings`). It responds to a round-3 review of the same PR that reported:

1. The CI waiter was emitted as `agent-config ci:settle <pr>`, which is not on PATH for a project-local install (the binary lives in `node_modules/.bin`).
2. No automated test exercised the packed npm artifact; the CLI tests run the source tree and the repository's dev `tsx`.
3. Medium: the `--deep` pre-fetch size gate in `/analyze repo` was best-effort without that being stated as a decision; the "three-part ceiling" and a Safety line read as bounding a fetch already in flight.
4. Medium: unsupported transcript content members are counted but their types are not recorded.

Two other round-3 items are not addressed by this diff: the bounded-read test fixture (`HASH_BOUND_BYTES + 1` bytes) and the filename-based entry guard in `src/scripts/ci_settle.ts`.

Omitted from the diff: the generated `dist/agent-src/` projections (byte copies of the `src/` markdown shown), two `pack.yaml` token sums, and the verbatim round-3 prompt committed under `agents/evidence/council/`. The council record diff is included. For context, the package's `bin` is `"agent-config": "dist/cli/agent-config.js"`; `ci:settle` dispatches to `src/scripts/_cli/cmd_ci_settle.ts`, which the build bundles into `dist/cli-delegate/` (shown below unchanged).

Report defects: correctness, consumer-install breakage, tests that would pass without the code they cover, documentation claims the code or the test does not honour, security. For each: file:line, the failure scenario, severity. State your stance.

Context, unchanged in this diff — `src/scripts/_cli/cmd_ci_settle.ts`:

```ts
/**
 * `agent-config ci:settle <pr>` — the CI waiter, reached through the package's
 * own executable.
 *
 * Shipped commands used to name `npx tsx node_modules/@event4u/agent-config/
 * src/scripts/ci_settle.ts`, which fails on a global or ephemeral install (no
 * such path) and pulls `tsx` from the registry on a cold cache. Living under
 * `_cli/` gets this file bundled into `dist/cli-delegate/`, so a consumer runs
 * it with plain `node` and no TypeScript runner at all.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { main } from '../ci_settle.js';

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exitCode = main(process.argv.slice(2));
}
```

```diff
diff --git a/agents/evidence/analysis/model-visible-bytes-2026-10-14.md b/agents/evidence/analysis/model-visible-bytes-2026-10-14.md
index 188768329..305d3ae60 100644
--- a/agents/evidence/analysis/model-visible-bytes-2026-10-14.md
+++ b/agents/evidence/analysis/model-visible-bytes-2026-10-14.md
@@ -25,7 +25,8 @@ step 3.2 of `road-to-placeholders-on-the-wire` compare a reduction against.
   counted whatever its `type`, and a member of any other kind was skipped
   without a count. The current reader counts text from `type: text` members and
   data from `type: image` members with a `base64` source, and counts every other
-  member in `unsupported_members`; that count was not taken for
+  member in `unsupported_members` — a count only, the member's `type` is not
+  recorded; that count was not taken for
   this reading, so how many members it skipped is unknown, not zero.
 - **Hook-envelope bytes** — the transcript's `toolUseResult`, serialised. It is
   the object the host hands a post_tool_use hook, so it is what the census in
diff --git a/agents/evidence/council/pr2363-bytes-review-20261015.md b/agents/evidence/council/pr2363-bytes-review-20261015.md
index 938be801c..2c772921e 100644
--- a/agents/evidence/council/pr2363-bytes-review-20261015.md
+++ b/agents/evidence/council/pr2363-bytes-review-20261015.md
@@ -1,6 +1,6 @@
 <!-- evidence-type: analysis -->
 
-# PR #2363 review: two council rounds, both REQUEST_CHANGES
+# PR #2363 review: three council rounds, all REQUEST_CHANGES
 
 AI council, 2026-10-15. anthropic/claude-sonnet-4-5 + openai/codex-default,
 2/2 present in each round, `--prompt-mode pr --rounds 2`, `$0.00` (both seats
@@ -11,7 +11,11 @@ verbatim beside this file:
   `origin/main` at head `04d0864fa`;
 - round 2: `pr2363-bytes-review-r2-20261015.question.md`, the follow-up diff
   `04d0864fa..b9664ac3a` minus generated projections, pack token sums, the
-  archived roadmap's notes and the round-1 prompt.
+  archived roadmap's notes and the round-1 prompt;
+- round 3: `pr2367-bytes-review-r3-20261015.question.md`, PR #2367 at head
+  `939427f6c` against `origin/main`, omitting pack token sums, three small test
+  files, the evidence files, the roadmap notes, the council record, the budget
+  files and `dist/` (the prompt names the omissions).
 
 PR #2363 was squash-merged (`26dd1905e`, 2026-10-15 05:33 UTC) before the
 follow-up commits existed, so they are not on the PR. They sit on the local
@@ -62,5 +66,32 @@ openai, closing line:
 | The `ci:settle` tests run the source tree, not a packed install | both | low | **open** — the manual packed-install check is recorded in the round-2 prompt; no automated regression test was added |
 | The cold-start test's exact-number match is brittle | anthropic | low | **not taken** — openai dropped it: "Requiring the evidence source to contain the exact measured value is the purpose of this test." |
 
-The round-2 fixes were not put to a third round: the instruction was one
-re-presentation. They are therefore unreviewed by the council.
+The round-2 fixes went to the council as round 3, on PR #2367.
+
+## Round 3 — REQUEST_CHANGES, 2/2
+
+Both seats confirmed the round-2 fixes. anthropic on the TOCTOU read: "The
+`contentDigest` bounded read with `grew-during-read` detection is **solid**";
+on the digest union it "correctly prevents" a legacy ledger, a growth-raced read
+or a failed read from asserting unchanged. openai listed both as dropped false
+positives. Both raised the same two blockers.
+
+anthropic, stance line:
+
+> **Highest-leverage change:** Add packaging smoke test + fix emitted command path.
+
+openai, closing line:
+
+> **REQUEST_CHANGES — the central consumer-install promise is neither reliably
+> fulfilled nor tested against the shipped package.**
+
+| Finding | Seats | Severity | Disposition |
+|---|---|---|---|
+| The emitted `agent-config ci:settle <pr>` is not on PATH for a project-local install (`node_modules/.bin`) | both | high | `2df8bfa11` — every emitter names `npm exec --no -- agent-config ci:settle`; measured on a stripped PATH, offline: the bare form exits 127 on a local install, the npm exec form reaches the binary locally and globally |
+| No test exercises the packed artifact | both | high | `b3a251eff` — release install harness § consumer-ci-settle runs the line the packed `/fix ci` prints, from a `--omit=dev` local install and a global one; red (127) on a tarball packed from `939427f6c`, green on `2df8bfa11` |
+| The `--deep` transfer gate is best-effort without that being decided | anthropic | medium | `e3a41d547` — best-effort stated as a decision, with the reason |
+| The three-part ceiling reads as stopping a fetch in flight; "the cost bound never disappears" | openai | medium | `e3a41d547` — the bounds are checked between operations; the clone fetch is bounded only by the size gate |
+| Unsupported content members are counted but their types are not logged | anthropic | medium | **not taken** — openai: "Logging each type is an enhancement, not a correctness requirement." The evidence file now says the count does not record the type |
+| The bounded-read test's fixture is exactly bound + 1, so it cannot catch a regression to a whole-file read that reports the same state | openai | medium | **open** — anthropic disagreed: the fixed `HASH_BOUND_BYTES + 1` buffer "**cannot** read more". No test change in this round |
+| `ci_settle.ts` decides to run by its filename | anthropic | medium | **not taken** — the basename guard is correct (openai lists it as a false positive); removing the auto-run would break the in-repo `scripts-run` path |
+| The PR bundles changes with different rollback boundaries | both | medium (anthropic: "Not a blocker, but real.") | **not taken** — the PR is the follow-up to one review; each finding is its own commit |
diff --git a/src/domains/analysis-workbench/analyze/repo/command.md b/src/domains/analysis-workbench/analyze/repo/command.md
index 4d2f854bf..353041237 100644
--- a/src/domains/analysis-workbench/analyze/repo/command.md
+++ b/src/domains/analysis-workbench/analyze/repo/command.md
@@ -184,8 +184,12 @@ and rare, and a store is a maintenance surface for a rare path.
 
 The fetch ceiling is replaced by a **three-part ceiling** — an operation count,
 a total-bytes-read bound and a wall-clock bound, **whichever is hit first**, with
-the bound that fired recorded — plus a **best-effort pre-fetch size gate**, which
-is not a ceiling and does not bound the transfer. Before fetching, read the
+the bound that fired recorded. The three are checked **between** operations: they
+stop the next one, never one already in flight. Add to them a **best-effort
+pre-fetch size gate**, which is not a ceiling and does not bound the transfer —
+best-effort **by decision**: `--deep` is opt-in and rare, and a hard transfer
+limit would need a byte-counting wrapper around `git`, which this command does
+not carry. Before fetching, read the
 host's reported repository size (on GitHub,
 `gh api repos/<owner>/<repo> --jq .size`, in KiB) and do not fetch when it
 exceeds the gate. That figure is the whole repository at the moment of the
@@ -575,7 +579,8 @@ pins something; it just does not name it. Contract and field shapes:
 - No credentials in fetches. Public GitHub API is enough. For private mirrors,
   take a PAT via env var and never echo it.
 - Max 40 fetches without explicit extension; under `--deep` the three-part
-  ceiling of § 2b replaces it — the cost bound never disappears with the count.
+  ceiling of § 2b replaces it, checked between operations — the clone fetch
+  itself is bounded only by the best-effort size gate, by decision.
 - No auto-commits — the analysis is a draft until the user accepts.
 
 ## When **not** to use
diff --git a/src/domains/engineering-base/fix/ci/command.md b/src/domains/engineering-base/fix/ci/command.md
index ad65e799d..68d6bd09a 100644
--- a/src/domains/engineering-base/fix/ci/command.md
+++ b/src/domains/engineering-base/fix/ci/command.md
@@ -25,10 +25,11 @@ A run still in progress has no verdict to fix. Do NOT read a partial run and
 start guessing — and do NOT end the turn reporting "CI is running".
 
 ```bash
-agent-config ci:settle <n>
+npm exec --no -- agent-config ci:settle <n>
 ```
 
-`ci_settle` is the one waiter for this condition — never a hand-written
+`npm exec --no --` reaches a project-local install and a global one alike and
+never fetches from the registry. `ci_settle` is the one waiter for this condition — never a hand-written
 `gh pr checks` loop. Run it in the BACKGROUND so the turn resumes when the
 verdict lands, and do not pipe it: its LAST output line is the verdict and its
 exit code carries it. Exit 0 is settled green for the named head; exit 1 is
diff --git a/src/domains/git/pr/create/command.md b/src/domains/git/pr/create/command.md
index 3b3299810..8cfabd1bf 100644
--- a/src/domains/git/pr/create/command.md
+++ b/src/domains/git/pr/create/command.md
@@ -484,7 +484,7 @@ Pending is a reason to wait, never a reason to stop.
 **Settled** means every check has reached a terminal state:
 
 ```bash
-agent-config ci:settle <n>
+npm exec --no -- agent-config ci:settle <n>
 gh pr checks <n> --json name,state,link \
   --jq '.[] | select(.state!="SUCCESS" and .state!="SKIPPED") | "\(.state)  \(.name)  \(.link)"'
 ```
diff --git a/src/domains/product-basic/roadmap/process-full/command.md b/src/domains/product-basic/roadmap/process-full/command.md
index 2d7050756..d3a27ce2d 100644
--- a/src/domains/product-basic/roadmap/process-full/command.md
+++ b/src/domains/product-basic/roadmap/process-full/command.md
@@ -165,7 +165,7 @@ command is a claim; a layer with one is a check.
 | 1 | A targeted local RED, then GREEN | the test runner filtered to the failing name — `npm run test:ts -- <file>`, never the suite |
 | 2 | Quality scoped to the changed surface | the type-checker and linter over the diff — `npm run typecheck`, the linter on changed files |
 | 3 | Per-phase fast CI | `roadmap.quality_cadence: per_phase` (Phase 0.2) at each phase boundary |
-| 4 | The final full required CI | `agent-config ci:settle <PR> --timeout-min 28`, run as a BACKGROUND job — its LAST OUTPUT LINE is the verdict |
+| 4 | The final full required CI | `npm exec --no -- agent-config ci:settle <PR> --timeout-min 28`, run as a BACKGROUND job — its LAST OUTPUT LINE is the verdict |
 | 5 | Forge branch protection | `agent-config doctor --json` → `forge_protection` (Phase 3.2), read from the forge |
 | 6 | Final-head verification | `ci_settle`'s verdict line names the head; it must be the head that was pushed last |
 
diff --git a/src/scripts/hooks/push_settle_hook.ts b/src/scripts/hooks/push_settle_hook.ts
index 1e9e11d8a..0e2c54245 100644
--- a/src/scripts/hooks/push_settle_hook.ts
+++ b/src/scripts/hooks/push_settle_hook.ts
@@ -171,13 +171,21 @@ export function resolvePr(
   }
 }
 
+/**
+ * How a consumer reaches the waiter. A project-local install puts the binary in
+ * `node_modules/.bin`, which is not on an ordinary shell's PATH; `npm exec --no`
+ * resolves that, a global install and the package's own checkout alike, and
+ * `--no` refuses to fetch an unrelated registry package named `agent-config`.
+ */
+export const CI_SETTLE_INVOCATION = "npm exec --no -- agent-config ci:settle";
+
 /** The reminder text. Split out so the test can read it without a `gh` on PATH. */
 export function buildReminder(branch: string, pr: number | null): { reason: string; additional_context: string } {
   const settle =
     pr === null
       ? `gh pr view ${branch} --json number -q .number   # then:\n` +
-        `agent-config ci:settle <that number>`
-      : `agent-config ci:settle ${pr}`;
+        `${CI_SETTLE_INVOCATION} <that number>`
+      : `${CI_SETTLE_INVOCATION} ${pr}`;
   const subject = pr === null ? `branch ${branch}` : `PR #${pr} (${branch})`;
   const reason =
     `Pushed ${subject} — the turn is not finished until its CI has settled green ` +
diff --git a/src/scripts/lint_framework_leakage_allowlist.json b/src/scripts/lint_framework_leakage_allowlist.json
index bee7f140e..86cdb0600 100644
--- a/src/scripts/lint_framework_leakage_allowlist.json
+++ b/src/scripts/lint_framework_leakage_allowlist.json
@@ -156,6 +156,11 @@
       "file": "src/skills/prompt-engineering-image/SKILL.md",
       "anchor": "- `node_modules/@event4u/agent-config/src/scripts/ai-image/a",
       "reason": "npm install-location path of THIS package's own image-adapter scripts (node_modules/@event4u/agent-config/...) — the factual consumer path after the consumer-internal-ref decoupling (road-to-credible-install Phase 4), not a JS-stack mandate."
+    },
+    {
+      "file": "src/skills/git-workflow/SKILL.md",
+      "anchor": "`npm exec --no -- agent-config ci:settle <pr>`",
+      "reason": "Invocation of THIS package's own npm-distributed CLI, which is installed through npm whatever the consumer's stack. `npm exec --no` is the one form that reaches a project-local and a global install alike (council round 3 on PR #2367; proven by tests/test_release_install_e2e.sh § consumer-ci-settle) — not a JS-stack mandate on the consumer project."
     }
   ]
 }
diff --git a/src/scripts/probe_turnaround.ts b/src/scripts/probe_turnaround.ts
index 085cff327..5c52c3dd6 100644
--- a/src/scripts/probe_turnaround.ts
+++ b/src/scripts/probe_turnaround.ts
@@ -94,7 +94,7 @@ const TOOL_CAUSE: Readonly<Record<string, BlockingCause>> = {
  */
 const SHELL_RULES: ReadonlyArray<readonly [RegExp, BlockingCause]> = [
     [/^(\S*\/)?scripts-run \S*ci_settle\b/, 'ci-wait'],
-    [/^(\S*\/)?agent-config ci:settle\b/, 'ci-wait'],
+    [/^(npm exec (--\S+ )*-- |npx (--\S+ )*)?(\S*\/)?agent-config ci:settle\b/, 'ci-wait'],
     [/^gh (run watch|pr checks)\b/, 'ci-wait'],
     [/^(sleep|until|while|watch)\b/, 'sleep-poll'],
     [/^((npx |\S*node_modules\/\.bin\/)?(vitest|jest|pytest|phpunit)\b|npm (run )?test\b|task (ci|test)\b)/, 'test'],
diff --git a/src/skills/git-workflow/SKILL.md b/src/skills/git-workflow/SKILL.md
index 08cbcb7b7..5ffd8465e 100644
--- a/src/skills/git-workflow/SKILL.md
+++ b/src/skills/git-workflow/SKILL.md
@@ -107,7 +107,7 @@ Work complete. What would you like to do?
 3. `git push -u origin "<branch>"` (a rendered name is always quoted) — after a rebase of a pushed branch, `--force-with-lease` per `references/branch-update.md`.
 4. `gh pr create` using PR template.
 5. **Settle it** — the turn is not over at step 4:
-   `agent-config ci:settle <pr>`
+   `npm exec --no -- agent-config ci:settle <pr>`
 
 ## A push closes its own loop
 
diff --git a/tests/scripts/ci_settle_cli.test.ts b/tests/scripts/ci_settle_cli.test.ts
index 03b21e428..17b353ab3 100644
--- a/tests/scripts/ci_settle_cli.test.ts
+++ b/tests/scripts/ci_settle_cli.test.ts
@@ -7,17 +7,29 @@
  * proves the wiring end to end without a network call.
  */
 import { spawnSync } from 'node:child_process';
+import * as fs from 'node:fs';
 import * as path from 'node:path';
 
 import { describe, expect, it } from 'vitest';
 
 import { findCommand } from '../../src/cli/registry.js';
+import { CI_SETTLE_INVOCATION } from '../../src/scripts/hooks/push_settle_hook.js';
 
 const ROOT = process.cwd();
 const DISPATCH = path.join(ROOT, 'src/scripts/_dispatch.bash');
 const WRAPPER = path.join(ROOT, 'src/scripts/_cli/cmd_ci_settle.ts');
 const TSX = path.join(ROOT, 'node_modules', '.bin', 'tsx');
 
+// Every shipped surface that tells a consumer how to wait for CI. The packed
+// install smoke (tests/test_release_install_e2e.sh § consumer-ci-settle) runs
+// the /fix ci line; this keeps the other surfaces on the same invocation.
+const EMITTERS = [
+    'src/domains/engineering-base/fix/ci/command.md',
+    'src/domains/git/pr/create/command.md',
+    'src/domains/product-basic/roadmap/process-full/command.md',
+    'src/skills/git-workflow/SKILL.md',
+];
+
 function countUsage(stderr: string): number {
     return stderr.split('usage: ci_settle').length - 1;
 }
@@ -38,4 +50,14 @@ describe('ci:settle verb', () => {
         expect(r.status).toBe(2);
         expect(countUsage(r.stderr)).toBe(1);
     });
+
+    it('every shipped surface emits the one invocation that works on a project-local install', () => {
+        expect(CI_SETTLE_INVOCATION).toBe('npm exec --no -- agent-config ci:settle');
+        for (const rel of EMITTERS) {
+            const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
+            const uses = text.split('ci:settle').length - 1;
+            expect(uses, rel).toBeGreaterThan(0);
+            expect(text.split(CI_SETTLE_INVOCATION).length - 1, rel).toBe(uses);
+        }
+    });
 });
diff --git a/tests/scripts/probe_turnaround_causes.test.ts b/tests/scripts/probe_turnaround_causes.test.ts
index d746cd83a..37b3fe4ef 100644
--- a/tests/scripts/probe_turnaround_causes.test.ts
+++ b/tests/scripts/probe_turnaround_causes.test.ts
@@ -117,6 +117,8 @@ describe("classifyBlockingCall — 1.1", () => {
   it("reads the packaged waiter verb as a CI wait", () => {
     expect(classifyBlockingCall("Bash", { command: "agent-config ci:settle 12" })).toBe("ci-wait");
     expect(classifyBlockingCall("Bash", { command: "cd ../a; ./agent-config ci:settle 12 --timeout-min 28" })).toBe("ci-wait");
+    expect(classifyBlockingCall("Bash", { command: "npm exec --no -- agent-config ci:settle 12" })).toBe("ci-wait");
+    expect(classifyBlockingCall("Bash", { command: "cd ../a; npx --no-install agent-config ci:settle 12" })).toBe("ci-wait");
   });
 
   // 2.2: the first reading's unknown share was mostly these, so they got rows.
diff --git a/tests/scripts/push_settle_hook.test.ts b/tests/scripts/push_settle_hook.test.ts
index b968de82f..fe3104a2a 100644
--- a/tests/scripts/push_settle_hook.test.ts
+++ b/tests/scripts/push_settle_hook.test.ts
@@ -14,7 +14,7 @@ import * as path from "node:path";
 import { fileURLToPath } from "node:url";
 import { afterAll, describe, expect, it } from "vitest";
 
-import { buildReminder, pushedBranch, resolvePr } from "../../src/scripts/hooks/push_settle_hook";
+import { buildReminder, CI_SETTLE_INVOCATION, pushedBranch, resolvePr } from "../../src/scripts/hooks/push_settle_hook";
 
 const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "..", "..", "..");
 const TS_SCRIPT = path.join(REPO_ROOT, "src", "scripts", "hooks", "push_settle_hook.ts");
@@ -59,7 +59,7 @@ describe("push_settle_hook — the fire path", () => {
     // `reason` reaches stderr only and is capped; the instruction must ride
     // additional_context, which is what surfaces back to the model.
     expect(out.reason.length).toBeLessThanOrEqual(200);
-    expect(out.additional_context).toContain("agent-config ci:settle");
+    expect(out.additional_context).toContain(`${CI_SETTLE_INVOCATION} `);
     expect(out.additional_context).toContain("verify-before-complete");
   });
 
@@ -147,10 +147,10 @@ describe("push_settle_hook — units", () => {
   });
 
   it("names the literal ci:settle command once the PR is known, and the two-step when it is not", () => {
-    expect(buildReminder("feat/x", 1234).additional_context).toContain("agent-config ci:settle 1234");
+    expect(buildReminder("feat/x", 1234).additional_context).toContain(`${CI_SETTLE_INVOCATION} 1234`);
     const unknown = buildReminder("feat/x", null).additional_context;
     expect(unknown).toContain("gh pr view feat/x");
-    expect(unknown).toContain("agent-config ci:settle <that number>");
+    expect(unknown).toContain(`${CI_SETTLE_INVOCATION} <that number>`);
     expect(unknown).not.toMatch(/ci:settle \d/); // never invents a number it did not read
   });
 
diff --git a/tests/test_release_install_e2e.sh b/tests/test_release_install_e2e.sh
index 2f34c2ef2..310e7fd78 100755
--- a/tests/test_release_install_e2e.sh
+++ b/tests/test_release_install_e2e.sh
@@ -17,6 +17,10 @@
 #   6. secret-gate-smoke           — repo-side check_secret_leak (not shipped
 #                                    as an installed CLI command — see § 6)
 #   7. clean-uninstall             — npm uninstall -g leaves no orphans
+#   8. consumer-ci-settle          — the CI-wait line the shipped /fix ci
+#                                    command emits runs from a project-local
+#                                    (--omit=dev) and a global install, with no
+#                                    TypeScript runner and no registry access
 #
 # Env:
 #   RELEASE_TARBALL   — pre-built tarball to install. Unset → `npm pack`
@@ -26,6 +30,10 @@
 #                        `npm pack @event4u/agent-config@9.7.0` once
 #                        (network). A failed fetch is a SETUP failure,
 #                        not a validation failure — see § 3.
+#   RELEASE_E2E_ONLY  — comma-separated section names to run instead of all
+#                        of them (e.g. `consumer-ci-settle`). Sections 2, 4, 5
+#                        and 7 read the install section 1 makes, so name it too.
+#                        The baseline is only resolved when § 3 is selected.
 #
 # Usage:
 #   bash tests/test_release_install_e2e.sh
@@ -42,6 +50,7 @@ SERVER_PID=""
 # --- helpers -------------------------------------------------------------
 
 ok() { echo "  ✅  $1"; }
+want() { [[ -z "${RELEASE_E2E_ONLY:-}" || ",$RELEASE_E2E_ONLY," == *",$1,"* ]]; }
 group_start() { echo "::group::$1"; echo "  🧪  $1"; }
 group_end() { echo "::endgroup::"; }
 die() {
@@ -131,10 +140,12 @@ RELEASE_TARBALL_PATH="$(resolve_release_tarball)"
 RELEASE_TARBALL_VERSION="$(tarball_version "$RELEASE_TARBALL_PATH")" || die "could not read version from release tarball: $RELEASE_TARBALL_PATH"
 ok "release tarball: $RELEASE_TARBALL_PATH ($RELEASE_TARBALL_VERSION)"
 
-BASELINE_TARBALL_PATH="$(resolve_baseline_tarball)"
-[[ -f "$BASELINE_TARBALL_PATH" ]] || die "resolved baseline tarball not found: $BASELINE_TARBALL_PATH"
-BASELINE_TARBALL_VERSION="$(tarball_version "$BASELINE_TARBALL_PATH")" || die "could not read version from baseline tarball: $BASELINE_TARBALL_PATH"
-ok "baseline tarball: $BASELINE_TARBALL_PATH ($BASELINE_TARBALL_VERSION)"
+if want upgrade-from-9.7.0; then
+    BASELINE_TARBALL_PATH="$(resolve_baseline_tarball)"
+    [[ -f "$BASELINE_TARBALL_PATH" ]] || die "resolved baseline tarball not found: $BASELINE_TARBALL_PATH"
+    BASELINE_TARBALL_VERSION="$(tarball_version "$BASELINE_TARBALL_PATH")" || die "could not read version from baseline tarball: $BASELINE_TARBALL_PATH"
+    ok "baseline tarball: $BASELINE_TARBALL_PATH ($BASELINE_TARBALL_VERSION)"
+fi
 echo ""
 
 # --- 1. fresh-global-install ------------------------------------------------
@@ -364,15 +375,69 @@ section_clean_uninstall() {
     group_end
 }
 
+# --- 8. consumer-ci-settle ---------------------------------------------------
+
+# Runs the CI-wait line exactly as the packed /fix ci command prints it, so the
+# check follows whatever invocation the shipped text names. The run happens with
+# PATH cut down to node, npm and npx: no tsx, no stray global agent-config, and
+# npm_config_offline=true so nothing can be fetched to paper over a miss.
+section_consumer_ci_settle() {
+    group_start "consumer-ci-settle"
+    local emitted invocation
+    emitted="$(tar -xzO -f "$RELEASE_TARBALL_PATH" package/dist/agent-src/commands/fix/ci.md \
+        | grep -m1 -E '^[^`|]*ci:settle <n>$' || true)"
+    [[ -n "$emitted" ]] || die "consumer-ci-settle: the packed /fix ci command names no ci:settle line"
+    invocation="${emitted% <n>}"
+    ok "emitted invocation: $invocation"
+
+    local nodebin="$TMP_ROOT/node-only-bin" bin
+    mkdir -p "$nodebin"
+    for bin in node npm npx; do
+        ln -s "$(PATH="$BASE_PATH" command -v "$bin")" "$nodebin/$bin" \
+            || die "consumer-ci-settle: $bin not found on PATH"
+    done
+    local stripped="$nodebin:/usr/bin:/bin"
+    if env -i PATH="$stripped" bash -c 'command -v agent-config || command -v tsx' >/dev/null 2>&1; then
+        die "consumer-ci-settle: the stripped PATH still reaches agent-config or tsx"
+    fi
+
+    local local_dir="$TMP_ROOT/consumer-local" prefix="$TMP_ROOT/prefix-consumer" global_dir="$TMP_ROOT/consumer-global"
+    mkdir -p "$local_dir" "$prefix" "$global_dir"
+    printf '{"name":"consumer","version":"0.0.0","private":true}\n' >"$local_dir/package.json"
+    (cd "$local_dir" && NPM_CONFIG_PREFIX="$prefix" PATH="$BASE_PATH" npm install --omit=dev "$RELEASE_TARBALL_PATH" \
+        --no-audit --no-fund --fetch-retries=5 --fetch-retry-mintimeout=10000) >"$TMP_ROOT/consumer-local-install.log" 2>&1 \
+        || { cat "$TMP_ROOT/consumer-local-install.log" >&2; die "consumer-ci-settle: project-local npm install --omit=dev failed"; }
+    NPM_CONFIG_PREFIX="$prefix" PATH="$BASE_PATH" npm install -g "$RELEASE_TARBALL_PATH" --no-audit --no-fund \
+        --fetch-retries=5 --fetch-retry-mintimeout=10000 >"$TMP_ROOT/consumer-global-install.log" 2>&1 \
+        || { cat "$TMP_ROOT/consumer-global-install.log" >&2; die "consumer-ci-settle: global npm install failed"; }
+
+    local leg dir path out rc usages
+    for leg in project-local global; do
+        if [[ "$leg" == project-local ]]; then dir="$local_dir"; path="$stripped"; else dir="$global_dir"; path="$prefix/bin:$stripped"; fi
+        rc=0
+        out="$(cd "$dir" && env -i HOME="$TMP_ROOT/consumer-home" PATH="$path" NPM_CONFIG_PREFIX="$prefix" \
+            npm_config_offline=true EVENT4U_CONFIG_HOME="$EVENT4U_CONFIG_HOME" CI=1 AGENT_CONFIG_NO_UI=1 \
+            bash -c "$invocation" 2>&1)" || rc=$?
+        usages="$(printf '%s' "$out" | grep -c 'usage: ci_settle' || true)"
+        if [[ "$rc" -ne 2 || "$usages" -ne 1 ]]; then
+            printf '%s\n' "$out" >&2
+            die "consumer-ci-settle ($leg): '$invocation' exited $rc with $usages usage line(s); expected exit 2 and exactly one usage line"
+        fi
+        ok "$leg install: '$invocation' reaches the waiter (exit 2, one usage line)"
+    done
+    group_end
+}
+
 # --- run ---------------------------------------------------------------------
 
-section_fresh_global_install
-section_no_silent_gui_postinstall
-section_upgrade_from_9_7_0
-section_gui_server_ping
-section_reach_doctor
-section_secret_gate_smoke
-section_clean_uninstall
+want fresh-global-install && section_fresh_global_install
+want no-silent-gui-postinstall && section_no_silent_gui_postinstall
+want upgrade-from-9.7.0 && section_upgrade_from_9_7_0
+want gui-server-ping && section_gui_server_ping
+want reach-doctor && section_reach_doctor
+want secret-gate-smoke && section_secret_gate_smoke
+want consumer-ci-settle && section_consumer_ci_settle
+want clean-uninstall && section_clean_uninstall
 
 echo ""
 echo "✅  release install E2E gate: all sections passed"
```
