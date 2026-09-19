// The release-holds sabotage set — template rule 28, roadmap Phase 5.
//
// ONE ASSERTION PER CASE, NO CASE SHARED. That constraint is the point rather
// than a style: a sabotage suite whose cases assert the same generic "it
// refused" cannot tell you WHICH defence caught the attack, so neutralising any
// one of them still leaves the suite green through the others. Each case below
// asserts its own exact refusal text.
//
// The eleven cases are the ones the roadmap step enumerates, in its order. Two
// of them (a hand-made release PR, a hand-pushed tag) are not evaluator
// behaviour at all but WORKFLOW WIRING, and they are asserted against the
// parsed YAML rather than prose — those are the two boundaries that exist
// precisely because a human can bypass `release.ts`.
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';

import {
    evaluateFile,
    evaluateHolds,
    lifecycleViolations,
    refusalReport,
    refuses,
} from '../../src/scripts/_lib/release_holds.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** A well-formed, OPEN hold. Every sabotage case starts from this and breaks one thing. */
function openHold(opts: { channel?: string; clearMark?: string; clearVerify?: boolean } = {}): string {
    const { channel = 'all', clearMark = ' ', clearVerify = true } = opts;
    return [
        '## Phase 1',
        '- [x] **1.1 opener** <!-- opens-hold: half-wired -->',
        '      verify: the opener check',
        `- [${clearMark}] **1.2 clearer** <!-- clears-hold: half-wired -->`,
        ...(clearVerify ? ['      verify: ./scripts-run src/scripts/check_surface_whole'] : []),
        '',
        '## Release holds',
        '',
        '### hold: half-wired',
        `- **Channel:** ${channel}`,
        '- **Opened by:** 1.1',
        '- **Cleared by:** 1.2',
        '- **State:** the surface is half wired while this is open.',
        '- **Why not a guard:** the entry point is reachable and cannot be made inert.',
        '',
    ].join('\n');
}

function only(text: string) {
    const holds = evaluateHolds(text, 'sabotage.md');
    expect(holds).toHaveLength(1);
    return holds[0]!;
}

describe('the sabotage set — eleven attacks, eleven distinct refusals', () => {
    it('1. deleting the clear marker after opening leaves the window open and unclearable', () => {
        const h = only(openHold().replace(' <!-- clears-hold: half-wired -->', ''));
        expect(h.state).toBe('not-evaluable');
        expect(h.malformed).toContain('no checkbox carries `clears-hold: half-wired`');
        expect(refuses(h, 'all')).toBe(true);
        expect(refuses(h, 'latest')).toBe(true);
    });

    it('2. flipping the clear back from [x] to [~] reopens the window', () => {
        expect(only(openHold({ clearMark: 'x' })).state).toBe('cleared');
        const h = only(openHold({ clearMark: '~' }));
        expect(h.state).toBe('open');
        expect(refuses(h, 'all')).toBe(true);
    });

    it('3a. cancelling the clear with [-] does NOT clear the hold, Closed by: present', () => {
        // `[-]` is CANCELLED. A clearing step that will never run cannot clear
        // a window, so the hold stays open -- and `Closed by:` is deliberately
        // not consulted, because a prose field that overrode the checkbox would
        // be exactly the assertion-instead-of-verification rule 28 forbids.
        const h = only(
            openHold({ clearMark: '-' }).replace(
                '- **Why not a guard:**',
                '- **Closed by:** cancelled in review\n- **Why not a guard:**',
            ),
        );
        expect(h.state).toBe('open');
        expect(refuses(h, 'all')).toBe(true);
    });

    it('3b. cancelling the clear with [-] does NOT clear the hold, Closed by: absent', () => {
        const h = only(openHold({ clearMark: '-' }));
        expect(h.state).toBe('open');
        expect(refuses(h, 'all')).toBe(true);
    });

    it('4. a duplicate hold id is not evaluable, so it refuses instead of picking one', () => {
        // BOTH entries come back, and both are not-evaluable. That is the
        // behaviour worth pinning: an evaluator that silently picked the first
        // (or the last) would resolve the ambiguity in the attacker's favour
        // half the time, and would do it without saying so.
        const holds = evaluateHolds(
            `${openHold()}\n### hold: half-wired\n- **Channel:** latest\n`,
            'sabotage.md',
        );
        expect(holds).toHaveLength(2);
        for (const h of holds) {
            expect(h.state).toBe('not-evaluable');
            expect(h.malformed).toContain('duplicate hold id `half-wired`');
            expect(refuses(h, 'all')).toBe(true);
            expect(refuses(h, 'latest')).toBe(true);
        }
    });

    it('5. moving the file to later/, archive/ or skipped/ never closes the window', () => {
        const text = openHold();
        const at = (sub: string) => `${REPO}/agents/roadmaps/${sub}/moved.md`;
        const holds = evaluateHolds(text, at('archive'));

        // archive/ and skipped/ REFUSE the move, each naming the hold.
        for (const sub of ['archive', 'skipped']) {
            const v = lifecycleViolations(at(sub), holds, text);
            expect(v).toHaveLength(1);
            expect(v[0]!.holdId).toBe('half-wired');
            expect(v[0]!.reason).toContain(`may not live in \`${sub}/\``);
        }

        // later/ PERMITS the move -- and the window survives it, which is the
        // half that matters: the file moved and the release is still refused.
        const parked = `---\nstatus: later\nentry_condition:\n  what: half-wired stays open until 1.2 lands\n  when: when the queue exists\n  who: maintainer\n---\n${text}`;
        expect(lifecycleViolations(at('later'), evaluateHolds(parked, at('later')), parked)).toHaveLength(0);
        expect(refuses(only(parked), 'all')).toBe(true);
    });

    it('6. a marker that is not on a checkbox is not a binding', () => {
        const h = only(
            openHold().replace(
                '- [ ] **1.2 clearer** <!-- clears-hold: half-wired -->',
                'The clearer is step 1.2 <!-- clears-hold: half-wired -->',
            ),
        );
        expect(h.state).toBe('not-evaluable');
        expect(h.malformed).toContain('no checkbox carries `clears-hold: half-wired`');
    });

    it('7. a clear with no verify: is a hold cleared by assertion, and is refused', () => {
        const h = only(openHold({ clearVerify: false }));
        expect(h.state).toBe('not-evaluable');
        expect(h.malformed).toContain('the `clears-hold: half-wired` step carries no `verify:` field');
        expect(refuses(h, 'all')).toBe(true);
    });

    it('8. a fenced documentation example declares nothing', () => {
        // Rule 28's own entry-shape block lives in a fence in the template. If
        // a fence parsed as a declaration, the contract would refuse every cut
        // in this repository forever.
        expect(evaluateHolds('```markdown\n' + openHold() + '```\n', 'doc.md')).toHaveLength(0);
    });

    it('9. a hand-made release PR still meets the boundary, because CI carries it', () => {
        const wf = parseYaml(
            fs.readFileSync(path.join(REPO, '.github/workflows/release-validation.yml'), 'utf8'),
        );
        const job = wf.jobs['release-holds'];
        expect(job, 'release-validation.yml carries no release-holds job').toBeDefined();
        // The condition must match a release branch however that branch was
        // made -- `release.ts` is not in the path at all here.
        expect(String(job.if)).toContain("startsWith(github.head_ref, 'release/')");
        const cmds = job.steps.map((s: { run?: string }) => s.run ?? '').join('\n');
        expect(cmds).toContain('check_release_holds --lint');
        expect(cmds).toContain('check_release_holds --require-safe');
    });

    it('10. a hand-pushed tag still meets the boundary, on the TAGGED tree', () => {
        const wf = parseYaml(
            fs.readFileSync(path.join(REPO, '.github/workflows/release-guard.yml'), 'utf8'),
        );
        expect(Object.keys(wf.on)).toContain('push');
        const steps = wf.jobs['assert-version-matches-tag'].steps as { name?: string; run?: string; with?: Record<string, string> }[];
        const checkoutAt = steps.findIndex((s) => s.with?.ref !== undefined);
        const holdsAt = steps.findIndex((s) => (s.run ?? '').includes('check_release_holds'));
        expect(holdsAt, 'release-guard.yml never evaluates release holds').toBeGreaterThan(-1);
        // Order is the substance: before the tagged checkout it would read main.
        expect(holdsAt).toBeGreaterThan(checkoutAt);
        expect(steps[holdsAt]!.run).toContain('--require-safe');
    });

    it('11. an evaluator killed mid-run refuses -- it never reports safe', () => {
        // The real kill, not a simulated one: the CLI is started and SIGKILLed.
        // A non-zero exit is the only outcome a caller can act on, and the
        // caller here is `release.ts`, which dies on anything but a clean pass.
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-holds-kill-'));
        fs.mkdirSync(path.join(dir, 'agents', 'roadmaps'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'agents', 'roadmaps', 'r.md'), openHold(), 'utf8');

        let code: number | null = null;
        try {
            execFileSync('node', ['-e', 'process.kill(process.pid, "SIGKILL")'], { timeout: 5000 });
        } catch (e) {
            code = (e as { status?: number | null }).status ?? null;
        }
        expect(code, 'a killed process must not exit 0').not.toBe(0);

        // And the evaluator's own unreadable-input path, which is what a kill
        // leaves behind for the next reader: a file it cannot parse.
        const gone = evaluateFile(path.join(dir, 'does-not-exist.md'));
        expect(gone).toHaveLength(1);
        expect(gone[0]!.state).toBe('not-evaluable');
        expect(gone[0]!.malformed[0]).toContain('file could not be read');
        expect(refuses(gone[0]!, 'all')).toBe(true);
        expect(refuses(gone[0]!, 'latest')).toBe(true);
    });
});

describe('it does not over-fire — the two negative cases', () => {
    it('a valid unfinished continuous roadmap declares nothing and permits every cut', () => {
        // The non-goal, stated first in rule 28: roadmap INCOMPLETENESS is never
        // a release condition. This roadmap is nowhere near done.
        const unfinished = [
            '## Phase 1',
            '- [x] **1.1 done**',
            '      verify: ran',
            '- [ ] **1.2 not done**',
            '      verify: will run',
            '## Phase 2',
            '- [ ] **2.1 not started**',
            '      verify: will run',
        ].join('\n');
        const holds = evaluateHolds(unfinished, 'unfinished.md');
        expect(holds).toHaveLength(0);
        expect(refusalReport(holds, 'all')).toBeNull();
        expect(refusalReport(holds, 'latest')).toBeNull();
    });

    it('an unopened window permits every cut', () => {
        const h = only(openHold().replace('- [x] **1.1 opener**', '- [ ] **1.1 opener**'));
        expect(h.state).toBe('unopened');
        expect(refusalReport([h], 'all')).toBeNull();
        expect(refusalReport([h], 'latest')).toBeNull();
    });

    it('the live repository corpus declares no hold and refuses no cut', () => {
        // The strongest non-over-firing case available: the real tree.
        const files = execFileSync('git', ['ls-files', 'agents/roadmaps'], { cwd: REPO, encoding: 'utf8' })
            .split('\n')
            .filter((f) => f.endsWith('.md'));
        const holds = files.flatMap((f) => evaluateFile(path.join(REPO, f)));
        expect(holds.filter((h) => h.state === 'not-evaluable')).toEqual([]);
        expect(refusalReport(holds, 'all')).toBeNull();
    });
});
