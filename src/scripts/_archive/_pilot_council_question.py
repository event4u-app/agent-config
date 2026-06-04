"""Build the Phase-1 council question file (one-off)."""
from pathlib import Path

OUT = Path("/tmp/council-p1/question.md")
OUT.parent.mkdir(parents=True, exist_ok=True)

framing = """# Cross-check request — Phase 1 of "Road to Rule Kernel and Router"

We are about to condense a 56-rule "always-active" set down to a small
hard-capped kernel + a router-loaded auto bucket. Phase 1 is purely
classification + projection — no source rules edited yet. Two contracts
were produced. We want a neutral second opinion BEFORE Phase 2 ships
condensation to the actual rule files.

## What we want from you

1. **Disposition calls.** Look at the 56-rule classification. Are any
   `keep-in-kernel` rules over-included (could safely become auto-tier)?
   Are any `move-to-skill` / `move-to-guideline` calls wrong (e.g.
   carrying an Iron Law that should stay always-on)? Cite the rule id
   and the better disposition.
2. **Kernel inclusion criteria.** Section 1 of `kernel-membership.md`
   lists 4 criteria (Iron-Law floor / mode-independent / pre-action
   gate / cross-cutting). Are these the right gates? Is anything
   missing or redundant?
3. **Condensation-rate r = 0.742.** Three pilots gave r-values 0.677 /
   0.712 / 0.838. We locked the **mean**. Reasonable, or should we use
   median (0.712) / max (0.838) as a more conservative budget cushion?
   Note: pilot range straddles the typical 0.6-0.75 band; max came
   from the shortest rule (already-lean floor effect).
4. **The 1.5k per-rule cap with ADR-override.** Two of the three pilots
   land >1.5k post-condensation and would need an `iron-law-override`
   ADR. Is the per-rule cap realistic, or should we raise the per-rule
   ceiling (e.g. 2.5k or 3.5k) and lower the bucket cap (e.g. from 25k
   to 20k)? What's the failure mode you'd be most worried about?
5. **Anything we missed.** Risks, blind spots, sequencing problems.

Be specific. Cite the rule id or the section number. We will reject
generic "looks good" reviews.

---

## Contract 1 — docs/contracts/rule-classification.md

"""

OUT.write_text(framing)
with OUT.open("a") as fh:
    fh.write(Path("docs/contracts/rule-classification.md").read_text())
    fh.write("\n\n---\n\n## Contract 2 — docs/contracts/kernel-membership.md\n\n")
    fh.write(Path("docs/contracts/kernel-membership.md").read_text())
    fh.write("\n\n---\n\n## Pilot inputs (condensed bodies, for reference)\n")
    for rid in ("agent-authority", "direct-answers", "language-and-tone"):
        fh.write(f"\n### Pilot — {rid}\n\n")
        fh.write(Path(f"docs/contracts/pilot/{rid}.md").read_text())

print(f"wrote {OUT} — {OUT.stat().st_size} bytes")
