/**
 * Snapshot tests for host-native activation globs on the Cursor/Windsurf
 * rule emitters (road-to-request-scoped-rule-load Phase 2).
 *
 * `file_pattern` triggers map verbatim into `globs:`; `path_prefix` triggers
 * map as `<prefix>**`. Keyword/phrase-only rules keep empty globs and stay
 * description-activated (Cursor Agent-Requested / Windsurf model_decision).
 * Always-on rules never carry globs.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import {
  _emit_cursor_mdc,
  _emit_windsurf_rule,
  derive_trigger_globs,
} from "../../src/scripts/condense.js";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "glob-emit-"));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

function writeRule(name: string, frontmatter: string, body = "Body.\n"): string {
  const p = path.join(tmp, `${name}.md`);
  fs.writeFileSync(p, `---\n${frontmatter}\n---\n\n${body}`);
  return p;
}

const UI_AUDIT_FM = `type: "auto"
tier: "2b"
alwaysApply: false
description: "UI gate"
triggers:
  - path_prefix: "resources/views/"
  - path_prefix: "resources/js/"
  - keyword: "component"
  - keyword: "design token"`;

const KEYWORD_ONLY_FM = `type: "auto"
tier: "2"
alwaysApply: false
description: "Keyword rule"
triggers:
  - keyword: "commit"
  - phrase: "should I commit"`;

const FILE_PATTERN_FM = `type: "auto"
tier: "1"
alwaysApply: false
description: "PHP rule"
triggers:
  - file_pattern: "*.php"
  - keyword: "phpstan"`;

const ALWAYS_FM = `type: "always"
alwaysApply: true
description: "Kernel rule"`;

describe("derive_trigger_globs", () => {
  it("maps path_prefix to <prefix>** and file_pattern verbatim", () => {
    const meta = {
      triggers: [
        { path_prefix: "resources/views/" },
        { file_pattern: "*.tf" },
        { keyword: "x" },
      ],
    };
    expect(derive_trigger_globs(meta)).toEqual(["resources/views/**", "*.tf"]);
  });

  it("returns empty for keyword/phrase-only and missing triggers", () => {
    expect(derive_trigger_globs({ triggers: [{ keyword: "a" }, { phrase: "b c" }] })).toEqual([]);
    expect(derive_trigger_globs({})).toEqual([]);
  });
});

describe("_emit_cursor_mdc — globs snapshot", () => {
  it("ui-audit-gate fixture emits both path globs, auto-attach shape", () => {
    const src = writeRule("ui-audit-gate", UI_AUDIT_FM);
    const target = path.join(tmp, "out", "ui-audit-gate.mdc");
    _emit_cursor_mdc(src, target);
    const out = fs.readFileSync(target, "utf-8");
    expect(out).toContain("globs: resources/views/**,resources/js/**");
    expect(out).toContain("alwaysApply: false");
  });

  it("keyword-only rule emits empty globs unchanged (Agent-Requested)", () => {
    const src = writeRule("keyword-only", KEYWORD_ONLY_FM);
    const target = path.join(tmp, "out", "keyword-only.mdc");
    _emit_cursor_mdc(src, target);
    const out = fs.readFileSync(target, "utf-8");
    expect(out).toContain("globs: \n");
    expect(out).toContain("alwaysApply: false");
  });

  it("file_pattern maps verbatim", () => {
    const src = writeRule("php-rule", FILE_PATTERN_FM);
    const target = path.join(tmp, "out", "php-rule.mdc");
    _emit_cursor_mdc(src, target);
    expect(fs.readFileSync(target, "utf-8")).toContain("globs: *.php\n");
  });

  it("always-on rules never carry globs", () => {
    const src = writeRule("kernel-rule", ALWAYS_FM);
    const target = path.join(tmp, "out", "kernel-rule.mdc");
    _emit_cursor_mdc(src, target);
    const out = fs.readFileSync(target, "utf-8");
    expect(out).toContain("globs: \n");
    expect(out).toContain("alwaysApply: true");
  });
});

describe("_emit_windsurf_rule — trigger/globs snapshot", () => {
  it("path-triggered rule becomes trigger: glob with populated globs", () => {
    const src = writeRule("ui-audit-gate-w", UI_AUDIT_FM);
    const target = path.join(tmp, "out", "ui-audit-gate-w.md");
    _emit_windsurf_rule(src, target);
    const out = fs.readFileSync(target, "utf-8");
    expect(out).toContain("trigger: glob");
    expect(out).toContain("globs: resources/views/**,resources/js/**");
  });

  it("keyword-only rule keeps model_decision + empty globs", () => {
    const src = writeRule("keyword-only-w", KEYWORD_ONLY_FM);
    const target = path.join(tmp, "out", "keyword-only-w.md");
    _emit_windsurf_rule(src, target);
    const out = fs.readFileSync(target, "utf-8");
    expect(out).toContain("trigger: model_decision");
    expect(out).toContain("globs: \n");
  });

  it("always rules keep always_on and no globs", () => {
    const src = writeRule("kernel-rule-w", ALWAYS_FM);
    const target = path.join(tmp, "out", "kernel-rule-w.md");
    _emit_windsurf_rule(src, target);
    const out = fs.readFileSync(target, "utf-8");
    expect(out).toContain("trigger: always_on");
    expect(out).toContain("globs: \n");
  });
});
