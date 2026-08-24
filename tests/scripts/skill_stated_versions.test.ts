import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * AC-8 of `road-to-component-library-lifecycle`: every version a touched skill
 * states equals a major in a COMMITTED scaffold fixture.
 *
 * The defect this witnesses is not "the number is old". It is that the number
 * had no source at all — `react-shadcn-ui` said `shadcn@2.1` / Tailwind `3.x`
 * because someone read it somewhere, and nothing in the tree could contradict
 * it. So the assertion is deliberately a JOIN between two files rather than a
 * pin to a literal: bumping the fixture without bumping the skill fails, and
 * bumping the skill without re-running the scaffold fails too.
 */

const SHADCN_FIXTURE = path.join('tests', 'fixtures', 'stack', 'shadcn-current');
const SB_FIXTURE = path.join('tests', 'fixtures', 'stack', 'storybook-current');

type Manifest = {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
};

const manifest = (dir: string): Manifest =>
    JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) as Manifest;

/** The major of a semver range as the scaffold wrote it — `^4.19.0` -> `4`, `^4` -> `4`. */
const major = (range: string): string => {
    const m = /(\d+)/.exec(range);
    if (!m) throw new Error(`no major in range ${range}`);
    return m[1];
};

const dep = (m: Manifest, name: string): string => {
    const v = m.dependencies?.[name] ?? m.devDependencies?.[name];
    if (!v) throw new Error(`${name} absent from the fixture manifest`);
    return v;
};

const read = (p: string): string => fs.readFileSync(p, 'utf8');

/** The `## Compatibility` section only — a version elsewhere in the body is prose. */
const section = (body: string, heading: string): string => {
    const lines = body.split('\n');
    const start = lines.findIndex((l) => l.trim() === heading);
    expect(start, `${heading} must exist`).toBeGreaterThan(-1);
    const rest = lines.slice(start + 1);
    const end = rest.findIndex((l) => /^## /.test(l));
    return (end === -1 ? rest : rest.slice(0, end)).join('\n');
};

describe('skills state only versions a committed scaffold produced', () => {
    it('both scaffold fixtures exist and carry a manifest (step 5.1 verify)', () => {
        for (const dir of [SHADCN_FIXTURE, SB_FIXTURE]) {
            expect(fs.existsSync(path.join(dir, 'package.json')), `${dir}/package.json`).toBe(true);
            expect(fs.existsSync(path.join(dir, 'README.md')), `${dir}/README.md`).toBe(true);
        }
    });

    it('react-shadcn-ui § Compatibility quotes the shadcn-current majors', () => {
        const m = manifest(SHADCN_FIXTURE);
        const compat = section(read('src/skills/react-shadcn-ui/SKILL.md'), '## Compatibility');

        for (const [pkg, label] of [
            ['shadcn', 'shadcn CLI'],
            ['tailwindcss', 'Tailwind'],
            ['react', 'React'],
            ['@base-ui/react', 'Base UI'],
        ] as const) {
            const want = major(dep(m, pkg));
            expect(
                compat,
                `${label} major ${want} (from ${SHADCN_FIXTURE}) must appear in § Compatibility`,
            ).toMatch(new RegExp(`\`?[^\\d]${want}[.\`@ x]`));
        }
    });

    it('the superseded 2.1 / 3.x pins are gone from § Compatibility', () => {
        const compat = section(read('src/skills/react-shadcn-ui/SKILL.md'), '## Compatibility');
        expect(compat).not.toMatch(/shadcn@2/);
        expect(compat).not.toMatch(/Tailwind CSS `3/);
    });

    it('the fixture is named as the source of those majors, not a bare number', () => {
        const compat = section(read('src/skills/react-shadcn-ui/SKILL.md'), '## Compatibility');
        expect(compat).toContain('tests/fixtures/stack/shadcn-current/package.json');
    });

    it('storybook-workshop names its major and cites the fixture', () => {
        const body = read('src/skills/storybook-workshop/SKILL.md');
        const m = manifest(SB_FIXTURE);
        expect(body).toContain('tests/fixtures/stack/storybook-current');
        expect(body).toContain(`storybook@^${dep(m, 'storybook').replace(/^\^/, '')}`);
        // The scaffold-default addons are the evidence AC-4 and AC-5 rest on.
        expect(body).toContain('@storybook/addon-a11y');
    });

    it('storybook-current pins the Storybook major and the default addon set', () => {
        const m = manifest(SB_FIXTURE);
        expect(major(dep(m, 'storybook'))).toBe('10');
        // AC-4 and AC-5 both rest on these two being scaffold defaults, not extras.
        expect(m.devDependencies).toHaveProperty('@storybook/addon-a11y');
        expect(m.devDependencies).toHaveProperty('@storybook/addon-mcp');
    });
});

describe('the v3/v4 branch is keyed on the css axis in both skills', () => {
    const detector = read('src/agent-src/templates/scripts/work_engine/stack/detect.ts');

    it('the axis values the skills branch on are the ones the detector emits', () => {
        for (const value of ['tailwind-v3', 'tailwind-v4']) {
            expect(detector, `detect.ts must emit ${value}`).toContain(`'${value}'`);
        }
    });

    it('react-shadcn-ui and existing-ui-audit both name both axis values', () => {
        for (const p of [
            'src/skills/react-shadcn-ui/SKILL.md',
            'src/skills/existing-ui-audit/SKILL.md',
        ]) {
            const body = read(p);
            for (const value of ['tailwind-v3', 'tailwind-v4']) {
                expect(body, `${p} must branch on ${value}`).toContain(value);
            }
            expect(body, `${p} must name the axis it keys on`).toMatch(/axes\.css|`css` axis/);
        }
    });

    it('the shadcn-current fixture resolves to the v4 branch by its own files', () => {
        const m = manifest(SHADCN_FIXTURE);
        // The detector's v4 marker, asserted against the real scaffold.
        expect(dep(m, '@tailwindcss/vite')).toBeTruthy();
        const components = JSON.parse(
            fs.readFileSync(path.join(SHADCN_FIXTURE, 'components.json'), 'utf8'),
        ) as { tailwind?: { config?: string } };
        // v4 is CSS-first: the scaffold leaves `config` empty rather than absent.
        expect(components.tailwind?.config).toBe('');
        expect(fs.existsSync(path.join(SHADCN_FIXTURE, 'tailwind.config.ts'))).toBe(false);
    });
});
