// Tests for src/scripts/ai_council/low_impact_intake.ts (py2ts Phase 1).
//
// Pure-text, deterministic corpus mutator. `today` is passed explicitly to
// remove the only non-deterministic input (UTC date).
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    TRIGGER_PHRASES,
    matches_trigger,
    normalise,
    record_intake,
} from '../../../src/scripts/ai_council/low_impact_intake.js';

const CORPUS = [
    '# Low-Impact Decisions',
    '',
    '## Validated',
    '',
    '<!-- intake-anchor: validated -->',
    '',
    '- "what port does the app use" — learned 2026-01-01',
    '',
    '## On Probation',
    '',
    '<!-- intake-anchor: probation -->',
    '',
    '- "how do i run tests" — first-seen 2026-05-01 · seen [2026-05-01]',
    '',
    '## Anti-Examples (Always Ask User)',
    '',
    '- "should we delete prod"',
    '',
].join('\n');

function tmpCorpus(): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'intake-'));
    const p = path.join(dir, 'low-impact-decisions.md');
    writeFileSync(p, CORPUS, { encoding: 'utf-8' });
    return p;
}

describe('low_impact_intake — matches_trigger', () => {
    it('matches DE / EN phrases case-insensitively (substring)', () => {
        expect(matches_trigger('Das ist eine LEICHTE Frage hier')).toBe(true);
        expect(matches_trigger('please, ask the council about this')).toBe(true);
        expect(matches_trigger('a low impact question maybe')).toBe(true);
    });
    it('does not match unrelated text', () => {
        expect(matches_trigger('deploy to production now')).toBe(false);
    });
    it('exports the full DE+EN phrase set', () => {
        expect(TRIGGER_PHRASES).toContain('eine leichte frage');
        expect(TRIGGER_PHRASES).toContain('ask the council');
        expect(TRIGGER_PHRASES.length).toBe(11);
    });
});

describe('low_impact_intake — normalise', () => {
    it('lowercases, strips punctuation, collapses whitespace', () => {
        expect(normalise('  How  do I, run TESTS?? ')).toBe('how do i run tests');
    });
});

describe('low_impact_intake — record_intake outcomes', () => {
    it('appends seen-date to an existing probation entry', () => {
        const p = tmpCorpus();
        const r = record_intake(p, 'How do I run tests?', { today: '2026-06-02' });
        expect(r.kind).toBe('appended_seen');
        expect(readFileSync(p, 'utf-8')).toContain('seen [2026-05-01, 2026-06-02]');
    });

    it('no-op when already seen today', () => {
        const p = tmpCorpus();
        const r = record_intake(p, 'how do i run tests', { today: '2026-05-01' });
        expect(r.kind).toBe('noop');
        expect(r.note).toBe('already seen today');
    });

    it('duplicate_validated when the question is already learned', () => {
        const p = tmpCorpus();
        const r = record_intake(p, 'what port does the app use', { today: '2026-06-02' });
        expect(r.kind).toBe('duplicate_validated');
        expect(r.note).toBe('already learned');
    });

    it('new_probation appends a fresh entry', () => {
        const p = tmpCorpus();
        const r = record_intake(p, 'brand new question here', { today: '2026-06-03' });
        expect(r.kind).toBe('new_probation');
        expect(readFileSync(p, 'utf-8')).toContain(
            '- "brand new question here" — first-seen 2026-06-03 · seen [2026-06-03]',
        );
    });
});
