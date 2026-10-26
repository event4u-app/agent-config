<!-- evidence-type: analysis -->

# Ratification review — restoring the never-act-while-asking literal in a kernel rule (OQ-13)

You are an independent reviewer for a change in the `event4u/agent-config` repository. It edits `src/rules/non-destructive-by-default.md`, one of nine kernel rules, and its generated projection, so it needs a two-provider verdict under ADR-268 § 4.

Subject digest of the gated files at the reviewed commit: `17590a63f064749b2f20761301cf573ff7f74c86666abc0b073de5c828e646e4` (revision `7899417e6af973a3ff4df857f1e0959269fbc290`, branch `owner/kernel-literal-restore-20261025`).

## Context

- `tests/golden/invariants.json` protects the literal `**Never act while asking.** The ask and the action are strictly sequential: surface the confirmation, then WAIT for the answer.` Line 41 had been reworded to "Ask and action are strictly sequential: … then WAIT.", so `check_rule_invariants` was red on main.
- A council on 2026-10-25 answered owner question OQ-13 with option (a), restore the literal, 2/2. The owner chose the variant that keeps the same-turn sentence and shortens the three example clauses to stay within the zero-growth per-spawn payload ratchet. The owner applied the edit; the agent ran `task sync`.
- After the change: `check_rule_invariants` reports 19/19 present; the per-spawn payload measures 135,864 tokens against a ceiling of 135,864.

## What to answer

1. Does the diff contain a defect — does the new line 41 lose or weaken any guarantee the old line gave (including the approval-names-the-exact-object part)? Name the clause.
2. Does the change expand any agent's authority, or narrow it?
3. Anything that must change before this merges after its 24 h soak?

End with exactly one line in this format, and nothing after it:
`STANCE: <ratified | confirmed-non-expanding | refused> | CONFIDENCE: <high | med | low> | DEALBREAKER: <yes | no>`

## The diff

```diff
diff --git a/src/domains/engineering-base/pack.yaml b/src/domains/engineering-base/pack.yaml
index 96e69b6a24..79b4e25a6a 100644
--- a/src/domains/engineering-base/pack.yaml
+++ b/src/domains/engineering-base/pack.yaml
@@ -28,4 +28,4 @@ token_passport:
   other_tokens: 0
-  rules_tokens: 38650
-  total_tokens: 45332
+  rules_tokens: 38651
+  total_tokens: 45333
 trust_level_default: core
diff --git a/src/rules/non-destructive-by-default.md b/src/rules/non-destructive-by-default.md
index 311b26c7dd..96ec3c528d 100644
--- a/src/rules/non-destructive-by-default.md
+++ b/src/rules/non-destructive-by-default.md
@@ -40,3 +40,3 @@ Standing "just keep going" + next step crosses the floor → STOP, surface it (o
 
-**Never act while asking.** Ask and action are strictly sequential: surface the confirmation, then WAIT. Never fire the action in the turn you ask — no do-then-ask race, no "I went ahead and…". **The approval names the exact object**, not a category: a download names filename + size + source; a purchase names amount + card-last4 + total; a send names recipient + subject. Shape per [`user-interaction`](user-interaction.md) numbered-options.
+**Never act while asking.** The ask and the action are strictly sequential: surface the confirmation, then WAIT for the answer. Never fire the action in the turn you ask — no do-then-ask race, no "I went ahead and…". **The approval names the exact object**, not a category: download: filename + size + source; purchase: amount + card-last4 + total; send: recipient + subject. Shape per [`user-interaction`](user-interaction.md) numbered-options.
 
```
