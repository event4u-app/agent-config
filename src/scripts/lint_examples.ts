#!/usr/bin/env tsx
/**
 * Phase 3.4 demo-shape linter — wrong / right / why per demo.
 *
 * TypeScript twin of `src/scripts/lint_examples.py` (ADR-090, Phase 4 /
 * Wave 4b). Mirrors the CLI contract EXACTLY — the `--quiet` flag is a
 * bare `sys.argv` membership check (NOT argparse, so there is no real
 * `-h`/`--help`), the same `glob` (non-recursive) over
 * `docs/guidelines/agent-infra/*-demos.md`, byte-identical finding
 * messages, stdout/stderr split, exit codes, and file ordering
 * (sorted glob). No behaviour changes — latent quirks replicated.
 *
 * Validates every `docs/guidelines/agent-infra/*-demos.md`: frontmatter
 * keys (`demo_for:`, `layer: pattern-memory`, `prose_delta:` with
 * before / after char counts), and each `## Demo N` section having
 * Wrong / Right shape headings, a `**Failure mode:**` line, and a
 * Why-it-works explanation (heading or inline).
 *
 * Exit codes: 0 = clean, 1 = failures (or no demo files matched).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
// Path(__file__).resolve().parent.parent.parent — three dirs up from the file.
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const DEMO_GLOB = 'docs/guidelines/agent-infra/*-demos.md';
const DEMO_GLOB_DIR = 'docs/guidelines/agent-infra';
const DEMO_SUFFIX = '-demos.md';

const REQUIRED_FM_KEYS = ['demo_for:', 'layer: pattern-memory', 'prose_delta:'] as const;
const REQUIRED_FM_DELTA = ['rule_chars_before:', 'rule_chars_after:'] as const;

/** Mirror `QUIET = "--quiet" in sys.argv` (computed once at import, like Python). */
const QUIET = process.argv.slice(2).includes('--quiet');

function _frontmatter(text: string): string {
    if (!text.startsWith('---\n')) {
        return '';
    }
    const end = text.indexOf('\n---\n', 4);
    return end !== -1 ? text.slice(4, end) : '';
}

function _check_frontmatter(fm: string, problems: string[]): void {
    for (const key of [...REQUIRED_FM_KEYS, ...REQUIRED_FM_DELTA]) {
        if (!fm.includes(key)) {
            // Python `f"frontmatter missing: {key!r}"` → repr of a str.
            problems.push(`frontmatter missing: ${_pyRepr(key)}`);
        }
    }
}

function _check_demo_sections(text: string, problems: string[]): void {
    // re.compile(r"^## Demo \d+\b.*$", re.MULTILINE)
    const demoPat = /^## Demo \d+\b.*$/gm;
    const demoStarts: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = demoPat.exec(text)) !== null) {
        demoStarts.push(m.index);
        if (m.index === demoPat.lastIndex) {
            demoPat.lastIndex++;
        }
    }
    if (demoStarts.length === 0) {
        problems.push("no '## Demo N — …' sections found");
        return;
    }
    const bounds = [...demoStarts, text.length];
    for (let i = 0; i < demoStarts.length; i++) {
        const start = demoStarts[i]!;
        const section = text.slice(start, bounds[i + 1]);
        // section.splitlines()[0]
        const title = section.split('\n')[0] ?? '';
        if (!section.includes('### Wrong shape')) {
            problems.push(`${_pyRepr(title)}: missing '### Wrong shape'`);
        }
        if (!section.includes('### Right shape')) {
            problems.push(`${_pyRepr(title)}: missing '### Right shape'`);
        }
        if (!section.includes('**Failure mode:**')) {
            problems.push(`${_pyRepr(title)}: missing '**Failure mode:**' line`);
        }
        const hasWhySection = section.includes('### Why it works');
        const hasWhyInline = section.includes('**Why it works:**');
        if (!(hasWhySection || hasWhyInline)) {
            problems.push(
                `${_pyRepr(title)}: missing 'Why it works' explanation ` +
                    '(### Why it works or **Why it works:** inline)',
            );
        }
    }
}

export function lint_demo(p: string): string[] {
    const text = fs.readFileSync(p, 'utf-8');
    const problems: string[] = [];
    const fm = _frontmatter(text);
    if (!fm) {
        problems.push('missing YAML frontmatter (--- block at top)');
    } else {
        _check_frontmatter(fm, problems);
    }
    _check_demo_sections(text, problems);
    return problems;
}

/** sorted(REPO_ROOT.glob("docs/guidelines/agent-infra/*-demos.md")). */
function _sorted_demos(root: string): string[] {
    const dir = path.join(root, DEMO_GLOB_DIR);
    let entries: string[];
    try {
        entries = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const out = entries
        .filter((name) => name.endsWith(DEMO_SUFFIX))
        .map((name) => path.join(dir, name))
        .filter((p) => {
            try {
                return fs.statSync(p).isFile();
            } catch {
                return false;
            }
        });
    out.sort();
    return out;
}

/** POSIX relative path of `target` under `root`. */
function _relTo(target: string, root: string): string {
    return path.relative(root, target).split(path.sep).join('/');
}

/** Python `repr()` of a string literal (single-quote preference). */
function _pyRepr(s: string): string {
    if (s.includes("'") && !s.includes('"')) {
        return `"${s.replace(/\\/g, '\\\\')}"`;
    }
    return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

export function main(): number {
    const demos = _sorted_demos(REPO_ROOT);
    if (demos.length === 0) {
        process.stderr.write(`❌  no demo files matched ${DEMO_GLOB}\n`);
        return 1;
    }
    let failed = 0;
    for (const demo of demos) {
        const rel = _relTo(demo, REPO_ROOT);
        const problems = lint_demo(demo);
        if (problems.length > 0) {
            failed += 1;
            process.stderr.write(`❌  ${rel}\n`);
            for (const p of problems) {
                process.stderr.write(`    - ${p}\n`);
            }
        } else if (!QUIET) {
            process.stdout.write(`✅  ${rel}\n`);
        }
    }
    if (failed) {
        process.stderr.write(`\n❌  ${failed} demo file(s) failed shape lint\n`);
        return 1;
    }
    if (!QUIET) {
        process.stdout.write(`\n✅  ${demos.length} demo file(s) shape-clean\n`);
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export { REPO_ROOT, DEMO_GLOB, DEMO_GLOB_DIR, DEMO_SUFFIX, REQUIRED_FM_KEYS, REQUIRED_FM_DELTA };
