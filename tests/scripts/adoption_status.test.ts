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

// One row per action verdict, plus the quiet neighbour of each. The ledger is
// read through a fake reader, so no row here touches the network.
const ACTION_LEDGER = `${'#'} Registry Submissions — tracking sheet

${H2} Tracking rows

| # | Registry | Submission shape | Status | Upstream kind | Upstream ref | Last read | Date | Maintainer notes |
|---|---|---|---|---|---|---|---|---|
| A | sheet-behind-closed | pr | \`submitted\` | \`github-pr\` | \`o/r#10\` | 2026-10-10 | 2026-08-01 | closed, sheet never told |
| B | sheet-behind-pending | pr | \`pending\` | \`github-pr\` | \`o/r#11\` | 2026-10-10 | — | merged, sheet says pending |
| C | rejected-closed | pr | \`rejected\` | \`github-pr\` | \`o/r#10\` | 2026-10-10 | 2026-08-01 | the sheet already knows |
| D | changes-requested | pr | \`submitted\` | \`github-pr\` | \`o/r#12\` | 2026-10-10 | 2026-10-01 | review asks for changes |
| E | open-plain | pr | \`submitted\` | \`github-pr\` | \`o/r#13\` | 2026-10-10 | 2026-10-01 | open, nothing asked |
| F | listing-lost | form | \`accepted\` | \`listing-page\` | <https://example.invalid/gone> | 2026-10-10 | 2026-06 | page vanished |
| G | listing-live | form | \`accepted\` | \`listing-page\` | <https://example.invalid/here> | 2026-10-10 | 2026-06 | page live |
| H | registry-stale | publish | \`accepted\` | \`registry-query\` | <https://example.invalid/reg-old> | 2026-10-10 | 2026-06 | old version latest |
| I | registry-current | publish | \`accepted\` | \`registry-query\` | <https://example.invalid/reg-new> | 2026-10-10 | 2026-06 | current version latest |
| J | unreadable-accepted | form | \`accepted\` | \`listing-page\` | <https://example.invalid/down> | 2026-10-10 | 2026-06 | network down |

${H2} How to update a row
`;

const RELEASED: as_.ReleasedServer = { name: 'io.github.o/srv', version: '17.2.1' };

const ACTION_READINGS: Record<string, as_.UpstreamReading> = {
    'o/r#10': { ok: true, state: 'closed', at: '2026-09-07' },
    'o/r#11': { ok: true, state: 'merged', at: '2026-10-05' },
    'o/r#12': { ok: true, state: 'open', reviewDecision: 'CHANGES_REQUESTED' },
    'o/r#13': { ok: true, state: 'open', reviewDecision: 'REVIEW_REQUIRED' },
    'https://example.invalid/gone': { ok: true, state: 'not-listed' },
    'https://example.invalid/here': { ok: true, state: 'listed' },
    'https://example.invalid/reg-old': { ok: true, state: 'listed', latestVersions: { 'io.github.o/srv': '17.1.0' } },
    'https://example.invalid/reg-new': { ok: true, state: 'listed', latestVersions: { 'io.github.o/srv': '17.2.1' } },
};
const actionReader: as_.UpstreamReader = (row) =>
    ACTION_READINGS[row.ref] ?? { ok: false, reason: 'no network in this test' };

function judgeActions(ledger: string = ACTION_LEDGER): Map<string, as_.RowVerdict> {
    const verdicts = as_.judge_upstream(as_.parse_ledger_rows(ledger), actionReader, TODAY, RELEASED);
    return new Map(verdicts.map((v) => [v.id, v]));
}

describe('adoption_status — a submission is done only once it is live', () => {
    it('reports sheet-behind for a submitted or pending row whose upstream answered, keeping the verdict', () => {
        const v = judgeActions();
        expect(v.get('A')).toMatchObject({ verdict: 'answered-closed', action: 'sheet-behind' });
        expect(v.get('A')?.next).toMatch(/^update the ledger row/);
        expect(v.get('B')).toMatchObject({ verdict: 'answered-merged', action: 'sheet-behind' });
    });

    it('reports sheet-behind for a pending row whose listing went live (row 4 after its first CI publish)', () => {
        const ledger = ACTION_LEDGER.replace(
            /\| A \|[^\n]*\n/,
            '| K | registry-first-publish | publish | `pending` | `registry-query` | <https://example.invalid/reg-new> | 2026-10-10 | — | first CI publish |\n',
        );
        const v = judgeActions(ledger);
        expect(v.get('K')).toMatchObject({ verdict: 'listed', action: 'sheet-behind' });
        expect(v.get('K')?.next).toMatch(/listing reads listed while the sheet says pending/);
        expect(v.get('I')?.action).toBeUndefined();
    });

    it('reports needs-response for an open pull request with changes requested, and only then', () => {
        const v = judgeActions();
        expect(v.get('D')).toMatchObject({ verdict: 'open', action: 'needs-response' });
        expect(v.get('D')?.next).toBe('answer the review on o/r#12');
        expect(v.get('E')?.action).toBeUndefined();
    });

    it('reports listing-lost for an accepted listing that now reads not-listed', () => {
        const v = judgeActions();
        expect(v.get('F')).toMatchObject({ verdict: 'not-listed', action: 'listing-lost' });
        expect(v.get('F')?.next).toMatch(/^re-check or re-submit the listing/);
        expect(v.get('G')?.action).toBeUndefined();
    });

    it('reports listing-stale when the registry latest lags package.json, quiet when it matches', () => {
        const v = judgeActions();
        expect(v.get('H')).toMatchObject({ verdict: 'listed', action: 'listing-stale' });
        expect(v.get('H')?.next).toContain('17.2.1');
        expect(v.get('H')?.next).toContain('17.1.0');
        expect(v.get('I')?.action).toBeUndefined();
    });

    it('stays quiet for a row whose sheet already records the end, and for an unreadable upstream', () => {
        const v = judgeActions();
        expect(v.get('C')).toMatchObject({ verdict: 'answered-closed' });
        expect(v.get('C')?.action).toBeUndefined();
        expect(v.get('J')).toMatchObject({ verdict: 'unreachable' });
        expect(v.get('J')?.action).toBeUndefined();
    });

    it('keeps the JSON row shape for a quiet row: no action or next key, not even null', () => {
        const v = judgeActions();
        expect(Object.keys(v.get('E') as object).sort()).toEqual(['detail', 'id', 'registry', 'verdict']);
    });

    it('--fail-on-action exits 2 with an action and 0 without, naming the row and the next act', () => {
        const verdicts = [...judgeActions().values()];
        expect(as_.upstream_exit_code(verdicts, true)).toBe(2);
        expect(as_.upstream_exit_code(verdicts, false)).toBe(0);
        const quiet = verdicts.filter((x) => x.action === undefined);
        expect(quiet.length).toBeGreaterThan(0);
        expect(as_.upstream_exit_code(quiet, true)).toBe(0);
        expect(as_.action_lines(verdicts)).toContain(
            'row D needs-response (changes-requested) — answer the review on o/r#12',
        );
        expect(as_.parse_args(['--check-upstream', '--fail-on-action']).failOnAction).toBe(true);
        expect(as_.parse_args(['--check-upstream']).failOnAction).toBe(false);
    });

    it('prints an actions section only when an action exists', () => {
        const verdicts = [...judgeActions().values()];
        expect(as_.render_upstream_text(verdicts, [])).toContain('Actions needed');
        const quiet = verdicts.filter((x) => x.action === undefined);
        expect(as_.render_upstream_text(quiet, [])).not.toContain('Actions needed');
    });
});

describe('adoption_status — reading the registry answer', () => {
    const entry = (name: string, version: string, isLatest: boolean): unknown => ({
        server: { name, version },
        _meta: { 'io.modelcontextprotocol.registry/official': { isLatest } },
    });

    it('takes the version flagged isLatest, not the last or highest listed', () => {
        const body = JSON.stringify({
            servers: [entry('io.github.o/srv', '17.2.1', false), entry('io.github.o/srv', '17.1.0', true)],
            metadata: { count: 2 },
        });
        expect(as_.read_registry_answer(body, 'ref')).toEqual({
            ok: true,
            state: 'listed',
            latestVersions: { 'io.github.o/srv': '17.1.0' },
        });
    });

    it('reads a zero count as not-listed', () => {
        expect(as_.read_registry_answer('{"servers":[],"metadata":{"count":0}}', 'ref')).toEqual({
            ok: true,
            state: 'not-listed',
        });
    });

    it('carries no version map when no entry is flagged, so a shape change cannot fake a lost listing', () => {
        const body = JSON.stringify({ servers: [{ server: { name: 'io.github.o/srv', version: '1.0.0' } }], metadata: { count: 1 } });
        const r = as_.read_registry_answer(body, 'ref');
        expect(r).toEqual({ ok: true, state: 'listed' });
        const row: as_.LedgerRow = {
            id: 'R', registry: 'reg', status: 'accepted', kind: 'registry-query', ref: 'https://x.invalid', lastRead: '', date: '',
        };
        expect(as_.judge_upstream([row], () => r, TODAY, RELEASED)[0]?.action).toBeUndefined();
    });

    it('reports listing-lost when the registry answer carries other servers but not this one', () => {
        const r = as_.read_registry_answer(
            JSON.stringify({ servers: [entry('io.github.o/other', '1.0.0', true)], metadata: { count: 1 } }),
            'ref',
        );
        const row: as_.LedgerRow = {
            id: 'R', registry: 'reg', status: 'accepted', kind: 'registry-query', ref: 'https://x.invalid', lastRead: '', date: '',
        };
        expect(as_.judge_upstream([row], () => r, TODAY, RELEASED)[0]?.action).toBe('listing-lost');
    });
});
