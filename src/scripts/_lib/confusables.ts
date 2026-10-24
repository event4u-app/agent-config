/**
 * Visible mixed-script confusable signature — the ONE definition in the tree.
 *
 * Extracted from `lint_confusables.ts` so the authoring-time linter and the
 * runtime encoding scanner share one table and one decision rule
 * (road-to-runtime-encoding-hardening Phase 3). Two copies of a confusable set
 * is exactly the drift this extraction prevents: a codepoint added to one and
 * not the other means the two surfaces disagree about what a homoglyph is.
 *
 * The dependency direction matters. This module imports NOTHING — no `fs`, no
 * lint framework — so the runtime retrieval path can use it without pulling the
 * authoring-time lint infrastructure into a request.
 */

/** A token needs this many letters before the signature can fire. */
export const MIN_LETTERS = 3;

// Unicode-script classifiers via property escapes (requires the `u` flag).
const _LATIN = /\p{Script=Latin}/u;
const _CYRILLIC = /\p{Script=Cyrillic}/u;
const _GREEK = /\p{Script=Greek}/u;
const _LETTER = /\p{L}/u;

/** A "token" is a maximal run of letters / combining marks / decimal digits. */
export const TOKEN_RE = /[\p{L}\p{M}\p{Nd}]+/gu;

/**
 * Cyrillic + Greek codepoints that have a basic-Latin lookalike (Unicode TR39
 * confusables, common subset). A foreign letter only counts toward the
 * confusable signal when it is in this set — Greek math operators with no Latin
 * twin (Δ Σ Π Ω Φ Θ Λ Ξ Ψ Γ δ π ω …) are deliberately excluded so legit
 * notation does not false-positive.
 */
export const CONFUSABLE_FOREIGN: ReadonlySet<number> = new Set([
    // Cyrillic lowercase ↔ Latin
    0x0430 /*а→a*/, 0x0435 /*е→e*/, 0x043e /*о→o*/, 0x0440 /*р→p*/, 0x0441 /*с→c*/,
    0x0443 /*у→y*/, 0x0445 /*х→x*/, 0x0455 /*ѕ→s*/, 0x0456 /*і→i*/, 0x0458 /*ј→j*/,
    0x04bb /*һ→h*/, 0x0501 /*ԁ→d*/, 0x051b /*ԛ→q*/, 0x0577 /*no*/,
    // Cyrillic uppercase ↔ Latin
    0x0410 /*А→A*/, 0x0412 /*В→B*/, 0x0415 /*Е→E*/, 0x041a /*К→K*/, 0x041c /*М→M*/,
    0x041d /*Н→H*/, 0x041e /*О→O*/, 0x0420 /*Р→P*/, 0x0421 /*С→C*/, 0x0422 /*Т→T*/,
    0x0423 /*У→Y*/, 0x0425 /*Х→X*/, 0x0405 /*Ѕ→S*/, 0x0406 /*І→I*/, 0x0408 /*Ј→J*/,
    // Greek lowercase ↔ Latin
    0x03b1 /*α→a*/, 0x03b5 /*ε→e*/, 0x03bf /*ο→o*/, 0x03bd /*ν→v*/, 0x03c1 /*ρ→p*/,
    0x03c5 /*υ→u*/, 0x03c7 /*χ→x*/, 0x03ba /*κ→k*/,
    // Greek uppercase ↔ Latin (only those with a real Latin twin)
    0x0391 /*Α→A*/, 0x0392 /*Β→B*/, 0x0395 /*Ε→E*/, 0x0396 /*Ζ→Z*/, 0x0397 /*Η→H*/,
    0x0399 /*Ι→I*/, 0x039a /*Κ→K*/, 0x039c /*Μ→M*/, 0x039d /*Ν→N*/, 0x039f /*Ο→O*/,
    0x03a1 /*Ρ→P*/, 0x03a4 /*Τ→T*/, 0x03a5 /*Υ→Y*/, 0x03a7 /*Χ→X*/, 0x0392 /*Β→B*/,
]);

type ScriptName = 'latin' | 'cyrillic' | 'greek' | 'other';

function _script_of(ch: string): ScriptName {
    if (_LATIN.test(ch)) return 'latin';
    if (_CYRILLIC.test(ch)) return 'cyrillic';
    if (_GREEK.test(ch)) return 'greek';
    return 'other';
}

/**
 * Classify a single token. Returns the offending mixed-script descriptor when
 * the token matches the homoglyph signature, else null.
 *
 * The containment rules are the load-bearing part, and they are why this is one
 * shared function rather than two similar ones: a Latin-majority token with at
 * least one TR39-confusable foreign letter is the signal; a single-script token
 * (a genuine Cyrillic or Greek word) is not; and a token whose foreign letters
 * outnumber its Latin ones is a foreign word, not an attack.
 */
export function classifyToken(token: string): string | null {
    let latin = 0;
    let cyrillic = 0;
    let greek = 0;
    let letters = 0;
    for (const ch of token) {
        if (!_LETTER.test(ch)) continue; // skip combining marks / digits for script vote
        letters += 1;
        const script = _script_of(ch);
        if (script === 'latin') {
            latin += 1;
        } else if (script === 'cyrillic' || script === 'greek') {
            // Only confusable foreign letters (TR39) count — math operators with
            // no Latin twin are ignored, so legit notation never trips.
            if (CONFUSABLE_FOREIGN.has(ch.codePointAt(0) as number)) {
                if (script === 'cyrillic') cyrillic += 1;
                else greek += 1;
            }
        }
    }
    if (letters < MIN_LETTERS) return null;
    const foreign = cyrillic + greek;
    if (latin === 0 || foreign === 0) return null; // single-script (or no Latin) → legit
    if (latin <= foreign) return null; // majority must be Latin (foreign word ≠ attack)
    const which = cyrillic > 0 && greek > 0
        ? 'cyrillic+greek'
        : cyrillic > 0
            ? 'cyrillic'
            : 'greek';
    return `latin+${which} (${latin} latin / ${foreign} foreign-confusable)`;
}
