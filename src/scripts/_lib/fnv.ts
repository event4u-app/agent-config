/**
 * FNV-1a, 32-bit — the one definition in this tree.
 *
 * Extracted from `rule_trigger_eval.ts`, which still re-exports it under its
 * own name so its suite keeps importing the symbol it always did. The reason
 * for the extraction is the reason this file carries a doc block at all: a
 * second consumer arrived (`measure_skill_ranker_baseline`'s held-out
 * partition), and two copies of a hash that decides which rows a measurement
 * reads is the shape in which a partition quietly stops being the same
 * partition. One definition, two callers.
 *
 * Pure — no imports, no I/O, no clock.
 */

/** FNV-1a over UTF-16 code units, returned as an unsigned 32-bit integer. */
export function fnv1a(s: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
}
