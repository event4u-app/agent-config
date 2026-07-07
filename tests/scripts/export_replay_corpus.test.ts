/**
 * Tests for the field-corpus exporter (road-to-token-proof-and-story Phase 2).
 * Redaction is a mechanical first pass; the operator privacy review stays the
 * gate — these tests prove the pass catches the obvious classes.
 */
import { describe, expect, it } from "vitest";

import {
  build_corpus,
  detect_command,
  extract_prompts,
  redact,
  to_yaml,
} from "../../src/scripts/export_replay_corpus.js";

describe("redact — mechanical first pass", () => {
  it("scrubs emails, keys, home paths, hex, IPs, URL credentials", () => {
    const dirty =
      "Mail m.berg@example.de with sk-abc1234567890XYZ from /Users/alice/repo " +
      "hash deadbeefdeadbeefdeadbeefdeadbeef1234 at 192.168.0.1 via https://u:p@host/x";
    const clean = redact(dirty);
    expect(clean).not.toContain("m.berg@example.de");
    expect(clean).not.toContain("sk-abc1234567890XYZ");
    expect(clean).not.toContain("/Users/alice");
    expect(clean).not.toContain("deadbeefdeadbeefdeadbeefdeadbeef1234");
    expect(clean).not.toContain("192.168.0.1");
    expect(clean).not.toContain("u:p@host");
    for (const marker of ["<EMAIL>", "<KEY>", "<HOME>", "<HEX>", "<IP>", "<CREDENTIALS>"]) {
      expect(clean).toContain(marker);
    }
  });
});

describe("extract_prompts", () => {
  const jsonl = [
    '{"t": "header", "v": 4}',
    '{"t": "user", "text": "Fix the login redirect on the dashboard page"}',
    '{"t": "assistant", "text": "done"}',
    '{"t": "user", "text": "ok"}', // below min-chars
    "not json at all",
    '{"t": "user", "text": "/roadmap:process-phase run the next phase"}',
  ].join("\n");

  it("keeps only user turns above min length, tolerates junk lines", () => {
    const out = extract_prompts(jsonl, 10);
    expect(out).toHaveLength(2);
    expect(out[0]).toContain("login redirect");
  });
});

describe("detect_command + build_corpus + to_yaml", () => {
  it("detects leading slash commands", () => {
    expect(detect_command("/commit please")).toBe("/commit");
    expect(detect_command("/roadmap:process-full go")).toBe("/roadmap:process-full");
    expect(detect_command("fix this")).toBeNull();
  });

  it("dedupes, caps, ids, and emits router_telemetry-compatible YAML", () => {
    const corpus = build_corpus(["same prompt text here", "same prompt text here", "another one entirely"], 10);
    expect(corpus).toHaveLength(2);
    expect(corpus[0]!.id).toBe("field-001");
    const yaml = to_yaml(corpus);
    expect(yaml).toContain("prompts:");
    expect(yaml).toContain("PRIVACY");
    expect(yaml).toContain('text: "same prompt text here"');
  });
});
