#!/usr/bin/env tsx
/**
 * `config-cost report` — what does this configuration cost per session
 * (`road-to-delivered-cost-truth` Phase 1).
 *
 * Class A per ADR-124: in-process, per-invocation, no socket, no daemon, no
 * network, no writes outside a stdout/JSON report. The same class
 * `cache_realization_report` already occupies, and for the same reason.
 *
 * Four figures, and the discipline is the point of each:
 *
 *   delivered payload         from the per-asset ledger, exact BPE where it resolves
 *   billable_input split      fresh input · cache read · cache creation
 *   cache-read share          `null` when nothing was billed, never 0 %
 *   payload_amplification     delivered / profile-declared, or `unknown_profile`
 *
 * NO CURRENCY, ANYWHERE. The suite does not know the consumer's contract, so a
 * monetary figure would be extrapolated from a rate it invented — actionable and
 * wrong, which is worse than absent. `check_no_currency_in_cost_surfaces` gates
 * it rather than leaving it to intent.
 *
 * Usage:
 *   ./scripts-run src/scripts/config_cost_report [--format text|json]
 *     [--root <path>] [--profile <name>] [--transcript-root <path>]
 *     [--max-age-days <n>] [--summary-line]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { buildLedger } from './_lib/asset_delivery_ledger.js';
import {
    amplification,
    billableSplit,
    rereadCost,
    summaryLine,
    type AmplificationResult,
    type BillableSplit,
    type ProfileDeclaration,
    type RereadCost,
    type RereadLeg,
} from './_lib/config_cost.js';
import { prefixStableDirRoots } from './_lib/prefix_stable_surfaces.js';
import { DEFAULT_PROJECTS_ROOT, aggregateByBucket, scanTranscripts } from './_lib/cc_transcript.js';
import { computeRereads } from './_lib/transcript_reads.js';
import { gpt_tokens } from './_lib/token_count.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(HERE, '..', '..');

export interface Options {
    format: 'text' | 'json';
    transcript: string | null;
    root: string;
    profile: string | null;
    transcriptRoot: string;
    maxAgeDays: number;
    summaryOnly: boolean;
}

export function parseArgs(argv: string[]): Options {
    const o: Options = {
        format: 'text',
        transcript: null,
        root: REPO_ROOT,
        profile: null,
        transcriptRoot: DEFAULT_PROJECTS_ROOT,
        maxAgeDays: 14,
        summaryOnly: false,
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === undefined) continue;
        if (a === '--format') o.format = (argv[++i] as Options['format']) ?? o.format;
        else if (a.startsWith('--format=')) o.format = a.slice('--format='.length) as Options['format'];
        else if (a === '--root') o.root = path.resolve(argv[++i] ?? o.root);
        else if (a.startsWith('--root=')) o.root = path.resolve(a.slice('--root='.length));
        else if (a === '--profile') o.profile = argv[++i] ?? null;
        else if (a.startsWith('--profile=')) o.profile = a.slice('--profile='.length);
        else if (a === '--transcript-root') o.transcriptRoot = argv[++i] ?? o.transcriptRoot;
        else if (a.startsWith('--transcript-root=')) o.transcriptRoot = a.slice('--transcript-root='.length);
        else if (a === '--max-age-days') o.maxAgeDays = Number(argv[++i]) || o.maxAgeDays;
        else if (a.startsWith('--max-age-days=')) o.maxAgeDays = Number(a.slice('--max-age-days='.length)) || o.maxAgeDays;
        else if (a === '--transcript') o.transcript = argv[++i] ?? null;
        else if (a.startsWith('--transcript=')) o.transcript = a.slice('--transcript='.length);
        else if (a === '--summary-line') o.summaryOnly = true;
    }
    if (o.format !== 'text' && o.format !== 'json') o.format = 'text';
    return o;
}

/** Read a profile's declared standing payload. Absent file or key → `null`, never a default. */
export function readProfileDeclaration(root: string, profile: string): ProfileDeclaration | null {
    const file = path.join(root, 'src', 'config', 'profiles', `${profile}.ini`);
    let text: string;
    try {
        text = fs.readFileSync(file, 'utf-8');
    } catch {
        return null;
    }
    const num = (key: string): number | null => {
        const m = new RegExp(`^${key}\\s*=\\s*([0-9.]+)\\s*$`, 'm').exec(text);
        if (m === null) return null;
        const v = Number(m[1]);
        return Number.isFinite(v) ? v : null;
    };
    const rules = num('declared_rules_tokens');
    const skills = num('declared_skill_catalogue_tokens');
    const headroom = num('declared_payload_sanity_headroom');
    if (rules === null || skills === null || headroom === null) return null;
    return { profile, declared: { rules_tokens: rules, skill_catalogue_tokens: skills }, sanity_headroom: headroom };
}

/** The active profile, read from the settings cascade. `full` is the shipped default. */
export function activeProfile(root: string, override: string | null): string {
    if (override !== null) return override;
    for (const rel of ['.agent-settings.yml', path.join('agents', 'settings', '.agent-settings.yml')]) {
        try {
            const m = /^\s*profile:\s*['"]?([A-Za-z0-9_-]+)/m.exec(fs.readFileSync(path.join(root, rel), 'utf-8'));
            if (m !== null) return m[1] as string;
        } catch {
            /* absent layer — try the next */
        }
    }
    return 'full';
}

/**
 * Turn the re-reads `hot_context_hook` already counts into a token figure
 * (step 1.3).
 *
 * The hook notices a repeated read and renders it as an advisory line; nothing
 * ever priced it, so a re-read was visible and free-looking. The cost is
 * `duplicate_reads x the file's MEASURED size` — derived, never a constant,
 * because a constant would rank a re-read of a one-line config beside a re-read
 * of a 3,000-token rule.
 *
 * A file that no longer exists is skipped rather than priced at zero: it was
 * genuinely read, and a zero would understate the cost while looking measured.
 */
export function collectRereadLegs(transcriptPath: string | null, root: string): RereadLeg[] {
    if (transcriptPath === null) return [];
    let result;
    try {
        result = computeRereads([transcriptPath]);
    } catch {
        return [];
    }
    const legs: RereadLeg[] = [];
    for (const f of result.files) {
        if (f.duplicate_reads <= 0) continue;
        const rel = path.relative(root, f.file_path);
        if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) continue;
        let text: string;
        try {
            text = fs.readFileSync(f.file_path, 'utf-8');
        } catch {
            continue;
        }
        legs.push({
            file: rel,
            total_reads: f.total_reads,
            duplicate_reads: f.duplicate_reads,
            file_tokens: gpt_tokens(text).tokens,
        });
    }
    legs.sort((a, b) => b.duplicate_reads * b.file_tokens - a.duplicate_reads * a.file_tokens);
    return legs;
}

export interface CostReport {
    schema: 'config-cost-report/v1';
    profile: string;
    delivered: { total_tokens: number; rules_tokens: number; skill_catalogue_tokens: number; exact_throughout: boolean };
    /** `null` with a stated reason when the transcript ledger carries nothing. */
    billable: BillableSplit | null;
    billable_reason: string | null;
    amplification: AmplificationResult;
    reread: RereadCost;
    summary_line: string;
}

export function buildReport(o: Options, legsOverride?: readonly RereadLeg[]): CostReport {
    const legs = legsOverride ?? collectRereadLegs(o.transcript, o.root);
    const [rulesRel, skillsRel] = prefixStableDirRoots();
    const ledger = buildLedger(
        path.join(o.root, rulesRel ?? 'dist/agent-src/rules'),
        path.join(o.root, skillsRel ?? 'dist/agent-src/skills'),
        o.root,
    );
    const measured = {
        rules_tokens: ledger.by_kind.rule.tokens,
        skill_catalogue_tokens: ledger.by_kind['skill-catalogue-line'].tokens,
    };

    let billable: BillableSplit | null = null;
    let billableReason: string | null = null;
    try {
        const scan = scanTranscripts({ root: o.transcriptRoot, maxAgeDays: o.maxAgeDays });
        const buckets = aggregateByBucket(scan.records);
        const fresh = buckets.main.input_tokens + buckets.subagent.input_tokens;
        const read = buckets.main.cache_read_input_tokens + buckets.subagent.cache_read_input_tokens;
        const creation = buckets.main.cache_creation_input_tokens + buckets.subagent.cache_creation_input_tokens;
        if (fresh + read + creation === 0) {
            billableReason = `no billable input recorded under ${o.transcriptRoot} in the last ${String(o.maxAgeDays)} day(s)`;
        } else {
            billable = billableSplit(fresh, read, creation);
        }
    } catch (err) {
        billableReason = `the transcript ledger at ${o.transcriptRoot} could not be read: ${(err as Error).message}`;
    }

    const profile = activeProfile(o.root, o.profile);
    return {
        schema: 'config-cost-report/v1',
        profile,
        delivered: {
            total_tokens: ledger.total_tokens,
            rules_tokens: measured.rules_tokens,
            skill_catalogue_tokens: measured.skill_catalogue_tokens,
            exact_throughout: ledger.exact_throughout,
        },
        billable,
        billable_reason: billableReason,
        amplification: amplification(ledger.total_tokens, measured, readProfileDeclaration(o.root, profile)),
        reread: rereadCost(legs),
        summary_line: summaryLine(ledger.total_tokens, billable),
    };
}

export function renderText(r: CostReport): string {
    const out: string[] = [];
    const n = (v: number): string => String(v);
    out.push('Config-cost report — what this configuration costs per session');
    out.push(`  profile: ${r.profile}`);
    out.push(
        `  delivered standing payload: ${n(r.delivered.total_tokens)} tok ` +
            `(rules ${n(r.delivered.rules_tokens)} · skill catalogue ${n(r.delivered.skill_catalogue_tokens)})` +
            `${r.delivered.exact_throughout ? '' : ' — MIXED measurement, some rows fell back to the chars/4 proxy'}`,
    );
    out.push('');
    out.push('billable_input = fresh input + cache read + cache creation');
    if (r.billable === null) {
        out.push(`  unavailable — ${r.billable_reason ?? 'no reason recorded'}`);
        out.push('  (a stated reason, never zeros standing in for absence)');
    } else {
        const b = r.billable;
        out.push(`  fresh input:    ${n(b.fresh_input_tokens)} tok`);
        out.push(`  cache read:     ${n(b.cache_read_tokens)} tok`);
        out.push(`  cache creation: ${n(b.cache_creation_tokens)} tok`);
        out.push(`  billable total: ${n(b.billable_input_tokens)} tok`);
        out.push(
            `  cache-read share: ${b.cache_read_share === null ? 'unavailable (nothing was billed)' : `${(b.cache_read_share * 100).toFixed(1)}%`}`,
        );
    }
    out.push('');
    out.push('payload amplification (delivered ÷ profile-declared)');
    out.push(`  verdict: ${r.amplification.verdict}`);
    out.push(`  ratio:   ${r.amplification.ratio === null ? 'not computed' : r.amplification.ratio.toFixed(2)}`);
    out.push(`  ${r.amplification.reason}`);
    out.push('');
    out.push('  This measures AMPLIFICATION, not net value. It never observes what the payload');
    out.push('  returned, so it informs the question of whether the configuration earns its cost');
    out.push('  and is not allowed to answer it.');
    if (r.reread.legs.length > 0) {
        out.push('');
        out.push('re-read cost (content paid for twice)');
        out.push(`  wasted: ${n(r.reread.wasted_tokens)} tok across ${n(r.reread.legs.length)} file(s)`);
        if (r.reread.worst_file !== null) out.push(`  worst:  ${r.reread.worst_file}`);
    }
    out.push('');
    out.push(r.summary_line);
    return out.join('\n') + '\n';
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const o = parseArgs(argv);
    let report: CostReport;
    try {
        report = buildReport(o);
    } catch (err) {
        process.stderr.write(`❌  config_cost_report: ${(err as Error).message}\n`);
        return 2;
    }
    if (report.delivered.total_tokens === 0) {
        process.stderr.write(
            '❌  config_cost_report: no standing asset measured. The rule and skill trees are\n' +
                '    generated (`task sync && task generate-tools`); a checkout that has not run them\n' +
                '    has no payload to price. Stated, not reported as a cost of zero.\n',
        );
        return 2;
    }
    if (o.summaryOnly) {
        process.stdout.write(report.summary_line + '\n');
        return 0;
    }
    process.stdout.write(o.format === 'json' ? JSON.stringify(report, null, 2) + '\n' : renderText(report));
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
    process.exit(main());
}
