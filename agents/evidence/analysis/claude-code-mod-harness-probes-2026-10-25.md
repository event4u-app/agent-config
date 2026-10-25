<!-- evidence-type: analysis -->

# Claude Code mod harness probes — 2026-10-25

> Reproduced for `road-to-a-mod-that-decides-nothing-new` against Claude Code
> 2.1.310 on macOS, with the host's own `claude plugin validate` and
> `claude plugin test`. The probe module lived outside the repository (session
> scratch directory) and is not copied here; Phase 4 of the roadmap re-writes it
> as the shipped module. Tree: `origin/main@c073ca2e5a`.

## What was run

A probe plugin with one hooks module carrying two hooks:

- `turn.complete` — awaits `next(e)`, then, when
  `agents/runtime/state/context-fill.json` exists with `schema_version: 1`, sets
  `$.ui.status("AC context N% of recycle threshold")`. Any read or parse error is
  swallowed.
- `tool.check` — awaits `next(e)`, then toasts every non-engine entry of
  `next.trace` as `<plugin>/<tier>/<outcome>`.

## Reproduction table

| # | Claim from the inbox plan | How it was reproduced | Verdict | Corrected wording |
|---|---|---|---|---|
| H1 | `next.trace` exists but is undocumented | Read the host's own type contract written by 2.1.310 (`TraceEntry`, `TraceOutcome`); probe hook read it at runtime | **reproduced, wording corrected** | `next.trace` is part of the 2.1.310 hooks-module type contract (`index, plugin, tier, event, outcome, reason?, ms, chunks?, received, returned`); it is absent from the web docs only. Outcomes: `caught, expired, kept, passed, rejected, returned, skipped`. |
| H2 | A sensor on `tool.check` sees a verdict changed beneath it, with plugin and tier | `claude plugin test`: a test hook beneath answered `{ decision: 'allow' }`; the probe toasted `trace: test/builtin/returned` | **reproduced** | — |
| H4 | A read-only module declares exactly `$.fs.exists`, `$.fs.read`, `$.ui.*`; the call surface is CI-pinnable | `claude plugin validate .` printed `hooks: turn.complete, tool.check` and `calls: $.fs.exists, $.fs.read, $.ui.status, $.ui.toast` | **reproduced** | — |
| G3 | File present → status line; file absent → silent | `claude plugin test`: 150000/160000 tokens → status contains `94% of recycle threshold`; `fs.exists` false → zero `ui.status` calls. 3 tests, 0.15 s | **reproduced** | — |
| I4 | Every hook needs `try/catch` and passes `next(e)` through on failure, because three worker crashes unload all mods | `validate` reports `gating hook without .catch: tool.check`; the host reference states a hook that throws is **skipped** and the chain continues, unless its `.catch` answers | **diverged** | A display or sensor hook needs no `.catch`: when it throws it is skipped, which is the correct failure for a reader. A hook that *guards* (the opt-in holder) must register `.catch(($, e, next) => ({ decision: 'deny' }))`, or a throw lets the call through. The worker-crash rule concerns the shared thread, not a hook's own exception. |
| W0.1(c) | A local directory marketplace can be registered | `claude plugin marketplace add --help`: `<source>` accepts "a URL, path, or GitHub repo"; `--scope user|project|local` | **reproduced (partly)** | Whether a path behind the `runtime/current` link is recorded resolved or literal is still open — a resolved path would pin the module to one version directory. |
| W0.1(d) | Which base `$.fs.read` resolves a relative path against | Type contract for `$.fs.read`: "relative to the working directory, or absolute" | **reproduced** | Relative paths resolve against the session's working directory, not the project root. A module reading `agents/runtime/state/…` is silent when the session starts in a subdirectory. |
| W0.1(a,b,e) | Settings-hook vs mod order on a real arm; skip line for a settings hook; real hook latency | — | **out-of-bound** | Needs a live interactive session on a managed and an unmanaged account; the harness simulates neither settings hooks nor arms. |

## Tree claims re-checked on `c073ca2e5a`

| ID | Claim | Verdict |
|---|---|---|
| D1 | 0 hits in `src docs hooks README.md CHANGELOG.md` for `prependPlugins`, `next.trace`, `sec-default`, `disableAllHooks`, `tool.check`, `allowManagedHooksOnly`, `allowManagedModsOnly`, "Claude Code mods" | still-true (each 0) |
| D3 | `context-fill.json` has no code consumer; no `"statusLine"` key written | still-true (consumers: writer, manifest, retention row, settings schema only; `"statusLine"` 0 hits — the 12 bare `statusLine` hits are a function name in `canary_liveness.ts`) |
| D4 | `classify_change_risk.ts`: nothing consumes the class | still-true (`:26-32`) |
| D5 | `README.md:168-169` promises replay; journal default is off | still-true (`hook_manifest.yaml:1568`) |
| D6 | Concern budget only warns | still-true (`lint_hook_concern_budget.ts:35,37`) |
| D7 | Review triggers are line counts | still-true (`end_review_nudge_hook.ts:259`, `self_review_gate.ts:545`) |
| D10 | `README.md:218` lists "Runtime GUI / web dashboard" as a non-goal | still-true |
| D11 | ADR-124 knows A, B (forbidden), C | **partly overtaken** — Class B was reversed by ADR-249 (supervised resident process permitted under governance). The gap that remains: a host-owned module is no AC process at all, so neither A nor B describes it. |
| D12 | The Claude plugin is a deprecated bootstrap shim | still-true (`.claude-plugin/marketplace.json`) |
| D13 | ADR-285: one dispatcher stage is the only rewriter | still-true |
