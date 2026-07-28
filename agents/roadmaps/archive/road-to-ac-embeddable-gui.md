---
status: ready
complexity: structural
execution:
  mode: phase-checkpoints
---

# Road to an embeddable AC GUI — host-ready without weakening a single security invariant

> agent-switch wants to render AC's settings inside its own window so an AS
> user never hunts for a second GUI (AS-side counterpart:
> `road-to-ac-embedded-settings` in the agent-switch repo). Everything
> needed is *almost* already there: a discovery file, a per-process token,
> a hash router, a pre-paint theme stamp. What is missing is a **contract**
> — today the embed would work by accident (nothing forbids framing) and
> break silently the first time someone adds a hardening header. This turns
> the accident into a promise.

## Goal

Ship a small, versioned **embed contract** — `?embed=1`, a theme query, a
discoverable capability flag, and a documented framing stance — so a host
application can render AC's settings surface reliably, while the standalone
GUI (the surface for everyone who does *not* use AS) is unchanged and the
three security hooks are untouched.

## Context (verified 2026-07-23 at agent-config@9.7.0, do not relitigate)

What already exists and is load-bearing:

- **`src/server/app.ts:186-218` — three onRequest hooks:** Host allow-list
  (421), Origin allow-list **only when the header is present** (403, with
  the comment "browser-issued requests only — server-to-server skips this
  header"), Bearer gate on `/api/*` (401). Static files under `/` are
  ungated by design. **None of these change** for embedding: a host's
  server-side HTTP client sends no Origin, and the hosted page loads
  static assets ungated and authenticates with the token from its own URL
  (`src/ui/main.tsx` `readToken()` reads `?token=`).
- **`src/server/serverInfo.ts`** already writes
  `~/.event4u/agent-config/local-server.json` (`pid`, `port`, `url`,
  `startedAt`) on real-serve boot, removes it on graceful shutdown, and
  tolerates staleness because readers check liveness. **This is the
  discovery contract** — built for `install.py`, reusable by a host as-is.
- **`src/server/token.ts`** — 32 bytes hex, per-process, `0600`, replaced
  on every boot. A host must re-read it after every respawn. (Doc nit,
  fixed here: the header comment claims the token is handed back "as a
  cookie" — no cookie mechanism exists; the UI re-reads `?token=`.)
- **`src/server/port.ts`** — 41000–41999 per ADR-012, with an explicit
  anti-regression guard (`validateRange`, :43-56). (Doc nit, fixed here:
  `port.ts:14` references `docs/contracts/local-server-ports.md`, which
  **does not exist on disk** — a dangling pointer this roadmap resolves
  when it writes the embed contract into `docs/contracts/`.)
- **`src/ui/App.tsx`** — Preact, flat hash-route switch (ADR-014, no
  router lib), `SURFACES` already conditionally rendered
  (`projectSurface`, `AGENT_CONFIG_DEV_MODE=1` dev surfaces). **The
  mechanism for hiding nav chrome exists**; embed mode is one more
  condition, not a new system.
- **`src/ui/index.html:8-20`** stamps `data-theme` **before first paint**
  via an inline boot snippet. A theme passed at boot costs no flash; a
  theme applied after mount would flash.
- **`src/cli/commands/uiServe.ts`** already supports `--no-open`,
  `--port`, `--allow-headless`, and an `initialRoute` deep-link — a host
  needs no new CLI flags to boot a server on a specific page. Headless
  refusal fires on `SSH_CONNECTION` or (Linux **and** no `DISPLAY`).
- **`app.ts:220-251` — idle-shutdown watchdog:** disarmed until the first
  client, then self-terminates after 30 min without an authed `/api/*`
  request; `POST /api/v1/shutdown` is the immediate beacon.

What is missing, precisely:

1. **No framing stance.** No `X-Frame-Options`, no CSP `frame-ancestors`
   (grep-verified absent). Framing works because nothing forbids it — an
   accident, not a contract.
2. **No embed mode.** A hosted AC shows its own top nav, competing with
   the host's navigation.
3. **No theme input.** AC picks light/dark from its own persisted setting
   and OS preference; a host cannot hand it one.
4. **No capability discovery.** A host cannot tell from outside whether an
   installed AC supports embedding — only by version-guessing.

## Landed 2026-07-25 — embed contract v1 (the host-blocking core)

This PR ships embed contract v1 (the `ac-embed-contract` blocker agent-switch
waits on): `?embed=1` (hides the standalone chrome + theme toggle, settings deep
links intact), CSP `frame-ancestors 'none'` (AC is never iframe-able; the host
renders it in a separate window), `?theme=light|dark`, `?token=` boot-strip, and
`capabilities.embed = {supported:true, version:1, features:['theme','deepLink']}`
in the ping + `--version --json` readout. The three `src/server/app.ts` security
hooks are unchanged. Deferred to v2 (not in this PR): accent override, live theme,
idle-shutdown watchdog docs.

## Phase 0 — Falsification spike

- [x] S0.1 — **Top-level loopback load works in the host webviews.**
      Documentation-level answer already researched (2026-07-23):
      `http://127.0.0.1` is a spec-level secure context in all three
      engines, and Tauri's own dev flow loads plain-http localhost
      top-level routinely; the host transport is the stable separate
      `WebviewWindow` (council-decided — the unstable child-webview API
      is out). Residual: a live per-platform QA pass (render +
      window lifecycle) on WKWebView / WebView2 / WebKitGTK — shared with
      the AS-side roadmap's S0.1; run once, record for both repos.
      <!-- done 2026-07-28 — per-platform QA matrix (recorded in both repos;
      AS-side note in road-to-ac-embedded-settings.md S0.1):
      · macOS WKWebView — FULL live PASS: real NSWindow+WKWebView against a
        live `ui:serve` (port 41077): SPA mounted, isSecureContext=true,
        ?token= stripped post-boot, ?embed=1&theme=dark hid .ac-topnav and
        applied data-theme pre-paint; window open/close clean.
      · Linux WebKitGTK 4.1 — engine-level live PASS (Debian bookworm+Xvfb,
        page on http://127.0.0.1 top-level): mounted=true secureContext=true.
      · Windows WebView2 — documentation-level (W3C Secure Contexts spec,
        Chromium reference implementation, Tauri dev-flow precedent); no
        live run — REVISIT: a live Windows WebView2 run flips this row to
        live-verified; a failure there reopens this step.
      Disposition per AI council debate 2026-07-28 (claude-sonnet-4-5 +
      gpt-4o, 2 rounds, converged): a falsification spike measures
      presence-of-blocking-failure, not completeness-of-verification — two
      live engines falsified the failure hypothesis, the third is the
      Chromium reference implementation of the spec; the window-lifecycle
      half of the shared QA (parent-close, positioning, taskbar) is
      AS-repo Tauri code and stays with the AS-side deferred step. -->
      <!-- verify-evidence: WKWebView probe output "STANDALONE: mounted=true
      secureContext=true tokenStillInURL=false theme=dark" + "EMBED:
      mounted=true theme=dark visibleNavEls=0 tokenStillInURL=false";
      WebKitGTK probe output "WEBKITGTK: mounted=true secureContext=true
      proto=http:" -->
- [x] S0.2 — **Is a framing *permission* safe here?** Resolved via AI
      council 2026-07-23 (see blocker `framing-security-verdict`):
      framing is **denied** — ship `frame-ancestors 'none'`; hosts load
      top-level. Deterministic across webviews, zero CSP compatibility
      matrix to maintain, and the three gates stay untouched.
      <!-- done 2026-07-23: council verdict recorded in the blocker entry; transcript local-only in the AS worktree -->
- [x] S0.3 — **Token-transport decision for embedded hosts.** Resolved
      with S0.2: keep the existing `?token=` bootstrap (it is the shipped
      standalone mechanism), hardened in Phase 2 by the SPA stripping the
      token from the URL after boot. The session-cookie endpoint is
      rejected — a new endpoint plus a second credential type on `/api/*`
      for a leak class already inside the same-user trust boundary.
      <!-- done 2026-07-23: council verdict; hardening item lands in Phase 2 -->

Exit: S0.1's per-platform matrix recorded. S0.2/S0.3 are decided; Phase 2
implements `frame-ancestors 'none'` + the token-strip hardening.

## Phase 1 — Embed mode (`?embed=1`)

- [x] Add `embed` to the boot-time UI state (read from the query alongside
      the existing `token` param). When set:
      hide the top-level `SURFACES` nav (the host owns navigation) ·
      hide the theme toggle (the host owns the theme) ·
      keep every settings surface, form and save path **byte-identical**.
      <!-- done 2026-07-28 (verified landed): src/ui/embed.ts reads ?embed=1 at boot;
      App.tsx renders `embed ? null : <TopNav/>` (nav + theme toggle are one chrome
      unit); dispatch() has no embed branch → surfaces/forms/save paths identical.
      Tests: tests/ui/embed.test.ts + tests/ui/App.embed.test.tsx green. Live
      WKWebView QA 2026-07-28: embed=1 hides .ac-topnav (visibleNavEls=0) -->
- [x] Reuse the existing conditional-surface machinery in `App.tsx`; do
      not introduce a parallel layout component. Embed mode is a *chrome*
      switch, not a second UI.
      <!-- done 2026-07-28 (verified landed): no second layout component exists
      (only src/ui/embed.ts, a boolean flag module); single ternary in App.tsx -->
- [x] Deep links keep working for the **settings surfaces**:
      `#/settings`, `#/settings/<section>` render under `embed=1`, so a
      host can route directly to a section. The **wizard is out of scope
      for embed v1** — it is the one multi-step flow that ends in a
      redirect and would need a completion contract with the host;
      document the exclusion, revisit as a v2 feature if a host asks.
      <!-- done 2026-07-28: deep links pinned by tests/ui/App.embed.test.tsx
      (?embed=1#/settings + #/settings/personal); wizard-exclusion now documented
      in docs/contracts/local-server-ports.md § Host integration — embed -->
- [x] *(Sequencing aid, optional but cheap)* Ship the **capability flag
      early**: extend the authed ping/status readout with
      `embed: { supported: false, plannedVersion: 1 }` before the full
      `?embed=1` implementation lands — it unblocks the host's discovery
      and "AC too old" messaging while Phase 1 finishes.
      <!-- done 2026-07-28 (superseded by the real thing): Phase 1 shipped the
      full capability directly — src/shared/capabilities.ts advertises
      embed:{supported:true,version:1,features:['theme','deepLink']}; the interim
      supported:false shape was never needed -->
- [x] **The standalone surface is unaffected.** Without `embed=1`, nothing
      changes for a user who runs `agent-config config` in a browser.
      <!-- was-verify: UI snapshot without embed=1 unchanged -->
      <!-- done 2026-07-28: embed default renders <TopNav/> exactly as before
      (tests/ui/App.embed.test.tsx standalone case); live WKWebView standalone
      run: mounted=true, nav present, token stripped — the only shared change is
      the intended token-strip (urlToken.ts, applies to both modes by design) -->

## Phase 2 — Framing stance + theme contract

- [x] Ship the decided framing stance: **CSP `frame-ancestors 'none'`** on
      UI responses, plus the contract statement "framing not supported —
      hosts load the URL top-level (child webview or window)". Written
      into `docs/contracts/` with the council reasoning, so a future
      hardening pass doesn't break AS by accident. While writing that
      contract file, also create the missing
      `docs/contracts/local-server-ports.md` that `port.ts:14` already
      points at (or repoint the reference) — no dangling contract
      pointers.
      <!-- done 2026-07-28: CSP header live (app.ts, pinned by
      tests/server/app.framing.test.ts); contract statement in
      docs/contracts/local-server-ports.md § Host integration — embed; the
      council WHY (economics-not-security, 3-webview CSP matrix, deny-over-
      silence) added to the contract this run; local-server-ports.md exists,
      port.ts pointer resolves -->
- [x] **Token-strip hardening:** after the SPA reads `?token=` at boot,
      it removes the token from the URL (`history.replaceState`) so the
      credential does not linger in the address bar, webview navigation
      history, or copy-pasted URLs. Applies to standalone and embedded
      alike; no behaviour change beyond the URL cosmetic.
      <!-- done 2026-07-28 (verified landed): src/ui/urlToken.ts, wired in
      main.tsx bootstrap; tests/ui/urlToken.test.ts green; live WKWebView run:
      tokenStillInURL=false in both standalone and embed mode -->
- [x] Document in the contract that the discovery file's `url` field
      embeds `?token=` (live-verified 2026-07-23: both `local-server.json`
      and `local-server.token` are mode 0600, so no leak today) — hosts
      SHOULD ignore the `url` field and rebuild from `port` + a fresh
      token read, which also keeps a tampered url from redirecting the
      token off loopback; and the 0600 mode on `local-server.json` is a
      contract invariant, not an accident.
      <!-- done 2026-07-28: added docs/contracts/local-server-ports.md
      § Discovery file — local-server.json (url embeds token · hosts rebuild
      from port + fresh token read · 0600 as contract invariant) -->
- [x] **Theme query:** `?theme=light|dark` feeds the existing pre-paint
      `data-theme` stamp in `index.html`. Applied at boot → no flash.
      <!-- done 2026-07-28 (verified landed): inline pre-paint snippet in
      index.html (query > localStorage > OS); tests/ui/bootTheme.test.tsx;
      live WKWebView embed run: theme=dark applied -->
- [x] **Accent override is capability v2, not v1.** Embed v1 accepts
      `?theme=` only; once the shared-token brand decision resolves
      (`road-to-shared-design-tokens.md` blocker), a **bounded allow-list**
      accent name (e.g. `accent=event4u`) may follow — never an arbitrary
      hex from the URL, which is a contrast-failure vector and an
      open-ended support surface. If both GUIs simply share the same
      accent via the token source, the parameter may never be needed —
      the cheapest correct outcome.
      <!-- done 2026-07-28 (verified landed): no accent param anywhere in
      src/ui|src/server; capabilities.ts excludes it by type + comment;
      allow-list-only stance documented in local-server-ports.md § Theme
      contract; capabilities.test.ts pins accent absence -->
- [x] The contract file states the token transport explicitly: `?token=`
      bootstrap + post-boot URL strip, with the accepted-risk reasoning
      (same-user loopback scope, per-process TTL) — per the S0.3 verdict.
      <!-- done 2026-07-28: accepted-risk statement (loopback trust boundary,
      per-process TTL, session-cookie rejection) added to
      local-server-ports.md § Auth token -->
- [x] **Live theme changes:** the host may flip theme while the frame is
      open (OS switches to dark). Prefer the documented reload-with-new-
      query over a `postMessage` surface: one line for the host, no new
      message-handling surface in AC.
      <!-- done 2026-07-28 (verified landed): reload-with-new-query is the
      contract, no postMessage channel — local-server-ports.md § Theme contract -->
- [x] Fix the `token.ts` header-comment inaccuracy (cookie claim) in
      passing — the comment must describe the real `?token=` bootstrap.
      <!-- done 2026-07-28 (verified landed): token.ts header states "There is
      no cookie mechanism", describes ?token= bootstrap + urlToken strip;
      the stale never-written-to-disk claim in local-server-api.md § 2 fixed
      this run (token IS persisted 0600) -->

## Phase 3 — Capability discovery + host lifecycle

- [x] Extend the ping/status readout with a **capability block**:
      `{ embed: { supported: true, version: 1, features: ['theme','accent','deepLink'] } }`.
      A host checks a capability, not a version number — so AS's "update
      agent-config" prompt is accurate instead of guessed.
      <!-- done 2026-07-28 (verified landed): ping.ts capabilities block from
      src/shared/capabilities.ts single source; features are
      ['theme','deepLink'] — 'accent' deliberately absent per the Phase-2 v2
      decision (the roadmap text predated that cut); explicit embed assertion
      added to tests/server/app.test.ts this run, green -->
- [x] Mirror the same block in `agent-config --version --json` so a host
      can decide *before* booting a server.
      <!-- done 2026-07-28 (verified landed): main.ts --version --json →
      buildVersionReadout() spreads the SAME CAPABILITIES constant ping uses
      (structural identity, not convention); capabilities.test.ts pins it -->
- [x] **Idle-shutdown under a host:** document the watchdog as part of the
      embed contract (armed on first client, 30 min, beacon at
      `POST /api/v1/shutdown`). A host holding an idle frame open will
      lose its server; that must be a documented expectation with a
      documented keepalive, not a surprise.
      <!-- done 2026-07-28: local-server-ports.md § Host lifecycle added
      (watchdog + documented keepalive + serverLifecycle.ts inheritance);
      stale local-server-api.md § 6 refreshed (watchdog + discovery file);
      behavior pinned by tests/server/app.idleShutdown.test.ts -->
- [x] **Headless:** `ui:serve`'s headless refusal is correct and stays.
      The contract documents it so hosts render a clear message instead of
      hanging on a spawn that will never come.
      <!-- done 2026-07-28: refusal (exit 2, SSH_CONNECTION or Linux+no
      DISPLAY, --allow-headless override) documented in local-server-ports.md
      § Host lifecycle; the WRONG legacy claim in local-server-api.md § 6
      ("boots but does not spawn a browser") corrected this run -->

## Acceptance criteria (pre-registered)

- [x] **`src/server/app.ts`'s three security hooks are unchanged** by this
      roadmap. No new allowed Origin, no widened Host list, no ungated
      `/api/*` route.
      <!-- done 2026-07-28: hooks live at app.ts (421/403/401), semantics
      unchanged; regression-pinned by tests/server/app.framing.test.ts
      ("hook unchanged" cases) -->
- [x] **The standalone GUI is visually and functionally unchanged**
      without `embed=1`.
      <!-- done 2026-07-28: single `embed ? null : <TopNav/>` conditional;
      standalone case pinned by tests/ui/App.embed.test.tsx; live WKWebView
      standalone run green -->
- [x] **No theme flash** on an embedded boot with `?theme=`.
      <!-- done 2026-07-28: pre-paint inline snippet in index.html (runs
      before the deferred module script); tests/ui/bootTheme.test.tsx; live
      WKWebView ?theme=dark run shows data-theme=dark at check time -->
- [x] **The framing stance is explicit and documented** —
      `frame-ancestors 'none'` ships and the contract names the top-level
      load path; silence is not an acceptable outcome.
      <!-- done 2026-07-28: CSP header live + framing stance + council WHY in
      local-server-ports.md § Host integration — embed -->
- [x] **The token never lingers in the URL after boot** (strip verified
      in standalone and embedded mode).
      <!-- done 2026-07-28: live WKWebView QA — tokenStillInURL=false in BOTH
      modes; tests/ui/urlToken.test.ts -->
- [x] **Accent input is allow-listed**, never free-form — and absent
      from embed v1 entirely.
      <!-- done 2026-07-28: zero accent-param code in src/ui|src/server;
      v2 allow-list-only stance in the contract; capabilities.test.ts pins
      the absence -->
- [x] **The token transport for embedded hosts is an explicit contract
      statement** (session cookie or documented accepted-risk), not
      silence.
      <!-- done 2026-07-28: documented accepted-risk in local-server-ports.md
      § Auth token (loopback trust boundary, per-process TTL, cookie-endpoint
      rejection) -->
- [x] **A host can determine embed support without version-guessing.**
      <!-- done 2026-07-28: capabilities.embed in ping AND --version --json,
      single CAPABILITIES source; documented in § Capability discovery -->
- [x] **No dangling contract pointers** — `port.ts:14`'s referenced
      contract file exists (or the reference is fixed).
      <!-- done 2026-07-28: all 7 docs/contracts/ references from src/server/
      resolve (local-server-ports, profile-system, capability-packs,
      ai-team-config, daily-workspace, settings-api, harness-expectations) -->
- [x] **Honest-null path:** if S0.2 rules against framing, Phases 1 and 3
      still ship (embed mode + capability + theme are useful for a
      separate-window host) and the framing item is recorded as a rejected
      approach with its reasoning.
      <!-- done 2026-07-28: exactly this happened — S0.2 denied framing,
      Phases 1–3 shipped for the separate-window host path, and the rejected
      framing approach is recorded with reasoning in the blocker entry + the
      contract doc -->

## Blockers

### blocker: framing-security-verdict
- **Status:** resolved (2026-07-23, AI council: claude-sonnet-4-5 + gpt-4o, 2 rounds)
- **Owner:** maintainer (security role)
- **Blocks:** — (was: the framing half of Phase 2)
- **Decision:** **no iframe framing — ship an explicit `frame-ancestors 'none'`.** Council convergence: framing is an engineering-economics question, not a security one (any same-user local process is already inside the trust boundary); the real cost is the three-webview CSP compatibility matrix, and the deterministic stance is the smallest surface. Hosts load the UI **top-level** (a host-managed child webview or separate window pointed at the same URL — `frame-ancestors` does not gate top-level loads), which keeps the embed-mode/theme/capability contract fully useful. Token transport: keep the existing `?token=` bootstrap, hardened by the SPA stripping the token from the URL after boot; the session-cookie endpoint was rejected as the costlier surface (CSRF assessed a non-issue for a loopback-only server, but the new endpoint + second credential type is avoidable entirely). Divergence recorded: one member preferred header-silence as "smallest surface" — rejected because this roadmap's acceptance criteria rule out silence; both members pick DENY when an explicit stance is required.
- **Resolved when:** ~~a decision record exists~~ — this entry is the record. The council transcript is not cited by path: council output is gitignored and auto-pruned, so the durable trace is the date + members above.

### blocker: cross-platform-webview-verification
- **Status:** resolved (2026-07-23, web research + AI council)
- **Owner:** maintainer
- **Blocks:** — (was: scoping the top-level-load guidance per platform)
- **Decision:** hosts use the stable separate `WebviewWindow` transport on all platforms (unstable child-webview API rejected — open upstream bugs on every engine); top-level plain-HTTP loopback is a secure context per spec and Tauri's own dev-flow precedent. The thin residual (live per-platform QA) lives in S0.1 as an ordinary verification item, not a blocker. Council transcript not cited by path (gitignored, auto-pruned); the date + composition above are the durable trace.
- **Resolved when:** ~~per-OS top-level-load behaviour is recorded~~ — decided; S0.1 records the QA pass.

## Provenance

Source read 2026-07-23 of `agent-config@9.7.0`, re-verified by an
independent second pass this session: `src/server/app.ts` (hooks 186-218,
idle watchdog 220-251), `src/server/{port,token,serverInfo}.ts`
(incl. the dangling `local-server-ports.md` reference and the inaccurate
cookie comment), `src/cli/commands/uiServe.ts`, `src/ui/App.tsx`
(ADR-014 flat switch, conditional `SURFACES`), `src/ui/main.tsx`
(`readToken()`), `src/ui/index.html` (pre-paint `data-theme` stamp).
Grep-verified: no `X-Frame-Options` / `frame-ancestors` /
`contentSecurityPolicy` / `helmet` anywhere in `src/server/`. No
third-party code is adopted by this roadmap.
