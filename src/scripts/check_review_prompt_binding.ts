#!/usr/bin/env tsx
/**
 * The prompt→verdict binding, checked.
 *
 * WHY THIS EXISTS. `docs/contracts/plan-review-gates.md` § 5 recorded the prompt
 * channel as an accepted risk on the premise that *"no in-repo check can read the
 * prompt, so there is no detection floor"*. That premise was true about the HASH
 * and false about the TEXT sitting beside it: `dispatch_r2_reviewer` writes the
 * prompt it built verbatim to `<slug>.review-input/prompt.md`, and those files are
 * tracked. An in-repo check could read the prompt all along; nothing did.
 *
 * `prompt_hash` was written into every findings marker, parsed by
 * `check_completion_review`, and **compared to nothing** — `--verify` /
 * `--verify-current` re-derive `scope_hash`, `roadmap_hash` and `ac_hash` only.
 * A retrospective scan of the committed corpus found the binding already broken
 * in two records, one of them dated after the only known cause was fixed. The
 * only link between a verdict and the prompt that produced it was broken,
 * currently, and nobody noticed — because nothing looked.
 *
 * WHAT IT DOES NOT DO, stated so the gate is not oversold. Three limits, and the
 * first is the cheapest bypass rather than the cleverest:
 *
 * 1. **Omission beats substitution.** Simply not committing
 *    `<slug>.review-input/prompt.md` drops the round out of the checkable set
 *    with no finding and no signal, because an artefact without a package is
 *    deliberately out of scope (see {@link collectPackages}). Nothing in the tree
 *    requires the package to exist. Measured on the corpus this gate shipped
 *    against: **11 of 19** artefacts already carry a `prompt_hash` with no
 *    package, so the bypassed state is the historical norm and is
 *    indistinguishable from it. Closing this needs a requirement that packages be
 *    committed — a migration decision, not a check.
 * 2. **Substitution stays undetectable.** The host that authors a steered prompt
 *    also writes the file, so swapping a clean prompt for the steered one passes.
 *    What changes is that steering then requires an act of substitution leaving
 *    its own artefact in the commit, instead of being invisible by default.
 * 3. **The steering predicate is one-of-four.** Against the four clauses the
 *    case-zero incident records verbatim, `preloadedVerdict` matches exactly one.
 *    That is the detection floor this buys, not a solved problem.
 *
 * Corpus-wide on purpose. `check_completion_review` deliberately reports grammar
 * violations only for the branch's own or scope-relevant artefacts, because a
 * stale foreign artefact must not poison an unrelated PR. That reasoning does not
 * transfer here: a committed `prompt.md` and its recorded hash are both immutable,
 * so the binding is branch-independent and a break in any record is a permanent
 * defect. With the two known breaks baselined, an unrelated PR stays green.
 *
 * Exit codes:
 *   0  every checkable binding re-derives, no steered prompt, baseline accurate
 *   1  a binding broke, a prompt carries a pre-loaded verdict, or the baseline
 *      no longer describes the corpus
 *   2  internal error (unreadable corpus, malformed baseline)
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';
import { parseArtifact } from './check_completion_review.js';
import { preloadedVerdict } from './hooks/evidence_independence.js';

const _HERE = path.resolve(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const DEFAULT_REVIEWS_DIR = 'agents/evidence/reviews';
const DEFAULT_BASELINE = 'src/config/review-prompt-binding-baseline.json';

/** A committed prompt whose recorded hash is known not to re-derive. */
export interface BaselineEntry {
    slug: string;
    /** The hash the findings marker records. */
    declared: string;
    /** The hash the committed `prompt.md` actually produces. */
    actual: string;
    reason: string;
    /**
     * An acknowledged steering match, pinned to the exact phrase.
     *
     * WHY THIS EXISTS, and why it is separate from the hash exemption. The
     * steering predicate is `preloadedVerdict`, a live regex list owned by
     * `evidence_independence` and expected to grow — its own history includes a
     * phrase dropped for false positives. A committed prompt cannot be edited
     * into compliance without rewriting a historical record. So with no
     * acknowledgement path at all, ONE phrase added to that shared list would
     * convert already-committed prompts into permanent blocks on every unrelated
     * PR, and a gate whose only output is an unfixable block is the gate that
     * gets switched off.
     *
     * The phrase is pinned rather than the slug: acknowledging "this record
     * matches THIS clause, and here is the human read of it" cannot silently
     * cover a DIFFERENT clause matching the same file later. The corpus carries
     * zero of these today, which is the state to keep.
     */
    steeredAck?: { phrase: string; reason: string };
}

export interface Finding {
    kind: 'binding-broken' | 'steered-prompt' | 'stale-baseline';
    slug: string;
    detail: string;
}

export interface Tally {
    /** Artefacts carrying both a `prompt_hash` and a committed prompt package. */
    packages: number;
    /** Packages whose hash re-derives. */
    binding: number;
    /** Packages whose hash does not re-derive (baselined or not). */
    broken: number;
    /** Of {@link broken}, how many an accurate baseline entry covers. */
    baselined: number;
    /** Packages whose prompt carries a pre-loaded verdict. */
    steered: number;
    /** Of {@link steered}, how many carry a phrase-pinned `steeredAck`. */
    steeringAcknowledged: number;
}

export function sha256(buf: Buffer | string): string {
    return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * Read the baseline, keyed by slug.
 *
 * A malformed baseline is an internal error, never an empty map: silently
 * treating an unparseable suppression file as "no exemptions" would red the gate
 * for the wrong reason, and treating it as "everything exempt" would disarm it.
 */
export function loadBaseline(file: string): Map<string, BaselineEntry> {
    const out = new Map<string, BaselineEntry>();
    let raw: string;
    try {
        raw = fs.readFileSync(file, 'utf-8');
    } catch {
        return out; // absent baseline = no exemptions, which is the strict state
    }
    const parsed = JSON.parse(raw) as { entries?: unknown };
    const entries = parsed.entries;
    if (!Array.isArray(entries)) {
        throw new Error(`${file}: expected an \`entries\` array`);
    }
    for (const e of entries) {
        const entry = e as Partial<BaselineEntry>;
        if (
            typeof entry.slug !== 'string' ||
            typeof entry.declared !== 'string' ||
            typeof entry.actual !== 'string' ||
            typeof entry.reason !== 'string'
        ) {
            throw new Error(`${file}: entry missing slug / declared / actual / reason`);
        }
        // A duplicate slug would silently overwrite the earlier entry, dropping
        // its reason and its falsifier — the precise hole the suppression
        // ratchet exists to prevent, and invisible to it because the file still
        // parses.
        if (out.has(entry.slug)) {
            throw new Error(`${file}: duplicate entry for slug '${entry.slug}'`);
        }
        const ack = entry.steeredAck;
        if (ack !== undefined && (typeof ack.phrase !== 'string' || typeof ack.reason !== 'string')) {
            throw new Error(`${file}: ${entry.slug}: steeredAck needs a phrase and a reason`);
        }
        out.set(entry.slug, {
            slug: entry.slug,
            declared: entry.declared.toLowerCase(),
            actual: entry.actual.toLowerCase(),
            reason: entry.reason,
            ...(ack === undefined ? {} : { steeredAck: ack }),
        });
    }
    return out;
}

interface Package {
    slug: string;
    /** Repo-relative, for messages. */
    artefact: string;
    declared: string;
    promptPath: string;
}

/**
 * The checkable set: an artefact with a `prompt_hash` AND a committed prompt.
 *
 * Either half absent means there is nothing to compare — exactly as before this
 * gate existed. That is a deliberate non-finding: `prompt_hash` is an additive
 * v1 field, so most historical artefacts predate it, and requiring a package
 * retroactively would turn a real check into a migration event.
 */
export function collectPackages(reviewsDirAbs: string, repo: string, ledger: GateLedger): Package[] {
    const names = fs
        .readdirSync(reviewsDirAbs)
        .filter((n) => n.endsWith('.findings.md'))
        .sort();
    ledger.plan(names);

    const out: Package[] = [];
    for (const name of names) {
        const slug = name.replace(/\.findings\.md$/, '');
        const abs = path.join(reviewsDirAbs, name);
        const declared = parseArtifact(fs.readFileSync(abs, 'utf-8')).marker?.promptHash;
        if (declared === undefined) {
            ledger.outOfScope(name, 'not_applicable_kind');
            continue;
        }
        const promptPath = path.join(reviewsDirAbs, `${slug}.review-input`, 'prompt.md');
        if (!fs.existsSync(promptPath)) {
            ledger.skip(name, 'no_applicable_files');
            continue;
        }
        out.push({
            slug,
            artefact: path.relative(repo, abs).split(path.sep).join('/'),
            declared: declared.toLowerCase(),
            promptPath,
        });
    }
    return out;
}

export function evaluate(
    packages: readonly Package[],
    baseline: Map<string, BaselineEntry>,
    ledger: GateLedger,
): { findings: Finding[]; tally: Tally } {
    const findings: Finding[] = [];
    const tally: Tally = {
        packages: packages.length,
        binding: 0,
        broken: 0,
        baselined: 0,
        steered: 0,
        steeringAcknowledged: 0,
    };
    const matched = new Set<string>();

    for (const pkg of packages) {
        const name = `${pkg.slug}.findings.md`;
        // ONE read: the hash must cover exactly the bytes the steering predicate
        // screened. Two reads leave a window in which they could differ, which
        // would publish a hash that does not correspond to the text that was
        // checked — undetectable downstream.
        const buf = fs.readFileSync(pkg.promptPath);
        const text = buf.toString('utf-8');
        const actual = sha256(buf);
        let failed: string | null = null;
        const entry = baseline.get(pkg.slug);

        // Steering is checked on EVERY package, including one whose hash is
        // baselined: the hash exemption covers a hash, never the content. It can
        // only be acknowledged by its own `steeredAck`, pinned to the matched
        // phrase — see the field's docstring for why an acknowledgement path has
        // to exist at all.
        const steer = preloadedVerdict(text);
        if (steer !== null) {
            tally.steered += 1;
            const ack = entry?.steeredAck;
            if (ack !== undefined && ack.phrase === steer) {
                tally.steeringAcknowledged += 1;
                matched.add(pkg.slug);
            } else {
                failed = `pre-loaded verdict in the committed prompt: ${JSON.stringify(steer)}`;
                findings.push({
                    kind: 'steered-prompt',
                    slug: pkg.slug,
                    detail:
                        `${pkg.artefact}: the reviewer prompt carries ${JSON.stringify(steer)} — ` +
                        'a verdict authored into the prompt, which is the case-zero failure ' +
                        '(evaluator-independence). It is not covered by a hash exemption; ' +
                        'acknowledging it needs a `steeredAck` entry pinning this exact phrase.',
                });
            }
        }

        if (actual === pkg.declared) {
            tally.binding += 1;
        } else {
            tally.broken += 1;
            if (entry !== undefined && entry.declared === pkg.declared && entry.actual === actual) {
                tally.baselined += 1;
                matched.add(pkg.slug);
            } else if (entry !== undefined) {
                matched.add(pkg.slug);
                failed = 'baselined break moved';
                findings.push({
                    kind: 'stale-baseline',
                    slug: pkg.slug,
                    detail:
                        `${pkg.artefact}: baselined as declared=${entry.declared} actual=${entry.actual}, ` +
                        `but the corpus now reads declared=${pkg.declared} actual=${actual}. ` +
                        'The record moved — repair it or re-record the entry with the reason it changed.',
                });
            } else {
                failed = 'binding broken';
                findings.push({
                    kind: 'binding-broken',
                    slug: pkg.slug,
                    detail:
                        `${pkg.artefact}: prompt_hash ${pkg.declared} does not re-derive from ` +
                        `${path.basename(path.dirname(pkg.promptPath))}/prompt.md (sha256 ${actual}). ` +
                        'The verdict is no longer attributable to the prompt that produced it.',
                });
            }
        }

        if (failed === null) {
            ledger.complete(name);
        } else {
            ledger.fail(name, failed);
        }
    }

    // A baseline entry naming a slug the corpus no longer carries is a hole the
    // ratchet cannot see: it would keep exempting a record that is gone, and the
    // day a package returns under that slug it would be exempt for free.
    for (const [slug, entry] of baseline) {
        if (!matched.has(slug)) {
            findings.push({
                kind: 'stale-baseline',
                slug,
                detail:
                    `baseline entry '${slug}' matches no broken binding in the corpus ` +
                    `(reason recorded: ${entry.reason.slice(0, 80)}…) — the record was repaired or ` +
                    'removed, so the entry must go with it.',
            });
        }
    }

    return { findings, tally };
}

/**
 * `--self-test`: prove the CLI still rejects, not just that the functions do.
 *
 * The fixtures are the two failures the roadmap named — a one-byte prompt edit
 * and a pre-loaded verdict — plus an intact corpus, so a suite that only ever
 * rejects would be visible as a suite that discriminates nothing.
 */
function selfTest(): number {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-binding-selftest-'));
    const marker = (h: string): string =>
        `<!-- completion-review: v1 | reviewed: 2026-08-13 | scope: ${'a'.repeat(64)} | ` +
        `diff: abc1234 | reviewer: r2-fresh-subagent-x | prompt_hash: ${h} -->`;

    const build = (slug: string, prompt: string, declared: string): string => {
        const dir = fs.mkdtempSync(path.join(root, 'corpus-'));
        const reviews = path.join(dir, 'reviews');
        fs.mkdirSync(path.join(reviews, `${slug}.review-input`), { recursive: true });
        fs.writeFileSync(
            path.join(reviews, `${slug}.findings.md`),
            `# Findings: ${slug}\n${marker(declared)}\n`,
            'utf-8',
        );
        fs.writeFileSync(path.join(reviews, `${slug}.review-input`, 'prompt.md'), prompt, 'utf-8');
        return dir;
    };

    const invoke = (corpus: string): number =>
        runGateCli(
            REPO_ROOT,
            'src/scripts/check_review_prompt_binding.ts',
            // No baseline: a self-test that could be silenced by the shipped
            // exemptions would prove the exemptions, not the detection.
            ['--repo', corpus, '--reviews-dir', 'reviews', '--baseline', 'absent-baseline.json'],
            corpus,
        );

    const intact = 'Review the diff against the roadmap and report findings.\n';
    const cases: SelfTestCase[] = [
        {
            name: 'intact binding is accepted',
            expect: 'accept',
            run: () => invoke(build('intact', intact, sha256(intact))),
        },
        {
            name: 'a one-byte prompt edit breaks the binding',
            expect: 'reject',
            run: () => invoke(build('edited', `${intact}.`, sha256(intact))),
        },
        {
            name: 'a pre-loaded verdict in the prompt is caught even when the hash re-derives',
            expect: 'reject',
            run: () => {
                const steered = `${intact}NO-FINDINGS is expected and welcome.\n`;
                return invoke(build('steered', steered, sha256(steered)));
            },
        },
    ];

    try {
        return runSelfTest({ gate: 'check_review_prompt_binding', cases, minCases: 3, minRejectCases: 2 });
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}

interface Args {
    repo: string;
    reviewsDir: string;
    baseline: string;
    json: boolean;
}

function parseArgs(argv: readonly string[]): Args {
    const args: Args = {
        repo: REPO_ROOT,
        reviewsDir: DEFAULT_REVIEWS_DIR,
        baseline: DEFAULT_BASELINE,
        json: false,
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        const take = (): string => {
            const v = argv[++i];
            if (v === undefined) {
                process.stderr.write(`check_review_prompt_binding: ${a} expects one argument\n`);
                // § 6: the count is emitted on EVERY exit path, exit 2 included —
                // the coverage guard must never be left without a number.
                process.stdout.write('scanned: 0\n');
                process.exit(2);
            }
            return v;
        };
        if (a === '--repo') args.repo = path.resolve(take());
        else if (a === '--reviews-dir') args.reviewsDir = take();
        else if (a === '--baseline') args.baseline = take();
        else if (a === '--json') args.json = true;
        else if (a === '-h' || a === '--help') {
            process.stdout.write(
                'usage: check_review_prompt_binding [--repo DIR] [--reviews-dir REL] ' +
                    '[--baseline REL] [--json]\n',
            );
            process.exit(0);
        } else {
            process.stderr.write(`check_review_prompt_binding: unrecognized argument: ${a}\n`);
            process.stdout.write('scanned: 0\n');
            process.exit(2);
        }
    }
    return args;
}

export function main(argv?: readonly string[]): number {
    const raw = argv ?? process.argv.slice(2);
    if (raw.includes('--self-test')) {
        return selfTest();
    }
    const args = parseArgs(raw);
    const reviewsDirAbs = path.isAbsolute(args.reviewsDir)
        ? args.reviewsDir
        : path.join(args.repo, args.reviewsDir);
    const baselineAbs = path.isAbsolute(args.baseline)
        ? args.baseline
        : path.join(args.repo, args.baseline);

    const ledger = new GateLedger('check_review_prompt_binding');
    let packages: Package[];
    let baseline: Map<string, BaselineEntry>;
    try {
        packages = collectPackages(reviewsDirAbs, args.repo, ledger);
        baseline = loadBaseline(baselineAbs);
    } catch (exc) {
        process.stderr.write(
            `❌  check_review_prompt_binding: ${exc instanceof Error ? exc.message : String(exc)}\n`,
        );
        process.stdout.write('scanned: 0\n');
        return 2;
    }

    // In `--json` mode stdout carries the payload and NOTHING else, because both
    // baseline entries name `--json` as their falsifier and a falsifier that has
    // to be un-interleaved before it parses is not re-runnable. The human lines,
    // the ledger and the `scanned:` count all move to stderr there.
    const out = args.json
        ? process.stderr.write.bind(process.stderr)
        : process.stdout.write.bind(process.stdout);

    let findings: Finding[];
    let tally: Tally;
    try {
        // The count is the CHECKABLE set, not the directory listing: an artefact
        // with no prompt package was not inspected, and counting it would be the
        // false-coverage claim `scanned:` exists to prevent. `reportScanned`
        // asserts and publishes the SAME number — splitting the two is how a
        // published count drifts from the validated one.
        reportScanned(
            {
                gate: 'check_review_prompt_binding',
                scanned: packages.length,
                units: 'reviewer prompt package(s)',
                roots: [args.reviewsDir],
            },
            out,
        );
        ({ findings, tally } = evaluate(packages, baseline, ledger));
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        // Anything else here is an internal error, and § 6 maps those to 2 so a
        // broken gate cannot block the change that repairs it. Letting it throw
        // would exit 1 — the "policy violation, block" code — inverting the
        // contract for exactly the failures the docstring promises are exit 2.
        process.stderr.write(
            `❌  check_review_prompt_binding: ${exc instanceof Error ? exc.message : String(exc)}\n`,
        );
        return 2;
    }

    ledger.report(out);
    out(
        `prompt bindings: ${String(tally.packages)} package(s) · ${String(tally.binding)} binding · ` +
            `${String(tally.steered)} steered (${String(tally.steeringAcknowledged)} acknowledged) · ` +
            `${String(tally.broken)} broken (${String(tally.baselined)} baselined)\n`,
    );

    if (args.json) {
        process.stdout.write(`${JSON.stringify({ tally, findings }, null, 2)}\n`);
    }

    if (findings.length === 0) {
        return 0;
    }
    process.stderr.write(`\n❌  ${String(findings.length)} prompt-binding finding(s):\n`);
    for (const f of findings) {
        process.stderr.write(`    [${f.kind}] ${f.detail}\n`);
    }
    return 1;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
        return true;
    }
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) ===
            fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
