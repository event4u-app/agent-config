/**
 * Orchestration savings report — CLI.
 *
 * Reads accumulated orchestration telemetry from the audit-log-v1 JSONL files
 * and prints an aggregate token-savings report. Read-only; no network, no
 * mutation. Handles a missing/empty audit dir gracefully.
 *
 * QUALITY × COST PAIRING (council verdict): the savings figures never render
 * without the quality columns (first_pass_success_rate / escalation_rate).
 * When ≥ 20 lines in the window carry the quality fields the real rates
 * render; below 20 the columns render as "n/a (n=<count>)" beside savings.
 *
 * Usage:
 *   ./scripts-run src/scripts/orchestration_savings_report \
 *     [--dir <path>] [--format text|json] [--weights lite=1,medium=5,high=15]
 *
 * Default dir: agents/runtime/state/audit (the audit-log-v1 path where the
 * orchestration layer writes telemetry lines). `--weights` tunes the
 * provider-neutral tier weights behind the MODELED cost-%. See
 * `src/agent-src/contexts/execution/orchestration-telemetry.md`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { aggregateOrchestrationSavings, DEFAULT_TIER_WEIGHTS, type AuditLine, type SavingsReport, type TierWeights } from './_lib/orchestration_savings.js';

const DEFAULT_DIR = 'agents/runtime/state/audit';

interface Options {
    dir: string;
    format: 'text' | 'json';
    weights: TierWeights;
}

/** Parse `lite=1,medium=5,high=15` → weight map. Returns undefined if nothing valid parsed. */
function parseWeights(spec: string | undefined): TierWeights | undefined {
    if (!spec) return undefined;
    const w: TierWeights = {};
    for (const pair of spec.split(',')) {
        const [k, v] = pair.split('=');
        const n = Number(v);
        if (k && Number.isFinite(n)) w[k.trim()] = n;
    }
    return Object.keys(w).length ? w : undefined;
}

function parseArgs(argv: string[]): Options {
    const opts: Options = { dir: DEFAULT_DIR, format: 'text', weights: DEFAULT_TIER_WEIGHTS };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === undefined) continue;
        if (a === '--dir') opts.dir = argv[++i] ?? opts.dir;
        else if (a.startsWith('--dir=')) opts.dir = a.slice('--dir='.length);
        else if (a === '--format') opts.format = (argv[++i] as Options['format']) ?? opts.format;
        else if (a.startsWith('--format=')) opts.format = a.slice('--format='.length) as Options['format'];
        else if (a === '--weights') opts.weights = parseWeights(argv[++i]) ?? opts.weights;
        else if (a.startsWith('--weights=')) opts.weights = parseWeights(a.slice('--weights='.length)) ?? opts.weights;
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

/** Dispatches carrying the quality fields at/above this render the real rates; below, "n/a (n=<count>)". */
export const QUALITY_GATE_MIN_LINES = 20;

function pct(v: number): string {
    return `${(v * 100).toFixed(0)}%`;
}

/**
 * Render the paired cost × quality block. Council verdict: savings NEVER render
 * without the quality columns — at n ≥ QUALITY_GATE_MIN_LINES the real rates
 * render; below, the quality columns render as "n/a (n=<count>)" alongside the
 * savings figures. There is no savings-only render path.
 */
function renderPairedCostQuality(r: SavingsReport): string[] {
    const q = r.quality;
    const gated = q.quality_lines >= QUALITY_GATE_MIN_LINES;
    const fps = gated && q.first_pass_success_rate !== null
        ? `${pct(q.first_pass_success_rate)} (n=${q.first_pass_lines})`
        : `n/a (n=${q.first_pass_lines})`;
    const esc = gated && q.escalation_rate !== null
        ? `${pct(q.escalation_rate)} (n=${q.escalated_lines})`
        : `n/a (n=${q.escalated_lines})`;
    return [
        '  cost × quality (paired — never savings alone):',
        `    net token_delta: ${r.net_token_delta} (negative = net saved)   | first_pass_success_rate: ${fps}`,
        `    tokens saved: ${r.tokens_saved} · tokens added: ${r.tokens_added}   | escalation_rate: ${esc}`,
    ];
}

export function renderText(r: SavingsReport, dir: string): string {
    const out: string[] = [];
    out.push('Orchestration savings report');
    out.push(`  source: ${dir}`);
    out.push(`  dispatches: ${r.dispatches}  (total spawns: ${r.total_spawns})`);
    out.push(...renderPairedCostQuality(r));
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
    const mc = r.modeled_cost;
    if (mc.cost_reduction_pct !== null) {
        out.push(`  MODELED cost reduction: ${(mc.cost_reduction_pct * 100).toFixed(0)}%  (over ${mc.covered_dispatches}/${r.dispatches} dispatch(es) with tier data)`);
        out.push(`    weights ${JSON.stringify(mc.weights)} · baseline ${mc.baseline_cost_units} → delegated ${mc.delegated_cost_units} cost-units · MODEL, not measured $`);
    } else {
        out.push('  MODELED cost reduction: n/a (needs dispatch_tokens + session_tier + tier_chosen on a dispatch)');
    }
    out.push('  notes:');
    for (const n of r.notes) out.push(`    - ${n}`);
    return out.join('\n');
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const opts = parseArgs(argv);
    const lines = readAuditLines(opts.dir);
    const report = aggregateOrchestrationSavings(lines, opts.weights);
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
