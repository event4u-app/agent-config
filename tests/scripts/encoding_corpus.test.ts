/**
 * Frozen encoding-channel corpus — integrity, round-trip, and scope guard
 * (road-to-runtime-encoding-hardening Phase 2).
 *
 * These assertions are what make the corpus usable as a measurement instrument.
 * Without them a corpus can be balanced, hashed, committed, and still measure
 * nothing: positives that were never actually encoded, negatives that secretly
 * contain the signal, or a quietly-widened scope that turns a text-layer claim
 * into an over-claim.
 *
 * Hostile codepoints are built with String.fromCodePoint so this file stays
 * clean text.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    CHANNELS,
    MIN_NEGATIVES,
    MIN_POSITIVES,
    OUT_DIR,
    buildManifest,
    buildNegatives,
    buildPositives,
    main,
    type CorpusEntry,
} from '../../src/scripts/encoding_corpus.js';

const cp = (n: number): string => String.fromCodePoint(n);

function readJsonl(name: string): CorpusEntry[] {
    const raw = fs.readFileSync(path.join(OUT_DIR, name), 'utf-8');
    return raw
        .split('\n')
        .filter((l) => l !== '')
        .map((l) => JSON.parse(l) as CorpusEntry);
}

/** Does `s` carry at least one codepoint belonging to `channel`'s class? */
function carriesSignal(channel: string, s: string): boolean {
    const has = (pred: (n: number) => boolean): boolean =>
        [...s].some((ch) => pred(ch.codePointAt(0) as number));
    switch (channel) {
        case 'zero-width':
            return has((n) => [0x200b, 0x200c, 0x200d].includes(n));
        case 'zero-width-joiner-bom':
            return has((n) => [0xfeff, 0x2060, 0x00ad].includes(n));
        case 'bidi-control':
            return has((n) => [0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069].includes(n));
        case 'invisible-tag-block':
            return has((n) => n >= 0xe0000 && n <= 0xe007f);
        case 'deprecated-format':
            return has((n) => [0x206a, 0x206b, 0x206c, 0x206d, 0x206e, 0x206f, 0xfff9, 0xfffa, 0xfffb].includes(n));
        case 'private-use-area':
            return has((n) => n >= 0xe000 && n <= 0xf8ff);
        case 'control-char':
            return has((n) => (n <= 0x1f || (n >= 0x7f && n <= 0x9f)) && n !== 0x09 && n !== 0x0a && n !== 0x0d);
        case 'invisible-filler':
            return has((n) => [0x3164, 0x115f, 0x1160].includes(n));
        case 'variation-selector-run':
            return has((n) => (n >= 0xfe00 && n <= 0xfe0f) || (n >= 0xe0100 && n <= 0xe01ef));
        case 'confusable-cyrillic':
            return has((n) => n >= 0x0400 && n <= 0x04ff);
        case 'confusable-greek':
            return has((n) => n >= 0x0370 && n <= 0x03ff);
        case 'math-alphanumeric':
            return has((n) => n >= 0x1d400 && n <= 0x1d7ff);
        case 'fullwidth-forms':
            return has((n) => n >= 0xff01 && n <= 0xff5e);
        case 'combining-mark-run':
            return has((n) => n >= 0x0300 && n <= 0x036f);
        case 'punycode-idn':
            return /xn--/.test(s);
        default:
            throw new Error(`no signal predicate for channel ${channel}`);
    }
}

describe('encoding corpus — construction', () => {
    it('meets the pre-registered floor and covers every channel', () => {
        const pos = buildPositives();
        const neg = buildNegatives();
        expect(pos.length).toBeGreaterThanOrEqual(MIN_POSITIVES);
        expect(neg.length).toBeGreaterThanOrEqual(MIN_NEGATIVES);
        const channels = new Set(pos.map((e) => e.channel));
        expect(channels.size).toBe(CHANNELS.length);
    });

    it('is balanced across channels by construction, not by luck', () => {
        const hist: Record<string, number> = {};
        for (const e of buildPositives()) hist[e.channel] = (hist[e.channel] ?? 0) + 1;
        const counts = Object.values(hist);
        // Round-robin emission: every channel gets the same count.
        expect(Math.min(...counts)).toBe(Math.max(...counts));
    });

    it('round-trips: every positive actually carries its channel signal', () => {
        const misencoded = buildPositives().filter((e) => !carriesSignal(e.channel, e.text));
        // A positive whose encoder silently no-opped would inflate recall
        // measurement by being trivially "detected" or trivially missed.
        expect(misencoded.map((e) => e.id)).toEqual([]);
    });

    it('negatives are genuinely clean of every channel under test', () => {
        // If a real rule body happened to contain a confusable, it would be a
        // MISLABEL, not a negative, and the false-positive rate measured against
        // it would be meaningless.
        const dirty: string[] = [];
        for (const e of buildNegatives()) {
            for (const ch of CHANNELS) {
                if (carriesSignal(ch.id, e.text)) dirty.push(`${e.id} carries ${ch.id}`);
            }
        }
        expect(dirty).toEqual([]);
    });

    it('negatives come from real content of all three declared kinds', () => {
        const kinds = new Set(buildNegatives().map((e) => e.channel));
        expect([...kinds].sort()).toEqual(['inter-agent-message', 'retrieval-chunk', 'rule-body']);
    });

    it('is deterministic — two builds are byte-identical', () => {
        // The sha256 freeze is meaningless if emission varies between runs.
        expect(JSON.stringify(buildPositives())).toBe(JSON.stringify(buildPositives()));
        expect(JSON.stringify(buildNegatives())).toBe(JSON.stringify(buildNegatives()));
    });
});

describe('encoding corpus — scope guard (text layer only)', () => {
    it('every committed entry is layer=text', () => {
        const all = [...readJsonl('positives.jsonl'), ...readJsonl('negatives.jsonl')];
        expect(all.length).toBeGreaterThan(0);
        const offenders = all.filter((e) => e.layer !== 'text');
        expect(offenders.map((e) => e.id)).toEqual([]);
    });

    it('FAILS when a deliberately out-of-scope fixture is added', () => {
        // The guard's own falsification test. Without this, "all entries are
        // text" could hold because the check never really looked.
        const outOfScope = {
            id: 'pos-png-metadata-000',
            label: 'positive',
            channel: 'png-metadata-stego',
            layer: 'file', // <- file layer: out of this package's threat model
            disposition: 'flag',
            text: 'a PNG tEXt chunk carrying an instruction',
        } as unknown as CorpusEntry;
        const withOffender = [...readJsonl('positives.jsonl'), outOfScope];
        const offenders = withOffender.filter((e) => e.layer !== 'text');
        expect(offenders.map((e) => e.id)).toEqual(['pos-png-metadata-000']);
    });

    it('every channel spec declares the text layer', () => {
        expect(CHANNELS.filter((c) => c.layer !== 'text')).toEqual([]);
    });
});

describe('encoding corpus — the freeze', () => {
    it('on-disk corpus matches its committed sha256 manifest', () => {
        expect(main(['--check'])).toBe(0);
    });

    it('the manifest describes the corpus that is actually committed', () => {
        const manifest = JSON.parse(
            fs.readFileSync(path.join(OUT_DIR, 'manifest.json'), 'utf-8'),
        ) as ReturnType<typeof buildManifest>;
        const pos = readJsonl('positives.jsonl');
        const neg = readJsonl('negatives.jsonl');
        expect(manifest.counts.positives).toBe(pos.length);
        expect(manifest.counts.negatives).toBe(neg.length);
        expect(manifest.counts.channels).toBe(CHANNELS.length);
    });

    it('a mutated corpus is detected by the freeze check', () => {
        // Falsifies the freeze itself: if --check passed regardless of content,
        // the manifest would be decoration.
        const target = path.join(OUT_DIR, 'positives.jsonl');
        const original = fs.readFileSync(target, 'utf-8');
        try {
            fs.writeFileSync(target, original + JSON.stringify({ id: 'tamper' }) + '\n', 'utf-8');
            expect(main(['--check'])).toBe(1);
        } finally {
            fs.writeFileSync(target, original, 'utf-8');
        }
        expect(main(['--check'])).toBe(0);
    });
});
