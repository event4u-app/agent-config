// Tests for src/scripts/ai_council/probe_store.ts
// (road-to-release-review-p0 Phase 3).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    probeFor,
    probeStorePath,
    readProbeStore,
    recordProbe,
    recordProbes,
} from '../../../src/scripts/ai_council/probe_store.js';

let root: string;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-store-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

function writeRaw(contents: string): void {
    const target = probeStorePath(root);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents, 'utf8');
}

describe('readProbeStore — the tolerant reader', () => {
    it('a missing store is empty, not an error', () => {
        expect(readProbeStore(root)).toEqual({ schema: 1, members: {} });
    });

    it('unparseable JSON is empty, not a throw', () => {
        writeRaw('{ this is not json');
        expect(readProbeStore(root).members).toEqual({});
    });

    it('a wrong schema version is empty', () => {
        writeRaw(JSON.stringify({ schema: 99, members: { a: { at: '2026-08-16', outcome: 'ok' } } }));
        expect(readProbeStore(root).members).toEqual({});
    });

    it('a non-object payload is empty', () => {
        writeRaw('[]');
        expect(readProbeStore(root).members).toEqual({});
    });

    // The property that matters: one bad row must not blank the others, or a
    // single corrupt entry would silently downgrade every healthy seat to
    // `unknown` with no way to tell that cause from "never observed".
    it('one malformed member entry is dropped and the rest survive', () => {
        writeRaw(
            JSON.stringify({
                schema: 1,
                members: {
                    good: { at: '2026-08-16', outcome: 'ok' },
                    missingAt: { outcome: 'ok' },
                    emptyOutcome: { at: '2026-08-16', outcome: '' },
                    notAnObject: 7,
                },
            }),
        );
        const store = readProbeStore(root);
        expect(Object.keys(store.members)).toEqual(['good']);
        expect(probeFor(store, 'good')).toEqual({ at: '2026-08-16', outcome: 'ok' });
    });
});

describe('recordProbe / recordProbes', () => {
    it('round-trips a single record', () => {
        recordProbe(root, 'anthropic', 'ok', '2026-08-17');
        expect(probeFor(readProbeStore(root), 'anthropic')).toEqual({ at: '2026-08-17', outcome: 'ok' });
    });

    it('creates the runtime directory when it does not exist', () => {
        expect(fs.existsSync(path.dirname(probeStorePath(root)))).toBe(false);
        recordProbe(root, 'openai', 'ok', '2026-08-17');
        expect(fs.existsSync(probeStorePath(root))).toBe(true);
    });

    it('merges rather than replacing — an untouched seat keeps its record', () => {
        recordProbe(root, 'anthropic', 'ok', '2026-08-16');
        recordProbe(root, 'openai', 'quota_exhausted', '2026-08-17');
        const store = readProbeStore(root);
        expect(probeFor(store, 'anthropic')).toEqual({ at: '2026-08-16', outcome: 'ok' });
        expect(probeFor(store, 'openai')).toEqual({ at: '2026-08-17', outcome: 'quota_exhausted' });
    });

    it('a later record for the same seat overwrites the earlier one', () => {
        recordProbe(root, 'anthropic', 'timeout', '2026-08-16');
        recordProbe(root, 'anthropic', 'ok', '2026-08-17');
        expect(probeFor(readProbeStore(root), 'anthropic')).toEqual({ at: '2026-08-17', outcome: 'ok' });
    });

    it('a batch write is one operation over many seats', () => {
        recordProbes(root, [
            { name: 'a', outcome: 'ok', at: '2026-08-17' },
            { name: 'b', outcome: 'auth_rejected', at: '2026-08-17' },
        ]);
        expect(Object.keys(readProbeStore(root).members).sort()).toEqual(['a', 'b']);
    });

    it('an empty batch writes nothing at all', () => {
        recordProbes(root, []);
        expect(fs.existsSync(probeStorePath(root))).toBe(false);
    });

    // Best-effort by construction: telemetry that can break a council run is
    // worse than telemetry that misses a row.
    it('a write into an unwritable location is swallowed, never thrown', () => {
        const bogus = path.join(root, 'not-a-dir');
        fs.writeFileSync(bogus, 'i am a file');
        expect(() => {
            recordProbe(path.join(bogus, 'nested'), 'anthropic', 'ok', '2026-08-17');
        }).not.toThrow();
    });

    it('probeFor returns null for a seat nobody has observed', () => {
        expect(probeFor(readProbeStore(root), 'never-seen')).toBeNull();
    });
});

describe('recordProbes — the event-log kill switch', () => {
    const ENV = 'AGENT_CONFIG_NO_EVENTS_LOG';
    let saved: string | undefined;

    beforeEach(() => {
        saved = process.env[ENV];
    });

    afterEach(() => {
        if (saved === undefined) delete process.env[ENV];
        else process.env[ENV] = saved;
    });

    // Measured on this branch: without the switch, the council suite's
    // `cmd_run` paths wrote a real store into the worktree, which is exactly
    // what the read-only witness fails on when sharding co-locates them.
    it('writes nothing when the switch is armed', () => {
        process.env[ENV] = '1';
        recordProbe(root, 'anthropic', 'ok', '2026-08-17');
        expect(fs.existsSync(probeStorePath(root))).toBe(false);
    });

    it('the string "false" disarms it — a string is not a boolean', () => {
        process.env[ENV] = 'false';
        recordProbe(root, 'anthropic', 'ok', '2026-08-17');
        expect(fs.existsSync(probeStorePath(root))).toBe(true);
    });

    it('reading is never suppressed — only writing is', () => {
        recordProbe(root, 'anthropic', 'ok', '2026-08-17');
        process.env[ENV] = '1';
        expect(probeFor(readProbeStore(root), 'anthropic')).toEqual({ at: '2026-08-17', outcome: 'ok' });
    });
});
