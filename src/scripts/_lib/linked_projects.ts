/**
 * Detect IDE-attached sibling projects (linked-projects scope, Option A).
 *
 * TypeScript twin of `src/scripts/_lib/linked_projects.py` (ADR-096,
 * Phase 2 Wave 1 batch C). Public API mirrors the Python module exactly —
 * same exported snake_case names, same entry dict shape (`path` /
 * `detected_via` / `large`, JSON-identical), same parsing tolerances.
 *
 * Pure, dependency-free detector. Reads on-disk IDE config the developer
 * already created by attaching a sibling repo, and returns the sibling
 * project roots that sit *outside* the current project. Config-driven only
 * — never guesses from arbitrary adjacent directories.
 *
 * Sources:
 * - PhpStorm / IntelliJ — `.idea/modules.xml` (`<module fileurl>`) and
 *   `.idea/vcs.xml` (`<mapping directory>`).
 * - VS Code — `*.code-workspace` (`folders[].path`).
 *
 * Guardrails (per the linked-projects council, Option A):
 * - a candidate must resolve OUTSIDE the project root, exist, and contain
 *   a `.git/` directory;
 * - a candidate whose file count exceeds `max_files` (default 20000) is
 *   **flagged** `large: true` — NOT excluded. Under Option A the agent
 *   only carries a passive awareness note and never bulk-includes sibling
 *   files, so repo size is cost-irrelevant to detection; a real frontend
 *   repo routinely exceeds 20000 files (excluding node_modules) and must
 *   still be surfaced. The flag lets the awareness note say "large repo —
 *   check targeted impact, do not scan the whole tree";
 * - the bloat directories `node_modules`/`.git`/`dist`/`build`/`.venv`/
 *   `target` are never descended into while counting.
 *
 * The detector returns awareness candidates; it does NOT include any
 * sibling files in context and does NOT persist anything. Opt-in +
 * persistence is the caller's job.
 *
 * Note on logging: the Python original emits `logger.info(...)` diagnostics
 * which are silent under the default logging configuration. The TS twin
 * omits them — observable behavior (return value) is identical.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/** File-count ceiling above which a sibling is flagged (token-blowup guard). */
export const DEFAULT_MAX_FILES = 20000;

/** Directories never descended into while counting a sibling's size. */
export const SKIP_DIRS: ReadonlySet<string> = new Set([
    'node_modules',
    '.git',
    'dist',
    'build',
    '.venv',
    'target',
    '.idea',
]);

/** One detected sibling — serializes to the same JSON as the Python dict. */
export interface LinkedProjectEntry {
    path: string;
    detected_via: string;
    large: boolean;
}

/**
 * Return IDE-attached sibling projects outside `project_root`.
 *
 * Each entry is `{ path: <absolute string>, detected_via: <source>,
 * large: <bool> }` where source is one of `phpstorm_modules` /
 * `phpstorm_vcs` / `vscode_workspace` and `large` is true when the
 * sibling's file count (excluding bloat dirs) exceeds `max_files`.
 * Results are de-duplicated by resolved path (first source wins) and
 * sorted by path. Size never excludes — see the module doc comment.
 */
export function detect_linked_projects(
    project_root: string,
    opts: { max_files?: number } = {},
): LinkedProjectEntry[] {
    const max_files = opts.max_files ?? DEFAULT_MAX_FILES;
    const root = _resolve_path(project_root);
    if (!_is_dir(root)) {
        return [];
    }

    const candidates: Array<readonly [string, string]> = [];
    for (const p of _phpstorm_modules(root)) {
        candidates.push([p, 'phpstorm_modules']);
    }
    for (const p of _phpstorm_vcs(root)) {
        candidates.push([p, 'phpstorm_vcs']);
    }
    for (const p of _vscode_workspace(root)) {
        candidates.push([p, 'vscode_workspace']);
    }

    const seen = new Set<string>();
    const out: LinkedProjectEntry[] = [];
    for (const [candidatePath, source] of candidates) {
        // Mirrors `path.resolve()` in the Python loop — `_resolve_path`
        // never throws, so the Python OSError-skip path is unreachable here.
        const resolved = _resolve_path(candidatePath);
        if (seen.has(resolved)) {
            continue;
        }
        if (!_is_valid_sibling(resolved, root)) {
            continue;
        }
        const large = _exceeds_size(resolved, max_files);
        seen.add(resolved);
        out.push({ path: resolved, detected_via: source, large });
    }

    out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    return out;
}

/** A sibling must be outside the project root, exist, and be a git repo. */
function _is_valid_sibling(candidate: string, root: string): boolean {
    try {
        if (candidate === root || _is_ancestor(root, candidate)) {
            return false; // inside the project — that's the module system's job
        }
        if (_is_ancestor(candidate, root)) {
            return false; // an ancestor of the project, not a sibling
        }
        if (!_is_dir(candidate)) {
            return false;
        }
        if (!fs.existsSync(path.join(candidate, '.git'))) {
            return false;
        }
    } catch {
        return false;
    }
    return true;
}

/** True if the tree (minus SKIP_DIRS) holds more than `max_files` files. */
function _exceeds_size(candidate: string, max_files: number): boolean {
    // Mirrors os.walk(followlinks=False): symlinked directories are counted
    // as directories (never as files) but are not descended into; unreadable
    // directories are skipped silently (os.walk onerror=None).
    let count = 0;
    const stack: string[] = [candidate];
    while (stack.length > 0) {
        const dir = stack.pop() as string;
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const entry of entries) {
            let isDir = entry.isDirectory();
            if (!isDir && entry.isSymbolicLink()) {
                try {
                    isDir = fs.statSync(path.join(dir, entry.name)).isDirectory();
                } catch {
                    isDir = false;
                }
            }
            if (isDir) {
                if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) {
                    stack.push(path.join(dir, entry.name));
                }
            } else {
                count += 1;
                if (count > max_files) {
                    return true;
                }
            }
        }
    }
    return false;
}

/** Sibling roots from `.idea/modules.xml` `<module fileurl>` entries. */
function _phpstorm_modules(root: string): string[] {
    const filePath = path.join(root, '.idea', 'modules.xml');
    const elems = _iter_xml_attrs(filePath, 'module');
    const out: string[] = [];
    for (const attrs of elems) {
        const raw = attrs['fileurl'] || attrs['filepath'];
        if (!raw) {
            continue;
        }
        const resolved = _resolve_idea_url(raw, root);
        if (resolved === null) {
            continue;
        }
        // raw points at <sibling>/.idea/<name>.iml → sibling is .idea's parent.
        if (path.basename(path.dirname(resolved)) === '.idea') {
            out.push(path.dirname(path.dirname(resolved)));
        } else {
            out.push(resolved);
        }
    }
    return out;
}

/** Sibling roots from `.idea/vcs.xml` `<mapping directory>` entries. */
function _phpstorm_vcs(root: string): string[] {
    const filePath = path.join(root, '.idea', 'vcs.xml');
    const out: string[] = [];
    for (const attrs of _iter_xml_attrs(filePath, 'mapping')) {
        const raw = attrs['directory'];
        if (!raw) {
            continue;
        }
        const resolved = _resolve_idea_url(raw, root);
        if (resolved !== null) {
            out.push(resolved);
        }
    }
    return out;
}

/** Sibling roots from `*.code-workspace` `folders[].path` entries. */
function _vscode_workspace(root: string): string[] {
    const out: string[] = [];
    let names: string[];
    try {
        names = fs.readdirSync(root);
    } catch {
        return out;
    }
    // Mirrors sorted(root.glob("*.code-workspace")) — pathlib's `*` matches
    // hidden names too, so a plain suffix filter is equivalent.
    const workspaces = names.filter((n) => n.endsWith('.code-workspace')).sort();
    for (const ws of workspaces) {
        const data = _read_jsonc(path.join(root, ws));
        if (typeof data !== 'object' || data === null || Array.isArray(data)) {
            continue;
        }
        const folders = (data as Record<string, unknown>)['folders'];
        if (!Array.isArray(folders)) {
            continue;
        }
        for (const folder of folders) {
            if (typeof folder !== 'object' || folder === null || Array.isArray(folder)) {
                continue;
            }
            const rel = (folder as Record<string, unknown>)['path'];
            if (typeof rel !== 'string' || !rel.trim()) {
                continue;
            }
            // Mirrors (root / rel).resolve() — absolute rel replaces root.
            out.push(_resolve_path(path.resolve(root, rel)));
        }
    }
    return out;
}

/** Resolve a PhpStorm path token to an absolute path string, or null. */
function _resolve_idea_url(raw: string, root: string): string | null {
    let value = raw.trim();
    if (value.startsWith('file://')) {
        value = value.slice('file://'.length);
    }
    value = value.replaceAll('$PROJECT_DIR$', root);
    if (!value) {
        return null;
    }
    // path.resolve handles both the absolute and the root-relative branch
    // of the Python original; _resolve_path never throws (the Python
    // OSError → None branch maps to the lexical fallback inside it).
    return _resolve_path(path.resolve(root, value));
}

/**
 * Non-strict symlink-resolving path normalization, mirroring Python's
 * `Path.resolve()` (strict=False): resolve symlinks for the existing
 * prefix of the path and append the non-existing remainder.
 */
function _resolve_path(p: string): string {
    const abs = path.resolve(p);
    try {
        return fs.realpathSync(abs);
    } catch {
        // fall through to prefix resolution
    }
    let cur = abs;
    const tail: string[] = [];
    for (;;) {
        const parent = path.dirname(cur);
        if (parent === cur) {
            return abs; // reached the filesystem root without resolving
        }
        tail.push(path.basename(cur));
        cur = parent;
        try {
            const real = fs.realpathSync(cur);
            return path.join(real, ...tail.slice().reverse());
        } catch {
            // keep walking up
        }
    }
}

function _is_dir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _is_file(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** True when `descendant` lives strictly inside `ancestor`. */
function _is_ancestor(ancestor: string, descendant: string): boolean {
    const prefix = ancestor.endsWith(path.sep) ? ancestor : ancestor + path.sep;
    return descendant !== ancestor && descendant.startsWith(prefix);
}

/** Return the attribute dicts of every `<tag>` in `path` (tolerant). */
function _iter_xml_attrs(filePath: string, tag: string): Array<Record<string, string>> {
    if (!_is_file(filePath)) {
        return [];
    }
    let text: string;
    try {
        text = fs.readFileSync(filePath, 'utf-8');
    } catch {
        return [];
    }
    try {
        return _scan_xml_attrs(text, tag);
    } catch {
        // Mirrors ET.ParseError handling: malformed file → no entries.
        return [];
    }
}

/** Parse JSON that may carry `//` comments and trailing commas (VS Code). */
function _read_jsonc(filePath: string): unknown {
    let text: string;
    try {
        text = fs.readFileSync(filePath, 'utf-8');
    } catch {
        return null;
    }
    try {
        return JSON.parse(text) as unknown;
    } catch {
        // tolerant fallback below
    }
    // tolerant fallback: strip line comments + trailing commas, retry once.
    let stripped = text.replace(/^\s*\/\/.*$/gm, '');
    stripped = stripped.replace(/,(\s*[}\]])/g, '$1');
    try {
        return JSON.parse(stripped) as unknown;
    } catch {
        return null;
    }
}

/* ------------------------------------------------------------------ */
/* Minimal well-formed-XML attribute scanner.                          */
/*                                                                     */
/* The Python original parses with xml.etree.ElementTree and treats    */
/* any ParseError as "no entries". Rather than pull in an XML          */
/* dependency, this scanner tokenizes the document, enforces the       */
/* well-formedness rules ET relies on for the IDE-config input domain  */
/* (balanced tags, single root, quoted attributes, valid entities, no  */
/* duplicate attributes, no stray text outside the root), and collects */
/* the attribute dicts of every element whose tag name matches.        */
/* Tolerance gaps vs. ET are documented as divergence candidates in    */
/* the porting report.                                                 */
/* ------------------------------------------------------------------ */

class XmlScanError extends Error {}

const _XML_NAME = /^[A-Za-z_:][A-Za-z0-9_.:-]*/;

function _decode_xml_entities(value: string): string {
    let out = '';
    let i = 0;
    while (i < value.length) {
        const ch = value[i] as string;
        if (ch !== '&') {
            out += ch;
            i += 1;
            continue;
        }
        const rest = value.slice(i);
        const m = /^&(#x[0-9a-fA-F]+|#[0-9]+|lt|gt|amp|quot|apos);/.exec(rest);
        if (m === null) {
            throw new XmlScanError(`bare or undefined entity at ${i}`);
        }
        const body = m[1] as string;
        if (body === 'lt') {
            out += '<';
        } else if (body === 'gt') {
            out += '>';
        } else if (body === 'amp') {
            out += '&';
        } else if (body === 'quot') {
            out += '"';
        } else if (body === 'apos') {
            out += "'";
        } else if (body.startsWith('#x')) {
            out += String.fromCodePoint(Number.parseInt(body.slice(2), 16));
        } else {
            out += String.fromCodePoint(Number.parseInt(body.slice(1), 10));
        }
        i += m[0].length;
    }
    return out;
}

/**
 * Tokenize `text` as XML, validate well-formedness, and return the
 * attribute dict of every element named `tag` in document order
 * (matching `ElementTree.iter(tag)`). Throws XmlScanError on input
 * ElementTree would reject for the supported construct set.
 */
function _scan_xml_attrs(text: string, tag: string): Array<Record<string, string>> {
    let src = text;
    if (src.startsWith('\uFEFF')) {
        src = src.slice(1);
    }
    const out: Array<Record<string, string>> = [];
    const stack: string[] = [];
    let seenRoot = false;
    let rootClosed = false;
    let i = 0;

    while (i < src.length) {
        const lt = src.indexOf('<', i);
        if (lt === -1) {
            _check_text(src.slice(i), stack);
            i = src.length;
            break;
        }
        if (lt > i) {
            _check_text(src.slice(i, lt), stack);
        }
        if (src.startsWith('<?', lt)) {
            const end = src.indexOf('?>', lt + 2);
            if (end === -1) {
                throw new XmlScanError('unterminated processing instruction');
            }
            i = end + 2;
            continue;
        }
        if (src.startsWith('<!--', lt)) {
            const end = src.indexOf('-->', lt + 4);
            if (end === -1) {
                throw new XmlScanError('unterminated comment');
            }
            i = end + 3;
            continue;
        }
        if (src.startsWith('<![CDATA[', lt)) {
            if (stack.length === 0) {
                throw new XmlScanError('CDATA outside the root element');
            }
            const end = src.indexOf(']]>', lt + 9);
            if (end === -1) {
                throw new XmlScanError('unterminated CDATA section');
            }
            i = end + 3;
            continue;
        }
        if (src.startsWith('<!', lt)) {
            // DOCTYPE — only legal before the root element. Bracket-aware
            // scan for the closing '>' to survive an internal subset.
            if (seenRoot) {
                throw new XmlScanError('declaration after the root element');
            }
            let depth = 0;
            let j = lt + 2;
            for (; j < src.length; j += 1) {
                const c = src[j];
                if (c === '[') {
                    depth += 1;
                } else if (c === ']') {
                    depth -= 1;
                } else if (c === '>' && depth <= 0) {
                    break;
                }
            }
            if (j >= src.length) {
                throw new XmlScanError('unterminated doctype declaration');
            }
            i = j + 1;
            continue;
        }
        if (src.startsWith('</', lt)) {
            const end = src.indexOf('>', lt + 2);
            if (end === -1) {
                throw new XmlScanError('unterminated end tag');
            }
            const name = src.slice(lt + 2, end).trim();
            if (stack.length === 0 || stack[stack.length - 1] !== name) {
                throw new XmlScanError(`mismatched end tag </${name}>`);
            }
            stack.pop();
            if (stack.length === 0) {
                rootClosed = true;
            }
            i = end + 1;
            continue;
        }
        // Start tag (or self-closing element).
        if (rootClosed) {
            throw new XmlScanError('junk after document element');
        }
        const parsed = _parse_start_tag(src, lt);
        if (stack.length === 0 && seenRoot) {
            throw new XmlScanError('multiple root elements');
        }
        seenRoot = true;
        if (parsed.name === tag) {
            out.push(parsed.attrs);
        }
        if (!parsed.selfClosing) {
            stack.push(parsed.name);
        } else if (stack.length === 0) {
            rootClosed = true;
        }
        i = parsed.end;
    }

    if (stack.length > 0) {
        throw new XmlScanError('unclosed element at end of document');
    }
    if (!seenRoot) {
        throw new XmlScanError('no element found');
    }
    return out;
}

/** Validate character data: entities must be well-formed; no stray '<';
 *  non-whitespace text is illegal outside the root element. */
function _check_text(chunk: string, stack: readonly string[]): void {
    if (stack.length === 0 && chunk.trim() !== '') {
        throw new XmlScanError('text outside the root element');
    }
    _decode_xml_entities(chunk); // throws on bare '&' / undefined entities
}

function _parse_start_tag(
    src: string,
    lt: number,
): { name: string; attrs: Record<string, string>; selfClosing: boolean; end: number } {
    let i = lt + 1;
    const nameMatch = _XML_NAME.exec(src.slice(i));
    if (nameMatch === null) {
        throw new XmlScanError(`invalid tag name at ${i}`);
    }
    const name = nameMatch[0];
    i += name.length;
    const attrs: Record<string, string> = {};
    for (;;) {
        while (i < src.length && /\s/.test(src[i] as string)) {
            i += 1;
        }
        if (i >= src.length) {
            throw new XmlScanError('unterminated start tag');
        }
        const ch = src[i] as string;
        if (ch === '>') {
            return { name, attrs, selfClosing: false, end: i + 1 };
        }
        if (ch === '/') {
            if (src[i + 1] !== '>') {
                throw new XmlScanError("expected '>' after '/' in start tag");
            }
            return { name, attrs, selfClosing: true, end: i + 2 };
        }
        const attrMatch = _XML_NAME.exec(src.slice(i));
        if (attrMatch === null) {
            throw new XmlScanError(`invalid attribute name at ${i}`);
        }
        const attrName = attrMatch[0];
        i += attrName.length;
        while (i < src.length && /\s/.test(src[i] as string)) {
            i += 1;
        }
        if (src[i] !== '=') {
            throw new XmlScanError(`attribute '${attrName}' without value`);
        }
        i += 1;
        while (i < src.length && /\s/.test(src[i] as string)) {
            i += 1;
        }
        const quote = src[i];
        if (quote !== '"' && quote !== "'") {
            throw new XmlScanError(`unquoted attribute value for '${attrName}'`);
        }
        i += 1;
        const closing = src.indexOf(quote, i);
        if (closing === -1) {
            throw new XmlScanError(`unterminated attribute value for '${attrName}'`);
        }
        const rawValue = src.slice(i, closing);
        if (rawValue.includes('<')) {
            throw new XmlScanError(`'<' in attribute value for '${attrName}'`);
        }
        if (Object.prototype.hasOwnProperty.call(attrs, attrName)) {
            throw new XmlScanError(`duplicate attribute '${attrName}'`);
        }
        attrs[attrName] = _decode_xml_entities(rawValue);
        i = closing + 1;
    }
}
