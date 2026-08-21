import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    _load_yaml,
    _resolve_concerns,
    _role_drop_set,
    EVENT_VOCABULARY,
    type JsonObject,
} from '../../src/scripts/hooks/dispatch_hook.js';
import { resolveSessionRole, SESSION_ROLE_ENV } from '../../src/scripts/_lib/session_role.js';
import { _check_roles } from '../../src/scripts/lint_hook_manifest.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST = path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml');

/**
 * The Phase 2.3 orchestrator-only set, pinned.
 *
 * `session-eol` joined the set in road-to-token-economy-recycling Phase 3.2:
 * its advisory tells the USER to run `session:recycle` and clear, and a
 * worker neither talks to the user nor can clear its own session — the same
 * reason `end-review-nudge` sits here. Its recording half is orchestrator
 * business too: the fill level that matters is the main session's.
 *
 * `skill-route` joined in road-to-inbox-harvest-2026-08-d-runtime-skill-routing
 * Phase 2, for the reason `delegation-nudge` is on the list rather than a new
 * one: a worker was handed a bounded slice by an orchestrator that already
 * chose the approach, so a routing pointer reaches nobody who can act on it
 * while still costing the dispatch and a catalogue read.
 *
 * `interruption-ledger` joined in road-to-user-out-of-the-loop Phase 0 Step 1,
 * on the set's first clause verbatim — a worker never talks to the user. It
 * counts synchronous user contacts, so a worker turn ending in a question to
 * its orchestrator would be recorded as a contact that never reached a human
 * and would inflate the baseline the phase pre-registers.
 */
const WORKER_DROP = [
    'delegation-nudge',
    'skill-route',
    'end-review-nudge',
    'council-availability',
    'team-review-gate',
    'self-repair',
    'session-eol',
    'interruption-ledger',
];

function manifest(): JsonObject {
    return _load_yaml(MANIFEST);
}

function platformNames(m: JsonObject): string[] {
    const p = m['platforms'];
    return p && typeof p === 'object' && !Array.isArray(p) ? Object.keys(p) : [];
}

describe('resolveSessionRole (the ONE shared detector)', () => {
    it('fails open to orchestrator on unset, empty, and unknown values', () => {
        expect(resolveSessionRole({})).toBe('orchestrator');
        expect(resolveSessionRole({ [SESSION_ROLE_ENV]: '' })).toBe('orchestrator');
        expect(resolveSessionRole({ [SESSION_ROLE_ENV]: '  ' })).toBe('orchestrator');
        expect(resolveSessionRole({ [SESSION_ROLE_ENV]: 'wurker' })).toBe('orchestrator');
        expect(resolveSessionRole({ [SESSION_ROLE_ENV]: 'admin' })).toBe('orchestrator');
    });

    it('resolves known roles case-insensitively', () => {
        expect(resolveSessionRole({ [SESSION_ROLE_ENV]: 'worker' })).toBe('worker');
        expect(resolveSessionRole({ [SESSION_ROLE_ENV]: 'WORKER' })).toBe('worker');
        expect(resolveSessionRole({ [SESSION_ROLE_ENV]: ' reviewer ' })).toBe('reviewer');
        expect(resolveSessionRole({ [SESSION_ROLE_ENV]: 'orchestrator' })).toBe('orchestrator');
    });

    it('is the single implementation both consumers import (one detector, two consumers)', () => {
        const dispatcher = fs.readFileSync(path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'dispatch_hook.ts'), 'utf8');
        const nudge = fs.readFileSync(
            path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'delegation_nudge_hook.ts'),
            'utf8',
        );
        for (const src of [dispatcher, nudge]) {
            expect(src).toMatch(/from ["']\.\.\/_lib\/session_role\.js["']/);
            expect(src).toMatch(/resolveSessionRole\(/);
        }
    });
});

describe('role axis in the live manifest', () => {
    it('default role resolves byte-identical to the pre-axis behaviour on every platform x event', () => {
        const m = manifest();
        for (const platform of platformNames(m)) {
            for (const event of EVENT_VOCABULARY) {
                const legacy = _resolve_concerns(m, platform, event);
                const explicit = _resolve_concerns(m, platform, event, 'orchestrator');
                expect(explicit).toEqual(legacy);
            }
        }
    });

    it('a worker session drops exactly the orchestrator-only concerns — nothing else', () => {
        const m = manifest();
        const dropSet = new Set(WORKER_DROP);
        for (const platform of platformNames(m)) {
            for (const event of EVENT_VOCABULARY) {
                const full = _resolve_concerns(m, platform, event).map((c) => c['name']);
                const worker = _resolve_concerns(m, platform, event, 'worker').map((c) => c['name']);
                const expected =
                    event === 'pre_tool_use' ? full : full.filter((n) => !dropSet.has(String(n)));
                expect(worker).toEqual(expected);
            }
        }
    });

    it('the worker chain is visibly shorter where orchestrator concerns are bound (claude)', () => {
        const m = manifest();
        const fullUps = _resolve_concerns(m, 'claude', 'user_prompt_submit').map((c) => c['name']);
        const workerUps = _resolve_concerns(m, 'claude', 'user_prompt_submit', 'worker').map((c) => c['name']);
        expect(fullUps).toContain('delegation-nudge');
        expect(workerUps).not.toContain('delegation-nudge');
        expect(workerUps.length).toBeLessThan(fullUps.length);

        const fullStop = _resolve_concerns(m, 'claude', 'stop').map((c) => c['name']);
        const workerStop = _resolve_concerns(m, 'claude', 'stop', 'worker').map((c) => c['name']);
        expect(fullStop).toContain('end-review-nudge');
        expect(workerStop).not.toContain('end-review-nudge');
        expect(workerStop).not.toContain('team-review-gate');
    });

    it('pre_tool_use guards are undroppable on EVERY role and platform (zero guard removals)', () => {
        const m = manifest();
        for (const platform of platformNames(m)) {
            const full = _resolve_concerns(m, platform, 'pre_tool_use').map((c) => c['name']);
            for (const role of ['worker', 'reviewer'] as const) {
                const roled = _resolve_concerns(m, platform, 'pre_tool_use', role).map((c) => c['name']);
                expect(roled).toEqual(full);
            }
        }
    });

    /**
     * Phase 4 Step 3 — the invariant, pinned where it can actually go red.
     *
     * The test above it walks the LIVE manifest, whose worker `drop` list
     * happens to name no `pre_tool_use`-bound concern. So deleting the
     * `event === 'pre_tool_use'` clause from `_role_drop_set` would drop
     * nothing on that slot and the test would still pass — it has no
     * sensitivity to the guard it is named after. This fixture gives it some:
     * the drop list names a concern that IS bound on the slot, and the same
     * list is proven live on a droppable slot in the same test, so a pass
     * cannot come from an inert fixture.
     *
     * It also pins the property Phase 4 Step 1 needs and cannot yet supply.
     * The refusal is keyed on the SLOT, never on where the role came from, so
     * an `agent_id`-derived `worker` is refused by the same early return that
     * refuses an env-derived one. There is no payload path to feed a test
     * today — nothing in the tree reads `agent_id` off a tool event — so the
     * arbitrary label below stands in for one: whatever channel eventually
     * resolves a non-orchestrator role, `pre_tool_use` is unaffected.
     */
    it('refuses a pre_tool_use drop regardless of which channel resolved the role', () => {
        const m: JsonObject = {
            concerns: { 'block-no-verify': { script: 'x' }, 'chat-history': { script: 'y' } },
            platforms: {
                probe: {
                    pre_tool_use: ['block-no-verify'],
                    stop: ['block-no-verify', 'chat-history'],
                },
            },
            roles: { worker: { drop: ['block-no-verify'] }, payloadworker: { drop: ['block-no-verify'] } },
        };
        // The fixture is live: on a droppable slot the same entry is dropped.
        // Sensitivity here is DIFFERENTIAL rather than mutation-proved — one
        // fixture, one role, two asserted outcomes separated only by the event
        // argument. Deleting the slot clause would make the second assertion
        // return the first's value.
        expect([..._role_drop_set(m, 'worker', 'stop')]).toEqual(['block-no-verify']);
        expect(_role_drop_set(m, 'worker', 'pre_tool_use').size).toBe(0);
        expect(_resolve_concerns(m, 'probe', 'stop', 'worker').map((c) => c['name'])).toEqual([
            'chat-history',
        ]);
        // On the guard slot it survives — for every role label, invented ones
        // included, because the early return never looks at the role.
        for (const role of ['worker', 'reviewer', 'payloadworker', 'agent-id-derived'] as const) {
            expect(
                _resolve_concerns(m, 'probe', 'pre_tool_use', role as never).map((c) => c['name']),
            ).toEqual(['block-no-verify']);
        }
    });

    it('a role without a manifest entry resolves the full chain (fail-open, 2.4)', () => {
        const m = manifest();
        // `reviewer` has no roles.reviewer entry yet (Phase 3.2) — full chain.
        for (const event of EVENT_VOCABULARY) {
            expect(_resolve_concerns(m, 'claude', event, 'reviewer')).toEqual(
                _resolve_concerns(m, 'claude', event),
            );
        }
    });
});

describe('_role_drop_set', () => {
    const m: JsonObject = {
        roles: { worker: { drop: ['a', 'b'] } },
    };

    it('returns the drop set for a known role on a droppable slot', () => {
        expect([..._role_drop_set(m, 'worker', 'stop')].sort()).toEqual(['a', 'b']);
    });

    it('is ALWAYS empty for pre_tool_use, orchestrator, and unknown roles', () => {
        expect(_role_drop_set(m, 'worker', 'pre_tool_use').size).toBe(0);
        expect(_role_drop_set(m, 'orchestrator', 'stop').size).toBe(0);
        expect(_role_drop_set(m, 'reviewer', 'stop').size).toBe(0);
        expect(_role_drop_set({}, 'worker', 'stop').size).toBe(0);
    });
});

describe('lint_hook_manifest._check_roles (CI guard)', () => {
    const concernNames = new Set(['delegation-nudge', 'block-no-verify', 'chat-history']);

    it('is green on the live manifest role block', () => {
        const errors: string[] = [];
        const m = manifest();
        const liveConcerns = new Set(Object.keys(m['concerns'] as Record<string, unknown>));
        _check_roles(m as never, liveConcerns, errors);
        expect(errors).toEqual([]);
    });

    it('is red on a drop entry naming a pre_tool_use-bound guard (fixture removing one)', () => {
        const errors: string[] = [];
        const fixture = {
            roles: { worker: { drop: ['block-no-verify'] } },
            platforms: { claude: { pre_tool_use: ['block-no-verify'] } },
        };
        _check_roles(fixture as never, concernNames, errors);
        expect(errors.join(' ')).toMatch(/pre_tool_use slot — safety guards are undroppable/);
    });

    it('is red on unknown concerns and malformed shapes', () => {
        const errors: string[] = [];
        _check_roles({ roles: { worker: { drop: ['nope'] } } } as never, concernNames, errors);
        expect(errors.join(' ')).toMatch(/not a known concern/);

        const errors2: string[] = [];
        _check_roles({ roles: 'worker' } as never, concernNames, errors2);
        expect(errors2.join(' ')).toMatch(/roles: must be a mapping/);

        const errors3: string[] = [];
        _check_roles({ roles: { worker: { drop: 'delegation-nudge' } } } as never, concernNames, errors3);
        expect(errors3.join(' ')).toMatch(/'drop' must be a list/);
    });
});
