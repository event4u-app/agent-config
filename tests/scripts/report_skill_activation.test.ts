/**
 * The census exists because a rate is not available; these tests pin that the
 * script keeps saying so rather than acquiring a threshold, and pin the two
 * counting rules that a prior ad-hoc grep got wrong.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

import {
  censusSkills,
  measureUsage,
  render,
  SKILLS_ROOT,
  defaultStore,
} from "../../src/scripts/report_skill_activation.js";

const REPO_ROOT = path.resolve(__dirname, "..", "..");

function mkSkill(root: string, name: string, frontmatter: string, body: string): void {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "SKILL.md"), `---\n${frontmatter}\n---\n\n${body}\n`, "utf8");
}

describe("censusSkills", () => {
  it("counts a trigger key only when it is in frontmatter, not in prose about triggers", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sa-census-"));
    mkSkill(root, "declared", 'name: declared\ntriggers:\n  - keyword: "x"', "Body.");
    mkSkill(root, "prose-only", "name: prose-only", "This skill discusses triggers:\n- keyword: x");
    const c = censusSkills(root);
    expect(c.total).toBe(2);
    expect(c.withTriggerKey).toEqual(["declared"]);
  });

  // The round-6 roadmap first reported 8 skills with a deterministic obligation.
  // That came from a grep anchored at line start with no list prefix, so every
  // `- MUST` and `**MUST**` was missed. The real figure is higher; these cases
  // are the shapes that were dropped.
  it("counts a deterministic obligation behind a list marker or bold, not only bare", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sa-det-"));
    mkSkill(root, "bare", "name: bare", "MUST do the thing.");
    mkSkill(root, "listed", "name: listed", "- MUST do the thing.");
    mkSkill(root, "bolded", "name: bolded", "**NEVER** do the other thing.");
    mkSkill(root, "soft", "name: soft", "Prefer the thing, and consider the alternative.");
    const c = censusSkills(root);
    expect(new Set(c.withDeterministicObligation)).toEqual(new Set(["bare", "listed", "bolded"]));
    expect(c.withDeterministicObligation).not.toContain("soft");
  });

  it("ignores a trigger key that appears only in the body after the frontmatter fence", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sa-fence-"));
    mkSkill(root, "body-key", "name: body-key", "file_pattern: *.md\n\nProse.");
    expect(censusSkills(root).withTriggerKey).toEqual([]);
  });

  it("returns an empty census for an absent root rather than throwing", () => {
    const c = censusSkills(path.join(os.tmpdir(), "sa-does-not-exist-" + String(Date.now())));
    expect(c.total).toBe(0);
  });

  it("the shipped corpus now declares triggers, and only as a tranche", () => {
    // This assertion used to read `toEqual([])` and recorded the finding the
    // script was built for: zero of ~289 skills declared a machine-matchable
    // trigger. `road-to-inbox-harvest-2026-08-d-runtime-skill-routing` Phase 3
    // closed that finding on purpose — schema, then validator, then a first
    // seeded tranche — so the empty expectation now measures history rather
    // than the tree, and keeping it would fail the branch that fixed the thing.
    //
    // What replaces it is deliberately NOT the seeded name list: a hardcoded
    // set turns every future tranche into a test edit while saying nothing
    // about whether the tranche was sane. The two properties worth holding are
    // that the capability is adopted at all, and that adoption stays a
    // TRANCHE — a mass-seed across the catalogue is what the 3.3 precision
    // gate exists to catch, and a name list would not have caught it either.
    const c = censusSkills(path.join(REPO_ROOT, SKILLS_ROOT));
    expect(c.total).toBeGreaterThan(200);
    expect(c.withTriggerKey.length).toBeGreaterThan(0);
    expect(c.withTriggerKey.length).toBeLessThan(c.total * 0.1);
  });
});

describe("measureUsage", () => {
  it("counts Skill tool invocations by name and ignores other tools", () => {
    const store = fs.mkdtempSync(path.join(os.tmpdir(), "sa-store-"));
    const rows = [
      { type: "assistant", message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "ai-council" } }] } },
      { type: "assistant", message: { content: [{ type: "tool_use", name: "Bash", input: { command: "ls" } }] } },
      { type: "assistant", message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "ai-council" } }] } },
      { type: "user", message: { content: "hi" } },
    ];
    fs.writeFileSync(path.join(store, "s1.jsonl"), rows.map((r) => JSON.stringify(r)).join("\n"), "utf8");
    const u = measureUsage(store, 30);
    expect(u.sessions).toBe(1);
    expect(u.assistantTurns).toBe(3);
    expect(u.invocations).toBe(2);
    expect(u.bySkill).toEqual({ "ai-council": 2 });
  });

  it("survives a malformed line instead of aborting the session", () => {
    const store = fs.mkdtempSync(path.join(os.tmpdir(), "sa-bad-"));
    fs.writeFileSync(
      path.join(store, "s1.jsonl"),
      ["{not json", JSON.stringify({ type: "assistant", message: { content: [] } })].join("\n"),
      "utf8",
    );
    expect(measureUsage(store, 30).assistantTurns).toBe(1);
  });

  it("returns zeros for an absent store", () => {
    const u = measureUsage(path.join(os.tmpdir(), "sa-absent-" + String(Date.now())), 30);
    expect(u.sessions).toBe(0);
    expect(u.invocations).toBe(0);
  });

  it("mangles a cwd into the host's store path", () => {
    expect(defaultStore("/a/b")).toBe(path.join(os.homedir(), ".claude", "projects", "-a-b"));
  });
});

describe("render", () => {
  it("prints the unmeasurable verdict while no skill declares a trigger, and never a rate", () => {
    const out = render(
      { total: 288, withTriggerKey: [], withTriggerCorpus: [], withDeterministicObligation: ["a"] },
      [{ store: "/x/store", sessions: 1, assistantTurns: 10, invocations: 1, bySkill: { a: 1 } }],
    );
    expect(out).toContain("not measurable as a rate");
    expect(out).toContain("NOT MEASURED");
    // The census must not present activation as a percentage of opportunities —
    // that number does not exist and printing one would be the theatre the
    // conformance scan's scope lock forbids.
    expect(out).not.toMatch(/activation rate/i);
  });

  it("drops the verdict once triggers exist, because then a detector is buildable", () => {
    const out = render(
      { total: 2, withTriggerKey: ["a"], withTriggerCorpus: ["b"], withDeterministicObligation: [] },
      [{ store: "/x", sessions: 0, assistantTurns: 0, invocations: 0, bySkill: {} }],
    );
    expect(out).not.toContain("not measurable as a rate");
  });
});
