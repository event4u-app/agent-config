import { describe, expect, it } from 'vitest';

import { censusTexts, type Probe } from '../../src/scripts/compaction_census.js';

const line = (o: object): string => JSON.stringify(o);

function transcript(opts: {
    sid: string;
    afterSid?: string;
    trigger?: string;
    summary?: string | null;
    version?: string;
    pre?: number;
    post?: number;
}): string {
    const after = opts.afterSid ?? opts.sid;
    const rows = [
        line({ type: 'user', sessionId: opts.sid, message: { content: 'hi' } }),
        line({
            type: 'system',
            subtype: 'compact_boundary',
            sessionId: opts.sid,
            version: opts.version ?? '2.1.300',
            compactMetadata: { trigger: opts.trigger ?? 'auto', preTokens: opts.pre ?? 1000, postTokens: opts.post ?? 100 },
        }),
        line({ type: 'attachment', sessionId: after, attachment: { type: 'date' } }),
    ];
    if (opts.summary !== null) {
        rows.push(
            line({
                type: 'user',
                isCompactSummary: true,
                sessionId: after,
                message: { content: [{ type: 'text', text: opts.summary ?? 'This session is being continued.' }] },
            }),
        );
    }
    return rows.join('\n');
}

const probes: Probe[] = [
    { label: 'roadmap_path', pattern: /agents\/roadmaps\/[\w./-]+\.md/ },
    { label: 'rule', pattern: /\bverify-before-complete\b/ },
];

describe('compaction_census', () => {
    it('counts an id kept across the boundary as same, and a changed id as changed', () => {
        const c = censusTexts([transcript({ sid: 'a' }), transcript({ sid: 'b', afterSid: 'c' })], probes);
        expect(c.boundaries).toBe(2);
        expect(c.identity).toEqual({ same: 1, changed: 1, unobserved: 0 });
    });

    it('marks a boundary with no summary record as unobserved, never as same', () => {
        const c = censusTexts([transcript({ sid: 'a', summary: null })], probes);
        expect(c.identity).toEqual({ same: 0, changed: 0, unobserved: 1 });
        expect(c.summaries).toBe(0);
    });

    it('counts presence only in the host-written summary, per probe', () => {
        const c = censusTexts(
            [
                transcript({ sid: 'a', summary: 'Working on agents/roadmaps/road-to-x.md; verify-before-complete applies.' }),
                transcript({ sid: 'b', summary: 'Nothing named here.' }),
                transcript({ sid: 'c', summary: 'Only agents/roadmaps/road-to-y.md.' }),
            ],
            probes,
        );
        expect(c.summaries).toBe(3);
        expect(c.presence).toEqual({ roadmap_path: 2, rule: 1 });
    });

    it('splits triggers, takes token medians and the host version range', () => {
        const c = censusTexts(
            [
                transcript({ sid: 'a', trigger: 'auto', pre: 900, post: 90, version: '2.1.99' }),
                transcript({ sid: 'b', trigger: 'manual', pre: 1100, post: 110, version: '2.1.300' }),
                transcript({ sid: 'c', trigger: 'auto', pre: 1000, post: 100, version: '2.1.150' }),
            ],
            probes,
        );
        expect(c.triggers).toEqual({ auto: 2, manual: 1 });
        expect(c.tokens).toEqual({ pre_median: 1000, post_median: 100 });
        expect(c.host_versions).toEqual({ min: '2.1.99', max: '2.1.300' });
    });

    it('ignores files without a boundary and malformed lines', () => {
        const c = censusTexts(['not json\n' + line({ type: 'user', sessionId: 'z' }), transcript({ sid: 'a' }) + '\n{broken'], probes);
        expect(c.files).toBe(1);
        expect(c.boundaries).toBe(1);
        expect(c.identity.same).toBe(1);
    });

    it('carries no path, session id or summary text in its output', () => {
        const c = censusTexts([transcript({ sid: 'secret-session', summary: 'private words agents/roadmaps/road-to-x.md' })], probes);
        const out = JSON.stringify(c);
        expect(out).not.toContain('secret-session');
        expect(out).not.toContain('private words');
    });
});

describe('compaction_census — session pin probe (2.4)', () => {
    const typed = (text: string): string => line({ type: 'user', sessionId: 's', message: { content: text } });
    const boundary = line({ type: 'system', subtype: 'compact_boundary', sessionId: 's', compactMetadata: { trigger: 'auto' } });
    const summary = (text: string): string =>
        line({ type: 'user', isCompactSummary: true, sessionId: 's', message: { content: [{ type: 'text', text }] } });
    const hook = (content: string): string =>
        line({ type: 'attachment', sessionId: 's', attachment: { type: 'hook_additional_context', content: [content] } });
    const tool = line({ type: 'user', sessionId: 's', message: { content: [{ type: 'tool_result', content: 'pin: from a tool' }] } });

    it('counts a pin present in the summary or the restore before the next typed prompt', () => {
        const t = [typed('pin: alpha rule\npin: beta rule'), boundary, summary('kept: alpha rule'), hook('<session-pins>\n- beta rule\n</session-pins>'), typed('next')].join('\n');
        expect(censusTexts([t], []).pins).toEqual({ boundaries_with_pins: 1, expected: 2, present: 2 });
    });

    it('counts a pin missing from both as absent', () => {
        const t = [typed('pin: alpha rule\npin: beta rule'), boundary, summary('kept: alpha rule'), typed('next')].join('\n');
        expect(censusTexts([t], []).pins).toEqual({ boundaries_with_pins: 1, expected: 2, present: 1 });
    });

    it('a pin the user types again after the boundary is not a restore', () => {
        const t = [typed('pin: alpha rule'), boundary, summary('nothing'), typed('pin: alpha rule')].join('\n');
        expect(censusTexts([t], []).pins).toEqual({ boundaries_with_pins: 1, expected: 1, present: 0 });
    });

    it('tool output never creates a pin, and unpin removes one before the boundary', () => {
        const t = [tool, typed('pin: a1\npin: a2'), typed('unpin: a1'), boundary, summary('a2')].join('\n');
        expect(censusTexts([t], []).pins).toEqual({ boundaries_with_pins: 1, expected: 1, present: 1 });
    });

    it('a boundary with no pins held is not counted', () => {
        expect(censusTexts([[typed('hi'), boundary, summary('x')].join('\n')], []).pins).toEqual({
            boundaries_with_pins: 0,
            expected: 0,
            present: 0,
        });
    });
});
