#!/usr/bin/env tsx
/**
 * ratification_header — print a ratification artifact's `providers:`,
 * `verdict:` and `seats:` frontmatter lines, derived from per-seat final
 * verdicts.
 *
 * The two header fields used to be typed by the author, and three findings in
 * one release were the header saying more than the seats had: `ratified` over a
 * non-convergent seat, two providers over one closing seat. This is the writer
 * side of the fix; `readRatification` refuses the same shapes on the reader
 * side whenever `seats:` is recorded.
 *
 * Usage: ratification_header --seat <provider>=<final-verdict> [--seat …]
 *   final-verdict: ratified | confirmed-non-expanding | refused | non-convergent
 *                  | no-final-verdict (the seat closed or was absent at the end)
 *
 * Exit codes: 0 = header printed · 2 = usage error.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    SEAT_PROVIDER_RE,
    SEAT_VERDICTS,
    renderRatificationHeader,
    type SeatVerdict,
} from './_lib/ratification_artifact.js';

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const seats = new Map<string, SeatVerdict>();
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] !== '--seat') {
            process.stderr.write(`error: unknown argument ${String(argv[i])}\n`);
            return 2;
        }
        const raw = argv[i + 1] ?? '';
        i += 1;
        const eq = raw.indexOf('=');
        const provider = raw.slice(0, eq);
        const verdict = raw.slice(eq + 1);
        if (eq <= 0 || !SEAT_PROVIDER_RE.test(provider) || !SEAT_VERDICTS.includes(verdict)) {
            process.stderr.write(
                `error: --seat needs <provider id ${String(SEAT_PROVIDER_RE)}>=<one of ` +
                    `${SEAT_VERDICTS.join('|')}>, got \`${raw}\`\n`,
            );
            return 2;
        }
        if (seats.has(provider)) {
            process.stderr.write(`error: seat \`${provider}\` given twice\n`);
            return 2;
        }
        seats.set(provider, verdict as SeatVerdict);
    }
    if (seats.size === 0) {
        process.stderr.write('error: at least one --seat is required\n');
        return 2;
    }
    process.stdout.write(`${renderRatificationHeader(seats)}\n`);
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const here = fileURLToPath(import.meta.url);
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(here) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
