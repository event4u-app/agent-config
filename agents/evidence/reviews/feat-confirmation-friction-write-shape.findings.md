# Findings: feat-confirmation-friction-write-shape
<!-- completion-review: v1 | reviewed: 2026-09-10 | scope: 4cdc440ddbac98790f4f0319437b64f23916f824cfd7980b43044cf02399df30 | diff: 65e260d78f63121b31f92020e4939fff33bc2780 | reviewer: r2-fresh-subagent-feat-confirmation-friction-write-shape | prompt_hash: 7ad6dd1b400deb9ae9cb86981cff16c352249fae4041c9d5ea3d68a43018f153 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-feat-confirmation-friction-write-shape"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-09-10 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 65e260d78f63121b31f92020e4939fff33bc2780
  scope_hash: 4cdc440ddbac98790f4f0319437b64f23916f824cfd7980b43044cf02399df30
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-09-10T06:28:15Z
-->

> **Re-bound in place after the fix pass** (contract § 2.7). Every row below
> is terminal and cites the commit that closed it; the finding text is the
> reviewer's and is unchanged. `scope` names the post-fix content, while
> `diff`, `reviewer` and `prompt_hash` still name the round the findings were
> made against — which is what makes the pairing checkable.

## Reviewer, and what it reviewed

Fresh single reviewer, no implementation context. Inputs were the dispatcher's
own `prompt.md` and `diff.patch` verbatim, plus reads of the ten branch-touched
paths and of `src/scripts/hooks/category_a.ts` for the refusal order the probe
mirrors. Search grid as specified: errors, inconsistent logic, inefficiencies,
bug-producing patterns.

Most rows below were **executed** rather than read off the diff — the write and
chain detectors over roughly fifty commands, `classify` / `firstDisqualifier`
over eight, `main` over four argument sets, and the hook itself driven
end-to-end through stdin with three latch-file states. Four rows record
behaviour that contradicts a comment in the same file.

Not consulted, per the tool allowlist: repository history beyond the branch,
`agents/runtime/`, and the transcript store the probe measures. Every hook drive
used a throwaway temp root, so no runtime state in this checkout was read or
written.

### The round-1 dispositions, re-checked against the current tree

Eleven of the thirteen hold as recorded. Verified fixed: the single-population
figures (every artefact now reads 7,530 / 39 / 306 / 4.1 %, and 216+66+16+7+1
sums to 306, 7,105+21+279 to 7,405); the shared metacharacter class (exported,
imported, identity-tested); the disqualifier buckets (`firstDisqualifier`'s
order now matches `isCategoryABashCommand`'s refusal order token for token, and
the residual bucket is relabelled and pinned as an upper bound); the three
detector false negatives; both denominator errors; the hot-path double work; the
manifest comment wrap.

Two do not hold as recorded, and four of the fixes introduced something new.
Finding 11 is marked fixed for both flags and only `--limit` was validated (row
6). Finding 4's class recurs through the sibling delivery path (row 1). The fix
for 5b converted a false negative into a false-positive class (row 3), its
flag-cluster generalisation over-fires for `perl` (row 4), the fix for 10 lost
the latch-read validation (row 2), and the test written for 11 cannot see the
validation it pins (row 5). Finding 13 was answered with a read-date rather than
a citation; that is a defensible response and is not re-raised.

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/hooks/chain_nudge_hook.ts:286 | Every write rule is tested against `stripQuoted`, which by its own JSDoc (`:173`) leaves heredoc bodies IN PLACE — so a heredoc-delivered *mention* of any write shape fires the nudge. Driven end-to-end through the hook with a temp root: `git commit -F- <<'EOF' / fix the sed -i regression / EOF` returns exit 2, emits the write line, and writes `{"s1":{"edit-by-shell":true}}` to the latch. A body naming `cat > f` and one naming `python3 -c open(p,'w')` do the same; the last is the exact string this change ships at `token-efficiency-mechanics.md:275`. This is round-1 finding 4 on the other delivery path, and the fix's own comment (`:276`-`:280`) states the defence as general — "the interpreter must sit at a command position in the STRIPPED text, where a quoted mention has already been removed". A heredoc is how a multi-line commit message is written in this repository. | fixed | The one write nudge a session gets is spent on a non-write, and the class is then latched silent; the header calls a nudge that fires on correct usage "worse than none" (`:43`-`:44`). No silence row covers a heredoc-delivered mention. Fixed in `49fc069f5`. |
| 2 | medium | src/scripts/hooks/chain_nudge_hook.ts:388 | `readLatch` dropped the shape validation the code it replaced had: `alreadyNudged` parsed inside a `try` and returned `false` for anything unexpected, while `readLatch` returns the parsed value unvalidated and `main:473` indexes it. Executed — latch file holding `null`: uncaught `TypeError: Cannot read properties of null (reading 's1')`, stack trace on stderr, **exit 1**, which is neither the allow nor the warn code and contradicts the header's "Every failure path returns allow: unreadable stdin, malformed JSON, unwritable latch" (`:48`-`:50`). Latch file holding a top-level primitive (`true`): the assignment inside `latch` throws into its own `try`, nothing persists, and three consecutive drives each returned exit 2 with the file unchanged — the per-call repetition the recorded decision quoted at `:57`-`:63` refuses. | fixed | Regression introduced by the round-1 finding-10 refactor (the read moved out of the guarded helper into `main`). One `isObject` guard in `readLatch` closes both branches. A crashing `pre_tool_use` concern is bound on three platforms. Fixed in `49fc069f5`. |
| 3 | medium | src/scripts/hooks/chain_nudge_hook.ts:257 | The `tee` rule requires only *some* non-space token after `tee `, so it fires with no path at all, and its `/dev/null` exclusion is bypassable because the flag group may match zero times and let `\S` land on the leading `-`. Executed: `tee -a`, `foo \| tee \| wc -l`, `foo \| tee -` and `tee -a /dev/null` all return "`tee` writes its input to a file". Round-1 5b's false negative was therefore converted into a false-positive class rather than into the path requirement the rule's comment claims to want ("A flag cluster before the path is normal", `:253`-`:255`). | fixed | `token-efficiency-mechanics.md:295`-`:297` states "A redirect that names no file being filled (`2>&1`, `> /dev/null`) is still not a write and is still not flagged", which `tee -a /dev/null` falsifies. Only `tee` with no trailing space stays silent, and that is what the new silence row at `chain_nudge_hook.test.ts:153` pins. Fixed in `49fc069f5`. |
| 4 | medium | src/scripts/hooks/chain_nudge_hook.ts:245 | The `perl` rule's `-[A-Za-z]*i[A-Za-z]*` matches a lowercase `i` ANYWHERE inside a flag cluster, so any `perl` flag containing one is reported as an in-place edit. Executed: `perl -Mstrict -e 'print 1'`, `perl -MList::Util -e 'print 1'` and `perl -Ilib script.pl` all return "`perl -i` edits a file in place"; `perl -MJSON::PP -e` escapes only because its cluster carries no lowercase `i`. The `sed` sibling at `:241` survives for the same accidental reason — no other `sed` short flag contains an `i` — which is luck, not a property the pattern establishes. | fixed | Introduced by the round-1 finding-5c generalisation from "own token" to "letter inside the cluster". `-Mstrict` and `-I<dir>` are the ordinary spellings, and the suite carries no `perl` silence row at all. Fixed in `49fc069f5`. |
| 5 | low | tests/scripts/autonomy_friction_traffic.test.ts:229 | The row "refuses a negative, a zero and a non-numeric limit" cannot fail for the property it names: all three cases run against `--store /nonexistent`, which already returns 1 from the empty-store path. Executed: `main(['--store','/nonexistent','--limit','7'])` — a VALID limit — also returns 1. Delete the validation the round-1 finding-11 fix added and the row stays green. | fixed | Exactly the anti-pattern round-1 finding 6 named (assertion true, rationale false), reintroduced by the fix for finding 11. A non-empty temp store, or an assertion on the stderr line, would give the row sensitivity. Fixed in `a469e717e`. |
| 6 | low | src/scripts/autonomy_friction_traffic.ts:309 | The `--store` half of round-1 finding 11 is unfixed although the disposition marks the finding fixed. `argValue` returns `undefined` when the flag is the last token, so `--store` with no value falls back to `defaultStore(repoRoot)` silently and the report measures a store the operator did not name; `--store --json` takes `--json` as the directory. | fixed | The neighbouring `--limit` comment (`:314`-`:318`) states the standard this misses: "A window is the report's denominator; a wrong one is a wrong measurement wearing the right shape." The store is the other half of that denominator. Fixed in `a469e717e`. |
| 7 | low | agents/evidence/analysis/confirmation-friction-traffic-2026-09-10.md:19 | The pinned `Tree SHA 7bf325f3b3e659d9d568780fe9ed46a10d6e502a` names a tree that does not contain the instrument. Verified: `git cat-file -e 7bf325f3b…:src/scripts/autonomy_friction_traffic.ts` reports the path "exists on disk, but not in '7bf325f3b…'" — and the same table's Instrument row says the command is "new in this change". A reader following the recipe cannot run it at the pinned tree. | fixed | In the record whose § 4 exists so the comparison is "reproducible rather than remembered". The date, store, window and command rows are sound; only the SHA row points somewhere the instrument is absent. Fixed in `26551751e`. |
| 8 | low | agents/evidence/analysis/confirmation-friction-traffic-2026-09-10.md:164 | "The write count moved 293 → 306 on the fixes" attributes the delta to the detector fixes, but the two figures come from different populations: 293 over 7,518 calls with neither dedupe-by-tool-use-id nor exclusion of the measuring session, 306 over 7,530 in 39 transcripts with both — and both controls were added in the same round. | fixed | § 4 of this same record states that a later figure measures the window as well as the tree; § 6 then makes exactly that cross-window attribution. The direction is plausible; the causal claim is established by neither run. Fixed in `26551751e`. |
| 9 | low | src/agent-src/contexts/communication/rules-auto/token-efficiency-mechanics.md:283 | "strips quoted spans and heredoc bodies so an operator inside a string literal cannot be misread" is false for the write class as of this change: that class runs on `stripQuoted`, whose JSDoc says "heredoc bodies LEFT IN PLACE". The consumer-facing sentence describes the defence whose absence is row 1. The code carries the mirror error — `EDIT_BY_SHELL`'s JSDoc (`:226`) says its shapes are "matched on the literal-stripped command so a quoted mention cannot fire it", naming `stripLiterals`, the stripper these rules do not use. | fixed | Same line in the `dist` projection (`dist/agent-src/…/token-efficiency-mechanics.md:283`); `src` and `dist` are otherwise byte-identical apart from the expected link rewrite at `:134`. Fixed in `26551751e`. |
| 10 | low | src/scripts/hooks/chain_nudge_hook.ts:216 | `_detectChaining` treats a newline as a segment separator for the `VAR=` rule (`/[;\n]/`) but not for the plain two-step rule at `:220`, which tests `;` only. Executed: `VAR=x\necho $VAR` fires, while `git status\ngit diff` and `npm run build\nnpm test` are silent, as are `sleep 5 &` and `cmd1 \|& cmd2`. | fixed | The file header (`:12`-`:15`) and `token-efficiency-mechanics.md:201`-`:202` both name newlines, `&` and `\|&` as split points the host uses, so a newline-separated multi-step call is both un-nudged and absent from the new 4,548 / 60.4 % chain figure. The inconsistency sits inside the function this diff added. Fixed in `49fc069f5`. |
| 11 | low | agents/evidence/analysis/confirmation-friction-traffic-2026-09-10.md:62 | "Carrying the write-through-shell class \| 306 \| 4.1 % of all calls" counts five named commands, not calls that write a file through the shell. Verified silent: `echo x > f`, `printf "a" > f`, `jq . a.json > b.json`, `git show HEAD:f > f2`, `awk '{print}' a > b`, `cp a b`, `truncate -s 0 f`. | fixed | The expiring-grant reason the class is built on applies to each of those identically, so the pinned falsification target (4.1 %, 306 of 7,530) is a floor on the population it names: a later window in which the operator wrote `echo >` rather than `cat >` would show the share fall with nothing improved. Same figure at `token-efficiency-mechanics.md:241`. Fixed in `26551751e`. |
| 12 | low | src/scripts/hooks/chain_nudge_hook.ts:252 | The `cat` rule's `[^\n]*` between head and redirect makes it a general redirect scanner for any pipeline that happens to begin with `cat`, contradicting its own JSDoc "A positive list, not a redirect scan" (`:230`-`:232`). Executed: `cat f \| python3 -m json.tool > out.json` returns "`cat >` fills a file from the shell". | fixed | The advisory then names a shape the operator did not write, and the histogram's `216 cat >` bucket is not a count of `cat >` uses — while the identical trailing redirect behind any other head is counted nowhere (row 11). Fixed in `49fc069f5`. |
