/**
 * The egress stage — the views concerns receive, and what `observe` records.
 *
 * Three properties fail in three directions, so each has its own block:
 *
 * 1. **`observe` never changes a view** (D9). A count that rewrites what a
 *    concern sees is a behaviour change shipped under the name of a reading.
 * 2. **A guard always sees the value.** A concern that decides whether a call
 *    runs, served a token, would wave through the value it exists to stop. The
 *    grant is a closed list; a concern cannot request it.
 * 3. **Nothing about a value reaches the record or a test failure.** Every
 *    assertion here is a boolean or a count, and fixtures are built at runtime.
 */
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { parseTokens } from "../../../src/scripts/_lib/egress_token.js";
import {
  buildPlaceholderEnvelope,
  countEnvelope,
  EGRESS_STAGE_KILL_SWITCH,
  egressViewFor,
  EXECUTION_VIEW_GRANTS,
  OBSERVATION_FILE,
  publishedEgressState,
  readEgressMode,
  resolveEgressMode,
  runEgressStage,
  WITHHELD_MARKER,
  type EgressMode,
} from "../../../src/scripts/hooks/egress_stage.js";
import { planPayloadShapes, type JsonObject } from "../../../src/scripts/hooks/payload_stub.js";
import { feedback_dir } from "../../../src/scripts/hooks/state_io.js";

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "..", "..", "..", "..");
const TS_SCRIPT = path.join(REPO_ROOT, "src", "scripts", "hooks", "dispatch_hook.ts");
const TSX_BIN = path.join(REPO_ROOT, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
const REPORT_VIEW = "tests/hooks/fixtures/concern_report_egress_view.ts";

const ALNUM = "Ab3Cd5Ef7Gh9Jk2Lm4Np6Qr8St1Uv3Wx5Yz7";
/** A GitHub-PAT-shaped credential, assembled so no credential literal sits in this file. */
const PLANTED = ["ghp", ALNUM.slice(0, 36)].join("_");
const PEM_HEADER_ONLY = `-----BEGIN ${["RSA", "PRIVATE", "KEY"].join(" ")}-----\nAAAA`;

let tmp: string;
const savedSwitch = process.env[EGRESS_STAGE_KILL_SWITCH];

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "egress-stage-"));
  delete process.env[EGRESS_STAGE_KILL_SWITCH];
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  if (savedSwitch === undefined) delete process.env[EGRESS_STAGE_KILL_SWITCH];
  else process.env[EGRESS_STAGE_KILL_SWITCH] = savedSwitch;
});

function envelope(payload: JsonObject, event = "pre_tool_use"): JsonObject {
  return { schema_version: 1, platform: "claude", event, workspace_root: tmp, payload, settings: {} };
}

const toolCall = (): JsonObject =>
  envelope({ tool_name: "Bash", tool_input: { command: `curl -H "token ${PLANTED}" https://x` } });

const holds = (v: unknown): boolean => JSON.stringify(v).includes(PLANTED);
const fixed = (mode: EgressMode) => (): EgressMode => mode;

describe("mode resolution", () => {
  it("resolves each declared mode and nothing else", () => {
    for (const m of ["off", "observe", "protect", "strict"] as const) {
      expect(resolveEgressMode({ egress: { placeholders: { mode: m } } })).toBe(m);
    }
    for (const bad of [undefined, {}, { egress: { placeholders: { mode: "PROTECT" } } }, { egress: "on" }]) {
      expect(resolveEgressMode(bad)).toBe("off");
    }
  });

  it("reads the project layer, and a comment naming egress is not a key", () => {
    const file = path.join(tmp, ".agent-settings.yml");
    fs.writeFileSync(file, "# a shipped screenshot is a published egress\nscreenshots: {}\n");
    expect(readEgressMode(tmp)).toBe("off");
    fs.writeFileSync(file, "egress:\n  placeholders:\n    mode: protect\n");
    expect(readEgressMode(tmp)).toBe("protect");
  });

  it("a thrown kill switch is off whatever the settings say", () => {
    process.env[EGRESS_STAGE_KILL_SWITCH] = "1";
    expect(resolveEgressMode({ egress: { placeholders: { mode: "strict" } } })).toBe("off");
    fs.writeFileSync(path.join(tmp, ".agent-settings.yml"), "egress:\n  placeholders:\n    mode: protect\n");
    expect(readEgressMode(tmp)).toBe("off");
  });
});

describe("observe never changes a view (D9)", () => {
  it("counts by field, class and type and builds no placeholder view", () => {
    const env = toolCall();
    const before = JSON.stringify(env);
    const r = runEgressStage(env, fixed("observe"));
    expect(r.mode).toBe("observe");
    expect(r.placeholder).toBeUndefined();
    expect(r.counts).toStrictEqual([{ field: "input", class: "credential", type: "TOKEN", count: 1 }]);
    expect(JSON.stringify(env)).toBe(before);
    const plan = planPayloadShapes(env, [new Set(["input"] as const)], r.placeholder);
    expect(holds(plan.shapeFor(new Set(["input"] as const), "placeholder"))).toBe(true);
  });

  it("off does not even read the mode on a body-less event", () => {
    let reads = 0;
    const r = runEgressStage(envelope({ session_id: "s" }, "stop"), () => {
      reads += 1;
      return "protect";
    });
    expect(reads).toBe(0);
    expect(r.placeholder).toBeUndefined();
  });
});

describe("protect builds the placeholder view; the received envelope is untouched", () => {
  it("replaces the planted credential with a token in the placeholder view only", () => {
    const env = toolCall();
    const r = runEgressStage(env, fixed("protect"));
    expect(r.placeholder).toBeDefined();
    expect(holds(r.placeholder)).toBe(false);
    expect(parseTokens(JSON.stringify(r.placeholder)).length).toBe(1);
    expect(holds(env)).toBe(true);
  });

  it("the planner serves the placeholder view to a recording concern and the received one to a guard", () => {
    const env = toolCall();
    const r = runEgressStage(env, fixed("protect"));
    const keep = new Set(["input"] as const);
    const plan = planPayloadShapes(env, [keep], r.placeholder);
    expect(holds(plan.shapeFor(keep, egressViewFor("chat-history")))).toBe(false);
    expect(holds(plan.shapeFor(keep, egressViewFor("block-no-verify")))).toBe(true);
  });

  it("withholds a field whose secret has no provable extent, never partly replaced", () => {
    const env = envelope({ prompt: `here ${PEM_HEADER_ONLY}` }, "user_prompt_submit");
    const view = buildPlaceholderEnvelope(env);
    const prompt = (view["payload"] as JsonObject)["prompt"] as JsonObject;
    expect(prompt[WITHHELD_MARKER]).toBe(true);
    expect(JSON.stringify(view).includes("AAAA")).toBe(false);
    expect(countEnvelope(env).refused).toStrictEqual([{ field: "prompt", rule: "pem-private-key" }]);
  });
});

describe("the execution view is granted, never requested", () => {
  it("only names on the closed list get the execution view", () => {
    for (const name of EXECUTION_VIEW_GRANTS) expect(egressViewFor(name)).toBe("execution");
    for (const name of ["chat-history", "journal-record", "tool-result-bytes", "rtk-wrap"]) {
      expect(egressViewFor(name)).toBe("placeholder");
    }
  });
});

describe("the observation record holds types and counts, never a value", () => {
  it("writes one fixed-field line per scanned dispatch, free of the planted value", () => {
    runEgressStage(toolCall(), fixed("observe"));
    const file = path.join(tmp, OBSERVATION_FILE);
    const lines = fs.readFileSync(file, "utf8").trim().split("\n");
    expect(lines.length).toBe(1);
    expect(lines[0]!.includes(PLANTED)).toBe(false);
    const line = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(Object.keys(line).sort()).toStrictEqual(
      ["counts", "event", "mode", "platform", "refused", "scanned", "tool", "ts"],
    );
    expect(line["tool"]).toBe("Bash");
  });

  it("off writes nothing", () => {
    runEgressStage(toolCall(), fixed("off"));
    expect(fs.existsSync(path.join(tmp, OBSERVATION_FILE))).toBe(false);
  });
});

describe("published state", () => {
  it("a thrown kill switch or a non-replacing mode publishes uncovered, never a stale replaced", () => {
    expect(publishedEgressState("replaced", "protect")).toBe("replaced");
    expect(publishedEgressState("replaced", "observe")).toBe("uncovered");
    expect(publishedEgressState("replaced", "off")).toBe("uncovered");
    process.env[EGRESS_STAGE_KILL_SWITCH] = "1";
    expect(publishedEgressState("replaced", "protect")).toBe("uncovered");
  });
});

describe("end to end through the dispatcher", () => {
  function writeManifest(target: string): void {
    const concern = (name: string, script: string, guard: boolean): string[] => [
      `  ${name}:`,
      `    script: ${script}`,
      "    args: []",
      "    fail_closed: false",
      `    severity: ${guard ? "blocking" : "advisory"}`,
      `    effect: ${guard ? "permission" : "telemetry"}`,
      "    needs_payload_bodies: [input]",
    ];
    const lines = [
      "schema_version: 1",
      "concerns:",
      ...concern("block-no-verify", REPORT_VIEW, true),
      ...concern("recorder", REPORT_VIEW, false),
      "  chat-history:",
      "    script: src/scripts/chat_history.ts",
      "    args: [hook-dispatch]",
      "    fail_closed: false",
      "    severity: advisory",
      "    effect: telemetry",
      "platforms:",
      "  claude:",
      "    pre_tool_use: [block-no-verify, recorder]",
      "    user_prompt_submit: [chat-history, block-no-verify, recorder]",
      "",
    ];
    fs.writeFileSync(target, lines.join("\n"), "utf8");
  }

  function dispatch(ws: string, mode: EgressMode, event: string, native: string, payload: JsonObject): void {
    fs.writeFileSync(
      path.join(ws, ".agent-settings.yml"),
      `egress:\n  placeholders:\n    mode: ${mode}\nchat_history:\n  enabled: true\n  frequency: per_turn\n`,
    );
    const manifest = path.join(tmp, "manifest.yaml");
    writeManifest(manifest);
    const env = { ...process.env, EGRESS_TEST_PLANTED: PLANTED };
    delete env["AGENT_CONFIG_REPLAY"];
    delete env["AGENT_CHAT_HISTORY_FILE"];
    const r = spawnSync(
      TSX_BIN,
      [TS_SCRIPT, "--platform", "claude", "--event", event, "--native-event", native, "--manifest", manifest],
      { cwd: ws, input: JSON.stringify(payload), encoding: "utf8", env },
    );
    expect(r.status).toBe(0);
  }

  function saw(ws: string, sid: string, concern: string): { sawPlanted: boolean; sawToken: boolean } {
    const dir = feedback_dir(path.join(ws, "agents", "runtime", "state"), sid);
    const entry = JSON.parse(fs.readFileSync(path.join(dir, `${concern}.json`), "utf8")) as { reason: string };
    return JSON.parse(entry.reason) as { sawPlanted: boolean; sawToken: boolean };
  }

  it("protect: the guard sees the value, the recorder and chat history see only a token", () => {
    const ws = path.join(tmp, "ws");
    fs.mkdirSync(ws, { recursive: true });
    dispatch(ws, "protect", "user_prompt_submit", "UserPromptSubmit", {
      session_id: "egress-e2e",
      prompt: `deploy with ${PLANTED} please`,
    });
    expect(saw(ws, "egress-e2e", "block-no-verify")).toStrictEqual({ sawPlanted: true, sawToken: false });
    expect(saw(ws, "egress-e2e", "recorder")).toStrictEqual({ sawPlanted: false, sawToken: true });
    const history = fs.readFileSync(path.join(ws, "agents", "runtime", ".agent-chat-history"), "utf8");
    expect(history.includes(PLANTED)).toBe(false);
    expect(parseTokens(history).length).toBeGreaterThan(0);
  });

  it("observe: every concern sees what it would have seen without the stage", () => {
    const ws = path.join(tmp, "ws-observe");
    fs.mkdirSync(ws, { recursive: true });
    dispatch(ws, "observe", "pre_tool_use", "PreToolUse", {
      session_id: "egress-observe",
      tool_name: "Bash",
      tool_input: { command: `echo ${PLANTED}` },
    });
    expect(saw(ws, "egress-observe", "recorder")).toStrictEqual({ sawPlanted: true, sawToken: false });
    const record = fs.readFileSync(path.join(ws, OBSERVATION_FILE), "utf8");
    expect(record.includes(PLANTED)).toBe(false);
    expect(record.includes('"type":"TOKEN"')).toBe(true);
  });
});
