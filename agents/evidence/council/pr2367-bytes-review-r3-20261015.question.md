<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-15 (round 3, the review of
     PR #2367 at head 939427f6c), committed verbatim below this header so the
     verdict recorded beside it can be checked against what was actually asked.
     The header is the only addition; the prompt was not edited after the run. -->

# Review PR #2367 — fixes after the PR #2363 council review (round 3)

Review this change. Scope: the code, command and test diff below against origin/main. It fixes the findings of two earlier council rounds on PR #2363 (ci_settle invocation path for consumer installs; an unenforced transfer bound in analyze-repo --deep; payload-vs-block metric naming; repeated-read guard digest states and a growth race; a vacuous size-bound test; a TOCTOU read; a hard-coded cold-start figure). Omitted for size: pack.yaml token sums, three small test files (push_settle_hook, delegation_nudge_hook, probe_turnaround_causes), the evidence files, the roadmap archive notes, the council record, the budget files and dist/ projections.

Report defects: correctness, security, consumer-install breakage, tests that would pass without the code they cover, documentation claims the code does not honour. For each: file:line, the failure scenario, severity. State your stance.

```diff
diff --git a/src/cli/registry.ts b/src/cli/registry.ts
index 1b0923e0d..99fbe3ca7 100644
--- a/src/cli/registry.ts
+++ b/src/cli/registry.ts
@@ -56,6 +56,7 @@ export const REGISTRY: readonly CommandEntry[] = [
     { name: 'packs', disposition: 'native', synopsis: 'List packs from the discovery manifest (ls subcommand).' },
     { name: 'packs:active', disposition: 'delegate', synopsis: 'Which packs are active here, from which file — names the degraded zero-pack case.' },
     { name: 'brand:status', disposition: 'delegate', synopsis: 'Whether a consumer brand tokens file is present, where, and dot-prefixed near-misses.' },
+    { name: 'ci:settle', disposition: 'delegate', synopsis: "Wait for a PR's checks to settle; the last output line is the verdict." },
     { name: 'commands', disposition: 'native', synopsis: 'List/explain the command surface from the discovery manifest (ls / explain subcommands); ls --candidates reports surface-reduction signals.' },
     { name: 'help', disposition: 'native', synopsis: 'Show TS-shell help; delegates --tier=N to Bash.' },
     { name: 'explain', disposition: 'delegate', synopsis: 'Read-only decision-chain trace (config | rule <name> | route "<text>") or command explanation.' },
diff --git a/src/config/metric-registry.yml b/src/config/metric-registry.yml
index 830a52746..3f3cd7176 100644
--- a/src/config/metric-registry.yml
+++ b/src/config/metric-registry.yml
@@ -153,7 +153,8 @@ metrics:
   # `tool_response` a post_tool_use hook receives — not what reached the model.
   # For Edit and Write the hook envelope carries the whole original file: over 12
   # local transcripts it was 19.5x the model-visible bytes (Bash 1.44x, Read
-  # within 0.1 %). What reached the model is `tool-model-visible-bytes` below.
+  # within 0.1 %). The payload that reached the model is `tool-result-payload-bytes`
+  # below.
   - id: tool-raw-bytes
     unit: bytes
     basis: measured
@@ -180,7 +181,7 @@ metrics:
       the same census reader, comparing it against `tool-raw-bytes` on the same
       line. Equal by construction today, because nothing in this tree rewrites
       a tool result on its way back to the host. Both count the hook envelope,
-      not what reached the model — that is `tool-model-visible-bytes`.
+      not what reached the model — its payload is `tool-result-payload-bytes`.
     decision: >-
       whether a result-rewriting mechanism, if one ever lands, reduced anything.
       A non-zero gap between the two columns is the reduction; no gap is no
@@ -190,10 +191,16 @@ metrics:
       and can only assert an improvement. The two columns exist now precisely
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
       `road-to-tool-results-that-leave-a-handle` and the placeholders roadmap
@@ -201,8 +208,10 @@ metrics:
       checking which bytes it counted.
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
       Edit and Write by an order of magnitude, and a reduction plan aims at
diff --git a/src/domains/analysis-workbench/analyze/repo/command.md b/src/domains/analysis-workbench/analyze/repo/command.md
index 75386533d..4d2f854bf 100644
--- a/src/domains/analysis-workbench/analyze/repo/command.md
+++ b/src/domains/analysis-workbench/analyze/repo/command.md
@@ -98,7 +98,7 @@ overriding the budget:**
 ### Read ceiling per loop
 
 Loop *n* cannot read deeper than the seed pass without a local clone, so
-`--deep` (§ 2b) becomes the **default whenever the loop runs**. The four-part
+`--deep` (§ 2b) becomes the **default whenever the loop runs**. The three-part
 ceiling of § 2b applies per loop, and the loop that hits it logs one
 read-ceiling line naming the bound that fired.
 
@@ -162,7 +162,7 @@ seed pass's is a defect in the run, not a finding about the reference.
 
 Because loop *n* cannot read deeper than the seed pass without a local clone,
 `--deep` (§ 2b) is the default whenever the loop runs. Each loop that hits the
-§ 2b four-part ceiling logs **one** read-ceiling line naming the bound
+§ 2b three-part ceiling logs **one** read-ceiling line naming the bound
 that fired and the loop it fired in.
 
 ### 2b. Deep verification tier — `--deep`, opt-in
@@ -182,12 +182,19 @@ all. Otherwise fetch **only that commit, at depth 1**, into a fresh directory:
 Never a full-history clone, and no persistent object store: `--deep` is opt-in
 and rare, and a store is a maintenance surface for a rare path.
 
-The fetch ceiling is replaced by a **four-part ceiling**: an operation count, a
-total-bytes-read bound, a wall-clock bound, and a **bytes-transferred** bound —
-**whichever is hit first**, with the bound that fired recorded. The transfer
-figure is read from git's own receive line (`Receiving objects: … | <size>`),
-recorded as `0` when a local clone was reused; an over-bound transfer stops the
-run before a file is read. A bare read count bounds nothing (forty
+The fetch ceiling is replaced by a **three-part ceiling** — an operation count,
+a total-bytes-read bound and a wall-clock bound, **whichever is hit first**, with
+the bound that fired recorded — plus a **best-effort pre-fetch size gate**, which
+is not a ceiling and does not bound the transfer. Before fetching, read the
+host's reported repository size (on GitHub,
+`gh api repos/<owner>/<repo> --jq .size`, in KiB) and do not fetch when it
+exceeds the gate. That figure is the whole repository at the moment of the
+call, so it is an estimate, never a measurement. Nothing here stops a fetch that
+is already running: `git fetch` gives no enforceable mid-transfer limit, and a
+host that reports no size leaves the transfer unbounded — record that gap rather
+than a figure. After the fetch, record the clone's `.git` size on disk (`0` when
+a local clone was reused); it is local storage, not bytes received. A bare
+read count bounds nothing (forty
 reads is one README or one 2 MB generated schema, and traversing a monorepo
 costs time a file count never expresses). Cloning **parses**
 attacker-influenceable data before a file is opened: the cloned tree is data,
@@ -567,7 +574,7 @@ pins something; it just does not name it. Contract and field shapes:
   and "just run their tests to check" is a violation, not a shortcut.
 - No credentials in fetches. Public GitHub API is enough. For private mirrors,
   take a PAT via env var and never echo it.
-- Max 40 fetches without explicit extension; under `--deep` the four-part
+- Max 40 fetches without explicit extension; under `--deep` the three-part
   ceiling of § 2b replaces it — the cost bound never disappears with the count.
 - No auto-commits — the analysis is a draft until the user accepts.
 
diff --git a/src/domains/engineering-base/fix/ci/command.md b/src/domains/engineering-base/fix/ci/command.md
index 835dfc318..ad65e799d 100644
--- a/src/domains/engineering-base/fix/ci/command.md
+++ b/src/domains/engineering-base/fix/ci/command.md
@@ -25,7 +25,7 @@ A run still in progress has no verdict to fix. Do NOT read a partial run and
 start guessing — and do NOT end the turn reporting "CI is running".
 
 ```bash
-npx tsx node_modules/@event4u/agent-config/src/scripts/ci_settle.ts <n>
+agent-config ci:settle <n>
 ```
 
 `ci_settle` is the one waiter for this condition — never a hand-written
diff --git a/src/domains/git/pr/create/command.md b/src/domains/git/pr/create/command.md
index acedde231..3b3299810 100644
--- a/src/domains/git/pr/create/command.md
+++ b/src/domains/git/pr/create/command.md
@@ -484,7 +484,7 @@ Pending is a reason to wait, never a reason to stop.
 **Settled** means every check has reached a terminal state:
 
 ```bash
-npx tsx node_modules/@event4u/agent-config/src/scripts/ci_settle.ts <n>
+agent-config ci:settle <n>
 gh pr checks <n> --json name,state,link \
   --jq '.[] | select(.state!="SUCCESS" and .state!="SKIPPED") | "\(.state)  \(.name)  \(.link)"'
 ```
diff --git a/src/domains/product-basic/roadmap/process-full/command.md b/src/domains/product-basic/roadmap/process-full/command.md
index 120b9236b..2d7050756 100644
--- a/src/domains/product-basic/roadmap/process-full/command.md
+++ b/src/domains/product-basic/roadmap/process-full/command.md
@@ -165,7 +165,7 @@ command is a claim; a layer with one is a check.
 | 1 | A targeted local RED, then GREEN | the test runner filtered to the failing name — `npm run test:ts -- <file>`, never the suite |
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
@@ -80,6 +80,8 @@ TS-shell native (run via the installed `agent-config` binary):
   brand:status               Is a consumer brand layer present, and at which of the
                              four canonical tokens.json paths. Flags a dot-prefixed
                              .tokens.json, which nothing reads.
+  ci:settle <pr>             Wait for a PR's checks to settle; the last line is the
+                             verdict (exit 0 green · 1 red · 2 no verdict).
   packs:active               Which packs are active HERE, and from which file.
                              Names the degraded case (settings file without a
                              profile.id → zero packs) that nothing else reports.
@@ -838,6 +840,12 @@ cmd_brand_status() {
   exec_ts "$PACKAGE_ROOT/src/scripts/_cli/cmd_brand_status.ts" "$@"
 }
 
+# `ci:settle <pr>` — the one CI waiter, through the package's own executable so a
+# shipped command never names a node_modules path or fetches a TS runner.
+cmd_ci_settle() {
+  exec_ts "$PACKAGE_ROOT/src/scripts/_cli/cmd_ci_settle.ts" "$@"
+}
+
 # `--archive`: a completed roadmap is archived here rather than reported as a
 # warning the caller has to act on. `roadmap:progress-check` never passes it —
 # a CI gate must not mutate the tree it is checking. Pass `--no-archive` to get
@@ -1598,6 +1606,7 @@ main() {
     git:convention)          cmd_git_convention "$@" ;;
     mcp:available)           cmd_mcp_available "$@" ;;
     brand:status)            cmd_brand_status "$@" ;;
+    ci:settle)               cmd_ci_settle "$@" ;;
     roadmap:context)         cmd_roadmap_context "$@" ;;
     roadmap:progress)        cmd_roadmap_progress "$@" ;;
     roadmap:progress-check)  cmd_roadmap_progress_check "$@" ;;
diff --git a/src/scripts/_lib/cc_transcript.ts b/src/scripts/_lib/cc_transcript.ts
index 76b2a76d5..ad3b68f34 100644
--- a/src/scripts/_lib/cc_transcript.ts
+++ b/src/scripts/_lib/cc_transcript.ts
@@ -476,24 +476,32 @@ export function aggregateByBucket(records: readonly TranscriptRecord[]): Record<
 /* -------------------------------------------------------------------------- */
 
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
 
 export interface ToolResultScan {
@@ -509,7 +517,7 @@ interface RawBlock {
     tool_use_id?: unknown;
     content?: unknown;
     text?: unknown;
-    source?: { data?: unknown };
+    source?: { type?: unknown; data?: unknown };
 }
 
 function blocksOf(raw: { message?: { content?: unknown } }): RawBlock[] {
@@ -517,23 +525,30 @@ function blocksOf(raw: { message?: { content?: unknown } }): RawBlock[] {
     return Array.isArray(c) ? (c.filter((b) => typeof b === 'object' && b !== null) as RawBlock[]) : [];
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
+        } else if (m !== null && m.type === 'image' && m.source?.type === 'base64' && typeof m.source.data === 'string') {
+            out.image = true;
+            out.bytes += m.source.data.length;
+        } else {
+            out.unsupported += 1;
         }
     }
-    return { bytes, image };
+    return out;
 }
 
 function readLines(file: string): string[] {
@@ -545,7 +560,7 @@ function readLines(file: string): string[] {
 }
 
 /**
- * Model-visible tool-result bytes per tool class, joined to the tool name by
+ * Tool-result payload bytes per tool class, joined to the tool name by
  * `tool_use_id`. Two passes over the file set — names first, results second —
  * so a result whose `tool_use` sits in another file still joins. A result whose
  * id joins nothing is counted under `unknown`, never dropped and never guessed.
@@ -578,20 +593,22 @@ export function scanToolResults(opts: ScanOptions = {}): ToolResultScan {
                 const id = block.tool_use_id as string;
                 if (seen.has(id)) continue;
                 seen.add(id);
-                const { bytes, image } = modelVisibleBytes(block);
+                const { bytes, image, unsupported } = payloadOf(block);
                 const name = names.get(id) ?? 'unknown';
                 const tool = image ? `${name}:image` : name;
                 const cls = (classes[tool] ??= {
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
                 if (env === undefined || env === null) {
diff --git a/src/scripts/_lib/tool_result_census.ts b/src/scripts/_lib/tool_result_census.ts
index ba7d21c41..2cd9d05d0 100644
--- a/src/scripts/_lib/tool_result_census.ts
+++ b/src/scripts/_lib/tool_result_census.ts
@@ -13,7 +13,7 @@
  * every line written before the second field existed.
  *
  * Neither shape counts what reached the model; that is
- * `tool-model-visible-bytes`, read from transcripts (`cc_transcript.ts`).
+ * `tool-result-payload-bytes`, read from transcripts (`cc_transcript.ts`).
  */
 
 export type CensusShape = 'legacy' | 'two-field';
diff --git a/src/scripts/ci_settle.ts b/src/scripts/ci_settle.ts
index 2f4645fc4..85f79fdab 100644
--- a/src/scripts/ci_settle.ts
+++ b/src/scripts/ci_settle.ts
@@ -51,6 +51,7 @@
  */
 
 import { spawnSync } from 'node:child_process';
+import * as path from 'node:path';
 
 /**
  * The largest default deadline that fits inside one foreground `Bash` call.
@@ -565,6 +566,8 @@ export function main(argv: readonly string[]): number {
     }
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
@@ -348,6 +348,14 @@ export function recommendSliceTier(downshift: boolean, separate_quota_pool: bool
   return decision.tier;
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
  * `rung-?` — this concern only ever calls it for a `subagent` verdict
@@ -403,11 +411,11 @@ export function buildNudgeLine(
   // Rung 1 (single bounded slice) carries no do-in-steps/do-in-parallel
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
     `<delegation-nudge>${rungLabel}: dispatch ${modeLabel} ` +
diff --git a/src/scripts/hooks/push_settle_hook.ts b/src/scripts/hooks/push_settle_hook.ts
index 71fefe311..1e9e11d8a 100644
--- a/src/scripts/hooks/push_settle_hook.ts
+++ b/src/scripts/hooks/push_settle_hook.ts
@@ -176,8 +176,8 @@ export function buildReminder(branch: string, pr: number | null): { reason: stri
   const settle =
     pr === null
       ? `gh pr view ${branch} --json number -q .number   # then:\n` +
-        `./scripts-run src/scripts/ci_settle <that number>`
-      : `./scripts-run src/scripts/ci_settle ${pr}`;
+        `agent-config ci:settle <that number>`
+      : `agent-config ci:settle ${pr}`;
   const subject = pr === null ? `branch ${branch}` : `PR #${pr} (${branch})`;
   const reason =
     `Pushed ${subject} — the turn is not finished until its CI has settled green ` +
diff --git a/src/scripts/hooks/reread_guard_hook.ts b/src/scripts/hooks/reread_guard_hook.ts
index 2f46837cb..73e7776f5 100644
--- a/src/scripts/hooks/reread_guard_hook.ts
+++ b/src/scripts/hooks/reread_guard_hook.ts
@@ -7,7 +7,8 @@
  *
  *   6.1 A full-file `Read` of a path that was ALREADY fully read this session
  *       AND whose content is unchanged since (sha256 compare against the
- *       ledger; above HASH_BOUND_BYTES, mtime + size, said so in the line) gets
+ *       ledger; above HASH_BOUND_BYTES, mtime + size, said so in the line; a
+ *       file under the bound without both digests never fires) gets
  *       one advisory line naming the earlier read and the ranged-read
  *       alternative. A ranged read (any `offset`/`limit` in the tool input)
  *       is already the cheap form and never fires — nor is it recorded as a
@@ -111,7 +112,7 @@ export interface ReadRecord {
     mtime: number;
     size: number;
     ts: number;
-    /** sha256 of the file; absent above {@link HASH_BOUND_BYTES}. */
+    /** sha256 of the file; absent above {@link HASH_BOUND_BYTES}, on a read failure, or in a legacy entry. */
     sha256?: string;
 }
 
@@ -121,20 +122,62 @@ export interface ReadRecord {
  */
 export const HASH_BOUND_BYTES = 2 * 1024 * 1024;
 
-/** sha256 of a file at or under the bound; `undefined` above it or on error. */
-export function contentDigest(absPath: string, size: number): string | undefined {
-    if (size > HASH_BOUND_BYTES) return undefined;
+/**
+ * What the content key could say about one read. Only `over-bound` — the stat
+ * itself was over — licenses the stat fallback: after `grew-during-read` the
+ * stat pair is stale, and after `unreadable` nothing was compared.
+ */
+export type Digest =
+    | { kind: 'sha256'; value: string }
+    | { kind: 'over-bound' }
+    | { kind: 'grew-during-read' }
+    | { kind: 'unreadable' };
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
+        if (filled > HASH_BOUND_BYTES) return { kind: 'grew-during-read' };
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
 
 /** The session ledger — paths as keys, numbers as values, no content field. */
@@ -208,9 +251,10 @@ export function isRangedRead(toolInput: JsonObject): boolean {
 }
 
 /** 6.1 advisory — duplicate full read of an unchanged, already-read path. */
-export function buildDuplicateReadLine(relPath: string, earlierTs: number, byContent = true): string {
+export function buildDuplicateReadLine(relPath: string, earlierTs: number, compared: CompareBasis): string {
     const when = new Date(earlierTs).toISOString();
-    const basis = byContent ? 'unchanged content (same sha256)' : 'unchanged since (same mtime+size; over the 2 MB hash bound)';
+    const basis =
+        compared === 'content' ? 'unchanged content (same sha256)' : 'unchanged since (same mtime+size; over the 2 MB hash bound)';
     return (
         `re-read guard: ${relPath} was already fully read this session (${when}) with ` +
         `${basis} — the content is still in context; if you only ` +
@@ -278,21 +322,23 @@ export function main(): number {
             return EXIT_ALLOW; // unreadable/missing target — nothing to compare
         }
 
-        const sha256 = contentDigest(absPath, size);
+        const digest = contentDigest(absPath, size);
         const prior = ledger.reads[key];
         const ownWrite = ledger.writes[key];
         const alreadyFired = ledger.fired[key] === true;
 
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
         writeLedger(workspaceRoot, sessionKey, ledger);
diff --git a/src/scripts/hooks/tool_result_bytes_hook.ts b/src/scripts/hooks/tool_result_bytes_hook.ts
index 339a24a67..6cc5e61e9 100644
--- a/src/scripts/hooks/tool_result_bytes_hook.ts
+++ b/src/scripts/hooks/tool_result_bytes_hook.ts
@@ -52,8 +52,8 @@
  * hook — and NOT what reached the model. The two differ by tool: for Edit and
  * Write the hook envelope carries the whole original file while the model
  * receives a short confirmation (measured over 12 local transcripts: 19.5x;
- * Bash 1.44x; Read within 0.1 %). The model-visible figure is a separate
- * metric, `tool-model-visible-bytes`, read from transcripts. `raw_bytes` is
+ * Bash 1.44x; Read within 0.1 %). The payload the model received is a separate
+ * metric, `tool-result-payload-bytes`, read from transcripts. `raw_bytes` is
  * the hook envelope the host handed the dispatcher; `delivered_bytes` is the
  * hook envelope after any rewrite a concern could apply on its way back.
  * Today they are EQUAL BY CONSTRUCTION, and the construction is
@@ -207,7 +207,7 @@ export interface CensusLine {
     raw_bytes: number | null;
     /**
      * UTF-8 bytes of the hook envelope after any rewrite — NOT what reached
-     * the model (see the header; that figure is `tool-model-visible-bytes`).
+     * the model (see the header; that figure is `tool-result-payload-bytes`).
      *
      * Equal to {@link CensusLine.raw_bytes} by construction today — nothing in
      * this tree rewrites a tool result. It is recorded anyway so that a later
diff --git a/src/scripts/probe_turnaround.ts b/src/scripts/probe_turnaround.ts
index c9e2c9a5b..085cff327 100644
--- a/src/scripts/probe_turnaround.ts
+++ b/src/scripts/probe_turnaround.ts
@@ -94,6 +94,7 @@ const TOOL_CAUSE: Readonly<Record<string, BlockingCause>> = {
  */
 const SHELL_RULES: ReadonlyArray<readonly [RegExp, BlockingCause]> = [
     [/^(\S*\/)?scripts-run \S*ci_settle\b/, 'ci-wait'],
+    [/^(\S*\/)?agent-config ci:settle\b/, 'ci-wait'],
     [/^gh (run watch|pr checks)\b/, 'ci-wait'],
     [/^(sleep|until|while|watch)\b/, 'sleep-poll'],
     [/^((npx |\S*node_modules\/\.bin\/)?(vitest|jest|pytest|phpunit)\b|npm (run )?test\b|task (ci|test)\b)/, 'test'],
diff --git a/tests/scripts/cc_transcript.test.ts b/tests/scripts/cc_transcript.test.ts
index dc5b323e5..26d99f194 100644
--- a/tests/scripts/cc_transcript.test.ts
+++ b/tests/scripts/cc_transcript.test.ts
@@ -395,7 +395,7 @@ describe('derivedBytes - a derived figure can never be read as a counted one', (
     });
 });
 
-describe('scanToolResults - the model-visible bytes of a tool result, per tool class', () => {
+describe('scanToolResults - the payload bytes of a tool result, per tool class', () => {
     // An Edit whose hook envelope carries the whole original file, while the
     // model receives only the confirmation line. Every expected figure is
     // computed from these constants, never copied from a run.
@@ -459,20 +459,83 @@ describe('scanToolResults - the model-visible bytes of a tool result, per tool c
         const scan = scanToolResults({ root, projectDir });
         const edit = scan.classes['Edit'];
         expect(edit?.count).toBe(1);
-        expect(edit?.model_visible_bytes).toBe(Buffer.byteLength(CONFIRMATION, 'utf8'));
+        expect(edit?.payload_bytes).toBe(Buffer.byteLength(CONFIRMATION, 'utf8'));
         expect(edit?.envelope_bytes).toBe(Buffer.byteLength(JSON.stringify(EDIT_ENVELOPE), 'utf8'));
-        expect(edit?.envelope_bytes ?? 0).toBeGreaterThan((edit?.model_visible_bytes ?? 0) * 10);
+        expect(edit?.envelope_bytes ?? 0).toBeGreaterThan((edit?.payload_bytes ?? 0) * 10);
     });
 
     it('counts text blocks, separates image Reads, and keeps orphans in their own class', () => {
         const root = mkTmp();
         const projectDir = writeToolFixture(root);
         const scan = scanToolResults({ root, projectDir });
-        expect(scan.classes['Bash']?.model_visible_bytes).toBe(Buffer.byteLength(BASH_OUT, 'utf8'));
-        expect(scan.classes['Read:image']?.model_visible_bytes).toBe(IMAGE_DATA.length);
+        expect(scan.classes['Bash']?.payload_bytes).toBe(Buffer.byteLength(BASH_OUT, 'utf8'));
+        expect(scan.classes['Read:image']?.payload_bytes).toBe(IMAGE_DATA.length);
         expect(scan.classes['Read:image']?.envelope_bytes).toBeNull();
         expect(scan.classes['Read']).toBeUndefined();
         expect(scan.classes['unknown']?.count).toBe(1);
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
+                    { type: 'image', source: { type: 'url', data: 'https://example.com/x.png' } },
+                    { type: 'text', text: 'ok' },
+                    'a bare string member',
+                ],
+            });
+            const cls = scan.classes['Bash'];
+            expect(cls?.payload_bytes).toBe(2);
+            expect(cls?.unsupported_members).toBe(3);
+            expect(scan.classes['Bash:image']).toBeUndefined();
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
diff --git a/tests/scripts/reread_guard_hook.test.ts b/tests/scripts/reread_guard_hook.test.ts
index 74b131f64..28fb5ec16 100644
--- a/tests/scripts/reread_guard_hook.test.ts
+++ b/tests/scripts/reread_guard_hook.test.ts
@@ -25,12 +25,12 @@ import { afterEach, describe, expect, it } from 'vitest';
 import {
     buildDuplicateReadLine,
     buildPostEditReadLine,
+    compareRead,
     contentDigest,
     deriveSessionKey,
     HASH_BOUND_BYTES,
     isExemptPath,
     isRangedRead,
-    isUnchanged,
     ledgerFile,
 } from '../../src/scripts/hooks/reread_guard_hook.js';
 
@@ -106,7 +106,7 @@ describe('isRangedRead', () => {
 
 describe('advisory lines', () => {
     it('the duplicate-read line names the earlier read and the ranged alternative', () => {
-        const line = buildDuplicateReadLine('src/a.ts', 1700000000000);
+        const line = buildDuplicateReadLine('src/a.ts', 1700000000000, 'content');
         expect(line).toContain('src/a.ts');
         expect(line).toContain('already fully read');
         expect(line).toContain('offset/limit');
@@ -119,22 +119,82 @@ describe('advisory lines', () => {
 });
 
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
+    });
+
+    it('falls back to mtime + size only for a file over the bound, and names that basis', () => {
+        expect(compareRead({ mtime: 1, size: BIG, ts: 0 }, 1, BIG, OVER)).toBe('stat-over-bound');
+        expect(compareRead({ mtime: 1, size: BIG, ts: 0 }, 2, BIG, OVER)).toBeNull();
     });
-    it('falls back to mtime + size when either read is over the bound', () => {
-        expect(isUnchanged({ mtime: 1, size: 5, ts: 0 }, 1, 5, undefined)).toBe(true);
-        expect(isUnchanged({ mtime: 1, size: 5, ts: 0, sha256: 'a' }, 2, 5, undefined)).toBe(false);
+
+    it('never asserts unchanged for a hash-eligible file without both digests', () => {
+        // A legacy ledger entry (written before the digest existed) beside an equal stat pair.
+        expect(compareRead({ mtime: 1, size: 5, ts: 0 }, 1, 5, HASHED_A)).toBeNull();
+        // The current read could not be hashed.
+        expect(compareRead({ mtime: 1, size: 5, ts: 0, sha256: 'a' }, 1, 5, UNREADABLE)).toBeNull();
+        expect(compareRead({ mtime: 1, size: 5, ts: 0 }, 1, 5, UNREADABLE)).toBeNull();
     });
-    it('hashes nothing above the bound, and the line says which basis it used', () => {
-        expect(contentDigest('/nonexistent-is-not-read', HASH_BOUND_BYTES + 1)).toBeUndefined();
-        expect(buildDuplicateReadLine('a.ts', 0, true)).toContain('unchanged content');
-        expect(buildDuplicateReadLine('a.ts', 0, false)).toContain('2 MB hash bound');
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
+            expect(contentDigest(f, 16)).toEqual({ kind: 'grew-during-read' });
+        });
+
+        it('a file that grew past the bound after its stat is never called unchanged', () => {
+            // The stale stat pair matches the prior read; the content does not.
+            const f = realFile(HASH_BOUND_BYTES + 1);
+            const prior = { mtime: 1, size: 16, ts: 0, sha256: 'a' };
+            expect(compareRead(prior, 1, 16, contentDigest(f, 16))).toBeNull();
+            expect(compareRead({ mtime: 1, size: 16, ts: 0 }, 1, 16, contentDigest(f, 16))).toBeNull();
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
     it('6.1: fires (exit 2) on a duplicate full read of an unchanged file — silent on the first', () => {
@@ -245,6 +305,32 @@ describe('reread_guard_hook E2E', () => {
         expect(run(readEvent(root, other), root).status).toBe(2); // path B fires independently
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
         expect(run(readEvent(root, abs), root).status).toBe(0);
```
