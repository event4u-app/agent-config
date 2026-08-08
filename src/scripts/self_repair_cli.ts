#!/usr/bin/env node
/**
 * Self-repair CLI — the queue reader and the single gated outward step.
 *
 *   self-repair:status                 list open records
 *   self-repair:release <fp> [--dry-run] [--repo <owner/name>]
 *
 * `release` is the ONE keystroke the loop is designed around: everything up to
 * it — detection, dedup, analysis, the authored fix, the commit — happens
 * without the user. Publishing does not, because a push and a PR/issue are
 * both Hard-Floor actions under `non-destructive-by-default`, and no standing
 * instruction lifts that floor. Running this command IS the user's word.
 *
 * Route selection follows the spec exactly: a pull request when the fix can be
 * authored and pushed, an issue when it cannot, and a local record when nothing
 * can leave the machine. `--dry-run` prints the resolved route and the rendered
 * body and touches no network — that is the path the tests drive.
 *
 * Fail-closed on privacy: the record's own text goes through the audited
 * privacy floor before anything leaves the machine, and a refusal downgrades
 * the record to local-only rather than scrubbing it into publishable shape.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    chooseEgressRoute,
    type DefectRecord,
    type EgressCapability,
    type EgressRoute,
    egressBlockedReason,
    renderReport,
} from './_lib/self_repair.js';
import { listRecords, markReleased, openRecords, readRecord } from './_lib/self_repair_store.js';

export const UPSTREAM_REPO = 'event4u-app/agent-config';

const EXIT_OK = 0;
const EXIT_FAIL = 1;

/** Probe result for one machine — injectable so tests never shell out. */
export interface Probe {
    agentConfigCheckout: string | null;
    ghAuthenticated: boolean;
    canPush: boolean;
}

function run(cmd: string, args: string[], cwd?: string): { ok: boolean; out: string } {
    const r = spawnSync(cmd, args, { cwd, encoding: 'utf-8' });
    return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

/**
 * Where the fix can be authored. `AGENT_CONFIG_SOURCE` wins; otherwise the CWD
 * when it IS the package checkout. A consumer project has neither — that is the
 * normal case, and the reason the issue fallback exists.
 */
export function findAgentConfigCheckout(env: NodeJS.ProcessEnv, cwd: string): string | null {
    const explicit = env['AGENT_CONFIG_SOURCE'];
    if (explicit && fs.existsSync(path.join(explicit, 'src', 'rules'))) {
        return explicit;
    }
    if (
        fs.existsSync(path.join(cwd, 'src', 'rules')) &&
        fs.existsSync(path.join(cwd, 'src', 'scripts', 'hook_manifest.yaml'))
    ) {
        return cwd;
    }
    return null;
}

export function probeMachine(env: NodeJS.ProcessEnv, cwd: string): Probe {
    const checkout = findAgentConfigCheckout(env, cwd);
    const gh = run('gh', ['auth', 'status']);
    const canPush = checkout !== null && run('git', ['remote'], checkout).out.trim().length > 0;
    return { agentConfigCheckout: checkout, ghAuthenticated: gh.ok, canPush };
}

export function capabilityOf(probe: Probe): EgressCapability {
    return {
        hasAgentConfigCheckout: probe.agentConfigCheckout !== null,
        ghAuthenticated: probe.ghAuthenticated,
        canPush: probe.canPush,
    };
}

/** Title line for the PR / issue — one per defect class, stable across reruns. */
export function titleFor(record: DefectRecord): string {
    return `fix(self-repair): ${record.defect_class} — ${record.occurrences}x observed`;
}

export interface ReleasePlan {
    route: EgressRoute;
    blocked: string | null;
    title: string;
    body: string;
}

/** Pure: everything `release` decides before it touches the network. */
export function planRelease(record: DefectRecord, probe: Probe, repoRoot: string): ReleasePlan {
    const blocked = egressBlockedReason(record, repoRoot);
    const route: EgressRoute =
        blocked !== null ? 'local-only' : chooseEgressRoute(capabilityOf(probe));
    return { route, blocked, title: titleFor(record), body: renderReport(record, route) };
}

function statusCmd(root: string): number {
    const open = openRecords(root);
    const all = listRecords(root);
    if (all.length === 0) {
        process.stdout.write('self-repair: no records.\n');
        return EXIT_OK;
    }
    process.stdout.write(`self-repair: ${open.length} open of ${all.length} record(s)\n\n`);
    for (const r of all) {
        const mark = r.status === 'open' ? 'o' : '.';
        process.stdout.write(
            `  ${mark} ${r.fingerprint}  ${r.defect_class}  ${r.occurrences}x  ${r.last_seen}\n` +
                `      ${r.evidence}\n`,
        );
    }
    process.stdout.write('\nRelease one: agent-config self-repair:release <fingerprint>\n');
    return EXIT_OK;
}

function releaseCmd(root: string, argv: string[]): number {
    const fp = argv.find((a) => !a.startsWith('-'));
    if (!fp) {
        process.stderr.write('self-repair:release needs a fingerprint (see self-repair:status).\n');
        return EXIT_FAIL;
    }
    const record = readRecord(root, fp);
    if (record === null) {
        process.stderr.write(`self-repair:release: no record ${fp}.\n`);
        return EXIT_FAIL;
    }
    const dryRun = argv.includes('--dry-run');
    const repoArg = argv.indexOf('--repo');
    const repo = repoArg >= 0 ? (argv[repoArg + 1] ?? UPSTREAM_REPO) : UPSTREAM_REPO;
    const probe = probeMachine(process.env, process.cwd());
    const plan = planRelease(record, probe, root);

    process.stdout.write(`self-repair:release ${fp} -> route=${plan.route}\n`);
    if (plan.blocked !== null) {
        process.stdout.write(`  WARN  ${plan.blocked}\n`);
    }
    if (dryRun) {
        process.stdout.write(`\n--- ${plan.title} ---\n${plan.body}\n`);
        return EXIT_OK;
    }
    if (plan.route === 'local-only') {
        process.stdout.write(
            '  Nothing published. The record stays in agents/runtime/self-repair/.\n',
        );
        return EXIT_OK;
    }
    if (plan.route === 'issue') {
        const r = run('gh', [
            'issue',
            'create',
            '--repo',
            repo,
            '--title',
            plan.title,
            '--body',
            plan.body,
        ]);
        process.stdout.write(`${r.out}\n`);
        if (!r.ok) {
            return EXIT_FAIL;
        }
    } else {
        const checkout = probe.agentConfigCheckout!;
        const branch = run('git', ['branch', '--show-current'], checkout).out.trim();
        if (!branch || branch === 'main') {
            process.stderr.write(
                '  The fix must sit on its own branch in the agent-config checkout ' +
                    `(currently: ${branch || 'detached'}).\n`,
            );
            return EXIT_FAIL;
        }
        const pushed = run('git', ['push', '-u', 'origin', branch], checkout);
        if (!pushed.ok) {
            process.stderr.write(`${pushed.out}\n`);
            return EXIT_FAIL;
        }
        const pr = run(
            'gh',
            ['pr', 'create', '--repo', repo, '--title', plan.title, '--body', plan.body],
            checkout,
        );
        process.stdout.write(`${pr.out}\n`);
        if (!pr.ok) {
            return EXIT_FAIL;
        }
    }
    markReleased(root, fp, new Date().toISOString());
    return EXIT_OK;
}

export function main(argv: readonly string[]): number {
    const root = process.cwd();
    const sub = argv[0] ?? 'status';
    if (sub === 'status') {
        return statusCmd(root);
    }
    if (sub === 'release') {
        return releaseCmd(root, [...argv.slice(1)]);
    }
    process.stderr.write(`self-repair: unknown subcommand '${sub}' (status | release).\n`);
    return EXIT_FAIL;
}

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) {
        return false;
    }
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) ===
            fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (isCliEntry()) {
    process.exit(main(process.argv.slice(2)));
}
