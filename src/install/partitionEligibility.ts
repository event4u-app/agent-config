/**
 * The single-delivery partition predicate — one artefact, one layer.
 *
 * ## What it decides
 *
 * Two layers deliver agent artefacts: a machine-local project layer at
 * `<repo>/.claude/` (gitignored, 0 tracked files, rewritten by every
 * `task generate-tools`) and a host-global layer at `~/.claude/` (written by
 * `agent-config install`, never by the build). Measured 2026-08-19 on a freshly
 * regenerated tree: **110 rules arrive twice**, and standing rule prose is
 * 203,873 tokens against a 110,000 cap (185.3 %).
 *
 * ADR-236 partitions them: an artefact that exists ONLY for this package stays
 * in the project layer; everything else is delivered only globally. That takes
 * `<repo>/.claude/` from 111 rules and 338 skills to **16 rules and zero
 * skills**.
 *
 * ## Why the predicate is fail-safe and never fails the build
 *
 * The partition is a removal, so the build loses its repair path: it can no
 * longer heal a stale global layer by regenerating, because it stops writing
 * those files. Every uncertainty therefore resolves to `standalone/full` — the
 * pre-partition behaviour — and **never** to a refusal:
 *
 * `.github/workflows/consistency.yml:169` runs `task generate-tools` on a fresh
 * checkout where, by that workflow's own comment at `:172-174`, the host rule
 * trees are gitignored and absent. An option that made a missing global layer a
 * hard failure was eliminated by that fact in the 2026-08-19 council round, not
 * by preference. Under-governing a checkout is the one regression this estate
 * exists to prevent; breaking the Consistency pipeline is the other. Full
 * projection is the only branch that does neither.
 *
 * ## Why content and not a version number
 *
 * Rationale and the 153-skill measurement that decided it: see
 * `hostLayerFingerprint.ts`. Version equality is checked too, but as a cheap
 * pre-filter — it is necessary, never sufficient.
 *
 * ## Contract
 *
 * Side-effect-free, no I/O of its own (callers supply the facts), no CLI entry,
 * no `process.exit`. Ships inside the consumer installer bundle, same
 * constraint as `ruleInScope.ts`.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';

import { parseFrontmatter } from './ruleInScope.js';
import { fingerprintLayers, hostLayerInputs } from './hostLayerFingerprint.js';
import {
    current_package_version,
    read_lockfile,
    write_lockfile,
} from '../scripts/_lib/installed_lock.js';

/** The workspace id that marks an artefact as existing only for this package. */
export const MAINTAINER_WORKSPACE = 'agent-config-maintainer';

/** Delivery mode the build selected, and prints. */
export type PartitionMode = 'standalone/full' | 'dual-layer/partitioned';

export interface PartitionVerdict {
    readonly mode: PartitionMode;
    /** One clause, printable, saying WHY this mode was selected. */
    readonly reason: string;
}

/** The lockfile fields the predicate reads — a structural subset. */
export interface LockfileFacts {
    readonly agent_config_version?: string | undefined;
    readonly host_layer_fingerprint?: string | undefined;
}

export interface PartitionInputs {
    /** `package.json` version of the checkout being built. */
    readonly projectVersion: string;
    /** Parsed `installed.lock`, or `null` when no global install is recorded. */
    readonly lockfile: LockfileFacts | null;
    /** Does the host layer exist on disk at all? */
    readonly hostLayerPresent: boolean;
    /**
     * Fingerprint this checkout expects the host layer to carry. Lazy on
     * purpose: every disqualifying branch above it returns without paying the
     * ~100 ms hash.
     */
    readonly expectedFingerprint: () => string;
}

/**
 * Select the delivery mode. Total function: always returns a verdict, never
 * throws, never refuses.
 *
 * The order of the guards is the fail-safe order — cheapest and most decisive
 * first, so the fingerprint is computed only when everything else already
 * agrees.
 */
export function partitionVerdict(inputs: PartitionInputs): PartitionVerdict {
    if (!inputs.hostLayerPresent) {
        return {
            mode: 'standalone/full',
            reason: 'no host-global layer on this machine',
        };
    }
    const lock = inputs.lockfile;
    if (lock === null) {
        return {
            mode: 'standalone/full',
            reason: 'host layer present but no install record (installed.lock absent)',
        };
    }
    const recorded = lock.agent_config_version;
    if (!recorded) {
        return {
            mode: 'standalone/full',
            reason: 'install record carries no version',
        };
    }
    // Exact equality, deliberately not `>=`. A NEWER global layer is not a
    // superset: a later release may have renamed or removed an artefact this
    // checkout still expects, and ordering does not establish substitutability.
    if (recorded !== inputs.projectVersion) {
        return {
            mode: 'standalone/full',
            reason: `version mismatch (installed ${recorded}, building ${inputs.projectVersion})`,
        };
    }
    const installedFp = lock.host_layer_fingerprint;
    if (!installedFp) {
        return {
            mode: 'standalone/full',
            reason: 'install predates host-layer fingerprinting — re-run `agent-config install` to enable the partition',
        };
    }
    let expected: string;
    try {
        expected = inputs.expectedFingerprint();
    } catch {
        return {
            mode: 'standalone/full',
            reason: 'could not compute the expected host-layer fingerprint',
        };
    }
    if (installedFp !== expected) {
        return {
            mode: 'standalone/full',
            reason: 'host-layer content differs from this checkout — re-run `agent-config install`',
        };
    }
    return {
        mode: 'dual-layer/partitioned',
        reason: `host layer verified at ${recorded} (fingerprint ${installedFp.slice(0, 12)})`,
    };
}

/**
 * Does this artefact exist ONLY for this package?
 *
 * True iff `workspaces:` is present, non-empty, and its every entry is
 * {@link MAINTAINER_WORKSPACE}. Measured 2026-08-20: exactly **16** rules in
 * `src/rules/` satisfy this — the figure ADR-236 partitions on.
 *
 * The direction of the default is the opposite of `rule_in_scope`'s, and that
 * is deliberate rather than an inconsistency. There, an untagged artefact ships
 * — over-shipping is the safe error for a scope filter. Here, an untagged
 * artefact is NOT package-only, so it is delivered globally and withheld from
 * the project layer. Both defaults resolve toward "the artefact is generally
 * useful"; only one of them is about withholding.
 *
 * ## The state space, MEASURED rather than enumerated defensively (2026-08-21)
 *
 * Three of this function's branches — unreadable file, absent `workspaces:`,
 * empty list — all resolve to `false`, and the closure review asked whether one
 * of them was resolving by accident. Counted over all 119 files in `src/rules/`:
 *
 *     absent=0 · empty=0 · maintainer-only=16 · mixed=103 · scalar-or-other=0
 *
 * So exactly TWO states occur today, both deliberate, and the 16 is the figure
 * ADR-236 partitions on.
 *
 * **The other three branches are CURRENTLY ABSENT from the generated tree, not
 * unreachable** — an earlier revision of this note said "the state space is
 * closed by that count", and a neutral review was right to refuse it. A file can
 * become unreadable at runtime (permissions, a partial write, a truncated
 * checkout) and a rule can acquire a malformed `workspaces:` on any commit. The
 * count is a current inventory, never a proof of impossibility.
 *
 * What the count DOES buy is a bound on the defensive work worth doing now:
 * fixtures for the absent and malformed cases would pin behaviour on inputs no
 * committed rule produces, so they were not written. All three branches already
 * resolve to `false` — deliver globally, withhold from the project layer — which
 * is the over-delivery direction rather than the losing one, so the untested
 * branches fail safe. Should that count move, this note is the thing that dates.
 */
export function isExclusivelyPackageOnly(source_path: string): boolean {
    let meta: Record<string, unknown>;
    try {
        [meta] = parseFrontmatter(fs.readFileSync(source_path, 'utf-8'));
    } catch {
        return false; // unreadable → not package-only → delivered globally
    }
    const raw = meta['workspaces'];
    if (!Array.isArray(raw) || raw.length === 0) {
        return false;
    }
    return raw.every((w) => String(w) === MAINTAINER_WORKSPACE);
}

/** Emitter for the ONE mode line; see the visibility note on the resolver. */
export type Announce = (message: string) => void;

let _memo: PartitionVerdict | null = null;
let _announce: Announce = (m) => process.stdout.write(`${m}\n`);

/**
 * Install the emitter used for the mode line. Callers pass a function visible at
 * their DEFAULT output level — the first implementation used one that prints only
 * at `verbose`, which withheld ~100 rules while saying nothing in a normal run.
 */
export function setPartitionAnnounce(fn: Announce): void {
    _announce = fn;
}

/** Test seam — drop the memo so one process can exercise both delivery modes. */
export function _resetPartitionVerdictForTest(): void {
    _memo = null;
}

/**
 * Is the partition active for this generation? Memoised per process, because the
 * fingerprint costs ~100 ms and the answer cannot change mid-run.
 *
 * This is the single entry point the generators call, deliberately: wiring a
 * feature into two files that are already past the 1,500-line source ceiling
 * costs a ratchet violation per line, so the decision, its fail-safe ordering,
 * its printed reason and its memo all live here and the call sites are one line
 * each.
 */
export function partitionActive(projectRoot: string): boolean {
    return resolvePartitionVerdict(projectRoot).mode === 'dual-layer/partitioned';
}

/**
 * Resolve the delivery mode for one generation, and say so once.
 *
 * Lives here rather than in `condense.ts` for two reasons. The decision belongs
 * beside {@link partitionVerdict}, whose fail-safe ordering it depends on; and
 * `condense.ts` is 1,500+ lines, where the source-size ratchet counts every
 * added line as a violation — so a block that has no reason to live there is a
 * cost as well as a misplacement.
 *
 * **Both council seats (2026-08-20, 2/2) required that generation PRINT the mode
 * it selected** rather than partition silently: a withheld artefact nobody
 * announced is exactly the under-governance the partition exists to remove. The
 * caller supplies `announce`, and the level matters — the first implementation
 * used an `info()` that prints only at `verbose`, so it withheld ~100 rules while
 * saying nothing in a default run. Pass a function that is visible at the default
 * level. Residual, stated: at an explicitly silent output level the line is
 * dropped; that is an operator choice and the partition stays fail-safe anyway.
 *
 * The fingerprint compares the host layer against **what the installer recorded
 * when it wrote that layer**, not against a re-derivation from source. That
 * avoids guessing the installer's byte representation — a mismatch there would
 * make the partition permanently unreachable rather than merely inactive — and it
 * is the property the partition needs: the omitted artefacts are still present,
 * in the form this version's installer left them.
 *
 * **Known residual:** an installer that crashes mid-write and still reaches the
 * lockfile would fingerprint its own partial layer, and that fingerprint then
 * verifies. Ordering narrows the window (the lockfile is written last) without
 * closing it; a per-artefact manifest would close it and is not built here.
 */
export function resolvePartitionVerdict(projectRoot: string): PartitionVerdict {
    if (_memo !== null) {
        return _memo;
    }
    const layers = hostLayerInputs(os.homedir());
    const present = layers.some((l) => {
        try {
            return fs.statSync(l.root).isDirectory();
        } catch {
            return false;
        }
    });
    let lock: LockfileFacts | null = null;
    try {
        lock = read_lockfile();
    } catch {
        lock = null; // unreadable record → fail safe
    }
    _memo = partitionVerdict({
        projectVersion: current_package_version(projectRoot),
        lockfile: lock,
        hostLayerPresent: present,
        expectedFingerprint: () => fingerprintLayers(layers),
    });
    _announce(`projection mode: ${_memo.mode} — ${_memo.reason}`);
    return _memo;
}

/**
 * Stamp the host-layer content fingerprint into the install record.
 *
 * The write side of the partition, and what makes it reachable at all: the build
 * withholds artefacts only when this fingerprint matches what it finds on disk.
 * No fingerprint recorded → full projection, which is the safe direction.
 *
 * **Call it AFTER the deploy and after the failed-tool postcheck.** The install
 * writes its lockfile once before the redeploy; a fingerprint taken there would
 * describe the PREVIOUS install and then verify against a layer this run
 * replaced. Both council seats required the record be written last, and this is
 * the function that respects it.
 *
 * On failure it reports and writes NOTHING. A missing fingerprint is fail-safe; a
 * wrong one would authorise a partition against an unverified layer, so the two
 * errors are not symmetric and this must never prefer the second.
 *
 * Lives here rather than inline in `install.ts` for the same reason
 * {@link resolvePartitionVerdict} does: it belongs beside the predicate it
 * serves, and `install.ts` is 5,000+ lines where the source-size ratchet counts
 * every added line.
 *
 * @returns the fingerprint written, or `null` when nothing was recorded.
 */
export function stampHostLayerFingerprint(
    installedVersion: string,
    tools: readonly string[],
    lockfilePath: string,
    /** Skip entirely — e.g. when the claude-code deploy itself failed. */
    skip: boolean,
    report: Announce,
): string | null {
    if (skip) {
        return null;
    }
    try {
        const fingerprint = fingerprintLayers(hostLayerInputs(os.homedir()));
        write_lockfile(installedVersion, [...tools], {
            path: lockfilePath,
            host_layer_fingerprint: fingerprint,
        });
        report(`Host-layer fingerprint recorded: ${fingerprint.slice(0, 12)} (enables single delivery)`);
        return fingerprint;
    } catch (e) {
        report(
            `Host-layer fingerprint NOT recorded (${String(e)}) — the project layer keeps the full projection.`,
        );
        return null;
    }
}

/**
 * Per-tool-directory persona list under the partition — ADR-236's closure for the
 * one family it never reached.
 *
 * The partition shipped for rules and skills and stopped there, so
 * `<repo>/.claude/personas` kept being written while `~/.claude/personas` was
 * installed from `_CLAUDE_SKILL_BUNDLE` (`install.ts:1916-1921`). Measured
 * 2026-08-21 on a freshly regenerated tree with the partition ACTIVE: **29 shared
 * names**, and neither `check_single_delivery` nor `_lib/layer_overlap_notice`
 * looked, because `personas` was in neither's `TYPES`.
 *
 * ## Two properties the caller depends on
 *
 * **Scoped to `.claude/` only.** {@link partitionActive} verifies the CLAUDE host
 * layer against `installed.lock`. It says nothing about `~/.cursor`, so
 * withholding a cursor persona on the strength of a claude fingerprint would
 * deliver it nowhere — the one failure the fail-safe design exists to prevent.
 * Every other tool directory keeps the full projection.
 *
 * **Reconciliation is the empty list, not a second code path.** The caller's
 * stale-symlink sweep removes any link whose name is absent from the list it was
 * given for that directory, so returning `[]` empties a directory an earlier
 * version populated. A gate that only declined to WRITE would leave the existing
 * duplicate standing — a partition that stops new duplication and keeps the old
 * is not a partition.
 *
 * Verified before shipping: every one of the 29 project personas is present in
 * the global layer (32 there, a strict superset). The partition is a removal and
 * has no repair path, so withholding is only safe once the surviving layer is
 * known to carry what is withheld.
 */
export function personaPartition(
    projectRoot: string,
    all: readonly string[],
): {
    readonly all: readonly string[];
    listFor: (toolDir: string) => readonly string[];
    readonly note: string;
    /**
     * Per-directory count, for the caller's success line.
     *
     * Added after a neutral review (2026-08-21) caught the message claiming
     * `N personas each` across every tool directory while `.claude/` had
     * received zero. The suffix said "withheld" and the count contradicted it in
     * the same sentence — a reader trusting the number is misled by a line that
     * also carries its own correction.
     */
    countFor: (toolDir: string) => number;
} {
    const active = partitionActive(projectRoot);
    return {
        all,
        listFor: (toolDir) => (personaWithheldFor(toolDir, active) ? [] : all),
        note: active ? ' — .claude/ withheld: ADR-236 partition, personas arrive from ~/.claude' : '',
        countFor: (toolDir) => (personaWithheldFor(toolDir, active) ? 0 : all.length),
    };
}

/**
 * The pure half of {@link personaPartition}: withhold iff the partition is active
 * AND this is a Claude tool directory.
 *
 * Split out so the decision is testable in BOTH directions. `personaPartition`
 * reads `installed.lock` through a memoized `partitionActive`, so a test over it
 * can only assert whatever this machine happens to be — which is a test that
 * passes either way and therefore proves nothing. The two properties worth
 * pinning are exactly the two this signature exposes: `.claude/` is withheld when
 * active, and NOTHING else ever is.
 */
export function personaWithheldFor(toolDir: string, active: boolean): boolean {
    return active && toolDir.startsWith('.claude/');
}

/**
 * Does the project layer withhold the colon-form `/cluster:sub` commands?
 *
 * ## The claim this replaces, and the measurement that revised it
 *
 * `generate_claude_project_commands` was written on the reasoning that "Claude
 * Code dedupes project and user scope by name, so the two copies of
 * `/cluster:sub` collapse" — a host-behaviour claim with no first-party
 * observation behind it. Its sibling claim about skills WAS probed under
 * ADR-236's roadmap (Phase 5.2, `claudeMdExcludes`) and came back negative, so
 * an unprobed host assumption in the same area was not a safe default.
 *
 * **MEASURED 2026-08-21, Claude Code 2.1.238.** Fixture: `/analyze:inbox`
 * present in BOTH `~/.claude/commands/analyze/` and a temp project's
 * `.claude/commands/analyze/`. The session reports `COUNT=1`. A control second
 * entry (`/analyze:inboxctl`, project-only) makes the same probe report
 * `COUNT=2` — so the 1 is an observation, not a probe that can only say one.
 *
 * **The half nobody had checked: the surviving copy is the GLOBAL one.** Asked
 * for the command's description, the session returned the global body, not the
 * project fixture's. So the dedup claim holds and its unstated corollary
 * inverts the value of the project-layer copy: where a verified global layer
 * exists, those 40 symlinks are written, deduped away, and LOSE. They are dead
 * weight there — not a second listing, and not a reachability guarantee either.
 *
 * ## Why `partitionActive` is the right predicate rather than a new one
 *
 * It is true exactly when a global layer is present and verified against
 * `installed.lock`, which is exactly the case where the project copy loses; and
 * false on a fresh checkout, an unverified install, or a version mismatch —
 * every case where the project copy is the only reachable one. So the
 * fail-safe direction the whole module is built around already matches the
 * measurement, and withholding needs no separate switch.
 *
 * ## Honest limits
 *
 * Self-report, n=1 per condition, one host version, one machine. What is NOT
 * claimed: that older or newer hosts dedupe the same way, or that precedence is
 * stable across them.
 *
 * **And a claim that WAS made here has been withdrawn as false** (neutral review,
 * 2026-08-21). It read: *"A host that stopped deduping would show up as a
 * double-listing, and `check_single_delivery` reports the overlap either way."*
 * It cannot. When this predicate returns true the project copy is never written,
 * so there is no second copy for the host to double-list or for the gate to
 * count — it would report zero overlap while the assumption underneath had
 * failed. Worse, `partitionActive` verifies the INSTALL (version + content
 * fingerprint), never the HOST version whose behaviour was measured, so a host
 * upgrade changes the premise and moves nothing this code reads.
 *
 * What actually holds: reachability survives a dedup change either way, because
 * the global copy is delivered regardless. What is lost is only the project
 * copy's redundancy, and nothing detects that. A real detector would have to
 * pin the host version this measurement was taken against and re-probe when it
 * moves — not built here, and named as absent rather than implied away.
 */
export function commandsWithheld(projectRoot: string): boolean {
    return partitionActive(projectRoot);
}

/**
 * ## The caller's early return, flagged by review and kept
 *
 * `generate_claude_project_commands` applies this predicate and then returns
 * early when `src/domains/` is absent — BEFORE its stale-link sweep. So a tree
 * with no `src/domains` keeps whatever `.claude/commands` it already had, even
 * when the commands are now withheld.
 *
 * Invariant rather than oversight: this package always ships `src/domains/`, the
 * generator only runs from a checkout that has it, and a consumer never reaches
 * this path. Documented rather than reordered, because hoisting the sweep above
 * the guard would make a non-package tree lose a directory this code did not
 * write — a worse failure than the one being avoided, and on a tree we do not own.
 *
 * The transition that DOES occur is covered: `partition_delivery_topology.test.ts`
 * runs inactive→active over a fixture that has `src/domains`, and asserts both
 * the links and the empty cluster directories are gone after one run.
 */
