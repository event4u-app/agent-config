# Human-Owner TODO — everything only YOU can do (all 3 active roadmaps)

Generated 2026-06-07 after the `/roadmap:process-full` run (PR #389). Every
autonomous step is done or council-deferred; the items below are the exact
remaining human-owner actions. Check them off here as you go — when one is
done, tell the agent and it flips the matching roadmap checkbox.

Legend: **What** = the action · **Where** = file / URL · **How** = exact steps ·
**Then** = what to tell the agent afterwards.

---

## 0. Right now — unblock the run that just finished

- [x] **Review + merge PR #389**
  - **What:** Roadmap reconciliation + daily-workspace walkthrough + step-9 audit report.
  - **Where:** <https://github.com/event4u-app/agent-config/pull/389>
  - **How:** Read the diff (4 files, docs-only), approve, merge. All attached checks are green; the two red 0-second entries in the Actions *list* are GitHub phantom runs (documented in `.github/workflows/sync-visibility.yml` header) and do not appear on the PR checks page.
  - **Then:** nothing — merge is the action.

> **Status after the 2026-06-08 autonomous follow-up run:** §1.1 (registries) and §1.4 pandoc-CI are now closed; roadmap dashboard at **69/81**. A second PR carries the Phase 0 + Phase 5 reconciliation (link in the chat reply). Everything still unchecked below is genuinely human-owner or spend-gated.

---

## 1. Roadmap: `road-to-employee-product-and-external-proof.md`

### 1.1 Registry listings (Phase 0, Steps 1–2 — ~50 min total)

- [x] **Open the `awesome-mcp-servers` PR** (~30 min)
  - **What:** One-line listing for this package in the biggest MCP directory.
  - **Where:** <https://github.com/punkpeye/awesome-mcp-servers> — fork it under YOUR GitHub identity (this is why it can't be autonomous).
  - **How:**
    1. Fork → edit `README.md`, add under the fitting category:
       `[event4u/agent-config](https://github.com/event4u-app/agent-config) — Skill / rule / command suite for AI coding tools (Claude Code, Augment, Cursor, Copilot, Windsurf) with kernel + router contracts, AI Council, explain-traces.`
    2. Open the PR against `punkpeye/awesome-mcp-servers`. The prepared template text lives at `docs/distribution/registries.md` § MCP registries.
  - **Then:** give the agent the PR URL — it captures the link in `docs/distribution/registries.md` and flips Phase 0 Step 1.

- [x] **Submit mcp.so + mcpservers.org entries** (~10 min each)
  - **What:** Directory entries via their web submission forms (no API — human only).
  - **Where:** <https://mcp.so> ("Submit" form) and <https://mcpservers.org> ("Add server" form).
  - **How:** Fill name (`event4u/agent-config`), repo URL, and the same one-line description as above. Note the submission date/time.
  - **Then:** give the agent both timestamps — it records them in `docs/distribution/registries.md` and flips Phase 0 Step 2.

### 1.2 Recruit sessions (Phase 1, Steps 3–6 — the single highest-leverage block)

Everything downstream (role-prompt phrasing, beta status flips, workspace
screenshots, encrypt-at-rest PR timing) is gated on these three sessions.

- [ ] **Session 01 — galabau owner** (60 min + prep)
  - **What:** Recorded screen-share: a real galabau owner produces a customer offer from a one-paragraph brief.
  - **Where:** Playbook: `agents/recruit-sessions/README.md` (who counts as a recruit, consent + redaction floor). Script + checklist: `agents/recruit-sessions/_template.md`.
  - **How:**
    1. Recruit someone NOT on the team, no prior package exposure.
    2. Pre-session checklist from `_template.md` (clean machine, provider keys, recording armed, on-camera consent paragraph).
    3. Run the 8-question interview script during/after the task.
    4. Write the report from the template skeleton → save as `agents/recruit-sessions/01-galabau-owner.md` (redact personal data first).
  - **Then:** tell the agent "session 01 report is filed" — it flips Phase 1 Step 3 and pulls verbatim phrasing into `agents/roles/galabau/prompts/` (Phase 3 Step 2 beta flip).

- [ ] **Session 02 — content creator** (60 min + prep)
  - **What:** Same procedure; task: 4-shot storyboard for a 30-second social video.
  - **Where:** Report target `agents/recruit-sessions/02-content-creator.md`.
  - **Then:** agent flips Phase 1 Step 4 + content-creator role beta flip.

- [ ] **Session 03 — consultant** (60 min + prep)
  - **What:** Same procedure; task: refine a fuzzy client brief into a structured investor memo.
  - **Where:** Report target `agents/recruit-sessions/03-consultant.md`.
  - **Then:** agent flips Phase 1 Step 5 + consultant role beta flip.

- [ ] **Findings consolidation** (agent-assisted, after all three reports exist)
  - **What:** Top-10 friction list with a roadmap home per finding.
  - **How:** Just tell the agent "consolidate the recruit findings" — it writes `agents/recruit-sessions/_findings.md` (Phase 1 Step 6) and re-justifies later phases against it.

### 1.3 Workspace walkthrough screenshots (Phase 4, Step 11 remainder)

- [ ] **Follow-up validation session + screenshots**
  - **What:** Sit one of the three recruits in front of the workspace tab, capture real screenshots + one verbatim quote.
  - **Where:** Doc to extend: `docs/walkthroughs/daily-workspace.md` (text already shipped, screenshot slots intentionally absent).
  - **How:** `npx @event4u/agent-config ui:serve` → Workspace tab → screenshot role grid, task picker, right rail. Drop images into `docs/walkthroughs/` (e.g. `daily-workspace-roles.png`).
  - **Then:** tell the agent "screenshots are at <paths>, quote is: …" — it embeds them and flips Step 11 from `[~]` to `[x]`.

### 1.4 Maintainer decisions (small, can be done anytime)

- [ ] **Schedule the encrypt-at-rest PR** (Phase 8, Step 3 — council-deferred)
  - **What:** Decide WHEN the dedicated store-encryption PR happens (council verdict 2026-06-07: own narrow PR, after recruit validation, Node-keyring architecture must be picked first).
  - **How:** When ready, tell the agent: "start the encrypt-at-rest wiring PR — decide the Node keyring approach via council first." Nothing else needed from you.
- [x] **Add pandoc to CI** (Phase 5 export-matrix remainder) — ✅ resolved 2026-06-08 by AI council (claude-sonnet-4-5 + gpt-4o, design mode), verdict **(b)**: do NOT add pandoc/TeX to CI (a 150–500 MB supply-chain dep would test pandoc's determinism, not our code, for a gracefully-degrading pre-v1.0 feature). Instead the 3×3 matrix is now an **invocation-contract** matrix (pandoc stubbed; argv/output-path/format-routing asserted across {offer,memo,brief} × {pdf,docx}) plus an opt-in real-render docx check that runs only when pandoc is on PATH. Phase 5 closed. No action needed from you.

---

## 2. Roadmap: `road-to-video-foundation-validation.md` — ✅ COMPLETED 2026-06-10

Fully closed in-session with the maintainer: Veo key handed over, spend
authorized, `gemini-veo` live-wired and validated (**10/10 renders, $1.60/render,
4s MP4 with native AAC audio**), promoted `experimental → stable` (all 3 sync
points). Evidence: `agents/reference/ai-video/smoke-traces/README.md`
§ Validation result. Roadmap archived.

One leftover that is still yours (NOT blocking anything):

- [ ] **Decide ADR-056 for the remaining 4 unvalidated adapters** (~10 min reading)
  - **What:** `gemini-veo` is now validated+stable; the fold/shim/remove disposition for `higgsfield`, `kling`, `openai-images`, `sora` is still open.
  - **Where:** `docs/decisions/ADR-056-unvalidated-video-adapters-disposition.md` (status: `proposed`).
  - **How:** Read the options table, pick one, tell the agent "accept ADR-056 with option X" — it flips the ADR to `accepted` and regenerates the index.
  - **Note:** daily quota on the validated Gemini tier is ≈10 renders/day — relevant context for whether the multiplexers (fal/replicate) should carry batch workloads instead.

---

## 3. Roadmap: `road-to-video-provider-multiplexers.md` — ✅ COMPLETED 2026-06-10

Fully closed in-session with the maintainer: fal + Replicate keys handed over,
spend authorized, **3 models per multiplexer live-validated** (fal: ltx-2 w/
native audio, wan-2.2, hunyuan · Replicate: wan-2.2-fast, ltx-video, hunyuan),
manifests `verified:true` with trace refs, ~$2–4 total. Bonus: the Kling direct
adapter got real keypair/JWT auth (AccessKey+SecretKey) and a live trace.
Roadmap archived.

One open maintainer call (NOT blocking):

- [ ] **Lifecycle promotions** — `fal` (3/3), `replicate` (3/3), `kling` (1/1)
  all have live traces and stay `experimental` until your tier flip. Tell the
  agent which to promote to `stable` (gemini-veo already is).

---

## Suggested order (cheapest leverage first)

1. Merge PR #389 (2 min)
2. Registry listings — § 1.1 (~50 min, pure adoption leverage)
3. fal.ai smoke trace — § 3 (one key + a few dollars; unblocks the whole video track fastest because the multiplexer reaches 5 models at once)
4. ADR-056 + foundation validation — § 2
5. Recruit sessions — § 1.2 (biggest effort, biggest unlock: everything in § 1.3/1.4 hangs off it)
