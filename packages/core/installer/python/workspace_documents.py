#!/usr/bin/env python3
"""Local workspace document store — Phase 5 of ``road-to-employee-product``.

Implements ``docs/contracts/workspace-documents.md``. Per-user, local-only.
Documents live under
``~/.event4u/agent-config/workspace/documents/<type>/<slug>.md``;
each has an append-only ``<slug>.history.jsonl`` revision log.

CLI::

    workspace_documents.py create --type <t> --title <s> --body-file <p>
                                  [--role <r>] [--session <id>] [--prompt <p>]
    workspace_documents.py save <type> <slug> --body-file <p> [--actor user|host]
    workspace_documents.py list [--type <t>] [--role <r>] [--limit 20]
    workspace_documents.py read <type> <slug>
    workspace_documents.py export <type> <slug> --to <dir> --format md|pdf|docx
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

WORKSPACE_HOME = Path.home() / ".event4u" / "agent-config" / "workspace" / "documents"
SCHEMA = "workspace-document/v0"
ALLOWED_TYPES = frozenset({"offer", "mail-draft", "memo", "brief", "video-script"})
SLUG_RE = re.compile(r"[^a-z0-9]+")


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _today_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def slugify(title: str) -> str:
    base = SLUG_RE.sub("-", title.lower()).strip("-")
    return base[:60] or "document"


def _dedupe(target: Path, slug: str, ext: str) -> str:
    cand = slug
    n = 2
    while (target / f"{cand}{ext}").exists():
        cand = f"{slug}-{n}"
        n += 1
    return cand


def _body_sha(body: str) -> str:
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


def _build_frontmatter(meta: dict) -> str:
    keys = ["type", "title", "created_at", "last_edited_at", "source_prompt",
            "source_session", "role", "tags", "schema", "quarantine"]
    lines = ["---"]
    for k in keys:
        if k not in meta or meta[k] in (None, "", []):
            continue
        v = meta[k]
        if isinstance(v, list):
            lines.append(f"{k}: [{', '.join(v)}]")
        elif isinstance(v, bool):
            lines.append(f"{k}: {'true' if v else 'false'}")
        else:
            lines.append(f"{k}: {v}")
    lines.append("---")
    return "\n".join(lines) + "\n\n"


@dataclass
class Document:
    type: str
    slug: str
    title: str
    body: str
    path: Path
    history_path: Path


def create(*, type: str, title: str, body: str, role: str | None = None,
           source_prompt: str | None = None, source_session: str | None = None,
           tags: list[str] | None = None, quarantine: bool = False,
           root: Path | None = None) -> Document:
    if type not in ALLOWED_TYPES:
        raise ValueError(f"unknown document type: {type!r}")
    base = (root if root is not None else WORKSPACE_HOME) / type
    base.mkdir(parents=True, exist_ok=True)
    slug = _dedupe(base, f"{slugify(title)}-{_today_iso()}", ".md")
    now = _now_iso()
    meta = {"type": type, "title": title, "created_at": now,
            "last_edited_at": now, "source_prompt": source_prompt,
            "source_session": source_session, "role": role,
            "tags": tags or [], "schema": SCHEMA,
            "quarantine": quarantine if quarantine else None}
    body_text = _build_frontmatter(meta) + body
    p = base / f"{slug}.md"
    p.write_text(body_text, encoding="utf-8")
    hp = base / f"{slug}.history.jsonl"
    entry = {"ts": now, "actor": "host", "kind": "save",
             "delta": {"added": len(body.splitlines()), "removed": 0},
             "body_sha256": _body_sha(body)}
    hp.write_text(json.dumps(entry, sort_keys=True) + "\n", encoding="utf-8")
    return Document(type=type, slug=slug, title=title, body=body, path=p, history_path=hp)


def save(type: str, slug: str, body: str, *, actor: str = "user",
         root: Path | None = None) -> dict:
    base = (root if root is not None else WORKSPACE_HOME) / type
    p = base / f"{slug}.md"
    if not p.exists():
        raise FileNotFoundError(f"no such document: {type}/{slug}")
    raw = p.read_text(encoding="utf-8")
    end = raw.find("\n---", 4)
    head, old_body = (raw[: end + 4], raw[end + 4 :].lstrip("\n")) if end != -1 else ("", raw)
    now = _now_iso()
    head = re.sub(r"last_edited_at: .*", f"last_edited_at: {now}", head)
    p.write_text(head + "\n" + body if head else body, encoding="utf-8")
    old_lines = old_body.splitlines()
    new_lines = body.splitlines()
    entry = {"ts": now, "actor": actor, "kind": "save",
             "delta": {"added": max(0, len(new_lines) - len(old_lines)),
                       "removed": max(0, len(old_lines) - len(new_lines))},
             "body_sha256": _body_sha(body)}
    hp = base / f"{slug}.history.jsonl"
    with hp.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, sort_keys=True) + "\n")
    return entry


def read(type: str, slug: str, *, root: Path | None = None) -> Document | None:
    base = (root if root is not None else WORKSPACE_HOME) / type
    p = base / f"{slug}.md"
    if not p.exists():
        return None
    raw = p.read_text(encoding="utf-8")
    end = raw.find("\n---", 4)
    body = raw[end + 4 :].lstrip("\n") if end != -1 else raw
    title = ""
    if raw.startswith("---") and end != -1:
        for line in raw[3:end].splitlines():
            if line.startswith("title:"):
                title = line.split(":", 1)[1].strip().strip("'\"")
                break
    hp = base / f"{slug}.history.jsonl"
    return Document(type=type, slug=slug, title=title, body=body, path=p, history_path=hp)


def list_documents(*, type: str | None = None, role: str | None = None,
                   limit: int = 20, root: Path | None = None) -> list[dict]:
    base = root if root is not None else WORKSPACE_HOME
    if not base.exists():
        return []
    types = [type] if type else [p.name for p in base.iterdir() if p.is_dir()]
    docs: list[tuple[float, dict]] = []
    for t in types:
        tdir = base / t
        if not tdir.exists():
            continue
        for p in tdir.glob("*.md"):
            slug = p.stem
            meta = _read_frontmatter(p)
            if role and meta.get("role") != role:
                continue
            docs.append((p.stat().st_mtime, {
                "type": t, "slug": slug, "title": meta.get("title", slug),
                "role": meta.get("role"), "last_edited_at": meta.get("last_edited_at"),
                "path": str(p),
            }))
    docs.sort(key=lambda r: r[0], reverse=True)
    return [d for _, d in docs[:limit]]


def _read_frontmatter(p: Path) -> dict:
    raw = p.read_text(encoding="utf-8")
    if not raw.startswith("---"):
        return {}
    end = raw.find("\n---", 4)
    if end == -1:
        return {}
    out: dict = {}
    for line in raw[3:end].splitlines():
        if not line.strip() or ":" not in line:
            continue
        k, _, v = line.partition(":")
        out[k.strip()] = v.strip().strip("'\"")
    return out


def export(type: str, slug: str, dest_dir: Path, *, format: str = "md",
           root: Path | None = None) -> Path:
    doc = read(type, slug, root=root)
    if doc is None:
        raise FileNotFoundError(f"no such document: {type}/{slug}")
    dest_dir.mkdir(parents=True, exist_ok=True)
    target = dest_dir / f"{slug}.{format}"
    if format == "md":
        shutil.copy2(doc.path, target)
        return target
    if format in ("pdf", "docx"):
        pandoc = shutil.which("pandoc")
        if not pandoc:
            raise RuntimeError("pandoc not on PATH — install it for pdf/docx export")
        subprocess.run([pandoc, str(doc.path), "-o", str(target)], check=True)
        return target
    raise ValueError(f"unsupported format: {format!r}")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="workspace_documents")
    sub = p.add_subparsers(dest="cmd", required=True)
    s_create = sub.add_parser("create")
    s_create.add_argument("--type", required=True)
    s_create.add_argument("--title", required=True)
    s_create.add_argument("--body-file", required=True)
    s_create.add_argument("--role")
    s_create.add_argument("--session")
    s_create.add_argument("--prompt")
    s_save = sub.add_parser("save")
    s_save.add_argument("type")
    s_save.add_argument("slug")
    s_save.add_argument("--body-file", required=True)
    s_save.add_argument("--actor", default="user")
    s_list = sub.add_parser("list")
    s_list.add_argument("--type")
    s_list.add_argument("--role")
    s_list.add_argument("--limit", type=int, default=20)
    s_read = sub.add_parser("read")
    s_read.add_argument("type")
    s_read.add_argument("slug")
    s_exp = sub.add_parser("export")
    s_exp.add_argument("type")
    s_exp.add_argument("slug")
    s_exp.add_argument("--to", required=True)
    s_exp.add_argument("--format", default="md")
    args = p.parse_args(argv)
    if args.cmd == "create":
        body = Path(args.body_file).read_text(encoding="utf-8")
        doc = create(type=args.type, title=args.title, body=body,
                     role=args.role, source_prompt=args.prompt,
                     source_session=args.session)
        print(json.dumps({"slug": doc.slug, "path": str(doc.path)}, sort_keys=True))
        return 0
    if args.cmd == "save":
        body = Path(args.body_file).read_text(encoding="utf-8")
        entry = save(args.type, args.slug, body, actor=args.actor)
        print(json.dumps(entry, sort_keys=True))
        return 0
    if args.cmd == "list":
        for row in list_documents(type=args.type, role=args.role, limit=args.limit):
            print(json.dumps(row, sort_keys=True))
        return 0
    if args.cmd == "read":
        doc = read(args.type, args.slug)
        if doc is None:
            print(f"no such document: {args.type}/{args.slug}", file=sys.stderr)
            return 1
        print(doc.body)
        return 0
    if args.cmd == "export":
        target = export(args.type, args.slug, Path(args.to), format=args.format)
        print(str(target))
        return 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
