---
complexity: lightweight
---

# Stub: road to a release-placeholder guard that fits the ratchet

> **Stub — not active work.** Transferred out of
> [`archive/road-to-wiring-truth-corrections.md`](../archive/road-to-wiring-truth-corrections.md)
> Phase 2 on 2026-08-21, after two implementations were refused and the second
> AI council session (2/2 present,
> `council/responses/r-placeholder-guard-placement.md`) named a design that does
> not fit a one-PR change. The finding is verified and live; only the
> implementation moved.

## The invariant

A release must not ship a changelog section still containing
`DERIVED_MARKER` (`_auto-derived, rewrite before merge:_`, exported from
`src/scripts/_lib/release_highlights.ts:48`). Three surfaces render from that
section: the annotated tag message, the GitHub Release notes, and
`CHANGELOG.md` on main.

The release-PR check stays advisory, and that is a recorded decision, not an
oversight — `check_release_highlights.ts:203-206`: *"keep the exit code owned
solely by the `_none_` check — a warning that reds the build is the
guaranteed-red failure mode this whole change exists to remove."* Highlights are
auto-derived first and curated later, so a blocking check on a release PR is red
by construction. Both council sessions declined to touch it.

## Why it is live, not historical

`CHANGELOG.md:392-395` — the **published** 14.7.0 section carries four
unrewritten marker lines. The reviewer has raised this since the v12.1.0 review
(`P0.1 Release-Placeholder hard block`). It is recurring, and it has shipped.

## Two implementations, both refused, and what each refusal taught

| Attempt | Shape | Refused by | What it revealed |
|---|---|---|---|
| 1 | Guard three call sites in `release.ts` (tag creation, push of a pre-existing tag, Release notes) | `check_source_size_budget` — `release.ts` is 2,818 lines, over the 1,500-line ceiling; +60 lines is a straight regression, and the gate states that raising the baseline is a defect, not a fix | Coverage was right, including the real `--resume` bypass: step 8 reads the changelog only in its tag-creation branch, so a resume over a created-but-unpushed tag skips it. **Any** net growth in `release.ts` is refused, so even a 4-line version fails. |
| 2 | Guard inside `tag_message_from_section` and `release_notes_from_section` (`_lib/release_material.ts`) | CI — four `release_drill.test.ts` scenarios that assert step **sequencing** failed | A guard on a pure formatter has no notion of "am I actually publishing". The drill returns the live `CHANGELOG.md` for `git show <tag>:CHANGELOG.md` and step 8 reads the live file directly, so the guard correctly refused and unrelated tests broke. Decoupling the drill is blocked by the same ratchet. |

## The council's design — extraction, judged by net effect

Both seats converged. Extract the publication orchestration out of `release.ts`
into a small module (`release_publication.ts` or similar) and enforce the marker
check immediately before **each independently resumable irreversible
transition** there.

Four constraints the implementation has to satisfy, each from a seat's own
argument:

1. **Net line reduction in `release.ts`.** *"Moving code is ratchet-clean only
   if `release.ts` becomes smaller. A token wrapper that leaves most logic
   behind could still violate the ratchet."* Extraction is the ratchet working
   as intended — a lowering commit — not an exception request.
2. **Enumeration is unavoidable, and saying otherwise is the trap.** The asked-for
   conjunction (ratchet-clean · fires only on real publication · no call-site
   enumeration) has **no** solution: *"Given independently resumable
   transitions, no such placement has been demonstrated. The state machine has
   no single dominating checkpoint."* Extraction solves the ratchet and the
   context problem; it does not solve the enumeration one. Enumerate the
   transitions deliberately and test each.
3. **Scope the read to the section of the current transition**, never repo-wide.
   Otherwise the historical 14.7.0 content permanently blocks every later
   release until editorial work nobody scheduled is done.
4. **Give the drill controlled changelog fixtures** rather than disabling the
   guard — but do not let drills bypass policy universally.

A CI gate on the tag-triggered publish workflow was considered and is a
**backstop only**, explicitly not the boundary: the tag already exists when that
workflow runs, and both seats rejected calling it the invariant. One seat added
the operational cost plainly — a pushed tag may already have been fetched,
mirrored, or used to trigger concurrent automation, so rewriting it is
remediation, not prevention. If it is built, every publication job must *depend*
on it, or npm publish and the Release creation race the failure.

## Explicitly NOT in this stub

**Curating the four live 14.7.0 highlight lines.** Both council seats, both
sessions: maintainer editorial work. An agent paraphrasing the generator's own
derivation reason into prose to satisfy a gate is the *"truthfully documented
uselessness"* failure one seat named — and it cannot repair the already-published
annotated tag message in any case. Mutable and immutable surfaces need separating
before that work starts.

## Promotion criteria

- A measured extraction plan showing `release.ts` net **smaller**, with the
  moved symbols re-exported so callers are unaffected (the shape
  `check_source_size_budget`'s own baseline note records for two prior
  lowerings).
- The enumerated transition list, with the `--resume` created-but-unpushed path
  named as its own case.
- A drill fixture decision that keeps the sequencing scenarios independent of
  editorial state.

## See also

- [`archive/road-to-wiring-truth-corrections.md`](../archive/road-to-wiring-truth-corrections.md) — the parent; its Phase 2 is this stub.
- `src/scripts/check_source_size_budget.ts` — the ratchet, and its own account of what a legitimate lowering looks like.
- `src/scripts/check_release_highlights.ts` — the advisory posture neither session reopened.
