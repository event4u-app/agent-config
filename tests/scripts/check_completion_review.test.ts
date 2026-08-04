// Tests for src/scripts/check_completion_review.ts — the deterministic Gate-R2
// validator (docs/contracts/plan-review-gates.md §2 + §6).
//
// Every scenario builds a throwaway `git init` repo under mkdtemp — no real
// repo file is ever touched. The gate is driven in-process via runInProc
// (`main` takes --repo / --artifact-dir, so no cwd change is needed) with
// `--format json` so each fixture can assert on its specific violation kind.
//
// Committed-artifact fixtures follow the real §2.5 workflow: the artifact
// file is ADDED in a commit (the first-add commit is what ancestry counts),
// and its final content — header `diff:` = current HEAD, rows terminal — is
// a working-tree update on top (the file stays tracked; git log --diff-filter=A
// still resolves the add commit).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { runInProc } from '../_lib/run_in_process.js';
import {
    extractFixRef,
    isCodePath,
    main,
    parseArtifact,
    parseHonestNull,
    parseMarkerLine,
    parseSkipDeclaration,
    shaMatches,
    validateFindingRows,
    type Violation,
} from '../../src/scripts/check_completion_review.js';

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

const marker = (sha: string): string =>
    `<!-- completion-review: v1 | reviewed: 2026-08-04 | diff: ${sha} | reviewer: fresh-subagent-r2 -->`;

const TABLE_HEAD = [
    '| # | Severity | File:Line | Finding | Status | Reason/Ref |',
    '|---|----------|-----------|---------|--------|------------|',
];

function findingsArtifact(sha: string, rows: readonly string[]): string {
    return ['# Findings: feat', marker(sha), '', ...TABLE_HEAD, ...rows, ''].join('\n');
}

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
    it('passes on a committed artifact with all findings terminal (refs/reasons present)', () => {
        const dir = makeRepo();
        // §2.5 order: artifact committed FIRST, fix commit after.
        write(dir, ART, findingsArtifact('0'.repeat(40), ['| 1 | high | src/fix.ts:1 | bug | open | |']));
        commitAll(dir, 'add findings artifact');
        write(dir, 'src/fix.ts', 'export const x = 1;\n');
        const fixSha = commitAll(dir, 'fix the bug');
        // Working-tree finalization: header diff = current HEAD, rows terminal.
        write(
            dir,
            ART,
            findingsArtifact(fixSha, [
                `| 1 | high | src/fix.ts:1 | bug | fixed | ${fixSha} |`,
                '| 2 | medium | src/fix.ts:2 | risky pattern | accepted-risk | perf acceptable, accepted by maintainer |',
                '| 3 | low | src/fix.ts:3 | nit | deferred | roadmap: agents/roadmaps/followup.md |',
            ]),
        );
        const res = runGate(dir);
        expect(res.stderr).toBe('');
        expect(res.violations).toEqual([]);
        expect(res.status).toBe(0);
        expect(res.stdout).toMatch(/^scanned: 2\n/);
    });

    it('passes on an honest-null artifact for the current sha', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        const head = commitAll(dir, 'feature');
        write(
            dir,
            ART,
            ['# Findings: feat', marker(head), '', `**Honest-null:** 0 findings, diff ${head}, reviewed 2026-08-04`, ''].join(
                '\n',
            ),
        );
        const res = runGate(dir);
        expect(res.violations).toEqual([]);
        expect(res.status).toBe(0);
    });

    it('passes on a valid skip declaration for a docs-only diff', () => {
        const dir = makeRepo();
        write(dir, 'docs/notes.md', '# notes\n');
        commitAll(dir, 'docs only');
        write(
            dir,
            ART,
            '**Skipped:** no code surface for this completion — docs-only change, diff none, declared 2026-08-04\n',
        );
        const res = runGate(dir);
        expect(res.violations).toEqual([]);
        expect(res.status).toBe(0);
    });

    it('passes with a note when there are no changes vs base', () => {
        const dir = makeRepo(); // feat == main tip, empty diff
        const res = runInProc(main, ['--repo', dir, '--base', 'main']);
        expect(res.status).toBe(0);
        expect(res.stdout).toMatch(/^scanned: 1\n/);
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

    it('stale-review: artifact exists only for an older sha, mismatch reported', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        const head = commitAll(dir, 'feature');
        const oldSha = 'a'.repeat(40);
        write(dir, ART, findingsArtifact(oldSha, ['| 1 | low | src/feature.ts:1 | nit | accepted-risk | fine, accepted |']));
        const res = runGate(dir);
        expect(res.kinds).toEqual(['stale-review']);
        expect(res.violations[0]?.detail).toContain(oldSha);
        expect(res.violations[0]?.detail).toContain(head);
        expect(res.status).toBe(1);
    });

    it('open-finding: any open row blocks', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        const head = commitAll(dir, 'feature');
        write(dir, ART, findingsArtifact(head, ['| 1 | high | src/feature.ts:1 | bug | open | |']));
        const res = runGate(dir);
        expect(res.kinds).toEqual(['open-finding']);
        expect(res.status).toBe(1);
    });

    it('deferred-without-ref: deferred needs a ticket/issue/roadmap ref', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        const head = commitAll(dir, 'feature');
        write(dir, ART, findingsArtifact(head, ['| 1 | medium | src/feature.ts:1 | gap | deferred | |']));
        const res = runGate(dir);
        expect(res.kinds).toEqual(['deferred-without-ref']);
        expect(res.status).toBe(1);
    });

    it('accepted-risk-without-reason: accepted-risk needs a reason', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        const head = commitAll(dir, 'feature');
        write(dir, ART, findingsArtifact(head, ['| 1 | low | src/feature.ts:1 | nit | accepted-risk | |']));
        const res = runGate(dir);
        expect(res.kinds).toEqual(['accepted-risk-without-reason']);
        expect(res.status).toBe(1);
    });

    it('severity-order: rows must be sorted critical > high > medium > low', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        const head = commitAll(dir, 'feature');
        write(
            dir,
            ART,
            findingsArtifact(head, [
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
        const head = commitAll(dir, 'feature');
        write(dir, ART, findingsArtifact(head, ['| 1 | gigantic | src/feature.ts:1 | bug | wip | some note |']));
        const res = runGate(dir);
        expect(res.kinds).toEqual(['bad-value', 'bad-value']);
        expect(res.status).toBe(1);
    });

    it('skip-on-code-diff: a skip declaration is rejected when the diff touches code', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        write(
            dir,
            ART,
            '**Skipped:** no code surface for this completion — plan-only session, diff none, declared 2026-08-04\n',
        );
        const res = runGate(dir);
        expect(res.kinds).toEqual(['skip-on-code-diff']);
        expect(res.status).toBe(1);
    });

    it('fix-before-artifact: fix commit predates the artifact-add commit', () => {
        const dir = makeRepo();
        write(dir, 'src/fix.ts', 'export const x = 1;\n');
        const fixSha = commitAll(dir, 'fix landed FIRST');
        write(dir, ART, findingsArtifact('0'.repeat(40), ['| 1 | high | src/fix.ts:1 | bug | open | |']));
        const head = commitAll(dir, 'artifact added AFTER the fix');
        write(dir, ART, findingsArtifact(head, [`| 1 | high | src/fix.ts:1 | bug | fixed | ${fixSha} |`]));
        const res = runGate(dir);
        expect(res.kinds).toEqual(['fix-before-artifact']);
        expect(res.status).toBe(1);
    });

    it('fix-before-artifact: backdating via a later amend does not move the first-add commit', () => {
        const dir = makeRepo();
        write(dir, 'src/fix.ts', 'export const x = 1;\n');
        const fixSha = commitAll(dir, 'fix landed FIRST');
        write(dir, ART, findingsArtifact('0'.repeat(40), ['| 1 | high | src/fix.ts:1 | bug | open | |']));
        commitAll(dir, 'artifact added AFTER the fix');
        write(dir, ART, findingsArtifact('1'.repeat(40), ['| 1 | high | src/fix.ts:1 | bug | open | |']));
        const head = commitAll(dir, 'artifact rewritten later (backdating attempt)');
        write(dir, ART, findingsArtifact(head, [`| 1 | high | src/fix.ts:1 | bug | fixed | ${fixSha} |`]));
        const res = runGate(dir);
        expect(res.kinds).toEqual(['fix-before-artifact']);
        expect(res.status).toBe(1);
    });

    it('artifact-not-committed: uncommitted artifact with fixed rows referencing commits', () => {
        const dir = makeRepo();
        write(dir, 'src/fix.ts', 'export const x = 1;\n');
        const fixSha = commitAll(dir, 'fix');
        write(dir, ART, findingsArtifact(fixSha, [`| 1 | high | src/fix.ts:1 | bug | fixed | ${fixSha} |`]));
        const res = runGate(dir);
        expect(res.kinds).toEqual(['artifact-not-committed']);
        expect(res.status).toBe(1);
    });

    it('unresolvable-fix-ref: fixed ref that does not resolve, and fixed with no ref at all', () => {
        const dir = makeRepo();
        write(dir, 'src/fix.ts', 'export const x = 1;\n');
        const head = commitAll(dir, 'fix');
        write(
            dir,
            ART,
            findingsArtifact(head, [
                '| 1 | high | src/fix.ts:1 | bug | fixed | abcdef1234567 |',
                '| 2 | low | src/fix.ts:2 | nit | fixed | see PR thread |',
            ]),
        );
        const res = runGate(dir);
        expect(res.kinds).toEqual(['unresolvable-fix-ref', 'unresolvable-fix-ref']);
        expect(res.status).toBe(1);
    });

    it('bad-marker: malformed header marker', () => {
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
        const head = commitAll(dir, 'feature');
        write(dir, ART, findingsArtifact(head, ['| 1 | high | src/feature.ts:1 | bug | open | |']));
        const res = runGate(dir, ['--advisory']);
        expect(res.kinds).toEqual(['open-finding']);
        expect(res.status).toBe(0);
    });

    it('missing base ref → internal error, exit 2', () => {
        const dir = makeRepo();
        const res = runInProc(main, ['--repo', dir, '--base', 'origin/main']);
        expect(res.status).toBe(2);
        expect(res.stderr).toContain('Internal error');
        expect(res.stderr).toContain('origin/main');
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
        expect(isCodePath('Makefile')).toBe(false);
    });
});

describe('grammar line parsers', () => {
    const SHA = 'f'.repeat(40);

    it('parseMarkerLine accepts the exact §2.1 marker and rejects near-misses', () => {
        const m = parseMarkerLine(`<!-- completion-review: v1 | reviewed: 2026-08-04 | diff: ${SHA} | reviewer: r2-x -->`);
        expect(m).toEqual({ reviewed: '2026-08-04', diffSha: SHA, reviewer: 'r2-x' });
        expect(parseMarkerLine(`<!-- completion-review: v2 | reviewed: 2026-08-04 | diff: ${SHA} | reviewer: x -->`)).toBeNull();
        expect(parseMarkerLine('<!-- completion-review: v1 | reviewed: 2026-08-04 | reviewer: x -->')).toBeNull();
        expect(parseMarkerLine(`<!-- completion-review: v1 | reviewed: 2026-08-04 | diff: ${SHA} | reviewer:  -->`)).toBeNull();
    });

    it('parseHonestNull accepts only the exact §2.3 line', () => {
        expect(parseHonestNull(`**Honest-null:** 0 findings, diff ${SHA}, reviewed 2026-08-04`)).toEqual({
            sha: SHA,
            reviewed: '2026-08-04',
        });
        expect(parseHonestNull(`**Honest-null:** 0 findings diff ${SHA}, reviewed 2026-08-04`)).toBeNull();
        expect(parseHonestNull(`**Honest-null:** 1 findings, diff ${SHA}, reviewed 2026-08-04`)).toBeNull();
    });

    it('parseSkipDeclaration accepts sha or the literal none, requires the em dash', () => {
        expect(
            parseSkipDeclaration('**Skipped:** no code surface for this completion — docs only, diff none, declared 2026-08-04'),
        ).toEqual({ reason: 'docs only', sha: 'none', declared: '2026-08-04' });
        expect(
            parseSkipDeclaration(`**Skipped:** no code surface for this completion — plan session, diff ${SHA}, declared 2026-08-04`),
        ).toEqual({ reason: 'plan session', sha: SHA, declared: '2026-08-04' });
        expect(
            parseSkipDeclaration('**Skipped:** no code surface for this completion - docs only, diff none, declared 2026-08-04'),
        ).toBeNull();
    });

    it('extractFixRef finds the first 7-40 char hex token, or null', () => {
        expect(extractFixRef('fixed in abc1234')).toBe('abc1234');
        expect(extractFixRef(`landed as ${SHA} on feat`)).toBe(SHA);
        expect(extractFixRef('see the PR thread')).toBeNull();
        expect(extractFixRef('')).toBeNull();
    });

    it('shaMatches accepts full-sha equality and >=7-char prefixes', () => {
        expect(shaMatches(SHA, SHA)).toBe(true);
        expect(shaMatches(SHA.slice(0, 12), SHA)).toBe(true);
        expect(shaMatches('abc123', SHA)).toBe(false); // < 7 chars never prefix-matches
        expect(shaMatches('0'.repeat(40), SHA)).toBe(false);
    });
});

describe('parseArtifact + validateFindingRows', () => {
    const SHA = 'e'.repeat(40);

    it('parses marker, table rows, and tolerates a context-manifest comment (§5)', () => {
        const text = [
            '# Findings: feat',
            marker(SHA),
            '<!-- context-manifest: v1',
            'inputs:',
            `  diff_sha: ${SHA}`,
            '  diff_hash: 0123abc',
            'excluded: [session-history]',
            'dispatched: 2026-08-04T09:30:00Z',
            '-->',
            '',
            ...TABLE_HEAD,
            '| 1 | critical | src/a.ts:1 | injection | open | |',
            '| 2 | low | src/b.ts:9 | nit | deferred | ISSUE-42 |',
            '',
        ].join('\n');
        const art = parseArtifact(text);
        expect(art.marker?.diffSha).toBe(SHA);
        expect(art.markerMalformed).toBe(false);
        expect(art.rows).toHaveLength(2);
        expect(art.rows[0]?.severity).toBe('critical');
        expect(art.rows[1]?.status).toBe('deferred');
        expect(art.honestNull).toBeNull();
        expect(art.skip).toBeNull();
    });

    it('flags near-miss honest-null / skip lines as malformed instead of accepting them', () => {
        const art = parseArtifact(
            [marker(SHA), '**Honest-null:** zero findings', '**Skipped:** because reasons', ''].join('\n'),
        );
        expect(art.honestNull).toBeNull();
        expect(art.skip).toBeNull();
        expect(art.malformedLines).toHaveLength(2);
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
