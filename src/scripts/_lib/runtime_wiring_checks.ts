/**
 * Runtime-wiring checks for `agent-config doctor`.
 *
 * `road-to-skill-ecosystem-runtime-enforcement` Phase 2, Steps 2-5. The gate
 * estate checks ARTIFACTS — is the rule written, is the projection byte-exact,
 * does the manifest parse. Nothing checked whether the wiring is LIVE: whether
 * the settings resolver returns anything, whether the router artifact parses,
 * whether each registered hook resolves to something executable, and whether an
 * inherited git-discovery variable is silently re-pointing every gate at another
 * repository.
 *
 * All four are REPORTS. `doctor` writes nothing and always exits zero, so a
 * check here returns a verdict and never a refusal — the point is that a
 * disabled or mis-wired estate becomes VISIBLE, not that a diagnostic starts
 * failing builds. A gate that wanted to refuse would belong in the gate estate.
 *
 * Extracted into `_lib/` rather than added to `cmd_doctor.ts` for a stated
 * reason: that file is 3,700 lines and `check_source_size_budget` counts every
 * line above 1,500, so four checks written inline would be charged against a
 * budget while the same code in a new module is free. The seam is also what
 * makes them unit-testable without booting the CLI.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';

import { parse as parseYaml } from 'yaml';

import { inheritedGitOverrides } from './repo_root.js';

/** The verdict shape `cmd_doctor` renders. Mirrors its internal `Dict` rows. */
export interface WiringCheck {
    id: string;
    status: 'ok' | 'warn' | 'fail' | 'skipped' | 'info';
    message: string;
    remedy: string;
}

/**
 * Step 2 — the settings resolver returns something, and WHICH FILE won.
 *
 * The cascade is user-global then project, last write winning. Nearly twenty
 * rules in this suite tell an agent to read `.agent-settings.yml` to learn
 * whether a feature is on, and every one of them is wrong about a key set on
 * another layer. Reporting the winning FILE per key is the part that makes the
 * check worth running — a value alone cannot be argued with.
 */
export function checkSettingsResolution(
    iterOverrides: () => Iterable<[string, unknown, string]>,
): WiringCheck {
    let pairs: [string, unknown, string][];
    try {
        pairs = [...iterOverrides()];
    } catch (e) {
        return {
            id: 'settings-resolution',
            status: 'fail',
            message: `settings cascade did not resolve: ${e instanceof Error ? e.message : String(e)}`,
            remedy: 'check the YAML in every layer `agent-config settings:get <key>` reports',
        };
    }
    if (pairs.length === 0) {
        return {
            id: 'settings-resolution',
            status: 'info',
            message:
                'settings cascade resolves, and NO layer sets any key — every read falls to the ' +
                'template default. That is a valid state, not a failure: a fresh project has no settings.',
            remedy: '',
        };
    }
    // Last writer wins, which is the resolver's own rule — so the winning file
    // is the LAST occurrence of a key, not the first.
    const winner = new Map<string, string>();
    for (const [key, , file] of pairs) winner.set(key, file);
    const byFile = new Map<string, number>();
    for (const file of winner.values()) byFile.set(file, (byFile.get(file) ?? 0) + 1);
    const summary = [...byFile.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([f, n]) => `${path.basename(f)}=${String(n)}`)
        .join(' · ');
    return {
        id: 'settings-resolution',
        status: 'ok',
        message: `${String(winner.size)} key(s) resolved across ${String(byFile.size)} layer(s) — ${summary}`,
        remedy: '',
    };
}

/**
 * Step 3 — the router artifact exists, PARSES, and reports its rule count.
 *
 * Parsing is the half that matters. A router file that exists but does not parse
 * fails silently at load: the host reads no rules and behaves like a tree with
 * none, which is indistinguishable from a correctly minimal configuration.
 */
export function checkRouterArtifact(repoRoot: string, rel = 'dist/router.json'): WiringCheck {
    const abs = path.join(repoRoot, rel);
    if (!fs.existsSync(abs)) {
        return {
            id: 'router-artifact',
            status: 'warn',
            message: `${rel} is absent — no rule router is deployed`,
            remedy: 'task generate-tools',
        };
    }
    let doc: unknown;
    try {
        doc = JSON.parse(fs.readFileSync(abs, 'utf8'));
    } catch (e) {
        return {
            id: 'router-artifact',
            status: 'fail',
            message: `${rel} exists but does NOT parse: ${e instanceof Error ? e.message : String(e)}`,
            remedy: 'task generate-tools (a present-but-unparseable router loads as zero rules)',
        };
    }
    const rules = _routerRuleCount(doc);
    if (rules === 0) {
        return {
            id: 'router-artifact',
            status: 'warn',
            message: `${rel} parses and carries ZERO rules — a router with no rules routes nothing`,
            remedy: 'task generate-tools',
        };
    }
    return { id: 'router-artifact', status: 'ok', message: `${rel} parses · ${String(rules)} rule(s)`, remedy: '' };
}

/** Count routed rules across whichever shape the artifact uses. */
export function _routerRuleCount(doc: unknown): number {
    if (doc === null || typeof doc !== 'object') return 0;
    const d = doc as Record<string, unknown>;
    if (Array.isArray(d['rules'])) return d['rules'].length;
    let n = 0;
    for (const v of Object.values(d)) {
        if (Array.isArray(v)) n += v.length;
        else if (v !== null && typeof v === 'object') n += _routerRuleCount(v);
    }
    return n;
}

export interface HookProbe {
    id: string;
    script: string;
    resolves: boolean;
    ms: number | null;
}

/**
 * Step 4 — every registered hook resolves to a real file, with its cost.
 *
 * Cost is reported PER HOOK rather than as a total, because a latency
 * regression is only actionable where it is incurred: a 300 ms total tells you
 * nothing, while one 280 ms concern names itself.
 *
 * `probe` defaults to a real invocation with `--help`, which every dispatcher
 * entry point accepts and which does no work. Injectable so the unit tests do
 * not spawn 53 processes.
 */
export function checkHookResolution(
    repoRoot: string,
    manifestRel = 'src/scripts/hook_manifest.yaml',
    probe: ((script: string) => number | null) | null = null,
): { check: WiringCheck; probes: HookProbe[] } {
    const abs = path.join(repoRoot, manifestRel);
    if (!fs.existsSync(abs)) {
        return {
            check: {
                id: 'hook-resolution',
                status: 'fail',
                message: `${manifestRel} is absent — the hook estate cannot be enumerated`,
                remedy: 'restore the manifest; every hook is registered from it',
            },
            probes: [],
        };
    }
    let concerns: Record<string, { script?: unknown }>;
    try {
        const doc = parseYaml(fs.readFileSync(abs, 'utf8')) as { concerns?: unknown };
        concerns = (doc.concerns ?? {}) as Record<string, { script?: unknown }>;
    } catch (e) {
        return {
            check: {
                id: 'hook-resolution',
                status: 'fail',
                message: `${manifestRel} does not parse: ${e instanceof Error ? e.message : String(e)}`,
                remedy: 'fix the manifest YAML',
            },
            probes: [],
        };
    }
    const probes: HookProbe[] = [];
    for (const [id, c] of Object.entries(concerns)) {
        const script = typeof c.script === 'string' ? c.script : '';
        const resolves = script !== '' && fs.existsSync(path.join(repoRoot, script));
        probes.push({ id, script, resolves, ms: resolves && probe !== null ? probe(script) : null });
    }
    const broken = probes.filter((p) => !p.resolves);
    if (broken.length > 0) {
        return {
            check: {
                id: 'hook-resolution',
                status: 'fail',
                message:
                    `${String(broken.length)} of ${String(probes.length)} registered hook(s) do NOT resolve to a file: ` +
                    broken.map((b) => b.id).join(', '),
                remedy: 'a registered hook with no script silently no-ops every session — fix the path or drop the entry',
            },
            probes,
        };
    }
    const timed = probes.filter((p) => p.ms !== null).sort((a, b) => (b.ms ?? 0) - (a.ms ?? 0));
    const slowest = timed.length > 0 ? ` · slowest ${timed[0]!.id} ${String(timed[0]!.ms)}ms` : '';
    return {
        check: {
            id: 'hook-resolution',
            status: 'ok',
            message: `${String(probes.length)} registered hook(s), all resolving${slowest}`,
            remedy: '',
        },
        probes,
    };
}

/** A real `--help` invocation, timed. `null` when it cannot be measured. */
export function probeHookCost(repoRoot: string, script: string): number | null {
    const started = Date.now();
    const r = spawnSync(process.execPath, [path.join(repoRoot, 'scripts-run'), script, '--help'], {
        cwd: repoRoot,
        encoding: 'utf8',
        timeout: 10_000,
    });
    if (r.error) return null;
    return Date.now() - started;
}

/**
 * Step 5 — an inherited git-discovery variable.
 *
 * The recorded failure: a git hook exports `GIT_DIR` into every child, so a gate
 * run inside one resolves against whatever that points at — inside a worktree,
 * the parent checkout. The gate runs, reads the wrong tree, and PASSES. Nothing
 * about the output says which repository answered.
 *
 * Reported as a warning rather than a failure because the variable is legitimate
 * where git itself set it; what it is not is invisible.
 */
export function checkInheritedGitEnv(env: NodeJS.ProcessEnv = process.env): WiringCheck {
    const found = inheritedGitOverrides(env);
    if (found.length === 0) {
        return {
            id: 'inherited-git-env',
            status: 'ok',
            message: 'no git discovery override in the environment — git resolves from the working directory',
            remedy: '',
        };
    }
    return {
        id: 'inherited-git-env',
        status: 'warn',
        message:
            `${String(found.length)} git discovery override(s) inherited: ` +
            found.map((f) => `${f.name}=${f.value}`).join(' · ') +
            ' — every git call in this process answers for THAT repository, not the working directory',
        remedy:
            'unset them before running a gate from inside a git hook (`env -u GIT_DIR -u GIT_WORK_TREE …`), ' +
            'or resolve the root with _lib/repo_root.ts, which refuses instead of guessing',
    };
}
