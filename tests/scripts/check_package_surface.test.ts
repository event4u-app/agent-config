import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
    checkPackage,
    checkRegistry,
    classify,
    exportTargets,
} from '../../src/skills/js-library-packaging/scripts/check_package_surface';

const FIXTURE = path.join('tests', 'fixtures', 'library', 'ui-lib-vite');
const SOURCE = path.join(FIXTURE, 'source-consumed');
const BUILT = path.join(FIXTURE, 'built-surface');

const codes = (root: string): string[] => checkPackage(root).findings.map((f) => f.code);

/** Copy a fixture root and mutate its manifest — never touches the tracked tree. */
const mutated = (root: string, edit: (m: Record<string, unknown>) => void): string => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-surface-'));
    fs.cpSync(root, dir, { recursive: true });
    const p = path.join(dir, 'package.json');
    const m = JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, unknown>;
    edit(m);
    fs.writeFileSync(p, JSON.stringify(m, null, 2), 'utf8');
    return dir;
};

describe('check_package_surface', () => {
    describe('the step verify — clean fixture, then react moved to dependencies', () => {
        it('reports zero errors for both fixture roots', () => {
            for (const root of [SOURCE, BUILT]) {
                const errs = checkPackage(root).findings.filter((f) => f.severity === 'error');
                expect(errs, `${root} must be clean`).toEqual([]);
            }
        });

        it('reports exactly one error when react moves to dependencies', () => {
            const dir = mutated(SOURCE, (m) => {
                m['dependencies'] = { react: '^18.0.0' };
                delete (m['peerDependencies'] as Record<string, unknown>)['react'];
            });
            const errs = checkPackage(dir).findings.filter((f) => f.severity === 'error');
            expect(errs).toHaveLength(1);
            expect(errs[0]?.code).toBe('peer-as-dependency');
            // The message names the runtime symptom, because "invalid hook call" is what the
            // developer actually sees and it names neither package.
            expect(errs[0]?.message).toContain('invalid hook call');
        });
    });

    describe('classification is read from declared targets, never from the directory name', () => {
        it('classifies the two fixture roots from their exports', () => {
            expect(checkPackage(SOURCE).classification).toBe('source-consumed');
            expect(checkPackage(BUILT).classification).toBe('built-surface');
        });

        it('a directory named ui-lib-vite proves nothing about the classification', () => {
            // The council's point, asserted: both roots sit under `ui-lib-vite`, and they
            // classify differently. A name-based reading would have to call them the same.
            expect(checkPackage(SOURCE).classification).not.toBe(checkPackage(BUILT).classification);
        });

        it('a MIXED declaration is undeclared rather than a guess', () => {
            expect(classify(['./src/index.ts', './dist/index.js'])).toBe('undeclared');
        });

        it('collects targets at every nesting depth', () => {
            expect(exportTargets({ '.': { types: './a.d.ts', import: './b.js' }, './sub': './c.js' })).toEqual(
                expect.arrayContaining(['./a.d.ts', './b.js', './c.js']),
            );
        });
    });

    describe('the four declared checks', () => {
        it('(b) warns on legacy entries with no exports map', () => {
            const dir = mutated(SOURCE, (m) => {
                delete m['exports'];
                m['main'] = './src/index.ts';
            });
            expect(codes(dir)).toContain('no-exports-map');
        });

        it('(c) warns when types is not the first condition', () => {
            // Order is load-bearing: a resolver matching `import` first never sees a later
            // `types`, and the package silently ships untyped.
            const dir = mutated(SOURCE, (m) => {
                m['exports'] = { '.': { import: './src/index.ts', types: './src/index.ts' } };
            });
            expect(codes(dir)).toContain('types-not-first');
        });

        it('(c) does NOT warn when types is first', () => {
            expect(codes(SOURCE)).not.toContain('types-not-first');
        });

        it('(d) warns on a workspace: range in a publishable package', () => {
            const dir = mutated(BUILT, (m) => {
                m['dependencies'] = { '@org/tokens': 'workspace:*' };
                delete m['publishConfig'];
            });
            expect(codes(dir)).toContain('workspace-range-publishable');
        });

        it('(d) stays quiet when the package is private', () => {
            const dir = mutated(SOURCE, (m) => {
                m['dependencies'] = { '@org/tokens': 'workspace:*' };
            });
            expect(codes(dir)).not.toContain('workspace-range-publishable');
        });

        // road-to-internal-estate-fit 4.1: `catalog:` is the same unpublishable
        // protocol as `workspace:`. It had been passing as an ordinary registry
        // range, so the finding did not fire where it should.
        it('(d) warns on a catalog: range in a publishable package', () => {
            const dir = mutated(BUILT, (m) => {
                m['dependencies'] = { react: 'catalog:' };
                delete m['publishConfig'];
            });
            expect(codes(dir)).toContain('workspace-range-publishable');
        });

        it('(d) warns on a NAMED catalog range too', () => {
            const dir = mutated(BUILT, (m) => {
                m['dependencies'] = { react: 'catalog:react18' };
                delete m['publishConfig'];
            });
            expect(codes(dir)).toContain('workspace-range-publishable');
        });

        it('(d) stays quiet on an ordinary registry range', () => {
            const dir = mutated(BUILT, (m) => {
                m['dependencies'] = { react: '^18.2.0' };
                delete m['publishConfig'];
            });
            expect(codes(dir)).not.toContain('workspace-range-publishable');
        });

        it('(d) stays quiet on a catalog: range when the package is private', () => {
            const dir = mutated(SOURCE, (m) => {
                m['dependencies'] = { react: 'catalog:' };
            });
            expect(codes(dir)).not.toContain('workspace-range-publishable');
        });

        it('errors when a declared export target is not in the tree', () => {
            // The drift the whole surface rests on: a manifest that promises a file the
            // package does not ship.
            const dir = mutated(BUILT, (m) => {
                m['exports'] = { '.': { types: './dist/absent.d.ts', import: './dist/absent.js' } };
            });
            const errs = checkPackage(dir).findings.filter((f) => f.code === 'export-target-missing');
            expect(errs).toHaveLength(2);
        });
    });

    describe('what it refuses to do', () => {
        it('reports a missing manifest instead of throwing', () => {
            const r = checkPackage(path.join(os.tmpdir(), 'definitely-not-a-package-root-xyz'));
            expect(r.findings.map((f) => f.code)).toEqual(['no-manifest']);
        });

        it('never compiles: a syntactically broken component is not a packaging finding', () => {
            // The scope boundary. A checker that parsed source would report compile errors as
            // packaging errors, and the two have different fixes.
            const dir = mutated(SOURCE, () => undefined);
            fs.writeFileSync(path.join(dir, 'src', 'Button', 'Button.tsx'), 'this is not typescript {{{', 'utf8');
            expect(checkPackage(dir).findings).toEqual([]);
        });
    });
});

describe('checkRegistry — the library as a source others install from (3.2)', () => {
    const REGISTRY = path.join(FIXTURE, 'registry.json');

    const tmpRegistry = (doc: unknown): string => {
        const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'registry-')), 'registry.json');
        fs.writeFileSync(f, JSON.stringify(doc, null, 2), 'utf8');
        return f;
    };

    it('the fixture registry has exactly one item and passes', () => {
        const doc = JSON.parse(fs.readFileSync(REGISTRY, 'utf8')) as { items: unknown[] };
        expect(doc.items).toHaveLength(1);
        expect(checkRegistry(REGISTRY)).toEqual([]);
    });

    it('errors when a registry item lists react in dependencies', () => {
        // The same two-copies-of-React failure as peer-as-dependency, one layer up: the
        // consuming app already has React and the item installs a second.
        const f = tmpRegistry({ items: [{ name: 'button', type: 'registry:ui', dependencies: ['react'] }] });
        const codes = checkRegistry(f).map((x) => x.code);
        expect(codes).toEqual(['registry-item-bundles-peer']);
    });

    it('strips a version range before matching the dependency name', () => {
        const f = tmpRegistry({ items: [{ name: 'b', type: 'registry:ui', dependencies: ['react@^19.0.0'] }] });
        expect(checkRegistry(f).map((x) => x.code)).toEqual(['registry-item-bundles-peer']);
    });

    it('errors on each deprecated v4 item type', () => {
        for (const type of ['registry:build', 'registry:mcp']) {
            const f = tmpRegistry({ items: [{ name: 'x', type, dependencies: [] }] });
            const found = checkRegistry(f);
            expect(found.map((x) => x.code), type).toEqual(['registry-item-deprecated-type']);
            expect(found[0]?.message).toContain('registry:base');
        }
    });

    it('accepts the replacement types', () => {
        for (const type of ['registry:base', 'registry:font', 'registry:ui']) {
            const f = tmpRegistry({ items: [{ name: 'x', type, dependencies: [] }] });
            expect(checkRegistry(f), type).toEqual([]);
        }
    });

    it('reads a single registry-item shape as well as an index', () => {
        // Both are legal on disk; a reader handling only the index form would silently pass
        // every single-item file.
        const f = tmpRegistry({ name: 'lone', type: 'registry:mcp', dependencies: ['react-dom'] });
        expect(checkRegistry(f).map((x) => x.code).sort()).toEqual([
            'registry-item-bundles-peer',
            'registry-item-deprecated-type',
        ]);
    });

    it('routes a registry path through the registry checker, not the package checker', () => {
        // Otherwise the caller has to know which of two checkers to reach for.
        expect(checkRegistry(REGISTRY)).toEqual([]);
        expect(checkPackage(path.dirname(REGISTRY)).findings.map((f) => f.code)).toContain('no-manifest');
    });

    it('reports an unreadable registry instead of throwing', () => {
        expect(checkRegistry(path.join(os.tmpdir(), 'absent-registry.json')).map((x) => x.code)).toEqual(['no-registry']);
    });
});
