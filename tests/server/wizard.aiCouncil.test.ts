/**
 * AI Council wizard endpoints — road-to-wizard-ux-improvements § Phase 8.
 *
 *   GET  /api/v1/wizard/ai-council → controlled scalar subset + providers +
 *                                    key presence (seeded from the package's
 *                                    .ai-council.yml when the writeRoot has none).
 *   POST /api/v1/wizard/ai-council → comment-preserving scalar merge via
 *                                    replaceScalar, atomic-written under writeRoot.
 *   Both 404 when extended-mode is off.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bootTestApp, authHeaders, type TestApp } from './helpers.js';

const PORT = 41652;

interface CouncilGet {
    config: {
        enabled: boolean;
        defaults: { mode: string; min_rounds: number };
        cost_budget: { max_total_usd: number };
        members: Record<string, { enabled: boolean; participate_low_impact: boolean }>;
        decision: Record<string, string>;
    };
    providers: string[];
    keyPresence: Record<string, boolean>;
    keyInstall: Record<string, string>;
}

describe('wizard ai-council (Phase 8)', () => {
    let ctx: TestApp;
    afterEach(async () => { if (ctx) await ctx.cleanup(); });

    it('GET returns the controlled subset, the 5 providers, and the key-install map', async () => {
        ctx = await bootTestApp({ port: PORT, extendedSteps: true });
        const res = await ctx.app.inject({
            method: 'GET', url: '/api/v1/wizard/ai-council', headers: authHeaders(ctx.token, ctx.host),
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as CouncilGet;
        expect(body.providers).toEqual(['anthropic', 'openai', 'gemini', 'xai', 'perplexity']);
        expect(typeof body.config.enabled).toBe('boolean');
        expect(body.config.members.anthropic).toBeDefined();
        // Only anthropic + openai ship an interactive key installer.
        expect(body.keyInstall.anthropic).toContain('install_anthropic_key.sh');
        expect(body.keyInstall.openai).toContain('install_openai_key.sh');
        expect(body.keyInstall.gemini).toBeUndefined();
    });

    it('POST applies scalar changes (comment-preserving) and GET reflects them', async () => {
        ctx = await bootTestApp({ port: PORT + 1, extendedSteps: true });
        const post = await ctx.app.inject({
            method: 'POST',
            url: '/api/v1/wizard/ai-council',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json' },
            payload: {
                enabled: false,
                minRounds: 3,
                maxTotalUsd: 7.5,
                members: { anthropic: { enabled: false } },
                decision: { medium_impact: 'agent' },
            },
        });
        expect(post.statusCode).toBe(200);

        const written = readFileSync(join(ctx.projectRoot, 'settings', '.ai-council.yml'), 'utf8');
        // Scalars updated …
        expect(written).toMatch(/^enabled:\s*false\b/m);
        expect(written).toMatch(/min_rounds:\s*3\b/);
        expect(written).toMatch(/max_total_usd:\s*7\.5\b/);
        // … and the hand-tuned comments survived the surgical edit.
        expect(written).toContain('#');
        expect(written).toMatch(/LOCKED/);

        const get = (await ctx.app.inject({
            method: 'GET', url: '/api/v1/wizard/ai-council', headers: authHeaders(ctx.token, ctx.host),
        })).json() as CouncilGet;
        expect(get.config.enabled).toBe(false);
        expect(get.config.defaults.min_rounds).toBe(3);
        expect(get.config.cost_budget.max_total_usd).toBe(7.5);
        expect(get.config.members.anthropic.enabled).toBe(false);
        expect(get.config.decision.medium_impact).toBe('agent');
    });

    it('404 when extended-mode is off', async () => {
        ctx = await bootTestApp({ port: PORT + 2 });
        const res = await ctx.app.inject({
            method: 'GET', url: '/api/v1/wizard/ai-council', headers: authHeaders(ctx.token, ctx.host),
        });
        expect(res.statusCode).toBe(404);
    });
});
