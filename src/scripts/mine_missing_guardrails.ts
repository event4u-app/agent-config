#!/usr/bin/env node
/**
 * A4 — Ablation-mining (learning-loop #1). Correlate rule *absence* with failure
 * across INDEPENDENT runs (distinct `work_id`) and surface *missing-guardrail*
 * candidates for the human to promote via `learning-to-rule-or-skill`.
 *
 * Read-only over `audit-log-v1` (`agents/runtime/state/audit/*.jsonl`). Raw
 * counts only — NO auto-promotion, NO mutation. Correlation, not causation:
 * every candidate carries the confounding caveat. A candidate is a *question*
 * for a human, never an answer.
 *
 * Signal (per phase P, rule R):
 *   - `success_with_rule`     = success lines in P where R ∈ rules_applied
 *   - `failure_without_rule`  = blocked/error lines in P where R ∉ rules_applied
 *   R is a candidate when its absence co-occurs with failure often enough
 *   (`failure_without_rule` ≥ --min-count, over ≥2 distinct failing work_ids)
 *   AND R is otherwise a success-associated rule in P (`success_with_rule` ≥ 1).
 *
 * Exit 0 always (an empty audit log is a valid state, not an error).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
export const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const DEFAULT_AUDIT_DIR = path.join(ROOT, 'agents', 'runtime', 'state', 'audit');
export const SCHEMA_VERSION = 1;
const FAILURE_OUTCOMES = new Set(['blocked', 'error']);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = Record<string, any>;

/** Read audit-log-v1 phase records from `*.jsonl` (or one `<month>.jsonl`). */
export function loadRecords(auditDir: string, month: string | null = null): Rec[] {
    const out: Rec[] = [];
    let files: string[];
    if (month) {
        files = [path.join(auditDir, `${month}.jsonl`)];
    } else {
        let names: string[] = [];
        try {
            names = fs.readdirSync(auditDir);
        } catch {
            return out;
        }
        files = names.filter((n) => n.endsWith('.jsonl')).sort().map((n) => path.join(auditDir, n));
    }
    for (const p of files) {
        let text: string;
        try {
            text = fs.readFileSync(p, 'utf-8');
        } catch {
            continue;
        }
        for (const raw of text.split('\n')) {
            const line = raw.trim();
            if (!line) continue;
            let rec: Rec;
            try {
                rec = JSON.parse(line) as Rec;
            } catch {
                continue;
            }
            if (rec.schema_version !== SCHEMA_VERSION) continue;
            if (rec.type === 'supersede' || rec.type === 'note') continue;
            if (typeof rec.phase !== 'string' || typeof rec.outcome !== 'string') continue;
            if (!Array.isArray(rec.rules_applied)) continue;
            out.push(rec);
        }
    }
    return out;
}

export interface Candidate {
    phase: string;
    rule: string;
    success_with_rule: number;
    failure_without_rule: number;
    failure_work_ids: string[];
    success_without_rule: number;
    failure_with_rule: number;
}

export function mineCandidates(records: Rec[], minCount: number): Candidate[] {
    const phases = new Set<string>();
    const rules = new Set<string>();
    for (const r of records) {
        phases.add(r.phase as string);
        for (const rule of r.rules_applied as string[]) rules.add(rule);
    }
    const out: Candidate[] = [];
    for (const phase of [...phases].sort()) {
        const inPhase = records.filter((r) => r.phase === phase);
        for (const rule of [...rules].sort()) {
            let succWith = 0;
            let succWithout = 0;
            let failWith = 0;
            const failWithoutIds = new Set<string>();
            for (const r of inPhase) {
                const has = (r.rules_applied as string[]).includes(rule);
                const isSuccess = r.outcome === 'success';
                const isFailure = FAILURE_OUTCOMES.has(r.outcome as string);
                if (isSuccess && has) succWith += 1;
                else if (isSuccess && !has) succWithout += 1;
                else if (isFailure && has) failWith += 1;
                else if (isFailure && !has) {
                    failWithoutIds.add(typeof r.work_id === 'string' ? r.work_id : (r.id as string));
                }
            }
            const failWithout = failWithoutIds.size;
            // Candidate: absence co-occurs with failure across ≥2 distinct runs,
            // and the rule is otherwise success-associated in this phase.
            if (failWithout >= minCount && failWithout >= 2 && succWith >= 1) {
                out.push({
                    phase,
                    rule,
                    success_with_rule: succWith,
                    failure_without_rule: failWithout,
                    failure_work_ids: [...failWithoutIds].sort(),
                    success_without_rule: succWithout,
                    failure_with_rule: failWith,
                });
            }
        }
    }
    // Strongest signal first: most distinct failing runs, then most successes-with.
    out.sort(
        (a, b) =>
            b.failure_without_rule - a.failure_without_rule ||
            b.success_with_rule - a.success_with_rule ||
            (a.phase < b.phase ? -1 : a.phase > b.phase ? 1 : a.rule < b.rule ? -1 : 1),
    );
    return out;
}

const CONFOUND_NOTE =
    'Correlation, NOT causation. A rule absent from failing runs may reflect the ' +
    'task type or phase shape, not a missing guardrail. Low N inflates noise. ' +
    'Each candidate is a question for a human — promote (or reject) only via ' +
    'learning-to-rule-or-skill. Never auto-add a rule from this output.';

export function main(argv: string[] = process.argv.slice(2)): number {
    let auditDir = DEFAULT_AUDIT_DIR;
    let month: string | null = null;
    let minCount = 2;
    let asJson = false;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--audit-dir') auditDir = argv[++i] ?? auditDir;
        else if (a === '--month') month = argv[++i] ?? null;
        else if (a === '--min-count') minCount = parseInt(argv[++i] ?? '2', 10) || 2;
        else if (a === '--json') asJson = true;
    }
    const records = loadRecords(auditDir, month);
    const candidates = mineCandidates(records, minCount);
    if (asJson) {
        process.stdout.write(
            JSON.stringify(
                { schema_version: SCHEMA_VERSION, records: records.length, min_count: minCount, confounding: CONFOUND_NOTE, candidates },
                null,
                2,
            ) + '\n',
        );
        return 0;
    }
    if (records.length === 0) {
        process.stdout.write('missing-guardrails: no audit-log-v1 records found (nothing to mine).\n');
        return 0;
    }
    if (candidates.length === 0) {
        process.stdout.write(`missing-guardrails: ${records.length} record(s), 0 candidates (min-count ${minCount}).\n`);
        return 0;
    }
    process.stdout.write(`missing-guardrails: ${candidates.length} candidate(s) from ${records.length} record(s):\n\n`);
    for (const c of candidates) {
        process.stdout.write(
            `  [${c.phase}] rule '${c.rule}' — absent in ${c.failure_without_rule} failing run(s), ` +
                `present in ${c.success_with_rule} success(es). ` +
                `(fail-with-rule ${c.failure_with_rule}, success-without ${c.success_without_rule})\n`,
        );
    }
    process.stdout.write(`\n⚠️  ${CONFOUND_NOTE}\n`);
    return 0;
}

const _isCli =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCli) process.exit(main());
