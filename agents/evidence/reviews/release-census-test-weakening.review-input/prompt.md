<!-- check-refs: skip -->
Review the test changes in the diff below. The production change removes a step from the release pipeline: `task release-prepare` (in `taskfiles/content.yml`) used to run `report_evidence_temperature --write`, which wrote `agents/evidence/analysis/evidence-temperature-YYYY-MM-DD.md` on every release. The step is removed. With it, the release-PR shape gate (`check_release_pr_shape.ts`) no longer lists that file in `ALLOWLIST_GLOBS`, and the contract `docs/contracts/release-pr-gating.md` no longer enumerates it. The census script itself stays and can still be run by hand.

The test diff net-removes assertions in `tests/scripts/check_release_pr_shape.test.ts`. For each removed or changed assertion, decide whether the removal is legitimate (it asserted behaviour of code that no longer exists, or behaviour that is intentionally reversed) or a weakening (it asserted something that still exists and is no longer covered). Name any behaviour of the remaining code that the new tests fail to cover. Give a verdict per file: LEGITIMATE or WEAKENING, with reasons.

--- production diff ---
diff --git a/docs/contracts/release-pr-gating.md b/docs/contracts/release-pr-gating.md
index e5095764de..531889cf86 100644
--- a/docs/contracts/release-pr-gating.md
+++ b/docs/contracts/release-pr-gating.md
@@ -93,12 +93,11 @@ hold:
    - `agents/evidence/release-findings/*.json` — an optional
      finding-disposition ledger, committed by hand. No release workflow waits
      for it (owner, 2026-10-22: main is already reviewed); the consistency
-     coverage guard still requires any committed ledger to be valid
-   - `agents/evidence/analysis/evidence-temperature-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].md`
-     — the per-release evidence-temperature census written by
-     `taskfiles/content.yml` § `release-prepare`, step 2 of `task release`.
-     The ISO date shape in fnmatch digit classes rather than `?`; the entry in
-     `ALLOWLIST_GLOBS` carries why.
+     coverage guard still requires any committed ledger to be valid.
+     The evidence-temperature census is NOT on this list since 2026-10-28:
+     `release-prepare` no longer writes it, because its header named the HEAD
+     commit and so every new commit on a release branch cost a commit and a
+     full CI cycle that changed nothing.
    - `src/agent-src/templates/agents/agent-project-settings.example.yml`
    - `dist/agent-src/templates/agents/agent-project-settings.example.yml` —
      the project-settings template pin and its regenerated twin, kept in
@@ -112,11 +111,9 @@ hold:
    `.gitignore` globs: `*` becomes `.*` and `?` becomes `.`, both under the `s`
    flag, so each matches a path separator like any other character. Every `*` row
    above therefore admits arbitrary depth — `src/packs/core/installer/pack.yaml`
-   and `agents/evidence/release-findings/a/b/c.json` both pass. And the census
-   row uses digit classes rather than `?` for the same reason: `????-??-??` would
-   admit `evidence-temperature-x/yz-ab-cd.md`, while `[0-9]` cannot match a
-   separator at all. A reader predicting the gate from this list needs both
-   halves; each is pinned in `tests/scripts/check_release_pr_shape.test.ts`.
+   and `agents/evidence/release-findings/a/b/c.json` both pass. A reader
+   predicting the gate from this list needs that; it is pinned in
+   `tests/scripts/check_release_pr_shape.test.ts`.
 
    This list and `ALLOWLIST_GLOBS` are one decision recorded twice, and they
    drifted for months — the contract named `packages/*/pack.yaml` long after
diff --git a/src/scripts/check_release_pr_shape.ts b/src/scripts/check_release_pr_shape.ts
index 23fec05202..ea804e5595 100644
--- a/src/scripts/check_release_pr_shape.ts
+++ b/src/scripts/check_release_pr_shape.ts
@@ -50,16 +50,6 @@ const ALLOWLIST_GLOBS = [
     // may carry one. No release workflow waits for it (2026-10-22); the
     // consistency coverage guard still requires any committed ledger to be valid.
     'agents/evidence/release-findings/*.json',
-    // Evidence-temperature census — `taskfiles/content.yml` § release-prepare
-    // writes one per release, so without this entry the pipeline generates a
-    // file its own shape step refuses. Digit classes rather than `?`: fnmatch
-    // `?` compiles to `.` under the `s` flag, so it matches any character AND
-    // crosses `/` — `????-??-??` admits `evidence-temperature-x/yz-ab-cd.md`,
-    // which `[0-9]` cannot. Two reports can appear in one release PR, and
-    // both are in shape: `--resume` re-runs release-prepare, so a release
-    // carried across UTC midnight writes a second census. What that one
-    // contains is the census's business, not this gate's.
-    'agents/evidence/analysis/evidence-temperature-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].md', // code-comment-allow provenance-comment -- the glob IS this gate's operand, not where the code came from
     // Project-settings template pin — bumped by release.ts set_template_pin and
     // its regenerated dist twin (kept in lockstep with package.json.version).
     'src/agent-src/templates/agents/agent-project-settings.example.yml',
diff --git a/src/scripts/report_evidence_temperature.ts b/src/scripts/report_evidence_temperature.ts
index 7e202ab039..7fd5fd92a3 100644
--- a/src/scripts/report_evidence_temperature.ts
+++ b/src/scripts/report_evidence_temperature.ts
@@ -83,9 +83,7 @@ export function censusDateStamp(now: Date = new Date()): string {
  * the name comes from a constant this module shares — `REPORT_DIR`,
  * `REPORT_PREFIX`, `REPORT_EXT` — or from `censusDateStamp`, and
  * `latestReportBefore` filters on the same two, so discovery and writing cannot
- * drift apart. The release-PR shape gate's test goes through this builder too.
- * Writer and gate holding independent spellings of this name is what broke
- * `task release` for 16.3.0.
+ * drift apart.
  */
 export function defaultReportPath(generatedAt: string): string {
     return path.posix.join(REPORT_DIR, `${REPORT_PREFIX}${generatedAt}${REPORT_EXT}`);
@@ -406,17 +404,13 @@ function mib(bytes: number): string {
 /**
  * The newest existing report other than `exclude`, or null when there is none.
  *
- * `--since latest` resolves through this so the release pipeline needs no date
+ * `--since latest` resolves through this so a caller needs no date
  * arithmetic: the names sort lexicographically because they carry an ISO date,
  * and the file about to be written is excluded so a same-day re-run compares
  * against an earlier report rather than against itself.
  *
- * It picks the newest OTHER report, not the newest report of an earlier
- * release. A release resumed across UTC midnight writes a second census, and
- * that one's baseline is the first census of the same release — so its delta
- * covers minutes, not a release. The heading it renders under says "since the
- * previous report", which is exactly that, so nothing misreports; a reader
- * wanting a release-wide delta compares against the earlier release by hand.
+ * It picks the newest OTHER report, whatever separates the two. The heading
+ * it renders under says "since the previous report", which is exactly that.
  */
 export function latestReportBefore(names: readonly string[], exclude: string): string | null {
     const candidates = names
diff --git a/taskfiles/content.yml b/taskfiles/content.yml
index 2c8f8c7528..89561f893e 100644
--- a/taskfiles/content.yml
+++ b/taskfiles/content.yml
@@ -74,13 +74,6 @@ tasks:
       - task: sync
       - task: build-discovery
       - task: generate-tools
-      # The evidence temperature census, report-only on every release, with the
-      # files newly cold since the previous census named. The council that ruled
-      # on it (2026-10-01, 2/2) put the ceiling here on purpose: becoming cold
-      # triggers no move, no exclusion and no deletion, only a reading. `|| true`
-      # keeps that literal — a census that can fail a release is a gate, and the
-      # ruling was that no gate is warranted at 2.3% of the tree.
-      - ./scripts-run src/scripts/report_evidence_temperature --write --since latest --quiet || true
 
   clean-tools:
     silent: true

--- test diff ---
diff --git a/tests/scripts/check_release_pr_shape.test.ts b/tests/scripts/check_release_pr_shape.test.ts
index 2c78707f09..1caa520636 100644
--- a/tests/scripts/check_release_pr_shape.test.ts
+++ b/tests/scripts/check_release_pr_shape.test.ts
@@ -1,5 +1,4 @@
 
-import { execFileSync } from 'node:child_process';
 import * as fs from 'node:fs';
 import * as path from 'node:path';
 import { fileURLToPath } from 'node:url';
@@ -7,7 +6,6 @@ import { fileURLToPath } from 'node:url';
 import { describe, expect, it } from 'vitest';
 
 import * as shape from '../../src/scripts/check_release_pr_shape.js';
-import { censusDateStamp, defaultReportPath } from '../../src/scripts/report_evidence_temperature.js';
 
 const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
 
@@ -147,50 +145,16 @@ describe('check_release_pr_shape — check() (ported pytest)', () => {
         expect(shape._matches('docs/archive/CHANGELOG-pre-5.4.0.md')).toBe(true);
     });
 
-    it('the evidence-temperature census release-prepare writes passes', () => {
+    it('a stray evidence-temperature census in a release PR fails', () => {
+        // release-prepare no longer writes the census (2026-10-28): its header
+        // named the HEAD commit, so every new commit on a release branch
+        // produced a one-line diff, a commit and a full CI cycle for nothing.
         const { code } = runCheck([
             'package.json',
             'CHANGELOG.md',
             'agents/evidence/analysis/evidence-temperature-2026-10-05.md',
         ]);
-        expect(code).toBe(0);
-    });
-
-    it('the census glob admits the ISO date shape and nothing else under it', () => {
-        expect(shape._matches('agents/evidence/analysis/evidence-temperature-2026-10-05.md')).toBe(true);
-        // Denials the literal stem and the separators already carry — they hold
-        // under any date spelling, so they do NOT measure the digit classes.
-        expect(shape._matches('agents/evidence/analysis/evidence-temperature-anything.md')).toBe(false);
-        expect(shape._matches('agents/evidence/analysis/evidence-temperature-2026-1-5.md')).toBe(false);
-        expect(shape._matches('agents/evidence/analysis/some-other-report.md')).toBe(false);
-        expect(shape._matches('agents/evidence/analysis/nested/evidence-temperature-2026-10-05.md')).toBe(false);
-    });
-
-    it('the census glob denies a non-digit date — the digit classes, measured', () => {
-        // These are the ONLY assertions in this file that go red if `[0-9]` is
-        // relaxed to `?`: a 4-2-2 shape with the right separators and the wrong
-        // character class. Measured, not assumed — the four denials above stay
-        // green under `????-??-??`, so they prove the stem, never the digits.
-        expect(shape._matches('agents/evidence/analysis/evidence-temperature-aaaa-bb-cc.md')).toBe(false);
-        expect(shape._matches('agents/evidence/analysis/evidence-temperature-20z6-10-05.md')).toBe(false);
-        // fnmatch `?` compiles to `.` under the `s` flag and so crosses `/`;
-        // a digit class cannot. This path is the difference.
-        expect(shape._matches('agents/evidence/analysis/evidence-temperature-x/yz-ab-cd.md')).toBe(false);
-    });
-
-    it('the allowlist admits the path the census writer actually produces', () => {
-        // Directory, prefix and extension come from the writer's own builder,
-        // and the day from the writer's own stamping, so a change to any of
-        // them moves this assertion too.
-        expect(shape._matches(defaultReportPath(censusDateStamp()))).toBe(true);
-        expect(shape._matches(defaultReportPath('2026-10-01'))).toBe(true);
-    });
-
-    it('the census date stamp has the shape the allowlist glob was cut for', () => {
-        // The day is a parameter of `defaultReportPath`, so the link above does
-        // not pin its shape. A time component or `YYYYMMDD` reds here.
-        expect(censusDateStamp(new Date(Date.UTC(2026, 9, 5)))).toBe('2026-10-05');
-        expect(shape._matches(defaultReportPath(censusDateStamp(new Date(Date.UTC(2026, 9, 5)))))).toBe(true);
+        expect(code).toBe(1);
     });
 });
 
@@ -285,57 +249,14 @@ describe('check_release_pr_shape — contract/code allowlist parity', () => {
     });
 });
 
-describe('check_release_pr_shape — the census writer/pipeline binding', () => {
-    it('every caller lets the writer choose the path it writes', () => {
-        // `main` prefers `--out` over `defaultReportPath`, so a caller passing
-        // one writes a name no test pins — the 16.3.0 drift class, one step
-        // further out.
-        //
-        // Scans EVERY tracked file. Earlier versions scanned a root list, and
-        // each round found another hole in it: a missing root skipped silently,
-        // extensionless files dropped, top-level files discarded, a parent
-        // marked scanned because one child was a root. A reach claim needs
-        // either a check or no reach claim; `git ls-files` removes the question.
-        const BINARY = /\.(mp4|mov|png|jpg|jpeg|gif|webp|pdf|zip|gz|tgz|ico|woff2?|ttf|mp3|wav)$/i;
-        // `git grep -l` narrows to the files that mention the module before any
-        // read: the tracked tree is ~3.4k files and ~160 MB, and reading all of
-        // it to find one line is cost with no coverage behind it. Still every
-        // tracked file — grep is the index, not a root list. `|| true` because
-        // grep exits 1 on no match, which is a legitimate answer here.
-        const files = execFileSync(
-            'sh',
-            ['-c', "git grep -l 'report_evidence_temperature' -- . || true"],
-            { cwd: REPO_ROOT, encoding: 'utf8' },
-        )
-            .split('\n')
-            .filter((f) => f !== '' && !BINARY.test(f))
-            // Markdown is prose, never an invocation; the module's own file and
-            // the suites that import it name it by definition.
-            .filter((f) => !f.endsWith('.md'))
-            .filter((f) => f !== 'src/scripts/report_evidence_temperature.ts')
-            .filter((f) => !f.startsWith('tests/'))
-            // Review artifacts hold committed diffs of this very file.
-            .filter((f) => !f.startsWith('agents/evidence/'))
-            // The committed code map mirrors every file's name and imports.
-            .filter((f) => !f.startsWith('agents/map/'));
-        // grep found the module somewhere, so an empty set after filtering means
-        // the filters ate everything — which must not read as "no caller".
-        expect(files.length).toBeGreaterThan(0);
-        // Continuations are joined before matching: a shell or YAML call can
-        // carry `--write` on the matched line and `--out` on the next, which a
-        // line-scoped assertion would pass — the drift this test exists to catch.
-        const joinContinuations = (text: string): string[] =>
-            text.replace(/\\\n\s*/g, ' ').split('\n');
-        const invocations = files
-            .filter((f) => fs.existsSync(path.join(REPO_ROOT, f)))
-            .flatMap((f) => joinContinuations(fs.readFileSync(path.join(REPO_ROOT, f), 'utf8')))
-            // Strips a trailing comment before testing, so `foo() // …report…`
-            // and `/* …report… */` are not counted as callers.
-            .map((line) => line.replace(/\/\*.*?\*\//g, '').replace(/(\s|^)(\/\/|#).*$/, '$1'))
-            .filter((line) => /report_evidence_temperature(\.ts)?\b/.test(line))
-            .filter((line) => !/^\s*["']?[\w.-]+["']?\s*:\s*$/.test(line));
-        expect(invocations).toHaveLength(1);
-        expect(invocations[0]).toContain('--write');
-        expect(invocations[0]).not.toContain('--out');
+describe('check_release_pr_shape — the release pipeline writes no census', () => {
+    it('release-prepare does not invoke report_evidence_temperature', () => {
+        const yml = fs.readFileSync(path.join(REPO_ROOT, 'taskfiles/content.yml'), 'utf8');
+        const start = yml.indexOf('\n  release-prepare:');
+        expect(start).toBeGreaterThan(-1);
+        const next = yml.slice(start + 1).search(/\n  [\w:-]+:\n/);
+        const body = next === -1 ? yml.slice(start) : yml.slice(start, start + 1 + next);
+        expect(body).toContain('task: sync');
+        expect(body).not.toMatch(/report_evidence_temperature/);
     });
 });
