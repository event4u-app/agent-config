#!/usr/bin/env python3
"""Exact-score EV optimiser for prediction-pool-optimizer.

Honest replacement for eyeballing the favourite — given each side's expected
goals (lambda) and the pool's scoring rule, this builds the full Poisson
score grid and computes the expected points of EVERY candidate tip, then
prints the EV-maximizing scoreline. It exists to kill two recurring failure
modes:

  1. Hallucinated high scorelines (4:2, 1:4, 3:2 ...). Under any partial-points
     rule these are almost never EV-max for a moderate favourite — the points
     live in the tendency and goal-difference tiers, not the exact high score.
  2. Under-tipped draws. A correctly-tipped draw banks the goal-difference
     tier on every draw scoreline, so a 1:1 can beat a 1:0 in a close game.
     The grid surfaces this; intuition does not.

The scoring model (configurable points per tier):

    exact result  → --exact     (default 4)
    goal diff      → --diff      (default 3)   # same difference, not exact; draw-on-draw lands here
    tendency       → --tendency  (default 2)   # same W/D/L sign only
    else           → 0

For kicktipp's common "2 / 3 / 5" config run with --tendency 2 --diff 3 --exact 5.

It is an APPROXIMATION only in its goal model: a Poisson per side with the
provided lambdas, sides independent. That is the standard football scoreline
model and is robust to small lambda changes — but the lambdas themselves must
come from de-vigged consensus odds (see reference/odds-and-bonus.md), not a
guess. Feed it real numbers and the EV-max is exact for that model.

Input — either two lambdas on the CLI:

  python3 scripts/prediction-pool/score_ev.py --lh 2.0 --la 0.7
  python3 scripts/prediction-pool/score_ev.py --lh 0.6 --la 2.1 --tendency 2 --diff 3 --exact 5

or a JSON file of named matches (batch):

  python3 scripts/prediction-pool/score_ev.py matches.json --tendency 2 --diff 3 --exact 5

  matches.json:
  [
    {"match": "Senegal-Iraq",  "lh": 2.0, "la": 0.7},
    {"match": "Qatar-Switzerland", "lh": 0.6, "la": 2.1}
  ]
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

MAX_GOALS = 12  # truncation of the Poisson grid; tail beyond this is negligible


def _pois_pmf(k: int, rate: float) -> float:
    if rate <= 0:
        return 1.0 if k == 0 else 0.0
    return math.exp(-rate) * rate ** k / math.factorial(k)


def _sign(x: int) -> int:
    return (x > 0) - (x < 0)


def _score(th: int, ta: int, ah: int, aa: int,
           pts_exact: float, pts_diff: float, pts_tend: float) -> float:
    """Points a tip (th:ta) earns against an actual result (ah:aa)."""
    if th == ah and ta == aa:
        return pts_exact
    if (th - ta) == (ah - aa):
        return pts_diff
    if _sign(th - ta) == _sign(ah - aa):
        return pts_tend
    return 0.0


def grid(lh: float, la: float, max_goals: int = MAX_GOALS):
    """Joint probability of every actual scoreline up to max_goals."""
    ph = [_pois_pmf(k, lh) for k in range(max_goals + 1)]
    pa = [_pois_pmf(k, la) for k in range(max_goals + 1)]
    return [[ph[h] * pa[a] for a in range(max_goals + 1)] for h in range(max_goals + 1)]


def ev_table(lh: float, la: float, pts_exact: float, pts_diff: float, pts_tend: float,
             max_tip: int = 6, max_goals: int = MAX_GOALS):
    """EV (expected points) of every candidate tip up to max_tip goals/side."""
    g = grid(lh, la, max_goals)
    rows = []
    for th in range(max_tip + 1):
        for ta in range(max_tip + 1):
            ev = 0.0
            for ah in range(max_goals + 1):
                for aa in range(max_goals + 1):
                    p = g[ah][aa]
                    if p <= 0:
                        continue
                    s = _score(th, ta, ah, aa, pts_exact, pts_diff, pts_tend)
                    if s:
                        ev += p * s
            rows.append((th, ta, ev))
    rows.sort(key=lambda r: r[2], reverse=True)
    return rows, g


def _modal(g) -> tuple[int, int, float]:
    best = (0, 0, 0.0)
    for h in range(len(g)):
        for a in range(len(g[h])):
            if g[h][a] > best[2]:
                best = (h, a, g[h][a])
    return best


def _p_draw(g) -> float:
    return sum(g[i][i] for i in range(len(g)))


def analyse(lh: float, la: float, pts_exact: float, pts_diff: float, pts_tend: float,
            max_tip: int = 6, top: int = 6):
    rows, g = ev_table(lh, la, pts_exact, pts_diff, pts_tend, max_tip)
    mh, ma, mp = _modal(g)
    return {
        "lambda": [lh, la],
        "rule": {"exact": pts_exact, "diff": pts_diff, "tendency": pts_tend},
        "ev_max": {"tip": f"{rows[0][0]}:{rows[0][1]}", "ev": round(rows[0][2], 3)},
        "modal_result": {"score": f"{mh}:{ma}", "prob": round(mp, 3)},
        "p_draw": round(_p_draw(g), 3),
        "ranked": [{"tip": f"{h}:{a}", "ev": round(ev, 3)} for h, a, ev in rows[:top]],
    }


def _print_one(name: str | None, res: dict) -> None:
    if name:
        print(f"\n## {name}")
    lh, la = res["lambda"]
    r = res["rule"]
    print(f"lambda {lh}:{la}  rule exact={r['exact']} diff={r['diff']} tendency={r['tendency']}")
    print(f"EV-max tip : {res['ev_max']['tip']}  (EV {res['ev_max']['ev']})")
    print(f"modal score: {res['modal_result']['score']}  (P {res['modal_result']['prob']})  "
          f"P(draw) {res['p_draw']}")
    print("ranked by EV:")
    for row in res["ranked"]:
        flag = "  <- EV-max" if row["tip"] == res["ev_max"]["tip"] else ""
        print(f"  {row['tip']:>5}  EV {row['ev']:.3f}{flag}")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Exact-score EV optimiser (Poisson grid).")
    ap.add_argument("matches", nargs="?", help="JSON file of matches [{match,lh,la}]")
    ap.add_argument("--lh", type=float, help="home expected goals (lambda)")
    ap.add_argument("--la", type=float, help="away expected goals (lambda)")
    ap.add_argument("--exact", type=float, default=4.0, help="points for exact result (default 4)")
    ap.add_argument("--diff", type=float, default=3.0, help="points for correct goal difference (default 3)")
    ap.add_argument("--tendency", type=float, default=2.0, help="points for correct tendency (default 2)")
    ap.add_argument("--max-tip", type=int, default=6, help="max goals/side to consider as a tip")
    ap.add_argument("--top", type=int, default=6, help="rows to print per match")
    ap.add_argument("--json", action="store_true", help="emit JSON instead of text")
    args = ap.parse_args(argv)

    jobs: list[tuple[str | None, float, float]] = []
    if args.matches:
        data = json.loads(Path(args.matches).read_text())
        for m in data:
            jobs.append((m.get("match"), float(m["lh"]), float(m["la"])))
    elif args.lh is not None and args.la is not None:
        jobs.append((None, args.lh, args.la))
    else:
        ap.error("provide either a matches JSON file or --lh and --la")

    out = []
    for name, lh, la in jobs:
        res = analyse(lh, la, args.exact, args.diff, args.tendency, args.max_tip, args.top)
        if name:
            res["match"] = name
        out.append(res)
        if not args.json:
            _print_one(name, res)

    if args.json:
        print(json.dumps(out, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
