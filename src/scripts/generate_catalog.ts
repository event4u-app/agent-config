#!/usr/bin/env node
/**
 * Generate llms.txt and docs/skills-catalog.md from SKILL.md frontmatter.
 *
 * TypeScript twin of `src/scripts/generate_catalog.py` (ADR-089, Phase 8
 * Wave 8a). Mirrors the Python CLI contract EXACTLY — same stdout lines,
 * same exit codes, byte-identical generated `llms.txt` + `docs/skills-catalog.md`.
 *
 * Reads name + description from each `dist/agent-src/skills/*\/SKILL.md` and
 * writes:
 *
 * - `llms.txt`            — machine-readable index (plain text)
 * - `docs/skills-catalog.md` — human-readable catalog (markdown)
 *
 * Idempotent. Safe to re-run. Sort order: alphabetical by skill name.
 *
 * Usage:
 *     node scripts/generate_catalog.ts
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
// _HERE === <repo>/src/scripts ; parent.parent.parent of the .py file
// (src/scripts/generate_catalog.py) is the repo root — two dirs up from scripts.
export const REPO_ROOT = path.resolve(_HERE, '..', '..');
export const SKILLS_DIR = path.join(REPO_ROOT, 'dist/agent-src', 'skills');
export const LLMS_TXT = path.join(REPO_ROOT, 'llms.txt');
export const CATALOG_MD = path.join(REPO_ROOT, 'docs', 'skills-catalog.md');

// re.compile(r"^---\s*\n(.*?)\n---", re.DOTALL) anchored with .match (start only).
// JS \s matches newlines like Python's, so `\s*\n` and `(.*?)` (DOTALL → [\s\S]).
const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---/;
// re.compile(r"^name:\s*(.+?)\s*$", re.MULTILINE)
const NAME_RE = /^name:[^\S\n]*(.+?)[^\S\n]*$/m;
// re.compile(r"^description:\s*\"?(.+?)\"?\s*$", re.MULTILINE)
const DESC_RE = /^description:[^\S\n]*"?(.+?)"?[^\S\n]*$/m;

/** Mirror Python str.strip() — strip ASCII + Unicode whitespace from both ends. */
function pyStrip(s: string): string {
    return s.replace(/^\s+/, '').replace(/\s+$/, '');
}

export function parse_skill(skill_md: string): [string, string] | null {
    const text = fs.readFileSync(skill_md, 'utf-8');
    const m = FRONTMATTER_RE.exec(text);
    // `.match` semantics: must match at start of string.
    if (!m || m.index !== 0) {
        return null;
    }
    const front = m[1] as string;
    const name_m = NAME_RE.exec(front);
    const desc_m = DESC_RE.exec(front);
    if (!name_m || !desc_m) {
        return null;
    }
    return [pyStrip(name_m[1] as string), pyStrip(desc_m[1] as string)];
}

/** Sorted immediate child entries (mirrors `sorted(SKILLS_DIR.iterdir())`). */
function _iterdirSorted(p: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(p);
    } catch {
        return [];
    }
    names.sort();
    return names.map((name) => path.join(p, name));
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

export function collect_skills(): Array<[string, string]> {
    const skills: Array<[string, string]> = [];
    for (const skill_dir of _iterdirSorted(SKILLS_DIR)) {
        if (!_isDir(skill_dir)) {
            continue;
        }
        const skill_md = path.join(skill_dir, 'SKILL.md');
        if (!_exists(skill_md)) {
            continue;
        }
        const parsed = parse_skill(skill_md);
        if (parsed !== null) {
            skills.push(parsed);
        }
    }
    return skills;
}

export function render_llms_txt(skills: Array<[string, string]>): string {
    const lines = [
        '# agent-config — Skill Index',
        '',
        'Machine-readable index of all skills in this package. Each line:',
        '  <skill-name>: <one-line description>',
        '',
        'Source: dist/agent-src/skills/<name>/SKILL.md',
        'Catalog: docs/skills-catalog.md',
        '',
    ];
    for (const [name, desc] of skills) {
        lines.push(`${name}: ${desc}`);
    }
    lines.push('');
    return lines.join('\n');
}

export function render_catalog_md(skills: Array<[string, string]>): string {
    const lines = [
        '# Skills Catalog',
        '',
        `All **${skills.length} skills** available in this package, in alphabetical order.`,
        'Click a skill name to open its SKILL.md and read the full guidance.',
        '',
        '> **Regenerate:** `python3 scripts/generate_catalog.py`',
        '> This file is auto-generated from `SKILL.md` frontmatter — do not edit manually.',
        '',
        '| Skill | What your agent learns |',
        '|---|---|',
    ];
    for (const [name, desc] of skills) {
        lines.push(`| [\`${name}\`](../dist/agent-src/skills/${name}/SKILL.md) | ${desc} |`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('← [Back to README](../README.md)');
    lines.push('');
    return lines.join('\n');
}

/** POSIX relative path of `child` under `root` (mirrors `relative_to().as_posix()`). */
function _relToRepo(child: string): string {
    return path.relative(REPO_ROOT, child).split(path.sep).join('/');
}

export function main(): number {
    if (!_exists(SKILLS_DIR)) {
        process.stdout.write(`❌  Skills directory not found: ${SKILLS_DIR}\n`);
        return 1;
    }
    const skills = collect_skills();
    if (skills.length === 0) {
        process.stdout.write('❌  No skills found.\n');
        return 1;
    }

    fs.writeFileSync(LLMS_TXT, render_llms_txt(skills), 'utf-8');
    fs.mkdirSync(path.dirname(CATALOG_MD), { recursive: true });
    fs.writeFileSync(CATALOG_MD, render_catalog_md(skills), 'utf-8');

    process.stdout.write(`✅  Wrote ${_relToRepo(LLMS_TXT)} (${skills.length} skills)\n`);
    process.stdout.write(`✅  Wrote ${_relToRepo(CATALOG_MD)}\n`);
    return 0;
}

const _isMain = import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? '')).href;
if (_isMain) {
    process.exitCode = main();
}
