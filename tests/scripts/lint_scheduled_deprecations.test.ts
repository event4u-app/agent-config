/**
 * Tests for `src/scripts/lint_scheduled_deprecations.ts`.
 *
 * The load-bearing case is the **overdue-by-construction fixture**. This gate
 * reports an absence — "nothing is overdue" — and the failure mode the whole
 * roadmap is about is a green run that scanned nothing: a table whose heading
 * moved or whose format drifted parses to zero rows and the gate exits 0
 * looking healthy. So the suite proves the gate discriminates in both
 * directions and that an empty parse reds:
 *
 *   1. a fixture overdue by construction is REPORTED (and refused at a cut),
 *   2. a fixture entirely in the future passes,
 *   3. an unpinned / permanent-keep row is tracked, not overdue and not a
 *      parse failure,
 *   4. an unresolvable removal-due cell reds rather than being guessed at,
 *   5. a table that parses to zero rows reds (anti-vacuity),
 *   6. the REAL repo tree reproduces the reading the roadmap is built on.
 *
 * Case 1 is what makes a green run mean the arithmetic ran. Case 5 is what
 * makes it mean the arithmetic ran over something.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { HeaderMismatchError, parseRows, resolveDueMajor } from '../../src/scripts/lint_scheduled_deprecations.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_scheduled_deprecations.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function run(cwd: string, args: string[] = []) {
    return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd, encoding: 'utf8' });
}

const HEADER = [
    '# Migration Guide',
    '',
    '## Scheduled deprecations (forward-looking)',
    '',
    '| Surface | Committed | Deprecation notice due | Removal due | Reversal condition |',
    '|---|---|---|---|---|',
].join('\n');

/** Write a fixture tree: `package.json` at `major`, plus a table of rows. */
function writeFixture(root: string, major: number, rows: string[]): void {
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.writeFileSync(
        path.join(root, 'package.json'),
        JSON.stringify({ name: 'fixture', version: `${String(major)}.0.0` }, null, 2),
        'utf8',
    );
    fs.writeFileSync(
        path.join(root, 'docs', 'MIGRATION.md'),
        `${HEADER}\n${rows.join('\n')}\n\n## 1.x → 2.0.0 — already shipped\n\nProse.\n`,
        'utf8',
    );
}

describe('lint_scheduled_deprecations', () => {
    let tmp: string;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sched-depr-'));
    });

    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('overdue by construction: reported on a branch, refused at a major cut', () => {
        // Shipped 12, removal committed at 11 — one major late, by construction.
        writeFixture(tmp, 12, [
            '| `legacy_engine` (`src/scripts/legacy/`) | 2026-01-01 | 10.0 | 11.0 | none |',
        ]);
        fs.mkdirSync(path.join(tmp, 'src', 'scripts', 'legacy'), { recursive: true });

        const branch = run(tmp);
        expect(branch.stdout).toContain('scanned: 1');
        expect(branch.stdout).toContain('legacy_engine');
        expect(branch.stdout).toContain('1 major(s) overdue');
        // The runtime path is on disk, so the gate must say so by name.
        expect(branch.stdout).toContain('still on disk: src/scripts/legacy/');
        // An ordinary branch reports; it does not refuse.
        expect(branch.status).toBe(0);

        const cut = run(tmp, ['--cutting', '13.0.0']);
        expect(cut.status).toBe(1);
        expect(cut.stderr).toContain('due at or before');
    });

    it('a row due AT the major being cut is refused — the comparand is the target', () => {
        // The defect this pins. Shipped is 12 and the row is committed to 13,
        // so measured against package.json it reads as one major EARLY and
        // passes. Measured against the 13.0.0 being cut it is due now. Getting
        // this backwards means the refusal can only ever fire on a row that is
        // already a major late — which is the lateness the gate exists to stop.
        writeFixture(tmp, 12, ['| `due_now` | 2026-01-01 | 12.0 | 13.0 | none |']);

        const branch = run(tmp);
        expect(branch.status).toBe(0);
        expect(branch.stdout).toContain('none due');

        const cut = run(tmp, ['--cutting', '13.0.0']);
        expect(cut.status).toBe(1);
        expect(cut.stdout).toContain('comes due AT');
        expect(cut.stderr).toContain('due at or before');
    });

    it('a renamed Removal-due column reds ONCE naming the header, not once per row', () => {
        fs.mkdirSync(path.join(tmp, 'docs'), { recursive: true });
        fs.writeFileSync(
            path.join(tmp, 'package.json'),
            JSON.stringify({ name: 'fixture', version: '12.0.0' }),
            'utf8',
        );
        fs.writeFileSync(
            path.join(tmp, 'docs', 'MIGRATION.md'),
            `${HEADER.replace('| Removal due ', '| Retirement date ')}\n` +
                '| `a` | 2026-01-01 | 10.0 | 11.0 | none |\n' +
                '| `b` | 2026-01-01 | 10.0 | 11.0 | none |\n',
            'utf8',
        );

        const r = run(tmp);
        expect(r.status).toBe(1);
        expect(r.stderr).toContain('no "Removal due" column');
        // Two rows, ONE finding: the cause is the header, and repeating it per
        // row buries it under noise proportional to the table's length.
        expect(r.stderr.match(/Removal due/g) ?? []).toHaveLength(1);
        expect(r.stderr).not.toContain('not resolvable');
    });

    it('a green run means the arithmetic ran: future rows pass in both modes', () => {
        writeFixture(tmp, 12, ['| `future_thing` | 2026-01-01 | 13.0 | 14.0 | none |']);

        const branch = run(tmp);
        expect(branch.status).toBe(0);
        expect(branch.stdout).toContain('scanned: 1');
        expect(branch.stdout).toContain('none due');

        const cut = run(tmp, ['--cutting', '13.0.0']);
        expect(cut.status).toBe(0);
    });

    it('unpinned and permanent-keep rows are tracked states, not findings', () => {
        writeFixture(tmp, 12, [
            '| `unpinned_thing` | 2026-01-01 | shipped 2026-01-02 | next major after the notice — **not pinned here** | none |',
            '| `kept_thing` | 2026-01-01 | n/a | documented permanent keep | none |',
        ]);

        const r = run(tmp);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('scanned: 2');
        expect(r.stdout).toContain('none due');
    });

    it('an unresolvable removal-due cell reds instead of being guessed at', () => {
        writeFixture(tmp, 12, ['| `vague_thing` | 2026-01-01 | soon | eventually | none |']);

        const r = run(tmp);
        expect(r.status).toBe(1);
        expect(r.stderr).toContain('not resolvable');
        expect(r.stderr).toContain('vague_thing');
    });

    it('a table that parses to zero rows reds rather than exiting green', () => {
        // The heading drifted — the table below it is no longer reachable, which
        // is precisely the silent-green shape this gate exists to prevent.
        fs.mkdirSync(path.join(tmp, 'docs'), { recursive: true });
        fs.writeFileSync(
            path.join(tmp, 'package.json'),
            JSON.stringify({ name: 'fixture', version: '12.0.0' }),
            'utf8',
        );
        fs.writeFileSync(
            path.join(tmp, 'docs', 'MIGRATION.md'),
            '# Migration Guide\n\n## Planned removals\n\n| Surface | Removal due |\n|---|---|\n| `x` | 1.0 |\n',
            'utf8',
        );

        const r = run(tmp);
        expect(r.status).toBe(1);
        expect(r.stderr).toContain('scanned 0');
    });

    it('the version grammar resolves exactly the forms the table uses', () => {
        expect(resolveDueMajor('11.0')).toEqual({ kind: 'major', major: 11 });
        expect(resolveDueMajor('12.0.0')).toEqual({ kind: 'major', major: 12 });
        expect(resolveDueMajor('next major after 9.x')).toEqual({ kind: 'major', major: 10 });
        expect(resolveDueMajor('the major after that', 10)).toEqual({ kind: 'major', major: 11 });
        // Relative with nothing to be relative to is a parse failure, never a guess.
        expect(resolveDueMajor('the major after that').kind).toBe('unresolved');
        // The unpinned row also contains "next major after the notice"; the
        // explicit not-pinned statement is the load-bearing half and must win.
        expect(
            resolveDueMajor('next major after the notice — **not pinned here** (maintainer-owned)', 10),
        ).toEqual({ kind: 'unpinned' });
        expect(resolveDueMajor('')).toEqual({ kind: 'unresolved', cell: '' });
        // A date is NOT a version. The loose `\\d+` fallback resolved
        // `shipped 2026-07-29` to major 2026 — a confidently wrong commitment,
        // which is the one outcome the gate's contract rules out.
        expect(resolveDueMajor('shipped 2026-07-29 — dormant by default').kind).toBe('unresolved');
        expect(resolveDueMajor('see ADR-135').kind).toBe('unresolved');
        // Markdown emphasis around a bare version still resolves.
        expect(resolveDueMajor('**11.0**')).toEqual({ kind: 'major', major: 11 });
    });

    it('only the scheduled-deprecations table is parsed, never the shipped sections', () => {
        writeFixture(tmp, 12, ['| `only_row` | 2026-01-01 | 13.0 | 14.0 | none |']);
        const rows = parseRows(fs.readFileSync(path.join(tmp, 'docs', 'MIGRATION.md'), 'utf8'));
        expect(rows).toHaveLength(1);
        expect(rows[0]?.name).toBe('only_row');
    });

    it('a header missing the Removal-due column throws HeaderMismatchError', () => {
        expect(() =>
            parseRows(`${HEADER.replace('| Removal due ', '| Retirement date ')}\n| \`a\` | x | y | z | w |\n`),
        ).toThrow(HeaderMismatchError);
    });

    it('real repo: reproduces the reading this gate was built on', () => {
        const r = run(REPO_ROOT);
        // Three rows today; the floor is what matters, not the exact number.
        expect(r.stdout).toMatch(/scanned: [1-9]\d*/);
        // No unresolved cell in the shipped table — that would be a live defect.
        expect(r.stderr).not.toContain('not resolvable');
        expect(r.status).toBe(0);
    });
});
