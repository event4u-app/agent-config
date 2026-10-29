<!-- evidence-type: analysis -->

# Ratification review — round 3 — the image rights floor routes to the six skills that invoke it

You are an independent reviewer for a change in the `event4u/agent-config` repository. The file `src/rules/image-likeness-and-rights.md` (and its byte-copied projection `dist/agent-src/rules/image-likeness-and-rights.md`) is a high-consequence rule (`consequence_class: irreversible-external`), so a change to it needs a two-provider verdict under ADR-268 § 4: an agent may change such a rule but may not ratify its own change.

subject: e2ddae32ca4e2354dd06eeab28b62fed083f51b96d252f8dd87ccd42ad85a43b

(The digest covers both files at commit `a4953b88a3`, computed with `./scripts-run src/scripts/ratification_subject --base-ref origin/main`.)

## Background

The rule carries `packs: [ai-image]` and had no `routes_to`. A pack-scoped consequence rule is installed only when its pack is active, unless its `routes_to` names a skill — then it ships wherever that skill ships (council decision 2026-10-25, D14 of road-to-a-setup-that-decides-itself; the legal, finance and strategy floors work this way). Six skills — image-generation, image-editing, image-provider-routing, logo-generation, brand-asset-generation, prompt-engineering-image — each tell the agent to run this rights check. Hosts that ship every skill whatever the packs (claude-code, codex) therefore installed those skills without the rule.

## Earlier rounds

Rounds 1 and 2 (`agents/evidence/council/image-floor-routes-to-ratification-r1-20261029.question.md`, `-r2-`) ratified the same `routes_to` 2/2 in a block-list form. The change was then held back because it adds tokens to the per-spawn preamble, which sat exactly at its zero-growth ceiling. The owner has since granted the cost (OQ-42, answer verbatim in `agents/evidence/owner-directives/2026-10-29-oq-42-image-floor-grant.md`).

## What changed since round 2

1. `routes_to` is written as a flow list on one line (same six entries, fewer tokens: +43 instead of +57). The rule body is unchanged.
2. A grant `oq-42-image-floor-routes-to` (43 tokens over watermark 135,824, expiring 2027-01-27) is recorded in `src/config/preamble-payload-exceptions.json`; the ledger honours it only with an independent approving review on the pull request, and its repayment is a tracked roadmap step.
3. The tests are the round-2 tests: the image floor ships with no pack active and its `routes_to` equals the set of skills whose text names the rule; every other pack-scoped consequence rule without `routes_to` stays excluded from a no-pack install.

## What to answer

1. Does the diff contain a defect (a wrong skill name, a frontmatter shape the installer misreads, a test that cannot fail, a grant entry that misstates its numbers)?
2. Does the change expand any agent's authority or weaken any gate or floor? (It changes where the rule is delivered, not what it says.)

End with exactly one stance line, in this shape:

`STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>`

## The diff (complete for the gated files, the test and the grant ledger)

```diff
diff --git a/dist/agent-src/rules/image-likeness-and-rights.md b/dist/agent-src/rules/image-likeness-and-rights.md
index fc60d3d9a9..601705c1ac 100644
--- a/dist/agent-src/rules/image-likeness-and-rights.md
+++ b/dist/agent-src/rules/image-likeness-and-rights.md
@@ -19,6 +19,7 @@ applies_to_user_types:
 self_contained: true
 workspaces: [agent-config-maintainer, engineering, gtm]
 packs: [ai-image]
+routes_to: [skill:image-generation, skill:image-editing, skill:image-provider-routing, skill:logo-generation, skill:brand-asset-generation, skill:prompt-engineering-image]
 collision_ok:
   "/image:": "rights/likeness gate on the image-generation surface"
   "likeness": "its own core subject — the rights gate"
diff --git a/src/config/preamble-payload-exceptions.json b/src/config/preamble-payload-exceptions.json
index e04c1b6755..718564deab 100644
--- a/src/config/preamble-payload-exceptions.json
+++ b/src/config/preamble-payload-exceptions.json
@@ -3,7 +3,18 @@
   "schema_version": 1,
   "registered_at": "2026-09-11",
   "owner": "maintainer",
-  "exceptions": [],
+  "exceptions": [
+    {
+      "id": "oq-42-image-floor-routes-to",
+      "granted_tokens": 43,
+      "watermark": 135824,
+      "reason": "image-likeness-and-rights gains routes_to for the six image skills that tell the agent to run it, so hosts that ship every skill also ship this rights floor. The only offsets available were cuts to other safety rules, which is the unsafe reduction this ledger exists for. Owner answer OQ-42 (a), 2026-10-29: agents/evidence/owner-directives/2026-10-29-oq-42-image-floor-grant.md.",
+      "approval_event": "an approving review, by someone other than its author, on the pull request that adds this entry (feat/oq-42-image-floor-grant)",
+      "approved_at": "2026-10-29",
+      "expires_at": "2027-01-27",
+      "repaid_at": null
+    }
+  ],
   "contract": {
     "ceiling_effect": "ceiling = max(design_ceiling, min(payload_at_base_ref, watermark) + granted_tokens, stored_ceiling?). The base is PINNED to the watermark while a grant is live, which is what stops the grant becoming permanent: without the pin, the grant raises the measurement, the next pull request measures the raised base, and the exceptional growth is the new ordinary one merge later.",
     "at_most_one_active": "At most ONE grant may be active at a time. Overlapping grants have no defined composition -- a later watermark can already contain an earlier grant's growth, so summing counts it twice. Repay or expire one before recording the next. (AI council 2026-09-11, blocking finding 1.)",
diff --git a/src/rules/image-likeness-and-rights.md b/src/rules/image-likeness-and-rights.md
index fc60d3d9a9..601705c1ac 100644
--- a/src/rules/image-likeness-and-rights.md
+++ b/src/rules/image-likeness-and-rights.md
@@ -19,6 +19,7 @@ applies_to_user_types:
 self_contained: true
 workspaces: [agent-config-maintainer, engineering, gtm]
 packs: [ai-image]
+routes_to: [skill:image-generation, skill:image-editing, skill:image-provider-routing, skill:logo-generation, skill:brand-asset-generation, skill:prompt-engineering-image]
 collision_ok:
   "/image:": "rights/likeness gate on the image-generation surface"
   "likeness": "its own core subject — the rights gate"
diff --git a/tests/install/safety_floor_follows_skill.test.ts b/tests/install/safety_floor_follows_skill.test.ts
index 49df2ba14f..ccf2aa1b80 100644
--- a/tests/install/safety_floor_follows_skill.test.ts
+++ b/tests/install/safety_floor_follows_skill.test.ts
@@ -56,6 +56,16 @@ describe('a safety floor follows the skills it guards', () => {
         for (const f of unguarded) expect(excluded.has(f), f).toBe(true);
     });
 
+    it('ships the image floor with no pack active, routed to every skill that names it (OQ-42)', () => {
+        expect(excludedRuleBasenames(RULES, NO_PACKS)).not.toContain('image-likeness-and-rights.md');
+        const naming = fs.readdirSync(SKILLS).filter((d) => {
+            const f = path.join(SKILLS, d, 'SKILL.md');
+            return fs.existsSync(f) && fs.readFileSync(f, 'utf-8').includes('image-likeness-and-rights');
+        });
+        expect(naming.length).toBeGreaterThan(0);
+        expect([...guardedSkills('image-likeness-and-rights.md')].sort()).toEqual(naming.sort());
+    });
+
     it('names only skills that exist', () => {
         for (const f of floors) {
             for (const s of guardedSkills(f)) expect(fs.existsSync(path.join(SKILLS, s, 'SKILL.md')), `${f} -> ${s}`).toBe(true);
```
