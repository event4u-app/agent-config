/**
 * floor_posture — what stands between a destructive shell command and its
 * execution on this machine, reported for `hooks:doctor` and written nowhere.
 *
 * WHY. The destructive-action floor has two possible carriers on `claude`: the
 * host's own OS sandbox and this package's `pre_tool_use` hook. Neither is
 * visible from inside a session. The trampoline in `hooks/hooks.json` exits 0
 * when it reaches no dispatcher (contracted in `docs/contracts/hook-architecture-v1.md`),
 * so a machine where no hook runs looks exactly like a session where no hook had
 * anything to say. This module names that state "floor not running".
 *
 * REPORT, NEVER WRITE — the `host_permission_checks` pattern. Sandbox and hook
 * settings are the consumer's; a doctor that rewrites them has decided their
 * posture for them. Every key is named on every run, absent included, because
 * "absent" and "did not look" must not read the same.
 *
 * The sandbox keys were read from the Claude Code 2.1.302 binary's own strings
 * on 2026-10-18: `sandbox.enabled`, `sandbox.failIfUnavailable` ("Exit with an
 * error at startup if sandbox.enabled is true but the sandbox cannot start") and
 * `sandbox.allowUnsandboxedCommands`. Managed settings are not read, so a
 * policy-locked value is reported as whatever the user layers say.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/** Injected so a test never reads the developer's own machine. */
export interface FloorPostureDeps {
    projectRoot: string;
    homeDir: string;
    env: NodeJS.ProcessEnv;
    readFile: (p: string) => string | null;
    exists: (p: string) => boolean;
    isExecutable: (p: string) => boolean;
    onPath: (bin: string) => boolean;
}

/** Which dispatcher the trampoline would reach, in its own order. */
export type FloorRuntime = "project-bundle" | "runtime-current" | "cli" | "floor-not-running";

export interface FloorPosture {
    runtime: FloorRuntime;
    sandbox: {
        enabled: boolean | null;
        failIfUnavailable: boolean | null;
        allowUnsandboxedCommands: boolean | null;
    };
    /** `PreToolUse` hooks in the settings layers that are not this package's dispatcher. */
    foreignPreToolUseHooks: number;
    unreadable: string[];
}

function _executable(p: string): boolean {
    try {
        fs.accessSync(p, fs.constants.X_OK);
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** Default deps — the only place the real filesystem and PATH are touched. */
export function defaultFloorPostureDeps(projectRoot: string): FloorPostureDeps {
    const env = process.env;
    return {
        projectRoot,
        homeDir: os.homedir(),
        env,
        readFile: (p) => {
            try {
                return fs.readFileSync(p, "utf8");
            } catch {
                return null;
            }
        },
        exists: (p) => fs.existsSync(p),
        isExecutable: _executable,
        onPath: (bin) =>
            (env["PATH"] ?? "").split(path.delimiter).some((dir) => dir !== "" && _executable(path.join(dir, bin))),
    };
}

/**
 * The trampoline's resolution order, mirrored: the project's own bundle with
 * `node` on PATH, then the installed runtime's pinned node, then the CLI.
 */
function _runtime(deps: FloorPostureDeps): FloorRuntime {
    const root = deps.projectRoot;
    const bundle = path.join(root, "node_modules", "@event4u", "agent-config", "dist", "hooks", "dispatch.js");
    const selfHosted =
        deps.exists(path.join(root, "dist", "hooks", "dispatch.js")) &&
        deps.exists(path.join(root, "src", "scripts", "hook_manifest.yaml"));
    if ((deps.exists(bundle) || selfHosted) && deps.onPath("node")) return "project-bundle";

    const configHome = deps.env["EVENT4U_CONFIG_HOME"] || path.join(deps.homeDir, ".event4u", "agent-config");
    const current = path.join(configHome, "runtime", "current");
    const node = (deps.readFile(path.join(current, "node")) ?? "").split("\n")[0]?.trim() ?? "";
    if (node && deps.isExecutable(node) && deps.exists(path.join(current, "dist", "hooks", "dispatch.js"))) {
        return "runtime-current";
    }

    if (deps.isExecutable(path.join(root, "agent-config")) || deps.onPath("agent-config")) return "cli";
    return "floor-not-running";
}

function _bool(v: unknown): boolean | null {
    return typeof v === "boolean" ? v : null;
}

/**
 * Is this hook command this package's own dispatcher? The invocation, not a
 * name: `rewrite-dispatch.js` or a path containing `agent-config` is another
 * hook, and counting it as ours would hide the warning it exists for.
 */
function _ours(command: string): boolean {
    return /dispatch(?:\.js"?|:hook) --platform claude\b/.test(command);
}

export function readFloorPosture(deps: FloorPostureDeps): FloorPosture {
    const layers = [
        path.join(deps.homeDir, ".claude", "settings.json"),
        path.join(deps.projectRoot, ".claude", "settings.json"),
        path.join(deps.projectRoot, ".claude", "settings.local.json"),
    ];
    const sandbox: FloorPosture["sandbox"] = { enabled: null, failIfUnavailable: null, allowUnsandboxedCommands: null };
    const unreadable: string[] = [];
    let foreign = 0;
    for (const file of layers) {
        const raw = deps.readFile(file);
        if (raw === null) continue;
        let parsed: Record<string, unknown>;
        try {
            parsed = JSON.parse(raw) as Record<string, unknown>;
        } catch {
            unreadable.push(file);
            continue;
        }
        const box = parsed["sandbox"];
        if (box !== null && typeof box === "object") {
            for (const key of Object.keys(sandbox) as Array<keyof FloorPosture["sandbox"]>) {
                const value = _bool((box as Record<string, unknown>)[key]);
                if (value !== null) sandbox[key] = value;
            }
        }
        const hooks = (parsed["hooks"] as Record<string, unknown> | undefined)?.["PreToolUse"];
        for (const group of Array.isArray(hooks) ? hooks : []) {
            const entries = (group as Record<string, unknown> | null)?.["hooks"];
            for (const entry of Array.isArray(entries) ? entries : []) {
                const command = (entry as Record<string, unknown> | null)?.["command"];
                if (typeof command === "string" && !_ours(command)) foreign += 1;
            }
        }
    }
    return { runtime: _runtime(deps), sandbox, foreignPreToolUseHooks: foreign, unreadable };
}

const RUNTIME_TEXT: Record<FloorRuntime, string> = {
    // "reaches", not "runs": what was checked is that the trampoline finds a
    // dispatcher, not that a PreToolUse entry is registered or enabled.
    "project-bundle": "reaches a dispatcher — the project's own bundle",
    "runtime-current": "reaches a dispatcher — the installed runtime's",
    cli: "reaches a dispatcher — through the agent-config CLI",
    "floor-not-running":
        "floor not running — the trampoline reaches no dispatcher and exits 0, so no hook runs in a session here",
};

function _key(name: string, value: boolean | null): string {
    return `${name}: ${value === null ? "absent" : String(value)}`;
}

export function renderFloorPosture(p: FloorPosture): string[] {
    const lines = [
        `hook runtime: ${RUNTIME_TEXT[p.runtime]}`,
        _key("sandbox.enabled", p.sandbox.enabled),
        _key("sandbox.failIfUnavailable", p.sandbox.failIfUnavailable),
        _key("sandbox.allowUnsandboxedCommands", p.sandbox.allowUnsandboxedCommands),
        p.foreignPreToolUseHooks === 0
            ? "other PreToolUse hooks: none in the settings layers"
            : `other PreToolUse hooks: ${p.foreignPreToolUseHooks} PreToolUse hook(s) not from agent-config — ` +
              "one may rewrite the command after this package's verdict",
    ];
    for (const file of p.unreadable) lines.push(`unreadable: ${file} is not valid JSON`);
    lines.push("a guardrail, not a security boundary — agent-config never writes these settings");
    return lines;
}
