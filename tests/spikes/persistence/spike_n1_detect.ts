#!/usr/bin/env tsx
/**
 * Spike S0.1 — N+1 detection falsification (road-to-scale-and-history-discipline).
 *
 * Runs detect_n1_eloquent over the a-priori fixture corpus:
 *   tests/fixtures/persistence/n1/true/       — 10 genuine N+1 files (must flag)
 *   tests/fixtures/persistence/n1/lookalike/  — 10 non-N+1 look-alikes (must not flag)
 *
 * Verdict: pass when TP >= 9 and FP <= 1. Verdict is data, not a gate —
 * always exits 0.
 */

import { readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { detect_n1, scan_dir } from '../../../src/scripts/_lib/persistence/detect_n1_eloquent.js';
import type { Finding } from '../../../src/scripts/_lib/persistence/types.js';

const ROOT = join(import.meta.dirname, '../../..');
const TRUE_DIR = join(ROOT, 'tests/fixtures/persistence/n1/true');
const LOOKALIKE_DIR = join(ROOT, 'tests/fixtures/persistence/n1/lookalike');

interface PerFile {
    file: string;
    expected: 'flag' | 'clean';
    flagged: boolean;
    findings: number;
    correct: boolean;
}

function evaluate(dir: string, expected: 'flag' | 'clean'): PerFile[] {
    const findings: Finding[] = scan_dir(dir);
    const active = findings.filter((f) => !f.waived);
    const flagged_files = new Set(active.map((f) => basename(f.file)));
    return readdirSync(dir)
        .filter((n) => n.endsWith('.php'))
        .sort()
        .map((name) => {
            const flagged = flagged_files.has(name);
            return {
                file: name,
                expected,
                flagged,
                findings: active.filter((f) => basename(f.file) === name).length,
                correct: expected === 'flag' ? flagged : !flagged,
            };
        });
}

const true_results = evaluate(TRUE_DIR, 'flag');
const lookalike_results = evaluate(LOOKALIKE_DIR, 'clean');

const tp = true_results.filter((r) => r.flagged).length;
const fp = lookalike_results.filter((r) => r.flagged).length;
const verdict = {
    spike: 'S0.1',
    tp,
    tp_total: true_results.length,
    fp,
    fp_total: lookalike_results.length,
    pass: tp >= 9 && fp <= 1,
    per_file: [...true_results, ...lookalike_results],
};

console.log(JSON.stringify(verdict, null, 2));
console.log(
    `${verdict.pass ? '✅' : '❌'} S0.1 N+1 detection: TP ${tp}/${verdict.tp_total}, FP ${fp}/${verdict.fp_total}`,
);
// Keep detect_n1 referenced as the exported API surface under test.
void detect_n1;
process.exit(0);
