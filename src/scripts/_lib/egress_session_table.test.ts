/**
 * egress_session_table — option (b) of the identifier-table-at-rest verdict:
 * the session table holds no value of any class, and every restoration
 * re-derives the value from its origin and fails closed.
 *
 * Planted values are assembled at runtime and compared by boolean, so a failing
 * assertion never prints one.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { EgressRule } from './egress_rules.js';
import {
    deadForm,
    EGRESS_SESSION_RETENTION_MS,
    fileDestination,
    fileOrigin,
    issueToken,
    pruneSessionTables,
    reissueIntoSession,
    replaceIntoSession,
    RESTORE_OUTCOMES,
    restoreToken,
    sessionTableDir,
    sessionTablePath,
    type OriginDescriptor,
    type OriginReading,
} from './egress_session_table.js';
import { parseTokens } from './egress_token.js';

/** A test-only identifier rule: a German-shaped IBAN, no checksum. */
const IBAN_RULE: EgressRule = {
    rule: 'test-iban',
    type: 'IBAN',
    class: 'identifier',
    pattern: /\bDE\d{20}\b/g,
    replacement: 'detection',
};
const RULES = [IBAN_RULE];

function iban(seed: number): string {
    return `DE${String(seed).padStart(20, '0')}`;
}
const KEY_BODY = 'Ab3Cd5Ef7Gh9Jk2Lm4Np6Qr8';
function credential(): string {
    return ['ghp', '_', KEY_BODY, 'St1Uv3Wx5Yz7'].join('');
}

let dir: string;
let work: string;

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'egress-tables-'));
    work = fs.mkdtempSync(path.join(os.tmpdir(), 'egress-work-'));
});
afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(work, { recursive: true, force: true });
});

function writeOrigin(name: string, body: string): { file: string; origin: OriginDescriptor } {
    const file = path.join(work, name);
    fs.writeFileSync(file, body);
    return { file, origin: fileOrigin(file, { tool: 'Read', field: 'content', operation: 'edit' }) };
}

function issueIban(session: string, value: string, name: string) {
    const { file, origin } = writeOrigin(name, `account: ${value}\n`);
    const token = issueToken({ dir, sessionId: session, type: 'IBAN', class: 'identifier', canonical: value, origin });
    return { file, origin, token };
}

describe('2.1 the table holds no value of any class', () => {
    it('the serialised table contains no planted identifier or credential', () => {
        const id = iban(7);
        const cred = credential();
        const { origin } = writeOrigin('a.txt', `${id}\n${cred}\n`);
        issueToken({ dir, sessionId: 's1', type: 'IBAN', class: 'identifier', canonical: id, origin });
        const replaced = replaceIntoSession(`token = ${cred}`, { dir, sessionId: 's1', origin });
        expect(replaced.includes(cred)).toBe(false);
        const raw = fs.readFileSync(sessionTablePath(dir, 's1'), 'utf8');
        expect(raw.includes(id)).toBe(false);
        expect(raw.includes(cred)).toBe(false);
        expect(raw.includes(KEY_BODY)).toBe(false);
    });

    it('the file is private to its owner and named by a digest, not the session id', () => {
        issueIban('session-with-a-name', iban(1), 'a.txt');
        const p = sessionTablePath(dir, 'session-with-a-name');
        expect(path.basename(p).includes('session-with-a-name')).toBe(false);
        expect(fs.statSync(p).mode & 0o077).toBe(0);
    });

    it('lives outside the workspace and refuses a directory inside it', () => {
        expect(sessionTableDir({ EVENT4U_CONFIG_HOME: '/x/home' })).toBe(path.join('/x/home', 'runtime', 'egress-sessions'));
        const inside = path.join(work, 'tables');
        expect(() =>
            issueToken({
                dir: inside,
                sessionId: 's',
                type: 'IBAN',
                class: 'identifier',
                canonical: iban(1),
                origin: writeOrigin('a.txt', iban(1)).origin,
                workspaceRoot: work,
            }),
        ).toThrow(/inside the workspace/);
        expect(fs.existsSync(inside)).toBe(false);
    });

    it('refuses an origin descriptor that itself carries a detected value', () => {
        const cred = credential();
        const origin: OriginDescriptor = {
            kind: 'api',
            tool: 'mcp',
            account: cred,
            field: 'body',
            operation: 'read',
            endpoint: '/x',
            method: 'GET',
            request_fingerprint: 'r',
            response_timestamp: 't',
        };
        expect(() =>
            issueToken({ dir, sessionId: 's', type: 'IBAN', class: 'identifier', canonical: iban(1), origin }),
        ).toThrow(/origin descriptor/);
        expect(fs.existsSync(sessionTablePath(dir, 's'))).toBe(false);
    });

    it('one value keeps one token and one class for the session', () => {
        const { origin, token } = issueIban('s', iban(3), 'a.txt');
        expect(issueToken({ dir, sessionId: 's', type: 'IBAN', class: 'identifier', canonical: iban(3), origin })).toBe(token);
        expect(() =>
            issueToken({ dir, sessionId: 's', type: 'SECRET', class: 'credential', canonical: iban(3), origin }),
        ).toThrow(/class/);
    });

    it('a table older than the retention age is pruned, a fresh one is kept', () => {
        issueIban('old', iban(1), 'a.txt');
        issueIban('new', iban(2), 'b.txt');
        const later = Date.now() + EGRESS_SESSION_RETENTION_MS + 1000;
        const oldFile = sessionTablePath(dir, 'old');
        const t = new Date(Date.now() - EGRESS_SESSION_RETENTION_MS - 1000);
        const parsed = JSON.parse(fs.readFileSync(oldFile, 'utf8'));
        parsed.updated_at = t.toISOString();
        fs.writeFileSync(oldFile, JSON.stringify(parsed));
        expect(pruneSessionTables(dir, Date.now())).toBe(1);
        expect(fs.existsSync(oldFile)).toBe(false);
        expect(fs.existsSync(sessionTablePath(dir, 'new'))).toBe(true);
        expect(pruneSessionTables(dir, later)).toBe(1);
    });
});

describe('2.1b restoration fails closed in five named outcomes', () => {
    it('restores the re-derived value into its own origin', () => {
        const value = iban(11);
        const { file, token } = issueIban('s', value, 'a.txt');
        const r = restoreToken(token, { dir, sessionId: 's', destination: fileDestination(file), rules: RULES });
        expect(r.ok && r.value === value).toBe(true);
    });

    it('every refusal names its outcome, a value-free message and one recovery path', () => {
        for (const o of RESTORE_OUTCOMES) {
            expect(o.message.length).toBeGreaterThan(0);
            expect(o.recovery).toBe('confirm-with-value-shown');
        }
        expect(RESTORE_OUTCOMES.map((o) => o.outcome).sort()).toEqual(
            ['DESTINATION_MISMATCH', 'ORIGIN_AMBIGUOUS', 'ORIGIN_CHANGED', 'ORIGIN_UNAVAILABLE', 'SESSION_EXPIRED'].sort(),
        );
    });

    it('ORIGIN_CHANGED — a same-destination restore with a mutated origin does not replay the stale value', () => {
        const value = iban(12);
        const { file, token } = issueIban('s', value, 'a.txt');
        fs.writeFileSync(file, `account: ${iban(99)}\n`);
        const r = restoreToken(token, { dir, sessionId: 's', destination: fileDestination(file), rules: RULES });
        expect(r.ok).toBe(false);
        expect(!r.ok && r.outcome).toBe('ORIGIN_CHANGED');
        expect(JSON.stringify(r).includes(value)).toBe(false);
    });

    it('ORIGIN_CHANGED — the path now names another file', () => {
        const value = iban(13);
        const { file, token } = issueIban('s', value, 'a.txt');
        // Moved aside, not removed: a removed file's inode may be handed straight back.
        fs.renameSync(file, `${file}.old`);
        fs.writeFileSync(file, `account: ${value}\n`);
        const r = restoreToken(token, { dir, sessionId: 's', destination: fileDestination(file), rules: RULES });
        expect(!r.ok && r.outcome).toBe('ORIGIN_CHANGED');
    });

    it('ORIGIN_UNAVAILABLE — the origin is gone', () => {
        const { file, token } = issueIban('s', iban(14), 'a.txt');
        fs.rmSync(file);
        const r = restoreToken(token, { dir, sessionId: 's', destination: fileDestination(file), rules: RULES });
        expect(!r.ok && r.outcome).toBe('ORIGIN_UNAVAILABLE');
    });

    it('ORIGIN_UNAVAILABLE — an origin record whose authentication fails is never trusted', () => {
        const { file, token } = issueIban('s', iban(15), 'a.txt');
        const p = sessionTablePath(dir, 's');
        const t = JSON.parse(fs.readFileSync(p, 'utf8'));
        t.entries[0].origins[0].field = 'other';
        fs.writeFileSync(p, JSON.stringify(t));
        const r = restoreToken(token, { dir, sessionId: 's', destination: fileDestination(file), rules: RULES });
        expect(!r.ok && r.outcome).toBe('ORIGIN_UNAVAILABLE');
    });

    it('ORIGIN_AMBIGUOUS — the descriptor identifies more than one object', () => {
        const value = iban(16);
        const { file, token } = issueIban('s', value, 'a.txt');
        const readOrigin = (): OriginReading => ({ kind: 'objects', texts: [value, value] });
        const r = restoreToken(token, { dir, sessionId: 's', destination: fileDestination(file), rules: RULES, readOrigin });
        expect(!r.ok && r.outcome).toBe('ORIGIN_AMBIGUOUS');
    });

    it('DESTINATION_MISMATCH — a token bound for another sink is not restored', () => {
        const { token } = issueIban('s', iban(17), 'a.txt');
        const other = path.join(work, 'b.txt');
        const r = restoreToken(token, { dir, sessionId: 's', destination: fileDestination(other), rules: RULES });
        expect(!r.ok && r.outcome).toBe('DESTINATION_MISMATCH');
    });

    it('SESSION_EXPIRED — a table past retention, a missing table, or a table copied from another session', () => {
        const { file, token } = issueIban('s', iban(18), 'a.txt');
        const dest = fileDestination(file);
        const later = Date.now() + EGRESS_SESSION_RETENTION_MS + 1000;
        expect(restoreToken(token, { dir, sessionId: 's', destination: dest, rules: RULES, now: later })).toMatchObject({
            ok: false,
            outcome: 'SESSION_EXPIRED',
        });
        expect(restoreToken(token, { dir, sessionId: 'never', destination: dest, rules: RULES })).toMatchObject({
            ok: false,
            outcome: 'SESSION_EXPIRED',
        });
        fs.copyFileSync(sessionTablePath(dir, 's'), sessionTablePath(dir, 'replayed'));
        expect(restoreToken(token, { dir, sessionId: 'replayed', destination: dest, rules: RULES })).toMatchObject({
            ok: false,
            outcome: 'SESSION_EXPIRED',
        });
    });

    it('a token this session never issued is unresolved and has no recovery', () => {
        const a = issueIban('a', iban(19), 'a.txt');
        issueIban('b', iban(20), 'b.txt');
        const r = restoreToken(a.token, { dir, sessionId: 'b', destination: fileDestination(a.file), rules: RULES });
        expect(r).toMatchObject({ ok: false, outcome: 'UNRESOLVED', recovery: 'none' });
    });
});

describe('2.2 continuity never resolves a token to the wrong value', () => {
    it("a handoff never restores the second session's value for the first session's token", () => {
        const one = issueIban('one', iban(31), 'one.txt');
        const two = issueIban('two', iban(32), 'two.txt');
        const [t1] = parseTokens(one.token);
        const [t2] = parseTokens(two.token);
        expect(t1?.number).toBe(1);
        expect(t2?.number).toBe(1);

        const carried = reissueIntoSession(`pay ${one.token} today`, { dir, from: 'one', to: 'two', rules: RULES });
        const [reissued] = parseTokens(carried);
        expect(carried.includes(one.token)).toBe(false);
        expect(reissued?.number).toBe(2);
        const restored = restoreToken(carried.slice(reissued!.start, reissued!.end), {
            dir,
            sessionId: 'two',
            destination: fileDestination(one.file),
            rules: RULES,
        });
        expect(restored.ok && restored.value === iban(31)).toBe(true);
        expect(restored.ok && restored.value === iban(32)).toBe(false);
        expect(fs.readFileSync(sessionTablePath(dir, 'two'), 'utf8').includes(iban(31))).toBe(false);
    });

    it('a resumed session resolves its own tokens and no other session’s', () => {
        const one = issueIban('one', iban(41), 'one.txt');
        const two = issueIban('two', iban(42), 'two.txt');
        const own = restoreToken(one.token, { dir, sessionId: 'one', destination: fileDestination(one.file), rules: RULES });
        expect(own.ok && own.value === iban(41)).toBe(true);
        const foreign = restoreToken(two.token, { dir, sessionId: 'one', destination: fileDestination(two.file), rules: RULES });
        expect(foreign.ok).toBe(false);
    });

    it('a token whose table is gone becomes an explicitly dead form that never parses as a token', () => {
        const one = issueIban('one', iban(51), 'one.txt');
        fs.rmSync(sessionTablePath(dir, 'one'));
        const carried = reissueIntoSession(`x ${one.token} y`, { dir, from: 'one', to: 'two', rules: RULES });
        expect(carried).toBe(`x ${deadForm('IBAN')} y`);
        expect(parseTokens(carried)).toEqual([]);
    });

    it('a token whose origin changed since is not carried forward with a stale value', () => {
        const one = issueIban('one', iban(61), 'one.txt');
        fs.writeFileSync(one.file, 'nothing here\n');
        const carried = reissueIntoSession(one.token, { dir, from: 'one', to: 'two', rules: RULES });
        expect(carried).toBe(deadForm('IBAN'));
    });
});
