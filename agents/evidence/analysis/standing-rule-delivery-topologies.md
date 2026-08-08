# Standing rule delivery — measured per install topology

> **Produced by:** P0.3 of `road-to-rule-delivery-integrity`.
> **Measured:** 2026-08-08 · host Claude Code `2.1.226` · repo `9.27.0`.
> **Method:** byte counts from the live filesystem; token counts via this repo's
> own `src/scripts/_lib/token_count.ts`. GPT counts are **exact BPE**
> (`cl100k_base`, `tiktoken available: true`); Claude counts are that module's
> declared `chars/3.6` **proxy** and are labelled as such. Where one number is
> quoted below it is the exact GPT count.
> **Loading contract:** `agents/evidence/analysis/claude-code-rules-dir-contract.md`.

## The six topologies

| # | Topology | Rule entries loaded | Chars | Tokens (exact GPT) | Redundant tokens |
|---|---|---|---|---|---|
| 1 | **global-only** (`~/.claude/rules/`) | 112 | 406,068 | **101,247** | 0 |
| 2 | **project-only** (`<repo>/.claude/rules/`) | 92 | 302,525 | **75,107** | 0 |
| 3 | **both, deliberate** | 204 entries · 113 distinct rules | 708,593 | **176,354** | **74,137 (42%)** |
| 4 | **both, accidental** | identical to row 3 | identical | identical | identical, and fully recoverable |
| 5 | **monorepo** — one global layer, N projects | 112 + that project's layer | 406,068 + p | 101,247 + p | 74,137 in every project session that also carries a project layer |
| 6 | **multi-user machine** | per-user, no sharing | per-user | per-user | per-user; the amplified risk here is **drift between users' global layers**, not per-session bytes |

Row 3 is this maintainer machine's actual state today. Claude-proxy readings for
the same rows, for completeness: 112,797 · 84,035 · 196,832.

Rows 3 and 4 are byte-identical on purpose. The distinction the roadmap asks for
is **intent**, and it decides installer behaviour, not cost: a deliberate
two-layer setup gets a warning it can dismiss; an accidental one is the defect
`claudeMdExcludes` should suppress. Nothing in the filesystem distinguishes them,
which is why P1.1 has to **ask** rather than infer.

## Risk #2 resolved — duplication, not a version skew

All 91 overlapping basenames differ byte-for-byte, which looks like a skew and
is not one. The entire difference is two frontmatter keys the installer adds to
its own copies:

    package: event4u/agent-config
    source_path: dist/agent-src/rules/<name>.md

Stripping exactly those two lines, **91 of 91 bodies are identical**. So the
global layer is not a stale copy, dedup is sufficient, and P1.1 does not need to
grow a refresh step. Risk #2 is **not present at this measurement**; it is not
eliminated, because nothing prevents it later — which is why P1.1's detection
must compare bodies (modulo those two keys) and not just basenames.

## A coverage gap in the other direction — the project layer is short 23 rules

> **Corrected 2026-08-08, same day.** This section first said "21 rules" and
> attributed the gap to a **stale symlink set** on the strength of the `.claude/rules`
> entries being dated 2026-07-05. That explanation is **refuted**: a fresh
> `task sync` followed by `task generate-tools` reported `rules=0` and left the
> directory at 92 entries, so regeneration reproduces the same set and the mtime
> only reflects that idempotent regeneration does not rewrite an unchanged
> symlink. The count is also 23, not 21 — the 21 was measured against the global
> layer's 112 rather than against `dist/`'s 115, which is the right denominator
> for "what should have been projected". Both the number and the cause are
> restated below from measurement.

| Direction | Count | Tokens | What it is |
|---|---|---|---|
| in `dist/agent-src/rules/` but NOT in `.claude/rules/` | **23** | ~25k (measured against the global copies of 21 of them: 24,961) | every one is `type: "auto"`; a fresh regeneration does not add them |
| project-only files | 1 | 970 | `source-of-truth.md` — maintainer-workspace-scoped, correctly absent from a user-global install |

The 23, all `type: "auto"`: `active-remediation` · `broken-access-control` ·
`code-comment-discipline` · `code-provenance` · `communication-through-line` ·
`content-quoting-floor` · `council-availability` · `cross-source-consistency` ·
`decision-revisit-gate` · `design-review-after-ui-write` ·
`doc-screenshot-hygiene` · `evaluator-independence` ·
`external-code-graph-interop` · `history-discipline` ·
`prefer-enums-over-literals` · `question-not-instruction` · `scale-discipline` ·
`secret-vcs-guard` · `self-repair-loop` · `senior-engineering-discipline` ·
`session-canary` · `settings-ask-protocol` · `spreadsheet-source-quality`.

What is measured, and what is not:

- **Measured:** `dist/agent-src/rules/` holds 115 `.md`; `.claude/rules/` holds
  92 symlinks; the 23-file difference is exactly the list above; every one is
  `type: "auto"` and none is `type: "manual"` (so ADR-004's reference-only
  carve-out does not explain them); `task sync` then `task generate-tools`
  reported `rules=0` and changed nothing.
- **Not established:** *why* the projection excludes them. The candidates are the
  workspace/pack filter (`rule_in_scope` at `condense.ts:1092-1099`) and the
  lean/thin projection branch (`condense.ts:1146`). This project's
  `.agent-settings.yml` declares no `workspaces` / `packs` / `projection` key at
  all, which per the settings carve-out contract is exactly the sparse-file case
  where an absent key does **not** resolve to the template default — so a scope
  resolving to something unintended is a live hypothesis, not a conclusion.

**Consequence, and it is the sharper half of this document.** On this machine
every one of the 23 still reaches the session — through the *global* layer. The
duplication is therefore **masking** the projection gap: fix the duplication by
suppressing the global layer and a project-only install silently loses 23
obligations, among them `secret-vcs-guard`, `broken-access-control`,
`senior-engineering-discipline` and the just-shipped `self-repair-loop`. That
ordering matters for P1.1: `--layer=project` is the more dangerous of the two
choices on any machine where this gap exists, and the installer cannot currently
tell the user so.

Out of this roadmap's scope — the projection logic belongs to `condense.ts` and
`check_rule_projection_integrity.ts` is the gate that should have caught it.
Surfaced to the maintainer, not fixed here.

## What this sets for P1.2's ceiling — and what it cannot reach

A ceiling anywhere **below 176,354** catches the doubled state, and anywhere
**above 101,247** admits a complete single layer. So the gate's useful band is
narrow and well-defined; a ceiling of **110,000 exact-GPT tokens** for the
standing rule set fails row 3 and passes rows 1 and 2 with ~9% headroom.

Two ceilings must not be conflated. The coherence-followup pre-registered
**≤ 30k tokens of always-on rule prose**; that is a claim about the
*always-honoured* set, which a discipline profile trims. This measurement is the
*projected file set*, which **no profile trims** — verified at
`compile_router.ts:266-272` against `condense.ts:1092-1099`. Consequently:

- Dedup alone moves 176,354 → 101,247, a **43% cut**. Real, and the cheapest
  available.
- 101,247 → ≤ 30,000 is **not reachable by dedup**. It needs `paths:` scoping
  plus the digest, i.e. Phase 3. Any plan that promises the 30k figure from
  Phase 1 alone is promising something this measurement rules out.
