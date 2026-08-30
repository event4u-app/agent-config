/**
 * Orchestration telemetry recorder — CLI.
 *
 * Appends ONE validated audit-log-v1 line (with an `orchestration` object) to
 * the monthly audit log, from the counts the orchestrating agent has after an
 * auto-dispatch. One command instead of hand-authored JSON — the reliable,
 * lock-respecting (2026-06-30 no-hook decision) capture path.
 *
 * Usage:
 *   ./scripts-run src/scripts/orchestration_record \
 *     --spawn-count 1 --token-delta -72000 --provenance measured \
 *     --tier-chosen lite --tier-source inferred --task-class read-only-fanout \
 *     [--tiers sonnet,opus] [--agent-combo implementer,judge] [--wall-clock-ms 18500] [--dispatch-outcome DONE] \
 *     [--first-pass-success true|false] [--escalated true|false] \
 *     [--init-tokens 1200] [--payload-hash <hex8-64>] [--lookup-class definition|references|string-existence|report-run] \
 *     [--route-taken primitive|subagent|ask] [--budget-hit true|false] [--correctness-match true|false] \
 *     [--cache-hit true|false] [--origin lean-init-2026] \
 *     [--rules-carried 32] [--rules-used 5] \
 *     [--work-tokens 41000] [--floor-provenance measured|estimated] \
 *     [--capsule-emitted true|false] [--capsule-entries 9] \
 *     [--watermark-step 8] [--saturation-step 4] [--trigger-arm-earlier watermark|saturation|tie] \
 *     [--dir <audit-dir>] [--dry-run]
 *
 * Read by `src/scripts/orchestration_savings_report.ts`.
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { LookupClass } from './_lib/auto_dispatch.js';
import {
    buildOrchestrationLine,
    type Provenance,
    type TierChosen,
    type TierSource,
    type DispatchOutcome,
    type VerifyMode,
    type Band,
    type LinePhase,
    type LineOutcome,
    type RecordInput,
    type RouteTaken,
    type TriggerArm,
} from './_lib/orchestration_record.js';

// Exported so other writers of the same audit-log-v1 orchestration line
// (e.g. orchestration_record_hook.ts, the deterministic PostToolUse capture)
// target the exact same directory instead of duplicating the literal.
export const DEFAULT_DIR = 'agents/runtime/state/audit';

type Flags = Record<string, string | boolean>;

function parseFlags(argv: string[]): Flags {
    const flags: Flags = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === undefined || !a.startsWith('--')) continue;
        const eq = a.indexOf('=');
        if (eq !== -1) {
            flags[a.slice(2, eq)] = a.slice(eq + 1);
            continue;
        }
        const key = a.slice(2);
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith('--')) {
            flags[key] = next;
            i++;
        } else {
            flags[key] = true; // boolean flag (e.g. --dry-run)
        }
    }
    return flags;
}

function str(flags: Flags, key: string): string | undefined {
    const v = flags[key];
    return typeof v === 'string' ? v : undefined;
}

/**
 * Parse an explicit boolean flag value. `--key true|false` → boolean; a bare
 * `--key` counts as `true`; any other value is passed through so the lib's
 * non-boolean validation rejects it with a clear error.
 */
function bool(flags: Flags, key: string): boolean | undefined {
    const v = flags[key];
    if (v === undefined) return undefined;
    if (v === true || v === 'true') return true;
    if (v === 'false') return false;
    return v as unknown as boolean; // invalid string → caught by the lib's typeof validation
}

function int(flags: Flags, key: string): number | undefined {
    const v = str(flags, key);
    if (v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN; // NaN → caught by the lib's isInt validation
}

/** Deterministic content-hash id (contract allows "ULID or content hash"). */
function contentHashId(input: RecordInput): string {
    const canonical = JSON.stringify({
        ts: input.ts,
        spawn_count: input.spawn_count,
        token_delta: input.token_delta,
        tier_chosen: input.tier_chosen ?? null,
        task_class: input.task_class ?? null,
    });
    return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 26).toUpperCase();
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const flags = parseFlags(argv);
    const dir = str(flags, 'dir') ?? DEFAULT_DIR;
    const dryRun = flags['dry-run'] === true;
    const ts = new Date().toISOString();

    const partial: Omit<RecordInput, 'id'> = {
        spawn_count: int(flags, 'spawn-count') ?? NaN,
        token_delta: int(flags, 'token-delta') ?? NaN,
        token_delta_provenance: str(flags, 'provenance') as Provenance | undefined,
        tiers: str(flags, 'tiers')?.split(',').map((s) => s.trim()).filter(Boolean),
        agent_combo: str(flags, 'agent-combo')?.split(',').map((s) => s.trim()).filter(Boolean),
        tier_chosen: str(flags, 'tier-chosen') as TierChosen | undefined,
        tier_source: str(flags, 'tier-source') as TierSource | undefined,
        task_class: str(flags, 'task-class'),
        dispatch_mode: str(flags, 'dispatch-mode') as never,
        // `--skills-applied=a,b` records ids; `--skills-applied=` (empty)
        // records the EMPTY array, which is a real observation ("none
        // applied") and deliberately not the same as omitting the flag
        // ("not recorded"). The empty-string check therefore cannot be folded
        // into the `?.split()` chain above, which would map both onto
        // undefined and destroy the distinction the field exists for.
        expected_output: str(flags, 'expected-output') as never,
        diff_lines: int(flags, 'diff-lines'),
        empty_cycles: int(flags, 'empty-cycles'),
        skills_applied: (() => {
            const raw = str(flags, 'skills-applied');
            if (raw === undefined) return undefined;
            return raw.split(',').map((v) => v.trim()).filter(Boolean);
        })(),
        task_size_estimate: int(flags, 'task-size-estimate'),
        wall_clock_ms: int(flags, 'wall-clock-ms'),
        dispatch_tokens: int(flags, 'dispatch-tokens'),
        session_tier: str(flags, 'session-tier'),
        dispatch_outcome: str(flags, 'dispatch-outcome') as DispatchOutcome | undefined,
        verify_mode: str(flags, 'verify-mode') as VerifyMode | undefined,
        first_pass_success: bool(flags, 'first-pass-success'),
        escalated: bool(flags, 'escalated'),
        init_tokens: int(flags, 'init-tokens'),
        payload_hash: str(flags, 'payload-hash'),
        lookup_class: str(flags, 'lookup-class') as LookupClass | undefined,
        route_taken: str(flags, 'route-taken') as RouteTaken | undefined,
        budget_hit: bool(flags, 'budget-hit'),
        correctness_match: bool(flags, 'correctness-match'),
        cache_hit: bool(flags, 'cache-hit'),
        origin: str(flags, 'origin'),
        rules_carried: int(flags, 'rules-carried'),
        rules_used: int(flags, 'rules-used'),
        work_tokens: int(flags, 'work-tokens'),
        floor_provenance: str(flags, 'floor-provenance') as Provenance | undefined,
        capsule_emitted: bool(flags, 'capsule-emitted'),
        capsule_entries: int(flags, 'capsule-entries'),
        watermark_step: int(flags, 'watermark-step'),
        saturation_step: int(flags, 'saturation-step'),
        trigger_arm_earlier: str(flags, 'trigger-arm-earlier') as TriggerArm | undefined,
        phase: str(flags, 'phase') as LinePhase | undefined,
        outcome: str(flags, 'outcome') as LineOutcome | undefined,
        confidence_band: str(flags, 'confidence-band') as Band | undefined,
        risk_class: str(flags, 'risk-class') as Band | undefined,
        persona: str(flags, 'persona'),
        work_id: str(flags, 'work-id'),
        ts,
    };
    const input: RecordInput = { ...partial, id: contentHashId({ ...partial, id: '' }) };

    const { line, errors } = buildOrchestrationLine(input);
    if (errors.length || line === null) {
        process.stderr.write('orchestration_record: refused — invalid input:\n');
        for (const e of errors) process.stderr.write(`  - ${e}\n`);
        return 1;
    }

    const serialized = JSON.stringify(line);
    if (dryRun) {
        process.stdout.write(serialized + '\n');
        return 0;
    }

    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${ts.slice(0, 7)}.jsonl`);
    fs.appendFileSync(file, serialized + '\n', 'utf8');
    process.stdout.write(`orchestration telemetry recorded → ${file} (id ${line.id})\n`);
    return 0;
}

if (process.argv[1] !== undefined) {
    const invokedUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === invokedUrl) process.exit(main());
}
