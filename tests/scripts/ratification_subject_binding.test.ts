import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { evaluate, expectedSubjectFor } from '../../src/scripts/check_kernel_edit_ratified.js';
import { RATIFICATION_DIR } from '../../src/scripts/_lib/ratification_artifact.js';
import { gatedFilesOf } from '../../src/scripts/_lib/ratification_subject.js';

/**
 * Step 2.1 — the record carries a digest of the gated content it reviewed.
 *
 * The defect this pins is the one the roadmap's Context names: the six required
 * fields say WHO reviewed and never WHAT, so a gated file edited after its
 * review still ships under a record that approved different content. Every case
 * below makes its edit AFTER the record was written, which is the only shape in
 * which that defect is visible — a test that wrote the record last could never
 * see it.
 *
 * The expected digest is asked of the gate (`expectedSubjectFor`), never
 * hand-written: a fixture carrying its own digest would prove a second
 * implementation of the membership rule rather than the shipped one.
 */

let root: string;

const KERNEL = 'src/rules/commit-policy.md';
const OTHER_KERNEL = 'src/rules/non-destructive-by-default.md';
const NEW_HOOK = 'src/scripts/hooks/block_new_surface.ts';

function write(rel: string, body: string): void {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
}

/** A valid record, bound to `gated` as the gate computes it at this instant. */
function record(name: string, gated: readonly string[], verdict = 'ratified'): string {
    const rel = path.join(RATIFICATION_DIR, name);
    write(
        rel,
        [
            '---',
            'proposed_by: claude/session-a',
            'implemented_by: claude/session-a',
            'reviewed_by: council/anthropic+openai',
            `subject: ${expectedSubjectFor(gated, root)}`,
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
        ].join('\n'),
    );
    return rel;
}

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'subj-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('a record is bound to the gated content it reviewed', () => {
    it('passes while the reviewed content is unchanged', () => {
        write(KERNEL, 'reviewed content\n');
        const rel = record('ok.md', [KERNEL]);
        const r = evaluate([KERNEL, rel], root, 2);
        expect(r.exitCode, r.lines.join('\n')).toBe(0);
    });

    it('ONE BYTE of a gated file changed after the review turns it red', () => {
        write(KERNEL, 'reviewed content\n');
        const rel = record('stale.md', [KERNEL]);

        // The edit the record cannot have seen: one byte, after the fact.
        write(KERNEL, 'reviewed contenu\n');

        const r = evaluate([KERNEL, rel], root, 2);
        expect(r.exitCode).toBe(1);
        expect(r.lines.join('\n')).toContain('the record reviewed different content');
    });

    it('a record with NO subject is refused, and names what it is missing', () => {
        write(KERNEL, 'reviewed content\n');
        const rel = path.join(RATIFICATION_DIR, 'nosubject.md');
        write(
            rel,
            [
                '---',
                'proposed_by: claude/session-a',
                'implemented_by: claude/session-a',
                'reviewed_by: council/anthropic+openai',
                'verdict: ratified',
                'effective_after: merge',
                'providers:',
                '  - anthropic',
                '  - openai',
                'seats:',
                '  anthropic: ratified',
                '  openai: ratified',
                '---',
                '',
                'Body.',
                '',
            ].join('\n'),
        );
        const r = evaluate([KERNEL, rel], root, 2);
        expect(r.exitCode).toBe(1);
        expect(r.lines.join('\n')).toContain('missing `subject:`');
    });

    it('a malformed digest is reported as malformed, not as content that moved', () => {
        write(KERNEL, 'reviewed content\n');
        const rel = path.join(RATIFICATION_DIR, 'typo.md');
        write(
            rel,
            [
                '---',
                'proposed_by: claude/session-a',
                'implemented_by: claude/session-a',
                'reviewed_by: council/anthropic+openai',
                'subject: not-a-digest',
                'verdict: ratified',
                'effective_after: merge',
                'providers:',
                '  - anthropic',
                '  - openai',
                'seats:',
                '  anthropic: ratified',
                '  openai: ratified',
                '---',
                '',
                'Body.',
                '',
            ].join('\n'),
        );
        const r = evaluate([KERNEL, rel], root, 2);
        expect(r.exitCode).toBe(1);
        expect(r.lines.join('\n')).toContain('is not a sha-256 hex digest');
        expect(r.lines.join('\n')).not.toContain('the record reviewed different content');
    });
});

describe('a moved base moves the digest only where it moved gated content', () => {
    it('a base that moved on an UNGATED file leaves the record valid', () => {
        write(KERNEL, 'reviewed content\n');
        write('README.md', 'before\n');
        const rel = record('base-ungated.md', [KERNEL]);

        // The base advances on files the digest does not cover.
        write('README.md', 'after, and quite different\n');
        write('docs/architecture.md', 'new\n');

        const r = evaluate([KERNEL, rel], root, 2);
        expect(r.exitCode, r.lines.join('\n')).toBe(0);
    });

    it('a base that moved on a GATED file the change also touches turns it red', () => {
        write(KERNEL, 'reviewed content\n');
        const rel = record('base-gated.md', [KERNEL]);

        // The content that would land is not the content that was reviewed —
        // which is precisely what should move the digest.
        write(KERNEL, 'reviewed content, plus a line the base added\n');

        expect(evaluate([KERNEL, rel], root, 2).exitCode).toBe(1);
    });

    it('a gated file OUTSIDE this diff does not enter this diff’s digest', () => {
        write(KERNEL, 'reviewed content\n');
        write(OTHER_KERNEL, 'before\n');
        const rel = record('neighbour.md', [KERNEL]);

        // Another kernel rule changes, but it is not in this change's file list.
        write(OTHER_KERNEL, 'after\n');

        expect(evaluate([KERNEL, rel], root, 2).exitCode).toBe(0);
    });
});

describe('a change that widens the gated set is judged and written by one list', () => {
    it('a newly added governance hook is inside the digest it is written with', () => {
        write(KERNEL, 'reviewed content\n');
        write(NEW_HOOK, 'export function main(): number {\n    return 0;\n}\n');
        const files = [KERNEL, NEW_HOOK];

        // The writer's list and the gate's list are the same list.
        expect([...gatedFilesOf(files)]).toEqual([KERNEL, NEW_HOOK].sort());

        const rel = record('widening.md', files);
        expect(evaluate([...files, rel], root, 2).exitCode).toBe(0);

        // And the newly gated file is genuinely covered: editing it after the
        // review reds, which is what "widens the gated set" has to mean.
        write(NEW_HOOK, 'export function main(): number {\n    return 1;\n}\n');
        expect(evaluate([...files, rel], root, 2).exitCode).toBe(1);
    });

    it('a deleted gated file is entered, not skipped', () => {
        write(KERNEL, 'reviewed content\n');
        write(NEW_HOOK, 'export function main(): number {\n    return 0;\n}\n');
        const files = [KERNEL, NEW_HOOK];
        const rel = record('deletion.md', files);

        // Removing a governance hook is the change a record most needs to be
        // bound to; if deletion were skipped this would stay green.
        fs.rmSync(path.join(root, NEW_HOOK));
        expect(evaluate([...files, rel], root, 2).exitCode).toBe(1);
    });
});
