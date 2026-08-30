/**
 * source_snapshot_dedup — provenance-aware deduplication for R2 review snapshots.
 *
 * ## Why this exists, and why it is not a tier-lowering
 *
 * `dispatch_r2_reviewer` writes a review-input snapshot per branch:
 * `agents/evidence/reviews/<slug>.review-input/{diff.patch,roadmap.md,…}`. The
 * patch is a COPY of content that already lives in the tracked tree, so an
 * attribution-shape finding inside it is usually the same occurrence counted a
 * second time — and the shape ratchet is a count, so double-counting a mirror
 * makes the number say something false in both directions.
 *
 * `road-to-source-silence` Phase 3.4 first removed the snapshot carve-out and
 * proposed lowering the tier for everything under it. **The AI council refused,
 * both seats, 2026-08-29**, and the refusal is the design constraint here: that
 * fix asserted every snapshot finding was a mirror WITHOUT VERIFYING IT, and a
 * diff legitimately carries deleted lines, renamed paths and preimage content
 * that exist nowhere in the current tree. One seat chose "restore the carve-out
 * and record the falsified premise"; the other proposed this mechanism:
 *
 * > exclude a snapshot finding from the ratchet ONLY when an identical
 * > class/value occurrence is independently block-counted in the corresponding
 * > current tracked file, leaving unique, deleted-only, malformed and
 * > unverifiable findings at block.
 *
 * So every exclusion here is EARNED per finding, against the gate's own scan of
 * the current tree. Nothing is excluded by path, by tier, or by assumption.
 *
 * ## The two legs, and why the weaker one is reported separately
 *
 * | Leg | Test | Measured 2026-08-29 |
 * |---|---|---:|
 * | `hunk` | identical class+value is block-counted in the file THIS hunk targets (`+++ b/<path>`) | 12 of 26 |
 * | `tree` | identical class+value is block-counted in ANY scanned non-snapshot file — used both when the hunk target resolves to a different file and when it does not resolve at all | 14 of 26 |
 *
 * The literal reading of the recorded option is the `hunk` leg alone, and it
 * accounts for less than half the mirrors: a value moves between files, or the
 * hunk targets a generated projection whose source carries the occurrence. The
 * `tree` leg covers those, and it is genuinely weaker — identical class+value
 * elsewhere proves DUPLICATE PRESENCE, not provenance. Both council seats asked
 * for exactly that distinction to stay visible, so the two counts are reported
 * separately and every exclusion records its leg and its matched path.
 *
 * ## What actually fails closed — corrected after the R2 review of this branch
 *
 * The single necessary condition is a **positive `blockIndex` match**: an
 * identical class+value counted at the BLOCK tier in a scanned, non-snapshot
 * file. With no such match a finding stays at block, whatever else is true of
 * it. That includes a value seen only at the warn tier, and it is the condition
 * the AI council required — the mirror premise is verified per finding, never
 * assumed.
 *
 * **What does NOT independently fail closed, stated because this docstring
 * previously claimed it did.** Given a positive match, Leg 2 excludes. So a
 * patch finding whose hunk target cannot be resolved — a `/dev/null`
 * post-image, an unparsed header, a malformed patch — is excluded via `tree`
 * rather than held at block, PROVIDED its value is block-counted somewhere.
 * Measured on this branch: 10 findings take Leg 1, 42 take Leg 2 with a
 * resolved target, **8 take Leg 2 with no resolvable target**, and 1 has no
 * match anywhere and stays at block.
 *
 * That is deliberate rather than merely tolerated: those 8 carry a value the
 * gate already counts in the current tree, so excluding them removes a DOUBLE
 * COUNT and discloses nothing. Holding them would raise the ratchet by 8 for
 * findings that are provably not new disclosures. The behaviour is pinned by
 * `tests/scripts/source_snapshot_dedup.test.ts`, including a case asserting
 * exactly this — so the contract is executable rather than prose.
 *
 * The ONE structural fail-closed beyond the match itself: an untracked hunk
 * target returns `no`, because an exclusion may never cite a path that is gone.
 *
 * The two findings that survived this rule on first run were real: both were
 * documentation placeholder slugs in test fixtures, fixed in
 * `source_shape.ts`'s placeholder allowlist rather than by widening this rule.
 */

/** A snapshot directory written by `dispatch_r2_reviewer`. */
const SNAPSHOT_RE = /^agents\/evidence\/reviews\/[^/]*\.review-input\//;

/** The patch file inside a snapshot — the only member carrying hunk targets. */
const SNAPSHOT_PATCH_RE = /^agents\/evidence\/reviews\/[^/]*\.review-input\/diff\.patch$/;

/** `+++ b/<path>` — the post-image path of the hunk that follows. */
const PATCH_TARGET_RE = /^\+\+\+ (?:b\/)?(.+)$/;

/** Is `rel` inside an R2 review-input snapshot? */
export function isSnapshotPath(rel: string): boolean {
    return SNAPSHOT_RE.test(rel);
}

/** Is `rel` the patch member of a snapshot? */
export function isSnapshotPatch(rel: string): boolean {
    return SNAPSHOT_PATCH_RE.test(rel);
}

/**
 * Map each 1-based line of a unified diff to the path its hunk targets.
 *
 * `/dev/null` (a deletion's post-image) yields no target, so a finding on a
 * deleted-only line is UNATTRIBUTABLE — which routes it to Leg 2 rather than
 * holding it at block. It is still excluded only if its value is block-counted
 * somewhere in the current tree; with no such match it stays at block. See the
 * module docstring's fail-closed section, which this comment used to contradict.
 */
export function hunkTargets(patchText: string): Map<number, string> {
    const out = new Map<number, string>();
    const lines = patchText.split('\n');
    let target = '';
    for (let i = 0; i < lines.length; i += 1) {
        const m = PATCH_TARGET_RE.exec(lines[i] as string);
        if (m) {
            const p = (m[1] as string).trim();
            target = p === '/dev/null' ? '' : p;
            continue;
        }
        if (target !== '') {
            out.set(i + 1, target);
        }
    }
    return out;
}

/**
 * The identity a dedup match requires: exact class and exact value.
 *
 * NUL is the separator on purpose rather than a space: a shape VALUE is
 * arbitrary matched text and may contain spaces, so a space-joined key could
 * collide across classes. NUL cannot appear in either half. Written as the
 * ESCAPE, never as a raw byte -- a raw control character makes grep, file(1)
 * and git treat the whole source file as binary and skip it silently, which
 * is what `lint_hidden_unicode` exists to catch, and it did.
 */
export function findingKey(cls: string, value: string): string {
    return cls + '\u0000' + value;
}

/** One finding considered for exclusion. */
export interface DedupCandidate {
    file: string;
    line: number;
    cls: string;
    value: string;
}

/** Why a candidate was excluded — or that it was not. */
export interface DedupVerdict {
    excluded: boolean;
    /** Which leg matched. `null` when the candidate stays at block. */
    leg: 'hunk' | 'tree' | null;
    /** The tracked file whose independent block-count justified the exclusion. */
    matchedPath: string | null;
    /** Fail-closed reason, when not excluded. */
    reason: string;
}

export interface DedupInput {
    /**
     * `findingKey` -> the independently-scanned, non-snapshot tracked files where
     * that exact class+value is counted at the BLOCK tier. Built from the gate's
     * own scan, so a file excepted by `skip_paths` never appears: an occurrence
     * the gate does not govern cannot justify excluding one it does.
     */
    blockIndex: ReadonlyMap<string, ReadonlySet<string>>;
    /** Per snapshot patch path, its line -> hunk-target map. */
    targets: ReadonlyMap<string, ReadonlyMap<number, string>>;
    /** Every tracked path, so an exclusion can never cite a path that is gone. */
    trackedPaths: ReadonlySet<string>;
}

/**
 * Decide one candidate. Positive match required; every other path fails closed.
 */
export function dedupVerdict(c: DedupCandidate, input: DedupInput): DedupVerdict {
    const no = (reason: string): DedupVerdict => ({ excluded: false, leg: null, matchedPath: null, reason });
    if (!isSnapshotPath(c.file)) {
        return no('not a snapshot finding');
    }
    const owners = input.blockIndex.get(findingKey(c.cls, c.value));
    if (owners === undefined || owners.size === 0) {
        return no('no independent block-counted occurrence in the current tracked tree');
    }
    // Leg 1 — the recorded option, read literally.
    if (isSnapshotPatch(c.file)) {
        const target = input.targets.get(c.file)?.get(c.line);
        if (target !== undefined && target !== '') {
            if (!input.trackedPaths.has(target)) {
                return no(`hunk target ${target} is not a tracked path`);
            }
            if (owners.has(target)) {
                return { excluded: true, leg: 'hunk', matchedPath: target, reason: '' };
            }
        }
    }
    // Leg 2 — duplicate presence in an independently-scanned file. Weaker, and
    // reported as such: this proves the value is already counted, not that this
    // occurrence descends from that one.
    const first = [...owners].sort()[0] as string;
    return { excluded: true, leg: 'tree', matchedPath: first, reason: '' };
}
