import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The merge command's danger gate is prose an agent executes, so its three
 * obligations are pinned as text: the classifier runs from the base revision,
 * a `needs-owner` PR is never sent to the council, and a `routine` PR still
 * merges with no review. `src/agent-src/commands/evals/git-pr-merge.json` is a
 * routing eval (prompt → command) and cannot express any of them.
 */

const ROOT = path.resolve(__dirname, '..', '..');
const MERGE = fs.readFileSync(path.join(ROOT, 'src/domains/git/pr/merge/command.md'), 'utf8');
const PROCESS_FULL = fs.readFileSync(path.join(ROOT, 'src/domains/product-basic/roadmap/process-full/command.md'), 'utf8');

function section(text: string, heading: string): string {
    const start = text.indexOf(heading);
    if (start < 0) throw new Error(`heading not found: ${heading}`);
    const next = text.indexOf('\n## ', start + heading.length);
    return text.slice(start, next < 0 ? undefined : next);
}

const GATE = section(MERGE, '## 9a. Danger gate');

describe('§ 9a classes a PR from the base revision', () => {
    it('materialises the manifest base in a worktree and runs that copy with --root on the head', () => {
        expect(GATE).toContain('git worktree add -q --detach "$BASE_DIR" "$BASE"');
        expect(GATE).toContain('"$BASE_DIR/src/scripts/classify_merge_risk.ts"');
        expect(GATE).toContain('--root "$PWD"');
    });

    it('never runs the head copy of the classifier', () => {
        expect(GATE).not.toMatch(/\.\/scripts-run src\/scripts\/classify_merge_risk/u);
    });

    it('a base it cannot use is needs-owner, never a skip and never a fall-back', () => {
        expect(GATE).toContain('VERDICT="verdict: needs-owner (base-unavailable');
        expect(GATE).toMatch(/never a\s+skipped gate and never a fall-back to the head's copy/u);
    });
});

describe('the three verdicts', () => {
    it('a needs-owner PR is never sent for clearance', () => {
        expect(GATE).toMatch(/\*\*`needs-owner`\*\*[\s\S]*\*\*never sent for clearance\*\*/u);
        expect(MERGE).toContain('A `needs-owner` PR IS NEVER SENT FOR CLEARANCE');
        expect(PROCESS_FULL).toContain('A `needs-owner` PR IS NEVER SENT FOR CLEARANCE');
    });

    it('a routine PR still merges with no review step', () => {
        expect(GATE).toContain('- **`routine`** → merge in § 9. No review step.');
    });
});
