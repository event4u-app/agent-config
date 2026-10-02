/**
 * Auto-carry — `deferral_carry.ts` and its wiring into the archival sweep.
 *
 * A roadmap whose only obstacle is bare `[~]` steps used to sit at 100 % in the
 * dashboard and never archive. The sweep now carries those steps (and the
 * blockers they name) to a follow-up and archives the parent in the same run.
 * Every spec below either proves the carry happened in a form the existing
 * validation accepts, or proves it refused without writing anything.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { deferralProblems, main, parseDeferredItems } from '../../src/agent-src/scripts/archive_completed_roadmaps.js';
import { nextCarrySlug, planCarry } from '../../src/agent-src/scripts/deferral_carry.js';

const SRC = 'road-to-parent';
const CHILD = `${SRC}-carried`;

function _repo(files: Record<string, string>): string {
    const d = mkdtempSync(join(tmpdir(), 'carry-'));
    for (const [rel, body] of Object.entries(files)) {
        const f = join(d, rel);
        mkdirSync(join(f, '..'), { recursive: true });
        writeFileSync(f, body);
    }
    const git = (...a: string[]): void => {
        execFileSync('git', a, { cwd: d, encoding: 'utf-8' });
    };
    git('init', '-q');
    git('config', 'user.email', 't@example.com');
    git('config', 'user.name', 't');
    git('add', '-A');
    git('commit', '-qm', 'base');
    return d;
}

const BLOCKER = (id: string, owner = 'implementer'): string =>
    `### blocker: ${id}\n\n- **Status:** open\n- **Owner:** ${owner}\n- **Blocks:** 1.2\n` +
    `- **What to do:** run \`./scripts-run src/scripts/x\`\n- **Resolved when:** the window closes\n`;

const parent = (deferred: string, blockers = ''): string =>
    `---\ncomplexity: lightweight\nstatus: ready\n---\n\n# Road to parent\n\n## Phase 1 — Work\n\n` +
    `- [x] **1.1 done**\n${deferred}\n` +
    (blockers === '' ? '' : `## Blockers\n\n${blockers}\n`) +
    `## Acceptance Criteria\n\n- [x] AC-1 — done\n`;

const read = (root: string, rel: string): string => readFileSync(join(root, rel), 'utf-8');
const active = (root: string, slug: string): string => `agents/roadmaps/${slug}.md`;
const archived = (slug: string): string => `agents/roadmaps/archive/${slug}.md`;

describe('the sweep carries bare deferrals, then archives', () => {
    it('carries a bare `[~]` as an OPEN step and archives the parent', () => {
        const root = _repo({
            [active('', SRC)]: parent('- [~] **1.2 needs elapsed time.** Wait a month.\n      verify: the reading exists\n'),
        });
        expect(main(['--all', '--repo-root', root])).toBe(0);

        expect(existsSync(join(root, archived(SRC)))).toBe(true);
        const child = read(root, active('', CHILD));
        expect(child).toMatch(/^parent_roadmap: road-to-parent$/m);
        expect(child).toContain('- [ ] **1.2 needs elapsed time.** Wait a month.');
        expect(child).toContain('      verify: the reading exists');
        expect(child).not.toMatch(/^\s*[-*] \[~\]/m);

        // The archived parent is annotated, and the pair passes the same
        // validation a hand-written carry has to pass.
        const parentText = read(root, archived(SRC));
        expect(parseDeferredItems(parentText).map((d) => d.destination)).toEqual([CHILD]);
        expect(deferralProblems(root, `${SRC}.md`, parentText)).toEqual([]);
    });

    it('moves an open blocker a carried step names — still open in the child, closed in the parent', () => {
        const root = _repo({
            [active('', SRC)]: parent('- [~] **1.2 later** <!-- blocked-by: wait-window -->\n', BLOCKER('wait-window')),
        });
        main(['--all', '--repo-root', root]);

        expect(existsSync(join(root, archived(SRC)))).toBe(true);
        const child = read(root, active('', CHILD));
        expect(child).toContain('### blocker: wait-window');
        expect(child).toMatch(/^- \*\*Status:\*\* open$/m);
        expect(read(root, archived(SRC))).toMatch(
            /^- \*\*Status:\*\* resolved — carried, still open, to `road-to-parent-carried`/m,
        );
    });

    it('REFUSES and writes nothing when an open blocker is named by no deferred step', () => {
        const before = parent('- [~] **1.2 later**\n', BLOCKER('unrelated-decision'));
        const root = _repo({ [active('', SRC)]: before });
        main(['--all', '--repo-root', root]);

        expect(existsSync(join(root, active('', CHILD)))).toBe(false);
        expect(existsSync(join(root, archived(SRC)))).toBe(false);
        expect(read(root, active('', SRC))).toBe(before);
    });

    it('`--dry-run` reports the carry and writes nothing', () => {
        const before = parent('- [~] **1.2 later**\n');
        const root = _repo({ [active('', SRC)]: before });
        main(['--all', '--dry-run', '--repo-root', root]);

        expect(existsSync(join(root, active('', CHILD)))).toBe(false);
        expect(read(root, active('', SRC))).toBe(before);
    });

    it('`--changed-only` never carries a roadmap this branch did not touch', () => {
        const root = _repo({ [active('', SRC)]: parent('- [~] **1.2 later**\n') });
        // HEAD is its own base: nothing is touched.
        main(['--base', 'HEAD', '--repo-root', root]);

        expect(existsSync(join(root, active('', CHILD)))).toBe(false);
        expect(existsSync(join(root, active('', SRC)))).toBe(true);
    });

    it('leaves an existing, hand-written annotation alone', () => {
        const root = _repo({
            [active('', SRC)]: parent('- [~] **1.2 later** <!-- deferred-resolution: carried-to=road-to-nowhere -->\n'),
        });
        main(['--all', '--repo-root', root]);

        // The annotation is wrong (no such roadmap), so the parent stays — and
        // the sweep did not paper over it with a carry of its own.
        expect(existsSync(join(root, active('', CHILD)))).toBe(false);
        expect(existsSync(join(root, active('', SRC)))).toBe(true);
    });
});

describe('owner-dependent blockers — the owner decides, step by step', () => {
    const owned = (): string =>
        parent(
            '- [~] **1.2 Decide the fallback.** <!-- blocked-by: owner-call -->\n      verify: the decision is recorded\n',
            BLOCKER('owner-call', 'maintainer'),
        );

    it('writes nothing and prints the decision with the FIRST step on screen', () => {
        const before = owned();
        const root = _repo({ [active('', SRC)]: before });
        const out: string[] = [];
        const write = process.stdout.write.bind(process.stdout);
        process.stdout.write = ((c: string) => (out.push(String(c)), true)) as typeof process.stdout.write;
        try {
            main(['--all', '--repo-root', root]);
        } finally {
            process.stdout.write = write;
        }
        const text = out.join('');

        expect(read(root, active('', SRC))).toBe(before);
        expect(existsSync(join(root, active('', CHILD)))).toBe(false);
        expect(existsSync(join(root, `agents/roadmaps/later/${CHILD}.md`))).toBe(false);
        expect(text).toContain('Work them step by step, starting with:');
        expect(text).toContain('- [~] **1.2 Decide the fallback.**');
        // One JSON line a subagent forwards to its orchestrator unchanged.
        const line = text.split('\n').find((l) => l.trim().startsWith('OWNER-DECISION ')) as string;
        const record = JSON.parse(line.trim().slice('OWNER-DECISION '.length));
        expect(record.owner_blockers).toEqual(['owner-call']);
        expect(record.first_step).toContain('1.2 Decide the fallback.');
    });

    it('an owner value the list does not know is treated as the owner', () => {
        const root = _repo({
            [active('', SRC)]: parent('- [~] **1.2 later** <!-- blocked-by: who-knows -->\n', BLOCKER('who-knows', 'whoever')),
        });
        main(['--all', '--repo-root', root]);
        expect(existsSync(join(root, archived(SRC)))).toBe(false);
    });

    it('`--owner-decision later` archives the parent and parks steps + blockers in later/', () => {
        const root = _repo({ [active('', SRC)]: owned() });
        main(['--all', '--owner-decision', 'later', '--repo-root', root]);

        expect(existsSync(join(root, archived(SRC)))).toBe(true);
        expect(existsSync(join(root, active('', CHILD)))).toBe(false);
        const parked = read(root, `agents/roadmaps/later/${CHILD}.md`);
        expect(parked).toMatch(/^status: later$/m);
        expect(parked).toMatch(/^entry_condition:\n {2}what: .+\n {2}when: .+\n {2}who: owner$/m);
        expect(parked).toContain('### blocker: owner-call');
        expect(parked).toContain('(../archive/road-to-parent.md)');
        expect(deferralProblems(root, `${SRC}.md`, read(root, archived(SRC)))).toEqual([]);
    });
});

describe('planCarry', () => {
    it('puts a deferred acceptance criterion under the child`s acceptance criteria', () => {
        const text =
            `---\ncomplexity: lightweight\n---\n\n# Road to parent\n\n## Phase 1 — Work\n\n- [x] **1.1 done**\n\n` +
            `## Acceptance Criteria\n\n- [x] AC-1 — done\n- [~] AC-2 — measured after a month\n`;
        const out = planCarry(mkdtempSync(join(tmpdir(), 'carry-')), `${SRC}.md`, text, [], '2026-10-02');
        if (!('plan' in out)) throw new Error(out.refused);
        const ac = out.plan.destText.split('\n## Acceptance Criteria\n')[1] as string;
        expect(ac).toContain('- [ ] AC-2 — measured after a month');
    });

    it('marks a large carry structural instead of breaking the lightweight cap', () => {
        const long = Array.from({ length: 520 }, (_, i) => `      line ${i}`).join('\n');
        const text = parent(`- [~] **1.2 later**\n${long}\n`);
        const out = planCarry(mkdtempSync(join(tmpdir(), 'carry-')), `${SRC}.md`, text, [], '2026-10-02');
        if (!('plan' in out)) throw new Error(out.refused);
        expect(out.plan.destText).toMatch(/^complexity: structural$/m);
    });
});

describe('nextCarrySlug', () => {
    it('never reuses a slug held in any disposition directory', () => {
        const root = mkdtempSync(join(tmpdir(), 'carry-'));
        mkdirSync(join(root, 'agents', 'roadmaps', 'archive'), { recursive: true });
        writeFileSync(join(root, archived(CHILD)), 'x');
        expect(nextCarrySlug(root, SRC)).toBe(`${CHILD}-2`);
    });

    it('a carry of a carry does not stack suffixes', () => {
        const root = mkdtempSync(join(tmpdir(), 'carry-'));
        mkdirSync(join(root, 'agents', 'roadmaps', 'archive'), { recursive: true });
        writeFileSync(join(root, archived(CHILD)), 'x');
        expect(nextCarrySlug(root, CHILD)).toBe(`${CHILD}-2`);
    });
});
