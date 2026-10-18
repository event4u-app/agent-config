# Findings: type-with-a-witness-phase4
<!-- completion-review: v1 | reviewed: 2026-10-18 | scope: 14bef3e1ad8717acb264c9d3fcb527bffac7960d27fb14b88a0649f6d650d07b | diff: 89f77176e12856ad57e8b96456553dce5b3fb4ae | reviewer: r2-fresh-subagent-type-with-a-witness-phase4 | prompt_hash: 58a8a77ca297828bbf8113fe65012317f00cae000b708af30639c2823250a26b -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-type-with-a-witness-phase4"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-18 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 89f77176e12856ad57e8b96456553dce5b3fb4ae
  scope_hash: 14bef3e1ad8717acb264c9d3fcb527bffac7960d27fb14b88a0649f6d650d07b
  roadmap: agents/roadmaps/road-to-type-with-a-witness.md
  roadmap_hash: 5ab49600ccbb0045a59f765e83735c7aeaa133eb18bc62cc8dac8a8f4f6b8bbf
  ac_hash: 8c4f8e7d5345fc7f254b75620700125d6016d3b12e0d42cb9c7c253889f4545c
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-18T11:03:04Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/skills/brand-identity/SKILL.md:104 | Cross-pack relative link. `brand-identity` ships in pack `brand`, `type-design` in `frontend-design`, yet the new See-also bullet is a relative link `../type-design/SKILL.md`. In a scoped install that projects `brand` without `frontend-design`, that link dangles. The same change avoids exactly this elsewhere: `logo-generation` names the skill "not linked — it ships in another pack", and `type-design` § See also says "Named rather than linked". The ownership matrix now also records a `body_link` edge for it. | fixed | 194c3f896 |
| 2 | medium | src/skills/type-design/SKILL.md:151 | Path B can never reach `validated-static`. The label needs "every gate in `references/gates.md` is green". Gate § 6 (source fidelity) is path-A only, and gates.md:6 says "A gate the run did not execute is reported as `not run`, never as passed". A brief-driven font therefore stays at `prototype` at best. Nothing says gate 6 is not-applicable for path B. The roadmap's 4.11 wording ("every Phase 5 gate green") carries the same gap into AC-5's path B run. | fixed | 194c3f896 |
| 3 | low | src/skills/type-design/references/gates.md:15 | The expected-counter table is incomplete. It lists o e a b d p q A D O Q R B 8 0 6 9 g but omits glyphs in the `latin-basic` tier that have a counter, such as `P` (and `4` in a closed-form design). Because the check is "equal an expected table", a filled `P` counter, the exact defect this gate exists to catch, goes unchecked. | fixed | 194c3f896 |
| 4 | low | src/skills/type-design/references/font-spec.md:30 | `overshoot.pointed` is a spec field that no gate reads. gates.md § 3 checks overshoot only on o O e c s against `overshoot.round`. A pointed-apex value (A V W v) can therefore drift without any gate failing, even though the skill claims the spec is the only place a shape decision lives and the gates measure it. | fixed | 194c3f896 |
| 5 | low | src/skills/typography-system/SKILL.md:108 | The fallback-override set disagrees between carriers. typography-system § Custom source records three overrides (`size-adjust`, `ascent-override`, `descent-override`). type-design gates § 7 (gates.md:93) emits four, adding `line-gap-override`. A consumer copying the recorded set drops one descriptor the build emitted. | fixed | 194c3f896 |
| 6 | low | src/skills/type-design/SKILL.md:129 | The failing witness states differ between carriers. Step 7 says the family must read `loaded` and "never `error` or `synthesised`". gates.md:72 also fails `unloaded` and `timeout`. An agent working from SKILL.md alone could accept an `unloaded` or `timeout` reading as not-forbidden. | fixed | 194c3f896 |
| 7 | low | src/skills/type-design/references/font-spec.md:86 | The coverage tiers omit the typographic apostrophe and English closing quotes. `latin-basic` has only the straight `'` and `"`. `latin-de` adds „ “ ‚ ‘ but not ’ (U+2019, the standard apostrophe) or ”. A font can pass the coverage gate at `latin-de` and still lack the most frequent punctuation glyph in set German and English text. | fixed | 194c3f896 |
| 8 | low | src/skills/type-design/SKILL.md:189 | Incorrect pack claim. The line "this skill and its neighbours ship in different packs" is false for `typography-system` and `svg-authoring`: both are in `frontend-design` with `type-design`. Roadmap 4.14's Done note also calls svg-authoring "named, other pack". Combined with finding 1, the linked-versus-named choice is inverted: the cross-pack neighbour is linked and the same-pack ones are named. | fixed | 194c3f896 |
| 9 | low | src/skills/type-design/SKILL.md:62 | Rights gate and Do NOT contradict each other for third-party marks. The rights gate says a third party's mark "stops until its owner's rights are stated", which implies tracing can proceed once rights are stated. SKILL.md:180 forbids tracing any `third-party` class outright, and no step reclassifies a source (for example to `commissioned`) once rights are stated. The agent is left without a defined path. | fixed | 194c3f896 |
| 10 | low | src/config/skill-body-budget.json:418 | Drive-by re-encoding. The rewrite turned `\u2014`/`\u00a7` escapes into literal characters in the `_comment` and in the `reason` strings of unrelated entries (`test-case-discovery`, the earlier `svg-authoring` raise). These are hunks no task step required, and they add churn to a ratchet file. | fixed | 194c3f896 |
