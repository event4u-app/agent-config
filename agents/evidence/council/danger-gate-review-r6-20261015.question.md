<!-- evidence-type: analysis -->

<!-- The round-6 (delta) prompt given to the council on 2026-10-15 for the danger-gate change,
     committed verbatim so the verdict recorded beside it can be checked against
     what was actually asked. Not edited after the run. -->

# Delta review of the danger-gate change — round 6

Round 5 reviewed the owner-directed change: a dependency manifest is `needs-council`, not `needs-owner`; the base classifier runs first on `node --experimental-strip-types` with no `node_modules`, falling back to the checkout's `tsx` only where that cannot run. Its diff is not repeated here. Round 5's seats requested changes. The findings raised in round 5, as the seats stated them:

1. The shell checked only root-level manifests (`git diff --quiet -- $MANIFESTS`), while the classifier matches manifest basenames at any depth; on a host without type stripping, a nested `package.json` took the trusted-runtime branch, where a head-installed `tsx` could answer `routine`.
2. With a changed manifest, a fallback that crashed, gave malformed output or disagreed with its exit status became `needs-council (runtime-uncertain)` instead of `needs-owner`.
3. No test combined a host without type stripping with a head-installed `tsx`, and no gate-level test covered a nested manifest.
4. `git diff --quiet` ran as a bare command with `$?` read afterwards, so under `set -e` a detected change ended the block before it printed a verdict.
5. The residual-risk prose did not say what happens to a failed fallback.

Scope of this round: the diff below, from the round-5 head to the new head — the shell block and its prose in the merge command, and one test file. Omitted: a merge of the trunk into the branch (it changed `src/scripts/_lib/ratification_subject.ts` and other files on the trunk's side, none of the lines this change touched), the regenerated projection `dist/agent-src/commands/pr/merge.md` (a byte copy of the command) and one `pack.yaml` token count.

Report defects in this delta and in how it answers the round-5 findings: fail-open paths that remain, a finding marked answered that is not, new defects the fixes introduced, whether the stated residual is accurate, and tests that would pass without the code they cover. For each: file:line, the failure scenario, severity. State your stance.

~~~diff
diff --git a/src/domains/git/pr/merge/command.md b/src/domains/git/pr/merge/command.md
index da1ad3438..3a3f88be8 100644
--- a/src/domains/git/pr/merge/command.md
+++ b/src/domains/git/pr/merge/command.md
@@ -481,7 +481,7 @@ classify it with the **base revision's** classifier, never the head's:
 ```bash
 BASE="<manifest-base_sha>"
 HEAD_SHA="<manifest-head-sha>"
-MANIFESTS="package.json package-lock.json npm-shrinkwrap.json .npmrc yarn.lock .yarnrc.yml pnpm-lock.yaml bun.lock bun.lockb"
+MANIFEST_RE='(^|/)(package\.json|package-lock\.json|npm-shrinkwrap\.json|\.npmrc|yarn\.lock|\.yarnrc\.yml|pnpm-lock\.yaml|bun\.lockb?)$'
 run_base() {
   OUT="$("$@" "$BASE_DIR/src/scripts/classify_merge_risk.ts" --range "$BASE...$HEAD_SHA" --root "$PWD")"
   CODE=$?
@@ -497,12 +497,17 @@ if GATE_TMP="$(mktemp -d)" && [ -n "$GATE_TMP" ] && [ -d "$GATE_TMP" ]; then
   if REAL_TMP="$(cd "$GATE_TMP" && pwd -P)" && [ -n "$REAL_TMP" ]; then
     BASE_DIR="$REAL_TMP/classifier-base"
     VERDICT="verdict: needs-owner (base-unavailable: no classifier or no worktree at $BASE)"
-    git diff --quiet "$BASE...$HEAD_SHA" -- $MANIFESTS
-    DEPS=$?
+    if ! CHANGED="$(git -c core.quotePath=false diff --name-only "$BASE...$HEAD_SHA")"; then
+      DEPS=2
+    elif printf '%s\n' "$CHANGED" | grep -Eq "$MANIFEST_RE"; then
+      DEPS=1
+    else
+      DEPS=0
+    fi
     if ! TRACKED="$(git ls-files -- node_modules)" || [ -n "$TRACKED" ]; then
       VERDICT="verdict: needs-owner (runtime-unverified: node_modules unreadable or tracked)"
     elif [ "$DEPS" -gt 1 ]; then
-      VERDICT="verdict: needs-owner (manifest-unreadable: git diff exited $DEPS)"
+      VERDICT="verdict: needs-owner (manifest-unreadable: the changed-file list could not be read)"
     elif git cat-file -e "$BASE:src/scripts/classify_merge_risk.ts" \
          && git worktree add -q --detach "$BASE_DIR" "$BASE"; then
       cat > "$REAL_TMP/loader.mjs" <<'LOADER'
@@ -518,8 +523,7 @@ LOADER
         :
       elif [ "$DEPS" -eq 0 ] && RUN="$(run_base node_modules/.bin/tsx)"; then
         :
-      elif [ "$DEPS" -eq 1 ]; then
-        RUN="$(run_base node_modules/.bin/tsx)"
+      elif [ "$DEPS" -eq 1 ] && RUN="$(run_base node_modules/.bin/tsx)"; then
         case "$(printf '%s\n' "$RUN" | tail -n 1)" in
           "verdict: needs-owner ("*) ;;
           *) RUN="verdict: needs-council (runtime-uncertain: no package-free runtime, and the head changes the manifest the checkout's runtime came from)" ;;
@@ -555,13 +559,15 @@ cannot carry) does the block fall back to the checkout's `tsx`, never through
 `./scripts-run`, whose dispatcher is the head's code.
 
 **Dependency manifests go to the council (owner decision, 2026-10-15).** A head
-that changes `package.json` or a lockfile is never `routine` — the classifier's
-`dependency-manifest` trigger, and a floor in the block for a base copy that
-predates it, make it `needs-council` — and never `needs-owner` on that ground
-alone. Where the package-free run worked, its verdict stands as for any PR.
-Where it could not run, the checkout's `tsx` may be one the head's manifest
-installed, so its answer is not trusted downward: a `needs-owner` from it is
-kept, anything else becomes `needs-council (runtime-uncertain)`.
+that changes `package.json` or a lockfile, at any depth, is never `routine` —
+the classifier's `dependency-manifest` trigger, and a floor in the block for a
+base copy that predates it, make it `needs-council` — and never `needs-owner` on
+that ground alone. Where the package-free run worked, its verdict stands as for
+any PR. Where it could not run, the checkout's `tsx` may be one the head's
+manifest installed, so a valid answer from it is not trusted downward: a
+`needs-owner` is kept, a lower verdict becomes
+`needs-council (runtime-uncertain)`. A fallback that gives no valid verdict at
+all is an anomaly like any other and stays `needs-owner`.
 
 **What it fails to.** Every other anomaly is **`needs-owner`** and says why —
 never a skipped gate and never a fall-back to the head's copy: a private
diff --git a/tests/scripts/classify_merge_risk_base_revision.test.ts b/tests/scripts/classify_merge_risk_base_revision.test.ts
index aeaa97964..63d67a7c6 100644
--- a/tests/scripts/classify_merge_risk_base_revision.test.ts
+++ b/tests/scripts/classify_merge_risk_base_revision.test.ts
@@ -73,7 +73,7 @@ function runGate(
     env: Record<string, string> = {},
 ): { lines: string[]; code: number | null } {
     const script = gateBlock().replaceAll('<manifest-base_sha>', baseSha).replaceAll('<manifest-head-sha>', headSha);
-    const r = spawnSync('bash', ['-c', script], { cwd: clone, encoding: 'utf8', env: { ...process.env, ...env } });
+    const r = spawnSync('bash', ['-c', `${env['GATE_PRELUDE'] ?? ''}\n${script}`], { cwd: clone, encoding: 'utf8', env: { ...process.env, ...env } });
     return { lines: (r.stdout ?? '').trim().split('\n'), code: r.status };
 }
 
@@ -96,7 +96,10 @@ function commitOn(branch: string, from: string, files: Record<string, string | n
     for (const [f, body] of Object.entries(files)) {
         const p = path.join(clone, f);
         if (body === null) fs.rmSync(p);
-        else fs.writeFileSync(p, body);
+        else {
+            fs.mkdirSync(path.dirname(p), { recursive: true });
+            fs.writeFileSync(p, body);
+        }
     }
     git(clone, 'add', '-A', '-f', '--', ...Object.keys(files));
     git(clone, 'commit', '-q', '-m', branch);
@@ -276,11 +279,11 @@ function nodeShimWithoutStripTypes(): string {
 }
 
 /** Swap the checkout's runtime for one that always answers routine — a head-installed tsx. */
-function withPoisonedRuntime<T>(run: () => T): T {
+function withPoisonedRuntime<T>(run: () => T, tsx = '#!/bin/sh\necho "verdict: routine"\n'): T {
     const nm = path.join(clone, 'node_modules');
     fs.unlinkSync(nm);
     fs.mkdirSync(path.join(nm, '.bin'), { recursive: true });
-    fs.writeFileSync(path.join(nm, '.bin', 'tsx'), '#!/bin/sh\necho "verdict: routine"\n', { mode: 0o755 });
+    fs.writeFileSync(path.join(nm, '.bin', 'tsx'), tsx, { mode: 0o755 });
     try {
         return run();
     } finally {
@@ -356,4 +359,39 @@ describe('a dependency manifest goes to the council, and still cannot reach rout
         const r = runGate(base, gated, { PATH });
         expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(/u);
     }, 60_000);
+
+    describe('without type stripping and with a head-installed tsx — the stated residual, and its bounds', () => {
+        const noStrip = (): Record<string, string> => ({
+            PATH: `${nodeShimWithoutStripTypes()}:${process.env['PATH'] ?? ''}`,
+        });
+
+        it('a nested package.json counts as a manifest change, so a forged routine is not accepted', () => {
+            const head = commitOn('nested-manifest-poisoned', base, { 'packages/ui/package.json': '{"x": 1}\n' });
+            const r = withPoisonedRuntime(() => runGate(base, head, noStrip()));
+            expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-council \(runtime-uncertain/u);
+        }, 60_000);
+
+        it('a forged lower verdict on a gated change plus a bump is needs-council, never routine — the residual', () => {
+            const head = commitOn('gated-bump-poisoned', base, {
+                'package.json': bumped(7),
+                [KERNEL_RULE]: `${fs.readFileSync(path.join(clone, KERNEL_RULE), 'utf8')}\n\n`,
+            });
+            const r = withPoisonedRuntime(() => runGate(base, head, noStrip()));
+            expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-council \(runtime-uncertain/u);
+        }, 60_000);
+
+        it('a fallback that crashes on a manifest change is an anomaly, so needs-owner', () => {
+            const head = commitOn('bump-crashing-runtime', base, { 'package.json': bumped(8) });
+            const r = withPoisonedRuntime(() => runGate(base, head, noStrip()), '#!/bin/sh\nexit 3\n');
+            expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(classifier-unusable/u);
+            expect(r.code).not.toBe(0);
+        }, 60_000);
+    });
+
+    it('under set -e a detected manifest change still prints its verdict', () => {
+        const r = runGate(base, commitOn('dep-bump-errexit', base, { 'package.json': bumped(9) }), {
+            GATE_PRELUDE: 'set -e',
+        });
+        expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-council \(/u);
+    }, 60_000);
 });
~~~
