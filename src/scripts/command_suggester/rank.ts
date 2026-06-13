/**
 * Rank scored matches into the final candidate list.
 *
 * TypeScript twin of `src/scripts/command_suggester/rank.py`
 * (ADR-094 py2ts).
 *
 * Pipeline:
 * 1. Drop commands whose name is in `settings.blocklist`.
 * 2. Drop matches below the effective `confidence_floor` (per-command
 *    override if set, else global).
 * 3. Anti-noise:
 *    - vague-input suppression (short message + many candidates, no structural bonus)
 *    - lonely-band suppression (single match below `floor + 0.1`, no structural bonus)
 *    - continuation suppression (message is pure follow-through, no new intent)
 * 4. Sort by score desc; tie-break:
 *    - structural bonus wins (named entities outrank generic verbs)
 *    - longer matched evidence wins (more specific trigger)
 *    - alphabetic command name wins (stable, deterministic)
 * 5. Cap at `settings.max_options`.
 */

import { CommandSpec, Match, Settings } from './types.js';

const _LONELY_BAND = 0.1; // roadmap Phase 4: floor + 0.1 lonely-match threshold

const _CONTINUATION_PHRASES: ReadonlySet<string> = new Set([
    // English
    'ok', 'okay', 'yes', 'no', 'sure', 'go', 'do it', 'go on',
    'continue', 'next', 'proceed', 'more', 'again',
    // German
    'ja', 'nein', 'weiter', 'mach weiter', 'los', 'machen',
    'weitermachen', 'fortfahren', 'nochmal',
]);

function _floor_for(
    name: string,
    specs_by_name: Map<string, CommandSpec> | ReadonlyMap<string, CommandSpec>,
    settings: Settings,
): number {
    const spec = specs_by_name.get(name);
    if (spec && spec.confidence_floor !== null) {
        return spec.confidence_floor;
    }
    return settings.confidence_floor;
}

/**
 * Short prompts hitting many commands are usually too ambiguous.
 *
 * Suppress when:
 *  - message has < 6 words
 *  - more than 2 matches survived the floor
 *  - none of the matches carry a structural bonus (ticket key, path)
 *
 * A structural bonus means the prompt was specific even if short
 * — `"setze ABC-123 um"` is 3 words but unambiguous.
 */
function _vague_input_suppression(message: string, matches: Match[]): boolean {
    const word_count = _pySplitLen(message);
    if (word_count >= 6 || matches.length <= 2) {
        return false;
    }
    return !matches.some((m) => m.has_structural_bonus);
}

/**
 * Python `str.split()` (no args) splits on runs of whitespace and
 * drops empty leading/trailing tokens. `len(message.split())` is the
 * whitespace-delimited word count.
 */
function _pySplitLen(message: string): number {
    const trimmed = message.trim();
    if (trimmed === '') {
        return 0;
    }
    return trimmed.split(/\s+/).length;
}

/**
 * Single match whose score sits within `floor + _LONELY_BAND`.
 *
 * Roadmap Phase 4 sets this band at 0.1 — a single signal that
 * barely clears the floor is too uncertain to interrupt for. A
 * structural bonus (ticket key, path) overrides the suppression
 * because the match is already grounded in a specific entity.
 */
function _sub_floor_lonely_suppression(matches: Match[], floor: number): boolean {
    if (matches.length !== 1) {
        return false;
    }
    const only = matches[0]!;
    if (only.has_structural_bonus) {
        return false;
    }
    return only.score < floor + _LONELY_BAND;
}

/**
 * Pure follow-through messages carry no new intent — suppress.
 *
 * Triggers when the message reduces to a known continuation phrase
 * (`ok`, `weiter`, `mach weiter`, …) once trailing punctuation is
 * stripped. A structural bonus (ticket key, path) overrides — even
 * `"weiter mit ABC-123"` is a fresh intent signal.
 */
function _continuation_suppression(message: string, matches: Match[]): boolean {
    const stripped = _normalizeContinuation(message);
    if (!stripped) {
        return false;
    }
    if (!_CONTINUATION_PHRASES.has(stripped)) {
        return false;
    }
    return !matches.some((m) => m.has_structural_bonus);
}

/**
 * Mirror of `re.sub(r"[\s\W_]+", " ", message, flags=re.UNICODE)
 * .strip().lower()`.
 *
 * Python's `\W` under `re.UNICODE` (the default in Py3) is
 * "not a Unicode word character" — i.e. anything not a letter, digit,
 * or underscore in any script. Together with `\s` and `_` the class
 * collapses every run of non-alphanumeric (across scripts) plus
 * underscores into a single space. We reproduce that with the `u`
 * flag and a Unicode property escape so non-ASCII letters/digits are
 * preserved exactly as Python keeps them.
 */
function _normalizeContinuation(message: string): string {
    const s = message || '';
    // [^...] = the complement of (Unicode letter | Unicode number).
    // This equals "[\s\W_]+" because \w (with _) = letter|number|_, so
    // its complement (\W) ∪ \s ∪ _ collapses to "anything that is not a
    // letter and not a number".
    const collapsed = s.replace(/[^\p{L}\p{N}]+/gu, ' ');
    return collapsed.trim().toLowerCase();
}

function _tie_break_key(m: Match): [number, number, number, string] {
    // Score desc, structural bonus first, longer evidence first, alpha last.
    return [-m.score, m.has_structural_bonus ? 0 : 1, -m.evidence.length, m.command];
}

export function rank(
    matches: Iterable<Match>,
    settings: Settings,
    specs_by_name: Map<string, CommandSpec> | ReadonlyMap<string, CommandSpec>,
    options: { raw_message?: string } = {},
): Match[] {
    const raw_message = options.raw_message ?? '';
    if (!settings.enabled) {
        return [];
    }
    const blocked = new Set(settings.blocklist);
    const candidates: Match[] = [];
    for (const m of matches) {
        if (!blocked.has(m.command)) {
            candidates.push(m);
        }
    }
    const above_floor: Match[] = candidates.filter(
        (m) => m.score >= _floor_for(m.command, specs_by_name, settings),
    );
    if (_continuation_suppression(raw_message, above_floor)) {
        return [];
    }
    if (_vague_input_suppression(raw_message, above_floor)) {
        return [];
    }
    if (_sub_floor_lonely_suppression(above_floor, settings.confidence_floor)) {
        return [];
    }
    above_floor.sort((a, b) => _compareKeys(_tie_break_key(a), _tie_break_key(b)));
    if (settings.max_options > 0) {
        return above_floor.slice(0, settings.max_options);
    }
    return above_floor;
}

/** Lexicographic comparison of a (number, number, number, string) tuple. */
function _compareKeys(
    a: [number, number, number, string],
    b: [number, number, number, string],
): number {
    if (a[0] !== b[0]) {
        return a[0] - b[0];
    }
    if (a[1] !== b[1]) {
        return a[1] - b[1];
    }
    if (a[2] !== b[2]) {
        return a[2] - b[2];
    }
    if (a[3] < b[3]) {
        return -1;
    }
    if (a[3] > b[3]) {
        return 1;
    }
    return 0;
}
