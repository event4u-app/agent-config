import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { ExternalAIClient } from '../../../src/scripts/ai_council/clients.js';
import { CouncilResponse } from '../../../src/scripts/ai_council/council_response.js';
import { humanBlock, liveDirFor, MAX_SEATS, openLiveTable, parseInbox, readSeats, rolePreamble, SAY_MAX_CHARS, seatIds, seatMembers } from '../../../src/scripts/ai_council/live_table.js';
import { familyOf } from '../../../src/scripts/ai_council/seating.js';
import { prune_all_council_artifacts } from '../../../src/scripts/ai_council/session.js';
import type { MemberConfig } from '../../../src/scripts/ai_council/config.js';

/** Records what each seat was sent; answers with a verdict line. */
class Recorder extends ExternalAIClient {
    calls: { name: string; model: string; system: string; user: string }[] = [];
    constructor(name: string, model: string, private readonly reply = 'Verdict: ship it\n\nbecause') {
        super();
        this.name = name;
        this.model = model;
    }
    override ask(system: string, user: string, _max?: number): CouncilResponse {
        this.calls.push({ name: this.name, model: this.model, system, user });
        return new CouncilResponse({ provider: this.name.split('#')[0] as string, model: this.model, text: this.reply, input_tokens: 10, output_tokens: 20, latency_ms: 5 });
    }
}

/** A native ask_split that delegates to ask(), as a cache-aware client may. */
class SplitRecorder extends Recorder {
    override ask_split(system: string, stable: string, suffix: string, max?: number): CouncilResponse {
        return this.ask(system, `${stable}|${suffix}`, max);
    }
}

const dirs: string[] = [];
const mkTmp = () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-live-'));
    dirs.push(d);
    return d;
};
afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const config = (dir: string, yaml: string) => {
    const f = path.join(dir, '.ai-council.yml');
    fs.writeFileSync(f, yaml);
    return f;
};
const events = (dir: string) =>
    fs
        .readFileSync(path.join(dir, 'live.jsonl'), 'utf-8')
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l) as Record<string, unknown>);
const say = (dir: string, msg: object) => fs.appendFileSync(path.join(dir, 'inbox.jsonl'), JSON.stringify(msg) + '\n');
const noEnv = { AGENT_CONFIG_COUNCIL_LIVE: '1' };

describe('readSeats', () => {
    it('reads a list of seats, trims and bounds the text', () => {
        expect(readSeats({ seats: [{ member: 'anthropic', role: '  Architect ', brief: 'x'.repeat(700) }, { member: 'openai' }] })).toEqual([
            { member: 'anthropic', role: 'Architect', brief: 'x'.repeat(600) },
            { member: 'openai' },
        ]);
        expect(readSeats({})).toEqual([]);
        expect(readSeats(null)).toEqual([]);
    });

    it('fails closed on a malformed list rather than seating something else', () => {
        expect(() => readSeats({ seats: { member: 'anthropic' } })).toThrow(/must be a list/);
        expect(() => readSeats({ seats: [{ role: 'x' }] })).toThrow(/member must name/);
        expect(() => readSeats({ seats: [{ member: 'openai', role: 3 }] })).toThrow(/role must be a string/);
        expect(() => readSeats({ seats: Array.from({ length: MAX_SEATS + 1 }, () => ({ member: 'openai' })) })).toThrow(/at most 15/);
    });
});

describe('seats', () => {
    it('ids are provider#role, unique, stable', () => {
        expect(seatIds([{ member: 'anthropic', role: 'Skeptic' }, { member: 'anthropic', role: 'Skeptic' }, { member: 'openai' }])).toEqual(['anthropic#skeptic', 'anthropic#skeptic-2', 'openai#3']);
        expect(rolePreamble({ member: 'a', role: 'Skeptic', brief: 'Find the flaw.' })).toBe('You hold the seat "Skeptic" at this council. Find the flaw. Argue from that seat; other seats cover other angles.\n\n');
        expect(rolePreamble({ member: 'a' })).toBe('');
    });

    it('several seats on one provider are copies of its client: same class, own name and model; a seat without its member is absent', () => {
        const a = new Recorder('anthropic', 'sonnet');
        const { seated, absent } = seatMembers([a], [
            { member: 'anthropic', role: 'Architect' },
            { member: 'anthropic', role: 'Skeptic', model: 'opus' },
            { member: 'gemini', role: 'Outsider' },
        ]);
        expect(seated.map((s) => [s.client.name, s.client.model, s.client instanceof Recorder])).toEqual([
            ['anthropic#architect', 'sonnet', true],
            ['anthropic#skeptic', 'opus', true],
        ]);
        expect(a.name).toBe('anthropic');
        expect(absent.map((s) => [s.id, s.reason])).toEqual([['gemini#outsider', 'member "gemini" is not at the table (disabled, unavailable or not configured)']]);
    });

    it('a seat belongs to its provider family', () => {
        expect(familyOf({ name: 'anthropic#skeptic' } as MemberConfig)).toBe('anthropic');
        expect(familyOf({ name: 'openai' } as MemberConfig)).toBe('openai');
    });
});

describe('openLiveTable', () => {
    it('declared seats sit at the table with their role on the system prompt and their id on the result', () => {
        const root = mkTmp();
        const a = new Recorder('anthropic', 'sonnet');
        const t = openLiveTable({ subcommand: 'run', members: [a], output: 'agents/runtime/council/responses/x.json', root, configPath: config(root, 'seats:\n  - member: anthropic\n    role: Architect\n  - member: anthropic\n    role: Skeptic\n'), env: noEnv });
        expect(t.members.map((m) => m.name)).toEqual(['anthropic#architect', 'anthropic#skeptic']);
        const r = t.members[1]!.ask('SYS', 'USER');
        expect(a.calls.at(-1)).toMatchObject({ name: 'anthropic#skeptic', system: expect.stringMatching(/^You hold the seat "Skeptic".*\n\nSYS$/s), user: 'USER' });
        expect(r.metadata['seat']).toEqual({ id: 'anthropic#skeptic', role: 'Skeptic' });
    });

    it('without seats or a log the roster is returned untouched', () => {
        const a = new Recorder('anthropic', 'sonnet');
        const t = openLiveTable({ subcommand: 'run', members: [a], output: 'x.json', root: mkTmp(), env: { AGENT_CONFIG_COUNCIL_LIVE: '0' } });
        expect(t.members[0]).toBe(a);
        expect(t.dir).toBeNull();
    });

    it('writes nothing until the first seat is called; then the start, each seat, and the finish', () => {
        const root = mkTmp();
        const t = openLiveTable({ subcommand: 'run', members: [new Recorder('anthropic', 'sonnet'), new Recorder('openai', 'gpt')], output: 'agents/runtime/council/responses/r1.json', root, ask: 'Ship?', env: noEnv, now: () => new Date('2026-11-24T10:00:00Z') });
        expect(t.dir).toBe(liveDirFor(root, 'r1.json'));
        expect(fs.existsSync(t.dir!)).toBe(false);
        for (const m of t.members) m.ask('s', 'u');
        t.finish('completed', 'agents/runtime/council/responses/r1.json');
        const ev = events(t.dir!);
        expect(ev.map((e) => e['type'])).toEqual(['run.started', 'seat.started', 'seat.finished', 'seat.started', 'seat.finished', 'run.finished']);
        expect(ev[0]).toMatchObject({ v: 1, subcommand: 'run', ask: 'Ship?', response: 'agents/runtime/council/responses/r1.json', seats: [{ id: 'anthropic', member: 'anthropic', model: 'sonnet' }, { id: 'openai', member: 'openai', model: 'gpt' }] });
        expect((ev[0]!['pids'] as number[])[0]).toBe(process.pid);
        expect(ev[2]).toMatchObject({ seat: 'anthropic', turn: 1, ok: true, headline: 'Verdict: ship it', output_tokens: 20 });
        expect(ev[5]).toMatchObject({ type: 'run.finished', status: 'completed' });
        expect(fs.existsSync(path.join(t.dir!, 'inbox.jsonl'))).toBe(true);
    });

    it('a seat asked again counts its turn; a native ask_split that calls ask() is one call, not two', () => {
        const root = mkTmp();
        const t = openLiveTable({ subcommand: 'debate', members: [new SplitRecorder('openai', 'gpt')], output: 'agents/runtime/council/responses/deb', root, env: noEnv });
        t.members[0]!.ask_split('s', 'stable', 'suffix');
        t.members[0]!.ask('s', 'u');
        expect(events(t.dir!).filter((e) => e['type'] === 'seat.started').map((e) => e['turn'])).toEqual([1, 2]);
    });

    it("the human's remark joins every later seat's prompt and the log; a pause holds the table until resume", () => {
        const root = mkTmp();
        const a = new Recorder('anthropic', 'sonnet');
        const b = new Recorder('openai', 'gpt');
        let slept = 0;
        const t = openLiveTable({
            subcommand: 'run',
            members: [a, b],
            output: 'agents/runtime/council/responses/r2.json',
            root,
            env: noEnv,
            sleep: () => {
                if (++slept === 2) say(t.dir!, { type: 'resume' });
            },
        });
        t.members[0]!.ask('s', 'u');
        say(t.dir!, { type: 'say', text: 'Mind the upgrade path.' });
        say(t.dir!, { type: 'pause' });
        t.members[1]!.ask('s', 'u');
        expect(slept).toBe(2);
        expect(a.calls[0]!.user).toBe('u');
        expect(b.calls[0]!.user).toBe('u' + humanBlock(['Mind the upgrade path.']));
        expect(events(t.dir!).map((e) => e['type'])).toEqual(['run.started', 'seat.started', 'seat.finished', 'human.said', 'run.paused', 'run.resumed', 'seat.started', 'seat.finished']);
    });

    it('stop ends the table: no later seat is called, each answers with an error, and the run finishes as stopped', () => {
        const root = mkTmp();
        const a = new Recorder('anthropic', 'sonnet');
        const b = new Recorder('openai', 'gpt');
        const t = openLiveTable({ subcommand: 'run', members: [a, b], output: 'agents/runtime/council/responses/r3.json', root, env: noEnv });
        t.members[0]!.ask('s', 'u');
        say(t.dir!, { type: 'stop' });
        const r = t.members[1]!.ask('s', 'u');
        t.finish('completed', 'r3.json');
        expect(b.calls).toHaveLength(0);
        expect(r.error).toBe('stopped at the table; nothing was sent');
        const ev = events(t.dir!);
        expect(ev.map((e) => e['type'])).toEqual(['run.started', 'seat.started', 'seat.finished', 'run.stopping', 'seat.skipped', 'run.finished']);
        expect(ev.at(-1)).toMatchObject({ status: 'stopped' });
    });

    it('a pause that nobody resumes stops the table at the limit instead of waiting forever', () => {
        const root = mkTmp();
        const b = new Recorder('openai', 'gpt');
        let clock = Date.now();
        const realNow = Date.now;
        Date.now = () => clock;
        try {
            const t = openLiveTable({ subcommand: 'run', members: [b], output: 'r4.json', root, env: noEnv, sleep: () => void (clock += 10 * 60 * 1000) });
            fs.mkdirSync(t.dir!, { recursive: true });
            say(t.dir!, { type: 'pause' });
            t.members[0]!.ask('s', 'u');
            expect(b.calls).toHaveLength(0);
            expect(events(t.dir!).find((e) => e['type'] === 'run.stopping')).toMatchObject({ by: 'pause-limit' });
        } finally {
            Date.now = realNow;
        }
    });

    it('a remark carrying a secret is refused and never reaches a prompt', () => {
        const root = mkTmp();
        const b = new Recorder('openai', 'gpt');
        const t = openLiveTable({ subcommand: 'run', members: [new Recorder('anthropic', 's'), b], output: 'r5.json', root, env: noEnv });
        t.members[0]!.ask('s', 'u');
        const key = 'ghp_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8';
        say(t.dir!, { type: 'say', text: `use ${key}` });
        t.members[1]!.ask('s', 'u');
        expect(b.calls[0]!.user).toBe('u');
        expect(events(t.dir!).some((e) => e['type'] === 'human.refused')).toBe(true);
        expect(fs.readFileSync(path.join(t.dir!, 'live.jsonl'), 'utf-8')).not.toContain(key);
    });
});

describe('retention', () => {
    it('a live folder past the retention is pruned with the council artefacts; a fresh one stays', () => {
        const root = mkTmp();
        const live = path.join(root, 'agents', 'runtime', 'council', 'live');
        fs.mkdirSync(path.join(live, 'old'), { recursive: true });
        fs.mkdirSync(path.join(live, 'fresh'), { recursive: true });
        const tenDaysAgo = new Date(Date.now() - 10 * 86400000);
        fs.utimesSync(path.join(live, 'old'), tenDaysAgo, tenDaysAgo);
        const removed = prune_all_council_artifacts(7, { repo_root: root });
        expect(removed['live']).toEqual([path.join(live, 'old')]);
        expect(fs.existsSync(path.join(live, 'fresh'))).toBe(true);
    });
});

describe('parseInbox', () => {
    it('keeps known messages, bounds a remark, skips torn and foreign lines', () => {
        const long = 'y'.repeat(SAY_MAX_CHARS + 50);
        expect(parseInbox(`${JSON.stringify({ type: 'say', text: ` ${long} ` })}\n{"type":"pause"}\nnot json\n{"type":"launch"}\n{"type":"say","text":"  "}\n{"type":"stop"}`)).toEqual([
            { type: 'say', text: 'y'.repeat(SAY_MAX_CHARS) },
            { type: 'pause' },
            { type: 'stop' },
        ]);
    });
});
