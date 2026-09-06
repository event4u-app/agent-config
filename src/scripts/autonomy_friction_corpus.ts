/**
 * autonomy_friction_corpus — how many host confirmations each payload class
 * costs, measured through the real dispatcher.
 *
 * WHY A CONFIRMATION COUNT AND NOT A GATE COUNT. "Three gates fire" says
 * nothing about what the operator experiences; "this call costs one
 * confirmation" is the quantity the round is about. A corpus counting gates
 * would go green on a change that fired fewer gates and prompted just as often.
 *
 * WHAT IT MEASURES, STATED NARROWLY. The number of confirmations THIS PACKAGE
 * leaves on the table for a call — 0 when the dispatcher hands the host an
 * explicit `permissionDecision: allow`, 1 when it emits no permission field and
 * the host's own machinery decides. It is NOT a measurement of what the host
 * finally does: a consumer whose settings already allow the call is not
 * prompted either way, and a confined session ignores our allow entirely
 * (`permissionDecision=allow ignored: a confined session takes grants only
 * from its command line`). Reading this as a host-behaviour measurement is the
 * fact-about-our-plumbing-written-as-a-fact-about-the-host collapse the hook
 * contract warns about three times.
 *
 * A REFUSAL IS NOT A CONFIRMATION. A case the dispatcher blocks (exit 2) is
 * reported as `refused` and scores no confirmations — counting a refusal as
 * friction would reward removing a gate, which is the opposite of the point.
 *
 * Usage:
 *   ./scripts-run src/scripts/autonomy_friction_corpus [--json]
 *   ./agent-config …  (no verb — this is a package-internal measurement)
 */
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..");
const ENTRY = path.join(REPO_ROOT, "src", "scripts", "hooks", "dispatch_entry.ts");
const TSX_BIN = path.join(
    REPO_ROOT,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "tsx.cmd" : "tsx",
);

/** One payload class, with the confirmations it is expected to cost. */
export interface FrictionCase {
    id: string;
    /** The class the owner named, in their words. */
    klass: string;
    tool: string;
    input: Record<string, unknown>;
    /** Confirmations this call SHOULD cost. */
    expected: number;
    /** Why that number, in one line. */
    because: string;
}

/** One measured result. */
export interface FrictionResult extends FrictionCase {
    observed: number;
    refused: boolean;
    pass: boolean;
}

/**
 * The six classes the round named, plus the directory-flag form.
 *
 * The seventh is not padding: cases 1 and 2 are the shape the canon stopped
 * teaching, and without the shape that replaced them the corpus would record
 * the cost and not the fix.
 */
export const CASES: readonly FrictionCase[] = [
    {
        id: "directory-change",
        klass: "directory change",
        tool: "Bash",
        input: { command: "cd sub" },
        expected: 1,
        because:
            "a bare `cd` is not category A — the canon's answer is a directory flag, " +
            "not an allow for changing directory",
    },
    {
        id: "directory-change-compounded",
        klass: "directory change compounded with a status read",
        tool: "Bash",
        input: { command: "cd sub && git status" },
        expected: 1,
        because:
            "a compound command is refused before its argv is read — a safe head " +
            "token must not be able to carry a second command",
    },
    {
        id: "directory-flag-status",
        klass: "the directory-flag form of the case above",
        tool: "Bash",
        input: { command: "git -C sub status" },
        expected: 0,
        because: "one simple command, a read-only git subcommand, inside the working tree",
    },
    {
        id: "test-runner-in-subdirectory",
        klass: "a test runner invoked from a subdirectory",
        tool: "Bash",
        input: { command: "vitest run sub" },
        expected: 0,
        because: "a test runner admitted by name — the name IS the operation",
    },
    {
        id: "workspace-package-manager",
        klass: "a workspace package manager",
        tool: "Bash",
        input: { command: "npm run test" },
        expected: 0,
        because: "a declared subcommand with a declared script name",
    },
    {
        id: "consequence-authorized",
        klass: "a consequence operation with the authorizing phrase present",
        tool: "Bash",
        input: { command: "terraform apply" },
        expected: 1,
        because:
            "the phrase changes the RECORD, never the prompt — after ADR-254 the " +
            "Hard Floor is model-held and this package grants nothing",
    },
    {
        id: "consequence-unauthorized",
        klass: "the same operation with the authorizing phrase absent",
        tool: "Bash",
        input: { command: "terraform apply" },
        expected: 1,
        because:
            "identical to the case above BY DESIGN — that the two are the same " +
            "number is the finding, not a defect in the corpus",
    },
];

/** Run one case through the real dispatcher and count its confirmations. */
export function measure(c: FrictionCase, workspace: string): FrictionResult {
    const payload = JSON.stringify({
        session_id: "autonomy-friction-corpus",
        cwd: workspace,
        hook_event_name: "PreToolUse",
        tool_name: c.tool,
        tool_input: c.input,
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
    const refused = r.status === 2;
    const allowed = !refused && (r.stdout ?? "").includes('"permissionDecision":"allow"');
    const observed = refused || allowed ? 0 : 1;
    return { ...c, observed, refused, pass: refused || observed === c.expected };
}

export function runCorpus(): FrictionResult[] {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "ac-friction-"));
    fs.mkdirSync(path.join(workspace, "sub"), { recursive: true });
    try {
        return CASES.map((c) => measure(c, workspace));
    } finally {
        fs.rmSync(workspace, { recursive: true, force: true });
    }
}

export function render(results: readonly FrictionResult[]): string {
    const out: string[] = [];
    out.push("autonomy_friction_corpus — confirmations per payload class");
    out.push("");
    out.push("  measured through the real dispatcher; a confirmation is one this");
    out.push("  package leaves to the host, NOT one the host necessarily shows.");
    out.push("");
    for (const r of results) {
        const mark = r.pass ? "✅" : "❌";
        const obs = r.refused ? "refused" : String(r.observed);
        out.push(`  ${mark} ${r.id.padEnd(30)} expected ${r.expected}  observed ${obs}`);
        out.push(`       ${r.klass}`);
        out.push(`       ${r.because}`);
    }
    const failures = results.filter((r) => !r.pass);
    out.push("");
    out.push(
        failures.length === 0
            ? `  ${results.length} case(s), every observation matches its expectation`
            : `  ${failures.length} of ${results.length} case(s) miss their expectation: ` +
              failures.map((f) => f.id).join(", "),
    );
    return out.join("\n") + "\n";
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const json = argv.includes("--json");
    if (argv.includes("--help") || argv.includes("-h")) {
        process.stdout.write(
            "usage: autonomy_friction_corpus [--json]\n" +
                "  Reports the confirmations each payload class costs, measured\n" +
                "  through the real dispatcher. Exit 1 when an observation misses\n" +
                "  its expectation.\n",
        );
        return 0;
    }
    const results = runCorpus();
    process.stdout.write(json ? `${JSON.stringify(results, null, 2)}\n` : render(results));
    return results.every((r) => r.pass) ? 0 : 1;
}

function _isCliEntry(): boolean {
    const argv1 = process.argv[1];
    if (argv1 === undefined) return false;
    try {
        return fs.realpathSync(argv1) === fs.realpathSync(fileURLToPath(import.meta.url));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
