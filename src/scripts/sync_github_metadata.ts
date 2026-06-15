#!/usr/bin/env tsx
/**
 * Sync `.github/topics.yml` + `.github/about.yml` to the GitHub repo.
 *
 * TypeScript twin of `src/scripts/sync_github_metadata.py` (ADR-200, Phase 5).
 * The CLI contract is mirrored EXACTLY — every flag (`--apply`, `--strict`,
 * `--quiet`, `--repo`), exit codes (0 = synced / applied; 2 = drift under
 * `--strict` dry-run; 1 = error via SystemExit — missing token, unresolvable
 * repo, HTTP/transport error), the stdout/stderr split, byte-identical
 * messages, and byte-identical unified-diff output (`json.dumps(indent=2,
 * sort_keys=True)` on remote vs desired).
 *
 * The GitHub REST transport is INJECTABLE (`options.request`) so tests run
 * against a stub with zero network. Error-swallowing is mirrored exactly:
 * any HTTP / transport failure raises `ExitError` → message to stderr, exit 1.
 *
 * No behaviour changes — latent Python quirks replicated. NOTE: the audit log
 * path mirrors the CODE constant (`agents/notes/visibility-sync-audit.md`),
 * not the docstring's `agents/evidence/notes/…` — DIVERGENCE CANDIDATE below.
 *
 * Auth: `GITHUB_TOKEN` env var. Repo slug from `package.json` `repository.url`
 * or `--repo owner/name`.
 */
import * as fs from 'node:fs';
import * as https from 'node:https';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

type Json = unknown;
type JsonObject = Record<string, Json>;

const _HERE = fileURLToPath(import.meta.url);
// _HERE === <repo>/src/scripts/sync_github_metadata.ts ; the Python original
// derives ROOT = <file>.parents[2] — two dirs up from src/scripts.
export const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

// Path config is a mutable seam so tests can point at a fixture tree.
interface PathConfig {
    TOPICS_FILE: string;
    ABOUT_FILE: string;
    AUDIT_FILE: string;
    PKG_FILE: string;
}

function _deriveConfig(root: string): PathConfig {
    return {
        TOPICS_FILE: path.join(root, '.github', 'topics.yml'),
        ABOUT_FILE: path.join(root, '.github', 'about.yml'),
        // DIVERGENCE CANDIDATE: the Python CODE writes to
        // agents/notes/visibility-sync-audit.md (the docstring says
        // agents/evidence/notes/…). The code path wins — replicated here.
        AUDIT_FILE: path.join(root, 'agents', 'notes', 'visibility-sync-audit.md'),
        PKG_FILE: path.join(root, 'package.json'),
    };
}

const _config: PathConfig = _deriveConfig(ROOT);

/** Test seam mirroring monkeypatch of module-level path constants. */
export function _setRootForTest(root: string): void {
    Object.assign(_config, _deriveConfig(root));
}

export const API = 'https://api.github.com';

/** Raised to mirror `sys.exit("ERROR: …")` — message to stderr, exit 1. */
export class ExitError extends Error {}

/**
 * Injectable transport. Mirrors `_request(method, url, token, body)`:
 * returns the parsed JSON object on 2xx; THROWS `ExitError` with the exact
 * Python message on HTTP / network failure.
 */
export type RequestFn = (
    method: string,
    url: string,
    token: string,
    body: JsonObject | null,
) => Promise<JsonObject>;

function _loadYaml(p: string): JsonObject {
    return (parseYaml(fs.readFileSync(p, 'utf-8'), { version: '1.1' }) as JsonObject | null) ?? {};
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

export function _resolve_repo(explicit: string | null): string {
    if (explicit) {
        return explicit;
    }
    const pkg = JSON.parse(fs.readFileSync(_config.PKG_FILE, 'utf-8')) as JsonObject;
    const repo = (pkg['repository'] as JsonObject | undefined) ?? {};
    const url = (repo['url'] as string | undefined) ?? '';
    const m = /github\.com[:/]+([^/]+\/[^/.]+)/.exec(url);
    if (!m) {
        throw new ExitError('ERROR: cannot resolve owner/repo from package.json; pass --repo');
    }
    return m[1] as string;
}

/** Default real transport (https.request, 20 s timeout). */
const _defaultRequest: RequestFn = (method, url, token, body) =>
    new Promise<JsonObject>((resolve, reject) => {
        const u = new URL(url);
        const data = body !== null ? Buffer.from(JSON.stringify(body), 'utf-8') : null;
        const headers: Record<string, string> = {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'event4u-agent-config-sync',
        };
        if (data !== null) {
            headers['Content-Type'] = 'application/json';
            headers['Content-Length'] = String(data.length);
        }
        const req = https.request(
            { method, hostname: u.hostname, path: u.pathname + u.search, headers, timeout: 20_000 },
            (res) => {
                const chunks: Buffer[] = [];
                res.on('data', (c: Buffer) => chunks.push(c));
                res.on('end', () => {
                    const status = res.statusCode ?? 0;
                    const bodyText = Buffer.concat(chunks).toString('utf-8');
                    if (status >= 400) {
                        reject(
                            new ExitError(
                                `ERROR: ${method} ${url} → HTTP ${status}: ${bodyText.slice(0, 300)}`,
                            ),
                        );
                        return;
                    }
                    try {
                        resolve((JSON.parse(bodyText || '{}') as JsonObject) ?? {});
                    } catch {
                        resolve({});
                    }
                });
            },
        );
        req.on('timeout', () => {
            req.destroy(new Error('timed out'));
        });
        req.on('error', (e: Error) => {
            reject(new ExitError(`ERROR: ${method} ${url} → ${e.message}`));
        });
        if (data !== null) req.write(data);
        req.end();
    });

/** Port of Python difflib.unified_diff over json.dumps(indent=2, sort_keys=True). */
function _diff(label: string, remote: Json, desired: Json): string[] {
    const a = pyJsonSorted(remote).split('\n');
    const b = pyJsonSorted(desired).split('\n');
    return unified_diff(a, b, `remote/${label}`, `desired/${label}`, 3, '');
}

function _audit(repo: string, mutations: string[]): void {
    fs.mkdirSync(path.dirname(_config.AUDIT_FILE), { recursive: true });
    if (!_isFile(_config.AUDIT_FILE)) {
        fs.writeFileSync(
            _config.AUDIT_FILE,
            '# Visibility sync audit log\n\nAppend-only. Every `--apply` run logs one block.\n',
            'utf-8',
        );
    }
    const now = new Date();
    const ts =
        `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-` +
        `${String(now.getUTCDate()).padStart(2, '0')}T${String(now.getUTCHours()).padStart(2, '0')}:` +
        `${String(now.getUTCMinutes()).padStart(2, '0')}:${String(now.getUTCSeconds()).padStart(2, '0')}Z`;
    const block = [`\n## ${ts} — ${repo}\n`];
    for (const m of mutations) block.push(`- ${m}\n`);
    fs.appendFileSync(_config.AUDIT_FILE, block.join(''), 'utf-8');
}

interface ParsedArgs {
    apply: boolean;
    strict: boolean;
    quiet: boolean;
    repo: string | null;
}

function parse_args(argv: readonly string[]): ParsedArgs {
    const args: ParsedArgs = { apply: false, strict: false, quiet: false, repo: null };
    const usage =
        'usage: sync_github_metadata.py [-h] [--apply] [--strict] [--quiet] [--repo REPO]\n';
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i] as string;
        if (arg === '-h' || arg === '--help') {
            process.stdout.write(usage);
            process.exit(0);
        } else if (arg === '--apply') {
            args.apply = true;
        } else if (arg === '--strict') {
            args.strict = true;
        } else if (arg === '--quiet') {
            args.quiet = true;
        } else if (arg === '--repo') {
            const next = argv[i + 1];
            if (next === undefined) {
                process.stderr.write(usage);
                process.stderr.write('sync_github_metadata.py: error: argument --repo: expected one argument\n');
                process.exit(2);
            }
            args.repo = next;
            i += 1;
        } else if (arg.startsWith('--repo=')) {
            args.repo = arg.slice('--repo='.length);
        } else {
            process.stderr.write(usage);
            process.stderr.write(`sync_github_metadata.py: error: unrecognized arguments: ${arg}\n`);
            process.exit(2);
        }
    }
    return args;
}

/** Pythonic Pyport of main(). `options.request` injects the transport. */
export async function main(
    argv: readonly string[],
    options: { request?: RequestFn; token?: string | null } = {},
): Promise<number> {
    const args = parse_args(argv);
    const request = options.request ?? _defaultRequest;

    const repo = _resolve_repo(args.repo);
    const token = options.token !== undefined ? options.token : process.env['GITHUB_TOKEN'] ?? null;
    if (!token) {
        throw new ExitError('ERROR: GITHUB_TOKEN not set');
    }

    const topics_doc = _loadYaml(_config.TOPICS_FILE);
    const about_doc = _loadYaml(_config.ABOUT_FILE);
    const desired_topics = ((topics_doc['topics'] as string[] | null | undefined) ?? [])
        .slice()
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const desired_about: JsonObject = {
        description: about_doc['description'] ?? '',
        homepage: about_doc['homepage'] ?? '',
    };

    const topicsResp = await request('GET', `${API}/repos/${repo}/topics`, token, null);
    const remote_topics = ((topicsResp['names'] as string[] | null | undefined) ?? [])
        .slice()
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const repo_payload = await request('GET', `${API}/repos/${repo}`, token, null);
    const remote_about: JsonObject = {
        description: repo_payload['description'] ?? '',
        homepage: repo_payload['homepage'] ?? '',
    };

    const topic_diff = _diff('topics', remote_topics, desired_topics);
    const about_diff = _diff('about', remote_about, desired_about);
    const has_drift = topic_diff.length > 0 || about_diff.length > 0;

    if (!args.quiet) {
        if (topic_diff.length > 0) process.stdout.write(topic_diff.join('\n') + '\n');
        if (about_diff.length > 0) process.stdout.write(about_diff.join('\n') + '\n');
        if (!has_drift) process.stdout.write(`✅  ${repo}: topics + about already in sync\n`);
    }

    if (!args.apply) {
        return has_drift && args.strict ? 2 : 0;
    }

    const mutations: string[] = [];
    if (topic_diff.length > 0) {
        await request('PUT', `${API}/repos/${repo}/topics`, token, { names: desired_topics });
        mutations.push(`topics → ${pyReprList(desired_topics)}`);
    }
    if (about_diff.length > 0) {
        await request('PATCH', `${API}/repos/${repo}`, token, desired_about);
        mutations.push(`about → ${pyReprDict(desired_about)}`);
    }
    if (mutations.length > 0) {
        _audit(repo, mutations);
        if (!args.quiet) {
            process.stdout.write(`✅  ${repo}: applied ${mutations.length} mutation(s); audit appended\n`);
        }
    } else if (!args.quiet) {
        process.stdout.write(`✅  ${repo}: nothing to apply\n`);
    }
    return 0;
}

// --- Python repr() for the audit-row mutation strings -----------------------

/** Mirror Python repr() of a list[str] — single-quoted elements. */
function pyReprList(items: readonly string[]): string {
    return '[' + items.map((s) => pyReprStr(s)).join(', ') + ']';
}

/** Mirror Python repr() of dict[str, str] — `{'k': 'v', …}`. */
function pyReprDict(o: JsonObject): string {
    const parts = Object.keys(o).map((k) => `${pyReprStr(k)}: ${pyReprStr(String(o[k]))}`);
    return '{' + parts.join(', ') + '}';
}

/** Mirror Python repr() of a str — prefer single quotes. */
function pyReprStr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let out = quote;
    for (const ch of s) {
        if (ch === '\\') out += '\\\\';
        else if (ch === quote) out += '\\' + quote;
        else if (ch === '\n') out += '\\n';
        else if (ch === '\r') out += '\\r';
        else if (ch === '\t') out += '\\t';
        else out += ch;
    }
    return out + quote;
}

// --- json.dumps(indent=2, sort_keys=True) for diff lines (ASCII-safe) -------

function pyJsonSorted(value: Json): string {
    const pad = '  ';
    function enc(v: Json, depth: number): string {
        if (v === null || v === undefined) return 'null';
        if (typeof v === 'boolean') return v ? 'true' : 'false';
        if (typeof v === 'number') return String(v);
        if (typeof v === 'string') return encStr(v);
        if (Array.isArray(v)) {
            if (v.length === 0) return '[]';
            return (
                '[\n' +
                v.map((x) => pad.repeat(depth + 1) + enc(x, depth + 1)).join(',\n') +
                '\n' +
                pad.repeat(depth) +
                ']'
            );
        }
        const o = v as JsonObject;
        const keys = Object.keys(o).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        if (keys.length === 0) return '{}';
        return (
            '{\n' +
            keys.map((k) => pad.repeat(depth + 1) + encStr(k) + ': ' + enc(o[k], depth + 1)).join(',\n') +
            '\n' +
            pad.repeat(depth) +
            '}'
        );
    }
    function encStr(s: string): string {
        let out = '"';
        for (const ch of s) {
            const cp = ch.codePointAt(0) as number;
            if (ch === '"') out += '\\"';
            else if (ch === '\\') out += '\\\\';
            else if (ch === '\n') out += '\\n';
            else if (ch === '\r') out += '\\r';
            else if (ch === '\t') out += '\\t';
            else if (ch === '\b') out += '\\b';
            else if (ch === '\f') out += '\\f';
            else if (cp < 0x20) out += '\\u' + cp.toString(16).padStart(4, '0');
            else if (cp < 0x7f) out += ch;
            else if (cp > 0xffff) {
                const x = cp - 0x10000;
                out += '\\u' + (0xd800 + (x >> 10)).toString(16).padStart(4, '0');
                out += '\\u' + (0xdc00 + (x & 0x3ff)).toString(16).padStart(4, '0');
            } else out += '\\u' + cp.toString(16).padStart(4, '0');
        }
        return out + '"';
    }
    return enc(value, 0);
}

// --- difflib.unified_diff port (non-keepends, lineterm="") ------------------

interface OpCode {
    tag: string;
    i1: number;
    i2: number;
    j1: number;
    j2: number;
}

function _matchingBlocks(a: readonly string[], b: readonly string[]): Array<[number, number, number]> {
    const b2j = new Map<string, number[]>();
    for (let i = 0; i < b.length; i += 1) {
        const el = b[i] as string;
        const arr = b2j.get(el);
        if (arr) arr.push(i);
        else b2j.set(el, [i]);
    }
    function findLongest(alo: number, ahi: number, blo: number, bhi: number): [number, number, number] {
        let besti = alo;
        let bestj = blo;
        let bestsize = 0;
        let j2len = new Map<number, number>();
        for (let i = alo; i < ahi; i += 1) {
            const newj2len = new Map<number, number>();
            const js = b2j.get(a[i] as string) ?? [];
            for (const j of js) {
                if (j < blo) continue;
                if (j >= bhi) break;
                const k = (j2len.get(j - 1) ?? 0) + 1;
                newj2len.set(j, k);
                if (k > bestsize) {
                    besti = i - k + 1;
                    bestj = j - k + 1;
                    bestsize = k;
                }
            }
            j2len = newj2len;
        }
        return [besti, bestj, bestsize];
    }
    const queue: Array<[number, number, number, number]> = [[0, a.length, 0, b.length]];
    const blocks: Array<[number, number, number]> = [];
    while (queue.length > 0) {
        const [alo, ahi, blo, bhi] = queue.pop() as [number, number, number, number];
        const [i, j, k] = findLongest(alo, ahi, blo, bhi);
        if (k > 0) {
            blocks.push([i, j, k]);
            if (alo < i && blo < j) queue.push([alo, i, blo, j]);
            if (i + k < ahi && j + k < bhi) queue.push([i + k, ahi, j + k, bhi]);
        }
    }
    blocks.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    blocks.push([a.length, b.length, 0]);
    return blocks;
}

function _getOpcodes(a: readonly string[], b: readonly string[]): OpCode[] {
    let i = 0;
    let j = 0;
    const answer: OpCode[] = [];
    for (const [ai, bj, size] of _matchingBlocks(a, b)) {
        let tag = '';
        if (i < ai && j < bj) tag = 'replace';
        else if (i < ai) tag = 'delete';
        else if (j < bj) tag = 'insert';
        if (tag) answer.push({ tag, i1: i, i2: ai, j1: j, j2: bj });
        i = ai + size;
        j = bj + size;
        if (size > 0) answer.push({ tag: 'equal', i1: ai, i2: i, j1: bj, j2: j });
    }
    return answer;
}

function _getGroupedOpcodes(a: readonly string[], b: readonly string[], n: number): OpCode[][] {
    let codes = _getOpcodes(a, b);
    if (codes.length === 0) codes = [{ tag: 'equal', i1: 0, i2: 1, j1: 0, j2: 1 }];
    if (codes[0]!.tag === 'equal') {
        const c = codes[0]!;
        codes[0] = { tag: c.tag, i1: Math.max(c.i1, c.i2 - n), i2: c.i2, j1: Math.max(c.j1, c.j2 - n), j2: c.j2 };
    }
    const last = codes[codes.length - 1]!;
    if (last.tag === 'equal') {
        codes[codes.length - 1] = {
            tag: last.tag,
            i1: last.i1,
            i2: Math.min(last.i2, last.i1 + n),
            j1: last.j1,
            j2: Math.min(last.j2, last.j1 + n),
        };
    }
    const nn = n + n;
    const groups: OpCode[][] = [];
    let group: OpCode[] = [];
    for (const code of codes) {
        let { i1, j1 } = code;
        const { tag, i2, j2 } = code;
        if (tag === 'equal' && i2 - i1 > nn) {
            group.push({ tag, i1, i2: Math.min(i2, i1 + n), j1, j2: Math.min(j2, j1 + n) });
            groups.push(group);
            group = [];
            i1 = Math.max(i1, i2 - n);
            j1 = Math.max(j1, j2 - n);
        }
        group.push({ tag, i1, i2, j1, j2 });
    }
    if (group.length > 0 && !(group.length === 1 && group[0]!.tag === 'equal')) {
        groups.push(group);
    }
    return groups;
}

function _formatRangeUnified(start: number, stop: number): string {
    let beginning = start + 1;
    const length = stop - start;
    if (length === 1) return `${beginning}`;
    if (length === 0) beginning -= 1;
    return `${beginning},${length}`;
}

/** Port of Python difflib.unified_diff(a, b, fromfile, tofile, n, lineterm). */
export function unified_diff(
    a: readonly string[],
    b: readonly string[],
    fromfile: string,
    tofile: string,
    n: number,
    lineterm: string,
): string[] {
    const out: string[] = [];
    let started = false;
    for (const group of _getGroupedOpcodes(a, b, n)) {
        if (!started) {
            started = true;
            out.push(`--- ${fromfile}${lineterm}`);
            out.push(`+++ ${tofile}${lineterm}`);
        }
        const first = group[0]!;
        const last = group[group.length - 1]!;
        const file1Range = _formatRangeUnified(first.i1, last.i2);
        const file2Range = _formatRangeUnified(first.j1, last.j2);
        out.push(`@@ -${file1Range} +${file2Range} @@${lineterm}`);
        for (const { tag, i1, i2, j1, j2 } of group) {
            if (tag === 'equal') {
                for (const line of a.slice(i1, i2)) out.push(' ' + line);
                continue;
            }
            if (tag === 'replace' || tag === 'delete') {
                for (const line of a.slice(i1, i2)) out.push('-' + line);
            }
            if (tag === 'replace' || tag === 'insert') {
                for (const line of b.slice(j1, j2)) out.push('+' + line);
            }
        }
    }
    return out;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    main(process.argv.slice(2)).then(
        (code) => process.exit(code),
        (exc: unknown) => {
            if (exc instanceof ExitError) {
                process.stderr.write(`${exc.message}\n`);
                process.exit(1);
            }
            throw exc;
        },
    );
}
