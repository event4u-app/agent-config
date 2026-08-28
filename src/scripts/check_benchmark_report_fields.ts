#!/usr/bin/env tsx
/**
 * A benchmark or cost report that omits a required cache field fails, naming the
 * field (`road-to-runtime-context-floors` step 4.1).
 *
 * `cache.read_write_ratio` and `cache.stable_prefix_share` are REQUIRED. A report
 * that cannot compute one emits `{ unavailable: "<reason>" }`; it does not omit
 * the key and it does not emit a zero. A blank reads as "no cache activity" and a
 * zero reads as "the worst possible ratio" — both are claims, and neither is the
 * claim "this was not measured".
 *
 * Contract: `docs/contracts/benchmark-report-schema.md` § The `cache` block.
 *
 * Exit codes: 0 every scanned report carries both fields · 1 a report is missing
 * or malformed · 2 misuse / unreadable input.
 *
 * Usage:
 *   ./scripts-run src/scripts/check_benchmark_report_fields [--dir <path>] [--quiet]
 *   ./scripts-run src/scripts/check_benchmark_report_fields --self-test
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describeProblem, validateCacheBlock, validateProvenanceBlock } from './_lib/benchmark_cache_fields.js';
import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(HERE, '..', '..');
const DEFAULT_DIR = path.join(REPO_ROOT, 'internal', 'bench', 'reports');

export interface ReportFinding {
    file: string;
    message: string;
}

export interface FieldVerdict {
    scanned: number;
    findings: ReportFinding[];
}

/** Only files that ANNOUNCE themselves as benchmark reports are in the corpus. */
function isBenchmarkReport(doc: unknown): boolean {
    const d = doc as { schema_version?: unknown; selection?: unknown; corpus?: unknown } | null;
    if (d === null || typeof d !== 'object') return false;
    return d.schema_version !== undefined && (d.selection !== undefined || d.corpus !== undefined);
}

export function evaluate(dir: string = DEFAULT_DIR, ledger?: GateLedger): FieldVerdict {
    const findings: ReportFinding[] = [];
    let scanned = 0;
    if (!fs.existsSync(dir)) return { scanned, findings };

    const names = fs.readdirSync(dir).sort();
    ledger?.plan(names);

    for (const name of names) {
        if (!name.endsWith('.json')) {
            ledger?.outOfScope(name, 'not_applicable_kind');
            continue;
        }
        const file = path.join(dir, name);
        let doc: unknown;
        try {
            doc = JSON.parse(fs.readFileSync(file, 'utf-8'));
        } catch {
            // Not our corpus; a malformed JSON is another gate's finding.
            ledger?.skip(name, 'binary_content');
            continue;
        }
        if (!isBenchmarkReport(doc)) {
            ledger?.outOfScope(name, 'not_applicable_kind');
            continue;
        }
        scanned += 1;
        const problems = [...validateCacheBlock(doc), ...validateProvenanceBlock(doc)];
        for (const p of problems) {
            findings.push({ file: path.relative(REPO_ROOT, file), message: describeProblem(p) });
        }
        if (problems.length > 0) ledger?.fail(name, `${String(problems.length)} missing or malformed required field(s)`);
        else ledger?.complete(name);
    }
    return { scanned, findings };
}

// ---------------------------------------------------------------- self-test

const BASE = { schema_version: 1, corpus: { id: 'x' }, selection: { top_k: 3 } };

const GOOD_CACHE = { read_write_ratio: 2, stable_prefix_share: 0.5 };

/** A provenance block that passes, so a cache-field case tests only cache fields. */
const GOOD_PROVENANCE = {
    host_binary_hash: 'sha256:deadbeef',
    harness_commit: 'abc1234',
    harness_dirty: false,
    reproducibility: 'task bench-run --corpus x at the commit above',
};

function plant(dir: string, cache: unknown, provenance: unknown = GOOD_PROVENANCE): void {
    const doc: Record<string, unknown> = { ...BASE };
    if (cache !== undefined) doc['cache'] = cache;
    if (provenance !== undefined) doc['provenance'] = provenance;
    fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(doc));
}

function selfTestCases(): SelfTestCase[] {
    const mk = (name: string, expect: 'reject' | 'accept', cache: unknown, provenance?: unknown): SelfTestCase => ({
        name,
        expect,
        run: () => {
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brf-'));
            try {
                plant(dir, cache, provenance === undefined ? GOOD_PROVENANCE : provenance);
                return runGateCli(REPO_ROOT, 'src/scripts/check_benchmark_report_fields.ts', ['--dir', dir, '--quiet'], REPO_ROOT);
            } finally {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        },
    });
    return [
        mk('no cache block at all → reject', 'reject', undefined),
        mk('read_write_ratio missing → reject', 'reject', { stable_prefix_share: 0.5 }),
        mk('stable_prefix_share missing → reject', 'reject', { read_write_ratio: 2 }),
        mk('both present as numbers → accept', 'accept', { read_write_ratio: 2, stable_prefix_share: 0.5 }),
        mk('unavailable WITH a reason → accept', 'accept', {
            read_write_ratio: { unavailable: 'no cache_creation tokens in window' },
            stable_prefix_share: 0.5,
        }),
        mk('unavailable with a BLANK reason → reject', 'reject', {
            read_write_ratio: { unavailable: '  ' },
            stable_prefix_share: 0.5,
        }),
        mk('a share above 1 → reject', 'reject', { read_write_ratio: 2, stable_prefix_share: 1.5 }),
        // Provenance half (step 4.2) — the four reproducibility fields.
        mk('no provenance block at all → reject', 'reject', GOOD_CACHE, null),
        mk('harness_commit missing → reject', 'reject', GOOD_CACHE, { ...GOOD_PROVENANCE, harness_commit: undefined }),
        mk('reproducibility is an empty string → reject', 'reject', GOOD_CACHE, { ...GOOD_PROVENANCE, reproducibility: '  ' }),
        mk('harness_dirty as a string → reject', 'reject', GOOD_CACHE, { ...GOOD_PROVENANCE, harness_dirty: 'no' }),
        // `false` is the GOOD case for a dirty flag, and a truthiness check
        // would silently reject it. Pinned so it cannot regress.
        mk('harness_dirty: false → accept', 'accept', GOOD_CACHE, { ...GOOD_PROVENANCE, harness_dirty: false }),
        mk('harness_dirty: true → accept — a fact, not a failure', 'accept', GOOD_CACHE, { ...GOOD_PROVENANCE, harness_dirty: true }),
        mk('a field unavailable WITH a reason → accept', 'accept', GOOD_CACHE, {
            ...GOOD_PROVENANCE,
            host_binary_hash: { unavailable: 'the host binary is not on PATH in this runner' },
        }),
    ];
}

// ---------------------------------------------------------------------- CLI

export function main(argv: string[] = process.argv.slice(2)): number {
    if (argv.includes('--self-test')) {
        return runSelfTest({ gate: 'check_benchmark_report_fields', cases: selfTestCases(), minCases: 12, minRejectCases: 8 });
    }
    const quiet = argv.includes('--quiet');
    const di = argv.indexOf('--dir');
    const dirArg = di !== -1 ? argv[di + 1] : undefined;
    const dir = dirArg !== undefined ? path.resolve(dirArg) : DEFAULT_DIR;

    const ledger = new GateLedger('check_benchmark_report_fields');
    let v: FieldVerdict;
    try {
        v = evaluate(dir, ledger);
    } catch (err) {
        process.stderr.write(`❌  check_benchmark_report_fields: ${(err as Error).message}\n`);
        return 2;
    }

    try {
        reportScanned({
            gate: 'check_benchmark_report_fields',
            scanned: v.scanned,
            units: 'benchmark report(s)',
            roots: [path.relative(REPO_ROOT, dir)],
            // A tree with no committed benchmark report is a real state: reports
            // are run artefacts, not source. The gate exists to fail the day one
            // is committed without the block, not to demand one exist.
            allowEmpty: 'OPTIONAL_INPUT: benchmark reports are run artefacts; a checkout may legitimately carry none',
        });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`❌  check_benchmark_report_fields: ${err.message}\n`);
            return 2;
        }
        throw err;
    }

    ledger.report();

    if (v.findings.length > 0) {
        for (const f of v.findings) process.stderr.write(`❌  ${f.file}: ${f.message}\n`);
        process.stderr.write(`\n    Contract: docs/contracts/benchmark-report-schema.md § The \`cache\` block.\n`);
        return 1;
    }
    if (!quiet) process.stdout.write(`✅  every benchmark report carries its required cache and provenance fields (${String(v.scanned)} report(s)).\n`);
    return 0;
}

if (process.env['GATE_SELF_TEST_CHILD'] !== '1' || process.argv.includes('--dir')) {
    if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
        process.exit(main());
    }
}
