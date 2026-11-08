<!-- evidence-type: analysis -->

# Can a hook recognise `git commit`, `git push` and `gh pr create` in real Bash calls?

The spike both council seats asked for before choosing between a kernel-frontmatter
`shell_command` trigger (A) and parking (C) — question
`agents/evidence/council/shell-command-trigger-design-20261108.question.md`, anthropic
`C` (choose A if detection reaches < 1 % false negatives on a representative corpus,
with explicit coverage bounds), openai `A` (measure recognition before anything else).

**Corpus:** every `Bash` tool call in the 34 local Claude Code transcripts of this
repository's project store on 2026-11-08 — 14,834 commands, written by agents doing
real work. The transcripts stay local; only counts are recorded here.

**Recognisers:**
- *naive* — the command starts with `git commit` / `git push` / `gh pr create`.
- *segmenting* — heredoc bodies removed (`<<[-]['"]TAG['"]` to the line `TAG`), the
  rest split on `;`, `&&`, `||`, `|` and newlines outside quotes; per segment, leading
  `VAR=…` assignments and `sudo` / `command` / `time` / `exec` / `nohup` dropped, and
  `git -C <dir>` / `git -c k=v` skipped.

| Act | Segmenting recogniser | Naive prefix | Naive recall | Forms (chained · plain · `git -C/-c`) |
|---|---:|---:|---:|---|
| `git commit` | 991 | 169 | 17.1 % | 802 · 138 · 51 |
| `git push` | 508 | 126 | 24.8 % | 500 · 3 · 5 |
| `gh pr create` | 129 | 40 | 31.0 % | 97 · 32 · 0 |

**Audit of the segmenting recogniser.** Commands containing the literal text `git
commit` that it did not recognise: 9. Eight are correct negatives — the text inside a
heredoc (roadmap prose, a council question, a script body) or `git commit-tree`. At most
one is a miss. Upper bound on false negatives for `git commit`: 1 / 992 ≈ 0.1 %. A
sample of recognised commands was read and each was a real commit; quoted text and
heredoc bodies are excluded by construction.

**Coverage bounds, stated:** recognised are simple commands, chains, pipes, env
prefixes, `git -C`/`-c`. Not recognised: commands built at runtime (`eval`, `$CMD`),
aliases and shell functions, wrappers that invoke git themselves (`gh repo sync`,
scripts), and `bash -c "…"` strings. A recognised act is a fact; an unrecognised one is
not evidence that no act happened.

**Reading:** the < 1 % false-negative condition holds on this corpus; a prefix match
does not (it misses 83 % of commits, because agents chain). Any shell-command trigger
must segment.
