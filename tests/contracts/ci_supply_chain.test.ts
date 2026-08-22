/**
 * The regression net for this repository's CI supply-chain posture.
 *
 * WHY THIS IS A TEST AND NOT A LINTER RULE. `lint_workflow_security` grew a
 * `persist-credentials` rule in the same change, and it is a DETECTOR, not a
 * net: its findings are MEDIUM, and the linter's exit-code contract is 0 on
 * advisory findings and 1 only on `--strict` + HIGH. Reverting a pin makes it
 * print the finding and still exit 0 — verified, not assumed. Promoting the tier
 * would touch a severity model locked by council on 2026-06-13, and the council
 * had no quota when this shipped (50/50 on both seats, 0 of 2 present), so
 * re-tiering it unilaterally was refused. See
 * agents/evidence/analysis/workflow-security-net-degraded-decision.md.
 *
 * A test blocks CI without touching that model. That is the whole reason this
 * file exists, and it is the honest shape of the answer rather than the tidy
 * one.
 *
 * Each assertion below is paired with the measurement it froze, because a
 * "0 violations" assertion over an empty scan is indistinguishable from a
 * passing one — so every block asserts its own denominator first.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = path.join(__dirname, '../..');
const WF = path.join(ROOT, '.github/workflows');
const ACT = path.join(ROOT, '.github/actions');

function yamlFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const out: string[] = [];
    const walk = (d: string): void => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) walk(p);
            else if (e.name.endsWith('.yml') || e.name.endsWith('.yaml')) out.push(p);
        }
    };
    walk(dir);
    return out;
}

const ALL = [...yamlFiles(WF), ...yamlFiles(ACT)];

interface UsesRef {
    file: string;
    line: number;
    ref: string;
    pin: string;
    comment: string;
}

function usesRefs(): UsesRef[] {
    const out: UsesRef[] = [];
    for (const f of ALL) {
        const lines = fs.readFileSync(f, 'utf-8').split('\n');
        lines.forEach((L, i) => {
            const m = /uses:\s+(\S+)@(\S+)(.*)$/.exec(L);
            if (m === null) return;
            const ref = String(m[1]);
            // Local composite refs (`./.github/actions/...`) have no version to pin.
            if (ref.startsWith('./')) return;
            out.push({ file: path.relative(ROOT, f), line: i + 1, ref, pin: String(m[2]), comment: String(m[3]) });
        });
    }
    return out;
}

describe('CI supply chain — every action resolves to an immutable commit', () => {
    it('the scan finds the population it is supposed to guard', () => {
        expect(ALL.length).toBeGreaterThan(20);
        // Frozen at 112 when this landed. A LOWER number is the interesting
        // direction: it means workflows were deleted or the scan stopped
        // finding them, and a "0 unpinned" pass over a shrunken scope is the
        // dead-scope failure this assertion exists to catch.
        expect(usesRefs().length).toBeGreaterThanOrEqual(100);
    });

    it('no `uses:` resolves through a mutable tag', () => {
        const bad = usesRefs().filter((u) => !/^[0-9a-f]{40}$/.test(u.pin));
        expect(bad.map((u) => `${u.file}:${u.line} ${u.ref}@${u.pin}`)).toEqual([]);
    });

    it('every pin carries a version comment, so the SHA stays reviewable', () => {
        // A bare 40-hex SHA is unreadable in review and rots into a number
        // nobody dares touch; the comment is also what the dependency bot
        // updates against.
        const bare = usesRefs().filter((u) => !/#\s*v?\d/.test(u.comment));
        expect(bare.map((u) => `${u.file}:${u.line} ${u.ref}`)).toEqual([]);
    });
});

describe('CI supply chain — no checkout leaves a credential behind it', () => {
    const checkouts = (): { file: string; line: number; block: string }[] => {
        const out: { file: string; line: number; block: string }[] = [];
        for (const f of yamlFiles(WF)) {
            const lines = fs.readFileSync(f, 'utf-8').split('\n');
            lines.forEach((L, i) => {
                if (!/uses:\s+actions\/checkout@/.test(L)) return;
                // The step's own block: from here to the next `- ` at the same
                // or lower indent, capped so a malformed file cannot run away.
                const ind = L.length - L.trimStart().length;
                const body: string[] = [];
                for (let j = i + 1; j < Math.min(lines.length, i + 25); j++) {
                    const nxt = String(lines[j]);
                    const nind = nxt.length - nxt.trimStart().length;
                    if (nxt.trim().startsWith('- ') && nind <= ind) break;
                    if (nxt.trim().length > 0 && nind < ind) break;
                    body.push(nxt);
                }
                out.push({ file: path.relative(ROOT, f), line: i + 1, block: body.join('\n') });
            });
        }
        return out;
    };

    it('the scan finds the checkouts it is supposed to guard', () => {
        // 50 when this landed; 0 of them carried the flag beforehand.
        expect(checkouts().length).toBeGreaterThanOrEqual(45);
    });

    it('every checkout states persist-credentials explicitly', () => {
        // Present, not false: `true` is a legitimate answer for a job that
        // pushes. An explicit `true` is a reviewable decision; a MISSING key is
        // an ambient one, and only the second is a defect.
        const silent = checkouts().filter((c) => !/persist-credentials:\s*(true|false)/.test(c.block));
        expect(silent.map((c) => `${c.file}:${c.line}`)).toEqual([]);
    });

    it('every kept credential names the step that needs it', () => {
        const kept = checkouts().filter((c) => /persist-credentials:\s*true/.test(c.block));
        // Two when this landed: the two jobs that `git push`. If this ever
        // reaches zero the assertion still holds and says nothing — which is
        // why the count is asserted too.
        expect(kept.length).toBeGreaterThan(0);
        const unexplained = kept.filter((c) => !/#.*persist-credentials KEPT/.test(c.block));
        expect(unexplained.map((c) => `${c.file}:${c.line}`)).toEqual([]);
    });
});

describe('CI supply chain — the tracked sentences describe what the repo does', () => {
    it('the workflow-security allowlist points at no dead roadmap phase', () => {
        const raw = fs.readFileSync(path.join(ROOT, 'src/scripts/lint_workflow_security_allowlist.json'), 'utf-8');
        // The three entries all closed with "SHA-pinning tracked in
        // road-to-security-hardening P3". That roadmap's Phase 3 is the
        // block-no-verify hook and its file mentions pinning nowhere.
        expect(raw).not.toContain('road-to-security-hardening');
        const parsed = JSON.parse(raw) as { findings: { reason?: string }[] };
        for (const f of parsed.findings) {
            expect(f.reason, 'every allowlist entry must cite why the finding is acceptable').toBeTruthy();
        }
    });

    it('dependabot does not claim a pinning posture the repo lacks', () => {
        const raw = fs.readFileSync(path.join(ROOT, '.github/dependabot.yml'), 'utf-8');
        const claimsSha = /pins? (?:every )?actions?[^\n]*commit SHA/i.test(raw);
        const unpinned = usesRefs().filter((u) => !/^[0-9a-f]{40}$/.test(u.pin)).length;
        // The claim and the posture move together in both directions: claiming
        // SHA pinning while a tag survives is the defect this froze, and
        // dropping the claim while the pins hold would be a silent regression
        // of the rationale.
        expect(claimsSha, `dependabot claims SHA pinning: ${String(claimsSha)}, unpinned refs: ${unpinned}`).toBe(
            unpinned === 0,
        );
    });
});

describe('CI supply chain — the eslint warn tier cannot drift upward', () => {
    it('lint:ts caps warnings at zero', () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8')) as {
            scripts: Record<string, string>;
        };
        expect(pkg.scripts['lint:ts']).toContain('--max-warnings 0');
    });

    it('no-explicit-any is an error, not a warning', () => {
        const cfg = fs.readFileSync(path.join(ROOT, 'eslint.config.js'), 'utf-8');
        expect(cfg).toMatch(/'@typescript-eslint\/no-explicit-any':\s*'error'/);
    });
});
