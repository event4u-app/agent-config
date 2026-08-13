// Tests for src/scripts/lint_skill_router_head.ts.
//
// The gate's value is entirely in its two directions: a NEW oversized monolith
// must fail, and an allowlisted or properly-routed one must not. Both are
// asserted here, plus the ratchet's own failure mode (a stale allowlist entry
// that silently re-permits a regression).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import {
    collectSkillHeads,
    countLines,
    evaluate,
    GRANDFATHERED,
    hasModeBodies,
    MAX_HEAD_LINES,
    type SkillHead,
} from '../../src/scripts/lint_skill_router_head.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_skill_router_head.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const tempDirs: string[] = [];

function makeSkills(spec: Record<string, { lines: number; bodyDir?: string }>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'router-head-'));
    tempDirs.push(root);
    for (const [name, { lines, bodyDir }] of Object.entries(spec)) {
        const dir = path.join(root, name);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'SKILL.md'), 'x\n'.repeat(lines), 'utf-8');
        if (bodyDir) {
            fs.mkdirSync(path.join(dir, bodyDir), { recursive: true });
            fs.writeFileSync(path.join(dir, bodyDir, 'mode-a.md'), '# mode a\n', 'utf-8');
        }
    }
    return root;
}

afterEach(() => {
    while (tempDirs.length > 0) {
        fs.rmSync(tempDirs.pop() as string, { recursive: true, force: true });
    }
});

const head = (name: string, lines: number, hasBodies = false): SkillHead => ({ name, lines, hasBodies });

describe('countLines — agrees with wc -l', () => {
    it.each([
        ['', 0],
        ['a\n', 1],
        ['a\nb\n', 2],
        ['a\nb', 2],
    ])('counts %j as %i', (text, expected) => {
        expect(countLines(text as string)).toBe(expected);
    });
});

describe('evaluate — the gate fires in both directions', () => {
    it('passes a skill under the cap', () => {
        expect(evaluate([head('small', 100)], []).findings).toEqual([]);
    });

    it('FAILS a new oversized monolith — the whole point of the gate', () => {
        const { findings } = evaluate([head('newbie', MAX_HEAD_LINES + 1)], []);
        expect(findings).toHaveLength(1);
        expect(findings[0]?.skill).toBe('newbie');
        expect(findings[0]?.message).toContain('router head');
    });

    it('passes an oversized skill that routes into a mode-body directory', () => {
        expect(evaluate([head('routed', 900, true)], []).findings).toEqual([]);
    });

    it('passes an oversized skill that is grandfathered', () => {
        expect(evaluate([head('legacy', 900)], ['legacy']).findings).toEqual([]);
    });

    it('treats exactly the cap as compliant, one over as a violation', () => {
        expect(evaluate([head('edge', MAX_HEAD_LINES)], []).findings).toEqual([]);
        expect(evaluate([head('edge', MAX_HEAD_LINES + 1)], []).findings).toHaveLength(1);
    });

    it('does not let a grandfathered name cover a DIFFERENT oversized skill', () => {
        const { findings } = evaluate([head('legacy', 900), head('newbie', 900)], ['legacy']);
        expect(findings.map((f) => f.skill)).toEqual(['newbie']);
    });
});

describe('evaluate — the ratchet reports its own drift', () => {
    it('flags an allowlist entry that no longer exceeds the cap', () => {
        const { staleAllowlist } = evaluate([head('shrunk', 100)], ['shrunk']);
        expect(staleAllowlist).toEqual(['shrunk']);
    });

    it('flags an allowlist entry for a skill that no longer exists', () => {
        expect(evaluate([], ['deleted']).staleAllowlist).toEqual(['deleted']);
    });

    it('reports no drift when the entry is still earning its place', () => {
        expect(evaluate([head('legacy', 900)], ['legacy']).staleAllowlist).toEqual([]);
    });
});

describe('filesystem collection', () => {
    it('reads heads and detects mode-body directories', () => {
        const root = makeSkills({
            plain: { lines: 10 },
            routed: { lines: 900, bodyDir: 'tasks' },
            reffed: { lines: 900, bodyDir: 'references' },
        });
        const heads = collectSkillHeads(root);
        expect(heads.map((h) => h.name)).toEqual(['plain', 'reffed', 'routed']);
        expect(heads.find((h) => h.name === 'routed')?.hasBodies).toBe(true);
        expect(heads.find((h) => h.name === 'reffed')?.hasBodies).toBe(true);
        expect(heads.find((h) => h.name === 'plain')?.hasBodies).toBe(false);
    });

    it('does not accept an unrelated subdirectory as a mode-body split', () => {
        const root = makeSkills({ evalsonly: { lines: 900, bodyDir: 'evals' } });
        expect(hasModeBodies(path.join(root, 'evalsonly'))).toBe(false);
    });

    it('returns nothing for a missing root rather than throwing', () => {
        expect(collectSkillHeads(path.join(os.tmpdir(), 'does-not-exist-router-head'))).toEqual([]);
    });
});

describe('the real allowlist is honest', () => {
    it('every grandfathered skill is actually over the cap today', () => {
        // Guards the seeding itself: an allowlist padded with compliant names
        // would silently pre-authorize four future regressions.
        const heads = collectSkillHeads(path.join(REPO_ROOT, 'src', 'skills'));
        const byName = new Map(heads.map((h) => [h.name, h]));
        for (const g of GRANDFATHERED) {
            expect(byName.get(g)?.lines ?? 0).toBeGreaterThan(MAX_HEAD_LINES);
        }
    });

    it('no skill outside the allowlist exceeds the cap unrouted', () => {
        const heads = collectSkillHeads(path.join(REPO_ROOT, 'src', 'skills'));
        expect(evaluate(heads).findings).toEqual([]);
    });
});

describe('CLI smoke', () => {
    const run = (args: string[] = []) =>
        spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf-8' });

    it('exits 0 on the real tree', () => {
        expect(run().status).toBe(0);
    });

    it('names the scanned count and the allowlist size on the green path', () => {
        const res = run();
        expect(res.stdout).toMatch(/skill head\(s\) scanned/);
        expect(res.stdout).toMatch(/shrink-only/);
    });

    it('exits 2 on an unrecognized argument', () => {
        expect(run(['--nope']).status).toBe(2);
    });
});
