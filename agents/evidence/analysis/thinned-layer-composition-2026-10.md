<!-- evidence-type: analysis -->

# The thinned layer, in one unit — composition, form, and what each move is worth

> Evidence for `road-to-a-thinned-layer-measured-in-one-unit`, steps 1.4, 2.4,
> 3.1, 3.2 and 4.3. Measured on 2026-10-06 against the branch
> `drain/thinned-layer-one-unit-20261006`, whose base is `main` @ `31e3da5ba`.

## The unit, stated before any number

Every figure on this page that is not explicitly labelled otherwise is in
**characters of the installed rule file after its frontmatter and its HTML
comments are stripped** — the unit `installed_layer.ts` reports, produced by
`ruleBody`, which is the same strip `project_thin_rules` and the delivery
carrier apply. It is **not bytes** and **not tokens**, and it is strictly
smaller than any raw-file figure in this tree, by whatever that corpus spends
on frontmatter and comments.

Three units appear on this page and they are never mixed in one sum:

| Unit | What it counts | Where it is used here |
|---|---|---|
| report characters | body after the frontmatter and comment strip | every unlabelled number below |
| raw file characters | the file as written, frontmatter included | the receipt's `365283 -> 123485` line only |
| GPT tokens | `tiktoken cl100k_base` | the projector's own measurement line only |

## The method

```bash
# 1. A fresh, empty HOME with the opt-in on the user-global layer.
#    <HOME>/.event4u/agent-config/settings/.agent-settings.yml:
#      lean_projection:
#        mode: delivery
#        hosts:
#          - claude-code
HOME=<fresh> EVENT4U_CONFIG_HOME=<fresh>/.event4u/agent-config \
  AGENT_CONFIG_NO_UI=1 CI=1 \
  bash src/scripts/install --global --tools=claude-code --yes

# 2. The reading, through the library every other reader uses.
#    buildInstalledLayerReport({ home, projectRoot, manifestPath: null })
#    over <HOME>/.claude/rules, classifying each file with `is_thin_entry`
#    and the stub law marker, and the bucket membership from
#    dist/router.json (kernel) and src/config/rule-consequence-class.json.

# 3. The projector's own figure, for comparison only.
./scripts-run src/scripts/project_thin_rules --measure --workspaces engineering
```

## The reading

**111,197 characters, 105 files, `claude-code` global scope.**

| Figure | Characters | Files |
|---|---|---|
| total | 111,197 | 105 |
| unconditional — what stands every session | 97,496 | 103 |
| path-scoped — what waits for a path match | 13,701 | 2 |
| package-owned | 111,197 | 105 |

The two path-scoped files are `design-review-after-ui-write` (7,588) and
`ui-audit-gate` (6,113).

Ownership resolved from the **global deploy inventory**
(`deployed-files.json`), not from a project manifest — a global-only install
writes no project manifest, and before step 1.2 of this roadmap both readers
reported `0 package-owned / 105 foreign` for a layer the installer had just
written itself.

## Composition — five buckets

Unconditional characters only. The five sum to 97,496 exactly, which is the
property that makes them a decomposition rather than a sample.

| Bucket | Rules | Characters | Mean |
|---|---|---|---|
| kernel, full-bodied | 9 | 25,704 | 2,856 |
| non-kernel kept full (`no_stub`) | 5 | 18,867 | 3,773 |
| other kept full | 0 | 0 | — |
| stubs carrying a law | 21 | 22,656 | 1,079 |
| plain stubs | 68 | 30,269 | 445 |
| **total** | **103** | **97,496** | |

The nine kernel rules: `agent-authority` (1,275), `ask-when-uncertain` (2,306),
`commit-policy` (2,805), `direct-answers` (3,123), `language-and-tone` (3,035),
`no-cheap-questions` (3,282), `non-destructive-by-default` (3,938),
`scope-control` (3,565), `verify-before-complete` (2,375).

The five `no_stub` members: `autonomous-execution` (6,146),
`legal-safety-floor` (5,583), `question-not-instruction` (2,435),
`runtime-safety` (1,131), `tool-safety` (3,572).

**Nothing is kept full for a reason outside those two classes.** The "other
kept full" row is zero, and it is reported rather than omitted: a reader
checking whether some third mechanism keeps a rule full-bodied gets an answer
instead of an absence.

## Form — what the 89 stubs pay for their own description

The 89 stubs hold 52,925 characters between them, 595 on average. Of that:

| Term | Characters | Shape |
|---|---|---|
| heading repeating the file name | 2,181 | `## <Title>` + newline, 89 times |
| marker sentence | 4,183 | 47 characters, 89 times |
| `Fires on:` label and its full stop | 1,044 | 12 characters, 87 times |
| trigger hint content | 4,808 | the triggers themselves |
| pointer | 17,356 | `Body: [\`<id>\`](<prefix><id>.md)` |
| description | 23,353 | the rule's own one-line description |
| **total** | **52,925** | |

Of the pointer's 17,356, **12,371 is the package-root prefix alone** — 139
characters, 89 times — and 4,985 is the link syntax plus the rule id, which the
pointer writes twice.

### The root length is in the number, so the root length is stated

The pointer is absolute and rooted at the package the install was made from, so
the layer's size depends on where that package sits on disk. The package root
measured here gives a **139-character** body-link prefix. Step 1.3 of this
roadmap pins the arithmetic as a test rather than an observation:

```
Δ characters = Δ prefix length × number of stubs
```

With 89 stubs, each character of root costs 89. At the 97-character prefix of
an ordinary checkout of this repository the same layer reads **107,459** in
all and **93,758** unconditional — 3,738 lower, which is 42 × 89.

Any figure on this page may be moved to another root the same way. None of the
conclusions below turn on the difference: at either root the layer is above the
recorded ceiling by more than the whole form saving.

## Three instruments, three numbers — and which answers which question

| Instrument | Reads | Figure | Unit |
|---|---|---|---|
| `project_thin_rules --measure --workspaces engineering` | the projected rule layer in `dist/agent-src/rules` | 106,686 (eager 415,704) | report characters, of a different corpus |
| the install receipt's thinning line | the installed files as written | `365283 -> 123485` | raw file characters |
| the install receipt's budget line | the installed layer | 111,197 package-owned | report characters |
| `buildInstalledLayerReport` | the installed layer | 111,197 = 97,496 + 13,701 | report characters |

The first is **not** the installed layer and never was: it measures the
maintainer-side projection over a different file set, under a workspace filter,
and the page that first published it says of itself that it "**does not
establish** that 106,800 is the installed layer's standing total". The recorded
over-ceiling verdict was read off that instrument. The second and third are the
same install measured in two units, which is why they differ by the frontmatter
every file carries. Since step 1.2 the receipt and the report agree on the
figure and on where ownership came from, which is what makes the last two rows
one reading rather than two.

## Against the recorded ceiling

The ceiling is "hard 75,000 with ≥10 % headroom" — a council's figure, recorded
in `agents/evidence/council/inbox-2026-10-c-standing-form.md`. The roadmap it
belongs to phrases its AC-1 in package-owned characters read by the
installed-layer report.

| Reading | Characters | Against 75,000 |
|---|---|---|
| unconditional | 97,496 | 130 % |
| all | 111,197 | 148 % |

Both readings are over. **Which one the ceiling is about is not settled here** —
it is the question step 4.1 puts to the council that set the figure, and this
page records both rather than choosing.

## An adjacent defect, noted and not fixed here

The install receipt's budget block prints `no published limit recorded — not
measured` for `claude-code`, while the same rows resolve a 150,000 limit when
the library is called from source. `defaultHostLimitsPath` derives its path from
`import.meta.url`, which inside the bundled installer
(`dist/install/install.mjs`) resolves two levels up to the package root and then
looks for `config/host-instruction-limits.json` — a directory that exists only
as `src/config/`. So the receipt has never measured a consumer's layer against
a host limit, and the 80 % warning it exists to print cannot fire.

This is pre-existing, it is outside every step of this roadmap, and it is left
untouched here rather than fixed in passing. It is recorded because the receipt
is one of the two readers this roadmap makes agree, and a reader comparing the
receipt against this page would otherwise find a missing warning and no reason
for it.
