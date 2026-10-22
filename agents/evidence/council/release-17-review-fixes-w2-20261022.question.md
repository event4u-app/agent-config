<!-- evidence-type: analysis -->

# Ratification review — 17.0.0 self-review fixes, wave 2: the gated subset

You are reviewing one change for the ratification gate of ADR-268 § 4: an agent
may modify its constitution and may not ratify its own increase in power.

Branch `fix/release-17-review-fixes-w2` carries about 160 commits fixing
findings of the 17.0.0 self-review. The gate `check_kernel_edit_ratified`
classifies six of its changed files as gated; the record's `subject` digest is
taken over exactly these six, so this review covers exactly these six:

| File | Why it is gated |
|---|---|
| `src/scripts/hooks/block_credential_reads.ts` | governance hook (`block_*`, `fail_closed`) |
| `src/scripts/hooks/dispatch_hook.ts` | hook-plumbing source (the dispatcher) |
| `src/scripts/hooks/egress_stage.ts` | hook-plumbing source (dispatcher import closure) |
| `src/scripts/_lib/egress_rules.ts` | hook-plumbing source (dispatcher import closure) |
| `src/scripts/_lib/ratification_subject.ts` | the ratification mechanism itself (computes the record digest) |
| `src/scripts/check_platform_anchor.ts` | the ratification mechanism itself (anchor path) |

## The changes, by commit

1. `60f8c423d` — **dispatcher / egress stage.** In egress `protect` / `strict`
   mode with the egress engine unavailable, a concern's message was replaced
   by the marker `[egress: injected text withheld (engine-unavailable)]`. For a
   BLOCKING concern the user then saw a deny with no rule name. New
   `attributeRefusal(concernName, refused, text)` prefixes
   `<concern name>: BLOCKED — reason ` to the withheld marker, only when the
   concern's exit code is `EXIT_BLOCK` and the text starts with the withheld
   marker. The withheld reason text stays withheld. `concernName` is
   `concern["name"]` from the dispatcher's concern definition.
2. `9bcc1e40d` — **egress rules (council-bundle redaction table
   `REVIEW_CREDENTIAL_ROWS`).** The assignment row's validator rejected any
   value matching `CODE_EXPR`, including a QUOTED value, so
   `password = 'p@ss,word$1'` was not masked in the bundle sent to the
   council. The validator now receives the capture group; `CODE_EXPR` is
   applied only to group 5 (the bare value). `TYPE_WORD` still applies to all
   groups. A doc comment states a remaining gap of the main `EGRESS_RULES`
   table (opaque `Authorization: Bearer` values, `token`/`bearer`/
   `clientSecret`/`privateKey` keywords).
3. `64b454680` — **block_credential_reads, docblock only.** The residue list
   now names directory-wide search and globs (`Grep path=.`, `grep -r KEY .`,
   `rg KEY`, `cat .e*`), which were probed to pass the guard. No code change.
4. `199737301` — **ratification_subject.** `refExists` returns false for an
   empty or `-`-led ref before calling git, the guard `resolveRevision`
   already had.
5. `0a0bd126d` — **check_platform_anchor.** A `--base-ref` starting with `-`
   is refused with exit 1 before any git call. Before, `--base-ref
   --output=<path>` reached `git diff` as an option and wrote a file.

## Local evidence

- `vitest run` over `egress_rules_value_group.test.ts`,
  `egress_rules_parity.test.ts`, `tests/scripts/hooks/egress_injection.test.ts`,
  `tests/scripts/hooks/dispatch_hook.test.ts`,
  `tests/scripts/hooks/block_credential_reads.test.ts`,
  `tests/scripts/ratification_subject.test.ts`: 6 files, 827 tests, all pass.
- Entry point: `check_platform_anchor --base-ref --output=<path>` prints
  `--base-ref … is not a ref`, exits 1, and writes no file.

## The diff (gated files and the tests added with them)

```diff
diff --git a/src/scripts/_lib/egress_rules.ts b/src/scripts/_lib/egress_rules.ts
index 4f9f9de01..53b79227b 100644
--- a/src/scripts/_lib/egress_rules.ts
+++ b/src/scripts/_lib/egress_rules.ts
@@ -31,7 +31,8 @@ export interface EgressRule {
      * a shape whose delimiter decides its extent stays one row.
      */
     readonly valueGroup?: number | readonly number[];
-    readonly validator?: (value: string) => boolean;
+    /** `group` is the capture group the value came from, so a delimiter can change the test. */
+    readonly validator?: (value: string, group: number | 'whole-match') => boolean;
     /** The rule fires only when `words` matches within `window` chars of the value. */
     readonly context?: { readonly words: RegExp; readonly window: number };
     readonly exclusions?: readonly RegExp[];
@@ -395,6 +396,12 @@ const QUOTED_OR_BARE_VALUE = `(?:"([^"\\n]*)"|'([^'\\n]*)'|["']([^\\n]+)|([^\\s'
  * keyword that is not a code expression or a type word, on the same line, and
  * every byte after the colon of a line that opens with an `Authorization`
  * header.
+ *
+ * The header row being HERE and not in EGRESS_RULES is a stated gap of the
+ * main table: an `Authorization: Bearer <opaque token>` with no vendor prefix
+ * and no JWT shape passes the replacing and refusing surfaces unchanged, and
+ * so does any value under the `token`, `bearer`, `clientSecret` or
+ * `privateKey` keywords, which no EGRESS_RULES row reads.
  */
 export const REVIEW_CREDENTIAL_ROWS: readonly EgressRule[] = [
     {
@@ -413,7 +420,10 @@ export const REVIEW_CREDENTIAL_ROWS: readonly EgressRule[] = [
             'dgi',
         ),
         valueGroup: [2, 3, 4, 5],
-        validator: (v) => !CODE_EXPR.test(v) && !TYPE_WORD.test(v),
+        // Group 5 is the bare value. A quoted one is a literal, where `,` `$`
+        // or `.` is password punctuation rather than code, so only a bare value
+        // is read as a code expression.
+        validator: (v, g) => (g !== 5 || !CODE_EXPR.test(v)) && !TYPE_WORD.test(v),
     },
     {
         rule: 'review-authorization-header',
@@ -582,7 +592,7 @@ export function evaluateMatch(
         if (!r.context.words.test(around)) return null;
     }
     if (r.validator) {
-        return r.validator(value) ? { start, end, validated: true } : null;
+        return r.validator(value, group) ? { start, end, validated: true } : null;
     }
     return { start, end, validated: false };
 }
diff --git a/src/scripts/_lib/egress_rules_value_group.test.ts b/src/scripts/_lib/egress_rules_value_group.test.ts
index 070b18e5d..ade94d0ec 100644
--- a/src/scripts/_lib/egress_rules_value_group.test.ts
+++ b/src/scripts/_lib/egress_rules_value_group.test.ts
@@ -17,7 +17,7 @@
  */
 import { describe, expect, it } from 'vitest';
 
-import { evaluateMatch, type EgressRule } from './egress_rules.js';
+import { evaluateMatch, findSpans, REVIEW_CREDENTIAL_ROWS, type EgressRule } from './egress_rules.js';
 
 /** A row with two alternative value groups behind a keyword. */
 function rule(valueGroup: number | readonly number[]): EgressRule {
@@ -76,3 +76,18 @@ describe('valueGroupOf — alternative groups', () => {
         expect(text.slice(hit!.start, hit!.end)).toBe('abc123');
     });
 });
+
+describe('review-assignment — a quoted literal is not a code expression', () => {
+    const values = (text: string): string[] =>
+        findSpans(text, REVIEW_CREDENTIAL_ROWS).map((s) => text.slice(s.start, s.end));
+
+    it('masks a quoted value carrying password punctuation', () => {
+        expect(values('password = "p@ss,word$1"')).toEqual(['p@ss,word$1']);
+        expect(values("secret: 'ab.cd1234'")).toEqual(['ab.cd1234']);
+    });
+
+    it('still reads a bare code expression as code', () => {
+        expect(values('secret: opts.secret')).toEqual([]);
+        expect(values('token = load(x)')).toEqual([]);
+    });
+});
diff --git a/src/scripts/_lib/ratification_subject.ts b/src/scripts/_lib/ratification_subject.ts
index 176f6532c..82f5f6cac 100644
--- a/src/scripts/_lib/ratification_subject.ts
+++ b/src/scripts/_lib/ratification_subject.ts
@@ -285,6 +285,8 @@ export function resolveRevision(root: string, revision: string): string {
  * repository the diff and the digest read.
  */
 export function refExists(root: string, ref: string): boolean {
+    // Same guard as resolveRevision: a `-`-led ref would be read as an option.
+    if (ref === '' || ref.startsWith('-')) return false;
     return runGit(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], '').status === 0;
 }
 
diff --git a/src/scripts/check_platform_anchor.ts b/src/scripts/check_platform_anchor.ts
index 5150ccd1d..c7716bc25 100644
--- a/src/scripts/check_platform_anchor.ts
+++ b/src/scripts/check_platform_anchor.ts
@@ -562,6 +562,12 @@ export function main(argv: readonly string[] = process.argv.slice(2), source = l
             files.push(a);
         }
     }
+    // The ref reaches `git diff` and `git ls-tree` as a positional argument, so
+    // one starting with `-` would be read as an option.
+    if (baseRef !== null && baseRef.startsWith('-')) {
+        process.stderr.write(`check_platform_anchor: --base-ref ${printable(baseRef)} is not a ref\n`);
+        return 1;
+    }
 
     let changed: string[];
     if (filesFlagSeen) {
diff --git a/src/scripts/hooks/block_credential_reads.ts b/src/scripts/hooks/block_credential_reads.ts
index ed90a26b3..1275e1218 100644
--- a/src/scripts/hooks/block_credential_reads.ts
+++ b/src/scripts/hooks/block_credential_reads.ts
@@ -31,7 +31,10 @@
  * guard is never the reason an unrelated call fails. Not caught, and recorded
  * as the residue `tests/fixtures/egress-prevention-gaps/` names: a program that
  * reads the file itself (`node -e "…readFileSync('.env')"`), a value printed by
- * a running process, a secret typed by the user.
+ * a running process, a secret typed by the user — and a search or glob that
+ * never names the file (`Grep path=.`, `grep -r KEY .`, `rg KEY`, `cat .e*`).
+ * The last returns the file's lines as tool output, which is the
+ * `program-output` fixture's channel: the stage sees it, this guard does not.
  *
  * Kill switch: `AGENT_CONFIG_ALLOW_CREDENTIAL_READS=1`.
  *
diff --git a/src/scripts/hooks/dispatch_hook.ts b/src/scripts/hooks/dispatch_hook.ts
index d75034439..76167309f 100644
--- a/src/scripts/hooks/dispatch_hook.ts
+++ b/src/scripts/hooks/dispatch_hook.ts
@@ -56,7 +56,7 @@ import { emitFor, type PermissionDecision, type Severity } from "./host_semantic
 import { _concern_permission_verdict, _payload_tool_name, _permission_for } from "./permission_gate.js";
 export { _concern_permission_verdict, _payload_tool_input, _payload_tool_name, _permission_for, _working_tree_root } from "./permission_gate.js";
 import { _concern_body_classes, planPayloadShapes } from "./payload_stub.js";
-import { egressInjection, egressViewFor, runEgressStage } from "./egress_stage.js";
+import { attributeRefusal, egressInjection, egressViewFor, runEgressStage } from "./egress_stage.js";
 import { resolveSessionRole, type SessionRole } from "../_lib/session_role.js";
 import { stdinReadFailure, denyOnStdinFailure } from './stdin_failure_policy.js';
 export { stdinReadFailure, denyOnStdinFailure, _is_fail_closed_blocking } from './stdin_failure_policy.js';
@@ -1366,7 +1366,7 @@ export function main(argv?: string[]): number {
         : "";
     const message = [stated, extra].filter(Boolean).join("\n\n");
     if (message) {
-      concern_messages.push({ rc, text: injected(message), def: concern });
+      concern_messages.push({ rc, text: attributeRefusal(String(concern["name"]), rc === EXIT_BLOCK, injected(message)), def: concern });
     }
     if (
       args.event === "session_start" &&
diff --git a/src/scripts/hooks/egress_stage.ts b/src/scripts/hooks/egress_stage.ts
index d56d7dfed..22df347f8 100644
--- a/src/scripts/hooks/egress_stage.ts
+++ b/src/scripts/hooks/egress_stage.ts
@@ -403,11 +403,22 @@ function injector(
   }
   if (mode !== "protect" && mode !== "strict") return (t) => t;
   const load = loadEngine();
-  if (!load.ok) return () => `[egress: injected text withheld (${ENGINE_UNAVAILABLE})]`;
+  if (!load.ok) return () => `${WITHHELD_PREFIX}${ENGINE_UNAVAILABLE})]`;
   const scope = new load.engine.TokenScope();
   return (t) => load.engine.injectText(t, scope);
 }
 
+const WITHHELD_PREFIX = "[egress: injected text withheld (";
+
+/**
+ * A refusal's reason may be withheld, never the fact of who refused. Without
+ * the concern name a withheld block reads as an unexplained deny, and the user
+ * cannot tell which guard to look up.
+ */
+export function attributeRefusal(concernName: string, refused: boolean, text: string): string {
+  return refused && text.startsWith(WITHHELD_PREFIX) ? `${concernName}: BLOCKED — reason ${text}` : text;
+}
+
 export type PublishedState = "asserted" | "replaced" | "gated" | "uncovered";
 
 /**
diff --git a/tests/scripts/hooks/egress_injection.test.ts b/tests/scripts/hooks/egress_injection.test.ts
index 27037bda8..31da261b8 100644
--- a/tests/scripts/hooks/egress_injection.test.ts
+++ b/tests/scripts/hooks/egress_injection.test.ts
@@ -13,7 +13,7 @@ import { fileURLToPath } from 'node:url';
 import { afterEach, beforeEach, describe, expect, it } from 'vitest';
 
 import { parseTokens } from '../../../src/scripts/_lib/egress_token.js';
-import { egressInjection, type EgressMode } from '../../../src/scripts/hooks/egress_stage.js';
+import { attributeRefusal, egressInjection, type EgressMode } from '../../../src/scripts/hooks/egress_stage.js';
 
 const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
 const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'dispatch_hook.ts');
@@ -64,6 +64,21 @@ describe('egressInjection', () => {
     });
 });
 
+describe('attributeRefusal', () => {
+    const missing = egressInjection('/ws', mode('protect'), () => ({ ok: false, reason: 'missing' }));
+
+    it('a withheld refusal still names the concern that refused', () => {
+        const out = attributeRefusal('block-no-verify', true, missing('block-no-verify: BLOCKED — use the hook'));
+        expect(out.startsWith('block-no-verify: BLOCKED')).toBe(true);
+        expect(out.endsWith('[egress: injected text withheld (engine-unavailable)]')).toBe(true);
+    });
+
+    it('leaves advisory text and unwithheld refusals unchanged', () => {
+        expect(attributeRefusal('nudge', false, missing(ENTRY))).toBe(missing(ENTRY));
+        expect(attributeRefusal('guard', true, 'guard: BLOCKED — reason')).toBe('guard: BLOCKED — reason');
+    });
+});
+
 describe('the dispatcher injects through the engine', () => {
     let tmp: string;
     beforeEach(() => {
diff --git a/tests/scripts/ratification_subject.test.ts b/tests/scripts/ratification_subject.test.ts
index 5e23ee55b..f9e8f8abb 100644
--- a/tests/scripts/ratification_subject.test.ts
+++ b/tests/scripts/ratification_subject.test.ts
@@ -81,6 +81,16 @@ const UNGATED = 'docs/contracts/ratification-artifact.md';
  */
 const DERIVED_ONLY = 'src/scripts/hooks/host_semantics.ts';
 
+describe('refExists takes no option-shaped ref', () => {
+    it('answers false for an empty or `-`-led ref without asking git', () => {
+        const root = tmpTree({ 'a.txt': 'a' });
+        expect(lib.refExists(root, 'HEAD')).toBe(true);
+        expect(lib.refExists(root, '')).toBe(false);
+        expect(lib.refExists(root, '--all')).toBe(false);
+        expect(lib.refExists(root, '-q')).toBe(false);
+    });
+});
+
 describe('2.1 — the gated set, assembled from the gate’s own constants', () => {
     it('keeps a kernel rule and drops an ungated file', () => {
         const g = gatedFilesOf([KERNEL, UNGATED, 'README.md']);
```

## The question

Does this change expand the authority of an agent — let an agent do anything
it could not do before — or narrow what a guard, the egress redaction or the
ratification gate refuses in a way that opens a hook or gate bypass?

Answer with exactly one verdict and your reason:

- `ratified` — it expands authority, and the expansion is acceptable.
- `confirmed-non-expanding` — it touches the gated surface and expands no authority.
- `refused` — it should not land as it stands; name the case and the file.
- `non-convergent` — you cannot decide from what is shown; say what is missing.

Name any input you believe now passes a guard, the redaction or the gate that
did not pass before.
