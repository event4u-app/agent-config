#!/usr/bin/env python3
"""Release-time discovery scanner — produces discovery-manifest.json.

Walks the trusted-root tree (`.agent-src.uncompressed/`), extracts the
five Phase-4 frontmatter keys (`workspaces`, `packs`, `lifecycle`,
`trust`, `install`), validates each value against the closed vocabulary
in `config/discovery/*.yml`, and emits a deterministic JSON manifest
plus a human-readable Markdown summary.

CLI: see `--help`. Stdlib + pyyaml only at runtime.
Schema: docs/contracts/discovery-manifest.schema.json
Roadmap: agents/roadmaps/automated-pack-workspace-and-skill-discovery.md §2
"""
from __future__ import annotations

import argparse
import datetime as _dt
import hashlib
import json
import sys
from pathlib import Path
from typing import Any, Iterable

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate_frontmatter import parse_frontmatter  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / ".agent-src.uncompressed"
VOCAB_DIR = ROOT / "config" / "discovery"
DEFAULT_OUT = ROOT / "dist" / "discovery" / "discovery-manifest.json"
DEFAULT_SUMMARY = ROOT / "dist" / "discovery" / "discovery-manifest.summary.md"
TRUST_ROOTS = (".agent-src.uncompressed", ".augment", ".claude", ".agent-src")

_FM_KEYS = ("workspaces", "packs", "lifecycle", "trust", "install")
_TRUST_REQ = ("level", "confidence", "human_review_required")
_INSTALL_REQ = ("default", "removable")


def _load_yaml(path: Path) -> Any:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def _vocab() -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, str]]:
    workspaces = _load_yaml(VOCAB_DIR / "workspaces.yml") or []
    packs = _load_yaml(VOCAB_DIR / "packs.yml") or []
    raw_un = _load_yaml(VOCAB_DIR / "unassigned-artefacts.yml") or []
    overrides = {e["path"]: e["reason"] for e in raw_un} if raw_un else {}
    return workspaces, packs, overrides


def _scanner_version() -> str:
    h = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    return h[:12]


def _iter_artefacts() -> Iterable[tuple[Path, str]]:
    """Deterministic order: skills → rules → commands → templates."""
    for p in sorted((SRC / "skills").rglob("SKILL.md")):
        yield p, "skill"
    for p in sorted((SRC / "rules").rglob("*.md")):
        yield p, "rule"
    for p in sorted((SRC / "commands").rglob("*.md")):
        yield p, "command"
    if (SRC / "templates").exists():
        for p in sorted((SRC / "templates").rglob("*.md")):
            yield p, "template"


def _trusted(path: Path) -> bool:
    rel = path.relative_to(ROOT).as_posix()
    return any(rel.startswith(r + "/") for r in TRUST_ROOTS)


def _parse(path: Path) -> dict[str, Any] | None:
    text = path.read_text(encoding="utf-8", errors="replace")
    fm, _ = parse_frontmatter(text)
    if not isinstance(fm, dict):
        return None
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
    if lc not in ("active", "deprecated", "experimental", "archived"):
        return None, f"lifecycle: invalid value '{lc}'"

    trust = fm["trust"]
    if not isinstance(trust, dict) or any(k not in trust for k in _TRUST_REQ):
        return None, f"trust: missing required key(s) {_TRUST_REQ}"
    if trust["level"] not in ("core", "professional", "experimental", "advisory", "restricted"):
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

    return {
        "workspaces": list(ws),
        "packs": list(pk),
        "lifecycle": lc,
        "trust": {
            "level": trust["level"],
            "confidence": trust["confidence"],
            "human_review_required": trust["human_review_required"],
        },
        "install": {"default": install["default"], "removable": install["removable"]},
    }, None



def _build(strict: bool) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    workspaces, packs, overrides = _vocab()
    ws_ids = {w["id"] for w in workspaces}
    pack_ids = {p["id"] for p in packs}

    artefacts: list[dict[str, Any]] = []
    unassigned: list[dict[str, Any]] = []
    pack_counts: dict[str, int] = {pid: 0 for pid in pack_ids}

    for path, category in _iter_artefacts():
        rel = path.relative_to(ROOT).as_posix()
        if not _trusted(path):
            unassigned.append({"path": rel, "category": category, "reason": "outside trusted-root allow-list"})
            continue
        if rel in overrides:
            unassigned.append({"path": rel, "category": category, "reason": overrides[rel]})
            continue
        fm = _parse(path)
        payload, reason = _classify(fm, ws_ids, pack_ids)
        if reason is not None:
            unassigned.append({"path": rel, "category": category, "reason": reason})
            continue
        name = (fm or {}).get("name") if isinstance(fm, dict) else None
        entry = {"path": rel, "category": category}
        if isinstance(name, str) and name:
            entry["name"] = name
        entry.update(payload or {})
        artefacts.append(entry)
        for pid in payload["packs"] if payload else []:
            pack_counts[pid] = pack_counts.get(pid, 0) + 1

    artefacts.sort(key=lambda e: e["path"])
    unassigned.sort(key=lambda e: e["path"])

    ws_out = [
        {
            "id": w["id"],
            "label": w["label"],
            "description": w["description"],
            "default_packs": list(w.get("default_packs") or []),
            **({"optional_packs": list(w["optional_packs"])} if w.get("optional_packs") else {}),
        }
        for w in workspaces
    ]
    pk_out = []
    for p in packs:
        item = {
            "id": p["id"],
            "label": p["label"],
            "description": p["description"],
            "workspaces": list(p.get("workspaces") or []),
            "trust_level_default": p["trust_level_default"],
            "artefact_count": pack_counts.get(p["id"], 0),
        }
        if p.get("requires_hint"):
            item["requires_hint"] = list(p["requires_hint"])
        pk_out.append(item)

    if strict and unassigned:
        raise SystemExit(
            f"strict mode: {len(unassigned)} unassigned artefact(s); "
            f"first: {unassigned[0]['path']} — {unassigned[0]['reason']}"
        )

    manifest = {
        "version": 1,
        "generated_at": _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "scanner_version": _scanner_version(),
        "checksum": "sha256:" + "0" * 64,
        "workspaces": ws_out,
        "packs": pk_out,
        "artefacts": artefacts,
        "unassigned": unassigned,
    }
    return manifest, unassigned


def _serialize(manifest: dict[str, Any]) -> str:
    """Deterministic JSON: sorted keys, 2-space indent, trailing newline."""
    return json.dumps(manifest, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def _finalise_checksum(manifest: dict[str, Any]) -> None:
    manifest["checksum"] = "sha256:" + "0" * 64
    raw = _serialize(manifest).encode("utf-8")
    digest = hashlib.sha256(raw).hexdigest()
    manifest["checksum"] = f"sha256:{digest}"


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
    import os

    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--summary", type=Path, default=DEFAULT_SUMMARY)
    parser.add_argument("--strict", action="store_true")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args(argv)

    strict = args.strict or os.environ.get("CI") == "true"
    manifest, unassigned = _build(strict=strict)
    _finalise_checksum(manifest)
    body = _serialize(manifest)

    if args.write:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(body, encoding="utf-8")
        args.summary.write_text(_summary(manifest), encoding="utf-8")
        if not args.quiet:
            print(
                f"wrote {args.out.relative_to(ROOT)} "
                f"({len(manifest['artefacts'])} artefacts, {len(unassigned)} unassigned)"
            )
    else:
        sys.stdout.write(body)
    return 0


if __name__ == "__main__":
    sys.exit(main())
