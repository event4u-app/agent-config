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
let prevConfig: string | undefined;
beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sr-lazy-')));
    fs.mkdirSync(path.join(tmp, 'claude'));
    prevConfig = process.env['CLAUDE_CONFIG_DIR'];
    process.env['CLAUDE_CONFIG_DIR'] = path.join(tmp, 'claude');
});
afterEach(() => {
    if (prevConfig === undefined) delete process.env['CLAUDE_CONFIG_DIR'];
    else process.env['CLAUDE_CONFIG_DIR'] = prevConfig;
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
            env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(tmp, 'claude') },
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
});
