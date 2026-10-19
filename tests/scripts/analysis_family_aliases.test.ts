/**
 * AC-10 of `road-to-an-analysis-family-that-deepens-itself`: the three names
 * the family moved away from still resolve in the PROJECTED tree.
 *
 * `lint_command_routing` checks that a visible command carries SOME
 * `replaces:` list; it does not check which names are in it, so dropping
 * `optimize:deep` from the and-optimize door would pass every gate and break
 * every invocation that still types it. The projection is the half that
 * matters: a consumer reads `dist/agent-src/`, not `src/`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function projected(rel: string): Record<string, unknown> {
    const text = fs.readFileSync(path.join(ROOT, 'dist/agent-src/commands/analyze', rel), 'utf-8');
    return parse(/^---\n([\s\S]*?)\n---\n/u.exec(text)![1]!) as Record<string, unknown>;
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
