<!-- evidence-type: analysis -->
# Consolidation-lineage census — 2026-08-26

**What was measured.** Every inbox folder in `agents/tmp/` and
`agents/tmp.old/` that contains a *consolidating* roadmap — a file declaring
itself a master over sibling proposals, via a `consolidates:` /
`supersedes_analysis:` frontmatter key, an "Inputs consolidated" list, or a
"Master-Konsolidierung" heading. For each, the declared parent set was compared
against the sibling roadmaps actually present in the same folder.

**How the population was found.**
`grep -rl 'consolidates:\|supersedes_analysis:\|Ersetzt als führendes Proposal\|Master-Konsolidierung' agents/tmp.old agents/tmp`
plus a per-folder `ls`. This finds folders whose consolidation is *declared*.
A consolidation that declares nothing is invisible to this census, so the
population is a lower bound.

**Result: 4 folders, 4 with an incomplete lineage.**

| Folder | Consolidating file | Parents declared | Sibling roadmaps present | Omitted | Shape |
|---|---|---|---|---|---|
| `tmp/evolve/` | `road-to-governed-harness-evolution-master.md` | 2 | 3 | `road-to-gated-harness-evolution-deep-v4.md` (1925 lines, Phases 0–10, K1–K12) | skipped-deeper-parent |
| `tmp/evolver/` | `road-to-experience-loop-master.md` | 2 (`consolidates:`) | 3 | `road-to-outcome-grounded-harness-evolution.md` (2728 lines, 25 phases, EVO-1–20) | skipped-deeper-parent |
| `tmp.old/impeccable /` | `road-to-frontend-power.md` | 3 (`consolidates:`) | 4 | `road-to-frontend-operating-system.md` | skipped-deeper-parent |
| `tmp.old/redundanz/` | `road-to-redundancy-governance-master.md` | 4 ("Inputs consolidated") | 5 | `road-to-one-spine.md` | competing-terminal-syntheses |

**Two distinct shapes, one class.**

*Skipped-deeper-parent* (3 of 4). The omitted sibling is not an unrelated file —
in every case it is a **later synthesis over the very parents the master did
consolidate**, and it says so in its own header:

- `road-to-gated-harness-evolution-deep-v4.md:9-13` claims to supersede the
  planning shape of both parents the `evolve/` master names.
- `road-to-outcome-grounded-harness-evolution.md:9-11` carries
  `supersedes_analysis:` listing both parents the `evolver/` master names.
- `road-to-frontend-operating-system.md:6-10` carries `research.basis:` listing
  exactly the three parents the `impeccable/` master names.

So the consolidation reached the first generation and stopped one generation
short, three times independently.

*Competing-terminal-syntheses* (1 of 4). `road-to-one-spine.md` and
`road-to-redundancy-governance-master.md` are two masters over the **same four**
parents, both dated 2026-08-25, both marked PROPOSAL, and neither names the
other. Different mechanism, same consequence: an artefact that reads as the
settled answer while a peer of equal standing exists.

**Why it matters, stated as the consequence rather than the count.** A
consolidating roadmap presents its content as adjudicated — parents named,
conflicts resolved, a kill register listing what was rejected and why. When a
parent is missing from that list, its content is not *killed*; it is
*undiscussed*, and nothing in the artefact distinguishes the two. Measured on the
two `tmp/` folders by a structural read of the omitted parents, this produced 13
and 17 substantive items respectively — mechanisms, exit criteria and
acceptance criteria — that appear in no master and carry no kill ID. Several
reverse a decision the master made: in one case the master adopted verbatim a
mutation-arity rule the omitted parent had raised to doctrine level, in another
the master adopted an anti-forgery predicate the omitted parent named by name as
defective, and in a third the master planned a delivery mechanism that ships in
the tree (`src/scripts/_lib/lean_projection_mode.ts:19`) and that the omitted
parent had killed for that reason.

**What this census does not establish.** It does not show that the omitted
content was *better* — only that it was not considered. It does not measure
whether a lineage-completeness check would have been cheap at the time. And with
n=4 it cannot distinguish a property of this consolidation pattern from a
property of the four sessions that happened to run it; a fifth folder with a
complete lineage would not refute the finding but would bound it.

**Reproduction.** The two `tmp/` rows are reproducible until those folders are
consumed into `tmp.old/`; all four rows are reproducible from `tmp.old/` while
that directory is retained. Both directories are gitignored, so this file is the
durable record and the paths above are pointers, not citable evidence in a clone.
