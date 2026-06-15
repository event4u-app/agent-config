#!/usr/bin/env python3
"""Command surface for the file-first global knowledge-card store (ADR-100).

Structure-grounding v2, Phase 3 (road-to-structure-grounding-v2). The
maintainer/agent surface over the per-user global store at
``~/.event4u/agent-config/knowledge/``:

  list                 List global cards (table or --json): tier, seen-in, freshness.
  show <card>          Print a global card's content.
  trace <card>         Where-used: the repo-slugs the card has been seen in.
  forget <card>        Remove one global card (+ its usage entry).
  forget --tier <t>    Remove every global card of tier <t> (e.g. proprietary).
  promote <path>       Gate (redaction + tier) a project-local card and write it
                       to the global store with a provenance footer. Suggestion-
                       confirmed; proprietary requires explicit --manual.

A standalone Python CLI (v1-consistent with check_knowledge_cards.py /
evidence_report.py), invoked directly or via the `knowledge:global:*` Taskfile
targets. Deliberately NOT a `/knowledge` slash sub-command — that cluster is the
unrelated local-file-ingestion surface; the structure-grounding global store is
a separate concern (see ADR-100 § command surface).

Honours the kill-switch: every subcommand no-ops (prints a notice, exit 0) when
``knowledge.global_sharing.enabled`` is false.

Exit codes: 0 = ok / disabled-noop, 1 = usage / not-found, 2 = gate blocked,
3 = internal error.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

try:  # invocation-agnostic import
    from scripts._lib import knowledge_global as kg
    from scripts._lib import knowledge_global_promote as kgp
    from scripts._lib import knowledge_global_redaction as kgr
    from scripts._lib.agent_settings import load_agent_settings
    from scripts._lib.fs_atomic import write_atomic
except ModuleNotFoundError:  # pragma: no cover
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from _lib import knowledge_global as kg  # type: ignore
    from _lib import knowledge_global_promote as kgp  # type: ignore
    from _lib import knowledge_global_redaction as kgr  # type: ignore
    from _lib.agent_settings import load_agent_settings  # type: ignore
    from _lib.fs_atomic import write_atomic  # type: ignore

_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)


def _today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _card_path(card: str) -> Path:
    name = card if card.endswith(".md") else f"{card}.md"
    return kg.global_store_dir() / Path(name).name  # basename only — no traversal


def _list_cards() -> list[Path]:
    store = kg.global_store_dir()
    if not store.exists():
        return []
    return [p for p in sorted(store.glob("*.md")) if p.name.lower() != "readme.md"]


def _freshness_state(text: str, cfg: dict) -> str:
    fresh = cfg.get("freshness", {})
    hyp = int(fresh.get("hypothesis_after_days", 90))
    stale = int(fresh.get("stale_after_days", 180))
    prov = kg.parse_provenance_footer(text)
    last = prov.get("last_verified", "")
    if not last:
        return "?"
    try:
        age = (datetime.now(timezone.utc).date() - datetime.strptime(last, "%Y-%m-%d").date()).days
    except ValueError:
        return "?"
    if age >= stale:
        return "stale"
    if age >= hyp:
        return "hypothesis"
    return "fresh"


def _disabled_notice() -> int:
    print("knowledge.global_sharing.enabled is false — global store is inert (no-op).")
    return 0


# ---------------------------------------------------------------------------
# Subcommands
# ---------------------------------------------------------------------------

def cmd_list(args: argparse.Namespace) -> int:
    if not kg.is_enabled():
        return _disabled_notice()
    cfg = kg.load_global_sharing_config()
    cards = _list_cards()
    rows = []
    for p in cards:
        text = p.read_text(encoding="utf-8", errors="replace")
        prov = kg.parse_provenance_footer(text)
        rows.append({
            "card": p.stem,
            "tier": prov.get("tier", "?"),
            "seen_in": prov.get("seen_in", ""),
            "last_verified": prov.get("last_verified", "?"),
            "freshness": _freshness_state(text, cfg),
        })
    if args.json:
        print(json.dumps(rows, indent=2, sort_keys=True))
        return 0
    if not rows:
        print(f"No global cards in {kg.global_store_dir()}.")
        return 0
    print(f"{'CARD':<28} {'TIER':<12} {'FRESH':<11} {'LAST-VERIFIED':<14} SEEN-IN")
    for r in rows:
        print(f"{r['card']:<28} {r['tier']:<12} {r['freshness']:<11} {r['last_verified']:<14} {r['seen_in']}")
    return 0


def cmd_show(args: argparse.Namespace) -> int:
    if not kg.is_enabled():
        return _disabled_notice()
    path = _card_path(args.card)
    if not path.exists():
        print(f"No global card '{args.card}' in {kg.global_store_dir()}.", file=sys.stderr)
        return 1
    print(path.read_text(encoding="utf-8"))
    return 0


def cmd_trace(args: argparse.Namespace) -> int:
    if not kg.is_enabled():
        return _disabled_notice()
    cid = kgp.card_id_from(card_name=args.card)
    usage = kgp.load_usage()
    entry = usage["cards"].get(cid)
    path = _card_path(args.card)
    seen_in: list[str] = []
    if entry:
        seen_in = entry.get("seen_in", [])
    elif path.exists():
        prov = kg.parse_provenance_footer(path.read_text(encoding="utf-8", errors="replace"))
        seen_in = [s.strip() for s in prov.get("seen_in", "").split(",") if s.strip()]
    if args.json:
        print(json.dumps({"card": cid, "seen_in": seen_in}, indent=2, sort_keys=True))
        return 0
    if not seen_in:
        print(f"No where-used record for '{args.card}'.")
        return 0
    print(f"{args.card} seen in {len(seen_in)} repo(s): {', '.join(seen_in)}")
    return 0


def _forget_one(card: str) -> bool:
    path = _card_path(card)
    removed = False
    if path.exists():
        path.unlink()
        removed = True
    cid = kgp.card_id_from(card_name=card)
    usage = kgp.load_usage()
    if cid in usage["cards"]:
        usage["cards"].pop(cid, None)
        write_atomic(
            kg.global_store_dir(create=True) / kgp.USAGE_FILENAME,
            json.dumps(usage, indent=2, sort_keys=True) + "\n",
        )
        removed = True
    return removed


def cmd_forget(args: argparse.Namespace) -> int:
    if not kg.is_enabled():
        return _disabled_notice()
    if args.tier:
        removed = 0
        for p in _list_cards():
            prov = kg.parse_provenance_footer(p.read_text(encoding="utf-8", errors="replace"))
            if prov.get("tier") == args.tier:
                if _forget_one(p.stem):
                    removed += 1
        print(f"Forgot {removed} global card(s) of tier '{args.tier}'.")
        return 0
    if not args.card:
        print("forget: provide a <card> or --tier <t>.", file=sys.stderr)
        return 1
    if _forget_one(args.card):
        print(f"Forgot global card '{args.card}'.")
        return 0
    print(f"No global card '{args.card}' to forget.")
    return 1


def cmd_promote(args: argparse.Namespace) -> int:
    if not kg.is_enabled():
        return _disabled_notice()
    src_path = Path(args.path)
    try:
        text = src_path.read_text(encoding="utf-8")
    except OSError as exc:
        print(f"cannot read {src_path}: {exc}", file=sys.stderr)
        return 3

    # Resolve tier: explicit flag wins, else classify the source, else frontmatter.
    tier = args.tier or _frontmatter_tier(text) or kg.classify_tier(args.source or str(src_path))
    cfg = kg.load_global_sharing_config()
    allowed = tuple(kg.allowed_tiers())

    result = kgr.gate_card_for_global(
        text,
        tier=tier,
        source=args.source,
        card_name=src_path.name,
        allowed_tiers=allowed,
        redaction_enabled=bool(cfg.get("redaction", {}).get("enabled", True)),
        halt_on_trigger=bool(cfg.get("redaction", {}).get("halt_on_trigger", True)),
    )
    if not result.eligible:
        if result.manual_only and not args.manual:
            print(
                f"{result.summary()}\n"
                "→ proprietary cards are manual-only. Re-run with --manual to override "
                "(operator intent), and ensure redaction is clean.",
                file=sys.stderr,
            )
            return 2
        if not (result.manual_only and args.manual):
            print(result.summary(), file=sys.stderr)
            return 2
        # manual override of proprietary: still run redaction, never skip it.
        violations = kgr.redaction_scan(text)
        if violations and bool(cfg.get("redaction", {}).get("halt_on_trigger", True)):
            print(
                "global-share BLOCKED (manual proprietary): redaction halt — "
                + "; ".join(f"{v.category}: {v.snippet!r}" for v in violations),
                file=sys.stderr,
            )
            return 2

    # Build provenance + usage.
    cid = kgp.card_id_from(card_name=src_path.name, source=args.source)
    slug = kgp.repo_slug()
    today = _today()
    entry = kgp.record_seen(cid, slug, tier=tier, source=args.source, today=today)
    seen_in = entry.get("seen_in", [slug]) or [slug]
    first = entry.get("first_seen") or {"repo": slug, "date": today}

    footer = kg.render_provenance_footer(
        first_seen_repo=first.get("repo", slug),
        first_seen_date=first.get("date", today),
        promoted_at=today,
        last_verified=today,
        tier=tier,
        seen_in=seen_in,
    )
    out_text = _ensure_tier_frontmatter(text, tier)
    out_text = kg.strip_provenance_footer(out_text).rstrip() + "\n\n" + footer
    dest = _card_path(cid)
    write_atomic(kg.global_store_dir(create=True) / dest.name, out_text)

    # Flag promoted in the usage sidecar.
    usage = kgp.load_usage()
    if cid in usage["cards"]:
        usage["cards"][cid]["promoted"] = True
        write_atomic(
            kg.global_store_dir(create=True) / kgp.USAGE_FILENAME,
            json.dumps(usage, indent=2, sort_keys=True) + "\n",
        )
    print(f"Promoted '{cid}' (tier={tier}) → {dest}")
    return 0


def cmd_purge(args: argparse.Namespace) -> int:
    """Remove the global store and strip provenance footers from project cards.

    Runs regardless of `enabled` (you purge *after* disabling). Requires
    --confirm. v1 project-local cards are untouched except for the provenance
    footer strip (idempotent)."""
    if not args.confirm:
        print("Refusing to purge without --confirm. This removes the global "
              "store and strips provenance from project cards.", file=sys.stderr)
        return 1

    store = kg.global_store_dir()
    removed = 0
    if store.exists():
        for p in sorted(store.glob("*")):
            if p.is_file():
                p.unlink()
                removed += 1
        try:
            store.rmdir()
        except OSError:
            pass  # non-empty (subdirs) — leave it
    print(f"Purged global store ({removed} file(s)) at {store}.")

    # Strip provenance footers from project-local cards (idempotent).
    local_dir = Path("agents/knowledge")
    stripped = 0
    if local_dir.exists():
        for p in sorted(local_dir.glob("*.md")):
            if p.name.lower() == "readme.md":
                continue
            text = p.read_text(encoding="utf-8", errors="replace")
            new = kg.strip_provenance_footer(text)
            if new != text:
                write_atomic(p, new)
                stripped += 1
    print(f"Stripped provenance footer from {stripped} project-local card(s).")
    return 0


def cmd_validate(args: argparse.Namespace) -> int:
    """Offline lint of the untracked global store + a freshness-flip report.

    Runs check_knowledge_cards.py --global --strict against the store
    (--check-urls opts into live pointer checks), then reports per-card
    freshness state (≥hypothesis_after_days → hypothesis, ≥stale_after_days →
    stale; positive structure skipped until re-verified)."""
    if not kg.is_enabled():
        return _disabled_notice()
    store = kg.global_store_dir()
    if not store.exists() or not _list_cards():
        print(f"No global cards in {store} — nothing to validate.")
        return 0

    import subprocess
    cmd = [sys.executable, str(Path(__file__).resolve().parent / "check_knowledge_cards.py"),
           "--global", "--strict"]
    if args.check_urls:
        cmd.append("--check-urls")
    lint = subprocess.run(cmd, capture_output=True, text=True)
    sys.stdout.write(lint.stdout)
    if lint.stderr:
        sys.stderr.write(lint.stderr)

    # Freshness-flip report (informational; never fails the run).
    cfg = kg.load_global_sharing_config()
    print("\nFreshness (lead-only flip — positive structure skipped until re-verified):")
    for p in _list_cards():
        state = _freshness_state(p.read_text(encoding="utf-8", errors="replace"), cfg)
        marker = {"fresh": "✅", "hypothesis": "⚠️", "stale": "⚠️", "?": "⚠️"}.get(state, "⚠️")
        print(f"  {marker} {p.stem}: {state}")
    return lint.returncode


def cmd_lead_check(args: argparse.Namespace) -> int:
    """Lead-only enforcement: surface a violation when a GLOBAL positive-structure
    line (Assumed bucket, origin=GLOBAL) was used without a this-session Verified
    re-confirmation. Honest instrumentation — warn by default, --strict to fail."""
    report = Path(args.report)
    if not report.exists():
        print(f"No Evidence Report at {report} — nothing to check.")
        return 0
    text = report.read_text(encoding="utf-8", errors="replace")

    # Split into bucket sections by heading.
    assumed: list[str] = []
    verified: list[str] = []
    current = None
    for line in text.splitlines():
        low = line.strip().lower()
        if low.startswith("## verified"):
            current = verified
        elif low.startswith("## assumed"):
            current = assumed
        elif low.startswith("## "):
            current = None
        elif current is not None and line.lstrip().startswith("- "):
            current.append(line.strip())

    src_re = re.compile(r"source=([^\s·\]]+)")
    verified_sources = {m.group(1) for l in verified for m in [src_re.search(l)] if m}
    verified_blob = "\n".join(verified).lower()

    violations: list[str] = []
    for line in assumed:
        if "origin=global" not in line.lower():
            continue
        m = src_re.search(line)
        src = m.group(1) if m else ""
        claim = line.split("`")[0].lstrip("- ").strip()
        confirmed = (src and src in verified_sources) or (
            claim and len(claim) > 8 and claim.lower()[:40] in verified_blob
        )
        if not confirmed:
            violations.append(claim or src or line)

    if not violations:
        print("✅  No unconfirmed GLOBAL positive-structure leads in the Evidence Report.")
        return 0
    print(f"⚠️  {len(violations)} GLOBAL lead(s) used without this-session re-confirmation:")
    for v in violations:
        print(f"  - {v[:100]}")
    print("Re-confirm each against the live source (move to Verified) before relying on it.")
    return 1 if args.strict else 0


# ---------------------------------------------------------------------------
# Frontmatter helpers
# ---------------------------------------------------------------------------

def _frontmatter_tier(text: str) -> str:
    m = _FRONTMATTER_RE.match(text)
    if not m:
        return ""
    for line in m.group(1).splitlines():
        s = line.strip()
        if s.startswith("tier:"):
            val = s[len("tier:"):].strip().strip('"').strip("'")
            return val if val in kg.TIERS else ""
    return ""


def _ensure_tier_frontmatter(text: str, tier: str) -> str:
    """Ensure the card frontmatter carries an accurate ``tier:`` field."""
    m = _FRONTMATTER_RE.match(text)
    if not m:
        return text
    block = m.group(1)
    if re.search(r"^\s*tier:", block, re.MULTILINE):
        new_block = re.sub(
            r"^\s*tier:.*$", f"tier: {tier}", block, count=1, flags=re.MULTILINE
        )
    else:
        new_block = f"tier: {tier}\n{block}"
    return text[: m.start(1)] + new_block + text[m.end(1):]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="knowledge_global_cli", description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_list = sub.add_parser("list", help="List global cards.")
    p_list.add_argument("--json", action="store_true")

    p_show = sub.add_parser("show", help="Print a global card.")
    p_show.add_argument("card")

    p_trace = sub.add_parser("trace", help="Where-used for a card.")
    p_trace.add_argument("card")
    p_trace.add_argument("--json", action="store_true")

    p_forget = sub.add_parser("forget", help="Remove a card or a whole tier.")
    p_forget.add_argument("card", nargs="?", default="")
    p_forget.add_argument("--tier", choices=kg.TIERS, default="")

    p_promote = sub.add_parser("promote", help="Promote a project-local card to the global store.")
    p_promote.add_argument("path", help="Path to the project-local card.")
    p_promote.add_argument("--source", default="", help="Card source URL/path (for tier classification).")
    p_promote.add_argument("--tier", choices=kg.TIERS, default="")
    p_promote.add_argument("--manual", action="store_true", help="Operator override for proprietary.")

    p_validate = sub.add_parser("validate", help="Offline lint of the untracked global store + freshness report.")
    p_validate.add_argument("--check-urls", action="store_true", help="Opt into live pointer checks.")

    p_lead = sub.add_parser("lead-check", help="Surface GLOBAL leads used without this-session re-confirmation.")
    p_lead.add_argument(
        "--report", default="agents/memory/knowledge/session/evidence-report.md",
        help="Path to the session Evidence Report.",
    )
    p_lead.add_argument("--strict", action="store_true", help="Exit 1 on a violation (CI use).")

    p_purge = sub.add_parser("purge", help="Remove the global store + strip provenance from project cards.")
    p_purge.add_argument("--confirm", action="store_true", help="Required — destructive.")
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    dispatch = {
        "list": cmd_list,
        "show": cmd_show,
        "trace": cmd_trace,
        "forget": cmd_forget,
        "promote": cmd_promote,
        "validate": cmd_validate,
        "lead-check": cmd_lead_check,
        "purge": cmd_purge,
    }
    return dispatch[args.cmd](args)


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
