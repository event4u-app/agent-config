<!-- evidence-type: council-question -->

subject: 2774a5557ba7998d65735110eccbaba58cce44286cda49b1cf8b31bccc6464eb

Round 2. Review this change to one high-consequence rule file (`src/rules/image-likeness-and-rights.md`, and its byte-identical projection `dist/agent-src/rules/image-likeness-and-rights.md`). Return one verdict from this closed set: ratified, confirmed-non-expanding, refused, non-convergent, with your reasoning and any finding. End with a line `STANCE: <verdict>`.

ADR-268 section 4, in substance: an agent may modify its constitution but may not ratify its own increase in power; a high-consequence rule change needs an independent, provider-diverse review. `confirmed-non-expanding` means the change grants the agent no new authority and lowers no floor; `ratified` means an expansion was reviewed and accepted.

Round 1: both seats returned non-convergent with one shared finding — the trigger "a supplied reference image shows an identifiable person" activated on the mere presence of a reference, dropped the qualifier "real", and did not tie activation to likeness reproduction. Both proposed the same wording. This round applies it verbatim.

Context, verified at the base commit:
- The rule gates generation of a real person's likeness behind consent, routed to the policy `agents/settings/policies/media/likeness.md`.
- Before this change the trigger list named "Real person's face / body", but not the case where the user supplies a reference photo of a person (including a selfie) and asks for output built from it.
- The same change adds the matching bullet to the policy, which also states that a reference used only for lighting, pose or background, with no likeness carried into the output, is not this trigger, and that consent is never inferred from the request.

The diff against the base:

```diff
@@ -42,6 +42,7 @@ SURFACE THE RIGHTS QUESTION. REFUSE-AND-SURFACE OVER GENERATE.
 | Trigger | Gate |
 |---|---|
 | Real person's face / body (celebrity, public figure, private individual) | Likeness consent required — route to `media/likeness.md` + `media/public-figures.md` |
+| A supplied reference image depicts an identifiable real person whose likeness the requested image or video would reproduce, including the user's own likeness | Likeness consent required — the same release path in `media/likeness.md` |
 | Trademarked logo, brand mark, or product identity of a third party | Trademark clearance required — refuse without explicit rights |
```

Questions: does this change widen any agent authority or lower any floor? Is any statement in the new text false against the context above?
