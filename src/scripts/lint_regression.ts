#!/usr/bin/env tsx
/**
 * Detect lint regressions between the current branch and a baseline.
 *
 * TypeScript twin of `src/scripts/lint_regression.py` (ADR-092,
 * Phase 4 / Wave 4b). The CLI contract is mirrored EXACTLY — `--baseline`
 * / `--format` / `--repo-root` flags, exit codes (0 clean, 1 regressions /
 * new-files, 2 bad baseline / disjoint-result guard), stdout/stderr split,
 * byte-identical report text (text / json / markdown), the same disjoint
 * sanity guard, and the same worktree-based baseline strategy. snake_case
 * kept. No behaviour changes — latent bugs replicated.
 *
 * Runs skill_linter --all --format json on both the baseline (via a temp
 * `git worktree`) and the working tree, then compares results to find new
 * failures, status downgrades (regressions), new files with issues, and
 * status upgrades (improvements).
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

interface FileEntry {
    status: string;
    codes: Set<string>;
}
type StatusMap = Record<string, FileEntry>;

interface RegressionDelta {
    file: string;
    was: string;
    now: string;
    new_codes: string[];
}
interface ImprovementDelta {
    file: string;
    was: string;
    now: string;
    removed_codes: string[];
}
interface NewFileDelta {
    file: string;
    status: string;
    codes: string[];
}
interface Delta {
    regressions: RegressionDelta[];
    improvements: ImprovementDelta[];
    new_files: NewFileDelta[];
}

interface LinterJson {
    results?: Array<{ file: string; status: string; issues?: Array<{ code: string }> }>;
    summary?: Record<string, unknown>;
}

const STATUS_ORDER: Record<string, number> = { pass: 0, pass_with_warnings: 1, fail: 2 };

/** Custom error carrying the Python CalledProcessError semantics for the
 * baseline worktree-add failure (→ exit 2 in main). */
class CalledProcessError extends Error {}

/** Run the linter and return parsed JSON. If ref is null, run on working tree.
 *
 * Mirrors `run_linter_json`: for a ref, add a detached temp worktree, run the
 * BASELINE worktree's own copy of skill_linter (artefact discovery anchored at
 * the script location, not --repo-root — the PR #466 fix), then remove it. */
function run_linter_json(ref: string | null, repo_root: string): LinterJson {
    if (ref) {
        const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-baseline-'));
        const added = spawnSync(
            'git',
            ['-C', repo_root, 'worktree', 'add', '--detach', tmpdir, ref],
            { encoding: 'utf8' },
        );
        if (added.status !== 0) {
            // Best-effort cleanup of a partially-created worktree dir.
            try {
                fs.rmSync(tmpdir, { recursive: true, force: true });
            } catch {
                /* ignore */
            }
            throw new CalledProcessError(
                `git worktree add failed for '${ref}': ${added.stderr ?? ''}`,
            );
        }
        try {
            let baseline_linter = path.join(tmpdir, 'src', 'scripts', 'skill_linter.py');
            if (!_isFile(baseline_linter)) {
                // Pre-src-move baselines kept the linter under scripts/.
                baseline_linter = path.join(tmpdir, 'scripts', 'skill_linter.py');
            }
            if (!_isFile(baseline_linter)) {
                process.stderr.write(
                    `Warning: no skill_linter.py in baseline '${ref}' — ` +
                        `baseline treated as empty.\n`,
                );
                return { results: [], summary: {} };
            }
            const result = spawnSync(
                'python3',
                [baseline_linter, '--all', '--format', 'json', '--repo-root', tmpdir],
                { cwd: tmpdir, encoding: 'utf8' },
            );
            const out = result.stdout ?? '';
            return out.trim() ? (JSON.parse(out) as LinterJson) : { results: [], summary: {} };
        } finally {
            spawnSync('git', ['-C', repo_root, 'worktree', 'remove', '--force', tmpdir], {
                encoding: 'utf8',
            });
        }
    }
    const cmd = path.join(repo_root, 'src', 'scripts', 'skill_linter.py');
    const result = spawnSync(
        'python3',
        [cmd, '--all', '--format', 'json', '--repo-root', repo_root],
        { cwd: repo_root, encoding: 'utf8' },
    );
    const out = result.stdout ?? '';
    return out.trim() ? (JSON.parse(out) as LinterJson) : { results: [], summary: {} };
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** Build {file: {status, codes}} from linter JSON output. */
function build_status_map(data: LinterJson): StatusMap {
    const result: StatusMap = {};
    for (const entry of data.results ?? []) {
        const codes = new Set<string>((entry.issues ?? []).map((i) => i.code));
        result[entry.file] = { status: entry.status, codes };
    }
    return result;
}

/** Compare baseline and current lint results. */
function compare(baseline: StatusMap, current: StatusMap): Delta {
    const regressions: RegressionDelta[] = [];
    const improvements: ImprovementDelta[] = [];
    const new_files: NewFileDelta[] = [];

    const all_files = [...new Set([...Object.keys(baseline), ...Object.keys(current)])].sort();

    for (const f of all_files) {
        const base = baseline[f];
        const curr = current[f];

        if (curr && !base) {
            if (curr.status !== 'pass') {
                new_files.push({
                    file: f,
                    status: curr.status,
                    codes: [...curr.codes].sort(),
                });
            }
            continue;
        }

        if (base && !curr) {
            continue; // File removed — not a regression
        }

        const b = base!;
        const c = curr!;
        const base_order = STATUS_ORDER[b.status] ?? 0;
        const curr_order = STATUS_ORDER[c.status] ?? 0;

        if (curr_order > base_order) {
            const new_codes = [...c.codes].filter((x) => !b.codes.has(x)).sort();
            regressions.push({ file: f, was: b.status, now: c.status, new_codes });
        } else if (curr_order < base_order) {
            const removed_codes = [...b.codes].filter((x) => !c.codes.has(x)).sort();
            improvements.push({ file: f, was: b.status, now: c.status, removed_codes });
        }
    }

    return { regressions, improvements, new_files };
}

function format_text(delta: Delta): string {
    const lines: string[] = ['=== Lint Regression Report ===', ''];

    if (delta.regressions.length === 0 && delta.new_files.length === 0) {
        lines.push('✅  No regressions detected.');
    } else {
        if (delta.regressions.length) {
            lines.push(`❌  ${delta.regressions.length} regression(s):`);
            for (const r of delta.regressions) {
                const codes = r.new_codes.length
                    ? r.new_codes.join(', ')
                    : '(same codes, stricter)';
                lines.push(`  ${r.file}: ${r.was} → ${r.now}  [${codes}]`);
            }
            lines.push('');
        }

        if (delta.new_files.length) {
            lines.push(`⚠️  ${delta.new_files.length} new file(s) with issues:`);
            for (const nf of delta.new_files) {
                lines.push(`  ${nf.file}: ${nf.status}  [${nf.codes.join(', ')}]`);
            }
            lines.push('');
        }
    }

    if (delta.improvements.length) {
        lines.push(`✅  ${delta.improvements.length} improvement(s):`);
        for (const imp of delta.improvements) {
            lines.push(`  ${imp.file}: ${imp.was} → ${imp.now}`);
        }
    }

    return lines.join('\n');
}

function format_markdown(delta: Delta): string {
    const lines: string[] = ['## 📊 Lint Regression Report', ''];

    if (delta.regressions.length === 0 && delta.new_files.length === 0) {
        lines.push('✅ No regressions detected.');
    } else {
        if (delta.regressions.length) {
            const n = delta.regressions.length;
            lines.push(
                '<details>',
                `<summary>❌ ${n} Regression${n !== 1 ? 's' : ''}</summary>`,
                '',
                '| File | Was | Now | New Issues |',
                '|---|---|---|---|',
            );
            for (const r of delta.regressions) {
                const codes = r.new_codes.length ? r.new_codes.join(', ') : '—';
                lines.push(`| \`${r.file}\` | ${r.was} | ${r.now} | ${codes} |`);
            }
            lines.push('', '</details>', '');
        }

        if (delta.new_files.length) {
            const n = delta.new_files.length;
            lines.push(
                '<details>',
                `<summary>⚠️ ${n} New file${n !== 1 ? 's' : ''} with issues</summary>`,
                '',
                '| File | Status | Issues |',
                '|---|---|---|',
            );
            for (const nf of delta.new_files) {
                lines.push(`| \`${nf.file}\` | ${nf.status} | ${nf.codes.join(', ')} |`);
            }
            lines.push('', '</details>', '');
        }
    }

    if (delta.improvements.length) {
        const n = delta.improvements.length;
        lines.push(
            '<details>',
            `<summary>✅ ${n} Improvement${n !== 1 ? 's' : ''}</summary>`,
            '',
            '| File | Was | Now |',
            '|---|---|---|',
        );
        for (const imp of delta.improvements) {
            lines.push(`| \`${imp.file}\` | ${imp.was} | ${imp.now} |`);
        }
        lines.push('', '</details>');
    }

    return lines.join('\n');
}

interface ParsedArgs {
    baseline: string;
    format: 'text' | 'json' | 'markdown';
    repo_root: string;
}

function parse_args(argv: readonly string[]): ParsedArgs {
    let baseline = 'main';
    let format: 'text' | 'json' | 'markdown' = 'text';
    let repo_root = '.';
    const takeValue = (i: number, name: string): [string, number] => {
        const v = argv[i + 1];
        if (v === undefined) {
            _argparse_error(`argument ${name}: expected one argument`);
        }
        return [v, i + 1];
    };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (arg === '--baseline') {
            [baseline, i] = takeValue(i, '--baseline');
        } else if (arg.startsWith('--baseline=')) {
            baseline = arg.slice('--baseline='.length);
        } else if (arg === '--format') {
            const [v, ni] = takeValue(i, '--format');
            i = ni;
            if (v !== 'text' && v !== 'json' && v !== 'markdown') {
                _argparse_error(
                    `argument --format: invalid choice: '${v}' (choose from 'text', 'json', 'markdown')`,
                );
            }
            format = v;
        } else if (arg.startsWith('--format=')) {
            const v = arg.slice('--format='.length);
            if (v !== 'text' && v !== 'json' && v !== 'markdown') {
                _argparse_error(
                    `argument --format: invalid choice: '${v}' (choose from 'text', 'json', 'markdown')`,
                );
            }
            format = v;
        } else if (arg === '--repo-root') {
            [repo_root, i] = takeValue(i, '--repo-root');
        } else if (arg.startsWith('--repo-root=')) {
            repo_root = arg.slice('--repo-root='.length);
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: lint_regression.py [-h] [--baseline BASELINE]\n' +
                    '                          [--format {text,json,markdown}]\n' +
                    '                          [--repo-root REPO_ROOT]\n',
            );
            process.exit(0);
        } else {
            _argparse_error(`unrecognized arguments: ${arg}`);
        }
    }
    return { baseline, format, repo_root };
}

function _argparse_error(message: string): never {
    process.stderr.write(
        'usage: lint_regression.py [-h] [--baseline BASELINE]\n' +
            '                          [--format {text,json,markdown}]\n' +
            '                          [--repo-root REPO_ROOT]\n',
    );
    process.stderr.write(`lint_regression.py: error: ${message}\n`);
    process.exit(2);
}

/** Mirror Python `json.dumps(obj, indent=2)` with ensure_ascii=True. */
function _json_dumps_ascii(obj: unknown): string {
    const raw = JSON.stringify(obj, null, 2);
    let out = '';
    for (const ch of raw) {
        const code = ch.codePointAt(0)!;
        if (code < 0x80) {
            out += ch;
        } else {
            for (let k = 0; k < ch.length; k++) {
                out += '\\u' + ch.charCodeAt(k).toString(16).padStart(4, '0');
            }
        }
    }
    return out;
}

function main(): number {
    const args = parse_args(process.argv.slice(2));
    const root = path.resolve(args.repo_root);

    process.stderr.write(`Collecting baseline (${args.baseline})...\n`);
    let baseline_data: LinterJson;
    try {
        baseline_data = run_linter_json(args.baseline, root);
    } catch (e) {
        if (e instanceof CalledProcessError) {
            process.stderr.write(
                `Error: could not create worktree for '${args.baseline}'. ` +
                    `Does the ref exist?\n`,
            );
            return 2;
        }
        throw e;
    }

    process.stderr.write('Collecting current branch...\n');
    const current_data = run_linter_json(null, root);

    const baseline_map = build_status_map(baseline_data);
    const current_map = build_status_map(current_data);

    // Sanity guard: two non-empty result sets sharing no file → not comparable.
    const baseKeys = Object.keys(baseline_map);
    const currKeys = Object.keys(current_map);
    const shared = baseKeys.some((k) => k in current_map);
    if (baseKeys.length && currKeys.length && !shared) {
        process.stderr.write(
            'Error: baseline and current lint results share no files — ' +
                'runs are not comparable; refusing to report.\n',
        );
        return 2;
    }

    const delta = compare(baseline_map, current_map);

    if (args.format === 'json') {
        process.stdout.write(_json_dumps_ascii(_deltaForJson(delta)) + '\n');
    } else if (args.format === 'markdown') {
        process.stdout.write(format_markdown(delta) + '\n');
    } else {
        process.stdout.write(format_text(delta) + '\n');
    }

    return delta.regressions.length || delta.new_files.length ? 1 : 0;
}

/** The JSON shape matches Python dict key order: regressions, improvements,
 * new_files. Each entry preserves the field insertion order of the Python
 * dataclass-free dict literals. */
function _deltaForJson(delta: Delta): unknown {
    return {
        regressions: delta.regressions.map((r) => ({
            file: r.file,
            was: r.was,
            now: r.now,
            new_codes: r.new_codes,
        })),
        improvements: delta.improvements.map((imp) => ({
            file: imp.file,
            was: imp.was,
            now: imp.now,
            removed_codes: imp.removed_codes,
        })),
        new_files: delta.new_files.map((nf) => ({
            file: nf.file,
            status: nf.status,
            codes: nf.codes,
        })),
    };
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === fileURLToPath(import.meta.url)) {
    process.exit(main());
}

export {
    type Delta,
    type StatusMap,
    STATUS_ORDER,
    run_linter_json,
    build_status_map,
    compare,
    format_text,
    format_markdown,
    main,
};
