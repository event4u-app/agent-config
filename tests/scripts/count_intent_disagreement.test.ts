// Tests for src/scripts/count_intent_disagreement.ts — step 2.0 of
// road-to-candidate-moves-floor.
//
// The counter publishes a null, so its FALSE-NEGATIVE behaviour is the thing
// that matters: a pattern that cannot see an emitted line reports that no line
// was emitted, and the mistake looks exactly like the finding. That is not
// hypothetical here — the first version borrowed the shipped `INTENT_RE`, which
// matches no markdown emphasis, and the paid treatment run of 2026-09-08 proved
// the gap by emitting its one compliant line as `**Candidates:**`.
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import { classify, contentWords, extract, overlap, REPO_ROOT, RESTATEMENT_OVERLAP } from '../../src/scripts/count_intent_disagreement.js';

function runCli(args: string[], stdin = ''): { code: number; stdout: string; stderr: string } {
    try {
        const stdout = execFileSync('./scripts-run', ['src/scripts/count_intent_disagreement', ...args], {
            cwd: REPO_ROOT,
            input: stdin,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return { code: 0, stdout, stderr: '' };
    } catch (e) {
        const err = e as { status?: number; stdout?: string; stderr?: string };
        return { code: err.status ?? 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
    }
}

const DISAGREE =
    'Intent: `parseDate` returns null on an empty string · the failing test expects a thrown `RangeError` · the spec says empty input is a caller error';
const RESTATE = 'Intent: the loader caches · the loader caches results · caching is done by the loader';

describe('emphasis tolerance — a counter must be wider than the gate it reports on', () => {
    it('sees a bold label', () => {
        expect(extract(`**Intent:** ${DISAGREE.slice(8)}`, 's')).toHaveLength(1);
    });

    it('sees the other emphasis forms, a blockquote and a list bullet', () => {
        const body = DISAGREE.slice(8);
        for (const form of [`__Intent__: ${body}`, `*Intent*: ${body}`, `> **Intent:** ${body}`, `- **Intent:** ${body}`]) {
            expect(extract(form, 's'), form.slice(0, 20)).toHaveLength(1);
        }
    });

    it('strips a trailing emphasis run so it is not counted as slot content', () => {
        const c = extract(`**Intent:** a · b · c**`, 's')[0];
        expect(c?.slots).toEqual(['a', 'b', 'c']);
    });
});

describe('classification', () => {
    it('separates three disagreeing slots from three that restate each other', () => {
        expect(classify(DISAGREE.slice(8), 's').klass).toBe('distinct');
        expect(classify(RESTATE.slice(8), 's').klass).toBe('restatement');
    });

    it('calls a line with fewer than three slots malformed', () => {
        expect(classify('only two slots here · nothing else', 's').klass).toBe('malformed');
    });

    it('publishes the overlap so a reader can recompute at another threshold', () => {
        const c = classify(RESTATE.slice(8), 's');
        expect(c.maxOverlap).toBeGreaterThanOrEqual(RESTATEMENT_OVERLAP);
        expect(classify(DISAGREE.slice(8), 's').maxOverlap).toBeLessThan(RESTATEMENT_OVERLAP);
    });

    it('scores an empty-vs-anything overlap as 0 rather than dividing by zero', () => {
        expect(overlap(contentWords('the a of'), contentWords('parser returns null'))).toBe(0);
    });
});

describe('fence stripping — the contract illustration is not an emission', () => {
    it('does not count a fenced example', () => {
        expect(extract(`~~~text\n${DISAGREE}\n~~~\n`, 's')).toEqual([]);
    });

    it('does count the same line outside a fence', () => {
        expect(extract(`${DISAGREE}\n`, 's')).toHaveLength(1);
    });
});

describe('CLI', () => {
    it('exits 2 on an empty population rather than reporting no disagreements', () => {
        // The load-bearing exit code. A rate over nothing is not a reading, and
        // a green exit here would read as "checked, none found".
        const r = runCli(['--stdin'], 'Fixed the parser. No line was emitted.\n');
        expect(r.code).toBe(2);
        expect(r.stderr).toMatch(/FINDING, not a tool failure/);
        // It must WARN against the misreading rather than merely avoid it: the
        // whole hazard is that an empty population reads as a clean result.
        expect(r.stderr).toMatch(/Do not read it as "no disagreements found"/);
    });

    it('exits 0 and reports the distribution on a non-empty population', () => {
        const r = runCli(['--stdin'], `Fixed it.\n\n${DISAGREE}\n${RESTATE}\n`);
        expect(r.code).toBe(0);
        expect(r.stdout).toMatch(/total: 2/);
        expect(r.stdout).toMatch(/restatement \(overlap >= 0\.6\): 1/);
        expect(r.stdout).toMatch(/distinct:\s+1/);
    });

    it('refuses when no source is selected rather than reading zero sources as clean', () => {
        expect(runCli(['--quiet']).code).toBe(1);
    });

    it('never reports a semantic disagreement rate it cannot compute', () => {
        const r = runCli(['--stdin'], `Fixed it.\n\n${DISAGREE}\n`);
        expect(r.stdout).toMatch(/`distinct` is not `disagree`/);
    });
});
