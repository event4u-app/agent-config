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
  CLAUDE_PATHS_PATTERN_BUDGET,
  _claude_paths_plan,
  _emit_claude_rule,
  _emit_cursor_mdc,
  _emit_windsurf_rule,
  _escape_claude_bracket,
  _expanded_pattern_count,
  _is_unresolved_placeholder,
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

// ── P3.1: Claude Code `paths:` emitter ───────────────────────────────
//
// One fixture per trigger shape, per the step's own verify clause, plus the
// three degradations the probed host contract records as SILENT: an
// agent-config placeholder that looks like a brace group, an unescaped `[`,
// and a pattern list over the host's expansion budget. Each of those makes a
// pattern match nothing, which would take a rule from "loads on demand" to
// "never reaches the model" with no error anywhere.

const PLACEHOLDER_FM = `type: "auto"
tier: "2a"
alwaysApply: false
description: "Roadmap CI steps"
triggers:
  - path_prefix: "agents/roadmaps/"
  - path_prefix: "{module_root}/"
  - keyword: "task ci"`;

const PLACEHOLDER_ONLY_FM = `type: "auto"
alwaysApply: false
description: "Placeholder only"
triggers:
  - path_prefix: "{module_root}/"`;

describe("_is_unresolved_placeholder — the comma is the discriminator", () => {
  it("treats a comma-less brace group as a placeholder", () => {
    expect(_is_unresolved_placeholder("{module_root}/**")).toBe(true);
    expect(_is_unresolved_placeholder("{agent_folder}/x")).toBe(true);
  });

  it("treats a real alternation as a glob", () => {
    expect(_is_unresolved_placeholder("src/**/*.{ts,tsx}")).toBe(false);
    expect(_is_unresolved_placeholder("resources/views/**")).toBe(false);
  });
});

describe("_expanded_pattern_count", () => {
  it("multiplies brace alternations and defaults to 1", () => {
    expect(_expanded_pattern_count("src/**")).toBe(1);
    expect(_expanded_pattern_count("src/**/*.{ts,tsx}")).toBe(2);
    expect(_expanded_pattern_count("{a,b}/{c,d,e}")).toBe(6);
  });
});

describe("_escape_claude_bracket", () => {
  it("escapes a literal [ so it cannot open a bracket expression", () => {
    expect(_escape_claude_bracket("docs/[draft]/**")).toBe("docs/\\[draft]/**");
    expect(_escape_claude_bracket("src/**")).toBe("src/**");
  });
});

describe("_claude_paths_plan", () => {
  it("drops an unresolved placeholder and records why", () => {
    const plan = _claude_paths_plan({
      triggers: [{ path_prefix: "agents/roadmaps/" }, { path_prefix: "{module_root}/" }],
    });
    expect(plan.globs).toEqual(["agents/roadmaps/**"]);
    expect(plan.dropped).toEqual([
      { pattern: "{module_root}/**", reason: "unresolved-placeholder" },
    ]);
  });

  it("keeps an always-apply rule unscoped even when it has path triggers", () => {
    const plan = _claude_paths_plan({
      type: "always",
      triggers: [{ path_prefix: "src/" }],
    });
    expect(plan.globs).toEqual([]);
    expect(plan.dropped).toEqual([]);
  });

  it("drops a pattern that would cross the host expansion budget", () => {
    // One 1001-way alternation cannot fit a 1000-pattern budget.
    const wide = `{${Array.from({ length: CLAUDE_PATHS_PATTERN_BUDGET + 1 }, (_, i) => `a${String(i)}`).join(",")}}`;
    const plan = _claude_paths_plan({
      triggers: [{ path_prefix: "src/" }, { file_pattern: wide }],
    });
    expect(plan.globs).toEqual(["src/**"]);
    expect(plan.dropped).toEqual([{ pattern: wide, reason: "over-budget" }]);
  });
});

describe("_emit_claude_rule — frontmatter carries `paths:` and nothing else", () => {
  /** Frontmatter keys present in the emitted file, or null when there is none. */
  function emittedKeys(out: string): string[] | null {
    if (!out.startsWith("---\n")) return null;
    const end = out.indexOf("\n---", 3);
    const block = out.slice(4, end + 1);
    return block
      .split("\n")
      .filter((l) => /^[A-Za-z_][A-Za-z0-9_]*:/.test(l))
      .map((l) => (l.split(":")[0] as string));
  }

  it("path_prefix triggers become a paths list, one entry per glob", () => {
    const src = writeRule("ui-audit-gate-c", UI_AUDIT_FM);
    const target = path.join(tmp, "out", "ui-audit-gate-c.md");
    _emit_claude_rule(src, target);
    const out = fs.readFileSync(target, "utf-8");
    expect(out).toBe(
      '---\npaths:\n  - "resources/views/**"\n  - "resources/js/**"\n---\n\nBody.\n',
    );
    expect(emittedKeys(out)).toEqual(["paths"]);
  });

  it("file_pattern maps verbatim", () => {
    const src = writeRule("php-rule-c", FILE_PATTERN_FM);
    const target = path.join(tmp, "out", "php-rule-c.md");
    _emit_claude_rule(src, target);
    expect(fs.readFileSync(target, "utf-8")).toBe('---\npaths:\n  - "*.php"\n---\n\nBody.\n');
  });

  it("keyword-only rules get NO frontmatter — absent paths is how the host says load-always", () => {
    const src = writeRule("keyword-only-c", KEYWORD_ONLY_FM);
    const target = path.join(tmp, "out", "keyword-only-c.md");
    _emit_claude_rule(src, target);
    const out = fs.readFileSync(target, "utf-8");
    expect(out).toBe("Body.\n");
    expect(emittedKeys(out)).toBeNull();
  });

  it("kernel rules get NO frontmatter, so they load unconditionally", () => {
    const src = writeRule("kernel-rule-c", ALWAYS_FM);
    const target = path.join(tmp, "out", "kernel-rule-c.md");
    _emit_claude_rule(src, target);
    expect(fs.readFileSync(target, "utf-8")).toBe("Body.\n");
  });

  it("a placeholder is dropped while the rule keeps its real pattern", () => {
    const src = writeRule("roadmap-ci-c", PLACEHOLDER_FM);
    const target = path.join(tmp, "out", "roadmap-ci-c.md");
    _emit_claude_rule(src, target);
    const out = fs.readFileSync(target, "utf-8");
    expect(out).toContain('  - "agents/roadmaps/**"');
    expect(out).not.toContain("module_root");
  });

  it("a rule whose ONLY pattern is a placeholder degrades to unconditional, never to invisible", () => {
    const src = writeRule("placeholder-only-c", PLACEHOLDER_ONLY_FM);
    const target = path.join(tmp, "out", "placeholder-only-c.md");
    _emit_claude_rule(src, target);
    const out = fs.readFileSync(target, "utf-8");
    // No `paths:` at all — the rule still reaches the model. A literal
    // `{module_root}` pattern would have matched no file, i.e. never.
    expect(out).toBe("Body.\n");
  });

  it("carries the body byte-for-byte, frontmatter aside", () => {
    const body = "# Title\n\nLine one.\n\n```ts\nconst a = 1;\n```\n";
    const src = writeRule("body-fidelity-c", FILE_PATTERN_FM, body);
    const target = path.join(tmp, "out", "body-fidelity-c.md");
    _emit_claude_rule(src, target);
    const out = fs.readFileSync(target, "utf-8");
    expect(out.endsWith(body)).toBe(true);
  });
});
