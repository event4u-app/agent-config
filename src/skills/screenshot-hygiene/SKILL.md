---
model_tier: high
name: screenshot-hygiene
description: "Use when creating and embedding a documentation screenshot — detect and redact sensitive data, human-gate data-bearing shots before ship. Triggers 'screenshot for docs', 'screenshot admin panel'."
domain: process
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# screenshot-hygiene

The executable workflow behind [`doc-screenshot-hygiene`](../../rules/doc-screenshot-hygiene.md).
A screenshot embedded into shipped docs is an **irreversible published egress** —
once committed and hosted, any PII, secret, or revealing local path on it is out.
This skill makes agents create doc screenshots that are as neutral as possible,
with a conservative, err-on-the-side-of-redaction posture.

## When to use

- Generating or updating documentation (a docs site, feature docs, a README)
  where a screenshot genuinely helps and you are about to capture + embed one.
- A screenshot is about to land under `docs/media/` (or a docs image folder).

Do NOT use for:
- Image **generation** (route to `image-generation` / `image-editing` /
  `media-governance-routing` for likeness/rights).
- A user-supplied screenshot used only as a **design spec** to compare against
  (route to `design-fidelity` / `cross-source-consistency`).
- Terminal / CLI / IDE output — that is **forbidden** as a screenshot (see the
  workflow). Use a text code block with text redaction instead.

## Procedure

### 1. Decide — screenshot, or a safer alternative?

Classify the risk tier first (symmetric friction):

| Tier | Examples | Path |
|---|---|---|
| Illustrative / no data | architecture diagram, logo, icon, wireframe, placeholder-only UI | Embed with a one-line justification. |
| Data-bearing | dashboard, admin panel, form/list with content, any real-looking data | Full workflow + **human gate** before embed. |
| Terminal / CLI / IDE | shell output, editor, path bars | **Forbidden.** Use a text code block; redact the text. |

Prefer a diagram or a placeholder-data screenshot over a real-data one whenever
it conveys the same thing. Terminal output → copy the text into a fenced block
and redact the text (cheaper and safer than a pixel screenshot). Respect
`screenshots.forbid_terminal_capture` (default `true`).

### 2. Capture — via the host, never a bundled engine

Use the host's capability (`claude-in-chrome` for web UI, Playwright's
`page.screenshot` inside a test harness). Record which tool captured it. The
package ships no capture engine (no-runtime-floor). Capture into a working file
under the scratchpad or `docs/media/` — do not embed yet.

### 3. Detect — flag candidate sensitive regions (a helper, not a clearance)

OCR the image (host OCR, or the `image-analyser` skill's text read) and scan the
extracted text against the taxonomy below and `screenshots.identity_allowlist`.
Produce a **flagged-regions report**: for each hit, the text, the bounding box,
and the reason. Detection **reduces** the human's work — it never certifies the
screenshot as safe (it cannot see semantic leaks: aggregate counts that reveal
real users, real-vs-fake data tells, re-identification via name structure).

**Anonymization taxonomy** — always redact / refuse:
- Real person's name, postal address, birthdate, phone number.
- Passwords, API tokens, secrets, session cookies, bearer tokens, private keys.
- Real email addresses (anything not `@example.{com,org,net}` / a fake-data domain).
- Absolute local paths revealing a real identity (`/Users/<realname>/…`,
  `/home/<realname>/…`).
- Client / customer / project identifiers; internal hostnames (`*.internal`).
- Anything GDPR-sensitive; aggregate counts / data tells that reveal real users.

Allowed (no redaction): well-known fake data (Max Mustermann, Musterstraße,
`@example.com`); the maintainer's OWN public handle shown as a username, and a
path rooted at that handle (`/Users/<handle>/…`). The maintainer's **real name
is never allowed**, even co-located with the handle. The safe set lives in
`screenshots.identity_allowlist` (default empty → every identity is human-decided).

### 4. Redact — deterministic opaque cover, never lossy inpaint

Draw an **opaque box (or heavy blur/pixelation)** over each flagged region.
Deterministic, visible, and non-reversible — never AI inpaint (lossy;
reconstructs, may hallucinate; docs need visual accuracy). Redaction is
tool-agnostic — use whatever image tool is present in the environment:

- **ImageMagick** (if `magick`/`convert` present): draw a filled rectangle over
  each region, e.g.
  `magick in.png -fill black -draw "rectangle X1,Y1 X2,Y2" out.png` (repeat
  `-draw` per region), or `-region … -blur 0x18` for a blur.
- **sharp** (if a project already depends on it, e.g. the `/site` workspace):
  `composite` an opaque rectangle over each region.

If **no image tool is available** → `missing-tool-handling`: STOP, surface the
flagged regions, and hand off to the maintainer to redact manually. **Never ship
an unredacted screenshot because a tool was missing.** Never silently downgrade
the guarantee.

### 5. Pre-embed audit — the human gate (data-bearing tier)

For a data-bearing screenshot, embedding is a published egress → **this-turn
human confirmation** per [`non-destructive-by-default`](../../rules/non-destructive-by-default.md).
Present the redacted candidate + the checklist; wait for the answer.

**Pre-embed audit checklist:**
- [ ] No real names, addresses, birthdates, phone numbers.
- [ ] No passwords, API tokens, secrets, cookies, bearer tokens, private keys.
- [ ] No real email addresses (fake-data / `@example.com` only).
- [ ] No identity-revealing absolute paths (only a public-handle-rooted path).
- [ ] No client / customer / project identifiers; no internal hostnames.
- [ ] No terminal / CLI / IDE output.
- [ ] No aggregate-count / data tell revealing real users (semantic leak).
- [ ] Any realistic-looking data is justified as safe (known-fake / allowlist).

Unresolved / uncertain on any line → **redact or refuse**, never ship-and-hope.
An illustrative / no-data screenshot skips the confirmation but still passes the
checklist and carries a one-line "no sensitive data" justification.

### 6. Embed — into the docs surface

Place the reviewed, redacted file under `docs/media/` (or the docs image folder)
and reference it from a canonical `docs/*.md`. For the Starlight site,
`site/sync-docs.mjs` auto-copies `docs/media/*` into `site/public/media/` and
rewrites `](media/…)` links — so the embed flows to the site on build. Add
descriptive alt text. Generalize the same discipline to a README or any other
docs surface.

## Output

- **A redacted screenshot file** under the docs image folder with every
  taxonomy item covered by an opaque box/blur (or an explicit
  no-sensitive-data justification for the illustrative tier).
- **A one-line provenance + review note** stating: capture tool, risk tier,
  what was redacted (or "none — illustrative"), and — for data-bearing shots —
  that human confirmation was obtained this turn.

## Gotcha

- **Detection "passing" is not safety.** OCR + patterns miss semantic leaks
  (aggregate counts, real-vs-fake tells, name-structure re-identification) and
  misread garbled text. Never treat a clean automated scan as clearance — the
  human gate stands for data-bearing shots.
- **A public handle does not whitelist a co-located real name.** `matze4u` is
  fine; "Matthias Müller" next to it is still redacted.
- **Missing tool ≠ ship anyway.** No image tool → hand off, never embed
  unredacted.
- **Terminal screenshots feel harmless and are the worst.** A single shell line
  can leak an absolute path with a real name plus a live token. Use text.

## Do NOT

- Do NOT ship a screenshot with unredacted sensitive data — that is an
  irreversible published egress.
- Do NOT treat a clean automated scan as clearance; the gate for a data-bearing
  shot is human confirmation.
- Do NOT embed unredacted "because no image tool was available" — hand off instead.
- Do NOT screenshot terminal / CLI / IDE output — use a text code block with text
  redaction.
- Do NOT use lossy AI inpaint to redact — use a deterministic opaque box/blur.
- Do NOT assume a public handle whitelists a co-located real name — redact the name.

## See also

- [`doc-screenshot-hygiene`](../../rules/doc-screenshot-hygiene.md) — the rule that routes here (Iron Law + taxonomy + risk tiers).
- [`non-destructive-by-default`](../../rules/non-destructive-by-default.md) — the published-egress gate the data-bearing embed routes into.
- [`domain-safety-pii`](../../rules/domain-safety-pii.md) — the text-surface sibling (drafts / logs / exports).
- [`image-analyser`](../image-analyser/SKILL.md) — OCR-reads text in an image (the detection helper).
- [`image-editing`](../image-editing/SKILL.md) — region editing (only for deterministic redaction, never lossy inpaint here).
- [`readme-writing`](../readme-writing/SKILL.md) — flags unrequested data-bearing screenshots.
