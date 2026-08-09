import { describe, expect, it } from 'vitest';

import {
    classifyLadder,
    detectBoundedReadHeavySlice,
    detectCommunicationNeed,
    detectContestedJudgment,
    detectMechanicalTransform,
    type LadderInputs,
} from '../../src/scripts/_lib/judgment_ladder.js';
import type { ActivationInputs } from '../../src/scripts/_lib/auto_dispatch.js';

const ACTIVE: ActivationInputs = { halted: false, subagent_spawn: true };

function baseInputs(overrides: Partial<LadderInputs> = {}): LadderInputs {
    return {
        taskText: 'do the thing',
        signals: { size_estimate: 0 },
        activation: ACTIVE,
        agentTeams: false,
        ...overrides,
    };
}

// ── Rung 0 — mechanical-transform detectors ──────────────────────────────

describe('detectMechanicalTransform', () => {
    it('matches a rename-X-to-Y phrase', () => {
        const r = detectMechanicalTransform('Please rename oldName.ts to newName.ts everywhere.');
        expect(r.matched).toBe(true);
        expect(r.reason).toMatch(/rename signal/);
    });

    it('matches a codemod phrase', () => {
        const r = detectMechanicalTransform('Run a codemod to migrate all imports.');
        expect(r.matched).toBe(true);
        expect(r.reason).toMatch(/codemod signal/);
    });

    it('matches an auto-format phrase', () => {
        const r = detectMechanicalTransform('Just auto-format the file, nothing else.');
        expect(r.matched).toBe(true);
        expect(r.reason).toMatch(/formatter-run signal/);
    });

    it('matches a search-and-replace phrase', () => {
        const r = detectMechanicalTransform('Do a search-and-replace across the repo.');
        expect(r.matched).toBe(true);
        expect(r.reason).toMatch(/search-and-replace\/bulk-rename signal/);
    });

    it('a passing mention of renaming does not match ("bare rename")', () => {
        const r = detectMechanicalTransform('we renamed this module last week, unrelated to today');
        expect(r.matched).toBe(false);
    });

    it('ordinary prose does not match', () => {
        expect(detectMechanicalTransform('why does X happen?').matched).toBe(false);
    });
});

// ── Rung 1 — single bounded read-heavy slice ─────────────────────────────

describe('detectBoundedReadHeavySlice', () => {
    it('matches a read-this-file phrase', () => {
        const r = detectBoundedReadHeavySlice('Please read this file and summarize what it does.');
        expect(r.matched).toBe(true);
        expect(r.reason).toMatch(/single bounded read-heavy slice/);
    });

    it('a bare "read the code" with no stated target does not match', () => {
        expect(detectBoundedReadHeavySlice('read the code').matched).toBe(false);
    });

    it('ordinary prose does not match', () => {
        expect(detectBoundedReadHeavySlice('fix the failing test').matched).toBe(false);
    });
});

// ── Rung 3 — communication-need signals ──────────────────────────────────

describe('detectCommunicationNeed', () => {
    it('matches a cross-layer phrase', () => {
        const r = detectCommunicationNeed('This is a cross-layer change touching both services.');
        expect(r.matched).toBe(true);
        expect(r.reason).toMatch(/cross-layer communication signal/);
    });

    it('matches a review-with-challenge phrase', () => {
        const r = detectCommunicationNeed('Run this as a review-with-challenge pass before merging.');
        expect(r.matched).toBe(true);
        expect(r.reason).toMatch(/review-with-challenge signal/);
    });

    it('matches a shared-task-list phrase', () => {
        const r = detectCommunicationNeed('Coordinate with multiple agents on a shared task list for this migration.');
        expect(r.matched).toBe(true);
    });

    it('ordinary prose does not match', () => {
        expect(detectCommunicationNeed('fix the failing test').matched).toBe(false);
    });
});

// ── Rung 4 — contested-judgment signals ──────────────────────────────────

describe('detectContestedJudgment', () => {
    it('matches a design-decision phrase', () => {
        const r = detectContestedJudgment('We need a design decision on the new module boundary.');
        expect(r.matched).toBe(true);
        expect(r.reason).toMatch(/design-decision signal/);
    });

    it('matches a security-downgrade phrase', () => {
        const r = detectContestedJudgment('Proposing a security downgrade for the legacy endpoint.');
        expect(r.matched).toBe(true);
        expect(r.reason).toMatch(/security-downgrade signal/);
    });

    it('matches a release-gate-escalation phrase', () => {
        const r = detectContestedJudgment('This should trigger a release-gate escalation.');
        expect(r.matched).toBe(true);
        expect(r.reason).toMatch(/release-gate-escalation signal/);
    });

    it('ordinary prose does not match', () => {
        expect(detectContestedJudgment('fix the failing test').matched).toBe(false);
    });

    // Regression: the bare `\badr\b` alternative matched routine maintenance
    // prose that names the ADR artefact but decides nothing — suppressing the
    // correct rung-2 nudge for these two live-probed near-misses.
    it('a routine ADR-maintenance mention does NOT match ("near-miss")', () => {
        expect(detectContestedJudgment('update the ADR index').matched).toBe(false);
    });

    it('a routine release-gate-script mention does NOT match ("near-miss")', () => {
        expect(detectContestedJudgment('fix the release-gate CI script typo').matched).toBe(false);
    });

    it('matches an ADR mention WITH a decision-context verb (record)', () => {
        const r = detectContestedJudgment('Let us record this as an ADR before we ship.');
        expect(r.matched).toBe(true);
        expect(r.reason).toMatch(/design-decision signal/);
    });

    it('matches an ADR mention WITH a decision-context verb (approve, reversed order)', () => {
        const r = detectContestedJudgment('This ADR still needs approval from the team.');
        expect(r.matched).toBe(true);
        expect(r.reason).toMatch(/design-decision signal/);
    });

    it('matches a release-gate mention WITH an escalation verb (override)', () => {
        const r = detectContestedJudgment('Can we override the release gate for this hotfix?');
        expect(r.matched).toBe(true);
        expect(r.reason).toMatch(/release-gate-escalation signal/);
    });

    it('matches a release-gate mention WITH an escalation verb (escalate, reversed order)', () => {
        const r = detectContestedJudgment('The release-gate decision needs to escalate to leads.');
        expect(r.matched).toBe(true);
        expect(r.reason).toMatch(/release-gate-escalation signal/);
    });
});

// ── classifyLadder — the resolver ────────────────────────────────────────

describe('classifyLadder — rung 0 (deterministic script)', () => {
    it('a lookup-class prompt resolves rung 0 via classifyLookup', () => {
        const r = classifyLadder(baseInputs({ taskText: 'where is UserService defined' }));
        expect(r.rung).toBe(0);
        expect(r.verdict).toBe('script');
        expect(r.reason).toMatch(/lookup-class definition/);
    });

    it('a mechanical-transform prompt resolves rung 0', () => {
        const r = classifyLadder(baseInputs({ taskText: 'rename a.ts to b.ts' }));
        expect(r.rung).toBe(0);
        expect(r.verdict).toBe('script');
    });

    it('rung 0 fires even when the activation gate is closed (never spawns, gate does not apply)', () => {
        const r = classifyLadder(
            baseInputs({ taskText: 'rename a.ts to b.ts', activation: { halted: true, subagent_spawn: true } }),
        );
        expect(r.rung).toBe(0);
        expect(r.verdict).toBe('script');
    });

    it('rung 0 fires even inside a subagent session (the recursive guard exempts it)', () => {
        const r = classifyLadder(baseInputs({ taskText: 'rename a.ts to b.ts', insideSubagentSession: true }));
        expect(r.rung).toBe(0);
        expect(r.verdict).toBe('script');
    });

    it('rung 0 is checked before rung 4 when both signals are present in one prompt', () => {
        const r = classifyLadder(
            baseInputs({ taskText: 'where is UserService defined, this is also a design decision' }),
        );
        expect(r.rung).toBe(0);
    });
});

describe('classifyLadder — rung 1 (single bounded read-heavy slice)', () => {
    it('a single read-heavy target resolves rung 1 with no dispatch mode (above the size floor)', () => {
        const r = classifyLadder(
            baseInputs({
                taskText: 'Please read this file and summarize what it does.',
                signals: { size_estimate: 5 },
            }),
        );
        expect(r.rung).toBe(1);
        expect(r.verdict).toBe('subagent');
        expect(r.mode).toBeNull();
    });

    // Regression: rung 1's regex match used to override classifyTask's own
    // size-floor verdict — a task at or below `SIZE_FLOOR` (the default
    // `baseInputs` signal) matched the read-heavy regex just as easily as a
    // substantial one, and dispatched a subagent anyway. The floor now
    // applies uniformly: rung 1 fires only when `size_estimate` clears it,
    // exactly like rung 2 already required.
    it('a read-heavy target AT the size floor stays ∅ (in-session) — rung 1 never overrides the floor', () => {
        const r = classifyLadder(baseInputs({ taskText: 'read this file quickly' }));
        expect(r.rung).toBeNull();
        expect(r.verdict).toBe('in-session');
    });
});

describe('classifyLadder — rung 2 (enumerable/ordered multi-slice dispatch)', () => {
    it('independent slices resolve rung 2, do-in-parallel', () => {
        const r = classifyLadder(
            baseInputs({ taskText: 'please handle these files', signals: { independent_slices: 4, size_estimate: 5 } }),
        );
        expect(r.rung).toBe(2);
        expect(r.verdict).toBe('subagent');
        expect(r.mode).toBe('do-in-parallel');
    });

    it('an ordered plan also resolves rung 2, do-in-steps (v1 simplification, documented)', () => {
        const r = classifyLadder(baseInputs({ signals: { ordered_plan: true, size_estimate: 3 } }));
        expect(r.rung).toBe(2);
        expect(r.mode).toBe('do-in-steps');
    });
});

describe('classifyLadder — rung 3 (team) and degradation to rung 2', () => {
    it('a communication-need signal with agentTeams available resolves rung 3', () => {
        const r = classifyLadder(
            baseInputs({ taskText: 'This is a cross-layer change touching both services.', agentTeams: true }),
        );
        expect(r.rung).toBe(3);
        expect(r.verdict).toBe('team');
    });

    it('the same signal without agentTeams degrades to rung 2 when the slices dispatch', () => {
        const r = classifyLadder(
            baseInputs({
                taskText: 'Coordinate with multiple agents on a shared task list for this migration.',
                agentTeams: false,
                signals: { independent_slices: 5, size_estimate: 6 },
            }),
        );
        expect(r.rung).toBe(2);
        expect(r.verdict).toBe('subagent');
        expect(r.mode).toBe('do-in-parallel');
        expect(r.degraded_from).toBe(3);
        expect(r.reason).toMatch(/no agent_teams host capability/);
    });

    it('the same signal without agentTeams and without dispatchable slices degrades below rung 2 (ask)', () => {
        const r = classifyLadder(
            baseInputs({
                taskText: 'This is a cross-layer change touching both services.',
                agentTeams: false,
                signals: { size_estimate: 5 },
            }),
        );
        expect(r.rung).toBeNull();
        expect(r.verdict).toBe('ask');
        expect(r.degraded_from).toBe(3);
    });

    it('rung 4 is checked before rung 3 when both signals are present', () => {
        const r = classifyLadder(
            baseInputs({
                taskText: 'We need a design decision, and this needs cross-layer coordination too.',
                agentTeams: true,
            }),
        );
        expect(r.rung).toBe(4);
        expect(r.verdict).toBe('council');
    });
});

describe('classifyLadder — rung 4 (council)', () => {
    it('a design-decision signal resolves rung 4', () => {
        const r = classifyLadder(baseInputs({ taskText: 'We need a design decision on the new module boundary.' }));
        expect(r.rung).toBe(4);
        expect(r.verdict).toBe('council');
    });

    it('a security-downgrade signal resolves rung 4', () => {
        const r = classifyLadder(baseInputs({ taskText: 'Proposing a security downgrade for the legacy endpoint.' }));
        expect(r.rung).toBe(4);
    });

    it('a release-gate-escalation signal resolves rung 4', () => {
        const r = classifyLadder(baseInputs({ taskText: 'This should trigger a release-gate escalation.' }));
        expect(r.rung).toBe(4);
    });
});

describe('classifyLadder — ∅ cases', () => {
    it('no enumerated signal at all resolves ask (ambiguous, above the size floor)', () => {
        const r = classifyLadder(baseInputs({ taskText: 'please handle it', signals: { size_estimate: 5 } }));
        expect(r.rung).toBeNull();
        expect(r.verdict).toBe('ask');
    });

    it('a trivial task below the size floor resolves in-session', () => {
        const r = classifyLadder(baseInputs({ taskText: 'fix a typo', signals: { size_estimate: 0 } }));
        expect(r.rung).toBeNull();
        expect(r.verdict).toBe('in-session');
    });

    it('interactiveApprovalRequired overrides a rung-4 signal', () => {
        const r = classifyLadder(
            baseInputs({
                taskText: 'We need a design decision on the new module boundary.',
                interactiveApprovalRequired: true,
            }),
        );
        expect(r.rung).toBeNull();
        expect(r.verdict).toBe('in-session');
        expect(r.reason).toMatch(/interactive-approval-required/);
    });
});

describe('classifyLadder — activation gate', () => {
    it('emergency.orchestration_halt short-circuits every rung above 0', () => {
        const r = classifyLadder(
            baseInputs({
                taskText: 'please handle these files',
                signals: { independent_slices: 4, size_estimate: 5 },
                activation: { halted: true, subagent_spawn: true },
            }),
        );
        expect(r.rung).toBeNull();
        expect(r.verdict).toBe('in-session');
        expect(r.reason).toMatch(/orchestration_halt/);
    });

    it('no subagent_spawn primitive short-circuits every rung above 0', () => {
        const r = classifyLadder(
            baseInputs({
                taskText: 'please handle these files',
                signals: { independent_slices: 4, size_estimate: 5 },
                activation: { halted: false, subagent_spawn: false },
            }),
        );
        expect(r.rung).toBeNull();
        expect(r.verdict).toBe('in-session');
        expect(r.reason).toMatch(/subagent_spawn/);
    });
});

describe('classifyLadder — recursive-dispatch guard (2.3)', () => {
    it('resolves ∅ in-session for a rung-4-shaped signal when inside a subagent session', () => {
        const r = classifyLadder(
            baseInputs({
                taskText: 'We need a design decision on the new module boundary.',
                insideSubagentSession: true,
            }),
        );
        expect(r.rung).toBeNull();
        expect(r.verdict).toBe('in-session');
        expect(r.reason).toMatch(/recursive-dispatch guard/);
    });

    it('resolves ∅ in-session for a rung-2-shaped signal when inside a subagent session', () => {
        const r = classifyLadder(
            baseInputs({
                taskText: 'please handle these files',
                signals: { independent_slices: 4, size_estimate: 5 },
                insideSubagentSession: true,
            }),
        );
        expect(r.rung).toBeNull();
        expect(r.verdict).toBe('in-session');
        expect(r.reason).toMatch(/recursive-dispatch guard/);
    });

    it('honest boundary: insideSubagentSession absent never blocks a rung on its own (caller-supplied, not probed)', () => {
        const r = classifyLadder(
            baseInputs({
                taskText: 'We need a design decision on the new module boundary.',
            }),
        );
        expect(r.rung).toBe(4);
    });
});
