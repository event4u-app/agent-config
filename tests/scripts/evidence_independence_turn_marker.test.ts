/**
 * The per-turn marker `evidence_independence` reads is the authorization
 * ledger's `detected_at`, read through the ledger writer's own
 * `ledgerFileFor(session_id)` rather than a spelled-out session-less path.
 * With a real session id present — which every host supplies — the writer
 * never touches the session-less path, so reading it unconditionally found
 * nothing (or a stale fixture) and the counter never reset per turn.
 *
 * This drives both sides through their real entry points: the writer on a
 * `user_prompt_submit`-shaped stdin, the reader on a `pre_tool_use`-shaped
 * one, both carrying the same session id a host would attach to every event
 * in one conversation.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import { run as runLedgerWriter } from "../../src/scripts/git_authorization_hook.js";
import { run as runEvaluatorGuard } from "../../src/scripts/hooks/evidence_independence.js";
import { STATE_FILE as EVIDENCE_STATE_FILE } from "../../src/scripts/hooks/evidence_independence.js";

let tmp: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "turn-marker-"));
});

const SESSION = "host-session-1";

function userTurn(prompt: string): number {
    return runLedgerWriter(
        JSON.stringify({ event: "user_prompt_submit", session_id: SESSION, prompt }),
        { consumer_root: tmp },
    );
}

function evaluationDispatch(prompt: string): number {
    return runEvaluatorGuard(
        JSON.stringify({
            event: "pre_tool_use",
            session_id: SESSION,
            payload: { tool_name: "Agent", tool_input: { prompt } },
        }),
        { consumer_root: tmp },
    );
}

function evaluationCount(): number {
    const p = path.join(tmp, EVIDENCE_STATE_FILE);
    if (!fs.existsSync(p)) return 0;
    const s = JSON.parse(fs.readFileSync(p, "utf8")) as { evaluations?: unknown[] };
    return Array.isArray(s.evaluations) ? s.evaluations.length : 0;
}

describe("evidence-independence turn marker follows the real ledger writer", () => {
    it("a second user turn resets the evaluation count to zero before the next dispatch", () => {
        expect(userTurn("please merge the branch")).toBe(0);
        expect(evaluationDispatch("Review my change and report findings.")).toBe(0);
        expect(evaluationCount()).toBe(1);
        expect(evaluationDispatch("Review my change again, wider scope.")).toBe(0);
        expect(evaluationCount()).toBe(2);

        // A new user turn — a fresh `user_prompt_submit` — moves the ledger's
        // `detected_at` forward, so the next dispatch starts the count over.
        expect(userTurn("now push it")).toBe(0);
        expect(evaluationDispatch("Review my change and report findings.")).toBe(0);
        expect(evaluationCount()).toBe(1);
    });

    it("writes the per-session ledger, not the legacy session-less path", () => {
        expect(userTurn("please merge the branch")).toBe(0);
        const sessionLedger = path.join(tmp, "agents", "state", "git-authorization", `${SESSION}.json`);
        const legacyLedger = path.join(tmp, "agents", "state", "git-authorization.json");
        expect(fs.existsSync(sessionLedger)).toBe(true);
        expect(fs.existsSync(legacyLedger)).toBe(false);
    });
});
