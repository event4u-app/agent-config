// Stack fixtures and command bindings — `road-to-stacks-beyond-php` 1.3 and 3.1.
//
// Two questions this file answers that `stack_runner.test.ts` does not. That
// file drives `resolve_toolchain` over temp dirs it builds itself, which proves
// the resolver's logic and proves nothing about the COMMANDS a repository of
// that shape would load. The roadmap's defect is on the command side: three
// engineering-base commands bound `pest-testing` in their frontmatter, so a
// Python or Go repository loaded PHP testing guidance before any resolver ran.
//
//  - 1.3 — a pyproject repository resolves pytest, and none of the three
//    binding sites names `pest-testing` unconditionally.
//  - 3.1 — one committed fixture per stack under `tests/fixtures/stack/`, with
//    the ecosystem, the bound test command and the pack asserted against the
//    live resolver rather than against prose.
//
// The fixtures are committed directories, not temp dirs, because the roadmap's
// deliverable is the fixture: a temp dir proves the same assertion and leaves
// nothing a later session can re-measure.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import { resolve_toolchain } from '../../../src/agent-src/templates/scripts/work_engine/stack/runner.js';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const FIXTURES = path.join(REPO_ROOT, 'tests/fixtures/stack');

/** The three engineering-base commands the roadmap names as binding sites. */
const BINDING_SITES = [
    'src/domains/engineering-base/tests/create/command.md',
    'src/domains/engineering-base/tests/execute/command.md',
    'src/domains/engineering-base/bug/fix/command.md',
];

/** The `skills:` list from a command's frontmatter, as written. */
function skillsBinding(rel: string): string[] {
    const text = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8');
    const m = /^skills:\s*\[(.*?)\]\s*$/m.exec(text);
    if (m === null) return [];
    return (m[1] as string)
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s !== '');
}

describe('pyproject never binds pest-testing', () => {
    it('resolves pytest, not a php runner', () => {
        const cfg = resolve_toolchain(path.join(FIXTURES, 'python'));
        expect(cfg.ecosystems).toEqual(['python']);
        expect(cfg.selected.map((r) => r.runner)).toEqual(['pytest']);
        expect(cfg.selected.map((r) => r.ecosystem)).not.toContain('php');
    });

    it.each(BINDING_SITES)('%s does not bind pest-testing', (rel) => {
        expect(skillsBinding(rel)).not.toContain('pest-testing');
    });

    it('no binding site carries a framework carve-out marker', () => {
        // `framework:` declares a command 100 % coupled to one stack
        // (command.schema.json). None of the three is: each one's body resolves
        // its runner at run time.
        for (const rel of BINDING_SITES) {
            const text = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8');
            expect(/^framework:\s*\S/m.test(text), rel).toBe(false);
        }
    });
});

describe('resolver fixture per stack', () => {
    // Measured on 2026-10-02 with the live resolver, not predicted. The
    // typescript row is the one worth reading twice: a TypeScript repository
    // resolves the ecosystem `js`, never `typescript` — the pack name and the
    // ecosystem label are different vocabularies, and a reader who assumes they
    // match writes a condition that never fires.
    const CASES = [
        { fixture: 'python', ecosystem: 'python', command: 'pytest', pack: 'python' },
        { fixture: 'typescript', ecosystem: 'js', command: 'npx vitest run', pack: 'typescript' },
        { fixture: 'go', ecosystem: 'go', command: 'go test ./...', pack: null },
        // The control. Step 3.2 asks that the Laravel answer be unchanged by
        // everything the other three rows added, so it is asserted here rather
        // than assumed — a fixture set with no control cannot show that.
        { fixture: 'laravel', ecosystem: 'php', command: 'vendor/bin/pest', pack: 'php' },
    ] as const;

    it.each(CASES)('$fixture resolves $ecosystem and $command', ({ fixture, ecosystem, command }) => {
        const cfg = resolve_toolchain(path.join(FIXTURES, fixture));
        expect(cfg.ecosystems).toEqual([ecosystem]);
        expect(cfg.selected).toHaveLength(1);
        expect(cfg.selected[0]?.ecosystem).toBe(ecosystem);
        expect(cfg.selected[0]?.command).toBe(command);
    });

    it.each(CASES)('$fixture maps to pack $pack', ({ pack }) => {
        if (pack === null) {
            // go has no pack. Step 2.3 creates it, and 2.3 is blocked on the
            // programme's b5 skill-growth question — so the absence is the
            // recorded state, asserted rather than left to a reader's memory.
            expect(fs.existsSync(path.join(REPO_ROOT, 'src/packs/go/pack.yaml'))).toBe(false);
            return;
        }
        expect(fs.existsSync(path.join(REPO_ROOT, `src/packs/${pack}/pack.yaml`))).toBe(true);
    });
});
