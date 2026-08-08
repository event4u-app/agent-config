/**
 * Pins the 2026-08-08 regression: an agent announced "kein Council konfiguriert
 * (keine .agent-settings.yml)" in a consumer project and substituted a weaker
 * path. The council was configured user-globally the whole time.
 *
 * The load-bearing test is `does not change verdict with project files present`.
 * Everything else here is shape; that one is the defect.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildFact,
  resolveAvailability,
  run,
} from "../../src/scripts/council_availability_hook.js";

const ENV_KEY = "AI_COUNCIL_CONFIG";

function writeConfig(body: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "council-avail-"));
  const p = path.join(dir, ".ai-council.yml");
  fs.writeFileSync(p, body, "utf8");
  return p;
}

const TWO_MEMBERS = `enabled: true
members:
  anthropic:
    enabled: true
    model: claude-sonnet-4-5
    api_key_ref: env:ANTHROPIC_API_KEY
  openai:
    enabled: true
    model: gpt-4o
    api_key_ref: env:OPENAI_API_KEY
`;

describe("resolveAvailability", () => {
  it("reports configured when the resolved file enables members", () => {
    const p = writeConfig(TWO_MEMBERS);
    const a = resolveAvailability("/anywhere", { [ENV_KEY]: p });
    expect(a).not.toBeNull();
    expect(a?.configured).toBe(true);
    expect(a?.membersEnabled).toBe(2);
    expect(a?.memberNames.sort()).toEqual(["anthropic", "openai"]);
    expect(a?.provenance).toBe("env-override");
  });

  it("distinguishes a missing file from an unusable one — the two need different actions", () => {
    const missing = resolveAvailability("/anywhere", {
      [ENV_KEY]: path.join(os.tmpdir(), `absent-${String(Date.now())}.yml`),
    });
    expect(missing?.configured).toBe(false);
    expect(missing?.exists).toBe(false);

    const broken = resolveAvailability("/anywhere", { [ENV_KEY]: writeConfig("enabled: [not, a, bool\n") });
    expect(broken?.configured).toBe(false);
    expect(broken?.exists).toBe(true);
  });

  it("reports not-configured when the file parses but enables nothing", () => {
    const p = writeConfig("enabled: false\nmembers: {}\n");
    expect(resolveAvailability("/anywhere", { [ENV_KEY]: p })?.configured).toBe(false);
  });

  // THE REGRESSION. Council config is never project-local (ADR-104), so no
  // project file may move the verdict — least of all `.agent-settings.yml`,
  // which is the file the failing agent inspected.
  it("does not change verdict with project files present or absent", () => {
    const p = writeConfig(TWO_MEMBERS);
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), "proj-bare-"));

    const decoy = fs.mkdtempSync(path.join(os.tmpdir(), "proj-decoy-"));
    fs.writeFileSync(path.join(decoy, ".agent-settings.yml"), "personal:\n  autonomy: auto\n", "utf8");
    fs.mkdirSync(path.join(decoy, "agents", "settings"), { recursive: true });
    // A project-local council file must be ignored outright, not merged.
    fs.writeFileSync(
      path.join(decoy, "agents", "settings", ".ai-council.yml"),
      "enabled: false\nmembers: {}\n",
      "utf8",
    );

    const fromBare = resolveAvailability(bare, { [ENV_KEY]: p });
    const fromDecoy = resolveAvailability(decoy, { [ENV_KEY]: p });
    expect(fromBare?.configured).toBe(true);
    expect(fromDecoy?.configured).toBe(true);
    expect(fromDecoy?.path).toBe(fromBare?.path);
  });
});

describe("buildFact", () => {
  it("states availability and forbids the substitution that was measured", () => {
    const p = writeConfig(TWO_MEMBERS);
    const fact = buildFact(resolveAvailability("/anywhere", { [ENV_KEY]: p })!);
    expect(fact).toContain("An AI council IS configured");
    expect(fact).toContain("Never announce that no council is configured");
    expect(fact).toContain("ADR-104");
    expect(fact).toContain("agent-settings.yml");
    expect(fact).toContain("council:status");
  });

  it("permits a substitute when none is configured, and asks for it to be named", () => {
    const fact = buildFact(
      resolveAvailability("/anywhere", { [ENV_KEY]: path.join(os.tmpdir(), "nope.yml") })!,
    );
    expect(fact).toContain("No AI council is configured");
    expect(fact).toContain("say which one you are using");
  });
});

describe("run", () => {
  it("emits the fact as session_start context", () => {
    const p = writeConfig(TWO_MEMBERS);
    const written: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.stdout as any).write = (chunk: string): boolean => {
      written.push(String(chunk));
      return true;
    };
    try {
      const rc = run(JSON.stringify({ event: "session_start", cwd: "/anywhere" }), { env: { [ENV_KEY]: p } });
      expect(rc).toBe(0);
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (process.stdout as any).write = orig;
    }
    const payload = JSON.parse(written.join("")) as Record<string, unknown>;
    expect(payload["decision"]).toBe("allow");
    expect(String(payload["context"])).toContain("<council-availability>");
  });

  it("no-ops on any other event, so it cannot fire mid-turn", () => {
    expect(run(JSON.stringify({ event: "post_tool_use" }), { env: {} })).toBe(0);
  });

  it("no-ops on a malformed envelope rather than guessing", () => {
    expect(run("{not json", { env: {} })).toBe(0);
  });
});
