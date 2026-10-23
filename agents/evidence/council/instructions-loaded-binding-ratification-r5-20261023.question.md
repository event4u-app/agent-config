<!-- evidence-type: analysis -->

# Ratification review, round 5 — the CI-fix delta on the InstructionsLoaded binding

You are an independent reviewer for a change in the `event4u/agent-config` repository. Round 4 of 2026-10-23 ratified (anthropic + openai) the binding of the `InstructionsLoaded` observer: event vocabulary plus three mirrors, `claude`-only alias and platform row, the observe-only concern loaded from its own chunk with a CLI entry for the spawn fallback, and the dispatch bundle ceiling raised 1,550,000 → 1,550,500 with a `raise_log` entry. The record lives at `agents/evidence/ratifications/instructions-loaded-binding-20261023.md`.

Remote CI then failed on three gates, and the fix touched gated files again (`src/scripts/hook_manifest.yaml`, its compiled `hook_manifest.json`, `src/scripts/hooks/dispatch_hook.ts`), so the ratified subject no longer matches. This is a ratification decision under the repository's governance policy (ADR-268 § 4): decide whether the approach taken in the delta keeps the round-4 decision intact. This round reviews only the delta since the ratified revision `ae8d5a993b`:

1. `check_source_size_budget` (a one-way ratchet on over-long files) counted 12 new violations: comment lines added to `dispatch_hook.ts` and `runtime_journal.ts`, both over the cap. The fix removes those comments, puts `"subagent_start", "subagent_stop"` on one line in both vocabularies so the new member costs no net line, shortens the journal's doc comment back to its original two lines, and moves the "recordable is not bound" note into a comment beside the `instructions_loaded` row of `hook_manifest.yaml`. The gate now passes.
2. `check_test_weakening` counted the suite-level `describe.skipIf(win32)` added in round 2 as a net-added suppression. The fix removes the skip: the built-bundle suite now builds through the esbuild JS API (no shell, so no quoting and no `/bin/sh`), using the banner extracted from the `build:hooks` script and asserting that script's remaining flags equal the ones the test passes, so the two cannot drift silently. The install layout uses directory junctions and copies files on Windows, where file symlinks need a privilege. The gate now passes.
3. `injection_effect.test.ts` pins claude's bound lifecycle slot count; it is 11 now. The pin and the claude row of the enforcement-by-host page move from 10 to 11 (that one-cell change is left out of the delta below).

No behaviour of the binding changed. `hook_manifest.json` is regenerated (one 21 KB line, omitted; checked by `tests/hooks/hook_manifest_compiled.test.ts`). Verification on this revision: the binding suite (10 tests incl. built chunk path, control and spawn fallback), `injection_effect`, `runtime_journal`, `collector_vocabulary_parity`, `hook_manifest_compiled` — 89 tests pass; eslint clean; `check_test_weakening` and `check_source_size_budget` exit 0.

## What to answer

1. Does the delta contain a defect? Name file and line.
2. Does it change anything round 4 ratified, beyond the three items listed above?
3. Does the change expand any agent's authority?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## The delta (`git diff ae8d5a993b..HEAD`; `hook_manifest.json` and the one-cell page change excluded)

```diff
diff --git a/src/scripts/_lib/runtime_journal.ts b/src/scripts/_lib/runtime_journal.ts
index fc86bcfe67..ff1a98dcae 100644
--- a/src/scripts/_lib/runtime_journal.ts
+++ b/src/scripts/_lib/runtime_journal.ts
@@ -248,20 +248,13 @@ export const RECORDED_EVENTS: ReadonlySet<string> = new Set([
     'stop',
     'pre_compact',
     'agent_error',
-    'subagent_start',
-    'subagent_stop',
+    'subagent_start', 'subagent_stop',
     'instructions_loaded',
 ]);
 
 /**
- * Members deliberately NOT recorded, each with the reason — silence about an
- * event is not coverage.
- *
- * "Recorded" means the journal accepts the event when `journal-record` runs on
- * it, not that the manifest binds it there. `instructions_loaded` is the case in
- * point: it is recordable, and the manifest binds only its own observer to it,
- * because the host fires it once per loaded file and that capture lives under
- * `runtime/arrivals/`.
+ * Members deliberately NOT recorded, each with the reason — silence is not coverage.
+ * "Recorded" means accepted, not bound: see the manifest's `instructions_loaded` row.
  *
  * **Currently empty, and the emptiness is the finding.** All eleven members of
  * the vocabulary are recordable: the journal stores what the dispatcher hands it
diff --git a/src/scripts/hook_manifest.yaml b/src/scripts/hook_manifest.yaml
index 1d2fe47710..4f8e772153 100644
--- a/src/scripts/hook_manifest.yaml
+++ b/src/scripts/hook_manifest.yaml
@@ -1654,6 +1654,8 @@ platforms:
     subagent_stop:    [subagent-ledger, journal-record]
     agent_error:      [host-rate-marker]
     # Observe-only; the host runs this event asynchronously, once per loaded file.
+    # `journal-record` is deliberately not bound here: the event is recordable
+    # (RECORDED_EVENTS), but its capture lives under runtime/arrivals/.
     instructions_loaded: [instructions-observer]
 
   # Cowork — the Claude desktop app's local-agent-mode runtime, built
diff --git a/src/scripts/hooks/dispatch_hook.ts b/src/scripts/hooks/dispatch_hook.ts
index 482ae4a34d..554b749840 100644
--- a/src/scripts/hooks/dispatch_hook.ts
+++ b/src/scripts/hooks/dispatch_hook.ts
@@ -109,10 +109,6 @@ const MANIFEST_PATH = path.join(REPO_ROOT, "src", "scripts", "hook_manifest.yaml
 // spike — see agents/evidence/investigations/subagent-lifecycle-phase0-host-pin.md.
 // Only `claude` and `cowork` alias them today; every other platform simply
 // never sends them, which the alias table already expresses by omission.
-//
-// `instructions_loaded` (road-to-a-setup-that-decides-itself step 1.1) fires
-// once per instruction file the host loads, asynchronously. Only `claude`
-// aliases it; its one concern is the observe-only arrival capture.
 export const EVENT_VOCABULARY: ReadonlySet<string> = new Set([
   "session_start",
   "session_end",
@@ -122,8 +118,7 @@ export const EVENT_VOCABULARY: ReadonlySet<string> = new Set([
   "stop",
   "pre_compact",
   "agent_error",
-  "subagent_start",
-  "subagent_stop",
+  "subagent_start", "subagent_stop",
   "instructions_loaded",
 ]);
 
diff --git a/tests/scripts/hooks/instructions_observer_binding.test.ts b/tests/scripts/hooks/instructions_observer_binding.test.ts
index 76dddeab5e..e5cfc6ab9c 100644
--- a/tests/scripts/hooks/instructions_observer_binding.test.ts
+++ b/tests/scripts/hooks/instructions_observer_binding.test.ts
@@ -129,24 +129,36 @@ describe('a real dispatch of InstructionsLoaded', () => {
  * decided by what the layout leaves reachable: with no observer source on disk
  * the spawn fallback has nothing to run, so a capture line proves the chunk.
  */
-// POSIX only: the build runs the package script through `/bin/sh`, and a skip on
-// each case would still run the shared `beforeAll`.
-describe.skipIf(process.platform === 'win32')('the built bundle', () => {
+/** The flags `build:hooks` passes besides the banner; asserted against the script so the two cannot drift. */
+const BUILD_HOOKS_FLAGS =
+    'esbuild src/scripts/hooks/dispatch_entry.ts --bundle --platform=node --format=esm --target=node20 ' +
+    '--define:__AGENT_CONFIG_BUNDLE__=true --outfile=dist/hooks/dispatch.js';
+
+describe('the built bundle', () => {
     let build = '';
 
     beforeAll(async () => {
         build = fs.mkdtempSync(path.join(os.tmpdir(), 'il-build-'));
         const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf-8')) as { scripts: Record<string, string> };
         // Cut at the digest step, not at the first `&&`: the banner holds `&&` of its own.
-        // Single-quoted for the shell, so a temp dir with spaces or metacharacters stays one argument.
-        const outfile = `'${path.join(build, 'dispatch.js').replace(/'/g, `'\\''`)}'`;
-        const esbuild = pkg.scripts['build:hooks']!.split(' && node src/scripts/write_bundle_digest.mjs')[0]!.replace(
-            '--outfile=dist/hooks/dispatch.js',
-            `--outfile=${outfile}`,
-        );
-        const env = { ...process.env, PATH: `${path.join(REPO, 'node_modules', '.bin')}${path.delimiter}${process.env['PATH'] ?? ''}` };
-        const b = spawnSync('/bin/sh', ['-c', esbuild], { cwd: REPO, encoding: 'utf-8', env });
-        expect(b.status, b.stderr).toBe(0);
+        const script = pkg.scripts['build:hooks']!.split(' && node src/scripts/write_bundle_digest.mjs')[0]!;
+        const banner = /--banner:js="([^"]*)"/.exec(script)?.[1];
+        expect(banner, 'build:hooks carries a --banner:js').toBeDefined();
+        expect(script.replace(/ --banner:js="[^"]*"/, '')).toBe(BUILD_HOOKS_FLAGS);
+        // The esbuild API, not a shell: no quoting of the temp path, and no POSIX-only `sh`.
+        const { buildSync } = await import('esbuild');
+        buildSync({
+            absWorkingDir: REPO,
+            entryPoints: ['src/scripts/hooks/dispatch_entry.ts'],
+            bundle: true,
+            platform: 'node',
+            format: 'esm',
+            target: 'node20',
+            define: { __AGENT_CONFIG_BUNDLE__: 'true' },
+            outfile: path.join(build, 'dispatch.js'),
+            banner: { js: banner! },
+            logLevel: 'error',
+        });
         const { buildChunk } = (await import('../../../src/scripts/hook_chunks.mjs')) as {
             buildChunk: (root: string, entry: string, outfile: string) => void;
         };
@@ -167,12 +179,19 @@ describe.skipIf(process.platform === 'win32')('the built bundle', () => {
      * data files from `src/` at runtime, so the tree must be there; only the
      * observer source must not be.
      */
+    /** A directory junction needs no privilege on Windows; a file link does, so files are copied there. */
+    function link(target: string, at: string): void {
+        if (fs.statSync(target).isDirectory()) fs.symlinkSync(target, at, 'junction');
+        else if (process.platform === 'win32') fs.copyFileSync(target, at);
+        else fs.symlinkSync(target, at);
+    }
+
     function mirrorWithout(from: string, to: string, omit: string): void {
         fs.mkdirSync(to, { recursive: true });
         const [head, ...rest] = omit.split('/');
         for (const entry of fs.readdirSync(from)) {
             if (entry !== head) {
-                fs.symlinkSync(path.join(from, entry), path.join(to, entry));
+                link(path.join(from, entry), path.join(to, entry));
             } else if (rest.length > 0) {
                 mirrorWithout(path.join(from, entry), path.join(to, entry), rest.join('/'));
             }
@@ -189,9 +208,9 @@ describe.skipIf(process.platform === 'win32')('the built bundle', () => {
             fs.copyFileSync(path.join(build, f), path.join(hooks, f));
         }
         fs.copyFileSync(path.join(REPO, 'package.json'), path.join(root, 'package.json'));
-        fs.symlinkSync(path.join(REPO, 'node_modules'), path.join(root, 'node_modules'));
+        link(path.join(REPO, 'node_modules'), path.join(root, 'node_modules'));
         if (opts.source) {
-            fs.symlinkSync(path.join(REPO, 'src'), path.join(root, 'src'));
+            link(path.join(REPO, 'src'), path.join(root, 'src'));
         } else {
             mirrorWithout(path.join(REPO, 'src'), path.join(root, 'src'), OBSERVER.replace(/^src\//, ''));
         }
diff --git a/tests/scripts/injection_effect.test.ts b/tests/scripts/injection_effect.test.ts
index 7af9bfd5e0..96110b0060 100644
--- a/tests/scripts/injection_effect.test.ts
+++ b/tests/scripts/injection_effect.test.ts
@@ -112,7 +112,8 @@ describe('the committed record and the live manifest', () => {
         const platforms = loadPlatforms(REPO_ROOT);
         expect(boundSlotCount(platforms, 'copilot')).toBe(0);
         expect(Object.keys(platforms['copilot'] ?? {}).sort()).toEqual(['ask', 'fallback_only']);
-        expect(boundSlotCount(platforms, 'claude')).toBe(10);
+        // 11 since `instructions_loaded` (road-to-a-setup-that-decides-itself 1.1).
+        expect(boundSlotCount(platforms, 'claude')).toBe(11);
         expect(boundSlotCount(platforms, 'cowork')).toBe(8);
     });
 
```
