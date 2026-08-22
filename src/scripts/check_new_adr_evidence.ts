#!/usr/bin/env tsx
/**
 * A NEW accepted ADR must disclose its evidence — the half of AC-5 that had no
 * mechanism.
 *
 * AC-5 of `road-to-evidence-based-adr-governance` claims that "a newly added
 * accepted ADR cannot pass CI without an Evidence section, a substantive
 * `review_trigger`, and no unscoped permanence language". Two of those three
 * were enforced by `check_adr_frontmatter`. The first was not, and that gate's
 * own docstring said so: `check_descriptive_axes` validates the SHAPE of an axis
 * that is PRESENT, so a fresh record with no `provenance`, no `evidence` and no
 * `## Evidence` section passed every gate in this tree.
 *
 * The blocker was real and structural rather than an omission: requiring the
 * axes needs a notion of NEW, and a single-file linter has none — it sees a
 * `date:` the author typed, not whether the record is new to the repository, and
 * a backdated record slips straight through that proxy. The fix named there was
 * "a two-ref diff, which is buildable and not built". This is that diff.
 *
 * ## What it requires, and of what
 *
 * Scope: records **ADDED** relative to a base ref (`git diff --diff-filter=A`),
 * under `docs/decisions/ADR-*.md` and `docs/adrs/<area>/NNNN-*.md`. Records that
 * already existed are untouched — the 147 accepted records in the corpus predate
 * the axes, and retrofitting them is a migration event this gate deliberately is
 * not. Same scope decision, same reasoning, as `lint_evidence_artifacts`.
 *
 * Of an added record whose `status:` is `accepted`, all three:
 *
 *   1. a `provenance:` map carrying a `kind:`
 *   2. an `evidence:` map carrying a `strength:`
 *   3. an `## Evidence` section in the body (heading at any level)
 *
 * `authority_basis: owner_intent` does NOT excuse the section. That field
 * governs where a record's AUTHORITY comes from — an owner purpose statement is
 * legitimately E0 and its alternatives are foreclosed by ownership — and it says
 * nothing about whether the record discloses what it rests on. Reading it as a
 * disclosure exemption would turn the one honest escape into the hole.
 *
 * Non-`accepted` added records (`proposed`, `superseded`, …) are OUT OF SCOPE
 * and are reported as such, per file, rather than silently skipped: a record can
 * legitimately ship `proposed` precisely so its acceptance is separately
 * reviewable (ADR-239 does), and a gate that prints nothing about them is
 * indistinguishable from a gate that failed to see them.
 *
 * ## What it does NOT do
 *
 * It checks the axes are PRESENT, never that their values are valid. Vocabulary
 * validation (`kind` ∈ {human, agentic, mixed, unknown}, `strength` ∈ E0…E4,
 * the `review_trigger` staging, permanence language) is
 * `check_adr_frontmatter`'s and stays there — one axis, one owner. Nor does it
 * judge whether the `## Evidence` section says anything true; no gate can, and
 * that stays a human read at review time.
 *
 * It reads frontmatter through the SHARED reader `_lib/adr_frontmatter.ts`. The
 * tree carried three divergent ADR parsers until that extraction; a fourth
 * would have re-created the exact divergence — and the nested axes are the
 * shapes the old regex reader silently read as absent.
 *
 * Usage:
 *   ./scripts-run src/scripts/check_new_adr_evidence            # gate
 *   ./scripts-run src/scripts/check_new_adr_evidence --base REF
 *   ./scripts-run src/scripts/check_new_adr_evidence --self-test
 *
 * Exit codes: 0 clean (including "nothing added") · 1 violation · 2 usage/env.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { evidenceOf, provenanceOf, readAdrFrontmatter } from './_lib/adr_frontmatter.js';
import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { resolveBaseRef } from './_lib/ratchet_base_ref.js';
import { reportScanned } from './_lib/scan_scope.js';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(_HERE, '..', '..');

/** The two decision surfaces that carry numbered records. */
export const ADR_PATHSPECS = [
    'docs/decisions/ADR-*.md',
    'docs/adrs/*/[0-9][0-9][0-9][0-9]-*.md',
] as const;

/**
 * The same two surfaces as anchored regexes.
 *
 * Git's default pathspec wildcards match `/`, so `docs/adrs/*​/NNNN-*.md` can
 * over-match a deeper path. The pathspecs narrow what git has to walk; these
 * decide what is in scope. Belt and braces, because an over-match here is a
 * false red on somebody else's file.
 */
const ADR_PATH_RES = [
    /^docs\/decisions\/ADR-[^/]*\.md$/,
    /^docs\/adrs\/[^/]+\/\d{4}-[^/]*\.md$/,
] as const;

/** Fenced blocks, so a quoted `## Evidence` inside one is not a declaration. */
const FENCE_RE = /^(?:```|~~~)/;

/** An `Evidence` heading at any level. The heading, never a mention of the word. */
const EVIDENCE_HEADING_RE = /^#{1,6}[ \t]+Evidence\b/;

/**
 * Does the body carry an `## Evidence` section?
 *
 * Fenced blocks are stripped first. An ADR that quotes a template — and several
 * in this corpus do — would otherwise satisfy the check by showing what the
 * section looks like instead of by having one.
 *
 * A heading is accepted when its text STARTS with `Evidence`, so
 * `## Evidence and assumptions` counts. The alternative (exact match) would
 * reject a legitimate compound heading, and the failure mode of this check is
 * the one worth minimising: it is a disclosure floor, not a style rule.
 */
export function hasEvidenceSection(text: string): boolean {
    let inFence = false;
    for (const raw of text.split('\n')) {
        const line = raw.trim();
        if (FENCE_RE.test(line)) {
            inFence = !inFence;
            continue;
        }
        if (inFence) continue;
        if (EVIDENCE_HEADING_RE.test(line)) return true;
    }
    return false;
}

function _git(root: string, args: readonly string[]): string {
    // GIT_DIR / GIT_WORK_TREE / GIT_INDEX_FILE are inherited inside a git hook
    // and point at the INVOKING repository, so a `cwd`-scoped call silently
    // reads the wrong tree. This repo has already recorded that failure once.
    const env = { ...process.env };
    delete env['GIT_DIR'];
    delete env['GIT_WORK_TREE'];
    delete env['GIT_INDEX_FILE'];
    return execFileSync('git', [...args], {
        cwd: root,
        encoding: 'utf8',
        env,
        maxBuffer: 64 * 1024 * 1024,
    });
}

/** Decision records ADDED relative to `baseRef`. */
export function addedAdrRecords(root: string, baseRef: string): string[] {
    const out = _git(root, [
        'diff',
        '--name-only',
        '--diff-filter=A',
        `${baseRef}...HEAD`,
        '--',
        ...ADR_PATHSPECS,
    ]);
    return out
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s !== '' && ADR_PATH_RES.some((re) => re.test(s)))
        .sort();
}

export interface Finding {
    readonly file: string;
    readonly reason: string;
}

/** Records considered, split by what the gate did with each. */
export interface CheckResult {
    readonly findings: Finding[];
    /** Added records whose status is not `accepted` — named, not hidden. */
    readonly outOfScope: { readonly file: string; readonly status: string }[];
    readonly checked: string[];
}

const REMEDY =
    'add `provenance:` (with `kind:`), `evidence:` (with `strength:`) and an ' +
    '`## Evidence` section — see docs/contracts/adr-layout.md and ADR-239. ' +
    '`authority_basis: owner_intent` governs authority, never disclosure, and ' +
    'does not exempt any of the three.';

export function checkRecords(root: string, files: readonly string[], ledger?: GateLedger): CheckResult {
    const findings: Finding[] = [];
    const outOfScope: { file: string; status: string }[] = [];
    const checked: string[] = [];
    ledger?.plan([...files]);

    for (const rel of files) {
        let text: string;
        try {
            text = fs.readFileSync(path.join(root, rel), 'utf8');
        } catch {
            // Listed by git, absent on disk: an added-then-moved path in a dirty
            // tree hits this and is somebody else's gate, not a finding here.
            ledger?.outOfScope(rel, 'no_applicable_files');
            continue;
        }

        const fm = readAdrFrontmatter(text);
        if (fm === null) {
            // A NEW record with no YAML block cannot be classified at all — its
            // status is unreadable, so "is it accepted" has no answer. Failing is
            // the honest direction: the alternative is to let an unreadable
            // record through the one gate that exists to read it.
            ledger?.fail(rel, 'no YAML frontmatter');
            findings.push({
                file: rel,
                reason: 'no YAML frontmatter — a new decision record carries one, so its status and axes can be read',
            });
            continue;
        }

        const status = (fm.scalars['status'] ?? '').trim();
        if (status !== 'accepted') {
            outOfScope.push({ file: rel, status: status === '' ? '(unset)' : status });
            ledger?.outOfScope(rel, 'not_applicable_kind');
            continue;
        }

        const missing: string[] = [];
        if (provenanceOf(fm)?.kind == null) missing.push('`provenance.kind`');
        if (evidenceOf(fm)?.strength == null) missing.push('`evidence.strength`');
        if (!hasEvidenceSection(text)) missing.push('an `## Evidence` section');

        if (missing.length > 0) {
            ledger?.fail(rel, `missing ${missing.join(', ')}`);
            findings.push({
                file: rel,
                reason: `accepted on arrival and missing ${missing.join(', ')} — ${REMEDY}`,
            });
            continue;
        }
        checked.push(rel);
        ledger?.complete(rel);
    }
    return { findings, outOfScope, checked };
}

function _argValue(argv: readonly string[], flag: string): string | null {
    const i = argv.indexOf(flag);
    if (i === -1) return null;
    const v = argv[i + 1];
    return v === undefined || v.startsWith('--') ? null : v;
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    if (argv.includes('--self-test')) return selfTest();

    const root = process.cwd();

    // `resolveBaseRef` rather than a hardcoded `origin/main`: `actions/checkout`
    // performs a shallow PR-merge fetch, so a PR build frequently has no
    // `origin/main` remote-tracking ref at all. That ladder is the repo's one
    // answer to this question and it needs no network on those builds.
    const baseRef = _argValue(argv, '--base') ?? resolveBaseRef(root);
    if (baseRef === null) {
        // Fail rather than compare against an assumed-empty base. An
        // unresolvable base makes every record look un-added, and the gate would
        // then pass by scanning nothing — the precise false green it exists to
        // remove from AC-5.
        process.stderr.write(
            'check_new_adr_evidence: no base ref resolved — pass --base <ref> or set RATCHET_BASE_REF\n',
        );
        return 2;
    }

    let files: string[];
    try {
        files = addedAdrRecords(root, baseRef);
    } catch (exc) {
        process.stderr.write(`check_new_adr_evidence: cannot diff against ${baseRef} — ${String(exc)}\n`);
        return 2;
    }

    const ledger = new GateLedger('check_new_adr_evidence');
    const result = checkRecords(root, files, ledger);
    ledger.report();

    // Zero added records is the NORMAL case, so it must exit green — and say so.
    // `assertScanned` throws on a zero count unless a justified `allowEmpty`
    // reason is supplied, and the reason here is `EMPTY_VALID` rather than
    // `OPTIONAL_INPUT`: the scope is a DIFF, not a corpus, so "this branch added
    // no decision record" genuinely is the pass, and stays true even if
    // `docs/decisions/` were deleted outright. The line is still emitted, because
    // a silent green over an empty set is how a gate stops measuring anything
    // without anyone noticing.
    //
    // The honest cost, named rather than implied: an unconditional `allowEmpty`
    // means the scope assertion can never fire for this gate, so it buys no
    // dead-root protection. What replaces it is `--self-test`, which proves the
    // verdict still moves — the property a `scanned:` floor cannot establish for
    // a gate whose usual reading is zero.
    reportScanned({
        gate: 'check_new_adr_evidence',
        scanned: files.length,
        units: 'added decision record(s)',
        roots: ['docs/decisions', 'docs/adrs'],
        allowEmpty:
            'EMPTY_VALID: the scope is the set of records ADDED since the base ref; ' +
            'a branch that adds none has nothing to disclose, and zero is the pass.',
    });

    if (files.length === 0) {
        process.stdout.write(
            `check_new_adr_evidence: ✅ no decision record added since ${baseRef} — nothing to check\n`,
        );
        return 0;
    }

    for (const row of result.outOfScope) {
        process.stdout.write(
            `    ⚪ ${row.file}: status ${row.status} — out of scope; this gate requires disclosure of \`accepted\` records only\n`,
        );
    }

    process.stdout.write(
        `check_new_adr_evidence: ${String(files.length)} added record(s) since ${baseRef} · ` +
            `${String(result.checked.length)} accepted and disclosing · ` +
            `${String(result.outOfScope.length)} not accepted · ` +
            `${String(result.findings.length)} violation(s)\n`,
    );

    if (result.findings.length > 0) {
        for (const f of result.findings) {
            process.stderr.write(`    ❌ ${f.file}: ${f.reason}\n`);
        }
        process.stderr.write(
            `\n❌  check_new_adr_evidence: ${String(result.findings.length)} new record(s) claim ` +
                'accepted status without disclosing what they rest on.\n',
        );
        return 1;
    }
    process.stdout.write('✅  check_new_adr_evidence: no violations\n');
    return 0;
}

// ---------------------------------------------------------------------------
// --self-test — drives the REAL binary over synthetic repositories.
// ---------------------------------------------------------------------------

/**
 * Why this gate needs a self-test more than most.
 *
 * Its normal reading is ZERO added records, and that is exactly the state where
 * a working gate and a completely broken one emit the same output: `scanned: 0`,
 * green. A `min_scanned` floor cannot separate them — a floor of 0 can never
 * trip, and any higher floor would red every branch that adds no ADR. Only
 * feeding it a synthetic added-accepted-record-without-evidence and watching the
 * verdict move proves the reading still changes the answer.
 *
 * Each case builds a throwaway git repository, commits a base, then commits the
 * record on top, and runs the real CLI with `--base <base-sha>` — so the diff
 * path, the argv parsing and the entry guard are all under test rather than an
 * imported function.
 */
interface FixtureOpts {
    /** Frontmatter body between the `---` markers. */
    readonly frontmatter: string;
    /** Markdown body after the frontmatter. */
    readonly body: string;
    /** Repo-relative path for the record; defaults to a flat ADR. */
    readonly rel?: string;
}

function _gitQuiet(root: string, args: readonly string[]): void {
    const env = { ...process.env };
    delete env['GIT_DIR'];
    delete env['GIT_WORK_TREE'];
    delete env['GIT_INDEX_FILE'];
    execFileSync(
        'git',
        [
            '-c',
            'user.email=selftest@example.invalid',
            '-c',
            'user.name=self-test',
            '-c',
            'commit.gpgsign=false',
            '-c',
            'core.hooksPath=',
            ...args,
        ],
        { cwd: root, encoding: 'utf8', env, stdio: 'pipe' },
    );
}

function _write(root: string, rel: string, contents: string): void {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, contents, 'utf8');
}

/** A repo whose HEAD adds `record` (or nothing) on top of a committed base. */
function _repo(parent: string, record: FixtureOpts | null): { root: string; base: string } {
    const root = fs.mkdtempSync(path.join(parent, 'repo-'));
    _gitQuiet(root, ['init', '-q']);
    _write(root, 'README.md', '# base\n');
    _gitQuiet(root, ['add', '-A']);
    _gitQuiet(root, ['commit', '-q', '-m', 'base']);
    const base = _git(root, ['rev-parse', 'HEAD']).trim();
    if (record !== null) {
        _write(
            root,
            record.rel ?? 'docs/decisions/ADR-901-probe.md',
            `---\n${record.frontmatter}\n---\n\n# ADR-901 — probe\n\n${record.body}\n`,
        );
        _gitQuiet(root, ['add', '-A']);
        _gitQuiet(root, ['commit', '-q', '-m', 'add record']);
    }
    return { root, base };
}

const FULL_FRONTMATTER = [
    'adr: 901',
    'status: accepted',
    'date: 2026-08-21',
    'decision: probe',
    'review_trigger: Reopen when the probe stops probing.',
    'provenance:',
    '  kind: mixed',
    '  decision_makers: [owner]',
    'evidence:',
    '  strength: E3',
    '  discovery: complete',
].join('\n');

export function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cnae-'));

    const run = (record: FixtureOpts | null): number => {
        const { root, base } = _repo(tmp, record);
        return runGateCli(REPO_ROOT, 'src/scripts/check_new_adr_evidence.ts', ['--base', base], root);
    };

    const withoutLines = (drop: RegExp): string =>
        FULL_FRONTMATTER.split('\n')
            .filter((l) => !drop.test(l))
            .join('\n');

    try {
        return runSelfTest({
            gate: 'check_new_adr_evidence',
            minCases: 7,
            minRejectCases: 4,
            cases: [
                {
                    name: 'a branch that adds no record passes — the normal case must stay green',
                    expect: 'accept',
                    run: () => run(null),
                },
                {
                    name: 'an added accepted record with both axes and an `## Evidence` section passes',
                    expect: 'accept',
                    run: () =>
                        run({ frontmatter: FULL_FRONTMATTER, body: '## Evidence\n\nMeasured.\n' }),
                },
                {
                    name: 'an added accepted record with NO `## Evidence` section is rejected — the AC-5 gap itself',
                    expect: 'reject',
                    run: () => run({ frontmatter: FULL_FRONTMATTER, body: '## Context\n\nNothing.\n' }),
                },
                {
                    name: 'an added accepted record with no `evidence.strength` is rejected',
                    expect: 'reject',
                    run: () =>
                        run({
                            frontmatter: withoutLines(/^(evidence:|\s+strength:|\s+discovery:)/),
                            body: '## Evidence\n\nMeasured.\n',
                        }),
                },
                {
                    name: 'an added accepted record with no `provenance.kind` is rejected',
                    expect: 'reject',
                    run: () =>
                        run({
                            frontmatter: withoutLines(/^(provenance:|\s+kind:|\s+decision_makers:)/),
                            body: '## Evidence\n\nMeasured.\n',
                        }),
                },
                {
                    name: '`authority_basis: owner_intent` does not excuse the section — authority is not disclosure',
                    expect: 'reject',
                    run: () =>
                        run({
                            frontmatter: `${FULL_FRONTMATTER}\nauthority_basis: owner_intent`,
                            body: '## Context\n\nOwner says so.\n',
                        }),
                },
                {
                    name: 'a non-accepted added record is out of scope, not a violation',
                    expect: 'accept',
                    run: () =>
                        run({
                            frontmatter: FULL_FRONTMATTER.replace('status: accepted', 'status: proposed')
                                .split('\n')
                                .filter((l) => !/^(provenance:|evidence:|\s{2}\w+:)/.test(l))
                                .join('\n'),
                            body: '## Context\n\nStill being argued.\n',
                        }),
                },
            ],
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

// Main-guard (realpath-compared, mirrors the repo convention).
function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv1 = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv1;
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
