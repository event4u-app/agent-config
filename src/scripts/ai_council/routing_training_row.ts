/**
 * The offline routing-training row schema — step 11.1.
 *
 * `road-to-inbox-harvest-2026-08-e-council-topology-evidence` step 11.1:
 * *"Collect offline training rows from benchmark and dogfood evidence only,
 * without requiring raw private prompt content"*, verified by *"the row schema
 * has no field capable of holding prompt text"*.
 *
 * ## PII-exclusion by construction, not by scrubbing
 *
 * The privacy property is a property of the TYPE, not of a sanitisation pass
 * that can fail: **no field accepts free text**. Every field is an integer, a
 * boolean, or an enum whose legal values are a declared closed set. A row that
 * cannot hold a sentence has no scrubber to forget to run — the same principle
 * `domain-safety-pii` § Surface 2 applies to logs and
 * `artifact-engagement-recording` applies to telemetry.
 *
 * There is deliberately no `payload`, `notes`, `extra`, `context`,
 * `promptText`, `Record<string, unknown>` or `unknown`-typed field, and
 * {@link auditRowSchema} rejects one if a later edit adds it.
 *
 * ## Two layers, because one is not enough
 *
 *   1. {@link ROW_FIELDS} is the declared manifest — name plus kind plus, for
 *      an enum, the closed value set. {@link auditRowSchema} walks a row
 *      against it and refuses any field the manifest does not declare, any
 *      value outside a declared enum, and any string-shaped value at all.
 *   2. The interface itself is checked from the OUTSIDE by
 *      `tests/scripts/ai_council/routing_training_row.test.ts`, which greps the
 *      module source for a bare `string` / `any` / `unknown` /
 *      `Record<string, …>` field declaration. The manifest alone cannot see a
 *      field somebody adds to the interface and forgets to declare.
 *
 * ## Honest scope — the step is NOT closed by this file
 *
 * This is the schema. **No rows have been collected**, and the benchmark half
 * of the evidence 11.1 names does not exist: `blocker: phase-2-benchmark-cost`
 * records that `topology_bench_manifest.ts` `main()` only `--emit`s JSON and
 * contains no provider dispatch. The verify clause is discharged; the step's
 * collection half is not, which is why 11.1 stays unchecked.
 *
 * Pure and offline: type declarations, one manifest, one validator.
 */
import { COUNCIL_TOPOLOGIES } from './topology_vocabulary.js';
import type { CouncilTopology } from './topology_vocabulary.js';
import type { ImpactClass } from './necessity.js';

/** Impact classes, as a runtime closed set. Mirrors `necessity.ts:545-550`. */
export const IMPACT_CLASSES = Object.freeze([
    'trivial',
    'low_impact',
    'medium_impact',
    'high_impact',
    'user_required',
] as const);

/** Where the row came from. 11.1 admits exactly these two and no third. */
export const EVIDENCE_SOURCES = Object.freeze(['benchmark', 'dogfood'] as const);
export type EvidenceSource = (typeof EVIDENCE_SOURCES)[number];

/** Bucketed magnitudes. Buckets, never raw sizes — a raw byte count of a prompt is a weak fingerprint. */
export const MAGNITUDE_BUCKETS = Object.freeze(['xs', 's', 'm', 'l', 'xl'] as const);
export type MagnitudeBucket = (typeof MAGNITUDE_BUCKETS)[number];

/** What the run did to the verdict. The label a challenger would learn against. */
export const ROW_OUTCOMES = Object.freeze(['verdict-changed', 'verdict-unchanged', 'no-verdict'] as const);
export type RowOutcome = (typeof ROW_OUTCOMES)[number];

/**
 * One training row.
 *
 * EVERY field is an integer, a boolean, or one of the closed enums above.
 * Adding a `string`-typed field here is the violation this schema exists to
 * make impossible, and the test file greps for exactly that.
 */
export interface RoutingTrainingRow {
    readonly evidenceSource: EvidenceSource;
    readonly topology: CouncilTopology;
    readonly impactClass: ImpactClass;
    readonly artifactSizeBucket: MagnitudeBucket;
    readonly initialDisagreementBucket: MagnitudeBucket;
    readonly latencyBucket: MagnitudeBucket;
    readonly outcome: RowOutcome;
    readonly memberCount: number;
    readonly providerFamilyCount: number;
    readonly roundsConfigured: number;
    readonly roundsCompleted: number;
    readonly priorRunFreshnessDays: number;
    readonly estimatedCalls: number;
    readonly observedCalls: number;
    readonly estimatedCostCents: number;
    readonly observedCostCents: number;
    readonly stoppedEarly: boolean;
    readonly minorityRetained: boolean;
}

/** A declared field. `enum` carries its closed value set; nothing else may be a string. */
export type FieldKind = 'integer' | 'boolean' | 'enum';

export interface RowField {
    readonly name: keyof RoutingTrainingRow & string;
    readonly kind: FieldKind;
    /** Present iff `kind === 'enum'`. The ONLY legal string values in a row. */
    readonly values?: readonly string[];
}

/** The manifest. Order is the serialisation order; the set is the schema. */
export const ROW_FIELDS: readonly RowField[] = Object.freeze([
    { name: 'evidenceSource', kind: 'enum', values: EVIDENCE_SOURCES },
    { name: 'topology', kind: 'enum', values: COUNCIL_TOPOLOGIES },
    { name: 'impactClass', kind: 'enum', values: IMPACT_CLASSES },
    { name: 'artifactSizeBucket', kind: 'enum', values: MAGNITUDE_BUCKETS },
    { name: 'initialDisagreementBucket', kind: 'enum', values: MAGNITUDE_BUCKETS },
    { name: 'latencyBucket', kind: 'enum', values: MAGNITUDE_BUCKETS },
    { name: 'outcome', kind: 'enum', values: ROW_OUTCOMES },
    { name: 'memberCount', kind: 'integer' },
    { name: 'providerFamilyCount', kind: 'integer' },
    { name: 'roundsConfigured', kind: 'integer' },
    { name: 'roundsCompleted', kind: 'integer' },
    { name: 'priorRunFreshnessDays', kind: 'integer' },
    { name: 'estimatedCalls', kind: 'integer' },
    { name: 'observedCalls', kind: 'integer' },
    { name: 'estimatedCostCents', kind: 'integer' },
    { name: 'observedCostCents', kind: 'integer' },
    { name: 'stoppedEarly', kind: 'boolean' },
    { name: 'minorityRetained', kind: 'boolean' },
] as const);

/**
 * The longest a legal enum value may be. A closed set whose members are all
 * short is not a text field; a "closed set" containing a paragraph is one
 * wearing a disguise, and this is the cheapest thing that tells them apart.
 */
export const MAX_ENUM_VALUE_LENGTH = 40;

/** Every reason a row or the schema itself is rejected. Empty means clean. */
export function auditRowSchema(row: Record<string, unknown>): string[] {
    const problems: string[] = [];
    const declared = new Map(ROW_FIELDS.map((f) => [f.name as string, f]));

    for (const f of ROW_FIELDS) {
        if (f.kind === 'enum') {
            if (f.values === undefined || f.values.length === 0) {
                problems.push(`field \`${f.name}\` is an enum with no declared value set — that is a free-text field`);
                continue;
            }
            for (const v of f.values) {
                if (v.length > MAX_ENUM_VALUE_LENGTH) {
                    problems.push(
                        `field \`${f.name}\` declares the value \`${v.slice(0, 20)}…\` (${String(v.length)} chars), ` +
                            `over the ${String(MAX_ENUM_VALUE_LENGTH)}-char enum limit — a closed set of paragraphs is a text field`,
                    );
                }
            }
        } else if (f.values !== undefined) {
            problems.push(`field \`${f.name}\` is \`${f.kind}\` but declares an enum value set`);
        }
    }

    for (const [key, value] of Object.entries(row)) {
        const f = declared.get(key);
        if (f === undefined) {
            problems.push(`row carries \`${key}\`, which the schema does not declare — undeclared fields are rejected`);
            continue;
        }
        if (f.kind === 'integer') {
            if (typeof value !== 'number' || !Number.isInteger(value)) {
                problems.push(`field \`${key}\` must be an integer, got ${typeof value}`);
            }
        } else if (f.kind === 'boolean') {
            if (typeof value !== 'boolean') problems.push(`field \`${key}\` must be a boolean, got ${typeof value}`);
        } else if (typeof value !== 'string' || !(f.values as readonly string[]).includes(value)) {
            problems.push(
                `field \`${key}\` must be one of ${(f.values as readonly string[]).join(' | ')} — ` +
                    'an arbitrary string is exactly the prompt-text carrier this schema forbids',
            );
        }
    }

    for (const f of ROW_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(row, f.name)) {
            problems.push(`row is missing declared field \`${f.name}\``);
        }
    }
    return problems;
}

/** Serialise a validated row. Throws rather than emitting a row that failed the audit. */
export function serialiseRow(row: RoutingTrainingRow): string {
    const problems = auditRowSchema(row as unknown as Record<string, unknown>);
    if (problems.length > 0) {
        throw new Error(`routing training row rejected:\n  - ${problems.join('\n  - ')}`);
    }
    const ordered: Record<string, unknown> = {};
    for (const f of ROW_FIELDS) ordered[f.name] = (row as unknown as Record<string, unknown>)[f.name];
    return JSON.stringify(ordered);
}
