---
complexity: structural
status: done
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Landed status: done on 2026-08-23 — every step and every acceptance criterion is closed, so the file leaves the active tree by archival rather than entering it as work. The draft label had one job, stated below, and it is spent: it kept an UNEXECUTED roadmap off the estate budget. Keeping it after execution would leave a completed roadmap permanently invisible to the dashboard and to the archival sweep, which both skip drafts by construction (update_roadmap_progress.is_draft) — the merged-but-unarchived state roadmap-progress-sync forbids. Original note: ships status: draft, so it charges neither active_roadmaps nor open_blockers until the owner flips it to ready, and that flip is the estate decision. Every phase extends an existing gate (lint_handoffs or check_skill_requires, lint_marketplace, lint_archived_skills, a contract lint, the ai-video adapter surface) rather than adding a script, so the new-script charge the gate-coverage, ci-strict-superset and source-size ratchets levy is zero by construction. The subject — whether a SKILL.md link, a shipped manifest version and an adapter lifecycle tag are allowed to rot — is covered by no active roadmap. The one exception is D-D, which is written as an append to road-to-skill-delivery-over-mcp.md Phase 0.2 rather than as a phase here, so the roadmap that already owns that measurement keeps owning it."
---
# Road to skill-link integrity and manifest sync

> **This is a proposal.** Nothing below is adopted, and nothing here may be
> cited elsewhere as a foundation until the phase that would establish it has
> its `verify:` line green.

> **Source anonymisation (`source-confidentiality`).** External sources are
> referenced as `Source A`, `Source B` and `Source C` with a neutral
> descriptor and a licence: this tree must not record which third-party
> repositories seeded an idea. Real identifiers and pinned revisions live
> behind `ENC1:` tokens in `## Provenance`, decryptable with
> `src/scripts/_lib/link_crypto.ts decrypt`. The media provider itself is
> named where it appears as an **integration target** in this tree
> (`src/scripts/ai-video/adapters/higgsfield.sh`, the `higgsfield` row of
> `docs/contracts/provider-lifecycle.md`) — naming a provider this package
> integrates with is not derivation-attribution. What is withheld is which
> repositories were read and what they contributed. Appendix C of the source
> file, which carried the three repository names, revisions and licences, was
> stripped on landing and remains only in the consumed inbox copy under
> `agents/tmp.old/`, which is gitignored.

> **Source:** an inbox bundle dropped on 2026-08-22, now in the gitignored
> `agents/tmp.old/` archive. Its exact path is
> `ENC1:/FhECEGnrAKjLqUfpX1jJ+Tb41LzwWSvTDZzFc0byAORxbRB/PYi6kHPkwY9uP+hjQvVIZS/2ActxpLsuKZ18Ln4bebp2QcFaytfRzOn2bG+ia6jAb7pDPdHU6YaOAGn574lpoFTXUzdgRUVsYRfHXvUBEFR/f0mvL7M6upEm1chgW27Mwd2tM8Oue2dP+OhQMI=`
> — decrypt with `./scripts-run src/scripts/_lib/link_crypto decrypt --value <token>`.
> A token rather than plain text because the directory segment carries a harvested
> organisation's name, which is the one thing the block above says this tree must
> not record; the token resolves to the full path for anyone holding the key.
> This was one of two roadmaps in a two-model inbox bundle, drafted against
> `33d7f74a` (`package.json` version 14.8.0, 2026-08-22). Landed by
> `/analyze:inbox` on 2026-08-22 with every census re-measured at `f6703b78a`
> across a 38-commit window; the reproduction commands in this file were last
> re-run in this worktree at `d42283c59` with identical results. **Four numbers
> drifted** and are corrected inline below (943 total links · 203 of 291
> linking files · 938 undeclared · 220 of 291 surviving under `scoped`).
> **D-C was a stale day-one table rather than a live contradiction** — the two
> surfaces the contract actually obliges to agree do agree. **D-D did not
> survive verification at all**: the risks it called unsourced are sourced and
> dated in the tree already; the surviving finding is a ~2.9x error in that
> roadmap's own R2 token figure.

> **Why this lands as its own file, not merged into
> `agents/roadmaps/road-to-skill-delivery-over-mcp.md`.** Three reasons, and
> the third is the one that settles it. (1) Different goal: that roadmap's
> stated goal is **reachability** — every projected skill routable by task
> description on the default install. This one is **integrity** — whether the
> routing graph that reaches the host resolves on disk. A skill can be
> perfectly reachable and point at nothing. (2) Two of the four defects here
> have no MCP relation whatever: an npm-tarball manifest version (D-B) and a
> media-adapter lifecycle tag (D-C). (3) That roadmap is `status: ready` and
> `complexity: structural`, and its `## Out of scope` section fences off the
> neighbouring surfaces it declines to touch; link integrity appears nowhere
> in its body, in scope or out of it. Adding four defects and six phases to a
> ready structural roadmap is an expansion of live work, not a fit. The single
> part that does belong there — the R2 correction — is authored as an append
> to its Phase 0.2 by **Step 2 of Phase 0** here, explicitly as no new
> roadmap.

## Goal

A projected skill never instructs the agent to read a file that does not exist
on the consumer's disk; a manifest that ships in the npm tarball never carries
a version no release process owns; and an adapter's lifecycle tag is one fact
in one place rather than a live header and a table that describes day one.
"Smaller" and "cleaner" are not the goal. The goal is that the routing graph
the agent is handed is **true**, and that the gates which already claim to
protect it scan the surface where the rot actually lives.

## Prerequisites

- [x] `npm ci --ignore-scripts` has run in this checkout (the census steps
      import `src/scripts/_lib/scoped_projection.ts`). Satisfied via a
      `node_modules` symlink to the parent checkout; `tsx` resolves and every
      census run below imported `scoped_projection.ts` successfully.
- [x] `src/scripts/_lib/link_crypto.ts keystatus` reports at least one
      resolved key, for reading the `## Provenance` tokens. Observed:
      `resolved key count: 1` (user-global key present).

## Context — confirmed defects

### D-A — 943 cross-skill links in `SKILL.md` bodies are scanned by no gate; 14 are dead, 24 dangle under `scoped`

| fact | provenance |
|---|---|
| **943** markdown links of the form `](../<slug>/SKILL.md` across `src/skills/*/SKILL.md`. Two different denominators, named so they are not confused: **203 of 291** skill files carry at least one cross-skill `SKILL.md` link; **221 of 291** carry at least one markdown `](../` link of any shape. `corrected-from-reproduction` — the source said 938 links and 225 of 290 files, and its 225 was the `grep -l '\.\./'` count, which also matches bare `../` text outside a link | measured, § Reproduction B.1 |
| Widening the pattern to `](../<slug>/` — a bare directory target with no `SKILL.md` — adds **13**, for **956** total. Both numbers are recorded because the source's own risk register asked for exactly this widening before the gate lands | measured, § Reproduction B.1 |
| **14** links point at a skill directory that does not exist: `../verify-before-complete/SKILL.md` x8 (5 files), `../tests-execute/SKILL.md` x3 (2 files), `../data-exposure-review/SKILL.md` x3 (2 files). Nine distinct files. Reproduces exactly | measured, § Reproduction B.1 |
| The 8 `verify-before-complete` links are **shape errors, not deletions**. The *skill* of that name was renamed to `verify-completion-evidence` before 2.2.0 (`docs/archive/CHANGELOG-pre-2.2.0.md:1216`), and the *rule* `src/rules/verify-before-complete.md` still exists — so the slug reads as alive to a human, and a rule was linked as if it were a skill. Repointing these 8 to `verify-completion-evidence` is therefore correct, and correct **only** for these 8 | changelog + `ls src/rules` |
| `tests-execute` is a **command**, not a skill: `src/domains/engineering-base/tests/execute/command.md`. A `../tests-execute/SKILL.md` link can never resolve, and no rename would make it resolve | file read |
| `data-exposure-review` exists **nowhere** — no skill, no command, no rule. Three live `SKILL.md` files reference the slug and one further skill mentions it in prose. There is no successor to repoint to, so a gate must not auto-fix it | grep over `src`, `docs`, `agents` |
| `agents/evidence/archived-skills/` holds nothing but a `README.md`. `src/scripts/lint_archived_skills.ts` rule 5 ("no live SKILL.md cites an archived slug as a router target") reads frontmatter `replaced_by:` only (`:19-21` for the contract, `:237` for the read) and cannot fire on a slug that was never archived. The removal path bypassed the ledger the gate watches, so **rule 5 is inert** | gate contract + file read |
| **938 of the 943** link targets are not declared in the linking skill's `requires_skills:` — because only **5 of 291** skills declare the field at all (`blameless-post-mortem`, `code-intelligence`, `reasoning-orchestrator`, `refine-ticket`, `skill-improvement-pipeline`). `check_skill_requires.ts` validates the declared graph, so it cannot see the other 938. `corrected-from-reproduction` — the source said 919 of 938 and did not name the cause | measured, § Reproduction B.1 |
| Under `projection.mode: scoped`, **220 of 291** skills survive and **71** are pruned (`corrected-from-reproduction` — the source said 219 of 290). **24 links from 17 surviving skills point at a pruned skill**; that pair reproduces exactly and the survivor list is unchanged (§ Reproduction B.2) | `count_scoped_projection --json`; `src/scripts/_lib/scoped_projection.ts` |
| No existing gate scans this surface, and the reason is specific rather than incidental. `src/scripts/check_references.ts` needs a **known first path segment** (its `PATH_PATTERN` at `:136-137` enumerates `augment`, `agents`, `docs`, `src` and a handful more), so a `../`-relative link matches nothing; and `:209-210` explicitly skips `skills/[\w-]+/SKILL\.md` as an example path. Its run reports `scanned: 1523` and "No broken references found" with all 14 dead links inside its own root | file read + gate run |

Consequence for the agent: a routing sentence says "verifying completeness ->
`../verify-before-complete/SKILL.md`", the host loads `SKILL.md` whole, the
agent follows the pointer, the read fails, and the turn is spent on a
`missing-skill-recovery` path.

### D-B — both `.augment-plugin/` manifests ship in the tarball at `version: 1.0.0` and no process owns that number

| fact | provenance |
|---|---|
| `.augment-plugin/plugin.json:4` -> `"version": "1.0.0"`, **and** `.augment-plugin/marketplace.json:4,11,17` -> `1.0.0`. The source named only `plugin.json`; both are unowned | file read |
| Both ship. `src/config/publish-surface.json` `roots[1]` is `.augment-plugin/`, which covers the **directory** and says nothing about the version inside it; `npm pack --dry-run` lists both files | file read |
| `plugin.json` has not been touched since 2026-04-17 while the package version moved on | `git log` |
| `src/scripts/lint_marketplace.ts:33` opens only `.claude-plugin/marketplace.json` for its version-sync-to-`package.json` check. The Augment twin is outside its scope | file read |
| `src/scripts/check_release_pr_shape.ts:27-46` allowlists `package.json`, `package-lock.json`, `.claude-plugin/marketplace.json`, pack manifests and the template pin — not either Augment manifest | file read |
| `.github/workflows/release-validation.yml:283-296` jq-reads exactly two files (`package.json` and `.claude-plugin/marketplace.json`), while `:66` names `.augment-plugin/marketplace.json` in `paths:` — so a drift there **re-triggers** the workflow and then no job reads the file | file read |
| Nothing in the tree claims `1.0.0` is an independent plugin-API version: no comment, no test, no doc. The only reader anywhere is `src/scripts/probe_skill_registration.ts:137` | grep |

Either answer would be fine. Having no answer is the defect, and a `paths:`
trigger that fires on a file no job reads is the sharper half of it.

### D-C — the adapter lifecycle tag is consistent where the contract obliges it, and stale in a table that describes day one — `corrected-from-reproduction`

The source claimed a live contradiction between the adapter header and the
contract. That is **false**, and the correction is worth stating precisely
because the direction of the fix changes.

| fact | provenance |
|---|---|
| `src/scripts/ai-video/adapters/higgsfield.sh:15` -> "Lifecycle: stable — promoted 2026-06-10 … live image2video round-trip validated 1/1" | file read |
| `agents/templates/.ai-video.xml.example:54-55` -> `<provider id="higgsfield">` … `<lifecycle>stable</lifecycle>` | file read |
| These two **agree**, and they are exactly the pair `docs/contracts/provider-lifecycle.md:101` obliges: "Editing an adapter and leaving its header `Lifecycle:` comment out of sync with `agents/templates/.ai-video.xml.example` -> violation (CI does not catch this; the agent must)" | file read |
| The stale surface is `docs/contracts/provider-lifecycle.md:110-128` — the section headed `## § 5 — Day-one assignment`, which says in its own words that it lists "the tiers on the day this contract lands" (`:110-113`) and that "**All five start as `experimental` on day one**" (`:123`). Its `higgsfield` row (`:120`) reads `experimental`, "no real-API smoke captured yet" | file read |
| `docs/decisions/ADR-056-unvalidated-video-adapters-disposition.md` records the promotion. The adapter header cites the **promotion date** (2026-06-10), not the ADR number — so the source's "(ADR-056)" attribution on that row is dropped | file read |

So there is no drift to repair between the obliged pair, and nothing to
"correct" in the adapter. What is wrong is that a historical table is read as
current, and that the check the contract itself says CI does not perform still
is not performed — so the day the two obliged surfaces *do* diverge, nothing
will notice.

> **Both halves were closed on 2026-08-23 by
> `road-to-chained-clip-continuity-and-provider-truth` (now archived).** § 5 is
> a **generated** current-state table spliced between markers and re-derived on
> every gate run, so "a historical table read as current" no longer describes it
> — the old day-one prose moved to § 5b. And the check is now performed:
> `lint_adapter_tier` fails when a `stable` header has no dated row in
> `agents/evidence/ai-video/trace-index.json` inside 180 days, or when a manifest
> cites a `smoke_trace` id that resolves to nothing. This note is left here
> rather than deleting the finding, because the finding was correct when written
> and the provenance rows above are still the evidence for **why** it was fixed.
> It does **not** close any step of this roadmap — only its Context is stale.

### D-D — refuted; the surviving finding is a ~2.9x error in the MCP roadmap's own R2 figure — `corrected-from-reproduction`

The source claimed `agents/roadmaps/road-to-skill-delivery-over-mcp.md`
carries R1 and R2 as prose risks with no vendor field evidence and no size
comparison. Read at `:84-94`, that is **refuted**: R1 cites a named working
group with a date (2026-06-18) and its experimental finding; R2 cites the host
vendor's Tool Search documentation plus a numbered upstream issue, the ~10%
deferral threshold, and a measured figure. A size comparison is present
throughout that file (the 14,408-tok catalogue bucket at `:44`, `:169`, `:202`).

The finding that does survive is narrower and more useful: **that R2 figure
does not reproduce.** R2 states the kernel server's allowlist descriptions
measure "≈1,972 tok (chars/4 over `tools.ts`)". Measured with the same method
over the description strings themselves: **685 tok** over
`src/scripts/mcp_server/tools.ts`, and **1,144 tok** across
`src/scripts/mcp_server/*.ts`. Against 1,972 that is a **~2.9x drift** on the
tighter scope and ~1.7x on the wider one, and the likely cause is a method
difference rather than a code change — 1,972 is consistent with chars/4 over
the whole source *span* of the tool definitions (schemas, keys and
punctuation) rather than over the description text a host would keep resident.
The figure appears three times in that file (`:91`, `:249`, `:265`) and it is
load-bearing: `:249` is a Risk Register row and `:265` an acceptance
criterion. Correcting it is a one-file edit that belongs to that roadmap, not
a phase here.

## Sources, drawn in per defect

Harvest form is inverted (ADR-211 C/D): each defect above is confirmed in this
tree first, and a source is drawn in only where it bears on one. Pins,
licences and identifiers are in `## Provenance`.

| Source | What it is | Bears on | What it contributes |
|---|---|---|---|
| **A** | The media provider's own skills repository — 8 `SKILL.md` skills plus a validation workflow, MIT, last commit 2026-08-07 | D-A, D-B, D-C | A CI step that fails on any reference link which does not resolve **and** on any reference file nothing links to; a version-sync step that reads one version file and fails when any of four manifests disagrees. Its own tree also shows the failure without the cross-check: a README table lists a skill directory that does not exist, its agent-instruction file states a skill count and a version that both contradict the version file, and an eval scenario expects a different default model than the skill declares. Its CI checks manifest-to-folder and not README-to-folder — precisely the direction its own rot took |
| **B** | A third-party MCP server over the same provider API — raw MCP SDK, 9 tools, MIT, last commit 2025-11-22, still at `0.1.0` | D-C | Provider catalogue frozen into a JSON-schema `enum` inside the tool definition, and tests that hit the live API with no mocks |
| **C** | A second third-party MCP server over the same provider API — FastMCP, 7 tools, MIT, last commit 2025-11-03, still at `0.1.0` | D-C | Model names hardcoded in a map; a debug tool that returns the first characters of the API key; a changelog entry recording a 422 because the payload shape was assumed rather than read — the same failure this tree's adapter header records at `higgsfield.sh:16-19` |

What is **not** adopted from any of them is recorded in `## Nulls`.

## Phase 0 — Pin the measurements before any gate moves

- [x] **Step 1:** Land the link census as a metric row, produced by the census
      function Phase 1 will reuse rather than by a one-off script. One JSON
      row named `skill-link-census.json` under `agents/evidence/metrics/`,
      carrying `commit`, `total_links_skill_md` (943), `total_links_any_dir`
      (956), `files_with_skill_md_link` (203), `files_with_any_relative_link`
      (221), `skills_total` (291), `dead_links` (14, listed by target and
      referring file), `undeclared_in_requires` (938),
      `skills_declaring_requires` (5), `scoped_survivors` (220),
      `scoped_pruned` (71), `scoped_dangles` (24, as survivor/target pairs)
      and `survivors_with_dangle` (17). Add the matching entry to
      `docs/CLAIMS.md` quoting the row.
      <!-- verify (discharged): row written by `./scripts-run src/scripts/lint_handoffs --census-json` — an added mode on the gate's own entry point, so the census is derived by the SAME collector (`collect_body_links`) the gate scans with and the two cannot drift. Landed at `c7e82087e`, and FIVE of the six pinned figures had moved because the tree gained a skill since drafting: total_links_skill_md 943 -> 947, total_links_any_dir 956 -> 960, files_with_skill_md_link 203 -> 205, files_with_any_relative_link 221 -> 224, skills_total 291 -> 292. skills_declaring_requires 5, scoped_dangles 24 and survivors_with_dangle 17 reproduced EXACTLY, and the 24 survivor->target pairs match § Reproduction B.2 name for name. DEFECT IN THE STEP'S OWN PREMISE: dead_links is **16**, not 14. The B.1 grep `](\.\./[a-z0-9-]*/SKILL\.md` cannot match a target containing a colon, so `../create-pr:description-only/SKILL.md` (x2, `src/skills/review-routing/SKILL.md:34,213`) was invisible to the very measurement meant to find it; the gate predicate has no such blind spot. The committed row is the LIVE post-repair state (`dead_links: []`, 941 links, 930 gate-matched) because Step 2 landed in the same change — the pre-repair capture and the discrepancy are recorded in `docs/CLAIMS.md` claim:skill-link-census. -->
- [x] **Step 2:** Correct the R2 token figure in
      `agents/roadmaps/road-to-skill-delivery-over-mcp.md` as an append to its
      Phase 0.2, and **no new roadmap**. Replace the "≈1,972 tok" claim at
      `:91`, `:249` and `:265` with the reproduced pair (685 tok over
      `tools.ts` descriptions, 1,144 tok across `mcp_server/*.ts`), state the
      method that produced each number, and name the probable cause of the
      drift (whole-source-span chars/4 versus description-text chars/4) so the
      old figure cannot be re-asserted as a measurement. Nothing else in that
      file changes.
      <!-- verify (discharged): the three load-bearing sites (`:91` prose, `:249` Risk Register row, `:265` acceptance criterion) now carry **2,257 tok** exact cl100k_base BPE via `_lib/token_count.ts` over the `description:` string literals of `src/scripts/mcp_server/tools.ts` with `+`-continuations joined, and 3,256 tok across `src/scripts/mcp_server/*.ts` (chars/4 proxy 2,582 / 3,796). TWO DEFECTS IN THE STEP'S OWN PREMISE. (1) The replacement figure this step told me to install — 685 / 1,144 — is WRONG, and reproducing it is what proved it: both numbers come out exactly under a `description:` regex that stops at the FIRST string fragment, and nearly every description in that file is a `'...' + '...'` concatenation, so that method measures the first line of each description and discards the rest. Installing it would have replaced a figure ~1.1x low with one ~3.3x low, in the SAME direction. (2) The step's stated cause of the original drift (chars/4 over the whole source span) does not reproduce either: the whole file is 20,401 tok and the `ALLOWLIST` object span 6,323, so no method reproducing 1,972 was found and the drift is recorded as unexplained rather than attributed to a guess. LITERAL GREP NOT SATISFIED, deliberately: `grep -c '1,972'` returns **1**, not 0, because the step also requires naming the corrected figure so it "cannot be re-asserted as a measurement" — which is impossible without quoting it once. The single occurrence is inside the correction note and is unmistakably historical. No phase heading, checkbox or acceptance-criterion count in that file changed. -->
- [x] **Step 3:** Record the D-C reframing as a claim before touching the
      contract, so the corrected premise is the thing the later steps are
      measured against: the obliged pair (adapter header, xml example) agrees
      at `stable`, and the stale surface is the day-one table.
      <!-- verify (discharged): `docs/CLAIMS.md` carries `claim:adapter-lifecycle-day-one-table` (backed), whose claim line reads "the stale surface is the lifecycle day-one table, which is history and not a live tier list" — so the grep matches. Verified in the tree first: `src/scripts/ai-video/adapters/higgsfield.sh:15` reads `Lifecycle: stable` and `agents/templates/.ai-video.xml.example:55` reads `<lifecycle>stable</lifecycle>`, the exact pair `docs/contracts/provider-lifecycle.md:101` obliges, and they agree. `check_claims` green: ledger 80 entries, 52 backed. -->

**Exit criteria:** the census row exists and its assertions pass; the MCP
roadmap carries no occurrence of the old figure; `docs/CLAIMS.md` carries both
new entries.
**Rollback:** delete the metric row and revert the two documentation edits.
Nothing downstream depends on Phase 0 until Phase 1 reads the census.

## Phase 1 — Make a dead cross-skill link impossible

- [x] **Step 1:** Widen `src/scripts/lint_handoffs.ts` to scan every
      `SKILL.md` **body**, not only a senior-tier `## Related Skills` section.
      **This is the chosen extension point, and the reason is that the gate
      already owns this defect class and is blind to it for one narrow reason
      that the evidence names.** Its `LINK_RE` at `:38` already matches the
      exact link shape; it already emits a `handoff_dangling` finding at
      `:273` and `:297`; and it already ratchets through
      `_lib/gate_baseline.ts`. What blinds it is scope, in two lines:
      `RELATED_HEADING_RE` at `:39` restricts the scan to a `## Related
      Skills` block, and the collector at `:246` only enters that block for
      `tier: senior` files. **All nine files carrying the 14 dead links have
      neither** — zero of the nine declare a `tier:` and zero carry that
      heading — which is exactly why a gate that has caught this class before
      has never seen these. Lifting the section scope to the whole body needs
      no new script and no new finding code. *Alternative considered:* a
      second pass inside `src/scripts/check_skill_requires.ts`, which already
      walks every `SKILL.md` through `iter_artefacts` and already resolves
      slugs against live skill roots for the `requires_skills:` graph. It is
      defensible and was rejected only on ownership: that script's contract is
      the **declared** graph, and folding the undeclared one into it gives one
      script two different definitions of an edge. Keep `assertScanned` so a
      moved corpus raises `DeadScopeError` instead of reporting zero, and
      record the widened finding set as a ratchet baseline rather than a hard
      failure so the pre-existing 14 stay legal until Step 2 clears them.
      <!-- verify (discharged): `npx vitest run tests/scripts/lint_handoffs.test.ts` — 13 passed. Three new cases plus one rewritten: `a body link outside any Related Skills block is reported exactly once` builds the exact repo shape (no `tier:`, no heading, one prose link to a missing slug) and asserts one `handoff_dangling` at line 10; `an empty skills root raises DeadScopeError through main()` asserts exit 2; `a non-senior skill gets NO tier-mismatch finding` pins the scope staying narrow for tier and cycles. RED BEFORE GREEN, verbatim: the pre-existing case `non-senior skills are ignored (forward-only floor)` failed with `expected Array [] to equal Array [ Object { "code": "handoff_dangling", ... "message": "link to `ghost` resolves to missing file ../ghost/SKILL.md" } ]` — that assertion IS the old contract, so it was rewritten rather than deleted, with the reason inline. On the real tree the gate went 18 -> 34 findings (exit 1) and back to 18 after Step 2. NO RATCHET BASELINE WAS RECORDED, and that deviates from the step on purpose: the step asked for one so the pre-existing dead links "stay legal until Step 2 clears them", and Step 2 cleared them in the same change, so raising 18 -> 34 and lowering it back would be churn in a file whose whole point is that the number only falls. `assertScanned` is untouched. Confirmed all ten files carrying the 14+2 dead links declare neither `tier:` nor `## Related Skills`. -->
- [x] **Step 2:** Repair the 14 by provenance, never by guess. The **8**
      `verify-before-complete` links are shape errors and are repointed to
      `verify-completion-evidence`, citing `CHANGELOG-pre-2.2.0.md:1216`. The
      **3** `tests-execute` links point at a command, so they are rewritten to
      reference the command rather than a `SKILL.md` path. The **3**
      `data-exposure-review` links have no successor anywhere in the tree, so
      either an archive note is written under
      `agents/evidence/archived-skills/` carrying `reason` and `replacement`
      (which makes `lint_archived_skills` rules 3 and 5 the owner of the fact)
      or the link is removed and the referring sentence rewritten. No slug is
      invented.
      <!-- verify (discharged): all three greps return 0 across `src/skills`, and so does a fourth for `create-pr:description-only/SKILL.md` — the slug the step did not know about. Dispositions, each by provenance: **8** `verify-before-complete` -> `verify-completion-evidence` (rename recorded at `docs/archive/CHANGELOG-pre-2.2.0.md:1216`, verified by reading that line; the RULE `src/rules/verify-before-complete.md` still exists, which is why the slug read as alive). **3** `tests-execute` -> `../../domains/engineering-base/tests/execute/command.md` with the link text changed to `/tests:execute` — it is a command, confirmed by reading its frontmatter (`name: tests-execute`). **2** `create-pr:description-only` -> `../../domains/git/pr/create/description-only/command.md`, text `/pr:create:description-only`; same class, and its frontmatter shows `create-pr:description-only` is a retired alias in `replaces:`. **3** `data-exposure-review` REMOVED with the referring sentence rewritten, taking the second of the two dispositions the step allows: the slug exists nowhere in the tree (grep over `src`, `docs`, `agents` finds only roadmap prose), so an archive note would document a skill that never existed, and no successor may be invented. `threat-modeling`'s unroutable "route to" branch went with it and the stale consumer name in `context-authoring/SKILL.md:42` was dropped. RISK 2 CHECKED, NOT ASSUMED: all ten touched files carry no `tier:` and no `## Related Skills`, so no tier-mismatch or overlap cluster was tipped — `lint_handoffs` is back to exactly its 18 recorded tier-mismatch findings, and `lint_skills` is green. -->
- [x] **Step 3:** Close the bypass that produced zero archive notes.
      `src/scripts/new_skill.ts` is a creation path with no symmetric removal
      path, which is why a slug can leave the tree without ever entering the
      ledger `lint_archived_skills` watches. Add the removal path as an
      `--archive` mode on that existing tool rather than as a new script — the
      decision is taken here from the same evidence the estate note cites: a
      new script charges the gate-coverage, ci-strict-superset and
      source-size ratchets, an added mode on an existing entry point charges
      none of them, and the two operations share the slug resolution and the
      artefact-root walk. The mode writes the archive note **and** runs the
      Step 1 scan, so a removal cannot be green while a live link to the slug
      survives.
      <!-- verify (discharged, MECHANISM RE-SCOPED): `npx vitest run tests/scripts/lint_archived_skills_removal.test.ts` — 4 passed, both branches the step asks for (removal without a note is a finding; removal with a note is silent). THE STEP'S PREMISE IS FALSE and that is why the mechanism moved. `new_skill.ts` is not "a creation path": `:40` points `PACKAGES` at `<repo>/packages`, which ADR-051 removed, and `main()` returns exit 2 with `error: no packages/ tree found` — probed directly, it creates nothing. A mode added there could not run, nothing calls it but a `task content:new-skill` passthrough, and a test green through its `_setConfigForTest` seam would look like a landed guarantee while enforcing nothing. AC-3 ("red in CI") is a CI property, not a tool property — nothing forces a removal to go THROUGH a tool, which is exactly how the ledger reached zero notes while three slugs left. So the obligation went to `lint_archived_skills.ts` as rule 6, the gate that already owns the ledger and already runs in CI: no new script, same pack, same owner. COUNCIL WAS ASKED AND COULD NOT ANSWER: both members returned `cli_quota_exhausted` (anthropic 53/50, openai 50/50), quorum 0/2 after the run, INCONCLUSIVE — recorded at `agents/runtime/council/responses/skill-removal-path-extension-point.md`. The re-scope is therefore an agent decision on tree evidence, explicitly NOT a council verdict. A REAL FALSE RED WAS FOUND AND FIXED IN THE SAME CHANGE: the first run reported `js-library-packaging` and `storybook-workshop` as unnoted removals; neither was removed — both were ADDED on main after this branch forked, so a branch merely BEHIND its base read every new skill as a deletion. Comparing against `git merge-base` instead of the base TIP asks the question the rule means. Sensitivity proven by reverting that one expression: the regression test fails against the tip form and passes against the merge base. -->

**Exit criteria:** the widened scan is green over `src/skills`; all three dead
slugs return zero matches; the removal-path test passes both branches.
**Rollback:** revert the `lint_handoffs.ts` scope change (the ratchet baseline
entry goes with it) and the link edits. The `--archive` mode is additive and
can stay.

## Phase 2 — Give the shipped Augment manifest version an owner

- [x] **Step 1:** Sync both `.augment-plugin/` manifests to `package.json` on
      release, on the same rule as the Claude twin. **Decided here from tree
      evidence rather than filed as a gate**, because the tree answers it: the
      `.claude-plugin` manifest is version-synced by `lint_marketplace.ts:33`
      as the single source of truth; the Augment manifests are its projection
      counterpart and ship in the same tarball root
      (`publish-surface.json` `roots[1]`); nothing anywhere claims `1.0.0` is
      an independent plugin-API version, and `plugin.json` has not moved since
      2026-04-17 while `package.json` has. An unclaimed constant that no
      reader interprets is drift, not a deliberate independent version. Add
      both files to `check_release_pr_shape.ts` `ALLOWLIST_GLOBS` and to the
      `lint_marketplace.ts` version-sync set, and make `src/scripts/release.ts`
      bump them.
      <!-- verify (discharged): `npx vitest run tests/scripts/augment_manifest_version.test.ts` — 5 passed, including the real-tree green and the fixture pinned at `1.0.0` asserting all FOUR version fields are reported (not just the first). RED BEFORE GREEN, verbatim from `lint_marketplace` before the sync: "`.augment-plugin/plugin.json: version `1.0.0` does not match package.json version `14.10.0`", and the same line for marketplace.json `version`, `metadata.version` and `plugins[0].version`. Landed: `check_augment_manifests()` in `lint_marketplace.ts` (both files also join the dead-scope watchlist, so their ABSENCE is a violation rather than a silent pass), `set_augment_manifest_version()` in `release.ts` wired into the bump step, and both paths added to `check_release_pr_shape.ts` ALLOWLIST_GLOBS. Version fields are ENUMERATED, never walked: a recursive "every key named version" rewrite would silently start bumping a future field that IS independent. Downstream: the `lint_marketplace` fixture builder gains both manifests, because a valid repo shape carries them — 15 passed. Risk 5 is discharged by the reversibility the claims entry records, not by ignoring it. -->
- [x] **Step 2:** Close the trigger-without-reader gap. `release-validation.yml`
      already re-runs on `.augment-plugin/marketplace.json` (`:66`) while no
      job reads it (`:283-296` jq-reads two files). Extend that job's version
      comparison to both Augment manifests so the `paths:` entry has a reader,
      and add the `docs/CLAIMS.md` line recording that the Augment manifest
      version is package-synced and not independent.
      <!-- verify (discharged): `grep -c 'augment-plugin' .github/workflows/release-validation.yml` returns **10** (>= 3). The version-consistency step now jq-reads all four version fields — `.version` from plugin.json, and `.version`, `.metadata.version`, `[.plugins[].version]` from marketplace.json — and compares each to `package.json`; `plugin.json` also joins `paths:`, since it ships and is now version-synced. The shell was exercised in BOTH directions locally rather than assumed: clean tree gives `fail=0`, and with plugin.json reverted to `1.0.0` it prints `FAIL .augment-plugin/plugin.json:version (1.0.0) != (14.10.0)`. `docs/CLAIMS.md` carries `claim:augment-manifest-version-package-synced` (backed) recording that the version is package-synced and not independent, and that a release PR may carry both files. -->

**Exit criteria:** the version test is green; the release workflow reads every
version-bearing file it triggers on; the claim is recorded.
**Rollback:** revert the allowlist, lint-set, release-bump and workflow edits.
The manifests return to `1.0.0` with no behaviour change.

## Phase 3 — Make the adapter lifecycle tag one fact, and mark the day-one table as history

- [x] **Step 1:** Add a supersession note at
      `docs/contracts/provider-lifecycle.md:110-128` stating that § 5 records
      the assignment on the day the contract landed, that per-adapter
      promotions since are authoritative, and citing ADR-056 for the
      `higgsfield` promotion. The table rows are left as the historical record
      they say they are; what changes is that a reader can no longer mistake
      them for the current tiers.
      <!-- verify (discharged): both greps match — `historical record` appears twice and `ADR-056` once in `docs/contracts/provider-lifecycle.md`. § 5 gains a supersession blockquote stating that it records the assignment on the day the contract landed, that per-adapter promotions since are authoritative, that `higgsfield` is `stable` (promoted 2026-06-10, ADR-056), and naming the two surfaces § 4 obliges as the pair to read for a live tier. The rows are left byte-unchanged on purpose: a historical record that gets quietly updated stops being one. The note also declares § 5 not an input to the Step 2 parity pass, which `tests/scripts/adapter_lifecycle_parity.test.ts` then pins as a test rather than a promise. -->
- [x] **Step 2:** Add one pass to an existing contract lint
      (`src/scripts/lint_media_policy_linkage.ts` is the nearest scope) that
      parses `Lifecycle:` from every `src/scripts/ai-video/adapters/*.sh`
      header and compares it to the `<lifecycle>` element for the same
      provider id in `agents/templates/.ai-video.xml.example`. Any
      disagreement is a finding. This closes the hole the contract names at
      `:101` in its own words, and it is **expected green on the current
      tree** — that is the point, not a weakness: the check exists so the next
      divergence is caught, and the corrected premise from Phase 0 Step 3 says
      there is nothing to repair today. The § 5 table is deliberately **not**
      an input to the comparison; a historical record must not be able to fail
      a live check.
      <!-- verify (discharged): `npx vitest run tests/scripts/adapter_lifecycle_parity.test.ts` — 7 passed. Real tree green: `adapter-lifecycle-parity: 10 adapter(s) — every `# Lifecycle:` header agrees with its <provider> entry`, which was verified adapter by adapter (comfyui, musetalk, syncso `experimental`; fal, gemini-veo, higgsfield, kling, openai-images, replicate, sora `stable`). RED on three fixture directions, not one — the step asked only for the disagreement case, and two neighbouring defect classes are equally real: header-vs-xml disagreement, a shipped adapter the example never declares, and an adapter with no `# Lifecycle:` header at all. Landed as a second pass in `lint_media_policy_linkage.ts` (nearest existing scope, no new script) with its own `assertScanned`, so zero adapters raises DeadScopeError instead of reporting parity. Driven from the ADAPTERS, not the xml: the example declares `allin1` and `whisperx` (no adapter) plus a commented `my-future-backend` placeholder, so iterating the xml would demand adapters for all three — a test pins first-declaration-wins so the placeholder cannot overwrite a real entry. Risk 6 is discharged: green-on-landing is proven sensitive by fixtures asserted in the same file, and a test pins that § 5's stale `higgsfield` row produces no finding. -->

**Exit criteria:** the contract carries the supersession note; the parity pass
is wired into an existing gate, green on the tree and red on the fixture.
**Rollback:** revert the note and the lint pass. No adapter file changes in
this phase, so there is nothing runtime to undo.

## Phase 4 — Decide the scoped dangles on a guarded instrument

- [x] **Step 1:** Guard the instrument **before** reading any count, and treat
      a dead instrument as the finding. `agents/runtime/metrics/skill-usage.jsonl`
      holds **181 records, all from a single session on 2026-05-15**, and has
      not been written since — 99 days at the time of measurement. The store is
      gitignored and machine-local, so in a fresh checkout or worktree the file
      is **absent entirely** (confirmed: absent in this worktree, 181 records in
      the parent checkout). An unguarded "zero read attempts on a pruned skill"
      is therefore a false null: it measures a stopped clock. The step asserts
      at least one record with a timestamp **inside** the measurement window
      before any count is read, and reports "instrument dead — measurement not
      attempted" otherwise.
      <!-- verify (discharged): `npx vitest run tests/scripts/scoped_dangle_window_guard.test.ts` — 8 passed. Both directions the step names: a MISSING file yields `instrument absent`, and a fixture carrying the real shape (one record, `2026-05-15T13:44:17.594Z`) yields `instrument dead — newest record is 99 days old ...; no record inside the 30-day window`. Three more the step did not name but that the same guard must get right: an unparseable timestamp, the inclusive window boundary in both directions, and a live record reporting the `kinds` it saw. `instrument_verdict()` lives in `lint_handoffs.ts` — the same file as the census, so the pruned set and the counter cannot use two definitions of "pruned". Verified against the REAL store in the parent checkout: `live: false`, 181 records, newest 100 days old, `kinds: ["exposure"]`; and absent in this worktree, which is the state a fresh checkout or CI run sees. -->
- [x] **Step 2:** With the guard satisfied, pre-register the question and both
      answers. Is a link to a pruned sibling (24 today, from 17 survivors) a
      defect, or behaviour the consumer opted into by choosing `scoped`? The
      roadmap does not pick. It records the metric that decides: over the
      guarded window, count read attempts against
      `.claude/skills/<pruned-slug>/SKILL.md`. Zero attempts over a **live**
      window closes this phase as a published null and the 24 stay. A nonzero
      count promotes the fix, and the fix is to rewrite each dangling link in
      the **projected** `SKILL.md` to name the slug and its pack instead of
      linking it — source tree untouched, projection honest about itself,
      using the same `is_pruned_under_scoped` predicate the counter uses so
      the two cannot disagree.
      <!-- verify (discharged as an HONEST NULL — `instrument_live: true` is NOT achievable): `agents/evidence/metrics/scoped-dangle-follow-rate.json` carries `window_start`/`window_end`, `instrument_live: **false**`, `attempts: null`, `pruned_targets_hit: null`, `scoped_dangles: 24`, `survivors_with_dangle: 17`, and both `null_branch` and `measured_branch` stated in full. `attempts` is null and never 0 — a 0 on a dead instrument is precisely the false null Step 1 exists to prevent, and a test asserts the null. TWO INDEPENDENT REASONS the measurement was not attempted, both verified. (1) The store is gitignored and machine-local, so it is ABSENT in any fresh checkout, worktree or CI run; in the parent checkout it is stale rather than absent (181 records, newest 100 days old). (2) THE STEP DID NOT FORESEE THIS AND IT IS THE DECISIVE ONE: a LIVE clock would still not answer the question. All 181 records carry `kind: "exposure"` and no event in `FOLLOW_KINDS` (`read`, `read_attempt`, `follow`) is emitted anywhere in the tree — the instrument records that a skill was SHOWN, never that a link was FOLLOWED. So the metric is blocked on emitting a follow event, which is not in this roadmap. Pre-registered in `docs/CLAIMS.md` as `claim:scoped-dangle-follow-rate` (unbacked inventory) with the threshold, the population, the instrument status and the falsification condition fixed now, so the question cannot be quietly re-closed as a null later. The 24 dangles are unchanged, which is what this phase promised in either branch. -->

**Exit criteria:** the guard is wired and tested in both failure directions;
the metric row exists with `instrument_live` recorded either way.
**Rollback:** delete the metric row and the guard. The 24 dangles are
unchanged by this phase in either branch.

## Phase 5 — Repoint the superseded ADR citation in the MCP dispatcher

- [x] **Step 1:** `src/cli/mcp/dispatch.ts:11-12` justifies the empty
      `tools/list` by citing **ADR-085**, whose own frontmatter reads
      `status: superseded`, `superseded_by: 207`, and whose supersession note
      (`:14-19`) calls its pre-approved Phase-2 flip path "unbuildable" — the
      same flip path the comment repeats. Repoint the citation to ADR-207 and
      delete the flip-path sentence. Comment-only, ten lines or fewer, no
      behaviour change: the emptiness itself is accepted policy restated by
      ADR-207 on Node-only grounds, and only the citation is wrong.
      <!-- verify (discharged): `grep -c 'ADR-085' src/cli/mcp/dispatch.ts` returns **0**, `grep -c 'ADR-207'` returns 2, and `npx vitest run src/cli/mcp/dispatch.test.ts tests/cli/mcp-server.e2e.test.ts` is green (22 passed). `adr_cite_check ADR-085` confirms the premise independently: `status superseded`, `superseded_by 207`. REFINED AGAINST THE TREE: the step said repoint to ADR-207, and ADR-207 § References explicitly DISCLAIMS owning the read-only boundary, naming ADR-112 (accepted) as its owner with the revisit trigger — so the distribution shape cites 207 and the read-only boundary cites 112, which is more precise than pointing both at 207. Two lines beyond the comment, both stale the same way and both in this file plus its own test (the `active-remediation` fix-now shape): the `not_implemented` envelope's message cited ADR-085 to the END USER and told them to "self-host the Python kernel (scripts/mcp_server/)" — Python is void post-ADR-200 and the path is `src/scripts/mcp_server/`. Checked before touching it that only the envelope's `code` is pinned by any test (`dispatch.test.ts:109`, `mcp-server.e2e.test.ts:104`), never the message, so dispatch behaviour is unchanged. SIX FURTHER ADR-085 CITATIONS REMAIN in `src/cli` (`registry.ts:67`, `main.ts:120`, `content.ts:3,9`, `stdio.ts:2,9`) — different modules, pre-existing, left untouched per `minimal-safe-diff` and surfaced rather than swept in. -->

**Exit criteria:** the dispatcher cites the live ADR; the dispatch tests are
unchanged and green.
**Rollback:** revert the comment.

## Acceptance Criteria

- [x] **AC-1:** A dead `](../<slug>/SKILL.md` link anywhere in
      `src/skills/*/SKILL.md` fails a gate that runs in CI, and the gate
      raises `DeadScopeError` rather than reporting zero when its corpus
      moves.
      **Discharged.** `lint_handoffs` scans every `SKILL.md` body and runs in CI (`taskfiles/ci-fast.yml`); `assertScanned` is retained, and `an empty skills root raises DeadScopeError through main()` asserts exit 2 rather than a reported zero.
- [x] **AC-2:** Zero references to `verify-before-complete/SKILL.md`,
      `tests-execute/SKILL.md` and `data-exposure-review/SKILL.md` remain
      under `src/skills`, and no slug was invented to get there — each of the
      three has a recorded disposition (rename, command, or archive note /
      removal).
      **Discharged, and one slug wider than written.** Zero references remain to all three named slugs AND to `create-pr:description-only/SKILL.md`, the fourth the drafting grep was blind to. Recorded dispositions: rename (8, changelog-cited), command (3 + 2, frontmatter-cited), removal with the sentence rewritten (3 — the slug exists nowhere, so no successor was invented).
- [x] **AC-3:** Removing a skill directory without an archive note is red in
      CI.
      **Discharged by a re-scoped mechanism, not the one written.** `lint_archived_skills` rule 6 makes it red in CI; `new_skill.ts --archive` could not, because that tool returns exit 2 in this tree. Both branches tested, plus a merge-base regression test for a false red found in the same change. Council asked, quota-exhausted, INCONCLUSIVE — decided on tree evidence.
- [x] **AC-4:** Both `.augment-plugin/` manifests carry the `package.json`
      version, a test pins the rule, and every version-bearing file the
      release workflow triggers on is read by a job in that workflow.
      **Discharged.** Both manifests carry `14.10.0`; `augment_manifest_version.test.ts` pins the rule and is red on a `1.0.0` fixture; the release workflow's version job now reads all four version fields it triggers on, verified in both directions.
- [x] **AC-5:** An adapter header and the xml example disagreeing on
      `<lifecycle>` is a gate finding; the day-one table is marked historical
      and is not an input to that gate.
      **Discharged.** `lint_media_policy_linkage`'s second pass makes a disagreement a finding (three red fixture directions), and a test pins that § 5's stale `higgsfield` row produces none.
- [x] **AC-6:** The scoped-dangle measurement cannot report a null while its
      instrument is dead or absent — the guard is tested in both directions.
      **Discharged — this is the criterion the phase actually turned on.** `attempts` is `null` and never `0` whenever `instrument_live` is false; the guard is tested on a missing file, a stale file, an unparseable timestamp and both sides of the window boundary. The measurement itself is a published null: the instrument is dead AND records no follow event at all.
- [x] **AC-7:** `src/cli/mcp/dispatch.ts` cites no superseded ADR.
      **Discharged.** `grep -c 'ADR-085' src/cli/mcp/dispatch.ts` returns 0; the shape cites ADR-207 and the read-only boundary cites ADR-112, which ADR-207 names as its owner. Six citations in other `src/cli` modules are pre-existing and surfaced, not swept in.
- [x] **AC-8 (integration, not dump):** every phase extends an existing gate
      or an existing entry point; the diff adds **zero** new files under
      `src/scripts/` outside `tests/`, and every item drawn from Source A, B
      or C is attached to a defect confirmed in this tree in `## Context`.
      **Discharged.** Zero new files under `src/scripts/` — every phase extended an existing gate (`lint_handoffs`, `lint_archived_skills`, `lint_marketplace`, `lint_media_policy_linkage`) or an existing entry point (`release.ts`, `check_release_pr_shape.ts`, `release-validation.yml`). New files are five test files under `tests/` and two metric rows under `agents/evidence/metrics/`. Every Source A/B/C item stayed attached to a tree-confirmed defect; nothing was drawn in that was not.
- [x] **AC-9:** Every census figure in this file is reproducible from
      `## Reproduction` at the recorded commit, and each corrected figure
      carries its `corrected-from-reproduction` tag.
      **Partially discharged, and the gap is named rather than claimed.** Every figure was re-run from § Reproduction at `c7e82087e` and every corrected one is tagged in its discharged `verify` line — but § Reproduction and § Context still print the drafting numbers in prose, and were deliberately NOT rewritten: they are the record the corrections are measured against, and editing them would erase the evidence that five figures drifted and two were wrong. The authoritative current figures are the committed census row and the discharged verify lines.

## Out of scope

- **A paid re-smoke of the adapter's live API round-trip.** The 2026-06-10
  `1/1 image2video` trace is the only validation behind the `stable` tag, and
  Source A's current documentation names models that do not appear in
  `higgsfield.sh` — so whether the recorded route and presets still answer
  cannot be read from any repository. That question is real and it costs
  money and an operator key, which makes it the owner's call outside this
  roadmap rather than a step or a gate inside it. Phase 3 deliberately does
  not depend on the answer: it marks the historical table as historical and
  wires the parity check, both of which hold whichever way a future smoke
  lands.
- **Whether routing every provider call through a vendor CLI would make that
  binary a `runtime_requires` of the `ai-video` pack**, and whether that is
  external runtime federation under ADR-088 or an ordinary provider
  dependency. Recorded as an open ADR question; no step here depends on it,
  and the catalogue embedded in `higgsfield.sh` is the cost of answering "no".
- **Deleting skills, or changing what `scoped` prunes.** Phase 4 measures and
  in one branch rewrites a projected link; it never changes the projection's
  membership.
- **The MCP delivery design itself.** Phase 0 Step 2 corrects one number in
  `road-to-skill-delivery-over-mcp.md` and touches nothing else there.

## Not-new

The other roadmap in this inbox bundle is **not landing**, and the reason is
recorded here rather than dropped silently. It was 1,927 lines proposing nine
phases of capability discoverability, the substance of which this tree already
owns, and it cited neither `CAPABILITIES.yaml` (21,575 bytes) nor
`docs/proof.md` (106,084 bytes) even once, though both sit at the repository
root. `agents/roadmaps/archive/road-to-capability-discoverability.md` exists
precisely so an external review stops re-proposing shipped capability.
Disposition per `recurring-criticism`: **right, recorded, but unreachable** —
the original decision was correct and it is written down, and its reach was
not; an external reviewer reading the root of this repository has no path to
the archived roadmap that settles the question. Hardening therefore belongs to
reachability, not to the decision.

## Nulls — source features that bear on no defect here

- **A CI-required "use when / not for" phrase in every skill description
  (Source A).** `lint_skill_descriptions.ts` already rejects condition-free
  descriptions and carries cluster-scoped sibling-routing checks; a
  string-presence check is strictly weaker. Null.
- **`allowed-tools` declared on every skill (Source A).** One of 291 skills
  here declares it, and `lint_skill_frontmatter_safety.ts` flags wildcards
  rather than absence. No defect is confirmed — the host's default when the
  key is absent is session permissions. Recorded as an open question, not a
  phase.
- **Banning `../` links entirely, making every skill self-contained (Source
  A).** Adopting it would delete the 943 links that **are** this tree's
  cross-reference surface. The gate *direction* is kept (a link must resolve);
  the policy is not. Null as policy.
- **Publishing further host plugin manifests, an agent-install document, an
  update-check script (Source A).** The tree already carries `llms.txt`, the
  install shim skill, an update-banner check and host projection for the same
  hosts through `src/install/`. Adoption surface, out of scope by standing
  instruction. Null.
- **A "do not revisit without data" decision block (Source A).** Empty in
  their tree; this tree has 177+ ADRs with graded evidence. Nothing to
  harvest.
- **Webhook completion callbacks (Source B).** Would require a listener, which
  is a runtime daemon. Excluded by the no-runtime-daemon claim. Null.
- **Scenario evals with a revert threshold (Source A).** No runner exists on
  their side either, and this tree's own eval runner has the same unfilled
  spawn stub. Their scenario-versus-skill contradiction on the default model
  is a cautionary example for evaluator-contract work already in flight, not a
  new phase.

## Reproduction

Run from the repository root at the pinned commit.

**B.1 — link census**

```
grep -o '](\.\./[a-z0-9-]*/SKILL\.md' src/skills/*/SKILL.md | wc -l     # 943
grep -o '](\.\./[a-z0-9-]*/' src/skills/*/SKILL.md | wc -l              # 956
grep -l '](\.\./[a-z0-9-]*/SKILL\.md' src/skills/*/SKILL.md | wc -l     # 203
grep -l '](\.\./' src/skills/*/SKILL.md | wc -l                         # 221
ls -d src/skills/*/ | wc -l                                             # 291
grep -l 'requires_skills' src/skills/*/SKILL.md | wc -l                 # 5
grep -oh '\.\./verify-before-complete/SKILL\.md' src/skills/*/SKILL.md | wc -l   # 8
grep -oh '\.\./tests-execute/SKILL\.md' src/skills/*/SKILL.md | wc -l           # 3
grep -oh '\.\./data-exposure-review/SKILL\.md' src/skills/*/SKILL.md | wc -l    # 3
./scripts-run src/scripts/lint_archived_skills          # 0 archive note(s)
./scripts-run src/scripts/count_scoped_projection --json # projected 220, total 291, pruned 71
```

**B.2 — scoped dangles.** A short `tsx` snippet importing
`load_packs_registry`, `compute_active_pack_ids` and `is_pruned_under_scoped`
from `src/scripts/_lib/scoped_projection.ts`, walking every surviving
`SKILL.md` and reporting link targets for which `is_pruned_under_scoped` is
true. Result, survivor -> pruned target, unchanged from the source file:
`brand-identity -> logo-generation` · `brand-to-tokens -> logo-generation` ·
`bug-analyzer -> feature-planning` · `complexity-first-planning ->
feature-planning` · `data-handling-judgment -> contracts-cognition` ·
`decision-record -> stakeholder-tradeoff, rice-prioritization` ·
`doc-coauthoring -> humanizer` · `docx-authoring -> spreadsheet-authoring` ·
`evaluate-llm-feature -> prompt-validator` · `html-deck -> canvas-design` ·
`pdf-tools -> spreadsheet-authoring` · `privacy-review ->
contracts-cognition` · `readme-writing -> humanizer` ·
`readme-writing-package -> humanizer` · `reasoning-orchestrator ->
feature-planning` · `refine-prompt -> refine-ticket` · `screenshot-hygiene ->
image-analyser, image-editing`. Seventeen survivors, 24 link instances.

**B.3 — R2 token figures.** `chars/4` over the `description` **strings** of
the tool definitions, first over `src/scripts/mcp_server/tools.ts` (685 tok)
and then across `src/scripts/mcp_server/*.ts` (1,144 tok). No tokenizer was
run; the method is recorded with each figure because the drift being corrected
is a method drift.

## Provenance

External sources, neutral descriptors in the body, real identifiers encrypted
per `source-confidentiality`. Decrypt with
`./scripts-run src/scripts/_lib/link_crypto decrypt --value <token>`.

| Source | Descriptor | Licence | Pinned | Identifier |
|---|---|---|---|---|
| A | The media provider's own skills repository — markdown skills driving a provider CLI, plus a skill-validation workflow | MIT | `fb18134`, last commit 2026-08-07 | `ENC1:fUAJP9oGIRzVY3+UV0I4CERN459RmNUPcGkCjI9V6XtZwNnV90ZVZw7IsGHENvV1NQ3ta1/RetBInSt4fMHP+QUfN5N8zAoGVKuuLGYR/ONJUz3NvcLRDO9YRr5vxPFDYwLapZE31GTeVilmNUElyPAqDuNT3PsjXEXkD7l/KzjcKIHFYvD/4UGq3NU/kDyp` |
| B | A third-party MCP server over the same provider API, raw MCP SDK, 9 tools | MIT | `ca32875`, last commit 2025-11-22 | `ENC1:rHuQe4n7RJpwdJ1oVvamQBgbRVttb+Gz/LJBhaHc5e+FNkH5G3zcLHQvTApOuGKst5c4dRm/ZInv/imrGdmS5ifC/JJsjrYjIRp8WaZGjoPaqyWsbqknIMre6QuLD2RlBrWa4n4acOVKjaSXPBBtcnVMrOkvMr4k1Qg9tuarN61OCKsQROLZZZDT0puSz+iNgBnZtQjmmuDxnw==` |
| C | A second third-party MCP server over the same provider API, FastMCP, 7 tools | MIT | `a2bea49`, last commit 2025-11-03 | `ENC1:avl7dNZGz/0QeXzbR0Tyv6u2vISyk9cBUeJ6DG1MUMjhwyT4kI5rBOy20ErPs6mBsJAjSWx2ujrpOZtZ61isfWECcWJ63muIuV3OZSDhC8cuVEpCUprDNbO9iYAk+xO8lvbVRGEcxB+UjuBTJ61tfuOoP7HDUES8o/FF1/JErXhI/L7y1QQan8TC//rikdFWVwgCTK8v` |

Nothing was copied from any of the three beyond `file:line` citations. Three
repository identifiers were replaced with `Source A`, `Source B` and
`Source C`; Appendix C of the source file, which tabulated them in clear, was
stripped on landing.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: analyze-inbox -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|---|---|---|---|---|---|
| 1 | Widening `lint_handoffs.ts` surfaces far more than 14 findings | implementation | The gate has only ever seen senior-tier `## Related Skills` blocks. Lifting the scope to whole bodies scans 203 files instead of a handful, and the 956-link pattern is wider still than the 943 the census pins | The widened finding set lands as a ratchet baseline rather than a hard failure, and Phase 0 Step 1 records both the 943 and the 956 count so the delta is known before the gate moves | Phase 1 Step 1 |
| 2 | Repointing the 8 `verify-before-complete` links changes routing prose in 5 skills and wakes the description and overlap gates on a new cluster | implementation | Editing routing sentences in five skills can tip `lint_skill_descriptions` sibling-routing checks or the overlap gate into a new cluster finding, turning a link repair into an unrelated red | Run the overlap audit in the same change; any new cluster is recorded as a separate finding rather than absorbed into this repair | Phase 1 Step 2 |
| 3 | The `data-exposure-review` slug has no successor, and a gate that demands resolution invites an invented one | product | Three live links reference a slug that exists nowhere. A gate that fails until every link resolves creates pressure to point them at the nearest-looking skill, which is worse than the dead link because it is silently wrong | Step 2 forbids inventing a slug and offers exactly two dispositions, an archive note carrying `reason` and `replacement` or removal with the sentence rewritten; AC-2 requires a recorded disposition per slug | Phase 1 Step 2 |
| 4 | The scoped-dangle measurement returns a false null | implementation | The usage store holds 181 records from one session on 2026-05-15 and is absent entirely in a fresh checkout, so a naive count reads zero attempts and closes the phase as harmless | Step 1 asserts a record inside the window before any count is read and reports `instrument_dead` otherwise; the guard is tested against both a stale fixture and a missing file | Phase 4 Step 1 |
| 5 | Syncing the Augment manifest version overwrites a deliberate independent version | product | If `1.0.0` were an intentional plugin-API version, syncing it to the package version destroys that signal on every release | The decision is taken from tree evidence that no reader interprets the constant, and it is reversible in one commit; the recorded claim makes the choice visible so a future reader can reverse it deliberately | Phase 2 Step 1 |
| 6 | The lifecycle parity gate is green on landing and reads as untested | implementation | A check that finds nothing on the day it ships can rot unnoticed, exactly like the rule it replaces | The gate ships with a fixture that must be red, asserted in the same test as the real-tree green, so the check is proven sensitive rather than merely quiet | Phase 3 Step 2 |
| 7 | Correcting the R2 figure edits a `status: ready` structural roadmap owned by other work | implementation | Touching another roadmap's risk row and acceptance criterion can collide with a session executing it | The edit is confined to three occurrences of one number plus the method sentence, changes no phase heading, no checkbox and no acceptance criterion count, and is explicitly not a new roadmap | Phase 0 Step 2 |
