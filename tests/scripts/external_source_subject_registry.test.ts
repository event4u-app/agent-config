/**
 * The comparison-subject registry, bound to the denylist it is supposed to feed.
 *
 * THE READING THIS SUITE CLOSES
 *
 * Measured 2026-09-29 at `dbf1c917956745119e20ab3c3551fe20e33c26c6`
 * (`origin/main`), against the `deny` array of
 * `src/scripts/external_sources_denylist.json` as it stood at that commit:
 *
 *     CAUGHT 5 of 10
 *
 * Caught: S1, S2, S3, S4, S6 — the five subjects that had already entered the
 * tree through earlier ecosystem sweeps. Uncaught: S5, S7, S8, S9, S10. The
 * gate was therefore green on a tracked file that could name five external
 * subjects in plaintext, and the round that emitted nine roadmaps read that
 * green as confirmation its files were clean.
 *
 * Reproduce the before-reading from a clone (the base commit is the parent of
 * the change that added this file):
 *
 *     node -e "const{execSync}=require('node:child_process');const fs=require('node:fs');\
 *     const base=JSON.parse(execSync('git show dbf1c917:src/scripts/external_sources_denylist.json',{encoding:'utf8'}));\
 *     const reg=JSON.parse(fs.readFileSync('src/scripts/external_sources_denylist.json','utf8')).subjects;\
 *     console.log(reg.filter(s=>base.deny.some(p=>new RegExp(p,'i').test(s.slug))).length+' of '+reg.length)"
 *
 * `the base-ref reading` below runs exactly that predicate as an assertion, so
 * the figure in this docstring is executable rather than prose. Reproduce the
 * after-reading with:
 *
 *     npx vitest run tests/scripts/external_source_subject_registry.test.ts
 *
 * A CORRECTION TO THE ROADMAP THAT COMMISSIONED THIS
 *
 * `road-to-a-denylist-that-sees-every-subject` states the before-reading as
 * `2 of 10` and asks for eight new rows. That figure does not reproduce: the
 * measurement above, and the base-ref assertion below, both return five. The
 * roadmap's own gloss — "only the two subjects that entered the tree through an
 * earlier harvest have `deny` patterns" — undercounts the earlier sweeps, which
 * had already denied three further subjects. Five rows were owed, not eight;
 * ten patterns were added, two per uncaught subject.
 *
 * WHY NO SUBJECT NAME APPEARS IN THIS FILE
 *
 * A fixture holding ten plaintext subject names is a tracked file publishing
 * exactly what the gate exists to hide — the roadmap's own Risk 2. Every corpus
 * here is synthesised at run time from the registry in the denylist, which is
 * the single path `skip_paths` exempts from the scan and which already had to
 * carry these tokens as deny data. Assertions are over counts and line
 * positions, never over names, so this file stays readable without disclosing
 * anything. The same discipline the sibling `check_no_external_sources.test.ts`
 * adopted in `road-to-source-silence` Phase 2.2.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const SHIPPED_CONFIG = path.join(REPO_ROOT, 'src', 'scripts', 'external_sources_denylist.json');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_no_external_sources.ts');
const LIB_SRC = path.join(REPO_ROOT, 'src', 'scripts', '_lib');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

/** The base commit the docstring's reading was taken at. */
const BASE_REF = 'dbf1c917956745119e20ab3c3551fe20e33c26c6';

const big = (cwd: string) => ({ maxBuffer: 256 * 1024 * 1024, cwd, encoding: 'utf8' as const });

interface Subject {
    id: string;
    slug: string;
    note?: string;
}

interface Config {
    deny: string[];
    subjects: Subject[];
}

const cfg = JSON.parse(fs.readFileSync(SHIPPED_CONFIG, 'utf-8')) as Config;

/** Deny patterns that fire on one slug. */
function covering(slug: string, deny: readonly string[]): string[] {
    return deny.filter((p) => new RegExp(p, 'i').test(slug));
}

/**
 * A near miss: `zz` pushed into the middle of every alphanumeric run of three
 * or more characters.
 *
 * Appending a suffix would not do — roughly a third of the shipped patterns are
 * unanchored substrings, and a substring survives a suffix. Mutating the
 * INTERIOR of each run breaks the anchored and the unanchored class alike,
 * while leaving a string that is still recognisably the shape of a repo slug.
 * That is the point of the negative corpus: it must be close enough that a
 * sloppy pattern would claim it.
 */
export function nearMiss(slug: string): string {
    return slug.replace(/[A-Za-z0-9]{3,}/g, (run) => {
        const mid = Math.floor(run.length / 2);
        return `${run.slice(0, mid)}zz${run.slice(mid)}`;
    });
}

/** Copy the gate and every `_lib` module it could import into a fixture tree. */
function plantGate(work: string): void {
    const libDst = path.join(work, 'src', 'scripts', '_lib');
    fs.mkdirSync(libDst, { recursive: true });
    fs.copyFileSync(TS_SCRIPT, path.join(work, 'src', 'scripts', 'check_no_external_sources.ts'));
    for (const name of fs.readdirSync(LIB_SRC)) {
        const src = path.join(LIB_SRC, name);
        if (name.endsWith('.ts') && fs.statSync(src).isFile()) {
            fs.copyFileSync(src, path.join(libDst, name));
        }
    }
}

/**
 * Run the real gate over a throwaway repo whose only content is `body`.
 *
 * The SHIPPED config is copied in, so the patterns under test are the ones that
 * actually ship — not a fixture list that could drift away from them.
 */
function scan(body: string): { status: number; hits: Array<{ file: string; line: number }> } {
    const work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'subjreg-')));
    try {
        fs.mkdirSync(path.join(work, 'src', 'scripts'), { recursive: true });
        fs.copyFileSync(SHIPPED_CONFIG, path.join(work, 'src', 'scripts', 'external_sources_denylist.json'));
        plantGate(work);
        fs.writeFileSync(path.join(work, 'corpus.md'), body, 'utf-8');
        spawnSync('git', ['init', '-q'], big(work));
        spawnSync('git', ['add', '-A'], big(work));
        const r = spawnSync(
            TSX_BIN,
            [path.join(work, 'src', 'scripts', 'check_no_external_sources.ts'), '--json'],
            big(work),
        );
        const parsed = JSON.parse(r.stdout as string) as { hits: Array<{ file: string; line: number }> };
        return { status: r.status as number, hits: parsed.hits };
    } finally {
        fs.rmSync(work, { recursive: true, force: true });
    }
}

/** One slug per line, so a hit's line number identifies the subject positionally. */
function corpusOf(transform: (slug: string) => string): string {
    return `${cfg.subjects.map((s) => `an external reference at ${transform(s.slug)} was read`).join('\n')}\n`;
}

// --- The registry is real ---------------------------------------------------
//
// Every loop below is over `cfg.subjects`, and a loop over an empty array
// passes. These two assertions are the dead-scope guard: they make an emptied
// registry a failure rather than a silent green.

describe('comparison-subject registry — scope', () => {
    it('the registry and the deny array are both non-empty', () => {
        expect(cfg.subjects.length).toBeGreaterThan(0);
        expect(cfg.deny.length).toBeGreaterThan(0);
    });

    it('every registry row carries an id and a slug, and ids are unique', () => {
        for (const s of cfg.subjects) {
            expect(typeof s.id).toBe('string');
            expect(s.id.length).toBeGreaterThan(0);
            expect(s.slug).toMatch(/^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/);
        }
        expect(new Set(cfg.subjects.map((s) => s.id)).size).toBe(cfg.subjects.length);
    });
});

// --- Phase 3.1: the binding -------------------------------------------------

describe('comparison-subject registry — bound to the denylist', () => {
    it('every subject in the registry is matched by at least one deny pattern', () => {
        const uncovered = cfg.subjects.filter((s) => covering(s.slug, cfg.deny).length === 0).map((s) => s.id);
        expect(
            uncovered,
            `${uncovered.length} of ${cfg.subjects.length} registry subjects have no deny pattern. ` +
                'Add one row per uncaught subject to `deny` in ' +
                'src/scripts/external_sources_denylist.json. Ids only — this message never names a subject.',
        ).toEqual([]);
    });

    it('the binding predicate can fail — an unregistered slug is reported uncovered', () => {
        // Polarity. A gate never shown its own denial has untested sensitivity,
        // and this predicate is the whole of Phase 3.1: if it cannot report a
        // miss, the test above is a tautology over a list that always matches.
        const invented = 'example-owner/example-unregistered-subject';
        expect(covering(invented, cfg.deny)).toEqual([]);
        const withInvented = [...cfg.subjects, { id: 'SYNTHETIC', slug: invented }];
        const uncovered = withInvented.filter((s) => covering(s.slug, cfg.deny).length === 0).map((s) => s.id);
        expect(uncovered).toEqual(['SYNTHETIC']);
    });
});

// --- AC-1 / AC-4: both directions, through the real gate --------------------

describe('comparison-subject registry — the shipped gate, end to end', () => {
    it('a file naming every subject reds the gate, one hit per line', () => {
        const { status, hits } = scan(corpusOf((slug) => slug));
        expect(status).toBe(1);
        const lines = new Set(hits.filter((h) => h.file === 'corpus.md').map((h) => h.line));
        const expected = cfg.subjects.map((_, i) => i + 1);
        // Positional, not nominal: line N of the corpus is registry row N, so
        // proving the line set is complete proves every subject reds without
        // this file ever naming one.
        expect([...lines].sort((a, b) => a - b)).toEqual(expected);
    });

    it('a near-miss corpus stays clean — the patterns are not over-broad', () => {
        const { status, hits } = scan(corpusOf(nearMiss));
        expect(hits.filter((h) => h.file === 'corpus.md')).toEqual([]);
        expect(status).toBe(0);
    });

    it('the near-miss transform actually changes every slug', () => {
        // Guards the guard: a transform that silently returned its input would
        // make the negative case above assert nothing at all.
        for (const s of cfg.subjects) {
            expect(nearMiss(s.slug)).not.toBe(s.slug);
        }
    });
});

// --- Phase 1.2: the before-reading, executable -------------------------------

describe('comparison-subject registry — the base-ref reading', () => {
    it('reproduces 5 of 10 at the commit this change was measured against', () => {
        const shown = spawnSync(
            'git',
            ['show', `${BASE_REF}:src/scripts/external_sources_denylist.json`],
            big(REPO_ROOT),
        );
        if (shown.status !== 0) {
            // A shallow clone has no such object. Reporting that is honest;
            // asserting a figure nobody could read would not be.
            console.warn(`base ref ${BASE_REF} unavailable in this clone — reading not reproduced`);
            return;
        }
        const base = JSON.parse(shown.stdout as string) as { deny: string[] };
        const caught = cfg.subjects.filter((s) => covering(s.slug, base.deny).length > 0);
        expect(cfg.subjects).toHaveLength(10);
        expect(caught).toHaveLength(5);
        expect(caught.map((s) => s.id)).toEqual(['S1', 'S2', 'S3', 'S4', 'S6']);
    });
});
