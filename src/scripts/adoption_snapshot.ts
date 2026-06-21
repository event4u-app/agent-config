#!/usr/bin/env node
/**
 * Pull the four public adoption signals into a single dated JSONL row.
 *
 * TypeScript twin of `src/scripts/adoption_snapshot.py` (ADR-200, Phase 8
 * Wave 8a). Mirrors the Python CLI contract EXACTLY — flags (`--out`,
 * `--no-network`), exit codes (0 / 1 / 2), stdout/stderr split, and the
 * byte-identical JSONL row (`json.dumps(row)` default separators,
 * ensure_ascii=True, no trailing space differences).
 *
 * Phase D Step 2 of `road-to-adoption-proof-and-ci-green.md`.
 * Signals (per `docs/contracts/adoption-signal-floor.md`):
 *
 *   1. npm install count          — last 7 days, full lifetime.
 *   2. npm version distribution    — latest published version.
 *   3. GitHub stars / forks        — current count.
 *   4. Topic-search rank           — best-rank position for the two
 *      project-scoped topics (`agent-skills`, `cinematic-ai-video`).
 *
 * Output: one JSONL row appended to
 * `agents/runtime/metrics/adoption-snapshots.jsonl`. Each row carries
 * an ISO-8601 `snapshot_at` timestamp + the four signal payloads.
 *
 * CLI:
 *
 *   scripts/adoption_snapshot.ts [--out <path>] [--no-network]
 *
 * Exit codes:
 *
 *   0 — row appended successfully.
 *   1 — IO failure writing the JSONL.
 *   2 — every signal failed (network outage; the row is appended but
 *       annotated, so trend reports can spot the outage).
 */
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as https from 'node:https';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(_HERE, '..', '..');
export const DEFAULT_OUT = path.join(
    REPO_ROOT,
    'agents',
    'runtime',
    'metrics',
    'adoption-snapshots.jsonl',
);

const NPM_PACKAGE = '@event4u/agent-config';
const NPM_DOWNLOADS_URL = `https://api.npmjs.org/downloads/range/last-week/${NPM_PACKAGE}`;
const NPM_REGISTRY_URL = `https://registry.npmjs.org/${NPM_PACKAGE.replace(/\//g, '%2F')}`;
const GH_REPO = 'event4u-app/agent-config';
const GH_REPO_URL = `https://api.github.com/repos/${GH_REPO}`;
const GH_TOPICS: readonly string[] = ['agent-skills', 'cinematic-ai-video'];
const GH_SEARCH_URL_TEMPLATE =
    'https://api.github.com/search/repositories?q=topic:{topic}&sort=stars&order=desc&per_page=100';

const TIMEOUT_S = 10;

// Free-form JSON-ish value type for signal payloads. The Python original uses
// `dict[str, Any]`; the only documented `any`-shaped surface (HTTP JSON).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
type SignalDict = Record<string, Json>;

// --- Python json.dumps emulation (default separators, ensure_ascii=True) -----

/** Mirror Python's json.dumps string escaping with ensure_ascii=True. */
function _pyJsonStr(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        if (ch === '"') {
            out += '\\"';
        } else if (ch === '\\') {
            out += '\\\\';
        } else if (ch === '\n') {
            out += '\\n';
        } else if (ch === '\r') {
            out += '\\r';
        } else if (ch === '\t') {
            out += '\\t';
        } else if (ch === '\b') {
            out += '\\b';
        } else if (ch === '\f') {
            out += '\\f';
        } else if (code < 0x20) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else if (code < 0x7f) {
            out += ch;
        } else if (code <= 0xffff) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else {
            // Non-BMP → UTF-16 surrogate pair, matching CPython's json.
            const c = code - 0x10000;
            const hi = 0xd800 + (c >> 10);
            const lo = 0xdc00 + (c & 0x3ff);
            out += `\\u${hi.toString(16).padStart(4, '0')}\\u${lo.toString(16).padStart(4, '0')}`;
        }
    }
    return out + '"';
}

function _pyNum(n: number): string {
    if (Number.isInteger(n)) {
        return String(n);
    }
    return String(n);
}

/**
 * Mirror `json.dumps(obj)` — default compact-ish form: separators `", "`
 * and `": "`, ensure_ascii=True, insertion order preserved (sort_keys=False).
 */
function pyJsonDumps(obj: Json): string {
    if (obj === null) {
        return 'null';
    }
    if (obj === true) {
        return 'true';
    }
    if (obj === false) {
        return 'false';
    }
    if (typeof obj === 'number') {
        return _pyNum(obj);
    }
    if (typeof obj === 'string') {
        return _pyJsonStr(obj);
    }
    if (Array.isArray(obj)) {
        return `[${obj.map((v) => pyJsonDumps(v)).join(', ')}]`;
    }
    if (typeof obj === 'object') {
        const parts: string[] = [];
        for (const k of Object.keys(obj as SignalDict)) {
            parts.push(`${_pyJsonStr(k)}: ${pyJsonDumps((obj as SignalDict)[k])}`);
        }
        return `{${parts.join(', ')}}`;
    }
    return 'null';
}

function _utc_now_iso(): string {
    const d = new Date();
    const pad = (n: number): string => String(n).padStart(2, '0');
    return (
        `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
        `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`
    );
}

async function _http_get_json(url: string, headers?: Record<string, string>): Promise<Json> {
    return new Promise<Json>((resolve, reject) => {
        const lib = url.startsWith('https:') ? https : http;
        const req = lib.request(
            url,
            { method: 'GET', headers: headers ?? {}, timeout: TIMEOUT_S * 1000 },
            (resp) => {
                const status = resp.statusCode ?? 0;
                const chunks: Buffer[] = [];
                resp.on('data', (c: Buffer) => chunks.push(c));
                resp.on('end', () => {
                    const body = Buffer.concat(chunks).toString('utf-8');
                    // urllib.urlopen raises HTTPError on 4xx/5xx before .read().
                    if (status >= 400) {
                        reject(new Error(`HTTP Error ${status}`));
                        return;
                    }
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        reject(e as Error);
                    }
                });
            },
        );
        req.on('error', (e) => reject(e));
        req.on('timeout', () => {
            req.destroy(new Error('timed out'));
        });
        req.end();
    });
}

function _errStr(exc: unknown): string {
    const msg = exc instanceof Error ? exc.message : String(exc);
    return msg.slice(0, 120);
}

function _ghHeaders(): Record<string, string> {
    const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
    const token = process.env['GITHUB_TOKEN'] || process.env['GH_TOKEN'];
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

export async function fetch_npm_downloads(): Promise<SignalDict> {
    try {
        const data = await _http_get_json(NPM_DOWNLOADS_URL);
        const downloads = (data['downloads'] ?? []) as Json[];
        let total_7d = 0;
        for (const d of downloads) {
            if (d !== null && typeof d === 'object' && !Array.isArray(d)) {
                total_7d += (d['downloads'] ?? 0) as number;
            }
        }
        return { package: NPM_PACKAGE, last_7_days: total_7d, source: 'npm' };
    } catch (exc) {
        return { package: NPM_PACKAGE, error: _errStr(exc), source: 'npm' };
    }
}

export async function fetch_npm_version(): Promise<SignalDict> {
    try {
        const data = await _http_get_json(NPM_REGISTRY_URL);
        const latest = (((data['dist-tags'] ?? {}) as Json)['latest'] ?? '') as string;
        const versions = Object.keys((data['versions'] ?? {}) as Json);
        return { latest, version_count: versions.length, source: 'npm-registry' };
    } catch (exc) {
        return { error: _errStr(exc), source: 'npm-registry' };
    }
}

export async function fetch_github_stars(): Promise<SignalDict> {
    try {
        const data = await _http_get_json(GH_REPO_URL, _ghHeaders());
        return {
            repo: GH_REPO,
            stars: (data['stargazers_count'] ?? 0) as number,
            forks: (data['forks_count'] ?? 0) as number,
            watchers: (data['watchers_count'] ?? 0) as number,
            source: 'github-repo',
        };
    } catch (exc) {
        return { repo: GH_REPO, error: _errStr(exc), source: 'github-repo' };
    }
}

export async function fetch_topic_rank(): Promise<SignalDict> {
    const out: SignalDict = { source: 'github-search' };
    for (const topic of GH_TOPICS) {
        try {
            const data = await _http_get_json(
                GH_SEARCH_URL_TEMPLATE.replace('{topic}', topic),
                _ghHeaders(),
            );
            const items = (data['items'] ?? []) as Json[];
            let rank: number | null = null;
            for (let i = 0; i < items.length; i++) {
                if ((items[i] as Json)['full_name'] === GH_REPO) {
                    rank = i + 1;
                    break;
                }
            }
            out[topic] = { rank, total_results: (data['total_count'] ?? 0) as number };
        } catch (exc) {
            out[topic] = { error: _errStr(exc) };
        }
    }
    return out;
}

export async function collect_signals(skip_network: boolean): Promise<SignalDict> {
    if (skip_network) {
        const skipped = (): SignalDict => ({ error: 'skipped', source: 'skipped' });
        return {
            npm_downloads: skipped(),
            npm_version: skipped(),
            github_stars: skipped(),
            topic_rank: skipped(),
        };
    }
    return {
        npm_downloads: await fetch_npm_downloads(),
        npm_version: await fetch_npm_version(),
        github_stars: await fetch_github_stars(),
        topic_rank: await fetch_topic_rank(),
    };
}

export function build_row(signals: SignalDict): SignalDict {
    return {
        snapshot_at: _utc_now_iso(),
        schema: 'adoption-snapshot/v0',
        signals,
    };
}

export function append_row(out_path: string, row: SignalDict): void {
    fs.mkdirSync(path.dirname(out_path), { recursive: true });
    fs.appendFileSync(out_path, pyJsonDumps(row) + '\n', 'utf-8');
}

/**
 * True when every signal (or every topic in topic_rank) errored.
 *
 * A signal block carries `error` when its HTTP call failed. For
 * `topic_rank`, the outer dict does NOT carry `error`; instead each
 * nested per-topic entry does. The outage predicate counts the
 * composite as a failure when every nested topic errored.
 */
export function all_signals_failed(signals: SignalDict): boolean {
    for (const name of Object.keys(signals)) {
        const value = signals[name] as Json;
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
            return false; // Unknown shape — treat as success to be conservative.
        }
        if (name === 'topic_rank') {
            // Outage when every nested topic errored.
            const nested: Json[] = [];
            for (const k of Object.keys(value)) {
                if (k === 'source') {
                    continue;
                }
                const v = value[k];
                if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
                    nested.push(v);
                }
            }
            if (nested.length === 0) {
                return false;
            }
            if (nested.some((v) => !('error' in (v as object)))) {
                return false;
            }
        } else {
            if (!('error' in (value as object))) {
                return false;
            }
        }
    }
    return true;
}

interface Args {
    out: string;
    no_network: boolean;
}

/** Mirror argparse: `--out <path>` (default DEFAULT_OUT), `--no-network` flag. */
export function parse_args(argv: string[]): Args {
    const args: Args = { out: DEFAULT_OUT, no_network: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--no-network') {
            args.no_network = true;
        } else if (a === '--out') {
            const v = argv[++i];
            if (v === undefined) {
                process.stderr.write('argument --out: expected one argument\n');
                process.exit(2);
            }
            args.out = v;
        } else if (a.startsWith('--out=')) {
            args.out = a.slice('--out='.length);
        } else {
            process.stderr.write(`unrecognized arguments: ${a}\n`);
            process.exit(2);
        }
    }
    return args;
}

export async function main(argv: string[] | null = null): Promise<number> {
    const args = parse_args(argv ?? process.argv.slice(2));
    const signals = await collect_signals(args.no_network);
    const row = build_row(signals);
    try {
        append_row(args.out, row);
    } catch (exc) {
        process.stderr.write(`error: failed to append snapshot: ${_errStr(exc)}\n`);
        return 1;
    }
    process.stdout.write(`appended snapshot @ ${row['snapshot_at'] as string} → ${args.out}\n`);
    if (!args.no_network && all_signals_failed(signals)) {
        return 2;
    }
    return 0;
}

const _isMain = import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? '')).href;
if (_isMain) {
    // Set exitCode (not process.exit) so stdout drains fully before exit.
    main().then((rc) => {
        process.exitCode = rc;
    });
}
