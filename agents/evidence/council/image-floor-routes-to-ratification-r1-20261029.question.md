<!-- evidence-type: analysis -->

# Ratification review — the image rights floor routes to the six skills that invoke it

You are an independent reviewer for a change in the `event4u/agent-config` repository. The file `src/rules/image-likeness-and-rights.md` (and its byte-copied projection `dist/agent-src/rules/image-likeness-and-rights.md`) is a high-consequence rule (`consequence_class: irreversible-external`), so a change to it needs a two-provider verdict under ADR-268 § 4: an agent may change such a rule but may not ratify its own change.

subject: d20a5096824a18373a5d3848ac09ee4253cc6221cb7db646e430dd9e9a907eb1

(The digest covers both files at commit `b93ac11423`, computed with `./scripts-run src/scripts/ratification_subject --base-ref origin/main`.)

## Background

The rule carries `packs: [ai-image]` and no `routes_to`. A pack-scoped consequence rule is installed only when its pack is active, unless its `routes_to` names a skill — then it ships wherever that skill ships (council decision 2026-10-25, D14 of road-to-a-setup-that-decides-itself; the legal, finance and strategy floors already work this way). Six skills — image-generation, image-editing, image-provider-routing, logo-generation, brand-asset-generation, prompt-engineering-image — each tell the agent to run this rights check. Hosts that ship every skill whatever the active packs (claude-code, codex) therefore installed those skills without the rule.

## What the change does

1. Adds `routes_to` naming the six skills to the rule's frontmatter. Body unchanged.
2. Updates `tests/install/safety_floor_follows_skill.test.ts`: the test that used this rule as its example of "a consequence rule that guards no skill stays on its pack" now checks that some such rule exists, and a new test asserts this rule ships with no pack active (seen red before the `routes_to`).

## What to answer

1. Does the diff contain a defect (a wrong skill name, a frontmatter shape the installer misreads, a test that cannot fail)?
2. Does the change expand any agent's authority or weaken any gate or floor? (It changes where the rule is delivered, not what it says.)

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## The diff (complete for the gated files and the test)

```diff
diff --git a/dist/agent-src/rules/image-likeness-and-rights.md b/dist/agent-src/rules/image-likeness-and-rights.md
index fc60d3d9a9..1b10f712cd 100644
--- a/dist/agent-src/rules/image-likeness-and-rights.md
+++ b/dist/agent-src/rules/image-likeness-and-rights.md
@@ -19,6 +19,13 @@ applies_to_user_types:
 self_contained: true
 workspaces: [agent-config-maintainer, engineering, gtm]
 packs: [ai-image]
+routes_to:
+  - "skill:image-generation"
+  - "skill:image-editing"
+  - "skill:image-provider-routing"
+  - "skill:logo-generation"
+  - "skill:brand-asset-generation"
+  - "skill:prompt-engineering-image"
 collision_ok:
   "/image:": "rights/likeness gate on the image-generation surface"
   "likeness": "its own core subject — the rights gate"
diff --git a/src/rules/image-likeness-and-rights.md b/src/rules/image-likeness-and-rights.md
index fc60d3d9a9..1b10f712cd 100644
--- a/src/rules/image-likeness-and-rights.md
+++ b/src/rules/image-likeness-and-rights.md
@@ -19,6 +19,13 @@ applies_to_user_types:
 self_contained: true
 workspaces: [agent-config-maintainer, engineering, gtm]
 packs: [ai-image]
+routes_to:
+  - "skill:image-generation"
+  - "skill:image-editing"
+  - "skill:image-provider-routing"
+  - "skill:logo-generation"
+  - "skill:brand-asset-generation"
+  - "skill:prompt-engineering-image"
 collision_ok:
   "/image:": "rights/likeness gate on the image-generation surface"
   "likeness": "its own core subject — the rights gate"
diff --git a/tests/install/safety_floor_follows_skill.test.ts b/tests/install/safety_floor_follows_skill.test.ts
index 0b1bbe8b66..1e3b001dd6 100644
--- a/tests/install/safety_floor_follows_skill.test.ts
+++ b/tests/install/safety_floor_follows_skill.test.ts
@@ -47,7 +47,16 @@ describe('a safety floor follows the skills it guards', () => {
     });
 
     it('keeps a consequence rule that guards no skill on its pack', () => {
-        expect(excludedRuleBasenames(RULES, NO_PACKS)).toContain('image-likeness-and-rights.md');
+        const excluded = new Set(excludedRuleBasenames(RULES, NO_PACKS));
+        const unguarded = fs
+            .readdirSync(RULES)
+            .filter((f) => f.endsWith('.md') && typeof meta(f)['consequence_class'] === 'string' && guardedSkills(f).length === 0)
+            .filter((f) => Array.isArray(meta(f)['packs']) && excluded.has(f));
+        expect(unguarded.length).toBeGreaterThan(0);
+    });
+
+    it('ships the image floor with no pack active, since six skills link it', () => {
+        expect(excludedRuleBasenames(RULES, NO_PACKS)).not.toContain('image-likeness-and-rights.md');
     });
 
     it('names only skills that exist', () => {
```
