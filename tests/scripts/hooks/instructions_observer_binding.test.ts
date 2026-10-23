/**
 * The `InstructionsLoaded` binding (road-to-a-setup-that-decides-itself 1.1).
 *
 * The observer existed before this binding and was unit-tested on its own; what
 * these cases hold is the WIRING: the manifest runs it on `claude` alone, the
 * dispatcher reaches it from its own chunk rather than the bundle, and a real
 * dispatch of the native event leaves one capture line — while the kill switch
 * leaves none.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CONCERN_REGISTRY, isInProcessConcern } from '../../../src/scripts/hooks/concern_registry.js';
import { EVENT_VOCABULARY } from '../../../src/scripts/hooks/dispatch_hook.js';
import { LAZY_CONCERNS, _resetLazyConcernCache, loadLazyConcernUncached } from '../../../src/scripts/hooks/lazy_concern.js';
import { KILL_SWITCH_ENV } from '../../../src/scripts/hooks/instructions_observer_hook.js';

const REPO = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const DISPATCH = path.join(REPO, 'src', 'scripts', 'hooks', 'dispatch_hook.ts');
const OBSERVER = 'src/scripts/hooks/instructions_observer_hook.ts';
const SESSION = 'sess-binding-probe';

interface Manifest {
    concerns: Record<string, { script: string }>;
    platforms: Record<string, Record<string, unknown>>;
    native_event_aliases: Record<string, Record<string, string>>;
}

const manifest = parseYaml(fs.readFileSync(path.join(REPO, 'src', 'scripts', 'hook_manifest.yaml'), 'utf-8')) as Manifest;

describe('manifest binding', () => {
    it('declares the event and the concern', () => {
        expect(EVENT_VOCABULARY.has('instructions_loaded')).toBe(true);
        expect(manifest.concerns['instructions-observer']?.script).toBe(OBSERVER);
    });

    it('runs the observer on claude, and on no other platform', () => {
        const bound = Object.entries(manifest.platforms)
            .filter(([, events]) => Object.prototype.hasOwnProperty.call(events, 'instructions_loaded'))
            .map(([platform]) => platform);
        expect(bound).toEqual(['claude']);
        expect(manifest.platforms['claude']!['instructions_loaded']).toEqual(['instructions-observer']);
    });

    it('aliases the native event on claude alone', () => {
        const aliased = Object.entries(manifest.native_event_aliases)
            .filter(([, aliases]) => aliases['InstructionsLoaded'] !== undefined)
            .map(([platform, aliases]) => [platform, aliases['InstructionsLoaded']]);
        expect(aliased).toEqual([['claude', 'instructions_loaded']]);
    });
});

describe('in-process reach', () => {
    it('is lazy, not inlined, and still in-process', () => {
        expect(CONCERN_REGISTRY[OBSERVER]).toBeUndefined();
        expect(LAZY_CONCERNS[OBSERVER]?.chunk).toBe('instructions_observer.chunk.cjs');
        expect(isInProcessConcern(OBSERVER)).toBe(true);
    });

    it('loads a callable main from the source tree', () => {
        _resetLazyConcernCache();
        expect(typeof loadLazyConcernUncached(OBSERVER)).toBe('function');
    });
});

function dispatch(machineRoot: string, projectDir: string, extraEnv: Record<string, string> = {}): number {
    const r = spawnSync(
        'npx',
        ['tsx', DISPATCH, '--platform', 'claude', '--event', 'instructions_loaded', '--native-event', 'InstructionsLoaded', '--project-dir', projectDir],
        {
            input: JSON.stringify({
                session_id: SESSION,
                hook_event_name: 'InstructionsLoaded',
                load_reason: 'session_start',
                file_path: path.join(os.homedir(), '.claude', 'rules', 'probe-rule.md'),
            }),
            encoding: 'utf-8',
            cwd: REPO,
            timeout: 180_000,
            env: { ...process.env, EVENT4U_CONFIG_HOME: machineRoot, ...extraEnv },
        },
    );
    return r.status ?? -1;
}

describe('a real dispatch of InstructionsLoaded', () => {
    it('writes one capture line under runtime/arrivals and exits 0', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'il-binding-'));
        const project = fs.mkdtempSync(path.join(os.tmpdir(), 'il-project-'));
        try {
            expect(dispatch(root, project)).toBe(0);
            const file = path.join(root, 'runtime', 'arrivals', `${SESSION}.jsonl`);
            const lines = fs.readFileSync(file, 'utf-8').trim().split('\n');
            expect(lines).toHaveLength(1);
            const line = JSON.parse(lines[0]!) as Record<string, unknown>;
            expect(line['session']).toBe(SESSION);
            expect(line['name']).toBe('InstructionsLoaded');
            expect(line['file']).toBe('probe-rule.md');
            expect(line['rules']).toBe(true);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
            fs.rmSync(project, { recursive: true, force: true });
        }
    }, 200_000);

    it('writes nothing with the kill switch set (source mode)', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'il-binding-off-'));
        const project = fs.mkdtempSync(path.join(os.tmpdir(), 'il-project-off-'));
        try {
            expect(dispatch(root, project, { [KILL_SWITCH_ENV]: 'off' })).toBe(0);
            expect(fs.existsSync(path.join(root, 'runtime', 'arrivals'))).toBe(false);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
            fs.rmSync(project, { recursive: true, force: true });
        }
    }, 200_000);
});

/**
 * The shipped path: the built `dist/hooks/dispatch.js` loading the built chunk.
 * Bundle and chunk are built fresh into a throwaway directory (a developer's own
 * `dist/` may be stale), then laid out as an install. Which path answered is
 * decided by what the layout leaves reachable: with no observer source on disk
 * the spawn fallback has nothing to run, so a capture line proves the chunk.
 */
/** The flags `build:hooks` passes besides the banner; asserted against the script so the two cannot drift. */
const BUILD_HOOKS_FLAGS =
    'esbuild src/scripts/hooks/dispatch_entry.ts --bundle --platform=node --format=esm --target=node20 ' +
    '--define:__AGENT_CONFIG_BUNDLE__=true --outfile=dist/hooks/dispatch.js';

describe('the built bundle', () => {
    let build = '';

    beforeAll(async () => {
        build = fs.mkdtempSync(path.join(os.tmpdir(), 'il-build-'));
        const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf-8')) as { scripts: Record<string, string> };
        // Cut at the digest step, not at the first `&&`: the banner holds `&&` of its own.
        const script = pkg.scripts['build:hooks']!.split(' && node src/scripts/write_bundle_digest.mjs')[0]!;
        const banner = /--banner:js="([^"]*)"/.exec(script)?.[1];
        expect(banner, 'build:hooks carries a --banner:js').toBeDefined();
        expect(script.replace(/ --banner:js="[^"]*"/, '')).toBe(BUILD_HOOKS_FLAGS);
        // The esbuild API, not a shell: no quoting of the temp path, and no POSIX-only `sh`.
        const { buildSync } = await import('esbuild');
        buildSync({
            absWorkingDir: REPO,
            entryPoints: ['src/scripts/hooks/dispatch_entry.ts'],
            bundle: true,
            platform: 'node',
            format: 'esm',
            target: 'node20',
            define: { __AGENT_CONFIG_BUNDLE__: 'true' },
            outfile: path.join(build, 'dispatch.js'),
            banner: { js: banner! },
            logLevel: 'error',
        });
        const { buildChunk } = (await import('../../../src/scripts/hook_chunks.mjs')) as {
            buildChunk: (root: string, entry: string, outfile: string) => void;
        };
        buildChunk(REPO, OBSERVER, path.join(build, 'instructions_observer.chunk.cjs'));
        for (const f of ['dispatch.js', 'instructions_observer.chunk.cjs']) {
            const d = spawnSync(process.execPath, [path.join(REPO, 'src', 'scripts', 'write_bundle_digest.mjs'), path.join(build, f)], { encoding: 'utf-8' });
            expect(d.status, d.stderr).toBe(0);
        }
    }, 180_000);

    afterAll(() => {
        if (build) fs.rmSync(build, { recursive: true, force: true });
    });

    /**
     * Mirror `from` into `to` as symlinks, except along the path to `omit`, where
     * real directories are made so the one file can be left out. The bundle reads
     * data files from `src/` at runtime, so the tree must be there; only the
     * observer source must not be.
     */
    /** A directory junction needs no privilege on Windows; a file link does, so files are copied there. */
    function link(target: string, at: string): void {
        if (fs.statSync(target).isDirectory()) fs.symlinkSync(target, at, 'junction');
        else if (process.platform === 'win32') fs.copyFileSync(target, at);
        else fs.symlinkSync(target, at);
    }

    function mirrorWithout(from: string, to: string, omit: string): void {
        fs.mkdirSync(to, { recursive: true });
        const [head, ...rest] = omit.split('/');
        for (const entry of fs.readdirSync(from)) {
            if (entry !== head) {
                link(path.join(from, entry), path.join(to, entry));
            } else if (rest.length > 0) {
                mirrorWithout(path.join(from, entry), path.join(to, entry), rest.join('/'));
            }
        }
    }

    /** An install root: the built bundle, optionally its chunk, optionally the observer source the spawn path needs. */
    function install(opts: { chunk: boolean; source: boolean }): string {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'il-install-'));
        const hooks = path.join(root, 'dist', 'hooks');
        fs.mkdirSync(hooks, { recursive: true });
        for (const f of fs.readdirSync(build)) {
            if (!opts.chunk && f.startsWith('instructions_observer.chunk.cjs')) continue;
            fs.copyFileSync(path.join(build, f), path.join(hooks, f));
        }
        fs.copyFileSync(path.join(REPO, 'package.json'), path.join(root, 'package.json'));
        link(path.join(REPO, 'node_modules'), path.join(root, 'node_modules'));
        if (opts.source) {
            link(path.join(REPO, 'src'), path.join(root, 'src'));
        } else {
            mirrorWithout(path.join(REPO, 'src'), path.join(root, 'src'), OBSERVER.replace(/^src\//, ''));
        }
        return root;
    }

    function runBuilt(root: string): { code: number; lines: string[] } {
        const machine = path.join(root, 'machine');
        const project = path.join(root, 'project');
        fs.mkdirSync(project);
        const r = spawnSync(
            process.execPath,
            [path.join(root, 'dist', 'hooks', 'dispatch.js'), '--platform', 'claude', '--event', 'instructions_loaded', '--native-event', 'InstructionsLoaded', '--project-dir', project],
            {
                input: JSON.stringify({ session_id: SESSION, hook_event_name: 'InstructionsLoaded', file_path: '/x/.claude/rules/r.md' }),
                encoding: 'utf-8',
                cwd: project,
                timeout: 120_000,
                env: { ...process.env, EVENT4U_CONFIG_HOME: machine },
            },
        );
        const file = path.join(machine, 'runtime', 'arrivals', `${SESSION}.jsonl`);
        return { code: r.status ?? -1, lines: fs.existsSync(file) ? fs.readFileSync(file, 'utf-8').trim().split('\n') : [] };
    }

    it('captures through the chunk when no source is on disk', () => {
        const root = install({ chunk: true, source: false });
        try {
            const { code, lines } = runBuilt(root);
            expect(code).toBe(0);
            expect(lines).toHaveLength(1);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    }, 150_000);

    it('captures nothing with neither the chunk nor the source — the control for the case above', () => {
        const root = install({ chunk: false, source: false });
        try {
            const { code, lines } = runBuilt(root);
            expect(code).toBe(0);
            expect(lines).toHaveLength(0);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    }, 150_000);

    it('falls back to the spawn path when the chunk is missing and still captures', () => {
        const root = install({ chunk: false, source: true });
        try {
            const { code, lines } = runBuilt(root);
            expect(code).toBe(0);
            expect(lines).toHaveLength(1);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    }, 150_000);
});
