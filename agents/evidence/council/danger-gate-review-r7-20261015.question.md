<!-- evidence-type: analysis -->

<!-- The round-7 (delta) prompt given to the council on 2026-10-15 for the danger-gate change,
     committed verbatim so the verdict recorded beside it can be checked against
     what was actually asked. Not edited after the run. -->

# Delta review of the danger-gate change — round 7

Round 6 reviewed how the merge command's danger-gate block detects a changed dependency manifest and handles a failed fallback runtime; that diff is not repeated here. Round 6's seats requested changes. The findings raised in round 6, as the seats stated them:

1. `printf '%s\n' "$CHANGED" | grep -Eq "$MANIFEST_RE"` collapsed grep's "no match" and its error statuses into `DEPS=0`, so a grep failure turned a real manifest change into the trusted-runtime branch.
2. `git diff --name-only` is line-delimited and may quote unusual paths, so a path whose parent directory holds a newline could evade the "at any depth" detection.
3. The test of a gated change plus a bump under a forged `routine` passes on the manifest floor alone and does not cover gated-file classification.
4. A zero exit with a malformed verdict from the fallback runtime on a manifest change was not tested.
5. "A lower verdict becomes `needs-council`" was ambiguous.

Scope of this round: the diff below, from the round-6 head to the new head — the shell block and its prose in the merge command, and one test file. Omitted: the regenerated projection `dist/agent-src/commands/pr/merge.md` (a byte copy of the command) and one `pack.yaml` token count.

Report defects in this delta and in how it answers the round-6 findings: fail-open paths that remain, a finding marked answered that is not, new defects the fixes introduced, and tests that would pass without the code they cover. For each: file:line, the failure scenario, severity. State your stance.

~~~diff
diff --git a/src/domains/git/pr/merge/command.md b/src/domains/git/pr/merge/command.md
index 3a3f88be8..601b3c744 100644
--- a/src/domains/git/pr/merge/command.md
+++ b/src/domains/git/pr/merge/command.md
@@ -481,7 +481,6 @@ classify it with the **base revision's** classifier, never the head's:
 ```bash
 BASE="<manifest-base_sha>"
 HEAD_SHA="<manifest-head-sha>"
-MANIFEST_RE='(^|/)(package\.json|package-lock\.json|npm-shrinkwrap\.json|\.npmrc|yarn\.lock|\.yarnrc\.yml|pnpm-lock\.yaml|bun\.lockb?)$'
 run_base() {
   OUT="$("$@" "$BASE_DIR/src/scripts/classify_merge_risk.ts" --range "$BASE...$HEAD_SHA" --root "$PWD")"
   CODE=$?
@@ -497,12 +496,16 @@ if GATE_TMP="$(mktemp -d)" && [ -n "$GATE_TMP" ] && [ -d "$GATE_TMP" ]; then
   if REAL_TMP="$(cd "$GATE_TMP" && pwd -P)" && [ -n "$REAL_TMP" ]; then
     BASE_DIR="$REAL_TMP/classifier-base"
     VERDICT="verdict: needs-owner (base-unavailable: no classifier or no worktree at $BASE)"
-    if ! CHANGED="$(git -c core.quotePath=false diff --name-only "$BASE...$HEAD_SHA")"; then
+    DEPS=0
+    if ! git diff --name-only -z "$BASE...$HEAD_SHA" > "$REAL_TMP/changed"; then
       DEPS=2
-    elif printf '%s\n' "$CHANGED" | grep -Eq "$MANIFEST_RE"; then
-      DEPS=1
     else
-      DEPS=0
+      while IFS= read -r -d '' CHANGED_PATH; do
+        case "${CHANGED_PATH##*/}" in
+          package.json | package-lock.json | npm-shrinkwrap.json | .npmrc | yarn.lock | .yarnrc.yml | \
+          pnpm-lock.yaml | bun.lock | bun.lockb) DEPS=1 ;;
+        esac
+      done < "$REAL_TMP/changed"
     fi
     if ! TRACKED="$(git ls-files -- node_modules)" || [ -n "$TRACKED" ]; then
       VERDICT="verdict: needs-owner (runtime-unverified: node_modules unreadable or tracked)"
@@ -565,9 +568,11 @@ base copy that predates it, make it `needs-council` — and never `needs-owner`
 that ground alone. Where the package-free run worked, its verdict stands as for
 any PR. Where it could not run, the checkout's `tsx` may be one the head's
 manifest installed, so a valid answer from it is not trusted downward: a
-`needs-owner` is kept, a lower verdict becomes
+`needs-owner` is kept, any other valid verdict becomes
 `needs-council (runtime-uncertain)`. A fallback that gives no valid verdict at
-all is an anomaly like any other and stays `needs-owner`.
+all is an anomaly like any other and stays `needs-owner`. The changed paths are
+read NUL-separated and matched by basename with shell built-ins only, so an odd
+path cannot slip past and a listing that cannot be read is `needs-owner`.
 
 **What it fails to.** Every other anomaly is **`needs-owner`** and says why —
 never a skipped gate and never a fall-back to the head's copy: a private
diff --git a/tests/scripts/classify_merge_risk_base_revision.test.ts b/tests/scripts/classify_merge_risk_base_revision.test.ts
index 63d67a7c6..a83a543b6 100644
--- a/tests/scripts/classify_merge_risk_base_revision.test.ts
+++ b/tests/scripts/classify_merge_risk_base_revision.test.ts
@@ -371,7 +371,10 @@ describe('a dependency manifest goes to the council, and still cannot reach rout
             expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-council \(runtime-uncertain/u);
         }, 60_000);
 
-        it('a forged lower verdict on a gated change plus a bump is needs-council, never routine — the residual', () => {
+        // Documents the stated residual, not the gated-file classification: the forged
+        // routine is floored by the manifest alone. The package-free case above is the
+        // one that proves the gated file reaches the owner.
+        it('a forged routine on a gated change plus a bump is needs-council, never routine — the residual', () => {
             const head = commitOn('gated-bump-poisoned', base, {
                 'package.json': bumped(7),
                 [KERNEL_RULE]: `${fs.readFileSync(path.join(clone, KERNEL_RULE), 'utf8')}\n\n`,
@@ -386,6 +389,35 @@ describe('a dependency manifest goes to the council, and still cannot reach rout
             expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(classifier-unusable/u);
             expect(r.code).not.toBe(0);
         }, 60_000);
+
+        it('a fallback that exits 0 with a malformed verdict on a manifest change is needs-owner', () => {
+            const head = commitOn('bump-lying-runtime', base, { 'package.json': bumped(10) });
+            const r = withPoisonedRuntime(
+                () => runGate(base, head, noStrip()),
+                '#!/bin/sh\necho "verdict: routine-ish"\n',
+            );
+            expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(classifier-unusable/u);
+        }, 60_000);
+
+        it('a manifest under a directory whose name holds a newline is still a manifest change', () => {
+            const head = commitOn('newline-dir-manifest', base, { 'odd\ndir/package.json': '{"x": 1}\n' });
+            const r = withPoisonedRuntime(() => runGate(base, head, noStrip()));
+            expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-council \(runtime-uncertain/u);
+        }, 60_000);
+
+        it('a changed-file list that cannot be read is needs-owner', () => {
+            const dir = path.join(work, 'git-shim-no-name-list');
+            fs.mkdirSync(dir, { recursive: true });
+            const real = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim();
+            fs.writeFileSync(
+                path.join(dir, 'git'),
+                `#!/bin/sh\nfor a in "$@"; do [ "$a" = "--name-only" ] && exit 1; done\nexec "${real}" "$@"\n`,
+                { mode: 0o755 },
+            );
+            const head = commitOn('docs-only-unreadable-list', base, { 'docs/installation.md': 'list\n' });
+            const r = runGate(base, head, { PATH: `${dir}:${process.env['PATH'] ?? ''}` });
+            expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(manifest-unreadable/u);
+        }, 60_000);
     });
 
     it('under set -e a detected manifest change still prints its verdict', () => {
~~~
