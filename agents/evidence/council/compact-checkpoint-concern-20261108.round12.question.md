<!-- evidence-type: analysis -->

<!-- Round-12 prompt given to the council on 2026-11-08 for branch
     feat/compact-checkpoint-phase-1, committed verbatim beside the record. -->

# Ratification review, round 12 — a new hook concern and its budget row

Same question as rounds 1–11, on the code as it now stands. Judge whether the
change expands any authority — can it block, deny, rewrite or inject anything,
lower a ceiling, weaken a gate, or reach the model's context? Answer with
exactly one verdict and the reasons:

- `ratified` — it expands authority, and the expansion is acceptable.
- `confirmed-non-expanding` — it expands no authority.
- `refused` — it expands authority in a way that should not merge, or the
  material does not let you tell.

Then list defects in two groups: those that block the merge, and those that
can follow in a later change. Put each defect in exactly one group.

## What changed since round 11

1. Round 11's blocker was an exact directory ceiling that the event log and
   racing writers could exceed. The code no longer claims one: markers are
   written only below 480 entries, a sweep reads 512, and the gap absorbs the
   log and concurrent writers so every sweep still sees the whole directory.
   The comment says the count is not exact under concurrency. Tests: a write
   at 480 is refused and the directory stays under 512; 490 entries still give
   a complete sweep; raising the write limit to 512 reds both.
2. Appends write the whole encoded line (loop over `writeSync`).
3. The hook checks event and source before reading the package version.
4. Hook-entry tests (included below): kill switch, unusable envelope, replay
   mode, a non-compact `session_start` — each exits 0, prints nothing, writes
   nothing.

Stated, not fixed: the observe/record interleaving within one session (the
host fires a session's hook events in sequence) and the lstat-then-open race
(narrowed by the descriptor checks).

## The diff of the gated files

~~~diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 72ebb16456..894aaf15ec 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -275,6 +275,12 @@
             "registered_at": "2026-10-28",
             "derivation": "Measured 9,807 bytes on 2026-10-28 (the intake-pass concern, its task-prompt and question predicates after council round 1, and the shared `isSyntheticPrompt` reader), no `yaml`. The ceiling is that reading plus about 10 %, rounded, with no growth queued. Bound on `user_prompt_submit` on every host that binds the slot; the dispatch bundle carries only its LAZY_CONCERNS row. A missing chunk falls back to the spawn path and costs latency, never the line."
         },
+        {
+            "entry": "src/scripts/hooks/compact_checkpoint_hook.ts",
+            "max_bytes": 19600,
+            "registered_at": "2026-11-08",
+            "derivation": "Measured 17,733 bytes on 2026-11-08 (the compact-checkpoint concern: a keys-only marker in the user-global runtime directory with an inspection-bounded, complete sweep of abandoned markers, its bounded non-following reader, and the containment check and runtime-path helpers it reuses), `yaml` external. The ceiling is that reading plus about 10 %, rounded, with no growth queued. Bound on `pre_compact` and `session_start` on claude only; the dispatch bundle carries only its LAZY_CONCERNS row."
+        },
         {
             "entry": "src/scripts/hooks/web_launch_rows.ts",
             "max_bytes": 14000,
diff --git a/src/scripts/hook_manifest.yaml b/src/scripts/hook_manifest.yaml
index 6631126372..0139517c76 100644
--- a/src/scripts/hook_manifest.yaml
+++ b/src/scripts/hook_manifest.yaml
@@ -1662,6 +1662,17 @@ concerns:
   # has happened. The journal's own RECORDED_EVENTS / NOT_RECORDED partition is
   # unchanged — it governs the vocabulary, not the bindings — so the capture
   # evidence states the unbound slot instead of the partition implying coverage.
+  # road-to-state-and-pins-across-compaction 1.2: writes a keys-only marker
+  # at `pre_compact` under the user-global runtime directory and classifies it
+  # at `session_start(compact)`. Injects nothing (council 2026-11-08: the keys
+  # name the session, not the compaction attempt). Claude only — the one host whose compaction records
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
 * compact-checkpoint — writes a marker at `pre_compact` and, at
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

import { observePostCompact, packageVersionFrom, recordPreCompact } from '../_lib/compact_checkpoint.js';
import { readHookStdin } from './hook_stdin.js';
import { unwrap } from './envelope.js';
import { is_replay_mode } from './state_io.js';

function str(v: unknown): string {
    return typeof v === 'string' ? v.trim() : '';
}

function packageVersion(): string | null {
    return packageVersionFrom(process.env['AGENT_CONFIG_PACKAGE_ROOT'] || path.dirname(fileURLToPath(import.meta.url)));
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
        const isPre = event === 'pre_compact';
        const isPost = event === 'session_start' && str(payload['source'] ?? envelope['source']) === 'compact';
        if (!isPre && !isPost) return 0;
        const input = { sessionId, transcriptPath, version: packageVersion() };
        if (isPre) recordPreCompact(input);
        else observePostCompact(input);
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
 * Compaction checkpoint — a marker written at `pre_compact`, classified after,
 * never injected.
 *
 * Injection is deliberately absent: (session key, transcript hash) names the
 * session, not the compaction attempt, so a marker left behind by an aborted
 * compaction would match the next one. The marker carries no task state either:
 * which fields may ever be restored is still undecided, and reading task state
 * would mean calling readers (roadmap, claims, git) this hook cannot bound.
 *
 * What it records:
 *
 *   - `orphaned` — a marker still unclassified when the next `pre_compact` runs.
 *     An aborted compaction produces this, and so does a compaction whose
 *     `session_start` never reached the concern; the count cannot tell them apart.
 *   - the post-compaction class — `match`, `key-mismatch`, `version-mismatch`,
 *     `stale` or `none` — of what an injection WOULD have met.
 *   - `age_ms` between write and classification, so a staleness bound can be
 *     set from readings rather than guessed.
 *
 * Every file this module opens sits under the user's own runtime directory
 * (`~/.event4u/agent-config/state/compact-checkpoint/`, never inside a
 * repository), plus the package's own `package.json`. Storage outside the
 * repository is what keeps repository contents from substituting a directory
 * or a file under it. Below the runtime root each component must still be a
 * real directory; every read opens a
 * regular file only, without following a symlink or blocking, and reads at most
 * a fixed number of bytes — hooks run inside repositories whose contents others
 * can supply. A concurrent swap between check and open is narrowed, not closed.
 * Two sessions appending at once can interleave, and a trim racing an append can
 * drop that append; accepted for a counts-only log.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { containedPath } from './contained_write.js';
import { eolSessionKey } from './session_eol.js';
import { event4u_root, write_target, type EnvMap } from './user_global_paths.js';

/** A classification older than this reads as `stale`. A stated default, set to be revised from `age_ms` readings. */
export const STALE_AFTER_MS = 10 * 60 * 1000;

/**
 * The event log's bound. An append that would cross it first trims the log to
 * half, newest lines kept. Concurrent appenders can each pass the size check,
 * so the bound is approximate by a few lines under concurrency, not exact. A
 * tally therefore counts the retained window, not every event ever logged.
 */
export const EVENT_LOG_MAX_BYTES = 256 * 1024;

/** A marker of any session untouched this long is abandoned and removed by the next write. */
export const MARKER_RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * Most directory entries one sweep looks at, kept or removed, plus one read to
 * learn whether the end was reached. Markers are written only below
 * `WRITE_LIMIT`, well under this; the gap absorbs the event log and writers
 * racing past the check, so a sweep still sees the whole directory and an
 * expired marker is removed by the next write however the directory is ordered.
 * The count is not an exact ceiling under concurrency — more than the gap of
 * simultaneous writers could exceed it.
 */
export const SWEEP_MAX = 512;

/** A marker is written only while the directory holds fewer entries than this. */
export const WRITE_LIMIT = 480;

const MARKER_NAME = /^[0-9a-f]{64}\.json$/;
const TEMP_NAME = /^\..+\.[0-9a-f]{12}\.tmp$/;

const PACKAGE_NAME = '@event4u/agent-config';

const MARKER_MAX_BYTES = 4 * 1024;
const PACKAGE_JSON_MAX_BYTES = 64 * 1024;

export type PreCompactOutcome = 'written' | 'skipped';
export type PostCompactOutcome = 'match' | 'key-mismatch' | 'version-mismatch' | 'stale' | 'none';
type EventName = PreCompactOutcome | 'orphaned' | PostCompactOutcome;

export interface CheckpointInput {
    /** Environment the runtime root resolves from; `process.env` when absent. */
    env?: EnvMap;
    sessionId: string;
    transcriptPath: string;
    version: string | null;
    now?: Date;
}

interface Marker {
    schema_version: 2;
    session_key: string;
    transcript_hash: string;
    package_version: string | null;
    written_at: string;
}

export function checkpointDir(env?: EnvMap): string {
    return write_target(path.join('state', 'compact-checkpoint'), { env: env ?? null });
}

export function checkpointFile(sessionKey: string, env?: EnvMap): string {
    return path.join(checkpointDir(env), `${sessionKey}.json`);
}

export function eventsFile(env?: EnvMap): string {
    return path.join(checkpointDir(env), 'events.jsonl');
}

export function transcriptHash(transcriptPath: string): string {
    return crypto.createHash('sha256').update(transcriptPath).digest('hex').slice(0, 16);
}

function lstatOrNull(p: string): fs.Stats | null {
    try {
        return fs.lstatSync(p);
    } catch {
        return null;
    }
}

function inBoundary(env?: EnvMap): boolean {
    return containedPath(event4u_root(env ?? null), checkpointDir(env));
}

/** The directory, created under the runtime root, or `null` when a component below it is not a real directory. */
function safeDir(env?: EnvMap): string | null {
    if (!inBoundary(env)) return null;
    fs.mkdirSync(checkpointDir(env), { recursive: true });
    return inBoundary(env) ? checkpointDir(env) : null;
}

/**
 * A regular file's text, opened without following a symlink or blocking, and at
 * most `max` bytes even if the file grows after it was opened; `null` otherwise.
 */
export function readRegular(file: string, max: number): string | null {
    const { O_RDONLY, O_NOFOLLOW, O_NONBLOCK } = fs.constants;
    let fd: number;
    try {
        fd = fs.openSync(file, O_RDONLY | (O_NOFOLLOW ?? 0) | (O_NONBLOCK ?? 0));
    } catch {
        return null;
    }
    try {
        if (!fs.fstatSync(fd).isFile()) return null;
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

/** The `version` of this package's own `package.json` at or above `startDir` (five levels at most), read through `readRegular`. */
export function packageVersionFrom(startDir: string): string | null {
    let dir = startDir;
    for (let i = 0; i < 5; i++) {
        const text = readRegular(path.join(dir, 'package.json'), PACKAGE_JSON_MAX_BYTES);
        if (text !== null) {
            try {
                const pkg = JSON.parse(text) as { name?: unknown; version?: unknown };
                if (pkg.name === PACKAGE_NAME && typeof pkg.version === 'string') return pkg.version;
            } catch {
                // not a package manifest; keep walking
            }
        }
        const up = path.dirname(dir);
        if (up === dir) break;
        dir = up;
    }
    return null;
}

function readMarker(file: string): Marker | null {
    const text = readRegular(file, MARKER_MAX_BYTES);
    if (text === null) return null;
    try {
        const m = JSON.parse(text) as Partial<Marker>;
        if (
            m?.schema_version !== 2 ||
            typeof m.session_key !== 'string' ||
            typeof m.transcript_hash !== 'string' ||
            typeof m.written_at !== 'string' ||
            !Number.isFinite(Date.parse(m.written_at)) ||
            (m.package_version !== null && typeof m.package_version !== 'string')
        ) {
            return null;
        }
        return m as Marker;
    } catch {
        return null;
    }
}

function writeAtomic(dir: string, file: string, body: string): void {
    if (lstatOrNull(file)?.isSymbolicLink()) throw new Error('refusing to write through a symlink');
    const tmp = path.join(dir, `.${path.basename(file)}.${crypto.randomBytes(6).toString('hex')}.tmp`);
    try {
        fs.writeFileSync(tmp, body, { flag: 'wx' });
        fs.renameSync(tmp, file);
    } catch (err) {
        fs.rmSync(tmp, { force: true });
        throw err;
    }
}

/** Whether the event reached the log. */
function logEvent(env: EnvMap | undefined, event: EventName, now: Date, ageMs?: number): boolean {
    const dir = safeDir(env);
    if (dir === null) return false;
    const file = eventsFile(env);
    const st = lstatOrNull(file);
    if (st !== null && !st.isFile()) return false;
    const row: Record<string, unknown> = { at: now.toISOString(), event };
    if (ageMs !== undefined) row['age_ms'] = ageMs;
    const line = `${JSON.stringify(row)}\n`;
    const lineBytes = Buffer.byteLength(line, 'utf8');
    if ((st?.size ?? 0) + lineBytes > EVENT_LOG_MAX_BYTES) {
        const text = readRegular(file, EVENT_LOG_MAX_BYTES * 4);
        const kept: string[] = [];
        let bytes = lineBytes;
        const lines = text === null ? [] : text.split('\n').filter((l) => l.startsWith('{'));
        for (let i = lines.length - 1; i >= 0; i--) {
            const len = Buffer.byteLength(lines[i]!, 'utf8') + 1;
            if (bytes + len > EVENT_LOG_MAX_BYTES / 2) break;
            kept.unshift(lines[i]!);
            bytes += len;
        }
        writeAtomic(dir, file, `${kept.join('\n')}${kept.length > 0 ? '\n' : ''}${line}`);
        return true;
    }
    const { O_WRONLY, O_APPEND, O_CREAT, O_NOFOLLOW, O_NONBLOCK } = fs.constants;
    const fd = fs.openSync(file, O_WRONLY | O_APPEND | O_CREAT | (O_NOFOLLOW ?? 0) | (O_NONBLOCK ?? 0), 0o644);
    try {
        // Re-checked on the descriptor: a FIFO or a hard-linked file swapped in after the lstat is refused.
        const fst = fs.fstatSync(fd);
        if (!(fst.isFile() && fst.nlink === 1)) return false;
        const buf = Buffer.from(line, 'utf8');
        for (let off = 0; off < buf.length; ) off += fs.writeSync(fd, buf, off, buf.length - off);
        return true;
    } finally {
        fs.closeSync(fd);
    }
}

/**
 * Remove markers of any session, and temporary files, not touched within
 * `MARKER_RETENTION_MS`; regular files with those names only. Reads the
 * directory incrementally, looks at no more than `SWEEP_MAX` entries and reads
 * one more to learn whether it reached the end; `complete` says whether it did.
 */
export function sweepAbandoned(dir: string, now: Date): { inspected: number; complete: boolean } {
    let d: fs.Dir;
    try {
        d = fs.opendirSync(dir);
    } catch {
        return { inspected: 0, complete: false };
    }
    let inspected = 0;
    let complete = false;
    try {
        for (;;) {
            if (inspected >= SWEEP_MAX) {
                complete = d.readSync() === null;
                break;
            }
            const entry = d.readSync();
            if (entry === null) {
                complete = true;
                break;
            }
            inspected++;
            if (!MARKER_NAME.test(entry.name) && !TEMP_NAME.test(entry.name)) continue;
            const p = path.join(dir, entry.name);
            const st = lstatOrNull(p);
            if (st !== null && st.isFile() && now.getTime() - st.mtimeMs > MARKER_RETENTION_MS) fs.rmSync(p, { force: true });
        }
    } catch {
        complete = false;
    } finally {
        d.closeSync();
    }
    return { inspected, complete };
}

/** `pre_compact`: invalidate an unclassified predecessor, then write this attempt's marker if there is room. */
export function recordPreCompact(input: CheckpointInput): PreCompactOutcome {
    const now = input.now ?? new Date();
    const dir = safeDir(input.env);
    if (dir === null) return 'skipped';
    const key = eolSessionKey(input.sessionId);
    const file = checkpointFile(key, input.env);
    if (lstatOrNull(file) !== null) {
        // Removed first, before any refusal below, so neither a refused nor a
        // failed write can leave the predecessor eligible.
        fs.rmSync(file, { force: true });
        logEvent(input.env, 'orphaned', now);
    }
    const sweep = sweepAbandoned(dir, now);
    if (!sweep.complete || sweep.inspected >= WRITE_LIMIT) {
        logEvent(input.env, 'skipped', now);
        return 'skipped';
    }
    const marker: Marker = {
        schema_version: 2,
        session_key: key,
        transcript_hash: transcriptHash(input.transcriptPath),
        package_version: input.version,
        written_at: now.toISOString(),
    };
    writeAtomic(dir, file, `${JSON.stringify(marker)}\n`);
    logEvent(input.env, 'written', now);
    return 'written';
}

/**
 * `session_start(compact)`: classify what an injection would have met, log it,
 * then consume the marker. Returns only the class.
 */
export function observePostCompact(input: CheckpointInput): PostCompactOutcome {
    const now = input.now ?? new Date();
    if (!inBoundary(input.env)) return 'none';
    const key = eolSessionKey(input.sessionId);
    const file = checkpointFile(key, input.env);
    const m = readMarker(file);
    let outcome: PostCompactOutcome;
    let ageMs: number | undefined;
    if (m === null) {
        outcome = 'none';
    } else {
        ageMs = Math.max(0, now.getTime() - Date.parse(m.written_at));
        if (m.session_key !== key || m.transcript_hash !== transcriptHash(input.transcriptPath)) outcome = 'key-mismatch';
        else if (m.package_version !== input.version) outcome = 'version-mismatch';
        else if (ageMs > STALE_AFTER_MS) outcome = 'stale';
        else outcome = 'match';
    }
    // Consumed only once the class is logged: if logging fails, the marker stays
    // and the next observation classifies it again. A malformed marker is
    // removed the same way; anything that is not a regular file stays.
    if (logEvent(input.env, outcome, now, ageMs) && lstatOrNull(file)?.isFile()) fs.rmSync(file, { force: true });
    return outcome;
}

/** Event counts from the log, for the evidence file and the step's verify. */
export function readEventTally(env?: EnvMap): Record<EventName, number> {
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
    if (!inBoundary(env)) return tally;
    const text = readRegular(eventsFile(env), EVENT_LOG_MAX_BYTES * 4);
    if (text === null) return tally;
    for (const line of text.split('\n')) {
        if (!line) continue;
        try {
            const ev = (JSON.parse(line) as { event?: unknown }).event;
            if (typeof ev === 'string' && Object.hasOwn(tally, ev)) tally[ev as EventName]++;
        } catch {
            continue;
        }
    }
    return tally;
}
~~~

## tests/hooks/compact_checkpoint_hook.test.ts

~~~ts
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readEventTally } from '../../src/scripts/_lib/compact_checkpoint.js';
import { main } from '../../src/scripts/hooks/compact_checkpoint_hook.js';
import { clearHookStdinOverride, setHookStdinOverride } from '../../src/scripts/hooks/hook_stdin.js';

let root: string;

function run(envelope: object): { rc: number; out: string } {
    let out = '';
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
        out += String(chunk);
        return true;
    });
    setHookStdinOverride(JSON.stringify({ schema_version: 1, platform: 'claude', ...envelope }));
    try {
        return { rc: main(), out };
    } finally {
        spy.mockRestore();
        clearHookStdinOverride();
    }
}

const payload = { session_id: 'sid-1', transcript_path: '/tmp/t/sid-1.jsonl' };

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'compact-cp-hook-'));
    process.env['EVENT4U_CONFIG_HOME'] = root;
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    delete process.env['AGENT_CONFIG_NO_COMPACT_CHECKPOINT'];
    delete process.env['EVENT4U_CONFIG_HOME'];
});

describe('compact-checkpoint hook', () => {
    it('logs a pre_compact and a session_start(compact) and prints nothing', () => {
        const a = run({ event: 'pre_compact', workspace_root: root, payload });
        const b = run({ event: 'session_start', workspace_root: root, payload: { ...payload, source: 'compact' } });
        expect([a.rc, b.rc]).toEqual([0, 0]);
        expect(a.out + b.out).toBe('');
        expect(readEventTally({ EVENT4U_CONFIG_HOME: root })).toMatchObject({ written: 1, match: 1 });
    });

    it('does nothing in replay mode', () => {
        process.env['AGENT_CONFIG_REPLAY'] = '1';
        try {
            expect(run({ event: 'pre_compact', payload }).rc).toBe(0);
        } finally {
            delete process.env['AGENT_CONFIG_REPLAY'];
        }
        expect(fs.existsSync(path.join(root, 'state', 'compact-checkpoint'))).toBe(false);
    });

    it('ignores session_start from any other source', () => {
        run({ event: 'session_start', workspace_root: root, payload: { ...payload, source: 'startup' } });
        expect(fs.existsSync(path.join(root, 'state', 'compact-checkpoint'))).toBe(false);
    });

    it('does nothing when switched off or when the envelope is unusable', () => {
        process.env['AGENT_CONFIG_NO_COMPACT_CHECKPOINT'] = '1';
        expect(run({ event: 'pre_compact', workspace_root: root, payload }).rc).toBe(0);
        delete process.env['AGENT_CONFIG_NO_COMPACT_CHECKPOINT'];
        expect(run({ event: 'pre_compact', workspace_root: root, payload: {} }).rc).toBe(0);
        expect(fs.existsSync(path.join(root, 'state', 'compact-checkpoint'))).toBe(false);
    });
});
~~~

## tests/scripts/compact_checkpoint.test.ts

~~~ts
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    checkpointDir,
    checkpointFile,
    EVENT_LOG_MAX_BYTES,
    MARKER_RETENTION_MS,
    eventsFile,
    observePostCompact,
    packageVersionFrom,
    readEventTally,
    readRegular,
    recordPreCompact,
    STALE_AFTER_MS,
    SWEEP_MAX,
    sweepAbandoned,
    WRITE_LIMIT,
} from '../../src/scripts/_lib/compact_checkpoint.js';
import { eolSessionKey, eolStateFile } from '../../src/scripts/_lib/session_eol.js';

let root: string;
const ENV = () => ({ EVENT4U_CONFIG_HOME: root });
const SID = 'session-aaaa';
const TRANSCRIPT = '/tmp/transcripts/session-aaaa.jsonl';

const base = (over: Partial<Parameters<typeof recordPreCompact>[0]> = {}) => ({
    env: { EVENT4U_CONFIG_HOME: root },
    sessionId: SID,
    transcriptPath: TRANSCRIPT,
    version: '20.1.0',
    now: new Date('2026-11-08T12:00:00Z'),
    ...over,
});

const markerFile = () => checkpointFile(eolSessionKey(SID), ENV());

const fifoAt = (p: string) => {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.rmSync(p, { force: true });
    execFileSync('mkfifo', [p]);
};

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'compact-cp-'));
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('compact checkpoint — a marker at pre_compact, never injected', () => {
    it('writes a marker carrying only keys, version and time', () => {
        expect(recordPreCompact(base())).toBe('written');
        const m = JSON.parse(fs.readFileSync(markerFile(), 'utf8'));
        expect(Object.keys(m).sort()).toEqual(['package_version', 'schema_version', 'session_key', 'transcript_hash', 'written_at']);
        expect(m.session_key).toBe(eolSessionKey(SID));
        expect(m.transcript_hash).toMatch(/^[0-9a-f]{16}$/);
    });

    it('classifies the paired session_start(compact) as a match and consumes the marker', () => {
        recordPreCompact(base());
        expect(observePostCompact(base({ now: new Date('2026-11-08T12:01:00Z') }))).toBe('match');
        expect(fs.existsSync(markerFile())).toBe(false);
        expect(observePostCompact(base())).toBe('none');
    });

    it('names a key mismatch, a version mismatch and a stale marker', () => {
        recordPreCompact(base());
        expect(observePostCompact(base({ transcriptPath: '/tmp/other.jsonl' }))).toBe('key-mismatch');
        recordPreCompact(base());
        expect(observePostCompact(base({ version: '20.2.0' }))).toBe('version-mismatch');
        recordPreCompact(base());
        const late = new Date(Date.parse('2026-11-08T12:00:00Z') + STALE_AFTER_MS + 1);
        expect(observePostCompact(base({ now: late }))).toBe('stale');
    });

    it('counts an unclassified marker as orphaned when the next compaction writes', () => {
        recordPreCompact(base());
        recordPreCompact(base({ now: new Date('2026-11-08T12:30:00Z') }));
        expect(readEventTally(ENV())).toMatchObject({ written: 2, orphaned: 1 });
    });

    it('logs counts only — no session id or path in the event log', () => {
        recordPreCompact(base());
        observePostCompact(base());
        const log = fs.readFileSync(eventsFile(ENV()), 'utf8');
        expect(log).not.toContain(SID);
        expect(log).not.toContain(TRANSCRIPT);
        expect(readEventTally(ENV())).toMatchObject({ written: 1, match: 1 });
    });

    it('a marker with an unparseable timestamp is never a match; another session key is a key mismatch', () => {
        recordPreCompact(base());
        const m = JSON.parse(fs.readFileSync(markerFile(), 'utf8'));
        fs.writeFileSync(markerFile(), JSON.stringify({ ...m, written_at: 'not-a-date' }));
        expect(observePostCompact(base())).toBe('none');
        fs.writeFileSync(markerFile(), JSON.stringify({ ...m, session_key: 'f'.repeat(64) }));
        expect(observePostCompact(base())).toBe('key-mismatch');
    });

    it('opens nothing in the repository: roadmap, claim, counters and .git there may all be FIFOs', () => {
        fifoAt(eolStateFile(root, eolSessionKey(SID)));
        fifoAt(path.join(root, 'agents', 'roadmaps', 'road-to-x.md'));
        fifoAt(path.join(root, 'agents', 'runtime', 'state', 'roadmap-claim.json'));
        fifoAt(path.join(root, '.git'));
        expect(recordPreCompact(base())).toBe('written');
        expect(observePostCompact(base())).toBe('match');
    });
});

describe('compact checkpoint — filesystem boundary', () => {
    it('refuses a symlinked checkpoint directory', () => {
        const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'compact-cp-elsewhere-'));
        fs.mkdirSync(path.dirname(checkpointDir(ENV())), { recursive: true });
        fs.symlinkSync(elsewhere, checkpointDir(ENV()));
        expect(recordPreCompact(base())).toBe('skipped');
        expect(fs.readdirSync(elsewhere)).toEqual([]);
        fs.rmSync(elsewhere, { recursive: true, force: true });
    });

    it('refuses an ancestor symlink on write: nothing lands outside the repository', () => {
        const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'compact-cp-anc-'));
        fs.symlinkSync(elsewhere, path.join(root, 'state'));
        expect(recordPreCompact(base())).toBe('skipped');
        expect(fs.readdirSync(elsewhere)).toEqual([]);
        fs.rmSync(elsewhere, { recursive: true, force: true });
    });

    it('refuses an ancestor symlink on observation: an outside marker is neither read nor deleted', () => {
        recordPreCompact(base());
        const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'compact-cp-obs-'));
        const real = path.join(elsewhere, 'runtime-real');
        fs.renameSync(path.join(root, 'state'), real);
        fs.symlinkSync(real, path.join(root, 'state'));
        expect(observePostCompact(base())).toBe('none');
        expect(fs.existsSync(path.join(real, 'compact-checkpoint', `${eolSessionKey(SID)}.json`))).toBe(true);
        fs.rmSync(elsewhere, { recursive: true, force: true });
    });

    it('does not block on a FIFO at the marker path', () => {
        fifoAt(markerFile());
        expect(observePostCompact(base())).toBe('none');
    });

    it('keeps the event log under its byte bound, however many short lines it holds', () => {
        fs.mkdirSync(checkpointDir(ENV()), { recursive: true });
        const line = `${JSON.stringify({ at: '2026-01-01T00:00:00.000Z', event: 'none' })}\n`;
        fs.writeFileSync(eventsFile(ENV()), line.repeat(Math.ceil(EVENT_LOG_MAX_BYTES / line.length) + 50));
        recordPreCompact(base());
        expect(fs.statSync(eventsFile(ENV())).size).toBeLessThanOrEqual(EVENT_LOG_MAX_BYTES);
        const lines = fs.readFileSync(eventsFile(ENV()), 'utf8').trim().split('\n');
        expect(JSON.parse(lines[lines.length - 1]!).event).toBe('written');
    });

    it('a trim never produces a file over the bound, even from long lines', () => {
        fs.mkdirSync(checkpointDir(ENV()), { recursive: true });
        const long = `${JSON.stringify({ at: '2026-01-01T00:00:00.000Z', event: 'none', pad: 'p'.repeat(450) })}\n`;
        fs.writeFileSync(eventsFile(ENV()), long.repeat(Math.ceil(EVENT_LOG_MAX_BYTES / long.length) + 50));
        recordPreCompact(base());
        expect(fs.statSync(eventsFile(ENV())).size).toBeLessThanOrEqual(EVENT_LOG_MAX_BYTES);
    });

    it('counts UTF-8 bytes, not characters, against the bound', () => {
        fs.mkdirSync(checkpointDir(ENV()), { recursive: true });
        const wide = `${JSON.stringify({ at: '2026-01-01T00:00:00.000Z', event: 'none', pad: '漢'.repeat(150) })}\n`;
        fs.writeFileSync(eventsFile(ENV()), wide.repeat(Math.ceil(EVENT_LOG_MAX_BYTES / Buffer.byteLength(wide)) + 20));
        recordPreCompact(base());
        expect(fs.statSync(eventsFile(ENV())).size).toBeLessThanOrEqual(EVENT_LOG_MAX_BYTES);
    });

    it('stores nothing under the repository it runs in', () => {
        const repo = path.join(root, 'repo');
        fs.mkdirSync(repo, { recursive: true });
        recordPreCompact(base());
        expect(fs.readdirSync(repo)).toEqual([]);
        expect(checkpointDir(ENV()).startsWith(root)).toBe(true);
    });

    it('does not block appending when the event log is a FIFO', () => {
        fifoAt(eventsFile(ENV()));
        expect(recordPreCompact(base())).toBe('written');
    });

    it('removes a malformed marker on observation instead of leaving it behind', () => {
        fs.mkdirSync(checkpointDir(ENV()), { recursive: true });
        fs.writeFileSync(markerFile(), '{not json');
        expect(observePostCompact(base())).toBe('none');
        expect(fs.existsSync(markerFile())).toBe(false);
    });

    it('replaces an oversized event log instead of loading it', () => {
        fs.mkdirSync(checkpointDir(ENV()), { recursive: true });
        fs.writeFileSync(eventsFile(ENV()), 'x'.repeat(EVENT_LOG_MAX_BYTES + 10));
        recordPreCompact(base());
        expect(fs.statSync(eventsFile(ENV())).size).toBeLessThan(EVENT_LOG_MAX_BYTES);
        expect(readEventTally(ENV()).written).toBe(1);
    });

    it('readRegular refuses a FIFO, a symlink and an oversized file', () => {
        const fifo = path.join(root, 'f');
        execFileSync('mkfifo', [fifo]);
        const big = path.join(root, 'big');
        fs.writeFileSync(big, 'x'.repeat(100));
        const link = path.join(root, 'l');
        fs.symlinkSync(big, link);
        expect(readRegular(fifo, 1000)).toBeNull();
        expect(readRegular(link, 1000)).toBeNull();
        expect(readRegular(big, 99)).toBeNull();
        expect(readRegular(big, 100)).toBe('x'.repeat(100));
    });

    it('packageVersionFrom does not block on a FIFO package.json', () => {
        const dir = path.join(root, 'pkg', 'dist', 'hooks');
        fs.mkdirSync(dir, { recursive: true });
        fifoAt(path.join(dir, 'package.json'));
        fs.writeFileSync(path.join(root, 'pkg', 'package.json'), JSON.stringify({ name: '@event4u/agent-config', version: '9.9.9' }));
        expect(packageVersionFrom(dir)).toBe('9.9.9');
    });
});

describe('compact checkpoint — council round 7 findings (retention)', () => {
    it('removes abandoned markers of other sessions once they are older than the retention bound', () => {
        fs.mkdirSync(checkpointDir(ENV()), { recursive: true });
        const old = path.join(checkpointDir(ENV()), `${'a'.repeat(64)}.json`);
        const fresh = path.join(checkpointDir(ENV()), `${'b'.repeat(64)}.json`);
        fs.writeFileSync(old, '{}');
        fs.writeFileSync(fresh, '{}');
        const past = new Date(Date.parse('2026-11-08T12:00:00Z') - MARKER_RETENTION_MS - 1000);
        fs.utimesSync(old, past, past);
        const now = new Date('2026-11-08T12:00:00Z');
        fs.utimesSync(fresh, now, now);
        recordPreCompact(base());
        expect(fs.existsSync(old)).toBe(false);
        expect(fs.existsSync(fresh)).toBe(true);
    });

    it('leaves files that are not markers alone', () => {
        fs.mkdirSync(checkpointDir(ENV()), { recursive: true });
        const other = path.join(checkpointDir(ENV()), 'notes.txt');
        fs.writeFileSync(other, 'x');
        const past = new Date(0);
        fs.utimesSync(other, past, past);
        recordPreCompact(base());
        expect(fs.existsSync(other)).toBe(true);
    });

    it('reads the version only from this package’s own manifest', () => {
        const dir = path.join(root, 'outer', 'inner');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(root, 'outer', 'inner', 'package.json'), JSON.stringify({ name: 'someone-else', version: '1.0.0' }));
        fs.writeFileSync(path.join(root, 'outer', 'package.json'), JSON.stringify({ name: '@event4u/agent-config', version: '20.1.0' }));
        expect(packageVersionFrom(dir)).toBe('20.1.0');
    });

    it('ignores log lines whose event is an object prototype key', () => {
        fs.mkdirSync(checkpointDir(ENV()), { recursive: true });
        fs.writeFileSync(eventsFile(ENV()), `${JSON.stringify({ event: 'toString' })}\n${JSON.stringify({ event: 'written' })}\n`);
        const tally = readEventTally(ENV());
        expect(tally.written).toBe(1);
        expect(Object.values(tally).every((v) => Number.isFinite(v))).toBe(true);
    });
});

describe('compact checkpoint — sweep: bounded work and guaranteed cleanup', () => {
    it('inspects at most SWEEP_MAX entries and reports an incomplete sweep past it', () => {
        const dir = checkpointDir(ENV());
        fs.mkdirSync(dir, { recursive: true });
        for (let i = 0; i < SWEEP_MAX + 100; i++) fs.writeFileSync(path.join(dir, `${i.toString(16).padStart(64, '0')}.json`), '{}');
        const r = sweepAbandoned(dir, new Date());
        expect(r.inspected).toBeLessThanOrEqual(SWEEP_MAX);
        expect(r.complete).toBe(false);
    });

    it('writes no new marker while the directory holds more than the sweep can see, so it cannot grow past the budget', () => {
        const dir = checkpointDir(ENV());
        fs.mkdirSync(dir, { recursive: true });
        for (let i = 0; i < SWEEP_MAX + 10; i++) fs.writeFileSync(path.join(dir, `n${i}.txt`), 'x');
        expect(recordPreCompact(base())).toBe('skipped');
        expect(fs.existsSync(markerFile())).toBe(false);
    });

    it('reaches an expired marker behind a persistent prefix of other files', () => {
        const dir = checkpointDir(ENV());
        fs.mkdirSync(dir, { recursive: true });
        for (let i = 0; i < 250; i++) fs.writeFileSync(path.join(dir, `keep${i}.txt`), 'x');
        const old = path.join(dir, `${'c'.repeat(64)}.json`);
        fs.writeFileSync(old, '{}');
        const past = new Date(Date.parse('2026-11-08T12:00:00Z') - MARKER_RETENTION_MS - 1000);
        fs.utimesSync(old, past, past);
        for (let i = 0; i < 3; i++) recordPreCompact(base({ now: new Date(Date.parse('2026-11-08T12:00:00Z') + i) }));
        expect(fs.existsSync(old)).toBe(false);
    });
});

describe('compact checkpoint — council round 10 blockers', () => {
    it('refuses a write at the write limit, leaving headroom below what a sweep reads', () => {
        const dir = checkpointDir(ENV());
        fs.mkdirSync(dir, { recursive: true });
        for (let i = 0; i < WRITE_LIMIT; i++) fs.writeFileSync(path.join(dir, `n${i}.txt`), 'x');
        expect(recordPreCompact(base())).toBe('skipped');
        expect(fs.readdirSync(dir).length).toBeLessThan(SWEEP_MAX);
    });

    it('invalidates the predecessor even when the new write is refused', () => {
        recordPreCompact(base());
        const dir = checkpointDir(ENV());
        for (let i = 0; i < SWEEP_MAX + 5; i++) fs.writeFileSync(path.join(dir, `n${i}.txt`), 'x');
        expect(recordPreCompact(base({ now: new Date('2026-11-08T12:00:30Z') }))).toBe('skipped');
        expect(observePostCompact(base({ now: new Date('2026-11-08T12:01:00Z') }))).toBe('none');
    });

    it('removes abandoned temporary files once they are older than the retention bound', () => {
        const dir = checkpointDir(ENV());
        fs.mkdirSync(dir, { recursive: true });
        const tmp = path.join(dir, `.${'d'.repeat(64)}.json.abcdef012345.tmp`);
        fs.writeFileSync(tmp, 'x');
        const past = new Date(Date.parse('2026-11-08T12:00:00Z') - MARKER_RETENTION_MS - 1000);
        fs.utimesSync(tmp, past, past);
        recordPreCompact(base());
        expect(fs.existsSync(tmp)).toBe(false);
    });

    it('keeps the marker when the classification could not be logged', () => {
        recordPreCompact(base());
        fs.rmSync(eventsFile(ENV()), { force: true });
        fifoAt(eventsFile(ENV()));
        observePostCompact(base());
        expect(fs.existsSync(markerFile())).toBe(true);
    });
});

describe('compact checkpoint — round 11: headroom keeps every sweep complete', () => {
    it('the write limit leaves room below the sweep budget for the log and concurrent writers', () => {
        expect(WRITE_LIMIT).toBeLessThanOrEqual(SWEEP_MAX - 16);
    });

    it('a sweep still reaches the end after writes stopped at the limit and a few concurrent ones landed', () => {
        const dir = checkpointDir(ENV());
        fs.mkdirSync(dir, { recursive: true });
        for (let i = 0; i < WRITE_LIMIT + 10; i++) fs.writeFileSync(path.join(dir, `n${i}.txt`), 'x');
        expect(sweepAbandoned(dir, new Date()).complete).toBe(true);
    });
});
~~~

## Helpers it calls (unchanged)

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

export function eolSessionKey(raw: string | null | undefined): string {
    return crypto.createHash('sha256').update(raw || 'unknown-session').digest('hex');
}
export function event4u_root(env?: EnvMap | null): string {
    const env_map = env ?? process.env;
    const override = env_map[EVENT4U_HOME_ENV];
    if (override) {
        return expanduser(override);
    }
    return path.join(os.homedir(), DEFAULT_EVENT4U_ROOT_RELATIVE);
}
export function write_target(
    relative_name: string,
    options: { env?: EnvMap | null } = {},
): string {
    if (is_absolute_like_python(relative_name)) {
        throw new Error(`write_target expects a relative path, got '${relative_name}'`);
    }
    return path.join(event4u_root(options.env ?? null), relative_name);
}
~~~
