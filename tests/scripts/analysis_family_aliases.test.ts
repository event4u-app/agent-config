/**
 * AC-10 of `road-to-an-analysis-family-that-deepens-itself`: the three names
 * the family moved away from still resolve in the PROJECTED tree.
 *
 * `lint_command_routing` checks that a visible command carries SOME
 * `replaces:` list; it does not check which names are in it, so dropping
 * `optimize:deep` from the and-optimize door would pass every gate and break
 * every invocation that still types it.
 *
 * This file reads `dist/agent-src/` where its two siblings read `src/`, and
 * the asymmetry is deliberate: the criterion is about what a CONSUMER can
 * still type, and a consumer reads the projection. The cost is a coupling to
 * projection freshness — in a worktree where `task sync` has not run this reds
 * on a stale projection, which looks like a dropped alias and is not (R2
 * finding 13). Run `task sync` before believing a red here.
 *
 * The source-door paths below read `analyze/reference`, the name ADR-288 D1
 * decided and step 6.2b landed on 2026-10-20. The four retired spellings —
 * both `reference-repo` forms and both `repo` forms — are the `replaces:`
 * list this file pins; `analyze:repo` moved from being the live name into
 * that list in the same change (R2 finding 14).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function projected(rel: string): Record<string, unknown> {
    const file = path.join(ROOT, 'dist/agent-src/commands/analyze', rel);
    const text = fs.readFileSync(file, 'utf-8');
    const fm = /^---\n([\s\S]*?)\n---\n/u.exec(text);
    // Named, because a CRLF or absent block otherwise throws an opaque
    // "Cannot read properties of null" far from its cause (R2 finding 18).
    if (fm === null) throw new Error(`${file}: no frontmatter block`);
    return parse(fm[1]!) as Record<string, unknown>;
}

describe('the retired analysis-family names still resolve', () => {
    it('the source door keeps all four retired spellings', () => {
        expect(projected('reference.md')['replaces']).toEqual([
            'analyze-repo',
            'analyze:repo',
            'analyze-reference-repo',
            'analyze:reference-repo',
        ]);
    });

    it('and-optimize keeps both optimize-deep spellings', () => {
        expect(projected('and-optimize.md')['replaces']).toEqual(['optimize-deep', 'optimize:deep']);
    });

    it('the source door ships under its decided name, with `analyze:repo` demoted to an alias', () => {
        // Until 2026-10-20 `analyze-repo` was the live name and this case
        // asserted it. Step 6.2b landed ADR-288 D1: the name is now
        // `analyze-reference` and both `repo` spellings are aliases, pinned
        // by the first case above.
        expect(projected('reference.md')['name']).toBe('analyze-reference');
    });
});
