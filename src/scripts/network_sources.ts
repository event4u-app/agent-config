/**
 * network_sources.ts — the network half of the foreign-source door (step 4.2b,
 * ADR-288 D7): a URL or article read once, a repository cloned at depth 1, and
 * the codebook that keeps every source's identity out of tracked output.
 *
 * D7 bounds what this may do: an invocation that names a source authorises
 * read-only fetches of THAT source for that run, and private or authenticated
 * network content stays excluded. So a URL carrying credentials is refused, a
 * host resolving to a private, loopback or link-local address is refused at
 * every redirect hop, redirects and body size are capped, no auth header is
 * ever sent, and a clone runs with hooks disabled, follows no redirect and is
 * never executed.
 * DNS is resolved ONCE per hop and the connection is pinned to the validated
 * address: the GET goes through a `lookup` that returns only that address, and
 * the clone passes it to git as `http.curloptResolve`, so a rebinding resolver
 * answering differently on a second query is never asked one. A clone routed
 * through a configured git proxy is resolved by that proxy, not here. The bypasses a
 * fixture server needs (private hosts, an allowlist, a fake resolver) are not
 * fields of `NetworkOptions`: they exist only on an object `forTestsOnly`
 * returns, and that refuses outside a test runner.
 *
 * Fetched text is data. It is digested and quoted (≤ 15 words per anchor),
 * never followed as an instruction.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as https from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import * as path from 'node:path';

import { encrypt } from './_lib/link_crypto.js';
import { sanitize_text } from './_lib/retrieval_sanitize.js';
import { SourceError, resolveSource, type SourceRef } from './source_adapters.js';

export const DEGRADED_NO_NETWORK = 'degraded: no-network';
export const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
export const DEFAULT_MAX_REDIRECTS = 3;
export const DEFAULT_TIMEOUT_MS = 30_000;
export const MAX_QUOTE_WORDS = 15;

export const RESEARCH_BRIEF = [
    'Read the code, not the README.',
    'Follow the source to the other repositories, links and posts it builds on.',
    'Search the web for the same problem solved elsewhere.',
    'Record every source as a coded id (S1, S2, …) with a digest and a quoted anchor; never its name.',
].join(' ');

export interface NetworkOptions {
    network: boolean;
    maxBytes?: number;
    maxRedirects?: number;
    /** Wall-clock cap on one request (body read included) and on one git call. */
    timeoutMs?: number;
}

export interface UrlSourceRef {
    identity: string;
    kind: 'url';
    pin: string;
    digest: string;
    tier: 'read';
    text: string;
    degraded: typeof DEGRADED_NO_NETWORK | null;
}

/** Resolve a host name to its addresses; the default is the system resolver. */
export type Resolver = (host: string) => Promise<Array<{ address: string; family: number }>>;

interface TestOverrides {
    readonly allowPrivateHosts: boolean;
    /** Hosts treated as public although they resolve privately — fixture servers only. */
    readonly hostAllowlist: readonly string[];
    readonly resolver: Resolver | null;
}

const TEST_OVERRIDES = new WeakMap<object, TestOverrides>();

/**
 * Options carrying the fixture-server bypasses. Refuses unless a test runner
 * is the process (`VITEST`), so no production caller can disable the
 * private-host check by setting a field.
 */
export function forTestsOnly<T extends NetworkOptions>(
    opts: T,
    overrides: { allowPrivateHosts?: boolean; hostAllowlist?: readonly string[]; resolver?: Resolver },
): T {
    if (process.env['VITEST'] === undefined) throw new SourceError('network_sources: test-only overrides used outside a test runner');
    const out = { ...opts };
    TEST_OVERRIDES.set(out, {
        allowPrivateHosts: overrides.allowPrivateHosts === true,
        hostAllowlist: overrides.hostAllowlist ?? [],
        resolver: overrides.resolver ?? null,
    });
    return out;
}

function overridesOf(opts: NetworkOptions): TestOverrides {
    return TEST_OVERRIDES.get(opts) ?? { allowPrivateHosts: false, hostAllowlist: [], resolver: null };
}

const systemResolver: Resolver = async (host) => (await lookup(host, { all: true })).map((r) => ({ address: r.address, family: r.family }));

function ipv4Private([p, q, r]: readonly number[]): boolean {
    return (
        p === 0 || p === 10 || p === 127 || (p as number) >= 224 ||
        (p === 169 && q === 254) || (p === 172 && (q as number) >= 16 && (q as number) <= 31) || (p === 192 && q === 168) ||
        (p === 100 && (q as number) >= 64 && (q as number) <= 127) || (p === 192 && q === 0 && r === 0) || (p === 198 && (q === 18 || q === 19))
    );
}

/** The 16 bytes of an IPv6 address, an embedded dotted quad included. */
function ipv6Bytes(a: string): number[] {
    const quad = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(a);
    const hex = quad === null ? a : `${a.slice(0, quad.index)}${((Number(quad[1]) << 8) | Number(quad[2])).toString(16)}:${((Number(quad[3]) << 8) | Number(quad[4])).toString(16)}`;
    const [head, tail] = hex.split('::') as [string, string | undefined];
    const groups = (s: string | undefined): string[] => (s === undefined || s === '' ? [] : s.split(':'));
    const h = groups(head);
    const t = groups(tail);
    const words = [...h, ...Array<string>(tail === undefined ? 0 : 8 - h.length - t.length).fill('0'), ...t].map((g) => parseInt(g, 16));
    return words.flatMap((w) => [w >> 8, w & 0xff]);
}

/**
 * Loopback, private, link-local, unique-local, reserved and unspecified addresses,
 * v4 and v6 — an IPv6 address that embeds an IPv4 one (mapped, compatible, NAT64,
 * 6to4) is judged by the IPv4 address it reaches.
 */
export function isPrivateAddress(address: string): boolean {
    const a = address.toLowerCase();
    if (isIP(a) === 4) return ipv4Private(a.split('.').map(Number));
    if (isIP(a) !== 6) return true;
    const b = ipv6Bytes(a);
    const zero = (from: number, to: number): boolean => b.slice(from, to).every((x) => x === 0);
    if (zero(0, 10) && ((b[10] === 0xff && b[11] === 0xff) || (b[10] === 0 && b[11] === 0))) return ipv4Private(b.slice(12));
    if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b && zero(4, 12)) return ipv4Private(b.slice(12));
    if (b[0] === 0x20 && b[1] === 0x02) return ipv4Private(b.slice(2, 6));
    return (b[0] as number) >= 0xfc && (b[0] !== 0xfe || (b[1] as number) >= 0x80);
}

/** A validated URL and the one address its connection is pinned to. */
export interface PinnedUrl {
    readonly url: URL;
    readonly address: string;
    readonly family: number;
}

/**
 * Throws unless `raw` is an http(s) URL without credentials whose host
 * resolves only to public addresses. Resolves once; the returned address is
 * the only one a later connection may use.
 */
export async function resolveSourceUrl(raw: string, opts: NetworkOptions): Promise<PinnedUrl> {
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        throw new SourceError(`${raw}: not a URL`);
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new SourceError(`${raw}: scheme ${url.protocol} is not read`);
    if (url.username !== '' || url.password !== '') throw new SourceError(`${url.host}: a URL carrying credentials is refused`);
    const host = url.hostname.replace(/^\[|\]$/g, '');
    const test = overridesOf(opts);
    const family = isIP(host);
    const resolved = family !== 0 ? [{ address: host, family }] : await (test.resolver ?? systemResolver)(host);
    const exempt = test.allowPrivateHosts || test.hostAllowlist.includes(host);
    if (resolved.length === 0 || (!exempt && resolved.some((r) => isPrivateAddress(r.address)))) {
        throw new SourceError(`${host}: resolves to a private, loopback or link-local address`);
    }
    const [first] = resolved as [{ address: string; family: number }];
    return { url, address: first.address, family: first.family };
}

/** Throws unless `raw` is an http(s) URL without credentials whose host resolves only to public addresses. */
export async function validateSourceUrl(raw: string, opts: NetworkOptions): Promise<URL> {
    return (await resolveSourceUrl(raw, opts)).url;
}

interface PinnedResponse {
    readonly status: number;
    readonly location: string | null;
    readonly body: Buffer;
}

/** One GET whose socket connects to `pinned.address` and nowhere else, body capped. */
function pinnedGet(pinned: PinnedUrl, maxBytes: number, timeoutMs: number): Promise<PinnedResponse> {
    const pin: LookupFunction = (_host, options, callback) => {
        if ((options as { all?: boolean }).all === true) {
            (callback as unknown as (e: null, a: Array<{ address: string; family: number }>) => void)(null, [
                { address: pinned.address, family: pinned.family },
            ]);
        } else callback(null, pinned.address, pinned.family);
    };
    const where = pinned.url.host;
    return new Promise((resolve, reject) => {
        const onResponse = (res: http.IncomingMessage): void => {
            const status = res.statusCode ?? 0;
            if (status >= 300 && status < 400) {
                res.resume();
                resolve({ status, location: res.headers.location ?? null, body: Buffer.alloc(0) });
                return;
            }
            const chunks: Buffer[] = [];
            let total = 0;
            res.on('data', (chunk: Buffer) => {
                total += chunk.byteLength;
                if (total > maxBytes) {
                    req.destroy();
                    reject(new SourceError(`${where}: body exceeds ${maxBytes} bytes`));
                    return;
                }
                chunks.push(chunk);
            });
            res.on('end', () => resolve({ status, location: null, body: Buffer.concat(chunks) }));
            res.on('error', reject);
        };
        const options = { lookup: pin, headers: { accept: 'text/*, application/json' }, signal: AbortSignal.timeout(timeoutMs) };
        // Both calls spelled out, so the read-surface scan still sees this module's network read.
        const req = pinned.url.protocol === 'https:' ? https.get(pinned.url, options, onResponse) : http.get(pinned.url, options, onResponse);
        req.on('error', reject);
    });
}

/** One read-only GET of a named source, every redirect hop re-validated. */
export async function fetchUrlSource(raw: string, opts: NetworkOptions): Promise<UrlSourceRef> {
    if (!opts.network) {
        return { identity: raw, kind: 'url', pin: '', digest: '', tier: 'read', text: '', degraded: DEGRADED_NO_NETWORK };
    }
    const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
    let current = raw;
    for (let hop = 0; hop <= maxRedirects; hop += 1) {
        const pinned = await resolveSourceUrl(current, opts);
        const url = pinned.url;
        const res = await pinnedGet(pinned, opts.maxBytes ?? DEFAULT_MAX_BYTES, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
        if (res.status >= 300 && res.status < 400) {
            if (res.location === null) throw new SourceError(`${url.host}: redirect without a location`);
            current = new URL(res.location, url).toString();
            continue;
        }
        if (res.status < 200 || res.status >= 300) throw new SourceError(`${url.host}: HTTP ${res.status}`);
        const body = res.body;
        const digest = `sha256:${createHash('sha256').update(body).digest('hex')}`;
        return { identity: raw, kind: 'url', pin: digest, digest, tier: 'read', text: sanitize_text(body.toString('utf8')), degraded: null };
    }
    throw new SourceError(`${raw}: more than ${maxRedirects} redirects`);
}

/**
 * A repository cloned at depth 1 into `workDir`, hooks disabled, then read
 * through the local-clone adapter so the pin is the clone's HEAD as a file.
 */
export async function cloneRepoSource(raw: string, workDir: string, opts: NetworkOptions & { pinSha?: string }): Promise<SourceRef> {
    if (!opts.network) throw new SourceError(`${raw}: ${DEGRADED_NO_NETWORK} — a repository needs the network`);
    // Passed to git as an argument: anything but a full SHA could be read as an option.
    if (opts.pinSha !== undefined && !/^[0-9a-f]{40}$/.test(opts.pinSha)) throw new SourceError(`${raw}: pin ${opts.pinSha} is not a 40-hex commit SHA`);
    const local = raw.startsWith('file://') && overridesOf(opts).allowPrivateHosts;
    // git resolves the host itself; `http.curloptResolve` makes it use the
    // address validated here instead of asking DNS a second time.
    const resolveArgs: string[] = [];
    if (!local) {
        const pinned = await resolveSourceUrl(raw, opts);
        const port = pinned.url.port !== '' ? pinned.url.port : pinned.url.protocol === 'https:' ? '443' : '80';
        const addr = pinned.family === 6 ? `[${pinned.address}]` : pinned.address;
        resolveArgs.push('-c', `http.curloptResolve=${pinned.url.hostname.replace(/^\[|\]$/g, '')}:${port}:${addr}`);
    }
    const dest = path.join(workDir, 'source');
    fs.mkdirSync(workDir, { recursive: true });
    // An inherited GIT_DIR (a hook, a worktree) would point the clone at the caller's repository.
    const { GIT_DIR: _d, GIT_WORK_TREE: _w, GIT_INDEX_FILE: _i, ...env } = process.env;
    // git follows the first redirect by default, and only the URL above was validated: refuse every hop.
    const git = (args: string[], cwd?: string): void => {
        execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'protocol.ext.allow=never', '-c', 'http.followRedirects=false', ...resolveArgs, ...args], {
            cwd,
            stdio: 'pipe',
            timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
            env: { ...env, GIT_TERMINAL_PROMPT: '0' },
        });
    };
    git(['clone', '--depth', '1', '--no-tags', '--', raw, dest]);
    if (opts.pinSha !== undefined) {
        git(['fetch', '--depth', '1', 'origin', opts.pinSha], dest);
        git(['checkout', '--detach', opts.pinSha], dest);
    }
    const ref = resolveSource(dest);
    if (opts.pinSha !== undefined && ref.pin !== opts.pinSha) throw new SourceError(`${raw}: HEAD ${ref.pin} is not the pin ${opts.pinSha}`);
    return { ...ref, identity: raw };
}

/** The line of `needle` and at most fifteen words around it — the content-quoting floor. */
export function quotedAnchor(text: string, needle: string): { line: number; quote: string } {
    const lines = text.split('\n');
    const i = lines.findIndex((l) => l.includes(needle));
    if (i === -1) return { line: 0, quote: '' };
    const words = (lines[i] as string).trim().split(/\s+/);
    const at = Math.max(0, words.findIndex((w) => w.includes(needle)));
    const start = Math.max(0, Math.min(at - 5, words.length - MAX_QUOTE_WORDS));
    return { line: i + 1, quote: words.slice(start, start + MAX_QUOTE_WORDS).join(' ') };
}

/** Codes source identities S1, S2, …; the identities leave only as ENC1 tokens in the round's intake.md. */
export class SourceCodebook {
    private readonly ids: string[] = [];
    private readonly tokens: string[] = [];

    constructor(private readonly key: string) {}

    code(identity: string): string {
        let i = this.ids.indexOf(identity);
        if (i === -1) {
            this.ids.push(identity);
            this.tokens.push(encrypt(identity, this.key));
            i = this.ids.length - 1;
        }
        return `S${String(i + 1)}`;
    }

    intakeMarkdown(): string {
        const rows = this.tokens.map((token, i) => `- S${String(i + 1)}: ${token}`);
        return ['# Sources', '', 'Identities are encrypted (`link_crypto`); tracked output names only the codes.', '', ...rows, ''].join('\n');
    }

    writeIntake(roundDir: string): void {
        fs.mkdirSync(roundDir, { recursive: true });
        fs.writeFileSync(path.join(roundDir, 'intake.md'), this.intakeMarkdown());
    }
}
