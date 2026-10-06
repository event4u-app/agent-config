/**
 * Thin an INSTALLED Claude Code rule layer, in place, after the copy.
 *
 * `road-to-an-installed-layer-that-is-thinned` step 1.1. The global install step
 * copies `dist/agent-src/rules` verbatim into `~/.claude/rules`
 * (`install.ts::_copy_dir_dereferencing_symlinks`), so a consumer receives every
 * rule body whether or not any trigger ever fires. The round that opened that
 * roadmap measured a fresh install at 102 unconditional files and 338,225
 * characters against a host that reports a 150,000 budget. Thinning existed —
 * `project_thin_rules::build_thin` — but ran only on the maintainer projection,
 * which no consumer receives.
 *
 * Three properties, each a defect this would otherwise reintroduce.
 *
 * **The stub is built from the SOURCE tree, never from the installed file.**
 * `claudeRuleRewrite` runs immediately before this and reduces each installed
 * rule to the host's activation vocabulary — `paths:` plus the ownership keys —
 * dropping `description:` and the `triggers:` block. Those two are exactly what
 * `thin_entry` reads to write the stub's matching signal, so a stub built from
 * the rewritten file would carry an empty description and no `Fires on:` hint.
 * Reading `<packageRoot>/dist/agent-src/rules/<name>` keeps the signal intact.
 *
 * **The installed frontmatter is kept verbatim.** The roadmap's step 1.1 ends
 * "Ownership keys survive", and it is not decoration: `reap_tagged_orphans`
 * calls the literal `package:` line "the only path with ownership proof
 * independent of inventory history", and doctor's stale-orphan check reads the
 * same tag. A stub that replaced the whole file would delete the reaper's only
 * evidence for every thinned rule. So only the BODY is replaced; the header the
 * copy and the rewrite produced is written back unchanged, which also preserves
 * any `paths:` block — harmless, since a path-only rule is never thinned.
 *
 * **A user-modified file is skipped, not overwritten.** The preserved set comes
 * from the conflict tracker, the same one the copy consulted. Step 1.3 requires
 * an upgrade to preserve and report those files; thinning one would destroy an
 * edit the copy had just declined to destroy.
 *
 * The rollback of step 1.2 needs nothing here, and the reason is the ordering.
 *
 * The install manifest records each deployed file's digest from the bytes ON
 * DISK at manifest-write time, which is after this pass. So the next run sees
 * `recorded-unchanged` for a thinned file, `decideDeployWrite` returns `write`,
 * and the verbatim copy restores the full body. Switching the mode back to
 * `eager-all` therefore un-thins by simply not running this pass — no inverse
 * operation, and no stub left behind. The property that carries it is the
 * ordering, which `tests/scripts/install_thin_layer.test.ts` pins directly.
 *
 * Side-effect-free apart from the writes it is asked to make. No CLI entry, no
 * `process.exit` — this module is reachable from the `build:install-bundle`
 * entry and `check_installer_import_purity` forbids both.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import * as os from 'node:os';

import {
    buildHostLimitRows,
    loadHostInstructionLimits,
    ownershipLine,
    readLayer,
    renderHostLimitRows,
    resolveLayerOwnership,
    type LayerReading,
} from '../scripts/_lib/installed_layer.js';
import { GLOBAL_RULE_DIRS, globalRuleLayerPath } from './globalRuleLayers.js';
import { manifest_path } from '../scripts/_lib/installed_tools.js';
import {
    absoluteBodyLinkPrefix,
    build_thin,
    split_frontmatter,
} from '../scripts/_lib/thin_rules.js';

export interface ThinInstalledLayerResult {
    /** Files that stand as a stub after this pass, whether or not it wrote them. */
    readonly thinned: number;
    /**
     * Of those, the ones whose bytes actually changed.
     *
     * Separate from {@link thinned} so a repeat install's receipt does not claim
     * work it did not do: on an already-thinned layer every file is `thinned`
     * and none is `rewritten`.
     */
    readonly rewritten: number;
    /** Installed rules the predicate keeps full-bodied (kernel, trigger-less, path-only, `no_stub`). */
    readonly kept: number;
    /** Basenames skipped because the conflict tracker preserved a user-modified file. */
    readonly preserved: readonly string[];
    /** Basenames the stub map names that this layer does not carry — out of rule scope. */
    readonly absent: readonly string[];
    /** Per-rule write failures, reported rather than thrown. */
    readonly failed: ReadonlyArray<{ readonly rule: string; readonly reason: string }>;
    /** The absolute prefix every stub's `Body:` link was built on. */
    readonly bodyLinkPrefix: string;
    /** Characters the layer held before and after, over the files this pass examined. */
    readonly charsBefore: number;
    readonly charsAfter: number;
}

export interface ThinInstalledLayerOptions {
    /** The installed rule directory, e.g. `~/.claude/rules`. */
    readonly rulesDir: string;
    /** The package this install was made from — carries `dist/`, `src/config/`. */
    readonly packageRoot: string;
    /** Absolute paths the conflict tracker preserved; never rewritten here. */
    readonly preserved?: ReadonlySet<string>;
}

/**
 * Replace the body of every thinnable rule in `rulesDir` with its stub.
 *
 * Idempotent: a layer already thinned is rewritten to byte-identical content,
 * so a repeated install neither grows nor drifts.
 */
export function thinInstalledRuleLayer(opts: ThinInstalledLayerOptions): ThinInstalledLayerResult {
    const packageRoot = path.resolve(opts.packageRoot);
    const bodySourceDir = path.join(packageRoot, 'dist', 'agent-src', 'rules');
    const bodyLinkPrefix = absoluteBodyLinkPrefix(packageRoot);
    const preserved = opts.preserved ?? new Set<string>();

    // Scope is `null` on purpose. The copy already applied the install's rule
    // scope, so the files that EXIST in `rulesDir` are the scoped set; asking
    // `build_thin` to resolve the scope a second time would be a second reader
    // of the same decision, and the two could disagree. Anything the stub map
    // names that is not on disk is simply out of scope and is reported as such.
    const stubs = build_thin(bodySourceDir, null, null, null, { packageRoot, bodyLinkPrefix });

    let thinned = 0;
    let rewritten = 0;
    let kept = 0;
    let charsBefore = 0;
    let charsAfter = 0;
    const preservedHits: string[] = [];
    const absent: string[] = [];
    const failed: Array<{ rule: string; reason: string }> = [];

    for (const [name, stubText] of stubs) {
        const target = path.join(opts.rulesDir, name);
        let installed: string;
        try {
            installed = fs.readFileSync(target, 'utf-8');
        } catch (e) {
            // ENOENT is the documented meaning of `absent` — the copy's rule
            // scope did not place this rule here. Anything else (EACCES, EISDIR,
            // EIO) is a FAILURE wearing a scoping outcome's clothes, and the
            // receipt prints failures and does not print absences, so the two
            // must not share a bucket.
            if ((e as NodeJS.ErrnoException).code === 'ENOENT') absent.push(name);
            else failed.push({ rule: name, reason: String(e) });
            continue;
        }
        // KEPT-VS-THINNED IS DECIDED BY IDENTITY, NOT BY A CONTENT SNIFF.
        // `build_thin` returns either a stub or the SOURCE TEXT VERBATIM, so
        // the full-bodied branch is exactly "the map value equals the source
        // file". Testing `is_thin_entry(stubText)` instead would misread a
        // source rule whose own body happened to contain the marker — and that
        // rule would then be written as `installedFrontmatter + fullSourceText`,
        // duplicating the frontmatter block. Zero such rules ship today, which
        // makes it latent rather than live, and `THIN_ENTRY_MARKER`'s own
        // docstring argues against exactly this kind of inferred detection.
        let sourceText: string | null;
        try {
            sourceText = fs.readFileSync(path.join(bodySourceDir, name), 'utf-8');
        } catch {
            sourceText = null;
        }
        if (stubText === sourceText) {
            // Kept full-bodied by `build_thin`'s own predicate — kernel,
            // trigger-less, path-only, or a declared `no_stub` member. The
            // installed copy is already the right shape; touching it would be
            // this pass inventing a decision the projector did not make.
            kept += 1;
            charsBefore += installed.length;
            charsAfter += installed.length;
            continue;
        }
        if (preserved.has(path.resolve(target))) {
            preservedHits.push(name);
            charsBefore += installed.length;
            charsAfter += installed.length;
            continue;
        }
        const [frontmatter] = split_frontmatter(installed);
        charsBefore += installed.length;
        // `split_frontmatter` answers `['', text]` for a file that OPENS a
        // frontmatter block and never closes it — a truncated write, a file
        // ending exactly on the closing fence with no trailing newline, CRLF.
        // Writing `'' + stub` there would delete the `package:` line this
        // module's header calls the reaper's only evidence, which is the one
        // corruption this pass could cause. A file that claims a block it does
        // not have is left exactly as found and reported.
        //
        // The test is a REGEX rather than `startsWith('---')` because the
        // claim can be preceded by a BOM or by leading whitespace, and either
        // one took the prefix check's "no block here" branch straight into the
        // write it exists to prevent.
        if (frontmatter === '' && /^\uFEFF?[\s]*---/.test(installed)) {
            failed.push({
                rule: name,
                reason: 'opens a frontmatter block that never closes — left untouched so its ' +
                    'ownership keys survive',
            });
            charsAfter += installed.length;
            continue;
        }
        const next = `${frontmatter}${stubText}`;
        try {
            if (next !== installed) {
                fs.writeFileSync(target, next, 'utf-8');
                rewritten += 1;
            }
            thinned += 1;
            charsAfter += next.length;
        } catch (e) {
            failed.push({ rule: name, reason: String(e) });
            charsAfter += installed.length;
        }
    }

    if (stubs.size === 0) {
        // A ZERO-STUB MAP AND A ZERO-THINNABLE LAYER PRINT THE SAME RECEIPT, so
        // the one that is a failure has to say so. `_globSortedMd` swallows an
        // unreadable directory and answers `[]`, which is what a wrongly
        // resolved package root produces — the hazard `ThinRoots` exists for.
        // Without this the feature would be silently not applied behind a
        // success-shaped line, and the installer's try/catch sees only throws.
        failed.push({
            rule: bodySourceDir,
            reason: 'no rule bodies found to build stubs from — the layer was left full-bodied',
        });
    }

    return {
        thinned,
        rewritten,
        kept,
        preserved: preservedHits,
        absent,
        failed,
        bodyLinkPrefix,
        charsBefore,
        charsAfter,
    };
}

/**
 * One receipt line per outcome, for a caller that prints.
 *
 * Returns the lines rather than writing them, so the installer's `--quiet` and
 * its progress-event emitter stay the only things deciding what a consumer sees.
 */
export function describeThinInstalledLayer(res: ThinInstalledLayerResult): string[] {
    const out: string[] = [];
    out.push(
        res.rewritten === 0 && res.thinned > 0
            ? `  claude-code: ${String(res.thinned)} rule(s) already thinned, ` +
                  `${String(res.kept)} kept full-bodied; ` +
                  `${String(res.charsAfter)} chars — nothing to rewrite`
            : `  claude-code: thinned ${String(res.rewritten)} rule(s) to stubs, ` +
                  `${String(res.kept)} kept full-bodied; ` +
                  `${String(res.charsBefore)} -> ${String(res.charsAfter)} chars`,
    );
    if (res.preserved.length > 0) {
        out.push(
            `  claude-code: ${String(res.preserved.length)} rule(s) left full — you edited them ` +
                `and they are preserved, never overwritten (${res.preserved.join(', ')})`,
        );
    }
    for (const f of res.failed) {
        out.push(`  claude-code: ${f.rule}: could not write stub — ${f.reason}`);
    }
    return out;
}

/**
 * The install receipt's instruction-budget block — step 1.4's "at install".
 *
 * The step asks for the limit, the split and the 80 % warning AT INSTALL, and
 * the measurement existed only behind the standalone `installed_layer_report`
 * CLI: `buildHostLimitRows`'s own docstring named "the install receipt" as the
 * caller it was exported for, and that caller did not exist. A consumer whose
 * layer is over budget learned it from the host, which is the notice the
 * roadmap exists to remove.
 *
 * Global layers only, deliberately. The install writes `~/.claude/rules` and
 * its siblings; a project layer is not what this run just changed, and folding
 * one in would make the receipt's number disagree with the thing it is a
 * receipt FOR.
 *
 * Never throws. A receipt that cannot be measured is silent rather than fatal —
 * the deploy it describes has already happened correctly.
 */
export interface InstallReceiptOwnershipOptions {
    /** `deployed-files.json`. `undefined` reads the user-global default; `null` reads none. */
    readonly inventoryPath?: string | null | undefined;
    /**
     * Anchor → anchor-relative paths this run just wrote.
     *
     * The installer holds exactly this set at the moment it prints the receipt,
     * and `record_deploy` has not run yet, so on a FIRST install it is the only
     * evidence the files are ours.
     */
    readonly thisDeploy?: ReadonlyMap<string, Iterable<string>> | null | undefined;
}

export function installReceiptBudgetLines(
    packageRoot: string,
    home: string = os.homedir(),
    opts: InstallReceiptOwnershipOptions = {},
): string[] {
    try {
        // ONE RESOLVER, SHARED WITH THE REPORT — step 1.2. This used to read
        // `manifest_path(packageRoot)`, the PACKAGE root's lock, which on a
        // global-only install names a file no global install ever writes; the
        // receipt then printed `0 package-owned` for a layer it had itself just
        // deployed. `resolveLayerOwnership` falls through to the inventory, and
        // `thisDeploy` covers the first install, where the receipt prints
        // before `record_deploy` has written anything.
        const { recorded, source } = resolveLayerOwnership({
            manifestPath: manifest_path(packageRoot),
            projectRoot: packageRoot,
            // The same home the layers below are read from — the inventory's
            // anchor is tilde-relative, so the two must agree or the receipt
            // measures one install and claims ownership of another.
            home,
            inventoryPath: opts.inventoryPath,
            thisDeploy: opts.thisDeploy,
        });
        const layers: LayerReading[] = [];
        for (const host of Object.keys(GLOBAL_RULE_DIRS).sort()) {
            const dir = globalRuleLayerPath(host, home);
            if (dir === null) continue;
            layers.push(readLayer(host, 'global', dir, recorded));
        }
        const rows = buildHostLimitRows(layers, loadHostInstructionLimits());
        if (rows.length === 0) return [];
        return [`  ${ownershipLine(source)}`, ...renderHostLimitRows(rows).map((l) => `  ${l}`)];
    } catch {
        return [];
    }
}
