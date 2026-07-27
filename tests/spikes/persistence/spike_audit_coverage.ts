#!/usr/bin/env tsx
/**
 * Spike S0.4 — audit-coverage detection (road-to-scale-and-history-discipline
 * Phase 0). Given a declared audit scope, can mutation call sites lacking
 * audit emission be detected in a Laravel-shaped fixture repo?
 *
 * Ground truth lives in tests/fixtures/persistence/audit/ground-truth.json
 * (labeled a priori with the fixtures). Matching is by file + line proximity
 * (±3 lines around line_approx).
 *
 * PASS: recall ≥ 0.9 at precision ≥ 0.8. Verdict is data, not a gate —
 * exit 0 always.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyze_repo } from '../../../src/scripts/_lib/persistence/detect_audit_coverage.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AUDIT_DIR = path.resolve(HERE, '..', '..', 'fixtures', 'persistence', 'audit');
const REPO = path.join(AUDIT_DIR, 'repo');
const TOLERANCE = 3;

interface GroundTruth {
    file: string;
    line_approx: number;
    covered: boolean;
}

function main(): void {
    const truth: GroundTruth[] = JSON.parse(
        fs.readFileSync(path.join(AUDIT_DIR, 'ground-truth.json'), 'utf8'),
    );
    const scope = JSON.parse(fs.readFileSync(path.join(REPO, 'audit-scope.json'), 'utf8'));
    const result = analyze_repo(REPO, scope);

    const expected_uncovered = truth.filter((t) => !t.covered);
    const found = result.findings.filter((f) => !f.waived);

    const matches = (t: GroundTruth, f: { file: string; line: number }): boolean =>
        f.file.endsWith(t.file) && Math.abs(f.line - t.line_approx) <= TOLERANCE;

    const misses = expected_uncovered.filter((t) => !found.some((f) => matches(t, f)));
    const false_alarms = found.filter((f) => !expected_uncovered.some((t) => matches(t, f)));

    const recall =
        expected_uncovered.length === 0
            ? 1
            : (expected_uncovered.length - misses.length) / expected_uncovered.length;
    const precision = found.length === 0 ? 1 : (found.length - false_alarms.length) / found.length;
    const pass = recall >= 0.9 && precision >= 0.8;

    const verdict = {
        spike: 'S0.4',
        ground_truth_sites: truth.length,
        expected_uncovered: expected_uncovered.length,
        findings: found.length,
        recall: Number(recall.toFixed(3)),
        precision: Number(precision.toFixed(3)),
        pass,
        misses: misses.map((m) => `${m.file}:~${m.line_approx}`),
        false_alarms: false_alarms.map((f) => `${f.file}:${f.line} ${f.message}`),
        mutations_total: result.mutations_total,
        covered: result.covered,
        uncovered: result.uncovered,
    };
    process.stdout.write(JSON.stringify(verdict, null, 2) + '\n');
    process.stdout.write(
        `${pass ? '✅' : '❌'}  S0.4 audit-coverage: recall ${(recall * 100).toFixed(1)}% ` +
            `(≥90), precision ${(precision * 100).toFixed(1)}% (≥80)\n`,
    );
}

main();
