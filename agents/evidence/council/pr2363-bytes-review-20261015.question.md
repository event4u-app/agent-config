<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-15 (round 1 of the PR #2363
     review), committed verbatim below this header so the verdict recorded
     beside it can be checked against what was actually asked. The header is
     the only addition; the prompt was not edited after the run. -->

# Review PR #2363 — bytes the model actually receives

Review this change. Scope: the production, docs and test diff below, against origin/main. Omitted from this bundle for size: dist/ projections (generated), dist/install/install.mjs (generated bundle), pack.yaml token sums, the two evidence files and the roadmap edits.

The change: census fields documented as host-envelope bytes; a transcript scanner counting model-visible bytes per tool class; a census reader for legacy lines; the repeated-read guard compares a sha256 up to 2 MB (mtime+size above); the MCP npx entry adds --prefer-offline only for a pinned version; /fix ci and /create-pr call ci_settle; analyze-repo --deep reuses a local clone or fetches one commit; a delegation-nudge advisory clause.

Report defects: correctness, security or privacy, behaviour changes the description does not state, tests that would pass without the code they cover, consumer-install breakage. For each: file:line, the failure scenario, severity. State your stance.

```diff
diff --git a/docs/getting-started-local-stdio.md b/docs/getting-started-local-stdio.md
index 59457d1f6..1b2dadb20 100644
--- a/docs/getting-started-local-stdio.md
+++ b/docs/getting-started-local-stdio.md
@@ -18,7 +18,7 @@ agent-config --version    # confirms the binary is on your PATH
 ```
 
 No global install? Every config below also works with
-`"command": "npx", "args": ["-y", "@event4u/agent-config", "mcp-server"]`.
+`"command": "npx", "args": ["--prefer-offline", "-y", "@event4u/agent-config@<version>", "mcp-server"]` — pin the version you installed; with a pin, `--prefer-offline` lets a warm npm cache start the server without a registry request.
 
 ## 2. Point your client at it
 
diff --git a/docs/mcp-server.md b/docs/mcp-server.md
index 823919dc8..86a71b5d8 100644
--- a/docs/mcp-server.md
+++ b/docs/mcp-server.md
@@ -81,7 +81,9 @@ following the docs and running the installer land on the same server.
 Replace `<version>` with the release you installed (`npx @event4u/agent-config --version`).
 The pin is deliberate: unpinned, `npx -y @event4u/agent-config` resolves the `latest`
 dist-tag on every server start, so the server you run would be whatever the registry
-served most recently rather than the one you approved.
+served most recently rather than the one you approved. With the pin, `--prefer-offline`
+lets a warm npm cache start the server without a registry request — the cache can hold
+only that exact version — and a cold cache still resolves from the registry.
 
 
 ### Claude Desktop
@@ -94,7 +96,7 @@ or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):
   "mcpServers": {
     "agent-config": {
       "command": "npx",
-      "args": ["-y", "@event4u/agent-config@<version>", "mcp-server"]
+      "args": ["--prefer-offline", "-y", "@event4u/agent-config@<version>", "mcp-server"]
     }
   }
 }
@@ -112,7 +114,7 @@ appear under the connector dropdown.
   "mcpServers": {
     "agent-config": {
       "command": "npx",
-      "args": ["-y", "@event4u/agent-config@<version>", "mcp-server"]
+      "args": ["--prefer-offline", "-y", "@event4u/agent-config@<version>", "mcp-server"]
     }
   }
 }
@@ -128,7 +130,7 @@ appear under the connector dropdown.
     "agent-config": {
       "command": {
         "path": "npx",
-        "args": ["-y", "@event4u/agent-config@<version>", "mcp-server"]
+        "args": ["--prefer-offline", "-y", "@event4u/agent-config@<version>", "mcp-server"]
       },
       "settings": {}
     }
@@ -144,7 +146,7 @@ appear under the connector dropdown.
 mcpServers:
   - name: agent-config
     command: npx
-    args: ["-y", "@event4u/agent-config@<version>", "mcp-server"]
+    args: ["--prefer-offline", "-y", "@event4u/agent-config@<version>", "mcp-server"]
 ```
 
 ## Smoke test
diff --git a/docs/setup/mcp-client-config.md b/docs/setup/mcp-client-config.md
index 7b0cadbb6..ba2aee18a 100644
--- a/docs/setup/mcp-client-config.md
+++ b/docs/setup/mcp-client-config.md
@@ -265,7 +265,7 @@ npm install -g @event4u/agent-config   # provides the `agent-config` binary
 In every snippet below, `agent-config` is the globally-installed binary. If
 you prefer not to install globally, replace
 `"command": "agent-config", "args": ["mcp-server"]` with
-`"command": "npx", "args": ["-y", "@event4u/agent-config", "mcp-server"]`.
+`"command": "npx", "args": ["--prefer-offline", "-y", "@event4u/agent-config@<version>", "mcp-server"]` (pin the release you installed).
 
 ### Claude Desktop
 
diff --git a/src/config/metric-registry.yml b/src/config/metric-registry.yml
index 93dac8941..830a52746 100644
--- a/src/config/metric-registry.yml
+++ b/src/config/metric-registry.yml
@@ -149,10 +149,15 @@ metrics:
   # "this change moved N bytes" could not be made at all: the tree measured
   # tokens well and bytes not at all, and no row here could have held one.
 
+  # Both census rows count the host's HOOK ENVELOPE — the serialised
+  # `tool_response` a post_tool_use hook receives — not what reached the model.
+  # For Edit and Write the hook envelope carries the whole original file: over 12
+  # local transcripts it was 19.5x the model-visible bytes (Bash 1.44x, Read
+  # within 0.1 %). What reached the model is `tool-model-visible-bytes` below.
   - id: tool-raw-bytes
     unit: bytes
     basis: measured
-    producer: src/scripts/hooks/tool_result_bytes_hook.ts (`raw_bytes`, per post_tool_use dispatch)
+    producer: src/scripts/hooks/tool_result_bytes_hook.ts (`raw_bytes`, the hook envelope, per post_tool_use dispatch)
     consumer: >-
       the `tool_result_bytes` stream registered in `src/config/hook-token-budget.json`,
       and the maintainer reading `agents/runtime/state/tool-result-census.jsonl`
@@ -170,11 +175,12 @@ metrics:
   - id: tool-delivered-bytes
     unit: bytes
     basis: measured
-    producer: src/scripts/hooks/tool_result_bytes_hook.ts (`delivered_bytes`, same record)
+    producer: src/scripts/hooks/tool_result_bytes_hook.ts (`delivered_bytes`, the hook envelope after any rewrite, same record)
     consumer: >-
       the same census reader, comparing it against `tool-raw-bytes` on the same
       line. Equal by construction today, because nothing in this tree rewrites
-      a tool result on its way to the model.
+      a tool result on its way back to the host. Both count the hook envelope,
+      not what reached the model — that is `tool-model-visible-bytes`.
     decision: >-
       whether a result-rewriting mechanism, if one ever lands, reduced anything.
       A non-zero gap between the two columns is the reduction; no gap is no
@@ -184,6 +190,24 @@ metrics:
       and can only assert an improvement. The two columns exist now precisely
       so that claim is a measured delta later rather than a story.
 
+  - id: tool-model-visible-bytes
+    unit: bytes
+    basis: measured
+    producer: src/scripts/_lib/cc_transcript.ts (`scanToolResults`, the `tool_result` block per tool class, joined to the `tool_use` name by id)
+    consumer: >-
+      the dated distribution under `agents/evidence/analysis/` that
+      `road-to-tool-results-that-leave-a-handle` and the placeholders roadmap
+      compare a reduction against, and any reader of a tool-result byte figure
+      checking which bytes it counted.
+    decision: >-
+      which tool classes are worth reducing at all. A class whose hook envelope
+      is large and whose model-visible bytes are small (Edit, Write) has nothing
+      to reduce on the model side.
+    absent: >-
+      the only tool-result byte figure is the hook envelope, which overstates
+      Edit and Write by an order of magnitude, and a reduction plan aims at
+      bytes the model never received.
+
   - id: transcript-bytes-per-token
     unit: bytes_per_token
     basis: measured
diff --git a/src/domains/analysis-workbench/analyze/repo/command.md b/src/domains/analysis-workbench/analyze/repo/command.md
index 656fc3e5b..75386533d 100644
--- a/src/domains/analysis-workbench/analyze/repo/command.md
+++ b/src/domains/analysis-workbench/analyze/repo/command.md
@@ -98,8 +98,8 @@ overriding the budget:**
 ### Read ceiling per loop
 
 Loop *n* cannot read deeper than the seed pass without a local clone, so
-`--deep` (§ 2b) becomes the **default whenever the loop runs**. The three-part
-read ceiling of § 2b applies per loop, and the loop that hits it logs one
+`--deep` (§ 2b) becomes the **default whenever the loop runs**. The four-part
+ceiling of § 2b applies per loop, and the loop that hits it logs one
 read-ceiling line naming the bound that fired.
 
 ## Steps
@@ -162,7 +162,7 @@ seed pass's is a defect in the run, not a finding about the reference.
 
 Because loop *n* cannot read deeper than the seed pass without a local clone,
 `--deep` (§ 2b) is the default whenever the loop runs. Each loop that hits the
-§ 2b three-part read ceiling logs **one** read-ceiling line naming the bound
+§ 2b four-part ceiling logs **one** read-ceiling line naming the bound
 that fired and the loop it fired in.
 
 ### 2b. Deep verification tier — `--deep`, opt-in
@@ -174,9 +174,20 @@ manager; network for the clone itself and nothing else.
 It **requires a non-empty anchor table** (§ 1b): depth is spent proving or
 refuting an anchored hypothesis, never on open-ended browsing.
 
-The fetch ceiling is replaced by a **three-part read ceiling**: an operation
-count, a total-bytes bound, and a wall-clock bound — **whichever is hit first**,
-with the bound that fired recorded. A bare read count bounds nothing (forty
+**The clone's shape.** Reuse an existing local clone that already holds the
+pinned SHA (`git -C <dir> cat-file -e <sha>^{commit}` succeeds) — no network at
+all. Otherwise fetch **only that commit, at depth 1**, into a fresh directory:
+`git init <dir>`, `git -C <dir> remote add origin <url>`,
+`git -C <dir> fetch --depth 1 origin <sha>`, `git -C <dir> checkout --detach FETCH_HEAD`.
+Never a full-history clone, and no persistent object store: `--deep` is opt-in
+and rare, and a store is a maintenance surface for a rare path.
+
+The fetch ceiling is replaced by a **four-part ceiling**: an operation count, a
+total-bytes-read bound, a wall-clock bound, and a **bytes-transferred** bound —
+**whichever is hit first**, with the bound that fired recorded. The transfer
+figure is read from git's own receive line (`Receiving objects: … | <size>`),
+recorded as `0` when a local clone was reused; an over-bound transfer stops the
+run before a file is read. A bare read count bounds nothing (forty
 reads is one README or one 2 MB generated schema, and traversing a monorepo
 costs time a file count never expresses). Cloning **parses**
 attacker-influenceable data before a file is opened: the cloned tree is data,
@@ -556,7 +567,7 @@ pins something; it just does not name it. Contract and field shapes:
   and "just run their tests to check" is a violation, not a shortcut.
 - No credentials in fetches. Public GitHub API is enough. For private mirrors,
   take a PAT via env var and never echo it.
-- Max 40 fetches without explicit extension; under `--deep` the three-part read
+- Max 40 fetches without explicit extension; under `--deep` the four-part
   ceiling of § 2b replaces it — the cost bound never disappears with the count.
 - No auto-commits — the analysis is a draft until the user accepts.
 
diff --git a/src/domains/engineering-base/fix/ci/command.md b/src/domains/engineering-base/fix/ci/command.md
index 50c77585c..835dfc318 100644
--- a/src/domains/engineering-base/fix/ci/command.md
+++ b/src/domains/engineering-base/fix/ci/command.md
@@ -25,16 +25,17 @@ A run still in progress has no verdict to fix. Do NOT read a partial run and
 start guessing — and do NOT end the turn reporting "CI is running".
 
 ```bash
-until [ "$(gh pr checks <n> --json state \
-    --jq '[.[] | select(.state=="IN_PROGRESS" or .state=="QUEUED" or .state=="PENDING")] | length')" = "0" ]
-do sleep 45; done
+npx tsx node_modules/@event4u/agent-config/src/scripts/ci_settle.ts <n>
 ```
 
-Run that in the BACKGROUND so the turn resumes when the verdict lands; a
-foreground sleep-poll chain is blocked and per-minute re-polling is the tool
-loop `token-efficiency` forbids. If the waiter exits because `gh` itself failed
-(network down), it has observed nothing — say so rather than treating it as a
-pass.
+`ci_settle` is the one waiter for this condition — never a hand-written
+`gh pr checks` loop. Run it in the BACKGROUND so the turn resumes when the
+verdict lands, and do not pipe it: its LAST output line is the verdict and its
+exit code carries it. Exit 0 is settled green for the named head; exit 1 is
+settled with at least one failed check — go to step 1; exit 2 is NOT a verdict
+(did not settle within its budget, `gh` could not be read, or the PR is merged,
+closed or head-diverged) — it has observed nothing, so say so and re-run or
+report, never treat it as a pass.
 
 Note `gh run view --log-failed` returns *"run is still in progress; logs will be
 available when it is complete"* until the WHOLE run finishes, which is the other
diff --git a/src/domains/git/pr/create/command.md b/src/domains/git/pr/create/command.md
index f6a7e73b9..acedde231 100644
--- a/src/domains/git/pr/create/command.md
+++ b/src/domains/git/pr/create/command.md
@@ -484,13 +484,18 @@ Pending is a reason to wait, never a reason to stop.
 **Settled** means every check has reached a terminal state:
 
 ```bash
-until [ "$(gh pr checks <n> --json state \
-    --jq '[.[] | select(.state=="IN_PROGRESS" or .state=="QUEUED" or .state=="PENDING")] | length')" = "0" ]
-do sleep 45; done
+npx tsx node_modules/@event4u/agent-config/src/scripts/ci_settle.ts <n>
 gh pr checks <n> --json name,state,link \
   --jq '.[] | select(.state!="SUCCESS" and .state!="SKIPPED") | "\(.state)  \(.name)  \(.link)"'
 ```
 
+`ci_settle` is the one waiter for this condition, never a hand-written
+`gh pr checks` loop, and it is never piped — its last output line is the
+verdict. Exit 0: settled green for the named head. Exit 1: settled with a
+failed check, listed by the second command — go to **On red**. Exit 2: not a
+verdict (no settle within its budget, `gh` unreadable, or the PR merged, closed
+or head-diverged); say that rather than reporting a result.
+
 Run the wait as a BACKGROUND command so the turn resumes on its own when
 the verdict lands. A foreground sleep-poll chain is blocked, and burning
 turns on `gh pr checks` every minute is the tool-loop
diff --git a/src/scripts/_lib/cc_transcript.ts b/src/scripts/_lib/cc_transcript.ts
index 6d0eb5e4b..76b2a76d5 100644
--- a/src/scripts/_lib/cc_transcript.ts
+++ b/src/scripts/_lib/cc_transcript.ts
@@ -470,3 +470,144 @@ export function aggregateByBucket(records: readonly TranscriptRecord[]): Record<
 
     return buckets;
 }
+
+/* -------------------------------------------------------------------------- */
+/* Tool results — what reached the model, per tool class                       */
+/* -------------------------------------------------------------------------- */
+
+/**
+ * One tool class's model-visible bytes, beside the host's hook envelope.
+ *
+ * The two are different populations and are never added together. The
+ * model-visible figure is the `tool_result` block the model received; the
+ * envelope is the transcript's `toolUseResult` — the same object the host hands
+ * a post_tool_use hook, which for Edit and Write carries the whole original
+ * file the model never sees.
+ */
+export interface ToolResultClass {
+    tool: string;
+    count: number;
+    model_visible_bytes: number;
+    /** Sum over results that carried an envelope; `null` when none did. */
+    envelope_bytes: number | null;
+    /** Results with no `toolUseResult` — not zero, not measured. */
+    envelope_missing: number;
+    /** One model-visible byte count per result, for percentiles. */
+    model_visible_samples: number[];
+}
+
+export interface ToolResultScan {
+    classes: Record<string, ToolResultClass>;
+    /** Distinct tool results counted, after dedup by `tool_use_id`. */
+    results: number;
+}
+
+interface RawBlock {
+    type?: unknown;
+    id?: unknown;
+    name?: unknown;
+    tool_use_id?: unknown;
+    content?: unknown;
+    text?: unknown;
+    source?: { data?: unknown };
+}
+
+function blocksOf(raw: { message?: { content?: unknown } }): RawBlock[] {
+    const c = raw.message?.content;
+    return Array.isArray(c) ? (c.filter((b) => typeof b === 'object' && b !== null) as RawBlock[]) : [];
+}
+
+/** Model-visible bytes of one `tool_result` block, and whether it carried an image. */
+function modelVisibleBytes(block: RawBlock): { bytes: number; image: boolean } {
+    const c = block.content;
+    if (typeof c === 'string') return { bytes: Buffer.byteLength(c, 'utf8'), image: false };
+    let bytes = 0;
+    let image = false;
+    if (Array.isArray(c)) {
+        for (const item of c as RawBlock[]) {
+            if (typeof item !== 'object' || item === null) continue;
+            if (typeof item.text === 'string') bytes += Buffer.byteLength(item.text, 'utf8');
+            if (item.type === 'image' && typeof item.source?.data === 'string') {
+                image = true;
+                bytes += item.source.data.length;
+            }
+        }
+    }
+    return { bytes, image };
+}
+
+function readLines(file: string): string[] {
+    try {
+        return fs.readFileSync(file, 'utf-8').split('\n');
+    } catch {
+        return [];
+    }
+}
+
+/**
+ * Model-visible tool-result bytes per tool class, joined to the tool name by
+ * `tool_use_id`. Two passes over the file set — names first, results second —
+ * so a result whose `tool_use` sits in another file still joins. A result whose
+ * id joins nothing is counted under `unknown`, never dropped and never guessed.
+ * A Read that returned an image is its own class, `Read:image`: encoded image
+ * data dwarfs every text class and would otherwise hide them.
+ */
+export function scanToolResults(opts: ScanOptions = {}): ToolResultScan {
+    const files = listTranscriptFiles(opts);
+    const names = new Map<string, string>();
+    for (const file of files) {
+        for (const line of readLines(file)) {
+            if (!line.includes('"tool_use"')) continue;
+            const raw = parseLine(line);
+            if (!raw || raw.type !== 'assistant') continue;
+            for (const b of blocksOf(raw)) {
+                if (b.type === 'tool_use' && typeof b.id === 'string' && typeof b.name === 'string') names.set(b.id, b.name);
+            }
+        }
+    }
+
+    const classes: Record<string, ToolResultClass> = {};
+    const seen = new Set<string>();
+    for (const file of files) {
+        for (const line of readLines(file)) {
+            if (!line.includes('"tool_result"')) continue;
+            const raw = parseLine(line) as (RawAssistantRecord & { toolUseResult?: unknown }) | null;
+            if (!raw || raw.type !== 'user') continue;
+            const blocks = blocksOf(raw).filter((b) => b.type === 'tool_result' && typeof b.tool_use_id === 'string');
+            for (const block of blocks) {
+                const id = block.tool_use_id as string;
+                if (seen.has(id)) continue;
+                seen.add(id);
+                const { bytes, image } = modelVisibleBytes(block);
+                const name = names.get(id) ?? 'unknown';
+                const tool = image ? `${name}:image` : name;
+                const cls = (classes[tool] ??= {
+                    tool,
+                    count: 0,
+                    model_visible_bytes: 0,
+                    envelope_bytes: null,
+                    envelope_missing: 0,
+                    model_visible_samples: [],
+                });
+                cls.count += 1;
+                cls.model_visible_bytes += bytes;
+                cls.model_visible_samples.push(bytes);
+                // One envelope per record: attributed only when the record holds one result.
+                const env = blocks.length === 1 ? raw.toolUseResult : undefined;
+                if (env === undefined || env === null) {
+                    cls.envelope_missing += 1;
+                } else {
+                    let envBytes: number | null = null;
+                    try {
+                        envBytes = Buffer.byteLength(typeof env === 'string' ? env : JSON.stringify(env), 'utf8');
+                    } catch {
+                        envBytes = null;
+                    }
+                    if (envBytes === null) cls.envelope_missing += 1;
+                    else cls.envelope_bytes = (cls.envelope_bytes ?? 0) + envBytes;
+                }
+            }
+        }
+    }
+    return { classes, results: seen.size };
+}
diff --git a/src/scripts/_lib/mcp_bridge.ts b/src/scripts/_lib/mcp_bridge.ts
index c99301d52..fa482f612 100644
--- a/src/scripts/_lib/mcp_bridge.ts
+++ b/src/scripts/_lib/mcp_bridge.ts
@@ -49,15 +49,23 @@ export const MCP_PACKAGE_NAME = '@event4u/agent-config';
  * A version that cannot be read is left unpinned rather than guessed: an
  * invented specifier would fail to resolve at server start, which is a worse
  * failure than the drift it was meant to close.
+ *
+ * A pinned spec also carries `--prefer-offline`: the cache can hold only that
+ * exact version, so a warm cache answers the server start without a registry
+ * request, and a cold one still resolves. An unpinned spec does not, because
+ * a cached `latest` would be served stale.
  */
 export function mcpBridgeEntry(packageRoot: string): Record<string, unknown> {
     const version = readPackageVersion(packageRoot);
-    const spec = version === null ? MCP_PACKAGE_NAME : `${MCP_PACKAGE_NAME}@${version}`;
+    const args =
+        version === null
+            ? ['-y', MCP_PACKAGE_NAME, 'mcp-server']
+            : ['--prefer-offline', '-y', `${MCP_PACKAGE_NAME}@${version}`, 'mcp-server'];
     return {
         mcpServers: {
             [MCP_SERVER_KEY]: {
                 command: 'npx',
-                args: ['-y', spec, 'mcp-server'],
+                args,
             },
         },
     };
diff --git a/src/scripts/_lib/tool_result_census.ts b/src/scripts/_lib/tool_result_census.ts
new file mode 100644
index 000000000..ba7d21c41
--- /dev/null
+++ b/src/scripts/_lib/tool_result_census.ts
@@ -0,0 +1,62 @@
+/**
+ * Reader for `agents/runtime/state/tool-result-census.jsonl`
+ * (`road-to-bytes-the-model-actually-receives` step 1.3).
+ *
+ * The census holds two line shapes. Lines written before the two-field schema
+ * carry `{ts, tool, bytes}`; lines from 2026-09-30 on carry
+ * `{ts, tool, raw_bytes, delivered_bytes, measurable}`. The census is
+ * append-only, so both shapes stay in the file for good.
+ *
+ * A legacy `bytes` counted the same thing `raw_bytes` counts — the host's hook
+ * envelope. It says nothing about what was delivered, so a legacy line reads
+ * as `delivered_bytes: null`. Reading it as equal would invent a figure for
+ * every line written before the second field existed.
+ *
+ * Neither shape counts what reached the model; that is
+ * `tool-model-visible-bytes`, read from transcripts (`cc_transcript.ts`).
+ */
+
+export type CensusShape = 'legacy' | 'two-field';
+
+export interface CensusReading {
+    ts: string;
+    tool: string | null;
+    /** Hook-envelope bytes, or `null` when the line recorded none. */
+    raw_bytes: number | null;
+    /** Hook-envelope bytes after any rewrite; `null` when unknown — always so for a legacy line. */
+    delivered_bytes: number | null;
+    shape: CensusShape;
+}
+
+function numOrNull(v: unknown): number | null {
+    return typeof v === 'number' && Number.isFinite(v) ? v : null;
+}
+
+/** One census line, or `null` for a blank, unparseable or shapeless line. */
+export function readCensusLine(line: string): CensusReading | null {
+    if (line.trim() === '') return null;
+    let parsed: unknown;
+    try {
+        parsed = JSON.parse(line);
+    } catch {
+        return null;
+    }
+    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
+    const rec = parsed as Record<string, unknown>;
+    const ts = typeof rec['ts'] === 'string' ? rec['ts'] : null;
+    if (ts === null) return null;
+    const tool = typeof rec['tool'] === 'string' ? rec['tool'] : null;
+    if ('raw_bytes' in rec || 'delivered_bytes' in rec) {
+        return {
+            ts,
+            tool,
+            raw_bytes: numOrNull(rec['raw_bytes']),
+            delivered_bytes: numOrNull(rec['delivered_bytes']),
+            shape: 'two-field',
+        };
+    }
+    if ('bytes' in rec) {
+        return { ts, tool, raw_bytes: numOrNull(rec['bytes']), delivered_bytes: null, shape: 'legacy' };
+    }
+    return null;
+}
diff --git a/src/scripts/hooks/delegation_nudge_hook.ts b/src/scripts/hooks/delegation_nudge_hook.ts
index ea5b3bbe2..92553a498 100644
--- a/src/scripts/hooks/delegation_nudge_hook.ts
+++ b/src/scripts/hooks/delegation_nudge_hook.ts
@@ -403,11 +403,17 @@ export function buildNudgeLine(
   // Rung 1 (single bounded slice) carries no do-in-steps/do-in-parallel
   // mode of its own — `classification.mode` is `null` for that shape.
   const modeLabel = classification.mode ?? "single-slice";
+  // Advisory only, never a block: a leg's first call
+  // still writes or reads uncached a median of ~182k tokens.
+  const coldStart =
+    rung === 1
+      ? " A leg starts cold (~182k uncached tokens): a slice of one to three direct reads does not amortise it."
+      : "";
   return (
     `<delegation-nudge>${rungLabel}: dispatch ${modeLabel} ` +
     `(${sliceCount} ${unit}, ${tier} tier recommended). Consider dispatching via ` +
     `subagent-orchestration instead of doing every slice in-session — ` +
-    `${classification.reason}.</delegation-nudge>`
+    `${classification.reason}.${coldStart}</delegation-nudge>`
   );
 }
 
diff --git a/src/scripts/hooks/reread_guard_hook.ts b/src/scripts/hooks/reread_guard_hook.ts
index ac98fba81..2f46837cb 100644
--- a/src/scripts/hooks/reread_guard_hook.ts
+++ b/src/scripts/hooks/reread_guard_hook.ts
@@ -6,7 +6,8 @@
  * Two signals, one session-scoped read ledger:
  *
  *   6.1 A full-file `Read` of a path that was ALREADY fully read this session
- *       AND is unchanged since (mtime + size compare against the ledger) gets
+ *       AND whose content is unchanged since (sha256 compare against the
+ *       ledger; above HASH_BOUND_BYTES, mtime + size, said so in the line) gets
  *       one advisory line naming the earlier read and the ranged-read
  *       alternative. A ranged read (any `offset`/`limit` in the tool input)
  *       is already the cheap form and never fires — nor is it recorded as a
@@ -21,8 +22,8 @@
  * `<workspace_root>/agents/runtime/state/reread-guard/<sha256(session)>.json`
  * (gitignored — `agents/runtime/` is blanket-ignored), keyed by session id
  * the same way `end_review_nudge_hook.deriveSessionKey` does (hashed, never
- * raw). Per path it stores `{mtime, size, ts}` for reads, a `ts` for the last
- * own write, and a per-path fired flag — NO field can hold file content, by
+ * raw). Per path it stores `{mtime, size, ts, sha256?}` for reads, a `ts` for the last
+ * own write, and a per-path fired flag — numbers and a digest; NO field can hold file content, by
  * construction (same PII/content-exclusion-by-construction discipline as the
  * telemetry schemas).
  *
@@ -105,11 +106,35 @@ export function isExemptPath(filePath: string): boolean {
     return EXEMPT_PATH_PATTERNS.some((re) => re.test(normalized));
 }
 
-/** Per-path read record — NUMBERS ONLY (mtime ms, byte size, epoch-ms ts). */
+/** Per-path read record — numbers and a digest, never content. */
 export interface ReadRecord {
     mtime: number;
     size: number;
     ts: number;
+    /** sha256 of the file; absent above {@link HASH_BOUND_BYTES}. */
+    sha256?: string;
+}
+
+/**
+ * Above this size the guard keeps mtime + size and says so: the
+ * hash is a full read of the file on the pre_tool_use path.
+ */
+export const HASH_BOUND_BYTES = 2 * 1024 * 1024;
+
+/** sha256 of a file at or under the bound; `undefined` above it or on error. */
+export function contentDigest(absPath: string, size: number): string | undefined {
+    if (size > HASH_BOUND_BYTES) return undefined;
+    try {
+        return crypto.createHash('sha256').update(fs.readFileSync(absPath)).digest('hex');
+    } catch {
+        return undefined;
+    }
+}
+
+/** Same content when both reads carry a digest; else the stat pair decides. */
+export function isUnchanged(prior: ReadRecord, mtime: number, size: number, sha256: string | undefined): boolean {
+    if (prior.sha256 !== undefined && sha256 !== undefined) return prior.sha256 === sha256;
+    return prior.mtime === mtime && prior.size === size;
 }
 
 /** The session ledger — paths as keys, numbers as values, no content field. */
@@ -183,11 +208,12 @@ export function isRangedRead(toolInput: JsonObject): boolean {
 }
 
 /** 6.1 advisory — duplicate full read of an unchanged, already-read path. */
-export function buildDuplicateReadLine(relPath: string, earlierTs: number): string {
+export function buildDuplicateReadLine(relPath: string, earlierTs: number, byContent = true): string {
     const when = new Date(earlierTs).toISOString();
+    const basis = byContent ? 'unchanged content (same sha256)' : 'unchanged since (same mtime+size; over the 2 MB hash bound)';
     return (
-        `re-read guard: ${relPath} was already fully read this session (${when}) and is ` +
-        `unchanged since (same mtime+size) — the content is still in context; if you only ` +
+        `re-read guard: ${relPath} was already fully read this session (${when}) with ` +
+        `${basis} — the content is still in context; if you only ` +
         `need part of it, a ranged Read (offset/limit) pays for the range, not the file.`
     );
 }
@@ -252,6 +278,7 @@ export function main(): number {
             return EXIT_ALLOW; // unreadable/missing target — nothing to compare
         }
 
+        const sha256 = contentDigest(absPath, size);
         const prior = ledger.reads[key];
         const ownWrite = ledger.writes[key];
         const alreadyFired = ledger.fired[key] === true;
@@ -259,13 +286,13 @@ export function main(): number {
         let advisory: string | null = null;
         if (!alreadyFired && ownWrite !== undefined) {
             advisory = buildPostEditReadLine(key); // 6.2 wins when both hold
-        } else if (!alreadyFired && prior !== undefined && prior.mtime === mtime && prior.size === size) {
-            advisory = buildDuplicateReadLine(key, prior.ts);
+        } else if (!alreadyFired && prior !== undefined && isUnchanged(prior, mtime, size, sha256)) {
+            advisory = buildDuplicateReadLine(key, prior.ts, prior.sha256 !== undefined && sha256 !== undefined);
         }
 
         // Record the read that is about to happen (numbers only), consume the
         // one-shot own-write marker, and latch the per-path fire flag.
-        ledger.reads[key] = { mtime, size, ts: Date.now() };
+        ledger.reads[key] = sha256 === undefined ? { mtime, size, ts: Date.now() } : { mtime, size, ts: Date.now(), sha256 };
         if (ownWrite !== undefined) delete ledger.writes[key];
         if (advisory !== null) ledger.fired[key] = true;
         writeLedger(workspaceRoot, sessionKey, ledger);
diff --git a/src/scripts/hooks/tool_result_bytes_hook.ts b/src/scripts/hooks/tool_result_bytes_hook.ts
index e95205a34..339a24a67 100644
--- a/src/scripts/hooks/tool_result_bytes_hook.ts
+++ b/src/scripts/hooks/tool_result_bytes_hook.ts
@@ -47,9 +47,16 @@
  * identical while the cost came back. The `RESULT_KEYS` literals below are the
  * key NAMES this concern looks under, not a read of the body.
  *
- * TWO COUNTS, ONE OF THEM REDUNDANT TODAY. `raw_bytes` is what
- * the host handed the dispatcher; `delivered_bytes` is what reached the
- * model. Today they are EQUAL BY CONSTRUCTION, and the construction is
+ * TWO COUNTS, ONE OF THEM REDUNDANT TODAY. Both count the host's HOOK
+ * ENVELOPE — the serialised `tool_response` the host hands a post_tool_use
+ * hook — and NOT what reached the model. The two differ by tool: for Edit and
+ * Write the hook envelope carries the whole original file while the model
+ * receives a short confirmation (measured over 12 local transcripts: 19.5x;
+ * Bash 1.44x; Read within 0.1 %). The model-visible figure is a separate
+ * metric, `tool-model-visible-bytes`, read from transcripts. `raw_bytes` is
+ * the hook envelope the host handed the dispatcher; `delivered_bytes` is the
+ * hook envelope after any rewrite a concern could apply on its way back.
+ * Today they are EQUAL BY CONSTRUCTION, and the construction is
  * checkable: nothing under `src/` or `docs/` emits the host's result-rewrite
  * field, so no concern can rewrite a tool result on its way past. That
  * absence is a grep, and the grep lives in this concern's test rather than
@@ -196,10 +203,11 @@ function censusFile(consumerRoot: string): string {
 export interface CensusLine {
     ts: string;
     tool: string | null;
-    /** UTF-8 bytes the host handed the dispatcher. `null` ⇒ unmeasurable. */
+    /** UTF-8 bytes of the hook envelope the host handed the dispatcher. `null` ⇒ unmeasurable. */
     raw_bytes: number | null;
     /**
-     * UTF-8 bytes that reached the model.
+     * UTF-8 bytes of the hook envelope after any rewrite — NOT what reached
+     * the model (see the header; that figure is `tool-model-visible-bytes`).
      *
      * Equal to {@link CensusLine.raw_bytes} by construction today — nothing in
      * this tree rewrites a tool result. It is recorded anyway so that a later
diff --git a/tests/scripts/cc_transcript.test.ts b/tests/scripts/cc_transcript.test.ts
index 619e77de7..dc5b323e5 100644
--- a/tests/scripts/cc_transcript.test.ts
+++ b/tests/scripts/cc_transcript.test.ts
@@ -23,6 +23,7 @@ import {
     listTranscriptFiles,
     measureBytesPerToken,
     measureContentBytes,
+    scanToolResults,
     scanTranscripts,
     weightedInputUnits,
     type TranscriptRecord,
@@ -393,3 +394,85 @@ describe('derivedBytes - a derived figure can never be read as a counted one', (
         expect(fat?.bytes).toBe((thin?.bytes ?? 0) * 10);
     });
 });
+
+describe('scanToolResults - the model-visible bytes of a tool result, per tool class', () => {
+    // An Edit whose hook envelope carries the whole original file, while the
+    // model receives only the confirmation line. Every expected figure is
+    // computed from these constants, never copied from a run.
+    const ORIGINAL_FILE = 'const x = 1;\n'.repeat(400);
+    const CONFIRMATION = 'The file /repo/a.ts has been updated successfully.';
+    const EDIT_ENVELOPE = { filePath: '/repo/a.ts', oldString: 'x', newString: 'y', originalFile: ORIGINAL_FILE };
+    const BASH_OUT = 'line one\nline two';
+    const IMAGE_DATA = 'iVBORw0KGgo'.repeat(30);
+
+    function writeToolFixture(root: string): string {
+        const projectDir = path.join(root, 'proj');
+        appendJsonl(path.join(projectDir, 's.jsonl'), [
+            {
+                type: 'assistant',
+                message: {
+                    id: 'm1',
+                    content: [
+                        { type: 'tool_use', id: 'tu_edit', name: 'Edit', input: {} },
+                        { type: 'tool_use', id: 'tu_bash', name: 'Bash', input: {} },
+                        { type: 'tool_use', id: 'tu_img', name: 'Read', input: {} },
+                    ],
+                },
+            },
+            {
+                type: 'user',
+                message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_edit', content: CONFIRMATION }] },
+                toolUseResult: EDIT_ENVELOPE,
+            },
+            {
+                type: 'user',
+                message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_bash', content: [{ type: 'text', text: BASH_OUT }] }] },
+                toolUseResult: { stdout: BASH_OUT, stderr: '' },
+            },
+            {
+                type: 'user',
+                message: {
+                    role: 'user',
+                    content: [{ type: 'tool_result', tool_use_id: 'tu_img', content: [{ type: 'image', source: { type: 'base64', data: IMAGE_DATA } }] }],
+                },
+            },
+            // An orphan: its tool_use is in no file. Counted as unknown, never dropped, never guessed.
+            {
+                type: 'user',
+                message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_orphan', content: 'orphan' }] },
+            },
+        ]);
+        // The Edit result replayed into a second file must not be counted twice.
+        appendJsonl(path.join(projectDir, 's', 'subagents', 'agent-r.jsonl'), [
+            {
+                type: 'user',
+                message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_edit', content: CONFIRMATION }] },
+                toolUseResult: EDIT_ENVELOPE,
+            },
+        ]);
+        return projectDir;
+    }
+
+    it('edit-envelope-is-not-model-visible', () => {
+        const root = mkTmp();
+        const projectDir = writeToolFixture(root);
+        const scan = scanToolResults({ root, projectDir });
+        const edit = scan.classes['Edit'];
+        expect(edit?.count).toBe(1);
+        expect(edit?.model_visible_bytes).toBe(Buffer.byteLength(CONFIRMATION, 'utf8'));
+        expect(edit?.envelope_bytes).toBe(Buffer.byteLength(JSON.stringify(EDIT_ENVELOPE), 'utf8'));
+        expect(edit?.envelope_bytes ?? 0).toBeGreaterThan((edit?.model_visible_bytes ?? 0) * 10);
+    });
+
+    it('counts text blocks, separates image Reads, and keeps orphans in their own class', () => {
+        const root = mkTmp();
+        const projectDir = writeToolFixture(root);
+        const scan = scanToolResults({ root, projectDir });
+        expect(scan.classes['Bash']?.model_visible_bytes).toBe(Buffer.byteLength(BASH_OUT, 'utf8'));
+        expect(scan.classes['Read:image']?.model_visible_bytes).toBe(IMAGE_DATA.length);
+        expect(scan.classes['Read:image']?.envelope_bytes).toBeNull();
+        expect(scan.classes['Read']).toBeUndefined();
+        expect(scan.classes['unknown']?.count).toBe(1);
+        expect(scan.results).toBe(4);
+    });
+});
diff --git a/tests/scripts/delegation_nudge_hook.test.ts b/tests/scripts/delegation_nudge_hook.test.ts
index 56ee5a30b..c7641bd97 100644
--- a/tests/scripts/delegation_nudge_hook.test.ts
+++ b/tests/scripts/delegation_nudge_hook.test.ts
@@ -283,6 +283,28 @@ describe("buildNudgeLine", () => {
     expect(line).toContain("rung-1: dispatch single-slice (1 slice, lite tier recommended)");
   });
 
+  it("single-slice-names-the-cold-start-cost", () => {
+    // A leg starts cold (road-to-bytes-the-model-actually-receives 4.2, D5): a
+    // single slice of a few direct reads does not amortise it. Advisory text
+    // only — the line still recommends nothing stronger than "consider".
+    const line = buildNudgeLine(
+      1,
+      { delegable: true, action: "dispatch", mode: null, reason: "single bounded read-heavy slice" },
+      1,
+      "lite",
+    );
+    expect(line).toContain("starts cold");
+    expect(line).toContain("one to three direct reads");
+    expect(line.endsWith("</delegation-nudge>")).toBe(true);
+    const multi = buildNudgeLine(
+      2,
+      { delegable: true, action: "dispatch", mode: "do-in-parallel", reason: "independent slices (6)" },
+      6,
+      "lite",
+    );
+    expect(multi).not.toContain("starts cold");
+  });
+
   it("an unresolved rung renders as rung-? (unreachable in production, kept total for direct callers)", () => {
     const line = buildNudgeLine(
       null,
diff --git a/tests/scripts/mcp_bridge_pin.test.ts b/tests/scripts/mcp_bridge_pin.test.ts
index 48f6eb4c1..72a1a975b 100644
--- a/tests/scripts/mcp_bridge_pin.test.ts
+++ b/tests/scripts/mcp_bridge_pin.test.ts
@@ -35,6 +35,7 @@ describe('mcpBridgeEntry — the emitted spec equals the manifest version', () =
     it('pins to the version in package.json', () => {
         fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '14.18.0' }));
         expect(serverOf(mcpBridgeEntry(root)).args).toEqual([
+            '--prefer-offline',
             '-y',
             `${MCP_PACKAGE_NAME}@14.18.0`,
             'mcp-server',
@@ -45,7 +46,7 @@ describe('mcpBridgeEntry — the emitted spec equals the manifest version', () =
         fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '9.9.9' }));
         const version = readPackageVersion(root);
         expect(version).toBe('9.9.9');
-        expect(serverOf(mcpBridgeEntry(root)).args[1]).toBe(`${MCP_PACKAGE_NAME}@${version!}`);
+        expect(serverOf(mcpBridgeEntry(root)).args).toContain(`${MCP_PACKAGE_NAME}@${version!}`);
     });
 
     it('leaves the spec UNPINNED when the version cannot be read', () => {
@@ -56,6 +57,19 @@ describe('mcpBridgeEntry — the emitted spec equals the manifest version', () =
         expect(serverOf(mcpBridgeEntry(root)).args[1]).toBe(MCP_PACKAGE_NAME);
     });
 
+    it('entry-prefers-offline', () => {
+        // With an exact version the cache can hold only that version, so a warm
+        // cache answers the server start without a registry request.
+        fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '14.18.0' }));
+        const args = serverOf(mcpBridgeEntry(root)).args;
+        expect(args[0]).toBe('--prefer-offline');
+        expect(args.slice(1)).toEqual(['-y', `${MCP_PACKAGE_NAME}@14.18.0`, 'mcp-server']);
+    });
+
+    it('does not prefer the cache for an unpinned spec, where it would serve a stale latest', () => {
+        expect(serverOf(mcpBridgeEntry(root)).args).not.toContain('--prefer-offline');
+    });
+
     it('never emits a bare `latest` dist-tag once a version is readable', () => {
         fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '1.2.3' }));
         expect(JSON.stringify(mcpBridgeEntry(root))).not.toContain('latest');
@@ -93,7 +107,7 @@ describe('migrateMcpBridge — rewrites our key and nothing beside it', () => {
         expect(migrateMcpBridge(root, root)).toBe('rewritten');
 
         const servers = readBack();
-        expect((servers[MCP_SERVER_KEY] as { args: string[] }).args[1]).toBe(
+        expect((servers[MCP_SERVER_KEY] as { args: string[] }).args).toContain(
             `${MCP_PACKAGE_NAME}@14.18.0`,
         );
         // The whole point: the neighbour is not read, reordered or rewritten.
diff --git a/tests/scripts/reread_guard_hook.test.ts b/tests/scripts/reread_guard_hook.test.ts
index 51a8b7999..74b131f64 100644
--- a/tests/scripts/reread_guard_hook.test.ts
+++ b/tests/scripts/reread_guard_hook.test.ts
@@ -15,6 +15,7 @@
  * All fixtures live under `os.tmpdir()` — no tracked file is ever written.
  */
 import { spawnSync } from 'node:child_process';
+import { createHash } from 'node:crypto';
 import * as fs from 'node:fs';
 import * as os from 'node:os';
 import * as path from 'node:path';
@@ -24,9 +25,12 @@ import { afterEach, describe, expect, it } from 'vitest';
 import {
     buildDuplicateReadLine,
     buildPostEditReadLine,
+    contentDigest,
     deriveSessionKey,
+    HASH_BOUND_BYTES,
     isExemptPath,
     isRangedRead,
+    isUnchanged,
     ledgerFile,
 } from '../../src/scripts/hooks/reread_guard_hook.js';
 
@@ -114,6 +118,22 @@ describe('advisory lines', () => {
     });
 });
 
+describe('content key and its size bound (D3)', () => {
+    it('compares digests when both reads carry one, whatever the stat pair says', () => {
+        expect(isUnchanged({ mtime: 1, size: 5, ts: 0, sha256: 'a' }, 1, 5, 'b')).toBe(false);
+        expect(isUnchanged({ mtime: 1, size: 5, ts: 0, sha256: 'a' }, 2, 5, 'a')).toBe(true);
+    });
+    it('falls back to mtime + size when either read is over the bound', () => {
+        expect(isUnchanged({ mtime: 1, size: 5, ts: 0 }, 1, 5, undefined)).toBe(true);
+        expect(isUnchanged({ mtime: 1, size: 5, ts: 0, sha256: 'a' }, 2, 5, undefined)).toBe(false);
+    });
+    it('hashes nothing above the bound, and the line says which basis it used', () => {
+        expect(contentDigest('/nonexistent-is-not-read', HASH_BOUND_BYTES + 1)).toBeUndefined();
+        expect(buildDuplicateReadLine('a.ts', 0, true)).toContain('unchanged content');
+        expect(buildDuplicateReadLine('a.ts', 0, false)).toContain('2 MB hash bound');
+    });
+});
+
 // ── E2E sequences through the ledger ────────────────────────────────────
 
 describe('reread_guard_hook E2E', () => {
@@ -142,6 +162,37 @@ describe('reread_guard_hook E2E', () => {
         expect(second.stdout.trim()).toBe('');
     });
 
+    it('same-mtime-same-size-new-content-is-not-unchanged', () => {
+        // An equal-length rewrite with its mtime restored: stat says unchanged,
+        // the content is not, so the advisory must stay silent.
+        const { root, abs } = makeWorkspace();
+        // A whole-second mtime, so restoring it is exact on every filesystem.
+        const pinned = new Date(Math.floor(Date.now() / 1000) * 1000 - 60_000);
+        fs.utimesSync(abs, pinned, pinned);
+        const before = fs.statSync(abs);
+        expect(run(readEvent(root, abs), root).status).toBe(0);
+        fs.writeFileSync(abs, 'export const y = 9;\n');
+        fs.utimesSync(abs, pinned, pinned);
+        const after = fs.statSync(abs);
+        expect(after.size).toBe(before.size);
+        expect(after.mtimeMs).toBe(before.mtimeMs);
+        const second = run(readEvent(root, abs), root);
+        expect(second.status).toBe(0);
+        expect(second.stdout.trim()).toBe('');
+    });
+
+    it('restored-identical-content-is-unchanged', () => {
+        // Same bytes with a new mtime (a checkout restoring the file): the
+        // content the session read is still the content on disk.
+        const { root, abs } = makeWorkspace();
+        expect(run(readEvent(root, abs), root).status).toBe(0);
+        fs.writeFileSync(abs, fs.readFileSync(abs));
+        fs.utimesSync(abs, new Date(), new Date(Date.now() + 5000));
+        const second = run(readEvent(root, abs), root);
+        expect(second.status).toBe(2);
+        expect(JSON.parse(second.stdout).additional_context).toContain('unchanged content');
+    });
+
     it('6.1: silent on a ranged read even when the path was already fully read', () => {
         const { root, abs } = makeWorkspace();
         expect(run(readEvent(root, abs), root).status).toBe(0);
@@ -194,15 +245,16 @@ describe('reread_guard_hook E2E', () => {
         expect(run(readEvent(root, other), root).status).toBe(2); // path B fires independently
     });
 
-    it('the ledger stores paths and numbers only — no content field, no string values', () => {
+    it('the ledger stores paths, numbers and a sha256 digest only — no content field', () => {
         const { root, abs } = makeWorkspace();
         expect(run(readEvent(root, abs), root).status).toBe(0);
         const key = deriveSessionKey({ session_id: 'sess-1' }, {});
         const ledger = JSON.parse(fs.readFileSync(ledgerFile(root, key), 'utf8'));
         expect(Object.keys(ledger).sort()).toEqual(['fired', 'reads', 'writes']);
         for (const rec of Object.values(ledger.reads) as Array<Record<string, unknown>>) {
-            expect(Object.keys(rec).sort()).toEqual(['mtime', 'size', 'ts']);
-            for (const v of Object.values(rec)) expect(typeof v).toBe('number');
+            expect(Object.keys(rec).sort()).toEqual(['mtime', 'sha256', 'size', 'ts']);
+            expect(rec['sha256']).toBe(createHash('sha256').update(fs.readFileSync(abs)).digest('hex'));
+            for (const [k, v] of Object.entries(rec)) if (k !== 'sha256') expect(typeof v).toBe('number');
         }
         for (const v of Object.values(ledger.writes)) expect(typeof v).toBe('number');
         expect(JSON.stringify(ledger)).not.toContain('export const'); // never the file body
diff --git a/tests/scripts/tool_result_bytes_hook.test.ts b/tests/scripts/tool_result_bytes_hook.test.ts
index 206c36641..acc7b9baf 100644
--- a/tests/scripts/tool_result_bytes_hook.test.ts
+++ b/tests/scripts/tool_result_bytes_hook.test.ts
@@ -21,6 +21,7 @@ import {
     resolveConsumerRoot,
     resolvesMaintainerWorkspace,
 } from '../../src/scripts/hooks/tool_result_bytes_hook.js';
+import { readCensusLine } from '../../src/scripts/_lib/tool_result_census.js';
 
 let tmp: string;
 
@@ -274,3 +275,23 @@ describe('the recorder is default-off outside the maintainer workspace', () => {
         fs.rmSync(consumer, { recursive: true, force: true });
     });
 });
+
+describe('the census reader reads both line shapes the file holds', () => {
+    it('legacy-bytes-line-is-raw-only', () => {
+        // A line written before the two-field schema carries `bytes` alone. It
+        // counted the same envelope as `raw_bytes`; nothing says what was
+        // delivered, so delivered is unknown, never equal.
+        const legacy = readCensusLine(JSON.stringify({ ts: '2026-09-01T00:00:00.000Z', tool: 'Edit', bytes: 4096 }));
+        expect(legacy).toEqual({ ts: '2026-09-01T00:00:00.000Z', tool: 'Edit', raw_bytes: 4096, delivered_bytes: null, shape: 'legacy' });
+        const current = readCensusLine(
+            JSON.stringify({ ts: '2026-10-01T00:00:00.000Z', tool: 'Bash', raw_bytes: 10, delivered_bytes: 10, measurable: true }),
+        );
+        expect(current).toEqual({ ts: '2026-10-01T00:00:00.000Z', tool: 'Bash', raw_bytes: 10, delivered_bytes: 10, shape: 'two-field' });
+    });
+
+    it('returns null for a line that is not a census record', () => {
+        expect(readCensusLine('')).toBeNull();
+        expect(readCensusLine('{not json')).toBeNull();
+        expect(readCensusLine(JSON.stringify({ ts: 'x', tool: 'Read' }))).toBeNull();
+    });
+});
```
