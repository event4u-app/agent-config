// Tests for src/scripts/check_completion_review.ts — the deterministic Gate-R2
// validator (docs/contracts/plan-review-gates.md §2 + §6).
//
// Every scenario builds a throwaway `git init` repo under mkdtemp — no real
// repo file is ever touched. The gate is driven in-process via runInProc
// (`main` takes --repo / --artifact-dir, so no cwd change is needed) with
// `--format json` so each fixture can assert on its specific violation kind.
//
// Committed-artifact fixtures follow the real §2.5 workflow AND commit the
// finalized artifact — which is the point of the review-SCOPE binding: the
// scope excludes `agents/evidence/reviews`, so committing the findings file
// (which §2.5 requires and CI can only see committed) cannot invalidate the
// review it records. A head-sha binding made that unsatisfiable; there is no
// "working-tree update on top" escape here.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { runInProc } from '../_lib/run_in_process.js';
import {
    GIT_MAX_BUFFER,
    artifactRelevance,
    completionReviewDisabled,
    extractFixRef,
    isCodePath,
    isOwnArtifactSlug,
    main,
    parseArtifact,
    parseHonestNull,
    parseMarkerLine,
    parseSkipDeclaration,
    scanFences,
    validateFindingRows,
    type Violation,
} from '../../src/scripts/check_completion_review.js';
import { computeReviewScope, deriveManifest } from '../../src/scripts/dispatch_r2_reviewer.js';

const ART = 'agents/evidence/reviews/feat.findings.md';

function hasGit(): boolean {
    return spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;
}

function git(cwd: string, ...args: string[]): string {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
    if (r.status !== 0) {
        throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
    }
    return r.stdout;
}

function write(dir: string, rel: string, body: string): void {
    const fp = path.join(dir, rel);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, body, 'utf-8');
}

function commitAll(dir: string, msg: string): string {
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', msg);
    return headSha(dir);
}

function headSha(dir: string): string {
    return git(dir, 'rev-parse', 'HEAD').trim();
}

/** The review-scope hash the gate will derive — computed via the shared helper. */
function scopeHash(dir: string, base = 'main'): string {
    return computeReviewScope((a) => git(dir, ...a), base).hash;
}

const tmpDirs: string[] = [];
afterEach(() => {
    for (const d of tmpDirs.splice(0)) {
        fs.rmSync(d, { recursive: true, force: true });
    }
});

/** Throwaway repo: one base commit on `main`, then checked out to `feat`. */
function makeRepo(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccr-'));
    tmpDirs.push(dir);
    git(dir, 'init', '-q', '-b', 'main');
    git(dir, 'config', 'user.email', 'gate@test.local');
    git(dir, 'config', 'user.name', 'gate');
    git(dir, 'config', 'commit.gpgsign', 'false');
    write(dir, 'README.md', '# base\n');
    commitAll(dir, 'base');
    git(dir, 'checkout', '-qb', 'feat');
    return dir;
}

/**
 * The ADR-051 failure shape: the reviews root IS tracked in the base ref, but
 * a later rename left the gate pointing at a path that no longer resolves.
 */
function movedRootRepo(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccr-moved-'));
    tmpDirs.push(dir);
    git(dir, 'init', '-q', '-b', 'main');
    git(dir, 'config', 'user.email', 'gate@test.local');
    git(dir, 'config', 'user.name', 'gate');
    git(dir, 'config', 'commit.gpgsign', 'false');
    write(dir, 'README.md', '# base\n');
    write(dir, ART, 'placeholder\n');
    commitAll(dir, 'base with a tracked reviews root');
    git(dir, 'checkout', '-qb', 'feat');
    git(dir, 'mv', 'agents/evidence/reviews', 'agents/evidence/renamed-reviews');
    write(dir, 'src/feature.ts', 'export const y = 2;\n');
    commitAll(dir, 'rename the reviews root and change code');
    return dir;
}

const SCOPE_A = 'a'.repeat(64);

const marker = (scope: string, headish = '0'.repeat(40)): string =>
    `<!-- completion-review: v1 | reviewed: 2026-08-04 | scope: ${scope} | diff: ${headish} | reviewer: fresh-subagent-r2 -->`;

/** A §5 manifest bound to `scope` — required on every review-bearing artifact. */
const manifestFor = (scope: string): string =>
    deriveManifest({
        diffSha: '0'.repeat(40),
        scopeHash: scope,
        roadmap: 'none',
        roadmapHash: 'none',
        acHash: 'none',
        dispatched: '2026-08-04T09:30:00Z',
    });

const TABLE_HEAD = [
    '| # | Severity | File:Line | Finding | Status | Reason/Ref |',
    '|---|----------|-----------|---------|--------|------------|',
];

function findingsArtifact(scope: string, rows: readonly string[]): string {
    return ['# Findings: feat', marker(scope), '', manifestFor(scope), '', ...TABLE_HEAD, ...rows, ''].join('\n');
}

function honestNullArtifact(scope: string): string {
    return [
        '# Findings: feat',
        marker(scope),
        '',
        manifestFor(scope),
        '',
        `**Honest-null:** 0 findings, scope ${scope}, reviewed 2026-08-04`,
        '',
    ].join('\n');
}

const skipLine = (reason: string, scope: string): string =>
    `**Skipped:** no code surface for this completion — ${reason}, scope ${scope}, declared 2026-08-04\n`;

interface GateResult {
    status: number;
    stdout: string;
    stderr: string;
    violations: Violation[];
    kinds: string[];
}

function runGate(dir: string, extra: string[] = []): GateResult {
    const res = runInProc(main, ['--repo', dir, '--base', 'main', '--format', 'json', ...extra]);
    let violations: Violation[] = [];
    const nl = res.stdout.indexOf('\n');
    const rest = nl >= 0 ? res.stdout.slice(nl + 1).trim() : '';
    if (rest.startsWith('[')) {
        violations = JSON.parse(rest) as Violation[];
    }
    return { status: res.status, stdout: res.stdout, stderr: res.stderr, violations, kinds: violations.map((v) => v.kind) };
}

// ---------------------------------------------------------------------------
// Pass fixtures
// ---------------------------------------------------------------------------

describe.runIf(hasGit())('check_completion_review — pass states', () => {
    it('passes with the finalized artifact COMMITTED (the head-sha binding could not)', () => {
        const dir = makeRepo();
        // §2.5 order: artifact committed FIRST, fix commit after.
        write(dir, ART, findingsArtifact(SCOPE_A, ['| 1 | high | src/fix.ts:1 | bug | open | |']));
        commitAll(dir, 'add findings artifact');
        write(dir, 'src/fix.ts', 'export const x = 1;\n');
        const fixSha = commitAll(dir, 'fix the bug');
        // Finalize AND COMMIT: HEAD now moves past every sha the reviewer could
        // have recorded, and the gate must still pass.
        const scope = scopeHash(dir);
        write(
            dir,
            ART,
            findingsArtifact(scope, [
                `| 1 | high | src/fix.ts:1 | bug | fixed | ${fixSha} |`,
                '| 2 | medium | src/fix.ts:2 | risky pattern | accepted-risk | perf acceptable, accepted by maintainer |',
                '| 3 | low | src/fix.ts:3 | nit | deferred | roadmap: agents/roadmaps/followup.md |',
            ]),
        );
        const finalSha = commitAll(dir, 'finalize findings artifact');
        expect(finalSha).not.toBe(fixSha);

        const res = runGate(dir);
        expect(res.stderr).toBe('');
        expect(res.violations).toEqual([]);
        expect(res.status).toBe(0);
        expect(res.stdout).toMatch(/^scanned: 2\n/);
    });

    it('scope survives a further commit that only touches the reviews directory', () => {
        const dir = makeRepo();
        write(dir, 'src/fix.ts', 'export const x = 1;\n');
        commitAll(dir, 'feature');
        const scope = scopeHash(dir);
        write(dir, ART, honestNullArtifact(scope));
        commitAll(dir, 'add review');
        // A second edit to the artifact (e.g. a typo fix) must not re-open the gate.
        write(dir, ART, honestNullArtifact(scope) + '\n<!-- touched -->\n');
        commitAll(dir, 'touch review');
        expect(scopeHash(dir)).toBe(scope);
        const res = runGate(dir);
        expect(res.violations).toEqual([]);
        expect(res.status).toBe(0);
    });

    it('passes on a merge-commit checkout (the pull_request CI shape)', () => {
        const dir = makeRepo();
        write(dir, 'src/fix.ts', 'export const x = 1;\n');
        commitAll(dir, 'feature');
        const scope = scopeHash(dir);
        write(dir, ART, honestNullArtifact(scope));
        commitAll(dir, 'add review');
        const featScope = scopeHash(dir);

        // CI checks out a synthetic merge commit, never the branch head.
        git(dir, 'checkout', '-q', 'main');
        git(dir, 'checkout', '-qb', 'ci-merge-feat');
        git(dir, 'merge', '-q', '--no-ff', '-m', 'Merge feat', 'feat');
        expect(headSha(dir)).not.toBe(git(dir, 'rev-parse', 'feat').trim());

        expect(scopeHash(dir)).toBe(featScope);
        const res = runGate(dir);
        expect(res.violations).toEqual([]);
        expect(res.status).toBe(0);
    });

    it('passes on an honest-null artifact for the current scope', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        write(dir, ART, honestNullArtifact(scopeHash(dir)));
        const res = runGate(dir);
        expect(res.violations).toEqual([]);
        expect(res.status).toBe(0);
    });

    it('passes on a valid skip declaration for a docs-only diff', () => {
        const dir = makeRepo();
        write(dir, 'docs/notes.md', '# notes\n');
        commitAll(dir, 'docs only');
        write(dir, ART, skipLine('docs-only change', scopeHash(dir)));
        const res = runGate(dir);
        expect(res.violations).toEqual([]);
        expect(res.status).toBe(0);
    });

    // Finding 11: `markerMalformed` was set by the FIRST non-fenced line merely
    // containing `completion-review:` and never cleared, so a reviewer note
    // quoting the grammar above the header (real artefacts in this repo contain
    // exactly that) produced a spurious `bad-marker`.
    it('prose quoting the marker grammar above the header is not a malformed marker', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        const scope = scopeHash(dir);
        write(
            dir,
            ART,
            [
                '# Findings: feat',
                '',
                'Note: `markerMalformed` fires only when a line containing `completion-review:` fails to parse.',
                '',
                marker(scope),
                '',
                manifestFor(scope),
                '',
                `**Honest-null:** 0 findings, scope ${scope}, reviewed 2026-08-04`,
                '',
            ].join('\n'),
        );
        const res = runGate(dir);
        expect(res.violations).toEqual([]);
        expect(res.status).toBe(0);
    });

    // Non-regression for the round-7 AND round-8 fence fixes, and the reason
    // fenced regions exist at all: a template row inside a properly-closed
    // LABELLED fence (```markdown — the info string is the deliberate "this is an
    // illustration" act round 8 made load-bearing) is not a live finding.
    it('a quoted template row is illustrative via the `example` status, not via its fence', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        const scope = scopeHash(dir);
        write(
            dir,
            ART,
            [
                '# Findings: feat',
                marker(scope),
                '',
                manifestFor(scope),
                '',
                'The §2.2 template, quoted:',
                '',
                '```markdown',
                ...TABLE_HEAD,
                '| 1 | critical | src/x.ts:42 | ... | example | |',
                '```',
                '',
                `**Honest-null:** 0 findings, scope ${scope}, reviewed 2026-08-04`,
                '',
            ].join('\n'),
        );
        const res = runGate(dir);
        expect(res.violations).toEqual([]);
        expect(res.status).toBe(0);
        // The fence still resolves, and the honest-null line inside prose is read
        // — but what makes the quoted row illustrative is its `example` status,
        // not the fence around it. Written with `open` instead, this artefact
        // blocks (see the row-liveness cases below).
        const art = parseArtifact(fs.readFileSync(path.join(dir, ART), 'utf-8'));
        expect(art.strayFenceLines).toEqual([]);
        expect(art.rows).toEqual([]);
    });

    it('passes with a note when there are no reviewable changes vs base', () => {
        const dir = makeRepo(); // feat == main tip, empty scope
        const res = runInProc(main, ['--repo', dir, '--base', 'main']);
        expect(res.status).toBe(0);
        expect(res.stdout).toContain('nothing to review');
    });
});

// ---------------------------------------------------------------------------
// Violation fixtures — each asserts its specific kind
// ---------------------------------------------------------------------------

describe.runIf(hasGit())('check_completion_review — violations', () => {
    it('missing-artifact: code diff with no artifact and no skip', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        const res = runGate(dir);
        expect(res.kinds).toEqual(['missing-artifact']);
        expect(res.status).toBe(1);
    });

    it('stale-review: artifact exists only for an older scope, mismatch reported', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        write(dir, ART, findingsArtifact(SCOPE_A, ['| 1 | low | src/feature.ts:1 | nit | accepted-risk | fine, accepted |']));
        const res = runGate(dir);
        expect(res.kinds).toEqual(['stale-review']);
        expect(res.violations[0]?.detail).toContain(SCOPE_A);
        expect(res.violations[0]?.detail).toContain(scopeHash(dir));
        expect(res.status).toBe(1);
    });

    it('stale-review: a scope-none skip does NOT satisfy a non-empty scope', () => {
        const dir = makeRepo();
        write(dir, 'docs/notes.md', '# notes\n');
        commitAll(dir, 'docs only');
        // The forever-valid leftover: `scope none` used to satisfy every later diff.
        write(dir, ART, skipLine('plan-only session', 'none'));
        const res = runGate(dir);
        expect(res.kinds).toEqual(['stale-review']);
        expect(res.violations[0]?.detail).toContain('none');
        expect(res.status).toBe(1);
    });

    it('missing-manifest: a review-bearing artifact without the §5 manifest blocks', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        const scope = scopeHash(dir);
        write(
            dir,
            ART,
            ['# Findings: feat', marker(scope), '', ...TABLE_HEAD, '| 1 | low | src/feature.ts:1 | nit | accepted-risk | fine |', ''].join('\n'),
        );
        const res = runGate(dir);
        expect(res.kinds).toEqual(['missing-manifest']);
        expect(res.status).toBe(1);
    });

    it('bad-value: a skip line may not hide a findings table (contradictory artifact)', () => {
        const dir = makeRepo();
        write(dir, 'docs/notes.md', '# notes\n');
        commitAll(dir, 'docs only');
        const scope = scopeHash(dir);
        write(
            dir,
            ART,
            findingsArtifact(scope, ['| 1 | high | src/x.ts:1 | bug | open | |']) + skipLine('docs only', scope),
        );
        const res = runGate(dir);
        // The contradiction is reported AND the hidden open row still blocks.
        expect(res.kinds).toContain('bad-value');
        expect(res.kinds).toContain('open-finding');
        expect(res.status).toBe(1);
    });

    it('dead-scan-scope: a MOVED artefact root blocks (exit 1), never warn-and-allow', () => {
        const dir = movedRootRepo();
        const res = runGate(dir);
        expect(res.kinds).toEqual(['dead-scan-scope']);
        expect(res.status).toBe(1);
        expect(res.stdout).toMatch(/^scanned: 0\n/);
        expect(res.violations[0]?.detail).toContain('agents/evidence/reviews');
    });

    it('an absent-but-never-tracked artefact root is NOT a dead scope — it reports missing-artifact', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        const res = runGate(dir, ['--artifact-dir', 'agents/evidence/no-corpus-yet']);
        expect(res.kinds).toEqual(['missing-artifact']);
        expect(res.status).toBe(1);
    });

    it('a foreign malformed artifact does not poison an otherwise clean PR', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        write(dir, ART, honestNullArtifact(scopeHash(dir)));
        // Leftover from an unrelated branch, malformed on purpose.
        write(
            dir,
            'agents/evidence/reviews/legacy-unrelated-work.findings.md',
            ['# Findings: legacy', '<!-- completion-review: v0 | broken -->', '**Honest-null:** nope', ''].join('\n'),
        );
        const res = runGate(dir);
        expect(res.violations).toEqual([]);
        expect(res.status).toBe(0);
    });

    it('open-finding: any open row blocks', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        write(dir, ART, findingsArtifact(scopeHash(dir), ['| 1 | high | src/feature.ts:1 | bug | open | |']));
        const res = runGate(dir);
        expect(res.kinds).toEqual(['open-finding']);
        expect(res.status).toBe(1);
    });

    // Round-3 finding 6: a row missing the trailing (empty) Reason/Ref cell used
    // to be dropped silently. With one well-formed row keeping rows.length > 0
    // the neither-table-nor-honest-null fallback stayed quiet too, so the
    // artifact PASSED while carrying an `open` finding.
    it('malformed-row: a short findings row blocks instead of vanishing', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        write(
            dir,
            ART,
            findingsArtifact(scopeHash(dir), [
                '| 1 | high | src/feature.ts:1 | real bug | accepted-risk | mitigated upstream, accepted |',
                // Trailing empty Reason/Ref cell omitted — 5 cells, status `open`.
                '| 2 | medium | src/feature.ts:2 | silently dropped finding | open |',
            ]),
        );
        const res = runGate(dir);
        expect(res.kinds).toContain('malformed-row');
        expect(res.violations.find((v) => v.kind === 'malformed-row')?.detail).toContain('5 cell(s), expected exactly 6');
        expect(res.status).toBe(1);
    });

    it('malformed-row is reported for the row and the surviving rows still validate', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        write(
            dir,
            ART,
            findingsArtifact(scopeHash(dir), [
                '| 1 | high | src/feature.ts:1 | still open | open | |',
                '| 2 | medium | src/feature.ts:2 | short row | deferred |',
            ]),
        );
        const res = runGate(dir);
        expect(res.kinds.sort()).toEqual(['malformed-row', 'open-finding']);
        expect(res.status).toBe(1);
    });

    // Round-7 finding 1: an ODD number of ```-prefixed lines used to make every
    // LATER line invisible (one `inFence` toggle that never reset), so a trailing
    // `open` row was never parsed — while one earlier terminal row kept
    // rows.length > 0 and the neither-table-nor-honest-null fallback quiet. The
    // artefact PASSED. `markdown-safe-codeblocks` produces exactly that odd
    // count: its outer fence is `~~~`, which the ``` grammar does not match.
    it('unbalanced-fence: an unterminated fence blocks and swallows no later row', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        const scope = scopeHash(dir);
        write(
            dir,
            ART,
            [
                '# Findings: feat',
                marker(scope),
                '',
                manifestFor(scope),
                '',
                ...TABLE_HEAD,
                '| 1 | high | src/feature.ts:1 | real bug | accepted-risk | mitigated upstream, accepted |',
                '',
                'Illustration (outer fence `~~~` per markdown-safe-codeblocks):',
                '',
                '~~~markdown',
                '```', // unpaired inner opener — the ``` count is now odd
                '~~~',
                '',
                '| 2 | medium | src/feature.ts:2 | used to be swallowed | open | |',
                '',
            ].join('\n'),
        );
        const res = runGate(dir);
        expect(res.kinds.sort()).toEqual(['open-finding', 'unbalanced-fence']);
        expect(res.violations.find((v) => v.kind === 'unbalanced-fence')?.detail).toContain('stray ``` fence');
        expect(res.status).toBe(1);
    });

    // Round-8 finding 1 (high), reproduced by a blind reviewer against the shipped
    // parser: POSITIONAL pairing detected parity but never MIS-pairing. Two
    // `~~~`-wrapped illustrations, each holding one unpaired inner ``` — the exact
    // shape `markdown-safe-codeblocks` prescribes and the round-7 fixture uses —
    // paired with EACH OTHER, so every line between them was added to `fenced`,
    // `unterminatedAt` stayed null, and the `open` row between them vanished from
    // `rows` while a later terminal row kept the fallback quiet. The artefact
    // PASSED with an unreviewed `open` finding: the fourth route to one fail-open,
    // hence a class fix (only a LABELLED closed pair may hide anything).
    it('unbalanced-fence: two stray fences cannot pair with each other and swallow a row', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        const scope = scopeHash(dir);
        write(
            dir,
            ART,
            [
                '# Findings: feat',
                marker(scope),
                '',
                manifestFor(scope),
                '',
                ...TABLE_HEAD,
                '| 1 | high | src/feature.ts:1 | real bug | accepted-risk | mitigated upstream, accepted |',
                '',
                '~~~markdown',
                '```', // stray #1
                '~~~',
                '',
                '| 2 | high | src/feature.ts:2 | used to be swallowed by the pair | open | |',
                '',
                '~~~markdown',
                '```', // stray #2 — used to CLOSE stray #1
                '~~~',
                '',
                '| 3 | low | src/feature.ts:3 | keeps rows.length > 0 | accepted-risk | noted |',
                '',
            ].join('\n'),
        );
        const res = runGate(dir);
        expect(res.kinds.sort()).toEqual(['open-finding', 'unbalanced-fence']);
        expect(res.status).toBe(1);
        // The swallowed row is parsed again — the point of the fix.
        const art = parseArtifact(fs.readFileSync(path.join(dir, ART), 'utf-8'));
        expect(art.rows.map((r) => `${String(r.index)}/${r.status}`)).toEqual([
            '1/accepted-risk',
            '2/open',
            '3/accepted-risk',
        ]);
    });

    // Round-8 finding 1, secondary: `unbalancedFenceAt` was a single number, so
    // with three or more strays only the LAST one was ever named — the author
    // fixed it, re-ran, and met the next one.
    it('unbalanced-fence: every stray fence line is named, not only the last', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        const scope = scopeHash(dir);
        write(
            dir,
            ART,
            [
                '# Findings: feat', // 1
                marker(scope), // 2
                '', // 3
                manifestFor(scope), // 4..14 (11 lines)
                '', // 15
                '```', // 16 — stray
                '```', // 17 — stray
                '```', // 18 — stray
                '', // 19
                `**Honest-null:** 0 findings, scope ${scope}, reviewed 2026-08-04`,
                '',
            ].join('\n'),
        );
        const res = runGate(dir);
        expect(res.kinds).toEqual(['unbalanced-fence']);
        const detail = res.violations[0]?.detail ?? '';
        const art = parseArtifact(fs.readFileSync(path.join(dir, ART), 'utf-8'));
        expect(art.strayFenceLines).toHaveLength(3);
        for (const n of art.strayFenceLines) {
            expect(detail).toContain(`line ${String(n)}`);
        }
        expect(res.status).toBe(1);
    });

    // The other half of the discriminator: a BARE pair is no longer a region, so
    // a row between two bare fences is a live finding, not an illustration.
    it('unbalanced-fence: a bare closed pair delimits nothing and hides no row', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        const scope = scopeHash(dir);
        write(
            dir,
            ART,
            [
                '# Findings: feat',
                marker(scope),
                '',
                manifestFor(scope),
                '',
                ...TABLE_HEAD,
                '```',
                '| 1 | high | src/feature.ts:1 | not illustrative — the opener is bare | open | |',
                '```',
                '',
            ].join('\n'),
        );
        const res = runGate(dir);
        expect(res.kinds.sort()).toEqual(['open-finding', 'unbalanced-fence']);
        expect(res.status).toBe(1);
    });

    it('deferred-without-ref: deferred needs a ticket/issue/roadmap ref', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        write(dir, ART, findingsArtifact(scopeHash(dir), ['| 1 | medium | src/feature.ts:1 | gap | deferred | |']));
        const res = runGate(dir);
        expect(res.kinds).toEqual(['deferred-without-ref']);
        expect(res.status).toBe(1);
    });

    it('accepted-risk-without-reason: accepted-risk needs a reason', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        write(dir, ART, findingsArtifact(scopeHash(dir), ['| 1 | low | src/feature.ts:1 | nit | accepted-risk | |']));
        const res = runGate(dir);
        expect(res.kinds).toEqual(['accepted-risk-without-reason']);
        expect(res.status).toBe(1);
    });

    it('severity-order: rows must be sorted critical > high > medium > low', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        write(
            dir,
            ART,
            findingsArtifact(scopeHash(dir), [
                '| 1 | low | src/feature.ts:1 | nit | accepted-risk | fine, accepted |',
                '| 2 | critical | src/feature.ts:2 | injection | accepted-risk | mitigated upstream, accepted |',
            ]),
        );
        const res = runGate(dir);
        expect(res.kinds).toEqual(['severity-order']);
        expect(res.status).toBe(1);
    });

    it('bad-value: unknown severity and unknown status', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        write(dir, ART, findingsArtifact(scopeHash(dir), ['| 1 | gigantic | src/feature.ts:1 | bug | wip | some note |']));
        const res = runGate(dir);
        expect(res.kinds).toEqual(['bad-value', 'bad-value']);
        expect(res.status).toBe(1);
    });

    it('skip-on-code-diff: a skip declaration is rejected when the diff touches code', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        write(dir, ART, skipLine('plan-only session', scopeHash(dir)));
        const res = runGate(dir);
        expect(res.kinds).toEqual(['skip-on-code-diff']);
        expect(res.status).toBe(1);
    });

    it('skip-on-code-diff: fires for a consumer-stack language too (.rb)', () => {
        const dir = makeRepo();
        write(dir, 'app/models/user.rb', "class User\nend\n");
        commitAll(dir, 'ruby model');
        write(dir, ART, skipLine('no code surface, honestly', scopeHash(dir)));
        const res = runGate(dir);
        expect(res.kinds).toEqual(['skip-on-code-diff']);
        expect(res.violations[0]?.detail).toContain('app/models/user.rb');
        expect(res.status).toBe(1);
    });

    it('fix-before-artifact: fix commit predates the artifact-add commit', () => {
        const dir = makeRepo();
        write(dir, 'src/fix.ts', 'export const x = 1;\n');
        const fixSha = commitAll(dir, 'fix landed FIRST');
        write(dir, ART, findingsArtifact(SCOPE_A, ['| 1 | high | src/fix.ts:1 | bug | open | |']));
        commitAll(dir, 'artifact added AFTER the fix');
        write(dir, ART, findingsArtifact(scopeHash(dir), [`| 1 | high | src/fix.ts:1 | bug | fixed | ${fixSha} |`]));
        const res = runGate(dir);
        expect(res.kinds).toEqual(['fix-before-artifact']);
        expect(res.status).toBe(1);
    });

    it('fix-before-artifact: backdating via a later amend does not move the first-add commit', () => {
        const dir = makeRepo();
        write(dir, 'src/fix.ts', 'export const x = 1;\n');
        const fixSha = commitAll(dir, 'fix landed FIRST');
        write(dir, ART, findingsArtifact(SCOPE_A, ['| 1 | high | src/fix.ts:1 | bug | open | |']));
        commitAll(dir, 'artifact added AFTER the fix');
        write(dir, ART, findingsArtifact('b'.repeat(64), ['| 1 | high | src/fix.ts:1 | bug | open | |']));
        commitAll(dir, 'artifact rewritten later (backdating attempt)');
        write(dir, ART, findingsArtifact(scopeHash(dir), [`| 1 | high | src/fix.ts:1 | bug | fixed | ${fixSha} |`]));
        const res = runGate(dir);
        expect(res.kinds).toEqual(['fix-before-artifact']);
        expect(res.status).toBe(1);
    });

    it('artifact-not-committed: uncommitted artifact with fixed rows referencing commits', () => {
        const dir = makeRepo();
        write(dir, 'src/fix.ts', 'export const x = 1;\n');
        const fixSha = commitAll(dir, 'fix');
        write(dir, ART, findingsArtifact(scopeHash(dir), [`| 1 | high | src/fix.ts:1 | bug | fixed | ${fixSha} |`]));
        const res = runGate(dir);
        expect(res.kinds).toEqual(['artifact-not-committed']);
        expect(res.status).toBe(1);
    });

    it('unresolvable-fix-ref: fixed ref that does not resolve, and fixed with no ref at all', () => {
        const dir = makeRepo();
        write(dir, 'src/fix.ts', 'export const x = 1;\n');
        commitAll(dir, 'fix');
        write(
            dir,
            ART,
            findingsArtifact(scopeHash(dir), [
                '| 1 | high | src/fix.ts:1 | bug | fixed | abcdef1234567 |',
                '| 2 | low | src/fix.ts:2 | nit | fixed | see PR thread |',
            ]),
        );
        const res = runGate(dir);
        expect(res.kinds).toEqual(['unresolvable-fix-ref', 'unresolvable-fix-ref']);
        expect(res.status).toBe(1);
    });

    it('bad-marker: malformed header marker (own artifact)', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        const head = commitAll(dir, 'feature');
        write(
            dir,
            ART,
            [
                '# Findings: feat',
                `<!-- completion-review: v2 | reviewed: 2026-08-04 | diff: ${head} -->`,
                '',
                ...TABLE_HEAD,
                '| 1 | low | src/feature.ts:1 | nit | accepted-risk | fine, accepted |',
                '',
            ].join('\n'),
        );
        const res = runGate(dir);
        expect(res.kinds).toEqual(['bad-marker']);
        expect(res.status).toBe(1);
    });

    // Finding 7: an artifact of manifest + honest-null line and NO header was
    // accepted, although §2.1 makes every header field mandatory —
    // `markerMalformed` only fired when a marker-SHAPED line failed to parse.
    it('bad-marker: a review-bearing artifact with NO header marker at all', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        const scope = scopeHash(dir);
        write(
            dir,
            ART,
            [
                '# Findings: feat',
                '',
                manifestFor(scope),
                '',
                `**Honest-null:** 0 findings, scope ${scope}, reviewed 2026-08-04`,
                '',
            ].join('\n'),
        );
        const res = runGate(dir);
        expect(res.kinds).toEqual(['bad-marker']);
        expect(res.violations[0]?.detail).toContain('§2.1 header is mandatory');
        expect(res.status).toBe(1);
    });

    // Finding 6a: relevance ORs header / honest-null / skip, but §2.1 makes the
    // header `scope:` the only field staleness is decided on. An artifact whose
    // header points at an older scope while its honest-null line carries the
    // current one used to pass both gates.
    it('stale-review: header scope is older than the current scope, honest-null is current', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        const scope = scopeHash(dir);
        write(
            dir,
            ART,
            [
                '# Findings: feat',
                marker(SCOPE_A), // header bound to an OLDER scope
                '',
                manifestFor(scope),
                '',
                `**Honest-null:** 0 findings, scope ${scope}, reviewed 2026-08-04`,
                '',
            ].join('\n'),
        );
        const res = runGate(dir);
        expect(res.kinds).toContain('stale-review');
        expect(res.violations[0]?.detail).toContain(SCOPE_A);
        expect(res.violations[0]?.detail).toContain(scope);
        expect(res.status).toBe(1);
    });

    // Finding 6b: §5 requires the manifest's scope_hash to AGREE with the
    // header's scope:. The disagreement used to be reported (when detected at
    // all) as manifest-vs-current staleness, which cannot distinguish
    // "content changed" from "the two records disagree".
    it('manifest-header-mismatch: current header, manifest bound to another scope', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        const scope = scopeHash(dir);
        write(
            dir,
            ART,
            [
                '# Findings: feat',
                marker(scope),
                '',
                manifestFor(SCOPE_A), // manifest disagrees with the header
                '',
                `**Honest-null:** 0 findings, scope ${scope}, reviewed 2026-08-04`,
                '',
            ].join('\n'),
        );
        const res = runGate(dir);
        expect(res.kinds).toEqual(['manifest-header-mismatch']);
        expect(res.violations[0]?.detail).toContain(SCOPE_A);
        expect(res.status).toBe(1);
    });

    it('bad-marker: a v1 marker without the scope field is malformed', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        const head = commitAll(dir, 'feature');
        write(
            dir,
            ART,
            [
                '# Findings: feat',
                `<!-- completion-review: v1 | reviewed: 2026-08-04 | diff: ${head} | reviewer: r2 -->`,
                '',
                ...TABLE_HEAD,
                '| 1 | low | src/feature.ts:1 | nit | accepted-risk | fine, accepted |',
                '',
            ].join('\n'),
        );
        const res = runGate(dir);
        expect(res.kinds).toEqual(['bad-marker']);
        expect(res.status).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// Advisory mode + internal-error path
// ---------------------------------------------------------------------------

describe.runIf(hasGit())('check_completion_review — advisory + exit-2', () => {
    it('--advisory reports each violation as a warning and always exits 0', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        // json: kinds still reported, exit forced to 0
        const json = runGate(dir, ['--advisory']);
        expect(json.kinds).toEqual(['missing-artifact']);
        expect(json.status).toBe(0);
        // text: violations carry the advisory prefix
        const text = runInProc(main, ['--repo', dir, '--base', 'main', '--advisory']);
        expect(text.status).toBe(0);
        expect(text.stdout).toContain('(advisory)');
        expect(text.stdout).toContain('missing-artifact');
    });

    it('--advisory turns an open-finding block into exit 0 too', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        write(dir, ART, findingsArtifact(scopeHash(dir), ['| 1 | high | src/feature.ts:1 | bug | open | |']));
        const res = runGate(dir, ['--advisory']);
        expect(res.kinds).toEqual(['open-finding']);
        expect(res.status).toBe(0);
    });

    it('--advisory downgrades a dead scan scope like any other policy violation', () => {
        const res = runGate(movedRootRepo(), ['--advisory']);
        expect(res.kinds).toEqual(['dead-scan-scope']);
        expect(res.status).toBe(0);
    });

    it('missing base ref → internal error, exit 2', () => {
        const dir = makeRepo();
        const res = runInProc(main, ['--repo', dir, '--base', 'origin/main']);
        expect(res.status).toBe(2);
        expect(res.stderr).toContain('Internal error');
        expect(res.stderr).toContain('origin/main');
    });

    // Finding 10: the gate is registered in gate-coverage.yml with
    // `["--advisory", "--base", "origin/main"]`, and the coverage guard parses
    // `scanned:`. The base-ref check used to throw BEFORE that line was written,
    // so in any environment without an `origin/main` tracking ref the guard had
    // no number to read at all.
    it('emits `scanned:` even when the base ref is unresolvable (exit 2)', () => {
        const dir = makeRepo();
        write(dir, ART, 'placeholder\n');
        const res = runInProc(main, ['--repo', dir, '--base', 'origin/main']);
        expect(res.status).toBe(2);
        expect(res.stdout).toMatch(/^scanned: 2\n/);
    });
});

// ---------------------------------------------------------------------------
// Large diffs, the settings escape hatch
// ---------------------------------------------------------------------------

describe.runIf(hasGit())('check_completion_review — degradation guards', () => {
    // Finding 2: the review-scope diff was read under Node's 1 MiB default
    // `maxBuffer`, so a large branch threw ENOBUFS → exit 2 → warn-and-allow at
    // every caller. Gate R2 silently self-disabled on exactly the big PRs that
    // most need it, while the dispatcher (which sets a 256 MiB ceiling for the
    // identical diff) succeeded.
    it('a >1 MiB review-scope diff still reaches a verdict instead of exit 2', () => {
        const dir = makeRepo();
        const bigBody = Array.from(
            { length: 16000 },
            (_unused, i) => `export const line${i} = '${'x'.repeat(80)}';`,
        ).join('\n');
        expect(bigBody.length).toBeGreaterThan(1024 * 1024);
        write(dir, 'src/big.ts', `${bigBody}\n`);
        commitAll(dir, 'a diff larger than the default maxBuffer');

        const res = runGate(dir);
        expect(res.stderr).not.toContain('Internal error');
        expect(res.status).toBe(1);
        expect(res.kinds).toEqual(['missing-artifact']);
    });

    it('the git runner ceiling is far above the 1 MiB default', () => {
        expect(GIT_MAX_BUFFER).toBeGreaterThan(1024 * 1024);
    });

    // Finding 4: `planning.completion_review: false` is documented in the
    // settings template, the Zod schema and the /create-pr surface, but the
    // validator never read `.agent-settings.yml`, so the escape hatch did
    // nothing and the only way out was deleting the CI step.
    it('planning.completion_review=false skips the gate (note + scanned: 0 + exit 0)', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        // Without the hatch this repo blocks with missing-artifact.
        expect(runGate(dir).status).toBe(1);

        write(dir, '.agent-settings.yml', 'planning:\n  completion_review: false\n');
        expect(completionReviewDisabled(dir)).toBe(true);
        const res = runInProc(main, ['--repo', dir, '--base', 'main']);
        expect(res.status).toBe(0);
        expect(res.stdout).toContain('planning.completion_review=false');
        expect(res.stdout).toContain('scanned: 0');
    });

    it('a missing key, a missing file, or completion_review: true leaves the gate active', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        expect(completionReviewDisabled(dir)).toBe(false); // no settings file

        write(dir, '.agent-settings.yml', 'planning:\n  risk_review: false\n');
        expect(completionReviewDisabled(dir)).toBe(false); // sibling key only
        expect(runGate(dir).status).toBe(1);

        write(dir, '.agent-settings.yml', 'planning:\n  completion_review: true\n');
        expect(completionReviewDisabled(dir)).toBe(false);
        expect(runGate(dir).kinds).toEqual(['missing-artifact']);
    });
});

// ---------------------------------------------------------------------------
// Pure-function unit tests
// ---------------------------------------------------------------------------

describe('isCodePath — §2.4 classification', () => {
    it('classifies the documented edge cases', () => {
        expect(isCodePath('agents/evidence/x.md')).toBe(false);
        expect(isCodePath('src/scripts/foo.ts')).toBe(true);
        expect(isCodePath('foo.sh')).toBe(true);
        expect(isCodePath('config.yml')).toBe(false);
    });

    it('agents/** never counts as code, even for code extensions', () => {
        expect(isCodePath('agents/evidence/reviews/tool.ts')).toBe(false);
        expect(isCodePath('agents/roadmaps/plan.md')).toBe(false);
    });

    it('src/scripts/** always counts as code; other prose does not', () => {
        expect(isCodePath('src/scripts/README.md')).toBe(true);
        expect(isCodePath('docs/readme.md')).toBe(false);
        expect(isCodePath('lib/util.py')).toBe(true);
        expect(isCodePath('composer.json')).toBe(false);
        // Extensionless build/infra files ARE code: a Makefile or Dockerfile
        // change is production behaviour, and classifying it as "no code
        // surface" let such a completion take the §2.4 skip path. This
        // expectation read `false` until the R2 round-6 review named it —
        // the fix widens what needs review, it never narrows it.
        expect(isCodePath('Makefile')).toBe(true);
        expect(isCodePath('Dockerfile')).toBe(true);
        expect(isCodePath('Dockerfile.prod')).toBe(true);
        expect(isCodePath('infra/main.tf')).toBe(true);
        // …but a lockfile that merely shares a stem is not.
        expect(isCodePath('Gemfile.lock')).toBe(false);
    });

    it('covers the consumer stacks the suite installs into', () => {
        for (const p of [
            'app/models/user.rb',
            'src/main/java/App.java',
            'app/Main.kt',
            'build.gradle.kts',
            'Sources/App.swift',
            'src/core.c',
            'include/core.h',
            'src/core.cc',
            'src/core.cpp',
            'include/core.hpp',
            'Api/Controller.cs',
            'src/Main.scala',
            'components/Widget.vue',
            'components/Widget.svelte',
            'db/migrate/001.sql',
            'resources/views/home.blade.php',
        ]) {
            expect(isCodePath(p), `${p} must classify as code`).toBe(true);
        }
    });
});

describe('isOwnArtifactSlug — foreign artifacts cannot poison a PR', () => {
    it('matches identical and containing slugs, rejects unrelated ones', () => {
        expect(isOwnArtifactSlug('feat', 'feat')).toBe(true);
        expect(isOwnArtifactSlug('road-to-x', 'feat-road-to-x')).toBe(true);
        expect(isOwnArtifactSlug('feat-road-to-x', 'road-to-x')).toBe(true);
        expect(isOwnArtifactSlug('legacy-unrelated-work', 'feat')).toBe(false);
        expect(isOwnArtifactSlug('', 'feat')).toBe(false);
    });

    it('does not let a <4-char stub match everything by containment', () => {
        expect(isOwnArtifactSlug('ci', 'ci-merge-feat')).toBe(false);
        expect(isOwnArtifactSlug('feat', 'feature-branch')).toBe(true);
    });
});

describe('grammar line parsers', () => {
    const SCOPE = 'f'.repeat(64);
    const SHA = 'e'.repeat(40);

    it('parseMarkerLine accepts the exact §2.1 marker and rejects near-misses', () => {
        const m = parseMarkerLine(
            `<!-- completion-review: v1 | reviewed: 2026-08-04 | scope: ${SCOPE} | diff: ${SHA} | reviewer: r2-x -->`,
        );
        expect(m).toEqual({ reviewed: '2026-08-04', scope: SCOPE, diffSha: SHA, reviewer: 'r2-x' });
        expect(
            parseMarkerLine(`<!-- completion-review: v2 | reviewed: 2026-08-04 | scope: ${SCOPE} | diff: ${SHA} | reviewer: x -->`),
        ).toBeNull();
        // scope is mandatory, and must be a full 64-hex hash
        expect(parseMarkerLine(`<!-- completion-review: v1 | reviewed: 2026-08-04 | diff: ${SHA} | reviewer: x -->`)).toBeNull();
        expect(
            parseMarkerLine(`<!-- completion-review: v1 | reviewed: 2026-08-04 | scope: abc1234 | diff: ${SHA} | reviewer: x -->`),
        ).toBeNull();
        expect(
            parseMarkerLine(`<!-- completion-review: v1 | reviewed: 2026-08-04 | scope: ${SCOPE} | diff: ${SHA} | reviewer:  -->`),
        ).toBeNull();
    });

    it('parseHonestNull accepts only the exact §2.3 line', () => {
        expect(parseHonestNull(`**Honest-null:** 0 findings, scope ${SCOPE}, reviewed 2026-08-04`)).toEqual({
            scope: SCOPE,
            reviewed: '2026-08-04',
        });
        expect(parseHonestNull(`**Honest-null:** 0 findings scope ${SCOPE}, reviewed 2026-08-04`)).toBeNull();
        expect(parseHonestNull(`**Honest-null:** 1 findings, scope ${SCOPE}, reviewed 2026-08-04`)).toBeNull();
        // the old sha-bound grammar is gone
        expect(parseHonestNull(`**Honest-null:** 0 findings, diff ${SHA}, reviewed 2026-08-04`)).toBeNull();
    });

    it('parseSkipDeclaration accepts a scope hash or the literal none, requires the em dash', () => {
        expect(
            parseSkipDeclaration('**Skipped:** no code surface for this completion — docs only, scope none, declared 2026-08-04'),
        ).toEqual({ reason: 'docs only', scope: 'none', declared: '2026-08-04' });
        expect(
            parseSkipDeclaration(
                `**Skipped:** no code surface for this completion — plan session, scope ${SCOPE}, declared 2026-08-04`,
            ),
        ).toEqual({ reason: 'plan session', scope: SCOPE, declared: '2026-08-04' });
        expect(
            parseSkipDeclaration('**Skipped:** no code surface for this completion - docs only, scope none, declared 2026-08-04'),
        ).toBeNull();
    });

    it('extractFixRef finds the first 7-40 char hex token, or null', () => {
        expect(extractFixRef('fixed in abc1234')).toBe('abc1234');
        expect(extractFixRef(`landed as ${SHA} on feat`)).toBe(SHA);
        expect(extractFixRef('see the PR thread')).toBeNull();
        expect(extractFixRef('')).toBeNull();
    });
});

// The §2.2 fence discriminator, unit level: only a LABELLED, properly-closed
// pair may hide a line. Closing follows CommonMark (bare, and at least as many
// backticks as the opener), which is what makes a ````-wrapped ``` block nest.
describe('scanFences — §2.2 fence discriminator', () => {
    const T3 = '`'.repeat(3);
    const T4 = '`'.repeat(4);

    it('skips a labelled closed pair and reports no stray', () => {
        const s = scanFences([`${T3}markdown`, 'hidden', T3, 'visible']);
        expect([...s.fenced]).toEqual([1]);
        expect(s.strays).toEqual([]);
    });

    it('treats a bare opener as a stray that delimits nothing', () => {
        const s = scanFences([T3, 'still parsed', T3, 'also parsed']);
        expect([...s.fenced]).toEqual([]);
        expect(s.strays).toEqual([1, 3]);
    });

    it('reports an unclosed labelled opener and skips nothing after it', () => {
        const s = scanFences([`${T3}markdown`, 'still parsed']);
        expect([...s.fenced]).toEqual([]);
        expect(s.strays).toEqual([1]);
    });

    it('nests a shorter bare fence inside a longer labelled one (CommonMark closer)', () => {
        const s = scanFences([`${T4}markdown`, T3, 'inner', T3, T4, 'visible']);
        expect([...s.fenced]).toEqual([1, 2, 3]);
        expect(s.strays).toEqual([]);
    });
});

describe('parseArtifact + validateFindingRows', () => {
    const SCOPE = 'e'.repeat(64);

    it('parses marker, table rows, and the §5 context manifest', () => {
        const text = [
            '# Findings: feat',
            marker(SCOPE),
            manifestFor(SCOPE),
            '',
            ...TABLE_HEAD,
            '| 1 | critical | src/a.ts:1 | injection | open | |',
            '| 2 | low | src/b.ts:9 | nit | deferred | ISSUE-42 |',
            '',
        ].join('\n');
        const art = parseArtifact(text);
        expect(art.marker?.scope).toBe(SCOPE);
        expect(art.markerMalformed).toBe(false);
        expect(art.manifest?.scope_hash).toBe(SCOPE);
        expect(art.rows).toHaveLength(2);
        expect(art.rows[0]?.severity).toBe('critical');
        expect(art.rows[1]?.status).toBe('deferred');
        expect(art.honestNull).toBeNull();
        expect(art.skip).toBeNull();
    });

    it('reports an absent manifest as null rather than tolerating it silently', () => {
        const art = parseArtifact(['# Findings: feat', marker(SCOPE), '', ...TABLE_HEAD, ''].join('\n'));
        expect(art.manifest).toBeNull();
    });

    it('flags near-miss honest-null / skip lines as malformed instead of accepting them', () => {
        const art = parseArtifact(
            [marker(SCOPE), '**Honest-null:** zero findings', '**Skipped:** because reasons', ''].join('\n'),
        );
        expect(art.honestNull).toBeNull();
        expect(art.skip).toBeNull();
        expect(art.malformedLines).toHaveLength(2);
    });

    it('a later valid marker wins over an earlier line that failed to parse', () => {
        const art = parseArtifact(
            ['# Findings: feat', '<!-- completion-review: v0 | quoted grammar -->', marker(SCOPE), ''].join('\n'),
        );
        expect(art.marker?.scope).toBe(SCOPE);
        expect(art.markerMalformed).toBe(false);
    });

    it('a marker-shaped line with no valid marker anywhere stays malformed', () => {
        const art = parseArtifact(['# Findings: feat', '<!-- completion-review: v0 | broken -->', ''].join('\n'));
        expect(art.marker).toBeNull();
        expect(art.markerMalformed).toBe(true);
    });

    it('artifactRelevance shares the §2.6 relevance notion with --verify-current', () => {
        const other = 'd'.repeat(64);
        const review = honestNullArtifact(SCOPE);
        expect(artifactRelevance(review, SCOPE, false)).toEqual({ relevant: true, carriesReview: true });
        expect(artifactRelevance(review, other, false)).toEqual({ relevant: false, carriesReview: true });
        // A bare skip declaration is relevant but carries no review → §5 needs
        // no manifest for it, so --verify-current has nothing to re-derive.
        expect(artifactRelevance(skipLine('docs only', SCOPE), SCOPE, false)).toEqual({
            relevant: true,
            carriesReview: false,
        });
    });

    it('validateFindingRows keeps descending ties legal and reports ascents once', () => {
        const rows = parseArtifact(
            [
                ...TABLE_HEAD,
                '| 1 | high | a:1 | x | accepted-risk | fine, accepted |',
                '| 2 | high | a:2 | y | accepted-risk | fine, accepted |',
                '| 3 | medium | a:3 | z | accepted-risk | fine, accepted |',
            ].join('\n'),
        ).rows;
        expect(validateFindingRows(rows)).toEqual([]);
    });
});

// The defect the characterization block used to pin is CLOSED. Kept as the
// positive assertion the roadmap required in its place (Phase 2 Step 2): the
// exact arrangement that hid a live finding must now block.
describe('check_completion_review — a fence can no longer hide a live row', () => {
    const SCOPE = 'a'.repeat(64);
    const formerlyHoled = [
        '# Findings: probe',
        `<!-- completion-review: v1 | reviewed: 2026-08-04 | scope: ${SCOPE} | diff: abc1234 | reviewer: probe -->`,
        '',
        '| # | Severity | File:Line | Finding | Status | Reason/Ref |',
        '|---|----------|-----------|---------|--------|------------|',
        '| 1 | low | a.ts:1 | benign, already terminal | fixed | abc1234 |',
        '',
        'Illustration of the template:',
        '```markdown',
        '| 2 | critical | b.ts:9 | REAL UNREVIEWED DEFECT | open | |',
        '',
        'some prose',
        '```',
        '',
    ].join('\n');

    it('the arrangement that swallowed an open row now surfaces it', () => {
        const parsed = parseArtifact(formerlyHoled);
        expect(parsed.rows.map((r) => r.status)).toEqual(['fixed', 'open']);
        expect(parsed.rows.some((r) => r.status === 'open')).toBe(true);
    });

    it('an author who means it illustratively marks the row, not the fence', () => {
        const marked = formerlyHoled.replace('| open | |', '| example | |');
        const parsed = parseArtifact(marked);
        expect(parsed.rows.map((r) => r.status)).toEqual(['fixed']);
        expect(validateFindingRows(parsed.rows)).toEqual([]);
    });
});

// PIN — current behaviour of every fence arrangement, asserted BEFORE the §2.2
// grammar migration (roadmap road-to-plan-gate-fence-grammar, Phase 2 Step 1).
//
// This block contains NO production change. It exists so the migration commit's
// diff is the exact, reviewable list of behaviours that changed: any assertion
// flipping here that was not predicted is a defect caught before merge. Rows
// asserted `live` are visible to the gate; rows asserted `hidden` are not.
describe('check_completion_review — fence arrangements, pinned pre-migration', () => {
    const SCOPE = 'b'.repeat(64);
    const head = (): string =>
        `<!-- completion-review: v1 | reviewed: 2026-08-04 | scope: ${SCOPE} | diff: abc1234 | reviewer: pin -->`;
    const art = (...body: string[]): string =>
        ['# Findings: pin', head(), '', '| # | Severity | File:Line | Finding | Status | Reason/Ref |', '|---|---|---|---|---|---|', ...body, ''].join('\n');
    const statuses = (text: string): string[] => parseArtifact(text).rows.map((r) => `${r.index}:${r.status}`);

    it('shape 1 — odd fence count: the historical toggle hid everything after it', () => {
        // A single bare fence with no partner. Pinned: it hides nothing today,
        // and is reported as a stray instead.
        const t = art('| 1 | high | a.ts:1 | before | fixed | abc1234 |', '```', '| 2 | critical | b.ts:2 | after | open | |');
        expect(statuses(t)).toEqual(['1:fixed', '2:open']);
        expect(parseArtifact(t).strayFenceLines.length).toBeGreaterThan(0);
    });

    it('shape 2 — a CLOSED bare pair hides nothing: bare fences never open a region', () => {
        // Measured, not assumed — this assertion was written the other way round
        // first and the pin caught it. The round-7/8 rule makes every bare fence
        // a stray, so both are reported and the row between stays live. Only a
        // LABELLED opener starts a skipped region, which is why shape 3 is the hole.
        const t = art('| 1 | high | a.ts:1 | outside | fixed | abc1234 |', '```', '| 2 | critical | b.ts:2 | INSIDE | open | |', '```');
        expect(statuses(t)).toEqual(['1:fixed', '2:open']);
        expect(parseArtifact(t).strayFenceLines.length).toBe(2);
    });

    it('shape 3 — FLIPPED: the arrangement that hid a live row now surfaces it', () => {
        // The fail-open this whole change exists to close. Fence pairing is
        // unchanged (still no stray); what changed is that pairing no longer
        // decides row liveness.
        const t = art('| 1 | high | a.ts:1 | outside | fixed | abc1234 |', '```markdown', '| 2 | critical | b.ts:2 | NO LONGER HIDDEN | open | |', '```');
        expect(statuses(t)).toEqual(['1:fixed', '2:open']);
        expect(parseArtifact(t).strayFenceLines).toEqual([]);
    });

    it('shape 4 — FLIPPED: `example` is now the one illustrative marker', () => {
        const t = art('| 1 | high | a.ts:1 | template row | example | |');
        expect(statuses(t)).toEqual([]);
        expect(validateFindingRows(parseArtifact(t).rows)).toEqual([]);
    });

    it('an unrecognised status stays LIVE and blocking — the marker cannot be typo-ed open', () => {
        // The load-bearing half of the rule: if an unknown token made a row
        // vanish, the fail-open would return through a new door.
        const t = art('| 1 | high | a.ts:1 | typo | exmaple | |');
        expect(statuses(t)).toEqual(['1:exmaple']);
        expect(validateFindingRows(parseArtifact(t).rows).map((v) => v.kind)).toContain('bad-value');
    });

    it('a short row cannot excuse itself as illustrative', () => {
        // `example` is read from the Status cell of a SIX-cell row only, or
        // malformed-row would become opt-out.
        const t = art('| 1 | high | a.ts:1 | example | |');
        expect(parseArtifact(t).malformedRows.length).toBe(1);
    });

    it('non-regression — an unterminated LABELLED opener hides nothing', () => {
        const t = art('| 1 | high | a.ts:1 | before | fixed | abc1234 |', '```markdown', '| 2 | critical | b.ts:2 | after | open | |');
        expect(statuses(t)).toEqual(['1:fixed', '2:open']);
    });

    it('FLIPPED (was mislabelled non-regression) — a nested four-tick block does not hide a row either', () => {
        // Predicted as unchanged when pinned; it changed, and correctly so.
        // "Live wherever it appears" includes nested fences — the prediction was
        // wrong, not the rule. Recorded because an unexplained flip is a defect
        // signal, and this one had to be explained rather than waved through.
        const t = art('| 1 | high | a.ts:1 | outside | fixed | abc1234 |', '````markdown', '```', '| 2 | critical | b.ts:2 | INSIDE | open | |', '```', '````');
        expect(statuses(t)).toEqual(['1:fixed', '2:open']);
    });

    it('non-regression — the dispatcher skeleton parses to zero rows and no violations', () => {
        // Verbatim shape of findingsSkeleton(): header row, separator, an HTML
        // comment. It ships NO example row, so no grammar may red it.
        const skeleton = [
            '# Findings: some-slug',
            head(),
            '',
            '| # | Severity | File:Line | Finding | Status | Reason/Ref |',
            '|---|----------|-----------|---------|--------|------------|',
            '<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 -->',
            '',
        ].join('\n');
        const p = parseArtifact(skeleton);
        expect(p.rows).toEqual([]);
        expect(p.malformedRows).toEqual([]);
        expect(p.malformedLines).toEqual([]);
        expect(p.strayFenceLines).toEqual([]);
    });
});
