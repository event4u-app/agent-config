/**
 * `agent-config export` — eject a tool's canonical content into the project
 * (TypeScript twin).
 *
 * TypeScript twin of `src/scripts/_cli/cmd_export.py` (ADR-200, py2ts
 * migration). The CLI contract mirrors the Python original EXACTLY — same
 * flags, same exit codes, same stdout/stderr split, byte-identical emitted
 * output, same filesystem effects. No behaviour changes; latent quirks are
 * replicated and flagged inline, not fixed.
 *
 * Phase 1.5 of road-to-global-first-install.md (ADR-007 D3). Writes a real
 * file with the resolved content for a named tool into a user-chosen path so
 * it can be committed, shared, or customized in place. Idempotent by default;
 * `--force` overrides content drift. No canonical-path defaults.
 *
 * --- Parity notes (ADR-200) ---
 *
 * - `main()` returns the exit code; the CLI entry guard sets `process.exitCode`
 *   and never calls `process.exit()`. argparse usage errors throw
 *   `ArgparseExit(2)`; `-h`/`--help` throws `ArgparseExit(0)`.
 * - The 9 marker constants and templates resolve to the same byte content as
 *   the Python originals: marker constants are re-exported from the
 *   `install.ts` twin (single source of truth); templates are read from
 *   `dist/agent-src/templates` via `_from_template` exactly as Python does.
 * - `hashlib.sha256(content.encode("utf-8")).hexdigest()` →
 *   `crypto.createHash('sha256').update(content, 'utf-8').digest('hex')`.
 * - `max(len(t) for t in EXPORT_REGISTRY) + 2` and `f"{tool_id:<{width}}{desc}"`
 *   → code-point max-length + `_ljust`. `sorted(EXPORT_REGISTRY.items())`
 *   sorts by key; mirrored with a code-point-ordered key sort (the keys are
 *   ASCII, so JS default string `<` ordering matches Python's).
 * - `Path(args.output).expanduser().resolve()` → expanduser + `path.resolve`
 *   (absolute, normalised). `_rel` is `Path.relative_to(Path.cwd())` with a
 *   `ValueError` fallback to the absolute path — mirrored with a containment
 *   check (Python `relative_to` only succeeds when `output` is under cwd).
 * - `output.parent.mkdir(parents=True, exist_ok=True)` →
 *   `fs.mkdirSync(dir, { recursive: true })`.
 * - The Python defaults `out=sys.stdout, err=sys.stderr` are bound fresh per
 *   call here (no import-time stream capture); behaviour is identical.
 */

import process from 'node:process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    AIDER_MARKER,
    CLAUDE_DESKTOP_MARKER,
    CODEX_MARKER,
    CONTINUE_MARKER,
    JETBRAINS_MARKER,
    KILOCODE_MARKER,
    KIRO_MARKER,
    ROOCODE_MARKER,
    ZED_MARKER,
} from '../install.js';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const TEMPLATES_DIR = path.join(PACKAGE_ROOT, 'dist/agent-src', 'templates');

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

/** Python `str.ljust(width)` — left-justify, pad with spaces to `width` code points. */
function _ljust(s: string, width: number): string {
    const len = [...s].length;
    if (len >= width) return s;
    return s + ' '.repeat(width - len);
}

/** A FileNotFoundError-equivalent so the template path mirrors Python. */
class FileNotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FileNotFoundError';
    }
}

type ContentProvider = () => string;

function _from_template(rel: string): ContentProvider {
    return () => {
        const p = path.join(TEMPLATES_DIR, rel);
        let isFile: boolean;
        try {
            isFile = fs.statSync(p).isFile();
        } catch {
            isFile = false;
        }
        if (!isFile) {
            throw new FileNotFoundError(
                `template missing from package: ${p} ` +
                    `(reinstall @event4u/agent-config or report a bug)`,
            );
        }
        return fs.readFileSync(p, { encoding: 'utf-8' });
    };
}

function _from_constant(value: string): ContentProvider {
    return () => value;
}

// tool_id → (description, content_provider). Insertion order mirrors the
// Python dict; `_list_tools` sorts by key.
const EXPORT_REGISTRY: Record<string, [string, ContentProvider]> = {
    roocode: [
        'Roo Code marker (.roo/rules/agent-config.md body)',
        _from_constant(ROOCODE_MARKER),
    ],
    'claude-desktop': [
        'Claude Desktop marker (informational, global-scope tool)',
        _from_constant(CLAUDE_DESKTOP_MARKER),
    ],
    aider: [
        'Aider marker (manual `read:` wiring documented inline)',
        _from_constant(AIDER_MARKER),
    ],
    codex: [
        'Codex CLI marker (informational — AGENTS.md is canonical)',
        _from_constant(CODEX_MARKER),
    ],
    continue: [
        'Continue.dev marker (.continue/rules/agent-config.md body)',
        _from_constant(CONTINUE_MARKER),
    ],
    kilocode: [
        'Kilo Code marker (.kilocode/rules/agent-config.md body)',
        _from_constant(KILOCODE_MARKER),
    ],
    zed: [
        'Zed marker (informational — .rules at repo root is canonical)',
        _from_constant(ZED_MARKER),
    ],
    jetbrains: [
        'JetBrains AI Assistant marker (.jetbrains/agent-config.md body)',
        _from_constant(JETBRAINS_MARKER),
    ],
    kiro: [
        'Kiro marker (.kiro/steering/agent-config.md body)',
        _from_constant(KIRO_MARKER),
    ],
    'agents-md': [
        'AGENTS.md template (Thin-Root entry point — consumer scaffold)',
        _from_template('AGENTS.md'),
    ],
    'copilot-instructions': [
        'GitHub Copilot Code Review instructions template',
        _from_template('copilot-instructions.md'),
    ],
};

function _list_tools(out: OutSink): number {
    _print(out, 'Available tools for `agent-config export --tool <id>`:');
    const keys = Object.keys(EXPORT_REGISTRY);
    const width = Math.max(...keys.map((t) => [...t].length)) + 2;
    // Python `sorted(EXPORT_REGISTRY.items())` — sort by key (code-point order;
    // keys are ASCII so JS string `<` matches Python).
    const sortedKeys = [...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    for (const tool_id of sortedKeys) {
        const [desc] = EXPORT_REGISTRY[tool_id] as [string, ContentProvider];
        _print(out, `  ${_ljust(tool_id, width)}${desc}`);
    }
    return 0;
}

function _hash(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

/** Python `Path.relative_to(Path.cwd())` with a ValueError → absolute fallback. */
function _rel(p: string): string {
    const cwd = process.cwd();
    const rel = path.relative(cwd, p);
    // `relative_to` raises ValueError unless `p` is at/under cwd. `path.relative`
    // emits a `..`-prefixed (or absolute, on Windows drive change) path in that
    // case — fall back to the absolute path, matching the Python except branch.
    if (rel === '' || (rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel))) {
        return rel === '' ? p : rel;
    }
    return p;
}

function _write(
    output: string,
    content: string,
    opts: { force: boolean; out: OutSink; err: OutSink },
): number {
    const { force, out, err } = opts;
    let exists: boolean;
    try {
        fs.lstatSync(output);
        exists = true;
    } catch {
        exists = false;
    }
    if (exists) {
        const existing = fs.readFileSync(output, { encoding: 'utf-8' });
        if (_hash(existing) === _hash(content)) {
            _print(out, `ℹ️  ${_rel(output)} already exported (content matches).`);
            return 0;
        }
        if (!force) {
            _print(
                err,
                `❌  refusing to overwrite ${output} — content differs. ` +
                    `Pass --force to replace.`,
            );
            return 1;
        }
    }
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, content, { encoding: 'utf-8' });
    _print(out, `✅  exported to ${_rel(output)}`);
    return 0;
}

// ---------------------------------------------------------------------------
// arg parsing — mirrors argparse flags + usage / error exits
// ---------------------------------------------------------------------------

interface Args {
    tool: string | null;
    output: string | null;
    force: boolean;
    list: boolean;
}

function _parse(argv: string[], out: OutSink, err: OutSink): Args {
    const prog = 'agent-config export';
    const usage = `usage: ${prog} [-h] [--tool ID] [--output PATH] [--force] [--list]\n`;

    const emitError = (msg: string): never => {
        err.write(usage);
        err.write(`${prog}: error: ${msg}\n`);
        throw new ArgparseExit(2);
    };

    const args: Args = { tool: null, output: null, force: false, list: false };

    let i = 0;
    while (i < argv.length) {
        const tok = argv[i] as string;
        if (tok === '-h' || tok === '--help') {
            out.write(usage);
            throw new ArgparseExit(0);
        } else if (tok === '--tool') {
            const val: string | undefined = argv[i + 1];
            if (val === undefined) emitError('argument --tool: expected one argument');
            args.tool = val as string;
            i += 2;
        } else if (tok.startsWith('--tool=')) {
            args.tool = tok.slice('--tool='.length);
            i += 1;
        } else if (tok === '--output') {
            const val: string | undefined = argv[i + 1];
            if (val === undefined) emitError('argument --output: expected one argument');
            args.output = val as string;
            i += 2;
        } else if (tok.startsWith('--output=')) {
            args.output = tok.slice('--output='.length);
            i += 1;
        } else if (tok === '--force') {
            args.force = true;
            i += 1;
        } else if (tok === '--list') {
            args.list = true;
            i += 1;
        } else {
            emitError(`unrecognized arguments: ${tok}`);
        }
    }
    return args;
}

/** Python `Path(p).expanduser()` — expand a leading `~` / `~user`. */
function _expanduser(p: string): string {
    if (p === '~' || p.startsWith('~/')) {
        return path.join(os.homedir(), p.slice(1));
    }
    if (p === '~' + path.sep || p.startsWith('~' + path.sep)) {
        return path.join(os.homedir(), p.slice(1));
    }
    return p;
}

interface MainOptions {
    out?: OutSink;
    err?: OutSink;
}

export function main(argv: string[] | null = null, options: MainOptions = {}): number {
    const out = options.out ?? _stdoutSink();
    const err = options.err ?? _stderrSink();
    const args = _parse(argv ?? process.argv.slice(2), out, err);

    if (args.list) {
        return _list_tools(out);
    }
    if (!args.tool) {
        _print(err, '❌  --tool is required (see --list for the catalog).');
        return 2;
    }
    if (!args.output) {
        _print(err, '❌  --output is required (no canonical-path defaults).');
        return 2;
    }

    const entry = EXPORT_REGISTRY[args.tool];
    if (entry === undefined) {
        _print(err, `❌  unknown tool: ${args.tool} (see --list)`);
        return 2;
    }

    const [, provider] = entry;
    let content: string;
    try {
        content = provider();
    } catch (exc) {
        if (exc instanceof FileNotFoundError) {
            _print(err, `❌  ${exc.message}`);
            return 1;
        }
        throw exc;
    }

    const output = path.resolve(_expanduser(args.output));
    return _write(output, content, { force: args.force, out, err });
}

// CLI entry guard — set process.exitCode; never call process.exit().
// Python: `if __name__ == "__main__": sys.exit(main())` (argparse reads
// sys.argv[1:] inside the parser default).
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
