<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-16, committed verbatim so the
     verdict beside it can be checked against what was actually asked
     (evaluator-independence: a recorded verdict whose prompt is not
     recoverable is not evidence). Not edited after the run. -->

# Should the estate gate require an added exemption to quote its owner search?

You are reviewing one change to a CI gate in a repository that ships rules,
skills and hooks for AI coding agents. Answer on the evidence below. Do not
summarise it back. Say whether the change should land as written, with changes
(name them), or not at all; give the strongest argument against your answer and
anything the change misses.

## Background

The repository keeps its plans as Markdown roadmaps under `agents/roadmaps/`.
A gate (`check_estate_count`) applies one-in-one-out: a change that adds an
active roadmap must archive, park or merge one in the same change, unless the
new file carries `estate_offset_exempt: <reason>`. Since 2026-10-01 the reason
of an ADDED file must name a rejected disposition word (archive, park, merge,
later/, offset, defer, fold, consolidate, absorb, retire); files already in the
tree are not re-read.

Measured on 2026-10-14: 28 of 29 active roadmaps carry the exemption, and one
subject has arrived as new work in at least 22 consumed intake rounds, because
deduplication happens only after a new file is written.

Measured on 2026-10-16 with the predicate below over the whole tree (active,
later/, stubs/, archive/): 26 of 296 exemption reasons already quote a search
that passes it; among the 34 active files, 18 pass and 16 do not. Only added
files are judged, so none of the 296 turns red.

## The change

An added exemption must now also quote the owner search it ran: a search verb
(grep, rg, find, search/searched, scan/scanned, or roadmap:context), a scope
naming `agents/roadmaps` (or roadmap:context, which searches only there), and a
result clause (e.g. "returns nothing", "0 hits", "→ 2 files"). A reason that
fails this gets a new finding kind `unsearched`, which reds the gate with a
message describing the expected shape and telling the author to land the
finding on an owner instead if the search found one. A reason without a
disposition word is still reported as `shapeless` first.

The intake commands (`/analyze:inbox` Phase 5, `/analyze:roadmap-repos`) gain
one matching instruction: a finding whose subject an existing roadmap owns
becomes a step and an `Arrivals:` line on that owner; a new file is written
only when the search is empty, and the search is quoted.

```diff
diff --git a/src/scripts/_lib/exemption_shape.ts b/src/scripts/_lib/exemption_shape.ts
index ea8b6e2e1..3e643a354 100644
--- a/src/scripts/_lib/exemption_shape.ts
+++ b/src/scripts/_lib/exemption_shape.ts
@@ -91,6 +91,34 @@ export function lemmasNamed(reason: string): string[] {
     return DISPOSITION_LEMMAS.filter((l) => new RegExp(`\\b(?:${l.source})`, 'i').test(reason)).map((l) => l.name);
 }
 
+/**
+ * Does this reason quote the owner search it ran — a command and its result?
+ *
+ * A disposition word says what was rejected; it does not say that anyone
+ * looked for an existing owner first, and re-arrival of an owned subject as a
+ * new file is the measured cost (road-to-an-intake-the-queue-can-carry). So an
+ * ADDED exemption also has to quote three things: a search verb (`grep`, `rg`,
+ * `find`, `roadmap:context`, searched, scanned), where it searched — the
+ * roadmap tree, unless the verb is `roadmap:context`, which only searches
+ * there — and what came back (`returns nothing`, `0 hits`, `→ 2 files`).
+ * Like the disposition check, this sees that the quote is there, not that the
+ * search was a good one; the diff reviewer judges that.
+ */
+const SEARCH_VERB_RE = /\b(?:grep|rg|ripgrep|find|search(?:ed|es|ing)?|scan(?:ned|s)?)\b|roadmap:context/i;
+const SEARCH_SCOPE_RE = /agents\/roadmaps|roadmap:context/i;
+const SEARCH_RESULT_RE = new RegExp(
+    [
+        String.raw`\b(?:returns?|returned|found|finds|yield(?:s|ed)?|gives?|gave|match(?:es|ed)?|shows?|showed|lists?|listed)\b[^.;]{0,80}?\b(?:nothing|none|no|zero|only|\d+)\b`,
+        String.raw`\b(?:\d+|no|zero)\s+(?:hits?|match(?:es)?|results?|files?|rows?|owners?)\b`,
+        String.raw`(?:→|->)\s*\S`,
+    ].join('|'),
+    'i',
+);
+
+export function quotesOwnerSearch(reason: string): boolean {
+    return SEARCH_VERB_RE.test(reason) && SEARCH_SCOPE_RE.test(reason) && SEARCH_RESULT_RE.test(reason);
+}
+
 /**
  * The comparison key for "two added files say the same thing".
  *
@@ -106,7 +134,7 @@ export function reasonKey(reason: string): string {
 /** One added file whose exemption reason does not hold up. */
 export interface ExemptionFinding {
     readonly file: string;
-    readonly kind: 'shapeless' | 'duplicate';
+    readonly kind: 'shapeless' | 'unsearched' | 'duplicate';
     /** For `duplicate`, the other added file carrying the same reason. */
     readonly twin: string | null;
     readonly reason: string;
@@ -131,6 +159,10 @@ export function exemptionFindings(
             out.push({ file: e.file, kind: 'shapeless', twin: null, reason: e.reason });
             continue;
         }
+        if (!quotesOwnerSearch(e.reason)) {
+            out.push({ file: e.file, kind: 'unsearched', twin: null, reason: e.reason });
+            continue;
+        }
         const key = reasonKey(e.reason);
         const twin = seen.get(key);
         if (twin === undefined) {
diff --git a/src/scripts/check_estate_count.ts b/src/scripts/check_estate_count.ts
index 6b8cc34f5..837aed13f 100644
--- a/src/scripts/check_estate_count.ts
+++ b/src/scripts/check_estate_count.ts
@@ -1403,6 +1403,16 @@ export function main(argv: string[] = process.argv.slice(2)): number {
                     '    221 exemptions, 43 name none; this check applies to ADDED files only, so\n' +
                     '    nothing already in the tree is re-read.\n',
             );
+        } else if (f.kind === 'unsearched') {
+            process.stderr.write(
+                `❌  ${f.file}: estate_offset_exempt quotes no owner search.\n` +
+                    `    reason: ${f.reason.slice(0, 160)}\n` +
+                    '    Before a finding becomes a new file, search for the roadmap that already\n' +
+                    '    owns it, and quote the search: the command, where it looked and what came\n' +
+                    '    back, e.g. "a grep over agents/roadmaps/{*,later,stubs} for <identifiers>\n' +
+                    '    returns nothing". If the search finds an owner, land the finding there as a\n' +
+                    '    step and an `Arrivals:` line instead. Added files only.\n',
+            );
         } else {
             process.stderr.write(
                 `❌  ${f.file}: estate_offset_exempt repeats ${f.twin ?? '(another added file)'} verbatim.\n` +
```

## The question

1. Should this land as written, with changes, or not at all?
2. Is the predicate too loose (passes boilerplate) or too strict (refuses a
   legitimate addition)? Name a concrete string for each failure you see.
3. Is anything missing that would make the quoted search checkable rather than
   merely present?
