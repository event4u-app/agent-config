"""Session-profile overlay — recommendation-bias MVP.

Implements the `runtime.active_packs` overlay locked in the
session-profile-activation roadmap (Phase 0 decisions, 2026-06-02):

* The overlay is an **ephemeral** list of pack ids written to
  ``agents/settings/.agent-settings.local.yml`` (gitignored, deepest layer),
  never the committed settings file. It is a runtime modulation of the
  existing ``pack`` axis, not a fifth axis (ADR-010 addendum).
* Activation resolves a token (a ``session-profiles.yml`` alias OR a raw
  pack id) to a seed set, **fails fast** if a seed pack is not installed,
  then expands the transitive ``requires_hint`` closure from ``packs.yml``.
* Reads are **fail-open**: a corrupt / unparseable / schema-invalid overlay
  is ignored and the full surface returns (the council's trust-boundary
  requirement). Writes are **atomic** (tmp + ``os.replace``).
* Deactivation is **explicit** (``/profile deactivate``) — option (a). There
  is no silent ``session_start`` reset (the registry-refresh Catch-22); the
  hook only emits a staleness *notice*.

Surfacing rule (recommendation-bias): an artefact from the discovery
manifest is surfaced when it is **core-trust** (or unscoped) — always shown
— OR its ``packs`` intersect the active overlay. Execution is NOT gated.

Pure functions are unit-testable; the ``__main__`` CLI is what the
``/profile`` command shells out to.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

try:  # lazy PyYAML, mirrors scripts/config/profiles.py
    import yaml
except Exception:  # pragma: no cover - yaml is a hard dep in practice
    yaml = None  # type: ignore

from scripts._lib import agent_settings

# --- Paths -----------------------------------------------------------------

PACKS_VOCAB_REL = "config/discovery/packs.yml"
ALIASES_REL = "config/discovery/session-profiles.yml"
DISCOVERY_MANIFEST_REL = "dist/discovery/discovery-manifest.json"

#: Dotted key the overlay lives under in the local settings file.
OVERLAY_SECTION = "runtime"
OVERLAY_KEY = "active_packs"

#: Trust levels that are ALWAYS surfaced regardless of the active overlay.
ALWAYS_TRUST_LEVELS = frozenset({"core"})


class SessionProfileError(ValueError):
    """Raised for an unknown token or a not-installed pack (fail-fast)."""


@dataclass(frozen=True)
class ActivationResult:
    active_packs: tuple[str, ...]
    requested: tuple[str, ...]
    closure_added: tuple[str, ...] = ()
    notes: tuple[str, ...] = ()


@dataclass
class SurfaceResult:
    active_packs: list[str]
    shown: list[dict[str, Any]] = field(default_factory=list)
    hidden: list[dict[str, Any]] = field(default_factory=list)


# --- Loaders ---------------------------------------------------------------

def _read_yaml(path: Path) -> Any:
    if yaml is None or not path.exists():
        return None
    try:
        with path.open(encoding="utf-8") as fh:
            return yaml.safe_load(fh)
    except Exception:
        return None


def load_packs_vocab(repo_root: Path) -> dict[str, dict[str, Any]]:
    """Return ``{pack_id: pack_dict}`` from ``packs.yml`` (empty on failure)."""
    data = _read_yaml(repo_root / PACKS_VOCAB_REL)
    if not isinstance(data, list):
        return {}
    out: dict[str, dict[str, Any]] = {}
    for entry in data:
        if isinstance(entry, dict) and entry.get("id"):
            out[str(entry["id"])] = entry
    return out


def load_aliases(repo_root: Path) -> dict[str, list[str]]:
    """Return ``{alias: [pack_id, ...]}`` from ``session-profiles.yml``."""
    data = _read_yaml(repo_root / ALIASES_REL)
    if not isinstance(data, dict):
        return {}
    aliases = data.get("aliases")
    if not isinstance(aliases, dict):
        return {}
    out: dict[str, list[str]] = {}
    for name, packs in aliases.items():
        if isinstance(packs, list):
            out[str(name)] = [str(p) for p in packs]
    return out


def installed_packs(repo_root: Path, settings: dict[str, Any] | None = None) -> set[str]:
    """The set of pack ids treated as installed.

    Source of truth: the top-level ``packs:`` block injected into the
    settings file at install time. When absent (e.g. the maintainer repo,
    or a base-only install) the **full vocabulary** is treated as available
    — every pack's artefacts are present on disk there.
    """
    if settings is None:
        settings = agent_settings.load_agent_settings(cwd=repo_root)
    declared = settings.get("packs")
    if isinstance(declared, list) and declared:
        return {str(p) for p in declared}
    return set(load_packs_vocab(repo_root).keys())


# --- Closure + token resolution -------------------------------------------

def expand_closure(seeds: list[str] | set[str], vocab: dict[str, dict[str, Any]]) -> list[str]:
    """Transitive ``requires_hint`` closure of ``seeds``, sorted, deduped."""
    seen: set[str] = set()
    stack = list(seeds)
    while stack:
        pid = stack.pop()
        if pid in seen:
            continue
        seen.add(pid)
        entry = vocab.get(pid) or {}
        for dep in entry.get("requires_hint") or []:
            if dep not in seen:
                stack.append(str(dep))
    return sorted(seen)


def resolve_tokens(
    tokens: list[str],
    vocab: dict[str, dict[str, Any]],
    aliases: dict[str, list[str]],
) -> list[str]:
    """Resolve activation tokens (alias names or pack ids) to a seed pack set.

    Raises :class:`SessionProfileError` for a token that is neither a known
    alias nor a known pack id.
    """
    seeds: set[str] = set()
    for token in tokens:
        if token in aliases:
            seeds.update(aliases[token])
        elif token in vocab:
            seeds.add(token)
        else:
            known = sorted(set(aliases) | set(vocab))
            raise SessionProfileError(
                f"unknown profile/pack '{token}'. Known: {', '.join(known)}"
            )
    return sorted(seeds)


# --- Overlay read / write (fail-open read, atomic write) -------------------

def _overlay_path(repo_root: Path) -> Path:
    return repo_root.joinpath(*agent_settings.LOCAL_PROJECT_SUBDIR, agent_settings.LOCAL_PROJECT_FILE)


def read_overlay(repo_root: Path) -> list[str]:
    """Return the active pack list. **Fail-open**: any problem → ``[]``.

    Schema: ``runtime.active_packs`` must be a list of strings. Anything
    else (missing, wrong type, unparseable file) yields an empty list so a
    corrupt overlay never hides the full surface.
    """
    data = _read_yaml(_overlay_path(repo_root))
    if not isinstance(data, dict):
        return []
    runtime = data.get(OVERLAY_SECTION)
    if not isinstance(runtime, dict):
        return []
    packs = runtime.get(OVERLAY_KEY)
    if not isinstance(packs, list):
        return []
    return [str(p) for p in packs if isinstance(p, (str, int))]


def _write_local(repo_root: Path, data: dict[str, Any]) -> None:
    """Atomic write of the whole local settings dict (tmp + os.replace)."""
    path = _overlay_path(repo_root)
    path.parent.mkdir(parents=True, exist_ok=True)
    header = (
        "# Per-machine local overrides (gitignored, deepest-winning layer).\n"
        "# `runtime.active_packs` is the EPHEMERAL session-profile overlay —\n"
        "# managed by `/profile`. Delete the key (or this file) to reset.\n"
    )
    body = yaml.safe_dump(data, sort_keys=False, default_flow_style=False) if yaml else ""
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=".agent-settings.local.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(header)
            fh.write(body)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def set_overlay(repo_root: Path, packs: list[str]) -> None:
    """Set ``runtime.active_packs`` to ``packs`` (atomic), preserving other keys."""
    data = _read_yaml(_overlay_path(repo_root))
    if not isinstance(data, dict):
        data = {}
    runtime = data.get(OVERLAY_SECTION)
    if not isinstance(runtime, dict):
        runtime = {}
    if packs:
        runtime[OVERLAY_KEY] = sorted(set(packs))
        data[OVERLAY_SECTION] = runtime
    else:
        runtime.pop(OVERLAY_KEY, None)
        if runtime:
            data[OVERLAY_SECTION] = runtime
        else:
            data.pop(OVERLAY_SECTION, None)
    _write_local(repo_root, data)


def clear_overlay(repo_root: Path) -> None:
    set_overlay(repo_root, [])


# --- High-level operations -------------------------------------------------

def activate(repo_root: Path, tokens: list[str], settings: dict[str, Any] | None = None) -> ActivationResult:
    """Resolve + validate + expand + write the overlay for ``tokens``.

    Fail-fast (raises :class:`SessionProfileError`) when a resolved seed
    pack is not installed.
    """
    vocab = load_packs_vocab(repo_root)
    aliases = load_aliases(repo_root)
    seeds = resolve_tokens(tokens, vocab, aliases)
    inst = installed_packs(repo_root, settings)
    missing = [p for p in seeds if p not in inst]
    if missing:
        raise SessionProfileError(
            f"not installed: {', '.join(sorted(missing))}. "
            f"Install the pack first (it is not in your settings `packs:` list)."
        )
    closure = expand_closure(seeds, vocab)
    # Closure members must also be installed; drop + note any that are not
    # (defensive — a misconfigured requires_hint should not block activation).
    usable = [p for p in closure if p in inst]
    dropped = [p for p in closure if p not in inst]
    set_overlay(repo_root, usable)
    notes = []
    if dropped:
        notes.append(f"closure deps not installed, skipped: {', '.join(sorted(dropped))}")
    added = sorted(set(usable) - set(seeds))
    return ActivationResult(
        active_packs=tuple(sorted(usable)),
        requested=tuple(tokens),
        closure_added=tuple(added),
        notes=tuple(notes),
    )


def deactivate(repo_root: Path, tokens: list[str] | None = None) -> list[str]:
    """Clear the overlay (no tokens) or remove the named packs from it.

    Returns the resulting active pack list. With ``tokens``, only the named
    packs *themselves* are removed from the flat active set — never their
    transitive closure. A shared dependency therefore survives as long as it
    is its own entry in the overlay (e.g. deactivating ``laravel`` while
    ``php`` is active leaves both ``php`` and ``engineering-base`` in place).
    This is the safe, predictable behaviour for a flat pack overlay: removing
    a pack only ever *widens* the surface, never hides something a remaining
    pack needs.
    """
    if not tokens:
        clear_overlay(repo_root)
        return []
    vocab = load_packs_vocab(repo_root)
    aliases = load_aliases(repo_root)
    to_remove = set(resolve_tokens(tokens, vocab, aliases))
    current = set(read_overlay(repo_root))
    new_active = sorted(current - to_remove)
    set_overlay(repo_root, new_active)
    return new_active


# --- Surface filter (recommendation-bias) ----------------------------------

def load_manifest(repo_root: Path) -> list[dict[str, Any]]:
    path = repo_root / DISCOVERY_MANIFEST_REL
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return []
    arts = data.get("artefacts")
    return arts if isinstance(arts, list) else []


def is_always_shown(artefact: dict[str, Any]) -> bool:
    """Core-trust or unscoped artefacts are always surfaced."""
    packs = artefact.get("packs") or []
    if not packs:
        return True
    level = (artefact.get("trust") or {}).get("level")
    return level in ALWAYS_TRUST_LEVELS


def is_surfaced(artefact: dict[str, Any], active: set[str]) -> bool:
    if not active:
        return True  # no overlay → everything surfaces
    if is_always_shown(artefact):
        return True
    return bool(set(artefact.get("packs") or []) & active)


def compute_surface(
    repo_root: Path,
    category: str | None = None,
    active: list[str] | None = None,
) -> SurfaceResult:
    """Split manifest artefacts into shown / hidden for the active overlay."""
    if active is None:
        active = read_overlay(repo_root)
    active_set = set(active)
    result = SurfaceResult(active_packs=sorted(active_set))
    for art in load_manifest(repo_root):
        if category and art.get("category") != category:
            continue
        if art.get("category") not in {"command", "skill"}:
            continue
        slim = {
            "name": art.get("name"),
            "category": art.get("category"),
            "packs": art.get("packs") or [],
        }
        if is_surfaced(art, active_set):
            result.shown.append(slim)
        else:
            result.hidden.append(slim)
    return result


def stale_notice(repo_root: Path) -> str | None:
    """Return the `session_start` staleness notice, or ``None`` if no overlay.

    Implements option (a)'s companion: the overlay survives a restart, so on
    a new session we *remind* (never silently reset).
    """
    active = read_overlay(repo_root)
    if not active:
        return None
    return (
        f"profile still active from a previous session: {', '.join(active)} "
        f"— `/profile deactivate` to clear, `/profile show` for details."
    )


# --- CLI -------------------------------------------------------------------

def _repo_root(arg: str | None) -> Path:
    if arg:
        return Path(arg).resolve()
    found = agent_settings.find_project_root(Path.cwd())
    return found or Path.cwd()


def main(argv: list[str] | None = None) -> int:
    # Shared flags available both before AND after the subcommand.
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--root", default=None, help="repo root (default: auto-detect)")
    common.add_argument("--json", action="store_true", help="machine-readable output")

    ap = argparse.ArgumentParser(
        prog="session_profiles", description="Session-profile overlay manager.", parents=[common]
    )
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_act = sub.add_parser("activate", parents=[common], help="activate one or more profiles/packs")
    p_act.add_argument("tokens", nargs="+")

    p_de = sub.add_parser("deactivate", parents=[common], help="deactivate (clear, or named tokens)")
    p_de.add_argument("tokens", nargs="*")

    sub.add_parser("show", parents=[common], help="show active overlay + surface counts")
    p_surf = sub.add_parser("surface", parents=[common], help="list shown/hidden artefacts")
    p_surf.add_argument("--category", choices=["command", "skill"], default=None)
    sub.add_parser("stale-notice", parents=[common], help="emit session_start staleness notice if any")

    args = ap.parse_args(argv)
    root = _repo_root(args.root)

    try:
        if args.cmd == "activate":
            res = activate(root, args.tokens)
            payload = {
                "active_packs": list(res.active_packs),
                "requested": list(res.requested),
                "closure_added": list(res.closure_added),
                "notes": list(res.notes),
            }
            if args.json:
                print(json.dumps(payload))
            else:
                print(f"activated: {', '.join(res.active_packs) or '(none)'}")
                if res.closure_added:
                    print(f"  + closure: {', '.join(res.closure_added)}")
                for n in res.notes:
                    print(f"  note: {n}")
            return 0

        if args.cmd == "deactivate":
            active = deactivate(root, args.tokens or None)
            if args.json:
                print(json.dumps({"active_packs": active}))
            else:
                print(f"active now: {', '.join(active) or '(none — full surface)'}")
            return 0

        if args.cmd == "show":
            active = read_overlay(root)
            surf = compute_surface(root, active=active)
            cmds_shown = sum(1 for a in surf.shown if a["category"] == "command")
            skills_shown = sum(1 for a in surf.shown if a["category"] == "skill")
            if args.json:
                print(json.dumps({
                    "active_packs": active,
                    "shown_total": len(surf.shown),
                    "hidden_total": len(surf.hidden),
                    "commands_shown": cmds_shown,
                    "skills_shown": skills_shown,
                }))
            else:
                if not active:
                    print("no profile active — full surface (everything shown).")
                else:
                    print(f"active packs: {', '.join(active)}")
                    print(f"surfaced: {cmds_shown} commands, {skills_shown} skills "
                          f"({len(surf.hidden)} hidden behind inactive packs)")
            return 0

        if args.cmd == "surface":
            surf = compute_surface(root, category=args.category)
            if args.json:
                print(json.dumps({
                    "active_packs": surf.active_packs,
                    "shown": surf.shown,
                    "hidden": surf.hidden,
                }))
            else:
                print(f"active: {', '.join(surf.active_packs) or '(none)'}")
                print(f"shown ({len(surf.shown)}):")
                for a in surf.shown:
                    print(f"  + {a['category']}/{a['name']}")
                print(f"hidden ({len(surf.hidden)}):")
                for a in surf.hidden:
                    print(f"  - {a['category']}/{a['name']} [{','.join(a['packs'])}]")
            return 0

        if args.cmd == "stale-notice":
            notice = stale_notice(root)
            if notice:
                print(notice)
            return 0
    except SessionProfileError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
