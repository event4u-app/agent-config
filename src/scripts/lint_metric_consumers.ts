/**
 * lint_metric_consumers — a metric with no consumer does not land.
 *
 * `road-to-experience-loop-broadening` step 0.3, whose rule is quoted from the
 * roadmap verbatim: *"A metric with no consumer is telemetry decoration and
 * should not land."* Every entry in `src/config/metric-registry.yml` declares
 * three things, and this gate refuses one that does not:
 *
 * - `consumer` — who reads it;
 * - `decision` — what it changes;
 * - `absent` — what fails without it.
 *
 * ## Why the third field, when the first two look sufficient
 *
 * Because the first two are answerable for a metric nobody needs. "The report
 * reads it" and "it informs the roadmap" are both true of a number whose
 * deletion would change nothing, and that is the number this gate exists to
 * catch. `absent` is the falsifiable one: if the honest answer is *nothing
 * fails*, the entry cannot be written and the metric should not land.
 *
 * The tree's own worked example is the 0.27 % dispatch capture rate — a figure
 * that existed for months before anyone could say what decision it fed.
 *
 * ## What this gate does NOT claim
 *
 * It checks SHAPE, not truth. It refuses a missing, empty, or boilerplate
 * field; it cannot tell a real consumer from a plausible sentence, because that
 * is a review judgement and no parser has it. The honest statement is that this
 * makes the OMISSION impossible, not the answer true — and it is written here
 * rather than left for someone to discover by trusting the gate further than it
 * goes.
 *
 * Exit codes: 0 clean · 1 finding · 2 usage error.
 *
 * A CONFIG error — a missing, unparseable or `metrics:`-less registry — exits
 * **1**, not 2, and the docstring said 2 (R2 finding 6). 1 is right: a registry
 * the gate cannot read is a finding about the tree, which is what this gate
 * reports; 2 is reserved for being invoked wrongly. The prose is corrected
 * rather than the code, because changing the exit code would change what a
 * caller distinguishes.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { reportScanned } from './_lib/scan_scope.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const REGISTRY_REL = path.join('src', 'config', 'metric-registry.yml');
const SELF_REL = path.join('src', 'scripts', 'lint_metric_consumers.ts');

/** The three fields that make a metric landable, and the reason each exists. */
export const REQUIRED_FIELDS = ['consumer', 'decision', 'absent'] as const;
export type RequiredField = (typeof REQUIRED_FIELDS)[number];

/** Below this a field is a placeholder rather than an answer. */
export const MIN_FIELD_CHARS = 20;

/**
 * Phrases that pass a length check and answer nothing.
 *
 * Deliberately short and deliberately literal. A long list would turn this into
 * a vocabulary filter, which is not what the gate is for — these are the four
 * shapes that showed up when the registry was seeded, each of which is a way of
 * writing "I do not know" at sufficient length.
 */
export const BOILERPLATE = [
    'tbd',
    'todo',
    'n/a',
    'not applicable',
    'to be determined',
    'unknown',
    'nothing',
    'see above',
] as const;

export interface MetricEntry {
    readonly id?: unknown;
    readonly producer?: unknown;
    readonly consumer?: unknown;
    readonly decision?: unknown;
    readonly absent?: unknown;
}

export interface Finding {
    readonly id: string;
    readonly field: string;
    readonly reason: string;
}

function normalise(value: unknown): string {
    return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

/** Judge one entry. Pure, so the self-test can drive it with literals. */
export function findingsFor(entry: MetricEntry, index: number): Finding[] {
    const out: Finding[] = [];
    const id = normalise(entry.id) === '' ? `#${String(index + 1)} (no id)` : normalise(entry.id);

    if (normalise(entry.id) === '') {
        out.push({ id, field: 'id', reason: 'missing — an unnamed metric cannot be cited' });
    }
    if (normalise(entry.producer) === '') {
        out.push({
            id,
            field: 'producer',
            reason: 'missing — without it a reader cannot check the other three against anything',
        });
    }
    for (const field of REQUIRED_FIELDS) {
        const value = normalise(entry[field]);
        if (value === '') {
            out.push({ id, field, reason: 'missing or empty' });
            continue;
        }
        // Matched at a WORD BOUNDARY, not on an exact token or a token plus a
        // space (R2 finding 1). `TBD:` and `TODO:` are the natural writing
        // forms of exactly the placeholder class this refuses, and both were
        // accepted — the filter caught only the one spelling nobody uses.
        const lower = value.toLowerCase();
        if (BOILERPLATE.some((b) => lower === b || new RegExp(`^${b}\\b`).test(lower))) {
            out.push({ id, field, reason: `boilerplate ("${value.slice(0, 40)}") — a placeholder, not an answer` });
            continue;
        }
        if (value.length < MIN_FIELD_CHARS) {
            out.push({
                id,
                field,
                reason:
                    `${String(value.length)} chars, below the ${String(MIN_FIELD_CHARS)}-char floor — `
                    + 'too short to name a consumer, a decision or a consequence',
            });
        }
    }
    return out;
}

export interface RegistryRead {
    readonly entries: readonly MetricEntry[];
    readonly error: string | null;
}

export function readRegistry(root: string): RegistryRead {
    const target = path.join(root, REGISTRY_REL);
    let raw: string;
    try {
        raw = fs.readFileSync(target, 'utf8');
    } catch {
        return { entries: [], error: `${REGISTRY_REL} is missing` };
    }
    let parsed: unknown;
    try {
        parsed = parseYaml(raw);
    } catch (err) {
        return { entries: [], error: `${REGISTRY_REL} does not parse: ${(err as Error).message}` };
    }
    if (parsed === null || typeof parsed !== 'object') {
        return { entries: [], error: `${REGISTRY_REL} is not a mapping` };
    }
    const metrics = (parsed as { metrics?: unknown }).metrics;
    if (!Array.isArray(metrics)) {
        return { entries: [], error: `${REGISTRY_REL} has no \`metrics:\` list` };
    }
    return { entries: metrics as MetricEntry[], error: null };
}

/* -------------------------------------------------------------------------- */
/* Self-test                                                                   */
/* -------------------------------------------------------------------------- */

function selfTest(): number {
    const fixture = (yaml: string): number => {
        const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'metric-reg-'));
        try {
            const abs = path.join(dir, REGISTRY_REL);
            fs.mkdirSync(path.dirname(abs), { recursive: true });
            fs.writeFileSync(abs, yaml);
            // No `git init` here (R2 finding 7): this gate reads one YAML file
            // and asks git nothing, so seeding a repo was seven subprocess
            // spawns buying nothing.
            return runGateCli(REPO_ROOT, SELF_REL, ['--root', dir], dir);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    };

    const complete = `
metrics:
  - id: a-real-metric
    producer: src/scripts/some_gate.ts
    consumer: the ratchet in check_some_gate, and the maintainer reading its expiry
    decision: whether a change that raises the count may merge at all
    absent: the count rises unnoticed and the debt grows with nothing reporting it
`;

    const cases: SelfTestCase[] = [
        {
            name: 'a complete entry is accepted',
            expect: 'accept',
            run: () => fixture(complete),
        },
        {
            name: 'a metric with NO consumer is refused — the rule the gate exists for',
            expect: 'reject',
            run: () =>
                fixture(complete.replace(/    consumer: .*\n/, '')),
        },
        {
            name: 'a metric with no `decision` is refused',
            expect: 'reject',
            run: () => fixture(complete.replace(/    decision: .*\n/, '')),
        },
        {
            name: 'a metric with no `absent` is refused — the falsifiable field',
            expect: 'reject',
            run: () => fixture(complete.replace(/    absent: .*\n/, '')),
        },
        {
            name: 'a BOILERPLATE consumer is refused, not merely a missing one',
            expect: 'reject',
            run: () => fixture(complete.replace(/    consumer: .*\n/, '    consumer: TBD\n')),
        },
        {
            // The value must be short AND not boilerplate, or the boilerplate
            // branch `continue`s past it and MIN_FIELD_CHARS gets no coverage
            // at all — which is what happened with `nothing much` (R2 finding
            // 2), while the gate-coverage row and the roadmap's verify clause
            // both lean on this self-test as the discrimination proof.
            name: 'a too-short field is refused, on the LENGTH floor rather than the boilerplate list',
            expect: 'reject',
            run: () => fixture(complete.replace(/    absent: .*\n/, '    absent: it breaks\n')),
        },
        {
            name: 'an EMPTY registry is refused — a gate that scans nothing exits green',
            expect: 'reject',
            run: () => fixture('metrics: []\n'),
        },
    ];

    return runSelfTest({
        gate: 'lint_metric_consumers',
        cases,
        minCases: 7,
        minRejectCases: 5,
    });
}

/* -------------------------------------------------------------------------- */

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    if (argv.includes('--self-test')) return selfTest();

    const rootFlag = argv.indexOf('--root');
    if (rootFlag >= 0 && (argv[rootFlag + 1] === undefined || argv[rootFlag + 1]?.startsWith('--'))) {
        process.stderr.write('lint_metric_consumers: --root needs a directory\n');
        return 2;
    }
    const root = rootFlag >= 0 ? (argv[rootFlag + 1] as string) : REPO_ROOT;
    const quiet = argv.includes('--quiet');

    const read = readRegistry(root);
    if (read.error !== null) {
        process.stderr.write(`❌  lint_metric_consumers: ${read.error}\n`);
        return 1;
    }

    // Publishes AND asserts in one call. No `allowEmpty` reason: an empty
    // registry is not a clean bill of health here, it is a gate reading nothing
    // — and this gate's whole subject is numbers that exist without a purpose.
    try {
        reportScanned({
            gate: 'lint_metric_consumers',
            scanned: read.entries.length,
            units: 'metric(s)',
            roots: [REGISTRY_REL],
        });
    } catch (err) {
        process.stderr.write(`❌  ${(err as Error).message}\n`);
        return 1;
    }

    // Per-target accounting (R2 finding 4). A NEW gate adopts a ledger or takes
    // an exemption; this one has a real target population — the registry's
    // entries — so there is nothing to exempt. The plan is built from the index
    // rather than from the id, because an entry MISSING its id is one of the
    // findings, and a ledger keyed on a value that may be absent could not
    // account for exactly the target that failed.
    const ledger = new GateLedger('lint_metric_consumers');
    const targetOf = (i: number): string => `${REGISTRY_REL}#${String(i + 1)}`;
    ledger.plan(read.entries.map((_e, i) => targetOf(i)));

    const findings: Finding[] = [];
    const seen = new Set<string>();
    read.entries.forEach((entry, i) => {
        // A null or non-object element is a FINDING, not a crash (R2 finding
        // 5). `metrics: [null]` reached `normalise(entry.id)` and threw an
        // unhandled TypeError out of a gate whose job is to report.
        if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
            findings.push({
                id: `#${String(i + 1)}`,
                field: '(entry)',
                reason: 'not a mapping — a metric entry must be a key/value block',
            });
            ledger.fail(targetOf(i), 'not a mapping');
            return;
        }
        const before = findings.length;
        findings.push(...findingsFor(entry, i));
        const id = normalise(entry.id);
        if (id !== '' && seen.has(id)) {
            findings.push({ id, field: 'id', reason: 'duplicate — two entries claim the same metric' });
        }
        if (id !== '') seen.add(id);
        if (findings.length > before) ledger.fail(targetOf(i), findings[before]?.reason ?? 'finding');
        else ledger.complete(targetOf(i));
    });
    ledger.report();

    if (findings.length > 0) {
        process.stderr.write(
            `❌  lint_metric_consumers: ${String(findings.length)} finding(s) in ${REGISTRY_REL}\n`,
        );
        for (const f of findings) {
            process.stderr.write(`  · ${f.id} → ${f.field}: ${f.reason}\n`);
        }
        process.stderr.write(
            '\n  A metric with no consumer is telemetry decoration and should not land.\n'
                + '  `absent` is the falsifiable field: if nothing fails without the metric,\n'
                + '  the entry cannot honestly be written and the metric should not exist.\n',
        );
        return 1;
    }

    if (!quiet) {
        process.stdout.write(
            `✅  lint_metric_consumers: ${String(read.entries.length)} metric(s), each naming a `
                + 'consumer, a decision and what fails without it.\n',
        );
    }
    return 0;
}

if (process.argv[1] !== undefined) {
    const invoked = pathToFileURL(path.resolve(process.argv[1])).href;
    if (invoked === import.meta.url) {
        process.exitCode = main();
    }
}
