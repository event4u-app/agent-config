
import { describe, expect, it } from 'vitest';

import * as shape from '../../src/scripts/check_release_pr_shape.js';
import { censusDateStamp, defaultReportPath } from '../../src/scripts/report_evidence_temperature.js';

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
        expect(shape._matches('src/packs/core/installer/pack.yaml')).toBe(true);
        expect(shape._matches('agents/evidence/release-findings/a/b/c.json')).toBe(true);
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
        // Denials the literal stem and the separators already carry — they hold
        // under any date spelling, so they do NOT measure the digit classes.
        expect(shape._matches('agents/evidence/analysis/evidence-temperature-anything.md')).toBe(false);
        expect(shape._matches('agents/evidence/analysis/evidence-temperature-2026-1-5.md')).toBe(false);
        expect(shape._matches('agents/evidence/analysis/some-other-report.md')).toBe(false);
        expect(shape._matches('agents/evidence/analysis/nested/evidence-temperature-2026-10-05.md')).toBe(false);
    });

    it('the census glob denies a non-digit date — the digit classes, measured', () => {
        // These are the ONLY assertions in this file that go red if `[0-9]` is
        // relaxed to `?`: a 4-2-2 shape with the right separators and the wrong
        // character class. Measured, not assumed — the four denials above stay
        // green under `????-??-??`, so they prove the stem, never the digits.
        expect(shape._matches('agents/evidence/analysis/evidence-temperature-aaaa-bb-cc.md')).toBe(false);
        expect(shape._matches('agents/evidence/analysis/evidence-temperature-20z6-10-05.md')).toBe(false);
        // fnmatch `?` compiles to `.` under the `s` flag and so crosses `/`;
        // a digit class cannot. This path is the difference.
        expect(shape._matches('agents/evidence/analysis/evidence-temperature-x/yz-ab-cd.md')).toBe(false);
    });

    it('the allowlist admits the path the census writer actually produces', () => {
        // Directory, prefix and extension come from the writer's own builder,
        // and the day from the writer's own stamping, so a change to any of
        // them moves this assertion too.
        expect(shape._matches(defaultReportPath(censusDateStamp()))).toBe(true);
        expect(shape._matches(defaultReportPath('2026-10-01'))).toBe(true);
    });

    it('the census date stamp has the shape the allowlist glob was cut for', () => {
        // The day is a parameter of `defaultReportPath`, so the link above does
        // not pin its shape. A time component or `YYYYMMDD` reds here.
        expect(censusDateStamp(new Date(Date.UTC(2026, 9, 5)))).toBe('2026-10-05');
        expect(shape._matches(defaultReportPath(censusDateStamp(new Date(Date.UTC(2026, 9, 5)))))).toBe(true);
    });

    it('the census date stamp is UTC on both sides of a day boundary', () => {
        // The runner's own TZ is not pinned, and at offset 0 a local-time
        // implementation is indistinguishable from this one — so the test sets
        // the offset itself rather than depending on whatever the machine has.
        // Node applies a TZ change at runtime (verified on v26), and each half
        // of the pair is the one a local-time implementation fails under that
        // sign.
        const tz = process.env['TZ'];
        try {
            process.env['TZ'] = 'Europe/Berlin';
            // Guard, not decoration: both stamp assertions below go through
            // `toISOString` and are therefore offset-invariant, so they pass
            // whether or not the runtime honoured the line above. Without this
            // the test degrades silently into the ambient-offset test it
            // replaced. `getDate()` reads local time, so it is the probe.
            expect(new Date(Date.UTC(2026, 9, 5, 23, 30)).getDate()).toBe(6);
            expect(censusDateStamp(new Date(Date.UTC(2026, 9, 5, 23, 30)))).toBe('2026-10-05');
            process.env['TZ'] = 'America/New_York';
            expect(new Date(Date.UTC(2026, 9, 6, 0, 30)).getDate()).toBe(5);
            expect(censusDateStamp(new Date(Date.UTC(2026, 9, 6, 0, 30)))).toBe('2026-10-06');
        } finally {
            if (tz === undefined) {
                delete process.env['TZ'];
            } else {
                process.env['TZ'] = tz;
            }
        }
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
