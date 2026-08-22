---
complexity: structural
status: draft
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Ships status: draft, so the estate charge waits for the owner's flip. Adds 0 skills and 0 rules; every phase edits existing scripts, manifests and two contracts. Its subject — whether the ai-video pipeline can continue a shot across a seam, and whether the adapters' stable-tier claims are reviewer-verifiable from the public tree — is covered by no active roadmap (checked against the top-level roadmap set on 2026-08-22)."
estate_growth_exempt: "Files exactly one open blocker (trace-visibility-decision), which is +1 open_blockers the moment the owner flips this file to ready. The blocker is not incidental bookkeeping: Phase 0's first branch would reverse a recorded decision (d7f5d5d3c, smoke-traces made deliberately local-only), so the reversal is owner-reserved rather than agent-executable, and the reason belongs next to it. Nothing was archived to pay for it, because there is nothing to archive: the decision this blocker holds did not exist as estate before this file recorded it."
---
# Road to chained-clip continuity and provider truth

> **Source anonymisation (`source-confidentiality`).** External harvest sources
> are referenced as `Source A`…`Source E` rather than by org, repo, or author
> name: this tree must not record which third-party packages seeded an idea. The
> real identifiers and their pinned revisions are in `## Provenance` as `ENC1:`
> tokens, and in full in the consumed inbox copy under `agents/tmp.old/`, which
> is gitignored and therefore maintainer-reachable only — the licences are
> recorded there, not here, because nothing in this roadmap borrows source code
> from any of them. Provider and tool names used as *integration targets* (kling,
> fal, sora, gemini-veo, higgsfield, replicate, syncso, comfyui, ffmpeg) are
> unaffected: naming a tool this package drives is not derivation-attribution.

> **Source:** the harvest note of an inbox bundle dropped on 2026-08-22, now in
> the gitignored `agents/tmp.old/` archive. Its exact path is
> `ENC1:NgLuS2TsKFfTMquCWiotCstSx1LRuo5uOQTKUhaqqlbH7zuJlj2dceHNTYDHx9cU+15GBb26H3ckGP6G1VFnB3ALaLG50vjXFxbUyS6YdlhSPvodiSU28bTranG/NJC712AmDHAbsXY8vtDIf0L4s0V3HXaA1nmttP8JnfBc`
> — decrypt with `./scripts-run src/scripts/_lib/link_crypto decrypt --value <token>`.
> The path is a token rather than plain text because the bundle's directory
> segment is itself one of the harvested repositories' names, so writing it out
> would record in the tracked tree exactly what the block above says this tree
> must not record. This is not a weaker pointer: it resolves to the full path for
> anyone holding the key, which is the recoverability the plain form was for.
> Landed by `/analyze:inbox` on 2026-08-22. Every defect below was re-derived
> against the destination tree during that run; five of the source roadmap's
> claims did not survive reproduction and are tagged `corrected-from-reproduction`
> where the correction changed a phase. The iteration log (three self-critique
> passes, six rejected branches) is in the same inbox directory.

> **This is a proposal.** Nothing in it is adopted, and nothing in it may be
> cited elsewhere as a foundation until the phase that would establish it has its
> `verify:` line green. Cost figures marked *(est.)* are estimates, not
> measurements; Phase 2 is what replaces them.

## Goal

A maintainer can (a) state **from the public tree**, for every shipped video
adapter, whether its `stable` claim rests on a smoke trace a reviewer can see and
date — today the traces exist and no reviewer can reach them; (b) ask the
pipeline whether a given model can *continue a shot* (accept a start frame;
accept a start **and** end frame) and get an answer that was **probed**, not
assumed; and (c) render an N-scene script as one continuous take where every
seam hands off the previous clip's actual last frame — with the existing hard-cut
stitch unchanged as the default, and the seam-score question settled by a
pre-registered test rather than by adopting any source's threshold.

"Seamless" is a *consequence* this roadmap measures, not a promise it makes: one
source's own calibration shows a verified-good seam can score 18–25 dB PSNR, so
the honest target is *a machine score whose agreement with blind human judgement
is known*, with the pre-registered possibility that no threshold separates good
seams from bad — in which case Phase 4 records the null and Phases 0–3 stand on
their own defects.

## Context — the five defects, as reproduction left them

Re-derived against the destination tree on 2026-08-22.

- **D1 — continuity is unrepresentable.** *Confirmed in full; this is the spine.*
  `src/scripts/ai-video/stitch.sh:14,29-38,72-76` is `ffmpeg -f concat -c copy`
  (output at `:175-176`); `--crossfade` is parsed and refused with exit 2 because
  stream copy precludes a filtergraph and no re-encode path exists.
  `src/scripts/media/lib/adapter-contract.md:105,119` has `ref_images`
  (start-only) and no end-frame field.
  `grep -rn -iE 'end_image|last_frame' src/scripts/ai-video/` returns 0.
  The strongest single fact in the bundle is the refusal message itself: it ends
  with *"or open a roadmap item for the re-encode path."* **Step 3.4 is that
  invited item** — the script asked for this roadmap by name.
- **D2 — the frame axis is under-claimed, not absent.**
  `corrected-from-reproduction`: the source called this a missing capability
  axis. Half of it already exists —
  `src/scripts/ai-video/lib/model-capabilities/README.md:65` already carries a
  `ref_images[0] → image / start_image` mapping row, and
  `src/scripts/ai-video/adapters/higgsfield.sh:133-135` hard-requires
  `ref_images[0]` and dies with exit 7 without it. What is missing is the
  *schema*: `README.md:17-34` (v1) has no start/end-frame field, so the mapping
  row and the hard requirement cannot be expressed as a per-model capability.
  Phase 1.1 is therefore a **schema catch-up**, not a new axis. Manifests still
  exist for multiplexers only (`README.md:3-4`), and `fal.json` lists
  text-to-video models only (lines **6–75** of 76 — the source said 6–63).
- **D3 — the tier claims are not reviewer-verifiable from the public tree.**
  `corrected-from-reproduction`, and the reframe matters because the original
  charge was materially wrong. The source said the required evidence is *absent
  from the tree and from history*. It is not:
  `git log --all -- agents/reference/ai-video/smoke-traces` returns **four**
  commits, including `4bde0297c` (a tracked smoke-trace harness) and
  `d7f5d5d3c` ("smoke-traces fully local-only" — a deliberate, named decision).
  The directory holds **58 entries** on the maintainer's disk, and the trace ids
  inside `fal.json:32,47,74` match those files verbatim; `git ls-files` over the
  path returns **0**. So the evidence exists, was captured, and was deliberately
  withheld. The defect is that **no reviewer can check the claim** — not that the
  claim is unsubstantiated. The contract-contradiction limb softens the same way:
  `docs/contracts/provider-lifecycle.md:112` self-scopes §5 to "the tiers on the
  day this contract lands" and `:123-124` explicitly defers promotion to the
  commit that records a trace, so §5 is a **stale snapshot, not a
  self-contradiction**; and `src/scripts/ai-video/adapters/kling.sh:12-13`
  already self-discloses the gap ("Raw trace is local-only operator evidence …
  gitignored"). What survives unchanged is the step that regenerates the table —
  a stale snapshot in a contract is still a defect a reader trips over.
- **D4 — the feedback loop is missing; the read-back is not.**
  `corrected-from-reproduction`, and this deleted a step. The source claimed no
  script records what a live call billed. It does:
  `src/scripts/ai-video/lib/resume-scan.sh:152-153,161,181` reads
  `scenes/<id>/cost.json .charged_usd` and sums it as `spent_usd`, and
  `src/domains/ai-video/video/from-song/command.md:370-371` writes that file
  after each live scene and re-checks the sum before every live submit. The
  source's own grep returns 1 hit, not 0. The surviving gap is narrow and is real:
  `charged_usd` never feeds back into `manifest.cost_per_second_usd`, and there
  is **no calibration probe at all** (`grep -ril calibrat` over
  `src/scripts/ai-video src/domains/ai-video` returns 0). So the model never
  corrects itself from money it already spent.
- **D5 — no machine-checked continuity QA.** Substantively confirmed:
  `grep -rn -iE 'ssim|psnr'` over `src/scripts/ai-video`,
  `src/domains/ai-video` and `src/skills/motion-choreographer` returns **0**.
  `corrected-from-reproduction` on two details: the tree-wide grep hits **5**
  files, not 3 (`src/scripts/skill_linter.ts` and
  `tests/design-artifacts/fixtures/design.html` were missed), and 4 of the 5 are
  substring noise. The fifth is not: `tests/design-artifacts/fixtures/design.html:15`
  reasons about SSIM explicitly — *"A hotlinked face would make an SSIM score a
  function of"* — which makes it the **nearest in-tree precedent for treating a
  similarity score as a measurement with a validity condition**, nearer than any
  external source. Phase 4 cites it rather than a fork.

Two further observations (decay markers on vendor-bound claims;
re-implementation fidelity loss) are carried as single steps inside Phases 0 and
3 rather than as phases; four others are routed to existing roadmaps or the
owner and add no estate here.

## Not-new — this is the second arrival of D1, D2 and D5

`recurring-criticism` fires here, and the resolution is **"right, never
recorded"**: nobody made a decision against this work, so the record failed, not
the judgement.

- **The first arrival.** `agents/tmp.old/better-video.txt` (2026-08-05, 52 KB,
  German, an unrelated source) already proposed, in its Phases 5 and 6: a
  seam-score over adjacent clip pairs built from an inverted luma delta plus a
  palette delta plus an audio-level delta at the seam; `stitch.sh` v2 lifting
  `--crossfade` onto ffmpeg `xfade` with per-seam transition types and the
  clip-length-minus-transition offset arithmetic named as the classic trap; and
  last-frame-to-first-frame conditioning as an adapter-level capability. That is
  D5, D1 and D2 — **eighteen days earlier**. It even pre-registered an exit gate
  (a benchmark floor, park the metric if missed, ship the agent-visual path as
  the honest-null reduction), which is the same discipline Phase 4 uses here,
  reached independently.
- **Its disposition covered something else.**
  `agents/roadmaps/archive/road-to-inbox-harvest-2026-08.md:437` is
  `- [-] P5.7 CANCELLED`, and `:449` scopes that cancellation explicitly to
  "`better-video.txt` Phases 2–3", on the ground that they re-propose shipped
  code (word-level transcription, a yt-dlp wrapper). Phase 2 is URL ingestion and
  Phase 3 is transcription. The file has **seven** phases (0–6). **Phases 4, 5
  and 6 — the clip-verify loop, the seam-score plus stitch v2, and
  continuity-conditioning — were never dispositioned at all.**
  `road-to-video-perception.md` was never created, and
  `grep -rilE 'seam.score|end_image|last_frame|frame.lock'` across `src`, `docs`
  and `agents/roadmaps` returns **0**.
- **The assumption that broke.** That a file consumed into `agents/tmp.old/` has
  been fully dispositioned. The cancellation covered **two of seven** phases and
  said so in its own text; the sweep that read it treated a scoped cancellation
  as a whole-file one. The fix is not "decide harder next time" — it is that a
  partial disposition must name the phases it does **not** cover.
- **What resolves it is not the repetition.** Two independent sources proposing
  the same thing is a reason to look, never a verdict
  (`recurring-criticism`: resolve on evidence, never on the count). The evidence
  is `stitch.sh:76` — the script that refuses the crossfade invites this exact
  roadmap item in its own error message. That would carry the case at an arrival
  count of one.

## Boundary — what this roadmap does not own

The same inbox bundle carried a second, 958-line proposal for a scroll-driven
storytelling runtime (it stays in the gitignored inbox copy; naming it here would
re-introduce the source family token). **It is not landing as a roadmap.** Its
Phase 8 duplicates this file's entire scope, and its renderer phases would make
this package ship a web runtime, which `CLAUDE.md:3` refuses ("No app runtime").
Its surviving items merge into
`agents/roadmaps/road-to-frontend-fidelity-calibration.md`.

So the split is: **this roadmap owns the seam and provider axis and nothing on
the page-rendering axis.** Any step here that would emit HTML, JS, or a scroll
handler is out of scope by construction; Phase 3 ends at an `.mp4`.

## Refusals — kept from the source, unchanged

These are constraints on every phase below, not aspirations:

1. `concat -c copy` stays the default. `--mode cut` behaves as it does today.
2. `handoff` is opt-in and preview-visible: the operator sees which boundaries
   hand off, the generation count, and that the chain runs sequentially.
3. An adapter that cannot honour `end_image` **refuses by name** — it never drops
   the image silently. One source documents a provider that dropped the image and
   billed a different price cell.
4. `null` never means `true`. Unknown capability is not usable capability.
5. No paid provider call without an estimate and an explicit approval, under the
   existing `--max-spend-usd` gate.

## Phase 0 — Make the tier claims checkable before touching capability

Nothing downstream may say "verified" while the word is already used in a way no
reviewer can check.

- [ ] **0.1 Publish a tracked trace index.** `corrected-from-reproduction` — this
      step exists because D3's real defect is reviewer-reachability, and an index
      fixes that without exposing a single raw trace.
      `smoke-trace.sh index` emits `agents/evidence/ai-video/trace-index.json`
      (tracked): one row per local trace with `provider`, `trace_id`,
      `captured_at`, `model`, and a SHA-256 of the raw file — no request bodies,
      no URLs, no cost figures, nothing redaction-sensitive. A reviewer can then
      confirm that the trace `fal.json:32` names exists and when it was captured,
      which is exactly the claim the header makes.
      verify: `git ls-files agents/evidence/ai-video/trace-index.json` returns the path; every `smoke_trace` id in `src/scripts/ai-video/lib/model-capabilities/*.json` resolves to a row in it; `jq` finds no key outside the five-field allowlist.
- [ ] **0.2 Act on the trace-home decision.** <!-- blocked-by: trace-visibility-decision -->
      Execute whichever branch the blocker resolves to: un-ignore a tracked,
      redacted trace path, or leave the raw traces local-only and let 0.1's index
      plus 0.3's lint carry the claim. The branch chosen is recorded in this file
      with the date.
      verify: either `.gitignore` no longer matches the chosen trace path and `git ls-files` lists ≥ 1 trace under it, or this file records the local-only branch with its date and `git ls-files agents/reference/ai-video/smoke-traces` still returns 0.
- [ ] **0.3 Lint the claim against the reachable evidence.**
      `src/scripts/lint_adapter_tier.ts`: for each
      `src/scripts/ai-video/adapters/*.sh` and `src/scripts/ai-image/adapters/*.sh`,
      parse the `# Lifecycle:` header; `stable` requires a row in 0.1's index
      whose `provider` matches and whose `captured_at` is ≤ 180 days old;
      otherwise FAIL with the adapter name and the missing id. Register it in the
      gate ledger and the pipeline's gate list.
      verify: the lint fails on a fixture tree with an empty index (7 adapters named) and passes against the real index; `tests/scripts/lint_adapter_tier.test.ts` pins both outcomes with fixture headers.
- [ ] **0.4 Refresh the contract's stale day-one table.**
      `corrected-from-reproduction`: `docs/contracts/provider-lifecycle.md:112`
      already self-scopes §5 to the landing day, so this is a staleness fix, not a
      contradiction fix. Replace `:110-125` with a table generated from 0.3's
      parser so the snapshot cannot drift again, and keep one sentence recording
      that the original table was scoped, not wrong.
      verify: `grep -c 'experimental' docs/contracts/provider-lifecycle.md` equals the number of adapter headers reading `experimental`; a `DO NOT EDIT BY HAND` marker sits above the table.
- [ ] **0.5 Name the ASSUMED fields.** `smoke-trace.sh assumed <adapter>` lists
      every `ASSUMED`-tagged field with its line; the trace template gains a
      mandatory `assumed_fields_confirmed:` list. A field stays ASSUMED until a
      trace confirms it. `corrected-from-reproduction`: the total is **21**, not
      18 — `syncso.sh` carries 3 and was missing from the source's adapter set.
      Per adapter: gemini-veo 5, fal 4, kling 3, sora 3, syncso 3, replicate 2,
      higgsfield 1.
      verify: `smoke-trace.sh assumed kling` prints 3 lines and the sum across all adapters is 21; after a trace that confirms them the adapter comment loses the tag and that adapter's count is 0.
- [ ] **0.6 Decay marker for vendor-bound claims.** Add `recheck_by: <date>` to
      the trace template and surface it in `capability` output (`… (verified
      2026-xx-xx, recheck by 2026-yy-yy)`); the adapter warns on stderr past the
      date. Same idiom as `keep-beta-until` in
      `docs/contracts/skill-bundled-assets.md:1-4`; no new frontmatter key on
      skills.
      verify: `capability` output of a traced adapter contains both dates; a fixture trace dated 200 days ago produces the stderr warning in a test.

**Exit criteria.** 0.3 is registered and green; every `stable` header resolves to
an index row; the contract table is generated. **Rollback.** Revert the lint
registration and the generated table; 0.1's index is additive and inert on its own.

## Phase 1 — Give the manifest schema the frame axis it already implies

- [ ] **1.1 Manifest schema v2 — a catch-up, not a new axis.**
      `corrected-from-reproduction`: the mapping row at
      `src/scripts/ai-video/lib/model-capabilities/README.md:65` and
      `higgsfield.sh:133-135`'s hard requirement already assert start-frame
      behaviour; the schema at `README.md:17-34` cannot express it. Add
      `start_frame: true|false|null`, `end_frame: true|false|null`,
      `frame_lock: {probed_at: <date>|null, psnr_frame0: <dB>|null}`. `null` means
      *unknown*, and unknown is never treated as `true`. Existing entries get
      `null`/`null`/`{null,null}` — including `higgsfield`, whose hard requirement
      is evidence about the *adapter path*, not a probed fact about each model.
      verify: `jq` over every manifest finds the three keys; a schema test rejects a manifest with `end_frame: true` and `start_frame: false`; the README's mapping-row section cross-references the new fields.
- [ ] **1.2 Per-model manifests for the direct adapters.** `higgsfield.json`,
      `kling.json`, `gemini-veo.json`, `sora.json` in the same schema, one entry
      per model the adapter already names, `verified: false` and frame fields
      `null` throughout. The `capability` subcommand of each direct adapter reads
      its manifest the way the multiplexers do.
      verify: `ls src/scripts/ai-video/lib/model-capabilities/` gains four files; `higgsfield.sh capability --model <id>` answers from the manifest; `README.md:3-4` no longer says "multiplexer adapter" only.
- [ ] **1.3 `end_image` in the stdin contract.**
      `src/scripts/media/lib/adapter-contract.md` gains an optional
      `end_image: "/abs/path.png"`. An adapter whose manifest says
      `end_frame: false|null` for the submitted model **refuses** (new exit code,
      message names the model and the field) — it never drops the image silently.
      This is the bundle's one hard rule, and refusal-over-silent-downgrade is
      already the house register: `stitch.sh:72-76` refuses the crossfade for the
      same reason.
      verify: the contract doc lists the field; `test-pipeline.sh` has a case where `end_image` plus an `end_frame:null` model exits non-zero with the model name in stderr.
- [ ] **1.4 Selection rule in `motion-choreographer`.** One paragraph under
      "Step 0: Inspect": when the blueprint asks for a continuous take or a
      connector, read `start_frame`/`end_frame` first; a model that cannot
      frame-lock is *declined with a one-line why, not substituted in*. No new
      skill; ≤ 120 tokens added.
      verify: `wc -c src/skills/motion-choreographer/SKILL.md` grows by ≤ 600 B; `task lint-skills` green; the paragraph cites `adapter-contract.md#end_image`.

**Exit criteria.** Every manifest answers the three frame keys; `end_image` is a
contract field with a refusal path under test. **Rollback.** Drop the schema keys
and the four manifests; `end_image` is optional, so removing it restores the v1
contract exactly.

## Phase 2 — Probe, don't assume: qualification and cost calibration

- [ ] **2.1 `smoke-trace.sh probe-frame-lock <adapter> <model>`.** One clip at the
      model's cheapest resolution and duration from a fixture still; extract
      frame 0 with ffmpeg; compute PSNR against the input still — a *frame-0
      identity* check against codec noise, which is a different question from
      seam quality, so the "not PSNR" caveat one source raises about seams does
      not apply here. Write `frame_lock.probed_at` and `psnr_frame0` to the
      manifest; set `start_frame: true` iff PSNR ≥ 30 dB, else `false` with the
      measured value kept. Re-run with a second still as `end_image` to set
      `end_frame`; the end check is *composition*, so the probe stores the end
      frame beside the target for a human and records no pass/fail number on that
      side.
      verify: running the probe on one live model updates its manifest entry with a date and a dB value; the unit test runs the PSNR step on two fixture PNGs and asserts the threshold branch both ways. Cost *(est.)*: one 480p 4-s clip per model ≈ USD 0.3–1.2 via a multiplexer; 8 models ≈ USD 10.
- [ ] **2.2 Calibration probe in `/video:from-script --mode commit`.**
      `corrected-from-reproduction`: the source's billed-cost read-back step is
      **deleted** — `resume-scan.sh:152-153,161,181` already reads
      `cost.json .charged_usd` and sums it as `spent_usd`, and
      `from-song/command.md:370-371` already writes it per live scene. What is
      genuinely absent is any calibration at all
      (`grep -ril calibrat` → 0). So: before the batch, render **one** still and
      **one** clip, read the existing `charged_usd`, print `modeled vs charged`
      and the extrapolated total, and re-confirm only if the charged figure
      exceeds the modeled one by > 25 %. Skippable with `--no-calibrate`; default
      on. It folds into the existing `lib/operator-pick.sh` moment rather than
      adding a gate.
      verify: `grep -c calibrat src/domains/ai-video/video/from-script/command.md` is non-zero; `test-pipeline.sh` dry-run prints the `modeled vs charged` line with `charged: null` and does not re-confirm.
- [ ] **2.3 Close the feedback loop the read-back never had.** Append each
      `(adapter, model, modeled, charged, date)` row to
      `agents/evidence/ai-video/cost-ledger.jsonl` (tracked) from the
      `charged_usd` values `resume-scan.sh` already sums;
      `manifest.cost_per_second_usd` may then be updated only by a script that
      cites the ledger rows it averaged. This is the whole of the surviving D4
      gap: money spent is recorded and never read back into the model.
      verify: the ledger exists with ≥ 1 row after 2.1; `lint_adapter_tier.ts` warns when a manifest cost changed without a ledger citation in the same diff; a fixture with `charged_usd: null` appends a row whose `charged` is `null`, never `0`.

**Exit criteria.** At least one model carries a probed `frame_lock`; the ledger
has rows; the calibration line prints in a dry run. **Rollback.** The probe and
the ledger are additive; `--no-calibrate` is the off switch and the default flips
back with one line.

## Phase 3 — A continuity path beside the hard cut

Default stays `concat -c copy`. Everything here is opt-in and preview-visible.

- [ ] **3.1 Seam handoff in the blueprint.**
      `src/scripts/ai-video/lib/parse-blueprint.sh` accepts
      `continuity: cut|handoff` per scene boundary (default `cut`). `handoff`
      means clip *i+1*'s `ref_images[0]` is the **extracted last frame of clip
      *i*'s rendered output** (`ffmpeg -sseof -0.15 … -frames:v 1`), not its own
      still. Preview prints the seam plan — which boundaries hand off, which cut —
      and the generation count.
      verify: `parse-blueprint.sh` rejects an unknown value; preview output for a 4-scene fixture with two `handoff` boundaries lists both and `gens: 4`.
- [ ] **3.2 Sequential execution for handoff chains.** `handoff` boundaries force
      sequential rendering of the two clips and a per-seam sentinel —
      `src/scripts/ai-video/lib/resume-scan.sh` already owns sentinels, so extend
      it rather than duplicating. A failed or re-rolled clip invalidates exactly
      the seams it touches.
      verify: `resume-scan.sh scan` on a fixture project with one re-rolled clip lists the two adjacent seams as stale and no others.
- [ ] **3.3 Optional connector clip.** When both adjacent models report
      `end_frame: true` and the boundary says `handoff: connector`, generate one
      extra clip with `ref_images[0]` = last frame of *i* and `end_image` = first
      frame of *i+1* (generation count becomes 2N−1; preview states it). No
      connector without a probed `end_frame` — `null` is not `true`.
      verify: a fixture with `end_frame: null` on one side refuses the connector with the model name in stderr; with `true` on both sides the preview generation count reads `2N-1`.
- [ ] **3.4 Re-encode stitch mode — the item `stitch.sh:76` asks for.**
      `stitch.sh --mode handoff`: a re-encode path (`libx264 -crf 20 -g 8
      +faststart -an`) with an optional `--xfade <s>` ≤ 0.25 applied **only** at
      `handoff` seams, as insurance. The `--crossfade` refusal stays for
      `--mode cut`, and the header's "open a roadmap item for the re-encode path"
      sentence is replaced by a pointer to this file — closing the loop the script
      opened.
      verify: `stitch.sh --mode cut --crossfade 0.2` still exits 2; `--mode handoff --xfade 0.2` on two fixture clips produces a file whose duration is `sum − 0.2 ± 0.05` s (ffprobe).
- [ ] **3.5 Port-invariants for bundled executables.** One section in
      `docs/contracts/skill-bundled-assets.md`: a skill that bundles an
      executable asset lists `port_invariants:` — the behaviours that must survive
      if a consumer re-implements it. Pilot on `stitch.sh` with three invariants:
      hard-cut default, refusal over silent downgrade, handoff frame = rendered
      frame. No new skill, no new rule. The motivating field evidence is Source D,
      a generated site that re-implemented a bundled engine and lost its
      hardening; it is cited by neutral descriptor with its `ENC1:` pin.
      verify: the contract section exists; `stitch.sh`'s header carries the three invariants; the section cites the field case by neutral descriptor and links its `## Provenance` row.

**Exit criteria.** `--mode cut` byte-identical to today; one fixture handoff chain
renders and stitches; the contract section exists. **Rollback.** `--mode handoff`
and `continuity: handoff` are opt-in values; removing them leaves the cut path
untouched.

## Phase 4 — The falsifier (pre-registered; decides whether a seam score is a gate)

Registered **before** Phase 3 renders anything, so the outcome cannot be steered.
The registration lands as an evidence note under `agents/evidence/analysis/` and
**never** as a CI gate — a score whose validity is unknown must not be able to
fail a build.

- [ ] **4.1 Register the question.** H1: *a machine seam score (SSIM or PSNR on
      the boundary frame pair of the encoded clips) separates human-judged "pop"
      seams from "clean" seams with ≥ 0.8 precision at some threshold.* H0: no
      threshold reaches 0.8 precision with ≥ 0.5 recall. Both arms, the metric
      definitions, the rater protocol and the sample size are written to
      `agents/evidence/analysis/seam-score-falsifier.md` *before* data exists.
      The note cites `tests/design-artifacts/fixtures/design.html:15` as the
      nearest in-tree precedent for treating a similarity score as a measurement
      with a stated validity condition — nearer than any external calibration.
      verify: the file exists with a `registered_at` date earlier than the first `handoff` render's sentinel timestamp.
- [ ] **4.2 Collect.** ≥ 24 seams from previz-tier (cheapest model) handoff
      renders, half deliberately wrong (connector endpoints set to source stills —
      the documented failure mode) and half per 3.1. Two raters, blind,
      "pop / clean". Scores computed by
      `smoke-trace.sh seam-score <a.mp4> <b.mp4>` (SSIM and PSNR both).
      Cost *(est.)*: 24 seams × previz ≈ USD 10–20.
      verify: a CSV with `seam_id, ssim, psnr, rater1, rater2` and N ≥ 24; inter-rater agreement reported in the registration note.
- [ ] **4.3 Decide and write the default.** If H1 holds for SSIM or PSNR: the
      winning score and threshold become a **warning** — never a hard gate — in
      `stitch.sh --mode handoff`, citing the CSV. If H0: record the null in the
      registration note, keep the eyeball-QA sentence in `motion-choreographer`,
      ship `seam-score` as a diagnostic only, and note that this replicates one
      source's own later finding against another's thresholds.
      verify: exactly one of the two outcomes is recorded with the three evidence paths (registration note, CSV, decision note), and `grep -rn 'seam-score' .github/workflows src/scripts/gate*` returns 0.

**Exit criteria.** Exactly one recorded outcome, registered before data.
**Rollback.** The whole phase is an evidence note plus a diagnostic subcommand;
nothing in the render path depends on it.

## Routed, not phased (no estate added here)

- **Plugin-manifest MCP wiring → `road-to-skill-delivery-over-mcp.md` Phase 1:**
  a dated line evaluating a plugin manifest's `mcpServers` key (observed in
  Source C) as an alternative to rendering `.mcp.json`; verify against host docs
  first, since the observation is of a third-party manifest, not of a documented
  host contract.
- **Compressed-index arm → same roadmap, Phase 4:** a third arm, *compressed
  index in the always-on file*, registered only after Source E's primary
  publication is fetched and pinned; its secondary-source numbers are **not** to
  be cited until then.
- **A third-party skills-registry install channel → owner.** Not a defect; a
  host-reach decision. The channels contract already chose filesystem-canonical.
- **One complementary sentence in `cheap-question-mechanics.md` → owner,** if
  "never fabricate a multiple-choice for an open subject" is not already implied
  by its Iron Law 1.

## Blockers

### blocker: trace-visibility-decision
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 0 — Make the tier claims checkable before touching capability
- **Question:** Should the raw adapter smoke traces become tracked evidence, reversing the recorded local-only decision, or stay local-only with 0.1's index carrying the reviewer-facing claim?
- **Class:** 2 — consent-once
- **Recommendation:** Stay local-only and ship 0.1's index. `d7f5d5d3c` ("smoke-traces fully local-only") is a deliberate, named decision, and the 58 local traces contain request/response bodies and signed URLs whose redaction is exactly the kind of one-pass scrub that fails silently; the index gives a reviewer the provider, id, capture date and a content hash, which is the whole of what the `stable` header actually claims.
- **If you do nothing:** 0.1 and 0.3 still land and the tier claims become checkable, so the roadmap is not stuck — but 0.2 stays open, and the recorded local-only decision stays unconfirmed rather than reaffirmed, which is how it got re-litigated in the first place.
- **What to do:**
  1. Read the recorded decision: `git show d7f5d5d3c --stat` and `git log --all --oneline -- agents/reference/ai-video/smoke-traces` (four commits; `4bde0297c` added the harness).
  2. **Reaffirm local-only (recommended):** say so, and 0.2 records the branch and its date in this file. No `.gitignore` edit. Cost: reviewers verify against the index, never the raw trace.
  3. **Reverse it:** say so, and 0.2 un-ignores `agents/evidence/ai-video/smoke-traces/` (a new tracked path, leaving `agents/reference/…` ignored) and `smoke-trace.sh` gains a redaction pass that strips secrets, signed URLs and bearer tokens before write. Cost: one redaction implementation plus a per-trace review of 58 existing files before any is tracked — and it reverses a named decision, which is why this is not the agent's call.
- **Resolved when:** this file records `local-only` or `tracked` with a date under 0.2, and 0.2's `verify:` line passes for that branch.

I can walk you through either branch step by step in the same reply — deciding it
does not mean executing it.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: analyze-inbox -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Phase 4 spends money and returns nothing usable | product | The seam score may simply not track human judgement; two external sources already disagree, and the honest outcome could be a null after ≈ USD 10–20 of renders. | The null is pre-registered as a valid close (4.3) and costs the roadmap nothing else — Phases 0–3 stand on their own defects and none of them reads a seam score. | Phase 4 — The falsifier |
| 2 | Reversing the local-only trace decision leaks operator evidence | implementation | Branch 3 of the blocker tracks 58 files containing request/response bodies and signed URLs; a single-pass redaction that misses one is an irreversible published egress. | The blocker recommends against it and 0.1's index makes the claim checkable without it; if reversed, redaction plus per-file review is named as the cost rather than assumed away. | `## Blockers` — trace-visibility-decision |
| 3 | The re-encode path degrades output quality the cut path preserved | implementation | `--mode handoff` re-encodes what `-c copy` passed through untouched, so every handoff render pays a generation loss the default never did. | The cut default is unchanged and byte-identical (3.4 verify), `handoff` is opt-in and preview-visible, and 3.5 pins hard-cut-default as a port invariant. | Phase 3 — A continuity path beside the hard cut |
| 4 | Sequential handoff chains make long scripts slow and costly | product | Handoff forces sequential rendering, so an N-scene chain loses all parallelism and a connector chain costs 2N−1 generations. | Preview states the seam plan, the generation count and the sequential trade before spend (3.1, 3.3); `cut` stays the default. | Phase 3 — A continuity path beside the hard cut |
| 5 | Vendor capability drifts inside the roadmap's own lifetime | implementation | One source documents endpoints gaining and losing frame conditioning within weeks, so a probed `start_frame: true` can be false by the time it is read. | `recheck_by` (0.6) plus `frame_lock.probed_at` (1.1) date every claim and warn past the date; no manifest value is treated as permanent. | Phase 0 — Make the tier claims checkable before touching capability |
| 6 | Scope creeps toward a page engine | product | The sibling inbox file's renderer phases are one merge away, and "just render the scroll page too" is the obvious next ask. | The boundary section refuses it structurally: any step emitting HTML or JS is out of scope, Phase 3 ends at an `.mp4`, and the sibling's survivors are routed to a different roadmap. | `## Boundary` |
| 7 | 0.3's lint fails a tier claim the maintainer considers live | implementation | A `stable` adapter whose trace is older than 180 days, or whose id is missing from the index, fails the build on evidence age rather than on behaviour. | 0.1 lands before 0.3, so the index exists first; the window is a constant in one file and the failure message names the adapter and the missing id rather than demoting anything silently. | Phase 0 — Make the tier claims checkable before touching capability |

## Acceptance Criteria

- [ ] AC-1 — Every adapter header reading `stable` resolves to a dated row a
      reviewer can see from a clone, and `lint_adapter_tier.ts` is registered so
      the reverse cannot land again.
- [ ] AC-2 — The contract's tier table is generated, and no reader can find a
      snapshot in it that disagrees with the adapters.
- [ ] AC-3 — Every manifest entry answers `start_frame` and `end_frame` with
      `true|false|null`, and every `true` carries a `probed_at` date.
- [ ] AC-4 — `end_image` is either honoured or refused by name — never dropped —
      and a test pins the refusal.
- [ ] AC-5 — `charged_usd` reaches `cost_per_second_usd` only through the ledger,
      and no manifest cost can change without a cited row.
- [ ] AC-6 — `stitch.sh --mode cut` behaves byte-for-byte as it does today, and
      the header no longer asks for a roadmap item that now exists.
- [ ] AC-7 — The seam-score question has exactly one recorded outcome, registered
      before data existed, and no CI gate reads the score.
- [ ] AC-8 — `agents/tmp.old/better-video.txt` Phases 4–6 are dispositioned by
      name: each is either covered by a phase here, routed, or explicitly
      cancelled with a reason — so the partial-disposition failure this roadmap
      records cannot recur silently on the same file.
- [ ] AC-9 — Estate delta as authored: 0 skills, 0 rules, +1 roadmap (this,
      draft), 1 open blocker, +2 contract sections, +1 lint script, +4 manifests,
      +1 ledger, +1 trace index, +1 evidence note.

## Out of scope

- A scroll-scrubbed landing page, its engine, or a skill that builds one.
- Any vendor-default biller; any plugin-manifest MCP entry pointing at a
  third-party generation platform.
- Mobile or portrait re-renders, posters, SEO blocks — page concerns, routed to
  `road-to-frontend-fidelity-calibration.md`.
- New skills, new rules, new packs. The `ai-video` pack keeps its current
  membership.
- Changing the `cut` default.
- Adopting any external source's SSIM or PSNR thresholds. Phase 4 measures; it
  does not import a calibration.

## Provenance

Neutral descriptors with `ENC1:` pins (`src/scripts/_lib/link_crypto.ts`;
decrypt with the maintainer key). No source code is borrowed from any of these —
this roadmap adopts method descriptions and one refusal register, so no licence
obligation arises here; the licences are recorded in the gitignored inbox copy.

| Ref | Neutral descriptor | Pinned reference |
|---|---|---|
| Source A | Origin skill for scroll-scrubbed video storytelling: the seam law, capability-as-selection-rule, the dated qualification protocol, calibrate-don't-guess budgeting, and the later "judge composition, not raw PSNR" calibration. | `ENC1:A0tXAmZLQA8rZo8CZL6mtdgKMCUXDdZHqaz9jzLCjy5sN/w8RGOq81CgXDtrhGq54YySIz0yaYVy8+sBT7EMhA==` |
| Source B | Hardened fork of Source A: anchor-still gate, previz-first chain, idempotent pipeline, and the SSIM seam thresholds this roadmap declines to adopt. | `ENC1:fJez7guxM3HiTBn7x5LtW1xklxW7JFsOYt7Q4ZTituPNW2icWc+HLe1ZDeEL+VZVbSpse+2e/drUvAErjbCOvA==` |
| Source C | Vendor fork of Source A: generation routed through one platform's MCP server declared in the plugin manifest, with an estimate/balance confirmation step. | `ENC1:VuiNyCgnT2vmVISW3nfWy843oXTLWFEdjVdrCThkI5wDdHz6MprtLQycIHTCGZO32KSNkJtMl4uwg8y9sOgprA==` |
| Source D | Not a skill — a generated site produced by an agent from Source A's method, and the field evidence that a re-implemented engine loses the hardening the original author paid for (3.5). | `ENC1:HZOvYuwy9+J+8ZVdGDYleNskEFXJdF0MzqwSS0uS/chBGIvScK11YFvMesd51EUAnSr+viVtHa3k+E5qpA0QIQ==` |
| Source E | A published agent-skills evaluation, read via a secondary source; its figures are not cited anywhere until the primary is fetched and pinned. | `ENC1:lItT2xCbvwBo1Rd0pV/GpLMbhwR+twHeHF/x/nf+CcD3bY0z7t8rG0WFqN/8x8Eg6kC7ReasBDOFNVUoEQjwsg==` |

The prior arrival of D1/D2/D5 (`## Not-new`) is an **internal** artefact —
`agents/tmp.old/better-video.txt`, a dropped inbox file — and needs no
anonymisation beyond the gitignored path it already lives behind.
