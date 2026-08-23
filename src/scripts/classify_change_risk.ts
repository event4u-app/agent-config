#!/usr/bin/env tsx
/**
 * Deterministic risk class for a change, computed from paths and diff shape.
 *
 * Step 0.3 of `road-to-target-project-assurance-readiness`. **No model call**, by
 * construction: the whole point is a class an agent cannot talk itself out of, and
 * a classifier that asks a model is the agent's self-label wearing a script's
 * clothes.
 *
 * Classes: `R0` cosmetic · `R1` internal · `R2` behaviour-changing · `R3` critical.
 *
 * TIES AND UNKNOWNS RESOLVE UPWARD. That is safe per change and corrosive in
 * aggregate — once most changes read R3 the owed gate set is noise and gets worked
 * around rather than met (Risk 2 of the roadmap). The mitigation is NOT to soften
 * the resolution: it is the nightly R3-rate metric, with **> 40 % of changes
 * classifying R3 named as a defect in the override list** rather than in the people
 * meeting the gates. So this file resolves upward and the drift ledger is what
 * catches an over-broad override list.
 *
 * SELF-PROTECTION. Changes to this classifier, the override list, the hook
 * directories, CI workflows, or the agent's own config are R3 **by construction** —
 * the one place the system can defend itself against being talked down. It is a
 * deliberate refusal to be configurable: an override list that can be lowered by a
 * change the list itself classifies as cosmetic protects nothing.
 *
 * WHAT THIS DOES NOT DO, and it is the reason the roadmap closed on a null: nothing
 * consumes this class. Wiring it into `verify-completion-evidence` is Phase 2, and
 * Phase 2 is cancelled on the pre-registered null route because the human-labelled
 * corpus the class would have been validated against cannot be produced. Giving an
 * unvalidated class real authority over every completion claim is Risk 7. So this
 * ships as a **measurement instrument feeding the nightly drift ledger**, and its
 * verdict owes no gate.
 */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export type RiskClass = 'R0' | 'R1' | 'R2' | 'R3';

const ORDER: readonly RiskClass[] = ['R0', 'R1', 'R2', 'R3'];

/** Upward resolution, expressed once so no caller can pick the other direction. */
export function higher(a: RiskClass, b: RiskClass): RiskClass {
    return ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b;
}

/**
 * Paths whose touch is R3 regardless of anything else.
 *
 * Two groups, and they are listed together because they fail the same way when
 * split: a reviewer reading only one of them cannot tell whether a path is missing
 * on purpose.
 *
 * (1) DOMAIN-CRITICAL — auth, migrations, payment, billing, IaC. These are the
 *     surfaces where a wrong class costs money or exposes data.
 * (2) SELF-PROTECTION — this file, the assurance policy, hook directories, CI
 *     workflows, and the agent's own settings. Without these the classifier is
 *     one cosmetic-looking commit away from classifying itself down.
 */
export const R3_PATH_PATTERNS: readonly RegExp[] = [
    // (1) domain-critical
    /(^|\/)auth(\/|$)/i,
    /(^|\/)migrations?(\/|$)/i,
    /payment/i,
    /billing/i,
    /(^|\/)(terraform|terragrunt)(\/|$)/i,
    /\.tf$/i,
    /(^|\/)k8s(\/|$)/i,
    /(^|\/)helm(\/|$)/i,
    // (2) self-protection
    /(^|\/)classify_change_risk\.ts$/,
    /(^|\/)assurance-policy\.json$/,
    /(^|\/)\.github\/workflows\//,
    /(^|\/)hooks?\//,
    /(^|\/)hook_manifest\.(yaml|json)$/,
    /(^|\/)\.agent-settings\.ya?ml$/,
    /(^|\/)agent-settings[^/]*\.ya?ml$/,
    /(^|\/)src\/config\//,
];

/** Dependency manifests and lockfiles — a supply-chain surface, so at least R2. */
export const DEPENDENCY_PATTERNS: readonly RegExp[] = [
    /(^|\/)package(-lock)?\.json$/,
    /(^|\/)pnpm-lock\.yaml$/,
    /(^|\/)yarn\.lock$/,
    /(^|\/)composer\.(json|lock)$/,
    /(^|\/)(requirements[^/]*\.txt|pyproject\.toml|poetry\.lock|Pipfile(\.lock)?)$/,
    /(^|\/)go\.(mod|sum)$/,
    /(^|\/)Cargo\.(toml|lock)$/,
];

/**
 * Paths that carry no behaviour.
 *
 * A change touching ONLY these is R0. Deliberately narrow — markdown, licences,
 * editor config, images. `.json` is NOT here: a JSON file is as likely to be a
 * policy as a fixture, and guessing wrong resolves downward, which is the one
 * direction this classifier may not guess in.
 */
export const COSMETIC_PATTERNS: readonly RegExp[] = [
    /\.(md|markdown|txt|rst|adoc)$/i,
    /\.(png|jpe?g|gif|svg|webp|ico)$/i,
    /(^|\/)(LICENSE|NOTICE|CODEOWNERS|\.gitignore|\.editorconfig|\.gitattributes)$/,
];

/** Source extensions whose edit can change behaviour. */
const CODE_RE = /\.(ts|tsx|js|jsx|mjs|cjs|py|php|go|rs|rb|java|kt|swift|sh|bash)$/i;

/** Test paths — code, but an edit confined to them is internal by default. */
const TEST_RE = /(^|\/)(tests?|__tests__|spec)(\/|$)|\.(test|spec)\.[a-z]+$/i;

export interface Classification {
    readonly cls: RiskClass;
    /** The single reason that BOUND the class — never a list of contributors. */
    readonly reason: string;
}

/**
 * Classify a change from its touched paths.
 *
 * Reports the reason that BOUND the class, not every reason that applied, for the
 * same argument the readiness matrix makes about its binding dimension: a list of
 * contributing factors invites averaging, and the class is a max rather than a mean.
 */
export function classifyPaths(paths: readonly string[]): Classification {
    if (paths.length === 0) {
        // An empty diff is UNKNOWN, not cosmetic. Upward resolution applies to the
        // absence of evidence exactly as it applies to ambiguous evidence — and a
        // caller passing no paths has not told us the change is empty, only that it
        // did not say.
        return { cls: 'R3', reason: 'no paths supplied — unknown resolves upward' };
    }
    const norm = paths.map((p) => p.replace(/^\.\//, ''));

    for (const p of norm) {
        for (const re of R3_PATH_PATTERNS) {
            if (re.test(p)) return { cls: 'R3', reason: `override-list path: ${p}` };
        }
    }
    for (const p of norm) {
        for (const re of DEPENDENCY_PATTERNS) {
            if (re.test(p)) return { cls: 'R2', reason: `dependency manifest: ${p}` };
        }
    }
    if (norm.every((p) => COSMETIC_PATTERNS.some((re) => re.test(p)))) {
        return { cls: 'R0', reason: 'every touched path is non-behavioural' };
    }
    const nonTestCode = norm.filter((p) => CODE_RE.test(p) && !TEST_RE.test(p));
    if (nonTestCode.length > 0) {
        return { cls: 'R2', reason: `production code touched: ${nonTestCode[0]!}` };
    }
    if (norm.some((p) => TEST_RE.test(p))) {
        return { cls: 'R1', reason: 'test-only change' };
    }
    // Reached only by a path that is neither cosmetic, nor code, nor a test, nor on
    // a list — a config or data file the patterns above do not name. Upward.
    return { cls: 'R2', reason: `unrecognised path shape: ${norm[0]!}` };
}

/** `git diff --name-only <range>` — the only git call this script makes. */
export function changedPaths(range: string, cwd = REPO_ROOT): string[] {
    const r = spawnSync('git', ['diff', '--name-only', range], {
        cwd,
        encoding: 'utf-8',
        maxBuffer: 64 * 1024 * 1024,
    });
    if (r.status !== 0) return [];
    return (r.stdout || '')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l !== '');
}

function selfTest(): number {
    const rel = 'src/scripts/classify_change_risk.ts';
    const run = (args: readonly string[]): number => runGateCli(REPO_ROOT, rel, args, REPO_ROOT);
    return runSelfTest({
        gate: 'classify_change_risk',
        minCases: 6,
        minRejectCases: 2,
        cases: [
            {
                // 2.3's property, as far as it can be proven without Phase 2's
                // policy file: an edit to the classifier itself is R3.
                name: 'the classifier classifies an edit to ITSELF as R3',
                expect: 'accept',
                run: () => run(['--paths', rel, '--assert-class', 'R3']),
            },
            {
                name: 'a CI workflow edit is R3',
                expect: 'accept',
                run: () => run(['--paths', '.github/workflows/tests.yml', '--assert-class', 'R3']),
            },
            {
                name: 'a docs-only change is R0',
                expect: 'accept',
                run: () => run(['--paths', 'README.md', '--assert-class', 'R0']),
            },
            {
                name: 'a test-only change is R1',
                expect: 'accept',
                run: () => run(['--paths', 'tests/scripts/x.test.ts', '--assert-class', 'R1']),
            },
            {
                // The reject arms matter more than the accept arms: a suite that
                // only proves passes proves the harness runs, not that the
                // classifier discriminates.
                name: 'asserting R0 for a migrations path is refused',
                expect: 'reject',
                run: () => run(['--paths', 'db/migrations/001.sql', '--assert-class', 'R0']),
            },
            {
                name: 'asserting R1 for production code is refused',
                expect: 'reject',
                run: () => run(['--paths', 'src/scripts/release.ts', '--assert-class', 'R1']),
            },
            {
                name: 'asserting R0 for an empty path set is refused (unknown resolves upward)',
                expect: 'reject',
                run: () => run(['--paths', '', '--assert-class', 'R0']),
            },
        ],
    });
}

export function main(argv: readonly string[]): number {
    if (argv.includes('--self-test')) {
        if (process.env['GATE_SELF_TEST_CHILD'] === '1') {
            process.stderr.write('classify_change_risk: refusing to recurse into --self-test\n');
            return 1;
        }
        return selfTest();
    }
    const pathsIdx = argv.indexOf('--paths');
    const rangeIdx = argv.indexOf('--range');
    const assertIdx = argv.indexOf('--assert-class');
    const json = argv.includes('--json');

    let paths: string[];
    if (pathsIdx >= 0) {
        paths = (argv[pathsIdx + 1] ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s !== '');
    } else {
        paths = changedPaths(rangeIdx >= 0 ? (argv[rangeIdx + 1] ?? 'HEAD~1...HEAD') : 'HEAD~1...HEAD');
    }

    const v = classifyPaths(paths);
    if (json) {
        process.stdout.write(
            JSON.stringify({ class: v.cls, reason: v.reason, files: paths.length }) + '\n',
        );
    } else {
        process.stdout.write(`${v.cls} — ${v.reason} (${String(paths.length)} file(s))\n`);
    }

    if (assertIdx >= 0) {
        const want = argv[assertIdx + 1];
        if (want !== v.cls) {
            process.stderr.write(`classify_change_risk: expected ${String(want)}, got ${v.cls}\n`);
            return 1;
        }
    }
    return 0;
}

function _isCliEntry(): boolean {
    const invoked = process.argv[1];
    return invoked !== undefined && path.resolve(invoked) === path.resolve(_HERE);
}

if (_isCliEntry()) {
    process.exit(main(process.argv.slice(2)));
}
