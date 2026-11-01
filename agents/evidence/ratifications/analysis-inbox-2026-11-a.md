---
proposed_by: the repository owner, in session on 2026-11-01 (invocation "/analyze:inbox … danach arbeite die roadmaps ab mit /roadmap:process-full … erstelle am ende einen pr und merge ihn")
implemented_by: claude-opus-5.5 session on analysis/inbox-2026-11-a
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), round 1 of 2026-11-01
providers: [anthropic, openai]
verdict: confirmed-non-expanding
seats:
  anthropic: confirmed-non-expanding
  openai: confirmed-non-expanding
effective_after: merge
subject: 4b9f0d4725f57416b00026ba088c5aca753cb12cb2f88fd737792c41873217f6
---

<!-- evidence-type: ratification -->

# Ratification — two floor sentences that now match their own frontmatter

`check_kernel_edit_ratified` gates four files on this branch: the source and
projection of `engineering-safety-floor.md` and `finance-safety-floor.md`. The
`subject:` digest covers them, computed with
`./scripts-run src/scripts/ratification_subject --files <the branch's changed files>`
at commit `12dc984c83`. Named for the branch, because the pre-push gate reads
this file before the pull request exists.

## What was reviewed

- `engineering-safety-floor.md`: "Auto-active everywhere (lives in `core`)" →
  "Active with the `engineering-base` pack." The frontmatter reads
  `packs: [engineering-base]`; activation is unchanged.
- `finance-safety-floor.md`: `fundraising-narrative` leaves the finance floor's
  holds-for list. The skill ships in `founder-strategy`, where the strategy
  floor activates and already names it; the finance floor never activated for it.

Both seats: no authority widened, no activation or obligation changed, no new
statement false against the context. The open half — three skills that reach
no domain floor at all — is owner blocker `floor-reach-repair` in
`agents/roadmaps/later/road-to-a-reason-that-is-still-there.md`, untouched here.

## The prompt, verbatim

~~~
Review this change to two high-consequence safety-floor rule files under ADR-268 section 4. Return one verdict from this closed set: ratified, confirmed-non-expanding, refused, non-convergent, with your reasoning and any finding.

Context, verified at the base commit:
- finance-safety-floor activates for packs [finance-basic, finance-advanced] (its packs: frontmatter).
- strategy-safety-floor activates for pack founder-strategy and names fundraising-narrative in its own holds-for list.
- fundraising-narrative ships in pack founder-strategy (src/skills/fundraising-narrative/SKILL.md frontmatter).
- engineering-safety-floor's frontmatter reads packs: [engineering-base].

The diff:
```diff
diff --git a/src/rules/engineering-safety-floor.md b/src/rules/engineering-safety-floor.md
index 585ebe1947..da16a21e0b 100644
--- a/src/rules/engineering-safety-floor.md
+++ b/src/rules/engineering-safety-floor.md
@@ -36,7 +36,7 @@ evidence:
 
 # Engineering Safety Floor
 
-Domain safety floor for engineering output that crosses into production, infrastructure, security, or external systems. Restates the Hard-Floor obligations from `non-destructive-by-default` and adds engineering-specific surfacing requirements. Auto-active everywhere (lives in `core`).
+Domain safety floor for engineering output that crosses into production, infrastructure, security, or external systems. Restates the Hard-Floor obligations from `non-destructive-by-default` and adds engineering-specific surfacing requirements. Active with the `engineering-base` pack.
 
 ## Iron Law — production, infra, and bulk-destructive moves are never autonomous
 
diff --git a/src/rules/finance-safety-floor.md b/src/rules/finance-safety-floor.md
index 12e765ecb3..eabf94eb03 100644
--- a/src/rules/finance-safety-floor.md
+++ b/src/rules/finance-safety-floor.md
@@ -48,7 +48,7 @@ THE AGENT NEVER ISSUES A FINAL "INVEST" / "DON'T INVEST" / "RAISE" / "DON'T RAIS
 SURFACE THE TRADE-OFF. NAME THE RISK. THE HUMAN DECIDES.
 ```
 
-Holds for every finance-pack skill (`runway-cognition`, `dcf-modeling`, `scenario-modeling`, `unit-economics-modeling`, `forecasting`, `fundraising-narrative`, `forecast-accuracy`). Finance output is decision support, never the decision.
+Holds for every finance-pack skill (`runway-cognition`, `dcf-modeling`, `scenario-modeling`, `unit-economics-modeling`, `forecasting`, `forecast-accuracy`). Finance output is decision support, never the decision.
 
 ## Mandatory disclosure footer
 
```

Questions: does this change widen or narrow any agent authority or any floor's actual activation or obligations? Is any statement in the new text false against the context above?
~~~
