#!/usr/bin/env tsx
/**
 * CI guard for README.md line budget.
 *
 * TypeScript twin of `src/scripts/lint_readme_size.py` (ADR-092, Phase 4 /
 * Wave 4b). The CLI contract is mirrored EXACTLY — `--quiet` flag, exit
 * codes (0 within budget, 1 over budget / missing), stdout/stderr split,
 * byte-identical finding messages.
 *
 * The role-first-onboarding roadmap (Phase 2 Step 6) freezes README at
 * its current length: replace, do not grow. Every line added above the
 * fold must displace an existing line. Budget: 750 lines max.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

const README = 'README.md';
const LIMIT = 750;

/**
 * Count splitlines() entries the way Python does — terminal `\n` does NOT
 * yield a trailing empty entry. Universal-newline aware (\r\n / \r / \n).
 */
function _splitlinesCount(text: string): number {
    // Python str.splitlines() splits on \n, \r, \r\n (and more), and does
    // not append a trailing empty element when the string ends with a line
    // boundary. README.md contains only \n / \r\n in practice; we replicate
    // the \n / \r\n / \r families which cover all real inputs.
    if (text === '') {
        return 0;
    }
    // Normalise \r\n and lone \r to \n, then count by splitting and dropping
    // the trailing empty element that a terminal newline produces.
    const normalised = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const parts = normalised.split('\n');
    if (parts[parts.length - 1] === '') {
        parts.pop();
    }
    return parts.length;
}

function main(): number {
    const quiet = process.argv.slice(2).includes('--quiet');
    if (!fs.existsSync(README)) {
        process.stderr.write(`error: ${README} not found\n`);
        return 1;
    }
    const text = fs.readFileSync(README, 'utf-8');
    const n = _splitlinesCount(text);
    if (n > LIMIT) {
        process.stdout.write(
            `FAIL  ${README}: ${n} lines (limit ${LIMIT}). Trim before merge.\n`,
        );
        return 1;
    }
    if (!quiet) {
        process.stdout.write(`OK    ${README}: ${n} lines (limit ${LIMIT}).\n`);
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export { README, LIMIT, main };
