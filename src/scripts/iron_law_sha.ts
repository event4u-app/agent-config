#!/usr/bin/env node
/**
 * SHA-256 of every triple-fence block in a rule file (Iron Law preservation).
 *
 * TypeScript twin of `iron_law_sha.py` (Phase 8 / Wave 8e). Mirrors the
 * Python CLI contract byte-for-byte: flags, exit codes, stdout layout.
 *
 * Usage:
 *   node iron_law_sha.js <rule-id> [<rule-id> ...]
 *   node iron_law_sha.js --all-kernel
 *   node iron_law_sha.js --diff <rule-id> --against <baseline-sha>
 *
 * The Iron-Law block is delimited by triple-backtick fences. Every line
 * inside any fence in the file is concatenated, whitespace-normalised
 * (runs of spaces collapsed; leading / trailing whitespace stripped per
 * line), case-folded, then SHA-256-hashed. Empty fences hash to
 * SHA-256(''), which is `e3b0c442…` (the well-known empty-string hash).
 *
 * Acceptance per `road-to-kernel-and-router.md` P2.2: re-runnable,
 * deterministic, stdlib-only, no network. Condensation of a kernel rule
 * must preserve this SHA (or surface a deliberate ADR-tracked diff).
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { artefact_roots } from './_lib/agent_src.js';

const _HERE = fileURLToPath(import.meta.url);

// Pre-monorepo this was REPO_ROOT/.agent-src.uncondensed/rules. Post-move
// (ADR-017) the source rules live under packages/*/.agent-src.uncondensed/rules.
// Resolve the same way measure_rule_budget does (multi-root aware) so the
// Iron-Law SHA gate keeps working against the current layout.
function _rules_dirs(): string[] {
    const out: string[] = [];
    for (const root of artefact_roots()) {
        const dir = path.join(root, 'rules');
        if (_isDir(dir)) {
            out.push(dir);
        }
    }
    return out;
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

// Locked kernel set — kept in sync with measure_rule_budget.KERNEL_RULES.
const KERNEL_RULES: readonly string[] = [
    'agent-authority',
    'ask-when-uncertain',
    'commit-policy',
    'direct-answers',
    'language-and-tone',
    'no-cheap-questions',
    'non-destructive-by-default',
    'scope-control',
    'verify-before-complete',
];

// Python: re.compile(r"```(?:[^\n]*\n)([\s\S]*?)```")
const _FENCE_RE = /```(?:[^\n]*\n)([\s\S]*?)```/g;
// Python: re.compile(r"\s+")
const _WS_RE = /\s+/g;

/**
 * SHA-256 of all triple-fence content, whitespace-collapsed, upper-cased.
 *
 * Algorithm matches `scripts/_pilot_measure.py` exactly so the SHAs
 * recorded in `docs/contracts/kernel-membership.md` § 2 stay
 * reproducible across pre / post condensation.
 */
export function iron_law_sha(text: string): string {
    let norm = '';
    for (const m of text.matchAll(_FENCE_RE)) {
        const block = m[1] ?? '';
        // _WS_RE.sub(" ", b).strip().upper()
        const collapsed = block.replace(_WS_RE, ' ');
        norm += _pyStrip(collapsed).toUpperCase();
    }
    return crypto.createHash('sha256').update(Buffer.from(norm, 'utf-8')).digest('hex');
}

/** Python str.strip() (default whitespace). */
function _pyStrip(s: string): string {
    return s.replace(/^\s+/, '').replace(/\s+$/, '');
}

export function rule_sha(rule_id: string): string {
    for (const rules_dir of _rules_dirs()) {
        const p = path.join(rules_dir, `${rule_id}.md`);
        if (_isFile(p)) {
            return iron_law_sha(fs.readFileSync(p, 'utf-8'));
        }
    }
    throw new FileNotFoundError(
        `${rule_id}.md not found under any artefact root's rules/`,
    );
}

/** Mirror Python FileNotFoundError so the message reaches stderr verbatim. */
class FileNotFoundError extends Error {}

const _DESCRIPTION_FIRST_LINE =
    'SHA-256 of every triple-fence block in a rule file (Iron Law preservation).';

function _argError(msg: string): never {
    // argparse usage line + error line, exit 2.
    process.stderr.write(
        'usage: iron_law_sha.py [-h] [--all-kernel] [--diff RULE] [--against SHA]\n' +
            '                       [rules ...]\n',
    );
    process.stderr.write(`iron_law_sha.py: error: ${msg}\n`);
    process.exit(2);
}

interface ParsedArgs {
    rules: string[];
    all_kernel: boolean;
    diff: string | null;
    against: string | null;
}

function parse_args(argv: string[]): ParsedArgs {
    const out: ParsedArgs = { rules: [], all_kernel: false, diff: null, against: null };
    let i = 0;
    while (i < argv.length) {
        const a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(_DESCRIPTION_FIRST_LINE + '\n');
            process.exit(0);
        } else if (a === '--all-kernel') {
            out.all_kernel = true;
        } else if (a === '--diff') {
            const v = argv[i + 1];
            if (v === undefined) {
                _argError('argument --diff: expected one argument');
            }
            out.diff = v as string;
            i += 1;
        } else if (a.startsWith('--diff=')) {
            out.diff = a.slice('--diff='.length);
        } else if (a === '--against') {
            const v = argv[i + 1];
            if (v === undefined) {
                _argError('argument --against: expected one argument');
            }
            out.against = v as string;
            i += 1;
        } else if (a.startsWith('--against=')) {
            out.against = a.slice('--against='.length);
        } else if (a.startsWith('-') && a !== '-') {
            _argError(`unrecognized arguments: ${a}`);
        } else {
            out.rules.push(a);
        }
        i += 1;
    }
    return out;
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    if (args.diff !== null) {
        if (args.against === null) {
            _argError('--diff requires --against');
        }
        const actual = rule_sha(args.diff);
        const match = actual === args.against;
        const symbol = match ? '✅' : '❌';
        process.stdout.write(`${symbol}  ${args.diff}: ${actual}  (expected ${args.against})\n`);
        return match ? 0 : 1;
    }

    const targets = args.all_kernel ? [...KERNEL_RULES] : args.rules;
    if (targets.length === 0) {
        _argError('provide rule ids, or use --all-kernel');
    }

    const width = Math.max(...targets.map((t) => _pyLen(t)));
    for (const rid of targets) {
        const sha = rule_sha(rid);
        process.stdout.write(`${_ljust(rid, width)}  ${sha}\n`);
    }
    return 0;
}

/** Python len() — code-point count. */
function _pyLen(s: string): number {
    let n = 0;
    for (const _ of s) n += 1;
    return n;
}

/** Python str.ljust(width) — pad with spaces to code-point width. */
function _ljust(s: string, width: number): string {
    const pad = width - _pyLen(s);
    return pad > 0 ? s + ' '.repeat(pad) : s;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    try {
        process.exitCode = main();
    } catch (err) {
        // Mirror Python: an uncaught FileNotFoundError prints a traceback and
        // exits non-zero. We surface the message and exit 1.
        if (err instanceof FileNotFoundError) {
            process.stderr.write(`FileNotFoundError: ${err.message}\n`);
            process.exitCode = 1;
        } else {
            throw err;
        }
    }
}
