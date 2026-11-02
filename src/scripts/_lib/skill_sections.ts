/**
 * Section-level helpers for `skill_linter.ts`, split out so the linter's new
 * checks do not grow a file already far past the source-size ceiling.
 *
 * Dependency-free on purpose: `skill_linter.ts` imports this module, so this
 * module must never import it back.
 */

export function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extract_section_block(text: string, sectionName: string): string {
    const pattern = new RegExp(
        `^##\\s+${escapeRegex(sectionName)}\\s*$([\\s\\S]*?)(?=^##\\s+|$(?![\\s\\S]))`,
        'm',
    );
    const match = pattern.exec(text);
    return match ? (match[1] as string).trim() : '';
}

/** Structurally an `Issue` from `skill_linter.ts`, which has no methods. */
export interface DoNotPairingIssue {
    severity: 'info';
    code: 'do_not_unpaired';
    message: string;
}

/**
 * A `Do NOT` bullet is PAIRED when it names what to do instead. Matched
 * lexically on purpose: the hint is advisory (`info`, never a status change),
 * so a cheap, explainable heuristic beats a judgement nobody can reproduce.
 */
const DO_NOT_PAIRING_RE = /\binstead\b|→|->|\b(?:use|prefer|rather|route|keep)\b/i;

/**
 * Info-level hint: a `## Do NOT` section whose bullets list prohibitions only,
 * none naming the positive alternative. Fires only when EVERY bullet is
 * unpaired, so one paired bullet is enough to silence it.
 */
export function lint_do_not_pairing(text: string): DoNotPairingIssue[] {
    const block = extract_section_block(text, 'Do NOT') || extract_section_block(text, 'Do not');
    const bullets = block.split(/\r\n|\r|\n/).filter((line) => /^\s*[-*+]\s+/.test(line));
    if (bullets.length === 0) return [];
    if (bullets.some((b) => DO_NOT_PAIRING_RE.test(b))) return [];
    return [
        {
            severity: 'info',
            code: 'do_not_unpaired',
            message: `\`Do NOT\` section has ${String(bullets.length)} prohibition(s) and none names the alternative — pair at least one with what to do instead (e.g. "… — use X instead")`,
        },
    ];
}
