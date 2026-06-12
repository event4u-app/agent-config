#!/usr/bin/env node
/**
 * Phase 4.2 — Probe per-tool projection fidelity against the fixture.
 *
 * TypeScript twin of `src/scripts/probe_projection_fidelity.py` (ADR-090 —
 * Python→TS migration, Phase 8 / Wave 8c). Mirrors the CLI contract
 * EXACTLY: flags (`--fixture`, `--report`), exit codes (0 when no fail, 1
 * when any check fails, 2 when the YAML dependency is missing — replicated
 * via a try/catch import), byte-identical stdout, and the byte-identical
 * written report (`json.dumps(report, indent=2) + "\n"`). No behaviour
 * changes — latent quirks replicated.
 *
 * Reads tests/fixtures/projection_fidelity/fixtures.yml, walks the
 * projected trees (.augment/, .claude/, .cursor/, .clinerules/,
 * .windsurfrules, .windsurf/), and records pass/fail/partial per check.
 *
 * Output: agents/runtime/reports/projection-fidelity.json + stdout summary.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Mirror the .py `try: import yaml / except ImportError: exit(2)` guard.
// The `yaml` package is a project dependency; if it is somehow absent the
// dynamic import below throws and we exit 2 with the same stderr line.
type ParseYaml = (src: string, opts?: { version?: '1.1' | '1.2' }) => unknown;
let parseYaml: ParseYaml | null = null;
try {
    const mod = (await import('yaml')) as unknown as { parse: ParseYaml };
    parseYaml = mod.parse;
} catch {
    process.stderr.write('❌  PyYAML required (already a project dep)\n');
    process.exitCode = 2;
}

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/probe_projection_fidelity.ts → parents[2] is the repo root.
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

const TREES: Record<string, string> = {
    augment: path.join(ROOT, '.augment'),
    claude: path.join(ROOT, '.claude'),
    cursor_mdc: path.join(ROOT, '.cursor', 'rules'),
    cursor_commands: path.join(ROOT, '.cursor', 'commands'),
    cline: path.join(ROOT, '.clinerules'),
    windsurf: path.join(ROOT, '.windsurfrules'),
    windsurf_workflows: path.join(ROOT, '.windsurf', 'workflows'),
};

type FmDict = Record<string, unknown>;

function _safeLoad(text: string): unknown {
    if (parseYaml === null) {
        return null;
    }
    try {
        return parseYaml(text, { version: '1.1' });
    } catch {
        return null;
    }
}

function parse_frontmatter(p: string): [FmDict, string] {
    if (!fs.existsSync(p)) {
        return [{}, ''];
    }
    const text = fs.readFileSync(p, 'utf-8');
    if (!text.startsWith('---')) {
        return [{}, text];
    }
    // Python: text.split("---", 2) — first 2 occurrences → ≤3 parts.
    const parts = _splitMax(text, '---', 2);
    if (parts.length < 3) {
        return [{}, text];
    }
    let fm: unknown;
    try {
        fm = _safeLoad(parts[1]!) ?? {};
    } catch {
        fm = {};
    }
    const fmDict = _isPlainObject(fm) ? (fm as FmDict) : {};
    return [fmDict, parts[2]!];
}

/** Locate the projected artefact in a given tree. */
function locate(tree_key: string, entry_type: string, src: string): string | null {
    const name = _stem(src); // 'laravel-routing'
    if (entry_type === 'rule') {
        if (tree_key === 'augment' || tree_key === 'claude') {
            const p = path.join(TREES[tree_key]!, 'rules', path.basename(src));
            return fs.existsSync(p) ? p : null;
        }
        if (tree_key === 'cursor_mdc') {
            const p = path.join(TREES[tree_key]!, `${name}.mdc`);
            return fs.existsSync(p) ? p : null;
        }
        if (tree_key === 'cline') {
            const p = path.join(TREES[tree_key]!, `${name}.md`);
            return fs.existsSync(p) ? p : null;
        }
        if (tree_key === 'windsurf') {
            return fs.existsSync(TREES[tree_key]!) ? TREES[tree_key]! : null;
        }
    }
    if (entry_type === 'skill') {
        if (tree_key === 'augment' || tree_key === 'claude') {
            const p = path.join(TREES[tree_key]!, 'skills', path.basename(path.dirname(src)), 'SKILL.md');
            return fs.existsSync(p) ? p : null;
        }
    }
    if (entry_type === 'command') {
        if (tree_key === 'augment') {
            const p = path.join(TREES[tree_key]!, 'commands', path.basename(src));
            return fs.existsSync(p) ? p : null;
        }
        if (tree_key === 'claude') {
            const p = path.join(TREES[tree_key]!, 'skills', name, 'SKILL.md');
            return fs.existsSync(p) ? p : null;
        }
        if (tree_key === 'cursor_commands') {
            const p = path.join(TREES[tree_key]!, `${name}.md`);
            return fs.existsSync(p) ? p : null;
        }
        if (tree_key === 'windsurf_workflows') {
            const p = path.join(TREES[tree_key]!, `${name}.md`);
            return fs.existsSync(p) ? p : null;
        }
    }
    return null;
}

interface CheckResult {
    status: string;
    details: string[];
}

interface EntryResult {
    id: string;
    type: string;
    tier: unknown;
    results: Record<string, CheckResult>;
}

function check_entry(entry: Record<string, unknown>): EntryResult {
    const out: EntryResult = {
        id: entry['id'] as string,
        type: entry['type'] as string,
        tier: 'tier' in entry ? entry['tier'] : null,
        results: {},
    };
    const checks = (entry['checks'] ?? {}) as Record<string, Record<string, unknown>>;
    for (const [tool, spec] of Object.entries(checks)) {
        const result: CheckResult = { status: 'pass', details: [] };
        const expect_present = 'present' in spec ? Boolean(spec['present']) : true;
        const pathLocated = locate(tool, out.type, entry['source'] as string);

        if (tool === 'windsurf' && spec['concatenated_in']) {
            const fp = path.join(ROOT, spec['concatenated_in'] as string);
            if (!fs.existsSync(fp)) {
                result.status = 'fail';
                result.details.push(`missing concat file ${spec['concatenated_in']}`);
            } else {
                const body = fs.readFileSync(fp, 'utf-8');
                const needle = spec['body_contains'] as string | undefined;
                if (needle && !body.includes(needle)) {
                    result.status = 'fail';
                    result.details.push(`body missing '${needle}'`);
                }
                if (spec['routes_to_visible'] === false && body.includes('routes_to')) {
                    result.details.push('note: routes_to leaks into concat (info)');
                }
            }
            out.results[tool] = result;
            continue;
        }

        if (expect_present && pathLocated === null) {
            result.status = 'fail';
            result.details.push('file not found');
            out.results[tool] = result;
            continue;
        }
        if (!expect_present) {
            if (pathLocated !== null) {
                result.status = 'fail';
                result.details.push(`unexpected file at ${pathLocated}`);
            } else {
                result.details.push(`absent (ok: ${spec['rationale'] ?? ''})`);
            }
            out.results[tool] = result;
            continue;
        }

        const [fm, body] = parse_frontmatter(pathLocated!);
        for (const key of (spec['frontmatter_keys'] as string[] | undefined) ?? []) {
            if (!(key in fm)) {
                result.status = 'fail';
                result.details.push(`frontmatter missing '${key}'`);
            }
        }
        for (const key of (spec['frontmatter_drops'] as string[] | undefined) ?? []) {
            if (key in fm) {
                result.status = 'fail';
                result.details.push(`frontmatter unexpectedly contains '${key}'`);
            }
        }
        if (
            spec['alwaysApply'] !== undefined &&
            spec['alwaysApply'] !== null &&
            fm['alwaysApply'] !== spec['alwaysApply']
        ) {
            result.status = 'partial';
            result.details.push(
                `alwaysApply=${_pyRepr(fm['alwaysApply'])} expected ${_pyRepr(spec['alwaysApply'])}`,
            );
        }
        const trig_kw = (spec['triggers_keyword_contains'] as string[] | undefined) ?? [];
        const trig_pp = (spec['triggers_path_prefix_contains'] as string[] | undefined) ?? [];
        if (trig_kw.length > 0 || trig_pp.length > 0) {
            const trigs = (fm['triggers'] as unknown[] | undefined) ?? [];
            const kws: unknown[] = [];
            const pps: unknown[] = [];
            for (const t of trigs) {
                if (_isPlainObject(t)) {
                    const td = t as Record<string, unknown>;
                    if (td['keyword']) {
                        kws.push(td['keyword']);
                    }
                    if (td['path_prefix']) {
                        pps.push(td['path_prefix']);
                    }
                }
            }
            for (const kw of trig_kw) {
                if (!kws.includes(kw)) {
                    result.status = 'fail';
                    result.details.push(`trigger keyword '${kw}' missing`);
                }
            }
            for (const pp of trig_pp) {
                if (!pps.includes(pp)) {
                    result.status = 'fail';
                    result.details.push(`trigger path_prefix '${pp}' missing`);
                }
            }
        }
        const routes = (spec['routes_to_contains'] as string[] | undefined) ?? [];
        if (routes.length > 0) {
            const rt = (fm['routes_to'] as unknown[] | undefined) ?? [];
            for (const r of routes) {
                if (!rt.includes(r)) {
                    result.status = 'fail';
                    result.details.push(`routes_to missing '${r}'`);
                }
            }
        }
        const body_needle = spec['body_contains'] as string | undefined;
        if (body_needle && !body.includes(body_needle)) {
            result.status = 'fail';
            result.details.push(`body missing '${body_needle}'`);
        }
        out.results[tool] = result;
    }
    return out;
}

interface Args {
    fixture: string;
    report: string;
}

class ArgError extends Error {}

function parse_args(argv: string[]): Args {
    const args: Args = {
        fixture: 'tests/fixtures/projection_fidelity/fixtures.yml',
        report: 'agents/runtime/reports/projection-fidelity.json',
    };
    let i = 0;
    while (i < argv.length) {
        const raw = argv[i]!;
        let flag = raw;
        let inline: string | null = null;
        const eq = raw.indexOf('=');
        if (raw.startsWith('--') && eq !== -1) {
            flag = raw.slice(0, eq);
            inline = raw.slice(eq + 1);
        }
        const takeValue = (): string => {
            if (inline !== null) {
                return inline;
            }
            i += 1;
            if (i >= argv.length) {
                throw new ArgError(`argument ${flag}: expected one argument`);
            }
            return argv[i]!;
        };
        if (flag === '--fixture') {
            args.fixture = takeValue();
        } else if (flag === '--report') {
            args.report = takeValue();
        } else {
            throw new ArgError(`unrecognized arguments: ${raw}`);
        }
        i += 1;
    }
    return args;
}

export function main(argv: string[] | null = null): number {
    if (parseYaml === null) {
        // Import guard already set exitCode = 2 and printed.
        return 2;
    }
    const rawArgv = argv ?? process.argv.slice(2);
    let args: Args;
    try {
        args = parse_args(rawArgv);
    } catch (e) {
        if (e instanceof ArgError) {
            process.stderr.write(`probe_projection_fidelity: error: ${e.message}\n`);
            return 2;
        }
        throw e;
    }

    const fixtureText = fs.readFileSync(path.join(ROOT, args.fixture), 'utf-8');
    const fixture = (_safeLoad(fixtureText) ?? {}) as Record<string, unknown>;
    const entries = (fixture['entries'] as Record<string, unknown>[] | undefined) ?? [];
    const results = entries.map((e) => check_entry(e));

    const summary: Record<string, number> = { pass: 0, partial: 0, fail: 0 };
    for (const e of results) {
        for (const r of Object.values(e.results)) {
            summary[r.status] = (summary[r.status] ?? 0) + 1;
        }
    }

    const report = { summary, entries: results };
    const out = path.join(ROOT, args.report);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, _jsonDumpsIndent2(report as unknown as Json) + '\n', 'utf-8');

    process.stdout.write(`✅  Wrote ${args.report}\n`);
    process.stdout.write(`   pass=${summary['pass']} partial=${summary['partial']} fail=${summary['fail']}\n`);
    for (const e of results) {
        for (const [tool, r] of Object.entries(e.results)) {
            if (r.status !== 'pass') {
                process.stdout.write(
                    `   ${_ljust(r.status, 7)} ${_ljust(e.id, 40)} ${_ljust(tool, 18)} ${r.details.join('; ')}\n`,
                );
            }
        }
    }
    return summary['fail'] === 0 ? 0 : 1;
}

// --- helpers -----------------------------------------------------------------

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function _jsonDumpsIndent2(obj: Json): string {
    const pad = '  ';
    function enc(value: Json, depth: number): string {
        if (value === null || value === undefined) return 'null';
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'number') return String(value);
        if (typeof value === 'string') return encStr(value);
        if (Array.isArray(value)) {
            if (value.length === 0) return '[]';
            const inner = value.map((v) => pad.repeat(depth + 1) + enc(v, depth + 1));
            return '[\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + ']';
        }
        const o = value as { [k: string]: Json };
        const keys = Object.keys(o);
        if (keys.length === 0) return '{}';
        const inner = keys.map((k) => pad.repeat(depth + 1) + encStr(k) + ': ' + enc(o[k]!, depth + 1));
        return '{\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + '}';
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
    }
    return enc(obj, 0);
}

/** Mirror Python repr() for a value (used by `f"{x!r}"`). */
function _pyRepr(v: unknown): string {
    if (v === null || v === undefined) return 'None';
    if (typeof v === 'boolean') return v ? 'True' : 'False';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'string') {
        const hasSingle = v.includes("'");
        const hasDouble = v.includes('"');
        const quote = hasSingle && !hasDouble ? '"' : "'";
        let out = quote;
        for (const ch of v) {
            const cp = ch.codePointAt(0) as number;
            if (ch === '\\') out += '\\\\';
            else if (ch === quote) out += '\\' + quote;
            else if (ch === '\n') out += '\\n';
            else if (ch === '\r') out += '\\r';
            else if (ch === '\t') out += '\\t';
            else if (cp < 0x20 || cp === 0x7f) out += '\\x' + cp.toString(16).padStart(2, '0');
            else out += ch;
        }
        return out + quote;
    }
    return String(v);
}

function _isPlainObject(v: unknown): boolean {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function _stem(p: string): string {
    const base = path.basename(p);
    const dot = base.lastIndexOf('.');
    return dot > 0 ? base.slice(0, dot) : base;
}

function _ljust(s: string, width: number): string {
    const len = Array.from(s).length;
    return len >= width ? s : s + ' '.repeat(width - len);
}

function _splitMax(s: string, sep: string, maxsplit: number): string[] {
    const parts: string[] = [];
    let rest = s;
    let count = 0;
    while (count < maxsplit) {
        const idx = rest.indexOf(sep);
        if (idx === -1) break;
        parts.push(rest.slice(0, idx));
        rest = rest.slice(idx + sep.length);
        count += 1;
    }
    parts.push(rest);
    return parts;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    process.exitCode = main();
}
