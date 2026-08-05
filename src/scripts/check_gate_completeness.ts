#!/usr/bin/env tsx
/**
 * Ledger adoption across the CI-registered gate estate.
 *
 * `_lib/gate_ledger.ts` makes a gate's per-target accounting explicit, so that
 * "found nothing" and "looked at almost nothing" stop being the same green
 * line. A library nobody adopts changes nothing, and a 220-gate sweep in one
 * change is exactly the unreviewable diff that gets rubber-stamped — so
 * adoption is a **ratchet**, not a deadline: today's un-adopted count is
 * recorded, and it may only go down.
 *
 * A gate satisfies this check by either
 *
 *   1. importing `./_lib/gate_ledger.js`, or
 *   2. carrying a `// ledger-exempt: <reason>` marker naming why per-target
 *      accounting does not apply to it.
 *
 * The marker is deliberately cheap to write and expensive to write *badly*: an
 * empty or near-empty reason is a hard failure rather than an exemption,
 * because a marker that explains nothing is a suppression wearing a
 * justification's clothes — the gate-fatigue failure this repository has
 * already recorded.
 *
 * **Gaming risk** (per the authoring discipline this roadmap introduces): the
 * cheapest degenerate pass is to sprinkle `// ledger-exempt:` markers with
 * plausible-sounding boilerplate, which drops the count without improving a
 * single gate. Mitigations, both partial and stated as such: the minimum
 * reason length below rejects the laziest form, and the marker text lands in
 * the diff where a reviewer sees it. What this gate CANNOT do is judge whether
 * a reason is true; that stays a human read.
 *
 * **Lifecycle.** This gate lands ADVISORY over its existing population: the 217
 * un-adopted gates are recorded as a baseline, not as 217 reds. It is already
 * ENFORCED against growth from day one — a new gate must adopt or exempt.
 * Promote to error over the whole population when the
 * `check_gate_completeness` entry in `src/config/gate-violation-baselines.json`
 * reaches 0.
 *
 * CLI contract: exit 0 = at or under the ratchet, 1 = regressed, marker
 * malformed, or scope dead. `--quiet` suppresses the per-gate listing.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { checkRatchet } from './_lib/gate_baseline.js';
import { GateLedger } from './_lib/gate_ledger.js';
import { renderCoverage } from './_lib/measured_render.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';
import { load_tasks, local_closure } from './check_ci_local_parity.js';

const _HERE = path.resolve(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const QUIET = process.argv.slice(2).includes('--quiet');

/** Task roots whose transitive closure defines "registered in the CI task list". */
const TASK_ROOTS = ['ci', 'consistency'] as const;

/** The marker that opts a gate out of per-target accounting. */
export const EXEMPT_MARKER = '// ledger-exempt:';

/**
 * Shortest reason accepted after the marker.
 *
 * Not a quality bar — no length can be one. It rejects the specific degenerate
 * form this check invites: `// ledger-exempt: n/a`.
 */
export const MIN_REASON_CHARS = 20;

export interface GateCompletenessRow {
    id: string;
    status: 'ledgered' | 'exempt' | 'unledgered' | 'malformed_exemption';
    reason?: string;
}

const LEDGER_IMPORT_RE = /^import\s.*from\s+'\.\/_lib\/gate_ledger\.js';/m;
/**
 * The marker must OPEN its own line.
 *
 * An unanchored match reads the marker out of prose — this gate's own
 * docblock, which names the marker to explain it, exempted this gate from
 * itself on the first run. A checker that its own documentation can silence is
 * the false-green shape it exists to remove, so the anchor is load-bearing and
 * is pinned by a fixture.
 */
const EXEMPT_RE = /^[ \t]*\/\/[ \t]*ledger-exempt:(.*)$/m;

/** Classify one gate source. */
export function classifyGateSource(id: string, source: string): GateCompletenessRow {
    if (LEDGER_IMPORT_RE.test(source)) {
        return { id, status: 'ledgered' };
    }
    const m = EXEMPT_RE.exec(source);
    if (m === null) {
        return { id, status: 'unledgered' };
    }
    const reason = (m[1] ?? '').trim();
    if (reason.length < MIN_REASON_CHARS) {
        return { id, status: 'malformed_exemption', reason };
    }
    return { id, status: 'exempt', reason };
}

/** Every gate id reachable from the CI task roots, script present or not. */
export function registeredGateIds(repoRoot = REPO_ROOT): string[] {
    return [...local_closure(TASK_ROOTS, load_tasks(repoRoot))].sort();
}

/**
 * Classify every registered gate, accounting for the ones with no script.
 *
 * This gate dogfoods the ledger it enforces. The `.ts`-exists filter used to
 * live in {@link registeredGateIds} as a silent `filter`, which meant a task
 * pointing at a deleted script simply vanished from the denominator — the same
 * invisible-skip shape the ledger exists to name. Now it is an out-of-scope
 * outcome with a reason, and it prints.
 */
export function auditGateCompleteness(repoRoot = REPO_ROOT): {
    rows: GateCompletenessRow[];
    ledger: GateLedger;
} {
    const ledger = new GateLedger('check_gate_completeness');
    const ids = registeredGateIds(repoRoot);
    ledger.plan(ids);
    const rows: GateCompletenessRow[] = [];
    for (const id of ids) {
        const file = path.join(repoRoot, 'src', 'scripts', `${id}.ts`);
        if (!fs.existsSync(file)) {
            ledger.outOfScope(id, 'manifest_absent');
            continue;
        }
        const row = classifyGateSource(id, fs.readFileSync(file, 'utf-8'));
        rows.push(row);
        if (row.status === 'malformed_exemption') {
            ledger.fail(id, 'exemption marker carries no usable reason');
        } else {
            ledger.complete(id);
        }
    }
    return { rows, ledger };
}

export function main(): number {
    const { rows, ledger } = auditGateCompleteness();

    try {
        assertScanned({
            gate: 'check_gate_completeness',
            scanned: rows.length,
            units: 'registered gate(s)',
            roots: ['Taskfile.yml → src/scripts'],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    const malformed = rows.filter((r) => r.status === 'malformed_exemption');
    const unledgered = rows.filter((r) => r.status === 'unledgered');
    const exempt = rows.filter((r) => r.status === 'exempt');
    const ledgered = rows.filter((r) => r.status === 'ledgered');

    // The denominator on the green path — auditable without waiting for a red —
    // and the GAP LIST beside it. A coverage number published alone lets the
    // reader assume the remainder is small and boring; naming it costs one line.
    process.stdout.write(
        `gate completeness: ${String(ledgered.length)} ledgered · ${String(exempt.length)} exempt · ` +
            `${String(unledgered.length)} un-adopted · ${String(rows.length)} registered\n`,
    );
    process.stdout.write(
        `${renderCoverage({
            label: '  ledger coverage',
            covered: ledgered.length + exempt.length,
            total: rows.length,
            gaps: unledgered.map((r) => r.id),
            maxGaps: 6,
        })}\n`,
    );
    ledger.report();
    process.stdout.write(`scanned: ${String(rows.length)}\n`);

    if (malformed.length > 0) {
        process.stderr.write(
            `\n❌  ${String(malformed.length)} exemption marker(s) carry no usable reason ` +
                `(minimum ${String(MIN_REASON_CHARS)} characters). An exemption that explains ` +
                'nothing is a suppression:\n',
        );
        for (const row of malformed) {
            process.stderr.write(`    - ${row.id}: "${row.reason ?? ''}"\n`);
        }
        return 1;
    }

    const verdict = checkRatchet({
        gate: 'check_gate_completeness',
        actual: unledgered.length,
        repoRoot: REPO_ROOT,
    });

    if (!QUIET && unledgered.length > 0 && verdict.status !== 'within') {
        process.stdout.write('\nun-adopted gates:\n');
        for (const row of unledgered) {
            process.stdout.write(`    - ${row.id}\n`);
        }
    }

    if (verdict.ok) {
        if (!QUIET) {
            process.stdout.write(`\n⚠️   ${verdict.message}\n`);
        }
        return 0;
    }
    process.stderr.write(`\n❌  ${verdict.message}\n`);
    return 1;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (installed projection, or macOS /var → /private/var
    // temp dirs) makes the raw URLs differ: compare realpaths so the entry guard
    // still fires instead of silently no-opping.
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exitCode = main();
}

export { QUIET, TASK_ROOTS };
