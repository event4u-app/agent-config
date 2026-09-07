/**
 * Does the CLAUDE host-global layer already carry a given artefact?
 *
 * **Why this module exists — the veto it replaces.**
 *
 * ADR-236 partitions artefacts between `~/.claude/**` and `<repo>/.claude/**`.
 * Its first implementation asked ONE question for the whole run: does
 * `installed.lock` record the same version as this checkout, and does a content
 * fingerprint of the host layer still match what the installer stamped? Any
 * answer but yes fell back to the full projection.
 *
 * That veto is repo-wide, and it fires on facts that have nothing to do with any
 * individual artefact. Measured 2026-09-07 on the maintainer machine, `installed.lock`
 * at 14.19.0 against a 14.21.0 checkout:
 *
 * ```
 *   rules     global 104 · project  15 · BOTH   0     ← already correct
 *   skills    global 307 · project 414 · BOTH 261     ← the veto's cost
 *   personas  global  32 · project  29 · BOTH  29
 *   commands  global  94 · project   0 · BOTH   0
 * ```
 *
 * The rules row is correct because rules are partitioned by
 * {@link hostLayerCarries} — per host directory, on that directory's own
 * contents — while skills, personas and commands hung off the version veto and
 * were therefore delivered twice, in every session, for as long as the install
 * lagged a release. A version number is not evidence about an artefact.
 *
 * This module supplies the evidence the other three families were missing, in
 * the shape rules already use: read the host directory, and answer per NAME.
 *
 * **Why per-name rather than per-family.**
 *
 * A partition is a removal and has no repair path — withholding a name the
 * surviving layer does not hold deletes it from every session. Asking per name
 * makes the fail-safe granular: an artefact the host layer lacks stays in the
 * project layer on its own, and one absent name no longer keeps 300 duplicates
 * alive with it. That is the property the repo-wide veto could not express.
 *
 * **Honest limits.**
 *
 * Presence of a NAME, never equality of CONTENT — and never PROVENANCE either.
 * Two consequences, the second added 2026-09-07 after a neutral review named it.
 *
 * **Staleness.** A stale `~/.claude/skills/foo` satisfies this check, so an
 * install that lags a release delivers that release's older copy of `foo` rather
 * than two copies. That is the trade the
 * owner chose on 2026-09-07, stated rather than implied: the remedy for a stale
 * global layer is `agent-config install`, and {@link verifyHostLayer} still
 * reports the staleness so a run says so out loud.
 *
 * **Shared namespace.** `~/.claude/skills` is not this package's directory. On
 * the machine this was written, 307 entries = 299 package skills + 8 Cloudflare
 * PLUGIN skills. No name collides today, but the mechanism needs no collision to
 * be real: a plugin — or a hand-made `~/.claude/skills/<name>` — whose name
 * matches a package skill makes this function withhold the package's project-layer
 * copy, and the session then loads the foreign body under the package's skill
 * name. The withhold is a removal with no repair path, which is what makes it
 * worth naming rather than filing.
 *
 * **A NEIGHBOURING defect that WAS fixed, 2026-09-07.** This paragraph claimed
 * "the skill is still delivered, under the right name, from one layer" — and that
 * was false while `_readLayer` returned every directory name without checking
 * that `SKILL.md` resolved: an empty `~/.claude/skills/<name>/` withheld the
 * project copy and the artefact came from neither layer. A name now counts as
 * carried only when the artefact behind it resolves, so the sentence above is
 * true as written.
 *
 * NOT FIXED here, deliberately: distinguishing a package artefact from a foreign
 * one needs a provenance marker the installer does not write today, and inventing
 * one in this module would be a guess dressed as a check. What IS true is that
 * the failure is loud in the direction that matters — the skill is still
 * delivered, under the right name, from one layer — and silent only about whose
 * body it is.
 *
 * Contract, same as its siblings in this directory: no `process.exit`, no CLI
 * entry, node builtins only — it ships inside the consumer installer bundle.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import type { CarriesVerdict } from './globalRuleLayers.js';

/**
 * The artefact families whose project-layer copy is decided here.
 *
 * `rules` is deliberately ABSENT. Rules project to five host directories and are
 * already partitioned per directory by {@link globalRuleLayers.hostLayerCarries};
 * adding a claude-only row for them would put a second decision on the one
 * family that does not need it. Skills, personas and the colon-form commands
 * project to `.claude/` alone, which is why one host is the whole answer for them.
 */
export type ClaudeArtefactFamily = 'skills' | 'personas' | 'commands';

/** Family → its directory under the user's home. */
export const CLAUDE_ARTEFACT_DIRS: Readonly<Record<ClaudeArtefactFamily, string>> = {
    skills: '.claude/skills',
    personas: '.claude/personas',
    commands: '.claude/commands',
};

const _defaultHome = (): string => process.env['HOME'] ?? os.homedir();

/**
 * One directory read per (family, home) per process.
 *
 * The generators ask per NAME — hundreds of times for skills, ~90 for commands —
 * and the `commands` read walks a tree. Without the memo the per-name grain that
 * makes the fail-safe granular would also make it quadratic. `null` is memoised
 * too: an unreadable layer stays unreadable for the run, and re-probing it once
 * per name would answer the same thing 300 times.
 */
const _memo = new Map<string, ReadonlySet<string> | null>();

/** Test seam — drop the memo so one process can read a layer it just changed. */
export function _resetClaudeLayerMemoForTest(): void {
    _memo.clear();
}

/** Absolute path to the host-global directory for one family. */
export function claudeLayerPath(family: ClaudeArtefactFamily, home: string = _defaultHome()): string {
    return path.join(home, CLAUDE_ARTEFACT_DIRS[family]);
}

/**
 * The names the host layer holds for one family, or null when it cannot be read.
 *
 * Null is a real answer and every caller must read it as "no evidence, withhold
 * nothing" — not as an empty layer, which would authorise withholding everything.
 *
 * The name shape is the family's own, because that is what the caller compares
 * against: a skill is a directory basename (`design-tokens`), a persona a
 * filename (`ai-agent.md`), and a command a posix path relative to the commands
 * root (`roadmap/process-full.md` for the colon form, `agent-status.md` for a
 * flat one). `commands` therefore walks; the other two list one level.
 */
export function claudeLayerNames(
    family: ClaudeArtefactFamily,
    home: string = _defaultHome(),
): ReadonlySet<string> | null {
    const dir = claudeLayerPath(family, home);
    const key = `${family}\u0000${dir}`;
    const hit = _memo.get(key);
    if (hit !== undefined) {
        return hit;
    }
    const answer = _readLayer(family, dir);
    _memo.set(key, answer);
    return answer;
}

function _readLayer(family: ClaudeArtefactFamily, dir: string): ReadonlySet<string> | null {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return null;
    }
    if (family !== 'commands') {
        // A name is only CARRIED when the artefact behind it resolves. Corrected
        // 2026-09-07 after a second neutral review: this returned every dirent
        // name, so an empty `~/.claude/skills/<name>/` — no `SKILL.md` — made
        // `claudeLayerHolds` true, the project layer withheld its copy, and the
        // artefact was then delivered from NEITHER layer. That is the
        // removal-with-no-repair-path this module's own limits section says it
        // avoids, and the first fixture written for the wrapper gate created
        // exactly that state and called the withhold correct.
        //
        // Reachable without a crash: a skill directory holding some other file
        // survives `reap_stale`, and `install.ts` mkdirs before it writes.
        // `readProjectedCatalogue` already keys on `SKILL.md` for this reason;
        // the `commands` branch below already required a real `.md`. This is the
        // same requirement for the two families that lacked it.
        const carries = (name: string): boolean => {
            const abs = path.join(dir, name);
            try {
                if (fs.statSync(abs).isDirectory()) {
                    return fs.statSync(path.join(abs, 'SKILL.md')).isFile();
                }
                return name.endsWith('.md');
            } catch {
                return false;
            }
        };
        return new Set(
            entries
                .map((e) => e.name)
                .filter((n) => n !== 'README.md')
                .filter(carries),
        );
    }
    const out = new Set<string>();
    const walk = (abs: string, rel: string): void => {
        let kids: fs.Dirent[];
        try {
            kids = fs.readdirSync(abs, { withFileTypes: true });
        } catch {
            return;
        }
        for (const k of kids) {
            const childRel = rel === '' ? k.name : `${rel}/${k.name}`;
            if (k.isDirectory()) {
                walk(path.join(abs, k.name), childRel);
            } else if (k.name.endsWith('.md') && k.name !== 'README.md') {
                out.add(childRel);
            }
        }
    };
    walk(dir, '');
    return out;
}

/**
 * Does the host layer hold this one name?
 *
 * The single-name form of {@link keepInProjectLayer}, for a caller that decides
 * inside a loop and already knows the host-side name. `false` on an unreadable
 * layer — no evidence, so nothing is withheld.
 */
export function claudeLayerHolds(
    family: ClaudeArtefactFamily,
    name: string,
    home: string = _defaultHome(),
): boolean {
    return claudeLayerNames(family, home)?.has(name) ?? false;
}

/**
 * Which of `names` the host layer carries, and which it does not.
 *
 * `carries` is the all-or-nothing answer the rules path reports; `missing` is the
 * one callers act on, because withholding is decided per name. An empty `names`
 * is vacuously carried — withholding nothing needs no evidence.
 */
export function claudeLayerCarries(
    family: ClaudeArtefactFamily,
    names: readonly string[],
    home: string = _defaultHome(),
): CarriesVerdict {
    const layerPath = claudeLayerPath(family, home);
    const have = claudeLayerNames(family, home);
    if (have === null) {
        return { carries: false, layerPath, missing: [...names], reason: 'layer-absent' };
    }
    const missing = names.filter((n) => !have.has(n));
    return {
        carries: missing.length === 0,
        layerPath,
        missing,
        reason: missing.length === 0 ? 'carries' : 'missing-names',
    };
}

/**
 * The subset of `names` the project layer must still deliver.
 *
 * The one function the generators call. Returns the names the host layer does
 * NOT hold, in the order given — so an unreadable layer returns everything
 * (fail safe) and a complete layer returns nothing.
 */
export function keepInProjectLayer(
    family: ClaudeArtefactFamily,
    names: readonly string[],
    home: string = _defaultHome(),
): string[] {
    const have = claudeLayerNames(family, home);
    if (have === null) {
        return [...names];
    }
    return names.filter((n) => !have.has(n));
}
