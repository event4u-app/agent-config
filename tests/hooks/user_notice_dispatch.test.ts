/**
 * The user channel through the REAL dispatcher (`hooks/user_notice.ts`).
 *
 * A notification concern's `user_notice` must reach the host as `systemMessage`
 * — shown to the user, never added to model context — and must reach no host
 * that has no verified field of that kind. Plain `session_start` context that
 * shares the reply moves into `additionalContext`, because the host parses
 * stdout as JSON only when the whole of it is one object.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { parse as parseYaml } from 'yaml';

import { isBlockCapable, withUserNotice } from '../../src/scripts/hooks/host_semantics.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const ENTRY = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'dispatch_entry.ts');
const TSX_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const FIXTURE = 'tests/hooks/fixtures/concern_user_notice.ts';

const tmpDirs: string[] = [];
afterEach(() => {
    for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

interface FixtureConcern {
    effect: string;
    args?: string[];
    script?: string;
    severity?: string;
}

function dispatch(
    platform: string,
    concerns: Record<string, FixtureConcern>,
    event = 'session_start',
): { status: number | null; stdout: string } {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'user-notice-'));
    tmpDirs.push(dir);
    const names = Object.keys(concerns);
    const manifest = path.join(dir, 'manifest.yaml');
    fs.writeFileSync(
        manifest,
        [
            'schema_version: 1',
            'concerns:',
            ...names.flatMap((name) => [
                `  ${name}:`,
                `    script: ${concerns[name]?.script ?? FIXTURE}`,
                `    args: [${(concerns[name]?.args ?? []).join(', ')}]`,
                `    fail_closed: ${String(concerns[name]?.severity === 'blocking')}`,
                `    severity: ${concerns[name]?.severity ?? 'advisory'}`,
                `    effect: ${concerns[name]?.effect ?? 'notification'}`,
            ]),
            'platforms:',
            `  ${platform}:`,
            `    ${event}: [${names.join(', ')}]`,
            '',
        ].join('\n'),
        'utf8',
    );
    const r = spawnSync(TSX_BIN, [ENTRY, '--platform', platform, '--event', event, '--manifest', manifest], {
        cwd: dir,
        input: JSON.stringify({ session_id: 'user-notice-test' }),
        encoding: 'utf8',
        timeout: 120_000,
        env: { ...process.env, AGENT_CONFIG_PACKAGE_ROOT: REPO_ROOT },
    });
    return { status: r.status, stdout: r.stdout ?? '' };
}

describe('the user channel through the dispatcher', () => {
    it('a notification concern reaches claude as systemMessage and nowhere in model context', () => {
        const r = dispatch('claude', { 'notice-a': { effect: 'notification' } });
        expect(r.status).toBe(0);
        const reply = JSON.parse(r.stdout) as Record<string, unknown>;
        expect(reply['systemMessage']).toBe('fixture notice for the user');
        expect(JSON.stringify(reply['hookSpecificOutput'] ?? null)).not.toContain('fixture notice');
    }, 120_000);

    it('a concern with any other effect cannot use it', () => {
        const r = dispatch('claude', { 'context-a': { effect: 'context' } });
        expect(r.status).toBe(0);
        expect(r.stdout).not.toContain('fixture notice');
    }, 120_000);

    it('a host with no verified user field receives nothing', () => {
        const r = dispatch('copilot', { 'notice-a': { effect: 'notification' } });
        expect(r.stdout).not.toContain('fixture notice');
    }, 120_000);

    it('session context sharing the reply moves into additionalContext beside the notice', () => {
        const r = dispatch('claude', {
            'notice-a': { effect: 'notification' },
            'context-b': { effect: 'context', args: ['context'] },
        });
        expect(r.status).toBe(0);
        const reply = JSON.parse(r.stdout) as { systemMessage?: string; hookSpecificOutput?: Record<string, string> };
        expect(reply.systemMessage).toBe('fixture notice for the user');
        expect(reply.hookSpecificOutput?.['hookEventName']).toBe('SessionStart');
        expect(reply.hookSpecificOutput?.['additionalContext']).toBe('fixture context block');
    }, 120_000);

    it('several notices arrive in manifest order, each capped at 1,000 characters', () => {
        const r = dispatch('claude', {
            'notice-long': { effect: 'notification', args: ['long'] },
            'notice-a': { effect: 'notification' },
        });
        const message = (JSON.parse(r.stdout) as Record<string, string>)['systemMessage'] as string;
        const [first, second] = message.split('\n');
        expect(first).toBe('x'.repeat(1000));
        expect(second).toBe('fixture notice for the user');
    }, 120_000);

    // A host reads stdout only on exit 0, so a refusal carries no notice.
    it('a refused call carries no notice', () => {
        const r = dispatch(
            'claude',
            {
                guard: { effect: 'permission', severity: 'blocking', script: 'tests/hooks/fixtures/concern_exits_3.ts' },
                'notice-a': { effect: 'notification' },
            },
            'pre_tool_use',
        );
        expect(r.status).not.toBe(0);
        expect(r.stdout).not.toContain('fixture notice');
    }, 120_000);

    // `update-notice` records that it reported once it has replied. That is only
    // true if nothing on its slot can withhold the reply: on a slot with no host
    // refusal code the emission always exits 0, so even a refusing concern
    // beside it leaves the notice delivered.
    it('on session_start a refusing concern beside the notice does not withhold it', () => {
        const r = dispatch('claude', {
            guard: { effect: 'permission', severity: 'blocking', script: 'tests/hooks/fixtures/concern_exits_3.ts' },
            'notice-a': { effect: 'notification' },
        });
        expect(r.status).toBe(0);
        expect((JSON.parse(r.stdout) as Record<string, string>)['systemMessage']).toBe('fixture notice for the user');
    }, 120_000);

    it('update-notice is bound only on slots where no host refusal can withhold its notice', () => {
        const manifest = parseYaml(fs.readFileSync(path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml'), 'utf-8')) as {
            platforms: Record<string, Record<string, unknown>>;
        };
        const slots: string[] = [];
        for (const [host, events] of Object.entries(manifest.platforms)) {
            for (const [event, concerns] of Object.entries(events)) {
                if (Array.isArray(concerns) && concerns.includes('update-notice')) slots.push(`${host}:${event}`);
            }
        }
        expect(slots.length).toBeGreaterThan(0);
        for (const slot of slots) {
            const [host, event] = slot.split(':') as [string, string];
            expect(isBlockCapable(host, event), slot).toBe(false);
        }
    });

    // The concern learns its host from the envelope the dispatcher builds out of
    // its own `--platform`, not from anything the host payload claims.
    it('the platform a concern reads is the one the dispatcher was invoked with', () => {
        const r = dispatch('claude', { 'notice-a': { effect: 'notification', args: ['echo-platform'] } });
        expect((JSON.parse(r.stdout) as Record<string, string>)['systemMessage']).toBe('platform=claude');
    }, 120_000);
});

describe('withUserNotice', () => {
    const EMISSION = '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"from a warn"}}\n';

    it('is the old output byte for byte when there is nothing to say', () => {
        expect(withUserNotice('claude', 'session_start', 'plain\n', EMISSION, '  ')).toBe(`plain\n${EMISSION}`);
    });

    it('merges context, an existing emission and a notice as structures', () => {
        const out = withUserNotice('claude', 'session_start', 'plain context\n', EMISSION, 'hi');
        expect(JSON.parse(out)).toEqual({
            hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: 'from a warn\n\nplain context' },
            systemMessage: 'hi',
        });
    });

    it('appends to a systemMessage the emission already carries rather than replacing it', () => {
        const out = withUserNotice('claude', 'stop', '', '{"systemMessage":"first"}\n', 'second');
        expect(JSON.parse(out)).toEqual({ systemMessage: 'first\nsecond' });
    });

    it('never reinterprets an emission that is not one JSON object', () => {
        expect(withUserNotice('claude', 'stop', '', 'not json\n', 'hi')).toBe('not json\n');
        expect(withUserNotice('claude', 'stop', '', '[1]\n', 'hi')).toBe('[1]\n');
    });

    it('never overwrites a field of the wrong type — the old output stands', () => {
        for (const emission of [
            '{"hookSpecificOutput":"text"}\n',
            '{"hookSpecificOutput":null}\n',
            '{"hookSpecificOutput":{"additionalContext":7}}\n',
            '{"systemMessage":{"x":1}}\n',
        ]) {
            expect(withUserNotice('claude', 'session_start', 'ctx\n', emission, 'hi')).toBe(`ctx\n${emission}`);
        }
    });

    it('accepts plain context on session_start only', () => {
        expect(withUserNotice('claude', 'stop', 'plain\n', '', 'hi')).toBe('plain\n');
    });

    it('drops the notice on a host without the field', () => {
        expect(withUserNotice('cursor', 'session_start', '', '', 'hi')).toBe('');
    });
});
