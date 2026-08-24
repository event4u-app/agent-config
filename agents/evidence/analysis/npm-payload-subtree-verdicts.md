<!-- evidence-type: analysis -->

# Which of the npm payload a consumer actually needs — measured, not read

Measured 2026-08-24. Discharges Phase 1.2 and Phase 1.3 of
`road-to-npm-payload-reduction`. Every verdict below cites a harness run; none
is read off an import specifier, which is the failure mode the roadmap's Risk 2
names and which a prior budget note had to retract.

## Method

`src/scripts/pack_install_smoke.ts` — build it first, prove it can fail, then
trust it:

1. `npm pack` a **real** tarball. Not `--ignore-scripts`: `prepack` runs the
   build, and `dist/cli/agent-config.js` is the `bin` target. A harness packing
   an unbuilt tree installs a package with no binary and proves nothing.
2. `npm install --global --prefix <throwaway>` the tarball.
3. Run eleven probes: `--version`, `council:status`, `hooks:status`,
   `mcp:available`, `mcp:setup`, `settings:get`, `setup --check`, the wizard boot
   (asserted on its `WIZARD_READY` marker — it is a **server**, so exit 0 would
   mean it died), **`bash src/scripts/install` from the installed tree**, an
   `ai-video` shell-presence check, and one `dispatch:hook`.
4. `--exclude <path-or-glob>` appends a negation to `files[]` in a **copy** of
   `package.json` inside a throwaway detached worktree. The tracked tree is
   never modified.

The orchestrator probe is the one that matters most and is the one a static
check cannot replace: `src/server/routes/wizard.ts:136-137` invokes
`src/scripts/install_anthropic_key.sh` **by path** at runtime, and
`src/cli/python/workspace_hosts.ts:180-191` records a real
`ERR_MODULE_NOT_FOUND` in a global install caused by exactly this. No import
graph sees a path invocation.

### Sensitivity, proven before any verdict was trusted

```
pack_install_smoke --sabotage src/scripts/_lib/
→ ERR_MODULE_NOT_FOUND on council:status, hooks:status, mcp:available, settings:get
→ ✅ sabotage broke the install — the harness is sensitive.
```

A harness never seen red has unknown sensitivity. This one has been seen red.

## Phase 1.2 — the per-subtree verdict

Built-tarball baseline **10.5835 MB**. One exclusion per run.

| Exclusion | Saves | Verdict | What broke |
|---|---|---|---|
| `dist/**/*.map` | **323.5 KB** | **does not ship** | — |
| `src/scripts/ai_council/` | 280.8 KB | **ships** | `council:status`, `hooks:status` — `ERR_MODULE_NOT_FOUND` |
| `src/scripts/hooks/` | 271.5 KB | **ships** | `hooks:status` |
| `src/scripts/_cli/` | 204.1 KB | **ships** | `mcp:available`, `settings:get` |
| `src/agent-src/` | 101.8 KB | **ships** (see 1.3) | `hooks:status` — needs `src/agent-src/templates/scripts/telemetry/settings.js` |
| `src/scripts/ai-video/` | 95.4 KB | **ships** | `smoke-trace.sh` absent from the installed tree |
| `dist/agent-src/skills/**/evals/**` | **56.2 KB** | **does not ship** | — |
| `src/scripts/mcp_server/` | 53.1 KB | **ships** | `mcp:setup` |
| `src/**/*.test.ts` | **22.6 KB** | **does not ship** | — |

**The `ai_council` question is settled, and the answer is no.** The 2026-08-20
budget note named `src/scripts/ai_council/` as the tree whose consumer need was
"unverified"; the 2026-08-24 note measured its 270 KB saving and left the safety
verdict *explicitly open*, retracting an earlier over-claim read off an import
specifier. Removing it breaks two commands with a module-resolution error. The
suggestion should not be raised a fifth time.

### Two verdicts flipped when the probe set widened — read this before trusting a GREEN

`src/scripts/mcp_server/` and `src/scripts/ai-video/` **first read GREEN**,
because no probe exercised their surface: `mcp:available` lists a registry
without loading the server, and nothing at all called the video shell. Adding
`mcp:setup` and a shell-presence check turned both RED.

So **GREEN here means "no probe in this set broke", never "semantically
equivalent"**. Both council seats required that scoping. The three greens are
believable to the extent the probe set is complete *for them* — source maps,
per-skill eval fixtures and test sources have no plausible runtime reader, which
is a weaker claim than a measurement and is stated as such.

### Combined

All three greens together: **10.5835 → 10.1806 MB, 402.9 KB**, eleven probes
green.

Under `pack-size-budget.json`'s own documented conditions
(`npm pack --dry-run --ignore-scripts`, clean unbuilt worktree — what
`check_pack_size` actually reads): **8.5596 → 8.4667 MB**, 2,775 → 2,609
entries, **92.9 KB**.

The gap between 402.9 KB and 92.9 KB is not a discrepancy: most of the
source-map saving lives in `dist/cli`, `dist/ui`, `dist/mcp` and `dist/hooks`,
which `--ignore-scripts` excludes by design.

### The one accepted trade-off

> `dist/**/*.map`: GREEN across the recorded installed-package probe matrix.
> **Accepted trade-off:** a published package carries no source maps, so consumer
> stack traces show compiled names and post-install debugging loses fidelity.

Recorded here rather than in `package.json`, because JSON cannot carry a comment
and a trade-off with no stated cost reads as a free win.

## Phase 1.3 — `src/agent-src/` vs `dist/agent-src/`: 94.2 %, not "partial"

Content-hash diff (SHA-256 per file, both trees walked in full):

| | files | bytes |
|---|---|---|
| `src/agent-src/` | 297 | 2,276,707 |
| `dist/agent-src/` | 1,201 | 8,081,218 |
| **byte-identical** | **284** | **2,144,870 — 94.2 % of `src/agent-src/`** |

Two prior budget notes call this a *partial* duplication and neither measured
it. It is near-total.

**And it is not removable by exclusion.** Nine shipped scripts under
`src/scripts/` import through `../agent-src/`:

`build_archive_index` · `check_estate_count` · `eval_ui_triviality` ·
`explain_run` · `lint_ui_stack_bundles` · `skill_usage_report` ·
`smoke_quickstart` · `telemetry_disclosure_hook` · `utilization_report`

while `dist/agent-src/` is the tree the installer deploys into a consumer's
`.augment/`. The two copies ship for **different reasons** — one is an import
target, the other is deployed content — so neither is redundant in the sense the
duplication figure suggests.

Repointing those nine at `dist/agent-src/` would make **source depend on a
generated projection**, the direction `src/rules/source-of-truth.md` exists to
prevent. AI council 2026-08-24, 2/2: that needs an ADR covering compiled script
entry points and asset resolution, not another `files[]` experiment. Worth
~102 KB, deliberately not taken.

**One half of the objection is false and is corrected here rather than repeated.**
One seat argued the inversion would also break clean-checkout build ordering,
because `dist/` would not exist before a build. It would: `dist/agent-src/` is a
**tracked** projection written by `task sync`, present in every fresh clone. The
architectural objection stands on its own; the build-order one does not, and an
ADR that inherits it would be arguing against a problem it does not have.

## What this does not establish

- **Not that the three greens are unused** — only that eleven probes did not
  notice their absence. A twelfth probe could flip one, exactly as `mcp:setup`
  flipped `mcp_server`.
- **Not that `src/scripts/` cannot shrink.** Every *named* subtree ships; the
  16.7 MB is not proven irreducible, only proven not-cuttable at these six
  boundaries.
- **Nothing about the built artifact's unpacked size**, which
  `evaluator-budgets.json` owns at release time.
