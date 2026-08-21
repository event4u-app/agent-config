#!/usr/bin/env tsx
/**
 * Router-head gate — makes the published K6 cap true for NEW skills.
 *
 * `src/agent-src/templates/skill.md` has carried "K6: Under 400 lines" as a
 * checklist item since long before this gate. A checklist item is a statement
 * of intent that nothing checks; four skills exceed it today. This gate turns
 * the existing contract into an enforced one, without re-litigating the number.
 *
 * The rule: a SKILL.md over MAX_HEAD_LINES must be a router head — an entry
 * file (when-to-use, mode table, routing) plus per-mode bodies in `tasks/` or
 * `references/` inside the skill folder. Over the cap with neither directory
 * present is a monolith and fails.
 *
 * WHAT THIS GATE DOES NOT CLAIM. It is not an activation or token argument.
 * The host loads SKILL.md whole on trigger, and whether it then follows a
 * pointer into `tasks/` is host behaviour nothing in this tree observes — so
 * "splitting saves tokens on trigger" is unmeasurable here and is not asserted.
 * ADR-202's lesson binds: an activation claim goes behind a measured instrument
 * or it is not made. The defensible claim is narrower and sufficient: the cap
 * was already the repo's position, and now a new skill cannot quietly ignore it.
 *
 * GRANDFATHERING is a shrink-only ratchet. GRANDFATHERED below is seeded with
 * the measured offender set. Entries may be REMOVED when a skill is
 * restructured or drops under the cap; adding one is the move this gate exists
 * to prevent, and the diff makes any addition visible in review. The list is an
 * inline constant rather than a JSON baseline on purpose — a baseline file
 * grows without anyone reading it, and this one should be read every time.
 *
 * Usage:
 *     ./scripts-run src/scripts/lint_skill_router_head
 *     ./scripts-run src/scripts/lint_skill_router_head --quiet
 *
 * Exit codes: 0 = clean · 2 = any finding OR usage error.
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

/** The K6 cap, in lines. Mirrors src/agent-src/templates/skill.md § K6. */
export const MAX_HEAD_LINES = 400;

/** Directories a router head may route into. `references/` is the established
 *  convention (9 skills use it today); `tasks/` is permitted by the contract
 *  for per-mode procedure bodies. */
export const MODE_BODY_DIRS: readonly string[] = ['tasks', 'references'];

/**
 * Shrink-only allowlist — skills already over the cap when the gate landed.
 * Measured, not guessed. REMOVE entries as skills are restructured; never add.
 */
export const GRANDFATHERED: readonly string[] = [
    // Emptied 2026-08-20: all four seeded entries were restructured into router
    // heads (entry head + `references/` mode bodies) under the published K6 cap.
    // Shrink-only means this list may never grow again — a new oversized
    // monolith fails the gate instead of joining it.
];

export interface Finding {
    readonly skill: string;
    readonly lines: number;
    readonly message: string;
}

/** Count lines the way `wc -l` does, so the gate and a shell check agree. */
export function countLines(text: string): number {
    if (text.length === 0) return 0;
    const n = text.split('\n').length;
    return text.endsWith('\n') ? n - 1 : n;
}

/** Does this skill folder carry at least one mode-body directory? */
export function hasModeBodies(skillDir: string, dirs: readonly string[] = MODE_BODY_DIRS): boolean {
    return dirs.some((d) => {
        try {
            return fs.statSync(path.join(skillDir, d)).isDirectory();
        } catch {
            return false;
        }
    });
}

export interface SkillHead {
    readonly name: string;
    readonly lines: number;
    readonly hasBodies: boolean;
}

/** Read every `<skillsRoot>/<name>/SKILL.md`. */
export function collectSkillHeads(skillsRoot: string): SkillHead[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(skillsRoot, { withFileTypes: true });
    } catch {
        return [];
    }
    const heads: SkillHead[] = [];
    for (const e of entries) {
        if (!e.isDirectory()) continue;
        const dir = path.join(skillsRoot, e.name);
        const head = path.join(dir, 'SKILL.md');
        let text: string;
        try {
            text = fs.readFileSync(head, 'utf-8');
        } catch {
            continue;
        }
        heads.push({ name: e.name, lines: countLines(text), hasBodies: hasModeBodies(dir) });
    }
    return heads.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * A head fails when it is over the cap, carries no mode-body directory, and is
 * not grandfathered. Two separate results are reported so the caller can
 * distinguish a live violation from allowlist drift.
 */
export function evaluate(
    heads: readonly SkillHead[],
    grandfathered: readonly string[] = GRANDFATHERED,
    max: number = MAX_HEAD_LINES,
): { readonly findings: Finding[]; readonly staleAllowlist: string[] } {
    const allow = new Set(grandfathered);
    const findings: Finding[] = [];
    const stillOver = new Set<string>();

    for (const h of heads) {
        if (h.lines <= max) continue;
        stillOver.add(h.name);
        if (allow.has(h.name)) continue;
        if (h.hasBodies) continue;
        findings.push({
            skill: h.name,
            lines: h.lines,
            message:
                `SKILL.md is ${h.lines} lines (cap ${max}) with no ${MODE_BODY_DIRS.map((d) => `${d}/`).join(' or ')} ` +
                'directory — over the cap a skill restructures as a router head (entry head + one file per mode), ' +
                'per templates/skill.md § The router-head contract. The allowlist is shrink-only and does not accept new entries.',
        });
    }

    // An allowlist entry for a skill that no longer exceeds the cap (or no
    // longer exists) is the ratchet failing to tighten: the entry silently
    // buys nothing and would re-permit a regression. Reported, not fatal —
    // removing it is a one-line follow-up, not a reason to red the build.
    const staleAllowlist = grandfathered.filter((g) => !stillOver.has(g));

    return { findings, staleAllowlist };
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

class ExitCode extends Error {
    readonly code: number;
    constructor(code: number) {
        super(`exit ${code}`);
        this.code = code;
    }
}

function parseArgs(argv: string[]): { readonly quiet: boolean } {
    let quiet = false;
    for (const a of argv) {
        if (a === '--quiet') {
            quiet = true;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write('usage: lint_skill_router_head [--quiet]\n');
            throw new ExitCode(0);
        } else {
            process.stderr.write(`❌  lint_skill_router_head: unrecognized argument: ${a}\n`);
            throw new ExitCode(2);
        }
    }
    return { quiet };
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const args = parseArgs(argv);

    // The scanned root is the scope signal. A moved or renamed src/skills would
    // otherwise produce zero heads and a clean green over nothing at all.
    try {
        assertWatchlistResolves({
            gate: 'lint_skill_router_head',
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

    const heads = collectSkillHeads(path.join(REPO, SKILLS_REL));
    const { findings, staleAllowlist } = evaluate(heads);

    // Per-target completeness accounting. The interesting outcome here is the
    // SKIP: a grandfathered head is over the cap and deliberately unchecked, so
    // without a ledger it was indistinguishable from a head that passed. The
    // allowlist size is already printed, but only the ledger ties each skipped
    // name to the reason it went unchecked.
    const ledger = new GateLedger('lint_skill_router_head');
    ledger.plan(heads.map((h) => h.name));
    const failed = new Set(findings.map((f) => f.skill));
    const allow = new Set(GRANDFATHERED);
    for (const h of heads) {
        if (failed.has(h.name)) {
            ledger.fail(h.name, `${String(h.lines)} lines over the ${String(MAX_HEAD_LINES)}-line cap with no mode bodies`);
        } else if (h.lines > MAX_HEAD_LINES && allow.has(h.name)) {
            ledger.skip(h.name, 'declared_exemption');
        } else {
            ledger.complete(h.name);
        }
    }
    ledger.report();

    for (const s of staleAllowlist) {
        process.stderr.write(
            `⚠️   lint_skill_router_head: '${s}' is grandfathered but no longer over the cap — remove it from GRANDFATHERED so the ratchet keeps its teeth\n`,
        );
    }

    if (findings.length > 0) {
        for (const f of findings) {
            process.stderr.write(`❌  ${SKILLS_REL}/${f.skill}/SKILL.md: ${f.message}\n`);
        }
        process.stderr.write(`❌  lint_skill_router_head: ${findings.length} finding(s)\n`);
        return 2;
    }

    if (!args.quiet) {
        const over = heads.filter((h) => h.lines > MAX_HEAD_LINES).length;
        process.stdout.write(
            `✅  lint_skill_router_head: ${heads.length} skill head(s) scanned · ` +
            `${over} over the ${MAX_HEAD_LINES}-line cap, all grandfathered or routed · ` +
            `allowlist holds ${GRANDFATHERED.length} entry(ies), shrink-only\n`,
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

export { REPO, SKILLS_REL, ExitCode };
