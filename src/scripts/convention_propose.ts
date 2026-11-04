#!/usr/bin/env node
/**
 * Propose a convention as a project diff — road-to-a-noted-that-is-a-write 3.1.
 *
 * AI council decision OQ-32 (2026-10-29, 2/2, option b): a convention that
 * keeps not arriving is proposed through THIS path, never through self-repair,
 * whose Iron Law (the defect belongs to agent-config, never "fixed" in the
 * user's project) stays unchanged. The path emits a diff the user reads and
 * accepts; nothing is written without the accept, and the accept must name the
 * digest of the exact diff that was shown.
 *
 * The rung (`convention_rung.ts`) picks the carrier:
 *   - `config` settings `.editorconfig` can express → `.editorconfig`;
 *   - everything else → one bullet in `AGENTS.md` under `## Conventions`.
 * A `check` rung is still proposed as prose here and says so: a lint rule is
 * stack-specific, and inventing one is the too-strong rung this path refuses.
 *
 * Usage:
 *   ./scripts-run src/scripts/convention_propose "<sentence>"                 # show
 *   ./scripts-run src/scripts/convention_propose "<sentence>" --accept <digest> # apply
 * Exit codes: 0 = shown or applied · 1 = refused (digest mismatch, file moved) · 2 = usage.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { type ConventionRung, conventionRung } from './_lib/convention_rung.js';

export interface ConventionProposal {
    sentence: string;
    rung: ConventionRung;
    /** Path relative to the project root. */
    file: string;
    before: string;
    after: string;
    diff: string;
    digest: string;
    note: string;
}

const NUMBER_WORDS: Record<string, number> = { two: 2, four: 4, zwei: 2, vier: 4, eight: 8, acht: 8 };

/** The `.editorconfig` keys a sentence states, or `{}` when it states none. */
export function editorconfigSettings(sentence: string): Record<string, string> {
    const s = sentence.toLowerCase();
    const out: Record<string, string> = {};
    const size = /\b(\d+|two|four|eight|zwei|vier|acht)\s+(spaces|leerzeichen)\b/.exec(s);
    const spacesOverTabs = /\b(spaces|leerzeichen)\b[^.!?]{0,15}\b(statt|instead of|not|nicht)\b[^.!?]{0,10}\btabs?\b/.test(s);
    if (size !== null || spacesOverTabs) {
        out['indent_style'] = 'space';
        if (size !== null) {
            const n = Number.parseInt(size[1] as string, 10);
            out['indent_size'] = String(Number.isNaN(n) ? NUMBER_WORDS[size[1] as string] : n);
        }
    } else if (/\btabs?\b/.test(s)) {
        out['indent_style'] = 'tab';
    }
    const crlf = /\bcrlf\b/.test(s);
    if (crlf || /\blf\b/.test(s)) out['end_of_line'] = crlf ? 'crlf' : 'lf';
    if (/\b(final newline|newline at (the )?end of (the )?file|leerzeile am dateiende|zeilenumbruch am dateiende)\b/.test(s)) {
        out['insert_final_newline'] = 'true';
    }
    if (/\b(trailing whitespace|leerzeichen am zeilenende)\b/.test(s)) out['trim_trailing_whitespace'] = 'true';
    const len = /\b(\d{2,3})\s*(characters|chars|zeichen)\b/.exec(s);
    if (len !== null) out['max_line_length'] = len[1] as string;
    if (/\butf-?8\b/.test(s)) out['charset'] = 'utf-8';
    return out;
}

/** Set `keys` inside the `[*]` section, adding the section (and the file header) when absent. */
export function applyEditorconfig(before: string, keys: Record<string, string>): string {
    const lines = before === '' ? ['root = true', ''] : before.replace(/\n$/, '').split('\n');
    let start = lines.findIndex((l) => l.trim() === '[*]');
    if (start < 0) {
        if (lines.length > 0 && lines[lines.length - 1]!.trim() !== '') lines.push('');
        lines.push('[*]');
        start = lines.length - 1;
    }
    let end = lines.findIndex((l, i) => i > start && /^\s*\[/.test(l));
    if (end < 0) end = lines.length;
    for (const [k, v] of Object.entries(keys)) {
        const at = lines.findIndex((l, i) => i > start && i < end && new RegExp(`^\\s*${k}\\s*=`).test(l));
        if (at >= 0) {
            lines[at] = `${k} = ${v}`;
        } else {
            let insert = end;
            while (insert - 1 > start && lines[insert - 1]!.trim() === '') insert--;
            lines.splice(insert, 0, `${k} = ${v}`);
            end++;
        }
    }
    return `${lines.join('\n')}\n`;
}

/** Add one bullet under `## Conventions`, adding the heading when absent. */
export function applyAgentsMd(before: string, sentence: string): string {
    const bullet = `- ${sentence.trim()}`;
    const lines = before === '' ? [] : before.replace(/\n$/, '').split('\n');
    if (lines.includes(bullet)) return before;
    const head = lines.findIndex((l) => /^##\s+Conventions\s*$/i.test(l));
    if (head < 0) {
        if (lines.length > 0) lines.push('');
        lines.push('## Conventions', '', bullet);
        return `${lines.join('\n')}\n`;
    }
    let end = lines.findIndex((l, i) => i > head && /^#{1,2}\s/.test(l));
    if (end < 0) end = lines.length;
    let insert = end;
    while (insert - 1 > head && lines[insert - 1]!.trim() === '') insert--;
    lines.splice(insert, 0, bullet);
    return `${lines.join('\n')}\n`;
}

/** A minimal unified diff (one hunk, whole file) — the files involved are small. */
export function unifiedDiff(file: string, before: string, after: string): string {
    const a = before === '' ? [] : before.replace(/\n$/, '').split('\n');
    const b = after.replace(/\n$/, '').split('\n');
    const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
    for (let i = a.length - 1; i >= 0; i--) {
        for (let j = b.length - 1; j >= 0; j--) {
            dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
        }
    }
    const body: string[] = [];
    let i = 0;
    let j = 0;
    while (i < a.length || j < b.length) {
        if (i < a.length && j < b.length && a[i] === b[j]) {
            body.push(` ${a[i]}`);
            i++;
            j++;
        } else if (j < b.length && (i >= a.length || dp[i]![j + 1]! >= dp[i + 1]![j]!)) {
            body.push(`+${b[j]}`);
            j++;
        } else {
            body.push(`-${a[i]}`);
            i++;
        }
    }
    const from = before === '' ? '/dev/null' : `a/${file}`;
    return [`--- ${from}`, `+++ b/${file}`, `@@ -${a.length > 0 ? 1 : 0},${a.length} +1,${b.length} @@`, ...body, ''].join('\n');
}

function readOrEmpty(p: string): string {
    try {
        return fs.readFileSync(p, 'utf-8');
    } catch {
        return '';
    }
}

/** Build the proposal. Pure apart from reading the target file. */
export function proposeConvention(root: string, sentence: string): ConventionProposal {
    const rung = conventionRung(sentence);
    const keys = rung === 'config' ? editorconfigSettings(sentence) : {};
    const toEditorconfig = Object.keys(keys).length > 0;
    const file = toEditorconfig ? '.editorconfig' : 'AGENTS.md';
    const before = readOrEmpty(path.join(root, file));
    const after = toEditorconfig ? applyEditorconfig(before, keys) : applyAgentsMd(before, sentence);
    const note = toEditorconfig
        ? 'config rung: an editor setting carries it without anyone reading it'
        : rung === 'config'
          ? 'config rung, but not one .editorconfig expresses (formatter-specific): proposed as prose; add it to the project formatter config by hand'
          : rung === 'check'
            ? 'check rung: a lint rule or test could enforce it; proposed as prose because the rule is stack-specific'
            : 'prose rung: only an instruction file can carry it';
    const digest = createHash('sha256').update(`${file}\0${before}\0${after}`).digest('hex').slice(0, 12);
    return { sentence, rung, file, before, after, diff: unifiedDiff(file, before, after), digest, note };
}

/**
 * Write the proposal — only with the digest of the diff that was shown, and
 * only while the target still reads exactly as it did when it was proposed.
 */
export function applyProposal(root: string, proposal: ConventionProposal, acceptDigest: string): string | null {
    if (acceptDigest !== proposal.digest) {
        return `refused: --accept ${acceptDigest} does not match the shown diff (${proposal.digest})`;
    }
    const target = path.join(root, proposal.file);
    if (readOrEmpty(target) !== proposal.before) {
        return `refused: ${proposal.file} changed since the diff was shown; propose again`;
    }
    fs.writeFileSync(target, proposal.after, 'utf-8');
    return null;
}

export function main(argv: readonly string[], root = process.cwd()): number {
    const i = argv.indexOf('--accept');
    const accept = i >= 0 ? argv[i + 1] : undefined;
    const sentence = argv.filter((_, k) => i < 0 || (k !== i && k !== i + 1)).join(' ').trim();
    if (sentence === '' || (i >= 0 && accept === undefined)) {
        process.stderr.write('usage: convention_propose "<sentence>" [--accept <digest>]\n');
        return 2;
    }
    const p = proposeConvention(root, sentence);
    if (p.before === p.after) {
        process.stdout.write(`convention_propose: ${p.file} already carries it — nothing to propose.\n`);
        return 0;
    }
    if (accept === undefined) {
        process.stdout.write(`${p.diff}\n# rung: ${p.rung} — ${p.note}\n# nothing was written. To apply exactly this diff:\n#   --accept ${p.digest}\n`);
        return 0;
    }
    const refused = applyProposal(root, p, accept);
    if (refused !== null) {
        process.stderr.write(`convention_propose: ${refused}\n`);
        return 1;
    }
    process.stdout.write(`convention_propose: applied to ${p.file}.\n`);
    return 0;
}

function isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (isCliEntry()) {
    process.exit(main(process.argv.slice(2)));
}
