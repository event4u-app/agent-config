/**
 * When a `lightweight` roadmap exceeds the line cap, the message must name
 * an evidence-page remedy and state that an agent may not retag the file
 * structural to clear it — not the old "consider tagging structural or
 * trimming" suggestion, which named an action an agent is not authorised
 * to take on its own.
 */
import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { lint_roadmap, LIGHTWEIGHT_LINE_CAP } from '../../src/scripts/lint_roadmap_complexity.js';

describe('lint_roadmap_complexity — lightweight cap message', () => {
    let tmp: string;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-roadmap-complexity-msg-'));
    });

    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('names the evidence-page remedy and forbids an agent retag', () => {
        const filler = Array.from({ length: LIGHTWEIGHT_LINE_CAP + 10 }, () => 'filler line').join('\n');
        const text = `---\ncomplexity: lightweight\n---\n# Title\n\n${filler}\n`;
        const p = path.join(tmp, 'road-to-oversized.md');
        fs.writeFileSync(p, text, 'utf-8');

        const problems = lint_roadmap(p, 0);

        expect(problems.length).toBeGreaterThan(0);
        const msg = problems.join('\n');
        expect(msg).toContain('agents/evidence/analysis/');
        expect(msg).toContain('may not retag');
        expect(msg).not.toContain('consider tagging structural');
    });
});
