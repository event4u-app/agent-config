#!/usr/bin/env tsx
/**
 * Audit the user-type axis frontmatter coverage (step-9 Phase 4).
 *
 * TypeScript twin of `src/scripts/audit_user_type_axis.py` (ADR-200,
 * Phase 8 / Wave 8a). The CLI contract is mirrored EXACTLY — the single
 * `--quiet` flag, exit code (1 when orphans exist, else 0), the stdout
 * split, byte-identical stdout summary, AND byte-identical generated
 * Markdown report. Stdlib-only — no YAML dependency.
 *
 * Two checks across `.agent-src.uncondensed/skills/`:
 *
 *   1. Orphan values — every `recommended_for_user_types` value must have a
 *      `user-types/<value>.yml` config. Orphans are FATAL (exit 1).
 *   2. Unused configs — every `user-types/*.yml` should be consumed by at
 *      least one skill. Unused configs are WARN-only (exit 0).
 *
 * NOTE: the Python original scans only the LEGACY `.agent-src.uncondensed/
 * skills/` root (not the 6.0.0-D `src/skills/` library). This twin replicates
 * that exact root for byte-identical parity. The report path is
 * `agents/reports/user-type-axis-audit.md` (matching the Python constant,
 * which differs from the docstring's `agents/runtime/reports/` mention —
 * latent bug replicated).
 *
 * No behaviour changes — latent Python quirks replicated.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

// src/scripts/audit_user_type_axis.ts → parents[2] of the .py file is repo root.
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const SKILLS_ROOT = path.join(REPO_ROOT, '.agent-src.uncondensed', 'skills');
export const USER_TYPES_ROOT = path.join(REPO_ROOT, 'user-types');
export const REPORT_PATH = path.join(REPO_ROOT, 'agents', 'reports', 'user-type-axis-audit.md');

// ^recommended_for_user_types:\s*\[([^\]]*)\]\s*$  (MULTILINE)
const _FRONTMATTER_LINE = /^recommended_for_user_types:[ \t]*\[([^\]]*)\][ \t]*$/m;

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

/** POSIX relative path of `child` under `root` (mirrors `relative_to().as_posix()`). */
function _relativeToPosix(child: string, root: string): string {
    const rel = path.relative(root, child);
    return rel.split(path.sep).join('/');
}

/** `sorted(root.glob("*.yml"))` — direct children only, lexically sorted abs paths. */
function _globYmlSorted(root: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(root);
    } catch {
        return [];
    }
    const out = names
        .filter((n) => n.endsWith('.yml'))
        .map((n) => path.join(root, n))
        .filter((p) => _isFile(p));
    out.sort();
    return out;
}

/** `sorted(root.rglob("SKILL.md"))` — recursive, lexically sorted abs paths. */
function _rglobSkillMd(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of entries) {
            const full = path.join(dir, ent.name);
            if (ent.name === 'SKILL.md') {
                out.push(full);
            }
            if (ent.isDirectory() || (ent.isSymbolicLink() && _isDir(full))) {
                walk(full);
            }
        }
    };
    walk(root);
    out.sort();
    return out;
}

/** Read `user-types/*.yml` stems (one identity per YAML file). */
export function _declared_user_types(): Set<string> {
    if (!_isDir(USER_TYPES_ROOT)) {
        return new Set();
    }
    const stems = new Set<string>();
    for (const p of _globYmlSorted(USER_TYPES_ROOT)) {
        stems.add(path.basename(p, '.yml'));
    }
    return stems;
}

/** Map every frontmatter user-type value → list of declaring SKILL.md POSIX relpaths. */
export function _scan_skill_values(): Map<string, string[]> {
    const byValue = new Map<string, string[]>();
    if (!_isDir(SKILLS_ROOT)) {
        return byValue;
    }
    for (const skillMd of _rglobSkillMd(SKILLS_ROOT)) {
        // read_text(errors="replace")
        const text = fs.readFileSync(skillMd, 'utf-8');
        // Frontmatter is the leading `---` block — strip everything after.
        let fm: string;
        if (text.startsWith('---\n')) {
            const end = text.indexOf('\n---', 4);
            fm = end >= 0 ? text.slice(4, end) : text;
        } else {
            fm = text.slice(0, 4096);
        }
        const match = _FRONTMATTER_LINE.exec(fm);
        if (!match) {
            continue;
        }
        const rel = _relativeToPosix(skillMd, REPO_ROOT);
        for (const raw of (match[1] as string).split(',')) {
            // raw.strip().strip('"').strip("'")
            const value = _stripQuotes(raw.trim());
            if (value) {
                const list = byValue.get(value) ?? [];
                list.push(rel);
                byValue.set(value, list);
            }
        }
    }
    return byValue;
}

/** Mirror `.strip().strip('"').strip("'")` (the two trailing strips remove paired or unpaired quote chars). */
function _stripQuotes(s: string): string {
    let out = s;
    out = _stripChar(out, '"');
    out = _stripChar(out, "'");
    return out;
}

/** Mirror Python `str.strip(ch)`: remove all leading and trailing `ch`. */
function _stripChar(s: string, ch: string): string {
    let start = 0;
    let end = s.length;
    while (start < end && s[start] === ch) {
        start += 1;
    }
    while (end > start && s[end - 1] === ch) {
        end -= 1;
    }
    return s.slice(start, end);
}

/** `sorted(iterable)` for string sets — lexicographic. */
function _sorted(values: Iterable<string>): string[] {
    return [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function _render_report(
    declared: Set<string>,
    byValue: Map<string, string[]>,
    orphans: Set<string>,
    unused: Set<string>,
): string {
    const lines: string[] = [
        '# User-type axis — frontmatter coverage audit',
        '',
        'Generated by `scripts/audit_user_type_axis.py` (step-9 Phase 4).',
        '',
        `- Declared user-types (\`user-types/*.yml\`): **${declared.size}**`,
        `- Distinct frontmatter values across skills: **${byValue.size}**`,
        `- Orphans (FATAL): **${orphans.size}**`,
        `- Unused configs (WARN): **${unused.size}**`,
        '',
        '## Coverage matrix',
        '',
        '| user-type | declared | consuming skills |',
        '| --- | --- | --- |',
    ];
    // for ut in sorted(declared | set(by_value))
    const union = new Set<string>(declared);
    for (const k of byValue.keys()) {
        union.add(k);
    }
    for (const ut of _sorted(union)) {
        const flagDeclared = declared.has(ut) ? 'yes' : '**no (orphan)**';
        const count = (byValue.get(ut) ?? []).length;
        lines.push(`| \`${ut}\` | ${flagDeclared} | ${count} |`);
    }
    if (orphans.size > 0) {
        lines.push('', '## Orphans', '');
        for (const orphan of _sorted(orphans)) {
            lines.push(`- \`${orphan}\` — referenced by:`);
            for (const p of byValue.get(orphan) ?? []) {
                lines.push(`  - \`${p}\``);
            }
        }
    }
    if (unused.size > 0) {
        lines.push('', '## Unused configs (WARN)', '');
        for (const stem of _sorted(unused)) {
            lines.push(`- \`user-types/${stem}.yml\` has no consuming skill yet.`);
        }
    }
    lines.push('');
    return lines.join('\n');
}

export function main(argv: string[]): number {
    const quiet = argv.includes('--quiet');
    const declared = _declared_user_types();
    const byValue = _scan_skill_values();
    const used = new Set<string>(byValue.keys());
    // orphans = used - declared ; unused = declared - used
    const orphans = new Set<string>([...used].filter((v) => !declared.has(v)));
    const unused = new Set<string>([...declared].filter((v) => !used.has(v)));

    const report = _render_report(declared, byValue, orphans, unused);
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, report, 'utf-8');

    if (!quiet) {
        process.stdout.write(
            `user-type-axis audit — declared=${declared.size} ` +
                `used=${used.size} orphans=${orphans.size} unused=${unused.size}\n`,
        );
        if (orphans.size > 0) {
            process.stdout.write('  FAIL orphans: ' + _sorted(orphans).join(', ') + '\n');
        }
        if (unused.size > 0) {
            process.stdout.write('  warn unused: ' + _sorted(unused).join(', ') + '\n');
        }
        process.stdout.write(`  report: ${_relativeToPosix(REPORT_PATH, REPO_ROOT)}\n`);
    }

    return orphans.size > 0 ? 1 : 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main(process.argv.slice(2)));
}
