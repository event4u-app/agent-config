#!/usr/bin/env tsx
/**
 * Eval-specification lint — a gate on this package's own measurement inputs.
 *
 * `road-to-skill-ecosystem-eval-integrity` Phase 1. Every gate in this tree
 * checks a shipped artifact; nothing checked the SPECIFICATIONS that decide
 * whether a change helped. A malformed eval does not fail loudly — it measures
 * less while reporting the same coverage, which is the worst available failure
 * mode for a measurement.
 *
 * ── The four defect classes, and why each is invisible without a gate ───────
 *
 * `duplicate-key` — `JSON.parse` keeps the LAST value for a repeated key, so
 * one case silently becomes a byte-identical clone of another and the intended
 * fixture is never loaded. The file parses; the schema passes; the suite
 * reports the same number of cases.
 *
 * `untracked-fixture` — a referenced fixture that is not in the git INDEX
 * exists on the author's machine and nowhere else. Resolved from `git ls-files`
 * deliberately: the plausible alternative, asking `git ls-tree HEAD`, counts a
 * file staged for removal back as tracked and produces a false negative for
 * exactly this bug class.
 *
 * `arithmetic-disagreement` — a fixture states the same number twice, once as
 * the declared expectation and once inside the derivation, and the two
 * disagree. A judge then prefers the declared value and scores a correct
 * response as a loss. Both numbers are already in the file; they were simply
 * never compared. Detail and the rounding rule: `_lib/arith_claims.ts`.
 *
 * `incomplete-grader` — an assertion whose configuration is absent parses
 * cleanly and enforces NOTHING. `tool-choice` is the shape in this tree: its
 * schema requires only `kind`, so `{"kind": "tool-choice"}` is valid and
 * checks no tool at all. A scenario carrying it looks graded and is not.
 *
 * `declared-count-mismatch` — a description that says "3 positives" beside a
 * query list that holds four. The prose is what a reader trusts when deciding
 * whether a corpus is balanced, and nothing recomputes it.
 *
 * ── What this gate does NOT do ──────────────────────────────────────────────
 * It never judges whether a fixture is GOOD. Every check above fires only on a
 * malformed input and can be satisfied by well-written prose of any quality —
 * that boundary is deliberate, because a gate that grades authorship produces
 * findings nobody can act on and gets suppressed.
 *
 * ── Corpus, measured before promotion ───────────────────────────────────────
 * Phase 1 Step 7 requires landing advisory, classifying every hit on the real
 * corpus, and promoting only then. Measured 2026-08-26 over 170 specification
 * files: **zero hits in every class.** That is an honest null and it is the
 * reason this ships as an error gate on day one rather than advisory — there is
 * no inherited debt to classify, so an advisory period would measure nothing
 * and delay the protection. Discrimination is proven by `--self-test` instead,
 * which is what a preventive gate over a clean corpus has to rest on.
 *
 * Exit codes: 0 ok · 1 finding(s) · 2 usage / unreadable corpus.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { findArithDisagreements, chainSupportsExpected } from './_lib/arith_claims.js';
import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { findDuplicateKeys } from './_lib/json_duplicate_keys.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** Where specification files live. Every root is a directory of `evals/`. */
export const SPEC_GLOB_ROOTS = ['src/skills', 'src/domains', 'src/agent-src/commands/evals'] as const;

/** Finding kinds, closed so the report and the tests cannot drift apart. */
export type FindingKind =
    | 'duplicate-key'
    | 'untracked-fixture'
    | 'arithmetic-disagreement'
    | 'incomplete-grader'
    | 'declared-count-mismatch';

export interface Finding {
    kind: FindingKind;
    /** Repo-relative path of the specification. */
    file: string;
    /** 1-based line where the defect is, when the check knows one. */
    line?: number | undefined;
    message: string;
}

/** Every specification file under the declared roots. */
export function listSpecs(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string, depth: number): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) {
                if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
                if (depth > 6) continue;
                walk(p, depth + 1);
                continue;
            }
            if (!e.name.endsWith('.json')) continue;
            const rel = path.relative(root, p).split(path.sep).join('/');
            // `evals/` is the marker, so a schema or a config next door is not
            // mistaken for a specification. The commands root IS an evals dir.
            if (rel.includes('/evals/') || rel.startsWith('src/agent-src/commands/evals/')) {
                out.push(rel);
            }
        }
    };
    for (const r of SPEC_GLOB_ROOTS) walk(path.join(root, r), 0);
    return out.sort();
}

/**
 * Paths tracked in the git INDEX, as a set.
 *
 * `git ls-files` and not `git ls-tree HEAD`: the index is what a commit will
 * contain, and a file staged for removal is gone from the index while still
 * present in the tree. Asking the tree would report it tracked and let exactly
 * this bug class through.
 *
 * Returns `null` when git is unavailable — the caller then SKIPS the check
 * with a ledger reason rather than reporting every fixture untracked, because a
 * checker that cannot look must not manufacture findings.
 */
export function trackedPaths(root: string): Set<string> | null {
    try {
        const out = execFileSync('git', ['-C', root, 'ls-files', '-z'], {
            encoding: 'utf-8',
            maxBuffer: 64 * 1024 * 1024,
        });
        return new Set(out.split('\0').filter((s) => s !== ''));
    } catch {
        return null;
    }
}

/** 1-based line of the first occurrence of `needle`, or undefined. */
function lineOf(source: string, needle: string): number | undefined {
    const idx = source.indexOf(needle);
    if (idx < 0) return undefined;
    return source.slice(0, idx).split('\n').length;
}

const POSITIVE_COUNT = /(\d+)\s+positives?\b/i;
const NEGATIVE_COUNT = /(\d+)\s+(?:near-miss(?:es)?|negatives?)\b/i;

/** Check one specification. `tracked` of `null` skips the fixture check. */
export function checkSpec(
    rel: string,
    source: string,
    tracked: Set<string> | null,
): Finding[] {
    const findings: Finding[] = [];

    for (const d of findDuplicateKeys(source)) {
        findings.push({
            kind: 'duplicate-key',
            file: rel,
            line: d.laterLine,
            message:
                `duplicate key "${d.key}" in ${d.container === '' ? 'the document root' : d.container} — ` +
                `first at line ${String(d.firstLine)}, again at line ${String(d.laterLine)}. ` +
                'JSON.parse keeps the LAST value, so the earlier entry is silently discarded.',
        });
    }

    let doc: unknown;
    try {
        doc = JSON.parse(source);
    } catch {
        // Unparseable JSON is the schema validator's finding, not this gate's.
        return findings;
    }
    if (typeof doc !== 'object' || doc === null) return findings;
    const d = doc as Record<string, unknown>;

    // ── fixture tracking + grader completeness, over behavioural scenarios ──
    const scenarios = Array.isArray(d['scenarios']) ? (d['scenarios'] as Record<string, unknown>[]) : [];
    for (const sc of scenarios) {
        const id = typeof sc['id'] === 'string' ? sc['id'] : '(unnamed)';
        const assertions = Array.isArray(sc['assertions'])
            ? (sc['assertions'] as Record<string, unknown>[])
            : [];
        for (const a of assertions) {
            if (a['kind'] === 'tool-choice') {
                const must = Array.isArray(a['must_use']) ? a['must_use'] : [];
                const mustNot = Array.isArray(a['must_not_use']) ? a['must_not_use'] : [];
                if (must.length === 0 && mustNot.length === 0) {
                    findings.push({
                        kind: 'incomplete-grader',
                        file: rel,
                        line: lineOf(source, `"${id}"`),
                        message:
                            `scenario "${id}" carries a tool-choice assertion with neither must_use nor ` +
                            'must_not_use. It parses, it is schema-valid, and it checks no tool at all — ' +
                            'the scenario looks graded and is not.',
                    });
                }
            }
            if (a['kind'] === 'event-choice') {
                const emit = Array.isArray(a['must_emit']) ? a['must_emit'] : [];
                const notEmit = Array.isArray(a['must_not_emit']) ? a['must_not_emit'] : [];
                if (emit.length === 0 && notEmit.length === 0) {
                    findings.push({
                        kind: 'incomplete-grader',
                        file: rel,
                        line: lineOf(source, `"${id}"`),
                        message:
                            `scenario "${id}" carries an event-choice assertion with neither must_emit ` +
                            'nor must_not_emit. The schema forbids it by construction, so reaching this ' +
                            'means the file was written against an older schema or validation was skipped.',
                    });
                }
            }
            if (a['kind'] === 'file_exists' && tracked !== null) {
                const p = typeof a['path'] === 'string' ? a['path'] : '';
                // Only repo-rooted paths are checkable; a run-relative artifact
                // is produced BY the run and cannot be in the index.
                if (/^(?:tests|src|internal|docs|agents)\//.test(p) && !tracked.has(p)) {
                    findings.push({
                        kind: 'untracked-fixture',
                        file: rel,
                        line: lineOf(source, p),
                        message:
                            `scenario "${id}" references "${p}", which is not in the git index. ` +
                            'It exists on the author machine and nowhere else.',
                    });
                }
            }
        }
    }

    // ── arithmetic claims, over domain-truth cases ─────────────────────────
    const cases = Array.isArray(d['cases']) ? (d['cases'] as Record<string, unknown>[]) : [];
    for (const c of cases) {
        const id = typeof c['id'] === 'string' ? c['id'] : '(unnamed)';
        const check = typeof c['check'] === 'object' && c['check'] !== null
            ? (c['check'] as Record<string, unknown>)
            : null;
        if (check === null) continue;
        const rationale = typeof check['rationale'] === 'string' ? check['rationale'] : '';
        if (rationale === '') continue;
        for (const dis of findArithDisagreements(rationale)) {
            findings.push({
                kind: 'arithmetic-disagreement',
                file: rel,
                line: lineOf(source, rationale.slice(0, 40)),
                message:
                    `case "${id}" derivation disagrees with itself: "${dis.leftSegment}" is ` +
                    `${String(dis.left)} but "${dis.rightSegment}" reads ${String(dis.right)} ` +
                    `(tolerance ${String(dis.tolerance)}).`,
            });
        }
        const expected = check['expected'];
        if (typeof expected === 'number') {
            const tol = typeof check['tolerance'] === 'number' ? check['tolerance'] : 0;
            const supported = chainSupportsExpected(rationale, expected, tol);
            if (supported === false) {
                findings.push({
                    kind: 'arithmetic-disagreement',
                    file: rel,
                    line: lineOf(source, rationale.slice(0, 40)),
                    message:
                        `case "${id}" declares expected ${String(expected)} but no step of its own ` +
                        'derivation reaches that number. A judge prefers the declared value, so a ' +
                        'correct response scores as a loss.',
                });
            }
        }
    }

    // ── declared corpus counts, over trigger specifications ────────────────
    const queries = Array.isArray(d['queries']) ? (d['queries'] as Record<string, unknown>[]) : [];
    const desc = typeof d['description'] === 'string' ? d['description'] : '';
    if (queries.length > 0 && desc !== '') {
        const pos = queries.filter((q) => q['trigger'] === true).length;
        // Two vocabularies, and which one applies is read off the FILE.
        //
        // This gate was written when "near-miss" and "negative" were synonyms,
        // so it compared a declared near-miss count against every non-triggering
        // query. `lint_skill_trigger_corpus` has since introduced a three-class
        // vocabulary — `exemplar | near-miss | counterexample` — in which a
        // near-miss is a STRICT SUBSET of the negatives, the rest being
        // counterexamples. Against a classed file the old comparison demands a
        // description that contradicts the file's own classes.
        //
        // So a file that declares classes is counted by its declared near-miss
        // class, and a file that declares none keeps the historical
        // negative-count reading. That is a TIGHTENING, not a relaxation: a
        // classed file must now state its true near-miss count instead of being
        // forced to inflate it to the negative total, and the 175 unclassed
        // files are unaffected.
        const classed = queries.some((q) => typeof q['class'] === 'string' && q['class'] !== '');
        const neg = classed
            ? queries.filter((q) => q['class'] === 'near-miss').length
            : queries.filter((q) => q['trigger'] === false).length;
        const mp = POSITIVE_COUNT.exec(desc);
        const mn = NEGATIVE_COUNT.exec(desc);
        if (mp !== null && Number(mp[1]) !== pos) {
            findings.push({
                kind: 'declared-count-mismatch',
                file: rel,
                line: lineOf(source, '"description"'),
                message: `description claims ${mp[1]} positives; the query list holds ${String(pos)}.`,
            });
        }
        if (mn !== null && Number(mn[1]) !== neg) {
            findings.push({
                kind: 'declared-count-mismatch',
                file: rel,
                line: lineOf(source, '"description"'),
                message:
                    `description claims ${mn[1]} near-misses; the query list holds ${String(neg)}` +
                    `${classed ? ' case(s) classed `near-miss`' : ' non-triggering quer(ies)'}.`,
            });
        }
    }

    return findings;
}

export interface RunResult {
    findings: Finding[];
    scanned: number;
}

/** Scan a tree. */
export function run(root: string, ledger?: GateLedger): RunResult {
    const specs = listSpecs(root);
    const tracked = trackedPaths(root);
    const findings: Finding[] = [];
    for (const rel of specs) {
        ledger?.plan(rel);
        let source: string;
        try {
            source = fs.readFileSync(path.join(root, rel), 'utf-8');
        } catch {
            ledger?.skip(rel, 'check_did_not_run');
            continue;
        }
        const got = checkSpec(rel, source, tracked);
        if (got.length > 0) {
            findings.push(...got);
            ledger?.fail(rel, `${String(got.length)} finding(s)`);
        } else {
            ledger?.complete(rel);
        }
    }
    return { findings, scanned: specs.length };
}

/** Self-test cases. Every rejecting case is one defect class. */
function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(REPO_ROOT, '.lint-eval-specs-selftest-'));
    const mk = (name: string, body: string): string => {
        const dir = path.join(tmp, 'src', 'skills', name, 'evals');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'evals.json'), body, 'utf-8');
        return tmp;
    };
    const fresh = (): string => {
        fs.rmSync(path.join(tmp, 'src'), { recursive: true, force: true });
        return tmp;
    };
    const invoke = (dir: string): number =>
        runGateCli(REPO_ROOT, 'src/scripts/lint_eval_specs.ts', ['--root', dir, '--quiet'], REPO_ROOT);

    try {
        return runSelfTest({
            gate: 'lint_eval_specs',
            minCases: 6,
            minRejectCases: 4,
            cases: [
                {
                    name: 'a duplicate key is rejected (JSON.parse would discard the first silently)',
                    expect: 'reject',
                    run: () => {
                        fresh();
                        mk('dup', '{\n  "skill": "a",\n  "scenarios": [],\n  "skill": "b"\n}\n');
                        return invoke(tmp);
                    },
                },
                {
                    name: 'a tool-choice assertion with no tool list is rejected',
                    expect: 'reject',
                    run: () => {
                        fresh();
                        mk(
                            'grader',
                            JSON.stringify({
                                skill: 'grader',
                                scenarios: [
                                    { id: 'x', prompt: 'p', assertions: [{ kind: 'tool-choice' }] },
                                ],
                            }),
                        );
                        return invoke(tmp);
                    },
                },
                {
                    name: 'a derivation that disagrees with itself is rejected',
                    expect: 'reject',
                    run: () => {
                        fresh();
                        mk(
                            'arith',
                            JSON.stringify({
                                skill: 'arith',
                                cases: [
                                    {
                                        id: 'c',
                                        check: {
                                            kind: 'deterministic',
                                            expected: 8.5,
                                            tolerance: 0,
                                            rationale: '4,200,000 / 560,000 = 8.5 months.',
                                        },
                                    },
                                ],
                            }),
                        );
                        return invoke(tmp);
                    },
                },
                {
                    name: 'a declared positive count that the query list contradicts is rejected',
                    expect: 'reject',
                    run: () => {
                        fresh();
                        const dir = path.join(tmp, 'src', 'skills', 'count', 'evals');
                        fs.mkdirSync(dir, { recursive: true });
                        fs.writeFileSync(
                            path.join(dir, 'triggers.json'),
                            JSON.stringify({
                                skill: 'count',
                                description: '3 positives + 2 near-misses.',
                                queries: [
                                    { q: 'a', trigger: true },
                                    { q: 'b', trigger: false },
                                    { q: 'c', trigger: false },
                                ],
                            }),
                            'utf-8',
                        );
                        return invoke(tmp);
                    },
                },
                {
                    name: 'a well-formed chained derivation is accepted (intermediate steps are not claims)',
                    expect: 'accept',
                    run: () => {
                        fresh();
                        mk(
                            'ok',
                            JSON.stringify({
                                skill: 'ok',
                                cases: [
                                    {
                                        id: 'c',
                                        check: {
                                            kind: 'deterministic',
                                            expected: 20000,
                                            tolerance: 0,
                                            rationale: '500 x 0.80 / 0.02 = 400 / 0.02 = 20,000.',
                                        },
                                    },
                                ],
                            }),
                        );
                        return invoke(tmp);
                    },
                },
                {
                    name: 'a tool-choice assertion that names a tool is accepted',
                    expect: 'accept',
                    run: () => {
                        fresh();
                        mk(
                            'graded',
                            JSON.stringify({
                                skill: 'graded',
                                scenarios: [
                                    {
                                        id: 'x',
                                        prompt: 'p',
                                        assertions: [{ kind: 'tool-choice', must_use: ['Bash'] }],
                                    },
                                ],
                            }),
                        );
                        return invoke(tmp);
                    },
                },
                {
                    name: 'an empty corpus is REFUSED, not passed (exit 2 counts as a rejection)',
                    expect: 'reject',
                    run: () => {
                        fresh();
                        fs.mkdirSync(path.join(tmp, 'src', 'skills'), { recursive: true });
                        return invoke(tmp);
                    },
                },
            ],
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

export function main(argv: string[] = process.argv.slice(2)): number {
    if (argv.includes('--self-test')) {
        if (process.env['GATE_SELF_TEST_CHILD'] === '1') {
            process.stderr.write('lint_eval_specs: --self-test must not recurse\n');
            return 2;
        }
        return selfTest();
    }
    const rootIdx = argv.indexOf('--root');
    const rootArg = rootIdx >= 0 ? argv[rootIdx + 1] : undefined;
    const root = rootArg === undefined ? REPO_ROOT : path.resolve(rootArg);
    const quiet = argv.includes('--quiet');
    const asJson = argv.includes('--json');
    const isFixture = root !== REPO_ROOT;

    const ledger = isFixture ? undefined : new GateLedger('lint_eval_specs');
    const result = run(root, ledger);

    try {
        const sink = (chunk: string): boolean => {
            if (!quiet) process.stdout.write(chunk);
            return true;
        };
        reportScanned(
            {
                gate: 'lint_eval_specs',
                scanned: result.scanned,
                units: 'eval specification(s)',
                roots: SPEC_GLOB_ROOTS,
            },
            sink,
        );
    } catch (e) {
        if (e instanceof DeadScopeError) {
            process.stderr.write(`❌  ${e.message}\n`);
            return 2;
        }
        throw e;
    }

    if (asJson) {
        process.stdout.write(`${JSON.stringify({ findings: result.findings, scanned: result.scanned }, null, 2)}\n`);
    }

    if (result.findings.length > 0) {
        if (!quiet && !asJson) {
            process.stderr.write(
                `❌  lint_eval_specs: ${String(result.findings.length)} finding(s) in the measurement inputs:\n`,
            );
            for (const f of result.findings) {
                const at = f.line === undefined ? f.file : `${f.file}:${String(f.line)}`;
                process.stderr.write(`   ${at}  ${f.kind}  ${f.message}\n`);
            }
        }
        ledger?.report(quiet ? () => undefined : undefined);
        return 1;
    }
    ledger?.report(quiet ? () => undefined : undefined);
    if (!quiet && !asJson) {
        process.stdout.write(
            `✅  lint_eval_specs: ${String(result.scanned)} specification(s) clean.\n`,
        );
    }
    return 0;
}

/* c8 ignore start */
function isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    return pathToFileURL(path.resolve(process.argv[1])).href === pathToFileURL(_HERE).href;
}
if (isCliEntry()) {
    process.exit(main());
}
/* c8 ignore stop */
