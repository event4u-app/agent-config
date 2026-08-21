/**
 * The overlap notice `task generate-tools` prints after writing the project layer.
 *
 * Extracted from `condense.ts` rather than left inline: it added exactly 60 lines
 * there and `check_source_size_budget` is a **shrink-only** ratchet, so the legal
 * repair is extraction and never a re-pinned baseline. It also belongs here on its
 * own terms — the notice is about the RELATIONSHIP between two host layers, not
 * about condensation.
 *
 * WHY THE NOTICE EXISTS. `generate-tools` writes ONE of the two layers Claude Code
 * loads and was silent about the other existing, while the installer's overlap gate
 * runs at install time and cannot see a layer written afterwards. So the overlap is
 * created by whichever producer runs LAST, and neither said so. Measured 2026-08-19
 * on a freshly regenerated maintainer projection: 110 rules delivered twice, plus
 * 290 skills and 40 commands sharing a name across layers of different payload
 * shape. Invariant: ADR-236. Full census:
 * `agents/evidence/analysis/single-delivery-partition-census.md`.
 *
 * ADVISORY, NEVER FAILING. `generate-tools` is the normal build step. Failing it on
 * a topology the operator may not be able to change today would make the build
 * unusable rather than the duplication visible. The check that can refuse is
 * `check_single_delivery --enforce`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Artefact types both host layers can carry.
 *
 * All five, matching `check_single_delivery` (R2 finding): this notice read three
 * where the gate reads four, so a subagent duplicated across layers was invisible
 * on one surface and reported on the other — two surfaces disagreeing about the
 * same question is worse than one surface being silent.
 *
 * `personas` was added 2026-08-21. Both lists had read four types while the
 * installer's `_CLAUDE_SKILL_BUNDLE` (`install.ts:1916-1921`) ships
 * rules · skills · commands · **personas** — so the one family this repository
 * actually delivered from both layers was the one neither surface looked at
 * (29 shared names on a freshly regenerated tree). The two lists stay
 * hand-written and independent of the installer's on purpose: deriving the
 * verifier's scope from the producer would make the check inherit the producer's
 * omissions, which is the defect being closed here.
 */
const TYPES = ['rules', 'skills', 'commands', 'personas', 'user-types', 'agents'] as const;

/**
 * Count shared entry names per artefact type between the two layers.
 *
 * A type whose layers are not both readable is SKIPPED rather than reported as
 * zero: one layer absent means nothing is doubled there, and that is the topology
 * this notice wants, so a warning would be noise on the success case.
 */
export function overlapFindings(homeDir: string, projectRoot: string): string[] {
    const findings: string[] = [];
    for (const type of TYPES) {
        let g: string[];
        let p: string[];
        try {
            g = fs.readdirSync(path.join(homeDir, '.claude', type));
            p = fs.readdirSync(path.join(projectRoot, '.claude', type));
        } catch {
            continue;
        }
        const gset = new Set(g);
        const both = p.filter((n) => gset.has(n)).length;
        if (both > 0) findings.push(`${type}=${both}`);
    }
    return findings;
}

/** Render the notice, or `null` when there is nothing to say. */
export function overlapNotice(homeDir: string, projectRoot: string): string | null {
    const findings = overlapFindings(homeDir, projectRoot);
    if (findings.length === 0) return null;
    return (
        `  ⚠️  a global layer holds the same names (${findings.join(' ')}) — the host loads both` +
        ' with no dedup, so these are delivered twice per session.' +
        '\n      Detail: ./scripts-run src/scripts/check_single_delivery · invariant: ADR-236'
    );
}

/**
 * Print the notice through the caller's own writer.
 *
 * The writer is injected so this stays testable and so it uses `condense.ts`'s
 * summary channel rather than reaching for `process.stdout` behind its back.
 */
export function warnLayerOverlap(projectRoot: string, write: (s: string) => void): void {
    const home = process.env['HOME'];
    if (home === undefined || home === '') return;
    const notice = overlapNotice(home, projectRoot);
    if (notice !== null) write(notice);
}
