#!/usr/bin/env tsx
/**
 * Propose a `modules:` block for `.agent-project-settings.yml`.
 *
 * TypeScript twin of `src/scripts/propose_modules_config.py` (ADR-200,
 * Phase 8 / Wave 8g). Mirrors the Python CLI contract EXACTLY — `--project`
 * / `--json` flags, the interactive numbered-options TTY block, the
 * machine-readable JSON envelope (byte-identical to `json.dump(indent=2)`),
 * exit codes (0 always on success, 2 unreachable path), stdout/stderr split.
 * Pure read-only scan; never writes files. No behaviour changes.
 *
 * Wraps the pure `_lib/module_detection.detect_module_roots` helper in a CLI
 * surface that the installer, the GUI wizard, and the `/agents init` command
 * can all call without re-implementing the detection table.
 *
 * Usage:
 *   propose_modules_config.ts                  # interactive
 *   propose_modules_config.ts --json           # machine-readable
 *   propose_modules_config.ts --project <path> # custom root
 *
 * Exit codes:
 *   0 — candidates surfaced (or none found, with `modules.enabled: false`)
 *   2 — invalid arguments / unreachable path
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    detect_module_roots,
    type ModuleCandidate,
} from './_lib/module_detection.js';

const _HERE = fileURLToPath(import.meta.url);

function _candidate_to_dict(cand: ModuleCandidate): Record<string, string> {
    return {
        path: cand.path,
        stack: cand.stack,
        namespace_template_guess: cand.namespace_template_guess,
        confidence: cand.confidence,
    };
}

/** Python `str.ljust(width)` — left-justify, pad with spaces, no truncation. */
function _ljust(value: string, width: number): string {
    return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

/** Python `f"{n:>1}"` — right-justify to min width 1 (no-op for ≥ 1 digit). */
function _rjust(value: string, width: number): string {
    return value.length >= width ? value : ' '.repeat(width - value.length) + value;
}

/**
 * Print a numbered-options block — the same shape `/agents init` shows.
 * Mirror of `_render_interactive`.
 */
function _render_interactive(candidates: ModuleCandidate[]): void {
    if (candidates.length === 0) {
        process.stdout.write('⚠️  No module roots detected.\n');
        process.stdout.write('\n');
        process.stdout.write(
            'Skipping `modules:` config. Re-run after adding a module ' +
                'directory (app/Modules/, src/Module/, packages/, internal/, ...).\n',
        );
        return;
    }
    process.stdout.write('📦 Detected module-root candidates:\n');
    process.stdout.write('\n');
    process.stdout.write(
        '  #  Path              Stack            Confidence  Namespace template\n',
    );
    process.stdout.write(
        '  ─  ────────────────  ───────────────  ──────────  ────────────────────\n',
    );
    candidates.forEach((cand, idx0) => {
        const idx = idx0 + 1;
        const ns = cand.namespace_template_guess || '—';
        process.stdout.write(
            `  ${_rjust(String(idx), 1)}  ${_ljust(cand.path, 16)}  ${_ljust(cand.stack, 15)}` +
                `  ${_ljust(cand.confidence, 10)}  ${ns}\n`,
        );
    });
    process.stdout.write('\n');
    process.stdout.write(
        'Suggested `modules:` block (paste into .agent-project-settings.yml):\n',
    );
    process.stdout.write('\n');
    process.stdout.write('modules:\n');
    process.stdout.write('  enabled: true\n');
    process.stdout.write(
        `  root_paths: [${candidates.map((c) => c.path).join(', ')}]\n`,
    );
    const primary_ns =
        candidates.find((c) => c.namespace_template_guess)?.namespace_template_guess ?? '';
    if (primary_ns) {
        process.stdout.write(`  namespace_template: '${primary_ns}'\n`);
    } else {
        process.stdout.write(
            "  # namespace_template: ''  # stack has no PHP-style namespace\n",
        );
    }
    process.stdout.write('  agent_folder: agents\n');
    process.stdout.write('  skip_dirs: [.module-template, .example]\n');
}

/** Mirror of `Path(arg).expanduser().resolve()` + is_dir() check. */
function _resolve_project_root(arg: string | null): string {
    let root: string;
    if (arg) {
        root = _resolvePath(_expanduser(arg));
    } else {
        root = _resolvePath(process.cwd());
    }
    let isDir = false;
    try {
        isDir = fs.statSync(root).isDirectory();
    } catch {
        isDir = false;
    }
    if (!isDir) {
        process.stderr.write(`error: project root is not a directory: ${root}\n`);
        process.exit(2);
    }
    return root;
}

/** Python `Path.expanduser()` — only a leading `~` / `~user`. */
function _expanduser(p: string): string {
    if (!p.startsWith('~')) {
        return p;
    }
    const sep = p.indexOf('/');
    const head = sep === -1 ? p : p.slice(0, sep);
    const tail = sep === -1 ? '' : p.slice(sep);
    if (head === '~') {
        return os.homedir() + tail;
    }
    // ~user — not expanded in this faithful port (rare; Python would resolve
    // via pwd). Leave untouched, matching the common path where it is absent.
    return p;
}

/**
 * Mirror Python pathlib `.resolve()` — absolute, symlink-following, with a
 * prefix-resolution fallback for non-existent leaves. On macOS this turns
 * `/var/...` into `/private/var/...` exactly as `Path.resolve()` does.
 */
function _resolvePath(p: string): string {
    const abs = path.resolve(p);
    try {
        return fs.realpathSync(abs);
    } catch {
        // fall through to prefix resolution
    }
    let cur = abs;
    const tail: string[] = [];
    for (;;) {
        const parent = path.dirname(cur);
        if (parent === cur) {
            return abs;
        }
        tail.push(path.basename(cur));
        cur = parent;
        try {
            const base = fs.realpathSync(cur);
            tail.reverse();
            return path.join(base, ...tail);
        } catch {
            // keep walking up
        }
    }
}

/**
 * Serialize like Python `json.dump(payload, sys.stdout, indent=2)` —
 * `ensure_ascii=True`, 2-space indent, `: ` kv-sep, `,\n` item-sep, inline
 * `[]`. A namespace-template guess could carry non-ASCII, so escape it the
 * way Python does rather than trust `JSON.stringify`'s raw-UTF-8 output.
 */
function _pyJsonDumpIndent2(obj: unknown): string {
    return _dumpValue(obj, 0);
}

function _dumpValue(value: unknown, depth: number): string {
    const pad = '  '.repeat(depth);
    const padInner = '  '.repeat(depth + 1);
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'string') return _dumpString(value);
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        const items = value.map((v) => padInner + _dumpValue(v, depth + 1));
        return '[\n' + items.join(',\n') + '\n' + pad + ']';
    }
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    const items = entries.map(
        ([k, v]) => padInner + _dumpString(k) + ': ' + _dumpValue(v, depth + 1),
    );
    return '{\n' + items.join(',\n') + '\n' + pad + '}';
}

function _dumpString(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        if (ch === '"') out += '\\"';
        else if (ch === '\\') out += '\\\\';
        else if (ch === '\n') out += '\\n';
        else if (ch === '\r') out += '\\r';
        else if (ch === '\t') out += '\\t';
        else if (ch === '\b') out += '\\b';
        else if (ch === '\f') out += '\\f';
        else if (code < 0x20) out += '\\u' + code.toString(16).padStart(4, '0');
        else if (code < 0x7f) out += ch;
        else if (code <= 0xffff) out += '\\u' + code.toString(16).padStart(4, '0');
        else {
            const v = code - 0x10000;
            const hi = 0xd800 + (v >> 10);
            const lo = 0xdc00 + (v & 0x3ff);
            out += '\\u' + hi.toString(16).padStart(4, '0');
            out += '\\u' + lo.toString(16).padStart(4, '0');
        }
    }
    return out + '"';
}

interface ParsedArgs {
    project: string | null;
    json: boolean;
}

function _argparse_error(message: string): never {
    process.stderr.write(
        `usage: propose_modules_config.py [-h] [--project PROJECT] [--json]\n`,
    );
    process.stderr.write(`propose_modules_config.py: error: ${message}\n`);
    process.exit(2);
}

function parse_args(argv: readonly string[]): ParsedArgs {
    let project: string | null = null;
    let json = false;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (arg === '--project') {
            const v = argv[++i];
            if (v === undefined) {
                _argparse_error('argument --project: expected one argument');
            }
            project = v;
        } else if (arg.startsWith('--project=')) {
            project = arg.slice('--project='.length);
        } else if (arg === '--json') {
            json = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: propose_modules_config.py [-h] [--project PROJECT] [--json]\n',
            );
            process.exit(0);
        } else {
            _argparse_error(`unrecognized arguments: ${arg}`);
        }
    }
    return { project, json };
}

function main(argv?: readonly string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    const root = _resolve_project_root(args.project);
    const candidates = detect_module_roots(root);
    if (args.json) {
        const primary_ns =
            candidates.find((c) => c.namespace_template_guess)?.namespace_template_guess ?? '';
        const payload = {
            project_root: root,
            candidates: candidates.map(_candidate_to_dict),
            proposed_block: {
                enabled: candidates.length > 0,
                root_paths: candidates.map((c) => c.path),
                namespace_template: primary_ns,
                agent_folder: 'agents',
                skip_dirs: ['.module-template', '.example'],
            },
        };
        process.stdout.write(_pyJsonDumpIndent2(payload));
        process.stdout.write('\n');
        return 0;
    }
    _render_interactive(candidates);
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exitCode = main();
}

export {
    _candidate_to_dict,
    _render_interactive,
    _resolve_project_root,
    main,
};
