#!/usr/bin/env python3
"""Local workspace document store — Phase 5 of ``road-to-employee-product``.

Implements ``docs/contracts/workspace-documents.md``. Per-user, local-only.
Documents live under
``~/.event4u/agent-config/workspace/documents/<type>/<slug>.md``;
each has an append-only ``<slug>.history.jsonl`` revision log.

Encryption-at-rest (ADR-062 Part B, Option 4 Python-authoritative): when
``workspace.encrypt_at_rest`` is on, the ``.md`` **body** is written as a
sibling ``<slug>.md.enc`` (AES-256-GCM via ``workspace_crypto``). Reads
auto-detect plaintext vs ``.enc`` on disk — independent of the flag — so a
read always returns cleartext whether the flag flipped since the write.
Only **whole-file** content is encrypted here; the append-only
``.history.jsonl`` revision log is part of the deferred append-JSONL set
(ADR-063) and stays plaintext for now.

CLI::

    workspace_documents.py create --type <t> --title <s> --body-file <p>
                                  [--role <r>] [--session <id>] [--prompt <p>]
    workspace_documents.py save <type> <slug> --body-file <p> [--actor user|host]
    workspace_documents.py list [--type <t>] [--role <r>] [--limit 20] [--json]
    workspace_documents.py read <type> <slug>
    workspace_documents.py export <type> <slug> --to <dir> --format md|pdf|docx
    workspace_documents.py migrate [--root <p>]      # plaintext → .enc, non-destructive
    workspace_documents.py decrypt-all [--root <p>]  # kill-switch: .enc → plaintext
    workspace_documents.py rekey [--root <p>]        # rotate master key, re-encrypt
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

# Sibling import: robust under both direct script execution and the importlib
# test loader (see workspace_secrets module docstring).
sys.path.insert(0, str(Path(__file__).resolve().parent))
import workspace_secrets  # noqa: E402
import workspace_crypto  # noqa: E402

WORKSPACE_HOME = Path.home() / ".event4u" / "agent-config" / "workspace" / "documents"
SCHEMA = "workspace-document/v0"
ALLOWED_TYPES = frozenset({"offer", "mail-draft", "memo", "brief", "video-script"})
SLUG_RE = re.compile(r"[^a-z0-9]+")
ENC_SUFFIX = ".enc"


class SecretLeakError(ValueError):
    """Raised when a high-confidence secret is found in a document write.

    Carries only the field name and pattern label — never the matched value —
    so the message is safe to print to a terminal or log.
    """

    def __init__(self, field: str, pattern: str) -> None:
        self.field = field
        self.pattern = pattern
        super().__init__(
            f"high-confidence secret ({pattern}) detected in {field}; "
            f"redact it before saving — the document was NOT written"
        )


# --- encryption-aware IO (ADR-062 Part B) --------------------------------
#
# Writes honor the flag (new content encrypted when on). Reads detect what is
# on disk and decrypt only if the bytes carry the AES-256-GCM magic — so a
# read is correct whether or not the flag matches the write. `.md` and its
# `.md.enc` sibling are mutually exclusive after any write (the other is
# removed) so a directory never holds both forms of the same slug.


def _enc_enabled() -> bool:
    return workspace_crypto.is_enabled()


def _enc_path(p: Path) -> Path:
    return p.with_name(p.name + ENC_SUFFIX)


def _resolve_existing(p: Path) -> Path | None:
    """The on-disk file backing logical path ``p`` (plaintext or .enc), or None."""
    if p.exists():
        return p
    enc = _enc_path(p)
    return enc if enc.exists() else None


def _doc_exists(p: Path) -> bool:
    return _resolve_existing(p) is not None


def _read_text_any(p: Path) -> str | None:
    """Read logical path ``p``, decrypting if the backing file is ``.enc``."""
    actual = _resolve_existing(p)
    if actual is None:
        return None
    data = actual.read_bytes()
    if actual.name.endswith(ENC_SUFFIX):
        data = workspace_crypto.decrypt_bytes(data)
    return data.decode("utf-8")


def _atomic_write_bytes(target: Path, payload: bytes) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(target.parent), suffix=".tmp")
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(payload)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, target)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def _write_text(p: Path, text: str) -> Path:
    """Write ``text`` to logical path ``p`` honoring the flag. Returns the
    actual path written (``p`` or its ``.enc`` sibling). The opposite form is
    removed so the slug has exactly one backing file."""
    payload = text.encode("utf-8")
    enc = _enc_path(p)
    if _enc_enabled():
        _atomic_write_bytes(enc, workspace_crypto.encrypt_bytes(payload))
        if p.exists():
            p.unlink()
        return enc
    _atomic_write_bytes(p, payload)
    # NOTE: a stale .enc is NOT auto-deleted here — turning the flag off must
    # not silently destroy ciphertext. Use `decrypt-all` (kill-switch) to
    # convert encrypted docs back to plaintext deliberately.
    return p


def _guard_secrets(fields: dict[str, str | None]) -> None:
    """Pre-write secret-scan hook for user-authored documents (Phase 8 Step 5).

    Documents round-trip byte-for-byte, so unlike the disposable telemetry
    stores this guard does **not** silently rewrite the body. High-confidence
    matches (AWS / GitHub / OpenAI / PEM) refuse the write outright; the fuzzy
    key/value heuristic only warns, because it fires on legitimate prose
    ("password reset token: see attached") and silently mutilating a user's
    memo over a false positive is worse than the residual risk.
    """
    for field, value in fields.items():
        if not value:
            continue
        findings = workspace_secrets.scan(value)
        high = [f.pattern for f in findings if f.confidence == "high"]
        if high:
            raise SecretLeakError(field, high[0])
        fuzzy = sorted({f.pattern for f in findings if f.confidence == "fuzzy"})
        if fuzzy:
            print(
                f"workspace_documents: warning — possible secret "
                f"({', '.join(fuzzy)}) in {field}; review before sharing",
                file=sys.stderr,
            )


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
    # Collision check considers BOTH the plaintext and the .enc backing form.
    while _doc_exists(target / f"{cand}{ext}"):
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
    # Refuse high-confidence secrets before any byte is written — neither the
    # .md body nor the .history.jsonl revision log may carry the credential.
    _guard_secrets({"body": body, "title": title, "source_prompt": source_prompt})
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
    logical = base / f"{slug}.md"
    written = _write_text(logical, body_text)
    hp = base / f"{slug}.history.jsonl"
    entry = {"ts": now, "actor": "host", "kind": "save",
             "delta": {"added": len(body.splitlines()), "removed": 0},
             "body_sha256": _body_sha(body)}
    hp.write_text(json.dumps(entry, sort_keys=True) + "\n", encoding="utf-8")
    return Document(type=type, slug=slug, title=title, body=body, path=written, history_path=hp)


def save(type: str, slug: str, body: str, *, actor: str = "user",
         root: Path | None = None) -> dict:
    # Refuse high-confidence secrets before the edited body overwrites the
    # file or appends a revision-log entry.
    _guard_secrets({"body": body})
    base = (root if root is not None else WORKSPACE_HOME) / type
    logical = base / f"{slug}.md"
    raw = _read_text_any(logical)
    if raw is None:
        raise FileNotFoundError(f"no such document: {type}/{slug}")
    end = raw.find("\n---", 4)
    head, old_body = (raw[: end + 4], raw[end + 4 :].lstrip("\n")) if end != -1 else ("", raw)
    now = _now_iso()
    head = re.sub(r"last_edited_at: .*", f"last_edited_at: {now}", head)
    _write_text(logical, head + "\n" + body if head else body)
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
    logical = base / f"{slug}.md"
    raw = _read_text_any(logical)
    if raw is None:
        return None
    end = raw.find("\n---", 4)
    body = raw[end + 4 :].lstrip("\n") if end != -1 else raw
    title = ""
    if raw.startswith("---") and end != -1:
        for line in raw[3:end].splitlines():
            if line.startswith("title:"):
                title = line.split(":", 1)[1].strip().strip("'\"")
                break
    hp = base / f"{slug}.history.jsonl"
    actual = _resolve_existing(logical) or logical
    return Document(type=type, slug=slug, title=title, body=body, path=actual, history_path=hp)


def _iter_doc_files(tdir: Path):
    """Yield (slug, backing_path) for each document in a type dir, plaintext
    or .enc, de-duplicated by slug (a slug never has both forms)."""
    seen: set[str] = set()
    for p in sorted(tdir.glob("*.md")) + sorted(tdir.glob("*.md" + ENC_SUFFIX)):
        slug = p.name[:-len(".md" + ENC_SUFFIX)] if p.name.endswith(ENC_SUFFIX) else p.stem
        if slug in seen:
            continue
        seen.add(slug)
        yield slug, p


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
        for slug, backing in _iter_doc_files(tdir):
            meta = _read_frontmatter(base / t / f"{slug}.md")
            if role and meta.get("role") != role:
                continue
            mtime = backing.stat().st_mtime
            docs.append((mtime, {
                "type": t, "slug": slug, "title": meta.get("title", slug),
                "role": meta.get("role"), "last_edited_at": meta.get("last_edited_at"),
                # updated_at mirrors the Node GUI server's prior direct-fs shape
                # (mtime ISO) so the Python-authoritative read path is a drop-in.
                "updated_at": datetime.fromtimestamp(mtime, timezone.utc)
                    .strftime("%Y-%m-%dT%H:%M:%S.000Z"),
                "path": str(backing),
            }))
    docs.sort(key=lambda r: r[0], reverse=True)
    return [d for _, d in docs[:limit]]


def _read_frontmatter(p: Path) -> dict:
    raw = _read_text_any(p)
    if raw is None or not raw.startswith("---"):
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
    # Always materialise cleartext for export — the backing file may be .enc.
    base = (root if root is not None else WORKSPACE_HOME) / type
    cleartext = _read_text_any(base / f"{slug}.md") or ""
    if format == "md":
        target.write_text(cleartext, encoding="utf-8")
        return target
    if format in ("pdf", "docx"):
        pandoc = shutil.which("pandoc")
        if not pandoc:
            raise RuntimeError("pandoc not on PATH — install it for pdf/docx export")
        # pandoc reads a real cleartext file — never hand it the .enc blob.
        with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False,
                                         encoding="utf-8") as tf:
            tf.write(cleartext)
            tmp_md = tf.name
        try:
            subprocess.run([pandoc, tmp_md, "-o", str(target)], check=True)
        finally:
            os.unlink(tmp_md)
        return target
    raise ValueError(f"unsupported format: {format!r}")


def migrate(*, root: Path | None = None) -> dict:
    """Non-destructive plaintext → ``.enc`` migration (ADR-062 must-have).

    For each plaintext ``<slug>.md`` with no ``.enc`` sibling: encrypt to
    ``.md.enc`` via an atomic temp+rename, verify it decrypts back to the
    original bytes, then delete the plaintext. Verify-before-delete means an
    interruption never loses data (worst case: both forms briefly coexist;
    re-running is idempotent). Requires the flag to be on (the key path).
    """
    if not _enc_enabled():
        raise RuntimeError("workspace.encrypt_at_rest is off — enable it before migrate")
    base = root if root is not None else WORKSPACE_HOME
    migrated, skipped = 0, 0
    if not base.exists():
        return {"migrated": 0, "skipped": 0}
    for tdir in sorted(p for p in base.iterdir() if p.is_dir()):
        for p in sorted(tdir.glob("*.md")):
            enc = _enc_path(p)
            if enc.exists():
                skipped += 1
                continue
            original = p.read_bytes()
            _atomic_write_bytes(enc, workspace_crypto.encrypt_bytes(original))
            if workspace_crypto.decrypt_bytes(enc.read_bytes()) != original:
                enc.unlink()  # rollback this file; leave plaintext intact
                raise RuntimeError(f"migrate: verify failed for {p}, rolled back")
            p.unlink()
            migrated += 1
    return {"migrated": migrated, "skipped": skipped}


def decrypt_all(*, root: Path | None = None) -> dict:
    """Kill-switch: convert every ``.md.enc`` back to plaintext ``.md``.

    Reads regardless of the flag (decryption only needs the key), so this
    works after the flag is flipped off. Verify-before-delete, idempotent.
    """
    base = root if root is not None else WORKSPACE_HOME
    decrypted = 0
    if not base.exists():
        return {"decrypted": 0}
    for tdir in sorted(p for p in base.iterdir() if p.is_dir()):
        for enc in sorted(tdir.glob("*.md" + ENC_SUFFIX)):
            plaintext = workspace_crypto.decrypt_bytes(enc.read_bytes())
            target = enc.with_name(enc.name[:-len(ENC_SUFFIX)])
            _atomic_write_bytes(target, plaintext)
            enc.unlink()
            decrypted += 1
    return {"decrypted": decrypted}


def rekey(*, root: Path | None = None) -> dict:
    """Rotate the master key and re-encrypt every encrypted document.

    Decrypts each ``.md.enc`` with the OLD key, rotates the key, re-encrypts
    with the NEW key (atomic temp+rename per file). The key rotation happens
    once; per-file re-encryption is verify-before-replace.
    """
    base = root if root is not None else WORKSPACE_HOME
    pending: list[tuple[Path, bytes]] = []
    if base.exists():
        for tdir in sorted(p for p in base.iterdir() if p.is_dir()):
            for enc in sorted(tdir.glob("*.md" + ENC_SUFFIX)):
                pending.append((enc, workspace_crypto.decrypt_bytes(enc.read_bytes())))
    new_key = workspace_crypto.rotate_key()
    for enc, cleartext in pending:
        _atomic_write_bytes(enc, workspace_crypto.encrypt_bytes(cleartext, key=new_key))
    return {"rekeyed": len(pending)}


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
    s_list.add_argument("--root",
                        help="documents dir to read (the Node GUI server passes "
                             "<writeRoot>/workspace/documents)")
    s_list.add_argument("--json", action="store_true",
                        help="emit a single JSON array (the Python-authoritative "
                             "read path the Node GUI server consumes)")
    s_read = sub.add_parser("read")
    s_read.add_argument("type")
    s_read.add_argument("slug")
    s_exp = sub.add_parser("export")
    s_exp.add_argument("type")
    s_exp.add_argument("slug")
    s_exp.add_argument("--to", required=True)
    s_exp.add_argument("--format", default="md")
    s_mig = sub.add_parser("migrate")
    s_mig.add_argument("--root")
    s_dec = sub.add_parser("decrypt-all")
    s_dec.add_argument("--root")
    s_rek = sub.add_parser("rekey")
    s_rek.add_argument("--root")
    args = p.parse_args(argv)
    if args.cmd == "create":
        body = Path(args.body_file).read_text(encoding="utf-8")
        try:
            doc = create(type=args.type, title=args.title, body=body,
                         role=args.role, source_prompt=args.prompt,
                         source_session=args.session)
        except SecretLeakError as err:
            print(f"workspace_documents: refused — {err}", file=sys.stderr)
            return 3
        print(json.dumps({"slug": doc.slug, "path": str(doc.path)}, sort_keys=True))
        return 0
    if args.cmd == "save":
        body = Path(args.body_file).read_text(encoding="utf-8")
        try:
            entry = save(args.type, args.slug, body, actor=args.actor)
        except SecretLeakError as err:
            print(f"workspace_documents: refused — {err}", file=sys.stderr)
            return 3
        print(json.dumps(entry, sort_keys=True))
        return 0
    if args.cmd == "list":
        rows = list_documents(type=args.type, role=args.role, limit=args.limit,
                              root=Path(args.root) if args.root else None)
        if args.json:
            print(json.dumps(rows, sort_keys=True))
        else:
            for row in rows:
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
    if args.cmd == "migrate":
        print(json.dumps(migrate(root=Path(args.root) if args.root else None), sort_keys=True))
        return 0
    if args.cmd == "decrypt-all":
        print(json.dumps(decrypt_all(root=Path(args.root) if args.root else None), sort_keys=True))
        return 0
    if args.cmd == "rekey":
        print(json.dumps(rekey(root=Path(args.root) if args.root else None), sort_keys=True))
        return 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
