/**
 * Retrieved-content sanitizer. Graph node labels, file paths, and target ids
 * are attacker-writable in a hostile repo; every string field passes through
 * here before it re-enters the agent's context (hostile-repo injection row,
 * ADR-124 risk register). Strips control + bidi/zero-width chars, collapses
 * whitespace, caps length. Independent reimplementation — no coupling to any
 * external label sanitizer.
 *
 * Filtering is done by codepoint (not a regex literal) so no control byte
 * ever appears in this source file.
 */
const MAX_LABEL = 160;

/** True for C0/C1 controls, DEL, zero-width, bidi override/isolate, BOM. */
function isStrippable(cp: number): boolean {
    if (cp <= 0x1f) return true; // C0 controls (incl. tab/newline → space)
    if (cp >= 0x7f && cp <= 0x9f) return true; // DEL + C1 controls
    if (cp >= 0x200b && cp <= 0x200f) return true; // zero-width + LRM/RLM
    if (cp >= 0x202a && cp <= 0x202e) return true; // bidi embeds/overrides
    if (cp >= 0x2066 && cp <= 0x2069) return true; // bidi isolates
    if (cp === 0xfeff) return true; // BOM / ZWNBSP
    return false;
}

export function sanitizeLabel(s: string, cap = MAX_LABEL): string {
    let out = '';
    for (const ch of s) out += isStrippable(ch.codePointAt(0) as number) ? ' ' : ch;
    const cleaned = out.replace(/\s+/g, ' ').trim();
    return cleaned.length > cap ? cleaned.slice(0, cap - 1) + '…' : cleaned;
}
