/**
 * `agent-config sync` — replay the installed-tools manifest (ADR-008)
 * (TypeScript twin).
 *
 * TypeScript twin of `src/scripts/_cli/cmd_sync.py` (ADR-200, py2ts
 * migration). The CLI contract mirrors the Python original EXACTLY — same
 * flags, same exit codes, same stdout/stderr split, byte-identical emitted
 * output, same installer invocation. No behaviour changes; latent quirks are
 * replicated and flagged inline, not fixed.
 *
 * Phase 3.3 of road-to-global-first-install.md. Reads
 * `agents/installed-tools.lock`, then re-runs the bridge install for every
 * tool whose `bridge_marker` is missing on disk. Tools whose marker already
 * exists are skipped — the typical clone-and-sync flow is idempotent on the
 * second invocation. Sync never edits the manifest itself; `init` is the only
 * writer.
 *
 * --- Parity notes (ADR-200) ---
 *
 * - `main()` returns the exit code; the CLI entry guard sets `process.exitCode`
 *   and never calls `process.exit()`. argparse usage errors throw
 *   `ArgparseExit(2)`; `-h`/`--help` throws `ArgparseExit(0)`.
 * - `from scripts.install import main as install_main` → the `install.ts`
 *   twin's `main(argv: string[]): number`. `install_main(argv)` is invoked
 *   with the SAME argv list the Python builds (`--scope=…`, `--tools=…`,
 *   `--project=…`, `--no-smoke`, `--force`, `--skip-bridges`). The installer
 *   twin replicates the Python installer's effects/output.
 * - `installed_tools.manifest_path` / `read_manifest` are the `.ts` twins
 *   (same env / parse semantics).
 * - `resolve_project_root(arg)` mirrors the Phase-3 helper; `opts.project or
 *   os.environ.get("PROJECT_ROOT")` → `opts.project ?? process.env.PROJECT_ROOT
 *   ?? null` (empty string is falsy in both languages, so a blank --project or
 *   blank PROJECT_ROOT falls through identically).
 * - `','.join(sorted(set(tools)))` → dedupe + code-point sort + join. Tool
 *   names are ASCII so JS default string sort matches Python `sorted`.
 * - Emoji status lines (`❌` / `ℹ️` / `✅` / `•`) and the column layout
 *   (`f"  • {name:<15} → {marker} (missing)"`) are reproduced byte-for-byte
 *   via `_ljust` (code-point width).
 */

import process from 'node:process';
import * as fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as path from 'node:path';

import * as installed_tools from '../_lib/installed_tools.js';
import { resolve_project_root } from '../_lib/agent_settings.js';
import { main as install_main } from '../install.js';

// ---------------------------------------------------------------------------
// Python-runtime parity helpers
// ---------------------------------------------------------------------------

/** argparse usage-error / help sentinel: exit 2 for errors, 0 for --help. */
class ArgparseExit extends Error {
    code: number;
    constructor(code: number) {
        super(`ArgparseExit(${code})`);
        this.name = 'ArgparseExit';
        this.code = code;
    }
}

interface OutSink {
    write(text: string): void;
}
function _stdoutSink(): OutSink {
    return { write: (t) => process.stdout.write(t) };
}
function _stderrSink(): OutSink {
    return { write: (t) => process.stderr.write(t) };
}
/** `print(line)` — append a trailing newline like Python's print. */
function _print(out: OutSink, line = ''): void {
    out.write(line + '\n');
}

/** Python `str.ljust(width)` — left-justify, pad with spaces to `width` code points. */
function _ljust(s: string, width: number): string {
    const len = [...s].length;
    if (len >= width) return s;
    return s + ' '.repeat(width - len);
}

function _isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `str(x).strip()` for an entry field that may be any JSON scalar. */
function _strField(value: unknown): string {
    if (value === undefined || value === null) {
        return _pyStrip('None'); // Python str(None) == "None"; .strip() == "None"
    }
    if (typeof value === 'boolean') {
        return value ? 'True' : 'False';
    }
    return _pyStrip(String(value));
}

function _isPyWs(code: number): boolean {
    return (
        code === 0x09 ||
        code === 0x0a ||
        code === 0x0b ||
        code === 0x0c ||
        code === 0x0d ||
        code === 0x1c ||
        code === 0x1d ||
        code === 0x1e ||
        code === 0x1f ||
        code === 0x20 ||
        code === 0x85 ||
        code === 0xa0 ||
        code === 0x1680 ||
        (code >= 0x2000 && code <= 0x200a) ||
        code === 0x2028 ||
        code === 0x2029 ||
        code === 0x202f ||
        code === 0x205f ||
        code === 0x3000
    );
}

function _pyStrip(s: string): string {
    let start = 0;
    let end = s.length;
    while (start < end && _isPyWs(s.charCodeAt(start))) start += 1;
    while (end > start && _isPyWs(s.charCodeAt(end - 1))) end -= 1;
    return s.slice(start, end);
}

// ---------------------------------------------------------------------------

/** Python `Path(p).expanduser()`. */
function _expanduser(p: string): string {
    if (p === '~' || p.startsWith('~/') || p.startsWith('~' + path.sep)) {
        const home = process.env['HOME'] ?? '';
        return path.join(home, p.slice(1));
    }
    return p;
}

function _marker_exists(project_root: string, bridge_marker: string, scope: string): boolean {
    if (!bridge_marker) {
        return true; // substrate-only entries (rare); treat as present
    }
    let target: string;
    if (scope === 'global') {
        target = _expanduser(bridge_marker);
    } else {
        // Project-scope: relative to the project root unless absolute.
        target = path.isAbsolute(bridge_marker)
            ? bridge_marker
            : path.join(project_root, bridge_marker);
    }
    // Python `Path.exists()` follows symlinks; `fs.existsSync` matches it.
    return fs.existsSync(target);
}

type ManifestEntry = Record<string, unknown>;

/**
 * Return ({scope: [tool_names]}, [(name, marker_path)]) for missing tools.
 * The second list is the human-readable summary of what will be replayed.
 */
function _group_by_scope(
    entries: ManifestEntry[],
    project_root: string,
): [{ project: string[]; global: string[] }, Array<[string, string]>] {
    const missing: { project: string[]; global: string[] } = { project: [], global: [] };
    const surfaced: Array<[string, string]> = [];
    for (const entry of entries) {
        const name = _strField(entry['name']);
        const scope = _strField(entry['scope']);
        const bridge_marker = _strField(entry['bridge_marker']);
        if (!name || (scope !== 'project' && scope !== 'global')) {
            continue;
        }
        if (_marker_exists(project_root, bridge_marker, scope)) {
            continue;
        }
        missing[scope].push(name);
        surfaced.push([name, bridge_marker]);
    }
    return [missing, surfaced];
}

function _run_install(
    scope: string,
    tools: string[],
    project_root: string,
    opts: { force: boolean; dry_run: boolean },
): number {
    if (!tools.length) {
        return 0;
    }
    // ','.join(sorted(set(tools))) — dedupe + code-point sort.
    const uniqSorted = Array.from(new Set(tools)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const argv: string[] = [`--scope=${scope}`, `--tools=${uniqSorted.join(',')}`];
    if (scope === 'project') {
        argv.push(`--project=${project_root}`, '--no-smoke');
    }
    if (opts.force) {
        argv.push('--force');
    }
    if (opts.dry_run) {
        argv.push('--skip-bridges');
    }
    return install_main(argv);
}

// ---------------------------------------------------------------------------
// arg parsing — mirrors argparse flags + usage / error exits
// ---------------------------------------------------------------------------

interface Opts {
    project: string | null;
    dry_run: boolean;
    force: boolean;
    quiet: boolean;
}

function _parse(argv: string[], out: OutSink, err: OutSink): Opts {
    const prog = 'agent-config sync';
    // argparse wraps `[--quiet]` to a continuation line indented to
    // `len("usage: ") + len(prog) + 1` (25).
    const usage =
        `usage: ${prog} [-h] [--project PROJECT] [--dry-run] [--force]\n` +
        `${' '.repeat(25)}[--quiet]\n`;

    const emitError = (msg: string): never => {
        err.write(usage);
        err.write(`${prog}: error: ${msg}\n`);
        throw new ArgparseExit(2);
    };

    const opts: Opts = { project: null, dry_run: false, force: false, quiet: false };

    let i = 0;
    while (i < argv.length) {
        const tok = argv[i] as string;
        if (tok === '-h' || tok === '--help') {
            out.write(usage);
            throw new ArgparseExit(0);
        } else if (tok === '--project') {
            const val: string | undefined = argv[i + 1];
            if (val === undefined) emitError('argument --project: expected one argument');
            opts.project = val as string;
            i += 2;
        } else if (tok.startsWith('--project=')) {
            opts.project = tok.slice('--project='.length);
            i += 1;
        } else if (tok === '--dry-run') {
            opts.dry_run = true;
            i += 1;
        } else if (tok === '--force') {
            opts.force = true;
            i += 1;
        } else if (tok === '--quiet') {
            opts.quiet = true;
            i += 1;
        } else {
            emitError(`unrecognized arguments: ${tok}`);
        }
    }
    return opts;
}

function _emit(quiet: boolean, out: OutSink, msg: string): void {
    if (!quiet) {
        _print(out, msg);
    }
}

interface MainOptions {
    out?: OutSink;
    err?: OutSink;
}

export function main(argv: string[] | null = null, options: MainOptions = {}): number {
    const out = options.out ?? _stdoutSink();
    const err = options.err ?? _stderrSink();
    const opts = _parse(argv ?? process.argv.slice(2), out, err);

    // Phase 3 — resolve_project_root honors AGENT_CONFIG_PROJECT_ROOT and the
    // Step-7 anchor walk. Legacy PROJECT_ROOT is the explicit fallback.
    const envProjectRoot = process.env['PROJECT_ROOT'];
    const arg = opts.project || (envProjectRoot ? envProjectRoot : null);
    const [project_root] = resolve_project_root(arg);
    const manifest = installed_tools.manifest_path(project_root);
    const data = installed_tools.read_manifest(manifest);

    if (data === null) {
        _emit(opts.quiet, out, `❌  No manifest found at ${manifest}`);
        _emit(opts.quiet, out, '    Run `./agent-config init --tools=<id>` to create one.');
        return 1;
    }

    const rawTools = (data as Record<string, unknown>)['tools'];
    const entries: ManifestEntry[] = (Array.isArray(rawTools) ? rawTools : []).filter(
        (e): e is ManifestEntry => _isPlainObject(e),
    );
    // Python `list(data.get("tools") or [])` keeps every element; only dict
    // entries carry the fields `_group_by_scope` reads. Non-dict elements would
    // raise on `.get` in Python's loop body? No — `entry.get(...)` on a non-dict
    // raises AttributeError, which is NOT caught, so a malformed manifest with a
    // non-dict tool entry crashes Python. The manifest reader only ever yields
    // dict entries (see installed_tools), so this path is unreachable in
    // practice; the filter keeps the TS iteration well-typed without diverging
    // on any real manifest.
    const totalEntries = Array.isArray(rawTools) ? rawTools.length : 0;
    if (totalEntries === 0) {
        _emit(opts.quiet, out, `ℹ️  Manifest is empty: ${manifest}`);
        return 0;
    }

    const [missing, surfaced] = _group_by_scope(entries, project_root);
    const total_missing = missing.project.length + missing.global.length;
    const total_present = totalEntries - total_missing;

    _emit(opts.quiet, out, `Manifest:  ${manifest}`);
    _emit(
        opts.quiet,
        out,
        `Tools:     ${totalEntries} listed, ${total_present} present, ${total_missing} missing`,
    );
    if (total_missing === 0) {
        _emit(opts.quiet, out, '✅  All bridges already installed. Nothing to do.');
        return 0;
    }

    for (const [name, marker] of surfaced) {
        _emit(opts.quiet, out, `  • ${_ljust(name, 15)} → ${marker} (missing)`);
    }

    if (opts.dry_run) {
        _emit(opts.quiet, out, '');
        _emit(opts.quiet, out, 'Dry-run: no bridges written.');
        return 0;
    }

    _emit(opts.quiet, out, '');
    for (const scope of ['project', 'global'] as const) {
        const tools = missing[scope];
        if (!tools.length) {
            continue;
        }
        const sorted = [...tools].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        _emit(opts.quiet, out, `Replaying scope=${scope}: ${sorted.join(', ')}`);
        const rc = _run_install(scope, tools, project_root, {
            force: opts.force,
            dry_run: false,
        });
        if (rc !== 0) {
            _emit(opts.quiet, out, `❌  Installer failed for scope=${scope} (rc=${rc}); aborting.`);
            return rc;
        }
    }

    _emit(opts.quiet, out, '');
    _emit(opts.quiet, out, '✅  Sync complete.');
    return 0;
}

// CLI entry guard — set process.exitCode; never call process.exit().
// Python: `if __name__ == "__main__": sys.exit(main(sys.argv[1:]))`.
const _HERE = fileURLToPath(import.meta.url);
const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    try {
        process.exitCode = main(process.argv.slice(2));
    } catch (exc) {
        if (exc instanceof ArgparseExit) {
            process.exitCode = exc.code;
        } else {
            throw exc;
        }
    }
}
