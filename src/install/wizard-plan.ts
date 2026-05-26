/**
 * Wizard-state → {@link PlanSource}[] translator — Phase B2.
 *
 * The Preact wizard collects high-level identifiers (tool IDs like
 * `cursor` / `augment`, capability-pack IDs like `founder-mvp`) and is
 * deliberately ignorant of filesystem layout. This module is the
 * server-side bridge that expands those IDs into the low-level
 * `(srcDir, destDir, toolId, kind)` tuples consumed by
 * {@link buildInstallPlan}.
 *
 * Mirrors the canonical mapping tables in
 * `scripts/install.py:2029-2222`:
 *   - {@link USER_SCOPE_PATHS}     ← `USER_SCOPE_PATHS`
 *   - {@link GLOBAL_DEPLOY_SOURCES} ← `_CLAUDE_SKILL_BUNDLE` + `GLOBAL_DEPLOY_SOURCES`
 *
 * Packs are intentionally NOT in this table: they are settings overlays
 * (`packs/*.yml`), not file deployments. The 2PC settings write owns
 * pack activation; the install plan only carries tool content.
 */

import { homedir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';

import type { ConflictPolicy, InstallPlan, InstallTarget } from './types.js';
import { buildInstallPlan, type PlanSource } from './plan.js';

/**
 * Per-tool user-scope anchor directory, mirrored 1:1 from
 * `scripts/install.py:USER_SCOPE_PATHS`. Values may use `~` for the
 * user's home directory; {@link expandAnchor} resolves it server-side.
 *
 * Tools without a user-scope directory convention (e.g. `claude-desktop`
 * which writes a single marker file, or `aider` which writes a single
 * YAML file) are still listed so the wizard's bridge logic in Phase A6
 * can resolve them via {@link expandAnchor} when needed.
 */
export const USER_SCOPE_PATHS: Readonly<Record<string, string>> = {
    'claude-code':    '~/.claude/',
    'claude-desktop': '~/Library/Application Support/Claude/',
    cursor:           '~/.cursor/',
    windsurf:         '~/.codeium/windsurf/',
    cline:            '~/Documents/Cline/Rules/',
    'gemini-cli':     '~/.gemini/',
    copilot:          '~/.copilot/',
    augment:          '~/.augment/',
    aider:            '~/.aider.conf.yml',
    codex:            '~/.codex/',
    roocode:          '~/.roo/',
    continue:         '~/.continue/',
    kilocode:         '~/.kilocode/',
    zed:              '~/.config/zed/',
    jetbrains:        '~/.config/JetBrains/',
    kiro:             '~/.kiro/',
    qoder:            '~/.qoder/',
    opencode:         '~/.opencode/',
    trae:             '~/.trae/',
    antigravity:      '~/.agents/',
    codebuddy:        '~/.codebuddy/',
    droid:            '~/.factory/',
    warp:             '~/.warp/',
};

/**
 * Universal Anthropic-shaped skill bundle deployed to markdown-skills
 * tools. Mirrors `_CLAUDE_SKILL_BUNDLE` in `scripts/install.py`.
 */
const CLAUDE_SKILL_BUNDLE: ReadonlyArray<readonly [string, string]> = [
    ['.agent-src/rules',    'rules'],
    ['.agent-src/skills',   'skills'],
    ['.agent-src/personas', 'personas'],
];

/**
 * Per-tool content deployment plan for `--global` installs. Each entry
 * is a list of `(packageSrcRelative, destSubpath)` pairs.
 *
 * `packageSrcRelative` resolves against the agent-config package root;
 * `destSubpath` is appended to `USER_SCOPE_PATHS[toolId]` (expanded).
 *
 * Mirrors `GLOBAL_DEPLOY_SOURCES` in `scripts/install.py:2178-2222`.
 * Tools absent from this map have no deployable content in global scope
 * — they either follow a marker-only convention (handled by bridges in
 * Phase A6) or have no markdown convention at all.
 */
export const GLOBAL_DEPLOY_SOURCES: Readonly<Record<string, ReadonlyArray<readonly [string, string]>>> = {
    'claude-code': CLAUDE_SKILL_BUNDLE,
    augment: [
        ['.agent-src/rules',     'rules'],
        ['.agent-src/skills',    'skills'],
        ['.agent-src/commands',  'commands'],
        ['.agent-src/contexts',  'contexts'],
        ['.agent-src/personas',  'personas'],
        ['.agent-src/templates', 'templates'],
    ],
    cursor: [
        ['.agent-src/rules',    'rules'],
        ['.agent-src/commands', 'commands'],
        ['.agent-src/personas', 'personas'],
    ],
    windsurf: [
        ['.agent-src/rules', 'rules'],
    ],
    cline: [
        ['.agent-src/rules', ''],
    ],
    'gemini-cli': CLAUDE_SKILL_BUNDLE,
    codex:        CLAUDE_SKILL_BUNDLE,
    continue:     CLAUDE_SKILL_BUNDLE,
    roocode:      CLAUDE_SKILL_BUNDLE,
    kilocode:     CLAUDE_SKILL_BUNDLE,
    qoder:        CLAUDE_SKILL_BUNDLE,
    opencode:     CLAUDE_SKILL_BUNDLE,
    trae:         CLAUDE_SKILL_BUNDLE,
    antigravity:  CLAUDE_SKILL_BUNDLE,
    codebuddy:    CLAUDE_SKILL_BUNDLE,
    droid:        CLAUDE_SKILL_BUNDLE,
    warp:         CLAUDE_SKILL_BUNDLE,
    kiro: [
        ['.agent-src/rules',    'rules'],
        ['.agent-src/skills',   'steering'],
        ['.agent-src/personas', 'personas'],
    ],
};

/**
 * Resolve a `~/...` anchor against the user's home directory.
 *
 * Absolute paths (no `~` prefix) pass through unchanged. Empty string
 * returns the home directory itself. Mirrors Python's `os.path.expanduser`.
 */
export function expandAnchor(anchor: string, home?: string): string {
    const h = home ?? homedir();
    if (anchor === '~') return h;
    if (anchor.startsWith('~/')) return join(h, anchor.slice(2));
    if (isAbsolute(anchor)) return anchor;
    return resolve(anchor);
}

/** Inputs to {@link expandWizardSources}. */
export interface WizardExpandInputs {
    /** Stable tool IDs selected by the user in the wizard. */
    readonly toolIds: ReadonlyArray<string>;
    /** Absolute path to the agent-config package root (source of `.agent-src/`). */
    readonly packageRoot: string;
    /** Override for the user's home directory (tests only). */
    readonly home?: string;
}

/**
 * Expand the wizard's `toolIds` selection into a flat list of
 * {@link PlanSource} tuples for the global install target.
 *
 * For each tool ID present in {@link GLOBAL_DEPLOY_SOURCES}, emit one
 * `PlanSource` per `(packageSrcRelative, destSubpath)` pair, with:
 *   - `srcDir`  = `packageRoot/packageSrcRelative`
 *   - `destDir` = `expandAnchor(USER_SCOPE_PATHS[toolId])/destSubpath`
 *   - `kind`    = `'deployed'` (we own these bytes)
 *
 * Tool IDs absent from {@link GLOBAL_DEPLOY_SOURCES} contribute zero
 * sources — they are either marker-only (Phase A6 bridges handle them)
 * or have no markdown convention. Unknown tool IDs (not in any map) are
 * silently ignored — the detect/plan layer is the gatekeeper for
 * enable/disable, not this expander.
 */
export function expandWizardSources(inputs: WizardExpandInputs): PlanSource[] {
    const { toolIds, packageRoot, home } = inputs;
    const out: PlanSource[] = [];
    for (const toolId of toolIds) {
        const deploy = GLOBAL_DEPLOY_SOURCES[toolId];
        const anchor = USER_SCOPE_PATHS[toolId];
        if (!deploy || !anchor) continue;
        const destRoot = expandAnchor(anchor, home);
        for (const [srcRel, destSub] of deploy) {
            const srcDir = join(packageRoot, srcRel);
            const destDir = destSub.length === 0 ? destRoot : join(destRoot, destSub);
            out.push({ toolId, srcDir, destDir, kind: 'deployed' });
        }
    }
    return out;
}

/** Inputs to {@link buildPlanFromWizard}. */
export interface WizardPlanInputs extends WizardExpandInputs {
    /** Install target. Wizard always emits `global` today; reserved for future project-scope. */
    readonly target: InstallTarget;
    /** Absolute install root anchor passed through to {@link InstallPlan.root}. */
    readonly root: string;
    /** Conflict policy active for this run. */
    readonly policy: ConflictPolicy;
}

/**
 * Build an {@link InstallPlan} directly from a wizard selection.
 *
 * Thin convenience over {@link expandWizardSources} +
 * {@link buildInstallPlan}. Returns an empty-`filesByTool` plan when
 * the selection contains zero deployable tool IDs — the wizard renders
 * the "nothing to do" screen on that shape.
 */
export function buildPlanFromWizard(inputs: WizardPlanInputs): InstallPlan {
    const sources = expandWizardSources(inputs);
    return buildInstallPlan({
        target: inputs.target,
        root: inputs.root,
        sources,
        policy: inputs.policy,
    });
}
