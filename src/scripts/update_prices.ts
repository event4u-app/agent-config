#!/usr/bin/env node
/**
 * Refresh `agents/runtime/.agent-prices.md` from the LiteLLM model-prices feed.
 *
 * Ported from the retired Python `src/scripts/update_prices.py` (ADR-200 — Python→TS
 * migration, Phase 8 / Wave 8g). The CLI contract is pinned —
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
 * changes — historical quirks preserved (consumers pin the exact behaviour).
 */
import * as fs from 'node:fs';
import * as https from 'node:https';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { DEFAULT_PRICES, as_rows } from './ai_council/_default_prices.js';
import { sanitize_text } from './_lib/retrieval_sanitize.js';
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
 * The only shape a remote identifier may have to be considered at all.
 *
 * Pure ASCII letters, digits and the punctuation real provider/model names use.
 * Every allow-list entry is ASCII, so nothing outside this can be a member —
 * and asserting it on the UNTOUCHED bytes is what makes the case fold below
 * safe, because within ASCII folding is lossless. A Unicode character that
 * folds onto an ASCII letter never reaches the comparison.
 */
const _CANONICAL_ID = /^[A-Za-z0-9._-]+$/;

/** ASCII-only case fold — never `toLowerCase`, which folds Unicode too. */
function _asciiLower(s: string): string {
    return s.replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32));
}

/**
 * Report a rejected identifier that WOULD have matched after transformation.
 *
 * A raw miss whose normalised form hits the allow list is a different event
 * from an ordinary unlisted name, and printing both as the same silence is what
 * would hide an admission attempt. Ordinary misses stay silent — the fetched
 * catalogue carries hundreds of models nobody here lists.
 */
function _reportCollision(rawProvider: string, rawModel: string): void {
    const normalised = `${sanitize_text(rawProvider).toLowerCase()} ${sanitize_text(rawModel)}`;
    if (!ALLOW_LIST.has(normalised)) return;
    process.stderr.write(
        'update_prices: DROPPED a remote row whose raw identifier is not allow-listed ' +
            `but normalises onto \`${normalised}\`. A fetched name that folds or sanitizes ` +
            'onto a listed one is an admission attempt, not a typo.\n',
    );
}

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
        // Sanitize BEFORE the allow-list compare, not after. These two strings
        // come off the wire and end up in a tracked markdown file that agents
        // read, so they are the model-facing copy this floor exists for. Doing
        // it before the compare is also the only order that works: a vector
        // inside a model name would otherwise fail the allow-list lookup and
        // drop the row, turning an injection attempt into a silent data loss.
        // The fetched payload itself is never written anywhere — only this
        // rendering is transformed.
        const rawProvider = String((entry.litellm_provider as Json) ?? '');
        // LiteLLM keys are sometimes "provider/model"; strip the prefix.
        const slash = key.indexOf('/');
        const rawModel = slash !== -1 ? key.slice(slash + 1) : key;

        // THE ADMISSION BOUNDARY: a canonical ASCII grammar first, then a
        // comparison on values nothing has transformed.
        //
        // Two earlier orders were both wrong and the second is the instructive
        // one. The first sanitized before comparing, so a poisoned name could
        // normalise onto a listed one and be admitted as it. The fix compared
        // "raw" values — but `.toLowerCase()` ran before the compare, and THAT
        // IS ITSELF A LOSSY UNICODE TRANSFORM: the Kelvin sign and the Turkish
        // dotted capital both fold onto ASCII letters, so the provider field
        // still carried the collision the model field no longer did. An
        // independent review named it and was right; closing one field and
        // calling the class closed is the failure mode, not the typo.
        //
        // So the grammar is asserted on the UNTOUCHED bytes. Pure ASCII, with
        // the punctuation real identifiers use. Nothing outside it can be an
        // allow-list member, because every entry is ASCII — and within ASCII,
        // case folding is lossless, which is what makes the fold below safe to
        // apply after the gate rather than before it.
        if (!_CANONICAL_ID.test(rawProvider) || !_CANONICAL_ID.test(rawModel)) {
            _reportCollision(rawProvider, rawModel);
            continue;
        }
        const provider = _asciiLower(rawProvider);
        if (!ALLOW_LIST.has(`${provider} ${rawModel}`)) {
            _reportCollision(rawProvider, rawModel);
            continue;
        }

        // Only now, and only for the rendering: the row reaches a tracked
        // markdown file that agents read, so the model-facing copy carries the
        // floor. The fetched payload itself is never written anywhere. Both
        // values are already canonical ASCII here, so this is a no-op in
        // practice and a belt on the rendering in principle.
        const model = sanitize_text(rawModel);
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
        process.stdout.write(`[update_prices] ${p} missing — run \`./scripts-run src/scripts/update_prices\`\n`);
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

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

const _isMain = _isCliEntry();
if (_isMain) {
    void main().then((rc) => {
        process.exitCode = rc;
    });
}
