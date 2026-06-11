#!/usr/bin/env tsx
/**
 * Lint cross-wing handoffs declared in senior-tier skills' `## Related Skills`.
 *
 * TypeScript twin of `src/scripts/lint_handoffs.py` (ADR-088, Phase 4 /
 * Wave 4b). Mirrors the CLI contract EXACTLY — the `--quiet` flag is a
 * bare `sys.argv` membership check (NOT argparse, so there is no real
 * `-h`/`--help`; `main(argv)` treats `argv[0]` as a skills-dir override,
 * e.g. `--help` → `Path("--help")`), the `file:line:code: message` render
 * shape on stdout, the trailing `❌` summary on stderr, exit codes
 * (0 clean, 1 violations), and the same WHEN/WHEN-NOT split + DAG cycle
 * detection. No behaviour changes.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');
const SKILLS_DIR = path.join(REPO, '.agent-src.uncondensed', 'skills');

/** Mirror `QUIET = "--quiet" in sys.argv` (computed at import). */
const QUIET = process.argv.slice(2).includes('--quiet');

// re.compile(r"\[`?([a-z0-9][a-z0-9-]*)`?\]\(([^)]+SKILL\.md)\)")
const LINK_RE = /\[`?([a-z0-9][a-z0-9-]*)`?\]\(([^)]+SKILL\.md)\)/g;
// re.compile(r"^##\s+Related\s+Skills\s*$", re.IGNORECASE)
const RELATED_HEADING_RE = /^##\s+Related\s+Skills\s*$/i;
// re.compile(r"^##\s+\S")
const NEXT_HEADING_RE = /^##\s+\S/;
// re.compile(r"^\*\*WHEN\s+to\s+use\s+this\*\*\s*$", re.IGNORECASE)
const WHEN_USE_RE = /^\*\*WHEN\s+to\s+use\s+this\*\*\s*$/i;
// re.compile(r"^\*\*WHEN\s+NOT\s+to\s+use\s+this\*\*\s*$", re.IGNORECASE)
const WHEN_NOT_RE = /^\*\*WHEN\s+NOT\s+to\s+use\s+this\*\*\s*$/i;

export interface Violation {
    file: string; // resolved absolute path
    line: number;
    code: string;
    message: string;
}

function _render(v: Violation, repo: string): string {
    // file is always absolute here, so relative_to applies.
    const rel = _isUnder(v.file, repo) || v.file === repo ? _relTo(v.file, repo) : v.file;
    return `${rel}:${v.line}:${v.code}: ${v.message}`;
}

function _relTo(target: string, root: string): string {
    return path.relative(root, target).split(path.sep).join('/');
}

function _isUnder(child: string, root: string): boolean {
    const rel = path.relative(root, child);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

export function parse_frontmatter_tier(text: string): string | null {
    if (!text.startsWith('---\n')) {
        return null;
    }
    const end = text.indexOf('\n---\n', 4);
    if (end === -1) {
        return null;
    }
    for (const raw of text.slice(4, end).split('\n')) {
        if (!raw.includes(':')) {
            continue;
        }
        const sep = raw.indexOf(':');
        const key = raw.slice(0, sep);
        const val = raw.slice(sep + 1);
        if (key.trim() === 'tier') {
            return _strip(_strip(_strip(val.trim(), '"'), "'"), undefined);
        }
    }
    return null;
}

/** Python str.strip(chars) — strip leading/trailing chars (whitespace if undefined). */
function _strip(s: string, chars?: string): string {
    if (chars === undefined) {
        return s.trim();
    }
    let start = 0;
    let end = s.length;
    while (start < end && chars.includes(s[start] as string)) {
        start++;
    }
    while (end > start && chars.includes(s[end - 1] as string)) {
        end--;
    }
    return s.slice(start, end);
}

/** Return [block_start_line, [[line, raw], ...]] for `## Related Skills`. */
function extract_related_block(text: string): [number, Array<[number, string]>] | null {
    const lines = text.split('\n');
    let start: number | null = null;
    for (let idx = 0; idx < lines.length; idx++) {
        if (RELATED_HEADING_RE.test(lines[idx] as string)) {
            start = idx;
            break;
        }
    }
    if (start === null) {
        return null;
    }
    const body: Array<[number, string]> = [];
    for (let idx = start + 1; idx < lines.length; idx++) {
        if (NEXT_HEADING_RE.test(lines[idx] as string)) {
            break;
        }
        body.push([idx + 1, lines[idx] as string]);
    }
    return [start + 1, body];
}

function split_when_subblocks(
    body: Array<[number, string]>,
): [Array<[number, string]>, Array<[number, string]>] {
    const when_use: Array<[number, string]> = [];
    const when_not: Array<[number, string]> = [];
    let current = when_use;
    for (const [lineno, raw] of body) {
        if (WHEN_USE_RE.test(raw)) {
            current = when_use;
            continue;
        }
        if (WHEN_NOT_RE.test(raw)) {
            current = when_not;
            continue;
        }
        current.push([lineno, raw]);
    }
    return [when_use, when_not];
}

function extract_links(body: Array<[number, string]>): Array<[number, string, string]> {
    const out: Array<[number, string, string]> = [];
    for (const [lineno, raw] of body) {
        LINK_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = LINK_RE.exec(raw)) !== null) {
            out.push([lineno, m[1] as string, m[2] as string]);
        }
    }
    return out;
}

/** (skill_file.parent / link).resolve() — absolute, symlink-resolved. */
function resolve_target(skill_file: string, link: string): string {
    const joined = path.resolve(path.dirname(skill_file), link);
    try {
        return fs.realpathSync(joined);
    } catch {
        return joined;
    }
}

function detect_cycles(graph: Map<string, Set<string>>): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const stack: string[] = [];
    const on_stack = new Set<string>();

    const dfs = (node: string): void => {
        if (on_stack.has(node)) {
            const i = stack.indexOf(node);
            cycles.push([...stack.slice(i), node]);
            return;
        }
        if (visited.has(node)) {
            return;
        }
        visited.add(node);
        on_stack.add(node);
        stack.push(node);
        for (const nxt of graph.get(node) ?? []) {
            dfs(nxt);
        }
        stack.pop();
        on_stack.delete(node);
    };

    for (const node of [...graph.keys()]) {
        dfs(node);
    }
    return cycles;
}

/** sorted(skills_dir.rglob("SKILL.md")) — absolute, sorted POSIX. */
function _rglobSkillMd(dir: string): string[] {
    const out: string[] = [];
    const walk = (current: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of entries) {
            const full = path.join(current, ent.name);
            if (ent.isDirectory()) {
                walk(full);
            } else if (ent.name === 'SKILL.md') {
                out.push(full);
            }
        }
    };
    walk(dir);
    out.sort();
    return out;
}

/** Path.resolve() with symlink resolution; falls back to absolute on missing. */
function _resolve(p: string): string {
    const abs = path.resolve(p);
    try {
        return fs.realpathSync(abs);
    } catch {
        return abs;
    }
}

export function lint(skills_dir: string): Violation[] {
    const senior_skills: Map<string, string> = new Map();
    const all_skills: Map<string, string> = new Map();
    for (const skill_md of _rglobSkillMd(skills_dir)) {
        const text = fs.readFileSync(skill_md, 'utf-8');
        const tier = parse_frontmatter_tier(text);
        const resolved = _resolve(skill_md);
        all_skills.set(resolved, tier ?? '');
        if (tier === 'senior') {
            senior_skills.set(resolved, text);
        }
    }

    const violations: Violation[] = [];
    const graph: Map<string, Set<string>> = new Map();

    for (const [skill_path, text] of senior_skills) {
        const block = extract_related_block(text);
        if (block === null) {
            continue;
        }
        const [, body] = block;
        const [when_use, when_not] = split_when_subblocks(body);

        // WHEN-to-use links: composition edges (graph) + dangling/tier checks.
        for (const [lineno, slug, link] of extract_links(when_use)) {
            const target = resolve_target(skill_path, link);
            if (!graph.has(skill_path)) {
                graph.set(skill_path, new Set());
            }
            graph.get(skill_path)!.add(target);
            if (!all_skills.has(target)) {
                violations.push({
                    file: skill_path,
                    line: lineno,
                    code: 'handoff_dangling',
                    message: `link to \`${slug}\` resolves to missing file ${link}`,
                });
                continue;
            }
            if (all_skills.get(target) !== 'senior') {
                violations.push({
                    file: skill_path,
                    line: lineno,
                    code: 'handoff_tier_mismatch',
                    message:
                        `senior skill links to non-senior \`${slug}\` ` +
                        `(tier=${_pyRepr(all_skills.get(target) || 'unset')})`,
                });
            }
        }

        // WHEN-NOT-to-use links: alternative pointers, NOT composition edges.
        for (const [lineno, slug, link] of extract_links(when_not)) {
            const target = resolve_target(skill_path, link);
            if (!all_skills.has(target)) {
                violations.push({
                    file: skill_path,
                    line: lineno,
                    code: 'handoff_dangling',
                    message: `link to \`${slug}\` resolves to missing file ${link}`,
                });
                continue;
            }
            if (all_skills.get(target) !== 'senior') {
                violations.push({
                    file: skill_path,
                    line: lineno,
                    code: 'handoff_tier_mismatch',
                    message:
                        `senior skill links to non-senior \`${slug}\` ` +
                        `(tier=${_pyRepr(all_skills.get(target) || 'unset')})`,
                });
            }
        }
    }

    for (const cycle of detect_cycles(graph)) {
        const names = cycle.map((p) => path.basename(path.dirname(p))).join(' → ');
        violations.push({
            file: cycle[0] as string,
            line: 1,
            code: 'handoff_cycle',
            message: `composition cycle: ${names}`,
        });
    }
    return violations;
}

/** Python repr() of a string (single-quote preference). */
function _pyRepr(s: string): string {
    if (s.includes("'") && !s.includes('"')) {
        return `"${s.replace(/\\/g, '\\\\')}"`;
    }
    return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

export function main(argv?: readonly string[]): number {
    let skills_dir = SKILLS_DIR;
    const args = argv ?? process.argv.slice(2);
    if (args.length > 0) {
        skills_dir = _resolve(args[0] as string);
    }
    const violations = lint(skills_dir);
    if (violations.length === 0) {
        if (!QUIET) {
            process.stdout.write(
                `✅  lint_handoffs: no violations under ${_relTo(skills_dir, REPO)}\n`,
            );
        }
        return 0;
    }
    for (const v of violations) {
        process.stdout.write(_render(v, REPO) + '\n');
    }
    process.stderr.write(`\n❌  lint_handoffs: ${violations.length} violation(s)\n`);
    return 1;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    REPO,
    SKILLS_DIR,
    LINK_RE,
    extract_related_block,
    split_when_subblocks,
    extract_links,
    resolve_target,
    detect_cycles,
};
