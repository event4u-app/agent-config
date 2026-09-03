// Stage-2 impact analysis (src/scripts/hooks/merge_impact.ts).
//
// The property under test is NOT "does it correctly identify breaking changes"
// — that is undecidable and the module does not claim it. It is the weaker,
// checkable pair: a marker that fires must fire on a real patch shape, and a
// patch the module cannot read must come back `undecidable` rather than
// `additive`. Everything unknown resolves toward asking the human.
import { describe, expect, it } from "vitest";

import {
  analyseMergeImpact,
  classifyDiff,
  describeImpact,
  fetchPatch,
} from "../../src/scripts/hooks/merge_impact.js";

const ADDITIVE = `diff --git a/src/feature.ts b/src/feature.ts
new file mode 100644
--- /dev/null
+++ b/src/feature.ts
@@ -0,0 +1,4 @@
+export function greet(name: string): string {
+  return \`hello \${name}\`;
+}
+
diff --git a/src/index.ts b/src/index.ts
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,2 +1,3 @@
 export { existing } from "./existing.js";
+export { greet } from "./feature.js";
`;

describe("classifyDiff — additive", () => {
  it("reads a new file plus a new export as additive", () => {
    const impact = classifyDiff(ADDITIVE);
    expect(impact.verdict).toBe("additive");
    expect(impact.markers).toEqual([]);
    expect(impact.filesChanged).toBe(2);
  });

  it("an empty patch is undecidable, never additive", () => {
    // The whole failure mode in one case: "I saw nothing" and "there is nothing"
    // are different answers, and only one of them is safe to act on.
    expect(classifyDiff("").verdict).toBe("undecidable");
    expect(classifyDiff("   \n  ").verdict).toBe("undecidable");
  });
});

describe("classifyDiff — destructive markers", () => {
  it.each([
    [
      "migration drops a column",
      `diff --git a/db/m.php b/db/m.php\n--- a/db/m.php\n+++ b/db/m.php\n@@\n+            $table->dropColumn('legacy_id');\n`,
    ],
    [
      "raw DROP TABLE",
      `diff --git a/db/m.sql b/db/m.sql\n--- a/db/m.sql\n+++ b/db/m.sql\n@@\n+DROP TABLE customers;\n`,
    ],
    [
      "author marked a breaking change",
      `diff --git a/CHANGELOG.md b/CHANGELOG.md\n--- a/CHANGELOG.md\n+++ b/CHANGELOG.md\n@@\n+BREAKING CHANGE: the config key was renamed\n`,
    ],
    [
      "an export was removed",
      `diff --git a/src/api.ts b/src/api.ts\n--- a/src/api.ts\n+++ b/src/api.ts\n@@\n-export function legacy(): void {}\n`,
    ],
    [
      "a route was removed",
      `diff --git a/routes/web.php b/routes/web.php\n--- a/routes/web.php\n+++ b/routes/web.php\n@@\n-Route::get('/old', [C::class, 'x']);\n`,
    ],
    [
      "a file was deleted",
      `diff --git a/src/gone.ts b/src/gone.ts\ndeleted file mode 100644\n--- a/src/gone.ts\n+++ /dev/null\n`,
    ],
  ])("%s", (_label, patch) => {
    const impact = classifyDiff(patch);
    expect(impact.verdict).toBe("destructive");
    expect(impact.markers.length).toBeGreaterThan(0);
  });

  it("reads a major version bump as destructive", () => {
    const patch = `diff --git a/package.json b/package.json
--- a/package.json
+++ b/package.json
@@
-  "version": "3.4.1",
+  "version": "4.0.0",
`;
    const impact = classifyDiff(patch);
    expect(impact.verdict).toBe("destructive");
    expect(impact.markers.join(" ")).toContain("major version bump");
  });

  it("a MINOR bump is not a marker", () => {
    const patch = `diff --git a/package.json b/package.json
--- a/package.json
+++ b/package.json
@@
-  "version": "3.4.1",
+  "version": "3.5.0",
`;
    expect(classifyDiff(patch).verdict).toBe("additive");
  });

  it("REMOVING a dropColumn call is not destructive", () => {
    // Markers match ADDED lines only. Scoring the raw patch would score a
    // migration that deletes a drop the same as one that adds it — the exact
    // inversion this scoping exists to prevent.
    const patch = `diff --git a/db/m.php b/db/m.php\n--- a/db/m.php\n+++ b/db/m.php\n@@\n-            $table->dropColumn('legacy_id');\n`;
    expect(classifyDiff(patch).markers).not.toContain("migration drops a column or table");
  });

  it("a rename around a schema drop is destructive — the drop moved, it was not removed", () => {
    // MEASURED at 022c0d240: this classified `additive` with markers []. Both
    // schema markers are anchored to `^\+`, and inside a rename that anchor
    // hides the case — the content did not stay put, so a removal on the old
    // path is the drop MOVING, not the drop being taken out.
    const patch = [
      "diff --git a/db/m.php b/db/mig.php",
      "similarity index 88%",
      "rename from db/m.php",
      "rename to db/mig.php",
      "--- a/db/m.php",
      "+++ b/db/mig.php",
      "@@ -1,3 +1,3 @@",
      '-Schema::dropTable("users");',
      '+Schema::create("users");',
      "",
    ].join("\n");
    const impact = classifyDiff(patch);
    expect(impact.verdict).toBe("destructive");
    expect(impact.markers).toContain("a renamed file drops a column or table");
  });

  it("and the widened scan stays conditional — the pinned counter-case is unchanged", () => {
    // The SENSITIVITY of the fix in the other direction. If the deleted-side
    // scan were applied to every block instead of only to renamed ones, this
    // would flip and the test above it would still pass — so the pair has to
    // be read together.
    const patch = `diff --git a/db/m.php b/db/m.php\n--- a/db/m.php\n+++ b/db/m.php\n@@\n-            $table->dropColumn('legacy_id');\n`;
    const impact = classifyDiff(patch);
    expect(impact.verdict).toBe("additive");
    expect(impact.markers).toEqual([]);
  });

  it("a 100% rename stays additive — recorded as a residual, not closed by guessing", () => {
    // A `similarity index 100%` rename carries no content lines, so nothing
    // fires. A pure move drops nothing, which is the honest reading; the cost
    // is that a MOVED migration is invisible to this scan. Asserted so the
    // residual is a pinned fact rather than an unexamined gap.
    const patch = [
      "diff --git a/db/old.php b/db/new.php",
      "similarity index 100%",
      "rename from db/old.php",
      "rename to db/new.php",
      "",
    ].join("\n");
    expect(classifyDiff(patch).verdict).toBe("additive");
  });

  it("collects every marker that fires, not just the first", () => {
    const patch =
      `diff --git a/db/m.php b/db/m.php\n@@\n+  $table->dropTable('x');\n` +
      `diff --git a/src/api.ts b/src/api.ts\n@@\n-export const gone = 1;\n`;
    expect(classifyDiff(patch).markers.length).toBeGreaterThanOrEqual(2);
  });
});

describe("fetchPatch — every failure is undecidable, never a crash", () => {
  const throwing = (): never => {
    throw new Error("no such ref");
  };

  it("returns `none` when neither local nor gh can answer", () => {
    const got = fetchPatch(1499, { exec: throwing as never });
    expect(got.source).toBe("none");
    expect(got.patch).toBe("");
  });

  it("does not reach the network when it is disabled", () => {
    const calls: string[] = [];
    const exec = ((file: string) => {
      calls.push(file);
      throw new Error("nope");
    }) as never;
    const got = fetchPatch(1499, { exec, allowNetwork: false });
    expect(got.source).toBe("none");
    expect(calls).not.toContain("gh");
  });

  it("prefers the local ref when it answers", () => {
    const exec = ((file: string, args: string[]) => {
      if (file === "git" && args[0] === "merge-base") return "abc123\n";
      if (file === "git" && args[0] === "diff") return ADDITIVE;
      throw new Error("gh must not be reached");
    }) as never;
    const got = fetchPatch(1499, { exec });
    expect(got.source).toBe("local");
  });

  it("falls back to gh when there is no local ref", () => {
    const exec = ((file: string) => {
      if (file === "git") throw new Error("no ref");
      return ADDITIVE;
    }) as never;
    expect(fetchPatch(1499, { exec }).source).toBe("gh");
  });

  it("analyseMergeImpact turns an unreadable patch into undecidable", () => {
    const impact = analyseMergeImpact(1499, { exec: throwing as never });
    expect(impact.verdict).toBe("undecidable");
    expect(impact.reason).toBeTruthy();
  });
});

describe("describeImpact — the refusal has to be answerable out loud", () => {
  it("quotes the exact sentence that unblocks it, in every verdict", () => {
    for (const impact of [
      { verdict: "additive" as const, markers: [], filesChanged: 2 },
      { verdict: "destructive" as const, markers: ["a route was removed"] },
      { verdict: "undecidable" as const, markers: [], reason: "offline" },
    ]) {
      expect(describeImpact(1499, impact)).toContain('Say "merge #1499"');
    }
  });

  it("an additive verdict still says it is not a clearance", () => {
    // The council's objection, carried into the user-visible text: a purely
    // additive diff can still fire a deploy, and the base has moved.
    const text = describeImpact(1499, { verdict: "additive", markers: [], filesChanged: 2 });
    expect(text).toContain("not the same");
    expect(text).toContain("deploy");
  });

  it("a destructive verdict names the markers rather than just refusing", () => {
    const text = describeImpact(1499, {
      verdict: "destructive",
      markers: ["migration drops a column or table"],
    });
    expect(text).toContain("migration drops a column or table");
  });
});
