/**
 * The tool-result store (road-to-tool-results-that-leave-a-handle Phase 2).
 *
 * Four properties, one block each, named by the roadmap's verify lines:
 * equal results share one entry and the stage is the writer; nothing that
 * differs from what was delivered, and no credential, rests on disk; an expired
 * handle says so after its entry is gone; a handle returns exactly the bytes it
 * names, and every other state answers as itself.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    cleanupSpool,
    readHandle,
    SPOOL_DIR,
    SPOOL_OBSERVATION_FILE,
    SPOOL_RETENTION_MS,
    SPOOL_SELECTED_CLASSES,
    spoolResult,
    type SpoolStageView,
    storeBytes,
} from '../../src/scripts/_lib/tool_output_spool.js';
import { loadEgressEngine } from '../../src/scripts/hooks/egress_engine_loader.js';
import { type EgressMode, runEgressStage } from '../../src/scripts/hooks/egress_stage.js';
import type { JsonObject } from '../../src/scripts/hooks/payload_stub.js';
import { main as reportMain } from '../../src/scripts/report_reducible_classes.js';

const ALNUM = 'Ab3Cd5Ef7Gh9Jk2Lm4Np6Qr8St1Uv3Wx5Yz7';
/** A GitHub-PAT-shaped credential, assembled so no credential literal sits in this file. */
const PLANTED = ['ghp', ALNUM.slice(0, 36)].join('_');
const READ_TEXT = new Set(['Read:text'] as const);

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
    it('spool-write-is-content-addressed: equal outputs share one file named by their sha256', () => {
        const body = 'line one\nline two\n'.repeat(400);
        const r1 = runEgressStage(readEnvelope(body), fixed('protect'), engineSelecting);
        const r2 = runEgressStage(readEnvelope(body, 's2'), fixed('protect'), engineSelecting);
        expect(r1.mode).toBe('protect');
        expect(r2.mode).toBe('protect');
        const files = spoolFiles();
        expect(files).toHaveLength(1);
        const stored = fs.readFileSync(path.join(tmp, SPOOL_DIR, files[0] as string));
        expect(createHash('sha256').update(stored).digest('hex')).toBe(files[0]);
        expect(JSON.parse(stored.toString('utf8'))).toEqual({ type: 'text', file: { content: body } });
        runEgressStage(readEnvelope(`${body}changed`), fixed('protect'), engineSelecting);
        expect(spoolFiles()).toHaveLength(2);
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
    });

    it('the shipped selection is empty, so the stage stores nothing in any mode', () => {
        expect(SPOOL_SELECTED_CLASSES.size).toBe(0);
        for (const m of ['observe', 'protect', 'strict'] as const) runEgressStage(readEnvelope('x'.repeat(9000)), fixed(m));
        expect(spoolFiles()).toHaveLength(0);
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
        const { handle, digest } = storeBytes(tmp, Buffer.from('kept for a week'), t0);
        expect(readHandle(tmp, handle, undefined, t0 + 1000).state).toBe('ok');
        const later = t0 + SPOOL_RETENTION_MS + 1000;
        expect(readHandle(tmp, handle, undefined, later)).toEqual({ state: 'expired' });
        const file = path.join(tmp, SPOOL_DIR, digest);
        fs.utimesSync(file, new Date(t0), new Date(t0));
        expect(cleanupSpool(tmp, later).removed).toBe(1);
        expect(fs.existsSync(file)).toBe(false);
        expect(readHandle(tmp, handle, undefined, later)).toEqual({ state: 'expired' });
    });

    it('past the byte cap the oldest entries go first, and a valid handle to one says missing', () => {
        const now = Date.now();
        const a = storeBytes(tmp, Buffer.alloc(100, 1), now);
        const b = storeBytes(tmp, Buffer.alloc(100, 2), now);
        fs.utimesSync(path.join(tmp, SPOOL_DIR, a.digest), new Date(now - 5000), new Date(now - 5000));
        expect(cleanupSpool(tmp, now, 150).removed).toBe(1);
        expect(readHandle(tmp, a.handle, undefined, now)).toEqual({ state: 'missing' });
        expect(readHandle(tmp, b.handle, undefined, now).state).toBe('ok');
    });

    it('a cleanup lock held by another process skips; a stale one is taken over', () => {
        const now = Date.now();
        const old = storeBytes(tmp, Buffer.from('old'), now - SPOOL_RETENTION_MS - 5000);
        fs.utimesSync(path.join(tmp, SPOOL_DIR, old.digest), new Date(now - SPOOL_RETENTION_MS - 5000), new Date(now - SPOOL_RETENTION_MS - 5000));
        const lock = path.join(tmp, SPOOL_DIR, '.cleanup.lock');
        fs.writeFileSync(lock, '1');
        expect(cleanupSpool(tmp, now).removed).toBe(0);
        fs.utimesSync(lock, new Date(now - 11 * 60 * 1000), new Date(now - 11 * 60 * 1000));
        expect(cleanupSpool(tmp, now).removed).toBe(1);
        expect(fs.existsSync(lock)).toBe(false);
    });
});

describe('handle-reads-a-range', () => {
    it('handle-reads-a-range: a byte range returns exactly those stored bytes', () => {
        const bytes = Buffer.from('0123456789abcdef');
        const { handle } = storeBytes(tmp, bytes);
        expect(readHandle(tmp, handle, [4, 10])).toEqual({ state: 'ok', bytes: Buffer.from('456789') });
        expect(readHandle(tmp, handle, [0, 16]).bytes?.equals(bytes)).toBe(true);
        expect(readHandle(tmp, handle, [16, 16]).bytes?.length).toBe(0);
        expect(readHandle(tmp, handle).bytes?.equals(bytes)).toBe(true);
    });

    it('out-of-bounds and malformed ranges are refused, never clamped', () => {
        const { handle } = storeBytes(tmp, Buffer.from('short'));
        for (const r of [[0, 6], [-1, 2], [3, 2], [1.5, 3]] as const) expect(readHandle(tmp, handle, r)).toEqual({ state: 'range' });
    });

    it('missing, corrupted and forged handles each answer their own state; the file on disk is never the source', () => {
        const { handle, digest } = storeBytes(tmp, Buffer.from('original bytes'));
        const file = path.join(tmp, SPOOL_DIR, digest);
        fs.writeFileSync(file, 'tampered bytes');
        expect(readHandle(tmp, handle)).toEqual({ state: 'corrupted' });
        fs.rmSync(file);
        expect(readHandle(tmp, handle)).toEqual({ state: 'missing' });
        const [d, exp] = handle.split('.') as [string, string];
        expect(readHandle(tmp, `${d}.${String(Number(exp) + 1)}.${'0'.repeat(32)}`)).toEqual({ state: 'invalid' });
        expect(readHandle(tmp, '../../etc/passwd')).toEqual({ state: 'invalid' });
        const other = path.join(tmp, 'other-workspace');
        fs.mkdirSync(other);
        expect(readHandle(other, handle)).toEqual({ state: 'invalid' });
    });

    it('the existing report entry point reads a handle by range and names any other state', () => {
        const { handle } = storeBytes(tmp, Buffer.from('0123456789'));
        const out: (string | Uint8Array)[] = [];
        const err: string[] = [];
        const w = process.stdout.write.bind(process.stdout);
        const e = process.stderr.write.bind(process.stderr);
        process.stdout.write = ((c: string | Uint8Array) => (out.push(c), true)) as typeof process.stdout.write;
        process.stderr.write = ((c: string) => (err.push(String(c)), true)) as typeof process.stderr.write;
        try {
            expect(reportMain(['--read-handle', handle, '--range', '2:5', '--workspace', tmp])).toBe(0);
            expect(reportMain(['--read-handle', handle, '--range', '2:50', '--workspace', tmp])).toBe(1);
            expect(reportMain(['--read-handle', handle, '--range', 'a-b', '--workspace', tmp])).toBe(2);
        } finally {
            process.stdout.write = w;
            process.stderr.write = e;
        }
        expect(Buffer.from(out[0] as Uint8Array).toString('utf8')).toBe('234');
        expect(err[0]).toBe('handle: range\n');
    });
});
