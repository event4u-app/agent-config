/**
 * Per-test independence provenance — `road-to-adversarial-verification-and-long-runs` AC-2.
 *
 * `evaluator-independence` § Tests are evaluators states the five levels and
 * says critical behaviour targets L3 or L4 wherever two providers are
 * configured. It states no place to WRITE that down, so before this module the
 * level a given test actually reached was unrecorded and therefore uncheckable —
 * which is the same shape as the recorded failure that rule exists over: a
 * verdict nobody could trace back to the prompt that produced it.
 *
 * The record is a comment line directly above a `describe(`:
 *
 * ```
 * // provenance: level=L4 | critical=yes | evidence=ac2-authorship-run-a
 * describe('T9 — a typed op reaches an exact-object ask', () => {
 * ```
 *
 * **Three decisions worth reading, because each has a plausible opposite.**
 *
 * An unmarked group is `ungoverned`, never defaulted to L0. Defaulting would
 * make "provenance is recorded per test" true by construction, and a claim that
 * cannot be false is not a record.
 *
 * The provider count is a PARAMETER, not a probe. `agent-config council:status`
 * resolves from a user-global file that a CI runner does not have, so probing
 * it would make the floor depend on the machine and read "no providers, no
 * obligation" exactly where the obligation matters. The caller supplies the
 * count it is asserting about, and a repository with two configured providers
 * pins 2.
 *
 * `evidence` is required at L3 and L4 and ignored below. An unattributed claim
 * of independence cannot be checked for the independence it claims; at L0-L2
 * there is no cross-provider claim to attribute, so demanding an artefact there
 * would be ceremony.
 *
 * Pure — a string in, findings out. No filesystem, so both polarities are
 * testable without a fixture tree.
 */

/** The five levels of `evaluator-independence` § Tests are evaluators. */
export const INDEPENDENCE_LEVELS = ['L0', 'L1', 'L2', 'L3', 'L4'] as const;
export type IndependenceLevel = (typeof INDEPENDENCE_LEVELS)[number];

/** What critical behaviour targets where two providers are configured. */
export const CRITICAL_FLOOR: IndependenceLevel = 'L3';

/**
 * The honest ceiling below two providers.
 *
 * With one provider, L3 ("another provider") is unreachable by definition, so
 * the floor relaxes rather than demanding a level the install cannot produce. A
 * floor nobody can clear gets deleted rather than met.
 */
export const SINGLE_PROVIDER_FLOOR: IndependenceLevel = 'L2';

/** One group's recorded independence. */
export interface ProvenanceRecord {
    /** The `describe` title this record governs. */
    readonly group: string;
    readonly level: IndependenceLevel;
    /** Security, authority, data loss or merge control. */
    readonly critical: boolean;
    /** The artefact the level came from. Empty is legal below L3. */
    readonly evidence: string;
    /** 1-based line of the marker, so a finding can point at it. */
    readonly line: number;
}

export interface ProvenanceScan {
    readonly records: readonly ProvenanceRecord[];
    /** Titles of `describe`s carrying no valid marker. */
    readonly ungoverned: readonly string[];
}

/** Rank within the ordered vocabulary. L0 is 0. */
export function levelRank(level: IndependenceLevel): number {
    return INDEPENDENCE_LEVELS.indexOf(level);
}

const MARKER = /^\s*\/\/\s*provenance:\s*(.*)$/;
const DESCRIBE = /^\s*describe\(\s*(['"`])(.*?)\1/;

function isLevel(v: string): v is IndependenceLevel {
    return (INDEPENDENCE_LEVELS as readonly string[]).includes(v);
}

/** Parse `key=value | key=value` into a map. Unknown keys are ignored. */
function fields(rest: string): Map<string, string> {
    const out = new Map<string, string>();
    for (const part of rest.split('|')) {
        const eq = part.indexOf('=');
        if (eq < 0) continue;
        out.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim());
    }
    return out;
}

/**
 * Scan a test file's source for provenance records.
 *
 * A marker governs the `describe` it sits directly above — blank lines between
 * them are tolerated, any other statement is not. Without that adjacency rule a
 * marker anywhere in the file would appear to cover the next group, which is how
 * one record silently becomes a claim about several.
 */
export function parseProvenance(source: string): ProvenanceScan {
    const lines = source.split('\n');
    const records: ProvenanceRecord[] = [];
    const ungoverned: string[] = [];

    for (let i = 0; i < lines.length; i += 1) {
        const d = DESCRIBE.exec(lines[i] ?? '');
        if (d === null) continue;
        const group = d[2] ?? '';

        // Walk back over blank lines to the candidate marker.
        let j = i - 1;
        while (j >= 0 && (lines[j] ?? '').trim() === '') j -= 1;
        const m = j >= 0 ? MARKER.exec(lines[j] ?? '') : null;
        if (m === null) {
            ungoverned.push(group);
            continue;
        }
        const f = fields(m[1] ?? '');
        const level = f.get('level') ?? '';
        if (!isLevel(level)) {
            ungoverned.push(group);
            continue;
        }
        records.push({
            group,
            level,
            critical: f.get('critical') === 'yes',
            evidence: f.get('evidence') ?? '',
            line: j + 1,
        });
    }
    return { records, ungoverned };
}

/**
 * Critical groups that do not clear the floor for this provider count.
 *
 * Returns one human-readable finding per gap, naming the group, the level it
 * records and what it owed — a caller reading the list should not have to open
 * the file to know what to change.
 */
export function criticalGaps(
    records: readonly ProvenanceRecord[],
    providerCount: number,
): string[] {
    const floor = providerCount >= 2 ? CRITICAL_FLOOR : SINGLE_PROVIDER_FLOOR;
    const gaps: string[] = [];
    for (const r of records) {
        if (!r.critical) continue;
        if (levelRank(r.level) < levelRank(floor)) {
            gaps.push(
                `${r.group} (line ${String(r.line)}) records ${r.level}; critical behaviour ` +
                    `needs ${floor} or above with ${String(providerCount)} provider(s) configured`,
            );
            continue;
        }
        if (levelRank(r.level) >= levelRank(CRITICAL_FLOOR) && r.evidence === '') {
            gaps.push(
                `${r.group} (line ${String(r.line)}) claims ${r.level} with no evidence; an ` +
                    `unattributed claim of independence cannot be checked for the independence it claims`,
            );
        }
    }
    return gaps;
}
