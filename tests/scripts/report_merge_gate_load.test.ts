import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { renderClearance } from '../../src/scripts/_lib/merge_clearance_record.js';
import { dayIn, main, median, offsetMinutes } from '../../src/scripts/report_merge_gate_load.js';

/**
 * The owner's load is a number only if the reader that produces it is
 * reproducible and counts what it claims to count. A fixture repository with
 * one commit per verdict, on known days, plus one dangerous clearance record.
 */

let root: string;
const shas: Record<string, string> = {};

function git(args: string[], env: Record<string, string> = {}): string {
    const r = spawnSync('git', ['-C', root, ...args], {
        encoding: 'utf8',
        env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t', ...env },
    });
    if (r.status !== 0) throw new Error(r.stderr);
    return r.stdout.trim();
}

function commit(name: string, file: string, when: string): void {
    const abs = path.join(root, file);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, `${name}\n`);
    git(['add', '-A']);
    git(['commit', '-q', '-m', `${name} (#${String(Object.keys(shas).length + 1)})`], {
        GIT_AUTHOR_DATE: when,
        GIT_COMMITTER_DATE: when,
    });
    shas[name] = git(['rev-parse', 'HEAD']);
}

beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-gate-load-'));
    git(['init', '-q', '-b', 'main']);
    commit('seed', 'README.md', '2026-09-01T10:00:00+02:00');
    commit('before', '.github/workflows/old.yml', '2026-09-06T23:59:00+02:00');
    commit('docs', 'docs/guide.md', '2026-09-08T10:00:00+02:00');
    commit('ci', '.github/workflows/build.yml', '2026-09-08T23:30:00+02:00');
    commit('gate', 'docs/decisions/ADR-282-auto-merge.md', '2026-09-09T01:30:00+02:00');
    fs.mkdirSync(path.join(root, 'src/config'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src/config/ratification-policy.json'), JSON.stringify({ required_providers: 2 }));
    fs.mkdirSync(path.join(root, 'agents/evidence/merge-clearances'), { recursive: true });
    fs.writeFileSync(
        path.join(root, 'agents/evidence/merge-clearances/pr-2-x.md'),
        renderClearance({
            pr: 2,
            head: 'a'.repeat(40),
            base: 'b'.repeat(40),
            classifierVerdict: 'needs-council',
            triggers: ['ci-workflow'],
            promptSha256: 'c'.repeat(64),
            seats: [
                { provider: 'anthropic', model: 'm', replySha256: 'd'.repeat(64), reading: 'clear' },
                { provider: 'openai', model: 'm', replySha256: 'e'.repeat(64), reading: 'dangerous' },
            ],
            outcome: 'dangerous',
        }),
    );
    fs.writeFileSync(
        path.join(root, 'agents/evidence/merge-clearances/pr-3-x.md'),
        renderClearance({
            pr: 3,
            head: 'f'.repeat(40),
            base: 'b'.repeat(40),
            classifierVerdict: 'needs-council',
            triggers: ['ci-workflow'],
            promptSha256: 'c'.repeat(64),
            seats: [
                { provider: 'anthropic', model: 'm', replySha256: 'd'.repeat(64), reading: 'clear' },
                { provider: 'openai', model: 'm', replySha256: 'e'.repeat(64), reading: 'owner-review' },
            ],
            outcome: 'not-cleared',
        }),
    );
    commit('record', 'agents/evidence/merge-clearances/README.txt', '2026-09-09T02:00:00+02:00');
});

afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

const args = (): string[] => [
    '--root', root, '--pin', shas['record'] as string, '--since', '2026-09-07T00:00:00+02:00',
    '--named', (shas['ci'] as string).slice(0, 9), '--named', 'deadbeef0',
];

function report(): string {
    const lines: string[] = [];
    expect(main(args(), (l) => lines.push(l))).toBe(0);
    return fs.readFileSync(path.join(root, 'agents/evidence/analysis/merge-gate-load-2026-10.md'), 'utf8');
}

describe('report_merge_gate_load', () => {
    it('cuts days in the offset --since names', () => {
        expect(offsetMinutes('2026-09-07T00:00:00+02:00')).toBe(120);
        expect(dayIn('2026-09-08T23:30:00+02:00', 120)).toBe('2026-09-08');
        expect(dayIn('2026-09-08T23:30:00+02:00', 0)).toBe('2026-09-08');
        expect(dayIn('2026-09-09T01:30:00+02:00', 0)).toBe('2026-09-08');
        expect(median([1, 5, 3])).toBe(3);
        expect(median([1, 2, 3, 4])).toBe(2.5);
        expect(median([])).toBe(0);
    });

    it('counts each verdict once, skips the commit before the window, and types itself', () => {
        const text = report();
        expect(text.startsWith('<!-- evidence-type: analysis -->')).toBe(true);
        // The record commit also adds the quorum policy, which is gated: needs-owner.
        expect(text).toContain('| `routine` | 1 |');
        expect(text).toContain('| `needs-council` | 1 |');
        expect(text).toContain('| `needs-owner` | 2 |');
        expect(text).toContain('| `owner-reserved-decision` | 1 |');
        expect(text).toContain('| total | 4 |');
        expect(text).toContain('2 day(s) with a first-parent commit');
    });

    it('tallies the clearance records at the pin and names the hand-offs by cause', () => {
        const text = report();
        expect(text).toContain('| a `dangerous` seat | 1 |');
        expect(text).toContain('| a split — not cleared with at least one clearing seat | 1 |');
        expect(text).toContain('| not cleared, no clearing seat (degraded or no quorum) | 0 |');
        expect(text).toContain('| `needs-council` with no clearance record — no council on record | 0 |');
    });

    it('names the requested rows, and says so when one is outside the window', () => {
        const text = report();
        expect(text).toMatch(new RegExp(`\\| \`${(shas['ci'] as string).slice(0, 9)}\` \\| 2026-09-08 \\| \`needs-council\``, 'u'));
        expect(text).toContain('| `deadbeef0` | — | not in the window |');
    });

    it('is byte-identical on a re-run at the same pin and timestamp', () => {
        expect(report()).toBe(report());
    });

    it('records the classifier revision its byte-identical claim depends on', () => {
        expect(report()).toMatch(/Classifier revision `([0-9a-f]{40}(-dirty)?|unknown)`\. A re-run of that command at the same pin, timestamp\nand classifier revision/u);
    });

    it('names no prompt and no reply', () => {
        expect(report()).not.toMatch(/prompt_sha256|reply/iu);
    });

    it('exits 2 on a pin it cannot resolve', () => {
        expect(main(['--root', root, '--pin', 'nope', '--since', '2026-09-07T00:00:00+02:00'], () => undefined)).toBe(2);
    });
});
