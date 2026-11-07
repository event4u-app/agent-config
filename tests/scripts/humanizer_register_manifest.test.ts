// road-to-rewrites-that-keep-their-facts 5.1: the humanizer tell register
// carries a refresh cadence the corpus-staleness gate enforces, and a per-family
// `evidence_tier` and `suppressible` that are checked against the code rather
// than asserted.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ALL_TELL_RULES } from '../../src/scripts/ai_tells_rules.js';
import { loadPairs } from '../../internal/bench/core/bench_humanizer_eval.js';
import { check_staleness, discover_corpora, parse_iso_date, run_checks } from '../../src/scripts/check_corpus_staleness.js';
import { analyzeText } from '../../src/scripts/detect_ai_tells.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MANIFEST = path.join(REPO, 'src', 'skills', 'humanizer', 'data', 'manifest.json');
const DASH = 'dash-density';

interface Family {
    evidence_tier: string;
    suppressible: boolean;
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as {
    refresh_cadence: string;
    upstream: { last_checked: string };
    families: Record<string, Family>;
};

describe('humanizer register manifest', () => {
    it('names every tell rule and dash density exactly once', () => {
        expect(Object.keys(manifest.families).sort()).toEqual([...ALL_TELL_RULES.map((r) => r.id), DASH].sort());
    });

    it('every family carries exactly a valid evidence_tier and a boolean suppressible', () => {
        for (const [id, f] of Object.entries(manifest.families)) {
            expect(Object.keys(f).sort(), id).toEqual(['evidence_tier', 'suppressible']);
            expect(['seeded', 'probe'], id).toContain(f.evidence_tier);
            expect(typeof f.suppressible, id).toBe('boolean');
        }
    });

    it('`seeded` means a before-fixture triggers the family, and `probe` that none does', () => {
        const seeded = new Set<string>();
        for (const p of loadPairs()) {
            const r = analyzeText(p.before, p.language);
            for (const [id, n] of Object.entries(r.per_pattern)) if (n > 0) seeded.add(id);
            if (r.dash_count > 0) seeded.add(DASH);
        }
        for (const [id, f] of Object.entries(manifest.families)) {
            expect(f.evidence_tier, id).toBe(seeded.has(id) ? 'seeded' : 'probe');
        }
    });

    it('only the style group and dash density are suppressible by a voice fingerprint', () => {
        const group = new Map(ALL_TELL_RULES.map((r) => [r.id, r.group]));
        for (const [id, f] of Object.entries(manifest.families)) {
            expect(f.suppressible, id).toBe(id === DASH || group.get(id) === 'style');
        }
        expect(manifest.families['tell-chat-artifact']?.suppressible).toBe(false);
    });

    it('is a corpus the staleness gate reads, and it goes stale after a quarter', () => {
        const corpus = discover_corpora().find((c) => c.slug === 'humanizer');
        expect(corpus).toBeDefined();
        const checked = parse_iso_date(manifest.upstream.last_checked);
        expect(checked).not.toBeNull();
        expect(manifest.refresh_cadence).toBe('quarterly');
        expect(check_staleness(corpus!, checked!)).toEqual([]);
        expect(check_staleness(corpus!, checked! + 101 * 86_400_000).map((f) => f.kind)).toEqual(['stale-corpus']);
        expect(run_checks(checked!).cadenced).toContain('humanizer');
    });
});
