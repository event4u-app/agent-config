// road-to-a-page-that-says-what-it-loads 4.1: the write-time reach of the
// third-party and legal-page rows. The blindspots table is the surface a model
// reads while writing markup; each row must point at the checker row that backs it.
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/scripts/check_web_launch_readiness';

const REPO = path.resolve(__dirname, '..', '..');
const SKILL = fs.readFileSync(path.join(REPO, 'src/skills/ai-code-blindspots/SKILL.md'), 'utf8');
const row = (label: string): string => SKILL.split('\n').find((l) => l.startsWith(`| **${label}`)) ?? '';

describe('ai-code-blindspots carries the outward rows', () => {
    it('the third-party row covers iframes and names its backstop', () => {
        const r = row('Third-party resource in shipped markup');
        expect(r).toMatch(/iframes/);
        expect(r).toMatch(/click-to-load/);
        expect(r).toMatch(/preconnect/);
        expect(r).toContain('third-party-load-in-markup');
    });

    it('the legal-page row sends statute names to the dated config, never to memory', () => {
        const r = row('Legal-page boilerplate');
        expect(r).toMatch(/never from model memory/);
        for (const id of ['superseded-statute-in-legal-page', 'placeholder-in-legal-page', 'privacy-page-provider-coverage']) {
            expect(r).toContain(id);
        }
    });

    it('every checker row the table names exists in the config', () => {
        const ids = new Set(loadConfig(REPO).checks.map((c) => c.id));
        const named = [...SKILL.matchAll(/`([a-z]+(?:-[a-z]+){2,})`/g)].map((m) => m[1]!).filter((n) => /in-markup|legal-page|provider-coverage/.test(n));
        expect(named.length).toBeGreaterThan(0);
        for (const n of named) expect(ids.has(n), n).toBe(true);
    });
});
