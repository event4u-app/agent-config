<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-20 for branch drain/road-to-one-detector-senders-20261020,
     committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/road-to-one-detector-senders-20261020, part B2 (mutation gate, census) — consumers read the shared shapes, two gates, the sender census

Roadmap `road-to-one-detector-and-the-senders-we-own`, steps 2.7, 2.6 (three of four
mutations) and 3.4.

What the delta does:

- **2.7.** The rule table gains `ASSIGNMENT_KEYWORDS` with an `assignmentPattern`
  builder, `AUTHORIZATION_HEADER` and `CLASS_SPELLED_PREFIXES` (part A's diff shows
  the table). Seven consumers rebuild their keyword-assignment regexes from them,
  each keeping its own keyword set, order and value threshold; every rebuilt regex is
  the pre-move spelling byte for byte, which the legacy-superset suite asserts where a
  consumer exposes the regex and asserts as behaviour where it does not. The
  low-impact redactor rides in the dispatch bundle, so it reads its one keyword
  through the generated projection `egress_prefixes.ts`, equality-tested against the
  table. `check_credential_spelling` now also refuses a class or alternation spelling
  that expands to a declared prefix and a keyword-assignment shape (a table keyword
  beside the `[:=]` operator class on one line) outside the table; run over the
  `origin/main` copies of the seven files it flags all eight pre-move lines.
- **2.6.** `check_egress_mutations` copies the three engine modules into a scratch
  directory per recipe and requires the recipe's invariant to hold on the unmutated
  copy and fail on the mutated one. Recipes under `src/config/egress-mutations/`:
  class precedence swapped, a credential token that restores, a raw value in the
  count record. Registered in `src/config/gate-coverage.yml` with a create-only canary
  that plants a recipe changing nothing; `--self-test` rejects a surviving, a stale
  and an unknown recipe. The fourth mutation (IBAN checksum) waits for an IBAN row.
- **3.4.** Every sender module carries an `egress-content:` marker; the census gains
  `coverage` and `reason` columns (2 asserted, 6 fixed-corpus, 15 uncovered, 0
  undeclared). `asserted` is accepted only from a module that imports the final check;
  the census CLI refuses an undeclared sender even with `--write`. The census runs as
  a test in CI, not as a registered gate.

Tests (quoted below, abridged where noted): the legacy-superset additions, the
census tests, the mutation-gate test. `check_credential_spelling --self-test` 8/8,
`check_egress_mutations --self-test` 4/4, `check_gate_coverage` and
`check_ci_local_parity` pass.

## Scope of this review

The branch `drain/road-to-one-detector-senders-20261020` at `ae7e01c2f` (`git diff origin/main...ae7e01c2f`) is reviewed in two
prompts and then four, because one passes the council's input ceiling and two
(about 49 KB each) timed out at both seats twice: A1 the engine and dispatcher, A2
the council channel, B1 the consumers that read the rule table and the spelling
gate, B2 the mutation gate and the sender census. Each part states the whole
change; review the part's diff in that context. Each prompt carries its source diff in full
at one line of context. Left out of both, and available on the branch: the roadmap,
the contract and threat-model prose, the census table regenerated into the contract,
fourteen media adapters and nine sender modules whose only change is one
`egress-content:` marker comment line, the Taskfile and workflow wiring of the new
gate, and test files not quoted below (named with what they assert).

The ratification gate classifies three files of this diff as hook-plumbing source:
`src/scripts/_lib/egress_rules.ts`, `src/scripts/_lib/egress_text.ts` and
`src/scripts/hooks/dispatch_hook.ts`. The rest is reviewed because it is the same
change.

Review the delta for defects in security, architecture and behaviour. For each
finding give file:line, the scenario in which it goes wrong, and a severity. Then
classify the authority question as a trade-off you weigh: does this change widen
what any refusing surface refuses, what leaves for a provider, or what an agent may
do — `authority-expanding` or `non-expanding` — and why. State your stance (APPROVE
or REQUEST_CHANGES) and the single highest-leverage change.

## Source diff, part B2

```diff
diff --git a/src/config/egress-mutations/class-precedence-swapped.json b/src/config/egress-mutations/class-precedence-swapped.json
new file mode 100644
index 000000000..16320ece8
--- /dev/null
+++ b/src/config/egress-mutations/class-precedence-swapped.json
@@ -0,0 +1,7 @@
+{
+    "mutation": "class-precedence-swapped",
+    "module": "src/scripts/_lib/egress_rules.ts",
+    "find": "const CLASS_RANK: Readonly<Record<EgressClass, number>> = {\n    credential: 1,\n    identifier: 0,\n};",
+    "replace": "const CLASS_RANK: Readonly<Record<EgressClass, number>> = {\n    credential: 0,\n    identifier: 1,\n};",
+    "killed_by": "credential-outranks-identifier"
+}
diff --git a/src/config/egress-mutations/credential-token-restores.json b/src/config/egress-mutations/credential-token-restores.json
new file mode 100644
index 000000000..fbaffd397
--- /dev/null
+++ b/src/config/egress-mutations/credential-token-restores.json
@@ -0,0 +1,7 @@
+{
+    "mutation": "credential-token-restores",
+    "module": "src/scripts/_lib/egress_token.ts",
+    "find": "this.byToken.set(token, { entry, value: cls === 'identifier' ? spelling : null });",
+    "replace": "this.byToken.set(token, { entry, value: spelling });",
+    "killed_by": "credential-token-never-restores"
+}
diff --git a/src/config/egress-mutations/raw-value-in-the-count-record.json b/src/config/egress-mutations/raw-value-in-the-count-record.json
new file mode 100644
index 000000000..0a2132741
--- /dev/null
+++ b/src/config/egress-mutations/raw-value-in-the-count-record.json
@@ -0,0 +1,7 @@
+{
+    "mutation": "raw-value-in-the-count-record",
+    "module": "src/scripts/_lib/egress_text.ts",
+    "find": "found.push({ class: span.class, type: span.type });",
+    "replace": "found.push({ class: span.class, type: span.type, value: text.slice(span.start, span.end) } as never);",
+    "killed_by": "tally-carries-no-value"
+}
diff --git a/src/scripts/_lib/egress_sender_scan.ts b/src/scripts/_lib/egress_sender_scan.ts
index 8db80e347..d2183a427 100644
--- a/src/scripts/_lib/egress_sender_scan.ts
+++ b/src/scripts/_lib/egress_sender_scan.ts
@@ -19,5 +19,14 @@ export type SenderStatus = 'sender' | 'local' | 'unclassified';
 
-/** `undeclared` until the module carries an `egress-content:` marker (step 3.4 declares them). */
+/** `undeclared` until the module carries an `egress-content:` marker. */
 export type SenderContent = 'session-content' | 'fixed-corpus' | 'undeclared';
 
+/**
+ * What the contract may publish for the module (step 3.4): `asserted` — its
+ * requests pass the replacement and the final check; `fixed-corpus` — it sends
+ * a corpus this package fixed, never session content; `uncovered` — it may send
+ * session content unchecked, for the stated reason. `undeclared` is no answer
+ * and fails the census.
+ */
+export type SenderCoverage = 'asserted' | 'fixed-corpus' | 'uncovered' | 'undeclared';
+
 export interface SenderRow {
@@ -32,2 +41,5 @@ export interface SenderRow {
     readonly evidence: string;
+    readonly coverage: SenderCoverage;
+    /** Why the module has that coverage, as its marker states it; for `undeclared`, what is missing. */
+    readonly reason: string;
 }
@@ -92,3 +104,8 @@ const SEND_SHAPES: readonly RegExp[] = [
 const URL_HOST = /https?:\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)+|localhost)(?=[:/'"`\s)]|$)/gi;
-const CONTENT_MARKER = /(?:\/\/|#)\s*egress-content:\s*(session-content|fixed-corpus)\b/;
+// `egress-content: fixed-corpus — <reason>`, or `egress-content: session-content
+// asserted|uncovered — <reason>`. The reason is the claim a reviewer checks.
+const CONTENT_MARKER =
+    /(?:\/\/|#)\s*egress-content:\s*(session-content|fixed-corpus)\b(?:[ \t]+(asserted|uncovered)\b)?(?:[ \t]*(?:—|--)[ \t]*(\S[^\n]*))?/;
+// `asserted` is a claim about the final check, so the module must reach it.
+const FINAL_CHECK_IMPORT = /import\s*\{[^}]*\bcouncilEgress\b[^}]*\}\s*from\s+['"][^'"]*council_egress(?:\.js)?['"]/;
 // Passing the engine means importing a function that detects or replaces; a
@@ -141,2 +158,23 @@ function walk(abs: string, repoRoot: string, out: string[]): void {
 
+function coverageOf(
+    marker: RegExpExecArray | null,
+    reachesFinalCheck: boolean,
+): { coverage: SenderCoverage; reason: string } {
+    if (marker === null) return { coverage: 'undeclared', reason: 'no `egress-content:` marker' };
+    const reason = (marker[3] ?? '').trim();
+    if (reason === '') return { coverage: 'undeclared', reason: 'the marker states no reason' };
+    if (marker[1] === 'fixed-corpus') {
+        return marker[2] === undefined
+            ? { coverage: 'fixed-corpus', reason }
+            : { coverage: 'undeclared', reason: 'a fixed corpus takes no coverage word' };
+    }
+    if (marker[2] === 'uncovered') return { coverage: 'uncovered', reason };
+    if (marker[2] === 'asserted') {
+        return reachesFinalCheck
+            ? { coverage: 'asserted', reason }
+            : { coverage: 'undeclared', reason: 'claims `asserted` but does not import the final check' };
+    }
+    return { coverage: 'undeclared', reason: 'session content without `asserted` or `uncovered`' };
+}
+
 export function classifyModule(rel: string, src: string): SenderRow | null {
@@ -155,4 +193,6 @@ export function classifyModule(rel: string, src: string): SenderRow | null {
     const sends = adapter || SEND_SHAPES.some((re) => re.test(src));
-    const content = (CONTENT_MARKER.exec(src)?.[1] as SenderContent | undefined) ?? 'undeclared';
+    const marker = CONTENT_MARKER.exec(src);
+    const content = (marker?.[1] as SenderContent | undefined) ?? 'undeclared';
     const engine = ENGINE_IMPORT.test(src);
+    const { coverage, reason } = coverageOf(marker, FINAL_CHECK_IMPORT.test(src));
     const row = (endpoints: Set<string>, status: SenderStatus, evidence: string): SenderRow => ({
@@ -164,2 +204,4 @@ export function classifyModule(rel: string, src: string): SenderRow | null {
         evidence,
+        coverage,
+        reason,
     });
@@ -197,2 +239,7 @@ export function scanSenders(repoRoot: string): SenderRow[] {
 
+/** Rows the census refuses: a sender with no answer. */
+export function undeclared(rows: readonly SenderRow[]): SenderRow[] {
+    return rows.filter((r) => r.coverage === 'undeclared');
+}
+
 export function tally(rows: readonly SenderRow[]): Record<SenderStatus, number> {
@@ -205,4 +252,4 @@ export function renderTable(rows: readonly SenderRow[]): string {
     const lines = [
-        '| module | endpoint | content | engine | status | evidence |',
-        '|---|---|---|---|---|---|',
+        '| module | endpoint | content | engine | status | evidence | coverage | reason |',
+        '|---|---|---|---|---|---|---|---|',
     ];
@@ -211,3 +258,4 @@ export function renderTable(rows: readonly SenderRow[]): string {
         lines.push(
-            `| \`${r.module}\` | ${endpoints} | ${r.content} | ${r.engine ? 'yes' : 'no'} | **${r.status}** | ${r.evidence} |`,
+            `| \`${r.module}\` | ${endpoints} | ${r.content} | ${r.engine ? 'yes' : 'no'} | **${r.status}** | ${r.evidence} | ` +
+                `**${r.coverage}** | ${r.reason.replace(/\|/g, '\\|')} |`,
         );
@@ -216,5 +264,9 @@ export function renderTable(rows: readonly SenderRow[]): string {
     lines.push('');
+    const c = { asserted: 0, 'fixed-corpus': 0, uncovered: 0, undeclared: 0 };
+    for (const r of rows) c[r.coverage] += 1;
     lines.push(
         `${String(rows.length)} module(s): ${String(t.sender)} sender, ${String(t.local)} local, ` +
-            `${String(t.unclassified)} unclassified.`,
+            `${String(t.unclassified)} unclassified; coverage ${String(c.asserted)} asserted, ` +
+            `${String(c['fixed-corpus'])} fixed-corpus, ${String(c.uncovered)} uncovered, ` +
+            `${String(c.undeclared)} undeclared.`,
     );
diff --git a/src/scripts/check_egress_mutations.ts b/src/scripts/check_egress_mutations.ts
new file mode 100644
index 000000000..69d4687e1
--- /dev/null
+++ b/src/scripts/check_egress_mutations.ts
@@ -0,0 +1,215 @@
+#!/usr/bin/env tsx
+/**
+ * The egress engine's invariants survive no listed mutation
+ * (road-to-one-detector-and-the-senders-we-own 2.6).
+ *
+ * Every recipe under `src/config/egress-mutations/` names one engine module, a
+ * `find` text that must occur in it exactly once, its `replace`, and the
+ * invariant that must kill it. For each recipe the three engine modules
+ * (`egress_rules`, `egress_token`, `egress_text`) are copied into a scratch
+ * directory — never edited in place — and the invariant is run twice: on the
+ * unmutated copy, where it must hold, and on the mutated copy, where it must
+ * fail. A recipe whose mutation survives, whose `find` text is gone, or whose
+ * invariant fails on the unmutated engine fails the gate.
+ *
+ * Exit: 0 every mutation killed · 1 a mutation survived or a recipe is stale.
+ */
+
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+import { fileURLToPath, pathToFileURL } from 'node:url';
+
+import type * as Rules from './_lib/egress_rules.js';
+import type * as Text from './_lib/egress_text.js';
+import type * as Token from './_lib/egress_token.js';
+import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
+import { reportScanned } from './_lib/scan_scope.js';
+
+const GATE = 'check_egress_mutations';
+const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
+export const RECIPE_DIR = 'src/config/egress-mutations';
+export const ENGINE_MODULES: readonly string[] = [
+    'src/scripts/_lib/egress_rules.ts',
+    'src/scripts/_lib/egress_token.ts',
+    'src/scripts/_lib/egress_text.ts',
+];
+
+export interface Recipe {
+    readonly mutation: string;
+    readonly module: string;
+    readonly find: string;
+    readonly replace: string;
+    readonly killed_by: string;
+}
+
+interface EngineMods {
+    readonly rules: typeof Rules;
+    readonly token: typeof Token;
+    readonly text: typeof Text;
+}
+
+// Built at runtime so no credential literal sits in this file.
+const PAT = ['ghp', 'Qw3Er5Ty7Ui9Op2As4Df6Gh8Jk1Lz3Xc5Vb7'].join('_');
+
+/** Each returns true when the invariant holds on the engine it is given. */
+export const INVARIANTS: Readonly<Record<string, (m: EngineMods) => boolean>> = {
+    'credential-outranks-identifier': (m) => {
+        const kept = m.rules.resolveOverlaps([
+            { rule: 'id', type: 'EMAIL', class: 'identifier', start: 0, end: 20, validated: true },
+            { rule: 'cred', type: 'TOKEN', class: 'credential', start: 5, end: 10, validated: false },
+        ]);
+        return kept.length === 1 && kept[0]?.class === 'credential';
+    },
+    'credential-token-never-restores': (m) => {
+        const scope = new m.token.TokenScope();
+        const out = m.token.replaceValues(`key ${PAT} here`, scope);
+        const tokens = m.token.parseTokens(out);
+        return tokens.length === 1 && tokens.every((t) => scope.resolve(out.slice(t.start, t.end)) === null);
+    },
+    'tally-carries-no-value': (m) => {
+        const tally = m.text.tallyText(`key ${PAT} here`);
+        return tally.found.length === 1 && !JSON.stringify(tally).includes(PAT);
+    },
+};
+
+export function readRecipes(root: string): Recipe[] {
+    const dir = path.join(root, RECIPE_DIR);
+    if (!fs.existsSync(dir)) return [];
+    return fs
+        .readdirSync(dir)
+        .filter((f) => f.endsWith('.json'))
+        .sort()
+        .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as Recipe);
+}
+
+async function loadEngine(root: string, mutate?: Recipe): Promise<EngineMods> {
+    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'egress-mutation-'));
+    for (const rel of ENGINE_MODULES) {
+        let src = fs.readFileSync(path.join(root, rel), 'utf-8');
+        if (mutate !== undefined && rel === mutate.module) src = src.replace(mutate.find, () => mutate.replace);
+        fs.writeFileSync(path.join(tmp, path.basename(rel)), src);
+    }
+    const at = (name: string): string => pathToFileURL(path.join(tmp, name)).href;
+    return {
+        rules: (await import(at('egress_rules.ts'))) as EngineMods['rules'],
+        token: (await import(at('egress_token.ts'))) as EngineMods['token'],
+        text: (await import(at('egress_text.ts'))) as EngineMods['text'],
+    };
+}
+
+const holds = (inv: (m: EngineMods) => boolean, m: EngineMods): boolean => {
+    try {
+        return inv(m);
+    } catch {
+        return false;
+    }
+};
+
+/** One finding per recipe that does not do its job; empty when every mutation is killed. */
+export async function findSurvivors(root: string, recipes: readonly Recipe[]): Promise<string[]> {
+    const out: string[] = [];
+    for (const r of recipes) {
+        const inv = INVARIANTS[r.killed_by];
+        if (inv === undefined) {
+            out.push(`${r.mutation}: no invariant named ${r.killed_by}`);
+            continue;
+        }
+        if (!ENGINE_MODULES.includes(r.module)) {
+            out.push(`${r.mutation}: ${r.module} is not an engine module`);
+            continue;
+        }
+        const src = fs.readFileSync(path.join(root, r.module), 'utf-8');
+        if (src.split(r.find).length !== 2) {
+            out.push(`${r.mutation}: its find text does not occur exactly once in ${r.module} — the recipe is stale`);
+            continue;
+        }
+        if (!holds(inv, await loadEngine(root))) {
+            out.push(`${r.mutation}: ${r.killed_by} fails on the unmutated engine`);
+            continue;
+        }
+        if (holds(inv, await loadEngine(root, r))) out.push(`${r.mutation}: survived — ${r.killed_by} still holds`);
+    }
+    return out;
+}
+
+export async function check(root: string): Promise<number> {
+    const recipes = readRecipes(root);
+    reportScanned({ gate: GATE, scanned: recipes.length, units: 'mutation recipe(s)', roots: [RECIPE_DIR] });
+    const survivors = await findSurvivors(root, recipes);
+    if (survivors.length > 0) {
+        process.stderr.write(`❌  ${GATE}: a mutation of the egress engine was not killed:\n`);
+        for (const s of survivors) process.stderr.write(`  · ${s}\n`);
+        return 1;
+    }
+    process.stdout.write(`✅  ${GATE}: every mutation killed (${String(recipes.length)} recipe(s)).\n`);
+    return 0;
+}
+
+function selfTest(): number {
+    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'egress-mutations-selftest-'));
+    const fixture = (name: string, recipes: readonly Recipe[]): string => {
+        const root = path.join(tmp, name);
+        for (const rel of ENGINE_MODULES) {
+            fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
+            fs.copyFileSync(path.join(REPO_ROOT, rel), path.join(root, rel));
+        }
+        fs.mkdirSync(path.join(root, RECIPE_DIR), { recursive: true });
+        recipes.forEach((r, i) => fs.writeFileSync(path.join(root, RECIPE_DIR, `${String(i)}.json`), JSON.stringify(r)));
+        return root;
+    };
+    const real = readRecipes(REPO_ROOT);
+    const first = real[0] as Recipe;
+    const run = (root: string): number => runGateCli(REPO_ROOT, 'src/scripts/check_egress_mutations.ts', ['--root', root], root);
+    try {
+        return runSelfTest({
+            gate: GATE,
+            minCases: 4,
+            minRejectCases: 3,
+            cases: [
+                {
+                    name: 'a mutation that changes nothing survives and is rejected',
+                    expect: 'reject',
+                    run: () => run(fixture('survivor', [{ ...first, mutation: 'noop', replace: first.find }])),
+                },
+                {
+                    name: 'a recipe whose find text is gone is rejected as stale',
+                    expect: 'reject',
+                    run: () => run(fixture('stale', [{ ...first, mutation: 'stale', find: 'no such text in the module' }])),
+                },
+                {
+                    name: 'a recipe naming no known invariant is rejected',
+                    expect: 'reject',
+                    run: () => run(fixture('unknown', [{ ...first, mutation: 'unknown', killed_by: 'no-such-invariant' }])),
+                },
+                {
+                    name: 'the committed recipes are all killed',
+                    expect: 'accept',
+                    run: () => run(fixture('real', real)),
+                },
+            ],
+        });
+    } finally {
+        fs.rmSync(tmp, { recursive: true, force: true });
+    }
+}
+
+export async function main(argv: readonly string[]): Promise<number> {
+    if (argv.includes('--help') || argv.includes('-h')) {
+        process.stdout.write(`usage: ${GATE} [--root DIR] [--self-test]\n`);
+        return 0;
+    }
+    if (argv.includes('--self-test')) return selfTest();
+    const i = argv.indexOf('--root');
+    return check(i === -1 ? REPO_ROOT : (argv[i + 1] ?? REPO_ROOT));
+}
+
+if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
+    main(process.argv.slice(2)).then(
+        (code) => process.exit(code),
+        (exc: unknown) => {
+            process.stderr.write(`${GATE}: ${String(exc)}\n`);
+            process.exit(2);
+        },
+    );
+}
diff --git a/src/scripts/egress_sender_census.ts b/src/scripts/egress_sender_census.ts
index 5bb901f6b..35c4b4d86 100644
--- a/src/scripts/egress_sender_census.ts
+++ b/src/scripts/egress_sender_census.ts
@@ -6,4 +6,8 @@
  *
- *   ./scripts-run src/scripts/egress_sender_census           # exit 1 on drift
+ *   ./scripts-run src/scripts/egress_sender_census           # exit 1 on drift or an undeclared sender
  *   ./scripts-run src/scripts/egress_sender_census --write   # rewrite the region
+ *
+ * Every sender must be `asserted`, `fixed-corpus` or `uncovered` with a reason
+ * (step 3.4); a module with no answer fails the census whether or not the
+ * committed table is current.
  */
@@ -14,3 +18,3 @@ import { fileURLToPath, pathToFileURL } from 'node:url';
 
-import { renderTable, SCAN_ROOTS, scanSenders } from './_lib/egress_sender_scan.js';
+import { renderTable, SCAN_ROOTS, scanSenders, undeclared } from './_lib/egress_sender_scan.js';
 
@@ -34,2 +38,4 @@ export function renderRegion(repoRoot: string): string {
         '(`detect`, `findSpans`, `replaceSpans`, `replaceValues`); importing a table constant does not count.',
+        '`coverage` is what the module\'s marker claims (`asserted` only for a module that imports the final',
+        'check, `council_egress.ts`); `undeclared` fails the census.',
         '',
@@ -59,2 +65,8 @@ export function main(argv: readonly string[] = process.argv.slice(2), repoRoot:
     const region = renderRegion(repoRoot);
+    const missing = undeclared(scanSenders(repoRoot));
+    if (missing.length > 0) {
+        process.stderr.write('egress_sender_census: a sender has no coverage — mark it `egress-content:` with a reason:\n');
+        for (const r of missing) process.stderr.write(`  · ${r.module}: ${r.reason}\n`);
+        if (!argv.includes('--write')) return 1;
+    }
     if (argv.includes('--write')) {
@@ -62,3 +74,3 @@ export function main(argv: readonly string[] = process.argv.slice(2), repoRoot:
         process.stdout.write(`egress_sender_census: wrote ${DOC_REL}\n`);
-        return 0;
+        return missing.length > 0 ? 1 : 0;
     }
```

## Test diff

```diff
diff --git a/src/scripts/_lib/egress_sender_scan.test.ts b/src/scripts/_lib/egress_sender_scan.test.ts
index c16e04373..3ea418787 100644
--- a/src/scripts/_lib/egress_sender_scan.test.ts
+++ b/src/scripts/_lib/egress_sender_scan.test.ts
@@ -8,3 +8,3 @@ import { afterEach, describe, expect, it } from 'vitest';
 import { main } from '../egress_sender_census.js';
-import { classifyModule, scanSenders } from './egress_sender_scan.js';
+import { classifyModule, renderTable, scanSenders, undeclared } from './egress_sender_scan.js';
 
@@ -50,2 +50,47 @@ describe('sender census over this tree', () => {
     });
+
+    it('has no empty cell: every sender is asserted, fixed-corpus or uncovered with a reason (3.4)', () => {
+        expect(undeclared(rows).map((r) => `${r.module}: ${r.reason}`)).toEqual([]);
+        for (const line of renderTable(rows).split('\n').filter((l) => l.startsWith('| `'))) {
+            expect(line.split('|').slice(1, -1).every((cell) => cell.trim() !== '')).toBe(true);
+        }
+    });
+
+    it('publishes the council transports as asserted', () => {
+        const cov = new Map(rows.map((r) => [r.module, r.coverage]));
+        expect(cov.get('src/scripts/ai_council/clients.ts')).toBe('asserted');
+        expect(cov.get('src/scripts/ai_council/api_transport.ts')).toBe('asserted');
+    });
+});
+
+describe('the census gate (3.4)', () => {
+    const SEND = "await fetch('https://api.openai.com/v1/chat', { method: 'POST' });\n";
+    const DOC = '<!-- BEGIN egress-sender-census (generated) -->\n<!-- END egress-sender-census -->\n';
+
+    it('fails a fixture sender with no classification, and passes it once it has one', () => {
+        const root = fixtureRepo({ 'src/scripts/new_sender.ts': SEND, 'docs/contracts/egress-placeholders-v1.md': DOC });
+        expect(main(['--write'], root)).toBe(1);
+        expect(main([], root)).toBe(1);
+        fs.writeFileSync(
+            path.join(root, 'src/scripts/new_sender.ts'),
+            `// egress-content: fixed-corpus — sends one fixed probe\n${SEND}`,
+        );
+        expect(main(['--write'], root)).toBe(0);
+        expect(main([], root)).toBe(0);
+    });
+
+    it('refuses a marker with no reason, a reasonless session claim, and an unproven asserted', () => {
+        const cov = (marker: string) => classifyModule('src/scripts/x.ts', `${marker}\n${SEND}`)?.coverage;
+        expect(cov('// egress-content: fixed-corpus')).toBe('undeclared');
+        expect(cov('// egress-content: session-content — sends the prompt')).toBe('undeclared');
+        expect(cov('// egress-content: session-content asserted — checked')).toBe('undeclared');
+        expect(cov('// egress-content: session-content uncovered — not yet routed')).toBe('uncovered');
+        expect(cov('// egress-content: fixed-corpus uncovered — mixed')).toBe('undeclared');
+        const proven = classifyModule(
+            'src/scripts/x.ts',
+            "// egress-content: session-content asserted — checked before the write\nimport { councilEgress } from '" +
+                `./ai_council/council_egress.js';\n${SEND}`,
+        );
+        expect(proven?.coverage).toBe('asserted');
+    });
 });
diff --git a/tests/scripts/check_egress_mutations.test.ts b/tests/scripts/check_egress_mutations.test.ts
new file mode 100644
index 000000000..37c7ef4b3
--- /dev/null
+++ b/tests/scripts/check_egress_mutations.test.ts
@@ -0,0 +1,36 @@
+/**
+ * road-to-one-detector-and-the-senders-we-own 2.6: every listed mutation of
+ * the egress engine fails an invariant, on a scratch copy.
+ */
+import * as path from 'node:path';
+import { fileURLToPath } from 'node:url';
+
+import { describe, expect, it } from 'vitest';
+
+import { runGateCli } from '../../src/scripts/_lib/gate_self_test.js';
+import { ENGINE_MODULES, INVARIANTS, readRecipes } from '../../src/scripts/check_egress_mutations.js';
+
+const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
+const run = (args: string[]): number => runGateCli(REPO, 'src/scripts/check_egress_mutations.ts', args, REPO);
+
+describe('check_egress_mutations', () => {
+    it('lists the three mutations the roadmap names that exist without identifier rows', () => {
+        expect(readRecipes(REPO).map((r) => r.killed_by).sort()).toEqual([
+            'credential-outranks-identifier',
+            'credential-token-never-restores',
+            'tally-carries-no-value',
+        ]);
+        for (const r of readRecipes(REPO)) {
+            expect(ENGINE_MODULES).toContain(r.module);
+            expect(INVARIANTS[r.killed_by]).toBeTypeOf('function');
+        }
+    });
+
+    it('kills every committed mutation on the tree', () => {
+        expect(run([])).toBe(0);
+    });
+
+    it('rejects a surviving, a stale and an unknown recipe (self-test)', () => {
+        expect(run(['--self-test'])).toBe(0);
+    });
+});
```
