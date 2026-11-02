// Every owner-question heading carries its own id. OQ-36 and OQ-37 were each
// issued twice (rescore K3, 19.1.0), with nothing to notice it; a quoted answer
// "OQ-37: b" then pointed at two different questions.
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

function duplicateIds(text: string): string[] {
    const seen = new Map<string, number>();
    for (const m of text.matchAll(/^#{2,4} (OQ-\d+)\b/gm)) {
        const id = m[1] as string;
        seen.set(id, (seen.get(id) ?? 0) + 1);
    }
    return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
}

describe('agents/owner-questions.md ids', () => {
    it('finds a repeated heading id', () => {
        expect(duplicateIds('### OQ-1 — a\n\n### OQ-2 — b\n\n### OQ-1 — c\n')).toEqual(['OQ-1']);
    });

    it('issues every id once', () => {
        const file = path.join(process.cwd(), 'agents', 'owner-questions.md');
        expect(duplicateIds(fs.readFileSync(file, 'utf-8'))).toEqual([]);
    });
});
