<!-- evidence-type: analysis -->

<!-- Round-4 prompt given to the council on 2026-11-08 for branch
     feat/compact-checkpoint-phase-1, committed verbatim beside the record. -->

# Ratification review, round 4 — a new hook concern and its budget row

Same question as rounds 1–3, on the code as it now stands. Judge whether the
change expands any authority — can it block, deny, rewrite or inject anything,
lower a ceiling, weaken a gate, or reach the model's context? Answer with
exactly one verdict and the reasons:

- `ratified` — it expands authority, and the expansion is acceptable.
- `confirmed-non-expanding` — it expands no authority.
- `refused` — it expands authority in a way that should not merge, or the
  material does not let you tell.

Also name any defect that should block the merge regardless of the verdict.

This round differs from the earlier ones: below is the complete inventory of
filesystem operations reachable from the hook, with the source of every reader
it calls. Check the inventory itself — name any reachable operation it omits.

## Round-3 findings and what changed

1. `readCounters()` bypassed the guards. Now it runs the containment check and
   the bounded, non-following, non-blocking reader.
2. The reader could read past its cap if the file grew after `fstat`. Now it
   reads at most `max + 1` bytes and refuses overflow.
3. The continuity writer and claim reader (shared with the Stop hook, not
   changed here) read unguarded. Now, before calling them, the checkpoint
   requires every file they will open to be absent or a plain file ≤ 1 MB, and
   skips otherwise. Tests: a FIFO at the counters, roadmap and claim paths and a
   symlinked counters file each skip without blocking; disabling the preflight
   makes the FIFO tests hang.

## Inventory of reachable filesystem operations

| # | Operation | Path | Guard |
|---|---|---|---|
| 1 | lstat/mkdir | `agents/runtime/state/compact-checkpoint/` | `containedPath` before and after mkdir |
| 2 | read | session counters `agents/runtime/state/session-eol/<key>.json` | containment + bounded regular read |
| 3 | lstat | predecessor record `recycle_consumed_rel(session)` under root | preflight: absent or regular ≤ 1 MB |
| 4 | lstat | claim files from `claim_read_paths` (git common dir and root) | preflight before `read_claimed_slug` |
| 5 | read | the same claim files | `read_claimed_slug` after 4 passed |
| 6 | lstat | `agents/roadmaps/<slug>.md` | preflight after the slug is known |
| 7 | read | the roadmap, the predecessor record, `.git`, `HEAD` | `buildContinuityRecord` after 3, 6 and the `.git`/`HEAD` check passed |
| 8 | lstat/read | `.git` (file in a worktree) and `<gitdir>/HEAD` | preflight; `git_dir` reads `.git` only after its lstat passed |
| 9 | read, not preflighted | `<common dir>/commondir`, `refs/*`, `packed-refs` inside `readHead` | stated residual: a repository whose refs block also blocks git |
| 10 | read | checkpoint file | containment + bounded regular read |
| 11 | append/rename | event log | containment; `O_APPEND|O_NOFOLLOW`; bounded trim |
| 12 | write/rename | checkpoint file | containment; random temp name, `wx`; rename |
| 13 | rm | checkpoint file | containment; only a regular file |

Time-of-check to time-of-use: a concurrent process can swap a checked path
between the lstat and the open. Node offers no openat-style descriptor walk;
the windows are narrowed, not closed. Stated, not fixed.

## The diff of the gated files

~~~diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 72ebb16456..0d8f025d90 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -275,6 +275,12 @@
             "registered_at": "2026-10-28",
             "derivation": "Measured 9,807 bytes on 2026-10-28 (the intake-pass concern, its task-prompt and question predicates after council round 1, and the shared `isSyntheticPrompt` reader), no `yaml`. The ceiling is that reading plus about 10 %, rounded, with no growth queued. Bound on `user_prompt_submit` on every host that binds the slot; the dispatch bundle carries only its LAZY_CONCERNS row. A missing chunk falls back to the spawn path and costs latency, never the line."
         },
+        {
+            "entry": "src/scripts/hooks/compact_checkpoint_hook.ts",
+            "max_bytes": 44000,
+            "registered_at": "2026-11-08",
+            "derivation": "Measured 39,993 bytes on 2026-11-08 (the compact-checkpoint concern with its filesystem boundary and read preflight, the continuity-record writer it reuses and the roadmap-claim reader), `yaml` external. The ceiling is that reading plus about 10 %, rounded, with no growth queued. Bound on `pre_compact` and `session_start` on claude only; the dispatch bundle carries only its LAZY_CONCERNS row."
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

## src/scripts/hooks/compact_checkpoint_hook.ts

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
            recordPreCompact(input);
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

## src/scripts/_lib/compact_checkpoint.ts

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
import { git_dir } from './git_common_dir.js';
import { recycle_consumed_rel } from './recycle_envelope_paths.js';
import { claim_read_paths, read_claimed_slug } from './roadmap_claim.js';
import { roadmapPath } from './run_checkpoint.js';
import { eolSessionKey, eolStateFile, type StoredEolCounters } from './session_eol.js';

/** A classification older than this reads as `stale`. A stated default, set to be revised from `age_ms` readings. */
export const STALE_AFTER_MS = 10 * 60 * 1000;

/** The event log keeps at most this many lines; older ones are dropped when it is trimmed. */
export const EVENT_LOG_MAX_LINES = 2000;

/** A log larger than this is trimmed; one that cannot be read within it is replaced. */
export const EVENT_LOG_MAX_BYTES = 256 * 1024;

const CHECKPOINT_MAX_BYTES = 256 * 1024;

/** Largest file the continuity writer and its readers may be handed. */
const READ_MAX_BYTES = 1024 * 1024;

export type PreCompactOutcome = 'written' | 'skipped';
export type PostCompactOutcome = 'match' | 'key-mismatch' | 'version-mismatch' | 'stale' | 'none';
type EventName = PreCompactOutcome | 'orphaned' | PostCompactOutcome;

export interface CheckpointInput {
    root: string;
    sessionId: string;
    transcriptPath: string;
    /** The claimed roadmap; `undefined` resolves it here, after the claim files pass the preflight. */
    slug?: string | null | undefined;
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
        if (!fs.fstatSync(fd).isFile()) return null;
        // Read at most max + 1 bytes: a file that grew after fstat is still refused.
        const buf = Buffer.alloc(max + 1);
        let n = 0;
        for (;;) {
            const got = fs.readSync(fd, buf, n, buf.length - n, null);
            if (got === 0) break;
            n += got;
            if (n > max) return null;
        }
        return buf.subarray(0, n).toString('utf8');
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

/** Absent, or a regular non-symlink file no larger than `max`. A FIFO, device or symlink fails. */
function absentOrRegular(p: string, max = READ_MAX_BYTES): boolean {
    let st: fs.Stats;
    try {
        st = fs.lstatSync(p);
    } catch {
        return true;
    }
    return st.isFile() && st.size <= max;
}

/**
 * Every file the continuity writer and the claim reader will open for this
 * session, checked before any of them is opened. Those readers are shared with
 * the Stop path and read without these guards, so the checkpoint refuses to
 * call them unless each path is absent or a plain file. Git's refs and
 * packed-refs are not walked: a repository whose refs block also blocks git.
 */
function readsAreSafe(root: string, sessionId: string, slug: string | null | undefined): boolean {
    const paths = [eolStateFile(root, eolSessionKey(sessionId)), path.join(root, recycle_consumed_rel(sessionId))];
    if (slug === undefined) paths.push(...claim_read_paths(root, sessionId));
    else if (slug !== null) paths.push(roadmapPath(root, slug));
    if (!paths.every((p) => absentOrRegular(p))) return false;
    const dotGit = path.join(root, '.git');
    try {
        const st = fs.lstatSync(dotGit);
        if (!(st.isDirectory() || (st.isFile() && st.size <= READ_MAX_BYTES))) return false;
    } catch {
        return true;
    }
    const gd = git_dir(root);
    return gd === null || absentOrRegular(path.join(gd, 'HEAD'));
}

function readCounters(root: string, sessionKey: string): StoredEolCounters | null {
    const file = eolStateFile(root, sessionKey);
    if (!containedPath(root, path.dirname(file))) return null;
    const text = readRegular(file, READ_MAX_BYTES);
    if (text === null) return null;
    try {
        return (JSON.parse(text) as { counters?: StoredEolCounters }).counters ?? null;
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

    let slug = input.slug;
    if (!readsAreSafe(input.root, input.sessionId, slug)) {
        logEvent(input.root, 'skipped', now);
        return 'skipped';
    }
    if (slug === undefined) {
        slug = read_claimed_slug(input.root, input.sessionId);
        if (!readsAreSafe(input.root, input.sessionId, slug)) {
            logEvent(input.root, 'skipped', now);
            return 'skipped';
        }
    }
    const decision = buildContinuityRecord({
        root: input.root,
        sessionId: input.sessionId,
        slug,
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

## Readers it calls (unchanged by this branch)

~~~ts
export function buildContinuityRecord(input: BuildInput): WriterDecision {
    const { root, sessionId, slug, counters } = input;
    const now = input.now ?? new Date();

    if (!is_substantive(counters)) {
        return {
            record: null,
            reason: 'no record — the session is not substantive by the committed floor',
        };
    }
    if (slug === null || slug.trim() === '') {
        return {
            record: null,
            reason: 'no record — no claimed roadmap, so no deterministic acceptance criterion exists',
        };
    }

    let text: string;
    try {
        text = fs.readFileSync(roadmapPath(root, slug), 'utf-8');
    } catch {
        return { record: null, reason: `no record — the claimed roadmap ${slug} is not readable` };
    }

    const shape = roadmapShape(text);
    if (shape.total === 0) {
        return { record: null, reason: `no record — ${slug} carries no phase checkboxes to count` };
    }

    const declared = acceptanceCriteria(text);
    const criteria =
        declared.length > 0
            ? declared
            : // A roadmap with no declared criteria still has one definitional
              // completion condition, and it is derived from the artefact class
              // rather than judged: every step closed. Anything richer would be
              // a definition of done nobody wrote.
              [`every phase step in agents/roadmaps/${slug}.md is closed`];

    const record: Record<string, unknown> = {
        capsule_version: CAPSULE_SCHEMA_VERSION,
        variant: 'continuity_record',
        summary: _clip(`${slug}: ${shape.done} of ${shape.total} steps closed`),
        task: _clip(slug),
        workspace: root,
        written_at: now.toISOString(),
        acceptance_criteria: criteria.slice(0, MAX_ENTRIES),
        remaining: shape.open.slice(0, MAX_ENTRIES),
        predecessor: resolvePredecessor(root, sessionId),
        artifact_paths: [`agents/roadmaps/${slug}.md`],
    };
    if (sessionId.trim() !== '') {
        record['session_id'] = sessionId.trim();
    }
    const head = readHead(root);
    if (head !== null) {
        record['head'] = head;
    }
    return { record, reason: `record built for ${slug} (${shape.done}/${shape.total} closed)` };
}
export function resolvePredecessor(projectRoot: string, sessionId: string | null): string {
    try {
        const consumed = path.join(projectRoot, recycle_consumed_rel(sessionId));
        const raw = JSON.parse(fs.readFileSync(consumed, 'utf-8')) as { session_id?: unknown };
        const prior = String(raw.session_id ?? '').trim();
        return prior === '' ? 'none' : prior;
    } catch {
        return 'none';
    }
}
export function readHead(repoRoot: string): string | null {
    try {
        let gitDir = path.join(repoRoot, '.git');
        if (fs.statSync(gitDir).isFile()) {
            const m = /^gitdir:\s*(.+)$/m.exec(fs.readFileSync(gitDir, 'utf-8').trim());
            if (m === null) return null;
            gitDir = path.resolve(repoRoot, m[1] as string);
        }
        // HEAD is per-worktree; REFS are not. A linked worktree's gitdir holds
        // its own HEAD and a `commondir` pointer, and `refs/` + `packed-refs`
        // live at that commondir — never beside HEAD.
        //
        // R2 round 3, finding 1, and the round-2 version of this function got
        // it exactly half right: it handled `.git`-as-a-file and then resolved
        // refs against the worktree gitdir, so `head` was null in every linked
        // worktree — including the one this package is developed in. Its test
        // passed because the fixture wrote refs beside HEAD, a layout git never
        // produces. A fixture that agrees with the code instead of with reality
        // reads as coverage and is worse than no test at all.
        let refRoot = gitDir;
        try {
            const common = fs.readFileSync(path.join(gitDir, 'commondir'), 'utf-8').trim();
            if (common !== '') refRoot = path.resolve(gitDir, common);
        } catch {
            // No commondir — a plain repository, where gitDir already is it.
        }
        const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf-8').trim();
        // A detached HEAD is the sha itself.
        if (/^[0-9a-f]{40}$/.test(head)) return head;
        const ref = /^ref:\s*(.+)$/.exec(head);
        if (ref === null) return null;
        const refName = ref[1] as string;
        try {
            return fs.readFileSync(path.join(refRoot, refName), 'utf-8').trim() || null;
        } catch {
            // Packed refs: a loose file does not exist for every branch.
            const packed = fs.readFileSync(path.join(refRoot, 'packed-refs'), 'utf-8');
            for (const line of packed.split('\n')) {
                const pm = /^([0-9a-f]{40})\s+(.+)$/.exec(line.trim());
                if (pm !== null && pm[2] === refName) return pm[1] as string;
            }
            return null;
        }
    } catch {
        return null;
    }
}
export function git_dir(project_root: string): string | null {
    const dot_git = path.join(project_root, '.git');
    try {
        const st = fs.statSync(dot_git);
        if (st.isDirectory()) {
            return realpath_or_self(dot_git);
        }
        const m = fs.readFileSync(dot_git, 'utf-8').match(/^gitdir:\s*(.+)\s*$/m);
        if (m === null) {
            return null;
        }
        return realpath_or_self(path.resolve(project_root, m[1]!.trim()));
    } catch {
        return null;
    }
}
function _read_claim_file(file: string): RoadmapClaim | null {
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf-8'));
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return null;
        }
        const rec = parsed as Record<string, unknown>;
        const slug = rec['slug'];
        if (typeof slug !== 'string' || slug.trim().length === 0) {
            return null;
        }
        const sid = rec['session_id'];
        const raw_paths = rec['paths'];
        const paths = Array.isArray(raw_paths)
            ? raw_paths.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
            : [];
        return {
            slug: slug.trim(),
            ...(typeof sid === 'string' && sid.trim() !== '' ? { session_id: sid.trim() } : {}),
            ...(paths.length > 0 ? { paths } : {}),
        };
    } catch {
        return null;
    }
}
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

~~~
