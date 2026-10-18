import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as gate from '../../src/scripts/check_kernel_edit_ratified.js';
import {
    ESCALATION_HEADING,
    escalationMessage,
    SELF_PATH,
} from '../../src/scripts/check_kernel_edit_ratified.js';
import { RATIFICATION_DIR } from '../../src/scripts/_lib/ratification_artifact.js';
import { commitAll } from './ratification_git_fixture.js';

/**
 * Step 5.2 of `road-to-self-modification-that-a-council-must-pass`: when the
 * user decides, the gate's output carries the one question the contract names
 * — the council's verdict, the per-seat dissent, the exact change, and an ask
 * for the expected gain, the risk and the rollback, which the gate does not
 * know and does not guess.
 *
 * Every firing case has a polarity partner: an authoring defect (no record, a
 * self-ratified record, a stale subject) is not the owner's question, and a
 * passing record over an ordinary gated surface needs no escalation at all.
 */

let root: string;

const KERNEL = 'src/rules/commit-policy.md';

const GOOD = {
    proposed_by: 'claude/session-a',
    implemented_by: 'claude/session-a',
    reviewed_by: 'ai-council',
    verdict: 'ratified',
    effective_after: 'merge',
};

function evaluate(files: readonly string[], providers: number | null = 2): gate.GateResult {
    commitAll(root);
    return gate.evaluate(files, root, providers);
}

function subjectFor(gated: readonly string[]): string {
    commitAll(root);
    return gate.expectedSubjectFor(gated, root).digest;
}

function writeRecord(
    name: string,
    fields: Record<string, string>,
    seats: Record<string, string>,
    gated: readonly string[] = [KERNEL],
    subject: string = subjectFor(gated),
): string {
    const rel = path.join(RATIFICATION_DIR, name);
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const lines = ['---'];
    for (const [k, v] of Object.entries(fields)) {
        lines.push(`${k}: ${v}`);
    }
    lines.push(`subject: ${subject}`, 'providers:');
    for (const p of Object.keys(seats)) {
        lines.push(`  - ${p}`);
    }
    lines.push('seats:');
    for (const [p, v] of Object.entries(seats)) {
        lines.push(`  ${p}: ${v}`);
    }
    lines.push('---', '', '<!-- evidence-type: ratification -->', '', 'Review body.', '');
    fs.writeFileSync(abs, lines.join('\n'));
    return rel;
}

function text(r: gate.GateResult): string {
    return r.lines.join('\n');
}

const BOTH_RATIFIED = { anthropic: 'ratified', openai: 'ratified' };

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ker-esc-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('escalationMessage — the shape of the one question', () => {
    const msg = escalationMessage({
        triggers: ['refused'],
        records: [
            {
                path: `${RATIFICATION_DIR}/x.md`,
                verdict: 'refused',
                seats: { anthropic: 'ratified', openai: 'refused' },
            },
        ],
        gatedPaths: [KERNEL],
    }).join('\n');

    it('fills in what the gate knows: the verdict, the dissent and the exact change', () => {
        expect(msg).toContain(ESCALATION_HEADING);
        expect(msg).toContain('verdict: refused');
        expect(msg).toContain('openai: refused');
        expect(msg).toContain(KERNEL);
    });

    it('asks for gain, risk and rollback instead of inventing them', () => {
        for (const ask of ['expected gain', 'risk', 'rollback']) {
            expect(msg).toContain(ask);
        }
        expect(msg).toContain('this gate does not know');
        expect(msg).toContain(`${RATIFICATION_DIR}/x.md`);
    });

    it('names only dissenting seats as dissent', () => {
        expect(msg).not.toContain('anthropic: ratified');
    });

    it('is empty when nothing triggers it', () => {
        expect(escalationMessage({ triggers: [], records: [], gatedPaths: [KERNEL] })).toEqual([]);
    });
});

describe('evaluate — when the user decides, the gate says so', () => {
    it('a `refused` record escalates and still fails', () => {
        const rel = writeRecord(
            'r.md',
            { ...GOOD, verdict: 'refused' },
            { anthropic: 'refused', openai: 'refused' },
        );
        const r = evaluate([KERNEL, rel]);
        expect(r.exitCode).toBe(1);
        expect(text(r)).toContain(ESCALATION_HEADING);
        expect(text(r)).toContain('verdict: refused');
    });

    it('a `non-convergent` record escalates and still fails', () => {
        const rel = writeRecord(
            'n.md',
            { ...GOOD, verdict: 'non-convergent' },
            { anthropic: 'non-convergent', openai: 'non-convergent' },
        );
        const r = evaluate([KERNEL, rel]);
        expect(r.exitCode).toBe(1);
        expect(text(r)).toContain(ESCALATION_HEADING);
        expect(text(r)).toContain('verdict: non-convergent');
    });

    it('diversity short of the required count escalates and still fails', () => {
        const rel = writeRecord('d.md', GOOD, { anthropic: 'ratified' });
        const r = evaluate([KERNEL, rel]);
        expect(r.exitCode).toBe(1);
        expect(text(r)).toContain(ESCALATION_HEADING);
        expect(text(r)).toContain('provider diversity');
    });

    it('a change to the reviewer escalates even on a passing record, exit unchanged', () => {
        const rel = writeRecord('s.md', GOOD, BOTH_RATIFIED, [SELF_PATH]);
        const r = evaluate([SELF_PATH, rel]);
        expect(r.exitCode).toBe(0);
        expect(text(r)).toContain(ESCALATION_HEADING);
        expect(text(r)).toContain('the reviewer itself');
    });

    it('polarity: a passing record over an ordinary gated surface does not escalate', () => {
        const rel = writeRecord('ok.md', GOOD, BOTH_RATIFIED);
        const r = evaluate([KERNEL, rel]);
        expect(r.exitCode).toBe(0);
        expect(text(r)).not.toContain(ESCALATION_HEADING);
    });

    it('polarity: a missing record is an authoring defect, not the owner question', () => {
        const r = evaluate([KERNEL]);
        expect(r.exitCode).toBe(1);
        expect(text(r)).not.toContain(ESCALATION_HEADING);
    });

    it('polarity: a self-ratified record is an authoring defect, not the owner question', () => {
        const rel = writeRecord(
            'self.md',
            { ...GOOD, proposed_by: 'x', implemented_by: 'x', reviewed_by: 'x' },
            BOTH_RATIFIED,
        );
        const r = evaluate([KERNEL, rel]);
        expect(r.exitCode).toBe(1);
        expect(text(r)).not.toContain(ESCALATION_HEADING);
    });

    it('polarity: a stale subject is an authoring defect, not the owner question', () => {
        const rel = writeRecord(
            'stale.md',
            { ...GOOD, verdict: 'refused' },
            { anthropic: 'refused', openai: 'refused' },
            [KERNEL],
            '0'.repeat(64),
        );
        const r = evaluate([KERNEL, rel]);
        expect(r.exitCode).toBe(1);
        expect(text(r)).not.toContain(ESCALATION_HEADING);
    });
});
