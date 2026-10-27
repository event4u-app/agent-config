// road-to-a-control-that-matches-its-neighbours 3.8: the consistency check is
// on without a setting, off with one, delivered as advisory context, and every
// write it sees adds a shadow row. Run end to end, because the default lives in
// `main` and a unit test of the parts cannot see whether it is wired.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { consistencyFor } from '../../src/scripts/hooks/design_pass_hook.js';
import {
    consistencySpecifier,
    CONSISTENCY_CHUNK,
    loadConsistencyPass,
} from '../../src/scripts/hooks/design_consistency_loader.js';

const REPO = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const HOOK = path.join(REPO, 'src', 'scripts', 'hooks', 'design_pass_hook.ts');
const SHADOW = path.join('agents', 'runtime', 'state', 'design-consistency-shadow.jsonl');

let dir = '';
afterEach(() => {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
    dir = '';
});

function project(settings?: string): string {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'design-consistency-'));
    const w = (rel: string, text: string) => {
        fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
        fs.writeFileSync(path.join(dir, rel), text);
    };
    w('components/ui/select.tsx', 'export function Select(props) {\n  return <div {...props} />;\n}\n');
    w('app/orders.tsx', 'export const O = () => <><Select name="a" /><Select name="b" /></>;\n');
    w('app/filters.tsx', 'export const F = () => <select name="status"><option>Open</option></select>;\n');
    w('app/clean.tsx', 'export const C = () => <Select name="c" />;\n');
    if (settings !== undefined) w('.agent-settings.yml', settings);
    return dir;
}

function run(root: string, file: string): { status: number | null; stdout: string } {
    // cwd is the repository: from a bare temp dir `npx tsx` resolves nothing
    // local and tries to install. The hook reads the project from the env.
    const r = spawnSync('npx', ['tsx', HOOK], {
        cwd: REPO,
        env: { ...process.env, CLAUDE_PROJECT_DIR: root },
        input: JSON.stringify({ tool_input: { file_path: file } }),
        encoding: 'utf8',
    });
    return { status: r.status, stdout: r.stdout };
}

describe('the consistency check ships on', () => {
    it('with no setting at all, a raw select beside the project Select is delivered', () => {
        const root = project();
        const r = run(root, 'app/filters.tsx');
        expect(r.status).toBe(2);
        expect(r.stdout).toContain('raw select');
        expect(r.stdout).toContain("this project's select is Select");
    });

    it('a settings file that never names the key leaves it on', () => {
        const root = project('hooks:\n  design_pass:\n    enabled: false\n');
        expect(run(root, 'app/filters.tsx').status).toBe(2);
    });

    it('an explicit opt-out silences it', () => {
        const root = project('hooks:\n  design_consistency:\n    enabled: false\n');
        const r = run(root, 'app/filters.tsx');
        expect(r.status).toBe(0);
        expect(r.stdout).toBe('');
    });

    it('shadow: true is the rollback — it records and says nothing', () => {
        const root = project('hooks:\n  design_consistency:\n    enabled: true\n    shadow: true\n');
        expect(run(root, 'app/filters.tsx')).toEqual({ status: 0, stdout: '' });
        const rows = fs.readFileSync(path.join(root, SHADOW), 'utf8').trim().split('\n');
        expect(JSON.parse(rows[0]!)).toMatchObject({ file: 'app/filters.tsx', raw_control: 1 });
    });

    it('shadow: true also keeps the finding out of the full pass', () => {
        const root = project('hooks:\n  design_pass:\n    enabled: true\n  design_consistency:\n    enabled: true\n    shadow: true\n');
        expect(run(root, 'app/filters.tsx').stdout).not.toContain('raw select');
        expect(fs.existsSync(path.join(root, SHADOW))).toBe(true);
    });

    it('a clean write says nothing and still records a shadow row', () => {
        const root = project();
        expect(run(root, 'app/clean.tsx')).toEqual({ status: 0, stdout: '' });
        const rows = fs.readFileSync(path.join(root, SHADOW), 'utf8').trim().split('\n');
        expect(rows).toHaveLength(1);
        expect(JSON.parse(rows[0]!)).toMatchObject({ file: 'app/clean.tsx', raw_control: 0 });
    });

    it('a non-UI write never loads the check', () => {
        const root = project();
        fs.writeFileSync(path.join(root, 'notes.md'), '<select>');
        expect(run(root, 'notes.md')).toEqual({ status: 0, stdout: '' });
        expect(fs.existsSync(path.join(root, SHADOW))).toBe(false);
    });
});

describe('the role map follows uncommitted primitives', () => {
    it('a primitive added without a commit is seen on the next write', () => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'design-consistency-git-'));
        const w = (rel: string, text: string) => {
            fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
            fs.writeFileSync(path.join(dir, rel), text);
        };
        const git = (...a: string[]) =>
            spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...a], { cwd: dir, encoding: 'utf8' });
        w('app/home.tsx', 'export const H = () => <main />;\n');
        git('init', '-q');
        git('add', '-A');
        git('commit', '-q', '-m', 'init');
        // The first write caches a map with no select role at this HEAD.
        expect(run(dir, 'app/home.tsx').status).toBe(0);
        // Uncommitted: the project gains its own Select and two uses of it.
        w('components/ui/select.tsx', 'export function Select(props) {\n  return <div {...props} />;\n}\n');
        w('app/orders.tsx', 'export const O = () => <><Select name="a" /><Select name="b" /></>;\n');
        w('app/filters.tsx', 'export const F = () => <select name="status"><option>Open</option></select>;\n');
        const r = run(dir, 'app/filters.tsx');
        expect(r.status).toBe(2);
        expect(r.stdout).toContain("this project's select is Select");
    });
});

describe('the chunk boundary', () => {
    it('a missing chunk costs the finding, never the event', () => {
        const root = project();
        expect(consistencyFor(root, 'app/filters.tsx', () => null)).toEqual([]);
        const throwing = () => {
            throw new Error('loader broke');
        };
        expect(consistencyFor(root, 'app/filters.tsx', throwing)).toEqual([]);
    });

    it('bundled: an absent, a throwing or an export-less chunk loads as null', () => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'design-consistency-chunk-'));
        // One directory per case: `require` caches a module by its path.
        const load = (name: string, chunk?: string) => {
            const d = path.join(dir, name);
            fs.mkdirSync(d);
            if (chunk !== undefined) fs.writeFileSync(path.join(d, CONSISTENCY_CHUNK), chunk);
            return loadConsistencyPass(pathToFileURL(path.join(d, 'dispatch.js')).href, true);
        };
        expect(load('absent')).toBeNull();
        expect(load('throwing', 'throw new Error("broken chunk");')).toBeNull();
        expect(load('no-export', 'module.exports = { somethingElse: 1 };')).toBeNull();
        expect(load('valid', 'module.exports = { consistencyPass: () => [] };')).toBeTypeOf('function');
    });

    it('bundled, the check is the sibling chunk; from source, the module', () => {
        const self = 'file:///pkg/dist/hooks/dispatch.js';
        expect(consistencySpecifier(self, true)).toBe(path.join('/pkg/dist/hooks', CONSISTENCY_CHUNK));
        expect(consistencySpecifier('file:///pkg/src/scripts/hooks/design_consistency_loader.ts', false)).toBe(
            path.join('/pkg/src/scripts/_lib', 'design_consistency_pass.ts'),
        );
    });
});
