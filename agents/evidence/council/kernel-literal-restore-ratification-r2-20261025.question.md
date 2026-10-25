<!-- evidence-type: analysis -->

# Ratification review — restoring the never-act-while-asking literal in a kernel rule (OQ-13) — round 2

You are an independent reviewer for a change in the `event4u/agent-config` repository. It edits `src/rules/non-destructive-by-default.md`, one of nine kernel rules, and its generated projection, so it needs a two-provider verdict under ADR-268 § 4.

Subject digest of the gated files at the reviewed commit: `16f08f46503a0304a5adb5577e0bf962e9f39781c09793d15af769a5d94ae4b3` (revision `1ca5af9b86caa31cd1cc8132022121ba86bfd78c`, branch `owner/kernel-literal-restore-20261025`).

## Context

- `tests/golden/invariants.json` protects the literal `**Never act while asking.** The ask and the action are strictly sequential: surface the confirmation, then WAIT for the answer.` Line 41 had been reworded to "Ask and action are strictly sequential: … then WAIT.", so `check_rule_invariants` was red on main.
- A council on 2026-10-25 answered owner question OQ-13 with option (a), restore the literal, 2/2. The owner chose the variant that keeps the same-turn sentence and shortens the three example clauses to stay within the zero-growth per-spawn payload ratchet. The owner applied the edit; the agent ran `task sync`.
- Round 1 ratified the line 2/2. CI then refused two things: the rule measured 9,659 extended characters against an always-rule allowlist of 9,657 that may only shrink, and the kernel prefix snapshot was not re-anchored. Round 2 changes only this: "Shape per" becomes "Shape:" (owner edit, -3 chars, now 9,656), and `internal/bench/reports/kernel-prefix.json` is re-anchored with `check_kernel_prefix_stability --update-baseline`.
- After the change: `check_rule_invariants` 19/19 present; per-spawn payload 135,863 tokens against a ceiling of 135,864; prefix byte-stable against the new snapshot.

## What to answer

1. Does the diff contain a defect — does the new line 41 lose or weaken any guarantee the old line gave (including the approval-names-the-exact-object part)? Name the clause.
2. Does the change expand any agent's authority, or narrow it?
3. Anything that must change before this merges after its 24 h soak?

End with exactly one line in this format, and nothing after it:
`STANCE: <ratified | confirmed-non-expanding | refused> | CONFIDENCE: <high | med | low> | DEALBREAKER: <yes | no>`

## The diff

```diff
diff --git a/internal/bench/reports/kernel-prefix.json b/internal/bench/reports/kernel-prefix.json
index c9d3e13cef..e654ac1c2f 100644
--- a/internal/bench/reports/kernel-prefix.json
+++ b/internal/bench/reports/kernel-prefix.json
@@ -12,3 +12,3 @@
   ],
-  "sha256": "5a877e3611ed25f160694b2ac34cc00d1d25326b9628be61cfe43f8017423561"
+  "sha256": "8ba51df27517c7118f365b9a46854ca4addb8a77b5b62231dd8417bbf13e4849"
 }
diff --git a/src/rules/non-destructive-by-default.md b/src/rules/non-destructive-by-default.md
index 311b26c7dd..01624970f2 100644
--- a/src/rules/non-destructive-by-default.md
+++ b/src/rules/non-destructive-by-default.md
@@ -40,3 +40,3 @@ Standing "just keep going" + next step crosses the floor → STOP, surface it (o
 
-**Never act while asking.** Ask and action are strictly sequential: surface the confirmation, then WAIT. Never fire the action in the turn you ask — no do-then-ask race, no "I went ahead and…". **The approval names the exact object**, not a category: a download names filename + size + source; a purchase names amount + card-last4 + total; a send names recipient + subject. Shape per [`user-interaction`](user-interaction.md) numbered-options.
+**Never act while asking.** The ask and the action are strictly sequential: surface the confirmation, then WAIT for the answer. Never fire the action in the turn you ask — no do-then-ask race, no "I went ahead and…". **The approval names the exact object**, not a category: download: filename + size + source; purchase: amount + card-last4 + total; send: recipient + subject. Shape: [`user-interaction`](user-interaction.md) numbered-options.
 
```
