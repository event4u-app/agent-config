/**
 * The `check:` exits the two pilots name (road-to-steps-the-skill-cannot-skip
 * 4.1, D15). Each corroborates a step's output against the project tree rather
 * than only its shape, so every case below carries a shape-valid record that
 * the tree contradicts — that is the case a shape check would pass.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { PROCEDURE_CHECKS, registeredCheckIds } from '../../src/scripts/_lib/procedure_checks.js';

const dirs: string[] = [];
afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function project(files: Record<string, string>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'procedure-checks-'));
    dirs.push(root);
    for (const [rel, body] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), body);
    }
    return root;
}

function withAudit(audit: Record<string, unknown>, files: Record<string, string> = {}): string {
    return project({ ...files, '.work-state.json': JSON.stringify({ ui_audit: audit }) });
}

function run(id: string, projectRoot: string): { ok: boolean; reason?: string } {
    const check = PROCEDURE_CHECKS[id];
    expect(check, `${id} is not registered`).toBeDefined();
    return (check as NonNullable<typeof check>)({ projectRoot, skillDir: projectRoot });
}

const EMPTY_PATTERNS = { forms: [], tables: [], modals: [], empty_states: [], navigation: [], data_display: [] };
const BUTTON = 'src/components/Button.tsx';

describe('procedure check registry', () => {
    it('registers exactly the ids the pilot sidecars name', () => {
        expect([...registeredCheckIds()].sort()).toEqual([
            'analysis-overview-matches-manifests',
            'ui-audit-candidates-from-inventory',
            'ui-audit-complete',
            'ui-audit-components-in-tree',
            'ui-audit-greenfield-consistent',
            'ui-audit-patterns-in-tree',
            'ui-audit-taxonomy-root-in-tree',
        ]);
    });

    it('fails closed with no state file', () => {
        expect(run('ui-audit-components-in-tree', project({})).ok).toBe(false);
    });
});

describe('ui-audit-components-in-tree', () => {
    it('passes when every recorded component is a file in the tree', () => {
        const root = withAudit({ components: [{ path: BUTTON, name: 'Button', kind: 'component' }] }, { [BUTTON]: 'x' });
        expect(run('ui-audit-components-in-tree', root)).toEqual({ ok: true });
    });

    it('fails a shape-valid inventory naming a file the tree does not have', () => {
        const root = withAudit({ components: [{ path: BUTTON, name: 'Button', kind: 'component' }] });
        expect(run('ui-audit-components-in-tree', root).ok).toBe(false);
    });

    it('fails a path that escapes the project', () => {
        const root = withAudit({ components: [{ path: '../outside.tsx', name: 'x', kind: 'component' }] });
        expect(run('ui-audit-components-in-tree', root).ok).toBe(false);
    });
});

describe('ui-audit-taxonomy-root-in-tree', () => {
    it('passes `none` without a root', () => {
        expect(run('ui-audit-taxonomy-root-in-tree', withAudit({ component_taxonomy: 'none' })).ok).toBe(true);
    });

    it('fails a taxonomy whose root directory is absent', () => {
        const root = withAudit({ component_taxonomy: 'atoms/molecules', component_root: 'src/components' });
        expect(run('ui-audit-taxonomy-root-in-tree', root).ok).toBe(false);
    });

    it('passes a taxonomy whose root exists', () => {
        const root = withAudit({ component_taxonomy: 'atoms/molecules', component_root: 'src/components' }, { [BUTTON]: 'x' });
        expect(run('ui-audit-taxonomy-root-in-tree', root).ok).toBe(true);
    });
});

describe('ui-audit-patterns-in-tree', () => {
    it('fails when a pattern key is missing', () => {
        expect(run('ui-audit-patterns-in-tree', withAudit({ patterns: { forms: [] } })).ok).toBe(false);
    });

    it('fails a pattern entry the tree does not have', () => {
        const root = withAudit({ patterns: { ...EMPTY_PATTERNS, forms: ['src/components/Form.tsx'] } });
        expect(run('ui-audit-patterns-in-tree', root).ok).toBe(false);
    });

    it('passes all-empty patterns', () => {
        expect(run('ui-audit-patterns-in-tree', withAudit({ patterns: EMPTY_PATTERNS })).ok).toBe(true);
    });
});

describe('ui-audit-candidates-from-inventory', () => {
    const components = [{ path: BUTTON, name: 'Button', kind: 'component' }];

    it('passes a candidate drawn from the step 1 inventory', () => {
        const root = withAudit({ components, candidates: [{ path: BUTTON, name: 'Button', score: 0.5, reason: 'r' }] });
        expect(run('ui-audit-candidates-from-inventory', root).ok).toBe(true);
    });

    it('fails a candidate the inventory never listed', () => {
        const root = withAudit({ components, candidates: [{ path: 'src/Other.tsx', name: 'Other', score: 0.9, reason: 'r' }] });
        expect(run('ui-audit-candidates-from-inventory', root).ok).toBe(false);
    });

    it('fails a candidate under the 0.3 floor and more than five candidates', () => {
        const low = withAudit({ components, candidates: [{ path: BUTTON, name: 'Button', score: 0.1, reason: 'r' }] });
        expect(run('ui-audit-candidates-from-inventory', low).ok).toBe(false);
        const many = withAudit({
            components,
            candidates: Array.from({ length: 6 }, () => ({ path: BUTTON, name: 'Button', score: 0.5, reason: 'r' })),
        });
        expect(run('ui-audit-candidates-from-inventory', many).ok).toBe(false);
    });
});

describe('ui-audit-greenfield-consistent', () => {
    const bare = { components: [], design_system: 'custom-or-none', design_tokens: {} };

    it('fails greenfield=false on an empty surface', () => {
        expect(run('ui-audit-greenfield-consistent', withAudit({ ...bare, greenfield: false })).ok).toBe(false);
    });

    it('fails greenfield=true without a decision, passes with one', () => {
        expect(run('ui-audit-greenfield-consistent', withAudit({ ...bare, greenfield: true })).ok).toBe(false);
        const decided = withAudit({ ...bare, greenfield: true, greenfield_decision: 'bare' });
        expect(run('ui-audit-greenfield-consistent', decided).ok).toBe(true);
    });

    it('fails greenfield=true when the tree has components', () => {
        const root = withAudit({
            ...bare,
            components: [{ path: BUTTON, name: 'Button', kind: 'component' }],
            greenfield: true,
            greenfield_decision: 'bare',
        });
        expect(run('ui-audit-greenfield-consistent', root).ok).toBe(false);
    });
});

describe('ui-audit-complete', () => {
    const full = {
        components: [{ path: BUTTON, name: 'Button', kind: 'component' }],
        design_system: 'shadcn',
        design_tokens: {},
        shadcn_inventory: null,
        patterns: EMPTY_PATTERNS,
        candidates: [],
        greenfield: false,
        component_taxonomy: 'none',
        component_root: '',
    };

    it('passes a complete record the tree agrees with', () => {
        expect(run('ui-audit-complete', withAudit(full, { [BUTTON]: 'x' })).ok).toBe(true);
    });

    it('fails a missing key', () => {
        const { candidates: _drop, ...partial } = full;
        expect(run('ui-audit-complete', withAudit(partial, { [BUTTON]: 'x' })).ok).toBe(false);
    });

    it('fails a complete record whose inventory the tree contradicts', () => {
        expect(run('ui-audit-complete', withAudit(full)).ok).toBe(false);
    });
});

describe('analysis-overview-matches-manifests', () => {
    const OVERVIEW = 'agents/evidence/analysis/overview.md';

    it('fails without the overview', () => {
        expect(run('analysis-overview-matches-manifests', project({})).ok).toBe(false);
    });

    it('fails an overview naming no dependency the manifests declare', () => {
        const root = project({
            [OVERVIEW]: '# Overview\n\nA Django project.\n',
            'package.json': JSON.stringify({ dependencies: { react: '^18' }, devDependencies: { vitest: '^2' } }),
        });
        expect(run('analysis-overview-matches-manifests', root).ok).toBe(false);
    });

    it('passes an overview naming a declared dependency, composer or npm', () => {
        const npm = project({ [OVERVIEW]: '# Overview\n\nReact 18 SPA.\n', 'package.json': JSON.stringify({ dependencies: { react: '^18' } }) });
        expect(run('analysis-overview-matches-manifests', npm).ok).toBe(true);
        const composer = project({
            [OVERVIEW]: '# Overview\n\nLaravel 11 monolith.\n',
            'composer.json': JSON.stringify({ require: { php: '^8.3', 'laravel/framework': '^11' } }),
        });
        expect(run('analysis-overview-matches-manifests', composer).ok).toBe(true);
    });

    it('passes a non-empty overview where the tree has no manifest to check against', () => {
        expect(run('analysis-overview-matches-manifests', project({ [OVERVIEW]: '# Overview\n\nGo service.\n' })).ok).toBe(true);
    });

    it('a pass with no manifest to compare against is marked shape, not corroborated', () => {
        const r = PROCEDURE_CHECKS['analysis-overview-matches-manifests']!({
            projectRoot: project({ [OVERVIEW]: '# Overview\n\nGo service.\n' }),
            skillDir: '/nowhere',
        });
        expect(r).toEqual({ ok: true, basis: 'shape' });
    });

    it('a name fragment inside ordinary prose does not count as naming a dependency', () => {
        const root = project({
            [OVERVIEW]: '# Overview\n\nWe expressed interest in the reactive vitesse of things.\n',
            'package.json': JSON.stringify({ dependencies: { react: '^18', express: '^4' } }),
        });
        expect(run('analysis-overview-matches-manifests', root).ok).toBe(false);
    });

    it('naming one of several declared dependencies is not enough', () => {
        const root = project({
            [OVERVIEW]: '# Overview\n\nA React 18 SPA.\n',
            'package.json': JSON.stringify({ dependencies: { react: '^18', express: '^4', zod: '^3' } }),
        });
        expect(run('analysis-overview-matches-manifests', root).ok).toBe(false);
        const both = project({
            [OVERVIEW]: '# Overview\n\nA React 18 SPA on an Express API.\n',
            'package.json': JSON.stringify({ dependencies: { react: '^18', express: '^4', zod: '^3' } }),
        });
        expect(run('analysis-overview-matches-manifests', both).ok).toBe(true);
    });
});
