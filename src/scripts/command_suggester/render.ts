/**
 * Render ranked matches as a numbered-options block.
 *
 * TypeScript twin of `src/scripts/command_suggester/render.py`
 * (ADR-096 py2ts).
 *
 * Output strictly conforms to `user-interaction` Iron Law:
 *  - Every option is one numbered line.
 *  - Options block stays neutral (no inline `(recommended)` tag).
 *  - Exactly one `Recommendation: N — …` line follows the block.
 *  - The last numbered option is the as-is escape hatch — always
 *    present, no exceptions.
 *
 * The renderer is purely structural — it does not pick a recommendation
 * based on free judgment. The first match (highest score, most
 * specific evidence) becomes the recommendation; ties leave the line
 * out so the agent doesn't fabricate a tie-break the user didn't ask
 * for.
 */

import { CommandSpec, Match } from './types.js';

export const AS_IS_LABEL = 'Just run the prompt as-is, no command';

/**
 * Python `len(s)` / slicing on a `str` operate on Unicode code points.
 * `[...s]` iterates by code point, so an array of code points + join
 * reproduces `len(s)` and `s[:n]` exactly for any character (BMP or
 * astral). Description trimming uses both, so we match it precisely.
 */
function _pyCodePoints(s: string): string[] {
    return Array.from(s);
}

/**
 * Return the numbered-options block as plain markdown text.
 *
 * Empty `matches` ⇒ empty string. The rule never emits anything
 * when nothing crossed the floor.
 */
export function render(
    matches: Match[],
    specs_by_name: Map<string, CommandSpec> | ReadonlyMap<string, CommandSpec>,
    options: { as_is_label?: string } = {},
): string {
    const as_is_label = options.as_is_label ?? AS_IS_LABEL;
    if (!matches.length) {
        return '';
    }
    const lines: string[] = [];
    for (let idx = 0; idx < matches.length; idx += 1) {
        const m = matches[idx]!;
        const i = idx + 1;
        const spec = specs_by_name.get(m.command);
        let desc = spec && spec.description ? spec.description : '';
        // Trim long descriptions for one-line option labels.
        const cps = _pyCodePoints(desc);
        if (cps.length > 120) {
            // Python: desc[:117].rstrip() + "..."
            desc = `${_pyRstrip(cps.slice(0, 117).join(''))}...`;
        }
        const slash = `/${m.command}`;
        if (desc) {
            lines.push(`> ${i}. ${slash} — ${desc}`);
        } else {
            lines.push(`> ${i}. ${slash}`);
        }
    }
    const as_is_index = matches.length + 1;
    lines.push(`> ${as_is_index}. ${as_is_label}`);
    const block = lines.join('\n');
    const rec_line = _recommendation_line(matches, specs_by_name);
    if (rec_line) {
        return `${block}\n\n${rec_line}`;
    }
    return block;
}

/**
 * Mirror of Python `str.rstrip()` with no args — strips trailing
 * Unicode whitespace.
 */
function _pyRstrip(s: string): string {
    return s.replace(/\s+$/u, '');
}

/**
 * Single-source recommendation per `user-interaction` Iron Law.
 *
 * No recommendation when the top two matches are within 0.05 of
 * each other — surfacing a winner there would be fabrication.
 */
function _recommendation_line(
    matches: Match[],
    specs_by_name: Map<string, CommandSpec> | ReadonlyMap<string, CommandSpec>,
): string {
    if (!matches.length) {
        return '';
    }
    if (matches.length >= 2 && (matches[0]!.score - matches[1]!.score) < 0.05) {
        return '';
    }
    const top = matches[0]!;
    const spec = specs_by_name.get(top.command) ?? null;
    const name = top.command;
    const rationale = _rationale_for(top, spec);
    return `**Recommendation: 1 — /${name}** — ${rationale}`;
}

function _rationale_for(match: Match, spec: CommandSpec | null): string {
    // `spec` is unused (mirrors the Python signature, which also ignores it).
    void spec;
    let why: string;
    if (match.matched_trigger === 'both') {
        why = `both the request and context match (\`${match.evidence}\`)`;
    } else if (match.matched_trigger === 'description') {
        why = `the request matches its trigger description (\`${match.evidence}\`)`;
    } else {
        why = `the surrounding context matches its trigger (\`${match.evidence}\`)`;
    }
    return `${why}. Pick the last option to skip the command and run the prompt as written.`;
}
