#!/usr/bin/env -S npx tsx
/**
 * Gate — a rule that declares `norm` stays inside the budget it declared.
 *
 * `road-to-standing-payload-diet` Phase 1 step 1.2.
 *
 * ## What `norm` pins, and why nothing pinned it before
 *
 * A rule file mixes three things at one uniform standing cost: the obligation
 * (an Iron Law and its clauses), the routing (pointers to skills and
 * guidelines), and the rationale (why the rule exists, what it measured, what it
 * declines to claim). All three are re-sent on every session and every spawn.
 * Only the first two have to be. Before this gate, `norm` appeared nowhere in
 * `src/rules/` and nowhere in `rule.schema.json` (0 hits, measured 2026-08-23),
 * so nothing objected when a rule grew by 200 lines of rationale.
 *
 * `norm.tokens` is the declared exact-BPE ceiling for the rule body below the
 * frontmatter; `norm.remainder` names where the non-normative prose went. Both
 * are required together, and the pairing is the point rather than tidiness: a
 * pin with no destination is a licence to delete, and `preservation-guard`
 * forbids deleting a passage during a transformation. The schema enforces the
 * pairing; this gate enforces the number.
 *
 * ## Three deliberate properties
 *
 * 1. **Opt-in, and the opt-out count is the published metric.** Rules without
 *    `norm` are SKIPPED and counted, and the count is printed on the green path.
 *    A required key would have redded every rule file on the day it landed,
 *    which is the gate-that-teaches-you-to-ignore-it failure
 *    `src/config/preamble-payload-budget.json` warns about in its own
 *    `_comment`. So the un-pinned fraction is a number rather than an unknown.
 * 2. **Exact tokenizer, or refuse to judge.** `js-tiktoken` is a devDependency
 *    and can be absent. Where it is, this gate does NOT fall back to the
 *    `chars/4` proxy and pass anyway — a pin enforced in a different unit from
 *    the one it was derived in is enforced against a number nobody can
 *    reproduce. It exits 2 and says so.
 * 3. **`assertScanned` posture.** Zero rule files is exit 3, not green. This
 *    repo has shipped gates that scanned an emptied tree and certified coverage
 *    that did not exist.
 *
 * ## What it deliberately does NOT check
 *
 * Whether the body that remains is *genuinely* normative. That is a human read.
 * The gate checks a declared number against a measured one, and the schema
 * checks that a destination exists; `check_references` checks the destination
 * resolves. None of the three can tell obligation from rationale, and claiming
 * otherwise would be the coverage inflation this tree keeps removing.
 *
 * Modes: `--quiet` verdict only · `--json` machine-readable · `--self-test`.
 *
 * Exit codes: 0 every pin honoured · 1 a pin exceeded · 2 no exact tokenizer or
 * a usage error · 3 dead scan scope.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse as parseYaml } from 'yaml';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { strip_frontmatter } from './_lib/preservation_migration.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';
import { gpt_tokens, method_note, TIKTOKEN_AVAILABLE } from './_lib/token_count.js';

const PROG = 'lint_rule_norm_pin';
const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const RULES_DIR = path.join(REPO_ROOT, 'src', 'rules');
const SCRIPT_REL = 'src/scripts/lint_rule_norm_pin.ts';
const SELF_TEST_MIN_CASES = 5;
const SELF_TEST_MIN_REJECT = 3;

export interface NormPin {
    readonly tokens: number;
    readonly remainder: readonly string[];
}

export interface Finding {
    readonly rule: string;
    readonly declared: number;
    readonly measured: number;
    readonly over: number;
}

export interface Verdict {
    readonly pinned: Finding[];
    readonly violations: Finding[];
    readonly unpinned: string[];
    readonly method: string;
}

/** The `norm` block of one rule file, or `null` when it declares none. */
export function readNormPin(text: string): NormPin | null {
    const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
    if (m === null) return null;
    let fm: unknown;
    try {
        fm = parseYaml(m[1] ?? '');
    } catch {
        return null;
    }
    if (typeof fm !== 'object' || fm === null) return null;
    const raw = (fm as Record<string, unknown>)['norm'];
    if (typeof raw !== 'object' || raw === null) return null;
    const block = raw as Record<string, unknown>;
    const tokens = block['tokens'];
    const remainder = block['remainder'];
    if (typeof tokens !== 'number' || !Number.isInteger(tokens) || tokens < 1) return null;
    if (!Array.isArray(remainder) || remainder.length === 0) return null;
    return { tokens, remainder: remainder.map(String) };
}

/**
 * Exact-BPE size of the rule body BELOW the frontmatter.
 *
 * The frontmatter is excluded because it is not prose a reader consumes and
 * because including it would make a pin move when an unrelated trigger is added.
 */
export function measureBody(text: string): number {
    return gpt_tokens(strip_frontmatter(text)).tokens;
}

export function check(dir: string = RULES_DIR): Verdict {
    let entries: string[];
    try {
        entries = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
    } catch {
        entries = [];
    }
    const pinned: Finding[] = [];
    const violations: Finding[] = [];
    const unpinned: string[] = [];
    for (const name of entries) {
        const text = fs.readFileSync(path.join(dir, name), 'utf-8');
        const pin = readNormPin(text);
        if (pin === null) {
            unpinned.push(name);
            continue;
        }
        const measured = measureBody(text);
        const finding: Finding = {
            rule: name,
            declared: pin.tokens,
            measured,
            over: measured - pin.tokens,
        };
        pinned.push(finding);
        if (finding.over > 0) violations.push(finding);
    }
    return { pinned, violations, unpinned, method: method_note() };
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    if (argv.includes('--self-test')) return selfTest();
    const unknown = argv.filter((a) => a !== '--quiet' && a !== '--json');
    if (unknown.length > 0) {
        process.stderr.write(`${PROG}: unknown argument(s): ${unknown.join(' ')}\n`);
        return 2;
    }
    const quiet = argv.includes('--quiet');
    const json = argv.includes('--json');

    if (!TIKTOKEN_AVAILABLE) {
        process.stderr.write(
            `${PROG}: no exact tokenizer available (js-tiktoken absent). A \`norm\` pin is ` +
                'derived in exact BPE, so enforcing it against the chars/4 proxy would hold ' +
                'the author to a number they cannot reproduce. Install devDependencies and ' +
                're-run; this gate does NOT fall back and pass.\n',
        );
        return 2;
    }

    const v = check();
    const ledger = new GateLedger(PROG);
    ledger.plan([...v.pinned.map((f) => f.rule), ...v.unpinned]);
    for (const f of v.pinned) {
        if (f.over > 0) ledger.fail(f.rule, `${String(f.measured)} > ${String(f.declared)}`);
        else ledger.complete(f.rule);
    }
    for (const name of v.unpinned) ledger.skip(name, 'declared_exemption');

    if (json) {
        process.stdout.write(`${JSON.stringify(v, null, 2)}\n`);
    } else if (!quiet) {
        process.stdout.write(`${PROG} · ${v.method}\n`);
        for (const f of v.pinned) {
            const mark = f.over > 0 ? '❌' : '✅';
            const room = f.over > 0 ? `+${String(f.over)} over` : `${String(-f.over)} tok of room`;
            process.stdout.write(
                `  ${mark} ${f.rule.padEnd(42)} ${String(f.measured).padStart(6)} / ` +
                    `${String(f.declared).padStart(6)} pinned  (${room})\n`,
            );
        }
    }

    try {
        reportScanned({
            gate: PROG,
            scanned: v.pinned.length + v.unpinned.length,
            units: 'rule file(s)',
            roots: ['src/rules'],
        });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`❌  ${err.message}\n`);
            return 3;
        }
        throw err;
    }
    ledger.report();

    // The un-pinned count is this phase's own progress metric, so it is printed
    // on the GREEN path too — a number only visible on failure is not a metric.
    process.stdout.write(
        `${PROG}: ${String(v.pinned.length)} rule(s) declare \`norm\`, ` +
            `${String(v.unpinned.length)} do not (un-pinned remainder).\n`,
    );
    if (v.violations.length > 0) {
        process.stdout.write(
            `❌  ${PROG}: ${String(v.violations.length)} rule(s) exceed the \`norm\` budget they ` +
                'declared. Either move more prose to the `remainder` destination, or raise the ' +
                'pin in the same commit with the measurement that justifies it — never silently.\n',
        );
        return 1;
    }
    process.stdout.write(`✅  ${PROG}: every declared \`norm\` pin is honoured.\n`);
    return 0;
}

/**
 * Prove the gate discriminates.
 *
 * The reject cases exercise the three ways it must refuse: a pin genuinely
 * exceeded, a dead scan root, and a usage error. The accept cases prove an
 * honoured pin and an un-pinned corpus both pass — the second matters because
 * the opt-in design means most runs see no pin at all, and a gate that reddened
 * on "nobody opted in" would have been abandoned in a week.
 */
function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(REPO_ROOT, '.norm-pin-selftest-'));
    const fixture = (name: string, body: string, pin: string | null): void => {
        const fm = pin === null ? '' : `norm:\n  tokens: ${pin}\n  remainder:\n    - docs/x.md\n`;
        fs.writeFileSync(path.join(tmp, name), `---\ntype: auto\n${fm}---\n\n${body}\n`);
    };
    // ~120 tokens of prose: comfortably over a pin of 5, comfortably under 4000.
    const body = 'The obligation is stated here. '.repeat(24);
    try {
        const cases: SelfTestCase[] = [
            {
                name: 'pin exceeded → exit 1',
                expect: 'reject',
                run: () => {
                    fixture('over.md', body, '5');
                    const v = check(tmp);
                    fs.rmSync(path.join(tmp, 'over.md'));
                    return v.violations.length > 0 ? 1 : 0;
                },
            },
            {
                name: 'dead scan root → exit 3',
                expect: 'reject',
                run: () => {
                    const v = check(path.join(tmp, 'no-such-dir'));
                    try {
                        reportScanned({
                            gate: PROG,
                            scanned: v.pinned.length + v.unpinned.length,
                            units: 'rule file(s)',
                            roots: ['src/rules'],
                        });
                    } catch (err) {
                        return err instanceof DeadScopeError ? 3 : 1;
                    }
                    return 0;
                },
            },
            {
                name: 'unknown argument → exit 2',
                expect: 'reject',
                run: () => runGateCli(REPO_ROOT, SCRIPT_REL, ['--nonsense'], REPO_ROOT),
            },
            {
                name: 'pin honoured → exit 0',
                expect: 'accept',
                run: () => {
                    fixture('under.md', body, '4000');
                    const v = check(tmp);
                    fs.rmSync(path.join(tmp, 'under.md'));
                    return v.violations.length > 0 ? 1 : 0;
                },
            },
            {
                name: 'no rule declares a pin → still exit 0',
                expect: 'accept',
                run: () => {
                    fixture('bare.md', body, null);
                    const v = check(tmp);
                    const ok = v.pinned.length === 0 && v.unpinned.length === 1;
                    fs.rmSync(path.join(tmp, 'bare.md'));
                    return ok ? 0 : 1;
                },
            },
        ];
        return runSelfTest({ gate: PROG, cases, minCases: SELF_TEST_MIN_CASES, minRejectCases: SELF_TEST_MIN_REJECT });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

function invokedDirectly(): boolean {
    const entry = process.argv[1];
    if (entry === undefined) return false;
    return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

if (invokedDirectly()) {
    process.exit(main());
}
