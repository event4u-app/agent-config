/**
 * The shipped Claude Code module stays a Class H reader (ADR-302)
 * (road-to-a-mod-that-decides-nothing-new step 4.2).
 *
 * The first block reads the module source and runs everywhere — it is the pin
 * CI actually enforces, because CI runners have no Claude Code CLI. The second
 * block runs the host's own validator and harness when `claude` is on PATH and
 * is skipped, never passed, when it is not.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

const MOD = path.resolve(__dirname, '..', '..', 'src', 'templates', 'claude-mod');
const SOURCE = path.join(MOD, 'module', 'register.ts');

const ALLOWED_EVENTS = new Set(['turn.complete']);
const ALLOWED_CALLS = new Set(['$.fs.exists', '$.fs.read', '$.ui.status']);

export function hookedEvents(source: string): string[] {
    return [...source.matchAll(/\bon\(\s*['"]([a-z.]+)['"]/g)].map((m) => m[1] as string);
}

export function hostCalls(source: string): string[] {
    return [...new Set([...source.matchAll(/\$\.[a-zA-Z]+\.[a-zA-Z]+/g)].map((m) => m[0]))].sort();
}

export function violations(source: string): string[] {
    const out: string[] = [];
    for (const e of hookedEvents(source)) if (!ALLOWED_EVENTS.has(e)) out.push(`event ${e}`);
    for (const c of hostCalls(source)) if (!ALLOWED_CALLS.has(c)) out.push(`call ${c}`);
    if (/\bengine\.create\b/.test(source)) out.push('engine.create');
    if (/\.catch\(/.test(source)) out.push('guarding .catch');
    return out;
}

describe('the shipped module source', () => {
    const source = fs.readFileSync(SOURCE, 'utf-8');

    it('hooks only turn.complete and calls only the read and status set', () => {
        expect(hookedEvents(source)).toEqual(['turn.complete']);
        expect(violations(source)).toEqual([]);
    });

    it('refuses a process, network, model or write call and any other event', () => {
        expect(violations(`${source}\n$.process.spawn('x')`)).toContain('call $.process.spawn');
        expect(violations(`${source}\nawait $.http.fetch('u')`)).toContain('call $.http.fetch');
        expect(violations(`${source}\n$.model.call({})`)).toContain('call $.model.call');
        expect(violations(`${source}\n$.fs.write('a', 'b')`)).toContain('call $.fs.write');
        expect(violations(`${source}\non('tool.check', h)`)).toContain('event tool.check');
        expect(violations(`${source}\non('prompt.submit', h)`)).toContain('event prompt.submit');
    });
});

const hasClaude = spawnSync('claude', ['--version'], { encoding: 'utf-8' }).status === 0;

describe.skipIf(!hasClaude)('the host validator and harness (skipped: Claude Code CLI not on PATH)', () => {
    it('declares exactly the pinned call surface', () => {
        const r = spawnSync('claude', ['plugin', 'validate', MOD], { encoding: 'utf-8' });
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('hooks: turn.complete');
        expect(r.stdout).toContain('calls: $.fs.exists, $.fs.read, $.ui.status');
    }, 60_000);

    it('passes its own harness tests', () => {
        const r = spawnSync('claude', ['plugin', 'test', MOD], { encoding: 'utf-8' });
        expect(r.status).toBe(0);
        expect(`${r.stdout}${r.stderr}`).toMatch(/3 pass/);
    }, 60_000);
});
