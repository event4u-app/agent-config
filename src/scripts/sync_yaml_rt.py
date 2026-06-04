"""Round-trip YAML layer for ``.agent-settings.yml`` syncs.

Self-contained, stdlib-only. Implements a narrow YAML subset with the
property *user-line preservation*: every line in the user input that
``parse`` attaches to a ``Node`` is reproduced character-for-character
by ``emit``. Synthetic nodes (added by ``merge``) follow the
template's source formatting.

Supported subset
================
* block-mappings, 2- or 4-space indent (no tabs in indent — `ValueError`)
* mapping values: bare scalars, single-/double-quoted strings, ints,
  bools, ``~`` / ``null`` / ``None`` (kept verbatim, not normalised)
* block lists (``- foo``) — values verbatim, indent must be consistent
* inline lists (``[a, b, c]``) — flat only, no nested flow mappings
* ``#``-comments (full-line and inline) — preserved verbatim
* blank lines — preserved verbatim
* CRLF and LF line endings — preserved per-line
* duplicate keys at the same level: **last wins** (earlier entry is
  replaced, the later line carries the value)

Not supported (parser raises ``ValueError`` with a line number):
anchors (``&`` / ``*``), aliases, nested flow-mappings, ``?``-keys,
multi-doc (``---`` / ``...``), tagged scalars (``!!str``), multiline
scalars (``|`` / ``>``), tabs in indent, mixed indent inside a block.

Public API
==========
* ``Node`` — round-trip tree node
* ``parse(text) -> Node`` — Phase 2
* ``emit(node) -> str``    — Phase 2 (round-trip property)
* ``merge(user, template) -> Node``  — Phase 3
* ``heal_user_block(user, template) -> Node`` — Phase 4
* ``sync(user_text, template_text) -> str``    — Phase 5
"""
from __future__ import annotations

import copy as _copy
from dataclasses import dataclass, field

# --- Public node ----------------------------------------------------


@dataclass
class Node:
    """A single node in the round-trip YAML tree.

    ``header_line`` is the ground truth for emit: it is the verbatim
    source line for ``key: value`` (or ``- value`` for list items),
    *including* indent, inline comment, and line ending. Parsed
    fields (``key``, ``raw_value``, ``inline_comment``) are derived
    from ``header_line`` and used by the merger; emit never re-
    serialises them.

    ``leading`` are the blank / comment lines above the node, also
    verbatim with line endings. ``trailing`` is only meaningful on
    the synthetic root and holds blank / comment lines that follow
    the last top-level child.
    """

    # Parsed identity (used by merge / heal)
    key: str | None = None
    indent: int = 0
    raw_value: str | None = None
    inline_comment: str | None = None
    is_list_item: bool = False

    # Verbatim source pieces (used by emit)
    leading: list[str] = field(default_factory=list)
    header_line: str | None = None
    trailing: list[str] = field(default_factory=list)

    # Tree
    children: list["Node"] = field(default_factory=list)

    # Provenance
    origin_line: int | None = None
    line_ending: str = "\n"


# --- Tokeniser ------------------------------------------------------


@dataclass
class _RawLine:
    number: int          # 1-based
    raw: str             # full line including line ending
    line_ending: str     # "\n" or "\r\n" or "" (last line, no terminator)
    body: str            # raw without line ending
    indent: int          # number of leading spaces
    kind: str            # 'blank', 'comment', 'mapping', 'list', 'flow_error'


def _tokenise(text: str) -> list[_RawLine]:
    """Split ``text`` into ``_RawLine`` objects, preserving line endings."""
    out: list[_RawLine] = []
    if text == "":
        return out
    # splitlines(keepends=True) keeps each line's terminator; the last
    # line may have no terminator at all.
    for i, raw in enumerate(text.splitlines(keepends=True), 1):
        if raw.endswith("\r\n"):
            le, body = "\r\n", raw[:-2]
        elif raw.endswith("\n"):
            le, body = "\n", raw[:-1]
        elif raw.endswith("\r"):
            le, body = "\r", raw[:-1]
        else:
            le, body = "", raw
        # Tabs in indent are an error. We compute the leading-whitespace
        # span first, then check it for tabs.
        ws = body[: len(body) - len(body.lstrip(" \t"))]
        if "\t" in ws:
            raise ValueError(
                f"tab character in indent at line {i} (only spaces allowed)"
            )
        indent = len(ws)
        stripped = body.strip()
        if stripped == "":
            kind = "blank"
        elif stripped.startswith("#"):
            kind = "comment"
        elif stripped.startswith("- ") or stripped == "-":
            kind = "list"
        else:
            kind = "mapping"
        out.append(
            _RawLine(
                number=i,
                raw=raw,
                line_ending=le,
                body=body,
                indent=indent,
                kind=kind,
            )
        )
    return out



# --- Scalar parsing -------------------------------------------------


def _split_inline_comment(value_part: str) -> tuple[str, str | None]:
    """Split ``value  # comment`` into ``(value, comment)``.

    Honours single- and double-quoted string boundaries so a ``#``
    inside a quoted scalar is not treated as a comment delimiter.
    Trailing whitespace between the value and ``#`` is kept on the
    value side so the emitter can reproduce the source exactly via
    ``header_line``; only the parsed-value field strips it.
    """
    in_single = False
    in_double = False
    i = 0
    while i < len(value_part):
        ch = value_part[i]
        if ch == "'" and not in_double:
            in_single = not in_single
        elif ch == '"' and not in_single:
            in_double = not in_double
        elif ch == "#" and not in_single and not in_double:
            # comment starts here; require it to be preceded by space
            # or be at column 0 of the value-part. We're parsing the
            # post-`:` section so column 0 means immediately after
            # `key:` — that case is "no value, only comment".
            if i == 0 or value_part[i - 1] in (" ", "\t"):
                value_text = value_part[:i].rstrip(" \t")
                comment_text = value_part[i:]
                return value_text, comment_text
        i += 1
    return value_part.rstrip(" \t") or "", None


def _parse_mapping_line(body: str) -> tuple[str, str | None, str | None]:
    """Split ``  key: value  # c`` into ``(key, raw_value, inline_comment)``.

    ``key`` is the unquoted, parsed identifier (used for merge
    matching). ``raw_value`` is verbatim (including any quotes).
    ``inline_comment`` is the verbatim ``# …`` substring or ``None``.
    The leading indent is stripped before this function is called.
    """
    stripped = body.lstrip(" ")
    # Find the colon that ends the key. Quoted keys may contain ':'.
    if stripped.startswith('"'):
        end = stripped.find('"', 1)
        if end == -1:
            raise ValueError("unterminated double-quoted key")
        raw_key = stripped[: end + 1]
        rest = stripped[end + 1 :]
        key = stripped[1:end]
    elif stripped.startswith("'"):
        end = stripped.find("'", 1)
        if end == -1:
            raise ValueError("unterminated single-quoted key")
        raw_key = stripped[: end + 1]
        rest = stripped[end + 1 :]
        key = stripped[1:end]
    else:
        # bare key — colon is the first ':' that is followed by
        # space, end-of-line, or '#'.
        colon = -1
        for i, ch in enumerate(stripped):
            if ch == ":":
                following = stripped[i + 1 : i + 2]
                if following in ("", " ", "\t", "#"):
                    colon = i
                    break
        if colon == -1:
            raise ValueError(f"missing ':' in mapping line: {stripped!r}")
        raw_key = stripped[:colon]
        rest = stripped[colon:]
        key = raw_key
    # ``rest`` now starts with ':' (or '"X":' was already consumed
    # for the quoted case and rest starts with whatever follows).
    if rest.startswith(":"):
        rest = rest[1:]
    elif rest.startswith(" :") or rest.startswith("\t:"):
        rest = rest.lstrip(" \t")[1:]
    else:
        # Quoted key followed by `:` — same handling.
        if rest.lstrip().startswith(":"):
            rest = rest.lstrip()[1:]
        else:
            raise ValueError(
                f"missing ':' after key {raw_key!r}: rest={rest!r}"
            )
    # ``rest`` is now whatever follows the colon (may start with space).
    rest_text = rest.lstrip(" \t")
    if rest_text == "":
        return key, None, None
    if rest_text.startswith("#"):
        # Mapping with no value but an inline comment.
        return key, None, rest_text
    raw_value, comment = _split_inline_comment(rest_text)
    return key, raw_value, comment


def _parse_list_line(body: str) -> tuple[str | None, str | None]:
    """``- value  # c`` -> ``(raw_value, inline_comment)``.

    ``-`` alone (no value) is allowed and yields ``(None, None)``.
    """
    stripped = body.lstrip(" ")
    assert stripped == "-" or stripped.startswith("- ")
    if stripped == "-":
        return None, None
    rest = stripped[2:]
    if rest == "":
        return None, None
    if rest.startswith("#"):
        return None, rest
    raw_value, comment = _split_inline_comment(rest)
    return raw_value, comment


# --- Tree builder ---------------------------------------------------


def _build_tree(lines: list[_RawLine]) -> Node:
    """Convert tokenised lines into a ``Node`` tree.

    Indent state machine:
    * The synthetic root sits at indent -1.
    * Children of the same parent must share an indent.
    * A line with indent > current top of stack opens a child block of
      the previous mapping key (or list item).
    * A line with indent <= current top pops the stack until a parent
      with strictly smaller indent is on top.
    * Trailing blank / comment lines after the last content line
      attach to ``root.trailing``.
    """
    root = Node(indent=-1)
    # stack: list of (parent_node, child_indent_or_None)
    # child_indent is set by the first content child of `parent_node`.
    stack: list[tuple[Node, int | None]] = [(root, None)]
    pending: list[str] = []

    for line in lines:
        if line.kind in ("blank", "comment"):
            pending.append(line.raw)
            continue
        # Pop until top.indent < current.indent, AND we are not
        # opening a child block of the previous node.
        while True:
            parent, fixed_indent = stack[-1]
            parent_indent = parent.indent
            if line.indent > parent_indent:
                # Going into a child of `parent` — validate consistent
                # child indent.
                if fixed_indent is None:
                    # First child sets the child indent.
                    stack[-1] = (parent, line.indent)
                    break
                if line.indent == fixed_indent:
                    break
                if line.indent > fixed_indent:
                    raise ValueError(
                        f"unexpected over-indent at line {line.number} "
                        f"(parent expects {fixed_indent}, got {line.indent})"
                    )
                # Less than fixed — pop and re-evaluate.
            stack.pop()
            if not stack:
                raise ValueError(
                    f"indent underflow at line {line.number}"
                )
        node = _line_to_node(line)
        # Last-wins for duplicate sibling mapping keys (documented
        # YAML semantics — parser drops the earlier entry).
        if node.key is not None:
            for i, sib in enumerate(parent.children):
                if sib.key == node.key and not sib.is_list_item:
                    del parent.children[i]
                    break
        parent.children.append(node)
        # Mapping nodes can have children; list items can have children
        # only if a deeper indent follows. Either way push them.
        stack.append((node, None))
        # Re-attach pending leading.
        if pending:
            node.leading = pending
            pending = []

    # Anything left over after the last content line is root trailing.
    if pending:
        root.trailing = pending
    return root


def _line_to_node(line: _RawLine) -> Node:
    """Convert a content ``_RawLine`` into a ``Node``."""
    if line.kind == "list":
        raw_value, inline = _parse_list_line(line.body)
        return Node(
            key=None,
            indent=line.indent,
            raw_value=raw_value,
            inline_comment=inline,
            is_list_item=True,
            header_line=line.raw,
            origin_line=line.number,
            line_ending=line.line_ending,
        )
    # mapping line
    key, raw_value, inline = _parse_mapping_line(line.body)
    return Node(
        key=key,
        indent=line.indent,
        raw_value=raw_value,
        inline_comment=inline,
        is_list_item=False,
        header_line=line.raw,
        origin_line=line.number,
        line_ending=line.line_ending,
    )


# --- Public parse / emit --------------------------------------------


def parse(text: str) -> Node:
    """Parse YAML ``text`` into a round-trip ``Node`` tree."""
    if text == "":
        return Node(indent=-1)
    return _build_tree(_tokenise(text))


def emit(node: Node) -> str:
    """Emit a ``Node`` tree back to YAML text.

    For nodes that originated from parsed source, ``header_line`` and
    ``leading`` are reproduced verbatim. Synthetic nodes (added by
    ``merge``) are rendered from their parsed fields using
    template-derived formatting.
    """
    parts: list[str] = []
    _emit_node(node, parts, is_root=True)
    return "".join(parts)


def _emit_node(node: Node, parts: list[str], *, is_root: bool = False) -> None:
    if not is_root:
        parts.extend(node.leading)
        if node.header_line is not None:
            parts.append(node.header_line)
        else:
            parts.append(_render_synthetic_header(node))
    for child in node.children:
        _emit_node(child, parts)
    if is_root:
        parts.extend(node.trailing)


def _render_synthetic_header(node: Node) -> str:
    """Render a synthetic node (no ``header_line``) from parsed fields."""
    indent = " " * node.indent
    le = node.line_ending or "\n"
    if node.is_list_item:
        if node.raw_value is None:
            body = f"{indent}-"
        else:
            body = f"{indent}- {node.raw_value}"
    else:
        if node.raw_value is None:
            body = f"{indent}{node.key}:"
        else:
            body = f"{indent}{node.key}: {node.raw_value}"
    if node.inline_comment:
        body = f"{body}  {node.inline_comment}"
    return body + le


# --- Phase 3: additive merger --------------------------------------


def merge(user: Node, template: Node) -> Node:
    """Additive merge of ``template`` into ``user``.

    Walks the ``template`` tree in order. For every mapping key
    present in ``user`` we recurse into the children. For every
    mapping key **missing** from ``user`` we insert a deep copy of
    the template subtree (verbatim ``header_line`` / ``leading``)
    after the user's copy of the nearest preceding template sibling;
    if no such sibling exists in user, the new node is appended at
    the parent's EOF.

    Cloned template subtrees adopt the user's predominant line
    ending — a CRLF user file stays CRLF, even when the template
    is LF.

    Mutates ``user`` in place and returns it.

    List items are treated as opaque per the Phase 3 spec — a user
    list with content is kept verbatim; a missing list is replaced
    by the template list.
    """
    user_le = _detect_eol(user)
    _merge_into(user, template, is_root=True, user_le=user_le)
    return user


def _merge_into(
    user: Node, template: Node, *, is_root: bool = False, user_le: str = "\n"
) -> None:
    user_keys: dict[str, Node] = {
        c.key: c for c in user.children if c.key is not None and not c.is_list_item
    }
    for tmpl_child in template.children:
        if tmpl_child.key is None or tmpl_child.is_list_item:
            continue
        if tmpl_child.key in user_keys:
            user_child = user_keys[tmpl_child.key]
            # Only recurse when:
            # (a) the template child has children (is a section), AND
            # (b) the user child is not an explicit scalar leaf —
            #     i.e. ``raw_value`` is None (header-only, ready to
            #     receive children) or already has children. A user
            #     scalar like ``personal: null`` blocks recursion so
            #     we never inject children under a scalar header.
            if tmpl_child.children and (
                user_child.raw_value is None or user_child.children
            ):
                _merge_into(user_child, tmpl_child, user_le=user_le)
            continue
        # Missing — insert a clone of the template subtree.
        cloned = _copy.deepcopy(tmpl_child)
        _normalize_line_endings(cloned, user_le)
        insert_pos = _find_insert_pos(user, template, tmpl_child)
        if is_root:
            # Top-level sections need exactly one blank-line
            # separator from the preceding user content.
            _ensure_blank_separator(cloned)
        user.children.insert(insert_pos, cloned)
        user_keys[tmpl_child.key] = cloned


def _find_insert_pos(user: Node, template: Node, missing: Node) -> int:
    """Index in ``user.children`` for ``missing``.

    Collects every template sibling that appears *before* ``missing``
    and returns ``max(user_index_of_each) + 1`` so the new node lands
    after the latest preceding-sibling the user file actually
    contains. If none match, returns ``len(user.children)``
    (parent-section EOF).

    This honours user reordering: when the user reordered ``a, b, c``
    to ``a, c, b`` and the template adds ``d`` after ``c``, ``d`` goes
    after ``b`` (the latest in user order), not after ``c``.
    """
    preceding: set[str] = set()
    for child in template.children:
        if child is missing:
            break
        if child.key is not None and not child.is_list_item:
            preceding.add(child.key)
    last_match = -1
    for i, uc in enumerate(user.children):
        if uc.key in preceding and not uc.is_list_item:
            last_match = i
    if last_match >= 0:
        return last_match + 1
    return len(user.children)


def _ensure_blank_separator(cloned: Node) -> None:
    """Make sure a top-level inserted node starts with one blank line."""
    le = cloned.line_ending or "\n"
    if not cloned.leading or all(line.strip() != "" for line in cloned.leading):
        cloned.leading.insert(0, le)
    else:
        # Collapse runs of leading blanks to a single blank.
        first_blank_seen = False
        kept: list[str] = []
        for line in cloned.leading:
            if line.strip() == "":
                if first_blank_seen:
                    continue
                first_blank_seen = True
                kept.append(line)
            else:
                kept.append(line)
        cloned.leading = kept


def _detect_eol(node: Node) -> str:
    """Return the predominant line ending in a parsed tree.

    Falls back to ``\\n`` when the tree is empty or the count is tied.
    """
    counts = {"\n": 0, "\r\n": 0}

    def walk(n: Node) -> None:
        if n.line_ending in counts:
            counts[n.line_ending] += 1
        for c in n.children:
            walk(c)

    walk(node)
    return "\r\n" if counts["\r\n"] > counts["\n"] else "\n"


def _swap_line_ending(line: str, le: str) -> str:
    if line.endswith("\r\n"):
        return line[:-2] + le
    if line.endswith("\n"):
        return line[:-1] + le
    return line  # last line of file may have no terminator


def _normalize_line_endings(node: Node, le: str) -> None:
    """Rewrite line endings in a (cloned) subtree to ``le``.

    Touches ``header_line``, every entry in ``leading`` / ``trailing``,
    and ``line_ending`` itself. Recurses into children.
    """
    if node.header_line is not None:
        node.header_line = _swap_line_ending(node.header_line, le)
    node.leading = [_swap_line_ending(line, le) for line in node.leading]
    node.trailing = [_swap_line_ending(line, le) for line in node.trailing]
    node.line_ending = le
    for child in node.children:
        _normalize_line_endings(child, le)


# --- Phase 4: _user healer -----------------------------------------


def heal_user_block(user: Node, template: Node) -> Node:
    """Heal legacy ``_user._user.foo`` corruption.

    Walks the top-level ``_user:`` block (if present), collects every
    leaf scalar inside it with `_user` path segments stripped, and:

    * **Re-homes** leaves whose stripped path exists in the
      ``template`` tree to their template location in ``user``
      (only if the user does not already have a value there —
      existing user values win).
    * **Keeps** leaves with no template home as orphans in a
      rebuilt single-level ``_user:`` block, joining multi-segment
      stripped paths with ``.``.
    * **Drops** the ``_user:`` block entirely when no orphans
      remain after re-homing.

    Mutates ``user`` in place and returns it. Idempotent — running
    twice yields the same result, which the Phase 5 idempotency
    suite asserts.
    """
    block_idx = next(
        (
            i
            for i, c in enumerate(user.children)
            if c.key == "_user" and not c.is_list_item
        ),
        None,
    )
    if block_idx is None:
        return user
    block = user.children[block_idx]

    leaves: list[tuple[list[str], Node]] = []
    _collect_leaves(block, [], leaves)

    orphans: list[tuple[list[str], Node]] = []
    for path, leaf in leaves:
        if not path:
            continue
        if _template_has_path(template, path):
            _rehome_if_missing(user, path, leaf)
        else:
            orphans.append((path, leaf))

    if orphans:
        rebuilt = Node(
            key="_user",
            indent=block.indent,
            header_line=block.header_line,
            leading=list(block.leading),
            origin_line=block.origin_line,
            line_ending=block.line_ending,
        )
        child_indent = block.indent + 2
        for path, leaf in orphans:
            joined = ".".join(path)
            # ``header_line=None`` lets ``_render_synthetic_header``
            # produce the canonical form — collapses to ``key:`` (no
            # trailing space) when ``raw_value`` is None and avoids
            # the double-space-before-comment failure of a manual
            # f-string.
            rebuilt.children.append(
                Node(
                    key=joined,
                    indent=child_indent,
                    raw_value=leaf.raw_value,
                    inline_comment=leaf.inline_comment,
                    line_ending=leaf.line_ending,
                )
            )
        user.children[block_idx] = rebuilt
    else:
        user.children.pop(block_idx)

    return user


def _collect_leaves(
    node: Node,
    path: list[str],
    out: list[tuple[list[str], Node]],
) -> None:
    """Recursively collect leaves; ``_user`` segments are stripped.

    Dotted keys (``_user._user.foo.bar``) are split on ``.`` so each
    component is a separate path segment — this is what lets the
    healer collapse a single corrupted leaf whose key carries N
    leading ``_user.`` prefixes accumulated by the old buggy sync.
    """
    for child in node.children:
        if child.is_list_item or child.key is None:
            continue
        segs = child.key.split(".") if "." in child.key else [child.key]
        stripped = [s for s in segs if s != "_user"]
        next_path = [*path, *stripped]
        if child.children:
            _collect_leaves(child, next_path, out)
        else:
            out.append((next_path, child))


def _template_has_path(template: Node, path: list[str]) -> bool:
    """True iff ``path`` resolves to a node in the template tree."""
    cursor: Node | None = template
    for seg in path:
        if cursor is None:
            return False
        cursor = next(
            (c for c in cursor.children if c.key == seg and not c.is_list_item),
            None,
        )
    return cursor is not None


def _rehome_if_missing(user: Node, path: list[str], leaf: Node) -> None:
    """Insert ``leaf`` at ``path`` in ``user`` if it isn't already there."""
    cursor = user
    for i, seg in enumerate(path):
        existing = next(
            (c for c in cursor.children if c.key == seg and not c.is_list_item),
            None,
        )
        is_last = i == len(path) - 1
        if existing is None:
            indent = cursor.indent + 2 if cursor.key is not None else 0
            # ``header_line=None`` defers rendering to
            # ``_render_synthetic_header`` so empty-value /
            # comment-only headers come out as ``seg:`` and
            # ``seg:  # c`` without the manual-f-string drift.
            if is_last:
                cursor.children.append(
                    Node(
                        key=seg,
                        indent=indent,
                        raw_value=leaf.raw_value,
                        inline_comment=leaf.inline_comment,
                        line_ending=leaf.line_ending,
                    )
                )
            else:
                container = Node(
                    key=seg,
                    indent=indent,
                    line_ending=leaf.line_ending,
                )
                cursor.children.append(container)
                cursor = container
        else:
            if is_last:
                return  # User already has a value here — keep it.
            cursor = existing


def sync(user_text: str, template_text: str) -> str:
    """Top-level sync entry-point.

    Pipeline: ``parse(user_text) → heal_user_block → merge → emit``.
    The healer runs as a pre-pass so the merger sees a tree that
    already has legacy ``_user._user.foo`` corruption collapsed to
    its template-home or orphan form.
    """
    user_tree = parse(user_text)
    template_tree = parse(template_text)
    user_tree = heal_user_block(user_tree, template_tree)
    merged = merge(user_tree, template_tree)
    return emit(merged)
