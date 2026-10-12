import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { evaluate, expectedSubjectFor } from '../../src/scripts/check_kernel_edit_ratified.js';
import {
    RATIFICATION_DIR,
    readRatification,
} from '../../src/scripts/_lib/ratification_artifact.js';

/**
 * Step 2.2 — each record answers for its OWN change.
 *
 * Before the binding the gate passed when ANY one artifact in the changed-file
 * list validated (`check_kernel_edit_ratified.ts`, the `anyRatified` loop), so
 * a record written for one review carried a second change it never saw. The
 * property these cases pin is therefore not "an invalid record is refused" —
 * that was already true — but that a record which is valid IN EVERY OTHER
 * RESPECT no longer carries a diff it did not review.
 *
 * That distinction is why each case here proves the foreign record is good:
 * read against the content it was written for, it passes. If it were rejected
 * for some unrelated defect the suite would be green for the wrong reason.
 */

let root: string;

const KERNEL = 'src/rules/commit-policy.md';
const OTHER_KERNEL = 'src/rules/non-destructive-by-default.md';

function write(rel: string, body: string): void {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
}

function recordText(subject: string, verdict = 'ratified'): string {
    return [
        '---',
        'proposed_by: claude/session-a',
        'implemented_by: claude/session-a',
        'reviewed_by: council/anthropic+openai',
        `subject: ${subject}`,
        `verdict: ${verdict}`,
        'effective_after: merge',
        'providers:',
        '  - anthropic',
        '  - openai',
        'seats:',
        `  anthropic: ${verdict}`,
        `  openai: ${verdict}`,
        '---',
        '',
        '<!-- evidence-type: ratification -->',
        '',
        'Review body.',
        '',
    ].join('\n');
}

function record(name: string, subject: string, verdict = 'ratified'): string {
    const rel = path.join(RATIFICATION_DIR, name);
    write(rel, recordText(subject, verdict));
    return rel;
}

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'kersub-'));
    write(KERNEL, 'the content under review\n');
    write(OTHER_KERNEL, 'a different rule entirely\n');
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('a record carries only the diff it reviewed', () => {
    it('a record written for ANOTHER change does not carry this one', () => {
        // Valid in every respect — and bound to a different rule's content.
        const foreign = expectedSubjectFor([OTHER_KERNEL], root).digest;
        const rel = record('for-the-other-change.md', foreign);

        // It is a good record: read against the content it was written for it
        // validates completely. The gate still refuses it for THIS diff.
        expect(readRatification(recordText(foreign), 2, foreign).problems).toEqual([]);

        const r = evaluate([KERNEL, rel], root, 2);
        expect(r.exitCode).toBe(1);
        expect(r.lines.join('\n')).toContain('does not answer for this change');
    });

    it('a SECOND valid record for something else no longer carries the diff', () => {
        // The pre-binding shape: two artifacts in one diff, one of them good,
        // and "any one validates" let the other one through on its coat-tails.
        const foreign = record('neighbour.md', expectedSubjectFor([OTHER_KERNEL], root).digest);
        const red = evaluate([KERNEL, foreign], root, 2);
        expect(red.exitCode).toBe(1);

        // Add the record that DID review this content and the same diff passes.
        const mine = record('mine.md', expectedSubjectFor([KERNEL], root).digest);
        const green = evaluate([KERNEL, foreign, mine], root, 2);
        expect(green.exitCode, green.lines.join('\n')).toBe(0);
        // The one that did not answer is reported, not silently ignored.
        expect(green.lines.join('\n')).toContain('did not validate');
    });

    it('a matching subject does not rescue a non-passing verdict', () => {
        // The binding is an ADDITIONAL condition, never a replacement for the
        // verdict rule — a record can review exactly this content and refuse it.
        const rel = record('refused.md', expectedSubjectFor([KERNEL], root).digest, 'refused');
        expect(evaluate([KERNEL, rel], root, 2).exitCode).toBe(1);
    });

    it('a matching subject does not rescue a self-ratified record', () => {
        const rel = path.join(RATIFICATION_DIR, 'self.md');
        write(
            rel,
            recordText(expectedSubjectFor([KERNEL], root).digest).replace(
                'reviewed_by: council/anthropic+openai',
                'reviewed_by: claude/session-a',
            ),
        );
        const r = evaluate([KERNEL, rel], root, 2);
        expect(r.exitCode).toBe(1);
        expect(r.lines.join('\n')).toContain('may not record the ratification');
    });
});

describe('records already on the trunk are not re-judged', () => {
    it('a record on disk but NOT in the diff is never read', () => {
        // The 23 records on the trunk carry no `subject` and need no migration:
        // the gate reads only the artifacts the changed-file list names.
        const onDisk = path.join(RATIFICATION_DIR, 'landed-long-ago.md');
        write(onDisk, '---\nnot even frontmatter the reader would accept\n');

        const mine = record('mine.md', expectedSubjectFor([KERNEL], root).digest);
        const r = evaluate([KERNEL, mine], root, 2);
        expect(r.exitCode, r.lines.join('\n')).toBe(0);
        expect(r.lines.join('\n')).not.toContain('landed-long-ago');
    });
});
