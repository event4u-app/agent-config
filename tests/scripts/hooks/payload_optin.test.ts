/**
 * Payload opt-in — `road-to-per-turn-hook-economy` Phase 2 (steps 2.1 + 2.2).
 *
 * Four properties, and they fail in four different directions:
 *
 * 1. **The stub replaces what it should and nothing else.** The audit that
 *    assigned the declarations found eight concerns reading payload keys that
 *    are NOT tool bodies — `transcript_path`, `prompt`, `cwd`, `session_id`,
 *    `stop_hook_active`, `agent_id`, `payload.source`. A stub that widened to
 *    the whole payload would break every one of them silently.
 * 2. **A guard is never stubbed.** `block-no-verify` reads
 *    `tool_input.command`; a stub makes that `undefined` and the guard exits
 *    ALLOW. That is the same shape as the measured stdin bypass this roadmap
 *    fixed in Phase 1, and it must be unreachable by a manifest omission
 *    rather than merely discouraged.
 * 3. **Byte length survives the omission.** `tool-result-bytes` is an
 *    instrument whose whole output is a byte count. If the stub's `bytes` did
 *    not match what the concern would have measured, the census would keep
 *    filling with wrong-but-plausible numbers — worse than an empty file.
 * 4. **Absent stays distinguishable from empty.** Two concerns document that
 *    difference as load-bearing, so a payload with no result key produces NO
 *    stub rather than a zero-byte one.
 */
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  EXIT_ALLOW,
  _concern_body_classes,
  _load_yaml,
} from "../../../src/scripts/hooks/dispatch_hook.js";
import {
  allBodyClasses,
  countStubbedKeys,
  isPayloadStub,
  parseBodyClasses,
  presentBodyClasses,
  stubPayloadBodies,
  stubbedBytes,
  type BodyClass,
  type JsonObject,
} from "../../../src/scripts/hooks/payload_stub.js";
import { _resultBytes } from "../../../src/scripts/hooks/tool_result_bytes_hook.js";

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "..", "..", "..", "..");
const TS_SCRIPT = path.join(REPO_ROOT, "src", "scripts", "hooks", "dispatch_hook.ts");
const TSX_BIN = path.join(
  REPO_ROOT,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tsx.cmd" : "tsx",
);
const REAL_MANIFEST = path.join(REPO_ROOT, "src", "scripts", "hook_manifest.yaml");
const FIXTURE_CONCERN = "tests/hooks/fixtures/concern_report_body.ts";

const KEEP_NONE = new Set<BodyClass>();
const KEEP_INPUT = new Set<BodyClass>(["input"]);
const KEEP_RESULT = new Set<BodyClass>(["result"]);

/** A post_tool_use envelope with a body big enough to be worth omitting. */
function postEnvelope(response: unknown = "x".repeat(4096)): JsonObject {
  return {
    schema_version: 1,
    platform: "claude",
    event: "post_tool_use",
    native_event: "PostToolUse",
    session_id: "s1",
    workspace_root: "/tmp/ws",
    payload: {
      tool_name: "Read",
      tool_input: { file_path: "/tmp/ws/a.ts" },
      tool_response: response as never,
      // Not a body — every one of these is a live read in some concern.
      transcript_path: "/tmp/ws/t.jsonl",
      cwd: "/tmp/ws",
      stop_hook_active: false,
    } as JsonObject,
    settings: {},
  };
}

describe("payload opt-in — what the stub replaces", () => {
  it("stubs both classes when the concern declared neither", () => {
    const shaped = stubPayloadBodies(postEnvelope(), KEEP_NONE);
    const payload = shaped["payload"] as JsonObject;
    expect(isPayloadStub(payload["tool_response"])).toBe(true);
    expect(isPayloadStub(payload["tool_input"])).toBe(true);
  });

  it("keeps the declared class and stubs only the other one", () => {
    const keptInput = stubPayloadBodies(postEnvelope(), KEEP_INPUT)["payload"] as JsonObject;
    expect(isPayloadStub(keptInput["tool_input"])).toBe(false);
    expect(isPayloadStub(keptInput["tool_response"])).toBe(true);

    const keptResult = stubPayloadBodies(postEnvelope(), KEEP_RESULT)["payload"] as JsonObject;
    expect(isPayloadStub(keptResult["tool_response"])).toBe(false);
    expect(isPayloadStub(keptResult["tool_input"])).toBe(true);
  });

  it("leaves every non-body payload key untouched", () => {
    const shaped = stubPayloadBodies(postEnvelope(), KEEP_NONE);
    const payload = shaped["payload"] as JsonObject;
    // The eight keys the audit found live in concerns that read no tool body.
    expect(payload["tool_name"]).toBe("Read");
    expect(payload["transcript_path"]).toBe("/tmp/ws/t.jsonl");
    expect(payload["cwd"]).toBe("/tmp/ws");
    expect(payload["stop_hook_active"]).toBe(false);
    expect(shaped["session_id"]).toBe("s1");
    expect(shaped["event"]).toBe("post_tool_use");
    expect(shaped["workspace_root"]).toBe("/tmp/ws");
  });

  it("returns the SAME object when the event carries no body at all", () => {
    const stop: JsonObject = {
      schema_version: 1,
      platform: "claude",
      event: "stop",
      payload: { transcript_path: "/tmp/t.jsonl", stop_hook_active: true },
    };
    expect(presentBodyClasses(stop).size).toBe(0);
    expect(stubPayloadBodies(stop, KEEP_NONE)).toBe(stop);
    expect(countStubbedKeys(stop, KEEP_NONE)).toBe(0);
  });

  it("does not double-wrap an already-stubbed body", () => {
    const once = stubPayloadBodies(postEnvelope(), KEEP_NONE);
    const twice = stubPayloadBodies(once, KEEP_NONE);
    expect(twice).toBe(once);
  });

  it("carries no fragment of the omitted body", () => {
    const secret = "AKIAIOSFODNN7EXAMPLE-and-a-customer-address";
    const shaped = stubPayloadBodies(postEnvelope(`prefix ${secret} suffix`), KEEP_NONE);
    const serialised = JSON.stringify(shaped);
    expect(serialised).not.toContain(secret);
    expect(serialised).not.toContain("prefix");
  });

  it("reports an object body's shape without its values", () => {
    const shaped = stubPayloadBodies(
      postEnvelope({ stdout: "secret-output", stderr: "" }),
      KEEP_NONE,
    );
    const stub = (shaped["payload"] as JsonObject)["tool_response"];
    expect(isPayloadStub(stub)).toBe(true);
    if (!isPayloadStub(stub)) return;
    expect(stub["keys"]).toEqual(["stdout", "stderr"]);
    expect(stub["value_type"]).toBe("object");
    expect(JSON.stringify(stub)).not.toContain("secret-output");
  });
});

describe("payload opt-in — absent stays distinguishable from empty", () => {
  it("produces no stub when the payload carries no result key", () => {
    const env: JsonObject = {
      schema_version: 1,
      platform: "claude",
      event: "post_tool_use",
      payload: { tool_name: "Read", tool_input: { file_path: "/a" } } as JsonObject,
    };
    expect(presentBodyClasses(env).has("result")).toBe(false);
    const shaped = stubPayloadBodies(env, KEEP_INPUT);
    // Nothing to stub in the kept-input case → same reference, and the result
    // key is still ABSENT rather than present-and-zero.
    expect(shaped).toBe(env);
    expect(_resultBytes(shaped["payload"] as JsonObject)).toBeNull();
  });

  it("keeps an unserialisable body unmeasurable rather than zero", () => {
    const circular: Record<string, unknown> = {};
    circular["self"] = circular;
    const env = postEnvelope(circular);
    const shaped = stubPayloadBodies(env, KEEP_NONE);
    const stub = (shaped["payload"] as JsonObject)["tool_response"];
    expect(stubbedBytes(stub)).toBeNull();
    expect(_resultBytes(shaped["payload"] as JsonObject)).toBeNull();
  });
});

describe("payload opt-in — byte-length fidelity (step 2.2)", () => {
  for (const [label, body] of [
    ["a string result", "y".repeat(12_345)],
    ["a multibyte string result", "ü".repeat(1_000)],
    ["an object result", { stdout: "z".repeat(5_000), code: 0 }],
    ["an array result", ["a", "bb", "ccc"]],
  ] as Array<[string, unknown]>) {
    it(`reports the same byte count for ${label}, stubbed or not`, () => {
      const full = postEnvelope(body);
      const stubbed = stubPayloadBodies(full, KEEP_NONE);
      const before = _resultBytes(full["payload"] as JsonObject);
      const after = _resultBytes(stubbed["payload"] as JsonObject);
      expect(after).toBe(before);
      expect(after).toBeGreaterThan(0);
    });
  }
});

describe("payload opt-in — the guard floor", () => {
  it("parses a declaration into exactly the declared classes", () => {
    expect([..._concern_body_classes({ needs_payload_bodies: ["input"] })]).toEqual(["input"]);
    expect([..._concern_body_classes({ needs_payload_bodies: ["result"] })]).toEqual(["result"]);
    expect(
      [..._concern_body_classes({ needs_payload_bodies: ["input", "result"] })].sort(),
    ).toEqual(["input", "result"]);
  });

  it("keeps nothing for an undeclared advisory concern", () => {
    expect(_concern_body_classes({ severity: "advisory" }).size).toBe(0);
  });

  it("keeps EVERY class for a fail_closed concern that declared none", () => {
    const classes = _concern_body_classes({ fail_closed: true });
    expect([...classes].sort()).toEqual([...allBodyClasses()].sort());
  });

  it("keeps EVERY class for a blocking concern that declared none", () => {
    const classes = _concern_body_classes({ severity: "blocking" });
    expect([...classes].sort()).toEqual([...allBodyClasses()].sort());
  });

  it("ignores a malformed declaration rather than widening on it", () => {
    // The lint rejects these at authoring time; the runtime must not silently
    // accept them, or the lint could be bypassed by a typo that "works".
    expect(parseBodyClasses(true).size).toBe(0);
    expect(parseBodyClasses("input").size).toBe(0);
    expect(parseBodyClasses(["inputs"]).size).toBe(0);
    expect([...parseBodyClasses(["input", "nonsense"])]).toEqual(["input"]);
  });
});

describe("payload opt-in — the shipped manifest", () => {
  const manifest = _load_yaml(REAL_MANIFEST) as unknown as {
    concerns: Record<string, Record<string, unknown>>;
  };

  it("leaves tool-result-bytes undeclared, so it keeps being stub-served", () => {
    // Step 2.2's whole point: this concern needs a LENGTH, not a body. If a
    // later edit declares `result` here, the win disappears silently — the
    // census would look identical while the 2 MB payload flowed again.
    const spec = manifest.concerns["tool-result-bytes"];
    expect(spec).toBeDefined();
    expect(spec?.["needs_payload_bodies"]).toBeUndefined();
  });

  it("declares 'result' on every concern that reads the result text", () => {
    // From the per-concern audit. These five parse the response body; a
    // regression that drops the declaration makes them read `undefined` and
    // report nothing, which is invisible in their own output.
    for (const name of [
      "chat-history",
      "verify-before-complete",
      "injection-scan",
      "pr-url-reminder",
      "orchestration-record",
    ]) {
      const declared = manifest.concerns[name]?.["needs_payload_bodies"];
      expect(Array.isArray(declared) && declared.includes("result"), name).toBe(true);
    }
  });

  it("declares 'input' on every tool-slot guard", () => {
    for (const name of [
      "block-no-verify",
      "block-unauthorized-git",
      "block-kernel-rule-writes",
      "block-config-weakening",
      "evidence-independence",
    ]) {
      const declared = manifest.concerns[name]?.["needs_payload_bodies"];
      expect(Array.isArray(declared) && declared.includes("input"), name).toBe(true);
    }
  });
});

// --- End-to-end: what a concern actually receives on stdin ------------

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "payload-optin-"));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function writeManifest(target: string): void {
  const lines = [
    "schema_version: 1",
    "concerns:",
    "  reports_undeclared:",
    `    script: ${FIXTURE_CONCERN}`,
    "    fail_closed: false",
    "    severity: advisory",
    "  reports_declared:",
    `    script: ${FIXTURE_CONCERN}`,
    "    fail_closed: false",
    "    severity: advisory",
    "    needs_payload_bodies: [result]",
    "platforms:",
    "  claude:",
    "    post_tool_use: [reports_undeclared, reports_declared]",
    "",
  ];
  fs.writeFileSync(target, lines.join("\n"), "utf8");
}

describe("payload opt-in — end to end through the dispatcher", () => {
  it("serves a stub to the undeclared concern and the body to the declared one", () => {
    const ws = path.join(tmp, "ws");
    fs.mkdirSync(ws, { recursive: true });
    const manifest = path.join(tmp, "manifest.yaml");
    writeManifest(manifest);

    // Large enough that a regression is unmistakable, and above the pipe
    // buffer so the dispatcher's own stdin read is exercised on the way in.
    const body = "q".repeat(300_000);
    const payload = JSON.stringify({
      session_id: "e2e",
      tool_name: "Read",
      tool_input: { file_path: "/tmp/x.ts" },
      tool_response: body,
    });

    const r = spawnSync(
      TSX_BIN,
      [
        TS_SCRIPT,
        "--platform",
        "claude",
        "--event",
        "post_tool_use",
        "--native-event",
        "PostToolUse",
        "--manifest",
        manifest,
      ],
      { cwd: ws, input: payload, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
    );
    expect(r.status).toBe(EXIT_ALLOW);

    const dispatcherDir = path.join(ws, "agents", "runtime", "state", ".dispatcher", "e2e");
    const undeclared = JSON.parse(
      fs.readFileSync(path.join(dispatcherDir, "reports_undeclared.json"), "utf8"),
    ) as Record<string, unknown>;
    const declared = JSON.parse(
      fs.readFileSync(path.join(dispatcherDir, "reports_declared.json"), "utf8"),
    ) as Record<string, unknown>;

    // The fixture reports what it saw for `tool_response` as its `reason`.
    const sawUndeclared = JSON.parse(String(undeclared["reason"])) as Record<string, unknown>;
    const sawDeclared = JSON.parse(String(declared["reason"])) as Record<string, unknown>;

    expect(sawUndeclared["saw"]).toBe("stub");
    expect(sawUndeclared["bytes"]).toBe(body.length);
    expect(sawDeclared["saw"]).toBe("string");
    expect(sawDeclared["bytes"]).toBe(body.length);

    // Step 2.1's counter: two keys omitted for the undeclared concern
    // (input + result), one for the declared one (input only).
    expect(undeclared["payload_stubs"]).toBe(2);
    expect(undeclared["payload_bodies"]).toBe("none");
    expect(declared["payload_stubs"]).toBe(1);
    expect(declared["payload_bodies"]).toBe("result");

    const summary = JSON.parse(
      fs.readFileSync(path.join(dispatcherDir, "summary.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(summary["payload_stubs_served"]).toBe(3);
  });
});
