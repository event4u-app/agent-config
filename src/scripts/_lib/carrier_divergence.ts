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
 * `bodyDiff > 0` means the two carriers are delivering different bytes.
 *
 * `bodyDiff > 0` is NOT the same as "a reader has to act", and an earlier version
 * of this paragraph said it was. Measured 2026-08-10: all 109 shared rules
 * classified `bodyDiff` and NONE of them differed in prose. The reader-facing
 * split lives in `report_carrier_divergence`, which subdivides this class into
 * prose divergence (act), a `paths:`-scope disagreement (act — it changes WHEN a
 * rule loads), and a metadata-only difference (do not act). The three-way split
 * below stays three-way on purpose: it is the DEDUP predicate, and every class
 * here is a real byte difference.
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

/** One rule file, split at its frontmatter fence. */
export interface FrontmatterSplit {
    /** `true` only when a terminated `---` fence was actually found. */
    hadFrontmatter: boolean;
    /** The fence block WITHOUT its delimiters, or `''` when there is none. */
    frontmatter: string;
    /** Everything after the fence — the prose the host delivers. */
    body: string;
}

/**
 * THE fence parser. One definition, for the reason the header gives: a second
 * copy is how two surfaces drift into disagreeing about what frontmatter is.
 *
 * An absent or UNTERMINATED fence yields `hadFrontmatter: false` and the whole
 * text as body. That is deliberate and it is the safe direction: a malformed
 * fence must not silently swallow a rule's governed text. Note this is the
 * OPPOSITE of what a naive `type:` reader does — treating the whole file as
 * frontmatter — and that asymmetry was a live inconsistency between this
 * function and `report_carrier_divergence._ruleType` until the latter was moved
 * onto this parser.
 */
export function splitFrontmatter(text: string): FrontmatterSplit {
    if (!text.startsWith('---')) return { hadFrontmatter: false, frontmatter: '', body: text };
    const end = text.indexOf('\n---', 3);
    if (end === -1) return { hadFrontmatter: false, frontmatter: '', body: text };
    const afterFence = text.indexOf('\n', end + 1);
    return {
        hadFrontmatter: true,
        frontmatter: text.slice(3, end),
        body: afterFence === -1 ? '' : text.slice(afterFence + 1),
    };
}

/** The prose a rule file delivers, with any frontmatter block removed. */
export function stripFrontmatter(text: string): string {
    return splitFrontmatter(text).body;
}

/**
 * Is the ONLY difference between these two copies inside the frontmatter block?
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
 * WHAT IT PROVES, EXACTLY — AND WHY NOT `trim()`
 * ---------------------------------------------
 * Two conditions, both required:
 *
 *   1. at least one side actually HAD a frontmatter block. Without this the
 *      predicate would answer "the prose matches" for a pair with no frontmatter
 *      anywhere, and the caller would print "differs only in frontmatter" about
 *      a difference that is not in any frontmatter.
 *   2. the bodies match after removing LEADING newlines only. The fence
 *      necessarily leaves the stripped side one newline ahead, so that one
 *      character is a parsing artefact. A `trim()` would additionally absorb a
 *      TRAILING difference, which is a real byte difference no fence explains —
 *      and it was measured to be unnecessary: all 109 live pairs on 2026-08-10
 *      matched on leading-only, 0 needed a trailing trim.
 *
 * Nothing else is normalized. Internal whitespace and line endings stay
 * significant, so a CRLF-vs-LF body is still a prose difference and this stays
 * no softer than the dedup predicate on the text the host reads.
 */
export function proseEqual(a: string, b: string): boolean {
    const sa = splitFrontmatter(a);
    const sb = splitFrontmatter(b);
    if (!sa.hadFrontmatter && !sb.hadFrontmatter) return false;
    const leading = /^\n+/;
    return sa.body.replace(leading, '') === sb.body.replace(leading, '');
}

/**
 * The `paths:` block of a rule's frontmatter, normalized, or `null` when absent.
 *
 * `paths` is the ONE frontmatter key this host reads
 * (`agents/evidence/analysis/claude-code-rules-dir-contract.md`), and it decides
 * WHEN a rule loads: with it, the rule fires when a matching file is read and is
 * not re-injected after `/compact`; without it, the rule loads unconditionally
 * at launch. So two carriers that disagree here deliver the same text on
 * different schedules, which a reader must act on even though the prose is
 * identical. Measured 2026-08-10: 24 of the 109 shared rules carry `paths:` in
 * the project copy and NONE in the global copy, so on a machine with both the
 * always-on global copy defeats the project copy's scoping for all 24.
 *
 * Normalization is deliberately shallow — the key line plus its indented
 * continuation, whitespace-collapsed. It answers "do these two agree" and is not
 * a YAML parser; a reordered list reads as a difference, which is the
 * conservative direction for a report that asks a human to look.
 */
export function frontmatterPaths(text: string): string | null {
    const { hadFrontmatter, frontmatter } = splitFrontmatter(text);
    if (!hadFrontmatter) return null;
    const lines = frontmatter.split('\n');
    const start = lines.findIndex((l) => /^paths:/.test(l));
    if (start === -1) return null;
    const block = [lines[start] as string];
    for (const line of lines.slice(start + 1)) {
        if (/^\s/.test(line) && line.trim() !== '') block.push(line);
        else break;
    }
    return block.map((l) => l.trim()).join(' ');
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
