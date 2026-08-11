/**
 * `session:recycle` producer — validate + atomic write + resume instruction
 * (road-to-token-economy-recycling Phase 2.2).
 *
 * Pins: a valid envelope lands at the shared path with provenance filled
 * deterministically; an invalid one (prose field / missing required) is
 * REFUSED with the violations listed; the size cap refuses dumps; the
 * template parses and is itself invalid until filled (placeholders are not
 * silently valid content — they are, structurally, short lines, so the
 * template validates; what matters is that it round-trips through the
 * validator and the write path).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    parseArgv,
    runSessionRecycle,
    templateEnvelope,
} from '../../src/scripts/_cli/cmd_session_recycle.js';
import {
    RECYCLE_ENVELOPE_MAX_BYTES,
    RECYCLE_ENVELOPE_REL,
} from '../../src/scripts/_lib/recycle_envelope_paths.js';
import {
    CAPSULE_SCHEMA_VERSION,
    DECISION_REVERSIBILITY_TAGS,
    decisionTagErrors,
    validateRecycleEnvelope,
} from '../../src/scripts/_lib/subagent_capsule.js';

function scratch(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'session-recycle-'));
}

function minimalEnvelope(): Record<string, unknown> {
    return {
        summary: 'phase 2 landed, phase 3 open',
        task: 'close the roadmap and open one PR',
        acceptance_criteria: ['all boxes flipped', 'CI green'],
        remaining: ['phase 3'],
        not_carried_forward: ['diff bodies — re-read from the branch'],
        failed_approaches: ['tried a shallow scan — it missed the sidechain records'],
    };
}

describe('runSessionRecycle', () => {
    it('fills provenance, validates, writes atomically, prints the resume instruction', () => {
        const cwd = scratch();
        const result = runSessionRecycle(JSON.stringify(minimalEnvelope()), {
            cwd,
            now: new Date('2026-08-10T12:00:00.000Z'),
        });
        expect(result.err).toEqual([]);
        expect(result.code).toBe(0);

        const written = JSON.parse(
            fs.readFileSync(path.join(cwd, RECYCLE_ENVELOPE_REL), 'utf-8'),
        ) as Record<string, unknown>;
        expect(written['capsule_version']).toBe(CAPSULE_SCHEMA_VERSION);
        expect(written['variant']).toBe('main_session');
        expect(written['written_at']).toBe('2026-08-10T12:00:00.000Z');
        expect(typeof written['workspace']).toBe('string');
        expect(validateRecycleEnvelope(written)).toEqual([]);

        expect(result.out.join('\n')).toContain('/clear');
        expect(result.out.join('\n')).toContain('session_start');
    });

    it('refuses a prose-summary field, listing the violation', () => {
        const cwd = scratch();
        const bad = { ...minimalEnvelope(), transcript_summary: 'first we did X, then Y...' };
        const result = runSessionRecycle(JSON.stringify(bad), { cwd });
        expect(result.code).toBe(1);
        expect(result.err.join('\n')).toContain('transcript_summary');
        expect(fs.existsSync(path.join(cwd, RECYCLE_ENVELOPE_REL))).toBe(false);
    });

    it('refuses a missing required field', () => {
        const cwd = scratch();
        const bad = minimalEnvelope();
        delete bad['not_carried_forward'];
        const result = runSessionRecycle(JSON.stringify(bad), { cwd });
        expect(result.code).toBe(1);
        expect(result.err.join('\n')).toContain('not_carried_forward');
    });

    it('refuses an oversized envelope (selection, not dump)', () => {
        const cwd = scratch();
        const big = {
            ...minimalEnvelope(),
            // 40 near-cap single lines are legal per-field but overflow the byte cap.
            decisions: Array.from({ length: 40 }, (_, i) => `decision ${i} — ${'x'.repeat(200)}`),
        };
        const result = runSessionRecycle(JSON.stringify(big), { cwd });
        expect(result.code).toBe(1);
        expect(result.err.join('\n')).toContain(`${RECYCLE_ENVELOPE_MAX_BYTES}`);
    });

    it('refuses non-JSON input', () => {
        const result = runSessionRecycle('not json', { cwd: scratch() });
        expect(result.code).toBe(1);
    });
});

describe('templateEnvelope + parseArgv', () => {
    it('the template validates once its placeholders are structurally sound', () => {
        expect(validateRecycleEnvelope({ ...templateEnvelope(), workspace: '/x', written_at: '2026-08-10T00:00:00Z' })).toEqual([]);
    });

    it('parses --file and --template; rejects unknown flags', () => {
        expect(parseArgv(['--file', 'x.json'])).toEqual({ ok: true, file: 'x.json' });
        expect(parseArgv(['--template'])).toEqual({ ok: true, template: true });
        expect(parseArgv(['--nope']).ok).toBe(false);
        expect(parseArgv(['--file']).ok).toBe(false);
    });

    it('carries do_not_touch as a discoverable, empty-by-default list', () => {
        const t = templateEnvelope();
        expect(t['do_not_touch']).toEqual([]);
        // The template must stay inside the envelope byte budget with the field on.
        expect(JSON.stringify(t).length).toBeLessThan(RECYCLE_ENVELOPE_MAX_BYTES);
    });
});

// The OPTIONAL trailing reversibility tag on a decision line. Absent is the
// default (no committed envelope is retroactively invalid); present-but-misspelled
// is the failure, because it reads as untagged and silently loses the distinction.
describe('decisions — the optional reversibility tag', () => {
    it('accepts an untagged line', () => {
        expect(decisionTagErrors(['kept the current API — callers are external'])).toEqual([]);
    });

    it.each(DECISION_REVERSIBILITY_TAGS)('accepts the exact tag [%s]', (tag) => {
        expect(decisionTagErrors([`chose A over B — cheaper [${tag}]`])).toEqual([]);
    });

    it.each(['[Reversible]', '[IRREVERSIBLE]'])('rejects wrong case: %s', (tag) => {
        expect(decisionTagErrors([`chose A ${tag}`]).join('\n')).toContain('lower-case');
    });

    it.each(['[reversble]', '[irreversible!]', '[reversible?]', '[irrevers]'])(
        'rejects a near-miss that would read as untagged: %s',
        (tag) => {
            expect(decisionTagErrors([`chose A ${tag}`]).join('\n')).toContain(
                'not a reversibility tag',
            );
        },
    );

    it.each(['[ADR-109]', '[see #1273]', '[wip]'])('leaves an unrelated bracket alone: %s', (tag) => {
        expect(decisionTagErrors([`chose A ${tag}`])).toEqual([]);
    });

    it('ignores a non-array and non-string entries rather than throwing', () => {
        expect(decisionTagErrors(undefined)).toEqual([]);
        expect(decisionTagErrors('not an array')).toEqual([]);
        expect(decisionTagErrors([42, null])).toEqual([]);
    });

    it('surfaces through the envelope validator, not only as a helper', () => {
        const errors = validateRecycleEnvelope({
            ...templateEnvelope(),
            workspace: '/x',
            written_at: '2026-08-10T00:00:00Z',
            decisions: ['chose A — cheaper [reversble]'],
        });
        expect(errors.join('\n')).toContain('not a reversibility tag');
    });

    it('the shipped template carries a valid tag', () => {
        expect(decisionTagErrors(templateEnvelope()['decisions'])).toEqual([]);
    });
});

// `do_not_touch` is a list of PATH REFS, so it takes the ref budget and its
// absence is not a claim that everything is writable. Every case is built from a
// valid envelope so the assertions isolate this one field.
describe('do_not_touch — a checkable off-limits list', () => {
    const base = (): Record<string, unknown> => ({
        ...templateEnvelope(),
        workspace: '/x',
        written_at: '2026-08-10T00:00:00Z',
    });

    it('accepts an absent field — nothing off limits is the common case', () => {
        const e = base();
        delete e['do_not_touch'];
        expect(validateRecycleEnvelope(e)).toEqual([]);
    });

    it('accepts real path refs', () => {
        expect(
            validateRecycleEnvelope({
                ...base(),
                do_not_touch: ['src/generated/api.ts', '../other-worktree/'],
            }),
        ).toEqual([]);
    });

    it('rejects a non-array', () => {
        expect(
            validateRecycleEnvelope({ ...base(), do_not_touch: 'src/generated/api.ts' }),
        ).not.toEqual([]);
    });

    it('rejects a ref past the ref budget', () => {
        const errors = validateRecycleEnvelope({ ...base(), do_not_touch: ['x'.repeat(4096)] });
        expect(errors.join('\n')).toContain('do_not_touch');
    });

    it('rejects an unknown sibling key, so the field cannot be typo-smuggled', () => {
        expect(validateRecycleEnvelope({ ...base(), dont_touch: ['x'] })).not.toEqual([]);
    });
});
