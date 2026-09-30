/**
 * Placing a new component inside the taxonomy a project already chose.
 *
 * Leaf module — no intra-`work_engine` imports beyond its sibling detector's
 * `NO_TAXONOMY` constant. That one import does pull `node:fs` in transitively;
 * "stdlib-free" was the old wording here and it was simply wrong. Public API names stay snake_case to
 * mirror the sibling detectors 1:1, per ADR-200.
 *
 * The contract, and the reason it is this small: placement reads the RECORDED
 * tier list by name and conforms to whatever it holds. There is no table of
 * tier names here, no ordering, no per-tier rule, and no numeric budget keyed
 * to a tier — a component is placed when the brief names a tier the project
 * has, and is reported as a gap when it does not. Anything richer would be the
 * compiled-in taxonomy this suite refused to hard-code, arriving as an
 * implementation detail rather than as a decision.
 *
 * That is also why an unplaceable component is never quietly put somewhere
 * else. Choosing a tier for it would need exactly the per-tier rule the line
 * above rules out, so the honest output is a named gap the author resolves.
 *
 * With {@link NO_TAXONOMY} recorded — the value for a project that evidences
 * no taxonomy — every plan comes back empty and {@link conformance_lines}
 * returns nothing, so the authoring step's output is byte-identical to what it
 * was before this module existed. Holding to the project's own structures is
 * the standing rule; a project that organises its components some other way
 * must not be able to tell that this module shipped.
 */
import { NO_TAXONOMY } from './detect.js';

/** A component the design brief asks for. */
export interface ComponentRequest {
    /** The component's name, as the brief writes it. */
    name?: unknown;
    /** The granularity tier the brief assigns it, when it assigns one. */
    tier?: unknown;
}

/** Where one component lands, or why it could not be placed. */
export interface PlacementPlan {
    /** The component's name as read from the brief. */
    name: string;
    /** The project's own tier name it was matched to, or `null`. */
    tier: string | null;
    /** The directory it belongs in, or `null` when unplaced. */
    directory: string | null;
    /** Why it could not be placed, or `null` when it was. */
    gap: string | null;
}

/** Component root used when the audit recorded none. */
/**
 * Gap reported when a taxonomy is recorded without the root it lives under.
 *
 * Guessing `src/components` here is the same failure as placing a component in
 * a tier the project does not have, at the other end of the path: a project
 * rooted at `app/components` or `resources/js/components` — both of which the
 * detector searches — would have been handed a directory that does not exist,
 * with no gap and no warning. This module exists so nothing is placed
 * somewhere the project did not choose, so it says so instead.
 */
export const MISSING_ROOT_GAP =
    'the audit recorded a taxonomy but no `component_root`, so there is no ' +
    'directory to place into — re-run the audit, or record the root by hand';

/**
 * Plan where each requested component belongs under a recorded taxonomy.
 *
 * @param taxonomy The recorded `state.ui_audit.component_taxonomy` value —
 *   the project's own tiers joined with `/`, or {@link NO_TAXONOMY}.
 * @param component_root The recorded component root, relative to the project.
 * @param components The components the design brief asks for.
 */
export function plan_component_placement(
    taxonomy: string,
    component_root: string,
    components: ReadonlyArray<ComponentRequest>,
): PlacementPlan[] {
    const tiers = read_tiers(taxonomy);
    const root = _trim_slashes(component_root);
    return components.map((component) => {
        const name = _text(component.name) || '(unnamed)';
        if (tiers.length === 0) {
            return { name, tier: null, directory: null, gap: null };
        }
        if (root === '') {
            return { name, tier: null, directory: null, gap: `\`${name}\` — ${MISSING_ROOT_GAP}` };
        }
        const hint = _text(component.tier);
        if (hint === '') {
            return {
                name,
                tier: null,
                directory: null,
                gap:
                    `\`${name}\` names no granularity tier, and the project's ` +
                    `taxonomy \`${taxonomy}\` carries no rule that assigns one ` +
                    '— left unplaced for the author to decide',
            };
        }
        const matched = tiers.find((tier) => _normalise(tier) === _normalise(hint));
        if (matched === undefined) {
            return {
                name,
                tier: null,
                directory: null,
                gap:
                    `\`${name}\` declares tier \`${hint}\`, which the project's ` +
                    `taxonomy \`${taxonomy}\` does not contain — left unplaced ` +
                    'rather than moved somewhere the project did not choose',
            };
        }
        return { name, tier: matched, directory: `${root}/${matched}`, gap: null };
    });
}

/**
 * Split a recorded taxonomy value into the project's own tier names.
 *
 * **The sentinel comparison is case-insensitive, and that is not politeness.**
 * This field is written by an agent following `existing-ui-audit` § 1b, so
 * `'None'` is reachable, and an exact comparison let it through as a
 * one-element tier list: a project with no taxonomy then got a "conforming to
 * `None`" banner and a conformance gap per component — precisely the output
 * AC-2 forbids. It is the one guard standing between a no-taxonomy project and
 * a changed authoring step, so it refuses every spelling of the sentinel.
 */
export function read_tiers(taxonomy: string): string[] {
    const value = _text(taxonomy);
    if (value === '' || value.toLowerCase() === NO_TAXONOMY) {
        return [];
    }
    return value
        .split('/')
        .map((part) => part.trim())
        .filter((part) => part !== '');
}

/**
 * Render the lines the authoring step says out loud.
 *
 * Empty for {@link NO_TAXONOMY}, which is what keeps a no-taxonomy project's
 * output unchanged.
 */
export function conformance_lines(
    taxonomy: string,
    component_root: string,
    plans: ReadonlyArray<PlacementPlan>,
): string[] {
    if (read_tiers(taxonomy).length === 0) {
        return [];
    }
    const root = _trim_slashes(component_root);
    const under = root === '' ? 'an unrecorded component root' : `\`${root}/\``;
    const lines: string[] = [
        `> Conforming to the project's own component taxonomy ` +
            `\`${taxonomy}\` under ${under} — detected, not imposed. ` +
            'A component that fits no tier is reported, never relocated.',
    ];
    for (const plan of plans) {
        if (plan.gap === null && plan.directory !== null) {
            lines.push(
                `>   - \`${plan.name}\` → \`${plan.directory}/\` (tier \`${plan.tier}\`)`,
            );
        } else if (plan.gap !== null) {
            lines.push(`>   - conformance gap: ${plan.gap}`);
        }
    }
    return lines;
}

/** Lower-case and drop a trailing plural `s`, so `Molecule` matches `molecules`. */
function _normalise(name: string): string {
    const lower = name.trim().toLowerCase();
    return lower.endsWith('s') && lower.length > 2 ? lower.slice(0, -1) : lower;
}

function _text(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function _trim_slashes(value: unknown): string {
    return _text(value).replace(/^\/+|\/+$/gu, '');
}
