#!/usr/bin/env tsx
/**
 * `lint_skill_trigger_corpus` — the routing-matrix corpus DISCIPLINE, applied
 * to the skill corpus that already exists.
 *
 * `road-to-routing-assurance` Phase 2.1, as re-scoped by the AI council
 * (2/2 convergent, recorded at the step): the roadmap's literal text said "one
 * YAML per skill", which would have created a THIRD corpus surface next to the
 * 74 `queries`-shaped and 2 `should_trigger`-shaped JSON files already in the
 * tree. The step's *verify* condition is format-agnostic — "a corpus file
 * failing the discipline is rejected by a schema check, not by review" — so the
 * discipline is enforced on the existing JSON and the amendment is recorded
 * rather than performed silently.
 *
 * ## Three separate contracts, and this gate owns exactly one
 *
 * The council's sharpest point: serialization, case semantics, and coverage are
 * three different questions and choosing JSON answers only the first.
 *
 *   - **Coverage** — how many skills have a corpus at all — is
 *     `check_routing_coverage`'s ratio, and stays there.
 *   - **Discipline** — is each covered skill's corpus adequate — is this gate.
 *   - **Semantics** — is a `trigger: false` case a genuine NEAR-MISS rather
 *     than an unrelated negative — is NOT machine-decidable and this gate does
 *     not pretend otherwise. It counts negatives; whether they are near enough
 *     to be informative stays a human read, and saying so is cheaper than a
 *     heuristic that would be wrong quietly.
 *
 * ## Why language is metadata, never detection
 *
 * The discipline asks for at least one German positive. A gate that *detected*
 * German would be a heuristic in a file called a schema check: it would pass a
 * German-looking English sentence and fail a short German one, and its
 * failures would be unactionable. So German is declared — `"language": "de"`
 * on the case — and declaration is checked. Forward-only, because the field
 * postdates almost every corpus: 25 of the 100 files in the shipped tree carry
 * it today, so requiring it everywhere would red 75 files for a field that did
 * not exist when they were written. (Both numbers move as corpora land; they
 * are stated as of 2026-08-30 and are illustration, not a threshold — nothing
 * reads them.)
 *
 * ## Forward-only, in three senses now
 *
 * The COUNT discipline (>=3 positives, >=2 near-misses) applies to every file
 * today: exactly two files fail it, and both are listed as grandfathered by
 * name rather than by a numeric baseline, so a third failure cannot hide inside
 * a count. The LANGUAGE discipline applies only to files the diff adds or
 * changes. So, since 2026-08-30, does the CASE-CLASS discipline.
 *
 * ## The case class — three semantic classes, declared, never inferred
 *
 * `road-to-governed-harness-evolution` step 2.3 asked for a four-class corpus
 * where this gate had two: the boolean. AI council 2026-08-30, anthropic +
 * openai, 2/2 convergent, re-scoped it to THREE semantic classes on this
 * surface and moved the fourth elsewhere:
 *
 *   - `exemplar`       — a success case; requires `trigger: true`.
 *   - `near-miss`      — vocabulary genuinely overlaps a neighbour, and the
 *                        answer is still no; requires `trigger: false`.
 *   - `counterexample` — unrelated, guarding over-triggering rather than a
 *                        neighbour; requires `trigger: false`.
 *
 * The fourth class the step named — `failure`, a case the routing gets wrong
 * TODAY — is deliberately NOT here. Both seats reached the same reason
 * independently: it is an ORTHOGONAL axis. `exemplar` / `near-miss` /
 * `counterexample` describe intended routing; `failure` describes observed
 * behaviour, and one case can be both. A corpus file is a regression LOCK, so
 * a known-wrong case placed in it is red by construction, and a rule requiring
 * one per file would reward deliberately broken routing.
 *
 * This does not contradict `:20-26` above. That paragraph says the near-miss /
 * unrelated-negative distinction is not machine-DECIDABLE, and it still is not:
 * nothing here detects it. The class is DECLARED by the author and the
 * declaration is validated — precisely the mechanism the German requirement
 * already uses two paragraphs up, for the same reason.
 *
 * Exit codes: 0 = clean · 1 = a discipline violation · 2 = dead scope.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { type SelfTestCase, runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';

const HERE = fileURLToPath(import.meta.url);
const REAL_REPO_ROOT = path.resolve(path.dirname(HERE), '..', '..');
const REPO_ROOT = process.env['LINT_SKILL_TRIGGER_CORPUS_ROOT'] ?? REAL_REPO_ROOT;

/**
 * Treat every scanned unit as diff-touched, so the forward-only disciplines
 * apply to all of them.
 *
 * This can only ever WIDEN the checked set — there is no direction in which it
 * suppresses a finding — which is what makes it safe to honour from the
 * environment. `--self-test` needs it because its fixtures live in a temporary
 * directory that is not a git repository, so `changedUnits` finds nothing
 * there and the class rules would be silently unreachable: a self-test that
 * cannot reach the rule it claims to prove is the exact no-op this harness
 * exists to catch.
 */
function forwardAll(): boolean {
    // Read per CALL, not at module load. `selfTest` spawns a subprocess so a
    // module-level const worked there by accident; an in-process caller — a
    // unit test, or any future embedder — could not reach the flag at all,
    // which made the widening path itself untestable without a spawn.
    return process.env['LINT_SKILL_TRIGGER_CORPUS_FORWARD_ALL'] === '1';
}

export const MIN_POSITIVES = 3;
export const MIN_NEAR_MISSES = 2;

/**
 * The two corpus files that predate the discipline, named rather than counted.
 *
 * A numeric baseline would let a third failure arrive while the number stayed
 * put if one of these were fixed in the same change. Names cannot do that.
 */
export const GRANDFATHERED = new Set(['brand-asset-generation', 'estimate-ticket']);

/**
 * The closed case-class vocabulary, and the polarity each class requires.
 *
 * Polarity is part of the vocabulary rather than a separate convention: a
 * `near-miss` carrying `trigger: true` is not a near miss, it is a positive
 * that was mislabelled, and a class system that cannot say so buys nothing
 * over a free-text tag.
 */
export const CASE_CLASS_POLARITY: Readonly<Record<string, boolean>> = {
    exemplar: true,
    'near-miss': false,
    counterexample: false,
};

export const CASE_CLASSES: readonly string[] = Object.keys(CASE_CLASS_POLARITY);

export interface CorpusStats {
    unit: string;
    positives: number;
    nearMisses: number;
    germanPositives: number;
    /** True when at least one case declares a language at all. */
    declaresLanguage: boolean;
    /** Cases in the `queries` shape that declare no `class` at all. */
    unclassified: number;
    /** Declared class values outside the closed vocabulary, as written. */
    badClassValues: string[];
    /** Cases whose declared class contradicts their `trigger` boolean. */
    classPolarityErrors: string[];
    /** Which vocabulary members appear at least once. */
    classesPresent: string[];
    /**
     * True when the file uses the legacy `should_trigger` / `should_not_trigger`
     * arrays, whose entries are bare strings and cannot carry a class.
     */
    legacyShape: boolean;
}

export interface Violation {
    unit: string;
    rule:
        | 'positives'
        | 'near-misses'
        | 'german'
        | 'malformed'
        | 'class-missing'
        | 'class-vocab'
        | 'class-polarity'
        | 'class-coverage'
        | 'class-shape';
    message: string;
}

interface RawCase {
    q?: string;
    trigger?: boolean;
    language?: string;
    class?: unknown;
}

/** Read one corpus file into counts, across both shapes that exist. */
export function statsFor(unit: string, file: string): CorpusStats {
    const doc = JSON.parse(fs.readFileSync(file, 'utf-8')) as {
        queries?: RawCase[];
        should_trigger?: string[];
        should_not_trigger?: string[];
    };
    const queries = doc.queries ?? [];
    let positives = queries.filter((q) => q.trigger === true).length;
    let nearMisses = queries.filter((q) => q.trigger === false).length;
    positives += (doc.should_trigger ?? []).length;
    nearMisses += (doc.should_not_trigger ?? []).length;

    const badClassValues: string[] = [];
    const classPolarityErrors: string[] = [];
    const present = new Set<string>();
    let unclassified = 0;
    for (const q of queries) {
        const raw = q.class;
        if (raw === undefined || raw === null || raw === '') {
            unclassified += 1;
            continue;
        }
        if (typeof raw !== 'string' || !(raw in CASE_CLASS_POLARITY)) {
            badClassValues.push(String(raw));
            continue;
        }
        present.add(raw);
        if (q.trigger !== CASE_CLASS_POLARITY[raw]) {
            classPolarityErrors.push(`${raw} on \`trigger: ${String(q.trigger)}\``);
        }
    }

    return {
        unit,
        positives,
        nearMisses,
        germanPositives: queries.filter((q) => q.trigger === true && q.language === 'de').length,
        declaresLanguage: queries.some((q) => typeof q.language === 'string'),
        unclassified,
        badClassValues,
        classPolarityErrors,
        classesPresent: [...present].sort(),
        legacyShape:
            (doc.should_trigger ?? []).length > 0 || (doc.should_not_trigger ?? []).length > 0,
    };
}

/**
 * `forward` is the diff-touched flag: true when this corpus file was added or
 * changed against the base ref. The COUNT discipline ignores it; the LANGUAGE
 * and CASE-CLASS disciplines are gated on it, so an untouched file authored
 * before either existed is not red for a field that did not exist when it was
 * written. Migration is by touch: the file that changes migrates.
 */
export function judge(s: CorpusStats, forward: boolean): Violation[] {
    const out: Violation[] = [];
    if (GRANDFATHERED.has(s.unit)) return out;
    if (s.positives < MIN_POSITIVES) {
        out.push({
            unit: s.unit,
            rule: 'positives',
            message: `${String(s.positives)} positive(s), the discipline asks for ${String(MIN_POSITIVES)}`,
        });
    }
    if (s.nearMisses < MIN_NEAR_MISSES) {
        out.push({
            unit: s.unit,
            rule: 'near-misses',
            message: `${String(s.nearMisses)} near-miss(es), the discipline asks for ${String(MIN_NEAR_MISSES)}`,
        });
    }
    if (forward && s.germanPositives < 1) {
        out.push({
            unit: s.unit,
            rule: 'german',
            message:
                'no positive declares `"language": "de"`. Declared, never detected — ' +
                'a detector would pass German-looking English and fail short German',
        });
    }
    if (forward) out.push(...judgeClasses(s));
    return out;
}

/**
 * The case-class rules, all forward-only. Split out so the findings read as one
 * discipline rather than as unrelated additions to `judge`.
 *
 * **`class-shape` cannot fire on the tree as it stands, and that is stated
 * rather than left to be discovered** (completion review, 2026-08-30). It fires
 * on a legacy-shaped corpus; the only two legacy-shaped files in the tree are
 * exactly the two `GRANDFATHERED` units, and `judge` returns before reaching
 * here for those. So it is a FORWARD guard — it catches a legacy-shaped file
 * added from now on, or a grandfathered one promoted — not a rule with live
 * coverage. It is exercised by synthetic fixtures in `--self-test`, so it is
 * tested; what it is not is currently reachable from real data. Counting it
 * among the rules this gate enforces TODAY would inflate the coverage claim,
 * which is the failure this whole file exists to prevent one level down.
 */
function judgeClasses(s: CorpusStats): Violation[] {
    const out: Violation[] = [];
    const vocab = CASE_CLASSES.join(' | ');
    if (s.legacyShape) {
        out.push({
            unit: s.unit,
            rule: 'class-shape',
            message:
                'the `should_trigger` / `should_not_trigger` arrays hold bare strings and ' +
                'cannot carry a case class — migrate this file to the `queries` shape',
        });
        return out;
    }
    if (s.unclassified > 0) {
        out.push({
            unit: s.unit,
            rule: 'class-missing',
            message:
                `${String(s.unclassified)} case(s) declare no \`class\` (${vocab}). ` +
                'Declared, never inferred — the near-miss / counterexample split is not ' +
                'machine-decidable, so the author states it and the gate checks the statement',
        });
    }
    if (s.badClassValues.length > 0) {
        out.push({
            unit: s.unit,
            rule: 'class-vocab',
            message: `class outside the closed vocabulary (${vocab}): ${s.badClassValues.sort().join(', ')}`,
        });
    }
    if (s.classPolarityErrors.length > 0) {
        out.push({
            unit: s.unit,
            rule: 'class-polarity',
            message:
                'class contradicts its own `trigger` boolean: ' +
                `${s.classPolarityErrors.sort().join(', ')}. \`exemplar\` is a positive; ` +
                '`near-miss` and `counterexample` are negatives',
        });
    }
    const missing = CASE_CLASSES.filter((c) => !s.classesPresent.includes(c));
    if (missing.length > 0) {
        out.push({
            unit: s.unit,
            rule: 'class-coverage',
            message:
                `no case carries ${missing.join(' or ')}. A corpus of positives and ` +
                'near-misses alone cannot show whether the skill over-triggers on ' +
                'unrelated input, which is what a counterexample is for',
        });
    }
    return out;
}

/**
 * What the diff scope actually is — three states, deliberately not collapsed.
 *
 * The previous shape returned a bare `Set` and an empty one meant BOTH "the
 * diff touched no corpus file" and "git could not answer". Those are opposite
 * facts: the first is a clean tree, the second is a gate that cannot know what
 * changed. Collapsing them made every forward-only rule a silent no-op wherever
 * the base ref does not resolve — a shallow clone, a fork remote, a tarball, a
 * worktree that never fetched — while `main()` still printed its success line
 * asserting the discipline had run. A gate that reports green on a scope it
 * could not read is the exact failure `DeadScopeError` exists for, applied one
 * level up from the population to the DIFF.
 */
export type ChangedScope =
    | { kind: 'diff'; units: Set<string> }
    | { kind: 'no-repo' }
    | { kind: 'base-unresolvable'; base: string };

function gitOk(root: string, args: readonly string[]): boolean {
    try {
        execFileSync('git', [...args], {
            cwd: root,
            encoding: 'utf-8',
            // Silenced deliberately: outside a repo git prints its whole usage
            // text to stderr, and a gate that dumps a manual page on a path it
            // already handles is noise a reader has to learn to ignore.
            stdio: ['ignore', 'ignore', 'ignore'],
        });
        return true;
    } catch {
        return false;
    }
}

/** Corpus files the diff added or modified, relative to a base ref. */
export function changedUnits(root: string, base: string): ChangedScope {
    if (!gitOk(root, ['rev-parse', '--git-dir'])) return { kind: 'no-repo' };
    if (!gitOk(root, ['rev-parse', '--verify', '--quiet', base])) {
        return { kind: 'base-unresolvable', base };
    }
    let out = '';
    try {
        out = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], {
            cwd: root,
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });
    } catch {
        // The ref resolved a line ago, so a failure here is not "no diff".
        return { kind: 'base-unresolvable', base };
    }
    const units = new Set<string>();
    for (const line of out.split('\n')) {
        const m = /^src\/skills\/([^/]+)\/evals\/triggers\.json$/.exec(line.trim());
        if (m?.[1] !== undefined) units.add(m[1]);
    }
    return { kind: 'diff', units };
}

export interface Result {
    violations: Violation[];
    scanned: number;
    ledger: GateLedger;
}

export function evaluate(root = REPO_ROOT, base = 'origin/main'): Result {
    const dir = path.join(root, 'src', 'skills');
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        throw new DeadScopeError(
            'lint_skill_trigger_corpus',
            'src/skills is unreadable — a corpus gate with no corpus passes every tree.',
        );
    }
    const scope = changedUnits(root, base);
    // FORWARD_ALL widens to every unit, so it needs no diff and is checked
    // first — that is what keeps `--self-test`, which runs in a temporary
    // non-repo directory, reachable.
    const wideMode = forwardAll();
    if (!wideMode && scope.kind !== 'diff') {
        throw new DeadScopeError(
            'lint_skill_trigger_corpus',
            scope.kind === 'no-repo'
                ? 'not a git repository, so the diff scope cannot be read and every ' +
                  'forward-only rule would be unreachable while this gate printed green. ' +
                  'Run it inside the repo, or set LINT_SKILL_TRIGGER_CORPUS_FORWARD_ALL=1 ' +
                  'to check every unit instead.'
                : `base ref ${scope.base} does not resolve, so the diff scope cannot be ` +
                  'read and every forward-only rule would be unreachable while this gate ' +
                  'printed green. Fetch it (`git fetch origin main`) or pass a base that ' +
                  'exists; LINT_SKILL_TRIGGER_CORPUS_FORWARD_ALL=1 checks every unit instead.',
        );
    }
    const changed = scope.kind === 'diff' ? scope.units : new Set<string>();
    const ledger = new GateLedger('lint_skill_trigger_corpus');
    const violations: Violation[] = [];
    let scanned = 0;
    for (const e of entries) {
        if (!e.isDirectory()) continue;
        const file = path.join(dir, e.name, 'evals', 'triggers.json');
        if (!fs.existsSync(file)) continue;
        scanned += 1;
        ledger.plan(e.name);
        let own: Violation[];
        try {
            own = judge(statsFor(e.name, file), wideMode || changed.has(e.name));
        } catch {
            own = [{ unit: e.name, rule: 'malformed', message: 'is not parseable JSON' }];
        }
        if (own.length === 0) ledger.complete(e.name);
        else ledger.fail(e.name, own.map((v) => `[${v.rule}] ${v.message}`).join(' · '));
        violations.push(...own);
    }
    if (scanned === 0) {
        throw new DeadScopeError(
            'lint_skill_trigger_corpus',
            'zero corpus files found under src/skills/*/evals/triggers.json — 100 exist ' +
                'in the shipped tree, so an empty scan is a moved root, not a clean one.',
        );
    }
    return { violations, scanned, ledger };
}

export function selfTest(): number {
    const os = process.env['TMPDIR'] ?? '/tmp';
    const tmp = fs.mkdtempSync(path.join(os, 'lstc-'));
    const mkRoot = (unit: string, body: unknown): string => {
        const root = fs.mkdtempSync(path.join(tmp, 'repo-'));
        const d = path.join(root, 'src', 'skills', unit, 'evals');
        fs.mkdirSync(d, { recursive: true });
        fs.writeFileSync(path.join(d, 'triggers.json'), JSON.stringify(body));
        // A REAL repo with a resolvable `origin/main`, not a bare directory.
        //
        // The non-forward arms below assert that a corpus is accepted when it
        // is NOT diff-touched, and they used to get that for free: outside a
        // repo `changedUnits` returned an empty set, which the gate could not
        // distinguish from a clean diff. That conflation was the finding this
        // branch fixed — an unreadable diff now REFUSES — so the fixtures have
        // to supply the condition they were only ever simulating. Committing
        // the file and pointing `origin/main` at that same commit makes the
        // diff genuinely empty, which is what those arms mean.
        const git = (...args: string[]): void => {
            execFileSync('git', args, {
                cwd: root,
                stdio: ['ignore', 'ignore', 'ignore'],
                env: {
                    ...process.env,
                    GIT_AUTHOR_NAME: 'selftest',
                    GIT_AUTHOR_EMAIL: 'selftest@invalid',
                    GIT_COMMITTER_NAME: 'selftest',
                    GIT_COMMITTER_EMAIL: 'selftest@invalid',
                },
            });
        };
        git('init', '-q');
        git('add', '-A');
        git('commit', '-q', '-m', 'fixture');
        git('update-ref', 'refs/remotes/origin/main', 'HEAD');
        return root;
    };
    const run = (root: string, forwardAll = false): number => {
        process.env['LINT_SKILL_TRIGGER_CORPUS_ROOT'] = root;
        if (forwardAll) process.env['LINT_SKILL_TRIGGER_CORPUS_FORWARD_ALL'] = '1';
        try {
            return runGateCli(REAL_REPO_ROOT, 'src/scripts/lint_skill_trigger_corpus.ts', [], root);
        } finally {
            delete process.env['LINT_SKILL_TRIGGER_CORPUS_ROOT'];
            delete process.env['LINT_SKILL_TRIGGER_CORPUS_FORWARD_ALL'];
        }
    };
    const good = {
        queries: [
            { q: 'a', trigger: true },
            { q: 'b', trigger: true },
            { q: 'c', trigger: true },
            { q: 'd', trigger: false },
            { q: 'e', trigger: false },
        ],
    };
    /** The same corpus, fully classified and German-declared — forward-clean. */
    const classified = {
        queries: [
            { q: 'a', trigger: true, class: 'exemplar' },
            { q: 'b', trigger: true, class: 'exemplar' },
            { q: 'c', trigger: true, class: 'exemplar', language: 'de' },
            { q: 'd', trigger: false, class: 'near-miss' },
            { q: 'e', trigger: false, class: 'counterexample' },
        ],
    };
    const mutate = (fn: (qs: Record<string, unknown>[]) => Record<string, unknown>[]) => ({
        queries: fn(JSON.parse(JSON.stringify(classified.queries)) as Record<string, unknown>[]),
    });
    const cases: SelfTestCase[] = [
        {
            name: 'a compliant corpus is accepted',
            expect: 'accept',
            run: () => run(mkRoot('probe', good)),
        },
        {
            name: 'the should_trigger shape is read, not silently skipped',
            expect: 'accept',
            run: () =>
                run(
                    mkRoot('probe', {
                        should_trigger: ['a', 'b', 'c'],
                        should_not_trigger: ['d', 'e'],
                    }),
                ),
        },
        {
            name: 'a grandfathered unit stays accepted at zero cases',
            expect: 'accept',
            run: () => run(mkRoot('estimate-ticket', { queries: [] })),
        },
        {
            name: 'too few positives is rejected',
            expect: 'reject',
            run: () => run(mkRoot('probe', { queries: good.queries.slice(1) })),
        },
        {
            name: 'too few near-misses is rejected',
            expect: 'reject',
            run: () => run(mkRoot('probe', { queries: good.queries.slice(0, 4) })),
        },
        {
            name: 'a malformed corpus file is rejected, not skipped',
            expect: 'reject',
            run: () => {
                const root = mkRoot('probe', good);
                fs.writeFileSync(
                    path.join(root, 'src', 'skills', 'probe', 'evals', 'triggers.json'),
                    '{ not json',
                );
                return run(root);
            },
        },
        {
            name: 'a scan root with no corpus at all exits 2 rather than reporting clean',
            expect: 'reject',
            run: () => {
                const root = fs.mkdtempSync(path.join(tmp, 'empty-'));
                fs.mkdirSync(path.join(root, 'src', 'skills'), { recursive: true });
                return run(root);
            },
        },
        // --- case-class discipline, forward-only. Every case below runs with
        // the forward flag forced on; the pair at the end proves the flag is
        // what turns the rule on, so a rule that fired unconditionally would
        // be caught here rather than by a reviewer.
        {
            name: 'a fully classified corpus is accepted under the class discipline',
            expect: 'accept',
            run: () => run(mkRoot('probe', classified), true),
        },
        {
            name: 'an unclassified case is rejected',
            expect: 'reject',
            run: () =>
                run(
                    mkRoot(
                        'probe',
                        mutate((qs) => {
                            delete qs[0]?.['class'];
                            return qs;
                        }),
                    ),
                    true,
                ),
        },
        {
            name: 'a class outside the closed vocabulary is rejected',
            expect: 'reject',
            run: () =>
                run(
                    mkRoot(
                        'probe',
                        mutate((qs) => {
                            if (qs[0]) qs[0]['class'] = 'positive';
                            return qs;
                        }),
                    ),
                    true,
                ),
        },
        {
            name: 'a near-miss on trigger:true is rejected — polarity is part of the vocabulary',
            expect: 'reject',
            run: () =>
                run(
                    mkRoot(
                        'probe',
                        mutate((qs) => {
                            if (qs[0]) qs[0]['class'] = 'near-miss';
                            return qs;
                        }),
                    ),
                    true,
                ),
        },
        {
            name: 'an exemplar on trigger:false is rejected — the other polarity direction',
            expect: 'reject',
            run: () =>
                run(
                    mkRoot(
                        'probe',
                        mutate((qs) => {
                            if (qs[4]) qs[4]['class'] = 'exemplar';
                            return qs;
                        }),
                    ),
                    true,
                ),
        },
        {
            name: 'a corpus with no counterexample at all is rejected',
            expect: 'reject',
            run: () =>
                run(
                    mkRoot(
                        'probe',
                        mutate((qs) => {
                            if (qs[4]) qs[4]['class'] = 'near-miss';
                            return qs;
                        }),
                    ),
                    true,
                ),
        },
        {
            name: 'the legacy string-array shape is rejected under the class discipline',
            expect: 'reject',
            run: () =>
                run(
                    mkRoot('probe', {
                        should_trigger: ['a', 'b', 'c'],
                        should_not_trigger: ['d', 'e'],
                    }),
                    true,
                ),
        },
        {
            name: 'the SAME unclassified corpus is accepted when NOT diff-touched',
            expect: 'accept',
            run: () => run(mkRoot('probe', good), false),
        },
    ];
    try {
        return runSelfTest({
            gate: 'lint_skill_trigger_corpus',
            cases,
            minCases: 15,
            minRejectCases: 10,
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

export function main(argv: string[] = process.argv.slice(2), root = REPO_ROOT): number {
    if (argv.includes('--self-test')) return selfTest();
    const quiet = argv.includes('--quiet');
    let r: Result;
    try {
        r = evaluate(root);
        reportScanned({
            gate: 'lint_skill_trigger_corpus',
            scanned: r.scanned,
            units: 'skill corpus file(s)',
            roots: ['src/skills/*/evals/triggers.json'],
        });
    } catch (e) {
        if (e instanceof DeadScopeError) {
            process.stderr.write(`${e.message}\n`);
            return 2;
        }
        throw e;
    }
    r.ledger.report(quiet ? () => undefined : process.stdout.write.bind(process.stdout));
    if (r.violations.length === 0) {
        process.stdout.write(
            `lint_skill_trigger_corpus: ${String(r.scanned)} corpus file(s) hold the discipline ` +
                `(>=${String(MIN_POSITIVES)} positives, >=${String(MIN_NEAR_MISSES)} near-misses; ` +
                `${String(GRANDFATHERED.size)} grandfathered by name). Diff-touched files also ` +
                `carry a declared case class per query (${CASE_CLASSES.join(' | ')}).\n`,
        );
        return 0;
    }
    for (const v of r.violations) {
        process.stderr.write(`  ${v.unit}: [${v.rule}] ${v.message}\n`);
    }
    process.stderr.write(
        `${String(r.violations.length)} discipline violation(s). Add the missing cases — ` +
            'widening GRANDFATHERED is a defect, not a fix.\n',
    );
    return 1;
}

if (path.resolve(process.argv[1] ?? '') === path.resolve(HERE)) {
    process.exit(main());
}
