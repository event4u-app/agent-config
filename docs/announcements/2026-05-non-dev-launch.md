# Non-dev launch announcements — step-12 Phase 7 L126

Three drafts, one per surface. Drafted via the `ghostwriter` cluster pattern; final voice tuning happens at post-merge surface time.

Status: **drafted, not yet posted**. Posting is out-of-scope for the autonomous merge — it lights up after the README and `--user-type` UX are live in `main`.

---

## 1. Product Hunt (no-code tag) — long-form launch post

**Title:** `agent-config — a governed skill suite that finally treats consultants, creators, and finance/ops as first-class AI-tool users`

**Tagline (60 chars):** `AI agent OS for non-developers — no terminal required`

**Body:**

Most "AI assistant" tools assume you write code. The rest assume you just want to chat. `agent-config` is the third option: a **governed skill, rule, and command suite** that gives every AI coding tool (Claude Code, Cursor, Windsurf, Copilot, Augment) a shared playbook — and it works just as well for a marketer drafting launch copy, a consultant building a discovery guide, or a founder modelling runway as it does for an engineer shipping a feature.

What's actually new:
- **`--user-type` axis.** `npx agent-config init --user-type=creator` loads the ~7 skills relevant to you, not all 195.
- **Domain safety floors.** PII never leaks into a support macro draft. Health, legal, financial outputs ship with mandatory disclaimers.
- **No fork required.** All projection trees regenerate from a single source-of-truth; consumer config is one `.agent-settings.yml`.

Open source, MIT. Comments welcome — especially "this is wrong for my workflow, here's why."

---

## 2. Indie Hackers — consulting forum post

**Title:** `[Open-source release] A shared skill library for solo consultants who use Claude or ChatGPT every day`

**Body:**

Hey IH —

If you run a one-person consulting practice and you already lean on an AI assistant for discovery guides, positioning audits, voice-of-customer extraction, or stakeholder trade-off matrices — I built (and just open-sourced) a shared library of skills for that.

It's called `agent-config`. The bit relevant to consultants:
- ~7 skills auto-loaded for `--user-type=consultant` (vs. 195 total) — `discovery-interview`, `competitive-positioning`, `voc-extract`, `stakeholder-tradeoff`, `market-entry-analysis`, `customer-research`, `competitive-moat-analysis`.
- Works inside Claude Code, Cursor, Windsurf, ChatGPT custom GPTs, and Copilot — same skills, different host.
- 16-prompt benchmark proves the agent picks the right skill 93.75 % of the time on real consulting prompts.

`npx agent-config init --user-type=consultant` and you're done.

Looking for **5 working consultants** to try it on a real client engagement and let me know where it breaks. Comment or DM if interested.

---

## 3. r/ContentWritingJobs — short link-and-ask post

**Title:** `Open-sourced a skill library for marketers and content writers who use AI assistants — looking for 3 real test runs`

**Body:**

Built and released `agent-config` — a governed skill, rule, and command suite for AI assistants (Claude, ChatGPT, Cursor). Includes the skills marketers actually use:

- `voice-and-tone-design` — three-attribute voice + tone-by-context matrix
- `messaging-architecture` — primary message, supporting proofs, audience matrix
- `editorial-calendar` — evergreen / campaign / reactive split, per-channel beats
- `release-comms` — turn changelogs into value-framed announcements
- `content-funnel-design` — per-stage content shape, mid-funnel leak diagnosis

Setup: `npx agent-config init --user-type=creator`. No coding, no terminal homework beyond one command.

Free, MIT, no telemetry without opt-in. Looking for **3 content writers** to walk through a real brief end-to-end and tell me where the skill descriptions confuse you. I'll credit you in the case studies.

DM or comment.

---

## Anti-patterns (what NOT to do)

- **No "the future of AI" framing.** Concrete artefacts only.
- **No fake testimonials.** Recruit live (5 IH + 3 Reddit + Product Hunt traffic) and run real case studies (Phase 7 L128–131).
- **No "killer of X" framing.** Position as the missing layer between general assistants and code-only tools.

## Provenance

Drafts produced 2026-05-15 in the step-12 autonomous closure run. Voice tuning at post-merge time per the post-as cluster.
