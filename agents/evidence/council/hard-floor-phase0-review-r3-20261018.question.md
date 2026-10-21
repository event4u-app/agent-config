<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-18 (round 3) for branch drain/road-to-a-hard-floor-the-shell-cannot-talk-past-20261018, verbatim below this comment. -->

# Modification review, round 3 — category A stops granting what it cannot prove

You are one seat of a modification review. Review the change below.

Scope: the full diff of branch
`drain/road-to-a-hard-floor-the-shell-cannot-talk-past-20261018` at `27249a222`
against `origin/main` @ `1876e1860` (source, tests, contract), reproduced below.
`check_kernel_edit_ratified` classifies two files as gated (hook-plumbing sources
in the dispatcher's import closure): `src/scripts/hooks/category_a.ts` and
`src/scripts/hooks/permission_gate.ts`.

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
tree" for each. The change withdraws the allow from those shapes; such a call
then falls back to the host's own permission handling. It adds no deny and no
ask from this package. Withholding is the failure direction of every gap: a
shape the classifier does not understand loses the allow, it never gains one.

Two lines the diff context does not show, quoted from the unchanged file:
`export const SHELL_METACHARACTERS = /[;&|`$><\n\r(){}\\]/;` (checked before any
argv is built; a match is never category A), and
`function _argv(command) { return command.trim().split(/\s+/)... }`.

Rounds 1 and 2 (same day, same two seats). Round 1 at `01ff2e29a`: one seat
ratified; the other gave no final stance — branch-creating forms were admitted
and shell spellings were untested. Fixed at `0bb4500bc` (observational
`git branch` allowlist, `--` handling, dot-glob segments, flag values and
single-dash tails confined). Round 2 at `0bb4500bc`: one seat ratified; the
other refused with a dealbreaker on two concrete false-allow paths: a dash-led
separate option value (`sort -o --/../../outside src/a`,
`git diff --output --/../../outside`), and an in-tree symlink that points
outside (`cat link-to-outside-secret`). It also asked that the contract stop
claiming "every path argument". Since then (`27249a222`): any dash-led token
containing `/` is a path candidate; confinement resolves symlinks of the longest
existing prefix in both the read-tool and the Bash branch (the one filesystem
read, which can only withhold); `grep -- -x /etc/passwd` is covered; the
contract now names the shapes confined and says the classifier is neither a
shell-equivalent parser nor a per-program option grammar. Each of these has a
row shown red with its mechanism removed (ten mechanisms, each probed).

What this change does not do, stated so it is judged rather than discovered:
it does not add per-program option metadata, and it does not offer a setting
that disables category A. Withdrawing category A for Bash entirely was the
alternative named in round 2; it would put the host's confirmation back on every
read, build and test command.

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
index 44acee98b..df522e3f0 100644
--- a/docs/contracts/hook-architecture-v1.md
+++ b/docs/contracts/hook-architecture-v1.md
@@ -775,6 +775,25 @@ for a **category-A** call: a read, a navigation, a build, a test or a lint insid
 the working tree with no consequence operation attached
 (`src/scripts/hooks/category_a.ts`).
 
+**Corrected 2026-10-18** (`road-to-a-hard-floor-the-shell-cannot-talk-past` Phase 0):
+"inside the working tree" was enforced on the read tools only. The Bash branch now
+confines the argument shapes it can see — positionals, `--flag=value` values, the
+tail of a single-dash token (`sort -o/path`), any dash-led token containing `/`
+(which may be the previous option's value, `sort -o --/../x`) and everything after
+`--` — to the working tree,
+refuses a path segment the shell could glob to `..` (`.*`, `.?`, a bracket
+expression), admits `git branch` only in its observational forms (listing, `-a`,
+`-r`, `-v`, `--show-current`, `--merged`/`--contains` filters), and the allow's
+reason names the working tree only when a path was actually confined for that
+call. Withholding an allow returns the host's own confirmation; it never adds a
+question from this package. The classifier splits on whitespace after refusing
+every shell metacharacter, including `\`; it is a guardrail against the shapes it
+names, not a shell-equivalent parser and not a per-program option grammar.
+Confinement now follows symlinks in both branches: an in-tree symlink that resolves
+outside the tree (or a path under one) is outside. That is the only filesystem read
+the classifier makes, and it can only withhold an allow; a path that does not exist
+keeps its lexical answer.
+
 The composition policy is **one `ask` or `deny` beats every `allow`**
 (`composePermissionDecision`), and the emission additionally requires the reduced
 severity to already be `allow`, so an allow can never travel with a finding. This
diff --git a/src/scripts/hooks/category_a.ts b/src/scripts/hooks/category_a.ts
index 3a4d210ed..102ef4708 100644
--- a/src/scripts/hooks/category_a.ts
+++ b/src/scripts/hooks/category_a.ts
@@ -23,6 +23,7 @@
  * grant — the host's own strings record `permissionDecision=allow ignored: a
  * confined session takes grants only from its command line`.
  */
+import * as fs from "node:fs";
 import * as path from "node:path";
 
 /** A JSON-ish tool input as it arrives in the dispatcher envelope. */
@@ -145,7 +146,31 @@ export function isInsideWorkingTree(candidate: string, root: string): boolean {
     const abs = path.resolve(root, candidate);
     const rel = path.relative(path.resolve(root), abs);
     if (rel === "") return true;
-    return !rel.startsWith("..") && !path.isAbsolute(rel);
+    // `..` as a whole first segment escapes; `...` or `..cache` is a name.
+    const escapes = rel === ".." || rel.startsWith(`..${path.sep}`);
+    return !escapes && !path.isAbsolute(rel);
+}
+
+/** `p` with every symlink in its longest existing prefix resolved. */
+function _real(p: string): string {
+    try {
+        return fs.realpathSync(p);
+    } catch {
+        const parent = path.dirname(p);
+        return parent === p ? p : path.join(_real(parent), path.basename(p));
+    }
+}
+
+/**
+ * {@link isInsideWorkingTree}, and still inside once symlinks are followed.
+ *
+ * The one place the classifier reads the filesystem, and it can only withhold:
+ * an in-tree symlink to `~/.ssh` is lexically inside and really outside. A
+ * path that does not exist keeps its lexical answer.
+ */
+function _reallyInside(candidate: string, root: string): boolean {
+    if (!isInsideWorkingTree(candidate, root)) return false;
+    return isInsideWorkingTree(_real(path.resolve(root, candidate)), _real(path.resolve(root)));
 }
 
 /** Split a command on whitespace; the caller has already refused metacharacters. */
@@ -182,7 +207,7 @@ const GIT_VALUE_FLAGS: ReadonlySet<string> = new Set([
 ]);
 
 /**
- * The `git` subcommand, with global options skipped.
+ * The `git` subcommand and its argv index, with global options skipped.
  *
  * Returns `""` when a global option's VALUE escapes the working tree — an
  * absolute path or a `..` traversal. The check is textual rather than resolved
@@ -190,21 +215,127 @@ const GIT_VALUE_FLAGS: ReadonlySet<string> = new Set([
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
+ * `git branch` is category A only in its observational forms — an allowlist,
+ * like the rest of this file. Every other form writes a ref: `-d`/`-D` and
+ * `-f`/`-m`/`-M`/`-C` can lose one, and a bare `git branch <name>`, `-c`,
+ * `-u` or `--edit-description` create or rewrite one. A positional operand is
+ * admitted only under `-l`/`--list`, where it is a pattern, or as the value of
+ * a filter flag.
+ */
+const GIT_BRANCH_OBSERVES =
+    /^(-[arlvi]+|--(all|remotes|list|verbose|show-current|ignore-case|(no-)?colou?r|(no-)?column|omit-empty)(=.*)?)$/;
+const GIT_BRANCH_FILTER = /^--((no-)?(contains|merged)|points-at|sort|format|abbrev)(=|$)/;
+
+function _gitBranchOnlyObserves(argv: readonly string[], index: number): boolean {
+    const rest = argv.slice(index + 1);
+    const listing = rest.some((t) => /^(-[arvi]*l[arlvi]*|--list)$/.test(t));
+    for (let i = 0; i < rest.length; i++) {
+        const token = rest[i] as string;
+        if (!_isFlag(token)) {
+            if (!listing) return false;
+        } else if (GIT_BRANCH_FILTER.test(token)) {
+            if (!token.includes("=") && !_isFlag(rest[i + 1] ?? "-")) i++;
+        } else if (!GIT_BRANCH_OBSERVES.test(token)) {
+            return false;
+        }
+    }
+    return true;
 }
 
+/**
+ * Heads that never open their arguments, so a path-shaped argument is a string
+ * and confining it would only put a prompt on `echo /tmp`.
+ */
+const NON_OPENING_HEADS = /^(pwd|echo|basename|dirname|date|which)$/;
+
+/**
+ * Output-writing flags (0.3). Their target is a path like any other, and the
+ * walk below confines every spelling: a separate value token (`--output x`,
+ * `-fprint x`, `--outDir x`) is a positional, `--output=x` is an inline value,
+ * a glued short value (`sort -o/path`) is the tail of a single-dash token, and
+ * the value-less writers (`--write`/`-w`, `--fix`) write their positionals. So
+ * no per-head table is needed; one was measured inert and removed.
+ *
+ * For `grep`/`rg` the first positional, or an `-e`/`--regexp` value, is a
+ * pattern and therefore data; an `-f`/`--file` value is a path.
+ */
+const PATTERN_GIVEN = /^(-e|--regexp|-f|--file)(=|$)/;
+
+/**
+ * A path segment the shell may expand to `..`: `.*`, `.?`, or any bracket
+ * expression. Refused rather than modelled — the classifier never globs.
+ */
+const DOT_GLOB_SEGMENT = /^\.[^/]*[*?]|\[/;
+
+/**
+ * Every argument of a Bash command that may name a filesystem location.
+ *
+ * Positionals, flag inline values and the tail of a single-dash token
+ * (`-o/path`, `-f/path`) are all candidates: one that stays inside is harmless
+ * to check, and missing one is not. After `--` every token is a positional.
+ * Shell quote removal is applied; every other expansion is refused upstream by
+ * the metacharacter rule.
+ */
+function _pathArguments(argv: readonly string[], head: string): string[] {
+    const out: string[] = [];
+    const grep = head === "grep" || head === "rg";
+    let patternPending = grep && !argv.some((t) => PATTERN_GIVEN.test(t));
+    let endOfOptions = false;
+    for (let i = 1; i < argv.length; i++) {
+        const token = (argv[i] as string).replace(/["']/g, "");
+        if (!endOfOptions && token === "--") {
+            endOfOptions = true;
+        } else if (endOfOptions || !_isFlag(token)) {
+            if (patternPending) patternPending = false;
+            else out.push(token);
+        } else if (grep && /^(-e|--regexp)$/.test(token)) {
+            i++;
+        } else if (grep && /^(-f|--file)$/.test(token)) {
+            out.push((argv[++i] ?? "").replace(/["']/g, ""));
+        } else {
+            // A dash-led token may itself be the value of the option before it
+            // (`sort -o --/../x`), so one that contains `/` is a path too.
+            if (token.includes("/")) out.push(token);
+            const eq = token.indexOf("=");
+            if (eq >= 0) out.push(token.slice(eq + 1));
+            else if (!token.startsWith("--") && token.length > 2) out.push(token.slice(2));
+        }
+    }
+    return out;
+}
+
+/** Stands in for the tree when the caller has none: absolute and `..` still escape it. */
+const UNROOTED = path.resolve("/agent-config-unrooted");
+
+function _confined(candidate: string, workingTree: string): boolean {
+    if (candidate.startsWith("~") || candidate.split("/").some((seg) => DOT_GLOB_SEGMENT.test(seg))) return false;
+    return _reallyInside(candidate, workingTree.trim() ? workingTree : UNROOTED);
+}
+
+/** What the classifier decided, and whether a path confinement actually ran. */
+export interface CategoryAVerdict {
+    categoryA: boolean;
+    confined: boolean;
+}
+
+const NOT_A: CategoryAVerdict = { categoryA: false, confined: false };
+
 /** Non-flag token after the subcommand, or `""`. */
 function _secondSubcommand(argv: readonly string[]): string {
     const nonFlags = argv.slice(1).filter((t) => !_isFlag(t));
@@ -231,20 +362,14 @@ export function namesConsequenceOperation(command: string): boolean {
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
+        return sub !== "branch" || _gitBranchOnlyObserves(argv, index);
     }
 
     const allowed = RUNNER_SUBCOMMANDS[head];
@@ -258,6 +383,36 @@ export function isCategoryABashCommand(command: string): boolean {
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
+    if (NON_OPENING_HEADS.test(head)) return { categoryA: true, confined: false };
+    const candidates = _pathArguments(argv, head);
+    for (const candidate of candidates) {
+        if (!_confined(candidate, workingTree)) return NOT_A;
+    }
+    return { categoryA: true, confined: candidates.length > 0 };
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
@@ -265,27 +420,34 @@ export function isCategoryABashCommand(command: string): boolean {
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
+            if (!_reallyInside(value, workingTree)) return NOT_A;
+            checked = true;
         }
-        return true;
+        return { categoryA: true, confined: checked };
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
index ea1968614..60f1a1d7a 100644
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
+  const where = verdict.confined ? " inside the working tree" : ", no path argument to confine";
   return {
     decision: "allow",
-    reason:
-      `agent-config: category-A ${tool_name} inside the working tree — ` +
-      `no concern gates it and none asked to.`,
+    reason: `agent-config: category-A ${tool_name}${where} — no concern gates it and none asked to.`,
   };
 }
diff --git a/tests/hooks/permission_decision.test.ts b/tests/hooks/permission_decision.test.ts
index 5c4c9536a..714fca13b 100644
--- a/tests/hooks/permission_decision.test.ts
+++ b/tests/hooks/permission_decision.test.ts
@@ -14,6 +14,10 @@
  * is the test that goes red the moment an `allow` is allowed to outrank a
  * `deny`.
  */
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+
 import { describe, expect, it } from 'vitest';
 
 import {
@@ -309,6 +313,14 @@ describe('working-tree confinement', () => {
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
@@ -328,3 +340,204 @@ describe('the confinement root is the host cwd, not the dispatcher process cwd',
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
+    });
+
+    it('branch-loses-a-ref: only observational branch forms stay category A', () => {
+        // Council review 2026-10-18: a form that writes a ref without losing
+        // one is still not a read, so the allowlist admits observation only.
+        for (const cmd of [
+            'git branch new',
+            'git branch new HEAD~3',
+            'git branch -c main copy',
+            'git branch --copy main copy',
+            'git branch -u origin/main',
+            'git branch --set-upstream-to=origin/main',
+            'git branch --unset-upstream',
+            'git branch --edit-description',
+            'git branch -t topic origin/x',
+        ]) {
+            expect(a(cmd), cmd).toBe(false);
+        }
+        for (const cmd of [
+            'git branch',
+            'git branch -a',
+            'git branch -av',
+            'git branch -vv',
+            'git branch --list',
+            "git branch --list 'feat*'",
+            'git branch -l feat',
+            'git branch --show-current',
+            'git branch --merged main',
+            'git branch --contains HEAD~3',
+            'git branch --sort=-committerdate',
+        ]) {
+            expect(a(cmd), cmd).toBe(true);
+        }
+    });
+
+    it('bash-path-confinement: shell spellings that reach outside are refused', () => {
+        for (const cmd of [
+            'cat .*/etc/passwd',
+            'cat src/.?/x',
+            'ls [.][.]/other',
+            'cat -- -/../../etc/passwd',
+            'cat -- --/../../etc/passwd',
+            'sort -o --/../../outside src/a',
+            'git diff --output --/../../outside',
+            'sort -o -x/../../../outside src/a',
+            'cat ""/etc/passwd',
+            'cat "."/../x',
+            'grep -f/etc/patterns src',
+            'grep -- -x /etc/passwd',
+            'cat ..\\/outside',
+            'cat ~root/.profile',
+        ]) {
+            expect(a(cmd), cmd).toBe(false);
+        }
+        expect(a('cat -- src/a.ts')).toBe(true);
+        expect(a('ls .github')).toBe(true);
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
+        for (const cmd of ['git branch', 'git branch -a', 'cat src/x.ts', 'prettier --write src', 'eslint --fix .']) {
+            expect(allowOf(cmd)?.decision, cmd).toBe('allow');
+        }
+    });
+
+    it('bash-path-confinement: an in-tree symlink that points outside is outside', () => {
+        // Council review 2026-10-18, round 2: lexical confinement admitted
+        // `cat link` where `link` resolves to a file outside the tree.
+        const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cat-a-'));
+        try {
+            const tree = path.join(base, 'tree');
+            const outside = path.join(base, 'outside');
+            fs.mkdirSync(path.join(tree, 'src'), { recursive: true });
+            fs.mkdirSync(outside);
+            fs.writeFileSync(path.join(outside, 'secret'), 'x');
+            fs.writeFileSync(path.join(tree, 'src', 'a.ts'), 'x');
+            fs.symlinkSync(path.join(outside, 'secret'), path.join(tree, 'link'));
+            fs.symlinkSync(outside, path.join(tree, 'linkdir'));
+            fs.symlinkSync(path.join(tree, 'src'), path.join(tree, 'inner'));
+            for (const cmd of ['cat link', 'cat linkdir/secret', 'sort -o linkdir/new src/a.ts']) {
+                expect(isCategoryA('Bash', { command: cmd }, tree), cmd).toBe(false);
+            }
+            expect(isCategoryA('Read', { file_path: path.join(tree, 'link') }, tree)).toBe(false);
+            for (const cmd of ['cat src/a.ts', 'cat inner/a.ts', 'sort -o src/new.txt src/a.ts']) {
+                expect(isCategoryA('Bash', { command: cmd }, tree), cmd).toBe(true);
+            }
+            expect(isCategoryA('Read', { file_path: path.join(tree, 'inner', 'a.ts') }, tree)).toBe(true);
+        } finally {
+            fs.rmSync(base, { recursive: true, force: true });
+        }
+    });
+});
```
