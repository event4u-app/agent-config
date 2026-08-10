/**
 * One definition of "these two carriers deliver the same rule" — shared by the
 * C-3 reachability harness and the advisory divergence report.
 *
 * WHY THIS IS A LIBRARY AND NOT TWO COPIES. Two surfaces need the comparison
 * and they ask different questions of it. `measure_scope_dedup` asks *how many*
 * installed twins a byte-identity dedup could skip, anchored on the projection
 * source. `report_carrier_divergence` asks *which* rules a reader must look at,
 * anchored on the union of both carriers. The directory walks are legitimately
 * different; the comparison is not, and a second copy of it is how "differs only
 * in the ownership stamp" and "differs in body" drift into meaning two things.
 *
 * The comparison itself is the load-bearing part, so it is stated once:
 *
 *   1. bytes equal                     → `identical`
 *   2. equal after removing the two
 *      installer ownership keys        → `provenance-only`
 *   3. otherwise                       → `body-diff`
 *
 * Class 2 exists because `install.ts` stamps `package:` and `source_path:` into
 * every rule it installs while the in-repo projection stamps nothing, so a
 * provenance-only difference survives even a perfect version alignment. Keeping
 * it apart from class 3 is what turns a bare "0 identical twins" into an answer:
 * `provenanceOnly == shared` means aligning versions would buy nothing, and
 * `bodyDiff > 0` means the two carriers are delivering different text — the only
 * class where a reader has to act.
 *
 * NOT A LICENCE TO DEDUP. Classifying a pair `provenance-only` says the bodies
 * match; it does NOT say the rule is safe to drop from one carrier. Byte-identity
 * remains the dedup predicate, deliberately — see
 * `agents/settings/contexts/dedup-reachability-refusal.md`, which records that
 * decision and its five reopen conditions. Nothing here relaxes it.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * The keys `install.ts` adds to every installed rule (`_set_key(fm_lines,
 * 'package', …)` and `source_path` at install.ts:2733). Removing them is what
 * separates an installer stamp from a content change.
 */
export const OWNERSHIP_KEYS = ['package', 'source_path'] as const;

export type PairVerdict = 'identical' | 'provenance-only' | 'body-diff';

/**
 * Drop the ownership stamp lines, wherever they appear in the FILE.
 *
 * Not scoped to the frontmatter, and the docstring says so because the scope is
 * wider than the intent. Two reasons it stays this way: `install.ts` writes the
 * keys without any guarantee about fence position, and `scope_dedup.test.ts`
 * deliberately pins the fence-less shape (a stamp with no `---` around it) as the
 * install condition. Residual risk, stated rather than hidden: a rule body that
 * contains a line literally starting `package:` or `source_path:` — a YAML
 * example, an indent-free config snippet — has that line removed from both sides,
 * so a genuine difference confined to such a line would read `provenance-only`
 * instead of `body-diff`. Measured over the shipped corpus: no rule body carries
 * one. Re-check that before treating the class as impossible rather than absent.
 */
export function stripOwnershipKeys(text: string): string {
    return text
        .split('\n')
        .filter((line) => !OWNERSHIP_KEYS.some((k) => line.startsWith(`${k}:`)))
        .join('\n');
}

/**
 * Compare one rule's two copies.
 *
 * Takes buffers rather than paths: the callers already hold them, and a pure
 * function is what lets both surfaces pin the same three-way split in tests
 * without a filesystem.
 */
export function comparePair(a: Buffer, b: Buffer): PairVerdict {
    if (a.equals(b)) {
        return 'identical';
    }
    if (stripOwnershipKeys(a.toString('utf-8')) === stripOwnershipKeys(b.toString('utf-8'))) {
        return 'provenance-only';
    }
    return 'body-diff';
}

/**
 * Drop a leading YAML frontmatter block, returning the prose the host actually
 * delivers.
 *
 * A file with no `---` fence, or an unterminated one, is returned unchanged —
 * the same tolerance `report_carrier_divergence`'s own `type:` reader applies,
 * because a malformed fence must not silently swallow a rule's whole text.
 */
export function stripFrontmatter(text: string): string {
    if (!text.startsWith('---')) return text;
    const end = text.indexOf('\n---', 3);
    if (end === -1) return text;
    const afterFence = text.indexOf('\n', end + 1);
    return afterFence === -1 ? '' : text.slice(afterFence + 1);
}

/**
 * Do the two copies carry the same governed PROSE, ignoring frontmatter?
 *
 * WHY THIS IS SEPARATE FROM `comparePair`, AND MUST STAY SEPARATE
 * --------------------------------------------------------------
 * `comparePair` answers *can a byte-identity dedup skip this pair* — it is the
 * dedup predicate, and a frontmatter difference is a real byte difference, so
 * folding this in would relax the predicate that
 * `agents/settings/contexts/dedup-reachability-refusal.md` deliberately keeps
 * strict. `measure_scope_dedup` asks exactly that question and its arithmetic
 * stays untouched.
 *
 * This answers the different, reader-facing question `report_carrier_divergence`
 * asks: *must a human act on this pair*. Measured 2026-08-10 over the live
 * carriers at commit `a5b2f4cb7`: 109 shared rules, **0** byte-identical, **109**
 * classified `body-diff` — and after this strip, **0** of the 109 differ in
 * prose. The whole divergence was the metadata block. Reporting that as body
 * divergence manufactures the one class the report tells a reader to act on,
 * which is precisely the failure `compareCarriers` already refuses to commit for
 * an unreadable copy.
 *
 * Edge trimming only, on purpose: the frontmatter fence leaves the two sides one
 * leading newline apart, and that is not a content difference. Internal
 * whitespace and line endings are NOT normalized — a CRLF-vs-LF body stays a
 * prose difference, so this stays no softer than the dedup predicate on the text
 * the host reads.
 */
export function proseEqual(a: string, b: string): boolean {
    return stripFrontmatter(a).trim() === stripFrontmatter(b).trim();
}

export interface RuleDirCensus {
    files: number;
    /**
     * BYTES, not characters — `statSync().size`. The name is kept because every
     * consumer of this figure (`preamble_byte_census`, `measure_scope_dedup`, the
     * conformance scan) already divides it by 4 under that name, and one honest
     * docstring beats a rename that would silently move three published baselines.
     *
     * The gap is measured, not assumed: over the 110-rule project tree, 406 502
     * bytes against 402 823 characters — **0.91 %** overhead from the em-dashes,
     * arrows and status glyphs the prose uses. So the published token estimate
     * reads 101 626 where a character basis gives 100 706. Under 1 % and in the
     * conservative direction for a payload figure, which is why it is documented
     * rather than repaired; re-measure before quoting it as negligible on a corpus
     * with more non-ASCII than this one.
     */
    chars: number;
}

/**
 * How much rule text one carrier delivers.
 *
 * `statSync`, not `lstatSync`, on purpose: a project-scope entry is a symlink
 * into `dist/`, and the bytes the HOST reads are the target's. Measuring the link
 * would report ~50 bytes per rule and make the whole payload vanish.
 *
 * Moved here from `preamble_byte_census` when `conformance_scan` needed it:
 * that module pulls `yaml` and the cold-start report, and importing a dependency
 * chain into a bundled CLI path to reach fifteen lines of `statSync` is the wrong
 * trade. `preamble_byte_census` re-exports this so its own callers are unchanged
 * and there is still exactly one definition.
 */
export function censusRuleDir(dir: string): RuleDirCensus {
    let files = 0;
    let chars = 0;
    let entries: string[];
    try {
        entries = fs.readdirSync(dir);
    } catch {
        return { files: 0, chars: 0 };
    }
    for (const name of entries) {
        if (!name.endsWith('.md')) continue;
        try {
            chars += fs.statSync(path.join(dir, name)).size;
            files += 1;
        } catch {
            // Unreadable entry — skip rather than fail the whole census.
        }
    }
    return { files, chars };
}
