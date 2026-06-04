"""Pilot condensation ratio + Iron-Law checksum verification (one-off, not CI)."""
import sys, re, hashlib, statistics
from pathlib import Path

sys.path.insert(0, "src/scripts")
from measure_rule_budget import strip_frontmatter

FENCE_RE = re.compile(r"```(?:[^\n]*\n)([\s\S]*?)```")


def iron_law_sha(body: str) -> str:
    blocks = FENCE_RE.findall(body)
    norm = "".join(re.sub(r"\s+", " ", b).strip().upper() for b in blocks)
    return hashlib.sha256(norm.encode()).hexdigest()[:16]


pairs = [
    ("agent-authority",   ".agent-src.uncondensed/rules/agent-authority.md",   "docs/contracts/pilot/agent-authority.md"),
    ("direct-answers",    ".agent-src.uncondensed/rules/direct-answers.md",    "docs/contracts/pilot/direct-answers.md"),
    ("language-and-tone", ".agent-src.uncondensed/rules/language-and-tone.md", "docs/contracts/pilot/language-and-tone.md"),
]

header = f"{'rule':25s} {'orig':>6s}  {'pilot':>6s}  {'r':>6s}  {'budget':>7s}  {'sha-orig':>16s}  {'sha-pilot':>16s}  {'IL':>3s}"
print(header)
print("-" * len(header))

ratios = []
for rid, orig_path, pilot_path in pairs:
    orig_body, _  = strip_frontmatter(Path(orig_path).read_text())
    pilot_body, _ = strip_frontmatter(Path(pilot_path).read_text())
    o, p = len(orig_body), len(pilot_body)
    r = p / o
    ratios.append(r)
    sha_o = iron_law_sha(orig_body)
    sha_p = iron_law_sha(pilot_body)
    match = "OK" if sha_o == sha_p else "FAIL"
    budget = "OK" if p <= 1500 else f"+{p - 1500}"
    print(f"{rid:25s} {o:6d}  {p:6d}  {r:6.3f}  {budget:>7s}  {sha_o:>16s}  {sha_p:>16s}  {match:>3s}")

mean   = sum(ratios) / len(ratios)
median = statistics.median(ratios)
print()
print(f"r-values : {[round(x, 3) for x in ratios]}")
print(f"mean   r = {mean:.3f}")
print(f"median r = {median:.3f}")
print(f"max    r = {max(ratios):.3f}")
print(f"min    r = {min(ratios):.3f}")
print()

TOTAL = 32403
print(f"Projected always-bucket @ r=mean ({mean:.3f})  : {int(TOTAL * mean):>6d}  (target ≤ 25000)")
print(f"Projected always-bucket @ r=max  ({max(ratios):.3f})  : {int(TOTAL * max(ratios)):>6d}  (target ≤ 25000)")
print(f"Projected always-bucket @ r=med  ({median:.3f})  : {int(TOTAL * median):>6d}  (target ≤ 25000)")
