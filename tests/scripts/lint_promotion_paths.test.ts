// Paired fixtures for the promotion-path structural invariant —
// `road-to-harness-promotion-bridge`, discharge route 1.
//
// The gate's own `--self-test` covers detector discrimination on planted
// fixtures. This file covers what a self-test cannot: that the REAL tree passes
// with an asserted denominator, that a collapsed population fails instead of
// exiting green, that the allowlists are exactly what the header claims, and
// that the guarded capability is unobtainable while the blocker is open.
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { REPO_ROOT, TSX_BIN } from './_bench_ab.js';
import {
    GATE_SELF,
    GATE_TEST,
    MIN_CANDIDATE_MODULES,
    MIN_FILES,
    MIN_WRITE_SITES,
    R1_ALLOWLIST,
    R2_ALLOWLIST,
    R3_ALLOWLIST,
    callArguments,
    constBindings,
    evaluate,
    expandExpression,
    findApprovalSites,
    findPromotedWriteSites,
    findWriteSites,
    isCandidateDerived,
    substituteOutsideStrings,
    targetsCanonicalSource,
} from '../../src/scripts/lint_promotion_paths.js';
import {
    PromotionCapabilityUnobtainableError,
    acquirePromotionCapability,
    blockerSection,
    readMergeAuthorityStatus,
} from '../../src/scripts/_lib/promotion_capability.js';

const GATE_TS = join(REPO_ROOT, 'src', 'scripts', 'lint_promotion_paths.ts');

function run(args: readonly string[]): { status: number | null; stdout: string; stderr: string } {
    const r = spawnSync(TSX_BIN, [GATE_TS, ...args], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        timeout: 180_000,
        env: { ...process.env, GATE_SELF_TEST_CHILD: '0' },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

// --- § the real tree ---------------------------------------------------------

describe('the real repository passes, and the denominator is asserted', () => {
    it('exits 0 over a population that is demonstrably non-empty', () => {
        const v = evaluate(REPO_ROOT);
        expect(v.findings, JSON.stringify(v.findings, null, 2)).toEqual([]);
        // The exit code alone is worthless here — a gate that scanned nothing
        // also exits 0. These three are the anti-vacuity floors, asserted from
        // the outside so the gate cannot be the only witness to its own scope.
        expect(v.scanned).toBeGreaterThan(MIN_FILES);
        expect(v.candidateModules.length).toBeGreaterThan(MIN_CANDIDATE_MODULES);
        expect(v.writeSites).toBeGreaterThan(MIN_WRITE_SITES);
    });

    it('emits the machine-read `scanned:` line the coverage manifest parses', () => {
        const out = run([]);
        expect(out.status, out.stderr).toBe(0);
        expect(out.stdout).toMatch(/^scanned: \d+$/m);
    });

    it('--quiet changes the output, not the verdict', () => {
        const loud = run([]);
        const quiet = run(['--quiet']);
        expect(quiet.status).toBe(loud.status);
        expect(loud.stdout).toContain('no promotion path bypasses');
        expect(quiet.stdout).not.toContain('no promotion path bypasses');
        // The `scanned:` contract line survives --quiet: CI passes it, and a
        // count only visible without it is not a count.
        expect(quiet.stdout).toMatch(/^scanned: \d+$/m);
    });
});

// --- § a collapsed population is a failure, not a clean run ------------------

describe('anti-vacuity — the condition this gate discharges forbids a check over zero', () => {
    it('a tree below the file floor exits 2 rather than green', () => {
        const dir = mkdtempSync(join(tmpdir(), 'promo-empty-'));
        try {
            mkdirSync(join(dir, 'src'), { recursive: true });
            writeFileSync(join(dir, 'src', 'one.ts'), 'export const x = 1;\n');
            const r = spawnSync(TSX_BIN, [GATE_TS, '--root', dir, '--quiet'], {
                cwd: REPO_ROOT,
                encoding: 'utf8',
                timeout: 120_000,
            });
            expect(r.status).toBe(2);
            expect(r.stderr).toContain('scan scope is');
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('a dead scan root exits 2 rather than green', () => {
        const dir = mkdtempSync(join(tmpdir(), 'promo-dead-'));
        try {
            const r = spawnSync(TSX_BIN, [GATE_TS, '--root', dir, '--quiet'], {
                cwd: REPO_ROOT,
                encoding: 'utf8',
                timeout: 120_000,
            });
            expect(r.status).toBe(2);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

// --- § the allowlists are pinned --------------------------------------------

describe('the allowlists cannot grow silently', () => {
    it('R1 is exactly the definition site, the capability, this gate and this file', () => {
        expect([...R1_ALLOWLIST].sort()).toEqual([
            'src/scripts/_lib/candidate_record.ts',
            'src/scripts/_lib/promotion_capability.ts',
            GATE_SELF,
            GATE_TEST,
        ].sort());
    });

    it('R2 and R3 are narrower — only the capability, this gate and this file', () => {
        expect([...R2_ALLOWLIST].sort()).toEqual(['src/scripts/_lib/promotion_capability.ts', GATE_SELF, GATE_TEST].sort());
        expect([...R3_ALLOWLIST].sort()).toEqual(['src/scripts/_lib/promotion_capability.ts', GATE_SELF, GATE_TEST].sort());
    });
});

// --- § the detectors, in both polarities ------------------------------------

describe('R1 — approval synthesis', () => {
    it('fires on a construction and on a three-argument transition', () => {
        expect(findApprovalSites("assertTransition(s, 'promoted', { approver: 'ci', approvedAt: 'x' });").map((f) => f.what).sort())
            .toEqual(['approvedAt-construction', 'approver-construction', 'assertTransition-with-approval']);
        expect(findApprovalSites('const a: HumanApproval = load();').map((f) => f.what)).toEqual(['HumanApproval-reference']);
    });

    it('is silent on a type declaration and on the two-argument form', () => {
        expect(findApprovalSites('interface A { readonly approver: string; readonly approvedAt: string; }')).toEqual([]);
        expect(findApprovalSites("assertTransition(from, 'promoted');")).toEqual([]);
        // The declaration of the gate function itself carries two commas in its
        // parameter list and must not read as a three-argument CALL.
        expect(findApprovalSites('export function assertTransition(a: X, b: Y, c?: Z): void {}')).toEqual([]);
    });
});

describe('R2 — a record written straight into the promoted state', () => {
    it('fires on both spellings', () => {
        expect(findPromotedWriteSites("const r = { lifecycle: 'promoted' };").map((f) => f.what)).toEqual(['promoted-literal']);
        expect(findPromotedWriteSites('const r = { lifecycle: ACCEPTED_STATE };').map((f) => f.what)).toEqual(['accepted-state-write']);
    });

    it('is silent on the constant DECLARATION and on other lifecycles', () => {
        expect(findPromotedWriteSites("export const ACCEPTED_STATE: LifecycleState = 'promoted';")).toEqual([]);
        expect(findPromotedWriteSites("const r = { lifecycle: 'candidate' };")).toEqual([]);
    });
});

describe('R3 — candidate-derived writes into the canonical source tree', () => {
    const CAND = "import { parseCandidateRecord } from './_lib/candidate_record.js';\n";

    it('marks a module candidate-derived only when it imports candidate data', () => {
        expect(isCandidateDerived(CAND)).toBe(true);
        expect(isCandidateDerived("import { x } from './other.js';\n")).toBe(false);
    });

    it('fires on a repo-rooted src write and on a bare src-rooted literal', () => {
        expect(findWriteSites(`${CAND}fs.writeFileSync(path.join(REPO_ROOT, 'src', 'a.md'), b);`)[0]?.targetsSource).toBe(true);
        expect(findWriteSites(`${CAND}fs.writeFileSync('src/rules/a.md', b);`)[0]?.targetsSource).toBe(true);
    });

    it('reads the DESTINATION argument, which is the second one for a copy', () => {
        const sites = findWriteSites(`${CAND}fs.copyFileSync(path.join(root, 'src', 'a.ts'), tmp);`);
        expect(sites[0]?.targetsSource).toBe(false);
        const back = findWriteSites(`${CAND}fs.copyFileSync(tmp, 'src/a.ts');`);
        expect(back[0]?.targetsSource).toBe(true);
    });

    it("is silent on a CLONE's src/ — a candidate's own sandbox, gated elsewhere", () => {
        // `tests/scripts/bench_ab_candidate.test.ts` sabotages exactly this path
        // to prove `bench_ab_integrity` fires on it. Double-gating it here would
        // red that test for doing its job.
        const sites = findWriteSites(`${CAND}const victim = join(CLONES, 'candidate-x');\nfs.mkdirSync(join(victim, 'src'));`);
        expect(sites.every((s) => !s.targetsSource)).toBe(true);
    });

    it('survives the two defects the first runs produced', () => {
        // 1. substitution must not rewrite identifiers INSIDE a string literal.
        const bindings = constBindings("const cand = join(REPO_ROOT, 'src');\nconst scratch = mkdtempSync(join(tmpdir(), 'ac-cand-'));");
        expect(expandExpression('scratch', bindings)).not.toContain('src');
        // 2. expansion must not DESTROY the root token it keys on.
        expect(targetsCanonicalSource("path.join(REPO_ROOT, 'src', 'a.md')", "path.join((path.resolve(d, '..')), 'src', 'a.md')")).toBe(true);
    });

    it('substituteOutsideStrings leaves literal contents untouched', () => {
        expect(substituteOutsideStrings("a + 'a-b-c'", (n) => (n === 'b' ? 'BOOM' : n))).toBe("a + 'a-b-c'");
        expect(substituteOutsideStrings('b + c', (n) => (n === 'b' ? 'BOOM' : n))).toBe('BOOM + c');
    });

    it('callArguments splits at top level only, and reports an unbalanced call', () => {
        expect(callArguments('f(a, g(b, c), "d,e")', 1)?.map((s) => s.trim())).toEqual(['a', 'g(b, c)', '"d,e"']);
        expect(callArguments('f(a, b', 1)).toBeNull();
    });
});

// --- § R0 — the capability is unobtainable while the blocker is open ---------

describe('the guarded capability', () => {
    it('reads the live blocker as open, and refuses', () => {
        expect(readMergeAuthorityStatus(REPO_ROOT)).toBe('open');
        expect(() => acquirePromotionCapability({ approver: 'A Human', approvedAt: '2026-08-31' }, REPO_ROOT))
            .toThrow(PromotionCapabilityUnobtainableError);
    });

    it('fails closed on a missing roadmap and on a missing blocker', () => {
        const dir = mkdtempSync(join(tmpdir(), 'promo-cap-'));
        try {
            expect(readMergeAuthorityStatus(dir)).toBe('roadmap-unreadable');
            mkdirSync(join(dir, 'agents', 'roadmaps'), { recursive: true });
            writeFileSync(join(dir, 'agents', 'roadmaps', 'road-to-harness-promotion-bridge.md'), '# nothing here\n');
            expect(readMergeAuthorityStatus(dir)).toBe('blocker-absent');
            expect(() => acquirePromotionCapability({ approver: 'A Human', approvedAt: '2026-08-31' }, dir))
                .toThrow(PromotionCapabilityUnobtainableError);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('still demands a NAMED human once the blocker reads resolved', () => {
        // The positive pole: without it, every assertion above would pass on a
        // function that refuses unconditionally and could never be satisfied.
        const dir = mkdtempSync(join(tmpdir(), 'promo-cap-ok-'));
        try {
            mkdirSync(join(dir, 'agents', 'roadmaps'), { recursive: true });
            writeFileSync(
                join(dir, 'agents', 'roadmaps', 'road-to-harness-promotion-bridge.md'),
                '### blocker: merge-authority\n\n- **Status:** resolved — settled by the owner\n',
            );
            expect(readMergeAuthorityStatus(dir)).toBe('resolved');
            expect(() => acquirePromotionCapability({ approver: '   ', approvedAt: '2026-08-31' }, dir))
                .toThrow(/NAMED human approver/);
            const cap = acquirePromotionCapability({ approver: 'A Human', approvedAt: '2026-08-31' }, dir);
            expect(cap.blockerStatusAtGrant).toBe('resolved');
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('blockerSection stops at the next heading', () => {
        const md = '### blocker: a\n\n- **Status:** open\n\n### blocker: b\n\n- **Status:** resolved\n';
        expect(blockerSection(md, 'a')).toContain('open');
        expect(blockerSection(md, 'a')).not.toContain('resolved');
        expect(blockerSection(md, 'missing')).toBeNull();
    });
});
