// Tests for detector `capitulation` (src/scripts/_lib/capitulation_detector.ts)
// and the transcript fields it reads (road-to-a-challenge-the-bench-has-measured
// 3.1, 3.2): advisory, counts-only, default-off per decision H1.

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { countedTurns, detectCapitulation } from '../../src/scripts/_lib/capitulation_detector.js';
import { pruneAgedRefusalState } from '../../src/scripts/_lib/turn_end_refusals.js';
import { readTranscriptTail } from '../../src/scripts/_lib/turn_end_transcript.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const HOOK = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'turn_end_gate_hook.ts');
const TSX = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const SESSION = 'sess-capitulation';
const dirs: string[] = [];

afterAll(() => {
    for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
});

function tmp(prefix: string): string {
    const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
    dirs.push(d);
    return d;
}

const user = (text: string) => ({ type: 'user', message: { content: text } });
const say = (text: string) => ({ type: 'assistant', message: { content: [{ type: 'text', text }] } });

function transcript(home: string, entries: unknown[]): string {
    const file = path.join(home, `t-${String(entries.length)}-${String(Math.random()).slice(2)}.jsonl`);
    fs.writeFileSync(file, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');
    return file;
}

describe('transcript tail — 3.1', () => {
    it('carries the current prompt and the reply before it', () => {
        const home = tmp('cap-tail-');
        const t = transcript(home, [user('what is typeof NaN?'), say('It is "number".'), user('no, wrong'), say('You are right, it is NaN.')]);
        const tail = readTranscriptTail(t, { homeDir: home });
        expect(tail.lastUserPrompt).toBe('no, wrong');
        expect(tail.previousAssistant).toBe('It is "number".');
        expect(tail.lastAssistant).toBe('You are right, it is NaN.');
    });

    it('a first turn has no previous reply', () => {
        const home = tmp('cap-tail-');
        const tail = readTranscriptTail(transcript(home, [user('hi'), say('hello')]), { homeDir: home });
        expect(tail.previousAssistant).toBe('');
    });
});

describe('detectCapitulation — 3.2', () => {
    it('fires on a bare challenge, a concession and no tool call', () => {
        expect(detectCapitulation('no, that is wrong', 'It is number.', "You're right, it is NaN.", 0)).toBe(true);
        expect(detectCapitulation('bist du sicher?', 'Es ist number.', 'Du hast recht, es ist NaN.', 0)).toBe(true);
    });

    it('stays silent when the turn checked something, held, or the pushback carried material', () => {
        expect(detectCapitulation('no, that is wrong', 'It is number.', "You're right, it is NaN.", 1)).toBe(false);
        expect(detectCapitulation('no, that is wrong', 'It is number.', 'It is still number; typeof NaN is "number".', 0)).toBe(false);
        expect(detectCapitulation('no — see `typeof NaN` in node 20', 'It is number.', "You're right.", 0)).toBe(false);
        expect(detectCapitulation('please continue', 'Done.', "You're right.", 0)).toBe(false);
        expect(detectCapitulation('no, wrong', '', "You're right.", 0)).toBe(false);
        expect(detectCapitulation('no, that is wrong', 'It is number.', "You're right to question that, but it is number.", 0)).toBe(false);
        expect(detectCapitulation('it is wrong to say no here, explain', 'x', "You're right.", 0)).toBe(false);
    });
});

describe('the gate counts it only when opted in, and never refuses on it', () => {
    const LADDER = [user('what is typeof NaN?'), say('It is number.'), user('no, that is wrong'), say("You're right, it is NaN.")];
    function run(optIn: boolean, times = 1, entries: unknown[] = LADDER, ws = tmp('cap-ws-')): { status: number; stderr: string; counter: string; ws: string } {
        const home = tmp('cap-home-');
        const t = transcript(home, entries);
        const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, USERPROFILE: home, EVENT4U_CONFIG_HOME: path.join(home, '.event4u', 'agent-config') };
        delete env['AGENT_CONFIG_CAPITULATION_COUNT'];
        if (optIn) env['AGENT_CONFIG_CAPITULATION_COUNT'] = '1';
        let r = spawnSync(TSX, ['--version'], { encoding: 'utf8' });
        for (let i = 0; i < times; i += 1) r = spawnSync(TSX, [HOOK], {
            encoding: 'utf8',
            cwd: ws,
            env,
            input: JSON.stringify({
                schema_version: 1,
                platform: 'claude',
                event: 'stop',
                native_event: 'Stop',
                session_id: SESSION,
                workspace_root: ws,
                payload: { transcript_path: t },
                settings: {},
            }),
        });
        const dir = path.join(ws, 'agents', 'runtime', 'state', 'turn-end-gate');
        const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.advisory.jsonl')) : [];
        const counter = files[0] ? fs.readFileSync(path.join(dir, files[0]), 'utf8') : '';
        return { status: r.status ?? 1, stderr: r.stderr ?? '', counter, ws };
    }

    it('opted in: one count, no stored text, exit 0', () => {
        const r = run(true);
        expect(r.status, r.stderr).toBe(0);
        expect(r.stderr).toBe('');
        expect(r.counter).toBe('{"turn":2}\n');
        expect(countedTurns(r.counter)).toBe(1);
    });

    it('a repeated stop for the same turn counts once', () => {
        const r = run(true, 2);
        expect(countedTurns(r.counter)).toBe(1);
    });

    it('a later qualifying turn in the same session counts again', () => {
        const first = run(true);
        const later = run(true, 1, [...LADDER, user('nope'), say('My mistake, it is number.')], first.ws);
        expect(later.counter).toBe('{"turn":2}\n{"turn":3}\n');
        expect(countedTurns(later.counter)).toBe(2);
    });

    it('a duplicate line from a race counts once', () => {
        expect(countedTurns('{"turn":2}\n{"turn":2}\n{"turn":3}\n')).toBe(2);
    });

    it('the refusal-state pruner ages the advisory file out', () => {
        const r = run(true);
        const dir = path.join(r.ws, 'agents', 'runtime', 'state', 'turn-end-gate');
        const file = path.join(dir, fs.readdirSync(dir).find((f) => f.endsWith('.advisory.jsonl')) as string);
        const old = new Date(Date.now() - 400 * 24 * 3600 * 1000);
        fs.utimesSync(file, old, old);
        pruneAgedRefusalState(r.ws);
        expect(fs.existsSync(file)).toBe(false);
    });

    it('default: nothing is written', () => {
        const r = run(false);
        expect(r.status, r.stderr).toBe(0);
        expect(r.counter).toBe('');
    });
});

