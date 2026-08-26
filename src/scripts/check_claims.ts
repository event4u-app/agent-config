#!/usr/bin/env tsx
/**
 * Claims-Ledger gate — no public claim without a resolvable evidence binding.
 *
 * The mechanical anti-hype guardrail (road-to-final-state-and-market-readiness
 * Phase 1 / Track B, step B1). Every public-facing claim that carries a
 * `<!-- claim:<id> -->` marker in README.md or docs/ MUST resolve to a ledger
 * entry in docs/CLAIMS.md whose `status: backed` and whose `evidence` pointer
 * resolves. A smuggled unbacked claim (marker without a backed, resolvable
 * ledger entry) fails the build — so "we sell honesty" is itself machine-checked.
 *
 * Non-disruptive by design: only `<!-- claim:ID -->`-**markered** spans are
 * enforced. Unmarkered prose is never checked, so existing README text does not
 * retroactively break CI; the ledger tightens as claims are markered over time.
 * Ledger entries with `status: unbacked` are inventory (documented debt) and do
 * NOT fail the build — but marking such an entry's claim in prose does.
 *
 * Evidence-pointer grammar (v2):
 *   <repo-path>[:line]        → the repo file exists (line advisory).
 *   <repo-path>#<substring>   → the file exists AND contains <substring>.
 *   https://… (YYYY-MM-DD)    → external cite with a dated stamp (not fetched).
 *   exec:<command> -> <code>  → the command RE-RUNS and its exit code matches.
 *
 * The first three are existence checks and cannot tell a live claim from a
 * stale one: a pointer at a report nobody regenerated resolves forever. The
 * fourth re-derives the claim. It runs in CI only — locally it reports
 * UNVERIFIED rather than executing anything, because a consumer's checkout has
 * no business re-running this package's evidence commands.
 *
 * Exit codes: 0 = clean · 2 = unbacked/dangling/missing-entry finding OR usage
 * error. Success prints to stdout; findings print to stderr.
 *
 * Usage:
 *     ./scripts-run src/scripts/check_claims
 *     ./scripts-run src/scripts/check_claims --quiet
 *     CI=true ./scripts-run src/scripts/check_claims     # re-runs exec: claims
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
    exec_allowed_here,
    exec_static_error,
    parse_exec_pointer,
    run_exec_evidence,
} from './_lib/exec_evidence.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _FILE = fileURLToPath(import.meta.url);
const _HERE = path.dirname(_FILE);
const REPO = path.resolve(_HERE, '..', '..');
const LEDGER_REL = 'docs/CLAIMS.md';

/** Surfaces scanned for `<!-- claim:ID -->` markers. */
const SURFACE_ROOTS = ['README.md', 'docs'];

const CLAIM_MARKER = /<!--\s*claim:([A-Za-z0-9._-]+)\s*-->/g;
// The documented grammar is `https://… (YYYY-MM-DD)` — with a space, in both
// docs/CLAIMS.md § Evidence-pointer grammar and this file's own header. The
// original pattern required the stamp to abut the URL (`\S+\(`), so every
// pointer written the documented way was rejected. That went unnoticed because
// the form had zero usage until the external research citations were bound;
// the space is now optional, which accepts both spellings and keeps the
// enforcement matching the spec rather than the other way round.
const URL_DATED = /^https?:\/\/\S+\s*\(\d{4}-\d{2}-\d{2}\)\s*$/;

/** Witness sweep (P1.2) — marketing-class surfaces where a bare number must
 *  not appear as a capability claim. docs/proof.md and docs/comparison.yaml
 *  are structurally witnessed (pointer columns + their own linters). */
const WITNESS_SURFACES = ['README.md', 'CAPABILITIES.yaml'];

/**
 * Shapes that read as a measured capability figure.
 *
 * The ratio pattern was written against the "84.8%-style headline" anti-lesson
 * and catches exactly that. It missed the shape that actually bit us: the README
 * shipped "compiled into 7+ host agents" while the real, test-pinned number was
 * 23 detected / 20 emitted — understating coverage by 3x, for months, on the one
 * surface this sweep already watched. A bare integer carries no `%` and no `x`,
 * so no ratio pattern could see it and no unit allowlist would either.
 *
 * Three narrow classes:
 *   - RATIO      — percentages and multipliers (the original).
 *   - MAGNITUDE  — a number carrying a measurement unit. Unit-gated, not
 *                  digit-gated: a thousands-separator heuristic would catch
 *                  `22,077` and also every year and large ordinal.
 *   - SELF_COUNT — a count-shaped assertion about the package's own reach.
 *                  This is the class that shipped wrong.
 *
 * Excluded from MAGNITUDE in v1: time units. "wait 30 seconds" is an
 * instruction, not a claim, and a gate that false-positives is a gate that gets
 * bypassed (`narrow > recall`, as with the credential floor).
 *
 * Deliberately NOT widened to more surfaces, and this was measured rather than
 * assumed: `docs/benchmark.md` alone matches the ratio pattern on 54 lines — it
 * is a methodology document whose job is to be full of statistics, and sweeping
 * it would produce exactly the flood that teaches a maintainer to bypass the
 * gate. `docs/proof.md` and `docs/comparison.yaml` are pointer-enforced by their
 * own linters, so an unmarkered figure cannot originate there. The gap was never
 * the surface list; it was the pattern.
 */
const RATIO = /\b\d+(?:\.\d+)?\s*(?:%|[x×](?![A-Za-z0-9]))/;
// The optional `<word>-` allows a qualified unit: `13,881 GPT-tokens` is the
// same claim shape as `13,881 tokens` and was missed without it.
const MAGNITUDE = /\b\d[\d,._]*\s*(?:[A-Za-z]+-)?(?:tokens?|ms|USD|KB|MB|GB|chars?)\b/i;
const SELF_COUNT = /\b\d+\+?\s+(?:host agents?|hosts|supported (?:agents?|hosts))\b/i;

/** True when a line carries any figure shape that must bind to a claim. */
export function is_quantified_claim(line: string): boolean {
    return RATIO.test(line) || MAGNITUDE.test(line) || SELF_COUNT.test(line);
}

class ExitCode extends Error {
    code: number;
    constructor(code: number) {
        super(`exit ${code}`);
        this.code = code;
    }
}

export interface LedgerEntry {
    id: string;
    claim: string;
    kind: string;
    evidence: string;
    status: string;
    last_verified: string;
    /**
     * Optional forward link on a `resolved-null` entry: the id of the claim that
     * reopened the same question by a different mechanism. The retire-never-delete
     * lifecycle keeps the null readable forever, but a reader arriving at a closed
     * question has no way to learn it was later reopened — this is that link.
     *
     * Parsed and gated rather than merely documented: an unparsed field would be a
     * documented claim the code does not honour, which is the defect class this
     * ledger exists to make impossible.
     */
    superseded_by: string;
    /**
     * Optional: the build a quantitative measurement describes, when that is not
     * the current one.
     *
     * `road-to-inbox-harvest-2026-08-f-code-graph-evidence-refresh` 3.2, on an
     * AI council ruling (2026-08-26, 2/2). `claim:code-graph-retrieval-null` is
     * a real measurement of a build that no longer exists: its figures date from
     * 2026-07-28 and the extractor defect they blame was repaired on 2026-08-22.
     *
     * The council rejected both obvious statuses. `resolved-null` would say the
     * retrieval question was ANSWERED null on the current build, which is
     * exactly what nobody has measured; `superseded_by` expects replacement
     * EVIDENCE, and a repair commit is the wrong semantic object for it. What
     * was required instead was structured scoping — and that it reach every
     * index and summary rather than only the detailed entry, because a prose-only
     * qualification drifts from the structured record it qualifies.
     *
     * So this field is printed in `docs/proof.md`'s ledger table, not merely
     * parsed.
     */
    measured_on: string;
}

interface Args {
    quiet: boolean;
}

function parse_args(argv: string[]): Args {
    const out: Args = { quiet: false };
    for (const a of argv) {
        if (a === '--quiet') {
            out.quiet = true;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write('usage: check_claims [--quiet]\n');
            throw new ExitCode(0);
        } else {
            process.stderr.write(`❌  check_claims: unrecognized argument: ${a}\n`);
            throw new ExitCode(2);
        }
    }
    return out;
}

/** Parse docs/CLAIMS.md — one entry per `### claim: <id>` block. */
function load_ledger(): Map<string, LedgerEntry> {
    const ledger = new Map<string, LedgerEntry>();
    const p = path.join(REPO, LEDGER_REL);
    if (!fs.existsSync(p)) {
        return ledger;
    }
    const lines = fs.readFileSync(p, 'utf8').split('\n');
    let cur: Partial<LedgerEntry> & { id?: string } = {};
    const flush = () => {
        if (cur.id) {
            ledger.set(cur.id, {
                id: cur.id,
                claim: cur.claim ?? '',
                kind: cur.kind ?? '',
                evidence: cur.evidence ?? '',
                status: cur.status ?? '',
                last_verified: cur.last_verified ?? '',
                superseded_by: cur.superseded_by ?? '',
                measured_on: cur.measured_on ?? '',
            });
        }
        cur = {};
    };
    for (const line of lines) {
        const head = line.match(/^###\s+claim:\s*([A-Za-z0-9._-]+)\s*$/);
        if (head) {
            flush();
            cur = { id: head[1]! };
            continue;
        }
        if (!cur.id) continue;
        const field = line.match(
            /^-\s+(claim|kind|evidence|status|last_verified|superseded_by|measured_on):\s*(.*)$/,
        );
        if (field) {
            const key = field[1] as keyof LedgerEntry;
            (cur as Record<string, string>)[key] = (field[2] ?? '').trim();
        }
    }
    flush();
    return ledger;
}

/** Recursively collect .md files under a repo-relative root (file or dir). */
function collect_md(rel: string): string[] {
    const abs = path.join(REPO, rel);
    if (!fs.existsSync(abs)) return [];
    const st = fs.statSync(abs);
    if (st.isFile()) return abs.endsWith('.md') ? [abs] : [];
    const out: string[] = [];
    for (const name of fs.readdirSync(abs)) {
        if (name === 'node_modules' || name.startsWith('.')) continue;
        out.push(...collect_md(path.join(rel, name)));
    }
    return out;
}

/** Find every live `<!-- claim:ID -->` marker across the scanned surfaces.
 *  Skips the ledger file itself and any marker shown as documentation
 *  (inside a ``` fenced block or an inline `backtick` span). */
function scan_markers(): { id: string; file: string }[] {
    const found: { id: string; file: string }[] = [];
    const files = new Set<string>();
    for (const root of SURFACE_ROOTS) {
        for (const f of collect_md(root)) files.add(f);
    }
    for (const f of files) {
        const rel = path.relative(REPO, f);
        if (rel === LEDGER_REL) continue; // the ledger documents the syntax
        let fenced = false;
        for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
            if (/^\s*```/.test(line)) {
                fenced = !fenced;
                continue;
            }
            if (fenced) continue;
            for (const m of line.matchAll(CLAIM_MARKER)) {
                const before = line.slice(0, m.index ?? 0);
                const backticks = (before.match(/`/g) ?? []).length;
                if (backticks % 2 === 1) continue; // inside an inline-code span
                found.push({ id: m[1]!, file: rel });
            }
        }
    }
    return found;
}

/**
 * Does an evidence pointer resolve? Returns null on success, else a reason.
 *
 * For `exec:` this is the STATIC half only — is the pointer well-formed and is
 * the command allowlisted. A malformed or non-allowlisted command fails
 * everywhere, including locally, because that is a defect in the ledger rather
 * than a property of the environment. Re-execution is the separate CI-gated
 * pass in `main`, so a laptop never runs an evidence command.
 */
function pointer_unresolved(evidence: string): string | null {
    const ev = evidence.trim();
    if (!ev) return 'empty evidence pointer';

    const exec = parse_exec_pointer(ev);
    if (exec !== null) {
        return 'error' in exec ? exec.error : exec_static_error(exec);
    }

    if (/^https?:\/\//.test(ev)) {
        return URL_DATED.test(ev) ? null : 'external URL missing a (YYYY-MM-DD) stamp';
    }
    // repo-path[:line] or repo-path#substring
    let target = ev;
    let needle: string | null = null;
    const hash = ev.indexOf('#');
    if (hash !== -1) {
        target = ev.slice(0, hash);
        needle = ev.slice(hash + 1);
    }
    target = target.replace(/:\d+$/, ''); // strip :line
    const abs = path.join(REPO, target);
    if (!fs.existsSync(abs)) return `evidence path not found: ${target}`;
    if (needle) {
        const body = fs.readFileSync(abs, 'utf8');
        if (!body.includes(needle)) return `evidence file lacks '${needle}': ${target}`;
    }
    return null;
}

interface Finding {
    id: string;
    file: string;
    reason: string;
}

function main(argv: string[] = process.argv.slice(2)): number {
    const args = parse_args(argv);
    const ledger = load_ledger();
    // The ledger is the corpus both passes depend on: markers resolve against
    // it and the rot guard walks it. `load_ledger` returns an empty map for a
    // missing docs/CLAIMS.md, and with no ledger there is nothing to declare
    // dangling — so a moved ledger would print "0 markered claim(s) bound ·
    // ledger 0 entries" and certify the anti-hype guardrail over nothing.
    // Marker count is deliberately not the unit: a surface tree with zero
    // markers is a legitimate state, an absent ledger never is.
    try {
        assertScanned({
            gate: 'check_claims',
            scanned: ledger.size,
            units: 'ledger entry(s)',
            roots: [LEDGER_REL],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 2;
        }
        throw exc;
    }
    const markers = scan_markers();
    const findings: Finding[] = [];

    // 1. Every markered claim must map to a backed, resolvable ledger entry.
    for (const { id, file } of markers) {
        const entry = ledger.get(id);
        if (!entry) {
            findings.push({ id, file, reason: `no ledger entry in ${LEDGER_REL}` });
            continue;
        }
        if (entry.status !== 'backed') {
            findings.push({ id, file, reason: `ledger status is '${entry.status || 'missing'}', not 'backed'` });
            continue;
        }
        const un = pointer_unresolved(entry.evidence);
        if (un) findings.push({ id, file, reason: un });
    }

    // 2. Rot guard: a backed ledger entry whose pointer no longer resolves
    //    fails even before it is markered (an implementation must not outlive
    //    its claim, and vice-versa).
    for (const entry of ledger.values()) {
        if (entry.status !== 'backed') continue;
        const un = pointer_unresolved(entry.evidence);
        if (un) findings.push({ id: entry.id, file: LEDGER_REL, reason: `backed entry has dangling evidence — ${un}` });
    }

    // 2b. Successor pointers: a `superseded_by` must name a real ledger entry,
    //     and only a closed question can have a successor. The field exists so a
    //     reader arriving at a `resolved-null` learns the question was reopened
    //     by a different mechanism — a dangling id would send them nowhere, and
    //     the field on a live entry would claim a closure that never happened.
    for (const entry of ledger.values()) {
        if (!entry.superseded_by) continue;
        if (entry.status !== 'resolved-null') {
            findings.push({
                id: entry.id,
                file: LEDGER_REL,
                reason: `superseded_by is only meaningful on a resolved-null entry (status: ${entry.status || 'missing'})`,
            });
            continue;
        }
        if (!ledger.has(entry.superseded_by)) {
            findings.push({
                id: entry.id,
                file: LEDGER_REL,
                reason: `superseded_by names claim:${entry.superseded_by}, which is not in the ledger`,
            });
        } else if (entry.superseded_by === entry.id) {
            findings.push({
                id: entry.id,
                file: LEDGER_REL,
                reason: 'superseded_by points at its own entry',
            });
        }
    }

    // 3. Witness sweep (road-to-opt-subagent-harvest P1.2): a QUANTIFIED
    //    capability claim on a marketing-class surface must be witnessed — a
    //    `<!-- claim:ID -->` marker on the same line, or an explicit
    //    `unverified` annotation. Unmarkered numbers are exactly how an
    //    "84.8%"-style figure spreads across surfaces with no methodology
    //    (the anti-lesson this check encodes). Fenced code blocks are skipped.
    for (const rel of WITNESS_SURFACES) {
        const abs = path.join(REPO, rel);
        let text: string;
        try {
            text = fs.readFileSync(abs, 'utf-8');
        } catch {
            continue;
        }
        let inFence = false;
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i] as string;
            if (/^\s*(```|~~~)/.test(line)) {
                inFence = !inFence;
                continue;
            }
            if (inFence) continue;
            if (!is_quantified_claim(line)) continue;
            if (/unverified/i.test(line)) continue;

            // A marker on the line is not enough — it must be a marker that can
            // LICENSE A NUMBER. This is how "7+ host agents" survived: the line
            // already carried `claim:no-runtime-daemon`, a `kind: qual` claim
            // about having no daemon, and any-marker-exempts-the-line let the
            // unrelated figure ride along on it. A qualitative claim says nothing
            // about a quantity, so only a `kind: quant` entry clears a figure.
            const markers = [...line.matchAll(/<!--\s*claim:([A-Za-z0-9._-]+)\s*-->/g)].map((m) => m[1] as string);
            const licensed = markers.some((id) => ledger.get(id)?.kind === 'quant');
            if (licensed) continue;

            const why =
                markers.length > 0
                    ? `figure carried only by non-quantitative claim marker(s) [${markers.join(', ')}] — a \`kind: qual\` claim cannot license a number`
                    : 'quantified claim without a claim marker or \'unverified\' annotation';
            findings.push({
                id: '(unmarkered)',
                file: `${rel}:${i + 1}`,
                reason: `${why} — ${line.trim().slice(0, 70)}`,
            });
        }
    }

    // A published denominator must match the live ledger.
    //
    // `exec-evidence-feasibility.json` records how many backed claims the
    // feasibility measurement was taken over. That number was hand-written and
    // drifted twice inside two days — 25 when the ledger held 26, then 26 when it
    // held 27 — and CI stayed green both times, because the claim's evidence
    // pointer resolved. Pointer-resolution is not truth: that is the very thing
    // `ledger-exec-verifiability` says about the ledger, demonstrated by its own
    // entry. The classification in that file is a human judgment and stays one;
    // the denominator is mechanical, so it gets checked.
    {
        const rel = 'internal/reports/exec-evidence-feasibility.json';
        const abs = path.join(REPO, rel);
        if (fs.existsSync(abs)) {
            try {
                const stored = JSON.parse(fs.readFileSync(abs, 'utf8')) as { backed_claims?: number };
                const live = [...ledger.values()].filter((e) => e.status === 'backed').length;
                if (typeof stored.backed_claims === 'number' && stored.backed_claims !== live) {
                    findings.push({
                        id: '(derived-count)',
                        file: rel,
                        reason:
                            `backed_claims is ${stored.backed_claims} but the ledger holds ${live} — ` +
                            `a published denominator drifted from its source. Re-measure and update the report.`,
                    });
                }
            } catch {
                findings.push({
                    id: '(derived-count)',
                    file: rel,
                    reason: 'unparseable JSON — the derived-count check cannot verify the published denominator',
                });
            }
        }
    }

    // 4. Re-execution pass (`exec:` evidence). CI only — locally every exec
    //    claim reports UNVERIFIED and nothing runs. A mismatch is a finding: the
    //    command ran and disagreed with the claim. A skip is NOT a finding —
    //    collapsing "could not run" into "failed" is how a verifier degrades
    //    into a rubber stamp in the other direction.
    const execEntries = [...ledger.values()]
        .filter((e) => e.status === 'backed')
        .map((e) => ({ entry: e, ptr: parse_exec_pointer(e.evidence) }))
        .filter((x): x is { entry: LedgerEntry; ptr: { command: string; expected: number } } =>
            x.ptr !== null && !('error' in x.ptr),
        );

    const execSkipped: string[] = [];
    const execVerified: string[] = [];

    if (execEntries.length > 0) {
        const allowed = exec_allowed_here();
        for (const { entry, ptr } of execEntries) {
            if (!allowed) {
                execSkipped.push(entry.id);
                continue;
            }
            const outcome = run_exec_evidence(ptr, REPO);
            if (outcome.mismatch) {
                findings.push({ id: entry.id, file: LEDGER_REL, reason: outcome.reason });
            } else if (outcome.verified) {
                execVerified.push(entry.id);
            } else {
                execSkipped.push(entry.id);
            }
        }
    }

    if (findings.length > 0) {
        process.stderr.write(`❌  check_claims: ${findings.length} unbacked/dangling claim(s):\n`);
        for (const f of findings) {
            process.stderr.write(`    ${f.file} · claim:${f.id} — ${f.reason}\n`);
        }
        process.stderr.write(`    → bind the claim in ${LEDGER_REL} (status: backed + a resolvable evidence pointer), or remove the marker.\n`);
        return 2;
    }

    if (!args.quiet) {
        const backed = [...ledger.values()].filter((e) => e.status === 'backed').length;
        const unbacked = [...ledger.values()].filter((e) => e.status === 'unbacked').length;
        process.stdout.write(
            `✅  check_claims: ${markers.length} markered claim(s) bound · ledger ${ledger.size} entries (${backed} backed, ${unbacked} unbacked inventory)\n`,
        );
        if (execEntries.length > 0) {
            const detail = execVerified.length > 0 ? ` (${execVerified.length} re-verified)` : '';
            process.stdout.write(
                execSkipped.length === execEntries.length
                    ? `    exec: ${execEntries.length} claim(s) UNVERIFIED — re-execution is CI-only, skipped locally\n`
                    : `    exec: ${execEntries.length} claim(s)${detail}, ${execSkipped.length} skipped\n`,
            );
        }
    }
    return 0;
}

/** Robust "am I the entry script?" — realpath-compares argv[1] to this file so
 *  a symlinked invocation path (macOS /var → /private/var under a tmp tree)
 *  still resolves. Irrelevant under scripts-run (run.ts calls main directly). */
function _isCliEntry(): boolean {
    const a = process.argv[1];
    if (!a) return false;
    if (a === _FILE || pathToFileURL(path.resolve(a)).href === import.meta.url) return true;
    try {
        return fs.realpathSync(a) === fs.realpathSync(_FILE);
    } catch {
        return false;
    }
}
if (_isCliEntry()) {
    try {
        process.exit(main());
    } catch (exc) {
        if (exc instanceof ExitCode) {
            process.exit(exc.code);
        }
        throw exc;
    }
}

export { REPO, LEDGER_REL, main, parse_args, load_ledger, scan_markers, pointer_unresolved, ExitCode };

/**
 * Live count of `status: backed` ledger entries.
 *
 * Exists so a published denominator can be DERIVED instead of typed. The
 * `ledger-exec-verifiability` entry hard-coded this number twice and drifted
 * within a day both times — first 25 when the ledger held 26, then 26 when it
 * held 27 — while `check_claims` stayed green because its evidence pointer
 * resolved. A number a human retypes on every ledger edit will drift; the only
 * fix is to stop retyping it.
 *
 * Note this is not the same as `grep -c '^- status: backed'`, which also counts
 * the entry-schema template in the document header.
 */
export function count_backed(): number {
    let n = 0;
    for (const e of load_ledger().values()) {
        if (e.status === 'backed') n += 1;
    }
    return n;
}
