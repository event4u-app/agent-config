<!-- evidence-type: analysis -->

<!-- Round-9 prompt given to the council on 2026-11-08 for branch
     feat/compact-checkpoint-phase-1, committed verbatim beside the record. -->

# Ratification review, round 9 — a new hook concern and its budget row

Same question as rounds 1–8, on the code as it now stands. Judge whether the
change expands any authority — can it block, deny, rewrite or inject anything,
lower a ceiling, weaken a gate, or reach the model's context? Answer with
exactly one verdict and the reasons:

- `ratified` — it expands authority, and the expansion is acceptable.
- `confirmed-non-expanding` — it expands no authority.
- `refused` — it expands authority in a way that should not merge, or the
  material does not let you tell.

Also name any defect that should block the merge regardless of the verdict.

## What changed since round 8

The abandoned-marker sweep read the whole directory and bounded removals, not
work. It now reads incrementally (`opendirSync` / `readSync`) and stops after
200 entries looked at, kept or removed; it returns that count. A test with 300
fresh markers holds it to 200; removing the bound reds the test. Everything
else is as in round 8.

## The diff of the gated files

~~~diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 72ebb16456..d96b0b780b 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -275,6 +275,12 @@
             "registered_at": "2026-10-28",
             "derivation": "Measured 9,807 bytes on 2026-10-28 (the intake-pass concern, its task-prompt and question predicates after council round 1, and the shared `isSyntheticPrompt` reader), no `yaml`. The ceiling is that reading plus about 10 %, rounded, with no growth queued. Bound on `user_prompt_submit` on every host that binds the slot; the dispatch bundle carries only its LAZY_CONCERNS row. A missing chunk falls back to the spawn path and costs latency, never the line."
         },
+        {
+            "entry": "src/scripts/hooks/compact_checkpoint_hook.ts",
+            "max_bytes": 18600,
+            "registered_at": "2026-11-08",
+            "derivation": "Measured 16,969 bytes on 2026-11-08 (the compact-checkpoint concern: a keys-only marker in the user-global runtime directory with an inspection-bounded sweep of abandoned markers, its bounded non-following reader, and the containment check and runtime-path helpers it reuses), `yaml` external. The ceiling is that reading plus about 10 %, rounded, with no growth queued. Bound on `pre_compact` and `session_start` on claude only; the dispatch bundle carries only its LAZY_CONCERNS row."
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
        const input = { sessionId, transcriptPath, version: packageVersion() };
        if (event === 'pre_compact') {
            recordPreCompact(input);
        } else if (event === 'session_start' && str(payload['source'] ?? envelope['source']) === 'compact') {
            observePostCompact(input);
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
 * Most directory entries one sweep looks at, kept or removed, so a full
 * directory cannot stall a compaction. Entries past the budget wait for a later
 * sweep; reaching them needs fewer than this many entries ahead of them.
 */
export const SWEEP_MAX = 200;

const MARKER_NAME = /^[0-9a-f]{64}\.json$/;
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
    fs.writeFileSync(tmp, body, { flag: 'wx' });
    fs.renameSync(tmp, file);
}

function logEvent(env: EnvMap | undefined, event: EventName, now: Date, ageMs?: number): void {
    const dir = safeDir(env);
    if (dir === null) return;
    const file = eventsFile(env);
    const st = lstatOrNull(file);
    if (st !== null && !st.isFile()) return;
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
        return;
    }
    const { O_WRONLY, O_APPEND, O_CREAT, O_NOFOLLOW, O_NONBLOCK } = fs.constants;
    const fd = fs.openSync(file, O_WRONLY | O_APPEND | O_CREAT | (O_NOFOLLOW ?? 0) | (O_NONBLOCK ?? 0), 0o644);
    try {
        // Re-checked on the descriptor: a FIFO or a hard-linked file swapped in after the lstat is refused.
        const fst = fs.fstatSync(fd);
        if (fst.isFile() && fst.nlink === 1) fs.writeSync(fd, line);
    } finally {
        fs.closeSync(fd);
    }
}

/**
 * Remove markers of any session not touched within `MARKER_RETENTION_MS`;
 * regular files with marker names only. Reads the directory incrementally and
 * stops after `SWEEP_MAX` entries. Returns how many entries it looked at.
 */
export function sweepAbandoned(dir: string, now: Date): number {
    let d: fs.Dir;
    try {
        d = fs.opendirSync(dir);
    } catch {
        return 0;
    }
    let inspected = 0;
    try {
        for (let entry = d.readSync(); entry !== null && inspected < SWEEP_MAX; entry = d.readSync()) {
            inspected++;
            if (!MARKER_NAME.test(entry.name)) continue;
            const p = path.join(dir, entry.name);
            const st = lstatOrNull(p);
            if (st !== null && st.isFile() && now.getTime() - st.mtimeMs > MARKER_RETENTION_MS) fs.rmSync(p, { force: true });
        }
    } catch {
        // an unreadable entry ends the sweep; the next write tries again
    } finally {
        d.closeSync();
    }
    return inspected;
}

/** `pre_compact`: invalidate an unclassified predecessor, then write this attempt's marker. */
export function recordPreCompact(input: CheckpointInput): PreCompactOutcome {
    const now = input.now ?? new Date();
    const dir = safeDir(input.env);
    if (dir === null) return 'skipped';
    sweepAbandoned(dir, now);
    const key = eolSessionKey(input.sessionId);
    const file = checkpointFile(key, input.env);
    if (lstatOrNull(file) !== null) {
        // Removed before anything else, and counted only once the removal held,
        // so a failed write below can never leave the predecessor eligible.
        fs.rmSync(file, { force: true });
        logEvent(input.env, 'orphaned', now);
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
    // Logged before the marker is consumed: if the log write fails, the marker
    // stays and the next observation classifies it again.
    logEvent(input.env, outcome, now, ageMs);
    // Consumed when classified, and removed when unreadable as a marker, so a
    // malformed file never lingers; anything that is not a regular file stays.
    if (lstatOrNull(file)?.isFile()) fs.rmSync(file, { force: true });
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
