/**
 * The guardrail watch over typed ops — `road-to-adversarial-verification-and-long-runs`
 * 7.1, observation-only floor.
 *
 * The eleven typed ops are the Hard Floor's own list: the irreversible and
 * externally-visible actions `non-destructive-by-default` gates. The layering is
 * forge protection → the host hook where one is bound → this watch → model
 * policy, and the watch exists because 7.2 measured the second layer and found
 * SEVEN of eight hosts carry no refusing `pre_tool_use` binding at all.
 *
 * **This mode observes and takes no action. That is a design decision with a
 * measured precondition, not caution.** K5 of the roadmap kills daemon
 * enforcement before the observation floor, and the roadmap's own Risk 3 states
 * the reason: a watchdog reading the reflog and shell history for typed ops can
 * misclassify, and its enforcing action is stopping the host process — one false
 * stop costs a twelve-hour run. So enforcement waits behind a measured
 * false-positive rate under 1 % on the 30-session corpus, and
 * {@link enforcementAllowed} refuses to unlock without that artefact.
 *
 * **What it can and cannot see, said plainly.** It reads lines — reflog entries,
 * exposed shell history, forge event payloads. A line is not an intention: an op
 * typed into a comment, a heredoc, or a string literal looks identical to one
 * about to run. That is precisely why the first mode only writes down what it
 * saw, and why the false-positive rate is the gate on doing anything more.
 *
 * Pure. The I/O — tailing a reflog, reading history, polling an event stream —
 * belongs to the caller, so every classification is testable offline.
 */

/** The typed-op classes this watch recognises. */
export const TYPED_OPS = [
    'push',
    'force-push',
    'merge-to-trunk',
    'tag-or-release',
    'deploy',
    'bulk-delete',
    'history-rewrite',
    'send',
    'publish',
    'purchase',
    'submit',
] as const;
export type TypedOp = (typeof TYPED_OPS)[number];

/** Where a line came from. Kept because the sources have different reliability. */
export type WatchSource = 'reflog' | 'shell-history' | 'forge-event';

export interface Observation {
    readonly op: TypedOp;
    readonly source: WatchSource;
    /** The line, truncated. Evidence, never re-executed. */
    readonly evidence: string;
}

/**
 * The recognisers, most specific first.
 *
 * ORDER MATTERS and is asserted by a test: `git push --force` is a force-push,
 * not a push, and a table walked in declaration order gives the specific class
 * only if it is declared before the general one. A misordered table would report
 * the milder op for the more dangerous line, which is the wrong direction for
 * every downstream reader.
 */
const RECOGNISERS: readonly (readonly [TypedOp, RegExp])[] = [
    ['force-push', /\bgit\b[^\n]*\bpush\b[^\n]*(--force\b|--force-with-lease\b|\s-f\b)/],
    ['history-rewrite', /\bgit\b[^\n]*\b(rebase|filter-repo|filter-branch)\b|\bgit\b[^\n]*reset\s+--hard\b/],
    ['merge-to-trunk', /\bgit\b[^\n]*\bmerge\b[^\n]*\b(main|master|trunk|production)\b|\bgh\b[^\n]*\bpr\b[^\n]*\bmerge\b/],
    ['tag-or-release', /\bgit\b[^\n]*\bpush\b[^\n]*\b--tags?\b|\bgh\b[^\n]*\brelease\b[^\n]*\bcreate\b/],
    ['deploy', /\b(terraform\s+apply|kubectl\s+apply|helm\s+(install|upgrade)|serverless\s+deploy)\b/],
    ['bulk-delete', /\brm\s+-[a-z]*r[a-z]*f\b|\bgit\b[^\n]*\brm\s+-r\b|\b(DROP\s+TABLE|TRUNCATE)\b/i],
    ['push', /\bgit\b[^\n]*\bpush\b/],
    ['purchase', /\b(stripe|checkout|charge|payment)\b[^\n]*\b(create|confirm|capture)\b/i],
    ['publish', /\bnpm\s+publish\b|\bgh\b[^\n]*\brelease\b[^\n]*\bupload\b/],
    ['send', /\b(sendmail|mail\s+-s|curl\b[^\n]*\/messages\b)/],
    ['submit', /\bcurl\b[^\n]*\s-X\s*POST\b[^\n]*\b(submit|apply|order)\b/i],
];

const EVIDENCE_MAX = 200;

/**
 * Classify one line, or `null` when nothing matched.
 *
 * Deliberately returns at most ONE op. A line is one action, and reporting two
 * classes for it would double-count in the false-positive denominator the
 * enforcement gate depends on.
 */
export function classifyLine(line: string, source: WatchSource): Observation | null {
    for (const [op, re] of RECOGNISERS) {
        if (re.test(line)) {
            return { op, source, evidence: line.trim().slice(0, EVIDENCE_MAX) };
        }
    }
    return null;
}

/** Classify a batch, preserving order and dropping non-matches. */
export function observe(
    lines: readonly string[],
    source: WatchSource,
): Observation[] {
    return lines
        .map((l) => classifyLine(l, source))
        .filter((o): o is Observation => o !== null);
}

/** The two modes. There is no third, and `enforce` is gated. */
export type WatchMode = 'observe' | 'enforce';

/** The false-positive measurement the enforcing mode waits behind. */
export interface FalsePositiveMeasurement {
    /** Sessions the corpus covered. The roadmap names 30. */
    readonly sessions: number;
    readonly observations: number;
    readonly falsePositives: number;
    /** Where the artefact lives, so the claim is checkable. */
    readonly artefact: string;
}

/** The corpus size the roadmap fixed before any measurement was taken. */
export const REQUIRED_SESSIONS = 30;
/** The rate enforcement waits behind. */
export const MAX_FALSE_POSITIVE_RATE = 0.01;

export interface EnforcementVerdict {
    readonly allowed: boolean;
    readonly reason: string;
}

/**
 * May the enforcing mode be enabled?
 *
 * `null` — no measurement at all — is a refusal with its own reason, never a
 * pass. A gate that unlocks when it cannot measure is the shape this whole
 * roadmap is written against, and it is the one an absent-artefact check gets
 * wrong by default.
 */
export function enforcementAllowed(
    m: FalsePositiveMeasurement | null,
): EnforcementVerdict {
    if (m === null) {
        return {
            allowed: false,
            reason:
                'no false-positive measurement exists. Enforcement stops the host process; a ' +
                'rate nobody measured is not a control (K5).',
        };
    }
    if (m.sessions < REQUIRED_SESSIONS) {
        return {
            allowed: false,
            reason: `measured over ${String(m.sessions)} session(s), below the ${String(REQUIRED_SESSIONS)} the corpus was fixed at`,
        };
    }
    if (m.observations === 0) {
        return {
            allowed: false,
            reason:
                'zero observations: a rate over an empty denominator is not a measurement, ' +
                'and it is the reading a broken recogniser produces',
        };
    }
    const rate = m.falsePositives / m.observations;
    if (rate >= MAX_FALSE_POSITIVE_RATE) {
        return {
            allowed: false,
            reason: `false-positive rate ${rate.toFixed(4)} is not below ${String(MAX_FALSE_POSITIVE_RATE)}`,
        };
    }
    return { allowed: true, reason: `rate ${rate.toFixed(4)} over ${String(m.observations)} observations in ${m.artefact}` };
}

/**
 * What the watch does with an observation, per mode.
 *
 * In `observe` the action is always `record` — there is no branch that acts, so
 * no configuration flips this mode into one that does.
 */
export function actionFor(
    mode: WatchMode,
    measurement: FalsePositiveMeasurement | null,
): 'record' | 'record-and-ask' {
    if (mode === 'observe') return 'record';
    return enforcementAllowed(measurement).allowed ? 'record-and-ask' : 'record';
}
