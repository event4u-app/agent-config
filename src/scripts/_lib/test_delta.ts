/**
 * Shared classification for the two test gates —
 * `road-to-adversarial-verification-and-long-runs` Phase 2.4.
 *
 * `check_test_delta` and `check_test_weakening` ask different questions about
 * the same diff, and both need the same answer to "is this path code?" and "is
 * this path a test?". Two copies of that answer is how one gate starts counting
 * a file the other does not, so the predicates live here once.
 *
 * Pure, and `node:`-free, so either gate and their tests may import it.
 */

/** A changed path that is production code this repository ships or runs. */
export function isCodePath(p: string): boolean {
    const f = p.replace(/\\/g, '/');
    if (isTestPath(f)) return false;
    if (!/\.(ts|tsx|js|mjs|cjs)$/.test(f)) return false;
    if (f.endsWith('.d.ts')) return false;
    // Generated trees are projections of `src/`, never an independent change.
    if (/^(dist|\.augment|\.claude|\.cursor|node_modules)\//.test(f)) return false;
    return /^(src|scripts)\//.test(f);
}

/** A changed path that carries tests. */
export function isTestPath(p: string): boolean {
    const f = p.replace(/\\/g, '/');
    if (/^tests\//.test(f)) return true;
    return /\.(test|spec)\.(ts|tsx|js|mjs|cjs)$/.test(f);
}

/**
 * An independent-verdict artefact — the thing that makes a weakening legitimate.
 *
 * Deliberately a PATH test and not a content test. Whether the artefact actually
 * contains an independent verdict is exactly the judgement `evaluator-independence`
 * says no gate can make, so this gate checks that one was COMMITTED and leaves
 * its quality to the review. Claiming more would be the coverage inflation that
 * rule was written over.
 */
export function isVerdictArtefact(p: string): boolean {
    const f = p.replace(/\\/g, '/');
    return /^agents\/evidence\/reviews\//.test(f) && f.endsWith('.md');
}

/** One file's hunks, as a unified diff splits them. */
export interface FileDiff {
    readonly path: string;
    readonly added: readonly string[];
    readonly removed: readonly string[];
}

/**
 * Split a unified diff into per-file added/removed line lists.
 *
 * Tolerant by construction: an unparseable header is skipped rather than thrown
 * on, because a gate that crashes on an unusual diff blocks the fix for the
 * diff that produced it. `+++ b/<path>` is the authority for the path — a rename
 * shows the destination, which is the file whose assertions now count.
 */
export function parseUnifiedDiff(diff: string): FileDiff[] {
    const out: FileDiff[] = [];
    let path: string | null = null;
    let added: string[] = [];
    let removed: string[] = [];
    const flush = (): void => {
        if (path !== null) out.push({ path, added, removed });
        added = [];
        removed = [];
    };
    for (const line of diff.split('\n')) {
        if (line.startsWith('diff --git ')) {
            flush();
            path = null;
            continue;
        }
        if (line.startsWith('+++ ')) {
            const p = line.slice(4).trim();
            path = p === '/dev/null' ? null : p.replace(/^b\//, '');
            continue;
        }
        if (line.startsWith('--- ') || line.startsWith('@@')) continue;
        if (path === null) continue;
        if (line.startsWith('+')) added.push(line.slice(1));
        else if (line.startsWith('-')) removed.push(line.slice(1));
    }
    flush();
    return out;
}

/**
 * Lines that assert something.
 *
 * Framework-spread on purpose — this suite runs vitest, and the rule it enforces
 * ships to consumers running pytest, PHPUnit and Go. A gate that only recognises
 * one framework reports every other project as assertion-free, which is a false
 * green and worse than no gate.
 */
const ASSERTION = /\b(expect|assert|assertThat|self\.assert|should\.|\.toBe|\.toEqual|\.toMatch|assertEquals|assertTrue|require\.(New|Equal|NoError))/;

/** Lines that disable a test rather than assert with it. */
const SUPPRESSION =
    /(\b(it|test|describe|context)\s*\.\s*(skip|todo|failing)\b|\bxit\b|\bxdescribe\b|@pytest\.mark\.(skip|xfail)|\bt\.Skip\(|->markTestSkipped\(|@group\s+skip)/;

/** Counted evidence about one test file's diff. */
export interface WeakeningSignal {
    readonly path: string;
    /** Assertions removed minus assertions added. Positive means a net loss. */
    readonly assertionsLost: number;
    /** Suppressions added minus suppressions removed. Positive means new skips. */
    readonly suppressionsGained: number;
}

/**
 * Measure a test file's diff as NET counts, never as raw removals.
 *
 * This is the discriminator the gate lives or dies on. Editing an assertion
 * removes one line and adds another, so a gate counting raw removals reds every
 * legitimate test edit — and a gate that reds every PR gets its exemption widened
 * until it finds nothing, which is Risk 4 of the roadmap that commissioned it.
 * A NET loss is a different claim: the file asserts less than it did.
 */
export function weakeningSignal(file: FileDiff): WeakeningSignal {
    const count = (lines: readonly string[], re: RegExp): number =>
        lines.filter((l) => re.test(l)).length;
    return {
        path: file.path,
        assertionsLost: count(file.removed, ASSERTION) - count(file.added, ASSERTION),
        suppressionsGained: count(file.added, SUPPRESSION) - count(file.removed, SUPPRESSION),
    };
}

/** True when a signal is worth reporting at all. */
export function isWeakening(s: WeakeningSignal): boolean {
    return s.assertionsLost > 0 || s.suppressionsGained > 0;
}
