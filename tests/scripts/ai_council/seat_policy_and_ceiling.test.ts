// road-to-admissible-council-seats 2.1 + 2.2.
//
// 2.1 — `AbsentReason` was four values, all meaning "not reachable". A route
// that IS reachable and must not be used had no name, and `resolveTransport`'s
// `api`/`cli` branches return `available: true` UNCONDITIONALLY — so every
// refusal the four values could not express resolved OPEN. That is this
// roadmap's Risk 3, and the tests below assert the closed default directly
// rather than trusting the new vocabulary to be used correctly.
//
// 2.2 — one binary content ceiling per seat. Redaction underneath is a secrets
// floor; a consumer diff carrying no secret is still private source.

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    resolveTransport,
    type AbsentReason,
} from '../../../src/scripts/ai_council/transport_resolver.js';
import {
    POLICY_EXCLUSIONS,
    classifyPolicyExclusion,
    isPolicyExclusion,
} from '../../../src/scripts/ai_council/seat_policy.js';
import {
    admitsContent,
    classifyContentClass,
} from '../../../src/scripts/ai_council/content_ceiling.js';
import { load_council_config } from '../../../src/scripts/ai_council/config.js';
import { cmd_status } from '../../../src/scripts/council_cli.js';
import type { EnvironmentReport } from '../../../src/scripts/_lib/environment_detector.js';

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/** A report in which the provider is fully REACHABLE — key present, so the
 *  `auto` chain would otherwise resolve `api · available`. That is the point:
 *  a policy refusal has to beat reachability, not ride on its absence. */
const REACHABLE: EnvironmentReport = {
    hosts: [],
    auth: [{ provider: 'xai', source: 'env-key' }],
} as unknown as EnvironmentReport;

function resolve(over: Record<string, unknown>) {
    return resolveTransport({
        provider: 'xai',
        mode: 'auto',
        report: REACHABLE,
        ...over,
    } as never);
}

describe('2.1 — every policy reason round-trips through the resolver', () => {
    it('resolves absent, names the reason, and never reports a transport', () => {
        for (const reason of POLICY_EXCLUSIONS) {
            const r = resolve({ policyExclusion: reason });
            expect(r.available, reason).toBe(false);
            expect(r.transport, reason).toBeNull();
            expect(r.absentReason, reason).toBe(reason);
            expect(r.reason ?? '', reason).toContain('excluded by policy');
            // Over-gated billing survives: an unavailable seat is never "free".
            expect(r.makesProviderCall, reason).toBe(false);
        }
    });

    it('the same seat WITHOUT an exclusion is available — the refusal is the cause', () => {
        const r = resolve({});
        expect(r.available).toBe(true);
        expect(r.transport).toBe('api');
        expect(r.absentReason).toBeNull();
    });

    it('an unproven-cost route resolves absent rather than available', () => {
        const r = resolve({ policyExclusion: 'policy_unproven_cost' });
        expect(r.available).toBe(false);
        expect(r.absentReason).toBe('policy_unproven_cost');
        expect(r.reason ?? '').toContain('asserted, not proven');
    });

    it('an explicit api/cli mode does not escape the refusal', () => {
        // The branch these two modes take returns `available: true` with no
        // checks at all, so a refusal placed after it would be unreachable.
        for (const mode of ['api', 'cli']) {
            const r = resolve({ mode, policyExclusion: 'policy_terms' });
            expect(r.available, mode).toBe(false);
            expect(r.absentReason, mode).toBe('policy_terms');
        }
    });
});

describe('2.1 — the unknown case fails closed', () => {
    it('an unrecognised token becomes policy_unknown, never null', () => {
        expect(classifyPolicyExclusion('policy_whatever_next')).toBe('policy_unknown');
        expect(classifyPolicyExclusion(42)).toBe('policy_unknown');
        expect(classifyPolicyExclusion({})).toBe('policy_unknown');
        expect(classifyPolicyExclusion('')).toBe('policy_unknown');
    });

    it('only an absent field means "no exclusion"', () => {
        expect(classifyPolicyExclusion(null)).toBeNull();
        expect(classifyPolicyExclusion(undefined)).toBeNull();
    });

    it('a config typo refuses the seat instead of authorising it', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seat-policy-'));
        const p = path.join(dir, '.ai-council.yml');
        fs.writeFileSync(
            p,
            'enabled: true\ncost_budget:\n  max_total_usd: 20.0\nmembers:\n' +
                '  anthropic:\n    enabled: true\n    model: claude-sonnet-4-5\n' +
                '    api_key_ref: env:ANTHROPIC_KEY\n' +
                '    policy_exclusion: "polcy_terms"\n',
            'utf8',
        );
        const m = load_council_config(p).members.get('anthropic');
        expect(m?.policy_exclusion).toBe('policy_unknown');
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('isPolicyExclusion does not admit a reachability reason', () => {
        for (const r of ['no_binary', 'no_auth', 'timeout', 'quota'] as AbsentReason[]) {
            expect(isPolicyExclusion(r)).toBe(false);
        }
    });
});

describe('2.2 — one binary content ceiling per seat', () => {
    it('consumer content into a public-artifact seat is refused, greenly', () => {
        const r = resolve({ seatCeiling: 'public-artifact', contentClass: 'project-content' });
        expect(r.available).toBe(false);
        expect(r.absentReason).toBe('policy_content_ceiling');
        expect(r.reason ?? '').toContain('public-artifact');
        // "The run stays green": a refusal is a verdict, not a thrown error.
        expect(() =>
            resolve({ seatCeiling: 'public-artifact', contentClass: 'project-content' }),
        ).not.toThrow();
    });

    it('a repo-owned artefact into the SAME seat is admitted', () => {
        const r = resolve({ seatCeiling: 'public-artifact', contentClass: 'public-artifact' });
        expect(r.available).toBe(true);
        expect(r.absentReason).toBeNull();
    });

    it('a project-content seat admits both classes', () => {
        expect(admitsContent('project-content', 'project-content').admitted).toBe(true);
        expect(admitsContent('project-content', 'public-artifact').admitted).toBe(true);
    });

    it('an undeclared content class runs no check at all', () => {
        // Every pre-2.2 caller passes no content class; behaviour is identical.
        const r = resolve({ seatCeiling: 'public-artifact' });
        expect(r.available).toBe(true);
    });

    it('an unrecognised ceiling narrows rather than widens', () => {
        expect(classifyContentClass('public')).toBe('project-content');
        expect(classifyContentClass(undefined)).toBe('project-content');
        expect(classifyContentClass('public-artifact')).toBe('public-artifact');
    });

    it('the shipped default ceiling is unchanged behaviour for every seat', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seat-ceiling-'));
        const p = path.join(dir, '.ai-council.yml');
        fs.writeFileSync(
            p,
            'enabled: true\ncost_budget:\n  max_total_usd: 20.0\nmembers:\n' +
                '  anthropic:\n    enabled: true\n    model: claude-sonnet-4-5\n' +
                '    api_key_ref: env:ANTHROPIC_KEY\n',
            'utf8',
        );
        expect(load_council_config(p).members.get('anthropic')?.content_ceiling).toBe(
            'project-content',
        );
        fs.rmSync(dir, { recursive: true, force: true });
    });
});

describe('2.1/2.2 — council:status prints the policy reason and the ceiling', () => {
    const dirs: string[] = [];
    afterEach(() => {
        vi.restoreAllMocks();
        while (dirs.length > 0) fs.rmSync(dirs.pop() as string, { recursive: true, force: true });
    });

    function statusFor(extra: string, json = false): string {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seat-status-'));
        dirs.push(dir);
        const p = path.join(dir, '.ai-council.yml');
        fs.writeFileSync(
            p,
            'enabled: true\ncost_budget:\n  max_total_usd: 20.0\nmembers:\n' +
                '  anthropic:\n    enabled: true\n    model: claude-sonnet-4-5\n' +
                '    api_key_ref: env:ANTHROPIC_KEY\n' +
                extra,
            'utf8',
        );
        let out = '';
        vi.spyOn(process.stdout, 'write').mockImplementation((c: unknown): boolean => {
            out += String(c);
            return true;
        });
        expect(cmd_status({ json } as never, { env: { AI_COUNCIL_CONFIG: p } })).toBe(0);
        return out;
    }

    it('names the machine-readable policy reason on the human surface', () => {
        const out = statusFor('    policy_exclusion: policy_unproven_cost\n');
        expect(out).toContain('policy           anthropic: policy_unproven_cost');
        expect(out).toContain('unavailable');
    });

    it('prints the seat ceiling for every enabled seat', () => {
        expect(statusFor('    content_ceiling: public-artifact\n')).toContain(
            'content ceiling  anthropic: public-artifact',
        );
        expect(statusFor('')).toContain('content ceiling  anthropic: project-content');
    });

    it('carries both into --json alongside the absent reason', () => {
        const parsed = JSON.parse(
            statusFor('    policy_exclusion: policy_privacy\n    content_ceiling: public-artifact\n', true),
        ) as { transports: Record<string, Record<string, unknown>> };
        const t = parsed.transports['anthropic'] as Record<string, unknown>;
        expect(t['available']).toBe(false);
        expect(t['absent_reason']).toBe('policy_privacy');
        expect(t['policy_exclusion']).toBe('policy_privacy');
        expect(t['content_ceiling']).toBe('public-artifact');
    });
});
