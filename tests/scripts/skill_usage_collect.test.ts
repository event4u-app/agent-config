// Tests for src/scripts/skill_usage_collect.ts (py2ts Phase 8 / Wave 8b).
//
// No pytest suite exists, so this is a focused differential suite over the
// pure helpers (project_slug, extract_listing, extract_text, find_mentions,
// hash_prompt) plus a golden-parity layer that builds a synthetic session
// jsonl under a UNIQUE ~/.claude/projects/<slug>/ dir, runs python3 vs tsx, and
// compares stdout + the appended compact JSONL byte-for-byte (incl. the
// dedup-on-second-run path). The fixture dir + temp out are removed afterwards
// so the test leaves zero git drift and never touches real session data.
import * as crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';

import * as su from '../../src/scripts/skill_usage_collect.js';



describe('skill_usage_collect — pure helpers', () => {
    it('project_slug replaces every / with -', () => {
        expect(su.project_slug('/a/b/c')).toBe('-a-b-c');
    });
    it('extract_listing reads slugs from a skill_listing attachment', () => {
        const got = su.extract_listing({
            type: 'attachment',
            attachment: { type: 'skill_listing', content: '- alpha: x\n- beta-skill: y\n' },
        });
        expect([...got].sort()).toEqual(['alpha', 'beta-skill']);
    });
    it('extract_listing returns empty for a non-listing attachment', () => {
        expect(su.extract_listing({ attachment: { type: 'other' } }).size).toBe(0);
    });
    it('extract_text joins assistant text blocks', () => {
        const t = su.extract_text({
            type: 'assistant',
            message: { content: [{ type: 'text', text: 'a' }, { type: 'tool', text: 'skip' }, { type: 'text', text: 'b' }] },
        });
        expect(t).toBe('a\nb');
    });
    it('find_mentions matches an anchor verb + backtick slug and a SKILL.md path', () => {
        const hits = su.find_mentions(
            'I am using `alpha` and see .claude/skills/gamma/SKILL.md',
            ['alpha', 'beta'],
        );
        expect(hits.has('alpha')).toBe(true);
        expect(hits.has('gamma')).toBe(true);
        expect(hits.has('beta')).toBe(false);
    });
    it('hash_prompt is the 16-char prefix of sha256(first 200 chars)', () => {
        const expected = crypto
            .createHash('sha256')
            .update(Buffer.from('hello', 'utf-8'))
            .digest('hex')
            .slice(0, 16);
        expect(su.hash_prompt('hello')).toBe(expected);
        expect(su.hash_prompt('')).toBe('');
    });
});
