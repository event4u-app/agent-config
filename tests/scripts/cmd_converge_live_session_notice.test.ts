/**
 * Live-session notice after a Claude plugin-cache reap
 * (cmd_converge — 2026-07-08 fix).
 *
 * Regression: `agent-config upgrade` → converge uninstalled + reaped the
 * pre-shim plugin cache while a Claude Code session was running; the live
 * session kept the plugin's hook registrations and logged
 * `Failed to run: Plugin directory does not exist: …/plugins/cache/… — run
 * /plugin to reinstall` on EVERY event, and Claude Code's own reinstall
 * hint would have recreated the duplicate surface. Converge must surface
 * the correct remedy (restart sessions, do NOT reinstall) whenever a reap
 * removed a path under `~/.claude/plugins/`.
 */
import { describe, expect, it } from "vitest";

import { live_session_notice } from "../../src/scripts/_cli/cmd_converge.js";

describe("live_session_notice", () => {
    it("fires when a Claude plugin cache path was reaped", () => {
        const notice = live_session_notice([
            "~/.claude/plugins/cache/event4u-agent-config",
        ]);
        expect(notice).not.toBeNull();
        expect(notice).toContain("Plugin directory does not exist");
        expect(notice).toContain("restart Claude Code");
        // The counter-hint against Claude Code's own misleading suggestion:
        expect(notice).toContain('Do NOT follow the error\'s "/plugin to reinstall"');
    });

    it("stays silent when no reap touched ~/.claude/plugins/", () => {
        expect(live_session_notice([])).toBeNull();
        expect(live_session_notice(["~/.augment/some-orphan"])).toBeNull();
    });

    it("fires for any future plugin-cache reap path, not just the current id", () => {
        expect(
            live_session_notice(["~/.claude/plugins/cache/some-other-marketplace"]),
        ).not.toBeNull();
    });
});
