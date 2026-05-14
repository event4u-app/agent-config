# README three-audience split — plan

Annotated outline for `P2.2a` in
[`road-to-proof-not-features.md`](../agents/roadmaps/road-to-proof-not-features.md).
Decides the **information architecture**, not the prose. No content
rewrite happens in this step; `P2.2b` applies the mapping.

## Target headings (top of README, in order)

1. **Use it in your project** — anchor `#use-it`
2. **Prove it** — anchor `#prove-it`
3. **Contribute** — anchor `#contribute`

Each branch opens with one paragraph + one primary CTA. AI Council is
not mentioned in any branch (verified by `P3.4`).

### Anchor-stability promise

`P2.2b` must keep these existing anchors intact so external inbound
links survive:

| Anchor today | Lives under (new) | Why |
|---|---|---|
| `#quickstart` | `#use-it` | npm/composer search results, social links |
| `#supported-tools` | `#use-it` | most-cited section on the web |
| `#what-your-agent-is-asked-to-do` | `#prove-it` | linked from blog posts |
| `#documentation` | `#use-it` | docs portal entry |
| `#development` | `#contribute` | contributor guides |

Other section anchors may be renamed; `lint-readme` checks the table
above and the three new audience anchors only.

## Block-by-block mapping

Every existing top-of-README block, in source order, mapped to
exactly one branch. "Drop" = block is retired; "Move" = relocated as-
is; "Reframe" = block stays but its lead-in / CTA changes (still no
copy rewrite in this step — the reframe direction is decided here,
applied in `P2.2b`).

| # | Block (current heading) | Lines | Branch | Action | Notes |
|---|---|---|---|---|---|
| 1 | Title + tagline + stats badge | 1–13 | — | Keep above branches | Survives unchanged; counts updated by `update_readme_counts`. |
| 2 | `## Start here` (three-paths table) | 15–25 | — | **Drop** | Replaced by the three branch sections themselves; rows map cleanly: `/onboard` → Use, `task ci` → Contribute, `task generate-tools` → Use. |
| 3 | `## Quickstart` lead-in | 27–39 | Use it | Move | Becomes the opening paragraph under `#use-it`. |
| 4 | `### For teams (recommended)` | 40–79 | Use it | Move | Primary CTA for `#use-it`. |
| 5 | `### Pick specific AIs` | 81–101 | Use it | Move | Stays under Quickstart subtree. |
| 6 | `#### Global install` | 103–124 | Use it | Move | Subsection of Pick specific AIs. |
| 7 | `### For individual use (optional)` | 126–144 | Use it | Move | Alternate install path. |
| 8 | `### Self-hosted MCP on Cloudflare` | 146–226 | Use it | Move | Operator install path; deep but consumer-facing. |
| 9 | `#### Lock your Worker behind Bearer` | 196–213 | Use it | Move | Subsection of MCP block; stays nested. |
| 10 | `### Optional: persistent agent memory` | 228–247 | Use it | Move | Companion package install. |
| 11 | `## 2-minute demo: /implement-ticket` | 251–285 | Prove it | Move | Flagship evidence surface. Primary CTA for `#prove-it`. |
| 12 | `### Sibling entrypoint: /work` | 287–316 | Prove it | Move | Same engine, second envelope. |
| 13 | `### Product UI track` | 318–347 | Prove it | Move | Third evidence surface. |
| 14 | `## What your agent is asked to do` | 351–365 | Prove it | Move | Intent table — proof of behaviour, not features. |
| 15 | `## What this package is — and what it isn't` | 369–398 | Prove it | Move | Scope-honesty surface; loadbearing for the "proof" framing. |
| 16 | `## You don't need everything` (cost profiles) | 402–423 | Prove it | Reframe | Currently sits as "feature" prose; the new framing is "proof that the package shrinks to fit". |
| 17 | `## Who this is for` (stack coverage) | 427–439 | Prove it | Move | Honest depth claim — also evidence-side. |
| 18 | `## Featured Skills` | 443–462 | Use it | Move | Catalog teaser → consumer surface. |
| 19 | `## Featured Commands` | 466–481 | Use it | Move | Catalog teaser → consumer surface. |
| 20 | `## Supported Tools / Project-installed` | 487–527 | Use it | Move | Per-tool install matrix. |
| 21 | `## Supported Tools / Plugin-installed` | 529–541 | Use it | Move | Subsection. |
| 22 | `## Supported Tools / Cloud / Hosted-agent` | 543–558 | Use it | Move | Subsection. |
| 23 | `## Core Principles` | 562–570 | Prove it | Move | Behavioural floor — proof-side. |
| 24 | `## Documentation` (index table) | 574–589 | Use it | Move | Doc portal entry. |
| 25 | `### Maintainer telemetry (opt-in)` | 591–608 | Contribute | Move | Engagement measurement — maintainer / contributor surface. |
| 26 | `### Context-aware command suggestion` | 610–629 | Use it | Move | Consumer-facing feature toggle. |
| 27 | `## Development` | 633–642 | Contribute | Move | Primary CTA for `#contribute`. |
| 28 | `## Requirements` | 644–649 | Use it | Move | Install gate — Use-side, not Contribute. |
| 29 | `## License` | 651–653 | — | Keep at bottom | Footer; outside the three branches. |

## Branch outlines (post-migration shape)

### `## Use it in your project`

Opening paragraph: one-line "Two minutes from npx to a better-behaved
agent." Primary CTA: `npx @event4u/agent-config init`. Children:
Quickstart subtree (#3–#7), MCP operator path (#8–#9), optional memory
(#10), Featured Skills + Commands (#18–#19), Supported Tools (#20–#22),
Documentation (#24), Command suggestion (#26), Requirements (#28).

### `## Prove it`

Opening paragraph: one-line "What the agent actually does, with
evidence." Primary CTA: `/implement-ticket` demo (#11). Children:
`/work` (#12), Product UI track (#13), Intent table (#14), Scope
statement (#15), Cost profiles reframed (#16), Stack coverage (#17),
Core Principles (#23).

### `## Contribute`

Opening paragraph: one-line "Editing rules, skills, commands — the
contributor loop." Primary CTA: `task ci` (#27). Children: Maintainer
telemetry (#25). External links: `CONTRIBUTING.md`, `AGENTS.md`,
`docs/development.md`.

## Verification (P2.2c preview)

Grep-based test asserts `## Use it in your project`, `## Prove it`,
`## Contribute` appear in that order. `lint-readme` keeps anchor
stability for the rows in the Anchor-stability promise table.
