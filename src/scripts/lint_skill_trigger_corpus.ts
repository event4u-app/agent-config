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
 * on the case — and declaration is checked. Forward-only, because zero of the
 * 76 existing files carry the field: requiring it everywhere today would red
 * 76 files for a field that did not exist when they were written.
 *
 * ## Forward-only, in two different senses
 *
 * The COUNT discipline (>=3 positives, >=2 near-misses) applies to every file
 * today: exactly two files fail it, and both are listed as grandfathered by
 * name rather than by a numeric baseline, so a third failure cannot hide inside
 * a count. The LANGUAGE discipline applies only to files the diff adds or
 * changes.
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

export const MIN_POSITIVES = 3;
export const MIN_NEAR_MISSES = 2;

/**
 * The two corpus files that predate the discipline, named rather than counted.
 *
 * A numeric baseline would let a third failure arrive while the number stayed
 * put if one of these were fixed in the same change. Names cannot do that.
 */
export const GRANDFATHERED = new Set(['brand-asset-generation', 'estimate-ticket']);

export interface CorpusStats {
    unit: string;
    positives: number;
    nearMisses: number;
    germanPositives: number;
    /** True when at least one case declares a language at all. */
    declaresLanguage: boolean;
}

export interface Violation {
    unit: string;
    rule: 'positives' | 'near-misses' | 'german' | 'malformed';
    message: string;
}

interface RawCase {
    q?: string;
    trigger?: boolean;
    language?: string;
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
    return {
        unit,
        positives,
        nearMisses,
        germanPositives: queries.filter((q) => q.trigger === true && q.language === 'de').length,
        declaresLanguage: queries.some((q) => typeof q.language === 'string'),
    };
}

export function judge(s: CorpusStats, requireLanguage: boolean): Violation[] {
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
    if (requireLanguage && s.germanPositives < 1) {
        out.push({
            unit: s.unit,
            rule: 'german',
            message:
                'no positive declares `"language": "de"`. Declared, never detected — ' +
                'a detector would pass German-looking English and fail short German',
        });
    }
    return out;
}

/** Corpus files the diff added or modified, relative to a base ref. */
export function changedUnits(root: string, base: string): Set<string> {
    let out = '';
    try {
        out = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], {
            cwd: root,
            encoding: 'utf-8',
            // Silenced deliberately: outside a repo (a self-test fixture, a
            // tarball install) git prints its whole usage text to stderr, and
            // a gate that dumps a manual page on a path it already handles is
            // noise a reader has to learn to ignore.
            stdio: ['ignore', 'pipe', 'ignore'],
        });
    } catch {
        return new Set();
    }
    const units = new Set<string>();
    for (const line of out.split('\n')) {
        const m = /^src\/skills\/([^/]+)\/evals\/triggers\.json$/.exec(line.trim());
        if (m?.[1] !== undefined) units.add(m[1]);
    }
    return units;
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
    const changed = changedUnits(root, base);
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
            own = judge(statsFor(e.name, file), changed.has(e.name));
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
            'zero corpus files found under src/skills/*/evals/triggers.json — 76 exist ' +
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
        return root;
    };
    const run = (root: string): number => {
        process.env['LINT_SKILL_TRIGGER_CORPUS_ROOT'] = root;
        try {
            return runGateCli(REAL_REPO_ROOT, 'src/scripts/lint_skill_trigger_corpus.ts', [], root);
        } finally {
            delete process.env['LINT_SKILL_TRIGGER_CORPUS_ROOT'];
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
    ];
    try {
        return runSelfTest({
            gate: 'lint_skill_trigger_corpus',
            cases,
            minCases: 7,
            minRejectCases: 4,
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
                `${String(GRANDFATHERED.size)} grandfathered by name).\n`,
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
