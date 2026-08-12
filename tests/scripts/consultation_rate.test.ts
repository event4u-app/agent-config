/**
 * `consultation_rate` — the measurable half of the pre-registered metrics.
 *
 * Four properties carry the weight:
 *
 *   1. ORDERING. A consultation counts only for writes that follow it. A
 *      session that opens `fe-design` after writing the component did not
 *      consult for that write, and a rate that said otherwise would report
 *      the failure it is supposed to detect as a success.
 *   2. NO NUDGE CAP IN THE DENOMINATOR. The nudge stops warning after two
 *      reminders per session; a denominator built on that would silently drop
 *      every UI write past the second one. This measures through the
 *      predicates, not through `decide`.
 *   3. SAME PREDICATES AS THE NUDGE. If the metric and the trigger drift, a
 *      later A/B compares two populations while looking like one.
 *   4. THE PROXY IS NOT THE DISCHARGE RATE, and the output says so in words a
 *      reader cannot mistake for the rate itself.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
    measureSession,
    measureStore,
    readSessionEvents,
    render,
    toolUseToEvent,
    type RateReport,
} from '../../src/scripts/report_consultation_rate.js';
import { MAX_NUDGES } from '../../src/scripts/hooks/ui_route_nudge_hook.js';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'consultation-rate-'));

afterAll(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
});

// Each helper defaults to its own turn, so a list of helpers reads as a list
// of turns. `turn` is passed explicitly where the point is two writes in ONE
// turn — the case that inflated the old part-counting denominator.
let nextTurn = 0;
const uiWrite = (file = 'src/components/Card.tsx', turn?: number) => ({
    event: { file, isWrite: true },
    turn: turn ?? nextTurn++,
});
const open = (file: string, turn?: number) => ({
    event: { file, isWrite: false },
    turn: turn ?? nextTurn++,
});

const FE_DESIGN = 'src/skills/fe-design/SKILL.md';
const REVIEW = 'src/skills/design-review/SKILL.md';

describe('measureSession — ordering', () => {
    it('counts a write after a consultation as consulted', () => {
        const m = measureSession([open(FE_DESIGN), uiWrite()]);

        expect(m).toMatchObject({ uiWriteTurns: 1, consulted: 1 });
    });

    it('does not let a later consultation excuse an earlier write', () => {
        const m = measureSession([uiWrite(), open(FE_DESIGN)]);

        expect(m).toMatchObject({ uiWriteTurns: 1, consulted: 0 });
    });

    it('counts every write in the session, not only the first', () => {
        const m = measureSession([uiWrite('a.vue'), uiWrite('b.vue'), open(FE_DESIGN), uiWrite('c.vue')]);

        expect(m).toMatchObject({ uiWriteTurns: 3, consulted: 1 });
    });
});

describe('measureSession — turns, not tool calls', () => {
    it('counts one turn that writes two UI files as ONE UI-write turn', () => {
        // The unit the pre-registered metric is stated in. Counting tool_use
        // parts inflates any turn that writes more than one file, and the
        // inflated number was published in the baseline and both blockers.
        const m = measureSession([uiWrite('a.vue', 7), uiWrite('b.tsx', 7)]);

        expect(m.uiWriteTurns).toBe(1);
    });

    it('counts two turns separately', () => {
        expect(measureSession([uiWrite('a.vue', 1), uiWrite('b.tsx', 2)]).uiWriteTurns).toBe(2);
    });

    it('credits a turn once even if consultation lands mid-turn', () => {
        const m = measureSession([uiWrite('a.vue', 3), open(FE_DESIGN, 3), uiWrite('b.tsx', 3)]);

        // One turn, and it was unconsulted when it first wrote.
        expect(m).toMatchObject({ uiWriteTurns: 1, consulted: 0 });
    });
});

describe('measureSession — the nudge cap must not reach the denominator', () => {
    it('counts UI writes past MAX_NUDGES', () => {
        const events = Array.from({ length: MAX_NUDGES + 5 }, (_, i) => uiWrite(`c${i}.tsx`));

        const m = measureSession(events);

        // Measuring through `decide` would stop at MAX_NUDGES.
        expect(m.uiWriteTurns).toBe(MAX_NUDGES + 5);
        expect(m.consulted).toBe(0);
    });
});

describe('measureSession — population', () => {
    it('ignores a non-UI write', () => {
        expect(measureSession([uiWrite('src/scripts/foo.ts')]).uiWriteTurns).toBe(0);
    });

    it('ignores a read of a UI file', () => {
        expect(measureSession([open('src/components/Card.tsx')]).uiWriteTurns).toBe(0);
    });

    it('does not latch on a path that merely contains a surface name', () => {
        const m = measureSession([open('src/rules/design-review-after-ui-write.md'), uiWrite()]);

        expect(m.consulted).toBe(0);
    });
});

describe('discharge proxy', () => {
    it('counts a write followed by opening the review skill', () => {
        const m = measureSession([uiWrite(), open(REVIEW)]);

        expect(m.reviewOpenedAfter).toBe(1);
    });

    it('does not count a review opened BEFORE the write', () => {
        const m = measureSession([open(REVIEW), uiWrite()]);

        expect(m.reviewOpenedAfter).toBe(0);
        // …though it does count as a consultation, which is a different fact.
        expect(m.consulted).toBe(1);
    });

    it('does not count opening a different design surface', () => {
        expect(measureSession([uiWrite(), open(FE_DESIGN)]).reviewOpenedAfter).toBe(0);
    });
});

describe('toolUseToEvent', () => {
    it('maps a Write tool call to a write event', () => {
        expect(toolUseToEvent({ name: 'Write', input: { file_path: 'a.vue' } })).toEqual({
            file: 'a.vue',
            isWrite: true,
        });
    });

    it('maps a Read tool call to a non-write event', () => {
        expect(toolUseToEvent({ name: 'Read', input: { file_path: 'a.vue' } })?.isWrite).toBe(false);
    });

    it('returns null for a tool call carrying no path', () => {
        expect(toolUseToEvent({ name: 'Bash', input: { command: 'ls' } })).toBeNull();
    });
});

describe('readSessionEvents + measureStore', () => {
    function writeTranscript(dir: string, name: string, calls: Array<[string, string]>): void {
        fs.mkdirSync(dir, { recursive: true });
        const lines = calls.map(([tool, file]) =>
            JSON.stringify({
                type: 'assistant',
                message: { content: [{ type: 'tool_use', name: tool, input: { file_path: file } }] },
            }),
        );
        // A user turn and a malformed line: both must be skipped, not crash.
        lines.splice(1, 0, JSON.stringify({ type: 'user', message: { content: 'hi' } }), '{not json');
        fs.writeFileSync(path.join(dir, name), `${lines.join('\n')}\n`);
    }

    it('reads tool calls in order and skips non-assistant and malformed lines', () => {
        const dir = path.join(TMP, 'store-a');
        writeTranscript(dir, 'a.jsonl', [
            ['Read', 'src/skills/fe-design/SKILL.md'],
            ['Write', 'src/components/Card.tsx'],
        ]);

        const events = readSessionEvents(path.join(dir, 'a.jsonl'));

        expect(events).toEqual([
            { event: { file: 'src/skills/fe-design/SKILL.md', isWrite: false }, turn: 0 },
            { event: { file: 'src/components/Card.tsx', isWrite: true }, turn: 1 },
        ]);
    });

    it('aggregates only sessions that contain a UI write', () => {
        const dir = path.join(TMP, 'store-b');
        writeTranscript(dir, 'ui.jsonl', [['Write', 'a.vue']]);
        writeTranscript(dir, 'nonui.jsonl', [['Write', 'src/scripts/x.ts']]);

        const report = measureStore(dir, 10);

        expect(report.sessions).toBe(2);
        expect(report.sessionsWithUiWrite).toBe(1);
        expect(report.uiWriteTurns).toBe(1);
    });

    it('returns an empty report for a store that does not exist', () => {
        expect(measureStore(path.join(TMP, 'nope'), 10).sessions).toBe(0);
    });
});

describe('render', () => {
    const report: RateReport = {
        store: '/somewhere',
        storeExists: true,
        sessions: 3,
        truncated: false,
        sessionsWithUiWrite: 2,
        uiWriteTurns: 4,
        consulted: 1,
        reviewOpenedAfter: 2,
    };

    it('reports the rate and marks the proxy as not the discharge rate', () => {
        const out = render(report, 20);

        expect(out).toContain('CONSULTATION RATE');
        expect(out).toContain('25.0%');
        expect(out).toContain('discharge PROXY');
        expect(out).toContain('not the discharge rate');
    });

    it('flags a corpus below the pre-registered floor as provisional', () => {
        expect(render(report, 20)).toContain('provisional');
    });

    it('drops the provisional warning once the floor is met', () => {
        expect(render({ ...report, sessionsWithUiWrite: 25 }, 20)).not.toContain('provisional');
    });

    it('does not print the scan root in the text form', () => {
        expect(render(report, 20)).not.toContain('/somewhere');
    });

    it('reports a missing store as a finding, not as a rate of zero', () => {
        // The failure class this repo has recorded four times: a scan that
        // found nothing reporting a clean number.
        const out = render({ ...report, storeExists: false }, 20);

        expect(out).toContain('not found');
        expect(out).toContain('not a rate of zero');
        expect(out).not.toContain('CONSULTATION RATE');
    });

    it('says n/a rather than dividing by zero', () => {
        expect(render({ ...report, uiWriteTurns: 0, consulted: 0, reviewOpenedAfter: 0 }, 20)).toContain(
            'n/a',
        );
    });
});
