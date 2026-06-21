#!/usr/bin/env tsx
/**
 * `agent-config explain` — print the decision chain behind an outcome
 * (TypeScript twin).
 *
 * TypeScript twin of `src/scripts/_cli/cmd_explain.py` (ADR-200, py2ts
 * migration). The CLI contract mirrors the Python original EXACTLY — same
 * flags, same exit codes, same stdout/stderr split, byte-identical emitted
 * output. No behaviour changes — latent quirks are replicated, not fixed.
 *
 * Step-15 Phase 1 item 3. Answers the silent "why did the agent do that?"
 * question. Read-only; never edits state, never dispatches network calls. Four
 * subjects in the surface: `config`, `rule <name>`, `route <text>`, `last`.
 *
 * Exit codes: `0` clean, `1` not found / no match, `2` invocation error (bad
 * project root, malformed `router.json`).
 *
 * --- Parity notes (ADR-200) ---
 *
 * - `main()` returns an exit code; the CLI entry guard sets `process.exitCode`
 *   (never `process.exit()`). Python's `raise SystemExit(main())` propagates
 *   the int. The `_resolve_root` helper raises a `SystemExitError(2)` sentinel
 *   on a bad project root (Python `raise SystemExit(2)`); it is caught at the
 *   CLI entry and at `main`'s own boundary so the exit code surfaces.
 * - argparse usage errors (bad `subject` choice, unknown flags, missing
 *   `--project` / `--state-file` argument) print usage + `error:` to stderr and
 *   throw `ArgparseExit(2)`. `-h`/`--help` prints the (terminal-wrapped) usage
 *   to stdout and throws `ArgparseExit(0)`. The full argparse `--help` BODY is
 *   a documented divergence; golden tests assert the `usage:` token + exit
 *   code, NOT the body — EXCEPT `explain last -h/--help`, which the Python
 *   intercepts BEFORE argparse and prints the verbatim `_LAST_HELP` block
 *   (returning 0, not raising). That interception is replicated byte-for-byte.
 * - JSON byte-parity: every JSON path uses `json.dump(payload, sys.stdout,
 *   indent=2, sort_keys=True)` + `"\n"`. `_jsonDumpsIndentSortedAscii` mirrors
 *   that — ensure_ascii=True (non-ASCII → `\uXXXX`), keys recursively sorted,
 *   2-space indent, then a trailing newline written separately.
 * - `scripts.config.{profiles,presets}` / `scripts._lib.agent_settings` /
 *   `scripts._cli.explain_last.*` imports resolve to the `.ts` twins. The
 *   Python lazy `from scripts._cli.explain_last import build_trace` (inside
 *   `_explain_last`) is an eager static import here; the import-resolution
 *   timing has no observable effect.
 * - `StateLoadError.exit_code` (Python) → `StateLoadError.exitCode` (the twin
 *   names it camelCase); the `_explain_last` error arm reads `.exitCode`.
 * - `dict.get(...) if isinstance(..., dict) else {}` truthiness/type guards are
 *   replicated with explicit object checks. `os.environ.get(...)` → an env read
 *   that yields `null` (Python `None`) when unset, so the JSON env block
 *   renders `null` byte-identically.
 * - `Path.read_text` / `.exists()` / `.relative_to()` parity via `fs` +
 *   `path`; the `relative_to` `ValueError` fallback (`Path(target.name)`) is
 *   preserved so an absolute state path never leaks into an error line.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    DEFAULT_PROJECT_FILE,
    ProjectRootError,
    load_agent_settings,
    resolve_project_root,
} from '../_lib/agent_settings.js';
import * as presets from '../config/presets.js';
import * as profiles from '../config/profiles.js';
import { build_trace } from './explain_last/index.js';
import { render as render_md } from './explain_last/render.js';
import { StateLoadError } from './explain_last/state_loader.js';

type Dict = Record<string, unknown>;

const ROUTER_FILENAME = 'router.json';
const ROUTER_RELATIVE = path.join('dist', ROUTER_FILENAME);

// ---------------------------------------------------------------------------
// Parity primitives (ADR-200).
// ---------------------------------------------------------------------------

const _HERE = fileURLToPath(import.meta.url);

/** argparse usage-error / help exit (code 2 / 0). Caught at the CLI entry. */
class ArgparseExit extends Error {
    constructor(public readonly code: number) {
        super(`argparse-exit-${code}`);
    }
}

/** Python `raise SystemExit(code)` — propagates an explicit exit code. */
class SystemExitError extends Error {
    constructor(public readonly code: number) {
        super(`system-exit-${code}`);
    }
}

/** `print(...)` — line to stdout. */
function print(line = ''): void {
    process.stdout.write(line + '\n');
}

/** `print(..., file=sys.stderr)`. */
function eprint(line = ''): void {
    process.stderr.write(line + '\n');
}

// --- JSON byte-parity (ensure_ascii=True; sort_keys=True; indent=2) ---

function _jsonStrAscii(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        switch (ch) {
            case '"':
                out += '\\"';
                break;
            case '\\':
                out += '\\\\';
                break;
            case '\n':
                out += '\\n';
                break;
            case '\r':
                out += '\\r';
                break;
            case '\t':
                out += '\\t';
                break;
            case '\b':
                out += '\\b';
                break;
            case '\f':
                out += '\\f';
                break;
            default:
                if (code < 0x20) {
                    out += '\\u' + code.toString(16).padStart(4, '0');
                } else if (code < 0x7f) {
                    out += ch;
                } else if (code <= 0xffff) {
                    out += '\\u' + code.toString(16).padStart(4, '0');
                } else {
                    const v = code - 0x10000;
                    const hi = 0xd800 + (v >> 10);
                    const lo = 0xdc00 + (v & 0x3ff);
                    out +=
                        '\\u' +
                        hi.toString(16).padStart(4, '0') +
                        '\\u' +
                        lo.toString(16).padStart(4, '0');
                }
        }
    }
    return out + '"';
}

function _jsonScalarAscii(value: unknown): string | null {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            if (Number.isNaN(value)) return 'NaN';
            return value > 0 ? 'Infinity' : '-Infinity';
        }
        return String(value);
    }
    if (typeof value === 'string') return _jsonStrAscii(value);
    return null;
}

function _dumpSortedAscii(value: unknown, indent: number, depth: number): string {
    const scalar = _jsonScalarAscii(value);
    if (scalar !== null) return scalar;
    const pad = ' '.repeat(indent * (depth + 1));
    const closePad = ' '.repeat(indent * depth);
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        const items = value.map((v) => pad + _dumpSortedAscii(v, indent, depth + 1));
        return `[\n${items.join(',\n')}\n${closePad}]`;
    }
    if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj).sort(); // sort_keys=True
        if (keys.length === 0) return '{}';
        const items = keys.map(
            (k) => `${pad}${_jsonStrAscii(k)}: ${_dumpSortedAscii(obj[k], indent, depth + 1)}`,
        );
        return `{\n${items.join(',\n')}\n${closePad}}`;
    }
    return _jsonStrAscii(String(value));
}

/** `json.dumps(data, indent=2, sort_keys=True)` (ensure_ascii=True). */
function _jsonDumpsIndentSortedAscii(value: unknown): string {
    return _dumpSortedAscii(value, 2, 0);
}

/** `json.dump(payload, sys.stdout, indent=2, sort_keys=True)` + `"\n"`. */
function _dumpJson(payload: unknown): void {
    process.stdout.write(_jsonDumpsIndentSortedAscii(payload));
    process.stdout.write('\n');
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/** Python `repr(text)` for an `{text!r}` interpolation (string scalar). */
function pyReprStr(value: string): string {
    if (value.includes("'") && !value.includes('"')) {
        return `"${value}"`;
    }
    const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `'${escaped}'`;
}

// ---------------------------------------------------------------------------
// Module body (cmd_explain.py).
// ---------------------------------------------------------------------------

function _resolve_root(arg: string | null): [string, string] {
    try {
        return resolve_project_root(arg, { cwd: process.cwd() });
    } catch (exc) {
        if (exc instanceof ProjectRootError) {
            eprint(`❌  explain: ${exc.message}`);
            throw new SystemExitError(2);
        }
        throw exc;
    }
}

function _load_user_settings(project_root: string): Dict {
    const p = path.join(project_root, DEFAULT_PROJECT_FILE);
    if (!_exists(p)) {
        return {};
    }
    return (load_agent_settings({ project_path: p }) as Dict) || {};
}

function _load_router(project_root: string): Dict {
    const p = path.join(project_root, ROUTER_RELATIVE);
    if (!_exists(p)) {
        return {};
    }
    try {
        return JSON.parse(fs.readFileSync(p, { encoding: 'utf-8' })) as Dict;
    } catch (exc) {
        eprint(`❌  explain: cannot read ${p}: ${osErrorStr(exc)}`);
        throw new SystemExitError(2);
    }
}

/** Render an OSError/JSONDecodeError-equivalent like Python's `str(exc)`. */
function osErrorStr(exc: unknown): string {
    if (exc instanceof Error) {
        return exc.message;
    }
    return String(exc);
}

function _explain_config(project_root: string, as_json: boolean): number {
    const settings = _load_user_settings(project_root);
    const resolved_profile = profiles.resolve_profile({
        project_root,
        user_settings: settings,
    });
    const resolved_preset = presets.resolve_preset({
        project_root,
        user_settings: settings,
        profile_preset_id: resolved_profile.preset_id,
    });
    const payload: Dict = {
        project_root: String(project_root),
        profile: {
            id: resolved_profile.id,
            source: resolved_profile.source,
            preset_id: resolved_profile.preset_id,
            warning: resolved_profile.warning,
        },
        preset: {
            id: resolved_preset.id,
            source: resolved_preset.source,
            overrides: [...resolved_preset.overrides],
            knobs: resolved_preset.knobs,
        },
        env: {
            [profiles.PROFILE_ID_ENV]: process.env[profiles.PROFILE_ID_ENV] ?? null,
            [presets.PRESET_ID_ENV]: process.env[presets.PRESET_ID_ENV] ?? null,
        },
    };
    if (as_json) {
        _dumpJson(payload);
        return 0;
    }
    print(`  📍  project_root: ${project_root}`);
    print();
    print(`  profile.id:   ${resolved_profile.id}  (source: ${resolved_profile.source})`);
    if (resolved_profile.warning) {
        print(`  ⚠️   ${resolved_profile.warning}`);
    }
    print(`  preset.id:    ${resolved_preset.id}  (source: ${resolved_preset.source})`);
    if (resolved_preset.overrides.length > 0) {
        print(`  overrides:    ${resolved_preset.overrides.join(', ')}`);
    }
    const knobs = resolved_preset.knobs as Dict;
    const cost = isPlainObject(knobs['cost']) ? (knobs['cost'] as Dict) : {};
    if (Object.keys(cost).length > 0) {
        print(
            `  cost caps:    daily $${fmt(cost['daily_max_usd'])} · ` +
                `weekly $${fmt(cost['weekly_max_usd'])} · ` +
                `monthly $${fmt(cost['monthly_max_usd'])}`,
        );
    }
    const autonomy = isPlainObject(knobs['autonomy']) ? (knobs['autonomy'] as Dict) : {};
    if (Object.keys(autonomy).length > 0) {
        print(`  autonomy:     default=${fmt(autonomy['default'])}`);
    }
    return 0;
}

/** Python `dict.get(k)` → value or None; renders as `str(value)` / `None`. */
function fmt(value: unknown): string {
    if (value === null || value === undefined) return 'None';
    if (typeof value === 'boolean') return value ? 'True' : 'False';
    return String(value);
}

function isPlainObject(value: unknown): value is Dict {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function _find_rule(router: Dict, name: string): [string, Dict] | null {
    const kernel = (router['kernel'] as unknown[] | undefined) || [];
    if (kernel.includes(name)) {
        return ['kernel', { id: name, triggers: [{ always: true }] }];
    }
    for (const tier of ['tier_1', 'tier_2']) {
        const entries = (router[tier] as Dict[] | undefined) || [];
        for (const entry of entries) {
            if (entry['id'] === name) {
                return [tier, entry];
            }
        }
    }
    return null;
}

function _explain_rule(project_root: string, name: string, as_json: boolean): number {
    const router = _load_router(project_root);
    const found = _find_rule(router, name);
    if (found === null) {
        eprint(`❌  explain: rule ${pyReprStr(name)} not found in router`);
        return 1;
    }
    const [tier, entry] = found;
    const payload: Dict = { rule: name, tier, entry };
    if (as_json) {
        _dumpJson(payload);
        return 0;
    }
    print(`  rule:    ${name}`);
    print(`  tier:    ${tier}`);
    const triggers = (entry['triggers'] as unknown[] | undefined) || [];
    print(`  triggers (${triggers.length}):`);
    for (const trig of triggers) {
        print(`    · ${pyStr(trig)}`);
    }
    const routes = (entry['routes_to'] as unknown[] | undefined) || [];
    if (routes.length > 0) {
        print(`  routes_to: ${(routes as string[]).join(', ')}`);
    }
    return 0;
}

/** Python `str(obj)` for a trigger dict (e.g. `{'keyword': 'x'}`). */
function pyStr(value: unknown): string {
    if (value === null || value === undefined) return 'None';
    if (typeof value === 'boolean') return value ? 'True' : 'False';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (Array.isArray(value)) {
        return '[' + value.map((v) => pyReprAny(v)).join(', ') + ']';
    }
    if (typeof value === 'object') {
        const obj = value as Dict;
        const parts = Object.keys(obj).map((k) => `${pyReprAny(k)}: ${pyReprAny(obj[k])}`);
        return '{' + parts.join(', ') + '}';
    }
    return String(value);
}

/** Python `repr()` for nested scalars inside a `str(dict)` rendering. */
function pyReprAny(value: unknown): string {
    if (value === null || value === undefined) return 'None';
    if (typeof value === 'boolean') return value ? 'True' : 'False';
    if (typeof value === 'string') return pyReprStr(value);
    if (typeof value === 'number') return String(value);
    if (Array.isArray(value)) {
        return '[' + value.map((v) => pyReprAny(v)).join(', ') + ']';
    }
    if (typeof value === 'object') {
        const obj = value as Dict;
        const parts = Object.keys(obj).map((k) => `${pyReprAny(k)}: ${pyReprAny(obj[k])}`);
        return '{' + parts.join(', ') + '}';
    }
    return String(value);
}

function _matches_trigger(trigger: Dict, text: string, lowered: string): string | null {
    if ('keyword' in trigger) {
        const kw = String(trigger['keyword']).toLowerCase();
        if (kw && lowered.includes(kw)) {
            return `keyword: ${kw}`;
        }
    }
    if ('phrase' in trigger) {
        const ph = String(trigger['phrase']).toLowerCase();
        if (ph && lowered.includes(ph)) {
            return `phrase: ${ph}`;
        }
    }
    if ('path_prefix' in trigger) {
        const prefix = String(trigger['path_prefix']);
        if (prefix && text.includes(prefix)) {
            return `path_prefix: ${prefix}`;
        }
    }
    return null;
}

function _explain_route(project_root: string, text: string, as_json: boolean): number {
    const router = _load_router(project_root);
    const lowered = text.toLowerCase();
    const matches: Dict[] = [];
    const tier_1 = (router['tier_1'] as Dict[] | undefined) || [];
    for (const entry of tier_1) {
        const triggers = (entry['triggers'] as Dict[] | undefined) || [];
        for (const trig of triggers) {
            const reason = _matches_trigger(trig, text, lowered);
            if (reason !== null) {
                matches.push({ id: entry['id'], tier: 'tier_1', reason });
                break;
            }
        }
    }
    const kernel_always = [...((router['kernel'] as unknown[] | undefined) || [])];
    const payload: Dict = {
        input: text,
        kernel_always,
        tier_1_matches: matches,
    };
    if (as_json) {
        _dumpJson(payload);
        return 0;
    }
    print(`  input: ${pyReprStr(text)}`);
    print();
    print(`  kernel (always active, ${kernel_always.length}):`);
    for (const kid of kernel_always) {
        print(`    · ${pyStr(kid)}`);
    }
    print();
    print(`  tier-1 matches (${matches.length}):`);
    if (matches.length === 0) {
        print('    · (no trigger matched — only kernel rules active)');
        return 1;
    }
    for (const match of matches) {
        print(`    · ${match['id']}  (${match['reason']})`);
    }
    return 0;
}

function _explain_last(
    project_root: string,
    state_file: string | null,
    as_json: boolean,
    quiet: boolean,
): number {
    const settings = _load_user_settings(project_root);
    const explain_raw = settings['explain'];
    const explain_cfg = isPlainObject(explain_raw) ? (explain_raw as Dict) : {};
    if (explain_cfg['enable_last'] === false) {
        print('explain last disabled by settings (explain.enable_last)');
        return 0;
    }
    const target_state = state_file || path.join(project_root, '.work-state.json');
    let trace: Dict;
    try {
        trace = build_trace(project_root, target_state) as Dict;
    } catch (exc) {
        if (exc instanceof StateLoadError) {
            // BLOCKING council fix — never print absolute paths in errors;
            // username leakage via /Users/<name>/... hits Slack / CI logs.
            let rel: string;
            const relativeTo = relativeToOrNull(target_state, project_root);
            if (relativeTo !== null) {
                rel = relativeTo;
            } else {
                rel = path.basename(target_state);
            }
            const msg = exc.message.split(target_state).join(rel);
            eprint(`❌  explain last: ${msg}`);
            return exc.exitCode;
        }
        throw exc;
    }
    if (as_json) {
        _dumpJson(trace);
        return 0;
    }
    process.stdout.write(render_md(trace, { with_footer: !quiet }));
    return 0;
}

/** `Path.relative_to(base)` — returns null on ValueError (not under base). */
function relativeToOrNull(p: string, base: string): string | null {
    const rel = path.relative(base, p);
    if (rel === '') return rel;
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
        return null;
    }
    return rel;
}

const _LAST_HELP = `\
usage: agent-config explain last [--project PATH] [--state-file PATH]
                                 [--json] [--quiet]

Reconstruct the execution trace for the most recent /work,
/implement-ticket, /council, or /video run. Read-only; never
makes network calls. Output is the ExplainTrace v1 contract:
  docs/contracts/explain-trace.schema.json

why-slots answered (Markdown sections; JSON keys in parens):

  inputs       — profile / preset / rule_loading_tier with per-knob source
                 (pack | profile | preset | user | env | runtime |
                  default)
  route        — matched tier-1 rules · kernel rules · active persona
                 (route)
  memory       — memory-MCP entries that influenced this run, with
                 hit-score + step-id (memory)
  council      — council members consulted with per-member verdict
                 (council)
  assumptions  — assumptions recorded during refine + per-halt
                 (assumptions)
  pack         — discovery-manifest pack selection rationale (pack)
  halt         — reason · step · surface for the most recent halt
                 (halt; Phase 3)
  provider     — /video provider selection rationale; omitted for
                 non-video runs (provider; Phase 3)

options:
  --project PATH       project root (defaults to anchor walk from cwd)
  --state-file PATH    .work-state.json path (default <root>/.work-state.json)
  --json               emit ExplainTrace JSON instead of Markdown
  --quiet              suppress the trailing tip footer

exit codes:
  0  trace rendered, or disabled by settings (explain.enable_last)
  1  no recent run found (state file missing or unreadable)
  2  invocation error (bad project root, bad --state-file path)
`;

interface Opts {
    subject: string;
    target: string | null;
    project: string | null;
    state_file: string | null;
    as_json: boolean;
    quiet: boolean;
}

const PROG = 'agent-config explain';
const SUBJECT_CHOICES = ['config', 'rule', 'route', 'last'] as const;

// Verbatim argparse usage block (captured from the .py at COLUMNS=80). The
// per-flag `--help` BODY is a documented divergence — golden tests assert the
// `usage:` token + exit code, not the body prose.
const USAGE =
    `usage: ${PROG} [-h] [--project PROJECT] [--state-file STATE_FILE]\n` +
    '                            [--json] [--quiet]\n' +
    '                            {config,rule,route,last} [target]\n';

function _argError(msg: string): never {
    process.stderr.write(USAGE);
    process.stderr.write(`${PROG}: error: ${msg}\n`);
    throw new ArgparseExit(2);
}

function _parse(argv: string[]): Opts {
    const opts: Opts = {
        subject: '',
        target: null,
        project: null,
        state_file: null,
        as_json: false,
        quiet: false,
    };
    const positionals: string[] = [];
    let i = 0;
    while (i < argv.length) {
        const a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(USAGE);
            throw new ArgparseExit(0);
        }
        const eq = a.startsWith('--') ? a.indexOf('=') : -1;
        const flag = eq >= 0 ? a.slice(0, eq) : a;
        const inlineVal = eq >= 0 ? a.slice(eq + 1) : null;
        if (flag === '--json') {
            if (inlineVal !== null) {
                _argError(`argument --json: ignored explicit argument '${inlineVal}'`);
            }
            opts.as_json = true;
            i += 1;
            continue;
        }
        if (flag === '--quiet') {
            if (inlineVal !== null) {
                _argError(`argument --quiet: ignored explicit argument '${inlineVal}'`);
            }
            opts.quiet = true;
            i += 1;
            continue;
        }
        if (flag === '--project' || flag === '--state-file') {
            const dest = flag === '--project' ? 'project' : 'state_file';
            let value: string;
            if (inlineVal !== null) {
                value = inlineVal;
            } else {
                if (i + 1 >= argv.length) {
                    _argError(`argument ${flag}: expected one argument`);
                }
                value = argv[i + 1] as string;
                i += 1;
            }
            opts[dest] = value;
            i += 1;
            continue;
        }
        if (a.startsWith('-') && a !== '-') {
            _argError(`unrecognized arguments: ${a}`);
        }
        positionals.push(a);
        i += 1;
    }
    // positional: subject (required, choices) then optional target.
    if (positionals.length === 0) {
        _argError('the following arguments are required: subject');
    }
    const subject = positionals[0] as string;
    if (!SUBJECT_CHOICES.includes(subject as (typeof SUBJECT_CHOICES)[number])) {
        _argError(
            `argument subject: invalid choice: '${subject}' ` +
                `(choose from ${SUBJECT_CHOICES.map((c) => `'${c}'`).join(', ')})`,
        );
    }
    opts.subject = subject;
    if (positionals.length >= 2) {
        opts.target = positionals[1] as string;
    }
    if (positionals.length > 2) {
        _argError(`unrecognized arguments: ${positionals.slice(2).join(' ')}`);
    }
    return opts;
}

export function main(argv: string[] | null = null): number {
    const argv_list = argv !== null ? Array.from(argv) : process.argv.slice(2);
    // `explain last -h/--help` is intercepted BEFORE argparse — prints the
    // verbatim long-form help and returns 0 (never raises).
    if (
        argv_list.slice(0, 1).length === 1 &&
        argv_list[0] === 'last' &&
        argv_list.slice(1).some((a) => a === '-h' || a === '--help')
    ) {
        process.stdout.write(_LAST_HELP);
        return 0;
    }
    const opts = _parse(argv_list);
    let project_root: string;
    try {
        [project_root] = _resolve_root(opts.project);
    } catch (exc) {
        if (exc instanceof SystemExitError) {
            return exc.code;
        }
        throw exc;
    }
    if (opts.subject === 'config') {
        return _explain_config(project_root, opts.as_json);
    }
    if (opts.subject === 'last') {
        const state_path = opts.state_file ? opts.state_file : null;
        return _explain_last(project_root, state_path, opts.as_json, opts.quiet);
    }
    if (opts.target === null) {
        eprint(`❌  explain: '${opts.subject}' requires a target argument`);
        return 2;
    }
    if (opts.subject === 'rule') {
        return _explain_rule(project_root, opts.target, opts.as_json);
    }
    return _explain_route(project_root, opts.target, opts.as_json);
}

// --- CLI entry ---

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    try {
        process.exitCode = main(process.argv.slice(2));
    } catch (e) {
        if (e instanceof ArgparseExit) {
            process.exitCode = e.code;
        } else if (e instanceof SystemExitError) {
            process.exitCode = e.code;
        } else {
            throw e;
        }
    }
}

export {
    _parse,
    _resolve_root,
    _load_user_settings,
    _load_router,
    _explain_config,
    _find_rule,
    _explain_rule,
    _matches_trigger,
    _explain_route,
    _explain_last,
    _LAST_HELP,
    ArgparseExit,
    SystemExitError,
};
export type { Opts };
