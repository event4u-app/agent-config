#!/usr/bin/env python3
"""Field model + P(finish 1st) simulator for prediction-pool-optimizer.

Honest operationalisation of the large-pool strategy note: in a big pool the
target is **P(finish ahead of the whole field)**, not E(points). Maximizing EV
makes your tip-set converge with everyone else's EV-max set, so you cannot open
the gap you need. This script measures that — and greedily finds the few tips
worth flipping off EV-max to manufacture upside.

What it does:

  1. Models the FIELD: each opponent commits one tip per match, drawn from a
     softmax over the per-match EV table (temperature controls spread — low =
     the crowd clusters tightly on EV-max, high = noisy). This is a model of
     the crowd, stated as such; feed a real field distribution if you have one.
  2. Pre-draws R outcome scenarios from the Poisson grids and pre-scores every
     opponent once, so evaluating any of MY tip-sets is cheap.
  3. Reports P(win) for the EV-max-everywhere baseline, then runs a greedy
     flip search: repeatedly flip the single tip that most raises P(win),
     reporting the EV cost and the P(win) gain per flip, up to --max-flips.

The lesson it makes concrete: with small N the EV-max set already wins often
and flips do not help (don't add variance you don't need); with large N and a
deficit, a handful of calculated flips can lift P(win) materially at a small
EV cost. The crossover is empirical — run it.

It is an APPROXIMATION: the field is a softmax-EV model, not your real pool's
tips, and the Poisson grids are only as good as the lambdas you feed (de-vigged
consensus odds — see reference/odds-and-bonus.md). Outcomes and EV are exact
for that model; the field shape is a prior.

Input JSON:
{
  "rule": {"exact": 5, "diff": 3, "tendency": 2},
  "participants": 120,            # field size N; opponents modelled = N-1 (capped by --max-opponents)
  "my_lead": 0,                   # my current points minus the rival-to-beat's (negative = behind)
  "field_temperature": 0.6,       # softmax temp for crowd spread around EV-max
  "matches": [
    {"match": "A", "lh": 2.0, "la": 0.7},
    {"match": "B", "lh": 0.6, "la": 2.1}
  ]
}

Usage:
  python3 scripts/prediction-pool/pool_winsim.py pool.json --runs 4000 --max-flips 4 [--seed 1]
"""
from __future__ import annotations

import argparse
import json
import math
import random
import sys
from pathlib import Path

# Reuse the exact-score engine.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from score_ev import ev_table, grid, _score  # noqa: E402


def _parse_tip(s: str) -> tuple[int, int]:
    h, a = s.split(":")
    return int(h), int(a)


def _flat_grid(g):
    """Flatten a joint grid into (prob, (h,a)) pairs for sampling."""
    flat = []
    for h in range(len(g)):
        for a in range(len(g[h])):
            p = g[h][a]
            if p > 0:
                flat.append((p, (h, a)))
    return flat


def _sample_outcome(flat, rng: random.Random) -> tuple[int, int]:
    r = rng.random()
    acc = 0.0
    for p, ha in flat:
        acc += p
        if r <= acc:
            return ha
    return flat[-1][1]


def _softmax_pick(rows, temperature: float, rng: random.Random) -> tuple[int, int]:
    """Pick a tip (h,a) from EV rows via softmax(EV / temperature)."""
    if temperature <= 0:
        h, a, _ = rows[0]
        return h, a
    top = rows[:24]  # the tail has negligible mass; cap for speed
    mx = top[0][2]
    weights = [math.exp((ev - mx) / temperature) for _, _, ev in top]
    tot = sum(weights)
    r = rng.random() * tot
    acc = 0.0
    for (h, a, _), w in zip(top, weights):
        acc += w
        if r <= acc:
            return h, a
    h, a, _ = top[-1]
    return h, a


def run(cfg: dict, runs: int, max_flips: int, max_opponents: int, top_flip: int,
        seed: int):
    rng = random.Random(seed)
    rule = cfg.get("rule", {"exact": 4, "diff": 3, "tendency": 2})
    pe, pd, pt = float(rule["exact"]), float(rule["diff"]), float(rule["tendency"])
    n = int(cfg.get("participants", 20))
    my_lead = float(cfg.get("my_lead", 0))
    temp = float(cfg.get("field_temperature", 0.6))
    matches = cfg["matches"]
    n_opp = max(0, min(n - 1, max_opponents))

    # Per match: EV table + sampling grid.
    per = []
    for m in matches:
        rows, _ = ev_table(m["lh"], m["la"], pe, pd, pt, max_tip=6)
        g = grid(m["lh"], m["la"])
        per.append({"name": m.get("match", "?"), "rows": rows, "flat": _flat_grid(g)})

    # Pre-draw R outcome scenarios (one actual scoreline per match per run).
    scenarios = [[_sample_outcome(p["flat"], rng) for p in per] for _ in range(runs)]

    # Model the field: each opponent commits a fixed tip per match (softmax-EV),
    # then score each opponent across all scenarios. Keep the per-scenario field
    # MAX so any of my tip-sets can be evaluated against it cheaply.
    field_max = [(-1e9) for _ in range(runs)]
    for _ in range(n_opp):
        opp_tips = [_softmax_pick(p["rows"], temp, rng) for p in per]
        for s_idx, sc in enumerate(scenarios):
            tot = 0.0
            for (th, ta), (ah, aa) in zip(opp_tips, sc):
                tot += _score(th, ta, ah, aa, pe, pd, pt)
            if tot > field_max[s_idx]:
                field_max[s_idx] = tot

    def my_total(tipset, s_idx):
        sc = scenarios[s_idx]
        tot = 0.0
        for (th, ta), (ah, aa) in zip(tipset, sc):
            tot += _score(th, ta, ah, aa, pe, pd, pt)
        return tot

    def p_win(tipset):
        wins = 0
        for s_idx in range(runs):
            if my_total(tipset, s_idx) + my_lead > field_max[s_idx]:
                wins += 1
        return wins / runs

    # Baseline: EV-max on every match.
    ev_max_set = [(p["rows"][0][0], p["rows"][0][1]) for p in per]
    base_pwin = p_win(ev_max_set)

    # Greedy flips: repeatedly flip the one tip that most raises P(win),
    # considering each match's top-`top_flip` EV candidates.
    current = list(ev_max_set)
    flips = []
    used = set()
    for _ in range(max_flips):
        best = None
        for mi, p in enumerate(per):
            if mi in used:
                continue
            for h, a, ev in p["rows"][:top_flip]:
                if (h, a) == current[mi]:
                    continue
                trial = list(current)
                trial[mi] = (h, a)
                pw = p_win(trial)
                ev_cost = p["rows"][0][2] - ev
                if best is None or pw > best["pwin"]:
                    best = {"mi": mi, "tip": (h, a), "pwin": pw, "ev_cost": ev_cost,
                            "name": p["name"]}
        if best is None or best["pwin"] <= (flips[-1]["pwin"] if flips else base_pwin):
            break
        current[best["mi"]] = best["tip"]
        used.add(best["mi"])
        flips.append(best)

    return {
        "participants": n, "opponents_modelled": n_opp, "runs": runs,
        "my_lead": my_lead, "field_temperature": temp,
        "rule": {"exact": pe, "diff": pd, "tendency": pt},
        "ev_max_set": [f"{per[i]['name']}={h}:{a}" for i, (h, a) in enumerate(ev_max_set)],
        "p_win_ev_max": round(base_pwin, 4),
        "flips": [
            {"match": f["name"], "to": f"{f['tip'][0]}:{f['tip'][1]}",
             "ev_cost": round(f["ev_cost"], 3), "p_win_after": round(f["pwin"], 4)}
            for f in flips
        ],
        "p_win_after_flips": round((flips[-1]["pwin"] if flips else base_pwin), 4),
    }


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Field model + P(win) simulator.")
    ap.add_argument("config", help="JSON config (rule, participants, my_lead, matches)")
    ap.add_argument("--runs", type=int, default=4000, help="outcome scenarios (default 4000)")
    ap.add_argument("--max-flips", type=int, default=4, help="max tips to flip off EV-max")
    ap.add_argument("--max-opponents", type=int, default=300,
                    help="cap opponents modelled (default 300)")
    ap.add_argument("--top-flip", type=int, default=4,
                    help="EV candidates per match to consider when flipping")
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--json", action="store_true", help="emit JSON instead of text")
    args = ap.parse_args(argv)

    cfg = json.loads(Path(args.config).read_text())
    res = run(cfg, args.runs, args.max_flips, args.max_opponents, args.top_flip, args.seed)

    if args.json:
        print(json.dumps(res, indent=2))
        return 0

    print(f"participants {res['participants']} (modelled {res['opponents_modelled']})  "
          f"runs {res['runs']}  my_lead {res['my_lead']}  field_temp {res['field_temperature']}")
    print(f"EV-max set: {', '.join(res['ev_max_set'])}")
    print(f"P(win) all-EV-max : {res['p_win_ev_max']:.4f}")
    if not res["flips"]:
        print("greedy flips: none improved P(win) — EV-max is already best (small/easy field).")
    else:
        print("suggested flips (greedy, each raises P(win) most):")
        for f in res["flips"]:
            print(f"  flip {f['match']} -> {f['to']}  (EV cost {f['ev_cost']:+.3f})  "
                  f"P(win) {f['p_win_after']:.4f}")
        print(f"P(win) after flips: {res['p_win_after_flips']:.4f}  "
              f"(+{res['p_win_after_flips'] - res['p_win_ev_max']:.4f})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
