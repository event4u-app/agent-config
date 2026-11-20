<!-- evidence-type: analysis -->

# Ratification review — hook bundle ceiling raise for the session catalog call — round 1

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file in it, `src/config/hook-bundle-budget.json`, is on the ratification gate's list (it is hook-plumbing configuration), so the change needs a two-provider verdict under ADR-268 § 4: an agent may change that file but may not ratify its own change.

subject: 725f72719a01549fa697f1a38e9f0c289e4b797b931262f376b73135868f3cec

(The digest covers `src/config/hook-bundle-budget.json` at commit `6dc50cd442`, computed with `./scripts-run src/scripts/ratification_subject`.)

## Background

The budget file bounds the byte size of `dist/hooks/dispatch.js`, the one bundle every hook event parses, and gives each lazily loaded chunk its own ceiling. A raise of the dispatch ceiling needs a `raise_log` entry naming what was added. The doctrine (council 2026-10-18) is to move new hook work into a chunk rather than raise the dispatch ceiling.

## What the change does to this file

1. **New chunk row** `src/scripts/_lib/session_catalog.ts`, `max_bytes: 40500`, measured 36,793 B (reading plus about 10 %, the margin of the quota_notice and self_repair rows). The chunk is a machine-wide session catalog: on the `session-register` concern's existing lifecycle slots it updates a per-session record under `~/.event4u/agent-config/runtime/session-catalog/` (host, profile, model, repos and branches, token usage from the host transcript, resume command) and republishes `sessions.json` / `SESSIONS.md`. It is loaded through the existing `hooks/lazy_load.ts` digest-checked loader; a missing or mismatched chunk costs the catalog entry, never the register.
2. **Dispatch ceiling 1,595,100 → 1,595,800** with a `raise_log` entry: the only code left in the dispatch bundle is the call into the chunk (one `loadChunkExport` call, the end-of-session flag, the claimed-slug read). Measured 1,595,780 B with the change against 1,595,089 B on `origin/main` 2eef08c00b, both by `check_hook_bundle_composition` with APFS-cloned `node_modules` (+691 B; base had 11 B of headroom). Before landing on that, the catalog body was moved into the chunk (inlined it put the bundle about 13 KB over), envelope parsing was moved into the chunk, and the CLI reader was split out of `sessions_cli.ts`, which is in the dispatch import graph.

No authority, permission, gate, kill switch, fail-closed flag or tool access changes. The concern stays `fail_closed: false`, `severity: advisory`; the catalog call is wrapped so any failure is swallowed, and it runs after the register's own delete/touch work so it cannot delay the claim clean-up.

## Question

Is this budget change correctly derived and does it expand any authority? Give your reasons, then end with exactly one line

`STANCE: <verdict> | CONFIDENCE: <high|medium|low> | DEALBREAKER: <yes|no>`

where `<verdict>` is one of `ratified`, `confirmed-non-expanding`, `refused`, `non-convergent`.
