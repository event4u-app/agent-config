/**
 * The egress session table: no detected value of any class is persisted by
 * this subsystem between events.
 *
 * One table per session, outside the workspace, removed by age. It holds a
 * per-session key, and per token a keyed digest of the value, the type, the
 * number and the authenticated origin descriptors — never the value. Every
 * restoration re-derives the value from an origin and matches the digest
 * first, same destination included, and fails closed in one of five named
 * outcomes. The value exists transiently while an origin is re-read; that is
 * all "never persisted" claims.
 *
 * The key rests beside the digests, so a reader of the table can guess
 * low-entropy values offline; the table is data minimisation, not a defence
 * against same-user compromise.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { detect, EGRESS_RULES, type EgressClass, type EgressRule, type EgressSpan } from './egress_rules.js';
import { formatToken, parseTokens, replaceValues, TOKEN_FP_LENGTH, TokenScope } from './egress_token.js';
import { event4u_root, type EnvMap } from './user_global_paths.js';

/** Idle age after which a table is gone: removed by the prune and refused by a restore. */
export const EGRESS_SESSION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const EGRESS_SESSION_TABLE_SUBDIR = path.join('runtime', 'egress-sessions');

export function sessionTableDir(env?: EnvMap | null): string {
    return path.join(event4u_root(env), EGRESS_SESSION_TABLE_SUBDIR);
}

function sha256(text: string): string {
    return createHash('sha256').update(text).digest('hex');
}

/** Named by a digest, so the file name carries no session id. */
export function sessionTablePath(dir: string, sessionId: string): string {
    return path.join(dir, `${sha256(`session\u0000${sessionId}`).slice(0, 32)}.json`);
}

interface OriginCommon {
    /** The connector or tool that produced the object. */
    readonly tool: string;
    /** Tenant or account; empty for a local file. */
    readonly account?: string;
    /** The exact field location inside the object. */
    readonly field: string;
    /** The operation the value was detected for. */
    readonly operation: string;
}

export type OriginDescriptor =
    | (OriginCommon & {
          readonly kind: 'file';
          readonly path: string;
          readonly device: number;
          readonly inode: number;
          /** Set where the path may be replaced: a replaced path then still matches by content. */
          readonly content_digest?: string;
      })
    | (OriginCommon & {
          readonly kind: 'api';
          readonly endpoint: string;
          readonly method: string;
          readonly request_fingerprint: string;
          readonly response_timestamp: string;
      })
    | (OriginCommon & {
          readonly kind: 'database';
          readonly connection: string;
          readonly query_fingerprint: string;
          readonly row_id: string;
      });

export function fileOrigin(
    file: string,
    common: OriginCommon,
    opts: { readonly bindContent?: boolean } = {},
): OriginDescriptor {
    const abs = path.resolve(file);
    const st = fs.statSync(abs);
    return {
        kind: 'file',
        ...common,
        path: abs,
        device: st.dev,
        inode: st.ino,
        ...(opts.bindContent === true ? { content_digest: sha256(fs.readFileSync(abs, 'utf8')) } : {}),
    };
}

/** The sink an origin is: what a restore's destination is compared against. */
export function originKey(o: OriginDescriptor): string {
    if (o.kind === 'file') return fileDestination(o.path);
    if (o.kind === 'api') return `api:${o.account ?? ''}:${o.method} ${o.endpoint}`;
    return `database:${o.account ?? ''}:${o.connection}`;
}

export function fileDestination(file: string): string {
    return `file:${path.resolve(file)}`;
}

interface TableEntry {
    token: string;
    type: string;
    class: EgressClass;
    number: number;
    /** Keyed digest over type and canonical value; the token carries its prefix. */
    digest: string;
    /** Keyed digest over the value alone, which holds one class per value. */
    value_digest: string;
    origins: OriginDescriptor[];
    /** Keyed MAC over every field above: an origin descriptor nobody can edit unseen. */
    mac: string;
}

interface SessionTable {
    version: 1;
    session: string;
    created_at: string;
    updated_at: string;
    key: string;
    counters: Record<string, number>;
    entries: TableEntry[];
}

function keyed(table: SessionTable, text: string): string {
    return createHmac('sha256', Buffer.from(table.key, 'hex')).update(text).digest('hex');
}

function macOf(table: SessionTable, e: Omit<TableEntry, 'mac'>): string {
    const { token, type, class: cls, number, digest, value_digest, origins } = e;
    return keyed(table, `mac\u0000${JSON.stringify([token, type, cls, number, digest, value_digest, origins])}`);
}

function macValid(table: SessionTable, e: TableEntry): boolean {
    const want = Buffer.from(macOf(table, e), 'hex');
    const got = Buffer.from(typeof e.mac === 'string' ? e.mac : '', 'hex');
    return got.length === want.length && timingSafeEqual(got, want);
}

function readTable(dir: string, sessionId: string): SessionTable | null {
    try {
        const t = JSON.parse(fs.readFileSync(sessionTablePath(dir, sessionId), 'utf8')) as SessionTable;
        return t.version === 1 && Array.isArray(t.entries) && typeof t.key === 'string' ? t : null;
    } catch {
        return null;
    }
}

function expired(table: SessionTable, now: number): boolean {
    const at = Date.parse(table.updated_at);
    return !Number.isFinite(at) || now - at > EGRESS_SESSION_RETENTION_MS;
}

function sleepMs(ms: number): void {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

const LOCK_STALE_MS = 5000;

export interface TableTarget {
    readonly dir: string;
    readonly sessionId: string;
    readonly now?: number;
    /** When given, a table directory inside it is refused before anything is written. */
    readonly workspaceRoot?: string;
}

/** Read-modify-write under an exclusive lock; the file is written whole and renamed into place. */
function updateTable<T>(t: TableTarget, fn: (table: SessionTable) => T): T {
    if (t.workspaceRoot !== undefined) {
        const rel = path.relative(path.resolve(t.workspaceRoot), path.resolve(t.dir));
        if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
            throw new Error('egress session table: refusing a table directory inside the workspace');
        }
    }
    fs.mkdirSync(t.dir, { recursive: true, mode: 0o700 });
    const file = sessionTablePath(t.dir, t.sessionId);
    const lock = `${file}.lock`;
    let fd: number | null = null;
    for (let i = 0; fd === null; i++) {
        try {
            fd = fs.openSync(lock, 'wx', 0o600);
        } catch {
            try {
                if (Date.now() - fs.statSync(lock).mtimeMs > LOCK_STALE_MS) fs.rmSync(lock, { force: true });
            } catch {
                // released meanwhile
            }
            if (i >= 200) throw new Error('egress session table: lock not acquired');
            sleepMs(5);
        }
    }
    try {
        const now = new Date(t.now ?? Date.now()).toISOString();
        const session = sha256(`session\u0000${t.sessionId}`);
        const prior = readTable(t.dir, t.sessionId);
        const table: SessionTable =
            prior !== null && prior.session === session && !expired(prior, Date.parse(now))
                ? prior
                : {
                      version: 1,
                      session,
                      created_at: now,
                      updated_at: now,
                      key: randomBytes(32).toString('hex'),
                      counters: {},
                      entries: [],
                  };
        const out = fn(table);
        table.updated_at = now;
        const tmp = `${file}.${process.pid}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(table), { mode: 0o600 });
        fs.renameSync(tmp, file);
        return out;
    } finally {
        fs.closeSync(fd);
        fs.rmSync(lock, { force: true });
    }
}

function mintInto(table: SessionTable, type: string, cls: EgressClass, canonical: string, origin: OriginDescriptor): string {
    if (detect(JSON.stringify(origin)).length > 0) {
        throw new Error('egress session table: the origin descriptor itself carries a detected value');
    }
    const value_digest = keyed(table, `value\u0000${canonical}`);
    const seen = table.entries.find((e) => e.value_digest === value_digest);
    if (seen !== undefined && seen.class !== cls) {
        throw new Error(`egress session table: value minted under class ${seen.class}, refusing class ${cls}`);
    }
    const digest = keyed(table, `${type}\u0000${canonical}`);
    const known = table.entries.find((e) => e.digest === digest && macValid(table, e));
    if (known !== undefined) {
        const key = originKey(origin);
        const rest = known.origins.filter((o) => originKey(o) !== key);
        Object.assign(known, { origins: [...rest, origin] });
        known.mac = macOf(table, known);
        return known.token;
    }
    const number = (table.counters[type] ?? 0) + 1;
    const token = formatToken({ type, number, fingerprint: digest.slice(0, TOKEN_FP_LENGTH) });
    table.counters[type] = number;
    const entry = { token, type, class: cls, number, digest, value_digest, origins: [origin] };
    table.entries.push({ ...entry, mac: macOf(table, entry) });
    return token;
}

export interface IssueRequest extends TableTarget {
    readonly type: string;
    readonly class: EgressClass;
    readonly canonical: string;
    readonly origin: OriginDescriptor;
}

/** Mints (or re-finds) the token for one value and binds it to one more origin. */
export function issueToken(r: IssueRequest): string {
    return updateTable(r, (table) => mintInto(table, r.type, r.class, r.canonical, r.origin));
}

/** A TokenScope whose state is the session table: it owns its tokens and resolves nothing in memory. */
class SessionScope extends TokenScope {
    constructor(
        private readonly table: SessionTable,
        private readonly origin: OriginDescriptor,
    ) {
        super();
    }
    override mint(type: string, cls: EgressClass, canonical: string): string {
        return mintInto(this.table, type, cls, canonical, this.origin);
    }
    override owns(token: string): boolean {
        return this.table.entries.some((e) => e.token === token);
    }
    override resolve(_token: string): string | null {
        return null;
    }
}

/** replaceValues under the session table: tokens survive the process that minted them. */
export function replaceIntoSession(text: string, t: TableTarget & { readonly origin: OriginDescriptor }): string {
    return updateTable(t, (table) => replaceValues(text, new SessionScope(table, t.origin)));
}

export type OriginReading =
    | { readonly kind: 'unavailable' }
    | { readonly kind: 'changed' }
    | { readonly kind: 'objects'; readonly texts: readonly string[] };

/** A file origin, re-read now: its identity must still be the one recorded. */
export function readFileOrigin(o: OriginDescriptor): OriginReading {
    if (o.kind !== 'file') return { kind: 'unavailable' };
    let st: fs.Stats;
    let text: string;
    try {
        st = fs.statSync(o.path);
        text = fs.readFileSync(o.path, 'utf8');
    } catch {
        return { kind: 'unavailable' };
    }
    const same = st.dev === o.device && st.ino === o.inode;
    if (!same && (o.content_digest === undefined || sha256(text) !== o.content_digest)) return { kind: 'changed' };
    return { kind: 'objects', texts: [text] };
}

export type RestoreOutcome =
    | 'ORIGIN_CHANGED'
    | 'ORIGIN_UNAVAILABLE'
    | 'ORIGIN_AMBIGUOUS'
    | 'DESTINATION_MISMATCH'
    | 'SESSION_EXPIRED';

/**
 * The five outcomes, each with a message that names no value and one recovery:
 * explicit confirmation with the value shown. A credential token toward a
 * foreign destination is denied before this recovery is offered, never shown.
 */
export const RESTORE_OUTCOMES: ReadonlyArray<{
    readonly outcome: RestoreOutcome;
    readonly message: string;
    readonly recovery: 'confirm-with-value-shown';
}> = [
    { outcome: 'ORIGIN_CHANGED', message: 'The value this placeholder stood for is no longer in its origin.', recovery: 'confirm-with-value-shown' },
    { outcome: 'ORIGIN_UNAVAILABLE', message: 'The origin of this placeholder cannot be read or authenticated now.', recovery: 'confirm-with-value-shown' },
    { outcome: 'ORIGIN_AMBIGUOUS', message: 'The origin of this placeholder matches more than one object.', recovery: 'confirm-with-value-shown' },
    { outcome: 'DESTINATION_MISMATCH', message: 'This placeholder is bound to another destination than this call.', recovery: 'confirm-with-value-shown' },
    { outcome: 'SESSION_EXPIRED', message: 'The session that issued this placeholder has no live table.', recovery: 'confirm-with-value-shown' },
];

export type RestoreResult =
    | { readonly ok: true; readonly value: string }
    | { readonly ok: false; readonly outcome: RestoreOutcome; readonly message: string; readonly recovery: 'confirm-with-value-shown' }
    | { readonly ok: false; readonly outcome: 'UNRESOLVED'; readonly message: string; readonly recovery: 'none' };

function refuse(outcome: RestoreOutcome): RestoreResult {
    const o = RESTORE_OUTCOMES.find((x) => x.outcome === outcome) as (typeof RESTORE_OUTCOMES)[number];
    return { ok: false, outcome, message: o.message, recovery: o.recovery };
}

export interface RestoreRequest {
    readonly dir: string;
    readonly sessionId: string;
    /** `fileDestination(path)` or another origin key. */
    readonly destination: string;
    readonly rules?: readonly EgressRule[];
    readonly readOrigin?: (o: OriginDescriptor) => OriginReading;
    readonly now?: number;
}

const RULES_BY_ID = (rules: readonly EgressRule[]) => new Map(rules.map((r) => [r.rule, r]));

/** The bytes a token stood for, per span — the replacement extent, as replaceValues minted it. */
function extentOf(text: string, span: EgressSpan, rules: ReadonlyMap<string, EgressRule>): string | null {
    const policy = rules.get(span.rule)?.replacement;
    if (policy === undefined) return null;
    if (policy === 'detection') return text.slice(span.start, span.end);
    const end = policy.through(text, span);
    return end === null || end < span.end ? null : text.slice(span.start, end);
}

/** Re-derives the value from one origin: the digest decides, never the number or the position. */
function rederive(
    table: SessionTable,
    entry: TableEntry,
    origin: OriginDescriptor,
    req: Pick<RestoreRequest, 'rules' | 'readOrigin'>,
): { value: string } | RestoreOutcome {
    const reading = (req.readOrigin ?? readFileOrigin)(origin);
    if (reading.kind === 'unavailable') return 'ORIGIN_UNAVAILABLE';
    if (reading.kind === 'changed') return 'ORIGIN_CHANGED';
    if (reading.texts.length === 0) return 'ORIGIN_UNAVAILABLE';
    if (reading.texts.length > 1) return 'ORIGIN_AMBIGUOUS';
    const rules = req.rules ?? EGRESS_RULES;
    const byId = RULES_BY_ID(rules);
    const text = reading.texts[0] as string;
    for (const span of detect(text, rules)) {
        if (span.type !== entry.type) continue;
        const value = extentOf(text, span, byId);
        if (value !== null && keyed(table, `${entry.type}\u0000${value}`) === entry.digest) return { value };
    }
    return 'ORIGIN_CHANGED';
}

function liveTable(dir: string, sessionId: string, now: number): SessionTable | null {
    const table = readTable(dir, sessionId);
    if (table === null || table.session !== sha256(`session\u0000${sessionId}`) || expired(table, now)) return null;
    return table;
}

/** Restores one token toward one destination, or names why it does not. */
export function restoreToken(token: string, req: RestoreRequest): RestoreResult {
    const table = liveTable(req.dir, req.sessionId, req.now ?? Date.now());
    if (table === null) return refuse('SESSION_EXPIRED');
    const entry = table.entries.find((e) => e.token === token);
    if (entry === undefined) {
        return { ok: false, outcome: 'UNRESOLVED', message: 'This placeholder was not issued in this session.', recovery: 'none' };
    }
    if (!macValid(table, entry)) return refuse('ORIGIN_UNAVAILABLE');
    const origin = entry.origins.find((o) => originKey(o) === req.destination);
    if (origin === undefined) return refuse('DESTINATION_MISMATCH');
    const got = rederive(table, entry, origin, req);
    return typeof got === 'string' ? refuse(got) : { ok: true, value: got.value };
}

/** What a token becomes when nothing can stand behind it any more; the recogniser never parses it. */
export function deadForm(type: string): string {
    return `[expired ${type} placeholder]`;
}

export interface ReissueRequest {
    readonly dir: string;
    readonly from: string;
    readonly to: string;
    readonly rules?: readonly EgressRule[];
    readonly readOrigin?: (o: OriginDescriptor) => OriginReading;
    readonly now?: number;
}

/**
 * Text carried into a new session — handoff, memory recall — is re-issued at
 * injection: each token is re-derived through the predecessor's table and
 * minted again under the current session's key, bound to the same origin. A
 * token with no live table, an unauthenticated entry or no origin that still
 * holds its value becomes the dead form, never another session's value.
 */
export function reissueIntoSession(text: string, r: ReissueRequest): string {
    const tokens = parseTokens(text);
    if (tokens.length === 0) return text;
    const now = r.now ?? Date.now();
    const prior = liveTable(r.dir, r.from, now);
    const plan = tokens.map((t) => {
        const literal = text.slice(t.start, t.end);
        const entry = prior?.entries.find((e) => e.token === literal);
        if (prior === null || prior === undefined || entry === undefined || !macValid(prior, entry)) return null;
        for (const origin of entry.origins) {
            const got = rederive(prior, entry, origin, r);
            if (typeof got !== 'string') return { entry, origin, value: got.value };
        }
        return null;
    });
    const minted =
        r.from === r.to
            ? tokens.map((t, i) => (plan[i] === null ? null : text.slice(t.start, t.end)))
            : updateTable({ dir: r.dir, sessionId: r.to, now }, (table) =>
                  plan.map((p) => (p === null ? null : mintInto(table, p.entry.type, p.entry.class, p.value, p.origin))),
              );
    let out = text;
    for (let i = tokens.length - 1; i >= 0; i--) {
        const t = tokens[i] as (typeof tokens)[number];
        out = out.slice(0, t.start) + (minted[i] ?? deadForm(t.type)) + out.slice(t.end);
    }
    return out;
}

/** Removes every table idle past the retention age; returns how many went. */
export function pruneSessionTables(dir: string, now: number = Date.now()): number {
    let removed = 0;
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return 0;
    }
    for (const name of names) {
        if (!name.endsWith('.json')) continue;
        const file = path.join(dir, name);
        let at: number;
        try {
            const t = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<SessionTable>;
            at = Date.parse(String(t.updated_at));
            if (!Number.isFinite(at)) at = fs.statSync(file).mtimeMs;
        } catch {
            at = 0;
        }
        if (now - at > EGRESS_SESSION_RETENTION_MS) {
            fs.rmSync(file, { force: true });
            removed += 1;
        }
    }
    return removed;
}
