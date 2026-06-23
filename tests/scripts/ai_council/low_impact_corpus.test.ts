// Tests for src/scripts/ai_council/low_impact_corpus.ts (py2ts Phase 1).
//
// Hardened corpus parser. Covers the strict-mode structural failures
// (heading_drift / missing_anchor / etc.), the lenient loaders, and the
// YAML-lockfile preference path.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    CorpusParseError,
    CorpusParseResult,
    load_anti_example_phrases,
    load_corpus_lock,
    load_validated_phrases,
    parse_corpus_strict,
} from '../../../src/scripts/ai_council/low_impact_corpus.js';

const GOOD = [
    '## Validated',
    '',
    '<!-- intake-anchor: validated -->',
    '',
    '- "what port" — meta here',
    '',
    '## On Probation',
    '',
    '<!-- intake-anchor: probation -->',
    '',
    '- "how to test" — first-seen 2026-05-01',
    '',
    '## Anti-Examples (Always Ask User)',
    '',
    '- "delete prod?"',
    '',
].join('\n');

function tmpFile(name: string, content: string): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'corpus-'));
    const p = path.join(dir, name);
    writeFileSync(p, content, { encoding: 'utf-8' });
    return p;
}

describe('low_impact_corpus — parse_corpus_strict (clean)', () => {
    it('parses entries with line numbers + trailing metadata', () => {
        const r = parse_corpus_strict(tmpFile('c.md', GOOD));
        expect(r.validated.map((e) => [e.phrase, e.normalised, e.line_no])).toEqual([
            ['what port', 'what port', 5],
        ]);
        expect(r.probation[0]?.trailing_metadata).toBe('— first-seen 2026-05-01');
        expect(r.anti_examples.map((e) => e.normalised)).toEqual(['delete prod']);
        expect(r.phrases('validated')).toEqual(['what port']);
    });

    it('missing file → empty result, not an error', () => {
        const r = parse_corpus_strict('/no/such/corpus.md');
        expect(r).toBeInstanceOf(CorpusParseResult);
        expect(r.validated).toEqual([]);
    });
});

describe('low_impact_corpus — strict structural failures', () => {
    it('heading_drift on ### Validated', () => {
        const p = tmpFile('d.md', '### Validated\n\n- "x"\n');
        expect(() => parse_corpus_strict(p)).toThrow(CorpusParseError);
        try {
            parse_corpus_strict(p);
        } catch (e) {
            const err = e as CorpusParseError;
            expect(err.reason).toBe('heading_drift');
            expect(err.line).toBe(1);
            expect(err.section).toBe('validated');
        }
    });

    it('missing_anchor when sections present but anchor absent', () => {
        const p = tmpFile('n.md', '## Validated\n\n- "phrase one"\n\n## On Probation\n\n- "phrase two"\n');
        try {
            parse_corpus_strict(p);
            throw new Error('expected throw');
        } catch (e) {
            const err = e as CorpusParseError;
            expect(err.reason).toBe('missing_anchor');
            expect(err.section).toBe('validated');
            expect(err.line).toBeNull();
        }
    });
});

describe('low_impact_corpus — lenient loaders', () => {
    it('load_validated_phrases / load_anti_example_phrases (markdown source)', () => {
        const p = tmpFile('c.md', GOOD);
        expect(load_validated_phrases(p)).toEqual(['what port']);
        expect(load_anti_example_phrases(p)).toEqual(['delete prod']);
    });

    it('lenient on a malformed file → drops bad lines (no throw)', () => {
        const bad = [
            '## Validated',
            '',
            '<!-- intake-anchor: validated -->',
            '',
            '* "wrong marker"',
            '- "good one" — x',
            '',
            '## On Probation',
            '',
            '<!-- intake-anchor: probation -->',
            '',
        ].join('\n');
        expect(load_validated_phrases(tmpFile('m.md', bad))).toEqual(['good one']);
    });
});

describe('low_impact_corpus — YAML lockfile preference', () => {
    it('prefers the sibling lock over the markdown source', () => {
        const dir = mkdtempSync(path.join(tmpdir(), 'corpuslk-'));
        const md = path.join(dir, 'lid.md');
        writeFileSync(md, GOOD, { encoding: 'utf-8' });
        writeFileSync(
            path.join(dir, 'lid.lock.yaml'),
            'schema_version: 1\nvalidated:\n  - phrase: "lock phrase"\n    normalised: "lock phrase"\n    line_no: 5\n',
            { encoding: 'utf-8' },
        );
        expect(load_validated_phrases(md)).toEqual(['lock phrase']);
    });

    it('schema_version mismatch raises in load_corpus_lock', () => {
        const lk = tmpFile('x.lock.yaml', 'schema_version: 99\nvalidated: []\n');
        expect(() => load_corpus_lock(lk)).toThrow(CorpusParseError);
    });
});
