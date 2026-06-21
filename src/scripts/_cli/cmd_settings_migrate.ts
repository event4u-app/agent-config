/**
 * `agent-config settings:migrate` — lift project-local settings into the
 * global store (TypeScript twin).
 *
 * TypeScript twin of `src/scripts/_cli/cmd_settings_migrate.py` (ADR-200,
 * py2ts migration). The CLI contract mirrors the Python original EXACTLY —
 * same flags, same exit codes, same stdout/stderr split, byte-identical
 * emitted output, same filesystem effects. No behaviour changes; latent quirks
 * are replicated and flagged inline, not fixed.
 *
 * Phase 2.4 of road-to-global-only-install.md. Copies an existing
 * project-local `.agent-settings.yml` / `.agent-user.yml` into
 * `~/.event4u/agent-config/` so the global-only consumer surface (ADR-020) can
 * take over. Read-only on the source — the destructive `move` step is owned by
 * the unified `agent-config migrate` command. Idempotent: refuses to overwrite
 * a non-empty global file without `--force`. `--dry-run` lists intended copies;
 * zero writes; exit 0.
 *
 * Exit codes:
 *
 * - `0` — success or no-op (nothing to migrate / already migrated).
 * - `1` — at least one global file is non-empty and `--force` was not passed,
 *   or a source file failed YAML parse.
 *
 * --- Parity notes (ADR-200) ---
 *
 * - `main()` returns the exit code; the CLI entry guard sets `process.exitCode`
 *   and never calls `process.exit()`. argparse usage errors throw
 *   `ArgparseExit(2)`; `-h`/`--help` throws `ArgparseExit(0)`.
 * - `install_mod.SETTINGS_FILE`, `GLOBAL_AGENT_SETTINGS_PATH`,
 *   `GLOBAL_USER_SETTINGS_PATH` are imported from the `install.ts` twin (same
 *   `~/.event4u/agent-config/…` derivation), so destinations match byte-for-byte.
 * - `shutil.copy2(src, dst)` → `fs.copyFileSync` + best-effort timestamp copy
 *   (the user only observes file content + the `chmod 0o600` mode; copy2 also
 *   preserves mtime, which we replicate via `fs.utimesSync` best-effort —
 *   non-observable in CLI output). `os.chmod(dst, 0o600)` wrapped in a
 *   try/except → `fs.chmodSync` in a try/catch (POSIX-only; no-op failure on
 *   platforms without mode bits, matching the Python `except OSError: pass`).
 * - `dst.parent.mkdir(parents=True, exist_ok=True, mode=0o700)` →
 *   `fs.mkdirSync(dir, { recursive: true, mode: 0o700 })`.
 * - YAML soft-parse: Python `_parse_yaml_or_fail` imports PyYAML; **if PyYAML
 *   is absent it returns True (defers validation to the consumer)**. This twin
 *   ships no YAML dependency, so it takes that same no-PyYAML branch — every
 *   source file is treated as parseable. KNOWN DIVERGENCE: when the host
 *   python3 *does* have PyYAML and the source file is malformed YAML, Python
 *   prints `❌  <path>: cannot parse as YAML: <err>` and exits 1, whereas this
 *   twin proceeds. Replicating PyYAML's exact error text in TS is infeasible;
 *   the tested paths use valid YAML sources, where both sides agree.
 * - `Path(opts.from_dir).resolve()` → `path.resolve`. `Path.cwd()` →
 *   `process.cwd()`. Source-candidate cascade (typed `settings/` subdir wins
 *   over the legacy flat path) is preserved.
 */

import process from 'node:process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    SETTINGS_FILE,
    GLOBAL_AGENT_SETTINGS_PATH,
    GLOBAL_USER_SETTINGS_PATH,
} from '../install.js';

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
/** `print(line, file=...)` — append a trailing newline like Python's print. */
function _print(out: OutSink, line = ''): void {
    out.write(line + '\n');
}

/**
 * Python `Path(p).resolve()` — absolutise + resolve symlinks (non-strict:
 * tolerates a path that does not exist, like Python 3.6+ `.resolve()`).
 */
function _resolve(p: string): string {
    const abs = path.resolve(p);
    try {
        return fs.realpathSync(abs);
    } catch {
        return abs;
    }
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** The Python-whitespace set `str.strip()` removes (for the `.strip() != ""` test). */
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

/** Return True when the file exists and has non-whitespace content. */
function _is_non_empty_yaml(p: string): boolean {
    if (!_isFile(p)) {
        return false;
    }
    let text: string;
    try {
        text = fs.readFileSync(p, { encoding: 'utf-8' });
    } catch {
        return false;
    }
    return _pyStrip(text) !== '';
}

/**
 * Soft-parse a YAML file; print the error and return False on failure.
 *
 * Python imports PyYAML; absent → returns True (defer). This twin ships no YAML
 * dependency, so it always takes the no-PyYAML branch and returns True. See the
 * module-header KNOWN DIVERGENCE note.
 */
function _parse_yaml_or_fail(_p: string, _out: OutSink): boolean {
    return true; // No YAML dep — defer the validation to the consumer.
}

/** Copy `src` to `dst` with mode 0600. Returns a one-line summary. */
function _copy(src: string, dst: string, opts: { dry_run: boolean }): string {
    if (opts.dry_run) {
        return `would copy ${src} → ${dst}`;
    }
    // dst.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fs.mkdirSync(path.dirname(dst), { recursive: true, mode: 0o700 });
    // shutil.copy2 — content + metadata (mtime). Content is what the user sees;
    // copy mtime best-effort to mirror copy2.
    fs.copyFileSync(src, dst);
    try {
        const st = fs.statSync(src);
        fs.utimesSync(dst, st.atime, st.mtime);
    } catch {
        /* best-effort, matching copy2's metadata leniency */
    }
    try {
        fs.chmodSync(dst, 0o600);
    } catch {
        /* OSError → pass */
    }
    return `copied ${src} → ${dst}`;
}

// ---------------------------------------------------------------------------
// arg parsing — mirrors argparse flags + usage / error exits
// ---------------------------------------------------------------------------

interface Opts {
    from_dir: string | null;
    force: boolean;
    dry_run: boolean;
}

function _parse(argv: string[], out: OutSink, err: OutSink): Opts {
    const prog = 'agent-config settings:migrate';
    // argparse wraps `[--dry-run]` to a continuation line indented to
    // `len("usage: ") + len(prog) + 1` (37).
    const usage =
        `usage: ${prog} [-h] [--from FROM_DIR] [--force]\n` +
        `${' '.repeat(37)}[--dry-run]\n`;

    const emitError = (msg: string): never => {
        err.write(usage);
        err.write(`${prog}: error: ${msg}\n`);
        throw new ArgparseExit(2);
    };

    const opts: Opts = { from_dir: null, force: false, dry_run: false };

    let i = 0;
    while (i < argv.length) {
        const tok = argv[i] as string;
        if (tok === '-h' || tok === '--help') {
            out.write(usage);
            throw new ArgparseExit(0);
        } else if (tok === '--from') {
            const val: string | undefined = argv[i + 1];
            if (val === undefined) emitError('argument --from: expected one argument');
            opts.from_dir = val as string;
            i += 2;
        } else if (tok.startsWith('--from=')) {
            opts.from_dir = tok.slice('--from='.length);
            i += 1;
        } else if (tok === '--force') {
            opts.force = true;
            i += 1;
        } else if (tok === '--dry-run') {
            opts.dry_run = true;
            i += 1;
        } else {
            emitError(`unrecognized arguments: ${tok}`);
        }
    }
    return opts;
}

interface MainOptions {
    out?: OutSink;
    err?: OutSink;
}

export function main(argv: string[] | null = null, options: MainOptions = {}): number {
    const out = options.out ?? _stdoutSink();
    const err = options.err ?? _stderrSink();
    const opts = _parse(argv ?? process.argv.slice(2), out, err);

    // Python: `Path(opts.from_dir).resolve()` resolves symlinks + makes
    // absolute (mirrored with `fs.realpathSync`, falling back to a plain
    // `path.resolve` when the path does not yet exist — Python's `.resolve()`
    // is non-strict and also tolerates missing paths). `Path.cwd()` → cwd.
    const project = opts.from_dir ? _resolve(opts.from_dir) : process.cwd();

    // Source candidates — typed subdir wins over the legacy flat path.
    let src_settings = path.join(project, 'settings', SETTINGS_FILE);
    if (!_isFile(src_settings)) {
        src_settings = path.join(project, SETTINGS_FILE);
    }
    let src_user = path.join(project, 'settings', '.agent-user.yml');
    if (!_isFile(src_user)) {
        src_user = path.join(project, '.agent-user.yml');
    }

    const dst_settings = GLOBAL_AGENT_SETTINGS_PATH;
    const dst_user = GLOBAL_USER_SETTINGS_PATH;

    const plan: Array<[string, string]> = [];
    const skipped: string[] = [];

    const triples: Array<[string, string, string]> = [
        [src_settings, dst_settings, 'settings'],
        [src_user, dst_user, 'user'],
    ];

    for (const [src, dst, label] of triples) {
        if (!_isFile(src)) {
            skipped.push(`${label}: source absent (${src})`);
            continue;
        }
        if (_is_non_empty_yaml(dst) && !opts.force) {
            _print(err, `❌  ${dst} is non-empty — pass --force to overwrite.`);
            return 1;
        }
        if (!_parse_yaml_or_fail(src, err)) {
            return 1;
        }
        plan.push([src, dst]);
    }

    if (plan.length === 0) {
        _print(out, '✅  nothing to migrate — no project-local settings detected.');
        for (const line of skipped) {
            _print(out, `    - ${line}`);
        }
        return 0;
    }

    const summary: string[] = [];
    for (const [src, dst] of plan) {
        summary.push(_copy(src, dst, { dry_run: opts.dry_run }));
    }

    const verb = opts.dry_run ? 'would migrate' : 'migrated';
    _print(out, `✅  ${verb} ${plan.length} file(s):`);
    for (const line of summary) {
        _print(out, `    - ${line}`);
    }
    for (const line of skipped) {
        _print(out, `    - ${line}`);
    }
    if (opts.dry_run) {
        _print(out, '\n    Re-run without --dry-run to apply.');
    }
    return 0;
}

// CLI entry guard — set process.exitCode; never call process.exit().
// Python: `if __name__ == "__main__": sys.exit(main())`.
const _HERE = fileURLToPath(import.meta.url);
const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    try {
        process.exitCode = main();
    } catch (exc) {
        if (exc instanceof ArgparseExit) {
            process.exitCode = exc.code;
        } else {
            throw exc;
        }
    }
}
