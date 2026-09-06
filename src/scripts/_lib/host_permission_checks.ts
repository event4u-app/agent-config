/**
 * host_permission_checks — report the host permission settings that produce
 * confirmation prompts, and write none of them.
 *
 * WHY REPORT AND NOT WRITE. Three settings decide how often a normal coding
 * task is interrupted, and all three belong to the consumer:
 * `permissions.deny` rules that cover reads, the working tree's absence from
 * `permissions.additionalDirectories`, and `permissions.defaultMode`. Writing
 * any of them would be this package deciding a consumer's permission posture
 * from inside their repository, which is the one thing a permission surface
 * must never do quietly. `src/templates/consumer-settings/claude-settings.json`
 * carries `enabledPlugins` and `hooks` and zero `permissions` keys; this check
 * exists so that stays true and the consumer still gets the answer.
 *
 * WHY IT NAMES ALL THREE EVEN WHEN ALL THREE ARE ABSENT. Absent is a real
 * answer and the most common one. A check that goes silent on the default
 * project reports "nothing found" and "I did not look" identically, which is
 * the measured-zero-versus-not-measured failure this tree's own report
 * contracts argue against. So each setting is named on every run, with its
 * resolved value or the word absent.
 *
 * READ ONLY, AND FAILURE-TOLERANT. An unreadable or malformed settings file is
 * reported, never repaired: a consumer's JSON is theirs, and a doctor that
 * rewrites what it came to inspect is not a doctor.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import type { WiringCheck } from "./runtime_wiring_checks.js";

/** Injected so a test never reads the developer's own home directory. */
export interface HostPermissionDeps {
    projectRoot: string;
    homeDir: string;
    readFile: (p: string) => string | null;
    isDirectory: (p: string) => boolean;
}

/** The permission block as the host writes it; every field optional. */
interface PermissionBlock {
    allow?: unknown;
    deny?: unknown;
    ask?: unknown;
    additionalDirectories?: unknown;
    defaultMode?: unknown;
}

/** One settings layer, in the host's own precedence order. */
export interface SettingsLayer {
    label: string;
    file: string;
    present: boolean;
    unreadable: boolean;
    permissions: PermissionBlock;
}

/**
 * Tool names whose every documented effect is a read, plus the read-shaped
 * `Bash(<cmd>:*)` heads. A deny covering one of these is the class that turns a
 * category-A call back into a prompt, which is why it is worth naming
 * separately from a deny on a write.
 */
const READ_SHAPED = [
    "Read", "Glob", "Grep", "LS", "NotebookRead",
    "Bash(cat", "Bash(ls", "Bash(head", "Bash(tail", "Bash(grep",
    "Bash(rg", "Bash(find", "Bash(wc", "Bash(git status", "Bash(git log",
    "Bash(git diff", "Bash(git show",
];

/** The four `defaultMode` values probed from Claude Code 2.1.263. */
const KNOWN_MODES = ["default", "acceptEdits", "plan", "bypassPermissions"];

function _strings(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** Default deps — the only place the real filesystem is touched. */
export function defaultHostPermissionDeps(projectRoot: string): HostPermissionDeps {
    return {
        projectRoot,
        homeDir: os.homedir(),
        readFile: (p) => {
            try {
                return fs.readFileSync(p, "utf8");
            } catch {
                return null;
            }
        },
        isDirectory: (p) => {
            try {
                return fs.statSync(p).isDirectory();
            } catch {
                return false;
            }
        },
    };
}

/**
 * Resolve the three settings layers the host reads, in its precedence order.
 *
 * There was no resolver for this before — `security_audit_config.ts` is the
 * only place all three paths appear together, and only as glob strings — so
 * this is the first code in the tree that reads `permissions` at all.
 */
export function readSettingsLayers(deps: HostPermissionDeps): SettingsLayer[] {
    const candidates: Array<[string, string]> = [
        ["user-global", path.join(deps.homeDir, ".claude", "settings.json")],
        ["project", path.join(deps.projectRoot, ".claude", "settings.json")],
        ["project-local", path.join(deps.projectRoot, ".claude", "settings.local.json")],
    ];
    return candidates.map(([label, file]) => {
        const raw = deps.readFile(file);
        if (raw === null) {
            return { label, file, present: false, unreadable: false, permissions: {} };
        }
        try {
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            const perms = parsed["permissions"];
            return {
                label,
                file,
                present: true,
                unreadable: false,
                permissions:
                    perms !== null && typeof perms === "object" ? (perms as PermissionBlock) : {},
            };
        } catch {
            return { label, file, present: true, unreadable: true, permissions: {} };
        }
    });
}

/** Deny rules that cover a read, with the layer each came from. */
export function readDenyRules(layers: readonly SettingsLayer[]): Array<[string, string]> {
    const hits: Array<[string, string]> = [];
    for (const layer of layers) {
        for (const rule of _strings(layer.permissions.deny)) {
            if (READ_SHAPED.some((prefix) => rule.startsWith(prefix))) {
                hits.push([layer.label, rule]);
            }
        }
    }
    return hits;
}

/** Every `additionalDirectories` entry across the layers; the host unions them. */
export function additionalDirectories(layers: readonly SettingsLayer[]): string[] {
    const seen: string[] = [];
    for (const layer of layers) {
        for (const dir of _strings(layer.permissions.additionalDirectories)) {
            if (!seen.includes(dir)) seen.push(dir);
        }
    }
    return seen;
}

/** The winning `defaultMode`, or `null` when no layer sets one. */
export function resolvedDefaultMode(layers: readonly SettingsLayer[]): string | null {
    let winner: string | null = null;
    for (const layer of layers) {
        const mode = layer.permissions.defaultMode;
        if (typeof mode === "string" && mode.trim()) winner = mode.trim();
    }
    return winner;
}

/**
 * Is the project root a LINKED worktree?
 *
 * A linked worktree's `.git` is a file holding a `gitdir:` pointer, never a
 * directory. It matters here because a worktree root is a working directory the
 * host was not started in, which is exactly the case
 * `additionalDirectories` exists to cover — and the case a consumer is least
 * likely to have thought about.
 */
export function isLinkedWorktree(deps: HostPermissionDeps): boolean {
    const dotGit = path.join(deps.projectRoot, ".git");
    const raw = deps.readFile(dotGit);
    if (raw === null) return false;
    return !deps.isDirectory(dotGit) && raw.trimStart().startsWith("gitdir:");
}

/** The copyable snippet — the consumer pastes it, this package never writes it. */
export function permissionSnippet(projectRoot: string): string {
    return JSON.stringify(
        { permissions: { additionalDirectories: [projectRoot], defaultMode: "default" } },
        null,
        2,
    );
}

/**
 * The doctor row.
 *
 * `warn` when something reportable was found, `ok` otherwise. Never `fail`:
 * these are the consumer's own choices, and a doctor that fails a build over a
 * setting it is forbidden to write would be asking for a change it will not
 * make.
 */
export function checkHostPermissionSettings(deps: HostPermissionDeps): WiringCheck {
    const layers = readSettingsLayers(deps);
    const unreadable = layers.filter((l) => l.unreadable);
    const denies = readDenyRules(layers);
    const dirs = additionalDirectories(layers);
    const mode = resolvedDefaultMode(layers);
    const worktree = isLinkedWorktree(deps);
    const rootListed = dirs.some(
        (d) => path.resolve(d) === path.resolve(deps.projectRoot),
    );

    const lines: string[] = [];
    lines.push(
        denies.length === 0
            ? "read-deny rules: absent — no permissions.deny rule covers a read"
            : `read-deny rules: ${denies.length} — ` +
              denies.map(([layer, rule]) => `${rule} (${layer})`).join(", "),
    );
    lines.push(
        rootListed
            ? `working tree in additionalDirectories: present (${deps.projectRoot})`
            : `working tree in additionalDirectories: absent (${deps.projectRoot}` +
              `${worktree ? ", a linked worktree" : ""})`,
    );
    lines.push(
        mode === null
            ? "permissions.defaultMode: absent — the host's own built-in default applies"
            : `permissions.defaultMode: ${mode}` +
              (KNOWN_MODES.includes(mode) ? "" : " — not a value this tree has probed"),
    );
    for (const layer of unreadable) {
        lines.push(`unreadable: ${layer.file} (${layer.label}) is not valid JSON`);
    }

    // A linked worktree unlisted in additionalDirectories is the one finding
    // worth surfacing on its own: the host was started somewhere else, so every
    // call into this tree is a call into a directory it was not granted.
    const reportable =
        denies.length > 0 || unreadable.length > 0 || (worktree && !rootListed);

    return {
        id: "host-permission-settings",
        status: reportable ? "warn" : "ok",
        message: lines.join("; "),
        remedy:
            "agent-config never writes permissions — paste this into " +
            `${path.join(deps.projectRoot, ".claude", "settings.local.json")} yourself if you want it: ` +
            permissionSnippet(deps.projectRoot).replace(/\s+/g, " "),
    };
}
