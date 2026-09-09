/**
 * The ratification artifact — ADR-268 § 4's control, in one reader.
 *
 * ADR-268 § 4 permits an agent to edit kernel rules, governance hooks and
 * authority schemas inside an authorised mission, and forbids it to ratify its
 * own increase in power:
 *
 * ```
 * AN AGENT MAY MODIFY ITS CONSTITUTION. IT MAY NOT RATIFY ITS OWN INCREASE IN POWER.
 * THE PARTY GAINING THE AUTHORITY IS NEVER THE PARTY RECORDING THE RATIFICATION.
 * PROVIDER DIVERSITY IS REQUIRED WHERE TWO PROVIDERS ARE CONFIGURED.
 * ```
 *
 * That sentence is the whole reason this module exists as a pure reader with
 * no filesystem and no network: the gate that reds a PR
 * (`check_kernel_edit_ratified`) and the tests that prove it reds must decide
 * from the same code, or the fixture proves a second implementation rather
 * than the shipped one.
 *
 * Why `reviewed_by` is checked against BOTH producer fields.
 * `road-to-typed-grants-that-persist` Phase 5.1 names one fixture — an
 * artifact whose `proposed_by` equals its `reviewed_by` is rejected. The Iron
 * Law above is broader than that fixture: the party gaining the authority is
 * the party that proposed the expansion AND the party that implemented it, and
 * an artifact reviewed by its own implementer is the same defect wearing the
 * other field's name. Both are rejected, and this paragraph is why the code is
 * wider than the step that asked for it.
 *
 * What this module does NOT decide: whether a diff is authority-EXPANDING.
 * That is a judgement over rule prose, not a property of the artifact, and
 * ADR-268 § 4 makes the artifact required for the expanding case only.
 * `check_kernel_edit_ratified` requires the artifact for every kernel-rule
 * diff instead — a strictly stronger and decidable rule — and says so in its
 * own header rather than pretending to classify.
 */

import { readAdrFrontmatter, type AdrFrontmatter } from './adr_frontmatter.js';

/** Where a ratification artifact lives. One directory, so the gate can find it. */
export const RATIFICATION_DIR = 'agents/evidence/ratifications';

/**
 * The verdict vocabulary — closed, because an open one is a free-text field
 * that always reads as approval to a grep.
 */
export const RATIFICATION_VERDICTS = [
    'ratified',
    'confirmed-non-expanding',
    'refused',
    'non-convergent',
] as const;
export type RatificationVerdict = (typeof RATIFICATION_VERDICTS)[number];

/**
 * The two verdicts that let a diff land.
 *
 * `confirmed-non-expanding` exists because the gate demands an artifact for
 * EVERY kernel and governance-hook diff, including a typo fix. Calling that a
 * ratification of an authority expansion would be false, and a vocabulary that
 * forces a false label is a vocabulary people route around. Adopted from the
 * round-1 review, which named the pressure this relieves.
 */
export const PASSING_VERDICTS: ReadonlySet<string> = new Set([
    'ratified',
    'confirmed-non-expanding',
]);

/** The six fields Phase 5.1 names, all required. */
export const RATIFICATION_FIELDS = [
    'proposed_by',
    'implemented_by',
    'reviewed_by',
    'providers',
    'verdict',
    'effective_after',
] as const;

export interface RatificationArtifact {
    proposed_by: string;
    implemented_by: string;
    reviewed_by: string;
    /** Provider ids consulted, in source order. Diversity is counted over this. */
    providers: string[];
    verdict: RatificationVerdict;
    /** `merge`, or an ISO-8601 instant. Never a bare "later". */
    effective_after: string;
}

export interface RatificationProblem {
    /** Stable code, so a test asserts the reason rather than the wording. */
    code:
        | 'no-frontmatter'
        | 'missing-field'
        | 'unknown-verdict'
        | 'self-ratified'
        | 'no-providers'
        | 'diversity-required'
        | 'diversity-unverifiable'
        | 'bad-effective-after';
    message: string;
}

export interface RatificationReading {
    artifact: RatificationArtifact | null;
    problems: RatificationProblem[];
}

/** `merge`, or an ISO-8601 instant with a timezone. */
const EFFECTIVE_AFTER_RE =
    /^(merge|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))$/;

function scalarOf(fm: AdrFrontmatter, key: string): string | null {
    const raw = fm.scalars[key];
    if (typeof raw !== 'string') {
        return null;
    }
    const trimmed = raw.trim();
    return trimmed === '' ? null : trimmed;
}

/**
 * Read `providers` in either shape the frontmatter parser can produce — a YAML
 * list (nested) or an inline `[a, b]` scalar. Accepting both is not laxity:
 * the ADR frontmatter corpus already carries both shapes for `basis`, and a
 * reader that took only one would reject a correctly-authored artifact.
 */
export function readProviders(fm: AdrFrontmatter): string[] {
    const nested = fm.nested['providers'];
    if (Array.isArray(nested)) {
        return nested.map((p) => String(p).trim()).filter((p) => p !== '');
    }
    const scalar = scalarOf(fm, 'providers');
    if (scalar === null) {
        return [];
    }
    return scalar
        .replace(/^\[|\]$/g, '')
        .split(',')
        .map((p) => p.trim().replace(/^["']|["']$/g, ''))
        .filter((p) => p !== '');
}

/**
 * Validate one artifact's text.
 *
 * `configuredProviders` is the count `agent-config council:status` reports.
 * Pass `null` when it could not be established — the diversity rule then does
 * not fire, and the caller says so, because an unmeasured count is not
 * evidence that diversity was unavailable.
 */
export function readRatification(
    text: string,
    configuredProviders: number | null,
): RatificationReading {
    const problems: RatificationProblem[] = [];
    const fm = readAdrFrontmatter(text);
    if (fm === null) {
        return {
            artifact: null,
            problems: [{ code: 'no-frontmatter', message: 'no YAML frontmatter block' }],
        };
    }

    const providers = readProviders(fm);
    const values: Record<string, string | null> = {};
    for (const field of RATIFICATION_FIELDS) {
        if (field === 'providers') {
            continue;
        }
        values[field] = scalarOf(fm, field);
        if (values[field] === null) {
            problems.push({ code: 'missing-field', message: `missing or empty \`${field}:\`` });
        }
    }
    if (providers.length === 0) {
        problems.push({ code: 'no-providers', message: 'missing or empty `providers:`' });
    }

    const verdict = values['verdict'] ?? null;
    if (verdict !== null && !(RATIFICATION_VERDICTS as readonly string[]).includes(verdict)) {
        problems.push({
            code: 'unknown-verdict',
            message: `verdict \`${verdict}\` is not one of ${RATIFICATION_VERDICTS.join(', ')}`,
        });
    }

    const effective = values['effective_after'] ?? null;
    if (effective !== null && !EFFECTIVE_AFTER_RE.test(effective)) {
        problems.push({
            code: 'bad-effective-after',
            message: `effective_after \`${effective}\` is neither \`merge\` nor an ISO-8601 instant`,
        });
    }

    // The Iron Law. Checked against both producer fields — see the header.
    const reviewer = values['reviewed_by'];
    if (reviewer !== null) {
        for (const producerField of ['proposed_by', 'implemented_by'] as const) {
            const producer = values[producerField];
            if (producer !== null && producer === reviewer) {
                problems.push({
                    code: 'self-ratified',
                    message:
                        `\`${producerField}\` equals \`reviewed_by\` (${reviewer}) — ` +
                        'the party gaining the authority may not record the ratification (ADR-268 section 4)',
                });
            }
        }
    }

    // Diversity, against the REQUIRED count.
    //
    // Round 1 refused the previous shape: the count came from the user-global
    // council config, which is absent on a CI runner, so the rule silently did
    // not fire there. `null` now means the required count could not be
    // established, and that is a REFUSAL rather than a skip — a control that
    // passes when it cannot measure is advisory.
    if (configuredProviders === null) {
        problems.push({
            code: 'diversity-unverifiable',
            message:
                'the required provider count could not be read, so diversity is unverifiable — ' +
                'a control that cannot measure fails closed (src/config/ratification-policy.json)',
        });
    } else if (configuredProviders >= 2) {
        const distinct = new Set(providers);
        if (distinct.size < configuredProviders) {
            problems.push({
                code: 'diversity-required',
                message:
                    `${configuredProviders} distinct providers are required; ` +
                    `the artifact names ${distinct.size} (${providers.join(', ') || 'none'})`,
            });
        }
    }

    if (problems.length > 0) {
        return { artifact: null, problems };
    }

    return {
        artifact: {
            proposed_by: values['proposed_by'] as string,
            implemented_by: values['implemented_by'] as string,
            reviewed_by: reviewer as string,
            providers,
            verdict: verdict as RatificationVerdict,
            effective_after: effective as string,
        },
        problems: [],
    };
}

/** True when the artifact parses and carries a verdict that lets the diff land. */
export function isRatified(reading: RatificationReading): boolean {
    return reading.artifact !== null && PASSING_VERDICTS.has(reading.artifact.verdict);
}

/**
 * The required distinct-provider count, from the repository's own policy file.
 *
 * Returns `null` when the file is missing or unparseable, and the caller turns
 * that into a refusal — never a skip. Reading the policy from the repository
 * rather than from the user-global council config is the round-1 fix: a runner
 * has the repository and does not have the operator's home directory.
 */
export function readRequiredProviders(policyText: string | null): number | null {
    if (policyText === null) {
        return null;
    }
    try {
        const parsed = JSON.parse(policyText) as { required_providers?: unknown };
        const n = parsed.required_providers;
        return typeof n === 'number' && Number.isInteger(n) && n >= 1 ? n : null;
    } catch {
        return null;
    }
}
