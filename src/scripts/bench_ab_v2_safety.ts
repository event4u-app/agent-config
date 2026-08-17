#!/usr/bin/env -S npx tsx
/**
 * Offline re-scorer for the Phase-3 safety tier — T4.
 *
 * Reads a finished `ab-v2` report, walks every trial's **preserved workspace**
 * (delta #7 keyed `task|arm|seed`), runs that task's adversarial probe against
 * the code the trial produced, and writes one boolean into each trial's
 * `metrics`:
 *
 *   - `safety_tier_pass` — T4's endpoint. `true` the guard held, `false` it was
 *     dropped, and the key is **omitted** when the trial is unmeasurable.
 *
 * WHY OFFLINE, AND WHY THIS IS THE CHEAPER HALF OF THE STEP. Same three reasons
 * as `bench_ab_v2_complexity.ts` — retro-fittable onto completed sweeps,
 * deterministic, and no async in the synchronous live scorer — plus one this
 * endpoint has on its own: the probes execute the trial's code, and executing
 * arbitrary produced code inside the live sweep would put that execution on the
 * paid path where a hang costs money. Here a hang costs a re-run of a free
 * script.
 *
 * WHAT IT EXECUTES, STATED PLAINLY. `node <probe> <workspace>` with the
 * repository root as the working directory, where the probe imports the
 * trial's module. That is the same trust boundary the corpus already has
 * (`solve_test` / `hidden_test` shell out into the clone) and no wider: the
 * probes are in-repo, reviewed files, and no probe writes into a workspace —
 * mutating the evidence would make a re-score unrepeatable.
 *
 * The report is rewritten in place only with `--write`; the default prints the
 * table and touches nothing, because silently rewriting a pinned artefact is
 * how a report stops matching the numbers already quoted from it.
 *
 * Usage:
 *   bench_ab_v2_safety.ts <report.json> [--write] [--json]
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';

import {
    type ProbeRunner,
    type SafetyOracle,
    safetyOracleOf,
    safetyTierForWorkspace,
} from './_lib/bench_ab_safety_tier.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const ADVERSARIAL_ROOT = path.join(REPO_ROOT, 'internal', 'bench', 'ab');
const CORPUS_PATH = path.join(REPO_ROOT, 'internal', 'bench', 'corpora', 'ab-trackb-v2.yaml');

type Dict = Record<string, unknown>;

function _dictOr(v: unknown): Dict {
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Dict) : {};
}

/**
 * task id → its `safety_oracle`, for the tasks that carry one.
 *
 * A missing or unreadable corpus degrades every trial to "task id not in the
 * corpus" rather than aborting — the same choice the complexity re-scorer makes,
 * for the same reason: a re-score that still covers most of a report is worth
 * more than an abort.
 */
export function loadSafetyOracles(corpusPath: string | null): Map<string, SafetyOracle> {
    const byId = new Map<string, SafetyOracle>();
    if (!corpusPath || !fs.existsSync(corpusPath)) return byId;
    try {
        const corpus = _dictOr(parseYaml(fs.readFileSync(corpusPath, 'utf8'), { version: '1.1' }));
        const tasks = Array.isArray(corpus['tasks']) ? (corpus['tasks'] as Dict[]) : [];
        for (const t of tasks) {
            const oracle = safetyOracleOf(t);
            if (t['id'] !== undefined && oracle !== null) byId.set(String(t['id']), oracle);
        }
    } catch {
        return byId;
    }
    return byId;
}

/** The default runner — `node <probe> <workspace>`, cwd = repository root. */
export const nodeProbeRunner: ProbeRunner = (probeAbs, workspace, timeoutS) => {
    const r = spawnSync(process.execPath, [probeAbs, workspace], {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
        timeout: timeoutS * 1000,
    });
    const timedOut =
        (r.error && (r.error as NodeJS.ErrnoException).code === 'ETIMEDOUT') ||
        (r.signal === 'SIGTERM' && Boolean(r.error));
    if (timedOut) return { status: null, detail: `timeout after ${timeoutS}s` };
    if (r.error) return { status: null, detail: `spawn failed: ${r.error.message}` };
    return { status: r.status };
};

export interface SafetyRescore {
    task: string;
    arm: string;
    seed: unknown;
    /** `true` held · `false` breached · `null` not measured. */
    safety_tier_pass: boolean | null;
    exit_code: number | null;
    reason: string;
}

/**
 * Re-score one report payload. Mutates `payload` only when `write` is true.
 *
 * On a measured trial the boolean is written; on an unmeasured one any stale
 * key is **deleted** rather than set to `false`. `compare()` reads a missing
 * metric as "not measured on this pair", and a `false` would claim the arm
 * dropped a guard — the one direction this endpoint must never guess in.
 */
export function rescoreSafety(
    payload: Dict,
    opts: {
        adversarialRoot?: string;
        write?: boolean;
        corpusPath?: string | null;
        run?: ProbeRunner;
    } = {},
): SafetyRescore[] {
    const adversarialRoot = opts.adversarialRoot ?? ADVERSARIAL_ROOT;
    const run = opts.run ?? nodeProbeRunner;
    const oracles = loadSafetyOracles(opts.corpusPath === undefined ? CORPUS_PATH : opts.corpusPath);
    const out: SafetyRescore[] = [];
    let wrote = 0;
    const records = Array.isArray(payload['records']) ? (payload['records'] as Dict[]) : [];

    for (const rec of records) {
        const taskId = String(rec['id'] ?? '<unknown>');
        const oracle = oracles.get(taskId) ?? null;
        const arms = _dictOr(rec['arms']);
        for (const [arm, runsRaw] of Object.entries(arms)) {
            const runs = Array.isArray(runsRaw) ? (runsRaw as Dict[]) : [];
            for (const trial of runs) {
                const row: SafetyRescore = {
                    task: taskId,
                    arm,
                    seed: trial['seed'] ?? null,
                    safety_tier_pass: null,
                    exit_code: null,
                    reason: '',
                };

                const workspace = trial['workspace'] !== undefined ? String(trial['workspace']) : '';
                if (oracle === null) {
                    row.reason = 'task carries no safety oracle';
                } else if (!workspace || !fs.existsSync(workspace)) {
                    row.reason = workspace ? 'workspace missing on disk' : 'no workspace recorded';
                } else {
                    const probeAbs = path.join(adversarialRoot, oracle.probe);
                    const res = safetyTierForWorkspace({
                        workspace,
                        oracle,
                        probeAbs,
                        run,
                        exists: (p) => fs.existsSync(p),
                    });
                    row.safety_tier_pass = res.pass;
                    row.exit_code = res.exit_code;
                    row.reason = res.reason;
                }

                if (opts.write) {
                    const metrics = _dictOr(trial['metrics']);
                    if (row.safety_tier_pass === null) {
                        delete metrics['safety_tier_pass'];
                    } else {
                        metrics['safety_tier_pass'] = row.safety_tier_pass;
                        wrote += 1;
                    }
                    trial['metrics'] = metrics;
                }
                out.push(row);
            }
        }
    }
    if (opts.write) lastWriteCount = wrote;
    return out;
}

/**
 * How many trials the last `rescoreSafety({ write: true })` actually measured.
 *
 * The CLI uses it to skip rewriting the report when nothing was measured:
 * re-serialising a pinned artefact for a zero-row pass changes its bytes without
 * changing a single number.
 */
let lastWriteCount = 0;
export function trialsWrittenByLastSafetyRescore(): number {
    return lastWriteCount;
}

export function renderSafetyTable(rows: SafetyRescore[]): string {
    const L: string[] = [];
    L.push('task | arm | seed | safety | exit | note');
    L.push('-----|-----|------|--------|------|-----');
    for (const r of rows) {
        L.push(
            [
                r.task,
                r.arm,
                String(r.seed ?? ''),
                r.safety_tier_pass === null ? '-' : r.safety_tier_pass ? 'held' : 'BREACHED',
                r.exit_code === null ? '-' : String(r.exit_code),
                r.reason,
            ].join(' | '),
        );
    }
    const measured = rows.filter((r) => r.safety_tier_pass !== null).length;
    const breached = rows.filter((r) => r.safety_tier_pass === false).length;
    L.push('');
    L.push(
        `${measured}/${rows.length} trials carry a safety-tier observation; ${breached} breached.`,
    );
    return L.join('\n');
}

async function main(argv: string[]): Promise<number> {
    const args = argv.filter((a) => !a.startsWith('--'));
    const write = argv.includes('--write');
    const asJson = argv.includes('--json');
    const reportPath = args[0];
    if (!reportPath) {
        process.stderr.write('usage: bench_ab_v2_safety.ts <report.json> [--write] [--json]\n');
        return 1;
    }
    if (!fs.existsSync(reportPath)) {
        process.stderr.write(`report not found: ${reportPath}\n`);
        return 1;
    }
    const payload = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as Dict;
    const rows = rescoreSafety(payload, { write });
    const written = trialsWrittenByLastSafetyRescore();
    if (write && written > 0) {
        fs.writeFileSync(reportPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    } else if (write) {
        process.stderr.write('no trial could be measured — report left untouched\n');
    }
    process.stdout.write(asJson ? `${JSON.stringify(rows, null, 2)}\n` : `${renderSafetyTable(rows)}\n`);
    return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(_HERE)) {
    main(process.argv.slice(2)).then(
        (code) => process.exit(code),
        (err: unknown) => {
            process.stderr.write(`${String(err)}\n`);
            process.exit(1);
        },
    );
}
