<!-- evidence-type: council -->

# Council — should the BUILT payload figure be re-measured, and by whom?

**Run 2026-10-17.** Members `anthropic/claude-sonnet-4-5` and
`openai/codex-default`, 2 rounds, blind chairman, quorum 2/2 present and
concluded. Both seats subscription-authed; nothing billed. The transcript is
under `agents/runtime/council/`, which is gitignored and auto-pruned, so the
convergence is inlined here rather than linked.

## Why it was asked

`check_pack_size` reds the `Sync + Generate Tools Consistency` job — one of the
repository's two required contexts — on `main` at `8c90aad26` (run
39010428624):

```
pack size: packed_size_mb (BUILT surface): measured 13.703 regressed >10%
vs the recorded built figure 12.4548 (ceiling 13.700)
```

Every open pull request inherits that red. The last green Consistency run on
`main` was `5a9f56305`.

## The measurements put to the council

| Surface | Reading | Compared against | Verdict |
|---|---|---|---|
| BUILT, in CI | 13.703 MB | ceiling 13.700 (from `built_surface_measurement_2026_09_10`, 12.4548) | **red by 3 KB** |
| BUILT, pristine full build, local | **14.4989 MB · 3568 entries · 52.7129 MB unpacked** | same ceiling | red |
| UNBUILT, pristine, local | 12.053 MB · 3309 entries | `budgets.packed_size_mb.max: 11.5` | **latent breach**, never exercised in CI |

The pristine build was taken twice, independently, from one clean tree with
every untracked `dist/` subtree deleted first, using the exact command the
2026-09-10 record names. Both runs produced **byte-identical** pack manifests —
3568 entries, 14,498,927 bytes — and neither left the tracked tree dirty. CI's
figure is lower because the CI job packs a partially built tree: `dist/mcp` and
`dist/ui` are absent there.

Between `5a9f56305` and `8c90aad26` the payload gained ordinary product files
(`src/scripts/analysis_*.ts`, `source_adapters.ts`, `round_reservations.ts`,
`src/install/ownershipLedger.ts` and its built output). No stray artefact and no
accidental inclusion was found, so the growth is five weeks of real accretion
rather than one bad commit, and there is no payload to trim instead.

## What the two seats converged on

1. **Re-measurement is warranted.** The budget file's own
   `built_surface_enforcement_2026_08_30` note names a new dated
   `built_surface_measurement_<date>` key as the revisit path, and its condition
   is met.
2. **14.4989 MB is the defensible number**, not CI's 13.703 — it is
   reproducible, byte-identical across two runs, and taken with the command the
   previous record names. Recording CI's partial figure would convert an
   accidental build omission into policy.
3. **The change needs the owner.** Both seats said so independently and in the
   same words: *"Owner approval: REQUIRED — this is owner-reserved"* (anthropic)
   and *"This requires owner approval. Changing the baseline behind a required
   check materially relaxes enforcement, even when the mechanism was previously
   authorized"* (openai). Anthropic named the reason this is not an ordinary
   maintenance edit: the agent proposing the reset is the one unblocked by it.
4. **No new ADR is required** if the change restores the already-documented
   full-build measurement method; the dated key plus an in-file reason plus the
   pull-request explanation suffice. An ADR becomes necessary only if the
   *definition* of the built surface changes.

## Where they did not converge

| Question | anthropic | openai |
|---|---|---|
| The gap between the recorded 14.4989 and CI's 13.703 | acceptable with the gap documented and a follow-up to make CI build fully | **fix CI first**, verify it reproduces ~14.4989, then record |
| The latent `max: 11.5` breach | raise `max` to 12.5 in the same change, following ADR-273 | leave `max` alone; it is an explicit absolute policy limit and raising it is a second decision |

Both characterised the 2.2 MB difference the same way — it is a blind spot
rather than headroom — and differed only on whether to close it before or after
the re-baseline.

## Disposition

**Not taken.** The convergent finding is that the transition is owner-reserved,
and an agent cannot authorise an owner-reserved transition on a council verdict
that says so. The trunk therefore stays red on this one step until the owner
decides, and the two roadmaps that met it record the red against the trunk
rather than against themselves.

What the owner is being asked for, in the shape the council left it:

1. Add `built_surface_measurement_2026_10_17` with built `packed_mb: 14.4989`,
   `entries: 3568`, `unpacked_mb: 52.7129`, and the command above.
2. Decide the CI-alignment question the seats split on — make the required job
   build fully before packing (openai), or record the gap with a named
   follow-up (anthropic).
3. Decide whether `max: 11.5` moves in the same change (anthropic) or becomes a
   separate finding (openai).

## Revisit if

The payload drops below the 13.700 ceiling on its own, a maintainer sets an
absolute built cap, or the required job changes what it packs — any of the
three removes the question rather than answering it.
