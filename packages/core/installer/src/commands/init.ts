/**
 * `init` command — first-time installer entry.
 *
 * Phase 3.2 wires the interactive TUI (workspace + pack pickers with
 * `requires_hint` auto-resolution and project signal detection) and
 * the non-interactive flag path. Atomic writes (ADR-016 § 5) land via
 * `executeInstallPlan`. Agent mode is dispatched separately and lives
 * under `src/agent-mode/`; Phase 3.4 finishes that surface.
 */

import { dirname } from 'node:path';
import { loadManifest, ManifestNotFoundError, findPack } from '../manifest-loader.js';
import { detectPacks } from '../detect.js';
import { resolvePacks } from '../resolver.js';
import {
    UnknownPackError,
    UnknownWorkspaceError,
    mergePackCandidates,
    packsForWorkspaces,
    parseCsv,
    validatePackIds,
    validateWorkspaces,
} from '../selection.js';
import { computeInstallPlan, executeInstallPlan } from '../install-plan.js';
import { AGENT_CONFIG_VERSION, PACK_VERSION } from '../version.js';
import { findProfile, loadProfiles, ProfilesFileError, UnknownProfileError } from '../profiles.js';
import { runAgentInit } from '../agent-mode/machine.js';
import {
    buildPackChoices,
    buildWorkspaceChoices,
    collectAdvisoryPacks,
    defaultPicker,
    formatTrustSummary,
} from '../tui.js';
import type { TuiPicker } from '../tui.js';
import type { SharedFlags } from '../cli.js';

export interface InitOptions {
    readonly workspaces?: string;
    readonly packs?: string;
    readonly profile?: string;
    readonly exclude?: string;
    readonly acceptAdvisory?: string;
    readonly answer?: readonly string[];
}

export interface RunInitDeps {
    readonly picker?: TuiPicker;
}

export async function runInit(
    shared: SharedFlags,
    raw: Record<string, unknown>,
    deps: RunInitDeps = {},
): Promise<number> {
    const opts: InitOptions = {
        ...(typeof raw.workspaces === 'string' ? { workspaces: raw.workspaces } : {}),
        ...(typeof raw.packs === 'string' ? { packs: raw.packs } : {}),
        ...(typeof raw.profile === 'string' ? { profile: raw.profile } : {}),
        ...(typeof raw.exclude === 'string' ? { exclude: raw.exclude } : {}),
        ...(typeof raw.acceptAdvisory === 'string' ? { acceptAdvisory: raw.acceptAdvisory } : {}),
        ...(Array.isArray(raw.answer) ? { answer: raw.answer as readonly string[] } : {}),
    };

    let loaded;
    try {
        loaded = loadManifest({
            searchFrom: shared.projectRoot,
            ...(shared.manifestPath !== undefined ? { path: shared.manifestPath } : {}),
        });
    } catch (err) {
        if (err instanceof ManifestNotFoundError) {
            process.stderr.write(
                `init: discovery manifest not found.\n` +
                `Looked for dist/discovery/discovery-manifest.json under ${shared.projectRoot}.\n`,
            );
            return 2;
        }
        throw err;
    }
    const packageRoot = dirname(dirname(dirname(loaded.path)));

    if (shared.mode === 'agent') {
        return await runAgentInit({
            manifest: loaded.manifest,
            manifestSha256: loaded.sha256,
            packageRoot,
            projectRoot: shared.projectRoot,
            dryRun: shared.dryRun,
            answers: opts.answer ?? [],
        });
    }

    const excludePacks = parseCsv(opts.exclude);
    const detected = detectPacks({ projectRoot: shared.projectRoot });
    const picker = deps.picker ?? defaultPicker;

    let workspaceIds: readonly string[];
    let packIds: readonly string[];

    try {
        if (shared.mode === 'non-interactive') {
            let profileWorkspaces: readonly string[] = [];
            let profilePacks: readonly string[] = [];
            if (opts.profile !== undefined && opts.profile.length > 0) {
                const profile = findProfile(loadProfiles(loaded.path), opts.profile);
                profileWorkspaces = validateWorkspaces(loaded.manifest, profile.workspaces);
                profilePacks = validatePackIds(loaded.manifest, profile.packs);
            }
            const flagWorkspaces = validateWorkspaces(loaded.manifest, parseCsv(opts.workspaces));
            workspaceIds = flagWorkspaces.length > 0 ? flagWorkspaces : profileWorkspaces;
            if (workspaceIds.length === 0) {
                process.stderr.write(`init: --workspaces=<ids> or --profile=<id> is required in non-interactive mode.\n`);
                return 2;
            }
            const flagPacks = validatePackIds(loaded.manifest, parseCsv(opts.packs));
            const explicit = [...profilePacks, ...flagPacks];
            const merged = mergePackCandidates({
                manifest: loaded.manifest,
                workspaces: workspaceIds,
                explicitPacks: explicit,
                excludePacks,
                autoDetected: detected.map((d) => d.packId).filter((id) => findPack(loaded.manifest, id) !== undefined),
            });
            packIds = merged;
        } else {
            workspaceIds = await picker.pickWorkspaces(buildWorkspaceChoices(loaded.manifest.workspaces));
            if (workspaceIds.length === 0) {
                process.stderr.write(`init: no workspaces selected, aborting.\n`);
                return 2;
            }
            const candidatePacks = packsForWorkspaces(loaded.manifest, workspaceIds);
            const preChecked = mergePackCandidates({
                manifest: loaded.manifest,
                workspaces: workspaceIds,
                explicitPacks: [],
                excludePacks,
                autoDetected: detected.map((d) => d.packId).filter((id) => findPack(loaded.manifest, id) !== undefined),
            });
            packIds = await picker.pickPacks(buildPackChoices(candidatePacks, preChecked, detected));
        }
    } catch (err) {
        if (
            err instanceof UnknownWorkspaceError
            || err instanceof UnknownPackError
            || err instanceof UnknownProfileError
            || err instanceof ProfilesFileError
        ) {
            process.stderr.write(`init: ${err.message}\n`);
            return 2;
        }
        throw err;
    }

    const resolved = resolvePacks(loaded.manifest, packIds);
    if (resolved.missing.length > 0) {
        process.stderr.write(`init: unknown packs requested: ${resolved.missing.join(', ')}\n`);
        return 2;
    }
    const autoAdded = resolved.packs.filter((p) => p.autoSelected);
    if (shared.mode === 'interactive' && autoAdded.length > 0) {
        const confirmed = await picker.confirmAutoAdded(autoAdded);
        if (!confirmed) {
            process.stdout.write(`init: aborted by user.\n`);
            return 0;
        }
    }

    // Phase 5.1 (ADR-018): trust gate — advisory/restricted/experimental
    // artefacts require explicit acknowledgment.
    const advisoryPacks = collectAdvisoryPacks(
        loaded.manifest.packs,
        resolved.packs.map((p) => p.id),
    );
    if (advisoryPacks.length > 0) {
        if (shared.mode === 'interactive') {
            const accepted = await picker.confirmAdvisoryAcceptance(advisoryPacks);
            if (!accepted) {
                process.stdout.write(`init: advisory acknowledgment declined, aborting.\n`);
                return 0;
            }
        } else {
            const acceptedIds = new Set(parseCsv(opts.acceptAdvisory));
            const missingAck = advisoryPacks.filter((p) => !acceptedIds.has(p.id));
            if (missingAck.length > 0) {
                const lines = missingAck
                    .map((p) => `  - ${p.id}: ${formatTrustSummary(p.trustSummary, p.humanReviewRequired)}`)
                    .join('\n');
                process.stderr.write(
                    `init: the following packs include advisory/restricted/experimental artefacts ` +
                    `and require --accept-advisory=<pack-ids> in non-interactive mode:\n${lines}\n`,
                );
                return 2;
            }
        }
    }

    const plan = computeInstallPlan({
        manifest: loaded.manifest,
        workspaces: workspaceIds,
        packs: resolved.packs,
        packageRoot,
        projectRoot: shared.projectRoot,
    });

    if (shared.dryRun) {
        process.stdout.write(
            `${JSON.stringify({
                mode: shared.mode,
                workspaces: workspaceIds,
                packs: resolved.packs,
                files: plan.files.length,
                dry_run: true,
            }, null, 2)}\n`,
        );
        return 0;
    }

    const result = executeInstallPlan({
        plan,
        projectRoot: shared.projectRoot,
        manifestSha256: loaded.sha256,
        agentConfigVersion: AGENT_CONFIG_VERSION,
        packVersion: PACK_VERSION,
        manifest: loaded.manifest,
    });
    process.stdout.write(
        `init: wrote ${result.filesWritten} files; lockfile at ${result.lockfileRelative}\n`,
    );
    return 0;
}
