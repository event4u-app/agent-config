#!/usr/bin/env tsx
/**
 * Findings-parse outcome rates over the recorded fixture corpus.
 *
 * Step 2.4 of `road-to-council-evidence-integrity`. Phase 2 made the three
 * outcomes distinguishable (`parsed` / `empty` / `parse_failed`); this makes the
 * distinction *measurable*, over a population a reader can open.
 *
 * ## What the denominator is, and what it is not
 *
 * The denominator is `tests/fixtures/council-parse-corpus/` — recorded verbatim
 * member answers, one per file. It is **not live traffic**, and no number this
 * script prints may be quoted as if it were. The corpus was assembled to cover
 * the distinct failure SHAPES, so it over-represents them by construction: two
 * of seven answers are unparseable here because there are two unparseable
 * shapes, not because two in seven real answers fail.
 *
 * Saying that in the same breath as the number is the whole point. A
 * `parse_empty_rate` with an unstated denominator is exactly the "looks more
 * settled than the run was" defect this roadmap exists to close, one layer up.
 *
 * ## Why it also acts as a gate
 *
 * `expected.json` pins the outcome per fixture, so a change to the extractor
 * that silently reclassifies a recorded answer fails here rather than being
 * discovered by a paid re-ask in production. Exit 1 on any drift.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse_findings_outcome, type FindingsParseOutcome } from './ai_council/consensus.js';

const CORPUS_REL = 'tests/fixtures/council-parse-corpus';

function repoRoot(): string {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}

interface Row {
    readonly file: string;
    readonly outcome: FindingsParseOutcome;
    readonly findings: number;
}

export function scoreCorpus(dir: string): Row[] {
    const files = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.txt'))
        .sort();
    return files.map((f) => {
        const text = fs.readFileSync(path.join(dir, f), 'utf8');
        const ex = parse_findings_outcome(text, { source: `fixture:${f}` });
        return { file: f, outcome: ex.outcome, findings: ex.findings.length };
    });
}

export function main(argv: string[]): number {
    const asJson = argv.includes('--json');
    const dir = path.join(repoRoot(), CORPUS_REL);
    if (!fs.existsSync(dir)) {
        process.stderr.write(`council_parse_rate: corpus not found at ${CORPUS_REL}\n`);
        return 1;
    }
    const rows = scoreCorpus(dir);
    const total = rows.length;
    const count = (o: FindingsParseOutcome): number => rows.filter((r) => r.outcome === o).length;
    const failed = count('parse_failed');
    const empty = count('empty');
    const parsed = count('parsed');

    const expectedPath = path.join(dir, 'expected.json');
    let drift: string[] = [];
    if (fs.existsSync(expectedPath)) {
        const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8')) as Record<string, string>;
        drift = rows
            .filter((r) => expected[r.file] !== undefined && expected[r.file] !== r.outcome)
            .map((r) => `${r.file}: expected ${String(expected[r.file])}, got ${r.outcome}`);
        const missing = rows.filter((r) => expected[r.file] === undefined).map((r) => `${r.file}: not pinned in expected.json`);
        drift = [...drift, ...missing];
    }

    if (asJson) {
        process.stdout.write(
            `${JSON.stringify({ denominator: CORPUS_REL, total, parsed, empty, parse_failed: failed, rows, drift }, null, 2)}\n`,
        );
    } else {
        process.stdout.write(`council parse outcomes · denominator: ${CORPUS_REL} (${String(total)} recorded answers, NOT live traffic)\n\n`);
        for (const r of rows) {
            process.stdout.write(`  ${r.outcome.padEnd(13)} ${r.file} (${String(r.findings)} finding(s))\n`);
        }
        const pct = (n: number): string => (total === 0 ? 'n/a' : `${((n / total) * 100).toFixed(1)}%`);
        process.stdout.write(`\n  parse_failed_rate  ${String(failed)}/${String(total)}  ${pct(failed)}\n`);
        process.stdout.write(`  parse_empty_rate   ${String(empty)}/${String(total)}  ${pct(empty)}\n`);
        process.stdout.write(`  parsed_rate        ${String(parsed)}/${String(total)}  ${pct(parsed)}\n`);
        for (const d of drift) {
            process.stderr.write(`  DRIFT ${d}\n`);
        }
    }
    return drift.length > 0 ? 1 : 0;
}

if (process.argv[1] !== undefined) {
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv1 = fs.realpathSync(path.resolve(process.argv[1]));
        if (here === argv1) {
            process.exitCode = main(process.argv.slice(2));
        }
    } catch {
        const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
        if (import.meta.url === argvUrl) {
            process.exitCode = main(process.argv.slice(2));
        }
    }
}
