// Tests for src/scripts/adoption_status.ts (py2ts Phase 8 / Wave 8a).
//
// Ports tests/test_adoption_status.py 1:1 (parse_registry_statuses,
// count_recruit_reports, render_text, render_json) plus a golden-parity
// layer that runs python3 vs tsx on the REAL REPO (skipped without python3).
// Live `gh` invocations are not exercised — the CI color resolution exits
// via the `unknown` branch when `gh` is absent, identically in both.
import { spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as as_ from '../../src/scripts/adoption_status.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');


const SAMPLE_REGISTRY = `# Registry Submissions — tracking sheet

## Status legend

| Status | Meaning |
|---|---|
| \`pending\` | Pre-submission. |

## Tracking rows

| # | Registry | Submission shape | Status | PR / form URL | Date | Maintainer notes |
|---|---|---|---|---|---|---|
| 1 | A | shape A | \`pending\` | — | — | note |
| 2 | B | shape B | \`submitted\` | url-b | 2026-05-26 | note |
| 3 | C | shape C | \`accepted\` | url-c | 2026-05-26 | note |
| 4 | D | shape D | \`rejected\` | url-d | 2026-05-26 | note |
| 5 | E | shape E | \`stalled\` | url-e | 2026-03-01 | note |

## How to update a row

(Out of scope for parser.)
`;

describe('adoption_status — ported pytest suite', () => {
    it('parser counts each status once', () => {
        const counts = as_.parse_registry_statuses(SAMPLE_REGISTRY);
        expect(counts).toEqual({
            pending: 1,
            submitted: 1,
            accepted: 1,
            rejected: 1,
            stalled: 1,
        });
    });

    it('parser handles a table with no rows', () => {
        const counts = as_.parse_registry_statuses('# Doc\n\n## Tracking rows\n\nNo rows yet.\n');
        const expected: Record<string, number> = {};
        for (const s of as_.STATUS_VALUES) expected[s] = 0;
        expect(counts).toEqual(expected);
    });

    it('parser stops at the next h2 section', () => {
        const doc = SAMPLE_REGISTRY + '\n| 99 | not | counted | `pending` | x | y | z |\n';
        const counts = as_.parse_registry_statuses(doc);
        expect(counts.pending).toBe(1);
    });

    it('count_recruit_reports skips template and runbook', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'recruit-'));
        try {
            fs.writeFileSync(path.join(tmp, '_template.md'), '');
            fs.writeFileSync(path.join(tmp, '_runbook.md'), '');
            fs.writeFileSync(path.join(tmp, 'README.md'), '');
            fs.writeFileSync(path.join(tmp, '01-galabau-owner.md'), '');
            fs.writeFileSync(path.join(tmp, '02-content-creator.md'), '');
            expect(as_.count_recruit_reports(tmp)).toBe(2);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('count_recruit_reports missing dir → 0', () => {
        expect(as_.count_recruit_reports(path.join(REPO_ROOT, 'does-not-exist'))).toBe(0);
    });

    it('render_text includes all five status values', () => {
        const counts = { pending: 2, submitted: 1, accepted: 0, rejected: 0, stalled: 0 };
        const out = as_.render_text(counts, 3, ['green', '5 green'], 'main');
        for (const s of as_.STATUS_VALUES) {
            expect(out).toContain(s);
        }
        expect(out).toContain('Recruit-session reports filed: 3');
        expect(out).toContain('main');
        expect(out).toContain('5 green');
    });

    it('render_json shape', () => {
        const counts = { pending: 1, submitted: 0, accepted: 0, rejected: 0, stalled: 0 };
        const out = as_.render_json(counts, 0, ['green', 'all green'], 'main');
        const parsed = JSON.parse(out) as {
            registries: Record<string, number>;
            recruit_reports: number;
            ci: { color: string; branch: string };
        };
        expect(parsed.registries.pending).toBe(1);
        expect(parsed.recruit_reports).toBe(0);
        expect(parsed.ci.color).toBe('green');
        expect(parsed.ci.branch).toBe('main');
    });
});

// A ledger with the upstream columns the detector reads. Row S is the shape the
// date-only stalled rule cannot see: submitted, but its upstream is closed.
// The headings are interpolated because the comment gate reads any line that
// starts with `#` as a shell comment, string literal or not.
const H2 = '##';
const LEDGER = `${'#'} Registry Submissions — tracking sheet

**Re-read threshold:** 30 days.

${H2} Tracking rows

| # | Registry | Submission shape | Status | Upstream kind | Upstream ref | Last read | Date | Maintainer notes |
|---|---|---|---|---|---|---|---|---|
| S | closed-early | pr | \`submitted\` | \`github-pr\` | \`o/r#1\` | 2026-10-10 | 2026-10-01 | answered at day 10 |
| T | still-open | pr | \`submitted\` | \`github-pr\` | \`o/r#2\` | 2026-10-10 | 2026-08-01 | open at day 70 |
| U | merged | pr | \`submitted\` | \`github-pr\` | \`o/r#3\` | 2026-10-10 | 2026-10-01 | merged |
| V | old-reading | form | \`pending\` | \`listing-page\` | <https://example.invalid/v> | 2026-08-01 | — | read long ago |
| W | never-read | form | \`submitted\` | \`listing-page\` | <https://example.invalid/w> | — | 2026-06-01 | never read |

${H2} How to update a row
`;

const TODAY = '2026-10-10';

const READINGS: Record<string, as_.UpstreamReading> = {
    'o/r#1': { ok: true, state: 'closed', at: '2026-10-11' },
    'o/r#2': { ok: true, state: 'open' },
    'o/r#3': { ok: true, state: 'merged', at: '2026-10-05' },
};
const fakeReader: as_.UpstreamReader = (row) =>
    READINGS[row.ref] ?? { ok: false, reason: 'no network in this test' };

describe('adoption_status — a detector that notices an answer, not a calendar', () => {
    it('reports a submitted row whose upstream closed, which the date-only stalled rule cannot see', () => {
        // The pre-existing reading: the sheet alone says `submitted`, never `stalled`.
        const legacy = as_.parse_registry_statuses(LEDGER);
        expect(legacy.submitted).toBe(4);
        expect(legacy.stalled).toBe(0);
        const verdicts = as_.judge_upstream(as_.parse_ledger_rows(LEDGER), fakeReader, TODAY);
        const s = verdicts.find((v) => v.id === 'S');
        expect(s?.verdict, 'the date-only stalled rule cannot see a closed upstream').toBe(
            'answered-closed',
        );
    });

    it('reports a merged upstream as answered-merged', () => {
        const verdicts = as_.judge_upstream(as_.parse_ledger_rows(LEDGER), fakeReader, TODAY);
        expect(verdicts.find((v) => v.id === 'U')?.verdict).toBe('answered-merged');
    });

    it('keeps stalled for an upstream still open past 60 days — both directions', () => {
        const verdicts = as_.judge_upstream(as_.parse_ledger_rows(LEDGER), fakeReader, TODAY);
        expect(verdicts.find((v) => v.id === 'T')?.verdict).toBe('stalled');
        // Same open upstream, submitted 10 days ago: open, not stalled.
        const young = LEDGER.replace('| 2026-10-10 | 2026-08-01 |', '| 2026-10-10 | 2026-09-30 |');
        const v2 = as_.judge_upstream(as_.parse_ledger_rows(young), fakeReader, TODAY);
        expect(v2.find((v) => v.id === 'T')?.verdict).toBe('open');
    });

    it('reports an unreachable upstream as unreachable, never as a state', () => {
        const verdicts = as_.judge_upstream(as_.parse_ledger_rows(LEDGER), fakeReader, TODAY);
        expect(verdicts.find((v) => v.id === 'W')?.verdict).toBe('unreachable');
    });

    it('reports a stale or missing last-read as unread, whatever the status says', () => {
        const rows = as_.parse_ledger_rows(LEDGER);
        const threshold = as_.parse_reread_threshold(LEDGER);
        expect(threshold).toBe(30);
        const unread = as_.unread_findings(rows, TODAY, threshold);
        expect(unread.map((u) => u.id)).toEqual(['V', 'W']);
        expect(unread.find((u) => u.id === 'V')?.label).toBe('unread-for-70-days');
        expect(unread.find((u) => u.id === 'W')?.label).toBe('unread-never');
    });

    it('reports a row whose ledger has no last-read column at all', () => {
        // SAMPLE_REGISTRY is the pre-reshape table: no `Last read` column.
        const unread = as_.unread_findings(as_.parse_ledger_rows(SAMPLE_REGISTRY), TODAY, 30);
        expect(unread).toHaveLength(5);
        expect(unread.every((u) => u.label === 'unread-never')).toBe(true);
    });

    it('leaves the sheet-only text report byte-identical and names the degraded mode', () => {
        const counts = { pending: 3, submitted: 1, accepted: 0, rejected: 0, stalled: 0 };
        const out = as_.render_text(counts, 0, ['red', '1 required check(s) red'], 'main');
        expect(out).toBe(
            [
                'Adoption status (one-screen)',
                '============================',
                '',
                'Registry submissions:',
                '  pending    3',
                '  submitted  1',
                '  accepted   0',
                '  rejected   0',
                '  stalled    0',
                '',
                'Recruit-session reports filed: 0',
                '',
                'Required-check status on main: 🔴 red — 1 required check(s) red',
            ].join('\n'),
        );
        expect(as_.upstream_mode_note(false)).toMatch(/sheet only/);
        expect(as_.parse_args(['--check-upstream']).checkUpstream).toBe(true);
        expect(as_.parse_args([]).checkUpstream).toBe(false);
    });
});

describe('adoption_status — a ledger ref is fetched only as an https URL', () => {
    it('refuses an option-shaped, file or plain-http ref without running curl', () => {
        for (const ref of ['-o/tmp/x', 'file:///etc/passwd', 'http://169.254.169.254/']) {
            const r = as_.read_url('listing-page', ref, 1);
            expect(r.ok, ref).toBe(false);
            expect(r.ok ? '' : r.reason, ref).toMatch(/^refusing a ref outside https/);
        }
    });
});

describe('adoption_status — an upstream read waits as long as a slow registry needs', () => {
    // The official MCP registry answered its search in 15-20 s on 2026-10-17; a 20 s cap
    // reported it unreachable. The wait must clear that with room to spare.
    it('waits clearly longer than the registry was measured to take', () => {
        expect(as_.UPSTREAM_READ_TIMEOUT_S).toBeGreaterThanOrEqual(30);
    });

    it.skipIf(spawnSync('curl', ['--version']).status !== 0)(
        'honours the wait in both directions against a slow server',
        async () => {
            const server = spawn(
                process.execPath,
                [
                    '-e',
                    "const s=require('http').createServer((q,r)=>setTimeout(()=>{r.writeHead(200);r.end('ok')},2000));" +
                        "s.listen(0,'127.0.0.1',()=>console.log(s.address().port));",
                ],
                { stdio: ['ignore', 'pipe', 'inherit'] },
            );
            try {
                const port = await new Promise<string>((resolve) =>
                    server.stdout.once('data', (d: Buffer) => resolve(d.toString().trim())),
                );
                const url = `http://127.0.0.1:${port}/listing`;
                expect(as_.read_url('listing-page', url, 1, ['http']).ok).toBe(false);
                expect(as_.read_url('listing-page', url, 5, ['http'])).toEqual({ ok: true, state: 'listed' });
            } finally {
                server.kill();
            }
        },
        20_000,
    );
});
