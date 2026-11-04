// The self-repair concern ships as a lazy chunk. Both ways the dispatcher can
// reach it — the loader (in-process) and the spawn fallback taken when the
// chunk is missing or mis-digested — must leave the same record behind.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { listRecords } from '../../src/scripts/_lib/self_repair_store.js';
import { CONCERN_REGISTRY, resolveConcernMain } from '../../src/scripts/hooks/concern_registry.js';
import { clearHookStdinOverride, setHookStdinOverride } from '../../src/scripts/hooks/hook_stdin.js';
import { LAZY_CONCERNS } from '../../src/scripts/hooks/lazy_concern.js';

const SCRIPT = 'src/scripts/self_repair_hook.ts';
const PROMPT = 'Du hast schon wieder `tabs` ignoriert';

let tmp: string;
beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sr-lazy-')));
});
afterEach(() => {
    clearHookStdinOverride();
    vi.restoreAllMocks();
    fs.rmSync(tmp, { recursive: true, force: true });
});

function payload(root: string): string {
    return JSON.stringify({ event: 'user_prompt_submit', prompt: PROMPT, workspace_root: root });
}

function stripTimes(root: string): unknown[] {
    return listRecords(root).map(({ first_seen: _f, last_seen: _l, ...rest }) => rest);
}

describe('self-repair through both dispatch paths', () => {
    it('is lazy, not inlined', () => {
        expect(LAZY_CONCERNS[SCRIPT]).toBeDefined();
        expect(CONCERN_REGISTRY[SCRIPT]).toBeUndefined();
    });

    it('the loader path and the spawn fallback write the same record', () => {
        const viaLoader = path.join(tmp, 'loader');
        const viaSpawn = path.join(tmp, 'spawn');

        const main = resolveConcernMain(SCRIPT);
        expect(typeof main).toBe('function');
        vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        setHookStdinOverride(payload(viaLoader));
        expect(main!([])).toBe(2);
        clearHookStdinOverride();
        vi.restoreAllMocks();

        const res = spawnSync(process.execPath, ['--import', 'tsx', path.resolve(SCRIPT)], {
            input: payload(viaSpawn),
            encoding: 'utf-8',
        });
        expect(res.status).toBe(2);
        expect(res.stdout).toContain('<self-repair-queue>');

        const loaderRecords = stripTimes(viaLoader);
        expect(loaderRecords).toHaveLength(1);
        expect(loaderRecords).toEqual(stripTimes(viaSpawn));
        expect(fs.existsSync(path.join(viaSpawn, 'agents', 'runtime', 'self-repair', '_subject-index.json'))).toBe(true);
    });

    it('reads the prompt the dispatcher nests under `payload`', () => {
        const root = path.join(tmp, 'nested');
        vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        setHookStdinOverride(
            JSON.stringify({ event: 'user_prompt_submit', workspace_root: root, payload: { prompt: PROMPT } }),
        );
        expect(resolveConcernMain(SCRIPT)!([])).toBe(2);
        expect(listRecords(root)).toHaveLength(1);
    });

    it('the built dispatcher writes the record and delivers the queue line to the host', (t) => {
        const dispatch = path.resolve('dist', 'hooks', 'dispatch.js');
        // skip-reason: dist/ is untracked, so a clean checkout has no bundle to run.
        if (!fs.existsSync(dispatch) || !fs.existsSync(path.resolve('dist', 'hooks', 'self_repair.chunk.cjs'))) {
            t.skip('dist/hooks is not built');
            return;
        }
        const project = path.join(tmp, 'project');
        fs.mkdirSync(project);
        const res = spawnSync(
            process.execPath,
            [dispatch, '--platform', 'claude', '--event', 'user_prompt_submit', '--native-event', 'UserPromptSubmit', '--project-dir', project, '--min-version', '1'],
            {
                input: JSON.stringify({ prompt: PROMPT, hook_event_name: 'UserPromptSubmit', session_id: 't', cwd: project }),
                encoding: 'utf-8',
            },
        );
        expect(res.status).toBe(0);
        expect(listRecords(project)).toHaveLength(1);
        expect(res.stdout).toContain('<self-repair-queue>');
    });

    it('with the chunk missing, the built dispatcher falls back to the spawn path exactly once', (t) => {
        const built = path.resolve('dist', 'hooks');
        // skip-reason: dist/ is untracked, so a clean checkout has no bundle to run.
        if (!fs.existsSync(path.join(built, 'dispatch.js'))) {
            t.skip('dist/hooks is not built');
            return;
        }
        // A package layout identical to the built one except for the chunk:
        // the loader returns null and the dispatcher must spawn the script.
        const pkg = path.join(tmp, 'pkg');
        fs.mkdirSync(path.join(pkg, 'dist', 'hooks'), { recursive: true });
        for (const name of fs.readdirSync(built)) {
            if (name.startsWith('self_repair.chunk')) continue;
            fs.cpSync(path.join(built, name), path.join(pkg, 'dist', 'hooks', name), { recursive: true });
        }
        fs.symlinkSync(path.resolve('src'), path.join(pkg, 'src'));
        fs.symlinkSync(path.resolve('node_modules'), path.join(pkg, 'node_modules'));
        fs.copyFileSync(path.resolve('package.json'), path.join(pkg, 'package.json'));
        const project = path.join(tmp, 'project-fallback');
        fs.mkdirSync(project);
        const res = spawnSync(
            process.execPath,
            [path.join(pkg, 'dist', 'hooks', 'dispatch.js'), '--platform', 'claude', '--event', 'user_prompt_submit', '--native-event', 'UserPromptSubmit', '--project-dir', project, '--min-version', '1'],
            {
                input: JSON.stringify({ prompt: PROMPT, hook_event_name: 'UserPromptSubmit', session_id: 't', cwd: project }),
                encoding: 'utf-8',
            },
        );
        expect(res.status).toBe(0);
        const records = listRecords(project);
        expect(records).toHaveLength(1);
        expect(records[0]!.occurrences).toBe(1);
        expect(res.stdout.split('<self-repair-queue>').length - 1).toBe(1);
    });
});
