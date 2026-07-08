/**
 * Orchestration savings report — CLI.
 *
 * Reads accumulated orchestration telemetry from the audit-log-v1 JSONL files
 * and prints an aggregate token-savings report. Read-only; no network, no
 * mutation. Handles a missing/empty audit dir gracefully.
 *
 * Usage:
 *   ./scripts-run src/scripts/orchestration_savings_report [--dir <path>] [--format text|json]
 *
 * Default dir: agents/runtime/state/audit (the audit-log-v1 path where the
 * orchestration layer writes telemetry lines). See
 * `src/agent-src/contexts/execution/orchestration-telemetry.md`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { aggregateOrchestrationSavings, type AuditLine, type SavingsReport } from './_lib/orchestration_savings.js';

const DEFAULT_DIR = 'agents/runtime/state/audit';

interface Options {
    dir: string;
    format: 'text' | 'json';
}

function parseArgs(argv: string[]): Options {
    const opts: Options = { dir: DEFAULT_DIR, format: 'text' };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--dir') opts.dir = argv[++i] ?? opts.dir;
        else if (a.startsWith('--dir=')) opts.dir = a.slice('--dir='.length);
        else if (a === '--format') opts.format = (argv[++i] as Options['format']) ?? opts.format;
        else if (a.startsWith('--format=')) opts.format = a.slice('--format='.length) as Options['format'];
    }
    if (opts.format !== 'text' && opts.format !== 'json') opts.format = 'text';
    return opts;
}

/** Read + parse every `.jsonl` line in `dir`. Malformed lines are skipped. */
export function readAuditLines(dir: string): AuditLine[] {
    if (!fs.existsSync(dir)) return [];
    const lines: AuditLine[] = [];
    for (const entry of fs.readdirSync(dir).sort()) {
        if (!entry.endsWith('.jsonl')) continue;
        const raw = fs.readFileSync(path.join(dir, entry), 'utf8');
        for (const ln of raw.split('\n')) {
            const trimmed = ln.trim();
            if (!trimmed) continue;
            try {
                lines.push(JSON.parse(trimmed) as AuditLine);
            } catch {
                // Skip malformed line — a partial write must not crash the report.
            }
        }
    }
    return lines;
}

function renderText(r: SavingsReport, dir: string): string {
    const out: string[] = [];
    out.push('Orchestration savings report');
    out.push(`  source: ${dir}`);
    out.push(`  dispatches: ${r.dispatches}  (total spawns: ${r.total_spawns})`);
    out.push(`  net token_delta: ${r.net_token_delta}  (negative = net saved)`);
    out.push(`  tokens saved: ${r.tokens_saved}   tokens added: ${r.tokens_added}`);
    out.push(`  provenance: measured ${r.by_provenance.measured.dispatches} (Δ ${r.by_provenance.measured.net_token_delta}) · estimated ${r.by_provenance.estimated.dispatches} (Δ ${r.by_provenance.estimated.net_token_delta})`);
    out.push(`  measured share: ${(r.measured_share * 100).toFixed(0)}%`);
    if (Object.keys(r.by_tier).length) {
        out.push('  by tier (Δ tokens):');
        for (const [tier, d] of Object.entries(r.by_tier).sort()) out.push(`    ${tier}: ${d}`);
    }
    if (Object.keys(r.by_task_class).length) {
        out.push('  by task_class (Δ tokens):');
        for (const [cls, d] of Object.entries(r.by_task_class).sort()) out.push(`    ${cls}: ${d}`);
    }
    out.push('  notes:');
    for (const n of r.notes) out.push(`    - ${n}`);
    return out.join('\n');
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const opts = parseArgs(argv);
    const lines = readAuditLines(opts.dir);
    const report = aggregateOrchestrationSavings(lines);
    if (opts.format === 'json') {
        process.stdout.write(JSON.stringify({ ...report, source: opts.dir }, null, 2) + '\n');
    } else {
        process.stdout.write(renderText(report, opts.dir) + '\n');
    }
    return 0;
}

if (process.argv[1] !== undefined) {
    const invokedUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === invokedUrl) process.exit(main());
}
