// A read that writes: `audit_user_type_axis` used to rewrite the tracked
// agents/reports/user-type-axis-audit.md on every run, so the
// `lint-user-type-axis` task dirtied the working tree. It now writes only under
// `--write`. The test runs the real CLI in a throwaway git copy of the inputs
// the audit reads, so the assertion is the one a reviewer cares about — `git
// status` stays empty — and the real checkout is never touched.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TSX = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');
const REPORT_REL = 'agents/reports/user-type-axis-audit.md';

let copy: string;

function git(args: readonly string[]): string {
    const r = spawnSync('git', ['-C', copy, ...args], { encoding: 'utf-8' });
    if (r.status !== 0) {
        throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
    }
    return r.stdout;
}

function runAudit(args: readonly string[]): number | null {
    const script = path.join(copy, 'src', 'scripts', 'audit_user_type_axis.ts');
    return spawnSync(TSX, [script, ...args], { cwd: copy, encoding: 'utf-8' }).status;
}

beforeAll(() => {
    copy = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'uta-nowrite-')));
    // The script and every module it imports resolve relative to its own file,
    // so the copy carries src/ and the two data roots it reads. node_modules is
    // linked, never copied.
    fs.cpSync(path.join(REPO_ROOT, 'src'), path.join(copy, 'src'), { recursive: true });
    fs.cpSync(path.join(REPO_ROOT, 'user-types'), path.join(copy, 'user-types'), { recursive: true });
    fs.mkdirSync(path.join(copy, 'agents', 'reports'), { recursive: true });
    fs.copyFileSync(path.join(REPO_ROOT, REPORT_REL), path.join(copy, REPORT_REL));
    for (const f of ['package.json', 'tsconfig.json']) {
        fs.copyFileSync(path.join(REPO_ROOT, f), path.join(copy, f));
    }
    fs.symlinkSync(path.join(REPO_ROOT, 'node_modules'), path.join(copy, 'node_modules'));
    git(['init', '-q']);
    git(['-c', 'user.email=t@example.com', '-c', 'user.name=t', 'add', 'agents/reports']);
    git(['-c', 'user.email=t@example.com', '-c', 'user.name=t', 'commit', '-q', '-m', 'seed']);
    // Make any rewrite observable: the committed report is a sentinel the
    // renderer would never produce.
    fs.writeFileSync(path.join(copy, REPORT_REL), 'sentinel\n', 'utf-8');
    git(['-c', 'user.email=t@example.com', '-c', 'user.name=t', 'commit', '-q', '-am', 'sentinel']);
}, 120_000);

afterAll(() => {
    fs.rmSync(copy, { recursive: true, force: true });
});

describe('audit_user_type_axis — a read leaves the tree clean', () => {
    it('without --write, git status of agents/reports/ is empty afterwards', () => {
        const code = runAudit(['--quiet']);
        expect([0, 1]).toContain(code);
        expect(git(['status', '--porcelain', 'agents/reports/'])).toBe('');
    });

    it('with --write, the report is regenerated', () => {
        const code = runAudit(['--quiet', '--write']);
        expect([0, 1]).toContain(code);
        expect(git(['status', '--porcelain', 'agents/reports/'])).toContain(REPORT_REL);
        expect(fs.readFileSync(path.join(copy, REPORT_REL), 'utf-8')).toContain('user-type');
    });
});
