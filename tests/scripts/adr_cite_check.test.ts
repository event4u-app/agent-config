import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
    SURFACES_NOT_SCANNED,
    amendment_blocks,
    cite_check,
    normalise_ref,
    parse_frontmatter,
    trigger_state,
} from '../../src/scripts/adr_cite_check.js';

/**
 * A throwaway decision corpus. The tests assert the tool's behaviour, never the
 * real tree's content — a fixture keeps them from going red the day someone
 * legitimately supersedes ADR-028.
 */
let root: string;

function write(rel: string, body: string): void {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body, 'utf-8');
}

beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'adr-cite-'));

    write(
        'docs/decisions/ADR-001-precondition-shipped.md',
        [
            '---',
            'adr: 1',
            'status: accepted',
            'date: 2026-05-06',
            'decision: kernel-swap-deferred',
            'review_trigger: >-',
            '  Reopen once the router compiler ships; the swap re-evaluation is',
            '  mandatory before the next milestone.',
            '---',
            '',
            '# ADR-001',
            '',
            'Body.',
            '',
        ].join('\n'),
    );

    write(
        'docs/decisions/ADR-020-no-trigger.md',
        ['---', 'adr: 20', 'status: accepted', 'date: 2026-05-10', 'decision: no-trigger', '---', '', 'Body.', ''].join(
            '\n',
        ),
    );

    write(
        'docs/decisions/ADR-028-dead.md',
        [
            '---',
            'adr: 28',
            'status: superseded',
            'date: 2026-05-25',
            'decision: root-layout',
            'superseded_by: ADR-045',
            '---',
            '',
            'Body.',
            '',
        ].join('\n'),
    );

    write(
        'docs/decisions/ADR-035-amended.md',
        [
            '---',
            'adr: 35',
            'status: accepted',
            'date: 2026-05-30',
            'decision: model-capability-tiers',
            'review_trigger: >-',
            '  Reopen if a vendor ships a band the three tiers cannot express.',
            '---',
            '',
            '## Amendment 1 (2026-08-15) — fourth tier reopened',
            '',
            'Body.',
            '',
        ].join('\n'),
    );

    write(
        'docs/decisions/ADR-232-reopener.md',
        [
            '---',
            'adr: 232',
            'status: accepted',
            'date: 2026-08-15',
            'decision: frontier-tier-reopened',
            'review_trigger: >-',
            '  Reopen if the fourth family disappears from the vendor line-up.',
            '---',
            '',
            'This amends ADR-035.',
            '',
        ].join('\n'),
    );

    write('docs/decisions/INDEX.md', '# Index\n\nADR-001 ADR-020 ADR-028 ADR-035 ADR-232\n');
});

afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('normalise_ref', () => {
    it('accepts every citation shape the corpus uses', () => {
        expect(normalise_ref('ADR-211')).toBe('ADR-211');
        expect(normalise_ref('adr-211')).toBe('ADR-211');
        expect(normalise_ref('211')).toBe('ADR-211');
        expect(normalise_ref('docs/decisions/ADR-211-harvest-freeze.md')).toBe('ADR-211');
    });

    it('zero-pads so ADR-1 and ADR-001 are the same decision', () => {
        expect(normalise_ref('ADR-1')).toBe('ADR-001');
    });

    it('returns null when there is no number to resolve', () => {
        expect(normalise_ref('adr-layout')).toBeNull();
    });
});

describe('parse_frontmatter', () => {
    it('joins a folded value — every review_trigger in the corpus is folded', () => {
        const fm = parse_frontmatter(
            ['---', 'review_trigger: >-', '  first line', '  second line', '---', '', 'body'].join('\n'),
        );
        expect(fm?.['review_trigger']).toBe('first line second line');
    });

    it('returns null without a frontmatter block', () => {
        expect(parse_frontmatter('# no frontmatter\n')).toBeNull();
    });
});

describe('trigger_state', () => {
    it('is `none` when the ADR recorded no reopen condition', () => {
        expect(trigger_state({})).toBe('none');
    });

    it('is `indeterminate` for a semantic condition, never a guessed boolean', () => {
        expect(trigger_state({ review_trigger: 'Reopen when the capacity premise changes.' })).toBe('indeterminate');
    });
});

describe('amendment_blocks', () => {
    it('matches all three conventions present in the corpus', () => {
        const body = [
            '## Amendment 1 (2026-08-15)',
            'text',
            '### Amendment — 2026-07-02 · scope',
            'text',
            '**Amended 2026-06-01 — premise corrected**',
            'text',
        ].join('\n');
        expect(amendment_blocks(body)).toHaveLength(3);
    });

    it('finds nothing in an unamended body', () => {
        expect(amendment_blocks('## Context\n\nplain text\n')).toEqual([]);
    });
});

describe('cite_check', () => {
    it('reports a superseded ADR as not a live lock, naming the successor', () => {
        const [r] = cite_check(['ADR-028'], root);
        expect(r?.resolved).toBe(true);
        expect(r?.status).toBe('superseded');
        expect(r?.verdict).toContain('NOT A LIVE LOCK');
        expect(r?.verdict).toContain('ADR-045');
    });

    it('flags an amended ADR so the original text is not cited alone', () => {
        const [r] = cite_check(['ADR-035'], root);
        expect(r?.amendment_blocks).toHaveLength(1);
        expect(r?.verdict).toContain('AMENDED');
    });

    it('surfaces the one-sided reopen through back-references', () => {
        const [r] = cite_check(['ADR-035'], root);
        expect(r?.referenced_by.some((f) => f.includes('ADR-232'))).toBe(true);
    });

    it('excludes the generated INDEX from back-references', () => {
        const [r] = cite_check(['ADR-001'], root);
        expect(r?.referenced_by.some((f) => f.includes('INDEX.md'))).toBe(false);
    });

    it('names a live ADR with a semantic trigger indeterminate, not blocking', () => {
        const [r] = cite_check(['ADR-001'], root);
        expect(r?.trigger_state).toBe('indeterminate');
        expect(r?.verdict).toContain('INDETERMINATE');
    });

    it('calls a missing reopen condition a defect in the ADR, not a stronger lock', () => {
        const [r] = cite_check(['ADR-020'], root);
        expect(r?.trigger_state).toBe('none');
        expect(r?.verdict).toContain('NO REOPEN CONDITION');
    });

    it('keeps a `rejected` ADR live — a rejected proposal still binds', () => {
        // The failure this pins: folding `rejected` in with `superseded` makes
        // the tool clear a lock that still holds. Found by running the tool
        // over the real eleven-ADR blocking set.
        write(
            'docs/decisions/ADR-054-rejected.md',
            ['---', 'adr: 54', 'status: rejected', 'date: 2026-06-05', 'decision: decay-restate', '---', '', 'Body.', ''].join('\n'),
        );
        const [r] = cite_check(['ADR-054'], root);
        expect(r?.verdict).toContain('LIVE');
        expect(r?.verdict).not.toContain('NOT A LIVE LOCK');
    });

    it('does not resolve an unknown number, and says so', () => {
        const [r] = cite_check(['ADR-999'], root);
        expect(r?.resolved).toBe(false);
        expect(r?.verdict).toContain('UNRESOLVED');
    });

    it('publishes the surfaces it deliberately does not scan', () => {
        expect(SURFACES_NOT_SCANNED.length).toBeGreaterThan(0);
        expect(SURFACES_NOT_SCANNED.join(' ')).toContain('docs/contracts/adr-');
    });
});
