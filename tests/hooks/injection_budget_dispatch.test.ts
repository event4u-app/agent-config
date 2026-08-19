/**
 * End-to-end emission shaping through the REAL dispatcher
 * (road-to-standing-context-40k Phase 4, steps 4.1 + 4.2).
 *
 * `tests/scripts/hooks/injection_budget.test.ts` unit-tests the policy and
 * `tests/scripts/nudge_interference.test.ts` pins the corpus. Neither proves the
 * layer is WIRED — a policy defined but never reached is the "defined but not
 * wired" failure this repo's own discipline calls not-done. So this file runs
 * the production no-bundle path (`dispatch_entry.ts` via tsx, the same shape
 * host_semantics_dispatch.test.ts uses) against the SHIPPED manifest, on the
 * prompt measured to fire both nudges, and asserts:
 *
 *   - exactly one nudge line reaches stdout;
 *   - it is the one the manifest ranks first;
 *   - the suppression is RECORDED in dispatch-issues.jsonl, so a reader who
 *     wonders where the other line went can find out.
 *
 * The skills catalogue is a two-entry fixture under the temp workspace rather
 * than the real tree: the ranker's score is then a property of this file, and a
 * future edit to a shipped SKILL.md cannot silently drop the co-fire this test
 * exists to reproduce.
 */
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { turnSpendPath } from "../../src/scripts/hooks/injection_budget.js";

/** The session id the fixture envelope below carries. */
const SESSION = "injection-budget-dispatch-test";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const ENTRY = path.join(REPO_ROOT, "src", "scripts", "hooks", "dispatch_entry.ts");
const TSX_BIN = path.join(
    REPO_ROOT,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "tsx.cmd" : "tsx",
);

// The measured co-fire prompt. First clause is `using-git-worktrees`' own
// description (clears skill-route's 31/100 floor); the trailing clause carries
// four file tokens (clears delegation-nudge's FILE_SIGNAL_FLOOR of 3).
const CO_FIRE_PROMPT =
    "Use when starting parallel work in isolation from the current branch — " +
    "spawn a git worktree with ignore-safety checks and a clean test baseline " +
    "for src/a.ts, src/b.ts, src/c.ts and src/d.ts, each independently.";

const tmpDirs: string[] = [];

function workspace(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "injection-dispatch-"));
    tmpDirs.push(d);
    const skills = path.join(d, ".claude", "skills");
    fs.mkdirSync(path.join(skills, "using-git-worktrees"), { recursive: true });
    fs.writeFileSync(
        path.join(skills, "using-git-worktrees", "SKILL.md"),
        // ONE physical line, deliberately. A folded multi-line `description:`
        // reads as its first line only through the catalogue loader, which
        // silently halves the ranker's score — the first version of this fixture
        // did exactly that and the co-fire it exists to reproduce never fired.
        [
            "---",
            "name: using-git-worktrees",
            "description: Use when starting parallel work in isolation from the current branch — spawn a git worktree with ignore-safety checks and a clean test baseline — even when the user says 'try this on the side'.",
            "---",
            "",
            "# Using git worktrees",
            "",
        ].join("\n"),
    );
    // A second entry so the catalogue is a ranking rather than a single row.
    fs.mkdirSync(path.join(skills, "docx-authoring"), { recursive: true });
    fs.writeFileSync(
        path.join(skills, "docx-authoring", "SKILL.md"),
        ["---", "name: docx-authoring", "description: Author Word documents.", "---", ""].join("\n"),
    );
    return d;
}

function dispatchPrompt(ws: string, prompt: string): { status: number | null; stdout: string; stderr: string } {
    const payload = JSON.stringify({
        session_id: SESSION,
        cwd: ws,
        hook_event_name: "UserPromptSubmit",
        prompt,
    });
    const r = spawnSync(
        TSX_BIN,
        [ENTRY, "--platform", "claude", "--event", "user_prompt_submit", "--project-dir", ws],
        {
            encoding: "utf-8",
            input: payload,
            cwd: ws,
            env: {
                ...process.env,
                // Real run, not replay: the drop record and the turn counter are
                // both state writes and replay skips them by contract.
                AGENT_CONFIG_REPLAY: "",
                AGENT_CONFIG_SESSION_ROLE: "",
            },
        },
    );
    return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function dispatchIssues(ws: string): Record<string, string>[] {
    const log = path.join(ws, "agents", "runtime", "state", "dispatch-issues.jsonl");
    if (!fs.existsSync(log)) return [];
    return fs
        .readFileSync(log, "utf-8")
        .split("\n")
        .filter((l) => l.trim() !== "")
        .map((l) => JSON.parse(l) as Record<string, string>);
}

afterEach(() => {
    while (tmpDirs.length > 0) {
        const d = tmpDirs.pop();
        if (d) fs.rmSync(d, { recursive: true, force: true });
    }
});

describe("emission shaping through the real dispatcher", () => {
    it("emits the higher-ranked nudge only, and records the suppression", () => {
        const ws = workspace();
        const r = dispatchPrompt(ws, CO_FIRE_PROMPT);

        // UserPromptSubmit is advisory here — the turn must proceed.
        expect(r.status).toBe(0);

        const out = r.stdout;
        expect(out).toContain("<delegation-nudge>");
        expect(out).not.toContain("<skill-route>");

        const drops = dispatchIssues(ws).filter(
            (e) => e["issue"] === "nudge_interference_drop",
        );
        expect(drops).toHaveLength(1);
        expect(drops[0]?.["hook"]).toBe("skill-route");
        expect(drops[0]?.["detail"]).toContain("delegation-nudge");
        // The record points at the row that owns the decision, not at a fix-hint
        // for a broken hook — this is a policy outcome, not a failure.
        expect(drops[0]?.["resolution"]).toContain("per_turn_aggregate_bytes");
    });

    it("near-miss — a skill-only prompt keeps skill-route and records nothing", () => {
        const ws = workspace();
        // Same first clause, no file tokens: delegation-nudge stays silent, so
        // skill-route is a single nudge and must survive untouched.
        const r = dispatchPrompt(
            ws,
            "Use when starting parallel work in isolation from the current branch — " +
                "spawn a git worktree with ignore-safety checks and a clean test baseline",
        );
        expect(r.status).toBe(0);
        expect(r.stdout).toContain("<skill-route>");
        expect(r.stdout).not.toContain("<delegation-nudge>");
        expect(dispatchIssues(ws).filter((e) => e["issue"].endsWith("_drop"))).toEqual([]);
    });

    it("does not budget the turn-start slot against the previous turn's spend", () => {
        // The R2 review found the read side unguarded: `spent_before` was read
        // before the reset, so a turn that ended near the ceiling suppressed the
        // NEXT turn's opening advisories. Seed a counter at the full ceiling and
        // assert the opening nudge survives anyway — on the slot that begins a
        // turn, the carried total is zero by definition.
        const ws = workspace();
        const counter = turnSpendPath(ws, SESSION);
        fs.mkdirSync(path.dirname(counter), { recursive: true });
        fs.writeFileSync(counter, JSON.stringify({ session: SESSION, bytes: 47_104 }));

        const r = dispatchPrompt(ws, CO_FIRE_PROMPT);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain("<delegation-nudge>");
        expect(
            dispatchIssues(ws).filter((e) => e["issue"] === "injection_budget_drop"),
        ).toEqual([]);
        // And the counter is now this turn's own spend, not the seeded total.
        const after = JSON.parse(fs.readFileSync(counter, "utf-8")) as Record<string, unknown>;
        expect(after["bytes"] as number).toBeLessThan(47_104);
    });

    it("writes a counts-only turn counter and resets it on the turn-start slot", () => {
        const ws = workspace();
        dispatchPrompt(ws, CO_FIRE_PROMPT);
        const counter = turnSpendPath(ws, SESSION);
        expect(fs.existsSync(counter)).toBe(true);
        const parsed = JSON.parse(fs.readFileSync(counter, "utf-8")) as Record<string, unknown>;
        expect(Object.keys(parsed).sort()).toEqual(["bytes", "session"]);
        expect(parsed["bytes"]).toBeTypeOf("number");
        const first = parsed["bytes"] as number;
        expect(first).toBeGreaterThan(0);

        // user_prompt_submit STARTS a turn, so a second prompt must not accumulate.
        dispatchPrompt(ws, CO_FIRE_PROMPT);
        const again = JSON.parse(fs.readFileSync(counter, "utf-8")) as Record<string, unknown>;
        expect(again["bytes"]).toBe(first);
    });
});
