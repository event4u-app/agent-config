import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONTRACT = path.join(REPO, 'docs/contracts/ratification-artifact.md');

/**
 * The two things step 5.3 asks the contract to carry. Exported as a predicate
 * over TEXT rather than asserted inline over the file, so the test can prove
 * its own sensitivity against a counter-fixture — a doc assertion that has
 * never been seen red is a test of the filesystem, not of the contract.
 */
export function ownerRouteClaims(text: string): {
    namesTheRoute: boolean;
    namesTheForgeAct: boolean;
    refusesAChatAnswer: boolean;
    statesWhatItCannotProve: boolean;
} {
    return {
        namesTheRoute: /###\s+The owner-permission-route/.test(text),
        namesTheForgeAct: /recorded bypass on the forge/i.test(text),
        refusesAChatAnswer: /never as a chat answer/i.test(text),
        statesWhatItCannotProve: /What this route cannot prove/i.test(text),
    };
}

describe('5.3 — the owner route the second blocker chose, and its stated limit', () => {
    const text = fs.readFileSync(CONTRACT, 'utf8');

    it('the contract names the route as a section of its own', () => {
        expect(ownerRouteClaims(text).namesTheRoute).toBe(true);
    });

    it('the route is the forge act, and a chat answer is refused by name', () => {
        const c = ownerRouteClaims(text);
        expect(c.namesTheForgeAct).toBe(true);
        expect(c.refusesAChatAnswer).toBe(true);
    });

    it('and it states what the route CANNOT prove — the half 5.3 asks for', () => {
        expect(ownerRouteClaims(text).statesWhatItCannotProve).toBe(true);
        // The limit itself, not merely a heading promising one.
        expect(text).toMatch(/gate cannot see a forge bypass/i);
        expect(text).toMatch(/nothing proves the ask preceded it/i);
    });

    it('a non-passing record stays red — the route does not launder the verdict', () => {
        expect(text).toMatch(/non-convergent`? or `?refused`? record stays red/i);
    });

    it('SENSITIVITY — the predicate rejects a contract missing each clause', () => {
        expect(ownerRouteClaims('').namesTheRoute).toBe(false);
        expect(ownerRouteClaims('### The owner-permission-route\n').namesTheForgeAct).toBe(false);
        expect(
            ownerRouteClaims('### The owner-permission-route\nrecorded bypass on the forge\n')
                .statesWhatItCannotProve,
        ).toBe(false);
        // And the real contract is not passing by accident of a loose regex:
        // strip the section and every claim must fall.
        const stripped = text.replace(
            /### The owner-permission-route[\s\S]*?\n## /,
            '## ',
        );
        const c = ownerRouteClaims(stripped);
        expect(c.namesTheRoute).toBe(false);
        expect(c.statesWhatItCannotProve).toBe(false);
    });
});
