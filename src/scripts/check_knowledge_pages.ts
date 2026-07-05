#!/usr/bin/env tsx
/**
 * Warn-only lint for the lifecycle-typed knowledge pages —
 * road-to-knowledge-system Phase 2. Scans
 * `agents/knowledge/{sessions,concepts,procedures,decisions}/*.md`.
 *
 * Deliberately SEPARATE from `check_knowledge_cards.ts` (a byte-faithful
 * parity twin of its retired Python original — never touched here) and
 * deliberately warn-only: schema-as-contract for these pages is explicitly
 * deferred (2026-07-05 council verdict) until real team usage data exists.
 * This script never fails the build; it surfaces drift for a human to act
 * on during consolidation.
 *
 * Checks:
 *   - `type` (if present) is one of concept|procedure|session|decision
 *   - `scope` (if present) is one of user|project|global
 *   - `visibility` (if present) is one of private|project|team
 *   - `review_after` (if present): valid YYYY-MM-DD; flagged if in the past
 *   - `contested` (if present): flagged when it carries >= 2 entries
 *   - page body (excluding frontmatter) is <= 200 lines
 *
 * Usage: check_knowledge_pages.ts [--dir <repo-root>] [--format text|json] [--quiet]
 * Exit codes: 0 = ran cleanly (warnings do not fail the build), 1 = usage
 * error, 3 = internal error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const PROG = 'check_knowledge_pages.ts';
const PAGE_LINE_BUDGET = 200;
const CONTESTED_WARN_COUNT = 2;

const TYPED_DIRS = ['sessions', 'concepts', 'procedures', 'decisions'] as const;
const VALID_TYPE = new Set(['concept', 'procedure', 'session', 'decision']);
const VALID_SCOPE = new Set(['user', 'project', 'global']);
const VALID_VISIBILITY = new Set(['private', 'project', 'team']);

const FRONTMATTER_RE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface Warning {
    file: string; // path relative to --dir
    rule: string;
    message: string;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function readFrontmatter(body: string): Record<string, unknown> {
    const m = FRONTMATTER_RE.exec(body);
    if (!m) return {};
    try {
        const parsed = YAML.parse(m[1]);
        return isPlainObject(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

function bodyLineCount(body: string): number {
    const withoutFrontmatter = body.replace(FRONTMATTER_RE, '');
    // Trailing newline shouldn't count as an extra "line".
    const trimmed = withoutFrontmatter.replace(/\n$/, '');
    return trimmed.length === 0 ? 0 : trimmed.split('\n').length;
}

/** Lint a single page's already-read content. Pure — no filesystem access — for direct unit testing. */
export function lintPage(relPath: string, content: string, today: Date = new Date()): Warning[] {
    const warnings: Warning[] = [];
    const fm = readFrontmatter(content);

    const type = fm.type;
    if (typeof type === 'string' && !VALID_TYPE.has(type)) {
        warnings.push({ file: relPath, rule: 'type', message: `unknown type "${type}" (expected one of concept|procedure|session|decision)` });
    }

    const scope = fm.scope;
    if (typeof scope === 'string' && !VALID_SCOPE.has(scope)) {
        warnings.push({ file: relPath, rule: 'scope', message: `unknown scope "${scope}" (expected one of user|project|global)` });
    }

    const visibility = fm.visibility;
    if (typeof visibility === 'string' && !VALID_VISIBILITY.has(visibility)) {
        warnings.push({
            file: relPath,
            rule: 'visibility',
            message: `unknown visibility "${visibility}" (expected one of private|project|team)`,
        });
    }

    const reviewAfter = fm.review_after;
    if (typeof reviewAfter === 'string') {
        if (!DATE_RE.test(reviewAfter)) {
            warnings.push({ file: relPath, rule: 'review_after', message: `review_after "${reviewAfter}" is not YYYY-MM-DD` });
        } else {
            const due = new Date(`${reviewAfter}T00:00:00Z`);
            if (!Number.isNaN(due.getTime()) && due.getTime() < today.getTime()) {
                warnings.push({ file: relPath, rule: 'review_after', message: `review_after ${reviewAfter} is in the past — due for review` });
            }
        }
    }

    const contested = fm.contested;
    if (Array.isArray(contested) && contested.length >= CONTESTED_WARN_COUNT) {
        warnings.push({
            file: relPath,
            rule: 'contested',
            message: `${contested.length} unresolved contested entries — needs consolidation attention`,
        });
    }

    const lineCount = bodyLineCount(content);
    if (lineCount > PAGE_LINE_BUDGET) {
        warnings.push({ file: relPath, rule: 'size', message: `${lineCount} lines exceeds the ${PAGE_LINE_BUDGET}-line page budget` });
    }

    return warnings;
}

function listMarkdownFiles(dirPath: string): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
        return [];
    }
    return entries
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.md'))
        .map((e) => e.name)
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function lintAll(knowledgeRoot: string, today: Date = new Date()): Warning[] {
    const warnings: Warning[] = [];
    for (const dir of TYPED_DIRS) {
        const scanDir = path.join(knowledgeRoot, dir);
        for (const file of listMarkdownFiles(scanDir)) {
            const relPath = `${dir}/${file}`;
            let content: string;
            try {
                content = fs.readFileSync(path.join(scanDir, file), 'utf8');
            } catch {
                continue;
            }
            warnings.push(...lintPage(relPath, content, today));
        }
    }
    return warnings;
}

function printUsage(): void {
    process.stdout.write(`usage: ${PROG} [--dir DIR] [--format text|json] [--quiet]\n`);
}

export function main(argv: string[]): number {
    let dir = process.cwd();
    let format: 'text' | 'json' = 'text';
    let quiet = false;

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '-h' || arg === '--help') {
            printUsage();
            return 0;
        } else if (arg === '--dir') {
            dir = argv[++i] ?? dir;
        } else if (arg === '--format') {
            const value = argv[++i];
            if (value !== 'text' && value !== 'json') {
                process.stderr.write(`${PROG}: error: --format must be text or json\n`);
                return 1;
            }
            format = value;
        } else if (arg === '--quiet') {
            quiet = true;
        } else {
            process.stderr.write(`${PROG}: error: unrecognized argument: ${arg}\n`);
            printUsage();
            return 1;
        }
    }

    const knowledgeRoot = path.join(dir, 'agents', 'knowledge');
    const warnings = lintAll(knowledgeRoot);

    if (format === 'json') {
        process.stdout.write(JSON.stringify(warnings, null, 2) + '\n');
        return 0;
    }

    if (warnings.length === 0) {
        if (!quiet) process.stdout.write(`${PROG}: no warnings.\n`);
        return 0;
    }

    for (const w of warnings) {
        process.stdout.write(`🟡 ${w.file}: [${w.rule}] ${w.message}\n`);
    }
    if (!quiet) process.stdout.write(`${PROG}: ${warnings.length} warning(s) — non-blocking.\n`);
    return 0;
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
    process.exit(main(process.argv.slice(2)));
}
