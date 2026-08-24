#!/usr/bin/env tsx
/**
 * Global-install smoke harness — does the PUBLISHED payload still work?
 *
 * `prepack-check.mjs` (in the `prepack` script) answers a narrower question:
 * does every import in the packed set RESOLVE. That is not the same question,
 * and the gap is recorded in the tree rather than hypothetical —
 * `src/cli/python/workspace_hosts.ts:180-191` records a real
 * `ERR_MODULE_NOT_FOUND` in a global install, and
 * `src/server/routes/wizard.ts:136-137` invokes a shell script from
 * `src/scripts/` **by path** at runtime, which no import graph can see. A trim
 * can pass every static gate and still break an install.
 *
 * So this harness is behavioural: pack a real tarball, install it into a
 * throwaway prefix, and RUN the consumer surface.
 *
 * WHY IT EXISTS AT ALL — `road-to-npm-payload-reduction` Phase 1.1. The
 * `packed_size_mb` cap has been raised four times in twenty days (6.4 → 6.9 →
 * 7.8 → 8.4 → 9.2), and every note names the same structural cause: nobody
 * knows which of the 16.7 MB under `src/scripts/` a consumer actually needs.
 * That question is not decidable by reading import specifiers — an earlier
 * budget note asserted an answer that way and had to retract it. It is
 * decidable by removing a subtree and watching an install break, or not.
 *
 * ```bash
 *   pack_install_smoke                        # the tarball as it ships
 *   pack_install_smoke --exclude src/scripts/ai_council/
 *   pack_install_smoke --sabotage src/scripts/_lib/   # must FAIL — sensitivity
 *   pack_install_smoke --json
 * ```
 *
 * `--exclude` appends a negation to `files[]` in a COPY of package.json inside
 * a temporary clone; the tracked tree is never modified.
 *
 * Exit codes: 0 = every probe passed · 1 = a probe failed · 2 = harness error
 * (could not pack, could not install) — kept distinct because "the install
 * broke" and "the harness broke" must not read the same.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _FILE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_FILE), '..', '..');

export interface ProbeResult {
    readonly name: string;
    readonly ok: boolean;
    readonly exit: number | null;
    readonly detail: string;
}

export interface SmokeResult {
    readonly excluded: readonly string[];
    readonly packedBytes: number | null;
    readonly probes: readonly ProbeResult[];
    readonly ok: boolean;
    readonly harnessError: string | null;
}

const run = (
    cmd: string,
    args: readonly string[],
    opts: { cwd?: string; env?: NodeJS.ProcessEnv; timeout?: number } = {},
): SpawnSyncReturns<string> =>
    spawnSync(cmd, [...args], {
        cwd: opts.cwd ?? REPO,
        encoding: 'utf8',
        timeout: opts.timeout ?? 600_000,
        maxBuffer: 64 * 1024 * 1024,
        env: opts.env ?? process.env,
    });

/** A throwaway checkout of HEAD — never the working tree, so `--exclude` is safe. */
function stageClone(excluded: readonly string[]): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-pack-smoke-'));
    const src = path.join(dir, 'src');
    const r = run('git', ['worktree', 'add', '--quiet', '--detach', src, 'HEAD']);
    if (r.status !== 0) throw new Error(`git worktree add failed: ${r.stderr}`);
    if (excluded.length > 0) {
        const pj = path.join(src, 'package.json');
        const manifest = JSON.parse(fs.readFileSync(pj, 'utf8')) as { files?: string[] };
        // A trailing negation wins in npm's files[] evaluation, which is what
        // makes a one-line append a faithful simulation of removing a subtree.
        // A directory argument gets `**` appended; a glob (one containing `*`)
        // is passed through as written. Without that distinction only whole
        // subtrees could be tested, and the reductions that actually exist in
        // this payload are FILE PATTERNS, not subtrees.
        manifest.files = [
            ...(manifest.files ?? []),
            ...excluded.map((e) => (e.includes('*') ? `!${e}` : `!${e}**`)),
        ];
        fs.writeFileSync(pj, JSON.stringify(manifest, null, 4), 'utf8');
    }
    return dir;
}

/** The consumer surface. Each probe is one thing a real install must be able to do. */
function probes(bin: string, home: string, project: string): ProbeResult[] {
    const env: NodeJS.ProcessEnv = {
        ...process.env,
        HOME: home,
        EVENT4U_CONFIG_HOME: path.join(home, '.event4u', 'agent-config'),
        AGENT_CONFIG_NO_UI: '1',
        CI: '1',
    };
    const probe = (name: string, args: readonly string[], cwd = project): ProbeResult => {
        const r = run(bin, args, { cwd, env, timeout: 300_000 });
        const detail = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().slice(-1200);
        return { name, ok: r.status === 0, exit: r.status, detail };
    };

    const out: ProbeResult[] = [
        probe('--version', ['--version']),
        // The projection writers are the surface where a missing template or
        // script shows up as a real failure, so they must be exercised. The CLI
        // `install` verb boots the wizard UI and takes no --global/--tools —
        // that is the BASH orchestrator's signature, and getting this wrong once
        // produced a red probe that said nothing about the payload. `--dry-run`
        // is the CLI's own writes-suppressed boot.

        probe('council:status', ['council:status']),
        probe('hooks:status', ['hooks:status']),
        probe('mcp:available', ['mcp:available']),
        // `mcp:available` only lists the registry. `mcp:setup` verifies the
        // server MODULE resolves, which is the probe that can actually see
        // src/scripts/mcp_server/ disappear — without it, excluding that subtree
        // reads green for the wrong reason.
        probe('mcp:setup (server module resolves)', ['mcp:setup']),
        probe('settings:get', ['settings:get', 'roles.active_role']),
    ];

    // The wizard boot is a separate shape: it must START and then be killable,
    // so a zero exit is the wrong assertion — a server that exits 0 immediately
    // has not booted. `--check` is the non-serving form when the CLI has one.
    const boot = run(bin, ['setup', '--check'], { cwd: project, env, timeout: 120_000 });
    out.push({
        name: 'setup --check (wizard boot path)',
        // A CLI that does not know the flag is a harness limitation, not an
        // install defect — recorded as such rather than silently counted green.
        ok: boot.status === 0 || /unknown option|unknown command/i.test(`${boot.stderr}`),
        exit: boot.status,
        detail: `${boot.stdout ?? ''}${boot.stderr ?? ''}`.trim().slice(-600),
    });

    // The wizard boot is a SERVER: it prints WIZARD_READY and then stays up, so
    // exit 0 is the wrong assertion — a zero exit here would mean it died. The
    // marker is the success signal, and the timeout is the harness's way of
    // saying "it was still serving".
    const wiz = run(bin, ['install', '--dry-run', '--no-open', '--allow-headless'], {
        cwd: project,
        env,
        timeout: 60_000,
    });
    const wizOut = `${wiz.stdout ?? ''}${wiz.stderr ?? ''}`;
    out.push({
        name: 'install --dry-run boots the wizard (WIZARD_READY)',
        ok: wizOut.includes('WIZARD_READY'),
        exit: wiz.status,
        detail: wizOut.trim().slice(-900),
    });

    // The bash orchestrator, run FROM THE INSTALLED TREE. This is the probe that
    // actually reads `src/scripts/` by path rather than by import, which is the
    // only way the path-reachability the roadmap's Context documents gets tested.
    // bin resolves to <pkg>/dist/cli/agent-config.js, so the package root is
    // THREE levels up. Two was wrong and reported a payload finding that was a
    // harness defect — recorded because that is the exact confusion this whole
    // harness exists to prevent.
    const pkgRoot = path.resolve(path.dirname(fs.realpathSync(bin)), '..', '..');
    const orch = path.join(pkgRoot, 'src', 'scripts', 'install');
    if (fs.existsSync(orch)) {
        const r = run('bash', [orch, '--global', '--tools=claude-code', '--yes', '--quiet'], {
            cwd: project,
            env,
            timeout: 300_000,
        });
        out.push({
            name: 'bash src/scripts/install --global (installed tree)',
            ok: r.status === 0,
            exit: r.status,
            detail: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().slice(-1500),
        });
    } else {
        out.push({
            name: 'bash src/scripts/install --global (installed tree)',
            ok: false,
            exit: null,
            detail: `orchestrator absent from the installed tree at ${orch} — this IS a payload finding, not a harness gap`,
        });
    }

    // The media pipeline, dry-run. src/scripts/ai-video/ is shell, so no import
    // graph reaches it and only a by-path invocation can see it go missing.
    const trace = path.join(pkgRoot, 'src', 'scripts', 'ai-video', 'smoke-trace.sh');
    out.push({
        name: 'ai-video smoke-trace.sh present and executable (dry-run path)',
        ok: fs.existsSync(trace),
        exit: null,
        detail: fs.existsSync(trace)
            ? trace
            : `absent from the installed tree at ${trace} — the /video:* surface has no shell to call`,
    });

    // One hook dispatch, the surface a consumer's editor drives on every turn.
    const disp = run(
        bin,
        ['dispatch:hook', '--platform', 'claude', '--event', 'pre_tool_use', '--project-dir', project],
        { cwd: project, env: { ...env, CLAUDE_PROJECT_DIR: project }, timeout: 120_000 },
    );
    out.push({
        name: 'dispatch:hook pre_tool_use',
        // A dispatcher legitimately returns non-zero to BLOCK. What must never
        // happen is a module-resolution crash, so that is what is asserted.
        ok: !/ERR_MODULE_NOT_FOUND|Cannot find module|ERR_REQUIRE_ESM/.test(
            `${disp.stdout ?? ''}${disp.stderr ?? ''}`,
        ),
        exit: disp.status,
        detail: `${disp.stdout ?? ''}${disp.stderr ?? ''}`.trim().slice(-1200),
    });
    return out;
}

export function smoke(excluded: readonly string[]): SmokeResult {
    let stage: string | null = null;
    const fail = (msg: string): SmokeResult => ({
        excluded,
        packedBytes: null,
        probes: [],
        ok: false,
        harnessError: msg,
    });
    try {
        stage = stageClone(excluded);
        const src = path.join(stage, 'src');
        const prefix = path.join(stage, 'prefix');
        const home = path.join(stage, 'home');
        const project = path.join(stage, 'project');
        for (const d of [prefix, home, project]) fs.mkdirSync(d, { recursive: true });
        fs.writeFileSync(path.join(project, 'package.json'), '{"name":"smoke-project"}\n', 'utf8');

        // node_modules is symlinked rather than installed: `prepack` runs the
        // real build, and a fresh `npm ci` per bisect step would make the loop
        // unusable. The symlink is read-only in practice — the build writes into
        // the clone's own dist/.
        const nm = path.join(src, 'node_modules');
        if (!fs.existsSync(nm)) fs.symlinkSync(path.join(REPO, 'node_modules'), nm, 'dir');

        // NOT --ignore-scripts. The budget file measures the TRACKED payload
        // that way, but a published tarball is BUILT — `prepack` runs
        // `npm run build`, and dist/cli/agent-config.js is the `bin` target. A
        // harness packing an unbuilt tree installs a package with no binary and
        // proves nothing about the payload a consumer downloads.
        const packed = run('npm', ['pack', '--json', '--pack-destination', stage], {
            cwd: src,
            timeout: 900_000,
        });
        if (packed.status !== 0) return fail(`npm pack failed: ${packed.stderr.slice(-800)}`);
        // `prepack` runs the build, whose progress goes to stdout too — and the
        // build itself prints bracketed lines, so "slice from the last `[`" is
        // not enough either. Take the last balanced top-level array and parse
        // that; if it does not parse, fall back to finding the tarball on disk,
        // because the pack SUCCEEDED and only its report was unreadable.
        const entry = ((): { filename: string; size: number } | null => {
            for (let i = packed.stdout.lastIndexOf('['); i !== -1; i = packed.stdout.lastIndexOf('[', i - 1)) {
                try {
                    const parsed = JSON.parse(packed.stdout.slice(i)) as Array<{ filename: string; size: number }>;
                    if (Array.isArray(parsed) && parsed[0]?.filename !== undefined) return parsed[0];
                } catch {
                    /* keep walking left */
                }
            }
            const tgz = fs.readdirSync(stage).filter((f) => f.endsWith('.tgz'));
            const only = tgz[0];
            if (only === undefined) return null;
            return { filename: only, size: fs.statSync(path.join(stage, only)).size };
        })();
        if (entry === null) return fail(`npm pack produced no tarball: ${packed.stdout.slice(-800)}`);
        const tarball = path.join(stage, entry.filename);

        const inst = run(
            'npm',
            ['install', '--global', '--prefix', prefix, '--ignore-scripts', '--no-audit', '--no-fund', tarball],
            { cwd: stage, env: { ...process.env, npm_config_prefix: prefix } },
        );
        if (inst.status !== 0) return fail(`global install failed: ${inst.stderr.slice(-1500)}`);

        const bin = path.join(prefix, 'bin', 'agent-config');
        if (!fs.existsSync(bin)) return fail(`installed bin missing at ${bin}`);

        const results = probes(bin, home, project);
        return {
            excluded,
            packedBytes: entry.size,
            probes: results,
            ok: results.every((p) => p.ok),
            harnessError: null,
        };
    } catch (exc) {
        return fail(String(exc));
    } finally {
        if (stage !== null) {
            // Detach the worktree before removing it, or git keeps a dangling
            // administrative entry that breaks the NEXT run in the same repo.
            run('git', ['worktree', 'remove', '--force', path.join(stage, 'src')]);
            fs.rmSync(stage, { recursive: true, force: true });
        }
    }
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const excluded: string[] = [];
    let sabotage: string | null = null;
    const json = argv.includes('--json');
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--exclude' && argv[i + 1] !== undefined) excluded.push(argv[i + 1] as string);
        if (argv[i] === '--sabotage' && argv[i + 1] !== undefined) sabotage = argv[i + 1] as string;
    }
    if (sabotage !== null) excluded.push(sabotage);

    const res = smoke(excluded);
    if (json) {
        process.stdout.write(`${JSON.stringify(res, null, 2)}\n`);
    } else {
        const mb = res.packedBytes === null ? 'n/a' : (res.packedBytes / 1e6).toFixed(4);
        process.stdout.write(
            `pack_install_smoke · excluded=${excluded.length === 0 ? '(none)' : excluded.join(' ')} · packed=${mb} MB\n`,
        );
        for (const p of res.probes) {
            process.stdout.write(`  ${p.ok ? '✅' : '❌'} ${p.name} (exit ${String(p.exit)})\n`);
            if (!p.ok) process.stdout.write(`      ${p.detail.split('\n').slice(-6).join('\n      ')}\n`);
        }
        if (res.harnessError !== null) process.stderr.write(`\n⚠️  harness error: ${res.harnessError}\n`);
    }
    if (res.harnessError !== null) return 2;
    if (sabotage !== null) {
        // Sensitivity mode: the run is CORRECT when the install breaks.
        const broke = !res.ok;
        process.stdout.write(
            broke
                ? `\n✅  sabotage of ${sabotage} broke the install — the harness is sensitive.\n`
                : `\n❌  sabotage of ${sabotage} did NOT break the install. Either the subtree is genuinely unused, or this harness cannot see the surface that needs it — say which before trusting a green.\n`,
        );
        return broke ? 0 : 1;
    }
    return res.ok ? 0 : 1;
}

function _isCliEntry(): boolean {
    const a = process.argv[1];
    if (!a) return false;
    if (a === _FILE || pathToFileURL(path.resolve(a)).href === import.meta.url) return true;
    try {
        return fs.realpathSync(a) === fs.realpathSync(_FILE);
    } catch {
        return false;
    }
}
if (_isCliEntry()) process.exit(main());

export { REPO };
