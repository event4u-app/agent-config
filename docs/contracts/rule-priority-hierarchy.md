---
stability: beta
---

# Rule Priority Hierarchy

> **Audience:** anyone reading or editing `.agent-src.uncompressed/rules/*.md`,
> or trying to predict which rule wins when several fire on the same turn.
> **Machine-readable counterpart:** [`rule-interactions.yml`](rule-interactions.yml)
> (linted by `scripts/lint_rule_interactions.py`).
> **Diagram + pair-by-pair narrative:** [`rule-interactions.md`](rule-interactions.md).

This document is the **ordered list** view. The matrix files describe
how *pairs* of rules interact; this file states **which band wins**
when the bands themselves disagree.

## The four-line principle

```
Safety beats autonomy.
Scope beats helpfulness.
Verification beats completion.
User intent beats command suggestion.
```

Every band below is a concrete instance of one of those four lines.
When in doubt, walk the list top-down and stop at the first band that
fires — that band's canonical rule decides the turn.

## The ordered list

| Band | Rule | What it gates | Lifts under |
|---|---|---|---|
| 1 | [`non-destructive-by-default`](../../.agent-src.uncompressed/rules/non-destructive-by-default.md) | Prod-trunk merge · deploy · push · prod data/infra · whimsical bulk deletion · bulk-deletion or infra commit | **Never.** Explicit user confirmation *this turn* only. |
| 2 | [`security-sensitive-stop`](../../.agent-src.uncompressed/rules/security-sensitive-stop.md) | Auth · billing · tenant boundaries · secrets · file uploads · webhooks · public endpoints | Threat-model pass completed and recorded *before* the edit. |
| 3 | [`scope-control`](../../.agent-src.uncompressed/rules/scope-control.md) | Git ops (branch · PR · tag · push · merge · rebase) · architectural changes · new libraries · scope expansion | Explicit user permission *this turn* or unrevoked standing instruction. |
| 4 | [`ask-when-uncertain`](../../.agent-src.uncompressed/rules/ask-when-uncertain.md) | Ambiguous requirements · vague-request triggers · fenced steps | Concrete evidence resolves the ambiguity, **or** user answers the single question. |
| 5 | [`commit-policy`](../../.agent-src.uncompressed/rules/commit-policy.md) | Any `git commit` | Four exceptions only — explicit "commit now", standing instruction, `/commit*` invocation, roadmap authorization. |
| 6 | [`verify-before-complete`](../../.agent-src.uncompressed/rules/verify-before-complete.md) | "Done" / "complete" claims · suggestions to commit, push, or PR | Fresh verification evidence in *this* message. |
| 7 | [`autonomous-execution`](../../.agent-src.uncompressed/rules/autonomous-execution.md) | Trivial-vs-blocking classification · autonomy opt-in detection | Per-step decision; never above bands 1–6. |
| 8 | [`command-suggestion-policy`](../../.agent-src.uncompressed/rules/command-suggestion-policy.md) | Surfacing slash-command matches as numbered options | User always picks; nothing auto-executes. |
| 9 | [`language-and-tone`](../../.agent-src.uncompressed/rules/language-and-tone.md) | First-token language of every reply · `.md` always English | Mirror the user's last chat message — no momentum exception. |

**Read direction:** top-to-bottom is *priority on conflict*, not chronology.
A turn typically touches several bands at once; the hierarchy decides
which one's Iron Law gets the final say.

## Index rules

- **Higher band wins.** A band-3 permission does not lift band-1; a band-5
  commit exception does not lift band-3. Each band's "Lifts under" column
  is its own escape hatch and only its own.
- **No band restates an Iron Law.** Iron Laws live verbatim in the
  canonical rule files. This hierarchy points; it does not paraphrase.
- **Bands 1–2 are *Hard Floors*.** No autonomy setting, no roadmap step,
  no standing instruction lifts them. See
  [`agent-authority`](../../.agent-src.uncompressed/rules/agent-authority.md)
  § Index rules for the matching authority statement.
- **Unsure → ask.** [`ask-when-uncertain`](../../.agent-src.uncompressed/rules/ask-when-uncertain.md)
  is the universal escape hatch when the band is unclear.

## Worked examples

| Situation | Bands that fire | Winner | Why |
|---|---|---|---|
| Standing autonomy + roadmap step says "merge to `main`" | 1, 7 | **1** | Hard Floor predates and outranks autonomy; surface the merge, ask. |
| `/commit-in-chunks` on a diff that removes a directory | 1, 5 | **1** | Commit exception authorizes *commits*, not *bulk deletions*. Confirm diff this turn. |
| User asks "improve this" with no metric named | 4, 7 | **4** | Vague-request trigger fires before any autonomy decision; ask the one clarifying question. |
| Editing `app/Auth/PasswordReset.php` mid-feature | 2, 7 | **2** | Security-sensitive surface stops the edit until threat-model is recorded. |
| Agent about to claim "ready to merge" with no fresh test output | 5, 6 | **6** | Verification gate fires before the commit/push question is even valid. |
| User types free-form prompt that matches `/refine-ticket` | 8, 9 | **8 + 9** | Suggestion runs as numbered options, mirrored to user's language. No conflict. |

## Cross-references

- [`agent-authority`](../../.agent-src.uncompressed/rules/agent-authority.md) — the four-band authority router (bands 1–3 + 7 of this hierarchy).
- [`rule-interactions.md`](rule-interactions.md) — pairwise interaction narrative + Mermaid diagram.
- [`rule-interactions.yml`](rule-interactions.yml) — machine-readable, CI-linted matrix.
- [`STABILITY.md`](STABILITY.md) — what the `stability: beta` tag means for breaking changes.

## Stability

`beta` — the band ordering and four-line principle are settled, but
the *worked examples* and the inclusion of band 8 (`command-suggestion-policy`)
in the public hierarchy have not yet shipped through one major release.
A breaking change to the band ordering is a SemVer-minor-pre-1.0 bump
or a SemVer-major bump after 1.0. Adding a row, refining a "Lifts under"
clause, or expanding the worked-examples table is non-breaking.
