#!/usr/bin/env node
/**
 * How much the merge danger gate puts on the owner — a reader, not a gate.
 *
 *   report_merge_gate_load --pin REV --since ISO [--root DIR] [--out FILE]
 *                          [--named REV …] [--stdout]
 *
 * Replays this checkout's `classify_merge_risk` over every first-parent commit
 * of `--pin` committed at or after `--since`, each commit judged as the range
 * `C^..C`, and tallies the merge clearances committed at the pin by outcome.
 * It writes one markdown table set: commits per verdict, commits per trigger,
 * the per-day median and maximum for `needs-council` and `needs-owner` over the
 * days that had a merge, and the hand-offs to the owner by cause.
 *
 * Two properties are the point:
 *
 *   - **Reproducible.** The output names the resolved pin, the window, the
 *     command and the classifier's revision, and carries no wall-clock time, so
 *     a re-run at the same pin, timestamp and classifier revision is
 *     byte-identical. Days are cut in the offset `--since` names.
 *   - **Counts and names only.** It reads commit ids, subjects and paths, and
 *     the clearance records' derived fields; never a prompt or a reply.
 *
 * Its caveat, printed in the output: the classifier's path sets are this
 * checkout's, applied to the whole window — a commit from before a trigger
 * existed is classed as if it had.
 *
 * Exit: 0 always once it ran, 2 on a usage error or an unresolvable pin.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { CLEARANCE_DIR, parseClearance, type Outcome } from './_lib/merge_clearance_record.js';
import { readRequiredProviders } from './_lib/ratification_artifact.js';
import { classifyTarget, type Verdict } from './classify_merge_risk.js';

export const DEFAULT_OUT = 'agents/evidence/analysis/merge-gate-load-2026-10.md';

/** The two pull requests the roadmap names as rows: #2251 and #2256. */
export const DEFAULT_NAMED = ['82a131feb', 'edd18fea6'];

const POLICY_PATH = 'src/config/ratification-policy.json';

export interface Row {
    sha: string;
    day: string;
    subject: string;
    verdict: Verdict;
    triggers: string[];
}

export interface ClearanceTally {
    cleared: number;
    'not-cleared': number;
    dangerous: number;
    split: number;
    unreadable: number;
}

function git(root: string, args: readonly string[]): { ok: boolean; out: string } {
    const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    return { ok: r.status === 0, out: typeof r.stdout === 'string' ? r.stdout : '' };
}

/**
 * The revision of the checkout the classifier runs from — its path sets are
 * module code, not read at `--pin` — marked `-dirty` when its source differs.
 */
export function classifierRevision(): string {
    const file = fileURLToPath(new URL('./classify_merge_risk.ts', import.meta.url));
    const dir = path.dirname(file);
    const head = git(dir, ['rev-parse', 'HEAD']);
    if (!head.ok) return 'unknown';
    const dirty = git(dir, ['status', '--porcelain', '--', file]).out.trim() !== '';
    return `${head.out.trim()}${dirty ? '-dirty' : ''}`;
}

/** `+02:00` → 120; `Z` or no offset → 0. */
export function offsetMinutes(iso: string): number {
    const m = /([+-])(\d{2}):(\d{2})$/u.exec(iso);
    if (m === null) return 0;
    const v = Number(m[2]) * 60 + Number(m[3]);
    return m[1] === '-' ? -v : v;
}

/** The calendar day of an instant in a fixed offset. */
export function dayIn(instantIso: string, offset: number): string {
    return new Date(Date.parse(instantIso) + offset * 60_000).toISOString().slice(0, 10);
}

export function median(values: readonly number[]): number {
    if (values.length === 0) return 0;
    const s = [...values].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 === 1 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

export function replay(root: string, pin: string, since: string): Row[] {
    const offset = offsetMinutes(since);
    const log = git(root, ['log', '--first-parent', '--format=%H%x09%P%x09%cI%x09%s', `--since=${since}`, pin]);
    const rows: Row[] = [];
    for (const line of log.out.split('\n')) {
        if (line.trim() === '') continue;
        const [sha = '', parents = '', when = '', ...rest] = line.split('\t');
        if (parents.trim() === '') continue;
        const c = classifyTarget(root, { range: `${sha}^..${sha}` });
        rows.push({
            sha,
            day: dayIn(when, offset),
            subject: rest.join('\t'),
            verdict: c.verdict,
            triggers: [...new Set(c.triggers.map((t) => t.id))].sort(),
        });
    }
    return rows;
}

/** The clearance records committed at the pin, by derived outcome. */
export function tallyClearances(root: string, pin: string): ClearanceTally {
    const tally: ClearanceTally = { cleared: 0, 'not-cleared': 0, dangerous: 0, split: 0, unreadable: 0 };
    const listed = git(root, ['ls-tree', '--name-only', `${pin}:${CLEARANCE_DIR}`]);
    if (!listed.ok) return tally;
    const policy = git(root, ['show', `${pin}:${POLICY_PATH}`]);
    const required = policy.ok ? readRequiredProviders(policy.out) : null;
    for (const name of listed.out.split('\n').filter((n) => n.endsWith('.md')).sort()) {
        const text = git(root, ['show', `${pin}:${CLEARANCE_DIR}/${name}`]);
        const parsed = text.ok && required !== null ? parseClearance(text.out, required) : ['unreadable'];
        if (Array.isArray(parsed)) {
            tally.unreadable += 1;
            continue;
        }
        tally[parsed.outcome as Outcome] += 1;
        if (parsed.outcome === 'not-cleared' && parsed.seats.some((s) => s.reading === 'clear')) {
            tally.split += 1;
        }
    }
    return tally;
}

function cell(s: string): string {
    return s.replace(/\|/gu, '\\|');
}

export function render(opts: {
    pin: string;
    since: string;
    rows: readonly Row[];
    clearances: ClearanceTally;
    named: readonly string[];
    command: string;
    classifier: string;
}): string {
    const { pin, since, rows, clearances, named, command, classifier } = opts;
    const verdicts: Verdict[] = ['routine', 'needs-council', 'needs-owner'];
    const byVerdict = new Map(verdicts.map((v) => [v, rows.filter((r) => r.verdict === v).length]));
    const byTrigger = new Map<string, number>();
    for (const r of rows) for (const t of r.triggers) byTrigger.set(t, (byTrigger.get(t) ?? 0) + 1);
    const days = [...new Set(rows.map((r) => r.day))].sort();
    const perDay = (v: Verdict): number[] => days.map((d) => rows.filter((r) => r.day === d && r.verdict === v).length);
    const council = perDay('needs-council');
    const owner = perDay('needs-owner');
    const councilWithoutRecord = Math.max(0, (byVerdict.get('needs-council') ?? 0) - (clearances.cleared + clearances['not-cleared'] + clearances.dangerous));
    const out: string[] = [
        '<!-- evidence-type: analysis -->',
        '',
        '# Merge danger gate — the owner\'s load',
        '',
        `Pin \`${pin}\`, window from \`${since}\`, first-parent history. Produced by`,
        '',
        '```bash',
        command,
        '```',
        '',
        `Classifier revision \`${classifier}\`. A re-run of that command at the same pin, timestamp`,
        'and classifier revision is byte-identical.',
        '',
        '**Caveat.** The classifier is this checkout\'s, so its path sets are applied to',
        'the whole window: a commit from before a trigger existed is classed as if it',
        'had. The figures say what the gate *would* hand over today, not what it did.',
        '',
        '## Commits per verdict',
        '',
        '| Verdict | Commits |',
        '|---|---|',
        ...verdicts.map((v) => `| \`${v}\` | ${String(byVerdict.get(v) ?? 0)} |`),
        `| total | ${String(rows.length)} |`,
        '',
        '## Commits per trigger',
        '',
        'A commit with several triggers is counted under each.',
        '',
        '| Trigger | Commits |',
        '|---|---|',
        ...[...byTrigger.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t, n]) => `| \`${t}\` | ${String(n)} |`),
        '',
        '## Per day with a merge',
        '',
        `${String(days.length)} day(s) with a first-parent commit, cut in the offset of \`${since}\`.`,
        '',
        '| Verdict | Median per day | Maximum | Days with none |',
        '|---|---|---|---|',
        `| \`needs-council\` | ${String(median(council))} | ${String(Math.max(0, ...council))} | ${String(council.filter((n) => n === 0).length)} |`,
        `| \`needs-owner\` | ${String(median(owner))} | ${String(Math.max(0, ...owner))} | ${String(owner.filter((n) => n === 0).length)} |`,
        '',
        '## Hand-offs to the owner, by cause',
        '',
        '| Cause | Count | Source |',
        '|---|---|---|',
        `| \`needs-owner\` | ${String(byVerdict.get('needs-owner') ?? 0)} | replay |`,
        `| a \`dangerous\` seat | ${String(clearances.dangerous)} | clearance records at the pin |`,
        `| a split — not cleared with at least one clearing seat | ${String(clearances.split)} | clearance records at the pin |`,
        `| not cleared, no clearing seat (degraded or no quorum) | ${String(clearances['not-cleared'] - clearances.split)} | clearance records at the pin |`,
        `| \`needs-council\` with no clearance record — no council on record | ${String(councilWithoutRecord)} | replay minus records |`,
        '',
        `Clearance records at the pin: ${String(clearances.cleared)} cleared, ${String(clearances['not-cleared'])} not cleared, ` +
            `${String(clearances.dangerous)} dangerous, ${String(clearances.unreadable)} unreadable. A \`needs-council\` commit`,
        'with no record either predates the record (the gate merged on free prose, or',
        'the owner merged it himself) or was handed over; the replay cannot tell which.',
        '',
        '## Named rows',
        '',
        '| Commit | Day | Verdict | Triggers | Subject |',
        '|---|---|---|---|---|',
    ];
    for (const n of named) {
        const r = rows.find((x) => x.sha.startsWith(n));
        out.push(
            r === undefined
                ? `| \`${n}\` | — | not in the window | — | — |`
                : `| \`${r.sha.slice(0, 9)}\` | ${r.day} | \`${r.verdict}\` | ${r.triggers.map((t) => `\`${t}\``).join(', ') || '—'} | ${cell(r.subject)} |`,
        );
    }
    out.push('');
    return out.join('\n');
}

function argValues(argv: readonly string[], flag: string): string[] {
    const out: string[] = [];
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === flag && argv[i + 1] !== undefined && !(argv[i + 1] as string).startsWith('--')) {
            out.push(argv[i + 1] as string);
        }
    }
    return out;
}

export function main(argv: readonly string[] = process.argv.slice(2), write: (l: string) => void = (l) => process.stdout.write(`${l}\n`)): number {
    const pinArg = argValues(argv, '--pin')[0];
    const since = argValues(argv, '--since')[0];
    const root = path.resolve(argValues(argv, '--root')[0] ?? process.cwd());
    const outRel = argValues(argv, '--out')[0] ?? DEFAULT_OUT;
    const namedArg = argValues(argv, '--named');
    const named = namedArg.length > 0 ? namedArg : DEFAULT_NAMED;
    if (pinArg === undefined || since === undefined || Number.isNaN(Date.parse(since))) {
        write('usage: report_merge_gate_load --pin REV --since ISO [--root DIR] [--out FILE] [--named REV …] [--stdout]');
        return 2;
    }
    const resolved = git(root, ['rev-parse', '--verify', `${pinArg}^{commit}`]);
    if (!resolved.ok) {
        write(`report_merge_gate_load: cannot resolve --pin ${pinArg}`);
        return 2;
    }
    const pin = resolved.out.trim();
    const rows = replay(root, pin, since);
    const command =
        `./scripts-run src/scripts/report_merge_gate_load --pin ${pin} --since ${since}` +
        (namedArg.length > 0 ? namedArg.map((n) => ` --named ${n}`).join('') : '');
    const body = render({ pin, since, rows, clearances: tallyClearances(root, pin), named, command, classifier: classifierRevision() });
    if (argv.includes('--stdout')) {
        process.stdout.write(body);
        return 0;
    }
    const target = path.resolve(root, outRel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body, 'utf8');
    write(`report_merge_gate_load: wrote ${outRel} — ${String(rows.length)} commit(s)`);
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
    process.exit(main());
}
