/**
 * `fhs-verify/1` of `internal/bench/free-hands-shadow-PREREG.md`: the
 * deterministic check of one schema-valid hand return against the tree-derived
 * ground truth. It costs the head no tokens.
 */
import type { HeadVerify } from '../../../src/scripts/ai_council/free_hand_shadow.js';
import type { HandKind, VerifyVerdict } from '../../../src/scripts/_lib/hand_kinds.js';
import type { CorpusItem, MeasuredKind } from './corpus.js';

export const VERIFIER_VERSION = 'fhs-verify/1';

export function verifyAnswer(kind: MeasuredKind, truth: string, parsed: unknown): 'pass' | 'fail' {
    if (parsed === null || typeof parsed !== 'object') return 'fail';
    const rec = parsed as Record<string, unknown>;
    if (kind === 'classify') {
        const label = rec['label'];
        return typeof label === 'string' && label.trim().toLowerCase() === truth ? 'pass' : 'fail';
    }
    const items = rec['items'];
    return Array.isArray(items) && items.length === 1 && typeof items[0] === 'string' && items[0].trim() === truth ? 'pass' : 'fail';
}

export interface SideCapture {
    paid?: { parsed: unknown; verdict: VerifyVerdict };
    free?: { parsed: unknown; verdict: VerifyVerdict };
}

/** The shadow verify bound to one item; each side's parsed return and verdict land in `capture`. */
export function headVerifyFor(item: CorpusItem, capture: SideCapture = {}): HeadVerify {
    return (kind: HandKind, parsed: unknown, side: 'paid' | 'free') => {
        const verdict: VerifyVerdict = kind === item.kind ? verifyAnswer(item.kind, item.truth, parsed) : 'fail';
        capture[side] = { parsed, verdict };
        return { verdict, tokens: 0 };
    };
}
