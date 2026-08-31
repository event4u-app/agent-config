/**
 * Reviewer assignment under a budget `k`, with provider diversity preserved.
 *
 * `road-to-inbox-harvest-2026-08-e-council-topology-evidence` steps 8.2 and 8.3.
 *
 * ## What the shipped path does today, measured before anything was designed
 *
 * `orchestrator.ts:1509-1560` gives **every** reviewer **every** other member's
 * answer: N reviewers × (N−1) candidates = **N(N−1) reviewed pairs**, batched
 * into N provider calls. The pair count is the quantity that grows
 * quadratically and the one that drives prompt size, latency and — once the
 * cross-exam of 8.1 makes pairs individually addressable — call count. At N=8
 * that is 56 pairs; at N=16 it is 240.
 *
 * ## The construction, and why it is a circulant
 *
 * Order the members so provider families interleave, then let the candidate at
 * position `i` be reviewed by positions `i+1 … i+k` (mod N). This gives, for
 * free and without search:
 *
 *   - **no self-review** — the offsets start at 1 and stop before N;
 *   - **exact balance** — every candidate is reviewed exactly `k` times and
 *     every reviewer reviews exactly `k` candidates, so no member's context
 *     window carries more than another's;
 *   - **O(N×k) pairs** — `N·k`, against the unconditional `N(N−1)`;
 *   - **determinism** — a permutation seeded from the question text, replayable
 *     from the artefact, never `Math.random` and never `Date`, which is the
 *     same discipline `orchestrator.ts:1533-1543` already states for its own
 *     shuffle.
 *
 * Interleaving alone does NOT guarantee 8.3 when families are unequal (six of
 * one family and two of another interleaves to `A B A B A A A A`, whose tail is
 * all one family), so a **repair pass** follows: any candidate whose reviewer
 * set is entirely same-family is fixed by a 2-swap with another candidate. A
 * swap exchanges one reviewer between two candidates, so every load count is
 * unchanged by construction — balance survives the repair.
 *
 * ## Honest scope
 *
 * This is the assignment; **nothing calls it yet**. `k = N−1` reproduces the
 * shipped all-pairs behaviour exactly, which is what makes it a safe default
 * and what lets the comparison below be arithmetic rather than a claim about a
 * change nobody has made.
 *
 * Under the engine's current one-advisor-per-provider invariant
 * (`chairman.ts:16-18`) every member is its own family, so the diversity
 * constraint is **vacuously satisfied in production today**. It is implemented
 * and tested against multi-member-per-family sets anyway, because Phase 9's
 * advisor fan-out is what would produce them and the cheapest moment to have
 * the property is before it can be violated.
 *
 * Pure and offline: no provider call, no file read.
 */
import { deterministic_shuffle_indices } from './blind_review.js';

/** A council member, as assignment needs it. */
export interface ReviewMember {
    /** Member name — the identity used in the assignment maps. */
    readonly name: string;
    /** Provider family (`anthropic`, `openai`, …). Diversity is defined over this. */
    readonly family: string;
}

/** Candidate name → the reviewers assigned to it, in deterministic order. */
export type Assignment = ReadonlyMap<string, readonly string[]>;

export interface AssignmentResult {
    readonly assignment: Assignment;
    /** Reviewed pairs — the quantity 8.2 compares against both curves. */
    readonly pairs: number;
    /** Reviewers per candidate actually used, i.e. `min(k, N-1)`. */
    readonly effectiveK: number;
    /** How many 2-swaps the diversity repair performed. */
    readonly diversityRepairs: number;
    /**
     * Candidates left with an all-same-family reviewer set.
     *
     * "Available" in 8.3 has to mean available UNDER THE BALANCE CONSTRAINT,
     * not merely "a member of another family exists". Six members of family A
     * and two of family B at `k = 1` gives eight candidates and only two
     * B-reviewer slots, so four A candidates MUST be reviewed within their own
     * family — no assignment avoids it. {@link diversityCeiling} is that bound
     * made computable, and this list is the shortfall it predicts.
     */
    readonly unrepairable: readonly string[];
}

/**
 * The most candidates any balanced assignment can make diverse at this `(members, k)`.
 *
 * A candidate of family `F` needs a reviewer from outside `F`; there are
 * `n - |F|` such members and each reviews exactly `k` candidates, so family `F`
 * can place at most `min(|F|, k * (n - |F|))` diverse candidates. Summed over
 * families and capped at `n`.
 *
 * An UPPER BOUND, and stated as one: reviewer capacity is shared across
 * families, so a contrived family profile could in principle fall short of it.
 * Measured over 7 family profiles × every `k` in `1..n-1`, the greedy repair in
 * {@link assignReviewers} attains it in every case, and the test sweeps a wider
 * set — so the bound is treated as tight where it has been checked and as a
 * bound everywhere else.
 */
export function diversityCeiling(members: readonly ReviewMember[], k: number): number {
    const n = members.length;
    const eff = Math.max(0, Math.min(k, n - 1));
    const sizes = new Map<string, number>();
    for (const m of members) sizes.set(m.family, (sizes.get(m.family) ?? 0) + 1);
    let total = 0;
    for (const size of sizes.values()) total += Math.min(size, eff * (n - size));
    return Math.min(total, n);
}

/** Both curves 8.2 names, at one `(N, k)`. Pure arithmetic. */
export function costCurves(n: number, k: number): {
    n: number;
    k: number;
    pairs_quadratic: number;
    pairs_linear: number;
    ratio: number;
} {
    const eff = Math.max(0, Math.min(k, n - 1));
    const quad = n * (n - 1);
    const lin = n * eff;
    return { n, k: eff, pairs_quadratic: quad, pairs_linear: lin, ratio: quad === 0 ? 1 : lin / quad };
}

/**
 * Interleave members so that consecutive positions come from different families
 * wherever the family sizes allow it: repeatedly take one member from the
 * currently largest remaining family, preferring one different from the last
 * pick.
 *
 * TIES BREAK ON INPUT ORDER, NOT ON FAMILY NAME, and the difference is
 * load-bearing rather than stylistic. Under the engine's one-advisor-per-
 * provider invariant every family has size 1, so every comparison is a tie — a
 * name tie-break would then sort the whole council alphabetically and DISCARD
 * the seeded permutation entirely, making `assignReviewers` produce the same
 * assignment for every seed. Measured: the seed-sensitivity test reds under the
 * name tie-break at N=8. Bucket iteration order is the (already permuted) input
 * order and `Array.prototype.sort` is stable, so input-order ties keep the
 * result a pure function of the input while letting the seed through.
 */
export function interleaveByFamily(members: readonly ReviewMember[]): ReviewMember[] {
    const buckets = new Map<string, ReviewMember[]>();
    for (const m of members) {
        const b = buckets.get(m.family);
        if (b) b.push(m);
        else buckets.set(m.family, [m]);
    }
    const out: ReviewMember[] = [];
    let lastFamily = '';
    while (out.length < members.length) {
        const eligible = [...buckets.entries()].filter(([, v]) => v.length > 0);
        // Prefer a family different from the previous pick; fall back to any.
        const pool = eligible.filter(([f]) => f !== lastFamily);
        const pick = (pool.length > 0 ? pool : eligible).sort((a, b) => b[1].length - a[1].length)[0];
        if (pick === undefined) break;
        out.push((pick[1] as ReviewMember[]).shift() as ReviewMember);
        lastFamily = pick[0] as string;
    }
    return out;
}

/** Is this candidate reviewed by at least one different family? */
function _diverse(candidate: ReviewMember, reviewers: readonly string[], byName: ReadonlyMap<string, ReviewMember>): boolean {
    return reviewers.some((r) => (byName.get(r) as ReviewMember).family !== candidate.family);
}

/**
 * Assign `k` reviewers per candidate: balanced, self-review-free, diverse where
 * a cross-family reviewer exists, deterministic in `seed`.
 *
 * `k >= n-1` reproduces the shipped all-pairs behaviour exactly.
 */
export function assignReviewers(
    members: readonly ReviewMember[],
    k: number,
    seed: string,
): AssignmentResult {
    const n = members.length;
    const effectiveK = Math.max(0, Math.min(k, n - 1));
    const byName = new Map(members.map((m) => [m.name, m]));
    if (n < 2 || effectiveK === 0) {
        return {
            assignment: new Map(members.map((m) => [m.name, [] as string[]])),
            pairs: 0,
            effectiveK: 0,
            diversityRepairs: 0,
            unrepairable: [],
        };
    }

    // Seeded permutation first, then the family interleave over it: the seed
    // decides WHICH member sits where within a family, the interleave decides
    // that consecutive positions differ in family.
    const perm = deterministic_shuffle_indices(seed, n);
    const ordered = interleaveByFamily(perm.map((i) => members[i] as ReviewMember));

    const assignment = new Map<string, string[]>();
    for (let i = 0; i < n; i++) {
        const candidate = ordered[i] as ReviewMember;
        const reviewers: string[] = [];
        for (let d = 1; d <= effectiveK; d++) {
            reviewers.push((ordered[(i + d) % n] as ReviewMember).name);
        }
        assignment.set(candidate.name, reviewers);
    }

    // ── diversity repair ────────────────────────────────────────────────────
    // A 2-swap exchanges one reviewer between two candidates, so every
    // reviewer's load and every candidate's count are invariant.
    let diversityRepairs = 0;
    const unrepairable: string[] = [];
    const familyCounts = new Map<string, number>();
    for (const m of members) familyCounts.set(m.family, (familyCounts.get(m.family) ?? 0) + 1);

    for (const candidate of ordered) {
        const mine = assignment.get(candidate.name) as string[];
        if (_diverse(candidate, mine, byName)) continue;
        // Does a cross-family reviewer even exist for this candidate?
        if ((familyCounts.get(candidate.family) ?? 0) === n) {
            unrepairable.push(candidate.name);
            continue;
        }
        let fixed = false;
        for (const other of ordered) {
            if (other.name === candidate.name || fixed) continue;
            const theirs = assignment.get(other.name) as string[];
            for (const give of mine) {
                for (const take of theirs) {
                    if (fixed) break;
                    if (take === candidate.name || give === other.name) continue; // no self-review
                    if (theirs.includes(give) || mine.includes(take)) continue; // no duplicate reviewer
                    const takeM = byName.get(take) as ReviewMember;
                    if (takeM.family === candidate.family) continue; // does not help
                    const theirsAfter = theirs.map((r) => (r === take ? give : r));
                    if (!_diverse(other, theirsAfter, byName)) continue; // must not break them
                    mine[mine.indexOf(give)] = take;
                    assignment.set(other.name, theirsAfter);
                    diversityRepairs++;
                    fixed = true;
                }
            }
        }
        if (!fixed) unrepairable.push(candidate.name);
    }

    let pairs = 0;
    for (const v of assignment.values()) pairs += v.length;
    return { assignment, pairs, effectiveK, diversityRepairs, unrepairable };
}

/** Reviewer → how many candidates it reviews. The balance figure. */
export function reviewerLoads(assignment: Assignment): Map<string, number> {
    const loads = new Map<string, number>();
    for (const reviewers of assignment.values()) {
        for (const r of reviewers) loads.set(r, (loads.get(r) ?? 0) + 1);
    }
    return loads;
}

/** Candidates reviewed only by their own family, given the members. */
export function nonDiverseCandidates(assignment: Assignment, members: readonly ReviewMember[]): string[] {
    const byName = new Map(members.map((m) => [m.name, m]));
    const out: string[] = [];
    for (const [name, reviewers] of assignment) {
        const c = byName.get(name);
        if (c === undefined || reviewers.length === 0) continue;
        if (!_diverse(c, reviewers, byName)) out.push(name);
    }
    return out.sort();
}

/** Was a cross-family reviewer available for this candidate at all? */
export function crossFamilyAvailable(candidate: string, members: readonly ReviewMember[]): boolean {
    const c = members.find((m) => m.name === candidate);
    if (c === undefined) return false;
    return members.some((m) => m.name !== candidate && m.family !== c.family);
}
