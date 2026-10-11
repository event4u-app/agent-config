---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "No active, parked or stub roadmap owns what session content carries toward a model provider: the seven active roadmaps cover authority, routing, install thinning, blocking time, corpus cadence, decision closure and self-modification, and the two nearest archived owners (road-to-a-sanitize-list-that-is-generated, inbound codepoints; road-to-hooks-on-every-host, slot bindings) are closed. Archiving an unrelated roadmap to make room would retire live work and leave the outbound path as open as it is."
estate_growth_exempt: "Grows active_roadmaps by one, as the first of a two-roadmap set landed from one inbox round: this file holds everything this package can prove on bytes it writes itself, and road-to-placeholders-on-the-wire holds the host-carrier half that depends on it. Adds no blocker."
relates:
  - slug: road-to-a-sanitize-list-that-is-generated
    relation: disjoint
    note: "Archived. That floor strips invisible codepoints from content coming IN; this one replaces visible values going OUT. Only its strip-then-rescan helper is reused (2.5)."
---
# Road to one detector and the senders we own

> **Source:** `agents/tmp.old/inbox-2026-10-g/` — one owner turn asking that an
> e-mail address, phone number, IBAN, password or token entering a session reach
> an external model provider only as a typed placeholder, plus five agent-authored
> plan generations and two source annexes. Every tree fact below was re-read at
> `main@d41121927` (v16.4.0) on 2026-10-11; the plans were pinned at `4d60b86`
> (v16.1.0) and none of their defects was fixed in the 598 commits between.

The owner's constraint, stated once in the transcript and nowhere in the plans'
goals:

> "So dass wir nicht an externe KI-Anbieter sensible Daten, Passwörter, Tokens, etc. senden." <!-- md-language-check: ignore -->
> (*So that we do not send sensitive data, passwords, tokens and the like to external AI providers.*)

This roadmap discharges that constraint on the one class of channel where it can
be **proven** rather than hoped for: requests this package writes itself. The
host-carrier half — tool results, tool inputs, the typed prompt, a request
gateway — is `road-to-placeholders-on-the-wire`, and it builds on what lands here.

## Context — reproduced on this tree

| # | Defect | Evidence at `d41121927` | How it was checked |
|---|---|---|---|
| F1 | The council bundler leaks and over-redacts at once. An e-mail, an IBAN, a phone number, a connection URI with an inline password and a GitHub-shaped PAT leave unchanged; the line `const token = getToken();` is replaced whole. | `src/scripts/ai_council/bundler.ts:81-88` (six line patterns, no identifier class) | `bundler.redact` executed on a synthetic sample — reproduced |
| F2 | Credential detection is duplicated and disagrees. An `sk-ant-api03-…`-shaped key is `high` in `secret_detector` and passes `workspace_secrets.scrub` and `explain_last/scrubber.scrub_string` unchanged. | `src/scripts/_lib/secret_detector.ts:215`; `src/cli/python/workspace_secrets.ts:57-64`; `src/scripts/_cli/explain_last/scrubber.ts:105`; plus `bundler.ts:81-88`, `ai_council/config.ts`, `lint_mcp_config_security.ts`, `cross_repo_retrieve.ts` | the three modules executed on one synthetic key — reproduced |
| F3 | The only identifier patterns are unvalidated and not replacement-grade; `secret_detector` has no identifier class and its finding carries no span end. | `src/scripts/cross_repo_retrieve.ts:77-87` and its twin `src/cli/python/knowledge_ingest.ts:228-235` | the tree's own phone and card regexes over 12,729 tracked text files: 32,743 phone hits, 393 card hits of which 49 pass Luhn — **diverged** from the plan's 5,267 / 210 / 36 over ~6.8k files (the tree grew), same conclusion |
| F4 | No host-native prevention is written. The installer emits no `permissions.deny Read(…)` entry and no hook concern refuses a credential-file read. | 0 hits for a permissions deny in `src/install/` and `src/scripts/install.ts`; `src/scripts/hooks/block_*.ts` covers config weakening, kernel writes, `--no-verify`, plumbing and inbox naming only | grep |
| F5 | The threat model has no row for session content travelling to a model provider and opens by saying the package "holds no user data". | `docs/threat-model.md:5`, rows a–i at `:19-27` | read |
| F6 | The PII rule tells the model too late — "Replace any pasted PII with placeholders **before** drafting" — and declares no `enforced_by`. | `src/rules/domain-safety-pii.md:67` | read |
| F7 | The tree holds two positions on a detected value and no rule for which applies: one module "never rewrites", another masks because its surface "cannot refuse to produce output". | `src/scripts/ai_council/redact_low_impact_entry.ts:39`; `src/scripts/_cli/explain_last/scrubber.ts:13`; `src/scripts/knowledge_global_cli.ts:301` (`halt_on_trigger` defaults true) | read |
| F8 | Nothing lists what this package itself sends to a model provider. Senders exist in at least the council clients and transport, the trigger routers, the second-brain runner and retrieval, two RDP evaluators, the proposer transport and the image adapters; no table says which carry session content. | `src/scripts/ai_council/api_transport.ts`; `src/scripts/_lib/trigger_routers.ts`; `src/scripts/second_brain_run.ts`; `src/scripts/rdp_quality_eval.ts`; `src/scripts/_lib/llm_proposer_transport.ts`; `src/scripts/ai-image/adapters/` | existence verified; the plan's count (eight modules, 14 adapters) **not** re-derived — step 0.4 derives it |
| F9 | The placeholder spelling named in the goal does not survive the surfaces a token travels through. `[IBAN_1]` becomes a glob in an unquoted shell word (expanded against files `I`, `B`, `N`, `_`, `1`), a one-item list in YAML, and a character class in a regex; `⟦IBAN_1.495cff⟧`, `__IBAN_1__` and `__AC_IBAN_1_S7K3_Q9M2__` survive all four checks. | — | bash, the `yaml` package, JSON round trip and an anchored `RegExp` — reproduced; a first unanchored regex check passed `[IBAN_1]` by matching one character and was discarded as too easy |

One constraint binds every step though it is not this roadmap's defect: the
hook-latency budget's revisit trigger fired on 2026-09-30 and is recorded, not
spent (`src/config/hook-latency-budget.json:62`). Nothing here adds a dependency
to the hook bundle; the detector is pure TypeScript with no I/O.

## Goal

On every request this package writes to a model provider itself, no value of a
listed type leaves in plaintext, and a final check over the outbound body —
whose removal turns a canary red — says so. One rule table is the only place a
credential or identifier pattern is defined, and every consumer that detects
one reads it. Credential-class files cannot be read through a hooked tool on a
host that honours a deny, and the installer writes the host's own deny entries.
The placeholder grammar is one constant, chosen by a pre-registered measurement,
and the contract states what each of four published states — `asserted`,
`replaced`, `gated`, `uncovered` — proves.

## What this roadmap deliberately does not do

| # | Not done | Why |
|---|---|---|
| N1 | Call any of this anonymisation, or claim coverage of meaning. | A local mapping can restore the value; that is pseudonymisation. A sentence that identifies a person or customer without a recognisable span is not covered and is reported as the implicit-identity residue. House precedent: `src/scripts/ai_council/leakage_patterns.ts` labels a regex pass `pattern-stripped`, never `identifier-free`. |
| N2 | Ship a name or address recogniser, an ML model or a Python sidecar. | Node-only product; free-text names need a semantic detector whose smallest local model is hundreds of MB. Names enter only through the lists the redactor already accepts (`redact_low_impact_entry.ts:273-278`). |
| N3 | Let entropy alone trigger a replacement. | Entropy stays a flag; its false positives are tolerable in a warning and destructive in a replacement. |
| N4 | Replace values with realistic fakes. | A fake IBAN can be someone's real IBAN. |
| N5 | Send content to an external redaction service, or verify a found credential over the network. | Either transmits the value in order to keep it from leaving. `secret_detector.ts` is already pure; it stays so. |
| N6 | Copy code from any reference implementation. | Several are source-available or copyleft. Shapes are drawn in; code is not. |
| N7 | Add CLI entries for scan, redact, doctor or test. | `hooks:status`, `hooks:doctor`, `hooks:effect` and `hooks:replay` exist (`src/cli/registry.ts:89-96`) and every registry entry is budget-gated. |
| N8 | Cover a channel this package does not write. | Host channels are `road-to-placeholders-on-the-wire`; until it lands they are published `uncovered`. |

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | Own estate stem, split in two: bytes this package writes (here) and host carriers (`road-to-placeholders-on-the-wire`) | 7 active roadmaps at `d41121927`, none owns outbound values; the split puts every `asserted` proof before any host contract is needed | a later roadmap takes ownership of outbound values |
| D2 | reversible-technical | agent | The typed counter the goal asked for is kept; the bracket delimiter is not | F9, reproduced: `[IBAN_1]` fails three of four surfaces. The owner's form was an example ("z.B."), not a constraint <!-- md-language-check: ignore --> | — |
| D3 | contested-technical | evidence | Which surviving spelling becomes the grammar — `⟦TYPE_n.fp⟧`, `__TYPE_n__` or a namespaced wire form with a separate display label — is decided by the model-fidelity bar of 0.3, not by taste | F9 narrows the field to forms that survive; no study of model copy fidelity per delimiter was found | the bar reports no spelling above its threshold |
| D4 | reversible-technical | agent | Refuse where content has not yet moved, replace where it has | Reconciles F7's two house positions under one rule | — |
| D5 | reversible-technical | agent | Credentials and identifiers are two classes with opposite restore policies; a credential value is never stored | A local edit of a file holding a credential can re-derive the value from that file; nothing else needs it | — |
| D6 | reversible-technical | agent | Settings block `egress.placeholders`, not `privacy.egress` | A key named "privacy" reads as the guarantee N1 exists to avoid | — |
| D7 | reversible-technical | agent | Reading local `.env*` values into memory to build an exact-match set is in scope; nothing derived from them is written | The only detector for a password with no recognisable shape | — |
| D8 | product-owned | owner | Whether any class is replaced by default for consumers | Consumer-facing default; this roadmap ships every replacement path behind `egress.placeholders.mode: off` and decides nothing for consumers | asked at `road-to-placeholders-on-the-wire` blocker `default-mode-for-consumers` |

## Phase 0 — Contract, census, pre-registration (no product code)

- [ ] **0.1 Write the contract** `docs/contracts/egress-placeholders-v1.md`: the
      two classes (`credential`, `identifier`) and their restore policy (D5);
      the four states and what counts as proof of each — `asserted` only where
      this package writes the request, `replaced` where a host hook substitutes
      and the drop rate is measured, `gated` where content can only be refused,
      `uncovered` where nothing reaches; the logging rule (type and count, never
      a value, never a masked fragment); and D4.
      verify: the file exists and names all four states; `grep -c 'uncovered' docs/contracts/egress-placeholders-v1.md` is at least 1.
- [ ] **0.2 Add threat-model row j** — session content travelling to a model
      provider, with sub-rows for host telemetry that can export prompts or
      request bodies (a second egress path), the session mapping as a store worth
      stealing, a request gateway being bypassed, and tool arguments leaving
      through external tools — and correct "It holds no user data" to what is
      true.
      verify: `docs/threat-model.md` carries a row `j` and no longer contains the sentence "It holds no user data".
- [ ] **0.3 Pre-register the bars before the first data point**, one document
      committed alone in the house shape of `internal/bench/*-PREREG.md`. Corpus
      in four workloads: identifier-heavy prose, credential-heavy configuration,
      implicit identity, proprietary code — the third measured to report the
      residue, not to pass. Bars: recall per class, precision on this tree and
      on a labelled negative corpus, byte-exact round trip, **model fidelity per
      token spelling** (a token in context comes back byte-identical in a tool
      input; settles D3), and a paired task-quality comparison through
      `src/scripts/_lib/paired_verdict.ts`, plus an engine latency bar measured
      apart from any gateway (a starting proposal: p95 under 20 ms on a normal
      request). Proposed starting bars, to be
      confirmed there: recall at least 99% for e-mail and checksum-valid IBAN,
      false positives under 1% on code. Each bar names what a null looks like.
      verify: the PREREG commit precedes every commit under Phases 2–3 in `git log`; the prototype readings it cites are labelled anchors, not results.
- [ ] **0.4 Generate the census of this package's own senders (F8).** One row
      per module that posts to a provider endpoint: endpoint, whether it carries
      session content or a fixed corpus, whether it passes the engine. Derived
      from the import graph, the way `src/scripts/check_read_surface_coverage.ts`
      derives read surfaces; a module the generator cannot classify is an
      `unclassified` row, never an absent one.
      verify: every file named in F8 appears in the generated table; a fixture module posting to an unknown endpoint appears as `unclassified`.

## Phase 1 — Prevention that needs no rewrite (F4)

Prevention goes first because it is the only fail-closed layer: a value never
read cannot leak through any later bug.

- [ ] **1.1 Refuse reads of credential-class files at `pre_tool_use`** — `.env*`
      except `.env.example`, private keys, cloud and package-registry credential
      files — and refuse commands that dump the environment. One blocking concern
      in the shape of the `block_*` guards, reusing their command parser, with
      an admission row and a kill-switch row. The reason names the file class and
      the alternative (reference the variable by name).
      verify: `npx vitest run tests/scripts/hooks/block_credential_reads.test.ts` -> 0 — the file holds a red and a green case per file class on a deny-capable slot (`isBlockCapable`, `src/scripts/hooks/host_semantics.ts:113`) and a warn assertion on a slot that is not.
- [ ] **1.2 Lower the same list to the host's own primitives at install.** On
      Claude Code, `permissions.deny Read(…)` entries recorded in the install
      manifest so uninstall removes exactly those. The stronger sandbox and
      environment-scrub tiers are documented as user-enabled, never written into
      a project.
      verify: a fresh install into an empty project shows the deny entries; `hooks:doctor` reports the tier in force; uninstall leaves no entry behind.
- [ ] **1.3 Record what prevention cannot see** — a value printed by a program, a
      row returned by a database tool, a secret typed by the user — as fixtures
      that fail today and are referenced by the host-carrier roadmap's phases
      that close them.
      verify: three fixtures exist and each is named by a step in `road-to-placeholders-on-the-wire`.

## Phase 2 — One detector table (F2, F3)

- [ ] **2.1 One rule table, one schema.** Each rule: type, class, pattern,
      optional validator, optional context words and window, exclusions, and a
      span with start **and end**. Pure, no I/O, no network, no dependency — the
      shape `secret_detector` already has, extended. Overlaps resolve before any
      replacement: the more sensitive class wins, then the validated span, then
      the longer one; replacements apply right to left on the original text.
      Bounded quantifiers only; a test refuses a rule that backtracks on a
      pathological input.
      verify: the table is the only place a credential pattern literal appears under `src/scripts` and `src/cli`; a lint fails a second one and is registered in `src/config/gate-coverage.yml` with a canary.
- [ ] **2.2 Move every site of F2 onto it** without changing what each site does
      with a hit — the council low-impact redactor still refuses, the explain
      scrubber still masks, `check_secret_leak` keeps its verdicts. Only the
      detection is shared.
      verify: a drift matrix — every positive fixture against every consumer — is green, and the `sk-ant-api03` case of F2 is a named row in it.
- [ ] **2.3 Validators for the identifier class:** IBAN by country length and
      mod-97; payment card by Luhn **and** a context word; e-mail by TLD and an
      allowlist (documentation domains, no-reply forms, this repository's own
      commit identities); phone only with a country code or a context word;
      German tax ID by checksum **and** context. An allowlist entry for a real
      value is stored as a keyed digest, never as the value. The two
      unvalidated copies of F3 are replaced by the table.
      verify: the F3 census re-run through the table reports its count as a test with a pinned ceiling, not a report; recall and precision per class are read against the 0.3 bars.
- [ ] **2.4 Known values (D7).** An exact-match set built per invocation from
      environment variables whose names mark them as credentials and from local
      `.env*` files, matched also in base64, URL-encoded and JSON-escaped form
      through at most two decoding layers with a size and a time bound. Held in
      memory; never written.
      verify: a password with no recognisable shape, present in a fixture `.env` and printed by a command, is detected in all four encodings; a nested encoding past the bound is a counted miss, not a hang.
- [ ] **2.5 Invisible characters do not hide a value.** Reuse the strip-then-
      rescan step and its fixtures (`src/scripts/_lib/knowledge_global_redaction.ts`,
      `tests/fixtures/global-knowledge-redaction/`).
      An evasion corpus beside them — inserted spaces, alternate casing, line
      wrapping, code fences, Markdown links, a value repeated or overlapping
      another — reports each miss as a counted miss.
      verify: the zero-width and homoglyph fixtures are detected by the table, and the evasion corpus prints its miss count per mutation.
- [ ] **2.6 A mutation suite kills the invariants.** Disabling the IBAN checksum,
      changing class precedence, logging a raw value or letting a credential
      token restore anywhere turns a named test red.
      verify: each listed mutation, applied to a scratch copy, fails at least one test; the recipes are `canary:` entries in `src/config/gate-coverage.yml`.

## Phase 3 — The grammar, and the requests this package writes (F1, F8)

These senders are where this package controls the request **and** reads the
response, with no host contract in between and no hook budget to spend — so
`asserted` is proven here before any host is asked to cooperate.

- [ ] **3.1 The grammar is one constant** (D3) with one recogniser: delimiter,
      type, number and a fingerprint — a truncated keyed digest over type and
      canonical value under a random key drawn per run and never sent. The
      number is what a reader sees; the fingerprint makes a token from another
      run, or one the model invented, unresolvable instead of wrong. A token
      never matches a detector rule. A lint refuses a second spelling of the
      grammar anywhere under `src/`.
      verify: a forged token and a token under another key do not resolve; replacing twice yields the same bytes as replacing once.
- [ ] **3.2 Two spellings of one entity share number and fingerprint and carry
      a variant suffix**, so a restore reproduces each spelling byte for byte.
      verify: a spaced and a compact IBAN share a number, differ in suffix, and both restore to their original bytes.
- [ ] **3.3 The council bundle goes through the engine, and the transport checks
      what it is about to send.** The six line patterns of `bundler.ts:81-88`
      become span replacement, so a finding no longer costs the reviewer the
      whole line. Immediately before the request is written, the outbound body
      is rescanned for every value replaced in this run and every
      high-confidence finding; a hit refuses the send. Responses are restored
      locally for display only; the retained record keeps placeholders.
      verify: the F1 sample leaves the bundler with five placeholders and `const token = getToken();` intact; a canary that plants a raw value past the replacement is refused by the final check, and removing the check turns the canary red.
- [ ] **3.4 Every sender in the 0.4 census is one of three things:** routed
      through the same replacement and final check, marked as carrying a fixed
      corpus only, or listed `uncovered` with a reason. A new sender that is
      none of them fails the census gate.
      verify: the census has no empty cell; a fixture sender with no classification fails the gate.
- [ ] **3.5 What this package injects into a session goes through the engine
      too** — hot context, handoff and memory recall re-inject stored text.
      verify: a stored entry containing a listed value is injected as its token.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-11 | reviewer: claude -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Over-replacement breaks ordinary code and reviews | implementation | A fixture address, a commit identity or a card-shaped number becomes a token and the council reviews a damaged diff | Validators plus context plus allowlist in 2.3; the census as a pinned test; replacement is span-level, never line-level (3.3) | Phase 2 — One detector table (F2, F3) |
| 2 | Moving seven consumers changes a verdict silently | implementation | A consumer that refused now masks, or the secret-leak gate's verdict drifts | 2.2 shares detection only; the drift matrix is green before and after | Phase 2 — One detector table (F2, F3) |
| 3 | The constraint is read as covering every channel | product | The owner's constraint is absolute; this roadmap proves it only where this package writes the bytes | The four states and `uncovered` are in the contract (0.1); N8 states the boundary; the claim is per channel | Phase 0 — Contract, census, pre-registration (no product code) |
| 4 | Placeholders degrade review or coding quality | product | A model reasons worse over a value it cannot see | Paired comparison pre-registered in 0.3; a null or a loss is published and D8 keeps consumer defaults off | Phase 0 — Contract, census, pre-registration (no product code) |
| 5 | The prevention guard costs every tool call | implementation | One more concern on a `pre_tool_use` slot whose latency trigger already fired | Pure path classifier, no dependency; byte delta stated in the PR and in `src/config/hook-latency-budget.json` | Phase 1 — Prevention that needs no rewrite (F4) |

## Acceptance Criteria

- [ ] AC-1 — One rule table defines every credential and identifier pattern;
      the drift matrix is green and the `sk-ant-api03` row passes on every
      consumer.
- [ ] AC-2 — The council sample leaves with five placeholders and no lost line,
      and a removed final check turns its canary red. *(Discharges the owner's
      constraint for the council channel, state `asserted`.)*
- [ ] AC-3 — The sender census has no empty cell; every sender is `asserted`,
      fixed-corpus or `uncovered` with a reason.
- [ ] AC-4 — Credential-class files cannot be read through a hooked tool on a
      deny-capable slot, and the installer's deny entries are present and
      removed again on uninstall.
- [ ] AC-5 — The contract and threat-model row j exist; no shipped prose about
      this feature uses the word anonymisation; every channel this package does
      not write is published `uncovered` until the host-carrier roadmap changes
      it.
- [ ] AC-6 — The bars of 0.3 were committed before any Phase 2–3 data, and the
      measured result is published against them whatever it is; the grammar of
      3.1 is the spelling that bar selected.

## Lineage

Five plan generations arrived; this roadmap and `road-to-placeholders-on-the-wire`
together carry their surviving items. The latest consolidation declared two
parents and stated no later synthesis existed; a third generation written in
between, which consolidates the same two, was in the folder and is **folded in**
here and in the sibling (telemetry as an egress path, bypass resistance,
per-auth-mode rows, a route-drift gate, a minimal execution view, session
resume). Items read and not carried are listed in the sibling's § Declined.
