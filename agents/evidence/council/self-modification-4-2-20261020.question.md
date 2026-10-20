<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-20, committed verbatim so the
     verdict beside it can be checked against what was actually asked
     (evaluator-independence: a recorded verdict whose prompt is not recoverable
     is not evidence, because nobody can check what was asked). -->

# Modification review — the ratification gate gains the high-consequence rule class

You are reviewing a change to this package's own governance mechanism. Answer
the nine questions below, one at a time, then close on a single stance line.

Close with exactly one line, in this form:

    STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <0-100> | DEALBREAKER: <one sentence, or none>

`ratified` — the change is sound and may pass the gate.
`confirmed-non-expanding` — the change does not widen any authority; it may pass.
`refused` — it must not pass as it stands; name the dealbreaker.

## Context you need

`check_kernel_edit_ratified.ts` refuses a diff that touches a governed surface
(nine kernel rules, governance hooks, hook plumbing, the gate's own mechanism)
unless the diff also carries a ratification record under
`agents/evidence/ratifications/`. `_lib/ratification_subject.ts` computes the
`subject` digest over the gated files from Git objects at a revision, which
binds a record to the content it reviewed. In CI the BASE revision's copy of the
gate runs against the head checkout. `classify_merge_risk.ts` is a separate
merge-time classifier that reads the gate's `classifyPaths`; its
`governance-surface` trigger routes a pull request to the owner rather than to a
council clearance (ADR-281 § Amendment: a council verdict on the gated surface
is advisory until an owner authorisation is bound to the same digest).

`src/config/rule-consequence-class.json` lists 28 rules beyond the kernel whose
violation would act irreversibly outside the repository, cross a security
boundary, or bypass a reserved authority. The criterion is stated in
`rule.schema.json#/properties/consequence_class`.

This change gates those 28 rules and the list itself.

## The earlier review of this step

A previous version of this step was reviewed on 2026-10-19 and refused 2/2. Its
two dealbreakers, quoted from that record:

1. "The class list fails OPEN. Every read, parse or shape failure became an
   empty set, so an unreadable list silently removed protection from 28 rules
   while the gate kept exiting 0."
2. "Membership was not resolved at the revision the subject binds to. The slugs
   were read from the working tree while the digest is taken from Git objects
   at an explicit revision ... adding a member while editing that newly
   consequential rule is not [covered], because the base list does not."

That review also recorded, as non-blocking: gating the shared `rule.schema.json`
prices every unrelated schema edit as a governance event; a process-global
cache was never invalidated; a slug with no rule file, a non-string key and a
`__proto__` key were accepted; the fail-open path wrote no audit trail.

That version also bundled a second step (gating two council modules) which the
same review refused on separate grounds. That step is NOT in this diff.

## What changed between that version and this one, as the author describes it

Check each against the diff rather than relying on this list.

- The list is parsed by `consequenceRuleSlugsIn`, which throws
  `ConsequenceClassUnreadable` (a `GatedSubjectRefusal`) for an absent or
  unparseable file, a non-object `members`, a key not matching a rule slug, an
  entry with no string `clause`, or a member with no `src/rules/<slug>.md` in
  the same tree. The gate reports it as a refusal before any exit 0. An empty
  `members` object is accepted.
- Membership is read from Git objects at both the base and the head commit,
  in the same function that already read the dispatcher closure from those two
  trees, and the union is used for classification and for the digest.
- `rule.schema.json` is not added to the watch list; the gate never reads it.
- No cache; the checkout-default reader runs per call.
- The merge classifier's `governance-surface` path list now includes the class,
  so a pull request touching a class member becomes `needs-owner` at merge
  where it was `needs-council` before. Measured on `main`: 7 of 457
  first-parent commits in the 30 days to 2026-10-20 touched a class member
  (source or projection); none touched a kernel rule.
- Tests: two merge-classifier tests are changed to the new routing; a shared
  test fixture now writes an empty class list at a fixture repository's first
  commit, because the gate now refuses a revision without one.

## What is in this bundle and what is not

Included in full at one line of context: the whole `src/` and `tests/` diff.
Nothing else is in the change. Base `origin/main` @ 67928878b, head 32c815fff;
the subject digest over the gated files is
`1020c5522ea37736fc62f6b8f80a32ba5e3d8577991ef8840155b2b162a7cdd6`.

## The nine questions

1. What behaviour changes, including what follows from it that the diff does not state?
2. Which authority or safety boundary becomes wider or narrower, and in which direction?
3. Does the change weaken anything that judges it — a test, a gate, a threshold, this review? The standard is quoted rather than paraphrased: the implementer never silently weakens an assertion, deletes, skips or xfails a failing test, lowers a threshold, or changes fixture semantics to fit the code. Does this change do any of those?
4. Is another host or projection left as a way around the control this change touches?
5. Can it be undone, and how — by whom, with what authority, and against which revision?
6. What observation would show the claimed benefit to be false, and what rollback / kill-switch criteria does the change omit?
7. Would a smaller change do, and what does the larger one buy that the smaller one does not?
8. What does it add to standing instruction weight that every later session pays?
9. Could untrusted content steer the path this change opens, and what bounds it if so?

## Changed-file stat

```
 src/scripts/_lib/ratification_subject.ts           |  49 ++++-
 src/scripts/check_kernel_edit_ratified.ts          | 180 ++++++++++++++--
 src/scripts/classify_merge_risk.ts                 |  11 +-
 ..._kernel_edit_ratified_consequence_class.test.ts | 236 +++++++++++++++++++++
 tests/scripts/classify_merge_risk.test.ts          |   8 +-
 .../classify_merge_risk_base_revision.test.ts      |   2 +-
 .../classify_merge_risk_needs_owner.test.ts        |   8 +-
 tests/scripts/ratification_git_fixture.ts          |  13 ++
 8 files changed, 478 insertions(+), 29 deletions(-)
```

## The diff

```diff
diff --git a/src/scripts/_lib/ratification_subject.ts b/src/scripts/_lib/ratification_subject.ts
index 176f6532c..3df47376c 100644
--- a/src/scripts/_lib/ratification_subject.ts
+++ b/src/scripts/_lib/ratification_subject.ts
@@ -170,2 +170,26 @@ export class GitReadFailed extends GatedSubjectRefusal {
 
+/**
+ * Raised when the high-consequence rule list cannot be read as a list at a
+ * revision: absent, unparseable, the wrong shape, a member that is not a rule
+ * slug, or a member naming no rule file in that same tree.
+ *
+ * FAILS CLOSED. The list decides which rules beyond the kernel need a record,
+ * so an unreadable list does not cost only a widening — it removes the
+ * protection from every member at once, and a gate that exits 0 over that is a
+ * control that passes when it cannot measure. Declared here rather than beside
+ * the reader in the gate because the two modules import each other: a subclass
+ * defined at the gate's module scope would be evaluated before this base class
+ * when this module is the entry point.
+ */
+export class ConsequenceClassUnreadable extends GatedSubjectRefusal {
+    constructor(rel: string, where: string, detail: string) {
+        super(
+            rel,
+            `the high-consequence rule list \`${rel}\` cannot be read at ${where} (${detail}) — ` +
+                'the gate refuses rather than judging those rules as if the class were empty',
+        );
+        this.name = 'ConsequenceClassUnreadable';
+    }
+}
+
 /**
@@ -464,6 +488,16 @@ export function gatedFilesOf(
     derived?: readonly string[],
+    consequence?: ReadonlySet<string>,
 ): readonly string[] {
     const normalized = files.map((f) => f.replace(/\\/g, '/').trim()).filter((f) => f !== '');
-    const g = derived === undefined ? classifyPaths(normalized) : classifyPaths(normalized, derived);
-    const out = new Set<string>([...g.kernelRules, ...g.governanceHooks, ...g.plumbing]);
+    // An `undefined` argument takes the gate's own default, so a caller that
+    // passes neither classifies exactly as `classifyPaths(normalized)` would.
+    const g = classifyPaths(normalized, derived, consequence);
+    // Both limbs or neither: a high-consequence rule the gate refuses and the
+    // digest did not cover would be gated by the refusal and bound by no record.
+    const out = new Set<string>([
+        ...g.kernelRules,
+        ...g.consequenceRules,
+        ...g.governanceHooks,
+        ...g.plumbing,
+    ]);
     for (const f of normalized) {
@@ -504,4 +538,5 @@ export interface SubjectReading {
  *
- * `derived` is the plumbing closure the caller already computed, passed through
- * to {@link gatedFilesOf} unchanged: a digest that classified without it would
+ * `derived` is the plumbing closure and `consequence` the high-consequence rule
+ * slugs the caller already computed, both passed through to
+ * {@link gatedFilesOf} unchanged: a digest that classified without them would
  * cover fewer files than the gate gated.
@@ -516,4 +551,5 @@ export function subjectOf(
     revision: string = DEFAULT_REVISION,
+    consequence?: ReadonlySet<string>,
 ): SubjectReading {
-    const gatedFiles = gatedFilesOf(files, derived);
+    const gatedFiles = gatedFilesOf(files, derived, consequence);
     const h = createHash('sha256');
@@ -549,4 +585,5 @@ export function subjectDigest(
     revision: string = DEFAULT_REVISION,
+    consequence?: ReadonlySet<string>,
 ): string {
-    return subjectOf(root, files, derived, revision).digest;
+    return subjectOf(root, files, derived, revision, consequence).digest;
 }
diff --git a/src/scripts/check_kernel_edit_ratified.ts b/src/scripts/check_kernel_edit_ratified.ts
index 47df197dc..32c2f0d13 100644
--- a/src/scripts/check_kernel_edit_ratified.ts
+++ b/src/scripts/check_kernel_edit_ratified.ts
@@ -38,3 +38,5 @@
  * the dispatcher imports that decides an exit code (derived at run time, see
- * `derivedPlumbing`) — or this gate itself, so it cannot
+ * `derivedPlumbing`) — a rule of the high-consequence class beyond the kernel
+ * (the members of `rule-consequence-class.json`, see `CONSEQUENCE_CLASS_PATH`)
+ * — or this gate itself, so it cannot
  * be weakened without its own record. Such a diff must carry a ratification
@@ -103,2 +105,3 @@ import {
 import {
+    ConsequenceClassUnreadable,
     DEFAULT_REVISION,
@@ -158,2 +161,22 @@ export const POLICY_PATH = 'src/config/ratification-policy.json';
 
+/**
+ * The high-consequence rule class: every rule whose violation would leave the
+ * repository irreversibly, cross a security boundary or bypass an authority
+ * (the criterion is stated in `rule.schema.json#/properties/consequence_class`).
+ * Its members beyond the nine kernel rules are gated like kernel rules.
+ *
+ * The list is on the watch list so that a change cannot drop a member in order
+ * to edit the rule it names, nor add one without a record. The schema that
+ * states the criterion is deliberately NOT: this gate never reads it, so a
+ * schema edit changes no membership until the list changes, and the list is
+ * what is gated. Watching the schema would price every unrelated schema edit
+ * as a governance event while gating nothing the list does not already gate.
+ *
+ * Membership is read FROM GIT OBJECTS at both the base and the head commit and
+ * the union is gated (see `gateInputsFor`), so dropping a member is caught by
+ * the base side and adding one by the head side, and the digest covers both.
+ * It FAILS CLOSED: a list that cannot be read at either commit is a refusal.
+ */
+export const CONSEQUENCE_CLASS_PATH = 'src/config/rule-consequence-class.json';
+
 /**
@@ -344,2 +367,7 @@ export interface GatedPaths {
     plumbing: string[];
+    /**
+     * Rules of the high-consequence class that are NOT among the nine kernel
+     * rules, in the source tree or in any projection — the kernel reach.
+     */
+    consequenceRules: string[];
     self: boolean;
@@ -347,2 +375,76 @@ export interface GatedPaths {
 
+/** A rule slug as a rule filename spells it, and nothing else. */
+const RULE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
+
+/**
+ * The high-consequence rule slugs a list states, validated against the tree
+ * it was read from.
+ *
+ * `read` answers a repo-relative path with that tree's text or `null`; `where`
+ * names the tree in a refusal. Every way the list fails to be a list THROWS
+ * {@link ConsequenceClassUnreadable} — absent, unparseable, `members` not a
+ * plain object, a key that is not a rule slug (which also rules out
+ * `__proto__`), an entry without a string `clause`, or a member with no
+ * `src/rules/<slug>.md` in the same tree. An empty `members` is legal: it is
+ * a statement the list makes, reachable only by an edit of the gated list.
+ */
+export function consequenceRuleSlugsIn(
+    read: (rel: string) => string | null,
+    where: string,
+): ReadonlySet<string> {
+    const refuse = (detail: string): never => {
+        throw new ConsequenceClassUnreadable(CONSEQUENCE_CLASS_PATH, where, detail);
+    };
+    const raw = read(CONSEQUENCE_CLASS_PATH);
+    if (raw === null) {
+        refuse('the file is absent');
+    }
+    let parsed: unknown;
+    try {
+        parsed = JSON.parse(raw as string);
+    } catch (err) {
+        refuse(`not JSON: ${(err as Error).message}`);
+    }
+    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
+        refuse('the top level is not an object');
+    }
+    const members = (parsed as { members?: unknown }).members;
+    if (members === null || typeof members !== 'object' || Array.isArray(members)) {
+        refuse('`members` is not an object');
+    }
+    const slugs = new Set<string>();
+    for (const [slug, entry] of Object.entries(members as Record<string, unknown>)) {
+        if (!RULE_SLUG_RE.test(slug)) {
+            refuse(`member \`${slug}\` is not a rule slug`);
+        }
+        if (
+            entry === null ||
+            typeof entry !== 'object' ||
+            typeof (entry as { clause?: unknown }).clause !== 'string'
+        ) {
+            refuse(`member \`${slug}\` carries no string \`clause\``);
+        }
+        if (read(`src/rules/${slug}.md`) === null) {
+            refuse(`member \`${slug}\` names no rule file \`src/rules/${slug}.md\``);
+        }
+        slugs.add(slug);
+    }
+    return slugs;
+}
+
+/**
+ * The class as this checkout's working tree states it. The default for a
+ * caller that classifies without naming commits; read on every call and never
+ * cached, so a list changed during a run is never answered from a stale copy.
+ */
+export function consequenceRuleSlugsOfCheckout(root: string = REPO): ReadonlySet<string> {
+    return consequenceRuleSlugsIn((rel) => {
+        try {
+            return fs.readFileSync(path.join(root, rel), 'utf8');
+        } catch {
+            return null;
+        }
+    }, `the checkout \`${root}\``);
+}
+
 /**
@@ -358,2 +460,3 @@ export function isMechanismPath(p: string): boolean {
         p === WORKFLOW_PATH ||
+        p === CONSEQUENCE_CLASS_PATH ||
         ANCHOR_PATHS.includes(p) ||
@@ -367,2 +470,3 @@ export function classifyPaths(
     derived: readonly string[] = derivedPlumbing(),
+    consequence: ReadonlySet<string> = consequenceRuleSlugsOfCheckout(),
 ): GatedPaths {
@@ -372,2 +476,3 @@ export function classifyPaths(
     const plumbing: string[] = [];
+    const consequenceRules: string[] = [];
     let self = false;
@@ -387,2 +492,6 @@ export function classifyPaths(
         }
+        if (m !== null && consequence.has(m[1] ?? '')) {
+            consequenceRules.push(p);
+            continue;
+        }
         if (GOVERNANCE_HOOK_RE.test(p)) {
@@ -395,3 +504,3 @@ export function classifyPaths(
     }
-    return { kernelRules, governanceHooks, plumbing, self };
+    return { kernelRules, governanceHooks, plumbing, consequenceRules, self };
 }
@@ -402,2 +511,3 @@ export function requiresRatification(gated: GatedPaths): boolean {
         gated.kernelRules.length > 0 ||
+        gated.consequenceRules.length > 0 ||
         gated.governanceHooks.length > 0 ||
@@ -465,6 +575,17 @@ function resolveBaseRef(explicit: string | null, root: string): string {
  *
- * THROWS a {@link GatedSubjectRefusal} when the base does not resolve or the
- * object store cannot be read.
+ * THE HIGH-CONSEQUENCE CLASS IS READ FROM THE SAME TWO COMMITS, and its union
+ * is gated. The base side alone would miss a member the change ADDS while
+ * editing that rule — the head's list names it, the base's does not, and its
+ * bytes would sit outside the digest the record carries. The head side alone
+ * would let a change drop a member in order to edit it. In the residue case the
+ * base side is this checkout's working-tree list, as the plumbing base is.
+ *
+ * THROWS a {@link GatedSubjectRefusal} when the base does not resolve, the
+ * object store cannot be read, or the class list cannot be read on either side.
  */
-function derivedFor(root: string, baseRef: string | null, headCommit: string): readonly string[] {
+function gateInputsFor(
+    root: string,
+    baseRef: string | null,
+    headCommit: string,
+): { derived: readonly string[]; consequence: ReadonlySet<string> } {
     const verdictsOf = (tree: ClosureTree): string[] =>
@@ -474,7 +595,16 @@ function derivedFor(root: string, baseRef: string | null, headCommit: string): r
     const head = treeAtRevision(root, headCommit);
+    const headClass = consequenceRuleSlugsIn((rel) => head.read(rel), `commit ${headCommit}`);
     if (baseRef === null && path.resolve(root) !== REPO) {
-        return [...new Set([...derivedPlumbing(), ...verdictsOf(head), ...closureArrivals(head)])];
+        return {
+            derived: [...new Set([...derivedPlumbing(), ...verdictsOf(head), ...closureArrivals(head)])],
+            consequence: new Set([...consequenceRuleSlugsOfCheckout(), ...headClass]),
+        };
     }
-    const base = treeAtRevision(root, resolveRevision(root, resolveBaseRef(baseRef, root)));
-    return [...new Set([...verdictsOf(base), ...verdictsOf(head), ...closureArrivals(head, base)])];
+    const baseCommit = resolveRevision(root, resolveBaseRef(baseRef, root));
+    const base = treeAtRevision(root, baseCommit);
+    const baseClass = consequenceRuleSlugsIn((rel) => base.read(rel), `commit ${baseCommit}`);
+    return {
+        derived: [...new Set([...verdictsOf(base), ...verdictsOf(head), ...closureArrivals(head, base)])],
+        consequence: new Set([...baseClass, ...headClass]),
+    };
 }
@@ -512,3 +642,4 @@ export function expectedSubjectFor(
     const commit = resolveRevision(root, revision);
-    return subjectOf(root, files, derivedFor(root, baseRef, commit), commit);
+    const { derived, consequence } = gateInputsFor(root, baseRef, commit);
+    return subjectOf(root, files, derived, commit, consequence);
 }
@@ -542,2 +673,3 @@ export function evaluate(
     let derived: readonly string[];
+    let consequence: ReadonlySet<string>;
     let headCommit: string;
@@ -545,3 +677,3 @@ export function evaluate(
         headCommit = resolveRevision(root, revision);
-        derived = derivedFor(root, baseRef, headCommit);
+        ({ derived, consequence } = gateInputsFor(root, baseRef, headCommit));
     } catch (err) {
@@ -552,3 +684,6 @@ export function evaluate(
         for (const target of ledger.unaccountedTargets()) {
-            ledger.fail(target, 'the dispatcher closure could not be read at the named commits');
+            ledger.fail(
+                target,
+                'the dispatcher closure or the high-consequence class could not be read at the named commits',
+            );
         }
@@ -558,5 +693,6 @@ export function evaluate(
     }
-    const gated = classifyPaths(files, derived);
+    const gated = classifyPaths(files, derived, consequence);
     const gatedSet = new Set<string>([
         ...gated.kernelRules,
+        ...gated.consequenceRules,
         ...gated.governanceHooks,
@@ -609,3 +745,9 @@ export function evaluate(
     try {
-        ({ digest: expectedSubject, revision: commit } = subjectOf(root, files, derived, headCommit));
+        ({ digest: expectedSubject, revision: commit } = subjectOf(
+            root,
+            files,
+            derived,
+            headCommit,
+            consequence,
+        ));
     } catch (err) {
@@ -634,4 +776,4 @@ export function evaluate(
         lines.push(
-            '✅  no kernel rule, governance hook, hook-plumbing source or self edit in the ' +
-                'diff — nothing to ratify',
+            '✅  no kernel rule, high-consequence rule, governance hook, hook-plumbing source ' +
+                'or self edit in the diff — nothing to ratify',
         );
@@ -643,5 +785,11 @@ export function evaluate(
         ...gated.kernelRules.map((p) => `kernel rule ${p}`),
+        ...gated.consequenceRules.map((p) => `high-consequence rule ${p}`),
         ...gated.governanceHooks.map((p) => `governance hook ${p}`),
         ...gated.plumbing.map((p) => `hook-plumbing source ${p}`),
-        ...(gated.self ? ['the ratification mechanism itself (gate, its imports, policy or workflow)'] : []),
+        ...(gated.self
+            ? [
+                  'the ratification mechanism itself (gate, its imports, policy, workflow or ' +
+                      'the high-consequence rule list)',
+              ]
+            : []),
     ];
diff --git a/src/scripts/classify_merge_risk.ts b/src/scripts/classify_merge_risk.ts
index f3c94ebd4..7fe505b55 100644
--- a/src/scripts/classify_merge_risk.ts
+++ b/src/scripts/classify_merge_risk.ts
@@ -396,6 +396,13 @@ export function classifyChanges(entries: readonly ChangeEntry[], opts: ClassifyO
     if (requiresRatification(gated)) {
-        const gatedPaths = [...gated.kernelRules, ...gated.governanceHooks, ...gated.plumbing];
+        // The high-consequence class is listed: without it a PR touching only
+        // such a rule would carry this reason with no path named under it.
+        const gatedPaths = [
+            ...gated.kernelRules,
+            ...gated.consequenceRules,
+            ...gated.governanceHooks,
+            ...gated.plumbing,
+        ];
         add(
             'governance-surface',
-            'check_kernel_edit_ratified — kernel rule, governance hook, hook plumbing or the ratification mechanism',
+            'check_kernel_edit_ratified — kernel rule, high-consequence rule, governance hook, hook plumbing or the ratification mechanism',
             gatedPaths.length > 0 ? gatedPaths : all.filter((p) => classifyPaths([p]).self),
diff --git a/tests/scripts/check_kernel_edit_ratified_consequence_class.test.ts b/tests/scripts/check_kernel_edit_ratified_consequence_class.test.ts
new file mode 100644
index 000000000..e99a8a755
--- /dev/null
+++ b/tests/scripts/check_kernel_edit_ratified_consequence_class.test.ts
@@ -0,0 +1,236 @@
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+
+import { afterEach, beforeEach, describe, expect, it } from 'vitest';
+
+import * as gate from '../../src/scripts/check_kernel_edit_ratified.js';
+import { CLASS_CONFIG_REL } from '../../src/scripts/_lib/rule_consequence_class.js';
+import { ConsequenceClassUnreadable } from '../../src/scripts/_lib/ratification_subject.js';
+import { RATIFICATION_DIR } from '../../src/scripts/_lib/ratification_artifact.js';
+import { commitAll } from './ratification_git_fixture.js';
+
+/**
+ * Step 4.2 — rule law beyond the nine kernel rules.
+ *
+ * The 2026-10-19 attempt was refused 2/2 on two dealbreakers, and each has its
+ * own describe block here: the list failed OPEN (an unreadable list became an
+ * empty class and the gate exited 0), and membership was read from one side
+ * only, so a change that ADDED a member while editing that rule left the
+ * rule's bytes outside the digest its record carried.
+ */
+
+const LIST = gate.CONSEQUENCE_CLASS_PATH;
+const ALPHA = 'src/rules/alpha.md';
+const BETA = 'src/rules/beta.md';
+
+let root: string;
+
+function write(rel: string, body: string): void {
+    const abs = path.join(root, rel);
+    fs.mkdirSync(path.dirname(abs), { recursive: true });
+    fs.writeFileSync(abs, body);
+}
+
+function listOf(...slugs: string[]): string {
+    const members: Record<string, { clause: string }> = {};
+    for (const s of slugs) members[s] = { clause: 'authority-bypass' };
+    return `${JSON.stringify({ members }, null, 2)}\n`;
+}
+
+function reader(files: Record<string, string>): (rel: string) => string | null {
+    return (rel) => (Object.prototype.hasOwnProperty.call(files, rel) ? (files[rel] as string) : null);
+}
+
+function unreadable(files: Record<string, string>): string {
+    try {
+        gate.consequenceRuleSlugsIn(reader(files), 'the fixture');
+    } catch (err) {
+        expect(err).toBeInstanceOf(ConsequenceClassUnreadable);
+        return (err as Error).message;
+    }
+    throw new Error('expected a refusal');
+}
+
+function record(name: string, subject: string): string {
+    const rel = path.join(RATIFICATION_DIR, name);
+    write(
+        rel,
+        [
+            '---',
+            'proposed_by: claude/session-a',
+            'implemented_by: claude/session-a',
+            'reviewed_by: council/anthropic+openai',
+            `subject: ${subject}`,
+            'verdict: ratified',
+            'effective_after: merge',
+            'providers:',
+            '  - anthropic',
+            '  - openai',
+            'seats:',
+            '  anthropic: ratified',
+            '  openai: ratified',
+            '---',
+            '',
+            '<!-- evidence-type: ratification -->',
+            '',
+            'Review body.',
+            '',
+        ].join('\n'),
+    );
+    return rel;
+}
+
+beforeEach(() => {
+    root = fs.mkdtempSync(path.join(os.tmpdir(), 'kercc-'));
+    write(LIST, listOf('alpha'));
+    write(ALPHA, 'alpha law\n');
+    write(BETA, 'beta law\n');
+});
+
+afterEach(() => {
+    fs.rmSync(root, { recursive: true, force: true });
+});
+
+describe('the list path and the watch list', () => {
+    it('names the same file the class library reads', () => {
+        expect(LIST).toBe(CLASS_CONFIG_REL);
+    });
+
+    it('the list is a mechanism path; the schema that states the criterion is not', () => {
+        expect(gate.isMechanismPath(LIST)).toBe(true);
+        expect(gate.classifyPaths([LIST], [], new Set()).self).toBe(true);
+        // The gate never reads the schema, so it changes no membership.
+        expect(gate.isMechanismPath('src/scripts/schemas/rule.schema.json')).toBe(false);
+    });
+});
+
+describe('classification', () => {
+    const cls = new Set(['alpha', 'commit-policy']);
+
+    it('a member outside the kernel is a high-consequence rule, as source and as projection', () => {
+        expect(gate.classifyPaths([ALPHA], [], cls).consequenceRules).toEqual([ALPHA]);
+        expect(gate.classifyPaths(['.claude/rules/alpha.md'], [], cls).consequenceRules).toEqual([
+            '.claude/rules/alpha.md',
+        ]);
+        expect(gate.requiresRatification(gate.classifyPaths([ALPHA], [], cls))).toBe(true);
+    });
+
+    it('a rule outside the class is not gated', () => {
+        const g = gate.classifyPaths([BETA], [], cls);
+        expect(g.consequenceRules).toEqual([]);
+        expect(gate.requiresRatification(g)).toBe(false);
+    });
+
+    it('a kernel rule in the class is still reported as a kernel rule', () => {
+        const g = gate.classifyPaths(['src/rules/commit-policy.md'], [], cls);
+        expect(g.kernelRules).toEqual(['src/rules/commit-policy.md']);
+        expect(g.consequenceRules).toEqual([]);
+    });
+
+    it('the real class of this checkout reaches a member beyond the kernel', () => {
+        expect(gate.classifyPaths(['src/rules/tool-safety.md'], []).consequenceRules).toEqual([
+            'src/rules/tool-safety.md',
+        ]);
+    });
+});
+
+describe('dealbreaker 1 — the list fails CLOSED', () => {
+    const rules = { [ALPHA]: 'x', [BETA]: 'y' };
+
+    it('a valid list reads as its members, and an empty one as empty', () => {
+        expect([...gate.consequenceRuleSlugsIn(reader({ ...rules, [LIST]: listOf('alpha', 'beta') }), 'f')]).toEqual([
+            'alpha',
+            'beta',
+        ]);
+        expect(gate.consequenceRuleSlugsIn(reader({ [LIST]: listOf() }), 'f').size).toBe(0);
+    });
+
+    it.each([
+        ['absent', {}, 'absent'],
+        ['not JSON', { [LIST]: '{ members: ' }, 'not JSON'],
+        ['a top level that is an array', { [LIST]: '[]' }, 'top level'],
+        ['members missing', { [LIST]: '{}' }, '`members`'],
+        ['members an array', { [LIST]: '{"members": ["alpha"]}' }, '`members`'],
+        ['a key that is not a slug', { ...rules, [LIST]: '{"members": {"Alpha_1": {"clause": "x"}}}' }, 'not a rule slug'],
+        ['a __proto__ key', { ...rules, [LIST]: '{"members": {"__proto__": {"clause": "x"}}}' }, 'not a rule slug'],
+        ['an entry with no clause', { ...rules, [LIST]: '{"members": {"alpha": {}}}' }, 'no string `clause`'],
+        ['a member with no rule file', { [LIST]: listOf('ghost') }, 'names no rule file'],
+    ])('%s is a refusal, never an empty class', (_name, files, detail) => {
+        expect(unreadable(files as Record<string, string>)).toContain(detail);
+    });
+
+    it('the gate refuses a diff whose head list is unreadable, even one gating nothing else', () => {
+        const base = commitAll(root);
+        write(LIST, '{ broken');
+        write('docs/note.md', 'prose\n');
+        commitAll(root);
+        const r = gate.evaluate([LIST, 'docs/note.md'], root, 2, 'HEAD', base);
+        expect(r.exitCode).toBe(1);
+        expect(r.lines.join('\n')).toContain('cannot be read');
+    });
+
+    it('the gate refuses when the BASE list is unreadable', () => {
+        write(LIST, 'not json');
+        const base = commitAll(root);
+        write(LIST, listOf('alpha'));
+        commitAll(root);
+        const r = gate.evaluate(['docs/none.md'], root, 2, 'HEAD', base);
+        expect(r.exitCode).toBe(1);
+        expect(r.lines.join('\n')).toContain(`commit ${base}`);
+    });
+
+    it('polarity: a readable list and an ungated diff pass with nothing to ratify', () => {
+        const base = commitAll(root);
+        write('docs/note.md', 'prose\n');
+        commitAll(root);
+        const r = gate.evaluate(['docs/note.md'], root, 2, 'HEAD', base);
+        expect(r.exitCode, r.lines.join('\n')).toBe(0);
+        expect(r.lines.join('\n')).toContain('nothing to ratify');
+    });
+});
+
+describe('dealbreaker 2 — membership is read at both commits the subject binds to', () => {
+    it('an edit of a member with no record is refused and names the rule', () => {
+        const base = commitAll(root);
+        write(ALPHA, 'alpha law, weakened\n');
+        commitAll(root);
+        const r = gate.evaluate([ALPHA], root, 2, 'HEAD', base);
+        expect(r.exitCode).toBe(1);
+        expect(r.lines.join('\n')).toContain(`high-consequence rule ${ALPHA}`);
+    });
+
+    it('ADDING a member while editing that rule puts the rule inside the digest', () => {
+        const base = commitAll(root);
+        write(LIST, listOf('alpha', 'beta'));
+        write(BETA, 'beta law, edited in the same change\n');
+        commitAll(root);
+        const s = gate.expectedSubjectFor([LIST, BETA], root, 'HEAD', base);
+        expect(s.gatedFiles).toEqual([LIST, BETA]);
+    });
+
+    it('DROPPING a member while editing that rule keeps the rule inside the digest', () => {
+        const base = commitAll(root);
+        write(LIST, listOf());
+        write(ALPHA, 'alpha law, edited once it left the class\n');
+        commitAll(root);
+        const s = gate.expectedSubjectFor([LIST, ALPHA], root, 'HEAD', base);
+        expect(s.gatedFiles).toEqual([LIST, ALPHA]);
+    });
+
+    it('a record bound to that digest passes, and one edit after it turns red', () => {
+        const base = commitAll(root);
+        write(LIST, listOf('alpha', 'beta'));
+        write(BETA, 'beta law, edited in the same change\n');
+        commitAll(root);
+        const rel = record('add-beta.md', gate.expectedSubjectFor([LIST, BETA], root, 'HEAD', base).digest);
+        commitAll(root);
+        const green = gate.evaluate([LIST, BETA, rel], root, 2, 'HEAD', base);
+        expect(green.exitCode, green.lines.join('\n')).toBe(0);
+
+        write(BETA, 'beta law, changed after the review\n');
+        commitAll(root);
+        const red = gate.evaluate([LIST, BETA, rel], root, 2, 'HEAD', base);
+        expect(red.exitCode).toBe(1);
+    });
+});
diff --git a/tests/scripts/classify_merge_risk.test.ts b/tests/scripts/classify_merge_risk.test.ts
index 8bffa3d21..8f3a4d33a 100644
--- a/tests/scripts/classify_merge_risk.test.ts
+++ b/tests/scripts/classify_merge_risk.test.ts
@@ -179,4 +179,8 @@ describe('the gate sees what governs — one case per trigger, each with its nea
     it('a rule in the consequence class fires, as source and as projection; one outside does not', () => {
-        expect(governs([mod('src/rules/tool-safety.md')])).toEqual(['consequence-class-rule']);
-        expect(governs([mod('dist/agent-src/rules/tool-safety.md')])).toEqual(['consequence-class-rule']);
+        // Also `governance-surface`: the ratification gate gates the class.
+        expect(governs([mod('src/rules/tool-safety.md')])).toEqual(['governance-surface', 'consequence-class-rule']);
+        expect(governs([mod('dist/agent-src/rules/tool-safety.md')])).toEqual([
+            'governance-surface',
+            'consequence-class-rule',
+        ]);
         expect(governs([mod('src/rules/markdown-safe-codeblocks.md')])).toEqual([]);
diff --git a/tests/scripts/classify_merge_risk_base_revision.test.ts b/tests/scripts/classify_merge_risk_base_revision.test.ts
index 7162e1051..13b3acc74 100644
--- a/tests/scripts/classify_merge_risk_base_revision.test.ts
+++ b/tests/scripts/classify_merge_risk_base_revision.test.ts
@@ -148,3 +148,3 @@ describe('the code that classes a change is not the change’s own', () => {
                 '): GatedPaths {\n    const derivedSet',
-                '): GatedPaths {\n    if (files.length >= 0) return { kernelRules: [], governanceHooks: [], plumbing: [], self: false };\n    const derivedSet',
+                '): GatedPaths {\n    if (files.length >= 0) return { kernelRules: [], governanceHooks: [], plumbing: [], consequenceRules: [], self: false };\n    const derivedSet',
             ),
diff --git a/tests/scripts/classify_merge_risk_needs_owner.test.ts b/tests/scripts/classify_merge_risk_needs_owner.test.ts
index 3b5faba0e..1a9f38456 100644
--- a/tests/scripts/classify_merge_risk_needs_owner.test.ts
+++ b/tests/scripts/classify_merge_risk_needs_owner.test.ts
@@ -82,4 +82,8 @@ describe('the near-misses stay where they were', () => {
 
-    it('a consequence-class rule alone is needs-council, not needs-owner', () => {
-        expect(verdict('src/rules/tool-safety.md')).toBe('needs-council');
+    it('a consequence-class rule alone is needs-owner, a rule outside the class is not', () => {
+        // Step 4.2 of the self-modification roadmap puts the class on the
+        // ratification gate's surface, and ADR-281 § Amendment makes a council
+        // verdict on that surface advisory until the owner binds to its digest.
+        expect(verdict('src/rules/tool-safety.md')).toBe('needs-owner');
+        expect(verdict('src/rules/markdown-safe-codeblocks.md')).not.toBe('needs-owner');
     });
diff --git a/tests/scripts/ratification_git_fixture.ts b/tests/scripts/ratification_git_fixture.ts
index dee8e964b..53b9c6155 100644
--- a/tests/scripts/ratification_git_fixture.ts
+++ b/tests/scripts/ratification_git_fixture.ts
@@ -52,2 +52,10 @@ function git(root: string, args: readonly string[]): string {
 
+/**
+ * The high-consequence rule list the gate reads at every commit it judges and
+ * refuses without. A fixture that does not write its own gets an EMPTY class
+ * at its first commit, so the gate it exercises judges the fixture's diff
+ * rather than refusing the fixture for lacking a list.
+ */
+const CONSEQUENCE_LIST_REL = 'src/config/rule-consequence-class.json';
+
 /** Stage everything under `root` and commit it; returns the new commit id. */
@@ -56,2 +64,7 @@ export function commitAll(root: string, message = 'fixture'): string {
         git(root, ['init', '-q']);
+        const list = path.join(root, CONSEQUENCE_LIST_REL);
+        if (!fs.existsSync(list)) {
+            fs.mkdirSync(path.dirname(list), { recursive: true });
+            fs.writeFileSync(list, '{"members": {}}\n');
+        }
     }
```
