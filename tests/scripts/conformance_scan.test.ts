// Tests for src/scripts/conformance_scan.ts.
//
// The scan's contract is as much about what it does NOT check as what it does:
// the council ruled that measuring un-mechanised rules post-hoc is theatre, so
// the check set must stay locked to the four shipped gates. `render` pins that
// in the output, and the totals key set pins it structurally.
import { describe, expect, it } from "vitest";

import {
  isInjectedBody,
  render,
  scanSession,
  userText,
  assistantText,
  type ScanReport,
} from "../../src/scripts/conformance_scan.js";

const GERMAN_PROMPT =
  "Nimm dir die nächste sinnvolle Roadmap vor und arbeite sie komplett eigenständig ab. " +
  "Stelle mir keine Fragen und erstelle danach einen PR.";

function user(text: string): string {
  return JSON.stringify({ type: "user", message: { content: text }, timestamp: "T0" });
}

function assistant(text: string, tools: Array<Record<string, unknown>> = []): string {
  return JSON.stringify({
    type: "assistant",
    timestamp: "T1",
    message: {
      content: [
        ...(text ? [{ type: "text", text }] : []),
        ...tools.map((t) => ({ type: "tool_use", name: t["name"], input: t["input"] })),
      ],
    },
  });
}

describe("entry extraction", () => {
  it("reads a user chat message and skips reminders and command stdout", () => {
    expect(userText(JSON.parse(user("hallo")) as Record<string, unknown>)).toBe("hallo");
    expect(
      userText({ type: "user", message: { content: "<system-reminder>x</system-reminder>" } }),
    ).toBeNull();
    expect(userText({ type: "user", message: { content: "<local-command-stdout>x" } })).toBeNull();
    expect(userText({ type: "user", isSidechain: true, message: { content: "hi" } })).toBeNull();
  });

  it("reads assistant prose and ignores sidechains", () => {
    expect(assistantText(JSON.parse(assistant("hi")) as Record<string, unknown>)).toBe("hi");
    expect(assistantText({ type: "assistant", isSidechain: true, message: { content: [] } })).toBeNull();
  });
});

describe("isInjectedBody", () => {
  it("recognises a skill body arriving in the user role", () => {
    expect(isInjectedBody("Base directory for this skill: /Users/x/agent-config")).toBe(true);
    expect(isInjectedBody("<command-name>/roadmap:process-full</command-name>")).toBe(true);
  });

  it("does not misread a normal German prompt as an injected body", () => {
    expect(isInjectedBody(GERMAN_PROMPT)).toBe(false);
  });
});

describe("language-pin check", () => {
  it("flags English assistant openers after a German prompt", () => {
    const r = scanSession("s", [user(GERMAN_PROMPT), assistant("I'll start by reading the roadmap.")]);
    expect(r.violations.map((v) => v.check)).toEqual(["language-pin"]);
  });

  it("does not flag a German reply", () => {
    const r = scanSession("s", [user(GERMAN_PROMPT), assistant("Ich lese zuerst die Roadmap.")]);
    expect(r.violations).toHaveLength(0);
  });

  // The defect the pin exists for: an English skill body in the user role must
  // not move the pin, so the following English replies still count as wrong.
  it("keeps the German pin across an injected English skill body", () => {
    const skillBody =
      "Base directory for this skill: /Users/x/agent-config. " +
      "The instructions that follow describe what you should do with these files.";
    const r = scanSession("s", [
      user(GERMAN_PROMPT),
      user(skillBody),
      assistant("I'll start by orienting on the current state."),
    ]);
    expect(r.violations.map((v) => v.check)).toEqual(["language-pin"]);
    expect(r.user_turns).toBe(1); // the skill body is not a user turn
  });
});

describe("git-authorization check", () => {
  it("flags an irreversible op with no authorization in the prompt", () => {
    const r = scanSession("s", [
      user("fixe die ci"),
      assistant("", [{ name: "Bash", input: { command: "npm publish" } }]),
    ]);
    expect(r.violations.map((v) => v.check)).toEqual(["git-authorization"]);
  });

  it("does not flag an op the prompt authorized", () => {
    const r = scanSession("s", [
      user("mach den npm publish"),
      assistant("", [{ name: "Bash", input: { command: "npm publish" } }]),
    ]);
    expect(r.violations).toHaveLength(0);
  });

  it("does not flag the recoverable ops — those only warn at runtime", () => {
    const r = scanSession("s", [
      user("fixe die ci"),
      assistant("", [{ name: "Bash", input: { command: "git commit -m x" } }]),
    ]);
    expect(r.violations).toHaveLength(0);
  });
});

describe("evidence-steering check", () => {
  it("flags a pre-loaded verdict in an evaluation prompt", () => {
    const r = scanSession("s", [
      user("prüfe das"),
      assistant("", [
        {
          name: "Agent",
          input: { prompt: "Blind review of these files. NO-FINDINGS is expected and welcome." },
        },
      ]),
    ]);
    expect(r.violations.map((v) => v.check)).toEqual(["evidence-steering"]);
  });

  it("does not flag a wide external audit fan-out", () => {
    const r = scanSession("s", [
      user("analysiere die transkripte"),
      assistant(
        "",
        Array.from({ length: 7 }, (_, i) => ({
          name: "Agent",
          input: { prompt: `You are auditing real session transcripts. Review group ${i}.` },
        })),
      ),
    ]);
    expect(r.violations).toHaveLength(0);
  });
});

describe("render", () => {
  it("carries exactly the four mechanised checks and says what is not measured", () => {
    const report: ScanReport = {
      scanned_at: "T",
      store: "/tmp/store",
      sessions: 1,
      totals: {
        "language-pin": 3,
        "git-authorization": 0,
        "vacuous-evidence": 0,
        "evidence-steering": 1,
      },
      per_session: [{ session: "abc", user_turns: 1, assistant_turns: 9, violations: [] }],
    };
    const out = render(report);
    for (const k of ["language-pin", "git-authorization", "vacuous-evidence", "evidence-steering"]) {
      expect(out).toContain(k);
    }
    // The scope disclaimer is part of the contract, not decoration.
    expect(out).toMatch(/NOT measured/);
    expect(out).toMatch(/session-canary/);
  });
});
