---
complexity: lightweight
review_by: 2026-10-31
probe: none
---

# Stub: road to a resume probe that reads an archived roadmap's open items

> **Stub — not active work.** A **drain-run finding**, created 2026-08-31 when
> the run's § 2 unblocking pass ran `agent-config gates --all --json`, was told
> one parked roadmap's resume condition had **fired**, checked it by hand, and
> found the condition unmet.

## The finding

`agent-config gates --all --json` reported:

```
"resumed": [{
  "file": "later/road-to-elicitation-front-door.md",
  "condition": "Parked on arrival. Resume when `claim:suggestion-capture-rate`
                carries a resolved non-DROP verdict with a citable figure
                (`road-to-suggestion-block-capture.md` AC-4). …",
  "verdict": "fired",
  "why": "road-to-suggestion-block-capture archived"
}]
```

Checked against the tree at `origin/main` @ `60ad56b7c`:

- `docs/CLAIMS.md:903` — `claim: suggestion-capture-rate` is **`status:
  unbacked`**, `last_verified: 2026-08-24`. There is no figure, resolved or
  otherwise.
- `agents/roadmaps/archive/road-to-suggestion-block-capture.md:347` — AC-4 reads
  `- [~] **AC-4 — TRANSFERRED UNRESOLVED.**`

So the roadmap archived **with the named criterion transferred, not met**, and
the condition the probe declared fired is unmet on both of its own terms.

## Why it happens — two causes, and only the second is a bug against the spec

**1. The archive short-circuit is the DOCUMENTED contract, not an oversight.**
`src/agent-src/scripts/resume_probe.ts:23-25` defines the verdict:

> `fired` — every roadmap the condition names has archived, or the named step in
> a still-active roadmap is ticked

and `:517-520` implements exactly that: `where === 'archive'` pushes a reason and
`continue`s, with no step check. The `active` branch at `:526-534` DOES check
whether the named step is ticked. The asymmetry is real and it points the wrong
way — an archived roadmap is precisely where a `[~]` transferred item can hide,
because archival is what a drain run does after transferring one.

Changing this changes the probe's stated contract, so it is **not** a
fix-in-place: it is a design decision that belongs to whoever owns the probe.

**2. `STEP_REF_RE` cannot see an AC reference.** `:124` reads
`/\b(?:P|Phase[ \t]+)?(\d+\.\d+)\b/` — it matches `2.1` and `P2.1` and nothing
else. `AC-4` yields `stepId === null`, so even on the `active` branch this
condition would degrade to "did the whole roadmap close". `stepIsDone` at
`:404-415` would in fact handle it correctly if it were given the id: its regex
already accepts `- [~] **AC-4` and would return `false` for the `~` glyph. The
capability is there; the reference extractor never reaches it.

## What would close this stub

Both halves, and the second is cheap:

1. **A decision on the archive branch.** Either the contract stays (archived ⇒
   fired, and this false positive is accepted as the price of a class-0 probe),
   or the archive branch gains the same named-step check the active branch has.
   The second is roughly six lines and the honest one, but it is a contract
   change and needs the owner or a council — not a passing drain run.
2. **Widen `STEP_REF_RE` to recognise `AC-N`.** No contract change: it only
   feeds ids to a `stepIsDone` that already parses them. Independent of (1) and
   worth doing either way, because without it an AC-scoped resume condition is
   silently weakened into a whole-roadmap one.

Both need a fixture proving the false positive red first, then green. The live
tree is not the test — `probeLater` already takes a `roadmapRoot`, and
`tests/scripts/resume_probe.test.ts` already points it at a fixture tree.

## What this stub does NOT claim

That the probe is worthless. Measured on this tree the same run: of the 75
parked files it probes (76 `.md` under `later/`, less `README.md`) it decided 3
— 1 `fired`, 2 `unmet` — and reported the other 72 as `undecidable` rather than
as silence, which is the honest shape its own docstring argues for. This is one
decidable case it decides wrongly, in the
direction that proposes work rather than hides it, which is the safer of the two
directions. It is recorded because a run that acted on the verdict without
checking would have un-parked a roadmap whose blocking instrument is still
`unbacked`.
