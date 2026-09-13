/**
 * Tests for `check_generator_sync` — the pre-push gate that refuses when a
 * tracked generated artefact is stale against a source this branch touched.
 *
 * Two populations, and they are tested differently on purpose.
 *
 * The BEHAVIOUR of the gate (diff-scoping, fail-closed, the poison
 * cancellation) is driven through `run()` over a fixture registry in a
 * throwaway git repo: small, fast, and each case isolates one property.
 *
 * The REGISTRY ITSELF is checked against this repository, because its two
 * entries encode real facts — the census generator's path, the bundle's module
 * comment format — and a rename on either side would degrade the gate to a
 * permanent pass with nothing to say so. A gate wired to a moved path is the
 * failure class this tree keeps re-recording.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
    bundledInstallSources,
    changedPaths,
    matchedSources,
    REGISTRY,
    run,
    main,
    type SourceMatcher,
    type Triple,
} from '../../src/scripts/check_generator_sync.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const made: string[] = [];
afterEach(() => {
    for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

function gitRepo(): { dir: string; base: string } {
    const dir = mkdtempSync(join(realpathSync(tmpdir()), 'gensync-test-'));
    made.push(dir);
    const g = (args: string[]): string =>
        execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
    g(['init', '-q']);
    g(['config', 'user.email', 'g@example.com']);
    g(['config', 'user.name', 'g']);
    g(['commit', '-qm', 'base', '--allow-empty']);
    return { dir, base: g(['rev-parse', 'HEAD']).trim() };
}

function fixtureTriple(over: Partial<Triple> = {}): Triple {
    return {
        id: 'fixture',
        output: 'out.txt',
        remedy: 'fixture-regen',
        why: 'out.txt is in.txt uppercased',
        sourcesOf: () => ({ ok: true, sources: [{ kind: 'file', value: 'src/in.txt' }] }),
        regenerate: (root) => ({
            text: readFileSync(join(root, 'src', 'in.txt'), 'utf8').toUpperCase(),
            ok: true,
        }),
        ...over,
    };
}

function seed(dir: string, inText: string, outText: string): void {
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'src', 'in.txt'), inText);
    writeFileSync(join(dir, 'out.txt'), outText);
}

/** Collects the gate's output so a test can assert on what a human is told. */
function capture(): { sink: (s: string) => void; text: () => string } {
    const parts: string[] = [];
    return { sink: (s) => void parts.push(s), text: () => parts.join('') };
}

describe('staleness detection', () => {
    it('reds when a source changed and the output was not regenerated', () => {
        const { dir, base } = gitRepo();
        seed(dir, 'hello\n', 'STALE\n');
        const out = capture();
        const code = run({
            repoRoot: dir,
            baseRef: base,
            registry: [fixtureTriple()],
            write: out.sink,
        });
        expect(code).toBe(1);
        expect(out.text()).toContain('is STALE');
    });

    it('greens when the source changed AND the output was correctly regenerated', () => {
        // The false-positive case. A gate with only rejecting fixtures has
        // unknown behaviour here, and this is the behaviour people actually
        // depend on — every correct push takes this path.
        const { dir, base } = gitRepo();
        seed(dir, 'hello\n', 'HELLO\n');
        const code = run({
            repoRoot: dir,
            baseRef: base,
            quiet: true,
            registry: [fixtureTriple()],
            write: () => {},
        });
        expect(code).toBe(0);
    });

    it('prints the exact regeneration command on a red', () => {
        // The correction path for a generated file is otherwise strictly worse
        // than editing it by hand, which is how generated files get hand-edited.
        const { dir, base } = gitRepo();
        seed(dir, 'hello\n', 'STALE\n');
        const out = capture();
        run({
            repoRoot: dir,
            baseRef: base,
            registry: [fixtureTriple({ remedy: 'npm run regen-the-thing' })],
            write: out.sink,
        });
        expect(out.text()).toContain('REGENERATE:  npm run regen-the-thing');
    });
});

describe('diff scoping', () => {
    it('does not check a triple whose source this branch did not touch', () => {
        const { dir } = gitRepo();
        seed(dir, 'hello\n', 'STALE\n');
        const g = (args: string[]): string =>
            execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
        g(['add', '-A']);
        g(['commit', '-qm', 'seed']);
        const base = g(['rev-parse', 'HEAD']).trim();
        writeFileSync(join(dir, 'unrelated.txt'), 'x\n');

        const code = run({
            repoRoot: dir,
            baseRef: base,
            quiet: true,
            registry: [fixtureTriple()],
            write: () => {},
        });
        // `out.txt` is stale on disk and stays unreported: a gate that re-ran
        // every generator on every push would be skipped, which is worse.
        expect(code).toBe(0);
    });

    it('sees an uncommitted working-tree edit', () => {
        // The window this gate exists for is before the commit, so a staged or
        // unstaged edit has to count as changed.
        const { dir } = gitRepo();
        seed(dir, 'hello\n', 'HELLO\n');
        const g = (args: string[]): string =>
            execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
        g(['add', '-A']);
        g(['commit', '-qm', 'seed']);
        const base = g(['rev-parse', 'HEAD']).trim();
        writeFileSync(join(dir, 'src', 'in.txt'), 'changed\n');

        expect(changedPaths(dir, base)).toContain('src/in.txt');
        const code = run({
            repoRoot: dir,
            baseRef: base,
            quiet: true,
            registry: [fixtureTriple()],
            write: () => {},
        });
        expect(code).toBe(1);
    });

    it('matches prefix sources and exact-file sources differently', () => {
        const sources: SourceMatcher[] = [
            { kind: 'prefix', value: 'docs/decisions/' },
            { kind: 'file', value: 'src/one.ts' },
        ];
        expect(matchedSources(['docs/decisions/ADR-1.md'], sources)).toEqual([
            'docs/decisions/ADR-1.md',
        ]);
        expect(matchedSources(['src/one.ts'], sources)).toEqual(['src/one.ts']);
        expect(matchedSources(['src/one.ts.bak', 'docs/other/x.md'], sources)).toEqual([]);
    });
});

describe('fails closed — every unreadable input is a refusal, never a pass', () => {
    it('refuses when the source set cannot be derived', () => {
        // The one shape that could make this gate pass without measuring: an
        // empty source set silently puts the triple out of scope.
        const { dir, base } = gitRepo();
        seed(dir, 'hello\n', 'HELLO\n');
        const out = capture();
        const code = run({
            repoRoot: dir,
            baseRef: base,
            registry: [fixtureTriple({ sourcesOf: () => ({ ok: false, reason: 'no bundle' }) })],
            write: out.sink,
        });
        expect(code).toBe(1);
        expect(out.text()).toContain('UNMEASURABLE');
    });

    it('refuses when the generator fails', () => {
        const { dir, base } = gitRepo();
        seed(dir, 'hello\n', 'HELLO\n');
        const code = run({
            repoRoot: dir,
            baseRef: base,
            registry: [fixtureTriple({ regenerate: () => ({ ok: false, reason: 'boom' }) })],
            write: () => {},
        });
        expect(code).toBe(1);
    });

    it('refuses when the committed output cannot be read', () => {
        const { dir, base } = gitRepo();
        seed(dir, 'hello\n', 'HELLO\n');
        rmSync(join(dir, 'out.txt'));
        const code = run({
            repoRoot: dir,
            baseRef: base,
            registry: [fixtureTriple()],
            write: () => {},
        });
        expect(code).toBe(1);
    });

    it('refuses when no base ref resolves', () => {
        const { dir } = gitRepo();
        seed(dir, 'hello\n', 'HELLO\n');
        const code = run({
            repoRoot: dir,
            baseRef: null,
            registry: [fixtureTriple()],
            write: () => {},
        });
        expect(code).toBe(1);
    });
});

describe('poisoned-regeneration handling', () => {
    const normalise = (text: string): { text: string; environmentArtefacts: number } => ({
        text: text.replace(/(?:\.\.\/)+node_modules\//g, 'node_modules/'),
        environmentArtefacts: (text.match(/(?:\.\.\/)+node_modules\//g) ?? []).length,
    });

    it('cancels a `../`-ascent the build environment injected rather than reporting stale', () => {
        const { dir, base } = gitRepo();
        seed(dir, 'x\n', 'node_modules/yaml/x.js\n');
        const code = run({
            repoRoot: dir,
            baseRef: base,
            quiet: true,
            registry: [
                fixtureTriple({
                    regenerate: () => ({ ok: true, text: '../../../node_modules/yaml/x.js\n' }),
                    normalise,
                }),
            ],
            write: () => {},
        });
        expect(code).toBe(0);
    });

    it('still reds on a REAL staleness carried alongside the ascent', () => {
        // The cancellation must absorb the environment artefact and nothing
        // else. Without this case the normalisation could widen into a blanket
        // excuse and every install-bundle staleness would read green.
        const { dir, base } = gitRepo();
        seed(dir, 'x\n', 'node_modules/yaml/x.js\nOLD\n');
        const code = run({
            repoRoot: dir,
            baseRef: base,
            quiet: true,
            registry: [
                fixtureTriple({
                    regenerate: () => ({ ok: true, text: '../../../node_modules/yaml/x.js\nNEW\n' }),
                    normalise,
                }),
            ],
            write: () => {},
        });
        expect(code).toBe(1);
    });

    it('swaps in the safe remedy when the environment poisons the build', () => {
        // Telling someone to run the plain build command from a worktree would
        // have them commit 189 `../../../node_modules/` lines — a real near-miss
        // on 2026-09-12, caught only by reading the diff. The advice has to
        // change with the environment or the gate causes the defect it detects.
        const { dir, base } = gitRepo();
        seed(dir, 'x\n', 'node_modules/yaml/x.js\nOLD\n');
        const out = capture();
        run({
            repoRoot: dir,
            baseRef: base,
            registry: [
                fixtureTriple({
                    poisonedRemedy: 'build from the MAIN CHECKOUT',
                    regenerate: () => ({ ok: true, text: '../../../node_modules/yaml/x.js\nNEW\n' }),
                    normalise,
                }),
            ],
            write: out.sink,
        });
        expect(out.text()).toContain('build from the MAIN CHECKOUT');
        expect(out.text()).not.toContain('REGENERATE:  fixture-regen');
        // And it reports how many it cancelled, so the reader can tell a
        // measurement from a reassurance.
        expect(out.text()).toContain('injected 1 `../.../node_modules/` path(s)');
    });

    it('the shipped install triple carries a worktree-safe remedy', () => {
        const bundle = REGISTRY.find((t) => t.id === 'install-bundle');
        expect(bundle).toBeDefined();
        expect((bundle as Triple).poisonedRemedy).toContain('MAIN CHECKOUT');
        expect((bundle as Triple).remedy).toBe('npm run build:install-bundle');
    });

    it('leaves an ascent in the COMMITTED artefact visible as a difference', () => {
        // Only the side this gate BUILDS is normalised. A poisoned bundle that
        // actually reached the tree is a finding here as well as for
        // check_bundle_path_leakage, which owns that invariant.
        const { dir, base } = gitRepo();
        seed(dir, 'x\n', '../../../node_modules/yaml/x.js\n');
        const code = run({
            repoRoot: dir,
            baseRef: base,
            quiet: true,
            registry: [
                fixtureTriple({
                    regenerate: () => ({ ok: true, text: 'node_modules/yaml/x.js\n' }),
                    normalise,
                }),
            ],
            write: () => {},
        });
        expect(code).toBe(1);
    });
});

describe('argv', () => {
    it('refuses an unknown flag rather than ignoring it', () => {
        // A gate in a required job that silently accepts a mistyped flag hands
        // back a green nobody earned.
        expect(main(['--quite'])).toBe(2);
    });

    it('refuses --base with no ref', () => {
        expect(main(['--base'])).toBe(2);
        expect(main(['--base', '--quiet'])).toBe(2);
    });

    it('prints usage for --help', () => {
        expect(main(['--help'])).toBe(0);
    });
});

describe('the shipped registry still describes this repository', () => {
    it('names two triples with distinct ids', () => {
        expect(REGISTRY.length).toBeGreaterThanOrEqual(2);
        expect(new Set(REGISTRY.map((t) => t.id)).size).toBe(REGISTRY.length);
    });

    it.each(REGISTRY.map((t) => [t.id, t] as const))(
        '%s — its committed output exists and its source set resolves',
        (_id, triple) => {
            // A triple pointing at a moved path degrades this gate to a
            // permanent pass. Nothing else would say so.
            expect(() => readFileSync(join(REPO_ROOT, triple.output), 'utf8')).not.toThrow();
            const s = triple.sourcesOf(REPO_ROOT);
            expect(s.ok, s.ok ? '' : s.reason).toBe(true);
            if (s.ok) expect(s.sources.length).toBeGreaterThan(0);
        },
    );

    it('derives the install bundle source set from the bundle, including the settings schema', () => {
        // Incident 3: a description string in this module left the bundle stale
        // and took four CI jobs red. If it ever leaves the derived set, the gate
        // stops covering the incident it was built for.
        const mods = bundledInstallSources(
            readFileSync(join(REPO_ROOT, 'dist', 'install', 'install.mjs'), 'utf8'),
        );
        expect(mods).toContain('src/scripts/install.ts');
        expect(mods).toContain('src/server/schemas/settings.ts');
        expect(mods.length).toBeGreaterThan(20);
        expect(mods.every((m) => m.startsWith('src/'))).toBe(true);
    });

    it('reads no module comment out of a bundle that carries none', () => {
        // The empty derivation is what the install triple treats as
        // unmeasurable, so it has to be reachable rather than theoretical.
        expect(bundledInstallSources('const x = 1;\n// not a module comment\n')).toEqual([]);
    });

    it('watches the ADR directories the census actually reads', () => {
        const census = REGISTRY.find((t) => t.id === 'adr-evidence-census');
        expect(census).toBeDefined();
        const s = (census as Triple).sourcesOf(REPO_ROOT);
        expect(s.ok).toBe(true);
        if (s.ok) {
            expect(s.sources.map((x) => x.value)).toContain('docs/decisions/');
        }
    });
});
