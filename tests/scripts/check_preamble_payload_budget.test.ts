// The per-spawn preamble payload ratchet (road-to-cache-economy Phase 3).
//
// A gate that cannot fail is worse than no gate — it trains the reader to skip
// the line. So these tests pin BOTH directions: within budget passes, growth
// past the headroom fails, and a budget file that cannot be parsed is a misuse
// exit rather than a silent pass.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    boundsRefusalHeader,
    evaluate,
    hostPayloadIds,
    hostPayloadRoots,
    main,
    measureHostPayload,
    readBudget,
    renderBounds,
} from '../../src/scripts/check_preamble_payload_budget.js';

/** Repo root, resolved the way the gate resolves it. */
const REPO_ROOT_FOR_TESTS = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '..',
    '..',
);

/** Hosts whose rules surface is generated, with the path that proves presence. */
const HOST_IDS_WITH_NO_TREE = [
    { host: 'windsurf', probe: '.windsurf/rules' },
    { host: 'gemini-cli', probe: 'GEMINI.md' },
] as const;

const tmps: string[] = [];

function tmpdir(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'payload-budget-'));
    tmps.push(d);
    return d;
}

afterEach(() => {
    while (tmps.length) fs.rmSync(tmps.pop() as string, { recursive: true, force: true });
});

/** A minimal repo shape: the three gated buckets and nothing else. */
function fakeRepo(ruleBodies: string[], skillCount = 0): string {
    const root = tmpdir();
    const rules = path.join(root, 'dist', 'agent-src', 'rules');
    fs.mkdirSync(rules, { recursive: true });
    ruleBodies.forEach((body, i) => fs.writeFileSync(path.join(rules, `r${i}.md`), body, 'utf-8'));
    const skills = path.join(root, 'dist', 'agent-src', 'skills');
    fs.mkdirSync(skills, { recursive: true });
    for (let i = 0; i < skillCount; i++) {
        const dir = path.join(skills, `s${i}`);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, 'SKILL.md'),
            `---\nname: s${i}\ndescription: description for skill ${i}\n---\n\nbody\n`,
            'utf-8',
        );
    }
    fs.writeFileSync(path.join(root, 'CLAUDE.md'), '# project\n', 'utf-8');
    return root;
}

function budgetFile(baseline: number, headroomPct: number): string {
    const dir = tmpdir();
    const file = path.join(dir, 'budget.json');
    fs.writeFileSync(
        file,
        JSON.stringify({ baseline_tokens: baseline, headroom_pct: headroomPct, target_tokens: { median: 1, p95: 2 } }),
        'utf-8',
    );
    return file;
}

describe('preamble payload ratchet', () => {
    it('passes when the payload equals the baseline', () => {
        const repo = fakeRepo(['x'.repeat(4000)]);
        const measured = evaluate(repo, budgetFile(100000, 5)).measured;
        // Baseline derived from the fixture's own measurement, not a literal.
        const verdict = evaluate(repo, budgetFile(measured, 5));
        expect(verdict.withinBudget).toBe(true);
        expect(verdict.measured).toBe(measured);
    });

    it('passes growth that stays inside the headroom', () => {
        const repo = fakeRepo(['x'.repeat(4000)]);
        const measured = evaluate(repo, budgetFile(1, 0)).measured;
        // 10% headroom over a baseline 5% below the measurement -> still inside.
        const verdict = evaluate(repo, budgetFile(Math.round(measured * 0.95), 10));
        expect(verdict.withinBudget).toBe(true);
    });

    it('FAILS when the payload grows past the headroom', () => {
        const repo = fakeRepo(['x'.repeat(4000)]);
        const measured = evaluate(repo, budgetFile(1, 0)).measured;
        const verdict = evaluate(repo, budgetFile(Math.round(measured * 0.5), 5));
        expect(verdict.withinBudget).toBe(false);
        expect(verdict.ceiling).toBeLessThan(verdict.measured);
    });

    it('counts every gated bucket, so a skill-description flood is caught too', () => {
        const lean = evaluate(fakeRepo(['x'.repeat(400)], 1), budgetFile(1, 0)).measured;
        const heavy = evaluate(fakeRepo(['x'.repeat(400)], 40), budgetFile(1, 0)).measured;
        expect(heavy).toBeGreaterThan(lean);
    });

    it('excludes the user scope — the gate must be machine-independent', () => {
        const repo = fakeRepo(['x'.repeat(400)]);
        const a = evaluate(repo, budgetFile(1, 0)).measured;
        // A user-scope rules directory inside the fixture must not change the number.
        const userRules = path.join(repo, '.claude', 'rules');
        fs.mkdirSync(userRules, { recursive: true });
        fs.writeFileSync(path.join(userRules, 'huge.md'), 'y'.repeat(80000), 'utf-8');
        expect(evaluate(repo, budgetFile(1, 0)).measured).toBe(a);
    });

    it('rejects a budget file whose numbers are missing rather than passing silently', () => {
        const dir = tmpdir();
        const file = path.join(dir, 'bad.json');
        fs.writeFileSync(file, JSON.stringify({ headroom_pct: 5 }), 'utf-8');
        expect(() => readBudget(file)).toThrow(/baseline_tokens/u);
    });

    it('ships a real budget file that parses', () => {
        const budget = readBudget();
        expect(budget.baseline_tokens).toBeGreaterThan(0);
        expect(budget.headroom_pct).toBeGreaterThanOrEqual(0);
    });
});

/**
 * road-to-standing-payload-truth 1.1 — the gate is armed in CI behind a grace
 * ceiling, and these are the two properties that arming rests on.
 */
describe('the measurement is a deterministic census, not a sample', () => {
    it('two runs on the same checkout return identical totals', () => {
        // The invariant the council required before a single CI run may fail a
        // build: "per-spawn" describes where the cost is PAID, not sampling.
        // Variation here would be a checker defect, never budget noise — so this
        // test is what makes the single-sample objection answerable rather than
        // merely denied.
        const a = evaluate();
        const b = evaluate();
        expect(b.measured).toBe(a.measured);
        expect(b.buckets.map((x) => [x.name, x.tokens, x.files])).toEqual(
            a.buckets.map((x) => [x.name, x.tokens, x.files]),
        );
    });

    it('every bucket is sourced from the checkout, so nothing machine-local leaks in', () => {
        // A bucket reading a user-local path would make the census non-reproducible
        // across machines while staying stable on one — the failure a same-process
        // repeat cannot see.
        for (const b of evaluate().buckets) {
            expect(b.files, `${b.name} must read at least one file`).toBeGreaterThan(0);
        }
    });
});

/**
 * `ci_delivery` straight off disk — the same read the CI step performs.
 *
 * `grace_end_date` is deliberately absent from this type. The key was deleted
 * on 2026-09-10 (ADR-274) because nothing enforced it: it was read in exactly
 * two places, an `echo` in the workflow and the return type of THIS helper, and
 * the gate carries no date logic, so the concession never expired and the design
 * ceiling never became operative on the date the config advertised. Typing a
 * field nobody reads is how that fiction survived a year of review, so the
 * removal is pinned below rather than merely performed.
 */
function rawCiDelivery(): { grace_ceiling: number; posture: string } {
    const raw = JSON.parse(
        fs.readFileSync(path.join('src', 'config', 'preamble-payload-budget.json'), 'utf-8'),
    ) as { ci_delivery: { grace_ceiling: number; posture: string } };
    return raw.ci_delivery;
}

/** The two files that used to carry the unenforced expiry, read as text. */
function readText(...rel: string[]): string {
    return fs.readFileSync(path.join(REPO_ROOT_FOR_TESTS, ...rel), 'utf-8');
}

describe('the grace ceiling is enforced and undated', () => {
    it('carries no grace_end_date key', () => {
        // The regression pin. A future edit that reintroduces the key without
        // also building the expiry recreates exactly the defect ADR-274 removed:
        // a date the config states and no code reads.
        expect(Object.keys(rawCiDelivery())).not.toContain('grace_end_date');
    });

    it('no consumer reads a grace_end_date, so none can go stale against one', () => {
        // Sensitivity is the point: this assertion is what fails if someone puts
        // the key back in the workflow's shell block. It reads the workflow and
        // the taskfile as TEXT because that is where the only two reads lived.
        expect(readText('.github', 'workflows', 'standing-payload-delta.yml')).not.toContain(
            "['grace_end_date']",
        );
        expect(readText('taskfiles', 'ci-fast.yml')).not.toContain("['grace_end_date']");
    });

    it('still carries the ceiling the CI step passes, and it is above the design number', () => {
        // Deleting the date must not have loosened the bound. What the ceiling
        // DOES is asserted where that behaviour already lives and is not
        // duplicated here: `the gate reds on growth past whichever ceiling
        // applies` below owns the exit codes (and carries the caveat that a
        // future reduction inverts one of them), and `the --ceiling override may
        // only ever be LOOSER` owns the override direction. Re-asserting either
        // would split one property across two places, and the copy would be the
        // one without the caveat.
        const grace = rawCiDelivery().grace_ceiling;
        expect(typeof grace, 'ci_delivery.grace_ceiling must exist').toBe('number');
        expect(grace).toBeGreaterThan(
            Math.round(readBudget().baseline_tokens * (1 + readBudget().headroom_pct / 100)),
        );
    });
});

describe('the --ceiling override may only ever be LOOSER', () => {
    const design = (): number => {
        const b = readBudget();
        return Math.round(b.baseline_tokens * (1 + b.headroom_pct / 100));
    };

    it('no override keeps the design ceiling', () => {
        expect(evaluate().ceiling).toBe(design());
    });

    it('a LOOSER override is honoured — the grace ceiling', () => {
        const loose = design() + 30_000;
        expect(evaluate(undefined, undefined, loose).ceiling).toBe(loose);
    });

    it('a TIGHTER override is IGNORED, not honoured', () => {
        // Backwards-looking for one line and deliberate: honouring a tighter value
        // would let a caller silently lower the bar this budget file owns. The
        // design ceiling stays the authority; the override is a dated concession.
        expect(evaluate(undefined, undefined, 1).ceiling).toBe(design());
        expect(evaluate(undefined, undefined, design() - 1).ceiling).toBe(design());
    });

    it('a non-numeric override is ignored rather than coerced to 0', () => {
        expect(evaluate(undefined, undefined, Number.NaN).ceiling).toBe(design());
    });

    it('the CI grace ceiling in the budget file is looser than the design ceiling', () => {
        // If a future edit tightened grace_ceiling below the design number, the
        // override would silently stop applying and the CI step would go red for a
        // reason nobody wrote down. Pin the relationship, not the value.
        //
        // Read from the raw JSON, not `readBudget()`: that reader returns only the
        // three fields the ratchet needs, so `ci_delivery` is not on its type — a
        // deliberate narrowness, and the CI step reads the raw file for the same
        // reason.
        const grace = rawCiDelivery().grace_ceiling;
        expect(typeof grace, 'ci_delivery.grace_ceiling must exist').toBe('number');
        expect(grace).toBeGreaterThan(design());
    });
});

describe('the gate reds on growth past whichever ceiling applies', () => {
    it('exits non-zero at the design ceiling on the current tree', () => {
        // Sensitivity, stated as the honest fact it is: HEAD is over the design
        // ceiling today, so this asserts the gate is RED right now. When a
        // reduction lands this flips and the assertion must be inverted with the
        // measurement recorded — it is not a permanent expectation.
        expect(main([])).not.toBe(0);
    });

    it('exits 0 under the grace ceiling the CI step passes', () => {
        expect(main(['--ceiling', String(rawCiDelivery().grace_ceiling)])).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// The additive host reading (AI council 2026-09-09, option 1A).
//
// The property that matters most is the NEGATIVE one: adding a second reading
// must not move the first. A test that only checks the new number would pass
// even if the host flag had quietly redirected the ratchet — which is the
// failure mode the council chose 1A specifically to avoid.
// ---------------------------------------------------------------------------

/** A repo shape carrying BOTH a projection source and a claude-code host tree. */
function fakeRepoWithHostTree(sourceRules: string[], hostRules: string[]): string {
    const root = tmpdir();
    const src = path.join(root, 'dist', 'agent-src', 'rules');
    fs.mkdirSync(src, { recursive: true });
    sourceRules.forEach((b, i) => fs.writeFileSync(path.join(src, `r${i}.md`), b, 'utf-8'));
    fs.mkdirSync(path.join(root, 'dist', 'agent-src', 'skills'), { recursive: true });
    const host = path.join(root, '.claude', 'rules');
    fs.mkdirSync(host, { recursive: true });
    hostRules.forEach((b, i) => fs.writeFileSync(path.join(host, `h${i}.md`), b, 'utf-8'));
    fs.mkdirSync(path.join(root, '.claude', 'skills'), { recursive: true });
    fs.writeFileSync(path.join(root, 'CLAUDE.md'), '# project\n', 'utf-8');
    return root;
}

// `.claude/rules` and `.claude/skills` are GENERATED and untracked (`git
// ls-files .claude/rules` returns nothing), so a clean CI checkout has no host
// tree at all and `--host claude-code` correctly refuses with exit 2. That is
// not a weaker environment to be worked around — it is the documented refusal,
// and a test that assumed the tree exists went red in CI while passing on every
// maintainer machine. Both branches are real, so both are asserted, and which
// one runs is decided by the tree rather than by a guess about the environment.
const hostTreeExists = fs.existsSync(path.join(REPO_ROOT_FOR_TESTS, '.claude', 'rules'));

describe('the host reading is additive and never moves the ratchet', () => {
    it('the source verdict is byte-identical with and without a host flag', () => {
        // The load-bearing assertion of option 1A. `evaluate` is the source
        // reading; nothing about a host argument may reach it.
        const ceiling = String(rawCiDelivery().grace_ceiling);
        const before = evaluate();
        expect(main(['--ceiling', ceiling])).toBe(0);
        // With a host tree: the exit code must be IDENTICAL. Without one: the
        // documented refusal, which is exit 2 and never a silent 0.
        expect(main(['--host', 'claude-code', '--ceiling', ceiling])).toBe(hostTreeExists ? 0 : 2);
        const after = evaluate();
        expect(after.measured).toBe(before.measured);
        expect(after.ceiling).toBe(before.ceiling);
        expect(after.buckets).toStrictEqual(before.buckets);
    });

    it('a host tree far SMALLER than the source does not make the gate pass', () => {
        // The sabotage direction, and the one test here with PROVEN sensitivity.
        // Verified 2026-09-09 by neutralising the mechanism: routing the host
        // total into verdict.withinBudget and decision.ok turns this case RED
        // (1 failed | 31 passed) and restoring it turns it green (32 passed).
        //
        // Stated because the sibling test above does NOT have that property: it
        // compares evaluate() either side of a main() call, and evaluate() is
        // untouched by any sabotage in main, so a first probe left all 32 green.
        // This is the assertion that would actually catch a host flag quietly
        // redirecting the gated surface.
        const overBudget = main([]);
        expect(overBudget, 'HEAD is over the design ceiling today').not.toBe(0);
        if (!hostTreeExists) {
            // No tree to be smaller — the refusal is the property here, and it
            // is asserted rather than skipped so this case is never vacuous.
            expect(main(['--host', 'claude-code'])).toBe(2);
            return;
        }
        expect(main(['--host', 'claude-code'])).toBe(overBudget);
    });

    it('a host id whose tree was never projected REFUSES rather than reporting zero', () => {
        // The property that makes the branch above safe: an unprojected tree is
        // exit 2, so a missing host tree can never be read as a tiny one. This
        // case runs identically on a maintainer machine and in CI.
        const neverProjected = HOST_IDS_WITH_NO_TREE.find(
            (id) => !fs.existsSync(path.join(REPO_ROOT_FOR_TESTS, id.probe)),
        );
        if (neverProjected === undefined) return; // every tree present locally
        expect(main(['--host', neverProjected.host])).toBe(2);
    });
});

describe('host id resolution comes from HOST_SURFACES, not a local path map', () => {
    it('every declared host resolves to a rules-bearing root', () => {
        for (const id of hostPayloadIds()) {
            const roots = hostPayloadRoots(id);
            expect(roots.rules, `${id} must name a rules root`).toBeTruthy();
            expect(roots.rules.endsWith('/commands'), `${id} must not measure commands`).toBe(false);
            expect(roots.rules.endsWith('/skills'), `${id} rules root must not be the skills tree`).toBe(false);
        }
    });

    it('claude-code alone carries the CLAUDE.md hierarchy', () => {
        expect(hostPayloadRoots('claude-code').claudeMd).toBe(true);
        for (const id of hostPayloadIds().filter((h) => h !== 'claude-code')) {
            expect(hostPayloadRoots(id).claudeMd, `${id} must not claim CLAUDE.md`).toBe(false);
        }
    });

    it('an unknown host throws and names the known set', () => {
        expect(() => hostPayloadRoots('not-a-host')).toThrow(/unknown host/);
        expect(() => hostPayloadRoots('not-a-host')).toThrow(/claude-code/);
    });

    it('the id set is non-empty — a registry read as empty would measure nothing', () => {
        expect(hostPayloadIds().length).toBeGreaterThan(0);
        expect(hostPayloadIds()).toContain('claude-code');
    });
});

describe('the host measurement and its completeness flag', () => {
    it('measures the host tree, not the source tree', () => {
        const root = fakeRepoWithHostTree(['x'.repeat(8000)], ['y'.repeat(400)]);
        const host = measureHostPayload(root, { host: 'claude-code' });
        // 400 chars of host body, not 8000 of source. A rules census counts the
        // file bodies, so the host total is bounded well under the source size.
        expect(host.total).toBeLessThan(500);
        expect(host.rules_path).toBe('.claude/rules');
        expect(host.host).toBe('claude-code');
    });

    it('flags a PARTIAL tree when the host holds fewer rule files than the source', () => {
        const root = fakeRepoWithHostTree(['a', 'b', 'c', 'd'], ['a']);
        const c = measureHostPayload(root, { host: 'claude-code' }).completeness;
        expect(c.host_rule_files).toBe(1);
        expect(c.source_rule_files).toBe(4);
        expect(c.complete).toBe(false);
    });

    it('reports complete when the host tree carries every source rule', () => {
        const root = fakeRepoWithHostTree(['a', 'b'], ['a', 'b']);
        expect(measureHostPayload(root, { host: 'claude-code' }).completeness.complete).toBe(true);
    });

    it('a rules root that does not exist REFUSES rather than reporting zero', () => {
        // Zero tokens and a tiny tree are the same number and completely
        // different facts, so an absent root is an error and not a green.
        const root = fakeRepoWithHostTree(['a'], ['a']);
        expect(() => measureHostPayload(root, { rulesDirOverride: 'nope/missing' })).toThrow(
            /does not exist/,
        );
    });

    it('an explicit rules-dir override reports no host id', () => {
        const root = fakeRepoWithHostTree(['a'.repeat(1000)], ['b'.repeat(2000)]);
        const host = measureHostPayload(root, { rulesDirOverride: '.claude/rules' });
        expect(host.host).toBeNull();
        expect(host.rules_path).toBe('.claude/rules');
        // Override path measures the rules root only — no skills, no CLAUDE.md,
        // because an undeclared tree has no declared siblings to infer.
        expect(host.buckets.length).toBe(1);
    });
});

describe('the host flags reject every ambiguous invocation with exit 2', () => {
    it('--host and --project-rules-dir together are a usage error', () => {
        expect(main(['--host', 'claude-code', '--project-rules-dir', '.claude/rules'])).toBe(2);
    });

    it('--host with no value is a usage error', () => {
        expect(main(['--host'])).toBe(2);
    });

    it('--host swallowing the next flag is a usage error, not a silent host named --json', () => {
        expect(main(['--host', '--json'])).toBe(2);
    });

    it('--project-rules-dir with no value is a usage error', () => {
        expect(main(['--project-rules-dir'])).toBe(2);
    });

    it('an unknown host is exit 2, never a pass', () => {
        expect(main(['--host', 'not-a-host'])).toBe(2);
    });
});

/**
 * The rendered text, at the layer the lib-level tests skip.
 *
 * A completion review found that the enforcing refusal printed as a ceiling
 * RISE on both stdout and stderr, and named why the five new lib tests had not
 * caught it: they call `assertBoundsDidNotRise` directly and never reach
 * `renderBounds` or the stderr header. A refusal whose message sends the reader
 * to shrink a rule over a fetch problem costs operator time on every red run,
 * so the message is asserted here rather than left to inspection.
 */
describe('--require-base — the refusal says which refusal it is', () => {
    const risen = {
        ok: false, verified: true, violations: ['rose from 1 to 2'],
        baseGraceCeiling: 1, baseRef: 'abc', note: null,
    };
    const unverifiable = {
        ok: false, verified: false, violations: ['no base ref resolved'],
        baseGraceCeiling: null, baseRef: null, note: 'no base ref resolved, so …',
    };

    it('the stdout line names UNVERIFIED, never ROSE, when the bound was unreadable', () => {
        expect(renderBounds(risen)).toMatch(/ROSE/);
        expect(renderBounds(unverifiable)).toMatch(/UNVERIFIED/);
        expect(renderBounds(unverifiable)).not.toMatch(/ROSE/);
    });

    it('the stderr header does not claim a rise that did not happen', () => {
        expect(boundsRefusalHeader(risen)).toMatch(/ceiling rose in this change/);
        expect(boundsRefusalHeader(unverifiable)).toMatch(/could not be VERIFIED/);
        expect(boundsRefusalHeader(unverifiable)).not.toMatch(/rose/);
    });

    it('a verified pass is unchanged in both', () => {
        const clean = {
            ok: true, verified: true, violations: [],
            baseGraceCeiling: 5, baseRef: 'abc', note: null,
        };
        expect(renderBounds(clean)).toMatch(/\bok\b/);
        expect(renderBounds(clean)).not.toMatch(/ROSE|UNVERIFIED/);
    });
});
