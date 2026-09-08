<!-- evidence-type: analysis -->
# Step 1.2's menu-exclusion lever does not exist in this tree

Pinned to commit `e010b1c2f26a57d5dabea63607e57e78a5cd3a1f`. Produced for `road-to-skill-menu-economy` step 1.2, whose
own text asserts the opposite and is corrected by this artifact.

## The claim under test

Step 1.2 of `agents/roadmaps/road-to-skill-menu-economy.md` reads: "Mark
command-only and flow-only skills `user-invocable: false` in frontmatter; **the
projector drops them from the model menu** but leaves the skill directory installed."
Its verify requires that "`check_preamble_payload_budget` catalog bucket drops by the
marked skills' name+description bytes".

Acceptance criterion 1 depends on the same mechanism: "Catalog bucket <= 10,000 tok on
Claude Code after Phase 1".

The claim is refuted on three surfaces. **Surfaces 1 and 2 are the decisive pair** —
they are code-level and reproducible from this tree. **Surface 3 corroborates them** and
is deliberately ranked lower: a delivered session catalog involves host behaviour this
repository does not own, so it is one observation rather than a property. None of the
three required the predecessor roadmap's baseline, so this finding is not blocked by it.

Ranking recorded on AI-council advice, 2026-09-08, 2 seats (anthropic + openai),
subscription transport, $0.0000 — the openai seat noted that treating all findings as
equally load-bearing overstates Surface 3, and the anthropic seat supplied the limit
recorded under **Does not establish** below.

## Surface 1 — the byte census filters on nothing (measured)

`censusSkillsCatalog` at `src/scripts/preamble_byte_census.ts:290-310` walks every
directory under `skillsDir`, reads `SKILL.md`, takes `fm.name` and `fm.description`,
and adds `` `- ${name}: ${description}\n`.length `` to a char total. It inspects
neither `user-invocable` nor `disable-model-invocation`.

Measured rather than only read. A probe copied the real `src/skills` tree, added
`user-invocable: false` to each of the 105 `command-only`/`flow-only` rows of
`agents/evidence/analysis/skill-menu-census-2026-09.md`, and censused each skill's
contribution before and after:

| Result | Value |
|---|---:|
| Candidates marked | 105 |
| Skills whose contribution changed | 1 |
| Skills whose contribution changed by 0 | 104 |
| Skill count before / after | 299 / 299 |

**The single non-zero is a defect in the probe, not a filter response, and is recorded
rather than dropped.** It is `mcp`, 145 chars to 8. `src/skills/mcp/SKILL.md:5`
**already** carries `user-invocable: false`, so the probe wrote a duplicate key into
that file's frontmatter; the block then parses with an empty `description` and the
contribution collapses to `- mcp: \n`.length = 8. `code-review` is the other
already-marked skill and shows no delta because it is classified `both` and is
therefore not in the 105-row candidate set.

Two things follow. On a clean marking the measured byte delta is **0 over 104 skills**,
which is what the verify's second limb asks for and cannot get. And incidentally, a
duplicate frontmatter key silently reduces a skill to an empty description in this
census with no diagnostic — reachable only through malformed frontmatter, so it is
noted here and claimed as nothing more.

## Surface 2 — the field is documented in this tree as governing the *user's* menu

`src/scripts/lint_agent_skill_names.ts:104` — docstring: "True when the SKILL.md opts
out of **slash registration** (`user-invocable: false`)."

Same file, `:198-207` — the comment accompanying the reserved-name floor: "Opting out
of slash registration (`user-invocable: false`) keeps the skill **model-loadable**
while the host retains the /name."

So the field this repository ships removes a skill from the **user's** slash surface
and is documented as **preserving** model loadability. Step 1.2 wants the inverse. It
would also be applied to the 105 `command-only` and `flow-only` skills — exactly the
population whose one established entry path is a command or a flow, which is the
capability loss the roadmap's own Risk 1 names, arriving from the opposite direction.

`disable-model-invocation` is not the substitute. `src/scripts/schemas/command.schema.json:9`
makes it a **required** field of a *command*, and `src/scripts/skill_linter.ts:2168`
warns it "should be 'true' for commands". One skill in the tree carries it
(`src/skills/command-writing/SKILL.md`). Nothing reads either field as a
skill-catalog filter.

## Surface 3 — the delivering host, observed first-party

Three skills in the tree carry one of the two fields today:

| Skill | Field | Census `on menu` column |
|---|---|:-:|
| `mcp` | `user-invocable: false` (`SKILL.md:5`) | no |
| `code-review` | `user-invocable: false` | no |
| `command-writing` | `disable-model-invocation: true` | — |

All three were present in the model-visible skills catalog delivered to the Claude
Code session that produced this artifact, alongside the other 296. The census's own
`on menu` column (header at `agents/evidence/analysis/skill-menu-census-2026-09.md:62`)
records `no` for the first two; the host delivered them anyway.

This is one observation on one host on one date, and bounds nothing beyond that. It is
the only direct evidence available here about the surface the acceptance criterion is
written against, and it points the same way as Surfaces 1 and 2.

## What this does and does not establish

**Establishes.** Three things, and only these. (a) The byte census does not respond to
either field: the catalog bucket measured by `check_preamble_payload_budget` is a
function of the number of `SKILL.md` files on disk and their name and description text,
and step 1.2 explicitly leaves every skill directory installed. (b) The field step 1.2
names has inverted documented semantics in this tree — it drops slash registration and
preserves model loadability. (c) On one host on one date, all three skills already
carrying one of the two fields were delivered to the model anyway.

Step 1.2's second verify limb and acceptance criterion 1 are therefore unreachable by
the mechanism step 1.2 names.

**Does not establish — and this is the limit that matters most.** It does NOT establish
the general proposition that *no* shipped field removes a skill from the model's menu.
That claim is about the **delivered** menu, and this tree has no delivered-menu census:
step 1.1's census measures file presence and reference shapes, which Surface 3 shows is
not the same thing. Proving the general claim needs an artifact that does not exist. What
is established about the delivered menu is exactly Surface 3's single observation.

It also does not establish that such a lever could not be built, or what it should be.
Building a host-side menu-exclusion path asserts a behaviour of a host this repository
does not own, and that is the subject of the explicitly owner-reserved decision held
in `agents/roadmaps/road-to-the-skill-surface-framing-choice.md`. Nothing here settles
it, and nothing here should be read as recommending an option in it.

**Does not touch.** The three counts of step 1.1's census, which stand: both 17,
command-only 101, flow-only 4, model-routed 177, orphan 0.

## Reproduction

Surface 1: read `src/scripts/preamble_byte_census.ts:290-310`; the function body is
the whole argument. The measured half is reproducible by copying `src/skills` to a
scratch directory, appending `user-invocable: false` inside the frontmatter of each
candidate row, and calling `censusSkillsCatalog` on each skill's directory before and
after — excluding `mcp` and any other skill that already carries the key, or the
duplicate-key artifact above recurs.

Surface 2: `grep -n 'user-invocable' src/scripts/lint_agent_skill_names.ts`.

Surface 3: not reproducible from the tree. It is an observation of one host's delivered
context and is labelled as such.
