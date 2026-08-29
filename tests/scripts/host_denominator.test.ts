// The host-emitted-event denominator — record contract, reconstruction rules,
// scope, windowing, and the manifest binding the published table depends on.
//
// `road-to-journal-host-capture-measurement` Phase 2 step 2.1 and AC-2. Every
// fixture here is inline: the measurement itself reads the maintainer's
// `~/.claude/projects`, which is not reproducible anywhere else, so the RULES
// are tested against fixtures and only the numbers come from the machine.
//
// Blocks marked R2 were added or tightened after the blind completion review of
// 2026-08-29; each names the finding it closes, so a later reader can tell a
// regression test from an original one.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { FREE_FORM_KEYS } from '../../src/scripts/_lib/runtime_journal.js';
import {
    accumulate,
    COUNTED_EVENTS,
    countTranscript,
    DENOMINATOR_RECORD_KEYS,
    DENOMINATOR_SCOPES,
    DenominatorContractError,
    emptyDenominator,
    emptyTranscriptCounts,
    findTranscripts,
    JOURNAL_BOUND_COUNTED_EVENTS,
    projectSlug,
    RECONSTRUCTION_RULE_VERSION,
    RECONSTRUCTION_RULES,
    repositoryScopeSlugs,
    STOP_CANDIDATES,
    totalCountedEvents,
    totalJournalBoundEvents,
    type TranscriptCounts,
    validateDenominator,
} from '../../src/scripts/_lib/host_denominator.js';
import { readJournalKey } from '../../src/scripts/measure_host_capture.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** A transcript-counts fixture with every field present. */
function counts(over: Partial<TranscriptCounts> = {}): TranscriptCounts {
    return { ...emptyTranscriptCounts(), ...over };
}

describe('the denominator record contract (AC-2)', () => {
    it('binds the committed key set to the record in both directions', () => {
        const record = emptyDenominator('2026-07-31', '2026-08-29');
        expect(Object.keys(record).sort()).toEqual([...DENOMINATOR_RECORD_KEYS].sort());
    });

    it('REJECTS an unknown field rather than dropping it', () => {
        const record: Record<string, unknown> = {
            ...emptyDenominator('2026-07-31', '2026-08-29'),
            project_slug: 'anything',
        };
        expect(() => validateDenominator(record)).toThrow(DenominatorContractError);
        expect(() => validateDenominator(record)).toThrow(
            /unknown field 'project_slug' — REJECTED, not dropped/,
        );
    });

    it('refuses a missing field', () => {
        const record: Record<string, unknown> = { ...emptyDenominator('2026-07-31', '2026-08-29') };
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
    // `npm run typecheck` fail on `_RecordCarriesNoFreeFormField`.
    it('carries no free-form key, on the numerator record’s own list', () => {
        const forbidden = new Set<string>(FREE_FORM_KEYS as readonly string[]);
        for (const key of DENOMINATOR_RECORD_KEYS) {
            expect(forbidden.has(key), `'${key}' is a free-form key`).toBe(false);
        }
    });

    it('refuses a per-second timestamp where a calendar date belongs', () => {
        const record: Record<string, unknown> = {
            ...emptyDenominator('2026-07-31', '2026-08-29'),
            window_start: '2026-07-31T11:22:33.000Z',
        };
        expect(() => validateDenominator(record)).toThrow(
            /must be an ISO calendar date .* reconstructs working hours/s,
        );
    });

    // R2 finding 18: an inverted window passed validation and yielded an
    // all-zero denominator that `rate()` reported as "undefined" rather than as
    // a bad input.
    it('R2-18 — refuses an inverted window instead of reporting a zero denominator', () => {
        const record: Record<string, unknown> = {
            ...emptyDenominator('2026-07-31', '2026-08-29'),
            window_start: '2026-08-30',
        };
        expect(() => validateDenominator(record)).toThrow(/is after window_end/);
        expect(() => validateDenominator(record)).toThrow(/instead of a bad input/);
    });

    it('accepts a single-day window, which is not inverted', () => {
        expect(() => emptyDenominator('2026-08-29', '2026-08-29')).not.toThrow();
    });

    it('refuses a negative or fractional count', () => {
        for (const bad of [-1, 1.5]) {
            const record: Record<string, unknown> = {
                ...emptyDenominator('2026-07-31', '2026-08-29'),
                session_start: bad,
            };
            expect(() => validateDenominator(record)).toThrow(/non-negative integer/);
        }
    });

    it('refuses a platform other than claude', () => {
        const record: Record<string, unknown> = {
            ...emptyDenominator('2026-07-31', '2026-08-29'),
            platform: 'cursor',
        };
        expect(() => validateDenominator(record)).toThrow(/only cell set/);
    });

    // R2 finding 1: the scope is the field that keeps the denominator's
    // population and the numerator's the same one, so an unrecognised value is
    // refused rather than carried.
    it('R2-1 — refuses an unrecorded scope', () => {
        const record: Record<string, unknown> = {
            ...emptyDenominator('2026-07-31', '2026-08-29'),
            scope: 'whatever',
        };
        expect(() => validateDenominator(record)).toThrow(/scope must be one of/);
        expect(() => validateDenominator(record)).toThrow(/different population than its numerator/);
    });

    it('defaults to the repository scope, which is the one the numerator can reach', () => {
        expect(emptyDenominator('2026-07-31', '2026-08-29').scope).toBe('repository');
        expect(DENOMINATOR_SCOPES).toEqual(['repository', 'machine']);
    });
});

describe('the reconstruction rules, pinned at v2', () => {
    it('states a rule for every counted event', () => {
        for (const event of COUNTED_EVENTS) {
            expect(RECONSTRUCTION_RULES[event], `no rule stated for ${event}`).toBeTruthy();
        }
        expect(RECONSTRUCTION_RULE_VERSION).toBe(2);
    });

    // R2 finding 2: the sidechain rule for ASSISTANT records governs ~97 % of
    // the count and v1 stated it nowhere. The rule text is now part of the
    // contract, so deleting the statement reds this.
    it('R2-2 — states the sidechain rule for the two largest cells', () => {
        for (const event of ['pre_tool_use', 'post_tool_use'] as const) {
            expect(RECONSTRUCTION_RULES[event]).toMatch(/[Ss]idechain records ARE INCLUDED|Same sidechain treatment/);
        }
    });

    // R2 finding 8: `session_start` was published as an iff and is not one.
    it('R2-8 — states the direction in which the session_start rule fails', () => {
        expect(RECONSTRUCTION_RULES.session_start).toMatch(/NOT an iff/);
        expect(RECONSTRUCTION_RULES.session_start).toMatch(/under-count/);
        expect(RECONSTRUCTION_RULES.session_start).toMatch(/over-count/);
    });

    it('counts a user prompt only when the record carries no tool_result', () => {
        const c = countTranscript([
            { type: 'user', timestamp: '2026-08-10T00:00:00Z', message: { content: 'hello' } },
            { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'x' }] } },
            { type: 'user', message: { content: [{ type: 'text', text: 'a real prompt' }] } },
        ]);
        expect(c.user_prompt_submit).toBe(2);
        expect(c.first_at).toBe('2026-08-10T00:00:00Z');
    });

    it('REFINEMENT 1 — excludes an injected meta record from user prompts', () => {
        const c = countTranscript([
            { type: 'user', isMeta: true, message: { content: 'system reminder' } },
            { type: 'user', message: { content: 'a real prompt' } },
        ]);
        expect(c.user_prompt_submit).toBe(1);
        expect(c.excluded_meta_user_records).toBe(1);
    });

    it('REFINEMENT 2 — excludes a sidechain user record from user prompts', () => {
        const c = countTranscript([
            { type: 'user', isSidechain: true, message: { content: 'subagent brief' } },
            { type: 'user', message: { content: 'a real prompt' } },
        ]);
        expect(c.user_prompt_submit).toBe(1);
        expect(c.excluded_sidechain_user_records).toBe(1);
    });

    // R2 finding 11: v1 returned after the sidechain branch, so a record
    // carrying both flags was counted only once while the page published the
    // two counts as independent refinements.
    it('R2-11 — counts a record carrying BOTH flags in both counters', () => {
        const c = countTranscript([
            { type: 'user', isSidechain: true, isMeta: true, message: { content: 'x' } },
        ]);
        expect(c.excluded_sidechain_user_records).toBe(1);
        expect(c.excluded_meta_user_records).toBe(1);
        expect(c.user_prompt_submit).toBe(0);
    });

    it('counts one tool_use block per block, and Agent/Task blocks as a subset', () => {
        const c = countTranscript([
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
        expect(c.tool_use_blocks).toBe(3);
        expect(c.agent_tool_use_blocks).toBe(2);
        expect(c.sidechain_tool_use_blocks).toBe(0);
    });

    // R2 finding 2, the counting half: a sidechain assistant record's tool calls
    // are INCLUDED, and the share is published so a reader who disagrees can
    // subtract it rather than re-deriving the whole count.
    it('R2-2 — includes sidechain tool_use blocks AND reports their share', () => {
        const c = countTranscript([
            {
                type: 'assistant',
                isSidechain: true,
                message: {
                    content: [
                        { type: 'tool_use', name: 'Bash' },
                        { type: 'tool_use', name: 'Task' },
                    ],
                },
            },
            { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read' }] } },
        ]);
        expect(c.tool_use_blocks).toBe(3);
        expect(c.sidechain_tool_use_blocks).toBe(2);
        expect(c.agent_tool_use_blocks).toBe(1);
        expect(c.sidechain_agent_tool_use_blocks).toBe(1);
    });

    // R2 finding 12: `first_at` was the first timestamp in FILE order, so a
    // back-dated leading record decided the whole file's window placement.
    it('R2-12 — takes the MINIMUM timestamp, not the first one in file order', () => {
        const c = countTranscript([
            { type: 'user', timestamp: '2026-08-20T00:00:00Z', message: { content: 'a' } },
            { type: 'user', timestamp: '2026-08-02T00:00:00Z', message: { content: 'b' } },
        ]);
        expect(c.first_at).toBe('2026-08-02T00:00:00Z');
    });

    it('ignores record types that correspond to no host event', () => {
        const c = countTranscript([
            { type: 'mode', mode: 'normal' },
            { type: 'worktree-state' },
            { type: 'last-prompt', lastPrompt: 'x' },
            { type: 'system', hookCount: 1 },
            { type: 'file-history-snapshot' },
        ]);
        expect(c).toMatchObject({
            user_prompt_submit: 0,
            tool_use_blocks: 0,
            agent_tool_use_blocks: 0,
        });
    });
});

describe('windowing', () => {
    const WINDOW_START = '2026-07-31';
    const WINDOW_END = '2026-08-29';

    it('folds an in-window transcript into every counted cell', () => {
        const record = emptyDenominator(WINDOW_START, WINDOW_END);
        accumulate(
            record,
            counts({
                first_at: '2026-08-15T09:00:00Z',
                user_prompt_submit: 4,
                tool_use_blocks: 20,
                agent_tool_use_blocks: 3,
                sidechain_tool_use_blocks: 6,
                sidechain_agent_tool_use_blocks: 1,
                excluded_meta_user_records: 1,
                excluded_sidechain_user_records: 2,
            }),
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
            sidechain_tool_use_blocks: 6,
            sidechain_agent_tool_use_blocks: 1,
        });
        expect(totalCountedEvents(record)).toBe(1 + 4 + 20 + 20 + 3 + 3);
        expect(totalJournalBoundEvents(record)).toBe(1 + 4 + 20 + 3 + 3);
    });

    it('excludes a before-window transcript from the counts but not from the census', () => {
        const record = emptyDenominator(WINDOW_START, WINDOW_END);
        accumulate(
            record,
            counts({ first_at: '2026-01-01T00:00:00Z', user_prompt_submit: 9, tool_use_blocks: 9 }),
            WINDOW_START,
            WINDOW_END,
        );
        expect(record.transcripts_found).toBe(1);
        expect(record.sessions_before_window).toBe(1);
        expect(record.sessions_after_window).toBe(0);
        expect(totalCountedEvents(record)).toBe(0);
    });

    // R2 finding 10: an AFTER-window transcript was filed under
    // `sessions_before_window`, a field documented as "predates the window".
    it('R2-10 — files an after-window transcript in its own bucket', () => {
        const record = emptyDenominator(WINDOW_START, WINDOW_END);
        accumulate(
            record,
            counts({ first_at: '2027-01-01T00:00:00Z', tool_use_blocks: 9 }),
            WINDOW_START,
            WINDOW_END,
        );
        expect(record.sessions_after_window).toBe(1);
        expect(record.sessions_before_window).toBe(0);
        expect(totalCountedEvents(record)).toBe(0);
    });

    it('reports an undatable transcript as undatable rather than dropping it silently', () => {
        const record = emptyDenominator(WINDOW_START, WINDOW_END);
        accumulate(
            record,
            counts({ first_at: null, user_prompt_submit: 3, tool_use_blocks: 3 }),
            WINDOW_START,
            WINDOW_END,
        );
        expect(record.sessions_undatable).toBe(1);
        expect(record.sessions_in_window).toBe(0);
        expect(totalCountedEvents(record)).toBe(0);
    });

    // R2 finding 13: unparseable lines were discarded with no counter while
    // every other exclusion class was published.
    it('R2-13 — carries unparseable-line counts even for an out-of-window transcript', () => {
        const record = emptyDenominator(WINDOW_START, WINDOW_END);
        accumulate(
            record,
            counts({ first_at: '2026-01-01T00:00:00Z', unparseable_lines: 4 }),
            WINDOW_START,
            WINDOW_END,
        );
        expect(record.unparseable_lines).toBe(4);
    });
});

describe('the transcript walk', () => {
    // R2 finding 9: the fixture tree used to be mkdtemp'd inside
    // `agents/runtime/`, which is untracked — so a fresh checkout has no such
    // directory and `mkdtempSync` throws ENOENT, and an abort before the
    // `finally` left a stray directory where clean-tree gates can see it.
    function withTempTree(fn: (root: string) => void): void {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hd-walk-'));
        try {
            fn(root);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    }

    it('walks a transcript tree recursively', () => {
        withTempTree((root) => {
            fs.mkdirSync(path.join(root, 'proj', 'nested'), { recursive: true });
            fs.writeFileSync(path.join(root, 'proj', 'a.jsonl'), '{}\n');
            fs.writeFileSync(path.join(root, 'proj', 'nested', 'b.jsonl'), '{}\n');
            fs.writeFileSync(path.join(root, 'proj', 'c.txt'), 'not a transcript');
            const walk = findTranscripts(root);
            expect(walk.files.map((f) => path.basename(f))).toEqual(['a.jsonl', 'b.jsonl']);
            expect(walk.unreadable).toBe(0);
        });
    });

    // R2 finding 1: the scope filter is what keeps the denominator over the
    // numerator's population.
    it('R2-1 — restricts the walk to the given project slugs', () => {
        withTempTree((root) => {
            for (const dir of ['-mine', '-someone-else']) {
                fs.mkdirSync(path.join(root, dir), { recursive: true });
                fs.writeFileSync(path.join(root, dir, 's.jsonl'), '{}\n');
            }
            const walk = findTranscripts(root, ['-mine']);
            expect(walk.files).toHaveLength(1);
            expect(walk.files[0]).toContain('-mine');
            expect(walk.outOfScope).toBe(1);
        });
    });

    // The dangerous default: an empty scope must yield nothing, never
    // everything. A silent widening is the defect being fixed.
    it('R2-1 — an EMPTY scope yields no files rather than all of them', () => {
        withTempTree((root) => {
            fs.mkdirSync(path.join(root, '-mine'), { recursive: true });
            fs.writeFileSync(path.join(root, '-mine', 's.jsonl'), '{}\n');
            const walk = findTranscripts(root, []);
            expect(walk.files).toHaveLength(0);
            expect(walk.outOfScope).toBe(1);
        });
    });

    // R2 finding 13: `isDirectory()` / `isFile()` are false for a symlink, so
    // a symlinked project directory was skipped silently.
    it('R2-13 — follows a symlinked project directory instead of skipping it', () => {
        withTempTree((root) => {
            const real = path.join(root, 'real');
            fs.mkdirSync(real, { recursive: true });
            fs.writeFileSync(path.join(real, 's.jsonl'), '{}\n');
            fs.symlinkSync(real, path.join(root, '-linked'));
            const walk = findTranscripts(root, ['-linked']);
            expect(walk.files).toHaveLength(1);
        });
    });

    it('R2-13 — reports an unreadable projects root instead of returning a clean empty', () => {
        const walk = findTranscripts(path.join(os.tmpdir(), 'definitely-not-here-hd'));
        expect(walk.files).toHaveLength(0);
        expect(walk.unreadable).toBe(1);
    });

    it('maps a working directory to a project slug the way the host does', () => {
        expect(projectSlug('/private/tmp/ac-drain2')).toBe('-private-tmp-ac-drain2');
        expect(projectSlug('/a/b.c')).toBe('-a-b-c');
    });

    it('resolves this repository’s own worktrees, and every slug is non-empty', () => {
        const scope = repositoryScopeSlugs(REPO_ROOT);
        expect(scope.worktrees.length).toBeGreaterThan(0);
        expect(scope.slugs).toHaveLength(scope.worktrees.length);
        for (const slug of scope.slugs) expect(slug.startsWith('-')).toBe(true);
    });

    it('returns an EMPTY scope outside a git repository, never a machine-wide one', () => {
        const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'hd-nogit-'));
        try {
            expect(repositoryScopeSlugs(outside).slugs).toEqual([]);
        } finally {
            fs.rmSync(outside, { recursive: true, force: true });
        }
    });
});

// R2 finding 4: the census parse was unanchored, indentation-bound, and a
// non-match was indistinguishable from an absent key — all three resolving
// silently toward the `default` population label both captions rest on.
describe('R2-4 — the settings-layer parse', () => {
    it('reads the key under the hooks: parent', () => {
        expect(readJournalKey('hooks:\n  runtime_journal:\n    enabled: true\n')).toBe(true);
        expect(readJournalKey('hooks:\n  runtime_journal:\n    enabled: false\n')).toBe(false);
    });

    it('tolerates a different but consistent indentation', () => {
        expect(readJournalKey('hooks:\n    runtime_journal:\n        enabled: true\n')).toBe(true);
    });

    it('reports an ABSENT key as null, distinctly from a parse failure', () => {
        expect(readJournalKey('hooks:\n  other_thing:\n    enabled: true\n')).toBeNull();
        expect(readJournalKey('personal:\n  autonomy: on\n')).toBeNull();
    });

    it('reports a runtime_journal block with no verdict as parse-failed', () => {
        expect(readJournalKey('hooks:\n  runtime_journal:\n    something_else: 1\n  x:\n    y: 2\n')).toBe(
            'parse-failed',
        );
    });

    it('does NOT match a runtime_journal outside the hooks block', () => {
        expect(readJournalKey('telemetry:\n  runtime_journal:\n    enabled: true\n')).toBeNull();
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
        // R2 finding 14: the docstring said 40 and the evidence page said 44
        // while the only assertion was `> 10`, so neither number was pinned.
        // 305 / 7 = 43.57, so the true factor is between 43 and 44.
        const factor = Math.max(...readings) / Math.min(...readings);
        expect(factor).toBeGreaterThan(43);
        expect(factor).toBeLessThan(44);
        for (const candidate of STOP_CANDIDATES) {
            expect(candidate.refused_because.length).toBeGreaterThan(40);
        }
    });

    it('keeps `stop` out of both counted sets', () => {
        expect(COUNTED_EVENTS as readonly string[]).not.toContain('stop');
        expect(JOURNAL_BOUND_COUNTED_EVENTS as readonly string[]).not.toContain('stop');
    });
});
