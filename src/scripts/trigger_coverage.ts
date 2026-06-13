#!/usr/bin/env tsx
/**
 * Trigger-coverage suite (roadmap Phase 2.1 / 2.2).
 *
 * TypeScript twin of `src/scripts/trigger_coverage.py` (ADR-092, Phase 8 /
 * Wave 8b). Mirrors the CLI contract EXACTLY — the `--json` flag, exit codes
 * (0 pass / 1 miss / 2 missing-router-or-PyYAML), the stdout/stderr split,
 * byte-identical human + JSON report.
 *
 * The deterministic *must-load* floor for the lean-initial-context migration.
 * Before any auto-tier rule body is demoted to a router-resolved pointer
 * (Phase 3), this suite proves the router still fires that rule on
 * representative task phrasings — so a needed rule can never silently fail
 * to surface.
 *
 * Cases live in `tests/eval/trigger-coverage.yaml`. Matching is deterministic
 * against `dist/router.json`:
 *
 * - kernel rules always fire (always-on layer).
 * - a tier rule fires iff any of its triggers matches the prompt:
 *   - `keyword` → case-insensitive substring.
 *   - `intent`  → every alpha word (len>2) of the intent phrase appears as a
 *     token in the prompt.
 *
 * A case fails when an expected rule is NOT in the fired set. Exit 1 on any
 * miss → the merge that would have shrunk the rule is blocked (2.2).
 *
 * No behaviour changes — latent Python quirks replicated.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

const _HERE = fileURLToPath(import.meta.url);

// src/scripts/trigger_coverage.ts → parents[2] of the .py file is repo root.
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const ROUTER = path.join(REPO_ROOT, 'dist', 'router.json');
export const CORPUS = path.join(REPO_ROOT, 'tests', 'eval', 'trigger-coverage.yaml');

// _WORD = re.compile(r"[a-z][a-z0-9_]+")  — matched against text.lower().
const _WORD = /[a-z][a-z0-9_]+/g;

type Router = {
    kernel?: string[];
    tier_1?: Array<{ id: string; triggers?: Array<Record<string, string>> }>;
    tier_2?: Array<{ id: string; triggers?: Array<Record<string, string>> }>;
    [k: string]: unknown;
};

interface Case {
    id: string;
    prompt: string;
    expect?: string[];
}

interface CaseResult {
    id: string;
    ok: boolean;
    missing: string[];
    expect: string[];
}

function _tokens(text: string): Set<string> {
    const out = new Set<string>();
    const low = text.toLowerCase();
    _WORD.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = _WORD.exec(low)) !== null) {
        const w = m[0];
        if (w.length > 2) {
            out.add(w);
        }
    }
    return out;
}

function _isSubset(small: Set<string>, big: Set<string>): boolean {
    for (const v of small) {
        if (!big.has(v)) {
            return false;
        }
    }
    return true;
}

export function load_router(): Router {
    return JSON.parse(fs.readFileSync(ROUTER, 'utf-8')) as Router;
}

export function fired_rules(prompt: string, router: Router): Set<string> {
    const low = prompt.toLowerCase();
    const toks = _tokens(prompt);
    const fired = new Set<string>(router.kernel ?? []);
    for (const tier of ['tier_1', 'tier_2'] as const) {
        for (const entry of router[tier] ?? []) {
            for (const trig of entry.triggers ?? []) {
                if ('keyword' in trig) {
                    if (low.includes((trig['keyword'] as string).toLowerCase())) {
                        fired.add(entry.id);
                        break;
                    }
                } else if ('intent' in trig) {
                    const words = _tokens(trig['intent'] as string);
                    if (words.size > 0 && _isSubset(words, toks)) {
                        fired.add(entry.id);
                        break;
                    }
                }
            }
        }
    }
    return fired;
}

export function run(corpus: Case[], router: Router): [CaseResult[], number] {
    const results: CaseResult[] = [];
    let misses = 0;
    for (const c of corpus) {
        const fired = fired_rules(c.prompt, router);
        const expected = c.expect ?? [];
        const missing = expected.filter((r) => !fired.has(r));
        const ok = missing.length === 0;
        if (!ok) {
            misses += 1;
        }
        results.push({ id: c.id, ok, missing, expect: expected });
    }
    return [results, misses];
}

// --- json.dumps(indent=2, sort_keys=True) replica (ensure_ascii default) -----

function _jsonDumps(obj: unknown): string {
    const pad = '  ';
    const enc = (value: unknown, depth: number): string => {
        if (value === null || value === undefined) return 'null';
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'number') return String(value);
        if (typeof value === 'string') return encStr(value);
        if (Array.isArray(value)) {
            if (value.length === 0) return '[]';
            const inner = value.map((v) => pad.repeat(depth + 1) + enc(v, depth + 1));
            return '[\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + ']';
        }
        const o = value as Record<string, unknown>;
        const keys = Object.keys(o).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        if (keys.length === 0) return '{}';
        const inner = keys.map(
            (k) => pad.repeat(depth + 1) + encStr(k) + ': ' + enc(o[k], depth + 1),
        );
        return '{\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + '}';
    };
    const encStr = (s: string): string => {
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
                const v = cp - 0x10000;
                const hi = 0xd800 + (v >> 10);
                const lo = 0xdc00 + (v & 0x3ff);
                out += '\\u' + hi.toString(16).padStart(4, '0');
                out += '\\u' + lo.toString(16).padStart(4, '0');
            } else {
                out += '\\u' + cp.toString(16).padStart(4, '0');
            }
        }
        return out + '"';
    };
    return enc(obj, 0);
}

interface ParsedArgs {
    json: boolean;
}

function parse_args(argv: string[]): ParsedArgs {
    const out: ParsedArgs = { json: false };
    for (const a of argv) {
        if (a === '--json') {
            out.json = true;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write('usage: trigger_coverage [-h] [--json]\n');
            process.exit(0);
        }
    }
    return out;
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    let isFile = false;
    try {
        isFile = fs.statSync(ROUTER).isFile();
    } catch {
        isFile = false;
    }
    if (!isFile) {
        process.stderr.write(`error: ${ROUTER} missing — run compile_router first\n`);
        return 2;
    }
    const loaded = parseYaml(fs.readFileSync(CORPUS, 'utf-8'), { version: '1.1' }) as
        | Case[]
        | null;
    const corpus: Case[] = loaded ?? [];
    const router = load_router();
    const [results, misses] = run(corpus, router);

    if (args.json) {
        process.stdout.write(
            _jsonDumps({ cases: results.length, misses, results }) + '\n',
        );
    } else {
        for (const r of results) {
            const mark = r.ok ? '✅' : '❌';
            const detail = r.ok ? '' : `  MISSING: ${r.missing.join(', ')}`;
            process.stdout.write(`  ${mark}  ${r.id}${detail}\n`);
        }
        process.stdout.write('\n');
        if (misses) {
            process.stdout.write(
                `❌  trigger-coverage: ${misses}/${results.length} case(s) failed — ` +
                    'a required rule does not fire. Blocking.\n',
            );
        } else {
            process.stdout.write(
                `✅  trigger-coverage: ${results.length}/${results.length} pass\n`,
            );
        }
    }
    return misses ? 1 : 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}
