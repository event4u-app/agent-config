/**
 * The refusal message is built from a CLOSED VOCABULARY, so patch bytes cannot
 * reach it.
 *
 * The property was asserted in `merge_impact.ts`'s own comments and by no test.
 * It matters because the message is the one place a hook prints something the
 * operator reads, and a patch is attacker-influenceable content — a diff from a
 * fork can carry a credential-shaped token, an absolute home path, or ANSI and
 * control bytes, and any of those reaching stderr is an egress the gate never
 * intended.
 *
 * SCOPED TO THE PIPELINE, not to `describeImpact` alone, and that is the whole
 * design of this file. `describeImpact(pr, impact)` takes a `MergeImpact`
 * whose `markers` is a caller-supplied `string[]`, so a test that hands it a
 * hand-built impact can trivially inject anything and would be asserting
 * nothing about the code. The contract only exists over
 * `classifyDiff(patch) → describeImpact(pr, ·)`, because `classifyDiff` is the
 * boundary that maps patch bytes onto the closed label set.
 *
 * SENSITIVITY IS ASSERTED, not assumed: the last case runs the same checker
 * over a message that DOES interpolate patch text and requires it to fail. A
 * checker never seen red has unknown sensitivity.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    classifyDiff,
    describeImpact,
    type MergeImpact,
} from '../../src/scripts/hooks/merge_impact.ts';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** Strings a patch can carry that must never appear in a refusal. */
const PATCH_ONLY_TOKENS = [
    'ghp_AAAABBBBCCCCDDDDEEEEFFFFGGGGHHHH1111',
    'sk-liveAAAABBBBCCCCDDDD',
    '/Users/somebody/secrets/prod.env',
    'C:\\Users\\somebody\\prod.env',
    'AKIAIOSFODNN7EXAMPLE',
    'super-secret-passphrase',
    'https://internal.example.internal/hooks/abcdef',
];

/**
 * The checker, factored out so the sensitivity case can run it over a message
 * the implementation would never produce.
 */
function leakedTokens(message: string): string[] {
    return PATCH_ONLY_TOKENS.filter((t) => message.includes(t));
}

function patchCarrying(extra: string[], destructive: boolean): string {
    const head = [
        'diff --git a/src/app.ts b/src/app.ts',
        'index 1111111..2222222 100644',
        '--- a/src/app.ts',
        '+++ b/src/app.ts',
        '@@ -1,6 +1,6 @@',
    ];
    const body = extra.map((e) => `+// ${e}`);
    if (destructive) {
        body.push('-export function stillUsed(): void {}');
        body.push('+Schema::dropTable("users");');
    } else {
        body.push('+const added = 1;');
    }
    return [...head, ...body, ''].join('\n');
}

describe('the refusal message carries no patch-derived text', () => {
    for (const destructive of [false, true]) {
        const label = destructive ? 'destructive' : 'additive';
        it(`a ${label} diff carrying credentials and paths produces a clean message`, () => {
            const impact = classifyDiff(patchCarrying(PATCH_ONLY_TOKENS, destructive));
            const message = describeImpact(9, impact);
            expect(leakedTokens(message), `${label}: patch bytes reached the refusal`).toEqual([]);
            // And the message is still useful — a clean message that says nothing
            // would pass the assertion above for the wrong reason.
            expect(message).toMatch(/PR #9/);
            expect(message).toMatch(/merge #9/);
        });
    }

    it('an undecidable verdict carries no patch text either — the reason strings are literals', () => {
        const impact = classifyDiff('');
        expect(impact.verdict).toBe('undecidable');
        expect(leakedTokens(describeImpact(9, impact))).toEqual([]);
    });

    it('every destructive marker label is a literal from the closed table', () => {
        const impact = classifyDiff(patchCarrying(PATCH_ONLY_TOKENS, true));
        expect(impact.verdict).toBe('destructive');
        const src = fs.readFileSync(
            path.join(REPO_ROOT, 'src/scripts/hooks/merge_impact.ts'),
            'utf8',
        );
        const table = src.slice(src.indexOf('DESTRUCTIVE_MARKERS'));
        for (const marker of impact.markers) {
            expect(table, `marker ${JSON.stringify(marker)} is not a table literal`).toContain(
                marker,
            );
        }
        expect(impact.markers.length).toBeGreaterThan(0);
    });

    it('the only variable parts of the message are numbers', () => {
        const impact = classifyDiff(patchCarrying(PATCH_ONLY_TOKENS, false));
        const message = describeImpact(1499, impact);
        // Everything outside the closed prose is a digit run: the PR number and
        // the file count. Strip the literals the table can produce, then assert
        // no path-, token- or URL-shaped residue survives.
        expect(message).not.toMatch(/[A-Za-z]:[\\/]/); // windows path
        expect(message).not.toMatch(/(?:^|\s)\/(?:Users|home|opt|private)\//); // posix home path
        expect(message).not.toMatch(/\bhttps?:\/\//); // any url
        expect(message).not.toMatch(/\b(?:ghp|gho|ghu|ghs|ghr|sk|AKIA)[-_A-Za-z0-9]{8,}/); // token shapes
        expect(message).not.toMatch(/[\u0000-\u0008\u000e-\u001f]/); // control bytes
    });
});

describe('the checker is sensitive — it fails when patch text IS interpolated', () => {
    it('a message built by interpolating the diff is caught', () => {
        const patch = patchCarrying(PATCH_ONLY_TOKENS, true);
        const impact: MergeImpact = classifyDiff(patch);
        // The sabotage: the shape a well-meaning "make the refusal more
        // helpful" edit would take.
        const sabotaged = `${describeImpact(9, impact)}\nDiff:\n${patch}`;
        expect(
            leakedTokens(sabotaged).length,
            'the checker must catch an interpolating message, or it proves nothing above',
        ).toBeGreaterThan(0);
    });

    it('and it is not vacuous — the token list is actually present in the patch', () => {
        const patch = patchCarrying(PATCH_ONLY_TOKENS, true);
        for (const t of PATCH_ONLY_TOKENS) {
            expect(patch, 'a token absent from the patch would make its check meaningless').toContain(
                t,
            );
        }
    });
});
