#!/usr/bin/env tsx
/**
 * `agent-config benchmark` — self-measuring token-reduction report
 * (road-to-retrieval-substrate-hardening B7a).
 *
 * Reports the context-token reduction of the retrieval economy against the
 * REAL alternative: the FULL always-loaded projection (council Q4) — the
 * honest "what the user pays if everything loads eagerly + full descriptions".
 * NOT a synthetic full-corpus strawman (explicitly rejected).
 *
 * Baseline components (from the pinned internal/bench/reports/token-baseline.json):
 *   eager_rule_load + skill_descriptions + command_descriptions + mcp_schemas
 * Reduced: eager→thin rule projection, descriptions/schemas unchanged.
 *
 * Deterministic (reads the pinned baseline). Every emitted number binds to
 * docs/CLAIMS.md with a method line (council Q4 hard condition).
 *
 * Usage: benchmark.ts [--baseline PATH] [--format text|json]
 * Exit codes: 0 ok, 1 baseline missing/malformed, 2 usage error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const PROG = 'benchmark.ts';
const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const BASELINE = path.join(REPO_ROOT, 'internal', 'bench', 'reports', 'token-baseline.json');

interface Metrics {
    eager_rule_load: number;
    thin_rule_load: number;
    skill_descriptions: number;
    command_descriptions: number;
    mcp_schemas: number;
}
export interface BenchmarkReport {
    baseline_full_projection: number;
    reduced_projection: number;
    saved: number;
    reduction_ratio: number; // 0..1
    method: string;
    components: Metrics;
}

function _num(v: unknown): number {
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** Compute the reduction report from a token-baseline metrics object. */
export function computeReport(metrics: Metrics): BenchmarkReport {
    const shared = metrics.skill_descriptions + metrics.command_descriptions + metrics.mcp_schemas;
    const full = metrics.eager_rule_load + shared;
    const reduced = metrics.thin_rule_load + shared;
    const saved = full - reduced;
    const ratio = full > 0 ? Math.round((saved / full) * 10000) / 10000 : 0;
    return {
        baseline_full_projection: full,
        reduced_projection: reduced,
        saved,
        reduction_ratio: ratio,
        method:
            'Baseline = FULL always-loaded projection (eager rule load + skill/command ' +
            'descriptions + MCP schemas) from token-baseline.json; reduced = thin rule ' +
            'projection, shared surfaces unchanged. Not a synthetic strawman (council Q4).',
        components: metrics,
    };
}

export function loadMetrics(baselinePath: string): Metrics {
    const parsed = JSON.parse(fs.readFileSync(baselinePath, 'utf-8')) as { metrics?: Record<string, unknown> };
    const m = parsed.metrics ?? {};
    return {
        eager_rule_load: _num(m['eager_rule_load']),
        thin_rule_load: _num(m['thin_rule_load']),
        skill_descriptions: _num(m['skill_descriptions']),
        command_descriptions: _num(m['command_descriptions']),
        mcp_schemas: _num(m['mcp_schemas']),
    };
}

export function main(argv: string[]): number {
    let baselinePath = BASELINE;
    let format: 'text' | 'json' = 'text';
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--baseline') baselinePath = argv[++i] ?? baselinePath;
        else if (a === '--format') format = (argv[++i] as 'text' | 'json') ?? 'text';
        else if (a === '-h' || a === '--help') {
            process.stdout.write(`usage: ${PROG} [--baseline PATH] [--format text|json]\n`);
            return 0;
        } else {
            process.stderr.write(`${PROG}: error: unknown argument ${a}\n`);
            return 2;
        }
    }
    let report: BenchmarkReport;
    try {
        report = computeReport(loadMetrics(baselinePath));
    } catch (exc) {
        process.stderr.write(`${PROG}: cannot read baseline ${baselinePath}: ${String(exc)}\n`);
        return 1;
    }
    if (format === 'json') {
        process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        return 0;
    }
    const pct = (report.reduction_ratio * 100).toFixed(1);
    process.stdout.write(
        `context token reduction (vs full always-loaded projection):\n` +
            `  full projection   ${report.baseline_full_projection} tokens\n` +
            `  reduced (thin)    ${report.reduced_projection} tokens\n` +
            `  saved             ${report.saved} tokens (${pct}%)\n` +
            `  method            ${report.method}\n`,
    );
    return 0;
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
    process.exit(main(process.argv.slice(2)));
}
