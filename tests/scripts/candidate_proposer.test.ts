// Tests for the deterministic proposer — road-to-governed-harness-evolution
// Phase 3 step 3.5.
//
// The verify clause is a single, hard property:
//
//     the same input produces byte-identical candidates across two runs.
//
// It is exercised three ways, because "the same input" has three readings and
// only the strictest one is worth having: the same list twice (§ byte
// identity), the same list PERMUTED (§ order independence — a proposer that
// preserved input order would pass the first and fail the second), and the same
// list through the CLI into two different output directories (§ end to end).
//
// Every guard here is tested in BOTH polarities. The source-scanning guard is
// run against the real module (must be clean) and against a synthetic
// non-deterministic source (must fire) — a scanner never seen red has unknown
// sensitivity, and one that scans nothing exits green.

import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { REPO_ROOT, TSX_BIN } from './_bench_ab.js';
import {
    BAND_POINTER,
    DEFECT_CLASSES,
    HONEST_ENFORCEMENT_BLOCK,
    RECIPES,
    type DefectObservation,
    appendHonestEnforcement,
    appendRoutePointer,
    byteCompare,
    candidateId,
    candidateRecordFilename,
    keepLeadingBand,
    parseObservations,
    proposeCandidates,
    serialiseCandidateRecord,
} from '../../src/scripts/_lib/candidate_proposer.js';
import { CANDIDATE_RECORD_VERSION, parseCandidateRecord } from '../../src/scripts/_lib/candidate_record.js';

const LAB_TS = join(REPO_ROOT, 'src', 'scripts', 'evolution_lab.ts');
const PROPOSER_TS = join(REPO_ROOT, 'src', 'scripts', '_lib', 'candidate_proposer.ts');

const scratch = mkdtempSync(join(tmpdir(), 'ac-proposer-'));
afterAll(() => {
    rmSync(scratch, { recursive: true, force: true });
});

/** A fixed, in-memory tree. No filesystem, so the test's own reads cannot drift. */
const SUBJECTS: Record<string, string> = {
    '.claude/rules/alpha.md': '# Alpha\n\nBand text.\n\n## Body\n\nMore.\n',
    '.claude/rules/beta.md': '# Beta\n\nObligation stated here.\n',
    'AGENTS.md': '# Agents\n\nEnforced by nothing in particular.\n',
    '.augment/rules/gamma.md': '# Gamma\n\nOnly a band, no second heading.\n',
};

function reader(subject: string): string {
    const v = SUBJECTS[subject];
    if (v === undefined) {
        throw new Error(`test reader: no subject ${subject}`);
    }
    return v;
}

const OBSERVATIONS: DefectObservation[] = [
    { defectClass: 'over-broad-activation', subject: '.claude/rules/alpha.md' },
    { defectClass: 'unrouted-obligation', subject: '.claude/rules/beta.md', routeTo: 'skill:beta-carrier' },
    { defectClass: 'unbacked-enforcement-claim', subject: 'AGENTS.md' },
    { defectClass: 'over-broad-activation', subject: '.augment/rules/gamma.md' },
    { defectClass: 'unbacked-enforcement-claim', subject: '.claude/rules/beta.md' },
];

function bytesOf(observations: readonly DefectObservation[]): string {
    return proposeCandidates(observations, reader).map(serialiseCandidateRecord).join('');
}

// --- § byte identity --------------------------------------------------------

describe('deterministic proposer — byte identity', () => {
    it('two runs over the same input produce byte-identical candidates', () => {
        const first = bytesOf(OBSERVATIONS);
        const second = bytesOf(OBSERVATIONS);
        expect(second).toBe(first);
        // Guard against the degenerate pass: identical empty output.
        expect(first.length).toBeGreaterThan(0);
        expect(proposeCandidates(OBSERVATIONS, reader)).toHaveLength(OBSERVATIONS.length);
    });

    it('the output is independent of the input ORDER', () => {
        const forward = bytesOf(OBSERVATIONS);
        const reversed = bytesOf([...OBSERVATIONS].reverse());
        const rotated = bytesOf([...OBSERVATIONS.slice(2), ...OBSERVATIONS.slice(0, 2)]);
        expect(reversed).toBe(forward);
        expect(rotated).toBe(forward);
    });

    it('reads its subjects in a deterministic order, whatever order they arrive in', () => {
        // The output sort alone does NOT cover this: it fixes the order records
        // come back in, not the order subjects are READ in. Read order is
        // observable — a reader that throws makes the first failing subject the
        // one whose message an operator sees — so it has its own guard, and its
        // red was observed by neutralising the input sort independently.
        const record = (into: string[]) => (s2: string): string => {
            into.push(s2);
            return reader(s2);
        };
        const forward: string[] = [];
        proposeCandidates(OBSERVATIONS, record(forward));
        const reversed: string[] = [];
        proposeCandidates([...OBSERVATIONS].reverse(), record(reversed));
        expect(reversed).toEqual(forward);
        // The positive pole: it is the SORTED order, not the caller's.
        expect(forward).not.toEqual(OBSERVATIONS.map((o) => o.subject));
        expect(forward).toEqual([
            '.augment/rules/gamma.md',
            '.claude/rules/alpha.md',
            '.claude/rules/beta.md',
            'AGENTS.md',
            '.claude/rules/beta.md',
        ]);
    });

    it('a candidate id is a content hash, so changed subject bytes change the id', () => {
        const before = proposeCandidates(
            [{ defectClass: 'unbacked-enforcement-claim', subject: 'AGENTS.md' }],
            reader,
        );
        const after = proposeCandidates(
            [{ defectClass: 'unbacked-enforcement-claim', subject: 'AGENTS.md' }],
            () => '# Agents\n\nSomething else entirely.\n',
        );
        expect(before[0]?.id).not.toBe(after[0]?.id);
        // ...and it is stable for unchanged bytes, which is the half that
        // makes `run --refresh` rebuild rather than accumulate.
        expect(
            proposeCandidates([{ defectClass: 'unbacked-enforcement-claim', subject: 'AGENTS.md' }], reader)[0]
                ?.id,
        ).toBe(before[0]?.id);
    });

    it('every emitted record passes the refusing parser and is `proposed`', () => {
        for (const r of proposeCandidates(OBSERVATIONS, reader)) {
            const round = parseCandidateRecord(JSON.parse(serialiseCandidateRecord(r)));
            expect(round).toEqual(r);
            expect(r.lifecycle).toBe('proposed');
            expect(r.version).toBe(CANDIDATE_RECORD_VERSION);
            expect(r.mutations).toHaveLength(1);
        }
    });

    it('ids carry the dimension tag, and every dimension arm is exercised', () => {
        const tags: Record<string, string> = { activation: 'act-', routing: 'rou-', content: 'con-' };
        const records = proposeCandidates(OBSERVATIONS, reader);
        expect(new Set(records.map((r) => r.dimension))).toEqual(
            new Set(['activation', 'routing', 'content']),
        );
        for (const r of records) {
            expect(r.id.startsWith(tags[r.dimension] ?? '?')).toBe(true);
        }
    });
});

// --- § the recipes ----------------------------------------------------------

describe('deterministic proposer — the recipes', () => {
    it('one recipe per mutation dimension, and each is total and idempotent', () => {
        const dims = DEFECT_CLASSES.map((c) => RECIPES[c].dimension);
        expect(new Set(dims).size).toBe(3);
        const inputs = ['', '\n', '# H\n', '## Only a section\n', ...Object.values(SUBJECTS)];
        for (const cls of DEFECT_CLASSES) {
            const { rewrite } = RECIPES[cls];
            for (const body of inputs) {
                const once = rewrite(body, 'skill:target');
                expect(typeof once).toBe('string');
                expect(rewrite(once, 'skill:target')).toBe(once);
            }
        }
    });

    it('keepLeadingBand drops everything from the first `## ` heading', () => {
        const out = keepLeadingBand('# T\n\nband\n\n## Section\n\ndropped\n');
        expect(out).toContain('band');
        expect(out).not.toContain('dropped');
        expect(out).toContain(BAND_POINTER);
    });

    it('appendRoutePointer names the target it was GIVEN, never one it guessed', () => {
        const out = appendRoutePointer('# T\n', 'skill:explicit-target');
        expect(out).toContain('skill:explicit-target');
        expect(appendRoutePointer('# other-name\n', 'skill:x')).not.toContain('other-name`');
    });

    it('appendHonestEnforcement adds the block exactly once', () => {
        const once = appendHonestEnforcement('# T\n');
        expect(once).toContain(HONEST_ENFORCEMENT_BLOCK);
        expect(appendHonestEnforcement(once)).toBe(once);
    });
});

// --- § the refusals (negative polarity) -------------------------------------

describe('deterministic proposer — refusals', () => {
    const bad: Array<[string, unknown, RegExp]> = [
        ['a non-array input', { defectClass: 'over-broad-activation' }, /must be a JSON array/],
        ['a non-object member', ['nope'], /must be a JSON object/],
        [
            'a class with no fixed recipe',
            [{ defectClass: 'vibes', subject: 'AGENTS.md' }],
            /must be one of over-broad-activation/,
        ],
        [
            'a subject outside the candidate surface',
            [{ defectClass: 'over-broad-activation', subject: 'src/scripts/run.ts' }],
            /outside the candidate surface/,
        ],
        [
            'a traversal subject with an owned head',
            [{ defectClass: 'over-broad-activation', subject: '.claude/../src/x.md' }],
            /outside the candidate surface/,
        ],
        [
            'a routing observation with no routeTo',
            [{ defectClass: 'unrouted-obligation', subject: 'AGENTS.md' }],
            /'routeTo' must be a non-empty string/,
        ],
        [
            'a routeTo on a recipe that never reads it',
            [{ defectClass: 'over-broad-activation', subject: 'AGENTS.md', routeTo: 'skill:x' }],
            /only the routing recipe reads/,
        ],
        [
            'a duplicate (class, subject) pair',
            [
                { defectClass: 'over-broad-activation', subject: 'AGENTS.md' },
                { defectClass: 'over-broad-activation', subject: 'AGENTS.md' },
            ],
            /duplicate observation/,
        ],
    ];

    for (const [label, input, pattern] of bad) {
        it(`refuses ${label}`, () => {
            expect(() => parseObservations(input)).toThrow(pattern);
        });
    }

    it('accepts the well-formed list the refusals are contrasted against', () => {
        // The positive pole: without this, every refusal above could be firing
        // for a reason unrelated to the field it names.
        const ok = parseObservations([
            { defectClass: 'over-broad-activation', subject: 'AGENTS.md' },
            { defectClass: 'unrouted-obligation', subject: '.claude/rules/beta.md', routeTo: 'skill:x' },
        ]);
        expect(ok).toHaveLength(2);
        expect(ok[1]?.routeTo).toBe('skill:x');
    });
});

// --- § the non-determinism scanner, both polarities -------------------------

/**
 * Constructs whose presence would make the proposer's output depend on
 * something other than its input. Exported shape kept local to the test on
 * purpose: this is a governance guard over ONE file, not a general lint.
 */
export function stripBlockComments(source: string): string {
    // A prose MENTION of `localeCompare` is not a use of it, and the module
    // deliberately explains why it avoids these constructs. Scanning the raw
    // bytes would make the file's own honesty the thing that fails the guard.
    return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

export function findNonDeterminism(source: string): string[] {
    const body = stripBlockComments(source);
    const banned: Array<[string, RegExp]> = [
        ['Date.now', /\bDate\.now\b/],
        ['new Date', /\bnew\s+Date\b/],
        ['Math.random', /\bMath\.random\b/],
        ['localeCompare', /\blocaleCompare\b/],
        ['process.hrtime', /\bprocess\.hrtime\b/],
        ['randomUUID', /\brandomUUID\b/],
        ['readdir', /\breaddir(Sync)?\b/],
    ];
    return banned.filter(([, re]) => re.test(body)).map(([name]) => name);
}

describe('the proposer carries no non-deterministic construct', () => {
    it('fires on a synthetic non-deterministic source (negative polarity)', () => {
        expect(findNonDeterminism('const id = Date.now() + Math.random();')).toEqual([
            'Date.now',
            'Math.random',
        ]);
        expect(findNonDeterminism('names.sort((a,b) => a.localeCompare(b))')).toEqual(['localeCompare']);
        expect(findNonDeterminism('readdirSync(dir)')).toEqual(['readdir']);
    });

    it('is silent on a clean source (positive polarity)', () => {
        expect(findNonDeterminism('const x = 1; list.sort(byteCompare);')).toEqual([]);
    });

    it('the real proposer module is clean', () => {
        const source = readFileSync(PROPOSER_TS, 'utf-8');
        // The comment stripper must not be the reason it passes: the raw file
        // DOES mention `localeCompare` in prose, so a scanner that silently
        // stripped everything would look identical to one that works.
        expect(source).toContain('localeCompare');
        expect(stripBlockComments(source)).not.toContain('localeCompare');
        expect(stripBlockComments(source).length).toBeGreaterThan(2000);
        expect(findNonDeterminism(source)).toEqual([]);
    });

    it('byteCompare is a total order that does not consult a locale', () => {
        expect(byteCompare('A', 'a')).toBe(-1);
        expect(byteCompare('a', 'A')).toBe(1);
        expect(byteCompare('a', 'a')).toBe(0);
        // The case a locale collator gets "right" and a byte order does not.
        // Pinned so a future switch to localeCompare fails loudly here.
        expect(['b', 'A'].sort(byteCompare)).toEqual(['A', 'b']);
    });
});

// --- § end to end through the CLI -------------------------------------------

describe('propose through the CLI is byte-identical across runs', () => {
    function observationsFile(): string {
        // Subjects that really exist in this repo — the CLI reads the tree.
        const body = [
            { defectClass: 'over-broad-activation', subject: 'AGENTS.md' },
            { defectClass: 'unbacked-enforcement-claim', subject: 'CLAUDE.md' },
        ];
        const p = join(scratch, 'observations.json');
        writeFileSync(p, `${JSON.stringify(body, null, 2)}\n`, 'utf-8');
        return p;
    }

    function propose(outDir: string): { status: number | null; stdout: string; stderr: string } {
        const res = spawnSync(
            TSX_BIN,
            [LAB_TS, 'propose', '--observations', observationsFile(), '--out', outDir],
            { cwd: REPO_ROOT, encoding: 'utf8', timeout: 120_000 },
        );
        return { status: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
    }

    function snapshot(dir: string): Record<string, string> {
        const out: Record<string, string> = {};
        for (const name of readdirSync(dir).sort(byteCompare)) {
            out[name] = readFileSync(join(dir, name), 'utf-8');
        }
        return out;
    }

    it('two CLI runs into two directories produce identical filenames and bytes', () => {
        const a = mkdtempSync(join(scratch, 'run-a-'));
        const b = mkdtempSync(join(scratch, 'run-b-'));
        const ra = propose(a);
        const rb = propose(b);
        expect(ra.status, ra.stderr).toBe(0);
        expect(rb.status, rb.stderr).toBe(0);
        const sa = snapshot(a);
        const sb = snapshot(b);
        expect(Object.keys(sa)).toHaveLength(2);
        expect(sb).toEqual(sa);
    });

    it('re-proposing into the SAME directory is a no-op, not a rewrite', () => {
        const dir = mkdtempSync(join(scratch, 'run-same-'));
        expect(propose(dir).status).toBe(0);
        const before = snapshot(dir);
        const second = propose(dir);
        expect(second.status).toBe(0);
        expect(second.stdout).toContain('already identical');
        expect(snapshot(dir)).toEqual(before);
    });

    it('refuses an observations file the schema rejects (negative polarity)', () => {
        const p = join(scratch, 'bad-observations.json');
        writeFileSync(p, `${JSON.stringify([{ defectClass: 'vibes', subject: 'AGENTS.md' }], null, 2)}\n`);
        const res = spawnSync(TSX_BIN, [LAB_TS, 'propose', '--observations', p, '--out', scratch], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            timeout: 120_000,
        });
        expect(res.status).toBe(1);
        expect(res.stderr).toContain('rejected');
    });

    it('the filename is the id, and the id is reproducible from its inputs', () => {
        const records = proposeCandidates(
            [{ defectClass: 'over-broad-activation', subject: 'AGENTS.md' }],
            reader,
        );
        const only = records[0];
        if (only === undefined) {
            throw new Error('the proposer emitted nothing for one observation');
        }
        expect(candidateRecordFilename(only)).toBe(`${only.id}.json`);
        expect(candidateId('over-broad-activation', 'AGENTS.md', only.mutations)).toBe(only.id);
    });
});
