
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import * as shape from '../../src/scripts/check_release_pr_shape.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function runCheck(files: readonly string[]): { code: number; out: string } {
    const out: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    (process.stdout as { write: unknown }).write = (s: string): boolean => {
        out.push(String(s));
        return true;
    };
    let code: number;
    try {
        code = shape.check(files);
    } finally {
        process.stdout.write = orig;
    }
    return { code, out: out.join('') };
}

describe('check_release_pr_shape — check() (ported pytest)', () => {
    it('real 3.3.0 release-PR shape passes', () => {
        const files = [
            'package.json',
            'package-lock.json',
            'CHANGELOG.md',
            '.claude-plugin/marketplace.json',
            'src/packs/core/pack.yaml',
            'src/packs/core/README.md',
            'src/packs/finance-basic/pack.yaml',
            'src/packs/finance-basic/README.md',
        ];
        const { code, out } = runCheck(files);
        expect(code).toBe(0);
        expect(out).toContain('SHAPE-CLEAN');
        for (const f of files) {
            expect(out).toContain(`ok: ${f}`);
        }
    });

    it('stray install script fails', () => {
        const { code, out } = runCheck(['package.json', 'CHANGELOG.md', 'src/scripts/install.py']);
        expect(code).toBe(1);
        expect(out).toContain('OUT-OF-SHAPE: src/scripts/install.py');
        expect(out).not.toContain('ok: package.json');
    });

    it('empty diff fails', () => {
        const { code, out } = runCheck([]);
        expect(code).toBe(1);
        expect(out).toContain('empty diff');
    });

    it('pack-only release passes', () => {
        const { code } = runCheck([
            'package.json',
            'CHANGELOG.md',
            'src/packs/core/pack.yaml',
            'src/packs/finance-basic/pack.yaml',
            'src/packs/founder-strategy/pack.yaml',
        ]);
        expect(code).toBe(0);
    });

    it('nested package file fails', () => {
        const { code, out } = runCheck(['package.json', 'src/packs/core/installer/foo.ts']);
        expect(code).toBe(1);
        expect(out).toContain('OUT-OF-SHAPE: src/packs/core/installer/foo.ts');
    });

    it('the `*` entries admit any depth — recorded, not endorsed', () => {
        // The denial above holds on the EXTENSION, not on the nesting: `foo.ts`
        // matches no glob at any depth. fnmatch `*` crosses `/`, so the `*`
        // entries do admit arbitrary depth, which the census entry avoids by
        // using digit classes. Pinned here so the property is visible rather
        // than discovered, and so narrowing these globs later is a deliberate
        // edit to this assertion rather than a silent behaviour change.
        //
        // EVERY `*` entry, not a sample: a reader checking whether a given row
        // is narrow should find its answer here rather than infer it from a
        // neighbour. The count is derived below rather than written down, so
        // adding a seventh wildcard row reds this instead of aging a comment.
        const wildcards = shape.ALLOWLIST_GLOBS.filter((g) => g.includes('*'));
        expect(wildcards).toHaveLength(6);
        expect(shape._matches('src/packs/core/installer/pack.yaml')).toBe(true);
        expect(shape._matches('src/packs/core/installer/README.md')).toBe(true);
        expect(shape._matches('src/domains/a/b/pack.yaml')).toBe(true);
        expect(shape._matches('src/domains/a/b/README.md')).toBe(true);
        expect(shape._matches('agents/evidence/release-findings/a/b/c.json')).toBe(true);
        // Here the `*` sits before the extension rather than before a
        // separator, so it swallows a segment plus a filename. Same shape as
        // the findings-ledger row above; neither is a superset of the other.
        expect(shape._matches('docs/archive/CHANGELOG-pre-x/evil.md')).toBe(true);
    });

    it('marketplace metadata only passes', () => {
        expect(runCheck(['.claude-plugin/marketplace.json']).code).toBe(0);
    });

    it('changelog only passes', () => {
        expect(runCheck(['CHANGELOG.md']).code).toBe(0);
    });

    it('pack README only passes', () => {
        expect(runCheck(['src/packs/core/README.md']).code).toBe(0);
    });

    it('era archive release passes', () => {
        const { code, out } = runCheck([
            'package.json',
            'CHANGELOG.md',
            '.claude-plugin/marketplace.json',
            'src/packs/core/pack.yaml',
            'src/packs/core/README.md',
            'docs/archive/CHANGELOG-pre-5.4.0.md',
        ]);
        expect(code).toBe(0);
        expect(out).toContain('SHAPE-CLEAN');
    });

    it('unrelated archive file fails', () => {
        const { code, out } = runCheck(['package.json', 'docs/archive/some-other-doc.md']);
        expect(code).toBe(1);
        expect(out).toContain('OUT-OF-SHAPE: docs/archive/some-other-doc.md');
    });

    it('_matches rejects unrelated paths, accepts allowlist', () => {
        expect(shape._matches('src/scripts/install.py')).toBe(false);
        expect(shape._matches('tests/test_condense.py')).toBe(false);
        expect(shape._matches('.github/workflows/tests.yml')).toBe(false);
        expect(shape._matches('src/packs/core/installer/foo.ts')).toBe(false);
        expect(shape._matches('docs/archive/some-other-doc.md')).toBe(false);
        expect(shape._matches('package.json')).toBe(true);
        expect(shape._matches('package-lock.json')).toBe(true);
        expect(shape._matches('src/some/nested/package-lock.json')).toBe(false);
        expect(shape._matches('src/packs/core/pack.yaml')).toBe(true);
        expect(shape._matches('src/packs/core/README.md')).toBe(true);
        expect(shape._matches('docs/archive/CHANGELOG-pre-5.4.0.md')).toBe(true);
    });

    it('a stray evidence-temperature census in a release PR fails', () => {
        // release-prepare no longer writes the census (2026-10-28): its header
        // named the HEAD commit, so every new commit on a release branch
        // produced a one-line diff, a commit and a full CI cycle for nothing.
        const { code } = runCheck([
            'package.json',
            'CHANGELOG.md',
            'agents/evidence/analysis/evidence-temperature-2026-10-05.md',
        ]);
        expect(code).toBe(1);
    });
});

describe('check_release_pr_shape — mid-release-fix remediation hint', () => {
    it('an out-of-shape finding carries the land-on-main procedure', () => {
        const { code, out } = runCheck(['package.json', 'src/scripts/skill_linter.ts']);
        expect(code).toBe(1);
        expect(out).toContain('OUT-OF-SHAPE: src/scripts/skill_linter.ts');
        expect(out).toContain('land the files above on main via their own PR');
        expect(out).toContain('task release -- --resume --yes');
    });

    it('a shape-clean diff carries no remediation prose', () => {
        const { code, out } = runCheck(['package.json', 'CHANGELOG.md']);
        expect(code).toBe(0);
        expect(out).not.toContain('land the files above on main');
    });
});

describe('check_release_pr_shape — contract/code allowlist parity', () => {
    // The drift this asserts against has now been repaired by hand three times
    // on this branch alone: the contract named `packages/*/pack.yaml` where the
    // code says `src/packs/*`, omitted six entries, and kept a third copy in a
    // blockquote. Each was found by review, which is why the contract's own text
    // called that binding a weak mechanism. This is the mechanism.
    const CONTRACT = path.join(REPO_ROOT, 'docs/contracts/release-pr-gating.md');

    /** The backticked globs of § Release-PR shape's enumeration, in order. */
    function enumeratedGlobs(): string[] {
        const doc = fs.readFileSync(CONTRACT, 'utf8');
        const start = doc.indexOf('2. **Diff file set is a subset of the version-bump allowlist:**');
        expect(start).toBeGreaterThan(-1);
        const end = doc.indexOf('\n\n   **`*` and `?` both cross', start);
        expect(end).toBeGreaterThan(start);
        return doc
            .slice(start, end)
            .split('\n')
            .map((line) => /^ {3}- `([^`]+)`/.exec(line)?.[1])
            .filter((g): g is string => g !== undefined);
    }

    it('the cut-surface table names exactly the jobs that skip', () => {
        // The table is the only written justification for a branch-wide CI
        // skip, and nothing parsed it — so it drifted: it named two jobs that
        // had been removed and omitted four that do skip. Same remedy as the
        // allowlist parity above, applied to the other list in the same file.
        //
        // BOTH guarded workflows, not just the one with most rows: a guard
        // added in the other file would otherwise age the table with this test
        // green. Comment lines are excluded — this contract and several
        // workflows quote the guard expression in prose, and a quotation is
        // not a guard.
        // Derived, not listed: a hardcoded pair would be a third unparsed copy
        // of a list — the decay this test exists to stop, one level up. Every
        // workflow is scanned, so a guard added to a sixth file is caught.
        const wfDir = path.join(REPO_ROOT, '.github/workflows');
        const WORKFLOWS = fs.readdirSync(wfDir).filter((n) => n.endsWith('.yml') || n.endsWith('.yaml'));
        expect(WORKFLOWS.length).toBeGreaterThan(0);
        const guarded: string[] = [];
        for (const wf of WORKFLOWS) {
            const text = fs.readFileSync(path.join(wfDir, wf), 'utf8');
            let job = '';
            for (const line of text.split('\n')) {
                // Any YAML key at job indentation, not just kebab-case: a job
                // id this misses would attribute its guard to the PREVIOUS job.
                const header = /^ {2}([A-Za-z_][\w-]*):\s*$/.exec(line);
                if (header) job = header[1] as string;
                if (line.trimStart().startsWith('#')) continue;
                if (line.includes("!startsWith(github.head_ref, 'release/')") && job !== '') {
                    guarded.push(`${wf}:${job}`);
                }
            }
        }
        // Scoped to § Cut surface: the file holds a second workflow/job table
        // (§ Kept surface) listing jobs that deliberately still run, and a
        // document-wide match would demand the two be equal.
        const doc = fs.readFileSync(CONTRACT, 'utf8');
        const from = doc.indexOf('## Cut surface');
        expect(from).toBeGreaterThan(-1);
        // Ends at the next H2, which is structure rather than a sentence that
        // could be reworded. -1 means § Cut surface is last: slice to the end.
        const next = doc.indexOf('\n## ', from + 1);
        const section = doc.slice(from, next === -1 ? undefined : next);
        const tabled = [...section.matchAll(/^\| `([a-z-]+\.ya?ml)` \| `([^`]+)` \|/gm)].map((m) => `${m[1]}:${m[2]}`);
        expect([...tabled].sort()).toEqual([...guarded].sort());
    });

    it('the contract enumerates exactly the globs the gate compiles', () => {
        // Set equality AND order: the two read as one list, so a reader
        // comparing them line by line should not have to re-sort either.
        expect(enumeratedGlobs()).toEqual([...shape.ALLOWLIST_GLOBS]);
    });
});

describe('check_release_pr_shape — the release pipeline writes no census', () => {
    it('release-prepare does not invoke report_evidence_temperature', () => {
        const yml = fs.readFileSync(path.join(REPO_ROOT, 'taskfiles/content.yml'), 'utf8');
        const start = yml.indexOf('\n  release-prepare:');
        expect(start).toBeGreaterThan(-1);
        const next = yml.slice(start + 1).search(/\n  [\w:-]+:\n/);
        const body = next === -1 ? yml.slice(start) : yml.slice(start, start + 1 + next);
        expect(body).toContain('task: sync');
        expect(body).not.toMatch(/report_evidence_temperature/);
    });

    it('no tracked automation invokes the census at all', () => {
        // The direct check above would pass if `sync`, `generate-tools` or a
        // workflow called the census instead. Every tracked file is scanned —
        // `git grep` is the index, not a root list — and the census may only be
        // NAMED there, never run: zero invocations, where this test used to
        // demand exactly one.
        const files = execFileSync('sh', ['-c', "git grep -l 'report_evidence_temperature' -- . || true"], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        })
            .split('\n')
            .filter((f) => f !== '')
            // Markdown is prose; the module and the suites that import it name
            // it by definition; review artifacts and the code map mirror files.
            .filter((f) => !f.endsWith('.md'))
            .filter((f) => f !== 'src/scripts/report_evidence_temperature.ts')
            .filter((f) => !f.startsWith('tests/'))
            .filter((f) => !f.startsWith('agents/evidence/'))
            .filter((f) => !f.startsWith('agents/map/'));
        const invocations = files
            .filter((f) => fs.existsSync(path.join(REPO_ROOT, f)))
            .flatMap((f) =>
                fs
                    .readFileSync(path.join(REPO_ROOT, f), 'utf8')
                    .split('\n')
                    .map((line) => `${f}: ${line}`),
            )
            .map((line) => line.replace(/\/\*.*?\*\//g, '').replace(/(\s|^)(\/\/|#).*$/, '$1'))
            .filter((line) => /(scripts-run|tsx|node)\s+\S*report_evidence_temperature/.test(line));
        expect(invocations).toEqual([]);
    });
});
