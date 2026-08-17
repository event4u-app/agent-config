#!/usr/bin/env tsx
/**
 * Skill-top position gate — where a skill's obligation block sits in its file.
 *
 * road-to-context-fidelity Phase 3. Post-compaction re-injection of a skill file
 * truncates by keeping the file START, so an obligation that sits 300 lines down
 * is the first thing a truncating reader loses. The cheap authoring-time
 * mitigation is ordering: put the binding fraction near the top.
 * `token-budget-discipline` already states this obligation in prose ("A RICH-CLASS
 * ARTIFACT OPENS WITH THE SECTION THAT OUTRANKS THE REST OF ITS OWN DOCUMENT");
 * nothing checked it. This gate measures it.
 *
 * WHAT THIS GATE DOES NOT CLAIM — read this before quoting its number.
 *
 *   1. **The host truncation cap is UNVERIFIED here.** The Phase 3 step asks for
 *      it to be "re-verified against current host documentation at build time",
 *      and this gate does not do that: a tree-side script cannot read a vendor
 *      doc, and fetching one at build time would make the gate network-dependent
 *      and non-deterministic. So TOP_WINDOW_LINES below is a repo-side PROXY,
 *      not a host fact, and it is labelled as one everywhere it is printed.
 *   2. **The number is a stated default, not a measured optimum.** Nothing in
 *      this tree measures what a truncating reader actually keeps. Presenting 60
 *      as derived would be the unbacked-number failure this repo gates against
 *      elsewhere. Revisit-if: a host doc pins a real cap, or the distribution
 *      this gate prints shows the window separates nothing.
 *   3. **It does not claim a compliance or activation effect.** Whether a reader
 *      that lost the tail behaves differently is unobserved (ADR-202's lesson:
 *      an activation claim goes behind a measured instrument or is not made).
 *
 * WARN LEVEL, DELIBERATELY. Exit is 0 on findings. The Phase 3 exit criterion is
 * "reports a count without failing the build", and escalation to blocking is
 * gated on one release of this gate's own data. Findings print on stdout, not
 * stderr, so no warning-transition detector reads an advisory count as a
 * regression.
 *
 * Usage:
 *     ./scripts-run src/scripts/lint_skill_top_position
 *     ./scripts-run src/scripts/lint_skill_top_position --quiet
 *     ./scripts-run src/scripts/lint_skill_top_position --format json
 *
 * Exit codes: 0 = ran (with or without findings) · 2 = usage error or dead scope.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { assertWatchlistResolves, DeadScopeError } from './_lib/scan_scope.js';

const _FILE = fileURLToPath(import.meta.url);
const _HERE = path.dirname(_FILE);
const REPO = path.resolve(_HERE, '..', '..');
const SKILLS_REL = 'src/skills';
const PROG = 'lint_skill_top_position';

/**
 * Lines from the file start within which an obligation block is considered
 * top-positioned. A STATED DEFAULT — see § 2 of the header. Not a host cap.
 */
export const TOP_WINDOW_LINES = 60;

/**
 * An obligation-block heading, as `preservation-guard` defines it: `Iron Law`,
 * `Iron Laws`, `The Iron Law`, at any heading level, including numbered variants
 * (`Iron Law 1`). Matching the same shape that rule protects keeps one
 * definition in play rather than inventing a second.
 */
export const OBLIGATION_HEADING_RE = /^#{1,6}\s+(?:the\s+)?iron\s+law(?:s)?(?:\s+\d+)?\b/i;

export interface SkillPosition {
    /** Skill folder name. */
    readonly name: string;
    /** Total lines in SKILL.md, counted the way `wc -l` counts. */
    readonly lines: number;
    /** 1-based line of the first obligation heading, or null when none exists. */
    readonly firstObligationLine: number | null;
}

export interface Finding {
    readonly skill: string;
    readonly line: number;
    readonly lines: number;
    readonly message: string;
}

/** Count lines the way `wc -l` does, so the gate and a shell check agree. */
export function countLines(text: string): number {
    if (text.length === 0) return 0;
    const n = text.split('\n').length;
    return text.endsWith('\n') ? n - 1 : n;
}

/**
 * 1-based line of the first obligation heading in `text`, or null.
 *
 * Fenced blocks are skipped: `preservation-guard`'s own prose quotes the heading
 * shapes it protects inside examples, and a gate that matched those would report
 * the document describing the rule rather than a document carrying one.
 */
export function firstObligationLine(text: string): number | null {
    let inFence = false;
    let fenceMarker = '';
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i] ?? '';
        const trimmed = raw.trimStart();
        const fence = /^(`{3,}|~{3,})/.exec(trimmed);
        if (fence !== null) {
            const marker = (fence[1] as string)[0] as string;
            if (!inFence) {
                inFence = true;
                fenceMarker = marker;
            } else if (marker === fenceMarker) {
                inFence = false;
                fenceMarker = '';
            }
            continue;
        }
        if (inFence) continue;
        if (OBLIGATION_HEADING_RE.test(trimmed)) return i + 1;
    }
    return null;
}

/** Read every `<skillsRoot>/<name>/SKILL.md` and locate its obligation block. */
export function collectPositions(skillsRoot: string): SkillPosition[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(skillsRoot, { withFileTypes: true });
    } catch {
        return [];
    }
    const out: SkillPosition[] = [];
    for (const e of entries) {
        if (!e.isDirectory()) continue;
        const head = path.join(skillsRoot, e.name, 'SKILL.md');
        let text: string;
        try {
            text = fs.readFileSync(head, 'utf-8');
        } catch {
            continue;
        }
        out.push({ name: e.name, lines: countLines(text), firstObligationLine: firstObligationLine(text) });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * A skill is a finding when it HAS an obligation block that starts below the
 * window. A skill with no obligation block is not a finding — there is nothing
 * to position, and inventing one would turn a positioning check into a
 * "every skill needs an Iron Law" mandate nobody asked for.
 */
export function evaluate(
    positions: readonly SkillPosition[],
    window: number = TOP_WINDOW_LINES,
): { readonly findings: Finding[]; readonly withBlock: number; readonly withoutBlock: number } {
    const findings: Finding[] = [];
    let withBlock = 0;
    let withoutBlock = 0;
    for (const p of positions) {
        if (p.firstObligationLine === null) {
            withoutBlock += 1;
            continue;
        }
        withBlock += 1;
        if (p.firstObligationLine <= window) continue;
        findings.push({
            skill: p.name,
            line: p.firstObligationLine,
            lines: p.lines,
            message:
                `first obligation block at line ${p.firstObligationLine} of ${p.lines} ` +
                `(proxy window ${window}) — a truncating reader keeps the file start, so an ` +
                'obligation this far down is the first thing lost',
        });
    }
    return { findings, withBlock, withoutBlock };
}

/** Percentile over a sorted numeric array, nearest-rank. */
export function percentile(sorted: readonly number[], p: number): number | null {
    if (sorted.length === 0) return null;
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[idx] ?? null;
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

class ExitCode extends Error {
    readonly code: number;
    constructor(code: number) {
        super(`exit ${code}`);
        this.code = code;
    }
}

function parseArgs(argv: string[]): { readonly quiet: boolean; readonly json: boolean } {
    let quiet = false;
    let json = false;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--quiet') {
            quiet = true;
        } else if (a === '--format') {
            const v = argv[++i];
            if (v === 'json') json = true;
            else if (v !== 'text') {
                process.stderr.write(`❌  ${PROG}: --format takes text|json\n`);
                throw new ExitCode(2);
            }
        } else if (a === '-h' || a === '--help') {
            process.stdout.write(`usage: ${PROG} [--quiet] [--format text|json]\n`);
            throw new ExitCode(0);
        } else {
            process.stderr.write(`❌  ${PROG}: unrecognized argument: ${a}\n`);
            throw new ExitCode(2);
        }
    }
    return { quiet, json };
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const args = parseArgs(argv);

    // The scanned root is the scope signal. A moved or renamed src/skills would
    // otherwise produce zero heads and a clean green over nothing at all.
    try {
        assertWatchlistResolves({
            gate: PROG,
            candidates: [`${SKILLS_REL}/skill-writing/SKILL.md`],
            repoRoot: REPO,
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 2;
        }
        throw exc;
    }

    const positions = collectPositions(path.join(REPO, SKILLS_REL));
    const { findings, withBlock, withoutBlock } = evaluate(positions);

    // Per-target accounting. The interesting outcome is the SKIP: a skill with
    // no obligation block is deliberately unchecked, which without a ledger is
    // indistinguishable from one that passed. The reason is the existing
    // `not_applicable_kind` rather than a new code — the ledger's vocabulary is
    // closed on purpose and the first adopter of a check translates into it.
    //
    // A flagged skill resolves as `complete`, not `fail`: at warn level the gate
    // checked it and reported, and `fail` is reserved for a target that reds the
    // build. Recording a warn as a failure would make the ledger disagree with
    // the exit code.
    const ledger = new GateLedger(PROG);
    ledger.plan(positions.map((p) => p.name));
    for (const p of positions) {
        if (p.firstObligationLine === null) ledger.skip(p.name, 'not_applicable_kind');
        else ledger.complete(p.name);
    }
    ledger.report();

    const offsets = positions
        .map((p) => p.firstObligationLine)
        .filter((n): n is number => n !== null)
        .sort((a, b) => a - b);
    const p50 = percentile(offsets, 50);
    const p90 = percentile(offsets, 90);

    if (args.json) {
        process.stdout.write(
            JSON.stringify(
                {
                    gate: PROG,
                    window_proxy_lines: TOP_WINDOW_LINES,
                    host_cap_verified: false,
                    scanned: positions.length,
                    with_obligation_block: withBlock,
                    without_obligation_block: withoutBlock,
                    below_window: findings.length,
                    offset_median: p50,
                    offset_p90: p90,
                    findings,
                },
                null,
                2,
            ) + '\n',
        );
        return 0;
    }

    // Findings go to STDOUT and the exit stays 0 — this is the warn level the
    // Phase 3 step asks for, and the count is the data escalation waits on.
    for (const f of findings) {
        process.stdout.write(`⚠️   ${SKILLS_REL}/${f.skill}/SKILL.md: ${f.message}\n`);
    }

    if (!args.quiet) {
        process.stdout.write(
            `✅  ${PROG}: ${positions.length} skill head(s) scanned · ` +
                `${withBlock} carry an obligation block, ${withoutBlock} carry none (unchecked) · ` +
                `${findings.length} below the ${TOP_WINDOW_LINES}-line proxy window · ` +
                `offset median ${p50 === null ? 'n/a' : String(p50)}, p90 ${p90 === null ? 'n/a' : String(p90)} · ` +
                'warn level — the host truncation cap is UNVERIFIED, the window is a repo-side proxy\n',
        );
    }
    return 0;
}

/** Robust "am I the entry script?" — realpath-compares argv[1] to this file. */
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

export { REPO, SKILLS_REL, ExitCode, PROG };
