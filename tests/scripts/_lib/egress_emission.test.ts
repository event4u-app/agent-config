/**
 * Placeholders 3.1 and 3.3: the one writer of a tool-output rewrite, and the
 * checks that stop it from trusting the host's silence. Fixtures are built at
 * runtime so no credential literal sits in this file.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  emitEgress,
  planPromptGate,
  STAGE_WITHHELD_MARKER,
  promptResidueLine,
  PROMPT_DEADLINE_MS,
  planToolOutputRewrite,
  REWRITE_DEADLINE_MS,
  REWRITE_FILE,
  rewriteWithheldNotice,
  sameShape,
  TOKEN_EXPLAINER,
  type RewriteDeps,
} from "../../../src/scripts/_lib/egress_emission.js";
import { EGRESS_STAGE_KILL_SWITCH, runEgressStage, WITHHELD_MARKER, type EgressMode } from "../../../src/scripts/hooks/egress_stage.js";
import { surfaceRow } from "../../../src/scripts/hooks/host_lowering.js";
import type { JsonObject, JsonValue } from "../../../src/scripts/hooks/payload_stub.js";
import type { resolveRewriteCapability } from "../../../src/scripts/_lib/rewrite_capability.js";

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "..", "..", "..", "..");
const ALNUM = "Ab3Cd5Ef7Gh9Jk2Lm4Np6Qr8St1Uv3Wx5Yz7";
const PLANTED = ["ghp", ALNUM.slice(0, 36)].join("_");
const PEM_HEADER_ONLY = `-----BEGIN ${["RSA", "PRIVATE", "KEY"].join(" ")}-----\nAAAA`;

let tmp: string;
const savedSwitch = process.env[EGRESS_STAGE_KILL_SWITCH];
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "egress-rewrite-"));
  delete process.env[EGRESS_STAGE_KILL_SWITCH];
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  if (savedSwitch === undefined) delete process.env[EGRESS_STAGE_KILL_SWITCH];
  else process.env[EGRESS_STAGE_KILL_SWITCH] = savedSwitch;
});

/** The tool_response shapes the 0.1 probe and the 1.3 readings recorded, each carrying the planted value. */
const SHAPES = {
  Bash: () => ({ stdout: `export TOKEN=${PLANTED}\n`, stderr: "", interrupted: false, isImage: false, noOutputExpected: false }),
  Read: () => ({
    type: "text",
    file: { filePath: "/w/.env.example", content: `TOKEN=${PLANTED}\n`, numLines: 1, startLine: 1, totalLines: 1 },
  }),
  Grep: () => ({ mode: "content", numFiles: 1, filenames: [], content: `cfg.txt:1:token ${PLANTED}`, numLines: 1 }),
  mcp__probe__echo: () => [{ type: "text", text: `value ${PLANTED}` }],
} satisfies Record<string, () => JsonValue>;

function postToolUse(tool: string, response: JsonValue): JsonObject {
  return {
    schema_version: 1,
    platform: "claude",
    event: "post_tool_use",
    workspace_root: tmp,
    payload: { tool_name: tool, tool_input: { x: "y" }, tool_response: response },
    settings: {},
  };
}

const replaceCap = (() => ({ ok: true, capability: { mode: "replace" } })) as unknown as typeof resolveRewriteCapability;
const noCap = (() => ({ ok: false, gaps: ["none"] })) as unknown as typeof resolveRewriteCapability;
const deps = (over: Partial<RewriteDeps> = {}): RewriteDeps => ({ packageRoot: REPO_ROOT, row: surfaceRow("claude"), capability: replaceCap, ...over });
const stage = (env: JsonObject, mode: EgressMode) => runEgressStage(env, () => mode);
const NATIVE: Record<string, string> = { post_tool_use: "PostToolUse", user_prompt_submit: "UserPromptSubmit" };
/** The host emission as the dispatcher would write it on Claude Code. */
function emitFor(_platform: string, event: string, severity: string, reasons: string[], _rc: number, _perm: null, e: Parameters<typeof emitEgress>[0] | undefined) {
  const r = emitEgress(e ?? null, { event, severity, reason: reasons.join(" · "), blockExit: event === "user_prompt_submit" ? 2 : null, hookEventName: NATIVE[event] ?? event });
  return r ?? { exit: 0, stdout: "{}", stderr: "" };
}
/** The real resolver against the committed table, the way the stage glue calls it. */
const real = (platform = "claude"): RewriteDeps => ({ packageRoot: REPO_ROOT, row: surfaceRow(platform) });

function keysAndTypes(v: JsonValue): JsonValue {
  if (Array.isArray(v)) return v.map(keysAndTypes);
  if (v !== null && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, keysAndTypes(x as JsonValue)]));
  return v === null ? "null" : typeof v;
}

describe("3.1 — updatedToolOutput carries the original object with string leaves replaced", () => {
  for (const [tool, make] of Object.entries(SHAPES)) {
    it(`${tool}: keys and types of the emitted value equal those of the input, and the value is gone`, () => {
      const env = postToolUse(tool, make());
      const r = planToolOutputRewrite(env, stage(env, "protect"), deps());
      expect(r?.outcome).toBe("emitted");
      if (r?.outcome !== "emitted") return;
      expect(keysAndTypes(r.value)).toEqual(keysAndTypes(make()));
      expect(JSON.stringify(r.value)).not.toContain(PLANTED);
      expect(r.field).toBe(tool.startsWith("mcp__") ? "updatedMCPToolOutput" : "updatedToolOutput");
    });
  }

  it("arms only in protect or strict, never in observe or off", () => {
    const env = postToolUse("Bash", SHAPES.Bash());
    expect(planToolOutputRewrite(env, stage(env, "observe"), deps())).toBeNull();
    expect(planToolOutputRewrite(env, stage(env, "off"), deps())).toBeNull();
    expect(planToolOutputRewrite(env, stage(env, "strict"), deps())?.outcome).toBe("emitted");
  });

  it("decides nothing for a result with no listed value or for another event", () => {
    const clean = postToolUse("Bash", { stdout: "ok", stderr: "" });
    expect(planToolOutputRewrite(clean, stage(clean, "protect"), deps())).toBeNull();
    const pre = { ...postToolUse("Bash", SHAPES.Bash()), event: "pre_tool_use" };
    expect(planToolOutputRewrite(pre, stage(pre, "protect"), deps())).toBeNull();
  });

  it("the committed lowering table grants output on claude from its probe record, and nothing on a host with none", () => {
    const env = postToolUse("Bash", SHAPES.Bash());
    expect(planToolOutputRewrite(env, stage(env, "protect"), real())?.outcome).toBe("emitted");
    const cursor = { ...env, platform: "cursor" };
    expect(planToolOutputRewrite(cursor, stage(cursor, "protect"), real("cursor"))).toMatchObject({
      outcome: "withheld",
      reason: "no-capability",
    });
  });

  it("emitFor puts the replaced value in the host field, and a block outranks it", () => {
    const env = postToolUse("Bash", SHAPES.Bash());
    const r = planToolOutputRewrite(env, stage(env, "protect"), deps());
    const ok = JSON.parse(emitFor("claude", "post_tool_use", "allow", [], 0, null, r).stdout);
    expect(ok.hookSpecificOutput.hookEventName).toBe("PostToolUse");
    expect(JSON.stringify(ok.hookSpecificOutput.updatedToolOutput)).not.toContain(PLANTED);
    const blocked = JSON.parse(emitFor("claude", "post_tool_use", "block", ["no"], 1, null, r).stdout);
    expect(blocked.hookSpecificOutput.updatedToolOutput).toBeUndefined();
    expect(blocked.systemMessage).toMatch(/reached the model unreplaced/);
  });
});

describe("3.3 — the stage refuses to trust the host's silence", () => {
  it("a forced shape mismatch emits no rewrite, raises the visible message and is counted", () => {
    const env = postToolUse("Bash", SHAPES.Bash());
    const s = stage(env, "protect");
    const placeholder = s.placeholder as JsonObject;
    const forced = { ...s, placeholder: { ...placeholder, payload: { ...(placeholder["payload"] as JsonObject), tool_response: "flattened" } } };
    const r = planToolOutputRewrite(env, forced, deps());
    expect(r).toMatchObject({ outcome: "withheld", reason: "shape-mismatch" });
    const out = JSON.parse(emitFor("claude", "post_tool_use", "allow", [], 0, null, r).stdout);
    expect(out.hookSpecificOutput.updatedToolOutput).toBeUndefined();
    expect(out.systemMessage).toBe(rewriteWithheldNotice(r!));
    expect(out.systemMessage).not.toContain(PLANTED);
    const lines = fs.readFileSync(path.join(tmp, REWRITE_FILE), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(lines.at(-1)).toMatchObject({ outcome: "withheld", reason: "shape-mismatch", tool: "Bash" });
    expect(JSON.stringify(lines)).not.toContain(PLANTED);
  });

  it("a value whose extent cannot be proven is withheld, never partly replaced", () => {
    const env = postToolUse("Bash", { stdout: PEM_HEADER_ONLY, stderr: "" });
    expect(planToolOutputRewrite(env, stage(env, "protect"), deps())).toMatchObject({ outcome: "withheld", reason: "extent-unproven" });
  });

  it("a residual listed value after replacement is withheld", () => {
    const env = postToolUse("Bash", SHAPES.Bash());
    const s = stage(env, "protect");
    const r = planToolOutputRewrite(env, { ...s, placeholder: env }, deps());
    expect(r).toMatchObject({ outcome: "withheld", reason: "residual-hit" });
  });

  it("a deadline breach is withheld", () => {
    const env = postToolUse("Bash", SHAPES.Bash());
    let t = 0;
    const now = () => (t += REWRITE_DEADLINE_MS + 1);
    expect(planToolOutputRewrite(env, stage(env, "protect"), deps({ now }))).toMatchObject({ outcome: "withheld", reason: "deadline" });
  });

  it("an internal error is withheld, and a missing capability too", () => {
    const env = postToolUse("Bash", SHAPES.Bash());
    const boom = (() => {
      throw new Error("x");
    }) as unknown as typeof resolveRewriteCapability;
    expect(planToolOutputRewrite(env, stage(env, "protect"), deps({ capability: boom }))).toMatchObject({ reason: "stage-error" });
    expect(planToolOutputRewrite(env, stage(env, "protect"), deps({ capability: noCap }))).toMatchObject({ reason: "no-capability" });
  });

  it("sameShape refuses reordered keys, a changed type and a different array length", () => {
    expect(sameShape({ a: "1", b: 2 }, { a: "x", b: 3 })).toBe(true);
    expect(sameShape({ a: "1", b: 2 }, { b: 2, a: "1" })).toBe(false);
    expect(sameShape({ a: "1" }, { a: 1 })).toBe(false);
    expect(sameShape(["a"], ["a", "b"])).toBe(false);
  });
});

describe("5.1 and 5.2 — a prompt carrying a credential is refused with a redacted copy and its residue", () => {
  const TYPED = ["sk", "ant", "api03", ALNUM + ALNUM.slice(0, 10)].join("-");
  function prompt(platform = "claude"): JsonObject {
    return {
      schema_version: 1,
      platform,
      event: "user_prompt_submit",
      workspace_root: tmp,
      payload: { session_id: "s", prompt: `call the API with ${TYPED} please` },
      settings: {},
    };
  }

  it("Claude Code refuses through the committed prompt gate and prints the redacted copy, never the value", () => {
    const env = prompt();
    const g = planPromptGate(env, stage(env, "protect"), real());
    expect(g?.outcome).toBe("refuse");
    expect(g?.message).not.toContain(TYPED);
    expect(g?.message).toMatch(/Resend this redacted copy instead:\n\ncall the API with __APIKEY_1_[0-9a-f]{6}__ please/);
    const out = emitFor("claude", "user_prompt_submit", "allow", ["a concern quoting " + TYPED], 0, null, g);
    expect(out.exit).toBe(2);
    expect(out.stderr).not.toContain(TYPED);
  });

  it("5.2: the refusal states the residue verbatim, types and counts only", () => {
    const env = prompt();
    const g = planPromptGate(env, stage(env, "protect"), real());
    expect(g?.message.endsWith(
      "It held 1 listed value(s) of type APIKEY. The text was typed into the host and may still sit in its local transcript and prompt history; rotate any credential it carried.",
    )).toBe(true);
    expect(promptResidueLine([], 0)).toBe(
      "It held 0 listed value(s) of type unknown. The text was typed into the host and may still sit in its local transcript and prompt history; rotate any credential it carried.",
    );
  });

  it("a host that cannot refuse gets a warn, and its prompt channel has no gate capability", () => {
    const env = prompt("cursor");
    const g = planPromptGate(env, stage(env, "protect"), { ...real("cursor"), capability: noCap });
    expect(g?.outcome).toBe("warn");
    expect(g?.message).not.toContain(TYPED);
  });

  it("observe and off refuse nothing; a clean prompt is not gated", () => {
    const env = prompt();
    expect(planPromptGate(env, stage(env, "observe"), real())).toBeNull();
    expect(planPromptGate(env, stage(env, "off"), real())).toBeNull();
    const clean = { ...env, payload: { session_id: "s", prompt: "hello" } };
    expect(planPromptGate(clean, stage(clean, "protect"), real())).toBeNull();
  });

  it("a scan that overran its deadline refuses with no copy, because a host timeout would send the prompt", () => {
    const env = prompt();
    const g = planPromptGate(env, stage(env, "protect"), { ...real(), elapsed: () => PROMPT_DEADLINE_MS + 1 });
    expect(g?.outcome).toBe("refuse");
    expect(g?.message).toMatch(/no redacted copy is offered/);
    expect(g?.message).not.toContain(TYPED);
  });
});

describe("3.4 — the model is told once per session what a token is", () => {
  it("the first replaced result of a session carries the line, the next one does not", () => {
    const env = postToolUse("Bash", SHAPES.Bash());
    (env["payload"] as JsonObject)["session_id"] = "sess-a";
    const first = planToolOutputRewrite(env, stage(env, "protect"), deps());
    const second = planToolOutputRewrite(env, stage(env, "protect"), deps());
    expect(first?.outcome === "emitted" && first.explain).toBe(TOKEN_EXPLAINER);
    expect(second?.outcome === "emitted" && second.explain).toBeUndefined();
    const out = JSON.parse(emitFor("claude", "post_tool_use", "allow", [], 0, null, first).stdout);
    expect(out.hookSpecificOutput.additionalContext).toBe(TOKEN_EXPLAINER);
    const other = { ...env, payload: { ...(env["payload"] as JsonObject), session_id: "sess-b" } };
    const third = planToolOutputRewrite(other, stage(other, "protect"), deps());
    expect(third?.outcome === "emitted" && third.explain).toBe(TOKEN_EXPLAINER);
  });
});

it("the chunk's withheld marker is the stage's", () => {
  expect(STAGE_WITHHELD_MARKER).toBe(WITHHELD_MARKER);
});
