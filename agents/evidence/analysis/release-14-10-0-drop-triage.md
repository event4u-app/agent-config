<!-- evidence-type: analysis -->
<!-- analyzed: 2026-08-23 | pin: 407915361 (v14.10.0) | corpus: 7,981 lines / 12 reviewer reports + 11 attachments -->
# Analysis — the 14.10.0 reviewer drop, triaged

> **Source:** `agents/tmp.old/release-4.10.0` — twelve files: a 7,981-line
> `chat.txt` and eleven roadmap-shaped attachments. Analysed via
> `/analyze:inbox` at `407915361` (v14.10.0, merge of PR #1565), which is the
> exact commit **every** attachment declares as its own baseline. `git log
> 407915361..HEAD` is empty, so nothing here could be stale: each claim was
> either true or false at this commit.

> **Why this file exists.** The same bundle will arrive again. This is the
> second consecutive release drop proposing the architecture-tournament
> program, and the first one's triage
> (`feedback-14-8-0-triage.md`) is what made this one cheap to dispose of. The
> next reader should not re-derive it a third time.

## 1. What the drop actually is

`chat.txt` contains **zero user turns**. It is a concatenation of twelve
assistant-side reviewer reports separated by bare `------` lines, each opening
with an answer to a prompt that was not pasted. The maintainer's words were
stripped before the drop.

That matters for how the attachments are weighted. They are not a rendering of
an instruction; they are **one reviewer's attachments**, carried through
verbatim:

| Attachments | Producer |
|---|---|
| `road-to-agent-config-next.md` + 8 siblings | the final segment (lines 7910–7981) |
| `road-to-cross-corpus-parity-v7.md` | segment 5799–5804 |
| `road-to-ac-next-level.amendment-w1-v3.md` | segment 7899–7908 |

**The other nine reviewers produced no artifact.** Roughly 6,000 lines,
including every P0 list in the corpus, is unrepresented in the drop.

## 2. The convergent message, and what the artifacts answer with

Ten of twelve reviewers grade the release 9.8–10/10 and then pivot to the same
complaint from different angles: the project keeps adding measurement machinery
and does not convert it into removal, adoption, or a real user.

- *"Der nächste große Hebel liegt jetzt nicht darin, noch mehr Mechanismen hinzuzufügen, sondern die neuen Messdaten in **Entfernung und Vereinfachung** umzusetzen"* (1297)
- *"Ich würde diesmal nur **vier** Dinge priorisieren … **Mehr würde ich aktuell nicht aufmachen.**"* (2710, 2720)
- *"Der nächste Release sollte für mich wieder eher: **prove, attribute, close** als: expand sein."* (4454)
- *"AC braucht inzwischen weniger neue Regeln und Konzepte – und mehr echtes ausführbares Substrat."* (7980)

The artifact set answers with **nine new `complexity: structural` planning
documents**. Measured at `407915361`:

| Property | Measured |
|---|---|
| `## Phase` headings across all eleven files | **0** |
| `verify:` annotations across all eleven files | **0** |
| Files carrying the novel `baseline:` frontmatter block | **9** |
| In-tree roadmaps carrying `baseline:` | **0** of 86 |

So they are not executable roadmaps by this repository's own machinery — they
cannot enter `/roadmap:process-*` or the progress dashboard — and the
frontmatter block they introduce is a new roadmap metadata class, which appears
verbatim on a reviewer do-not-build list (4443).

`road-to-agent-config-next.md` states as its own AC-7 that no more than **three**
structural AC-Next roadmaps may be active simultaneously, and ships with eight
structural siblings. It breaches its own acceptance criterion on arrival.

## 3. Recurrence — this is the second arrival, and the park anticipated it

`feedback-14-8-0-triage.md` § 3.2 parked this program on **2026-08-22** as
`agents/roadmaps/later/road-to-agent-config-next.md`. That file says in as many
words: *"Everything else — the twelve-roadmap family, the eleven tracks, the
per-track provider candidates … Stated explicitly so a later reader does not
re-import the twelve-item version."* Its own Risk #2 is *"A resumer reads the
twelve-item version as the plan."*

The drop re-imports the family and the tracks **under the identical filename**,
one day later. The park's Risk #2 has materialised. Adopting the file as
delivered would overwrite the park with the thing the park excludes.

### The resume gate, measured

| Leg | Required | State at `407915361` |
|---|---|---|
| (a) | ≥ 4 weeks of standing-payload delta measurements | Instrument unbuilt — `road-to-standing-payload-diet.md` steps 0.3–0.5 all `[ ]`; step 0.3's own verify probe `grep -ln "merge-base\|merge_base" .github/workflows/*.yml` returns **0** |
| (b) | ≥ 95 % envelope adoption over ≥ 500 stops | Owner **archived** with Phase 2 and AC-3/AC-4 `[-]`; last published rate **0.00 % — 0 `ok` of 1,296 stops**; arrival condition needs a non-local ledger, and `agents/runtime/` is gitignored (`.gitignore:190`) with no workflow ingesting it |

Leg (b) is worse than unmet: it has no owner and no channel. That is carried by
`agents/roadmaps/road-to-unowned-resume-conditions.md`, and it is the reason the
bundle will otherwise arrive again at 14.11.0.

## 4. The one thing the drop is right about, and got wrong anyway

Nine files propose new structural subsystems. **None of the eleven mentions
ADR-133 or ADR-134** — the subsystem freeze and the record its exit currently
depends on.

The freeze **has lifted**. All four unblock conditions are met at `407915361`,
verified individually: (a) `claim: code-graph-retrieval-null` bound in
`docs/CLAIMS.md`, `status: backed`; (b) `internal/reports/rule-backstop-debt.json`
total **0** ≤ 25; (c) `Release install E2E (pack → install → upgrade → boot)`
exists, is named in `docs/contracts/branch-protection-policy.md:75` and passed on
the `release/14.10.0` run; (d) ADR-134 defers with an unexpired date. ADR-133's
own `review_trigger` says the freeze lifts without a superseding ADR when all
four hold — and `docs/decisions/adr-evidence-sweep-2026-08.md:749` already
recorded exactly this on 2026-08-21.

So the drop's instinct that something opened is correct, and it names the wrong
thing: it argues against ADR-124's Class-B prohibition (7956, *"dann sollte AC
bereit sein, diese Grenze zu kippen"*), which is accepted, unsuperseded, and
carries its own extension clause. That is governance self-amendment and is
owner-reserved. Meanwhile the lock that actually moved goes unmentioned, and
condition (d) — the one holding it open — expires **2026-09-15**, in 23 days,
owned by no active roadmap.

**A trap worth recording, because two readers hit it.** Condition (c) reads
"named in `branch-protection-policy.md`'s release-PR row". Grepping for the job
id `release-install-e2e` returns nothing and reads as UNMET. The policy names
the check by its **display name**, and branch protection matches on check names.
The evidence sweep recorded this trap on 2026-08-21 specifically because "the
next person will reach for the same grep". This analysis was the next person.

## 5. Verification — where the files' own measurements diverge

Reproduced rather than read:

| Claim | Measured at `407915361` | Verdict |
|---|---|---|
| Skills 291 · Rules 119 | 291 · 119 (9 `always` + 105 `auto` + 5 `manual`) | reproduced |
| Concerns 65 | **49** declared in `src/scripts/hook_manifest.yaml` | diverged |
| Tier-2 rules 80 | **82** (59 × `2a` + 23 × `2b`) | diverged |
| Skill-size park: p95 2,301 · 7 > 2,500 · max 3,031 | p95 **2,294** · 7 · 3,031 (`ai-council`) | reproduced |
| Estate: 29 active / 61 later | **25** active · 61 later | diverged |
| Passports ≈ 1 % coverage | the report's own figures: gaps **93.5 %** and **84.1 %** | diverged |
| opencode plugin · budget ledger · witness manifest · drift test all absent | all four absent | reproduced |
| Six `DERIVED_MARKER` lines in the published changelog | 6 — `CHANGELOG.md:410,412` (14.10.0) and `:459-462` (14.9.0) | reproduced |

The `road-to-ac-next-level.amendment-w1-v3.md` and
`road-to-cross-corpus-parity-v7.md` files are the two that bind every claim to a
commit and survive re-derivation on the substance; their arithmetic slips above
are minor and of the same class the 14.8.0 triage found in the v2 amendment.

## 6. Source confidentiality — a hard blocker on verbatim adoption

`check_no_external_sources` scans `git ls-files` and is green today only because
`agents/tmp/` is gitignored. Running its own denylist regexes over the drop:

| File | Denylisted tokens |
|---|---|
| `road-to-cross-corpus-parity-v7.md` | 7 distinct, 11 hits |
| `road-to-knowledge-and-code-intelligence.md` | 1 distinct, 4 hits |
| `road-to-agent-config-next.md` | 1 distinct, 2 hits |
| `chat.txt` | 3 distinct, 13 hits |

Adopting any of the three attachments into `agents/roadmaps/` unanonymised turns
the gate red. The parity file flags this about itself and demands the
anonymisation as a precondition; the eight AC-Next siblings do not. The 14.8.0
triage demanded the identical edit for v6 — the same defect, one revision later.

## 7. Disposition

| File | Disposition |
|---|---|
| `road-to-agent-config-next.md` + 8 structural siblings | **Not adopted.** Re-import of a program parked one day earlier, under the same filename; both resume legs red; zero phases and zero verify steps; breaches its own three-roadmap cap on arrival; three of them carry denylisted names. |
| `road-to-ac-next-level.amendment-w1-v3.md` | **Not adopted as a roadmap; its finding is recorded here.** Its W1.2 re-cut ("dock the ledger onto the passports rather than build a third number beside them") is a genuine design input that post-dates the v2 disposition, and belongs to `road-to-standing-payload-diet` Phase 0 rather than to a new file. Its self-declared kill criterion — a third re-baseline without ratification answers the capacity question — is noted, not acted on: it is the maintainer's to fire. |
| `road-to-cross-corpus-parity-v7.md` | **Adopted as a conclusion, not as work.** Its own recommendation is to close the series with no scheduled v8, and it carries no defect the tree does not already own. Nothing to schedule. |
| `chat.txt` | **Consumed.** Its nine unrepresented reviewers hold the P0 lists that the attachments dropped; the two roadmaps below take the ones that verify. |

## 8. What was carried forward

| # | Confirmed defect | Provenance | Carried by |
|---|---|---|---|
| E1 | Six `DERIVED_MARKER` lines shipped in the published 14.9.0 and 14.10.0 changelog sections, both committed **after** the guard stub was filed and after 14.7.0 had been remediated by hand | `CHANGELOG.md:410,412,459-462`; `36fea34ba`, `58dc43197` | `road-to-release-publication-integrity.md` |
| E2 | The park's resume leg (b) has no owner and no arrival channel; leg (a)'s instrument is unbuilt | `later/road-to-agent-config-next.md`; `archive/road-to-subagent-envelope-adoption.md`; `.gitignore:190` | `road-to-unowned-resume-conditions.md` Phase 1 |
| E3 | ADR-134 expires 2026-09-15 and re-arms ADR-133's freeze; owned by no active roadmap | `ADR-134:11-16`; `ADR-133:44-60`; `grep -rl "2026-09-15" agents/roadmaps/*.md` → none | `road-to-unowned-resume-conditions.md` step 1.3 |

**Noted, not carried — a decision for the maintainer.** The job `Blocking review
findings dispositioned` exists at `.github/workflows/release-validation.yml:338`
and passed on the 14.10.0 release run, but it is **not** listed in the release-PR
row of `docs/contracts/branch-protection-policy.md`, which enumerates the
release-shape-gated checks. Reviewers at 2761 and 2781 complain that #1565 merged
despite blocking findings. The gate now exists; whether it is *required* is not
answerable from the contract document, and the fix — one line in the policy, or a
recorded reason for the omission — is small enough that it should not become a
roadmap without the maintainer saying which.

**Not carried** — reviewer-only, with no confirmed defect in the tree at this
pin: the episode finalizer; a cross-vendor execution fabric; a resident session
kernel; a persistent browser; the code-intelligence provider abstraction; pack
outcome attribution; council seat ROI. Each needs a confirming measurement, and
several collide with ADR-124 Class B, which is accepted and unsuperseded.
