/**
 * The coverage lattice — and specifically the four false greens it exists to
 * refuse.
 *
 * Every assertion here is a case where the intuitive "bigger number wins"
 * ordering reports covered and the truth is uncovered. They are the reason the
 * value set is a forest rather than a chain, so a regression that flattens it
 * shows up as a failing name rather than as a quietly shrinking finding count.
 */
import { describe, expect, it } from 'vitest';

import {
    carrier_frequency_by_platform,
    covers,
    covers_any,
    is_frequency,
    parse_hook_platforms,
    root_of,
    slot_frequency,
    type Frequency,
} from '../../src/scripts/_lib/obligation_frequency.js';

const point = (frequency: Frequency) => ({ frequency, mode: 'point' as const });
const sweep = { frequency: 'per-commit' as Frequency, mode: 'sweep' as const };

describe('the lifecycle chain is linear within itself', () => {
    it('per-turn covers per-task covers per-session', () => {
        expect(covers(point('per-turn'), 'per-task')).toBe(true);
        expect(covers(point('per-turn'), 'per-session')).toBe(true);
        expect(covers(point('per-task'), 'per-session')).toBe(true);
    });

    it('and never the other way round — the session-canary defect', () => {
        // The whole roadmap in one assertion: a session_start hook carrying a
        // per-task obligation. Measured broken on ~13 of 15 task starts while
        // the coverage instrument counted the rule as enforced.
        expect(covers(point('per-session'), 'per-task')).toBe(false);
        expect(covers(point('per-task'), 'per-turn')).toBe(false);
    });
});

describe('the false greens a magnitude-ordered chain would produce', () => {
    it('per-edit does NOT cover per-turn — a turn with no tool call fires it zero times', () => {
        expect(covers(point('per-edit'), 'per-turn')).toBe(false);
    });

    it('per-turn does NOT cover per-edit — one turn can carry twenty tool calls', () => {
        expect(covers(point('per-turn'), 'per-edit')).toBe(false);
    });

    it('per-session does NOT cover per-event — an external event has its own clock', () => {
        // A CI gate firing three times inside one session is not covered by a
        // session_start check, yet a linear lattice with per-event at the bottom
        // would accept the session-scoped carrier as dominating it.
        expect(covers(point('per-session'), 'per-event')).toBe(false);
        expect(covers(point('per-turn'), 'per-event')).toBe(false);
    });

    it('per-commit does NOT cover per-edit — one commit holds many edits', () => {
        expect(covers(point('per-commit'), 'per-edit')).toBe(false);
    });
});

describe('the one cross-root edge that is real, and only in one direction', () => {
    it('a tool-call carrier covers a commit obligation — every commit is a tool call', () => {
        // block-no-verify sits in pre_tool_use and inspects the `git commit`
        // command itself. Refusing this edge would report the commit guard as
        // failing to carry the commit rule.
        expect(covers(point('per-edit'), 'per-commit')).toBe(true);
    });

    it('but the roots stay distinct', () => {
        expect(root_of('per-edit')).toBe('tool-call');
        expect(root_of('per-commit')).toBe('repository');
        expect(root_of('per-event')).toBe('external-event');
        expect(root_of('per-turn')).toBe('lifecycle');
    });
});

describe('sweep carriers are bounded by the artefact, not by their period', () => {
    it('a CI validator covers artefact-resident obligations', () => {
        expect(covers(sweep, 'per-edit')).toBe(true);
        expect(covers(sweep, 'per-file-write')).toBe(true);
        expect(covers(sweep, 'per-commit')).toBe(true);
    });

    it('and covers no transient one — nothing lands in the tree to read', () => {
        // Modelling a validator as a per-commit POINT carrier instead would make
        // every validator-carried rule with a per-edit obligation a finding at
        // once: one modelling error rendered as a fifth of the corpus.
        expect(covers(sweep, 'per-turn')).toBe(false);
        expect(covers(sweep, 'per-task')).toBe(false);
        expect(covers(sweep, 'per-session')).toBe(false);
        expect(covers(sweep, 'per-event')).toBe(false);
    });
});

describe('an obligation of none is covered vacuously', () => {
    it('there is nothing recurring to carry', () => {
        expect(covers(point('per-session'), 'none')).toBe(true);
        expect(covers(sweep, 'none')).toBe(true);
    });

    it('but a carrier of none covers nothing', () => {
        expect(covers(point('none'), 'per-turn')).toBe(false);
    });
});

describe('a carrier bound in several slots fires at the union of their periods', () => {
    it('covers_any accepts a match in any root the carrier really occupies', () => {
        // minimal-safe-diff is bound in session_start, user_prompt_submit AND
        // post_tool_use. Collapsing that to one "strongest" value has no correct
        // answer — per-turn and per-edit are incomparable — and picking either
        // reported the rule as failing to carry its own per-edit obligation.
        const bound: Frequency[] = ['per-session', 'per-turn', 'per-edit'];
        expect(covers_any(bound, 'per-edit')).toBe(true);
        expect(covers_any(bound, 'per-turn')).toBe(true);
        expect(covers_any(bound, 'per-event')).toBe(false);
    });
});

describe('slot frequency is resolved per platform, never per slot alone', () => {
    it('stop is per-turn by default — the native Stop fires after every reply', () => {
        expect(slot_frequency('claude', 'stop')).toBe('per-turn');
        expect(slot_frequency('gemini', 'stop')).toBe('per-turn');
    });

    it('but cline maps stop from TaskCancel, which is an interruption', () => {
        expect(slot_frequency('cline', 'stop')).toBe('per-event');
        // and that difference is load-bearing: an interruption covers no
        // lifecycle obligation, where a per-turn stop covers all three.
        expect(covers(point(slot_frequency('cline', 'stop')), 'per-task')).toBe(false);
        expect(covers(point(slot_frequency('claude', 'stop')), 'per-task')).toBe(true);
    });

    it('session_end is per-session, not per-turn', () => {
        expect(slot_frequency('claude', 'session_end')).toBe('per-session');
    });
});

describe('the manifest platform reader', () => {
    const MANIFEST = [
        'concerns:',
        '  thing:',
        '    fail_closed: false',
        'platforms:',
        '  claude:',
        '    session_start: [chat-history, session-canary]',
        '    user_prompt_submit: [language-mirror]',
        '    post_tool_use: [roadmap-progress]',
        '  windsurf:',
        '    session_start: [chat-history]',
        '    stop: [chat-history]',
        '  copilot:',
        '    fallback_only: true',
        'native_event_aliases:',
        '  claude:',
        '    Stop: stop',
    ].join('\n');

    it('reads slot membership per platform', () => {
        const b = parse_hook_platforms(MANIFEST);
        expect(b.slots.get('claude')?.get('session_start')).toEqual([
            'chat-history',
            'session-canary',
        ]);
        expect(b.slots.get('windsurf')?.has('post_tool_use')).toBe(false);
    });

    it('stops at the end of the platforms block', () => {
        const b = parse_hook_platforms(MANIFEST);
        expect(b.slots.has('native_event_aliases')).toBe(false);
    });

    it('records a hook-surface-less platform rather than inventing slots for it', () => {
        const b = parse_hook_platforms(MANIFEST);
        expect(b.fallback_only.has('copilot')).toBe(true);
        expect(b.slots.get('copilot')?.size).toBe(0);
    });

    it('excludes it from the per-platform frequency map entirely', () => {
        // Including it would turn one platform property — copilot has no hook
        // surface at all — into a finding on every hook-carried rule at once,
        // which reports a platform fact as if it were a per-rule defect.
        const freqs = carrier_frequency_by_platform('chat-history', parse_hook_platforms(MANIFEST));
        expect(Object.keys(freqs).sort()).toEqual(['claude', 'windsurf']);
    });

    it('returns every period a concern fires at, not the strongest one', () => {
        const freqs = carrier_frequency_by_platform('chat-history', parse_hook_platforms(MANIFEST));
        expect(freqs['windsurf']?.sort()).toEqual(['per-session', 'per-turn']);
    });

    it('returns an empty list where the concern is bound in no slot', () => {
        const freqs = carrier_frequency_by_platform(
            'language-mirror',
            parse_hook_platforms(MANIFEST),
        );
        expect(freqs['windsurf']).toEqual([]);
        expect(freqs['claude']).toEqual(['per-turn']);
    });
});

describe('is_frequency guards the frontmatter read', () => {
    it('accepts the declared vocabulary and nothing else', () => {
        expect(is_frequency('per-turn')).toBe(true);
        expect(is_frequency('none')).toBe(true);
        expect(is_frequency('per-hour')).toBe(false);
        expect(is_frequency(undefined)).toBe(false);
        expect(is_frequency(['per-turn'])).toBe(false);
    });
});
