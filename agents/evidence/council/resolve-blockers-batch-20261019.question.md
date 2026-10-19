<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-19, committed verbatim so the
verdict in resolve-blockers-batch-20261019.md can be checked against what was asked. -->

# Blocker batch — seven open roadmap blockers, 2026-10-19

You are reviewing seven open blockers in the roadmaps of `event4u/agent-config`,
a governed skill / rule / command suite for AI coding tools (no app runtime).
Each section gives the blocker's fields, the evidence measured today, and the
candidate options. For every section, answer the three questions at the end of
this preamble, in order.

## The owner-reserved test

An option is **owner-reserved** if choosing it would:

1. change the project's purpose or a declared non-negotiable outcome;
2. **lower** or remove a recorded security / privacy / safety / data-handling floor;
3. be irreversible or materially destructive;
4. spend, or carry liability, above a delegated threshold
   (`cost.budgets` resolves to zero on every settings layer today — no spend is delegated);
5. create, remove or weaken a legal, contractual, licensing, compatibility or public commitment;
6. amend governance itself (reopening authority, quorum, escalation, the owner-reserved set).

Strengthening a floor, or anything reversible inside these bounds, is
council-decidable. Options within one section can differ: one may be reserved
while another is not. A blocker's `Owner:` / `Ownership:` field is its author's
guess, not a finding — apply the test yourself.

## For each section, answer

1. **Owner-reserved?** — yes / no **per option**, naming the clause number.
2. **Choice** — the option you take if a council-decidable option exists that you
   would choose; otherwise the option you would recommend to the owner.
3. **The fact that would change your answer.**

Keep each section's answer under 200 words.

---

## B1 — `native-deny-is-a-host-setting-write` (road-to-one-detector-and-the-senders-we-own)

- **Blocks:** step 1.2 and the installer half of AC-4.
- **Context:** `docs/mcp-server.md` publishes that the package writes no host
  setting, with one owner-decided exception (2026-10-14: `skillOverrides` on a
  global Claude Code install, removed exactly by `uninstall`). A `pre_tool_use`
  guard (step 1.1, landed) already refuses credential-file reads on the one host
  that honours a hook deny.
- **Options:**
  1. a global Claude Code install appends `Read(…)` rows for the credential-file
     classes to `permissions.deny` in `~/.claude/settings.json`, records what it
     wrote in a sidecar, `uninstall` removes exactly those rows; the published
     doc gains a second exception;
  2. `hooks:doctor` reports the tier in force and prints the rows for the user to
     paste; nothing is written;
  3. neither — prevention stays the 1.1 guard alone.

## B2 — `d1-reopen-helper-level-quote-strip` (road-to-gates-that-read-what-was-written)

- **Blocks:** step 1.1's helper-level half and AC-1 only.
- **Question:** does `normalizeParent` (in `src/scripts/lint_consolidation_lineage.ts`)
  strip quotes itself — reopening decision D1 — or is AC-1's wording amended to
  the caller-side behaviour that shipped?
- **D1 as recorded:** "Match the sibling branch rather than rewrite
  `normalizeParent`. `:168` already does the right thing on the same input shape;
  changing the shared helper would touch 4 call sites that are correct today."
  Revisit-if: "a sixth call site arrives with a different input shape".
- **Prior round, 2026-10-16:** 1:1 split. One seat: strip inside the helper and
  remove the caller strip. Other seat: centralising preferable on the merits,
  but held D1 as binding and recommended amending AC-1.
- **Evidence measured today (new since that round):** `normalizeParent` has
  **6** call sites, not 4. Three of them strip quotes at the caller with the
  same `.replace(/["']/g, '')` (the inline frontmatter list at `:177`, the block
  list at `:186` added by step 1.2, and the `relates:` value parser at `:232`).
  The other three (`:283`, `:303`, `:316`) pass a backtick-extracted token. AC-1
  asserts `normalizeParent('"road-to-x" — note')` returns `road-to-x`; today it
  does not, because the helper does not strip. All lineage tests are green.
- **Options:**
  (a) reopen D1: move the strip into `normalizeParent`, remove the three caller
      strips, regression-test all six call sites;
  (b) keep D1: amend AC-1 to assert the caller-side behaviour that shipped.

## B3 — `impact-numbering-model`, option (a) only (road-to-a-release-that-says-whether-it-needs-you)

- **Already decided** by council 2026-10-16 (2/2): (b) — a `Consumer-Impact`
  commit trailer recorded as experimental, non-normative metadata, bump rule
  untouched — is decided; (c) is declined. (a) was routed to the owner by both
  seats as clause 5 (version numbers govern consumer dependency resolution).
- **Open:** (a) — bind the release bump to the trailer, so a release whose rows
  carry no consumer action ships as a minor instead of a major.
- **New evidence since that round:** step 2.2 replayed 10.0.0 → 16.0.0: under
  (a) 12.0.0 and 15.0.0 stay major, the other five become minor (five of seven
  majors would have been minors). Accuracy on that window 7/7 with zero false
  negatives on `action`, but the window is the same seven rows the rule was
  written against. The surface half of the rule is not scored.
- **Options:** (a) adopt the trailer-driven bump rule; (a-later) keep (a) open
  until a window not used to write the rule has been scored; (a-no) decline (a).
- Answer question 1 as a **reopening** of the 2026-10-16 routing: does the
  replay change whether (a) is owner-reserved?

## B4 — `upstream-body-and-mechanism-key` (road-to-one-upstream-that-checks-what-leaves)

- **Blocks:** steps 3.1, 3.2 and AC-3. Record fields, whole-payload privacy
  floor, draft flag, noreply identity, digest-bound approval and consumer issue
  route are landed.
- **Question:** which bytes may leave the machine in the self-repair upstream
  body (an issue/PR sent to the package's public repository after the user
  approves it), and may the cross-installation fingerprint key change shape?
- **Context:** a prior council round said the current evidence-bearing body
  "may not stand indefinitely". The fingerprint is used to deduplicate reports
  across installations.
- **Options:**
  (a) body from `target`, `defect_class` and `principle` only; fingerprint stays
      on the evidence hash until a corpus shows one subject per mechanism;
  (b) keep today's evidence-bearing body for records without `principle`,
      switch to (a) once a producer sets the field, by a named release or date;
  (c) also send `mechanism` and `falsifier` (both free text) upstream, and adopt
      a versioned `defect_class | target | principle` fingerprint key in the same change.

## B5 — `phase-6-spend-ceiling` (road-to-steps-the-skill-cannot-skip)

- **Blocks:** 6.2, 6.5, AC-7. Pre-registration, candidate pool, scorer and arm
  builder exist; no run has started. Live meter: `cost.budgets` unset on every
  layer, default zero.
- **Options:** (a) authorise the calibration slice, $921.60 list (96 runs);
  (b) authorise the whole programme, $2,649.60 (276 runs); (c) decline the
  measurement — the cursor stays opt-in and undocumented, and 6.2, 6.5, AC-7
  close as cancelled.

## B6 — `user-negative-lexicon-schema` (road-to-a-brand-the-tree-can-check)

- **Blocks:** step 5.5 only.
- **Context:** `.agent-user.md` is a file consumers write; its schema is read by
  the package. The voice-lexicon checker is already typed for a `user` source
  (`SEVERITY_BY_SOURCE.user = 'warning'`). The spike for this step returned
  "schema field only, validator YAGNI"; the step's own condition ("only if 5.0
  says build") did not fire.
- **Options:**
  (a) add an optional `style.avoid` array (`{ pattern 1-64 chars, match: word|substring, note? }`,
      max 32, no regex, default `[]`) to the schema, wire the checker's `user`
      branch, add the field to the `/agents:user` templates;
  (b) (a) plus replace the single `voice_sample` with `voice_samples: string[]`
      (a rename, with a v1-accepting reader), reopening a 100-line cap contract;
  (c) cancel 5.5 (`[-]`), because its condition did not fire.

## B7 — `slot-read-rate-measurement-spend` (road-to-a-brand-the-tree-can-check)

- **Blocks:** 6.3, 6.4, AC-7, AC-9. Inputs frozen and pre-registered
  (30 reader prompts, 10 unrelated; bar ≥ 95 % reader reads, 0 unrelated reads).
- **Context:** the protocol is 40 fresh paid `claude -p` host sessions in a
  scratch consumer project under a clean HOME. 6.3 only decides whether to
  build a runtime carrier; a non-goal and a risk-register row already bias that
  to "no carrier", and a standing guard keeps the zero-brand-bytes floor green
  either way.
- **Options:** (a) authorise and run the 40 sessions; (b) a cheaper reading the
  operator names, re-pre-registered before it runs; (c) record an honest null —
  "not measured, no carrier" — mark 6.3 and 6.4 cancelled, close AC-9 on the
  absence of a carrier, AC-7 rests on the standing guard.
