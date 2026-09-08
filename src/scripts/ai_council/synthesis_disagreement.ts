/**
 * Does a completed synthesis keep the disagreement it started with?
 *
 * Three elements have to survive into the final text, and a synthesis that
 * drops any of them has resolved the disagreement by not reporting it:
 *
 *   1. the unresolved disagreement itself — both sides, named;
 *   2. the strongest evidence the minority side actually offered;
 *   3. the observation that would settle it.
 *
 * Element 1 was already asked for by every lens template (`Clashes`,
 * `Conflicts`, `Outliers`, or the mandated divergence prose). Element 2 was
 * asked for by one. Element 3 was asked for by none, which is the gap
 * {@link RESOLVING_EVIDENCE_SECTION} closes.
 *
 * WHY A CHECKER AND NOT ONLY A TEMPLATE CLAUSE. A template is an instruction to
 * the host agent, and an instruction nobody can check is a hope. Both council
 * seats that reviewed this refused a prose-only build in as many words. So the
 * template carries the ask and this module makes the answer decidable: given a
 * completed synthesis, {@link auditSynthesisElements} reports which of the three
 * elements are present, by structure, without deciding whether their content is
 * any good.
 *
 * WHAT IT DECIDES, AND WHAT IT DOES NOT. Presence and shape. A synthesis that
 * names a clash, cites a minority exhibit and proposes a resolving measurement
 * PASSES even when the measurement is a bad one — grading that needs the
 * benchmark, and the benchmark has not run. This is the same honest scope the
 * sibling minority-retention audit states for itself, and for the same reason:
 * an audit that claimed to grade quality would be inventing the number.
 *
 * REPORT, NEVER THROW. Not every council pass produces dissent, and a synthesis
 * of a unanimous pass has no disagreement to retain. So the audit reports
 * `dissentPresent: false` and grades nothing, rather than failing a synthesis
 * for the absence of a thing that did not happen. A caller with independent
 * knowledge that the pass dissented passes {@link AuditOptions.dissentPresent}
 * and gets the full grading regardless of what the text looks like.
 *
 * Pure, offline, no model call.
 */

/** The three elements a dissenting synthesis has to carry. */
export type SynthesisElement =
    | 'unresolved-disagreement'
    | 'minority-evidence'
    | 'resolving-evidence';

export const SYNTHESIS_ELEMENTS: readonly SynthesisElement[] = Object.freeze([
    'unresolved-disagreement',
    'minority-evidence',
    'resolving-evidence',
]);

/**
 * The section every lens template now closes its disagreement reporting with.
 *
 * One section rather than two because elements 2 and 3 are both per-clash
 * follow-ups: splitting them would let a synthesis answer one clash's evidence
 * and another clash's resolution and still look complete.
 */
export const RESOLVING_EVIDENCE_SECTION = `### Resolving evidence
One line per unresolved disagreement above, in this shape:
\`<clash> — strongest minority evidence: <what the losing side actually
showed> · resolved by: <the observation that would settle it>\`.
Name a measurement, an artefact or a run — never a further opinion. Write
\`no resolving evidence identified — <why>\` when nothing observable would
settle it: an unanswerable disagreement is a finding, and silence is not.`;

/** Headings under which a lens reports an unresolved disagreement. */
const DISAGREEMENT_HEADINGS = ['Clashes', 'Conflicts', 'Outliers', 'Divergence'];

/** The heading element 3 lives under. */
export const RESOLVING_EVIDENCE_HEADING = 'Resolving evidence';

/** In-body markers the resolving-evidence section is asked to emit. */
const MINORITY_EVIDENCE_MARKER = /strongest minority evidence\s*:/i;
const RESOLVED_BY_MARKER = /resolved by\s*:/i;
const NO_RESOLVING_EVIDENCE_MARKER = /no resolving evidence identified\s*[—:-]/i;

/**
 * Text markers that say a pass dissented, used only when the caller does not
 * tell us. Deliberately narrow: a heading with a non-empty body, or an explicit
 * split verdict. A loose match here would grade unanimous syntheses.
 */
const SPLIT_VERDICT_MARKER = /^\s*\*{0,2}verdict\*{0,2}\s*:\s*split\b/im;

export interface ElementFinding {
    readonly element: SynthesisElement;
    readonly present: boolean;
    /** The heading or marker that satisfied it, or `null`. */
    readonly satisfiedBy: string | null;
}

export interface SynthesisElementAudit {
    /** Whether the pass had a disagreement to retain at all. */
    readonly dissentPresent: boolean;
    /** How `dissentPresent` was decided — `caller` or `text`. */
    readonly dissentSource: 'caller' | 'text';
    readonly elements: readonly ElementFinding[];
    readonly missing: readonly SynthesisElement[];
    /** True when a dissenting pass rendered all three. Always true with no dissent. */
    readonly complete: boolean;
}

export interface AuditOptions {
    /**
     * Override the text-derived dissent decision. Pass `true` when the run's own
     * tally recorded a split; pass `false` to grade nothing.
     */
    readonly dissentPresent?: boolean;
}

function _headingBody(text: string, heading: string): string | null {
    const lines = text.split('\n');
    const headingRe = new RegExp(`^#{2,4}\\s+${heading}\\s*$`, 'i');
    const idx = lines.findIndex((l) => headingRe.test(l));
    if (idx === -1) return null;
    let body = '';
    for (let i = idx + 1; i < lines.length; i++) {
        if (/^#{2,4}\s/.test(lines[i] as string)) break;
        body += (lines[i] as string) + '\n';
    }
    return body;
}

/** A heading with a non-empty, non-placeholder body. */
function _nonEmptySection(text: string, heading: string): boolean {
    const body = _headingBody(text, heading);
    if (body === null) return false;
    const stripped = body.replace(/^\s*[*_]*(none|n\/a|nothing)[.*_\s]*$/gim, '').trim();
    return stripped.length > 0;
}

/** Audit a COMPLETED synthesis — the host- or chairman-authored text. */
export function auditSynthesisElements(
    text: string,
    opts: AuditOptions = {},
): SynthesisElementAudit {
    const disagreementHeading =
        DISAGREEMENT_HEADINGS.find((h) => _nonEmptySection(text, h)) ?? null;

    const dissentSource: 'caller' | 'text' = opts.dissentPresent === undefined ? 'text' : 'caller';
    const dissentPresent =
        opts.dissentPresent ?? (disagreementHeading !== null || SPLIT_VERDICT_MARKER.test(text));

    const resolvingBody = _headingBody(text, RESOLVING_EVIDENCE_HEADING) ?? '';
    const declaredNone = NO_RESOLVING_EVIDENCE_MARKER.test(resolvingBody);

    const elements: ElementFinding[] = [
        {
            element: 'unresolved-disagreement',
            present: disagreementHeading !== null,
            satisfiedBy: disagreementHeading === null ? null : `### ${disagreementHeading}`,
        },
        {
            element: 'minority-evidence',
            present: MINORITY_EVIDENCE_MARKER.test(resolvingBody) || _nonEmptySection(text, 'Outliers'),
            satisfiedBy: MINORITY_EVIDENCE_MARKER.test(resolvingBody)
                ? 'strongest minority evidence:'
                : _nonEmptySection(text, 'Outliers')
                  ? '### Outliers'
                  : null,
        },
        {
            element: 'resolving-evidence',
            present: RESOLVED_BY_MARKER.test(resolvingBody) || declaredNone,
            satisfiedBy: RESOLVED_BY_MARKER.test(resolvingBody)
                ? 'resolved by:'
                : declaredNone
                  ? 'no resolving evidence identified'
                  : null,
        },
    ];

    const missing = dissentPresent
        ? elements.filter((e) => !e.present).map((e) => e.element)
        : [];

    return {
        dissentPresent,
        dissentSource,
        elements,
        missing,
        complete: missing.length === 0,
    };
}

/** Human-readable audit text. */
export function renderSynthesisElementAudit(a: SynthesisElementAudit): string {
    if (!a.dissentPresent) {
        return (
            'synthesis element audit: SKIPPED — no unresolved disagreement in this pass ' +
            `(decided from ${a.dissentSource}); there is nothing to retain\n`
        );
    }
    const rows = a.elements
        .map(
            (e) =>
                `  - ${e.element}: ${e.present ? 'present' : 'MISSING'}` +
                (e.satisfiedBy === null ? '' : ` [${e.satisfiedBy}]`),
        )
        .join('\n');
    const verdict = a.complete
        ? 'synthesis retains all three elements of the unresolved disagreement'
        : `synthesis DROPS ${a.missing.length} of 3 elements: ${a.missing.join(', ')}`;
    return `${verdict}\n${rows}\n`;
}
