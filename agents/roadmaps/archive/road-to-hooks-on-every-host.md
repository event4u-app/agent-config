---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "lane 7 of road-to-leading-every-row"
relates:
  - slug: road-to-host-catalogue-contract
    relation: extends
    note: "parked; the per-row verified block this lane fills is its catalogue shape"
  - slug: road-to-delivery-for-every-host
    relation: extends
    note: "archived 30/30 — rule delivery to every host; this lane is about lifecycle slots, which it left at 0 for codex/copilot"
---
# Road to hooks on every host

> **Source:** ten-package code audit (2026-09-28), rows Host portability 5,
> Gate reachability 4 against S8 at 8 (one hook script serving four hosts)
> and S9 at 7 (21 capability descriptors with cited evidence). Tree facts at
> `8de8a4c`: `src/scripts/hooks/host_lowering.yaml` (185 lines) has rows for
> `claude, augment, cursor, cline, windsurf, gemini, cowork, copilot` — **no
> `codex` row** (deliberate, `docs/enforcement-by-host.md:176-179`, no
> `platforms.codex` in `hook_manifest.yaml:1368-1556`); `verified:` is a
> per-row block `{docs_at, docs_url, probe_at, host_version, expires}`
> (`:57-62`), filled for claude only (expires 2027-09-06), `null` on seven
> rows; the expiry/unverified gate is `lint_hook_manifest._check_host_lowering`
> (`:664-690`); claude configures refusal on 3 of 32 host×slot pairs
> (`enforcement-by-host.md:38,193`); `install.ts:1579-1605` already runs a
> per-platform `smokeProbeEvents()` from `host_lowering.yaml`.

> **corrected-from-reproduction (2026-09-29, /analyze:inbox t06).** The supplied
> file was reproduced against `main` read-only. Every `file:line` in its Source
> block resolved. ONE correction applied: the Risk Register `Risk type` column
> used values outside the enum `lint_plan_risk_register` enforces (`product` |
> `implementation`), which `status: draft` exempts and which reds the file the
> moment it flips to `ready`. The column is normalised; nothing else changed.

## Goal

Every row in `host_lowering.yaml` carries a dated `verified:` block in the
existing shape; every slot has a dated answer (`block_exit` set or a
documented `null` with `docs_url`); a codex row exists if and only if the
host documents lifecycle hooks; and the install smoke probe covers every host
with slots > 0 — so a "0" in the enforcement table is a fact about the host
with a date on it.

## Prerequisites

- Lane 2 Phase 1 landed (edits to `host_lowering.yaml` go through the
  ratified-edit path).

## Phase 1 — Fill the verified blocks

- [x] **1.1 Probe and fill the seven `null` rows** (augment, cursor, cline,
      windsurf, gemini, cowork, copilot) using the existing keys `docs_at`,
      `docs_url`, `probe_at`, `host_version`, `expires`; `expires` follows the
      host's own docs cadence (claude's committed value is 2027-09-06 — no
      blanket 90 days). Cowork's block records what its row comment already
      says (`:165-166`: dispatcher exits 0 unconditionally, host cannot read
      settings).
      verify: `lint_hook_manifest` green; `grep -c 'verified: null' host_lowering.yaml`
      is 0; `tests/scripts/host_lowering_expiry.test.ts` unchanged.

      **Evidence (2026-10-01).** Already satisfied at `9f2b9fb4a` by commit
      `d28ce587a`, verified rather than assumed: all **nine** rows (the seven
      above plus `claude` and a `codex` row that did not exist when this step
      was written) carry a `verified:` block with `docs_at`, `docs_url`,
      `expires`. `grep -c 'verified: null' src/scripts/hooks/host_lowering.yaml`
      → **1**, and `grep -n` shows the single hit is line 13 of the header
      prose (`\`verified: null\` means nobody established anything`), not a row —
      so the row count is 0 as the step requires. `lint_hook_manifest` exits 0
      with **7** warnings, all of them the admissible-but-not-fully-cited
      `verified.host_version is null` note (8 before the codex probe filled
      that row's `host_version`). `host_lowering_expiry.test.ts` is
      unchanged and its 6 tests pass. Cowork's block records exactly what the
      step predicted: `docs_url: null` with the comment stating no public hooks
      page exists to cite.
- [x] **1.2 Every slot has a dated answer.** For each host×slot pair with
      `block_exit: null`, add `answered_at:` and `docs_url:` beside it, or set
      `block_exit`. The bar is "every pair dated", not a refusal count.
      verify: `check_enforcement_matrix --write` regenerates
      `docs/enforcement-by-host.md`; no pair without a date.

      **Evidence (2026-10-01).** Already satisfied at `9f2b9fb4a`, and the bar
      is enforced rather than merely met: `lint_hook_manifest._check_slot_answers`
      makes an undated pair an **error**, not a warning, and the gate is green —
      so "no pair without a date" is now a property the tree refuses to lose,
      not a state this step left behind. `check_enforcement_matrix` reports
      `32 host-slot row(s) in docs/enforcement-by-host.md match
      src/scripts/hooks/host_lowering.yaml`, and every one of the 32 generated
      rows carries an `Answered` cell of `2026-09-29` — no `undated` sentinel
      anywhere in the region. Re-running with `--write` produced no diff, which
      is the stronger reading of "regenerates": the committed table was already
      the generator's output.
- [x] **1.3 Docs digest beside `docs_at`.** Every `verified:` block gains
      `docs_digest: <sha256 of the fetched docs_url body>`; a scheduled job
      (the scorecard workflow of lane 9 § 4.2, or a sibling) re-fetches each
      `docs_url` and, on a digest change, sets `expires: <today>` so the
      existing `lint_hook_manifest._check_host_lowering` (`:685-712`) goes
      red on any blocking binding of that host. No lifecycle vocabulary, no
      auto-adoption of upstream text — a red gate opens a local finding.
      Vendor docs URLs are not harvest subjects and stay plaintext.
      verify: fixture with a changed digest → `lint_hook_manifest` red on the
      bound host; unchanged digest → green; the job's run is committed once.

      **Evidence (2026-10-01).** Landed in four pieces.

      *The watcher.* `src/scripts/check_host_docs_digest.ts` — the consumer the
      table header already named and which did not exist, so the header was a
      forward reference to nothing. Four modes: a no-network offline report,
      `--fetch` (compare, exit 1 on drift), `--fetch --write` (record), and
      `--self-test`. Unknown flags exit 2 naming the known set.

      *The digests.* `--fetch --write --today 2026-10-01` filled **8** of 9
      rows; `cowork` stays `null` because its `docs_url` is `null` and there is
      no body to hash. The write is **8 changed lines, nothing else** —
      `git diff --stat` reported `8 insertions(+), 8 deletions(-)`. That is a
      deliberate property: a `parseDocument` round-trip was tried first and
      **rejected after measurement** — it preserves every comment but
      renormalises the hand-aligned `slots:` flow mappings (361 bytes across 32
      rows), so the watcher now edits only the lines whose content changes and
      nothing else. After completion review that is **one** line on a drift,
      not two: a drifted row keeps its recorded digest, because overwriting it
      would both assert a reading that never happened (`docs_at` stays put) and
      erase the drift signal — the next run would compare new-against-new and
      report `unchanged`, so a human who missed one red week would never learn.

      *Reproducibility, checked rather than assumed.* The obvious failure mode
      for a digest watcher is a page carrying a build id or timestamp, which
      makes it permanently red and then muted. A second independent `--fetch`
      returned **8 unchanged, 0 changed**, so none of the eight pages is
      volatile at this granularity.

      *The chain, and its sensitivity.* `tests/scripts/host_docs_digest.test.ts`
      (20 tests) runs the **real** `lint_hook_manifest._check_host_lowering`
      over the **real** writer's output — the verify line's "fixture" is only
      the fetched body, because that is the single input a unit test may not
      reach. Drift on `claude` (the one host with blocking bindings) reds the
      gate naming `claude/any`, the new `expires`, and `pre_tool_use`; drift on
      `cursor` (binds 5 slots, can refuse on none) only warns; unchanged and
      unreachable both leave the table byte-identical. **Seen red twice, for
      two different reasons:** first a genuine defect in the test itself (it
      asserted a no-op write using a digest that was never the committed one,
      so it was not testing a no-op at all), then deliberately — neutralising
      `isDrift` turns **4 of 20** red, which is the sensitivity proof. (The
      figure was re-measured against the final suite each time the suite grew,
      rather than left at the 3-of-12 reading taken mid-branch — a completion
      reviewer caught the first stale count, and a sensitivity ratio quoting a
      suite that no longer exists is exactly the kind of number this roadmap
      spent its length objecting to.)

      *Correction to this step's own text, recorded not smoothed.* The step
      says the job "sets `expires: <today>`". That is **off by one** and would
      not fire: the gate tests `expires < today`, so `expires: <today>` is still
      valid today. The table header (lines 56-64) already states the correct
      rule — the day BEFORE detection — and the watcher follows the table. The
      test `expires to the day BEFORE detection` pins the off-by-one explicitly
      by showing the same-day value leaves the gate green.

      *The job.* `.github/workflows/host-docs-digest.yml` — weekly (Mon 06:17
      UTC), `permissions: contents: read`, read-only `--fetch` with no `--write`
      and no PR-opening step. Weekly rather than daily because the rows carry
      year-long `expires` values, so a daily run would spend 7× the vendor
      requests for the same finding. `--strict-fetch` is deliberately **not**
      passed: a 503 or an egress-less runner establishes nothing about the page,
      and a watcher that reddened on every flake would be muted within a month.
      The job never writes the table — adopting upstream text automatically is
      the one thing this package must not do, so a red means "go read a page".

## Phase 2 — Codex and copilot: a row only with evidence (D5)

- [x] **2.1 Host documentation check, recorded.** Read the hosts' own hook
      documentation for codex and copilot (vendor docs are not harvest
      subjects; plaintext `docs_url` is fine); record the result as a
      `## Decisions` row here.
      verify: D1 below carries `resolved by: evidence` with the `docs_url`.

      **Evidence (2026-10-01).** D1 now names the citation of record instead of
      the forward reference "`docs_url` recorded in 2.1". Both pages were
      re-fetched live today (HTTP 200) and both are digested into
      `host_lowering.yaml`, so the citation is pinned to a body rather than to a
      URL that can be rewritten under it.

      *Why D1 points at the row rather than pasting the two URLs.* It pasted
      them first, and `check_no_external_sources` went red: its shape heuristic
      reads `github.com/<owner>/<repo>` by FORM, so the Copilot docs URL parsed
      as a repo slug `en/copilot` and counted as an un-allowlisted external
      source reference — 149 against a ratchet baseline of 148. The gate is
      right that the shape is indistinguishable; it is wrong only about this
      instance, and the fix is not to widen an allowlist for a false positive.
      Keeping the URLs in exactly one place — the `verified:` block that is
      already the authoritative, digested citation — removes the duplicate that
      could drift anyway. `check_no_external_sources` is back to 148/148.

      **Both hosts document lifecycle hooks, so D1's "otherwise a dated zero"
      branch does not fire for either.** Codex documents `SessionStart`,
      `SessionEnd`, `SubagentStart`, `SubagentStop`, `PreToolUse`,
      `PermissionRequest`, `PostToolUse`, `PreCompact`, `PostCompact`,
      `UserPromptSubmit`, `Stop` and `Interrupt` at `~/.codex/hooks.json`;
      Copilot documents `sessionStart`, `sessionEnd`, `userPromptSubmitted`,
      `preToolUse`, `postToolUse`, `agentStop`, `subagentStop` and
      `errorOccurred` at `~/.copilot/hooks/*.json`. The claim this tree already
      carried — that codex's refusal contract "matches Claude Code's" — was
      checked against the live page rather than inherited: the page does state
      `permissionDecision: "deny"` plus "You can also use exit code `2` and
      write the blocking reason to `stderr`". The documentary claim is correct.
      Whether the host honours it is step 2.2, and the answer there is not the
      one the documentation implies.
- [x] **2.2 If codex exposes lifecycle hooks:** add `platforms.codex` to
      `hook_manifest.yaml`, a `codex` row to `host_lowering.yaml` with a
      `verified:` block, `src/scripts/hooks/codex-dispatcher.sh` in the shape
      of the six existing shims (65–117 lines), the trampoline constant in
      `install.ts` (`*_DISPATCHER_TRAMPOLINE`, `:911-1283`) and the deny
      shape in `host_semantics.ts`. If not: the enforcement table's codex row
      gets `answered_at` and the `docs_url` that says so.
      verify: either `tests/hooks/permission_decision.test.ts` gains a codex
      deny fixture and the install smoke covers codex, or the dated zero.

      **Evidence (2026-10-01). The dated zero, and it is now backed by a probe
      rather than by a reading.**

      *Why this branch, when the documentation indicated the other one.* The
      step branches on "does codex expose lifecycle hooks", and the answer from
      the documentation is yes — which points at the first branch: arm it, with
      a deny fixture. That branch was **refuted by measurement before it was
      written**. `codex` is installed on the machine running this pass
      (`codex-cli 0.148.0`), so for the first time the documented contract could
      be run instead of quoted:

      - an isolated `CODEX_HOME` was given a `hooks.json` binding `PreToolUse`
        with `matcher: "Bash"` to a script writing to stderr and exiting 2 —
        the documented refusal path, verbatim;
      - `codex exec --sandbox read-only "Run the shell command: echo …"`
        **executed the call and returned its output**. It was not refused;
      - the feature is not off: `codex features list` reports `hooks  stable
        true` on this build.

      A "codex deny fixture" would therefore have asserted a behaviour this
      tree has measured as absent. Writing it is not a harder version of the
      work — it is a false test, and the first branch is unavailable for that
      reason rather than for difficulty.

      *What the probe does NOT establish, stated because the opposite reading is
      the failure this roadmap family exists to fix.* It does not show codex
      cannot refuse. Two explanations survive: the installed build is 0.148.0
      against a current 0.159.3 and the page read describes the current one; and
      the probe never separated "the hook fired and was ignored" from "the
      matcher never matched", because the instrumented re-run — a hook recording
      its own stdin before refusing — was blocked by the harness this pass ran
      under. Both are recorded in the row, with the one cheap experiment that
      would separate them named: a marker-file re-run on >= 0.159.3.

      *What landed.* `probe_at: 2026-10-01` and `host_version: 0.148.0` on the
      `codex` row, with the finding in the row's own comment; `slots: {}` and
      `block_exit` unarmed, which is what a null means here; D2 added recording
      that a documented refusal does not arm a binding, with its revisit-if; and
      `docs/enforcement-by-host.md`'s **"No row for Codex, and that is the third
      kind of absence"** paragraph corrected — it had gone false when the codex
      row landed and was contradicting the generated region's own trailer two
      paragraphs below it. The slot count stays 0 because
      `hook_manifest.yaml`'s `platforms:` block still declares eight hosts and
      not codex — verified, not assumed.
- [x] **2.3 Same for copilot** (today `platforms.copilot: {ask: text,
      fallback_only: true}`, `hook_manifest.yaml:1554-1556`).
      verify: as 2.2.

      **Evidence (2026-10-01). The dated zero, documentation-only, and the
      reason it is documentation-only is recorded rather than left blank.**

      Copilot documents lifecycle hooks — `sessionStart`, `sessionEnd`,
      `userPromptSubmitted`, `preToolUse`, `postToolUse`, `agentStop`,
      `subagentStop`, `errorOccurred` at `~/.copilot/hooks/*.json`. The page
      was re-fetched today (HTTP 200) and digested. So, as with codex, D1's
      "otherwise a dated zero" condition does not fire on the host's
      documentation.

      **Correction, and it is the most important line in this step.** This
      paragraph first ended "...with `preToolUse` fail-closed on exit 2" — a
      claim inherited from the row's existing comment rather than invented
      here. The completion review fetched the cited page, which hashes
      byte-identical to the committed `docs_digest` (so the body checked is
      provably the body pinned), and grepped it: it carries **no exit-code
      semantics whatsoever** — no `exit 2`, no non-zero convention, no stderr
      contract. What it documents is the *capability*, `preToolUse` "can
      approve or deny tool executions", plus a config shape. The mechanism is
      simply not on that page.

      A capability is not a contract, and writing the contract in anyway is
      exactly the unestablished host claim this roadmap family exists to
      eliminate. It survived two readings here before anyone fetched the page —
      which is the sharpest available argument for why `docs_digest` had to
      exist at all, and why the digest alone is not enough without someone
      reading what it pins. Corrected at the row, here, and in D2's evidence.

      **`probe_at` stays null, and that is an absence of opportunity, not of
      effort.** `command -v copilot` → not installed, and `~/.copilot` carries
      no binary, so there is no host on this machine to run a deny against.
      This is the one externally-imposed limit in this roadmap: a CLI that does
      not exist here cannot be probed. The row now says so in its own comment,
      next to `probe_at: null`, so the null reads as "could not look" rather
      than as "did not bother".

      **The codex probe is why this row must not be armed from its page alone**
      — and the argument is weaker than first written, which is the honest
      version. It first read "two hosts documented the same exit-2 refusal
      contract"; only codex documents one. On codex a documented exit-2 refusal
      did not reproduce on the installed build; here there is no documented
      exit-2 contract to arm at all, so this host is *further* from a binding
      than codex rather than equally close. Arming copilot from a reading —
      having just watched a reading fail on its sibling, and having just caught
      this row asserting a mechanism its own citation never stated — would be
      the exact defect `host_lowering.yaml` was built to stop. The row stays
      `slots: {}` with a dated, cited, digested `verified:` block; D2 carries
      the rule and the revisit-if.

      **What was also removed here.** The copilot row's comment pointed binding
      work at `road-to-hooks-on-copilot-and-codex` — a roadmap that does not
      exist anywhere in the tree. A dangling pointer to a plan nobody wrote
      reads as "tracked elsewhere" and is worse than silence, so it is replaced
      by the actual gating condition. The work it named is now D2's revisit-if,
      which is the right instrument: a roadmap whose first step is "wait for a
      vendor build" is not executable, and a decision with a named reopening
      condition is.

## Phase 3 — Smoke covers every bound host

- [x] **3.1 Assert `smokeProbeEvents()` reaches every host with slots > 0.**
      Extend `tests/install/global_install_hooks_smoke.test.ts` to iterate
      `host_lowering.yaml` rows and fail on a bound host the probe skips.
      verify: test green; a fixture row with slots > 0 and no probe path is red.

      **Evidence (2026-10-01).** Three tests added to
      `tests/install/global_install_hooks_smoke.test.ts`; all green, and the
      existing 200s install smoke is untouched.

      *What was actually missing.* `install_snapshot.test.ts` already asserted
      that every event `smokeProbeEvents()` names IS bound — the **soundness**
      half, "the probe invents nothing". The **completeness** half was checked
      by nothing: a host added to `host_lowering.yaml` with five bound slots and
      never added to `SMOKE_PROBE_SLOTS` passes every pre-existing test, because
      nothing enumerated the table and asked what the list was missing. The
      probe would be correct about everything it mentioned and silent about a
      whole host, which reads as green.

      *Sensitivity, proven on the real file rather than argued.* A `session_start`
      slot was temporarily added to the `codex` row in the committed table and
      the test run: it failed with exactly its intended message —
      `host_lowering.yaml binds slots for codex but the install smoke probe
      never exercises them`. The table was then restored and the tests re-run
      green. A third test carries the same case as a permanent in-process
      negative control, so the assertion cannot be satisfied by today's table
      alone, and a second asserts the converse (nothing with `slots: {}` is
      probed) so it cannot be satisfied by probing everything.

      *One hole found, noted rather than fixed — per `active-remediation`'s
      note tier.* Being in `SMOKE_PROBE_SLOTS` is only **half** of being probed:
      `_smoke_test_hooks` resolves `SMOKE_BRIDGE_PATHS[platform] ?? ''` and
      counts a platform with no entry as `skipped`, so a host could be listed as
      probed and silently never exercised. There is **no live instance** (all
      six listed platforms have a bridge path today), so this is latent. It was
      deliberately not closed here: the constant is unexported, and exporting it
      edits `src/scripts/install.ts`, which reds two committed-build-output
      freshness gates (`build:cli` + `build:install-bundle`) and requires the
      bundle to be rebuilt against a real `node_modules` — this run is in a
      worktree whose `node_modules` is a symlink, which bakes absolute paths
      into the shipped bundle. Paying that for a latent hole is the wrong trade;
      it is recorded in the test file's own comment so the next reader meets it
      instead of rediscovering it.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | deterministic | evidence | Codex/copilot rows are added only if the host's own documentation names lifecycle hooks; otherwise a dated zero | Both hosts document them, so both get a row. The `docs_url` of record is the one on each host's `verified:` block in `host_lowering.yaml` — codex's is the OpenAI developers' Codex hooks page, copilot's is GitHub's own Copilot hooks page. Both were re-fetched 200 on 2026-10-01 and are now pinned by `docs_digest`, so the citation is bound to a body rather than to a URL that can be rewritten under it | the host publishes hooks |
| D2 | deterministic | evidence | A documented refusal contract does **not** arm `block_exit`; only a reproduced one does | The codex live probe of 2026-10-01 (`codex-cli 0.148.0`): the documented `PreToolUse` exit-2 deny did not block the call, with `hooks` reported `stable true`. Corrected after review — only **codex** documents an exit-2 contract; the copilot page documents the capability and no mechanism, so copilot is further from a binding, not equally close | a probe on `codex` >= 0.159.3, or on a Copilot CLI once installed, reproduces a documented deny |
| D3 | deterministic | evidence | A digest pins a body; it does not read it. A page may be cited, digested and still not say what the row claims | The copilot row asserted `preToolUse` "fail-closed on exit 2" for two readings. The review fetched the pinned body — digest matching byte-for-byte — and found no exit-code semantics at all | someone proposes a host claim whose only support is that the citation is digested |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-28 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Host docs change after the block expires | implementation | A bound slot stops firing | `lint_hook_manifest._check_host_lowering` already refuses an expired row carrying a blocking binding | Phase 1 — Fill the verified blocks |
| 2 | Network needed to read vendor docs | implementation | 2.1 cannot run offline | Class-1 blocker if the run is offline; the step records the URL, not the page | Phase 2 — Codex and copilot: a row only with evidence (D5) |

## Acceptance Criteria

- [x] AC-1 — No `verified: null` in `host_lowering.yaml`; `lint_hook_manifest`
      green.

      **Evidence (2026-10-01).** All 9 rows carry a `verified:` block; the only
      `verified: null` string in the file is line 13 of the header, which is the
      sentence defining the term. `lint_hook_manifest --as-of 2026-10-01` exits
      0 with **7** warnings, all of them the admissible
      `verified.host_version is null` note — down from 8, because the codex row
      now carries `0.148.0` from the live probe.

- [x] AC-2 — Every host×slot pair carries `block_exit` or a dated `null` with
      `docs_url`; the enforcement table regenerated; every `verified:` block
      carries `docs_digest` and the re-fetch job has run once.

      **Evidence (2026-10-01).** All 32 pairs dated — and enforced, not merely
      met: `_check_slot_answers` makes an undated pair an error and refuses a
      dated answer with no reachable citation. `check_enforcement_matrix --write`
      reports `already current`, i.e. regeneration is a no-op against the
      committed table. The re-fetch job has run twice: once with `--write` to
      record 8 digests, and once read-only, which returned 8 unchanged and so
      also demonstrates the digests are reproducible rather than volatile.

      **One honest subtraction from "every `verified:` block carries
      `docs_digest`": `cowork` does not, and must not.** Its `docs_url` is
      `null` because the 2026-09-29 sweep found no public hooks page for that
      host, so there is no body to hash. A digest there would be invented, which
      is the one thing this table refuses. The criterion is met as "every block
      that cites a page carries the digest of that page", 8 of 8, and the ninth
      is a `no-url` the watcher reports and skips by design. A test pins both
      halves so the exception cannot quietly become a gap.

- [x] AC-3 — Codex and copilot each have a row with a verified block or a
      dated zero, per D1.

      **Evidence (2026-10-01).** Both rows exist with dated, cited, digested
      `verified:` blocks and `slots: {}`. Codex additionally carries
      `probe_at: 2026-10-01` / `host_version: 0.148.0` from a live deny probe;
      copilot's `probe_at` stays null with the reason recorded (no CLI on this
      machine). D1 carries both URLs; D2 records the rule the probe produced —
      a documented refusal does not arm a binding, only a reproduced one does.

- [x] AC-4 — The install smoke test iterates every bound host.

      **Evidence (2026-10-01).** Three tests in
      `tests/install/global_install_hooks_smoke.test.ts` iterate
      `host_lowering.yaml` and assert the probe covers every host with
      `slots > 0`, covers nothing with `slots: {}`, and would fail on a newly
      bound host. Sensitivity proven by temporarily binding a `codex` slot in
      the real table and watching the assertion fail with its intended message.

## Provenance

Source-derived (template rule 19). Pre-council draft.

| Descriptor | Token | Drawn in, per defect |
|---|---|---|
| S9 — phase-loop reference | `ENC1:<mint>` | per-host capability descriptors with cited evidence and expiry (defect: seven null rows) |
| S8 — LSP toolkit reference | `ENC1:<mint>` | one hook script, four hosts by event-name translation (2.2's shim shape) |
| S6 — spec-scaffolding reference | `ENC1:<mint>` | negative control: 41 hosts as config dicts with untested behaviour |
| S7 — best-practice curation | `ENC1:<mint>` | upstream doc-drift checklists against official host docs (1.3's digest watcher is the machine-owned form) |

Gap-table: KEEP 1.1–1.2, 2.1–2.3, 3.1; CUT "per-slot verified schema"
(shape is per-row with seven consumers), "`lint_host_lowering`" (the gate is
`lint_hook_manifest`), "refusal on ≥ 6 of 9 slots" (pre-commits a probe
result), "per-host CI matrix" (`tests.yml:66-74` is os×shard; the smoke probe
is in `install.ts`).
