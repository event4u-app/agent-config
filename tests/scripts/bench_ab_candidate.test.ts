// Tests for the `candidate` variant — road-to-governed-harness-evolution
// Phase 3 step 3.1.
//
// The roadmap's verify clause has two conjuncts and both are exercised here:
//   1. five candidates materialised and destroyed with no diff in the original
//      tree;
//   2. sabotaging a path ownership makes `bench_ab_integrity` exit non-zero.
//
// Conjunct 2 is tested in BOTH polarities and in that order — the same clones
// pass, are sabotaged, go red, are un-sabotaged, and pass again. A guard whose
// red was never observed has unknown sensitivity; a red that survives removing
// the sabotage was caused by the setup, not the sabotage.
//
// Every block removes the clones dir afterwards (gitignored → zero git drift).

import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
    CLONES,
    FIXTURE,
    REPO_ROOT,
    TSX_BIN,
    acquireClonesLock,
    hashTree,
    releaseClonesLock,
    removeClones,
    runScript,
} from './_bench_ab.js';
import {
    CANDIDATE_PREFIX,
    CANDIDATE_RECORD_FILE,
    apply_candidate_mutations,
} from '../../src/scripts/bench_ab_clone.js';
import {
    CANDIDATE_RECORD_VERSION,
    MUTATION_DIMENSIONS,
    PathOwnershipError,
} from '../../src/scripts/_lib/candidate_record.js';

const CLONE_TS = join(REPO_ROOT, 'src', 'scripts', 'bench_ab_clone.ts');
const INTEGRITY_TS = join(REPO_ROOT, 'src', 'scripts', 'bench_ab_integrity.ts');
const HAVE_FIXTURE = existsSync(FIXTURE);

/** The four paths a candidate may write — the "original tree" this must not touch. */
const SURFACE_PATHS = ['.claude', '.augment', 'AGENTS.md', 'CLAUDE.md'];

/** One scratch dir for the whole FILE — both describe blocks write records. */
const scratch = mkdtempSync(join(tmpdir(), 'ac-cand-'));

function recordFile(
    id: string,
    over: Record<string, unknown> = {},
): string {
    const body = {
        kind: 'candidate',
        version: CANDIDATE_RECORD_VERSION,
        id,
        dimension: MUTATION_DIMENSIONS[(id.length + id.charCodeAt(id.length - 1)) % 3],
        lifecycle: 'proposed',
        mutations: [{ path: `.claude/rules/${id}.md`, content: `# candidate ${id}\n` }],
        ...over,
    };
    const p = join(scratch, `${id}.json`);
    writeFileSync(p, `${JSON.stringify(body, null, 2)}\n`, 'utf-8');
    return p;
}

/** Porcelain status of the four candidate-owned paths in the REAL repo. */
function surfaceGitStatus(): string {
    const res = spawnSync('git', ['status', '--porcelain', '--', ...SURFACE_PATHS], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
    });
    return res.stdout ?? '';
}

/** Byte-level snapshot of whichever surface paths actually exist in the repo. */
function surfaceSnapshot(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const rel of SURFACE_PATHS) {
        const full = join(REPO_ROOT, rel);
        if (!existsSync(full)) {
            out[rel] = '<absent>';
            continue;
        }
        try {
            Object.assign(
                out,
                Object.fromEntries(
                    Object.entries(hashTree(full)).map(([k, v]) => [`${rel}/${k}`, v]),
                ),
            );
        } catch {
            // A regular file, not a directory.
            out[rel] = readFileSync(full, 'utf-8');
        }
    }
    return out;
}

describe.skipIf(!HAVE_FIXTURE)('bench_ab_clone — candidate variant (3.1)', () => {
    beforeAll(() => acquireClonesLock());
    afterAll(() => releaseClonesLock());
    beforeEach(() => removeClones());
    afterEach(() => removeClones());

    it('--help names the candidate variant and the record flag', () => {
        const r = runScript(TSX_BIN, CLONE_TS, ['--help']);
        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toContain('candidate');
        expect(r.stdout).toContain('--candidate-record');
    });

    it('VERIFY 1 — five candidates materialise and are destroyed with no diff in the original tree', () => {
        const beforeStatus = surfaceGitStatus();
        const beforeSnapshot = surfaceSnapshot();

        const ids = ['alpha', 'bravo', 'charlie', 'delta', 'echo'];
        const args: string[] = ['--variant', 'candidate'];
        for (const id of ids) {
            args.push('--candidate-record', recordFile(id));
        }
        const built = runScript(TSX_BIN, CLONE_TS, args);
        expect(built.status, built.stderr).toBe(0);

        for (const id of ids) {
            const root = join(CLONES, `${CANDIDATE_PREFIX}${id}`);
            expect(existsSync(root), `candidate ${id} clone missing`).toBe(true);
            // The mutation landed, inside the surface.
            expect(readFileSync(join(root, '.claude', 'rules', `${id}.md`), 'utf-8')).toBe(
                `# candidate ${id}\n`,
            );
            // The record travelled with the clone, and carries its lifecycle
            // rather than leaving the reader to infer one from existence.
            const rec = JSON.parse(readFileSync(join(root, CANDIDATE_RECORD_FILE), 'utf-8')) as Record<
                string,
                unknown
            >;
            expect(rec['id']).toBe(id);
            expect(rec['lifecycle']).toBe('proposed');
            expect(rec['kind']).toBe('candidate');
            // The manifest records the candidate variant and the layered surface.
            const man = JSON.parse(
                readFileSync(join(root, '.bench-ab-manifest.json'), 'utf-8'),
            ) as Record<string, unknown>;
            expect(man['variant']).toBe('candidate');
            expect(man['with_surfaces']).toEqual(SURFACE_PATHS);
        }
        expect(built.stdout.match(/built candidate /g)).toHaveLength(5);

        // Destroy.
        removeClones();
        for (const id of ids) {
            expect(existsSync(join(CLONES, `${CANDIDATE_PREFIX}${id}`))).toBe(false);
        }

        // No diff in the original tree.
        expect(surfaceGitStatus()).toBe(beforeStatus);
        expect(surfaceSnapshot()).toEqual(beforeSnapshot);
    });

    it('re-running without --refresh is idempotent; --refresh rebuilds', () => {
        const f = recordFile('idem');
        const first = runScript(TSX_BIN, CLONE_TS, ['--variant', 'candidate', '--candidate-record', f]);
        expect(first.status, first.stderr).toBe(0);
        expect(first.stdout).toContain('built candidate idem clone');

        const again = runScript(TSX_BIN, CLONE_TS, ['--variant', 'candidate', '--candidate-record', f]);
        expect(again.status, again.stderr).toBe(0);
        expect(again.stdout).toContain('already present');

        const refreshed = runScript(TSX_BIN, CLONE_TS, [
            '--variant',
            'candidate',
            '--refresh',
            '--candidate-record',
            f,
        ]);
        expect(refreshed.status, refreshed.stderr).toBe(0);
        expect(refreshed.stdout).toContain('built candidate idem clone');
    });

    it('NEGATIVE: --variant candidate with no record is a usage error (exit 2)', () => {
        const r = runScript(TSX_BIN, CLONE_TS, ['--variant', 'candidate']);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain('requires at least one --candidate-record');
    });

    it('NEGATIVE: --candidate-record without --variant candidate is a usage error (exit 2)', () => {
        const r = runScript(TSX_BIN, CLONE_TS, [
            '--variant',
            'with',
            '--candidate-record',
            recordFile('stray'),
        ]);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain('requires --variant candidate');
    });

    it('NEGATIVE: duplicate candidate ids are refused (ids name clone directories)', () => {
        const f = recordFile('dup');
        const r = runScript(TSX_BIN, CLONE_TS, [
            '--variant',
            'candidate',
            '--candidate-record',
            f,
            '--candidate-record',
            f,
        ]);
        expect(r.status).toBe(1);
        expect(r.stderr).toContain('given twice');
    });

    it('NEGATIVE: a schema-violating record is refused BEFORE any clone is written', () => {
        // One case per Phase 3 invariant, each asserting the clone directory is
        // absent afterwards — validating after materialisation would leave a
        // clone on disk that no schema admits.
        const cases: [string, Record<string, unknown>][] = [
            // 3.2 — two primary dimensions.
            ['twodim', { dimension: undefined, dimensions: ['routing', 'content'] }],
            // 3.3 — a fourth dimension.
            ['fourth', { dimension: 'verification' }],
            // 3.4 — no lifecycle state.
            ['nostate', { lifecycle: undefined }],
            // Path ownership — a mutation outside the surface.
            ['escape', { mutations: [{ path: 'src/parser.ts', content: 'x' }] }],
        ];
        for (const [id, over] of cases) {
            const body: Record<string, unknown> = {
                kind: 'candidate',
                version: CANDIDATE_RECORD_VERSION,
                id,
                dimension: 'routing',
                lifecycle: 'proposed',
                mutations: [],
                ...over,
            };
            for (const [k, v] of Object.entries(over)) {
                if (v === undefined) delete body[k];
            }
            const p = join(scratch, `bad-${id}.json`);
            writeFileSync(p, `${JSON.stringify(body, null, 2)}\n`, 'utf-8');
            const r = runScript(TSX_BIN, CLONE_TS, ['--variant', 'candidate', '--candidate-record', p]);
            expect(r.status, `case ${id} should have been refused`).toBe(1);
            expect(r.stderr).toContain('rejected');
            expect(existsSync(join(CLONES, `${CANDIDATE_PREFIX}${id}`)), `case ${id} wrote a clone`).toBe(
                false,
            );
        }
    });

    it('the three pre-existing variants are unchanged', () => {
        const r = runScript(TSX_BIN, CLONE_TS, ['--variant', 'both']);
        expect(r.status, r.stderr).toBe(0);
        const withMan = JSON.parse(
            readFileSync(join(CLONES, 'with', '.bench-ab-manifest.json'), 'utf-8'),
        ) as Record<string, unknown>;
        const withoutMan = JSON.parse(
            readFileSync(join(CLONES, 'without', '.bench-ab-manifest.json'), 'utf-8'),
        ) as Record<string, unknown>;
        expect(withMan['variant']).toBe('with');
        expect(withMan['with_surfaces']).toEqual(SURFACE_PATHS);
        expect(withoutMan['with_surfaces']).toEqual([]);
        // No candidate artefacts leak into a non-candidate clone.
        expect(existsSync(join(CLONES, 'with', CANDIDATE_RECORD_FILE))).toBe(false);
    });
});

describe('apply_candidate_mutations — the resolved-path escape', () => {
    // The branch the DECLARED-path check cannot reach: a relative path whose
    // every segment is owned, but whose parent directory is a symlink out of
    // the clone. `.claude/` arrives in a clone by copy, and a copy that ever
    // preserved a symlink would produce exactly this shape.
    it('NEGATIVE: a mutation resolving outside the clone is refused', () => {
        const box = mkdtempSync(join(tmpdir(), 'ac-esc-'));
        try {
            const clone = join(box, 'clone');
            const outside = join(box, 'outside');
            mkdirSync(clone, { recursive: true });
            mkdirSync(outside, { recursive: true });
            symlinkSync(outside, join(clone, '.claude'), 'dir');
            expect(() =>
                apply_candidate_mutations(
                    {
                        kind: 'candidate',
                        version: CANDIDATE_RECORD_VERSION,
                        id: 'escapee',
                        dimension: 'routing',
                        lifecycle: 'proposed',
                        mutations: [{ path: '.claude/pwned.md', content: 'x' }],
                    },
                    clone,
                ),
            ).toThrow(PathOwnershipError);
            // And nothing was written outside.
            expect(existsSync(join(outside, 'pwned.md'))).toBe(false);
        } finally {
            rmSync(box, { recursive: true, force: true });
        }
    });

    it('POSITIVE: the same mutation into a real directory is written', () => {
        // Proves the refusal above came from the symlink, not from the path.
        const box = mkdtempSync(join(tmpdir(), 'ac-esc-'));
        try {
            const clone = join(box, 'clone');
            mkdirSync(join(clone, '.claude'), { recursive: true });
            apply_candidate_mutations(
                {
                    kind: 'candidate',
                    version: CANDIDATE_RECORD_VERSION,
                    id: 'honest',
                    dimension: 'routing',
                    lifecycle: 'proposed',
                    mutations: [{ path: '.claude/ok.md', content: 'x' }],
                },
                clone,
            );
            expect(readFileSync(join(clone, '.claude', 'ok.md'), 'utf-8')).toBe('x');
        } finally {
            rmSync(box, { recursive: true, force: true });
        }
    });
});

describe.skipIf(!HAVE_FIXTURE)('bench_ab_integrity — candidate clones (3.1)', () => {
    beforeAll(() => acquireClonesLock());
    afterAll(() => {
        releaseClonesLock();
        rmSync(scratch, { recursive: true, force: true });
    });
    beforeEach(() => removeClones());
    afterEach(() => removeClones());

    /** Build `with`, `without` and the five candidates. */
    function buildAll(ids: readonly string[]): void {
        const base = runScript(TSX_BIN, CLONE_TS, ['--variant', 'both']);
        expect(base.status, base.stderr).toBe(0);
        if (ids.length === 0) {
            return;
        }
        const args: string[] = ['--variant', 'candidate'];
        for (const id of ids) {
            args.push('--candidate-record', recordFile(id));
        }
        const cand = runScript(TSX_BIN, CLONE_TS, args);
        expect(cand.status, cand.stderr).toBe(0);
    }

    it('VERIFY 2 — sabotage polarity: clean passes, sabotage reds, un-sabotage passes again', () => {
        const ids = ['alpha', 'bravo', 'charlie', 'delta', 'echo'];
        buildAll(ids);

        // (a) POSITIVE — five clean candidates alongside with/without: exit 0.
        const clean = runScript(TSX_BIN, INTEGRITY_TS, ['--verbose']);
        expect(clean.status, clean.stderr).toBe(0);
        expect(clean.stdout).toContain('clones differ only at the allowed surface');
        // Proof the candidates were actually enumerated rather than skipped —
        // a check that scanned nothing would also exit 0 here.
        for (const id of ids) {
            expect(clean.stdout).toContain(`${CANDIDATE_PREFIX}${id}=`);
        }

        // (b) NEGATIVE — sabotage the path ownership of ONE candidate: a file
        //     written outside the candidate surface.
        // The fixture itself owns `src/`, so the sabotage is ONE new file
        // inside it — and the un-sabotage below removes exactly that file.
        // Removing the directory would delete fixture files and manufacture a
        // second, different failure, which is how a polarity test convinces
        // itself the guard is sensitive to something it never tested.
        const victim = join(CLONES, `${CANDIDATE_PREFIX}charlie`);
        const sabotage = join(victim, 'src', 'smuggled.ts');
        mkdirSync(join(victim, 'src'), { recursive: true });
        writeFileSync(sabotage, 'export const owned = false;\n', 'utf-8');

        const red = runScript(TSX_BIN, INTEGRITY_TS, []);
        expect(red.status, 'a candidate outside its surface must NOT exit 0').toBe(1);
        expect(red.stderr).toContain('INTEGRITY FAILURE');
        expect(red.stderr).toContain(`candidate '${CANDIDATE_PREFIX}charlie' escaped the candidate surface`);
        expect(red.stderr).toContain('src/smuggled.ts');
        // And it names only the guilty candidate.
        expect(red.stderr).not.toContain(`${CANDIDATE_PREFIX}alpha' escaped`);

        // (c) POSITIVE again — remove exactly the sabotage; green returns.
        //     Without this the red above could have come from the setup.
        rmSync(sabotage, { force: true });
        const green = runScript(TSX_BIN, INTEGRITY_TS, []);
        expect(green.status, green.stderr).toBe(0);
    });

    it('NEGATIVE: a candidate that byte-diverges a task-target file is caught', () => {
        // The other half of path ownership: not a NEW file outside the surface,
        // but an EDIT to a fixture file the baseline also carries. A check that
        // only compared file sets would miss this.
        buildAll(['alpha']);
        const victim = join(CLONES, `${CANDIDATE_PREFIX}alpha`);
        const baselineFiles = Object.keys(hashTree(join(CLONES, 'without'))).filter(
            (rel) => !rel.startsWith('.'),
        );
        expect(baselineFiles.length, 'fixture must carry at least one task-target file').toBeGreaterThan(0);
        const target = join(victim, baselineFiles[0] as string);
        writeFileSync(target, `${readFileSync(target, 'utf-8')}\n// tampered\n`, 'utf-8');

        const red = runScript(TSX_BIN, INTEGRITY_TS, []);
        expect(red.status).toBe(1);
        expect(red.stderr).toContain(`candidate '${CANDIDATE_PREFIX}alpha' escaped the candidate surface`);
        expect(red.stderr).toContain(baselineFiles[0] as string);
    });

    it('NEGATIVE: a candidate is compared against `without`, not against `with`', () => {
        // Discovery is by directory prefix, so a candidate clone nobody told
        // the checker about is still enumerated. This one is created by hand,
        // never via the clone verb.
        buildAll([]);
        const rogue = join(CLONES, `${CANDIDATE_PREFIX}rogue`);
        mkdirSync(join(rogue, 'nowhere'), { recursive: true });
        writeFileSync(join(rogue, 'nowhere', 'x.ts'), 'x\n', 'utf-8');

        const red = runScript(TSX_BIN, INTEGRITY_TS, []);
        expect(red.status).toBe(1);
        expect(red.stderr).toContain(`candidate '${CANDIDATE_PREFIX}rogue' escaped`);
    });

    it('POSITIVE: with no candidates present the pre-existing output is unchanged', () => {
        buildAll([]);
        const r = runScript(TSX_BIN, INTEGRITY_TS, ['--verbose']);
        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toMatch(/with=\d+ files, without=\d+ files, shared=\d+/);
        expect(r.stdout).toContain('clones differ only at the allowed surface');
        expect(r.stdout).not.toContain(CANDIDATE_PREFIX);
    });
});
