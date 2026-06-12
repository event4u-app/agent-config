/**
 * Round-trip YAML layer for `.agent-settings.yml` syncs.
 *
 * TypeScript twin of `src/scripts/sync_yaml_rt.py` (ADR-090). Self-
 * contained, zero-dependency. Implements a narrow YAML subset with the
 * property *user-line preservation*: every line in the user input that
 * `parse` attaches to a `Node` is reproduced character-for-character by
 * `emit`. Synthetic nodes (added by `merge`) follow the template's
 * source formatting.
 *
 * Supported subset
 * ================
 *  - block-mappings, 2- or 4-space indent (no tabs in indent — Error)
 *  - mapping values: bare scalars, single-/double-quoted strings, ints,
 *    bools, `~` / `null` / `None` (kept verbatim, not normalised)
 *  - block lists (`- foo`) — values verbatim, indent must be consistent
 *  - inline lists (`[a, b, c]`) — flat only, no nested flow mappings
 *  - `#`-comments (full-line and inline) — preserved verbatim
 *  - blank lines — preserved verbatim
 *  - CRLF and LF line endings — preserved per-line
 *  - duplicate keys at the same level: **last wins** (earlier entry is
 *    replaced, the later line carries the value)
 *
 * Not supported (parser throws `Error` with a line number):
 * anchors (`&` / `*`), aliases, nested flow-mappings, `?`-keys,
 * multi-doc (`---` / `...`), tagged scalars (`!!str`), multiline
 * scalars (`|` / `>`), tabs in indent, mixed indent inside a block.
 *
 * Public API
 * ==========
 *  - `Node` — round-trip tree node
 *  - `parse(text) -> Node`
 *  - `emit(node) -> string`    (round-trip property)
 *  - `merge(user, template) -> Node`
 *  - `heal_user_block(user, template) -> Node`
 *  - `sync(user_text, template_text) -> string`
 *
 * No behaviour changes vs. the Python original — latent bugs replicated.
 */

// --- Public node ----------------------------------------------------

/**
 * A single node in the round-trip YAML tree.
 *
 * `header_line` is the ground truth for emit: it is the verbatim source
 * line for `key: value` (or `- value` for list items), *including*
 * indent, inline comment, and line ending. Parsed fields (`key`,
 * `raw_value`, `inline_comment`) are derived from `header_line` and used
 * by the merger; emit never re-serialises them.
 *
 * `leading` are the blank / comment lines above the node, also verbatim
 * with line endings. `trailing` is only meaningful on the synthetic root
 * and holds blank / comment lines that follow the last top-level child.
 */
export interface Node {
  // Parsed identity (used by merge / heal)
  key: string | null;
  indent: number;
  raw_value: string | null;
  inline_comment: string | null;
  is_list_item: boolean;

  // Verbatim source pieces (used by emit)
  leading: string[];
  header_line: string | null;
  trailing: string[];

  // Tree
  children: Node[];

  // Provenance
  origin_line: number | null;
  line_ending: string;
}

/** Construct a `Node` with Python-dataclass default values. */
function makeNode(partial: Partial<Node> = {}): Node {
  return {
    key: null,
    indent: 0,
    raw_value: null,
    inline_comment: null,
    is_list_item: false,
    leading: [],
    header_line: null,
    trailing: [],
    children: [],
    origin_line: null,
    line_ending: '\n',
    ...partial,
  };
}

/** Deep-copy a `Node` subtree (mirrors Python `copy.deepcopy`). */
function deepcopyNode(node: Node): Node {
  return {
    key: node.key,
    indent: node.indent,
    raw_value: node.raw_value,
    inline_comment: node.inline_comment,
    is_list_item: node.is_list_item,
    leading: [...node.leading],
    header_line: node.header_line,
    trailing: [...node.trailing],
    children: node.children.map(deepcopyNode),
    origin_line: node.origin_line,
    line_ending: node.line_ending,
  };
}

// --- Tokeniser ------------------------------------------------------

type LineKind = 'blank' | 'comment' | 'mapping' | 'list';

interface RawLine {
  number: number; // 1-based
  raw: string; // full line including line ending
  line_ending: string; // "\n" | "\r\n" | "\r" | "" (last line, no terminator)
  body: string; // raw without line ending
  indent: number; // number of leading spaces
  kind: LineKind;
}

/**
 * Split text into lines, keeping line endings (mirrors Python
 * `splitlines(keepends=True)` for `\n`, `\r\n`, `\r`).
 */
function splitKeepEnds(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\n') {
      out.push(text.slice(start, i + 1));
      start = i + 1;
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') {
        out.push(text.slice(start, i + 2));
        start = i + 2;
        i++;
      } else {
        out.push(text.slice(start, i + 1));
        start = i + 1;
      }
    }
  }
  if (start < text.length) {
    out.push(text.slice(start));
  }
  return out;
}

/** Split `text` into `RawLine` objects, preserving line endings. */
function tokenise(text: string): RawLine[] {
  const out: RawLine[] = [];
  if (text === '') {
    return out;
  }
  const rawLines = splitKeepEnds(text);
  for (let idx = 0; idx < rawLines.length; idx++) {
    const i = idx + 1;
    const raw = rawLines[idx];
    if (raw === undefined) {
      // Unreachable: idx < rawLines.length. Guard for
      // noUncheckedIndexedAccess.
      continue;
    }
    let le: string;
    let body: string;
    if (raw.endsWith('\r\n')) {
      le = '\r\n';
      body = raw.slice(0, -2);
    } else if (raw.endsWith('\n')) {
      le = '\n';
      body = raw.slice(0, -1);
    } else if (raw.endsWith('\r')) {
      le = '\r';
      body = raw.slice(0, -1);
    } else {
      le = '';
      body = raw;
    }
    // Tabs in indent are an error. Compute the leading-whitespace span
    // first, then check it for tabs (same as Python).
    const stripped0 = body.replace(/^[ \t]+/, '');
    const ws = body.slice(0, body.length - stripped0.length);
    if (ws.includes('\t')) {
      throw new Error(`tab character in indent at line ${i} (only spaces allowed)`);
    }
    const indent = ws.length;
    const stripped = body.trim();
    let kind: LineKind;
    if (stripped === '') {
      kind = 'blank';
    } else if (stripped.startsWith('#')) {
      kind = 'comment';
    } else if (stripped.startsWith('- ') || stripped === '-') {
      kind = 'list';
    } else {
      kind = 'mapping';
    }
    out.push({ number: i, raw, line_ending: le, body, indent, kind });
  }
  return out;
}

// --- Scalar parsing -------------------------------------------------

function rstripSpacesTabs(s: string): string {
  return s.replace(/[ \t]+$/, '');
}

/**
 * Split `value  # comment` into `[value, comment]`.
 *
 * Honours single- and double-quoted string boundaries so a `#` inside a
 * quoted scalar is not treated as a comment delimiter. Trailing
 * whitespace between the value and `#` is kept on the value side so the
 * emitter can reproduce the source exactly via `header_line`; only the
 * parsed-value field strips it.
 */
function splitInlineComment(valuePart: string): [string, string | null] {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < valuePart.length; i++) {
    const ch = valuePart[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (ch === '#' && !inSingle && !inDouble) {
      // comment starts here; require it to be preceded by space or be at
      // column 0 of the value-part.
      if (i === 0 || valuePart[i - 1] === ' ' || valuePart[i - 1] === '\t') {
        const valueText = rstripSpacesTabs(valuePart.slice(0, i));
        const commentText = valuePart.slice(i);
        return [valueText, commentText];
      }
    }
  }
  return [rstripSpacesTabs(valuePart) || '', null];
}

/**
 * Split `  key: value  # c` into `[key, raw_value, inline_comment]`.
 *
 * `key` is the unquoted, parsed identifier (used for merge matching).
 * `raw_value` is verbatim (including any quotes). `inline_comment` is the
 * verbatim `# …` substring or `null`. The leading indent is stripped
 * before this function is called.
 */
function parseMappingLine(body: string): [string, string | null, string | null] {
  const stripped = body.replace(/^ +/, '');
  let rawKey: string;
  let rest: string;
  let key: string;
  // Find the colon that ends the key. Quoted keys may contain ':'.
  if (stripped.startsWith('"')) {
    const end = stripped.indexOf('"', 1);
    if (end === -1) {
      throw new Error('unterminated double-quoted key');
    }
    rawKey = stripped.slice(0, end + 1);
    rest = stripped.slice(end + 1);
    key = stripped.slice(1, end);
  } else if (stripped.startsWith("'")) {
    const end = stripped.indexOf("'", 1);
    if (end === -1) {
      throw new Error('unterminated single-quoted key');
    }
    rawKey = stripped.slice(0, end + 1);
    rest = stripped.slice(end + 1);
    key = stripped.slice(1, end);
  } else {
    // bare key — colon is the first ':' followed by space, EOL, or '#'.
    let colon = -1;
    for (let i = 0; i < stripped.length; i++) {
      if (stripped[i] === ':') {
        const following = stripped.slice(i + 1, i + 2);
        if (following === '' || following === ' ' || following === '\t' || following === '#') {
          colon = i;
          break;
        }
      }
    }
    if (colon === -1) {
      throw new Error(`missing ':' in mapping line: ${pyRepr(stripped)}`);
    }
    rawKey = stripped.slice(0, colon);
    rest = stripped.slice(colon);
    key = rawKey;
  }
  // `rest` now starts with ':' (or whatever follows the consumed quoted key).
  if (rest.startsWith(':')) {
    rest = rest.slice(1);
  } else if (rest.startsWith(' :') || rest.startsWith('\t:')) {
    rest = rest.replace(/^[ \t]+/, '').slice(1);
  } else if (rest.replace(/^\s+/, '').startsWith(':')) {
    // Quoted key followed by `:` — same handling.
    rest = rest.replace(/^\s+/, '').slice(1);
  } else {
    throw new Error(`missing ':' after key ${pyRepr(rawKey)}: rest=${pyRepr(rest)}`);
  }
  // `rest` is now whatever follows the colon (may start with space).
  const restText = rest.replace(/^[ \t]+/, '');
  if (restText === '') {
    return [key, null, null];
  }
  if (restText.startsWith('#')) {
    // Mapping with no value but an inline comment.
    return [key, null, restText];
  }
  const [rawValue, comment] = splitInlineComment(restText);
  return [key, rawValue, comment];
}

/**
 * `- value  # c` -> `[raw_value, inline_comment]`.
 *
 * `-` alone (no value) is allowed and yields `[null, null]`.
 */
function parseListLine(body: string): [string | null, string | null] {
  const stripped = body.replace(/^ +/, '');
  if (stripped !== '-' && !stripped.startsWith('- ')) {
    throw new Error(`not a list line: ${pyRepr(body)}`);
  }
  if (stripped === '-') {
    return [null, null];
  }
  const rest = stripped.slice(2);
  if (rest === '') {
    return [null, null];
  }
  if (rest.startsWith('#')) {
    return [null, rest];
  }
  return splitInlineComment(rest);
}

/** Python-repr-style quoting for error messages (matches `{x!r}`). */
function pyRepr(s: string): string {
  // Python prefers single quotes unless the string contains a single
  // quote and no double quote.
  const hasSingle = s.includes("'");
  const hasDouble = s.includes('"');
  const quote = hasSingle && !hasDouble ? '"' : "'";
  let out = quote;
  for (const ch of s) {
    if (ch === '\\') {
      out += '\\\\';
    } else if (ch === quote) {
      out += '\\' + quote;
    } else if (ch === '\n') {
      out += '\\n';
    } else if (ch === '\r') {
      out += '\\r';
    } else if (ch === '\t') {
      out += '\\t';
    } else {
      out += ch;
    }
  }
  out += quote;
  return out;
}

// --- Tree builder ---------------------------------------------------

/**
 * Convert tokenised lines into a `Node` tree.
 *
 * Indent state machine:
 *  - The synthetic root sits at indent -1.
 *  - Children of the same parent must share an indent.
 *  - A line with indent > current top of stack opens a child block of the
 *    previous mapping key (or list item).
 *  - A line with indent <= current top pops the stack until a parent with
 *    strictly smaller indent is on top.
 *  - Trailing blank / comment lines after the last content line attach to
 *    `root.trailing`.
 */
function buildTree(lines: RawLine[]): Node {
  const root = makeNode({ indent: -1 });
  // stack: [parentNode, childIndentOrNull]
  // childIndent is set by the first content child of `parentNode`.
  const stack: Array<[Node, number | null]> = [[root, null]];
  let pending: string[] = [];

  for (const line of lines) {
    if (line.kind === 'blank' || line.kind === 'comment') {
      pending.push(line.raw);
      continue;
    }
    let parent: Node;
    // Pop until top.indent < current.indent, AND we are not opening a
    // child block of the previous node.
    for (;;) {
      const top = stack[stack.length - 1];
      if (top === undefined) {
        // Unreachable: stack is seeded with root; underflow after pop
        // throws below. Guard for noUncheckedIndexedAccess.
        throw new Error(`indent underflow at line ${line.number}`);
      }
      parent = top[0];
      const fixedIndent = top[1];
      const parentIndent = parent.indent;
      if (line.indent > parentIndent) {
        // Going into a child of `parent` — validate consistent child indent.
        if (fixedIndent === null) {
          // First child sets the child indent.
          stack[stack.length - 1] = [parent, line.indent];
          break;
        }
        if (line.indent === fixedIndent) {
          break;
        }
        if (line.indent > fixedIndent) {
          throw new Error(
            `unexpected over-indent at line ${line.number} ` +
              `(parent expects ${fixedIndent}, got ${line.indent})`,
          );
        }
        // Less than fixed — pop and re-evaluate.
      }
      stack.pop();
      if (stack.length === 0) {
        throw new Error(`indent underflow at line ${line.number}`);
      }
    }
    const node = lineToNode(line);
    // Last-wins for duplicate sibling mapping keys (documented YAML
    // semantics — parser drops the earlier entry).
    if (node.key !== null) {
      for (let i = 0; i < parent.children.length; i++) {
        const sib = parent.children[i];
        if (sib !== undefined && sib.key === node.key && !sib.is_list_item) {
          parent.children.splice(i, 1);
          break;
        }
      }
    }
    parent.children.push(node);
    // Mapping nodes can have children; list items can have children only
    // if a deeper indent follows. Either way push them.
    stack.push([node, null]);
    // Re-attach pending leading.
    if (pending.length > 0) {
      node.leading = pending;
      pending = [];
    }
  }

  // Anything left over after the last content line is root trailing.
  if (pending.length > 0) {
    root.trailing = pending;
  }
  return root;
}

/** Convert a content `RawLine` into a `Node`. */
function lineToNode(line: RawLine): Node {
  if (line.kind === 'list') {
    const [rawValue, inline] = parseListLine(line.body);
    return makeNode({
      key: null,
      indent: line.indent,
      raw_value: rawValue,
      inline_comment: inline,
      is_list_item: true,
      header_line: line.raw,
      origin_line: line.number,
      line_ending: line.line_ending,
    });
  }
  // mapping line
  const [key, rawValue, inline] = parseMappingLine(line.body);
  return makeNode({
    key,
    indent: line.indent,
    raw_value: rawValue,
    inline_comment: inline,
    is_list_item: false,
    header_line: line.raw,
    origin_line: line.number,
    line_ending: line.line_ending,
  });
}

// --- Public parse / emit --------------------------------------------

/** Parse YAML `text` into a round-trip `Node` tree. */
export function parse(text: string): Node {
  if (text === '') {
    return makeNode({ indent: -1 });
  }
  return buildTree(tokenise(text));
}

/**
 * Emit a `Node` tree back to YAML text.
 *
 * For nodes that originated from parsed source, `header_line` and
 * `leading` are reproduced verbatim. Synthetic nodes (added by `merge`)
 * are rendered from their parsed fields using template-derived
 * formatting.
 */
export function emit(node: Node): string {
  const parts: string[] = [];
  emitNode(node, parts, true);
  return parts.join('');
}

function emitNode(node: Node, parts: string[], isRoot = false): void {
  if (!isRoot) {
    parts.push(...node.leading);
    if (node.header_line !== null) {
      parts.push(node.header_line);
    } else {
      parts.push(renderSyntheticHeader(node));
    }
  }
  for (const child of node.children) {
    emitNode(child, parts);
  }
  if (isRoot) {
    parts.push(...node.trailing);
  }
}

/** Render a synthetic node (no `header_line`) from parsed fields. */
function renderSyntheticHeader(node: Node): string {
  const indent = ' '.repeat(node.indent);
  const le = node.line_ending || '\n';
  let body: string;
  if (node.is_list_item) {
    body = node.raw_value === null ? `${indent}-` : `${indent}- ${node.raw_value}`;
  } else {
    body = node.raw_value === null ? `${indent}${node.key}:` : `${indent}${node.key}: ${node.raw_value}`;
  }
  if (node.inline_comment) {
    body = `${body}  ${node.inline_comment}`;
  }
  return body + le;
}

// --- Phase 3: additive merger --------------------------------------

/**
 * Additive merge of `template` into `user`.
 *
 * Walks the `template` tree in order. For every mapping key present in
 * `user` we recurse into the children. For every mapping key **missing**
 * from `user` we insert a deep copy of the template subtree (verbatim
 * `header_line` / `leading`) after the user's copy of the nearest
 * preceding template sibling; if no such sibling exists in user, the new
 * node is appended at the parent's EOF.
 *
 * Cloned template subtrees adopt the user's predominant line ending — a
 * CRLF user file stays CRLF, even when the template is LF.
 *
 * Mutates `user` in place and returns it.
 *
 * List items are treated as opaque per the Phase 3 spec — a user list
 * with content is kept verbatim; a missing list is replaced by the
 * template list.
 */
export function merge(user: Node, template: Node): Node {
  const userLe = detectEol(user);
  mergeInto(user, template, true, userLe);
  return user;
}

function mergeInto(user: Node, template: Node, isRoot = false, userLe = '\n'): void {
  const userKeys = new Map<string, Node>();
  for (const c of user.children) {
    if (c.key !== null && !c.is_list_item) {
      userKeys.set(c.key, c);
    }
  }
  for (const tmplChild of template.children) {
    if (tmplChild.key === null || tmplChild.is_list_item) {
      continue;
    }
    if (userKeys.has(tmplChild.key)) {
      const userChild = userKeys.get(tmplChild.key) as Node;
      // Only recurse when:
      // (a) the template child has children (is a section), AND
      // (b) the user child is not an explicit scalar leaf — i.e.
      //     `raw_value` is None (header-only, ready to receive children)
      //     or already has children. A user scalar like `personal: null`
      //     blocks recursion so we never inject children under a scalar
      //     header.
      if (
        tmplChild.children.length > 0 &&
        (userChild.raw_value === null || userChild.children.length > 0)
      ) {
        mergeInto(userChild, tmplChild, false, userLe);
      }
      continue;
    }
    // Missing — insert a clone of the template subtree.
    const cloned = deepcopyNode(tmplChild);
    normalizeLineEndings(cloned, userLe);
    const insertPos = findInsertPos(user, template, tmplChild);
    if (isRoot) {
      // Top-level sections need exactly one blank-line separator from the
      // preceding user content.
      ensureBlankSeparator(cloned);
    }
    user.children.splice(insertPos, 0, cloned);
    userKeys.set(tmplChild.key, cloned);
  }
}

/**
 * Index in `user.children` for `missing`.
 *
 * Collects every template sibling that appears *before* `missing` and
 * returns `max(user_index_of_each) + 1` so the new node lands after the
 * latest preceding-sibling the user file actually contains. If none
 * match, returns `user.children.length` (parent-section EOF).
 *
 * This honours user reordering: when the user reordered `a, b, c` to
 * `a, c, b` and the template adds `d` after `c`, `d` goes after `b` (the
 * latest in user order), not after `c`.
 */
function findInsertPos(user: Node, template: Node, missing: Node): number {
  const preceding = new Set<string>();
  for (const child of template.children) {
    if (child === missing) {
      break;
    }
    if (child.key !== null && !child.is_list_item) {
      preceding.add(child.key);
    }
  }
  let lastMatch = -1;
  for (let i = 0; i < user.children.length; i++) {
    const uc = user.children[i];
    if (uc !== undefined && uc.key !== null && preceding.has(uc.key) && !uc.is_list_item) {
      lastMatch = i;
    }
  }
  if (lastMatch >= 0) {
    return lastMatch + 1;
  }
  return user.children.length;
}

/** Make sure a top-level inserted node starts with one blank line. */
function ensureBlankSeparator(cloned: Node): void {
  const le = cloned.line_ending || '\n';
  if (cloned.leading.length === 0 || cloned.leading.every((line) => line.trim() !== '')) {
    cloned.leading.unshift(le);
  } else {
    // Collapse runs of leading blanks to a single blank.
    let firstBlankSeen = false;
    const kept: string[] = [];
    for (const line of cloned.leading) {
      if (line.trim() === '') {
        if (firstBlankSeen) {
          continue;
        }
        firstBlankSeen = true;
        kept.push(line);
      } else {
        kept.push(line);
      }
    }
    cloned.leading = kept;
  }
}

/**
 * Return the predominant line ending in a parsed tree.
 *
 * Falls back to `\n` when the tree is empty or the count is tied.
 */
function detectEol(node: Node): string {
  const counts: Record<string, number> = { '\n': 0, '\r\n': 0 };

  function walk(n: Node): void {
    if (n.line_ending in counts) {
      counts[n.line_ending] = (counts[n.line_ending] ?? 0) + 1;
    }
    for (const c of n.children) {
      walk(c);
    }
  }

  walk(node);
  return (counts['\r\n'] ?? 0) > (counts['\n'] ?? 0) ? '\r\n' : '\n';
}

function swapLineEnding(line: string, le: string): string {
  if (line.endsWith('\r\n')) {
    return line.slice(0, -2) + le;
  }
  if (line.endsWith('\n')) {
    return line.slice(0, -1) + le;
  }
  return line; // last line of file may have no terminator
}

/**
 * Rewrite line endings in a (cloned) subtree to `le`.
 *
 * Touches `header_line`, every entry in `leading` / `trailing`, and
 * `line_ending` itself. Recurses into children.
 */
function normalizeLineEndings(node: Node, le: string): void {
  if (node.header_line !== null) {
    node.header_line = swapLineEnding(node.header_line, le);
  }
  node.leading = node.leading.map((line) => swapLineEnding(line, le));
  node.trailing = node.trailing.map((line) => swapLineEnding(line, le));
  node.line_ending = le;
  for (const child of node.children) {
    normalizeLineEndings(child, le);
  }
}

// --- Phase 4: _user healer -----------------------------------------

/**
 * Heal legacy `_user._user.foo` corruption.
 *
 * Walks the top-level `_user:` block (if present), collects every leaf
 * scalar inside it with `_user` path segments stripped, and:
 *
 *  - **Re-homes** leaves whose stripped path exists in the `template`
 *    tree to their template location in `user` (only if the user does not
 *    already have a value there — existing user values win).
 *  - **Keeps** leaves with no template home as orphans in a rebuilt
 *    single-level `_user:` block, joining multi-segment stripped paths
 *    with `.`.
 *  - **Drops** the `_user:` block entirely when no orphans remain after
 *    re-homing.
 *
 * Mutates `user` in place and returns it. Idempotent — running twice
 * yields the same result, which the Phase 5 idempotency suite asserts.
 */
export function heal_user_block(user: Node, template: Node): Node {
  let blockIdx: number | null = null;
  for (let i = 0; i < user.children.length; i++) {
    const c = user.children[i];
    if (c !== undefined && c.key === '_user' && !c.is_list_item) {
      blockIdx = i;
      break;
    }
  }
  if (blockIdx === null) {
    return user;
  }
  const block = user.children[blockIdx] as Node;

  const leaves: Array<[string[], Node]> = [];
  collectLeaves(block, [], leaves);

  const orphans: Array<[string[], Node]> = [];
  for (const [path, leaf] of leaves) {
    if (path.length === 0) {
      continue;
    }
    if (templateHasPath(template, path)) {
      rehomeIfMissing(user, path, leaf);
    } else {
      orphans.push([path, leaf]);
    }
  }

  if (orphans.length > 0) {
    const rebuilt = makeNode({
      key: '_user',
      indent: block.indent,
      header_line: block.header_line,
      leading: [...block.leading],
      origin_line: block.origin_line,
      line_ending: block.line_ending,
    });
    const childIndent = block.indent + 2;
    for (const [path, leaf] of orphans) {
      const joined = path.join('.');
      // `header_line=null` lets `renderSyntheticHeader` produce the
      // canonical form — collapses to `key:` (no trailing space) when
      // `raw_value` is null and avoids the double-space-before-comment
      // failure of a manual f-string.
      rebuilt.children.push(
        makeNode({
          key: joined,
          indent: childIndent,
          raw_value: leaf.raw_value,
          inline_comment: leaf.inline_comment,
          line_ending: leaf.line_ending,
        }),
      );
    }
    user.children[blockIdx] = rebuilt;
  } else {
    user.children.splice(blockIdx, 1);
  }

  return user;
}

/**
 * Recursively collect leaves; `_user` segments are stripped.
 *
 * Dotted keys (`_user._user.foo.bar`) are split on `.` so each component
 * is a separate path segment — this is what lets the healer collapse a
 * single corrupted leaf whose key carries N leading `_user.` prefixes
 * accumulated by the old buggy sync.
 */
function collectLeaves(node: Node, path: string[], out: Array<[string[], Node]>): void {
  for (const child of node.children) {
    if (child.is_list_item || child.key === null) {
      continue;
    }
    const segs = child.key.includes('.') ? child.key.split('.') : [child.key];
    const stripped = segs.filter((s) => s !== '_user');
    const nextPath = [...path, ...stripped];
    if (child.children.length > 0) {
      collectLeaves(child, nextPath, out);
    } else {
      out.push([nextPath, child]);
    }
  }
}

/** True iff `path` resolves to a node in the template tree. */
function templateHasPath(template: Node, path: string[]): boolean {
  let cursor: Node | null = template;
  for (const seg of path) {
    if (cursor === null) {
      return false;
    }
    let next: Node | null = null;
    for (const c of cursor.children) {
      if (c.key === seg && !c.is_list_item) {
        next = c;
        break;
      }
    }
    cursor = next;
  }
  return cursor !== null;
}

/** Insert `leaf` at `path` in `user` if it isn't already there. */
function rehomeIfMissing(user: Node, path: string[], leaf: Node): void {
  let cursor: Node = user;
  for (let i = 0; i < path.length; i++) {
    const seg = path[i] as string;
    let existing: Node | null = null;
    for (const c of cursor.children) {
      if (c.key === seg && !c.is_list_item) {
        existing = c;
        break;
      }
    }
    const isLast = i === path.length - 1;
    if (existing === null) {
      const indent = cursor.key !== null ? cursor.indent + 2 : 0;
      // `header_line=null` defers rendering to `renderSyntheticHeader` so
      // empty-value / comment-only headers come out as `seg:` and
      // `seg:  # c` without the manual-f-string drift.
      if (isLast) {
        cursor.children.push(
          makeNode({
            key: seg,
            indent,
            raw_value: leaf.raw_value,
            inline_comment: leaf.inline_comment,
            line_ending: leaf.line_ending,
          }),
        );
      } else {
        const container = makeNode({
          key: seg,
          indent,
          line_ending: leaf.line_ending,
        });
        cursor.children.push(container);
        cursor = container;
      }
    } else {
      if (isLast) {
        return; // User already has a value here — keep it.
      }
      cursor = existing;
    }
  }
}

/**
 * Top-level sync entry-point.
 *
 * Pipeline: `parse(user_text) → heal_user_block → merge → emit`. The
 * healer runs as a pre-pass so the merger sees a tree that already has
 * legacy `_user._user.foo` corruption collapsed to its template-home or
 * orphan form.
 */
export function sync(userText: string, templateText: string): string {
  let userTree = parse(userText);
  const templateTree = parse(templateText);
  userTree = heal_user_block(userTree, templateTree);
  const merged = merge(userTree, templateTree);
  return emit(merged);
}
