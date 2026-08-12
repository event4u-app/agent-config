// Tests for src/scripts/hooks/evidence_independence.ts.
//
// The fixture in "blocks the exact construct that fabricated the honest-null"
// is the literal phrase from the audited session. The fan-out tests are the
// guard's own false-positive floor: the session that produced this hook
// dispatched seven analysis subagents in one turn, and none of them may be
// touched.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import { EXIT_BLOCK as DISPATCHER_BLOCK } from "../../src/scripts/hooks/dispatch_hook.js";
import {
  decide,
  extractDispatch,
  isDispatchTool,
  isEvaluationPrompt,
  isSelfScoped,
  preloadedVerdict,
  run,
  STATE_FILE,
} from "../../src/scripts/hooks/evidence_independence.js";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "evidence-"));
});

function dispatch(prompt: string, tool = "Agent"): number {
  return run(
    JSON.stringify({
      event: "pre_tool_use",
      session_id: "s1",
      turn_id: "t1",
      payload: { tool_name: tool, tool_input: { prompt } },
    }),
    { consumer_root: tmp },
  );
}

describe("shape detection", () => {
  it("recognises subagent-dispatch tools", () => {
    expect(isDispatchTool("Agent")).toBe(true);
    expect(isDispatchTool("Task")).toBe(true);
    expect(isDispatchTool("Bash")).toBe(false);
    expect(isDispatchTool(null)).toBe(false);
  });

  it("recognises an evaluation prompt", () => {
    expect(isEvaluationPrompt("Run a blind review of the delta on this branch.")).toBe(true);
    expect(isEvaluationPrompt("Audit these files for security defects.")).toBe(true);
    expect(isEvaluationPrompt("Find any bugs in my implementation of the parser.")).toBe(true);
  });

  it("does NOT treat ordinary fan-out as an evaluation", () => {
    for (const p of [
      "Read these five transcript digests and summarise the failure classes.",
      "Map every call site of `resolve_settings` and report file:line.",
      "Write the migration for the new column.",
    ]) {
      expect(isEvaluationPrompt(p), p).toBe(false);
    }
  });
});

describe("preloadedVerdict", () => {
  it("catches the literal phrase from the audited session", () => {
    expect(preloadedVerdict("NO-FINDINGS is expected and welcome for this scope.")).not.toBeNull();
  });

  it("catches the common softeners", () => {
    for (const p of [
      "You should find nothing, but check anyway.",
      "Please confirm that there are no issues with this diff.",
      "I believe this is clean — verify the work.",
      "Just confirm the change is right.",
      "It's probably fine, but take a look.",
    ]) {
      expect(preloadedVerdict(p), p).not.toBeNull();
    }
  });

  it("does not fire on a neutral prompt", () => {
    expect(
      preloadedVerdict("Review this diff adversarially and report every finding with file:line."),
    ).toBeNull();
  });
});

describe("decide", () => {
  it("warns on the first evaluation and names both observed failure shapes", () => {
    const d = decide("Agent", "Review my diff and report findings.", 0);
    expect(d.exit).toBe(0);
    const out = JSON.parse(d.stdout);
    expect(out.decision).toBe("warn");
    expect(out.reason).toMatch(/pre-loaded/);
    expect(out.reason).toMatch(/scope narrowed/);
    expect(d.evaluations).toBe(1);
  });

  it("blocks the exact construct that fabricated the honest-null", () => {
    const d = decide(
      "Agent",
      "Do a blind review of these four files. NO-FINDINGS is expected and welcome.",
      0,
    );
    expect(d.exit).toBe(DISPATCHER_BLOCK);
    expect(d.stderr).toMatch(/pre-loads its verdict/);
  });

  // Severity decision (council anthropic + openai, 2026-08-12, quorum 2/2; tier
  // rule in docs/contracts/hook-architecture-v1.md): this branch decides from
  // PROSE ALONE — both `isEvaluationPrompt` and `isSelfScoped` infer intent from
  // a natural-language prompt with nothing structured to corroborate them. That
  // is Tier 3, and Tier 3 warns. It blocked until a 16-way implementation fan-out
  // lost 15 workers to it.
  it("WARNS on a second evaluation of my own work — prose alone may not block", () => {
    const d = decide("Agent", "Audit my change again with a wider scope.", 1);
    expect(d.exit).toBe(0);
    const out = JSON.parse(d.stdout);
    expect(out.decision).toBe("warn");
    expect(out.reason).toMatch(/verdict shopping/);
  });

  // The literal steering formulation is NOT downgraded: it matches the violation
  // itself rather than evidence of one, so it keeps blocking.
  it("still BLOCKS a pre-loaded verdict, at any prior count", () => {
    for (const prior of [0, 1, 5]) {
      const d = decide("Agent", "Review my diff. NO-FINDINGS is expected and welcome.", prior);
      expect(d.exit).toBe(DISPATCHER_BLOCK);
    }
  });

  // Caught by the conformance scan against real data: the audit session that
  // built this hook dispatched seven subagents opening "You are auditing real
  // Claude Code session transcripts…". `audit` matches the evaluation pattern,
  // so six were flagged as verdict shopping — the exact false positive the
  // hook claims to avoid. Auditing thirty transcripts is not reviewing your own
  // diff twice, so the second-dispatch block now requires a self-reference.
  it("does not treat repeated evaluation of an EXTERNAL artifact as shopping", () => {
    const external = "You are auditing real Claude Code session transcripts. Review group 3.";
    expect(isEvaluationPrompt(external)).toBe(true);
    expect(isSelfScoped(external)).toBe(false);
    for (const prior of [0, 1, 6]) {
      expect(decide("Agent", external, prior).exit).toBe(0);
    }
  });

  // Cross-project session audit, 2026-08-12. `road-to-release-truth/fc1ff181`
  // turn 3 dispatched a 16-way fan-out of IMPLEMENTATION workers ("Harden gates
  // batch A", "Phase 2 wave 1 batch 0", …). All 16 were classified as
  // evaluations — `review` / `audit` / `check` are unavoidable in a prompt about
  // gate scripts — and 15 as self-scoped, every one of them on the single phrase
  // `this branch`. In context that phrase reads "two conversions already landed
  // on this branch in exactly the style you should match": it names WHERE the
  // work happens, not a subject a verdict is being shopped for. On a hook-bound
  // host that fan-out loses 15 of its 16 workers, which is precisely what
  // `evaluator-independence` § "When it does NOT fire" promises it will not do:
  // "Dispatching many subagents to read, map, search, or IMPLEMENT is not
  // evaluation and is not gated."
  const FAN_OUT_PROMPT =
    "Work in `/…/worktrees/road-to-release-truth` (branch `feat/road-to-gate-hardening-adoption`). " +
    "Each is a gate that walks a corpus and exits 0/1. If its root moved or emptied it scans zero " +
    "units and still exits 0 — a believed green over nothing. Add the assertion that makes that loud. " +
    "Read first: two conversions already landed on this branch in exactly the style you should match. " +
    "Then review your own diff against the checklist before you report back.";

  it("does not treat a worktree implementation fan-out as verdict shopping", () => {
    // The location phrase alone must not make a prompt self-scoped.
    expect(isSelfScoped(FAN_OUT_PROMPT)).toBe(false);
    // …so no dispatch in the fan-out is ever blocked, at any prior count.
    for (const prior of [0, 1, 14]) {
      expect(decide("Agent", FAN_OUT_PROMPT, prior).exit).toBe(0);
    }
  });

  it("keeps `this branch` inert on its own but blocks a named self-subject", () => {
    expect(isSelfScoped("Convert the five gates on this branch to assert scope.")).toBe(false);
    // The subject, not the location, is what makes shopping possible.
    expect(isSelfScoped("Review my diff on this branch once more.")).toBe(true);
  });

  it("never touches a non-evaluation dispatch, at any count", () => {
    for (const prior of [0, 1, 6]) {
      const d = decide("Agent", "Summarise these transcript digests.", prior);
      expect(d.exit).toBe(0);
      expect(d.stdout).toBe("");
    }
  });

  it("never touches a non-dispatch tool", () => {
    expect(decide("Bash", "review this diff", 0).exit).toBe(0);
  });
});

describe("end to end", () => {
  // The guard's false-positive floor, taken from the session that built it.
  it("allows a seven-way analysis fan-out untouched", () => {
    for (let i = 0; i < 7; i += 1) {
      expect(dispatch(`Read digest group ${i} and report the rule violations you find.`)).toBe(0);
    }
    expect(fs.existsSync(path.join(tmp, STATE_FILE))).toBe(false);
  });

  it("warns on both the first and the second self-review, and blocks neither", () => {
    expect(dispatch("Review my change and report findings.")).toBe(0);
    expect(dispatch("Review this diff again, this time only src/scripts/.")).toBe(0);
  });

  it("blocks a pre-loaded verdict end to end, even as the first dispatch", () => {
    expect(dispatch("Review these four files. NO-FINDINGS is expected and welcome.")).toBe(
      DISPATCHER_BLOCK,
    );
  });

  it("resets the evaluation count when a new user turn rewrites the ledger", () => {
    // Round-2 fix: the previous version injected `turn_id: "t2"`, a field the
    // production envelope never carries — it passed only for a shape that does
    // not occur, while the real counter was session-scoped. The turn marker is
    // now the authorization ledger's `detected_at`, which
    // git_authorization_hook rewrites on every user_prompt_submit.
    const ledger = path.join(tmp, "agents", "state", "git-authorization.json");
    fs.mkdirSync(path.dirname(ledger), { recursive: true });

    // The counter, not the exit code, is what this test is about: since the
    // second-dispatch branch became advisory (Tier 3), every dispatch here exits
    // 0 and the block is no longer available as a proxy for "the count reached 1".
    const count = (): number => {
      const p = path.join(tmp, STATE_FILE);
      if (!fs.existsSync(p)) return 0;
      const s = JSON.parse(fs.readFileSync(p, "utf8")) as { evaluations?: unknown[] };
      return Array.isArray(s.evaluations) ? s.evaluations.length : 0;
    };

    fs.writeFileSync(ledger, JSON.stringify({ detected_at: "2026-08-06T10:00:00Z", authorized: [] }));
    expect(dispatch("Review my change and report findings.")).toBe(0);
    expect(count()).toBe(1);
    expect(dispatch("Review my change again, wider scope.")).toBe(0);
    expect(count()).toBe(2);

    // A new user turn moves the stamp, so the counter starts over.
    fs.writeFileSync(ledger, JSON.stringify({ detected_at: "2026-08-06T10:05:00Z", authorized: [] }));
    expect(dispatch("Review my change and report findings.")).toBe(0);
    expect(count()).toBe(1);
  });


  it("is a clean no-op on a malformed envelope", () => {
    expect(run("{not json", { consumer_root: tmp })).toBe(0);
  });

  it("extractDispatch reads the prompt out of the tool input", () => {
    const [tool, prompt] = extractDispatch({
      payload: { tool_name: "Agent", tool_input: { prompt: "hello" } },
    });
    expect(tool).toBe("Agent");
    expect(prompt).toBe("hello");
  });
});
