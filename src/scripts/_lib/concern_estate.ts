/**
 * Count hook concerns in `src/scripts/hook_manifest.yaml`.
 *
 * ONE parser, used for both the HEAD reading and the base-ref floor — the same
 * discipline `_lib/skill_estate.ts` follows for skills, and for the same
 * reason: two readings of one corpus is how a ratchet comes to compare a
 * number against a differently-derived number and calls the difference growth.
 *
 * ## Why this is not the roadmap's grep
 *
 * `road-to-concern-admission-ratchet` reproduces its series with
 * `grep -cE '^  [a-z][a-z0-9_-]*:$'` over the whole manifest. That command is a
 * PROXY and it over-counts: the manifest carries three further top-level maps —
 * `roles:`, `platforms:` and `native_event_aliases:` — whose members sit at the
 * same two-space indent and match the same pattern.
 *
 * Measured across the roadmap's own six pins, the over-count is **exactly 16 at
 * every one of them**:
 *
 * | pin | grep | concerns |
 * |---|---|---|
 * | `7c6a71d`   | 63 | 47 |
 * | `1dba34c8`  | 65 | 49 |
 * | `40791536`  | 65 | 49 |
 * | `0f7c26ee9` | 68 | 52 |
 * | `2bcefb8b1` | 69 | 53 |
 * | `6e37584a1` | 71 | 55 |
 *
 * Two consequences, and they point in opposite directions, so both are stated.
 * **The roadmap's FINDING survives untouched**: the delta is constant, so the
 * series climbs by +8 either way and the concern axis is growing exactly as it
 * says. **Its ABSOLUTE FIGURES do not**: the axis stands at 55, not 71. A
 * ratchet seeded with 71 would have a floor its own parser could never
 * reproduce, which is a gate that fails on its first honest run.
 *
 * This module is therefore scoped to the `concerns:` block and stops at the
 * next top-level key.
 */

/** A top-level YAML key at column 0 — where the `concerns:` block ends. */
const TOP_LEVEL_KEY = /^[A-Za-z_][A-Za-z0-9_-]*:/;
/** The `concerns:` map itself. */
const CONCERNS_KEY = /^concerns:\s*$/;
/**
 * One concern id: two-space indent, a bare key, nothing after the colon.
 *
 * A trailing value (`foo: bar`) is not a concern — concerns are maps. Matching
 * the bare form is what keeps a scalar setting inside the block from counting.
 */
const CONCERN_ID = /^ {2}([a-z][a-z0-9_-]*):\s*$/;

/** The ids, in file order. Exported so a caller can report WHICH, not only how many. */
export function concernIds(manifestText: string): string[] {
    const out: string[] = [];
    let inBlock = false;
    for (const line of manifestText.split('\n')) {
        if (CONCERNS_KEY.test(line)) {
            inBlock = true;
            continue;
        }
        if (!inBlock) continue;
        // Any other column-0 key closes the block. Checked BEFORE the id match
        // so a top-level key can never be read as a concern.
        if (TOP_LEVEL_KEY.test(line)) break;
        const m = CONCERN_ID.exec(line);
        if (m !== null) out.push(m[1] as string);
    }
    return out;
}

/** How many concerns the manifest declares. */
export function countConcerns(manifestText: string): number {
    return concernIds(manifestText).length;
}

/** Repo-relative POSIX path of the manifest, for both the HEAD read and the `git show`. */
export const CONCERN_MANIFEST_POSIX = 'src/scripts/hook_manifest.yaml';
