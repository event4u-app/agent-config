import type { Verdict } from '../language_mirror_hook.js';

/**
 * The language a pin obliges the reply to, or `und` when the pin was not set
 * by owner prose (road-to-a-language-pin-from-owner-prose, D1). A locale pin
 * reflects the machine, and a prompt pin with `owner_prose_chars: 0` has no
 * typed text behind it; refusing a reply on either refuses the owner for
 * something they never wrote. A present `owner_prose_chars` that is not a
 * positive integer is malformed and obliges nothing either. Only a pin missing
 * BOTH fields, or a prompt pin missing the count, was written before they
 * existed and keeps the language-only reading; a pin that carries a count must
 * also say `source: prompt`, and a locale pin is exempt either way.
 *
 * Pure and in its own module, so the turn-end gate and
 * `measure_turn_end_gate --language-split` apply the same rule.
 */
export function gatePinLanguage(pin: Record<string, unknown>): Verdict {
    const lang = pin['language'];
    if (lang !== 'de' && lang !== 'en') return 'und';
    const source = pin['source'];
    const chars = pin['owner_prose_chars'];
    if (source !== 'prompt' && (source !== undefined || chars !== undefined)) return 'und';
    if (chars !== undefined && !(typeof chars === 'number' && Number.isInteger(chars) && chars > 0)) return 'und';
    return lang;
}
