/**
 * Tests for POST /api/v1/modules/apply — the standalone modules-persist
 * endpoint backing the Projekt page (replaces the wizard-finish modules
 * payload). Covers the validation gate and the auth gate; the happy path
 * (spawning apply_modules_config.py) is exercised via the wizard-finish
 * integration path and is not duplicated here.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { bootTestApp, authHeaders, type TestApp } from './helpers.js';

describe('POST /api/v1/modules/apply', () => {
    let t: TestApp;

    afterEach(async () => {
        if (t) await t.cleanup();
    });

    it('rejects an unauthenticated request with 401', async () => {
        t = await bootTestApp({ port: 41991, extendedSteps: true });
        const res = await t.app.inject({
            method: 'POST',
            url: '/api/v1/modules/apply',
            headers: { host: t.host, 'content-type': 'application/json' },
            payload: { enabled: true, root_paths: [] },
        });
        expect(res.statusCode).toBe(401);
    });

    it('returns 422 on a malformed modulesConfig body', async () => {
        t = await bootTestApp({ port: 41992, extendedSteps: true });
        const res = await t.app.inject({
            method: 'POST',
            url: '/api/v1/modules/apply',
            headers: authHeaders(t.token, t.host),
            payload: { enabled: 'yes', root_paths: 'not-an-array' },
        });
        expect(res.statusCode).toBe(422);
        const body = res.json() as { error?: { code?: string } };
        expect(body.error?.code).toBe('VALIDATION');
    });
});
