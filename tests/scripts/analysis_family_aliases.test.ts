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
 * Both paths below hard-code `analyze/repo`, which step 6.2b renames to
 * `analyze/reference`. After that rename these read as ENOENT rather than as
 * assertion failures; the rename moves the paths AND the third case's
 * expectation into the `replaces:` list (R2 finding 14).
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
    it('the source door keeps both reference-repo spellings', () => {
        expect(projected('repo.md')['replaces']).toEqual([
            'analyze-reference-repo',
            'analyze:reference-repo',
        ]);
    });

    it('and-optimize keeps both optimize-deep spellings', () => {
        expect(projected('and-optimize.md')['replaces']).toEqual(['optimize-deep', 'optimize:deep']);
    });

    it('`analyze:repo` resolves as the door itself until the 6.2b rename lands', () => {
        // Not an alias today: it is the live name. The rename is step 6.2b,
        // and when it lands this expectation moves into the list above.
        expect(projected('repo.md')['name']).toBe('analyze-repo');
    });
});
