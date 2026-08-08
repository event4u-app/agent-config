/**
 * Rule-projection integrity — the gate must fail on the two conditions that
 * were live and unobserved for five weeks.
 *
 * Three of the four properties below cannot be checked by reading the gate:
 *
 *  - A missing entry has to be NAMED. "the projection is incomplete" is not
 *    actionable; the 21 rules that reached the model at no project scope were
 *    only fixable once they were listed.
 *  - The freshness leg has to compare the LINK's mtime, not the target's. The
 *    entries are symlinks, so `statSync` follows them and compares the dist file
 *    with itself — an assertion that can never fire, and one whose green is
 *    indistinguishable from a real pass. The stale case below is built on a real
 *    symlink for exactly that reason: it fails if the implementation reverts to
 *    a following stat.
 *  - An empty scan root must not exit 0. That is the false-green class
 *    `_lib/scan_scope.ts` exists for, and a completeness gate over zero rules is
 *    its purest instance.
 *
 * The fourth pins the emit plan's provenance: the expected set must come from
 * the generator, so `type: manual` rules — which the trees deliberately omit —
 * must not appear in it. A completeness check keyed on `dist/agent-src/rules/`
 * verbatim would demand 5 entries the generator will never write, and the
 * "fix" would be to project them.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { _resetStateForTest, projected_rule_trees } from '../../src/scripts/condense.js';
import { DeadScopeError } from '../../src/scripts/_lib/scan_scope.js';
import { auditRuleProjection, main, renderFindings } from '../../src/scripts/check_rule_projection_integrity.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TREE = '.claude/rules';

/**
 * A minimal projection layout under a fresh tmp root: dist rules as real files,
 * tree entries as relative symlinks — the same shape `generate_rule_symlinks`
 * writes, because the freshness leg's correctness depends on them being links.
 */
function makeRoot(rules: readonly string[], projected: readonly string[] = rules): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rule-projection-'));
    const dist = path.join(root, 'dist', 'agent-src', 'rules');
    const tree = path.join(root, TREE);
    fs.mkdirSync(dist, { recursive: true });
    fs.mkdirSync(tree, { recursive: true });
    for (const r of rules) {
        fs.writeFileSync(path.join(dist, r), `# ${r}\n`, 'utf-8');
    }
    for (const r of projected) {
        fs.symlinkSync(path.join('../../dist/agent-src/rules', r), path.join(tree, r));
    }
    return root;
}

/** Move a dist rule's mtime decisively ahead of the link's — no sleep, no flake. */
function ageProjectionBehind(root: string, rule: string): void {
    const dist = path.join(root, 'dist', 'agent-src', 'rules', rule);
    const future = new Date(Date.now() + 60_000);
    fs.utimesSync(dist, future, future);
}

describe('a complete, fresh tree passes', () => {
    it('reports no findings and accounts for every planned entry', () => {
        const root = makeRoot(['alpha.md', 'beta.md']);
        const audit = auditRuleProjection(root, { [TREE]: ['alpha.md', 'beta.md'] });
        expect(audit.findings).toEqual([]);
        expect(audit.treePresent[TREE]).toBe(true);
        const tally = audit.ledger.finalize();
        expect(tally.planned).toBe(2);
        expect(tally.completed).toBe(2);
        expect(tally.failed).toBe(0);
    });
});

describe('a missing entry fails and is named', () => {
    it('names the absent rule, not just a count', () => {
        const root = makeRoot(['alpha.md', 'beta.md'], ['alpha.md']);
        const audit = auditRuleProjection(root, { [TREE]: ['alpha.md', 'beta.md'] });
        expect(audit.findings).toHaveLength(1);
        expect(audit.findings[0]).toMatchObject({ tree: TREE, rule: 'beta.md', kind: 'missing' });
        expect(renderFindings(audit).join('\n')).toContain('beta.md');
        expect(audit.ledger.finalize().failed).toBe(1);
    });

    it('fails every rule under a tree that does not exist at all', () => {
        const root = makeRoot(['alpha.md', 'beta.md']);
        fs.rmSync(path.join(root, TREE), { recursive: true });
        const audit = auditRuleProjection(root, { [TREE]: ['alpha.md', 'beta.md'] });
        expect(audit.treePresent[TREE]).toBe(false);
        expect(audit.findings.map((f) => f.rule)).toEqual(['alpha.md', 'beta.md']);
        expect(renderFindings(audit).join('\n')).toContain('tree does not exist');
    });
});

describe('a stale entry fails', () => {
    it('fires when the dist rule is newer than the symlink that points at it', () => {
        const root = makeRoot(['alpha.md', 'beta.md']);
        ageProjectionBehind(root, 'beta.md');
        const audit = auditRuleProjection(root, { [TREE]: ['alpha.md', 'beta.md'] });
        // Exactly one: `alpha.md` is untouched, so a check that compared the
        // target with itself would report zero here and this length would be 0.
        expect(audit.findings).toHaveLength(1);
        expect(audit.findings[0]).toMatchObject({ tree: TREE, rule: 'beta.md', kind: 'stale' });
        expect(renderFindings(audit).join('\n')).toContain('source is newer than the projection entry');
    });

    it('is not vacuous — the symlink target IS newer than the link, by construction', () => {
        const root = makeRoot(['beta.md']);
        ageProjectionBehind(root, 'beta.md');
        const link = path.join(root, TREE, 'beta.md');
        // Pins the property the implementation depends on: lstat sees the link,
        // stat follows it. If these ever agree the freshness leg is dead.
        expect(fs.lstatSync(link).mtimeMs).toBeLessThan(fs.statSync(link).mtimeMs);
    });
});

describe('an empty scan root does not silently pass', () => {
    it('throws DeadScopeError rather than reporting a clean tree', () => {
        const root = makeRoot([]);
        expect(() => auditRuleProjection(root, { [TREE]: [] })).toThrow(DeadScopeError);
    });

    it('still throws when a tree IS active but plans no rule', () => {
        // The discriminator, from the failing side: an active tool whose emit
        // plan is empty means the rule corpus died, and that must stay fatal.
        // If the zero-tool carve-out below were keyed on the rule count instead
        // of the tree count, this case would be silenced with it.
        const root = makeRoot(['alpha.md']);
        expect(() => auditRuleProjection(root, { [TREE]: [], '.clinerules': [] })).toThrow(DeadScopeError);
    });
});

describe('a checkout with every tool deactivated is skipped, not failed', () => {
    // `agents/.agent-tools.yml` may legitimately select zero tools — the
    // maintainer config that avoids duplicating a globally installed `~/.claude`.
    // `projected_rule_trees()` then returns `{}`, and this gate runs FIRST in the
    // pre-push chain: treating that as a dead scope made `git push` impossible on
    // a supported config, which is the defect this pair pins.
    it('does not throw when the expected map is empty (no active tool)', () => {
        const root = makeRoot(['alpha.md']);
        const audit = auditRuleProjection(root, {});
        expect(audit.findings).toEqual([]);
        expect(audit.treePresent).toEqual({});
        expect(audit.ledger.finalize().planned).toBe(0);
    });

    it('exits 0 through the CLI and announces the skip on stderr', () => {
        // Silence would be indistinguishable from a real pass — the false-green
        // class `_lib/scan_scope.ts` exists to prevent — so the announcement is
        // part of the contract. Driven end-to-end through `main()` because the
        // exit code is what the pre-push chain reads.
        const root = makeRoot(['alpha.md'], []);
        fs.mkdirSync(path.join(root, 'agents'), { recursive: true });
        fs.writeFileSync(path.join(root, 'agents', '.agent-tools.yml'), 'tools: []\n', 'utf-8');

        const chunks: string[] = [];
        const original = process.stderr.write.bind(process.stderr);
        process.stderr.write = ((c: string | Uint8Array) => {
            chunks.push(String(c));
            return true;
        }) as typeof process.stderr.write;
        let code: number;
        try {
            code = main(['--root', root, '--quiet']);
        } finally {
            process.stderr.write = original;
            // `main` repoints condense's MODULE_STATE at `--root`; leaving it
            // there would make the repo-corpus tests below audit a tmp dir.
            _resetStateForTest();
        }
        expect(code).toBe(0);
        expect(chunks.join('')).toContain('no host rule tree is active');
    });
});

describe('the expected set comes from the generator, not from dist/ verbatim', () => {
    const distRules = path.join(REPO_ROOT, 'dist', 'agent-src', 'rules');

    // These two read the REAL repo's emit plan, which is empty when
    // `agents/.agent-tools.yml` selects zero tools — a supported local config
    // (it avoids duplicating a globally installed `~/.claude`). Asserting
    // `size > 50` there fails on the config rather than on a defect. CI commits
    // all eight tools, so both keep their teeth where the corpus exists; a
    // change that empties the committed list is a visible one-line diff.
    const planEmpty = Object.keys(projected_rule_trees()).length === 0;

    function isManual(rule: string): boolean {
        return /^type:\s*["']?manual["']?\s*$/m.test(fs.readFileSync(path.join(distRules, rule), 'utf-8'));
    }

    it.skipIf(planEmpty)('omits every ADR-004 `type: manual` rule and includes every other one', () => {
        const plan = projected_rule_trees();
        const projected = new Set(plan[TREE] ?? []);
        expect(projected.size).toBeGreaterThan(50);

        const onDisk = fs.readdirSync(distRules).filter((n) => n.endsWith('.md'));
        const manualButProjected = onDisk.filter((r) => isManual(r) && projected.has(r));
        expect(manualButProjected, 'manual rules must never be projected (ADR-004)').toEqual([]);

        const nonManual = onDisk.filter((r) => !isManual(r));
        const missing = nonManual.filter((r) => !projected.has(r));
        expect(missing, 'every non-manual dist rule belongs to the emit plan').toEqual([]);
    });

    it.skipIf(planEmpty)('plans the same rule set for every active host rule tree', () => {
        const plan = projected_rule_trees();
        const trees = Object.keys(plan);
        expect(trees).toContain(TREE);
        for (const t of trees) {
            expect(plan[t], `${t} diverges from ${TREE}`).toEqual(plan[TREE]);
        }
    });
});
