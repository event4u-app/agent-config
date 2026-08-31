#!/usr/bin/env tsx
/**
 * `evolution_lab` — the operator's command surface over the candidate loop.
 *
 * `road-to-governed-harness-evolution` Phase 3, step 3.6.
 *
 * > *Give the operator a command surface. A verb set (`inspect`, `propose`,
 * > `run`, `compare`, `explain`, `promote`, `clean`) with no background loop.
 * > This is what makes "command-scoped, no daemon" enforced rather than
 * > asserted.*
 * > verify: **every phase's exit criterion is reachable through a named verb,
 * > and no verb starts a resident process.**
 *
 * ## No daemon — what enforces it, not what asserts it
 *
 * ADR-124 prohibits a resident service in core, and a paragraph promising not
 * to start one is the same class of guarantee the `merge-authority` council
 * refused to accept. Four properties hold instead, and each is checked:
 *
 *   1. **No timer, no watcher, no unbounded loop.** There is no `setInterval`,
 *      `setTimeout`, `fs.watch`, `while (true)` or `for (;;)` in this module.
 *      `tests/scripts/evolution_lab.test.ts` scans this file's bytes for that
 *      construct set and is exercised in both polarities against a synthetic
 *      daemon-shaped source.
 *   2. **No child process.** `node:child_process` is never imported. `run` and
 *      `compare` reach `bench_ab_clone` and `bench_ab_integrity` by direct
 *      function call, so there is nothing that could outlive this process.
 *   3. **Every verb returns an exit code.** {@link main} is a pure
 *      `argv -> number`; the only `process.exit` is the CLI entry at the foot
 *      of the file.
 *   4. **Observed, not only read.** Each verb is spawned under a hard timeout
 *      in the test. A verb that left a resident child holding stdio would keep
 *      the pipe open and time out; a timeout is therefore a positive detection,
 *      not a flake.
 *
 * ## `promote` refuses, and that is the verb working
 *
 * Phase 7 is gated on the OPEN `merge-authority` blocker (AI council
 * 2026-08-29, anthropic + openai, 2/2: Phases 1-6 are legal because they
 * promote nothing). So `promote` exists, is named, is documented — and always
 * refuses with {@link EXIT_REFUSED}, naming the blocker.
 *
 * The refusal is not the only guard, because a refusal in a `switch` arm is one
 * edit away from a promotion. The verb first routes the intended transition
 * through `assertTransition(from, 'promoted')` with **no approval argument**,
 * which is the mechanical half of the non-promotion condition: there is no
 * expression anywhere in this module that constructs a `HumanApproval`, so even
 * if the blocker were lifted and the refusal deleted, this path still could not
 * promote without someone writing an approver in by hand. The test scans for
 * that construction too.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
    CANDIDATE_PREFIX,
    CANDIDATE_RECORD_FILE,
    CLONES,
    clone_candidate,
} from './bench_ab_clone.js';
import { main as integrity_main } from './bench_ab_integrity.js';
import {
    runCascade,
    CHEAPEST_STAGE,
    type CascadeResult,
} from './_lib/evaluation_cascade.js';
import type { MetricRow } from './_lib/evaluation_vector.js';
import {
    type CandidateRecord,
    CandidateSchemaError,
    LIFECYCLE_SPINE,
    LIFECYCLE_STATES,
    type LifecycleState,
    LifecycleTransitionError,
    PathOwnershipError,
    assertTransition,
    isAccepted,
    isLifecycleState,
    parseCandidateRecord,
    readCandidateRecord,
} from './_lib/candidate_record.js';
import {
    PROMOTION_EVIDENCE_FIELDS,
    PromotionEvidenceError,
    parsePromotionEvidence,
} from './_lib/promotion_evidence.js';
import { assertNotSemanticNoOp, isSemanticNoOp, SemanticNoOpError } from './_lib/semantic_noop.js';
import {
    RECIPES,
    byteCompare,
    candidateRecordFilename,
    parseObservations,
    proposeCandidates,
    serialiseCandidateRecord,
} from './_lib/candidate_proposer.js';
import {
    type MetricVector,
    type RunReport,
    buildRunReport,
    parseMetricVectorJson,
    renderRunReport,
    roiFigure,
} from './_lib/evolution_roi.js';
import {
    BudgetExceededError,
    type DisclosureRecord,
    type FieldVisibility,
    HoldoutLeakError,
    type RunBudget,
    type RunPlan,
    type VisibilityClass,
    assertWithinBudget,
    discloseToProposer,
} from './_lib/harness_evolution_guards.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** The seven verbs, in the order step 3.6 names them. */
export const VERBS = [
    'inspect',
    'propose',
    'run',
    'compare',
    'explain',
    'promote',
    'clean',
] as const;
export type Verb = (typeof VERBS)[number];

export function isVerb(v: unknown): v is Verb {
    return typeof v === 'string' && (VERBS as readonly string[]).includes(v);
}

/** Everything worked. */
export const EXIT_OK = 0;
/** A real failure — unreadable record, rejected schema, integrity divergence. */
export const EXIT_ERROR = 1;
/** Bad invocation. Matches the sibling bench scripts' argparse exit code. */
export const EXIT_USAGE = 2;
/**
 * Refused on governance grounds, not on error grounds.
 *
 * A distinct code because an operator script that treats "the blocker is open"
 * as a transient failure would retry it, and a retried refusal looks like
 * flakiness rather than like policy.
 */
export const EXIT_REFUSED = 3;
/**
 * A pre-registered guard aborted the run.
 *
 * Distinct from {@link EXIT_ERROR} on purpose. `1` says "this invocation was
 * malformed"; `4` says "the invocation was well-formed and a pre-registered
 * invariant stopped it". Collapsing the two would make a budget abort
 * indistinguishable from a typo in a path, and the whole subject of step 0.5 is
 * that an abort must be legible as an abort rather than read as a degraded run.
 */
export const EXIT_GUARD_ABORT = 4;

// --- the pre-registered guards, at their call sites -------------------------

/**
 * The pre-registered budget, read from the committed config. Never defaulted.
 *
 * `road-to-governed-harness-evolution` step 0.5 and blocker
 * `guard-call-site-integration`. Until this change the guards in
 * `_lib/harness_evolution_guards.ts` had ZERO production call sites — measured
 * 2026-08-30, three paths in the whole tree and all three were the guard, its
 * unit test, and the config it reads. A guard nothing calls has no coverage,
 * whatever its unit tests say; these two functions are the call sites.
 */
export const BUDGET_CONFIG_PATH = path.join(REPO_ROOT, 'src', 'config', 'harness-evolution-budget.json');

export class BudgetConfigError extends Error {
    constructor(msg: string) {
        super(`budget config: ${msg}`);
        this.name = 'BudgetConfigError';
    }
}

/**
 * Load the pre-registered ceilings. FAIL-CLOSED in every direction.
 *
 * A missing file, unparseable JSON, a missing key, a non-integer or a negative
 * ceiling all THROW. There is deliberately no fallback budget: a default
 * ceiling is a ceiling nobody registered, and a run that proceeds under one has
 * exactly the property step 0.5 exists to prevent — it looks pre-registered and
 * is not. Deleting the config must stop the lab, not un-cap it.
 */
export function loadRunBudget(file: string = BUDGET_CONFIG_PATH): RunBudget {
    let raw: string;
    try {
        raw = fs.readFileSync(file, 'utf-8');
    } catch {
        throw new BudgetConfigError(
            `not readable at ${file} — the budget is PRE-REGISTERED, so an absent config aborts the ` +
                'run rather than un-capping it',
        );
    }
    let doc: unknown;
    try {
        doc = JSON.parse(raw);
    } catch (e) {
        throw new BudgetConfigError(`${file} is not valid JSON: ${(e as Error).message}`);
    }
    if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
        throw new BudgetConfigError(`${file} must be a JSON object`);
    }
    const budget = (doc as Record<string, unknown>)['budget'];
    if (typeof budget !== 'object' || budget === null || Array.isArray(budget)) {
        throw new BudgetConfigError(`${file} carries no 'budget' object`);
    }
    const b = budget as Record<string, unknown>;
    const ceiling = (key: string): number => {
        const v = b[key];
        if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
            throw new BudgetConfigError(`'budget.${key}' must be a non-negative integer`);
        }
        return v;
    };
    return {
        maxCandidates: ceiling('max_candidates'),
        maxTrialsPerCandidate: ceiling('max_trials_per_candidate'),
        maxSpendCents: ceiling('max_spend_cents'),
    };
}

/**
 * The visibility class of every field the observation schema declares.
 *
 * Step 0.4 asks for a per-field `visibility_class` on every observation. These
 * three are the fields the deterministic proposer reads, and they are the only
 * ones released by default. **Everything else fails closed to `holdout`** —
 * that is `discloseToProposer`'s own default, and it is what makes an
 * unclassified field an abort rather than a silent release.
 *
 * The gap this closes is real and was measurable before it: `parseObservations`
 * ignores unknown keys, so an observations file carrying `holdoutScore: 0.83`
 * next to a subject used to flow straight into proposer input with nothing
 * looking at it. That is a holdout value reaching proposer context, which step
 * 0.4 classes as invalidating rather than degrading.
 */
export const OBSERVATION_FIELD_VISIBILITY: readonly FieldVisibility[] = [
    { field: 'defectClass', visibility: 'proposer-visible' },
    { field: 'subject', visibility: 'proposer-visible' },
    { field: 'routeTo', visibility: 'proposer-visible' },
];

const VISIBILITY_CLASSES: readonly VisibilityClass[] = [
    'proposer-visible',
    'evaluator-private',
    'holdout',
];

/** An observations document: the bare array, or one carrying its own field classes. */
export interface ObservationDocument {
    readonly fieldVisibility: readonly FieldVisibility[];
    readonly observations: readonly Record<string, unknown>[];
}

/**
 * Accept either shape, and never widen the default set silently.
 *
 *   - a bare JSON array of observations — the declared three classes apply and
 *     every other field fails closed;
 *   - `{ "field_visibility": [{field, visibility_class}], "observations": [...] }`
 *     — the operator declares classes for their own extra fields, which is
 *     step 0.4's `visibility_class` in its literal form.
 *
 * A declaration may only ADD fields. Re-classifying one of the three declared
 * fields is refused: letting an observations file relabel `subject` as
 * `evaluator-private` would let the input decide its own trust boundary, which
 * is the boundary-holds-until-the-first-convenient-exception failure the guard
 * module names.
 */
export function parseObservationDocument(input: unknown): ObservationDocument {
    const asObservations = (v: unknown): Record<string, unknown>[] => {
        if (!Array.isArray(v)) {
            throw new CandidateSchemaError('observations must be a JSON array');
        }
        return v.map((item) => {
            if (typeof item !== 'object' || item === null || Array.isArray(item)) {
                throw new CandidateSchemaError('each observation must be a JSON object');
            }
            return item as Record<string, unknown>;
        });
    };
    if (Array.isArray(input)) {
        return { fieldVisibility: OBSERVATION_FIELD_VISIBILITY, observations: asObservations(input) };
    }
    if (typeof input !== 'object' || input === null) {
        throw new CandidateSchemaError(
            "observations must be a JSON array, or an object with 'observations' and optional 'field_visibility'",
        );
    }
    const obj = input as Record<string, unknown>;
    const extra: FieldVisibility[] = [];
    const declared = obj['field_visibility'];
    if (declared !== undefined) {
        if (!Array.isArray(declared)) {
            throw new CandidateSchemaError("'field_visibility' must be an array");
        }
        const reserved = new Set(OBSERVATION_FIELD_VISIBILITY.map((f) => f.field));
        for (const item of declared) {
            if (typeof item !== 'object' || item === null || Array.isArray(item)) {
                throw new CandidateSchemaError("'field_visibility' members must be objects");
            }
            const rec = item as Record<string, unknown>;
            const field = rec['field'];
            const visibility = rec['visibility_class'];
            if (typeof field !== 'string' || field.trim() === '') {
                throw new CandidateSchemaError("'field_visibility' member needs a non-empty 'field'");
            }
            if (!VISIBILITY_CLASSES.includes(visibility as VisibilityClass)) {
                throw new CandidateSchemaError(
                    `'visibility_class' for '${field}' must be one of ${VISIBILITY_CLASSES.join(', ')}`,
                );
            }
            if (reserved.has(field)) {
                throw new CandidateSchemaError(
                    `'${field}' is a declared proposer-visible field and an observations file may not ` +
                        're-classify it — an input that sets its own trust boundary is not a boundary',
                );
            }
            extra.push({ field, visibility: visibility as VisibilityClass });
        }
    }
    return {
        fieldVisibility: [...OBSERVATION_FIELD_VISIBILITY, ...extra],
        observations: asObservations(obj['observations']),
    };
}

/**
 * Release every observation to proposer context, logging every field released.
 *
 * Step 0.4's three parts, in one place: the per-field class (the schema), the
 * log of every field disclosed (written to stderr, and to the returned array),
 * and the abort when holdout truth appears. The abort is a THROW here and a
 * non-zero PROCESS exit at the verb — which is the distinction the split
 * council turned on, so it is worth naming rather than leaving to the reader.
 *
 * @throws {HoldoutLeakError} on the first holdout or unclassified field.
 */
export function discloseObservations(
    doc: ObservationDocument,
    log: DisclosureRecord[],
    emit: (line: string) => void,
): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = [];
    for (let i = 0; i < doc.observations.length; i += 1) {
        const perField: DisclosureRecord[] = [];
        try {
            out.push(discloseToProposer(doc.observations[i] as Record<string, unknown>, doc.fieldVisibility, perField));
        } catch (e) {
            if (e instanceof HoldoutLeakError) {
                // The log names the field, which is the second half of 0.4's
                // verify clause. `discloseToProposer` logs only what it
                // RELEASED, by design, so the refusal is recorded here.
                emit(`disclosure: REFUSED obs[${String(i)}] field=${e.field} class=holdout`);
            }
            throw e;
        }
        for (const rec of perField) {
            emit(`disclosure: obs[${String(i)}] field=${rec.field} class=${rec.visibility}`);
            log.push(rec);
        }
    }
    return out;
}

/**
 * Which verb reaches which Phase-3 exit criterion.
 *
 * This is the machine-checkable half of step 3.6's verify clause. It covers
 * **Phase 3 only**, deliberately and with the gap stated rather than implied:
 * Phases 4-7 do not exist in the tree yet, so no verb can reach an exit
 * criterion for them, and a map that listed a verb per unbuilt phase would be
 * an assertion dressed as coverage. `tests/scripts/evolution_lab.test.ts`
 * asserts every key here names a real verb and that all seven verbs appear.
 */
export const EXIT_CRITERION_COVERAGE: Readonly<Record<string, readonly Verb[]>> = {
    '0.4 a run in which a holdout value reaches proposer context exits non-zero': ['propose'],
    '0.5 a run configured past the ceiling exits non-zero before spending': ['run', 'propose'],
    '3.1 five candidates materialised and destroyed, no diff in the original tree': ['run', 'clean'],
    '3.1 sabotaging a path ownership makes the integrity check exit non-zero': ['compare'],
    '3.2 the schema rejects a candidate touching two primary dimensions': ['inspect', 'run'],
    '3.3 the schema rejects a mutation naming a fourth dimension': ['inspect', 'run'],
    '3.4 no code path reads a candidate as accepted from the mere fact that it exists': ['inspect'],
    '3.4 a state transition skipping a stage is refused': ['explain', 'promote'],
    '3.5 the same input produces byte-identical candidates across two runs': ['propose'],
    '3.6 every verb is named and none starts a resident process': ['explain'],
};

const USAGE = `usage: evolution_lab <verb> [options]

  inspect  [--record FILE]... [--records DIR] [--clones]
  propose  --observations FILE --out DIR [--force]
  run      --record FILE... [--refresh] [--vector FILE]...
           [--trials-per-candidate N] [--estimated-spend-cents N]
  compare  [--verbose]
  explain  [--record FILE [--to STATE]] [--criteria]
  promote  --record FILE [--evidence FILE]  (always refuses: blocker merge-authority)
  clean    [--yes]

No verb starts a resident process, a timer, or a watcher.
propose and run are gated by the pre-registered guards in
_lib/harness_evolution_guards.ts and exit 4 when one aborts the run.
`;

function usageError(msg: string): number {
    process.stderr.write(`evolution_lab: error: ${msg}\n`);
    process.stderr.write(USAGE);
    return EXIT_USAGE;
}

function fail(msg: string): number {
    process.stderr.write(`evolution_lab: ${msg}\n`);
    return EXIT_ERROR;
}

// --- flag parsing -----------------------------------------------------------

interface Flags {
    readonly bools: ReadonlySet<string>;
    readonly values: ReadonlyMap<string, string[]>;
}

class FlagError extends Error {}

/**
 * Parse `--flag` and `--flag value` / `--flag=value` against a declared shape.
 *
 * An unknown flag is an error rather than an ignored token. A silently ignored
 * `--refresh` is the operator believing a clone was rebuilt when it was not.
 */
function parseFlags(argv: readonly string[], boolNames: readonly string[], valueNames: readonly string[]): Flags {
    const bools = new Set<string>();
    const values = new Map<string, string[]>();
    let i = 0;
    while (i < argv.length) {
        const arg = argv[i] as string;
        const eq = arg.indexOf('=');
        const name = eq >= 0 ? arg.slice(0, eq) : arg;
        if (!name.startsWith('--')) {
            throw new FlagError(`unrecognized argument: ${arg}`);
        }
        const bare = name.slice(2);
        if (boolNames.includes(bare)) {
            if (eq >= 0) {
                throw new FlagError(`--${bare} takes no value`);
            }
            bools.add(bare);
            i += 1;
            continue;
        }
        if (valueNames.includes(bare)) {
            let v: string;
            if (eq >= 0) {
                v = arg.slice(eq + 1);
                i += 1;
            } else {
                const next = argv[i + 1];
                if (next === undefined) {
                    throw new FlagError(`--${bare}: expected one argument`);
                }
                v = next;
                i += 2;
            }
            const list = values.get(bare) ?? [];
            list.push(v);
            values.set(bare, list);
            continue;
        }
        throw new FlagError(`unrecognized argument: ${arg}`);
    }
    return { bools, values };
}

function one(flags: Flags, name: string): string | undefined {
    const list = flags.values.get(name);
    if (list === undefined) {
        return undefined;
    }
    if (list.length > 1) {
        throw new FlagError(`--${name} given more than once`);
    }
    return list[0];
}

// --- record loading ---------------------------------------------------------

/**
 * Read and VALIDATE a candidate record file.
 *
 * Routes through `parseCandidateRecord` — the refusing parser — rather than
 * through `readCandidateRecord`, because everything reached from here feeds a
 * RUN. The forgiving reader exists for archives, and is used by `inspect
 * --clones` where a historical record with an unknown dimension must stay
 * readable. Keeping the two apart is the whole point of that asymmetry.
 *
 * @throws {CandidateSchemaError} on a rejected record.
 */
export function loadRecord(file: string): CandidateRecord {
    let raw: string;
    try {
        raw = fs.readFileSync(file, 'utf-8');
    } catch {
        throw new CandidateSchemaError(`record not readable at ${file}`);
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch (e) {
        throw new CandidateSchemaError(`record at ${file} is not valid JSON: ${(e as Error).message}`);
    }
    return parseCandidateRecord(parsed);
}

/** `*.json` under `dir`, sorted byte-wise. Never left in readdir order. */
export function recordFilesIn(dir: string): string[] {
    return fs
        .readdirSync(dir)
        .filter((n) => n.endsWith('.json'))
        .sort(byteCompare)
        .map((n) => path.join(dir, n));
}

/**
 * Candidate clone directories under `clones/`, sorted.
 *
 * Discovery by prefix, matching `bench_ab_integrity.discover_candidate_clones`
 * — a clone the operator was not told about is exactly what an inspection verb
 * has to be able to see.
 */
export function candidateCloneDirs(clonesRoot: string): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(clonesRoot, { withFileTypes: true });
    } catch {
        return [];
    }
    return entries
        .filter((e) => e.isDirectory() && e.name.startsWith(CANDIDATE_PREFIX))
        .map((e) => e.name)
        .sort(byteCompare);
}

// --- verbs ------------------------------------------------------------------

function verbInspect(argv: readonly string[]): number {
    const flags = parseFlags(argv, ['clones'], ['record', 'records']);
    const files: string[] = [...(flags.values.get('record') ?? [])];
    const dir = one(flags, 'records');
    if (dir !== undefined) {
        let listed: string[];
        try {
            listed = recordFilesIn(dir);
        } catch {
            return fail(`records directory not readable at ${dir}`);
        }
        files.push(...listed);
    }
    const wantClones = flags.bools.has('clones') || files.length === 0;
    let bad = 0;
    for (const f of files.sort(byteCompare)) {
        try {
            const r = loadRecord(f);
            process.stdout.write(
                `record ${f}: id=${r.id} dimension=${r.dimension} lifecycle=${r.lifecycle} ` +
                    `accepted=${String(isAccepted(r))} mutations=${String(r.mutations.length)}\n`,
            );
        } catch (e) {
            bad += 1;
            process.stderr.write(`record ${f}: REJECTED — ${(e as Error).message}\n`);
        }
    }
    if (wantClones) {
        const dirs = candidateCloneDirs(CLONES);
        if (dirs.length === 0) {
            process.stdout.write(`clones: none under ${CLONES}\n`);
        }
        for (const name of dirs) {
            const recordPath = path.join(CLONES, name, CANDIDATE_RECORD_FILE);
            try {
                const parsed: unknown = JSON.parse(fs.readFileSync(recordPath, 'utf-8'));
                const r = readCandidateRecord(parsed);
                process.stdout.write(
                    `clone ${name}: id=${r.id} dimension=${r.dimension} lifecycle=${r.lifecycle} ` +
                        `accepted=${String(isAccepted(r))} unknownDimension=${String(r.unknownDimension)}\n`,
                );
            } catch (e) {
                bad += 1;
                process.stderr.write(`clone ${name}: unreadable record — ${(e as Error).message}\n`);
            }
        }
    }
    return bad === 0 ? EXIT_OK : EXIT_ERROR;
}

/**
 * Turn a pre-registered guard's throw into a non-zero PROCESS exit.
 *
 * This function is the whole substance of the `guard-call-site-integration`
 * blocker. The council split on whether a unit test observing a throw proves
 * the guard is integrated; the conservative seat held it does not, because
 * nothing showed an executable runner CONVERTING that throw into a non-zero
 * process exit. This is that conversion, and it is called from both verbs that
 * can reach a guard.
 *
 * Returns `undefined` when the error is not a guard abort, so the caller falls
 * through to its own handling rather than swallowing an unrelated failure as a
 * governance stop.
 */
function guardAbort(e: unknown): number | undefined {
    if (e instanceof BudgetExceededError) {
        process.stderr.write(
            `evolution_lab: ABORTED on the pre-registered budget (dimension: ${e.dimension})\n` +
                `  ${e.message}\n` +
                `  ceilings: ${BUDGET_CONFIG_PATH}\n` +
                '  Nothing was materialised and nothing was spent: the check runs before the first\n' +
                '  record is parsed and before the first clone is written.\n',
        );
        return EXIT_GUARD_ABORT;
    }
    if (e instanceof HoldoutLeakError) {
        process.stderr.write(
            `evolution_lab: ABORTED on evaluator trust boundary (field: ${e.field})\n` +
                `  ${e.message}\n` +
                '  Nothing was proposed and nothing was written: disclosure is checked before the\n' +
                '  observation reaches the proposer.\n',
        );
        return EXIT_GUARD_ABORT;
    }
    if (e instanceof BudgetConfigError) {
        process.stderr.write(`evolution_lab: ABORTED — ${(e as Error).message}\n`);
        return EXIT_GUARD_ABORT;
    }
    return undefined;
}

function verbPropose(argv: readonly string[]): number {
    const flags = parseFlags(argv, ['force'], ['observations', 'out']);
    const obsFile = one(flags, 'observations');
    const outDir = one(flags, 'out');
    if (obsFile === undefined || outDir === undefined) {
        return usageError('propose requires --observations FILE and --out DIR');
    }
    let observations;
    try {
        const doc = parseObservationDocument(JSON.parse(fs.readFileSync(obsFile, 'utf-8')));
        // GUARD 0.5, first. `propose` runs no trials and spends nothing, so the
        // two placeholder dimensions are honest zeros rather than a pretence of
        // a cost model — what it DOES decide is how many candidates exist, and
        // `max_candidates` is a ceiling on exactly that. Checking here as well
        // as in `run` closes the evasion of proposing six and running them in
        // two batches of three.
        const plan: RunPlan = {
            candidates: doc.observations.length,
            trialsPerCandidate: 1,
            estimatedSpendCents: 0,
        };
        assertWithinBudget(plan, loadRunBudget());
        // GUARD 0.4, before the proposer sees anything.
        const log: DisclosureRecord[] = [];
        const disclosed = discloseObservations(doc, log, (line) => process.stderr.write(`${line}\n`));
        observations = parseObservations(disclosed);
    } catch (e) {
        const aborted = guardAbort(e);
        if (aborted !== undefined) {
            return aborted;
        }
        return fail(`observations at ${obsFile} rejected — ${(e as Error).message}`);
    }
    let records: CandidateRecord[];
    try {
        records = proposeCandidates(observations, (subject) =>
            fs.readFileSync(path.join(REPO_ROOT, subject), 'utf-8'),
        );
    } catch (e) {
        return fail(`proposal failed — ${(e as Error).message}`);
    }
    fs.mkdirSync(outDir, { recursive: true });
    for (const r of records) {
        const dest = path.join(outDir, candidateRecordFilename(r));
        if (fs.existsSync(dest) && !flags.bools.has('force')) {
            const existing = fs.readFileSync(dest, 'utf-8');
            const proposed = serialiseCandidateRecord(r);
            if (existing === proposed) {
                process.stdout.write(`propose: ${dest} already identical\n`);
                continue;
            }
            return fail(`${dest} exists with different bytes — pass --force to overwrite`);
        }
        fs.writeFileSync(dest, serialiseCandidateRecord(r), 'utf-8');
        process.stdout.write(`propose: wrote ${dest}\n`);
    }
    process.stdout.write(`propose: ${String(records.length)} candidate(s)\n`);
    return EXIT_OK;
}

/** A non-negative integer flag, or a usage error. Never a silent coercion. */
function intFlag(flags: Flags, name: string, fallback: number): number {
    const raw = one(flags, name);
    if (raw === undefined) {
        return fallback;
    }
    if (!/^\d+$/.test(raw)) {
        throw new FlagError(`--${name} must be a non-negative integer (got ${JSON.stringify(raw)})`);
    }
    return Number.parseInt(raw, 10);
}

function verbRun(argv: readonly string[]): number {
    const flags = parseFlags(
        argv,
        ['refresh'],
        ['record', 'records', 'trials-per-candidate', 'estimated-spend-cents', 'vector'],
    );
    const files: string[] = [...(flags.values.get('record') ?? [])];
    const dir = one(flags, 'records');
    if (dir !== undefined) {
        try {
            files.push(...recordFilesIn(dir));
        } catch {
            return fail(`records directory not readable at ${dir}`);
        }
    }
    if (files.length === 0) {
        return usageError('run requires at least one --record FILE (or --records DIR)');
    }
    // GUARD 0.5 — BEFORE the first record is parsed and before the first clone
    // directory exists. `candidates` is DERIVED from the record set rather than
    // declared: a declared count that disagrees with the record set is how a
    // run gets truncated to fit a ceiling, and 0.5's whole point is that it
    // aborts instead. The other two dimensions are declared because this verb
    // cannot observe them — it runs no trials and spends nothing itself, so a
    // default of zero is the honest reading and a caller that knows better
    // passes the real figure.
    try {
        const plan: RunPlan = {
            candidates: files.length,
            trialsPerCandidate: intFlag(flags, 'trials-per-candidate', 1),
            estimatedSpendCents: intFlag(flags, 'estimated-spend-cents', 0),
        };
        assertWithinBudget(plan, loadRunBudget());
    } catch (e) {
        const aborted = guardAbort(e);
        if (aborted !== undefined) {
            return aborted;
        }
        throw e;
    }
    // Evaluation evidence is parsed BEFORE the first clone, for the same reason
    // the budget guard runs before it: a malformed vector discovered after the
    // work is a failed run that already spent, and `parseMetricVectorJson`
    // inherits `buildVector`'s refusal of a vector missing its artifact-count
    // row, so this is also where that refusal lands.
    const vectors: MetricVector[] = [];
    for (const vf of flags.values.get('vector') ?? []) {
        try {
            vectors.push(parseMetricVectorJson(fs.readFileSync(vf, 'utf-8'), vf));
        } catch (e) {
            return fail(`vector ${vf} rejected — ${(e as Error).message}`);
        }
    }
    const seen = new Set<string>();
    const ids: string[] = [];
    const results: CascadeResult[] = [];
    for (const f of files.sort(byteCompare)) {
        let record: CandidateRecord;
        try {
            record = loadRecord(f);
        } catch (e) {
            return fail(`${f} rejected — ${(e as Error).message}`);
        }
        if (seen.has(record.id)) {
            return fail(`candidate id '${record.id}' given twice — ids name clone directories`);
        }
        seen.add(record.id);
        try {
            clone_candidate(record, { refresh: flags.bools.has('refresh') });
        } catch (e) {
            if (e instanceof PathOwnershipError) {
                return fail(`candidate ${record.id} rejected — ${e.message}`);
            }
            return fail(`candidate ${record.id} failed — ${(e as Error).message}`);
        }

        // EVALUATE. Step 4.1's deterministic prefix, wired here because a
        // library nothing calls has no coverage — the defect AC-3 and AC-5
        // were both open on. The record is re-read from disk rather than
        // reusing `record`, so stage 1 is a real schema gate at this call
        // site and not a formality over an already-parsed object.
        let raw: unknown;
        try {
            raw = JSON.parse(fs.readFileSync(f, 'utf-8'));
        } catch (e) {
            return fail(`${f} unreadable at evaluation — ${(e as Error).message}`);
        }
        const result = runCascade({
            raw,
            plan: {
                candidates: files.length,
                trialsPerCandidate: intFlag(flags, 'trials-per-candidate', 1),
                estimatedSpendCents: intFlag(flags, 'estimated-spend-cents', 0),
            },
            budget: loadRunBudget(),
            peers: ids,
            // ONE evidence input, two consumers. `--vector` is the only
            // measurement flag: step 5.6's run report and step 4.1's cascade
            // read the same parsed vectors rather than each taking a file of
            // its own, so a run cannot report an ROI over one set of numbers
            // while the verdict was decided on another.
            vector: vectors.find((v) => v.candidate_id === record.id),
        });
        ids.push(record.id);
        results.push(result);
    }

    for (const r of results) {
        if (r.outcome === 'abort') {
            process.stdout.write(
                `evolution_lab:cascade · ${r.candidate_id ?? '<unparsed>'} · aborted at ` +
                    `${r.failed_stage} · family=${r.family} · model_calls=${r.model_calls} · ${r.detail}\n`,
            );
        } else if (r.outcome === 'incomplete') {
            process.stdout.write(
                `evolution_lab:cascade · ${r.candidate_id} · passed ${r.stages_run.length} stage(s) · ` +
                    `model_calls=${r.model_calls} · ${r.not_reached} NOT REACHED · ${r.why}\n`,
            );
        } else {
            process.stdout.write(
                `evolution_lab:cascade · ${r.candidate_id} · passed ${r.stages_run.length} stage(s) · ` +
                    `model_calls=${r.model_calls} · verdict=${r.verdict.promote ? 'promote' : 'refuse'} · ` +
                    `${r.verdict.why}\n`,
            );
        }
    }

    // A cascade abort is a run outcome, not a crash: the run did its job by
    // refusing. The cheapest stage is named so a reader can see that a stage-1
    // abort cost nothing.
    const aborted = results.filter((r) => r.outcome === 'abort');
    if (aborted.length > 0) {
        const atCheapest = aborted.filter(
            (r) => r.outcome === 'abort' && r.failed_stage === CHEAPEST_STAGE,
        ).length;
        process.stdout.write(
            `evolution_lab:cascade · ${aborted.length} of ${results.length} aborted ` +
                `(${atCheapest} at the cheapest stage, ${CHEAPEST_STAGE}, costing no model call)\n`,
        );
        return EXIT_REFUSED;
    }
    // STEP 5.6 — the run report, on the ONE path a run completes on.
    //
    // Placed after the clone loop and before the only success return, so there
    // is no completed run without a report. Every other exit from this verb is
    // an abort (budget) or a failure (unreadable record), and neither is a run
    // whose ROI could be reported: nothing was cloned and nothing was spent.
    let report: RunReport;
    try {
        report = buildRunReport({
            // Deterministic and identifying: the candidate ids, in the byte
            // order the run walked them. Two runs over the same record set
            // produce the same id, and a run over a different set cannot
            // borrow another run's report line.
            run_id: `run:${[...seen].sort(byteCompare).join('+')}`,
            candidates: files.length,
            trials_per_candidate: intFlag(flags, 'trials-per-candidate', 1),
            roi: roiFigure(vectors, intFlag(flags, 'estimated-spend-cents', 0)),
        });
    } catch (e) {
        return fail(`run report rejected — ${(e as Error).message}`);
    }
    for (const line of renderRunReport(report)) {
        process.stdout.write(`${line}\n`);
    }
    return EXIT_OK;
}

function verbCompare(argv: readonly string[]): number {
    const flags = parseFlags(argv, ['verbose'], []);
    // Direct call, never a subprocess: the integrity check is the second
    // independent path-ownership guard and it must run in this process so its
    // exit code IS this verb's exit code rather than a relayed one.
    return integrity_main(flags.bools.has('verbose') ? ['--verbose'] : []);
}

/** Every state this record could legally move to right now, sorted. */
export function legalNextStates(from: LifecycleState): LifecycleState[] {
    const out: LifecycleState[] = [];
    for (const to of LIFECYCLE_STATES) {
        try {
            assertTransition(from, to);
            out.push(to);
        } catch {
            // Refused — including `promoted`, which needs a named human and
            // therefore is never a legal NEXT state from a bare transition call.
        }
    }
    return out.sort(byteCompare);
}

function verbExplain(argv: readonly string[]): number {
    const flags = parseFlags(argv, ['criteria'], ['record', 'to']);
    const file = one(flags, 'record');
    const to = one(flags, 'to');
    if (flags.bools.has('criteria')) {
        for (const key of Object.keys(EXIT_CRITERION_COVERAGE).sort(byteCompare)) {
            const verbs = EXIT_CRITERION_COVERAGE[key] as readonly Verb[];
            process.stdout.write(`criterion ${key} -> ${verbs.join(', ')}\n`);
        }
        process.stdout.write(
            'criterion coverage spans the phases that exist: Phases 4-7 are unbuilt, so no verb reaches them\n',
        );
        if (file === undefined) {
            return EXIT_OK;
        }
    }
    if (file === undefined) {
        return usageError('explain requires --record FILE or --criteria');
    }
    let record: CandidateRecord;
    try {
        record = loadRecord(file);
    } catch (e) {
        return fail(`${file} rejected — ${(e as Error).message}`);
    }
    const recipe = Object.values(RECIPES).find((r) => r.dimension === record.dimension);
    process.stdout.write(`explain ${record.id}\n`);
    process.stdout.write(`  dimension: ${record.dimension} (exactly one, per step 3.2)\n`);
    process.stdout.write(`  lifecycle: ${record.lifecycle}\n`);
    process.stdout.write(`  accepted:  ${String(isAccepted(record))}\n`);
    process.stdout.write(`  spine:     ${LIFECYCLE_SPINE.join(' -> ')}\n`);
    process.stdout.write(`  legal now: ${legalNextStates(record.lifecycle).join(', ') || '(none)'}\n`);
    if (recipe !== undefined) {
        process.stdout.write(`  a ${record.dimension} defect reads: ${recipe.summary}\n`);
    }
    for (const m of record.mutations) {
        process.stdout.write(`  writes:    ${m.path} (${String(m.content.length)} chars)\n`);
    }
    if (to === undefined) {
        return EXIT_OK;
    }
    if (!isLifecycleState(to)) {
        return usageError(`--to must be one of ${LIFECYCLE_STATES.join(', ')}`);
    }
    try {
        assertTransition(record.lifecycle, to);
        process.stdout.write(`  transition ${record.lifecycle} -> ${to}: LEGAL\n`);
        return EXIT_OK;
    } catch (e) {
        if (e instanceof LifecycleTransitionError) {
            process.stdout.write(`  transition ${record.lifecycle} -> ${to}: REFUSED — ${e.message}\n`);
            return EXIT_ERROR;
        }
        throw e;
    }
}

/**
 * The promotion verb. It exists, it is named, and it always refuses.
 *
 * Two independent reasons, in the order they fire:
 *
 *   1. `assertTransition(from, 'promoted')` is called with NO approval, so the
 *      lifecycle's own gate refuses. This is the mechanical half of the
 *      non-promotion property the `merge-authority` council required.
 *   2. Blocker `merge-authority` is OPEN. Phase 7 is gated on it and no council
 *      may resolve it: granting preauthorized merge authority weakens a
 *      human-in-the-loop guarantee, and refusing it settles an ADR-239 Decision
 *      recorded as open. Both are owner-reserved.
 *
 * There is no flag, no environment variable and no argument that turns this
 * into a promotion. `--approver` is deliberately NOT a flag: adding one is what
 * would let an unattended run name a human who never approved.
 *
 * `--evidence FILE` IS a flag, and it changes nothing about the refusal. It is
 * how steps 7.1, 7.3, 7.4 and 7.5 are exercised against a refused promotion: the
 * package is validated FIRST and its finding names the missing field, so an
 * operator assembling one can see which field is wrong instead of only being
 * told the blocker is open. Both paths still return {@link EXIT_REFUSED}.
 */
function verbPromote(argv: readonly string[]): number {
    const flags = parseFlags(argv, [], ['record', 'evidence']);
    const file = one(flags, 'record');
    if (file === undefined) {
        return usageError('promote requires --record FILE');
    }
    let record: CandidateRecord;
    try {
        record = loadRecord(file);
    } catch (e) {
        return fail(`${file} rejected — ${(e as Error).message}`);
    }

    // 7.1 / 7.3 / 7.4 / 7.5 — the evidence package, checked BEFORE the governance
    // refusal so its finding names the missing field rather than being swallowed
    // by a blocker message the operator cannot act on.
    const evidenceFile = one(flags, 'evidence');
    if (evidenceFile === undefined) {
        process.stderr.write(
            `evolution_lab: promote REFUSED for ${record.id}\n` +
                '  evidence package: absent. A promotion carries ONE package with all ' +
                `${String(PROMOTION_EVIDENCE_FIELDS.length)} fields ` +
                `(${PROMOTION_EVIDENCE_FIELDS.join(', ')}); pass --evidence FILE.\n`,
        );
    } else {
        try {
            const evidence = parsePromotionEvidence(JSON.parse(fs.readFileSync(evidenceFile, 'utf-8')));
            assertNotSemanticNoOp(
                evidence.candidateId,
                isSemanticNoOp(
                    evidence.materialImprovement.baselineText,
                    evidence.materialImprovement.candidateText,
                    evidence.materialImprovement.deltaPercent,
                ),
            );
        } catch (e) {
            if (e instanceof PromotionEvidenceError || e instanceof SemanticNoOpError) {
                process.stderr.write(
                    `evolution_lab: promote REFUSED for ${record.id}\n  evidence package: ${e.message}\n`,
                );
            } else {
                return fail(`${evidenceFile} unreadable — ${(e as Error).message}`);
            }
        }
    }

    let gate = 'the lifecycle gate did not refuse, which is itself a defect';
    try {
        assertTransition(record.lifecycle, 'promoted');
    } catch (e) {
        gate = (e as Error).message;
    }
    process.stderr.write(
        `evolution_lab: promote REFUSED for ${record.id}\n` +
            `  lifecycle gate: ${gate}\n` +
            '  blocker: merge-authority is OPEN on road-to-governed-harness-evolution.\n' +
            '    Phases 1-6 are legal because they promote nothing (AI council 2026-08-29,\n' +
            '    anthropic + openai, 2/2). Phase 7 stays gated: granting merge authority\n' +
            '    weakens a human-in-the-loop guarantee and refusing it settles ADR-239\n' +
            '    Decision 3, and both are owner-reserved.\n' +
            '  Promotion into canonical agent-config remains a named human act performed\n' +
            '  outside this tool. This verb will not perform it.\n',
    );
    return EXIT_REFUSED;
}

/**
 * Remove candidate clones — and only candidate clones.
 *
 * Scope is the `clones/candidate-*` directories this tool creates. The three
 * fixed variants (`with`, `without`, `with-rdp`) are expensive to rebuild and
 * belong to the value bench, not to the candidate loop, so they are never in
 * range. Dry-run is the default; `--yes` is the confirmation.
 */
function verbClean(argv: readonly string[]): number {
    const flags = parseFlags(argv, ['yes'], []);
    const dirs = candidateCloneDirs(CLONES);
    if (dirs.length === 0) {
        process.stdout.write(`clean: no candidate clones under ${CLONES}\n`);
        return EXIT_OK;
    }
    if (!flags.bools.has('yes')) {
        for (const name of dirs) {
            process.stdout.write(`clean: would remove ${path.join(CLONES, name)}\n`);
        }
        process.stdout.write(`clean: ${String(dirs.length)} candidate clone(s); pass --yes to remove\n`);
        return EXIT_OK;
    }
    for (const name of dirs) {
        // Re-check the prefix against the name actually about to be removed.
        // The listing and the deletion are two steps, and a delete loop that
        // trusts an earlier filter is one refactor away from removing `with`.
        if (!name.startsWith(CANDIDATE_PREFIX)) {
            return fail(`refusing to remove ${name}: not a candidate clone`);
        }
        const target = path.join(CLONES, name);
        fs.rmSync(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
        process.stdout.write(`clean: removed ${target}\n`);
    }
    return EXIT_OK;
}

// --- entry ------------------------------------------------------------------

export function main(argv?: string[]): number {
    const args = argv ?? process.argv.slice(2);
    const verb = args[0];
    if (verb === undefined || verb === '-h' || verb === '--help') {
        process.stdout.write(USAGE);
        return verb === undefined ? EXIT_USAGE : EXIT_OK;
    }
    if (!isVerb(verb)) {
        return usageError(`unknown verb '${verb}' (choose from ${VERBS.join(', ')})`);
    }
    const rest = args.slice(1);
    try {
        switch (verb) {
            case 'inspect':
                return verbInspect(rest);
            case 'propose':
                return verbPropose(rest);
            case 'run':
                return verbRun(rest);
            case 'compare':
                return verbCompare(rest);
            case 'explain':
                return verbExplain(rest);
            case 'promote':
                return verbPromote(rest);
            case 'clean':
                return verbClean(rest);
        }
    } catch (e) {
        if (e instanceof FlagError) {
            return usageError(e.message);
        }
        if (e instanceof CandidateSchemaError || e instanceof PathOwnershipError) {
            return fail((e as Error).message);
        }
        throw e;
    }
}

function _isCliEntry(): boolean {
    try {
        if (process.argv[1] === undefined) {
            return false;
        }
        return fs.realpathSync(_HERE) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
