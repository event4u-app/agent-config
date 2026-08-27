/**
 * A present-tense supervision claim on a public surface must be backed by a
 * lifecycle result from THIS revision, or it does not ship.
 *
 * `road-to-runtime-governance-flip` step 3.4. ADR-249 permits a supervised
 * resident process in core and deliberately does **not** assert that one behaves
 * as described — nothing supervised has shipped. The gap between "we adopted
 * this policy" and "this property holds" is exactly where an unproven capability
 * claim lands on a public page, and the roadmap's Phase 3 exists because the
 * first draft would have let it.
 *
 * **What the gate refuses.** A public surface asserting, in the present tense,
 * that a resident process IS supervised / bounded / isolated / auto-restarted /
 * lifecycle-managed — while no lifecycle evidence for the current revision
 * exists. The policy statement ADR-249 authorises is not a claim of this kind
 * and is not matched: "resident processes are permitted only under the
 * supervision contract" names an adopted rule, and the patterns below are
 * written to require a copula plus a property, not a permission.
 *
 * **Why a file-presence check is not enough.** A council seat named this
 * directly: "a file-presence check can masquerade as evidence". So the evidence
 * artifact must establish four separate things, and each is a distinct refusal:
 *
 * 1. the named suite exists at all;
 * 2. it ran on **this** revision (`revision` equals `git rev-parse HEAD`);
 * 3. it exercised **real processes** (`processes_exercised: true`);
 * 4. its result was neither empty nor skipped (`cases_run > 0`, and
 *    `cases_run > cases_skipped`).
 *
 * A suite that ran on a parent commit, a suite with every case skipped, and a
 * suite that mocked the process layer are three different lies, and a gate that
 * collapses them into "the file is there" catches none of them.
 *
 * **Today it passes vacuously, and says so.** No public surface carries a
 * supervision claim, so the evidence side is never reached. That is the correct
 * state — but a gate that scans a corpus and finds nothing is indistinguishable
 * from a blind one, which is why `--self-test` plants all three seeded negatives
 * and asserts each one reds.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { reportScanned } from './_lib/scan_scope.js';

/** Public surfaces a reader of this project actually lands on. */
export const PUBLIC_SURFACES = [
    'README.md',
    'docs/comparison.yaml',
    'docs/positioning-evidence.md',
    'docs/proof.md',
    'docs/us-vs-the-category.md',
    'docs/getting-started-by-role.md',
    'docs/governance-advantage.md',
    'docs/featured-skills.md',
] as const;

/** Where the dependent roadmap's lifecycle suite writes its result. */
export const EVIDENCE_REL = path.join('internal', 'reports', 'supervision-lifecycle.json');

/**
 * A present-tense assertion that a resident process HAS a runtime property.
 *
 * The subject is a process noun, the verb is a copula, and the object is a
 * property word. All three are required together, which is what keeps the
 * adopted-policy sentence out: "resident processes **are permitted** only under
 * the supervision contract" carries no property word, and "the supervision
 * contract ADR-249 **establishes**" has no copula binding a property to a
 * process.
 */
const PROCESS = String.raw`(?:resident process(?:es)?|daemon|background (?:process|worker)|collector|supervisor)`;
const COPULA = String.raw`(?:is|are|stays?|remains?|runs?)`;
const PROPERTY = String.raw`(?:supervised|bounded|isolated|sandboxed|auto-restarted|restart(?:ed|s)? automatically|lifecycle-managed|always (?:up|available)|crash-safe|self-healing)`;

export const SUPERVISION_CLAIM_RE = new RegExp(
    String.raw`\b${PROCESS}\b[^.\n]{0,60}?\b${COPULA}\b\s+(?:\w+\s+){0,3}?\b${PROPERTY}\b`,
    'i',
);

export interface Finding {
    readonly file: string;
    readonly line: number;
    readonly text: string;
    readonly reason: string;
}

export interface LifecycleEvidence {
    readonly suite?: string;
    readonly revision?: string;
    readonly processes_exercised?: boolean;
    readonly cases_run?: number;
    readonly cases_skipped?: number;
}

/**
 * The four evidence conditions, each returning its own refusal.
 *
 * Returns `null` when the evidence is sufficient. Separated from I/O so the
 * self-test can drive it with literal objects.
 */
export function evidenceRefusal(ev: LifecycleEvidence | null, headRevision: string): string | null {
    if (ev === null) {
        return `no lifecycle evidence at ${EVIDENCE_REL} — the suite that would back this claim does not exist`;
    }
    if (!ev.suite) {
        return `${EVIDENCE_REL} names no \`suite\` — an unnamed suite cannot be re-run by a reader`;
    }
    if (ev.revision !== headRevision) {
        return (
            `${EVIDENCE_REL} records revision ${ev.revision ?? '(none)'}, but HEAD is ${headRevision} — ` +
            'a result from another revision says nothing about the code being shipped'
        );
    }
    if (ev.processes_exercised !== true) {
        return `${EVIDENCE_REL} does not record \`processes_exercised: true\` — a suite that mocked the process layer did not test supervision`;
    }
    const run = ev.cases_run ?? 0;
    const skipped = ev.cases_skipped ?? 0;
    if (run <= 0) {
        return `${EVIDENCE_REL} records ${String(run)} cases run — an empty suite is not evidence`;
    }
    if (run <= skipped) {
        return `${EVIDENCE_REL} records ${String(run)} run against ${String(skipped)} skipped — a suite that skipped at least as much as it ran is not evidence`;
    }
    return null;
}

/** Read the evidence artifact, or `null` when it is absent or unparsable. */
export function readEvidence(root: string): LifecycleEvidence | null {
    const p = path.join(root, EVIDENCE_REL);
    if (!fs.existsSync(p)) return null;
    try {
        return JSON.parse(fs.readFileSync(p, 'utf8')) as LifecycleEvidence;
    } catch {
        return null;
    }
}

/** Scan the public surfaces. Pure over an explicit file list. */
export function scan(
    root: string,
    files: readonly string[],
    headRevision: string,
    ledger?: GateLedger,
): Finding[] {
    const findings: Finding[] = [];
    let refusal: string | null | undefined;

    for (const rel of files) {
        const abs = path.join(root, rel);
        // Plan BEFORE resolving, always. Resolving an unplanned target is a
        // ledger usage error, and it only shows up where a surface is missing —
        // never on the real tree, where all eight exist. Found by the self-test's
        // positive control, whose fixture repo has README.md and nothing else.
        ledger?.plan(rel);
        if (!fs.existsSync(abs)) {
            ledger?.skip(rel, 'absent_target');
            continue;
        }
        const lines = fs.readFileSync(abs, 'utf8').split('\n');
        let failedHere = '';
        for (const [i, line] of lines.entries()) {
            if (!SUPERVISION_CLAIM_RE.test(line)) continue;
            // Resolve the evidence once, and only when a claim is actually
            // found: an absent artifact is not a finding on its own, because
            // the correct state today is "no claim, no evidence, no gate".
            if (refusal === undefined) refusal = evidenceRefusal(readEvidence(root), headRevision);
            if (refusal === null) continue;
            findings.push({
                file: rel,
                line: i + 1,
                text: line.trim().slice(0, 160),
                reason: refusal,
            });
            if (failedHere === '') failedHere = `${rel}:${String(i + 1)} — ${refusal}`;
        }
        if (failedHere === '') ledger?.complete(rel);
        else ledger?.fail(rel, failedHere);
    }
    return findings;
}

function headRevisionOf(root: string): string {
    try {
        return execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    } catch {
        return '';
    }
}

/**
 * Three seeded negatives and one positive control, each driving the REAL CLI.
 *
 * Step 3.4 required the seeded negatives to be OBSERVED red rather than
 * asserted, and the three are separate on purpose: a suite that ran on a parent
 * commit, a suite that skipped every case, and a suite that mocked the process
 * layer are three different lies, and a file-presence check catches none of
 * them. The positive control is what stops the suite passing by rejecting
 * everything.
 *
 * Shelling out through {@link runGateCli} rather than calling `scan()` is the
 * point of the harness: the thing under test is the binary a contributor runs,
 * argv parsing and entry guard included.
 */
const SELF_TEST_MIN_CASES = 4;
const SELF_TEST_MIN_REJECTING = 3;

function selfTest(): number {
    const repoRoot = process.cwd();
    const rel = path.join('src', 'scripts', 'check_supervision_claim_atomicity.ts');
    const CLAIM = 'The resident process is supervised and auto-restarted.\n';

    /** Build a throwaway repo whose HEAD is real, so the revision check is meaningful. */
    const fixture = (evidence: LifecycleEvidence | null): { dir: string; head: string } => {
        const dir = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR ?? '/tmp'), 'supclaim-'));
        fs.writeFileSync(path.join(dir, 'README.md'), CLAIM);
        const git = (...a: string[]): void => {
            execFileSync('git', ['-C', dir, ...a], { stdio: 'ignore' });
        };
        git('init', '-q');
        git('config', 'user.email', 'selftest@example.com');
        git('config', 'user.name', 'self test');
        git('add', 'README.md');
        git('commit', '-q', '-m', 'fixture');
        const head = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
        if (evidence !== null) {
            const abs = path.join(dir, EVIDENCE_REL);
            fs.mkdirSync(path.dirname(abs), { recursive: true });
            fs.writeFileSync(abs, JSON.stringify({ ...evidence, revision: evidence.revision ?? head }));
        }
        return { dir, head };
    };

    const run = (evidence: LifecycleEvidence | null): number => {
        const { dir } = fixture(evidence);
        try {
            return runGateCli(repoRoot, rel, [], dir);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    };

    const cases: SelfTestCase[] = [
        {
            name: 'a seeded supervision claim with no lifecycle evidence at all',
            expect: 'reject',
            run: () => run(null),
        },
        {
            name: 'an emptied suite — every case skipped, none run',
            expect: 'reject',
            run: () =>
                run({ suite: 'supervision-lifecycle', processes_exercised: true, cases_run: 0, cases_skipped: 12 }),
        },
        {
            name: 'a result recorded against a different revision',
            expect: 'reject',
            run: () =>
                run({
                    suite: 'supervision-lifecycle',
                    revision: 'b'.repeat(40),
                    processes_exercised: true,
                    cases_run: 12,
                    cases_skipped: 0,
                }),
        },
        {
            name: 'sufficient evidence on this revision lets the same claim through',
            expect: 'accept',
            run: () =>
                run({ suite: 'supervision-lifecycle', processes_exercised: true, cases_run: 12, cases_skipped: 1 }),
        },
    ];

    return runSelfTest({
        gate: 'check_supervision_claim_atomicity',
        cases,
        minCases: SELF_TEST_MIN_CASES,
        minRejectCases: SELF_TEST_MIN_REJECTING,
    });
}

export function main(argv: readonly string[]): number {
    const root = process.cwd();
    if (argv.includes('--self-test')) return selfTest();

    const ledger = new GateLedger('check_supervision_claim_atomicity');
    const findings = scan(root, PUBLIC_SURFACES, headRevisionOf(root), ledger);
    ledger.report();
    reportScanned({
        gate: 'check_supervision_claim_atomicity',
        scanned: PUBLIC_SURFACES.filter((f) => fs.existsSync(path.join(root, f))).length,
        units: 'public surfaces',
        roots: ['README.md', 'docs/'],
    });

    if (findings.length > 0) {
        for (const f of findings) {
            process.stderr.write(`    ❌ ${f.file}:${String(f.line)} — ${f.text}\n       ${f.reason}\n`);
        }
        process.stderr.write(
            `❌  check_supervision_claim_atomicity: ${String(findings.length)} present-tense supervision claim(s) ` +
                'on a public surface without lifecycle evidence for this revision.\n' +
                '    ADR-249 permits a supervised resident process; it does not assert that one behaves as described.\n' +
                '    State the adopted policy, or land the evidence first.\n',
        );
        return 1;
    }
    process.stdout.write(
        '✅  check_supervision_claim_atomicity: no unbacked present-tense supervision claim on a public surface.\n',
    );
    return 0;
}

const _HERE = fileURLToPath(import.meta.url);
function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main(process.argv.slice(2)));
}
