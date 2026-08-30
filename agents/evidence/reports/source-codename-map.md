<!-- evidence-type: analysis -->
# Source codename map — the only place the correspondence exists

> Written 2026-08-29 by `road-to-source-silence` Phase 2.1, under ADR-250.

**This file deliberately contains no source name.** It is the single tracked
record of the codename to source correspondence, and it exists as one `ENC1:`
ciphertext (`src/scripts/_lib/link_crypto.ts`). Decrypt with:

```bash
./scripts-run src/scripts/_lib/link_crypto decrypt --value "$(sed -n '$p' agents/evidence/reports/source-codename-map.md)"
```

The payload is small enough to pass as a shell argument, unlike the Phase 0
census ciphertext (~320 kB), which must be read from its file.

## What the map contains

| Namespace | Form | Count | Where the codenames are used |
|---|---|---:|---|
| deny groups | `S1` … `S5` | 5 | redacted archived roadmaps and the roadmap-asset file |
| inbox rounds | `inbox-2026-08-f`, `inbox-2026-08-h` | 2 | every tracked quote of the two anchored inbox directories, and the renamed findings file |

A deny group holds every deny pattern naming one upstream, so an upstream named
once by owner and once by repository is one codename rather than two. That is
why five codenames cover the seven patterns the redaction touched.

## Why this file rather than the Phase 0 census

`road-to-source-silence` step 2.1 as authored says the mapping lives "exactly
once, as an `ENC1:` line in the Phase 0 census". It does not, and the reason is
mechanical: the census is **generated** — `sweep_source_surfaces --census
<path>`, and its own header says "Regenerate rather than hand-edit". A mapping
appended there would be destroyed by the next regeneration, silently, and the
codenames in the archive would then point at nothing. So the mapping gets its
own artefact and the "exactly once" property is preserved where it can actually
hold. Nothing else in the tree carries the correspondence.

## Verification

The redaction that produced these codenames passes ADR-250's mechanical
before/after audit — 37 explained removals, 126 explained additions, **0
unexplained changes** across 16 files. The audit classifies every word-level
change as either a removed denied identifier, an added codename or opaque round
id, or a line of the dated redaction marker; anything else fails it. Re-runnable
against the redaction commit with `git diff --word-diff=porcelain`.

ENC1:/GwclU+RqD/W8+yxgc1ZkMYgGQeoY94mHfS/ygnYiJ12+oJtcx8y98t95+RDH7qWzznX6tObPC98Lr7mL53mT8zZpkiajSjcD3Itfx8qBXN2oojP/1WQQ9B6KaSpskr5/ADXbW4mLE6qXstoo7aPAiXHqOYht+R6xxhdqmV6cM4wBSJYMozlQ6wZuBDC5Zu/5XmX1xs2Jtsf37YBWfDouP5MPSw4oW1HU+sZXjXdQiSaeHiARLMF5n8Hp7Hblbgjp3ikMzX5bz3rSY2K23ErV54AQuOknxdr7Kh6M2CwzdGaB6/8yX0T/TechUqeGh1LwUc6UiyZBw9UDgenl2A55yotMpUfn6lPZxkn8ynwXxD4qkbKFZMGXf9hPtRRGb70kBpPeHo10Dz7kQISYS0bdb69+dVZ5nNhAxtGHbn1zWNcM64SBHzAlsoodtFbNOknZWMint9LRWDoBw3ED5MXMjhS6fHuHV9x1ImNSZs=
