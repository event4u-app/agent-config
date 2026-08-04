#!/usr/bin/env tsx
/**
 * lint_persistence — deterministic persistence-lint substrate for the
 * scale-discipline / history-discipline packs
 * (road-to-scale-and-history-discipline; spike verdicts:
 * docs/spikes/scale-history-spikes.md).
 *
 * Adapters:
 *   raw-sql   — R-A6 migration-safety (F6) + R-A7 growth-budget (F7)
 *   eloquent  — R-A1 N+1 (F1), R-A2 index-parity (F2), R-A8/R-A10
 *               offload + durable-async (F9/F11), R-B1 audit-coverage (F8,
 *               only when an audit-scope file is present)
 *   prisma    — R-A2 index-parity (F2) over schema.prisma + client queries
 *
 * "Deterministic" = deterministic pattern detection with an auditable waiver
 * process; `advice`-tier findings never fail the run. Waivers with empty
 * reason text are hygiene errors.
 *
 * Usage:
 *   lint_persistence --dir <path> [--stack raw-sql|eloquent|prisma]...
 *                    [--audit-scope <file.json>] [--format json|text]
 *                    [--quiet]
 *
 * Exit codes: 0 no gate findings · 1 gate findings (or empty-reason waivers)
 * · 2 usage error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';
import type { Finding, WaiverRecord } from './_lib/persistence/types.js';
import { scan_dir as scan_sql_dir } from './_lib/persistence/adapter_raw_sql.js';
import { scan_dir as scan_n1_dir } from './_lib/persistence/detect_n1_eloquent.js';
import { analyze as analyze_index_parity } from './_lib/persistence/detect_index_parity.js';
import { scan_dir as scan_offload_dir } from './_lib/persistence/detect_offload.js';
import { analyze_repo as analyze_audit } from './_lib/persistence/detect_audit_coverage.js';
import { scan_dir as scan_bounded_dir } from './_lib/persistence/detect_bounded_reads.js';
import { scan_dir as scan_prisma_growth_dir } from './_lib/persistence/detect_prisma_growth.js';

const _HERE = fileURLToPath(import.meta.url);

export type StackId = 'raw-sql' | 'eloquent' | 'prisma';

export interface LintReport {
    findings: Finding[];
    gate_count: number;
    advice_count: number;
    waived_count: number;
    empty_reason_waivers: WaiverRecord[];
    stacks: StackId[];
}

export function detect_stacks(dir: string): StackId[] {
    const stacks = new Set<StackId>();
    const walk = (d: string, depth: number): void => {
        if (depth > 6) return;
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            if (e.name === 'node_modules' || e.name === 'vendor' || e.name.startsWith('.')) continue;
            const p = path.join(d, e.name);
            if (e.isDirectory()) walk(p, depth + 1);
            else if (e.name.endsWith('.sql')) stacks.add('raw-sql');
            else if (e.name === 'schema.prisma') stacks.add('prisma');
            else if (e.name.endsWith('.php')) stacks.add('eloquent');
        }
    };
    walk(dir, 0);
    return [...stacks];
}

export function run_lint(dir: string, stacks: StackId[], audit_scope_file?: string): LintReport {
    const findings: Finding[] = [];
    const empty_reason_waivers: WaiverRecord[] = [];

    for (const stack of stacks) {
        if (stack === 'raw-sql') {
            const res = scan_sql_dir(dir);
            findings.push(...res.findings);
            empty_reason_waivers.push(...res.waivers.filter((w) => w.reason === ''));
        } else if (stack === 'eloquent') {
            findings.push(...scan_n1_dir(dir));
            findings.push(...analyze_index_parity(dir).findings);
            findings.push(...scan_offload_dir(dir, 'eloquent'));
            findings.push(...scan_bounded_dir(dir));
            const scope_file = audit_scope_file ?? path.join(dir, 'audit-scope.json');
            if (fs.existsSync(scope_file)) {
                const scope = JSON.parse(fs.readFileSync(scope_file, 'utf8'));
                findings.push(...analyze_audit(dir, scope).findings);
            }
        } else if (stack === 'prisma') {
            findings.push(...analyze_index_parity(dir).findings);
            findings.push(...scan_offload_dir(dir, 'ts'));
            findings.push(...scan_prisma_growth_dir(dir));
        }
    }

    const active = findings.filter((f) => !f.waived);
    return {
        findings,
        gate_count: active.filter((f) => f.tier === 'gate').length,
        advice_count: active.filter((f) => f.tier === 'advice').length,
        waived_count: findings.filter((f) => f.waived).length,
        empty_reason_waivers,
        stacks,
    };
}

function format_text(report: LintReport): string {
    const lines: string[] = [];
    for (const f of report.findings) {
        const mark = f.waived ? 'waived' : f.tier;
        lines.push(`${f.file}:${f.line} [${f.rule}/${mark}] ${f.message}`);
    }
    for (const w of report.empty_reason_waivers) {
        lines.push(`${w.file}:${w.line} [waiver-hygiene/gate] empty ${w.kind} waiver reason — a waiver must say why`);
    }
    lines.push(
        `${report.gate_count} gate · ${report.advice_count} advice · ${report.waived_count} waived · stacks: ${report.stacks.join(', ') || 'none'}`,
    );
    return lines.join('\n') + '\n';
}

function main(argv: string[]): number {
    let dir = '';
    const stacks: StackId[] = [];
    let audit_scope: string | undefined;
    let format = 'text';
    let quiet = false;

    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--dir') dir = argv[++i] ?? '';
        else if (a === '--stack') {
            const s = argv[++i] as StackId;
            if (!['raw-sql', 'eloquent', 'prisma'].includes(s)) {
                process.stderr.write(`❌  unknown stack: ${s}\n`);
                return 2;
            }
            stacks.push(s);
        } else if (a === '--audit-scope') audit_scope = argv[++i];
        else if (a === '--format') format = argv[++i] ?? 'text';
        else if (a === '--quiet') quiet = true;
        else {
            process.stderr.write(`❌  unknown argument: ${a}\n`);
            return 2;
        }
    }
    if (!dir || !fs.existsSync(dir)) {
        process.stderr.write('❌  --dir <path> is required and must exist\n');
        return 2;
    }

    const resolved_stacks = stacks.length > 0 ? stacks : detect_stacks(dir);
    // `--dir` existing is not the same as `--dir` holding anything scannable:
    // every adapter is keyed off a resolved stack, so zero stacks provably
    // reads zero files while still printing "no gate findings". Exit 2 is the
    // usage/env slot this CLI already uses for an unusable `--dir`.
    try {
        assertScanned({
            gate: 'lint_persistence',
            scanned: resolved_stacks.length,
            units: 'stack(s) to scan',
            roots: [dir],
        });
    } catch (e) {
        if (e instanceof DeadScopeError) {
            process.stderr.write(`❌  ${e.message}\n`);
            return 2;
        }
        throw e;
    }
    const report = run_lint(dir, resolved_stacks, audit_scope);

    if (format === 'json') {
        process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    } else if (!quiet || report.gate_count > 0 || report.empty_reason_waivers.length > 0) {
        process.stdout.write(format_text(report));
    }

    const failed = report.gate_count > 0 || report.empty_reason_waivers.length > 0;
    if (!failed && !quiet && format !== 'json') {
        process.stdout.write('✅  lint_persistence: no gate findings\n');
    }
    return failed ? 1 : 0;
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(_HERE);
if (isMain) {
    process.exit(main(process.argv.slice(2)));
}
