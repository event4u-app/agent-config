#!/usr/bin/env tsx
/**
 * Grade a TARGET repository's assurance readiness — the matrix `/project:analyze` prints.
 *
 * WHY A SCRIPT AND NOT PROSE. `road-to-target-project-assurance-readiness`
 * Phase 1 asks for detection asserted "by a vitest spec", and a gather list
 * written in a command's markdown cannot be asserted by anything. So the
 * detection is here and the command invokes it; the command keeps the narrative.
 *
 * THE ANTI-VANITY RULE IS STRUCTURAL, NOT A STYLE NOTE. Thirteen dimensions are
 * graded 0 Absent / 1 Present / 2 Enforced-in-CI / 3 Independent-and-diff-scoped,
 * and the verdict is `min` over the FOUR knockout dimensions, reported as
 * `L<n> — bound by <dimension>`. **No aggregate number is ever emitted** — no
 * percentage, no x/100, no mean. A single score is the vanity metric the source
 * report's own anti-vanity rule forbids, and `renderMatrix` carries a test that
 * greps its own output for `%` and `/100`.
 *
 * NOT-DETECTABLE IS NOT ZERO, AND ON A KNOCKOUT IT BINDS. A `0` claims the target
 * lacks something. `not detectable` says this tool cannot tell — a different fact,
 * and the honest one for a Python target, because `quality-tools` routes PHP and
 * JS/TS only. An undetectable KNOCKOUT binds at L0 with its reason printed, so the
 * gap is visible rather than flattering.
 *
 * SCOPE — this grades, it does not install. Whether a missing gate then gets
 * created in the target is a successor roadmap's problem
 * (`stubs/road-to-target-project-bootstrap-enforce.md`).
 *
 * Exit codes:
 *   0 — a matrix was produced (any level, including L0 — a low grade is a
 *       finding about the target, never a failure of this gate)
 *   1 — nothing was gradeable (no target root)
 *   2 — the gate could not run (bad args)
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const SELF = 'src/scripts/grade_target_readiness.ts';

const SELF_TEST_MIN_CASES = 6;
const SELF_TEST_MIN_REJECT = 2;

/** 0 Absent · 1 Present · 2 Enforced-in-CI · 3 Independent-and-diff-scoped. */
export type Grade = 0 | 1 | 2 | 3;

/** `null` means "this tool cannot tell", which is NOT a zero. */
export interface DimensionResult {
    id: string;
    label: string;
    knockout: boolean;
    grade: Grade | null;
    /** Required when `grade` is null: why detection is impossible, not merely absent. */
    notDetectable?: string;
    /**
     * Facts observed without being scored. An empty array means "nothing was
     * observed", which is NOT the same as a failing grade and NOT the same as
     * `notDetectable` — the three states are kept apart deliberately.
     */
    observations?: string[];
    evidence: string;
}

export interface Matrix {
    level: Grade | 0;
    boundBy: string;
    boundReason?: string;
    dimensions: DimensionResult[];
}

// ── primitive probes ───────────────────────────────────────────────────────

const _exists = (root: string, ...rel: string[]): boolean =>
    rel.some((r) => fs.existsSync(path.join(root, r)));

function _glob1(root: string, dir: string, re: RegExp): boolean {
    const d = path.join(root, dir);
    try {
        return fs.readdirSync(d).some((f) => re.test(f));
    } catch {
        return false;
    }
}

function _readIfAny(root: string, ...rel: string[]): string {
    for (const r of rel) {
        try {
            return fs.readFileSync(path.join(root, r), 'utf-8');
        } catch {
            /* next */
        }
    }
    return '';
}

/** Every workflow file's text, concatenated. Empty when there is no CI at all. */
function _ciText(root: string): string {
    const d = path.join(root, '.github', 'workflows');
    let out = '';
    try {
        for (const f of fs.readdirSync(d)) {
            if (/\.ya?ml$/.test(f)) out += `${fs.readFileSync(path.join(d, f), 'utf-8')}\n`;
        }
    } catch {
        /* no CI */
    }
    return out;
}

/* -- bounded text corpus, for the Phase 4 dimensions ----------------------- */

/** Directories a target scan must never descend into: cost with no signal. */
const _SKIP_DIRS = new Set([
    'node_modules', '.git', 'vendor', 'dist', 'build', 'out', 'coverage',
    '.next', '.nuxt', '.venv', 'venv', '__pycache__', 'target', '.terraform',
]);
/** Extensions that can carry a DNS record, a policy doc or an ops runbook. */
const _CORPUS_RE = /\.(tf|tfvars|hcl|ya?ml|json|txt|zone|dns|ini|conf|cfg|toml|md|env|example|sh)$/i;
const _CORPUS_MAX_FILES = 2000;
const _CORPUS_MAX_BYTES = 256 * 1024;

/**
 * Read a bounded slice of the target's text, once, for the dimensions that
 * cannot be answered by a root-level `_exists` probe.
 *
 * Three dimensions need to see INSIDE files — a DMARC policy is a string in a
 * zone file or a Terraform record, not a filename — and the existing probes are
 * all filename-shaped. The walk is capped in three directions (skip list, file
 * count, per-file bytes) because an unbounded read of an arbitrary target repo
 * is a cost this grader has no way to predict.
 *
 * Returns the concatenated text AND the relative paths, because a dimension that
 * says WHERE it saw something is auditable and one that only says "somewhere in
 * the tree" is not.
 */
export function _textCorpus(root: string): { text: string; paths: string[] } {
    const paths: string[] = [];
    let text = '';
    const walk = (dir: string, rel: string): void => {
        if (paths.length >= _CORPUS_MAX_FILES) return;
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
            if (paths.length >= _CORPUS_MAX_FILES) return;
            const abs = path.join(dir, e.name);
            const r = rel === '' ? e.name : `${rel}/${e.name}`;
            if (e.isDirectory()) {
                if (_SKIP_DIRS.has(e.name)) continue;
                walk(abs, r);
                continue;
            }
            if (!_CORPUS_RE.test(e.name)) continue;
            try {
                if (fs.statSync(abs).size > _CORPUS_MAX_BYTES) continue;
                text += `${fs.readFileSync(abs, 'utf-8')}\n`;
            } catch {
                continue;
            }
            paths.push(r);
        }
    };
    walk(root, '');
    return { text, paths };
}

/**
 * Is this a Python-primary target?
 *
 * Load-bearing for dimension 4: `quality-tools` routes PHP and JS/TS only, so on
 * a Python target the static-analysis dimension is NOT DETECTABLE rather than 0.
 */
export function isPythonTarget(root: string): boolean {
    const py = _exists(root, 'pyproject.toml', 'setup.cfg', 'requirements.txt', 'setup.py');
    const other = _exists(root, 'composer.json', 'package.json');
    return py && !other;
}

// ── the thirteen dimensions ──

/**
 * Grade one dimension. `ci` decides 1 → 2: a thing that exists is `Present`; a
 * thing CI runs in a job that is not `continue-on-error` is `Enforced-in-CI`.
 */
function _graded(present: boolean, enforced: boolean, diffScoped = false): Grade {
    if (!present) return 0;
    if (diffScoped && enforced) return 3;
    return enforced ? 2 : 1;
}

/** A CI job that cannot fail the build enforces nothing. */
function _ciBlocks(ci: string, ...needles: string[]): boolean {
    if (ci === '') return false;
    const mentions = needles.some((n) => ci.toLowerCase().includes(n.toLowerCase()));
    if (!mentions) return false;
    // Coarse but honest: a workflow that marks EVERY job continue-on-error
    // enforces nothing. Per-job attribution needs a YAML parse and is the
    // successor roadmap's problem; stated rather than silently approximated.
    const allSoft = /continue-on-error:\s*true/.test(ci) && !/continue-on-error:\s*false/.test(ci);
    return !allSoft;
}

/* -- Phase 4 dimension ladders --------------------------------------------- */

interface Scored {
    grade: Grade;
    evidence: string;
}

/** A runbook, a restore procedure, or a rollback path — and whether CI runs it. */
function _recovery(corpus: { text: string; paths: string[] }, ci: string): Scored {
    const namedFile = corpus.paths.some((p) => /(^|\/)(runbook|runbooks|disaster-recovery|dr)([./-]|$)/i.test(p));
    const procedure = /\b(restore from backup|disaster recovery|rollback plan|pg_restore|pg_dump|restic|velero|RPO|RTO)\b/i.test(corpus.text);
    const present = namedFile || procedure;
    const enforced = _ciBlocks(ci, 'restore', 'rollback', 'disaster-recovery', 'backup');
    // A DRILL is what separates a documented procedure from a proven one. It is
    // the only honest route to 3 here, because "independent" for recovery means
    // the restore was actually exercised rather than described.
    const drill = /\b(restore (drill|test|rehearsal)|recovery drill|game ?day)\b/i.test(corpus.text);
    const seen: string[] = [
        ...(namedFile ? ['a runbook or DR document'] : []),
        ...(procedure ? ['a restore/rollback procedure in the text'] : []),
        ...(enforced ? ['a blocking CI step naming restore/rollback/backup'] : []),
        ...(drill ? ['a restore drill'] : []),
    ];
    return {
        grade: _graded(present, enforced, drill),
        evidence: seen.length > 0 ? seen.join('; ') : 'no runbook, restore procedure or rollback path found',
    };
}

/**
 * SPF, DKIM and DMARC — and the rung that must not be fudged (4.2).
 *
 *   0 Absent   — no SPF, DKIM or DMARC RECORD anywhere. Prose about DMARC is
 *                not a DMARC record; the signal is the record shape.
 *   1 Present  — SPF and/or DKIM published, OR a DMARC record with `p=none`.
 *                `p=none` is a MONITORING policy: it requests aggregate reports
 *                and instructs receivers to take no action on a failing message.
 *                A domain publishing it is measuring the problem, not preventing
 *                it, so it is capped here however much else sits alongside it.
 *   2 Enforced — DMARC `p=quarantine` or `p=reject`, with SPF or DKIM to align
 *                against. An enforcing policy with nothing to align is a policy
 *                over no signal, and stays at 1.
 *   3 Top      — `p=reject` with BOTH SPF and DKIM and an `rua=` reporting
 *                address, so the enforcement can be observed rather than assumed.
 */
function _mailAuthenticity(corpus: { text: string }): Scored {
    const t = corpus.text;
    const spf = /v=spf1\b/i.test(t);
    const dkim = /v=DKIM1\b/i.test(t);
    const dmarc = /v=DMARC1\b/i.test(t);
    const policy = /v=DMARC1[^"'\n]*?\bp\s*=\s*(none|quarantine|reject)\b/i.exec(t)?.[1]?.toLowerCase();
    const rua = /v=DMARC1[^"'\n]*?\brua\s*=/i.test(t);
    const aligned = spf || dkim;
    const parts = [
        spf ? 'SPF published' : 'no SPF record',
        dkim ? 'DKIM published' : 'no DKIM record',
        dmarc ? `DMARC published (p=${policy ?? 'unset'})` : 'no DMARC record',
    ];
    if (!spf && !dkim && !dmarc) {
        return { grade: 0, evidence: 'no SPF, DKIM or DMARC record found in the tree' };
    }
    if (policy === 'none') {
        return {
            grade: 1,
            evidence:
                `${parts.join('; ')} — capped at Present: p=none is a monitoring policy and is NOT protection, ` +
                'because receivers are told to take no action on a message that fails. A domain publishing it ' +
                'scores below one that enforces.',
        };
    }
    if (policy === 'quarantine' || policy === 'reject') {
        if (!aligned) {
            return {
                grade: 1,
                evidence: `${parts.join('; ')} — an enforcing policy with neither SPF nor DKIM to align against protects nothing yet`,
            };
        }
        if (policy === 'reject' && spf && dkim && rua) {
            return { grade: 3, evidence: `${parts.join('; ')} — enforcing, both mechanisms aligned, and reporting to an rua address` };
        }
        return { grade: 2, evidence: `${parts.join('; ')} — an enforcing DMARC policy with an aligned mechanism` };
    }
    return { grade: 1, evidence: `${parts.join('; ')} — a mail-authenticity record exists, with no enforcing DMARC policy above it` };
}

/** A privacy notice, a retention rule, a consent mechanism, a deletion path. */
function _privacyObligations(corpus: { text: string; paths: string[] }, ci: string): Scored {
    const notice =
        corpus.paths.some((p) => /(privacy|datenschutz|\bdpa\b|data-processing)/i.test(p)) ||
        /\b(privacy (policy|notice)|Datenschutzerkl)/i.test(corpus.text);
    const retention = /\b(retention (policy|period|schedule)|data retention|storage limitation)\b/i.test(corpus.text);
    const consent = /\b(cookie consent|consent (banner|manager|mode)|cookiebot|usercentrics|klaro|borlabs)\b/i.test(corpus.text);
    const erasure = /\b(right to erasure|data subject request|DSAR|DSR|account deletion|delete my data)\b/i.test(corpus.text);
    const enforced = _ciBlocks(ci, 'privacy', 'gdpr', 'retention', 'consent', 'dsar');
    const seen: string[] = [
        ...(notice ? ['a privacy notice or DPA'] : []),
        ...(retention ? ['a retention rule'] : []),
        ...(consent ? ['a consent mechanism'] : []),
        ...(erasure ? ['an erasure / data-subject-request path'] : []),
        ...(enforced ? ['a blocking CI step naming a privacy obligation'] : []),
    ];
    return {
        grade: _graded(notice || retention || consent || erasure, enforced),
        evidence: seen.length > 0 ? seen.join('; ') : 'no privacy notice, retention rule, consent mechanism or erasure path found',
    };
}

export function grade(root: string): Matrix {
    const ci = _ciText(root);
    const hasCi = ci !== '';
    const py = isPythonTarget(root);
    const pyproject = _readIfAny(root, 'pyproject.toml');

    const dims: DimensionResult[] = [];

    // 1. behaviour contract
    const contract = _exists(root, 'AGENTS.md', 'openapi.yaml', 'openapi.yml', 'CONTRACT.md');
    dims.push({
        id: 'behaviour-contract',
        label: 'behaviour contract',
        knockout: false,
        grade: _graded(contract, false),
        evidence: contract ? 'AGENTS.md / OpenAPI / CONTRACT.md present' : 'none found',
    });

    // 2. test presence & types — KNOCKOUT
    const testCfg =
        _exists(root, 'vitest.config.ts', 'vitest.config.js', 'jest.config.js', 'jest.config.ts',
            'phpunit.xml', 'phpunit.xml.dist', 'pest.php', 'pytest.ini', 'tox.ini') ||
        /\[tool\.pytest/.test(pyproject);
    dims.push({
        id: 'test-presence',
        label: 'test presence & types',
        knockout: true,
        grade: _graded(testCfg, _ciBlocks(ci, 'vitest', 'jest', 'phpunit', 'pest', 'pytest', 'npm test', 'task test')),
        evidence: testCfg ? 'a test-runner config is present' : 'no test-runner config',
    });

    // 3. advanced testing signals — OBSERVED, never graded.
    //
    // This dimension used to be `test-strength`, graded on config presence. It
    // was unscored on 2026-08-27: a dormant `stryker.conf` and an unused
    // `fast-check` dependency both scored, while a rigorous conventional suite
    // with neither scored 0 — so the number ordered targets by ADOPTION and
    // read as EFFECTIVENESS. Detection is kept because presence is a real fact
    // about the repository; the grade is dropped because the inference from it
    // was not. Three epistemic states are held apart on purpose: a signal was
    // observed, no signal was observed, and effectiveness is not evaluable at
    // all — the last is permanent under static inspection and is why
    // `notDetectable` is emitted whether or not any observation fires.
    const mutation =
        _glob1(root, '.', /^stryker\.conf\./) || _exists(root, 'infection.json', 'infection.json.dist') ||
        /\[tool\.mutmut\]/.test(pyproject) || /\[mutmut\]/.test(_readIfAny(root, 'setup.cfg'));
    const property =
        /fast-check/.test(_readIfAny(root, 'package.json')) || /hypothesis/.test(pyproject + _readIfAny(root, 'requirements.txt'));
    const mutationCi = mutation && _ciBlocks(ci, 'stryker', 'infection', 'mutmut');
    // `ci-reference-detected`, not `ci-enforcement-detected`. Static matching over
    // a workflow file establishes that a mutation tool is REFERENCED there; it
    // cannot establish that the step is enabled, blocking, reached on the required
    // branches, or ever executed. Naming it "enforcement" hands a consumer an
    // assurance token the probe does not earn — and a consumer is entitled to read
    // a token's name, `notDetectable` disclaimer or no disclaimer.
    const observed: string[] = [
        ...(mutation ? ['mutation-testing-config-detected'] : []),
        ...(property ? ['property-testing-library-detected'] : []),
        ...(mutationCi ? ['mutation-testing-ci-reference-detected'] : []),
    ];
    dims.push({
        id: 'advanced-testing-signals',
        label: 'advanced testing signals',
        knockout: false,
        grade: null,
        observations: observed,
        notDetectable:
            'test effectiveness — static config and dependency signals cannot establish mutation sensitivity, ' +
            'property quality, or whether either was ever executed. Outcome evidence would be needed: survivor and ' +
            'timeout counts from a real mutation run, or executed property-test results.',
        // Derived from `observations`, never a parallel ternary. The original
        // ternary reported only the mutation signal when BOTH fired — which the
        // `python` fixture does — so the human-readable string and the machine
        // list disagreed about the same target. Two representations of one fact
        // drift; one is computed from the other.
        evidence: observed.length > 0 ? observed.join(', ') : 'no advanced-testing signal detected',
    });

    // 4. static analysis & types — KNOCKOUT, and the not-detectable case
    if (py) {
        dims.push({
            id: 'static-analysis',
            label: 'static analysis & types',
            knockout: true,
            grade: null,
            notDetectable: 'quality-tools has no Python mode',
            evidence: 'Python-primary target',
        });
    } else {
        const sa = _exists(root, 'phpstan.neon', 'phpstan.neon.dist', 'psalm.xml', 'tsconfig.json');
        dims.push({
            id: 'static-analysis',
            label: 'static analysis & types',
            knockout: true,
            grade: _graded(sa, _ciBlocks(ci, 'phpstan', 'psalm', 'tsc', 'typecheck')),
            evidence: sa ? 'a static-analysis config is present' : 'no static-analysis config',
        });
    }

    // 5. architecture gates
    const arch = _glob1(root, '.', /^\.dependency-cruiser\./) || _exists(root, 'deptrac.yaml', 'deptrac.yml');
    dims.push({
        id: 'architecture-gates',
        label: 'architecture gates',
        knockout: false,
        grade: _graded(arch, _ciBlocks(ci, 'dependency-cruiser', 'deptrac')),
        evidence: arch ? 'a boundary-gate config is present' : 'no architecture gate',
    });

    // 6. security & supply chain — KNOCKOUT
    const lock = _exists(root, 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'composer.lock', 'poetry.lock', 'uv.lock');
    const sast = _glob1(root, '.', /^\.semgrep/) || _exists(root, 'bandit.yaml', '.bandit');
    const audit = _ciBlocks(ci, 'npm audit', 'pnpm audit', 'composer audit', 'pip-audit', 'semgrep', 'bandit');
    dims.push({
        id: 'security-supply-chain',
        label: 'security & supply chain',
        knockout: true,
        grade: _graded(lock || sast, audit),
        evidence: `${lock ? 'lockfile' : 'no lockfile'}; ${sast ? 'SAST config' : 'no SAST config'}; ${audit ? 'audit runs in CI' : 'no blocking audit step'}`,
    });

    // 7. CI enforcement — KNOCKOUT
    const blockingJob = hasCi && !(/continue-on-error:\s*true/.test(ci) && !/continue-on-error:\s*false/.test(ci));
    dims.push({
        id: 'ci-enforcement',
        label: 'CI enforcement',
        knockout: true,
        grade: hasCi ? (blockingJob ? 2 : 1) : 0,
        evidence: !hasCi ? 'no workflows' : blockingJob ? 'at least one job can fail the build' : 'every job is continue-on-error',
    });

    // 8. independent verification
    const owners = _exists(root, 'CODEOWNERS', '.github/CODEOWNERS', 'docs/CODEOWNERS');
    dims.push({
        id: 'independent-verification',
        label: 'independent verification',
        knockout: false,
        grade: _graded(owners, false),
        evidence: owners ? 'CODEOWNERS present' : 'no CODEOWNERS',
    });

    // 9. evidence & traceability
    const adr = _exists(root, 'docs/adr', 'docs/decisions', 'adr');
    dims.push({
        id: 'evidence-traceability',
        label: 'evidence & traceability',
        knockout: false,
        grade: _graded(adr, false),
        evidence: adr ? 'a decision record directory exists' : 'no decision records',
    });

    // 10. runtime verification — never detectable, and deliberately NOT a knockout
    dims.push({
        id: 'runtime-verification',
        label: 'runtime verification',
        knockout: false,
        grade: null,
        notDetectable: 'needs a deploy platform this tool does not own',
        evidence: 'out of scope by design (see the roadmap exclusion table)',
    });

    // 11. operational recovery — NON-KNOCKOUT
    //
    // New dimensions are never knockouts. A knockout added today would re-bind
    // every existing verdict at L0 on the day it shipped, which changes what the
    // level MEANS while looking like a change to what it measures.
    const corpus = _textCorpus(root);
    const recovery = _recovery(corpus, ci);
    dims.push({
        id: 'operational-recovery',
        label: 'operational recovery',
        knockout: false,
        grade: recovery.grade,
        evidence: recovery.evidence,
    });

    // 12. mail authenticity — NON-KNOCKOUT, own ladder (4.2)
    const mail = _mailAuthenticity(corpus);
    dims.push({
        id: 'mail-authenticity',
        label: 'mail authenticity',
        knockout: false,
        grade: mail.grade,
        evidence: mail.evidence,
    });

    // 13. privacy obligations — NON-KNOCKOUT
    const privacy = _privacyObligations(corpus, ci);
    dims.push({
        id: 'privacy-obligations',
        label: 'privacy obligations',
        knockout: false,
        grade: privacy.grade,
        evidence: privacy.evidence,
    });

    // ── the verdict: min over knockouts, undetectable binds at L0 ──────────
    const knockouts = dims.filter((d) => d.knockout);
    const undetectable = knockouts.find((d) => d.grade === null);
    if (undetectable !== undefined) {
        // `boundReason` is spread in conditionally rather than assigned
        // `undefined`: under `exactOptionalPropertyTypes` an optional property
        // and a property explicitly set to `undefined` are different types, and
        // the second does not satisfy `boundReason?: string`.
        return {
            level: 0,
            boundBy: undetectable.label,
            ...(undetectable.notDetectable === undefined ? {} : { boundReason: undetectable.notDetectable }),
            dimensions: dims,
        };
    }
    let level: Grade = 3;
    let boundBy = knockouts[0]?.label ?? 'unknown';
    for (const k of knockouts) {
        const g = k.grade as Grade;
        if (g < level) {
            level = g;
            boundBy = k.label;
        }
    }
    return { level, boundBy, dimensions: dims };
}

// ── rendering ──────────────────────────────────────────────────────────────

const GRADE_WORD: Record<number, string> = { 0: 'Absent', 1: 'Present', 2: 'Enforced-in-CI', 3: 'Independent+diff-scoped' };

/**
 * Render the matrix. Emits NO aggregate figure — no `%`, no `/100`, no mean.
 * A test greps this function's own output for both, because the pressure to
 * print one number is exactly what turns readiness into a vanity metric.
 */
export function renderMatrix(m: Matrix): string {
    const L: string[] = [];
    L.push('READINESS');
    L.push(
        m.boundReason !== undefined
            ? `L${String(m.level)} — bound by ${m.boundBy} (not detectable — ${m.boundReason})`
            : `L${String(m.level)} — bound by ${m.boundBy}`,
    );
    L.push('');
    for (const d of m.dimensions) {
        const val = d.grade === null ? `not detectable — ${d.notDetectable ?? ''}` : `${String(d.grade)} ${GRADE_WORD[d.grade] ?? ''}`;
        L.push(`  ${d.knockout ? '!' : ' '} ${d.label.padEnd(28)} ${val}`);
        // Observations are printed under their dimension, never folded into the
        // level. An unscored dimension that printed nothing would read as an
        // omission rather than as a deliberate refusal to grade.
        for (const o of d.observations ?? []) L.push(`  ${' '.repeat(31)} observed: ${o}`);
    }
    L.push('');
    L.push('  ! = knockout dimension. The level is the MINIMUM over knockouts;');
    L.push('      an undetectable knockout binds at L0 with its reason shown.');
    L.push('      No aggregate score is reported, by design.');
    return L.join('\n');
}

// ── self-test ──────────────────────────────────────────────────────────────

function _mk(files: Record<string, string>): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'target-readiness-'));
    for (const [rel, body] of Object.entries(files)) {
        const p = path.join(d, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, body);
    }
    return d;
}

const BLOCKING_CI = 'jobs:\n  t:\n    steps:\n      - run: npx vitest run\n      - run: npx tsc --noEmit\n      - run: npm audit\n';

export function selfTest(): number {
    const made: string[] = [];
    const mk = (f: Record<string, string>): string => {
        const d = _mk(f);
        made.push(d);
        return d;
    };
    const cases: SelfTestCase[] = [
        {
            name: 'a bare directory grades L0 bound by a knockout, and does not crash',
            expect: 'accept',
            run: () => (grade(mk({ 'README.md': '#\n' })).level === 0 ? 0 : 1),
        },
        {
            name: 'a Python target reports static analysis NOT DETECTABLE, never 0',
            expect: 'accept',
            run: () => {
                const m = grade(mk({ 'pyproject.toml': '[tool.pytest.ini_options]\n' }));
                const sa = m.dimensions.find((d) => d.id === 'static-analysis');
                return sa?.grade === null && sa.notDetectable === 'quality-tools has no Python mode' ? 0 : 1;
            },
        },
        {
            name: 'an undetectable knockout BINDS at L0 with its reason',
            expect: 'accept',
            run: () => {
                const m = grade(mk({ 'pyproject.toml': '[tool.pytest.ini_options]\n' }));
                return m.level === 0 && m.boundBy === 'static analysis & types' && m.boundReason !== undefined ? 0 : 1;
            },
        },
        {
            name: 'CI enforcement at 0 binds even when everything else is enforced',
            expect: 'accept',
            run: () => {
                const m = grade(mk({
                    'package.json': '{"devDependencies":{"fast-check":"1"}}',
                    'tsconfig.json': '{}',
                    'vitest.config.ts': '',
                    'package-lock.json': '{}',
                    '.semgrep.yml': '',
                    'deptrac.yaml': '',
                    'AGENTS.md': '#\n',
                    'CODEOWNERS': '* @o\n',
                    'docs/adr/ADR-1.md': '#\n',
                }));
                return m.level === 0 && m.boundBy === 'CI enforcement' ? 0 : 1;
            },
        },
        {
            name: 'the rendered matrix carries NO aggregate figure',
            expect: 'accept',
            run: () => {
                const out = renderMatrix(grade(mk({ 'package.json': '{}', '.github/workflows/ci.yml': BLOCKING_CI })));
                return /%|\/100/.test(out) ? 1 : 0;
            },
        },
        {
            name: 'DMARC p=none scores strictly below p=quarantine — monitoring is not protection',
            expect: 'accept',
            run: () => {
                const g = (zone: string): number => {
                    const d = grade(mk({
                        'dns/zone.txt': zone,
                        'dns/spf.txt': '@ IN TXT "v=spf1 include:_spf.example.net -all"\n',
                        'dns/dkim.txt': 'sel._domainkey IN TXT "v=DKIM1; k=rsa; p=MIIB"\n',
                    }));
                    return d.dimensions.find((x) => x.id === 'mail-authenticity')?.grade ?? -1;
                };
                const none = g('_dmarc IN TXT "v=DMARC1; p=none; rua=mailto:d@example.com"\n');
                const quarantine = g('_dmarc IN TXT "v=DMARC1; p=quarantine; rua=mailto:d@example.com"\n');
                return none === 1 && quarantine === 2 ? 0 : 1;
            },
        },
        {
            name: 'rejects a missing target root rather than grading an empty tree',
            expect: 'reject',
            run: () => runGateCli(REPO_ROOT, SELF, ['--quiet', '--target', path.join(REPO_ROOT, 'no-such-target')], REPO_ROOT),
        },
        {
            name: 'rejects a target argument that is a file, not a directory',
            expect: 'reject',
            run: () => runGateCli(REPO_ROOT, SELF, ['--quiet', '--target', path.join(REPO_ROOT, 'package.json')], REPO_ROOT),
        },
    ];
    try {
        return runSelfTest({ gate: 'grade_target_readiness', cases, minCases: SELF_TEST_MIN_CASES, minRejectCases: SELF_TEST_MIN_REJECT });
    } finally {
        for (const d of made) fs.rmSync(d, { recursive: true, force: true });
    }
}

function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    if (args.includes('--self-test')) return selfTest();
    const quiet = args.includes('--quiet');
    const i = args.indexOf('--target');
    const target = i >= 0 ? args[i + 1] : process.cwd();
    if (target === undefined) {
        process.stderr.write('grade_target_readiness: --target requires a directory\n');
        return 2;
    }
    let stat: fs.Stats;
    try {
        stat = fs.statSync(target);
    } catch {
        process.stderr.write(`❌  target not found: ${target}\n`);
        return 1;
    }
    if (!stat.isDirectory()) {
        process.stderr.write(`❌  target is not a directory: ${target}\n`);
        return 1;
    }

    const m = grade(target);
    const ledger = new GateLedger('grade_target_readiness');
    ledger.plan(m.dimensions.map((d) => d.id));
    for (const d of m.dimensions) {
        if (d.grade === null) ledger.outOfScope(d.id, 'not_applicable_kind');
        else ledger.complete(d.id);
    }
    ledger.report();
    try {
        reportScanned({
            gate: 'grade_target_readiness',
            scanned: m.dimensions.length,
            units: 'readiness dimension(s)',
            roots: [target],
        });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`❌  ${err.message}\n`);
            return 2;
        }
        throw err;
    }
    if (!quiet) process.stdout.write(`${renderMatrix(m)}\n`);
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

if (_isCliEntry() || process.argv[1] === _HERE) process.exit(main());

export { main };
