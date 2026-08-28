// Pre-registration integrity for the in-repo code-graph benchmark corpus.
//
// These assertions are the machine half of `road-to-code-graph-evidence-that-
// exists` steps 1.1, 1.2 and 1.3 — the roadmap requires each to be "asserted by
// a test over the corpus file" rather than left to review, because a corpus is
// exactly the artefact whose defects are invisible in a diff.
//
// The corpus is ALSO bound by SHA-256 in the pre-registration and the runner
// refuses on mismatch. That gate stops a post-registration edit; these tests
// stop a corpus that was malformed at registration time. Neither substitutes
// for the other.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

import * as yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const BENCH_DIR = join(REPO_ROOT, 'internal', 'bench', 'code-graph');
const CORPUS_PATH = join(BENCH_DIR, 'inrepo-corpus-2026-08-28.yaml');
const PREREG_PATH = join(BENCH_DIR, 'PREREGISTRATION-inrepo-2026-08-28.md');

/** The four graph-shaped classes, fixed in the pre-registration. */
const GRAPH_CLASSES = ['callers', 'transitive-impact', 'path-between', 'references'] as const;
const NEGATIVE = 'negative-control';

interface TruthSite { path: string; why: string }
interface Question {
    id: string; root: string; category: string; question: string;
    probe: string; probe_kind: string; truth: TruthSite[];
}
interface Corpus { corpus_version: number; roots: { name: string; path: string }[]; questions: Question[] }

const rawCorpus = readFileSync(CORPUS_PATH, 'utf-8');
const corpus = yaml.load(rawCorpus) as Corpus;
const rootByName = new Map(corpus.roots.map((r) => [r.name, r.path]));

describe('in-repo code-graph corpus — 1.1 shapes, never consumer identity', () => {
    it('every truth path resolves to a real file INSIDE this repository', () => {
        const offenders: string[] = [];
        for (const q of corpus.questions) {
            const rootPath = rootByName.get(q.root);
            expect(rootPath, `question ${q.id} names unknown root '${q.root}'`).toBeDefined();
            for (const t of q.truth) {
                const abs = resolve(REPO_ROOT, rootPath as string, t.path);
                if (!abs.startsWith(REPO_ROOT + sep)) offenders.push(`${q.id}: escapes repo -> ${t.path}`);
                else if (!existsSync(abs)) offenders.push(`${q.id}: does not exist -> ${rootPath}/${t.path}`);
            }
        }
        expect(offenders, offenders.join('\n')).toEqual([]);
    });

    it('no truth path is absolute or parent-relative — an out-of-tree reference is refused by shape too', () => {
        // Belt and braces beside the resolve() check above: a path that happens
        // to resolve inside the repo via `..` is still not a shape this corpus
        // is allowed to carry, because it would not survive a different checkout.
        const offenders = corpus.questions.flatMap((q) =>
            q.truth.filter((t) => t.path.startsWith('/') || t.path.includes('..')).map((t) => `${q.id}: ${t.path}`),
        );
        expect(offenders, offenders.join('\n')).toEqual([]);
    });

    it('every root is a real directory inside this repository', () => {
        for (const r of corpus.roots) {
            const abs = resolve(REPO_ROOT, r.path);
            expect(abs.startsWith(REPO_ROOT + sep), `root ${r.name} escapes the repo`).toBe(true);
            expect(existsSync(abs), `root ${r.name} -> ${r.path} does not exist`).toBe(true);
        }
    });
});

describe('in-repo code-graph corpus — 1.2 coverage and negative controls', () => {
    it('each of the four graph-shaped query classes carries at least one question', () => {
        for (const c of GRAPH_CLASSES) {
            const n = corpus.questions.filter((q) => q.category === c).length;
            expect(n, `class '${c}' has no question`).toBeGreaterThanOrEqual(1);
        }
    });

    it('at least a quarter of the set is negative control', () => {
        const total = corpus.questions.length;
        const negatives = corpus.questions.filter((q) => q.category === NEGATIVE).length;
        expect(negatives / total, `${negatives}/${total} negative controls`).toBeGreaterThanOrEqual(0.25);
    });

    it('every question declares a category the pre-registration knows', () => {
        const known = new Set<string>([...GRAPH_CLASSES, NEGATIVE]);
        const unknown = corpus.questions.filter((q) => !known.has(q.category)).map((q) => `${q.id}:${q.category}`);
        expect(unknown, unknown.join(', ')).toEqual([]);
    });

    it('every question carries a probe, a probe kind the runner understands, and non-empty truth', () => {
        for (const q of corpus.questions) {
            expect(q.probe, `${q.id} has no probe`).toBeTruthy();
            expect(['symbol', 'literal'], `${q.id} probe_kind`).toContain(q.probe_kind);
            expect(q.truth.length, `${q.id} has empty truth`).toBeGreaterThan(0);
            for (const t of q.truth) expect(t.why, `${q.id} truth ${t.path} has no rationale`).toBeTruthy();
        }
    });

    it('question ids are unique', () => {
        const ids = corpus.questions.map((q) => q.id);
        expect(new Set(ids).size, `duplicate ids in ${ids.join(', ')}`).toBe(ids.length);
    });

    it('the set spans every declared root — a corpus concentrated in one tree measures one tree', () => {
        for (const r of corpus.roots) {
            const n = corpus.questions.filter((q) => q.root === r.name).length;
            expect(n, `root '${r.name}' carries no question`).toBeGreaterThanOrEqual(1);
        }
    });
});

describe('in-repo code-graph corpus — 1.3 the corpus states its own limits', () => {
    it('carries a Limits section', () => {
        expect(/^#\s*(##\s*)?Limits/im.test(rawCorpus) || /Limits\b/.test(rawCorpus)).toBe(true);
    });

    it('names the incomparability with the 2026-07-28 run explicitly, so no reader can quote a delta', () => {
        expect(rawCorpus).toMatch(/NOT COMPARABLE/i);
        expect(rawCorpus).toMatch(/2026-07-28/);
        expect(rawCorpus).toMatch(/delta/i);
    });

    it('names all three reasons the two runs cannot be subtracted', () => {
        // corpus, question set, and build — the pre-registration lists the same
        // three, and a limits note that drops one invites the arithmetic back.
        expect(rawCorpus).toMatch(/corpus/i);
        expect(rawCorpus).toMatch(/question set/i);
        expect(rawCorpus).toMatch(/2026-08-22|extractor repair/i);
    });
});

describe('in-repo code-graph corpus — pre-registration binding', () => {
    it('the pre-registration pins THIS corpus by SHA-256, and the pin matches', () => {
        const prereg = readFileSync(PREREG_PATH, 'utf-8');
        const pinned = prereg.match(/^([0-9a-f]{64})\s+inrepo-corpus-2026-08-28\.yaml$/m)?.[1];
        expect(pinned, 'pre-registration carries no SHA-256 line for the corpus').toBeDefined();
        const actual = createHash('sha256').update(readFileSync(CORPUS_PATH)).digest('hex');
        expect(actual, 'corpus was edited after registration — the run is voided, not re-pinned').toBe(pinned);
    });

    it('the pre-registration declares per-class bars, not a single aggregate', () => {
        const prereg = readFileSync(PREREG_PATH, 'utf-8');
        expect(prereg).toMatch(/PER QUESTION CLASS/i);
        expect(prereg).toMatch(/NOT a pass criterion/i);
    });
});
