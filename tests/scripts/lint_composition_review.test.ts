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
    COMPOSITION_DISPOSITIONS,
    NO_INCUMBENT,
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

    it('does not check `command:` or `guideline:` ids against a corpus it never read', () => {
        // Asserting resolvability against a tree the gate does not walk would be
        // exactly the false confidence the roadmap is about. Shape is checked;
        // existence is not claimed.
        expect(checkArtefact('a.md', _record('command:some-command', 'extend_incumbent'), known)).toEqual([]);
        expect(checkArtefact('a.md', _record('guideline:php/x', 'extend_incumbent'), known)).toEqual([]);
        // Shape still is:
        expect(checkArtefact('a.md', _record('not-a-kind:x', 'extend_incumbent'), known).map((x) => x.kind))
            .toContain('malformed-candidate');
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
        const live = artefactIds(REPO_ROOT).size;
        expect(Number(floor?.[1])).toBeLessThan(live);
        expect(Number(floor?.[1])).toBeGreaterThan(live * 0.8);
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
