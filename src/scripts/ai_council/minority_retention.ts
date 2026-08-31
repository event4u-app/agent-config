/**
 * Majority laundering — the permanent fixture gate for step 5.3.
 *
 * `road-to-inbox-harvest-2026-08-e-council-topology-evidence` step 5.3:
 * *"seed one correct minority against several plausible-but-wrong majority
 * answers; the synthesizer must justify accepting or rejecting the minority"*,
 * verified by *"the fixture is permanent, and a synthesizer that silently drops
 * the minority fails it"*.
 *
 * ## What this decides, and what it deliberately does not
 *
 * It decides the SHAPE of the disposition, not its correctness. Three questions,
 * all answerable from text:
 *
 *   1. Does the synthesis NAME the minority position (an anchor phrase)?
 *   2. Does it state a DISPOSITION — accept or reject?
 *   3. Does it attach a REASON to that disposition?
 *
 * Accepting and rejecting are BOTH passes. The failure 5.3 names is the silent
 * drop: the majority answer reported as the verdict with the minority never
 * appearing, so a reader cannot tell whether it was weighed or never seen.
 *
 * It does NOT decide whether the synthesizer reached the right verdict. That
 * needs the benchmark, which is gated behind `blocker: phase-2-benchmark-cost`,
 * and pretending otherwise here would be the overstatement this file's own
 * § Prevented items exists to catch. A synthesis that rejects the correct
 * minority with a stated reason PASSES this gate and is wrong — which is the
 * honest scope, said out loud rather than implied.
 *
 * Pure, offline, no model call: the "synthesizers" its tests exercise are
 * scripted strings.
 */
import * as fs from 'node:fs';

/** The minority half of a laundering fixture. */
export interface MinorityPosition {
    readonly member: string;
    readonly answer: string;
    /** Distinctive phrases; naming none of them is not engaging with the minority. */
    readonly anchors: readonly string[];
}

/** One plausible-but-wrong majority answer. */
export interface MajorityPosition {
    readonly member: string;
    readonly answer: string;
    readonly why_wrong: string;
}

export interface LaunderingFixture {
    readonly id: string;
    readonly permanent: boolean;
    readonly question: string;
    /** Which side is correct. `'minority'` is the whole point of the fixture. */
    readonly ground_truth: 'minority' | 'majority';
    readonly minority: MinorityPosition;
    readonly majority: readonly MajorityPosition[];
}

/** Why a synthesis failed. Empty means it stated a disposition with a reason. */
export type RetentionFailure =
    /** No anchor appears — the minority is not in the text at all. */
    | 'minority-silently-dropped'
    /** The minority is named but neither accepted nor rejected. */
    | 'no-disposition'
    /** A disposition is stated with nothing attached to it. */
    | 'unjustified-disposition';

export interface RetentionVerdict {
    readonly passed: boolean;
    readonly failures: readonly RetentionFailure[];
    /** Anchors actually found, for the failure message. */
    readonly anchorsFound: readonly string[];
    /** `'accept' | 'reject' | null` — what the text says was done with the minority. */
    readonly disposition: 'accept' | 'reject' | null;
}

/**
 * Disposition vocabulary.
 *
 * Deliberately small and explicit rather than a general parser: a wide matcher
 * would pass a synthesis that merely uses the word "however", which is the
 * hedge a laundering synthesis produces most often.
 */
const ACCEPT_RE =
    /\b(accept(?:ed|ing|s)?|adopt(?:ed|ing|s)?|the minority is correct|minority is right|side with the minority|upheld)\b/i;
const REJECT_RE =
    /\b(reject(?:ed|ing|s)?|set aside|discount(?:ed|ing|s)?|overrul(?:e|ed|ing)|not persuasive|declin(?:e|ed|ing) to adopt|dismiss(?:ed|ing|es)?)\b/i;

/**
 * Justification markers. A disposition with no reason attached is the second
 * failure mode 5.3 implies but does not spell out: *"justify accepting or
 * rejecting"* is two obligations, and a bare "the minority is rejected" clears
 * only the first.
 */
const REASON_RE = /\b(because|since|on the grounds that|the reason is|as it|reasoning:|rationale:|given that)\b/i;

/** Tolerant containment: `eager load` matches `eager loading`, case-insensitively. */
export function anchorPresent(text: string, anchor: string): boolean {
    const words = anchor
        .trim()
        .split(/\s+/)
        .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    // `\w*` after each word absorbs an inflection; `\s+` between them tolerates
    // whatever whitespace the renderer emitted.
    return new RegExp(`\\b${words.join('\\w*\\s+')}\\w*`, 'i').test(text);
}

/** Audit one synthesis against one fixture. */
export function auditMinorityRetention(synthesis: string, fixture: LaunderingFixture): RetentionVerdict {
    const anchorsFound = fixture.minority.anchors.filter((a) => anchorPresent(synthesis, a));
    const failures: RetentionFailure[] = [];

    if (anchorsFound.length === 0) {
        // Nothing further is decidable: with the minority absent there is no
        // disposition to grade, and reporting three failures for one defect
        // would put noise in a message whose value is that it is short.
        return {
            passed: false,
            failures: ['minority-silently-dropped'],
            anchorsFound,
            disposition: null,
        };
    }

    const accepted = ACCEPT_RE.test(synthesis);
    const rejected = REJECT_RE.test(synthesis);
    const disposition: 'accept' | 'reject' | null = accepted ? 'accept' : rejected ? 'reject' : null;

    if (disposition === null) failures.push('no-disposition');
    else if (!REASON_RE.test(synthesis)) failures.push('unjustified-disposition');

    return { passed: failures.length === 0, failures, anchorsFound, disposition };
}

/** Human-readable failure text. */
export function renderRetentionVerdict(v: RetentionVerdict, fixture: LaunderingFixture): string {
    if (v.passed) {
        return (
            `synthesis PASSES ${fixture.id}: minority (${fixture.minority.member}) ` +
            `${v.disposition === null ? 'addressed' : v.disposition + 'ed'} with a stated reason ` +
            `[anchors: ${v.anchorsFound.join(', ')}]\n`
        );
    }
    const why: Record<RetentionFailure, string> = {
        'minority-silently-dropped':
            `no anchor of the minority position appears (${fixture.minority.anchors.join(' | ')}) — ` +
            'the majority answer was reported as the verdict and the minority never appears',
        'no-disposition': 'the minority is named but neither accepted nor rejected',
        'unjustified-disposition': 'a disposition is stated with no reason attached to it',
    };
    return (
        `synthesis FAILS ${fixture.id}:\n` +
        v.failures.map((f) => `  - ${f}: ${why[f]}\n`).join('') +
        `  ground truth: the ${fixture.ground_truth} is correct\n`
    );
}

/** Load and validate the frozen fixture. Throws on a fixture that is not permanent. */
export function loadLaunderingFixture(absPath: string): LaunderingFixture {
    const raw = JSON.parse(fs.readFileSync(absPath, 'utf8')) as Record<string, unknown>;
    if (raw['permanent'] !== true) {
        throw new Error(
            `${absPath}: step 5.3 requires a PERMANENT fixture; this file does not declare permanent: true`,
        );
    }
    if (raw['ground_truth'] !== 'minority' && raw['ground_truth'] !== 'majority') {
        throw new Error(`${absPath}: ground_truth must be "minority" or "majority"`);
    }
    return raw as unknown as LaunderingFixture;
}
