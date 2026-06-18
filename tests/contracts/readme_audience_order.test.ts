// README audience-heading order contract (PURE-TS port of
// tests/contracts/test_readme_audience_order.py).
//
// The README must open with three audience-focused `##` headings in the fixed
// order `Use it in your project` → `Prove it` → `Contribute` so consumer-side
// readers can self-route by role, all before `## Quickstart`. AI Council is a
// maintainer-only surface and MUST NOT appear in the user-facing branches.
//
// No python, no oracle: the "twin" is the README itself — read it and assert.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const README = path.join(REPO_ROOT, 'README.md');

const AUDIENCE_HEADINGS = [
    '## Use it in your project',
    '## Prove it',
    '## Contribute',
] as const;

function readmeText(): string {
    return fs.readFileSync(README, 'utf-8');
}

describe('README audience-heading contract', () => {
    it('all three audience headings are present', () => {
        const text = readmeText();
        for (const heading of AUDIENCE_HEADINGS) {
            expect(text, `missing audience heading: ${JSON.stringify(heading)}`).toContain(heading);
        }
    });

    it('headings appear in Use → Prove → Contribute order', () => {
        const text = readmeText();
        const positions = AUDIENCE_HEADINGS.map((h) => text.indexOf(h));
        const sorted = [...positions].sort((a, b) => a - b);
        expect(positions).toEqual(sorted);
    });

    it('all audience headings appear before `## Quickstart`', () => {
        const text = readmeText();
        const quickstartIdx = text.indexOf('## Quickstart');
        expect(quickstartIdx).toBeGreaterThanOrEqual(0);
        for (const heading of AUDIENCE_HEADINGS) {
            expect(
                text.indexOf(heading),
                `${JSON.stringify(heading)} must appear before '## Quickstart'`,
            ).toBeLessThan(quickstartIdx);
        }
    });

    it('no AI Council / /council references in the user-facing branches', () => {
        const text = readmeText();
        const start = text.indexOf(AUDIENCE_HEADINGS[0]);
        const end = text.indexOf(AUDIENCE_HEADINGS[2]);
        const userFacing = text.slice(start, end);
        // (?i)\b(?:ai[\s-]?council|/council)\b
        const pattern = /\b(?:ai[\s-]?council|\/council)\b/gi;
        const matches = userFacing.match(pattern) ?? [];
        expect(matches).toEqual([]);
    });
});
