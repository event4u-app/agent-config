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
 * DNS is checked before the request, not pinned for it; a rebinding resolver
 * between the two is the residual this module does not close.
 *
 * Fetched text is data. It is digested and quoted (≤ 15 words per anchor),
 * never followed as an instruction.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import * as fs from 'node:fs';
import { isIP } from 'node:net';
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
    allowPrivateHosts?: boolean;
    /** Hosts treated as public although they resolve privately — fixture servers only. */
    hostAllowlistForTests?: readonly string[];
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

/** Throws unless `raw` is an http(s) URL without credentials whose host resolves only to public addresses. */
export async function validateSourceUrl(raw: string, opts: NetworkOptions): Promise<URL> {
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        throw new SourceError(`${raw}: not a URL`);
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new SourceError(`${raw}: scheme ${url.protocol} is not read`);
    if (url.username !== '' || url.password !== '') throw new SourceError(`${url.host}: a URL carrying credentials is refused`);
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (opts.allowPrivateHosts === true || (opts.hostAllowlistForTests ?? []).includes(host)) return url;
    const addresses = isIP(host) !== 0 ? [host] : (await lookup(host, { all: true })).map((r) => r.address);
    if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
        throw new SourceError(`${host}: resolves to a private, loopback or link-local address`);
    }
    return url;
}

async function readCapped(res: Response, maxBytes: number, where: string): Promise<Buffer> {
    const reader = res.body?.getReader();
    if (reader === undefined) return Buffer.alloc(0);
    const chunks: Buffer[] = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
            await reader.cancel();
            throw new SourceError(`${where}: body exceeds ${maxBytes} bytes`);
        }
        chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
}

/** One read-only GET of a named source, every redirect hop re-validated. */
export async function fetchUrlSource(raw: string, opts: NetworkOptions): Promise<UrlSourceRef> {
    if (!opts.network) {
        return { identity: raw, kind: 'url', pin: '', digest: '', tier: 'read', text: '', degraded: DEGRADED_NO_NETWORK };
    }
    const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
    let current = raw;
    for (let hop = 0; hop <= maxRedirects; hop += 1) {
        const url = await validateSourceUrl(current, opts);
        const res = await fetch(url, {
            redirect: 'manual',
            headers: { accept: 'text/*, application/json' },
            signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
        });
        if (res.status >= 300 && res.status < 400) {
            const location = res.headers.get('location');
            if (location === null) throw new SourceError(`${url.host}: redirect without a location`);
            current = new URL(location, url).toString();
            continue;
        }
        if (!res.ok) throw new SourceError(`${url.host}: HTTP ${res.status}`);
        const body = await readCapped(res, opts.maxBytes ?? DEFAULT_MAX_BYTES, url.host);
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
    const local = raw.startsWith('file://') && opts.allowPrivateHosts === true;
    if (!local) await validateSourceUrl(raw, opts);
    const dest = path.join(workDir, 'source');
    fs.mkdirSync(workDir, { recursive: true });
    // An inherited GIT_DIR (a hook, a worktree) would point the clone at the caller's repository.
    const { GIT_DIR: _d, GIT_WORK_TREE: _w, GIT_INDEX_FILE: _i, ...env } = process.env;
    // git follows the first redirect by default, and only the URL above was validated: refuse every hop.
    const git = (args: string[], cwd?: string): void => {
        execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'protocol.ext.allow=never', '-c', 'http.followRedirects=false', ...args], {
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
