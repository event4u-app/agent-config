import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { findDuplicateIds, parseOwnerQuestionIds } from '../../src/scripts/check_owner_question_ids.js';

const REPO_ROOT = resolve(__dirname, '..', '..');
const TSX_BIN = join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'check_owner_question_ids.ts');

const dirs: string[] = [];
afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function fixture(body: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'oq-ids-'));
    dirs.push(dir);
    const file = join(dir, 'owner-questions.md');
    writeFileSync(file, body);
    return file;
}

function run(args: readonly string[]): { status: number | null; stdout: string; stderr: string } {
    const r = spawnSync(TSX_BIN, [SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

const DUPLICATE = [
    '# Owner questions',
    '',
    '## Open',
    '',
    '### OQ-36 — First',
    'body',
    '#### OQ-37 — Second',
    '## OQ-36 — A duplicate a union merge produced',
    '##### OQ-36 — five hashes is not a question heading',
    'Text mentioning OQ-37 is not a heading.',
    '',
].join('\n');

describe('check_owner_question_ids', () => {
    it('parses headings of level 2 to 4 only, with their line numbers', () => {
        const ids = parseOwnerQuestionIds(DUPLICATE);
        expect(ids).toEqual([
            { id: 36, line: 5 },
            { id: 37, line: 7 },
            { id: 36, line: 8 },
        ]);
    });

    it('groups duplicates by id with every line', () => {
        expect(findDuplicateIds(parseOwnerQuestionIds(DUPLICATE))).toEqual([{ id: 36, lines: [5, 8] }]);
        expect(findDuplicateIds([{ id: 1, line: 1 }, { id: 2, line: 2 }])).toEqual([]);
    });

    it('exits 1 on a fixture with a duplicate id and names both lines', () => {
        const r = run(['--file', fixture(DUPLICATE)]);
        expect(r.status).toBe(1);
        const out = r.stdout + r.stderr;
        expect(out).toMatch(/OQ-36/);
        expect(out).toMatch(/\b5\b/);
        expect(out).toMatch(/\b8\b/);
        expect(r.stdout).toMatch(/^scanned: 3$/m);
    });

    it('exits 0 on a fixture whose ids are distinct', () => {
        const r = run(['--file', fixture('### OQ-1 — a\n### OQ-2 — b\n')]);
        expect(r.status).toBe(0);
        expect(r.stdout).toMatch(/^scanned: 2$/m);
    });

    it('refuses a file with no question heading instead of passing it', () => {
        const r = run(['--file', fixture('# nothing here\n')]);
        expect(r.status).toBe(1);
    });

    it('exits 0 on the live register', () => {
        const r = run([]);
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(r.stdout).toMatch(/^scanned: \d+$/m);
    });
});
