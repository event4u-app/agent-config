/**
 * One unresolved count per installed kind, and a recorded baseline that only a
 * reviewed commit moves (`road-to-installed-links-of-every-kind` 1.1 + 1.2).
 *
 * The fixture plants exactly one dead link per kind, so a resolver that read a
 * kind against the wrong install root (risk 1 of that roadmap) would show as a
 * wrong count here rather than as a plausible-looking number on the real tree.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isNonProjectedTarget } from "../../src/install/installedRuleLinks.js";
import {
  LINK_KINDS,
  formatKindLine,
  kindBaselineKey,
  kindReadings,
  recordedBaselines,
} from "../../src/scripts/report_installed_rule_links.js";
import { GLOBAL_DEPLOY_SOURCES } from "../../src/scripts/install.js";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const BASELINE_FILE = path.join(
  REPO_ROOT,
  "src/config/gate-violation-baselines.json",
);

/** Skills nest one level, commands may nest, contexts deploy only here. */
const PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["dist/agent-src/rules", "rules"],
  ["dist/agent-src/skills", "skills"],
  ["dist/agent-src/commands", "commands"],
  ["dist/agent-src/contexts", "contexts"],
];

let root: string;

function write(rel: string, body: string): void {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "installed-links-kinds-"));
  write("dist/agent-src/rules/a.md", "[ok](b.md) [dead](../guidelines/g.md)\n");
  write("dist/agent-src/rules/b.md", "[adr](../../../docs/decisions/ADR-001-x.md)\n");
  write(
    "dist/agent-src/skills/s1/SKILL.md",
    "[ok](../s2/SKILL.md) [ok-local](references/r.md) [dead](../s9/SKILL.md)\n",
  );
  write("dist/agent-src/skills/s1/references/r.md", "no links\n");
  write("dist/agent-src/skills/s2/SKILL.md", "[ok](../../rules/a.md)\n");
  write(
    "dist/agent-src/commands/pr/create.md",
    "[ok](../../skills/s1/SKILL.md) [dead](../../templates/t.md)\n",
  );
  write("dist/agent-src/contexts/x/c.md", "[ok](../y.md) [dead](../z.md)\n");
  write("dist/agent-src/contexts/y.md", "plain\n");
  write("dist/agent-src/guidelines/g.md", "[dead](../nowhere.md)\n");
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function byKind(rows: ReturnType<typeof kindReadings>) {
  return Object.fromEntries(rows.map((r) => [r.kind, r]));
}

describe("kindReadings — one count per installed kind", () => {
  it("finds exactly the one planted dead link in every installed kind", () => {
    const rows = byKind(kindReadings(root, PAIRS, LINK_KINDS));
    expect(rows["rules"]).toMatchObject({ installed: true, links: 2, unresolved: 1 });
    expect(rows["skills"]).toMatchObject({ installed: true, links: 4, unresolved: 1 });
    expect(rows["commands"]).toMatchObject({ installed: true, links: 2, unresolved: 1 });
    expect(rows["contexts"]).toMatchObject({ installed: true, links: 2, unresolved: 1 });
  });

  it("reports a kind the plan does not deploy as not installed, not as zero", () => {
    const rows = byKind(kindReadings(root, PAIRS, LINK_KINDS));
    expect(rows["guidelines"]).toMatchObject({ installed: false, links: 0 });
    expect(formatKindLine(rows["guidelines"]!, "fixture-host")).toBe(
      "kind: guidelines unresolved 0 of 0 (not installed for fixture-host)",
    );
  });

  it("puts ADR and docs/ targets on their own row, out of the kind's count", () => {
    const rows = kindReadings(root, PAIRS, LINK_KINDS);
    const np = rows.at(-1)!;
    expect(np).toMatchObject({ kind: "non-projected", links: 1, unresolved: 1 });
    expect(formatKindLine(np, "h")).toBe(
      "kind: non-projected (adr, docs/) unresolved 1 of 1",
    );
  });

  it("a fixture link added to a skill raises its kind's count and the baseline does not move", () => {
    const before = byKind(kindReadings(root, PAIRS, LINK_KINDS));
    const baselineBefore = fs.readFileSync(BASELINE_FILE, "utf8");

    write("dist/agent-src/skills/s2/SKILL.md", "[ok](../../rules/a.md) [new-dead](../gone/SKILL.md)\n");
    const after = byKind(kindReadings(root, PAIRS, LINK_KINDS));

    expect(after["skills"]!.unresolved).toBe(before["skills"]!.unresolved + 1);
    expect(after["commands"]!.unresolved).toBe(before["commands"]!.unresolved);
    expect(fs.readFileSync(BASELINE_FILE, "utf8")).toBe(baselineBefore);

    // The reported line shows the rise against a recorded count rather than
    // absorbing it.
    expect(formatKindLine(after["skills"]!, "h", before["skills"]!.unresolved)).toBe(
      `kind: skills unresolved 2 of 5 [baseline 1, 1 above it]`,
    );
  });
});

describe("isNonProjectedTarget", () => {
  it("counts top-level docs/ and an ADR that resolves nowhere, not a real guidelines/docs file", () => {
    expect(isNonProjectedTarget(root, "dist/agent-src/rules", "../../../docs/x.md")).toBe(true);
    expect(isNonProjectedTarget(root, "dist/agent-src/rules", "../docs/contracts/x.md")).toBe(true);
    write("dist/agent-src/guidelines/docs/real.md", "x\n");
    expect(isNonProjectedTarget(root, "dist/agent-src/rules", "../guidelines/docs/real.md")).toBe(false);
    expect(isNonProjectedTarget(root, "dist/agent-src/rules", "../skills/s1/SKILL.md")).toBe(false);
  });
});

describe("the shipped baseline — recorded, dated, and read back", () => {
  it("records every non-zero claude-code kind with its date and command", () => {
    const shipped = JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8")) as {
      gates: Record<string, { count: number; landed: string; falsifier: string }>;
    };
    for (const kind of ["rules", "skills", "commands", "non-projected"] as const) {
      const entry = shipped.gates[kindBaselineKey("claude-code", kind)];
      expect(entry, kind).toBeDefined();
      expect(entry!.landed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry!.falsifier).toContain("report_installed_rule_links --kinds all");
    }
  });

  // Deliberately NOT asserting live <= recorded: that would turn this file
  // into the failing check D2 rules out until one release of readings exists.
  it("the live tree prints one line per kind and reads each recorded count back", () => {
    const pairs = GLOBAL_DEPLOY_SOURCES["claude-code"]!;
    const rows = kindReadings(REPO_ROOT, pairs, LINK_KINDS);
    expect(rows).toHaveLength(LINK_KINDS.length + 1);
    const baselines = recordedBaselines(REPO_ROOT, "claude-code", rows);
    const byName = Object.fromEntries(rows.map((r, i) => [r.kind, baselines[i]]));
    for (const kind of ["rules", "skills", "commands", "non-projected"]) {
      expect(typeof byName[kind], kind).toBe("number");
    }
    expect(byName["guidelines"]).toBeNull();
  });
});
