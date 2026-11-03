<!-- evidence-type: council-question -->

subject: d1e867b14308ef534ee168000415e1cc19858b3bc3d4caad104f2c2c852035e9

Review this change to one high-consequence rule file (`src/rules/image-likeness-and-rights.md`, and its byte-identical projection `dist/agent-src/rules/image-likeness-and-rights.md`) under ADR-268 section 4. Return one verdict from this closed set: ratified, confirmed-non-expanding, refused, non-convergent, with your reasoning and any finding. End with a line `STANCE: <verdict>`.

Context, verified at the base commit:
- The rule gates generation of a real person's likeness behind consent, routed to the policy `agents/settings/policies/media/likeness.md`.
- Before this change the trigger list named a real person's face or body, but not the case where the user supplies a reference photo of a person (including a selfie) and asks for an image or video built from it.
- The same change adds the matching trigger bullet to `agents/settings/policies/media/likeness.md`; consent is never inferred from the request itself.

The diff:

```diff
@@ -42,6 +42,7 @@ SURFACE THE RIGHTS QUESTION. REFUSE-AND-SURFACE OVER GENERATE.
 | Trigger | Gate |
 |---|---|
 | Real person's face / body (celebrity, public figure, private individual) | Likeness consent required — route to `media/likeness.md` + `media/public-figures.md` |
+| A supplied reference image shows an identifiable person (including the user's own photo) | Likeness consent required — the same release path in `media/likeness.md` |
 | Trademarked logo, brand mark, or product identity of a third party | Trademark clearance required — refuse without explicit rights |
```

Questions: does this change widen or narrow any agent authority, or any floor's activation or obligations? Is any statement in the new text false against the context above?
