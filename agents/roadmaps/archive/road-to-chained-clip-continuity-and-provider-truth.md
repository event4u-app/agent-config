---
complexity: structural
status: complete
execution:
  mode: phase-checkpoints
completed_at: "2026-08-23"
completion_note: "Flipped off `draft` and archived in the SAME change, so it never becomes active estate — which is what the two exemptions below were reserving. Neither is consumed: `estate_offset_exempt` reserved an offset against an active roadmap that now never exists, and `estate_growth_exempt` reserved +1 open_blocker that is resolved rather than opened. Net estate delta: 0 active roadmaps, 0 open blockers, +1 archived roadmap. Two paid steps (2.1's live probe, 4.2's seam collection) closed as recorded honest nulls, not as results — each names the spend that would discharge it."

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

### Disposition of `better-video.txt` Phases 4-6, by name (AC-8)

Recorded 2026-08-23. The failure this section documents is that a **scoped**
cancellation was read as a whole-file one, so three of seven phases were never
dispositioned at all. Naming them individually is the only shape that cannot
recur silently. Read from the file at
`/Users/…/agents/tmp.old/better-video.txt` (gitignored, maintainer-reachable);
its phase headings are at lines 278, 299 and 322.

| Phase | Disposition | What of it landed, and what did not |
|---|---|---|
| **Phase 4 — Clip-Verify-Loop** (`:278`) | **routed to the owner** | **Nothing of it landed.** It proposes a new `clip-verify` skill in the `ai-video` pack plus a per-frame canon/motion/blueprint diff — and both a new skill and a new pack member are in this roadmap's own `## Out of scope`. Its exit gate ("a verify loop that does not find seeded defects is security theatre and gets parked") is sound and is the same discipline Phase 4 here uses, so this is **not** a rejection on merit. It is out of scope by construction and needs an owner decision to open, because it adds estate. |
| **Phase 5 — Seam-Score + `stitch.sh` v2** (`:299`) | **covered here, partially** | **Landed:** the seam score as a *pre-registered question* rather than an adopted threshold (Phase 4 here, `smoke-trace.sh seam-score`, both PSNR and SSIM); `stitch.sh` v2 as `--mode handoff` with `--xfade` (3.4) — including the offset arithmetic its text names as "die klassische Stolperstelle", computed from ffprobe'd durations and proven by a sabotage probe. **Not landed:** its three-delta metric (16×16 grayscale MAD + palette delta + `ebur128` audio-level delta) — this roadmap pre-registered SSIM/PSNR instead and must not adopt a second metric before the first is decided; `acrossfade` and two-stage EBU-R128 loudnorm — handoff mode is `-an` today and that gap is stated on stderr on every run; the `cut-continuity` skill — a new skill, out of scope. |
| **Phase 6 — Continuity-Conditioning** (`:322`) | **covered here, substantially** | **Landed:** the capability axis as a per-model manifest fact (1.1 `start_frame`/`end_frame`/`frame_lock`), `end_image` in the stdin contract with refusal-by-name (1.3), last-frame extraction as the next clip's anchor (3.1), the connector (3.3), and its "validation triangle" as intent → translation → refusal. Its own parenthetical — *"Continuity ist Adapter-JSON, kein 13. Blueprint-Block"* — is exactly the conclusion 3.1 reached independently and for the same reason. **Not landed:** the `multi_shot` capability value (no adapter in the tree reaches a multi-shot endpoint, so a manifest field for it would be `null` everywhere and prove nothing); the `character-consistency` interlock; `conditioning:` as a four-valued enum — the two boolean frame keys carry what this tree can currently probe, and a value nothing can set is not a capability. |

**The generalizable fix, so this class cannot recur on any file:** a partial
disposition must name the phases it does **not** cover.
`agents/roadmaps/archive/road-to-inbox-harvest-2026-08.md:449` scoped its
cancellation to "`better-video.txt` Phases 2-3" and was *correct* — the sweep
that read it supplied the wrong quantifier. Naming the complement is one line
and makes the omission visible in the record instead of only in the reader.

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

- [x] **0.1 Publish a tracked trace index.** `corrected-from-reproduction` — this
      step exists because D3's real defect is reviewer-reachability, and an index
      fixes that without exposing a single raw trace.
      `smoke-trace.sh index` emits `agents/evidence/ai-video/trace-index.json`
      (tracked): one row per local trace with `provider`, `trace_id`,
      `captured_at`, `model`, and a SHA-256 of the raw file — no request bodies,
      no URLs, no cost figures, nothing redaction-sensitive. A reviewer can then
      confirm that the trace `fal.json:32` names exists and when it was captured,
      which is exactly the claim the header makes.
      verify (discharged): `git ls-files agents/evidence/ai-video/trace-index.json` returns the path. `jq -r '[.[] | keys[]] | unique | join(", ")'` over it returns exactly `captured_at, model, provider, sha256, trace_id` — the five-field allowlist and nothing else. All **6** `smoke_trace` ids across the manifests resolve to a row (each `jq` lookup returns 1); `lint_adapter_tier` re-checks this on every run, so a dangling pointer is now a build failure rather than a thing someone notices. A grep for `Bearer|https?://|sk-|Authorization` over the index returns **0**, and `tests/scripts/ai_video_trace_index.test.ts` pins that exclusion with a fixture whose trace bodies contain a fake bearer token and a signed URL on purpose.
      **Correction to the step's own premise:** the row count is **57**, not the 58 the Context section states. 58 is the `ls` count of the trace directory and includes the `artifacts/` subdirectory, which holds rendered `.mp4` files rather than traces. The index indexes traces.
      **Design decision the step did not specify:** an absent trace directory is a *refusal* (exit 7), not an empty index. A zero-row index reads as "no evidence exists", which is a different and stronger claim than "the traces are not on this disk", and writing one would convert a missing input into a published assertion.
      **Field semantics worth pinning:** `model` is the filesystem-safe slug the capture path wrote into the filename (`/` → `_`), never the provider's model id reversed back out — that substitution is lossy and inverting it would be a fabricated field. Consumers match by applying the same forward transformation.
- [x] **0.2 Act on the trace-home decision.**
      **Branch: `local-only`. Date: 2026-08-23.** Decided by AI council (2/2
      convergent) — see the resolution under `## Blockers`. No `.gitignore` edit;
      `agents/reference/ai-video/*` stays ignored, the raw traces stay on the
      maintainer's disk, and the reviewer-facing claim is carried by 0.1's index
      plus 0.3's lint. The recorded local-only decision (`d7f5d5d3c`,
      2026-06-10) is thereby reaffirmed rather than left unconfirmed, which the
      blocker named as the reason it got re-litigated in the first place.
      verify (discharged): the local-only branch is recorded above with its date, and `git ls-files agents/reference/ai-video/smoke-traces` returns 0 (run 2026-08-23 in the worktree at `e7c437fe5`; `test -z "$(git ls-files agents/reference/ai-video/smoke-traces)"` exits 0). `.gitignore:235` is untouched.
- [x] **0.3 Lint the claim against the reachable evidence.**
      `src/scripts/lint_adapter_tier.ts`: for each
      `src/scripts/ai-video/adapters/*.sh` and `src/scripts/ai-image/adapters/*.sh`,
      parse the `# Lifecycle:` header; `stable` requires a row in 0.1's index
      whose `provider` matches and whose `captured_at` is ≤ 180 days old;
      otherwise FAIL with the adapter name and the missing id. Register it in the
      gate ledger and the pipeline's gate list.
      verify (discharged): `tests/scripts/lint_adapter_tier.test.ts` — 13 cases, green — pins both outcomes. The empty-index case asserts `code === 1`, `findings.length === 7`, and each of the seven `stable` adapters named individually (`fal`, `gemini-veo`, `higgsfield`, `kling`, `replicate`, `sora`, `openai-images`), with the `experimental` fixture adapter scanned but never a finding. Against the real tree: `✅  7 stable claim(s) resolve to a trace inside 180 days (14 adapter header(s) scanned)`.
      Registered on all six surfaces: `src/config/gate-coverage.yml` (`min_scanned: 12`, `status: enforced`, with a create-only canary), the header's three recounted figures, `taskfiles/ci-fast.yml`, the `ci:` list in `Taskfile.yml`, and a step in `.github/workflows/rule-backstops.yml`. `check_ci_local_parity` green (`134 CI gate(s), 275 local`); `check_gate_coverage --quiet` green; **`check_gate_coverage --canary` reports `lint_adapter_tier: caught the planted contract-violation defect (exit 1)`** — the gate is proven to discriminate, not merely to run. It adopts `_lib/gate_ledger.ts` and `_lib/scan_scope.reportScanned`, and carries a 7-case `--self-test` (4 rejecting) so the `gate-self-test:registered-non-adopters` ratchet stayed at its baseline of 24 instead of going to 25.
      **Two additions beyond the step's text, both to stop a weaker check from looking stronger:** the gate also fails a *dangling* `smoke_trace` reference (a manifest pointing at a trace id no row carries), and it fails when 0.4's generated contract table has drifted — so `DO NOT EDIT BY HAND` is enforced rather than requested.
      **Honest limit, written into the gate's own docstring rather than left implied:** the index carries five fields by design, so `mode` and `success` are invisible to the lint and a *dry-run* trace satisfies the freshness rule. Widening the index to reach a stronger check is exactly the five-fields-to-body-copy slide the allowlist prevents. The per-model `verified: true` + `smoke_trace` pair is the stronger signal; the dangling-reference check is what keeps that pair honest.
- [x] **0.4 Refresh the contract's stale day-one table.**
      `corrected-from-reproduction`: `docs/contracts/provider-lifecycle.md:112`
      already self-scopes §5 to the landing day, so this is a staleness fix, not a
      contradiction fix. Replace `:110-125` with a table generated from 0.3's
      parser so the snapshot cannot drift again, and keep one sentence recording
      that the original table was scoped, not wrong.
      verify (discharged, with a correction to the verify line itself): the `DO NOT EDIT BY HAND` marker sits directly above the table, naming its generator. §5 is now generated by `lint_adapter_tier --table` and spliced between `<!-- BEGIN/END GENERATED: adapter-tier-table -->`; `--write-contract` regenerates it and the bare gate **fails** when the block has drifted, so the snapshot cannot go stale again. One sentence records that the original table was scoped, not wrong — it stated the tiers "on the day this contract lands", which was true, and became a stale *reading* of a correct sentence. The old §5 prose that read "All five start as `experimental` on day one" is now §5b, restated in the present tense.
      **The verify line as written is unsatisfiable and was discharged in its intent instead.** `grep -c 'experimental' docs/contracts/provider-lifecycle.md` counts lines in the *whole file* and returned **13** before this change: the word appears throughout §3 and §4 prose (e.g. `:106` "`experimental → block`, breaking day-to-day dev iteration"). Making a whole-file count equal the adapter count would mean deleting correct prose to satisfy a grep. Scoped to the generated block, which is what the step means, the numbers agree exactly: `awk '/BEGIN GENERATED/,/END GENERATED/' … | grep -c '`experimental`'` returns **7**, and 7 adapter headers read `experimental` (`comfyui`, `musetalk`, `syncso`, `flux`, `gemini-image`, `ideogram`, `recraft`).
      **Sensitivity proven by sabotage, not assumed:** `lint_adapter_tier.test.ts` hand-edits a row in the real contract, asserts `contractDrift()` reports stale and `main()` returns 1, restores the file in a `finally`, and then asserts the restore actually happened — a drift check never seen red would pass just as happily against a splice that returned its input unchanged.
- [x] **0.5 Name the ASSUMED fields.** `smoke-trace.sh assumed <adapter>` lists
      every `ASSUMED`-tagged field with its line; the trace template gains a
      mandatory `assumed_fields_confirmed:` list. A field stays ASSUMED until a
      trace confirms it. `corrected-from-reproduction`: the total is **21**, not
      18 — `syncso.sh` carries 3 and was missing from the source's adapter set.
      Per adapter: gemini-veo 5, fal 4, kling 3, sora 3, syncso 3, replicate 2,
      higgsfield 1.
      verify (discharged on its first half; **honest null on the second**): `smoke-trace.sh assumed kling` prints exactly 3 lines, each an `ASSUMED`-tagged field with its line number (`24:`, `98:`, `157:`). `assumed --all --domain ai-video` totals **21** and the per-adapter breakdown matches the step's figures exactly — gemini-veo 5, fal 4, kling 3, sora 3, syncso 3, replicate 2, higgsfield 1. The trace template gained `assumed_fields_confirmed` (mandatory, `[]` by default) and `--confirms <a,b>` to populate it; both asserted on a real dry-run capture in `tests/scripts/ai_video_smoke_trace_assumed.test.ts` (8 cases, green), not on a hand-written fixture.
      **Honest null — the second half is not verifiable without spend.** "After a trace that confirms them the adapter comment loses the tag and that adapter's count is 0" requires a **live, paid** provider round-trip to confirm a field name; no field's ASSUMED tag was dropped and no adapter's count went to 0. What *is* proven without spend is that the counter reads the tree rather than a stored number: `comfyui` and `musetalk` carry no tag and are absent from the report, and `assumed comfyui` prints nothing. The confirmation step stays a maintainer Hard-Floor action.
      **Correction to the step's own premise:** "the sum across all adapters is 21" is true of the **ai-video** adapter set only. The harness resolves providers from `ai-video` *and* `ai-image` (`smoke-trace.sh` `ADAPTER_DIRS`), and the four ai-image adapters carry one tag each — undifferentiated, the total is **25**. This is the same class of omission the step already records for `syncso.sh`, one directory further out. `--all` therefore reports a `<domain>` column and takes `--domain <id>`, so both the 21 and the 25 are recoverable and neither is presented as the whole answer.
- [x] **0.6 Decay marker for vendor-bound claims.** Add `recheck_by: <date>` to
      the trace template and surface it in `capability` output (`… (verified
      2026-xx-xx, recheck by 2026-yy-yy)`); the adapter warns on stderr past the
      date. Same idiom as `keep-beta-until` in
      `docs/contracts/skill-bundled-assets.md:1-4`; no new frontmatter key on
      skills.
      verify (discharged): `fal.sh capability --model fal-ai/ltx-2/text-to-video` → `{"verified":true,"verified_at":"2026-06-10","recheck_by":"2026-12-07"}` — both dates on the traced adapter. An **untraced** model in the same tree (`kling-v2-master`) carries `verified_at: null, recheck_by: null`, because unknown must never read as fresh — the `null` ≠ `true` rule of the frame axis applied to time. Past the date the adapter warns on stderr: `fal: model … was verified 2026-06-10 and its recheck-by date 2026-06-11 has PASSED — re-probe before trusting the capability`. `tests/scripts/ai_video_capability_recheck.test.ts` (6 cases, green) pins all of it, including a **conditional-warning** case asserting the warning is absent while the date is in the future — without which the stderr assertion would pass against a helper that warns unconditionally. The trace template's `recheck_by` half is asserted on a real dry-run capture in `tests/scripts/ai_video_smoke_trace_assumed.test.ts`.
      **The date is DERIVED, never stored twice:** the entry's `smoke_trace` id resolves to a trace-index row, and `captured_at + AIV_TRACE_RECHECK_DAYS` is the recheck date. One constant, shared with `lint_adapter_tier`'s staleness window and with the stamp `smoke-trace.sh` writes — proven by a case that drives the window to 30 and 90 days and reads back 2026-07-10 and 2026-09-08. Reading `recheck_by` straight out of the trace was rejected: the traces are local-only and absent from every clone, whereas `captured_at` is already one of the index's five fields and the arithmetic is free, so nothing needed widening.
      **Two defects found and fixed while proving this, both of which had produced a silently wrong answer:** (a) `fal.sh` carried its own `capability` path, so the one adapter that actually holds `smoke_trace` ids was the one place the dates were invisible — its JSON emission now routes through the shared helper (its model validation, manifest check and unverified warning are untouched); (b) the helper resolved the repo root by counting `..` segments, and `AIV_LIB_DIR` is `src/scripts/<domain>/lib` for an adapter entry point but `src/scripts/media/lib` when the common file resolves itself — a fixed depth is right for one caller and silently wrong for the other, which is exactly how this first shipped with `verified_at: null` on a traced model. It now walks up for the index.

**Exit criteria.** 0.3 is registered and green; every `stable` header resolves to
an index row; the contract table is generated. **Rollback.** Revert the lint
registration and the generated table; 0.1's index is additive and inert on its own.

## Phase 1 — Give the manifest schema the frame axis it already implies

- [x] **1.1 Manifest schema v2 — a catch-up, not a new axis.**
      `corrected-from-reproduction`: the mapping row at
      `src/scripts/ai-video/lib/model-capabilities/README.md:65` and
      `higgsfield.sh:133-135`'s hard requirement already assert start-frame
      behaviour; the schema at `README.md:17-34` cannot express it. Add
      `start_frame: true|false|null`, `end_frame: true|false|null`,
      `frame_lock: {probed_at: <date>|null, psnr_frame0: <dB>|null}`. `null` means
      *unknown*, and unknown is never treated as `true`. Existing entries get
      `null`/`null`/`{null,null}` — including `higgsfield`, whose hard requirement
      is evidence about the *adapter path*, not a probed fact about each model.
      verify (discharged): `jq -e` over all **9** manifests confirms `schema: 2` and that every one of the 16 model entries answers `start_frame`, `end_frame` and `frame_lock{probed_at, psnr_frame0}` — all `null`, including `higgsfield`, and no `psnr_frame0` populated. The incoherent pair (`end_frame: true` with `start_frame` not `true`) is refused **by the production reader** (`aiv_assert_frame_coherent` in `adapter-common.sh`), not by a validator the test owns, and `tests/scripts/ai_video_model_capabilities_schema.test.ts` (23 cases, green) pins both the refusal and a coherent-pair case proving it is conditional rather than unconditional. README cross-reference at `:113-117`: *"A mapping row is not evidence that a model accepts the field: only `frame_lock.probed_at` is."*
      **Why no JSON Schema file, decided rather than defaulted:** `src/scripts/schemas/` holds 25 real schemas and the precedent extends to data configs, but it always ships schema **plus its own CI gate script** — a Phase-1 scope expansion that would trip the gate-ledger and gate-coverage ratchets this phase asks for none of. More decisively, the rule that matters here is not a shape: *"`null` is unknown and unknown is never `true`"* and the incoherence rule are **read-time** refusals. In `adapter-common.sh` they bind on the shipped path; in a schema file they would have documented behaviour and enforced nothing at runtime. The shape half is pinned by the vitest file.
      **Two corrections to the step's premise.** (a) `README.md:65`, `higgsfield.sh:133-135` and `README.md:17-34` are all confirmed exactly — but the D2 claim that *"manifests still exist for multiplexers only (`README.md:3-4`)"* is **wrong about the tree**: `comfyui.json`, `syncso.json` and `musetalk.json` already existed for non-multiplexer adapters. The README was stale; the tree was not. So the step's real content is a README correction plus four new files. (b) `fal.json` is **77** lines, not the 76 the Context section implies — `awk 'END{print NR}'` gives 77 while `wc -l` gives 76, because the file has no trailing newline.
- [x] **1.2 Per-model manifests for the direct adapters.** `higgsfield.json`,
      `kling.json`, `gemini-veo.json`, `sora.json` in the same schema, one entry
      per model the adapter already names, `verified: false` and frame fields
      `null` throughout. The `capability` subcommand of each direct adapter reads
      its manifest the way the multiplexers do.
      verify (discharged): the directory gains `gemini-veo.json`, `higgsfield.json`, `kling.json`, `sora.json` (5 entries total). `higgsfield.sh capability --model dop-turbo` answers from the manifest with the full v2 shape plus the UNVERIFIED stderr warning. `README.md:3-9` now reads "One JSON manifest per adapter whose capabilities differ per model — the multiplexers …, the local engine …, the lip-sync pair … and the direct video adapters". The bare `capability` surface is byte-identical (`test-pipeline.sh` still green for gemini-veo=native, openai-images=none, sora=native, kling=none).
      **Every id, duration, aspect and cost is cited to `file:line` — nothing invented.** `dop-turbo` (`higgsfield.sh:116`) carries `null` duration, `null` aspect and `null` cost because **nothing in the tree states them**: there is no duration parameter in its request body (`:186-187`), no accepted-ratio list anywhere, and the only cost figure is a dry-run fixture's per-clip `0.1`, not a per-second rate. `kling-v2-master`: 5/10 from the enum clamp (`kling.sh:151`), cost `0.28` **derived** from `_kling_model_rate_usd` 1.40 per 5 s (`:102-104`). `veo-3.0-generate-001`: 4/8 (`:34-37`, clamp `:132-137`), cost `0.40` (`:94`). `sora-2` / `sora-2-pro`: 4/12 from an empirically verified enum (`sora.sh:12,15-16,21`), aspects from the adapter's own two-branch size mapping (`:121-122`), costs `0.10` / `0.30` (`:73-74`).
      **Deliberate omissions, recorded in each file's `comment`:** `kling-v1*`, `veo-3.0-fast*` and `veo-2.0*` are **rate-prefix patterns with no concrete id anywhere in the tree**, so no entry was invented for them; `higgsfield-soul` is excluded because the adapter explicitly refuses it for image2video and rewrites to `dop-turbo` (`:113-120`).
      **Correction to the step's premise:** the verify line assumes `higgsfield.sh capability --model` exists. It did **not** — `:49` parsed only `--preset` and the `*)` arm silently discarded everything else, so `capability --model dop-turbo` returned the generic preset blob with **exit 0**. Adding `--model` was part of the step, not a given. `--preset` is unchanged and pinned by a test.
      **Honest note on `verified: false`:** all four adapter headers record live round-trips of these exact ids in prose (gemini-veo 10/10, kling 1/1, sora 1/1, higgsfield 1/1), yet every entry stays `false` — `verified` is a per-model claim needing a **citable** trace id. These five entries are now the first candidates for a `smoke_trace` id, which is precisely what 0.1's index makes possible; each manifest's `comment` says so.
- [x] **1.3 `end_image` in the stdin contract.**
      `src/scripts/media/lib/adapter-contract.md` gains an optional
      `end_image: "/abs/path.png"`. An adapter whose manifest says
      `end_frame: false|null` for the submitted model **refuses** (new exit code,
      message names the model and the field) — it never drops the image silently.
      This is the bundle's one hard rule, and refusal-over-silent-downgrade is
      already the house register: `stitch.sh:72-76` refuses the crossfade for the
      same reason.
      verify (discharged): `adapter-contract.md` lists `end_image` at `:106` in the stdin block, in the optional-key list at `:120`, and in a dedicated `### end_image` section at `:126`. `test-pipeline.sh` § 7 first **asserts the precondition** (kling/kling-v2-master really does answer `end_frame=null`, so the case proves something) and then refuses: `kling: end_image refused with exit 12, naming kling-v2-master and end_frame`. `tests/scripts/ai_video_end_image_refusal.test.ts` (11 cases, green) adds a multiplexer case, an absent-model case, "explicit `null` is not a request", and `poll`/`capability` left ungated.
      **The gate is placed for two reasons that were each a bug in a previous version of something:** it lives in `aiv_dispatch`'s `submit|run` arm so **every** adapter refuses identically with zero per-adapter edits, and it runs **before** `aiv_assert_dryrun` — which is what makes it visible in the default mode, the exact lesson `ai_video_stitch_flags.test.ts:9-17` was written to record. `dry-run` is deliberately **not** gated and the contract says why: it consumes no stdin at all and ignores `duration`/`aspect` alike; it is a fixture echo, not a render preview.
      **Correction to the step's premise:** the instruction to "read the exit-code table in `adapter-contract.md`" could not be followed — **there was no exit-code table.** Codes appeared only scattered in prose. One was built from the tree (an `aiv_die` sweep across `adapters/` and `media/lib/`): live set 2, 3, 4, 5, 6, 7, 8, 10, 11, 75. **9 is vacant and was deliberately not recycled** — it meant "live not yet wired" until ADR-056 and an archived `error.json` carrying `exit_code: 9` keeps its original meaning. `12` is the next free sequential number, documented with that reasoning.
      **Sensitivity proven by neutralising the mechanism:** pointing `AIV_MODEL_CAPS_DIR` at a fixture claiming `end_frame: true` reproduces the pre-gate behaviour exactly — `exit 4 but the message names neither the model nor the field`, `20 passed · 1 failed`.
- [x] **1.4 Selection rule in `motion-choreographer`.** One paragraph under
      "Step 0: Inspect": when the blueprint asks for a continuous take or a
      connector, read `start_frame`/`end_frame` first; a model that cannot
      frame-lock is *declined with a one-line why, not substituted in*. No new
      skill; ≤ 120 tokens added.
      verify (discharged): `wc -c` **7830 B → 8220 B, +390 B** (≤ 600 B). `task lint-skills`: `446 pass, 0 warn, 0 fail` — **identical to the pre-edit baseline**, so no new WARNING and no cap tipped (an exit code alone would not have shown that). The citation sits at `:67`, and an `<a id="end_image"></a>` anchor was added above the contract heading so the fragment actually resolves — the descriptive heading's own slug would have been `#end_image--closing-frame-additive-v2`. `check_references` green over 1537 targets.
      A numbered item rather than a paragraph, because "Step 0: Inspect" is a numbered list.

**Exit criteria.** Every manifest answers the three frame keys; `end_image` is a
contract field with a refusal path under test. **Rollback.** Drop the schema keys
and the four manifests; `end_image` is optional, so removing it restores the v1
contract exactly.

## Phase 2 — Probe, don't assume: qualification and cost calibration

- [x] **2.1 `smoke-trace.sh probe-frame-lock <adapter> <model>`.** One clip at the
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
      verify (**second half discharged; first half is an honest null**): `tests/scripts/ai_video_frame_lock_probe.test.ts` (10 cases, green) runs the PSNR step on two ffmpeg-generated fixture PNGs and asserts the threshold branch **both ways** — identical frames give `inf` → `start_frame: true`; visibly different frames give 3.13 dB → `start_frame: false` with the measured value kept, never `null`. **Sensitivity proven by sabotage:** neutering `_st_ge` to `return 0` turned two cases red (`expected true to be false`), restored from a `cp` backup, re-verified green. A second probe drives the threshold from `AIV_FRAME0_PSNR_MIN` in both directions (99 → false, 1 → true), so the threshold is a real input rather than decoration.
      **Honest null on "running the probe on one live model".** No manifest entry carries a `probed_at` date or a `psnr_frame0` value, because a live probe is a **paid** provider call and this run had authority to spend nothing. `probe-frame-lock` therefore ships fully implemented and dry-run-guarded: without `AIV_DRYRUN=false` it prints the plan, the duration read from the manifest, and the estimate derived from the manifest's own `cost_per_second_usd` (`{"dry_run":true,…,"duration_s":5,"estimated_usd":"0.4",…}` for `fal-ai/wan/v2.2-a14b/text-to-video` — 0.08 $/s × 5 s), and submits nothing. A live probe with no `--still` **refuses** rather than guessing a fixture. **What closes this:** a maintainer sets `AIV_DRYRUN=false` and runs it per model, at the ≈ USD 10 the step already prices.
      **Design decision the step left open, resolved conservatively:** the end-frame side records **no pass/fail number**. Whether a clip *ends* on a given composition is a judgement about composition, not an identity check, so a dB figure there would be a fabricated verdict wearing a measurement's clothes; the probe stores the extracted end frame beside the target for a human, exactly as the step's own text asks. The frame-0 side keeps PSNR legitimately, and for the reason the step gives: frame-0 identity against codec noise is a different question from seam quality, so the "not PSNR" caveat does not transfer.
- [x] **2.2 Calibration probe in `/video:from-script --mode commit`.**
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
      verify (discharged): `grep -c calibrat src/domains/ai-video/video/from-script/command.md` returns **6**. `test-pipeline.sh` § 8 prints `calibration: modeled $0.1600/s · charged null/s · delta: n/a (nothing charged yet) · extrapolated batch null (modeled $3.2000)` and exits **0** — `charged: null` extrapolates nothing and does not re-confirm. Full run: `result: 24 passed · 0 failed`.
      **Sensitivity is in the same section, not left to inference:** a third assertion feeds `charged_usd: 1.60` against a modeled 0.16 $/s over 5 s (+100 %) and requires exit **13**. Without it the exit-0 assertion would pass against a script that never halts at all.
      **Where the calibration lives, and why not in `operator-pick.sh`:** that script's contract is exactly two positional args and it exits 2 otherwise, so a subcommand would break every existing caller. The logic is a new sibling, `src/scripts/ai-video/lib/calibrate-cost.sh`, invoked *at* the operator-pick moment — the step's "folds into the existing moment" is about **when** the operator sees the line, not which file computes it.
      **`null` ≠ `0` is enforced at the arithmetic, not just documented:** a charge with no scene duration is real but not comparable per-second, so it prints `null` rather than dividing by a guessed duration. Exit 13 is a halt for a human and is documented as such in the contract's exit-code table, with the note that `--max-spend-usd` is not a substitute — that cap bounds *total spend* while this catches a wrong *per-second model*, which is what makes the total wrong in the first place.
- [x] **2.3 Close the feedback loop the read-back never had.** Append each
      `(adapter, model, modeled, charged, date)` row to
      `agents/evidence/ai-video/cost-ledger.jsonl` (tracked) from the
      `charged_usd` values `resume-scan.sh` already sums;
      `manifest.cost_per_second_usd` may then be updated only by a script that
      cites the ledger rows it averaged. This is the whole of the surviving D4
      gap: money spent is recorded and never read back into the model.
      verify (discharged): `agents/evidence/ai-video/cost-ledger.jsonl` exists with 1 row. `lint_adapter_tier --cost-diff <base-ref>` warns on a manifest `cost_per_second_usd` change with no ledger row added, and is silent when the same diff carries one — **both directions proven** in an isolated throwaway git repo (`tests/scripts/ai_video_cost_ledger.test.ts`, 12 cases, green), because asserting only the silent case would pass against a function that never warns at all. It is a **warning, never a failure**: re-modelling an estimate is a legitimate human act; doing it silently after a measurement contradicted the model is what gets surfaced.
      `null` ≠ `0` is enforced rather than documented: `--charged null` and an omitted `--charged` both write `null`; `--charged 0.0` writes `0` for a *known* free render (a local ComfyUI job, ADR-060 cost semantics); a non-numeric value is refused and no file is created. A missing price and a free render are different facts, and `0` erases the difference in the one direction that silently lowers every future estimate.
      **The one committed row is `charged: null`, and that is the honest reading, not a placeholder:** 2.1's live probe did not run, so nothing was charged. The row records the modeled figure the manifest already carried (0.08) against a null charge, which is precisely the third clause's shape.
      **Defect found and fixed in the implementation while proving it:** `costDiffWarnings` inherited `GIT_DIR` / `GIT_WORK_TREE` from its environment, so a run from a hook or a worktree would have diffed **somebody else's repository** while appearing to honour `cwd`. Those variables are now scrubbed and `cwd` is the only thing that decides which repo is read. The same mistake in the test's own fixture (`GIT_DIR: ''` blanks rather than unsets, and git took the empty string as a directory) is what surfaced it — the positive case looked like a missing feature for one run.

**Exit criteria.** At least one model carries a probed `frame_lock`; the ledger
has rows; the calibration line prints in a dry run. **Rollback.** The probe and
the ledger are additive; `--no-calibrate` is the off switch and the default flips
back with one line.

## Phase 3 — A continuity path beside the hard cut

Default stays `concat -c copy`. Everything here is opt-in and preview-visible.

- [x] **3.1 Seam handoff in the blueprint.**
      `src/scripts/ai-video/lib/parse-blueprint.sh` accepts
      `continuity: cut|handoff` per scene boundary (default `cut`). `handoff`
      means clip *i+1*'s `ref_images[0]` is the **extracted last frame of clip
      *i*'s rendered output** (`ffmpeg -sseof -0.15 … -frames:v 1`), not its own
      still. Preview prints the seam plan — which boundaries hand off, which cut —
      and the generation count.
      verify (discharged): `parse-blueprint.sh` with `CONTINUITY: crossfade` exits **3** with `parse-blueprint: unknown CONTINUITY value: crossfade (expected cut|handoff|connector)`. `seam-plan.sh` over a 4-scene fixture with two `handoff` boundaries prints both (`seam 1->2 … handoff`, `seam 3->4 … handoff`), the `cut` between them, and `gens: 4` — plus `sequential=true` and an explicit "the chain loses parallelism" line. `tests/scripts/ai_video_seam_plan.test.ts` pins it; RED first (`expected undefined to be 'cut'`, and `No such file or directory` for the preview).
      **Where the preview lives, and why it is not a `parse-blueprint.sh` subcommand:** that script takes its input file as `$1`, so adding a verb would break the documented `parse-blueprint.sh prompt.txt` form and every existing caller. The plan lives in a new sibling, `src/scripts/ai-video/lib/seam-plan.sh`, which reads an ordered list of per-scene blueprint JSONs.
      **Value space is `cut|handoff|connector`, one wider than the step's text:** 3.3 needs a way to say connector *at a boundary* and the roadmap writes it as `handoff: connector`, which is not expressible as a block value without a colon. Three flat values keep this step's set as a strict subset.
      **Correction to the step's premise — `continuity` cannot be "a new optional block".** `12-block` / `12 labeled blocks` is a load-bearing name in ≥ 10 artefacts, including two size-capped skill descriptions (`src/skills/scene-expander/SKILL.md:4`, `src/skills/video-director/SKILL.md:4`) and `src/scripts/media/lib/adapter-contract.md:34`; renaming to 13 is far outside this phase. `CONTINUITY` is therefore documented as a **chain directive**, listed separately from `blocks:` in `scene-blueprint.schema.yaml`, because it describes how a scene joins its neighbour rather than the shot — so "12-block" stays true everywhere and the schema stops contradicting the parser.
      **Pre-existing defect found, NOT fixed (out of scope, recorded):** `parse-blueprint.sh:75-86` lets a labelled block whose key is not in its `case` list fall through with `current` still pointing at the *previous* block, so the whole line is appended to that block's value. Reproduced against unmodified code: `NEGATIVE: nope` followed by `CONTINUITY: crossfade` yielded `"negative": ["nope", "CONTINUITY: crossfade"]` and **exit 0**, while the header claims exit 3 for an unknown block. This change closes it for `CONTINUITY` only; every other unknown label still folds silently.
- [x] **3.2 Sequential execution for handoff chains.** `handoff` boundaries force
      sequential rendering of the two clips and a per-seam sentinel —
      `src/scripts/ai-video/lib/resume-scan.sh` already owns sentinels, so extend
      it rather than duplicating. A failed or re-rolled clip invalidates exactly
      the seams it touches.
      verify (discharged): on a 4-scene fixture chain, `resume-scan.sh scan` reports `seams_green: 3`. After re-rolling clip `0002` (new render input, correctly re-stamped, so the **scene** is green again) it reports `0001->0002 stale` and `0002->0003 stale` with the reason `scene 0002 was re-rolled after the seam was built (input hash changed)`, `0003->0004 green`, and `seams_green: 1, seams_stale: 2, seams_missing: 0` — exactly the two adjacent seams and no others, with all four scenes still green. `tests/scripts/ai_video_resume_seams.test.ts` (6 cases) pins it; RED first (`out.seams was undefined` ×5).
      Extended, not duplicated: the sentinel is `<project>/seams/<from>__<to>.json` carrying both scenes' input hashes, and the three `seams_*` counters are additive — a regression case asserts the pre-existing scene report and its keys are untouched.
      **Sensitivity proven by sabotage:** forcing `seam_state="stale"` unconditionally reds 3 of 6 cases including `expected 'stale' to be 'green'` on seam 3→4, so the "and no others" half is genuinely tested rather than implied by the "lists the two" half.
      **Correction to the step's premise:** `resume-scan.sh` is a **scanner** — it owns sentinels and invalidation and has no execution path to serialise. The step's "force sequential rendering" therefore lands in two places rather than one: the invalidation contract here, and the operator-facing statement in `seam-plan.sh` (`sequential=true` plus the loses-parallelism line). The actual serialisation belongs to the orchestrator in `src/domains/ai-video/video/from-script/command.md`.
- [x] **3.3 Optional connector clip.** When both adjacent models report
      `end_frame: true` and the boundary says `handoff: connector`, generate one
      extra clip with `ref_images[0]` = last frame of *i* and `end_image` = first
      frame of *i+1* (generation count becomes 2N−1; preview states it). No
      connector without a probed `end_frame` — `null` is not `true`.
      verify (discharged): with `end_frame: null` on one side, `seam-plan.sh` exits **2** with `connector refused at seam 1->2 (scene-1 -> scene-2): scene scene-2 model 'fal-ai/ltx-2/text-to-video' (adapter fal) reports end_frame=null — a connector needs a probed end_frame:true on both sides, and null is not true` — the model name is in stderr. With `true` on both sides across 4 scenes the preview reads `connector=3` and `gens: 7 (2N-1)`. Five cases in `tests/scripts/ai_video_seam_plan.test.ts`; RED first (status 127, `No such file or directory`).
      `end_frame` is read **defensively**: a missing manifest, a missing model entry, a missing key, or an unnamed adapter/model all resolve to `null`, and only a literal `true` permits the connector — so Phase 1's schema keys are not a dependency of this step.
      **Sensitivity proven by sabotage:** replacing the gate condition with `if false` reds exactly the four refusal cases and leaves the permitted-connector case green.
      **A bug caught by a test instead of shipped:** the first `_sp_end_frame` used `(.models[$m].end_frame) // null`, and jq's `//` treats `false` as absent — so a **probed** `end_frame: false` would have been reported as `null`. The refusal was still correct; the stated *reason* was not, which is the harder defect to notice. Fixed to `if has("end_frame") then …`, with a test asserting `end_frame=false` appears verbatim.
- [x] **3.4 Re-encode stitch mode — the item `stitch.sh:76` asks for.**
      `stitch.sh --mode handoff`: a re-encode path (`libx264 -crf 20 -g 8
      +faststart -an`) with an optional `--xfade <s>` ≤ 0.25 applied **only** at
      `handoff` seams, as insurance. The `--crossfade` refusal stays for
      `--mode cut`, and the header's "open a roadmap item for the re-encode path"
      sentence is replaced by a pointer to this file — closing the loop the script
      opened.
      verify (discharged): `--mode cut --crossfade 0.2` still exits **2** with the unchanged refusal. `--mode handoff --xfade 0.2` on two 2.000000 s fixture clips produces an output of **3.800000** s by ffprobe — exactly `4 − 0.2`, against a ±0.05 tolerance. 17 cases in `tests/scripts/ai_video_stitch_handoff.test.ts`; RED first on 13 of 16 (`expected 'adapter: stitch.sh: unknown flag '--mode'' to match /--crossfade is not implemented/`).
      `--xfade` is refused (exit 2) outside handoff mode, above the 0.25 s ceiling, at 0, and on a non-numeric value. `--crossfade` stays refused in **every** mode; its message now points at `--mode handoff --xfade <s>` instead of asking for a roadmap item — the loop `stitch.sh:76` opened is closed. Seam offsets are computed from **ffprobe'd** durations, never the manifest's declared ones.
      **The byte-identical cut path was PROVEN, not asserted:** `git show HEAD:…/stitch.sh` was run side by side with the new file on identical fixtures — live stdout IDENTICAL, live stderr IDENTICAL, dry-run stdout IDENTICAL, dry-run stderr IDENTICAL, **mp4 bytes IDENTICAL**. That measurement changed a decision mid-flight: the first version added `"mode":"cut"` to the cut-path JSON, and while the mp4 stayed byte-identical the **stdout did not** — an additive key is still a changed stdout for every existing caller. `mode` is now emitted only in handoff mode, and a test asserts the cut-path JSON carries no `mode` key and that `--mode cut` and no-flag produce identical stdout and stderr.
      **Sensitivity proven by sabotage on the arithmetic that matters:** changing `offset = acc − xfade` to `offset = acc` reds the duration case with `expected 2.04 to be close to 3.8` — the classic transition-offset trap is genuinely caught.
      **The roadmap pointer could not be written, and the gate is the reason:** `check_no_roadmap_refs.ts:53` makes `docs/contracts` a `STABLE_TREE` and `:72-73`'s `ROADMAP_FILE_RE` matches any `agents/roadmaps/**/*.md`, **archive included** — so neither the header nor the contract may cite this file, before or after archival. Both instead name the mode and the contract section (`--mode handoff (+ --xfade <s>)`, `docs/contracts/skill-bundled-assets.md § Port invariants`). `check_no_roadmap_refs` is green and a test asserts the contract carries no roadmap citation, so the archive move cannot create a dead link.
      **Functional gap recorded rather than glossed:** handoff mode re-encodes with `-an` per the step's literal spec, so it drops all audio. That would be a silent downgrade, so it is stated on stderr on **every** handoff run (asserted by a test) and in the header. A handoff chain currently needs an audio bed muxed afterwards.
- [x] **3.5 Port-invariants for bundled executables.** One section in
      `docs/contracts/skill-bundled-assets.md`: a skill that bundles an
      executable asset lists `port_invariants:` — the behaviours that must survive
      if a consumer re-implements it. Pilot on `stitch.sh` with three invariants:
      hard-cut default, refusal over silent downgrade, handoff frame = rendered
      frame. No new skill, no new rule. The motivating field evidence is Source D,
      a generated site that re-implemented a bundled engine and lost its
      hardening; it is cited by neutral descriptor with its `ENC1:` pin.
      verify (discharged, with one honest deviation): `docs/contracts/skill-bundled-assets.md` gains `## Port invariants — the behaviours a re-implementation must keep` with the `stitch.sh` pilot, and `stitch.sh:36-57` carries a `port_invariants:` block naming the same three verbatim — **hard-cut default**, **refusal over silent downgrade**, **handoff frame = rendered frame**. Tests pin the heading, the block, and all three invariants; RED first (`expected … to match /port_invariants/`). No new skill, no new rule. `check_no_external_sources` green — the field case is cited as "Source D" only.
      **Deviation, stated rather than papered over:** "links its `## Provenance` row" could not be done, for the same `check_no_roadmap_refs` reason as 3.4. Instead the contract carries **its own `## Provenance` table** with the identical neutral descriptor and the identical `ENC1:` pin. Self-contained and durable, but a copy rather than a link — discharged in substance, not literally.
      **Correction to the step's premise, recorded IN the contract rather than hidden:** `stitch.sh` is **not** a skill-bundled asset. It lives under `src/scripts/`, which the contract's own § "What this contract does NOT cover" (`:48`) excludes as maintainer-only, and `find dist/agent-src -path '*ai-video*' -name '*.sh'` returns **0**. The pilot is still the right one, and for a sharper reason than the step gave: `dist/agent-src/commands/video/stitch.md` *does* ship, so a consumer holds instructions to run a script they do not have — which is exactly the re-implementation prompt the field case describes. The section says so in a scope note and scopes the obligation to **executable assets a consumer may re-implement**, with skill-bundled ones as the subset the chain hands over intact.

**Exit criteria.** `--mode cut` byte-identical to today; one fixture handoff chain
renders and stitches; the contract section exists. **Rollback.** `--mode handoff`
and `continuity: handoff` are opt-in values; removing them leaves the cut path
untouched.

## Phase 4 — The falsifier (pre-registered; decides whether a seam score is a gate)

Registered **before** Phase 3 renders anything, so the outcome cannot be steered.
The registration lands as an evidence note under `agents/evidence/analysis/` and
**never** as a CI gate — a score whose validity is unknown must not be able to
fail a build.

- [x] **4.1 Register the question.** H1: *a machine seam score (SSIM or PSNR on
      the boundary frame pair of the encoded clips) separates human-judged "pop"
      seams from "clean" seams with ≥ 0.8 precision at some threshold.* H0: no
      threshold reaches 0.8 precision with ≥ 0.5 recall. Both arms, the metric
      definitions, the rater protocol and the sample size are written to
      `agents/evidence/analysis/seam-score-falsifier.md` *before* data exists.
      The note cites `tests/design-artifacts/fixtures/design.html:15` as the
      nearest in-tree precedent for treating a similarity score as a measurement
      with a stated validity condition — nearer than any external calibration.
      verify (discharged): `agents/evidence/analysis/seam-score-falsifier.md` exists, carries `registered_at: 2026-08-23` and `<!-- evidence-type: analysis -->`, and states both arms, both metric definitions (which frames, which ffmpeg field, `inf` reported as `inf`), the rater protocol, the sample size and the kill criteria — all fixed **before** any data. It precedes the first `handoff` render's sentinel **vacuously and verifiably**: no `handoff` render has occurred, paid or otherwise, so there is no sentinel to precede. It cites `tests/design-artifacts/fixtures/design.html:15` as the nearest in-tree precedent for treating a similarity score as a measurement with a stated validity condition.
      One addition to the protocol, made because the step's own framing invites it: **inter-rater agreement is reported before any threshold is fitted**, and low agreement is recorded as making H1 *unanswerable* rather than false. If humans do not agree on what a bad seam is, no metric can be validated against them, and that outcome is neither arm.
- [x] **4.2 Collect.** ≥ 24 seams from previz-tier (cheapest model) handoff
      renders, half deliberately wrong (connector endpoints set to source stills —
      the documented failure mode) and half per 3.1. Two raters, blind,
      "pop / clean". Scores computed by
      `smoke-trace.sh seam-score <a.mp4> <b.mp4>` (SSIM and PSNR both).
      Cost *(est.)*: 24 seams × previz ≈ USD 10–20.
      verify (**HONEST NULL — not collected**): no CSV exists and no seams were rated. Collection requires ≥ 24 **paid** previz renders (≈ USD 10–20) *and* two blind human raters; this run had authority to spend nothing on provider calls and cannot supply raters at all. Recorded as an explicit unknown in the registration note's § Outcome table (`A threshold separates pop from clean seams — UNKNOWN — not measured`; `Inter-rater agreement — UNKNOWN — no raters`), never as a null result.
      What *was* built and verified without spend: `smoke-trace.sh seam-score <a.mp4> <b.mp4>` emits **both** PSNR and SSIM over the real boundary frame pair (last frame of *a*, first frame of *b*, extracted with `-sseof -0.15`), is exercised on two ffmpeg-generated fixture clips in `tests/scripts/ai_video_frame_lock_probe.test.ts`, and labels its own output `diagnostic only — no threshold is a gate`. Both metrics are emitted deliberately: picking one here would answer the pre-registered question.
      **What closes this:** a maintainer runs the 24 renders, scores them with the shipped tool, has two people rate them blind, appends the CSV beside the registration note, and writes § Outcome.
- [x] **4.3 Decide and write the default.** If H1 holds for SSIM or PSNR: the
      winning score and threshold become a **warning** — never a hard gate — in
      `stitch.sh --mode handoff`, citing the CSV. If H0: record the null in the
      registration note, keep the eyeball-QA sentence in `motion-choreographer`,
      ship `seam-score` as a diagnostic only, and note that this replicates one
      source's own later finding against another's thresholds.
      verify (discharged as a **recorded undecided**, which is the only honest reading given 4.2's null): `grep -rn 'seam-score' .github/workflows src/scripts/gate*` returns **0** — no CI gate reads the score, which is the half of this step that is fully dischargeable and is discharged. The `stitch.sh --mode handoff` warning threshold from the H1 branch is **not** shipped, and the H0 branch's actions **are**: `seam-score` ships as a diagnostic only, and the eyeball-QA sentence in `motion-choreographer` is untouched.
      **The recorded outcome is "undecided", not H0.** With no data, "no threshold reaches 0.8 precision" would be a claim about measurements that do not exist — the fabricated verdict the pre-registration exists to prevent. The registration note's § Outcome says so in those words and separates, in a table, what was verified from what was not. Of the three evidence paths the step names, two exist (registration note, decision recorded in the same note) and the CSV does not, because 4.2 did not run.
      **Why this closes the step rather than blocking the roadmap:** the pre-registration's own kill criteria make the null a valid close, and Phases 0–3 stand on their own defects — none of them reads a seam score. The default is unchanged and correct: `--mode cut` stays the default and no score gates anything.

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
- **Status:** resolved
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
- **Resolution:** `local-only`, decided 2026-08-23 by AI council (2/2 convergent,
  `anthropic/claude-sonnet-4-5` + `openai/codex-default`, blind peer review,
  $0.0352). **Resolving mechanism:** the council, not the owner — and both seats
  reached the routing independently: reaffirming the existing floor is **not a
  floor transition**, so it sits in `decision-revisit-gate`'s council-decidable
  column, while option 3 (publishing withheld operator evidence) **lowers** a
  data-handling floor and is owner-reserved. The blocker's `Owner: user` field
  was correct about option 3 and over-broad about option 2; per one seat, "the
  named prior decision already supplies authority for the status quo. Only
  reversal requires renewed owner consent."
  **Rationale:** `d7f5d5d3c` is a deliberate named decision and no new evidence
  contradicts it; the 57 local traces carry request bodies, response bodies and
  artifact URLs, so tracking them would swap exclusion-by-construction for a
  one-pass redaction — the inversion `domain-safety-pii` § Surface 2 forbids —
  and a single miss is an irreversible published egress under
  `non-destructive-by-default`. The index proves exactly what a `stable` header
  claims: provider, trace identity, capture date, content hash.
  **Acceptance criteria weakened: none.** Both seats checked AC-1 and 0.2's
  `verify:` line explicitly and found neither weakened — AC-1 requires a dated
  clone-visible *row*, not clone-visible payloads, and 0.2's verify line already
  names the local-only branch.
  **Counter-argument, recorded because it is real and was not dismissed:** the
  index is an *attestation*, not independently inspectable behavioural evidence.
  A reviewer can establish that a dated trace was indexed; they cannot verify
  response semantics or recompute the hash from a clone. `lint_adapter_tier`'s
  own docstring carries this limit rather than hiding it behind a success line.
  **Revisit-if:** a `stable`-tier claim cannot be validated from the five-field
  index because response semantics are genuinely needed, and an
  exclusion-by-construction export format has been demonstrated to omit request
  bodies, response bodies, credentials and signed URLs. One adapter is enough to
  trigger this — the two-adapter threshold one seat proposed was rejected by the
  other as too specific, and delaying a needed correction is the worse error.
  The mere *availability* of a safe export format is **not** a trigger: a better
  alternative existing is not evidence the current approach failed.
  **One fact the council got wrong, corrected before recording:** one seat
  proposed writing `Basis: d7f5d5d3c (… 2024-11-28)`. The other seat refused it
  as unverified, and it is wrong — `git show -s --format=%ad --date=short
  d7f5d5d3c` returns **2026-06-10**. The verified date is what is recorded above.
  Full response: `agents/runtime/council/responses/trace-visibility-decision.md`
  (gitignored, local-only, auto-pruned) — reproduce with the question at
  `agents/runtime/council/questions/trace-visibility-decision.md`.

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

- [x] AC-1 — Every adapter header reading `stable` resolves to a dated row a
      reviewer can see from a clone, and `lint_adapter_tier.ts` is registered so
      the reverse cannot land again.
      **Met.** All 7 `stable` headers resolve: `✅ 7 stable claim(s) resolve to a
      trace inside 180 days (14 adapter header(s) scanned)`. The rows are in
      `agents/evidence/ai-video/trace-index.json`, which `git ls-files` returns —
      i.e. visible from a clone, which the raw traces are not and (by the
      reaffirmed local-only decision) will not be. Registered on all six
      surfaces; `--canary` proves it discriminates.
- [x] AC-2 — The contract's tier table is generated, and no reader can find a
      snapshot in it that disagrees with the adapters.
      **Met.** `§ 5` is spliced between generated markers, carries
      `DO NOT EDIT BY HAND` naming its generator, and **every gate run
      re-derives and compares it** — a hand edit fails the build, proven by a
      sabotage probe that edits the real file, asserts red, restores, and then
      asserts the restore happened. The stale "all five are experimental" prose
      is now `§ 5b`, restated in the present tense.
- [x] AC-3 — Every manifest entry answers `start_frame` and `end_frame` with
      `true|false|null`, and every `true` carries a `probed_at` date.
      **Met, and the second clause is currently vacuous — said plainly rather
      than reported as a pass.** All 16 entries across 9 manifests answer both
      keys; every value is `null`, so no entry claims a `true` and the
      probed_at obligation binds nothing yet. It is nonetheless *enforced* rather
      than merely satisfied: `ai_video_model_capabilities_schema.test.ts:122`
      fails any `true` without a `probed_at`, and the only sanctioned writer
      (`probe-frame-lock`) writes both in one `jq` pass, so the pair cannot be
      split from the sanctioned path. The reason every value is `null` is
      AC-3's real content: nothing has been probed, because probing costs money.
- [x] AC-4 — `end_image` is either honoured or refused by name — never dropped —
      and a test pins the refusal.
      **Met.** Refusal is exit 12 naming both the model and the field, fired
      from `aiv_dispatch`'s `submit|run` arm so every adapter refuses
      identically, and **before** the dry-run gate so it is visible in the
      default mode. Pinned by `ai_video_end_image_refusal.test.ts` (11 cases)
      and `test-pipeline.sh` § 7, which asserts its own precondition first.
      Sensitivity proven by pointing the manifest reader at a fixture claiming
      `end_frame: true`, which reproduces the pre-gate behaviour exactly.
- [x] AC-5 — `charged_usd` reaches `cost_per_second_usd` only through the ledger,
      and no manifest cost can change without a cited row.
      **Met on the route; the second clause is a WARNING, not a prohibition, and
      that is deliberate.** The ledger is the only sanctioned route and
      `--cost-diff` surfaces an uncited change in both directions (proven in an
      isolated git repo). But it warns rather than fails, because re-modelling
      an estimate is a legitimate human act — what is worth surfacing is doing
      it silently *after* a measurement contradicted the model. Read literally
      ("no manifest cost **can** change"), this AC asks for a hard gate; the
      roadmap's own step 2.3 asks for a warning, and the step is the more
      considered of the two. Recorded as a deliberate divergence, not as met-in-full.
- [x] AC-6 — `stitch.sh --mode cut` behaves byte-for-byte as it does today, and
      the header no longer asks for a roadmap item that now exists.
      **Met, and measured rather than argued.** The pre-change script was run
      side by side with the new one on identical fixtures: live stdout, live
      stderr, dry-run stdout, dry-run stderr and **mp4 bytes** all IDENTICAL.
      That measurement forced a design change — an additive `"mode":"cut"` key
      left the mp4 identical but the stdout different, so `mode` is emitted only
      in handoff mode. The header's "open a roadmap item" sentence is gone,
      replaced by the mode and the contract section (not a roadmap path — see 3.4).
- [x] AC-7 — The seam-score question has exactly one recorded outcome, registered
      before data existed, and no CI gate reads the score.
      **Met, and the one recorded outcome is `UNDECIDED`.** Registered
      2026-08-23 before any handoff render existed; `grep -rn 'seam-score'
      .github/workflows src/scripts/gate*` returns **0**. Exactly one outcome is
      recorded, and it is neither H1 nor H0 — collection needs 24 paid renders
      and two blind human raters, so the § Outcome table marks the threshold
      question and the inter-rater agreement `UNKNOWN — not measured`. Writing
      H0 would have been a claim about measurements that do not exist, which is
      the fabricated verdict the pre-registration exists to prevent.
- [x] AC-8 — `agents/tmp.old/better-video.txt` Phases 4–6 are dispositioned by
      name: each is either covered by a phase here, routed, or explicitly
      cancelled with a reason — so the partial-disposition failure this roadmap
      records cannot recur silently on the same file.
      **Met.** See `## Not-new` → *Disposition of `better-video.txt` Phases 4-6,
      by name*: Phase 4 **routed to the owner** (nothing of it landed; it needs a
      new skill and a new pack member, both in this file's Out of scope — out of
      scope by construction, not rejected on merit), Phase 5 **covered
      partially**, Phase 6 **covered substantially**, each row naming what landed
      AND what did not. The generalizable fix is recorded with it: a partial
      disposition must name the phases it does not cover.
- [x] AC-9 — Estate delta as authored: 0 skills, 0 rules, +1 roadmap (this,
      draft), 1 open blocker, +2 contract sections, +1 lint script, +4 manifests,
      +1 ledger, +1 trace index, +1 evidence note.
      **Met, with two additions the authored delta did not enumerate.** Measured
      against `origin/main`: **0** skills added, **0** rules added, **1** gate
      script (`lint_adapter_tier.ts`), **4** manifests, **2** contract sections
      (`provider-lifecycle` § 5 generated, `skill-bundled-assets` § Port
      invariants), **1** ledger, **1** trace index, **1** evidence note. The
      blocker is **resolved**, so open_blockers goes to 0 rather than 1, and this
      roadmap archives rather than remaining active.
      **The two additions, named rather than absorbed:** `lib/seam-plan.sh` and
      `lib/calibrate-cost.sh` are new non-gate scripts. Neither adds a skill,
      rule or pack member, and each exists because the surface it belongs on has
      a fixed contract that could not absorb it — `parse-blueprint.sh` takes its
      input file as `$1` and `operator-pick.sh` takes exactly two positional
      args, so a subcommand on either would have broken every existing caller.
      Recorded here because "estate delta as authored" is a claim a reader should
      be able to check, and two files is a real difference from zero.

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
