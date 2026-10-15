<!-- evidence-type: analysis -->

<!-- The round-5 (delta) prompt given to the council on 2026-10-15 for the danger-gate change,
     committed verbatim so the verdict recorded beside it can be checked against
     what was actually asked. Not edited after the run. -->

# Delta review of the danger-gate change — round 5

Rounds 1 to 4 reviewed the change to `src/scripts/classify_merge_risk.ts`, its tests, and the danger-gate shell block of the merge command; round 4 approved it. No earlier diff is repeated here.

Since then the owner decided (2026-10-15): a change to `package.json` or a lockfile must no longer yield `needs-owner`; it goes to the council (`needs-council`). Everything else that yields `needs-owner` stays, including every anomaly of the base-revision run. The property that motivated the earlier `runtime-unverified` verdict — the base classifier must not run through a head-influenced runtime — is to be kept, with `needs-council` only where the run itself is uncertain, and the residual risk stated.

What this delta does: the classifier gains a `dependency-manifest` trigger (`needs-council`). The shell block first runs the base classifier with `node --experimental-strip-types` and a resolver hook the block writes into its own temporary directory, with no `node_modules`; it falls back to the checkout's `tsx` only where that cannot run, and with a changed manifest it keeps a `needs-owner` from that fallback and otherwise reads `needs-council (runtime-uncertain)`. A `routine` verdict on a manifest change is floored to `needs-council`. `src/scripts/_lib/ratification_subject.ts` loses its parameter properties, which type stripping cannot carry. The command's prose gains a stated residual risk.

Scope: the diff below, from the round-4 head to the new head — the classifier, `_lib/ratification_subject.ts`, the shell block and its prose, and two test files. Omitted: the regenerated projection `dist/agent-src/commands/pr/merge.md` (a byte copy of the command), one `pack.yaml` token count, the roadmap's new decision row and note, and the round-4 review record.

Report defects: fail-open paths (a change that should reach the owner or the council but does not), places where the head can still influence the runtime or code that classifies it beyond what the stated residual says, whether the residual is stated accurately, regressions in `ratification_subject.ts`, new defects in the shell block, and tests that would pass without the code they cover. For each: file:line, the failure scenario, severity. State your stance.

~~~diff
diff --git a/src/domains/git/pr/merge/command.md b/src/domains/git/pr/merge/command.md
index 31204b4a8..da1ad3438 100644
--- a/src/domains/git/pr/merge/command.md
+++ b/src/domains/git/pr/merge/command.md
@@ -481,6 +481,15 @@ classify it with the **base revision's** classifier, never the head's:
 ```bash
 BASE="<manifest-base_sha>"
 HEAD_SHA="<manifest-head-sha>"
+MANIFESTS="package.json package-lock.json npm-shrinkwrap.json .npmrc yarn.lock .yarnrc.yml pnpm-lock.yaml bun.lock bun.lockb"
+run_base() {
+  OUT="$("$@" "$BASE_DIR/src/scripts/classify_merge_risk.ts" --range "$BASE...$HEAD_SHA" --root "$PWD")"
+  CODE=$?
+  case "$CODE:$(printf '%s\n' "$OUT" | tail -n 1)" in
+    "0:verdict: routine" | "1:verdict: needs-council ("* | "2:verdict: needs-owner ("*) printf '%s\n' "$OUT" ;;
+    *) return 1 ;;
+  esac
+}
 VERDICT="verdict: needs-owner (temp-dir-unavailable: no private temporary directory)"
 if GATE_TMP="$(mktemp -d)" && [ -n "$GATE_TMP" ] && [ -d "$GATE_TMP" ]; then
   BASE_DIR="$GATE_TMP/classifier-base"
@@ -488,20 +497,41 @@ if GATE_TMP="$(mktemp -d)" && [ -n "$GATE_TMP" ] && [ -d "$GATE_TMP" ]; then
   if REAL_TMP="$(cd "$GATE_TMP" && pwd -P)" && [ -n "$REAL_TMP" ]; then
     BASE_DIR="$REAL_TMP/classifier-base"
     VERDICT="verdict: needs-owner (base-unavailable: no classifier or no worktree at $BASE)"
-    if ! TRACKED="$(git ls-files -- node_modules)" || [ -n "$TRACKED" ] \
-       || ! git diff --quiet "$BASE...$HEAD_SHA" -- package.json package-lock.json npm-shrinkwrap.json \
-            .npmrc yarn.lock .yarnrc.yml pnpm-lock.yaml bun.lock bun.lockb; then
-      VERDICT="verdict: needs-owner (runtime-unverified: node_modules unreadable or tracked, or the head changes the manifest tsx was installed from)"
+    git diff --quiet "$BASE...$HEAD_SHA" -- $MANIFESTS
+    DEPS=$?
+    if ! TRACKED="$(git ls-files -- node_modules)" || [ -n "$TRACKED" ]; then
+      VERDICT="verdict: needs-owner (runtime-unverified: node_modules unreadable or tracked)"
+    elif [ "$DEPS" -gt 1 ]; then
+      VERDICT="verdict: needs-owner (manifest-unreadable: git diff exited $DEPS)"
     elif git cat-file -e "$BASE:src/scripts/classify_merge_risk.ts" \
          && git worktree add -q --detach "$BASE_DIR" "$BASE"; then
-      OUT="$(node_modules/.bin/tsx "$BASE_DIR/src/scripts/classify_merge_risk.ts" --range "$BASE...$HEAD_SHA" --root "$PWD")"
-      CODE=$?
-      LAST="$(printf '%s\n' "$OUT" | tail -n 1)"
-      case "$CODE:$LAST" in
-        "0:verdict: routine" | "1:verdict: needs-council ("* | "2:verdict: needs-owner ("*) VERDICT="$LAST" ;;
-        *) VERDICT="verdict: needs-owner (classifier-unusable: exit $CODE, last line '$LAST')" ;;
-      esac
-      printf '%s\n' "$OUT" | sed '$d'
+      cat > "$REAL_TMP/loader.mjs" <<'LOADER'
+export async function resolve(specifier, context, next) {
+  try { return await next(specifier, context); } catch (error) {
+    if (/^\.{1,2}\//.test(specifier) && specifier.endsWith('.js')) return next(`${specifier.slice(0, -3)}.ts`, context);
+    throw error;
+  }
+}
+LOADER
+      printf '%s\n' "import { register } from 'node:module';" "register('./loader.mjs', import.meta.url);" > "$REAL_TMP/register.mjs"
+      if RUN="$(run_base node --experimental-strip-types --no-warnings --import "$REAL_TMP/register.mjs")"; then
+        :
+      elif [ "$DEPS" -eq 0 ] && RUN="$(run_base node_modules/.bin/tsx)"; then
+        :
+      elif [ "$DEPS" -eq 1 ]; then
+        RUN="$(run_base node_modules/.bin/tsx)"
+        case "$(printf '%s\n' "$RUN" | tail -n 1)" in
+          "verdict: needs-owner ("*) ;;
+          *) RUN="verdict: needs-council (runtime-uncertain: no package-free runtime, and the head changes the manifest the checkout's runtime came from)" ;;
+        esac
+      else
+        RUN="verdict: needs-owner (classifier-unusable: no valid verdict under either runtime)"
+      fi
+      printf '%s\n' "$RUN" | sed '$d'
+      VERDICT="$(printf '%s\n' "$RUN" | tail -n 1)"
+      if [ "$DEPS" -eq 1 ] && [ "$VERDICT" = "verdict: routine" ]; then
+        VERDICT="verdict: needs-council (dependency-manifest: the head changes a dependency manifest)"
+      fi
     fi
   fi
 fi
@@ -513,32 +543,50 @@ echo "$VERDICT"
 classifier — and of `check_kernel_edit_ratified`, whose `classifyPaths` it
 reads — is the head's: a PR could rewrite the code that classes it and call
 itself `routine`. The ratification gate's workflow step records the same defect
-and runs the base copy for the same reason. The base copy is run directly with
-the checkout's `tsx`, not through `./scripts-run`, whose dispatcher is the head's
-code too; the consequence-class list and each ADR's `reopen_policy` are read
-from both revisions by the base copy itself.
-
-**What it fails to.** Every anomaly is **`needs-owner`** and says why — never a
-skipped gate and never a fall-back to the head's copy: a base without the
-classifier or a worktree that cannot be made; an exit status and last line that
-do not agree on one of the three verdicts (a crash, empty or malformed output);
-and a runtime the head could have supplied. `tsx` comes from the checkout's
-`node_modules`, so a head that tracks `node_modules` or changes the dependency
-manifest it was installed from could forge the verdict; such a PR is handed over
-unclassified. The boundary this assumes, stated rather than checked: the
-checkout's `node_modules` was installed from the base's manifest, never by this
-run from a PR head — a run that installed dependencies from a head before this
-block has already handed that head the runtime. A private temporary directory
-that cannot be made is `needs-owner` before any path is derived from it. The
-`trap` is installed right after two checks on the new directory, so it removes
-the worktree and the directory on every path after them, a `cd` that fails
-included; an interruption inside those two checks can leave an empty directory
-behind, never a classification. The block prints the verdict last and exits 0
-only on `routine`.
-The temporary directory is resolved to its real path: the classifier's entry
-guard compares real paths, and on a host whose temp directory is a symlink an
-unresolved path makes it print nothing — which the block would correctly, but
-uselessly, hand over as `classifier-unusable`.
+and runs the base copy for the same reason. The consequence-class list and each
+ADR's `reopen_policy` are read from both revisions by the base copy itself.
+
+**Which runtime.** The base copy's import closure uses only `node:` built-ins,
+so it is first run by `node` itself — `--experimental-strip-types` and a
+resolver hook the block writes into its own temporary directory — which depends
+on no `node_modules` at all, the head's or anyone's. Only when that cannot run
+(a Node without type stripping, or a base whose closure uses syntax stripping
+cannot carry) does the block fall back to the checkout's `tsx`, never through
+`./scripts-run`, whose dispatcher is the head's code.
+
+**Dependency manifests go to the council (owner decision, 2026-10-15).** A head
+that changes `package.json` or a lockfile is never `routine` — the classifier's
+`dependency-manifest` trigger, and a floor in the block for a base copy that
+predates it, make it `needs-council` — and never `needs-owner` on that ground
+alone. Where the package-free run worked, its verdict stands as for any PR.
+Where it could not run, the checkout's `tsx` may be one the head's manifest
+installed, so its answer is not trusted downward: a `needs-owner` from it is
+kept, anything else becomes `needs-council (runtime-uncertain)`.
+
+**What it fails to.** Every other anomaly is **`needs-owner`** and says why —
+never a skipped gate and never a fall-back to the head's copy: a private
+temporary directory that cannot be made (no path is derived before it exists),
+a base without the classifier or a worktree that cannot be made, a
+`node_modules` that is tracked or cannot be listed, a manifest diff that cannot
+be read, and an exit status and last line that do not agree on one of the three
+verdicts under either runtime. The `trap` is installed right after two checks on
+the new directory, so it removes the worktree and the directory on every path
+after them, a `cd` that fails included; an interruption inside those two checks
+can leave an empty directory behind, never a classification. The block prints
+the verdict last and exits 0 only on `routine`. The temporary directory is
+resolved to its real path: the classifier's entry guard compares real paths,
+and on a host whose temp directory is a symlink an unresolved path makes it
+print nothing.
+
+**Residual risk, stated.** On a host whose Node cannot strip types, a PR that
+changes a dependency manifest is classified by the checkout's `tsx`. If this run
+installed that runtime from the head, the head chooses the classifier's answer:
+it cannot reach `routine` (the floor holds), but by printing a lower verdict it
+can turn the `needs-owner` an honest runtime would report into
+`needs-council (runtime-uncertain)`. So there, a gated change paired with a
+dependency bump can reach the council instead of the owner. Where Node
+strips types (22.6 and later) this does not arise, and no run of this command
+installs dependencies from a head.
 
 The last line is the verdict; each trigger names the rule it comes from. An
 unreadable diff is `needs-council` — the gate fails closed.
diff --git a/src/scripts/_lib/ratification_subject.ts b/src/scripts/_lib/ratification_subject.ts
index 4ffffe347..3bd385a9a 100644
--- a/src/scripts/_lib/ratification_subject.ts
+++ b/src/scripts/_lib/ratification_subject.ts
@@ -90,11 +90,11 @@ const MAX_BLOB_BYTES = 32 * 1024 * 1024;
  * repository.
  */
 export class GatedSubjectRefusal extends Error {
-    constructor(
-        readonly rel: string,
-        message: string,
-    ) {
+    readonly rel: string;
+
+    constructor(rel: string, message: string) {
         super(message);
+        this.rel = rel;
         this.name = 'GatedSubjectRefusal';
     }
 }
@@ -121,12 +121,11 @@ export class GatedPathEscapes extends GatedSubjectRefusal {
  * Raised when a gated path's tree entry is not absent and not a regular file.
  */
 export class GatedPathUnsupported extends GatedSubjectRefusal {
-    constructor(
-        rel: string,
-        readonly kind: string,
-        why: string,
-    ) {
+    readonly kind: string;
+
+    constructor(rel: string, kind: string, why: string) {
         super(rel, `gated path \`${rel}\` ${why} — the digest refuses rather than describing it`);
+        this.kind = kind;
         this.name = 'GatedPathUnsupported';
     }
 }
@@ -137,15 +136,15 @@ export class GatedPathUnsupported extends GatedSubjectRefusal {
  * would be read as an option.
  */
 export class GatedRevisionUnresolved extends GatedSubjectRefusal {
-    constructor(
-        readonly revision: string,
-        detail: string,
-    ) {
+    readonly revision: string;
+
+    constructor(revision: string, detail: string) {
         super(
             '',
             `revision \`${revision}\` does not resolve to a commit (${detail}) — the digest is ` +
                 'taken over a commit and refuses rather than guessing which one',
         );
+        this.revision = revision;
         this.name = 'GatedRevisionUnresolved';
     }
 }
diff --git a/src/scripts/classify_merge_risk.ts b/src/scripts/classify_merge_risk.ts
index 651462fd7..6a73a861b 100644
--- a/src/scripts/classify_merge_risk.ts
+++ b/src/scripts/classify_merge_risk.ts
@@ -334,6 +334,16 @@ function isWorkflow(p: string): boolean {
     return p.startsWith('.github/workflows/');
 }
 
+/** Dependency manifests and lockfiles, at any depth: what an install resolves the runtime from. */
+const DEPENDENCY_MANIFESTS: ReadonlySet<string> = new Set([
+    'package.json', 'package-lock.json', 'npm-shrinkwrap.json', '.npmrc',
+    'yarn.lock', '.yarnrc.yml', 'pnpm-lock.yaml', 'bun.lock', 'bun.lockb',
+]);
+
+function isDependencyManifest(p: string): boolean {
+    return DEPENDENCY_MANIFESTS.has(path.posix.basename(p));
+}
+
 /** Every path a change touches — both sides of a rename or copy. */
 function touched(entries: readonly ChangeEntry[]): string[] {
     const out = new Set<string>();
@@ -371,6 +381,11 @@ export function classifyChanges(entries: readonly ChangeEntry[], opts: ClassifyO
     add('prod-data-or-migration', 'non-destructive-by-default — production data or a migration', all.filter(isProdOrMigration));
     add('deploy-or-release', 'non-destructive-by-default — deploy or release path', all.filter(isDeployOrRelease));
     add('ci-workflow', 'process-full — a disabled required check cannot reach delivery-ready', all.filter(isWorkflow));
+    add(
+        'dependency-manifest',
+        'supply-chain-intake — a dependency manifest or lockfile; owner decision 2026-10-15 sends it to the council, not the owner',
+        all.filter(isDependencyManifest),
+    );
     add('security-surface', 'security-sensitive-stop — auth, authz, tenancy, billing, secrets, uploads, webhooks, routes', all.filter(isSecurity));
 
     const gated = classifyPaths(all);
diff --git a/tests/scripts/classify_merge_risk_base_revision.test.ts b/tests/scripts/classify_merge_risk_base_revision.test.ts
index 4128aa4ff..aeaa97964 100644
--- a/tests/scripts/classify_merge_risk_base_revision.test.ts
+++ b/tests/scripts/classify_merge_risk_base_revision.test.ts
@@ -112,7 +112,7 @@ beforeAll(() => {
     git(work, 'clone', '-q', '--shared', REPO, clone);
     git(clone, 'config', 'user.email', 't@example.com');
     git(clone, 'config', 'user.name', 'T');
-    for (const f of [CLASSIFIER, GATED_READER, 'src/scripts/_lib/rule_consequence_class.ts']) {
+    for (const f of [CLASSIFIER, GATED_READER, 'src/scripts/_lib/rule_consequence_class.ts', 'src/scripts/_lib/ratification_subject.ts']) {
         fs.copyFileSync(path.join(REPO, f), path.join(clone, f));
     }
     git(clone, 'add', '-A');
@@ -190,16 +190,6 @@ describe('the shipped block fails to needs-owner on every anomaly', () => {
         expect(fs.existsSync(made)).toBe(false);
     }, 60_000);
 
-    it.each(['yarn.lock', '.yarnrc.yml', 'pnpm-lock.yaml', 'bun.lock', 'bun.lockb', 'package-lock.json', '.npmrc'])(
-        'a head that changes %s is runtime-unverified',
-        (file) => {
-            const head = commitOn(`head-changes-${file.replace(/[^a-z]/gu, '-')}-manifest`, base, { [file]: `changed by the head\n` });
-            const r = runGate(base, head);
-            expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(runtime-unverified/u);
-            expect(r.code).not.toBe(0);
-        },
-        60_000,
-    );
 
     it('a failing git ls-files is runtime-unverified, never read as "nothing tracked"', () => {
         const head = commitOn('docs-only-shim', base, { 'docs/installation.md': 'shim\n' });
@@ -245,7 +235,7 @@ describe('the shipped block fails to needs-owner on every anomaly', () => {
         const crashing = commitOn('base-crashes', base, { [CLASSIFIER]: 'process.exit(3);\n' });
         const head = commitOn('head-on-crashing', crashing, { 'docs/installation.md': 'x\n' });
         const r = runGate(crashing, head);
-        expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(classifier-unusable: exit 3/u);
+        expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(classifier-unusable/u);
         expect(r.code).not.toBe(0);
     }, 60_000);
 
@@ -253,7 +243,7 @@ describe('the shipped block fails to needs-owner on every anomaly', () => {
         const lying = commitOn('base-lies', base, { [CLASSIFIER]: "console.log('verdict: routine-ish');\n" });
         const head = commitOn('head-on-lying', lying, { 'docs/installation.md': 'y\n' });
         const r = runGate(lying, head);
-        expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(classifier-unusable: exit 0/u);
+        expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(classifier-unusable/u);
         expect(r.code).not.toBe(0);
     }, 60_000);
 
@@ -266,12 +256,104 @@ describe('the shipped block fails to needs-owner on every anomaly', () => {
         expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(base-unavailable/u);
         expect(r.code).not.toBe(0);
     }, 60_000);
+});
 
-    it('a head that changes the manifest tsx was installed from is runtime-unverified', () => {
-        const pkg = fs.readFileSync(path.join(clone, 'package.json'), 'utf8');
-        const head = commitOn('head-changes-package', base, { 'package.json': pkg.replace('{', '{\n  "x": 1,') });
-        const r = runGate(base, head);
-        expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(runtime-unverified/u);
+/** Does this host's node run TypeScript without any package? Decides which branch the block takes. */
+const STRIP_TYPES =
+    spawnSync('node', ['--experimental-strip-types', '--no-warnings', '-e', ''], { encoding: 'utf8' }).status === 0;
+
+/** A `node` on PATH that refuses type stripping, so the block must fall back to the checkout's runtime. */
+function nodeShimWithoutStripTypes(): string {
+    const dir = path.join(work, 'node-shim');
+    fs.mkdirSync(dir, { recursive: true });
+    const real = spawnSync('sh', ['-c', 'command -v node'], { encoding: 'utf8' }).stdout.trim();
+    fs.writeFileSync(
+        path.join(dir, 'node'),
+        `#!/bin/sh\nfor a in "$@"; do [ "$a" = "--experimental-strip-types" ] && exit 9; done\nexec "${real}" "$@"\n`,
+        { mode: 0o755 },
+    );
+    return dir;
+}
+
+/** Swap the checkout's runtime for one that always answers routine — a head-installed tsx. */
+function withPoisonedRuntime<T>(run: () => T): T {
+    const nm = path.join(clone, 'node_modules');
+    fs.unlinkSync(nm);
+    fs.mkdirSync(path.join(nm, '.bin'), { recursive: true });
+    fs.writeFileSync(path.join(nm, '.bin', 'tsx'), '#!/bin/sh\necho "verdict: routine"\n', { mode: 0o755 });
+    try {
+        return run();
+    } finally {
+        fs.rmSync(nm, { recursive: true, force: true });
+        fs.symlinkSync(path.join(REPO, 'node_modules'), nm);
+    }
+}
+
+describe('a dependency manifest goes to the council, and still cannot reach routine (owner decision 2026-10-15)', () => {
+    const bumped = (n: number): string =>
+        fs.readFileSync(path.join(REPO, 'package.json'), 'utf8').replace('{', `{\n  "x-bump": ${String(n)},`);
+
+    it('a PR that only bumps a dependency is needs-council', () => {
+        const r = runGate(base, commitOn('dep-bump-only', base, { 'package.json': bumped(1) }));
+        expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-council \(/u);
+        expect(r.code).not.toBe(0);
+    }, 60_000);
+
+    it.each(['yarn.lock', '.yarnrc.yml', 'pnpm-lock.yaml', 'bun.lock', 'bun.lockb', 'package-lock.json', '.npmrc'])(
+        'a head that changes only %s is needs-council',
+        (file) => {
+            const head = commitOn(`head-changes-${file.replace(/[^a-z]/gu, '-')}-manifest`, base, {
+                [file]: `changed by the head\n`,
+            });
+            const r = runGate(base, head);
+            expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-council \(/u);
+            expect(r.code).not.toBe(0);
+        },
+        60_000,
+    );
+
+    it('a manifest change with a downgrade attack on the classifier still reaches the owner', () => {
+        attack('dep-bump-with-downgrade', CLASSIFIER, (s) =>
+            s.replace(
+                'export function verdictOf(triggers: readonly Trigger[]): Verdict {',
+                "export function verdictOf(triggers: readonly Trigger[]): Verdict {\n    if (triggers.length >= 0) return 'routine';",
+            ),
+        );
+        fs.writeFileSync(path.join(clone, 'package.json'), bumped(2));
+        git(clone, 'commit', '-q', '-am', 'and a dependency bump');
+        const r = runGate(base, git(clone, 'rev-parse', 'HEAD'));
+        expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(/u);
+    }, 60_000);
+
+    it('a head-installed runtime cannot answer routine for a manifest change', () => {
+        const head = commitOn('dep-bump-poisoned-runtime', base, { 'package.json': bumped(3) });
+        const r = withPoisonedRuntime(() => runGate(base, head));
+        expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-council \(/u);
         expect(r.code).not.toBe(0);
     }, 60_000);
+
+    it.skipIf(!STRIP_TYPES)(
+        'where node strips types the base copy needs no node_modules, so a poisoned one cannot hide a gated change',
+        () => {
+            const head = commitOn('dep-bump-and-kernel-rule', base, {
+                'package.json': bumped(4),
+                [KERNEL_RULE]: `${fs.readFileSync(path.join(clone, KERNEL_RULE), 'utf8')}\n`,
+            });
+            const r = withPoisonedRuntime(() => runGate(base, head));
+            expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(/u);
+        },
+        60_000,
+    );
+
+    it('without type stripping a manifest change is runtime-uncertain, and a gated change still reaches the owner', () => {
+        const PATH = `${nodeShimWithoutStripTypes()}:${process.env['PATH'] ?? ''}`;
+        const only = runGate(base, commitOn('dep-bump-uncertain', base, { 'package.json': bumped(5) }), { PATH });
+        expect(only.lines[only.lines.length - 1]).toMatch(/^verdict: needs-council \(runtime-uncertain/u);
+        const gated = commitOn('dep-bump-and-kernel-rule-uncertain', base, {
+            'package.json': bumped(6),
+            [KERNEL_RULE]: `${fs.readFileSync(path.join(clone, KERNEL_RULE), 'utf8')}\n`,
+        });
+        const r = runGate(base, gated, { PATH });
+        expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(/u);
+    }, 60_000);
 });
diff --git a/tests/scripts/classify_merge_risk_needs_owner.test.ts b/tests/scripts/classify_merge_risk_needs_owner.test.ts
index 7612cd246..052b0f2ef 100644
--- a/tests/scripts/classify_merge_risk_needs_owner.test.ts
+++ b/tests/scripts/classify_merge_risk_needs_owner.test.ts
@@ -86,6 +86,13 @@ describe('the near-misses stay where they were', () => {
         expect(verdict('src/agent-src/contexts/execution/roadmap-process-loop.md')).toBe('needs-council');
     });
 
+    it('a dependency bump alone is needs-council, never needs-owner (owner decision 2026-10-15)', () => {
+        for (const p of ['package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'packages/ui/package.json']) {
+            expect(verdict(p), p).toBe('needs-council');
+        }
+        expect(verdict('docs/package-json-guide.md')).toBe('routine');
+    });
+
     it('a docs edit stays routine', () => {
         expect(verdict('docs/guides/parallel-sessions.md')).toBe('routine');
     });
~~~
