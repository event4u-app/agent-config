// Tests for src/scripts/lint_handoffs.ts (py2ts Phase 4 / Wave 4b).
//
// Ports tests/test_lint_handoffs.py 1:1 (the `lint(skills_dir)` fixtures:
// valid chains, cycle, dangling, tier-mismatch, cross-wing, non-senior skip,
// mode-6 worktree chain), plus the contract-agreement check below.
//
// This header previously also announced "a golden-parity layer that runs
// python3 vs tsx on the REAL REPO, byte-identical stdout + stderr + exit".
// No such layer is in this file and the Python source has been retired. The
// claim is not unique to this file: measured 2026-10-14, 203 of the 225 test
// files whose header announces a parity layer never name python3 in their
// body (the author's own count; no artifact records the method). Only the
// headers of files this branch edited are corrected; the rest is recorded in
// road-to-sentences-the-tree-can-back as a population to sweep.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { lint, main, type Violation } from '../../src/scripts/lint_handoffs.js';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(_HERE, '..', '..');



type LinkPair = [string, string];

function makeSkill(
    root: string,
    slug: string,
    opts: {
        tier: string | null;
        related_links?: LinkPair[] | null;
        composition_links?: LinkPair[] | null;
    },
): string {
    const skillsDir = path.join(root, '.agent-src.uncondensed', 'skills', slug);
    fs.mkdirSync(skillsDir, { recursive: true });
    const lines: string[] = [
        '---',
        `name: ${slug}`,
        `description: "${slug} senior skill for handoff testing."`,
        'source: project',
    ];
    if (opts.tier) {
        lines.push(`tier: ${opts.tier}`);
    }
    lines.push('---', '', `# ${slug}`, '', '## Procedure', '', '1. step', '');
    const related = opts.related_links;
    const composition = opts.composition_links;
    if (related !== undefined || composition !== undefined) {
        lines.push('## Related Skills', '', '**WHEN to use this**');
        if (composition && composition.length > 0) {
            for (const [label, target] of composition) {
                lines.push(`- delegates to [\`${label}\`](${target})`);
            }
        } else {
            lines.push('- always');
        }
        lines.push('', '**WHEN NOT to use this**');
        for (const [label, target] of related ?? []) {
            lines.push(`- prefer [\`${label}\`](${target})`);
        }
        lines.push('');
    }
    const p = path.join(skillsDir, 'SKILL.md');
    fs.writeFileSync(p, lines.join('\n') + '\n', 'utf-8');
    return p;
}

function codes(violations: readonly Violation[]): string[] {
    return violations.map((v) => v.code);
}

describe('lint_handoffs — ported pytest suite', () => {
    let tmp: string;
    let skills: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-'));
        skills = path.join(tmp, '.agent-src.uncondensed', 'skills');
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('valid W3 launch chain — no violations', () => {
        makeSkill(tmp, 'positioning', { tier: 'senior', related_links: [] });
        makeSkill(tmp, 'messaging-architecture', {
            tier: 'senior',
            related_links: [['positioning', '../positioning/SKILL.md']],
        });
        makeSkill(tmp, 'gtm-launch', {
            tier: 'senior',
            related_links: [['messaging-architecture', '../messaging-architecture/SKILL.md']],
        });
        expect(lint(skills)).toEqual([]);
    });

    it('valid W4 forecasting chain — no violations', () => {
        makeSkill(tmp, 'forecasting', { tier: 'senior', related_links: [] });
        makeSkill(tmp, 'forecast-accuracy', {
            tier: 'senior',
            related_links: [['forecasting', '../forecasting/SKILL.md']],
        });
        expect(lint(skills)).toEqual([]);
    });

    it('cycle detected (mutual WHEN-to-use links)', () => {
        makeSkill(tmp, 'alpha', {
            tier: 'senior',
            composition_links: [['beta', '../beta/SKILL.md']],
        });
        makeSkill(tmp, 'beta', {
            tier: 'senior',
            composition_links: [['alpha', '../alpha/SKILL.md']],
        });
        expect(codes(lint(skills))).toContain('handoff_cycle');
    });

    it('WHEN-NOT mutual pointers are not cycles', () => {
        makeSkill(tmp, 'alpha', {
            tier: 'senior',
            related_links: [['beta', '../beta/SKILL.md']],
        });
        makeSkill(tmp, 'beta', {
            tier: 'senior',
            related_links: [['alpha', '../alpha/SKILL.md']],
        });
        const violations = lint(skills);
        expect(codes(violations)).not.toContain('handoff_cycle');
        expect(violations).toEqual([]);
    });

    it('dangling reference', () => {
        makeSkill(tmp, 'alpha', {
            tier: 'senior',
            related_links: [['ghost', '../ghost/SKILL.md']],
        });
        expect(lint(skills).some((v) => v.code === 'handoff_dangling')).toBe(true);
    });

    it('tier mismatch — senior may not link to a non-senior peer', () => {
        makeSkill(tmp, 'alpha', {
            tier: 'senior',
            related_links: [['legacy', '../legacy/SKILL.md']],
        });
        makeSkill(tmp, 'legacy', { tier: null, related_links: [] });
        expect(lint(skills).some((v) => v.code === 'handoff_tier_mismatch')).toBe(true);
    });

    it('valid cross-wing chain — no violations', () => {
        makeSkill(tmp, 'build-buy-partner', { tier: 'senior', related_links: [] });
        makeSkill(tmp, 'org-design', {
            tier: 'senior',
            related_links: [['build-buy-partner', '../build-buy-partner/SKILL.md']],
        });
        makeSkill(tmp, 'forecasting', { tier: 'senior', related_links: [] });
        makeSkill(tmp, 'forecast-accuracy', {
            tier: 'senior',
            related_links: [['forecasting', '../forecasting/SKILL.md']],
        });
        expect(lint(skills)).toEqual([]);
    });

    // Superseded by the Phase-1 widening of road-to-skill-link-integrity: the
    // TIER and CYCLE checks stay senior-only (they judge composition edges,
    // which only exist inside a declared handoff block), but a DEAD link is
    // wrong wherever it sits. The nine files carrying the repo's real dead
    // links declared neither `tier:` nor `## Related Skills`, which is exactly
    // why the gate that owns `handoff_dangling` had never seen them.
    it('a non-senior skill still gets its dangling link reported', () => {
        makeSkill(tmp, 'legacy', {
            tier: null,
            related_links: [['ghost', '../ghost/SKILL.md']],
        });
        const v = lint(skills);
        expect(v).toHaveLength(1);
        expect(v[0]?.code).toBe('handoff_dangling');
        expect(v[0]?.message).toContain('../ghost/SKILL.md');
    });

    it('a non-senior skill gets NO tier-mismatch finding (scope stays narrow)', () => {
        makeSkill(tmp, 'plain', { tier: null, related_links: [] });
        makeSkill(tmp, 'legacy', {
            tier: null,
            related_links: [['plain', '../plain/SKILL.md']],
        });
        expect(lint(skills)).toEqual([]);
    });

    // The exact shape of the repo's own defect: no `tier:`, no
    // `## Related Skills` heading at all, one prose body link to a slug that
    // does not exist. Before the widening this produced zero findings.
    it('a body link outside any Related Skills block is reported exactly once', () => {
        const dir = path.join(skills, 'prose-only');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, 'SKILL.md'),
            [
                '---',
                'name: prose-only',
                'description: "prose-only skill with no tier and no Related Skills block."',
                '---',
                '',
                '# prose-only',
                '',
                '## Procedure',
                '',
                '1. Verify completeness — see [`ghost`](../ghost/SKILL.md).',
                '',
            ].join('\n'),
            'utf-8',
        );
        const v = lint(skills);
        expect(v).toHaveLength(1);
        expect(v[0]?.code).toBe('handoff_dangling');
        expect(v[0]?.line).toBe(10);
    });

    it('an empty skills root raises DeadScopeError through main()', () => {
        const empty = path.join(tmp, 'empty-root');
        fs.mkdirSync(empty, { recursive: true });
        const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
        const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        try {
            expect(main([empty])).toBe(2);
            expect(err.mock.calls.map((c) => String(c[0])).join('')).toContain('lint_handoffs');
        } finally {
            err.mockRestore();
            out.mockRestore();
        }
    });

    it('mode-6 worktree cross-wing chain lints clean', () => {
        makeSkill(tmp, 'build-buy-partner', { tier: 'senior', related_links: [] });
        makeSkill(tmp, 'org-design', {
            tier: 'senior',
            related_links: [['build-buy-partner', '../build-buy-partner/SKILL.md']],
        });
        expect(lint(skills)).toEqual([]);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------


describe('lint_handoffs — CI-identical invocation', () => {
    it('treats --quiet as a flag, not as the skills root', () => {
        // Regression: Taskfile injects --quiet (QUIET_FLAG), and this gate read
        // args[0] as a positional path. The CI invocation therefore resolved
        // "--quiet" as its skills root, scanned 0 files and exited 2 — red under
        // `task lint-handoffs`, green when probed bare. A gate that dies on the
        // exact argv CI runs is the inverse of the dead-scope defect: loud, but
        // only where nobody was looking.
        const out: string[] = [];
        const spy = vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
            out.push(String(s));
            return true;
        });
        let code: number;
        try {
            code = main(['--quiet']);
        } finally {
            spy.mockRestore();
        }
        expect(code).toBe(0);
        const m = /^scanned: (\d+)$/m.exec(out.join(''));
        expect(m).not.toBeNull();
        expect(Number(m![1])).toBeGreaterThan(250);
    });
});

describe('handoff-missing-input-agrees', () => {
    // The contract's rule tables are where a skill author looks up a failure
    // code. A code listed there that no emitter produces is worse than no
    // code: it reads as a guard. `handoff_missing_input` sat in the optional
    // table as "Warning today" and was never emitted by anything.
    const CONTRACT = path.join(REPO, 'docs', 'contracts', 'cross-wing-handoff.md');

    /** Codes the linter can actually put on a violation. */
    function emittedCodes(): Set<string> {
        const src = fs.readFileSync(path.join(REPO, 'src', 'scripts', 'lint_handoffs.ts'), 'utf-8');
        const out = new Set<string>();
        for (const m of src.matchAll(/code:\s*'([a-z_]+)'/g)) out.add(m[1] as string);
        return out;
    }

    /** `handoff_*` codes the contract presents inside a markdown table row. */
    function contractCodes(): Set<string> {
        const text = fs.readFileSync(CONTRACT, 'utf-8');
        const out = new Set<string>();
        for (const line of text.split('\n')) {
            if (!line.trimStart().startsWith('|')) continue;
            for (const m of line.matchAll(/`(handoff_[a-z_]+)`/g)) out.add(m[1] as string);
        }
        return out;
    }

    it('every handoff code a table names has an emitter in lint_handoffs', () => {
        const emitted = emittedCodes();
        // Guard the guard: a regex that matched nothing would make this pass
        // against an empty set and prove nothing.
        expect(emitted.size).toBeGreaterThanOrEqual(3);
        const missing = [...contractCodes()].filter((c) => !emitted.has(c));
        expect(missing, `contract names ${missing.join(', ')} but nothing emits it`).toEqual([]);
    });

    it('handoff_missing_input is named nowhere as a code', () => {
        // The specific sentence this check was written for. It stays as a
        // named case so a re-add is a test failure, not a silent return.
        expect(contractCodes().has('handoff_missing_input')).toBe(false);
        expect(emittedCodes().has('handoff_missing_input')).toBe(false);
    });

    it('the three codes the linter does emit are all documented', () => {
        // The other direction: an emitter nobody documented is a failure a
        // skill author meets at CI with no page to look it up on.
        const documented = contractCodes();
        for (const code of emittedCodes()) {
            expect(documented.has(code), `lint_handoffs emits ${code}; no contract table names it`).toBe(true);
        }
    });
});
