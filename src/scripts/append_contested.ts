#!/usr/bin/env tsx
/**
 * Contested-annotation writer — road-to-knowledge-system Phase 5. When a
 * live contradiction is found between a knowledge page and observed
 * reality and the user declines an immediate fix (see the hybrid
 * immediate-fix flow in `knowledge-pages.md`), this appends an
 * append-only `contested:` entry to the page's frontmatter — never a
 * silent rewrite of the claimed content. `check_knowledge_pages.ts`
 * already warns once a page carries 2+ unresolved entries; this script
 * is the writer half of that contract.
 *
 * Usage:
 *   append_contested.ts --page <path> --trigger <trigger> --evidence "<text>" --session <id> --timestamp <ISO-8601>
 *
 * Exit codes: 0 = appended, 1 = usage error / page not found, 3 = internal error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const PROG = 'append_contested.ts';
const FRONTMATTER_RE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n/;

export interface ContestedEntry {
    timestamp: string;
    trigger: string;
    evidence: string;
    session: string;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Appends `entry` to the page's frontmatter `contested:` array (creating the array/frontmatter block if absent). The page body is never touched. */
export function appendContestedEntry(content: string, entry: ContestedEntry): string {
    const match = FRONTMATTER_RE.exec(content);
    const body = match ? content.slice(match[0].length) : content;

    let fm: Record<string, unknown> = {};
    if (match) {
        const parsed = YAML.parse(match[1]);
        if (isPlainObject(parsed)) fm = parsed;
    }

    const existing = Array.isArray(fm.contested) ? fm.contested : [];
    fm.contested = [...existing, entry];

    const rendered = YAML.stringify(fm).trimEnd();
    return `---\n${rendered}\n---\n${body}`;
}

function printUsage(): void {
    process.stdout.write(
        `usage: ${PROG} --page PATH --trigger TRIGGER --evidence TEXT --session ID --timestamp ISO8601\n`,
    );
}

export function main(argv: string[]): number {
    let page: string | null = null;
    let trigger: string | null = null;
    let evidence: string | null = null;
    let session: string | null = null;
    let timestamp: string | null = null;

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '-h' || arg === '--help') {
            printUsage();
            return 0;
        } else if (arg === '--page') {
            page = argv[++i] ?? null;
        } else if (arg === '--trigger') {
            trigger = argv[++i] ?? null;
        } else if (arg === '--evidence') {
            evidence = argv[++i] ?? null;
        } else if (arg === '--session') {
            session = argv[++i] ?? null;
        } else if (arg === '--timestamp') {
            timestamp = argv[++i] ?? null;
        } else {
            process.stderr.write(`${PROG}: error: unrecognized argument: ${arg}\n`);
            printUsage();
            return 1;
        }
    }

    if (!page || !trigger || !evidence || !session || !timestamp) {
        process.stderr.write(`${PROG}: error: --page, --trigger, --evidence, --session, and --timestamp are all required\n`);
        printUsage();
        return 1;
    }

    let content: string;
    try {
        content = fs.readFileSync(page, 'utf8');
    } catch {
        process.stderr.write(`${PROG}: error: page not found: ${page}\n`);
        return 1;
    }

    const updated = appendContestedEntry(content, { timestamp, trigger, evidence, session });
    fs.writeFileSync(page, updated, 'utf8');
    process.stdout.write(`${PROG}: appended contested entry to ${page}.\n`);
    return 0;
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
    process.exit(main(process.argv.slice(2)));
}
