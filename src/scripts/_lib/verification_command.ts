/**
 * The verification-command selector, extracted from `hooks/turn_end_gate_hook.ts`.
 *
 * It moved here byte-identical — same regex, same function, same audit trail —
 * so that `_lib/verification_evidence.ts` can read it without importing a hook
 * that imports the evidence module straight back. That cycle resolves at
 * runtime today and breaks the day either side grows a module-level constant
 * reading the other, which is a failure nobody would trace to an import line.
 *
 * The hook re-exports the name, so every existing consumer — including both
 * pinning test files — addresses it at the path it always did.
 */

/**
 * Shell commands that count as verification.
 *
 * A positive list, and deliberately narrow. The alternative — treating any
 * `Bash` call as verification — was rejected because `ls` would then clear an
 * unverified edit, which is the failure mode `verify-before-complete` names
 * ("relying on partial verification"). The cost of narrowness is a MISSED
 * detection when a project verifies by some command not listed here, and that is
 * the safe direction for a gate that can refuse a turn: a false negative costs
 * one unguarded turn, a false positive teaches the user to switch the gate off.
 *
 * AUDITED 2026-08-17. 52 commands this project's own surface actually produces (its `package.json`
 * scripts, its `Taskfile` targets, `./scripts-run`, `./agent-config`, and the
 * PHP / Python / Go / Rust toolchains) were run through
 * `isVerificationCommand`. The table of every one, with its verdict, is
 * `turn_end_verify_allowlist.test.ts`, and every addition below has a row in it.
 *
 * The draft that opened the roadmap expected to add `phpunit` and `pest`. Claim
 * 4 had already overtaken that — both matched before this audit, as did
 * `composer test` and `php artisan test` — so what the audit actually found was
 * two different gaps:
 *
 *   · `phpstan` — a static analyser of exactly the class already listed
 *     (`mypy`, `pyright`, `clippy`). Added.
 *   · `lint` followed by a WORD character — `lint_persistence`,
 *     `lint_provenance`, and every other `lint_*` script in `src/scripts/`
 *     missed, because `\blint\b` needs a boundary and `_` is a word character.
 *     `lint[-_:a-z]*` is the exact mirror of the `check[-_:a-z]*` this list
 *     already carried, which is why it is the narrow fix rather than a new idea.
 *
 * Four further misses were found and deliberately NOT added, because Risk 2 of
 * that roadmap is that every addition is a way to satisfy the gate without
 * verifying anything:
 *
 *   · `npm run prepack` — a lifecycle hook whose content is per-project. Here it
 *     validates; elsewhere it copies files. Recognising it would clear an
 *     unverified edit in any repo whose prepack is a build step.
 *   · `task sync` / `task generate-tools` / `agent-config roadmap:progress` —
 *     GENERATORS. They rewrite the tree; they check nothing. A generator that
 *     cleared the gate would be the rubber stamp in its purest form.
 *   · `agent-config gates --all` — enumerates gates, runs none.
 *   · `vendor/bin/rector process --dry-run` — a refactoring tool. Its dry run
 *     prints a diff; it does not assert anything holds.
 *
 * `psalm` is the obvious sibling of `phpstan` and is also NOT added: nothing in
 * the audited surface runs it, and "the team actually runs" is the step's own
 * standard. It is named here so the next audit does not re-derive the question.
 *
 * WHAT THIS SELECTOR STILL CANNOT DO, now that a record-reading classifier sits
 * beside it: it reads the command TEXT, so `echo test` matches it — the word
 * `test` is in the pattern. That is not a defect to fix here. The selector's job
 * is to decide what is WORTH recording and classifying; deciding whether a run
 * actually proved anything is `verification_evidence.ts`, which reads the exit
 * code and the summary the command printed. Widening the regex to exclude
 * `echo` would chase an unbounded set of ways to spell a no-op.
 */
const _VERIFY_RE =
    /\b(test|tests|vitest|jest|pytest|phpunit|pest|tsc|eslint|ruff|mypy|pyright|clippy|phpstan|typecheck|lint[-_:a-z]*|build|ci|preflight|smoke[-_:a-z]*|check[-_:a-z]*|validate[-_:a-z]*)\b|\b(task|npm|pnpm|yarn|composer|cargo|go|make|php artisan|bun)\s+(run\s+)?\S*(test|check|lint|build|ci|typecheck)/i;

export function isVerificationCommand(command: string): boolean {
    return _VERIFY_RE.test(command);
}
