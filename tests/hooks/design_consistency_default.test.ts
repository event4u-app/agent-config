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

import { dirtyPrimitives } from '../../src/scripts/_lib/design_consistency_pass.js';
import { consistencyFor, writtenPath } from '../../src/scripts/hooks/design_pass_hook.js';
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

    it('any slot other than post_tool_use never runs the check', () => {
        const root = project();
        for (const slot of ['stop', 'pre_tool_use', 'session_start']) {
            const r = spawnSync('npx', ['tsx', HOOK, '--slot', slot], {
                cwd: REPO,
                env: { ...process.env, CLAUDE_PROJECT_DIR: root },
                input: JSON.stringify({ tool_input: { file_path: 'app/filters.tsx' } }),
                encoding: 'utf8',
            });
            expect({ slot, status: r.status, stdout: r.stdout }).toEqual({ slot, status: 0, stdout: '' });
        }
        expect(fs.existsSync(path.join(root, SHADOW))).toBe(false);
    });

    it('a non-UI write never loads the check', () => {
        const root = project();
        fs.writeFileSync(path.join(root, 'notes.md'), '<select>');
        expect(run(root, 'notes.md')).toEqual({ status: 0, stdout: '' });
        expect(fs.existsSync(path.join(root, SHADOW))).toBe(false);
    });
});

// The hook above is run with the host payload on stdin. In production the
// dispatcher runs it in-process and hands it an envelope instead; this runs
// the real dispatcher, with the absolute path a host sends.
describe('through the dispatcher', () => {
    it('a raw select written by a host is recorded and delivered', () => {
        const root = project();
        const r = spawnSync(
            'npx',
            ['tsx', path.join(REPO, 'src', 'scripts', 'hooks', 'dispatch_entry.ts'), '--platform', 'claude', '--event', 'post_tool_use', '--project-dir', root],
            {
                cwd: REPO,
                env: { ...process.env, CLAUDE_PROJECT_DIR: root },
                input: JSON.stringify({
                    session_id: 'dispatch-test',
                    cwd: root,
                    hook_event_name: 'PostToolUse',
                    tool_name: 'Write',
                    tool_input: { file_path: path.join(root, 'app', 'filters.tsx') },
                }),
                encoding: 'utf8',
            },
        );
        const rows = fs.readFileSync(path.join(root, SHADOW), 'utf8').trim().split('\n');
        expect(JSON.parse(rows[0]!)).toMatchObject({ file: 'app/filters.tsx', raw_control: 1 });
        expect(`${r.stdout}${r.stderr}`).toContain("this project's select is Select");
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

describe('the role map is recomputed only when a primitive can have changed', () => {
    const AUDIT = path.join('agents', 'runtime', 'state', 'ui-audit.json');
    const repo = () => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'design-consistency-recompute-'));
        const w = (rel: string, text: string) => {
            fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
            fs.writeFileSync(path.join(dir, rel), text);
        };
        const git = (...a: string[]) =>
            spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...a], { cwd: dir, encoding: 'utf8' });
        w('components/ui/select.tsx', 'export function Select(props) {\n  return <div {...props} />;\n}\n');
        w('app/orders.tsx', 'export const O = () => <><Select name="a" /><Select name="b" /></>;\n');
        git('init', '-q');
        git('add', '-A');
        git('commit', '-q', '-m', 'init');
        expect(run(dir, 'app/orders.tsx').status).toBe(0);
        expect(fs.existsSync(path.join(dir, AUDIT))).toBe(true);
        fs.rmSync(path.join(dir, AUDIT));
        return w;
    };

    it('a new feature file becoming dirty reuses the cached map', () => {
        const w = repo();
        w('app/filters.tsx', 'export const F = () => <select name="status"><option>Open</option></select>;\n');
        const r = run(dir, 'app/filters.tsx');
        expect(r.status).toBe(2);
        expect(fs.existsSync(path.join(dir, AUDIT))).toBe(false);
    });

    it('a cached map from before families were recorded is recomputed, not trusted', () => {
        const w = repo();
        const cache = path.join(dir, 'agents', 'runtime', 'state', 'design-consistency-roles.json');
        const c = JSON.parse(fs.readFileSync(cache, 'utf8')) as { control_roles: Record<string, { families?: string[] }> };
        for (const e of Object.values(c.control_roles)) delete e.families;
        fs.writeFileSync(cache, JSON.stringify(c));
        w('app/filters.tsx', 'export const F = () => <select name="status"><option>Open</option></select>;\n');
        const r = run(dir, 'app/filters.tsx');
        expect(r.status).toBe(2);
        expect(fs.existsSync(path.join(dir, AUDIT))).toBe(true);
    });

    it('a usage-only edit in another family leaves that family unmeasured', () => {
        const w = repo();
        w('legacy/Orders.vue', '<template><Select name="a" /><select name="b"></select></template>\n');
        expect(run(dir, 'legacy/Orders.vue').status).toBe(0);
    });

    it('a new definition in another family recomputes and makes that family measured', () => {
        const w = repo();
        w('legacy/Select.vue', '<script>\nexport default { name: "Select" };\n</script>\n<template><div><slot /></div></template>\n');
        w('legacy/Orders.vue', '<template><select name="b"></select></template>\n');
        const r = run(dir, 'legacy/Orders.vue');
        expect(fs.existsSync(path.join(dir, AUDIT))).toBe(true);
        expect(r.status).toBe(2);
    });

    it('a primitive file losing its primitive still recomputes', () => {
        const w = repo();
        w('components/ui/select.tsx', 'export function Panel(props) {\n  return <div {...props} />;\n}\n');
        w('app/filters.tsx', 'export const F = () => <select name="status"><option>Open</option></select>;\n');
        run(dir, 'app/filters.tsx');
        expect(fs.existsSync(path.join(dir, AUDIT))).toBe(true);
    });
});

describe('the stamp of uncommitted primitives', () => {
    it('a modified file that loses its last primitive still changes the stamp', () => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'design-consistency-stamp-'));
        const file = path.join(dir, 'components', 'ui', 'select.tsx');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, 'export function Select(props) {\n  return <div {...props} />;\n}\n');
        const git = (...a: string[]) =>
            spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...a], { cwd: dir, encoding: 'utf8' });
        git('init', '-q');
        git('add', '-A');
        git('commit', '-q', '-m', 'init');
        const clean = dirtyPrimitives(dir);
        fs.writeFileSync(file, 'export function Panel(props) {\n  return <div {...props} />;\n}\n');
        const after = dirtyPrimitives(dir);
        expect(after).not.toEqual(clean);
        expect(after).toEqual(['components/ui/select.tsx:']);
    });
});

describe('the written path stays inside the project', () => {
    const root = path.join(os.tmpdir(), 'wp-root');
    const write = (file_path: string) => writtenPath(root, { tool_input: { file_path } });

    it('a path inside the root comes back relative, from either form', () => {
        expect(write('src/components/Form.tsx')).toBe('src/components/Form.tsx');
        expect(write('./src/components/Form.tsx')).toBe('src/components/Form.tsx');
        expect(write(path.join(root, 'src', 'components', 'Form.tsx'))).toBe('src/components/Form.tsx');
    });

    it('a path outside the root is no target, relative or absolute', () => {
        expect(write('../other-project/Form.tsx')).toBeNull();
        expect(write('src/../../other-project/Form.tsx')).toBeNull();
        expect(write(path.join(path.dirname(root), 'other-project', 'Form.tsx'))).toBeNull();
        expect(write('.')).toBeNull();
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
