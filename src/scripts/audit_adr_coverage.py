#!/usr/bin/env python3
"""Audit per-area ADR coverage against docs/contracts/ and the canonical
AREAS inventory. Contract: docs/contracts/adr-layout.md.

Modes:
  --report   (default) one-shot inventory: which areas exist, ADR count
             per area, contracts missing a bootstrap ADR.
  --check    exit 1 on hard failures (number gaps, missing area README,
             broken supersedes); exit 0 with warnings on missing
             bootstrap ADRs and dangling references.
  --regen-area-readme <area>
             rewrite docs/adrs/<area>/README.md from the area's ADR
             frontmatter. Idempotent.
"""
from __future__ import annotations
import argparse, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
ADR_ROOT = ROOT / "docs" / "adrs"
CONTRACT_ROOT = ROOT / "docs" / "contracts"

# Canonical area inventory. To add an area: add it here, then run
# `python3 scripts/audit_adr_coverage.py --check` in the same PR.
AREAS: dict[str, dict[str, str]] = {
    "cost":    {"contract": "cost-enforcement.md",
                "scope":    "Budget ladder, hard-stop hook, cost reporting and dashboards."},
    "telegraph": {"contract": "condensation-default-kill-criterion.md",
                "scope":    "Telegraph-speak condensation, decondensation, reversibility guards."},
    "schema":  {"contract": "agents/reference/docs/frontmatter-contract.md",
                "scope":    "Frontmatter schemas, v2 rigor, lint behaviour for skills / rules / commands."},
    "router":  {"contract": "rule-router.md",
                "scope":    "router.json shape, tier semantics, dispatch precedence."},
    "smoke":   {"contract": "smoke-contracts.md",
                "scope":    "Per-tier smoke contracts, baseline locks, regression gates."},
}

NAMED = re.compile(r"^(\d{4})-([a-z0-9-]+)\.md$")
FM = re.compile(r"^---\n(.*?)\n---", re.DOTALL)
FIELD = re.compile(r"^([a-z_]+):\s*(.+?)\s*$", re.MULTILINE)


def parse_fm(text: str) -> dict[str, str]:
    m = FM.search(text)
    if not m:
        return {}
    return {k: v.strip(" \"'") for k, v in FIELD.findall(m.group(1))}


def scan_area(area: str) -> tuple[list[dict], list[str]]:
    """Return (adrs, errors). adrs sorted by number."""
    area_dir = ADR_ROOT / area
    errs: list[str] = []
    if not area_dir.exists():
        return [], errs
    adrs: list[dict] = []
    for p in sorted(area_dir.glob("*.md")):
        if p.name == "README.md":
            continue
        m = NAMED.match(p.name)
        if not m:
            errs.append(f"{area}/{p.name}: filename does not match NNNN-<slug>.md")
            continue
        fm = parse_fm(p.read_text(encoding="utf-8"))
        adrs.append({"num": m.group(1), "slug": m.group(2),
                     "path": p.name, **fm})
    # Gap check.
    nums = [int(a["num"]) for a in adrs]
    for i, n in enumerate(nums, start=1):
        if n != i:
            errs.append(f"{area}/: number gap at position {i} (got {n:04d})")
            break
    return adrs, errs


def _contract_path(meta: dict[str, str]) -> Path:
    """Resolve a contract reference. Plain filename → docs/contracts/<file>;
    a path with separators → repo-relative."""
    c = meta["contract"]
    return (ROOT / c) if "/" in c else (CONTRACT_ROOT / c)


def render_area_readme(area: str, meta: dict[str, str], adrs: list[dict]) -> str:
    lines = [f"# ADRs — `{area}`", "",
             f"> {meta['scope']}", ""]
    contract_path = _contract_path(meta)
    repo_rel = contract_path.relative_to(ROOT) if contract_path.exists() else Path(
        meta["contract"] if "/" in meta["contract"] else f"docs/contracts/{meta['contract']}")
    # Link target is relative to docs/adrs/<area>/README.md (2 levels up from area dir).
    link_target = Path("..") / ".." / ".." / repo_rel
    if contract_path.exists():
        lines.append(f"Contract: [`{repo_rel}`]({link_target}).")
    else:
        lines.append(f"Contract: _not yet published_ (`{repo_rel}`).")
    lines += ["",
              "| # | Title | Status | Date | Supersedes |",
              "|---|---|---|---|---|"]
    for a in adrs:
        title = a.get("decision", a["slug"]).replace("-", " ").title()
        lines.append(f"| [{a['num']}]({a['path']}) | {title} | "
                     f"{a.get('status','—')} | {a.get('date','—')} | "
                     f"{a.get('supersedes','—')} |")
    if not adrs:
        lines.append("| _none yet_ | — | — | — | — |")
    return "\n".join(lines) + "\n"


def cmd_report(args) -> int:
    print("## ADR coverage report")
    print()
    print("| Area | Contract | ADRs | README | Status |")
    print("|---|---|---:|:---:|---|")
    missing_bootstrap = 0
    for area, meta in AREAS.items():
        adrs, _ = scan_area(area)
        readme = "✅" if (ADR_ROOT / area / "README.md").exists() else "—"
        contract_present = _contract_path(meta).exists()
        status = "ok" if adrs else "missing bootstrap"
        if not adrs:
            missing_bootstrap += 1
        contract_cell = meta["contract"] if contract_present else f"_{meta['contract']}_ (no contract)"
        print(f"| `{area}` | {contract_cell} | {len(adrs)} | {readme} | {status} |")
    print()
    print(f"BASELINE: {len(AREAS)} canonical areas · {missing_bootstrap} missing bootstrap ADR(s)")
    return 0


def cmd_check(args) -> int:
    hard = 0
    warn = 0
    for area, meta in AREAS.items():
        adrs, errs = scan_area(area)
        for e in errs:
            print(f"❌ {e}", file=sys.stderr); hard += 1
        if adrs and not (ADR_ROOT / area / "README.md").exists():
            print(f"❌ {area}/: README.md missing", file=sys.stderr); hard += 1
        if not adrs:
            print(f"⚠️  {area}/: no bootstrap ADR yet (contract: {meta['contract']})", file=sys.stderr)
            warn += 1
    print(f"BASELINE: {hard} hard fail(s) · {warn} warn(s)")
    return 1 if hard else 0


def cmd_regen_area_readme(args) -> int:
    area = args.regen_area_readme
    if area not in AREAS:
        print(f"❌ unknown area '{area}' — add to AREAS inventory first", file=sys.stderr)
        return 1
    adrs, errs = scan_area(area)
    for e in errs:
        print(f"❌ {e}", file=sys.stderr)
    out = ADR_ROOT / area / "README.md"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(render_area_readme(area, AREAS[area], adrs), encoding="utf-8")
    print(f"wrote {out.relative_to(ROOT)}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    grp = ap.add_mutually_exclusive_group()
    grp.add_argument("--check", action="store_true")
    grp.add_argument("--regen-area-readme", metavar="AREA")
    args = ap.parse_args()
    if args.check:
        return cmd_check(args)
    if args.regen_area_readme:
        return cmd_regen_area_readme(args)
    return cmd_report(args)


if __name__ == "__main__":
    sys.exit(main())
