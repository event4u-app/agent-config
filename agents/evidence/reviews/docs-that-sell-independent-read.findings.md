<!-- evidence-type: original-review -->

# Independent read — findings and dispositions (2026-11-01)

Prompt: `docs-that-sell-independent-read.review-input/prompt.md`. One round, one
reviewer session that did not write the copy, read against the README and the
docs landing page at commit `6df8a52cc7`. Line numbers refer to that commit.

## Findings (condensed from the reviewer's report)

| # | Finding | Where | Disposition |
|---|---|---|---|
| 1 | The sub-line promises the tools "plan, test and verify"; the page later says only Claude Code can block and a strong model showed no gain | README:9, index.mdx:7 vs README:44-46, 61 | fixed — the sub-line says the agents are told to, and names the Claude Code block |
| 2 | "not into your repository" contradicts `agents/overrides/`, the gitignored bookkeeping files and the lockfile | README:3, 138-140, 206 | fixed — caption names what the repository gets |
| 3 | "works with 20 AI coding tools — not only Claude and Codex" overpromises: Codex reads skills only, the README table lists 12 tools | README:3, 185, 196 | fixed — caption drops "not only Claude and Codex"; the tool section says what each tier gets |
| 4 | Claude Desktop described as an uploaded bundle and as a marker | README:185 vs 200 | fixed — one description |
| 5 | Cost, price, licence and requirements are missing from the first screen of both pages | README:15, index.mdx:31 | fixed — one strip under the install command |
| 6 | The first-screen GIF shows the proof page, not the product | README:17 | fixed — GIF moved to "Prove it" |
| 7 | The before/after shows a curl'd subagent, "planted cases" is jargon, n=2 not stated plainly | README:38-42 | partly — wording now says "two cases: one with a placeholder left in, one finished"; the sentence that the subagent ships with the install was NOT written, because the install delivers only a persona of that name, not the `.claude/agents/` subagent (`CLAUDE_SKILL_BUNDLE` in `src/install/wizard-plan.ts`) |
| 8 | No line on what leaves the machine (council sends work to other providers with your own keys) | README:69-75 | fixed — one line naming the daily update check, the daily merged-PR check through your own `gh` login and the opt-in second opinion, linking the network page |
| 9 | Role profiles vs `--profile minimal\|balanced\|full` share one word | README:85-98, 176 | fixed — the second is called the rule level |
| 10 | Repetition of the user-global sentence, the Claude Code caveat and the Introduction link | README:116, 135-140, 164; index.mdx:76 | fixed |
| 11 | Jargon: hollow, planted, published null, task family, dormant, projection | README:42, 71, 170; index.mdx:80 | fixed where it is user copy |
| 12 | "Commands 213 … the linked directory holds 63" undercuts credibility | README:170 | fixed — the footnote names where the 213 are listed |
| 13 | Docs "Get started" button goes to the introduction | index.mdx:10 | fixed — goes to Install |
| 14 | Profiles for non-engineers sit high for a developer audience | README:85-98 | kept — the README serves all six profiles by design (message house persona 3) |
| 15 | No real sample of `/work` output | README | recorded — needs a capture of a real run; not produced in this change |
