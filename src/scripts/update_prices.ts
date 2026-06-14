#!/usr/bin/env node
/**
 * Refresh `agents/runtime/.agent-prices.md` from the LiteLLM model-prices feed.
 *
 * TypeScript twin of `src/scripts/update_prices.py` (ADR-096 — Python→TS
 * migration, Phase 8 / Wave 8g). Mirrors the Python CLI contract EXACTLY —
 * the `--check` / `--path` flags, exit codes (0 ok / 1 stale-or-missing in
 * --check), the stdout/stderr split, byte-identical messages, and the
 * byte-identical written `agents/runtime/.agent-prices.md`.
 *
 * Source: LiteLLM model_prices_and_context_window.json. Network failure or
 * invalid response → fall back to `_default_prices.DEFAULT_PRICES` so the
 * file is always written.
 *
 * Network fetch + `today` (UTC date) are non-deterministic; golden parity
 * exercises `--check` (no network, fixed fixture) and the no-network write
 * path with `--path` to a temp file (timestamp line excluded). No behaviour
 * changes — latent Python quirks replicated.
 */
import * as fs from 'node:fs';
import * as https from 'node:https';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { DEFAULT_PRICES, as_rows } from './ai_council/_default_prices.js';
import { PRICES_FILE, _render_markdown, is_stale, load_prices } from './ai_council/pricing.js';

const _HERE = fileURLToPath(import.meta.url);
void _HERE;

export const LITELLM_URL =
    'https://raw.githubusercontent.com/BerriAI/litellm/main/' + 'model_prices_and_context_window.json';
export const HTTP_TIMEOUT_SECONDS = 10;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

// Models we surface in the table. Anything not in this allow-list is dropped
// from the LiteLLM payload. set(DEFAULT_PRICES.keys()) → "provider model" keys.
const ALLOW_LIST: ReadonlySet<string> = new Set(DEFAULT_PRICES.keys());

/**
 * Synchronous HTTPS GET so the CLI stays a straight-line script (Python uses
 * a blocking urlopen). Returns parsed JSON dict, or null on any failure
 * (network / timeout / non-dict / parse), printing the Python-shaped stderr
 * line on error. Implemented with a deasync-free busy spin over a small
 * worker would be brittle; instead the entry point uses an async main.
 */
async function _fetchLitellm(): Promise<Record<string, Json> | null> {
    return new Promise((resolve) => {
        const req = https.get(
            LITELLM_URL,
            { headers: { 'User-Agent': 'agent-config' }, timeout: HTTP_TIMEOUT_SECONDS * 1000 },
            (resp) => {
                if (resp.statusCode && (resp.statusCode < 200 || resp.statusCode >= 400)) {
                    resp.resume();
                    process.stderr.write(
                        `[update_prices] upstream unreachable: HTTP ${resp.statusCode}\n`,
                    );
                    resolve(null);
                    return;
                }
                const chunks: Buffer[] = [];
                resp.on('data', (c: Buffer) => chunks.push(c));
                resp.on('end', () => {
                    try {
                        const data = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
                        if (data === null || typeof data !== 'object' || Array.isArray(data)) {
                            resolve(null);
                            return;
                        }
                        resolve(data as Record<string, Json>);
                    } catch (exc) {
                        process.stderr.write(`[update_prices] upstream unreachable: ${String(exc)}\n`);
                        resolve(null);
                    }
                });
            },
        );
        req.on('timeout', () => {
            req.destroy();
            process.stderr.write('[update_prices] upstream unreachable: timeout\n');
            resolve(null);
        });
        req.on('error', (err) => {
            process.stderr.write(`[update_prices] upstream unreachable: ${String(err)}\n`);
            resolve(null);
        });
    });
}

/** Translate LiteLLM keys into (provider, model, input_per_1m, output_per_1m). */
export function _toRowsFromLitellm(
    payload: Record<string, Json>,
): Array<[string, string, number, number]> {
    const rows: Array<[string, string, number, number]> = [];
    for (const key of Object.keys(payload)) {
        const entry = payload[key];
        if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
            continue;
        }
        const provider = String((entry.litellm_provider as Json) ?? '').toLowerCase();
        // LiteLLM keys are sometimes "provider/model"; strip the prefix.
        const slash = key.indexOf('/');
        const model = slash !== -1 ? key.slice(slash + 1) : key;
        if (!ALLOW_LIST.has(`${provider} ${model}`)) {
            continue;
        }
        const inCost = entry.input_cost_per_token;
        const outCost = entry.output_cost_per_token;
        if (!_isNumber(inCost) || !_isNumber(outCost)) {
            continue;
        }
        rows.push([provider, model, Number(inCost) * 1_000_000, Number(outCost) * 1_000_000]);
    }
    // rows.sort() — lexicographic over the tuple (provider, model, in, out).
    rows.sort((a, b) => {
        if (a[0] !== b[0]) {
            return a[0] < b[0] ? -1 : 1;
        }
        if (a[1] !== b[1]) {
            return a[1] < b[1] ? -1 : 1;
        }
        if (a[2] !== b[2]) {
            return a[2] - b[2];
        }
        return a[3] - b[3];
    });
    return rows;
}

function _isNumber(v: Json): boolean {
    // Python isinstance(x, (int, float)) — excludes bool (bool is int in
    // Python but JSON never yields a python bool here; JS booleans excluded).
    return typeof v === 'number' && !Number.isNaN(v);
}

/** UTC date YYYY-MM-DD (datetime.now(utc).date().isoformat()). */
function _todayUtc(): string {
    return new Date().toISOString().slice(0, 10);
}

/** Write a fresh prices file. Returns the source label used. */
export async function refresh(p: string = PRICES_FILE): Promise<string> {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const payload = await _fetchLitellm();
    if (payload !== null) {
        const rows = _toRowsFromLitellm(payload);
        if (rows.length > 0) {
            const today = _todayUtc();
            fs.writeFileSync(p, _render_markdown(today, 'litellm-github', rows), 'utf-8');
            return 'litellm-github';
        }
    }
    // Network or filter failed → shipped defaults.
    const today = _todayUtc();
    fs.writeFileSync(p, _render_markdown(today, 'shipped-default', as_rows()), 'utf-8');
    return 'shipped-default';
}

function _cmdCheck(p: string): number {
    if (!fs.existsSync(p)) {
        process.stdout.write(`[update_prices] ${p} missing — run \`python3 scripts/update_prices.py\`\n`);
        return 1;
    }
    const table = load_prices(p);
    if (is_stale(table)) {
        process.stdout.write(`[update_prices] ${p} stale (last_updated=${table.last_updated})\n`);
        return 1;
    }
    process.stdout.write(`[update_prices] ${p} fresh (last_updated=${table.last_updated})\n`);
    return 0;
}

interface Args {
    check: boolean;
    path: string;
}

export function parseArgs(argv: string[]): Args {
    const args: Args = { check: false, path: PRICES_FILE };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--check') {
            args.check = true;
        } else if (a === '--path') {
            const v = argv[++i];
            if (v === undefined) {
                process.stderr.write('argument --path: expected one argument\n');
                process.exit(2);
            }
            args.path = v;
        } else if (a.startsWith('--path=')) {
            args.path = a.slice('--path='.length);
        } else {
            process.stderr.write(`unrecognized arguments: ${a}\n`);
            process.exit(2);
        }
    }
    return args;
}

export async function main(argv: string[] | null = null): Promise<number> {
    const args = parseArgs(argv ?? process.argv.slice(2));
    const target = args.path;
    if (args.check) {
        return _cmdCheck(target);
    }
    const src = await refresh(target);
    process.stdout.write(`[update_prices] wrote ${target} (source=${src})\n`);
    return 0;
}

const _isMain = import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? '')).href;
if (_isMain) {
    void main().then((rc) => {
        process.exitCode = rc;
    });
}
