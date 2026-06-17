#!/usr/bin/env python3
"""Release-time discovery scanner — produces discovery-manifest.json.

Walks the trusted-root tree (`.agent-src.uncondensed/`), extracts the
five Phase-4 frontmatter keys (`workspaces`, `packs`, `lifecycle`,
`trust`, `install`), validates each value against the closed vocabulary
in `src/config/discovery/*.yml`, and emits a deterministic JSON manifest
plus a human-readable Markdown summary.

CLI: see `--help`. Stdlib + pyyaml only at runtime.
Schema: docs/contracts/discovery-manifest.schema.json
Roadmap: agents/roadmaps/archive/automated-pack-workspace-and-skill-discovery.md §2 (archived, status: completed)
"""
from __future__ import annotations

import argparse
import datetime as _dt
import hashlib
import json
import os
import sys
from pathlib import Path
from typing import Any, Iterable

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate_frontmatter import (  # noqa: E402
    _FRONTMATTER_RE,
    apply_schema_defaults,
    load_schema,
    parse_frontmatter,
)
from _lib.agent_src import artefact_roots, command_slug, logical_relpath, resolve_logical, strip_source_prefix  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / ".agent-src.uncondensed"
VOCAB_DIR = ROOT / "src" / "config" / "discovery"
DEFAULT_OUT = ROOT / "dist" / "discovery" / "discovery-manifest.json"
DEFAULT_SUMMARY = ROOT / "dist" / "discovery" / "discovery-manifest.summary.md"
DEFAULT_DEPRECATION_REPORT = ROOT / "dist" / "discovery" / "deprecation-report.md"
DEFAULT_TRUST_REPORT = ROOT / "dist" / "discovery" / "trust-report.md"
DEFAULT_ORPHAN_REPORT = ROOT / "dist" / "discovery" / "orphan-report.md"
DEFAULT_WORKSPACES_JSON = ROOT / "dist" / "discovery" / "workspaces.json"
DEFAULT_PACKS_JSON = ROOT / "dist" / "discovery" / "packs.json"
# ``src`` is the 6.0.0-D flat-library container (src/skills, src/rules, and
# later src/domains commands). Iteration is category-scoped, so only the
# artefact subtrees under src/ ever reach the trust gate.
TRUST_ROOTS = (".agent-src.uncondensed", ".augment", ".claude", "dist/agent-src", "packages", "src")

_FM_KEYS = ("workspaces", "packs", "lifecycle", "trust", "install")
_TRUST_REQ = ("level", "confidence", "human_review_required")
_INSTALL_REQ = ("default", "removable")
_LIFECYCLE_VALUES = ("active", "experimental", "deprecated", "archived")
_TRUST_VALUES = ("core", "professional", "experimental", "advisory", "restricted")
_CATEGORY_VALUES = ("skill", "rule", "command", "template")


def _load_yaml(path: Path) -> Any:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def _vocab() -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, str]]:
    """Load discovery vocab. ``overrides`` keys are normalised to the
    *current* physical repo-relative path, regardless of whether the YAML
    lists the legacy ``.agent-src.uncondensed/...`` prefix or a
    ``packages/*/.agent-src.uncondensed/...`` prefix. The lookup site
    (``_build``) compares against physical paths emitted by
    ``_iter_artefacts``.
    """
    workspaces = _load_yaml(VOCAB_DIR / "workspaces.yml") or []
    packs = _load_yaml(VOCAB_DIR / "packs.yml") or []
    raw_un = _load_yaml(VOCAB_DIR / "unassigned-artefacts.yml") or []
    overrides: dict[str, str] = {}
    for entry in raw_un or []:
        raw_path = entry["path"]
        reason = entry["reason"]
        logical = strip_source_prefix(raw_path)
        if logical is None:
            # Path isn't under any source root — keep as-is (e.g. docs/).
            overrides[raw_path] = reason
            continue
        # Map logical → current physical, so the lookup matches whatever
        # root the file actually lives in post-move.
        physical = resolve_logical(logical)
        if physical is not None:
            overrides[physical.relative_to(ROOT).as_posix()] = reason
        else:
            # Not yet present — keep both the raw and the logical key so
            # the manifest stays stable when the file later lands.
            overrides[raw_path] = reason
    return workspaces, packs, overrides


def _scanner_version() -> str:
    h = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    return h[:12]


def _artefact_checksum(path: Path, fm: dict[str, Any] | None) -> str:
    """sha256 over normalized artefact content (ADR-015).

    Normalization: frontmatter re-serialized as compact JSON with sorted
    keys, body stripped of trailing whitespace per line + single trailing
    newline. Drops cosmetic-only diffs (key reorder, blank-line trim)
    so the installer's drift check survives reformatting.
    """
    text = path.read_text(encoding="utf-8", errors="replace")
    match = _FRONTMATTER_RE.search(text)
    if fm is None or match is None:
        body = "\n".join(line.rstrip() for line in text.splitlines()).rstrip() + "\n"
        raw = body.encode("utf-8")
    else:
        fm_json = json.dumps(fm, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
        body_text = text[match.end():]
        body = "\n".join(line.rstrip() for line in body_text.splitlines()).rstrip() + "\n"
        raw = (fm_json + "\n" + body).encode("utf-8")
    return "sha256:" + hashlib.sha256(raw).hexdigest()


def _iter_artefacts() -> Iterable[tuple[Path, str]]:
    """Deterministic order: skills → rules → commands → templates.

    Walks every source root (legacy ``.agent-src.uncondensed/`` plus any
    ``packages/*/.agent-src.uncondensed/``) so the manifest survives the
    physical move (ADR-017). Within each category, paths are sorted by
    their *logical* identity to keep ordering stable across moves.
    """
    def _collect(subdir: str, pattern: str) -> list[Path]:
        seen: dict[str, Path] = {}
        for root in artefact_roots():
            base = root / subdir
            if not base.exists():
                continue
            for p in base.rglob(pattern):
                if not p.is_file():
                    continue
                rel = p.relative_to(root).as_posix()
                seen.setdefault(rel, p)
        return [seen[k] for k in sorted(seen)]

    for p in _collect("skills", "SKILL.md"):
        yield p, "skill"
    for p in _collect("rules", "*.md"):
        yield p, "rule"
    # Commands: the legacy / packages command trees via the patchable
    # artefact_roots seam, PLUS the 6.0.0-D src/domains/<pack>/<subpath>/
    # command.md homes scanned relative to the (patchable) module ROOT — the
    # category-append _collect cannot see src/domains, and going through
    # agent_src's real-repo helpers would escape test fixtures that patch ROOT.
    for p in _collect("commands", "*.md"):
        yield p, "command"
    domains_root = ROOT / "src" / "domains"
    if domains_root.is_dir():
        for p in sorted(domains_root.rglob("command.md")):
            if p.is_file():
                yield p, "command"
    # 6.0.0-D Step 16b moved the install-scaffold templates to src/templates/
    # (wrapper, consumer-settings, minimal stub, *.j2 rules). `src` is an
    # artefact root for the new src/{skills,rules,domains} homes, so
    # _collect("templates") now also sees src/templates — but those are
    # install scaffold shipped via package.json files[], NOT discovery
    # "template" content (which lives under .agent-src.uncondensed/templates).
    # Skip them so strict mode does not demand artefact frontmatter on them.
    _scaffold = (ROOT / "src" / "templates").resolve()
    for p in _collect("templates", "*.md"):
        rp = p.resolve()
        if rp == _scaffold or _scaffold in rp.parents:
            continue
        yield p, "template"


def _trusted(path: Path) -> bool:
    rel = path.relative_to(ROOT).as_posix()
    return any(rel.startswith(r + "/") for r in TRUST_ROOTS)


# Discovery category → frontmatter schema name. `template` has no schema and
# carries none of the defaulted fields, so it is left raw.
_CATEGORY_SCHEMA = {"skill": "skill", "rule": "rule", "command": "command"}


def _parse(path: Path, category: str | None = None) -> dict[str, Any] | None:
    text = path.read_text(encoding="utf-8", errors="replace")
    fm, _ = parse_frontmatter(text)
    if not isinstance(fm, dict):
        return None
    # Inject schema defaults so an artefact that omits a field equal to its
    # default (post abstraction-reduction migration) still presents the field
    # to the required-key checks AND the drift checksum — keeping the checksum
    # byte-stable across the migration (preflight Decision B).
    schema_name = _CATEGORY_SCHEMA.get(category or "")
    if schema_name is not None:
        apply_schema_defaults(fm, load_schema(schema_name))
    return fm


def _classify(
    fm: dict[str, Any] | None,
    ws_ids: set[str],
    pack_ids: set[str],
) -> tuple[dict[str, Any] | None, str | None]:
    """Return (artefact_payload, unassigned_reason). Exactly one is None."""
    if fm is None:
        return None, "missing or unparseable frontmatter"
    missing = [k for k in _FM_KEYS if k not in fm]
    if missing:
        return None, f"missing required key(s): {', '.join(missing)}"

    ws = fm["workspaces"]
    if not isinstance(ws, list) or not ws:
        return None, "workspaces: must be a non-empty list"
    bad = [w for w in ws if w not in ws_ids]
    if bad:
        return None, f"unknown workspace(s): {', '.join(bad)} (not in vocabulary)"

    pk = fm["packs"]
    if not isinstance(pk, list) or not pk:
        return None, "packs: must be a non-empty list"
    bad = [p for p in pk if p not in pack_ids]
    if bad:
        return None, f"unknown pack(s): {', '.join(bad)} (not in vocabulary)"

    lc = fm["lifecycle"]
    if lc not in _LIFECYCLE_VALUES:
        return None, f"lifecycle: invalid value '{lc}'"

    trust = fm["trust"]
    if not isinstance(trust, dict) or any(k not in trust for k in _TRUST_REQ):
        return None, f"trust: missing required key(s) {_TRUST_REQ}"
    if trust["level"] not in _TRUST_VALUES:
        return None, f"trust.level: invalid '{trust['level']}'"
    if trust["confidence"] not in ("high", "medium", "low"):
        return None, f"trust.confidence: invalid '{trust['confidence']}'"
    if not isinstance(trust["human_review_required"], bool):
        return None, "trust.human_review_required: must be boolean"

    install = fm["install"]
    if not isinstance(install, dict) or any(k not in install for k in _INSTALL_REQ):
        return None, f"install: missing required key(s) {_INSTALL_REQ}"
    if not isinstance(install["default"], bool) or not isinstance(install["removable"], bool):
        return None, "install.default and install.removable must be boolean"

    # Optional `requires` — ADR-015 dependency edges. Closed vocabulary.
    requires_raw = fm.get("requires")
    requires: list[str] = []
    if requires_raw is not None:
        if not isinstance(requires_raw, list):
            return None, "requires: must be a list of pack ids"
        bad = [r for r in requires_raw if r not in pack_ids]
        if bad:
            return None, f"requires: unknown pack(s) {', '.join(bad)}"
        requires = list(requires_raw)

    # Optional `pack` — capability-packs.md canonical owner. Single id, closed
    # vocabulary. Orthogonal to `packs` (owner need not be among discovery tags).
    owner = fm.get("pack")
    if owner is not None and (not isinstance(owner, str) or owner not in pack_ids):
        return None, f"pack: unknown owner '{owner}'"

    payload: dict[str, Any] = {
        "workspaces": list(ws),
        "packs": list(pk),
        "lifecycle": lc,
        "trust": {
            "level": trust["level"],
            "confidence": trust["confidence"],
            "human_review_required": trust["human_review_required"],
        },
        "install": {"default": install["default"], "removable": install["removable"]},
    }
    if requires:
        payload["requires"] = requires
    if isinstance(owner, str) and owner:
        payload["pack"] = owner
    return payload, None



def _build(strict: bool) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    workspaces, packs, overrides = _vocab()
    ws_ids = {w["id"] for w in workspaces}
    pack_ids = {p["id"] for p in packs}

    artefacts: list[dict[str, Any]] = []
    unassigned: list[dict[str, Any]] = []
    pack_counts: dict[str, int] = {pid: 0 for pid in pack_ids}
    # Phase 5.1 (ADR-018): per-pack trust mix + HRR count for installer.
    pack_trust_counts: dict[str, dict[str, int]] = {
        pid: {lvl: 0 for lvl in _TRUST_VALUES} for pid in pack_ids
    }
    pack_hrr_counts: dict[str, int] = {pid: 0 for pid in pack_ids}

    documented_unassigned: list[dict[str, Any]] = []

    for path, category in _iter_artefacts():
        rel = path.relative_to(ROOT).as_posix()
        if not _trusted(path):
            unassigned.append({"path": rel, "category": category, "reason": "outside trusted-root allow-list"})
            continue
        if rel in overrides:
            documented_unassigned.append({"path": rel, "category": category, "reason": overrides[rel]})
            continue
        fm = _parse(path, category)
        payload, reason = _classify(fm, ws_ids, pack_ids)
        if reason is not None:
            unassigned.append({"path": rel, "category": category, "reason": reason})
            continue
        name = (fm or {}).get("name") if isinstance(fm, dict) else None
        entry = {"path": rel, "category": category}
        if isinstance(name, str) and name:
            entry["name"] = name
        entry.update(payload or {})
        # 6.0.0-C: surface command routing metadata so the CLI discovery
        # surface (`agent-config commands` / `explain`) reads the manifest
        # rather than a parallel catalog. Does not affect the per-file
        # checksum (computed over frontmatter, below).
        if category == "command" and isinstance(fm, dict):
            if fm.get("tier") is not None:
                entry["tier"] = fm["tier"]
            # ADR-092: `visibility:` is the named source of truth; the integer
            # `tier:` is a back-compat alias. Dual-emit BOTH into the manifest
            # (a published data contract) during the deprecation window so
            # external consumers reading the integer key keep working. The
            # top-level `deprecations` block (ADR-092 / road-to-tier-removal)
            # announces the `tier` deprecation; removal is Phase 4. Prefer the
            # explicit field; derive from tier when absent.
            _vis = fm.get("visibility")
            if _vis is None and fm.get("tier") is not None:
                _vis = {0: "visible", 1: "advanced", 2: "internal"}.get(fm["tier"])
            if _vis is not None:
                entry["visibility"] = _vis
            for _k in ("intent", "routes_to", "replaces"):
                if fm.get(_k) is not None:
                    entry[_k] = fm[_k]
            # Canonical path-derived slug (ADR-044): the invocation name the
            # `.claude`/`.cursor` projection and `commands ls --profile` use.
            # Distinct from frontmatter `name:` (display, may still be colon
            # for commands whose rename deferred to 6.1). Single source of
            # truth = command_slug (path-stripped + slug_prefix).
            _slug = command_slug(path)
            if _slug:
                entry["slug"] = _slug
        entry["checksum"] = _artefact_checksum(path, fm)
        artefacts.append(entry)
        trust_level = (payload.get("trust") or {}).get("level") if payload else None
        hrr = bool((payload.get("trust") or {}).get("human_review_required")) if payload else False
        for pid in payload["packs"] if payload else []:
            pack_counts[pid] = pack_counts.get(pid, 0) + 1
            if trust_level in pack_trust_counts.get(pid, {}):
                pack_trust_counts[pid][trust_level] += 1
            if hrr:
                pack_hrr_counts[pid] = pack_hrr_counts.get(pid, 0) + 1

    artefacts.sort(key=lambda e: e["path"])
    unassigned.sort(key=lambda e: e["path"])
    documented_unassigned.sort(key=lambda e: e["path"])

    ws_out = [
        {
            "id": w["id"],
            "label": w["label"],
            "description": w["description"],
            "default_packs": list(w.get("default_packs") or []),
            **({"optional_packs": list(w["optional_packs"])} if w.get("optional_packs") else {}),
            **({"example_roles": list(w["example_roles"])} if w.get("example_roles") else {}),
        }
        for w in workspaces
    ]
    pk_out = []
    for p in packs:
        pid = p["id"]
        item = {
            "id": pid,
            "label": p["label"],
            "description": p["description"],
            "workspaces": list(p.get("workspaces") or []),
            "trust_level_default": p["trust_level_default"],
            "artefact_count": pack_counts.get(pid, 0),
            "trust_summary": dict(pack_trust_counts.get(pid, {lvl: 0 for lvl in _TRUST_VALUES})),
            "human_review_required": pack_hrr_counts.get(pid, 0),
        }
        # `requires` (capability-packs.md) supersedes the legacy `requires_hint`
        # name. Read either; emit both during the deprecation window so TS
        # consumers keyed on `requires_hint` keep working untouched.
        requires = list(p.get("requires") or p.get("requires_hint") or [])
        if requires:
            item["requires"] = requires
            item["requires_hint"] = requires
        if p.get("suggests"):
            item["suggests"] = list(p["suggests"])
        if p.get("domain"):
            item["domain"] = p["domain"]
        if p.get("size_class"):
            item["size_class"] = p["size_class"]
        if p.get("always_on"):
            item["always_on"] = True
        if p.get("cluster"):
            item["cluster"] = p["cluster"]
        pk_out.append(item)

    if strict and unassigned:
        raise SystemExit(
            f"strict mode: {len(unassigned)} unassigned artefact(s); "
            f"first: {unassigned[0]['path']} — {unassigned[0]['reason']}"
        )

    stats = _compute_stats(artefacts, unassigned, documented_unassigned)

    manifest = {
        "version": 2,
        # Machine-readable deprecation signal (road-to-tier-removal Phase 1,
        # ADR-092). The integer command `tier` (0/1/2) is a back-compat alias
        # for the named `visibility` field (ADR-090). It is STILL emitted into
        # command entries above (non-breaking) — this block only ANNOUNCES the
        # deprecation so external manifest consumers can migrate to `visibility`
        # during the soak window. Removal of `tier` is Phase 4 of
        # road-to-tier-removal (cheaply reversible per ADR-092); `sunset` is
        # maintainer-owned and stays null until the soak clears.
        "deprecations": [
            {
                "key": "tier",
                "scope": "command",
                "replacement": "visibility",
                "since": "ADR-092",
                "sunset": None,
                "note": (
                    "Integer command `tier` (0/1/2) is a deprecated back-compat "
                    "alias for the named `visibility` field (ADR-090). Read "
                    "`visibility`; `tier` is still emitted (non-breaking) but "
                    "scheduled for removal — see road-to-tier-removal."
                ),
            }
        ],
        "generated_at": _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "scanner_version": _scanner_version(),
        "checksum": "sha256:" + "0" * 64,
        "workspaces": ws_out,
        "packs": pk_out,
        "artefacts": artefacts,
        "unassigned": unassigned,
        "documented_unassigned": documented_unassigned,
        "stats": stats,
    }
    return manifest, unassigned


def _compute_stats(
    artefacts: list[dict[str, Any]],
    unassigned: list[dict[str, Any]],
    documented_unassigned: list[dict[str, Any]],
) -> dict[str, Any]:
    """Aggregate counts derived from the artefact list (ADR-015)."""
    by_category = {k: 0 for k in _CATEGORY_VALUES}
    by_lifecycle = {k: 0 for k in _LIFECYCLE_VALUES}
    by_trust_level = {k: 0 for k in _TRUST_VALUES}
    for a in artefacts:
        cat = a.get("category")
        if cat in by_category:
            by_category[cat] += 1
        lc = a.get("lifecycle")
        if lc in by_lifecycle:
            by_lifecycle[lc] += 1
        lvl = a.get("trust", {}).get("level")
        if lvl in by_trust_level:
            by_trust_level[lvl] += 1
    return {
        "total_artefacts": len(artefacts),
        "by_category": by_category,
        "by_lifecycle": by_lifecycle,
        "by_trust_level": by_trust_level,
        "unassigned_count": len(unassigned),
        "documented_unassigned_count": len(documented_unassigned),
    }


def _serialize(manifest: dict[str, Any]) -> str:
    """Deterministic JSON: sorted keys, 2-space indent, trailing newline."""
    return json.dumps(manifest, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def _finalise_checksum(manifest: dict[str, Any]) -> None:
    # Checksum covers structural content only — `generated_at` is wall-clock
    # and intentionally excluded so the hash stays byte-stable across runs.
    generated_at = manifest.get("generated_at")
    manifest["checksum"] = "sha256:" + "0" * 64
    manifest["generated_at"] = "<normalised>"
    raw = _serialize(manifest).encode("utf-8")
    digest = hashlib.sha256(raw).hexdigest()
    manifest["generated_at"] = generated_at
    manifest["checksum"] = f"sha256:{digest}"


def _deprecation_report(manifest: dict[str, Any]) -> str:
    """List every ``lifecycle: deprecated`` artefact (ADR-015, Phase 4)."""
    items = [a for a in manifest["artefacts"] if a.get("lifecycle") == "deprecated"]
    items.sort(key=lambda a: a["path"])
    lines = ["# Discovery — Deprecation Report", ""]
    lines.append(f"- Generated: `{manifest['generated_at']}`")
    lines.append(f"- Deprecated artefacts: **{len(items)}**")
    lines.append("")
    if not items:
        lines.append("_None. Tree is clean._")
        lines.append("")
        return "\n".join(lines) + "\n"
    lines.append("| Path | Category | Trust |")
    lines.append("|---|---|---|")
    for a in items:
        lines.append(f"| `{a['path']}` | {a['category']} | {a['trust']['level']} |")
    lines.append("")
    return "\n".join(lines) + "\n"


def _trust_report(manifest: dict[str, Any]) -> str:
    """Trust-level breakdown by workspace + human-review sanity flag."""
    by_ws: dict[str, dict[str, int]] = {}
    review_flags: list[dict[str, Any]] = []
    for a in manifest["artefacts"]:
        level = a["trust"]["level"]
        for ws in a["workspaces"]:
            by_ws.setdefault(ws, {k: 0 for k in _TRUST_VALUES})[level] += 1
        if a["trust"].get("human_review_required"):
            review_flags.append(a)
    review_flags.sort(key=lambda a: a["path"])
    lines = ["# Discovery — Trust Report", ""]
    lines.append(f"- Generated: `{manifest['generated_at']}`")
    lines.append(f"- Workspaces tracked: **{len(by_ws)}**")
    lines.append(f"- Human-review-required artefacts: **{len(review_flags)}**")
    lines.append("")
    lines.append("## Trust levels by workspace")
    lines.append("")
    header = "| Workspace | " + " | ".join(_TRUST_VALUES) + " |"
    sep = "|---|" + "|".join(["---"] * len(_TRUST_VALUES)) + "|"
    lines.extend([header, sep])
    for ws in sorted(by_ws):
        counts = by_ws[ws]
        row = f"| `{ws}` | " + " | ".join(str(counts[k]) for k in _TRUST_VALUES) + " |"
        lines.append(row)
    lines.append("")
    if review_flags:
        lines.append("## Human-review-required artefacts")
        lines.append("")
        lines.append("| Path | Workspaces | Trust |")
        lines.append("|---|---|---|")
        for a in review_flags:
            lines.append(
                f"| `{a['path']}` | {', '.join(a['workspaces'])} | {a['trust']['level']} |"
            )
        lines.append("")
    return "\n".join(lines) + "\n"


def _orphan_artefacts(manifest: dict[str, Any]) -> list[dict[str, Any]]:
    """Artefacts whose declared pack has no other members (likely typo).

    ``experimental`` lifecycle is a sanctioned carve-out (ADR-015).
    """
    pack_members: dict[str, list[dict[str, Any]]] = {}
    for a in manifest["artefacts"]:
        for pid in a["packs"]:
            pack_members.setdefault(pid, []).append(a)
    orphans: list[dict[str, Any]] = []
    for a in manifest["artefacts"]:
        if a.get("lifecycle") == "experimental":
            continue
        for pid in a["packs"]:
            if len(pack_members.get(pid, [])) == 1:
                orphans.append({"path": a["path"], "pack": pid, "category": a["category"]})
                break
    orphans.sort(key=lambda o: o["path"])
    return orphans


def _orphan_report(manifest: dict[str, Any]) -> str:
    orphans = _orphan_artefacts(manifest)
    lines = ["# Discovery — Orphan Report", ""]
    lines.append(f"- Generated: `{manifest['generated_at']}`")
    lines.append(f"- Orphan artefacts: **{len(orphans)}**")
    lines.append("")
    lines.append(
        "> An orphan is an artefact whose declared pack has no other members."
    )
    lines.append("> `lifecycle: experimental` is a sanctioned carve-out (ADR-015).")
    lines.append("")
    if not orphans:
        lines.append("_No orphans. Pack assignments look healthy._")
        lines.append("")
        return "\n".join(lines) + "\n"
    lines.append("| Path | Pack | Category |")
    lines.append("|---|---|---|")
    for o in orphans:
        lines.append(f"| `{o['path']}` | `{o['pack']}` | {o['category']} |")
    lines.append("")
    return "\n".join(lines) + "\n"


def _workspaces_view(manifest: dict[str, Any]) -> dict[str, Any]:
    """Flattened workspace sub-view (ADR-015 Phase 5).

    For each workspace: artefact count + per-pack artefact ids. Cheap
    surface for the browser wizard (and any other lightweight consumer)
    so they don't need to walk the full manifest.
    """
    pack_to_artefacts: dict[str, list[str]] = {}
    for a in manifest["artefacts"]:
        for pid in a["packs"]:
            pack_to_artefacts.setdefault(pid, []).append(a["path"])
    for pid in pack_to_artefacts:
        pack_to_artefacts[pid].sort()
    workspaces: list[dict[str, Any]] = []
    for w in manifest["workspaces"]:
        packs_block: list[dict[str, Any]] = []
        for pid in list(w.get("default_packs", [])) + list(w.get("optional_packs", [])):
            ids = pack_to_artefacts.get(pid, [])
            packs_block.append({"id": pid, "artefact_count": len(ids), "artefacts": ids})
        # Artefacts visible in this workspace (union across its packs)
        visible: set[str] = set()
        for entry in packs_block:
            visible.update(entry["artefacts"])
        workspaces.append(
            {
                "id": w["id"],
                "label": w["label"],
                "description": w["description"],
                "default_packs": list(w.get("default_packs", [])),
                "optional_packs": list(w.get("optional_packs", [])),
                "artefact_count": len(visible),
                "packs": packs_block,
            }
        )
    return {
        "generated_at": manifest["generated_at"],
        "scanner_version": manifest["scanner_version"],
        "checksum": manifest["checksum"],
        "workspaces": workspaces,
    }


def _packs_view(manifest: dict[str, Any]) -> dict[str, Any]:
    """Flattened pack sub-view (ADR-015 Phase 5).

    Per-pack: artefact ids, lifecycle counts, trust counts. Lightweight
    payload for a pack-picker UI.
    """
    pack_to_artefacts: dict[str, list[dict[str, Any]]] = {}
    for a in manifest["artefacts"]:
        for pid in a["packs"]:
            pack_to_artefacts.setdefault(pid, []).append(a)
    packs: list[dict[str, Any]] = []
    for p in manifest["packs"]:
        members = pack_to_artefacts.get(p["id"], [])
        lifecycle_counts = {k: 0 for k in _LIFECYCLE_VALUES}
        trust_counts = {k: 0 for k in _TRUST_VALUES}
        ids: list[str] = []
        for a in members:
            ids.append(a["path"])
            lifecycle_counts[a["lifecycle"]] += 1
            trust_counts[a["trust"]["level"]] += 1
        ids.sort()
        packs.append(
            {
                "id": p["id"],
                "label": p["label"],
                "description": p["description"],
                "workspaces": list(p.get("workspaces", [])),
                "requires": list(p.get("requires") or p.get("requires_hint") or []),
                "requires_hint": list(p.get("requires_hint", [])),
                "suggests": list(p.get("suggests", [])),
                "domain": p.get("domain"),
                "size_class": p.get("size_class"),
                "always_on": bool(p.get("always_on")),
                "cluster": p.get("cluster"),
                "trust_level_default": p.get("trust_level_default"),
                "artefact_count": len(ids),
                "artefacts": ids,
                "by_lifecycle": lifecycle_counts,
                "by_trust_level": trust_counts,
            }
        )
    return {
        "generated_at": manifest["generated_at"],
        "scanner_version": manifest["scanner_version"],
        "checksum": manifest["checksum"],
        "packs": packs,
    }


def _summary(manifest: dict[str, Any]) -> str:
    lines = ["# Discovery Manifest — Summary", ""]
    lines.append(f"- Generated: `{manifest['generated_at']}`")
    lines.append(f"- Scanner: `{manifest['scanner_version']}`")
    lines.append(f"- Artefacts: **{len(manifest['artefacts'])}**")
    lines.append(f"- Unassigned: **{len(manifest['unassigned'])}**")
    lines.append("")
    pack_by_id = {p["id"]: p for p in manifest["packs"]}
    for w in manifest["workspaces"]:
        lines.append(f"## `{w['id']}` — {w['label']}")
        lines.append("")
        lines.append(f"> {w['description']}")
        lines.append("")
        lines.append("| Pack | Artefacts |")
        lines.append("|---|---|")
        for pid in list(w.get("default_packs", [])) + list(w.get("optional_packs", [])):
            p = pack_by_id.get(pid)
            if p:
                lines.append(f"| `{pid}` — {p['label']} | {p['artefact_count']} |")
        lines.append("")
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--summary", type=Path, default=DEFAULT_SUMMARY)
    parser.add_argument("--deprecation-report", type=Path, default=DEFAULT_DEPRECATION_REPORT)
    parser.add_argument("--trust-report", type=Path, default=DEFAULT_TRUST_REPORT)
    parser.add_argument("--orphan-report", type=Path, default=DEFAULT_ORPHAN_REPORT)
    parser.add_argument("--workspaces-json", type=Path, default=DEFAULT_WORKSPACES_JSON)
    parser.add_argument("--packs-json", type=Path, default=DEFAULT_PACKS_JSON)
    parser.add_argument("--strict", action="store_true")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args(argv)

    # Phase 4.4 gate: in CI, behave as if --strict were passed. Local
    # invocations stay permissive unless --strict is explicit.
    strict = args.strict or os.environ.get("CI", "").lower() in ("true", "1")
    manifest, unassigned = _build(strict=strict)
    _finalise_checksum(manifest)
    body = _serialize(manifest)

    # ADR-015 Phase 4: orphan gate. Non-experimental artefacts whose declared
    # pack has no other members are a typo signal. Strict (CI) mode fails;
    # local runs only warn.
    orphans = _orphan_artefacts(manifest)
    if orphans and strict:
        print(
            f"error: {len(orphans)} orphan artefact(s) found "
            "(non-experimental, pack has no other members). "
            "See dist/discovery/orphan-report.md.",
            file=sys.stderr,
        )
        for o in orphans[:10]:
            print(f"  - {o['path']} (pack '{o['pack']}')", file=sys.stderr)
        return 1

    if args.write:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(body, encoding="utf-8")
        args.summary.write_text(_summary(manifest), encoding="utf-8")
        args.deprecation_report.write_text(_deprecation_report(manifest), encoding="utf-8")
        args.trust_report.write_text(_trust_report(manifest), encoding="utf-8")
        args.orphan_report.write_text(_orphan_report(manifest), encoding="utf-8")
        # Phase 5 sub-views — flattened workspace/pack JSON for
        # lightweight consumers (browser wizard) so they don't need to
        # walk the full manifest.
        args.workspaces_json.write_text(
            json.dumps(_workspaces_view(manifest), indent=2, sort_keys=True, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        args.packs_json.write_text(
            json.dumps(_packs_view(manifest), indent=2, sort_keys=True, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        # Sidecar SHA-256 of the on-disk manifest bytes for tamper detection
        # by downstream consumers (security-engineer council fold-in, R3 Phase 7).
        sidecar = args.out.with_suffix(args.out.suffix + ".sha256")
        file_digest = hashlib.sha256(body.encode("utf-8")).hexdigest()
        sidecar.write_text(f"{file_digest}  {args.out.name}\n", encoding="utf-8")
        if not args.quiet:
            print(
                f"wrote {args.out.relative_to(ROOT)} "
                f"({len(manifest['artefacts'])} artefacts, {len(unassigned)} unassigned, "
                f"{len(orphans)} orphans)"
            )
    else:
        sys.stdout.write(body)
    return 0


if __name__ == "__main__":
    sys.exit(main())
