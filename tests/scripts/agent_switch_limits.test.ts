/**
 * road-to-a-link-with-agent-switch 3.2 — the limits read.
 *
 * `parseLimits` is exercised directly over contract-shaped reports; the read
 * itself goes through a real `agent-switch` executable on an injected PATH
 * (FAKE_AS_LIMITS scripts the report), over MCP and over the CLI fallback.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { agentSwitchLimits, parseLimits } from '../../src/scripts/_lib/agent_switch_limits.js';

const FAKE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'fake_agent_switch.mjs');
const dirs: string[] = [];
afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function env(extra: Record<string, string> = {}): Record<string, string> {
    const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'as-limits-'));
    dirs.push(bin);
    const exe = path.join(bin, 'agent-switch');
    fs.writeFileSync(exe, `#!/bin/sh\nexec "${process.execPath}" "${FAKE}" "$@"\n`, 'utf-8');
    fs.chmodSync(exe, 0o755);
    return { PATH: `${bin}${path.delimiter}${path.dirname(process.execPath)}`, ...extra };
}

const AT = '2026-11-07T12:00:00Z';
const RESET = '2026-11-07T15:00:00Z';

function account(id: string, over: Record<string, unknown> = {}): Record<string, unknown> {
    const [provider, name] = id.split('/');
    return {
        id,
        provider,
        name,
        disabled: false,
        usable: true,
        why: null,
        stale: false,
        observedAt: AT,
        thresholdPct: 90,
        windows: [{ key: 'five_hour', fill: 42, resetsAt: RESET, resetPassed: false }],
        ...over,
    };
}

function report(accounts: unknown[], over: Record<string, unknown> = {}): Record<string, unknown> {
    return { v: 1, at: AT, accounts, ...over };
}

describe('3.2 parseLimits', () => {
    it('reads a contract-shaped report', () => {
        const r = parseLimits(report([account('claude/work'), account('codex/home', { usable: false, why: 'full' })]));
        expect(r?.at).toBe(AT);
        expect(r?.accounts.map((a) => [a.id, a.usable, a.why])).toEqual([
            ['claude/work', true, null],
            ['codex/home', false, 'full'],
        ]);
        expect(r?.accounts[0]?.windows).toEqual([{ key: 'five_hour', fill: 42, resetsAt: RESET }]);
    });

    it('a stale account is unknown: left out, never usable and never full', () => {
        const r = parseLimits(report([account('claude/work', { stale: true }), account('claude/home')]));
        expect(r?.accounts.map((a) => a.id)).toEqual(['claude/home']);
    });

    it('a window without a fill is left out, the account stays', () => {
        const r = parseLimits(
            report([
                account('claude/work', {
                    windows: [
                        { key: 'five_hour', fill: null, resetsAt: RESET, resetPassed: true },
                        { key: 'seven_day', fill: 30, resetsAt: null, resetPassed: false },
                    ],
                }),
            ]),
        );
        expect(r?.accounts[0]?.windows).toEqual([{ key: 'seven_day', fill: 30, resetsAt: null }]);
    });

    it('drops an account it cannot read rather than guessing its fields', () => {
        const r = parseLimits(
            report([
                account('claude/../x'),
                account('claude/ok', { usable: 'yes' }),
                account('claude/fill', { windows: [{ key: 'five_hour', fill: 140, resetsAt: RESET }] }),
                'not an object',
                account('claude/kept'),
            ]),
        );
        expect(r?.accounts.map((a) => a.id)).toEqual(['claude/fill', 'claude/kept']);
        expect(r?.accounts[0]?.windows).toEqual([]);
    });

    it('is null for anything that is not a version-1 report', () => {
        expect(parseLimits(null)).toBeNull();
        expect(parseLimits('text')).toBeNull();
        expect(parseLimits([])).toBeNull();
        expect(parseLimits(report([account('claude/a')], { v: 2 }))).toBeNull();
        expect(parseLimits(report([account('claude/a')], { accounts: 'none' }))).toBeNull();
        expect(parseLimits(report([account('claude/a')], { at: 7 }))).toBeNull();
    });
});

describe('3.2 agentSwitchLimits', () => {
    const body = JSON.stringify(report([account('claude/work'), account('claude/home', { stale: true })]));

    it('reads the report over MCP', async () => {
        const r = await agentSwitchLimits(undefined, { env: env({ FAKE_AS_LIMITS: body }) });
        expect(r?.accounts.map((a) => a.id)).toEqual(['claude/work']);
    });

    it('reads it over the CLI when the MCP server fails', async () => {
        const r = await agentSwitchLimits('claude', { env: env({ FAKE_AS_LIMITS: body, FAKE_AS_MCP: 'broken' }) });
        expect(r?.accounts.map((a) => a.id)).toEqual(['claude/work']);
    });

    it('is null when the link is absent, off, or answers with something else', async () => {
        expect(await agentSwitchLimits(undefined, { env: env({ FAKE_AS_LINK: 'off', FAKE_AS_LIMITS: body }) })).toBeNull();
        expect(await agentSwitchLimits(undefined, { env: { PATH: '/nonexistent' } })).toBeNull();
        expect(await agentSwitchLimits(undefined, { env: env({ FAKE_AS_LIMITS: '{"v":2}' }) })).toBeNull();
        expect(await agentSwitchLimits(undefined, { env: env() })).toBeNull();
    });
});
