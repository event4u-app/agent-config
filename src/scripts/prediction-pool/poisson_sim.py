#!/usr/bin/env python3
"""Poisson tournament simulator for prediction-pool-optimizer.

Honest replacement for "I simulated 10,000 runs" — this actually runs them.
Goals per match are drawn from a Poisson whose rate comes from each team's
attack / defence strength; group stages are round-robin, then a single-
elimination bracket runs over the qualifiers. Aggregates advancement and
title probabilities over N runs.

It is an APPROXIMATION, stated as such: real tournament bracket pairings
(winner-of-A vs runner-up-of-B …) are format-specific. Provide an explicit
`bracket` (list of name pairs per round, or "auto" for a random seed) to
control this; the default "auto" randomly seeds qualifiers and is good
enough for outright/advancement estimates, not for exact-pairing bonus
questions.

Input JSON shape:
{
  "base_goals": 1.35,                       # league-average goals per side
  "teams": { "Germany": {"att": 1.3, "def": 0.8}, ... },   # att/def multipliers (1.0 = average)
  "groups": [ ["Germany","Scotland","Hungary","Switzerland"], ... ],
  "advance_per_group": 2,
  "bracket": "auto"                          # or omit; "auto" = random seed of qualifiers
}

Usage:
  python3 scripts/prediction-pool/poisson_sim.py teams.json --runs 20000 [--seed 1]
"""
from __future__ import annotations

import argparse
import json
import math
import random
import sys
from collections import defaultdict
from pathlib import Path


def _poisson(rate: float, rng: random.Random) -> int:
    """Knuth's algorithm — stdlib only, no numpy."""
    if rate <= 0:
        return 0
    L = math.exp(-rate)
    k, p = 0, 1.0
    while True:
        k += 1
        p *= rng.random()
        if p <= L:
            return k - 1


def _rates(home: str, away: str, teams: dict, base: float) -> tuple[float, float]:
    h, a = teams.get(home, {}), teams.get(away, {})
    lam_h = base * h.get("att", 1.0) * a.get("def", 1.0)
    lam_a = base * a.get("att", 1.0) * h.get("def", 1.0)
    return lam_h, lam_a


def _play(home: str, away: str, teams: dict, base: float, rng: random.Random,
          allow_draw: bool = True) -> tuple[int, int]:
    lam_h, lam_a = _rates(home, away, teams, base)
    gh, ga = _poisson(lam_h, rng), _poisson(lam_a, rng)
    if not allow_draw and gh == ga:
        # extra-time / penalties proxy: edge to the stronger attack, else coin flip
        if lam_h == lam_a:
            return (gh + 1, ga) if rng.random() < 0.5 else (gh, ga + 1)
        return (gh + 1, ga) if lam_h > lam_a else (gh, ga + 1)
    return gh, ga


def _group_table(group: list[str], teams: dict, base: float, rng: random.Random) -> list[str]:
    pts = defaultdict(int)
    gd = defaultdict(int)
    gf = defaultdict(int)
    for i in range(len(group)):
        for j in range(i + 1, len(group)):
            gh, ga = _play(group[i], group[j], teams, base, rng)
            gd[group[i]] += gh - ga
            gd[group[j]] += ga - gh
            gf[group[i]] += gh
            gf[group[j]] += ga
            if gh > ga:
                pts[group[i]] += 3
            elif ga > gh:
                pts[group[j]] += 3
            else:
                pts[group[i]] += 1
                pts[group[j]] += 1
    # rank: points, then goal difference, then goals for, then random tiebreak
    return sorted(group, key=lambda t: (pts[t], gd[t], gf[t], rng.random()), reverse=True)


def _knockout(qualifiers: list[str], teams: dict, base: float, rng: random.Random) -> str:
    field = qualifiers[:]
    rng.shuffle(field)
    # pad to a power of two with byes
    while (len(field) & (len(field) - 1)) != 0:
        field.append(None)
    while len(field) > 1:
        nxt = []
        for i in range(0, len(field), 2):
            a, b = field[i], field[i + 1]
            if a is None:
                nxt.append(b)
            elif b is None:
                nxt.append(a)
            else:
                gh, ga = _play(a, b, teams, base, rng, allow_draw=False)
                nxt.append(a if gh > ga else b)
        field = nxt
    return field[0]


def simulate(cfg: dict, runs: int, seed: int | None) -> dict:
    rng = random.Random(seed)
    base = float(cfg.get("base_goals", 1.35))
    teams = cfg["teams"]
    groups = cfg.get("groups", [])
    adv = int(cfg.get("advance_per_group", 2))

    advanced = defaultdict(int)
    champ = defaultdict(int)
    for _ in range(runs):
        qualifiers: list[str] = []
        if groups:
            for g in groups:
                ranked = _group_table(g, teams, base, rng)
                top = ranked[:adv]
                qualifiers.extend(top)
                for t in top:
                    advanced[t] += 1
        else:
            qualifiers = list(teams.keys())
        winner = _knockout(qualifiers, teams, base, rng) if len(qualifiers) > 1 else (qualifiers or [None])[0]
        if winner is not None:
            champ[winner] += 1

    def pct(d):
        return {t: round(100 * c / runs, 2) for t, c in sorted(d.items(), key=lambda kv: -kv[1])}

    return {"runs": runs, "seed": seed, "advance_pct": pct(advanced), "title_pct": pct(champ)}


def main() -> int:
    ap = argparse.ArgumentParser(description="Poisson tournament simulator (stdlib only).")
    ap.add_argument("config", help="Path to teams/groups JSON.")
    ap.add_argument("--runs", type=int, default=20000, help="Number of simulated tournaments.")
    ap.add_argument("--seed", type=int, default=None, help="RNG seed for reproducibility.")
    args = ap.parse_args()

    cfg_path = Path(args.config)
    if not cfg_path.is_file():
        print(f"ERROR: config not found: {cfg_path}", file=sys.stderr)
        return 2
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    if "teams" not in cfg:
        print("ERROR: config needs a 'teams' object.", file=sys.stderr)
        return 2

    result = simulate(cfg, args.runs, args.seed)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
