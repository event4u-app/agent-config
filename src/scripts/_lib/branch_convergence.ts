/**
 * Per-target branch-convergence policy — does the DEFAULT branch belong in the
 * integration set when a PR targets something else?
 *
 * Decided by AI council on 2026-09-03 (`anthropic/claude-sonnet-4-5` +
 * `openai/codex-default`) for the `cascade-default-inclusion-policy` blocker of
 * `road-to-cascading-base-integration`. Both seats independently rejected the
 * two offered answers — always-include, and include-past-a-commit-distance —
 * and named the same third one: an explicit per-target policy read from
 * repository intent. A commit-distance threshold was refused by both as an
 * unmeasured constant.
 *
 * The load-bearing property is WHERE the policy is read from, and both seats
 * called it non-negotiable: **the resolved PR target commit SHA, and nothing
 * else.** Reading it from the PR head, the checkout, or an unpinned branch name
 * lets a reviewed change edit its own acceptance criteria — the confused-deputy
 * bypass. One seat: *"I would block any implementation reading policy from PR
 * head, checkout state, or unpinned branch name."* So this module takes a
 * `targetSha` it never resolves itself and a reader that can only answer at a
 * SHA; there is deliberately no filesystem access anywhere in it.
 *
 * ── Where the policy file lives, and why it is NOT `.agent-settings.yml` ──
 *
 * The council's specification named `.agent-settings.yml`, section
 * `branchConvergence`, on the premise that it is a committed file. In this
 * repository, and in every consumer this package installs into, it is not:
 * `.gitignore:317` ignores it here, and `src/config/gitignore-block.txt:56`
 * writes that same ignore into every consumer's managed block. `git show
 * <sha>:.agent-settings.yml` therefore returns nothing at every SHA in every
 * repository this ships to, which would make the policy permanently unreadable
 * and the feature dead on arrival.
 *
 * A SHA-pinned read requires a TRACKED file. The architecture the council
 * specified is kept byte for byte — same section name, same shape, same
 * exclusive read from the target SHA — and only the path moves, to a tracked
 * repo-root file. If `.agent-settings.yml` ever becomes tracked, the
 * `branchConvergence:` section moves across unchanged.
 *
 * Deferred by explicit council instruction and not to be added without
 * reopening that decision: globs, pattern precedence, inheritance, configurable
 * reason strings, and any repository-wide fallback policy.
 */
import { parse as parseYaml } from 'yaml';

/** The tracked, SHA-readable file the policy is read from. */
export const POLICY_PATH = '.branch-convergence.yml';

/** The only two answers a target may give. Closed by council instruction. */
export type DefaultBranchPolicy = 'include' | 'exclude';

export interface BranchConvergenceTarget {
    readonly defaultBranch: DefaultBranchPolicy;
}

export interface BranchConvergencePolicy {
    readonly enabled: boolean;
    /** Keyed by EXACT target branch name (`release/1.x`), never a pattern. */
    readonly targets: Readonly<Record<string, BranchConvergenceTarget>>;
}

/**
 * Read one path at one commit. Returns `null` when the path does not exist at
 * that commit — which is a real answer, not an error.
 *
 * The signature takes the SHA FIRST and offers no way to ask for the working
 * tree. That is the trust boundary expressed in a type: a caller cannot
 * accidentally read the PR head, because there is no argument for it.
 */
export type ShaFileReader = (sha: string, repoPath: string) => string | null;

/** The target is not the default branch and no exact entry names it. */
export class MissingBranchConvergencePolicy extends Error {
    readonly target: string;
    constructor(target: string) {
        super(`MissingBranchConvergencePolicy(target="${target}")`);
        this.name = 'MissingBranchConvergencePolicy';
        this.target = target;
    }
}

/** The policy exists at the target SHA but does not validate. */
export class InvalidBranchConvergencePolicy extends Error {
    constructor(detail: string) {
        super(`InvalidBranchConvergencePolicy: ${detail}`);
        this.name = 'InvalidBranchConvergencePolicy';
    }
}

/** The PR target names no commit the server will report. Fails closed. */
export class UnresolvableTargetSha extends Error {
    readonly target: string;
    constructor(target: string) {
        super(`UnresolvableTargetSha(target="${target}")`);
        this.name = 'UnresolvableTargetSha';
        this.target = target;
    }
}

const TARGET_KEYS = new Set(['defaultBranch']);
const ROOT_KEYS = new Set(['enabled', 'targets']);

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Parse and validate the `branchConvergence` section of a policy document.
 *
 * Exported separately from the SHA read so the VALIDATION is testable without a
 * git object, for the same reason `classifyConflicts` is pure in
 * `sync_pr_branch.ts`: the rejection of a malformed policy is the useful part,
 * and a validator only reachable through a git call is a validator nobody
 * covers.
 *
 * Duplicate keys are rejected by the YAML parser itself (`uniqueKeys` is on by
 * default in `yaml` v2), so a target named twice is a parse failure rather than
 * a silent last-wins.
 */
export function parseBranchConvergencePolicy(text: string): BranchConvergencePolicy | null {
    let doc: unknown;
    try {
        doc = parseYaml(text);
    } catch (exc) {
        throw new InvalidBranchConvergencePolicy(exc instanceof Error ? exc.message : String(exc));
    }
    if (!isPlainObject(doc)) {
        return null;
    }
    const section = doc['branchConvergence'];
    if (section === undefined) {
        return null;
    }
    if (!isPlainObject(section)) {
        throw new InvalidBranchConvergencePolicy('`branchConvergence` is not a mapping');
    }
    for (const k of Object.keys(section)) {
        if (!ROOT_KEYS.has(k)) {
            throw new InvalidBranchConvergencePolicy(`unknown field \`branchConvergence.${k}\``);
        }
    }
    const enabled = section['enabled'];
    if (typeof enabled !== 'boolean') {
        throw new InvalidBranchConvergencePolicy('`enabled` must be true or false');
    }
    const rawTargets = section['targets'] ?? {};
    if (!isPlainObject(rawTargets)) {
        throw new InvalidBranchConvergencePolicy('`targets` must be a mapping');
    }
    const targets: Record<string, BranchConvergenceTarget> = {};
    for (const [name, entry] of Object.entries(rawTargets)) {
        if (!isPlainObject(entry)) {
            throw new InvalidBranchConvergencePolicy(`\`targets.${name}\` is not a mapping`);
        }
        for (const k of Object.keys(entry)) {
            if (!TARGET_KEYS.has(k)) {
                throw new InvalidBranchConvergencePolicy(`unknown field \`targets.${name}.${k}\``);
            }
        }
        const v = entry['defaultBranch'];
        if (v !== 'include' && v !== 'exclude') {
            throw new InvalidBranchConvergencePolicy(
                `\`targets.${name}.defaultBranch\` must be include or exclude, got ${JSON.stringify(v)}`,
            );
        }
        targets[name] = { defaultBranch: v };
    }
    return { enabled, targets };
}

/**
 * The policy as the PR TARGET carries it, at the target's own commit.
 *
 * `null` means the file does not exist at that commit. That is not an error
 * here — it becomes `MissingBranchConvergencePolicy` one layer up, and only for
 * a target that actually needs an entry.
 */
export function loadPolicyAtSha(targetSha: string, read: ShaFileReader): BranchConvergencePolicy | null {
    if (!/^[0-9a-f]{7,40}$/.test(targetSha)) {
        throw new InvalidBranchConvergencePolicy(`\`targetSha\` is not a commit id: ${JSON.stringify(targetSha)}`);
    }
    const text = read(targetSha, POLICY_PATH);
    if (text === null) {
        return null;
    }
    return parseBranchConvergencePolicy(text);
}
