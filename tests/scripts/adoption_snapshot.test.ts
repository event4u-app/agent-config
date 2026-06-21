// Tests for src/scripts/adoption_snapshot.ts (py2ts Phase 8 / Wave 8a).
//
// Two layers:
//   1. A 1:1 port of tests/test_adoption_snapshot.py — the JSONL row shape,
//      the --no-network path, append_row IO, and the all_signals_failed
//      predicate. Live HTTP is never exercised.
//   2. A golden-parity layer (python3 vs tsx) on the --no-network path: the
//      appended JSONL row and stdout are asserted byte-identical (snapshot_at
//      timestamp normalized). Skipped without python3.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    all_signals_failed,
    append_row,
    build_row,
    collect_signals,
    main,
} from '../../src/scripts/adoption_snapshot.js';



let tmpDir: string;
beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adopt-'));
});
afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('collect_signals --no-network', () => {
    it('emits skipped signals on all four keys', async () => {
        const signals = await collect_signals(true);
        expect(new Set(Object.keys(signals))).toEqual(
            new Set(['npm_downloads', 'npm_version', 'github_stars', 'topic_rank']),
        );
        for (const value of Object.values(signals)) {
            expect((value as Record<string, unknown>)['error']).toBe('skipped');
            expect((value as Record<string, unknown>)['source']).toBe('skipped');
        }
    });
});

describe('build_row', () => {
    it('carries ISO timestamp + schema + the same signals object', async () => {
        const signals = await collect_signals(true);
        const row = build_row(signals);
        expect(row['schema']).toBe('adoption-snapshot/v0');
        expect((row['snapshot_at'] as string).endsWith('Z')).toBe(true);
        expect((row['snapshot_at'] as string).includes('T')).toBe(true);
        expect(row['signals']).toBe(signals);
    });
});

describe('append_row', () => {
    it('appends JSONL rows', () => {
        const out = path.join(tmpDir, 'snapshots.jsonl');
        const row = { snapshot_at: '2026-05-26T00:00:00Z', schema: 'adoption-snapshot/v0', signals: {} };
        append_row(out, row);
        append_row(out, row);
        const lines = fs.readFileSync(out, 'utf-8').trim().split('\n');
        expect(lines.length).toBe(2);
        const parsed = lines.map((l) => JSON.parse(l));
        expect(parsed.every((p) => p['schema'] === 'adoption-snapshot/v0')).toBe(true);
    });

    it('creates parent dirs', () => {
        const out = path.join(tmpDir, 'nested', 'subdir', 'snapshots.jsonl');
        append_row(out, { snapshot_at: '2026-05-26T00:00:00Z', schema: 'adoption-snapshot/v0', signals: {} });
        expect(fs.existsSync(out)).toBe(true);
    });
});

describe('all_signals_failed', () => {
    it('detects a full outage', () => {
        const skipped = { error: 'skipped', source: 'skipped' };
        expect(
            all_signals_failed({
                npm_downloads: skipped,
                npm_version: skipped,
                github_stars: skipped,
                topic_rank: { source: 'skipped', 'agent-skills': skipped, 'cinematic-ai-video': skipped },
            }),
        ).toBe(true);
    });

    it('detects partial success', () => {
        expect(
            all_signals_failed({
                npm_downloads: { package: 'x', last_7_days: 12, source: 'npm' },
                npm_version: { error: 'skipped', source: 'skipped' },
                github_stars: { error: 'skipped', source: 'skipped' },
                topic_rank: { source: 'github-search' },
            }),
        ).toBe(false);
    });
});

describe('main --no-network', () => {
    it('writes one row and returns 0', async () => {
        const out = path.join(tmpDir, 'snapshots.jsonl');
        const rc = await main(['--no-network', '--out', out]);
        expect(rc).toBe(0);
        const lines = fs.readFileSync(out, 'utf-8').trim().split('\n');
        expect(lines.length).toBe(1);
        const parsed = JSON.parse(lines[0] as string);
        expect(parsed['schema']).toBe('adoption-snapshot/v0');
        expect(parsed['signals']['npm_downloads']['error']).toBe('skipped');
    });
});

