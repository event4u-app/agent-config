// The committed skill-script bundles: that they exist, that they start, and
// that they still match the sources they were built from.
//
// Each of the six entry points under `src/skills/*/scripts/` ships a sibling
// `.mjs` so a consumer can start it with the one runtime the install already
// proves present. The build is `npm run build:skill-scripts`; this file reads
// that command out of `package.json` rather than restating it, so the test
// cannot drift from the build it is checking.
//
// Freshness is asserted WITHOUT rebuilding in place: every build here writes
// to a temporary directory, so a run of this suite can never be the thing that
// made the tree look fresh.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const REPO = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const ESBUILD = path.join(REPO, 'node_modules', '.bin', process.platform === 'win32' ? 'esbuild.cmd' : 'esbuild');

const tmpDirs: string[] = [];
function mkTmp(prefix: string): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmpDirs.push(d);
    return d;
}
afterAll(() => {
    for (const d of tmpDirs) {
        try {
            fs.rmSync(d, { recursive: true, force: true });
        } catch {
            /* best effort */
        }
    }
});

/** The `build:skill-scripts` argv, as `package.json` holds it. */
function buildArgv(): string[] {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf-8')) as {
        scripts: Record<string, string>;
    };
    const cmd = pkg.scripts['build:skill-scripts'];
    expect(cmd, 'package.json must define build:skill-scripts').toBeTruthy();
    const parts = (cmd as string).split(/\s+/);
    expect(parts[0]).toBe('esbuild');
    return parts.slice(1);
}

/** The entry points the build names, as `<skill>/<tool>` pairs. */
function entryPoints(): Array<{ skill: string; tool: string }> {
    return buildArgv()
        .filter((a) => a.startsWith('src/skills/'))
        .map((a) => {
            const m = /^src\/skills\/([^/]+)\/scripts\/([^/]+)\.ts$/.exec(a);
            expect(m, `unexpected entry-point shape: ${a}`).not.toBeNull();
            return { skill: (m as RegExpExecArray)[1] as string, tool: (m as RegExpExecArray)[2] as string };
        });
}

/**
 * Argument vectors that start each entry point without writing anything and
 * without reaching the network. Kept in step with the installed-projection
 * harness in `tests/install/skill_script_lines.test.ts`, which asks the same
 * question of the shipped copy.
 */
const START_VECTORS: Record<string, { argv: readonly string[]; exit: number }> = {
    ground: {
        argv: ['validate', '--manifest', 'src/skills/design-intelligence/data/manifest.json'],
        exit: 0,
    },
    tokens: {
        argv: ['generate', '--config', 'src/skills/design-tokens/templates/design-tokens-starter.json'],
        exit: 0,
    },
    check_package_surface: { argv: ['--self-test'], exit: 0 },
    shadcn_add: { argv: ['--list'], exit: 1 },
    story_contrast_floor: { argv: ['--self-test'], exit: 0 },
    tailwind_config_gen: { argv: ['--validate-only'], exit: 0 },
};

/** Run the build into `outdir`, leaving the committed bundles untouched. */
function buildInto(outdir: string, cwd: string): void {
    const argv = buildArgv().map((a) => (a.startsWith('--outdir=') ? `--outdir=${outdir}` : a));
    const r = spawnSync(ESBUILD, argv, { cwd, encoding: 'utf8' });
    expect(r.status, `esbuild failed:\n${r.stderr}`).toBe(0);
}

describe('skill-script bundles', () => {
    it('ships one beside every entry point the build names', () => {
        const missing = entryPoints()
            .map((e) => path.join('src', 'skills', e.skill, 'scripts', `${e.tool}.mjs`))
            .filter((rel) => !fs.existsSync(path.join(REPO, rel)));
        expect(missing, 'entry points with no committed bundle').toEqual([]);
        expect(entryPoints().length).toBe(6);
    });

    it('starts each one under plain node from a directory holding nothing', () => {
        const cwd = mkTmp('skill-bundle-start-');
        const outcomes: string[] = [];
        for (const e of entryPoints()) {
            const vector = START_VECTORS[e.tool];
            expect(vector, `no start vector for ${e.tool}`).toBeTruthy();
            const bundle = path.join(REPO, 'src', 'skills', e.skill, 'scripts', `${e.tool}.mjs`);
            const args = (vector as { argv: readonly string[] }).argv.map((a) =>
                a.startsWith('src/skills/') ? path.join(REPO, a) : a,
            );
            const r = spawnSync(process.execPath, [bundle, ...args], { cwd, encoding: 'utf8' });
            outcomes.push(`${e.tool}: ${r.status}`);
        }
        const expected = entryPoints().map((e) => `${e.tool}: ${(START_VECTORS[e.tool] as { exit: number }).exit}`);
        expect(outcomes).toEqual(expected);
        expect(fs.readdirSync(cwd), 'a bundle must not write beside its caller').toEqual([]);
    }, 120_000);

    it('reproduces every committed bundle byte-for-byte from its sources', () => {
        const out = mkTmp('skill-bundle-fresh-');
        buildInto(out, REPO);
        const drifted: string[] = [];
        for (const e of entryPoints()) {
            const rebuilt = fs.readFileSync(path.join(out, e.skill, 'scripts', `${e.tool}.mjs`));
            const committed = fs.readFileSync(path.join(REPO, 'src', 'skills', e.skill, 'scripts', `${e.tool}.mjs`));
            if (!rebuilt.equals(committed)) drifted.push(`${e.skill}/${e.tool}.mjs`);
        }
        expect(drifted, 'committed bundles that do not match their sources').toEqual([]);
    }, 120_000);

    it('stale-control: a source edit without a rebuild shows up as a diff', () => {
        // The build is reproduced from a mirror at the same relative paths, so
        // the bundler's own path comments come out identical and the only
        // difference a comparison can see is the one this test introduced.
        const mirror = mkTmp('skill-bundle-mirror-');
        for (const e of entryPoints()) {
            const dir = path.join('src', 'skills', e.skill, 'scripts');
            fs.cpSync(path.join(REPO, dir), path.join(mirror, dir), { recursive: true });
        }
        const skill = 'corpus-grounding';
        const rel = path.join('src', 'skills', skill, 'scripts');

        const before = mkTmp('skill-bundle-before-');
        buildInto(before, mirror);
        const unedited = fs.readFileSync(path.join(before, skill, 'scripts', 'ground.mjs'));
        const committed = fs.readFileSync(path.join(REPO, rel, 'ground.mjs'));
        expect(
            unedited.equals(committed),
            'the mirror must reproduce the committed bundle, or the negative below proves nothing',
        ).toBe(true);

        // The marker is asserted present in the BUNDLE first. The same words
        // also sit in a comment above the line that emits them, and a comment
        // the bundler strips is an edit no comparison could ever see — which
        // is how a negative control quietly stops controlling anything.
        const marker = '--filter expects COLUMN=VALUE';
        expect(committed.toString('utf-8'), 'the edited string must reach the bundle').toContain(marker);

        const source = path.join(mirror, rel, 'ground.ts');
        const original = fs.readFileSync(source, 'utf-8');
        const edited = original.split(marker).join('--filter wants COLUMN=VALUE');
        expect(edited, 'the string this test edits must still exist in the source').not.toBe(original);
        fs.writeFileSync(source, edited);

        const after = mkTmp('skill-bundle-after-');
        buildInto(after, mirror);
        const rebuilt = fs.readFileSync(path.join(after, skill, 'scripts', 'ground.mjs'));
        expect(rebuilt.equals(committed), 'an edited source must not rebuild to the committed bundle').toBe(false);
    }, 120_000);
});
