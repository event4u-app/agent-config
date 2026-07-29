#!/usr/bin/env tsx
/**
 * Measure the encoding floor against the FROZEN corpus
 * (road-to-runtime-encoding-hardening Phase 4).
 *
 * Renders the numbers from the corpus — never hand-typed — and evaluates them
 * against the thresholds the roadmap pre-registered BEFORE the detector existed:
 *
 *   recall on in-scope positives            >= 0.95
 *   recall on unambiguous classes           >= 0.99
 *     (zero-width, bidi, variation-selector)
 *   false-positive rate on clean negatives  <= 0.005
 *   added runtime model spend               == 0   (structural: no model call)
 *   added latency                           <  2 ms p95 per message
 *
 * A positive counts as DETECTED when the floor either strips its signal
 * (`sanitize_text` changed the value) or reports it (`scan_encoding_findings`
 * returned a finding). Both are "the vector did not reach the model unnoticed",
 * which is the property under test.
 *
 * Usage:
 *     encoding_corpus_report            # human summary + exit 1 if a gate fails
 *     encoding_corpus_report --json     # machine payload
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { OUT_DIR, type CorpusEntry } from './encoding_corpus.js';
import { sanitize_text, scan_encoding_findings } from './_lib/retrieval_sanitize.js';

/** Pre-registered acceptance thresholds — do not edit to make a run pass. */
export const THRESHOLDS = {
    recall_all: 0.95,
    recall_unambiguous: 0.99,
    fp_rate_max: 0.005,
    latency_p95_ms_max: 2,
} as const;

/** Classes the roadmap singled out as unambiguous → higher recall bar. */
export const UNAMBIGUOUS_CHANNELS: readonly string[] = [
    'zero-width',
    'zero-width-joiner-bom',
    'bidi-control',
    'variation-selector-run',
];

function _readJsonl(name: string): CorpusEntry[] {
    return fs
        .readFileSync(path.join(OUT_DIR, name), 'utf-8')
        .split('\n')
        .filter((l) => l !== '')
        .map((l) => JSON.parse(l) as CorpusEntry);
}

/** True when the floor either stripped or reported the entry's signal. */
export function detected(text: string): { hit: boolean; stripped: boolean; flagged: boolean } {
    const stripped = sanitize_text(text) !== text;
    const flagged = scan_encoding_findings(text).length > 0;
    return { hit: stripped || flagged, stripped, flagged };
}

export interface Report {
    readonly corpus: { positives: number; negatives: number };
    readonly recall_all: number;
    readonly recall_unambiguous: number;
    readonly fp_rate: number;
    readonly per_channel: Record<string, { n: number; detected: number; recall: number }>;
    readonly false_positives: readonly string[];
    readonly latency_p95_ms: number;
    readonly model_calls: 0;
    readonly gates: Record<string, { value: number; threshold: number; pass: boolean }>;
    readonly verdict: 'ADOPT' | 'DETECT-AND-FLAG-ONLY' | 'FAIL';
}

function _p95(samples: readonly number[]): number {
    const sorted = [...samples].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
    return sorted[idx] ?? 0;
}

export function measure(): Report {
    const positives = _readJsonl('positives.jsonl');
    const negatives = _readJsonl('negatives.jsonl');

    const perChannel: Record<string, { n: number; detected: number; recall: number }> = {};
    const latencies: number[] = [];
    let hits = 0;
    for (const e of positives) {
        const t0 = process.hrtime.bigint();
        const d = detected(e.text);
        latencies.push(Number(process.hrtime.bigint() - t0) / 1e6);
        const slot = perChannel[e.channel] ?? { n: 0, detected: 0, recall: 0 };
        slot.n += 1;
        if (d.hit) {
            slot.detected += 1;
            hits += 1;
        }
        slot.recall = slot.detected / slot.n;
        perChannel[e.channel] = slot;
    }

    const falsePositives: string[] = [];
    for (const e of negatives) {
        const t0 = process.hrtime.bigint();
        const d = detected(e.text);
        latencies.push(Number(process.hrtime.bigint() - t0) / 1e6);
        if (d.hit) falsePositives.push(`${e.id}: ${e.text.slice(0, 90)}`);
    }

    const unambiguous = positives.filter((e) => UNAMBIGUOUS_CHANNELS.includes(e.channel));
    const unambiguousHits = unambiguous.filter((e) => detected(e.text).hit).length;

    const recallAll = positives.length === 0 ? 0 : hits / positives.length;
    const recallUnambiguous = unambiguous.length === 0 ? 0 : unambiguousHits / unambiguous.length;
    const fpRate = negatives.length === 0 ? 0 : falsePositives.length / negatives.length;
    const p95 = _p95(latencies);

    const gates = {
        recall_all: { value: recallAll, threshold: THRESHOLDS.recall_all, pass: recallAll >= THRESHOLDS.recall_all },
        recall_unambiguous: {
            value: recallUnambiguous,
            threshold: THRESHOLDS.recall_unambiguous,
            pass: recallUnambiguous >= THRESHOLDS.recall_unambiguous,
        },
        fp_rate: { value: fpRate, threshold: THRESHOLDS.fp_rate_max, pass: fpRate <= THRESHOLDS.fp_rate_max },
        latency_p95_ms: {
            value: p95,
            threshold: THRESHOLDS.latency_p95_ms_max,
            pass: p95 < THRESHOLDS.latency_p95_ms_max,
        },
    };

    // The roadmap's pre-registered branch: recall clears but FP is over budget →
    // ship detect-and-flag only, never automatic quarantine, and publish the FP
    // number. Nothing here quarantines anyway, so this records which branch the
    // measurement selected rather than switching behaviour after the fact.
    const recallOk = gates.recall_all.pass && gates.recall_unambiguous.pass;
    const verdict: Report['verdict'] = !recallOk
        ? 'FAIL'
        : gates.fp_rate.pass && gates.latency_p95_ms.pass
          ? 'ADOPT'
          : 'DETECT-AND-FLAG-ONLY';

    return {
        corpus: { positives: positives.length, negatives: negatives.length },
        recall_all: recallAll,
        recall_unambiguous: recallUnambiguous,
        fp_rate: fpRate,
        per_channel: perChannel,
        false_positives: falsePositives,
        latency_p95_ms: p95,
        model_calls: 0,
        gates,
        verdict,
    };
}

function _render(r: Report): string {
    const pct = (n: number): string => (n * 100).toFixed(2) + '%';
    const lines: string[] = [];
    lines.push(`corpus: ${r.corpus.positives} positives · ${r.corpus.negatives} negatives`);
    lines.push('');
    lines.push('per-channel recall');
    for (const [ch, s] of Object.entries(r.per_channel).sort()) {
        const mark = s.recall === 1 ? '  ' : '!!';
        lines.push(`  ${mark} ${ch.padEnd(24)} ${s.detected}/${s.n}  ${pct(s.recall)}`);
    }
    lines.push('');
    for (const [name, g] of Object.entries(r.gates)) {
        const cmp = name === 'fp_rate' || name === 'latency_p95_ms' ? '<=' : '>=';
        const val = name === 'latency_p95_ms' ? `${g.value.toFixed(3)} ms` : pct(g.value);
        const thr = name === 'latency_p95_ms' ? `${g.threshold} ms` : pct(g.threshold);
        lines.push(`  ${g.pass ? 'PASS' : 'FAIL'}  ${name.padEnd(20)} ${val} ${cmp} ${thr}`);
    }
    lines.push(`  PASS  ${'model_calls'.padEnd(20)} 0 (structural: no model call on this path)`);
    if (r.false_positives.length > 0) {
        lines.push('');
        lines.push(`false positives (${r.false_positives.length}):`);
        for (const fp of r.false_positives.slice(0, 12)) lines.push(`  - ${fp}`);
        if (r.false_positives.length > 12) {
            lines.push(`  … ${r.false_positives.length - 12} more`);
        }
    }
    lines.push('');
    lines.push(`verdict: ${r.verdict}`);
    return lines.join('\n') + '\n';
}

export function main(argv: readonly string[] | null = null): number {
    const args = argv ?? process.argv.slice(2);
    const r = measure();
    if (args.includes('--json')) {
        process.stdout.write(JSON.stringify(r, null, 2) + '\n');
    } else {
        process.stdout.write(_render(r));
    }
    return r.verdict === 'FAIL' ? 1 : 0;
}

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return false;
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exitCode = main();
}
