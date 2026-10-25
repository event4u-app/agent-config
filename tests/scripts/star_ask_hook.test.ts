/**
 * The `star-ask` session concern — ADR-301 (owner ruling, amends ADR-286 § D2).
 *
 * What is asserted: it is registered like `update-notice` (advisory,
 * fail-open notification, claude session_start only); it never asks before the
 * grace period, never twice inside the interval, never once the user said they
 * starred or switched it off; an ask counts the moment it is emitted, and is
 * never emitted when that cannot be recorded;
 * and it reads settings from the user-global layers it is handed, nothing else.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { USER_NOTICE_HOSTS, USER_NOTICE_ID_KEY, USER_NOTICE_KEY } from '../../src/scripts/hooks/user_notice.js';
import {
    ASK_INTERVAL_DAYS,
    CONCERN,
    FIRST_ASK_GRACE_DAYS,
    readStarAskSettings,
    readStarAskState,
    REPO_URL,
    runStarAsk,
    writeStarAskState,
    type StarAskDeps,
} from '../../src/scripts/star_ask_hook.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const MANIFEST = path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml');
const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date('2026-11-01T09:00:00.000Z');

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'star-ask-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

interface Harness {
    readonly out: string[];
    run(over?: Partial<StarAskDeps>): ReturnType<typeof runStarAsk>;
}

function harness(): Harness {
    const h: Harness = {
        out: [],
        run: (over = {}) =>
            runStarAsk({
                sessionId: 'session-1',
                viaHost: true,
                env: {},
                settings: { mode: 'monthly', starred: false },
                statePath: path.join(tmp, 'star-ask.json'),
                now: T0,
                notice: { write: (t) => void h.out.push(t) },
                ...over,
            }),
    };
    return h;
}

describe('registration', () => {
    const manifest = parseYaml(fs.readFileSync(MANIFEST, 'utf-8')) as {
        concerns: Record<string, Record<string, unknown>>;
        platforms: Record<string, Record<string, string[]>>;
    };

    it('is an advisory, fail-open notification', () => {
        expect(manifest.concerns[CONCERN]).toMatchObject({
            script: 'src/scripts/star_ask_hook.ts',
            fail_closed: false,
            severity: 'advisory',
            effect: 'notification',
        });
    });

    it('is bound on session_start of the hosts with a user channel, and nowhere else', () => {
        const bound: string[] = [];
        for (const [host, events] of Object.entries(manifest.platforms)) {
            for (const [event, concerns] of Object.entries(events)) {
                if (Array.isArray(concerns) && concerns.includes(CONCERN)) bound.push(`${host}:${event}`);
            }
        }
        expect(bound).toEqual([...USER_NOTICE_HOSTS].map((h) => `${h}:session_start`));
    });
});

describe('cadence', () => {
    it('records the first session and asks nothing', () => {
        const h = harness();
        expect(h.run()).toEqual({ asked: false, reason: 'first seen' });
        expect(h.out).toEqual([]);
        expect(readStarAskState(path.join(tmp, 'star-ask.json')).first_seen_at).toBe(T0.toISOString());
    });

    it('stays silent inside the grace period', () => {
        const h = harness();
        h.run();
        expect(h.run({ now: new Date(T0.getTime() + (FIRST_ASK_GRACE_DAYS - 1) * DAY) })).toEqual({ asked: false, reason: 'grace period' });
        expect(h.out).toEqual([]);
    });

    it('asks once the grace period is over, as one user_notice reply with the repository link', () => {
        const h = harness();
        h.run();
        const r = h.run({ now: new Date(T0.getTime() + FIRST_ASK_GRACE_DAYS * DAY) });
        expect(r.asked).toBe(true);
        expect(h.out).toHaveLength(1);
        const reply = JSON.parse(h.out[0] ?? '{}') as Record<string, string>;
        expect(reply[USER_NOTICE_KEY]).toContain(REPO_URL);
        expect(reply[USER_NOTICE_KEY]).toContain('star_ask.starred true');
        expect(typeof reply[USER_NOTICE_ID_KEY]).toBe('string');
    });

    it('a delivered ask is not repeated inside the interval, and is repeated after it', () => {
        const h = harness();
        h.run();
        const askedAt = new Date(T0.getTime() + FIRST_ASK_GRACE_DAYS * DAY);
        h.run({ now: askedAt });

        const inside = new Date(askedAt.getTime() + (ASK_INTERVAL_DAYS - 1) * DAY);
        expect(h.run({ sessionId: 'session-2', now: inside })).toEqual({ asked: false, reason: 'asked recently' });
        expect(readStarAskState(path.join(tmp, 'star-ask.json')).last_asked_at).toBe(askedAt.toISOString());

        const after = new Date(askedAt.getTime() + ASK_INTERVAL_DAYS * DAY);
        expect(h.run({ sessionId: 'session-3', now: after }).asked).toBe(true);
        expect(h.out).toHaveLength(2);
    });

    it('an emitted ask counts at once: with no delivery receipt it is still not repeated inside the interval', () => {
        // The council's refusal of 2026-10-25: gating the interval on the receipt
        // turned a missing receipt into an ask on every session.
        const h = harness();
        h.run();
        const askedAt = new Date(T0.getTime() + FIRST_ASK_GRACE_DAYS * DAY);
        h.run({ now: askedAt });
        for (let s = 2; s <= 5; s++) {
            expect(h.run({ sessionId: `session-${s}`, now: new Date(askedAt.getTime() + s * 60_000) })).toEqual({
                asked: false,
                reason: 'asked recently',
            });
        }
        expect(h.out).toHaveLength(1);
    });

    it('a state file that cannot be written means no ask at all', () => {
        const h = harness();
        const dir = path.join(tmp, 'ro');
        fs.mkdirSync(dir);
        const statePath = path.join(dir, 'star-ask.json');
        writeStarAskState(statePath, { first_seen_at: T0.toISOString(), last_asked_at: null });
        fs.chmodSync(dir, 0o500);
        fs.chmodSync(statePath, 0o400);
        try {
            const due = new Date(T0.getTime() + FIRST_ASK_GRACE_DAYS * DAY);
            for (let s = 1; s <= 3; s++) {
                expect(h.run({ statePath, sessionId: `session-${s}`, now: due })).toEqual({
                    asked: false,
                    reason: 'state not writable',
                });
            }
            expect(h.out).toEqual([]);
        } finally {
            fs.chmodSync(dir, 0o700);
        }
    });

    it('a session that finds the ask lock held by another session does not ask', () => {
        // The council's third refusal: atomic replacement is not mutual exclusion,
        // so two simultaneous session starts could both read "due" and both ask.
        const h = harness();
        h.run();
        fs.writeFileSync(path.join(tmp, 'star-ask.json.lock'), '');
        const due = new Date(T0.getTime() + FIRST_ASK_GRACE_DAYS * DAY);
        expect(h.run({ now: due })).toEqual({ asked: false, reason: 'another session is asking' });
        expect(h.out).toEqual([]);
    });

    it('a lock left behind by a crashed session expires, and an ask releases its lock', () => {
        const h = harness();
        h.run();
        const lock = path.join(tmp, 'star-ask.json.lock');
        fs.writeFileSync(lock, '');
        const old = new Date(Date.now() - 10 * 60_000);
        fs.utimesSync(lock, old, old);
        expect(h.run({ now: new Date(T0.getTime() + FIRST_ASK_GRACE_DAYS * DAY) }).asked).toBe(true);
        expect(fs.existsSync(lock)).toBe(false);
    });

    it('under the lock the state is read again, so a session that lost the race sees the ask already made', () => {
        const h = harness();
        h.run();
        const due = new Date(T0.getTime() + FIRST_ASK_GRACE_DAYS * DAY);
        const statePath = path.join(tmp, 'star-ask.json');
        // The winner records its ask between this session's first read and its lock.
        const r = h.run({
            now: due,
            beforeLock: () => void writeStarAskState(statePath, { first_seen_at: T0.toISOString(), last_asked_at: due.toISOString() }),
        });
        expect(r).toEqual({ asked: false, reason: 'asked recently' });
        expect(h.out).toEqual([]);
    });

    it('an unreadable or foreign-schema state file restarts the grace period instead of asking', () => {
        const p = path.join(tmp, 'star-ask.json');
        fs.writeFileSync(p, '{"schema": 99, "first_seen_at": "2020-01-01T00:00:00Z"}');
        const h = harness();
        expect(h.run()).toEqual({ asked: false, reason: 'first seen' });
        fs.writeFileSync(p, 'not json');
        expect(h.run()).toEqual({ asked: false, reason: 'first seen' });
    });
});

describe('what stops it', () => {
    const due = new Date(T0.getTime() + 365 * DAY);
    function primed(): Harness {
        writeStarAskState(path.join(tmp, 'star-ask.json'), { first_seen_at: T0.toISOString(), last_asked_at: null });
        return harness();
    }

    it.each([
        ['starred', { settings: { mode: 'monthly', starred: true } }],
        ['mode off', { settings: { mode: 'off', starred: false } }],
        ['kill switch', { env: { AGENT_CONFIG_NO_STAR_ASK: '1' } }],
        ['ci', { env: { CI: 'true' } }],
        ['ci', { env: { GITHUB_ACTIONS: 'true' } }],
        ['no user channel', { viaHost: false }],
        ['no user channel', { sessionId: null }],
    ] as const)('%s', (reason, over) => {
        const h = primed();
        expect(h.run({ now: due, ...(over as Partial<StarAskDeps>) })).toEqual({ asked: false, reason });
        expect(h.out).toEqual([]);
    });

    it('a suppressed session writes nothing', () => {
        const h = harness();
        h.run({ settings: { mode: 'monthly', starred: true } });
        expect(fs.existsSync(path.join(tmp, 'star-ask.json'))).toBe(false);
    });
});

describe('settings', () => {
    function layer(name: string, body: string): string {
        const p = path.join(tmp, name);
        fs.writeFileSync(p, body);
        return p;
    }

    it('defaults to monthly and not starred', () => {
        expect(readStarAskSettings([path.join(tmp, 'absent.yml')])).toEqual({ mode: 'monthly', starred: false });
    });

    it('reads star_ask from the layers it is given, later layers winning', () => {
        const a = layer('a.yml', 'star_ask:\n  mode: off\n');
        const b = layer('b.yml', 'star_ask:\n  starred: true\n');
        expect(readStarAskSettings([a, b])).toEqual({ mode: 'off', starred: true });
        const c = layer('c.yml', 'star_ask:\n  mode: monthly\n');
        expect(readStarAskSettings([a, b, c])).toEqual({ mode: 'monthly', starred: true });
        const quoted = layer('d.yml', 'star_ask:\n  mode: "off"\n');
        expect(readStarAskSettings([quoted]).mode).toBe('off');
    });

    it('ignores values outside the schema', () => {
        const a = layer('a.yml', 'star_ask:\n  mode: weekly\n  starred: "yes"\n');
        expect(readStarAskSettings([a])).toEqual({ mode: 'monthly', starred: false });
    });

    it('a layer that exists but cannot be parsed is unreadable, never "sets nothing"', () => {
        // The council's second refusal: an opt-out in a corrupted file must not
        // turn back into an ask.
        const a = layer('a.yml', 'star_ask:\n  starred: true\n');
        const b = layer('b.yml', 'star_ask: [unclosed\n');
        expect(readStarAskSettings([a, b]).unreadable).toBe(true);
    });

    it('an unreadable settings layer suppresses the ask', () => {
        writeStarAskState(path.join(tmp, 'star-ask.json'), { first_seen_at: T0.toISOString(), last_asked_at: null });
        const h = harness();
        const due = new Date(T0.getTime() + 365 * DAY);
        expect(h.run({ now: due, settings: { mode: 'monthly', starred: false, unreadable: true } })).toEqual({
            asked: false,
            reason: 'settings unreadable',
        });
        expect(h.out).toEqual([]);
    });
});

describe('end to end', () => {
    function run(home: string, platform: string): ReturnType<typeof spawnSync> {
        const env: NodeJS.ProcessEnv = { ...process.env, EVENT4U_CONFIG_HOME: home };
        delete env['CI'];
        delete env['GITHUB_ACTIONS'];
        delete env['AGENT_CONFIG_NO_STAR_ASK'];
        return spawnSync(path.join(REPO_ROOT, 'scripts-run'), ['src/scripts/star_ask_hook'], {
            cwd: tmp,
            env,
            input: JSON.stringify({ platform, event: 'session_start', session_id: 's1' }),
            encoding: 'utf-8',
        });
    }

    it('a claude envelope past the grace period yields a user_notice reply; a host without a user channel yields nothing', () => {
        const home = path.join(tmp, 'home');
        fs.mkdirSync(home, { recursive: true });
        const old = new Date(Date.now() - (FIRST_ASK_GRACE_DAYS + 1) * DAY).toISOString();
        writeStarAskState(path.join(home, 'star-ask.json'), { first_seen_at: old, last_asked_at: null });

        const viaCopilot = run(home, 'copilot');
        expect(viaCopilot.status).toBe(0);
        expect(viaCopilot.stdout).toBe('');

        const viaClaude = run(home, 'claude');
        expect(viaClaude.status).toBe(0);
        expect((JSON.parse(String(viaClaude.stdout)) as Record<string, string>)[USER_NOTICE_KEY]).toContain(REPO_URL);
        expect(readStarAskState(path.join(home, 'star-ask.json')).last_asked_at).not.toBeNull();
    });

    it('the user-global setting stops it', () => {
        const home = path.join(tmp, 'home');
        fs.mkdirSync(path.join(home, 'settings'), { recursive: true });
        fs.writeFileSync(path.join(home, 'settings', '.agent-settings.yml'), 'star_ask:\n  starred: true\n');
        writeStarAskState(path.join(home, 'star-ask.json'), { first_seen_at: '2020-01-01T00:00:00.000Z', last_asked_at: null });
        const r = run(home, 'claude');
        expect(r.status).toBe(0);
        expect(r.stdout).toBe('');
    });
});
