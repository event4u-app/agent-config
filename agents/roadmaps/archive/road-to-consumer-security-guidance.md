---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
---
# Road to consumer security guidance

> **Source:** an inbox proposal (`agents/tmp.old/security-tok.txt`, authored
> 2026-08-20 against pin `4ebc491`) asking to harvest ~2,200 lines of an
> external, CC-BY-4.0-licensed AI-agent security ruleset — **Source S1**,
> governed by an open standards body — into this package's consumer-facing
> corpus. Two things happened before this roadmap was written, and both are
> **own analysis**, not claims taken from S1. First, every verdict in that
> proposal was re-run against `origin/main` at `b900dd0`, 204 commits after
> its pin; three did not survive (§ Verified findings). Second, the scoping
> question went to the AI council (2 members, 3 rounds, blind peer review,
> design mode, 2026-08-21), which converged on **reject the harvest**
> (§ The decision). This roadmap executes that rejection: it locks the
> boundary, routes to the maintained authority, and records the nulls so the
> proposal cannot arrive a third time unexamined.

## Goal

The question *"does this package carry security-domain content?"* has a
recorded answer, and a consumer who needs a cipher tier, an Argon2id work
factor, or an XXE parser flag is routed to the maintained authority instead of
reading a stale copy of it. Finished means: an ADR locks the boundary with its
reopening condition; the two security skills state, in the artefact a consumer
actually reads, what they do **not** cover and where to go instead; the eleven
verified gaps are recorded with their evidence so the next proposal starts from
them rather than re-deriving them; and the estate is measurably no larger —
no new skill, no new rule, no new security-content file, and no change to the
standing-context token count.

## Verified findings — the proposal's diff re-run at `b900dd0` (own analysis)

| Gap | Evidence at HEAD | Verdict |
|---|---|---|
| Cryptography — algorithm tiers, PQC readiness | grep `AES-GCM\|argon2\|TLS 1.2\|ChaCha20\|ML-KEM\|post-quantum` over `src/skills` + `src/rules` + `docs/guidelines` → **1 file**, one incidental table row (`ai-code-blindspots:53`) | **absent** — confirmed |
| Password hashing — work factors, constant-time verify, rehash | `docs/guidelines/php/security.md:108` carries the *negative* ("do not use `md5()`/`sha1()`") and no positive counterpart | **thin** — confirmed |
| Digital certificates — validation, pinning, rotation | only `skill:traefik` (infra TLS termination); no application-side guidance | **thin** — proposal said "absent"; **corrected** |
| Encryption at rest | 4 hits, all one-line rows (`code-review/checklists/infra.md:10`, `secrets-management:31`, `ai-code-blindspots:53`, `senior-engineering-discipline:60`) | **thin** — proposal said "absent"; **corrected** |
| XXE / external entities | **zero hits tree-wide** | **absent** — confirmed |
| Deserialization, file upload | one checklist row each (`security-audit:110`, `:112`) | **thin by genre** — confirmed |
| Log injection (CRLF), security-event logging | 1 hit, in an unrelated agent-infra guideline | **thin** — confirmed |
| Consumer-facing MCP *deployment* guidance | `lint_mcp_config_security.ts` exists and is authoring-time only | **absent** — confirmed |
| IaC hardening | `skill:terraform` already has a `### Security` section — state encryption `:74`, least-privilege `:93`, no wildcard ARNs `:149` | **near-parity** — proposal said "3 hits, no checklist"; **falsified** |
| Dependency / supply-chain security | `skill:supply-chain-intake` (122 lines) covers existence checks, pinning, lockfiles, CVE scan | **covered** — only SBOM generation absent; **overstated** |
| Kubernetes | no skill | absent **and out of the consumer profile** — rejected, not a gap |
| Estate baseline | 119 rules · 290 skills · 111,035 unconditional tokens (exact BPE, `check_rule_activation_census`) | the Phase 3 gate measures against these |

The proposal also cites a companion "Roadmap I Phase 4" with items 3/5/10 and a
"D7". **No such roadmap exists in this tree** — `archive/road-to-security-hardening.md`
has three phases, all closed, and none of those items. Every cross-reference in
the proposal was dangling, which is itself evidence it was not grounded in the
tree it described.

## The decision (AI council, 2026-08-21 — 2/2 convergent)

Both members rejected the harvest. Their convergent grounds, in their own
ordering:

1. **Stale security content is actively harmful, not merely stale.** A work
   factor, cipher tier, or TLS floor that is correct on the day it lands reads
   authoritative when it is wrong two years later, and produces false
   confidence rather than a visible gap. This was called *decisive*, not
   merely significant.
2. **No maintenance owner exists.** A review-by date without a named owner is
   theatre. One member made ownership an explicit kill criterion — *"no
   maintainer accepts ownership before merge"* — and no maintainer was
   available to name, so the content half fails closed on that member's own
   test.
3. **The maintained authority already exists and is free, current, and
   comprehensive.** Routing to it covers every one of the eleven gaps above at
   a cost of one pointer; replicating it covers a subset at the cost of
   permanent maintenance this package cannot supply.
4. **This package's domain is governance and distribution, not security
   content.** Its security *strength* is enforcement — `secret-vcs-guard` plus
   a detector plus a CI net, `authz-review`'s per-entrypoint chain — none of
   which the proposal touched.
5. **The estate sits at 2.4× its registered target under a one-in-one-out
   constraint.** Content with no owner is exactly the debt drawdown exists to
   remove.

Where they diverged: one member permitted at most two durable checks (XXE and
password-API misuse) *conditional on* fixtures proving a real detection gain,
a named owner, and a resolved provenance classification. None of those three
conditions is met today, so the conditional path fails closed to the same
place. Both members independently rejected a `crypto-standards.md` reference
file, crypto parameters, post-quantum material, MCP deployment guidance, and
SBOM content.

**Provenance follows from the verdict.** Nothing is adapted, so CC BY 4.0 does
not attach: no `borrows.jsonl` row, no `CREDITS.md` row, no `ATTRIBUTION.md`,
and no `harvests.jsonl` row (per `rule:code-provenance`, a *rejected* finding
belongs in the analysis document — this file — and produces no ledger row).
The tension between attribution and `rule:source-confidentiality` dissolves
rather than needing resolution, which is the cleanest available answer to it.

## Phase 1 — Lock the boundary so it is not re-litigated per proposal

- [x] **1.1 Record the scope decision as an ADR.** `docs/decisions/ADR-238-*`:
      this package routes security-domain parameters to the maintained
      external authority and does not carry them, because stale security
      content is worse than absent security content and no maintenance owner
      exists. State the reopening condition explicitly — a named owner with a
      review cadence, plus fixtures showing a real detection gain — so the
      decision is reversible on evidence rather than permanent by default.
      verify: `./scripts-run src/scripts/check_adr_index` (or the repo's ADR
      index regeneration) exits 0 and the new ADR appears in the index.
- [x] **1.2 Keep the source name out of the tracked tree.** `rule:source-confidentiality`
      forbids recording that this package evaluated a *named* external source;
      the carve-out is license-required attribution, which Phase 0's verdict
      removed the need for. Add the source's two identifying tokens to
      `src/scripts/external_sources_denylist.json` so a future harvest attempt
      trips CI instead of review.
      verify: `./scripts-run src/scripts/check_no_external_sources` exits 0 on
      the tree, and exits non-zero when a scratch file under `src/` contains
      one of the added tokens.

## Phase 2 — Route the consumer to the authority, in the artefact they read

- [x] **2.1 State the coverage boundary in `skill:security-audit`.** A short
      "what this audit does not cover" block naming the four categories the
      grep proved absent or thin — cryptographic parameters, certificate
      validation and pinning, password-hashing work factors, XXE parser
      configuration — and routing each to the maintained cheat-sheet authority.
      **No parameter, no algorithm name, no version floor** appears in the
      block: a pointer cannot rot, a copied constant can. The existing
      checklist rows stay rows.
      verify: the block contains zero numeric security parameters
      (`grep -nE '[0-9]+ *(bit|bits|rounds|iterations)|TLS 1\.[0-9]|AES-[0-9]'`
      over the added lines returns nothing) and `security-audit/SKILL.md`
      grows by ≤ 15 lines.
- [x] **2.2 Mirror the boundary in `skill:security`.** The secure-*coding*
      skill is where a consumer asks "how do I store this password", so it
      carries the same pointer and the same refusal to restate parameters.
      One cross-link, not a second copy of the block.
      verify: `skill:security` grows by ≤ 8 lines and links the same authority.

## Phase 3 — Record the nulls and prove the estate did not move

- [x] **3.1 The three falsified targets are written down, not dropped.** IaC
      hardening (`skill:terraform` already carries it), dependency security
      (`skill:supply-chain-intake` already carries it), and Kubernetes (out of
      the consumer profile) each keep their `file:line` evidence in this file
      so the next proposal cannot re-assert them as gaps.
      verify: § Verified findings names all three with evidence — checked by
      reading the file.
- [x] **3.2 Measure the three properties the Goal claims.** Estate count,
      standing-context tokens, and source anonymity.
      verify: `ls src/rules/*.md | wc -l` = 119 and `ls -d src/skills/*/ | wc -l`
      = 290, both unchanged; `check_rule_activation_census` reports 111,035
      unconditional tokens unchanged; `check_no_external_sources` exits 0.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The rejection reads as "security does not matter here" | product | A verdict of "add no content" is easy to misread as indifference, and the next maintainer re-opens the harvest from scratch because the reasoning was not durable | The ADR in 1.1 records the *reason* and its reopening condition, not just the outcome, and § Verified findings keeps the eleven measured gaps so a reopening starts from evidence rather than from a fresh grep | Phase 1 — Lock the boundary |
| 2 | The routing pointer is added and never reached | product | A "see also" line at the bottom of a skill is not routing; if the consumer's question never surfaces the pointer, the gap is unchanged and the PR bought nothing | The block lands in the two artefacts a consumer actually asks through, adjacent to the checklist rows that already name the categories — not in a `references/` file and not in a see-also list | Phase 2 — Route the consumer to the authority |
| 3 | A parameter creeps into the boundary block | implementation | The pull to be helpful is exactly what puts "use Argon2id with t=3" into a block whose whole value is carrying no constants, and one such line reintroduces the rot the decision exists to avoid | 2.1's verify is a mechanical grep for numeric security parameters over the added lines, not a reading judgement | Phase 2 — Route the consumer to the authority |
| 4 | The source name leaks into a tracked artefact | implementation | This roadmap discusses an external source at length; a later session summarising it, or a harvest attempt, writes the name into a skill, a commit, or a PR body, which `rule:source-confidentiality` forbids and nothing currently detects | 1.2 adds the tokens to the denylist so the existing CI gate catches the leak; the draft of this very roadmap contained the name in a grep example and was caught this way | Phase 1 — Lock the boundary |
| 5 | The decision is later reversed without the evidence it demands | product | "We have an owner now" is easy to assert and hard to check, so the reopening condition degrades into a formality and the unmaintained content lands anyway | The ADR names all three conditions together — owner, cadence, fixtures showing a detection gain — and a reopening that cannot show the fixtures has not met it | Phase 1 — Lock the boundary |

## Acceptance Criteria

- [x] AC-1 — An ADR records that this package routes security-domain parameters
      to the maintained external authority rather than carrying them, states
      the three grounds, and names the reopening condition.
- [x] AC-2 — `skill:security-audit` and `skill:security` each tell a consumer,
      in the body they read, which security topics the package does not cover
      and where the maintained answer lives.
- [x] AC-3 — No numeric security parameter, algorithm name, or version floor
      was added anywhere in this change.
- [x] AC-4 — `ls src/rules/*.md | wc -l` is 119, `ls -d src/skills/*/ | wc -l`
      is 290, and `check_rule_activation_census` reports 111,035 unconditional
      tokens — all unchanged from the pre-change baseline.
- [x] AC-5 — `check_no_external_sources` exits 0 with the source tokens denied,
      and the source is named in no tracked file.
- [x] AC-6 — The eleven verified gaps and the three falsified targets are
      recorded in this roadmap with their evidence.
