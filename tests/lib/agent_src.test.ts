/**
 * Contract + differential tests for `src/scripts/_lib/agent_src.ts`.
 *
 * Part A — 1:1 vitest port of `tests/test_agent_src_domains.py` (ADR-088
 * parity gate 1; the pytest suite is the behavioral specification). Runs
 * against the REAL repo tree exactly as the Python suite does.
 *
 * Part B — differential suite (ADR-088 parity gate 2). Builds a synthetic
 * repo with two overlapping source roots and asserts that the TS twin and
 * the Python original (driven via `agent_src_py_driver.py`) produce
 * JSON-identical results for `artefact_roots` / `iter_all_sources` /
 * `iter_artefacts` / `iter_commands` / `resolve_logical` / `logical_relpath`
 * / `strip_source_prefix` / `command_slug` / `pack_slug_prefix`.
 */
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import * as A from '../../src/scripts/_lib/agent_src.js';
import { oracle2 } from '../_lib/parity_oracle.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
// Oracle `script` target is repo-relative WITHOUT the `.py` extension.
const PY_DRIVER_STEM = path.relative(REPO_ROOT, path.join(HERE, 'agent_src_py_driver'));

// --- Part A: 1:1 port of tests/test_agent_src_domains.py (real repo) ---------

describe('agent_src — domains command mapping (real repo)', () => {
    test('test_domains_command_logical_mapping', () => {
        const cases: Record<string, string | null> = {
            'src/domains/git/commit/command.md': 'commands/commit.md',
            'src/domains/engineering-base/fix/ci/command.md': 'commands/fix/ci.md',
            'src/domains/meta/agents/user/accept/command.md': 'commands/agents/user/accept.md',
            // non-command leaves map to null (the activation gate)
            'src/domains/laravel/pack.yaml': null,
            'src/domains/fun/FIRST_WIN.md': null,
            'src/domains/git/README.md': null,
        };
        for (const [rel, expected] of Object.entries(cases)) {
            expect(A.strip_source_prefix(rel), rel).toBe(expected);
            expect(A._domains_command_logical(path.join(A.ROOT(), rel)), rel).toBe(expected);
        }
    });

    test('test_no_logical_path_collisions', () => {
        const counts = new Map<string, number>();
        for (const p of A.iter_commands()) {
            const rel = A.logical_relpath(p);
            counts.set(rel, (counts.get(rel) ?? 0) + 1);
        }
        const collisions = [...counts.entries()].filter(([, n]) => n > 1);
        expect(collisions, `command logical-path collisions: ${JSON.stringify(collisions)}`).toEqual(
            [],
        );
    });

    test('test_every_domains_command_round_trips', () => {
        for (const [p, logical] of A._iter_domains_commands()) {
            expect(logical.startsWith('commands/') && logical.endsWith('.md')).toBe(true);
            expect(A.resolve_logical(logical), logical).toBe(p);
        }
    });

    test('test_iter_commands_covers_the_full_surface', () => {
        const cmds = [...A.iter_commands()];
        // 150 commands in the suite as of 6.0.0-D Phase 4; guard against a
        // scanner regression silently dropping the src/domains homes.
        expect(cmds.length).toBeGreaterThanOrEqual(150);
        expect(
            cmds.every((p) => path.basename(p) === 'command.md' || p.split(path.sep).join('/').includes('/commands/')),
        ).toBe(true);
    });
});

// --- ADR-044 amendment A3: slug_prefix mechanism (Step 12), tmp-tree --------
//
// 1:1 port of the three slug tests + their `_with_tmp_domains` helper.

function withTmpDomains(tmpPath: string, build: (dom: string) => void): void {
    const saved = A._getRootsForTest();
    A._setRootsForTest({ SRC_DOMAINS: tmpPath });
    try {
        build(tmpPath);
    } finally {
        A._setRootsForTest(saved); // also clears the slug cache
    }
}

describe('agent_src — command_slug (tmp domains)', () => {
    let tmpPath: string;
    beforeEach(() => {
        tmpPath = mkdtempSync(path.join(tmpdir(), 'agent-src-slug-'));
    });
    afterEach(() => {
        rmSync(tmpPath, { recursive: true, force: true });
    });

    test('test_command_slug_no_prefix_is_bare_subpath', () => {
        withTmpDomains(tmpPath, (dom) => {
            mkdirSync(path.join(dom, 'meta', 'council'), { recursive: true });
            writeFileSync(path.join(dom, 'meta', 'council', 'command.md'), 'x', 'utf-8');
            mkdirSync(path.join(dom, 'meta', 'council', 'analysis'), { recursive: true });
            writeFileSync(path.join(dom, 'meta', 'council', 'analysis', 'command.md'), 'x', 'utf-8');
            expect(A.command_slug(path.join(dom, 'meta', 'council', 'command.md'))).toBe('council');
            expect(
                A.command_slug(path.join(dom, 'meta', 'council', 'analysis', 'command.md')),
            ).toBe('council-analysis');
        });
    });

    test('test_command_slug_pack_prefix_applies', () => {
        withTmpDomains(tmpPath, (dom) => {
            const gitdir = path.join(dom, 'git');
            mkdirSync(path.join(gitdir, 'commit'), { recursive: true });
            mkdirSync(path.join(gitdir, 'pr', 'create'), { recursive: true });
            writeFileSync(
                path.join(gitdir, 'pack.yaml'),
                'id: git\nslug_prefix: git\nversion: 6.0.0\nartefact_count: 2\n',
                'utf-8',
            );
            writeFileSync(path.join(gitdir, 'commit', 'command.md'), 'x', 'utf-8');
            writeFileSync(path.join(gitdir, 'pr', 'create', 'command.md'), 'x', 'utf-8');
            expect(A.pack_slug_prefix('git')).toBe('git');
            expect(A.command_slug(path.join(gitdir, 'commit', 'command.md'))).toBe('git-commit');
            expect(A.command_slug(path.join(gitdir, 'pr', 'create', 'command.md'))).toBe(
                'git-pr-create',
            );
        });
    });

    test('test_command_slug_prefix_not_double_applied', () => {
        withTmpDomains(tmpPath, (dom) => {
            const gitdir = path.join(dom, 'git');
            mkdirSync(path.join(gitdir, 'git', 'sync'), { recursive: true });
            writeFileSync(
                path.join(gitdir, 'pack.yaml'),
                'id: git\nslug_prefix: git\nversion: 6.0.0\nartefact_count: 1\n',
                'utf-8',
            );
            writeFileSync(path.join(gitdir, 'git', 'sync', 'command.md'), 'x', 'utf-8');
            // subpath git/sync already starts with the prefix → no `git-git-sync`
            expect(A.command_slug(path.join(gitdir, 'git', 'sync', 'command.md'))).toBe('git-sync');
        });
    });
});

// --- Part B: differential suite (synthetic 2-root tree, TS vs Python) --------

/**
 * Strip the volatile synthetic-root abs prefix from text so the frozen golden
 * is machine-independent. The ONLY call that leaks an absolute path into the
 * Python output is `logical_relpath` outside-root, whose `{error: ...}` text
 * renders the path verbatim; every other function emits POSIX-relative paths.
 * Applied symmetrically: to the oracle's python output (capture + replay) AND
 * to the `.ts` side before comparing (see the `logical_relpath` test).
 */
function makeSynthNormalize(synthRoot: string): (s: string) => string {
    return (s: string): string => s.split(synthRoot).join('<SYNTH>');
}

/**
 * Drive the Python original against the synthetic root; returns parsed JSON.
 *
 * Oracle-routed (`kind: 'script'`): CAPTURE mode (PY2TS_CAPTURE=1) spawns
 * `python3 <driver>.py <synthRoot> <fn> [arg]` and freezes the JSON stdout;
 * NORMAL mode replays the frozen snapshot with no live python3. The volatile
 * tmp-dir args (`synthRoot`, and any abs path arg under it) are stabilised in
 * the snapshot KEY via `scratch`; the synth-stripping `normalize` keeps the one
 * absolute-path-leaking output (`logical_relpath` error) machine-independent.
 */
function pyDrive(synthRoot: string, fn: string, arg?: string): unknown {
    const args = [synthRoot, fn];
    if (arg !== undefined) {
        args.push(arg);
    }
    const out = oracle2({
        kind: 'script',
        target: PY_DRIVER_STEM,
        args,
        cwd: REPO_ROOT,
        scratch: [synthRoot],
        normalize: makeSynthNormalize(synthRoot),
    });
    expect(out.status, out.stderr).toBe(0);
    return JSON.parse(out.stdout);
}

/** POSIX-relative path of an absolute result under the synthetic root. */
function relPosix(synthRoot: string, abs: string): string {
    return path.relative(synthRoot, abs).split(path.sep).join('/');
}

/**
 * Build a synthetic repo with TWO source roots that share an overlapping
 * logical path (`skills/shared/SKILL.md`) so first-win precedence is exercised:
 *
 *   <root>/.agent-src.uncondensed/skills/legacy-only/SKILL.md
 *   <root>/.agent-src.uncondensed/skills/shared/SKILL.md         (legacy copy)
 *   <root>/.agent-src.uncondensed/rules/legacy-rule.md
 *   <root>/.agent-src.uncondensed/commands/foo/command.md? -> commands tree
 *   <root>/packages/core/.agent-src.uncondensed/skills/core-only/SKILL.md
 *   <root>/packages/core/.agent-src.uncondensed/commands/bar.md
 *   <root>/packages/pack-x/.agent-src.uncondensed/skills/shared/SKILL.md (pkg copy)
 *   <root>/src/skills/flat-skill/SKILL.md
 *   <root>/src/rules/flat-rule.md
 *   <root>/src/agent-src/contexts/ctx.md
 *   <root>/src/domains/git/commit/command.md
 *   <root>/src/domains/git/pack.yaml (slug_prefix: git)
 *   <root>/src/domains/meta/council/analysis/command.md
 *   <root>/src/domains/laravel/pack.yaml (no command leaf — inert)
 */
function buildSynthRepo(root: string): void {
    const w = (rel: string, body = 'x'): void => {
        const full = path.join(root, rel);
        mkdirSync(path.dirname(full), { recursive: true });
        writeFileSync(full, body, 'utf-8');
    };
    // legacy root
    w('.agent-src.uncondensed/skills/legacy-only/SKILL.md');
    w('.agent-src.uncondensed/skills/shared/SKILL.md', 'legacy-shared');
    w('.agent-src.uncondensed/rules/legacy-rule.md');
    w('.agent-src.uncondensed/commands/foo/command.md');
    // packages/* roots (core sorts before pack-x)
    w('packages/core/.agent-src.uncondensed/skills/core-only/SKILL.md');
    w('packages/core/.agent-src.uncondensed/commands/bar.md');
    w('packages/pack-x/.agent-src.uncondensed/skills/shared/SKILL.md', 'pkg-shared');
    // 6.0.0-D flat library + relocated container
    w('src/skills/flat-skill/SKILL.md');
    w('src/rules/flat-rule.md');
    w('src/agent-src/contexts/ctx.md');
    // src/domains commands
    w('src/domains/git/commit/command.md');
    w('src/domains/git/pack.yaml', 'id: git\nslug_prefix: git\nversion: 6.0.0\n');
    w('src/domains/meta/council/analysis/command.md');
    w('src/domains/laravel/pack.yaml', 'id: laravel\nversion: 6.0.0\n');
}

describe('agent_src — differential TS vs Python (synthetic 2-root tree)', () => {
    let synth: string;
    let savedRoots: ReturnType<typeof A._getRootsForTest>;

    beforeEach(() => {
        // realpath so the path matches the Python driver's `Path(...).resolve()`
        // (macOS tmpdir is a /var → /private/var symlink).
        synth = realpathSync(mkdtempSync(path.join(tmpdir(), 'agent-src-diff-')));
        buildSynthRepo(synth);
        savedRoots = A._getRootsForTest();
        // Point the TS twin's roots at the synthetic tree (mirrors the driver).
        A._setRootsForTest({
            ROOT: synth,
            LEGACY_SRC: path.join(synth, '.agent-src.uncondensed'),
            PACKAGES: path.join(synth, 'packages'),
            PACKAGE_CORE: path.join(synth, 'packages', 'core'),
            SRC: path.join(synth, 'src'),
            SRC_SKILLS: path.join(synth, 'src', 'skills'),
            SRC_RULES: path.join(synth, 'src', 'rules'),
            SRC_AGENT: path.join(synth, 'src', 'agent-src'),
            SRC_DOMAINS: path.join(synth, 'src', 'domains'),
        });
    });

    afterEach(() => {
        A._setRootsForTest(savedRoots);
        rmSync(synth, { recursive: true, force: true });
    });

    test('artefact_roots — order + membership match Python', () => {
        const ts = A.artefact_roots().map((p) => relPosix(synth, p));
        expect(ts).toEqual(pyDrive(synth, 'artefact_roots'));
        // sanity: legacy, packages sorted, then src container
        expect(ts).toEqual([
            '.agent-src.uncondensed',
            'packages/core/.agent-src.uncondensed',
            'packages/pack-x/.agent-src.uncondensed',
            'src/agent-src',
            'src',
        ]);
    });

    test('iter_artefacts (.md) — dedup + first-win order match Python', () => {
        const ts = [...A.iter_artefacts()].map((p) => relPosix(synth, p));
        expect(ts).toEqual(pyDrive(synth, 'iter_artefacts'));
        // shared SKILL.md appears once, from the legacy root (first win)
        const sharedHits = ts.filter((p) => p.endsWith('skills/shared/SKILL.md'));
        expect(sharedHits).toEqual(['.agent-src.uncondensed/skills/shared/SKILL.md']);
    });

    test('iter_all_sources — [path, logical] pairs match Python', () => {
        const ts = [...A.iter_all_sources()].map(([p, rel]) => [relPosix(synth, p), rel]);
        expect(ts).toEqual(pyDrive(synth, 'iter_all_sources'));
        // overlapping logical skills/shared/SKILL.md resolves once (first win).
        const logicals = ts.map(([, rel]) => rel);
        expect(logicals.filter((r) => r === 'skills/shared/SKILL.md')).toHaveLength(1);
    });

    test('iter_commands — covers legacy/packages/domains, dedup match Python', () => {
        const ts = [...A.iter_commands()].map((p) => relPosix(synth, p));
        expect(ts).toEqual(pyDrive(synth, 'iter_commands'));
    });

    test('resolve_logical — flat, prefixed, and domains lookups match Python', () => {
        for (const logical of [
            'skills/shared/SKILL.md', // overlapping → first win (legacy)
            'skills/flat-skill/SKILL.md', // src/skills prefix root
            'rules/flat-rule.md', // src/rules prefix root
            'rules/legacy-rule.md', // legacy empty-prefix root
            'commands/commit.md', // src/domains git/commit
            'commands/council/analysis.md', // src/domains meta
            'commands/bar.md', // packages/core commands tree
            'skills/does-not-exist/SKILL.md', // null both sides
        ]) {
            const ts = A.resolve_logical(logical);
            const tsRel = ts === null ? null : relPosix(synth, ts);
            expect(tsRel, logical).toEqual(pyDrive(synth, 'resolve_logical', logical));
        }
    });

    test('logical_relpath — under-root + throw parity match Python', () => {
        const underRoot = [
            '.agent-src.uncondensed/skills/legacy-only/SKILL.md',
            'packages/pack-x/.agent-src.uncondensed/skills/shared/SKILL.md',
            'src/skills/flat-skill/SKILL.md',
            'src/rules/flat-rule.md',
            'src/domains/git/commit/command.md',
        ];
        for (const rel of underRoot) {
            const abs = path.join(synth, rel);
            const ts = { ok: A.logical_relpath(abs) };
            expect(ts, rel).toEqual(pyDrive(synth, 'logical_relpath', abs));
        }
        // outside any root → both throw / emit {error: ...}
        const outside = path.join(synth, 'docs', 'architecture.md');
        let tsErr: string | null = null;
        try {
            A.logical_relpath(outside);
        } catch (e) {
            tsErr = (e as Error).message;
        }
        const py = pyDrive(synth, 'logical_relpath', outside) as { error?: string; ok?: string };
        expect(tsErr).not.toBeNull();
        expect(py.ok).toBeUndefined();
        expect(py.error).toBeDefined();
        // error text identical (path is rendered verbatim in both). The python
        // side was synth-normalized in pyDrive; apply the SAME normalize to the
        // TS error so the comparison is machine-independent (capture vs replay).
        const normalize = makeSynthNormalize(synth);
        expect(tsErr === null ? null : normalize(tsErr)).toBe(py.error);
    });

    test('strip_source_prefix + is_artefact_path — match Python', () => {
        const cases = [
            '.agent-src.uncondensed/rules/foo.md',
            'packages/core/.agent-src.uncondensed/rules/foo.md',
            'packages/pack-x/.agent-src.uncondensed/skills/x/SKILL.md',
            'src/skills/x/SKILL.md',
            'src/rules/y.md',
            'src/domains/git/commit/command.md',
            'src/domains/meta/council/analysis/command.md',
            'src/domains/git/pack.yaml',
            'docs/architecture.md',
        ];
        for (const rel of cases) {
            expect(A.strip_source_prefix(rel), rel).toEqual(
                pyDrive(synth, 'strip_source_prefix', rel),
            );
            expect(A.is_artefact_path(rel), rel).toEqual(pyDrive(synth, 'is_artefact_path', rel));
        }
    });

    test('command_slug + pack_slug_prefix — match Python', () => {
        const gitCommit = path.join(synth, 'src', 'domains', 'git', 'commit', 'command.md');
        const metaCouncil = path.join(
            synth,
            'src',
            'domains',
            'meta',
            'council',
            'analysis',
            'command.md',
        );
        expect(A.pack_slug_prefix('git')).toEqual(pyDrive(synth, 'pack_slug_prefix', 'git'));
        expect(A.pack_slug_prefix('meta')).toEqual(pyDrive(synth, 'pack_slug_prefix', 'meta'));
        expect(A.command_slug(gitCommit)).toEqual(pyDrive(synth, 'command_slug', gitCommit));
        expect(A.command_slug(metaCouncil)).toEqual(pyDrive(synth, 'command_slug', metaCouncil));
        // expected concrete values
        expect(A.command_slug(gitCommit)).toBe('git-commit');
        expect(A.command_slug(metaCouncil)).toBe('council-analysis');
    });

    test('resolve_package_core_path — match Python (no I/O)', () => {
        for (const rel of ['', '.agent-src.uncondensed', '.agent-src.uncondensed/commands']) {
            expect(relPosix(synth, A.resolve_package_core_path(rel)), rel).toEqual(
                pyDrive(synth, 'resolve_package_core_path', rel),
            );
        }
    });
});
