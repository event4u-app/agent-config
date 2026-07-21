#!/usr/bin/env tsx
/**
 * CI guard for the no-serial-comma house style in README.md prose.
 *
 * House style: prose never puts a comma directly before a final "and" / "or"
 * (no Oxford / serial comma). `skills, commands and rules` — NOT
 * `skills, commands, and rules`. README.md is the public claim surface for a
 * package whose whole pitch is "every headline claim is machine-checked", so a
 * drifting comma style in the copy is the same class of defect as a drifting
 * number: this guard turns a one-off copy fix into a permanent build gate.
 *
 * Prose only. Fenced code, inline `backtick` spans, HTML comments (claim
 * markers), URLs, and Markdown table rows are masked before matching so the
 * guard never trips on code, data, or link syntax.
 *
 * Exit codes: 0 clean · 1 violation found / README missing.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

const README = 'README.md';

// A comma, whitespace, then a final coordinating conjunction as a whole word.
const SERIAL_COMMA = /,[ \t]+(and|or)\b/gi;

/** Python str.splitlines() — drops the trailing empty element. */
function _splitlines(text: string): string[] {
    if (text === '') {
        return [];
    }
    const normalised = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const parts = normalised.split('\n');
    if (parts[parts.length - 1] === '') {
        parts.pop();
    }
    return parts;
}

/**
 * Return per-line content with everything that is not prose masked out.
 *
 * Order matters: HTML comments and fenced regions blank the whole line; on a
 * surviving prose line we then blank inline backtick spans, URLs, and — for a
 * Markdown table row — the whole line, so a `, and` inside code, a link, or a
 * data cell never counts as a style violation.
 */
function _stripNoise(lines: string[]): string[] {
    const urlRe = /https?:\/\/\S+|\(\.[\w./-]+\)/g;
    const backtickRe = /`[^`]*`/g;
    const cleaned: string[] = [];
    let inFence = false;
    let inHtml = false;
    for (const raw of lines) {
        const line = raw;
        if (line.includes('<!--') && !line.includes('-->')) {
            inHtml = true;
        }
        if (inHtml) {
            cleaned.push('');
            if (line.includes('-->')) {
                inHtml = false;
            }
            continue;
        }
        const stripped = line.trim();
        if (stripped.startsWith('```')) {
            inFence = !inFence;
            cleaned.push('');
            continue;
        }
        if (inFence) {
            cleaned.push('');
            continue;
        }
        // Single-line HTML comment (e.g. a claim marker) — blank it.
        let content = line.replace(/<!--[\s\S]*?-->/g, ' ');
        // Markdown table row — data, not prose.
        if (content.trim().startsWith('|')) {
            cleaned.push('');
            continue;
        }
        // Mask code spans / URLs with a word-char placeholder (not a space):
        // a space would let a `code`-span sitting between a list comma and the
        // final "and" / "or" collapse into a phantom ", or" (the first list
        // comma is legitimate — only a comma *directly* before and/or counts).
        content = content.replace(backtickRe, 'x').replace(urlRe, 'x');
        cleaned.push(content);
    }
    return cleaned;
}

interface Hit {
    line: number;
    match: string;
}

function collect_hits(text: string): Hit[] {
    const lines = _stripNoise(_splitlines(text));
    const hits: Hit[] = [];
    lines.forEach((content, idx) => {
        SERIAL_COMMA.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = SERIAL_COMMA.exec(content)) !== null) {
            hits.push({ line: idx + 1, match: m[0].trim() });
            if (m.index === SERIAL_COMMA.lastIndex) {
                SERIAL_COMMA.lastIndex += 1;
            }
        }
    });
    return hits;
}

function main(): number {
    const quiet = process.argv.slice(2).includes('--quiet');
    if (!fs.existsSync(README)) {
        process.stderr.write(`error: ${README} not found\n`);
        return 1;
    }

    const hits = collect_hits(fs.readFileSync(README, 'utf-8'));

    if (hits.length > 0) {
        process.stdout.write(
            `FAIL  ${README}: ${hits.length} serial-comma violation(s) in prose ` +
                `(house style: no comma before a final "and" / "or").\n`,
        );
        for (const { line, match } of hits) {
            const lineStr = String(line).padStart(4, ' ');
            process.stdout.write(`  L${lineStr}  -> "${match}"\n`);
        }
        process.stdout.write('\nFix: drop the comma before the final "and" / "or".\n');
        return 1;
    }

    if (!quiet) {
        process.stdout.write(`OK    ${README}: no serial-comma violations in prose.\n`);
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (installed `.augment/` projection, or macOS
    // /var → /private/var temp dirs) makes the raw URLs differ. Compare
    // realpaths so the entry guard still fires under a symlink.
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}

export { README, SERIAL_COMMA, collect_hits, main };
