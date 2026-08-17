#!/usr/bin/env node
/**
 * Hard-gate: the rule-activation split may not move unwitnessed.
 *
 * `road-to-mixed-trigger-activation-cost` step 4.1, and the reason it exists is
 * the roadmap's own case study. Commit `33c7c20` moved **nineteen** rules from
 * path-scoped to always-on in one emitter change. The change was correct — it
 * stopped scoping from silently deleting keyword reach — and it recorded its own
 * cost in the commit message. But nothing in the repository would have caught it
 * if the message had said nothing: no gate watched the split, so the only
 * witnesses were a commit body and, months later, an external analysis. A
 * nineteen-rule activation change that reaches every consumer session should not
 * depend on an author remembering to write it down.
 *
 * The gate is a RATCHET on two axes, both in the same direction the estate's
 * other payload budgets use (`preamble-payload-budget`, `hook-token-budget`):
 *
 *   1. **Identity** — the scoped and mixed ID SETS are pinned. Any rule entering
 *      or leaving either set fails the gate and is NAMED. This is the axis that
 *      would have caught `33c7c20`: a count-only check can be satisfied by a
 *      coincidence (one rule in, one rule out), an id-set check cannot.
 *   2. **Weight** — the unconditional corpus's token total may only walk DOWN.
 *      Growth fails. Raising the baseline is a deliberate PR with a stated
 *      reason, never a silent number edit — raising a ratchet baseline to clear a
 *      failing check is the config-weakening move this repo blocks by
 *      construction, and the same sentence is written into the baseline file.
 *
 * Measurement is exact-BPE where `js-tiktoken` resolves and the documented
 * character proxy where it does not; the gate says which it used rather than
 * presenting a proxy as a measurement. The roadmap's own § 1 claim 11 is
 * unverifiable precisely because the figure it inherited was a proxy quoted as a
 * measurement, so this gate refuses to repeat that.
 *
 * The verdict per rule is not computed here. It comes from
 * `rule_activation_census.ts`, which reads the emitter's own exported
 * `_claude_paths_plan`. Measurement and enforcement stay in separate files: the
 * census has no failure exit and this gate has no opinion of its own.
 *
 * CLI contract: exit 0 = at or under the ratchet, 1 = moved.
 * `--quiet` suppresses the green line. `--write-baseline` re-anchors the file
 * from the current tree and is the only way the numbers change.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';
import { gpt_tokens, TIKTOKEN_AVAILABLE } from './_lib/token_count.js';
import { census, summarize } from './rule_activation_census.js';

const SCRIPT_REL = path.join('src', 'scripts', 'check_rule_activation_census.ts');

/**
 * Floors for the self-test suite, set below the shipped case count on purpose.
 *
 * Five cases ship and four of them reject. The floors sit at 4/3 so retiring one
 * case that has genuinely stopped describing the gate does not red the suite,
 * while deleting the suite down to a single happy path — the cheapest route to a
 * green self-test — still fails.
 */
const SELF_TEST_MIN_CASES = 4;
const SELF_TEST_MIN_REJECT = 3;

const QUIET = process.argv.slice(2).includes('--quiet');
const WRITE = process.argv.slice(2).includes('--write-baseline');
const GATE = 'check_rule_activation_census';
const BASELINE_REL = path.join('src', 'config', 'rule-activation-census.json');
const RULES_REL = path.join('src', 'rules');

/**
 * How far the unconditional token total may drift upward before the gate is red.
 *
 * Not zero, deliberately: prose edits to an already-unconditional rule move this
 * number by a few dozen tokens and are not the failure class the gate watches.
 * The identity axis above has no such band — a rule changing activation class is
 * never noise. The number is a STATED DEFAULT, not a measured optimum; it is the
 * smallest band that does not fire on ordinary copy-editing in this corpus.
 * Revisit-if: a run reports a red on the weight axis whose diff is purely
 * editorial, which falsifies the band rather than the obligation.
 */
const TOKEN_DRIFT_ALLOWANCE = 2_000;

interface Baseline {
    _comment: string;
    measured_at_commit: string;
    tokens_exact: boolean;
    unconditional_tokens: number;
    scoped_ids: string[];
    mixed_ids: string[];
    baseline_history: { date: string; reason: string }[];
}

export interface CensusReading {
    scoped_ids: string[];
    mixed_ids: string[];
    unconditional_tokens: number;
    tokens_exact: boolean;
    scanned: number;
}

/** Measure the current tree: activation sets plus the unconditional corpus weight. */
export function read_census(root: string): CensusReading {
    const rows = census(root);
    const sum = summarize(rows);
    let tokens = 0;
    for (const r of rows) {
        if (r.verdict === 'scoped') continue; // scoped rules are not standing payload
        const p = path.join(root, RULES_REL, `${r.id}.md`);
        tokens += gpt_tokens(fs.readFileSync(p, 'utf8')).tokens;
    }
    return {
        scoped_ids: sum.scoped_ids.slice().sort(),
        mixed_ids: sum.mixed_ids.slice().sort(),
        unconditional_tokens: tokens,
        tokens_exact: TIKTOKEN_AVAILABLE,
        scanned: rows.length,
    };
}

function _diff(pinned: string[], current: string[]): { added: string[]; removed: string[] } {
    const a = new Set(pinned);
    const b = new Set(current);
    return {
        added: current.filter((x) => !a.has(x)),
        removed: pinned.filter((x) => !b.has(x)),
    };
}

/** A path-only rule: the emitter gives it `paths:`, so it reads as `scoped`. */
const FIXTURE_PATH_ONLY = [
    '---',
    'type: "auto"',
    'triggers:',
    '  - path_prefix: "components/"',
    '---',
    '',
    '# Alpha',
    '',
    'A rule whose obligation binds at file contact.',
    '',
].join('\n');

/** The same rule plus one keyword: the emitter drops `paths:` entirely. */
const FIXTURE_MIXED = [
    '---',
    'type: "auto"',
    'triggers:',
    '  - path_prefix: "components/"',
    '  - keyword: "widget"',
    '---',
    '',
    '# Beta',
    '',
    'A rule carrying both a path and a prompt trigger.',
    '',
].join('\n');

interface FixtureShape {
    /** Write the two rule files. Off for the dead-scope case. */
    rules: boolean;
    /** Write a baseline at all. Off for the missing-baseline case. */
    baseline: boolean;
    /** Mutate the generated baseline before writing, to move one identity axis. */
    tamper?: (b: Record<string, unknown>) => void;
}

/**
 * Build a throwaway tree the gate can run against.
 *
 * The baseline is DERIVED from the fixture by the same `read_census` the gate
 * uses, then optionally tampered with. Hand-writing the expected token total
 * would make the accept case a test of my arithmetic rather than of the gate.
 */
function buildFixture(dir: string, shape: FixtureShape): string {
    fs.mkdirSync(path.join(dir, RULES_REL), { recursive: true });
    fs.mkdirSync(path.join(dir, 'src', 'config'), { recursive: true });
    if (shape.rules) {
        fs.writeFileSync(path.join(dir, RULES_REL, 'alpha-path-only.md'), FIXTURE_PATH_ONLY);
        fs.writeFileSync(path.join(dir, RULES_REL, 'beta-mixed.md'), FIXTURE_MIXED);
    }
    if (shape.baseline) {
        const reading = shape.rules
            ? read_census(dir)
            : {
                  scoped_ids: [],
                  mixed_ids: [],
                  unconditional_tokens: 0,
                  tokens_exact: TIKTOKEN_AVAILABLE,
                  scanned: 0,
              };
        const base: Record<string, unknown> = {
            _comment: 'self-test fixture',
            measured_at_commit: 'fixture',
            tokens_exact: reading.tokens_exact,
            unconditional_tokens: reading.unconditional_tokens,
            scoped_ids: reading.scoped_ids,
            mixed_ids: reading.mixed_ids,
            baseline_history: [],
        };
        shape.tamper?.(base);
        fs.writeFileSync(
            path.join(dir, BASELINE_REL),
            `${JSON.stringify(base, null, 4)}\n`,
        );
    }
    return dir;
}

/**
 * Prove the gate discriminates rather than merely exits.
 *
 * The four rejecting cases are the four ways this gate is worth having: each
 * identity axis separately, the missing baseline, and the dead scan root. The
 * dead-root case is the one a future refactor is most likely to break silently —
 * a gate that scans nothing and exits green is the exact failure
 * `assertScanned` exists for, and it is the reason that case is here rather than
 * only in the manifest.
 */
export function selfTest(repoRoot: string): number {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rac-selftest-'));
    const run = (shape: FixtureShape): number => {
        const work = buildFixture(fs.mkdtempSync(path.join(root, 'case-')), shape);
        return runGateCli(repoRoot, SCRIPT_REL, ['--quiet'], work);
    };
    const cases: SelfTestCase[] = [
        {
            name: 'a tree matching its baseline on both axes passes',
            expect: 'accept',
            run: () => run({ rules: true, baseline: true }),
        },
        {
            name: 'a rule that left the scoped set is REFUSED',
            expect: 'reject',
            run: () =>
                run({
                    rules: true,
                    baseline: true,
                    tamper: (b) => {
                        b['scoped_ids'] = ['beta-mixed'];
                    },
                }),
        },
        {
            name: 'a rule that left the mixed set is REFUSED',
            expect: 'reject',
            run: () =>
                run({
                    rules: true,
                    baseline: true,
                    tamper: (b) => {
                        b['mixed_ids'] = [];
                    },
                }),
        },
        {
            name: 'no committed baseline is REFUSED, not treated as nothing to compare',
            expect: 'reject',
            run: () => run({ rules: true, baseline: false }),
        },
        {
            name: 'an empty rule root is REFUSED — a gate that scanned nothing has not passed',
            expect: 'reject',
            run: () => run({ rules: false, baseline: true }),
        },
    ];
    try {
        return runSelfTest({
            gate: GATE,
            cases,
            minCases: SELF_TEST_MIN_CASES,
            minRejectCases: SELF_TEST_MIN_REJECT,
        });
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}

export function main(): number {
    if (process.argv.slice(2).includes('--self-test')) {
        return selfTest(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'));
    }
    const root = process.cwd();
    let reading: CensusReading;
    try {
        reading = read_census(root);
        // A gate that read nothing has not passed. The rule corpus is the scanned
        // unit; an empty one means the root moved, not that the estate is clean.
        assertScanned({
            gate: GATE,
            scanned: reading.scanned,
            units: 'rule file(s)',
            roots: [RULES_REL],
        });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`❌  ${err.message}\n`);
            return 1;
        }
        throw err;
    }

    const baseline_path = path.join(root, BASELINE_REL);

    if (WRITE) {
        const prior: Baseline | null = fs.existsSync(baseline_path)
            ? (JSON.parse(fs.readFileSync(baseline_path, 'utf8')) as Baseline)
            : null;
        const next: Baseline = {
            _comment:
                'Rule-activation ratchet baseline (road-to-mixed-trigger-activation-cost step 4.1). ' +
                'Two axes: the scoped/mixed ID SETS are pinned by identity, and the unconditional ' +
                'token total may only walk DOWN. Raising a number here to clear a failing check is ' +
                'the config-weakening move this repo blocks by construction — every raise needs a ' +
                'baseline_history entry whose reason is a real sentence. Regenerate with ' +
                '`check_rule_activation_census --write-baseline`; never hand-edit the counts.',
            measured_at_commit: process.env['AGENT_CONFIG_BASELINE_COMMIT'] ?? 'unrecorded',
            tokens_exact: reading.tokens_exact,
            unconditional_tokens: reading.unconditional_tokens,
            scoped_ids: reading.scoped_ids,
            mixed_ids: reading.mixed_ids,
            baseline_history: prior?.baseline_history ?? [],
        };
        fs.writeFileSync(baseline_path, `${JSON.stringify(next, null, 4)}\n`);
        process.stdout.write(
            `✅  ${GATE}: baseline written — ${next.scoped_ids.length} scoped, ` +
                `${next.mixed_ids.length} mixed, ${next.unconditional_tokens} unconditional tokens ` +
                `(${next.tokens_exact ? 'exact BPE' : 'character proxy'}).\n`,
        );
        return 0;
    }

    if (!fs.existsSync(baseline_path)) {
        process.stderr.write(
            `❌  ${GATE}: no baseline at ${BASELINE_REL}. Run with --write-baseline once, ` +
                'commit the file, and the ratchet is live from then on.\n',
        );
        return 1;
    }

    const base = JSON.parse(fs.readFileSync(baseline_path, 'utf8')) as Baseline;
    const failures: string[] = [];

    // Per-target accounting. The gate's verdict is corpus-level — two set
    // comparisons and one total — so the ledger's job here is to prove every rule
    // file was actually reached, and to attribute a red to the specific rules that
    // moved rather than to the corpus as a whole. A rule that moved is failed by
    // name; every other rule is completed.
    const ledger = new GateLedger(GATE);
    const all_ids = census(root).map((r) => r.id);
    ledger.plan(all_ids);

    const scoped = _diff(base.scoped_ids, reading.scoped_ids);
    if (scoped.added.length || scoped.removed.length) {
        failures.push(
            `scoped set moved (${base.scoped_ids.length} → ${reading.scoped_ids.length}):` +
                (scoped.added.length ? `\n      + now scoped:  ${scoped.added.join(', ')}` : '') +
                (scoped.removed.length
                    ? `\n      − no longer scoped: ${scoped.removed.join(', ')}`
                    : ''),
        );
    }

    const mixed = _diff(base.mixed_ids, reading.mixed_ids);
    if (mixed.added.length || mixed.removed.length) {
        failures.push(
            `mixed set moved (${base.mixed_ids.length} → ${reading.mixed_ids.length}):` +
                (mixed.added.length ? `\n      + now mixed:  ${mixed.added.join(', ')}` : '') +
                (mixed.removed.length
                    ? `\n      − no longer mixed: ${mixed.removed.join(', ')}`
                    : ''),
        );
    }

    // Comparing an exact reading against a proxy baseline (or the reverse) would
    // report a method change as a payload change. Say so instead of ratcheting.
    if (base.tokens_exact !== reading.tokens_exact) {
        failures.push(
            `token measurement METHOD changed (baseline ` +
                `${base.tokens_exact ? 'exact' : 'proxy'} → current ` +
                `${reading.tokens_exact ? 'exact' : 'proxy'}). The weight axis is ` +
                'UNRESOLVED, not red: re-anchor the baseline in the same environment ' +
                'rather than reading a method delta as a corpus delta.',
        );
    } else {
        const delta = reading.unconditional_tokens - base.unconditional_tokens;
        if (delta > TOKEN_DRIFT_ALLOWANCE) {
            failures.push(
                `unconditional corpus grew by ${delta} tokens ` +
                    `(${base.unconditional_tokens} → ${reading.unconditional_tokens}), over the ` +
                    `${TOKEN_DRIFT_ALLOWANCE}-token drift allowance. Shrink it, or re-anchor with ` +
                    '--write-baseline plus a baseline_history reason.',
            );
        }
    }

    // Attribute the verdict per rule before reporting, so the ledger names the
    // movers rather than reddening 117 targets for a two-rule change.
    const moved = new Set<string>([
        ...scoped.added,
        ...scoped.removed,
        ...mixed.added,
        ...mixed.removed,
    ]);
    for (const id of all_ids) {
        if (moved.has(id)) ledger.fail(id, 'activation class moved against the pinned baseline');
        else ledger.complete(id);
    }
    // A baseline id absent from the corpus means the rule FILE was deleted, not
    // that its activation moved. It is a legitimate change and it is already named
    // in the set-diff text above — but it cannot be ledgered, because the ledger
    // accounts for targets that exist and `plan()` never saw it. Failing it here
    // would raise an unplanned-target error and mask the real diff.
    ledger.report();

    if (failures.length > 0) {
        process.stderr.write(`❌  ${GATE}: the rule-activation split moved.\n\n`);
        for (const f of failures) process.stderr.write(`    • ${f}\n`);
        process.stderr.write(
            '\n    Every rule named above changed how often it loads in a consumer session.\n' +
                '    If that is intended, re-anchor the baseline in the SAME commit and record\n' +
                '    the reason — the point of this gate is that the change is stated, not that\n' +
                '    it is forbidden.\n',
        );
        return 1;
    }

    // Machine-readable count for the gate-coverage manifest, emitted on BOTH
    // paths and regardless of --quiet: a gate that goes blind must be detectable
    // even on the run where it reports nothing else. Contract rule 1 of
    // `src/config/gate-coverage.yml` — exactly one `scanned: <N>` line.
    process.stdout.write(`scanned: ${reading.scanned}\n`);

    if (!QUIET) {
        process.stdout.write(
            `✅  ${GATE}: ${reading.scoped_ids.length} scoped · ` +
                `${reading.mixed_ids.length} mixed · ${reading.unconditional_tokens} unconditional ` +
                `tokens (${reading.tokens_exact ? 'exact BPE' : 'character proxy'}) · ` +
                `${reading.scanned} rule file(s).\n`,
        );
    }
    return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(fileURLToPath(import.meta.url)).href) {
    const invoked = path.resolve(process.argv[1]);
    const self = path.resolve(fileURLToPath(import.meta.url));
    if (invoked === self) process.exit(main());
}
