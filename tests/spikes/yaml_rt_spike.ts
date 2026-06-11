/**
 * SPIKE — TypeScript port of the core round-trip property of
 * `src/scripts/sync_yaml_rt.py` (parse + emit only).
 *
 * This is NOT the production port (that is Phase 5 of
 * agents/roadmaps/road-to-typescript-only-scripts.md). It exists to prove
 * that the self-contained, stdlib-only Python parser ports 1:1 to
 * TypeScript with the user-line-preservation property intact:
 * every line that `parse` attaches to a node is reproduced
 * character-for-character by `emit`.
 *
 * Ported subset (mirrors the Python module docstring):
 *   - block mappings, 2- or 4-space indent (tabs in indent -> Error)
 *   - bare / single- / double-quoted scalars, kept verbatim
 *   - block lists (`- foo`), inline flat lists (`[a, b, c]`)
 *   - `#` comments (full-line + inline), preserved verbatim
 *   - blank lines, preserved verbatim
 *   - CRLF and LF line endings, preserved per-line
 *   - duplicate keys at the same level: last wins (earlier line and
 *     its leading block are dropped — same as Python)
 *
 * NOT ported (out of spike scope, identical to Python's unsupported
 * list): anchors/aliases, nested flow mappings, `?`-keys, multi-doc,
 * tagged scalars, multiline scalars (`|` / `>`), merge/heal/sync.
 */

// --- Public node -----------------------------------------------------

export interface RtNode {
  /** Parsed identity (used by merge/heal in the production port). */
  key: string | null;
  indent: number;
  rawValue: string | null;
  inlineComment: string | null;
  isListItem: boolean;

  /** Verbatim source pieces (used by emit). */
  leading: string[];
  headerLine: string | null;
  trailing: string[];

  /** Tree. */
  children: RtNode[];

  /** Provenance. */
  originLine: number | null;
  lineEnding: string;
}

function makeNode(partial: Partial<RtNode> = {}): RtNode {
  return {
    key: null,
    indent: 0,
    rawValue: null,
    inlineComment: null,
    isListItem: false,
    leading: [],
    headerLine: null,
    trailing: [],
    children: [],
    originLine: null,
    lineEnding: '\n',
    ...partial,
  };
}

// --- Tokeniser --------------------------------------------------------

type LineKind = 'blank' | 'comment' | 'mapping' | 'list';

interface RawLine {
  number: number; // 1-based
  raw: string; // full line including line ending
  lineEnding: string; // "\n" | "\r\n" | "\r" | "" (last line, no terminator)
  body: string; // raw without line ending
  indent: number; // number of leading spaces
  kind: LineKind;
}

/** Split text into lines, keeping line endings (mirrors splitlines(keepends=True) for \n, \r\n, \r). */
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
      // Unreachable: idx < rawLines.length. Explicit guard for
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
    // Tabs in indent are an error — compute the leading-whitespace span
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
    out.push({ number: i, raw, lineEnding: le, body, indent, kind });
  }
  return out;
}

// --- Scalar parsing ---------------------------------------------------

function rstripSpacesTabs(s: string): string {
  return s.replace(/[ \t]+$/, '');
}

/**
 * Split `value  # comment` into `[value, comment]`, honouring quoted-
 * string boundaries so a `#` inside quotes is not a comment delimiter.
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
      if (i === 0 || valuePart[i - 1] === ' ' || valuePart[i - 1] === '\t') {
        const valueText = rstripSpacesTabs(valuePart.slice(0, i));
        const commentText = valuePart.slice(i);
        return [valueText, commentText];
      }
    }
  }
  return [rstripSpacesTabs(valuePart) || '', null];
}

/** Split `  key: value  # c` into `[key, rawValue, inlineComment]`. */
function parseMappingLine(body: string): [string, string | null, string | null] {
  const stripped = body.replace(/^ +/, '');
  let rawKey: string;
  let rest: string;
  let key: string;
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
      throw new Error(`missing ':' in mapping line: ${JSON.stringify(stripped)}`);
    }
    rawKey = stripped.slice(0, colon);
    rest = stripped.slice(colon);
    key = rawKey;
  }
  if (rest.startsWith(':')) {
    rest = rest.slice(1);
  } else if (rest.startsWith(' :') || rest.startsWith('\t:')) {
    rest = rest.replace(/^[ \t]+/, '').slice(1);
  } else if (rest.replace(/^\s+/, '').startsWith(':')) {
    rest = rest.replace(/^\s+/, '').slice(1);
  } else {
    throw new Error(`missing ':' after key ${JSON.stringify(rawKey)}: rest=${JSON.stringify(rest)}`);
  }
  const restText = rest.replace(/^[ \t]+/, '');
  if (restText === '') {
    return [key, null, null];
  }
  if (restText.startsWith('#')) {
    return [key, null, restText];
  }
  const [rawValue, comment] = splitInlineComment(restText);
  return [key, rawValue, comment];
}

/** `- value  # c` -> `[rawValue, inlineComment]`; bare `-` yields `[null, null]`. */
function parseListLine(body: string): [string | null, string | null] {
  const stripped = body.replace(/^ +/, '');
  if (stripped !== '-' && !stripped.startsWith('- ')) {
    throw new Error(`not a list line: ${JSON.stringify(body)}`);
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

// --- Tree builder -----------------------------------------------------

function lineToNode(line: RawLine): RtNode {
  if (line.kind === 'list') {
    const [rawValue, inline] = parseListLine(line.body);
    return makeNode({
      key: null,
      indent: line.indent,
      rawValue,
      inlineComment: inline,
      isListItem: true,
      headerLine: line.raw,
      originLine: line.number,
      lineEnding: line.lineEnding,
    });
  }
  const [key, rawValue, inline] = parseMappingLine(line.body);
  return makeNode({
    key,
    indent: line.indent,
    rawValue,
    inlineComment: inline,
    isListItem: false,
    headerLine: line.raw,
    originLine: line.number,
    lineEnding: line.lineEnding,
  });
}

function buildTree(lines: RawLine[]): RtNode {
  const root = makeNode({ indent: -1 });
  // stack: [parentNode, childIndentOrNull]
  const stack: Array<[RtNode, number | null]> = [[root, null]];
  let pending: string[] = [];

  for (const line of lines) {
    if (line.kind === 'blank' || line.kind === 'comment') {
      pending.push(line.raw);
      continue;
    }
    let parent: RtNode;
    // Pop until top.indent < current.indent, AND we are not opening a
    // child block of the previous node.
    for (;;) {
      const top = stack[stack.length - 1];
      if (top === undefined) {
        // Unreachable: stack is never empty here (seeded with root;
        // underflow after pop throws below). Guard for
        // noUncheckedIndexedAccess.
        throw new Error(`indent underflow at line ${line.number}`);
      }
      parent = top[0];
      const fixedIndent = top[1];
      if (line.indent > parent.indent) {
        if (fixedIndent === null) {
          // First content child sets the child indent.
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
        if (sib !== undefined && sib.key === node.key && !sib.isListItem) {
          parent.children.splice(i, 1);
          break;
        }
      }
    }
    parent.children.push(node);
    stack.push([node, null]);
    if (pending.length > 0) {
      node.leading = pending;
      pending = [];
    }
  }

  if (pending.length > 0) {
    root.trailing = pending;
  }
  return root;
}

// --- Public parse / emit ----------------------------------------------

/** Parse YAML text into a round-trip node tree. */
export function parse(text: string): RtNode {
  if (text === '') {
    return makeNode({ indent: -1 });
  }
  return buildTree(tokenise(text));
}

function renderSyntheticHeader(node: RtNode): string {
  const indent = ' '.repeat(node.indent);
  const le = node.lineEnding || '\n';
  let body: string;
  if (node.isListItem) {
    body = node.rawValue === null ? `${indent}-` : `${indent}- ${node.rawValue}`;
  } else {
    body = node.rawValue === null ? `${indent}${node.key}:` : `${indent}${node.key}: ${node.rawValue}`;
  }
  if (node.inlineComment) {
    body = `${body}  ${node.inlineComment}`;
  }
  return body + le;
}

function emitNode(node: RtNode, parts: string[], isRoot = false): void {
  if (!isRoot) {
    parts.push(...node.leading);
    parts.push(node.headerLine !== null ? node.headerLine : renderSyntheticHeader(node));
  }
  for (const child of node.children) {
    emitNode(child, parts);
  }
  if (isRoot) {
    parts.push(...node.trailing);
  }
}

/** Emit a node tree back to YAML text — round-trip property. */
export function emit(node: RtNode): string {
  const parts: string[] = [];
  emitNode(node, parts, true);
  return parts.join('');
}

/** Convenience: parse + emit in one step. */
export function roundTrip(text: string): string {
  return emit(parse(text));
}
