<!-- evidence-type: analysis -->

<!-- The round-2 (delta) prompt given to the council on 2026-10-15 for the danger-gate change,
     committed verbatim so the verdict recorded beside it can be checked against
     what was actually asked. Not edited after the run. -->

# Delta review of the danger-gate change — round 2

Round 1 reviewed the change to `src/scripts/classify_merge_risk.ts`, its tests, and the danger-gate section of the merge command (the full round-1 diff is not repeated here). Both seats requested changes. The findings raised in round 1, as the seats stated them:

1. The command's shell block did not implement fail-closed: a `tsx` failure was masked by the following cleanup, and the last line was never validated.
2. The base copy ran through the head checkout's `node_modules/.bin/tsx`, which a head-controlled dependency install could replace.
3. `exists()` treated every failed `git cat-file -e` as absence, so a failed read could skip a side carrying `owner`.
4. `consequenceMembersOf()` accepted an array for `members`.
5. Cleanup was incomplete: the `mktemp -d` parent survived, and interruption could leave a registered worktree.
6. Suffix-anchored path patterns also match fixtures and examples.
7. The "every owner trigger id is one the classifier can emit" test was tautological.
8. `reopenPolicyOf()` missed valid YAML such as a trailing comment, and returned non-owner for unrecognised values.
9. The fallback branch exited 0.
10. The command tests checked prose, not the executable block.
11. Historical replays are skipped in a shallow clone.
12. `SELF_SURFACE_RE` names ADR-282 by number, so a successor ADR would not be covered by that trigger.

Scope of this round: the diff below, from the round-1 head to the new head — the classifier, the shell block and its prose in the merge command, and the four test files. Omitted: the regenerated projection `dist/agent-src/commands/pr/merge.md` (a byte copy of the command), one `pack.yaml` token count, and one roadmap paragraph. Not changed in this round, with the reason recorded in the review record: finding 6 (the width is deliberately the ratification gate's own any-prefix rule pattern, so every projection root matches, and an extra match errs toward a review), finding 11 (the replays skip by name; each path they cover is also a hand-written case), and finding 12 (ADR-282 itself declares `reopen_policy: owner`, so the new `owner-reserved-decision` trigger already sends it to the owner; a successor that declares the same reaches the owner the same way, and one that does not is a residual the record states).

Report defects in this delta and in how it answers the round-1 findings: fail-open paths that remain, a finding marked answered that is not, new defects the fixes introduced, and tests that would pass without the code they cover. For each: file:line, the failure scenario, severity. State your stance.

~~~diff
diff --git a/src/domains/git/pr/merge/command.md b/src/domains/git/pr/merge/command.md
index c193bd487..305916c54 100644
--- a/src/domains/git/pr/merge/command.md
+++ b/src/domains/git/pr/merge/command.md
@@ -479,15 +479,28 @@ Once required checks are green on the manifest head and the PR is mergeable,
 classify it with the **base revision's** classifier, never the head's:
 
 ```bash
-BASE_DIR="$(mktemp -d)/classifier-base"
-if git cat-file -e "<manifest-base_sha>:src/scripts/classify_merge_risk.ts" \
-   && git worktree add -q --detach "$BASE_DIR" "<manifest-base_sha>"; then
-  node_modules/.bin/tsx "$BASE_DIR/src/scripts/classify_merge_risk.ts" \
-    --range "<manifest-base_sha>...<manifest-head-sha>" --root "$PWD"
-  git worktree remove --force "$BASE_DIR"
-else
-  echo "verdict: needs-owner (base-unavailable: no classifier or no worktree at <manifest-base_sha>)"
+BASE="<manifest-base_sha>"
+HEAD_SHA="<manifest-head-sha>"
+GATE_TMP="$(cd "$(mktemp -d)" && pwd -P)"
+BASE_DIR="$GATE_TMP/classifier-base"
+trap 'git worktree remove --force "$BASE_DIR" 2>/dev/null; rm -rf "$GATE_TMP"' EXIT
+VERDICT="verdict: needs-owner (base-unavailable: no classifier or no worktree at $BASE)"
+if [ -n "$(git ls-files -- node_modules | head -n 1)" ] \
+   || ! git diff --quiet "$BASE...$HEAD_SHA" -- package.json package-lock.json npm-shrinkwrap.json .npmrc; then
+  VERDICT="verdict: needs-owner (runtime-unverified: the head tracks node_modules or changes the manifest tsx was installed from)"
+elif git cat-file -e "$BASE:src/scripts/classify_merge_risk.ts" \
+     && git worktree add -q --detach "$BASE_DIR" "$BASE"; then
+  OUT="$(node_modules/.bin/tsx "$BASE_DIR/src/scripts/classify_merge_risk.ts" --range "$BASE...$HEAD_SHA" --root "$PWD")"
+  CODE=$?
+  LAST="$(printf '%s\n' "$OUT" | tail -n 1)"
+  case "$CODE:$LAST" in
+    "0:verdict: routine" | "1:verdict: needs-council ("* | "2:verdict: needs-owner ("*) VERDICT="$LAST" ;;
+    *) VERDICT="verdict: needs-owner (classifier-unusable: exit $CODE, last line '$LAST')" ;;
+  esac
+  printf '%s\n' "$OUT" | sed '$d'
 fi
+echo "$VERDICT"
+[ "$VERDICT" = "verdict: routine" ]
 ```
 
 **Why the base.** § 2 checked the PR out, so the tree's own copy of the
@@ -495,12 +508,23 @@ classifier — and of `check_kernel_edit_ratified`, whose `classifyPaths` it
 reads — is the head's: a PR could rewrite the code that classes it and call
 itself `routine`. The ratification gate's workflow step records the same defect
 and runs the base copy for the same reason. The base copy is run directly with
-the head's `tsx`, not through `./scripts-run`, whose dispatcher is the head's
+the checkout's `tsx`, not through `./scripts-run`, whose dispatcher is the head's
 code too; the consequence-class list and each ADR's `reopen_policy` are read
-from both revisions by the base copy itself. A base without the classifier, a
-worktree that cannot be made, or a last line that is not a verdict is
-**`needs-owner`** and says why — never a skipped gate and never a fall-back to
-the head's copy.
+from both revisions by the base copy itself.
+
+**What it fails to.** Every anomaly is **`needs-owner`** and says why — never a
+skipped gate and never a fall-back to the head's copy: a base without the
+classifier or a worktree that cannot be made; an exit status and last line that
+do not agree on one of the three verdicts (a crash, empty or malformed output);
+and a runtime the head could have supplied. `tsx` comes from the checkout's
+`node_modules`, so a head that tracks `node_modules` or changes the dependency
+manifest it was installed from could forge the verdict; such a PR is handed over
+unclassified. The block prints the verdict last and exits 0 only on `routine`,
+and the `trap` removes the worktree and its temporary directory on every path.
+The temporary directory is resolved to its real path: the classifier's entry
+guard compares real paths, and on a host whose temp directory is a symlink an
+unresolved path makes it print nothing — which the block would correctly, but
+uselessly, hand over as `classifier-unusable`.
 
 The last line is the verdict; each trigger names the rule it comes from. An
 unreadable diff is `needs-council` — the gate fails closed.
diff --git a/src/scripts/classify_merge_risk.ts b/src/scripts/classify_merge_risk.ts
index 85f0e917a..609b8c938 100644
--- a/src/scripts/classify_merge_risk.ts
+++ b/src/scripts/classify_merge_risk.ts
@@ -167,16 +167,43 @@ const MERGE_RULE_CARRIER_RE =
 const CONSUMER_TEMPLATE_RE = /(?:^|\/)agent-src\/templates\/AGENTS\.md$/;
 
 const DECISION_RECORD_RE = /^docs\/decisions\/ADR-[^/]+\.md$/;
+// Any-prefix like the ratification gate's own rule pattern: every projection
+// root (`dist/agent-src/`, `.claude/`, `.augment/`, …) must match, and a fixture
+// that also matches errs toward a review, never toward `routine`.
 const RULE_FILE_RE = /(?:^|\/)rules\/([a-z0-9-]+)\.md$/;
 
-/** The reopen policy one side of an ADR declares; `null` when it has no readable frontmatter. */
+/** The two `reopen_policy` values that do not reserve a record to the owner. */
+const NON_OWNER_POLICIES: ReadonlySet<string> = new Set(['directional', 'unclassified']);
+
+/**
+ * The reopen policy one side of an ADR declares: `'absent'` when the field is
+ * missing, `null` when there is no readable frontmatter.
+ *
+ * Read by hand, not through a YAML library: the base copy runs from a detached
+ * worktree with no `node_modules` of its own, so it may import only `node:`
+ * built-ins. The reading therefore fails toward the owner wherever YAML could
+ * mean something this parser does not see: every occurrence of the key is read
+ * (a duplicate cannot hide an `owner`), a trailing comment and quotes are
+ * stripped, and any value that is not one of the two non-owner policies —
+ * empty, a block scalar, a tag, a typo — reads as `'owner'`.
+ */
 export function reopenPolicyOf(text: string): string | null {
     const fm = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
     if (fm === null) {
         return null;
     }
-    const m = /^reopen_policy:\s*["']?([a-z-]+)["']?\s*$/m.exec(fm[1] ?? '');
-    return m === null ? 'absent' : (m[1] ?? 'absent');
+    const values = [...(fm[1] ?? '').matchAll(/^\s*["']?reopen_policy["']?\s*:(.*)$/gim)].map((m) =>
+        (m[1] ?? '')
+            .replace(/\s+#.*$/u, '')
+            .trim()
+            .replace(/^(["'])(.*)\1$/u, '$2')
+            .trim()
+            .toLowerCase(),
+    );
+    if (values.length === 0) {
+        return 'absent';
+    }
+    return values.every((v) => NON_OWNER_POLICIES.has(v)) ? (values[0] ?? 'absent') : 'owner';
 }
 
 /**
@@ -206,7 +233,9 @@ export function combinePolicy(sides: readonly (string | null | undefined)[]): De
 export function consequenceMembersOf(text: string): Set<string> | null {
     try {
         const raw = JSON.parse(text) as { members?: unknown };
-        return raw.members !== null && typeof raw.members === 'object' ? new Set(Object.keys(raw.members)) : null;
+        return raw.members !== null && typeof raw.members === 'object' && !Array.isArray(raw.members)
+            ? new Set(Object.keys(raw.members))
+            : null;
     } catch {
         return null;
     }
@@ -518,6 +547,28 @@ function failClosed(reason: string): Classification {
     return { verdict: 'needs-council', triggers: [{ id: 'diff-unreadable', rule: 'fail closed — ADR-282', paths: [reason] }] };
 }
 
+/**
+ * One file at one revision: its text, `undefined` when the revision has no such
+ * path, `null` when the read failed. `ls-tree` tells absence (exit 0, no output)
+ * from a failed read (non-zero), which `cat-file -e` does not — and a failed
+ * read taken for absence would skip the side that carries an `owner`.
+ */
+export function readSide(
+    run: (args: string[]) => { ok: boolean; out: string },
+    rev: string,
+    p: string,
+): string | null | undefined {
+    const listed = run(['ls-tree', rev, '--', p]);
+    if (!listed.ok) {
+        return null;
+    }
+    if (listed.out.trim() === '') {
+        return undefined;
+    }
+    const shown = run(['show', `${rev}:${p}`]);
+    return shown.ok ? shown.out : null;
+}
+
 /**
  * The consequence class across both sides: the union, so a head can add a
  * member but never remove one. A side that exists and does not read, or no side
@@ -558,13 +609,7 @@ export function classifyTarget(root: string, target: { pr?: string | undefined;
         return failClosed((e as Error).message);
     }
     const exists = (rev: string, p: string): boolean => git(root, ['cat-file', '-e', `${rev}:${p}`]).ok;
-    const side = (rev: string, p: string): string | null | undefined => {
-        if (!exists(rev, p)) {
-            return undefined;
-        }
-        const r = git(root, ['show', `${rev}:${p}`]);
-        return r.ok ? r.out : null;
-    };
+    const side = (rev: string, p: string): string | null | undefined => readSide((args) => git(root, args), rev, p);
     return classifyChanges(entries, {
         dirExistsInHead: (dir) => exists(resolved.head, dir),
         decisionPolicy: (p) => combinePolicy([side(resolved.base, p), side(resolved.head, p)]),
diff --git a/tests/scripts/classify_merge_risk.test.ts b/tests/scripts/classify_merge_risk.test.ts
index 6487125a5..0b52cc8b5 100644
--- a/tests/scripts/classify_merge_risk.test.ts
+++ b/tests/scripts/classify_merge_risk.test.ts
@@ -12,6 +12,7 @@ import {
     DELETION_THRESHOLD,
     main,
     parseNameStatus,
+    readSide,
     reopenPolicyOf,
     resolvePr,
     unionMembers,
@@ -241,6 +242,22 @@ describe('frontmatter reading — both sides, failing closed', () => {
         expect(reopenPolicyOf('# no frontmatter\n')).toBeNull();
     });
 
+    it('reads every YAML spelling of owner as owner, and any unrecognised value as owner', () => {
+        for (const line of [
+            'reopen_policy: owner # governance reservation',
+            "reopen_policy: 'owner'",
+            'Reopen_Policy: OWNER',
+            'reopen_policy:',
+            'reopen_policy: |',
+            'reopen_policy: !!str owner',
+            'reopen_policy: typo-owner',
+        ]) {
+            expect(reopenPolicyOf(`---\nid: ADR-1\n${line}\n---\n`), line).toBe('owner');
+        }
+        expect(reopenPolicyOf('---\nreopen_policy: directional\nreopen_policy: owner\n---\n')).toBe('owner');
+        expect(reopenPolicyOf('---\nreopen_policy: unclassified # not yet\n---\n')).toBe('unclassified');
+    });
+
     it('owner at base OR at head fires; a side that exists and cannot be read fires', () => {
         const owner = '---\nreopen_policy: owner\n---\n';
         const other = '---\nreopen_policy: directional\n---\n';
@@ -257,7 +274,18 @@ describe('frontmatter reading — both sides, failing closed', () => {
         expect([...(unionMembers([a, b]) ?? [])].sort()).toEqual(['session-canary', 'tool-safety']);
         expect(unionMembers([a, 'not json'])).toBeNull();
         expect(unionMembers([undefined, undefined])).toBeNull();
-        expect(consequenceMembersOf('{"members": []}')).toEqual(new Set());
+        expect(consequenceMembersOf('{"members": {}}')).toEqual(new Set());
+        expect(consequenceMembersOf('{"members": []}')).toBeNull();
+        expect(consequenceMembersOf('{"members": null}')).toBeNull();
+    });
+
+    it('a failed read is null, never absence; an empty listing is absence', () => {
+        const run = (listOk: boolean, listOut: string, showOk: boolean) => (args: string[]) =>
+            args[0] === 'ls-tree' ? { ok: listOk, out: listOut } : { ok: showOk, out: 'text' };
+        expect(readSide(run(false, '', true), 'r', 'p')).toBeNull();
+        expect(readSide(run(true, '', true), 'r', 'p')).toBeUndefined();
+        expect(readSide(run(true, '100644 blob abc\tp\n', false), 'r', 'p')).toBeNull();
+        expect(readSide(run(true, '100644 blob abc\tp\n', true), 'r', 'p')).toBe('text');
     });
 
     it('a real range reads the head frontmatter of an added owner-reserved ADR', () => {
diff --git a/tests/scripts/classify_merge_risk_base_revision.test.ts b/tests/scripts/classify_merge_risk_base_revision.test.ts
index b3fbd091b..be9b413c9 100644
--- a/tests/scripts/classify_merge_risk_base_revision.test.ts
+++ b/tests/scripts/classify_merge_risk_base_revision.test.ts
@@ -57,6 +57,37 @@ function attack(branch: string, file: string, edit: (src: string) => string): st
     return git(clone, 'rev-parse', 'HEAD');
 }
 
+/** The danger gate's shell block, exactly as the merge command ships it. */
+function gateBlock(): string {
+    const cmd = fs.readFileSync(path.join(REPO, 'src/domains/git/pr/merge/command.md'), 'utf8');
+    const start = cmd.indexOf('## 9a. Danger gate');
+    const m = /```bash\n([\s\S]*?)```/u.exec(cmd.slice(start));
+    if (start < 0 || m === null) throw new Error('the danger gate block is not where the command keeps it');
+    return m[1] ?? '';
+}
+
+/** Run the shipped block for `baseSha...headSha` inside the clone. */
+function runGate(baseSha: string, headSha: string): { lines: string[]; code: number | null } {
+    const script = gateBlock().replaceAll('<manifest-base_sha>', baseSha).replaceAll('<manifest-head-sha>', headSha);
+    const r = spawnSync('bash', ['-c', script], { cwd: clone, encoding: 'utf8' });
+    return { lines: (r.stdout ?? '').trim().split('\n'), code: r.status };
+}
+
+/** A commit on a fresh branch from `from`, writing each file as given (null deletes it). */
+function commitOn(branch: string, from: string, files: Record<string, string | null>): string {
+    git(clone, 'checkout', '-q', '-b', branch, from);
+    for (const [f, body] of Object.entries(files)) {
+        const p = path.join(clone, f);
+        if (body === null) fs.rmSync(p);
+        else fs.writeFileSync(p, body);
+    }
+    git(clone, 'add', '-A', '--', ...Object.keys(files));
+    git(clone, 'commit', '-q', '-m', branch);
+    return git(clone, 'rev-parse', 'HEAD');
+}
+
+const worktreeCount = (): number => git(clone, 'worktree', 'list').split('\n').length;
+
 beforeAll(() => {
     // realpath: on macOS the tmpdir is a symlink, and the classifier's main guard compares real paths.
     work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cmr-base-')));
@@ -71,6 +102,8 @@ beforeAll(() => {
     git(clone, 'commit', '-q', '--allow-empty', '-m', 'base: the classifier under review');
     base = git(clone, 'rev-parse', 'HEAD');
     git(clone, 'worktree', 'add', '-q', '--detach', path.join(work, 'base'), base);
+    // The shipped block runs the checkout's tsx; the clone borrows this repository's.
+    fs.symlinkSync(path.join(REPO, 'node_modules'), path.join(clone, 'node_modules'));
 }, 60_000);
 
 afterAll(() => {
@@ -100,3 +133,59 @@ describe('the code that classes a change is not the change’s own', () => {
         expect(verdictFrom(path.join(work, 'base'), head)).toMatch(/^verdict: needs-owner/u);
     }, 60_000);
 });
+
+describe('the shipped block fails to needs-owner on every anomaly', () => {
+    it('a routine head is routine, exits 0 and leaves no worktree behind', () => {
+        const before = worktreeCount();
+        const head = commitOn('docs-only', base, { 'docs/installation.md': 'changed\n' });
+        const r = runGate(base, head);
+        expect(r.lines[r.lines.length - 1]).toBe('verdict: routine');
+        expect(r.code).toBe(0);
+        expect(worktreeCount()).toBe(before);
+    }, 60_000);
+
+    it('the downgrade attack run through the block is needs-owner and exits non-zero', () => {
+        const head = attack('downgrade-via-block', CLASSIFIER, (s) =>
+            s.replace(
+                'export function verdictOf(triggers: readonly Trigger[]): Verdict {',
+                "export function verdictOf(triggers: readonly Trigger[]): Verdict {\n    if (triggers.length >= 0) return 'routine';",
+            ),
+        );
+        const r = runGate(base, head);
+        expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(/u);
+        expect(r.code).not.toBe(0);
+    }, 60_000);
+
+    it('a base classifier that crashes is classifier-unusable', () => {
+        const crashing = commitOn('base-crashes', base, { [CLASSIFIER]: 'process.exit(3);\n' });
+        const head = commitOn('head-on-crashing', crashing, { 'docs/installation.md': 'x\n' });
+        const r = runGate(crashing, head);
+        expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(classifier-unusable: exit 3/u);
+        expect(r.code).not.toBe(0);
+    }, 60_000);
+
+    it('a base classifier that exits 0 with a malformed last line is classifier-unusable', () => {
+        const lying = commitOn('base-lies', base, { [CLASSIFIER]: "console.log('verdict: routine-ish');\n" });
+        const head = commitOn('head-on-lying', lying, { 'docs/installation.md': 'y\n' });
+        const r = runGate(lying, head);
+        expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(classifier-unusable: exit 0/u);
+    }, 60_000);
+
+    it('a base without the classifier is base-unavailable, never the head copy', () => {
+        const bare = commitOn('base-without-classifier', base, { [CLASSIFIER]: null });
+        const head = commitOn('head-restores-classifier', bare, {
+            [CLASSIFIER]: fs.readFileSync(path.join(REPO, CLASSIFIER), 'utf8'),
+        });
+        const r = runGate(bare, head);
+        expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(base-unavailable/u);
+        expect(r.code).not.toBe(0);
+    }, 60_000);
+
+    it('a head that changes the manifest tsx was installed from is runtime-unverified', () => {
+        const pkg = fs.readFileSync(path.join(clone, 'package.json'), 'utf8');
+        const head = commitOn('head-changes-package', base, { 'package.json': pkg.replace('{', '{\n  "x": 1,') });
+        const r = runGate(base, head);
+        expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(runtime-unverified/u);
+        expect(r.code).not.toBe(0);
+    }, 60_000);
+});
diff --git a/tests/scripts/classify_merge_risk_needs_owner.test.ts b/tests/scripts/classify_merge_risk_needs_owner.test.ts
index 5268ea753..7612cd246 100644
--- a/tests/scripts/classify_merge_risk_needs_owner.test.ts
+++ b/tests/scripts/classify_merge_risk_needs_owner.test.ts
@@ -117,10 +117,24 @@ describe('precedence of the three verdicts', () => {
         expect(r.triggers.map((t) => t.id)).toEqual(['ci-workflow', 'council-surface']);
     });
 
-    it('every owner trigger id is one the classifier can emit', () => {
-        const src = fs.readFileSync(path.resolve(__dirname, '../../src/scripts/classify_merge_risk.ts'), 'utf8');
-        for (const id of OWNER_TRIGGERS) {
-            expect(src).toContain(`'${id}'`);
+    it('every owner trigger fires on a path of its own and alone makes the verdict needs-owner', () => {
+        const witness: Record<string, string> = {
+            'governance-surface': 'src/rules/non-destructive-by-default.md',
+            'merge-authority-surface': 'src/scripts/classify_merge_risk.ts',
+            'reviewer-trust-chain': 'src/scripts/_lib/ratification_subject.ts',
+            'council-surface': 'src/scripts/council_cli.ts',
+            'ratification-contract': 'docs/contracts/ratification-artifact.md',
+            'owner-reserved-decision': 'docs/decisions/ADR-281-x.md',
+        };
+        expect(Object.keys(witness).sort()).toEqual([...OWNER_TRIGGERS].sort());
+        for (const [id, p] of Object.entries(witness)) {
+            const r = classifyChanges([mod(p)], {
+                dirExistsInHead: () => true,
+                decisionPolicy: () => 'owner',
+                consequenceMembers: new Set(),
+            });
+            expect(r.triggers.map((t) => t.id)).toEqual([id]);
+            expect(r.verdict).toBe('needs-owner');
         }
     });
 });
diff --git a/tests/scripts/pr_merge_danger_gate_command.test.ts b/tests/scripts/pr_merge_danger_gate_command.test.ts
index b31c639dc..9b944450e 100644
--- a/tests/scripts/pr_merge_danger_gate_command.test.ts
+++ b/tests/scripts/pr_merge_danger_gate_command.test.ts
@@ -26,7 +26,7 @@ const GATE = section(MERGE, '## 9a. Danger gate');
 
 describe('§ 9a classes a PR from the base revision', () => {
     it('materialises the manifest base in a worktree and runs that copy with --root on the head', () => {
-        expect(GATE).toContain('git worktree add -q --detach "$BASE_DIR" "<manifest-base_sha>"');
+        expect(GATE).toContain('git worktree add -q --detach "$BASE_DIR" "$BASE"');
         expect(GATE).toContain('"$BASE_DIR/src/scripts/classify_merge_risk.ts"');
         expect(GATE).toContain('--root "$PWD"');
     });
@@ -36,8 +36,8 @@ describe('§ 9a classes a PR from the base revision', () => {
     });
 
     it('a base it cannot use is needs-owner, never a skip and never a fall-back', () => {
-        expect(GATE).toContain('echo "verdict: needs-owner (base-unavailable');
-        expect(GATE).toMatch(/never a skipped gate and never a fall-back to\s+the head's copy/u);
+        expect(GATE).toContain('VERDICT="verdict: needs-owner (base-unavailable');
+        expect(GATE).toMatch(/never a\s+skipped gate and never a fall-back to the head's copy/u);
     });
 });
 
~~~
