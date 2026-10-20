/**
 * The tool-result store (road-to-tool-results-that-leave-a-handle Phase 2).
 *
 * Four properties, one block each, named by the roadmap's verify lines:
 * equal results share one entry and the stage is the writer; nothing that
 * differs from what was delivered, and no credential, rests on disk; an expired
 * handle says so after its entry is gone; a handle returns exactly the bytes it
 * names, and every other state answers as itself.
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    acquireCleanupLock,
    assertNoLinks,
    cleanupSpool,
    readHandle,
    claimAndDelete,
    releaseCleanupLock,
    SPOOL_DIR,
    SPOOL_OBSERVATION_FILE,
    SPOOL_RETENTION_MS,
    SPOOL_SELECTED_CLASSES,
    spoolResult,
    type SpoolStageView,
    storeBytes,
    writeAll,
} from '../../src/scripts/_lib/tool_output_spool.js';
import { spoolLoadAttempts } from '../../src/scripts/_lib/tool_output_spool_loader.js';
import { loadEgressEngine } from '../../src/scripts/hooks/egress_engine_loader.js';
import { type EgressMode, runEgressStage } from '../../src/scripts/hooks/egress_stage.js';
import type { JsonObject } from '../../src/scripts/hooks/payload_stub.js';
import { main as reportMain } from '../../src/scripts/report_reducible_classes.js';

const ALNUM = 'Ab3Cd5Ef7Gh9Jk2Lm4Np6Qr8St1Uv3Wx5Yz7';
/** A GitHub-PAT-shaped credential, assembled so no credential literal sits in this file. */
const PLANTED = ['ghp', ALNUM.slice(0, 36)].join('_');
const READ_TEXT = new Set(['Read:text'] as const);
const S = 's1';

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tool-output-spool-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function readEnvelope(content: string, session = 's1'): JsonObject {
    return {
        schema_version: 1,
        platform: 'claude',
        event: 'post_tool_use',
        workspace_root: tmp,
        payload: { session_id: session, tool_name: 'Read', tool_input: { file_path: '/x/a.md' }, tool_response: { type: 'text', file: { content } } },
        settings: {},
    };
}

const spoolFiles = (): string[] => {
    const dir = path.join(tmp, SPOOL_DIR);
    return fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => /^[0-9a-f]{64}$/.test(n)) : [];
};

const fixed = (mode: EgressMode) => (): EgressMode => mode;

/** The real engine, with its store bound to a selection the test names; the shipped selection is empty. */
function engineSelecting(): ReturnType<typeof loadEgressEngine> {
    const real = loadEgressEngine();
    if (!real.ok) throw new Error(`engine unavailable: ${real.reason}`);
    const engine = { ...real.engine, spoolResult: (e: Record<string, unknown>, v: SpoolStageView, k: readonly string[], r: string) => real.engine.spoolResult(e, v, k, r, READ_TEXT) };
    return { ok: true, engine };
}

describe('spool-write-is-content-addressed', () => {
    it('spool-write-is-content-addressed: equal outputs in one session share one entry, under a keyed address', () => {
        const body = 'line one\nline two\n'.repeat(400);
        const r1 = runEgressStage(readEnvelope(body), fixed('protect'), engineSelecting);
        const r2 = runEgressStage(readEnvelope(body), fixed('protect'), engineSelecting);
        expect(r1.mode).toBe('protect');
        expect(r2.mode).toBe('protect');
        const files = spoolFiles();
        expect(files).toHaveLength(1);
        const stored = fs.readFileSync(path.join(tmp, SPOOL_DIR, files[0] as string));
        // The name is not the content digest: a file name says nothing about what it holds.
        expect(createHash('sha256').update(stored).digest('hex')).not.toBe(files[0]);
        expect(JSON.parse(stored.toString('utf8'))).toEqual({ type: 'text', file: { content: body } });
        runEgressStage(readEnvelope(`${body}changed`), fixed('protect'), engineSelecting);
        expect(spoolFiles()).toHaveLength(2);
    });

    it('equal outputs in two sessions are two entries, so equality does not link sessions', () => {
        const body = 'shared secret-free content\n'.repeat(100);
        runEgressStage(readEnvelope(body, 's1'), fixed('protect'), engineSelecting);
        runEgressStage(readEnvelope(body, 's2'), fixed('protect'), engineSelecting);
        expect(spoolFiles()).toHaveLength(2);
    });

    it('a result with no session id is not stored, because its handle would bind to nobody', () => {
        const env = readEnvelope('no session here');
        delete (env['payload'] as JsonObject)['session_id'];
        const view: SpoolStageView = { mode: 'protect', placeholder: env, counts: [], refused: [] };
        expect(spoolResult(env, view, ['tool_response'], tmp, READ_TEXT)).toEqual({ action: 'skip', reason: 'no-session' });
        expect(spoolFiles()).toHaveLength(0);
    });

    it('observe writes no body and records class, length and digest only', () => {
        const body = 'observed content\n'.repeat(50);
        runEgressStage(readEnvelope(body), fixed('observe'), engineSelecting);
        expect(spoolFiles()).toHaveLength(0);
        const lines = fs.readFileSync(path.join(tmp, SPOOL_OBSERVATION_FILE), 'utf8').trim().split('\n');
        expect(lines).toHaveLength(1);
        const line = JSON.parse(lines[0] as string) as Record<string, unknown>;
        expect(Object.keys(line).sort()).toEqual(['bytes', 'class', 'digest', 'tool', 'ts']);
        expect(line['class']).toBe('Read:text');
        expect(JSON.stringify(line)).not.toContain('observed content');
        // The recorded digest is keyed: equal to no public hash of the body.
        expect(line['digest']).not.toBe(createHash('sha256').update(JSON.stringify({ type: 'text', file: { content: body } })).digest('hex'));
    });

    it('the shipped selection is empty, so the stage stores nothing in any mode', () => {
        expect(SPOOL_SELECTED_CLASSES.size).toBe(0);
        for (const m of ['observe', 'protect', 'strict'] as const) runEgressStage(readEnvelope('x'.repeat(9000)), fixed(m));
        expect(spoolFiles()).toHaveLength(0);
        expect(fs.existsSync(path.join(tmp, SPOOL_OBSERVATION_FILE))).toBe(false);
    });

    it('with the shipped selection the store is never loaded, nothing is written, and the stage result is unchanged', () => {
        const before = spoolLoadAttempts();
        const real = loadEgressEngine();
        if (!real.ok) throw new Error(real.reason);
        const without = (): ReturnType<typeof loadEgressEngine> => ({
            ok: true,
            engine: { ...real.engine, spoolResult: () => ({ action: 'skip', reason: 'unselected' }) },
        });
        for (const m of ['off', 'observe', 'protect', 'strict'] as const) {
            const body = `${m} body\n`.repeat(2000);
            const a = runEgressStage(readEnvelope(body), fixed(m));
            const b = runEgressStage(readEnvelope(body), fixed(m), without);
            expect(a).toEqual(b);
        }
        expect(spoolLoadAttempts()).toBe(before);
        // The only two paths the store writes; the stage's own counters are not the store's.
        expect(fs.existsSync(path.join(tmp, SPOOL_DIR))).toBe(false);
        expect(fs.existsSync(path.join(tmp, SPOOL_OBSERVATION_FILE))).toBe(false);
    });

    it('an unselected class and an image are never stored', () => {
        const bash: JsonObject = { ...readEnvelope('y'), payload: { tool_name: 'Bash', tool_input: { command: 'npm test' }, tool_response: { stdout: 'ok' } } };
        runEgressStage(bash, fixed('protect'), engineSelecting);
        const image: JsonObject = { ...readEnvelope('z'), payload: { tool_name: 'Read', tool_input: { file_path: '/a.png' }, tool_response: { type: 'image', file: { base64: 'AAAA' } } } };
        runEgressStage(image, fixed('protect'), engineSelecting);
        expect(spoolFiles()).toHaveLength(0);
    });
});

describe('credential-match-is-never-spooled', () => {
    it('credential-match-is-never-spooled: a result carrying a credential is not stored and is delivered unreduced', () => {
        const env = readEnvelope(`config\ntoken=${PLANTED}\n`);
        const before = JSON.stringify(env);
        const r = runEgressStage(env, fixed('protect'), engineSelecting);
        expect(spoolFiles()).toHaveLength(0);
        expect(JSON.stringify(env)).toBe(before);
        expect(r.counts.some((c) => c.field === 'result' && c.class === 'credential')).toBe(true);
        for (const name of fs.existsSync(path.join(tmp, SPOOL_DIR)) ? fs.readdirSync(path.join(tmp, SPOOL_DIR)) : []) {
            expect(fs.readFileSync(path.join(tmp, SPOOL_DIR, name)).includes(PLANTED)).toBe(false);
        }
        // A detection-only rule counts a credential without replacing it, so the view equals
        // the received bytes; the count alone must still refuse storage.
        const same: SpoolStageView = { mode: 'protect', placeholder: env, counts: [{ field: 'result', class: 'credential' }], refused: [] };
        expect(spoolResult(env, same, ['tool_response'], tmp, READ_TEXT)).toEqual({ action: 'skip', reason: 'credential' });
        expect(spoolFiles()).toHaveLength(0);
    });

    it('a credential count refuses storage even in observe, so no digest of it is recorded', () => {
        runEgressStage(readEnvelope(`token=${PLANTED}`), fixed('observe'), engineSelecting);
        expect(fs.existsSync(path.join(tmp, SPOOL_OBSERVATION_FILE))).toBe(false);
    });

    it('stored bytes must equal delivered bytes: a placeholder view that differs stores nothing', () => {
        const env = readEnvelope('plain body');
        const view: SpoolStageView = {
            mode: 'protect',
            placeholder: { ...env, payload: { ...(env['payload'] as JsonObject), tool_response: { type: 'text', file: { content: 'plain ⟦token⟧' } } } },
            counts: [{ field: 'result', class: 'identifier' }],
            refused: [],
        };
        expect(spoolResult(env, view, ['tool_response'], tmp, READ_TEXT)).toEqual({ action: 'skip', reason: 'view-differs' });
        const withheld: SpoolStageView = { mode: 'protect', placeholder: undefined, counts: [], refused: [{ field: 'result' }] };
        expect(spoolResult(env, withheld, ['tool_response'], tmp, READ_TEXT)).toEqual({ action: 'skip', reason: 'credential' });
        expect(spoolResult(env, { ...withheld, mode: 'off', refused: [] }, ['tool_response'], tmp, READ_TEXT)).toEqual({ action: 'skip', reason: 'mode' });
        expect(spoolFiles()).toHaveLength(0);
    });
});

describe('expired-handle-says-expired', () => {
    it('expired-handle-says-expired: past the retention age a handle answers expired, before and after cleanup', () => {
        const t0 = Date.UTC(2026, 9, 20);
        const { handle, address } = storeBytes(tmp, Buffer.from('kept for a week'), S, t0);
        expect(readHandle(tmp, handle, S, undefined, t0 + 1000).state).toBe('ok');
        const later = t0 + SPOOL_RETENTION_MS + 1000;
        expect(readHandle(tmp, handle, S, undefined, later)).toEqual({ state: 'expired' });
        const file = path.join(tmp, SPOOL_DIR, address);
        fs.utimesSync(file, new Date(t0), new Date(t0));
        expect(cleanupSpool(tmp, later).removed).toBe(1);
        expect(fs.existsSync(file)).toBe(false);
        expect(readHandle(tmp, handle, S, undefined, later)).toEqual({ state: 'expired' });
    });

    it('past the byte cap the oldest entries go first, and a valid handle to one says missing', () => {
        const now = Date.now();
        const a = storeBytes(tmp, Buffer.alloc(100, 1), S, now);
        const b = storeBytes(tmp, Buffer.alloc(100, 2), S, now);
        fs.utimesSync(path.join(tmp, SPOOL_DIR, a.address), new Date(now - 5000), new Date(now - 5000));
        expect(cleanupSpool(tmp, now, 150).removed).toBe(1);
        expect(readHandle(tmp, a.handle, S, undefined, now)).toEqual({ state: 'missing' });
        expect(readHandle(tmp, b.handle, S, undefined, now).state).toBe('ok');
    });

    it('a cleanup lock held by another process skips; a stale one is taken over', () => {
        const now = Date.now();
        const old = storeBytes(tmp, Buffer.from('old'), S, now - SPOOL_RETENTION_MS - 5000);
        fs.utimesSync(path.join(tmp, SPOOL_DIR, old.address), new Date(now - SPOOL_RETENTION_MS - 5000), new Date(now - SPOOL_RETENTION_MS - 5000));
        const lock = path.join(tmp, SPOOL_DIR, '.cleanup.lock');
        fs.writeFileSync(lock, '1');
        expect(cleanupSpool(tmp, now).removed).toBe(0);
        fs.utimesSync(lock, new Date(now - 11 * 60 * 1000), new Date(now - 11 * 60 * 1000));
        expect(cleanupSpool(tmp, now).removed).toBe(1);
        expect(fs.existsSync(lock)).toBe(false);
    });
});

describe('handles are scoped to their session', () => {
    it('a handle read from another session, or with no session, answers invalid', () => {
        const { handle } = storeBytes(tmp, Buffer.from('session one only'), S);
        expect(readHandle(tmp, handle, S).state).toBe('ok');
        expect(readHandle(tmp, handle, 's2')).toEqual({ state: 'invalid' });
        expect(readHandle(tmp, handle, '')).toEqual({ state: 'invalid' });
    });

    it('a store without a session is refused outright', () => {
        expect(() => storeBytes(tmp, Buffer.from('x'), '')).toThrow(/session/);
    });
});

describe('retention, partial writes and cleanup failure', () => {
    it('a read cleans the store: an entry past its age is gone after any read, not only after a store', () => {
        const now = Date.now();
        const old = storeBytes(tmp, Buffer.from('old entry'), S, now - SPOOL_RETENTION_MS - 5000);
        const oldFile = path.join(tmp, SPOOL_DIR, old.address);
        fs.utimesSync(oldFile, new Date(now - SPOOL_RETENTION_MS - 5000), new Date(now - SPOOL_RETENTION_MS - 5000));
        const fresh = storeBytes(tmp, Buffer.from('fresh entry'), S, now);
        expect(readHandle(tmp, fresh.handle, S, undefined, now).state).toBe('ok');
        expect(fs.existsSync(oldFile)).toBe(false);
    });

    it('a write that died before its rename is never served and is removed once stale', () => {
        const now = Date.now();
        const { handle, address } = storeBytes(tmp, Buffer.from('complete'), S, now);
        const partial = path.join(tmp, SPOOL_DIR, `${address}.999.abcdef.tmp`);
        fs.writeFileSync(partial, 'comp');
        expect(readHandle(tmp, handle, S, undefined, now)).toEqual({ state: 'ok', bytes: Buffer.from('complete') });
        fs.utimesSync(partial, new Date(now - 2 * 3600 * 1000), new Date(now - 2 * 3600 * 1000));
        cleanupSpool(tmp, now);
        expect(fs.existsSync(partial)).toBe(false);
    });

    it('a cleanup that fails propagates (so the store refuses) and releases its lock', () => {
        const now = Date.now();
        const old = storeBytes(tmp, Buffer.from('aged'), S, now - SPOOL_RETENTION_MS - 1000);
        const dir = path.join(tmp, SPOOL_DIR);
        fs.utimesSync(path.join(dir, old.address), new Date(now - SPOOL_RETENTION_MS - 1000), new Date(now - SPOOL_RETENTION_MS - 1000));
        expect(() =>
            cleanupSpool(tmp, now, 10_000, {
                beforeClaim: () => {
                    throw new Error('disk gone');
                },
            }),
        ).toThrow(/disk gone/);
        expect(fs.existsSync(path.join(dir, '.cleanup.lock'))).toBe(false);
    });

    it('a cleanup failure on a repeat store keeps the entry that already existed, and its earlier handle', () => {
        const now = Date.now();
        const env = readEnvelope('stored twice in one session');
        const view: SpoolStageView = { mode: 'protect', placeholder: env, counts: [], refused: [] };
        const first = spoolResult(env, view, ['tool_response'], tmp, READ_TEXT, now) as { action: string; handle: string };
        expect(first.action).toBe('stored');
        const old = storeBytes(tmp, Buffer.from('aged'), S, now - SPOOL_RETENTION_MS - 1000);
        const dir = path.join(tmp, SPOOL_DIR);
        fs.utimesSync(path.join(dir, old.address), new Date(now - SPOOL_RETENTION_MS - 1000), new Date(now - SPOOL_RETENTION_MS - 1000));
        const failing = { hooks: { beforeClaim: (): void => { throw new Error('disk gone'); } } };
        expect(spoolResult(env, view, ['tool_response'], tmp, READ_TEXT, now, failing)).toEqual({ action: 'skip', reason: 'store-error' });
        expect(readHandle(tmp, first.handle, S, undefined, now).state).toBe('ok');
        expect(fs.readdirSync(dir).filter((n) => n.endsWith('.tmp') || n.endsWith('.claimed'))).toEqual([]);
    });

    it('through the store path, a cleanup failure answers store-error and leaves the new result unstored', () => {
        const now = Date.now();
        const old = storeBytes(tmp, Buffer.from('aged'), S, now - SPOOL_RETENTION_MS - 1000);
        const dir = path.join(tmp, SPOOL_DIR);
        fs.utimesSync(path.join(dir, old.address), new Date(now - SPOOL_RETENTION_MS - 1000), new Date(now - SPOOL_RETENTION_MS - 1000));
        const before = new Set(spoolFiles());
        const env = readEnvelope('the new result');
        const view: SpoolStageView = { mode: 'protect', placeholder: env, counts: [], refused: [] };
        const failing = { hooks: { beforeClaim: (): void => { throw new Error('disk gone'); } } };
        expect(spoolResult(env, view, ['tool_response'], tmp, READ_TEXT, now, failing)).toEqual({ action: 'skip', reason: 'store-error' });
        expect(new Set(spoolFiles())).toEqual(before);
        expect(fs.existsSync(path.join(dir, '.cleanup.lock'))).toBe(false);
    });

    it('an existing store directory is tightened to 0700 by a store', () => {
        const dir = path.join(tmp, SPOOL_DIR);
        fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
        fs.chmodSync(dir, 0o755);
        const env = readEnvelope('tighten me');
        spoolResult(env, { mode: 'protect', placeholder: env, counts: [], refused: [] }, ['tool_response'], tmp, READ_TEXT);
        expect(fs.statSync(dir).mode & 0o777).toBe(0o700);
    });

    it('every store enforces retention, in one long session', () => {
        const now = Date.now();
        const old = storeBytes(tmp, Buffer.from('aged'), S, now - SPOOL_RETENTION_MS - 1000);
        const oldFile = path.join(tmp, SPOOL_DIR, old.address);
        fs.utimesSync(oldFile, new Date(now - SPOOL_RETENTION_MS - 1000), new Date(now - SPOOL_RETENTION_MS - 1000));
        for (const body of ['one', 'two', 'three']) {
            const env = readEnvelope(body);
            spoolResult(env, { mode: 'protect', placeholder: env, counts: [], refused: [] }, ['tool_response'], tmp, READ_TEXT, now);
        }
        expect(fs.existsSync(oldFile)).toBe(false);
        expect(spoolFiles()).toHaveLength(3);
    });

    it('the cap and the age are exact boundaries', () => {
        const now = Date.now();
        const dir = path.join(tmp, SPOOL_DIR);
        const a = storeBytes(tmp, Buffer.alloc(100, 1), S, now);
        const b = storeBytes(tmp, Buffer.alloc(100, 2), S, now);
        fs.utimesSync(path.join(dir, a.address), new Date(now - 5000), new Date(now - 5000));
        expect(cleanupSpool(tmp, now, 200).removed).toBe(0);
        expect(cleanupSpool(tmp, now, 199).removed).toBe(1);
        expect(fs.existsSync(path.join(dir, b.address))).toBe(true);
        const edge = new Date(now - SPOOL_RETENTION_MS + 1000);
        fs.utimesSync(path.join(dir, b.address), edge, edge);
        expect(cleanupSpool(tmp, now, 10_000).removed).toBe(0);
        const past = new Date(now - SPOOL_RETENTION_MS);
        fs.utimesSync(path.join(dir, b.address), past, past);
        expect(cleanupSpool(tmp, now, 10_000).removed).toBe(1);
    });
});

describe('a handle that fails a check causes no filesystem work', () => {
    it.each([
        ['malformed', 'not-a-handle'],
        ['forged MAC', null],
        ['wrong session', 'other-session'],
    ])('%s: an entry past its age survives, and no cleanup lock is taken', (_label, variant) => {
        const now = Date.now();
        const old = storeBytes(tmp, Buffer.from('old entry'), S, now - SPOOL_RETENTION_MS - 5000);
        const oldFile = path.join(tmp, SPOOL_DIR, old.address);
        fs.utimesSync(oldFile, new Date(now - SPOOL_RETENTION_MS - 5000), new Date(now - SPOOL_RETENTION_MS - 5000));
        const fresh = storeBytes(tmp, Buffer.from('fresh'), S, now);
        const [a, e] = fresh.handle.split('.') as [string, string];
        const handle = variant === null ? `${a}.${e}.${'f'.repeat(32)}` : variant === 'other-session' ? fresh.handle : variant;
        const session = variant === 'other-session' ? 'other-session' : S;
        expect(readHandle(tmp, handle, session, undefined, now).state).toBe('invalid');
        expect(fs.existsSync(oldFile)).toBe(true);
        expect(fs.existsSync(path.join(tmp, SPOOL_DIR, '.cleanup.lock'))).toBe(false);
    });
});

describe('hostile session ids fail closed', () => {
    it.each(['', '../escape', 'a:b', 'tab\there', 'x'.repeat(129)])('%j is refused for store and read', (bad) => {
        expect(() => storeBytes(tmp, Buffer.from('x'), bad)).toThrow(/session/);
        const { handle } = storeBytes(tmp, Buffer.from('y'), S);
        expect(readHandle(tmp, handle, bad)).toEqual({ state: 'invalid' });
        const env = readEnvelope('z', bad);
        const view: SpoolStageView = { mode: 'protect', placeholder: env, counts: [], refused: [] };
        expect(spoolResult(env, view, ['tool_response'], tmp, READ_TEXT)).toEqual({ action: 'skip', reason: 'no-session' });
    });
});

describe('complete writes', () => {
    it('writes every byte through short writes', () => {
        const file = path.join(tmp, 'w');
        const fd = fs.openSync(file, 'w');
        const bytes = Buffer.from('0123456789abcdefghij');
        writeAll(fd, bytes, (f, b, off, len) => fs.writeSync(f, b, off, Math.min(3, len)));
        fs.closeSync(fd);
        expect(fs.readFileSync(file).equals(bytes)).toBe(true);
    });

    it('throws instead of looping or publishing when a write makes no progress', () => {
        expect(() => writeAll(0, Buffer.from('abc'), () => 0)).toThrow(/short write/);
    });
});

describe('the cap, through the store path', () => {
    const view = (env: JsonObject): SpoolStageView => ({ mode: 'protect', placeholder: env, counts: [], refused: [] });
    const size = (body: string): number => Buffer.byteLength(JSON.stringify({ type: 'text', file: { content: body } }));
    const store = (body: string, maxBytes: number, now: number): unknown =>
        spoolResult(readEnvelope(body), view(readEnvelope(body)), ['tool_response'], tmp, READ_TEXT, now, { maxBytes });
    const total = (): number => spoolFiles().reduce((n, f) => n + fs.statSync(path.join(tmp, SPOOL_DIR, f)).size, 0);

    it('two entries exactly at the cap are both kept', () => {
        const a = 'a'.repeat(100);
        const b = 'b'.repeat(100);
        const cap = size(a) + size(b);
        const now = Date.now();
        expect(store(a, cap, now)).toMatchObject({ action: 'stored' });
        expect(store(b, cap, now)).toMatchObject({ action: 'stored' });
        expect(spoolFiles()).toHaveLength(2);
        expect(total()).toBe(cap);
    });

    it('one byte over the cap evicts the oldest and keeps the store that triggered it', () => {
        const a = 'a'.repeat(100);
        const b = 'b'.repeat(100);
        const cap = size(a) + size(b) - 1;
        const now = Date.now();
        store(a, cap, now);
        const dir = path.join(tmp, SPOOL_DIR);
        for (const f of spoolFiles()) fs.utimesSync(path.join(dir, f), new Date(now - 5000), new Date(now - 5000));
        const second = store(b, cap, now) as { action: string; handle: string };
        expect(second.action).toBe('stored');
        expect(spoolFiles()).toHaveLength(1);
        expect(readHandle(tmp, second.handle, S, undefined, now).state).toBe('ok');
        expect(total()).toBeLessThanOrEqual(cap);
    });

    it('the store that triggered cleanup survives even when it ties with older entries on mtime', () => {
        const a = 'a'.repeat(100);
        const b = 'b'.repeat(100);
        const cap = size(b);
        const now = Date.now();
        store(a, cap, now);
        const second = store(b, cap, now) as { action: string; handle: string };
        expect(readHandle(tmp, second.handle, S, undefined, now).state).toBe('ok');
        expect(total()).toBeLessThanOrEqual(cap);
    });

    it('an entry larger than the cap is refused before anything is written', () => {
        const big = 'x'.repeat(500);
        expect(store(big, size(big) - 1, Date.now())).toEqual({ action: 'skip', reason: 'too-large' });
        expect(spoolFiles()).toEqual([]);
    });
});

describe('a held lock and a concurrent identical store', () => {
    const view = (env: JsonObject): SpoolStageView => ({ mode: 'protect', placeholder: env, counts: [], refused: [] });
    const size = (body: string): number => Buffer.byteLength(JSON.stringify({ type: 'text', file: { content: body } }));

    it('with the lock held elsewhere, a store that would exceed the cap is not written; one that fits is', () => {
        const a = 'a'.repeat(100);
        const b = 'b'.repeat(100);
        const now = Date.now();
        spoolResult(readEnvelope(a), view(readEnvelope(a)), ['tool_response'], tmp, READ_TEXT, now, { maxBytes: 10_000 });
        const dir = path.join(tmp, SPOOL_DIR);
        const held = acquireCleanupLock(dir, now);
        expect(held).not.toBeNull();
        expect(spoolResult(readEnvelope(b), view(readEnvelope(b)), ['tool_response'], tmp, READ_TEXT, now, { maxBytes: size(a) + size(b) - 1 })).toEqual({
            action: 'skip',
            reason: 'cap-busy',
        });
        expect(spoolFiles()).toHaveLength(1);
        expect(spoolResult(readEnvelope(b), view(readEnvelope(b)), ['tool_response'], tmp, READ_TEXT, now, { maxBytes: size(a) + size(b) })).toMatchObject({
            action: 'stored',
        });
        releaseCleanupLock(dir, held as string);
    });

    it('a store whose cleanup throws while an identical store completes leaves that store\'s handle readable', () => {
        const now = Date.now();
        const old = storeBytes(tmp, Buffer.from('aged'), S, now - SPOOL_RETENTION_MS - 1000);
        const dir = path.join(tmp, SPOOL_DIR);
        fs.utimesSync(path.join(dir, old.address), new Date(now - SPOOL_RETENTION_MS - 1000), new Date(now - SPOOL_RETENTION_MS - 1000));
        const env = readEnvelope('the same bytes, twice at once');
        let other: { action: string; handle?: string } | null = null;
        const interleaved = {
            hooks: {
                beforeClaim: (): void => {
                    other = spoolResult(env, view(env), ['tool_response'], tmp, READ_TEXT, now) as { action: string; handle?: string };
                    throw new Error('disk gone');
                },
            },
        };
        expect(spoolResult(env, view(env), ['tool_response'], tmp, READ_TEXT, now, interleaved)).toEqual({ action: 'skip', reason: 'store-error' });
        expect(other).toMatchObject({ action: 'stored' });
        expect(readHandle(tmp, (other as unknown as { handle: string }).handle, S, undefined, now).state).toBe('ok');
    });
});

describe('the repository is not trusted for spool paths', () => {
    let outside = '';
    beforeEach(() => {
        outside = fs.mkdtempSync(path.join(os.tmpdir(), 'spool-outside-'));
    });
    afterEach(() => fs.rmSync(outside, { recursive: true, force: true }));
    const view = (env: JsonObject): SpoolStageView => ({ mode: 'protect', placeholder: env, counts: [], refused: [] });

    it.each([
        ['the spool directory', SPOOL_DIR],
        ['an ancestor', 'agents'],
    ])('%s as a symlink: nothing is stored, and nothing outside is written or chmodded', (_label, rel) => {
        fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true });
        fs.chmodSync(outside, 0o755);
        fs.symlinkSync(outside, path.join(tmp, rel));
        const env = readEnvelope('would escape');
        expect(spoolResult(env, view(env), ['tool_response'], tmp, READ_TEXT)).toEqual({ action: 'skip', reason: 'store-error' });
        expect(fs.readdirSync(outside)).toEqual([]);
        expect(fs.statSync(outside).mode & 0o777).toBe(0o755);
    });

    it('a symlinked key file is never used', () => {
        const dir = path.join(tmp, SPOOL_DIR);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(outside, 'k'), Buffer.alloc(32, 9));
        fs.symlinkSync(path.join(outside, 'k'), path.join(dir, '.key'));
        const env = readEnvelope('signed with a planted key?');
        expect(spoolResult(env, view(env), ['tool_response'], tmp, READ_TEXT)).toEqual({ action: 'skip', reason: 'store-error' });
        expect(spoolFiles()).toEqual([]);
    });

    it('an entry replaced by a symlink is not served', () => {
        const { handle, address } = storeBytes(tmp, Buffer.from('real'), S);
        const file = path.join(tmp, SPOOL_DIR, address);
        fs.rmSync(file);
        fs.writeFileSync(path.join(outside, 'x'), 'real');
        fs.symlinkSync(path.join(outside, 'x'), file);
        expect(readHandle(tmp, handle, S).state).not.toBe('ok');
    });

    it('a symlinked observation file is not appended to', () => {
        fs.mkdirSync(path.join(tmp, path.dirname(SPOOL_OBSERVATION_FILE)), { recursive: true });
        fs.writeFileSync(path.join(outside, 'log'), '');
        fs.symlinkSync(path.join(outside, 'log'), path.join(tmp, SPOOL_OBSERVATION_FILE));
        const env = readEnvelope('observed');
        spoolResult(env, { ...view(env), mode: 'observe' }, ['tool_response'], tmp, READ_TEXT);
        expect(fs.readFileSync(path.join(outside, 'log'), 'utf8')).toBe('');
    });

    it('assertNoLinks passes a plain path and a missing one', () => {
        fs.mkdirSync(path.join(tmp, SPOOL_DIR), { recursive: true });
        expect(() => assertNoLinks(tmp, SPOOL_DIR)).not.toThrow();
        expect(() => assertNoLinks(tmp, path.join(SPOOL_DIR, 'absent'))).not.toThrow();
    });
});

describe('the cleanup lock is owned', () => {
    it('a displaced cleaner cannot release its successor’s lock', () => {
        const dir = path.join(tmp, SPOOL_DIR);
        fs.mkdirSync(dir, { recursive: true });
        const lock = path.join(dir, '.cleanup.lock');
        const a = acquireCleanupLock(dir);
        expect(a).not.toBeNull();
        const stale = new Date(Date.now() - 11 * 60 * 1000);
        fs.utimesSync(lock, stale, stale);
        const b = acquireCleanupLock(dir);
        expect(b).not.toBeNull();
        expect(b).not.toBe(a);
        releaseCleanupLock(dir, a as string);
        expect(fs.readFileSync(lock, 'utf8')).toBe(b);
        releaseCleanupLock(dir, b as string);
        expect(fs.existsSync(lock)).toBe(false);
    });

    it('a live lock is never taken, and of two takers of a stale lock at most one wins', () => {
        const dir = path.join(tmp, SPOOL_DIR);
        fs.mkdirSync(dir, { recursive: true });
        const a = acquireCleanupLock(dir);
        expect(acquireCleanupLock(dir)).toBeNull();
        const stale = new Date(Date.now() - 11 * 60 * 1000);
        fs.utimesSync(path.join(dir, '.cleanup.lock'), stale, stale);
        const winners = [acquireCleanupLock(dir), acquireCleanupLock(dir)].filter((t) => t !== null);
        expect(winners).toHaveLength(1);
        expect(winners[0]).not.toBe(a);
    });

    it('an entry a writer replaces between measurement and claim survives; the cap then takes the next oldest', () => {
        const now = Date.now();
        const a = storeBytes(tmp, Buffer.alloc(100, 1), S, now);
        const b = storeBytes(tmp, Buffer.alloc(100, 2), S, now);
        const dir = path.join(tmp, SPOOL_DIR);
        fs.utimesSync(path.join(dir, a.address), new Date(now - 5000), new Date(now - 5000));
        const removed = cleanupSpool(tmp, now, 150, {
            beforeClaim: (file) => {
                if (file.endsWith(a.address)) storeBytes(tmp, Buffer.alloc(100, 1), S, now);
            },
        }).removed;
        // The replaced entry is put back; the cap is still over, so the next oldest goes.
        expect(removed).toBe(1);
        expect(readHandle(tmp, a.handle, S, undefined, now).state).toBe('ok');
        expect(readHandle(tmp, b.handle, S, undefined, now).state).toBe('missing');
        expect(fs.readdirSync(dir).filter((n) => n.endsWith('.claimed'))).toEqual([]);
    });

    it('overlapping cleaners are harmless: only one claims an entry, so it is counted once', () => {
        const now = Date.now();
        const a = storeBytes(tmp, Buffer.alloc(100, 1), S, now);
        const dir = path.join(tmp, SPOOL_DIR);
        const seen = fs.statSync(path.join(dir, a.address));
        let inner = false;
        const first = claimAndDelete(dir, a.address, seen, 'tokA', {
            beforeClaim: () => {
                inner = claimAndDelete(dir, a.address, seen, 'tokB');
            },
        });
        expect([inner, first]).toEqual([true, false]);
        expect(fs.readdirSync(dir).filter((n) => n.endsWith('.claimed'))).toEqual([]);
    });
});

describe('the key is created whole', () => {
    it('eight processes storing at once into an empty store all mint readable handles', async () => {
        const tsx = path.resolve(__dirname, '../../node_modules/.bin/tsx');
        const mod = path.resolve(__dirname, '../../src/scripts/_lib/tool_output_spool.ts');
        // The race is probabilistic: against the old key code one run in four failed.
        for (let round = 0; round < 6; round++) {
            const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spool-key-race-'));
            try {
                const code = (i: number): string =>
                    `import { storeBytes } from ${JSON.stringify(mod)}; console.log(storeBytes(${JSON.stringify(root)}, Buffer.from('entry ${String(i)}'), 'k${String(i)}').handle);`;
                const runs = Array.from({ length: 8 }, (_, i) =>
                    new Promise<string>((resolve, reject) => {
                        const p = spawn(tsx, ['--eval', code(i)], { stdio: ['ignore', 'pipe', 'pipe'] });
                        let out = '';
                        p.stdout.on('data', (d: Buffer) => (out += d.toString()));
                        p.on('error', reject);
                        p.on('close', (c) => (c === 0 ? resolve(out.trim()) : reject(new Error(`exit ${String(c)}`))));
                    }),
                );
                const handles = await Promise.all(runs);
                expect(handles.map((h, i) => readHandle(root, h, `k${String(i)}`).state)).toEqual(Array(8).fill('ok'));
            } finally {
                fs.rmSync(root, { recursive: true, force: true });
            }
        }
    }, 120_000);

    it('a truncated key left by an older version refuses the store instead of signing with it', () => {
        const dir = path.join(tmp, SPOOL_DIR);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, '.key'), Buffer.alloc(7, 1), { mode: 0o600 });
        const env = readEnvelope('signed with what?');
        expect(spoolResult(env, { mode: 'protect', placeholder: env, counts: [], refused: [] }, ['tool_response'], tmp, READ_TEXT)).toEqual({
            action: 'skip',
            reason: 'store-error',
        });
        expect(spoolFiles()).toEqual([]);
    });
});

describe('concurrent writers, readers and cleanup', () => {
    it.each([
        ['a cap that fits every write', 10_000_000],
        ['a cap smaller than the writes', 60_000],
    ])('%s: no read is partial or corrupted, the cap holds, and nothing survivable is lost', async (_label, cap) => {
        const tsx = path.resolve(__dirname, '../../node_modules/.bin/tsx');
        const mod = path.resolve(__dirname, '../../src/scripts/_lib/tool_output_spool.ts');
        const child = (id: number): Promise<string[]> =>
            new Promise((resolve, reject) => {
                const code = `import { storeBytes } from ${JSON.stringify(mod)};
for (let i = 0; i < 40; i++) console.log(storeBytes(${JSON.stringify(tmp)}, Buffer.alloc(2000 + i, ${id} * 40 + i), 'w${id}').handle);`;
                const p = spawn(tsx, ['--eval', code], { stdio: ['ignore', 'pipe', 'pipe'] });
                let out = '';
                p.stdout.on('data', (d: Buffer) => (out += d.toString()));
                p.on('error', reject);
                p.on('close', (c) => (c === 0 ? resolve(out.trim().split('\n').map((l) => `w${id} ${l}`)) : reject(new Error(`writer ${id} exited ${String(c)}`))));
            });
        const writers = [0, 1, 2, 3].map(child);
        let cleanups = 0;
        const sweep = setInterval(() => {
            cleanupSpool(tmp, Date.now(), cap);
            cleanups += 1;
        }, 5);
        const handles = (await Promise.all(writers)).flat();
        clearInterval(sweep);
        const listing = fs.readdirSync(path.join(tmp, SPOOL_DIR)).sort().join(' ');
        expect(cleanups, 'no cleanup ran while writers wrote').toBeGreaterThan(0);
        const states = handles.map((line) => {
            const [session, handle] = line.split(' ') as [string, string];
            return readHandle(tmp, handle, session).state;
        });
        const tally = JSON.stringify(states.reduce<Record<string, number>>((m, st) => ({ ...m, [st]: (m[st] ?? 0) + 1 }), {}));
        expect(states.every((st) => st === 'ok' || st === 'missing'), tally).toBe(true);
        // With room for everything, a concurrent cleanup must not delete a single entry.
        if (cap === 10_000_000) expect(states.filter((st) => st === 'ok').length, `${tally} | ${listing}`).toBe(handles.length);
        else expect(states.filter((st) => st === 'ok').length).toBeGreaterThan(0);
        cleanupSpool(tmp, Date.now(), cap);
        const dir = path.join(tmp, SPOOL_DIR);
        const total = fs.readdirSync(dir).filter((n) => /^[0-9a-f]{64}$/.test(n)).reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0);
        expect(total).toBeLessThanOrEqual(cap);
        expect(fs.readdirSync(dir).filter((n) => n.endsWith('.tmp'))).toEqual([]);
    }, 60_000);
});

describe('handle-reads-a-range', () => {
    it('handle-reads-a-range: a byte range returns exactly those stored bytes', () => {
        const bytes = Buffer.from('0123456789abcdef');
        const { handle } = storeBytes(tmp, bytes, S);
        expect(readHandle(tmp, handle, S, [4, 10])).toEqual({ state: 'ok', bytes: Buffer.from('456789') });
        expect(readHandle(tmp, handle, S, [0, 16]).bytes?.equals(bytes)).toBe(true);
        expect(readHandle(tmp, handle, S, [16, 16]).bytes?.length).toBe(0);
        expect(readHandle(tmp, handle, S).bytes?.equals(bytes)).toBe(true);
    });

    it('out-of-bounds and malformed ranges are refused, never clamped', () => {
        const { handle } = storeBytes(tmp, Buffer.from('short'), S);
        for (const r of [[0, 6], [-1, 2], [3, 2], [1.5, 3]] as const) expect(readHandle(tmp, handle, S, r)).toEqual({ state: 'range' });
    });

    it('missing, corrupted and forged handles each answer their own state; the file on disk is never the source', () => {
        const { handle, address } = storeBytes(tmp, Buffer.from('original bytes'), S);
        const file = path.join(tmp, SPOOL_DIR, address);
        fs.writeFileSync(file, 'tampered bytes');
        expect(readHandle(tmp, handle, S)).toEqual({ state: 'corrupted' });
        fs.rmSync(file);
        expect(readHandle(tmp, handle, S)).toEqual({ state: 'missing' });
        const [d, exp] = handle.split('.') as [string, string];
        expect(readHandle(tmp, `${d}.${String(Number(exp) + 1)}.${'0'.repeat(32)}`, S)).toEqual({ state: 'invalid' });
        expect(readHandle(tmp, '../../etc/passwd', S)).toEqual({ state: 'invalid' });
        const other = path.join(tmp, 'other-workspace');
        fs.mkdirSync(other);
        expect(readHandle(other, handle, S)).toEqual({ state: 'invalid' });
    });

    it('the existing report entry point reads a handle by range and names any other state', () => {
        const { handle } = storeBytes(tmp, Buffer.from('0123456789'), S);
        const out: (string | Uint8Array)[] = [];
        const err: string[] = [];
        const w = process.stdout.write.bind(process.stdout);
        const e = process.stderr.write.bind(process.stderr);
        process.stdout.write = ((c: string | Uint8Array) => (out.push(c), true)) as typeof process.stdout.write;
        process.stderr.write = ((c: string) => (err.push(String(c)), true)) as typeof process.stderr.write;
        const prev = process.env['AGENT_CONFIG_SESSION_ID'];
        process.env['AGENT_CONFIG_SESSION_ID'] = S;
        try {
            expect(reportMain(['--read-handle', handle, '--range', '2:5', '--workspace', tmp])).toBe(0);
            expect(reportMain(['--read-handle', handle, '--range', '2:50', '--workspace', tmp])).toBe(1);
            expect(reportMain(['--read-handle', handle, '--range', 'a-b', '--workspace', tmp])).toBe(2);
        } finally {
            process.stdout.write = w;
            process.stderr.write = e;
            if (prev === undefined) delete process.env['AGENT_CONFIG_SESSION_ID'];
            else process.env['AGENT_CONFIG_SESSION_ID'] = prev;
        }
        expect(Buffer.from(out[0] as Uint8Array).toString('utf8')).toBe('234');
        expect(err[0]).toBe('handle: range\n');
    });
});
