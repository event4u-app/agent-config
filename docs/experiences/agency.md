# 🏛 The `agency` experience

> Set `profile.id: agency` (wizard, or `agent-config use --profile=agency`).
> **Preset default: `strict`.**

## Who it's for

The multi-client delivery shop — refine a fuzzy client ask into an estimated,
AC-tight ticket; turn a phase into a roadmap; ship per client without losing
decision provenance.

## First three tasks

1. **Refine the client ask** — `/refine-ticket` rewrites the ticket and surfaces the top-5 risks.
2. **Size and split** — `estimate-ticket` sizes and breaks the work down.
3. **Anchor the trade-off** — `decision-record` writes an ADR before code starts.

## First commands

`/work` · `/implement-ticket` · `/refine-ticket` · `/feature` · `/roadmap`

## Packs that activate

`engineering-base` + `gtm-marketing` + `product-basic` + `ops-people`
(+ `meta`, always on) — the broadest profile, for a shop that does delivery,
positioning, and account work.

## Flows that apply

All four — [discovery → implementation → review → delivery](../flows.md) — run
per client engagement. The `strict` preset keeps the gates tight across accounts.

## What is NOT loaded

No `finance-advanced`, no `ai-video`, no `founder-strategy`. Delivery-shop
surface, not a CFO or studio one.

## Example

> *"Client wants 'a better dashboard' by next sprint."* → `/refine-ticket`
> rewrites it AC-tight with top-5 risks; `estimate-ticket` splits it;
> `decision-record` captures the charting-library trade-off before code.

## See also

[Profile (deep)](../profiles.md#profile-agency) ·
[Role guide](../getting-started-by-role.md#consultant-advisory-freelance-fractional) ·
[Flows](../flows.md) ·
key skills: `refine-ticket` · `estimate-ticket` · `decision-record` · `doc-coauthoring` · `perf-feedback-craft`.
