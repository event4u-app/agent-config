<!-- evidence-type: analysis -->

<!-- The round-8 (delta) prompt given to the council on 2026-10-15 for the danger-gate change,
     committed verbatim so the verdict recorded beside it can be checked against
     what was actually asked. Not edited after the run. -->

# Delta review of the danger-gate change — round 8

Round 7 reviewed the merge command's danger-gate block reading the changed-path listing NUL-separated from a file in its own temporary directory; that diff is not repeated here. Round 7's seats requested changes. The findings raised in round 7, as the seats stated them:

1. If `git diff` wrote the listing but opening or reading `$REAL_TMP/changed` then failed, the loop ended with `DEPS=0` and the block took the trusted-runtime branch, while the prose claimed an unreadable listing is `needs-owner`.
2. The test for an unreadable listing made `git diff` itself fail, so it did not cover a failure to read the written file.
3. The malformed-verdict fallback test did not assert a non-zero exit.
4. (One seat) the combined gated-file-plus-manifest test with a forged `routine` should expect `needs-owner`; the other seat held that `needs-council` matches the stated policy, with gated-file classification proven by the package-free case.

Scope of this round: the diff below, from the round-7 head to the new head — the shell block and its prose in the merge command, and one test file. Omitted: the regenerated projection `dist/agent-src/commands/pr/merge.md` (a byte copy of the command) and one `pack.yaml` token count. Finding 4 is not changed in this round: under the owner's decision of 2026-10-15 a valid fallback verdict below `needs-owner` on a manifest change becomes `needs-council (runtime-uncertain)`, which is the residual the command states.

Report defects in this delta and in how it answers the round-7 findings: fail-open paths that remain, a finding marked answered that is not, new defects the fixes introduced, and tests that would pass without the code they cover. For each: file:line, the failure scenario, severity. State your stance.

~~~diff
diff --git a/src/domains/git/pr/merge/command.md b/src/domains/git/pr/merge/command.md
index 601b3c744..76b5f9627 100644
--- a/src/domains/git/pr/merge/command.md
+++ b/src/domains/git/pr/merge/command.md
@@ -496,16 +496,24 @@ if GATE_TMP="$(mktemp -d)" && [ -n "$GATE_TMP" ] && [ -d "$GATE_TMP" ]; then
   if REAL_TMP="$(cd "$GATE_TMP" && pwd -P)" && [ -n "$REAL_TMP" ]; then
     BASE_DIR="$REAL_TMP/classifier-base"
     VERDICT="verdict: needs-owner (base-unavailable: no classifier or no worktree at $BASE)"
-    DEPS=0
-    if ! git diff --name-only -z "$BASE...$HEAD_SHA" > "$REAL_TMP/changed"; then
-      DEPS=2
-    else
+    DEPS=2
+    if git diff --name-only -z "$BASE...$HEAD_SHA" > "$REAL_TMP/changed" \
+       && printf '\0' >> "$REAL_TMP/changed"; then
+      FOUND=0
+      END_SEEN=0
       while IFS= read -r -d '' CHANGED_PATH; do
+        if [ -z "$CHANGED_PATH" ]; then
+          END_SEEN=1
+          break
+        fi
         case "${CHANGED_PATH##*/}" in
           package.json | package-lock.json | npm-shrinkwrap.json | .npmrc | yarn.lock | .yarnrc.yml | \
-          pnpm-lock.yaml | bun.lock | bun.lockb) DEPS=1 ;;
+          pnpm-lock.yaml | bun.lock | bun.lockb) FOUND=1 ;;
         esac
       done < "$REAL_TMP/changed"
+      if [ "$END_SEEN" -eq 1 ]; then
+        DEPS="$FOUND"
+      fi
     fi
     if ! TRACKED="$(git ls-files -- node_modules)" || [ -n "$TRACKED" ]; then
       VERDICT="verdict: needs-owner (runtime-unverified: node_modules unreadable or tracked)"
@@ -572,7 +580,10 @@ manifest installed, so a valid answer from it is not trusted downward: a
 `needs-council (runtime-uncertain)`. A fallback that gives no valid verdict at
 all is an anomaly like any other and stays `needs-owner`. The changed paths are
 read NUL-separated and matched by basename with shell built-ins only, so an odd
-path cannot slip past and a listing that cannot be read is `needs-owner`.
+path cannot slip past. The block appends an empty record — a path git never
+prints — as an end marker and believes the listing only if the loop reaches
+it: a listing that cannot be written, opened or read to its end is
+`manifest-unreadable`, `needs-owner`.
 
 **What it fails to.** Every other anomaly is **`needs-owner`** and says why —
 never a skipped gate and never a fall-back to the head's copy: a private
diff --git a/tests/scripts/classify_merge_risk_base_revision.test.ts b/tests/scripts/classify_merge_risk_base_revision.test.ts
index a83a543b6..4ff909e50 100644
--- a/tests/scripts/classify_merge_risk_base_revision.test.ts
+++ b/tests/scripts/classify_merge_risk_base_revision.test.ts
@@ -397,6 +397,24 @@ describe('a dependency manifest goes to the council, and still cannot reach rout
                 '#!/bin/sh\necho "verdict: routine-ish"\n',
             );
             expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(classifier-unusable/u);
+            expect(r.code).not.toBe(0);
+        }, 60_000);
+
+        it('a listing that was written but cannot be read back is needs-owner, never "no manifest"', () => {
+            const shim = path.join(work, 'mktemp-write-only-listing');
+            const made = path.join(work, 'write-only-listing-tmp');
+            fs.mkdirSync(shim, { recursive: true });
+            fs.writeFileSync(
+                path.join(shim, 'mktemp'),
+                `#!/bin/sh\nmkdir "${made}" && : > "${made}/changed" && chmod 200 "${made}/changed" && echo "${made}"\n`,
+                { mode: 0o755 },
+            );
+            const head = commitOn('bump-unreadable-listing', base, { 'package.json': bumped(11) });
+            const r = withPoisonedRuntime(() =>
+                runGate(base, head, { PATH: `${shim}:${noStrip()['PATH'] ?? ''}` }),
+            );
+            expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(manifest-unreadable/u);
+            expect(r.code).not.toBe(0);
         }, 60_000);
 
         it('a manifest under a directory whose name holds a newline is still a manifest change', () => {
~~~
