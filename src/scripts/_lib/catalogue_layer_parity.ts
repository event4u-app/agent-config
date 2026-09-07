/**
 * Do the two lists that name `~/.claude/<family>` agree?
 *
 * **The defect this exists to make visible.**
 *
 * Two independently authored constants name the SAME directories and, until
 * 2026-09-07, referenced each other nowhere:
 *
 *   - the DELIVERY side — `claudeLayerCarriage.CLAUDE_ARTEFACT_DIRS` and
 *     `hostLayerFingerprint.hostLayerInputs` — which decides what the project
 *     layer withholds because the host layer already carries it;
 *   - the READER side — `skill_catalogue.DEFAULT_CATALOGUE_ROOTS` — which
 *     decides which trees the skill ranker sees.
 *
 * `git grep` over the dependency sets of both returned two disjoint sets. So
 * `~/.claude/skills` was a directory the delivery side treated as authoritative
 * and the reader side did not read AT ALL — for as long as both existed, and
 * with nothing anywhere that could notice.
 *
 * The cost was measured on 2026-09-07: the reader resolved ONE root and stopped,
 * so `suggest_skill_for_task` and the `skill-route` concern ranked whichever
 * single tree came first and reported it as if it were the catalogue. A consumer
 * whose project carries its own skills while the shipped set sits in
 * `~/.claude/skills` got an answer over half its catalogue, with no signal that
 * it was half.
 *
 * **Why a comparison and not an instruction.**
 *
 * The reasoning failure behind it — repairing a mechanism's PARAMETER while
 * inheriting its SHAPE — is model-carried and nothing can observe it. But the
 * RESULT is two lists of strings, and two lists of strings can be compared. This
 * module is that comparison, so the omission stops being a thing someone has to
 * notice and becomes a thing that reds.
 *
 * **What it does NOT claim.**
 *
 * It compares the directories the two sides NAME. It does not establish that a
 * reader ranks well, that a family needs a reader, or that the host actually
 * loads any of it. A family with no reader is legal and common — it just has to
 * SAY so, which is what {@link FAMILIES_WITHOUT_READER} is for.
 */

import { CLAUDE_ARTEFACT_DIRS, type ClaudeArtefactFamily } from '../../install/claudeLayerCarriage.js';
import { hostLayerInputs } from '../../install/hostLayerFingerprint.js';
import {
    DEFAULT_CATALOGUE_ROOTS,
    HOST_CATALOGUE_ROOT,
    PROJECT_CATALOGUE_ROOTS,
} from './skill_catalogue.js';

/**
 * Families the delivery side knows and NO reader resolves — each with the reason.
 *
 * An entry here is a declaration, not a suppression: a family absent from both
 * this map and the reader coverage below is the omission this module reds on.
 * Adding a reader later means deleting one line here.
 */
export const FAMILIES_WITHOUT_READER: Readonly<Partial<Record<ClaudeArtefactFamily, string>>> = {
    personas: 'personas are selected by name from a catalog, never ranked over a tree',
    commands: 'commands reach the host by path; no ranker reads the commands tree',
};

/** Family → the project- and host-relative roots a reader must cover. */
const READER_COVERAGE: Readonly<Partial<Record<ClaudeArtefactFamily, () => string[]>>> = {
    skills: () => [...PROJECT_CATALOGUE_ROOTS, `~/${HOST_CATALOGUE_ROOT}`],
};

/** One disagreement between the two sides. */
export interface ParityFinding {
    readonly family: string;
    readonly reason: string;
}

/**
 * Every disagreement, or an empty array.
 *
 * Total function, no I/O: it reads constants, so the verdict is the same on every
 * machine — which is the point. The reader lists are injectable so the polarity
 * of each branch is testable without editing a production constant.
 */
export function catalogueLayerParity(
    deliveryDirs: Readonly<Record<string, string>> = CLAUDE_ARTEFACT_DIRS,
    coverage: Readonly<Record<string, () => string[]>> = READER_COVERAGE as Readonly<
        Record<string, () => string[]>
    >,
    withoutReader: Readonly<Record<string, string>> = FAMILIES_WITHOUT_READER as Readonly<
        Record<string, string>
    >,
): ParityFinding[] {
    const findings: ParityFinding[] = [];
    for (const [family, projectDir] of Object.entries(deliveryDirs)) {
        const cover = coverage[family];
        if (cover === undefined) {
            if (withoutReader[family] === undefined) {
                findings.push({
                    family,
                    reason:
                        `the delivery side treats \`${projectDir}\` as an artefact source, but no ` +
                        'reader covers it and no reason is declared in FAMILIES_WITHOUT_READER',
                });
            }
            continue;
        }
        const roots = cover();
        // The PROJECT-relative directory the delivery side names must be a root.
        if (!roots.includes(projectDir)) {
            findings.push({
                family,
                reason: `the reader does not read \`${projectDir}\`, which the delivery side names`,
            });
        }
        // And so must the HOST-relative twin — the leg that was missing entirely.
        const hostForm = `~/${projectDir.replace(/^\.claude\//u, '.claude/')}`;
        if (!roots.includes(hostForm)) {
            findings.push({
                family,
                reason: `the reader does not read \`${hostForm}\`, the host layer the partition withholds against`,
            });
        }
    }
    return findings;
}

/**
 * The three constants that must name the same `~/.claude/skills`.
 *
 * `hostLayerInputs` is the third author of that path — the fingerprint side —
 * and it is included because a rename there would silently un-verify the layer
 * the reader reads. Returns the resolved absolute paths for one home so a caller
 * can compare them directly.
 */
export function hostSkillsDirTriple(home: string): {
    readonly fingerprint: string | null;
    readonly delivery: string;
    readonly reader: string;
} {
    const fp = hostLayerInputs(home).find((l) => l.label === 'skills');
    return {
        fingerprint: fp?.root ?? null,
        delivery: `${home}/${CLAUDE_ARTEFACT_DIRS.skills}`,
        reader: `${home}/${HOST_CATALOGUE_ROOT}`,
    };
}

/** For the test's own message, and to prove the list is read rather than assumed. */
export const READER_ROOT_LABELS: readonly string[] = [...DEFAULT_CATALOGUE_ROOTS];
