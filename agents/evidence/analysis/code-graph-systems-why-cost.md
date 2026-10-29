<!-- evidence-type: analysis -->
# Code-graph systems why-chain cost

Step 6.5 of `road-to-a-map-that-holds-on-the-real-repo`. Measured 2026-10-27 on
`feat/inbox-2026-10-bf-core`, systems payload of this repository's lane build.

| Quantity | Value |
|---|---|
| Packages in the payload | 1,310 |
| Chains kept (cap 20 per package, depth 15) | 9,115 |
| Packages at the cap | some (max 20) |
| Payload without `why`, `dependents`, `subtree` | 782,763 B |
| Payload with them | 2,574,955 B |
| Added | 1,792,192 B, 1,368 B per package on average |
| Time to compute the payload | 1,183 ms |

Growth is linear in packages: each package carries at most 20 chains of at most
16 hops. **Budget fixed at that bound** — `WHY_CHAIN_CAP = 20`, `WHY_DEPTH = 15`
in `map_area_payloads.ts` — rather than at a byte figure, because the byte figure
moves with name lengths while the bound does not.

Revisit if: the systems payload passes 5 MB on this repository, or the page
needs more than 20 chains to answer "why is this installed".
