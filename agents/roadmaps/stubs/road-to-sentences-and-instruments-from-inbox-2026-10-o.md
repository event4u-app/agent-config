---
complexity: lightweight
review_by: 2026-12-31
---

# Stub: the sentences and the instruments round inbox-2026-10-o found

> **Arrivals:** 1 — `inbox-2026-10-o` (2026-10-12), via step 6.6 of
> `road-to-unknowns-that-say-so`. That round verified every item below against
> the tree while chasing a different defect class, and handed them on rather
> than fixing them in the same change.

> **Stub — not active work.** The two files this material was addressed to,
> `road-to-sentences-the-tree-can-back` and `road-to-what-was-built-and-never-ran`,
> are both **archived with zero open steps**. Step 6.6 said to add one step to
> each. Doing that would mean either opening steps inside an archived file —
> which makes a closed plan read as open and breaks the archive's one
> invariant — or reviving two plans and paying for both in the estate budget,
> to hold twelve one-line corrections. Neither is proportionate, so the items
> are held here, where nothing counts them as active work and nothing loses
> them. The archived files carry a pointer to this stub.

## Class A — sentences the tree contradicts

Each is a claim in a shipped artefact that the tree does not back. One line
each, and each was verified at `main@2bc5715c7` on 2026-10-12.

1. `docs/safety.md:18` — "rules load only when the matching user-type is
   active". `applies_to_user_types` has no non-test reader.
2. `docs/decisions/ADR-020-global-only-consumer-scope.md:199-201` — names
   `scripts/lint_global_paths.py` as a required precondition; its successor has
   no caller. An ADR edit needs its own record, so this one is not a one-line
   fix even though it reads like one.
3. `docs/contracts/low-impact-corpus-format.md:95` — names
   `scripts/ai_council/probation_gate.py`; its successor has no caller.
4. `src/agent-src/presets/README.md:20` and
   `src/agent-src/profiles/README.md:23` — both name `task lint-config-schema`.
   No such task and no such script.
5. `src/agent-src/templates/agents/proposal.example.md:12` — names
   `task check-proposal`. No such task.
6. `src/config/agent-settings.template.yml` — lacks `verbosity.script_output`
   (`src/scripts/_lib/script_output.ts:14`) and `personal.user_name`
   (`src/scripts/install.ts:335`), so two keys the code reads are absent from
   the template that is supposed to list them.
7. `README.md:122` — links `/video:from-script` into `.augment/`, which is
   gitignored (`.gitignore:145`). The source is
   `src/domains/ai-video/video/from-script/command.md`.
8. `src/skills/character-consistency/SKILL.md:28-29`, `:127-131` — describe a
   ≥ 95 % similarity check on rendered frames that no script performs. The one
   comparison that exists sees three identical files and runs in no job.
   Decision D10 of the source roadmap: correct the claim, do not build the
   check.
9. `src/skills/prompt-validator/SKILL.md:20-24`, `:153` — "deterministic
   pre-spend gate … contradictions block", with no executable behind it, and
   the skill is not in `/video:from-script`'s `skills:` line
   (`src/domains/ai-video/video/from-script/command.md:11`). Decision D11:
   correct the claim, do not build the gate.

## Class B — instruments documented as live and reached by nothing

Wire or withdraw; both are one decision each, and neither is a claim about
behaviour the way Class A is.

10. `src/scripts/ai_council/probation_gate.ts` — no caller.
11. `src/scripts/lint_global_paths.ts` — no caller.

## What this stub is NOT

- Not a plan. There is no phase, no acceptance criterion and no ordering
  between the items; each is independently fixable by whoever next edits the
  surface it names.
- Not an estate entry. It sits under `stubs/`, so `check_estate_count` does not
  count it and `agents/roadmaps-progress.md` does not show it.
- Not a re-opening of either archived file. Both stay archived; both gained one
  pointer line naming this stub and the round that produced it.

## Promotion

Move the file up one directory and add the complexity frontmatter the linter
expects. Worth doing only if somebody wants the twelve as one sweep; one at a
time, in the pull request that touches the surface anyway, is cheaper and is
what the source roadmap expected of its own handover targets.
