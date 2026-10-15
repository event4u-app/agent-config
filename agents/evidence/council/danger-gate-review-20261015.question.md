<!-- evidence-type: analysis -->

<!-- The round-1 prompt given to the council on 2026-10-15 for the danger-gate change, committed
     verbatim so the verdict recorded beside it can be checked against what was
     actually asked. Not edited after the run. -->

# Review the danger-gate change — governance triggers, a needs-owner verdict, the base-revision run

Review this change. Scope: the diff below against origin/main — `src/scripts/classify_merge_risk.ts` (seven new triggers, a third verdict `needs-owner` with exit 2, frontmatter and consequence-class reads from both revisions), its three test files and a command-text test, and the danger-gate section of `src/domains/git/pr/merge/command.md` plus two passages of the process-full command, which now run the base revision's classifier against the head. Omitted for size: the regenerated projections under `dist/agent-src/` (byte copies of the two command files), two `pack.yaml` token counts, and the roadmap edits (checkbox flips, inline corrections, two dated notes in neighbouring roadmaps).

This classifier decides whether a pull request merges with no review, goes to a council, or goes to the owner. Report defects: paths that should reach the council or the owner but classify `routine` (fail-open), triggers that fire far wider than their stated rule, ways a pull request can influence the code or data that classes it, shell steps in the command that fail open or leave state behind, tests that would pass without the code they cover, and claims in comments or the command that the code does not honour. For each: file:line, the failure scenario, severity. State your stance.

~~~diff
diff --git a/src/domains/git/pr/merge/command.md b/src/domains/git/pr/merge/command.md
index 851ac502f..c193bd487 100644
--- a/src/domains/git/pr/merge/command.md
+++ b/src/domains/git/pr/merge/command.md
@@ -38,6 +38,7 @@ HARD-FLOOR ACTION. `--no-merge` STILL STOPS BEFORE § 9.
 ADR-282: AN OWNER AUTO-MERGE INSTRUCTION (`--merge`, OR THE OWNER'S OWN WORDS IN
 THE SESSION) IS THE SAME CONFIRMATION FOR A `routine` PR. A `needs-council` PR
 MERGES ONLY ON TWO CONVERGENT CLEARING SEATS (§ 9a) — OTHERWISE THE OWNER DECIDES.
+A `needs-owner` PR IS NEVER SENT FOR CLEARANCE AND NEVER MERGES ON THIS COMMAND.
 ```
 
 **The invocation is the authorization, and nothing else is.** `pr-merge` is
@@ -474,16 +475,46 @@ HUMAN DECISION. STOP, EMIT THE MERGE SHAs AND THE REASON, HAND OVER.
 
 ## 9a. Danger gate — before every merge (ADR-282)
 
-Once required checks are green on the manifest head and the PR is mergeable:
+Once required checks are green on the manifest head and the PR is mergeable,
+classify it with the **base revision's** classifier, never the head's:
 
 ```bash
-./scripts-run src/scripts/classify_merge_risk <N>
+BASE_DIR="$(mktemp -d)/classifier-base"
+if git cat-file -e "<manifest-base_sha>:src/scripts/classify_merge_risk.ts" \
+   && git worktree add -q --detach "$BASE_DIR" "<manifest-base_sha>"; then
+  node_modules/.bin/tsx "$BASE_DIR/src/scripts/classify_merge_risk.ts" \
+    --range "<manifest-base_sha>...<manifest-head-sha>" --root "$PWD"
+  git worktree remove --force "$BASE_DIR"
+else
+  echo "verdict: needs-owner (base-unavailable: no classifier or no worktree at <manifest-base_sha>)"
+fi
 ```
 
+**Why the base.** § 2 checked the PR out, so the tree's own copy of the
+classifier — and of `check_kernel_edit_ratified`, whose `classifyPaths` it
+reads — is the head's: a PR could rewrite the code that classes it and call
+itself `routine`. The ratification gate's workflow step records the same defect
+and runs the base copy for the same reason. The base copy is run directly with
+the head's `tsx`, not through `./scripts-run`, whose dispatcher is the head's
+code too; the consequence-class list and each ADR's `reopen_policy` are read
+from both revisions by the base copy itself. A base without the classifier, a
+worktree that cannot be made, or a last line that is not a verdict is
+**`needs-owner`** and says why — never a skipped gate and never a fall-back to
+the head's copy.
+
 The last line is the verdict; each trigger names the rule it comes from. An
 unreadable diff is `needs-council` — the gate fails closed.
 
 - **`routine`** → merge in § 9. No review step.
+- **`needs-owner`** → the gated surface or the reviewer's trust chain (the
+  classifier and its imports, the commands that call it, ADR-282, the council,
+  the ratification contract, the subject binding, the predicate record), or an
+  ADR whose `reopen_policy: owner` reserves its reopening to the owner. It is
+  **never sent for clearance**: under ADR-281 § Amendment a favourable council
+  verdict on that surface is advisory until an authenticated owner
+  authorisation is bound to the digest, and an auto-merge sentence is neither.
+  Do not merge; record the PR `unauthorized` and hand it to the owner with its
+  triggers.
 - **`needs-council`** → the AI council reviews the diff with a **neutral**
   prompt (scope, diff, the triggers, two questions: *does any of the six
   dangerous-action predicates of the authority-routing council record
diff --git a/src/domains/product-basic/roadmap/process-full/command.md b/src/domains/product-basic/roadmap/process-full/command.md
index d3a27ce2d..a80de0a24 100644
--- a/src/domains/product-basic/roadmap/process-full/command.md
+++ b/src/domains/product-basic/roadmap/process-full/command.md
@@ -201,6 +201,7 @@ THIS COMMAND MERGES ONLY ON AN EXPLICIT OWNER AUTO-MERGE INSTRUCTION:
 WITHOUT ONE, THE RUN ENDS AT MERGEABLE-AND-OPEN, AND SAYS SO.
 A `needs-council` PR MERGES ONLY ON TWO CONVERGENT CLEARING SEATS;
 DANGEROUS, SPLIT, DEGRADED OR UNAVAILABLE → THE OWNER DECIDES.
+A `needs-owner` PR IS NEVER SENT FOR CLEARANCE — THE OWNER DECIDES.
 ```
 
 The owner settled the half of
@@ -213,7 +214,10 @@ requires for the production-branch merge of a **routine** PR. Delivery runs
 `/pr:merge <N> --merge`, whose § 9a danger gate (`classify_merge_risk`) decides:
 `routine` → squash-merge bound to the observed head; `needs-council` → a neutral
 council review, merge only when both seats say *not dangerous, owner review
-unnecessary*, otherwise hand the PR back with the seats' reasons.
+unnecessary*, otherwise hand the PR back with the seats' reasons; `needs-owner`
+(the gated surface, the reviewer's trust chain, or an owner-reserved ADR) →
+no council, hand it back
+with its triggers. § 9a runs the base revision's classifier, never the head's.
 
 ADR-268 § 3's object-bound `prod_merge` grant stays a separate, unchanged path.
 A standing autonomy directive or momentum is **neither**. Deploy, release and
diff --git a/src/scripts/classify_merge_risk.ts b/src/scripts/classify_merge_risk.ts
index 0dd1d3daf..85f0e917a 100644
--- a/src/scripts/classify_merge_risk.ts
+++ b/src/scripts/classify_merge_risk.ts
@@ -3,10 +3,18 @@
  * classify_merge_risk — ADR-282's danger gate in front of an authorized
  * auto-merge.
  *
- * Says `routine` or `needs-council` for a diff, plus the triggers that fired.
- * `routine` merges on the owner's auto-merge instruction with no review;
- * `needs-council` sends the diff to the AI council first. The classifier is
- * advisory to that flow and grants nothing on its own.
+ * Says `routine`, `needs-council` or `needs-owner` for a diff, plus the
+ * triggers that fired. `routine` merges on the owner's auto-merge instruction
+ * with no review; `needs-council` sends the diff to the AI council first;
+ * `needs-owner` is never sent for clearance and goes to the owner. The
+ * classifier is advisory to that flow and grants nothing on its own.
+ *
+ * WHY A THIRD VERDICT. ADR-281 § Amendment makes a favourable council verdict on
+ * the gated surface advisory until an authenticated owner authorisation is bound
+ * to the same digest, and reserves the reviewer's trust chain to the owner. An
+ * auto-merge sentence is neither authenticated nor bound to a digest, so a
+ * council clearance of those paths would merge on something the record says
+ * cannot authorise it. OWNER_TRIGGERS names which triggers that is.
  *
  * Every trigger is lifted from a rule that already exists, never invented here:
  *
@@ -23,13 +31,20 @@
  *   - Its own surface — this file and the two commands that call it — for the
  *     reason the ratification gate watches itself: a routine-class PR must not
  *     be able to loosen the gate that classed it.
+ *   - Governance read from lists that already exist: an ADR whose frontmatter
+ *     at base or head declares `reopen_policy: owner`, and a rule whose id is a
+ *     member of `src/config/rule-consequence-class.json`.
+ *   - The reviewer and the carriers of the merge rule, each named with the
+ *     record that makes it one (ADR-281 `:101-106`, ADR-282).
  *
  * Prose files (`.md`, `.mdx`, `.txt`, `.rst`) are exempt from the security,
  * infra and migration token checks: a skill ABOUT secrets is not a secret
  * surface. They stay subject to deletion, governance and self-surface checks.
  *
  * Fails closed: a diff that cannot be read is `needs-council`, never `routine`,
- * and never an internal-error exit a caller might read as "nothing found".
+ * and never an internal-error exit a caller might read as "nothing found". A
+ * decision record whose frontmatter cannot be read fires its trigger, and an
+ * unreadable consequence-class list makes every rule file a member.
  *
  * Inputs (one of):
  *   <pr-number>           PR mode: base and head read via `gh`, head fetched
@@ -38,14 +53,15 @@
  *   --root DIR            repository to read (default: cwd)
  *   --json                one JSON object instead of text
  *
- * Exit codes: 0 = routine · 1 = needs-council (including fail-closed).
+ * Exit codes: 0 = routine · 1 = needs-council (including fail-closed) · 2 = needs-owner.
  * The LAST output line is the verdict.
  */
 
 import { spawnSync } from 'node:child_process';
 import * as path from 'node:path';
-import { pathToFileURL } from 'node:url';
+import { fileURLToPath, pathToFileURL } from 'node:url';
 
+import { CLASS_CONFIG_REL, readConsequenceClass } from './_lib/rule_consequence_class.js';
 import { classifyPaths, requiresRatification } from './check_kernel_edit_ratified.js';
 
 export const DELETION_THRESHOLD = 5;
@@ -62,16 +78,42 @@ export interface Trigger {
     paths: string[];
 }
 
+export type Verdict = 'routine' | 'needs-council' | 'needs-owner';
+
 export interface Classification {
-    verdict: 'routine' | 'needs-council';
+    verdict: Verdict;
     triggers: Trigger[];
 }
 
+/** What an ADR's frontmatter says about who may reopen it, across base and head. */
+export type DecisionPolicy = 'owner' | 'other' | 'unreadable';
+
 export interface ClassifyOptions {
     /** Does `dir` still exist in the head tree? Decides a removed directory. */
     dirExistsInHead: (dir: string) => boolean;
+    /** Reopen policy of a decision record. Absent → every record reads `unreadable`. */
+    decisionPolicy?: (p: string) => DecisionPolicy;
+    /**
+     * Rule ids of the consequence class. Absent → this checkout's list; `null`
+     * → the list could not be read, so every rule file counts as a member.
+     */
+    consequenceMembers?: ReadonlySet<string> | null;
 }
 
+/**
+ * Triggers that hand a PR to the owner instead of the council. An ADR with
+ * `reopen_policy: owner` is among them because that field reserves its reopening
+ * to the owner: a council clearing an edit to it would be the council reopening it.
+ */
+export const OWNER_TRIGGERS: ReadonlySet<string> = new Set([
+    'governance-surface',
+    'merge-authority-surface',
+    'reviewer-trust-chain',
+    'council-surface',
+    'ratification-contract',
+    'owner-reserved-decision',
+]);
+
 const PROSE_EXT = new Set(['.md', '.mdx', '.txt', '.rst']);
 
 const SECURITY_TOKENS = new Set([
@@ -99,6 +141,87 @@ const DEPLOY_TOKENS = new Set(['deploy', 'deployment', 'deployments', 'release',
 const SELF_SURFACE_RE =
     /(?:^|\/)(?:scripts\/classify_merge_risk\.ts|domains\/git\/pr\/merge\/command\.md|domains\/product-basic\/roadmap\/process-full\/command\.md)$|^docs\/decisions\/ADR-282-[^/]+\.md$/;
 
+/** The record § 9a's council prompt cites for its dangerous-action predicates. */
+const PREDICATE_RECORD = 'agents/evidence/council/authority-routing-20261007.md';
+
+const RATIFICATION_CONTRACT = 'docs/contracts/ratification-artifact.md';
+
+/**
+ * The reviewer's trust chain beyond the gate's own files: what the classifier
+ * imports, the list it reads, the subject binding the ratification review signs,
+ * and the predicates the council is asked about.
+ */
+const TRUST_CHAIN_PATHS: ReadonlySet<string> = new Set([
+    'src/scripts/_lib/rule_consequence_class.ts',
+    CLASS_CONFIG_REL,
+    'src/scripts/_lib/ratification_subject.ts',
+    PREDICATE_RECORD,
+]);
+
+const COUNCIL_SURFACE_RE =
+    /^src\/scripts\/ai_council\/|^src\/scripts\/(?:_lib\/)?council_[^/]+\.ts$|(?:^|\/)skills\/ai-council\/|(?:^|\/)rules\/(?:council-availability|evaluator-independence)\.md$/;
+
+const MERGE_RULE_CARRIER_RE =
+    /(?:^|\/)contexts\/execution\/(?:roadmap-execution-contract|roadmap-process-loop)\.md$|^src\/scripts\/refusal_envelope\.ts$/;
+
+const CONSUMER_TEMPLATE_RE = /(?:^|\/)agent-src\/templates\/AGENTS\.md$/;
+
+const DECISION_RECORD_RE = /^docs\/decisions\/ADR-[^/]+\.md$/;
+const RULE_FILE_RE = /(?:^|\/)rules\/([a-z0-9-]+)\.md$/;
+
+/** The reopen policy one side of an ADR declares; `null` when it has no readable frontmatter. */
+export function reopenPolicyOf(text: string): string | null {
+    const fm = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
+    if (fm === null) {
+        return null;
+    }
+    const m = /^reopen_policy:\s*["']?([a-z-]+)["']?\s*$/m.exec(fm[1] ?? '');
+    return m === null ? 'absent' : (m[1] ?? 'absent');
+}
+
+/**
+ * Combine the two sides of an ADR. `undefined` is a side where the file does not
+ * exist and is skipped; `null` is a side that exists but could not be read, and
+ * fires — a failed read is never taken for a non-owner policy.
+ */
+export function combinePolicy(sides: readonly (string | null | undefined)[]): DecisionPolicy {
+    let seen = false;
+    for (const side of sides) {
+        if (side === undefined) {
+            continue;
+        }
+        seen = true;
+        const policy = side === null ? null : reopenPolicyOf(side);
+        if (policy === null) {
+            return 'unreadable';
+        }
+        if (policy === 'owner') {
+            return 'owner';
+        }
+    }
+    return seen ? 'other' : 'unreadable';
+}
+
+/** Member ids of the consequence-class JSON text; `null` when it does not parse. */
+export function consequenceMembersOf(text: string): Set<string> | null {
+    try {
+        const raw = JSON.parse(text) as { members?: unknown };
+        return raw.members !== null && typeof raw.members === 'object' ? new Set(Object.keys(raw.members)) : null;
+    } catch {
+        return null;
+    }
+}
+
+const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
+
+function localConsequenceMembers(): Set<string> | null {
+    try {
+        return new Set(Object.keys(readConsequenceClass(REPO_ROOT).members));
+    } catch {
+        return null;
+    }
+}
+
 /** Lower-cased word tokens of a path: split on separators and camelCase. */
 function tokens(p: string): string[] {
     return p
@@ -201,8 +324,49 @@ export function classifyChanges(entries: readonly ChangeEntry[], opts: ClassifyO
         );
     }
     add('merge-authority-surface', 'ADR-282 — the danger gate and the commands that call it', all.filter((p) => SELF_SURFACE_RE.test(p)));
+    add(
+        'reviewer-trust-chain',
+        "ADR-281 :101-106 — the reviewer's trust chain: the gate's imports and list, the subject binding, the council's predicates",
+        all.filter((p) => TRUST_CHAIN_PATHS.has(p)),
+    );
+    add('ratification-contract', 'ADR-281 — the ratification contract', all.filter((p) => p === RATIFICATION_CONTRACT));
+    add(
+        'council-surface',
+        'ADR-281 :101-106 — the council that reviews: ai_council, council modules, the ai-council skill, council-availability, evaluator-independence',
+        all.filter((p) => COUNCIL_SURFACE_RE.test(p)),
+    );
+
+    const policyOf = opts.decisionPolicy ?? ((): DecisionPolicy => 'unreadable');
+    add(
+        'owner-reserved-decision',
+        'decision-revisit-gate — an ADR declaring reopen_policy: owner at base or head, or with unreadable frontmatter',
+        all.filter((p) => DECISION_RECORD_RE.test(p) && policyOf(p) !== 'other'),
+    );
+    const members = opts.consequenceMembers === undefined ? localConsequenceMembers() : opts.consequenceMembers;
+    add(
+        'consequence-class-rule',
+        'rule-consequence-class.json — a rule in the high-consequence class; an unreadable list counts every rule',
+        all.filter((p) => {
+            const m = RULE_FILE_RE.exec(p);
+            return m !== null && (members === null || members.has(m[1] ?? ''));
+        }),
+    );
+    add(
+        'merge-rule-carrier',
+        'ADR-282 — a carrier of the merge rule: the two execution contexts, the refusal envelope, the predicate record',
+        all.filter((p) => MERGE_RULE_CARRIER_RE.test(p) || p === PREDICATE_RECORD),
+    );
+    add('consumer-template', 'ADR-281 — the consumer AGENTS.md template', all.filter((p) => CONSUMER_TEMPLATE_RE.test(p)));
 
-    return { verdict: triggers.length > 0 ? 'needs-council' : 'routine', triggers };
+    return { verdict: verdictOf(triggers), triggers };
+}
+
+/** `needs-owner` above `needs-council` above `routine`. */
+export function verdictOf(triggers: readonly Trigger[]): Verdict {
+    if (triggers.some((t) => OWNER_TRIGGERS.has(t.id))) {
+        return 'needs-owner';
+    }
+    return triggers.length > 0 ? 'needs-council' : 'routine';
 }
 
 /**
@@ -354,6 +518,30 @@ function failClosed(reason: string): Classification {
     return { verdict: 'needs-council', triggers: [{ id: 'diff-unreadable', rule: 'fail closed — ADR-282', paths: [reason] }] };
 }
 
+/**
+ * The consequence class across both sides: the union, so a head can add a
+ * member but never remove one. A side that exists and does not read, or no side
+ * at all, is `null` — every rule file then counts.
+ */
+export function unionMembers(sides: readonly (string | null | undefined)[]): Set<string> | null {
+    const out = new Set<string>();
+    let seen = false;
+    for (const side of sides) {
+        if (side === undefined) {
+            continue;
+        }
+        const read = side === null ? null : consequenceMembersOf(side);
+        if (read === null) {
+            return null;
+        }
+        seen = true;
+        for (const id of read) {
+            out.add(id);
+        }
+    }
+    return seen ? out : null;
+}
+
 export function classifyTarget(root: string, target: { pr?: string | undefined; range?: string | undefined }): Classification {
     const resolved = target.pr !== undefined ? resolvePr(root, target.pr) : resolveRange(target.range ?? '');
     if (resolved === null) {
@@ -369,8 +557,18 @@ export function classifyTarget(root: string, target: { pr?: string | undefined;
     } catch (e) {
         return failClosed((e as Error).message);
     }
+    const exists = (rev: string, p: string): boolean => git(root, ['cat-file', '-e', `${rev}:${p}`]).ok;
+    const side = (rev: string, p: string): string | null | undefined => {
+        if (!exists(rev, p)) {
+            return undefined;
+        }
+        const r = git(root, ['show', `${rev}:${p}`]);
+        return r.ok ? r.out : null;
+    };
     return classifyChanges(entries, {
-        dirExistsInHead: (dir) => git(root, ['cat-file', '-e', `${resolved.head}:${dir}`]).ok,
+        dirExistsInHead: (dir) => exists(resolved.head, dir),
+        decisionPolicy: (p) => combinePolicy([side(resolved.base, p), side(resolved.head, p)]),
+        consequenceMembers: unionMembers([side(resolved.base, CLASS_CONFIG_REL), side(resolved.head, CLASS_CONFIG_REL)]),
     });
 }
 
@@ -405,10 +603,10 @@ export function main(argv: readonly string[] = process.argv.slice(2), write: (l:
         write(
             result.verdict === 'routine'
                 ? 'verdict: routine'
-                : `verdict: needs-council (${result.triggers.length} trigger(s): ${result.triggers.map((t) => t.id).join(', ')})`,
+                : `verdict: ${result.verdict} (${result.triggers.length} trigger(s): ${result.triggers.map((t) => t.id).join(', ')})`,
         );
     }
-    return result.verdict === 'routine' ? 0 : 1;
+    return result.verdict === 'routine' ? 0 : result.verdict === 'needs-council' ? 1 : 2;
 }
 
 if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
diff --git a/tests/scripts/classify_merge_risk.test.ts b/tests/scripts/classify_merge_risk.test.ts
index 5c32ef73f..6487125a5 100644
--- a/tests/scripts/classify_merge_risk.test.ts
+++ b/tests/scripts/classify_merge_risk.test.ts
@@ -7,11 +7,16 @@ import { describe, expect, it } from 'vitest';
 
 import {
     classifyChanges,
+    combinePolicy,
+    consequenceMembersOf,
     DELETION_THRESHOLD,
     main,
     parseNameStatus,
+    reopenPolicyOf,
     resolvePr,
+    unionMembers,
     type ChangeEntry,
+    type ClassifyOptions,
     type ResolveDeps,
 } from '../../src/scripts/classify_merge_risk.js';
 
@@ -73,8 +78,8 @@ describe('routine — the near-misses that must not reach the council', () => {
         expect(ids([mod('src/scripts/authoring_helpers.ts'), mod('src/skills/laravel-migration/helper.ts')])).toEqual([]);
     });
 
-    it('a non-kernel rule is not a governance surface', () => {
-        expect(ids([mod('src/rules/tool-safety.md')])).toEqual([]);
+    it('a non-kernel rule outside the consequence class is not a governance surface', () => {
+        expect(ids([mod('src/rules/markdown-safe-codeblocks.md')])).toEqual([]);
     });
 
     it(`${DELETION_THRESHOLD - 1} deleted files under a surviving directory stay routine`, () => {
@@ -147,6 +152,171 @@ describe('needs-council — one trigger per Hard-Floor and security surface', ()
     });
 });
 
+describe('the gate sees what governs — one case per trigger, each with its near-miss', () => {
+    const governs = (entries: ChangeEntry[], opts: Partial<ClassifyOptions> = {}): string[] =>
+        classifyChanges(entries, {
+            dirExistsInHead: everyDirExists,
+            decisionPolicy: () => 'other',
+            consequenceMembers: new Set(['tool-safety']),
+            ...opts,
+        }).triggers.map((t) => t.id);
+
+    it('an ADR declaring reopen_policy: owner is an owner-reserved decision', () => {
+        expect(governs([mod('docs/decisions/ADR-281-x.md')], { decisionPolicy: () => 'owner' })).toEqual([
+            'owner-reserved-decision',
+        ]);
+        expect(governs([mod('docs/decisions/ADR-100-x.md')])).toEqual([]);
+    });
+
+    it('a decision record whose frontmatter cannot be read fires the trigger', () => {
+        expect(governs([mod('docs/decisions/ADR-100-x.md')], { decisionPolicy: () => 'unreadable' })).toEqual([
+            'owner-reserved-decision',
+        ]);
+        expect(governs([mod('docs/decisions/INDEX.md')], { decisionPolicy: () => 'unreadable' })).toEqual([]);
+    });
+
+    it('a rule in the consequence class fires, as source and as projection; one outside does not', () => {
+        expect(governs([mod('src/rules/tool-safety.md')])).toEqual(['consequence-class-rule']);
+        expect(governs([mod('dist/agent-src/rules/tool-safety.md')])).toEqual(['consequence-class-rule']);
+        expect(governs([mod('src/rules/markdown-safe-codeblocks.md')])).toEqual([]);
+    });
+
+    it('an unreadable consequence-class list counts every rule file', () => {
+        expect(governs([mod('src/rules/markdown-safe-codeblocks.md')], { consequenceMembers: null })).toEqual([
+            'consequence-class-rule',
+        ]);
+    });
+
+    it('the ratification contract fires; a neighbouring contract does not', () => {
+        expect(governs([mod('docs/contracts/ratification-artifact.md')])).toEqual(['ratification-contract']);
+        expect(governs([mod('docs/contracts/evidence-artifact-types.md')])).toEqual([]);
+    });
+
+    it('the council fires, through each of its five forms', () => {
+        for (const p of [
+            'src/scripts/ai_council/orchestrator.ts',
+            'src/scripts/council_cli.ts',
+            'src/scripts/_lib/council_transport.ts',
+            'dist/agent-src/skills/ai-council/SKILL.md',
+            'src/rules/council-availability.md',
+        ]) {
+            expect(governs([mod(p)])).toContain('council-surface');
+        }
+        expect(governs([mod('src/scripts/check_councillor_names.ts')])).toEqual([]);
+    });
+
+    it('the carriers of the merge rule fire', () => {
+        for (const p of [
+            'src/agent-src/contexts/execution/roadmap-execution-contract.md',
+            'dist/agent-src/contexts/execution/roadmap-process-loop.md',
+            'src/scripts/refusal_envelope.ts',
+        ]) {
+            expect(governs([mod(p)])).toEqual(['merge-rule-carrier']);
+        }
+        expect(governs([mod('agents/evidence/council/authority-routing-20261007.md')])).toContain('merge-rule-carrier');
+        expect(governs([mod('src/agent-src/contexts/execution/roadmap-blockers.md')])).toEqual([]);
+    });
+
+    it('the consumer AGENTS.md template fires; the root AGENTS.md does not', () => {
+        expect(governs([mod('src/agent-src/templates/AGENTS.md')])).toEqual(['consumer-template']);
+        expect(governs([mod('AGENTS.md')])).toEqual([]);
+    });
+
+    it('every trigger names the rule it comes from', () => {
+        const r = classifyChanges(
+            [mod('docs/contracts/ratification-artifact.md'), mod('src/agent-src/templates/AGENTS.md')],
+            { dirExistsInHead: everyDirExists, decisionPolicy: () => 'other', consequenceMembers: new Set() },
+        );
+        for (const t of r.triggers) {
+            expect(t.rule).not.toBe('');
+        }
+    });
+});
+
+describe('frontmatter reading — both sides, failing closed', () => {
+    it('reads the policy, quoted or not, and refuses a file without frontmatter', () => {
+        expect(reopenPolicyOf('---\nid: ADR-1\nreopen_policy: owner\n---\n# x\n')).toBe('owner');
+        expect(reopenPolicyOf('---\nreopen_policy: "directional"\n---\n')).toBe('directional');
+        expect(reopenPolicyOf('---\nid: ADR-1\n---\n')).toBe('absent');
+        expect(reopenPolicyOf('# no frontmatter\n')).toBeNull();
+    });
+
+    it('owner at base OR at head fires; a side that exists and cannot be read fires', () => {
+        const owner = '---\nreopen_policy: owner\n---\n';
+        const other = '---\nreopen_policy: directional\n---\n';
+        expect(combinePolicy([owner, other])).toBe('owner');
+        expect(combinePolicy([other, owner])).toBe('owner');
+        expect(combinePolicy([undefined, other])).toBe('other');
+        expect(combinePolicy([other, null])).toBe('unreadable');
+        expect(combinePolicy([undefined, undefined])).toBe('unreadable');
+    });
+
+    it('the consequence class is the union of both sides, and an unreadable side is null', () => {
+        const a = JSON.stringify({ members: { 'tool-safety': {} } });
+        const b = JSON.stringify({ members: { 'session-canary': {} } });
+        expect([...(unionMembers([a, b]) ?? [])].sort()).toEqual(['session-canary', 'tool-safety']);
+        expect(unionMembers([a, 'not json'])).toBeNull();
+        expect(unionMembers([undefined, undefined])).toBeNull();
+        expect(consequenceMembersOf('{"members": []}')).toEqual(new Set());
+    });
+
+    it('a real range reads the head frontmatter of an added owner-reserved ADR', () => {
+        const dir = tmpRepo();
+        const g = (...args: string[]): void => {
+            spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
+        };
+        fs.mkdirSync(path.join(dir, 'docs', 'decisions'), { recursive: true });
+        fs.writeFileSync(path.join(dir, 'docs', 'decisions', 'ADR-001-a.md'), '---\nreopen_policy: owner\n---\n');
+        fs.writeFileSync(path.join(dir, 'docs', 'decisions', 'ADR-002-b.md'), '---\nreopen_policy: directional\n---\n');
+        g('add', '-A');
+        g('commit', '-q', '-m', 'adrs');
+        const out: string[] = [];
+        main(['--range', 'HEAD~1...HEAD', '--root', dir], (l) => out.push(l));
+        expect(out).toContain('  docs/decisions/ADR-001-a.md');
+        expect(out).not.toContain('  docs/decisions/ADR-002-b.md');
+        expect(out[out.length - 1]).toMatch(/^verdict: needs-owner \(1 trigger\(s\): owner-reserved-decision\)$/u);
+        fs.rmSync(dir, { recursive: true, force: true });
+    });
+});
+
+/**
+ * The trunk's own misses, replayed from the repository's history. Skipped only
+ * where the history is not present (a shallow clone), and the skip names why —
+ * the cases above carry the same paths as hand-written fixtures.
+ */
+/** Touches docs/installation.md, one analysis note and three roadmaps — nothing that governs. */
+const DOCS_ONLY_COMMIT = '7b236a00f';
+
+describe('replay — the commits the pin classed routine', () => {
+    const REPO = path.resolve(__dirname, '..', '..');
+    const has = (sha: string): boolean =>
+        spawnSync('git', ['cat-file', '-e', `${sha}^{commit}`], { cwd: REPO }).status === 0 &&
+        spawnSync('git', ['cat-file', '-e', `${sha}^1^{commit}`], { cwd: REPO }).status === 0;
+    const replay = (sha: string): string => {
+        const out: string[] = [];
+        main(['--range', `${sha}^1..${sha}`, '--root', REPO], (l) => out.push(l));
+        return out[out.length - 1] ?? '';
+    };
+
+    for (const [sha, what] of [
+        ['82a131feb', 'landed ADR-281 and rewrote the ratification contract'],
+        ['bbe5b73be', "the council's modification-review modules"],
+        ['edd18fea6', 'introduced the gate (#2256)'],
+    ] as const) {
+        it.skipIf(!has(sha))(`${sha} (${what}) is needs-owner — skipped when the history is shallow`, () => {
+            expect(replay(sha)).toMatch(/^verdict: needs-owner/u);
+        });
+    }
+
+    it.skipIf(!has('f76e83e47'))('f76e83e47 (the amendment of an owner-reserved ADR) is needs-owner', () => {
+        expect(replay('f76e83e47')).toMatch(/^verdict: needs-owner/u);
+    });
+
+    it.skipIf(!has(DOCS_ONLY_COMMIT))(`${DOCS_ONLY_COMMIT} (a documentation-only commit) stays routine`, () => {
+        expect(replay(DOCS_ONLY_COMMIT)).toBe('verdict: routine');
+    });
+});
+
 describe('parseNameStatus', () => {
     it('reads modify, delete and scored rename lines', () => {
         expect(parseNameStatus('M\ta.ts\nD\tb.ts\nR087\told.ts\tnew.ts\n')).toEqual([
diff --git a/tests/scripts/classify_merge_risk_base_revision.test.ts b/tests/scripts/classify_merge_risk_base_revision.test.ts
new file mode 100644
index 000000000..b3fbd091b
--- /dev/null
+++ b/tests/scripts/classify_merge_risk_base_revision.test.ts
@@ -0,0 +1,102 @@
+import { spawnSync } from 'node:child_process';
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+
+import { afterAll, beforeAll, describe, expect, it } from 'vitest';
+
+/**
+ * The downgrade attack § 9a's base-revision run exists to stop: a head that
+ * rewrites the classifier, or the gated-set reader it imports, so that its own
+ * copy calls the change `routine`. Run from the head the attack works; run from
+ * the base with `--root` on the head it does not. Both halves are asserted —
+ * the head half proves the fixture is a real attack, not a diff the head copy
+ * would have flagged anyway.
+ *
+ * The repository is a `--shared` clone of this one, so the real classifier and
+ * its real import closure judge. The base commit carries the working tree's
+ * classifier, so the test exercises the code under review, not the last commit.
+ */
+
+const REPO = path.resolve(__dirname, '..', '..');
+const TSX = path.join(REPO, 'node_modules', '.bin', 'tsx');
+const CLASSIFIER = 'src/scripts/classify_merge_risk.ts';
+const GATED_READER = 'src/scripts/check_kernel_edit_ratified.ts';
+const KERNEL_RULE = 'src/rules/non-destructive-by-default.md';
+
+let work = '';
+let clone = '';
+let base = '';
+
+function git(cwd: string, ...args: string[]): string {
+    const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
+    if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr ?? ''}`);
+    return r.stdout.trim();
+}
+
+/** The last line the classifier prints, run from `copyRoot`, judging `clone`. */
+function verdictFrom(copyRoot: string, head: string): string {
+    const r = spawnSync(TSX, [path.join(copyRoot, CLASSIFIER), '--range', `${base}...${head}`, '--root', clone], {
+        cwd: clone,
+        encoding: 'utf8',
+    });
+    const lines = (r.stdout ?? '').trim().split('\n');
+    return lines[lines.length - 1] ?? '';
+}
+
+/** A head commit on a fresh branch from base: `edit` rewrites one file, and a kernel rule is touched. */
+function attack(branch: string, file: string, edit: (src: string) => string): string {
+    git(clone, 'checkout', '-q', '-b', branch, base);
+    const p = path.join(clone, file);
+    const before = fs.readFileSync(p, 'utf8');
+    const after = edit(before);
+    if (after === before) throw new Error(`the attack on ${file} changed nothing — the anchor moved`);
+    fs.writeFileSync(p, after);
+    fs.appendFileSync(path.join(clone, KERNEL_RULE), '\n');
+    git(clone, 'commit', '-q', '-am', branch);
+    return git(clone, 'rev-parse', 'HEAD');
+}
+
+beforeAll(() => {
+    // realpath: on macOS the tmpdir is a symlink, and the classifier's main guard compares real paths.
+    work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cmr-base-')));
+    clone = path.join(work, 'repo');
+    git(work, 'clone', '-q', '--shared', REPO, clone);
+    git(clone, 'config', 'user.email', 't@example.com');
+    git(clone, 'config', 'user.name', 'T');
+    for (const f of [CLASSIFIER, GATED_READER, 'src/scripts/_lib/rule_consequence_class.ts']) {
+        fs.copyFileSync(path.join(REPO, f), path.join(clone, f));
+    }
+    git(clone, 'add', '-A');
+    git(clone, 'commit', '-q', '--allow-empty', '-m', 'base: the classifier under review');
+    base = git(clone, 'rev-parse', 'HEAD');
+    git(clone, 'worktree', 'add', '-q', '--detach', path.join(work, 'base'), base);
+}, 60_000);
+
+afterAll(() => {
+    if (work !== '') fs.rmSync(work, { recursive: true, force: true });
+});
+
+describe('the code that classes a change is not the change’s own', () => {
+    it('a head that makes the classifier answer routine is caught by the base copy', () => {
+        const head = attack('downgrade-verdict', CLASSIFIER, (s) =>
+            s.replace(
+                'export function verdictOf(triggers: readonly Trigger[]): Verdict {',
+                "export function verdictOf(triggers: readonly Trigger[]): Verdict {\n    if (triggers.length >= 0) return 'routine';",
+            ),
+        );
+        expect(verdictFrom(clone, head)).toBe('verdict: routine');
+        expect(verdictFrom(path.join(work, 'base'), head)).toMatch(/^verdict: needs-owner/u);
+    }, 60_000);
+
+    it('a head that narrows classifyPaths so the kernel rule falls out is caught by the base copy', () => {
+        const head = attack('narrow-gated-set', GATED_READER, (s) =>
+            s.replace(
+                '): GatedPaths {\n    const derivedSet',
+                '): GatedPaths {\n    if (files.length >= 0) return { kernelRules: [], governanceHooks: [], plumbing: [], self: false };\n    const derivedSet',
+            ),
+        );
+        expect(verdictFrom(clone, head)).toBe('verdict: routine');
+        expect(verdictFrom(path.join(work, 'base'), head)).toMatch(/^verdict: needs-owner/u);
+    }, 60_000);
+});
diff --git a/tests/scripts/classify_merge_risk_needs_owner.test.ts b/tests/scripts/classify_merge_risk_needs_owner.test.ts
new file mode 100644
index 000000000..5268ea753
--- /dev/null
+++ b/tests/scripts/classify_merge_risk_needs_owner.test.ts
@@ -0,0 +1,151 @@
+import { spawnSync } from 'node:child_process';
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+
+import { describe, expect, it } from 'vitest';
+
+import {
+    classifyChanges,
+    main,
+    OWNER_TRIGGERS,
+    verdictOf,
+    type ChangeEntry,
+} from '../../src/scripts/classify_merge_risk.js';
+
+/**
+ * `needs-owner` is the verdict the amended ADR-281 forces: a council clearance of
+ * the gated surface or of the reviewer's trust chain is advisory, so those PRs
+ * are never sent for clearance. Pinned in both directions — a gate that said
+ * `needs-owner` for everything would put every flagged PR on the owner, which
+ * is the first bound the owner set.
+ */
+
+const mod = (p: string): ChangeEntry => ({ status: 'M', path: p });
+const verdict = (...paths: string[]): string =>
+    classifyChanges(paths.map(mod), {
+        dirExistsInHead: () => true,
+        decisionPolicy: () => 'other',
+        consequenceMembers: new Set(['tool-safety']),
+    }).verdict;
+
+describe('needs-owner — the gated surface goes to the owner, not the council', () => {
+    it('a kernel rule (the governance-surface trigger) is needs-owner', () => {
+        expect(verdict('src/rules/non-destructive-by-default.md')).toBe('needs-owner');
+    });
+
+    it('the ratification gate itself is needs-owner', () => {
+        expect(verdict('src/scripts/check_kernel_edit_ratified.ts')).toBe('needs-owner');
+    });
+
+    it('an ADR whose reopening is reserved to the owner is needs-owner; another ADR is routine', () => {
+        const byPolicy = (policy: 'owner' | 'other' | 'unreadable'): string =>
+            classifyChanges([mod('docs/decisions/ADR-281-x.md')], {
+                dirExistsInHead: () => true,
+                decisionPolicy: () => policy,
+                consequenceMembers: new Set(),
+            }).verdict;
+        expect(byPolicy('owner')).toBe('needs-owner');
+        expect(byPolicy('unreadable')).toBe('needs-owner');
+        expect(byPolicy('other')).toBe('routine');
+    });
+});
+
+describe("needs-owner — every member class of the reviewer's trust chain", () => {
+    it.each([
+        ['the classifier', 'src/scripts/classify_merge_risk.ts'],
+        ['the merge command', 'src/domains/git/pr/merge/command.md'],
+        ['the process-full command', 'src/domains/product-basic/roadmap/process-full/command.md'],
+        ['ADR-282', 'docs/decisions/ADR-282-auto-merge-authority-with-a-council-danger-gate.md'],
+        ['the consequence-class module the classifier imports', 'src/scripts/_lib/rule_consequence_class.ts'],
+        ['the consequence-class list the classifier reads', 'src/config/rule-consequence-class.json'],
+        ['the subject binding', 'src/scripts/_lib/ratification_subject.ts'],
+        ['the ratification contract', 'docs/contracts/ratification-artifact.md'],
+        ['the predicate record', 'agents/evidence/council/authority-routing-20261007.md'],
+        ['an ai_council module', 'src/scripts/ai_council/orchestrator.ts'],
+        ['a council script', 'src/scripts/council_cli.ts'],
+        ['a council library module', 'src/scripts/_lib/council_transport.ts'],
+        ['the ai-council skill', 'src/skills/ai-council/SKILL.md'],
+        ['the council-availability rule', 'src/rules/council-availability.md'],
+        ['the evaluator-independence rule', 'src/rules/evaluator-independence.md'],
+    ])('%s is needs-owner', (_name, p) => {
+        expect(verdict(p)).toBe('needs-owner');
+    });
+});
+
+describe('the near-misses stay where they were', () => {
+    it('a CI workflow alone stays needs-council', () => {
+        expect(verdict('.github/workflows/tests.yml')).toBe('needs-council');
+    });
+
+    it('a consequence-class rule alone is needs-council, not needs-owner', () => {
+        expect(verdict('src/rules/tool-safety.md')).toBe('needs-council');
+    });
+
+    it('a merge-rule carrier alone is needs-council', () => {
+        expect(verdict('src/agent-src/contexts/execution/roadmap-process-loop.md')).toBe('needs-council');
+    });
+
+    it('a docs edit stays routine', () => {
+        expect(verdict('docs/guides/parallel-sessions.md')).toBe('routine');
+    });
+
+    it('a script that only shares a word with the council stays routine', () => {
+        expect(verdict('src/scripts/check_councillor_names.ts')).toBe('routine');
+    });
+});
+
+describe('precedence of the three verdicts', () => {
+    it('owner beats council, council beats routine', () => {
+        expect(verdictOf([])).toBe('routine');
+        expect(verdictOf([{ id: 'ci-workflow', rule: 'r', paths: ['x'] }])).toBe('needs-council');
+        expect(
+            verdictOf([
+                { id: 'ci-workflow', rule: 'r', paths: ['x'] },
+                { id: 'governance-surface', rule: 'r', paths: ['y'] },
+            ]),
+        ).toBe('needs-owner');
+    });
+
+    it('a mixed diff is needs-owner and still lists the council trigger', () => {
+        const r = classifyChanges([mod('.github/workflows/tests.yml'), mod('src/scripts/council_cli.ts')], {
+            dirExistsInHead: () => true,
+            decisionPolicy: () => 'other',
+            consequenceMembers: new Set(),
+        });
+        expect(r.verdict).toBe('needs-owner');
+        expect(r.triggers.map((t) => t.id)).toEqual(['ci-workflow', 'council-surface']);
+    });
+
+    it('every owner trigger id is one the classifier can emit', () => {
+        const src = fs.readFileSync(path.resolve(__dirname, '../../src/scripts/classify_merge_risk.ts'), 'utf8');
+        for (const id of OWNER_TRIGGERS) {
+            expect(src).toContain(`'${id}'`);
+        }
+    });
+});
+
+describe('main — exit 2 and the verdict on the last line', () => {
+    it('a range touching the council exits 2 with verdict: needs-owner', () => {
+        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cmr-owner-'));
+        const g = (...args: string[]): void => {
+            const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
+            if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr ?? ''}`);
+        };
+        g('init', '-q', '-b', 'main');
+        g('config', 'user.email', 't@example.com');
+        g('config', 'user.name', 'T');
+        fs.writeFileSync(path.join(dir, 'README.md'), 'base\n');
+        g('add', '-A');
+        g('commit', '-q', '-m', 'base');
+        fs.mkdirSync(path.join(dir, 'src', 'scripts'), { recursive: true });
+        fs.writeFileSync(path.join(dir, 'src', 'scripts', 'council_cli.ts'), 'export {};\n');
+        g('add', '-A');
+        g('commit', '-q', '-m', 'council');
+        const out: string[] = [];
+        const code = main(['--range', 'HEAD~1...HEAD', '--root', dir], (l) => out.push(l));
+        expect(out[out.length - 1]).toMatch(/^verdict: needs-owner \(1 trigger\(s\): council-surface\)$/u);
+        expect(code).toBe(2);
+        fs.rmSync(dir, { recursive: true, force: true });
+    });
+});
diff --git a/tests/scripts/pr_merge_danger_gate_command.test.ts b/tests/scripts/pr_merge_danger_gate_command.test.ts
new file mode 100644
index 000000000..b31c639dc
--- /dev/null
+++ b/tests/scripts/pr_merge_danger_gate_command.test.ts
@@ -0,0 +1,54 @@
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+
+import { describe, expect, it } from 'vitest';
+
+/**
+ * The merge command's danger gate is prose an agent executes, so its three
+ * obligations are pinned as text: the classifier runs from the base revision,
+ * a `needs-owner` PR is never sent to the council, and a `routine` PR still
+ * merges with no review. `src/agent-src/commands/evals/git-pr-merge.json` is a
+ * routing eval (prompt → command) and cannot express any of them.
+ */
+
+const ROOT = path.resolve(__dirname, '..', '..');
+const MERGE = fs.readFileSync(path.join(ROOT, 'src/domains/git/pr/merge/command.md'), 'utf8');
+const PROCESS_FULL = fs.readFileSync(path.join(ROOT, 'src/domains/product-basic/roadmap/process-full/command.md'), 'utf8');
+
+function section(text: string, heading: string): string {
+    const start = text.indexOf(heading);
+    if (start < 0) throw new Error(`heading not found: ${heading}`);
+    const next = text.indexOf('\n## ', start + heading.length);
+    return text.slice(start, next < 0 ? undefined : next);
+}
+
+const GATE = section(MERGE, '## 9a. Danger gate');
+
+describe('§ 9a classes a PR from the base revision', () => {
+    it('materialises the manifest base in a worktree and runs that copy with --root on the head', () => {
+        expect(GATE).toContain('git worktree add -q --detach "$BASE_DIR" "<manifest-base_sha>"');
+        expect(GATE).toContain('"$BASE_DIR/src/scripts/classify_merge_risk.ts"');
+        expect(GATE).toContain('--root "$PWD"');
+    });
+
+    it('never runs the head copy of the classifier', () => {
+        expect(GATE).not.toMatch(/\.\/scripts-run src\/scripts\/classify_merge_risk/u);
+    });
+
+    it('a base it cannot use is needs-owner, never a skip and never a fall-back', () => {
+        expect(GATE).toContain('echo "verdict: needs-owner (base-unavailable');
+        expect(GATE).toMatch(/never a skipped gate and never a fall-back to\s+the head's copy/u);
+    });
+});
+
+describe('the three verdicts', () => {
+    it('a needs-owner PR is never sent for clearance', () => {
+        expect(GATE).toMatch(/\*\*`needs-owner`\*\*[\s\S]*\*\*never sent for clearance\*\*/u);
+        expect(MERGE).toContain('A `needs-owner` PR IS NEVER SENT FOR CLEARANCE');
+        expect(PROCESS_FULL).toContain('A `needs-owner` PR IS NEVER SENT FOR CLEARANCE');
+    });
+
+    it('a routine PR still merges with no review step', () => {
+        expect(GATE).toContain('- **`routine`** → merge in § 9. No review step.');
+    });
+});
~~~
