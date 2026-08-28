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
 * from a blind one, which is why `--self-test` plants the seeded negatives and
 * asserts each one reds.
 *
 * ## Known limits — what a line-based pattern cannot do
 *
 * Written after a neutral review, and kept because the alternative is a reader
 * assuming coverage this does not have. None of these is a bug to be fixed by
 * widening the regex; each is a property of the approach.
 *
 * - **One physical line at a time.** A claim wrapped across two lines
 *   (`The resident process` / `is supervised.`) is not seen. Markdown reflow can
 *   therefore hide a claim from the gate.
 * - **Copula-only.** Active voice escapes: `We supervise the resident process`
 *   asserts the property and does not match. Narrowing to a copula is what keeps
 *   the adopted-policy sentence out, so widening trades one error for the other.
 * - **No grammatical subject resolution.** The 60-character window between the
 *   process noun and the copula can cross a clause boundary, so a property
 *   belonging to a different subject can be attributed to the first process noun
 *   on the line. Bounded distance is not ownership.
 * - **No markdown structure awareness.** A claim quoted inside a fenced block or
 *   a historical excerpt is scanned like any other line.
 * - **The negation guard is a heuristic.** It reads the captured gap plus a
 *   24-character determiner window; a negator further away is not seen.
 *
 * The gate is therefore a **floor, not a proof**: it catches the plain forms of
 * the claim it names. The obligation not to publish an unproven capability stays
 * with the author, as it did before this file existed.
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

/**
 * Words that INVERT the assertion. Their presence between the copula and the
 * property means the sentence denies the property rather than asserting it.
 *
 * **This guard is the fix for the worst defect a neutral review found**, and it
 * is worth stating what the bug was rather than only that it is closed. The
 * first version matched `The resident process is **not** supervised.` — `not`
 * was absorbed by the 0-to-3-word gap, and the gate would have refused a
 * TRUTHFUL DENIAL of the capability while the sentence it exists to catch reads
 * identically minus one word. That is an inversion, not a false positive: the
 * gate would have pushed authors away from the honest statement.
 *
 * The test suite claimed to cover "historical and negative statements" and
 * tested only `shipped no daemon before …` — a different grammatical form. The
 * direct negation was untested and broken. Both council seats found it
 * independently.
 */
const NEGATOR_RE = /\b(?:not|never|no|non|without|cannot|can't|won't|isn't|aren't|neither|nor|un\w+)\b/i;

/** The gap between the copula and the property, captured so it can be inspected. */
export const SUPERVISION_CLAIM_RE = new RegExp(
    String.raw`\b${PROCESS}\b[^.\n]{0,60}?\b${COPULA}\b(\s+(?:\w+[\s-]+){0,3}?)\b${PROPERTY}\b`,
    'i',
);

/**
 * Strip markdown emphasis before matching.
 *
 * `\b` does not match inside `**bold**`, so `The resident process is
 * **supervised**.` escaped the pattern entirely — a false negative on exactly
 * the formatting a README uses for the words that matter. Also found by review.
 */
export function normaliseLine(line: string): string {
    return line.replace(/[*_`]+/g, '');
}

/**
 * Does this line assert — rather than deny — a supervision property?
 *
 * Two steps, deliberately separate so each is testable: the shape must match,
 * and the gap between copula and property must carry no negator.
 */
export function assertsSupervision(rawLine: string): boolean {
    const line = normaliseLine(rawLine);
    const m = SUPERVISION_CLAIM_RE.exec(line);
    if (m === null) return false;
    // Two negation slots, and both were found by review rather than by design.
    // AFTER the copula: "the resident process is **not** supervised".
    // BEFORE the subject, in the determiner: "**No** resident process is
    // supervised here". The second is why this reads a bounded window ahead of
    // the match instead of only the captured gap.
    const lead = line.slice(Math.max(0, m.index - NEGATOR_LOOKBEHIND), m.index);
    return !NEGATOR_RE.test(lead) && !NEGATOR_RE.test(m[1] ?? '');
}

/**
 * How far back the determiner slot is inspected for a negator.
 *
 * Bounded rather than whole-line on purpose: a negator early in a DIFFERENT
 * clause ("the daemon is not the concern; the collector is supervised") must
 * not suppress a real claim later in the same line. 24 characters covers
 * "No ", "Never a ", "There is no " and the like without reaching a previous
 * clause. This is a heuristic and is named as one — see § Known limits.
 */
const NEGATOR_LOOKBEHIND = 24;

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
export function evidenceRefusal(
    ev: LifecycleEvidence | null | 'malformed',
    headRevision: string,
): string | null {
    if (ev === null) {
        return `no lifecycle evidence at ${EVIDENCE_REL} — the suite that would back this claim does not exist`;
    }
    if (ev === 'malformed') {
        return `${EVIDENCE_REL} exists but does not parse as a JSON object — a broken artifact is not weaker evidence than a missing one, it is a different problem`;
    }
    // A revision the gate could not read is not a revision that matched. Review
    // found this reporting `HEAD is ` with an empty string, which reads as a
    // mismatch rather than as a failure to determine anything.
    if (headRevision === '') {
        return 'could not determine HEAD (`git rev-parse HEAD` failed) — the same-revision condition cannot be checked, so it is not treated as met';
    }
    if (typeof ev.suite !== 'string' || ev.suite.trim() === '') {
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
    // Typed, not coerced. Review found `cases_run: "abc"` passing every
    // comparison — `"abc" <= 0` and `"abc" <= 0` are both false, so an
    // unparsable count read as sufficient evidence. A string `"12"` was worse
    // than useless in the other direction: `"12" <= "2"` is TRUE
    // lexicographically, so valid-looking data was refused for a wrong reason.
    // The artifact is machine-written; a non-integer in it is a broken producer,
    // and the gate says so instead of guessing.
    const run = ev.cases_run ?? 0;
    const skipped = ev.cases_skipped ?? 0;
    if (!Number.isInteger(run) || !Number.isInteger(skipped)) {
        return `${EVIDENCE_REL} records a non-integer case count (run: ${JSON.stringify(ev.cases_run)}, skipped: ${JSON.stringify(ev.cases_skipped)}) — the artifact is machine-written, so this is a broken producer rather than a low count`;
    }
    if (run < 0 || skipped < 0) {
        return `${EVIDENCE_REL} records a negative case count (run: ${String(run)}, skipped: ${String(skipped)}) — not a possible measurement`;
    }
    if (run <= 0) {
        return `${EVIDENCE_REL} records ${String(run)} cases run — an empty suite is not evidence`;
    }
    if (run <= skipped) {
        return `${EVIDENCE_REL} records ${String(run)} run against ${String(skipped)} skipped — a suite that skipped at least as much as it ran is not evidence`;
    }
    return null;
}

/**
 * Read the evidence artifact.
 *
 * Returns `null` when it is ABSENT and the string `'malformed'` when it exists
 * and does not parse. Review flagged that collapsing the two reported unparsable
 * JSON as "the suite does not exist" — both fail closed, but they need
 * different remediation and a reader deserves to know which one they have.
 */
export function readEvidence(root: string): LifecycleEvidence | null | 'malformed' {
    const p = path.join(root, EVIDENCE_REL);
    if (!fs.existsSync(p)) return null;
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return 'malformed';
        return parsed as LifecycleEvidence;
    } catch {
        return 'malformed';
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
            ledger?.skip(rel, 'dead_scan_root');
            continue;
        }
        const lines = fs.readFileSync(abs, 'utf8').split('\n');
        let failedHere = '';
        for (const [i, line] of lines.entries()) {
            if (!assertsSupervision(line)) continue;
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
const SELF_TEST_MIN_CASES = 7;
const SELF_TEST_MIN_REJECTING = 5;

function selfTest(): number {
    const repoRoot = process.cwd();
    const rel = path.join('src', 'scripts', 'check_supervision_claim_atomicity.ts');
    const CLAIM = 'The resident process is supervised and auto-restarted.\n';

    /** Build a throwaway repo whose HEAD is real, so the revision check is meaningful. */
    const fixture = (
        evidence: LifecycleEvidence | null,
        line: string = CLAIM,
    ): { dir: string; head: string } => {
        const dir = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR ?? '/tmp'), 'supclaim-'));
        fs.writeFileSync(path.join(dir, 'README.md'), line);
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

    const runWithLine = (line: string, evidence: LifecycleEvidence | null): number => {
        const { dir } = fixture(evidence, line);
        try {
            return runGateCli(repoRoot, rel, [], dir);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    };
    const run = (evidence: LifecycleEvidence | null): number => runWithLine(CLAIM, evidence);

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
            // Advertised by the docstring from the first version and ABSENT from
            // the case list until a neutral review counted them. The doc said
            // three negatives and named a mocked-process one; the code had two
            // plus a foreign revision. A self-test that describes a case it does
            // not run is the shape it exists to prevent.
            name: 'a suite that did not exercise real processes',
            expect: 'reject',
            run: () =>
                run({
                    suite: 'supervision-lifecycle',
                    processes_exercised: false,
                    cases_run: 12,
                    cases_skipped: 0,
                }),
        },
        {
            name: 'a non-integer case count — a broken producer, not a low count',
            expect: 'reject',
            run: () =>
                run({
                    suite: 'supervision-lifecycle',
                    processes_exercised: true,
                    cases_run: 'twelve' as unknown as number,
                    cases_skipped: 0,
                }),
        },
        {
            // The inversion control. Without the negation guard this line
            // matched, and the gate would have refused a TRUTHFUL DENIAL while
            // no evidence existed. It must pass with no evidence at all.
            name: 'a DENIAL of supervision is not a claim, and needs no evidence',
            expect: 'accept',
            run: () => runWithLine('The resident process is not supervised.\n', null),
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
