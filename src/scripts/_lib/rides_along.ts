/**
 * What rides along during a mission — `road-to-adversarial-verification-and-long-runs`
 * 6.1.
 *
 * `active-remediation`'s ladder is fix-now / note+ask / follow-up PR, and its
 * middle rung is unavailable inside an autonomous mission: there is nobody to
 * ask. Without a replacement the rung collapses in one of two bad directions —
 * every spotted issue becomes a fix (scope creep, which `minimal-safe-diff`
 * exists to stop) or every one becomes silence (which `active-remediation`
 * exists to stop). So under a mission the middle rung becomes **emit a follow-up
 * artefact**, and this module decides which rung a candidate lands on.
 *
 * **Six criteria, ALL of which must hold.** They are `AND`-ed rather than scored
 * because a scored version lets a large change buy its way in with four cheap
 * yeses, which is the shape that turns a boy-scout rule into a refactor licence.
 *
 * Pure: the caller characterises the change, this decides. The characterisation
 * is a judgement and stays the agent's; the DECISION is mechanical so it is the
 * same for the same inputs.
 */

/** What the agent observed about a candidate improvement. */
export interface Candidate {
    /** What it is. Used only in the rendered line. */
    readonly what: string;
    /** In the same request path / module the mission is already touching. */
    readonly local: boolean;
    /** Small: roughly a handful of lines in one production file. */
    readonly small: boolean;
    /** Low blast radius — nothing outside this module observes the change. */
    readonly lowBlastRadius: boolean;
    /** Clearly correct: a reviewer would not need to be persuaded. */
    readonly clearlyCorrect: boolean;
    /** Testable, and the test ships in the same commit. */
    readonly testable: boolean;
    /** Carries NO new product decision — nothing about what the thing should do. */
    readonly noProductDecision: boolean;
}

/** The kinds of improvement a mission may take at all. */
export const RIDE_ALONG_KINDS: readonly string[] = [
    'characterization-test',
    'regression-test',
    'small-adjacent-bug',
    'naming',
    'types',
    'robustness',
    'local-dead-code',
    'simplify-touched-code',
    'testability',
] as const;

export type Disposition = 'ride-along' | 'follow-up-artefact';

export interface Verdict {
    readonly disposition: Disposition;
    /** Every criterion that failed, in declaration order. Empty on ride-along. */
    readonly failed: readonly string[];
}

const CRITERIA: readonly (readonly [keyof Candidate, string])[] = [
    ['local', 'not local to the path this mission is already touching'],
    ['small', 'not small — more than a handful of lines in one file'],
    ['lowBlastRadius', 'blast radius reaches beyond this module'],
    ['clearlyCorrect', 'not clearly correct — a reviewer would need persuading'],
    ['testable', 'not testable in the same commit'],
    ['noProductDecision', 'carries a new product decision'],
];

/**
 * Which rung this candidate lands on.
 *
 * Returns EVERY failed criterion rather than the first, because the follow-up
 * artefact has to say why the change was deferred, and "it failed one of six"
 * is not a reason a later reader can act on.
 */
export function disposition(c: Candidate): Verdict {
    const failed = CRITERIA.filter(([k]) => c[k] !== true).map(([, why]) => why);
    return {
        disposition: failed.length === 0 ? 'ride-along' : 'follow-up-artefact',
        failed,
    };
}

/**
 * The follow-up artefact's body — what was seen, and why it did not ride along.
 *
 * A deferral with no reason is the note-and-forget `active-remediation` already
 * forbids, one layer out: the artefact exists so the issue is still owed, and an
 * artefact that does not say why it was deferred cannot be triaged later.
 */
export function followUpBody(c: Candidate, v: Verdict): string {
    if (v.disposition === 'ride-along') return '';
    return [
        `Deferred adjacent improvement: ${c.what}`,
        '',
        'Did not ride along because:',
        ...v.failed.map((f) => `  - ${f}`),
        '',
        'Spotted during a mission; the code was left alone deliberately.',
    ].join('\n');
}
