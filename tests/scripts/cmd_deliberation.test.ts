// `agent-config deliberation:get|set` — the JSON shape Agent Switch reads, the
// global write through settings:set, and the per-session override.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runGet, runSet } from '../../src/scripts/_cli/cmd_deliberation.js';

const SID = '0b6f1c2e-1111-4a2b-9c3d-123456789abc';
const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
let root: string;
let opts: { env: NodeJS.ProcessEnv; settingsPaths: string[]; packageRoot: string; now: Date };

beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'cmd-deliberation-'));
    opts = {
        env: { EVENT4U_CONFIG_HOME: root },
        settingsPaths: [path.join(root, 'settings', '.agent-settings.yml')],
        packageRoot: PACKAGE_ROOT,
        now: new Date('2026-11-26T08:00:00Z'),
    };
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

const json = (r: { out: string[] }): Record<string, unknown> => JSON.parse(r.out[0] as string) as Record<string, unknown>;

describe('deliberation:get', () => {
    it('prints the default with its source as JSON', () => {
        const r = runGet(['--json'], opts);
        expect(r.code).toBe(0);
        expect(json(r)).toEqual({
            v: 1,
            mode: 'off',
            source: 'default',
            file: null,
            session_id: null,
            global: { mode: 'off', source: 'default', file: null },
            session_override: null,
        });
    });

    it('refuses a session id that is not one', () => {
        expect(runGet(['--session', '../../etc'], opts).code).toBe(1);
    });
});

describe('deliberation:set', () => {
    it('writes the global setting through settings:set, with provenance', () => {
        const r = runSet(['auto', '--source', 'jit-answer', '--json'], opts);
        expect(r.code).toBe(0);
        expect(json(r)).toMatchObject({ ok: true, scope: 'global', set: 'auto', effective: { mode: 'auto', source: 'global' } });
        const prov = JSON.parse(readFileSync(path.join(root, 'settings', '.agent-settings.provenance.json'), 'utf8')) as Record<string, { source: string }>;
        expect(prov['deliberation.mode']?.source).toBe('jit-answer');
    });

    it('writes a session override that wins over the global setting, and inherit removes it', () => {
        expect(runSet(['offer'], opts).code).toBe(0);
        const set = runSet(['off', '--session', SID, '--json'], opts);
        expect(json(set)).toMatchObject({ scope: 'session', effective: { mode: 'off', source: 'session', session_id: SID, global: { mode: 'offer' } } });
        expect(json(runGet(['--session', SID, '--json'], opts))).toMatchObject({ mode: 'off', source: 'session' });
        expect(runSet(['inherit', '--session', SID], opts).code).toBe(0);
        expect(json(runGet(['--session', SID, '--json'], opts))).toMatchObject({ mode: 'offer', source: 'global', session_override: null });
    });

    it('refuses a traversal session id and writes nothing', () => {
        const r = runSet(['auto', '--session', '../../../tmp/x'], opts);
        expect(r.code).toBe(1);
        expect(json(runGet(['--json'], opts))).toMatchObject({ mode: 'off', source: 'default' });
    });

    it('refuses an unknown mode and a global inherit as usage errors', () => {
        expect(runSet(['always'], opts).code).toBe(2);
        expect(runSet(['inherit'], opts).code).toBe(2);
        expect(runSet([], opts).code).toBe(2);
    });
});
