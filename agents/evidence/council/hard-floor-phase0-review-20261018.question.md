<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-18 for branch drain/road-to-a-hard-floor-the-shell-cannot-talk-past-20261018, verbatim below this comment. -->

# Modification review — category A stops granting what it cannot prove

You are one seat of a modification review. Review the change below.

Scope: the full diff of branch
`drain/road-to-a-hard-floor-the-shell-cannot-talk-past-20261018` at `01ff2e29a`
against `origin/main` @ `1876e1860`, reproduced below, including its test file.
`check_kernel_edit_ratified` classifies two files as gated (hook-plumbing
sources in the dispatcher's import closure): `src/scripts/hooks/category_a.ts`
and `src/scripts/hooks/permission_gate.ts`.

Context: on the `claude` host the hook dispatcher emits
`permissionDecision: allow` for a `pre_tool_use` call it classifies as
"category A" (read, navigation, build, test, lint inside the working tree with
no consequence operation). That allow removes the host's own confirmation
prompt. It is emitted only when no concern voted `ask` or `deny` and the
reduced severity is already `allow`. Executed on main, these Bash commands all
received the allow: `git branch -D main`, `git branch -f main HEAD~20`,
`git branch -M main old`, `cat ~/.ssh/id_rsa`, `find / -name x`,
`sort -o /home/u/.bashrc /dev/null`, `git diff --output=/home/u/.bashrc`,
`prettier --write /etc/hosts`, and the emitted reason said "inside the working
tree" for each. The change withdraws the allow from those shapes; the call then
falls back to the host's own permission handling. It does not add a deny or an
ask from this package. Separately it changes `isInsideWorkingTree`, used by
both the read-tool and the Bash branch, so that a relative path whose first
segment merely begins with two dots (`./...`, `..cache/x`) is treated as inside.

Answer each question below, numbered 1 to 9 in this order, each on its own
numbered top-level line, then close with exactly one stance line in the form
`STANCE: <label> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>` where
<label> is one of `ratified`, `confirmed-non-expanding`, `refused`.

1. What behaviour changes, including what follows from it that the diff does not state?
2. Which authority or safety boundary becomes wider or narrower, and in which direction?
3. Does the change weaken anything that judges it — a test, a gate, a threshold, this review? The standard is quoted rather than paraphrased: the implementer never silently weakens an assertion, deletes, skips or xfails a failing test, lowers a threshold, or changes fixture semantics to fit the code. Does this change do any of those?
4. Is another host or projection left as a way around the control this change touches?
5. Can it be undone, and how — by whom, with what authority, and against which revision?
6. What observation would show the claimed benefit to be false, and what rollback / kill-switch criteria does the change omit?
7. Would a smaller change do, and what does the larger one buy that the smaller one does not?
8. What does it add to standing instruction weight that every later session pays?
9. Could untrusted content steer the path this change opens, and what bounds it if so?

## The diff

```diff
diff --git a/docs/contracts/hook-architecture-v1.md b/docs/contracts/hook-architecture-v1.md
index 44acee98b..f9145e662 100644
--- a/docs/contracts/hook-architecture-v1.md
+++ b/docs/contracts/hook-architecture-v1.md
@@ -775,6 +775,15 @@ for a **category-A** call: a read, a navigation, a build, a test or a lint insid
 the working tree with no consequence operation attached
 (`src/scripts/hooks/category_a.ts`).
 
+**Corrected 2026-10-18** (`road-to-a-hard-floor-the-shell-cannot-talk-past` Phase 0):
+"inside the working tree" was enforced on the read tools only. The Bash branch now
+confines every path argument — positionals, path-shaped `--flag=value` values and a
+glued `sort -o/path` — to the working tree, withholds the allow from `git branch`
+forms that can lose a ref (`-d`, `-D`, `--delete`, `-f`, `--force`, `-m`, `--move`,
+`-M`, `-C`), and the allow's reason names the working tree only when a path was
+actually confined for that call. Withholding an allow returns the host's own
+confirmation; it never adds a question from this package.
+
 The composition policy is **one `ask` or `deny` beats every `allow`**
 (`composePermissionDecision`), and the emission additionally requires the reduced
 severity to already be `allow`, so an allow can never travel with a finding. This
diff --git a/src/scripts/hooks/category_a.ts b/src/scripts/hooks/category_a.ts
index 3a4d210ed..7a6e94a10 100644
--- a/src/scripts/hooks/category_a.ts
+++ b/src/scripts/hooks/category_a.ts
@@ -145,7 +145,9 @@ export function isInsideWorkingTree(candidate: string, root: string): boolean {
     const abs = path.resolve(root, candidate);
     const rel = path.relative(path.resolve(root), abs);
     if (rel === "") return true;
-    return !rel.startsWith("..") && !path.isAbsolute(rel);
+    // `..` as a whole first segment escapes; `...` or `..cache` is a name.
+    const escapes = rel === ".." || rel.startsWith(`..${path.sep}`);
+    return !escapes && !path.isAbsolute(rel);
 }
 
 /** Split a command on whitespace; the caller has already refused metacharacters. */
@@ -182,7 +184,7 @@ const GIT_VALUE_FLAGS: ReadonlySet<string> = new Set([
 ]);
 
 /**
- * The `git` subcommand, with global options skipped.
+ * The `git` subcommand and its argv index, with global options skipped.
  *
  * Returns `""` when a global option's VALUE escapes the working tree — an
  * absolute path or a `..` traversal. The check is textual rather than resolved
@@ -190,21 +192,143 @@ const GIT_VALUE_FLAGS: ReadonlySet<string> = new Set([
  * can decide is exactly the property that matters, and a relative path with no
  * `..` cannot escape.
  */
-function _gitSubcommand(argv: readonly string[]): string {
+function _gitSubcommandAt(argv: readonly string[]): { sub: string; index: number } {
     for (let i = 1; i < argv.length; i++) {
         const token = argv[i] as string;
-        if (!_isFlag(token)) return token;
+        if (!_isFlag(token)) return { sub: token, index: i };
         const [flag, inlineValue] = token.includes("=")
             ? [token.slice(0, token.indexOf("=")), token.slice(token.indexOf("=") + 1)]
             : [token, null];
         const value = inlineValue ?? (GIT_VALUE_FLAGS.has(flag) ? argv[++i] : undefined);
         if (value !== undefined && (path.isAbsolute(value) || value.split("/").includes(".."))) {
-            return "";
+            return { sub: "", index: -1 };
         }
     }
-    return "";
+    return { sub: "", index: -1 };
+}
+
+/**
+ * `git branch` options that can lose a ref: delete, force-reset, and the
+ * move/copy forms that overwrite an existing name.
+ *
+ * `-m`/`--move` onto a NEW name loses nothing, but whether the target exists
+ * is a fact about the repository, and this classifier is decidable from the
+ * envelope alone. So every move is withdrawn: the cost is the host's own
+ * confirmation on a rename, never a skipped one on a lost ref.
+ */
+const GIT_BRANCH_REF_LOSS_LONG: ReadonlySet<string> = new Set(["--delete", "--force", "--move"]);
+const GIT_BRANCH_REF_LOSS_SHORT = /^-[a-zA-Z]*[dDfMCm]/;
+
+function _gitBranchLosesARef(argv: readonly string[], index: number): boolean {
+    for (const token of argv.slice(index + 1)) {
+        if (token.startsWith("--")) {
+            if (GIT_BRANCH_REF_LOSS_LONG.has(token.split("=")[0] as string)) return true;
+        } else if (GIT_BRANCH_REF_LOSS_SHORT.test(token)) {
+            return true;
+        }
+    }
+    return false;
+}
+
+/**
+ * Heads that never open their arguments, so a path-shaped argument is a string
+ * and confining it would only put a prompt on `echo /tmp`.
+ */
+const NON_OPENING_HEADS: ReadonlySet<string> = new Set([
+    "pwd", "echo", "basename", "dirname", "date", "which",
+]);
+
+/**
+ * Output-writing flags (0.3). Their target is a path like any other, and
+ * the walk below already confines all three spellings that need no table:
+ * a separate token (`--output x`, `-fprint x`, `--outDir x`) is a
+ * positional, `--output=x` is an inline value, and the value-less writers
+ * (`--write`/`-w`, `--fix`) write their positionals. The one spelling the walk
+ * cannot see is a short flag with its value glued on, `sort -o/path`, which
+ * reads as a single flag token — so that is the only table.
+ */
+const GLUED_OUTPUT_FLAGS: Readonly<Record<string, string>> = { sort: "-o" };
+
+/** Pattern-taking heads whose first positional is data, not a path. */
+const PATTERN_HEADS: ReadonlySet<string> = new Set(["grep", "rg"]);
+const PATTERN_VALUE_FLAGS: ReadonlySet<string> = new Set(["-e", "--regexp"]);
+const PATTERN_FILE_FLAGS: ReadonlySet<string> = new Set(["-f", "--file"]);
+
+/** Shell quote removal; every other expansion is refused by the metacharacter rule. */
+function _unquote(token: string): string {
+    return token.replace(/["']/g, "");
+}
+
+/**
+ * Could this value name a place outside the tree? A relative value with no `..`
+ * segment cannot, so only these shapes are worth resolving in a flag value.
+ */
+function _pathShaped(value: string): boolean {
+    return value.startsWith("/") || value.startsWith("~") || value.split("/").includes("..");
 }
 
+/**
+ * Every argument of a Bash command that names a filesystem location.
+ *
+ * Positionals are all candidates — a relative positional that stays inside is
+ * harmless to check, and missing one is not. A flag's inline value is a
+ * candidate when it is path-shaped, and a glued output value always is.
+ */
+function _pathArguments(argv: readonly string[], head: string): string[] {
+    const out: string[] = [];
+    const glued = GLUED_OUTPUT_FLAGS[head];
+    const isPatternHead = PATTERN_HEADS.has(head);
+    let patternPending = isPatternHead && !argv.some((t) => {
+        const flag = t.split("=")[0] as string;
+        return PATTERN_VALUE_FLAGS.has(flag) || PATTERN_FILE_FLAGS.has(flag);
+    });
+    for (let i = 1; i < argv.length; i++) {
+        const token = _unquote(argv[i] as string);
+        if (!_isFlag(token)) {
+            if (patternPending) {
+                patternPending = false;
+                continue;
+            }
+            out.push(token);
+            continue;
+        }
+        const eq = token.indexOf("=");
+        const flag = eq >= 0 ? token.slice(0, eq) : token;
+        const inline = eq >= 0 ? token.slice(eq + 1) : null;
+        if (isPatternHead && PATTERN_VALUE_FLAGS.has(flag)) {
+            if (inline === null) i++;
+            continue;
+        }
+        if (isPatternHead && PATTERN_FILE_FLAGS.has(flag)) {
+            const value = inline ?? argv[++i];
+            if (value !== undefined) out.push(_unquote(value));
+            continue;
+        }
+        if (glued && token.startsWith(glued) && token.length > glued.length && !token.startsWith("--")) {
+            out.push(token.slice(glued.length));
+            continue;
+        }
+        if (inline !== null && _pathShaped(inline)) out.push(inline);
+    }
+    return out;
+}
+
+/** Stands in for the tree when the caller has none: absolute and `..` still escape it. */
+const UNROOTED = path.resolve("/", "agent-config-unrooted-working-tree");
+
+function _confined(candidate: string, workingTree: string): boolean {
+    if (candidate.startsWith("~")) return false;
+    return isInsideWorkingTree(candidate, workingTree.trim() ? workingTree : UNROOTED);
+}
+
+/** What the classifier decided, and whether a path confinement actually ran. */
+export interface CategoryAVerdict {
+    categoryA: boolean;
+    confinementChecked: boolean;
+}
+
+const NOT_A: CategoryAVerdict = { categoryA: false, confinementChecked: false };
+
 /** Non-flag token after the subcommand, or `""`. */
 function _secondSubcommand(argv: readonly string[]): string {
     const nonFlags = argv.slice(1).filter((t) => !_isFlag(t));
@@ -231,20 +355,14 @@ export function namesConsequenceOperation(command: string): boolean {
     return false;
 }
 
-/** Is this Bash command string category A? */
-export function isCategoryABashCommand(command: string): boolean {
-    if (typeof command !== "string" || !command.trim()) return false;
-    if (SHELL_METACHARACTERS.test(command)) return false;
-    if (namesConsequenceOperation(command)) return false;
-
-    const argv = _argv(command);
-    const head = (argv[0] ?? "").toLowerCase();
-    if (!head) return false;
-
+/** Does the head and its subcommand name a read, build, test or lint? */
+function _namesASafeOperation(argv: readonly string[], head: string): boolean {
     if (SAFE_HEADS.has(head)) return true;
 
     if (head === "git") {
-        return GIT_READ_SUBCOMMANDS.has(_gitSubcommand(argv));
+        const { sub, index } = _gitSubcommandAt(argv);
+        if (!GIT_READ_SUBCOMMANDS.has(sub)) return false;
+        return !(sub === "branch" && _gitBranchLosesARef(argv, index));
     }
 
     const allowed = RUNNER_SUBCOMMANDS[head];
@@ -258,6 +376,36 @@ export function isCategoryABashCommand(command: string): boolean {
     return true;
 }
 
+/**
+ * Classify a Bash command string.
+ *
+ * `workingTree` is the root every path argument must resolve inside. Without
+ * one, the command is judged against a stand-in root, so an absolute, `~` or
+ * `..`-escaping argument still disqualifies it.
+ */
+export function bashCategoryAVerdict(command: string, workingTree = ""): CategoryAVerdict {
+    if (typeof command !== "string" || !command.trim()) return NOT_A;
+    if (SHELL_METACHARACTERS.test(command)) return NOT_A;
+    if (namesConsequenceOperation(command)) return NOT_A;
+
+    const argv = _argv(command);
+    const head = (argv[0] ?? "").toLowerCase();
+    if (!head) return NOT_A;
+    if (!_namesASafeOperation(argv, head)) return NOT_A;
+
+    if (NON_OPENING_HEADS.has(head)) return { categoryA: true, confinementChecked: false };
+    const candidates = _pathArguments(argv, head);
+    for (const candidate of candidates) {
+        if (!_confined(candidate, workingTree)) return NOT_A;
+    }
+    return { categoryA: true, confinementChecked: candidates.length > 0 };
+}
+
+/** Is this Bash command string category A? */
+export function isCategoryABashCommand(command: string, workingTree = ""): boolean {
+    return bashCategoryAVerdict(command, workingTree).categoryA;
+}
+
 /**
  * Is this tool call category A?
  *
@@ -265,27 +413,34 @@ export function isCategoryABashCommand(command: string): boolean {
  * root means the dispatcher could not establish one, and an unestablished
  * boundary is not a boundary — the call is not category A.
  */
-export function isCategoryA(
+export function categoryAVerdict(
     toolName: string,
     toolInput: ToolInput,
     workingTree: string,
-): boolean {
-    if (!workingTree.trim()) return false;
-    if (typeof toolName !== "string" || !toolName) return false;
+): CategoryAVerdict {
+    if (!workingTree.trim()) return NOT_A;
+    if (typeof toolName !== "string" || !toolName) return NOT_A;
 
     if (READ_ONLY_TOOLS.has(toolName)) {
+        let checked = false;
         for (const key of PATH_KEYS) {
             const value = toolInput?.[key];
             if (typeof value !== "string") continue;
-            if (!isInsideWorkingTree(value, workingTree)) return false;
+            if (!isInsideWorkingTree(value, workingTree)) return NOT_A;
+            checked = true;
         }
-        return true;
+        return { categoryA: true, confinementChecked: checked };
     }
 
     if (toolName === "Bash") {
         const command = toolInput?.["command"];
-        return typeof command === "string" && isCategoryABashCommand(command);
+        return typeof command === "string" ? bashCategoryAVerdict(command, workingTree) : NOT_A;
     }
 
-    return false;
+    return NOT_A;
+}
+
+/** Is this tool call category A? */
+export function isCategoryA(toolName: string, toolInput: ToolInput, workingTree: string): boolean {
+    return categoryAVerdict(toolName, toolInput, workingTree).categoryA;
 }
diff --git a/src/scripts/hooks/permission_gate.ts b/src/scripts/hooks/permission_gate.ts
index ea1968614..37a958bae 100644
--- a/src/scripts/hooks/permission_gate.ts
+++ b/src/scripts/hooks/permission_gate.ts
@@ -14,7 +14,7 @@
  * concerns and reduces exit codes, this module reads the result and decides
  * what the host is told about permission.
  */
-import { isCategoryA, type ToolInput } from "./category_a.js";
+import { categoryAVerdict, type ToolInput } from "./category_a.js";
 import {
   composePermissionDecision,
   type PermissionDecision,
@@ -104,13 +104,13 @@ export function _permission_for(
   if (final_rc !== EXIT_ALLOW) return null;
   if (composePermissionDecision(verdicts) !== "allow") return null;
   const tool_name = _payload_tool_name(envelope);
-  if (!isCategoryA(tool_name, _payload_tool_input(envelope), _working_tree_root(envelope))) {
-    return null;
-  }
+  const verdict = categoryAVerdict(tool_name, _payload_tool_input(envelope), _working_tree_root(envelope));
+  if (!verdict.categoryA) return null;
+  // The reason may only name a check that ran for this call: a bare `pwd`
+  // had no path argument to confine, so it must not claim it was confined.
+  const where = verdict.confinementChecked ? " inside the working tree" : ", no path argument to confine";
   return {
     decision: "allow",
-    reason:
-      `agent-config: category-A ${tool_name} inside the working tree — ` +
-      `no concern gates it and none asked to.`,
+    reason: `agent-config: category-A ${tool_name}${where} — no concern gates it and none asked to.`,
   };
 }
diff --git a/tests/hooks/permission_decision.test.ts b/tests/hooks/permission_decision.test.ts
index 5c4c9536a..863cf948f 100644
--- a/tests/hooks/permission_decision.test.ts
+++ b/tests/hooks/permission_decision.test.ts
@@ -309,6 +309,14 @@ describe('working-tree confinement', () => {
         expect(isInsideWorkingTree('../outside', ROOT)).toBe(false);
         expect(isInsideWorkingTree('/etc/passwd', ROOT)).toBe(false);
         expect(isInsideWorkingTree('src/../../outside', ROOT)).toBe(false);
+        expect(isInsideWorkingTree('..', ROOT)).toBe(false);
+    });
+
+    it('a name that merely starts with two dots is inside', () => {
+        // `go test ./...` resolves to `<root>/...`; a prefix test on `..`
+        // read that as an escape.
+        expect(isInsideWorkingTree('./...', ROOT)).toBe(true);
+        expect(isInsideWorkingTree('..cache/x', ROOT)).toBe(true);
     });
 
     it('an empty root confines nothing and therefore admits nothing', () => {
@@ -328,3 +336,124 @@ describe('the confinement root is the host cwd, not the dispatcher process cwd',
         expect(_working_tree_root({ payload: {}, workspace_root: '/repo' })).toBe('/repo');
     });
 });
+
+/*
+ * Phase 0 of road-to-a-hard-floor-the-shell-cannot-talk-past: category A stops
+ * granting what it cannot prove. Every D2 row below was executed through
+ * `_permission_for` on main@17f028941 and came back `allow`.
+ */
+describe('category A withdraws only what it cannot prove (Phase 0)', () => {
+    const bash = (command: string) => envelope('Bash', { command });
+    const allowOf = (command: string) => _permission_for('pre_tool_use', bash(command), 0, ['allow']);
+    const a = (command: string) => isCategoryA('Bash', { command }, ROOT);
+
+    it('branch-loses-a-ref: a branch form that can lose a ref is not category A', () => {
+        for (const cmd of [
+            'git branch -d topic',
+            'git branch -D main',
+            'git branch --delete topic',
+            'git branch -f main HEAD~20',
+            'git branch --force main HEAD~20',
+            'git branch -M main old',
+            'git branch -C main old',
+            'git branch -m main old',
+            'git branch --move main old',
+            'git branch -Dr origin/x',
+            'git -C sub branch -D main',
+        ]) {
+            expect(a(cmd), cmd).toBe(false);
+        }
+        for (const cmd of ['git branch', 'git branch -a', 'git branch --list', 'git branch new', 'git branch -v']) {
+            expect(a(cmd), cmd).toBe(true);
+        }
+    });
+
+    it('bash-path-confinement: a path argument outside the working tree is not category A', () => {
+        for (const cmd of [
+            'cat ~/.ssh/id_rsa',
+            "cat '~/.ssh/id_rsa'",
+            'cat "/etc/passwd"',
+            'cat /etc/passwd',
+            'find / -name x',
+            'ls ../../other',
+            'head --file=/etc/shadow',
+            'grep -rn foo /etc',
+        ]) {
+            expect(a(cmd), cmd).toBe(false);
+        }
+        for (const cmd of ['cat src/x.ts', 'cat /repo/src/x.ts', 'ls', 'grep -rn foo src', 'go test ./...', 'git log main..topic']) {
+            expect(a(cmd), cmd).toBe(true);
+        }
+    });
+
+    it('bash-path-confinement: a grep pattern is data, not a path', () => {
+        expect(a('grep -rn /api src')).toBe(true);
+        expect(a('rg -e /api src')).toBe(true);
+        expect(a('grep -rn /api /etc')).toBe(false);
+        expect(a('grep -f /etc/patterns src')).toBe(false);
+    });
+
+    it('output-flags-are-paths: an output-writing flag sends its target through confinement', () => {
+        for (const cmd of [
+            'sort -o /home/u/.bashrc /dev/null',
+            'sort -o/home/u/.bashrc src/a',
+            'sort -o../../x src/a',
+            'sort --output=/home/u/.bashrc src/a',
+            'git diff --output=/home/u/.bashrc',
+            'git diff --output /home/u/.bashrc',
+            'find . -fprint /tmp/x',
+            'tsc --outDir /tmp/out',
+            'tsc --outFile=/tmp/out.js',
+            'prettier --write /etc/hosts',
+            'eslint --fix /etc',
+        ]) {
+            expect(a(cmd), cmd).toBe(false);
+        }
+        for (const cmd of [
+            'sort -o out.txt src/a',
+            'git diff --output=diff.patch',
+            'tsc --outDir dist',
+            'prettier --write src',
+            'eslint --fix .',
+            'find . -fprint list.txt',
+        ]) {
+            expect(a(cmd), cmd).toBe(true);
+        }
+    });
+
+    it('output-flags-are-paths: without a root, an outside target is still refused', () => {
+        expect(isCategoryABashCommand('sort -o /home/u/.bashrc src/a')).toBe(false);
+        expect(isCategoryABashCommand('sort -o ../../x src/a')).toBe(false);
+        expect(isCategoryABashCommand('sort -o out.txt src/a')).toBe(true);
+    });
+
+    it('reason-names-what-was-checked: the working tree is named only when confinement ran', () => {
+        expect(allowOf('cat src/x.ts')?.reason).toContain('inside the working tree');
+        const bare = allowOf('pwd');
+        expect(bare?.decision).toBe('allow');
+        expect(bare?.reason).not.toContain('inside the working tree');
+        const todo = _permission_for('pre_tool_use', envelope('TodoRead', {}), 0, ['allow']);
+        expect(todo?.decision).toBe('allow');
+        expect(todo?.reason).not.toContain('inside the working tree');
+        const read = _permission_for('pre_tool_use', envelope('Read', { file_path: '/repo/a' }), 0, ['allow']);
+        expect(read?.reason).toContain('inside the working tree');
+    });
+
+    it('every D2 row is withheld through _permission_for, every true row still allowed', () => {
+        for (const cmd of [
+            'git branch -D main',
+            'git branch -f main HEAD~20',
+            'git branch -M main old',
+            'cat ~/.ssh/id_rsa',
+            'find / -name x',
+            'sort -o /home/u/.bashrc /dev/null',
+            'git diff --output=/home/u/.bashrc',
+            'prettier --write /etc/hosts',
+        ]) {
+            expect(allowOf(cmd), cmd).toBeNull();
+        }
+        for (const cmd of ['git branch', 'git branch -a', 'git branch new', 'cat src/x.ts', 'prettier --write src', 'eslint --fix .']) {
+            expect(allowOf(cmd)?.decision, cmd).toBe('allow');
+        }
+    });
+});
```
