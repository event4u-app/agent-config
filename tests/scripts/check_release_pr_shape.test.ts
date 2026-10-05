
import { describe, expect, it } from 'vitest';

import * as shape from '../../src/scripts/check_release_pr_shape.js';

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

    it('the evidence-temperature census release-prepare writes passes', () => {
        const { code } = runCheck([
            'package.json',
            'CHANGELOG.md',
            'agents/evidence/analysis/evidence-temperature-2026-10-05.md',
        ]);
        expect(code).toBe(0);
    });

    it('the census glob admits the ISO date shape and nothing else under it', () => {
        expect(shape._matches('agents/evidence/analysis/evidence-temperature-2026-10-05.md')).toBe(true);
        // The denial half, and the reason the glob uses digit classes: fnmatch's
        // `?` matches any character, so a `????-??-??` spelling would pass each
        // of these. They are the polarity this entry is pinned against.
        expect(shape._matches('agents/evidence/analysis/evidence-temperature-anything.md')).toBe(false);
        expect(shape._matches('agents/evidence/analysis/evidence-temperature-aaaa-bb-cc.md')).toBe(false);
        expect(shape._matches('agents/evidence/analysis/evidence-temperature-2026-1-5.md')).toBe(false);
        expect(shape._matches('agents/evidence/analysis/some-other-report.md')).toBe(false);
        expect(shape._matches('agents/evidence/analysis/nested/evidence-temperature-2026-10-05.md')).toBe(false);
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
