---
proposed_by: claude-opus-5.5/drain-road-to-gates-that-read-what-was-written-20261019z
implemented_by: claude-opus-5.5/drain-road-to-gates-that-read-what-was-written-20261019z
reviewed_by: ai-council/anthropic-claude-sonnet-4-5+openai-codex-default-2026-10-19
providers: [anthropic, openai]
verdict: refused
seats:
  anthropic: refused
  openai: refused
subject: 8e66972b44b37389763d39aa9edcd391afc4bfbbcc0a92e19b14f772fcfb7350
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review — the speaking-inbox guard, Phase 3, refused 2/2

A **non-passing** record. It is committed so the next lane does not spend this
round again and starts from the two defects it found. The change it reviewed is
**not** in this branch: commit `2bf64f699` was reverted, and the net diff
against `origin/main` for `src/scripts/hooks/block_speaking_inbox_dir.ts` and
`tests/hooks/block_speaking_inbox_dir.test.ts` was verified as empty (0 lines),
not inferred from the revert's exit code.

## What was reviewed

Branch `drain/road-to-gates-that-read-what-was-written-20261019z` at
`0c32dc78d`, subject `8e66972b…` over one gated file,
`src/scripts/hooks/block_speaking_inbox_dir.ts`. Two changes, for steps 3.1–3.4
of `road-to-gates-that-read-what-was-written`:

1. The exists-probe base became the first non-empty of `project_dir`,
   `payload.cwd`, `envelope.cwd`, `workspace_root`, instead of `project_dir`
   alone — a key no producer sets.
2. `creatableTokens` returned no tokens for exactly the remediation shape the
   deny message prescribes, `printf '%s' '<literal>' | [./]scripts-run
   src/scripts/_lib/link_crypto encrypt`.

The prompt is committed verbatim as
`agents/evidence/council/speaking-inbox-guard-mention-review-20261019.question.md`;
both seat texts beside it as `….anthropic.md` and `….openai.md`. One round, CLI
seats, `$0.00`, blind peer review across the two seats.

## Findings — both seats, convergent

| # | Severity | Finding | Where |
|---|---|---|---|
| F1 | high | The exemption trusts the command's spelling, not the executable's identity. `(?:\.\/)?` admits a bare `scripts-run`, which resolves through `PATH`; whatever runs there may create the named directory while the guard sees no token. | `ENCRYPT_REMEDIATION_RE` |
| F2 | high | `project_dir` outranks the base a Bash command actually runs in. A directory present under `project_dir` and absent under `payload.cwd` reads as existing while `mkdir -p` creates it in the other tree. The comment said the shell's `cwd` decides; the order did not. | the `repoRoot` cascade in `main` |
| F3 | medium | No test supplies conflicting non-empty base fields, a bare `scripts-run`, or relative Write versus Bash inputs from their respective bases. 84/84 green measured the fallback, not the boundary. | the new describe block |

The openai seat classified the change as touching an owner-reserved floor
(commands previously refused can create a speaking directory under mismatched
bases or an ambiguous executable). The anthropic seat classified both as
authority expansions. Both agreed that the quoted-literal shape itself — single
quotes, no newline, no chaining or substitution — is sound in intent.

## What a next round would have to carry

Stated as the seats stated it, not as a design this lane chose:

- **A tool-specific base.** Bash uses its effective `cwd`; a path-keyed write
  uses its own documented base. One shared precedence chain is not justified.
- **An executable anchored to the repository**, not a spelling: `./scripts-run`
  is necessary and, per the openai seat, may not be sufficient unless the hook
  establishes that the command runs from the root holding the trusted script.
- **Suppress the known-safe plaintext occurrence**, not the whole command's
  token list.
- **Conflicting-field regressions** for every pair above.

The red cases this lane observed at `1a334dd16` (5 allow-cases red, every
block-case green) remain valid evidence of M6 and M7; they are in the question
file's test diff.

## What this record does NOT establish

It does not establish that the reverted design is wrong in purpose, only that
this implementation of it can reach a state the base refused. It does not
reopen D2: neither seat asked for a command classifier.
