#!/usr/bin/env tsx
/**
 * A projected rule may not route somewhere the projection does not contain.
 *
 * Two halves, deliberately graded differently because the evidence differs.
 *
 * **A — `routes_to: guideline:<slug>` (HARD).** A rule that declares a routed
 * body owes a body a consumer can open. Until the `docs/guidelines/` lane
 * shipped (`_lib/guidelines_lane.ts`) every one of these was declared and dead;
 * the measurement on the tree that shipped the lane is **22 distinct targets,
 * 0 unresolved**, so the honest grade is a hard fail — there is no debt to
 * ratchet down and a violation is a new one.
 *
 * **B — relative `.md` links (RATCHET, shrink-only).** A projected rule also
 * carries ordinary body links, and 36 of them resolve to nothing inside
 * `dist/agent-src/`. They are NOT a defect this gate can close: every one
 * points at `docs/contracts/` or `agents/settings/policies/`, and neither is
 * projected — `docs/contracts/` deliberately so (three files ship, at their
 * own path), `agents/` because it is this repository's own workspace and does
 * not exist in a consumer at all. Closing them means deciding to project a
 * second tree, which is a different change with a different owner. So the
 * count is pinned and may only fall.
 *
 * What the ratchet actually buys, stated because a floor of 36 looks like a
 * shrug: the guideline half of this population is **zero**, and the gate is
 * what keeps it zero. A regression that re-broke the lane would push 36 → 60+
 * and red immediately.
 *
 * Exit codes: 0 clean · 1 an unresolved `routes_to:` target, or the relative
 * ratchet rose · 2 misuse / unreadable input.
 *
 * Usage:
 *   ./scripts-run src/scripts/check_projected_rule_routes [--root <path>] [--quiet]
 *   ./scripts-run src/scripts/check_projected_rule_routes --self-test
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(HERE, '..', '..');

/** Where the projection puts rules and the guideline bodies they route to. */
const RULES_SUBDIR = path.join('dist', 'agent-src', 'rules');
const GUIDELINES_SUBDIR = path.join('dist', 'agent-src', 'guidelines');

/**
 * Shrink-only floor for half B. Measured 2026-09-09 on the tree that shipped
 * the guidelines lane, by this module's own `REL_LINK_RE` over its own corpus:
 * **262** relative links across the projected rules, **36** of them unresolved,
 * every one under `docs/contracts/` or `agents/`. Lower it when a link is
 * genuinely fixed; never raise it. (The denominator read 256 in a first draft —
 * a hand count, not the gate's. A blind review caught it. The floor was right
 * either way, which is exactly why the wrong denominator could sit there
 * unnoticed: quote the number the code prints.)
 */
export const UNRESOLVED_RELATIVE_FLOOR = 36;

/**
 * Shrink-only floor for the same half, over the GUIDELINE bodies the lane
 * projects. A blind review of the branch that shipped the lane found this
 * population unmeasured and 253 of 268 links dead — the projection carried 120
 * bodies whose own cross-references resolved to nothing, including five in the
 * one file Phase 2 existed for. Repairing the `src/` class in the rewriter took
 * it to 60; the residue is `docs/contracts`, `docs/decisions`, `agents/` and
 * two template placeholders, none of which is a projected tree. The floor is the
 * gate's OWN reading, 44 — an earlier draft said 60 from a hand-written glob
 * that counted the top-level files twice, and a floor above the measurement is
 * a floor that cannot bite.
 *
 * It is a SEPARATE floor from the rules one on purpose: pooling them would let
 * a regression in one population hide behind an improvement in the other, and
 * the two are repaired by different changes.
 */
export const UNRESOLVED_GUIDELINE_FLOOR = 44;

// No `.` in the slug class: with it, a prose mention of the shape
// `guideline:foo.md` was captured as slug `foo.md` and checked against
// `foo.md.md`. No live instance exists, but this half is graded HARD, so the
// first body that spells a reference that way would red CI for a non-defect.
// Blind-review finding.
const ROUTES_TO_RE = /guideline:([A-Za-z0-9][A-Za-z0-9/_-]*)/g;
const REL_LINK_RE = /\]\((\.\.?\/[^)\s#]+\.md)(?:#[^)]*)?\)/g;

export interface RouteFinding {
    file: string;
    message: string;
}

export interface RouteVerdict {
    scanned: number;
    /** Distinct `guideline:` targets seen, resolved or not. */
    targets: number;
    /** Relative `.md` links seen in projected rules. */
    relativeLinks: number;
    unresolvedRelative: number;
    /** The unresolved rule links themselves, so a failure can name them. */
    unresolvedRuleLinks: Array<{ file: string; link: string }>;
    /** The same two counts over the projected guideline bodies. */
    guidelineLinks: number;
    unresolvedGuideline: number;
    findings: RouteFinding[];
}

/** Every `.md` under `dir`, recursively, name-sorted at each level. */
function walkMarkdown(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const out: string[] = [];
    for (const name of fs.readdirSync(dir).sort()) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) out.push(...walkMarkdown(full));
        else if (name.endsWith('.md')) out.push(full);
    }
    return out;
}

/**
 * Rule files, RECURSIVELY, as paths relative to `dir`.
 *
 * Non-recursive in a first draft, which would have silently unscanned a rule in
 * a subdirectory — a gate that reads less than its corpus and reports green is
 * the failure `gate-coverage.yml` exists for. Blind-review finding.
 */
function listRules(dir: string): string[] {
    return walkMarkdown(dir).map((p) => path.relative(dir, p));
}

export function evaluate(root: string = REPO_ROOT, ledger?: GateLedger): RouteVerdict {
    const rulesDir = path.join(root, RULES_SUBDIR);
    const guidelinesDir = path.join(root, GUIDELINES_SUBDIR);
    const findings: RouteFinding[] = [];
    const seenTargets = new Set<string>();
    let scanned = 0;
    let relativeLinks = 0;
    let unresolvedRelative = 0;
    const unresolvedRuleLinks: Array<{ file: string; link: string }> = [];

    const names = listRules(rulesDir);
    ledger?.plan(names);

    for (const name of names) {
        const file = path.join(rulesDir, name);
        const text = fs.readFileSync(file, 'utf-8');
        scanned += 1;
        let failed = 0;

        for (const m of text.matchAll(ROUTES_TO_RE)) {
            const slug = m[1] as string;
            seenTargets.add(slug);
            if (!fs.existsSync(path.join(guidelinesDir, `${slug}.md`))) {
                failed += 1;
                findings.push({
                    file: path.join(RULES_SUBDIR, name),
                    message:
                        `routes to \`guideline:${slug}\`, and ` +
                        `${path.join(GUIDELINES_SUBDIR, `${slug}.md`)} does not exist. ` +
                        `A consumer install cannot open it.`,
                });
            }
        }

        for (const m of text.matchAll(REL_LINK_RE)) {
            relativeLinks += 1;
            const link = m[1] as string;
            if (!fs.existsSync(path.resolve(path.dirname(file), link))) {
                unresolvedRelative += 1;
                unresolvedRuleLinks.push({ file: path.join(RULES_SUBDIR, name), link });
            }
        }

        if (failed > 0) ledger?.fail(name, `${String(failed)} unresolved guideline route(s)`);
        else ledger?.complete(name);
    }

    // The guideline bodies themselves. Walked recursively — the lane preserves
    // `docs/guidelines/`'s own subdirectories, so a flat readdir would miss
    // `agent-infra/` and `php/`, which is most of the corpus.
    let guidelineLinks = 0;
    let unresolvedGuideline = 0;
    for (const file of walkMarkdown(guidelinesDir)) {
        for (const m of fs.readFileSync(file, 'utf-8').matchAll(REL_LINK_RE)) {
            guidelineLinks += 1;
            if (!fs.existsSync(path.resolve(path.dirname(file), m[1] as string))) {
                unresolvedGuideline += 1;
            }
        }
    }

    return {
        scanned,
        targets: seenTargets.size,
        relativeLinks,
        unresolvedRelative,
        unresolvedRuleLinks,
        guidelineLinks,
        unresolvedGuideline,
        findings,
    };
}

// ---------------------------------------------------------------- self-test

/**
 * Plant a minimal projection under a tmp root. `guidelineSlug` is the body that
 * actually exists; `routesTo` is what the rule claims. Passing them equal is the
 * accept case, differing is the reject case.
 */
function plant(
    root: string,
    opts: { routesTo?: string; guidelineSlug?: string; relLink?: string },
): void {
    const rulesDir = path.join(root, RULES_SUBDIR);
    const guidelinesDir = path.join(root, GUIDELINES_SUBDIR);
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.mkdirSync(guidelinesDir, { recursive: true });
    if (opts.guidelineSlug !== undefined) {
        const target = path.join(guidelinesDir, `${opts.guidelineSlug}.md`);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, '# body\n');
    }
    const lines = ['---', 'name: probe'];
    if (opts.routesTo !== undefined) lines.push(`routes_to: guideline:${opts.routesTo}`);
    lines.push('---', '', '# probe', '');
    if (opts.relLink !== undefined) lines.push(`See [body](${opts.relLink}).`);
    fs.writeFileSync(path.join(rulesDir, 'probe.md'), `${lines.join('\n')}\n`);
}

function selfTestCases(): SelfTestCase[] {
    const mk = (
        name: string,
        expect: 'reject' | 'accept',
        opts: { routesTo?: string; guidelineSlug?: string; relLink?: string },
    ): SelfTestCase => ({
        name,
        expect,
        run: () => {
            const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prr-'));
            try {
                plant(root, opts);
                return runGateCli(
                    REPO_ROOT,
                    'src/scripts/check_projected_rule_routes.ts',
                    ['--root', root, '--quiet'],
                    REPO_ROOT,
                );
            } finally {
                fs.rmSync(root, { recursive: true, force: true });
            }
        },
    });
    return [
        mk('routes_to target exists → accept', 'accept', { routesTo: 'x', guidelineSlug: 'x' }),
        mk('routes_to target missing → reject', 'reject', { routesTo: 'x' }),
        mk('routes_to a nested target that exists → accept', 'accept', {
            routesTo: 'agent-infra/x',
            guidelineSlug: 'agent-infra/x',
        }),
        mk('routes_to a nested target that does not → reject', 'reject', {
            routesTo: 'agent-infra/x',
        }),
        // The exact regression the lane exists to prevent: the slug resolves as
        // a bare filename but not under the projected guidelines directory.
        mk('routes_to a slug that only exists outside the projection → reject', 'reject', {
            routesTo: 'design-fidelity-mechanics',
        }),
        mk('no routes_to at all → accept', 'accept', {}),
        // Half B is a ratchet, so a single broken relative link on a tmp root
        // (floor 36, observed 1) must NOT fail — the gate reds on a RISE only.
        mk('one unresolved relative link, far below the floor → accept', 'accept', {
            relLink: '../guidelines/nope.md',
        }),
        mk('a resolving relative link → accept', 'accept', {
            guidelineSlug: 'y',
            relLink: '../guidelines/y.md',
        }),
        mk('both halves clean → accept', 'accept', {
            routesTo: 'y',
            guidelineSlug: 'y',
            relLink: '../guidelines/y.md',
        }),
        mk('a good route plus a bad one in the same rule → reject', 'reject', {
            routesTo: 'missing',
            guidelineSlug: 'present',
        }),
    ];
}

// ---------------------------------------------------------------------- CLI

export function main(argv: string[] = process.argv.slice(2)): number {
    if (argv.includes('--self-test')) {
        return runSelfTest({
            gate: 'check_projected_rule_routes',
            cases: selfTestCases(),
            minCases: 8,
            minRejectCases: 4,
        });
    }
    const quiet = argv.includes('--quiet');
    const ri = argv.indexOf('--root');
    const rootArg = ri !== -1 ? argv[ri + 1] : undefined;
    const root = rootArg !== undefined ? path.resolve(rootArg) : REPO_ROOT;
    // A tmp fixture root has its own tiny corpus, so the shrink-only floor is
    // meaningless there and only the hard half is judged.
    const isFixtureRoot = root !== REPO_ROOT;

    const ledger = new GateLedger('check_projected_rule_routes');
    let v: RouteVerdict;
    try {
        v = evaluate(root, ledger);
    } catch (err) {
        process.stderr.write(`❌  check_projected_rule_routes: ${(err as Error).message}\n`);
        return 2;
    }

    try {
        reportScanned({
            gate: 'check_projected_rule_routes',
            scanned: v.scanned,
            units: 'projected rule(s)',
            roots: [RULES_SUBDIR],
            allowEmpty:
                'EMPTY_VALID: a checkout with no projection yet (pre-`task sync`) has no projected rule to judge',
        });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`❌  check_projected_rule_routes: ${err.message}\n`);
            return 2;
        }
        throw err;
    }

    ledger.report();

    if (v.findings.length > 0) {
        for (const f of v.findings) process.stderr.write(`❌  ${f.file}: ${f.message}\n`);
        process.stderr.write(
            `\n    A projected rule routes to a body the projection does not contain.\n` +
                `    Either the guideline lane dropped it (see src/scripts/_lib/guidelines_lane.ts)\n` +
                `    or the slug is wrong. Run 'task sync' first — the lane writes on sync.\n`,
        );
        return 1;
    }

    if (!isFixtureRoot && v.unresolvedGuideline > UNRESOLVED_GUIDELINE_FLOOR) {
        process.stderr.write(
            `❌  check_projected_rule_routes: unresolved links inside the projected ` +
                `guidelines rose to ${String(v.unresolvedGuideline)}, floor is ` +
                `${String(UNRESOLVED_GUIDELINE_FLOOR)}.\n` +
                `    A guideline body whose own cross-references are dead is a body a\n` +
                `    consumer cannot follow. Most of this class is repaired in\n` +
                `    condense.ts::_rewrite_body_links; the residue points at trees the\n` +
                `    projection does not carry.\n`,
        );
        return 1;
    }

    if (!isFixtureRoot && v.unresolvedRelative > UNRESOLVED_RELATIVE_FLOOR) {
        process.stderr.write(
            `❌  check_projected_rule_routes: unresolved relative links rose to ` +
                `${String(v.unresolvedRelative)}, floor is ${String(UNRESOLVED_RELATIVE_FLOOR)}.\n` +
                `    This ratchet is shrink-only. Fix the link, or — if a whole tree became\n` +
                `    projectable — lower UNRESOLVED_RELATIVE_FLOOR in the same commit.\n`,
        );
        // Name them. An aggregate the operator cannot act on is half a finding,
        // and `evaluate` already holds every path — it used to count and throw
        // them away. Blind-review finding.
        for (const u of v.unresolvedRuleLinks) {
            process.stderr.write(`      ${u.file} → ${u.link}\n`);
        }
        return 1;
    }

    if (!quiet) {
        process.stdout.write(
            `✅  every projected rule's guideline route resolves ` +
                `(${String(v.scanned)} rule(s), ${String(v.targets)} distinct target(s); ` +
                `${String(v.unresolvedRelative)}/${String(v.relativeLinks)} rule links unresolved, ` +
                `floor ${String(UNRESOLVED_RELATIVE_FLOOR)}; ` +
                `${String(v.unresolvedGuideline)}/${String(v.guidelineLinks)} guideline links unresolved, ` +
                `floor ${String(UNRESOLVED_GUIDELINE_FLOOR)}).\n`,
        );
    }
    return 0;
}

if (process.env['GATE_SELF_TEST_CHILD'] !== '1' || process.argv.includes('--root')) {
    if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
        process.exit(main());
    }
}
