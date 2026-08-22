/**
 * Where each host's GLOBAL rule layer lives on disk, and whether it carries a
 * given set of rules.
 *
 * ## Why this module exists
 *
 * ADR-236 partitions rules between the global and the project layer: an artefact
 * scoped to this package alone stays project-local, everything else is delivered
 * globally and withheld from the project tree. `partitionEligibility.ts` decides
 * WHETHER the partition is on, by verifying the claude host layer against
 * `installed.lock`. Its own docstring then draws the only conclusion that
 * evidence supports — it "says nothing about `~/.cursor`", so withholding a
 * cursor artefact on the strength of a claude fingerprint "would deliver it
 * nowhere".
 *
 * That reasoning is right and its scope was too narrow for rules. The rule
 * filter sits in `condense.ts::_scoped_rule_basenames()`, which is per-RUN and
 * not per-DIRECTORY, so it already withholds from `.clinerules` on a claude
 * fingerprint — the exact extrapolation the docstring refuses. Measured
 * 2026-08-22 in a freshly generated worktree with the partition active:
 *
 * ```
 * .claude/rules      13 files, 13 package-only,   0 global-only
 * .clinerules        14 files, 13 package-only,   0 global-only
 * .cursor/rules     126 files, 26 package-only, 100 global-only
 * .windsurf/rules   113 files, 13 package-only, 100 global-only
 * .augment/rules    118 files, 15 package-only, 103 global-only
 * ```
 *
 * Two hosts partition on borrowed evidence; three do not partition at all. This
 * module supplies the evidence per host so neither case has to be guessed:
 * {@link globalRuleLayerNames} reads the host's own global directory, and
 * {@link hostLayerCarries} answers the one question a withhold depends on.
 *
 * ## Why the paths are written out rather than imported
 *
 * `USER_SCOPE_PATHS` in `src/scripts/install.ts` is the authority for a host's
 * global scope ROOT, and it is the right authority. It is not imported here for
 * two reasons: `install.ts` is a multi-thousand-line CLI entry point that pulls
 * in the whole installer graph, and a scope root is not a rules path — cline's
 * root already IS its rules directory (`~/Documents/Cline/Rules/`) while every
 * other host appends a subdirectory. So the mapping is stated once here and
 * PINNED against `USER_SCOPE_PATHS` by `tests/install/global_rule_layers.test.ts`,
 * which fails if a root moves. A pinned restatement drifts loudly; an import
 * would have cost the bundle.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/**
 * Tool id → its global rule directory, relative to the user's home.
 *
 * Keys are the ids `USER_SCOPE_PATHS` and `TOOL_SIGNALS` use, so a row here is
 * traceable to the installer's own scope table rather than invented.
 *
 * The five hosts below are the ones that receive a projected rule TREE. A host
 * whose rules arrive as a single concatenated file (`.windsurfrules`,
 * `GEMINI.md`, copilot instructions) has no directory to compare and is
 * deliberately absent: {@link globalRuleLayerPath} returns null for it, which
 * reads as "no evidence" and keeps the full projection.
 */
export const GLOBAL_RULE_DIRS: Readonly<Record<string, string>> = {
    'claude-code': '.claude/rules',
    cursor: '.cursor/rules',
    augment: '.augment/rules',
    // Windsurf's scope root is `~/.codeium/windsurf/`, not `~/.windsurf/`.
    windsurf: '.codeium/windsurf/rules',
    // Cline's scope root IS the rules directory — no `rules/` suffix.
    cline: 'Documents/Cline/Rules',
};

/**
 * Project rule directory → the tool id whose global layer covers it.
 *
 * Five entries, because five directories receive a projected rule TREE. Two are
 * symlink trees (`condense.ts::TOOL_DIRS`); three are written by their own
 * emitters — `generate_cursor_mdc_rules`, `generate_windsurf_modern_rules`, and
 * `project_to_augment`. The `.cursor/rules` row covers both the `.mdc` files and
 * the legacy `.md` symlinks that share that directory.
 *
 * It lives here rather than in either consumer so the gate that reports a
 * duplicate and the emitters that must stop creating one read the same list. A
 * sixth host directory added to one and not the other is exactly how a gate goes
 * green over a tree nobody checks.
 */
export const PROJECT_RULE_DIRS: Readonly<Record<string, string>> = {
    '.claude/rules': 'claude-code',
    '.cursor/rules': 'cursor',
    '.clinerules': 'cline',
    '.windsurf/rules': 'windsurf',
    '.augment/rules': 'augment',
};

/** The tool id whose global layer covers a project rule directory, or null. */
export function toolIdForProjectRuleDir(dir: string): string | null {
    return PROJECT_RULE_DIRS[dir] ?? null;
}

/** Every tool id that has a global rule directory this module can read. */
export function hostsWithGlobalRuleLayer(): readonly string[] {
    return Object.keys(GLOBAL_RULE_DIRS).sort();
}

/**
 * Absolute path to a host's global rule directory, or null when the host has no
 * directory-shaped global layer.
 *
 * Null is a real answer and not an error: it means this module cannot supply
 * evidence for that host, and every caller must read that as "do not withhold".
 */
export function globalRuleLayerPath(
    toolId: string,
    home: string = process.env['HOME'] ?? os.homedir(),
): string | null {
    const rel = GLOBAL_RULE_DIRS[toolId];
    return rel === undefined ? null : path.join(home, rel);
}

/**
 * The rule basenames a host's global layer actually holds, normalised to `.md`.
 *
 * Returns null when the directory does not exist or cannot be read — the
 * absent-tolerant contract Phase 1.1 requires. Normalisation matters because
 * Cursor's tree is `.mdc`: comparing raw filenames would report every rule as
 * missing there and turn the partition off for the one host whose duplication is
 * largest.
 */
export function globalRuleLayerNames(
    toolId: string,
    home: string = process.env['HOME'] ?? os.homedir(),
): readonly string[] | null {
    const dir = globalRuleLayerPath(toolId, home);
    if (dir === null) {
        return null;
    }
    let entries: string[];
    try {
        entries = fs.readdirSync(dir);
    } catch {
        return null;
    }
    return entries
        .filter((f) => f.endsWith('.md') || f.endsWith('.mdc'))
        .map((f) => (f.endsWith('.mdc') ? `${f.slice(0, -4)}.md` : f))
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** What {@link hostLayerCarries} concluded, and on what evidence. */
export interface CarriesVerdict {
    /** True only when every requested name is present in the host's layer. */
    readonly carries: boolean;
    /** Absolute path read, or null when the host has no directory layer. */
    readonly layerPath: string | null;
    /** Names asked for that the layer does not hold. Empty when `carries`. */
    readonly missing: readonly string[];
    /** Why the verdict is what it is — for the caller's own reporting. */
    readonly reason: 'carries' | 'no-layer-for-host' | 'layer-absent' | 'missing-names';
}

/**
 * Does this host's global layer carry every rule that would be withheld from its
 * project directory?
 *
 * This is the property `personaPartition`'s docstring states as the precondition
 * for any withhold — "withholding is only safe once the surviving layer is known
 * to carry what is withheld" — asked per host instead of inferred from claude.
 *
 * Fails safe in all three negative directions: a host with no directory layer, a
 * directory that is absent, and a directory missing even one name all return
 * `carries: false`, so the caller keeps the full projection. An empty
 * `ruleNames` is vacuously carried, which is correct — withholding nothing needs
 * no evidence.
 */
export function hostLayerCarries(
    toolId: string,
    ruleNames: readonly string[],
    home: string = process.env['HOME'] ?? os.homedir(),
): CarriesVerdict {
    const layerPath = globalRuleLayerPath(toolId, home);
    if (layerPath === null) {
        return { carries: false, layerPath: null, missing: [...ruleNames], reason: 'no-layer-for-host' };
    }
    const have = globalRuleLayerNames(toolId, home);
    if (have === null) {
        return { carries: false, layerPath, missing: [...ruleNames], reason: 'layer-absent' };
    }
    const present = new Set(have);
    const missing = ruleNames.filter((n) => !present.has(n));
    return {
        carries: missing.length === 0,
        layerPath,
        missing,
        reason: missing.length === 0 ? 'carries' : 'missing-names',
    };
}
