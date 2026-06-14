#!/usr/bin/env tsx
/**
 * Generate `agents/index.md` (internal) and `docs/catalog.md` (public).
 *
 * TypeScript twin of `src/scripts/generate_index.py` (ADR-096, Phase 8 /
 * Wave 8a). The CLI contract is mirrored EXACTLY — the single `--check`
 * flag, exit codes (0 / 1 on drift), the stdout split, byte-identical
 * messages, AND byte-identical generated Markdown (both files are write
 * targets; both are sync-checked in CI via `--check`).
 *
 * Scans `.agent-src.uncondensed/{skills,rules,commands}/` plus
 * `docs/guidelines/` (via the `_lib/agent_src` twin's multi-root discovery)
 * and renders two artefact tables — one for maintainers, one for consumers.
 *
 * No behaviour changes — latent Python quirks replicated.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    artefact_roots,
    iter_commands,
    strip_source_prefix,
} from './_lib/agent_src.js';

const _HERE = fileURLToPath(import.meta.url);

// src/scripts/generate_index.ts → parents[2] of the .py file is the repo root.
export const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

// Legacy single-root anchor — kept as fallback for pure-condensed consumer
// projections. Multi-root discovery uses artefact_roots() per ADR-017.
export const SRC = path.join(ROOT, '.agent-src.uncondensed');
export const GUIDELINES = path.join(ROOT, 'docs', 'guidelines');
export const INDEX_PATH = path.join(ROOT, 'agents', 'index.md');
export const CATALOG_PATH = path.join(ROOT, 'docs', 'catalog.md');

// Internal-only rules — excluded from the public catalog.
export const INTERNAL_RULES = new Set(['source-of-truth', 'augment-portability', 'docs-sync']);

// ^---\s*\n(.*?)\n---\s*\n  (DOTALL)
const FRONTMATTER_RE = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*\n/;

export interface Entry {
    kind: string; // skill | rule | command | shim | guideline
    name: string;
    description: string;
    extra: string;
    path: string;
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

function _relativeToPosix(child: string, root: string): string {
    return path.relative(root, child).split(path.sep).join('/');
}

function _basename(p: string): string {
    return path.basename(p);
}

/** `Path.stem` — basename without final suffix. */
function _stem(p: string): string {
    const base = path.basename(p);
    const ext = path.extname(base);
    return ext ? base.slice(0, base.length - ext.length) : base;
}

/** `sorted(p.iterdir())` — immediate children, lexically sorted abs paths. */
function _iterdirSorted(p: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(p);
    } catch {
        return [];
    }
    names.sort();
    return names.map((n) => path.join(p, n));
}

/** `sorted(root.glob("*.md"))` — direct children only, lexically sorted abs paths. */
function _globMdSorted(root: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(root);
    } catch {
        return [];
    }
    const out = names.filter((n) => n.endsWith('.md')).map((n) => path.join(root, n));
    out.sort();
    return out;
}

/**
 * `sorted(root.rglob("*.md"))` — recursive.
 *
 * Python sorts `Path` objects, which compare COMPONENT-WISE (the parts tuple),
 * not by the raw POSIX string. The two differ where a file shares a name-stem
 * with a sibling directory: `php/patterns.md` vs `php/patterns/strategy.md` —
 * as strings `patterns.md` < `patterns/…` (`.` 0x2E < `/` 0x2F), but pathlib
 * compares `('php','patterns.md')` vs `('php','patterns','strategy.md')` where
 * `'patterns' < 'patterns.md'`, so the subdir file sorts FIRST. Replicate the
 * parts-tuple comparison to keep the generated index byte-identical.
 */
function _rglobMdSorted(root: string): string[] {
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
            if (ent.name.endsWith('.md')) {
                out.push(full);
            }
            if (ent.isDirectory() || (ent.isSymbolicLink() && _isDir(full))) {
                walk(full);
            }
        }
    };
    walk(root);
    out.sort(_pathPartsCompare);
    return out;
}

/** Compare two absolute paths the way pathlib compares `Path` objects: component-wise. */
function _pathPartsCompare(a: string, b: string): number {
    const pa = a.split(path.sep);
    const pb = b.split(path.sep);
    const n = Math.min(pa.length, pb.length);
    for (let i = 0; i < n; i += 1) {
        const x = pa[i] as string;
        const y = pb[i] as string;
        if (x < y) return -1;
        if (x > y) return 1;
    }
    return pa.length - pb.length;
}

export function _parse_frontmatter(text: string): Record<string, string> {
    const m = FRONTMATTER_RE.exec(text);
    if (!m) {
        return {};
    }
    const out: Record<string, string> = {};
    for (const line of (m[1] as string).split('\n')) {
        if (!line.includes(':') || line.startsWith(' ')) {
            continue;
        }
        // k, _, v = line.partition(":")
        const idx = line.indexOf(':');
        const k = line.slice(0, idx);
        const v = line.slice(idx + 1);
        // v.strip().strip('"').strip("'")
        out[k.trim()] = _stripChar(_stripChar(v.trim(), '"'), "'");
    }
    return out;
}

/** Mirror Python `str.strip(ch)`. */
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

export function _truncate(text: string, limit = 200): string {
    // text.replace("|", "\\|").replace("\n", " ").strip()
    let t = text.replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
    if (t.length <= limit) {
        return t;
    }
    // text[: limit - 1].rstrip() + "…"
    t = t.slice(0, limit - 1);
    t = t.replace(/\s+$/, ''); // rstrip
    return t + '…';
}

/** `dict.get(key)` returning undefined when absent, plus the `or fallback` idiom. */
function _getOr(fm: Record<string, string>, key: string, fallback: string): string {
    const v = fm[key];
    // Python `fm.get("name") or skill_dir.name` — falls back when empty/missing.
    return v ? v : fallback;
}

export function _collect_skills(): Entry[] {
    const seen = new Map<string, Entry>();
    for (const srcRoot of artefact_roots()) {
        const skillsRoot = path.join(srcRoot, 'skills');
        if (!_isDir(skillsRoot)) {
            continue;
        }
        for (const skillDir of _iterdirSorted(skillsRoot)) {
            const dirName = _basename(skillDir);
            if (!_isDir(skillDir) || seen.has(dirName)) {
                continue;
            }
            const skillMd = path.join(skillDir, 'SKILL.md');
            if (!_exists(skillMd)) {
                continue;
            }
            const fm = _parse_frontmatter(fs.readFileSync(skillMd, 'utf-8'));
            const name = _getOr(fm, 'name', dirName);
            seen.set(dirName, {
                kind: 'skill',
                name,
                description: _truncate(fm['description'] ?? ''),
                extra: '',
                path: _relativeToPosix(skillMd, ROOT),
            });
        }
    }
    return _sortedKeys(seen).map((k) => seen.get(k) as Entry);
}

export function _collect_rules(): Entry[] {
    const seen = new Map<string, Entry>();
    for (const srcRoot of artefact_roots()) {
        const rulesRoot = path.join(srcRoot, 'rules');
        if (!_isDir(rulesRoot)) {
            continue;
        }
        for (const ruleMd of _globMdSorted(rulesRoot)) {
            const stem = _stem(ruleMd);
            if (seen.has(stem)) {
                continue;
            }
            const fm = _parse_frontmatter(fs.readFileSync(ruleMd, 'utf-8'));
            seen.set(stem, {
                kind: 'rule',
                name: stem,
                description: _truncate(fm['description'] ?? ''),
                extra: fm['type'] ?? '?',
                path: _relativeToPosix(ruleMd, ROOT),
            });
        }
    }
    return _sortedKeys(seen).map((k) => seen.get(k) as Entry);
}

export function _collect_commands(): Entry[] {
    const seen = new Map<string, Entry>();
    for (const cmdMd of iter_commands()) {
        if (_basename(cmdMd) === 'AGENTS.md') {
            continue;
        }
        const logical = strip_source_prefix(_relativeToPosix(cmdMd, ROOT)) ?? '';
        const rel = logical.startsWith('commands/') ? logical.slice('commands/'.length) : _basename(cmdMd);
        if (seen.has(rel)) {
            continue;
        }
        const fm = _parse_frontmatter(fs.readFileSync(cmdMd, 'utf-8'));
        const isShim = Boolean(fm['superseded_by']);
        let extra = '';
        if (isShim) {
            extra = `shim → /${fm['superseded_by']}`;
        } else if (fm['cluster']) {
            extra = `cluster: ${fm['cluster']}`;
        }
        seen.set(rel, {
            kind: isShim ? 'shim' : 'command',
            name: _getOr(fm, 'name', _stem(cmdMd)),
            description: _truncate(fm['description'] ?? ''),
            extra,
            path: _relativeToPosix(cmdMd, ROOT),
        });
    }
    return _sortedKeys(seen).map((k) => seen.get(k) as Entry);
}

export function _collect_guidelines(): Entry[] {
    const out: Entry[] = [];
    if (!_exists(GUIDELINES)) {
        return out;
    }
    for (const gMd of _rglobMdSorted(GUIDELINES)) {
        const rel = _relativeToPosix(gMd, ROOT);
        const parent = path.dirname(gMd);
        // category = g_md.parent.name if g_md.parent != GUIDELINES else "(root)"
        const category = path.resolve(parent) !== path.resolve(GUIDELINES) ? _basename(parent) : '(root)';
        out.push({
            kind: 'guideline',
            name: _stem(gMd),
            description: '',
            extra: category,
            path: rel,
        });
    }
    return out;
}

/** `sorted(seen)` over Map keys. */
function _sortedKeys(m: Map<string, Entry>): string[] {
    return [...m.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Path rewriter for the public catalog. Mirrors `_to_shipped_path`: rewrite a
 * source path to its shipped `dist/agent-src/` surface, falling through to the
 * original when it is not under any source root.
 */
export function _to_shipped_path(p: string): string {
    const logical = strip_source_prefix(p);
    if (logical !== null) {
        return `dist/agent-src/${logical}`;
    }
    return p;
}

export function _render_table(
    entries: Entry[],
    cols: string[],
    linkPrefix: string,
    pathRewrite?: (p: string) => string,
): string {
    const rows = [
        '| ' + cols.join(' | ') + ' |',
        '|' + Array(cols.length).fill('---').join('|') + '|',
    ];
    for (const e of entries) {
        const p = pathRewrite ? pathRewrite(e.path) : e.path;
        const link = `[\`${e.name}\`](${linkPrefix}${p})`;
        const row = [e.kind, link, e.extra, e.description];
        rows.push('| ' + row.join(' | ') + ' |');
    }
    return rows.join('\n');
}

export function _render_index(
    skills: Entry[],
    rules: Entry[],
    commands: Entry[],
    guidelines: Entry[],
): string {
    const total = skills.length + rules.length + commands.length + guidelines.length;
    const parts = [
        '# Agent-Config Internal Index',
        '',
        `Maintainer-facing index of all **${total} artefacts** in this package.`,
        'Auto-generated from `.agent-src.uncondensed/` and `docs/guidelines/`.',
        '',
        '> **Regenerate:** `python3 scripts/generate_index.py`',
        '> **Drift check:** `python3 scripts/generate_index.py --check` (runs in `task ci`)',
        '> Do not edit manually.',
        '',
        `## Skills (${skills.length})`,
        '',
        _render_table(skills, ['kind', 'name', 'extra', 'description'], '../'),
        '',
        `## Rules (${rules.length})`,
        '',
        _render_table(rules, ['kind', 'name', 'type', 'description'], '../'),
        '',
        `## Commands (${commands.length})`,
        '',
        _render_table(commands, ['kind', 'name', 'cluster/shim', 'description'], '../'),
        '',
        `## Guidelines (${guidelines.length})`,
        '',
        _render_table(guidelines, ['kind', 'name', 'category', 'description'], '../'),
        '',
    ];
    return parts.join('\n');
}

export function _render_catalog(
    skills: Entry[],
    rules: Entry[],
    commands: Entry[],
    guidelines: Entry[],
): string {
    const publicRules = rules.filter((r) => !INTERNAL_RULES.has(r.name));
    const publicCommands = commands.filter((c) => c.kind === 'command');
    const total = skills.length + publicRules.length + publicCommands.length + guidelines.length;
    const parts = [
        '# agent-config — Public Catalog',
        '',
        `Consumer-facing catalog of all **${total} public artefacts** shipped by`,
        'this package. Internal package-maintenance rules and deprecation shims',
        'are excluded.',
        '',
        '> **Regenerate:** `python3 scripts/generate_index.py`',
        '> Auto-generated — do not edit manually.',
        '',
        `## Skills (${skills.length})`,
        '',
        _render_table(skills, ['kind', 'name', 'extra', 'description'], '../', _to_shipped_path),
        '',
        `## Rules (${publicRules.length})`,
        '',
        _render_table(publicRules, ['kind', 'name', 'type', 'description'], '../', _to_shipped_path),
        '',
        `## Commands (${publicCommands.length})`,
        '',
        _render_table(publicCommands, ['kind', 'name', 'cluster', 'description'], '../', _to_shipped_path),
        '',
        `## Guidelines (${guidelines.length})`,
        '',
        _render_table(guidelines, ['kind', 'name', 'category', 'description'], '../', _to_shipped_path),
        '',
        '---',
        '',
        '← [Back to README](../README.md)',
        '',
    ];
    return parts.join('\n');
}

interface ParsedArgs {
    check: boolean;
}

function parse_args(argv: string[]): ParsedArgs {
    const out: ParsedArgs = { check: false };
    for (const a of argv) {
        if (a === '--check') {
            out.check = true;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write('usage: generate_index [-h] [--check]\n');
            process.exit(0);
        }
    }
    return out;
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    const skills = _collect_skills();
    const rules = _collect_rules();
    const commands = _collect_commands();
    const guidelines = _collect_guidelines();

    const indexText = _render_index(skills, rules, commands, guidelines);
    const catalogText = _render_catalog(skills, rules, commands, guidelines);

    if (args.check) {
        const drift: string[] = [];
        if (!_exists(INDEX_PATH) || fs.readFileSync(INDEX_PATH, 'utf-8') !== indexText) {
            drift.push(_relativeToPosix(INDEX_PATH, ROOT));
        }
        if (!_exists(CATALOG_PATH) || fs.readFileSync(CATALOG_PATH, 'utf-8') !== catalogText) {
            drift.push(_relativeToPosix(CATALOG_PATH, ROOT));
        }
        if (drift.length > 0) {
            process.stdout.write('❌  Index drift detected — regenerate with:\n');
            process.stdout.write('    python3 scripts/generate_index.py\n');
            for (const d of drift) {
                process.stdout.write(`    - ${d}\n`);
            }
            return 1;
        }
        process.stdout.write('✅  Index files in sync.\n');
        return 0;
    }

    fs.mkdirSync(path.dirname(INDEX_PATH), { recursive: true });
    fs.mkdirSync(path.dirname(CATALOG_PATH), { recursive: true });
    fs.writeFileSync(INDEX_PATH, indexText, 'utf-8');
    fs.writeFileSync(CATALOG_PATH, catalogText, 'utf-8');
    process.stdout.write(
        `✅  Wrote ${_relativeToPosix(INDEX_PATH, ROOT)} (${skills.length} skills, ` +
            `${rules.length} rules, ${commands.length} commands, ${guidelines.length} guidelines)\n`,
    );
    process.stdout.write(`✅  Wrote ${_relativeToPosix(CATALOG_PATH, ROOT)} (public subset)\n`);
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}
