// Tests for src/scripts/lint_skill_top_position.ts.
//
// The gate's value is in three properties, and each is asserted in BOTH
// directions because a positioning check that only ever passes is the
// gate-that-scans-nothing shape this repository has already been bitten by:
//
//   1. It finds an obligation heading in every shape `preservation-guard`
//      protects, and does NOT find one inside a fenced example — the rule's own
//      prose quotes those headings, so a matcher that ignored fences would
//      report the document DESCRIBING the rule rather than one carrying it.
//   2. A skill with no obligation block is SKIPPED, never failed. Turning a
//      positioning check into an "every skill needs an Iron Law" mandate is a
//      scope expansion nobody asked for.
//   3. The exit code stays 0 on findings. Warn level is the Phase 3 contract,
//      and a gate that silently became blocking would red the build on prose.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import {
    collectPositions,
    countLines,
    evaluate,
    firstObligationLine,
    percentile,
    type SkillPosition,
    TOP_WINDOW_LINES,
} from '../../src/scripts/lint_skill_top_position.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_skill_top_position.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const tempDirs: string[] = [];

function makeSkills(spec: Record<string, string>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'top-position-'));
    tempDirs.push(root);
    for (const [name, body] of Object.entries(spec)) {
        const dir = path.join(root, name);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'SKILL.md'), body, 'utf-8');
    }
    return root;
}

afterEach(() => {
    while (tempDirs.length > 0) {
        fs.rmSync(tempDirs.pop() as string, { recursive: true, force: true });
    }
});

const pos = (name: string, lines: number, firstObligationLine: number | null): SkillPosition => ({
    name,
    lines,
    firstObligationLine,
});

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

describe('firstObligationLine — every shape preservation-guard protects', () => {
    it.each([
        ['## Iron Law', 1],
        ['## Iron Laws', 1],
        ['## The Iron Law', 1],
        ['### Iron Law 1', 1],
        ['# Iron Law', 1],
        ['###### Iron Law 2', 1],
        ['## iron law', 1], // heading matching is case-insensitive
    ])('matches %j at line %i', (heading, expected) => {
        expect(firstObligationLine(`${heading as string}\n\nbody\n`)).toBe(expected);
    });

    it('returns the FIRST heading when several exist', () => {
        expect(firstObligationLine('# Title\n\n## Iron Law 1\n\nx\n\n## Iron Law 2\n')).toBe(3);
    });

    it('returns null when no obligation heading exists', () => {
        expect(firstObligationLine('# Title\n\n## When to use\n\nbody\n')).toBeNull();
    });

    it('does NOT match a bare mention in prose', () => {
        expect(firstObligationLine('# Title\n\nThe Iron Law of this skill is simple.\n')).toBeNull();
    });

    it('does NOT match a heading inside a backtick fence — the rule-describing-a-rule case', () => {
        expect(firstObligationLine('# Title\n\n```md\n## Iron Law\n```\n')).toBeNull();
    });

    it('does NOT match a heading inside a tilde fence', () => {
        expect(firstObligationLine('# Title\n\n~~~md\n## Iron Law\n~~~\n')).toBeNull();
    });

    it('resumes matching AFTER a fence closes', () => {
        expect(firstObligationLine('```md\n## Iron Law\n```\n\n## Iron Law\n')).toBe(5);
    });

    it('does not let a tilde marker close a backtick fence', () => {
        // A `~~~` line inside a ``` fence is fence CONTENT, so the heading that
        // follows is still fenced. Getting this wrong would make the matcher
        // report examples in any document that shows both fence styles.
        expect(firstObligationLine('```\n~~~\n## Iron Law\n```\n')).toBeNull();
    });
});

describe('evaluate — the gate fires in both directions', () => {
    it('passes a skill whose obligation block is inside the window', () => {
        expect(evaluate([pos('early', 300, 10)]).findings).toEqual([]);
    });

    it('FLAGS a skill whose obligation block is below the window', () => {
        const { findings } = evaluate([pos('late', 300, TOP_WINDOW_LINES + 1)]);
        expect(findings).toHaveLength(1);
        expect(findings[0]?.skill).toBe('late');
        expect(findings[0]?.message).toContain('the first thing lost');
    });

    it('treats exactly the window as compliant, one past it as a finding', () => {
        expect(evaluate([pos('edge', 300, TOP_WINDOW_LINES)]).findings).toEqual([]);
        expect(evaluate([pos('edge', 300, TOP_WINDOW_LINES + 1)]).findings).toHaveLength(1);
    });

    it('SKIPS a skill with no obligation block rather than failing it', () => {
        const { findings, withBlock, withoutBlock } = evaluate([pos('plain', 500, null)]);
        expect(findings).toEqual([]);
        expect(withBlock).toBe(0);
        expect(withoutBlock).toBe(1);
    });

    it('counts the two populations separately', () => {
        const { withBlock, withoutBlock } = evaluate([
            pos('a', 100, 5),
            pos('b', 100, null),
            pos('c', 100, 500),
        ]);
        expect(withBlock).toBe(2);
        expect(withoutBlock).toBe(1);
    });

    it('honours an explicit window override', () => {
        expect(evaluate([pos('x', 300, 20)], 10).findings).toHaveLength(1);
        expect(evaluate([pos('x', 300, 20)], 30).findings).toEqual([]);
    });
});

describe('percentile', () => {
    it('returns null on an empty set rather than 0 — a missing value is not a low one', () => {
        expect(percentile([], 50)).toBeNull();
    });

    it.each([
        [50, 3],
        [90, 5],
        [100, 5],
    ])('p%i of [1..5] is %i', (p, expected) => {
        expect(percentile([1, 2, 3, 4, 5], p as number)).toBe(expected);
    });
});

describe('collectPositions', () => {
    it('reads every SKILL.md and locates its obligation block', () => {
        const root = makeSkills({
            beta: '# B\n\n## Iron Law\n',
            alpha: '# A\n\n## When to use\n',
        });
        const got = collectPositions(root);
        expect(got.map((p) => p.name)).toEqual(['alpha', 'beta']); // sorted
        expect(got[0]?.firstObligationLine).toBeNull();
        expect(got[1]?.firstObligationLine).toBe(3);
    });

    it('returns an empty list for a missing root instead of throwing', () => {
        expect(collectPositions(path.join(os.tmpdir(), 'does-not-exist-top-position'))).toEqual([]);
    });
});

describe('CLI — warn level means exit 0 even with findings', () => {
    it('exits 0 against the real corpus and prints the proxy-window caveat', () => {
        const r = spawnSync(TSX_BIN, [TS_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf-8' });
        expect(r.status).toBe(0);
        const out = `${r.stdout}${r.stderr}`;
        // The caveat is load-bearing, not decoration: the number is a repo-side
        // proxy and the gate must never print it as a verified host cap.
        expect(out).toContain('UNVERIFIED');
        expect(out).toContain('proxy');
    });

    it('exits 2 on an unrecognized argument', () => {
        const r = spawnSync(TSX_BIN, [TS_SCRIPT, '--nope'], { cwd: REPO_ROOT, encoding: 'utf-8' });
        expect(r.status).toBe(2);
    });

    it('exits 0 on --help', () => {
        const r = spawnSync(TSX_BIN, [TS_SCRIPT, '--help'], { cwd: REPO_ROOT, encoding: 'utf-8' });
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('usage:');
    });

    it('reports host_cap_verified: false in json — the honesty flag is machine-readable', () => {
        const r = spawnSync(TSX_BIN, [TS_SCRIPT, '--format', 'json'], {
            cwd: REPO_ROOT,
            encoding: 'utf-8',
        });
        expect(r.status).toBe(0);
        const jsonStart = r.stdout.indexOf('{');
        const parsed = JSON.parse(r.stdout.slice(jsonStart)) as Record<string, unknown>;
        expect(parsed['host_cap_verified']).toBe(false);
        expect(parsed['window_proxy_lines']).toBe(TOP_WINDOW_LINES);
        expect(typeof parsed['scanned']).toBe('number');
    });

    it('rejects an unknown --format value', () => {
        const r = spawnSync(TSX_BIN, [TS_SCRIPT, '--format', 'yaml'], {
            cwd: REPO_ROOT,
            encoding: 'utf-8',
        });
        expect(r.status).toBe(2);
    });
});
