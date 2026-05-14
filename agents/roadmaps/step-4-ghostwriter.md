---
complexity: lightweight
---

# Roadmap: `/ghostwriter` cluster + `/post-as:me` + `/post-as:ghostwriter`

> Introduce a third voice primitive (`ghostwriter/<name>.md`) for AI-assisted writing in the public voice of a real public figure, plus the `/ghostwriter` cluster that maintains it and the `/post-as:me` / `/post-as:ghostwriter` aliases that consume it. Council-validated design (2026-05-14, Opus + o1, deep tier, "Mixed leaning Reject" — pivoted to a constrained hybrid that addresses every blocker). Hybrid storage model: package source ships zero real-person profiles, consumer projects keep them gitignored-by-default.

## Re-validation gate (READ BEFORE EXECUTING)

> **Before any step in this roadmap runs, re-run the AI Council on the source artefact and compare the verdict against this roadmap:**
> 1. [`agents/council-sessions/2026-05-14-ghostwriter/prompt.md`](../council-sessions/2026-05-14-ghostwriter/prompt.md) + [`responses.json`](../council-sessions/2026-05-14-ghostwriter/responses.json) — Council returned "Mixed leaning Reject" on the named-profile variant. This roadmap encodes the **hybrid constrained pivot** (Variant 3 from the host-agent synthesis): consumer-side named files allowed but gitignored, package-side zero real profiles, public-figure-only gate, mandatory disclosure footer, host-agent fetch.
> 2. Inherited floors that must still hold: determinism (no package network code, per [`2026-05-14-agent-user-external-sources`](../council-sessions/2026-05-14-agent-user-external-sources/) REJECT) and privacy (no third-party PII beyond the public-figure carve-out documented here, per [`2026-05-14-agent-user-persona`](../council-sessions/2026-05-14-agent-user-persona/)).
>
> The codebase may have changed since drafting (new commands, schema migrations, new personas, persona-roadmap progress). Pass criterion: every Phase-1 design decision still maps to a "ship" or "minor-edit" verdict under the hybrid constraints. Fail criterion: any blocker resurfaces that the hybrid does not already address — escalate to the user.

## Prerequisites

- [ ] Re-validation gate (above) passes
- [ ] Read [`agents/council-sessions/2026-05-14-ghostwriter/prompt.md`](../council-sessions/2026-05-14-ghostwriter/prompt.md) and [`responses.json`](../council-sessions/2026-05-14-ghostwriter/responses.json)
- [ ] Read `.agent-src.uncompressed/commands/AGENTS.md` (cluster contract) and `.agent-src.uncompressed/personas/README.md` (confirm review-lens personas stay separate)
- [ ] Read [`step-3-agent-user-persona.md`](step-3-agent-user-persona.md) — `.agent-user.md` is the style source for `/post-as:me` and must exist before Phase 3 Step 3 lands
- [ ] Confirm no commits / pushes happen without explicit per-step user approval (per [`commit-policy`](../../.augment/rules/commit-policy.md))

## Context

Council Round on the question "ghostwriter cluster + write command + post-as aliases" produced converging verdicts on the **constraints** even where it split on the headline ship/reject call. The hybrid pivot locked here addresses every flagged blocker:

- **Storage hybrid (Q1):** Consumer project — `agents/ghostwriter/<name>.md`, gitignored by default. Package source (`.agent-src.uncompressed/ghostwriter/`) — README + schema + **fictional fixtures only** (e.g. `fictional-techie.md`). **No real-person profile ever ships with the OSS package.** Resolves the distribution-problem both reviewers flagged as critical.
- **Schema (Q2):** Identity (name, role/era, public-figure category, source URLs, fetch date, confidence), style fingerprint (structured stats + free-form notes), capped voice samples (max 3, max 200 words each, source-attributed), taboos, source provenance. Hard cap 200 lines per file.
- **Cluster shape (Q3):** Top-level `/ghostwriter` cluster (`fetch / write / list / show / delete`). `/post-as:me` is a separate top-level command that reads `.agent-user.md`. `/post-as:ghostwriter` is a thin alias that invokes `/ghostwriter:write`. Variant A from the council prompt — least confusing, scales to future `/post-as:*` aliases without sub-cluster nesting.
- **Fetch mechanism (Q4):** Host-agent web-fetch for LinkedIn URLs · host-agent web-search for name-only inputs ("Stephen Hawking" → search for public posts, books, interviews). **Zero network code in the package.** Documented host-agent capability fallback: if the host cannot fetch/search, the command emits a paste-prompt and accepts the user's manual paste.
- **Ethics floor (Q5):** Public-figure-only gate with explicit user acknowledgment before the file is written. Mandatory disclosure footer in every `write` output ("Written in the style of X, not by them") with no opt-out. Banned content list — leaked drafts, paywalled material, login-walled content, private DMs, anything explicitly marked private, retracted content. Right-of-publicity and defamation disclaimers documented in the command body.
- **Write UX (Q6):** Numbered-menu listing, topic prompt, optional tone/length/channel modifiers, raw markdown output with the mandatory disclosure footer. Error-out when no ghostwriter exists. `/post-as:me` shares the write engine, source = `.agent-user.md.voice_sample`.
- **Three voice primitives stay separate:** `personas/*.md` (review-lens, internal) · `.agent-user.md` (the maintainer, self) · `ghostwriter/*.md` (external public-figure voice). No folding, no shared schema, no cross-cluster commands.

This roadmap is **work-only** — no version pins, no tag plans, no release dates.

- **Source verdicts:** [`responses.json`](../council-sessions/2026-05-14-ghostwriter/responses.json) (Opus + o1, real cost $0.29, "Mixed leaning Reject" on the named-profile variant; the hybrid below was synthesised by the host agent to address every blocker the council raised)
- **Sibling roadmaps:** [`step-3-agent-user-persona.md`](step-3-agent-user-persona.md) · [`step-2-ai-council-consolidation.md`](step-2-ai-council-consolidation.md) · [`step-1-v2-feedback-followup.md`](step-1-v2-feedback-followup.md) — all run in parallel; Phase 3 Step 3 of this roadmap depends on the persona-roadmap Phase 1 having shipped `.agent-user.md`

## Phase 1: Schema + storage + privacy gate + fictional fixtures

Lock the file format, the dual storage model, the gitignore wiring, and the public-figure gate before any command implementation. Ship one fictional fixture so the package has a working example without shipping a real person.

- [ ] **Step 1 — Lock the v1 schema:** Draft `docs/contracts/ghostwriter-schema.md` with the locked frontmatter (`version`, `identity.{name, role_or_title, era, public_figure_category, source_urls, fetched_at, confidence}`, `style.{fingerprint.{sentence_length_avg, vocab_register, opener_patterns, closer_patterns, hashtag_rules, emoji_rules, paragraph_cadence}, free_form_notes}`, `voice_samples` (max 3, each `{text, source_url, length_words<=200}`), `taboos`, `source_provenance.{count, last_fetched_at, types}`, `last_updated`) plus a single `# Notes` freeform section. Hard cap 200 lines per file. Public-figure-category enum: `author / executive / academic / politician / journalist / public_speaker / public_artist / deceased_historical`. Explicit exclusions: no private DMs, no paywalled content, no login-walled material, no leaked drafts, no medical/financial/legal data, no opinions attributed to the figure that they have not publicly stated.
- [ ] **Step 2 — Storage model:** Document in the contract: consumer projects use `agents/ghostwriter/<slug>.md` (slug = full-name kebab-case, optional `-<discriminator>` suffix for disambiguation — `alice-walker` vs `alice-walker-novelist`). Package source uses `.agent-src.uncompressed/ghostwriter/` for **README + schema doc + fictional fixtures only** — no real-person files. Add a CI lint (`task lint-ghostwriter-source`) that fails if any file under `.agent-src.uncompressed/ghostwriter/` lacks a `fictional: true` frontmatter key.
- [ ] **Step 3 — Gitignore by default:** Add `agents/ghostwriter/*.md` (except `README.md`) to the package-managed `.gitignore` block via the existing `sync-gitignore` skill / `agent-config gitignore:sync` flow. Document a `--shared` opt-in (deferred to v2; only the doc note lands now).
- [ ] **Step 4 — Public-figure gate spec:** Document in the contract the explicit acknowledgment the user must give before any `fetch` writes a file. Required user statement: target is a public figure with a documented public-facing role, sources are public and not paywalled/leaked, user accepts the right-of-publicity and defamation disclaimers, user agrees the disclosure footer will be non-removable. Acknowledgment is recorded in `identity.acknowledgment_recorded_at` in the file.
- [ ] **Step 5 — Fictional fixture:** Create `.agent-src.uncompressed/ghostwriter/fictional-techie.md` and `.agent-src.uncompressed/ghostwriter/README.md`. The README explains the package-side fictional-only rule and points consumer-side maintainers at `agents/ghostwriter/` for their real profiles. Verify `task sync` carries fixtures through to `.agent-src/` and `.augment/`.

## Phase 2: `/ghostwriter:fetch` (URL + name-only modes)

Wire the host-agent fetch / search procedural commands. Zero network code in the package.

- [ ] **Step 1 — Add the `ghostwriter` cluster to the dispatch table:** Update `.agent-src.uncompressed/commands/AGENTS.md` (or the canonical cluster registry) to register the top-level `/ghostwriter` cluster with sub-commands `fetch / write / list / show / delete`. Create `commands/ghostwriter.md` as the cluster dispatcher.
- [ ] **Step 2 — Implement `/ghostwriter:fetch` (URL mode):** Create `commands/ghostwriter/fetch.md`. When invoked with a LinkedIn / blog / Substack URL: run the public-figure gate (Phase 1 Step 4) → instruct the host agent to fetch the URL via its built-in web-fetch capability → extract public posts (target: last 100 where available, minimum 3 distinct items for a valid profile) → propose a populated profile file. User confirms before write. Re-fetch on existing slug routes through a diff-and-accept flow (mirrors `/agents user accept`).
- [ ] **Step 3 — Implement `/ghostwriter:fetch` (name-only mode):** Same command, branch when the input is a bare name without URL. Instructs the host agent to use its web-search capability to find authoritative public sources (Wikipedia, official site, verified social, archived books / interviews for deceased figures). Minimum 3 distinct authoritative sources before write. Documents the host-agent capability fallback: if the host cannot search, the command emits a paste-prompt requesting the user feed sources manually.
- [ ] **Step 4 — Confidence rating + stale threshold:** Document in the contract: `confidence` is `low / med / high` derived from source count and source-type diversity (low: 3 sources same platform · med: 3+ sources 2 platforms · high: 5+ sources 3+ platforms inc. one canonical reference). 90-day stale warning when any `/ghostwriter` command runs against a profile older than `last_updated + 90d`. Non-blocking, surfaces as a one-liner.

## Phase 3: `/ghostwriter:write` + `/post-as:me` + `/post-as:ghostwriter`

The consume side. Numbered menu, mandatory disclosure, shared write engine for the user-self path.

- [ ] **Step 1 — Implement `/ghostwriter:write`:** Create `commands/ghostwriter/write.md`. Flow: (a) list available ghostwriters from `agents/ghostwriter/*.md` (excluding `README.md`) as a numbered menu, (b) accept selection (or `--as=<slug>` for non-interactive), (c) prompt for topic, (d) optional flags `--tone=<formal|casual>`, `--length=<words>`, `--channel=<linkedin-post|tweet|blog>`, `--audience=<text>`, (e) emit a copyable markdown block in the chosen ghostwriter's voice, (f) **append the mandatory disclosure footer** (`Written in the style of <name>, not by them.`) — no `--no-disclosure` flag. Error-out (do not default) when no ghostwriter exists or none is selected.
- [ ] **Step 2 — Implement `/post-as:ghostwriter` alias:** Create `commands/post-as/ghostwriter.md` as a thin alias that invokes `/ghostwriter:write` with all passed flags. Document the alias status — same flags, same output, same disclosure rules.
- [ ] **Step 3 — Implement `/post-as:me`:** Create `commands/post-as/me.md`. Reads `.agent-user.md.voice_sample` (depends on persona-roadmap Phase 1 having shipped). Shares the same write engine as `/ghostwriter:write` (extract to a shared procedural section `docs/contracts/write-engine.md`) — style source differs, disclosure footer omitted (the user IS the author). Error-out if `.agent-user.md` is missing with a pointer to `/agents user init`.
- [ ] **Step 4 — Cluster cross-references:** Update `docs/contracts/command-clusters.md` with the new `/ghostwriter` cluster and the two `/post-as:*` commands. Verify `task lint-skills` passes.

## Phase 4: Maintenance — list / show / delete / refetch

Round out the cluster. Read-only and destructive operations land last so the write path proves stable first.

- [ ] **Step 1 — Implement `/ghostwriter:list`:** Create `commands/ghostwriter/list.md`. Numbered listing of all `agents/ghostwriter/*.md` profiles with name, role, confidence, last-updated, stale-warning flag.
- [ ] **Step 2 — Implement `/ghostwriter:show`:** Create `commands/ghostwriter/show.md`. Renders a single profile (selection by number or slug) — identity, style fingerprint summary, voice-sample previews, taboos, source URLs. Read-only.
- [ ] **Step 3 — Implement `/ghostwriter:delete`:** Create `commands/ghostwriter/delete.md`. Selection by number or slug, two-step confirmation, hard-deletes the file. Reminds the user that git history may still contain the file if the consumer ever committed it (per the gitignore-by-default rule, this should not normally happen).
- [ ] **Step 4 — Re-fetch refresh path:** Confirm Phase 2 Step 2's diff-and-accept flow handles `--force-refresh` (rebuilds from scratch instead of merging). Documented in the contract.

## Phase 5: Documentation + cross-references

- [ ] **Step 1 — README section:** Add a "Ghostwriter" section to the package README. Two paragraphs max: what it is, the public-figure-only + disclosure-footer + no-package-distribution constraints, pointer at `/ghostwriter:fetch`.
- [ ] **Step 2 — Persona / user cross-link:** Update `personas/README.md` and `docs/contracts/agent-user-schema.md` with a "see also" pointer at the ghostwriter contract — clarifies the three-primitive model (reviewer · self · external author).
- [ ] **Step 3 — Skill cross-reference audit:** Run `agent-config check:refs` (or the equivalent `check-refs` skill). Fix any broken pointer.

## Acceptance Criteria

- [ ] Re-validation gate executed; verdict recorded in this file before any phase starts
- [ ] Phase 1 — Schema contract exists; dual storage model documented and CI-enforced (no real profiles in package source); gitignore wired; public-figure gate spec exists; one fictional fixture shipped
- [ ] Phase 2 — `/ghostwriter:fetch` works in URL mode and name-only mode via host-agent; minimum source count enforced; diff-and-accept on re-fetch; 90-day stale warning surfaces
- [ ] Phase 3 — `/ghostwriter:write` emits markdown + mandatory disclosure footer; `/post-as:ghostwriter` alias works; `/post-as:me` reads `.agent-user.md` and shares the write engine
- [ ] Phase 4 — `list / show / delete` work; re-fetch refresh path documented
- [ ] Phase 5 — README updated; cross-references valid; `check:refs` passes
- [ ] All quality gates pass at each phase boundary (`task ci`, `task lint-skills`, `task lint-ghostwriter-source`)
- [ ] **Zero network code in the `agent-config` package itself** — verified by grep (no `requests`, `urllib`, `httpx`, `fetch`, etc. introduced by Phase 2)
- [ ] **Zero real-person profiles in `.agent-src.uncompressed/ghostwriter/` or any generated `.agent-src/` / `.augment/` tree** — verified by `task lint-ghostwriter-source`
- [ ] Every `/ghostwriter:write` and `/post-as:ghostwriter` output ends with the disclosure footer — verified by command-doc inspection (no `--no-disclosure` flag exists)

## Notes

- **Privacy floor (carve-out from persona-roadmap):** The persona-roadmap forbids third-party names *in `.agent-user.md`*. The ghostwriter primitive carves out a public-figure-only path that stores third-party names *in separate files in a separate directory under a gitignore default*. The carve-out is bounded: only documented public figures, only public sources, mandatory disclosure footer on every output, no package distribution. Random LinkedIn users who are not public figures remain forbidden.
- **Determinism floor (inherited unchanged):** The `agent-config` package contains zero network code. `/ghostwriter:fetch` is a procedural document that delegates the fetch or search to the host agent's built-in capability — the user owns the call, the host agent performs it, the package only reads the resulting data and proposes diffs.
- **Distribution floor (new):** The OSS package itself never ships a real-person ghostwriter profile. The package-side `ghostwriter/` directory contains only README + schema doc + `fictional: true` fixtures. Real profiles live exclusively in consumer projects under `agents/ghostwriter/` and are gitignored by default.
- **Cost-ordering rationale:** Phase 1 ships the constraints first (schema, storage hybrid, gate, fixture) so every later step lands on a hardened floor. Phase 2 ships the fetch path (no value without it). Phase 3 ships the write path (consume side). Phase 4 rounds out maintenance. Phase 5 closes loose ends.
- **Rejected directions (do not re-open without new evidence):** Storing real-person profiles in the package source (council unanimous reject — distribution liability). Auto-disclosure-opt-out flag (council unanimous reject — defamation risk). Private individuals as targets (council unanimous reject — no fair-use defence). Package-level HTTP calls (inherited from external-sources council). Folding ghostwriter into `personas/` (council reject — two primitives, distinct purpose).
- **Deferred to v2 (gather usage data first):** `--shared` git-commit flag implementation, team-internal ghostwriter (colleague-as-coauthor with explicit consent), scaffold-with-placeholders output mode, batch-fetch from a reading-list, integration with `memory-consolidation` for cross-session style refinement, multi-language style fingerprints.
- **Out of scope:** Encryption at rest, cloud sync, paywalled-content workarounds, generating content attributed to the figure (only ever "in the style of"), training a fine-tuned model from the profile.
- **Decline / fence handling:** If the user declines a step, mark it `[-]` (cancelled) and move on per [`scope-control`](../../.augment/rules/scope-control.md). Do not re-ask in the same task.
- **Sibling roadmaps:** Phase 3 Step 3 (`/post-as:me`) depends on persona-roadmap Phase 1 (`.agent-user.md` schema + `init` command). All other phases independent.
