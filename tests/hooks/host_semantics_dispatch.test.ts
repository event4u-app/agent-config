/**
 * End-to-end host-semantics contract through the REAL dispatcher
 * (road-to-rule-coherence P0.1 / gate G5).
 *
 * `tests/hooks/host_semantics.test.ts` unit-tests the mapping function. This
 * file pins the wiring: dispatcher → concern → emission, as a child process via
 * tsx (the production no-bundle path, same shape as
 * tests/scripts/hooks/session_start_chain.test.ts). That matters because the
 * only pre-existing end-to-end assertion lived in rule_trips.test.ts, which
 * SKIPS when dist/hooks/dispatch.js is absent — so a local run stayed green
 * while CI (which builds the bundle) went red. A contract this load-bearing
 * needs a check that runs without a build step.
 *
 * Pinned facts, per the Claude Code hooks docs:
 *   - a policy refusal exits 2 ("only exit code 2 blocks the action"); exit 1
 *     is a non-blocking error and the tool would proceed;
 *   - stdout is ignored at exit 2, so the reason must be on stderr;
 *   - the reason must be the CONCERN's own message, not a generic label —
 *     before this change a rc=1 block discarded the concern's stderr entirely.
 */
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const ENTRY = path.join(REPO_ROOT, "src", "scripts", "hooks", "dispatch_entry.ts");
const TSX_BIN = path.join(
    REPO_ROOT,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "tsx.cmd" : "tsx",
);

const tmpDirs: string[] = [];

function tmpDir(prefix: string): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmpDirs.push(d);
    return d;
}

afterEach(() => {
    while (tmpDirs.length > 0) {
        const d = tmpDirs.pop();
        if (d) fs.rmSync(d, { recursive: true, force: true });
    }
});

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

function runPreToolUse(workspace: string, toolName: string, toolInput: unknown): RunResult {
    const payload = JSON.stringify({
        session_id: "host-semantics-test",
        cwd: workspace,
        hook_event_name: "PreToolUse",
        tool_name: toolName,
        tool_input: toolInput,
    });
    const r = spawnSync(
        TSX_BIN,
        [ENTRY, "--platform", "claude", "--event", "pre_tool_use", "--project-dir", workspace],
        {
            encoding: "utf-8",
            cwd: workspace,
            input: payload,
            timeout: 120_000,
            env: { ...process.env, AGENT_CONFIG_PACKAGE_ROOT: REPO_ROOT },
        },
    );
    return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

describe("claude pre_tool_use — a blocking guard actually blocks", () => {
    it("exits 2, not 1 — exit 1 would let the tool call proceed", () => {
        const ws = tmpDir("ac-hs-block-");
        const r = runPreToolUse(ws, "Bash", { command: "git commit --no-verify -m x" });
        expect(r.status, `stderr: ${r.stderr.slice(0, 400)}`).toBe(2);
        expect(r.status).not.toBe(1);
    });

    it("puts the CONCERN's own reason on stderr, not a generic label", () => {
        const ws = tmpDir("ac-hs-reason-");
        const r = runPreToolUse(ws, "Bash", { command: "git commit --no-verify -m x" });
        expect(r.stderr).toContain("block-no-verify");
        expect(r.stderr).toContain("--no-verify");
        // The generic fallback is only for a block that stated nothing at all.
        expect(r.stderr).not.toBe("blocked by agent-config hook policy\n");
    });

    it("writes nothing to stdout — the host ignores stdout at exit 2", () => {
        const ws = tmpDir("ac-hs-stdout-");
        const r = runPreToolUse(ws, "Bash", { command: "git commit --no-verify -m x" });
        expect(r.stdout).toBe("");
    });
});

describe("claude pre_tool_use — a clean call carries an explicit allow", () => {
    it("exits 0 with an empty stderr and a permissionDecision on stdout", () => {
        // This used to assert BOTH streams empty. A clean category-A call is no
        // longer silent: the dispatcher emits `permissionDecision: allow` so the
        // host stops prompting for a read this package does not gate. The exit
        // code and the empty stderr are unchanged — only the added field is new.
        const ws = tmpDir("ac-hs-allow-");
        const r = runPreToolUse(ws, "Read", { file_path: path.join(ws, "x") });
        expect(r.status, `stderr: ${r.stderr.slice(0, 400)}`).toBe(0);
        expect(r.stderr).toBe("");
        const parsed = JSON.parse(r.stdout);
        expect(parsed.hookSpecificOutput.hookEventName).toBe("PreToolUse");
        expect(parsed.hookSpecificOutput.permissionDecision).toBe("allow");
    });

    it("a call that is NOT category A stays silent", () => {
        // The allow is scoped by the classifier, not by the absence of
        // findings: a Write nobody objected to still gets no permission field.
        const ws = tmpDir("ac-hs-allow-write-");
        const r = runPreToolUse(ws, "Write", { file_path: path.join(ws, "x"), content: "y" });
        expect(r.status, `stderr: ${r.stderr.slice(0, 400)}`).toBe(0);
        expect(r.stdout).toBe("");
    });

    it("records no rule trip", () => {
        const ws = tmpDir("ac-hs-notrips-");
        runPreToolUse(ws, "Read", { file_path: path.join(ws, "x") });
        expect(fs.existsSync(path.join(ws, "agents", "runtime", "state", "rule-trips.json"))).toBe(
            false,
        );
    });
});
