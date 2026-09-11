// The measured standing-payload ceiling and its break-glass ledger.
//
// `road-to-delivery-for-every-host` 4.4, stage 1. Every case here pins a
// clause an AI council made BLOCKING on 2026-09-10 / 2026-09-11, and each one
// is written so that removing the mechanism turns it red — a ledger test that
// only ever passes would be the second copy of the failure this whole
// mechanism exists to stop, which is a rule nobody enforced.
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { extractSurfacesAtRef, measurePayloadAtRef } from '../../src/scripts/_lib/base_ref_payload.js';
import {
    computeCeiling,
    EXCEPTIONS_CONFIG_PATH,
    type PayloadException,
    readExceptions,
    stateOf,
} from '../../src/scripts/_lib/measured_payload_ceiling.js';
import {
    auditCatalogue,
    ON_DEMAND_TREES,
    PROJECTION_ROOT,
} from '../../src/scripts/_lib/payload_catalogue_completeness.js';
import { assertBoundsDidNotRise, boundsFrom } from '../../src/scripts/_lib/standing_bound_ratchet.js';
import { measureDeterministicPayload } from '../../src/scripts/check_preamble_payload_budget.js';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');

const tmps: string[] = [];
afterEach(() => {
    while (tmps.length) fs.rmSync(tmps.pop() as string, { recursive: true, force: true });
});

function tmpdir(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'measured-ceiling-'));
    tmps.push(d);
    return d;
}

const DESIGN = 107_646;
const TODAY = '2026-09-11';

function grant(over: Partial<PayloadException> = {}): PayloadException {
    return {
        id: 'g1',
        granted_tokens: 300,
        watermark: 138_413,
        reason: 'an offsetting reduction was unsafe here',
        approval_event: 'https://example.invalid/review/1',
        approved_at: '2026-09-01',
        expires_at: '2026-10-01',
        repaid_at: null,
        ...over,
    };
}

// ---------------------------------------------------------------------------
// The base reading. This is the regression pin for a defect that cost 746
// tokens of silent tightening, and it is first because everything else rests
// on the base number being the SAME measurement as the head number.
// ---------------------------------------------------------------------------

describe('the payload at a ref is the same measurement as the payload in the tree', () => {
    const sum = (root: string): number =>
        measureDeterministicPayload(root).reduce((n, b) => n + b.tokens, 0);

    it('reading HEAD through a ref equals reading the working tree, to the token', () => {
        // THE REGRESSION THIS PINS, measured rather than imagined. The first cut
        // materialised the base tree with `git archive`, which honours
        // `export-ignore` — and `.gitattributes` marks `/CLAUDE.md` export-ignore
        // so release tarballs stay clean. `git archive HEAD -- CLAUDE.md | tar -t`
        // emits ZERO entries and exits 0, so the base came back 746 tok light on
        // a tree nobody had touched. A light base is a TIGHT ceiling: every pull
        // request would have reddened by 746 tokens it did not add.
        //
        // An equality here is therefore not a tautology. It fails if any declared
        // surface stops being materialised, whatever the reason.
        expect(measurePayloadAtRef({ repoRoot: REPO_ROOT, ref: 'HEAD', measure: sum }).tokens).toBe(sum(REPO_ROOT));
    });

    it('materialises every declared surface, including one reachable only through a symlink', () => {
        const t = extractSurfacesAtRef({ repoRoot: REPO_ROOT, ref: 'HEAD' });
        try {
            expect(t.tree).not.toBeNull();
            // CLAUDE.md is a git symlink to AGENTS.md, which is NOT a declared
            // surface. Materialising the link without its target leaves a
            // dangling entry that the census reads as an absent file — the same
            // 746-token shortfall by a second route.
            const claude = path.join(t.tree as string, 'CLAUDE.md');
            expect(fs.existsSync(claude), 'CLAUDE.md must be materialised').toBe(true);
            expect(fs.readFileSync(claude, 'utf-8').length, 'and must RESOLVE, not dangle').toBeGreaterThan(0);
        } finally {
            t.dispose();
        }
    });

    it('an unreadable ref returns null with a reason, never a small number', () => {
        const r = measurePayloadAtRef({ repoRoot: REPO_ROOT, ref: 'no-such-ref-xyz', measure: sum });
        expect(r.tokens).toBeNull();
        expect(r.note).toMatch(/unreachable/);
    });

    it('an empty ref string is refused before any git call', () => {
        expect(measurePayloadAtRef({ repoRoot: REPO_ROOT, ref: '  ', measure: sum }).tokens).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// The formula.
// ---------------------------------------------------------------------------

describe('ceiling = max(design, effective base + grant, retained stored)', () => {
    const base = (over: Record<string, unknown> = {}): ReturnType<typeof computeCeiling> =>
        computeCeiling({ designCeiling: DESIGN, basePayload: 138_413, headPayload: 138_413, today: TODAY, ...over });

    it('zero net growth: with no grant the ceiling IS the base', () => {
        const c = base();
        expect(c.ceiling).toBe(138_413);
        expect(c.boundBy).toBe('base');
        expect(c.ok).toBe(true);
    });

    it('the design ceiling is a FLOOR — a base below it never tightens the bound', () => {
        const c = base({ basePayload: 90_000, headPayload: 90_000 });
        expect(c.ceiling).toBe(DESIGN);
        expect(c.boundBy).toBe('design');
    });

    it('the formula has exactly two terms — no stored allowance can be passed in', () => {
        // Stage 1 kept a third `max` term reading `ci_delivery.grace_ceiling`.
        // Stage 2 deleted it (ADR-276), so the only way to widen the ceiling is
        // for the BASE to be wider — which a pull request cannot arrange,
        // because the base is the ref it branched from.
        expect(base().ceiling).toBe(138_413);
        expect(base({ basePayload: 200_000, headPayload: 200_000 }).ceiling).toBe(200_000);
        expect(base({ basePayload: 1, headPayload: 1 }).ceiling).toBe(DESIGN);
    });

    it('no per-PR headroom: ten runs at the ceiling do not compound', () => {
        // The arithmetic one seat put on the refused percentage variant:
        // 138,413 x 1.05^10 is about 225,000. Here the ceiling tracks the base
        // exactly, so a tree that never grows never gains room.
        let b = 138_413;
        for (let i = 0; i < 10; i += 1) {
            b = computeCeiling({ designCeiling: DESIGN, basePayload: b, headPayload: b, today: TODAY }).ceiling;
        }
        expect(b).toBe(138_413);
    });
});

describe('the watermark pin — the clause that stops a grant becoming permanent', () => {
    it('a live grant is honoured ONCE, not again at the raised base', () => {
        const g = grant();
        // The merge after the grant measures the RAISED payload as its base.
        // Without the pin the ceiling would be 138,713 + 300 = 139,013 and the
        // grant would be permanent one merge later.
        const c = computeCeiling({
            designCeiling: DESIGN,
            basePayload: 138_713,
            headPayload: 138_713,
            exceptions: [g],
            verifiedApprovals: ['g1'],
            today: TODAY,
        });
        expect(c.effectiveBase, 'the base is pinned to the watermark').toBe(138_413);
        expect(c.ceiling).toBe(138_713);
        expect(c.ceiling).not.toBe(139_013);
    });

    it('SENSITIVITY: without the pin the same inputs give the compounding number', () => {
        // The mechanism neutralised by hand, so the assertion above is known to
        // be measuring the pin rather than an arithmetic coincidence.
        const unpinned = 138_713 + grant().granted_tokens;
        expect(unpinned).toBe(139_013);
        expect(unpinned).toBeGreaterThan(
            computeCeiling({
                designCeiling: DESIGN,
                basePayload: 138_713,
                headPayload: 138_713,
                exceptions: [grant()],
                verifiedApprovals: ['g1'],
                today: TODAY,
            }).ceiling,
        );
    });
});

describe('the six ledger contract rules, each from a blocking finding', () => {
    it('1 — two active grants at once is refused; overlap has no defined composition', () => {
        const c = computeCeiling({
            designCeiling: DESIGN,
            basePayload: 138_413,
            headPayload: 138_413,
            exceptions: [grant({ id: 'a' }), grant({ id: 'b' })],
            verifiedApprovals: ['a', 'b'],
            today: TODAY,
        });
        expect(c.ok).toBe(false);
        expect(c.violations.join(' ')).toMatch(/active at once/);
        // And the refused grants buy nothing while they are refused.
        expect(c.activeGrants).toBe(0);
    });

    it('2 — an UNVERIFIED approval contributes zero tokens and refuses the run', () => {
        const unverified = computeCeiling({
            designCeiling: DESIGN,
            basePayload: 138_413,
            headPayload: 138_413,
            exceptions: [grant()],
            today: TODAY, // no verifiedApprovals
        });
        expect(unverified.ok).toBe(false);
        expect(unverified.violations.join(' ')).toMatch(/no VERIFIED approval/);
        expect(unverified.activeGrants, 'a refused grant may not widen the bound').toBe(0);
        expect(unverified.ceiling).toBe(138_413);
        // SENSITIVITY: the identical input with the approval verified passes and
        // the grant applies, so the case is measuring verification and not some
        // other refusal.
        const verified = computeCeiling({
            designCeiling: DESIGN,
            basePayload: 138_413,
            headPayload: 138_413,
            exceptions: [grant()],
            verifiedApprovals: ['g1'],
            today: TODAY,
        });
        expect(verified.ok).toBe(true);
        expect(verified.ceiling).toBe(138_713);
    });

    it('4 — repaid_at is refused when the measurement contradicts it', () => {
        const c = computeCeiling({
            designCeiling: DESIGN,
            basePayload: 138_413,
            headPayload: 138_700, // still 287 above the watermark
            exceptions: [grant({ repaid_at: '2026-09-10' })],
            today: TODAY,
        });
        expect(c.ok).toBe(false);
        expect(c.violations.join(' ')).toMatch(/still outstanding/);
        // SENSITIVITY: the same record with the payload actually back down.
        const repaid = computeCeiling({
            designCeiling: DESIGN,
            basePayload: 138_413,
            headPayload: 138_413,
            exceptions: [grant({ repaid_at: '2026-09-10' })],
            today: TODAY,
        });
        expect(repaid.ok).toBe(true);
    });

    it('5 — a stored consumed_tokens field is rejected outright', () => {
        const root = tmpdir();
        const f = path.join(root, 'ex.json');
        fs.writeFileSync(f, JSON.stringify({ exceptions: [{ ...grant(), consumed_tokens: 50 }] }), 'utf-8');
        expect(readExceptions(f).errors.join(' ')).toMatch(/'consumed_tokens' is not a field/);
    });

    it('6 — an expired, unrepaid grant is a hard refusal, not a lapse to the wider bound', () => {
        const expired = grant({ expires_at: '2026-09-01' });
        expect(stateOf(expired, TODAY)).toBe('expired');
        const c = computeCeiling({
            designCeiling: DESIGN,
            basePayload: 138_713,
            headPayload: 138_713,
            exceptions: [expired],
            verifiedApprovals: ['g1'],
            today: TODAY,
        });
        expect(c.ok).toBe(false);
        expect(c.violations.join(' ')).toMatch(/expired on 2026-09-01/);
        // SENSITIVITY: one day earlier the same record is active and passes.
        expect(
            computeCeiling({
                designCeiling: DESIGN,
                basePayload: 138_713,
                headPayload: 138_713,
                exceptions: [expired],
                verifiedApprovals: ['g1'],
                today: '2026-08-31',
            }).ok,
        ).toBe(true);
    });
});

describe('3 — deletion cannot discharge debt', () => {
    const at = (cfg: unknown, ex: unknown) => (args: readonly string[]) => {
        if (args[0] !== 'show') return { ok: true, stdout: '', stderr: '' };
        const target = String(args[1] ?? '');
        if (target.endsWith(EXCEPTIONS_CONFIG_PATH)) {
            return ex === null
                ? { ok: false, stdout: '', stderr: '' }
                : { ok: true, stdout: JSON.stringify(ex), stderr: '' };
        }
        return { ok: true, stdout: JSON.stringify(cfg), stderr: '' };
    };
    const budget = { baseline_tokens: 1, headroom_pct: 0 };

    it('a grant that existed at the base and is gone at head REFUSES', () => {
        const v = assertBoundsDidNotRise({
            repoRoot: '.',
            baseRef: 'abc',
            git: at(budget, { exceptions: [grant()] }),
            headBounds: boundsFrom(budget, { exceptions: [] }) ?? {},
        });
        expect(v.ok).toBe(false);
        expect(v.violations.join(' ')).toMatch(/existed at abc and is gone at head/);
        // Reported ONCE even though the record carries two bounds.
        expect(v.violations.filter((s) => s.includes('is gone at head'))).toHaveLength(1);
    });

    it('SENSITIVITY: the same record still present passes', () => {
        const v = assertBoundsDidNotRise({
            repoRoot: '.',
            baseRef: 'abc',
            git: at(budget, { exceptions: [grant()] }),
            headBounds: boundsFrom(budget, { exceptions: [grant()] }) ?? {},
        });
        expect(v.ok).toBe(true);
    });

    it('an enlarged grant and a raised watermark are each refused with their own reason', () => {
        const enlarged = assertBoundsDidNotRise({
            repoRoot: '.',
            baseRef: 'abc',
            git: at(budget, { exceptions: [grant()] }),
            headBounds: boundsFrom(budget, { exceptions: [grant({ granted_tokens: 900 })] }) ?? {},
        });
        expect(enlarged.violations.join(' ')).toMatch(/had its grant rose from 300 to 900/);

        const laundered = assertBoundsDidNotRise({
            repoRoot: '.',
            baseRef: 'abc',
            git: at(budget, { exceptions: [grant()] }),
            headBounds: boundsFrom(budget, { exceptions: [grant({ watermark: 999_999 })] }) ?? {},
        });
        expect(laundered.violations.join(' ')).toMatch(/watermark rose/);
        expect(laundered.violations.join(' ')).toMatch(/launders/);
    });

    it('a NEW grant id is not a rise — the break-glass path working', () => {
        const v = assertBoundsDidNotRise({
            repoRoot: '.',
            baseRef: 'abc',
            git: at(budget, { exceptions: [] }),
            headBounds: boundsFrom(budget, { exceptions: [grant()] }) ?? {},
        });
        expect(v.ok).toBe(true);
    });
});

describe('the base reading fails CLOSED when the run requires it', () => {
    const opts = { designCeiling: DESIGN, basePayload: null, headPayload: 1, baseNote: 'shallow clone', today: TODAY };

    it('advisory skips with a stated reason; enforcing refuses on the same input', () => {
        const advisory = computeCeiling(opts);
        expect(advisory.ok).toBe(true);
        expect(advisory.verified).toBe(false);
        expect(advisory.note).toMatch(/shallow clone/);

        const enforcing = computeCeiling({ ...opts, requireBase: true });
        expect(enforcing.ok).toBe(false);
        expect(enforcing.verified).toBe(false);
        expect(enforcing.violations.join(' ')).toMatch(/ENFORCING/);
        // The refusal must not read as payload growth: that would send an
        // operator to shrink a rule over a fetch problem.
        expect(enforcing.violations.join(' ')).toMatch(/NOT payload growth/);
    });

    it('the fallback bound is never tighter than the design ceiling', () => {
        expect(computeCeiling(opts).ceiling).toBeGreaterThanOrEqual(DESIGN);
    });
});

// ---------------------------------------------------------------------------
// Catalogue exhaustiveness (prerequisite 4c).
// ---------------------------------------------------------------------------

describe('payload outside every measured bucket is refused', () => {
    it('this repository is complete right now', () => {
        const a = auditCatalogue(REPO_ROOT);
        expect(a.findings).toStrictEqual([]);
        // A gate that scanned nothing would be green too — assert it looked.
        expect(a.treesSeen).toBeGreaterThan(5);
        expect(a.filesScanned).toBeGreaterThan(50);
    });

    it('every on-demand classification carries a mechanism, not just a name', () => {
        for (const t of ON_DEMAND_TREES) {
            expect(t.why.length, `${t.dir} needs a reason`).toBeGreaterThan(20);
        }
    });

    it('an unclassified projected tree REDS', () => {
        const root = tmpdir();
        const dir = path.join(root, PROJECTION_ROOT, 'a-new-standing-tree');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'x.md'), '# hello\n', 'utf-8');
        const a = auditCatalogue(root);
        expect(a.findings.join(' ')).toMatch(/classified by nothing/);
        // SENSITIVITY: classify it as on-demand and the same tree is clean.
        fs.rmSync(dir, { recursive: true, force: true });
        fs.mkdirSync(path.join(root, PROJECTION_ROOT, 'commands'), { recursive: true });
        expect(auditCatalogue(root).findings).toStrictEqual([]);
    });

    it('a rule-shaped file outside the rules bucket REDS', () => {
        const root = tmpdir();
        const dir = path.join(root, PROJECTION_ROOT, 'guidelines');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, 'sneaky.md'),
            '---\ntype: "always"\ndescription: standing payload in the wrong bucket\n---\n\nbody\n',
            'utf-8',
        );
        expect(auditCatalogue(root).findings.join(' ')).toMatch(/rule frontmatter but sits outside/);
        // SENSITIVITY: the same file without the rule `type:` is ordinary prose.
        fs.writeFileSync(path.join(dir, 'sneaky.md'), '---\ndescription: a guideline\n---\n\nbody\n', 'utf-8');
        expect(auditCatalogue(root).findings).toStrictEqual([]);
    });

    it('a missing projection root is a finding, never a silent green', () => {
        expect(auditCatalogue(tmpdir()).findings.join(' ')).toMatch(/could not be read/);
    });
});

// ---------------------------------------------------------------------------
// The shipped ledger.
// ---------------------------------------------------------------------------

describe('the shipped exceptions ledger', () => {
    const file = path.join(REPO_ROOT, EXCEPTIONS_CONFIG_PATH);

    it('parses, and is empty — the ordinary path needs no grant', () => {
        const r = readExceptions(file);
        expect(r.errors).toStrictEqual([]);
        expect(r.exceptions).toStrictEqual([]);
    });

    it('an absent ledger is not an error — it is a repository with no grants', () => {
        const r = readExceptions(path.join(tmpdir(), 'nope.json'));
        expect(r.errors).toStrictEqual([]);
        expect(r.exceptions).toStrictEqual([]);
    });

    it('a malformed ledger is an ERROR, never an implicit empty one', () => {
        const root = tmpdir();
        const f = path.join(root, 'ex.json');
        fs.writeFileSync(f, '{ not json', 'utf-8');
        expect(readExceptions(f).errors.join(' ')).toMatch(/not readable as JSON/);
        // An unreadable ledger read as "no exceptions" would stop pinning the
        // base to a watermark, which is permissive in exactly the wrong place.
        fs.writeFileSync(f, JSON.stringify({ exceptions: [{ id: 'x' }] }), 'utf-8');
        const errs = readExceptions(f).errors.join(' ');
        expect(errs).toMatch(/granted_tokens/);
        expect(errs).toMatch(/approval_event/);
    });

    it('a duplicate id is rejected — an id is the record identity the ratchet keys on', () => {
        const root = tmpdir();
        const f = path.join(root, 'ex.json');
        fs.writeFileSync(f, JSON.stringify({ exceptions: [grant(), grant()] }), 'utf-8');
        expect(readExceptions(f).errors.join(' ')).toMatch(/duplicate id/);
    });
});

// A real git fixture, because the deletion check and the base reading both
// claim things about what `git` returns rather than about our own parsing.
describe('end to end over a real repository', () => {
    function git(args: readonly string[], cwd: string): void {
        execFileSync('git', [...args], { cwd, stdio: 'ignore' });
    }

    it('a ref that predates the ledger contributes no exception bounds', () => {
        const root = tmpdir();
        git(['init', '--quiet'], root);
        git(['config', 'core.hooksPath', path.join(root, '.no-hooks')], root);
        git(['config', 'commit.gpgsign', 'false'], root);
        git(['config', 'user.email', 'fixture@example.com'], root);
        git(['config', 'user.name', 'fixture'], root);
        fs.mkdirSync(path.join(root, 'src', 'config'), { recursive: true });
        fs.writeFileSync(
            path.join(root, 'src', 'config', 'preamble-payload-budget.json'),
            JSON.stringify({ baseline_tokens: 100, headroom_pct: 0 }),
            'utf-8',
        );
        git(['add', '-A'], root);
        git(['commit', '--quiet', '-m', 'before the ledger existed'], root);

        const v = assertBoundsDidNotRise({
            repoRoot: root,
            baseRef: 'HEAD',
            headBounds: { design_ceiling: 100 },
        });
        // The ledger is absent at that ref, which is normal rather than a
        // failure: a ref with no grants has no grants to protect.
        expect(v.ok).toBe(true);
        expect(v.verified).toBe(true);
        expect(v.baseBounds).toStrictEqual({ design_ceiling: 100 });
    });
});
