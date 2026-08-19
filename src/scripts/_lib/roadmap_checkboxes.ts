/**
 * The checkbox vocabulary and the phase-span rule, in one place.
 *
 * R2 review, findings 11 and 15. Two scanners on the autonomous-run path —
 * `run_checkpoint.countRoadmap` and `run_continuation_hook.scanOpenSteps` —
 * each carried their own narrower regex and each scanned the WHOLE file, while
 * both docblocks claimed the dashboard's vocabulary. Two consequences, and
 * they pull in opposite directions:
 *
 *   - NARROWER VOCABULARY under-counts. Only `-` bullets and a lowercase `x`
 *     matched, so a roadmap authored with `*` bullets or `[X]` read
 *     `open === 0` and `run_supervise.classify` reported disposition
 *     `complete` — "the run finished, the session just never said so" — for a
 *     run with real open work. That is the exact confusion the watcher exists
 *     to remove.
 *   - WHOLE-FILE SCANNING over-counts. The dashboard attributes checkboxes to
 *     `## Phase` spans; these did not. On the very roadmap under review every
 *     phase step is closed and the only `- [ ]` sits under `## Acceptance criteria`, so
 *     the continuation would have named "A killed session resumes via the
 *     watcher…" as the next step — an observation of a live multi-day run, not
 *     an executable step, and by construction with no `verify:` line. Steps
 *     under `## Blockers` and `## Risk Register` are the same shape.
 *
 * The vocabulary is deliberately the dashboard's, character for character:
 * where an autonomous run and the dashboard disagree about whether a roadmap
 * is finished, the disagreement is the defect.
 */

/** Bullet `-` or `*`, mark ` `, `x`, `X`, `~` or `-`; body captured. */
export const CHECKBOX_LINE = /^[ \t]*[-*][ \t]+\[([ xX~-])\][ \t]+(.*)$/;

/** H2/H3 heading, its text captured. */
const HEADING = /^(#{2,3})[ \t]+(.*?)[ \t]*$/;

/** An H2/H3 that opens a phase span, matching the dashboard's PHASE_RE shape. */
const PHASE_HEADING = /^Phase[ \t]+(?:\d+(?:\.\d+)*[a-z]?|[IVX]+|[A-Z](?:\d+)?)\b/;

/**
 * The lines of `text` that sit inside a `## Phase …` span.
 *
 * A phase span runs from its heading to the next H2/H3 of any kind, so
 * `## Blockers`, `## Acceptance criteria` and `## Risk Register` close it rather than
 * being absorbed into the phase above them.
 *
 * A roadmap with NO phase heading at all yields every line. That is the
 * deliberate choice and it is the safe direction: an unphased roadmap is a
 * legitimate shape, and returning nothing for it would make every such run
 * read as `complete`, which is the more dangerous of the two errors.
 */
export function phaseLines(text: string): string[] {
    const lines = text.split('\n');
    const out: string[] = [];
    let inPhase = false;
    let sawPhase = false;
    for (const line of lines) {
        const h = HEADING.exec(line);
        if (h !== null) {
            inPhase = PHASE_HEADING.test(h[2] ?? '');
            if (inPhase) sawPhase = true;
            continue;
        }
        if (inPhase) out.push(line);
    }
    return sawPhase ? out : lines;
}
