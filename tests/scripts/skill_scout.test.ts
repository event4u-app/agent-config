import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

import {
    COVERAGE_THRESHOLD,
    GATE_NAMES,
    LINT_FLEET_ROOTED,
    LINT_FLEET_UNROOTED,
    QUARANTINE_REL,
    buildVerdict,
    candidateNameRefusal,
    candidateText,
    computeDelta,
    evaluateGates,
    intake,
    render,
    resolveCandidateDir,
    type Delta,
    type GateName,
} from '../../src/scripts/skill_scout.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const tmps: string[] = [];

function mkCandidate(files: Record<string, string>): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scout-'));
    tmps.push(dir);
    for (const [rel, body] of Object.entries(files)) {
        const full = path.join(dir, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, body);
    }
    return dir;
}

afterAll(() => {
    for (const d of tmps) fs.rmSync(d, { recursive: true, force: true });
});

const CLEAN_DELTA: Delta = {
    max_similarity: 0.1,
    nearest: 'some-skill',
    nearest_path: 'src/skills/some-skill/SKILL.md',
    compared_against: 299,
};

function passingInputs(overrides: Partial<Parameters<typeof evaluateGates>[1]> = {}) {
    return {
        licence: 'MIT',
        benefit: 'measured: 3 fewer retries per run',
        challenges: [
            { round: 1, critical_open: false },
            { round: 2, critical_open: false },
            { round: 3, critical_open: false },
        ],
        intake: { accepted: true, refusals: [], files_seen: 1 },
        ...overrides,
    };
}

describe('quarantine intake (1.1) — refuses, never repairs', () => {
    it('accepts an inert text-only candidate', () => {
        const dir = mkCandidate({ 'SKILL.md': '# a candidate\n' });
        const r = intake(dir);
        expect(r.accepted).toBe(true);
        expect(r.refusals).toEqual([]);
        expect(r.files_seen).toBe(1);
    });

    it('refuses a candidate with the executable bit set', () => {
        const dir = mkCandidate({ 'SKILL.md': '# x\n' });
        fs.chmodSync(path.join(dir, 'SKILL.md'), 0o755);
        const r = intake(dir);
        expect(r.accepted).toBe(false);
        expect(r.refusals.join(' ')).toMatch(/executable bit set/);
    });

    it('refuses a candidate carrying a non-text extension', () => {
        const dir = mkCandidate({ 'SKILL.md': '# x\n', 'run.sh': 'echo hi\n' });
        const r = intake(dir);
        expect(r.accepted).toBe(false);
        expect(r.refusals.join(' ')).toMatch(/outside the text allow-list/);
    });

    it('refuses a candidate containing a symlink', () => {
        const dir = mkCandidate({ 'SKILL.md': '# x\n' });
        fs.symlinkSync('/etc/passwd', path.join(dir, 'link.md'));
        const r = intake(dir);
        expect(r.accepted).toBe(false);
        expect(r.refusals.join(' ')).toMatch(/symlink/);
    });

    it('refuses an empty candidate directory', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scout-empty-'));
        tmps.push(dir);
        expect(intake(dir).accepted).toBe(false);
    });

    it('refuses a candidate that does not exist at all', () => {
        const r = intake(path.join(os.tmpdir(), 'scout-absent-' + Date.now()));
        expect(r.accepted).toBe(false);
        expect(r.refusals.join(' ')).toMatch(/does not exist/);
    });

    it('quarantine root lives under the gitignored agents/runtime tree', () => {
        expect(QUARANTINE_REL.startsWith('agents/runtime/')).toBe(true);
        const ignored = fs.readFileSync(path.join(REPO_ROOT, '.gitignore'), 'utf-8');
        expect(ignored).toMatch(/^\/agents\/runtime\/$/m);
    });

    it('AC-1 — no candidate file appears in any generated projection', () => {
        const projections = [
            'dist/agent-src',
            '.claude',
            '.augment',
            '.cursor',
            '.clinerules',
        ];
        for (const p of projections) {
            const full = path.join(REPO_ROOT, p);
            if (!fs.existsSync(full)) continue;
            const hit = execFileSync(
                'bash',
                ['-c', `find ${JSON.stringify(full)} -path '*skill-scout*' -print -quit || true`],
                { encoding: 'utf-8' },
            ).trim();
            expect(hit, `${p} must not carry a quarantined candidate`).toBe('');
        }
    });
});

describe('the differential (2.1, 2.2) — computed from this package, not the claim', () => {
    it('scores a verbatim copy of an existing skill as covered', () => {
        const covered = fs.readFileSync(
            path.join(REPO_ROOT, 'src', 'skills', 'accessibility-auditor', 'SKILL.md'),
            'utf-8',
        );
        const dir = mkCandidate({ 'SKILL.md': covered });
        const delta = computeDelta(dir);
        expect(delta.compared_against).toBeGreaterThan(200);
        expect(delta.max_similarity).toBeGreaterThanOrEqual(COVERAGE_THRESHOLD);
        expect(delta.nearest).toBe('accessibility-auditor');
    });

    it('scores an off-domain candidate as novel', () => {
        const dir = mkCandidate({
            'SKILL.md':
                '# marine injection timing\n\nCalibrate plunger lead against the ' +
                'indicator diagram, scavenge trace and turbocharger revolutions.\n',
        });
        expect(computeDelta(dir).max_similarity).toBeLessThan(COVERAGE_THRESHOLD);
    });

    it('2.2 — the coverage rejection names the covering artefact', () => {
        const covered: Delta = {
            max_similarity: 0.99,
            nearest: 'accessibility-auditor',
            nearest_path: 'src/skills/accessibility-auditor/SKILL.md',
            compared_against: 299,
        };
        const novelty = evaluateGates(covered, passingInputs()).find((g) => g.gate === 'novelty');
        expect(novelty?.passed).toBe(false);
        expect(novelty?.reason).toContain('accessibility-auditor');
        expect(novelty?.reason).toContain('src/skills/accessibility-auditor/SKILL.md');
    });
});

describe('3.1 — the offer appears only when all four gates pass', () => {
    it('all four passing yields a recommendation', () => {
        const gates = evaluateGates(CLEAN_DELTA, passingInputs());
        expect(gates.every((g) => g.passed)).toBe(true);
        const v = buildVerdict('c', CLEAN_DELTA, gates, {
            accepted: true,
            refusals: [],
            files_seen: 1,
        });
        expect(v.recommended).toBe(true);
    });

    // One case per gate — each observed failing before it was observed passing,
    // which is what AC-3 asks for. The table IS the four tests.
    const cases: { gate: GateName; inputs: Partial<Parameters<typeof evaluateGates>[1]>; delta?: Delta }[] = [
        {
            gate: 'novelty',
            inputs: {},
            delta: {
                max_similarity: 0.9,
                nearest: 'x',
                nearest_path: 'src/skills/x/SKILL.md',
                compared_against: 299,
            },
        },
        { gate: 'security_licence', inputs: { licence: null } },
        { gate: 'benefit', inputs: { benefit: null } },
        {
            gate: 'challenge_loops',
            inputs: {
                challenges: [
                    { round: 1, critical_open: false },
                    { round: 2, critical_open: false },
                ],
            },
        },
    ];

    for (const c of cases) {
        it(`failing exactly ${c.gate} produces no recommendation`, () => {
            const delta = c.delta ?? CLEAN_DELTA;
            const gates = evaluateGates(delta, passingInputs(c.inputs));
            const failing = gates.filter((g) => !g.passed).map((g) => g.gate);
            expect(failing).toEqual([c.gate]);
            const v = buildVerdict('c', delta, gates, {
                accepted: true,
                refusals: [],
                files_seen: 1,
            });
            expect(v.recommended).toBe(false);
            expect(v.reason).toContain('keine Contribution empfohlen');
        });
    }

    it('an unresolved critical objection fails the loop gate even at three rounds', () => {
        const gates = evaluateGates(
            CLEAN_DELTA,
            passingInputs({
                challenges: [
                    { round: 1, critical_open: false },
                    { round: 2, critical_open: true },
                    { round: 3, critical_open: false },
                ],
            }),
        );
        const loops = gates.find((g) => g.gate === 'challenge_loops');
        expect(loops?.passed).toBe(false);
        expect(loops?.reason).toMatch(/unresolved critical objection/);
    });

    it('every gate is evaluated and reported, never short-circuited', () => {
        const gates = evaluateGates(CLEAN_DELTA, passingInputs({ licence: null, benefit: null }));
        expect(gates.map((g) => g.gate)).toEqual([...GATE_NAMES]);
        expect(gates.every((g) => g.reason.trim().length > 0)).toBe(true);
    });
});

describe('3.2 — the rejection carries the same shape as the acceptance', () => {
    it('both verdicts expose an identical field set', () => {
        const ok = buildVerdict('c', CLEAN_DELTA, evaluateGates(CLEAN_DELTA, passingInputs()), {
            accepted: true,
            refusals: [],
            files_seen: 1,
        });
        const bad = buildVerdict(
            'c',
            CLEAN_DELTA,
            evaluateGates(CLEAN_DELTA, passingInputs({ benefit: null })),
            { accepted: true, refusals: [], files_seen: 1 },
        );
        expect(ok.recommended).toBe(true);
        expect(bad.recommended).toBe(false);
        expect(Object.keys(ok).sort()).toEqual(Object.keys(bad).sort());
        for (const v of [ok, bad]) {
            expect(v.candidate).not.toBe('');
            expect(v.reason).not.toBe('');
            expect(v.gates).toHaveLength(GATE_NAMES.length);
            expect(v.delta.compared_against).toBeGreaterThan(0);
        }
    });

    it('both render through the same function and both name every gate', () => {
        for (const inputs of [passingInputs(), passingInputs({ licence: null })]) {
            const gates = evaluateGates(CLEAN_DELTA, passingInputs(inputs));
            const text = render(
                buildVerdict('c', CLEAN_DELTA, gates, {
                    accepted: true,
                    refusals: [],
                    files_seen: 1,
                }),
            );
            for (const g of GATE_NAMES) expect(text).toContain(g);
        }
    });
});

describe('3.3 — the scout never posts anything', () => {
    const source = fs.readFileSync(
        path.join(REPO_ROOT, 'src', 'scripts', 'skill_scout.ts'),
        'utf-8',
    );

    it('carries no PR-opening call path', () => {
        for (const needle of ['gh pr create', 'pulls.create', 'createPullRequest']) {
            expect(source).not.toContain(needle);
        }
    });

    it('carries no network egress — scout-egress-authority resolved (a)', () => {
        for (const needle of ['fetch(', 'https://', 'http://', 'node:https', 'axios']) {
            expect(source, `${needle} would add the untrusted-ingestion leg`).not.toContain(needle);
        }
    });
});

describe('1.2 — the lint fleet split is recorded with a reason per entry', () => {
    it('names at least one lint that actually reaches a candidate root', () => {
        expect(LINT_FLEET_ROOTED.length).toBeGreaterThan(0);
        expect(LINT_FLEET_ROOTED).toContain('lint_skill_descriptions');
    });

    it('every unavailable lint carries a non-empty reason', () => {
        expect(LINT_FLEET_UNROOTED.length).toBeGreaterThan(0);
        for (const u of LINT_FLEET_UNROOTED) {
            expect(u.lint).not.toBe('');
            expect(u.why.length).toBeGreaterThan(20);
        }
    });

    it('the two halves are disjoint', () => {
        const unroot = new Set(LINT_FLEET_UNROOTED.map((u) => u.lint));
        for (const l of LINT_FLEET_ROOTED) expect(unroot.has(l)).toBe(false);
    });
});

describe('AC-4 — no new CLI verb and no new skill', () => {
    it('no skill directory was added for the scout', () => {
        expect(fs.existsSync(path.join(REPO_ROOT, 'src', 'skills', 'skill-scout'))).toBe(false);
    });

    it('the scout is reachable as a script, not as a dispatcher verb', () => {
        expect(fs.existsSync(path.join(REPO_ROOT, 'src', 'scripts', 'skill_scout.ts'))).toBe(true);
    });
});

describe('quarantine confinement — the root is the trust boundary, not a hint', () => {
    // The contract states every inertness guarantee as a property of a directory
    // UNDER the quarantine root, because the human copy step is the checkpoint.
    // A name that leaves the root names something nobody copied there.
    const escapes = [
        '../../../../.github/workflows',
        '..',
        '.',
        'nested/candidate',
        '/etc',
        'a/../../b',
        '',
        '   ',
    ];

    for (const name of escapes) {
        it(`refuses the unconfined candidate name ${JSON.stringify(name)}`, () => {
            expect(candidateNameRefusal(name)).not.toBeNull();
            const r = resolveCandidateDir('/tmp/quarantine-root', name);
            expect(r.dir).toBeNull();
            expect(r.refusal).not.toBeNull();
        });
    }

    it('accepts a plain single-segment name and pins it directly under the root', () => {
        expect(candidateNameRefusal('wcag-checker')).toBeNull();
        const r = resolveCandidateDir('/tmp/quarantine-root', 'wcag-checker');
        expect(r.refusal).toBeNull();
        expect(r.dir).toBe(path.join('/tmp/quarantine-root', 'wcag-checker'));
    });

    it('no resolved candidate directory ever leaves the root', () => {
        for (const name of [...escapes, 'ok', 'ok.md', 'ok-1_2']) {
            const r = resolveCandidateDir('/tmp/quarantine-root', name);
            if (r.dir === null) continue;
            expect(r.dir.startsWith('/tmp/quarantine-root' + path.sep)).toBe(true);
        }
    });

    it('the CLI refuses a traversing candidate instead of rendering a verdict over it', () => {
        // Before the confinement guard this exact invocation walked 33 files
        // under .github/workflows and printed "adoption recommended" for them.
        let stdout = '';
        let stderr = '';
        let code = 0;
        try {
            stdout = execFileSync(
                path.join(REPO_ROOT, 'scripts-run'),
                [
                    'src/scripts/skill_scout',
                    '--candidate',
                    '../../../../.github/workflows',
                    '--licence',
                    'MIT',
                    '--benefit',
                    'measured: none',
                    '--challenges',
                    '3',
                ],
                { encoding: 'utf-8', cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
            );
        } catch (exc) {
            const e = exc as { status?: number; stdout?: string; stderr?: string };
            code = e.status ?? 1;
            stdout = e.stdout ?? '';
            stderr = e.stderr ?? '';
        }
        expect(code, 'a traversing name is not a candidate').toBe(1);
        expect(stdout).not.toContain('adoption recommended');
        expect(stdout).not.toContain('verdict');
        expect(stderr).toContain('intake refused');
        // And the scan-scope assertion must never have reported the traversed
        // root — the refusal lands before it runs.
        expect(stderr).not.toContain('scanned:');
        expect(stderr).not.toContain('.github/workflows —');
    });
});

describe('read-time inertness — the intake-then-swap window is narrowed', () => {
    it('does not follow a symlink planted after a clean intake', () => {
        const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'scout-outside-'));
        tmps.push(outside);
        const secret = path.join(outside, 'secret.md');
        fs.writeFileSync(secret, 'TOCTOU-LEAK-CANARY\n');

        const dir = mkCandidate({ 'a.md': 'inert candidate body\n' });

        // Intake sees a clean, regular, in-quarantine file.
        expect(intake(dir).accepted).toBe(true);

        // ...and the directory is then mutated before the read pass, which is
        // the whole of the reported race.
        fs.unlinkSync(path.join(dir, 'a.md'));
        fs.symlinkSync(secret, path.join(dir, 'a.md'));

        const text = candidateText(dir);
        expect(text, 'a post-intake symlink must not be followed out of quarantine').not.toContain(
            'TOCTOU-LEAK-CANARY',
        );
    });

    it('still reads an ordinary candidate file', () => {
        const dir = mkCandidate({ 'a.md': 'inert candidate body\n' });
        expect(candidateText(dir)).toContain('inert candidate body');
    });

    it('skips a file that grew past the cap after intake', () => {
        const dir = mkCandidate({ 'a.md': 'small\n' });
        expect(intake(dir).accepted).toBe(true);
        fs.writeFileSync(path.join(dir, 'a.md'), 'x'.repeat(512 * 1024 + 1));
        expect(candidateText(dir)).toBe('');
    });
});
