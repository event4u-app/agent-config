#!/usr/bin/env node
/**
 * Measure markitdown's token-saving lift on the bundled corpus.
 *
 * TypeScript twin of `src/scripts/measure_markitdown_lift.py` (ADR-096 —
 * Python→TS migration, Phase 8 / Wave 8c). Mirrors the CLI contract EXACTLY:
 * flags (`--convert`, `--binary`), exit codes (0 baseline / 2 corpus missing /
 * 3 --convert without the binary on PATH), byte-identical stdout/stderr. No
 * behaviour changes.
 *
 * Runs against `tests/fixtures/markitdown-corpus/`. By default (no flags) the
 * script computes the baseline-only — raw byte size and a tokens-per-4-bytes
 * estimate — without calling `markitdown-mcp`. With `--convert`, the script
 * tries to invoke `markitdown` (CLI binary) via subprocess and computes the
 * converted-Markdown token estimate plus the ratio per file.
 *
 * Never installs anything. Never invokes a network host. Never calls
 * `markitdown-mcp` over HTTP — only through the `markitdown` CLI on the
 * user's PATH (peer-side install per the skill's Step 1 recipes).
 *
 * Exit codes:
 *   0  — baseline produced (always, when fixtures exist)
 *   2  — corpus not found
 *   3  — `--convert` was requested but `markitdown` is not on PATH
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/measure_markitdown_lift.ts → parents[2] is the repo root.
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const CORPUS = path.join(REPO_ROOT, 'tests', 'fixtures', 'markitdown-corpus');
const TOKEN_PER_BYTES = 4; // rough OpenAI/Anthropic tokenizer-of-thumb

function _baselineTokens(p: string): number {
    return Math.max(1, Math.floor(fs.statSync(p).size / TOKEN_PER_BYTES));
}

function _convertedTokens(p: string, binary: string): number | null {
    let out;
    try {
        out = spawnSync(binary, [p], {
            encoding: 'utf-8',
            timeout: 30000,
        });
    } catch {
        return null;
    }
    if (out.error) {
        // OSError / timeout equivalent.
        return null;
    }
    if (out.status !== 0) {
        return null;
    }
    const stdout = out.stdout ?? '';
    const chars = _pyLen(stdout);
    if (chars === 0) {
        return null;
    }
    return Math.max(1, Math.floor(chars / TOKEN_PER_BYTES));
}

function _formatRatio(baseline: number, converted: number | null): string {
    if (converted === null || converted === 0) {
        return '—';
    }
    const ratio = baseline / converted;
    return `${_pyFixed(ratio, 1)}×`;
}

interface Args {
    convert: boolean;
    binary: string;
}

function parse_args(argv: string[]): Args {
    const args: Args = { convert: false, binary: 'markitdown' };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]!;
        if (a === '--convert') {
            args.convert = true;
        } else if (a === '--binary') {
            args.binary = argv[++i] ?? '';
        } else if (a.startsWith('--binary=')) {
            args.binary = a.slice('--binary='.length);
        } else {
            process.stderr.write(`measure_markitdown_lift: error: unrecognized arguments: ${a}\n`);
            process.exitCode = 2;
            throw new ArgExit();
        }
    }
    return args;
}

class ArgExit extends Error {}

export function main(argv: string[] | null = null): number {
    const rawArgv = argv ?? process.argv.slice(2);
    const args = parse_args(rawArgv);

    if (!_isDir(CORPUS)) {
        process.stderr.write(`ERROR: corpus not found at ${CORPUS}\n`);
        process.stderr.write(
            'Generate it: python3 tests/fixtures/markitdown-corpus/_generate.py\n',
        );
        return 2;
    }

    const fixtures = _iterdir(CORPUS)
        .filter((p) => _isFile(p) && _hasSuffix(p, ['.pdf', '.pptx', '.docx', '.xlsx']))
        .sort(_pyStrCmp);
    if (fixtures.length === 0) {
        process.stderr.write(`ERROR: no fixtures in ${CORPUS}\n`);
        return 2;
    }

    let binaryPath: string | null = null;
    if (args.convert) {
        binaryPath = _which(args.binary);
        if (binaryPath === null) {
            process.stderr.write(
                `ERROR: --convert requested but \`${args.binary}\` not on PATH.\n` +
                    'Install peer-side per the skill\'s Step 1 recipes ' +
                    '(Docker / pipx / uv) and re-run.\n',
            );
            return 3;
        }
    }

    process.stdout.write(`Corpus: ${_relPosix(CORPUS, REPO_ROOT)}  (${fixtures.length} files)\n`);
    process.stdout.write(`Mode:   ${binaryPath ? 'convert (peer markitdown CLI)' : 'baseline-only'}\n`);
    if (binaryPath) {
        process.stdout.write(`Binary: ${binaryPath}\n`);
    }
    process.stdout.write('\n');
    const header =
        `${_ljust('fixture', 32)} ${_rjust('bytes', 7)} ${_rjust('baseline tok', 13)} ` +
        `${_rjust('converted tok', 14)} ${_rjust('ratio', 7)}`;
    process.stdout.write(header + '\n');
    process.stdout.write('-'.repeat(_pyLen(header)) + '\n');
    for (const p of fixtures) {
        const size = fs.statSync(p).size;
        const base = _baselineTokens(p);
        const converted = binaryPath ? _convertedTokens(p, binaryPath) : null;
        const ratio = _formatRatio(base, converted);
        const convStr = converted !== null ? `${converted}` : '—';
        process.stdout.write(
            `${_ljust(path.basename(p), 32)} ${_rjust(String(size), 7)} ` +
                `${_rjust(String(base), 13)} ${_rjust(convStr, 14)} ${_rjust(ratio, 7)}\n`,
        );
    }
    process.stdout.write('\n');
    if (!binaryPath) {
        process.stdout.write(
            'Re-run with --convert (after installing markitdown-mcp peer-side per the skill\'s ' +
                'Step 1 recipes) for the actual ratio.\n',
        );
    }
    return 0;
}

// --- Python helpers ----------------------------------------------------------

/** str.format with `:.Nf` — round-half-to-even, fixed N decimals. */
function _pyFixed(x: number, ndigits: number): string {
    if (!Number.isFinite(x)) {
        return String(x);
    }
    const neg = x < 0 || Object.is(x, -0);
    const abs = Math.abs(x);
    const factor = Math.pow(10, ndigits);
    const scaled = abs * factor;
    const floor = Math.floor(scaled);
    const frac = scaled - floor;
    const tol = Math.max(Math.abs(scaled), 1) * 2 ** -40;
    let rounded: number;
    if (Math.abs(frac - 0.5) <= tol) {
        rounded = floor % 2 === 0 ? floor : floor + 1;
    } else {
        rounded = Math.round(scaled);
    }
    let intStr = String(rounded);
    let result: string;
    if (ndigits === 0) {
        result = intStr;
    } else {
        if (intStr.length <= ndigits) {
            intStr = '0'.repeat(ndigits - intStr.length + 1) + intStr;
        }
        const whole = intStr.slice(0, intStr.length - ndigits);
        const dec = intStr.slice(intStr.length - ndigits);
        result = `${whole}.${dec}`;
    }
    return neg ? `-${result}` : result;
}

/** Unicode code-point count (Python len), not UTF-16 .length. */
function _pyLen(s: string): number {
    return Array.from(s).length;
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function _iterdir(dir: string): string[] {
    return fs.readdirSync(dir).map((n) => path.join(dir, n));
}

function _hasSuffix(p: string, suffixes: string[]): boolean {
    const ext = path.extname(p);
    return suffixes.includes(ext);
}

/** shutil.which — resolve a binary name on PATH, or return null. */
function _which(cmd: string): string | null {
    if (cmd.includes(path.sep) || cmd.includes('/')) {
        // Explicit path: check it directly.
        return _isExecutable(cmd) ? cmd : null;
    }
    const pathEnv = process.env['PATH'] ?? '';
    const dirs = pathEnv.split(path.delimiter);
    const exts = process.platform === 'win32' ? (process.env['PATHEXT'] ?? '').split(';') : [''];
    for (const dir of dirs) {
        if (!dir) continue;
        for (const ext of exts) {
            const candidate = path.join(dir, cmd + ext);
            if (_isExecutable(candidate)) {
                return candidate;
            }
        }
    }
    return null;
}

function _isExecutable(p: string): boolean {
    try {
        const st = fs.statSync(p);
        if (!st.isFile()) return false;
        if (process.platform === 'win32') return true;
        return (st.mode & 0o111) !== 0;
    } catch {
        return false;
    }
}

function _ljust(s: string, width: number): string {
    const len = _pyLen(s);
    return len >= width ? s : s + ' '.repeat(width - len);
}

function _rjust(s: string, width: number): string {
    const len = _pyLen(s);
    return len >= width ? s : ' '.repeat(width - len) + s;
}

function _relPosix(p: string, base: string): string {
    return path.relative(base, p).split(path.sep).join('/');
}

function _pyStrCmp(a: string, b: string): number {
    const ca = Array.from(a);
    const cb = Array.from(b);
    const n = Math.min(ca.length, cb.length);
    for (let i = 0; i < n; i++) {
        const x = ca[i]!.codePointAt(0)!;
        const y = cb[i]!.codePointAt(0)!;
        if (x !== y) return x - y;
    }
    return ca.length - cb.length;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    try {
        process.exitCode = main();
    } catch (e) {
        if (e instanceof ArgExit) {
            process.exitCode = process.exitCode ?? 2;
        } else {
            throw e;
        }
    }
}
