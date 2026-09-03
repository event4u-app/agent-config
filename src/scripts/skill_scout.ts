#!/usr/bin/env tsx
/**
 * Governed skill scout — evaluate an external skill candidate against what this
 * package already covers, and end in a written verdict either way.
 *
 * WHY THE REJECTION IS THE PRODUCT. A scouting pipeline whose success path is
 * better developed than its rejection path will produce optimistic verdicts,
 * because that is the path it knows how to walk. The maintainer's own framing
 * put the constraint before the feature: the contribution offer appears only
 * when every gate has actually passed, and otherwise the run ends with
 * "keine Contribution empfohlen" and a reason. So {@link Verdict} carries the
 * SAME fields in both directions and both are rendered by the same function —
 * there is no shape a passing run can reach that a failing run cannot.
 *
 * IMPORT INTELLIGENCE, NOT FILES. What is evaluated is the marginal capability
 * delta against this package's own skill index, never the candidate in
 * isolation and never the candidate's self-description. A skill that is
 * excellent and already covered is a reject, and the reason names the covering
 * artefact.
 *
 * TWO RECORDED DECISIONS BOUND THIS FILE. Both were resolved by AI council on
 * 2026-09-03 (members: anthropic, openai), unanimously:
 *
 *   - `scout-egress-authority` = (a): NO network fetch, ever. Candidates arrive
 *     by human copy into the quarantine root. This keeps the lethal-trifecta
 *     legs separated by construction rather than by a runtime gate. No network
 *     primitive, no URL handling, and no transport import appears below — the
 *     test for this asserts on the literal source text, so this comment must
 *     not name the tokens it forbids either.
 *   - `scout-invocation-surface` = (a): the scout runs only inside this
 *     package. A maintainer running it here is already in the repository that
 *     would receive the change, so the "shall I open a PR" question never
 *     arises. The terminal state is a recommendation, and the scout never
 *     performs an outward action of any kind.
 *
 * NO NEW CLI VERB (ADR-041) and NO NEW SKILL. This is a script plus a Taskfile
 * target. Adding a `skill-scout` meta-skill would cost a catalogue entry
 * against a preamble budget with zero headroom, which is why the originating
 * roadmap defers it until two real pipeline runs exist.
 *
 * Exit codes: 0 = the run produced a verdict (either verdict), 1 = the run
 * could not produce one (candidate missing, or intake refused it).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { collect, _keyword_vector, _cosine } from './audit_skill_overlap.js';
import { reportScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const _DEFAULT_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** Quarantine root, relative to the repository root. Gitignored in whole. */
export const QUARANTINE_REL = 'agents/runtime/skill-scout/candidates';

/** Text-only allow-list. A candidate carrying anything else is refused. */
const ALLOWED_EXT: ReadonlySet<string> = new Set([
    '.md',
    '.txt',
    '.json',
    '.yml',
    '.yaml',
    '.toml',
]);

/** 512 KiB. A skill that does not fit is not a skill. */
const MAX_FILE_BYTES = 512 * 1024;

/**
 * Cosine above which the candidate is considered already covered.
 *
 * NOT a measured optimum, and said so rather than implied.
 * `audit_skill_overlap` reports pairs from 0.30 upward as worth a human read;
 * 0.45 sits above that so a coverage rejection is a claim about substantial
 * overlap rather than about shared vocabulary.
 */
export const COVERAGE_THRESHOLD = 0.45;

/** The four gates the contribution recommendation is conditioned on. */
export type GateName = 'novelty' | 'security_licence' | 'benefit' | 'challenge_loops';

export const GATE_NAMES: readonly GateName[] = [
    'novelty',
    'security_licence',
    'benefit',
    'challenge_loops',
];

export interface GateResult {
    readonly gate: GateName;
    readonly passed: boolean;
    /** Why it passed or failed. Never empty, in either direction. */
    readonly reason: string;
}

export interface Delta {
    /** Highest cosine against any skill in this package. */
    readonly max_similarity: number;
    /** The skill that produced it — the covering artefact when it covers. */
    readonly nearest: string | null;
    readonly nearest_path: string | null;
    /** How many of this package's skills the candidate was compared against. */
    readonly compared_against: number;
}

export interface IntakeResult {
    readonly accepted: boolean;
    readonly refusals: readonly string[];
    readonly files_seen: number;
}

/**
 * One run's complete output.
 *
 * The field set is identical for both outcomes — this is the shape 3.2 of the
 * originating roadmap requires, and the test asserts it structurally rather
 * than by reading prose.
 */
export interface Verdict {
    readonly candidate: string;
    readonly recommended: boolean;
    /** Free of any upstream name — `source-confidentiality`. */
    readonly reason: string;
    readonly delta: Delta;
    readonly gates: readonly GateResult[];
    readonly lints_run: readonly string[];
    readonly lints_unavailable: readonly { readonly lint: string; readonly why: string }[];
}

/**
 * The lint fleet, split by whether it can actually be pointed at a candidate.
 *
 * Established by 1.2 of the originating roadmap: no new linters were written,
 * and the split below is MEASURED, not inferred from the presence of a
 * `--root` flag. That distinction is the finding. Four lints under
 * `src/scripts/` accept `--root`; running each of them against a real
 * quarantined candidate on 2026-09-03 showed that only ONE of the four reaches
 * a candidate at all. The other three take `--root` to mean the repository
 * root (a test affordance) or scan a sub-path a text-only candidate does not
 * have. A fleet list built from `grep --root` would have been wrong in three
 * places and would have reported lints that silently scanned nothing.
 *
 * The `unavailable` half is not a gap to close later. It is the recorded answer
 * to "which of the fleet can be pointed at a candidate", with the reason per
 * entry, which is exactly what 1.2 asked for.
 */
export const LINT_FLEET_ROOTED: readonly string[] = ['lint_skill_descriptions'];

export const LINT_FLEET_UNROOTED: readonly { lint: string; why: string }[] = [
    {
        lint: 'lint_skill_link_reach',
        why: "its `--root` is a repository root for its own self-test; the skill scan stays pinned to dist/agent-src/skills and reported a dead scope against a candidate root",
    },
    {
        lint: 'lint_skill_scripts_readonly',
        why: 'scans `<skill>/scripts/**` only; a text-only candidate has no scripts directory, so the run is a dead scope rather than a pass',
    },
    {
        lint: 'check_skill_admissions',
        why: 'its corpus is the admissions ledger, not the skill tree; `--root` relocates the repository for its tests and the ledger is absent under a candidate root',
    },
    {
        lint: 'skill_linter',
        why: 'scans the projected tree, which a quarantined candidate is absent from by design',
    },
    {
        lint: 'lint_token_budget_discipline',
        why: 'reads the committed budget corpus; a candidate has no budget row until it is adopted',
    },
];

function _walk(dir: string): string[] {
    const out: string[] = [];
    const stack = [dir];
    while (stack.length > 0) {
        const cur = stack.pop() as string;
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(cur, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const e of entries) {
            const full = path.join(cur, e.name);
            if (e.isSymbolicLink()) {
                out.push(full);
                continue;
            }
            if (e.isDirectory()) {
                stack.push(full);
            } else {
                out.push(full);
            }
        }
    }
    return out.sort();
}

/**
 * Refuse a candidate that is not inert.
 *
 * Every check is a refusal, never a repair. A candidate that fails is reported
 * and stops — there is no sanitising pass, because a pass that fixes a
 * candidate is a pass that can be fooled into fixing it wrongly.
 */
export function intake(candidateDir: string): IntakeResult {
    const refusals: string[] = [];
    if (!fs.existsSync(candidateDir) || !fs.statSync(candidateDir).isDirectory()) {
        return { accepted: false, refusals: ['candidate directory does not exist'], files_seen: 0 };
    }
    const files = _walk(candidateDir);
    for (const f of files) {
        const rel = path.relative(candidateDir, f).split(path.sep).join('/');
        const st = fs.lstatSync(f);
        if (st.isSymbolicLink()) {
            refusals.push(`${rel}: symlink — quarantine holds inert regular files only`);
            continue;
        }
        const ext = path.extname(f).toLowerCase();
        if (!ALLOWED_EXT.has(ext)) {
            refusals.push(`${rel}: extension ${ext || '(none)'} is outside the text allow-list`);
        }
        if ((st.mode & 0o111) !== 0) {
            refusals.push(`${rel}: executable bit set — a candidate is never executed`);
        }
        if (st.size > MAX_FILE_BYTES) {
            refusals.push(`${rel}: ${st.size} bytes exceeds the ${MAX_FILE_BYTES}-byte cap`);
        }
    }
    if (files.length === 0) {
        refusals.push('candidate directory is empty');
    }
    return { accepted: refusals.length === 0, refusals, files_seen: files.length };
}

/** Concatenate a candidate's text into one vector source. */
export function candidateText(candidateDir: string): string {
    return _walk(candidateDir)
        .filter((f) => ALLOWED_EXT.has(path.extname(f).toLowerCase()))
        .map((f) => {
            try {
                return fs.readFileSync(f, 'utf-8');
            } catch {
                return '';
            }
        })
        .join('\n');
}

/**
 * The capability differential — computed from THIS package's index.
 *
 * The candidate contributes a keyword vector and nothing else. Its own claim
 * about novelty is never read, which is the structural half of
 * `untrusted-input-defense`: after vectorisation there is nobody to address.
 */
export function computeDelta(candidateDir: string, skillRoot?: string): Delta {
    const mine = skillRoot === undefined ? collect() : collect(skillRoot);
    const vec = _keyword_vector(candidateText(candidateDir));
    let best = 0;
    let nearest: string | null = null;
    let nearestPath: string | null = null;
    for (const s of mine) {
        const sim = _cosine(vec, s.vector);
        if (sim > best) {
            best = sim;
            nearest = s.name;
            nearestPath = s.relpath;
        }
    }
    return {
        max_similarity: Math.round(best * 10000) / 10000,
        nearest,
        nearest_path: nearestPath,
        compared_against: mine.length,
    };
}

export interface GateInputs {
    /** Licence identifier the operator recorded for the candidate. */
    readonly licence: string | null;
    /** A measured benefit, in the operator's own units. Absent = gate fails. */
    readonly benefit: string | null;
    /** One entry per completed challenge loop. */
    readonly challenges: readonly { readonly round: number; readonly critical_open: boolean }[];
    readonly intake: IntakeResult;
}

/**
 * Evaluate all four gates. Every gate is always evaluated and always reported —
 * there is no short-circuit, because a run that stops at the first failure
 * cannot tell the operator which of the four they still have to earn.
 */
export function evaluateGates(delta: Delta, inputs: GateInputs): GateResult[] {
    const results: GateResult[] = [];

    const covered = delta.max_similarity >= COVERAGE_THRESHOLD;
    results.push({
        gate: 'novelty',
        passed: !covered,
        reason: covered
            ? `already covered by \`${delta.nearest ?? 'an existing skill'}\`` +
              ` (${delta.nearest_path ?? 'path unresolved'}) at similarity ` +
              `${delta.max_similarity} against ${delta.compared_against} skills` +
              ` — a well-written skill this package already covers is a reject`
            : `nearest existing skill \`${delta.nearest ?? 'none'}\` scores ` +
              `${delta.max_similarity}, below the ${COVERAGE_THRESHOLD} coverage threshold`,
    });

    const licenceOk = inputs.licence !== null && inputs.licence.trim() !== '';
    const intakeOk = inputs.intake.accepted;
    results.push({
        gate: 'security_licence',
        passed: licenceOk && intakeOk,
        reason: !intakeOk
            ? `intake refused the candidate: ${inputs.intake.refusals.join('; ')}`
            : licenceOk
              ? `intake clean over ${inputs.intake.files_seen} inert files; licence recorded as ${inputs.licence}`
              : 'no licence recorded — an unknown licence is never treated as permissive',
    });

    const benefitOk = inputs.benefit !== null && inputs.benefit.trim() !== '';
    results.push({
        gate: 'benefit',
        passed: benefitOk,
        reason: benefitOk
            ? `measured benefit recorded: ${inputs.benefit}`
            : 'no measured benefit recorded — a plausible benefit is not a measured one',
    });

    const loops = inputs.challenges.length;
    const unresolved = inputs.challenges.filter((c) => c.critical_open).length;
    const loopsOk = loops >= 3 && unresolved === 0;
    results.push({
        gate: 'challenge_loops',
        passed: loopsOk,
        reason: loopsOk
            ? `three challenge loops recorded with no unresolved critical objection`
            : loops < 3
              ? `${loops} of 3 challenge loops recorded`
              : `${unresolved} unresolved critical objection(s) across ${loops} loops`,
    });

    return results;
}

/** Build the verdict. Both outcomes take this path; there is no second one. */
export function buildVerdict(
    candidate: string,
    delta: Delta,
    gates: readonly GateResult[],
    intakeResult: IntakeResult,
): Verdict {
    const failed = gates.filter((g) => !g.passed);
    const recommended = failed.length === 0 && intakeResult.accepted;
    return {
        candidate,
        recommended,
        reason: recommended
            ? 'all four gates passed — adoption into this package is recommended'
            : `keine Contribution empfohlen — ${failed.map((g) => `${g.gate}: ${g.reason}`).join('; ')}`,
        delta,
        gates,
        lints_run: LINT_FLEET_ROOTED,
        lints_unavailable: LINT_FLEET_UNROOTED,
    };
}

/** Render a verdict. One function, both outcomes — 3.2's requirement, literally. */
export function render(v: Verdict): string {
    const lines: string[] = [];
    lines.push(`skill-scout · ${v.candidate}`);
    lines.push(`  verdict            ${v.recommended ? 'adoption recommended' : 'keine Contribution empfohlen'}`);
    lines.push(`  reason             ${v.reason}`);
    lines.push(
        `  delta              max ${v.delta.max_similarity} vs \`${v.delta.nearest ?? 'none'}\`` +
            ` over ${v.delta.compared_against} skills`,
    );
    for (const g of v.gates) {
        lines.push(`  gate ${g.gate.padEnd(17)} ${g.passed ? 'pass' : 'FAIL'} — ${g.reason}`);
    }
    lines.push(`  lints run          ${v.lints_run.join(', ')}`);
    for (const u of v.lints_unavailable) {
        lines.push(`  lint unavailable   ${u.lint} — ${u.why}`);
    }
    lines.push(
        '  note               this scout never posts anything; opening a PR stays a human action',
    );
    return lines.join('\n');
}

interface Args {
    candidate: string | null;
    list: boolean;
    json: boolean;
    licence: string | null;
    benefit: string | null;
    challenges: number;
    criticalOpen: number;
    root: string;
}

export function parseArgs(argv: readonly string[]): Args {
    const args: Args = {
        candidate: null,
        list: false,
        json: false,
        licence: null,
        benefit: null,
        challenges: 0,
        criticalOpen: 0,
        root: _DEFAULT_ROOT,
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--list') args.list = true;
        else if (a === '--json') args.json = true;
        else if (a === '--candidate') args.candidate = argv[++i] ?? null;
        else if (a === '--licence' || a === '--license') args.licence = argv[++i] ?? null;
        else if (a === '--benefit') args.benefit = argv[++i] ?? null;
        else if (a === '--challenges') args.challenges = Number(argv[++i] ?? 0);
        else if (a === '--critical-open') args.criticalOpen = Number(argv[++i] ?? 0);
        else if (a === '--root') args.root = path.resolve(argv[++i] ?? '.');
        else if (a.startsWith('--')) throw new Error(`unrecognized argument: ${a}`);
    }
    return args;
}

export function main(argv: readonly string[] | null = null): number {
    const args = parseArgs(argv ?? process.argv.slice(2));
    const qroot = path.join(args.root, QUARANTINE_REL);

    if (args.list) {
        if (!fs.existsSync(qroot)) {
            process.stdout.write(`skill-scout · no quarantine root at ${QUARANTINE_REL}\n`);
            return 0;
        }
        const names = fs
            .readdirSync(qroot, { withFileTypes: true })
            .filter((e) => e.isDirectory())
            .map((e) => e.name)
            .sort();
        process.stdout.write(
            names.length === 0
                ? `skill-scout · quarantine empty (${QUARANTINE_REL})\n`
                : `skill-scout · candidates: ${names.join(', ')}\n`,
        );
        return 0;
    }

    if (args.candidate === null) {
        process.stderr.write(
            'skill-scout · usage: --candidate <name> [--licence X] [--benefit "..."] ' +
                '[--challenges N] [--critical-open N] [--json] | --list\n' +
                `skill-scout · candidates are placed BY HAND under ${QUARANTINE_REL}/<name>/;\n` +
                'skill-scout · this scout performs no network fetch (scout-egress-authority = a).\n',
        );
        return 1;
    }

    const dir = path.join(qroot, args.candidate);
    const intakeResult = intake(dir);

    // SCAN-SCOPE ASSERTION, and it is not a formality here.
    //
    // `skill_scout` matches the `skill_` prefix in `_lib/gate_population.ts`,
    // so the hardening ratchet counts it in the gate population. That filter is
    // deliberately over-inclusive — "a reporting script that asserts its scan
    // scope loses nothing, while a validator missing from the population is
    // invisible exposure" — and the right response is to assert, not to widen
    // the exclusion.
    //
    // It also happens to be the correct check on its own terms: a scout that
    // read zero files would render a confident verdict over nothing, which is
    // exactly the silent-green shape the whole manifest exists to catch. The
    // line goes to STDERR so `--json` keeps a parseable stdout; the contract
    // accepts either stream.
    try {
        reportScanned(
            {
                gate: 'skill_scout',
                scanned: intakeResult.files_seen,
                units: 'candidate file(s)',
                roots: [`${QUARANTINE_REL}/${args.candidate}`],
            },
            (chunk: string) => process.stderr.write(chunk),
        );
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    if (!intakeResult.accepted) {
        process.stderr.write(
            `skill-scout · ${args.candidate} · intake refused:\n` +
                intakeResult.refusals.map((r) => `  - ${r}`).join('\n') +
                '\n',
        );
        return 1;
    }

    const delta = computeDelta(dir);
    const challenges = Array.from({ length: Math.max(0, args.challenges) }, (_, i) => ({
        round: i + 1,
        critical_open: i < args.criticalOpen,
    }));
    const gates = evaluateGates(delta, {
        licence: args.licence,
        benefit: args.benefit,
        challenges,
        intake: intakeResult,
    });
    const verdict = buildVerdict(args.candidate, delta, gates, intakeResult);
    process.stdout.write(
        (args.json ? JSON.stringify(verdict, null, 2) : render(verdict)) + '\n',
    );
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return fs.realpathSync(_HERE) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
