/**
 * Installed Claude Code mods — plugins that ship a hooks module the host loads
 * into its own worker (ADR-302 names the class for AC's own module; a foreign
 * one is bound by nothing, which is why this census exists).
 *
 * A verdict-capable mod on an unmanaged account can override this package's
 * deny rows and PreToolUse refusals, and before this file nothing here could say
 * one was installed.
 *
 * Kept apart from `neighbour_census.ts` on purpose: that module is reachable
 * from the skill ranker on the `user_prompt_submit` path, and this scan reads
 * plugin trees no hook needs. Only `doctor neighbours` calls it.
 *
 * Read-only and static. The module is never run; its source is scanned for the
 * event names and host calls that decide its class. The scan is best-effort — a
 * module that reaches an event through an indirection the text does not show is
 * classed by what the text shows, and the renderer says so.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export type ModCapability = 'verdict-capable' | 'prompt-capable' | 'side-effects' | 'display-only' | 'unreadable';

export interface InstalledMod {
    /** The registry key, `<plugin>@<marketplace>`. */
    id: string;
    capability: ModCapability;
    /** Module paths as the plugin's `hooks.json` lists them. */
    modules: string[];
}

export interface ModCensus {
    registry: 'read' | 'absent' | 'unreadable';
    mods: InstalledMod[];
}

// Strongest first: the first class whose pattern matches wins.
const CLASSES: ReadonlyArray<readonly [ModCapability, RegExp]> = [
    ['verdict-capable', /['"](tool\.check|tool\.call|plugin\.register)['"]/],
    ['prompt-capable', /['"](prompt\.[a-z.]+|session\.append)['"]/],
    ['side-effects', /\$\.(process|http|model)\b|\$\.fs\.write\b/],
];

export function classifyModuleSource(source: string): ModCapability {
    for (const [capability, pattern] of CLASSES) {
        if (pattern.test(source)) return capability;
    }
    return 'display-only';
}

function readJson(p: string): unknown {
    try {
        return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {
        return undefined;
    }
}

function rank(c: ModCapability): number {
    const i = CLASSES.findIndex(([k]) => k === c);
    return c === 'unreadable' ? -1 : i === -1 ? CLASSES.length : i;
}

/**
 * Where a plugin's hooks config lives, and the directory its module paths are
 * relative to. The manifest's `hooks` field wins — a path, or the config inline,
 * as this package's own module uses — and `hooks/hooks.json` is the default.
 */
function hooksConfig(installPath: string): { config: unknown; base: string } {
    const manifest = readJson(path.join(installPath, '.claude-plugin', 'plugin.json')) as
        | { hooks?: unknown }
        | undefined;
    const declared = manifest?.hooks;
    if (typeof declared === 'string') {
        const file = path.resolve(installPath, declared);
        return { config: readJson(file), base: path.dirname(file) };
    }
    if (declared !== null && typeof declared === 'object') return { config: declared, base: installPath };
    const file = path.join(installPath, 'hooks', 'hooks.json');
    return { config: readJson(file), base: path.dirname(file) };
}

function modFor(id: string, installPath: string): InstalledMod | null {
    const { config, base } = hooksConfig(installPath);
    const modules = (config as { modules?: unknown } | undefined)?.modules;
    if (!Array.isArray(modules) || modules.length === 0) return null;
    const rels = modules.filter((m): m is string => typeof m === 'string');
    let capability: ModCapability | null = null;
    for (const rel of rels) {
        let source: string;
        try {
            source = fs.readFileSync(path.resolve(base, rel), 'utf-8');
        } catch {
            return { id, capability: 'unreadable', modules: rels };
        }
        const c = classifyModuleSource(source);
        if (capability === null || rank(c) < rank(capability)) capability = c;
    }
    return { id, capability: capability ?? 'unreadable', modules: rels };
}

/** Read the host's plugin registry under `home` and class every installed mod. */
export function installedMods(home: string): ModCensus {
    const registryPath = path.join(home, '.claude', 'plugins', 'installed_plugins.json');
    if (!fs.existsSync(registryPath)) return { registry: 'absent', mods: [] };
    const registry = readJson(registryPath) as { plugins?: unknown } | undefined;
    const plugins = registry?.plugins;
    if (plugins === null || typeof plugins !== 'object' || Array.isArray(plugins)) {
        return { registry: 'unreadable', mods: [] };
    }
    const mods: InstalledMod[] = [];
    for (const [id, installs] of Object.entries(plugins as Record<string, unknown>)) {
        if (!Array.isArray(installs)) continue;
        for (const install of installs) {
            const installPath = (install as { installPath?: unknown } | null)?.installPath;
            if (typeof installPath !== 'string') continue;
            const mod = modFor(id, installPath);
            if (mod !== null) mods.push(mod);
        }
    }
    mods.sort((a, b) => a.id.localeCompare(b.id));
    return { registry: 'read', mods };
}

/**
 * The context fill as text — the same file and figure the shipped module shows,
 * so the value is reachable on every host (ADR-302 condition I5). Null when the
 * file is absent or carries a schema this reader does not know.
 */
export function contextFillLine(projectRoot: string): string | null {
    const fill = readJson(path.join(projectRoot, 'agents', 'runtime', 'state', 'context-fill.json')) as
        | { schema_version?: unknown; final_context_tokens?: unknown; recycle_threshold_tokens?: unknown }
        | undefined;
    if (fill?.schema_version !== 1) return null;
    const tokens = fill.final_context_tokens;
    const threshold = fill.recycle_threshold_tokens;
    if (typeof tokens !== 'number' || typeof threshold !== 'number' || threshold <= 0) return null;
    return `  context fill: ${Math.round((tokens / threshold) * 100)}% of recycle threshold (${tokens} / ${threshold} tokens, last stop)`;
}

/** The opt-in command for this package's own read-only module (ADR-302). */
export const OWN_MOD_OPT_IN =
    'claude plugin marketplace add ~/.event4u/agent-config/runtime/current/src/templates/claude-mod';

export function renderMods(c: ModCensus): string[] {
    if (c.registry === 'unreadable') {
        return ['', '  claude code mods: the host plugin registry could not be read; none listed'];
    }
    if (c.mods.length === 0) return [];
    const out = ['', `  claude code mods (${c.mods.length})`];
    for (const m of c.mods) out.push(`      ${m.id}  ${m.capability}`);
    out.push(
        '      A verdict-capable mod can override this package\'s refusals on an unmanaged account,',
        '      and the host decides load order. Classes come from a static source scan (best-effort).',
        `      This package's own read-only module is opt-in: ${OWN_MOD_OPT_IN}`,
    );
    return out;
}
