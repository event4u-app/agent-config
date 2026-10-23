// A `base_url` member: an OpenAI-compatible route the package does not pay for
// by default. Free only with proof; metered otherwise; never silently paid.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { CouncilConfigError, load_council_config } from '../../../src/scripts/ai_council/config.js';
import { resolveRouteTransport } from '../../../src/scripts/ai_council/free_route.js';
import { FreeRouteClient } from '../../../src/scripts/ai_council/free_route_client.js';
import {
    classifyCliFailure,
    isFallbackEligible,
} from '../../../src/scripts/ai_council/transport_resolver.js';
import { build_members, cmd_status, load_settings } from '../../../src/scripts/council_cli.js';

const tmpdirs: string[] = [];
function writeConfig(body: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'council-route-'));
    tmpdirs.push(dir);
    const p = path.join(dir, '.ai-council.yml');
    fs.writeFileSync(p, body, 'utf8');
    return p;
}

afterEach(() => {
    vi.restoreAllMocks();
    while (tmpdirs.length > 0) {
        fs.rmSync(tmpdirs.pop() as string, { recursive: true, force: true });
    }
});

const HEAD = 'enabled: true\ncost_budget:\n  max_total_usd: 20.0\nmembers:\n';

function routeMember(extra: string): string {
    return (
        HEAD +
        '  hands:\n    enabled: true\n    model: some-open-model\n' +
        '    base_url: "https://route.example.test/v1"\n' +
        extra
    );
}

const PROOF =
    '    billing_proof:\n      kind: keyless\n' +
    '      url: "https://route.example.test/docs/free"\n      checked: "2026-10-22"\n';

describe('2.2 — a base_url member is admitted, and its billing class needs proof', () => {
    it('undeclared proof yields per-token', () => {
        const cfg = load_council_config(writeConfig(routeMember('    api_key_ref: env:HANDS_KEY\n')));
        const m = cfg.members.get('hands');
        expect(m?.route?.base_url).toBe('https://route.example.test/v1');
        const t = resolveRouteTransport({ name: 'hands', route: m!.route!, model: m!.model, keyPresent: true, contentClass: 'public-artifact' });
        expect(t.available).toBe(true);
        expect(t.billing).toBe('per-token');
    });

    it('a keyless route with a dated proof is free-quota', () => {
        const cfg = load_council_config(writeConfig(routeMember(PROOF)));
        const m = cfg.members.get('hands')!;
        const t = resolveRouteTransport({ name: 'hands', route: m.route!, model: m.model, contentClass: 'public-artifact' });
        expect(t.available).toBe(true);
        expect(t.billing).toBe('free-quota');
    });

    it('a proof without a date is a config error, not a free seat', () => {
        const body = routeMember(
            '    billing_proof:\n      kind: keyless\n      url: "https://route.example.test/docs/free"\n',
        );
        expect(() => load_council_config(writeConfig(body))).toThrow(CouncilConfigError);
    });

    it('a name outside the five providers without base_url is still refused', () => {
        const body = HEAD + '  hands:\n    enabled: true\n    model: x\n';
        expect(() => load_council_config(writeConfig(body))).toThrow(/unknown provider/);
    });

    it('a free route is forced to the public-artifact ceiling whatever it declares', () => {
        const cfg = load_council_config(writeConfig(routeMember(PROOF + '    content_ceiling: project-content\n')));
        expect(cfg.members.get('hands')?.content_ceiling).toBe('public-artifact');
    });

    it('a non-loopback route over plain http is refused', () => {
        const body = HEAD + '  hands:\n    enabled: true\n    model: x\n    base_url: "http://route.example.test/v1"\n';
        expect(() => load_council_config(writeConfig(body))).toThrow(/https/);
    });
});

describe('2.2 — council:status names the route and its billing class', () => {
    function statusOutput(configPath: string, json = false): string {
        let out = '';
        vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown): boolean => {
            out += String(chunk);
            return true;
        });
        expect(cmd_status({ json } as never, { env: { AI_COUNCIL_CONFIG: configPath } })).toBe(0);
        return out;
    }

    it('council:status output names route + class', () => {
        const p = writeConfig(routeMember(PROOF));
        const text = statusOutput(p);
        expect(text).toMatch(/route\s+hands: https:\/\/route\.example\.test\/v1 · free-quota/);
        const json = JSON.parse(statusOutput(p, true)) as {
            transports: Record<string, { absent_reason: string | null; route: string | null }>;
        };
        // Status resolves against an undeclared payload, which no free route admits.
        expect(json.transports['hands']?.absent_reason).toBe('policy_content_ceiling');
        expect(json.transports['hands']?.route).toBe('https://route.example.test/v1');
    });
});

describe('2.2 — a 402 is an unproven cost, never a paid fallback', () => {
    it('HTTP 402 resolves to policy_unproven_cost and is not fallback-eligible', () => {
        const client = new FreeRouteClient({
            name: 'hands',
            model: 'some-open-model',
            base_url: 'https://route.example.test/v1',
            api_key: null,
            billing: 'free-quota',
            content_ceiling: 'public-artifact',
            post: () => {
                throw new Error('HTTP 402: {"error":"payment required"}');
            },
        });
        const r = client.ask('sys', 'user');
        expect(r.error).toMatch(/^policy_unproven_cost/);
        expect(r.metadata['absent_reason']).toBe('policy_unproven_cost');
        expect(isFallbackEligible(classifyCliFailure(r.error ?? ''))).toBe(false);
    });

    it('a keyless route sends no Authorization header', () => {
        const seen: string[][] = [];
        const client = new FreeRouteClient({
            name: 'hands',
            model: 'm',
            base_url: 'https://route.example.test/v1',
            api_key: null,
            billing: 'free-quota',
            content_ceiling: 'public-artifact',
            post: (_url, headers) => {
                seen.push(headers);
                return { model: 'm', choices: [{ message: { content: 'ok' } }] };
            },
        });
        expect(client.ask('s', 'u').text).toBe('ok');
        expect(seen[0]?.some((h) => h.toLowerCase().startsWith('authorization'))).toBe(false);
        expect(client.billable).toBe(false);
    });

    it('build_members constructs a keyless free route as an unbilled member', () => {
        const members = build_members({
            ai_council: {
                enabled: true,
                members: {
                    hands: {
                        enabled: true,
                        model: 'm',
                        base_url: 'https://route.example.test/v1',
                        billing_proof: { kind: 'keyless', url: 'https://route.example.test/docs', checked: '2026-10-22' },
                    },
                },
            },
        }, { content_class: 'public-artifact' });
        expect(members).toHaveLength(1);
        expect(members[0]).toBeInstanceOf(FreeRouteClient);
        expect(members[0]?.billable).toBe(false);
    });

    it('a route configured in the council file reaches build_members through load_settings', () => {
        const settings = load_settings(undefined, { ai_council_path: writeConfig(routeMember(PROOF)) });
        const members = build_members(settings, { content_class: 'public-artifact' });
        expect(members).toHaveLength(1);
        expect(members[0]).toBeInstanceOf(FreeRouteClient);
        expect((members[0] as FreeRouteClient).billing).toBe('free-quota');
    });

    it('build_members drops a free route for an undeclared (project-content) payload', () => {
        const skipped: Record<string, unknown>[] = [];
        expect(() =>
            build_members(
                {
                    ai_council: {
                        enabled: true,
                        members: { hands: { enabled: true, model: 'm', base_url: 'https://route.example.test/v1' } },
                    },
                },
                { skipped },
            ),
        ).toThrow(/no council member/);
        expect(skipped[0]?.['reason']).toBe('policy_content_ceiling');
    });
});

describe('free-hands 3.4 wiring — the nudge asks the council config whether a free rung exists', () => {
    it('a keyless route with a dated proof is an admissible free rung', async () => {
        const { freeRouteAvailable } = await import('../../../src/scripts/ai_council/free_rung.js');
        expect(freeRouteAvailable(writeConfig(routeMember(PROOF)))).toBe(true);
    });

    it('a route without proof is metered, so no free rung is named', async () => {
        const { freeRouteAvailable } = await import('../../../src/scripts/ai_council/free_rung.js');
        expect(freeRouteAvailable(writeConfig(routeMember('    api_key_ref: env:HANDS_KEY_UNSET_X\n')))).toBe(false);
    });

    it('a missing or unreadable config names no free rung', async () => {
        const { freeRouteAvailable } = await import('../../../src/scripts/ai_council/free_rung.js');
        expect(freeRouteAvailable(path.join(os.tmpdir(), 'no-such-council-config.yml'))).toBe(false);
        expect(freeRouteAvailable(writeConfig(': not yaml ::'))).toBe(false);
    });
});

describe('free-hands 6.3 wiring — the nudge names the free rung only for a flipped kind', () => {
    it('an unflipped kind names no free rung even with an admissible route; a flipped one does', async () => {
        const { freeRungFor } = await import('../../../src/scripts/ai_council/free_rung.js');
        const { KIND_FLIPS_RELPATH } = await import('../../../src/scripts/ai_council/kind_flip.js');
        const cfg = writeConfig(routeMember(PROOF));
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'free-rung-'));
        tmpdirs.push(root);
        expect(freeRungFor(root, 'classify', cfg)).toBe(false);
        fs.mkdirSync(path.dirname(path.join(root, KIND_FLIPS_RELPATH)), { recursive: true });
        fs.writeFileSync(path.join(root, KIND_FLIPS_RELPATH), JSON.stringify({ kinds: { classify: { route: 'free' } } }));
        expect(freeRungFor(root, 'classify', cfg)).toBe(true);
        expect(freeRungFor(root, 'extract', cfg)).toBe(false);
        expect(freeRungFor(root, 'classify', null)).toBe(false);
    });
});
