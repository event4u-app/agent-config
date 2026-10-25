<!-- evidence-type: analysis -->

# Ratification review — one `routes_to` line on `legal-safety-floor`

subject: 5d87e26965f3ef6dd5dbe1ab6008d97c721ca192b4345b2eaf483942be6209ac

## The gated change

`src/rules/legal-safety-floor.md` (and its byte-identical projection
`dist/agent-src/rules/legal-safety-floor.md`) gains one line in its frontmatter:

```diff
 routes_to:
   - "skill:contract-review"
   - "skill:nda-triage"
   - "skill:dpa-review"
   - "skill:legal-intake-triage"
+  - "skill:legal-practice-profile"
```

No other line of the rule changes: not its body, its triggers, its tier, its
`consequence_class`, its packs, its trust block or its Iron Laws.

## Context

- `legal-practice-profile/SKILL.md:22` already states it "Obeys
  `legal-safety-floor`"; it was the only skill saying so that the rule's
  `routes_to` did not list.
- The same branch makes the install rule scope ship a `consequence_class` rule
  whenever its `routes_to` names a skill (an AI-council decision of 2026-10-25,
  option 1), and adds a test that every skill saying it obeys such a floor is
  listed in that floor's `routes_to`. This line is what makes that test pass.
- `routes_to` is also read by the rule router to point a triggered rule at skills.

## Question

Does this change expand any authority — what an agent may do, a gate that stops
refusing, a floor that weakens, a ceiling that rises — or not? Give your verdict
as exactly one of `ratified`, `confirmed-non-expanding`, `refused`,
`non-convergent`, with your reason.

Close your reply with EXACTLY this line, and nothing after it:
STANCE: <verdict> | CONFIDENCE: high|med|low | DEALBREAKER: yes|no
where `<verdict>` is one of `ratified`, `confirmed-non-expanding`, `refused`,
`non-convergent`.
