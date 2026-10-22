/**
 * Known values: credentials with no recognisable shape, found by exact match.
 *
 * A password like `correct horse` matches no rule in the table; the only way to
 * see it is to know it. The set is built per invocation from environment
 * variables whose names mark them as credentials and from local `.env*` files,
 * held in memory, and never written anywhere — not the values, not a digest.
 *
 * Encoded copies are found by decoding the text, never by encoding the needles:
 * base64, percent-encoding and JSON string escapes, through at most two layers.
 * A run that still decodes after the second layer is a counted miss, so a
 * nested encoding past the bound is reported rather than searched without end;
 * a text past the size bound and a search past the time bound are counted the
 * same way.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { credentialFileClass } from './credential_files.js';

/**
 * Env-var names that hold a credential by naming convention. `AUTH` counts only
 * as a whole trailing word (`BASIC_AUTH`): as a substring it took
 * `GIT_AUTHOR_NAME` and `SSH_AUTH_SOCK`, whose values then got replaced in
 * every command and output.
 */
const CREDENTIAL_NAME = /(?:TOKEN|SECRET|PASSWORD|PASSWD|PASSPHRASE|API_?KEY|PRIVATE_?KEY|CREDENTIAL|DSN|(?:^|_)AUTH$)/i;
/** Shorter values collide with ordinary words too often to replace. */
export const MIN_KNOWN_VALUE_LENGTH = 8;
export const MAX_DECODE_LAYERS = 2;

export interface KnownValueBounds {
    /** Text longer than this is searched in plain form only. */
    readonly maxBytes: number;
    /** Decoding stops at this wall-clock budget. */
    readonly maxMs: number;
}

export const DEFAULT_BOUNDS: KnownValueBounds = { maxBytes: 1_048_576, maxMs: 50 };

export type KnownEncoding = 'plain' | 'base64' | 'url' | 'json';

export interface KnownValueHit {
    readonly start: number;
    readonly end: number;
    /** The decoding chain that exposed the value, outermost first. */
    readonly encodings: readonly KnownEncoding[];
}

export interface KnownValueMisses {
    /** Runs that still decoded after the last permitted layer. */
    readonly pastLayerBound: number;
    readonly pastSizeBound: number;
    readonly pastTimeBound: number;
}

export interface KnownValueScan {
    readonly hits: KnownValueHit[];
    readonly misses: KnownValueMisses;
}

function parseEnvFile(body: string): string[] {
    const out: string[] = [];
    for (const raw of body.split(/\r?\n/)) {
        const line = raw.trim();
        if (line === '' || line.startsWith('#')) continue;
        const m = /^(?:export\s+)?[A-Za-z_][A-Za-z0-9_.]*\s*=\s*(.*)$/.exec(line);
        if (m === null) continue;
        let v = (m[1] as string).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        else v = v.replace(/\s+#.*$/, '');
        out.push(v);
    }
    return out;
}

/** The exact-match set from an environment and the bodies of `.env*` files. Pure. */
export function knownValueSet(env: NodeJS.ProcessEnv, envFileBodies: readonly string[]): Set<string> {
    const set = new Set<string>();
    for (const [name, value] of Object.entries(env)) {
        if (value !== undefined && CREDENTIAL_NAME.test(name)) set.add(value);
    }
    for (const body of envFileBodies) for (const v of parseEnvFile(body)) set.add(v);
    for (const v of [...set]) if (v.length < MIN_KNOWN_VALUE_LENGTH) set.delete(v);
    return set;
}

/** The bodies of the value-holding `.env*` files directly under `root`; templates are skipped. */
export function readEnvFileBodies(root: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(root);
    } catch {
        return [];
    }
    const bodies: string[] = [];
    for (const name of names.sort()) {
        if (!name.startsWith('.env') || credentialFileClass(name) !== 'env-file') continue;
        try {
            bodies.push(fs.readFileSync(path.join(root, name), 'utf8'));
        } catch {
            continue;
        }
    }
    return bodies;
}

const BASE64_RUN = /[A-Za-z0-9+/_-]{12,8192}={0,2}/g;
const PERCENT_RUN = /(?:[^\s%"'<>]{0,256}%[0-9A-Fa-f]{2}){1,2048}[^\s%"'<>]{0,256}/g;
const JSON_STRING = /"(?:[^"\\\n]|\\.){1,8192}"/g;
const PRINTABLE = /^[\t\n\r\x20-\x7e -￿]*$/;

interface Run {
    readonly start: number;
    readonly end: number;
    readonly text: string;
}

function runs(text: string, re: RegExp): Run[] {
    const out: Run[] = [];
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    return out;
}

/** Each layer one decoding can peel off `s`. */
function decodeOnce(s: string): Array<{ encoding: KnownEncoding; text: string }> {
    const out: Array<{ encoding: KnownEncoding; text: string }> = [];
    if (/^[A-Za-z0-9+/_-]{12,}={0,2}$/.test(s) && s.replace(/=+$/, '').length % 4 !== 1) {
        const decoded = Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
        if (decoded.length > 0 && PRINTABLE.test(decoded) && !decoded.includes('�')) out.push({ encoding: 'base64', text: decoded });
    }
    if (/%[0-9A-Fa-f]{2}/.test(s)) {
        try {
            const decoded = decodeURIComponent(s);
            if (decoded !== s) out.push({ encoding: 'url', text: decoded });
        } catch {
            // Not percent-encoded text after all.
        }
    }
    if (s.length >= 2 && s.startsWith('"') && s.endsWith('"') && s.includes('\\')) {
        try {
            const decoded = JSON.parse(s) as unknown;
            if (typeof decoded === 'string') out.push({ encoding: 'json', text: decoded });
        } catch {
            // Not a JSON string literal.
        }
    }
    return out;
}

/** Candidate encoded runs inside `s`. */
function encodedRuns(s: string): Run[] {
    return [...runs(s, BASE64_RUN), ...runs(s, PERCENT_RUN), ...runs(s, JSON_STRING)];
}

function containsKnown(s: string, known: ReadonlySet<string>): boolean {
    for (const v of known) if (s.includes(v)) return true;
    return false;
}

/**
 * Every place a known value appears in `text`, in plain form or behind up to
 * two decoding layers. An encoded hit spans the outermost encoded run, which is
 * the bytes a replacement has to remove.
 */
export function findKnownValues(
    text: string,
    known: ReadonlySet<string>,
    bounds: KnownValueBounds = DEFAULT_BOUNDS,
    now: () => number = Date.now,
): KnownValueScan {
    const hits: KnownValueHit[] = [];
    let pastLayerBound = 0;
    let pastSizeBound = 0;
    let pastTimeBound = 0;
    if (known.size === 0) return { hits, misses: { pastLayerBound, pastSizeBound, pastTimeBound } };

    for (const v of known) {
        for (let at = text.indexOf(v); at !== -1; at = text.indexOf(v, at + 1)) {
            hits.push({ start: at, end: at + v.length, encodings: ['plain'] });
        }
    }
    if (text.length > bounds.maxBytes) {
        pastSizeBound += 1;
        return { hits, misses: { pastLayerBound, pastSizeBound, pastTimeBound } };
    }

    const deadline = now() + bounds.maxMs;
    const covered = (r: Run): boolean => hits.some((h) => h.start < r.end && r.start < h.end);
    outer: for (const run of encodedRuns(text)) {
        if (covered(run)) continue;
        let frontier: Array<{ text: string; chain: KnownEncoding[] }> = [{ text: run.text, chain: [] }];
        for (let layer = 1; layer <= MAX_DECODE_LAYERS + 1 && frontier.length > 0; layer += 1) {
            if (now() > deadline) {
                pastTimeBound += 1;
                break outer;
            }
            const next: Array<{ text: string; chain: KnownEncoding[] }> = [];
            for (const f of frontier) {
                const pieces = [f.text, ...encodedRuns(f.text).map((r) => r.text).filter((t) => t !== f.text)];
                for (const piece of pieces) {
                    for (const d of decodeOnce(piece)) {
                        if (layer > MAX_DECODE_LAYERS) {
                            pastLayerBound += 1;
                            continue outer;
                        }
                        const chain = [...f.chain, d.encoding];
                        if (containsKnown(d.text, known)) {
                            hits.push({ start: run.start, end: run.end, encodings: chain });
                            continue outer;
                        }
                        next.push({ text: d.text, chain });
                    }
                }
            }
            frontier = next;
        }
    }
    hits.sort((a, b) => a.start - b.start || b.end - a.end);
    return { hits, misses: { pastLayerBound, pastSizeBound, pastTimeBound } };
}
