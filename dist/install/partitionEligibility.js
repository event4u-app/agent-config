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
import { claudeLayerHolds, keepInProjectLayer } from './claudeLayerCarriage.js';
/**
 * ## `emittedWrapperSlugs` — why the skill sweep's protected set narrowed
 *
 * `generate_claude_skills` sweeps `.claude/skills/` of anything absent from the
 * set it is about to write, and it spares command-wrapper slugs so the command
 * emitter — which runs afterwards into the same directory — does not lose
 * entries it is about to create. That protected set used to be EVERY command
 * slug, which was safe only while skills were projected in full: a slug that is
 * also a skill name was protected twice over.
 *
 * Once `~/.claude/skills` began withholding by name (2026-09-07) the
 * over-protection became a leak — precisely the one
 * `tests/scripts/single_delivery_emission.test.ts` exists for. A command-named
 * skill survives in `.claude/skills/` while both counters read zero, because the
 * skill sweep spares it and the command prune skips symlinks. So the set now
 * mirrors the emitter's own two skips exactly: a slug that is also a skill name,
 * and every CLUSTERED command (those reach the host as `/cluster:sub` and need
 * no wrapper). `condense.ts::_emitted_wrapper_slugs` is that set.
 *
 * ## The re-export below
 *
 * `keepInProjectLayer` is re-exported so `condense.ts` reaches both halves of
 * the partition through ONE import line. Not stylistic: that file sits ~1,200 lines past the 1,500-line
 * source ceiling, where `check_source_size_budget` counts every added line as
 * one unit of excess and its test asserts `baseline == live` — so a second
 * import statement there is a blocking gate failure, while the same line here
 * (535 lines, under the cap) costs nothing.
 */
export { keepInProjectLayer } from './claudeLayerCarriage.js';
import { parseFrontmatter } from './ruleInScope.js';
import { fingerprintLayers, hostLayerInputs } from './hostLayerFingerprint.js';
import { current_package_version, read_lockfile, write_lockfile, } from '../scripts/_lib/installed_lock.js';
/** The workspace id that marks an artefact as existing only for this package. */
export const MAINTAINER_WORKSPACE = 'agent-config-maintainer';
/**
 * Verify the host layer against the install record. Total function: always
 * returns a verdict, never throws, never refuses.
 *
 * The order of the guards is cheapest-and-most-decisive first, so the
 * fingerprint is computed only when everything else already agrees.
 *
 * **A `false` no longer changes what gets written.** It changes what the run
 * SAYS — see `reportHostLayerVerdict`, whose warning names the remedy. The
 * withhold decision moved to per-artefact evidence, where an unverified install
 * that nonetheless carries an artefact is not a reason to deliver that artefact
 * twice.
 */
export function verifyHostLayer(inputs) {
    if (!inputs.hostLayerPresent) {
        return {
            verified: false,
            reason: 'no host-global layer on this machine',
        };
    }
    const lock = inputs.lockfile;
    if (lock === null) {
        return {
            verified: false,
            reason: 'host layer present but no install record (installed.lock absent)',
        };
    }
    const recorded = lock.agent_config_version;
    if (!recorded) {
        return {
            verified: false,
            reason: 'install record carries no version',
        };
    }
    // Exact equality, deliberately not `>=`. A NEWER global layer is not a
    // superset: a later release may have renamed or removed an artefact this
    // checkout still expects, and ordering does not establish substitutability.
    if (recorded !== inputs.projectVersion) {
        return {
            verified: false,
            reason: `version mismatch (installed ${recorded}, building ${inputs.projectVersion})`,
        };
    }
    const installedFp = lock.host_layer_fingerprint;
    if (!installedFp) {
        return {
            verified: false,
            reason: 'install predates host-layer fingerprinting — re-run `agent-config install` to record one',
        };
    }
    let expected;
    try {
        expected = inputs.expectedFingerprint();
    }
    catch {
        return {
            verified: false,
            reason: 'could not compute the expected host-layer fingerprint',
        };
    }
    if (installedFp !== expected) {
        return {
            verified: false,
            reason: 'host-layer content differs from this checkout — re-run `agent-config install`',
        };
    }
    return {
        verified: true,
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
export function isExclusivelyPackageOnly(source_path) {
    let meta;
    try {
        [meta] = parseFrontmatter(fs.readFileSync(source_path, 'utf-8'));
    }
    catch {
        return false; // unreadable → not package-only → delivered globally
    }
    const raw = meta['workspaces'];
    if (!Array.isArray(raw) || raw.length === 0) {
        return false;
    }
    return raw.every((w) => String(w) === MAINTAINER_WORKSPACE);
}
let _memo = null;
let _announce = (m) => process.stdout.write(`${m}\n`);
/**
 * Install the emitter used for the projection line. Callers pass a function
 * visible at their DEFAULT output level — the first implementation used one that
 * prints only at `verbose`, which withheld ~100 rules while saying nothing in a
 * normal run.
 */
export function setPartitionAnnounce(fn) {
    _announce = fn;
}
/** Test seam — drop the memo so one process can exercise both verdicts. */
export function _resetHostLayerVerdictForTest() {
    _memo = null;
}
/**
 * Verify the host layer once per generation, and say so once.
 *
 * ## What this no longer does
 *
 * It used to answer `partitionActive(projectRoot)`, and every generator gated its
 * withhold on that one boolean. **That entry point is deleted** (owner decision,
 * 2026-09-07). The project layer's contents are now decided per artefact, on the
 * host layer's own contents, by `claudeLayerCarriage.keepInProjectLayer` and
 * `globalRuleLayers.hostLayerCarries`. A version number is not evidence about an
 * artefact, and using it as one delivered 261 skills and 29 personas twice per
 * session for as long as an install lagged a release.
 *
 * So what survives is the DIAGNOSTIC, and it still prints. **Both council seats
 * (2026-08-20, 2/2) required that generation print the mode it selected** rather
 * than partition silently, and the requirement is honoured in its stronger form:
 * the line now names the host layer's verification state, and an unverified layer
 * gets a warning naming the remedy instead of a silent fallback to double
 * delivery. The caller supplies `announce`, and the level matters — the first
 * implementation used an `info()` that prints only at `verbose`. Residual,
 * stated: at an explicitly silent output level the line is dropped.
 *
 * The fingerprint compares the host layer against **what the installer recorded
 * when it wrote that layer**, not against a re-derivation from source — the
 * property that keeps a mismatch informative rather than permanent.
 *
 * **Known residual:** an installer that crashes mid-write and still reaches the
 * lockfile would fingerprint its own partial layer, and that fingerprint then
 * verifies. Ordering narrows the window (the lockfile is written last) without
 * closing it. It now costs less than it did: the withhold no longer trusts this
 * verdict, so a wrongly-verified layer misreports a line rather than authorising
 * a removal.
 */
export function resolveHostLayerVerdict(projectRoot) {
    if (_memo !== null) {
        return _memo;
    }
    const layers = hostLayerInputs(os.homedir());
    const present = layers.some((l) => {
        try {
            return fs.statSync(l.root).isDirectory();
        }
        catch {
            return false;
        }
    });
    let lock = null;
    try {
        lock = read_lockfile();
    }
    catch {
        lock = null; // unreadable record → report it as unverified
    }
    _memo = verifyHostLayer({
        projectVersion: current_package_version(projectRoot),
        lockfile: lock,
        hostLayerPresent: present,
        expectedFingerprint: () => fingerprintLayers(layers),
    });
    _announce(_memo.verified
        ? `projection: project layer carries only what ~/.claude lacks — ${_memo.reason}`
        : `projection: project layer carries only what ~/.claude lacks · ⚠️  host layer UNVERIFIED — ${_memo.reason}`);
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
 * {@link resolveHostLayerVerdict} does: it belongs beside the predicate it
 * serves, and `install.ts` is 5,000+ lines where the source-size ratchet counts
 * every added line.
 *
 * @returns the fingerprint written, or `null` when nothing was recorded.
 */
export function stampHostLayerFingerprint(installedVersion, tools, lockfilePath, 
/** Skip entirely — e.g. when the claude-code deploy itself failed. */
skip, report) {
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
    }
    catch (e) {
        report(`Host-layer fingerprint NOT recorded (${String(e)}) — the project layer keeps the full projection.`);
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
 * ## Three properties the caller depends on
 *
 * **Scoped to `.claude/` only.** The evidence is `~/.claude/personas`. It says
 * nothing about `~/.cursor`, so withholding a cursor persona on the strength of
 * a claude directory listing would deliver it nowhere — the one failure the
 * fail-safe design exists to prevent. Every other tool directory keeps the full
 * projection.
 *
 * **Withheld PER NAME, on that directory's own contents** (owner decision,
 * 2026-09-07). This used to gate on `partitionActive` — a version and fingerprint
 * check against `installed.lock` — which meant an install one release behind
 * delivered all 29 personas twice. A persona `~/.claude/personas` actually holds
 * is withheld whatever the lockfile says; one it lacks stays, on its own, without
 * keeping the other 28 duplicates alive with it.
 *
 * **Reconciliation is the shorter list, not a second code path.** The caller's
 * stale-symlink sweep removes any link whose name is absent from the list it was
 * given for that directory, so a shorter list empties what an earlier version
 * populated. A gate that only declined to WRITE would leave the existing
 * duplicate standing — a partition that stops new duplication and keeps the old
 * is not a partition.
 */
export function personaPartition(all, home) {
    const claudeList = keepInProjectLayer('personas', all, home);
    const withheld = all.length - claudeList.length;
    return {
        all,
        listFor: (toolDir) => personaListFor(toolDir, all, claudeList),
        note: withheld > 0
            ? ` — .claude/ withheld ${String(withheld)}: ADR-236, those personas arrive from ~/.claude`
            : '',
        countFor: (toolDir) => personaListFor(toolDir, all, claudeList).length,
    };
}
/**
 * The pure half of {@link personaPartition}: a Claude tool directory gets the
 * narrowed list, every other directory gets the full one.
 *
 * Split out so the decision is testable in BOTH directions without reading this
 * machine's `~/.claude`. A test over the un-injected path can only assert
 * whatever the machine happens to be — a test that passes either way and
 * therefore proves nothing. The two properties worth pinning are exactly the two
 * this signature exposes: `.claude/` gets the narrowed list, and NOTHING else
 * ever does.
 */
export function personaListFor(toolDir, all, claudeList) {
    return toolDir.startsWith('.claude/') ? claudeList : all;
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
 * ## Why the predicate is the DIRECTORY, not `installed.lock`
 *
 * This used to be `partitionActive` — true only when a global layer was present
 * AND verified against `installed.lock` by version and fingerprint. That gets
 * the measurement above backwards in the one case that matters: the project copy
 * loses whenever the global copy EXISTS, and whether the recorded version is a
 * release behind has no bearing on whether it exists. An install one release old
 * therefore kept writing 40 symlinks the host deduped away — dead weight, chosen
 * on a fact about a version number.
 *
 * So the evidence is the host directory itself, asked per name (owner decision,
 * 2026-09-07): `~/.claude/commands/<cluster>/<sub>.md` for a clustered command,
 * `~/.claude/commands/<slug>.md` for a flat one. Present → the project copy loses
 * and is withheld. Absent → the project copy is the only reachable one and stays.
 * Unreadable layer → nothing is withheld. The fail-safe direction is unchanged;
 * it is now per artefact rather than per repository.
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
 * failed. The 2026-09-07 change does not repair that: reading the directory is
 * evidence about PRESENCE, never about how the host resolves two copies of a
 * name, so a host that stopped deduping is still undetected here.
 *
 * What actually holds: reachability survives a dedup change either way, because
 * the global copy is delivered regardless. What is lost is only the project
 * copy's redundancy, and nothing detects that. A real detector would have to
 * pin the host version this measurement was taken against and re-probe when it
 * moves — not built here, and named as absent rather than implied away.
 *
 * ## Flat wrappers are NOT withheld, and the asymmetry is measured
 *
 * A CLUSTERED command reaches Claude Code as `/cluster:sub` from a `.md` under
 * `commands/`, and `~/.claude/commands/` carries 41 such cluster directories — so
 * the project copy has somewhere to lose to, and this predicate withholds it.
 *
 * A FLAT command reaches the host as a hyphen-named wrapper under `skills/`
 * (`generate_claude_commands`), because — per that function's own note — the host
 * does not register flat command FILES. `~/.claude/skills` carries **none** of
 * those wrappers: measured 2026-09-07, 307 global skills = the 299 projected
 * skills plus 8 unrelated ones, and zero of the 153 wrappers. So withholding a
 * flat wrapper on the strength of `~/.claude/commands/<slug>.md` would deliver
 * that command NOWHERE — the one failure the fail-safe design exists to prevent.
 * `generate_claude_commands` therefore has no gate at all, and the 153 wrappers
 * are not duplication: nothing else delivers them.
 *
 * **What is NOT established:** whether the host registers `~/.claude/commands/<slug>.md`
 * for a flat command. If it does, those 53 global files make 53 of the wrappers
 * redundant and the catalog could shrink further. That is a HOST-BEHAVIOUR claim,
 * the class this file has already been wrong about once (the withdrawn
 * double-listing claim below), so it is named as unmeasured rather than assumed
 * in either direction. Closing it needs a `claude -p` probe of the same shape as
 * the 2026-08-21 dedup measurement, not a reading of this comment.
 *
 * @param globalName the host-side name — `<cluster>/<sub>.md` or `<slug>.md`.
 */
export function commandWithheld(globalName, home) {
    return claudeLayerHolds('commands', globalName, home);
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
//# sourceMappingURL=partitionEligibility.js.map