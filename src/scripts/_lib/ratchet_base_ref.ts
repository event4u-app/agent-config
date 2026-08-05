/**
 * Shrink-only, enforced against the base ref instead of against a count.
 *
 * WHY THIS EXISTS. Every ratchet in this tree is shrink-only *by convention*
 * plus a count comparison — and a count comparison permits
 * swap-one-out-add-one-in. Removing a real entry and adding a fresh suppression
 * in the same change keeps the number flat, passes the gate, and moves the
 * estate backwards. The count cannot see it, because the count is the same.
 *
 * The fix is to compare the entry *sets*, and to read the "before" side from
 * the base ref rather than from a checked-in number that the same commit can
 * edit. `git show <baseRef>:<path>` is the only reading of the baseline that
 * the change under review cannot rewrite.
 *
 * **Renames are read from git.** Moving a file must not read as growth: an
 * entry keyed on a path that git reports as a rename of a path present at base
 * is the same entry, relocated. Without this, the first legitimate refactor
 * that moves an allowlisted file blocks itself, the gate gets a reputation for
 * false reds, and someone turns it off — the gate-fatigue failure this
 * repository has already recorded.
 *
 * **A deliberate reset is reported, never silent.** A real tooling change can
 * legitimately re-baseline. That path exists ({@link RATCHET_RESET_KEY}) and
 * costs a visible one-line diff carrying a reason; what it does not do is let
 * the reset pass unannounced.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';

/**
 * Opt-in key that marks a baseline as deliberately re-based.
 *
 * Present with a non-empty string reason ⇒ growth is reported rather than
 * thrown. The key lives in the baseline JSON itself so it shows up in the diff
 * of the very commit that performs the reset.
 */
export const RATCHET_RESET_KEY = '__ratchet_reset__';

/**
 * Find a usable "before" ref, in descending order of trustworthiness.
 *
 * This ladder exists because the obvious answer — `origin/main` — is the one
 * that is NOT available where it matters most. `actions/checkout` performs a
 * shallow PR-merge fetch, so a PR build has no `origin/main` remote-tracking
 * ref, and this repository has already recorded that `git fetch origin <base>`
 * can race with the configured auth extraheader on some runners. The merge
 * commit's first parent IS the base on exactly those builds, and it needs no
 * network at all.
 *
 * Returns `null` when nothing resolves; callers decide, and the honest default
 * is to fail rather than to compare against an assumed-empty base.
 */
export function resolveBaseRef(
    repoRoot: string,
    env: NodeJS.ProcessEnv = process.env,
    git: (args: readonly string[], cwd: string) => { ok: boolean; stdout: string; stderr: string } = runGit,
): string | null {
    const resolves = (ref: string): boolean =>
        git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], repoRoot).ok;

    const explicit = env['RATCHET_BASE_REF'];
    if (explicit !== undefined && explicit !== '' && resolves(explicit)) {
        return explicit;
    }
    const ghBase = env['GITHUB_BASE_REF'];
    if (ghBase !== undefined && ghBase !== '') {
        for (const candidate of [`origin/${ghBase}`, ghBase]) {
            if (resolves(candidate)) {
                return candidate;
            }
        }
    }
    // A PR-merge checkout: HEAD is the synthetic merge, HEAD^1 is the base tip.
    //
    // Gated on GITHUB_ACTIONS because "HEAD has two parents" is NOT specific to
    // a PR-merge checkout: a feature branch that merged main back in has a merge
    // commit at its tip too, and taking HEAD^1 there compares the branch against
    // its own previous commit — a base so recent that every real change looks
    // like growth. Observed on the first run of this resolver.
    if (env['GITHUB_ACTIONS'] === 'true') {
        const parents = git(['rev-list', '--parents', '-n', '1', 'HEAD'], repoRoot);
        if (parents.ok && parents.stdout.trim().split(/\s+/).length >= 3 && resolves('HEAD^1')) {
            return 'HEAD^1';
        }
    }
    for (const candidate of ['origin/main', 'main']) {
        if (resolves(candidate)) {
            return candidate;
        }
    }
    return null;
}

/** Raised when the working copy carries entries the base ref does not. */
export class RatchetGrowthError extends Error {
    readonly baselinePath: string;
    readonly added: readonly string[];

    constructor(baselinePath: string, baseRef: string, added: readonly string[]) {
        const shown = added.slice(0, 20);
        const more = added.length - shown.length;
        super(
            `${baselinePath}: ${String(added.length)} entry(ies) present in the working copy and ` +
                `absent at ${baseRef} — this baseline is shrink-only, and a flat count is not ` +
                'evidence of that (removing one entry while adding another keeps the number ' +
                `identical). Added: ${shown.join(', ')}${more > 0 ? ` … and ${String(more)} more` : ''}. ` +
                `If this is a deliberate re-baseline, add "${RATCHET_RESET_KEY}": "<reason>" to the ` +
                'file in the same commit so the reset is reviewable instead of silent.',
        );
        this.name = 'RatchetGrowthError';
        this.baselinePath = baselinePath;
        this.added = added;
    }
}

/** Raised when the base ref cannot be read, so no honest comparison exists. */
export class BaseRefUnavailableError extends Error {
    constructor(baseRef: string, detail: string) {
        super(
            `cannot read the baseline at ${baseRef}: ${detail}. A ratchet that cannot see its ` +
                '"before" has not verified anything — fetch the base ref (CI needs more than a ' +
                'depth-1 clone) rather than treating the missing side as empty.',
        );
        this.name = 'BaseRefUnavailableError';
    }
}

export type RatchetVerdict = 'ok' | 'growth' | 'reset' | 'new_baseline';

export interface RatchetComparison {
    verdict: RatchetVerdict;
    /** Entries in the working copy that are absent at the base ref. */
    added: string[];
    /** Entries at the base ref that are absent in the working copy — the wanted direction. */
    removed: string[];
    /** Entries counted as unchanged because git reports the path as a rename. */
    renamed: Array<{ from: string; to: string }>;
    baseCount: number;
    headCount: number;
    /** Present only when the baseline carries {@link RATCHET_RESET_KEY}. */
    resetReason?: string;
}

export interface RatchetBaseRefOptions {
    /** Repo-relative path to the baseline file. */
    baselinePath: string;
    /** Ref to read the "before" side from, e.g. `origin/main`. */
    baseRef: string;
    /** Absolute repo root. */
    repoRoot: string;
    /**
     * Extract the comparable entry keys from a parsed baseline.
     *
     * Defaults to {@link defaultEntriesOf}, which covers the two shapes this
     * repo actually uses: a JSON array of strings, and a JSON object keyed by
     * entry. A baseline with a nested shape passes its own extractor.
     */
    entriesOf?: (parsed: unknown) => string[];
    /**
     * Accept a baseline that does not exist at `baseRef` as genuinely new.
     *
     * Off by default: absent-at-base and mistyped-path look identical, and the
     * silent-pass consequence of guessing wrong is the failure this module is
     * built against. Turn it on for exactly the one change that introduces the
     * baseline, then remove it.
     */
    allowNewBaseline?: boolean;
    /** Injection seam for tests; defaults to a real `git` invocation. */
    git?: (args: readonly string[], cwd: string) => { ok: boolean; stdout: string; stderr: string };
}

/** Run git, capturing output without throwing on a non-zero exit. */
function runGit(args: readonly string[], cwd: string): { ok: boolean; stdout: string; stderr: string } {
    const res = spawnSync('git', [...args], { cwd, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
    if (res.error) {
        return { ok: false, stdout: '', stderr: res.error.message };
    }
    return { ok: res.status === 0, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

/**
 * Entry keys for the two baseline shapes in this repository.
 *
 * - array of strings → the strings themselves;
 * - array of objects → each object's `path`, `id`, `key`, `entry`, or `file`
 *   field, whichever it carries first, falling back to its stable JSON form;
 * - object → its own keys.
 *
 * {@link RATCHET_RESET_KEY} is never an entry.
 */
export function defaultEntriesOf(parsed: unknown): string[] {
    if (Array.isArray(parsed)) {
        return parsed.map((item) => {
            if (typeof item === 'string') {
                return item;
            }
            if (item !== null && typeof item === 'object') {
                const rec = item as Record<string, unknown>;
                for (const field of ['path', 'id', 'key', 'entry', 'file']) {
                    const v = rec[field];
                    if (typeof v === 'string' && v !== '') {
                        return v;
                    }
                }
            }
            return JSON.stringify(item);
        });
    }
    if (parsed !== null && typeof parsed === 'object') {
        return Object.keys(parsed as Record<string, unknown>).filter((k) => k !== RATCHET_RESET_KEY);
    }
    return [];
}

function resetReasonOf(parsed: unknown): string | undefined {
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const v = (parsed as Record<string, unknown>)[RATCHET_RESET_KEY];
        if (typeof v === 'string' && v.trim() !== '') {
            return v.trim();
        }
    }
    return undefined;
}

/**
 * Map every renamed path at HEAD back to its name at `baseRef`.
 *
 * `-M` is what makes a moved allowlist entry read as the same entry rather
 * than as one deletion plus one addition.
 */
function renameMap(
    baseRef: string,
    repoRoot: string,
    git: NonNullable<RatchetBaseRefOptions['git']>,
): Map<string, string> {
    const out = new Map<string, string>();
    const res = git(['diff', '--name-status', '-M', `${baseRef}...HEAD`], repoRoot);
    if (!res.ok) {
        return out;
    }
    for (const line of res.stdout.split('\n')) {
        const parts = line.split('\t');
        const status = parts[0];
        if (status === undefined || !status.startsWith('R')) {
            continue;
        }
        const from = parts[1];
        const to = parts[2];
        if (from !== undefined && to !== undefined) {
            out.set(to, from);
        }
    }
    return out;
}

/**
 * Compare a baseline's entry set against the same file at `baseRef`.
 *
 * @throws {BaseRefUnavailableError} when the base ref cannot be read.
 */
export function compareToBaseRef(opts: RatchetBaseRefOptions): RatchetComparison {
    const git = opts.git ?? runGit;
    const entriesOf = opts.entriesOf ?? defaultEntriesOf;
    const absolute = path.join(opts.repoRoot, opts.baselinePath);

    let headRaw: string;
    try {
        headRaw = fs.readFileSync(absolute, 'utf-8');
    } catch (e) {
        throw new BaseRefUnavailableError(opts.baseRef, `working-copy baseline unreadable: ${String(e)}`);
    }

    const refCheck = git(['rev-parse', '--verify', '--quiet', `${opts.baseRef}^{commit}`], opts.repoRoot);
    if (!refCheck.ok) {
        throw new BaseRefUnavailableError(opts.baseRef, 'ref does not resolve in this clone');
    }

    // A baseline absent at base is EITHER a genuinely new ratchet OR a typo in
    // `baselinePath`. Those two are indistinguishable from here, and treating
    // the missing side as an empty set would make a mistyped path pass forever
    // while comparing against nothing — the dead-scan-root shape, one level up.
    // So it is fail-closed, and introducing a new baseline is an explicit
    // opt-in the reviewer sees at the call site.
    const show = git(['show', `${opts.baseRef}:${opts.baselinePath}`], opts.repoRoot);
    if (!show.ok && opts.allowNewBaseline !== true) {
        throw new BaseRefUnavailableError(
            opts.baseRef,
            `no such file at that ref (${opts.baselinePath}). If the baseline is genuinely new in ` +
                'this change, pass allowNewBaseline; if it is not, the path is wrong and this gate ' +
                'would otherwise compare against an empty set forever',
        );
    }
    const baseEntries = show.ok ? entriesOf(JSON.parse(show.stdout)) : [];

    const headParsed: unknown = JSON.parse(headRaw);
    const headEntries = entriesOf(headParsed);

    const renames = renameMap(opts.baseRef, opts.repoRoot, git);
    const baseSet = new Set(baseEntries);
    const headSet = new Set(headEntries);

    const added: string[] = [];
    const renamed: Array<{ from: string; to: string }> = [];
    for (const entry of headEntries) {
        if (baseSet.has(entry)) {
            continue;
        }
        const previous = renames.get(entry);
        if (previous !== undefined && baseSet.has(previous)) {
            renamed.push({ from: previous, to: entry });
            continue;
        }
        added.push(entry);
    }
    const removed = baseEntries.filter((e) => !headSet.has(e) && !renamed.some((r) => r.from === e));

    const resetReason = resetReasonOf(headParsed);
    let verdict: RatchetVerdict;
    if (!show.ok) {
        verdict = 'new_baseline';
    } else if (added.length === 0) {
        verdict = 'ok';
    } else {
        verdict = resetReason !== undefined ? 'reset' : 'growth';
    }

    const comparison: RatchetComparison = {
        verdict,
        added,
        removed,
        renamed,
        baseCount: baseEntries.length,
        headCount: headEntries.length,
    };
    if (resetReason !== undefined) {
        comparison.resetReason = resetReason;
    }
    return comparison;
}

/**
 * Assert a baseline gained no entries relative to `baseRef`.
 *
 * @throws {RatchetGrowthError} on growth without a declared reset.
 * @throws {BaseRefUnavailableError} when the base ref cannot be read.
 */
export function assertNoNewEntries(opts: RatchetBaseRefOptions): RatchetComparison {
    const comparison = compareToBaseRef(opts);
    if (comparison.verdict === 'growth') {
        throw new RatchetGrowthError(opts.baselinePath, opts.baseRef, comparison.added);
    }
    return comparison;
}

/**
 * One-line human summary of a comparison, for a gate's green path.
 *
 * A reset is stated out loud, because a re-baseline that reads like a normal
 * pass is the same silence this module removes.
 */
export function describeComparison(baselinePath: string, c: RatchetComparison): string {
    const base = `${baselinePath}: ${String(c.headCount)} entry(ies), ${String(c.baseCount)} at base`;
    const moved = c.renamed.length > 0 ? `, ${String(c.renamed.length)} renamed` : '';
    if (c.verdict === 'new_baseline') {
        return `${base}${moved} — NEW BASELINE (absent at base; nothing to ratchet against yet)`;
    }
    if (c.verdict === 'reset') {
        return `${base}${moved} — RE-BASELINED (+${String(c.added.length)}): ${c.resetReason ?? ''}`;
    }
    return `${base}${moved}, ${String(c.removed.length)} removed since base`;
}
