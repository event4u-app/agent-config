/**
 * Every `cli-delegate` bundle must actually run.
 *
 * `exec_ts` in the Bash dispatcher prefers `dist/cli-delegate/<name>.js` over the
 * `.ts` source, so a consumer never executes the file a developer tests. Four
 * commands shipped as **silent no-ops** because of that gap — `agent-config
 * doctor`, `migrate`, `refresh` and `session:recycle` each produced zero bytes
 * and exit 0 on every installed copy, while the same sources ran correctly under
 * `tsx`.
 *
 * The cause was not one bug. `--splitting` turns an entry file into a re-export
 * shim and moves the module body into a shared chunk, where `import.meta.url` is
 * the CHUNK's url and can never equal `process.argv[1]` — so an entry guard
 * written as that comparison fires or does not fire depending on where esbuild
 * happened to place the code. Commands that worked did so by accident, and any
 * dependency change can flip one into silence.
 *
 * Which is why this test executes the bundles rather than inspecting them: a
 * bundle that does nothing and exits 0 is indistinguishable from a working one
 * by every means except running it. It found the fourth command (`refresh`)
 * after the first three had been fixed by hand.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = path.join(REPO, 'dist', 'cli-delegate');

/**
 * Run one bundle and report what actually happened.
 *
 * `died` is separate from the exit code on purpose: a timeout kill, a signal,
 * and a spawn failure all arrive with a null/undefined status, and folding them
 * into "exit 1" would let a HUNG entry guard — a plausible regression — read as
 * a healthy non-zero exit. The assertion below is `bytes > 0 && !died`, so every
 * abnormal end fails rather than only the one shape that shipped.
 */
function probe(bundle: string): { code: number; bytes: number; died: string | null } {
    try {
        const out = execFileSync(process.execPath, [bundle, '--help'], {
            cwd: REPO,
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 30_000,
        });
        return { code: 0, bytes: out.length, died: null };
    } catch (err) {
        const e = err as {
            status?: number | null;
            signal?: string | null;
            code?: string;
            stdout?: string;
            stderr?: string;
        };
        const bytes = (e.stdout ?? '').length + (e.stderr ?? '').length;
        if (typeof e.status === 'number') {
            return { code: e.status, bytes, died: null };
        }
        return {
            code: -1,
            bytes,
            died: e.signal ? `killed by ${e.signal}` : (e.code ?? 'spawn failed'),
        };
    }
}

describe('cli-delegate bundles', () => {
    let bundles: string[] = [];

    beforeAll(() => {
        // The REAL build script, not a re-spelled esbuild call: a test that
        // rebuilds with its own flags proves nothing about what ships. Measured
        // ~2.5s for the whole file, most of it the 29 node spawns below; esbuild
        // itself is ~50ms and the npm wrapper the rest.
        try {
            execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', [
                'run',
                '--silent',
                'build:cli-delegate',
            ], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf-8', timeout: 120_000 });
        } catch (err) {
            // Surface the compiler diagnostics. Swallowing them leaves the suite
            // red with nothing to read, in a file written to diagnose exactly
            // that kind of silence.
            const e = err as { stdout?: string; stderr?: string };
            throw new Error(
                `build:cli-delegate failed\n${e.stdout ?? ''}\n${e.stderr ?? ''}`.trim(),
            );
        }
        bundles = fs
            .readdirSync(OUT_DIR)
            .filter((n) => n.startsWith('cmd_') && n.endsWith('.js'))
            .sort();
    }, 130_000);

    it('the build produces a bundle per _cli command', () => {
        // Guards the guard: a sweep over an empty outdir passes vacuously. The
        // build globs `src/scripts/_cli/cmd_*.ts`, so the relation is exactly
        // one bundle per source. An earlier version allowed a slack of three for
        // no reason, which would have let three commands drop out of the build
        // and still report green — the failure class this file exists for.
        const sources = fs
            .readdirSync(path.join(REPO, 'src', 'scripts', '_cli'))
            .filter((n) => n.startsWith('cmd_') && n.endsWith('.ts'))
            .map((n) => n.replace(/\.ts$/, ''))
            .sort();
        expect(bundles.map((n) => n.replace(/\.js$/, ''))).toEqual(sources);
    });

    it('no bundle is a silent no-op', () => {
        const broken: string[] = [];
        for (const name of bundles) {
            const { code, bytes, died } = probe(path.join(OUT_DIR, name));
            // Zero output is the signature of the shipped defect: the entry guard
            // did not fire and `main` never ran. `died` covers the neighbours a
            // status-only check would have called healthy.
            if (died !== null) {
                broken.push(`${name} (${died})`);
            } else if (bytes === 0) {
                broken.push(`${name} (no output, exit ${String(code)})`);
            }
        }
        expect(broken).toEqual([]);
    }, 120_000);

    it('cmd_closure runs each tool exactly once — the inlined scripts never self-start', () => {
        // The opposite failure to a silent no-op: closure_scan and
        // lint_decision_classes are inlined into this bundle, where their own
        // entry guard saw `import.meta.url === argv[1]` and ran main() on the
        // `closure:*` argv beside the delegate's dispatch. Measured: every
        // `closure:scan` also printed "lint_decision_classes: error: cannot read scan".
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'closure-bundle-'));
        try {
            fs.writeFileSync(path.join(dir, 'plan.md'), '- [ ] Pick the codec: TBD\n');
            const res = spawnSync(process.execPath, [path.join(OUT_DIR, 'cmd_closure.js'), 'scan', 'plan.md'], {
                cwd: dir,
                encoding: 'utf-8',
                timeout: 30_000,
            });
            expect(res.status).toBe(0);
            expect(res.stdout).toContain('open decisions: 1');
            expect(res.stderr).toBe('');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

/**
 * The same net, one source root over.
 *
 * ADR-204 scoped the bundle to `src/scripts/_cli/`; the roadmap command family
 * lives in `src/agent-src/scripts/` and stayed on `npx tsx`, which resolves
 * against the CONSUMER's cwd — a project pinning `devEngines.runtime` away from
 * the local Node could run none of these commands. Bundling them re-opened the
 * `--splitting` hazard above verbatim: `update_roadmap_progress` shipped a
 * hoisted body in the first probe, its entry guard never fired, and
 * `roadmap:progress-check` returned zero bytes and exit 0. Only executing the
 * bundle distinguishes that from a healthy one.
 *
 * The command list is read from the dispatcher rather than hardcoded, so a new
 * `resolve_script "dist/agent-src/scripts/<n>.ts"` is probed without touching
 * this file.
 */
describe('agent-src + aux delegate bundles', () => {
    let names: string[] = [];

    beforeAll(() => {
        for (const target of ['build:agent-src-delegate', 'build:delegate-aux']) {
            try {
                execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm',
                    ['run', '--silent', target],
                    { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf-8', timeout: 120_000 });
            } catch (err) {
                const e = err as { stdout?: string; stderr?: string };
                throw new Error(`${target} failed\n${e.stdout ?? ''}\n${e.stderr ?? ''}`.trim());
            }
        }
        const dispatch = fs.readFileSync(
            path.join(REPO, 'src', 'scripts', '_dispatch.bash'), 'utf-8');
        names = [
            ...new Set(
                [...dispatch.matchAll(/resolve_script "dist\/agent-src\/scripts\/([A-Za-z0-9_]+)\.ts"/g)]
                    .map((m) => m[1] as string),
            ),
        ].sort();
    }, 130_000);

    it('the build emits a bundle for every dispatcher-referenced agent-src script', () => {
        // Guards the guard: an empty list would make the probe below vacuous.
        expect(names.length).toBeGreaterThan(3);
        const missing = names.filter((n) => !fs.existsSync(path.join(OUT_DIR, `${n}.js`)));
        expect(missing, `no bundle emitted for: ${missing.join(', ')}`).toEqual([]);
    });

    it('no agent-src bundle is a silent no-op', () => {
        const broken: string[] = [];
        for (const n of names) {
            const { code, bytes, died } = probe(path.join(OUT_DIR, `${n}.js`));
            if (died !== null) {
                broken.push(`${n} (${died})`);
            } else if (bytes === 0) {
                broken.push(`${n} (no output, exit ${String(code)})`);
            }
        }
        expect(broken).toEqual([]);
    }, 120_000);

    it('the settings-sync bundle runs from the bundle directory', () => {
        // `agent-config upgrade` runs `settings:sync` once per settings file. A
        // global install ships no tsx, so without this bundle every upgrade fell
        // back to `npx tsx` and printed its three-line warning. The template is
        // resolved relative to the module, so a dry run proves the bundle
        // finds it from dist/cli-delegate/ too.
        const bundle = path.join(OUT_DIR, 'sync_agent_settings.js');
        expect(fs.existsSync(bundle), 'no sync_agent_settings bundle emitted').toBe(true);
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-bundle-'));
        try {
            const target = path.join(dir, '.agent-settings.yml');
            fs.writeFileSync(target, 'cost_profile: minimal\n');
            const r = spawnSync(process.execPath, [bundle, '--path', target, '--dry-run'], { encoding: 'utf-8' });
            expect(r.status, r.stderr).toBe(0);
            expect(r.stdout.length).toBeGreaterThan(0);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }, 60_000);

    it('the update banner bundle runs', () => {
        // `check_update_banner` and `_lib/pin_resolver` run before/after EVERY
        // command and carry the same hoisting hazard. Only the banner is probed:
        // the pin resolver's healthy output IS zero bytes (it acts only on a
        // version-pin mismatch, and provoking one makes it re-exec through the
        // network), so an execution probe cannot tell it apart from a dead
        // guard. Its coverage is structural — see
        // tests/scripts/runtime_dependencies.test.ts.
        expect(fs.existsSync(path.join(OUT_DIR, '_lib', 'pin_resolver.js'))).toBe(true);
        const { bytes, died } = probe(path.join(OUT_DIR, 'check_update_banner.js'));
        expect(died).toBeNull();
        expect(bytes, 'check_update_banner bundle produced no output').toBeGreaterThan(0);
    }, 60_000);
});

/**
 * `cmd_script.js <key>` must answer exactly as `tsx src/scripts/<key>.ts` does.
 *
 * Probing `cmd_script.js --help` alone proves nothing: `--help` is not a key, so
 * no target loads. And a target that loads but resolves its package root by
 * counting parent hops answers differently from a `dist/cli-delegate/` chunk —
 * measured on the first cut: `capabilities:index --check` said "stale" from the
 * bundle and "up to date" from source, because `_lib/agent_src` landed one level
 * above the package root and found no commands. Running every key both ways,
 * plus one tree-reading verb, catches both classes.
 */
describe('cmd_script delegate parity', () => {
    const TSX = path.join(REPO, 'node_modules', '.bin', 'tsx');
    const keys = (() => {
        const dispatch = fs.readFileSync(path.join(REPO, 'src', 'scripts', '_dispatch.bash'), 'utf-8');
        const m = /^SCRIPT_DELEGATES=" ([^"]+) "$/m.exec(dispatch);
        return m === null ? [] : (m[1] ?? '').split(' ');
    })();

    const run = (argv: string[]): { status: number | null; out: string } => {
        const res = spawnSync(argv[0] as string, argv.slice(1), {
            cwd: REPO,
            encoding: 'utf-8',
            input: '',
            timeout: 60_000,
            env: { ...process.env, AGENT_CONFIG_NO_EVENTS_LOG: '1' },
        });
        // Elapsed-time figures ("…, 66ms)") differ run to run; nothing else may.
        return { status: res.status, out: `${res.stdout}${res.stderr}`.replace(/\b\d+(?:\.\d+)?\s?ms\b/g, '<n>ms') };
    };
    const viaBundle = (key: string, args: string[]) =>
        run([process.execPath, path.join(OUT_DIR, 'cmd_script.js'), key, ...args]);
    const viaTsx = (key: string, args: string[]) => run([TSX, path.join(REPO, 'src', 'scripts', `${key}.ts`), ...args]);

    it('reads the key list from the dispatcher', () => {
        expect(keys.length).toBeGreaterThan(25);
        expect(fs.existsSync(path.join(OUT_DIR, 'cmd_script.js'))).toBe(true);
    });

    it('every key answers --help exactly as the source does', () => {
        const drift: string[] = [];
        for (const key of keys) {
            const b = viaBundle(key, ['--help']);
            const t = viaTsx(key, ['--help']);
            if (b.status !== t.status || b.out !== t.out) {
                drift.push(`${key}: bundle exit ${String(b.status)} / tsx exit ${String(t.status)}`);
            }
        }
        expect(drift).toEqual([]);
    }, 300_000);

    it('a tree-reading verb resolves the same package root from the bundle', () => {
        const b = viaBundle('generate_capabilities_index', ['--check']);
        const t = viaTsx('generate_capabilities_index', ['--check']);
        expect({ status: b.status, out: b.out }).toEqual({ status: t.status, out: t.out });
    }, 120_000);

    it('an unknown key fails loudly instead of running nothing', () => {
        const r = viaBundle('no_such_script', []);
        expect(r.status).toBe(127);
        expect(r.out).toContain('no precompiled delegate for src/scripts/no_such_script.ts');
    });
});
