// Unit tests for the host-capability manifest normalizer + registry resolver
// (`_lib/host_capability.ts`).
//
// The contract under test (host-capability-manifest.md): the safe default is
// ALL boolean fields `false`, a missing or invalidly-typed field resolves to
// `false` (never `true`), and `schema_version` is always forced to `1`. These
// cases lock that safe-default-first behavior so an unknown host is never
// assumed to support a subagent primitive it does not have.
//
// `resolveHostCapabilities` (F5, road-to-orchestrator-discipline-carriers)
// layers a committed registry in front of the safe default: explicit
// settings override (wins, whole-object) → registry row for the detected
// host → SAFE_DEFAULT. The registry-hit / registry-miss / override-beats-
// registry cases below lock that order; the end-to-end block feeds a
// resolved manifest straight into `classifyTask` (auto_dispatch.ts) so the
// activation gate itself — not just the manifest shape — is exercised.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { afterEach, beforeEach } from 'vitest';

import {
    describeHostCapabilities,
    normalizeHostManifest,
    probeHostCapabilities,
    resolveHostCapabilities,
    type HostCapabilityManifest,
} from '../../src/scripts/_lib/host_capability.js';
import { classifyTask, type ActivationInputs } from '../../src/scripts/_lib/auto_dispatch.js';

const ALL_FALSE: HostCapabilityManifest = {
    schema_version: 1,
    subagent_spawn: false,
    parallel_spawn: false,
    status_polling: false,
    separate_quota_pool: false,
    agent_teams: false,
    worker_respawn: false,
    reads_project_mcp_config: false,
    // Not `false`: this field's safe answer is "a manual step remains".
    mcp_needs_manual_activation: true,
};

describe('normalizeHostManifest — safe default', () => {
    it('empty object → all false + schema_version 1', () => {
        expect(normalizeHostManifest({})).toEqual(ALL_FALSE);
    });

    it('null / undefined / non-object → all false + schema_version 1', () => {
        expect(normalizeHostManifest(null)).toEqual(ALL_FALSE);
        expect(normalizeHostManifest(undefined)).toEqual(ALL_FALSE);
        expect(normalizeHostManifest('subagent_spawn')).toEqual(ALL_FALSE);
        expect(normalizeHostManifest(42)).toEqual(ALL_FALSE);
        expect(normalizeHostManifest(true)).toEqual(ALL_FALSE);
    });
});

describe('normalizeHostManifest — partial input', () => {
    it('missing fields default to false', () => {
        expect(normalizeHostManifest({ subagent_spawn: true })).toEqual({
            ...ALL_FALSE,
            subagent_spawn: true,
        });
    });
});

describe('normalizeHostManifest — invalid types', () => {
    it('non-boolean field values resolve to the safe default false', () => {
        expect(
            normalizeHostManifest({
                subagent_spawn: 'true',
                parallel_spawn: 1,
                status_polling: {},
                separate_quota_pool: null,
            }),
        ).toEqual(ALL_FALSE);
    });

    it('only strict boolean true survives — truthy non-booleans are false', () => {
        expect(normalizeHostManifest({ subagent_spawn: 'yes' })).toEqual(ALL_FALSE);
    });
});

describe('normalizeHostManifest — valid full input', () => {
    it('preserves every true field and forces schema_version to 1', () => {
        expect(
            normalizeHostManifest({
                schema_version: 99,
                subagent_spawn: true,
                parallel_spawn: true,
                status_polling: true,
                separate_quota_pool: true,
                worker_respawn: true,
            }),
        ).toEqual({
            schema_version: 1,
            subagent_spawn: true,
            parallel_spawn: true,
            status_polling: true,
            separate_quota_pool: true,
            agent_teams: false,
            worker_respawn: true,
            reads_project_mcp_config: false,
            // Absent from the input, and absence does NOT clear a residual.
            mcp_needs_manual_activation: true,
        });
    });

    it('false fields stay false (no accidental flip)', () => {
        expect(
            normalizeHostManifest({
                subagent_spawn: true,
                parallel_spawn: false,
            }),
        ).toEqual({
            ...ALL_FALSE,
            subagent_spawn: true,
        });
    });
});

describe('resolveHostCapabilities — registry hit', () => {
    it("'claude' with no override resolves the committed registry row", () => {
        expect(resolveHostCapabilities('claude')).toEqual({
            ...ALL_FALSE,
            subagent_spawn: true,
            parallel_spawn: true,
        });
    });

    it('registry row fields not observed (polling, quota, respawn) stay false', () => {
        const manifest = resolveHostCapabilities('claude');
        expect(manifest.status_polling).toBe(false);
        expect(manifest.separate_quota_pool).toBe(false);
        // worker_respawn is false on EVERY host until the kill + fresh-spawn
        // primitive is observed on one. Flipping it by inference — spawn exists,
        // kill exists, therefore respawn exists — is the thing this assertion
        // forbids; recycling degrades to stop-loss until someone measures it.
        expect(manifest.worker_respawn).toBe(false);
    });
});

describe('resolveHostCapabilities — registry miss', () => {
    it('unknown host id → all-false safe default, unchanged', () => {
        expect(resolveHostCapabilities('some-unrecognized-host')).toEqual(ALL_FALSE);
    });

    it('null / undefined host id → all-false safe default', () => {
        expect(resolveHostCapabilities(null)).toEqual(ALL_FALSE);
        expect(resolveHostCapabilities(undefined)).toEqual(ALL_FALSE);
    });
});

describe('resolveHostCapabilities — override beats registry', () => {
    it('an explicit override on a known host wins outright (whole-object, not merged)', () => {
        // Registry says `claude` → parallel_spawn: true. An override that
        // does not mention parallel_spawn still wins wholesale — a present
        // override is not merged field-by-field with the registry row.
        expect(resolveHostCapabilities('claude', { subagent_spawn: false })).toEqual(ALL_FALSE);
    });

    it('an override can also grant capabilities the registry never observed', () => {
        expect(
            resolveHostCapabilities('some-unrecognized-host', { subagent_spawn: true }),
        ).toEqual({
            ...ALL_FALSE,
            subagent_spawn: true,
        });
    });

    it('an empty-object override still wins over the registry (whole-object semantics)', () => {
        expect(resolveHostCapabilities('claude', {})).toEqual(ALL_FALSE);
    });

    it('a null override does NOT count as present — falls through to the registry', () => {
        expect(resolveHostCapabilities('claude', null)).toEqual({
            ...ALL_FALSE,
            subagent_spawn: true,
            parallel_spawn: true,
        });
    });
});

describe('resolveHostCapabilities — strict-true coercion unchanged', () => {
    it('a truthy non-boolean override field is still coerced to false', () => {
        expect(resolveHostCapabilities('claude', { subagent_spawn: 'yes' })).toEqual(ALL_FALSE);
    });

    it('a non-object override (string/number) is ignored — falls through to the registry', () => {
        expect(resolveHostCapabilities('claude', 'subagent_spawn')).toEqual({
            ...ALL_FALSE,
            subagent_spawn: true,
            parallel_spawn: true,
        });
        expect(resolveHostCapabilities('claude', 42)).toEqual({
            ...ALL_FALSE,
            subagent_spawn: true,
            parallel_spawn: true,
        });
    });
});

describe('resolveHostCapabilities — array override treated as absent (F8)', () => {
    it('an array override on a known host falls through to the registry row, not an all-false coercion', () => {
        expect(resolveHostCapabilities('claude', ['unexpected', 'array'])).toEqual({
            ...ALL_FALSE,
            subagent_spawn: true,
            parallel_spawn: true,
        });
    });

    it('an empty-array override on an unknown host falls through to SAFE_DEFAULT', () => {
        expect(resolveHostCapabilities('some-unrecognized-host', [])).toEqual(ALL_FALSE);
    });
});

describe('resolveHostCapabilities — end-to-end via classifyTask', () => {
    it('a delegable probe dispatches on the detected host with no settings override', () => {
        const manifest = resolveHostCapabilities('claude');
        const activation: ActivationInputs = {
            halted: false,
            subagent_spawn: manifest.subagent_spawn,
        };
        const verdict = classifyTask(
            { size_estimate: 5, independent_slices: 3 },
            activation,
        );
        expect(verdict.action).toBe('dispatch');
    });

    it('the same probe stays in-session on an unrecognized host (all-false default)', () => {
        const manifest = resolveHostCapabilities('some-unrecognized-host');
        const activation: ActivationInputs = {
            halted: false,
            subagent_spawn: manifest.subagent_spawn,
        };
        const verdict = classifyTask(
            { size_estimate: 5, independent_slices: 3 },
            activation,
        );
        expect(verdict.action).toBe('in-session');
        expect(verdict.reason).toBe('host has no subagent_spawn primitive');
    });
});

describe('probeHostCapabilities — registry merged with live environment facts', () => {
    const ENV_KEY = 'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS';
    let prev: string | undefined;

    beforeEach(() => {
        prev = process.env[ENV_KEY];
        delete process.env[ENV_KEY];
    });

    afterEach(() => {
        if (prev === undefined) {
            delete process.env[ENV_KEY];
        } else {
            process.env[ENV_KEY] = prev;
        }
    });

    it('agent_teams stays false when the env flag is unset', () => {
        expect(probeHostCapabilities('claude').agent_teams).toBe(false);
    });

    it('agent_teams resolves true when the env flag is set (any non-empty value)', () => {
        process.env[ENV_KEY] = '1';
        expect(probeHostCapabilities('claude').agent_teams).toBe(true);
    });

    it('an empty-string env value does NOT count as set', () => {
        process.env[ENV_KEY] = '';
        expect(probeHostCapabilities('claude').agent_teams).toBe(false);
    });

    it('still resolves the committed registry row for the other fields', () => {
        const manifest = probeHostCapabilities('claude');
        expect(manifest.subagent_spawn).toBe(true);
        expect(manifest.parallel_spawn).toBe(true);
    });

    it('an unknown host falls back to the safe default plus the env probe', () => {
        process.env[ENV_KEY] = '1';
        expect(probeHostCapabilities('some-unrecognized-host')).toEqual({
            ...ALL_FALSE,
            agent_teams: true,
        });
    });

    it('takes NO settings-derived override — probeHostCapabilities has no such parameter', () => {
        // Type-level proof: probeHostCapabilities(hostId) is single-arity.
        expect(probeHostCapabilities.length).toBe(1);
    });
});

// road-to-capability-answerability Phase 1.2 — six booleans that look alike
// and are not. A `false` from the safe default records "nobody answered";
// a `false` from a registry row would record "checked, absent". Collapsing
// the two is the defect the provenance map exists to stop.
describe('describeHostCapabilities — per-field provenance', () => {
    const SAVED = process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;

    beforeEach(() => {
        delete process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
    });

    afterEach(() => {
        if (SAVED === undefined) {
            delete process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
        } else {
            process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = SAVED;
        }
    });

    it('attributes the registry row fields to `registry` and the rest to `default`', () => {
        expect(describeHostCapabilities('claude').sources).toEqual({
            subagent_spawn: 'registry',
            parallel_spawn: 'registry',
            status_polling: 'default',
            separate_quota_pool: 'default',
            agent_teams: 'default',
            worker_respawn: 'default',
            reads_project_mcp_config: 'default',
            mcp_needs_manual_activation: 'default',
        });
    });

    it('an unrecognized host attributes EVERY field to `default` — an absence of knowledge', () => {
        const { manifest, sources } = describeHostCapabilities('some-unrecognized-host');
        expect(Object.values(sources).every((s) => s === 'default')).toBe(true);
        // The all-false values are the safe degradation, not a measurement —
        // which is exactly why the provenance has to travel with them.
        expect(manifest).toEqual(ALL_FALSE);
    });

    it('attributes agent_teams to `live-probe` only when the environment flag set it', () => {
        expect(describeHostCapabilities('claude').sources.agent_teams).toBe('default');
        process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = '1';
        expect(describeHostCapabilities('claude').sources.agent_teams).toBe('live-probe');
        expect(describeHostCapabilities('claude').manifest.agent_teams).toBe(true);
    });

    it('a null / undefined host is `default` throughout, never a crash', () => {
        for (const host of [null, undefined]) {
            const { manifest, sources } = describeHostCapabilities(host);
            expect(manifest).toEqual(ALL_FALSE);
            expect(Object.values(sources).every((s) => s === 'default')).toBe(true);
        }
    });

    it('the manifest half CANNOT drift from probeHostCapabilities — same host, same object', () => {
        // Two readers of one fact disagreeing is worse than either answer:
        // the provenance readout is the surface a user runs to check the
        // value the delegation layer gated on, so it must BE that value.
        for (const host of ['claude', 'cursor', 'some-unrecognized-host']) {
            expect(describeHostCapabilities(host).manifest).toEqual(probeHostCapabilities(host));
        }
        process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = 'on';
        expect(describeHostCapabilities('claude').manifest).toEqual(probeHostCapabilities('claude'));
    });
});

// road-to-capability-answerability Phase 1.3 — the template/loader half of
// "the three agree" is already pinned elsewhere (`lint_no_activation_gates`
// fails the build if the shipped template reintroduces a subagent activation
// key, and routing_doctor + delegation_nudge_hook each pin that a leftover
// `subagents.host_capabilities` override no longer applies). What NOTHING
// pinned is the drift that actually shipped: the interface declared six
// capability fields while the contract documented five, so `worker_respawn`
// existed in code and in no document a reader would consult.
describe('host-capability contract ↔ interface parity', () => {
    const HERE = path.dirname(fileURLToPath(import.meta.url));
    const REPO_ROOT = path.resolve(HERE, '..', '..');
    const SOURCE = path.join(REPO_ROOT, 'src/scripts/_lib/host_capability.ts');
    const CONTRACT = path.join(
        REPO_ROOT,
        'src/agent-src/contexts/execution/host-capability-manifest.md',
    );

    /** First capture group of `re` in `text`, or a failed expectation naming what was missing. */
    function capture(text: string, re: RegExp, what: string): string {
        const found = re.exec(text)?.[1];
        // A parse that finds nothing must fail loudly, never pass as "no drift".
        expect(found, `${what} not found`).toBeTypeOf('string');
        return found as string;
    }

    /** Capability fields as DECLARED by the interface — the anchor everything mirrors. */
    function declaredFields(): string[] {
        const body = capture(
            fs.readFileSync(SOURCE, 'utf-8'),
            /export interface HostCapabilityManifest \{([\s\S]*?)\n\}/,
            'the HostCapabilityManifest interface',
        );
        const fields = [...body.matchAll(/^ {4}(\w+):\s*boolean;/gm)].flatMap((m) =>
            m[1] === undefined ? [] : [m[1]],
        );
        expect(fields.length).toBeGreaterThan(0);
        return fields;
    }

    it('every declared field has a row in the contract Fields table', () => {
        const contract = fs.readFileSync(CONTRACT, 'utf-8');
        const documented = [...contract.matchAll(/^\|\s*`(\w+)`\s*\|\s*bool\s*\|/gm)].flatMap((m) =>
            m[1] === undefined ? [] : [m[1]],
        );
        expect(documented.length).toBeGreaterThan(0);
        expect([...documented].sort()).toEqual([...declaredFields()].sort());
    });

    it('every declared field appears in the contract schema example', () => {
        const example = capture(
            fs.readFileSync(CONTRACT, 'utf-8'),
            /```json\n([\s\S]*?)```/,
            'the json schema example',
        );
        const parsed = JSON.parse(example) as Record<string, unknown>;
        for (const field of declaredFields()) {
            expect(Object.keys(parsed)).toContain(field);
        }
    });

    it('the runtime provenance map covers exactly the declared fields', () => {
        // Guards the second drift axis: the field list the provenance walk
        // uses is hand-written, so it can fall behind the interface too.
        expect(Object.keys(describeHostCapabilities('claude').sources).sort()).toEqual(
            [...declaredFields()].sort(),
        );
    });
});
