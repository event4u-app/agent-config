#!/usr/bin/env tsx
/**
 * Pointer degradation — road-to-knowledge-system Phase 4 (self-learning
 * wiring). After `learning-to-rule-or-skill` promotes a knowledge-page
 * entry into a real skill/rule/guideline, the SOURCE entry is rewritten to
 * a pointer stub instead of staying as full duplicated prose. This is the
 * staging → promotion → pointer lifecycle: it prevents double-maintenance
 * between the knowledge page and the new artifact, and keeps
 * `agents/knowledge/INDEX.md` honest about what still needs attention.
 *
 * Two source shapes:
 *   - Whole page: `--source agents/knowledge/concepts/x.md` — the page
 *     BODY (below frontmatter) is replaced with a pointer line;
 *     frontmatter (and its provenance) is preserved untouched.
 *   - Named section: `--source agents/knowledge/procedures/skill-candidates.md#<topic>`
 *     — only the matching `## <topic>` section's body is replaced; the
 *     heading and every other section stay untouched.
 *
 * Usage:
 *   degrade_to_pointer.ts --source <path[#anchor]> --artifact <path> --date <YYYY-MM-DD>
 *
 * Exit codes: 0 = degraded, 1 = usage error / source not found, 3 = internal error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { main as generateIndexMain } from './generate_knowledge_index.js';

const PROG = 'degrade_to_pointer.ts';
const FRONTMATTER_RE = /^(---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n)/;

export function pointerLine(artifact: string, date: string): string {
    return `> Promoted to \`${artifact}\` on ${date}; see that artifact for current guidance.`;
}

/** Replace a whole page's body (below frontmatter, if any) with a pointer line. Preserves frontmatter and the first H1 heading, if present, so the page stays a resolvable link target. */
export function degradeWholeFile(content: string, artifact: string, date: string): string {
    const fmMatch = FRONTMATTER_RE.exec(content);
    const frontmatter = fmMatch ? fmMatch[1] : '';
    const rest = fmMatch ? content.slice(fmMatch[1].length) : content;

    const headingMatch = /^(#\s+.+)$/m.exec(rest);
    const heading = headingMatch ? `${headingMatch[1]}\n\n` : '';

    return `${frontmatter}${heading}${pointerLine(artifact, date)}\n`;
}

/** Replace one `## <anchor>` section's body (up to the next `## ` heading or EOF) with a pointer line, byte-for-byte outside that span. Throws if the anchor is not found. */
export function degradeSection(content: string, anchor: string, artifact: string, date: string): string {
    const headingLine = `## ${anchor}`;
    const lines = content.split('\n');
    const startIdx = lines.findIndex((l) => l.trim() === headingLine);
    if (startIdx === -1) {
        throw new Error(`section "${anchor}" not found`);
    }
    let endIdx = lines.length;
    for (let i = startIdx + 1; i < lines.length; i++) {
        if (/^##\s/.test(lines[i])) {
            endIdx = i;
            break;
        }
    }
    const before = lines.slice(0, startIdx + 1);
    const after = lines.slice(endIdx);
    const body = ['', pointerLine(artifact, date), ''];
    return [...before, ...body, ...after].join('\n');
}

function printUsage(): void {
    process.stdout.write(`usage: ${PROG} --source PATH[#ANCHOR] --artifact PATH --date YYYY-MM-DD\n`);
}

export function main(argv: string[]): number {
    let source: string | null = null;
    let artifact: string | null = null;
    let date: string | null = null;

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '-h' || arg === '--help') {
            printUsage();
            return 0;
        } else if (arg === '--source') {
            source = argv[++i] ?? null;
        } else if (arg === '--artifact') {
            artifact = argv[++i] ?? null;
        } else if (arg === '--date') {
            date = argv[++i] ?? null;
        } else {
            process.stderr.write(`${PROG}: error: unrecognized argument: ${arg}\n`);
            printUsage();
            return 1;
        }
    }

    if (!source || !artifact || !date) {
        process.stderr.write(`${PROG}: error: --source, --artifact, and --date are required\n`);
        printUsage();
        return 1;
    }

    const [filePath, anchor] = source.split('#');

    let content: string;
    try {
        content = fs.readFileSync(filePath, 'utf8');
    } catch {
        process.stderr.write(`${PROG}: error: source file not found: ${filePath}\n`);
        return 1;
    }

    let updated: string;
    try {
        updated = anchor ? degradeSection(content, anchor, artifact, date) : degradeWholeFile(content, artifact, date);
    } catch (err) {
        process.stderr.write(`${PROG}: error: ${(err as Error).message}\n`);
        return 1;
    }

    fs.writeFileSync(filePath, updated, 'utf8');
    process.stdout.write(`${PROG}: degraded ${source} → pointer to ${artifact}.\n`);

    // Regenerate the index so the pointer's new one-line summary is
    // reflected immediately, not left stale until the next unrelated write.
    // Assumes the standard invocation cwd (repo root), matching every other
    // script in this package (generate_knowledge_index.ts defaults the same way).
    generateIndexMain(['--dir', process.cwd(), '--quiet']);

    return 0;
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
    process.exit(main(process.argv.slice(2)));
}
