/**
 * Tests for `src/scripts/lint_composition_review.ts` — the authoring-search
 * record (road-to-composition-before-creation Phases 2–4).
 *
 * Two jobs. The first is the gate's own behaviour: the STRUCTURAL half must be
 * hard and the PRESENCE half must be advisory, and neither may drift into the
 * other. The second is Phase 2.3's obligation — the roadmap asks that the new
 * vocabulary be registered "so a fourth vocabulary cannot appear unnoticed".
 *
 * `src/config/canonical-terms.yml` turned out to be the wrong home for that:
 * it maps SPELLING variants to a canonical spelling (`behaviour` → `behavior`),
 * and an enum value is not a misspelling of anything. Registering there would
 * have satisfied the step's literal verify while guarding nothing. The
 * disjointness suite below is the substitute, and it is stronger: it fails when
 * a value is added to ANY of the six vocabularies that collides with another,
 * which is the actual failure "a fourth vocabulary appears unnoticed" names.
 *
 * SABOTAGE PROBES, run 2026-08-27 before this file was trusted (each reverted
 * from a backup copy, never `git checkout`):
 *   1. make a missing record a violation instead of an advisory → **2 red**,
 *      including the assertion that the presence half exits 0;
 *   2. drop the `none`/`none_found` cross-check → **2 red** (both directions);
 *   3. add `deferred` to COMPOSITION_DISPOSITIONS → **1 red** in the
 *      disjointness suite, naming the review vocabulary it collides with.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    BLOCK_SCALAR,
    COMPOSITION_DISPOSITIONS,
    GitScopeError,
    NO_INCUMBENT,
    addedArtefacts,
    artefactIds,
    checkArtefact,
    main,
    parseCompositionReview,
} from '../../src/scripts/lint_composition_review.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function _repo(files: Record<string, string>): string {
    const d = mkdtempSync(join(tmpdir(), 'lcr-t-'));
    for (const [rel, body] of Object.entries(files)) {
        const f = join(d, rel);
        mkdirSync(dirname(f), { recursive: true });
        writeFileSync(f, body);
    }
    return d;
}

const _fm = (block: string): string => `---\nname: probe\n${block}---\n\n# probe\n`;
const _record = (candidate: string, disposition: string, rationale = 'a delta long enough to be real'): string =>
    _fm(`composition_review:\n  - candidate: ${candidate}\n    disposition: ${disposition}\n    rationale: ${rationale}\n`);

describe('lint_composition_review — the structural half is HARD', () => {
    const known = new Set(['rule:incumbent', 'skill:incumbent-skill']);

    it('accepts a record whose candidate resolves', () => {
        expect(checkArtefact('a.md', _record('rule:incumbent', 'create_separate'), known)).toEqual([]);
    });

    it('rejects a candidate naming no artefact in the tree', () => {
        const v = checkArtefact('a.md', _record('rule:ghost', 'create_separate'), known);
        expect(v).toHaveLength(1);
        expect(v[0]?.kind).toBe('unresolvable-candidate');
    });

    it('rejects both directions of a `none` / `none_found` mismatch', () => {
        const a = checkArtefact('a.md', _record(NO_INCUMBENT, 'extend_incumbent'), known);
        expect(a.map((x) => x.kind)).toContain('none-mismatch');
        const b = checkArtefact('b.md', _record('rule:incumbent', 'none_found'), known);
        expect(b.map((x) => x.kind)).toContain('none-mismatch');
    });

    it('accepts the pair that records a search which found nothing', () => {
        // This value has to exist, or the schema pushes an author to invent an
        // incumbent in order to satisfy it — which is the pro-forma failure the
        // whole mechanism is supposed to measure, manufactured by the mechanism.
        expect(checkArtefact('a.md', _record(NO_INCUMBENT, 'none_found'), known)).toEqual([]);
    });

    it('rejects a disposition borrowed from another vocabulary', () => {
        const v = checkArtefact('a.md', _record('rule:incumbent', 'accepted_risk'), known);
        expect(v.map((x) => x.kind)).toContain('unknown-disposition');
    });

    it('rejects the same candidate carrying two dispositions', () => {
        const text = _fm(
            'composition_review:\n' +
                '  - candidate: rule:incumbent\n    disposition: create_separate\n    rationale: the first of two\n' +
                '  - candidate: rule:incumbent\n    disposition: extend_incumbent\n    rationale: the second of two\n',
        );
        expect(checkArtefact('a.md', text, known).map((x) => x.kind)).toContain('duplicate-candidate');
    });

    it('checks EVERY candidate kind — the carve-out is gone', () => {
        // This spec is the inverse of the one it replaces. The original asserted
        // that `command:` and `guideline:` ids are NOT checked, on the reasoning
        // that asserting against an unread tree would be false confidence. An
        // independent review pointed out the real problem: the module contract
        // and both schema descriptions already claimed those ids resolve, so the
        // carve-out made the CLAIM false rather than the check honest. The trees
        // are readable, so the code now earns the claim.
        const real = artefactIds(REPO_ROOT);
        expect(checkArtefact('a.md', _record('command:refine-ticket', 'extend_incumbent'), real)).toEqual([]);
        expect(
            checkArtefact('a.md', _record('command:not-a-real-command', 'extend_incumbent'), real).map((x) => x.kind),
        ).toContain('unresolvable-candidate');
        // Shape is still checked before existence:
        expect(checkArtefact('a.md', _record('not-a-kind:x', 'extend_incumbent'), real).map((x) => x.kind))
            .toContain('malformed-candidate');
    });});

/**
 * Everything below this comment exists because an independent cross-model review
 * found it missing. Both reviewing seats read the whole gate; none of these
 * cases was in the first version, and each one failed against it.
 */
describe('lint_composition_review — defects found by review', () => {
    it('resolves all FOUR candidate kinds, not just skill and rule', () => {
        // The finding: the contract and both schema descriptions said "a lint
        // checks that `candidate` resolves", and `command:` / `guideline:` were
        // silently exempt. `command:this-does-not-exist` passed every check.
        const ids = artefactIds(REPO_ROOT);
        for (const kind of ['skill:', 'rule:', 'command:', 'guideline:']) {
            expect([...ids].filter((i) => i.startsWith(kind)).length, kind).toBeGreaterThan(0);
        }
        // And the real ids are addressed the way a rule or skill cites them —
        // command below its pack, guideline without its extension.
        expect(ids).toContain('command:refine-ticket');
        expect(ids).toContain('guideline:code-clarity');
    });

    it('rejects a non-existent `command:` and `guideline:` candidate', () => {
        const known = artefactIds(REPO_ROOT);
        for (const cand of ['command:this-does-not-exist', 'guideline:missing/path']) {
            const v = checkArtefact('a.md', _record(cand, 'create_separate'), known);
            expect(v.map((x) => x.kind), cand).toContain('unresolvable-candidate');
        }
        // Sensitivity: a real one of each still passes, so this is not a probe
        // that rejects everything.
        expect(checkArtefact('a.md', _record('command:refine-ticket', 'create_separate'), known)).toEqual([]);
        expect(checkArtefact('a.md', _record('guideline:code-clarity', 'create_separate'), known)).toEqual([]);
    });

    it('rejects a PRESENT but empty record', () => {
        // `composition_review: []` is present and says nothing — neither of the
        // two states the gate distinguishes. It used to return no violation.
        const v = checkArtefact('a.md', _fm('composition_review: []\n'), new Set());
        expect(v).toHaveLength(1);
        expect(v[0]?.kind).toBe('empty-record');
    });

    it('rejects a field written as a YAML block scalar', () => {
        // Valid YAML the line parser reads wrongly: it would capture `|` and
        // produce a one-character rationale. Worse than a parse error, because
        // it looks like data.
        const text = _fm(
            'composition_review:\n  - candidate: rule:incumbent\n    disposition: create_separate\n    rationale: |\n      a multi-line rationale\n',
        );
        expect(parseCompositionReview(text)?.[0]?.rationale).toBe(BLOCK_SCALAR);
        const v = checkArtefact('a.md', text, new Set(['rule:incumbent']));
        expect(v.map((x) => x.kind)).toContain('block-scalar-field');
    });

    it('rejects malformed candidate paths that used to be accepted', () => {
        const known = artefactIds(REPO_ROOT);
        for (const bad of ['guideline:/foo', 'guideline:foo/', 'guideline:foo//bar']) {
            const v = checkArtefact('a.md', _record(bad, 'create_separate'), known);
            expect(v.map((x) => x.kind), bad).toContain('malformed-candidate');
        }
    });

    it('a git failure is UNKNOWN, never "no additions"', () => {
        // The finding: with an unresolvable base ref, `git diff` failed, the catch
        // returned `[]`, and the gate exited 0 reporting zero advisories — a blind
        // run indistinguishable from a clean one.
        expect(() => addedArtefacts(REPO_ROOT, 'refs/heads/definitely-not-a-ref-xyz', ['src/rules/a.md']))
            .toThrow(GitScopeError);
    });

    it('the advisory path actually reports an untracked addition', () => {
        // The load-bearing union (`ls-files --others`) had ZERO coverage, despite
        // a comment calling it load-bearing. Real git repo, real untracked file.
        const root = mkdtempSync(join(tmpdir(), 'lcr-git-'));
        const git = (...a: string[]): void => {
            execFileSync('git', a, { cwd: root, encoding: 'utf-8' });
        };
        git('init', '-q');
        git('config', 'user.email', 't@example.com');
        git('config', 'user.name', 't');
        mkdirSync(join(root, 'src', 'rules'), { recursive: true });
        writeFileSync(join(root, 'src', 'rules', 'base.md'), _fm(''));
        git('add', '-A');
        git('commit', '-qm', 'base');
        // Untracked, never committed — exactly what a create-only canary plants.
        writeFileSync(join(root, 'src', 'rules', 'planted.md'), _fm(''));

        const added = addedArtefacts(root, 'HEAD', ['src/rules/base.md', 'src/rules/planted.md']);
        expect(added).toContain('src/rules/planted.md');
        expect(added).not.toContain('src/rules/base.md');

        // End to end through main(): reported, and still exit 0.
        expect(main(['--repo', root, '--base-ref', 'HEAD', '--quiet'])).toBe(0);
    });
});

describe('lint_composition_review — the presence half is ADVISORY', () => {
    it('an artefact with no record at all produces no violation', () => {
        expect(checkArtefact('a.md', _fm(''), new Set())).toEqual([]);
        expect(parseCompositionReview(_fm(''))).toBeNull();
    });

    it('exits 0 on a corpus where nothing carries a record', () => {
        const root = _repo({
            'src/rules/a.md': _fm(''),
            'src/rules/b.md': _fm(''),
            'src/skills/s/SKILL.md': _fm(''),
        });
        expect(main(['--repo', root, '--quiet'])).toBe(0);
    });

    it('exits 1 on the same corpus once one record is malformed', () => {
        // The discriminator between the two halves, asserted rather than assumed:
        // same corpus, one file changed, opposite verdict.
        const root = _repo({
            'src/rules/a.md': _fm(''),
            'src/rules/b.md': _record('rule:ghost', 'create_separate'),
            'src/skills/s/SKILL.md': _fm(''),
        });
        expect(main(['--repo', root, '--quiet'])).toBe(1);
    });
});

describe('lint_composition_review — scan scope', () => {
    it('reports a dead scope as a POLICY failure, not a clean pass', () => {
        // Exit 2 is warn-and-allow at every call site, so a moved corpus root
        // must not be able to downgrade the hard half to advisory.
        const empty = _repo({ 'README.md': '# nothing here' });
        expect(main(['--repo', empty, '--quiet'])).toBe(1);
    });

    it('finds both corpus roots in the real tree', () => {
        const ids = artefactIds(REPO_ROOT);
        expect([...ids].filter((i) => i.startsWith('skill:')).length).toBeGreaterThan(250);
        expect([...ids].filter((i) => i.startsWith('rule:')).length).toBeGreaterThan(100);
    });

    it('is registered in gate-coverage.yml with a floor below the live corpus', () => {
        const yml = readFileSync(join(REPO_ROOT, 'src/config/gate-coverage.yml'), 'utf-8');
        expect(yml).toContain('- id: lint_composition_review');
        const floor = /- id: lint_composition_review[\s\S]*?min_scanned: (\d+)/.exec(yml);
        expect(floor).not.toBeNull();
        // Measured against the SCANNED corpus (skills + rules), which is what
        // `reportScanned` publishes — not against `artefactIds`, which now also
        // indexes commands and guidelines for candidate RESOLUTION and is
        // therefore a much larger set. The first version of this spec conflated
        // the two and went red the moment resolution was widened; the floor it
        // was checking had not changed.
        const scanned = Number(/scanned: (\d+)/.exec(
            execFileSync(
                join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx'),
                [join(REPO_ROOT, 'src/scripts/lint_composition_review.ts'), '--repo', REPO_ROOT, '--quiet'],
                { cwd: REPO_ROOT, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 },
            ),
        )?.[1]);
        expect(scanned).toBeGreaterThan(0);
        expect(Number(floor?.[1])).toBeLessThan(scanned);
        expect(Number(floor?.[1])).toBeGreaterThan(scanned * 0.8);
    });

    it('the self-test suite passes with a rejecting majority', () => {
        const out = execFileSync(
            join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx'),
            [join(REPO_ROOT, 'src/scripts/lint_composition_review.ts'), '--self-test'],
            { cwd: REPO_ROOT, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 },
        );
        expect(out).toMatch(/8\/8 case\(s\) behaved \(5 rejecting/);
    });
});

/**
 * Phase 2.3, discharged where it can actually bite.
 *
 * Six vocabularies in this tree answer some version of "what happened to a
 * candidate". Their file:line definitions are recorded in the roadmap; what
 * matters mechanically is that no value appears in two of them, because a value
 * that does is a vocabulary collision nobody notices until two validators
 * classify the same string differently.
 */
describe('composition dispositions are disjoint from every incumbent vocabulary', () => {
    const INCUMBENTS: ReadonlyArray<readonly [string, readonly string[]]> = [
        // src/scripts/check_finding_dispositions.ts:43
        ['finding dispositions', ['fixed', 'false_positive', 'accepted_risk']],
        // src/scripts/check_completion_review.ts:281
        ['completion-review statuses', ['open', 'fixed', 'accepted-risk', 'deferred']],
        // src/scripts/check_review_dispositions.ts:53
        ['archived-review terminal set', ['fixed', 'accepted-risk', 'deferred']],
        // src/scripts/build_archive_index.ts:71-76
        ['roadmap archive dispositions', [
            'completed', 'completed-with-deferrals', 'closed-with-cancellations',
            'archived-with-open-steps', 'not-extractable',
        ]],
        // src/scripts/lint_harvest_provenance.ts:76 — the closest incumbent
        ['harvest verdicts', ['adopt', 'adapt']],
        // src/scripts/lint_roadmap_blockers.ts:48 — the token, not the field
        ['blocker statuses', ['open', 'resolved']],
    ];

    it('no composition disposition collides with an incumbent value', () => {
        for (const [name, values] of INCUMBENTS) {
            for (const v of COMPOSITION_DISPOSITIONS) {
                expect(values, `${v} collides with ${name}`).not.toContain(v as string);
            }
        }
    });

    it('carries the one value no incumbent can express', () => {
        // 2.2's verify: a "genuinely new" verdict must name a case the existing
        // enum cannot express. `create_separate` is that case — an incumbent
        // exists, was evaluated, and a separate artefact was authored anyway.
        // The harvest ledger is the nearest vocabulary and deliberately EXCLUDES
        // rejection (`lint_harvest_provenance.ts:222` — "a reject/already/unclear
        // …"), because a rejected harvest has no artefact to cite. This record is
        // the mirror: it is written ON the artefact being created, so rejection
        // is the value it most needs.
        expect(COMPOSITION_DISPOSITIONS).toContain('create_separate');
        const allIncumbent = new Set(INCUMBENTS.flatMap(([, v]) => v));
        expect(allIncumbent.has('create_separate')).toBe(false);
        expect(allIncumbent.has('extend_incumbent')).toBe(false);
    });

    it('the enum in both schemas matches the exported constant', () => {
        // A schema and a script disagreeing about the vocabulary is how a value
        // becomes accepted by one and rejected by the other.
        for (const p of ['src/scripts/schemas/skill.schema.json', 'src/scripts/schemas/rule.schema.json']) {
            const schema = JSON.parse(readFileSync(join(REPO_ROOT, p), 'utf-8')) as {
                properties: { composition_review: { items: { properties: { disposition: { enum: string[] } } } } };
            };
            expect(schema.properties.composition_review.items.properties.disposition.enum, p)
                .toEqual([...COMPOSITION_DISPOSITIONS]);
        }
    });
});
