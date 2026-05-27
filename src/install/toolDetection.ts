/**
 * Native AI-tool presence detection (road-to-wizard-ux-improvements § Phase 2).
 *
 * Distinct from `detectToolPresence` (detect.ts), which checks the *project*
 * for agent-config bridge dirs ("we set up a bridge here"). This module
 * answers "is the AI tool itself installed on this machine?" by probing the
 * user's home dir, well-known app bundles, and `$PATH` — so the wizard's
 * Step-1 list can pre-select detected tools (first run) and show a per-tool
 * installed/not-installed badge.
 *
 * The signal table is intentionally data-driven and best-effort: a tool with
 * no reliable signal (e.g. a VS Code extension) simply reports `false`
 * (badge = not installed, no pre-select) — false negatives are acceptable,
 * false positives are not. Extend `TOOL_SIGNALS` as new tools/signals are
 * learned; that is the single place to maintain (the accepted trade-off).
 */

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';

/** Detection signals for one tool. A tool is "installed" if ANY signal hits. */
interface ToolSignal {
    /** Paths relative to the user's home dir (dir or file). */
    readonly homePaths?: readonly string[];
    /** Absolute paths (e.g. macOS `/Applications/*.app` bundles). */
    readonly absPaths?: readonly string[];
    /** Executable names looked up on `$PATH`. */
    readonly bins?: readonly string[];
}

/**
 * Best-effort signal table keyed by the tool id used in the wizard's
 * `VALID_TOOLS` (src/ui/wizard/state.ts). Keep ids in sync with that list.
 */
const TOOL_SIGNALS: Readonly<Record<string, ToolSignal>> = {
    'claude-code': { bins: ['claude'], homePaths: ['.claude', '.claude.json', '.config/claude'] },
    'claude-desktop': { absPaths: ['/Applications/Claude.app'], homePaths: ['Library/Application Support/Claude', '.config/Claude'] },
    'cursor': { bins: ['cursor'], absPaths: ['/Applications/Cursor.app'], homePaths: ['.cursor'] },
    'windsurf': { bins: ['windsurf'], absPaths: ['/Applications/Windsurf.app'], homePaths: ['.codeium/windsurf'] },
    'cline': { homePaths: ['Documents/Cline'] },
    'gemini-cli': { bins: ['gemini'], homePaths: ['.gemini'] },
    'copilot': { bins: ['copilot'], homePaths: ['.config/github-copilot'] },
    'augment': { bins: ['auggie', 'augment'], homePaths: ['.augment'] },
    'aider': { bins: ['aider'], homePaths: ['.aider.conf.yml'] },
    'codex': { bins: ['codex'], homePaths: ['.codex'] },
    'roocode': {},
    'continue': { homePaths: ['.continue'] },
    'kilocode': {},
    'zed': { bins: ['zed'], absPaths: ['/Applications/Zed.app'], homePaths: ['.config/zed'] },
    'jetbrains': { homePaths: ['Library/Application Support/JetBrains', '.config/JetBrains'] },
    'kiro': { bins: ['kiro'], absPaths: ['/Applications/Kiro.app'], homePaths: ['.kiro'] },
    'qoder': { absPaths: ['/Applications/Qoder.app'], homePaths: ['.qoder'] },
    'opencode': { bins: ['opencode'], homePaths: ['.opencode', '.config/opencode'] },
    'trae': { absPaths: ['/Applications/Trae.app'], homePaths: ['.trae'] },
    'antigravity': { absPaths: ['/Applications/Antigravity.app'], homePaths: ['.antigravity'] },
    'codebuddy': { homePaths: ['.codebuddy'] },
    'droid': { bins: ['droid'], homePaths: ['.factory', '.droid'] },
    'warp': { absPaths: ['/Applications/Warp.app', '/Applications/Warp.app/Contents'], homePaths: ['.warp', '.local/share/warp-terminal'] },
};

export interface DetectToolsOptions {
    /** User home dir (defaults to `os.homedir()`). Injected for tests. */
    readonly home?: string;
    /** `$PATH` value (defaults to `process.env.PATH`). Injected for tests. */
    readonly pathEnv?: string | undefined;
}

/** Tool ids this module knows how to probe (the wizard's full tool set). */
export function knownToolIds(): readonly string[] {
    return Object.keys(TOOL_SIGNALS);
}

/**
 * Is an executable named `name` resolvable on `$PATH`? Exported for one-off
 * presence checks (e.g. `rtk` on the Editor-and-tooling step). Defaults to
 * `process.env.PATH`.
 */
export function isBinaryOnPath(name: string, pathEnv?: string): boolean {
    return binOnPath(name, pathEnv ?? process.env['PATH'] ?? '');
}

function binOnPath(name: string, pathEnv: string): boolean {
    if (pathEnv.length === 0) return false;
    for (const dir of pathEnv.split(delimiter)) {
        if (dir.length === 0) continue;
        if (existsSync(join(dir, name))) return true;
        // Windows-style executables.
        if (existsSync(join(dir, `${name}.exe`)) || existsSync(join(dir, `${name}.cmd`))) return true;
    }
    return false;
}

function isToolInstalled(signal: ToolSignal, home: string, pathEnv: string): boolean {
    for (const rel of signal.homePaths ?? []) {
        if (existsSync(join(home, rel))) return true;
    }
    for (const abs of signal.absPaths ?? []) {
        if (existsSync(abs)) return true;
    }
    for (const bin of signal.bins ?? []) {
        if (binOnPath(bin, pathEnv)) return true;
    }
    return false;
}

/**
 * Probe every known tool and return a `{ <toolId>: installed }` map. Tools
 * with no reliable signal report `false`. Pure w.r.t. injected `home`/`pathEnv`
 * (only reads the filesystem), so it's safe to call per wizard boot.
 */
export function detectInstalledTools(opts: DetectToolsOptions = {}): Record<string, boolean> {
    const home = opts.home ?? homedir();
    const pathEnv = opts.pathEnv ?? process.env['PATH'] ?? '';
    const out: Record<string, boolean> = {};
    for (const [id, signal] of Object.entries(TOOL_SIGNALS)) {
        out[id] = isToolInstalled(signal, home, pathEnv);
    }
    return out;
}
