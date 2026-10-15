<!-- evidence-type: analysis -->

<!-- The round-9 (delta) prompt given to the council on 2026-10-15 for the danger-gate change,
     committed verbatim so the verdict recorded beside it can be checked against
     what was actually asked. Not edited after the run. -->

# Delta review of the danger-gate change — round 9

Round 8 reviewed the merge command's danger-gate block appending an empty record as an end marker to the changed-path listing and trusting the listing only when the loop reaches it; that diff is not repeated here. Round 8's seats found the production change correct and requested changes to its test. The findings raised in round 8, as the seats stated them:

1. The regression test made the listing unreadable with `chmod 200`, which does not stop root, so in a privileged runner it exercised a different path.
2. The test did not prove that the listing itself was generated successfully before the read failed.
3. The case of a listing that is read but ends before the end marker had no test.
4. The prose "read to its end" overstated what the marker establishes; the block trusts the listing when it reaches the appended marker.

Scope of this round: the diff below, from the round-8 head to the new head — one test and one prose sentence in the merge command. Omitted: the regenerated projection `dist/agent-src/commands/pr/merge.md` (a byte copy of the command) and one `pack.yaml` token count.

Report defects in this delta and in how it answers the round-8 findings: a finding marked answered that is not, new defects, and tests that would pass without the code they cover. For each: file:line, the failure scenario, severity. State your stance.

~~~diff
diff --git a/src/domains/git/pr/merge/command.md b/src/domains/git/pr/merge/command.md
index 76b5f9627..cbd8e39c5 100644
--- a/src/domains/git/pr/merge/command.md
+++ b/src/domains/git/pr/merge/command.md
@@ -582,8 +582,8 @@ all is an anomaly like any other and stays `needs-owner`. The changed paths are
 read NUL-separated and matched by basename with shell built-ins only, so an odd
 path cannot slip past. The block appends an empty record — a path git never
 prints — as an end marker and believes the listing only if the loop reaches
-it: a listing that cannot be written, opened or read to its end is
-`manifest-unreadable`, `needs-owner`.
+that marker: a listing that cannot be written or opened, or ends before the
+marker, is `manifest-unreadable`, `needs-owner`.
 
 **What it fails to.** Every other anomaly is **`needs-owner`** and says why —
 never a skipped gate and never a fall-back to the head's copy: a private
diff --git a/tests/scripts/classify_merge_risk_base_revision.test.ts b/tests/scripts/classify_merge_risk_base_revision.test.ts
index 4ff909e50..7162e1051 100644
--- a/tests/scripts/classify_merge_risk_base_revision.test.ts
+++ b/tests/scripts/classify_merge_risk_base_revision.test.ts
@@ -400,19 +400,28 @@ describe('a dependency manifest goes to the council, and still cannot reach rout
             expect(r.code).not.toBe(0);
         }, 60_000);
 
-        it('a listing that was written but cannot be read back is needs-owner, never "no manifest"', () => {
-            const shim = path.join(work, 'mktemp-write-only-listing');
-            const made = path.join(work, 'write-only-listing-tmp');
+        // The listing path is a link to /dev/null: writing it and appending the end
+        // marker both succeed, and reading it back reaches EOF before the marker — at
+        // any privilege. The git shim logs that the listing itself exited 0.
+        it('a listing written successfully but read back without its end marker is needs-owner', () => {
+            const shim = path.join(work, 'shim-listing-lost');
+            const made = path.join(work, 'listing-lost-tmp');
+            const log = path.join(work, 'listing-lost.log');
             fs.mkdirSync(shim, { recursive: true });
+            const realGit = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim();
             fs.writeFileSync(
                 path.join(shim, 'mktemp'),
-                `#!/bin/sh\nmkdir "${made}" && : > "${made}/changed" && chmod 200 "${made}/changed" && echo "${made}"\n`,
+                `#!/bin/sh\nmkdir "${made}" && ln -s /dev/null "${made}/changed" && echo "${made}"\n`,
                 { mode: 0o755 },
             );
-            const head = commitOn('bump-unreadable-listing', base, { 'package.json': bumped(11) });
-            const r = withPoisonedRuntime(() =>
-                runGate(base, head, { PATH: `${shim}:${noStrip()['PATH'] ?? ''}` }),
+            fs.writeFileSync(
+                path.join(shim, 'git'),
+                `#!/bin/sh\n"${realGit}" "$@"\nrc=$?\nfor a in "$@"; do [ "$a" = "--name-only" ] && echo "listing exit $rc" >> "${log}"; done\nexit $rc\n`,
+                { mode: 0o755 },
             );
+            const head = commitOn('bump-listing-lost', base, { 'package.json': bumped(11) });
+            const r = withPoisonedRuntime(() => runGate(base, head, { PATH: `${shim}:${noStrip()['PATH'] ?? ''}` }));
+            expect(fs.readFileSync(log, 'utf8')).toBe('listing exit 0\n');
             expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(manifest-unreadable/u);
             expect(r.code).not.toBe(0);
         }, 60_000);
~~~
