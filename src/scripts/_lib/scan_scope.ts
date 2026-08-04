/**
 * Scan-scope assertions — "a gate that read nothing did not pass".
 *
 * WHY THIS EXISTS (audit 2026-07-29, `agents/settings/contexts/gates-that-cannot-fail.md`):
 * ADR-051 moved the source container and a later commit deleted `packages/`.
 * Fourteen `lint_*`/`check_*` gates kept a hardcoded literal path, and every
 * one of them treats a missing directory as "nothing to check" — so they exit 0
 * and print a green checkmark while scanning zero files. Their own output said
 * so (`0 file(s) scanned`, `0 name(s) checked`, `0 declarer(s)`); nothing ever
 * asserted on the number.
 *
 * Two shapes cover the whole class:
 *
 * - **Corpus gates** walk a root and check N units → {@link assertScanned}.
 *   Zero units is a failure unless the gate declares a justified `allowEmpty`.
 * - **Watch-list gates** (diff-based, no corpus to count) name specific files
 *   they guard → {@link assertWatchlistResolves}. A watch list that resolves to
 *   nothing on disk means the guard is watching phantoms.
 *
 * Both throw {@link DeadScopeError}; callers map it to a non-zero exit. The
 * point is that the failure is LOUD and names the root, so the next path
 * migration cannot silently disarm a gate again.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';

/** Raised when a gate's scope is empty — it cannot have checked anything. */
export class DeadScopeError extends Error {
    readonly gate: string;

    constructor(gate: string, message: string) {
        super(message);
        this.name = 'DeadScopeError';
        this.gate = gate;
    }
}

export interface ScannedOptions {
    /** Gate name, for the error message (e.g. `lint_namespace`). */
    gate: string;
    /** How many units the gate actually examined. */
    scanned: number;
    /** Plural noun for the unit — `file(s)`, `name(s)`, `declarer(s)`. */
    units: string;
    /** The root(s) the gate walked, repo-relative, for the error message. */
    roots: readonly string[];
    /**
     * Justification for legitimately scanning zero. Supply ONLY when an empty
     * corpus is a real, expected state (an optional consumer surface that may
     * genuinely be absent) — never to silence a moved root. The string is the
     * reason and is printed, so it is reviewable in a diff.
     *
     * **Carry one of the three prefixes below.** A reason a reviewer cannot
     * classify from the comment alone is how a justified exception becomes an
     * allowlist of boilerplate (`road-to-gate-hardening-adoption`, AI council
     * 2026-08-04). The prefix states which kind of emptiness is claimed:
     *
     * - `OPTIONAL_INPUT:` — the root belongs to a surface that may legitimately
     *   be absent in this project (a consumer tree, an opt-in pack).
     * - `EMPTY_VALID:` — zero units IS the success state (`check_no_todos`: an
     *   empty tree genuinely has zero TODOs).
     * - `WATCHLIST_DRIVEN:` — the gate has no corpus at all; it guards named
     *   files and its scope is asserted by {@link assertWatchlistResolves}.
     *
     * The operational test every reason must pass, applied from the comment
     * alone: **if this gate's scan root were deleted, would the reason still
     * make sense?** `check_no_todos` → yes. `check_frontmatter_valid` → no; no
     * docs to validate is blindness, not cleanliness, and that gate must
     * reclassify rather than claim `allowEmpty`.
     */
    allowEmpty?: string;
}

/**
 * Assert a corpus gate examined at least one unit.
 *
 * @throws {DeadScopeError} when `scanned === 0` and no `allowEmpty` reason is given.
 */
export function assertScanned(opts: ScannedOptions): void {
    if (opts.scanned > 0) {
        return;
    }
    if (opts.allowEmpty !== undefined && opts.allowEmpty.trim() !== '') {
        return;
    }
    const roots = opts.roots.length > 0 ? opts.roots.join(', ') : '(no root declared)';
    throw new DeadScopeError(
        opts.gate,
        `${opts.gate}: scanned 0 ${opts.units} under ${roots} — the scan scope is ` +
            'dead or the root moved. A gate that read nothing has not passed. ' +
            'Repoint the root (prefer the shared resolver in _lib/agent_src.ts), ' +
            'or declare a justified `allowEmpty` reason if an empty corpus is genuinely expected.',
    );
}

/**
 * Assert a corpus gate's scope AND publish the count it just validated.
 *
 * The two halves of scope hardening drifted apart in practice: 14 gates emit
 * the machine-readable `scanned:` line the coverage guard reads, 12 assert
 * their scope, and only 8 do both. A gate that publishes a number it never
 * asserted can print `scanned: 0` and exit green; a gate that asserts without
 * publishing is invisible to `check_gate_coverage`. Splitting the two also
 * lets the published number drift from the number that was validated — the
 * invented-count failure that is mechanically undetectable downstream.
 *
 * One call closes both: the emitted number is, by construction, the number the
 * assertion just accepted. Use this for any gate that should also carry a floor
 * in `src/config/gate-coverage.yml`; plain {@link assertScanned} stays correct
 * for a gate that only needs its scope guarded.
 *
 * The line goes to stdout unconditionally — a count only visible without
 * `--quiet` is not a count, since CI passes `--quiet` (the `lint_handoffs`
 * lesson, preserved here so no caller has to rediscover it).
 */
export function reportScanned(opts: ScannedOptions, write = process.stdout.write.bind(process.stdout)): void {
    assertScanned(opts);
    write(`scanned: ${String(opts.scanned)}\n`);
}

export interface WatchlistOptions {
    /** Gate name, for the error message. */
    gate: string;
    /** Repo-relative candidate paths the gate guards. */
    candidates: readonly string[];
    /** Absolute repo root the candidates resolve against. */
    repoRoot: string;
}

/**
 * Assert a watch-list gate's targets exist on disk, and return the ones that do.
 *
 * A diff-based guard has no corpus to count: it compares changed paths against
 * a fixed list. If that list resolves to nothing, the guard reports "clean"
 * forever — the exact shape of the `check_safety_floor_untouched` defect, which
 * announced `4 rules guarded` while guarding none.
 *
 * @returns the subset of `candidates` that exist.
 * @throws {DeadScopeError} when none of them exist.
 */
export function assertWatchlistResolves(opts: WatchlistOptions): string[] {
    const resolved = opts.candidates.filter((rel) => {
        try {
            return fs.statSync(path.join(opts.repoRoot, rel)).isFile();
        } catch {
            return false;
        }
    });
    if (resolved.length === 0) {
        throw new DeadScopeError(
            opts.gate,
            `${opts.gate}: none of its ${opts.candidates.length} guarded path(s) exist ` +
                `under ${opts.repoRoot} — the guard is watching phantoms and can never fire. ` +
                `Checked: ${opts.candidates.join(', ')}`,
        );
    }
    return resolved;
}
