#!/usr/bin/env tsx
/**
 * Coverage forcing-function — WARN-only (R3 of road-to-test-and-gate-integrity).
 *
 * TypeScript twin of `src/scripts/check_test_coverage_diff.py` (ADR-094,
 * Phase 4 / Wave 4c). Mirrors the Python CLI contract EXACTLY — `--base-ref`
 * flag, always exit 0 (warn-only by contract), stdout, byte-identical
 * messages, the git name-status read, the pragma scan, and the `evaluate`
 * core logic. No behaviour changes — latent matcher quirks replicated.
 *
 * WARN when a NEW `src/scripts/{check,lint}_*.py` gate is added with no
 * matching new/changed test in the same diff and no in-file pragma.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

// Injectable for tests (monkeypatch parity): REPO_ROOT, _git_name_status,
// _pragma_reason_from_tree.
let REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

const GATE_RE = /^src\/scripts\/(?:check_|lint_)[A-Za-z0-9_]+\.py$/;
const PRAGMA_RE = /#\s*coverage-diff-ignore:\s*(\S.*?)\s*$/;
const _PRAGMA_SCAN_LINES = 60;

type Changed = ReadonlyArray<[string, string]>;
type PragmaReason = (path: string) => string | null;

function _is_test_file(p: string): boolean {
    if (!(p.startsWith('tests/') && p.endsWith('.py'))) {
        return false;
    }
    const stem = _stem(p);
    return stem.startsWith('test_') || stem.endsWith('_test');
}

/** Mirror Python `Path(p).stem` — basename without the final suffix. */
function _stem(p: string): string {
    const base = p.split('/').pop() ?? p;
    const dot = base.lastIndexOf('.');
    return dot > 0 ? base.slice(0, dot) : base;
}

/** Mirror Python `str.removeprefix`. */
function _removeprefix(s: string, prefix: string): string {
    return s.startsWith(prefix) ? s.slice(prefix.length) : s;
}

/** Mirror Python `str.removesuffix`. */
function _removesuffix(s: string, suffix: string): string {
    return s.endsWith(suffix) ? s.slice(0, s.length - suffix.length) : s;
}

function _test_matches_gate(gate_path: string, test_paths: readonly string[]): boolean {
    const gate_stem = _stem(gate_path); // e.g. check_foo
    const short = _removeprefix(_removeprefix(gate_stem, 'check_'), 'lint_'); // foo
    for (const t of test_paths) {
        const tstem = _removesuffix(_removeprefix(_stem(t), 'test_'), '_test');
        // Replicate Python: `gate_stem in Path(t).stem or short and short in tstem`.
        if (_stem(t).includes(gate_stem) || (short !== '' && tstem.includes(short))) {
            return true;
        }
    }
    return false;
}

function evaluate(
    changed: Changed,
    pragma_reason: PragmaReason,
): [string[], Array<[string, string]>] {
    const new_gates = changed.filter(([s, p]) => s === 'A' && GATE_RE.test(p)).map(([, p]) => p);
    const test_changes = changed.filter(([, p]) => _is_test_file(p)).map(([, p]) => p);
    const warnings: string[] = [];
    const suppressed: Array<[string, string]> = [];
    for (const gate of new_gates) {
        if (_test_matches_gate(gate, test_changes)) {
            continue;
        }
        const reason = pragma_reason(gate);
        if (reason) {
            suppressed.push([gate, reason]);
        } else {
            warnings.push(gate);
        }
    }
    return [warnings, suppressed];
}

function _pragma_reason_from_tree(p: string): string | null {
    const f = path.join(REPO_ROOT, p);
    let head: string[];
    try {
        head = fs.readFileSync(f, 'utf-8').split('\n').slice(0, _PRAGMA_SCAN_LINES);
    } catch {
        return null;
    }
    for (const line of head) {
        const m = PRAGMA_RE.exec(line);
        if (m) {
            return m[1]!;
        }
    }
    return null;
}

function _resolve_base_ref(explicit: string | null): string {
    if (explicit) {
        return explicit;
    }
    for (const candidate of ['origin/main', 'origin/master', 'main', 'master']) {
        const res = spawnSync('git', ['rev-parse', '--verify', candidate], {
            stdio: ['ignore', 'ignore', 'ignore'],
        });
        if (res.status === 0) {
            return candidate;
        }
    }
    return 'HEAD~1';
}

function _git_name_status(base_ref: string): Array<[string, string]> {
    const res = spawnSync('git', ['diff', '--name-status', `${base_ref}...HEAD`], {
        encoding: 'utf-8',
    });
    if (res.status !== 0) {
        // Mirror Python: combined stdout+stderr (subprocess.STDOUT) .strip().
        const out = `${res.stdout ?? ''}${res.stderr ?? ''}`.trim();
        process.stderr.write(
            `⚠️  coverage-diff: git diff failed (${out}); skipping.\n`,
        );
        return [];
    }
    const rows: Array<[string, string]> = [];
    for (const line of (res.stdout ?? '').split('\n')) {
        const parts = line.split('\t');
        if (parts.length >= 2) {
            rows.push([parts[0]!.slice(0, 1), parts[parts.length - 1]!]);
        }
    }
    return rows;
}

interface ParsedArgs {
    base_ref: string | null;
}

function _argparse_error(message: string): never {
    process.stderr.write(`check_test_coverage_diff: error: ${message}\n`);
    process.exit(2);
}

function parse_args(argv: readonly string[]): ParsedArgs {
    let base_ref: string | null = null;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (arg === '--base-ref') {
            const v = argv[++i];
            if (v === undefined) {
                _argparse_error('argument --base-ref: expected one argument');
            }
            base_ref = v;
        } else if (arg.startsWith('--base-ref=')) {
            base_ref = arg.slice('--base-ref='.length);
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write('usage: check_test_coverage_diff [-h] [--base-ref BASE_REF]\n');
            process.exit(0);
        } else {
            _argparse_error(`unrecognized arguments: ${arg}`);
        }
    }
    return { base_ref };
}

function main(argv?: readonly string[]): number {
    const opts = parse_args(argv ?? process.argv.slice(2));
    const changed = _hooks.git_name_status(_resolve_base_ref(opts.base_ref));
    const [warnings, suppressed] = evaluate(changed, _hooks.pragma_reason_from_tree);
    if (warnings.length > 0) {
        process.stdout.write(
            '⚠️  coverage-diff: new gate(s) added with no matching test (warn-only):\n',
        );
        for (const g of warnings) {
            process.stdout.write(
                `    ${g} — add tests/test_${_stem(g)}.py, or a ` +
                    `\`# coverage-diff-ignore: <reason>\` line if no test is warranted.\n`,
            );
        }
    }
    for (const [g, reason] of suppressed) {
        process.stdout.write(`    (suppressed: ${g} — ${reason})\n`);
    }
    process.stdout.write(
        `coverage-diff: warned=${warnings.length} suppressed=${suppressed.length}\n`,
    );
    return 0; // warn-only by contract this phase
}

// Indirection layer so tests can monkeypatch _git_name_status /
// _pragma_reason_from_tree the way pytest does on the Python module.
const _hooks = {
    git_name_status: _git_name_status,
    pragma_reason_from_tree: _pragma_reason_from_tree,
};

function _set_repo_root_for_test(root: string): void {
    REPO_ROOT = root;
}

function _set_hooks_for_test(overrides: Partial<typeof _hooks>): void {
    Object.assign(_hooks, overrides);
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    GATE_RE,
    PRAGMA_RE,
    evaluate,
    _pragma_reason_from_tree,
    _git_name_status,
    _test_matches_gate,
    _is_test_file,
    main,
    _set_repo_root_for_test,
    _set_hooks_for_test,
};
