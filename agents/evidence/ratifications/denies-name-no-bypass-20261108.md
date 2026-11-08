---
proposed_by: round inbox-2026-11-zc analysis (claude-opus-5.5 session), executed under the owner's 2026-11-08 instruction to process the updated roadmaps with branches, PRs and merges
implemented_by: claude-opus-5.5 session on fix/denies-name-no-bypass
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), rounds 1-11 of 2026-11-08
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: confirmed-non-expanding
effective_after: merge
subject: 37ad06d29ba17f51f6c8e1dceb02ebd5999187bdc3b651c0b4f90f596d8c86df
---

<!-- evidence-type: ratification -->

# Ratification: deny texts that name no bypass

`check_kernel_edit_ratified` gates the governance hooks this branch edits:
`block_credential_reads.ts`, `block_kernel_rule_writes.ts`, `block_no_verify.ts`,
`block_speaking_inbox_dir.ts` and `block_config_weakening.ts`. The `subject:` digest
above was computed with `./scripts-run src/scripts/ratification_subject --files <the
branch's changed files>` at `c861b91834`. The file is named after the branch because
the pre-push gate reads it before the PR exists.

## What was ratified

Each of the five hooks changes only the text it prints when it refuses. Two had been
printing the environment variable that turns them off, through a template literal.
Three had been telling the refused agent to remove its own entry from the hook
manifest. Each now gives the reason and names a maintainer change reviewed in its own
PR as the legitimate route. No enforcement branch, exit code or exemption changed.

**What each seat said about the gated subject:** both seats found the hook edits
non-expanding in every round from 1 to 11. Anthropic's final verdict (rounds 7 to 11)
was `ratified`. OpenAI's final statement on the governance question (round 11) was
`confirmed-non-expanding`: "applies to the five hook text edits: no enforcement branch
changes, refusal removal, or newly permitted operation appears". It is recorded
exactly as that.

## What OpenAI refused, and what became of it

From round 3 onward, OpenAI's REQUEST_CHANGES concerned `lint_deny_text.ts`. That
file is the gate that keeps deny texts free of bypasses. It is not one of the gated
files. Each round named a construction the lint missed:

| Rounds | Miss | Resolution |
|---|---|---|
| 1-3 | shadowed constants, plain-string interpolation, escapes, holes combining into a switch, line continuations | first tokenizer-based resolution |
| 4 | a bare template filtered before resolution; a second declarator | the gate now reads the TypeScript AST |
| 5-6 | three-pass cutoff, silent depth limit, long chains, `as const`, destructuring | fixed point; fail closed on unevaluable author-fixed values |
| 7-10 | declaration-order masking, aliases, numeric coercion, other operators, unary, arithmetic | denylist of runtime forms; author-fixed text evaluates or fails |
| 11 | prose reached through an unreadable constant | fails closed |

Each miss has a self-test case that was shown failing before its fix: 37 cases, 27
of them rejecting. After round 10 the fix-loop bound (10) was reached. The new epoch
narrowed what the lint's header claims: it now describes itself as a model of the
JavaScript an author writes in a deny, with review of the deny text as the control
and the gate as the net under it, not a proof. A construction outside that model may
still escape the lint. That residue is stated in the header, not hidden.

## How the verdict was reached

Every round's question is committed verbatim under `agents/evidence/council/`:
`denies-name-no-bypass-20261108.question.md` for round 1 and
`.roundN.question.md` for rounds 2 to 11. No round's prompt stated an expected
outcome. Round 2's OpenAI seat timed out; rounds 3 to 11 used a longer member
timeout. On the tree before this branch, the lint reports one finding in each of the
four hooks it then covered. On the tree after, it reports none across the nine
blocking concerns.
