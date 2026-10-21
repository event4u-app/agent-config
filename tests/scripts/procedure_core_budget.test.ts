// The five run procedures keep a core at most `cap_bytes`; branches live in
// references loaded on that branch. Ceilings only shrink: a core that grows past
// its recorded size fails here and names the file. A core above the cap must
// carry the reason it is above it.
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..');
const budget = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/config/procedure-core-budget.json'), 'utf8')) as {
    cap_bytes: number;
    cores: Record<string, { ceiling: number; over_cap_reason?: string }>;
};

describe('procedure core budget', () => {
    it('names the five run procedures', () => {
        expect(Object.keys(budget.cores)).toHaveLength(5);
    });

    for (const [rel, entry] of Object.entries(budget.cores)) {
        it(`${rel} stays within its ceiling`, () => {
            const size = fs.statSync(path.join(ROOT, rel)).size;
            if (entry.ceiling > budget.cap_bytes) {
                expect(entry.over_cap_reason ?? '', `${rel} is above the cap without a reason`).not.toBe('');
            }
            expect(size, `${rel} is ${String(size)} bytes; ceiling ${String(entry.ceiling)}`).toBeLessThanOrEqual(entry.ceiling);
        });
    }
});
