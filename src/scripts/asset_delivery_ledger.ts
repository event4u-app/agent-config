#!/usr/bin/env tsx
/**
 * Per-asset delivery ledger — which assets produce the standing payload
 * (`road-to-delivered-cost-truth` step 2.1).
 *
 * `check_preamble_payload_budget` measures three BUCKET totals and refuses
 * growth. It cannot say which asset inside a bucket produces the cost, so a
 * reduction effort has a number (35,692 tokens over a published milestone) and
 * no target. This command ranks the assets behind that number.
 *
 * Class A per ADR-124: in-process, per-invocation, no socket, no daemon, no
 * network, no writes outside a stdout/JSON report.
 *
 * Usage:
 *   ./scripts-run src/scripts/asset_delivery_ledger [--format text|json]
 *     [--top <n>] [--root <path>]
 */
import * as path from 'node:path';

import {
    buildLedger,
    reconcile,
    RECONCILE_MARGIN,
    type AssetRow,
    type LedgerVerdict,
    type Reconciliation,
} from './_lib/asset_delivery_ledger.js';
import { measureDeterministicPayload } from './check_preamble_payload_budget.js';
import { prefixStableDirRoots } from './_lib/prefix_stable_surfaces.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(HERE, '..', '..');

export interface Options {
    format: 'text' | 'json';
    top: number;
    root: string;
}

export function parseArgs(argv: string[]): Options {
    const opts: Options = { format: 'text', top: 20, root: REPO_ROOT };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === undefined) continue;
        if (a === '--format') opts.format = (argv[++i] as Options['format']) ?? opts.format;
        else if (a.startsWith('--format=')) opts.format = a.slice('--format='.length) as Options['format'];
        else if (a === '--top') opts.top = Number(argv[++i]) || opts.top;
        else if (a.startsWith('--top=')) opts.top = Number(a.slice('--top='.length)) || opts.top;
        else if (a === '--root') opts.root = path.resolve(argv[++i] ?? opts.root);
        else if (a.startsWith('--root=')) opts.root = path.resolve(a.slice('--root='.length));
    }
    if (opts.format !== 'text' && opts.format !== 'json') opts.format = 'text';
    return opts;
}

export interface Report {
    schema: 'asset-delivery-ledger/v1';
    ledger: LedgerVerdict;
    reconciliation: Reconciliation[];
    reconcile_margin: number;
}

export function buildReport(root: string): Report {
    // Roots come from the prefix-stable registry, the same module the payload
    // gate resolves its census roots from. A third statement of the same
    // boundary is the drift shape this repository already pays for.
    const [rulesRel, skillsRel] = prefixStableDirRoots();
    const ledger = buildLedger(
        path.join(root, rulesRel ?? 'dist/agent-src/rules'),
        path.join(root, skillsRel ?? 'dist/agent-src/skills'),
        root,
    );
    return {
        schema: 'asset-delivery-ledger/v1',
        ledger,
        reconciliation: reconcile(ledger, measureDeterministicPayload(root)),
        reconcile_margin: RECONCILE_MARGIN,
    };
}

function pct(v: number): string {
    return `${(v * 100).toFixed(1)}%`;
}

export function renderText(r: Report, top: number): string {
    const out: string[] = [];
    const l = r.ledger;
    out.push('Per-asset delivery ledger — what every spawn pays for');
    out.push(
        `  measurement: ${l.exact_throughout ? 'exact BPE throughout' : 'MIXED — some rows fall back to the chars/4 proxy'}`,
    );
    out.push(`  total: ${l.total_tokens} tok across ${l.rows.length} asset(s)`);
    out.push(
        `  by kind: rules ${l.by_kind.rule.tokens} tok (${l.by_kind.rule.count}) · ` +
            `skill catalogue lines ${l.by_kind['skill-catalogue-line'].tokens} tok (${l.by_kind['skill-catalogue-line'].count})`,
    );
    out.push('');
    out.push(`Top ${Math.min(top, l.rows.length)} by delivered tokens:`);
    out.push(`  ${'tokens'.padStart(7)}  ${'share'.padStart(6)}  ${'method'.padEnd(6)}  asset`);
    for (const row of l.rows.slice(0, top)) {
        out.push(
            `  ${String(row.tokens).padStart(7)}  ${pct(row.share).padStart(6)}  ${row.method.padEnd(6)}  ${row.name} (${row.kind})`,
        );
    }
    out.push('');
    out.push('Reconciliation against the payload gate\'s own bucket totals:');
    if (r.reconciliation.length === 0) {
        out.push('  no bucket to reconcile against — the payload census measured nothing');
    }
    for (const rec of r.reconciliation) {
        const mark = rec.within_margin ? '✅' : '❌';
        out.push(
            `  ${mark} ${rec.bucket}: ledger ${rec.ledger_proxy_tokens} tok vs bucket ${rec.bucket_tokens} tok ` +
                `(drift ${pct(rec.drift)}, margin ${pct(r.reconcile_margin)}) · both chars/4` +
                `\n       exact BPE for the same assets: ${rec.ledger_exact_tokens} tok` +
                ` (${pct(1 - rec.ledger_exact_tokens / Math.max(rec.ledger_proxy_tokens, 1))} below the proxy)`,
        );
    }
    out.push('');
    out.push('  Reconciled like-for-like: both sides are chars/4, so what remains is real');
    out.push('  disagreement rather than a method gap. The exact BPE figure is shown beside each');
    out.push('  bucket because the gap is the interesting part — chars/4 overestimates short');
    out.push('  structured lines far more than it does prose, which is why the skill catalogue');
    out.push('  and the rule bodies diverge from the proxy by very different amounts.');
    return out.join('\n') + '\n';
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const opts = parseArgs(argv);
    let report: Report;
    try {
        report = buildReport(opts.root);
    } catch (err) {
        process.stderr.write(`❌  asset_delivery_ledger: ${(err as Error).message}\n`);
        return 2;
    }

    if (report.ledger.rows.length === 0) {
        process.stderr.write(
            '❌  asset_delivery_ledger: no asset measured. The standing rule and skill trees are\n' +
                '    generated (`task sync && task generate-tools`); a checkout that has not run them\n' +
                '    has nothing to rank. This is a stated reason, not an empty ledger reported as zero.\n',
        );
        return 2;
    }

    process.stdout.write(
        opts.format === 'json' ? JSON.stringify(report, null, 2) + '\n' : renderText(report, opts.top),
    );
    return report.reconciliation.every((r) => r.within_margin) ? 0 : 1;
}

if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
    process.exit(main());
}

export type { AssetRow };
