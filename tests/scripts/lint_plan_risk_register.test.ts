// Tests for src/scripts/lint_plan_risk_register.ts (Gate R1, plan-governance
// Phase 4). Synthetic fixtures only — inline strings + tmpdir files/repos,
// never the tracked agents/roadmaps/ corpus. code-comment-allow provenance-comment -- names the corpus these fixtures avoid
// The substantial-change FP/FN
// fixtures are the regression contract for the § 3 heuristic
// (docs/contracts/plan-review-gates.md).
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runInProc } from '../_lib/run_in_process.js';
import * as mod from '../../src/scripts/lint_plan_risk_register.js';

const BASE_PLAN = [
    '# Roadmap: Test plan',
    '',
    '## Phase 1: Build the thing',
    '',
    '- [ ] **Step 1:** do the first thing',
    '- [ ] **Step 2:** do the second thing',
    '',
    '## Phase 2: Ship the thing',
    '',
    '- [ ] **Step 1:** ship it',
    '',
    '## Acceptance Criteria',
    '',
    '- the thing exists',
    '- the thing ships',
    '',
].join('\n');

const VALID_MARKER = '<!-- risk-review: v1 | reviewed: 2026-08-04 | reviewer: tester -->';

const VALID_TABLE = [
    '| Rank | Item | Risk type | Description | Mitigation | Anchored under |',
    '|------|------|-----------|-------------|------------|----------------|',
    '| 1 | Risk A | product | desc | mitigate it | Phase 1 Step 1 |',
    '| 2 | Risk B | implementation | desc | mitigate it too | Phase 2 Step 1, Phase 1 |',
].join('\n');

function planWith(registerBody: string): string {
    return `${BASE_PLAN}\n## Risk Register\n${registerBody}\n`;
}

const VALID_PLAN = planWith(`${VALID_MARKER}\n${VALID_TABLE}`);

function kinds(violations: readonly mod.Violation[]): string[] {
    return violations.map((v) => v.kind);
}

// ---------------------------------------------------------------------------
// Pure content checks.
// ---------------------------------------------------------------------------

describe('lint_plan_risk_register — checkContent', () => {
    it('valid register passes', () => {
        const res = mod.checkContent('plan.md', VALID_PLAN);
        expect(res.exempt).toBeNull();
        expect(res.registerMissing).toBe(false);
        expect(res.reviewed).toBe('2026-08-04');
        expect(res.violations).toEqual([]);
    });

    it('valid honest-null passes', () => {
        const body =
            `${VALID_MARKER}\n` +
            '**Honest-null:** no material product or implementation risks identified because: prose-only meta plan.';
        const res = mod.checkContent('plan.md', planWith(body));
        expect(res.violations).toEqual([]);
    });

    it('status: draft frontmatter is exempt', () => {
        const draft = `---\ncomplexity: simple\nstatus: draft\n---\n\n${BASE_PLAN}`;
        const res = mod.checkContent('plan.md', draft);
        expect(res.exempt).toBe('draft');
        expect(res.violations).toEqual([]);
    });

    it('status: carrier is exempt too, and is NOT reported as draft', () => {
        const carrier = `---\ncomplexity: simple\nstatus: carrier\n---\n\n${BASE_PLAN}`;
        const res = mod.checkContent('plan.md', carrier);
        expect(res.exempt).toBe('carrier');
        expect(res.violations).toEqual([]);
    });

    it('reads the exempting status from the frontmatter only', () => {
        expect(mod.exemptingStatus(`---\nstatus: ready\n---\nstatus: carrier\n`)).toBeNull();
        expect(mod.exemptingStatus(`---\nstatus: carrier\n---\n`)).toBe('carrier');
        expect(mod.exemptingStatus(BASE_PLAN)).toBeNull();
    });

    it('missing section is reported as registerMissing', () => {
        const res = mod.checkContent('plan.md', BASE_PLAN);
        expect(res.registerMissing).toBe(true);
    });

    it('empty section without honest-null fails', () => {
        const res = mod.checkContent('plan.md', planWith(`${VALID_MARKER}\n`));
        expect(kinds(res.violations)).toContain('empty_register');
    });

    it('section empty even of the marker fails', () => {
        const res = mod.checkContent('plan.md', `${BASE_PLAN}\n## Risk Register\n\n`);
        expect(kinds(res.violations)).toContain('missing_marker');
    });

    it('prose-only "no risks" without the honest-null grammar fails', () => {
        const res = mod.checkContent('plan.md', planWith(`${VALID_MARKER}\nNo risks here, all good.`));
        expect(kinds(res.violations)).toContain('empty_register');
    });

    it('honest-null without a reason after because: fails', () => {
        const body = `${VALID_MARKER}\n**Honest-null:** no material risks identified because: .`;
        const res = mod.checkContent('plan.md', planWith(body));
        expect(kinds(res.violations)).toContain('malformed_honest_null');
    });

    it('malformed marker line fails', () => {
        const body = `<!-- risk-review: v2 | reviewed: 2026-08-04 | reviewer: tester -->\n${VALID_TABLE}`;
        const res = mod.checkContent('plan.md', planWith(body));
        expect(kinds(res.violations)).toContain('malformed_marker');
        expect(res.reviewed).toBeNull();
    });

    it('marker with empty reviewer fails', () => {
        const body = `<!-- risk-review: v1 | reviewed: 2026-08-04 | reviewer: -->\n${VALID_TABLE}`;
        const res = mod.checkContent('plan.md', planWith(body));
        expect(kinds(res.violations)).toContain('malformed_marker');
    });

    it('dangling Anchored under reference fails', () => {
        const table = [
            '| Rank | Item | Risk type | Description | Mitigation | Anchored under |',
            '|------|------|-----------|-------------|------------|----------------|',
            '| 1 | Risk A | product | desc | mitigate | Phase 9 Step 4 |',
        ].join('\n');
        const res = mod.checkContent('plan.md', planWith(`${VALID_MARKER}\n${table}`));
        expect(kinds(res.violations)).toContain('dangling_anchor');
    });

    it('one dangling anchor among comma-separated anchors fails', () => {
        const table = [
            '| Rank | Item | Risk type | Description | Mitigation | Anchored under |',
            '|------|------|-----------|-------------|------------|----------------|',
            '| 1 | Risk A | product | desc | mitigate | Phase 1 Step 1, Phase 9 Step 9 |',
        ].join('\n');
        const res = mod.checkContent('plan.md', planWith(`${VALID_MARKER}\n${table}`));
        expect(kinds(res.violations)).toContain('dangling_anchor');
    });

    it('non-ascending ranks fail', () => {
        const table = [
            '| Rank | Item | Risk type | Description | Mitigation | Anchored under |',
            '|------|------|-----------|-------------|------------|----------------|',
            '| 1 | A | product | d | m | Phase 1 |',
            '| 1 | B | product | d | m | Phase 2 |',
        ].join('\n');
        const res = mod.checkContent('plan.md', planWith(`${VALID_MARKER}\n${table}`));
        expect(kinds(res.violations)).toContain('bad_rank_order');
    });

    it('rank not starting at 1 fails', () => {
        const table = [
            '| Rank | Item | Risk type | Description | Mitigation | Anchored under |',
            '|------|------|-----------|-------------|------------|----------------|',
            '| 2 | A | product | d | m | Phase 1 |',
        ].join('\n');
        const res = mod.checkContent('plan.md', planWith(`${VALID_MARKER}\n${table}`));
        expect(kinds(res.violations)).toContain('bad_rank_order');
    });

    it('bad risk type fails', () => {
        const table = [
            '| Rank | Item | Risk type | Description | Mitigation | Anchored under |',
            '|------|------|-----------|-------------|------------|----------------|',
            '| 1 | A | operational | d | m | Phase 1 |',
        ].join('\n');
        const res = mod.checkContent('plan.md', planWith(`${VALID_MARKER}\n${table}`));
        expect(kinds(res.violations)).toContain('bad_risk_type');
    });

    it('empty mitigation fails', () => {
        const table = [
            '| Rank | Item | Risk type | Description | Mitigation | Anchored under |',
            '|------|------|-----------|-------------|------------|----------------|',
            '| 1 | A | product | d |  | Phase 1 |',
        ].join('\n');
        const res = mod.checkContent('plan.md', planWith(`${VALID_MARKER}\n${table}`));
        expect(kinds(res.violations)).toContain('empty_mitigation');
    });

    it('empty Anchored under cell fails', () => {
        const table = [
            '| Rank | Item | Risk type | Description | Mitigation | Anchored under |',
            '|------|------|-----------|-------------|------------|----------------|',
            '| 1 | A | product | d | m |  |',
        ].join('\n');
        const res = mod.checkContent('plan.md', planWith(`${VALID_MARKER}\n${table}`));
        expect(kinds(res.violations)).toContain('empty_anchor');
    });
});

describe('lint_plan_risk_register — marker / honest-null / anchor helpers', () => {
    it('parseMarker accepts tolerant whitespace', () => {
        const m = mod.parseMarker('<!--  risk-review:  v1  |  reviewed: 2026-08-04  |  reviewer: claude/host+council  -->');
        expect(m).toEqual({ reviewed: '2026-08-04', reviewer: 'claude/host+council' });
    });

    it('parseMarker rejects field-order swaps', () => {
        expect(mod.parseMarker('<!-- risk-review: v1 | reviewer: x | reviewed: 2026-08-04 -->')).toBeNull();
    });

    it('anchorResolves handles Phase X Step Y with letter-suffixed steps', () => {
        const doc = '## Phase 6: Wire\n\n- [ ] **Step 3b:** verify hashes\n';
        expect(mod.anchorResolves('Phase 6 Step 3b', doc)).toBe(true);
        expect(mod.anchorResolves('Phase 6 Step 4', doc)).toBe(false);
    });

    it('anchorResolves matches plain section-name substrings in headings', () => {
        const doc = '## Rollout plan for the widget\n';
        expect(mod.anchorResolves('Rollout plan', doc)).toBe(true);
        expect(mod.anchorResolves('Nonexistent section', doc)).toBe(false);
    });

    it('anchorResolves does not confuse Phase 2 with Phase 20', () => {
        const doc = '## Phase 20: Big\n\n- [ ] **Step 1:** x\n';
        expect(mod.anchorResolves('Phase 2 Step 1', doc)).toBe(false);
        expect(mod.anchorResolves('Phase 20 Step 1', doc)).toBe(true);
    });

    it('isValidHonestNull requires a non-empty reason', () => {
        expect(
            mod.isValidHonestNull(
                '**Honest-null:** no material product or implementation risks identified because: docs-only plan.',
            ),
        ).toBe(true);
        expect(mod.isValidHonestNull('**Honest-null:** no risks identified because: ')).toBe(false);
        expect(mod.isValidHonestNull('**Honest-null:** no risks identified.')).toBe(false);
        expect(mod.isValidHonestNull('No risks identified because: reasons.')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Substantial-change heuristic — FP/FN regression fixtures (contract § 3).
// ---------------------------------------------------------------------------

describe('lint_plan_risk_register — substantial-change heuristic', () => {
    it('typo fix in a NON-phase heading is not substantial', () => {
        const before = BASE_PLAN.replace('## Acceptance Criteria', '## Acceptance Criteria');
        const after = BASE_PLAN.replace('# Roadmap: Test plan', '# Roadmap: Test plan (typo fixd)');
        expect(mod.isSubstantialChange(before, after)).toBe(false);
    });

    it('prose-only scope wording change outside AC is not substantial', () => {
        const after = BASE_PLAN.replace('do the first thing', 'do the very first thing');
        expect(mod.isSubstantialChange(BASE_PLAN, after)).toBe(false);
    });

    it('phase heading added is substantial', () => {
        const after = `${BASE_PLAN}\n## Phase 3: Extra\n`;
        expect(mod.isSubstantialChange(BASE_PLAN, after)).toBe(true);
    });

    it('phase heading renamed is substantial', () => {
        const after = BASE_PLAN.replace('## Phase 2: Ship the thing', '## Phase 2: Ship it differently');
        expect(mod.isSubstantialChange(BASE_PLAN, after)).toBe(true);
    });

    it('checkbox line added is substantial', () => {
        const after = BASE_PLAN.replace(
            '- [ ] **Step 2:** do the second thing',
            '- [ ] **Step 2:** do the second thing\n- [ ] **Step 3:** do a third thing',
        );
        expect(mod.isSubstantialChange(BASE_PLAN, after)).toBe(true);
    });

    it('checkbox STATE flip is not substantial (count unchanged)', () => {
        const after = BASE_PLAN.replace('- [ ] **Step 1:** do the first thing', '- [x] **Step 1:** do the first thing');
        expect(mod.isSubstantialChange(BASE_PLAN, after)).toBe(false);
    });

    it('checkbox state flip inside Acceptance Criteria is not substantial', () => {
        const before = BASE_PLAN.replace('- the thing exists', '- [ ] the thing exists');
        const after = BASE_PLAN.replace('- the thing exists', '- [x] the thing exists');
        expect(mod.isSubstantialChange(before, after)).toBe(false);
    });

    it('Acceptance Criteria content edit is substantial', () => {
        const after = BASE_PLAN.replace('- the thing ships', '- the thing ships to every host');
        expect(mod.isSubstantialChange(BASE_PLAN, after)).toBe(true);
    });

    // The AC heading is recognised case-insensitively and tolerates a trailing
    // qualifier. Both misses were LIVE: `road-to-solution-minimalism.md` and
    // seven sibling roadmaps head their section `## Acceptance criteria`, so an
    // end-anchored case-sensitive match hashed the empty string for every one of
    // them and no edit to their criteria could ever read as substantial.
    it('lowercase Acceptance criteria content edit is substantial', () => {
        const before = BASE_PLAN.replace('## Acceptance Criteria', '## Acceptance criteria');
        const after = before.replace('- the thing ships', '- the thing ships to every host');
        expect(mod.isSubstantialChange(before, after)).toBe(true);
    });

    it('Acceptance criteria heading with a trailing qualifier is still read', () => {
        const before = BASE_PLAN.replace('## Acceptance Criteria', '## Acceptance criteria (per phase)');
        const after = before.replace('- the thing ships', '- the thing ships to every host');
        expect(mod.isSubstantialChange(before, after)).toBe(true);
    });

    // Near-miss in the direction the loosened matcher opens: `\\b` must not let a
    // heading that merely STARTS with the phrase through.
    it('a heading that only prefixes the phrase is not the AC section', () => {
        const before = BASE_PLAN.replace('## Acceptance Criteria', '## Acceptance criteriaXYZ');
        const after = before.replace('- the thing ships', '- the thing ships to every host');
        expect(mod.isSubstantialChange(before, after)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Git-dependent paths — throwaway repos with controlled commit dates.
// ---------------------------------------------------------------------------

function _git(cwd: string, args: readonly string[], dateIso?: string): void {
    const env: NodeJS.ProcessEnv = { ...process.env };
    if (dateIso !== undefined) {
        env['GIT_AUTHOR_DATE'] = `${dateIso}T12:00:00 +0000`;
        env['GIT_COMMITTER_DATE'] = `${dateIso}T12:00:00 +0000`;
    }
    execFileSync('git', [...args], { cwd, env, stdio: 'ignore' });
}

function initRepo(dir: string): void {
    _git(dir, ['init', '-q']);
    _git(dir, ['config', 'user.email', 'test@example.com']);
    _git(dir, ['config', 'user.name', 'test']);
}

function commitAll(dir: string, dateIso: string): void {
    _git(dir, ['add', '-A']);
    _git(dir, ['commit', '-q', '-m', 'fixture', '--no-verify'], dateIso);
}

describe('lint_plan_risk_register — git layers (grandfather + staleness)', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'r1-git-')));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('missing register, first commit after activation → violation (not grandfathered)', () => {
        initRepo(tmp);
        const p = path.join(tmp, 'plan.md');
        fs.writeFileSync(p, BASE_PLAN, 'utf-8');
        commitAll(tmp, '2026-08-05'); // day after activation — no baseline
        const res = mod.checkFile(p);
        expect(res.status).toBe('fail');
        expect(kinds(res.violations)).toContain('missing_register');
    });

    it('missing register, first commit ON the activation day → violation (cannot self-grandfather)', () => {
        initRepo(tmp);
        const p = path.join(tmp, 'plan.md');
        fs.writeFileSync(p, BASE_PLAN, 'utf-8');
        commitAll(tmp, mod.RISK_REGISTER_GATE_ACTIVATION);
        const res = mod.checkFile(p);
        expect(res.status).toBe('fail');
        expect(kinds(res.violations)).toContain('missing_register');
    });

    it('missing register, substantial change committed ON the activation day → exemption lifted', () => {
        initRepo(tmp);
        const p = path.join(tmp, 'plan.md');
        fs.writeFileSync(p, BASE_PLAN, 'utf-8');
        commitAll(tmp, '2026-07-01');
        // A post-gate substantial change landing on the activation day must not
        // become its own baseline (the `<=` self-grandfathering hole).
        fs.writeFileSync(p, `${BASE_PLAN}\n## Phase 3: New scope\n\n- [ ] **Step 1:** more work\n`, 'utf-8');
        commitAll(tmp, mod.RISK_REGISTER_GATE_ACTIVATION);
        const res = mod.checkFile(p);
        expect(res.status).toBe('fail');
        expect(kinds(res.violations)).toContain('missing_register');
    });

    it('missing register, untracked file → violation', () => {
        initRepo(tmp);
        const p = path.join(tmp, 'plan.md');
        fs.writeFileSync(p, BASE_PLAN, 'utf-8');
        const res = mod.checkFile(p);
        expect(res.status).toBe('fail');
        expect(kinds(res.violations)).toContain('missing_register');
    });

    it('missing register, pre-activation commit + feature-equal → grandfathered', () => {
        initRepo(tmp);
        const p = path.join(tmp, 'plan.md');
        fs.writeFileSync(p, BASE_PLAN, 'utf-8');
        commitAll(tmp, '2026-07-01');
        // Prose-only tweak after activation — features unchanged.
        fs.writeFileSync(p, BASE_PLAN.replace('do the first thing', 'do the very first thing'), 'utf-8');
        const res = mod.checkFile(p);
        expect(res.status).toBe('grandfathered');
        expect(res.violations).toEqual([]);
    });

    it('missing register, substantial change since activation → exemption lifted', () => {
        initRepo(tmp);
        const p = path.join(tmp, 'plan.md');
        fs.writeFileSync(p, BASE_PLAN, 'utf-8');
        commitAll(tmp, '2026-07-01');
        fs.writeFileSync(p, `${BASE_PLAN}\n## Phase 3: New scope\n\n- [ ] **Step 1:** more work\n`, 'utf-8');
        const res = mod.checkFile(p);
        expect(res.status).toBe('fail');
        expect(kinds(res.violations)).toContain('missing_register');
        expect(res.violations[0]?.detail).toContain('substantially');
    });

    it('stale review: COMMITTED substantial change after the reviewed date → violation', () => {
        initRepo(tmp);
        const p = path.join(tmp, 'plan.md');
        const reviewedBody =
            '<!-- risk-review: v1 | reviewed: 2026-01-01 | reviewer: tester -->\n' + VALID_TABLE;
        fs.writeFileSync(p, planWith(reviewedBody), 'utf-8');
        commitAll(tmp, '2026-01-01');
        // Substantial change COMMITTED after the review date — the gate judges
        // committed history, so this is the case that must still fail.
        fs.writeFileSync(
            p,
            planWith(reviewedBody).replace('## Phase 2: Ship the thing', '## Phase 2: Ship something else'),
            'utf-8',
        );
        commitAll(tmp, '2026-02-01');
        const res = mod.checkFile(p);
        expect(res.status).toBe('fail');
        expect(kinds(res.violations)).toContain('stale_review');
    });

    it('fresh review: non-substantial committed edits after the reviewed date pass', () => {
        initRepo(tmp);
        const p = path.join(tmp, 'plan.md');
        const reviewedBody =
            '<!-- risk-review: v1 | reviewed: 2026-01-01 | reviewer: tester -->\n' + VALID_TABLE;
        fs.writeFileSync(p, planWith(reviewedBody), 'utf-8');
        commitAll(tmp, '2026-01-01');
        // Checkbox state flip only — never substantial.
        fs.writeFileSync(
            p,
            planWith(reviewedBody).replace('- [ ] **Step 1:** do the first thing', '- [x] **Step 1:** do the first thing'),
            'utf-8',
        );
        commitAll(tmp, '2026-02-01');
        const res = mod.checkFile(p);
        expect(res.status).toBe('ok');
    });

    // Finding 9: while the edit AND its freshly written register are both
    // uncommitted, the staleness baseline is the PREVIOUS commit, so a register
    // written the same minute was reported stale — a false positive in the
    // normal local authoring flow. Staleness judges committed history; with
    // uncommitted modifications there is nothing committed to judge yet.
    it('uncommitted substantial change + freshly written register → no stale_review', () => {
        initRepo(tmp);
        const p = path.join(tmp, 'plan.md');
        const reviewedOld =
            '<!-- risk-review: v1 | reviewed: 2026-01-01 | reviewer: tester -->\n' + VALID_TABLE;
        fs.writeFileSync(p, planWith(reviewedOld), 'utf-8');
        commitAll(tmp, '2026-01-01');
        expect(mod.hasUncommittedChanges(p)).toBe(false);

        const reviewedNow =
            '<!-- risk-review: v1 | reviewed: 2026-08-04 | reviewer: tester -->\n' + VALID_TABLE;
        fs.writeFileSync(
            p,
            `${planWith(reviewedNow)}\n## Phase 3: New scope\n\n- [ ] **Step 1:** more work\n`,
            'utf-8',
        );
        expect(mod.hasUncommittedChanges(p)).toBe(true);

        const res = mod.checkFile(p);
        expect(kinds(res.violations)).not.toContain('stale_review');
        expect(res.status).toBe('ok');
    });

    // Same self-disabling shape as the Gate-R2 scope diff: `_git` reads whole
    // file blobs, and under Node's 1 MiB default maxBuffer a plan larger than
    // that threw ENOBUFS → null baseline → staleness silently skipped (fail
    // OPEN, unlike the grandfather path).
    it('staleness still fires on a plan larger than the default git maxBuffer', () => {
        initRepo(tmp);
        const p = path.join(tmp, 'plan.md');
        const reviewedBody =
            '<!-- risk-review: v1 | reviewed: 2026-01-01 | reviewer: tester -->\n' + VALID_TABLE;
        const filler = `\n${'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor. '.repeat(15000)}\n`;
        expect(filler.length).toBeGreaterThan(1024 * 1024);
        fs.writeFileSync(p, planWith(reviewedBody) + filler, 'utf-8');
        commitAll(tmp, '2026-01-01');
        fs.writeFileSync(
            p,
            (planWith(reviewedBody) + filler).replace('## Phase 2: Ship the thing', '## Phase 2: Ship something else'),
            'utf-8',
        );
        commitAll(tmp, '2026-02-01');
        const res = mod.checkFile(p);
        expect(kinds(res.violations)).toContain('stale_review');
    });

    it('register just written on an untracked file → fresh (no stale violation)', () => {
        initRepo(tmp);
        const p = path.join(tmp, 'plan.md');
        fs.writeFileSync(p, VALID_PLAN, 'utf-8');
        const res = mod.checkFile(p);
        expect(res.status).toBe('ok');
    });
});

// ---------------------------------------------------------------------------
// main() — corpus resolution, statuses, exit codes.
// ---------------------------------------------------------------------------

describe('lint_plan_risk_register — main', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'r1-main-')));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('valid corpus returns 0 and excludes template/dashboard/subdirs', () => {
        fs.writeFileSync(path.join(tmp, 'plan-a.md'), VALID_PLAN, 'utf-8');
        fs.writeFileSync(path.join(tmp, 'template.md'), 'no register at all\n', 'utf-8');
        fs.writeFileSync(path.join(tmp, 'dashboard.md'), 'no register at all\n', 'utf-8');
        fs.mkdirSync(path.join(tmp, 'archive'));
        fs.writeFileSync(path.join(tmp, 'archive', 'old.md'), 'no register\n', 'utf-8');
        expect(mod.main([tmp, '--quiet'])).toBe(0);
    });

    it('draft file is exempt and counts as scanned', () => {
        fs.writeFileSync(
            path.join(tmp, 'draft.md'),
            `---\nstatus: draft\n---\n\n${BASE_PLAN}`,
            'utf-8',
        );
        expect(mod.main([tmp, '--quiet'])).toBe(0);
    });

    it('violating corpus returns 1', () => {
        // Untracked in any repo relevant sense: tmpdir git repo absent →
        // history empty → not grandfathered → missing register fails.
        fs.writeFileSync(path.join(tmp, 'plan-bad.md'), BASE_PLAN, 'utf-8');
        expect(mod.main([tmp, '--quiet'])).toBe(1);
    });

    // A dead scan scope BLOCKS (exit 1) — it is not an internal error.
    // Exit 2 is warn-and-allow at every call site, so mapping a moved root to
    // 2 would degrade the gate to advisory (R2 finding 8). Contract § 6
    // carve-out: a gate that read nothing has not passed.
    it('dead scope (no targets) returns 1 — blocking, not advisory', () => {
        const empty = path.join(tmp, 'empty');
        fs.mkdirSync(empty);
        expect(mod.main([empty, '--quiet'])).toBe(1);
    });

    // A root that is not on disk at all is a legitimately empty corpus (a
    // project with no roadmaps yet), NOT a dead scope — blocking there would
    // fail every roadmap-less project with a misleading "the root moved".
    // The discriminator is deliberate: present-but-yielding-nothing blocks
    // (the test above), absent passes.
    it('nonexistent root returns 0 — empty corpus, not a dead scope', () => {
        expect(mod.main([path.join(tmp, 'does-not-exist'), '--quiet'])).toBe(0);
    });

    // Round-3 finding 7 — contract §6: the `scanned:` line is emitted on EVERY
    // exit path, exit 2 included, because the coverage guard reads that number.
    // Three R1 exits printed none: the dead-scope return, the unexpected-internal
    // return, and the top-level CLI catch.
    it('dead scope emits scanned: 0 AND exits 1', () => {
        const empty = path.join(tmp, 'empty');
        fs.mkdirSync(empty);
        const res = runInProc(mod.main, [empty, '--quiet']);
        expect(res.status).toBe(1);
        expect(res.stdout).toMatch(/^scanned: 0$/m);
    });

    // Root ignores mode bits, so the EACCES probe cannot be built there.
    it.skipIf(process.getuid?.() === 0)('an unreadable corpus root emits scanned: 0 AND exits 2', () => {
        const locked = path.join(tmp, 'locked');
        fs.mkdirSync(locked);
        fs.writeFileSync(path.join(locked, 'plan.md'), VALID_PLAN, 'utf-8');
        fs.chmodSync(locked, 0o000);
        try {
            const res = runInProc(mod.main, [locked, '--quiet']);
            expect(res.status).toBe(2);
            expect(res.stdout).toMatch(/^scanned: 0$/m);
            expect(res.stderr).toMatch(/Internal error/);
        } finally {
            fs.chmodSync(locked, 0o755);
        }
    });

    it('emits the scanned count exactly once on the success path', () => {
        fs.writeFileSync(path.join(tmp, 'plan-a.md'), VALID_PLAN, 'utf-8');
        const res = runInProc(mod.main, [tmp, '--quiet']);
        expect(res.status).toBe(0);
        expect(res.stdout.match(/^scanned: \d+$/gm)).toEqual(['scanned: 1']);
    });

    it('settings escape hatch: planning.risk_review=false → 0 without scanning', () => {
        fs.writeFileSync(path.join(tmp, '.agent-settings.yml'), 'planning:\n  risk_review: false\n', 'utf-8');
        expect(mod.riskReviewDisabled(tmp)).toBe(true);
        const prev = process.cwd();
        try {
            process.chdir(tmp);
            // Even a dead scope exits 0 — the skip is explicit, not silent.
            expect(mod.main([path.join(tmp, 'nope')])).toBe(0);
        } finally {
            process.chdir(prev);
        }
    });

    it('riskReviewDisabled is false for missing / other-valued settings', () => {
        expect(mod.riskReviewDisabled(tmp)).toBe(false);
        fs.writeFileSync(path.join(tmp, '.agent-settings.yml'), 'planning:\n  risk_review: true\n', 'utf-8');
        expect(mod.riskReviewDisabled(tmp)).toBe(false);
    });
});

// R2 round-4 finding 1: one `**Honest-null:**` line anywhere in the body used to
// skip validateTable entirely, so a register carrying BOTH the line and a table
// passed with zero row checks.
describe('lint_plan_risk_register — honest-null does not suppress the table', () => {
    const BAD_TABLE = [
        '| Rank | Item | Risk type | Description | Mitigation | Anchored under |',
        '|------|------|-----------|-------------|------------|----------------|',
        '| 2 | A | operational | d |  | Phase 9 Step 9 |',
    ].join('\n');

    it('honest-null + a table reports the contradiction AND the row violations', () => {
        const body =
            `${VALID_MARKER}\n` +
            '**Honest-null:** no material product or implementation risks identified because: none found.\n' +
            BAD_TABLE;
        const res = mod.checkContent('plan.md', planWith(body));
        const ks = kinds(res.violations);
        expect(ks).toContain('contradictory_register');
        // The row checks must still fire — the whole point of the fix.
        expect(ks).toContain('bad_rank_order');
        expect(ks).toContain('bad_risk_type');
        expect(ks).toContain('empty_mitigation');
        expect(ks).toContain('dangling_anchor');
    });

    it('honest-null alone still passes', () => {
        const body =
            `${VALID_MARKER}\n` +
            '**Honest-null:** no material product or implementation risks identified because: prose-only meta plan.';
        expect(mod.checkContent('plan.md', planWith(body)).violations).toEqual([]);
    });

    it('a valid table alone still passes', () => {
        expect(mod.checkContent('plan.md', VALID_PLAN).violations).toEqual([]);
    });
});
