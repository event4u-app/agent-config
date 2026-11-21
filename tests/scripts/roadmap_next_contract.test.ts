// Text contract for /roadmap:next — road-to-mandates-scoped-to-the-goal 6.1.
// The command hands off to /roadmap:process-full, which already merges on
// `--merge` or the owner's own words (ADR-282); /roadmap:next must point at that
// section rather than contradict it, and its workspace default must yield to
// the project's own delivery rule. The five-disqualifier screen stays byte-equal.
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

const FILE = path.resolve(__dirname, '../../src/domains/product-basic/roadmap/next/command.md');
const text = (): string => fs.readFileSync(FILE, 'utf-8');

function section(heading: string, until: string): string {
    const t = text();
    const start = t.indexOf(heading);
    expect(start, `section ${heading}`).toBeGreaterThan(-1);
    const end = t.indexOf(until, start + heading.length);
    return t.slice(start, end === -1 ? undefined : end);
}

/** sha256 of § 2's five numbered disqualifiers as they stood at 811cea61d6. */
const DISQUALIFIERS_SHA256 = '4646dca38c0b5a313211379905111395ce408528d273f38131328a6ec8e91aed';

describe('/roadmap:next — merge and workspace contract', () => {
    it('(a) no line says "No merge, ever"', () => {
        expect(text()).not.toMatch(/No merge, ever/);
    });

    it("(b) Rules link process-full's --merge section and name both triggers", () => {
        const rules = section('\n## Rules', '\n## See also');
        expect(rules).toContain('process-full.md#--merge--merging-on-the-owners-word-only-adr-282');
        expect(rules).toContain('`--merge`');
        expect(rules).toMatch(/owner's own words in the session/);
    });

    it('(c) § 4 orders user instruction → project delivery rule → feature-branch default, project rule winning', () => {
        const ws = section('\n### 4. Workspace', '\n### 5.');
        const at = [
            ws.search(/explicit (?:user )?instruction/i),
            ws.search(/project's own delivery rule/i),
            ws.search(/feature-branch default/i),
        ];
        for (const i of at) expect(i).toBeGreaterThan(-1);
        expect([...at].sort((a, b) => a - b)).toEqual(at);
        expect(ws).toContain('playbook-precedence');
        expect(ws).toMatch(/branch, worktree, or trunk-plus-manual-test/);
        expect(ws).toMatch(/project rule wins over\s+the\s+default/i);
    });

    it('(d) the five-disqualifier screen is unchanged', () => {
        const s2 = section('### 2. Screen the survivors', '\n### 3.');
        const rows = s2.slice(s2.indexOf('\n1. **') + 1, s2.indexOf('\n\nAlso check'));
        expect(rows.split('\n')).toHaveLength(12);
        expect(createHash('sha256').update(rows).digest('hex')).toBe(DISQUALIFIERS_SHA256);
    });
});
