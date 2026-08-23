import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
    derive,
    detectOutOfScope,
    discoverTurboGenerators,
    renderPlaybook,
    findRestatedSteps,
    isPointerLine,
    resolveInvoked,
    unwrapScript,
} from '../../src/scripts/derive_playbooks';

const FIXTURE = path.join('tests', 'fixtures', 'playbooks', 'mono-with-generator');

/** A throwaway repo root. Never writes into the tracked tree. */
const scratch = (files: Record<string, string>): string => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'derive-playbooks-'));
    for (const [rel, body] of Object.entries(files)) {
        const full = path.join(root, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, body, 'utf8');
    }
    return root;
};

describe('derive_playbooks', () => {
    describe('the 0.1 fixture — the step verify, asserted', () => {
        it('produces add-ui-component with grade configured and the generator id', () => {
            const comp = derive(FIXTURE).playbooks.find((p) => p.slug === 'add-ui-component');
            expect(comp, 'the fixture must yield a ui component playbook').toBeDefined();
            expect(comp?.grade).toBe('configured');
            expect(comp?.steps.map((s) => s.invokes)).toEqual(['turbo gen component']);
        });

        it('invokes the generator, not the wrapper script that points at it', () => {
            // The failure this guards: `new:component` is a thin wrapper. A playbook that
            // invoked the SCRIPT would stay green when the generator is renamed, which is
            // exactly the drift the Phase-3 staleness check exists to catch.
            const comp = derive(FIXTURE).playbooks.find((p) => p.slug === 'add-ui-component');
            expect(comp?.steps[0]?.invokes).not.toBe('new:component');
            expect(comp?.steps[0]?.source_of_truth).toContain('setGenerator');
        });

        it('scopes to the workspace that owns the procedure, not to the whole repo', () => {
            const comp = derive(FIXTURE).playbooks.find((p) => p.slug === 'add-ui-component');
            expect(comp?.scope).toBe(path.join('packages', 'ui'));
        });

        it('proposes nothing for build and test', () => {
            // A playbook per npm script would be a rename, not a procedure, and would grow
            // the estate for nothing.
            const slugs = derive(FIXTURE).playbooks.map((p) => p.slug);
            expect(slugs.some((s) => /build|test/.test(s))).toBe(false);
        });
    });

    describe('the Class-A refusal — it is exercised on real fixture data, not hypothetically', () => {
        it('downgrades to observed when the invoked generator is not in the tree', () => {
            // `new:package` wraps `turbo gen workspace`, and the fixture registers only
            // `component`. So the refusal arm fires on the SAME fixture as the pass arm —
            // no separate mock needed, and the two cannot drift apart.
            const wsp = derive(FIXTURE).playbooks.find((p) => p.slug === 'add-package');
            expect(wsp?.grade).toBe('observed');
            expect(wsp?.unresolved).toEqual(['turbo gen workspace']);
        });

        it('never writes a configured playbook whose step has no resolved source', () => {
            const root = scratch({
                'package.json': JSON.stringify({ scripts: { 'new:thing': 'turbo gen thing' } }),
            });
            const p = derive(root).playbooks[0];
            expect(p?.grade).toBe('observed');
            expect(p?.steps[0]?.source_of_truth).toBeNull();
            // And the rendered file SAYS so, rather than looking like a procedure.
            const md = renderPlaybook(p!);
            expect(md).toContain('grade: "observed"');
            expect(md).toContain('Why this is not `configured`');
        });

        it('a resolved turbo task and a resolved script both count as seen', () => {
            const root = scratch({
                'package.json': JSON.stringify({ scripts: { 'new:widget': 'node tools/widget.js' } }),
                'turbo.json': JSON.stringify({ tasks: { 'new:widget': {} } }),
            });
            expect(resolveInvoked(root, 'new:widget', new Map())).toBe('turbo.json#tasks');
            const only = scratch({ 'package.json': JSON.stringify({ scripts: { 'new:x': 'echo' } }) });
            expect(resolveInvoked(only, 'new:x', new Map())).toBe('package.json#scripts');
            expect(resolveInvoked(only, 'new:absent', new Map())).toBeNull();
        });
    });

    describe('generator discovery', () => {
        it('reads the registered NAME, not the filename', () => {
            // config.ts registers `component`; a filename-based reading would produce
            // `turbo gen config`, which no consumer can run.
            const found = discoverTurboGenerators(FIXTURE);
            expect([...found.keys()]).toContain('turbo gen component');
            expect([...found.keys()]).not.toContain('turbo gen config');
        });

        it('accepts both Plop spellings, because a real config may carry either', () => {
            const root = scratch({ 'turbo/generators/g.ts': "plop.addGenerator('thing', {})" });
            expect([...discoverTurboGenerators(root).keys()]).toEqual(['turbo gen thing']);
        });

        it('a generator directory counts as a generator', () => {
            const root = scratch({ 'turbo/generators/page/index.ts': 'export {}' });
            expect([...discoverTurboGenerators(root).keys()]).toEqual(['turbo gen page']);
        });
    });

    describe('out-of-scope kinds are reported, never silently skipped', () => {
        it('names nx and plop when the tree carries them', () => {
            const root = scratch({ 'nx.json': '{}', 'plopfile.js': 'module.exports = () => {}' });
            const seen = detectOutOfScope(root);
            expect(seen.join(' ')).toContain('nx');
            expect(seen.join(' ')).toContain('plop');
        });

        it('says nothing when the tree carries neither', () => {
            expect(detectOutOfScope(FIXTURE)).toEqual([]);
        });
    });

    describe('wrapper unwrapping', () => {
        it('unwraps a bare and a flagged generator call, and leaves unrelated bodies alone', () => {
            expect(unwrapScript('turbo gen component')).toBe('turbo gen component');
            expect(unwrapScript('turbo gen workspace --type package')).toBe('turbo gen workspace');
            expect(unwrapScript('vite build')).toBeNull();
            expect(unwrapScript('echo turbo gen component')).toBeNull();
        });
    });
});

describe('per-workspace AGENTS.md — restatement, not duplication (1.3)', () => {
    const WS_FILE = path.join(FIXTURE, 'packages', 'ui', 'AGENTS.md');

    it('flags a workspace file that restates a playbook step verbatim', () => {
        const playbooks = derive(FIXTURE).playbooks;
        const hits = findRestatedSteps(playbooks, WS_FILE, fs.readFileSync(WS_FILE, 'utf8'));
        expect(hits.length, 'the fixture restates one step and must be flagged').toBeGreaterThan(0);
        expect(hits[0]?.playbook).toBe('add-ui-component');
    });

    it('does NOT flag the pointer line in the same file', () => {
        // The near-miss, and the reason this detector is worth having: the same fixture
        // carries a LINK to the playbook. A detector that flagged it would forbid the exact
        // shape the contract asks for, and the workspace-file slot would be unusable.
        const playbooks = derive(FIXTURE).playbooks;
        const hits = findRestatedSteps(playbooks, WS_FILE, fs.readFileSync(WS_FILE, 'utf8'));
        // Exactly ONE restatement: the prose step under "## How to add a component".
        // The pointer at the bottom quotes the SAME step text in its link label, so without
        // the carve-out this count would be 2 — which is what makes this assertion sensitive
        // rather than decorative.
        expect(hits.length).toBe(1);
        expect(isPointerLine("- [Run the repository's own generator](../x/add-ui-component.md)")).toBe(true);
        expect(isPointerLine('Run the generator, then commit')).toBe(false);
    });

    it('a pointer-only file is clean', () => {
        const clean = [
            '# @org/ui',
            '',
            // Link label = the step text, so this line is only clean BECAUSE of the carve-out.
            "- [Run the repository's own generator — `turbo gen component`](../../agents/settings/contexts/add-ui-component.md)",
        ].join('\n');
        expect(findRestatedSteps(derive(FIXTURE).playbooks, 'x/AGENTS.md', clean)).toEqual([]);
    });

    it('a short invoked id is not matched at all — it would collide with ordinary prose', () => {
        // The guard this asserts, with the collision that makes it necessary: a repo whose
        // creation script is literally named `gen` yields the needle "gen", which appears in
        // "the generator writes the barrel export" and in "generated". Matching it would
        // report every such line, and a detector that fires on coincidence teaches its
        // readers to ignore it. Sensitivity check: removing the minChars guard makes this
        // fail, because the prose line below does contain "gen".
        const short = [{ slug: 'add-gen', steps: [{ title: 'Run it', invokes: 'gen', source_of_truth: 'package.json#scripts', verify: 'x' }] }];
        const prose = 'The generator writes the component, its test, and the barrel export.';
        expect(findRestatedSteps(short, 'x/AGENTS.md', prose)).toEqual([]);
        // And a long id in the same prose IS matched, so the guard is a length rule rather
        // than a blanket refusal.
        const long = [{ slug: 'add-x', steps: [{ title: 'Run it', invokes: 'turbo gen component', source_of_truth: 'x', verify: 'x' }] }];
        expect(findRestatedSteps(long, 'x/AGENTS.md', 'Run `turbo gen component` by hand.')).toHaveLength(1);
    });
});
