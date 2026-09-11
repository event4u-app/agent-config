<!-- evidence-type: analysis -->

# `git archive` silently drops a declared prefix-stable surface

Measured 2026-09-11 in a worktree at `origin/main` `95cf420a3`, while building the
base-ref measurement for step 4.4 of `road-to-delivery-for-every-host`. Every figure was
produced by the repository's own instruments in the worktree named above.

## Why this was measured at all

A measured standing-payload ceiling needs the payload AT THE BASE REF. The obvious way to
get a base tree is `git archive <ref> -- <root> | tar -x`, which is what
`check_preamble_payload_budget.ts` already did for its per-asset growth attribution. The
first cut of `_lib/base_ref_payload.ts` reused that shape.

It produced a base reading **746 tokens below** the direct reading of the identical tree.

## The measurement

Direct census of the working tree, `measureDeterministicPayload`:

| bucket | tokens | files |
|---|---:|---:|
| project-scope rules | 122,822 | 119 |
| preloaded skills catalog | 14,845 | 299 |
| CLAUDE.md hierarchy (project only) | 746 | 1 |
| **total** | **138,413** | |

The same census over a tree materialised from `HEAD` with `git archive`:

| bucket | tokens | files |
|---|---:|---:|
| project-scope rules | 122,822 | 119 |
| preloaded skills catalog | 14,845 | 299 |
| CLAUDE.md hierarchy (project only) | **0** | **0** |
| **total** | **137,667** | |

## The cause, and it is not the one it looks like

The first hypothesis was a symlink: `CLAUDE.md` is a git symlink (mode `120000`) to
`AGENTS.md`, which is not itself a declared surface, so a materialisation of the declared
roots alone would leave a dangling link that the census reads as absent. That hypothesis
was wrong — `AGENTS.md` **was** extracted alongside, and the bucket still read zero.

The actual cause, reproduced directly:

```
$ git archive HEAD -- CLAUDE.md | tar -t -f -
$ echo $?
0
```

**Zero entries, exit 0.** `.gitattributes:26` carries `/CLAUDE.md export-ignore`, and
`git archive` honours `export-ignore` so release tarballs stay clean. `git check-attr -a
CLAUDE.md` confirms: `CLAUDE.md: export-ignore: set`. There is no `git archive` flag that
disables it — the attribute is read out of the tree being archived.

So a **packaging** decision was silently deciding what a **measurement** contained.

## Why the direction matters

A base reading that is too LOW produces a ceiling that is too TIGHT, because the ceiling
is `max(design_ceiling, payload_at_base_ref)`. Every pull request would have reddened by
746 tokens it did not add, on a tree nobody had changed. The gate would have been wrong in
the direction that blocks honest work, and its own output would have looked entirely
ordinary.

## The fix, and the second trap it had to clear anyway

`_lib/base_ref_payload.ts` materialises the base tree with `git ls-tree -r -z` plus
`git cat-file --batch` instead. Those read the object graph and have no notion of
`export-ignore`, so the surface set measured is the surface set the registry declares.

The symlink hypothesis was wrong about this defect and is still a real hazard, so the
closure over link targets stays: a `120000` blob's content IS its target, targets are
resolved at the git layer to a fixpoint, and entries are written as real symlinks so the
census resolves them exactly as it does in the working tree. Without it, the same 746
tokens vanish by a second route.

After the fix, over 728 tree entries: base reading at `HEAD` = **138,413**, equal to the
direct reading to the token, with the CLAUDE.md bucket back at 746 / 1 file.

## Scope of the pre-existing defect

`attributeGrowthAgainstBase` in `check_preamble_payload_budget.ts` used `git archive` for
the same purpose from the day it landed. It was NOT producing a wrong verdict, because it
builds a ledger over the rules and skills roots only and neither is `export-ignore`d — the
defect was latent there, not live. Both call sites now go through the one reader, so a
future `export-ignore` on a measured path cannot make them disagree.

## Pinned

`tests/scripts/measured_payload_ceiling.test.ts` asserts that reading `HEAD` through a ref
equals reading the working tree to the token, and that `CLAUDE.md` in the materialised tree
both exists and resolves. The equality is not a tautology: it fails if any declared surface
stops being materialised, whatever the reason.
