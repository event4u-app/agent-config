#!/usr/bin/env node
/**
 * CI Summary — render a GitHub Step Summary from dispatcher run results.
 *
 * TypeScript twin of `src/scripts/ci_summary.py` (ADR-092 — Python→TS
 * migration, Phase 8 / Wave 8a). The CLI contract is mirrored EXACTLY:
 * same flags (`--runs`, `--title`), same defaults, same stdout/env-file
 * behaviour, same byte-identical markdown output, same exit code (always
 * 0). No behaviour changes — latent bugs replicated.
 *
 * Consumes JSON files produced by `scripts/runtime_dispatcher.py run
 * --output FILE`. Each file is an ExecutionResult dump (see
 * runtime_handler).
 *
 * Usage:
 *     ./scripts-run src/scripts/ci_summary --runs agents/runtime/reports/runs [--title TITLE]
 *
 * Writes to $GITHUB_STEP_SUMMARY if the environment variable is set,
 * otherwise prints the markdown to stdout. Missing or empty run
 * directories render a short "no runs" note and exit 0.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

/** ExecutionResult dump — every field is optional / arbitrary at parse time. */
type RunResult = Record<string, unknown>;

/**
 * Load every *.json in runs_dir as an ExecutionResult dict. Sorted by
 * filename. Mirrors `load_runs`.
 */
export function load_runs(runs_dir: string): RunResult[] {
    let stat: fs.Stats;
    try {
        stat = fs.statSync(runs_dir);
    } catch {
        return [];
    }
    if (!stat.isDirectory()) {
        return [];
    }
    let names: string[];
    try {
        names = fs.readdirSync(runs_dir);
    } catch {
        return [];
    }
    // Python `sorted(runs_dir.glob("*.json"))` sorts on the full POSIX path;
    // for a flat listing under one dir this equals sorting the basenames.
    const jsonNames = names.filter((n) => n.endsWith('.json')).sort();
    const runs: RunResult[] = [];
    for (const name of jsonNames) {
        const p = path.join(runs_dir, name);
        try {
            const text = fs.readFileSync(p, 'utf-8');
            runs.push(JSON.parse(text) as RunResult);
        } catch {
            // Skip unreadable/malformed files — CI still reports the rest.
            continue;
        }
    }
    return runs;
}

const _STATUS_ICON: Record<string, string> = {
    success: '✅',
    failure: '❌',
    timeout: '⏱️',
    error: '⚠️',
};

/** Python `str(x)` for the limited value shapes that land in the summary cells. */
function _pyStr(value: unknown): string {
    if (value === null || value === undefined) {
        return 'None';
    }
    if (typeof value === 'boolean') {
        return value ? 'True' : 'False';
    }
    return String(value);
}

/** Render a markdown summary for the given runs. Mirrors `render_summary`. */
export function render_summary(runs: RunResult[], title: string): string {
    const lines: string[] = [`## ${title}`, ''];

    if (runs.length === 0) {
        lines.push('*No dispatcher runs recorded in this job.*');
        lines.push('');
        return lines.join('\n');
    }

    const total = runs.length;
    const passed = runs.filter((r) => r.status === 'success').length;
    const failed = total - passed;

    lines.push(`- Runs: **${total}**  ·  Passed: **${passed}**  ·  Failed: **${failed}**`);
    lines.push('');
    lines.push('| Skill | Status | Exit | Duration |');
    lines.push('|---|---|---:|---:|');
    for (const r of runs) {
        // Python: `str(r.get("status", "?"))` — key absent → "?", null → "None".
        const status = _pyStr('status' in r ? r.status : '?');
        const icon = _STATUS_ICON[status] ?? '•';
        // Python: `r.get("duration_ms", 0) or 0` — falsy (0, None, "", etc.) → 0.
        const rawDuration = 'duration_ms' in r ? r.duration_ms : 0;
        const durationMs = _pyTruthy(rawDuration) ? rawDuration : 0;
        const skillName = 'skill_name' in r ? r.skill_name : '?';
        const exitCode = 'exit_code' in r ? r.exit_code : '?';
        lines.push(
            `| \`${_pyStr(skillName)}\` ` +
                `| ${icon} ${status} ` +
                `| ${_pyStr(exitCode)} ` +
                `| ${_pyStr(durationMs)} ms |`,
        );
    }

    const failures = runs.filter((r) => r.status !== 'success');
    if (failures.length > 0) {
        lines.push('');
        lines.push('### Failure details');
        for (const r of failures) {
            const name = 'skill_name' in r ? r.skill_name : '?';
            lines.push(`<details><summary><code>${_pyStr(name)}</code></summary>`);
            const err = r.error;
            if (_pyTruthy(err)) {
                lines.push('');
                lines.push(`**Error:** ${_pyStr(err)}`);
            }
            // Python: `(r.get("stderr") or "").rstrip()`.
            const stderrRaw = _pyTruthy(r.stderr) ? r.stderr : '';
            const stderr = _pyRstrip(_pyStr(stderrRaw));
            if (stderr) {
                lines.push('');
                lines.push('```');
                lines.push(stderr.slice(-1500));
                lines.push('```');
            }
            lines.push('</details>');
        }
    }

    lines.push('');
    return lines.join('\n');
}

/** Python truthiness for the JSON value shapes (None/0/""/[]/{} are falsy). */
function _pyTruthy(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value.length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
}

// Python str.rstrip() whitespace cohort (str.isspace code points).
const _PY_WS = [
    0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x1c, 0x1d, 0x1e, 0x1f, 0x20, 0x85, 0xa0,
    0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007,
    0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000,
];

/** Python `str.rstrip()` — strip trailing Python-whitespace code points. */
function _pyRstrip(s: string): string {
    let end = s.length;
    while (end > 0) {
        const cp = s.codePointAt(end - 1);
        if (cp === undefined || !_PY_WS.includes(cp)) break;
        end -= 1;
    }
    return s.slice(0, end);
}

/**
 * Append to $GITHUB_STEP_SUMMARY if set; return true when the env path was
 * used. Mirrors `write_output`.
 */
export function write_output(summary: string): boolean {
    const p = process.env.GITHUB_STEP_SUMMARY;
    if (!p) {
        return false;
    }
    let toWrite = summary;
    if (!summary.endsWith('\n')) {
        toWrite = summary + '\n';
    }
    fs.appendFileSync(p, toWrite, 'utf-8');
    return true;
}

interface Args {
    runs: string;
    title: string;
}

function parse_args(argv: string[]): Args {
    let runs = path.join('agents', 'runtime', 'reports', 'runs');
    let title = '🤖 Dispatcher runs';
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--runs') {
            runs = argv[++i] ?? '';
        } else if (a !== undefined && a.startsWith('--runs=')) {
            runs = a.slice('--runs='.length);
        } else if (a === '--title') {
            title = argv[++i] ?? '';
        } else if (a !== undefined && a.startsWith('--title=')) {
            title = a.slice('--title='.length);
        }
    }
    return { runs, title };
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const args = parse_args(argv);
    const runs = load_runs(args.runs);
    const summary = render_summary(runs, args.title);
    if (!write_output(summary)) {
        process.stdout.write(summary + '\n');
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}
