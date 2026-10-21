import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as gate from '../../src/scripts/check_kernel_edit_ratified.js';
import {
    ESCALATION_HEADING,
    escalationMessage,
    isMechanismPath,
    printable,
    SELF_PATH,
    UNPRINTABLE_RE,
} from '../../src/scripts/check_kernel_edit_ratified.js';
import { classifyChanges } from '../../src/scripts/classify_merge_risk.js';
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

    it('says it is advisory, that no CI check enforces it, and whose the merge is', () => {
        expect(msg).toContain('advisory');
        expect(msg).toContain('no CI check enforces it');
        expect(msg).toContain('ADR-281 § 5');
        expect(msg).toContain('needs-owner');
    });

    it('holds records, seats and paths to ONE item budget, counting what it does not list', () => {
        const seats = Object.fromEntries(
            Array.from({ length: gate.ESCALATION_ITEM_MAX }, (_, i) => [`s${i}`, 'refused']),
        );
        const records = Array.from({ length: gate.ESCALATION_ITEM_MAX }, (_, i) => ({
            path: `r${i}.md`,
            verdict: 'refused',
            seats,
        }));
        const paths = Array.from({ length: gate.ESCALATION_ITEM_MAX }, (_, i) => `p/${i}.md`);
        const out = escalationMessage({ triggers: ['refused'], records, gatedPaths: paths });
        const total = records.length * (1 + gate.ESCALATION_ITEM_MAX) + 1 + paths.length;
        // heading block (blank, heading, advisory, one trigger) + budget + the count line + the ask
        expect(out.length).toBe(4 + gate.ESCALATION_ITEM_MAX + 2);
        expect(out.join('\n')).toContain(`… ${total - gate.ESCALATION_ITEM_MAX} more item(s) not listed`);
        expect(out[1]).toBe(ESCALATION_HEADING);
        expect(out.at(-1)).toContain('this gate does not know');
    });

    it('clips a field to its first code points before escaping it, and says how much', () => {
        const long = '\u0007'.repeat(gate.ESCALATION_FIELD_MAX * 5);
        const out = escalationMessage({
            triggers: ['refused'],
            records: [{ path: 'r.md', verdict: long, seats: { openai: 'refused' } }],
            gatedPaths: [KERNEL],
        });
        const verdictLine = out.find((l) => l.includes('verdict:')) ?? '';
        expect(verdictLine.split('\\u{7}').length - 1).toBe(gate.ESCALATION_FIELD_MAX);
        expect(verdictLine).toContain(`${gate.ESCALATION_FIELD_MAX * 4} more characters`);
    });

    // Chosen from OUTSIDE the implementation's own list: C0, DEL, C1, the
    // Arabic letter mark, the line and paragraph separators, an embedding, an
    // override, every isolate, a zero-width joiner and a BOM.
    const ADVERSARIAL = [
        0x0a, 0x0d, 0x1b, 0x7f, 0x85, 0x9b, 0x061c, 0x200b, 0x200d, 0x200e, 0x2028, 0x2029,
        0x202a, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069, 0xfeff,
    ];

    it('never emits a control, format or separator character from a record field', () => {
        for (const cp of ADVERSARIAL) {
            const c = String.fromCodePoint(cp);
            const out = escalationMessage({
                triggers: ['refused'],
                records: [
                    { path: `r${c}.md`, verdict: `refused${c}`, seats: { [`o${c}`]: 'refused' } },
                ],
                gatedPaths: [`a${c}b`],
            });
            for (const line of out) {
                expect(line.includes(c), `U+${cp.toString(16)} leaked`).toBe(false);
            }
            expect(printable(c)).toBe(`\\u{${cp.toString(16)}}`);
        }
        // The checked set is the whole class, not only the sample above.
        for (let cp = 0; cp <= 0x10ffff; cp += 1) {
            if (cp >= 0xd800 && cp <= 0xdfff) continue;
            const c = String.fromCodePoint(cp);
            UNPRINTABLE_RE.lastIndex = 0;
            if (UNPRINTABLE_RE.test(c)) {
                expect(printable(c).includes(c)).toBe(false);
            }
        }
    });

    it('leaves ordinary text, including non-Latin letters, alone', () => {
        expect(printable('agents/evidence/ratifications/x.md')).toBe(
            'agents/evidence/ratifications/x.md',
        );
        expect(printable('Größe — العربية')).toBe('Größe — العربية');
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

    it('polarity: on the reviewer too, a missing record is an authoring defect', () => {
        const r = evaluate([SELF_PATH]);
        expect(r.exitCode).toBe(1);
        expect(text(r)).not.toContain(ESCALATION_HEADING);
    });

    it('polarity: on the reviewer too, a stale subject is an authoring defect', () => {
        const rel = writeRecord('ss.md', GOOD, BOTH_RATIFIED, [SELF_PATH], '0'.repeat(64));
        const r = evaluate([SELF_PATH, rel]);
        expect(r.exitCode).toBe(1);
        expect(text(r)).not.toContain(ESCALATION_HEADING);
    });

    it('polarity: on the reviewer too, a self-ratified record is an authoring defect', () => {
        const rel = writeRecord(
            'sx.md',
            { ...GOOD, proposed_by: 'x', implemented_by: 'x', reviewed_by: 'x' },
            BOTH_RATIFIED,
            [SELF_PATH],
        );
        const r = evaluate([SELF_PATH, rel]);
        expect(r.exitCode).toBe(1);
        expect(text(r)).not.toContain(ESCALATION_HEADING);
    });

    it('a refused record on the reviewer names both triggers', () => {
        const rel = writeRecord(
            'sr.md',
            { ...GOOD, verdict: 'refused' },
            { anthropic: 'refused', openai: 'refused' },
            [SELF_PATH],
        );
        const r = evaluate([SELF_PATH, rel]);
        expect(r.exitCode).toBe(1);
        expect(text(r)).toContain('the reviewer itself');
        expect(text(r)).toContain('a seat refused the change');
    });

    it('a `confirmed-non-expanding` record on the reviewer escalates too (passing or not)', () => {
        const rel = writeRecord(
            'sc.md',
            { ...GOOD, verdict: 'confirmed-non-expanding' },
            { anthropic: 'confirmed-non-expanding', openai: 'confirmed-non-expanding' },
            [SELF_PATH],
        );
        const r = evaluate([SELF_PATH, rel]);
        expect(r.exitCode).toBe(0);
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

describe('the /pr:merge classifier routes every mechanism path needs-owner', () => {
    // Iterates `MECHANISM_PATHS`, the list `isMechanismPath` decides by, so a
    // path added to the mechanism is covered here without an edit to this test.
    const changes = (p: string) => [
        { status: 'M', path: p },
        { status: 'A', path: p },
        { status: 'D', path: p },
        { status: 'R', oldPath: p, path: 'src/elsewhere/renamed.ts' },
        { status: 'R', oldPath: 'src/elsewhere/renamed.ts', path: p },
    ];

    it('every mechanism path is needs-owner at merge, modified, added, deleted or renamed', () => {
        expect(gate.MECHANISM_PATHS.length).toBeGreaterThan(0);
        for (const p of gate.MECHANISM_PATHS) {
            expect(isMechanismPath(p), p).toBe(true);
            for (const change of changes(p)) {
                const verdict = classifyChanges([change], {
                    dirExistsInHead: () => true,
                    decisionPolicy: () => 'other',
                    consequenceMembers: new Set(),
                }).verdict;
                expect(verdict, `${change.status} ${p}`).toBe('needs-owner');
            }
        }
    });

    it('polarity: a path outside the mechanism is not in the list', () => {
        expect(isMechanismPath('README.md')).toBe(false);
    });
});

describe('main — the question reaches the log that decides', () => {
    /**
     * The GitHub workflow runs this gate WITHOUT `--quiet`, so that is the log
     * the question must reach, and these cases read what `main` WROTE rather
     * than what `evaluate` returned. `--quiet` keeps its contract — a passing
     * run prints no report — for the local `task` pipeline and any other
     * caller that relies on it.
     */
    function runMain(files: readonly string[], quiet: boolean): { code: number; out: string } {
        const writes: string[] = [];
        const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
            writes.push(String(chunk));
            return true;
        });
        const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
        try {
            const head = commitAll(root, 'change');
            const code = gate.main([
                ...(quiet ? ['--quiet'] : []),
                '--root',
                root,
                '--rev',
                head,
                '--base-ref',
                `${head}~1`,
                '--files',
                ...files,
            ]);
            return { code, out: writes.join('') };
        } finally {
            spy.mockRestore();
            errSpy.mockRestore();
        }
    }

    beforeEach(() => {
        fs.writeFileSync(path.join(root, 'README.md'), 'base\n');
        commitAll(root, 'base');
    });

    it('a passing record over the mechanism prints the question, exit 0, as the workflow runs it', () => {
        const rel = writeRecord('q.md', GOOD, BOTH_RATIFIED, [SELF_PATH]);
        const r = runMain([SELF_PATH, rel], false);
        expect(r.code).toBe(0);
        expect(r.out).toContain(ESCALATION_HEADING);
        expect(r.out).toContain('the reviewer itself');
    });

    it('--quiet keeps its contract: a passing run prints no report, the question included', () => {
        const rel = writeRecord('qq.md', GOOD, BOTH_RATIFIED, [SELF_PATH]);
        const r = runMain([SELF_PATH, rel], true);
        expect(r.code).toBe(0);
        expect(r.out).not.toContain(ESCALATION_HEADING);
        expect(r.out).not.toContain('ratified by');
    });

    it('polarity: a passing record over an ordinary gated surface prints no question', () => {
        const rel = writeRecord('qk.md', GOOD, BOTH_RATIFIED);
        const r = runMain([KERNEL, rel], false);
        expect(r.code).toBe(0);
        expect(r.out).toContain('ratified by');
        expect(r.out).not.toContain(ESCALATION_HEADING);
    });
});
