// Tests for internal/bench/provenance/ (road-to-provenance-and-license-governance
// S0.1 — golden corpus). This is a fixture-integrity suite, not a script test:
// it asserts the corpus.json index matches what's actually on disk, that the
// depth/category counts the S0.2 acceptance thresholds are pre-registered
// against (docs/CLAIMS.md: recall on 8 verbatim + 8 rename-only, FP on 12
// independent) hold exactly, that the rename-only/structural-rewrite →
// verbatim traceability chain (derived_from) is intact, that every sample
// carries the provenance-note fields the sourcing decision in README.md
// promises, and that internal/ never ships in the npm tarball.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const PROVENANCE_DIR = path.join(REPO_ROOT, 'internal', 'bench', 'provenance');
const CORPUS_JSON = path.join(PROVENANCE_DIR, 'corpus.json');

interface CorpusSample {
    id: string;
    sample_type: 'seeded' | 'independent';
    lang: 'ts' | 'php';
    depth: string;
    algorithm: string;
    source_kind: string;
    license: string;
    provenance_note: string;
    reference_url: string | null;
    file: string;
    derived_from: string | null;
}

interface Corpus {
    _meta: {
        counts: { total: number; seeded: number; independent: number; seeded_per_depth: number };
        seeded_depths: string[];
    };
    samples: CorpusSample[];
}

function loadCorpus(): Corpus {
    const raw = fs.readFileSync(CORPUS_JSON, 'utf-8');
    return JSON.parse(raw) as Corpus;
}

describe('provenance corpus — corpus.json ↔ disk parity', () => {
    it('corpus.json is valid JSON with a samples array', () => {
        const corpus = loadCorpus();
        expect(Array.isArray(corpus.samples)).toBe(true);
        expect(corpus.samples.length).toBeGreaterThan(0);
    });

    it('every sample.file listed in corpus.json exists on disk', () => {
        const corpus = loadCorpus();
        for (const sample of corpus.samples) {
            const abs = path.join(PROVENANCE_DIR, sample.file);
            expect(fs.existsSync(abs), `missing file for ${sample.id}: ${sample.file}`).toBe(true);
        }
    });

    it('no orphan files on disk outside corpus.json (seeded + independent dirs)', () => {
        const corpus = loadCorpus();
        const known = new Set(corpus.samples.map((s) => path.normalize(s.file)));

        for (const sub of ['samples/seeded', 'samples/independent']) {
            const dir = path.join(PROVENANCE_DIR, sub);
            const entries = fs.readdirSync(dir);
            for (const entry of entries) {
                const rel = path.normalize(path.join(sub, entry));
                expect(known.has(rel), `orphan file not indexed in corpus.json: ${rel}`).toBe(true);
            }
        }
    });
});

describe('provenance corpus — 36-sample composition (S0.2 threshold denominators)', () => {
    it('exactly 36 total samples, 24 seeded + 12 independent', () => {
        const corpus = loadCorpus();
        expect(corpus.samples.length).toBe(36);

        const seeded = corpus.samples.filter((s) => s.sample_type === 'seeded');
        const independent = corpus.samples.filter((s) => s.sample_type === 'independent');
        expect(seeded.length).toBe(24);
        expect(independent.length).toBe(12);
    });

    it('exactly 8 seeded samples per depth (verbatim / rename-only / structural-rewrite)', () => {
        const corpus = loadCorpus();
        const seeded = corpus.samples.filter((s) => s.sample_type === 'seeded');

        for (const depth of ['verbatim', 'rename-only', 'structural-rewrite']) {
            const atDepth = seeded.filter((s) => s.depth === depth);
            expect(atDepth.length, `expected 8 seeded samples at depth=${depth}`).toBe(8);
        }
    });

    it('the 16 = 8 verbatim + 8 rename-only subset the S0.2 recall floor is denominated on is exactly 16', () => {
        const corpus = loadCorpus();
        const recallSubset = corpus.samples.filter(
            (s) => s.sample_type === 'seeded' && (s.depth === 'verbatim' || s.depth === 'rename-only'),
        );
        expect(recallSubset.length).toBe(16);
    });

    it('seeded samples split 4 TS + 4 PHP per depth', () => {
        const corpus = loadCorpus();
        const seeded = corpus.samples.filter((s) => s.sample_type === 'seeded');

        for (const depth of ['verbatim', 'rename-only', 'structural-rewrite']) {
            const atDepth = seeded.filter((s) => s.depth === depth);
            expect(atDepth.filter((s) => s.lang === 'ts').length).toBe(4);
            expect(atDepth.filter((s) => s.lang === 'php').length).toBe(4);
        }
    });
});

describe('provenance corpus — derived_from traceability (design principle 6)', () => {
    it('every non-verbatim seeded sample has a derived_from pointing at an existing verbatim id', () => {
        const corpus = loadCorpus();
        const seeded = corpus.samples.filter((s) => s.sample_type === 'seeded');
        const verbatimIds = new Set(seeded.filter((s) => s.depth === 'verbatim').map((s) => s.id));

        for (const sample of seeded) {
            if (sample.depth === 'verbatim') {
                expect(sample.derived_from, `verbatim sample ${sample.id} must not carry derived_from`).toBeNull();
                continue;
            }

            expect(sample.derived_from, `${sample.id} (depth=${sample.depth}) missing derived_from`).not.toBeNull();
            expect(
                verbatimIds.has(sample.derived_from as string),
                `${sample.id}.derived_from=${sample.derived_from} does not name a verbatim sample`,
            ).toBe(true);
        }
    });

    it('derived_from siblings share the same algorithm + language as their verbatim source', () => {
        const corpus = loadCorpus();
        const byId = new Map(corpus.samples.map((s) => [s.id, s] as const));

        for (const sample of corpus.samples) {
            if (!sample.derived_from) {
                continue;
            }
            const source = byId.get(sample.derived_from);
            expect(source, `${sample.id}.derived_from=${sample.derived_from} not found in corpus.json`).toBeDefined();
            expect(source?.algorithm).toBe(sample.algorithm);
            expect(source?.lang).toBe(sample.lang);
        }
    });

    it('independent samples never carry a derived_from (no seeded-source dependency)', () => {
        const corpus = loadCorpus();
        for (const sample of corpus.samples.filter((s) => s.sample_type === 'independent')) {
            expect(sample.derived_from, `${sample.id} is independent but carries derived_from`).toBeNull();
        }
    });
});

describe('provenance corpus — provenance-note fields (privacy/sourcing floor)', () => {
    it('every entry carries source_kind=synthetic-canonical, a license, and a non-empty provenance_note', () => {
        const corpus = loadCorpus();
        for (const sample of corpus.samples) {
            expect(sample.source_kind, `${sample.id} missing source_kind`).toBe('synthetic-canonical');
            expect(sample.license, `${sample.id} missing license`).toBeTruthy();
            expect(sample.provenance_note, `${sample.id} missing provenance_note`).toBeTruthy();
            expect(sample.provenance_note.length).toBeGreaterThan(20);
        }
    });

    it('no reference_url points at a code file (only algorithm-description domains allowed)', () => {
        const corpus = loadCorpus();
        const allowedHosts = ['en.wikipedia.org', 'semver.org', 'www.rfc-editor.org', 'url.spec.whatwg.org'];

        for (const sample of corpus.samples) {
            if (sample.reference_url === null) {
                continue;
            }
            const url = new URL(sample.reference_url);
            expect(
                allowedHosts.includes(url.host),
                `${sample.id}.reference_url host ${url.host} is not an allowed algorithm-description domain`,
            ).toBe(true);
            // Never a source-file-shaped path (github.com blob/raw, gitlab, bitbucket, npm, packagist).
            expect(/github\.com|gitlab\.com|bitbucket\.org|npmjs\.com|packagist\.org/.test(sample.reference_url)).toBe(
                false,
            );
        }
    });
});

describe('provenance corpus — npm-pack exclusion', () => {
    it("package.json's files allowlist contains no path under internal/", () => {
        const pkgRaw = fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8');
        const pkg = JSON.parse(pkgRaw) as { files?: string[] };
        const files = pkg.files ?? [];

        // package.json declares `files` as an allowlist — anything not listed
        // is never packed. We assert no entry could match internal/ content:
        // no literal `internal` prefix, and no everything-glob (`.`, `*`, `**`)
        // that would implicitly re-include it.
        for (const entry of files) {
            expect(entry.startsWith('internal'), `files allowlist entry "${entry}" would ship internal/`).toBe(
                false,
            );
            expect(['.', '*', '**'].includes(entry), `files allowlist entry "${entry}" is an everything-glob`).toBe(
                false,
            );
        }
    });
});
