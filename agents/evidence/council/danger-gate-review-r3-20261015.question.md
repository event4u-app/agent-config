<!-- evidence-type: analysis -->

<!-- The round-3 (delta) prompt given to the council on 2026-10-15 for the danger-gate change,
     committed verbatim so the verdict recorded beside it can be checked against
     what was actually asked. Not edited after the run. -->

# Delta review of the danger-gate change — round 3

Rounds 1 and 2 reviewed the change to `src/scripts/classify_merge_risk.ts`, its tests, and the danger-gate shell block of the merge command; neither earlier diff is repeated here. Round 2's seats requested changes. The findings raised in round 2, as the seats stated them:

1. `reopenPolicyOf()` returned `absent` for valid YAML it does not parse — a flow mapping `{reopen_policy: owner}` or an explicit `? reopen_policy` key — although its comment claimed unfamiliar YAML fails toward owner.
2. If `mktemp -d` failed, `GATE_TMP` was empty and `BASE_DIR` became `/classifier-base`, so worktree operations could run outside a private directory.
3. The dependency-manifest check covered npm files only, not `yarn.lock`, `pnpm-lock.yaml` or Bun lockfiles.
4. The routine test checked only the registered-worktree count, not that the temporary directory was removed.
5. The malformed-output test did not assert a non-zero exit.
6. The tracked-`node_modules` half of the runtime check had no test.
7. `[ -n "$(git ls-files -- node_modules | head -n 1)" ]` observed `head`'s status, so a failing `git ls-files` looked like "nothing tracked".
8. The command did not state the clean-runner boundary it assumes for `node_modules`.

Scope of this round: the diff below, from the round-2 head to the new head — the classifier's frontmatter reader, the shell block and its prose, and two test files. Omitted: the regenerated projection `dist/agent-src/commands/pr/merge.md` (a byte copy of the command) and one `pack.yaml` token count.

Report defects in this delta and in how it answers the round-2 findings: fail-open paths that remain, a finding marked answered that is not, new defects the fixes introduced, and tests that would pass without the code they cover. For each: file:line, the failure scenario, severity. State your stance.

~~~diff
diff --git a/src/domains/git/pr/merge/command.md b/src/domains/git/pr/merge/command.md
index 305916c54..de81c64a1 100644
--- a/src/domains/git/pr/merge/command.md
+++ b/src/domains/git/pr/merge/command.md
@@ -481,23 +481,26 @@ classify it with the **base revision's** classifier, never the head's:
 ```bash
 BASE="<manifest-base_sha>"
 HEAD_SHA="<manifest-head-sha>"
-GATE_TMP="$(cd "$(mktemp -d)" && pwd -P)"
-BASE_DIR="$GATE_TMP/classifier-base"
-trap 'git worktree remove --force "$BASE_DIR" 2>/dev/null; rm -rf "$GATE_TMP"' EXIT
-VERDICT="verdict: needs-owner (base-unavailable: no classifier or no worktree at $BASE)"
-if [ -n "$(git ls-files -- node_modules | head -n 1)" ] \
-   || ! git diff --quiet "$BASE...$HEAD_SHA" -- package.json package-lock.json npm-shrinkwrap.json .npmrc; then
-  VERDICT="verdict: needs-owner (runtime-unverified: the head tracks node_modules or changes the manifest tsx was installed from)"
-elif git cat-file -e "$BASE:src/scripts/classify_merge_risk.ts" \
-     && git worktree add -q --detach "$BASE_DIR" "$BASE"; then
-  OUT="$(node_modules/.bin/tsx "$BASE_DIR/src/scripts/classify_merge_risk.ts" --range "$BASE...$HEAD_SHA" --root "$PWD")"
-  CODE=$?
-  LAST="$(printf '%s\n' "$OUT" | tail -n 1)"
-  case "$CODE:$LAST" in
-    "0:verdict: routine" | "1:verdict: needs-council ("* | "2:verdict: needs-owner ("*) VERDICT="$LAST" ;;
-    *) VERDICT="verdict: needs-owner (classifier-unusable: exit $CODE, last line '$LAST')" ;;
-  esac
-  printf '%s\n' "$OUT" | sed '$d'
+VERDICT="verdict: needs-owner (temp-dir-unavailable: no private temporary directory)"
+if GATE_TMP="$(mktemp -d)" && [ -d "$GATE_TMP" ] && GATE_TMP="$(cd "$GATE_TMP" && pwd -P)" && [ -n "$GATE_TMP" ]; then
+  BASE_DIR="$GATE_TMP/classifier-base"
+  trap 'git worktree remove --force "$BASE_DIR" 2>/dev/null; rm -rf "$GATE_TMP"' EXIT
+  VERDICT="verdict: needs-owner (base-unavailable: no classifier or no worktree at $BASE)"
+  if ! TRACKED="$(git ls-files -- node_modules)" || [ -n "$TRACKED" ] \
+     || ! git diff --quiet "$BASE...$HEAD_SHA" -- package.json package-lock.json npm-shrinkwrap.json \
+          .npmrc yarn.lock .yarnrc.yml pnpm-lock.yaml bun.lock bun.lockb; then
+    VERDICT="verdict: needs-owner (runtime-unverified: node_modules unreadable or tracked, or the head changes the manifest tsx was installed from)"
+  elif git cat-file -e "$BASE:src/scripts/classify_merge_risk.ts" \
+       && git worktree add -q --detach "$BASE_DIR" "$BASE"; then
+    OUT="$(node_modules/.bin/tsx "$BASE_DIR/src/scripts/classify_merge_risk.ts" --range "$BASE...$HEAD_SHA" --root "$PWD")"
+    CODE=$?
+    LAST="$(printf '%s\n' "$OUT" | tail -n 1)"
+    case "$CODE:$LAST" in
+      "0:verdict: routine" | "1:verdict: needs-council ("* | "2:verdict: needs-owner ("*) VERDICT="$LAST" ;;
+      *) VERDICT="verdict: needs-owner (classifier-unusable: exit $CODE, last line '$LAST')" ;;
+    esac
+    printf '%s\n' "$OUT" | sed '$d'
+  fi
 fi
 echo "$VERDICT"
 [ "$VERDICT" = "verdict: routine" ]
@@ -519,7 +522,11 @@ do not agree on one of the three verdicts (a crash, empty or malformed output);
 and a runtime the head could have supplied. `tsx` comes from the checkout's
 `node_modules`, so a head that tracks `node_modules` or changes the dependency
 manifest it was installed from could forge the verdict; such a PR is handed over
-unclassified. The block prints the verdict last and exits 0 only on `routine`,
+unclassified. The boundary this assumes, stated rather than checked: the
+checkout's `node_modules` was installed from the base's manifest, never by this
+run from a PR head — a run that installed dependencies from a head before this
+block has already handed that head the runtime. A private temporary directory
+that cannot be made is `needs-owner` before any path is derived from it. The block prints the verdict last and exits 0 only on `routine`,
 and the `trap` removes the worktree and its temporary directory on every path.
 The temporary directory is resolved to its real path: the classifier's entry
 guard compares real paths, and on a host whose temp directory is a symlink an
diff --git a/src/scripts/classify_merge_risk.ts b/src/scripts/classify_merge_risk.ts
index 609b8c938..680d0d9ad 100644
--- a/src/scripts/classify_merge_risk.ts
+++ b/src/scripts/classify_merge_risk.ts
@@ -175,31 +175,60 @@ const RULE_FILE_RE = /(?:^|\/)rules\/([a-z0-9-]+)\.md$/;
 /** The two `reopen_policy` values that do not reserve a record to the owner. */
 const NON_OWNER_POLICIES: ReadonlySet<string> = new Set(['directional', 'unclassified']);
 
+/** A scalar value as YAML would print it plainly: comment, quotes and case removed. */
+function plainScalar(raw: string): string {
+    return raw
+        .replace(/\s+#.*$/u, '')
+        .trim()
+        .replace(/^(["'])(.*)\1$/u, '$2')
+        .trim()
+        .toLowerCase();
+}
+
 /**
  * The reopen policy one side of an ADR declares: `'absent'` when the field is
  * missing, `null` when there is no readable frontmatter.
  *
  * Read by hand, not through a YAML library: the base copy runs from a detached
  * worktree with no `node_modules` of its own, so it may import only `node:`
- * built-ins. The reading therefore fails toward the owner wherever YAML could
- * mean something this parser does not see: every occurrence of the key is read
- * (a duplicate cannot hide an `owner`), a trailing comment and quotes are
- * stripped, and any value that is not one of the two non-owner policies —
- * empty, a block scalar, a tag, a typo — reads as `'owner'`.
+ * built-ins. So the reader accepts one subset — top-level lines `key: value`
+ * with an unquoted key, and indented or `- ` lines beneath them — and reads
+ * `'owner'` for anything outside it, because outside it YAML could say `owner`
+ * where this parser cannot see it: a flow mapping, an explicit `?` key, a quoted
+ * or escaped key, a merge key, or the word `reopen_policy` anywhere the subset
+ * did not read it. Inside the subset every occurrence counts (a duplicate cannot
+ * hide an `owner`), and any value other than the two non-owner policies — empty,
+ * a block scalar, a tag, an alias, a typo — reads as `'owner'` too.
  */
 export function reopenPolicyOf(text: string): string | null {
     const fm = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
     if (fm === null) {
         return null;
     }
-    const values = [...(fm[1] ?? '').matchAll(/^\s*["']?reopen_policy["']?\s*:(.*)$/gim)].map((m) =>
-        (m[1] ?? '')
-            .replace(/\s+#.*$/u, '')
-            .trim()
-            .replace(/^(["'])(.*)\1$/u, '$2')
-            .trim()
-            .toLowerCase(),
-    );
+    const body = fm[1] ?? '';
+    const values: string[] = [];
+    let outsideSubset = /<<\s*:/u.test(body);
+    for (const line of body.split(/\r?\n/u)) {
+        if (line.trim() === '' || /^\s*#/u.test(line)) {
+            continue;
+        }
+        if (/^\s/u.test(line) || line.startsWith('- ')) {
+            const child = /^\s*(?:-\s+)?reopen_policy\s*:(.*)$/iu.exec(line);
+            if (child !== null) {
+                values.push(plainScalar(child[1] ?? ''));
+            }
+            continue;
+        }
+        const top = /^([A-Za-z0-9_-]+)\s*:(.*)$/u.exec(line);
+        if (top === null) {
+            outsideSubset = true;
+        } else if ((top[1] ?? '').toLowerCase() === 'reopen_policy') {
+            values.push(plainScalar(top[2] ?? ''));
+        }
+    }
+    if (outsideSubset || (values.length === 0 && /reopen_policy/iu.test(body))) {
+        return 'owner';
+    }
     if (values.length === 0) {
         return 'absent';
     }
diff --git a/tests/scripts/classify_merge_risk.test.ts b/tests/scripts/classify_merge_risk.test.ts
index 0b52cc8b5..0160ffcba 100644
--- a/tests/scripts/classify_merge_risk.test.ts
+++ b/tests/scripts/classify_merge_risk.test.ts
@@ -255,6 +255,31 @@ describe('frontmatter reading — both sides, failing closed', () => {
             expect(reopenPolicyOf(`---\nid: ADR-1\n${line}\n---\n`), line).toBe('owner');
         }
         expect(reopenPolicyOf('---\nreopen_policy: directional\nreopen_policy: owner\n---\n')).toBe('owner');
+        expect(reopenPolicyOf('---\nreopen_policy: *policy\n---\n')).toBe('owner');
+    });
+
+    it('reads owner for YAML outside the subset it parses, wherever owner could hide there', () => {
+        for (const fm of [
+            '{reopen_policy: owner}',
+            '? reopen_policy\n: owner',
+            '"reopen_policy": directional',
+            '"reopen\\u005fpolicy": owner',
+            'base: &b\n  reopen_policy: owner\n<<: *b',
+            'id: ADR-1\nnotes: {reopen_policy: owner}',
+        ]) {
+            expect(reopenPolicyOf(`---\n${fm}\n---\n`), fm).toBe('owner');
+        }
+    });
+
+    it('reads every committed ADR as the policy it declares — the subset does not over-fire', () => {
+        const dir = path.resolve(__dirname, '..', '..', 'docs', 'decisions');
+        const adrs = fs.readdirSync(dir).filter((f) => /^ADR-.*\.md$/u.test(f));
+        expect(adrs.length).toBeGreaterThan(40);
+        for (const f of adrs) {
+            const text = fs.readFileSync(path.join(dir, f), 'utf8');
+            const declared = /^reopen_policy:\s*(\S+)/mu.exec(text)?.[1] ?? 'absent';
+            expect(reopenPolicyOf(text), f).toBe(declared);
+        }
         expect(reopenPolicyOf('---\nreopen_policy: unclassified # not yet\n---\n')).toBe('unclassified');
     });
 
diff --git a/tests/scripts/classify_merge_risk_base_revision.test.ts b/tests/scripts/classify_merge_risk_base_revision.test.ts
index be9b413c9..1a2ce7e68 100644
--- a/tests/scripts/classify_merge_risk_base_revision.test.ts
+++ b/tests/scripts/classify_merge_risk_base_revision.test.ts
@@ -67,12 +67,29 @@ function gateBlock(): string {
 }
 
 /** Run the shipped block for `baseSha...headSha` inside the clone. */
-function runGate(baseSha: string, headSha: string): { lines: string[]; code: number | null } {
+function runGate(
+    baseSha: string,
+    headSha: string,
+    env: Record<string, string> = {},
+): { lines: string[]; code: number | null } {
     const script = gateBlock().replaceAll('<manifest-base_sha>', baseSha).replaceAll('<manifest-head-sha>', headSha);
-    const r = spawnSync('bash', ['-c', script], { cwd: clone, encoding: 'utf8' });
+    const r = spawnSync('bash', ['-c', script], { cwd: clone, encoding: 'utf8', env: { ...process.env, ...env } });
     return { lines: (r.stdout ?? '').trim().split('\n'), code: r.status };
 }
 
+/** A `git` on PATH that fails `ls-files` and passes every other subcommand through. */
+function gitShimFailingLsFiles(): string {
+    const dir = path.join(work, 'shim');
+    fs.mkdirSync(dir, { recursive: true });
+    const real = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim();
+    fs.writeFileSync(
+        path.join(dir, 'git'),
+        `#!/bin/sh\nif [ "$1" = "ls-files" ]; then exit 1; fi\nexec "${real}" "$@"\n`,
+        { mode: 0o755 },
+    );
+    return dir;
+}
+
 /** A commit on a fresh branch from `from`, writing each file as given (null deletes it). */
 function commitOn(branch: string, from: string, files: Record<string, string | null>): string {
     git(clone, 'checkout', '-q', '-b', branch, from);
@@ -135,13 +152,55 @@ describe('the code that classes a change is not the change’s own', () => {
 });
 
 describe('the shipped block fails to needs-owner on every anomaly', () => {
-    it('a routine head is routine, exits 0 and leaves no worktree behind', () => {
+    it('a routine head is routine, exits 0 and leaves no worktree and no temp directory behind', () => {
         const before = worktreeCount();
+        const tmp = path.join(work, 'gate-tmp');
+        fs.mkdirSync(tmp);
         const head = commitOn('docs-only', base, { 'docs/installation.md': 'changed\n' });
-        const r = runGate(base, head);
+        const r = runGate(base, head, { TMPDIR: tmp });
         expect(r.lines[r.lines.length - 1]).toBe('verdict: routine');
         expect(r.code).toBe(0);
         expect(worktreeCount()).toBe(before);
+        // tsx keeps its own compile cache under TMPDIR; only the gate's directory must be gone.
+        expect(fs.readdirSync(tmp).filter((e) => !e.startsWith('tsx-'))).toEqual([]);
+    }, 60_000);
+
+    it('a temporary directory that cannot be made is needs-owner before any path is derived', () => {
+        const head = commitOn('docs-only-no-tmp', base, { 'docs/installation.md': 'no tmp\n' });
+        const shim = path.join(work, 'mktemp-shim');
+        fs.mkdirSync(shim, { recursive: true });
+        fs.writeFileSync(path.join(shim, 'mktemp'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
+        const r = runGate(base, head, { PATH: `${shim}:${process.env['PATH'] ?? ''}` });
+        expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(temp-dir-unavailable/u);
+        expect(r.code).not.toBe(0);
+    }, 60_000);
+
+    it('a failing git ls-files is runtime-unverified, never read as "nothing tracked"', () => {
+        const head = commitOn('docs-only-shim', base, { 'docs/installation.md': 'shim\n' });
+        const r = runGate(base, head, { PATH: `${gitShimFailingLsFiles()}:${process.env['PATH'] ?? ''}` });
+        expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(runtime-unverified/u);
+        expect(r.code).not.toBe(0);
+    }, 60_000);
+
+    it('a head that tracks node_modules is runtime-unverified', () => {
+        git(clone, 'checkout', '-q', '-b', 'tracks-node-modules', base);
+        fs.unlinkSync(path.join(clone, 'node_modules'));
+        fs.mkdirSync(path.join(clone, 'node_modules', '.bin'), { recursive: true });
+        fs.writeFileSync(path.join(clone, 'node_modules', '.bin', 'tsx'), '#!/bin/sh\necho "verdict: routine"\n', {
+            mode: 0o755,
+        });
+        git(clone, 'add', '-f', '--', 'node_modules');
+        git(clone, 'commit', '-q', '-m', 'tracks node_modules');
+        const head = git(clone, 'rev-parse', 'HEAD');
+        try {
+            const r = runGate(base, head);
+            expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(runtime-unverified/u);
+            expect(r.code).not.toBe(0);
+        } finally {
+            git(clone, 'checkout', '-q', '--detach', base);
+            fs.rmSync(path.join(clone, 'node_modules'), { recursive: true, force: true });
+            fs.symlinkSync(path.join(REPO, 'node_modules'), path.join(clone, 'node_modules'));
+        }
     }, 60_000);
 
     it('the downgrade attack run through the block is needs-owner and exits non-zero', () => {
@@ -169,6 +228,7 @@ describe('the shipped block fails to needs-owner on every anomaly', () => {
         const head = commitOn('head-on-lying', lying, { 'docs/installation.md': 'y\n' });
         const r = runGate(lying, head);
         expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(classifier-unusable: exit 0/u);
+        expect(r.code).not.toBe(0);
     }, 60_000);
 
     it('a base without the classifier is base-unavailable, never the head copy', () => {
~~~
