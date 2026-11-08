<!-- evidence-type: analysis -->

# Ratification review — bind the read ledger on Bash and pre_compact — round 12

You are an independent reviewer for a change in the `event4u/agent-config` repository. Two files in it, `src/scripts/hook_manifest.yaml` and its compiled twin `src/scripts/hook_manifest.json`, are hook plumbing on the ratification gate's list, so the change needs a two-provider verdict under ADR-268 § 4: an agent may change hook plumbing but may not ratify its own change.

subject: 42e651c333f7587c91ce5fca9eccfac45345ca0895e35923d9f4cb2c496fa476

(The digest covers the gated files at commit `a37f3475b7`, computed with `./scripts-run src/scripts/ratification_subject`.)

## Where this stands

Rounds 1–6 reviewed a larger change that bound `reread-guard` on Bash and claude `pre_compact` AND added the reference-duty observation. Every round named a new, narrower finding, each fixed test-first (record: `agents/evidence/analysis/reference-duty-council-rounds-2026-11-07.md`). The observation without the new bindings merged as PR #2912, so it is already on `main`: `scanDuties` (every matched rule yields its duties or a counted error, router `trigger_matches`, YAML frontmatter, exact `---` delimiter, per-rule isolation), one `ledgerKey` for reads and duties, version-checked read credit, and the `cat` recognizer and compaction clear as unbound code with tests.

This round's diff is only what #2912 left out, plus round 6's two open points:

- **The binding:** `Bash` added to the concern's `tools:` and `result` to its payload bodies; the concern added to claude `pre_compact` and claude `post_tool_use`.
- **Measured hot-path cost** (`agents/evidence/analysis/reference-duty-hot-path-2026-11-07.md`): the duty scan costs 0.41–0.61 ms p50, < 0.8 ms p90 per Edit/Write on the real router, against a 250 ms p95 hook budget. A Bash call other than a plain `cat <absolute file>` returns after one anchored regex, before any filesystem access.
- **Bounded state:** distinct `rule::reference` keys capped at `MAX_DUTY_KEYS = 256`; a dropped key increments `duty_overflow`. The real bound is the router's path/file-triggered references (two rules today). `duty_errors`/`duty_overflow` are integers. `reads` is the guard's pre-existing per-file map, cleared at `pre_compact` once bound.

The concern is advisory: it never exits 1 and never blocks; on the verified claude host its warn verdict reaches the host as exit 0. It injects nothing for the duty.

## Round 11 and what changed

Round 11: anthropic `ratified` (medium confidence; asked that the FIFO test prove it made a FIFO), openai `REQUEST_CHANGES` without a stance line. Round 12:

- **Deadline:** `_readRegularFileBounded` checks a 50 ms deadline (`CAT_VERIFY_DEADLINE_MS`) before every chunk and gives no credit past it. Test: an injected clock past the deadline yields no credit. The dispatcher runs concerns in-process (`dispatch_hook.ts` § single-process dispatch), where synchronous code cannot be preempted; so a single blocked system call is not bounded — true of every filesystem call every hook makes, including the guard's pre-existing `stat` on Read. The deadline bounds the loop.
- **Allocation:** the output's UTF-8 byte length is compared with the 2 MB bound before any buffer is built from it, and with the bytes read before the content comparison.
- **Path replacement:** after the read, the path must still name the same inode and device as the descriptor read. Test: a rename onto the path during the read yields no credit.
- **FIFO test:** asserts `mkfifo` exited 0 and the path is a FIFO before running the hook.
- Hook bundle: 145 B headroom left after this change.

## Round 10 and what changed

Round 10: anthropic `refused`, openai refusing without a stance line — both on one point: the verification read could block (a `cat` of a FIFO) or read past its bound. Round 11:

- `readRegularFileBounded` opens the path once with `O_RDONLY | O_NONBLOCK`, `fstat`s the descriptor, refuses anything that is not a regular file or exceeds 2 MB, reads at most size + 1 bytes through that descriptor, `fstat`s again and refuses if size or mtime moved, and closes in `finally`. The credited mtime/size come from that same descriptor. Test: a `cat` of a FIFO returns with exit 0 and no credit — before this round the same test hung for its 15 s timeout.
- Measured, in-process: open + read + compare at 10 KB 0.06 ms p95, 1 MB 0.28 ms, 2 MB 0.45 ms (`agents/evidence/analysis/reference-duty-hot-path-2026-11-07.md`).

## Round 9 and what changed

Round 9: anthropic `refused`, openai `refused` — both on one point: a length match would credit an equal-length replacement made after the `cat` ran. Round 10:

- At `post_tool_use` the returned `stdout` must be byte-identical to the file's current content (read once, files up to the 2 MB hash bound; larger files earn no credit). A matching read is credited with the current mtime and size, which are therefore the version whose bytes were returned. Test: an equal-length output that is not the file on disk earns nothing.
- A result carrying a non-zero `exit_code` / `exitCode` / `returnCode` earns nothing. Test included.
- Stated, not changed: `boundedDuty` still parses the whole loaded map before pruning — the file is the session's own ledger under `agents/runtime/`, written only by this concern; the cap bounds what is kept, and a ledger grown by hand is pruned on its next write.

## Round 8 and what changed

Round 8: anthropic `refused`, openai `refused` — both on one point: a Bash `cat` earned read credit at `pre_tool_use`, before it ran, so a failed or truncated call would count. Round 9:

- A `cat` is never credited at `pre_tool_use`. It is credited at claude `post_tool_use` from the tool result, only when the call was not interrupted, `stderr` is empty, and `stdout` is exactly the file's byte count (`recordCompletedCat`). The concern is bound on claude `post_tool_use` and declares `result` among its payload bodies.
- Tests: a pre-execution `cat` records nothing; a completed `cat` with the whole file is credited; a truncated output, an interrupted call, a call with stderr, and a response without stdout each earn nothing. The truncated and interrupted cases were run with their check removed and failed.
- A routing test resolves `reread-guard` on claude Bash `post_tool_use` from the shipped manifest.
- A non-numeric `ts` in a loaded oversized duty map no longer throws inside the load (which emptied the whole ledger); it sorts as 0.
- Stated, not changed: a `Read` tool call is still credited at `pre_tool_use`, as the guard did before this roadmap; the Read tool returns the file itself and is not truncated the way shell output can be.

## Round 7 and what changed

Round 7: anthropic `refused`, openai refusing without a stance line — both on one defect: the cap held only for new keys, so a ledger loaded over 256 keys stayed over. Round 8:

- `readLedger` holds the duty map to `MAX_DUTY_KEYS` on load, keeping the most recent keys by `ts` and adding the excess to `duty_overflow`. Test: a ledger seeded with 266 keys is 256 after one hook run, `duty_overflow` 10.
- A test resolves the concerns from the shipped `hook_manifest.yaml` with the dispatcher's own `_resolve_concerns` / `_concern_matches_tool` and asserts `reread-guard` runs on claude `pre_compact` and on a claude Bash and Read `pre_tool_use`.
- Observability of `duty_overflow`: it is a field of the session ledger beside `duty_errors`, read the same way; no separate channel is added.

## Answer each question, by number

1. What behaviour changes, including what follows from it that the diff does not state?
2. Which authority or safety boundary becomes wider or narrower, and in which direction?
3. Does the change weaken anything that judges it — a test, a gate, a threshold, this review? The standard is quoted rather than paraphrased: the implementer never silently weakens an assertion, deletes, skips or xfails a failing test, lowers a threshold, or changes fixture semantics to fit the code. Does this change do any of those?
4. Is another host or projection left as a way around the control this change touches?
5. Can it be undone, and how — by whom, with what authority, and against which revision?
6. What observation would show the claimed benefit to be false, and what rollback / kill-switch criteria does the change omit?
7. Would a smaller change do, and what does the larger one buy that the smaller one does not?
8. What does it add to standing instruction weight that every later session pays?
9. Could untrusted content steer the path this change opens, and what bounds it if so?

End with exactly one line in this form:
`STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>`

## The diff (`git diff origin/main...feat/reference-duty-binding`, complete except the compiled JSON twin and the council prompts)

```diff
diff --git a/agents/evidence/analysis/reference-duty-hot-path-2026-11-07.md b/agents/evidence/analysis/reference-duty-hot-path-2026-11-07.md
new file mode 100644
index 0000000000..d5af811c64
--- /dev/null
+++ b/agents/evidence/analysis/reference-duty-hot-path-2026-11-07.md
@@ -0,0 +1,59 @@
+<!-- evidence-type: analysis -->
+
+# Reference duty — hot-path cost and state bounds
+
+The two entry questions blocker `hook-binding-ratification` names for re-binding
+`reread-guard` on Bash and claude `pre_compact`
+(`road-to-a-reference-that-arrives-before-the-act` step 2.2).
+
+## Cost per Edit/Write
+
+In-process timing of `scanDuties` + `dutyStates` against the repository's real
+`dist/router.json` and rule tree, 20 warm-up calls then 500 timed calls per path,
+2026-11-07 on the maintainer's Mac:
+
+| Path written | Duties found | p50 | p90 | p99.9 |
+|---|---:|---:|---:|---:|
+| `src/scripts/x.ts` (no trigger matches) | 0 | 0.450 ms | 0.646 ms | 1.055 ms |
+| `dist/agent-src/rules/x.md` | 1 | 0.610 ms | 0.783 ms | 1.153 ms |
+| `.claude/settings.json` | 1 | 0.406 ms | 0.569 ms | 1.209 ms |
+
+Against the `any_hook_event.p95_ci` budget of 250 ms in `hook-latency-budget.json`,
+this is under 0.5 % of it.
+
+## Cost per Bash call
+
+On `pre_tool_use` a Bash call returns at once: a `cat` is never credited there. On
+claude `post_tool_use` every other Bash command is one anchored regex
+(`wholeFileCatPath`) and an early return; a plain `cat <absolute file>` adds one
+`stat`, one read of the file (at most 2 MB) and one ledger write, and is credited only
+when the call was not interrupted, wrote nothing to stderr, exited 0 where the result
+says, and returned bytes identical to the file now on disk.
+
+The read goes through one non-blocking descriptor (a FIFO or device returns at once),
+regular files only, at most 2 MB, refused if size or mtime moved during the read.
+Timed in-process (200 runs after 20 warm-up), open + fstat + read + fstat + byte
+compare:
+
+| File | p50 | p95 |
+|---|---:|---:|
+| 10 KB | 0.02 ms | 0.06 ms |
+| 1 MB | 0.15 ms | 0.28 ms |
+| 2 MB (the cap) | 0.23 ms | 0.45 ms |
+
+The loop checks a 50 ms deadline between chunks and gives no credit past it; a
+single blocked system call is not preemptible in-process, true of every filesystem
+call a hook makes. After the read the path must still name the inode that was read.
+
+Hook bundle after this change: 1,584,855 / 1,585,000 B — 145 B of headroom left; the
+next hook-touching change needs a shrink or a `raise_log` entry first.
+
+## State bounds
+
+- `duty`: at most one entry per `rule::reference` pair. The real bound is the router's
+  path- and file-triggered references (two rules today, per step 2.4); a hard cap of
+  `MAX_DUTY_KEYS = 256` stops a corrupt router from growing the file, and each dropped
+  key increments `duty_overflow`. Entries hold integers, so they do not grow with use.
+- `duty_errors`, `duty_overflow`: single integers.
+- `reads`: one entry per distinct file read in full, unchanged from the guard's
+  behaviour before this roadmap; cleared at `pre_compact` once bound.
diff --git a/src/scripts/hook_manifest.yaml b/src/scripts/hook_manifest.yaml
index 6d4058a2bb..6631126372 100644
--- a/src/scripts/hook_manifest.yaml
+++ b/src/scripts/hook_manifest.yaml
@@ -1319,9 +1319,11 @@ concerns:
     fail_closed: false
     severity: advisory
     effect: verification
-    # Provable from the hook's own source: READ_TOOLS ∪ WRITE_TOOLS.
-    tools: [Read, Edit, Write]
-    needs_payload_bodies: [input]
+    # Provable from the hook's own source: READ_TOOLS ∪ WRITE_TOOLS, plus Bash
+    # for a completed whole-file `cat <absolute file>` (recordCompletedCat), which
+    # is credited at post_tool_use from the tool result, never before it ran.
+    tools: [Read, Edit, Write, Bash]
+    needs_payload_bodies: [input, result]
   # Memory recall — delivers a memory the store ALREADY holds, at the moment
   # the tool call it is about would run. The finding: in one long autonomous
   # run the agent walked into four traps that each had a memory file written
@@ -1780,7 +1782,7 @@ platforms:
     # `project_thin_rules.path_only_ids`; the receiver is
     # `agents/roadmaps/stubs/road-to-a-path-route-under-delivery.md`.
     pre_tool_use:     [block-no-verify, evidence-independence, block-kernel-rule-writes, block-plumbing-writes, block-config-weakening, block-speaking-inbox-dir, block-credential-reads, one-question-per-ask, rtk-wrap, design-slop, ui-route-nudge, code-graph-context, chain-nudge, ship-diff-volume, reread-guard, spawn-guard-shadow, metered-spawn-ask, source-first-gate, memory-recall, memory-audience-shadow]
-    post_tool_use:    [chat-history, roadmap-progress, context-hygiene, verify-before-complete, minimal-safe-diff, injection-scan, pr-url-reminder, push-settle, orchestration-record, telemetry-usage, mcp-usage-observation, tool-result-bytes, edit-shape, comment-discipline, language-mirror, design-pass, journal-record, spawn-guard-shadow, metered-spawn-ask]
+    post_tool_use:    [chat-history, roadmap-progress, context-hygiene, verify-before-complete, minimal-safe-diff, injection-scan, pr-url-reminder, push-settle, orchestration-record, telemetry-usage, mcp-usage-observation, tool-result-bytes, edit-shape, comment-discipline, language-mirror, design-pass, journal-record, spawn-guard-shadow, metered-spawn-ask, reread-guard]
     # `language-mirror` — round-5 § 6.1. `pre_compact` sets a pin-lost marker;
     # the `post_tool_use` entry above re-emits the pin exactly once while that
     # marker is set, then clears it. One extra injection per compaction EVENT —
@@ -1789,7 +1791,7 @@ platforms:
     # Claude Code transcript fact. (It was the ONLY binding on this slot until
     # the entry below; that sentence is retired rather than left to rot.)
     #
-    pre_compact:      [language-mirror, rule-inject, journal-record]
+    pre_compact:      [language-mirror, rule-inject, journal-record, reread-guard]
     # road-to-subagent-lifecycle-integrity Phase 1 Step 1. `claude` is the only
     # platform where both native events were measured present on the installed
     # binary (2.1.229 — see the evidence page cited on the alias rows below).
diff --git a/src/scripts/hooks/reread_guard_hook.ts b/src/scripts/hooks/reread_guard_hook.ts
index a05fb0749c..7c8d3af3e7 100644
--- a/src/scripts/hooks/reread_guard_hook.ts
+++ b/src/scripts/hooks/reread_guard_hook.ts
@@ -4,10 +4,9 @@
  * (road-to-token-economy-cache Phase 6.1/6.2). A subagent's reads are keyed
  * apart from its parent's (`agent_id`).
  *
- * The concern also handles a `pre_compact` envelope (clears the recorded reads)
- * and a Bash `cat <absolute file>` (a full read), but the manifest binds it to
- * neither yet: that binding is hook plumbing and lands with its own
- * ratification.
+ * Also bound on claude `post_tool_use`, where a completed Bash `cat <absolute
+ * file>` that returned the whole file counts as a full read, and on claude
+ * `pre_compact`, where it clears the recorded reads: compaction drops what was read.
  *
  * Two signals, one session-scoped read ledger:
  *
@@ -72,6 +71,7 @@
 import * as crypto from 'node:crypto';
 import * as fs from 'node:fs';
 import * as path from 'node:path';
+import { performance } from 'node:perf_hooks';
 import { fileURLToPath, pathToFileURL } from 'node:url';
 
 import { unwrap, type JsonObject, type JsonValue } from './envelope.js';
@@ -129,6 +129,9 @@ export interface ReadRecord {
  */
 export const HASH_BOUND_BYTES = 2 * 1024 * 1024;
 
+/** How long the post-execution `cat` verification may spend reading, between chunks. */
+export const CAT_VERIFY_DEADLINE_MS = 50;
+
 /**
  * What the content key could say about one read. Only `over-bound` — the stat
  * itself was over — licenses the stat fallback: after `grew-during-read` the
@@ -202,6 +205,8 @@ export interface Ledger {
     duty?: Record<string, DutyRecord>;
     /** File acts whose duty could not be computed (an unreadable router). */
     duty_errors?: number;
+    /** Duty keys dropped at {@link MAX_DUTY_KEYS}. */
+    duty_overflow?: number;
 }
 
 function emptyLedger(): Ledger {
@@ -223,6 +228,23 @@ export function ledgerFile(workspaceRoot: string, sessionKey: string): string {
     return path.join(workspaceRoot, 'agents', 'runtime', 'state', 'reread-guard', `${sessionKey}.json`);
 }
 
+/**
+ * The duty map as loaded, held to {@link MAX_DUTY_KEYS}: a ledger written before
+ * the cap, or by hand, keeps its most recent keys and counts the rest.
+ */
+function boundedDuty(parsed: JsonObject): Pick<Ledger, 'duty' | 'duty_overflow'> {
+    const prior = typeof parsed['duty_overflow'] === 'number' ? parsed['duty_overflow'] : 0;
+    if (!isObject(parsed['duty'])) return prior > 0 ? { duty_overflow: prior } : {};
+    const entries = Object.entries(parsed['duty'] as unknown as Record<string, DutyRecord>);
+    if (entries.length <= MAX_DUTY_KEYS) return { duty: Object.fromEntries(entries), ...(prior > 0 ? { duty_overflow: prior } : {}) };
+    const ts = (r: unknown): number => {
+        const v = isObject(r as JsonValue) ? (r as Record<string, unknown>)['ts'] : undefined;
+        return typeof v === 'number' && Number.isFinite(v) ? v : 0;
+    };
+    entries.sort((a, b) => ts(b[1]) - ts(a[1]));
+    return { duty: Object.fromEntries(entries.slice(0, MAX_DUTY_KEYS)), duty_overflow: prior + entries.length - MAX_DUTY_KEYS };
+}
+
 export function readLedger(workspaceRoot: string, sessionKey: string): Ledger {
     try {
         const parsed = JSON.parse(fs.readFileSync(ledgerFile(workspaceRoot, sessionKey), 'utf8'));
@@ -231,7 +253,7 @@ export function readLedger(workspaceRoot: string, sessionKey: string): Ledger {
             reads: isObject(parsed['reads']) ? (parsed['reads'] as unknown as Record<string, ReadRecord>) : {},
             writes: isObject(parsed['writes']) ? (parsed['writes'] as Record<string, number>) : {},
             fired: isObject(parsed['fired']) ? (parsed['fired'] as Record<string, boolean>) : {},
-            ...(isObject(parsed['duty']) ? { duty: parsed['duty'] as unknown as NonNullable<Ledger['duty']> } : {}),
+            ...boundedDuty(parsed),
             ...(typeof parsed['duty_errors'] === 'number' ? { duty_errors: parsed['duty_errors'] } : {}),
         };
     } catch {
@@ -303,6 +325,13 @@ export function buildPostEditReadLine(relPath: string): string {
     );
 }
 
+/**
+ * Distinct `rule::reference` keys a ledger keeps. The real bound is the router's
+ * path- and file-triggered references (a handful); the cap only stops a corrupt
+ * or hostile router from growing the file, and a dropped key is counted.
+ */
+export const MAX_DUTY_KEYS = 256;
+
 export interface DutyRecord {
     state: DutyState;
     pending: number;
@@ -325,6 +354,10 @@ function recordDuty(ledger: Ledger, key: string, workspaceRoot: string): void {
     const ts = Date.now();
     ledger.duty = { ...(ledger.duty ?? {}) };
     for (const [k, state] of Object.entries(states)) {
+        if (ledger.duty[k] === undefined && Object.keys(ledger.duty).length >= MAX_DUTY_KEYS) {
+            ledger.duty_overflow = (ledger.duty_overflow ?? 0) + 1;
+            continue;
+        }
         const prior = ledger.duty[k] ?? { state, pending: 0, read: 0, ts };
         ledger.duty[k] = {
             state,
@@ -335,6 +368,81 @@ function recordDuty(ledger: Ledger, key: string, workspaceRoot: string): void {
     }
 }
 
+/**
+ * One regular file read through one descriptor: opened non-blocking (a FIFO or
+ * device returns instead of hanging the hook), refused unless it is a regular file
+ * within `limit` bytes, refused when its size or mtime moved during the read, when
+ * the path no longer names the inode that was read, or when `deadlineMs` passes
+ * between chunks. Null on any of those, or on any error. A single system call is
+ * not preemptible in-process — true of every filesystem call a hook makes — so the
+ * deadline bounds the loop, not one blocked syscall. `now` and `afterRead` are
+ * testing seams.
+ */
+export function _readRegularFileBounded(
+    file: string,
+    limit: number,
+    opts: { deadlineMs?: number; now?: () => number; afterRead?: () => void } = {},
+): { bytes: Buffer; stat: fs.Stats } | null {
+    const now = opts.now ?? ((): number => performance.now());
+    const deadline = now() + (opts.deadlineMs ?? CAT_VERIFY_DEADLINE_MS);
+    let fd: number | null = null;
+    try {
+        fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK);
+        const before = fs.fstatSync(fd);
+        if (!before.isFile() || before.size > limit) return null;
+        const buf = Buffer.alloc(before.size + 1);
+        let got = 0;
+        for (;;) {
+            if (now() > deadline) return null;
+            const n = fs.readSync(fd, buf, got, buf.length - got, null);
+            if (n === 0) break;
+            got += n;
+            if (got > before.size) return null;
+        }
+        opts.afterRead?.();
+        const after = fs.fstatSync(fd);
+        if (got !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs) return null;
+        const named = fs.statSync(file);
+        if (named.ino !== after.ino || named.dev !== after.dev) return null;
+        return { bytes: buf.subarray(0, got), stat: after };
+    } catch {
+        return null;
+    } finally {
+        if (fd !== null) fs.closeSync(fd);
+    }
+}
+
+/**
+ * A Bash `cat <absolute file>` earns read credit only after it ran, and only when
+ * the whole file came back: not interrupted, nothing on stderr, no non-zero exit
+ * status, and stdout byte-identical to the file now on disk (up to the hash bound).
+ * A pre_tool_use cannot know any of that, which is why a `cat` is never credited
+ * there.
+ */
+function recordCompletedCat(envelope: JsonObject, payload: JsonObject): void {
+    if (extractToolName(payload) !== 'Bash') return;
+    const catPath = wholeFileCatPath(str(extractToolInput(payload)['command']));
+    if (catPath === null) return;
+    const resp = payload['tool_response'] ?? payload['toolResponse'];
+    if (!isObject(resp)) return;
+    const stdout = resp['stdout'];
+    if (typeof stdout !== 'string' || resp['interrupted'] === true || str(resp['stderr'] as JsonValue | undefined) !== '') return;
+    const exit = resp['exit_code'] ?? resp['exitCode'] ?? resp['returnCode'];
+    if (exit !== undefined && exit !== null && exit !== 0) return;
+    const workspaceRoot = str(envelope['workspace_root'] as JsonValue | undefined).trim() || process.cwd();
+    if (Buffer.byteLength(stdout, 'utf8') > HASH_BOUND_BYTES) return;
+    const snap = _readRegularFileBounded(catPath, HASH_BOUND_BYTES);
+    if (snap === null || Buffer.byteLength(stdout, 'utf8') !== snap.bytes.length) return;
+    const st = snap.stat;
+    // The bytes returned must be the file as it is now: a length match alone
+    // would credit an equal-length replacement made after the cat ran.
+    if (!snap.bytes.equals(Buffer.from(stdout, 'utf8'))) return;
+    const sessionKey = deriveSessionKey(envelope, payload);
+    const ledger = readLedger(workspaceRoot, sessionKey);
+    ledger.reads[ledgerKey(workspaceRoot, catPath)] = { mtime: st.mtimeMs, size: st.size, ts: Date.now() };
+    writeLedger(workspaceRoot, sessionKey, ledger);
+}
+
 export function main(): number {
     try {
         const [envelope, payload] = unwrap(readHookStdin(), 'claude');
@@ -353,16 +461,19 @@ export function main(): number {
             });
             return EXIT_ALLOW;
         }
+        if (event === 'post_tool_use') {
+            recordCompletedCat(envelope, payload);
+            return EXIT_ALLOW;
+        }
         if (event !== '' && event !== 'pre_tool_use') return EXIT_ALLOW;
 
         const toolName = extractToolName(payload);
         const toolInput = extractToolInput(payload);
-        const catPath = toolName === 'Bash' ? wholeFileCatPath(str(toolInput['command'])) : null;
-        const isRead = READ_TOOLS.has(toolName) || catPath !== null;
+        const isRead = READ_TOOLS.has(toolName);
         const isWrite = WRITE_TOOLS.has(toolName);
         if (!isRead && !isWrite) return EXIT_ALLOW;
 
-        const filePath = catPath ?? extractFilePath(toolInput);
+        const filePath = extractFilePath(toolInput);
         if (!filePath) return EXIT_ALLOW;
 
         const workspaceRoot = str(envelope['workspace_root'] as JsonValue | undefined).trim() || process.cwd();
diff --git a/tests/scripts/reference_duty.test.ts b/tests/scripts/reference_duty.test.ts
index 93612c775c..4cf0d80e35 100644
--- a/tests/scripts/reference_duty.test.ts
+++ b/tests/scripts/reference_duty.test.ts
@@ -12,7 +12,8 @@ import { fileURLToPath } from 'node:url';
 import { afterEach, describe, expect, it } from 'vitest';
 
 import { dutyStates, scanDuties } from '../../src/scripts/_lib/reference_duty.js';
-import { ledgerFile } from '../../src/scripts/hooks/reread_guard_hook.js';
+import { _concern_matches_tool, _load_yaml, _resolve_concerns } from '../../src/scripts/hooks/dispatch_hook.js';
+import { ledgerFile, MAX_DUTY_KEYS } from '../../src/scripts/hooks/reread_guard_hook.js';
 
 const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
 const HOOK = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'reread_guard_hook.ts');
@@ -233,3 +234,53 @@ describe('council round 6', () => {
         expect(scan.errors).toHaveLength(1);
     });
 });
+
+describe('ratification entry questions: bounded state', () => {
+    it('caps distinct duty keys and counts what it drops', () => {
+        const root = workspace();
+        const key = crypto.createHash('sha256').update('s1').digest('hex');
+        const ledgerPath = ledgerFile(root, key);
+        fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
+        const duty: Record<string, unknown> = {};
+        for (let i = 0; i < MAX_DUTY_KEYS; i++) duty[`r${String(i)}::x`] = { state: 'read', pending: 0, read: 1, ts: 1 };
+        fs.writeFileSync(ledgerPath, JSON.stringify({ reads: {}, writes: {}, fired: {}, duty }));
+        run(root, { tool_name: 'Write', tool_input: { file_path: path.join(root, '.claude', 'x.md'), content: 'x' } });
+        const after = JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) as { duty: Record<string, unknown>; duty_overflow?: number };
+        expect(Object.keys(after.duty)).toHaveLength(MAX_DUTY_KEYS);
+        expect(after.duty_overflow).toBe(1);
+    });
+});
+
+describe('the shipped manifest routes the read ledger where the duty needs it', () => {
+    const manifest = _load_yaml(path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml'));
+    it('runs reread-guard on claude pre_compact', () => {
+        expect(_resolve_concerns(manifest, 'claude', 'pre_compact').map((c) => c.name)).toContain('reread-guard');
+    });
+    it('runs reread-guard on a claude Bash post_tool_use, where a completed cat is credited', () => {
+        const concern = _resolve_concerns(manifest, 'claude', 'post_tool_use').find((c) => c.name === 'reread-guard');
+        expect(concern).toBeDefined();
+        expect(_concern_matches_tool(concern as unknown as Record<string, never>, 'Bash')).toBe(true);
+    });
+    it('runs reread-guard on a claude Bash pre_tool_use, and on Read', () => {
+        const concern = _resolve_concerns(manifest, 'claude', 'pre_tool_use').find((c) => c.name === 'reread-guard');
+        expect(concern).toBeDefined();
+        expect(_concern_matches_tool(concern as unknown as Record<string, never>, 'Bash')).toBe(true);
+        expect(_concern_matches_tool(concern as unknown as Record<string, never>, 'Read')).toBe(true);
+    });
+});
+
+describe('the cap holds on a ledger loaded over it', () => {
+    it('prunes an oversized duty map on load and counts the excess', () => {
+        const root = workspace();
+        const key = crypto.createHash('sha256').update('s1').digest('hex');
+        const ledgerPath = ledgerFile(root, key);
+        fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
+        const duty: Record<string, unknown> = {};
+        for (let i = 0; i < MAX_DUTY_KEYS + 10; i++) duty[`r${String(i)}::x`] = { state: 'read', pending: 0, read: 1, ts: i };
+        fs.writeFileSync(ledgerPath, JSON.stringify({ reads: {}, writes: {}, fired: {}, duty }));
+        run(root, { tool_name: 'Write', tool_input: { file_path: path.join(root, 'src', 'a.ts'), content: 'x' } });
+        const after = JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) as { duty: Record<string, unknown>; duty_overflow?: number };
+        expect(Object.keys(after.duty)).toHaveLength(MAX_DUTY_KEYS);
+        expect(after.duty_overflow).toBe(10);
+    });
+});
diff --git a/tests/scripts/reread_guard_hook.test.ts b/tests/scripts/reread_guard_hook.test.ts
index 78bdd51a97..f880bcdd30 100644
--- a/tests/scripts/reread_guard_hook.test.ts
+++ b/tests/scripts/reread_guard_hook.test.ts
@@ -32,6 +32,7 @@ import {
     isExemptPath,
     isRangedRead,
     ledgerFile,
+    _readRegularFileBounded,
     wholeFileCatPath,
 } from '../../src/scripts/hooks/reread_guard_hook.js';
 
@@ -402,12 +403,41 @@ describe('deriveSessionKey separates a subagent from its parent', () => {
 });
 
 describe('E2E: the ledger as the reference duty needs it', () => {
-    it('records a whole-file `cat` through Bash as a full read', () => {
+    function postBash(root: string, command: string, response: object): string {
+        return JSON.stringify({ schema_version: 1, platform: 'claude', event: 'post_tool_use', session_id: 'sess-1', workspace_root: root, payload: { tool_name: 'Bash', tool_input: { command }, tool_response: response } });
+    }
+    function reads(root: string): string[] {
+        const p = ledgerFile(root, deriveSessionKey({ session_id: 'sess-1' }, {}));
+        return fs.existsSync(p) ? Object.keys(JSON.parse(fs.readFileSync(p, 'utf8')).reads) : [];
+    }
+    it('credits a whole-file `cat` only after it ran, and only when the whole file came back', () => {
         const { root, abs } = makeWorkspace();
+        const body = fs.readFileSync(abs, 'utf8');
         run(envelope(root, { tool_name: 'Bash', tool_input: { command: `cat ${abs}` } }), root);
-        const key = deriveSessionKey({ session_id: 'sess-1' }, {});
-        const ledger = JSON.parse(fs.readFileSync(ledgerFile(root, key), 'utf8'));
-        expect(Object.keys(ledger.reads)).toEqual([path.relative(root, abs)]);
+        expect(reads(root)).toEqual([]);
+        run(postBash(root, `cat ${abs}`, { stdout: body, stderr: '', interrupted: false }), root);
+        expect(reads(root)).toEqual([path.relative(root, abs)]);
+    });
+    it('gives no credit for a cat of a FIFO, and returns instead of blocking on it', () => {
+        const { root } = makeWorkspace();
+        const fifo = path.join(root, 'pipe');
+        expect(spawnSync('mkfifo', [fifo]).status).toBe(0);
+        expect(fs.statSync(fifo).isFIFO()).toBe(true);
+        const r = spawnSync(TSX, [HOOK], { encoding: 'utf8', cwd: root, input: postBash(root, `cat ${fifo}`, { stdout: '', stderr: '', interrupted: false }), timeout: 15000 });
+        expect(r.status).toBe(0);
+        expect(reads(root)).toEqual([]);
+    });
+    it.each([
+        ['a truncated output', (b: string) => ({ stdout: b.slice(0, 5), stderr: '', interrupted: false })],
+        ['an interrupted call', (b: string) => ({ stdout: b, stderr: '', interrupted: true })],
+        ['a call that wrote to stderr', (b: string) => ({ stdout: b, stderr: 'cat: boom', interrupted: false })],
+        ['a response without stdout', () => ({ stderr: '', interrupted: false })],
+        ['a non-zero exit status', (b: string) => ({ stdout: b, stderr: '', interrupted: false, exit_code: 1 })],
+        ['an equal-length output that is not the file now on disk', (b: string) => ({ stdout: 'X'.repeat(Buffer.byteLength(b)), stderr: '', interrupted: false })],
+    ])('gives no read credit for %s', (_name, response) => {
+        const { root, abs } = makeWorkspace();
+        run(postBash(root, `cat ${abs}`, response(fs.readFileSync(abs, 'utf8'))), root);
+        expect(reads(root)).toEqual([]);
     });
     it('clears the recorded reads on pre_compact, so a duty applies again', () => {
         const { root, abs } = makeWorkspace();
@@ -418,3 +448,25 @@ describe('E2E: the ledger as the reference duty needs it', () => {
         expect(JSON.parse(fs.readFileSync(ledgerFile(root, key), 'utf8')).reads).toEqual({});
     });
 });
+
+describe('_readRegularFileBounded — the verification read', () => {
+    it('reads a regular file within the limit', () => {
+        const { abs } = makeWorkspace();
+        expect(_readRegularFileBounded(abs, 1024)?.bytes.toString('utf8')).toBe(fs.readFileSync(abs, 'utf8'));
+    });
+    it('refuses a file over the limit', () => {
+        const { abs } = makeWorkspace();
+        expect(_readRegularFileBounded(abs, 3)).toBeNull();
+    });
+    it('refuses when the deadline passes before the read completes', () => {
+        const { abs } = makeWorkspace();
+        let t = 0;
+        expect(_readRegularFileBounded(abs, 1024, { deadlineMs: 50, now: () => (t += 100) })).toBeNull();
+    });
+    it('refuses when the path was replaced while it was read', () => {
+        const { root, abs } = makeWorkspace();
+        const other = path.join(root, 'other.ts');
+        fs.writeFileSync(other, fs.readFileSync(abs));
+        expect(_readRegularFileBounded(abs, 1024, { afterRead: () => fs.renameSync(other, abs) })).toBeNull();
+    });
+});
```
