// Unit tests for the preamble byte census
// (`src/scripts/preamble_byte_census.ts` — road-to-cache-economy Phase 3,
// steps 1-2). Style follows `tests/scripts/cache_realization_report.test.ts`:
// pure functions imported directly, fixtures built on temp directories, and
// every expectation derived from the fixture constants — never copied from a
// real run.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { censusDuplicateScope } from '../../src/scripts/_lib/duplicate_scope_census.js';
import {
    buildByteCensus,
    censusClaudeMdHierarchy,
    censusGlobalProfile,
    censusSkillsCatalog,
    topRulesByCost,
    type ByteCensusSource,
} from '../../src/scripts/preamble_byte_census.js';

const _tmpDirs: string[] = [];
function mkTmp(prefix: string): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    _tmpDirs.push(d);
    return d;
}
afterEach(() => {
    while (_tmpDirs.length > 0) {
        const d = _tmpDirs.pop();
        if (d) fs.rmSync(d, { recursive: true, force: true });
    }
});

// ── topRulesByCost ───────────────────────────────────────────────────────

describe('topRulesByCost', () => {
    it('sorts .md files by byte size descending, ignores non-.md, and caps at the limit', () => {
        const dir = mkTmp('rules-');
        fs.writeFileSync(path.join(dir, 'small.md'), 'a'.repeat(40));
        fs.writeFileSync(path.join(dir, 'big.md'), 'b'.repeat(400));
        fs.writeFileSync(path.join(dir, 'mid.md'), 'c'.repeat(120));
        fs.writeFileSync(path.join(dir, 'not-a-rule.txt'), 'd'.repeat(9999));

        const top = topRulesByCost(dir, 2);
        expect(top.map((r) => r.file)).toEqual(['big.md', 'mid.md']);
        expect(top[0]?.chars).toBe(400);
        expect(top[0]?.tokens_estimate).toBeCloseTo(400 / 4, 12);
    });

    it('returns an empty list when the directory does not exist', () => {
        expect(topRulesByCost(path.join(os.tmpdir(), 'does-not-exist-xyz'))).toEqual([]);
    });

    it('breaks ties on byte size by filename, alphabetically', () => {
        const dir = mkTmp('rules-tie-');
        fs.writeFileSync(path.join(dir, 'zed.md'), 'x'.repeat(10));
        fs.writeFileSync(path.join(dir, 'alpha.md'), 'x'.repeat(10));
        const top = topRulesByCost(dir, 2);
        expect(top.map((r) => r.file)).toEqual(['alpha.md', 'zed.md']);
    });
});

// ── censusClaudeMdHierarchy ──────────────────────────────────────────────

describe('censusClaudeMdHierarchy', () => {
    it('sums project CLAUDE.md, project CLAUDE.local.md, user CLAUDE.md, and its @-imports', () => {
        const repoRoot = mkTmp('repo-');
        const userHome = mkTmp('home-');
        const claudeDir = path.join(userHome, '.claude');
        fs.mkdirSync(claudeDir, { recursive: true });

        fs.writeFileSync(path.join(repoRoot, 'CLAUDE.md'), 'p'.repeat(50));
        fs.writeFileSync(path.join(repoRoot, 'CLAUDE.local.md'), 'l'.repeat(20));
        fs.writeFileSync(path.join(claudeDir, 'RTK.md'), 'r'.repeat(30));
        fs.writeFileSync(path.join(claudeDir, 'CLAUDE.md'), '@RTK.md\n');

        const c = censusClaudeMdHierarchy(repoRoot, userHome);
        expect(c.project_claude_md_present).toBe(true);
        expect(c.project_claude_md_chars).toBe(50);
        expect(c.project_claude_local_md_present).toBe(true);
        expect(c.project_claude_local_md_chars).toBe(20);
        expect(c.user_claude_md_present).toBe(true);
        expect(c.user_claude_md_chars).toBe('@RTK.md\n'.length);
        expect(c.user_imports).toEqual([{ file: 'RTK.md', chars: 30 }]);
    });

    it('reports zero/absent for every layer that does not exist, and no imports when the user CLAUDE.md is missing', () => {
        const repoRoot = mkTmp('repo-empty-');
        const userHome = mkTmp('home-empty-');
        const c = censusClaudeMdHierarchy(repoRoot, userHome);
        expect(c.project_claude_md_present).toBe(false);
        expect(c.project_claude_md_chars).toBe(0);
        expect(c.project_claude_local_md_present).toBe(false);
        expect(c.user_claude_md_present).toBe(false);
        expect(c.user_imports).toEqual([]);
    });

    it('skips an @-import line whose target file does not exist', () => {
        const repoRoot = mkTmp('repo-');
        const userHome = mkTmp('home-');
        const claudeDir = path.join(userHome, '.claude');
        fs.mkdirSync(claudeDir, { recursive: true });
        fs.writeFileSync(path.join(claudeDir, 'CLAUDE.md'), '@missing.md\nsome prose that is not an import\n');

        const c = censusClaudeMdHierarchy(repoRoot, userHome);
        expect(c.user_imports).toEqual([]);
    });
});

// ── censusGlobalProfile ──────────────────────────────────────────────────

describe('censusGlobalProfile', () => {
    it('reports present + byte size when the global profile.md layer has landed', () => {
        const configHome = mkTmp('event4u-home-');
        const userDir = path.join(configHome, 'user');
        fs.mkdirSync(userDir, { recursive: true });
        fs.writeFileSync(path.join(userDir, 'profile.md'), 'x'.repeat(77));

        const c = censusGlobalProfile({ EVENT4U_CONFIG_HOME: configHome });
        expect(c.present).toBe(true);
        expect(c.chars).toBe(77);
        expect(c.path).toBe(path.join(userDir, 'profile.md'));
    });

    it('treats an absent global profile as 0, per the roadmap honesty caveat', () => {
        const configHome = mkTmp('event4u-home-empty-');
        const c = censusGlobalProfile({ EVENT4U_CONFIG_HOME: configHome });
        expect(c.present).toBe(false);
        expect(c.chars).toBe(0);
        expect(c.path).toBeNull();
    });
});

// ── censusSkillsCatalog ──────────────────────────────────────────────────

describe('censusSkillsCatalog', () => {
    it('sums "- <name>: <description>\\n" over every SKILL.md, skipping directories without one', () => {
        const dir = mkTmp('skills-');
        fs.mkdirSync(path.join(dir, 'skill-a'));
        fs.writeFileSync(
            path.join(dir, 'skill-a', 'SKILL.md'),
            '---\nname: skill-a\ndescription: "Does A things."\n---\n\n# skill-a\n',
        );
        fs.mkdirSync(path.join(dir, 'skill-b'));
        fs.writeFileSync(
            path.join(dir, 'skill-b', 'SKILL.md'),
            '---\nname: skill-b\ndescription: "Does B things, longer description here."\n---\n\n# skill-b\n',
        );
        fs.mkdirSync(path.join(dir, 'not-a-skill')); // no SKILL.md — skipped

        const c = censusSkillsCatalog(dir);
        const expectedChars = '- skill-a: Does A things.\n'.length + '- skill-b: Does B things, longer description here.\n'.length;
        expect(c.skills).toBe(2);
        expect(c.chars).toBe(expectedChars);
    });

    it('falls back to the directory name when frontmatter has no name field', () => {
        const dir = mkTmp('skills-noname-');
        fs.mkdirSync(path.join(dir, 'my-skill'));
        fs.writeFileSync(path.join(dir, 'my-skill', 'SKILL.md'), '---\ndescription: "x"\n---\n');
        const c = censusSkillsCatalog(dir);
        expect(c.chars).toBe('- my-skill: x\n'.length);
    });

    it('returns zero for a nonexistent directory', () => {
        expect(censusSkillsCatalog(path.join(os.tmpdir(), 'no-such-skills-dir'))).toEqual({ skills: 0, chars: 0 });
    });
});

// ── buildByteCensus (the pure assembler) ─────────────────────────────────

function names(sources: ByteCensusSource[]): string[] {
    return sources.map((s) => s.name);
}

describe('buildByteCensus', () => {
    const fixed = {
        userRules: { files: 10, chars: 4000 }, // 1000 tokens
        projectRules: { files: 10, chars: 4000 }, // 1000 tokens
        claudeMd: {
            project_claude_md_chars: 800, // 200 tokens
            project_claude_md_present: true,
            project_claude_local_md_chars: 0,
            project_claude_local_md_present: false,
            user_claude_md_chars: 400, // 100 tokens
            user_claude_md_present: true,
            user_imports: [],
        },
        globalProfile: { present: false, chars: 0, path: null },
        skillsCatalog: { skills: 5, chars: 800 }, // 200 tokens
        topRules: [{ file: 'big.md', chars: 4000, tokens_estimate: 1000 }],
    };
    // measurable = 1000 + 1000 + 200(claudeMd: 800+400=1200/4=300, correcting below) ...
    // computed precisely inline per test rather than hand-summed here.

    it('sums the named sources into measurable_tokens_total, appends a residual bucket, and the grand total equals the median by construction', () => {
        const userRulesDir = mkTmp('dup-user-');
        const projectRulesDir = mkTmp('dup-project-');
        fs.writeFileSync(path.join(userRulesDir, 'shared.md'), 'x'.repeat(400)); // 100 tokens
        fs.writeFileSync(path.join(projectRulesDir, 'shared.md'), 'x'.repeat(400));
        const dup = censusDuplicateScope(userRulesDir, projectRulesDir);

        const median = 5000;
        const c = buildByteCensus({
            ...fixed,
            duplicateScope: dup,
            measuredColdStartMedian: median,
            coldStartLegs: 42,
        });

        const measurable =
            fixed.userRules.chars / 4 +
            fixed.projectRules.chars / 4 +
            (fixed.claudeMd.project_claude_md_chars + fixed.claudeMd.user_claude_md_chars) / 4 +
            fixed.globalProfile.chars / 4 +
            fixed.skillsCatalog.chars / 4;

        expect(c.measurable_tokens_total).toBeCloseTo(measurable, 6);
        expect(names(c.sources)).toContain('tool definitions + dispatch prompt (residual)');
        // `residual` -> `estimated` (road-to-delivered-cost-truth 4.1): the
        // bucket is unchanged, its private spelling of "derived by subtraction"
        // is now the shared vocabulary's word for it. The NAME is still the
        // discriminator here, so the assertion above still pins the bucket.
        const residual = c.sources.find((s) => s.name.includes('residual'));
        expect(residual?.tokens_estimate).toBeCloseTo(median - measurable, 6);
        // Grand total reconstructs the median exactly — disclosed as
        // by-construction in the report, not presented as an independent check.
        expect(c.grand_total_tokens).toBeCloseTo(median, 6);
        expect(c.within_tolerance).toBe(true);
        expect(c.measurable_share_of_median).toBeCloseTo(measurable / median, 6);
        expect(c.measured_cold_start_median).toBe(median);
        expect(c.cold_start_legs).toBe(42);
    });

    it('omits the residual bucket and leaves the median fields null when no cold-start legs were observed', () => {
        const dup = censusDuplicateScope(mkTmp('a-'), mkTmp('b-')); // no shared files -> not evaluable
        const c = buildByteCensus({
            ...fixed,
            duplicateScope: dup,
            measuredColdStartMedian: null,
            coldStartLegs: 0,
        });
        expect(names(c.sources)).not.toContain('tool definitions + dispatch prompt (residual)');
        expect(c.grand_total_tokens).toBeCloseTo(c.measurable_tokens_total, 6);
        expect(c.measured_cold_start_median).toBeNull();
        expect(c.measurable_share_of_median).toBeNull();
        expect(c.within_tolerance).toBeNull();
    });

    it('models the duplicate-copy removal from the C-2 census, labelled modelled and never claiming measured', () => {
        const userRulesDir = mkTmp('dup2-user-');
        const projectRulesDir = mkTmp('dup2-project-');
        fs.writeFileSync(path.join(userRulesDir, 'shared.md'), 'x'.repeat(800)); // 200 tokens
        fs.writeFileSync(path.join(projectRulesDir, 'shared.md'), 'x'.repeat(800));
        const dup = censusDuplicateScope(userRulesDir, projectRulesDir);

        const median = 10_000;
        const c = buildByteCensus({
            ...fixed,
            duplicateScope: dup,
            measuredColdStartMedian: median,
            coldStartLegs: 7,
        });

        expect(c.modelled_duplicate_removal.applicable).toBe(true);
        expect(c.modelled_duplicate_removal.modelled_new_median).toBeCloseTo(median - 800 / 4, 6);
        expect(c.modelled_duplicate_removal.modelled_reduction_pct).toBeCloseTo((800 / 4) / median, 6);
    });

    it('is not applicable when the duplicate-scope census itself is not evaluable (single-scope install)', () => {
        const dup = censusDuplicateScope(mkTmp('single-a-'), mkTmp('single-b-')); // no shared files
        const c = buildByteCensus({
            ...fixed,
            duplicateScope: dup,
            measuredColdStartMedian: 5000,
            coldStartLegs: 3,
        });
        expect(c.modelled_duplicate_removal.applicable).toBe(false);
        expect(c.modelled_duplicate_removal.modelled_new_median).toBeNull();
        expect(c.modelled_duplicate_removal.reason).toMatch(/no shared/);
    });
});
