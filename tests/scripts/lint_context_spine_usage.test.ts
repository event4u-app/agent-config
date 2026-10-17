// Tests for src/scripts/lint_context_spine_usage.ts (py2ts Phase 4 / Wave 4b).
//
// No pytest suite exists. Differential checks over the public helpers
// (frontmatter/body split, spine extraction, slot-citation detection) plus a
// golden-parity layer that runs python3 vs tsx on the REAL REPO,
// byte-identical stdout + stderr + exit (skipped without python3).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { validateBrandVoiceSlotText } from '../../src/scripts/_lib/brand_voice_slot.js';
import * as mod from '../../src/scripts/lint_context_spine_usage.js';



describe('lint_context_spine_usage — behavioural spec', () => {
    it('_frontmatter_and_body splits the leading --- block from the body', () => {
        const [fm, body] = mod._frontmatter_and_body('---\nname: x\n---\n# heading\ntext\n');
        expect(fm).toContain('name: x');
        expect(body).toContain('# heading');
    });

    it('_frontmatter_and_body returns empty fm when no block present', () => {
        const [fm] = mod._frontmatter_and_body('# heading only\n');
        expect(fm).toBe('');
    });

    it('VALID_SLOTS is a non-empty closed vocabulary', () => {
        expect(mod.VALID_SLOTS.length).toBeGreaterThan(0);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

// road-to-a-brand-the-tree-can-check 4.2 / 4.4 — the brand-voice slot is the
// first slot whose frontmatter is machine-read; it is validated as data.
const VALID_SLOT = [
    '---',
    'version: 2',
    'attributes:',
    '  - { is: warm, is_not: gushing, proof: "We thank once, then help." }',
    '  - { is: precise, is_not: pedantic, proof: "Numbers carry units." }',
    '  - { is: direct, is_not: curt, proof: "The answer is the first line." }',
    'tone_by_context:',
    '  - { context: outage, audience_state: anxious, lead_attribute: direct, amplify: [precise], mute: [warm] }',
    'avoid:',
    '  - { term: synergy, match: word, note: "say what combines" }',
    '  - { term: world-class, match: substring }',
    'claims:',
    '  - { text: "fastest importer we measured", evidence_ref: docs/bench/import.md, expires: 2027-03-01 }',
    'tell_exemptions: []',
    'samples:',
    '  - "We moved your data. Nothing was lost; here is the log."',
    'customer_language: ["it just syncs"]',
    'provenance:',
    '  sources:',
    '    - { ref: docs/brand/voice-workshop.md, tier: authoritative }',
    '    - { ref: "https://example.com/reviews", tier: external-untrusted }',
    '  confidence: med',
    '  last_reviewed_at: 2026-10-01',
    'changelog: ["v2: claims added"]',
    'open_questions:',
    '  - { question: "Do we say we or the team?", recommendation: "we" }',
    '---',
    '# Voice',
    '',
].join('\n');

describe('lint_context_spine_usage — brand-voice-schema', () => {
    it('brand-voice-schema: brand-voice is a valid slot name', () => {
        expect(mod.VALID_SLOTS as readonly string[]).toContain('brand-voice');
    });

    it('brand-voice-schema: a well-formed slot has no issues', () => {
        expect(validateBrandVoiceSlotText(VALID_SLOT)).toEqual([]);
    });

    it('brand-voice-schema: shape errors name their field', () => {
        const bad = VALID_SLOT
            .replace('  - { is: direct, is_not: curt, proof: "The answer is the first line." }\n', '')
            .replace('match: word', 'match: regex')
            .replace('confidence: med', 'confidence: certain')
            .replace('version: 2', 'version: 2\nprimary_color: "#ff0000"');
        const fields = validateBrandVoiceSlotText(bad).map((i) => i.field);
        expect(fields).toEqual(
            expect.arrayContaining(['attributes', 'avoid[0].match', 'provenance.confidence', 'primary_color']),
        );
    });

    it('brand-voice-schema: avoid caps at 32 terms of 1-64 chars', () => {
        const many = Array.from({ length: 33 }, (_, i) => `  - { term: t${i}, match: word }`).join('\n');
        const text = VALID_SLOT.replace(/avoid:\n(?: {2}- .*\n)+/, `avoid:\n${many}\n`);
        expect(validateBrandVoiceSlotText(text).map((i) => i.field)).toContain('avoid');
        const long = VALID_SLOT.replace('term: synergy', `term: ${'x'.repeat(65)}`);
        expect(validateBrandVoiceSlotText(long).map((i) => i.field)).toContain('avoid[0].term');
    });

    it('brand-voice-schema: more than three samples, or one over 200 words, is refused', () => {
        const four = VALID_SLOT.replace(
            'samples:\n  - "We moved your data. Nothing was lost; here is the log."',
            'samples: [a, b, c, d]',
        );
        expect(validateBrandVoiceSlotText(four).map((i) => i.field)).toContain('samples');
        const wordy = VALID_SLOT.replace(
            '"We moved your data. Nothing was lost; here is the log."',
            `"${'word '.repeat(201).trim()}"`,
        );
        expect(validateBrandVoiceSlotText(wordy).map((i) => i.field)).toContain('samples[0]');
    });

    it('brand-voice-schema: a file without frontmatter is one issue, not a crash', () => {
        expect(validateBrandVoiceSlotText('# just prose\n').map((i) => i.field)).toEqual(['frontmatter']);
    });
});

describe('lint_context_spine_usage — slot-untrusted', () => {
    it('slot-untrusted: hidden Unicode anywhere in the slot is an issue', () => {
        const text = VALID_SLOT.replace('# Voice', '# Voice​‮');
        expect(validateBrandVoiceSlotText(text).map((i) => i.field)).toContain('hidden-unicode');
    });

    it('slot-untrusted: absolute or escaping references are refused, relative paths and URLs pass', () => {
        const abs = VALID_SLOT
            .replace('evidence_ref: docs/bench/import.md', 'evidence_ref: /Users/someone/bench.md')
            .replace('ref: docs/brand/voice-workshop.md', 'ref: ../outside/notes.md');
        const fields = validateBrandVoiceSlotText(abs).map((i) => i.field);
        expect(fields).toEqual(expect.arrayContaining(['claims[0].evidence_ref', 'provenance.sources[0].ref']));
        expect(validateBrandVoiceSlotText(VALID_SLOT)).toEqual([]);
    });

    it('slot-untrusted: the lint reports a broken slot file under its path', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spine-slot-'));
        try {
            const p = path.join(dir, 'brand-voice.md');
            fs.writeFileSync(p, VALID_SLOT.replace('confidence: med', 'confidence: certain'));
            expect(mod.lint_brand_voice_slot(p).join('\n')).toContain('provenance.confidence');
            fs.writeFileSync(p, VALID_SLOT);
            expect(mod.lint_brand_voice_slot(p)).toEqual([]);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
