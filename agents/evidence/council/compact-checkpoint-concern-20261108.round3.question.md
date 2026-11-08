<!-- evidence-type: analysis -->

<!-- Round-3 prompt given to the council on 2026-11-08 for branch
     feat/compact-checkpoint-phase-1, committed verbatim beside the record. -->

# Ratification review, round 3 — a new hook concern and its budget row

Same question as rounds 1 and 2, on the code as it now stands. Judge whether
the change expands any authority — can it block, deny, rewrite or inject
anything, lower a ceiling, weaken a gate, or reach the model's context? Answer
with exactly one verdict and the reasons:

- `ratified` — it expands authority, and the expansion is acceptable.
- `confirmed-non-expanding` — it expands no authority.
- `refused` — it expands authority in a way that should not merge, or the
  material does not let you tell.

Also name any defect that should block the merge regardless of the verdict.

## Round-2 findings and what changed

1. Ancestor symlinks (`agents/`, `agents/runtime/`) bypassed the check, and the
   observation path read and deleted without one. Now: every read, write and
   delete — including observation and the tally — first runs the repository's
   existing `containedPath(root, dir)` (each existing component from the root
   down must be a real directory, checked with lstat), and observation returns
   `none` with no file access when it fails.
2. FIFOs and special files could block a read. Now: reads open with
   `O_RDONLY|O_NOFOLLOW|O_NONBLOCK`, require `fstat().isFile()` and a size cap.
3. The log was read whole before trimming. Now: appends use
   `O_APPEND|O_CREAT|O_NOFOLLOW`; above 64 KB a bounded read (≤ 1 MB) trims to
   the last 2,000 short JSON lines, and an unreadable or oversized log is
   replaced.
4. Concurrency. Stated, not fixed: two sessions appending can interleave, and a
   trim racing an append can drop that append — accepted for a counts-only log.
5. Budget derivation mismatch. Now: the chunk measures 37,988 bytes and its
   ceiling row says so; the dispatch bundle measures 1,584,918 against the
   unchanged 1,585,000.

Tests now: 25 cases, including an ancestor symlink on write and on
observation, a FIFO at the checkpoint path, and an oversized log. Removing the
boundary check reds the three symlink tests.

## The diff of the gated files

~~~diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 72ebb16456..6cd933de48 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -275,6 +275,12 @@
             "registered_at": "2026-10-28",
             "derivation": "Measured 9,807 bytes on 2026-10-28 (the intake-pass concern, its task-prompt and question predicates after council round 1, and the shared `isSyntheticPrompt` reader), no `yaml`. The ceiling is that reading plus about 10 %, rounded, with no growth queued. Bound on `user_prompt_submit` on every host that binds the slot; the dispatch bundle carries only its LAZY_CONCERNS row. A missing chunk falls back to the spawn path and costs latency, never the line."
         },
+        {
+            "entry": "src/scripts/hooks/compact_checkpoint_hook.ts",
+            "max_bytes": 41800,
+            "registered_at": "2026-11-08",
+            "derivation": "Measured 37,988 bytes on 2026-11-08 (the compact-checkpoint concern with its filesystem boundary, the continuity-record writer it reuses and the roadmap-claim reader), `yaml` external. The ceiling is that reading plus about 10 %, rounded, with no growth queued. Bound on `pre_compact` and `session_start` on claude only; the dispatch bundle carries only its LAZY_CONCERNS row."
+        },
         {
             "entry": "src/scripts/hooks/web_launch_rows.ts",
             "max_bytes": 14000,
diff --git a/src/scripts/hook_manifest.yaml b/src/scripts/hook_manifest.yaml
index 6631126372..f7eabf8d9d 100644
--- a/src/scripts/hook_manifest.yaml
+++ b/src/scripts/hook_manifest.yaml
@@ -1662,6 +1662,17 @@ concerns:
   # has happened. The journal's own RECORDED_EVENTS / NOT_RECORDED partition is
   # unchanged — it governs the vocabulary, not the bindings — so the capture
   # evidence states the unbound slot instead of the partition implying coverage.
+  # road-to-state-and-pins-across-compaction 1.2: writes a task-state
+  # checkpoint at `pre_compact` and classifies it at `session_start(compact)`.
+  # Injects nothing (council 2026-11-08: the keys name the session, not the
+  # compaction attempt). Claude only — the one host whose compaction records
+  # were measured. Kill switch: `AGENT_CONFIG_NO_COMPACT_CHECKPOINT=1`.
+  compact-checkpoint:
+    script: src/scripts/hooks/compact_checkpoint_hook.ts
+    args: []
+    fail_closed: false
+    severity: advisory
+    effect: telemetry
   journal-record:
     script: src/scripts/hooks/journal_record_hook.ts
     args: []
@@ -1744,7 +1755,7 @@ platforms:
 
   claude:
     ask:              native
-    session_start:    [chat-history, hot-context, handoff-context, session-canary, council-availability, telemetry-disclosure, first-run-gate, onboarding-gate, verify-before-complete, minimal-safe-diff, profile-staleness, wrapper-freshness, update-notice, star-ask, surface-probe, session-register, review-baseline, journal-record, rule-inject, code-graph-refresh, layer-promote]
+    session_start:    [chat-history, hot-context, handoff-context, session-canary, council-availability, telemetry-disclosure, first-run-gate, onboarding-gate, verify-before-complete, minimal-safe-diff, profile-staleness, wrapper-freshness, update-notice, star-ask, surface-probe, session-register, review-baseline, journal-record, rule-inject, code-graph-refresh, layer-promote, compact-checkpoint]
     # `rule-inject` is bound here for ONE source: `compact`
     # (road-to-a-rule-carrier-that-works-outside-the-repo step 1.6). The concern
     # returns before reading anything on `startup`, `resume`, `clear` and
@@ -1791,7 +1802,7 @@ platforms:
     # Claude Code transcript fact. (It was the ONLY binding on this slot until
     # the entry below; that sentence is retired rather than left to rot.)
     #
-    pre_compact:      [language-mirror, rule-inject, journal-record, reread-guard]
+    pre_compact:      [language-mirror, rule-inject, journal-record, reread-guard, compact-checkpoint]
     # road-to-subagent-lifecycle-integrity Phase 1 Step 1. `claude` is the only
     # platform where both native events were measured present on the installed
     # binary (2.1.229 — see the evidence page cited on the alias rows below).
~~~

## The concern source

~~~ts
#!/usr/bin/env tsx
/**
 * compact-checkpoint — writes a task-state checkpoint at `pre_compact` and, at
 * `session_start` with source `compact`, records what an injection would have
 * met. It prints nothing and injects nothing: the identity keys available
 * today name the session, not the compaction attempt.
 *
 * Effect `telemetry`, never blocks: every path exits 0. Kill switch
 * `AGENT_CONFIG_NO_COMPACT_CHECKPOINT=1`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { observePostCompact, recordPreCompact } from '../_lib/compact_checkpoint.js';
import { readHookStdin } from './hook_stdin.js';
import { unwrap } from './envelope.js';
import { is_replay_mode } from './state_io.js';
import { read_claimed_slug } from '../_lib/roadmap_claim.js';

function str(v: unknown): string {
    return typeof v === 'string' ? v.trim() : '';
}

// Walks up because the source (src/scripts/hooks/) and the built chunk
// (dist/hooks/) sit at different depths below the package root.
function packageVersion(): string | null {
    let dir = process.env['AGENT_CONFIG_PACKAGE_ROOT'] || path.dirname(fileURLToPath(import.meta.url));
    for (let i = 0; i < 5; i++) {
        try {
            const v = (JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) as { version?: unknown }).version;
            if (typeof v === 'string') return v;
        } catch {
            // not here, keep walking
        }
        const up = path.dirname(dir);
        if (up === dir) break;
        dir = up;
    }
    return null;
}

export function main(): number {
    if (process.env['AGENT_CONFIG_NO_COMPACT_CHECKPOINT'] === '1') return 0;
    try {
        const [envelope, payload] = unwrap(readHookStdin(), 'claude');
        if (is_replay_mode()) return 0;
        const event = str(envelope['event']);
        const sessionId = str(payload['session_id']) || str(envelope['session_id']);
        const transcriptPath = str(payload['transcript_path'] ?? payload['transcriptPath']);
        if (sessionId === '' || transcriptPath === '') return 0;
        const root = str(envelope['workspace_root']) || process.cwd();
        const input = { root, sessionId, transcriptPath, version: packageVersion() };
        if (event === 'pre_compact') {
            recordPreCompact({ ...input, slug: read_claimed_slug(root, sessionId) });
        } else if (event === 'session_start' && str(payload['source'] ?? envelope['source']) === 'compact') {
            observePostCompact({ ...input, slug: null });
        }
    } catch {
        // a measurement never fails a compaction
    }
    return 0;
}

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return false;
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
~~~

## The library it calls

~~~ts
/**
 * Compaction checkpoint — written at `pre_compact`, classified after, never injected.
 *
 * Injection is deliberately absent: (session key, transcript hash) names the
 * session, not the compaction attempt, so a checkpoint left behind by an
 * aborted compaction would match the next one. Until an attempt-specific
 * signal exists this module only writes and measures.
 *
 * What it records:
 *
 *   - `orphaned` — a checkpoint still unclassified when the next `pre_compact`
 *     runs. An aborted compaction produces this, and so does a compaction whose
 *     `session_start` never reached the concern; the count cannot tell them apart.
 *   - the post-compaction class — `match`, `key-mismatch`, `version-mismatch`,
 *     `stale` or `none` — of what an injection WOULD have met. Nothing is
 *     returned to the model on any path.
 *   - `age_ms` between write and classification, so a staleness bound can be
 *     set from readings rather than guessed.
 *
 * The checkpoint body is the deterministic continuity record: same gates, same
 * forbidden judgement fields. The event log carries counts and ages only and is
 * bounded. Every read, write and delete first requires each path component
 * from the repository root down to be a real directory, and reads only regular
 * files of bounded size without following or blocking — hooks run inside
 * repositories whose contents others can supply, including symlinks and FIFOs.
 *
 * Two sessions appending at once can interleave; a trim racing an append can
 * drop that append. Accepted for a counts-only log.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { containedPath } from './contained_write.js';
import { buildContinuityRecord } from './continuity_writer.js';
import { eolSessionKey, eolStateFile, type StoredEolCounters } from './session_eol.js';

/** A classification older than this reads as `stale`. A stated default, set to be revised from `age_ms` readings. */
export const STALE_AFTER_MS = 10 * 60 * 1000;

/** The event log keeps at most this many lines; older ones are dropped when it is trimmed. */
export const EVENT_LOG_MAX_LINES = 2000;

/** A log larger than this is trimmed; one that cannot be read within it is replaced. */
export const EVENT_LOG_MAX_BYTES = 256 * 1024;

const CHECKPOINT_MAX_BYTES = 256 * 1024;

export type PreCompactOutcome = 'written' | 'skipped';
export type PostCompactOutcome = 'match' | 'key-mismatch' | 'version-mismatch' | 'stale' | 'none';
type EventName = PreCompactOutcome | 'orphaned' | PostCompactOutcome;

export interface CheckpointInput {
    root: string;
    sessionId: string;
    transcriptPath: string;
    slug: string | null;
    version: string | null;
    now?: Date;
}

interface Checkpoint {
    schema_version: 1;
    session_key: string;
    transcript_hash: string;
    package_version: string | null;
    written_at: string;
    continuity: Record<string, unknown>;
}

export function checkpointDir(root: string): string {
    return path.join(root, 'agents', 'runtime', 'state', 'compact-checkpoint');
}

export function checkpointFile(root: string, sessionKey: string): string {
    return path.join(checkpointDir(root), `${sessionKey}.json`);
}

export function eventsFile(root: string): string {
    return path.join(checkpointDir(root), 'events.jsonl');
}

export function transcriptHash(transcriptPath: string): string {
    return crypto.createHash('sha256').update(transcriptPath).digest('hex').slice(0, 16);
}

function isSymlink(p: string): boolean {
    try {
        return fs.lstatSync(p).isSymbolicLink();
    } catch {
        return false;
    }
}

/** True when every existing component from `root` down to the checkpoint directory is a real directory. */
function inBoundary(root: string): boolean {
    return containedPath(root, checkpointDir(root));
}

/** The directory, created inside the boundary, or `null` when the boundary does not hold. */
function safeDir(root: string): string | null {
    const dir = checkpointDir(root);
    if (!inBoundary(root)) return null;
    fs.mkdirSync(dir, { recursive: true });
    return inBoundary(root) ? dir : null;
}

/** A regular file's text, read without following a symlink or blocking; `null` otherwise or over `max` bytes. */
function readRegular(file: string, max: number): string | null {
    const { O_RDONLY, O_NOFOLLOW, O_NONBLOCK } = fs.constants;
    let fd: number;
    try {
        fd = fs.openSync(file, O_RDONLY | (O_NOFOLLOW ?? 0) | (O_NONBLOCK ?? 0));
    } catch {
        return null;
    }
    try {
        const st = fs.fstatSync(fd);
        if (!st.isFile() || st.size > max) return null;
        return fs.readFileSync(fd, 'utf8');
    } catch {
        return null;
    } finally {
        fs.closeSync(fd);
    }
}

function isRegularFile(p: string): boolean {
    try {
        return fs.lstatSync(p).isFile();
    } catch {
        return false;
    }
}

function readCheckpoint(file: string): Checkpoint | null {
    const text = readRegular(file, CHECKPOINT_MAX_BYTES);
    if (text === null) return null;
    try {
        const cp = JSON.parse(text) as Partial<Checkpoint>;
        if (
            cp?.schema_version !== 1 ||
            typeof cp.session_key !== 'string' ||
            typeof cp.transcript_hash !== 'string' ||
            typeof cp.written_at !== 'string' ||
            !Number.isFinite(Date.parse(cp.written_at)) ||
            (cp.package_version !== null && typeof cp.package_version !== 'string') ||
            cp.continuity === null ||
            typeof cp.continuity !== 'object'
        ) {
            return null;
        }
        return cp as Checkpoint;
    } catch {
        return null;
    }
}

function writeAtomic(dir: string, file: string, body: string): void {
    if (isSymlink(file)) throw new Error('refusing to write through a symlink');
    const tmp = path.join(dir, `.${path.basename(file)}.${crypto.randomBytes(6).toString('hex')}.tmp`);
    fs.writeFileSync(tmp, body, { flag: 'wx' });
    fs.renameSync(tmp, file);
}

function logEvent(root: string, event: EventName, now: Date, ageMs?: number): void {
    const dir = safeDir(root);
    if (dir === null) return;
    const file = eventsFile(root);
    if (fs.existsSync(file) && !isRegularFile(file)) return;
    const row: Record<string, unknown> = { at: now.toISOString(), event };
    if (ageMs !== undefined) row['age_ms'] = ageMs;
    const line = `${JSON.stringify(row)}\n`;
    let size = 0;
    try {
        size = fs.lstatSync(file).size;
    } catch {
        size = 0;
    }
    if (size > EVENT_LOG_MAX_BYTES / 4) {
        const text = readRegular(file, EVENT_LOG_MAX_BYTES * 4);
        const lines = text === null ? [] : text.split('\n').filter((l) => l.startsWith('{') && l.length < 512);
        if (text === null || size > EVENT_LOG_MAX_BYTES || lines.length >= EVENT_LOG_MAX_LINES) {
            const kept = lines.slice(-(EVENT_LOG_MAX_LINES - 1));
            writeAtomic(dir, file, `${kept.join('\n')}${kept.length > 0 ? '\n' : ''}${line}`);
            return;
        }
    }
    const { O_WRONLY, O_APPEND, O_CREAT, O_NOFOLLOW } = fs.constants;
    const fd = fs.openSync(file, O_WRONLY | O_APPEND | O_CREAT | (O_NOFOLLOW ?? 0), 0o644);
    try {
        fs.writeSync(fd, line);
    } finally {
        fs.closeSync(fd);
    }
}

function readCounters(root: string, sessionKey: string): StoredEolCounters | null {
    try {
        const state = JSON.parse(fs.readFileSync(eolStateFile(root, sessionKey), 'utf8')) as { counters?: StoredEolCounters };
        return state.counters ?? null;
    } catch {
        return null;
    }
}

/** `pre_compact`: invalidate an unclassified predecessor, then write this attempt's checkpoint. */
export function recordPreCompact(input: CheckpointInput): PreCompactOutcome {
    const now = input.now ?? new Date();
    const dir = safeDir(input.root);
    if (dir === null) return 'skipped';
    const key = eolSessionKey(input.sessionId);
    const file = checkpointFile(input.root, key);
    if (isRegularFile(file) || isSymlink(file)) {
        // Removed before anything else, and counted only once the removal held,
        // so a skipped write below can never leave the predecessor eligible.
        fs.rmSync(file, { force: true });
        logEvent(input.root, 'orphaned', now);
    }

    const decision = buildContinuityRecord({
        root: input.root,
        sessionId: input.sessionId,
        slug: input.slug,
        counters: readCounters(input.root, key),
        now,
    });
    if (decision.record === null) {
        logEvent(input.root, 'skipped', now);
        return 'skipped';
    }
    const cp: Checkpoint = {
        schema_version: 1,
        session_key: key,
        transcript_hash: transcriptHash(input.transcriptPath),
        package_version: input.version,
        written_at: now.toISOString(),
        continuity: decision.record,
    };
    writeAtomic(dir, file, `${JSON.stringify(cp, null, 2)}\n`);
    logEvent(input.root, 'written', now);
    return 'written';
}

/**
 * `session_start(compact)`: classify what an injection would have met, log it,
 * then consume the checkpoint. Returns only the class, never the checkpoint.
 */
export function observePostCompact(input: CheckpointInput): PostCompactOutcome {
    const now = input.now ?? new Date();
    if (!inBoundary(input.root)) return 'none';
    const key = eolSessionKey(input.sessionId);
    const file = checkpointFile(input.root, key);
    const cp = readCheckpoint(file);
    let outcome: PostCompactOutcome;
    let ageMs: number | undefined;
    if (cp === null) {
        outcome = 'none';
    } else {
        ageMs = Math.max(0, now.getTime() - Date.parse(cp.written_at));
        if (cp.session_key !== key || cp.transcript_hash !== transcriptHash(input.transcriptPath)) outcome = 'key-mismatch';
        else if (cp.package_version !== input.version) outcome = 'version-mismatch';
        else if (ageMs > STALE_AFTER_MS) outcome = 'stale';
        else outcome = 'match';
    }
    // Logged before the checkpoint is consumed: if the log write fails, the
    // checkpoint stays and the next observation classifies it again.
    logEvent(input.root, outcome, now, ageMs);
    if (cp !== null && isRegularFile(file)) fs.rmSync(file, { force: true });
    return outcome;
}

/** Event counts from the log, for the evidence file and the step's verify. */
export function readEventTally(root: string): Record<EventName, number> {
    const tally: Record<EventName, number> = {
        written: 0,
        skipped: 0,
        orphaned: 0,
        match: 0,
        'key-mismatch': 0,
        'version-mismatch': 0,
        stale: 0,
        none: 0,
    };
    if (!inBoundary(root)) return tally;
    const text = readRegular(eventsFile(root), EVENT_LOG_MAX_BYTES * 4);
    if (text === null) return tally;
    for (const line of text.split('\n')) {
        if (!line) continue;
        try {
            const ev = (JSON.parse(line) as { event?: EventName }).event;
            if (ev !== undefined && ev in tally) tally[ev]++;
        } catch {
            continue;
        }
    }
    return tally;
}
~~~

## The boundary helper it uses (unchanged, already in the tree)

~~~ts
import * as fs from 'node:fs';
import * as path from 'node:path';

/** True for a directory that is not a symlink. */
export function isRealDir(p: string): boolean {
    try {
        const st = fs.lstatSync(p);
        return st.isDirectory() && !st.isSymbolicLink();
    } catch {
        return false;
    }
}

/**
 * Whether every component from `root` down to `dir` that exists is a real
 * directory. Components that do not exist yet pass: the caller creates them.
 */
export function containedPath(root: string, dir: string): boolean {
    const rel = path.relative(root, dir);
    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return false;
    let at = root;
    for (const part of rel.split(path.sep)) {
        at = path.join(at, part);
        try {
            fs.lstatSync(at);
        } catch {
            return true;
        }
        if (!isRealDir(at)) return false;
    }
    return true;
}

/**
 * Writes `content` to `file` inside `root`, creating its folder; false when any
 * component is not a real directory, the target is a symlink, or the write fails.
 */
export function writeContained(root: string, file: string, content: string): boolean {
    const dir = path.dirname(file);
    if (!containedPath(root, dir)) return false;
    try {
        fs.mkdirSync(dir, { recursive: true });
        if (!containedPath(root, dir)) return false;
        const { O_WRONLY, O_CREAT, O_TRUNC, O_NOFOLLOW } = fs.constants;
        const fd = fs.openSync(file, O_WRONLY | O_CREAT | O_TRUNC | (O_NOFOLLOW ?? 0), 0o644);
        try {
            fs.writeFileSync(fd, content);
        } finally {
            fs.closeSync(fd);
        }
        return true;
    } catch {
        return false;
    }
}
~~~
