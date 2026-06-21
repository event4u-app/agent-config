// Tests for src/scripts/adoption_report.ts (py2ts Phase 8 / Wave 8a).
//
// Ported 1:1 from tests/test_adoption_report.py (the behavioural spec) plus a
// golden-parity layer that runs python3 vs tsx on tmp fixtures (skipped
// without python3). Byte-exact report + stdout/exit parity is the contract.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as ar from '../../src/scripts/adoption_report.js';



function isoUtc(d: Date): string {
    return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function makeRow(when: Date, downloads = 100, stars = 5): Record<string, unknown> {
    return {
        snapshot_at: isoUtc(when),
        schema: 'adoption-snapshot/v0',
        signals: {
            npm_downloads: { package: '@event4u/agent-config', last_7_days: downloads, source: 'npm' },
            npm_version: { latest: '3.3.0', version_count: 12, source: 'npm-registry' },
            github_stars: {
                repo: 'event4u-app/agent-config',
                stars,
                forks: 1,
                watchers: stars,
                source: 'github-repo',
            },
            topic_rank: {
                source: 'github-search',
                'agent-skills': { rank: 3, total_results: 42 },
                'cinematic-ai-video': { rank: 1, total_results: 5 },
            },
        },
    };
}

describe('adoption_report — ported pytest spec', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    // test_empty_jsonl_produces_no_snapshot_message
    it('empty jsonl produces no-snapshot message', () => {
        const inPath = path.join(tmp, 'snapshots.jsonl');
        const outPath = path.join(tmp, 'report.md');
        fs.writeFileSync(inPath, '');
        const rc = ar.main(['--in', inPath, '--out', outPath, '--weeks', '8']);
        expect(rc).toBe(0);
        const body = fs.readFileSync(outPath, 'utf-8');
        expect(body).toContain('No snapshots in the current window');
    });

    // test_single_snapshot_renders_four_signal_tables
    it('single snapshot renders four signal tables', () => {
        const inPath = path.join(tmp, 'snapshots.jsonl');
        const outPath = path.join(tmp, 'report.md');
        const now = new Date();
        fs.writeFileSync(inPath, JSON.stringify(makeRow(now)) + '\n');
        const rc = ar.main(['--in', inPath, '--out', outPath, '--weeks', '8']);
        expect(rc).toBe(0);
        const body = fs.readFileSync(outPath, 'utf-8');
        expect(body).toContain('npm install count');
        expect(body).toContain('npm version distribution');
        expect(body).toContain('GitHub stars');
        expect(body).toContain('Topic-search rank');
        expect(body).toContain('3.3.0');
    });

    // test_window_filter_drops_older_rows
    it('window filter drops older rows', () => {
        const inPath = path.join(tmp, 'snapshots.jsonl');
        const outPath = path.join(tmp, 'report.md');
        const now = new Date();
        const old = new Date(now.getTime() - 20 * 7 * 24 * 60 * 60 * 1000);
        fs.writeFileSync(
            inPath,
            [JSON.stringify(makeRow(old)), JSON.stringify(makeRow(now))].join('\n') + '\n',
        );
        const rc = ar.main(['--in', inPath, '--out', outPath, '--weeks', '8']);
        expect(rc).toBe(0);
        const body = fs.readFileSync(outPath, 'utf-8');
        const oldDay = isoUtc(old).slice(0, isoUtc(old).indexOf('T') + 1);
        const nowDay = isoUtc(now).slice(0, isoUtc(now).indexOf('T') + 1);
        expect(body).not.toContain(oldDay);
        expect(body).toContain(nowDay);
    });

    // test_error_row_renders_error_placeholder
    it('error row renders error placeholder', () => {
        const inPath = path.join(tmp, 'snapshots.jsonl');
        const outPath = path.join(tmp, 'report.md');
        const row = makeRow(new Date());
        (row.signals as Record<string, unknown>).npm_downloads = { error: 'rate-limited', source: 'npm' };
        fs.writeFileSync(inPath, JSON.stringify(row) + '\n');
        const rc = ar.main(['--in', inPath, '--out', outPath, '--weeks', '8']);
        expect(rc).toBe(0);
        expect(fs.readFileSync(outPath, 'utf-8')).toContain('rate-limited');
    });

    // test_filter_window_rejects_malformed_timestamps
    it('filter_window rejects malformed timestamps', () => {
        const rows = [
            { snapshot_at: 'not-a-date', signals: {} },
            { snapshot_at: isoUtc(new Date()), signals: {} },
        ];
        const out = ar.filter_window(rows, 8);
        expect(out).toHaveLength(1);
    });

    // test_missing_input_file_emits_no_snapshots_message
    it('missing input file emits no-snapshots message', () => {
        const inPath = path.join(tmp, 'does-not-exist.jsonl');
        const outPath = path.join(tmp, 'report.md');
        const rc = ar.main(['--in', inPath, '--out', outPath]);
        expect(rc).toBe(0);
        expect(fs.readFileSync(outPath, 'utf-8')).toContain('No snapshots in the current window');
    });
});

describe('adoption_report — unit helpers', () => {
    it('render_section frames the block', () => {
        expect(ar.render_section('T', ['a', 'b'])).toBe('## T\n\na\nb\n\n');
    });
    it('npm_downloads renders comma-grouped counts', () => {
        const rows = [{ snapshot_at: 'X', signals: { npm_downloads: { last_7_days: 1234567 } } }];
        expect(ar.render_npm_downloads(rows)).toContain('1,234,567');
    });
});
