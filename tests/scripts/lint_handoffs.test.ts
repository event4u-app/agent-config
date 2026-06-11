// Tests for src/scripts/lint_handoffs.ts (py2ts Phase 4 / Wave 4b).
//
// Ports tests/test_lint_handoffs.py 1:1 (the `lint(skills_dir)` fixtures:
// valid chains, cycle, dangling, tier-mismatch, cross-wing, non-senior skip,
// mode-6 worktree chain) and adds a golden-parity layer that runs python3 vs
// tsx on the REAL REPO, byte-identical stdout + stderr + exit (skipped
// without python3).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { lint, type Violation } from '../../src/scripts/lint_handoffs.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_handoffs.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_handoffs.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

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

    it('non-senior skills are ignored (forward-only floor)', () => {
        makeSkill(tmp, 'legacy', {
            tier: null,
            related_links: [['ghost', '../ghost/SKILL.md']],
        });
        expect(lint(skills)).toEqual([]);
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

const py3 = hasPython3();

describe.skipIf(!py3)('lint_handoffs — golden parity (python3 vs tsx)', () => {
    function runPy(args: readonly string[]) {
        return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function runTs(args: readonly string[]) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }

    it('matches the default (no-flag) run byte-for-byte', () => {
        const py = runPy([]);
        const ts = runTs([]);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('matches --quiet byte-for-byte (real CI invocation)', () => {
        const py = runPy(['--quiet']);
        const ts = runTs(['--quiet']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
