import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    PREFIX_STABLE_SURFACES,
    RE_ARM_EVENTS,
    prefixStableRoots,
    surfaceFor,
} from '../../src/scripts/_lib/prefix_stable_surfaces.js';
import {
    classifyScript,
    evaluate,
    main,
    midSessionSlots,
    slotsByConcern,
    writeTargets,
} from '../../src/scripts/check_prefix_stable_mutation.js';

describe('prefix_stable_surfaces — the canonical list', () => {
    it('declares the three measured buckets and nothing invented', () => {
        expect(prefixStableRoots()).toEqual([
            'dist/agent-src/rules',
            'dist/agent-src/skills',
            'CLAUDE.md',
            'CLAUDE.local.md',
        ]);
    });

    it('matches at a path separator, never as a substring', () => {
        expect(surfaceFor('dist/agent-src/rules/commit-policy.md')?.id).toBe('project-scope-rules');
        // The adjacent-name trap: a sibling directory whose name merely starts
        // with a declared root is NOT inside it.
        expect(surfaceFor('dist/agent-src/rules-backup/x.md')).toBeNull();
        expect(surfaceFor('CLAUDE.md.bak')).toBeNull();
        expect(surfaceFor('agents/runtime/state/x.json')).toBeNull();
    });

    it('re-arm events are exactly the two prefix-rebuild boundaries', () => {
        expect([...RE_ARM_EVENTS].sort()).toEqual(['pre_compact', 'session_start']);
    });
});

describe('check_prefix_stable_mutation — slot classification', () => {
    it('collects every slot a concern is bound on across platforms', () => {
        const m = slotsByConcern({
            claude: { session_start: ['a'], post_tool_use: ['a', 'b'] },
            augment: { stop: ['b'] },
        });
        expect([...(m.get('a') ?? [])].sort()).toEqual(['post_tool_use', 'session_start']);
        expect([...(m.get('b') ?? [])].sort()).toEqual(['post_tool_use', 'stop']);
    });

    it('treats only non-re-arm slots as mid-session', () => {
        expect(midSessionSlots(['session_start', 'pre_compact'])).toEqual([]);
        expect(midSessionSlots(['session_start', 'stop', 'post_tool_use'])).toEqual([
            'post_tool_use',
            'stop',
        ]);
    });
});

describe('check_prefix_stable_mutation — source classification', () => {
    it('lifts the first argument of each write-shaped call', () => {
        const t = writeTargets(`fs.writeFileSync(path.join(a, 'b'), 'x');\nfs.readFileSync('y');`);
        expect(t).toHaveLength(1);
        expect(t[0]).toContain("path.join(a, 'b')");
    });

    it('flags a literal write into a declared surface', () => {
        const hits = classifyScript(`fs.writeFileSync('dist/agent-src/rules/x.md', 'hi');`);
        expect(hits).toHaveLength(1);
        expect(hits[0]?.kind).toBe('literal');
        expect(hits[0]?.surface).toBe('project-scope-rules');
    });

    it('joins path.join literal segments before resolving', () => {
        const hits = classifyScript(`fs.writeFileSync(path.join('dist', 'agent-src', 'skills', 'x'), 'hi');`);
        expect(hits).toHaveLength(1);
        expect(hits[0]?.surface).toBe('preloaded-skills-catalog');
    });

    it('does not flag a read of a declared surface', () => {
        expect(classifyScript(`fs.readFileSync('dist/agent-src/rules/x.md', 'utf-8');`)).toEqual([]);
    });

    it('does not flag a write outside every declared surface', () => {
        expect(classifyScript(`fs.writeFileSync('agents/runtime/state/x.json', '{}');`)).toEqual([]);
    });

    it('fails closed on a dynamic target when the file carries a surface literal', () => {
        const hits = classifyScript(`const root = 'dist/agent-src/rules';\nfs.writeFileSync(target, 'hi');`);
        expect(hits).toHaveLength(1);
        expect(hits[0]?.kind).toBe('undecidable');
    });

    it('does not claim a dynamic target when no surface literal is present', () => {
        // The narrowing that keeps the gate green-able: an unclassifiable write
        // in a file with nothing pointing at a declared surface is not reported.
        expect(classifyScript(`fs.writeFileSync(target, 'hi');`)).toEqual([]);
    });
});

describe('check_prefix_stable_mutation — end to end over a fixture root', () => {
    let dir: string;

    const plant = (reArm: string | null, body: string): void => {
        fs.mkdirSync(path.join(dir, 'src', 'scripts'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'src', 'scripts', 'fixture_hook.ts'), body);
        const arm = reArm === null ? '' : `\n    re_arm: ${reArm}`;
        fs.writeFileSync(
            path.join(dir, 'src', 'scripts', 'hook_manifest.yaml'),
            `schema_version: 1\nconcerns:\n  fixture:\n    script: src/scripts/fixture_hook.ts${arm}\n` +
                `platforms:\n  claude:\n    post_tool_use:\n      - fixture\n`,
        );
    };

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'psm-test-'));
    });
    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it("the roadmap's own verify: no re-arm fails, re_arm: pre_compact passes", () => {
        plant(null, `fs.writeFileSync('dist/agent-src/rules/x.md', 'hi');`);
        const bad = evaluate(dir);
        expect(bad.findings).toHaveLength(1);
        expect(bad.findings[0]?.slots).toEqual(['post_tool_use']);

        plant('pre_compact', `fs.writeFileSync('dist/agent-src/rules/x.md', 'hi');`);
        expect(evaluate(dir).findings).toEqual([]);
    });

    it('an undeclared re-arm value does not silence the gate', () => {
        // `lint_hook_manifest` rejects the typo; this asserts the gate does not
        // ALSO honour it, so the two checks cannot disagree about one manifest.
        plant('whenever', `fs.writeFileSync('dist/agent-src/rules/x.md', 'hi');`);
        expect(evaluate(dir).findings).toHaveLength(1);
    });

    it('exits 1 on a violation and 0 when clean', () => {
        plant(null, `fs.writeFileSync('dist/agent-src/rules/x.md', 'hi');`);
        expect(main(['--root', dir, '--quiet'])).toBe(1);
        plant('session_start', `fs.writeFileSync('dist/agent-src/rules/x.md', 'hi');`);
        expect(main(['--root', dir, '--quiet'])).toBe(0);
    });
});

describe('check_prefix_stable_mutation — the real corpus', () => {
    it('scans the live manifest and reports a non-trivial count', () => {
        const v = evaluate();
        // A gate that scans nothing exits green; assert the corpus is real.
        expect(v.scanned).toBeGreaterThan(20);
        expect(v.midSessionConcerns).toBeGreaterThan(20);
    });

    it('the payload budget and this gate read ONE list', async () => {
        const budget = await import('../../src/scripts/check_preamble_payload_budget.js');
        const buckets = budget.measureDeterministicPayload();
        // Every bucket the budget reports names a surface in the shared list.
        for (const b of buckets) {
            expect(PREFIX_STABLE_SURFACES.some((s) => s.bucket === b.name)).toBe(true);
        }
    });
});
