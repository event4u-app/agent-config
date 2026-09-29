/**
 * The `traffic_environment` block and the moved `offline-readiness` check —
 * `road-to-host-traffic-knobs-that-ship` Phases 2.1 and 2.2.
 *
 * The load-bearing property is that a row is NEVER omitted. An implementation
 * that lists only the variables resolving on the current host produces a short,
 * clean section on a host that documents none of them, and a short clean section
 * reads as a clean bill of health. Every case below drives a direction that
 * implementation would have got wrong: the non-Claude fixture asserts presence
 * plus the literal state, and the set-but-inapplicable case asserts that the
 * value survives the state.
 *
 * `offline-readiness` is asserted as a PURE MOVE — the same id, status, message
 * and remedy strings the check emitted from `cmd_doctor.ts`, so a rewrite
 * disguised as a move reds here.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
    NOT_APPLICABLE,
    TRAFFIC_DOC,
    TRAFFIC_VARIABLES,
    UNKNOWN_HOST,
    checkOfflineReadiness,
    resolveTrafficHost,
    trafficEnvironmentJson,
    type EnvMap,
    type TrafficRow,
} from '../../src/scripts/_cli/doctor_network_posture.js';

/** A host fixture that is not Claude Code — Phase 2.2's non-Claude host. */
const NON_CLAUDE = { host: 'cursor', observed: true };

const tmpRoots: string[] = [];

function mkTmpRoot(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-network-posture-'));
    tmpRoots.push(root);
    return root;
}

afterAll(() => {
    for (const root of tmpRoots) fs.rmSync(root, { recursive: true, force: true });
});

function rows(payload: Record<string, unknown>): TrafficRow[] {
    return payload['rows'] as TrafficRow[];
}

describe('the documented variable set', () => {
    it('carries the four variables the roadmap names, each with a dated check', () => {
        expect(TRAFFIC_VARIABLES.map((v) => v.variable)).toEqual([
            'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
            'DISABLE_AUTOUPDATER',
            'BASH_MAX_OUTPUT_LENGTH',
            'MAX_MCP_OUTPUT_TOKENS',
        ]);
        // An undated row is an unverified claim, so the date is part of the row,
        // not part of the prose around it.
        for (const v of TRAFFIC_VARIABLES) {
            expect(v.checked_against).toMatch(/\d{4}-\d{2}-\d{2}$/);
            expect(v.hosts.length).toBeGreaterThan(0);
        }
    });

    it('keeps the blanket variable and the auto-updater variable as separate rows', () => {
        const names = TRAFFIC_VARIABLES.map((v) => v.variable);
        expect(names).toContain('CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC');
        expect(names).toContain('DISABLE_AUTOUPDATER');
        expect(new Set(names).size).toBe(names.length);
    });
});

describe('host resolution', () => {
    it('reads a Claude Code marker as an OBSERVED host', () => {
        expect(resolveTrafficHost({ CLAUDECODE: '1' })).toEqual({ host: 'claude-code', observed: true });
        expect(resolveTrafficHost({ CLAUDE_CODE_SESSION_ID: 'abc' })).toEqual({
            host: 'claude-code',
            observed: true,
        });
    });

    it('reads no marker as UNKNOWN and NOT observed, never as a guessed host', () => {
        expect(resolveTrafficHost({})).toEqual({ host: UNKNOWN_HOST, observed: false });
        // An empty export is nobody saying anything, not a host identifying itself.
        expect(resolveTrafficHost({ CLAUDECODE: '', CLAUDE_CODE_SESSION_ID: '   ' })).toEqual({
            host: UNKNOWN_HOST,
            observed: false,
        });
    });
});

describe('trafficEnvironmentJson on the documenting host', () => {
    const env: EnvMap = {
        CLAUDECODE: '1',
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
        BASH_MAX_OUTPUT_LENGTH: '60000',
    };

    it('reports set-with-value and unset-with-null, one row per variable', () => {
        const payload = trafficEnvironmentJson(env);
        expect(payload['host']).toBe('claude-code');
        expect(payload['host_observed']).toBe(true);
        expect(payload['doc']).toBe(TRAFFIC_DOC);
        expect(payload['read_only']).toBe(true);

        const byName = new Map(rows(payload).map((r) => [r.variable, r]));
        expect(rows(payload)).toHaveLength(TRAFFIC_VARIABLES.length);

        expect(byName.get('CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC')).toMatchObject({
            state: 'set',
            value: '1',
        });
        expect(byName.get('BASH_MAX_OUTPUT_LENGTH')).toMatchObject({ state: 'set', value: '60000' });
        expect(byName.get('DISABLE_AUTOUPDATER')).toMatchObject({ state: 'unset', value: null });
        expect(byName.get('MAX_MCP_OUTPUT_TOKENS')).toMatchObject({ state: 'unset', value: null });
    });

    it('treats an empty export as unset rather than as a set-but-blank value', () => {
        const payload = trafficEnvironmentJson({ CLAUDECODE: '1', DISABLE_AUTOUPDATER: '' });
        const row = rows(payload).find((r) => r.variable === 'DISABLE_AUTOUPDATER');
        expect(row).toMatchObject({ state: 'unset', value: null });
    });

    it('is read-only: two calls are deep-equal and neither mutates the env it was given', () => {
        const given = { ...env };
        const first = trafficEnvironmentJson(given);
        const second = trafficEnvironmentJson(given);
        expect(second).toEqual(first);
        expect(given).toEqual(env);
    });
});

describe('trafficEnvironmentJson on a host that documents none of them', () => {
    it('emits every row, and every row reads the literal not-applicable state', () => {
        const payload = trafficEnvironmentJson({}, NON_CLAUDE);
        expect(payload['host']).toBe('cursor');
        expect(rows(payload)).toHaveLength(TRAFFIC_VARIABLES.length);
        for (const row of rows(payload)) {
            expect(row.state).toBe(NOT_APPLICABLE);
        }
        // The failure this asserts against is OMISSION: a section listing only
        // what resolved would pass a "no wrong row" check and still be the bug.
        expect(rows(payload).map((r) => r.variable)).toEqual(TRAFFIC_VARIABLES.map((v) => v.variable));
    });

    it('still reports the value of a variable that is set but not read here', () => {
        const payload = trafficEnvironmentJson({ DISABLE_AUTOUPDATER: '1' }, NON_CLAUDE);
        const row = rows(payload).find((r) => r.variable === 'DISABLE_AUTOUPDATER');
        expect(row).toMatchObject({ state: NOT_APPLICABLE, value: '1' });
    });

    it('resolves an unidentified host the same way, with host_observed false', () => {
        const payload = trafficEnvironmentJson({});
        expect(payload['host']).toBe(UNKNOWN_HOST);
        expect(payload['host_observed']).toBe(false);
        // Length FIRST: a `for` over an omitting implementation's empty array
        // passes vacuously, which the 2026-09-29 sensitivity probe caught.
        expect(rows(payload)).toHaveLength(TRAFFIC_VARIABLES.length);
        for (const row of rows(payload)) expect(row.state).toBe(NOT_APPLICABLE);
    });
});

describe('checkOfflineReadiness — a pure move out of cmd_doctor', () => {
    it('is ok when the hermetic-install entrypoint is present', () => {
        const root = mkTmpRoot();
        fs.mkdirSync(path.join(root, 'src', 'scripts'), { recursive: true });
        fs.writeFileSync(path.join(root, 'src', 'scripts', 'hermetic-install.sh'), '#!/bin/sh\n');
        expect(checkOfflineReadiness(root)).toEqual({
            id: 'offline-readiness',
            status: 'ok',
            message: 'verified-offline install entrypoint present',
            remedy: '',
        });
    });

    it('warns with the original message when it is absent', () => {
        expect(checkOfflineReadiness(mkTmpRoot())).toEqual({
            id: 'offline-readiness',
            status: 'warn',
            message: 'src/scripts/hermetic-install.sh not found in package',
            remedy: 'reinstall @event4u/agent-config or pull missing files',
        });
    });
});
