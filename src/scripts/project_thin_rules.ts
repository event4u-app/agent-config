#!/usr/bin/env tsx
/**
 * Thin-projection of the rule layer (lean-initial-context build-out, Phase 3.1).
 *
 * Ported from the retired Python `src/scripts/project_thin_rules.py` (ADR-200 —
 * Python→TS migration, Phase 8 / Wave 8b). The CLI contract is mirrored
 * EXACTLY — the `--measure` / `--out` / `--json` flags, exit codes, the
 * stdout/stderr split, byte-identical messages, and byte-identical JSON
 * output (`json.dumps(indent=2, sort_keys=True)`).
 *
 * The dominant always-on cost is rule BODIES. A **thin** rule entry keeps
 * the matching signal (frontmatter `description` + `triggers`) so the
 * router still selects it, and replaces the body with a one-line pointer
 * to the full text. The agent loads the body on match. The kernel stays
 * full-bodied.
 *
 * This module is the mechanism + a measurement harness. It writes to a
 * target dir of your choosing — it never overwrites the live `.claude/` /
 * `.augment/` projections.
 *
 * NOTE: the thin-entry pointer literal moved with the mechanism — it is
 * `BODY_LINK_PREFIX` in `_lib/thin_rules.ts` now, so the twin-parity argument
 * that exempted it from the ADR-051 legacy-path guard belongs to THAT file and
 * no longer describes this one, which holds the string nowhere.
 *
 * Historical quirks are preserved deliberately — tests and downstream consumers pin the exact behaviour.
 *
 * Usage:
 *     project_thin_rules --measure          # measure delta, no write
 *     project_thin_rules --out <dir>        # write thin rules to <dir>
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as token_count from './_lib/token_count.js';

/**
 * The mechanism lives in `_lib/thin_rules.ts`; this file is its CLI.
 *
 * Re-exported wholesale so every existing importer of
 * `project_thin_rules.{build_thin,thin_entry,is_thin_entry,RULES_SOURCE,…}`
 * keeps working unchanged. The split exists because `src/scripts/install.ts` is
 * a bundle entry and `check_installer_import_purity` forbids it reaching a
 * module-level `process.exit()` — which this file has, at its foot, by design.
 */
export * from './_lib/thin_rules.js';
import {
    _globSortedMd,
    build_thin,
    fm_workspaces,
    id_in_scope,
    kernel_ids,
    no_trigger_ids,
    REPO_ROOT,
    RULES_SOURCE,
    rule_workspaces_map,
} from './_lib/thin_rules.js';
void REPO_ROOT;

const _HERE = fileURLToPath(import.meta.url);

export interface ThinMeasure {
    rules_total: number;
    kernel_full: number;
    /**
     * Everything non-kernel that the no-trigger residue does not claim — which
     * is NOT the same as everything actually thinned, and the gap grew with the
     * `no_stub` subset. The path-only residue and the declared `no_stub`
     * members project full-bodied and are counted here anyway, because the
     * field's identity (`rules_total = kernel_full + non_kernel_thinned +
     * no_trigger_full`) is pinned by a test and is what the CLI's own line
     * arithmetic rests on. Named rather than silently widened: for the real
     * thinned count, ask `build_thin` and filter on {@link is_thin_entry}.
     */
    non_kernel_thinned: number;
    /** Non-kernel rules kept full-bodied because the router gives them no trigger. */
    no_trigger_full: number;
    no_trigger_ids: string[];
    no_trigger_gpt: number;
    eager_gpt: number;
    thin_gpt: number;
    saved_gpt: number;
    saved_pct: number;
    eager_chars: number;
    thin_chars: number;
    token_method: string;
}

/** Python `round(x, 1)` — round-half-to-even at one decimal. */
function _python_round1(x: number): number {
    const scaled = x * 10;
    const floor = Math.floor(scaled);
    const diff = scaled - floor;
    let r: number;
    if (diff > 0.5) {
        r = floor + 1;
    } else if (diff < 0.5) {
        r = floor;
    } else {
        r = floor % 2 === 0 ? floor : floor + 1;
    }
    return r / 10;
}

/** Eager vs thin token footprint for the rule layer (scope applies to both arms). */
export function measure(
    rules_dir: string = RULES_SOURCE,
    scope: readonly string[] | null = null,
): ThinMeasure {
    const kernel = kernel_ids();
    const wsMap = scope !== null ? rule_workspaces_map() : new Map<string, string[]>();
    const mdPaths = _globSortedMd(rules_dir).filter((p) =>
        id_in_scope(
            path.basename(p).replace(/\.md$/, ''),
            scope,
            kernel,
            wsMap,
            fm_workspaces(fs.readFileSync(p, 'utf-8')),
        ),
    );
    const eager_blob = mdPaths.map((p) => fs.readFileSync(p, 'utf-8')).join('');
    const thin_blob = [...build_thin(rules_dir, scope).values()].join('');
    const eager = token_count.measure(eager_blob);
    const thin = token_count.measure(thin_blob);
    const n = mdPaths.length;
    // len(kernel & {p.stem for p in rules_dir.glob("*.md")})
    const stemSet = new Set(mdPaths.map((p) => path.basename(p).replace(/\.md$/, '')));
    let kernelInDir = 0;
    for (const k of kernel) {
        if (stemSet.has(k)) {
            kernelInDir += 1;
        }
    }
    const noTrigger = no_trigger_ids();
    const residueIds = [...noTrigger].filter((id) => stemSet.has(id)).sort();
    const residueBlob = residueIds
        .map((id) => fs.readFileSync(path.join(rules_dir, `${id}.md`), 'utf-8'))
        .join('');
    const residueGpt = residueIds.length === 0 ? 0 : token_count.measure(residueBlob).tokens_gpt;
    const saved_pct = eager.tokens_gpt
        ? _python_round1((100 * (eager.tokens_gpt - thin.tokens_gpt)) / eager.tokens_gpt)
        : 0.0;
    return {
        rules_total: n,
        kernel_full: kernelInDir,
        non_kernel_thinned: n - kernelInDir - residueIds.length,
        no_trigger_full: residueIds.length,
        no_trigger_ids: residueIds,
        no_trigger_gpt: residueGpt,
        eager_gpt: eager.tokens_gpt,
        thin_gpt: thin.tokens_gpt,
        saved_gpt: eager.tokens_gpt - thin.tokens_gpt,
        saved_pct,
        eager_chars: eager.chars,
        thin_chars: thin.chars,
        token_method: token_count.method_note(),
    };
}

/** Write thin rule files to `out_dir`; return the count written. */
export function write_thin(
    out_dir: string,
    rules_dir: string = RULES_SOURCE,
    scope: readonly string[] | null = null,
): number {
    fs.mkdirSync(out_dir, { recursive: true });
    const files = build_thin(rules_dir, scope);
    for (const [name, text] of files) {
        fs.writeFileSync(path.join(out_dir, name), text, 'utf-8');
    }
    return files.size;
}

// --- json.dumps(indent=2, sort_keys=True) replica ----------------------------

/**
 * Sentinel for a Python `float` value, so the dumper renders an
 * integer-valued float as `N.0` (json.dumps parity). Python `round(x, 1)`
 * always yields a float; `saved_pct` is the only such field here.
 */
class PyFloat {
    readonly value: number;
    constructor(value: number) {
        this.value = value;
    }
}

/** Render a float like Python `repr()` inside json.dumps (e.g. 90 → "90.0"). */
function _pyFloatRepr(n: number): string {
    return Number.isInteger(n) ? `${n}.0` : String(n);
}

function _jsonDumpsSorted(obj: unknown): string {
    const pad = '  ';
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
    function enc(value: unknown, depth: number): string {
        if (value === null || value === undefined) {
            return 'null';
        }
        if (value instanceof PyFloat) {
            return _pyFloatRepr(value.value);
        }
        if (typeof value === 'boolean') {
            return value ? 'true' : 'false';
        }
        if (typeof value === 'number') {
            return String(value);
        }
        if (typeof value === 'string') {
            return encStr(value);
        }
        if (Array.isArray(value)) {
            if (value.length === 0) {
                return '[]';
            }
            const inner = value.map((v) => pad.repeat(depth + 1) + enc(v, depth + 1));
            return '[\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + ']';
        }
        const o = value as Record<string, unknown>;
        const keys = Object.keys(o).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        if (keys.length === 0) {
            return '{}';
        }
        const inner = keys.map((k) => pad.repeat(depth + 1) + encStr(k) + ': ' + enc(o[k], depth + 1));
        return '{\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + '}';
    }
    return enc(obj, 0);
}

// --- argparse replica ---------------------------------------------------------

interface ParsedArgs {
    measure: boolean;
    out: string | null;
    json: boolean;
    workspaces: string[] | null;
}

// argparse `prog` defaults to basename(sys.argv[0]) → `project_thin_rules.py`.
const _USAGE =
    'usage: project_thin_rules.py [-h] [--measure] [--out OUT] [--json] [--workspaces WS]\n';

// Full `-h` help block.
const _HELP =
    _USAGE +
    '\n' +
    'Thin-projection of the rule layer (lean-initial-context build-out, Phase 3.1).\n' +
    '\n' +
    'optional arguments:\n' +
    '  -h, --help       show this help message and exit\n' +
    '  --measure        print the eager-vs-thin token delta\n' +
    '  --out OUT        write thin rule files to this dir\n' +
    '  --json\n' +
    '  --workspaces WS  comma-separated workspace scope (router.json v2 fields);\n' +
    '                   kernel always survives, out-of-scope rules drop entirely\n';

function _argError(msg: string): never {
    process.stderr.write(_USAGE);
    process.stderr.write(`project_thin_rules.py: error: ${msg}\n`);
    process.exit(2);
}

function parse_args(argv: string[]): ParsedArgs {
    const out: ParsedArgs = { measure: false, out: null, json: false, workspaces: null };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(_HELP);
            process.exit(0);
        } else if (a === '--measure') {
            out.measure = true;
        } else if (a === '--json') {
            out.json = true;
        } else if (a === '--out') {
            const next = argv[i + 1];
            if (next === undefined) {
                _argError('argument --out: expected one argument');
            }
            out.out = next;
            i += 1;
        } else if (a.startsWith('--out=')) {
            out.out = a.slice('--out='.length);
        } else if (a === '--workspaces') {
            const next = argv[i + 1];
            if (next === undefined) {
                _argError('argument --workspaces: expected one argument');
            }
            out.workspaces = next.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
            i += 1;
        } else if (a.startsWith('--workspaces=')) {
            out.workspaces = a
                .slice('--workspaces='.length)
                .split(',')
                .map((s) => s.trim())
                .filter((s) => s.length > 0);
        } else {
            _argError(`unrecognized arguments: ${a}`);
        }
    }
    return out;
}

/** Python f-string `{x:,}` — thousands separators with comma. */
function _comma(n: number): string {
    return n.toLocaleString('en-US');
}

/** Python f-string `{x:>6}` — right-justify in a field of width 6. */
function _rjust6(n: number): string {
    return String(n).padStart(6, ' ');
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    if (args.out !== null) {
        const n = write_thin(args.out, RULES_SOURCE, args.workspaces);
        process.stdout.write(`wrote ${n} thin rule files → ${args.out}\n`);
        return 0;
    }

    const m = measure(RULES_SOURCE, args.workspaces);
    if (args.json) {
        // `saved_pct` is a Python float (round(..., 1)); wrap it so an
        // integer-valued result still renders as `N.0` (json.dumps parity).
        const jsonShape: Record<string, unknown> = { ...m, saved_pct: new PyFloat(m.saved_pct) };
        process.stdout.write(_jsonDumpsSorted(jsonShape) + '\n');
    } else {
        process.stdout.write(
            `Rule-layer thin projection (kernel full-bodied + ${m.non_kernel_thinned} non-kernel pointers):\n`,
        );
        process.stdout.write(`  eager: ${_rjust6(m.eager_gpt)} GPT tok (${_comma(m.eager_chars)} chars)\n`);
        process.stdout.write(`  thin:  ${_rjust6(m.thin_gpt)} GPT tok (${_comma(m.thin_chars)} chars)\n`);
        process.stdout.write(`  saved: ${_rjust6(m.saved_gpt)} GPT tok  (${m.saved_pct}% of the rule layer)\n`);
        process.stdout.write(`  method: ${m.token_method}\n`);
        process.stdout.write(
            `  no-trigger residue (kept full-bodied, ${m.no_trigger_full} rules, ` +
                `${m.no_trigger_gpt} GPT tok): ${m.no_trigger_ids.join(', ')}\n`,
        );
    }
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

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}
