// The deliberation-mode concern: one line per qualifying prompt, per mode, with
// the session override winning; silence where the mode or the prompt says so.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { writeSessionOverride } from '../../src/scripts/_lib/deliberation_mode.js';
import { decide, deliberationLine, promptWarrantsLine } from '../../src/scripts/hooks/deliberation_mode_hook.js';

const SID = '0b6f1c2e-1111-4a2b-9c3d-123456789abc';
const DECISION = 'Should the session list be keyed by project or by account? Both work.';
let root: string;
let settings: string;
let env: NodeJS.ProcessEnv;

const envelope = (prompt: string, extra: Record<string, unknown> = {}) => ({ event: 'user_prompt_submit', payload: { prompt, session_id: SID, ...extra } });
const setGlobal = (mode: string) => writeFileSync(settings, `deliberation:\n  mode: ${mode}\n`);

beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'deliberation-hook-'));
    settings = path.join(root, 'settings', '.agent-settings.yml');
    mkdirSync(path.dirname(settings), { recursive: true });
    env = { EVENT4U_CONFIG_HOME: root };
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('decide', () => {
    it('off is the default: silent on a decision prompt when nothing is set', () => {
        expect(decide(envelope(DECISION), { env, settingsPaths: [settings] })).toBeNull();
    });

    it('offer (switched on): names the three tools, the plain answer last, and the session id', () => {
        setGlobal('offer');
        const line = decide(envelope(DECISION), { env, settingsPaths: [settings] });
        expect(line).toContain('mode="offer"');
        expect(line).toContain(`session="${SID}"`);
        expect(line).toMatch(/\/council.*\/arena.*\/panel/);
        expect(line).toContain('plain answer as the last option');
    });

    it('auto: answers implementation questions itself, runs a fitting tool, and names the Hard Floor it never passes', () => {
        setGlobal('auto');
        const line = decide(envelope(DECISION), { env, settingsPaths: [settings] }) ?? '';
        expect(line).toContain('mode="auto"');
        expect(line).toContain('Answer your own implementation questions');
        expect(line).toContain('saying which and why in one line');
        for (const floor of ['merge', 'deploy', 'push', 'release or tag', 'production data or infra', 'bulk deletion', 'irreversible external action', 'owner-reserved']) {
            expect(line).toContain(floor);
        }
    });

    it('offer: never tells the agent to decide on its own', () => {
        setGlobal('offer');
        expect(decide(envelope(DECISION), { env, settingsPaths: [settings] })).not.toContain('implementation questions');
    });

    it('off: silent on an ordinary prompt; a prompt naming a tool learns how to switch it on, per session or globally', () => {
        setGlobal('off');
        expect(decide(envelope(DECISION), { env, settingsPaths: [settings] })).toBeNull();
        const line = decide(envelope('stell council arena panel auf auto, nur in diesem Chat'), { env, settingsPaths: [settings] }) ?? '';
        expect(line).toContain('mode="off"');
        expect(line).toContain('Switch it on only if the user asks');
        expect(line).toContain(`deliberation:set <offer|auto> --session ${SID}`);
        expect(line).toContain('without --session only when they say globally');
    });

    it('a session override wins over the global setting', () => {
        setGlobal('auto');
        writeSessionOverride(SID, 'off', new Date(), env);
        expect(decide(envelope(DECISION), { env, settingsPaths: [settings] })).toBeNull();
        writeSessionOverride(SID, 'offer', new Date(), env);
        expect(decide(envelope(DECISION), { env, settingsPaths: [settings] })).toContain('mode="offer"');
    });

    it('stays silent on slash commands, short replies, other events and the kill switch', () => {
        expect(decide(envelope('/council design'), { env, settingsPaths: [settings] })).toBeNull();
        expect(decide(envelope('ja, 2'), { env, settingsPaths: [settings] })).toBeNull();
        expect(decide({ event: 'stop', payload: { prompt: DECISION } }, { env, settingsPaths: [settings] })).toBeNull();
        expect(decide(envelope(DECISION), { env: { ...env, AGENT_CONFIG_NO_DELIBERATION_HINT: '1' }, settingsPaths: [settings] })).toBeNull();
    });

    it('stays silent when a settings layer cannot be read, unless a session override decides', () => {
        writeFileSync(settings, 'deliberation: [unclosed\n');
        expect(decide(envelope(DECISION), { env, settingsPaths: [settings] })).toBeNull();
        writeSessionOverride(SID, 'offer', new Date(), env);
        expect(decide(envelope(DECISION), { env, settingsPaths: [settings] })).toContain('mode="offer"');
    });

    it('drops an invalid session id instead of reading a path from it', () => {
        setGlobal('offer');
        const line = decide(envelope(DECISION, { session_id: '../../etc/passwd' }), { env, settingsPaths: [settings] });
        expect(line).toContain('mode="offer"');
        expect(line).not.toContain('session=');
    });
});

describe('pure parts', () => {
    it('promptWarrantsLine', () => {
        expect(promptWarrantsLine('')).toBe(false);
        expect(promptWarrantsLine('/arena x y z')).toBe(false);
        expect(promptWarrantsLine('which one is better')).toBe(true);
    });

    it('keeps the line short enough for the prompt slot', () => {
        expect(Buffer.byteLength(deliberationLine('offer', SID, 'council arena') ?? '')).toBeLessThan(800);
        expect(Buffer.byteLength(deliberationLine('auto', SID, 'council arena') ?? '')).toBeLessThan(1200);
    });
});
