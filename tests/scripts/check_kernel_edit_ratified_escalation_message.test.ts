import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { escalationMessage, evaluate } from '../../src/scripts/check_kernel_edit_ratified.js';
import { RATIFICATION_DIR } from '../../src/scripts/_lib/ratification_artifact.js';
import { expectedSubjectFor } from '../../src/scripts/check_kernel_edit_ratified.js';

/**
 * Step 5.2 — the stop has a shape.
 *
 * Where a council cannot settle a gated change, the run ends with the change
 * open and labelled, the non-passing record in it, and ONE question for the
 * user carrying six things: the council's recommendation, the dissent, the
 * exact change, what it is expected to gain, what it risks, and how it is
 * undone.
 *
 * The three the gate cannot know are the ones most worth pinning. A stop that
 * printed a plausible "expected gain" the gate never computed would be the
 * failure the whole mechanism exists to prevent, arriving through the help
 * text — so the cases below assert that those three are ASKED FOR and sourced,
 * never filled in.
 */

let root: string;

const KERNEL = 'src/rules/commit-policy.md';
const REVIEWER = 'src/scripts/ai_council/modification_review.ts';

function write(rel: string, body: string): void {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
}

function record(
    name: string,
    gated: readonly string[],
    seats: Record<string, string>,
    verdict: string,
    providers = Object.keys(seats),
): string {
    const rel = path.join(RATIFICATION_DIR, name);
    write(
        rel,
        [
            '---',
            'proposed_by: claude/session-a',
            'implemented_by: claude/session-a',
            'reviewed_by: council/anthropic+openai',
            `subject: ${expectedSubjectFor(gated, root)}`,
            `verdict: ${verdict}`,
            'effective_after: merge',
            'providers:',
            ...providers.map((p) => `  - ${p}`),
            'seats:',
            ...Object.entries(seats).map(([p, v]) => `  ${p}: ${v}`),
            '---',
            '',
            'Review body.',
            '',
        ].join('\n'),
    );
    return rel;
}

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'escal-'));
    write(KERNEL, 'the rule under review\n');
    write(REVIEWER, 'export const x = 1;\n');
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('the six things the question carries', () => {
    const lines = (): string =>
        escalationMessage({
            artifact: 'agents/evidence/ratifications/x.md',
            verdict: 'non-convergent',
            seats: new Map([
                ['anthropic', 'ratified'],
                ['openai', 'no-final-verdict'],
            ]),
            touched: ['kernel rule src/rules/commit-policy.md'],
            reviewerSurface: false,
        }).join('\n');

    it('1 — the council’s recommendation, by its verdict', () => {
        expect(lines()).toContain('`non-convergent`');
    });

    it('2 — the dissent, per seat', () => {
        expect(lines()).toContain('openai');
        expect(lines()).toContain('no-final-verdict');
    });

    it('3 — the exact change, path by path', () => {
        expect(lines()).toContain('src/rules/commit-policy.md');
    });

    it('4, 5 and 6 are ASKED FOR, and sourced, never invented', () => {
        const out = lines();
        expect(out).toContain('expected to gain');
        expect(out).toContain('what it risks');
        expect(out).toContain('how it is undone');
        // The honesty clause: the gate says it does not know them.
        expect(out).toContain('does not know them and will not guess');
        expect(out).toContain('agents/evidence/ratifications/x.md');
    });

    it('names the owner route, and refuses a chat answer by name', () => {
        expect(lines()).toContain('The owner-permission-route');
        expect(lines()).toContain('A chat answer is not');
    });

    it('a change to the reviewer itself says the owner decides it regardless', () => {
        const out = escalationMessage({
            artifact: null,
            verdict: 'no record',
            seats: new Map(),
            touched: [],
            reviewerSurface: true,
        }).join('\n');
        expect(out).toContain('edits the reviewing mechanism itself');
        expect(out).toContain('condition 4');
        // With no record there is nowhere to read the last three from, and it
        // says so rather than naming a file that does not exist.
        expect(out).toContain('no record was written');
    });
});

describe('when the gate emits it, and when it does not', () => {
    it('emits it on a `non-convergent` record', () => {
        // Seats that genuinely DERIVE `non-convergent`: the reader requires the
        // recorded header to equal the derived one, so a record cannot simply
        // claim the verdict its author wants to test.
        const rel = record('nc.md', [KERNEL], { anthropic: 'non-convergent', openai: 'ratified' }, 'non-convergent');
        const r = evaluate([KERNEL, rel], root, 2);
        expect(r.exitCode).toBe(1);
        expect(r.lines.join('\n')).toContain('could not settle this change');
    });

    it('emits it on a `refused` record', () => {
        const rel = record('ref.md', [KERNEL], { anthropic: 'refused', openai: 'refused' }, 'refused');
        const r = evaluate([KERNEL, rel], root, 2);
        expect(r.exitCode).toBe(1);
        expect(r.lines.join('\n')).toContain('could not settle this change');
    });

    it('emits it when provider diversity is short of the required count', () => {
        const rel = record('one.md', [KERNEL], { anthropic: 'ratified' }, 'ratified');
        const r = evaluate([KERNEL, rel], root, 2);
        expect(r.exitCode).toBe(1);
        expect(r.lines.join('\n')).toContain('provider diversity unavailable');
    });

    it('emits it for a change to the reviewing mechanism, record or not', () => {
        const r = evaluate([REVIEWER], root, 2);
        expect(r.exitCode).toBe(1);
        expect(r.lines.join('\n')).toContain('edits the reviewing mechanism itself');
    });

    it('does NOT emit it for a plain missing record on an ordinary kernel edit', () => {
        // The polarity partner, and the one that matters most: an authoring
        // defect is the author's to fix, and routing it to the owner would
        // spend the escalation on work nobody needs the owner for.
        const r = evaluate([KERNEL], root, 2);
        expect(r.exitCode).toBe(1);
        expect(r.lines.join('\n')).not.toContain('could not settle this change');
    });

    it('does NOT emit it for a malformed or stale record', () => {
        const stale = record('stale.md', [KERNEL], { anthropic: 'ratified', openai: 'ratified' }, 'ratified');
        write(KERNEL, 'edited after the review\n');
        const r = evaluate([KERNEL, stale], root, 2);
        expect(r.exitCode).toBe(1);
        expect(r.lines.join('\n')).not.toContain('could not settle this change');
    });

    it('does NOT emit it when the diff passes', () => {
        const rel = record('ok.md', [KERNEL], { anthropic: 'ratified', openai: 'ratified' }, 'ratified');
        const r = evaluate([KERNEL, rel], root, 2);
        expect(r.exitCode, r.lines.join('\n')).toBe(0);
        expect(r.lines.join('\n')).not.toContain('could not settle this change');
    });
});
