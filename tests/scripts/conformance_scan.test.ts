// Tests for src/scripts/conformance_scan.ts.
//
// The scan's contract is as much about what it does NOT check as what it does:
// the council ruled that measuring un-mechanised rules post-hoc is theatre, so
// the check set must stay locked to the four shipped gates. `render` pins that
// in the output, and the totals key set pins it structurally.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  BAND_MIN_TURNS,
  bandVerdict,
  DEFAULT_RATE_SERIES,
  isInjectedBody,
  measureDelivered,
  recordRate,
  render,
  renderWhy,
  CHECK_IDS,
  CHECK_MEANINGS,
  scanSession,
  storeKey,
  userText,
  assistantText,
  type RateRecord,
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
      delivered: {
        project: { dir: "/tmp/p", present: true, files: 2, tokens: 100 },
        global: { dir: "/tmp/g", present: true, files: 3, tokens: 200 },
        union_tokens: 300,
      },
      rate: {
        store_key: "deadbeefcafe",
        sessions: 1,
        assistant_turns: 9,
        language_pin: 3,
        rate_pct: 33.3,
        band: "corpus-too-small",
        delivered_project_tokens: 100,
        delivered_global_tokens: 200,
      },
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

// ── Delivered payload + forward capture (round-6 Phase 4.3 / 4.5) ───────────
//
// Two properties matter more than the numbers. The payload figure must be
// labelled a scan-time reading, because the step asked for a per-session one and
// the transcript cannot supply it. And the forward series must be incapable of
// carrying a project path: `store_key` is a digest precisely because the real
// store slug is `-Users-<realname>-projects-<client>-…`.

const tmps: string[] = [];

function tmp(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "conf-scan-"));
  tmps.push(d);
  return d;
}

afterEach(() => {
  while (tmps.length) {
    fs.rmSync(tmps.pop() as string, { recursive: true, force: true });
  }
});

describe("measureDelivered", () => {
  it("counts each carrier separately and sums the union", () => {
    const root = tmp();
    const p = path.join(root, "project");
    const g = path.join(root, "global");
    fs.mkdirSync(p);
    fs.mkdirSync(g);
    fs.writeFileSync(path.join(p, "a.md"), "x".repeat(400), "utf8");
    fs.writeFileSync(path.join(g, "a.md"), "y".repeat(800), "utf8");
    fs.writeFileSync(path.join(g, "b.md"), "z".repeat(400), "utf8");
    // Not a rule — must not be counted by either carrier.
    fs.writeFileSync(path.join(g, "notes.txt"), "q".repeat(4000), "utf8");

    const d = measureDelivered(p, g);
    expect(d.project).toMatchObject({ files: 1, tokens: 100 });
    expect(d.global).toMatchObject({ files: 2, tokens: 300 });
    expect(d.union_tokens).toBe(400);
  });

  it("reports an absent carrier as zero rather than throwing", () => {
    const root = tmp();
    const d = measureDelivered(path.join(root, "nope"), path.join(root, "also-nope"));
    expect(d.union_tokens).toBe(0);
  });

  it("follows a symlinked entry to the bytes the host actually reads", () => {
    // A project-scope rule tree is symlinks into dist/. lstat would report ~50
    // bytes per rule and make the whole payload vanish.
    const root = tmp();
    const target = path.join(root, "real.md");
    const p = path.join(root, "project");
    fs.mkdirSync(p);
    fs.writeFileSync(target, "x".repeat(4000), "utf8");
    fs.symlinkSync(target, path.join(p, "linked.md"));

    expect(measureDelivered(p, path.join(root, "nope")).project.tokens).toBe(1000);
  });
});

describe("storeKey", () => {
  it("leaks no part of the path it keys", () => {
    const key = storeKey("/Users/realname/.claude/projects/-Users-realname-projects-acme-client");
    expect(key).toMatch(/^[0-9a-f]{12}$/);
    for (const leak of ["realname", "acme", "Users", "projects"]) {
      expect(key).not.toContain(leak);
    }
  });

  it("is stable for the same store and different across stores", () => {
    expect(storeKey("/a/b")).toBe(storeKey("/a/b"));
    expect(storeKey("/a/b")).not.toBe(storeKey("/a/c"));
  });

  it("keys the resolved path, so two spellings of one store do not split the series", () => {
    expect(storeKey("/a/b")).toBe(storeKey("/a/./b"));
  });
});

describe("bandVerdict", () => {
  it("refuses a verdict below the smallest corpus the band came from", () => {
    // The instrument's own first run: 4.1% over 606 turns would have announced
    // the falsifier on its second day of existence.
    expect(bandVerdict(4.1, 606)).toBe("corpus-too-small");
    expect(bandVerdict(26.7, BAND_MIN_TURNS - 1)).toBe("corpus-too-small");
  });

  it("reproduces M5's own reading for this package as inside the band", () => {
    expect(bandVerdict(26.7, 2193)).toBe("inside");
  });

  it("fires outside the band in both directions on a comparable corpus", () => {
    expect(bandVerdict(4.1, 3000)).toBe("outside");
    expect(bandVerdict(55.0, 3000)).toBe("outside");
  });

  it("treats the band edges as inside, since they are observed values not thresholds", () => {
    expect(bandVerdict(9.1, 3000)).toBe("inside");
    expect(bandVerdict(39.2, 3000)).toBe("inside");
  });
});

describe("recordRate", () => {
  const rate: RateRecord = {
    store_key: "0123456789ab",
    sessions: 27,
    assistant_turns: 2193,
    language_pin: 585,
    rate_pct: 26.7,
    band: "inside",
    delivered_project_tokens: 101626,
    delivered_global_tokens: 102402,
  };

  it("appends one line per run and creates the directory", () => {
    const file = path.join(tmp(), "nested", "series.jsonl");
    recordRate(file, "T1", rate);
    recordRate(file, "T2", rate);
    const lines = fs.readFileSync(file, "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0] as string)).toMatchObject({ measured_at: "T1", store_key: "0123456789ab" });
  });

  it("writes no field capable of holding a path, a prompt, or a session id", () => {
    const file = path.join(tmp(), "series.jsonl");
    recordRate(file, "T", rate);
    const rec = JSON.parse(fs.readFileSync(file, "utf8").trim()) as Record<string, unknown>;
    expect(Object.keys(rec).sort()).toEqual(
      [
        "assistant_turns",
        "band",
        "delivered_global_tokens",
        "delivered_project_tokens",
        "language_pin",
        "measured_at",
        "rate_pct",
        "sessions",
        "store_key",
      ].sort(),
    );
    // Privacy is a property of the schema shape, not of a scrubbing pass that
    // could fail — so the assertion is on the key set, exhaustively.
    for (const v of Object.values(rec)) {
      expect(typeof v === "string" || typeof v === "number").toBe(true);
    }
  });
});

describe("render — the payload block", () => {
  function reportWith(band: RateRecord["band"], turns: number): ScanReport {
    return {
      scanned_at: "T",
      store: "/tmp/store",
      sessions: 1,
      totals: { "language-pin": 1, "git-authorization": 0, "vacuous-evidence": 0, "evidence-steering": 0 },
      per_session: [{ session: "abc", user_turns: 1, assistant_turns: turns, violations: [] }],
      delivered: {
        project: { dir: "/tmp/p", present: true, files: 110, tokens: 101626 },
        global: { dir: "/tmp/g", present: true, files: 112, tokens: 102402 },
        union_tokens: 204027,
      },
      rate: {
        store_key: "aaaaaaaaaaaa",
        sessions: 1,
        assistant_turns: turns,
        language_pin: 1,
        rate_pct: 1,
        band,
        delivered_project_tokens: 101626,
        delivered_global_tokens: 102402,
      },
    };
  }

  it("labels the payload a scan-time reading, never a per-session one", () => {
    const out = render(reportWith("inside", 3000));
    expect(out).toMatch(/not per-session/);
    expect(out).toMatch(/NOT recoverable/);
  });

  it("names the worktree confound only when it actually reports out-of-band", () => {
    expect(render(reportWith("outside", 3000))).toMatch(/Store novelty is not project novelty/);
    // On an in-band run the caveat is noise; on a too-small corpus there is no
    // claim to caveat.
    expect(render(reportWith("inside", 3000))).not.toMatch(/Store novelty/);
    expect(render(reportWith("corpus-too-small", 606))).not.toMatch(/Store novelty/);
  });
});

// ── One trigger definition, both directions (round-6 Phase 2.1) ─────────────
//
// Round 6's third acceptance criterion asks for a shared import AND "a test that
// feeds both the same input". The import half was already true — `hook` and
// `scanner` both take `isSyntheticPrompt` from `_lib/prompt_shape.ts`. This is
// the other half: one entry, both surfaces, asserted to agree. Without it the
// criterion rests on a code reading, and a shared import can still be bypassed
// on one side by an earlier branch.
describe("hook and scanner classify the same entry identically", () => {
  const SYNTHETIC =
    "[SYSTEM NOTIFICATION - NOT USER INPUT]\n" +
    "This is an automated background-task event, NOT a message from the user.";

  it("agrees that a harness-generated turn is synthetic and is not a user turn", async () => {
    const { isSyntheticPrompt } = await import("../../src/scripts/language_mirror_hook.js");
    const { isSyntheticPrompt: fromLib } = await import("../../src/scripts/_lib/prompt_shape.js");

    // Same function, reached through the two surfaces that must not diverge.
    expect(isSyntheticPrompt).toBe(fromLib);
    expect(isSyntheticPrompt(SYNTHETIC)).toBe(true);

    // And the scanner acts on that verdict: the entry does not become a user
    // turn, so it cannot move the language pin. This is the +45 correction of
    // § 2.4 — before it, such a turn set `pinned = "en"` and every English reply
    // after it counted as CONFORMING.
    const r = scanSession("s", [
      user(GERMAN_PROMPT),
      user(SYNTHETIC),
      assistant("I'll start by reading the roadmap."),
    ]);
    expect(r.user_turns).toBe(1);
    expect(r.violations.map((v) => v.check)).toEqual(["language-pin"]);
  });

  it("agrees that a genuine German prompt is NOT synthetic", async () => {
    const { isSyntheticPrompt } = await import("../../src/scripts/language_mirror_hook.js");
    expect(isSyntheticPrompt(GERMAN_PROMPT)).toBe(false);
    expect(scanSession("s", [user(GERMAN_PROMPT), assistant("Ich lese die Roadmap.")]).user_turns).toBe(1);
  });
});

// ── R2 completion-review repairs (2026-08-08) ──────────────────────────────

describe("rate_pct and band cannot contradict each other", () => {
  it("derives the band from the value that is published, not from an unrounded one", () => {
    // A raw 9.0588…% used to persist rate_pct: 9.1 beside band: "outside", and
    // print "9.1%" directly above "OUTSIDE the 9.1-39.2% band". The band verdict
    // IS the declared falsifier for the cancelled volume test, so a rounding
    // artefact could announce a fourth out-of-band project.
    const raw = (100 * 181) / 2000; // 9.05
    expect(Number(raw.toFixed(1))).toBe(9.1);
    expect(bandVerdict(Number(raw.toFixed(1)), 2000)).toBe("inside");
    // The unrounded value is what used to be compared, and it disagrees.
    expect(bandVerdict(raw, 2000)).toBe("outside");
  });
});

describe("measureDelivered — absent is not a measured zero", () => {
  it("marks a carrier absent rather than reporting 0 tokens for it", () => {
    const root = tmp();
    const p = path.join(root, "project");
    fs.mkdirSync(p);
    fs.writeFileSync(path.join(p, "a.md"), "x".repeat(400), "utf8");

    const d = measureDelivered(p, path.join(root, "no-global"));
    expect(d.project).toMatchObject({ present: true, tokens: 100 });
    expect(d.global).toMatchObject({ present: false, files: 0, tokens: 0 });
  });

  it("says ABSENT in the report instead of printing a zero row", () => {
    const root = tmp();
    const report = {
      scanned_at: "T",
      store: "/tmp/s",
      sessions: 1,
      totals: { "language-pin": 0, "git-authorization": 0, "vacuous-evidence": 0, "evidence-steering": 0 },
      per_session: [{ session: "a", user_turns: 1, assistant_turns: 3000, violations: [] }],
      delivered: measureDelivered(path.join(root, "nope"), path.join(root, "also-nope")),
      rate: {
        store_key: "aaaaaaaaaaaa",
        sessions: 1,
        assistant_turns: 3000,
        language_pin: 0,
        rate_pct: 0,
        band: "outside" as const,
        delivered_project_tokens: 0,
        delivered_global_tokens: 0,
      },
    };
    expect(render(report)).toMatch(/ABSENT — not a measured zero/);
  });
});

describe("DEFAULT_RATE_SERIES", () => {
  it("is absolute, so --record lands in the ignored tree from any cwd", () => {
    // Relative, it created a fresh agents/runtime/state/ subtree wherever the
    // process happened to start — outside the ignore rule the docstring cites,
    // and splitting a series whose whole purpose is comparability.
    expect(path.isAbsolute(DEFAULT_RATE_SERIES)).toBe(true);
    expect(DEFAULT_RATE_SERIES.endsWith(path.join("agents", "runtime", "state", "conformance-rates.jsonl"))).toBe(true);
  });
});

describe("renderWhy — conformance:why <id>", () => {
  function reportWithHits(hits: ScanReport["per_session"][number]["violations"]): ScanReport {
    return {
      scanned_at: "T",
      store: "/tmp/store",
      sessions: 2,
      totals: {
        "language-pin": 0,
        "git-authorization": 0,
        "vacuous-evidence": 0,
        "evidence-steering": 0,
      },
      per_session: [{ session: "abc", user_turns: 1, assistant_turns: 9, violations: hits }],
      delivered: {
        project: { dir: "/tmp/p", present: true, files: 2, tokens: 100 },
        global: { dir: "/tmp/g", present: true, files: 3, tokens: 200 },
        union_tokens: 300,
      },
      rate: {
        store_key: "deadbeefcafe",
        sessions: 2,
        assistant_turns: 9,
        language_pin: 0,
        rate_pct: 0,
        band: "corpus-too-small",
        delivered_project_tokens: 100,
        delivered_global_tokens: 200,
      },
    };
  }

  it("every check id carries a meaning — a count with no definition is the failure", () => {
    for (const id of CHECK_IDS) {
      expect(CHECK_MEANINGS[id]).toBeTruthy();
      expect(CHECK_MEANINGS[id].length).toBeGreaterThan(40);
    }
  });

  it("a check that did not fire prints as a MEASURED zero, never as silence", () => {
    const out = renderWhy(reportWithHits([]), "vacuous-evidence");
    expect(out).toContain("Did NOT fire in this window (0 hits over 2 session(s))");
    expect(out).toContain("measured zero, not an unmeasured one");
    expect(out).toContain(CHECK_MEANINGS["vacuous-evidence"]);
  });

  it("hits carry session, detail, and the language-pin provenance split", () => {
    const out = renderWhy(
      reportWithHits([
        {
          check: "language-pin",
          session: "abc",
          at: "2026-08-11T00:00:00Z",
          detail: "replied in en under a de pin",
          turns_since_prompt: 4,
          compaction_since_prompt: true,
        },
      ]),
      "language-pin",
    );
    expect(out).toContain("Fired 1 time(s)");
    expect(out).toContain("abc @ 2026-08-11T00:00:00Z");
    expect(out).toContain("replied in en under a de pin");
    // The absent-vs-ignored split is the whole reason the provenance exists.
    expect(out).toContain("turns_since_prompt=4");
    expect(out).toContain("compaction_since_prompt=true");
  });

  it("filters to the asked-for id and does not leak a sibling check's hits", () => {
    const report = reportWithHits([
      { check: "language-pin", session: "abc", at: "T1", detail: "pin miss" },
      { check: "git-authorization", session: "abc", at: "T2", detail: "unauthorized push" },
    ]);
    const out = renderWhy(report, "git-authorization");
    expect(out).toContain("unauthorized push");
    expect(out).not.toContain("pin miss");
    expect(out).toContain("Fired 1 time(s)");
  });
});
