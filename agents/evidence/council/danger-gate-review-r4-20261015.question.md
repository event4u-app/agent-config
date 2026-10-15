<!-- evidence-type: analysis -->

<!-- The round-4 (delta) prompt given to the council on 2026-10-15 for the danger-gate change,
     committed verbatim so the verdict recorded beside it can be checked against
     what was actually asked. Not edited after the run. -->

# Delta review of the danger-gate change — round 4

Rounds 1 to 3 reviewed the change to `src/scripts/classify_merge_risk.ts`, its tests, and the danger-gate shell block of the merge command; no earlier diff is repeated here. Round 3's seats requested changes. The findings raised in round 3, as the seats stated them:

1. `reopenPolicyOf()` read `reopen_policy` from any indented line, so `metadata:` with a nested `reopen_policy: directional`, or the same text inside a block scalar, yielded a non-owner policy although no top-level key existed.
2. The trap was installed only after the whole `mktemp` / `cd` / `pwd -P` chain succeeded, so a directory created by `mktemp` could leak when `cd` failed, contradicting the "every path" cleanup claim.
3. The added Yarn, pnpm and Bun manifest paths had no test.
4. The YAML tests had no nested or block-scalar fixture carrying a non-owner value.

Scope of this round: the diff below, from the round-3 head to the new head, restricted to the four files this change touches — the classifier's frontmatter reader, the shell block and its prose, and two test files. Omitted: a merge of the trunk into the branch (it touches none of these four files), the regenerated projection `dist/agent-src/commands/pr/merge.md` (a byte copy of the command) and one `pack.yaml` token count.

Report defects in this delta and in how it answers the round-3 findings: fail-open paths that remain, a finding marked answered that is not, new defects the fixes introduced, and tests that would pass without the code they cover. For each: file:line, the failure scenario, severity. State your stance.

~~~diff
diff --git a/src/domains/git/pr/merge/command.md b/src/domains/git/pr/merge/command.md
index de81c64a1..6080c0cf2 100644
--- a/src/domains/git/pr/merge/command.md
+++ b/src/domains/git/pr/merge/command.md
@@ -482,24 +482,27 @@ classify it with the **base revision's** classifier, never the head's:
 BASE="<manifest-base_sha>"
 HEAD_SHA="<manifest-head-sha>"
 VERDICT="verdict: needs-owner (temp-dir-unavailable: no private temporary directory)"
-if GATE_TMP="$(mktemp -d)" && [ -d "$GATE_TMP" ] && GATE_TMP="$(cd "$GATE_TMP" && pwd -P)" && [ -n "$GATE_TMP" ]; then
+if GATE_TMP="$(mktemp -d)" && [ -n "$GATE_TMP" ] && [ -d "$GATE_TMP" ]; then
   BASE_DIR="$GATE_TMP/classifier-base"
   trap 'git worktree remove --force "$BASE_DIR" 2>/dev/null; rm -rf "$GATE_TMP"' EXIT
-  VERDICT="verdict: needs-owner (base-unavailable: no classifier or no worktree at $BASE)"
-  if ! TRACKED="$(git ls-files -- node_modules)" || [ -n "$TRACKED" ] \
-     || ! git diff --quiet "$BASE...$HEAD_SHA" -- package.json package-lock.json npm-shrinkwrap.json \
-          .npmrc yarn.lock .yarnrc.yml pnpm-lock.yaml bun.lock bun.lockb; then
-    VERDICT="verdict: needs-owner (runtime-unverified: node_modules unreadable or tracked, or the head changes the manifest tsx was installed from)"
-  elif git cat-file -e "$BASE:src/scripts/classify_merge_risk.ts" \
-       && git worktree add -q --detach "$BASE_DIR" "$BASE"; then
-    OUT="$(node_modules/.bin/tsx "$BASE_DIR/src/scripts/classify_merge_risk.ts" --range "$BASE...$HEAD_SHA" --root "$PWD")"
-    CODE=$?
-    LAST="$(printf '%s\n' "$OUT" | tail -n 1)"
-    case "$CODE:$LAST" in
-      "0:verdict: routine" | "1:verdict: needs-council ("* | "2:verdict: needs-owner ("*) VERDICT="$LAST" ;;
-      *) VERDICT="verdict: needs-owner (classifier-unusable: exit $CODE, last line '$LAST')" ;;
-    esac
-    printf '%s\n' "$OUT" | sed '$d'
+  if REAL_TMP="$(cd "$GATE_TMP" && pwd -P)" && [ -n "$REAL_TMP" ]; then
+    BASE_DIR="$REAL_TMP/classifier-base"
+    VERDICT="verdict: needs-owner (base-unavailable: no classifier or no worktree at $BASE)"
+    if ! TRACKED="$(git ls-files -- node_modules)" || [ -n "$TRACKED" ] \
+       || ! git diff --quiet "$BASE...$HEAD_SHA" -- package.json package-lock.json npm-shrinkwrap.json \
+            .npmrc yarn.lock .yarnrc.yml pnpm-lock.yaml bun.lock bun.lockb; then
+      VERDICT="verdict: needs-owner (runtime-unverified: node_modules unreadable or tracked, or the head changes the manifest tsx was installed from)"
+    elif git cat-file -e "$BASE:src/scripts/classify_merge_risk.ts" \
+         && git worktree add -q --detach "$BASE_DIR" "$BASE"; then
+      OUT="$(node_modules/.bin/tsx "$BASE_DIR/src/scripts/classify_merge_risk.ts" --range "$BASE...$HEAD_SHA" --root "$PWD")"
+      CODE=$?
+      LAST="$(printf '%s\n' "$OUT" | tail -n 1)"
+      case "$CODE:$LAST" in
+        "0:verdict: routine" | "1:verdict: needs-council ("* | "2:verdict: needs-owner ("*) VERDICT="$LAST" ;;
+        *) VERDICT="verdict: needs-owner (classifier-unusable: exit $CODE, last line '$LAST')" ;;
+      esac
+      printf '%s\n' "$OUT" | sed '$d'
+    fi
   fi
 fi
 echo "$VERDICT"
@@ -526,8 +529,10 @@ unclassified. The boundary this assumes, stated rather than checked: the
 checkout's `node_modules` was installed from the base's manifest, never by this
 run from a PR head — a run that installed dependencies from a head before this
 block has already handed that head the runtime. A private temporary directory
-that cannot be made is `needs-owner` before any path is derived from it. The block prints the verdict last and exits 0 only on `routine`,
-and the `trap` removes the worktree and its temporary directory on every path.
+that cannot be made is `needs-owner` before any path is derived from it, and the
+`trap` is installed the moment one exists, so it removes the worktree and the
+directory on every later path. The block prints the verdict last and exits 0
+only on `routine`.
 The temporary directory is resolved to its real path: the classifier's entry
 guard compares real paths, and on a host whose temp directory is a symlink an
 unresolved path makes it print nothing — which the block would correctly, but
diff --git a/src/scripts/classify_merge_risk.ts b/src/scripts/classify_merge_risk.ts
index 680d0d9ad..651462fd7 100644
--- a/src/scripts/classify_merge_risk.ts
+++ b/src/scripts/classify_merge_risk.ts
@@ -192,13 +192,15 @@ function plainScalar(raw: string): string {
  * Read by hand, not through a YAML library: the base copy runs from a detached
  * worktree with no `node_modules` of its own, so it may import only `node:`
  * built-ins. So the reader accepts one subset — top-level lines `key: value`
- * with an unquoted key, and indented or `- ` lines beneath them — and reads
- * `'owner'` for anything outside it, because outside it YAML could say `owner`
- * where this parser cannot see it: a flow mapping, an explicit `?` key, a quoted
- * or escaped key, a merge key, or the word `reopen_policy` anywhere the subset
- * did not read it. Inside the subset every occurrence counts (a duplicate cannot
- * hide an `owner`), and any value other than the two non-owner policies — empty,
- * a block scalar, a tag, an alias, a typo — reads as `'owner'` too.
+ * with an unquoted key, and indented or `- ` lines beneath them — and only a
+ * column-zero `reopen_policy:` line can yield a non-owner policy. It reads
+ * `'owner'` for anything outside the subset, because there YAML could say
+ * `owner` where this parser cannot see it: a flow mapping, an explicit `?` key,
+ * a quoted or escaped key, a merge key, the key nested under another or inside a
+ * block scalar, or the word `reopen_policy` anywhere else. Every column-zero
+ * occurrence counts (a duplicate cannot hide an `owner`), and any value other
+ * than the two non-owner policies — empty, a block scalar, a tag, an alias, a
+ * typo — reads as `'owner'` too.
  */
 export function reopenPolicyOf(text: string): string | null {
     const fm = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
@@ -213,9 +215,8 @@ export function reopenPolicyOf(text: string): string | null {
             continue;
         }
         if (/^\s/u.test(line) || line.startsWith('- ')) {
-            const child = /^\s*(?:-\s+)?reopen_policy\s*:(.*)$/iu.exec(line);
-            if (child !== null) {
-                values.push(plainScalar(child[1] ?? ''));
+            if (/reopen_policy/iu.test(line)) {
+                outsideSubset = true;
             }
             continue;
         }
diff --git a/tests/scripts/classify_merge_risk.test.ts b/tests/scripts/classify_merge_risk.test.ts
index 0160ffcba..8bffa3d21 100644
--- a/tests/scripts/classify_merge_risk.test.ts
+++ b/tests/scripts/classify_merge_risk.test.ts
@@ -266,6 +266,9 @@ describe('frontmatter reading — both sides, failing closed', () => {
             '"reopen\\u005fpolicy": owner',
             'base: &b\n  reopen_policy: owner\n<<: *b',
             'id: ADR-1\nnotes: {reopen_policy: owner}',
+            'metadata:\n  reopen_policy: directional',
+            'notes: |\n  reopen_policy: directional',
+            'reopen_policy: directional\nnotes:\n  - reopen_policy: unclassified',
         ]) {
             expect(reopenPolicyOf(`---\n${fm}\n---\n`), fm).toBe('owner');
         }
diff --git a/tests/scripts/classify_merge_risk_base_revision.test.ts b/tests/scripts/classify_merge_risk_base_revision.test.ts
index 1a2ce7e68..d33a0bade 100644
--- a/tests/scripts/classify_merge_risk_base_revision.test.ts
+++ b/tests/scripts/classify_merge_risk_base_revision.test.ts
@@ -98,7 +98,7 @@ function commitOn(branch: string, from: string, files: Record<string, string | n
         if (body === null) fs.rmSync(p);
         else fs.writeFileSync(p, body);
     }
-    git(clone, 'add', '-A', '--', ...Object.keys(files));
+    git(clone, 'add', '-A', '-f', '--', ...Object.keys(files));
     git(clone, 'commit', '-q', '-m', branch);
     return git(clone, 'rev-parse', 'HEAD');
 }
@@ -175,6 +175,31 @@ describe('the shipped block fails to needs-owner on every anomaly', () => {
         expect(r.code).not.toBe(0);
     }, 60_000);
 
+    it('a temporary directory that exists but cannot be entered is needs-owner and is still removed', () => {
+        const head = commitOn('docs-only-no-cd', base, { 'docs/installation.md': 'no cd\n' });
+        const shim = path.join(work, 'mktemp-unenterable');
+        const made = path.join(work, 'unenterable-tmp');
+        fs.mkdirSync(shim, { recursive: true });
+        fs.writeFileSync(path.join(shim, 'mktemp'), `#!/bin/sh\nmkdir -m 600 "${made}" && echo "${made}"\n`, {
+            mode: 0o755,
+        });
+        const r = runGate(base, head, { PATH: `${shim}:${process.env['PATH'] ?? ''}` });
+        expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(temp-dir-unavailable/u);
+        expect(r.code).not.toBe(0);
+        expect(fs.existsSync(made)).toBe(false);
+    }, 60_000);
+
+    it.each(['yarn.lock', '.yarnrc.yml', 'pnpm-lock.yaml', 'bun.lock', 'bun.lockb', 'package-lock.json', '.npmrc'])(
+        'a head that changes %s is runtime-unverified',
+        (file) => {
+            const head = commitOn(`head-changes-${file.replace(/[^a-z]/gu, '-')}-manifest`, base, { [file]: `changed by the head\n` });
+            const r = runGate(base, head);
+            expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(runtime-unverified/u);
+            expect(r.code).not.toBe(0);
+        },
+        60_000,
+    );
+
     it('a failing git ls-files is runtime-unverified, never read as "nothing tracked"', () => {
         const head = commitOn('docs-only-shim', base, { 'docs/installation.md': 'shim\n' });
         const r = runGate(base, head, { PATH: `${gitShimFailingLsFiles()}:${process.env['PATH'] ?? ''}` });
~~~
