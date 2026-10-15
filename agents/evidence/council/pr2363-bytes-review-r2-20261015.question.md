<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-15 (round 2 of the PR #2363
     review), committed verbatim below this header so the verdict recorded
     beside it can be checked against what was actually asked. The header is
     the only addition; the prompt was not edited after the run. -->

# Review a follow-up change to PR #2363 — bytes the model actually receives

Review this change. It is a follow-up diff on top of the PR #2363 head (04d0864fa), written in response to a round-1 review that reported these items:

1. `/fix ci` and `/create-pr` invoked the CI waiter as `npx tsx node_modules/@event4u/agent-config/src/scripts/ci_settle.ts <n>`, which fails on global or ephemeral installs and fetches tsx from the registry.
2. `analyze-repo --deep` documented a bytes-transferred bound that git's output does not let the procedure enforce.
3. `modelVisibleBytes` counted content payload, while the metric registry row claimed the serialised `tool_result` block; no tests for `is_error`, mixed, empty or unsupported content.
4. In the repeated-read guard an undefined digest conflated over-bound, legacy ledger entry and read failure, and the advisory always cited the 2 MB hash bound.
5. The size-bound test used a nonexistent path, so it passed without the guard.
6. `contentDigest` checked the stat size and then read the whole file.
7. The delegation-nudge advisory hard-coded a ~182k figure with no named source.

Scope of this bundle: production, docs and test changes. Omitted for size: generated `dist/` projections, `src/domains/*/pack.yaml` token sums, the archived roadmap's correction notes, and the round-1 prompt file. The `ci:settle` verb was additionally checked outside this diff by packing the tarball (`npm pack --ignore-scripts`), installing it with `--omit=dev` into an empty directory with no `tsx` installed and no `npx` on PATH, and running `agent-config ci:settle` with no argument: usage message, exit 2.

Report defects in this diff: correctness, security or privacy, behaviour changes the commit messages do not state, tests that would pass without the code they cover, consumer-install breakage, and any round-1 item the diff does not address or addresses only partly. For each: file:line, the failure scenario, severity. State your stance.

```diff
diff --git a/agents/evidence/analysis/model-visible-bytes-2026-10-14.md b/agents/evidence/analysis/model-visible-bytes-2026-10-14.md
index b7100f4c4..516f13b2c 100644
--- a/agents/evidence/analysis/model-visible-bytes-2026-10-14.md
+++ b/agents/evidence/analysis/model-visible-bytes-2026-10-14.md
@@ -12,8 +12,19 @@ step 3.2 of `road-to-placeholders-on-the-wire` compare a reduction against.
 ## What is counted
 
-- **Model-visible bytes** — the `tool_result` block the model received: a
-  string body's UTF-8 bytes, or the sum of the text blocks' UTF-8 bytes plus the
-  encoded image data of image blocks. Producer: `scanToolResults` in
-  `src/scripts/_lib/cc_transcript.ts` (metric `tool-model-visible-bytes`).
+- **Model-visible bytes** — the PAYLOAD of the `tool_result` block the model
+  received, not the serialised block: a string body's UTF-8 bytes, or the sum of
+  the text blocks' UTF-8 bytes plus the encoded image data of image blocks. The
+  block's own structure (`type`, `tool_use_id`, `is_error`, JSON punctuation) is
+  excluded, so every "model-visible" figure below understates the block by that
+  per-result overhead. Producer: `scanToolResults` in
+  `src/scripts/_lib/cc_transcript.ts` (metric `tool-result-payload-bytes`).
+
+  *Definition stated 2026-10-15, after review.* The figures below were taken
+  with the reader as it stood at `main@90ed4e697`, which counted the same
+  payload with two differences: a content member carrying a `text` string was
+  counted whatever its `type`, and a member of any other kind was skipped
+  without a count. The current reader counts text only from `type: text` members
+  and counts the rest in `unsupported_members`; that count was not taken for
+  this reading, so how many members it skipped is unknown, not zero.
 - **Hook-envelope bytes** — the transcript's `toolUseResult`, serialised. It is
   the object the host hands a post_tool_use hook, so it is what the census in
diff --git a/src/cli/registry.ts b/src/cli/registry.ts
index 1b0923e0d..99fbe3ca7 100644
--- a/src/cli/registry.ts
+++ b/src/cli/registry.ts
@@ -57,4 +57,5 @@ export const REGISTRY: readonly CommandEntry[] = [
     { name: 'packs:active', disposition: 'delegate', synopsis: 'Which packs are active here, from which file — names the degraded zero-pack case.' },
     { name: 'brand:status', disposition: 'delegate', synopsis: 'Whether a consumer brand tokens file is present, where, and dot-prefixed near-misses.' },
+    { name: 'ci:settle', disposition: 'delegate', synopsis: "Wait for a PR's checks to settle; the last output line is the verdict." },
     { name: 'commands', disposition: 'native', synopsis: 'List/explain the command surface from the discovery manifest (ls / explain subcommands); ls --candidates reports surface-reduction signals.' },
     { name: 'help', disposition: 'native', synopsis: 'Show TS-shell help; delegates --tier=N to Bash.' },
diff --git a/src/config/metric-registry.yml b/src/config/metric-registry.yml
index 830a52746..3f3cd7176 100644
--- a/src/config/metric-registry.yml
+++ b/src/config/metric-registry.yml
@@ -154,5 +154,6 @@ metrics:
   # For Edit and Write the hook envelope carries the whole original file: over 12
   # local transcripts it was 19.5x the model-visible bytes (Bash 1.44x, Read
-  # within 0.1 %). What reached the model is `tool-model-visible-bytes` below.
+  # within 0.1 %). The payload that reached the model is `tool-result-payload-bytes`
+  # below.
   - id: tool-raw-bytes
     unit: bytes
@@ -181,5 +182,5 @@ metrics:
       line. Equal by construction today, because nothing in this tree rewrites
       a tool result on its way back to the host. Both count the hook envelope,
-      not what reached the model — that is `tool-model-visible-bytes`.
+      not what reached the model — its payload is `tool-result-payload-bytes`.
     decision: >-
       whether a result-rewriting mechanism, if one ever lands, reduced anything.
@@ -191,8 +192,14 @@ metrics:
       so that claim is a measured delta later rather than a story.
 
-  - id: tool-model-visible-bytes
+  - id: tool-result-payload-bytes
     unit: bytes
     basis: measured
-    producer: src/scripts/_lib/cc_transcript.ts (`scanToolResults`, the `tool_result` block per tool class, joined to the `tool_use` name by id)
+    producer: >-
+      src/scripts/_lib/cc_transcript.ts (`scanToolResults`, per tool class,
+      joined to the `tool_use` name by id). Counts the PAYLOAD of each
+      `tool_result` block — its text strings and base64 image data — not the
+      serialised block: `type`, `tool_use_id`, `is_error` and JSON punctuation
+      are excluded, and a content member of any other kind is counted in
+      `unsupported_members`, never as bytes.
     consumer: >-
       the dated distribution under `agents/evidence/analysis/` that
@@ -202,6 +209,8 @@ metrics:
     decision: >-
       which tool classes are worth reducing at all. A class whose hook envelope
-      is large and whose model-visible bytes are small (Edit, Write) has nothing
-      to reduce on the model side.
+      is large and whose payload is small (Edit, Write) has little to reduce on
+      the model side; the block structure the payload excludes is a per-result
+      overhead that does not grow with the payload, so it does not reorder the
+      classes.
     absent: >-
       the only tool-result byte figure is the hook envelope, which overstates
diff --git a/src/domains/analysis-workbench/analyze/repo/command.md b/src/domains/analysis-workbench/analyze/repo/command.md
index 75386533d..f345f8c54 100644
--- a/src/domains/analysis-workbench/analyze/repo/command.md
+++ b/src/domains/analysis-workbench/analyze/repo/command.md
@@ -184,9 +184,16 @@ and rare, and a store is a maintenance surface for a rare path.
 
 The fetch ceiling is replaced by a **four-part ceiling**: an operation count, a
-total-bytes-read bound, a wall-clock bound, and a **bytes-transferred** bound —
-**whichever is hit first**, with the bound that fired recorded. The transfer
-figure is read from git's own receive line (`Receiving objects: … | <size>`),
-recorded as `0` when a local clone was reused; an over-bound transfer stops the
-run before a file is read. A bare read count bounds nothing (forty
+total-bytes-read bound, a wall-clock bound, and a **pre-fetch size gate** —
+**whichever is hit first**, with the bound that fired recorded. The size gate is
+the only transfer control, and it acts **before** the fetch, not during it:
+read the host's reported repository size (on GitHub,
+`gh api repos/<owner>/<repo> --jq .size`, in KiB) and do not fetch when it
+exceeds the bound. That figure is the whole repository, so it over-states a
+depth-1 pack — a conservative proxy, never a measurement. Nothing here stops a
+fetch that is already running: `git fetch` gives no enforceable mid-transfer
+limit, so a host that reports no size has **no** transfer bound — record that
+gap rather than a figure. After the fetch, record the on-disk size of the
+clone's `.git` (`0` when a local clone was reused) as what was received. A bare
+read count bounds nothing (forty
 reads is one README or one 2 MB generated schema, and traversing a monorepo
 costs time a file count never expresses). Cloning **parses**
diff --git a/src/domains/engineering-base/fix/ci/command.md b/src/domains/engineering-base/fix/ci/command.md
index 835dfc318..ad65e799d 100644
--- a/src/domains/engineering-base/fix/ci/command.md
+++ b/src/domains/engineering-base/fix/ci/command.md
@@ -26,5 +26,5 @@ start guessing — and do NOT end the turn reporting "CI is running".
 
 ```bash
-npx tsx node_modules/@event4u/agent-config/src/scripts/ci_settle.ts <n>
+agent-config ci:settle <n>
 ```
 
diff --git a/src/domains/git/pr/create/command.md b/src/domains/git/pr/create/command.md
index acedde231..3b3299810 100644
--- a/src/domains/git/pr/create/command.md
+++ b/src/domains/git/pr/create/command.md
@@ -485,5 +485,5 @@ Pending is a reason to wait, never a reason to stop.
 
 ```bash
-npx tsx node_modules/@event4u/agent-config/src/scripts/ci_settle.ts <n>
+agent-config ci:settle <n>
 gh pr checks <n> --json name,state,link \
   --jq '.[] | select(.state!="SUCCESS" and .state!="SKIPPED") | "\(.state)  \(.name)  \(.link)"'
diff --git a/src/domains/product-basic/roadmap/process-full/command.md b/src/domains/product-basic/roadmap/process-full/command.md
index 120b9236b..2d7050756 100644
--- a/src/domains/product-basic/roadmap/process-full/command.md
+++ b/src/domains/product-basic/roadmap/process-full/command.md
@@ -166,5 +166,5 @@ command is a claim; a layer with one is a check.
 | 2 | Quality scoped to the changed surface | the type-checker and linter over the diff — `npm run typecheck`, the linter on changed files |
 | 3 | Per-phase fast CI | `roadmap.quality_cadence: per_phase` (Phase 0.2) at each phase boundary |
-| 4 | The final full required CI | `./scripts-run src/scripts/ci_settle <PR> --timeout-min 28`, run as a BACKGROUND job — its LAST OUTPUT LINE is the verdict |
+| 4 | The final full required CI | `agent-config ci:settle <PR> --timeout-min 28`, run as a BACKGROUND job — its LAST OUTPUT LINE is the verdict |
 | 5 | Forge branch protection | `agent-config doctor --json` → `forge_protection` (Phase 3.2), read from the forge |
 | 6 | Final-head verification | `ci_settle`'s verdict line names the head; it must be the head that was pushed last |
diff --git a/src/scripts/_cli/cmd_ci_settle.ts b/src/scripts/_cli/cmd_ci_settle.ts
new file mode 100644
index 000000000..1a83d8367
--- /dev/null
+++ b/src/scripts/_cli/cmd_ci_settle.ts
@@ -0,0 +1,32 @@
+/**
+ * `agent-config ci:settle <pr>` — the CI waiter, reached through the package's
+ * own executable.
+ *
+ * Shipped commands used to name `npx tsx node_modules/@event4u/agent-config/
+ * src/scripts/ci_settle.ts`, which fails on a global or ephemeral install (no
+ * such path) and pulls `tsx` from the registry on a cold cache. Living under
+ * `_cli/` gets this file bundled into `dist/cli-delegate/`, so a consumer runs
+ * it with plain `node` and no TypeScript runner at all.
+ */
+
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+import process from 'node:process';
+import { fileURLToPath, pathToFileURL } from 'node:url';
+
+import { main } from '../ci_settle.js';
+
+function _isCliEntry(): boolean {
+    if (process.argv[1] === undefined) return false;
+    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
+    if (import.meta.url === argvUrl) return true;
+    try {
+        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
+    } catch {
+        return false;
+    }
+}
+
+if (_isCliEntry()) {
+    process.exitCode = main(process.argv.slice(2));
+}
diff --git a/src/scripts/_dispatch.bash b/src/scripts/_dispatch.bash
index 3f0d7c362..9278f1133 100755
--- a/src/scripts/_dispatch.bash
+++ b/src/scripts/_dispatch.bash
@@ -81,4 +81,6 @@ TS-shell native (run via the installed `agent-config` binary):
                              four canonical tokens.json paths. Flags a dot-prefixed
                              .tokens.json, which nothing reads.
+  ci:settle <pr>             Wait for a PR's checks to settle; the last line is the
+                             verdict (exit 0 green · 1 red · 2 no verdict).
   packs:active               Which packs are active HERE, and from which file.
                              Names the degraded case (settings file without a
@@ -839,4 +841,10 @@ cmd_brand_status() {
 }
 
+# `ci:settle <pr>` — the one CI waiter, through the package's own executable so a
+# shipped command never names a node_modules path or fetches a TS runner.
+cmd_ci_settle() {
+  exec_ts "$PACKAGE_ROOT/src/scripts/_cli/cmd_ci_settle.ts" "$@"
+}
+
 # `--archive`: a completed roadmap is archived here rather than reported as a
 # warning the caller has to act on. `roadmap:progress-check` never passes it —
@@ -1599,4 +1607,5 @@ main() {
     mcp:available)           cmd_mcp_available "$@" ;;
     brand:status)            cmd_brand_status "$@" ;;
+    ci:settle)               cmd_ci_settle "$@" ;;
     roadmap:context)         cmd_roadmap_context "$@" ;;
     roadmap:progress)        cmd_roadmap_progress "$@" ;;
diff --git a/src/scripts/_lib/cc_transcript.ts b/src/scripts/_lib/cc_transcript.ts
index 76b2a76d5..6987038c1 100644
--- a/src/scripts/_lib/cc_transcript.ts
+++ b/src/scripts/_lib/cc_transcript.ts
@@ -477,22 +477,30 @@ export function aggregateByBucket(records: readonly TranscriptRecord[]): Record<
 
 /**
- * One tool class's model-visible bytes, beside the host's hook envelope.
+ * One tool class's payload bytes, beside the host's hook envelope.
  *
- * The two are different populations and are never added together. The
- * model-visible figure is the `tool_result` block the model received; the
- * envelope is the transcript's `toolUseResult` — the same object the host hands
- * a post_tool_use hook, which for Edit and Write carries the whole original
- * file the model never sees.
+ * Payload bytes are the text strings and base64 image data inside the
+ * `tool_result` block the model received. They are NOT the serialised block:
+ * `type`, `tool_use_id`, `is_error` and the JSON punctuation around them are
+ * excluded, so the figure understates the block by its structure and is not
+ * comparable byte-for-byte with the JSON-serialised envelope. A content member
+ * of any other kind is counted in `unsupported_members`, never as bytes.
+ *
+ * The two populations are never added together. The envelope is the
+ * transcript's `toolUseResult` — the same object the host hands a
+ * post_tool_use hook, which for Edit and Write carries the whole original file
+ * the model never sees.
  */
 export interface ToolResultClass {
     tool: string;
     count: number;
-    model_visible_bytes: number;
+    payload_bytes: number;
     /** Sum over results that carried an envelope; `null` when none did. */
     envelope_bytes: number | null;
     /** Results with no `toolUseResult` — not zero, not measured. */
     envelope_missing: number;
-    /** One model-visible byte count per result, for percentiles. */
-    model_visible_samples: number[];
+    /** Content members that are neither text nor base64 image — present, not measured. */
+    unsupported_members: number;
+    /** One payload byte count per result, for percentiles. */
+    payload_samples: number[];
 }
 
@@ -518,21 +526,28 @@ function blocksOf(raw: { message?: { content?: unknown } }): RawBlock[] {
 }
 
-/** Model-visible bytes of one `tool_result` block, and whether it carried an image. */
-function modelVisibleBytes(block: RawBlock): { bytes: number; image: boolean } {
+interface Payload {
+    bytes: number;
+    image: boolean;
+    unsupported: number;
+}
+
+/** Payload bytes of one `tool_result` block — see {@link ToolResultClass}. */
+function payloadOf(block: RawBlock): Payload {
     const c = block.content;
-    if (typeof c === 'string') return { bytes: Buffer.byteLength(c, 'utf8'), image: false };
-    let bytes = 0;
-    let image = false;
-    if (Array.isArray(c)) {
-        for (const item of c as RawBlock[]) {
-            if (typeof item !== 'object' || item === null) continue;
-            if (typeof item.text === 'string') bytes += Buffer.byteLength(item.text, 'utf8');
-            if (item.type === 'image' && typeof item.source?.data === 'string') {
-                image = true;
-                bytes += item.source.data.length;
-            }
+    if (typeof c === 'string') return { bytes: Buffer.byteLength(c, 'utf8'), image: false, unsupported: 0 };
+    const out: Payload = { bytes: 0, image: false, unsupported: 0 };
+    if (!Array.isArray(c)) return out;
+    for (const item of c as unknown[]) {
+        const m = typeof item === 'object' && item !== null ? (item as RawBlock) : null;
+        if (m !== null && m.type === 'text' && typeof m.text === 'string') {
+            out.bytes += Buffer.byteLength(m.text, 'utf8');
+        } else if (m !== null && m.type === 'image' && typeof m.source?.data === 'string') {
+            out.image = true;
+            out.bytes += m.source.data.length;
+        } else {
+            out.unsupported += 1;
         }
     }
-    return { bytes, image };
+    return out;
 }
 
@@ -546,5 +561,5 @@ function readLines(file: string): string[] {
 
 /**
- * Model-visible tool-result bytes per tool class, joined to the tool name by
+ * Tool-result payload bytes per tool class, joined to the tool name by
  * `tool_use_id`. Two passes over the file set — names first, results second —
  * so a result whose `tool_use` sits in another file still joins. A result whose
@@ -579,5 +594,5 @@ export function scanToolResults(opts: ScanOptions = {}): ToolResultScan {
                 if (seen.has(id)) continue;
                 seen.add(id);
-                const { bytes, image } = modelVisibleBytes(block);
+                const { bytes, image, unsupported } = payloadOf(block);
                 const name = names.get(id) ?? 'unknown';
                 const tool = image ? `${name}:image` : name;
@@ -585,12 +600,14 @@ export function scanToolResults(opts: ScanOptions = {}): ToolResultScan {
                     tool,
                     count: 0,
-                    model_visible_bytes: 0,
+                    payload_bytes: 0,
                     envelope_bytes: null,
                     envelope_missing: 0,
-                    model_visible_samples: [],
+                    unsupported_members: 0,
+                    payload_samples: [],
                 });
                 cls.count += 1;
-                cls.model_visible_bytes += bytes;
-                cls.model_visible_samples.push(bytes);
+                cls.payload_bytes += bytes;
+                cls.unsupported_members += unsupported;
+                cls.payload_samples.push(bytes);
                 // One envelope per record: attributed only when the record holds one result.
                 const env = blocks.length === 1 ? raw.toolUseResult : undefined;
diff --git a/src/scripts/_lib/tool_result_census.ts b/src/scripts/_lib/tool_result_census.ts
index ba7d21c41..2cd9d05d0 100644
--- a/src/scripts/_lib/tool_result_census.ts
+++ b/src/scripts/_lib/tool_result_census.ts
@@ -14,5 +14,5 @@
  *
  * Neither shape counts what reached the model; that is
- * `tool-model-visible-bytes`, read from transcripts (`cc_transcript.ts`).
+ * `tool-result-payload-bytes`, read from transcripts (`cc_transcript.ts`).
  */
 
diff --git a/src/scripts/ci_settle.ts b/src/scripts/ci_settle.ts
index 2f4645fc4..85f79fdab 100644
--- a/src/scripts/ci_settle.ts
+++ b/src/scripts/ci_settle.ts
@@ -52,4 +52,5 @@
 
 import { spawnSync } from 'node:child_process';
+import * as path from 'node:path';
 
 /**
@@ -566,5 +567,7 @@ export function main(argv: readonly string[]): number {
 }
 
-if (process.argv[1] !== undefined && process.argv[1].endsWith('ci_settle.ts')) {
+// Basename, not a suffix: `_cli/cmd_ci_settle.ts` also ends in `ci_settle.ts`,
+// and importing this module from it would otherwise run the wait twice.
+if (process.argv[1] !== undefined && path.basename(process.argv[1]) === 'ci_settle.ts') {
     process.exitCode = main(process.argv.slice(2));
 }
diff --git a/src/scripts/hooks/delegation_nudge_hook.ts b/src/scripts/hooks/delegation_nudge_hook.ts
index 92553a498..2b4e302ab 100644
--- a/src/scripts/hooks/delegation_nudge_hook.ts
+++ b/src/scripts/hooks/delegation_nudge_hook.ts
@@ -349,4 +349,12 @@ export function recommendSliceTier(downshift: boolean, separate_quota_pool: bool
 }
 
+/**
+ * Median first-call written-or-uncached tokens of a subagent leg — a
+ * measurement, not a tuning knob. Re-take it in {@link LEG_COLD_START_SOURCE}
+ * and change it here; a test fails while the two disagree.
+ */
+export const LEG_COLD_START_UNCACHED_TOKENS = 182_257;
+export const LEG_COLD_START_SOURCE = "agents/evidence/analysis/subagent-cold-start-2026-10-14.md";
+
 /**
  * `rung` names the resolved judgment-ladder rung (2.4): `null` renders as
@@ -404,9 +412,9 @@ export function buildNudgeLine(
   // mode of its own — `classification.mode` is `null` for that shape.
   const modeLabel = classification.mode ?? "single-slice";
-  // Advisory only, never a block: a leg's first call
-  // still writes or reads uncached a median of ~182k tokens.
+  // Advisory only, never a block.
   const coldStart =
     rung === 1
-      ? " A leg starts cold (~182k uncached tokens): a slice of one to three direct reads does not amortise it."
+      ? ` A leg starts cold (~${Math.round(LEG_COLD_START_UNCACHED_TOKENS / 1000)}k uncached tokens): ` +
+        "a slice of one to three direct reads does not amortise it."
       : "";
   return (
diff --git a/src/scripts/hooks/push_settle_hook.ts b/src/scripts/hooks/push_settle_hook.ts
index 71fefe311..1e9e11d8a 100644
--- a/src/scripts/hooks/push_settle_hook.ts
+++ b/src/scripts/hooks/push_settle_hook.ts
@@ -177,6 +177,6 @@ export function buildReminder(branch: string, pr: number | null): { reason: stri
     pr === null
       ? `gh pr view ${branch} --json number -q .number   # then:\n` +
-        `./scripts-run src/scripts/ci_settle <that number>`
-      : `./scripts-run src/scripts/ci_settle ${pr}`;
+        `agent-config ci:settle <that number>`
+      : `agent-config ci:settle ${pr}`;
   const subject = pr === null ? `branch ${branch}` : `PR #${pr} (${branch})`;
   const reason =
diff --git a/src/scripts/hooks/reread_guard_hook.ts b/src/scripts/hooks/reread_guard_hook.ts
index 2f46837cb..9a566cd1c 100644
--- a/src/scripts/hooks/reread_guard_hook.ts
+++ b/src/scripts/hooks/reread_guard_hook.ts
@@ -8,5 +8,6 @@
  *   6.1 A full-file `Read` of a path that was ALREADY fully read this session
  *       AND whose content is unchanged since (sha256 compare against the
- *       ledger; above HASH_BOUND_BYTES, mtime + size, said so in the line) gets
+ *       ledger; above HASH_BOUND_BYTES, mtime + size, said so in the line; a
+ *       file under the bound without both digests never fires) gets
  *       one advisory line naming the earlier read and the ranged-read
  *       alternative. A ranged read (any `offset`/`limit` in the tool input)
@@ -112,5 +113,5 @@ export interface ReadRecord {
     size: number;
     ts: number;
-    /** sha256 of the file; absent above {@link HASH_BOUND_BYTES}. */
+    /** sha256 of the file; absent above {@link HASH_BOUND_BYTES}, on a read failure, or in a legacy entry. */
     sha256?: string;
 }
@@ -122,18 +123,55 @@ export interface ReadRecord {
 export const HASH_BOUND_BYTES = 2 * 1024 * 1024;
 
-/** sha256 of a file at or under the bound; `undefined` above it or on error. */
-export function contentDigest(absPath: string, size: number): string | undefined {
-    if (size > HASH_BOUND_BYTES) return undefined;
+/**
+ * What the content key could say about one read. `over-bound` and `unreadable`
+ * are different answers: only the first licenses the stat fallback.
+ */
+export type Digest = { kind: 'sha256'; value: string } | { kind: 'over-bound' } | { kind: 'unreadable' };
+
+/**
+ * sha256 of a file at or under the bound. The stat `size` skips the read when it
+ * is already over; the read itself stops at `HASH_BOUND_BYTES + 1`, because the
+ * file can grow between the stat and the read.
+ */
+export function contentDigest(absPath: string, size: number): Digest {
+    if (size > HASH_BOUND_BYTES) return { kind: 'over-bound' };
+    let fd: number | undefined;
     try {
-        return crypto.createHash('sha256').update(fs.readFileSync(absPath)).digest('hex');
+        fd = fs.openSync(absPath, 'r');
+        const buf = Buffer.allocUnsafe(HASH_BOUND_BYTES + 1);
+        let filled = 0;
+        while (filled < buf.length) {
+            const n = fs.readSync(fd, buf, filled, buf.length - filled, null);
+            if (n === 0) break;
+            filled += n;
+        }
+        if (filled > HASH_BOUND_BYTES) return { kind: 'over-bound' };
+        return { kind: 'sha256', value: crypto.createHash('sha256').update(buf.subarray(0, filled)).digest('hex') };
     } catch {
-        return undefined;
+        return { kind: 'unreadable' };
+    } finally {
+        if (fd !== undefined) {
+            try {
+                fs.closeSync(fd);
+            } catch {
+                // closing a descriptor we opened cannot change the answer
+            }
+        }
     }
 }
 
-/** Same content when both reads carry a digest; else the stat pair decides. */
-export function isUnchanged(prior: ReadRecord, mtime: number, size: number, sha256: string | undefined): boolean {
-    if (prior.sha256 !== undefined && sha256 !== undefined) return prior.sha256 === sha256;
-    return prior.mtime === mtime && prior.size === size;
+/** The basis on which a read was found unchanged. */
+export type CompareBasis = 'content' | 'stat-over-bound';
+
+/**
+ * The basis on which the file is unchanged since `prior`, or `null` when that
+ * cannot be asserted. Content equality needs both digests; the stat pair
+ * decides only for a file over the bound. A hash-eligible file missing either
+ * digest — a legacy ledger entry, a read that failed — is never called unchanged.
+ */
+export function compareRead(prior: ReadRecord, mtime: number, size: number, digest: Digest): CompareBasis | null {
+    if (digest.kind === 'over-bound') return prior.mtime === mtime && prior.size === size ? 'stat-over-bound' : null;
+    if (digest.kind === 'sha256' && prior.sha256 !== undefined) return prior.sha256 === digest.value ? 'content' : null;
+    return null;
 }
 
@@ -209,7 +247,8 @@ export function isRangedRead(toolInput: JsonObject): boolean {
 
 /** 6.1 advisory — duplicate full read of an unchanged, already-read path. */
-export function buildDuplicateReadLine(relPath: string, earlierTs: number, byContent = true): string {
+export function buildDuplicateReadLine(relPath: string, earlierTs: number, compared: CompareBasis): string {
     const when = new Date(earlierTs).toISOString();
-    const basis = byContent ? 'unchanged content (same sha256)' : 'unchanged since (same mtime+size; over the 2 MB hash bound)';
+    const basis =
+        compared === 'content' ? 'unchanged content (same sha256)' : 'unchanged since (same mtime+size; over the 2 MB hash bound)';
     return (
         `re-read guard: ${relPath} was already fully read this session (${when}) with ` +
@@ -279,5 +318,5 @@ export function main(): number {
         }
 
-        const sha256 = contentDigest(absPath, size);
+        const digest = contentDigest(absPath, size);
         const prior = ledger.reads[key];
         const ownWrite = ledger.writes[key];
@@ -285,13 +324,15 @@ export function main(): number {
 
         let advisory: string | null = null;
+        const compared = prior === undefined ? null : compareRead(prior, mtime, size, digest);
         if (!alreadyFired && ownWrite !== undefined) {
             advisory = buildPostEditReadLine(key); // 6.2 wins when both hold
-        } else if (!alreadyFired && prior !== undefined && isUnchanged(prior, mtime, size, sha256)) {
-            advisory = buildDuplicateReadLine(key, prior.ts, prior.sha256 !== undefined && sha256 !== undefined);
+        } else if (!alreadyFired && prior !== undefined && compared !== null) {
+            advisory = buildDuplicateReadLine(key, prior.ts, compared);
         }
 
         // Record the read that is about to happen (numbers only), consume the
         // one-shot own-write marker, and latch the per-path fire flag.
-        ledger.reads[key] = sha256 === undefined ? { mtime, size, ts: Date.now() } : { mtime, size, ts: Date.now(), sha256 };
+        ledger.reads[key] =
+            digest.kind === 'sha256' ? { mtime, size, ts: Date.now(), sha256: digest.value } : { mtime, size, ts: Date.now() };
         if (ownWrite !== undefined) delete ledger.writes[key];
         if (advisory !== null) ledger.fired[key] = true;
diff --git a/src/scripts/hooks/tool_result_bytes_hook.ts b/src/scripts/hooks/tool_result_bytes_hook.ts
index 339a24a67..6cc5e61e9 100644
--- a/src/scripts/hooks/tool_result_bytes_hook.ts
+++ b/src/scripts/hooks/tool_result_bytes_hook.ts
@@ -53,6 +53,6 @@
  * Write the hook envelope carries the whole original file while the model
  * receives a short confirmation (measured over 12 local transcripts: 19.5x;
- * Bash 1.44x; Read within 0.1 %). The model-visible figure is a separate
- * metric, `tool-model-visible-bytes`, read from transcripts. `raw_bytes` is
+ * Bash 1.44x; Read within 0.1 %). The payload the model received is a separate
+ * metric, `tool-result-payload-bytes`, read from transcripts. `raw_bytes` is
  * the hook envelope the host handed the dispatcher; `delivered_bytes` is the
  * hook envelope after any rewrite a concern could apply on its way back.
@@ -208,5 +208,5 @@ export interface CensusLine {
     /**
      * UTF-8 bytes of the hook envelope after any rewrite — NOT what reached
-     * the model (see the header; that figure is `tool-model-visible-bytes`).
+     * the model (see the header; that figure is `tool-result-payload-bytes`).
      *
      * Equal to {@link CensusLine.raw_bytes} by construction today — nothing in
diff --git a/src/scripts/probe_turnaround.ts b/src/scripts/probe_turnaround.ts
index c9e2c9a5b..085cff327 100644
--- a/src/scripts/probe_turnaround.ts
+++ b/src/scripts/probe_turnaround.ts
@@ -95,4 +95,5 @@ const TOOL_CAUSE: Readonly<Record<string, BlockingCause>> = {
 const SHELL_RULES: ReadonlyArray<readonly [RegExp, BlockingCause]> = [
     [/^(\S*\/)?scripts-run \S*ci_settle\b/, 'ci-wait'],
+    [/^(\S*\/)?agent-config ci:settle\b/, 'ci-wait'],
     [/^gh (run watch|pr checks)\b/, 'ci-wait'],
     [/^(sleep|until|while|watch)\b/, 'sleep-poll'],
diff --git a/src/skills/git-workflow/SKILL.md b/src/skills/git-workflow/SKILL.md
index 0b4fd639a..08cbcb7b7 100644
--- a/src/skills/git-workflow/SKILL.md
+++ b/src/skills/git-workflow/SKILL.md
@@ -108,5 +108,5 @@ Work complete. What would you like to do?
 4. `gh pr create` using PR template.
 5. **Settle it** — the turn is not over at step 4:
-   `npx tsx node_modules/@event4u/agent-config/src/scripts/ci_settle.ts <pr>`
+   `agent-config ci:settle <pr>`
 
 ## A push closes its own loop
diff --git a/tests/scripts/cc_transcript.test.ts b/tests/scripts/cc_transcript.test.ts
index dc5b323e5..b0d3dfc3d 100644
--- a/tests/scripts/cc_transcript.test.ts
+++ b/tests/scripts/cc_transcript.test.ts
@@ -396,5 +396,5 @@ describe('derivedBytes - a derived figure can never be read as a counted one', (
 });
 
-describe('scanToolResults - the model-visible bytes of a tool result, per tool class', () => {
+describe('scanToolResults - the payload bytes of a tool result, per tool class', () => {
     // An Edit whose hook envelope carries the whole original file, while the
     // model receives only the confirmation line. Every expected figure is
@@ -460,7 +460,7 @@ describe('scanToolResults - the model-visible bytes of a tool result, per tool c
         const edit = scan.classes['Edit'];
         expect(edit?.count).toBe(1);
-        expect(edit?.model_visible_bytes).toBe(Buffer.byteLength(CONFIRMATION, 'utf8'));
+        expect(edit?.payload_bytes).toBe(Buffer.byteLength(CONFIRMATION, 'utf8'));
         expect(edit?.envelope_bytes).toBe(Buffer.byteLength(JSON.stringify(EDIT_ENVELOPE), 'utf8'));
-        expect(edit?.envelope_bytes ?? 0).toBeGreaterThan((edit?.model_visible_bytes ?? 0) * 10);
+        expect(edit?.envelope_bytes ?? 0).toBeGreaterThan((edit?.payload_bytes ?? 0) * 10);
     });
 
@@ -469,6 +469,6 @@ describe('scanToolResults - the model-visible bytes of a tool result, per tool c
         const projectDir = writeToolFixture(root);
         const scan = scanToolResults({ root, projectDir });
-        expect(scan.classes['Bash']?.model_visible_bytes).toBe(Buffer.byteLength(BASH_OUT, 'utf8'));
-        expect(scan.classes['Read:image']?.model_visible_bytes).toBe(IMAGE_DATA.length);
+        expect(scan.classes['Bash']?.payload_bytes).toBe(Buffer.byteLength(BASH_OUT, 'utf8'));
+        expect(scan.classes['Read:image']?.payload_bytes).toBe(IMAGE_DATA.length);
         expect(scan.classes['Read:image']?.envelope_bytes).toBeNull();
         expect(scan.classes['Read']).toBeUndefined();
@@ -476,3 +476,64 @@ describe('scanToolResults - the model-visible bytes of a tool result, per tool c
         expect(scan.results).toBe(4);
     });
+
+    describe('payload definition - text strings and base64 image data, never block structure', () => {
+        function scanOne(block: Record<string, unknown>, name = 'Bash') {
+            const root = mkTmp();
+            const projectDir = path.join(root, 'proj');
+            appendJsonl(path.join(projectDir, 's.jsonl'), [
+                { type: 'assistant', message: { id: 'm1', content: [{ type: 'tool_use', id: 'tu_1', name, input: {} }] } },
+                { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_1', ...block }] } },
+            ]);
+            return scanToolResults({ root, projectDir });
+        }
+
+        it('is-error-flag-is-not-payload', () => {
+            const ERR = 'Exit code 1\nboom';
+            const cls = scanOne({ is_error: true, content: ERR }).classes['Bash'];
+            expect(cls?.count).toBe(1);
+            expect(cls?.payload_bytes).toBe(Buffer.byteLength(ERR, 'utf8'));
+        });
+
+        it('mixed-text-and-image-sums-both-and-classes-as-image', () => {
+            const A = 'before ✓';
+            const DATA = 'iVBORw0KGgo'.repeat(3);
+            const B = 'after';
+            const scan = scanOne(
+                {
+                    content: [
+                        { type: 'text', text: A },
+                        { type: 'image', source: { type: 'base64', data: DATA } },
+                        { type: 'text', text: B },
+                    ],
+                },
+                'Read',
+            );
+            expect(scan.classes['Read']).toBeUndefined();
+            expect(scan.classes['Read:image']?.payload_bytes).toBe(
+                Buffer.byteLength(A, 'utf8') + DATA.length + Buffer.byteLength(B, 'utf8'),
+            );
+        });
+
+        it('empty-content-counts-the-result-at-zero-bytes', () => {
+            for (const block of [{ content: '' }, { content: [] }, {}]) {
+                const cls = scanOne(block).classes['Bash'];
+                expect(cls?.count).toBe(1);
+                expect(cls?.payload_bytes).toBe(0);
+                expect(cls?.unsupported_members).toBe(0);
+            }
+        });
+
+        it('unsupported-members-are-counted-not-silently-dropped', () => {
+            const scan = scanOne({
+                content: [
+                    { type: 'document', source: { type: 'base64', data: 'JVBERi0xLjQ=' } },
+                    { type: 'text', text: 'ok' },
+                    'a bare string member',
+                ],
+            });
+            const cls = scan.classes['Bash'];
+            expect(cls?.payload_bytes).toBe(2);
+            expect(cls?.unsupported_members).toBe(2);
+        });
+    });
 });
diff --git a/tests/scripts/ci_settle_cli.test.ts b/tests/scripts/ci_settle_cli.test.ts
new file mode 100644
index 000000000..03b21e428
--- /dev/null
+++ b/tests/scripts/ci_settle_cli.test.ts
@@ -0,0 +1,41 @@
+/**
+ * `agent-config ci:settle` — the CI waiter reached through the package's own
+ * executable, so a shipped command never names a path under `node_modules/` or
+ * pulls a TypeScript runner from the registry.
+ *
+ * Both cases run with no PR argument: the usage refusal is the one path that
+ * proves the wiring end to end without a network call.
+ */
+import { spawnSync } from 'node:child_process';
+import * as path from 'node:path';
+
+import { describe, expect, it } from 'vitest';
+
+import { findCommand } from '../../src/cli/registry.js';
+
+const ROOT = process.cwd();
+const DISPATCH = path.join(ROOT, 'src/scripts/_dispatch.bash');
+const WRAPPER = path.join(ROOT, 'src/scripts/_cli/cmd_ci_settle.ts');
+const TSX = path.join(ROOT, 'node_modules', '.bin', 'tsx');
+
+function countUsage(stderr: string): number {
+    return stderr.split('usage: ci_settle').length - 1;
+}
+
+describe('ci:settle verb', () => {
+    it('is registered for --help', () => {
+        expect(findCommand('ci:settle')?.disposition).toBe('delegate');
+    });
+
+    it('the dispatcher routes ci:settle to the waiter', () => {
+        const r = spawnSync('bash', [DISPATCH, 'ci:settle'], { encoding: 'utf8', timeout: 60_000 });
+        expect(r.status).toBe(2);
+        expect(countUsage(r.stderr)).toBe(1);
+    });
+
+    it('the wrapper runs the waiter exactly once', () => {
+        const r = spawnSync(TSX, [WRAPPER], { encoding: 'utf8', timeout: 60_000 });
+        expect(r.status).toBe(2);
+        expect(countUsage(r.stderr)).toBe(1);
+    });
+});
diff --git a/tests/scripts/delegation_nudge_hook.test.ts b/tests/scripts/delegation_nudge_hook.test.ts
index c7641bd97..7d4ba5ef3 100644
--- a/tests/scripts/delegation_nudge_hook.test.ts
+++ b/tests/scripts/delegation_nudge_hook.test.ts
@@ -33,4 +33,6 @@ import {
   recommendSliceTier,
   resolveActivation,
+  LEG_COLD_START_SOURCE,
+  LEG_COLD_START_UNCACHED_TOKENS,
 } from "../../src/scripts/hooks/delegation_nudge_hook.js";
 
@@ -295,4 +297,5 @@ describe("buildNudgeLine", () => {
     );
     expect(line).toContain("starts cold");
+    expect(line).toContain(`~${Math.round(LEG_COLD_START_UNCACHED_TOKENS / 1000)}k uncached tokens`);
     expect(line).toContain("one to three direct reads");
     expect(line.endsWith("</delegation-nudge>")).toBe(true);
@@ -306,4 +309,11 @@ describe("buildNudgeLine", () => {
   });
 
+  it("cold-start-figure-matches-its-named-source", () => {
+    // The advisory's number is a measurement; the evidence file it names must
+    // carry it, so a re-taken reading cannot leave the advisory stale silently.
+    const evidence = fs.readFileSync(path.join(REPO_ROOT, LEG_COLD_START_SOURCE), "utf8");
+    expect(evidence).toContain(LEG_COLD_START_UNCACHED_TOKENS.toLocaleString("en-US"));
+  });
+
   it("an unresolved rung renders as rung-? (unreachable in production, kept total for direct callers)", () => {
     const line = buildNudgeLine(
diff --git a/tests/scripts/probe_turnaround_causes.test.ts b/tests/scripts/probe_turnaround_causes.test.ts
index ad61c501f..d746cd83a 100644
--- a/tests/scripts/probe_turnaround_causes.test.ts
+++ b/tests/scripts/probe_turnaround_causes.test.ts
@@ -115,4 +115,9 @@ describe("classifyBlockingCall — 1.1", () => {
   });
 
+  it("reads the packaged waiter verb as a CI wait", () => {
+    expect(classifyBlockingCall("Bash", { command: "agent-config ci:settle 12" })).toBe("ci-wait");
+    expect(classifyBlockingCall("Bash", { command: "cd ../a; ./agent-config ci:settle 12 --timeout-min 28" })).toBe("ci-wait");
+  });
+
   // 2.2: the first reading's unknown share was mostly these, so they got rows.
   it("reads a poll loop's body, a council run and a question to the user", () => {
diff --git a/tests/scripts/push_settle_hook.test.ts b/tests/scripts/push_settle_hook.test.ts
index 04fd44e4c..b968de82f 100644
--- a/tests/scripts/push_settle_hook.test.ts
+++ b/tests/scripts/push_settle_hook.test.ts
@@ -60,5 +60,5 @@ describe("push_settle_hook — the fire path", () => {
     // additional_context, which is what surfaces back to the model.
     expect(out.reason.length).toBeLessThanOrEqual(200);
-    expect(out.additional_context).toContain("ci_settle");
+    expect(out.additional_context).toContain("agent-config ci:settle");
     expect(out.additional_context).toContain("verify-before-complete");
   });
@@ -147,9 +147,16 @@ describe("push_settle_hook — units", () => {
   });
 
-  it("names the literal ci_settle command once the PR is known, and the two-step when it is not", () => {
-    expect(buildReminder("feat/x", 1234).additional_context).toContain("ci_settle 1234");
+  it("names the literal ci:settle command once the PR is known, and the two-step when it is not", () => {
+    expect(buildReminder("feat/x", 1234).additional_context).toContain("agent-config ci:settle 1234");
     const unknown = buildReminder("feat/x", null).additional_context;
     expect(unknown).toContain("gh pr view feat/x");
-    expect(unknown).not.toMatch(/ci_settle \d/); // never invents a number it did not read
+    expect(unknown).toContain("agent-config ci:settle <that number>");
+    expect(unknown).not.toMatch(/ci:settle \d/); // never invents a number it did not read
+  });
+
+  it("never names a source path a consumer install does not have", () => {
+    for (const pr of [1234, null]) {
+      expect(buildReminder("feat/x", pr).additional_context).not.toContain("src/scripts/");
+    }
   });
 
diff --git a/tests/scripts/reread_guard_hook.test.ts b/tests/scripts/reread_guard_hook.test.ts
index 74b131f64..deb52a4e5 100644
--- a/tests/scripts/reread_guard_hook.test.ts
+++ b/tests/scripts/reread_guard_hook.test.ts
@@ -26,4 +26,5 @@ import {
     buildDuplicateReadLine,
     buildPostEditReadLine,
+    compareRead,
     contentDigest,
     deriveSessionKey,
@@ -31,5 +32,4 @@ import {
     isExemptPath,
     isRangedRead,
-    isUnchanged,
     ledgerFile,
 } from '../../src/scripts/hooks/reread_guard_hook.js';
@@ -107,5 +107,5 @@ describe('isRangedRead', () => {
 describe('advisory lines', () => {
     it('the duplicate-read line names the earlier read and the ranged alternative', () => {
-        const line = buildDuplicateReadLine('src/a.ts', 1700000000000);
+        const line = buildDuplicateReadLine('src/a.ts', 1700000000000, 'content');
         expect(line).toContain('src/a.ts');
         expect(line).toContain('already fully read');
@@ -120,20 +120,72 @@ describe('advisory lines', () => {
 
 describe('content key and its size bound (D3)', () => {
+    const HASHED_A = { kind: 'sha256', value: 'a' } as const;
+    const HASHED_B = { kind: 'sha256', value: 'b' } as const;
+    const OVER = { kind: 'over-bound' } as const;
+    const UNREADABLE = { kind: 'unreadable' } as const;
+    const BIG = HASH_BOUND_BYTES + 10;
+
     it('compares digests when both reads carry one, whatever the stat pair says', () => {
-        expect(isUnchanged({ mtime: 1, size: 5, ts: 0, sha256: 'a' }, 1, 5, 'b')).toBe(false);
-        expect(isUnchanged({ mtime: 1, size: 5, ts: 0, sha256: 'a' }, 2, 5, 'a')).toBe(true);
+        expect(compareRead({ mtime: 1, size: 5, ts: 0, sha256: 'a' }, 1, 5, HASHED_B)).toBeNull();
+        expect(compareRead({ mtime: 1, size: 5, ts: 0, sha256: 'a' }, 2, 5, HASHED_A)).toBe('content');
     });
-    it('falls back to mtime + size when either read is over the bound', () => {
-        expect(isUnchanged({ mtime: 1, size: 5, ts: 0 }, 1, 5, undefined)).toBe(true);
-        expect(isUnchanged({ mtime: 1, size: 5, ts: 0, sha256: 'a' }, 2, 5, undefined)).toBe(false);
+
+    it('falls back to mtime + size only for a file over the bound, and names that basis', () => {
+        expect(compareRead({ mtime: 1, size: BIG, ts: 0 }, 1, BIG, OVER)).toBe('stat-over-bound');
+        expect(compareRead({ mtime: 1, size: BIG, ts: 0 }, 2, BIG, OVER)).toBeNull();
     });
-    it('hashes nothing above the bound, and the line says which basis it used', () => {
-        expect(contentDigest('/nonexistent-is-not-read', HASH_BOUND_BYTES + 1)).toBeUndefined();
-        expect(buildDuplicateReadLine('a.ts', 0, true)).toContain('unchanged content');
-        expect(buildDuplicateReadLine('a.ts', 0, false)).toContain('2 MB hash bound');
+
+    it('never asserts unchanged for a hash-eligible file without both digests', () => {
+        // A legacy ledger entry (written before the digest existed) beside an equal stat pair.
+        expect(compareRead({ mtime: 1, size: 5, ts: 0 }, 1, 5, HASHED_A)).toBeNull();
+        // The current read could not be hashed.
+        expect(compareRead({ mtime: 1, size: 5, ts: 0, sha256: 'a' }, 1, 5, UNREADABLE)).toBeNull();
+        expect(compareRead({ mtime: 1, size: 5, ts: 0 }, 1, 5, UNREADABLE)).toBeNull();
+    });
+
+    it('the duplicate line states the basis it used', () => {
+        expect(buildDuplicateReadLine('a.ts', 0, 'content')).toContain('unchanged content');
+        expect(buildDuplicateReadLine('a.ts', 0, 'stat-over-bound')).toContain('2 MB hash bound');
+        expect(buildDuplicateReadLine('a.ts', 0, 'content')).not.toContain('hash bound');
+    });
+
+    describe('contentDigest reads real files, never past the bound', () => {
+        function realFile(bytes: number): string {
+            const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'reread-digest-'));
+            tmp_dirs.push(dir);
+            const f = path.join(dir, 'f.bin');
+            fs.writeFileSync(f, Buffer.alloc(bytes, 0x61));
+            return f;
+        }
+
+        it('hashes a file at the bound', () => {
+            const f = realFile(HASH_BOUND_BYTES);
+            expect(contentDigest(f, HASH_BOUND_BYTES)).toEqual({
+                kind: 'sha256',
+                value: createHash('sha256').update(fs.readFileSync(f)).digest('hex'),
+            });
+        });
+
+        it('skips the read when the stat size is over the bound', () => {
+            // A small, readable file: hashing it would succeed, so over-bound proves the skip.
+            const f = realFile(16);
+            expect(contentDigest(f, HASH_BOUND_BYTES + 1)).toEqual({ kind: 'over-bound' });
+        });
+
+        it('stops at the bound when the file is larger than its stat said', () => {
+            // The file grew between stat and read: the read itself must enforce the bound.
+            const f = realFile(HASH_BOUND_BYTES + 1);
+            expect(contentDigest(f, 16)).toEqual({ kind: 'over-bound' });
+        });
+
+        it('reports a read failure as its own state, not as over the bound', () => {
+            const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'reread-digest-'));
+            tmp_dirs.push(dir);
+            expect(contentDigest(path.join(dir, 'missing'), 16)).toEqual({ kind: 'unreadable' });
+        });
     });
 });
 
-// ── E2E sequences through the ledger ────────────────────────────────────
+// E2E sequences through the ledger.
 
 describe('reread_guard_hook E2E', () => {
@@ -246,4 +298,30 @@ describe('reread_guard_hook E2E', () => {
     });
 
+    it('legacy-ledger-entry-without-digest-is-not-asserted-unchanged', () => {
+        // A read recorded before the digest existed: equal stat pair, no sha256.
+        const { root, abs } = makeWorkspace();
+        const st = fs.statSync(abs);
+        const key = deriveSessionKey({ session_id: 'sess-1' }, {});
+        const file = ledgerFile(root, key);
+        fs.mkdirSync(path.dirname(file), { recursive: true });
+        fs.writeFileSync(
+            file,
+            JSON.stringify({ reads: { 'src/target.ts': { mtime: st.mtimeMs, size: st.size, ts: 1 } }, writes: {}, fired: {} }),
+        );
+        const second = run(readEvent(root, abs), root);
+        expect(second.status).toBe(0);
+        expect(second.stdout.trim()).toBe('');
+    });
+
+    it('over-bound-duplicate-read-fires-on-the-stat-basis-and-says-so', () => {
+        const { root } = makeWorkspace();
+        const big = path.join(root, 'src', 'big.txt');
+        fs.writeFileSync(big, Buffer.alloc(HASH_BOUND_BYTES + 1, 0x62));
+        expect(run(readEvent(root, big), root).status).toBe(0);
+        const second = run(readEvent(root, big), root);
+        expect(second.status).toBe(2);
+        expect(JSON.parse(second.stdout).additional_context).toContain('2 MB hash bound');
+    });
+
     it('the ledger stores paths, numbers and a sha256 digest only — no content field', () => {
         const { root, abs } = makeWorkspace();
```
