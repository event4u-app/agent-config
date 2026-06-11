#!/usr/bin/env tsx
/**
 * Condensation quality checker for agent-config packages.
 *
 * TypeScript twin of `src/scripts/check_condensation.py` (ADR-088 —
 * Python→TS migration, Phase 4 / Wave 4a). Mirrors the Python CLI
 * contract exactly: flags (`--format text|json`, `--summary`, `--root`),
 * exit codes (0 = clean, 1 = issues found, 3 = internal error),
 * stdout/stderr split, and byte-identical finding messages.
 *
 * Compares .agent-src.uncondensed/ source files with their dist/agent-src/
 * condensed versions. Checks that condensation preserved structural
 * integrity:
 * - All headings from source present in condensed
 * - All code blocks preserved exactly
 * - YAML frontmatter identical
 * - Word count reduction within healthy range (10-60%)
 * - Iron Law sections (## Iron Law / ### Iron Law / ## The Iron Law /
 *   Iron Laws / numbered) preserved per `preservation-guard`: heading
 *   verbatim at original level, structural-unit survival.
 *
 * The Python original imports `_rewrite_paths` from `condense.py` to
 * normalise the source side through the same path transformations the
 * condenseor applies. `condense.py` is not yet ported (later phase), so
 * that path-rewriter chain is replicated faithfully below as a private
 * port; behaviour is byte-for-byte with `condense._rewrite_paths`.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

type Severity = 'error' | 'warning' | 'info';

const SOURCE_DIR = '.agent-src.uncondensed';
const TARGET_DIR = 'dist/agent-src';

interface Issue {
    file: string;
    check: string;
    severity: Severity;
    message: string;
}

// ---------------------------------------------------------------------------
// Python parity helpers
// ---------------------------------------------------------------------------

/** Python `str.splitlines()` — splits on a fixed set of line boundaries.
 * For the inputs here (plain `\n`, occasional `\r\n`) the universal-newline
 * behaviour matters; replicate Python's boundary set. A trailing newline
 * does NOT yield a final empty element (matching Python). */
function splitlines(text: string): string[] {
    if (text === '') return [];
    // Python splitlines boundaries (the ones reachable in markdown text):
    // \n \r \r\n \v \f \x1c \x1d \x1e \x85
    const lines: string[] = [];
    let current = '';
    for (let i = 0; i < text.length; i++) {
        const ch = text[i] as string;
        const code = text.charCodeAt(i);
        if (ch === '\r') {
            lines.push(current);
            current = '';
            if (text[i + 1] === '\n') i += 1; // \r\n consumed as one
            continue;
        }
        if (
            ch === '\n' ||
            code === 0x0b ||
            code === 0x0c ||
            code === 0x1c ||
            code === 0x1d ||
            code === 0x1e ||
            code === 0x85 ||
            code === 0x2028 ||
            code === 0x2029
        ) {
            lines.push(current);
            current = '';
            continue;
        }
        current += ch;
    }
    if (current !== '') lines.push(current);
    return lines;
}

/** Python `str.split()` with no args — split on runs of whitespace,
 * dropping leading/trailing empties. Returns the token count proxy. */
function wordCount(text: string): number {
    const tokens = text.split(/\s+/u).filter((t) => t.length > 0);
    return tokens.length;
}

/** Python `str.strip()` — strip leading/trailing whitespace (Unicode). */
function pyStrip(s: string): string {
    return s.replace(/^\s+/u, '').replace(/\s+$/u, '');
}

/** Python `str.rstrip()` with no args — strip trailing whitespace. */
function pyRstrip(s: string): string {
    return s.replace(/\s+$/u, '');
}

/** Python `str.lstrip("# ")` — strip leading chars from the set {'#', ' '}. */
function lstripHashSpace(s: string): string {
    let i = 0;
    while (i < s.length && (s[i] === '#' || s[i] === ' ')) i += 1;
    return s.slice(i);
}

/** Format a fraction like Python `f"{x:.0f}"` (round half to even). */
function fmt0f(x: number): string {
    return pythonFormatFixed(x, 0);
}

/** Python `format(x, f".{n}f")` — round-half-to-even fixed-point. */
function pythonFormatFixed(x: number, n: number): string {
    if (!Number.isFinite(x)) return String(x);
    const neg = x < 0;
    const abs = Math.abs(x);
    const factor = 10 ** n;
    const scaled = abs * factor;
    let rounded = Math.round(scaled);
    // round-half-to-even
    if (Math.abs(scaled - Math.trunc(scaled) - 0.5) < 1e-9) {
        const floor = Math.floor(scaled);
        rounded = floor % 2 === 0 ? floor : floor + 1;
    }
    const val = rounded / factor;
    let out = val.toFixed(n);
    if (neg && Number.parseFloat(out) !== 0) out = `-${out}`;
    return out;
}

// ---------------------------------------------------------------------------
// _rewrite_paths — faithful port of condense.py's path-rewriter chain.
// `condense.py` is not yet migrated; this replicates _rewrite_paths and its
// helpers byte-for-byte so the source side normalises identically.
// ---------------------------------------------------------------------------

const _LEGACY_SRC_PREFIX = '.agent-src.uncondensed/';
const _PROJECTED_SRC_PREFIX = 'dist/agent-src/';
const _LEGACY_PROJECTED_SRC_PREFIX = '.agent-src/';

// A YAML list item under load_context*: `  - some/path.md` (optionally quoted)
const _FM_LIST_ITEM_RE = /^(\s*-\s*)(["']?)([^"'\n]+?\.md)(["']?)\s*$/;
// `path_prefix:` line — top-level or under `triggers:` (with leading dash)
const _FM_PATH_PREFIX_RE = /^(\s*(?:-\s+)?path_prefix:\s*)(["']?)([^"'\n]+?)(["']?)\s*$/;
// Body-link patterns (relative two-up to docs/) — capture the docs/... tail
const _BODY_DOCS_RE = /\.\.\/\.\.\/(docs\/(?:guidelines|contracts)\/[^)\s]+\.md)/g;
// Plain YAML list item — any scalar (packs: / workspaces: blocks)
const _FM_PLAIN_LIST_RE = /^\s*-\s*(["']?)([^"'\n]+?)\1\s*$/;

const _HRR_BANNER_MARKER = '<!-- agent-config:human-review-banner -->';

function _depthPrefix(sourceRelativePath: string): string {
    // Python: Path(...).parts — split on path separators, drop empty parts.
    const parts = sourceRelativePath.split('/').filter((p) => p.length > 0);
    const depth = Math.max(parts.length - 1, 1);
    return '../'.repeat(depth);
}

function _splitFrontmatter(content: string): [string[] | null, string] {
    if (!content.startsWith('---\n')) return [null, content];
    const end = content.indexOf('\n---\n', 4);
    if (end === -1) return [null, content];
    const fmText = content.slice(4, end);
    const body = content.slice(end + '\n---\n'.length);
    return [fmText.split('\n'), body];
}

function _rewriteLoadContextValue(value: string, prefix: string): string {
    if (value.startsWith('../') || value.startsWith('./') || value.startsWith('/')) {
        return value;
    }
    if (value.startsWith(_LEGACY_SRC_PREFIX)) {
        return prefix + value.slice(_LEGACY_SRC_PREFIX.length);
    }
    if (value.startsWith(_PROJECTED_SRC_PREFIX)) {
        return prefix + value.slice(_PROJECTED_SRC_PREFIX.length);
    }
    if (value.startsWith(_LEGACY_PROJECTED_SRC_PREFIX)) {
        return prefix + value.slice(_LEGACY_PROJECTED_SRC_PREFIX.length);
    }
    return prefix + value;
}

function _rewritePathPrefixValue(value: string): string {
    // No-op — path_prefix: is a literal match pattern, not a file reference.
    return value;
}

function _lstrip(s: string): string {
    return s.replace(/^\s+/u, '');
}

function _rewriteFrontmatterLines(lines: string[], prefix: string): string[] {
    let inLoadContext = false;
    const out: string[] = [];
    for (const line of lines) {
        const bare = _lstrip(line);
        if (bare.startsWith('load_context:') || bare.startsWith('load_context_eager:')) {
            inLoadContext = true;
            out.push(line);
            continue;
        }
        if (inLoadContext) {
            const m = _FM_LIST_ITEM_RE.exec(line);
            if (m) {
                const indent = m[1] ?? '';
                const q1 = m[2] ?? '';
                const value = m[3] ?? '';
                const q2 = m[4] ?? '';
                const rewritten = _rewriteLoadContextValue(value, prefix);
                out.push(`${indent}${q1}${rewritten}${q2}`);
                continue;
            }
            inLoadContext = false;
            // fall through to path_prefix / passthrough
        }
        const pm = _FM_PATH_PREFIX_RE.exec(line);
        if (pm) {
            const head = pm[1] ?? '';
            const q1 = pm[2] ?? '';
            const value = pm[3] ?? '';
            const q2 = pm[4] ?? '';
            out.push(`${head}${q1}${_rewritePathPrefixValue(value)}${q2}`);
            continue;
        }
        out.push(line);
    }
    return out;
}

function _rewriteBodyLinks(body: string, prefix: string): string {
    return body.replace(_BODY_DOCS_RE, (_match, tail: string) => prefix + tail);
}

function _parseTrustAndOwner(fmLines: string[]): [string, boolean, string] {
    let level = 'core';
    let hrr = false;
    const packs: string[] = [];
    const workspaces: string[] = [];
    let inTrust = false;
    let inPacks = false;
    let inWorkspaces = false;
    for (const line of fmLines) {
        const stripped = _lstrip(line);
        const indent = line.length - stripped.length;
        if (indent === 0 && stripped.endsWith(':')) {
            const key = stripped.slice(0, -1);
            inTrust = key === 'trust';
            inPacks = key === 'packs';
            inWorkspaces = key === 'workspaces';
            continue;
        }
        if (inTrust && stripped.startsWith('level:')) {
            level = pyStrip(pyStrip(pyStrip(stripped.split(/:(.*)/s)[1] ?? '')).replace(/^"|"$/g, '')).replace(
                /^'|'$/g,
                '',
            );
            // Python: stripped.split(":", 1)[1].strip().strip('"').strip("'")
            const after = stripped.slice(stripped.indexOf(':') + 1);
            level = stripDoubleSingle(pyStrip(after));
        } else if (inTrust && stripped.startsWith('human_review_required:')) {
            const after = stripped.slice(stripped.indexOf(':') + 1);
            const val = pyStrip(after);
            hrr = val.toLowerCase() === 'true';
        } else if (inPacks || inWorkspaces) {
            const m = _FM_PLAIN_LIST_RE.exec(line);
            if (m) {
                const value = pyStrip(m[2] ?? '');
                (inPacks ? packs : workspaces).push(value);
            }
        }
    }
    let owner = 'unknown';
    if (packs.length > 0) {
        owner = (packs[0] ?? '').split('-')[0] ?? '';
    } else if (workspaces.length > 0) {
        owner = workspaces[0] ?? '';
    }
    return [level, hrr, owner];
}

/** Python `.strip('"').strip("'")` — strip leading/trailing chars from a set. */
function stripChars(s: string, chars: string): string {
    let start = 0;
    let end = s.length;
    while (start < end && chars.includes(s[start] as string)) start += 1;
    while (end > start && chars.includes(s[end - 1] as string)) end -= 1;
    return s.slice(start, end);
}

function stripDoubleSingle(s: string): string {
    return stripChars(stripChars(s, '"'), "'");
}

function _injectHrrBanner(body: string, level: string, owner: string): string {
    if (body.includes(_HRR_BANNER_MARKER)) return body;
    const banner = `${_HRR_BANNER_MARKER}\n> HUMAN REVIEW REQUIRED · trust: ${level} · owner: ${owner}\n\n`;
    return banner + body.replace(/^\n+/, '');
}

function _rewritePaths(content: string, sourceRelativePath: string): string {
    const prefix = _depthPrefix(sourceRelativePath);
    const [fmLines, bodyInitial] = _splitFrontmatter(content);
    let body = _rewriteBodyLinks(bodyInitial, prefix);
    if (fmLines === null) return body;
    const newFm = _rewriteFrontmatterLines(fmLines, prefix);
    const [level, hrr, owner] = _parseTrustAndOwner(fmLines);
    if (hrr && level) {
        body = _injectHrrBanner(body, level, owner);
    }
    return `---\n${newFm.join('\n')}\n---\n${body}`;
}

// ---------------------------------------------------------------------------
// Extraction helpers (port of check_condensation.py)
// ---------------------------------------------------------------------------

function extractHeadings(text: string): string[] {
    const headings: string[] = [];
    let inCode = false;
    for (const line of splitlines(text)) {
        if (pyStrip(line).startsWith('```')) {
            inCode = !inCode;
            continue;
        }
        if (!inCode && /^#{1,6}\s+.+$/.test(line)) {
            headings.push(line);
        }
    }
    return headings;
}

function extractCodeBlocks(text: string): string[] {
    // Python: re.findall(r"```[^\n]*\n(.*?)```", text, re.DOTALL)
    const re = /```[^\n]*\n([\s\S]*?)```/g;
    const out: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        out.push(m[1] ?? '');
    }
    return out;
}

function extractFrontmatter(text: string): string {
    // Python: re.match(r"^---\n(.*?\n)---", text, re.DOTALL)
    const m = /^---\n([\s\S]*?\n)---/.exec(text);
    return m ? pyStrip(m[1] ?? '') : '';
}

const IRON_LAW_HEADING = /^(#{2,6})\s+(The\s+)?Iron Laws?\b/;
const LIST_ITEM_RE = /^(?:[-*+]|\d+\.)\s/;
const INNER_HEADING_RE = /^#{1,6}\s/;

interface Struct {
    paragraphs: number;
    list_items: number;
    code_blocks: number;
}

function countIronLawStructure(body: string): Struct {
    let paragraphs = 0;
    let listItems = 0;
    let codeBlocks = 0;
    let inCode = false;
    let state: 'blank' | 'paragraph' | 'list' = 'blank';
    for (const line of splitlines(body)) {
        const stripped = pyStrip(line);
        if (stripped.startsWith('```')) {
            if (!inCode) codeBlocks += 1;
            inCode = !inCode;
            state = 'blank';
            continue;
        }
        if (inCode) continue;
        if (!stripped) {
            state = 'blank';
            continue;
        }
        if (LIST_ITEM_RE.test(stripped)) {
            listItems += 1;
            state = 'list';
            continue;
        }
        if (INNER_HEADING_RE.test(stripped)) {
            state = 'blank';
            continue;
        }
        // Indented non-empty line right after a list item is a wrap
        // continuation of that item, not a new paragraph.
        if (state === 'list' && (line.startsWith(' ') || line.startsWith('\t'))) {
            continue;
        }
        if (state !== 'paragraph') {
            paragraphs += 1;
            state = 'paragraph';
        }
    }
    return { paragraphs, list_items: listItems, code_blocks: codeBlocks };
}

function extractIronLawSections(text: string): Array<[string, number, string]> {
    const lines = splitlines(text);
    const sections: Array<[string, number, string]> = [];
    let i = 0;
    let inCode = false;
    while (i < lines.length) {
        const line = lines[i] as string;
        if (pyStrip(line).startsWith('```')) {
            inCode = !inCode;
            i += 1;
            continue;
        }
        if (!inCode) {
            const m = IRON_LAW_HEADING.exec(line);
            if (m) {
                const heading = pyRstrip(line);
                const level = (m[1] ?? '').length;
                const bodyLines: string[] = [];
                let j = i + 1;
                let innerCode = false;
                while (j < lines.length) {
                    const jline = lines[j] as string;
                    if (pyStrip(jline).startsWith('```')) {
                        innerCode = !innerCode;
                    }
                    if (!innerCode) {
                        const hm = /^(#{1,6})\s/.exec(jline);
                        if (hm && (hm[1] ?? '').length <= level) break;
                    }
                    bodyLines.push(jline);
                    j += 1;
                }
                sections.push([heading, level, bodyLines.join('\n')]);
                i = j;
                continue;
            }
        }
        i += 1;
    }
    return sections;
}

// ---------------------------------------------------------------------------
// Core comparison
// ---------------------------------------------------------------------------

function checkPair(relPath: string, source: string, condensed: string): Issue[] {
    const issues: Issue[] = [];

    // Frontmatter check
    const srcFm = extractFrontmatter(source);
    const cmpFm = extractFrontmatter(condensed);
    if (srcFm && srcFm !== cmpFm) {
        issues.push({
            file: relPath,
            check: 'frontmatter_mismatch',
            severity: 'error',
            message: 'YAML frontmatter differs between source and condensed',
        });
    }

    // Heading preservation — check H1 and H2 headings
    const srcHeadings = extractHeadings(source);
    const cmpHeadings = extractHeadings(condensed);
    for (const h of srcHeadings) {
        if (h.startsWith('# ') || (h.startsWith('## ') && !h.startsWith('### '))) {
            if (!cmpHeadings.includes(h)) {
                issues.push({
                    file: relPath,
                    check: 'missing_heading',
                    severity: 'warning',
                    message: `H1/H2 heading lost during condensation: ${h}`,
                });
            }
        }
    }

    // Code block preservation
    const srcBlocks = extractCodeBlocks(source);
    const cmpBlocks = extractCodeBlocks(condensed);
    if (srcBlocks.length > cmpBlocks.length) {
        issues.push({
            file: relPath,
            check: 'lost_code_blocks',
            severity: 'error',
            message: `Code blocks lost: source has ${srcBlocks.length}, condensed has ${cmpBlocks.length}`,
        });
    }
    for (let i = 0; i < srcBlocks.length; i++) {
        const block = srcBlocks[i] as string;
        if (i < cmpBlocks.length && pyStrip(block) !== pyStrip(cmpBlocks[i] as string)) {
            // Only flag if content actually changed (not just whitespace)
            const a = block.replace(/ /g, '').replace(/\n/g, '');
            const b = (cmpBlocks[i] as string).replace(/ /g, '').replace(/\n/g, '');
            if (a !== b) {
                issues.push({
                    file: relPath,
                    check: 'modified_code_block',
                    severity: 'error',
                    message: `Code block ${i + 1} content changed during condensation`,
                });
            }
        }
    }

    // Iron Law preservation
    const srcLaws = extractIronLawSections(source);
    const cmpLaws = extractIronLawSections(condensed);
    const cmpLawMap = new Map<string, [number, string]>();
    for (const [h, lvl, body] of cmpLaws) cmpLawMap.set(h, [lvl, body]);
    const cmpLawByText = new Map<string, [number, string, string]>();
    for (const [h, lvl, body] of cmpLaws) {
        cmpLawByText.set(pyStrip(lstripHashSpace(h)), [lvl, h, body]);
    }
    for (const [srcHeading, srcLevel, srcBody] of srcLaws) {
        const srcText = pyStrip(lstripHashSpace(srcHeading));
        if (!cmpLawMap.has(srcHeading)) {
            if (cmpLawByText.has(srcText)) {
                const [cmpLevel] = cmpLawByText.get(srcText) as [number, string, string];
                if (cmpLevel !== srcLevel) {
                    issues.push({
                        file: relPath,
                        check: 'iron_law_heading_downgrade',
                        severity: 'error',
                        message:
                            `Iron Law heading level changed: ` +
                            `${'#'.repeat(srcLevel)} → ${'#'.repeat(cmpLevel)} ` +
                            `(${pyStrip(srcHeading)})`,
                    });
                    continue;
                }
            }
            issues.push({
                file: relPath,
                check: 'iron_law_missing',
                severity: 'error',
                message: `Iron Law section removed during condensation: ${pyStrip(srcHeading)}`,
            });
            continue;
        }
        const [, cmpBody] = cmpLawMap.get(srcHeading) as [number, string];
        const srcStruct = countIronLawStructure(srcBody);
        const cmpStruct = countIronLawStructure(cmpBody);
        const kinds: Array<keyof Struct> = ['paragraphs', 'list_items', 'code_blocks'];
        for (const kind of kinds) {
            const srcN = srcStruct[kind];
            const cmpN = cmpStruct[kind];
            if (cmpN < srcN) {
                issues.push({
                    file: relPath,
                    check: 'iron_law_passage_dropped',
                    severity: 'error',
                    message:
                        `Iron Law section dropped ` +
                        `${srcN - cmpN} ${kind} ` +
                        `(${srcN} → ${cmpN}): ` +
                        `${pyStrip(srcHeading)}`,
                });
            }
        }
    }

    // Word count ratio
    const srcWords = wordCount(source);
    const cmpWords = wordCount(condensed);
    if (srcWords > 0) {
        const reduction = (1 - cmpWords / srcWords) * 100;
        if (reduction > 60) {
            issues.push({
                file: relPath,
                check: 'excessive_reduction',
                severity: 'warning',
                message:
                    `Condensation reduced ${fmt0f(reduction)}% — possible content loss ` +
                    `(${srcWords} → ${cmpWords} words)`,
            });
        } else if (reduction < 5 && srcWords > 100) {
            issues.push({
                file: relPath,
                check: 'minimal_reduction',
                severity: 'info',
                message: `Condensation only reduced ${fmt0f(reduction)}% (${srcWords} → ${cmpWords} words)`,
            });
        }
    }

    return issues;
}

/** Recursively collect *.md files, sorted like Python's sorted(rglob). */
function rglobMdSorted(dir: string): string[] {
    const out: string[] = [];
    function walk(current: string): void {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                out.push(full);
            }
        }
    }
    walk(dir);
    // Python sorted() on Path objects sorts by string form of the full path.
    out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return out;
}

function scanAll(root: string): Issue[] {
    const issues: Issue[] = [];
    const sourceDir = path.join(root, SOURCE_DIR);
    const targetDir = path.join(root, TARGET_DIR);

    if (!fs.existsSync(sourceDir) || !fs.existsSync(targetDir)) {
        return issues;
    }

    for (const sourceFile of rglobMdSorted(sourceDir)) {
        const rel = path.relative(sourceDir, sourceFile);
        const targetFile = path.join(targetDir, rel);

        if (!fs.existsSync(targetFile)) {
            continue; // sync-check handles missing files
        }

        const relStr = rel.split(path.sep).join('/');
        if (relStr.startsWith('commands/')) {
            continue;
        }

        let sourceText = fs.readFileSync(sourceFile, 'utf-8');
        const targetText = fs.readFileSync(targetFile, 'utf-8');
        sourceText = _rewritePaths(sourceText, relStr);
        issues.push(...checkPair(relStr, sourceText, targetText));
    }

    return issues;
}

function formatText(issues: Issue[]): string {
    if (issues.length === 0) {
        return '✅  Condensation quality check passed.';
    }
    const icons: Record<Severity, string> = { error: '🔴', warning: '🟡', info: 'ℹ️' };
    const lines = [`Found ${issues.length} condensation quality issue(s):\n`];
    for (const i of issues) {
        lines.push(`  ${icons[i.severity]} [${i.check}] ${i.file}: ${i.message}`);
    }
    const errors = issues.filter((i) => i.severity === 'error').length;
    if (errors) {
        lines.push(`\n❌  ${errors} error(s) must be fixed.`);
    }
    return lines.join('\n');
}

function scanSummary(root: string): string {
    const sourceDir = path.join(root, SOURCE_DIR);
    const targetDir = path.join(root, TARGET_DIR);
    if (!fs.existsSync(sourceDir) || !fs.existsSync(targetDir)) {
        return 'No source/target directories found.';
    }

    const categories = new Map<string, Array<[number, number]>>();
    for (const sourceFile of rglobMdSorted(sourceDir)) {
        const rel = path.relative(sourceDir, sourceFile);
        const relStr = rel.split(path.sep).join('/');
        const targetFile = path.join(targetDir, rel);
        if (!fs.existsSync(targetFile) || relStr.startsWith('commands/')) {
            continue;
        }
        const srcWords = wordCount(fs.readFileSync(sourceFile, 'utf-8'));
        const cmpWords = wordCount(fs.readFileSync(targetFile, 'utf-8'));
        const parts = relStr.split('/');
        const cat = parts.length > 1 ? (parts[0] as string) : 'root';
        if (!categories.has(cat)) categories.set(cat, []);
        (categories.get(cat) as Array<[number, number]>).push([srcWords, cmpWords]);
    }

    const lines = [
        'Category         | Files | Avg Source | Avg Condensed | Avg Reduction',
        '---              | ---   | ---        | ---            | ---',
    ];
    let totalSrc = 0;
    let totalCmp = 0;
    let totalFiles = 0;
    for (const cat of [...categories.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
        const pairs = categories.get(cat) as Array<[number, number]>;
        const n = pairs.length;
        const avgSrc = Math.floor(pairs.reduce((s, [v]) => s + v, 0) / n);
        const avgCmp = Math.floor(pairs.reduce((s, [, v]) => s + v, 0) / n);
        const reduction = avgSrc > 0 ? (1 - avgCmp / avgSrc) * 100 : 0;
        lines.push(
            `${padRight(cat, 17)}| ${padLeft(String(n), 5)} | ${padLeft(String(avgSrc), 10)} | ` +
                `${padLeft(String(avgCmp), 14)} | ${padLeft(`${fmt0f(reduction)}%`, 6)}`,
        );
        totalSrc += pairs.reduce((s, [v]) => s + v, 0);
        totalCmp += pairs.reduce((s, [, v]) => s + v, 0);
        totalFiles += n;
    }
    const overall = totalSrc > 0 ? (1 - totalCmp / totalSrc) * 100 : 0;
    const denom = Math.max(totalFiles, 1);
    lines.push(
        `${padRight('TOTAL', 17)}| ${padLeft(String(totalFiles), 5)} | ` +
            `${padLeft(String(Math.floor(totalSrc / denom)), 10)} | ` +
            `${padLeft(String(Math.floor(totalCmp / denom)), 14)} | ${padLeft(`${fmt0f(overall)}%`, 6)}`,
    );
    return lines.join('\n');
}

/** Python f-string `{x:<n}` — left-justify, pad right with spaces. */
function padRight(s: string, width: number): string {
    return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

/** Python f-string `{x:>n}` — right-justify, pad left with spaces. */
function padLeft(s: string, width: number): string {
    return s.length >= width ? s : ' '.repeat(width - s.length) + s;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const PROG = 'check_condensation.py';

interface ParsedArgs {
    format: 'text' | 'json';
    summary: boolean;
    root: string;
}

class ArgError extends Error {}

function parseArgs(argv: readonly string[]): ParsedArgs {
    const parsed: ParsedArgs = { format: 'text', summary: false, root: '.' };
    let i = 0;
    while (i < argv.length) {
        const arg = argv[i] as string;
        if (arg === '-h' || arg === '--help') {
            process.stdout.write(usageText());
            process.exit(0);
        } else if (arg === '--summary') {
            parsed.summary = true;
            i += 1;
        } else if (arg === '--format' || arg.startsWith('--format=')) {
            let value: string;
            if (arg.startsWith('--format=')) {
                value = arg.slice('--format='.length);
                i += 1;
            } else {
                if (i + 1 >= argv.length) {
                    throw new ArgError(`argument --format: expected one argument`);
                }
                value = argv[i + 1] as string;
                i += 2;
            }
            if (value !== 'text' && value !== 'json') {
                throw new ArgError(
                    `argument --format: invalid choice: '${value}' (choose from 'text', 'json')`,
                );
            }
            parsed.format = value;
        } else if (arg === '--root' || arg.startsWith('--root=')) {
            if (arg.startsWith('--root=')) {
                parsed.root = arg.slice('--root='.length);
                i += 1;
            } else {
                if (i + 1 >= argv.length) {
                    throw new ArgError(`argument --root: expected one argument`);
                }
                parsed.root = argv[i + 1] as string;
                i += 2;
            }
        } else {
            throw new ArgError(`unrecognized arguments: ${arg}`);
        }
    }
    return parsed;
}

/** Python json.dumps(ensure_ascii=True) — escape any char > 0x7F as \uXXXX
 * (or surrogate pairs for astral). JSON.stringify already escapes control
 * chars and quotes; this only widens the escape set to all non-ASCII. */
function ensureAscii(json: string): string {
    let out = '';
    for (let i = 0; i < json.length; i++) {
        const code = json.charCodeAt(i);
        if (code > 0x7f) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else {
            out += json[i];
        }
    }
    return out;
}

// argparse usage block. Width-dependent in CPython; matches the default
// 80-column wrap under Python 3.9 (current toolchain). The "optional
// arguments:" label is the 3.9 spelling — Python ≥ 3.10 prints "options:".
// CI never invokes --help / a bad flag on this checker, so this surface is
// reference-only. See the divergence note in the migration report.
function usageLine(): string {
    return (
        `usage: ${PROG} [-h] [--format {text,json}] [--summary]\n` +
        `                             [--root ROOT]\n`
    );
}

function usageText(): string {
    return (
        usageLine() +
        '\n' +
        'Check condensation quality\n' +
        '\n' +
        'optional arguments:\n' +
        '  -h, --help            show this help message and exit\n' +
        '  --format {text,json}\n' +
        '  --summary             Show per-category condensation stats\n' +
        '  --root ROOT\n'
    );
}

function main(): number {
    let args: ParsedArgs;
    try {
        args = parseArgs(process.argv.slice(2));
    } catch (e) {
        if (e instanceof ArgError) {
            process.stderr.write(usageLine());
            process.stderr.write(`${PROG}: error: ${e.message}\n`);
            return 2;
        }
        throw e;
    }

    if (args.summary) {
        process.stdout.write(`${scanSummary(args.root)}\n`);
        return 0;
    }

    let issues: Issue[];
    try {
        issues = scanAll(args.root);
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        process.stderr.write(`Internal error: ${msg}\n`);
        return 3;
    }

    if (args.format === 'json') {
        const payload = issues.map((i) => ({
            file: i.file,
            check: i.check,
            severity: i.severity,
            message: i.message,
        }));
        // Python json.dumps defaults ensure_ascii=True — escape non-ASCII.
        process.stdout.write(`${ensureAscii(JSON.stringify(payload, null, 2))}\n`);
    } else {
        process.stdout.write(`${formatText(issues)}\n`);
    }

    const errors = issues.filter((i) => i.severity === 'error');
    return errors.length > 0 ? 1 : 0;
}

const isMain =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
    process.exit(main());
}

export {
    checkPair,
    countIronLawStructure,
    extractCodeBlocks,
    extractFrontmatter,
    extractHeadings,
    extractIronLawSections,
    formatText,
    scanAll,
    scanSummary,
    type Issue,
    type Severity,
};
