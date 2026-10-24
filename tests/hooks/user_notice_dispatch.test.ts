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

import { isBlockCapable, withUserNotice, writeStdout } from '../../src/scripts/hooks/host_semantics.js';
import { collectUserNotice, USER_NOTICE_KEY, type NoticeBatch } from '../../src/scripts/hooks/user_notice.js';

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
): { status: number | null; stdout: string; receipts: Record<string, string> } {
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
        env: { ...process.env, AGENT_CONFIG_PACKAGE_ROOT: REPO_ROOT, EVENT4U_CONFIG_HOME: path.join(dir, 'home') },
    });
    return { status: r.status, stdout: r.stdout ?? '', receipts: receiptsIn(path.join(dir, 'home')) };
}

function receiptsIn(home: string): Record<string, string> {
    const out: Record<string, string> = {};
    if (!fs.existsSync(home)) return out;
    for (const f of fs.readdirSync(home)) {
        if (f.endsWith('.delivered')) out[f] = ((r: { session_id: string; notice_id: string }) => `${r.session_id}/${r.notice_id}`)(JSON.parse(fs.readFileSync(path.join(home, f), 'utf-8')));
    }
    return out;
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

    // The receipt is the only thing a concern may count a notice as shown by.
    it('a notice put into the output leaves a receipt naming the session; a dropped one leaves none', () => {
        const shown = dispatch('claude', { 'notice-a': { effect: 'notification' } });
        expect(shown.receipts).toEqual({ 'user-notice-notice-a.delivered': 'user-notice-test/fixture-id' });
        expect(dispatch('copilot', { 'notice-a': { effect: 'notification' } }).receipts).toEqual({});
        const refused = dispatch(
            'claude',
            {
                guard: { effect: 'permission', severity: 'blocking', script: 'tests/hooks/fixtures/concern_exits_3.ts' },
                'notice-a': { effect: 'notification' },
            },
            'pre_tool_use',
        );
        expect(refused.receipts).toEqual({});
        expect(dispatch('claude', { 'context-a': { effect: 'context' } }).receipts).toEqual({});
    }, 120_000);

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

describe('writeStdout', () => {
    it('writes a receipt only after the output was written, and none when the write throws', () => {
        const home = fs.mkdtempSync(path.join(os.tmpdir(), 'user-notice-home-'));
        tmpDirs.push(home);
        const receipt = path.join(home, 'user-notice-n.delivered');
        const prev = process.env['EVENT4U_CONFIG_HOME'];
        process.env['EVENT4U_CONFIG_HOME'] = home;
        try {
            const batch: NoticeBatch = [{ concern: 'n', text: 'hi', id: 'i1' }];
            const emission = { exit: 0, stdout: '', stderr: '' };
            const seenAtWrite: boolean[] = [];
            writeStdout('claude', 'session_start', '', emission, batch, 's1', () => void seenAtWrite.push(fs.existsSync(receipt)));
            expect(seenAtWrite).toEqual([false]);
            expect(JSON.parse(fs.readFileSync(receipt, 'utf-8'))).toMatchObject({ session_id: 's1', notice_id: 'i1' });
            fs.rmSync(receipt);
            const failing = (): never => {
                throw new Error('EPIPE');
            };
            expect(() => writeStdout('claude', 'session_start', '', emission, batch, 's1', failing)).toThrow('EPIPE');
            expect(fs.existsSync(receipt)).toBe(false);
        } finally {
            if (prev === undefined) delete process.env['EVENT4U_CONFIG_HOME'];
            else process.env['EVENT4U_CONFIG_HOME'] = prev;
        }
    });
});

describe('collectUserNotice', () => {
    const notification = (name: string) => ({ name, effect: 'notification' });
    const keep = (t: string) => t;

    // The receipt list is the batch itself, so a concern whose text did not
    // survive cleaning is not in it and cannot be given a receipt.
    it('a notice cleaned to nothing is not kept, so only the surviving concern can be receipted', () => {
        const batch: NoticeBatch = [];
        const clean = (t: string) => (t === 'secret' ? '   ' : t);
        collectUserNotice(batch, notification('erased'), { [USER_NOTICE_KEY]: 'secret' }, clean);
        collectUserNotice(batch, notification('kept'), { [USER_NOTICE_KEY]: 'visible' }, clean);
        expect(batch).toEqual([{ concern: 'kept', text: 'visible', id: '' }]);
    });

    it('caps by code point and never splits a surrogate pair', () => {
        const batch: NoticeBatch = [];
        collectUserNotice(batch, notification('n'), { [USER_NOTICE_KEY]: `${'x'.repeat(999)}🚀y` }, keep);
        const text = batch[0]?.text ?? '';
        expect(Array.from(text)).toHaveLength(1000);
        expect(text.endsWith('🚀')).toBe(true);
        expect(text.isWellFormed()).toBe(true);
    });

    it('ignores every effect but notification', () => {
        const batch: NoticeBatch = [];
        collectUserNotice(batch, { name: 'c', effect: 'context' }, { [USER_NOTICE_KEY]: 'hi' }, keep);
        expect(batch).toEqual([]);
    });
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
