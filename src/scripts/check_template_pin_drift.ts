#!/usr/bin/env tsx
/**
 * Fail when `package.json.version` and the project-template pin drift.
 *
 * TypeScript twin of `src/scripts/check_template_pin_drift.py` (ADR-090,
 * Phase 4 / Wave 4c). CLI contract mirrored EXACTLY — `--allow-empty`
 * flag, exit codes (0 match / empty-allowed, 1 drift / missing / unreadable),
 * byte-identical messages, stdout/stderr split, same template-file
 * resolution (resolve_logical + condensed twin).
 *
 * CI guard for P3.3 of road-to-portable-runtime-and-update-check.md.
 *
 * A release bump of `package.json` must update `agent_config_version` in
 * the project-settings example template (and its condensed twin under
 * `dist/agent-src/`) in lockstep. Otherwise a fresh `init` on a new
 * project would bootstrap onto a stale pin, and the pin-resolver would
 * re-exec back to the older version.
 *
 * Exit codes:
 *     0 — pin matches package.json.version (or pin is empty and the
 *         `--allow-empty` flag is set, used for early development).
 *     1 — pin missing, drift detected, or template file unreadable.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resolve_logical } from './_lib/agent_src.js';

const _HERE = fileURLToPath(import.meta.url);
// Python `Path(__file__).resolve().parents[2]` — two dirs up from src/scripts.
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

const PACKAGE_JSON = path.join(REPO_ROOT, 'package.json');

// Source-of-truth template lives under whichever artefact root owns it
// (legacy .agent-src.uncondensed/ pre-move, packages/*/.agent-src.uncondensed/
// post-ADR-017). Condensed twin always lands at the flat dist/agent-src/ surface.
const _TEMPLATE_LOGICAL = 'templates/agents/agent-project-settings.example.yml';

const PIN_LINE_RE = /^\s*agent_config_version\s*:\s*"?([^"\s#]*)"?/;

function _template_files(): string[] {
    const src = resolve_logical(_TEMPLATE_LOGICAL);
    const files: string[] = [];
    if (src !== null) {
        files.push(src);
    } else {
        files.push(path.join(REPO_ROOT, '.agent-src.uncondensed', _TEMPLATE_LOGICAL));
    }
    files.push(path.join(REPO_ROOT, 'dist/agent-src', _TEMPLATE_LOGICAL));
    return files;
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** POSIX relative path of `child` under `root`, or the absolute path on failure. */
function _relToPosixOrAbs(child: string, root: string): string {
    const rel = path.relative(root, child);
    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
        return child;
    }
    return rel.split(path.sep).join('/');
}

function _read_package_version(): string | null {
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8')) as Record<string, unknown>;
    } catch {
        return null;
    }
    const version = data['version'];
    return typeof version === 'string' ? version.trim() : null;
}

/** Mirror Python `str.splitlines()` — splits on \n / \r\n / \r, drops trailing. */
function _splitlines(text: string): string[] {
    if (text === '') return [];
    const parts = text.split(/\r\n|\r|\n/);
    if (parts.length > 0 && parts[parts.length - 1] === '') {
        parts.pop();
    }
    return parts;
}

function _read_template_pin(p: string): string | null {
    let text: string;
    try {
        text = fs.readFileSync(p, 'utf-8');
    } catch {
        return null;
    }
    for (const line of _splitlines(text)) {
        const match = PIN_LINE_RE.exec(line);
        if (match) {
            return match[1]!.trim();
        }
    }
    return null;
}

/** Python `repr()` of a single string. */
function _pyRepr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let out = quote;
    for (const ch of s) {
        if (ch === '\\') out += '\\\\';
        else if (ch === quote) out += '\\' + ch;
        else if (ch === '\n') out += '\\n';
        else if (ch === '\r') out += '\\r';
        else if (ch === '\t') out += '\\t';
        else out += ch;
    }
    return out + quote;
}

interface ParsedArgs {
    allow_empty: boolean;
}

function _argparse_error(message: string): never {
    process.stderr.write(`check_template_pin_drift: error: ${message}\n`);
    process.exit(2);
}

function parse_args(argv: readonly string[]): ParsedArgs {
    let allow_empty = false;
    for (const arg of argv) {
        if (arg === '--allow-empty') {
            allow_empty = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write('usage: check_template_pin_drift [-h] [--allow-empty]\n');
            process.exit(0);
        } else {
            _argparse_error(`unrecognized arguments: ${arg}`);
        }
    }
    return { allow_empty };
}

function main(argv: readonly string[] = []): number {
    const args = parse_args(argv);

    const pkg_version = _read_package_version();
    if (!pkg_version) {
        process.stderr.write(
            '❌  check_template_pin_drift: failed to read package.json version.\n',
        );
        return 1;
    }

    const failures: string[] = [];
    for (const template of _template_files()) {
        const rel = _relToPosixOrAbs(template, REPO_ROOT);
        if (!_isFile(template)) {
            failures.push(`missing template file: ${rel}`);
            continue;
        }
        const pin = _read_template_pin(template);
        if (pin === null) {
            failures.push(`${rel}: no \`agent_config_version:\` line found`);
            continue;
        }
        if (pin === '') {
            if (!args.allow_empty) {
                failures.push(`${rel}: agent_config_version is empty; expected ${pkg_version}`);
            }
            continue;
        }
        if (pin !== pkg_version) {
            failures.push(
                `${rel}: agent_config_version=${_pyRepr(pin)} does not match ` +
                    `package.json version ${_pyRepr(pkg_version)}`,
            );
        }
    }

    if (failures.length > 0) {
        process.stderr.write(
            '❌  check_template_pin_drift: template pin drift detected.\n',
        );
        for (const line of failures) {
            process.stderr.write(`    - ${line}\n`);
        }
        process.stderr.write(
            '    Fix: update `agent_config_version:` in the listed template(s) to ' +
                `${_pyRepr(pkg_version)} before releasing.\n`,
        );
        return 1;
    }

    process.stdout.write(`✅  template pin = package.json version (${pkg_version}).\n`);
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main(process.argv.slice(2)));
}

export {
    REPO_ROOT,
    PACKAGE_JSON,
    PIN_LINE_RE,
    _template_files,
    _read_package_version,
    _read_template_pin,
    parse_args,
    main,
};
