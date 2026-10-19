// Tests for src/scripts/lint_roadmap_complexity.ts (py2ts Phase 4 / Wave 4b).
//
// No pytest suite exists for this module. This is a focused differential
// suite over the public helpers (frontmatter slice, complexity tag,
// per-roadmap lint of lightweight caps + plate detection) plus a
// golden-parity layer that runs python3 vs tsx on the REAL REPO,
// byte-identical stdout + stderr + exit (skipped without python3).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_roadmap_complexity.js';



describe('lint_roadmap_complexity — behavioural spec', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lrc-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function write(content: string): string {
        const p = path.join(tmp, 'road.md');
        fs.writeFileSync(p, content, 'utf-8');
        return p;
    }

    it('_frontmatter extracts the leading --- block', () => {
        expect(mod._frontmatter('---\ncomplexity: lightweight\n---\nbody\n')).toBe(
            'complexity: lightweight',
        );
        expect(mod._frontmatter('no frontmatter\n')).toBe('');
    });

    it('_read_complexity reads the tag', () => {
        expect(mod._read_complexity('complexity: structural')).toBe('structural');
        expect(mod._read_complexity('complexity: lightweight')).toBe('lightweight');
        expect(mod._read_complexity('other: x')).toBeNull();
    });

    it('flags a missing complexity tag', () => {
        const p = write('---\nname: x\n---\nbody\n');
        expect(mod.lint_roadmap(p, 0)).toEqual([
            "missing 'complexity:' frontmatter (must declare 'lightweight' or 'structural')",
        ]);
    });

    it('lightweight: flags exceeding the phase cap', () => {
        const phases = Array.from({ length: 7 }, (_, i) => `## Phase ${i + 1}\n\nx\n`).join('');
        const p = write(`---\ncomplexity: lightweight\n---\n${phases}`);
        const problems = mod.lint_roadmap(p, 0);
        expect(problems.some((x) => x.includes('lightweight phase cap exceeded: 7 phases'))).toBe(
            true,
        );
    });

    it('lightweight: flags a Council Round block', () => {
        const p = write('---\ncomplexity: lightweight\n---\n## Council Round 1\n\nx\n');
        const problems = mod.lint_roadmap(p, 0);
        expect(problems.some((x) => x.includes("contains '## Council Round N'"))).toBe(true);
    });

    it('structural: no caps, but plate framing flagged when horizon_weeks=0', () => {
        const p = write('---\ncomplexity: structural\n---\n## Horizon\n\nwork\n');
        const problems = mod.lint_roadmap(p, 0);
        expect(problems.some((x) => x.includes('plate/horizon convention detected'))).toBe(true);
    });

    it('structural: plate framing allowed when horizon_weeks>0', () => {
        const p = write('---\ncomplexity: structural\n---\n## Horizon\n\nwork\n');
        expect(mod.lint_roadmap(p, 4)).toEqual([]);
    });

    it('human-gate step warns in every execution mode (template rule 22)', () => {
        const p = write(
            '---\ncomplexity: lightweight\n---\n## Phase 1\n\n' +
                '- [ ] **Step 1:** User verifies the dashboard output\n' +
                '- [ ] **Step 2:** Manually check the rendered page\n' +
                '- [ ] **Step 3:** Wait for approval from the maintainer\n',
        );
        const warnings: string[] = [];
        const problems = mod.lint_roadmap(p, 0, warnings);
        expect(problems).toEqual([]);
        const gateWarnings = warnings.filter((w) => w.includes('human-gate step'));
        expect(gateWarnings).toHaveLength(3);
        expect(gateWarnings[0]).toContain('templates/roadmaps.md rule 22');
    });

    it('human-gate patterns ignore done steps and plain prose', () => {
        const p = write(
            '---\ncomplexity: lightweight\n---\n## Phase 1\n\n' +
                '- [x] Sign-off from the maintainer recorded in the blocker entry\n' +
                'The user reviews arrive via the feedback form.\n' +
                '- [ ] **Step 1:** Add tests for the user email verification flow\n',
        );
        const warnings: string[] = [];
        mod.lint_roadmap(p, 0, warnings);
        expect(warnings.filter((w) => w.includes('human-gate step'))).toEqual([]);
    });

    it('human-gate patterns ignore agent work ABOUT approval features', () => {
        const p = write(
            '---\ncomplexity: lightweight\n---\n## Phase 1\n\n' +
                '- [ ] Implement the human-review audit log\n' +
                '- [ ] Add a user approval state to the domain model\n' +
                '- [ ] Test the sign-off workflow\n',
        );
        const warnings: string[] = [];
        mod.lint_roadmap(p, 0, warnings);
        expect(warnings.filter((w) => w.includes('human-gate'))).toEqual([]);
    });

    it('obtain-approval and stakeholder-feedback steps warn', () => {
        const p = write(
            '---\ncomplexity: lightweight\n---\n## Phase 1\n\n' +
                '- [ ] Obtain approval from the product owner\n' +
                '- [ ] Wait for feedback from stakeholders\n',
        );
        const warnings: string[] = [];
        mod.lint_roadmap(p, 0, warnings);
        expect(warnings.filter((w) => w.includes('human-gate step'))).toHaveLength(2);
    });

    it('human-gate phase headings warn; working headings do not', () => {
        const p = write(
            '---\ncomplexity: lightweight\n---\n' +
                '## Phase 1 — Review / Sign-off\n\n- [ ] x\n' +
                '## Phase 2: User Acceptance\n\n- [ ] y\n' +
                '## Phase 3 — Review existing skills\n\n- [ ] z\n',
        );
        const warnings: string[] = [];
        mod.lint_roadmap(p, 0, warnings);
        const hits = warnings.filter((w) => w.includes('human-gate phase heading'));
        expect(hits).toHaveLength(2);
        expect(hits.some((w) => w.includes('Review existing skills'))).toBe(false);
    });

    it('human-approval exit criteria warn inside criteria blocks only', () => {
        const p = write(
            '---\ncomplexity: lightweight\n---\n## Phase 1\n\n- [ ] x\n\n' +
                'Exit criteria:\n' +
                '- The maintainer approves the implementation.\n\n' +
                '## Acceptance Criteria\n\n' +
                'Acceptance: Maintainer confirmation received.\n' +
                '- All generated links return HTTP 200\n\n' +
                '## Notes\n\nThe user approves invoices in the billing UI.\n',
        );
        const warnings: string[] = [];
        mod.lint_roadmap(p, 0, warnings);
        const hits = warnings.filter((w) => w.includes('human-approval exit criterion'));
        expect(hits).toHaveLength(2);
        expect(hits.some((w) => w.includes('billing UI'))).toBe(false);
    });

    it('a gate resting on an external population warns, in criteria and in Resolved when', () => {
        const p = write(
            '---\ncomplexity: lightweight\n---\n## Phase 1\n\n- [ ] x\n\n' +
                'Exit criteria: 50 external installations with write activity recorded.\n\n' +
                '## Blockers\n\n### blocker: adoption\n' +
                '- **Resolved when:** at least 2 people have activated it\n',
        );
        const warnings: string[] = [];
        mod.lint_roadmap(p, 0, warnings);
        const hits = warnings.filter((w) => w.includes('gate rests on'));
        expect(hits).toHaveLength(2);
        expect(hits.some((w) => w.includes('an external user population'))).toBe(true);
        expect(hits.some((w) => w.includes('a headcount threshold of external people'))).toBe(true);
    });

    it('an agent-decidable gate stays silent, and the nouns are free outside gate context', () => {
        const p = write(
            '---\ncomplexity: lightweight\n---\n## Phase 1\n\n- [ ] x\n\n' +
                'Exit criteria: `task ci` exits 0 and the fixture file exists.\n\n' +
                '## Notes\n\nWe expect churn to drop and installations to rise once this lands.\n',
        );
        const warnings: string[] = [];
        mod.lint_roadmap(p, 0, warnings);
        expect(warnings.filter((w) => w.includes('gate rests on'))).toEqual([]);
    });

    it('autonomous mode: vague step and pre-existing [~] items warn', () => {
        const p = write(
            '---\ncomplexity: lightweight\nexecution:\n  mode: autonomous\n---\n## Phase 1\n\n' +
                '- [ ] **Step 1:** Improve the importer\n' +
                '- [~] **Step 2:** Deferred thing\n',
        );
        const warnings: string[] = [];
        mod.lint_roadmap(p, 0, warnings);
        expect(warnings.some((w) => w.includes('vague step under execution.mode: autonomous'))).toBe(
            true,
        );
        expect(warnings.some((w) => w.includes('pre-existing [~] deferred item'))).toBe(true);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------


// ---------------------------------------------------------------------------
// relates: — road-to-roadmap-situational-awareness § 4.1
// ---------------------------------------------------------------------------

describe('relates: — a closed relation vocabulary', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lrc-relates-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function write(fm: string): string {
        const p = path.join(tmp, 'road.md');
        fs.writeFileSync(p, `---\ncomplexity: structural\n${fm}\n---\n## Phase 1\n\n- [ ] x\n`, 'utf-8');
        return p;
    }

    it('accepts every one of the four relations', () => {
        for (const rel of ['extends', 'supersedes', 'disjoint']) {
            const p = write(`relates:\n  - slug: road-to-other\n    relation: ${rel}\n    note: "n"`);
            expect(mod.lint_roadmap(p, 0)).toEqual([]);
        }
        // `depends` additionally has to mirror into `depends:` — rule 18.
        const p = write(
            'depends: [road-to-other]\nrelates:\n  - slug: road-to-other\n    relation: depends\n    note: "n"',
        );
        expect(mod.lint_roadmap(p, 0)).toEqual([]);
    });

    it('reds on an unknown relation', () => {
        const p = write('relates:\n  - slug: road-to-other\n    relation: maybe\n    note: "n"');
        expect(mod.lint_roadmap(p, 0)).toEqual([
            "unknown relates[].relation 'maybe' — allowed: extends | supersedes | depends | " +
                'disjoint (templates/roadmaps.md rule 18)',
        ]);
    });

    it('accepts an explicit empty list', () => {
        expect(mod.lint_roadmap(write('relates: []   # scanned: 716 files, 0 hits'), 0)).toEqual([]);
    });

    it('reds on a relates: block with rows but no relation key', () => {
        const p = write('relates:\n  - slug: road-to-other\n    note: "n"');
        expect(mod.lint_roadmap(p, 0)[0]).toContain("'relates:' present but no 'relation:' key");
    });

    it('reds on a depends row that does not mirror into depends:', () => {
        const p = write('relates:\n  - slug: road-to-other\n    relation: depends\n    note: "n"');
        expect(mod.lint_roadmap(p, 0)[0]).toContain("no 'depends:' key mirrors it");
    });

    it('is silent when the field is absent — requiring it is the ratchet, not this gate', () => {
        expect(mod.lint_roadmap(write('name: x'), 0)).toEqual([]);
    });
});

describe('blocked-by-needs-depends — a cross-file marker needs a live depends row', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lrc-blocked-'));
        fs.mkdirSync(path.join(tmp, 'archive'));
        fs.writeFileSync(path.join(tmp, 'road-to-live.md'), '---\ncomplexity: structural\n---\n', 'utf-8');
        fs.writeFileSync(path.join(tmp, 'archive', 'road-to-gone.md'), '---\ncomplexity: structural\n---\n', 'utf-8');
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function write(fm: string, body = ''): string {
        const p = path.join(tmp, 'road.md');
        fs.writeFileSync(p, `---\ncomplexity: structural\n${fm}\n---\n## Phase 1\n\n${body}- [ ] x\n`, 'utf-8');
        return p;
    }

    it('blocked-by-needs-depends: a marker naming another roadmap with no relates row is red', () => {
        const p = write('relates: []', '- [ ] <!-- blocked-by: road-to-live#phase-3 --> wait\n');
        const problems = mod.lint_roadmap(p, 0);
        expect(problems).toHaveLength(1);
        expect(problems[0]).toContain("blocked-by marker names 'road-to-live'");
    });

    it('blocked-by-needs-depends: an extends row does not satisfy the marker', () => {
        const p = write(
            'relates:\n  - slug: road-to-live\n    relation: extends\n    note: "n"',
            '- [ ] <!-- blocked-by: road-to-live#3.1 --> wait\n',
        );
        expect(mod.lint_roadmap(p, 0)[0]).toContain("blocked-by marker names 'road-to-live'");
    });

    it('blocked-by-needs-depends: a depends row satisfies the marker', () => {
        const p = write(
            'depends: [road-to-live]\nrelates:\n  - slug: road-to-live\n    relation: depends\n    note: "n"',
            '- [ ] <!-- blocked-by: road-to-live#3.1 --> wait\n',
        );
        expect(mod.lint_roadmap(p, 0)).toEqual([]);
    });

    it('blocked-by-needs-depends: a blocker-id marker is not a cross-file marker', () => {
        const p = write('relates: []', '- [ ] <!-- blocked-by: default-flip-of-the-layer | asked: no --> wait\n');
        expect(mod.lint_roadmap(p, 0)).toEqual([]);
    });

    it('blocked-by-needs-depends: prose quoting the marker outside a comment is not a marker', () => {
        const p = write('relates: []', 'A `blocked-by: road-to-live#…` marker is described here.\n');
        expect(mod.lint_roadmap(p, 0)).toEqual([]);
    });

    it('blocked-by-needs-depends: a depends row naming an archived file is red', () => {
        const p = write(
            'depends: [road-to-gone]\nrelates:\n  - slug: road-to-gone\n    relation: depends\n    note: "n"',
        );
        const warnings: string[] = [];
        const problems = mod.lint_roadmap(p, 0, warnings);
        expect(problems.filter((w) => w.includes("depends row names 'road-to-gone', which is under archive/"))).toHaveLength(1);
        expect(warnings.filter((w) => w.includes('under archive/'))).toEqual([]);
    });

    it('blocked-by-needs-depends: an explicit archive/ slug is red too, a live one is not', () => {
        const p = write(
            'depends: [archive/road-to-gone, road-to-live]\nrelates:\n  - slug: archive/road-to-gone\n    relation: depends\n    note: "n"\n  - slug: road-to-live\n    relation: depends\n    note: "n"',
        );
        const hits = mod.lint_roadmap(p, 0).filter((w) => w.includes('under archive/'));
        expect(hits).toHaveLength(1);
        expect(hits[0]).toContain("'archive/road-to-gone'");
    });

    it('blocked-by-needs-depends: an extends row naming an archived file stays green', () => {
        const p = write(
            'relates:\n  - slug: road-to-gone\n    relation: extends\n    note: "n"',
        );
        expect(mod.lint_roadmap(p, 0)).toEqual([]);
    });
});

describe('dated waits — a step that waits on a future date warns', () => {
    const roadmap = (step: string): string =>
        `---\ncomplexity: lightweight\n---\n## Phase 1\n\n- [x] done\n${step}\n`;

    it('warns on an open step whose window opens after today', () => {
        const warnings: string[] = [];
        mod._check_dated_waits(roadmap('- [ ] **6.2 Read it.** The window opens 2026-11-13.'), warnings, '2026-10-19');
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain('stubs/ entry');
    });

    it('stays silent on a past date and on a done step', () => {
        const warnings: string[] = [];
        mod._check_dated_waits(roadmap('- [ ] The window opened 2026-10-01.'), warnings, '2026-10-19');
        mod._check_dated_waits(roadmap('- [x] The window opens 2026-11-13.'), warnings, '2026-10-19');
        expect(warnings).toEqual([]);
    });
});
