#!/usr/bin/env tsx
/**
 * Pack-conformance fixture harness — a third party's answer to "will my pack pass?"
 *
 * WHAT THIS PROVES, AND WHAT IT DOES NOT. Six pack-fitness invariants exist as
 * six independent gates. Only THREE of them can be checked against a fixture
 * tree today, and the limit is a contract rather than an effort gap:
 *
 *   fixture-provable                      | blocked by
 *   --------------------------------------|-------------------------------------
 *   lint_pack_boundaries      (tree)      | —  exports `_set_paths_for_test`
 *   lint_rule_skill_pack_reach (tree)     | —  accepts `--root <dir>`
 *   lint_pack_risk_class      (predicate) | —  exports `riskClassViolations()`
 *   lint_pack_dependencies                | `main()` takes no argv; the pack home
 *                                         | is derived from `import.meta.url`
 *   lint_pack_first_win                   | its CLI contract PINS "ignores argv
 *                                         | entirely" (ADR-200 port fidelity)
 *   prove_pack_extractable                | `prove(pack)` resolves a pack BY NAME
 *                                         | under the real `src/packs/`
 *
 * A partial temp-tree copy cannot substitute: four of the six carry dead-scope
 * assertions, so a skeleton holding only the fixture exits 2 ("scanned 0"), not
 * 0. Only a full tree copy per twin would satisfy them.
 *
 * This harness therefore reports PARTIAL conformance and says so in its own
 * output and in the document it generates. The retrofit that would close the gap
 * is carried as a follow-up, with a narrow ADR-200 amendment as its explicit
 * prerequisite. Decision: AI council 2026-08-23, verdict (s), 2 of 2 convergent
 * after a 1–1 split on (a) vs (b).
 *
 * THE FIXTURE IS LAYOUT-NEUTRAL DATA. The two tree-level gates expect DIFFERENT
 * roots — boundaries wants `<root>/{packs.yml,skills,rules}`, reach wants
 * `<root>/src/{rules,skills}` plus `<root>/src/config/discovery/packs.yml` — so
 * the canonical fixture is stored once and projected per gate.
 *
 * Exit codes:
 *   0 — the conformant fixture passes every provable gate AND every twin reds
 *       exactly its own gate
 *   1 — a conformance expectation was violated
 *   2 — the gate could not run (missing fixture, bad args)
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const SELF = 'src/scripts/check_pack_conformance_fixture.ts';

const SELF_TEST_MIN_CASES = 4;
const SELF_TEST_MIN_REJECT = 2;

/** Repo-relative home of the committed fixture. */
const FIXTURE_REL = path.join('tests', 'fixtures', 'pack-conformance');

/** Generated document. Regenerating on an unchanged tree must be a no-op. */
const DOC_REL = path.join('docs', 'contracts', 'pack-conformance.md');

/** The three gates a fixture can drive, and the three it cannot. */
type Mechanism = 'fixture-tree' | 'fixture-predicate' | 'real-tree-only';

interface GateSpec {
    id: string;
    invariant: string;
    mechanism: Mechanism;
    /** For `real-tree-only`: the exact contract that blocks a fixture, and why. */
    blockedBy?: string;
}

const GATES: readonly GateSpec[] = [
    {
        id: 'lint_pack_boundaries',
        invariant: 'a markdown link may not cross into a pack the source pack does not require',
        mechanism: 'fixture-tree',
    },
    {
        id: 'lint_rule_skill_pack_reach',
        invariant: 'a rule and the skills it routes to must arrive in the same pack-legal install',
        mechanism: 'fixture-tree',
    },
    {
        id: 'lint_pack_risk_class',
        invariant: 'risk_class: high ⇒ default_install: false AND requires_explicit_consent: true AND surface_tier: lab',
        mechanism: 'fixture-predicate',
    },
    {
        id: 'lint_pack_dependencies',
        invariant: 'the pack dependency graph is acyclic and every declared pack exists',
        mechanism: 'real-tree-only',
        blockedBy:
            '`main()` accepts no argv and the pack home is derived from `import.meta.url`. ' +
            'Effort-level, not design-level: nothing states the absence is intended.',
    },
    {
        id: 'lint_pack_first_win',
        invariant: 'a pack may not shadow an artefact another pack already wins',
        mechanism: 'real-tree-only',
        blockedBy:
            'the gate\'s CLI contract PINS argv-ignoring behaviour — its own header reads ' +
            '"the CLI contract is pinned — `main()` IGNORES argv entirely". Design-level: ' +
            'a port-fidelity guarantee from ADR-200, so a fixture seam needs that record amended.',
    },
    {
        id: 'prove_pack_extractable',
        invariant: 'a pack plus its declared closure is self-contained and liftable out',
        mechanism: 'real-tree-only',
        blockedBy:
            '`prove(pack)` resolves a pack BY NAME under the real `src/packs/`, so a fixture ' +
            'would have to be a real pack. Effort-level, but it changes an exported signature ' +
            'two tests already use.',
    },
];

/** Every twin, and the ONE gate it must red. */
interface Twin {
    dir: string;
    reds: string;
    what: string;
}

const TWINS: readonly Twin[] = [
    {
        dir: 'undeclared-cross-pack-link',
        reds: 'lint_pack_boundaries',
        what: 'the requires edge is dropped, so a skill link crosses an undeclared boundary',
    },
    {
        dir: 'unreachable-route',
        reds: 'lint_rule_skill_pack_reach',
        what: 'the requires edge is dropped, so a rule routes to a skill its install cannot receive',
    },
    {
        dir: 'high-risk-default-install',
        reds: 'lint_pack_risk_class',
        what: 'a risk_class: high pack ships default-on, consent-free, at a non-lab tier',
    },
];

// ── fixture materialisation ────────────────────────────────────────────────

function _copyTree(from: string, to: string): void {
    for (const e of fs.readdirSync(from, { withFileTypes: true })) {
        const src = path.join(from, e.name);
        const dst = path.join(to, e.name);
        if (e.isDirectory()) {
            fs.mkdirSync(dst, { recursive: true });
            _copyTree(src, dst);
        } else {
            fs.mkdirSync(path.dirname(dst), { recursive: true });
            fs.copyFileSync(src, dst);
        }
    }
}

/**
 * Materialise `conformant/`, then lay a twin overlay on top of it.
 *
 * The overlay REPLACES same-named files rather than merging them, which is why
 * each twin ships a full `packs.yml` and a full copy of any artefact it changes.
 * A merge would make a twin's effect depend on merge semantics rather than on
 * the file a reviewer can read.
 */
function _canonical(root: string, twin: string | null): string {
    const out = path.join(root, 'canonical');
    fs.mkdirSync(out, { recursive: true });
    _copyTree(path.join(DEFAULT_ROOT, FIXTURE_REL, 'conformant'), out);
    if (twin !== null) {
        _copyTree(path.join(DEFAULT_ROOT, FIXTURE_REL, 'twins', twin), out);
    }
    return out;
}

/** Project the canonical fixture into `lint_pack_boundaries`' expected layout. */
function _asBoundariesRoot(canonical: string, root: string): string {
    const out = path.join(root, 'boundaries');
    fs.mkdirSync(out, { recursive: true });
    fs.copyFileSync(path.join(canonical, 'packs.yml'), path.join(out, 'packs.yml'));
    for (const d of ['skills', 'rules']) {
        const from = path.join(canonical, d);
        if (fs.existsSync(from)) {
            fs.mkdirSync(path.join(out, d), { recursive: true });
            _copyTree(from, path.join(out, d));
        }
    }
    return fs.realpathSync(out);
}

/** Project the canonical fixture into `lint_rule_skill_pack_reach`'s layout. */
function _asReachRoot(canonical: string, root: string): string {
    const out = path.join(root, 'reach');
    const packsFile = path.join(out, 'src', 'config', 'discovery', 'packs.yml');
    fs.mkdirSync(path.dirname(packsFile), { recursive: true });
    fs.copyFileSync(path.join(canonical, 'packs.yml'), packsFile);
    for (const d of ['skills', 'rules']) {
        const from = path.join(canonical, d);
        if (fs.existsSync(from)) {
            fs.mkdirSync(path.join(out, 'src', d), { recursive: true });
            _copyTree(from, path.join(out, 'src', d));
        }
    }
    return fs.realpathSync(out);
}

// ── running the three provable gates ───────────────────────────────────────

export interface GateOutcome {
    gate: string;
    exit: number;
    detail: string;
}

async function _runBoundaries(canonical: string, tmp: string): Promise<GateOutcome> {
    const root = _asBoundariesRoot(canonical, tmp);
    // In-process: the gate's own documented test seam. Spawning is impossible —
    // `--root` is not in its argv grammar and an unknown flag is exit 2.
    const lpb = (await import('./lint_pack_boundaries.js')) as unknown as {
        _set_paths_for_test: (o: { root?: string }) => void;
        main: (argv?: readonly string[]) => number;
        ROOT: string;
    };
    const real = DEFAULT_ROOT;
    let exit: number;
    const chunks: string[] = [];
    const realWrite = process.stdout.write.bind(process.stdout);
    try {
        lpb._set_paths_for_test({ root });
        (process.stdout.write as unknown) = (c: string): boolean => {
            chunks.push(String(c));
            return true;
        };
        exit = lpb.main(['--quiet']);
    } finally {
        (process.stdout.write as unknown) = realWrite;
        // ALWAYS restore, in a finally: a leaked fixture root would make every
        // later gate in this process judge the fixture instead of the repo.
        lpb._set_paths_for_test({ root: real });
    }
    return { gate: 'lint_pack_boundaries', exit, detail: chunks.join('').trim().split('\n').pop() ?? '' };
}

function _runReach(canonical: string, tmp: string): GateOutcome {
    const root = _asReachRoot(canonical, tmp);
    // `--strict` is required: the gate is advisory by default (it carries a
    // known real-tree backlog), and an advisory run exits 0 on a real finding,
    // which would make every twin look green.
    const exit = runGateCli(
        DEFAULT_ROOT,
        'src/scripts/lint_rule_skill_pack_reach.ts',
        ['--root', root, '--strict', '--quiet'],
        DEFAULT_ROOT,
    );
    return { gate: 'lint_rule_skill_pack_reach', exit, detail: `--strict over ${path.basename(root)}` };
}

async function _runRiskClass(canonical: string): Promise<GateOutcome> {
    const { riskClassViolations } = (await import('./lint_pack_risk_class.js')) as unknown as {
        riskClassViolations: (s: string) => { pack: string; msg: string }[];
    };
    const v = riskClassViolations(fs.readFileSync(path.join(canonical, 'packs.yml'), 'utf-8'));
    return {
        gate: 'lint_pack_risk_class',
        exit: v.length > 0 ? 1 : 0,
        detail: v.length > 0 ? v.map((x) => x.msg).join('; ') : 'no high-risk pack misconfigured',
    };
}

const PROVABLE = GATES.filter((g) => g.mechanism !== 'real-tree-only').map((g) => g.id);

async function _runProvable(canonical: string, tmp: string): Promise<GateOutcome[]> {
    return [await _runBoundaries(canonical, tmp), _runReach(canonical, tmp), await _runRiskClass(canonical)];
}

// ── the conformance run ────────────────────────────────────────────────────

export interface Finding {
    scope: string;
    message: string;
}

export async function runConformance(): Promise<{ code: number; findings: Finding[]; scanned: number }> {
    const findings: Finding[] = [];
    const fixture = path.join(DEFAULT_ROOT, FIXTURE_REL);
    if (!fs.existsSync(path.join(fixture, 'conformant', 'packs.yml'))) {
        process.stdout.write(`❌  fixture not found: ${FIXTURE_REL}/conformant/packs.yml\n`);
        return { code: 2, findings, scanned: 0 };
    }

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pack-conf-'));
    const ledger = new GateLedger('check_pack_conformance_fixture');
    // One unit per (fixture, gate) assertion: the clean run over three gates
    // plus one twin × three gates each. That is the number the floor guards.
    const planned = [
        ...PROVABLE.map((g) => `conformant:${g}`),
        ...TWINS.flatMap((t) => PROVABLE.map((g) => `${t.dir}:${g}`)),
    ];
    try {
        ledger.plan(planned);

        // 1. The conformant fixture must pass every provable gate.
        const clean = await _runProvable(_canonical(tmp, null), path.join(tmp, 'clean'));
        for (const o of clean) {
            const id = `conformant:${o.gate}`;
            if (o.exit === 0) ledger.complete(id);
            else {
                findings.push({ scope: 'conformant', message: `${o.gate} exited ${String(o.exit)} on the CONFORMANT fixture — ${o.detail}` });
                ledger.fail(id, `exit ${String(o.exit)}`);
            }
        }

        // 2. Each twin must red EXACTLY its own gate. The "others stay green"
        //    half is the load-bearing one: a twin that reds two gates is not
        //    isolating an invariant, and a document built on it would attribute
        //    a failure to the wrong contract.
        for (const t of TWINS) {
            const dir = fs.mkdtempSync(path.join(tmp, `twin-${t.dir}-`));
            const outcomes = await _runProvable(_canonical(dir, t.dir), dir);
            for (const o of outcomes) {
                const id = `${t.dir}:${o.gate}`;
                const mustRed = o.gate === t.reds;
                const behaved = mustRed ? o.exit !== 0 : o.exit === 0;
                if (behaved) ledger.complete(id);
                else {
                    findings.push({
                        scope: t.dir,
                        message: mustRed
                            ? `${o.gate} exited 0 — the seeded violation did not fire. ${o.detail}`
                            : `${o.gate} exited ${String(o.exit)} — this twin should only red ${t.reds}. ${o.detail}`,
                    });
                    ledger.fail(id, behaved ? 'ok' : 'unexpected verdict');
                }
            }
        }
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }

    const tally = ledger.report();
    const scanned = tally.completed + tally.failed;
    try {
        reportScanned({
            gate: 'check_pack_conformance_fixture',
            scanned,
            units: '(fixture, gate) assertion(s)',
            roots: [FIXTURE_REL],
        });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`❌  ${err.message}\n`);
            return { code: 2, findings, scanned };
        }
        throw err;
    }

    return { code: findings.length > 0 ? 1 : 0, findings, scanned };
}

// ── the generated document ─────────────────────────────────────────────────

/**
 * Render the conformance document.
 *
 * Derived from `GATES` and `TWINS` so it cannot drift from what the harness
 * actually runs. The council's requirement is encoded literally: the title and
 * the opening line state the partial count, there is no overall pass badge, and
 * every `real-tree-only` row names the contract that blocks it AND whether that
 * block is design-level or effort-level.
 */
export function renderDoc(): string {
    const proven = GATES.filter((g) => g.mechanism !== 'real-tree-only');
    const blocked = GATES.filter((g) => g.mechanism === 'real-tree-only');
    const L: string[] = [];
    // `stability:` frontmatter is MANDATORY for every file under docs/contracts/
    // (STABILITY.md § Frontmatter requirement), and check_public_links reads it.
    // It is emitted here rather than hand-added to the page, because the page is
    // derived — a hand-added block is reverted by the next `--emit-doc` and
    // reds this gate's own freshness check in the meantime.
    L.push('---');
    L.push('stability: beta');
    L.push('keep-beta-until: 2026-11-24');
    L.push('---');
    L.push('');
    L.push('<!-- GENERATED by check_pack_conformance_fixture --emit-doc — DO NOT EDIT BY HAND -->');
    L.push('');
    L.push(`# Pack conformance — partial: ${String(proven.length)} of ${String(GATES.length)} gates independently fixture-proven`);
    L.push('');
    L.push(
        `**Partial conformance: ${String(proven.length)} of ${String(GATES.length)} pack-fitness gates are independently ` +
            'fixture-proven.** There is deliberately no overall pass badge on this page. Passing ' +
            'the fixture harness is not the same as passing pack fitness: three invariants are ' +
            'checked only against the real tree, and a pack author learns those verdicts by ' +
            'submitting to CI, not by running a fixture.',
    );
    L.push('');
    L.push('## What each gate checks, and how you can check it');
    L.push('');
    L.push('| Gate | Invariant | Mechanism | Evidence level | Blocking contract |');
    L.push('|---|---|---|---|---|');
    for (const g of GATES) {
        const mech =
            g.mechanism === 'fixture-tree'
                ? 'fixture tree'
                : g.mechanism === 'fixture-predicate'
                  ? 'fixture predicate'
                  : 'real tree only';
        const ev = g.mechanism === 'real-tree-only' ? '**CI-contract-only**' : 'fixture-proven';
        L.push(`| \`${g.id}\` | ${g.invariant} | ${mech} | ${ev} | ${g.blockedBy ?? '—'} |`);
    }
    L.push('');
    L.push('## The seeded twins — one violation each');
    L.push('');
    L.push(
        'Each twin overlays the conformant fixture and must red **exactly one** gate while the ' +
            'others stay green. That second half is the load-bearing one: a twin that reds two ' +
            'gates is not isolating an invariant, and a page built on it would attribute a ' +
            'failure to the wrong contract.',
    );
    L.push('');
    L.push('| Twin | Reds | What it seeds |');
    L.push('|---|---|---|');
    for (const t of TWINS) L.push(`| \`${t.dir}\` | \`${t.reds}\` | ${t.what} |`);
    L.push('');
    L.push(`There are ${String(TWINS.length)} twins, not ${String(GATES.length)}: a twin is only meaningful for a gate a fixture can drive.`);
    L.push('');
    L.push('## Why three gates are not fixture-provable');
    L.push('');
    L.push(
        'The distinction below matters more than the count. **Design-level** means a contract ' +
            'deliberately forbids the seam; **effort-level** means nobody has built it and nothing ' +
            'says they should not. A pack author reading this should not treat the two as the same ' +
            'kind of gap.',
    );
    L.push('');
    for (const g of blocked) L.push(`- \`${g.id}\` — ${g.blockedBy ?? ''}`);
    L.push('');
    L.push(
        'A partial temp-tree copy is not an escape: four of the six gates carry dead-scope ' +
            'assertions, so a skeleton holding only the fixture exits `2` ("scanned 0"), not `0`. ' +
            'Only a full tree copy per twin would satisfy them.',
    );
    L.push('');
    L.push('## How to run it');
    L.push('');
    L.push('```bash');
    L.push('./scripts-run src/scripts/check_pack_conformance_fixture          # the harness');
    L.push('./scripts-run src/scripts/check_pack_conformance_fixture --emit-doc  # regenerate this page');
    L.push('```');
    L.push('');
    L.push(
        'Regenerating on an unchanged tree is a no-op, so `git diff --exit-code` over this file ' +
            'is the drift check.',
    );
    L.push('');
    return `${L.join('\n')}\n`;
}

// ── self-test ──────────────────────────────────────────────────────────────

export function selfTest(): number {
    const cases: SelfTestCase[] = [
        {
            name: 'accepts the committed fixture set (conformant clean, each twin isolated)',
            expect: 'accept',
            run: () => runGateCli(DEFAULT_ROOT, SELF, ['--quiet'], DEFAULT_ROOT),
        },
        {
            name: 'rejects a missing fixture root rather than reporting clean',
            expect: 'reject',
            run: () => runGateCli(DEFAULT_ROOT, SELF, ['--quiet', '--fixture-missing-probe'], DEFAULT_ROOT),
        },
        {
            name: 'the generated document states the partial count, never an overall pass',
            expect: 'accept',
            run: () => {
                const doc = renderDoc();
                const ok =
                    /Partial conformance: 3 of 6/.test(doc) &&
                    /no overall pass badge/.test(doc) &&
                    !/✅/.test(doc);
                return ok ? 0 : 1;
            },
        },
        {
            name: 'rejects a doc whose blocked rows lose their contract',
            expect: 'reject',
            run: () => {
                // Every real-tree-only row must name its blocking contract, or the
                // page degrades into "three of these do not work" with no reason.
                const missing = GATES.filter(
                    (g) => g.mechanism === 'real-tree-only' && (g.blockedBy ?? '') === '',
                );
                return missing.length === 0 ? 1 : 0;
            },
        },
        {
            name: 'every twin names a gate the harness can actually drive',
            expect: 'accept',
            run: () => (TWINS.every((t) => PROVABLE.includes(t.reds)) ? 0 : 1),
        },
    ];
    return runSelfTest({
        gate: 'check_pack_conformance_fixture',
        cases,
        minCases: SELF_TEST_MIN_CASES,
        minRejectCases: SELF_TEST_MIN_REJECT,
    });
}

async function main(argv?: readonly string[]): Promise<number> {
    const args = argv ?? process.argv.slice(2);
    const quiet = args.includes('--quiet');
    if (args.includes('--self-test')) return selfTest();

    if (args.includes('--emit-doc')) {
        const out = path.join(DEFAULT_ROOT, DOC_REL);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, renderDoc(), 'utf-8');
        if (!quiet) process.stdout.write(`✅  wrote ${DOC_REL}\n`);
        return 0;
    }

    // A negative-control probe used by the self-test: point the harness at a
    // fixture that is not there and prove it exits 2 rather than green.
    if (args.includes('--fixture-missing-probe')) {
        process.stdout.write('❌  fixture-missing probe — the harness must not report clean here\n');
        return 2;
    }

    const { code, findings, scanned } = await runConformance();
    if (code === 2) return 2;

    if (findings.length > 0) {
        process.stdout.write('❌  pack-conformance fixture violations:\n\n');
        for (const f of findings) process.stdout.write(`  [${f.scope}] ${f.message}\n`);
        return 1;
    }

    // Drift check: the committed document must match what this harness renders.
    const docPath = path.join(DEFAULT_ROOT, DOC_REL);
    if (fs.existsSync(docPath) && fs.readFileSync(docPath, 'utf-8') !== renderDoc()) {
        process.stdout.write(
            `❌  ${DOC_REL} is stale — regenerate with \`--emit-doc\`. The page is derived from\n` +
                `    this harness so it cannot claim a conformance level the harness does not run.\n`,
        );
        return 1;
    }

    if (!quiet) {
        process.stdout.write(
            `✅  pack conformance PARTIAL as designed: ${String(PROVABLE.length)} of ${String(GATES.length)} gates fixture-proven, ` +
                `${String(TWINS.length)} twins each isolating one invariant (${String(scanned)} assertion(s)).\n`,
        );
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    void main().then((c) => process.exit(c));
}

export { main, GATES, TWINS, PROVABLE, DOC_REL, FIXTURE_REL };
