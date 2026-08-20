/**
 * The one matcher for a roadmap's `## Acceptance criteria` heading.
 *
 * It lives here because the same defect has now been found three times, in
 * three separately-authored copies of this regex:
 *
 * 1. `dispatch_r2_reviewer.extractAcceptanceCriteria` was case-sensitive, so
 *    `## Acceptance criteria` extracted nothing (zcs-close R2 review, 2026-08-09).
 * 2. The same function was end-anchored, so a heading carrying a qualifier —
 *    `## Acceptance criteria (per phase, on promotion to ready)` — extracted
 *    nothing (measured 2026-08-18).
 * 3. `lint_plan_risk_register.extractFeatures` carried BOTH faults after the
 *    other two were fixed, so the substantial-change heuristic hashed the empty
 *    string for eight of the thirty-two ready roadmaps — including the roadmap
 *    that repaired it. Any edit to those roadmaps' criteria was invisible to the
 *    gate, which is the silent half of the failure: the gate still exited 0.
 *
 * Two copies drift. Three copies drift twice. The predicate is a shared constant
 * so the next author cannot fix one call site and leave another blind.
 *
 * `\b` after `criteria` is the deliberate near-miss guard: `## Acceptance
 * criteriaXYZ` is a different heading and must not match. It is asserted from
 * both directions in `tests/scripts/lint_plan_risk_register.test.ts`.
 */
export const AC_HEADING_RE = /^##\s+acceptance criteria\b/i;

/** True when `line` is a roadmap's acceptance-criteria section heading. */
export function isAcceptanceCriteriaHeading(line: string): boolean {
    return AC_HEADING_RE.test(line);
}
