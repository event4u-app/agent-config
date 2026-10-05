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

import {
    absoluteBodyLinkPrefix,
    build_thin,
    is_thin_entry,
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
        if (!is_thin_entry(stubText)) {
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
        if (frontmatter === '' && installed.startsWith('---')) {
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
