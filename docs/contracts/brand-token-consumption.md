# Brand-Token Consumption Contract (greenfield interface stub)

> **Status:** interface stub. This contract is the **only** greenfield surface
> shipped by `road-to-image-brand-typography` (Phase B.3, decision 2). The
> Lovable-style `scaffold` work-engine directive that *consumes* it ships in the
> sibling `road-to-greenfield-scaffold.md` — **no `scaffold.py` lives here.**
> This doc exists so brand→token output is not dead output: it publishes the
> shape a scaffold step reads, and the `mixed`-set routing hook, against a frozen
> interface a later roadmap can build to.

## 1 — What a scaffold step reads

A greenfield scaffold step consumes a brand profile through two artifacts that
pack-brand already produces — it does **not** call any pack-brand skill at
build time:

| Artifact | Producer | Shape |
|---|---|---|
| `.tokens.json` | [`brand-to-tokens`](../../src/skills/brand-to-tokens/SKILL.md) | DTCG (`$value` / `$type`) token tree — colour, type, spacing, radius. The same file `design-tokens/scripts/tokens.py` emits CSS vars + Tailwind from. |
| voice profile | [`brand-strategy`](../../src/skills/brand-strategy/SKILL.md) / [`brand-identity`](../../src/skills/brand-identity/SKILL.md) | the confirmed voice traits + do/don't (3-5 traits) used to seed microcopy register. |

**Read contract (frozen v1):**

- The scaffold step reads `.tokens.json` as a DTCG document — never a
  pack-brand-internal format. Style Dictionary / Tokens Studio round-trip is the
  sanctioned external transform.
- It reads the voice profile as a list of `{trait, do, don't}` records.
- Absence of either artifact is **not an error** — it means greenfield with no
  brand layer. The scaffold step then proceeds on the brief and SHOULD invoke
  `brand-strategy` / `brand-identity` to define the tokens first (graceful, like
  the brand-asset generation fallback). The scaffold never invents tokens
  silently.

## 2 — The `mixed`-set routing hook

A greenfield request can arrive as one of three set-shapes; the routing hook
names which path the scaffold takes:

| Set | Meaning | Brand-token behaviour |
|---|---|---|
| `branded` | a brand profile (`.tokens.json` + voice) exists | consume tokens; `brand-consistency` gates emitted artifacts. |
| `bare` | no brand layer, none requested | scaffold on neutral defaults; no brand gate. |
| `mixed` | partial brand (some tokens, no voice; or voice, no tokens) | consume what exists; **route the gaps** to `brand-identity` to define the missing slice before emitting, then re-read `.tokens.json`. |

The `mixed` path is the load-bearing one: it prevents a scaffold from either
ignoring a partial brand or hard-failing on an incomplete one. The sibling
scaffold roadmap implements the directive; this contract fixes the hook's
inputs/outputs so that implementation has a stable target.

## 3 — Direction of dependency (do not invert)

```
pack-brand  EXPORTS  .tokens.json + voice profile
                 │
                 ▼  (read-only, build time)
greenfield scaffold step  (sibling roadmap)  and  pack-ai-image generation
```

The scaffold and pack-ai-image generation **consume** brand tokens; they never
write back into pack-brand. Generation does not live in pack-brand (that would
be a God-object — decision 1). This contract is read-only from the consumer
side.

## See also

- [`brand-to-tokens`](../../src/skills/brand-to-tokens/SKILL.md) — emits the `.tokens.json` source of truth.
- [`brand-consistency`](../../src/rules/brand-consistency.md) — the gate that runs on the `branded` / `mixed` paths.
- [`design-tokens`](../../src/skills/design-tokens/SKILL.md) — DTCG token authoring + CSS/Tailwind emission.
- `road-to-greenfield-scaffold.md` (sibling roadmap) — the scaffold directive that consumes this contract.
