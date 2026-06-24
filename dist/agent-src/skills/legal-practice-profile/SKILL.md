---
model_tier: inherit
name: legal-practice-profile
description: "Use when setting up the legal pack — captures jurisdiction, role, escalation, and playbook into a plain-prose profile every legal skill reads. Triggers on \"set up legal\", \"legal profile\"."
status: active
tier: senior
domain: process
recommended_for_user_types: [legal]
workspaces:
  - legal
packs:
  - legal
trust:
  level: advisory
install:
  removable: true
---

# legal-practice-profile

The keystone of the legal pack. Legal skills (`contract-review`, `nda-triage`, `dpa-review`, `legal-intake-triage`) ship **procedure + output template only — no default legal positions**. This skill captures the positions, in plain prose, so one generic skill set behaves team-specifically. Obeys `legal-safety-floor`.

## When to use

- First run of the legal pack — before any review skill is invoked (they halt on `[configure]` placeholders until the profile exists).
- A position changed (new standard NDA term, a different escalation owner, a jurisdiction added within EU/DE scope).
- A non-lawyer is being given pack access — the role capture drives the attorney gate everywhere downstream.

Do NOT use it to perform a review (route to the review skills) or to store per-matter state (the pack deliberately ships no matter-workspace).

## Procedure

### Step 0: Offer quick vs full

- **Quick (≈2 min)** — jurisdiction, role, escalation owner. Writes `[DEFAULT]` markers for everything else and tells the user which to tune later.
- **Full (≈15 min)** — adds playbook positions per skill (NDA terms, contract clause stances, DPA sub-processor / audit / liability positions). Pause/resume via a `<!-- PROFILE PAUSED AT: <section> -->` marker + `[PENDING]` fields.

### Step 1: Capture the load-bearing identity

1. **Jurisdiction** — must be within EU/DE scope. If the user names an out-of-scope jurisdiction, surface the hard-refusal: the pack covers EU/DE only; for others, consult licensed local counsel. Record the chosen jurisdiction; every skill stamps it as its `Jurisdiction:` tag.
2. **Role** — lawyer / non-lawyer-with-access / non-lawyer-without. This is load-bearing: it selects the work-product header and arms the GREEN×non-lawyer attorney gate in every skill. Capture honestly; never infer.
3. **Escalation owner + reviewer** — who the attorney gate routes to, who signs off RED items.

### Step 2: Capture playbook positions (full mode) — in plain prose, never YAML the user edits

For each review skill the user wants configured, capture positions as plain-English statements (e.g. *"we accept mutual NDAs with a 3-year term; one-way inbound needs counsel review"*). The user should see a document about their practice, not a config file. Write `[DEFAULT]` where they skip, and say which defaults a review will otherwise flag.

### Step 3: Optional seed-doc delta

If the user points at 5–20 signed agreements, read them and compute the delta between stated positions (Step 2) and what was actually signed. Surface the gap — *"you said 3-year NDAs but 6 of 8 signed at 5"* — and let the user reconcile. The interview tells you what they think their playbook is; the docs tell you what it is.

### Step 4: Write the profile + confirm

Write the profile to the package config location (`.agent-settings.yml` legal section + the `agent-config setup` wizard surface — **adapt into existing config, do not clone a per-plugin CLAUDE.md**). Confirm back the jurisdiction, role, and which fields are `[DEFAULT]`/`[PENDING]`. Every downstream skill reads from here and halts on any unresolved `[configure]` before substantive work.

## Related Skills

**WHEN to use this**

- Setting up or re-tuning the legal pack's positions, jurisdiction, role, or escalation.

**WHEN NOT to use this**

- Performing a review → route to [`contract-review`](../contract-review/SKILL.md), [`nda-triage`](../nda-triage/SKILL.md), [`dpa-review`](../dpa-review/SKILL.md).
- Triaging a question → [`legal-intake-triage`](../legal-intake-triage/SKILL.md).
- Per-matter state — out of scope (no matter-workspace; deliberately rejected).

## When the agent should load this

- "Set up the legal pack."
- "Update our legal playbook / escalation owner."
- "Richte das Legal-Pack ein."
- "Wer ist unser Eskalations-Owner für Verträge?"

## Output

1. **Legal practice profile** *(plain prose)* — jurisdiction (within EU/DE), role, escalation owner + reviewer, per-skill playbook positions, with `[DEFAULT]` / `[PENDING]` markers, written to the package config location.
2. **`profile-summary.md`** — what was captured, what stayed default, the seed-doc delta (if run), and which review skills are now configured vs still on `[configure]`.

## Gotcha

- A non-lawyer filling the profile cannot define what RED is — so the profile never lets a non-lawyer self-clear; the attorney gate holds regardless of captured positions.
- Quick mode writes `[DEFAULT]`s, not silence — a review against an unconfigured position must flag `[configure]`, never guess.
- Out-of-scope jurisdiction at Step 1 is a hard refusal, not a "best-effort" — adding a jurisdiction is a currency promise the owner must accept.
- Seed-doc delta is the truth source; the interview is the stated intent. When they disagree, surface it — do not silently trust either.

## Do NOT

- Do NOT emit a YAML config the user must hand-edit — the profile is a plain-prose document.
- Do NOT infer the role; ask. The role arms every downstream attorney gate.
- Do NOT let a review proceed on `[configure]` / `[PENDING]` positions — halt and route back here.

## Runnable example

EU SaaS, processor-side, non-lawyer legal-ops user.

- Step 0 — quick mode.
- Step 1 — `Jurisdiction: DE`; role = non-lawyer-with-access (arms the attorney gate everywhere); escalation owner = external counsel contact.
- Step 2/3 — skipped (quick); NDA + DPA positions left `[DEFAULT]`.
- Step 4 — profile written; `dpa-review` now runs but flags `[configure]` on sub-processor notice window + audit frequency, and any GREEN routes into the attorney gate because the role is non-lawyer.
