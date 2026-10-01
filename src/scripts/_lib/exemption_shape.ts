/**
 * What an `estate_offset_exempt` reason has to SAY — one vocabulary, two readers.
 *
 * THE DEFECT THIS EXISTS TO NAME. The one-in-one-out rule charges every added
 * active roadmap against a disposed one, and `estate_offset_exempt: <reason>`
 * is the escape hatch that costs "one reviewable line instead of a silent
 * exception". `exemptionReason` accepted any non-empty string, so the line was
 * reviewable in the sense that it existed. Measured 2026-10-01 over the active,
 * `later/` and `archive/` trees: 221 files carry the key, and 43 of them name
 * no alternative disposition at all under the three-lemma set the roadmap named
 * from memory, and 6 under the measured one below — including three that say only
 * `lane N of <parent>`. The escape hatch was free.
 *
 * WHAT A SHAPED REASON SAYS. It names at least one disposition the author
 * considered instead of adding a file: archiving something, parking it in
 * `later/`, merging into an existing roadmap, or any of the words this tree
 * actually uses for those three. The requirement is deliberately NOT "explain
 * yourself well" — that is unjudgeable — but "name what you rejected", which is
 * a word that is either present or absent.
 *
 * WHY THE VOCABULARY IS MEASURED AND NOT CHOSEN. The commissioning roadmap
 * named three lemmas, archive / park / merge, from memory. Over the real
 * population those three cover 178 of 221; the measured ten below cover 215.
 * The 37-file gap is not boilerplate — "Offsetting it individually is not
 * possible without splitting the set" and "no completed roadmap to retire
 * against this addition" both name a rejected alternative in words the
 * three-lemma set does not carry. A refusal vocabulary that reds one added
 * roadmap in five on the house style gets weakened until it finds nothing, so
 * the set here is the one the tree writes. Every number above carries its
 * producing command: `./scripts-run src/scripts/estate_exemption_shape`.
 *
 * `close` is excluded on purpose, and it is the most common verb in these
 * reasons: it almost always refers to closing WORK, not to disposing of a file,
 * so accepting it would make the check pass on a sentence that named nothing.
 *
 * WHY ONE MODULE. Two readers consume this — the estate gate, which refuses,
 * and the measurement script, which reports. A second copy of the lemma list is
 * how a gate and its own evidence drift apart, and a drifted vocabulary fails
 * silently: the report says the tree conforms while the gate refuses it.
 */

/**
 * The dispositions a reason may name, as source strings.
 *
 * Exported individually rather than as one baked regex so the measurement
 * script can report per-lemma counts against the same list the gate refuses on.
 */
export const DISPOSITION_LEMMAS: readonly { readonly name: string; readonly source: string }[] = [
    { name: 'archive', source: String.raw`archiv\w*` },
    { name: 'park', source: String.raw`unpark\w*|park\w*` },
    { name: 'merge', source: String.raw`merg\w*` },
    { name: 'later', source: String.raw`later\/` },
    { name: 'offset', source: String.raw`offset\w*` },
    { name: 'defer', source: String.raw`defer\w*` },
    { name: 'fold', source: String.raw`fold\w*` },
    { name: 'consolidate', source: String.raw`consolidat\w*` },
    { name: 'absorb', source: String.raw`absorb\w*` },
    { name: 'retire', source: String.raw`retir\w*` },
];

/** The whole vocabulary as one alternation — the gate's own test. */
export const DISPOSITION_SOURCE = `\\b(?:${DISPOSITION_LEMMAS.map((l) => l.source).join('|')})`;

const DISPOSITION_RE = new RegExp(DISPOSITION_SOURCE, 'i');

/** Does this reason name at least one rejected alternative? */
export function namesDisposition(reason: string): boolean {
    return DISPOSITION_RE.test(reason);
}

/** Which lemmas a reason names, for the reader's per-file column. */
export function lemmasNamed(reason: string): string[] {
    return DISPOSITION_LEMMAS.filter((l) => new RegExp(`\\b(?:${l.source})`, 'i').test(reason)).map((l) => l.name);
}

/**
 * The comparison key for "two added files say the same thing".
 *
 * Case and whitespace are folded because a reason pasted into a second file and
 * re-wrapped by an editor is the same reason. Nothing else is folded: a reason
 * that differs by one clause is a different reason, and a normaliser clever
 * enough to call those equal would start refusing reasons that genuinely differ.
 */
export function reasonKey(reason: string): string {
    return reason.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** One added file whose exemption reason does not hold up. */
export interface ExemptionFinding {
    readonly file: string;
    readonly kind: 'shapeless' | 'duplicate';
    /** For `duplicate`, the other added file carrying the same reason. */
    readonly twin: string | null;
    readonly reason: string;
}

/**
 * Judge the exemptions a single change ADDS — never the ones already in the tree.
 *
 * Grandfathering is load-bearing rather than polite. 43 of the 221 existing
 * reasons name no disposition; re-reading them would land this check red on a
 * fifth of the corpus, which is a backlog wearing a control's clothes. The
 * input is `classifyDiff`'s exempt ledger, which by construction lists only the
 * files this change added.
 */
export function exemptionFindings(
    exempt: readonly { readonly file: string; readonly reason: string }[],
): ExemptionFinding[] {
    const out: ExemptionFinding[] = [];
    const seen = new Map<string, string>();
    for (const e of exempt) {
        if (!namesDisposition(e.reason)) {
            out.push({ file: e.file, kind: 'shapeless', twin: null, reason: e.reason });
            continue;
        }
        const key = reasonKey(e.reason);
        const twin = seen.get(key);
        if (twin === undefined) {
            seen.set(key, e.file);
            continue;
        }
        out.push({ file: e.file, kind: 'duplicate', twin, reason: e.reason });
    }
    return out;
}
