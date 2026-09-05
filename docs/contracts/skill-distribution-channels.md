---
stability: beta
promote-to: stable
promote-reason: >-
  Beta review 2026-09-05. 91 days in beta, content unchanged for 88 days, eight
  consumer references, the 6.x to 14.x band shipped it unchanged. It is the head
  of its chain — `install-scopes.md` takes it as a normative Input, not the
  reverse — so it is not blocked on a beta dependency. Its § 45 conditional is
  satisfied in code and verified: `_lib/scope_guard.sh` wired into `install.sh`
  with a wizard endpoint and a test, `probe_skill_registration.ts` with a test
  and a `task probe:skills` target, `--legacy-both` live. The acceptance section
  is restated in past tense in this change. Decided by AI council 2026-09-05,
  2/2 convergent, both seats requiring the missing canonical-channel regression
  to be closed in the same change.
---

# Skill Distribution Channels — canonical per AI tool

**Status:** Active (locked 2026-05-25 via Phase A of `road-to-clean-skill-distribution-channels.md`)
**Owner:** maintainer-team
**Inputs:** [`agents/evidence/audits/2026-05-distribution-channels/`](../../agents/evidence/audits/2026-05-distribution-channels/) (audits 01 + 02), AI Council convergence on the canonical-channel question (claude-sonnet-4-5 + gpt-4o, 2026-05-25 — session artefact auto-pruned; the decision body is inlined in this contract)

## Rule

For every AI tool the package supports, **exactly one channel** is the canonical registration surface used by the consumer installer. The other channel (where one exists at the upstream tool level) is either:

- not projected into the consumer install at all (default), or
- projected behind the `--legacy-both` opt-in flag for users on older harnesses.

## Per-tool matrix

| Tool | Channels supported by host | Canonical (consumer install) | Other channel behaviour | Rationale |
|---|---|---|---|---|
| **Claude Code** | Plugin manifest (`.claude-plugin/marketplace.json`) + filesystem (`.claude/skills/`) | **filesystem** | Manifest not projected by default; use `--legacy-both` to opt in | Cross-tool consistency. Filesystem is the only channel all six tools share. The package's own `.claude-plugin/marketplace.json` stays at the source repo for users who run `claude plugin install <name>` directly. |
| **Augment** | Manifest with `source: "."` (`.augment-plugin/marketplace.json`) + filesystem (`.augment/`) | **filesystem** | Manifest stays — it is metadata-only, not a second registry. No `--legacy-both` needed. | The manifest points at the same directory the harness scans; one source of truth on disk. |
| **Cursor** | Filesystem only (`.cursor/rules/*.mdc`) | **filesystem** | n/a — no second channel exists | No host-level alternative. |
| **Cline** | Filesystem only (`.clinerules/`) | **filesystem** | n/a | No host-level alternative. |
| **Windsurf** | Filesystem only (`.windsurf/rules/`, `.windsurf/workflows/`) | **filesystem** | n/a | No host-level alternative. |
| **Copilot** | Single file (`.github/copilot-instructions.md` or root `copilot-instructions.md`) | **filesystem** | n/a | Single file, not a registry. |

## Decision drivers

1. **Cross-tool consistency.** Four of six tools have only a filesystem channel. Picking filesystem for the other two makes one rule cover everything.
2. **Same-install dual-registration is closed by default.** If `scripts/install.sh` does not project the Claude plugin manifest into the consumer install, the harness has only the filesystem to scan, so the manifest+filesystem double-register risk is eliminated regardless of how the host harness deduplicates.
3. **Cross-scope drift is orthogonal.** The canonical-channel decision does NOT solve the actual 2026-05-25 bug (cross-scope user-global + project-local with different frontmatter). Phase B installer guard + Phase C runtime probe close that path. They are companions to this contract, not substitutes for it.
4. **Publication surface preserved.** The source repo continues to ship `.claude-plugin/marketplace.json` for users who want to install via `claude plugin install <event4u/agent-config>`. Removing the manifest from the **consumer install** does not affect that path.
5. **`--legacy-both` is opt-in only.** Users on harness versions that genuinely require both channels can request the legacy projection. Default is single-channel.

## Council convergence (2026-05-25)

Two-round debate on whether filesystem or plugin should be canonical for Claude. The transparently-merged verdict:

- **Anthropic (R2):** "MIXED leaning DISAGREE on the proposal **as written**" — pointed out that the proposal does not address cross-scope drift by itself, and that the canonical-channel decision only matters if the Claude harness double-registers on same-install. Test scenarios surfaced as critical path before locking. Conclusion: if Claude does ambient filesystem discovery (it does, in practice), **filesystem becomes canonical not by choice but because manifest adds a second registration mechanism with no isolation benefit**.
- **OpenAI (R2):** Endorsed filesystem-canonical with a fail-loud Phase C probe. Suggested user research on `--legacy-both` adoption.

Both members agreed the decision is structurally correct **conditional on** the cross-scope drift fix landing in Phase B and the probe being fail-loud in Phase C. This contract is published with those follow-up commitments.

## Acceptance criteria for follow-up phases — all landed

Phase B and Phase C of `road-to-clean-skill-distribution-channels.md` required
the three items below. **Restated in the past tense 2026-09-05**, on a
verification against the tree rather than on the roadmap's own checkboxes; the
section had stood in pending tense about phases that closed in May.

- (Phase B) A pre-install guard that detects an existing install at the other
  scope and refuses, warns, or upgrades via numbered options —
  [`src/scripts/_lib/scope_guard.sh`](../../src/scripts/_lib/scope_guard.sh),
  wired into [`src/scripts/install.sh`](../../src/scripts/install.sh), with a
  wizard endpoint and
  [`tests/server/wizard.scope-guard.test.ts`](../../tests/server/wizard.scope-guard.test.ts).
- (Phase C) A fail-loud cross-scope drift probe —
  [`src/scripts/probe_skill_registration.ts`](../../src/scripts/probe_skill_registration.ts),
  covered by
  [`tests/scripts/probe_skill_registration.test.ts`](../../tests/scripts/probe_skill_registration.test.ts)
  and reachable as `task probe:skills`.
- (Phase A Step 4) `install.sh` and `task generate-tools` write the canonical
  channel above; `--legacy-both` is the documented opt-in.

**The single-channel invariant itself is covered by
[`tests/scripts/canonical_distribution.test.ts`](../../tests/scripts/canonical_distribution.test.ts)**,
added 2026-09-05. Until then the invariant was held only by a default branch in
`install.sh`: the regression the carrier roadmap promised as
`tests/test_canonical_distribution.py` was never ported and existed under no
extension, while `docs/architecture.md` still linked it as the proof. That gap
is what the beta review closed before this contract was scheduled for promotion.

## Out of scope

- Manifest format changes upstream (Claude Code's marketplace shape) — host-controlled.
- Alternative install paths (vendored copies, git submodules, npm `--prefix`) — package's npm install is the supported path.
- Re-litigating the channel pick after this lock — reopened only on a new audit that surfaces a structurally different shape (e.g. a host change that removes ambient filesystem discovery).

## See also

- [`docs/contracts/install-scopes.md`](install-scopes.md) — companion contract for cross-scope behaviour (authored in Phase B).
- [`docs/contracts/harness-expectations.md`](harness-expectations.md) — Phase D companion documenting host-side behaviours that look like package bugs but are not.
- [`agents/evidence/audits/2026-05-distribution-channels/`](../../agents/evidence/audits/2026-05-distribution-channels/) — the underlying audits (01 Claude, 02 Augment, 03 installer flow).
- [`README.md § Installation`](../../README.md) — consumer-facing install path.
