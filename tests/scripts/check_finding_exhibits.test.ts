import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { checkFindingExhibits } from '../../src/scripts/check_finding_exhibits.js';

let repo = '';
let commit = '';

const sh = (args: string[]) => {
    const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr);
    return r.stdout.trim();
};

beforeAll(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'exhibits-'));
    sh(['init', '-q']);
    sh(['config', 'user.email', 't@example.com']);
    sh(['config', 'user.name', 't']);
    fs.mkdirSync(path.join(repo, 'src'));
    fs.writeFileSync(path.join(repo, 'src', 'a.ts'), ['// one', '// two', 'export const guard = true;', '// four', '// five'].join('\n'));
    fs.writeFileSync(path.join(repo, 'src', 'b.ts'), 'export const other = 1;\n');
    sh(['add', '.']);
    sh(['commit', '-q', '-m', 'fixture']);
    commit = sh(['rev-parse', 'HEAD']);
});

afterAll(() => fs.rmSync(repo, { recursive: true, force: true }));

const presence = (over: Record<string, unknown> = {}) => ({
    type: 'presence',
    path: 'src/a.ts',
    line: 3,
    quote: 'export const guard = true;',
    commit,
    ...over,
});

const verdicts = (exhibits: unknown[]) => checkFindingExhibits(repo, [{ exhibits }]).map((r) => r.verdict);

describe('check_finding_exhibits — one verdict per exhibit type', () => {
    it('presence: a quote at its line is admissible, within the ±3 window too', () => {
        expect(verdicts([presence(), presence({ line: 5 })])).toEqual(['admissible', 'admissible']);
    });

    it('sabotage: a quote shifted by one character is inadmissible', () => {
        expect(verdicts([presence({ quote: 'export const guard = true:' })])).toEqual(['inadmissible']);
    });

    it('presence: a path absent at the commit is inadmissible', () => {
        expect(verdicts([presence({ path: 'src/missing.ts' })])).toEqual(['inadmissible']);
    });

    it('an unreachable commit is unverifiable', () => {
        expect(verdicts([presence({ commit: 'deadbeefdeadbeef' })])).toEqual(['unverifiable']);
    });

    it('absence: zero matches where zero are expected is admissible; a match is not', () => {
        const absent = { type: 'absence', path_glob: 'src', pattern: 'NeverWritten', commit, expected: 0 };
        expect(verdicts([absent, { ...absent, pattern: 'guard' }])).toEqual(['admissible', 'inadmissible']);
    });

    it('pair: holds only when both legs hold', () => {
        const ok = presence({ path: 'src/b.ts', line: 1, quote: 'export const other = 1;' });
        expect(verdicts([{ type: 'pair', legs: [presence(), ok] }])).toEqual(['admissible']);
        expect(verdicts([{ type: 'pair', legs: [presence(), presence({ quote: 'nope' })] }])).toEqual([
            'inadmissible',
        ]);
    });

    it('executed: recorded, never re-run', () => {
        const marker = path.join(repo, 'ran');
        const r = checkFindingExhibits(repo, [
            { exhibits: [{ type: 'executed', command: `touch ${marker}`, exit_code: 0, output_digest: 'sha256:00' }] },
        ]);
        expect(r[0]?.verdict).toBe('unverifiable');
        expect(fs.existsSync(marker)).toBe(false);
    });

    it('a malformed exhibit is reported, and a finding without exhibits yields no row', () => {
        const r = checkFindingExhibits(repo, [{ exhibits: [{ type: 'presence' }] }, { title: 'no exhibits' }]);
        expect(r).toHaveLength(1);
        expect(r[0]?.type).toBe('malformed');
    });
});

describe('check_finding_exhibits — informs, never filters', () => {
    it('the checker source writes no disposition and never touches the ledger directory', () => {
        const src = fs.readFileSync(
            path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', 'src', 'scripts', 'check_finding_exhibits.ts'),
            'utf8',
        );
        const code = src.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        for (const literal of ["'fixed'", "'false_positive'", "'accepted_risk'", "'still_open'", 'release-findings', 'writeFileSync']) {
            expect(code, literal).not.toContain(literal);
        }
    });
});
