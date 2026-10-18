---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "No active, parked or stub roadmap owns what session content carries toward a model provider: the seven active roadmaps cover authority, routing, install thinning, blocking time, corpus cadence, decision closure and self-modification, and the two nearest archived owners (road-to-a-sanitize-list-that-is-generated, inbound codepoints; road-to-hooks-on-every-host, slot bindings) are closed. Archiving an unrelated roadmap to make room would retire live work and leave the outbound path as open as it is."
estate_growth_exempt: "Grows open_blockers by one and concern_count by one, both owned by this roadmap's Phase 1. The concern is block-credential-reads (step 1.1), the only fail-closed layer of the egress work, admitted in agents/decisions/concern-admissions.jsonl. The blocker is native-deny-is-a-host-setting-write: step 1.2 would add a second exception to the published promise that this package writes no host setting, which only the owner may decide, so it is recorded rather than built or dropped. The roadmap itself was added as the first of a two-roadmap set, its host-carrier half being road-to-placeholders-on-the-wire."
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

## Execution status — 2026-10-15

One lane took the three steps `road-to-placeholders-on-the-wire` Phase 1 waits
on (its D9) and what they depend on: 0.1, 0.2, 0.3, 2.1 and 3.1. Everything else
is open.

- **For the sibling:** the contract states token identity, scope, lifecycle and
  the owner of resolution state, and leaves at-rest storage to its
  `identifier-table-at-rest` blocker; the rule table exists; the grammar is
  `__TYPE_n_fp__`. **The identifier class has no rows yet** — validated identifier
  rules are 2.3 — so counting by class today yields credential evidence only.
- **2026-10-16:** 0.4 landed (sender census in the contract).
- **2026-10-17:** 1.3 landed (gap fixtures named by the sibling). 2.2 was built
  and reverted: the rule table is hook-plumbing source for the ratification gate
  (see 2.2). 2.3 was prototyped and set aside on the hook-bundle budget (see
  2.3). 1.1 and 1.2 touch a pre-tool-use guard and the installer, which that
  drain lane did not edit. 2.3 to 2.6 and 3.2 edit the rule table or the token
  module, both bundled into the dispatcher, so each needs a ratification record
  before it can land.
- **2026-10-18:** 2.2 landed with its ratification record; its two
  remainders without a vendor literal became 2.7.
- **2026-10-18:** the engine became a conditional chunk (2.2b, D9), which is what
  2.3 to 2.5 and 3.2 needed: their bytes now land in the chunk, under its own ceiling.
- **Next in order:** 1.1, 2.3, 3.2, 3.3.

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
| D3 | contested-technical | evidence | Which surviving spelling becomes the grammar — `⟦TYPE_n.fp⟧`, `__TYPE_n__` or a namespaced wire form with a separate display label — is decided by the model-fidelity bar of 0.3, not by taste | F9 narrows the field to forms that survive; **settled 2026-10-15 by PREREG endpoint (d): all three survivors copied 20/20, the pre-registered rule picked `__TYPE_n_fp__`** | the bar reports no spelling above its threshold |
| D4 | reversible-technical | agent | Refuse where content has not yet moved, replace where it has | Reconciles F7's two house positions under one rule | — |
| D5 | reversible-technical | agent | Credentials and identifiers are two classes with opposite restore policies; a credential value is never stored | A local edit of a file holding a credential can re-derive the value from that file; nothing else needs it | — |
| D6 | reversible-technical | agent | Settings block `egress.placeholders`, not `privacy.egress` | A key named "privacy" reads as the guarantee N1 exists to avoid | — |
| D7 | reversible-technical | agent | Reading local `.env*` values into memory to build an exact-match set is in scope; nothing derived from them is written | The only detector for a password with no recognisable shape | — |
| D8 | product-owned | owner | Whether any class is replaced by default for consumers | Consumer-facing default; this roadmap ships every replacement path behind `egress.placeholders.mode: off` and decides nothing for consumers | asked at `road-to-placeholders-on-the-wire` blocker `default-mode-for-consumers` |
| D9 | reversible-technical | council:one-detector-bundle-budget-20261018 | The engine leaves the dispatch bundle as a conditional chunk with its own ceiling, and the linearity prose leaves the engine; an unavailable engine withholds every body in `protect` and `strict`, records the miss in `observe`, is never loaded in `off` | Measured 2026-10-18: 3,155 B of bundle headroom against 12–15 KB of queued engine work; the SVG rule set set the chunk precedent. Two-provider council (anthropic, openai), 2/2, options C and B, with the per-mode failure table, a schema handshake and a chunk budget as conditions; the prompt is `agents/evidence/council/one-detector-bundle-budget-20261018.question.md` | the chunk load costs a measurable latency in a non-`off` mode, or a host installs `dispatch.js` without its siblings |

## Phase 0 — Contract, census, pre-registration (no product code)

- [x] **0.1 Write the contract** `docs/contracts/egress-placeholders-v1.md`: the
      two classes (`credential`, `identifier`) and their restore policy (D5);
      the four states and what counts as proof of each — `asserted` only where
      this package writes the request, `replaced` where a host hook substitutes
      and the drop rate is measured, `gated` where content can only be refused,
      `uncovered` where nothing reaches; the logging rule (type and count, never
      a value, never a masked fragment); and D4.
      verify: the file exists and names all four states; `grep -c 'uncovered' docs/contracts/egress-placeholders-v1.md` is at least 1.
- [x] **0.2 Add threat-model row j** — session content travelling to a model
      provider, with sub-rows for host telemetry that can export prompts or
      request bodies (a second egress path), the session mapping as a store worth
      stealing, a request gateway being bypassed, and tool arguments leaving
      through external tools — and correct "It holds no user data" to what is
      true.
      verify: `docs/threat-model.md` carries a row `j` and no longer contains the sentence "It holds no user data".
- [x] **0.3 Pre-register the bars before the first data point**, one document
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
- [x] **0.4 Generate the census of this package's own senders (F8).** One row
      per module that posts to a provider endpoint: endpoint, whether it carries
      session content or a fixed corpus, whether it passes the engine. Derived
      from the import graph, the way `src/scripts/check_read_surface_coverage.ts`
      derives read surfaces; a module the generator cannot classify is an
      `unclassified` row, never an absent one.
      verify: every file named in F8 appears in the generated table; a fixture module posting to an unknown endpoint appears as `unclassified`.
      **Done 2026-10-16:** scanner `src/scripts/_lib/egress_sender_scan.ts`, regenerated
      by `./scripts-run src/scripts/egress_sender_census --write` into the contract's
      § This package's own senders (23 modules: 17 sender, 1 local, 5 unclassified).
      `npx vitest run src/scripts/_lib/egress_sender_scan.test.ts` -> 0; the F8 and
      unknown-endpoint cases are named tests, the latter seen red with the
      unknown-host branch neutralised. Every `content` cell reads `undeclared`: the
      `egress-content:` marker exists, declaring it per sender is 3.4's. The drift
      check is a test, not a registered gate.

## Phase 1 — Prevention that needs no rewrite (F4)

Prevention goes first because it is the only fail-closed layer: a value never
read cannot leak through any later bug.

- [x] **1.1 Refuse reads of credential-class files at `pre_tool_use`** — `.env*`
      except `.env.example`, private keys, cloud and package-registry credential
      files — and refuse commands that dump the environment. One blocking concern
      in the shape of the `block_*` guards, reusing their command parser, with
      an admission row and a kill-switch row. The reason names the file class and
      the alternative (reference the variable by name).
      verify: `npx vitest run tests/scripts/hooks/block_credential_reads.test.ts` -> 0 — the file holds a red and a green case per file class on a deny-capable slot (`isBlockCapable`, `src/scripts/hooks/host_semantics.ts:113`) and a warn assertion on a slot that is not.
      **Done 2026-10-18:** `src/scripts/hooks/block_credential_reads.ts`, bound on the
      three `pre_tool_use` rows the other `block-*` guards bind, with the class list
      in `src/scripts/_lib/credential_files.ts` for 1.2 to read. It refuses a file tool
      on an env file (the template names pass), a private key, a cloud/CLI or a
      package-registry credential file; a shell command handing such a path to
      anything but a short list that does not print it; and `env`, `printenv`, a
      bare `export`/`set`, `declare -x`. `npx vitest run
      tests/scripts/hooks/block_credential_reads.test.ts` -> 0, 16 cases including
      every allow branch. Admission row in `agents/decisions/concern-admissions.jsonl`,
      kill switch `AGENT_CONFIG_ALLOW_CREDENTIAL_READS` in the contract's table,
      execution-view grant in the egress stage. Bundle +11,970 B (1,542,666 of
      1,550,000), stated beside a `null` SLA row in `src/config/hook-latency-budget.json`
      until both machine classes are measured. A program that opens the file
      itself is not caught; that residue is the fixture set of 1.3.
- [ ] **1.2 Lower the same list to the host's own primitives at install.** On
      Claude Code, `permissions.deny Read(…)` entries recorded in the install
      manifest so uninstall removes exactly those. The stronger sandbox and
      environment-scrub tiers are documented as user-enabled, never written into
      a project.
      verify: a fresh install into an empty project shows the deny entries; `hooks:doctor` reports the tier in force; uninstall leaves no entry behind.
- [x] **1.3 Record what prevention cannot see** — a value printed by a program, a
      row returned by a database tool, a secret typed by the user — as fixtures
      that fail today and are referenced by the host-carrier roadmap's phases
      that close them.
      verify: three fixtures exist and each is named by a step in `road-to-placeholders-on-the-wire`.
      **Done 2026-10-17:** `tests/fixtures/egress-prevention-gaps/` holds
      `program-output.json`, `database-row.json` and `typed-secret.json`, each with a
      `closed_by` naming the sibling step (3.1, 3.1, 5.1), and those steps name the
      fixtures back. `npx vitest run tests/scripts/hooks/egress_prevention_gaps.test.ts`
      -> 0: per fixture the stage counts a credential, and the real dispatcher in
      `strict` returns no rewrite field and no block while the bound concern did
      run (that check seen red with the concern unbound). The assertions describe
      the open gap, so the closing step inverts them for its fixture.

## Phase 2 — One detector table (F2, F3)

- [x] **2.1 One rule table, one schema.** Each rule: type, class, pattern,
      optional validator, optional context words and window, exclusions, and a
      span with start **and end**. Pure, no I/O, no network, no dependency — the
      shape `secret_detector` already has, extended. Overlaps resolve before any
      replacement: the more sensitive class wins, then the validated span, then
      the longer one; replacements apply right to left on the original text.
      Bounded quantifiers only; a test refuses a rule that backtracks on a
      pathological input.
      verify: `npx vitest run src/scripts/_lib/egress_rules.test.ts` -> 0 (schema, overlap precedence, right-to-left replacement, a bounded-quantifier refusal seen red on the old unbounded `db-connection-uri` pattern), and `secret_detector` reads its credential rows from the table with its own suites green.
      **Correction (2026-10-15, at execution):** the original verify — the table is
      the only place a credential pattern literal appears, enforced by a lint — cannot
      be green before 2.2 moves the six other sites F2 names; a lint landed here would
      need a baseline of exactly the sites 2.2 removes. It moves to 2.2's verify.
      Landed as `src/scripts/_lib/egress_rules.ts`. Two spans are detection-grade, not
      replacement-grade, and stay so for the commit-time scanner: `pem-private-key`
      matches the header line only and `db-connection-uri` the whole authority; 3.3
      widens them before any replacement reads them. Bounding changed two quantifiers
      that had no practical reach (`\s*` → `\s{0,16}` around `=`, value caps of
      1,024 / 8,192 characters).
      **Superseded by the PR #2366 council review (2026-10-15):** quantifiers are
      unbounded again wherever linear, with a per-rule `linearity` argument;
      `jwt` and `db-connection-uri` start once per character run with an atomic
      prefix, so the parity suite against the pre-move pack has no exceptions. Each
      rule now declares its replacement span separately from its detection span:
      `pem-private-key` replaces through its END marker and refuses the text when
      that cannot be proven, so 3.3 inherits replacement-grade spans rather than
      having to widen them.
- [x] **2.2 Move every site of F2 onto it** without changing what each site does
      with a hit — the council low-impact redactor still refuses, the explain
      scrubber still masks, `check_secret_leak` keeps its verdicts. Only the
      detection is shared.
      verify: a drift matrix — every positive fixture against every consumer — is green, and the `sk-ant-api03` case of F2 is a named row in it; the table is the only place a credential pattern literal appears under `src/scripts` and `src/cli`, and a lint that fails a second one is registered in `src/config/gate-coverage.yml` with a canary (moved here from 2.1).
      **Built and reverted 2026-10-17 — blocked on a ratification record.** The
      move was implemented on the branch of the PR that recorded this note and is
      reachable in its history (the four commits before its two `Revert` commits):
      every F2 site read the table, six rows the consumers had and the table
      lacked (OpenAI, Google OAuth, GitHub app tokens, xAI, Perplexity, Groq) and a
      `prefixes` field for shape-only surfaces were added, a drift matrix (18 rows
      against 6 pattern-grade and 3 prefix-grade consumers, `sk-ant-api03` a named
      row, seen red with one row removed from one consumer) and a single-spelling
      test were green, and the hook bundle grew 1,616 B. The pre-push ratification
      gate classifies `src/scripts/_lib/egress_rules.ts` as hook-plumbing source,
      because the egress stage bundles it, so any edit to the table needs a
      ratification artifact under ADR-268 § 4; producing one was outside that
      drain lane, so the work was reverted rather than pushed past the gate.
      **Landing it needs:** that record, then the same commits re-applied.
      **Still open after that:** registering the single-spelling check in
      `src/config/gate-coverage.yml` with a canary (also a governance surface),
      and the keyword-assignment variants (`password =`, `api_key:`) four
      consumers read at their own threshold plus the class-spelled prefix list in
      `check_reach_channels.ts`, which carry no vendor literal.
      **Done 2026-10-18:** the four reverted commits re-applied, and a review of
      them found the move narrowed five consumers (a prefix held to a token start
      where the consumer's own reading was not, a GitHub token masked only to 36
      characters, an OpenAI key glued to a word missed, a key block with a
      mismatched END label losing only its header). Fixed:
      `rawKeyPrefixPattern` anchors a prefix only where its row is anchored,
      `workspace_secrets` keeps its two looser shapes over the table's prefixes,
      the bundler keeps its unanchored OpenAI shape, an unproven key block is
      masked through the nearest END marker. `npx vitest run
      src/scripts/_lib/egress_legacy_superset.test.ts` -> 0 freezes every
      pre-move pattern against an adversarial corpus, each fix seen red with it
      removed; the drift matrix (`egress_drift_matrix.test.ts`, `sk-ant-api03` a
      named row) is green. The single-spelling check is the gate
      `check_credential_spelling` (self-test, ledger, `rule-backstops` and
      `task ci`), registered in `src/config/gate-coverage.yml` with a
      create-only canary seen red. `check_secret_leak --all` stays green with the
      six added rows. The two remainders above move to 2.7.
- [x] **2.2b The engine is a conditional chunk (D9).** The rule table, the token
      grammar and the commit scanner leave `dist/hooks/dispatch.js` for
      `egress_engine.chunk.cjs`, loaded only when a caller needs detection,
      refused when missing, altered, without a sidecar, of another schema or
      unloadable; the per-rule linearity prose moves to a test-only module; the
      chunk carries its own ceiling.
      verify: `npx vitest run tests/scripts/hooks/egress_engine_chunk.test.ts` -> 0 (every refusal reason, and each mode with the engine unavailable); `./scripts-run src/scripts/check_hook_bundle_composition` reports the dispatch bundle and the chunk under their ceilings.
      **Done 2026-10-18:** the dispatch bundle reads 1,530,696 B (from 1,546,845)
      and the chunk 18,478 B against its 28,000 B ceiling. The two other bundled
      importers stopped being static edges: the subagent capsule loads the chunk
      and rejects an envelope it cannot scan, and `ai_council/config.ts` reads
      `_lib/egress_prefixes.ts`, a generated projection of the prefix list that a
      test and `check_credential_spelling` hold equal to the table. Probed end to
      end on the built bundle: in `observe` it counted a planted token, and with
      the chunk moved away it recorded `engine-unavailable`.
- [ ] **2.3 Validators for the identifier class:** IBAN by country length and
      mod-97; payment card by Luhn **and** a context word; e-mail by TLD and an
      allowlist (documentation domains, no-reply forms, this repository's own
      commit identities); phone only with a country code or a context word;
      German tax ID by checksum **and** context. An allowlist entry for a real
      value is stored as a keyed digest, never as the value. The two
      unvalidated copies of F3 are replaced by the table.
      verify: the F3 census re-run through the table reports its count as a test with a pinned ceiling, not a report; recall and precision per class are read against the 0.3 bars.
      **Measured 2026-10-17, not landed — the hook bundle cannot carry it.** A
      prototype (on top of the reverted 2.2 table) with six identifier rows (IBAN by country length and mod-97, card
      by Luhn plus context, e-mail with documentation, no-reply and file-name
      exclusions, phone international and national-with-context, German tax ID by
      ISO 7064 plus context) passed its own suite, including the checksum-disabled
      and context-removed mutations. Every row is inlined into
      `dist/hooks/dispatch.js` because the egress stage imports the table: the
      bundle read 1,550,279 B against the 1,550,000 B ceiling, and 1,549,879 B
      after packing the IBAN length table — 121 B of headroom, inside the
      hundreds of bytes an esbuild rebuild moves. Those readings include the
      reverted 2.2 table (+1,616 B); main reads 1,543,940 B, so the identifier
      rows alone (about 4.3 KB) would leave about 1.7 KB for every later change
      to the dispatcher, and both together leave nothing. It was set aside rather
      than landed. Landing it needs one of: bytes freed elsewhere in the bundle (the
      table's `linearity` prose is about 2 KB the stage never reads), a ratified
      ceiling raise, or the stage reading a detection-only view of the table.
      That choice touches the hook bundle's shape and its budget, so it is left
      to the maintainer. Still open beyond it: replacing the two F3 copies, the
      pinned census test, the 0.3 bar readings and the keyed-digest allowlist.
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
- [ ] **2.7 The shapes with no vendor literal read the table too** — the
      keyword-assignment variants (`password =`, `api_key:`) the council bundler,
      `workspace_secrets` and the low-impact redactor read at their own
      threshold, and the class-spelled prefixes in `check_reach_channels.ts`.
      Split out of 2.2, whose gate cannot see them. Each consumer keeps its own
      threshold and placeholder; the legacy-superset suite gains their frozen
      patterns before the move.
      verify: `npx vitest run src/scripts/_lib/egress_legacy_superset.test.ts` -> 0 with those patterns frozen, and `check_credential_spelling` fails a keyword-assignment or class-spelled shape outside the table (self-test case).

## Phase 3 — The grammar, and the requests this package writes (F1, F8)

These senders are where this package controls the request **and** reads the
response, with no host contract in between and no hook budget to spend — so
`asserted` is proven here before any host is asked to cooperate.

- [x] **3.1 The grammar is one constant** (D3) with one recogniser: delimiter,
      type, number and a fingerprint — a truncated keyed digest over type and
      canonical value under a random key drawn per run and never sent. The
      number is what a reader sees; the fingerprint makes a token from another
      run, or one the model invented, unresolvable instead of wrong. A token
      never matches a detector rule. A lint refuses a second spelling of the
      grammar anywhere under `src/`.
      verify: a forged token and a token under another key do not resolve; replacing twice yields the same bytes as replacing once.
      **Done 2026-10-15:** `src/scripts/_lib/egress_token.ts`, spelling `__TYPE_n_fp__`
      selected by PREREG endpoint (d) — all three survivors copied 20/20 on the host
      model, the pre-registered rule (ASCII-only, then shorter) picked this one
      (`internal/bench/reports/egress-placeholders-fidelity-2026-10-15.md`; no second
      provider measured). `npx vitest run src/scripts/_lib/egress_token.test.ts` -> 0;
      the forgery, foreign-key, idempotence and one-spelling tests were each seen red
      under a neutralised implementation. The one-spelling check is a test that scans
      `src/`, not a registered gate. Replacement is in memory only; the variant
      suffix is 3.2's.
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

## Blockers

### blocker: native-deny-is-a-host-setting-write
- **Status:** open
- **Owner:** maintainer
- **Blocks:** step 1.2 and the installer half of AC-4.
- **What to do:** pick exactly one —
  1. **write the deny tier** — a global Claude Code install appends `Read(…)` rows
     for the classes of `src/scripts/_lib/credential_files.ts` to
     `permissions.deny` in `~/.claude/settings.json` (via the splice in
     `src/install/noGoDenyRows.ts`), records exactly what it wrote in a sidecar
     the way `src/scripts/_lib/skill_listing_overrides.ts` does, and
     `agent-config uninstall` removes exactly those rows; `docs/mcp-server.md`
     § "One exception" gains a second exception;
  2. **offer, never write** — `hooks:doctor` reports the tier in force and prints
     the rows for the user to paste, and nothing is written; or
  3. **neither** — prevention stays the `pre_tool_use` guard of 1.1 alone.
- **Resolved when:** this section records the choice and the date, and 1.2's
  wording names it.
- **Recommendation:** 2 — it reaches the same rows on the same host without a
  second exception to a public commitment, and the guard of 1.1 already refuses
  on the one host that honours a deny. Its cost is that a user who never runs
  `hooks:doctor` never sees the rows.
- **If you do nothing:** 1.2 stays open; the guard of 1.1 is the only prevention.
- **Why this is the owner's:** `docs/mcp-server.md` publishes that this package
  writes no host setting, with one owner-decided exception (`skillOverrides`,
  2026-10-14). Option 1 adds a second exception to that public commitment, which
  the decision-revisit gate's reserved set gives to the owner, not to a council.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-18 | reviewer: claude -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Over-replacement breaks ordinary code and reviews | implementation | A fixture address, a commit identity or a card-shaped number becomes a token and the council reviews a damaged diff | Validators plus context plus allowlist in 2.3; the census as a pinned test; replacement is span-level, never line-level (3.3) | Phase 2 — One detector table (F2, F3) |
| 2 | Moving seven consumers changes a verdict silently | implementation | A consumer that refused now masks, or the secret-leak gate's verdict drifts | 2.2 shares detection only; the drift matrix is green before and after, and the legacy-superset suite freezes every pre-move pattern against an adversarial corpus (re-reviewed 2026-10-18: the first move narrowed five consumers and the suite caught it) | Phase 2 — One detector table (F2, F3) |
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
