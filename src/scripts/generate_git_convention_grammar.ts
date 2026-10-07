#!/usr/bin/env tsx
/**
 * Writes the grammar block of the commit-subject reference from
 * `_lib/git_convention_grammar.ts`, so the fallback a command reads when the
 * `agent-config` binary cannot run is the grammar the binary runs.
 *
 * Usage:
 *     tsx src/scripts/generate_git_convention_grammar.ts            # rewrite in place
 *     tsx src/scripts/generate_git_convention_grammar.ts --check    # exit 1 when stale
 *     tsx src/scripts/generate_git_convention_grammar.ts --out PATH # write the refreshed page elsewhere
 *
 * Exit codes: 0 written / in sync · 1 stale, or the markers are missing · 2 usage.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { FAMILY_ERE, FORMAT_GRAMMAR, GIT_OWN_SUBJECT, TICKETLESS_FORM, TICKET_DENYLIST, TICKET_GRAMMAR, TICKET_TOKEN, VERSION_LIKE_KEYS } from './_lib/git_convention_grammar.js';
import {
    AUTHOR_CAP_PER_HALF,
    BULK_IMPORT_FILES,
    MEASURE_LIMIT,
    MEASURE_SINCE,
    MIN_BRANCHES,
    MIN_CAPPED_AUTHORS,
    MIN_N,
    RECENT_WINDOW,
    SHARE_BAR,
    SMALL_TEAM_SHARE_BAR,
    pct,
} from './_lib/git_convention_measure.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const REFERENCE = 'src/skills/git-workflow/references/commit-subject.md';
export const GENERATOR = 'src/scripts/generate_git_convention_grammar.ts';
export const GRAMMAR_MODULE = 'src/scripts/_lib/git_convention_grammar.ts';
export const MEASURE_MODULE = 'src/scripts/_lib/git_convention_measure.ts';

const BEGIN = '<!-- BEGIN GENERATED: git-convention-grammar -->';
const END = '<!-- END GENERATED: git-convention-grammar -->';

export function renderBlock(): string {
    const rows: [string, string][] = [
        ['ticket', TICKET_GRAMMAR],
        ['ticket in text', TICKET_TOKEN],
        ['standard names', TICKET_DENYLIST.join(' ')],
        ['version-like names', `${VERSION_LIKE_KEYS.join(' ')} (one-digit number, no card)`],
        ...Object.entries(FORMAT_GRAMMAR).map(([f, re]) => [`format ${f}`, re] as [string, string]),
        ...FAMILY_ERE.map(([f, ere]) => [`family ${f}`, ere] as [string, string]),
        ...Object.entries(TICKETLESS_FORM).map(([f, ere]) => [`family ${f}, no ticket`, `${ere ?? ''} (no ticket elsewhere in the subject)`] as [string, string]),
        ['any format or family', `${GIT_OWN_SUBJECT} (git's own subjects)`],
        ['measure sample', `newest ${MEASURE_LIMIT} non-merge commits since ${MEASURE_SINCE}, or regardless of age when that window yields fewer than ${MIN_N}; bots, automation subjects, commits over ${BULK_IMPORT_FILES} files dropped`],
        ['measure bar', `n >= ${MIN_N}; >= ${pct(SHARE_BAR)} capped at ${AUTHOR_CAP_PER_HALF} per author per half (${MIN_CAPPED_AUTHORS}+ authors), else >= ${pct(SMALL_TEAM_SHARE_BAR)} uncapped; both halves agree`],
        ['measure migration', `the newer half, or the newest ${RECENT_WINDOW} commits, clearing the bar on another family than the dominant one: "migrating to <family>", and that family is proposed`],
        ['measure branches', `>= ${MIN_BRANCHES} remote branch names, top shape >= ${pct(SHARE_BAR)}`],
    ];
    const width = Math.max(...rows.map(([k]) => k.length)) + 2;
    return [
        BEGIN,
        `<!-- Written by \`./scripts-run ${GENERATOR.replace(/\.ts$/, '')}\` from \`${GRAMMAR_MODULE}\` and \`${MEASURE_MODULE}\`; edit the modules, never this block. -->`,
        '',
        '```',
        ...rows.map(([k, v]) => `${k.padEnd(width)}${v}`),
        '```',
        '',
        'Formats are JavaScript / PCRE syntax; families are POSIX extended, matched in',
        'order, first hit wins. Under `format ticket-conventional` and `family',
        'ticket-conventional` a ticket anywhere inside the scope fails, and a standard',
        'name in the ticket position fails. A ticket is found in a branch or scope only as',
        'a whole token (`ticket in text`). Without a card, a version-like name — one of',
        'the keys above with a one-digit number, such as `HTTP-2` or `PHP-8` — is not a',
        'ticket; `HTTP2-1` still has the ticket shape. A convention card\'s `ticket_keys`',
        'settles both, and matches a key written in lower case; without a card a',
        'lower-case key is never detected.',
        END,
    ].join('\n');
}

export function refresh(text: string): { ok: true; text: string } | { ok: false; reason: string } {
    const start = text.indexOf(BEGIN);
    const end = text.indexOf(END);
    if (start === -1 || end === -1 || end < start) return { ok: false, reason: `${REFERENCE} lacks the ${BEGIN} / ${END} markers` };
    return { ok: true, text: text.slice(0, start) + renderBlock() + text.slice(end + END.length) };
}

export function main(argv: readonly string[] = process.argv.slice(2), root = REPO_ROOT): number {
    let check = false;
    let out: string | null = null;
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--check') check = true;
        else if (argv[i] === '--out' && argv[i + 1] !== undefined) out = argv[++i] as string;
        else {
            process.stderr.write(`unknown argument: ${String(argv[i])}\nusage: generate_git_convention_grammar [--check | --out PATH]\n`);
            return 2;
        }
    }
    const file = path.join(root, REFERENCE);
    const current = fs.readFileSync(file, 'utf-8');
    const next = refresh(current);
    if (!next.ok) {
        process.stderr.write(`${next.reason}\n`);
        return 1;
    }
    if (check) {
        if (next.text === current) return 0;
        process.stderr.write(`${REFERENCE} is stale — run ./scripts-run ${GENERATOR.replace(/\.ts$/, '')}\n`);
        return 1;
    }
    fs.writeFileSync(out ?? file, next.text);
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exitCode = main();
}
