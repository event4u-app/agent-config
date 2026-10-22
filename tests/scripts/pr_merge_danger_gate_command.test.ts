import { describe, expect, it } from 'vitest';

import { procedureText } from '../_lib/procedure_text.js';

/**
 * The merge command's danger gate is prose an agent executes, so its three
 * obligations are pinned as text: the classifier runs from the base revision,
 * a `needs-owner` PR is never sent to the council, and a `routine` PR still
 * merges with no review. `src/agent-src/commands/evals/git-pr-merge.json` is a
 * routing eval (prompt → command) and cannot express any of them.
 *
 * A WORDING PIN ONLY: a reworded procedure that keeps these strings but
 * changes behaviour still passes here. The shell block itself is executed
 * against real commits in `classify_merge_risk_base_revision.test.ts`.
 */

const MERGE = procedureText('src/domains/git/pr/merge/command.md');
const PROCESS_FULL = procedureText('src/domains/product-basic/roadmap/process-full/command.md');

function section(text: string, heading: string): string {
    const start = text.indexOf(heading);
    if (start < 0) throw new Error(`heading not found: ${heading}`);
    const next = text.indexOf('\n## ', start + heading.length);
    return text.slice(start, next < 0 ? undefined : next);
}

// The core keeps each section's heading and fences; its branch detail moved to
// headings of its own in the merge reference files, read here as part of it.
const GATE = [
    section(MERGE, '## 9a. Danger gate'),
    section(MERGE, '## Danger gate verdicts'),
    section(MERGE, '## Danger gate mechanics'),
].join('\n');

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

const MERGE_STEP = [
    section(MERGE, '## 9. Merge, and the summary'),
    section(MERGE, '\n## Merge method choice'),
    section(MERGE, '\n## Drain summary'),
    section(MERGE, '\n## Held for you'),
].join('\n');

describe('a needs-council merge rests on a checked record for the merging head', () => {
    it('§ 9a writes the clearance through merge_clearance, from the session record', () => {
        expect(GATE).toContain('merge_clearance.ts write --pr <N>');
        expect(GATE).toContain('--session <council-session-json>');
        expect(GATE).toMatch(/never on the run's own reading of the replies/u);
    });

    it('§ 9 merges a needs-council PR only after --check passes for the manifest head', () => {
        expect(MERGE_STEP).toContain('merge_clearance.ts --check <N> --head <manifest-head-sha>');
        expect(MERGE_STEP.indexOf('merge_clearance.ts --check')).toBeLessThan(MERGE_STEP.indexOf('gh pr merge <N>'));
        expect(MERGE_STEP).toMatch(/moves the head and voids it/u);
        expect(MERGE_STEP).not.toMatch(/\.\/scripts-run src\/scripts\/merge_clearance --check/u);
    });
});

describe('every hand-off reaches the owner as one block at the end of the run', () => {
    it('§ 9 ends a run that held anything with one "Held for you" block', () => {
        expect(MERGE_STEP).toContain('### Held for you — one block, at the end of the run');
        expect(MERGE_STEP).toMatch(/While the run works it asks nothing\s+about a held PR/u);
    });

    it('a dangerous seat is listed under its own heading', () => {
        expect(MERGE_STEP).toMatch(/\*\*Held — a\s+seat found it dangerous\*\*/u);
    });
});
