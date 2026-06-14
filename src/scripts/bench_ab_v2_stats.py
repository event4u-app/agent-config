#!/usr/bin/env python3
"""bench:ab v2 — paired statistics (Phase 3).

Reads a v2 paired report (bench_ab_v2_run.py output) and computes, for each
arm comparison, paired significance + effect size on:

- capability axis (binary)  -> McNemar exact test + Cohen's h
- discipline axis ([0,1])    -> Wilcoxon signed-rank + rank-biserial
- status buckets             -> error/undisciplined-rate per arm

Pairing: each (task, seed) is one pair, seen under every arm. Pooled across all
task×seed pairs. Dependency-free (stdlib math only) so the benchmark stays
portable. Errored runs are EXCLUDED from a pair (per-axis) so a quota trip is
never read as a content/discipline fail.

Comparisons reported:
  package   vs vanilla   -> the package lift (adoption question)
  package-rdp vs package -> the RDP reasoning lift
  package   vs placebo   -> attribution: content vs mere prompt-length priming
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
REPORTS_DIR = REPO_ROOT / "internal" / "bench" / "reports" / "ab-v2"

COMPARISONS = [
    ("package", "vanilla", "package lift"),
    ("package-rdp", "package", "RDP lift"),
    ("package", "placebo", "attribution (content vs length)"),
]


def _phi(z: float) -> float:
    """Standard-normal CDF via erf."""
    return 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))


def _comb(n: int, k: int) -> int:
    return math.comb(n, k)


def mcnemar_exact(b: int, c: int) -> float:
    """Two-sided exact McNemar p-value (binomial on discordant pairs)."""
    n = b + c
    if n == 0:
        return 1.0
    k = min(b, c)
    tail = sum(_comb(n, i) for i in range(0, k + 1)) * (0.5 ** n)
    return min(1.0, 2.0 * tail)


def cohens_h(p1: float, p2: float) -> float:
    return 2 * math.asin(math.sqrt(max(0, min(1, p1)))) - \
           2 * math.asin(math.sqrt(max(0, min(1, p2))))


def wilcoxon(diffs: list[float]) -> dict:
    """Wilcoxon signed-rank on paired differences (treatment - baseline).

    Returns W+, W-, normal-approx two-sided p (continuity-corrected), and
    rank-biserial effect size. Zeros are dropped."""
    nz = [d for d in diffs if abs(d) > 1e-9]
    n = len(nz)
    if n == 0:
        return {"n": 0, "W_plus": 0, "W_minus": 0, "p": 1.0, "rank_biserial": 0.0}
    order = sorted(range(n), key=lambda i: abs(nz[i]))
    ranks = [0.0] * n
    i = 0
    while i < n:
        j = i
        while j + 1 < n and abs(nz[order[j + 1]]) == abs(nz[order[i]]):
            j += 1
        avg = (i + 1 + j + 1) / 2.0  # average rank for ties (1-based)
        for k in range(i, j + 1):
            ranks[order[k]] = avg
        i = j + 1
    w_plus = sum(ranks[i] for i in range(n) if nz[i] > 0)
    w_minus = sum(ranks[i] for i in range(n) if nz[i] < 0)
    total = w_plus + w_minus
    rb = (w_plus - w_minus) / total if total else 0.0
    # Normal approximation (ok-ish for n>=10; for small n it's conservative —
    # we surface n so the reader can weight it).
    mean = n * (n + 1) / 4.0
    sd = math.sqrt(n * (n + 1) * (2 * n + 1) / 24.0)
    w = min(w_plus, w_minus)
    if sd == 0:
        p = 1.0
    else:
        z = (w - mean + 0.5) / sd
        p = min(1.0, 2.0 * _phi(z))
    return {"n": n, "W_plus": round(w_plus, 1), "W_minus": round(w_minus, 1),
            "p": round(p, 4), "rank_biserial": round(rb, 4)}


def _pairs(records: list[dict], arm_t: str, arm_b: str):
    """Yield (task, seed, run_t, run_b) for each paired (task,seed)."""
    for rec in records:
        arms = rec.get("arms", {})
        runs_t = arms.get(arm_t) or []
        runs_b = arms.get(arm_b) or []
        by_seed_b = {r.get("seed"): r for r in runs_b}
        for r_t in runs_t:
            r_b = by_seed_b.get(r_t.get("seed"))
            if r_b is not None:
                yield rec["id"], r_t.get("seed"), r_t, r_b


def compare(records: list[dict], arm_t: str, arm_b: str) -> dict:
    # Capability (binary, McNemar) — exclude pairs where either side errored.
    b = c = both1 = both0 = 0
    cap_t = cap_b = capn = 0
    # Discipline (continuous, Wilcoxon)
    diffs: list[float] = []
    dis_t_sum = dis_b_sum = disn = 0.0
    for _id, _seed, rt, rb in _pairs(records, arm_t, arm_b):
        if not rt.get("errored") and not rb.get("errored"):
            t = bool(rt.get("capability_pass"))
            bb = bool(rb.get("capability_pass"))
            capn += 1
            cap_t += int(t)
            cap_b += int(bb)
            if t and not bb:
                b += 1
            elif bb and not t:
                c += 1
            elif t and bb:
                both1 += 1
            else:
                both0 += 1
            dt = float(rt.get("discipline_score", 0))
            db = float(rb.get("discipline_score", 0))
            diffs.append(dt - db)
            dis_t_sum += dt
            dis_b_sum += db
            disn += 1
    p1 = cap_t / capn if capn else 0
    p2 = cap_b / capn if capn else 0
    wil = wilcoxon(diffs)
    return {
        "arm_treatment": arm_t,
        "arm_baseline": arm_b,
        "n_pairs": capn,
        "capability": {
            "rate_treatment": round(p1, 4),
            "rate_baseline": round(p2, 4),
            "discordant_b_only_treatment": b,
            "discordant_c_only_baseline": c,
            "mcnemar_p": round(mcnemar_exact(b, c), 4),
            "cohens_h": round(cohens_h(p1, p2), 4),
        },
        "discipline": {
            "mean_treatment": round(dis_t_sum / disn, 4) if disn else 0,
            "mean_baseline": round(dis_b_sum / disn, 4) if disn else 0,
            "mean_delta": round((dis_t_sum - dis_b_sum) / disn, 4) if disn else 0,
            "wilcoxon_p": wil["p"],
            "rank_biserial": wil["rank_biserial"],
            "n_nonzero": wil["n"],
        },
    }


def bucket_rates(records: list[dict], arms: list[str]) -> dict:
    out: dict[str, dict] = {}
    for arm in arms:
        buckets: dict[str, int] = {}
        total = 0
        for rec in records:
            for r in rec.get("arms", {}).get(arm, []) or []:
                total += 1
                bk = r.get("metrics", {}).get("status_bucket", "completed")
                buckets[bk] = buckets.get(bk, 0) + 1
        out[arm] = {"total": total, "buckets": buckets,
                    "error_rate": round(1 - buckets.get("completed", 0) / total, 4)
                    if total else 0}
    return out


def analyse(payload: dict) -> dict:
    records = payload.get("records", [])
    arms = payload.get("arms", [])
    comps = [compare(records, t, b) | {"label": lbl}
             for (t, b, lbl) in COMPARISONS if t in arms and b in arms]
    return {
        "stamp": payload.get("stamp"),
        "model": payload.get("model"),
        "seeds": payload.get("seeds"),
        "n_tasks": len(records),
        "comparisons": comps,
        "status_buckets": bucket_rates(records, arms),
    }


def gate_verdict(analysis: dict) -> dict:
    """L4 gate: PASS if ANY axis shows significant paired lift for package vs
    vanilla (McNemar p<0.05 OR Wilcoxon p<0.05 OR a status-bucket reduction)."""
    pkg = next((c for c in analysis["comparisons"]
                if c["arm_treatment"] == "package" and c["arm_baseline"] == "vanilla"), None)
    if not pkg:
        return {"verdict": "INCONCLUSIVE", "reason": "no package-vs-vanilla comparison"}
    cap_sig = pkg["capability"]["mcnemar_p"] < 0.05 and pkg["capability"]["rate_treatment"] > pkg["capability"]["rate_baseline"]
    dis_sig = pkg["discipline"]["wilcoxon_p"] < 0.05 and pkg["discipline"]["mean_delta"] > 0
    sb = analysis["status_buckets"]
    bucket_better = (sb.get("package", {}).get("error_rate", 1) <
                     sb.get("vanilla", {}).get("error_rate", 1))
    passed = cap_sig or dis_sig
    return {
        "verdict": "PASS" if passed else "FALSIFIED-OR-INCONCLUSIVE",
        "capability_significant": cap_sig,
        "discipline_significant": dis_sig,
        "status_bucket_better": bucket_better,
        "note": "PASS = significant paired discipline/capability lift; "
                "FALSIFIED only if also trivial across seeds (inspect n_pairs).",
    }


def to_markdown(analysis: dict, payload: dict) -> str:
    a = analysis
    g = a["gate"]
    L = []
    L.append("# Discipline-Axis Wrapper-Lift Benchmark (v2)")
    L.append("")
    L.append("> Generated by `scripts/bench_ab_v2_stats.py --markdown`. Source: "
             "`internal/bench/reports/ab-v2/`. Re-render with `task bench:ab:v2:diff`.")
    L.append("")
    L.append("## Honesty labels (read first)")
    L.append("")
    L.append(f"> 1. **Wrapper-lift on a fixed host (`{a['model']}`), NOT model-vs-model.** "
             "Measures what the agent-config package does to ONE host model on a neutral "
             "fixture — not a capability ranking.")
    L.append("> 2. **Discipline axis, not capability.** The headline is the *discipline* "
             "delta (did it stay minimal / verify / ask / not destroy / update downstream), "
             "not whether the goal was achievable.")
    L.append(f"> 3. **PILOT — low statistical power (N={a['n_tasks']} tasks × "
             f"{a['seeds']} seed(s)).** Directional only.")
    L.append("> 4. **Paired design**, errored runs excluded; McNemar (capability) + "
             "Wilcoxon signed-rank (discipline) + effect sizes.")
    L.append("> 5. **Not comparable to SWE-bench / GAIA / Fable scores** — a different "
             "question entirely.")
    L.append("")
    L.append(f"## Gate verdict: **{g['verdict']}**")
    L.append("")
    L.append(f"- capability lift significant: `{g['capability_significant']}`")
    L.append(f"- discipline lift significant: `{g['discipline_significant']}`")
    L.append(f"- status-bucket better (package vs vanilla): `{g.get('status_bucket_better')}`")
    L.append("")
    if g["verdict"] != "PASS":
        L.append("> **Honest null at this scale.** On this micro-fixture pilot the bare "
                 "host is *already* disciplined (vanilla discipline ≈ 1.0), so there is no "
                 "headroom for the package to lift. Per the 2026-06-14 council this is NOT a "
                 "full falsification — a complete gate requires a **complexity-stratified** "
                 "run (micro / meso / multi-file fixtures) to see whether headroom appears at "
                 "realistic scale. That run (meso/multi fixtures + ~17M-token budget) is the "
                 "deferred follow-up. No lift is claimed.")
        L.append("")
    for c in a["comparisons"]:
        cap, dis = c["capability"], c["discipline"]
        L.append(f"## {c['label']} — `{c['arm_treatment']}` vs `{c['arm_baseline']}` "
                 f"(n={c['n_pairs']} pairs)")
        L.append("")
        L.append("### Table 1 — capability axis (expected near-flat by design)")
        L.append("")
        L.append("| metric | baseline | treatment | test |")
        L.append("|---|---|---|---|")
        L.append(f"| pass-rate | {cap['rate_baseline']:.0%} | {cap['rate_treatment']:.0%} "
                 f"| McNemar p={cap['mcnemar_p']}, h={cap['cohens_h']} |")
        L.append("")
        L.append("### Table 2 — discipline axis (the lift)")
        L.append("")
        L.append("| metric | baseline | treatment | Δ | test |")
        L.append("|---|---|---|---|---|")
        L.append(f"| mean discipline | {dis['mean_baseline']:.3f} | {dis['mean_treatment']:.3f} "
                 f"| {dis['mean_delta']:+.3f} | Wilcoxon p={dis['wilcoxon_p']}, "
                 f"rb={dis['rank_biserial']} (n≠0={dis['n_nonzero']}) |")
        L.append("")
    L.append("## Status buckets (trajectory)")
    L.append("")
    L.append("| arm | runs | error-rate | buckets |")
    L.append("|---|---|---|---|")
    for arm, info in a["status_buckets"].items():
        bk = ", ".join(f"{k}:{v}" for k, v in info["buckets"].items())
        L.append(f"| {arm} | {info['total']} | {info['error_rate']:.0%} | {bk} |")
    L.append("")
    L.append("## Methodology")
    L.append("")
    L.append(f"- Host model: `{a['model']}` (pinned across all arms — a validity "
             "requirement, not a model comparison).")
    L.append(f"- Per-run budget cap: ${payload.get('budget_usd_per_run')}; "
             f"placebo injected ~{payload.get('placebo_chars')} chars of inert prose.")
    L.append("- Arms: vanilla (plugin off) · package (real plugin) · package-rdp "
             "(plugin + RDP rules) · placebo (plugin off + equal-length inert prose).")
    L.append("- Corpus: `internal/bench/corpora/ab-trackb-v2.yaml` (5 trap archetypes). "
             "Scoring: `bench_ab_scoring_v2.py` (deterministic, no LLM judge).")
    L.append("- Roadmap: `agents/roadmaps/road-to-discipline-axis-benchmark.md`.")
    L.append("")
    return "\n".join(L)


def main(argv: "list[str] | None" = None) -> int:
    ap = argparse.ArgumentParser(description="bench:ab v2 paired statistics.")
    ap.add_argument("report", nargs="?", help="paired report JSON (default: latest).")
    ap.add_argument("--json", action="store_true", help="emit analysis JSON to stdout.")
    ap.add_argument("--markdown", metavar="PATH", default="",
                    help="write the honest v2 report markdown to PATH (e.g. docs/benchmark.md).")
    args = ap.parse_args(argv if argv is not None else sys.argv[1:])

    if args.report:
        path = Path(args.report)
    else:
        cands = sorted(REPORTS_DIR.glob("*-ab-v2-paired.json"))
        if not cands:
            sys.stderr.write("no v2 paired report found\n")
            return 1
        path = cands[-1]
    payload = json.loads(path.read_text())
    analysis = analyse(payload)
    analysis["gate"] = gate_verdict(analysis)
    if args.markdown:
        out = Path(args.markdown)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(to_markdown(analysis, payload))
        sys.stdout.write(f"wrote {out}\n")
        return 0
    if args.json:
        sys.stdout.write(json.dumps(analysis, indent=2) + "\n")
        return 0
    a = analysis
    print(f"bench:ab v2 — {a['n_tasks']} tasks × {a['seeds']} seeds · model={a['model']}")
    for c in a["comparisons"]:
        print(f"\n[{c['label']}] {c['arm_treatment']} vs {c['arm_baseline']} (n={c['n_pairs']} pairs)")
        cap, dis = c["capability"], c["discipline"]
        print(f"  capability: {cap['rate_baseline']:.0%} -> {cap['rate_treatment']:.0%} "
              f"(McNemar p={cap['mcnemar_p']}, h={cap['cohens_h']})")
        print(f"  discipline: {dis['mean_baseline']:.3f} -> {dis['mean_treatment']:.3f} "
              f"(Δ={dis['mean_delta']:+.3f}, Wilcoxon p={dis['wilcoxon_p']}, rb={dis['rank_biserial']}, n≠0={dis['n_nonzero']})")
    print(f"\nGATE: {a['gate']['verdict']} "
          f"(cap_sig={a['gate']['capability_significant']}, dis_sig={a['gate']['discipline_significant']})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
