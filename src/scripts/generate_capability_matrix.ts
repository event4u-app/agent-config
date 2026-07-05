#!/usr/bin/env tsx
/**
 * Generate the cross-host capability matrix (road-to-competitive-borrow P1.3).
 *
 * TypeScript twin of `src/scripts/generate_capability_matrix.py` (ADR-200).
 * Mirrors the Python CLI contract EXACTLY — the `--check` / `--quiet` flags,
 * exit codes (0 / 1 / 2), stdout/stderr split, the byte-identical
 * `docs/capability-matrix.md` (heading prose, the host-header table, the glyph
 * cells, ARTIFACTS row order), and the byte-identical
 * `dist/discovery/capability-matrix.json` (`json.dumps(payload, indent=2,
 * sort_keys=True)` with `ensure_ascii=True` so the `†` cell escapes to
 * `†`, plus the sha256 checksum over the no-checksum body). No behaviour
 * changes — the derivation guard reads the live dispatcher source (mirroring
 * `inspect.getsource(_generate_tools_inner)`) and fails if a `generate_*` call
 * is missing from `_FN_SPEC`.
 *
 * "What artifact type works on which host" — derived from the live
 * `generate_tools()` projection logic in `condense.ts`, never hand-maintained.
 *
 * Derivation:
 *   - Reads the source of `_generate_tools_inner` from `condense.ts`; every
 *     `generate_*(...)` call in the dispatcher is the ground truth for which
 *     generator runs (mirrors the Python `inspect.getsource` derivation).
 *   - `_FN_SPEC` maps each generator to (artifact_type, host(s), mechanism).
 *   - **Coverage guard:** every `generate_*` call parsed from the dispatcher
 *     MUST appear in `_FN_SPEC`. A new generator added to `condense.ts` without
 *     a matching `_FN_SPEC` entry fails this script (and CI via `--check`) —
 *     that is the "never silently drift" guarantee.
 *
 * Cell vocabulary:
 *   - `native`   — the host consumes the artifact directly (symlink / native dir).
 *   - `adapter`  — projected through a host-specific transform (.mdc, workflow,
 *                  aggregated single file).
 *   - `none`     — no generator emits this artifact for this host.
 *
 * Output (deterministic — no timestamp, so `--check` is stable):
 *   - `docs/capability-matrix.md`            (human-readable)
 *   - `dist/discovery/capability-matrix.json` (machine-readable, per-host cells)
 *
 * Usage:
 *     ./scripts-run src/scripts/generate_capability_matrix
 *     ./scripts-run src/scripts/generate_capability_matrix --check   # fail if out of date
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

// src/scripts/generate_capability_matrix.ts → parents[2] is repo root.
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const OUT_MD = path.join(ROOT, 'docs', 'capability-matrix.md');
const OUT_JSON = path.join(ROOT, 'dist', 'discovery', 'capability-matrix.json');

// The dispatcher source that `parse_dispatcher_generators` reads — the live
// `_generate_tools_inner` body in the condense twin (ground truth).
const CONDENSE_SRC = path.join(ROOT, 'src', 'scripts', 'condense.ts');

// Canonical host order for presentation. Sourced from condense._ALL_TOOLS plus
// the committed Claude plugin marketplace (always projected, ADR-040).
const HOSTS = [
    'claude-code', 'claude-plugin', 'augment', 'cursor',
    'windsurf', 'cline', 'gemini', 'copilot', 'claude-desktop',
];

const ARTIFACTS = ['rules', 'skills', 'commands', 'subagents', 'personas', 'user-types', 'hooks'];

interface FnSpec {
    artifact: string;
    cells: Record<string, string>;
}

// Each condense.py dispatcher generator → what it emits, for which host(s),
// via which mechanism. Universal generators (symlink fan-out to every host
// that consumes the artifact) list all consuming hosts explicitly. This is the
// one place the host×artifact mechanism is asserted; the coverage guard below
// fails if condense grows a generator absent here.
const _FN_SPEC: Record<string, FnSpec> = {
    // universal symlink fan-outs
    generate_rule_symlinks: {
        artifact: 'rules',
        // .claude/rules, .cursor/rules (.mdc), .clinerules, .windsurfrules,
        // GEMINI.md — symlink dirs are native; transformed/aggregated are adapter.
        cells: {
            'claude-code': 'native', augment: 'native', cline: 'native',
            cursor: 'adapter', windsurf: 'adapter', gemini: 'adapter',
        },
    },
    generate_persona_symlinks: {
        artifact: 'personas',
        cells: { 'claude-code': 'native', cursor: 'native', augment: 'native' },
    },
    generate_user_type_symlinks: {
        artifact: 'user-types',
        cells: { 'claude-code': 'native', cursor: 'native', augment: 'native' },
    },
    // host-gated generators
    generate_windsurfrules: { artifact: 'rules', cells: { windsurf: 'adapter' } },
    generate_windsurf_modern_rules: { artifact: 'rules', cells: { windsurf: 'adapter' } },
    generate_windsurf_workflows: { artifact: 'commands', cells: { windsurf: 'adapter' } },
    generate_gemini_md: { artifact: 'rules', cells: { gemini: 'adapter' } },
    generate_claude_skills: {
        artifact: 'skills',
        cells: { 'claude-code': 'native', augment: 'native' },
    },
    generate_claude_commands: {
        artifact: 'commands',
        cells: { 'claude-code': 'native', augment: 'native' },
    },
    generate_claude_subagents: {
        artifact: 'subagents',
        cells: { 'claude-code': 'native' },
    },
    generate_subagent_host_contexts: {
        artifact: 'subagents',
        cells: { cursor: 'adapter', windsurf: 'adapter', cline: 'adapter' },
    },
    generate_plugin_command_skills: {
        artifact: 'skills', cells: { 'claude-plugin': 'native' },
    },
    generate_plugin_hooks: { artifact: 'hooks', cells: { 'claude-plugin': 'native' } },
    generate_cursor_mdc_rules: { artifact: 'rules', cells: { cursor: 'adapter' } },
    generate_cursor_commands: { artifact: 'commands', cells: { cursor: 'adapter' } },
};

// Surfaces the INSTALLER provides outside generate_tools() (so the derivation
// guard stays pure). Marked with a † footnote in the rendered matrix.
const _INSTALL_TIME_CELLS: Record<string, Record<string, string>> = {
    rules: { copilot: 'adapter' }, // .github/copilot-instructions.md (aggregated, install.py)
};

// Python: re.compile(r"\b(generate_[A-Za-z0-9_]+)\s*\(").
const _CALL_RE = /\b(generate_[A-Za-z0-9_]+)\s*\(/g;

/**
 * Extract the source of the `_generate_tools_inner` dispatcher from condense.
 * Mirrors `inspect.getsource(condense._generate_tools_inner)`: the function
 * body that lists every `generate_*` call. Reads the live `.ts` source so a
 * generator added to the dispatcher is seen here automatically.
 */
function _dispatcher_source(): string {
    const src = fs.readFileSync(CONDENSE_SRC, 'utf-8');
    const m = /function _generate_tools_inner\([\s\S]*?\n\}/.exec(src);
    if (!m) {
        throw new Error('generate_capability_matrix: could not locate _generate_tools_inner in condense.ts');
    }
    return m[0];
}

export function parse_dispatcher_generators(): Set<string> {
    // Ground truth: every generate_* call inside _generate_tools_inner.
    const src = _dispatcher_source();
    const out = new Set<string>();
    let m: RegExpExecArray | null;
    _CALL_RE.lastIndex = 0;
    while ((m = _CALL_RE.exec(src)) !== null) {
        out.add(m[1] as string);
    }
    return out;
}

export function build_matrix(): Record<string, Record<string, string>> {
    // matrix[artifact][host] = mechanism (native|adapter|adapter†|none).
    const matrix: Record<string, Record<string, string>> = {};
    for (const a of ARTIFACTS) {
        matrix[a] = {};
        for (const h of HOSTS) {
            (matrix[a] as Record<string, string>)[h] = 'none';
        }
    }
    for (const spec of Object.values(_FN_SPEC)) {
        const artifact = spec.artifact;
        for (const [host, mech] of Object.entries(spec.cells)) {
            const cur = (matrix[artifact] as Record<string, string>)[host];
            // native wins over adapter if two generators target the same cell.
            if (cur === 'none' || (cur === 'adapter' && mech === 'native')) {
                (matrix[artifact] as Record<string, string>)[host] = mech;
            }
        }
    }
    // Install-time surfaces (installer, not generate_tools) — only fill empties.
    for (const [artifact, cells] of Object.entries(_INSTALL_TIME_CELLS)) {
        for (const [host, mech] of Object.entries(cells)) {
            if ((matrix[artifact] as Record<string, string>)[host] === 'none') {
                (matrix[artifact] as Record<string, string>)[host] = mech + '†';
            }
        }
    }
    return matrix;
}

export function coverage_guard(): string[] {
    // Return generators present in the dispatcher but missing from _FN_SPEC.
    const present = parse_dispatcher_generators();
    const known = new Set(Object.keys(_FN_SPEC));
    const missing: string[] = [];
    for (const g of present) {
        if (!known.has(g)) {
            missing.push(g);
        }
    }
    missing.sort();
    return missing;
}

const _GLYPH: Record<string, string> = {
    native: '✅ native', adapter: '🔁 adapter', none: '— none',
    'adapter†': '🔁 adapter †',
};

export function render_md(matrix: Record<string, Record<string, string>>): string {
    const lines: string[] = [
        '# Capability matrix — what works on which host',
        '',
        '> **Generated** by `scripts/generate_capability_matrix.py` — do NOT',
        '> hand-edit. Derived from the `generate_tools()` projection logic in',
        '> `condense.py` (each cell traces to a `generate_*` dispatcher call).',
        '> Drift-checked in CI (`--check`).',
        '',
        'Cells: **✅ native** (host consumes the artifact directly — symlink /',
        'native dir) · **🔁 adapter** (projected through a host-specific',
        'transform — `.mdc`, workflow, or an aggregated single file) · **— none**',
        '(no generator emits this artifact for this host).',
        '',
        '| Artifact | ' + HOSTS.join(' | ') + ' |',
        '|---|' + '---|'.repeat(HOSTS.length),
    ];
    for (const a of ARTIFACTS) {
        const row = [`\`${a}\``].concat(
            HOSTS.map((h) => _GLYPH[(matrix[a] as Record<string, string>)[h] as string] as string),
        );
        lines.push('| ' + row.join(' | ') + ' |');
    }
    lines.push(
        '',
        '## How to read this',
        '',
        '- Projection is **intentionally asymmetric** — a `— none` cell is a',
        '  design choice, not a bug. Skills project natively only where a host',
        '  has a native skill surface; everywhere else the rules + commands',
        '  carry the behaviour.',
        '- `🔁 adapter` cells are real coverage through a host-native shape',
        '  (Cursor `.mdc`, Windsurf workflows, the aggregated `GEMINI.md`).',
        '- `†` marks an **install-time** surface the installer writes (e.g.',
        '  `.github/copilot-instructions.md`), not the `generate_tools()` path —',
        '  real coverage, different code path.',
        '',
    );
    return lines.join('\n').replace(/\s+$/, '') + '\n';
}

/**
 * Serialize like Python `json.dumps(value, indent=2, sort_keys=True)` with
 * `ensure_ascii=True` (non-ASCII → `\uXXXX`). Keys sorted; arrays keep order.
 */
function _jsonDumpsSorted(value: unknown): string {
    return _renderJson(value, 2, 0);
}

function _renderJson(value: unknown, indent: number, depth: number): string {
    if (value === null || value === undefined) {
        return 'null';
    }
    if (typeof value === 'boolean' || typeof value === 'number') {
        return JSON.stringify(value);
    }
    if (typeof value === 'string') {
        return _jsonStringAscii(value);
    }
    const pad = ' '.repeat(indent * (depth + 1));
    const closePad = ' '.repeat(indent * depth);
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return '[]';
        }
        const items = value.map((v) => pad + _renderJson(v, indent, depth + 1));
        return '[\n' + items.join(',\n') + '\n' + closePad + ']';
    }
    if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        if (keys.length === 0) {
            return '{}';
        }
        const items = keys.map(
            (k) => pad + _jsonStringAscii(k) + ': ' + _renderJson(obj[k], indent, depth + 1),
        );
        return '{\n' + items.join(',\n') + '\n' + closePad + '}';
    }
    return 'null';
}

/** Python `json.dumps(s, ensure_ascii=True)`: standard escapes + `\uXXXX` for > 0x7e. */
function _jsonStringAscii(s: string): string {
    const base = JSON.stringify(s);
    let out = '';
    for (let i = 0; i < base.length; i += 1) {
        const code = base.charCodeAt(i);
        if (code > 0x7e) {
            out += '\\u' + code.toString(16).padStart(4, '0');
        } else {
            out += base[i];
        }
    }
    return out;
}

export function render_json(matrix: Record<string, Record<string, string>>): string {
    const payload: Record<string, unknown> = {
        schema: 'capability-matrix/1',
        generated_by: 'scripts/generate_capability_matrix.py',
        hosts: HOSTS,
        artifacts: ARTIFACTS,
        matrix,
    };
    const body = _jsonDumpsSorted(payload);
    const digest = crypto.createHash('sha256').update(Buffer.from(body, 'utf-8')).digest('hex');
    payload['checksum'] = `sha256:${digest}`;
    return _jsonDumpsSorted(payload) + '\n';
}

interface ParsedArgs {
    check: boolean;
    quiet: boolean;
}

class _ArgExit extends Error {}

function _argError(msg: string): never {
    process.stderr.write('usage: generate_capability_matrix.py [-h] [--check] [--quiet]\n');
    process.stderr.write(`generate_capability_matrix.py: error: ${msg}\n`);
    process.exitCode = 2;
    throw new _ArgExit();
}

function parse_args(argv: string[]): ParsedArgs {
    const out: ParsedArgs = { check: false, quiet: false };
    for (const a of argv) {
        if (a === '-h' || a === '--help') {
            process.stdout.write('usage: generate_capability_matrix.py [-h] [--check] [--quiet]\n');
            process.exitCode = 0;
            throw new _ArgExit();
        } else if (a === '--check') {
            out.check = true;
        } else if (a === '--quiet') {
            out.quiet = true;
        } else {
            _argError(`unrecognized arguments: ${a}`);
        }
    }
    return out;
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

export function main(argv: string[] | null = null): number {
    let args: ParsedArgs;
    try {
        args = parse_args(argv ?? process.argv.slice(2));
    } catch (e) {
        if (e instanceof _ArgExit) {
            return process.exitCode === undefined ? 0 : (process.exitCode as number);
        }
        throw e;
    }

    const missing = coverage_guard();
    if (missing.length > 0) {
        process.stderr.write(
            '❌  generate_capability_matrix: condense.py dispatcher has ' +
                `generator(s) not mapped in _FN_SPEC: ${_pyListRepr(missing)}. Add an _FN_SPEC ` +
                'entry so the matrix stays derived (never silently drift).\n',
        );
        return 1;
    }

    const matrix = build_matrix();
    const md = render_md(matrix);
    const js = render_json(matrix);

    if (args.check) {
        // Only the tracked doc is drift-checked. dist/discovery/ is gitignored
        // (ephemeral build tree like discovery-manifest.json) — its JSON is
        // rendered from the same deterministic matrix dict, so a current MD
        // implies a current JSON on regeneration.
        const current = _isFile(OUT_MD) ? fs.readFileSync(OUT_MD, 'utf-8') : '';
        if (current !== md) {
            process.stderr.write(
                'generate_capability_matrix: stale — run ' +
                    `\`./scripts-run src/scripts/generate_capability_matrix\` (${_relToRoot(OUT_MD)})\n`,
            );
            return 1;
        }
        if (!args.quiet) {
            process.stdout.write(
                'generate_capability_matrix: OK — docs/capability-matrix.md up to date\n',
            );
        }
        return 0;
    }

    fs.mkdirSync(path.dirname(OUT_MD), { recursive: true });
    fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
    fs.writeFileSync(OUT_MD, md, 'utf-8');
    fs.writeFileSync(OUT_JSON, js, 'utf-8');
    if (!args.quiet) {
        process.stdout.write(
            `generate_capability_matrix: wrote ${_relToRoot(OUT_MD)} ` +
                `+ ${_relToRoot(OUT_JSON)}\n`,
        );
    }
    return 0;
}

/** Mirror Python `OUT.relative_to(ROOT)` rendered with `/` separators. */
function _relToRoot(p: string): string {
    return path.relative(ROOT, p).split(path.sep).join('/');
}

/** Mirror Python `f"{missing}"` for a list of strings (repr with single quotes). */
function _pyListRepr(items: string[]): string {
    return '[' + items.map((s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`).join(', ') + ']';
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exitCode = main();
}
