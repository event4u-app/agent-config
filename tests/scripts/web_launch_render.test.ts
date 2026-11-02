// road-to-a-page-that-says-what-it-loads Phase 3: the offline render witness.
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { applyRenderWitness, audit } from '../../src/scripts/check_web_launch_readiness';
import { fileFor, renderWitness, routeDecision } from '../../src/scripts/web_launch_render';
import { loadRegister } from '../../src/scripts/web_launch_third_party';

const REPO = path.resolve(__dirname, '..', '..');
const CORPUS = path.join(REPO, 'tests', 'fixtures', 'third-party-load');

describe('fileFor — the synthetic origin is confined to the build', () => {
    it('serves a file inside and refuses a traversal', () => {
        const build = path.join(CORPUS, 'planted');
        expect(fileFor(build, 'https://site.invalid/index.html')).toMatch(/planted\/index\.html$/);
        expect(fileFor(build, 'https://site.invalid/')).toMatch(/planted\/index\.html$/);
        expect(fileFor(build, 'https://site.invalid/../ground-truth.json')).toBeNull();
        expect(fileFor(build, 'https://site.invalid/%2e%2e/ground-truth.json')).toBeNull();
    });
});

describe('applyRenderWitness — pure reconciliation', () => {
    const register = loadRegister(REPO, '2026-11-02');
    const gatedBuild = (): string => {
        const dir = fs.mkdtempSync(path.join(REPO, 'agents', 'runtime', 'tmp-render-'));
        fs.writeFileSync(
            path.join(dir, 'kontakt.html'),
            '<!doctype html><html lang="de"><head><title>K</title></head><body>\n' +
                '<div class="click-to-load"><iframe src="https://www.google.com/maps/embed?pb=1"></iframe></div>\n</body></html>\n',
        );
        return dir;
    };
    const tpl = 'third-party-load-in-markup';

    it('a gate whose URL is requested anyway becomes a finding', () => {
        const dir = gatedBuild();
        try {
            const r = audit(dir, 'local-business', REPO);
            expect(r.unknown.some((u) => u.check === tpl)).toBe(true);
            const out = applyRenderWitness(
                r,
                { status: 'ok', requests: [{ page: 'kontakt.html', url: 'https://www.google.com/maps/embed?pb=1' }], continued: [], pages: 1 },
                register,
            );
            expect(out.unknown.some((u) => u.check === tpl)).toBe(false);
            expect(out.findings.some((f) => f.check === tpl && /render witness/.test(f.evidence))).toBe(true);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('a gate whose URL is never requested passes', () => {
        const dir = gatedBuild();
        try {
            const out = applyRenderWitness(
                audit(dir, 'local-business', REPO),
                { status: 'ok', requests: [], continued: [], pages: 1 },
                register,
            );
            expect(out.unknown.some((u) => u.check === tpl)).toBe(false);
            expect(out.passed).toContain(tpl);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('an unverified witness is undecided, never a pass', () => {
        const r = audit(path.join(CORPUS, 'safe'), 'local-business', REPO);
        expect(r.passed).toContain(tpl);
        const out = applyRenderWitness(r, { status: 'unverified', reason: 'no driver', requests: [], continued: [], pages: 0 }, register);
        expect(out.passed).not.toContain(tpl);
        expect(out.unknown.some((u) => u.check === tpl && /unverified/.test(u.reason))).toBe(true);
    });

    it('a script-injected registered load static reading missed is a finding; an unknown one is undecided', () => {
        const r = audit(path.join(CORPUS, 'safe'), 'local-business', REPO);
        const out = applyRenderWitness(
            r,
            {
                status: 'ok',
                requests: [
                    { page: 'index.html', url: 'https://www.youtube.com/iframe_api' },
                    { page: 'index.html', url: 'https://cdn.unknown-vendor.example/x.js' },
                ],
                continued: [],
                pages: 1,
            },
            register,
        );
        expect(out.findings.some((f) => f.check === tpl && f.evidence.includes('www.youtube.com'))).toBe(true);
        expect(out.unknown.some((u) => u.check === tpl && u.reason.includes('cdn.unknown-vendor.example'))).toBe(true);
    });
});

describe('state boundary (3.2)', () => {
    it('closes the browser in finally when the context throws', async () => {
        const close = vi.fn(async () => undefined);
        const playwright = {
            chromium: {
                launch: async () => ({
                    close,
                    newContext: async () => {
                        throw new Error('boom');
                    },
                }),
            },
        } as never;
        await expect(renderWitness(path.join(CORPUS, 'safe'), { playwright })).rejects.toThrow('boom');
        expect(close).toHaveBeenCalledTimes(1);
    });

    it('no driver is unverified, never a pass', async () => {
        const w = await renderWitness(path.join(CORPUS, 'safe'), { playwright: null });
        expect(w.status).toBe('unverified');
    });
});

describe('routeDecision — nothing leaves the machine', () => {
    it('fulfils the synthetic origin, keeps in-page schemes, records and aborts the network, aborts file:', () => {
        expect(routeDecision('https://site.invalid/index.html')).toBe('fulfil');
        expect(routeDecision('data:text/plain,x')).toBe('continue');
        expect(routeDecision('https://fonts.googleapis.com/css2')).toBe('record-abort');
        expect(routeDecision('wss://example.com/socket')).toBe('record-abort');
        expect(routeDecision('file:///etc/passwd')).toBe('abort');
        expect(routeDecision('https://site.invalid.evil.example/x')).toBe('record-abort');
    });
});
