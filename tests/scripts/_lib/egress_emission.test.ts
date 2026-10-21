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
  MAX_RESULT_NODES,
  observedHostVersion,
  planStage,
  planToolOutputRewrite,
  readRevocations,
  REVOCATION_FILE,
  STAGE_WITHHELD_MARKER,
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
const NATIVE: Record<string, string> = { post_tool_use: "PostToolUse" };
/** The host emission as the dispatcher would write it on Claude Code. */
function emitFor(_platform: string, event: string, severity: string, reasons: string[], _rc: number, _perm: null, e: Parameters<typeof emitEgress>[0] | undefined) {
  const r = emitEgress(e ?? null, { event, severity, reason: reasons.join(" · "), hookEventName: NATIVE[event] ?? event });
  return r ?? { exit: 0, stdout: "{}", stderr: "" };
}
/** The real resolver against the committed table, the way the stage glue calls it. */
const real = (platform = "claude"): RewriteDeps => ({ packageRoot: REPO_ROOT, row: surfaceRow(platform), observedHostVersion: "2.1.304" });

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

  it("emitFor puts the replaced value in the host field", () => {
    const env = postToolUse("Bash", SHAPES.Bash());
    const r = planToolOutputRewrite(env, stage(env, "protect"), deps());
    const ok = JSON.parse(emitFor("claude", "post_tool_use", "allow", [], 0, null, r).stdout);
    expect(ok.hookSpecificOutput.hookEventName).toBe("PostToolUse");
    expect(JSON.stringify(ok.hookSpecificOutput.updatedToolOutput)).not.toContain(PLANTED);
  });
});

/** The claude row with `post_tool_use` made block-capable, the one shape where a block can still outrank a rewrite. */
function blockCapableRow() {
  const row = surfaceRow("claude")!;
  const slots = new Map(row.slots);
  slots.set("post_tool_use", { ...row.slots.get("post_tool_use")!, block_exit: 2 });
  return { ...row, slots };
}

function rewriteLines(): JsonObject[] {
  const file = path.join(tmp, REWRITE_FILE);
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l) as JsonObject);
}

describe("round 7 — the record says what reached the host, decided once", () => {
  it("on a slot that honours no block, a block does not suppress the replacement: the result is shown either way", () => {
    const env = postToolUse("Bash", SHAPES.Bash());
    const { plan } = planStage(env, stage(env, "protect"), deps());
    const out = JSON.parse(plan!.emit("block", ["a finding"])!.stdout);
    expect(JSON.stringify(out.hookSpecificOutput.updatedToolOutput)).not.toContain(PLANTED);
    expect(out.hookSpecificOutput.updatedToolOutput).toBeDefined();
    expect(rewriteLines()).toMatchObject([{ outcome: "emitted" }]);
  });

  it("on a block-capable slot a block is recorded as withheld at emission, never as emitted, and no delivered length is published", () => {
    const env = postToolUse("Bash", SHAPES.Bash());
    const { plan } = planStage(env, stage(env, "protect"), deps({ row: blockCapableRow() }));
    expect(plan!.delivered.size).toBe(0);
    expect(rewriteLines()).toEqual([]);
    const out = JSON.parse(plan!.emit("block", ["no"])!.stdout);
    expect(out.hookSpecificOutput.updatedToolOutput).toBeUndefined();
    expect(out.systemMessage).toMatch(/reached the model unreplaced \(block-precedence\)/);
    expect(rewriteLines()).toMatchObject([{ outcome: "withheld", reason: "block-precedence" }]);
    expect(readRevocations(tmp)).toEqual([]);
  });

  it("emit is final once: a second call records nothing new", () => {
    const env = postToolUse("Bash", SHAPES.Bash());
    const { plan } = planStage(env, stage(env, "protect"), deps({ row: blockCapableRow() }));
    plan!.emit("allow", []);
    plan!.emit("block", []);
    expect(rewriteLines()).toMatchObject([{ outcome: "emitted" }]);
  });

  it("an audit record that cannot be written withholds the rewrite", () => {
    fs.mkdirSync(path.join(tmp, "agents", "runtime", "state"), { recursive: true });
    fs.mkdirSync(path.join(tmp, REWRITE_FILE));
    const env = postToolUse("Bash", SHAPES.Bash());
    expect(planToolOutputRewrite(env, stage(env, "protect"), deps())).toMatchObject({ outcome: "withheld", reason: "audit-unwritable" });
  });

  it("a workspace that is not a directory withholds and writes no record", () => {
    const file = path.join(tmp, "not-a-dir");
    fs.writeFileSync(file, "");
    const env = { ...postToolUse("Bash", SHAPES.Bash()), workspace_root: file };
    expect(planToolOutputRewrite(env, stage(env, "protect"), deps())).toMatchObject({ outcome: "withheld", reason: "no-workspace" });
    expect(rewriteLines()).toEqual([]);
  });

  it("a result larger than the traversal bound is withheld before it is walked", () => {
    const big = { stdout: `export TOKEN=${PLANTED}\n`, rows: Array.from({ length: MAX_RESULT_NODES }, () => "x") };
    const env = postToolUse("Bash", big);
    expect(planToolOutputRewrite(env, stage(env, "protect"), deps())).toMatchObject({ outcome: "withheld", reason: "oversize" });
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

describe("round 5 — the running host's version and a runtime revocation decide too", () => {
  it("an unobserved running version, or another minor, grants no output capability", () => {
    const env = postToolUse("Bash", SHAPES.Bash());
    expect(planToolOutputRewrite(env, stage(env, "protect"), { ...real(), observedHostVersion: null })).toMatchObject({ reason: "no-capability" });
    expect(planToolOutputRewrite(env, stage(env, "protect"), { ...real(), observedHostVersion: "2.2.0" })).toMatchObject({ reason: "no-capability" });
    expect(planToolOutputRewrite(env, stage(env, "protect"), { ...real(), observedHostVersion: "2.1.311" })?.outcome).toBe("emitted");
  });

  it("the version is read from the top-level field of the session's own transcript under the host's projects directory", () => {
    const config = path.join(tmp, "claude-config");
    const t = path.join(config, "projects", "p", "sess-1.jsonl");
    fs.mkdirSync(path.dirname(t), { recursive: true });
    fs.writeFileSync(t, `${JSON.stringify({ version: "2.1.300" })}\n${JSON.stringify({ type: "x", version: "2.1.304" })}\n`);
    expect(observedHostVersion(t, "sess-1", config)).toBe("2.1.304");
    expect(observedHostVersion(path.join(config, "projects", "p", "missing.jsonl"), "missing", config)).toBeNull();
    expect(observedHostVersion(undefined, "sess-1", config)).toBeNull();
  });

  it("a transcript outside the host's projects directory, or named for another session, yields no version", () => {
    const config = path.join(tmp, "claude-config");
    fs.mkdirSync(path.join(config, "projects", "p"), { recursive: true });
    const outside = path.join(tmp, "sess-1.jsonl");
    fs.writeFileSync(outside, `${JSON.stringify({ version: "2.1.304" })}\n`);
    expect(observedHostVersion(outside, "sess-1", config)).toBeNull();
    const other = path.join(config, "projects", "p", "sess-2.jsonl");
    fs.writeFileSync(other, `${JSON.stringify({ version: "2.1.304" })}\n`);
    expect(observedHostVersion(other, "sess-1", config)).toBeNull();
    fs.symlinkSync(outside, path.join(config, "projects", "p", "sess-3.jsonl"));
    expect(observedHostVersion(path.join(config, "projects", "p", "sess-3.jsonl"), "sess-3", config)).toBeNull();
  });

  it("only a top-level version counts; one inside a tool input or a string does not", () => {
    const config = path.join(tmp, "claude-config");
    const t = path.join(config, "projects", "p", "sess-1.jsonl");
    fs.mkdirSync(path.dirname(t), { recursive: true });
    const nested = { type: "assistant", message: { content: [{ type: "tool_use", input: { version: "2.1.304" } }] } };
    const inString = { type: "user", text: '{"version":"2.1.304"}' };
    fs.writeFileSync(t, `${JSON.stringify({ version: "1.0.0" })}\n${JSON.stringify(nested)}\n${JSON.stringify(inString)}\n`);
    expect(observedHostVersion(t, "sess-1", config)).toBe("1.0.0");
  });

  it("a corrupt revocation record fails closed: the channel is revoked", () => {
    fs.mkdirSync(path.dirname(path.join(tmp, REVOCATION_FILE)), { recursive: true });
    fs.writeFileSync(path.join(tmp, REVOCATION_FILE), "{not json\n");
    expect(readRevocations(tmp)).toMatchObject([{ host: "*", channel: "*", reason: "revocation-state-unreadable" }]);
    const env = postToolUse("Bash", SHAPES.Bash());
    expect(planToolOutputRewrite(env, stage(env, "protect"), real())).toMatchObject({ outcome: "withheld", reason: "no-capability" });
  });

  it("revocations are appended, so two recorded one after another are both kept", () => {
    const env = postToolUse("Bash", SHAPES.Bash());
    const s = stage(env, "protect");
    const placeholder = s.placeholder as JsonObject;
    const forced = { ...s, placeholder: { ...placeholder, payload: { ...(placeholder["payload"] as JsonObject), tool_response: "flattened" } } };
    planToolOutputRewrite(env, forced, deps());
    planToolOutputRewrite(env, { ...s, placeholder: env }, deps());
    expect(readRevocations(tmp).map((r) => r.reason)).toEqual(["shape-mismatch", "residual-hit"]);
  });

  it("a withheld result for a revoking reason revokes the channel on the workspace until a person clears it", () => {
    const env = postToolUse("Bash", SHAPES.Bash());
    const s = stage(env, "protect");
    const placeholder = s.placeholder as JsonObject;
    const forced = { ...s, placeholder: { ...placeholder, payload: { ...(placeholder["payload"] as JsonObject), tool_response: "flattened" } } };
    expect(planToolOutputRewrite(env, forced, real())).toMatchObject({ reason: "shape-mismatch" });
    expect(readRevocations(tmp)).toMatchObject([{ host: "claude", channel: "output", reason: "shape-mismatch" }]);
    expect(planToolOutputRewrite(env, stage(env, "protect"), real())).toMatchObject({ outcome: "withheld", reason: "no-capability" });
    fs.rmSync(path.join(tmp, REVOCATION_FILE));
    expect(planToolOutputRewrite(env, stage(env, "protect"), real())?.outcome).toBe("emitted");
  });
});
