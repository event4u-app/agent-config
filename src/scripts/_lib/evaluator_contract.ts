/**
 * The evaluator-output contract: types, the registry of wrapped verifiers, and
 * the validator both the gate and any future loop share.
 *
 * Contract: `docs/contracts/evaluator-output.md`.
 * Schema:   `src/scripts/schemas/evaluator-output.schema.json`.
 *
 * The adapters below are PURE — each maps a verifier's already-captured
 * `{stdout, stderr, exitCode}` onto the contract shape. That is deliberate and
 * it is what makes the gate cheap: the mapping is the part that can be wrong,
 * and it can be tested against recorded fixtures without paying to re-run three
 * verifiers CI already runs once. Spike s02 established that none of the three
 * needs a change on its own side for this to work.
 */
import { load_schema, validate, type YamlValue } from '../validate_frontmatter.js';

export type MetricState = 'present' | 'absent' | 'unreadable';
export type Direction = 'maximize' | 'minimize';

export interface EvaluatorOutput {
    readonly schema_version: 1;
    readonly name: string;
    readonly pass: boolean;
    readonly score: number;
    readonly metric?: number;
    readonly metric_state?: MetricState;
    readonly direction?: Direction;
    readonly error?: string;
}

/** What a verifier invocation produced, before any interpretation. */
export interface RawRun {
    readonly stdout: string;
    readonly stderr: string;
    readonly exitCode: number;
}

export interface EvaluatorAdapter {
    readonly name: string;
    /** The verifier this adapter wraps, as its CI-identical script name. */
    readonly wraps: string;
    readonly direction: Direction;
    readonly parse: (raw: RawRun) => EvaluatorOutput;
}

/**
 * Read a count off either stream.
 *
 * Both streams on purpose: `check_references` writes its count to stderr
 * (measured, spike s02), and a stdout-only reader returned a null metric beside
 * `pass: true` — a degraded reading that looked clean. A wrapper reads both; it
 * still emits its own verdict on stdout alone, per the contract.
 */
function readCount(raw: RawRun, re: RegExp): number | null {
    const m = `${raw.stdout}\n${raw.stderr}`.match(re);
    if (m === null || m[1] === undefined) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
}

/**
 * Fold a possibly-missing count into the three contract fields.
 *
 * `expected` says whether this verifier is supposed to have a number at all.
 * When it is and the number is missing, the result is `unreadable` — never
 * `absent`, and never a silent zero. That collapse is the exact defect the
 * `metric_state` field exists to prevent.
 */
function withMetric(
    base: Omit<EvaluatorOutput, 'metric' | 'metric_state' | 'score'>,
    count: number | null,
    expected: boolean,
): EvaluatorOutput {
    if (count !== null) {
        return { ...base, metric: count, metric_state: 'present', score: -count };
    }
    // `metric` is OMITTED rather than set to null: the subset validator this
    // estate ships rejects an array-typed `type`, so the schema spells the field
    // as an optional number. Absence is the null.
    if (!expected) {
        return { ...base, metric_state: 'absent', score: base.pass ? 0 : -1 };
    }
    return {
        ...base,
        metric_state: 'unreadable',
        score: -1,
        error: 'expected a count in the verifier output and found none',
    };
}

export const EVALUATORS: readonly EvaluatorAdapter[] = [
    {
        name: 'validate_frontmatter',
        wraps: 'validate_frontmatter',
        direction: 'minimize',
        parse: (raw) =>
            withMetric(
                { schema_version: 1, name: 'validate_frontmatter', pass: raw.exitCode === 0, direction: 'minimize' },
                // Group 2 is the failing count; group 1 is the corpus size, which
                // is the denominator and not the thing being minimized.
                readCount(raw, /\d+\s+artefacts,\s+(\d+)\s+failing/),
                true,
            ),
    },
    {
        name: 'lint_output_slop',
        wraps: 'lint_output_slop',
        direction: 'minimize',
        parse: (raw) => {
            const text = `${raw.stdout}\n${raw.stderr}`;
            const clean = /clean\s+—\s+no placeholder-prose patterns found/.test(text);
            const count = clean ? 0 : (text.match(/^\s*\S+:\d+/gm) ?? []).length;
            return withMetric(
                { schema_version: 1, name: 'lint_output_slop', pass: raw.exitCode === 0, direction: 'minimize' },
                count,
                true,
            );
        },
    },
    {
        name: 'check_references',
        wraps: 'check_references',
        direction: 'minimize',
        parse: (raw) => {
            const text = `${raw.stdout}\n${raw.stderr}`;
            const scanned = readCount(raw, /scanned:\s*(\d+)/);
            // A gate that scanned nothing has not measured a clean tree — it has
            // not measured. Report that as unreadable rather than as zero broken
            // references, which is the manufactured-green shape this estate names.
            if (scanned === null || scanned === 0) {
                return withMetric(
                    { schema_version: 1, name: 'check_references', pass: raw.exitCode === 0, direction: 'minimize' },
                    null,
                    true,
                );
            }
            const clean = /No broken references found/.test(text);
            return withMetric(
                { schema_version: 1, name: 'check_references', pass: raw.exitCode === 0, direction: 'minimize' },
                clean ? 0 : (text.match(/^\s*broken:/gim) ?? []).length || 1,
                true,
            );
        },
    },
];

/**
 * Schema violations for one evaluator output. Empty array = conformant.
 *
 * `SchemaError.format()` rather than `String(e)`: the class carries no
 * `toString`, so stringifying it yields `[object Object]` — a violation list
 * that names nothing, which is indistinguishable from a broken validator.
 */
export function validateEvaluatorOutput(value: unknown): string[] {
    const schema = load_schema('evaluator-output');
    return validate(value as YamlValue, schema)
        .filter((e) => e.severity !== 'warning')
        .map((e) => e.format());
}
