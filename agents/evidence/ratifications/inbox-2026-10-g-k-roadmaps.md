---
proposed_by: claude-opus-5/inbox-2026-10-g-k-roadmaps
implemented_by: claude-opus-5/inbox-2026-10-g-k-roadmaps
reviewed_by: ai-council/anthropic-claude-sonnet-4-5+openai-codex-default-2026-10-11
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: confirmed-non-expanding
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — opaque-family globs pass the inbox-name guard, bracket payloads do not

Covers branch `chore/inbox-2026-10-g-k-roadmaps`. Named for the branch because the
pre-push gate reads this file before the PR exists.

## The one governance surface in the diff

`check_kernel_edit_ratified` names exactly one gated surface:
`src/scripts/hooks/block_speaking_inbox_dir.ts`. Two changes, both inside
`isGlobOverAcceptableInboxDir`:

1. **Allowed:** a family head followed only by wildcard characters —
   `OPAQUE_FAMILY_WILDCARD_RE`, `inbox|round|src-set|source-set` with an optional
   year or year-month, or `set` alone, then `-[*?]+`. Trigger: a read-only
   command iterating a glob over hex rounds was refused during the
   `/analyze:inbox` run that produced this branch.
2. **Refused that `origin/main` allowed:** a dated inbox id with a bracket payload
   (`inbox-2026-09-[acme]`) or a run of singleton ranges. Only the generic
   classes `[a-z]`, `[0-9]`, `[a-f]`, `[0-9a-f]`, `[a-z0-9]` are stripped now.

Shell-variable names (`agents/tmp/inbox-2026-10-$id/`) stay blocked. A variable
can expand to a speaking name, and the guard cannot see the expansion.

## Independent review — seven rounds, two refusals, then convergence

All rounds ran through the CLI seats from the main checkout, at no billed cost.
Neither seat is the implementing session.

| Round | Diff state | anthropic | openai |
|---|---|---|---|
| r1 | family-prefix OR after stripping every bracket | confirmed-non-expanding | round-1 only; debate round failed `ENOBUFS` |
| r2 | same, plus a table-driven test | not read: openai skipped before the run, so the round was not usable | skipped (probe recorded `other`) |
| r3 | same as r2 | refused | refused |
| r4 | wildcard-only family regex, range-only strip | confirmed-non-expanding | debate round failed `ENOBUFS` |
| r5 | `set` loses its date suffix, single round | confirmed-non-expanding | refused |
| r6 | generic-class whitelist | confirmed-non-expanding | failed `ENOBUFS` |
| r7 | same diff as r6, smaller prompt | **ratified** | **confirmed-non-expanding** |

- **r3 (refused 2/2):** stripping every bracket class let `round-[acme]-*`
  reduce to `round` and pass, while `mkdir` with that literal would write the
  payload into the name. Both seats named the same fix: wildcard-only tails.
- **r5 (openai refused):** a run of singleton ranges such as `[a-a][c-c]` also
  encodes text, so stripping any `[x-y]` was still a bypass. Fixed with a
  whitelist of generic classes.
- **r7 (both pass):** anthropic classified the new allowance as a bounded
  expansion (`ratified`). openai held that no newly allowed form can create a
  source-identifying name (`confirmed-non-expanding`). Both name the same flip
  conditions: literal text after a wildcard, arbitrary bracket stripping, or an
  unrecognised family head.

The header is derived by
`./scripts-run src/scripts/ratification_header --seat anthropic=ratified --seat openai=confirmed-non-expanding`.

## After the last review

One test-only addition followed r7: a `round-??????` case, which openai named as
its highest-leverage non-blocking addition. No production line changed after r7.

## Seat outages, stated

The openai seat's `ENOBUFS` failures are a local spawn-buffer overflow, not a
provider outage. The availability probe still records them as `other`, which
excludes the seat from every later run. Between rounds the openai entry was
removed from the gitignored `agents/runtime/state/council-probes.json` so the
seat would be tried again rather than skipped. That defect, a local transport
error locking a seat out, is reported in this PR's body. It is not fixed here.

## Prompt package (questions, verbatim)

> 1. Does this change expand any agent's authority or weaken what the guard
>    protects against? Consider concretely whether any path that could create a
>    directory with a source-identifying name is now allowed that was refused on
>    `origin/main`.
> 2. Is the change correct and complete for the stated trigger? Name any input you
>    believe is now mishandled, in either direction.
> 3. Your verdict, exactly one of: `ratified`, `confirmed-non-expanding`,
>    `refused`, `non-convergent`. Give the reasons that decided it and what would
>    have changed it.

The prompt also carried the scope paragraph, the `isOpaqueRoundId` grammar, the
observed trigger, the note that a previous round had refused, and the combined
diff against `origin/main`. It stated no expected outcome.
