// DTCG 2025.10 conformance of `design-tokens generate`: a token file is read
// as written, or the run fails naming what it could not read. The failure this
// guards is silent data loss at exit 0 — a layerless file producing no
// variables, a `$root` key leaking into a custom-property name, an array value
// reaching string concatenation as `[object Object]`.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'skills', 'design-tokens', 'scripts', 'tokens.ts');
const FIXTURES = path.join(REPO_ROOT, 'tests', 'fixtures', 'dtcg-2025-10');
const TSX_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

interface Run {
    status: number | null;
    stdout: string;
    stderr: string;
}
function generate(fixture: string, format: 'css' | 'tailwind' = 'css'): Run {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, 'generate', '--config', path.join(FIXTURES, fixture), '--format', format], {
        encoding: 'utf8',
        cwd: REPO_ROOT,
    });
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** Every `--name: value;` declaration in a generated stylesheet. */
function declarations(css: string): Array<[string, string]> {
    return [...css.matchAll(/^\s*(--[^:]+):\s*(.*);$/gm)].map((m) => [m[1] as string, m[2] as string]);
}

describe('dtcg-2025-10 — layerless files', () => {
    it('a file with no primitive/semantic/component/dark layer is flattened like semantic', () => {
        const r = generate('layerless.json');
        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toContain('--color-brand: #0055FF;');
        expect(r.stdout).toContain('--color-accent: #0055FF;');
        expect(r.stdout).toContain('--space-md: 0.75rem;');
    });

    it('a layerless file feeds the tailwind colour map too', () => {
        const r = generate('layerless.json', 'tailwind');
        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toContain("'brand': 'var(--color-brand)'");
    });

    it('top-level groups beside the layers are named on stderr, the run still succeeds', () => {
        const r = generate('layers-beside-groups.json');
        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toContain('--primitive-color-a: #111111;');
        expect(r.stderr).toMatch(/not read.*\bbrand\b/);
    });

    it('a file with tokens that yields zero variables exits 1 with the reason', () => {
        const r = generate('layers-empty.json');
        expect(r.status).toBe(1);
        expect(r.stdout).toBe('');
        expect(r.stderr).toMatch(/1 token\(s\).*0 CSS variables/);
        expect(r.stderr).toMatch(/\bbrand\b/);
    });
});

describe('dtcg-2025-10 — unresolvable references', () => {
    it('an unresolvable reference names the token and the missing target, exit 1', () => {
        const r = generate('unresolvable.json');
        expect(r.status).toBe(1);
        expect(r.stdout).toBe('');
        expect(r.stderr).toMatch(/color\.primary/);
        expect(r.stderr).toMatch(/primitive\.color\.nope/);
    });
});

describe('dtcg-2025-10 — $root, $extends, $ref', () => {
    it('$root takes the group name; no $ in any custom-property name', () => {
        const r = generate('root.json');
        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toContain('--primitive-color-blue: #0000ff;');
        expect(r.stdout).toContain('--primitive-color-blue-light: #8888ff;');
        expect(r.stdout).not.toContain('$');
    });

    it('$extends on a group is a named error, never dropped', () => {
        const r = generate('extends.json');
        expect(r.status).toBe(1);
        expect(r.stderr).toMatch(/not supported: \$extends at primitive\.ext/);
    });

    it('a spec-form $ref without $value is a named error, never dropped', () => {
        const r = generate('ref.json');
        expect(r.status).toBe(1);
        expect(r.stderr).toMatch(/not supported: \$ref at primitive\.b/);
    });
});

describe('dtcg-2025-10 — array and composite values', () => {
    it('shadow: an object and an array each become one box-shadow value', () => {
        const r = generate('shadow.json');
        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).not.toContain('[object Object]');
        expect(r.stdout).toContain('--primitive-shadow-one: 0px 1px 2px 0px #000000;');
        expect(r.stdout).toContain('--primitive-shadow-stack: 0px 4px 8px -2px #00000080, inset 0px 0px 1px 0px #00000033;');
    });

    it('cubicBezier: an array becomes cubic-bezier(a, b, c, d)', () => {
        const r = generate('cubic-bezier.json');
        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toContain('--primitive-ease-standard: cubic-bezier(0.4, 0, 0.2, 1);');
    });

    it('fontFamily array: a comma list, names with spaces quoted, type inherited from the group', () => {
        const r = generate('font-family.json');
        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toContain('--primitive-font-body: "Helvetica Neue", Arial, sans-serif;');
    });

    it.each([
        ['composite-border.json', /primitive\.border\.thin.*border/],
        ['untyped-array.json', /primitive\.odd\.list.*array/],
    ])('array/composite %s is a named error, exit 1', (fixture, message) => {
        const r = generate(fixture);
        expect(r.status).toBe(1);
        expect(r.stdout).toBe('');
        expect(r.stderr).toMatch(message);
    });
});

describe('dtcg-2025-10 — fixture sweep (AC-1)', () => {
    const fixtures = fs.readdirSync(FIXTURES).filter((f) => f.endsWith('.json'));

    it.each(fixtures)('%s: never exit 0 with empty CSS; no {, }, $ or [object in a name or value', (fixture) => {
        const r = generate(fixture);
        if (r.status !== 0) {
            expect(r.status).toBe(1);
            expect(r.stderr).toMatch(/^Error: /m);
            return;
        }
        const decls = declarations(r.stdout);
        expect(decls.length).toBeGreaterThan(0);
        for (const [name, value] of decls) {
            expect(name).not.toMatch(/[{}$]|\[object/);
            expect(value).not.toMatch(/[{}$]|\[object/);
        }
    });
});
