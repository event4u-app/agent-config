// The host-emitted-event denominator — record contract, reconstruction rules,
// windowing, and the manifest binding the published table depends on.
//
// `road-to-journal-host-capture-measurement` Phase 2 step 2.1 and AC-2. Every
// fixture here is inline: the measurement itself reads the maintainer's
// `~/.claude/projects`, which is not reproducible anywhere else, so the RULES
// are tested against fixtures and only the numbers come from the machine.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { FREE_FORM_KEYS } from '../../src/scripts/_lib/runtime_journal.js';
import {
    accumulate,
    COUNTED_EVENTS,
    countTranscript,
    DENOMINATOR_RECORD_KEYS,
    DenominatorContractError,
    emptyDenominator,
    findTranscripts,
    JOURNAL_BOUND_COUNTED_EVENTS,
    RECONSTRUCTION_RULE_VERSION,
    RECONSTRUCTION_RULES,
    STOP_CANDIDATES,
    totalCountedEvents,
    totalJournalBoundEvents,
    validateDenominator,
} from '../../src/scripts/_lib/host_denominator.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('the denominator record contract (AC-2)', () => {
    it('binds the committed key set to the record in both directions', () => {
        const record = emptyDenominator('2026-07-30', '2026-08-29');
        expect(Object.keys(record).sort()).toEqual([...DENOMINATOR_RECORD_KEYS].sort());
    });

    it('REJECTS an unknown field rather than dropping it', () => {
        const record: Record<string, unknown> = {
            ...emptyDenominator('2026-07-30', '2026-08-29'),
            project_slug: 'anything',
        };
        expect(() => validateDenominator(record)).toThrow(DenominatorContractError);
        expect(() => validateDenominator(record)).toThrow(
            /unknown field 'project_slug' — REJECTED, not dropped/,
        );
    });

    it('refuses a missing field', () => {
        const record: Record<string, unknown> = { ...emptyDenominator('2026-07-30', '2026-08-29') };
        delete record.post_tool_use;
        expect(() => validateDenominator(record)).toThrow(/missing field 'post_tool_use'/);
    });

    // The COMPILE-TIME half of the same guard is `_RecordCarriesNoFreeFormField`
    // in the module, which reuses the journal's own `NoFreeForm`. This is its
    // runtime mirror, and it is a real assertion rather than a restatement: it
    // catches a key added to DENOMINATOR_RECORD_KEYS that the type does not
    // carry, which the type-level guard cannot see.
    //
    // removing_this_constraint_reds_it: adding `payload: number` to
    // `HostDenominator` and to DENOMINATOR_RECORD_KEYS reds this test AND makes
    // `tsc --noEmit` fail on `_RecordCarriesNoFreeFormField`.
    it('carries no free-form key, on the numerator record’s own list', () => {
        const forbidden = new Set<string>(FREE_FORM_KEYS as readonly string[]);
        for (const key of DENOMINATOR_RECORD_KEYS) {
            expect(forbidden.has(key), `'${key}' is a free-form key`).toBe(false);
        }
    });

    it('refuses a per-second timestamp where a calendar date belongs', () => {
        const record: Record<string, unknown> = {
            ...emptyDenominator('2026-07-30', '2026-08-29'),
            window_start: '2026-07-30T11:22:33.000Z',
        };
        expect(() => validateDenominator(record)).toThrow(
            /must be an ISO calendar date .* reconstructs working hours/s,
        );
    });

    it('refuses a negative or fractional count', () => {
        for (const bad of [-1, 1.5]) {
            const record: Record<string, unknown> = {
                ...emptyDenominator('2026-07-30', '2026-08-29'),
                session_start: bad,
            };
            expect(() => validateDenominator(record)).toThrow(/non-negative integer/);
        }
    });

    it('refuses a platform other than claude', () => {
        const record: Record<string, unknown> = {
            ...emptyDenominator('2026-07-30', '2026-08-29'),
            platform: 'cursor',
        };
        expect(() => validateDenominator(record)).toThrow(/only cell set/);
    });
});

describe('the reconstruction rules, pinned at v1', () => {
    it('states a rule for every counted event', () => {
        for (const event of COUNTED_EVENTS) {
            expect(RECONSTRUCTION_RULES[event], `no rule stated for ${event}`).toBeTruthy();
        }
        expect(RECONSTRUCTION_RULE_VERSION).toBe(1);
    });

    it('counts a user prompt only when the record carries no tool_result', () => {
        const counts = countTranscript([
            { type: 'user', timestamp: '2026-08-10T00:00:00Z', message: { content: 'hello' } },
            {
                type: 'user',
                message: { content: [{ type: 'tool_result', tool_use_id: 'x' }] },
            },
            { type: 'user', message: { content: [{ type: 'text', text: 'a real prompt' }] } },
        ]);
        expect(counts.user_prompt_submit).toBe(2);
        expect(counts.first_at).toBe('2026-08-10T00:00:00Z');
    });

    it('REFINEMENT 1 — excludes an injected meta record from user prompts', () => {
        const counts = countTranscript([
            { type: 'user', isMeta: true, message: { content: 'system reminder' } },
            { type: 'user', message: { content: 'a real prompt' } },
        ]);
        expect(counts.user_prompt_submit).toBe(1);
        expect(counts.excluded_meta_user_records).toBe(1);
    });

    it('REFINEMENT 2 — excludes a sidechain record from user prompts', () => {
        const counts = countTranscript([
            { type: 'user', isSidechain: true, message: { content: 'subagent brief' } },
            { type: 'user', message: { content: 'a real prompt' } },
        ]);
        expect(counts.user_prompt_submit).toBe(1);
        expect(counts.excluded_sidechain_user_records).toBe(1);
    });

    it('counts one tool_use block per block, and Agent/Task blocks as a subset', () => {
        const counts = countTranscript([
            {
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: 'ok' },
                        { type: 'tool_use', name: 'Bash' },
                        { type: 'tool_use', name: 'Task' },
                        { type: 'tool_use', name: 'Agent' },
                    ],
                },
            },
        ]);
        expect(counts.tool_use_blocks).toBe(3);
        expect(counts.agent_tool_use_blocks).toBe(2);
    });

    it('ignores record types that correspond to no host event', () => {
        const counts = countTranscript([
            { type: 'mode', mode: 'normal' },
            { type: 'worktree-state' },
            { type: 'last-prompt', lastPrompt: 'x' },
            { type: 'system', hookCount: 1 },
            { type: 'file-history-snapshot' },
        ]);
        expect(counts).toMatchObject({
            user_prompt_submit: 0,
            tool_use_blocks: 0,
            agent_tool_use_blocks: 0,
        });
    });
});

describe('windowing', () => {
    const WINDOW_START = '2026-07-30';
    const WINDOW_END = '2026-08-29';

    it('folds an in-window transcript into every counted cell', () => {
        const record = emptyDenominator(WINDOW_START, WINDOW_END);
        accumulate(
            record,
            {
                first_at: '2026-08-15T09:00:00Z',
                user_prompt_submit: 4,
                tool_use_blocks: 20,
                agent_tool_use_blocks: 3,
                excluded_meta_user_records: 1,
                excluded_sidechain_user_records: 2,
            },
            WINDOW_START,
            WINDOW_END,
        );
        expect(record).toMatchObject({
            transcripts_found: 1,
            sessions_in_window: 1,
            session_start: 1,
            user_prompt_submit: 4,
            pre_tool_use: 20,
            post_tool_use: 20,
            subagent_start: 3,
            subagent_stop: 3,
        });
        expect(totalCountedEvents(record)).toBe(1 + 4 + 20 + 20 + 3 + 3);
        expect(totalJournalBoundEvents(record)).toBe(1 + 4 + 20 + 3 + 3);
    });

    it('excludes an out-of-window transcript from the counts but not from the census', () => {
        const record = emptyDenominator(WINDOW_START, WINDOW_END);
        accumulate(
            record,
            {
                first_at: '2026-01-01T00:00:00Z',
                user_prompt_submit: 9,
                tool_use_blocks: 9,
                agent_tool_use_blocks: 9,
                excluded_meta_user_records: 0,
                excluded_sidechain_user_records: 0,
            },
            WINDOW_START,
            WINDOW_END,
        );
        expect(record.transcripts_found).toBe(1);
        expect(record.sessions_before_window).toBe(1);
        expect(totalCountedEvents(record)).toBe(0);
    });

    it('reports an undatable transcript as undatable rather than dropping it silently', () => {
        const record = emptyDenominator(WINDOW_START, WINDOW_END);
        accumulate(
            record,
            {
                first_at: null,
                user_prompt_submit: 3,
                tool_use_blocks: 3,
                agent_tool_use_blocks: 0,
                excluded_meta_user_records: 0,
                excluded_sidechain_user_records: 0,
            },
            WINDOW_START,
            WINDOW_END,
        );
        expect(record.sessions_undatable).toBe(1);
        expect(record.sessions_in_window).toBe(0);
        expect(totalCountedEvents(record)).toBe(0);
    });

    it('walks a transcript tree recursively', () => {
        const root = fs.mkdtempSync(path.join(REPO_ROOT, 'agents', 'runtime', 'hd-test-'));
        try {
            fs.mkdirSync(path.join(root, 'proj', 'nested'), { recursive: true });
            fs.writeFileSync(path.join(root, 'proj', 'a.jsonl'), '{}\n');
            fs.writeFileSync(path.join(root, 'proj', 'nested', 'b.jsonl'), '{}\n');
            fs.writeFileSync(path.join(root, 'proj', 'c.txt'), 'not a transcript');
            expect(findTranscripts(root).map((f) => path.basename(f))).toEqual([
                'a.jsonl',
                'b.jsonl',
            ]);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});

describe('the journal-bound subset is read from the manifest, not asserted', () => {
    // This is the test that makes the published table self-checking. The
    // evidence page claims `pre_tool_use` has a numerator of zero BY
    // CONSTRUCTION because `journal-record` is not bound on that slot. If
    // someone binds it, this test reds and the claim gets revisited instead of
    // quietly going false.
    it('matches `journal-record` bindings on the claude platform', () => {
        const manifest = fs.readFileSync(
            path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml'),
            'utf8',
        );
        const claudeBlock = manifest.slice(manifest.indexOf('\n  claude:'));
        const nextPlatform = claudeBlock.slice(1).search(/\n {2}[a-z][a-z_-]*:\n/);
        const scoped = nextPlatform === -1 ? claudeBlock : claudeBlock.slice(0, nextPlatform + 1);

        const boundHere = COUNTED_EVENTS.filter((event) => {
            const line = scoped.match(new RegExp(`\\n\\s{4}${event}:\\s*\\[([^\\]]*)\\]`));
            return (line?.[1] ?? '').split(',').some((c) => c.trim() === 'journal-record');
        });

        expect(boundHere.sort()).toEqual([...JOURNAL_BOUND_COUNTED_EVENTS].sort());
        expect(boundHere).not.toContain('pre_tool_use');
    });
});

describe('`stop` is refused a denominator, and the refusal is recorded', () => {
    it('records three candidates that disagree, so none can be adopted quietly', () => {
        expect(STOP_CANDIDATES).toHaveLength(3);
        const readings = STOP_CANDIDATES.map((c) => c.reading);
        expect(new Set(readings).size).toBe(3);
        expect(Math.max(...readings) / Math.min(...readings)).toBeGreaterThan(10);
        for (const candidate of STOP_CANDIDATES) {
            expect(candidate.refused_because.length).toBeGreaterThan(40);
        }
    });

    it('keeps `stop` out of both counted sets', () => {
        expect(COUNTED_EVENTS as readonly string[]).not.toContain('stop');
        expect(JOURNAL_BOUND_COUNTED_EVENTS as readonly string[]).not.toContain('stop');
    });
});
