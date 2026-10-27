#!/usr/bin/env tsx
/**
 * Print the precision the release-findings ledgers already adjudicated.
 *
 * Every release-findings ledger records what became of each self-review
 * finding. Nothing printed the sum: how many were fixed,
 * how many were false positives, and how many nobody disposed of. This reads
 * the ledgers and prints it, per release and in total.
 *
 * precision = fixed / (fixed + false_positive). `accepted_risk` and
 * `still_open` are real findings left unfixed, so they sit outside both terms;
 * an undisposed row (`open` or no status) is counted apart, because a precision
 * computed over the adjudicated minority says nothing about the rest. With no
 * adjudicated row the precision is `null`, never zero.
 *
 * Read-only. It writes nothing and decides nothing.
 *
 * Usage:
 *   ./scripts-run src/scripts/report_finding_precision [--dir <ledger dir>] [--json]
 *
 * Exit codes: 0 report printed · 2 the directory is missing or a ledger is unreadable.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const DEFAULT_DIR = path.join(path.resolve(path.dirname(_HERE), '..', '..'), 'agents', 'evidence', 'release-findings');

export interface PrecisionRow {
    readonly release: string;
    readonly total: number;
    readonly fixed: number;
    readonly false_positive: number;
    readonly accepted_risk: number;
    readonly still_open: number;
    readonly undisposed: number;
    /** fixed / (fixed + false_positive), or null when neither occurs. */
    readonly precision: number | null;
    /** undisposed / total, or null for an empty ledger. */
    readonly undisposed_share: number | null;
}

const round = (n: number): number => Math.round(n * 1e4) / 1e4;

export function tally(release: string, findings: readonly { status?: unknown }[]): PrecisionRow {
    const c = { fixed: 0, false_positive: 0, accepted_risk: 0, still_open: 0, undisposed: 0 };
    for (const f of findings) {
        const s = f.status;
        if (s === 'fixed' || s === 'false_positive' || s === 'accepted_risk' || s === 'still_open') c[s] += 1;
        else c.undisposed += 1;
    }
    const adjudicated = c.fixed + c.false_positive;
    return {
        release,
        total: findings.length,
        ...c,
        precision: adjudicated === 0 ? null : round(c.fixed / adjudicated),
        undisposed_share: findings.length === 0 ? null : round(c.undisposed / findings.length),
    };
}

/** Compare dotted versions numerically, so 9.14.0 sorts before 14.15.0. */
function byVersion(a: string, b: string): number {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
        const d = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (d !== 0) return d;
    }
    return a.localeCompare(b);
}

export function readLedgers(dir: string): { rows: PrecisionRow[]; total: PrecisionRow } {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    const all: { status?: unknown }[] = [];
    const rows = files
        .map((f) => {
            const doc = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as {
                release?: string;
                findings?: { status?: unknown }[];
            };
            const findings = Array.isArray(doc.findings) ? doc.findings : [];
            all.push(...findings);
            return tally(doc.release ?? f.replace(/\.json$/, ''), findings);
        })
        .sort((a, b) => byVersion(a.release, b.release));
    return { rows, total: tally('total', all) };
}

const pct = (v: number | null): string => (v === null ? '—' : `${(v * 100).toFixed(1)} %`);

function main(argv: readonly string[]): number {
    const i = argv.indexOf('--dir');
    const dir = i >= 0 ? argv[i + 1] : DEFAULT_DIR;
    if (!dir || !fs.existsSync(dir)) {
        process.stderr.write(`report_finding_precision: no ledger directory at ${dir ?? '(none)'}\n`);
        return 2;
    }
    let result: ReturnType<typeof readLedgers>;
    try {
        result = readLedgers(dir);
    } catch (err) {
        process.stderr.write(`report_finding_precision: ${(err as Error).message}\n`);
        return 2;
    }
    if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        return 0;
    }
    const line = (r: PrecisionRow) =>
        `| ${r.release} | ${r.total} | ${r.fixed} | ${r.false_positive} | ${r.accepted_risk} | ${r.still_open} | ${r.undisposed} | ${pct(r.precision)} | ${pct(r.undisposed_share)} |`;
    process.stdout.write(
        [
            '| Release | Findings | Fixed | False positive | Accepted risk | Still open | Undisposed | Precision | Undisposed share |',
            '|---|---|---|---|---|---|---|---|---|',
            ...result.rows.map(line),
            line(result.total),
            '',
        ].join('\n'),
    );
    return 0;
}

const _isMain = (() => {
    const entry = process.argv[1];
    if (!entry) return false;
    try {
        return fs.realpathSync(entry) === fs.realpathSync(_HERE);
    } catch {
        return false;
    }
})();

if (_isMain) process.exit(main(process.argv.slice(2)));
