/**
 * road-to-one-detector-and-the-senders-we-own 3.5: what this package injects
 * into a session — hot context and a handoff at session start, memory recall on
 * a prompt — goes through the engine too. Values are built at runtime; every
 * assertion is a boolean or a shape.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { parseTokens } from '../../../src/scripts/_lib/egress_token.js';
import { egressInjection, type EgressMode } from '../../../src/scripts/hooks/egress_stage.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'dispatch_hook.ts');
const TSX_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const INJECTOR = 'tests/hooks/fixtures/concern_inject_stored.ts';

const PAT = ['ghp', 'Ab3Cd5Ef7Gh9Jk2Lm4Np6Qr8St1Uv3Wx5Yz7'.slice(0, 36)].join('_');
const ENTRY = `decision 2026-10-01: the deploy bot uses ${PAT} for the mirror`;
const UNPROVEN = '-----BEGIN RSA PRIVATE KEY-----\nMIIab3cd4ef5\n';

const mode = (m: EgressMode) => (): EgressMode => m;

describe('egressInjection', () => {
    it('in protect and strict, a stored entry is injected as its token', () => {
        for (const m of ['protect', 'strict'] as const) {
            const out = egressInjection('/ws', mode(m))(ENTRY);
            expect(out.includes(PAT)).toBe(false);
            expect(parseTokens(out).map((t) => t.type)).toEqual(['TOKEN']);
            expect(out.startsWith('decision 2026-10-01: the deploy bot uses __TOKEN_1_')).toBe(true);
        }
    });

    it('one scope per dispatch: the same value is the same token in two injections', () => {
        const inject = egressInjection('/ws', mode('protect'));
        expect(inject(ENTRY)).toBe(inject(ENTRY));
    });

    it('off and observe change nothing, and read the mode once', () => {
        let reads = 0;
        const inject = egressInjection('/ws', () => {
            reads += 1;
            return 'observe';
        });
        expect(inject(ENTRY)).toBe(ENTRY);
        expect(inject(ENTRY)).toBe(ENTRY);
        expect(reads).toBe(1);
        expect(egressInjection('/ws', mode('off'))(ENTRY)).toBe(ENTRY);
    });

    it('withholds what it cannot vouch for: an unproven key block, an unavailable engine, an unreadable mode', () => {
        expect(egressInjection('/ws', mode('protect'))(UNPROVEN)).toBe('[egress: injected text withheld (pem-private-key)]');
        const missing = egressInjection('/ws', mode('strict'), () => ({ ok: false, reason: 'missing' }));
        expect(missing(ENTRY)).toBe('[egress: injected text withheld (engine-unavailable)]');
        const broken = egressInjection('/ws', () => {
            throw new Error('unreadable');
        });
        expect(broken(ENTRY).includes(PAT)).toBe(false);
    });
});

describe('the dispatcher injects through the engine', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'egress-inject-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function dispatch(event: string, nativeEvent: string, settings: string): string {
        const ws = path.join(tmp, 'ws');
        fs.mkdirSync(ws, { recursive: true });
        fs.writeFileSync(path.join(ws, '.agent-settings.yml'), settings);
        const manifest = path.join(tmp, 'manifest.yaml');
        fs.writeFileSync(
            manifest,
            [
                'schema_version: 1',
                'concerns:',
                '  injector:',
                `    script: ${INJECTOR}`,
                '    args: []',
                '    fail_closed: false',
                '    severity: advisory',
                '    effect: context',
                'platforms:',
                '  claude:',
                '    session_start: [injector]',
                '    user_prompt_submit: [injector]',
                '',
            ].join('\n'),
        );
        const env: NodeJS.ProcessEnv = { ...process.env, EGRESS_TEST_STORED: ENTRY };
        delete env['AGENT_CONFIG_REPLAY'];
        delete env['AGENT_CONFIG_NO_EGRESS_STAGE'];
        const r = spawnSync(
            TSX_BIN,
            [TS_SCRIPT, '--platform', 'claude', '--event', event, '--native-event', nativeEvent, '--manifest', manifest],
            { cwd: ws, input: JSON.stringify({ prompt: 'hello', session_id: 's1' }), encoding: 'utf8', env },
        );
        return r.stdout;
    }

    const PROTECT = 'egress:\n  placeholders:\n    mode: protect\n';

    it('session start (hot context, handoff): the stored entry arrives as its token', () => {
        const out = dispatch('session_start', 'SessionStart', PROTECT);
        expect(out.includes(PAT)).toBe(false);
        expect(parseTokens(out).length).toBe(1);
    });

    it('a prompt (memory recall): the recalled entry arrives as its token', () => {
        const out = dispatch('user_prompt_submit', 'UserPromptSubmit', PROTECT);
        expect(out.includes(PAT)).toBe(false);
        expect(parseTokens(out).length).toBeGreaterThan(0);
    });

    it('with the shipped default the entry is injected unchanged', () => {
        const out = dispatch('session_start', 'SessionStart', 'egress:\n  placeholders:\n    mode: off\n');
        expect(out.includes(PAT)).toBe(true);
    });
});
