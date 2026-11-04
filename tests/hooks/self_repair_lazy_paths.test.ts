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
        expect(main!([])).toBe(0);
        clearHookStdinOverride();
        vi.restoreAllMocks();

        const res = spawnSync(process.execPath, ['--import', 'tsx', path.resolve(SCRIPT)], {
            input: payload(viaSpawn),
            encoding: 'utf-8',
            env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(tmp, 'claude') },
        });
        expect(res.status).toBe(0);
        expect(res.stdout).toContain('<self-repair-queue>');

        const loaderRecords = stripTimes(viaLoader);
        expect(loaderRecords).toHaveLength(1);
        expect(loaderRecords).toEqual(stripTimes(viaSpawn));
        expect(fs.existsSync(path.join(viaSpawn, 'agents', 'runtime', 'self-repair', '_subject-index.json'))).toBe(true);
    });
});
