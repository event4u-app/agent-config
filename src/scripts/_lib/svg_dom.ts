/**
 * svg_dom — a dependency-free XML well-formedness parser, and the tree it
 * builds.
 *
 * Step 3.1 of `road-to-svg-review-followups`, amending step 1.1 of
 * `road-to-svg-with-a-witness`. Review claim C11: a regex cannot prove nesting
 * or resolve a reference, and the alternatives were all refused for reasons
 * that still hold — `package.json`'s runtime dependencies carry no XML parser,
 * `happy-dom` is dev-only, the three vendored tree-sitter grammars are php,
 * typescript and javascript, and Playwright is absent in a consumer, so the
 * browser cannot carry a static layer. The remaining option is to write one,
 * which is what `lint_design_quality` already does for its own surface.
 *
 * WHAT IT IS. One scanner over the bytes, producing every node kind an SVG
 * carries — elements with their attributes, comments, CDATA sections,
 * processing instructions, DOCTYPEs and text — each with a line and a column,
 * assembled into a tree with parent links, plus a list of well-formedness
 * errors.
 *
 * TWO SCANNERS, NOT ONE, and this header used to claim otherwise.
 * `parseElements` in `svg_rules.ts` is an independent scanner over the same
 * bytes, so the two CAN disagree about what a file contains — finding 3 of the
 * third completion review of this change found a case where they did, and the
 * disagreement produced an error-severity false positive. That one is fixed
 * where it was (the prolog), but the general claim was false and is not
 * restored: a reader deciding whether a fix here also lands there must check,
 * not assume. Merging them is a larger change than the finding asked for and
 * is not attempted under a remediation.
 *
 * WHAT IT IS NOT. Not a validating parser, not namespace-aware beyond keeping
 * the prefix in the name, and it does not expand entities. It reports that a
 * file is not well-formed; it does not report which schema it violates.
 *
 * WHY A FILE THAT IS NOT WELL-FORMED IS A FINDING RATHER THAN A SKIPPED FILE.
 * A skipped file reads as a clean one in every count that matters, and the
 * shape this exists to catch — `<g><path></g></path>` — is exactly the shape a
 * flat element list cannot see: both tags are present, both are spelled
 * correctly, and the document is nonetheless not a tree.
 */

/** Node kinds, in the order a reader meets them in a file. */
export type XmlNodeKind = 'element' | 'text' | 'comment' | 'cdata' | 'pi' | 'doctype';

export interface XmlNode {
    kind: XmlNodeKind;
    /** Element name, lowercased. Empty for every other kind. */
    name: string;
    /** Element attributes, lowercased keys. Empty for every other kind. */
    attrs: Record<string, string>;
    /** 1-based line of the node's first character. */
    line: number;
    /** 1-based column of the node's first character. */
    column: number;
    /** Character offset of the node's first character. */
    start: number;
    /** Comment body, CDATA body, PI body, DOCTYPE body, or text content. */
    value: string;
    children: XmlNode[];
    /** `null` for a node at document level. */
    parent: XmlNode | null;
}

export interface XmlError {
    message: string;
    line: number;
    column: number;
}

export interface XmlDocument {
    /** Document-level nodes, in order. An SVG normally has one element root. */
    roots: XmlNode[];
    /** Every element node, in document order — the flat view, same objects. */
    elements: XmlNode[];
    errors: XmlError[];
}

/** 1-based line and column of an offset. Built once per parse. */
function positions(content: string): (offset: number) => { line: number; column: number } {
    const starts: number[] = [0];
    for (let i = 0; i < content.length; i += 1) {
        if (content[i] === '\n') starts.push(i + 1);
    }
    return (offset: number) => {
        // Binary search for the last line start at or before `offset`.
        let lo = 0;
        let hi = starts.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if ((starts[mid] as number) <= offset) lo = mid;
            else hi = mid - 1;
        }
        return { line: lo + 1, column: offset - (starts[lo] as number) + 1 };
    };
}

/**
 * End of the tag, honouring quoted attribute values that may contain `>`.
 *
 * Exported because `svg_rules.parseElements` scans the same bytes and had its
 * own byte-identical copy — finding 9 of the third completion review, which
 * also noted that BOTH copies ship in the per-`.svg`-write hook chunk. Two
 * scanners is a fact this file's header now states plainly; two copies of
 * their shared primitives is not a consequence of it.
 */
export function tagEnd(content: string, from: number): number {
    let quote: string | null = null;
    for (let i = from + 1; i < content.length; i += 1) {
        const ch = content[i] as string;
        if (quote !== null) {
            if (ch === quote) quote = null;
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            continue;
        }
        if (ch === '>') return i;
    }
    return -1;
}

/** Attributes of one tag, lowercased keys. Shared with `svg_rules` — see `tagEnd`. */
export function attrsOf(raw: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const re = /([A-Za-z_:][\w.:-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        const key = (m[1] ?? '').toLowerCase();
        const value = m[3] ?? m[4] ?? '';
        attrs[key] = value.replace(/&amp;/g, '&');
    }
    return attrs;
}

/**
 * Parse one document.
 *
 * Never throws: a malformed file produces whatever tree could be built plus
 * the errors that explain it. A parser that threw would make an unparseable
 * file indistinguishable from a crash, and the caller's job is to REPORT the
 * file, not to fall over on it.
 */
export function parseDocument(content: string): XmlDocument {
    const at = positions(content);
    const roots: XmlNode[] = [];
    const elements: XmlNode[] = [];
    const errors: XmlError[] = [];
    const stack: XmlNode[] = [];

    const make = (kind: XmlNodeKind, start: number, name = '', value = '', attrs: Record<string, string> = {}): XmlNode => {
        const { line, column } = at(start);
        return { kind, name, attrs, line, column, start, value, children: [], parent: null };
    };
    const append = (node: XmlNode): void => {
        const parent = stack[stack.length - 1];
        if (parent === undefined) {
            roots.push(node);
        } else {
            node.parent = parent;
            parent.children.push(node);
        }
    };

    let i = 0;
    while (i < content.length) {
        const lt = content.indexOf('<', i);
        if (lt === -1) {
            const rest = content.slice(i);
            if (rest.trim() !== '') append(make('text', i, '', rest));
            break;
        }
        if (lt > i) {
            const text = content.slice(i, lt);
            if (text.trim() !== '') append(make('text', i, '', text));
        }

        if (content.startsWith('<!--', lt)) {
            const end = content.indexOf('-->', lt + 4);
            if (end === -1) {
                const p = at(lt);
                errors.push({ message: 'unterminated comment', line: p.line, column: p.column });
                append(make('comment', lt, '', content.slice(lt + 4)));
                break;
            }
            append(make('comment', lt, '', content.slice(lt + 4, end)));
            i = end + 3;
            continue;
        }
        if (content.startsWith('<![CDATA[', lt)) {
            const end = content.indexOf(']]>', lt + 9);
            if (end === -1) {
                const p = at(lt);
                errors.push({ message: 'unterminated CDATA section', line: p.line, column: p.column });
                append(make('cdata', lt, '', content.slice(lt + 9)));
                break;
            }
            append(make('cdata', lt, '', content.slice(lt + 9, end)));
            i = end + 3;
            continue;
        }
        if (content.startsWith('<?', lt)) {
            const end = content.indexOf('?>', lt + 2);
            if (end === -1) {
                // Finding 11 of this change's completion review: this and the
                // declaration below swallowed the rest of the document into one
                // node and returned cleanly, so a file ending in
                // `<?xml version="1.0"` read as WELL-FORMED — a skip, under a
                // contract whose whole point is that a file which does not
                // parse is a finding rather than a skipped file.
                const p = at(lt);
                errors.push({ message: 'unterminated processing instruction', line: p.line, column: p.column });
            }
            const stop = end === -1 ? content.length : end + 2;
            append(make('pi', lt, '', content.slice(lt + 2, end === -1 ? content.length : end)));
            i = stop;
            continue;
        }
        if (content.startsWith('<!', lt)) {
            // A DOCTYPE may carry a bracketed internal subset; it ends after it.
            const bracket = content.indexOf('[', lt);
            const close = content.indexOf('>', lt);
            let stop: number;
            if (bracket !== -1 && close !== -1 && bracket < close) {
                const endBracket = content.indexOf(']', bracket);
                const after = endBracket === -1 ? close : content.indexOf('>', endBracket);
                stop = after === -1 ? content.length : after + 1;
            } else {
                stop = close === -1 ? content.length : close + 1;
            }
            if (close === -1) {
                const p = at(lt);
                errors.push({ message: 'unterminated declaration', line: p.line, column: p.column });
            }
            append(make('doctype', lt, '', content.slice(lt + 2, Math.max(lt + 2, stop - 1))));
            i = stop;
            continue;
        }

        const gt = tagEnd(content, lt);
        if (gt === -1) {
            const p = at(lt);
            errors.push({ message: 'unterminated tag', line: p.line, column: p.column });
            break;
        }
        const raw = content.slice(lt, gt + 1);
        const nameMatch = /^<\/?\s*([A-Za-z_][\w.:-]*)/.exec(raw);
        if (!nameMatch) {
            // Finding 11, third case: a `<` that opens something with no legal
            // element name is malformed markup, not whitespace. Skipping it
            // silently is the same skip the other two were.
            const p = at(lt);
            errors.push({ message: `"${raw.slice(0, 24)}" is not a tag`, line: p.line, column: p.column });
            i = gt + 1;
            continue;
        }
        const name = (nameMatch[1] ?? '').toLowerCase();
        const closing = raw.startsWith('</');
        const selfClosing = raw.endsWith('/>');

        if (closing) {
            const open = stack[stack.length - 1];
            const p = at(lt);
            if (open === undefined) {
                errors.push({ message: `closing tag </${name}> with no open element`, line: p.line, column: p.column });
            } else if (open.name !== name) {
                // The shape a flat element list cannot see. Reported against
                // the CLOSING tag, which is where a reader looking at the file
                // sees the problem.
                errors.push({
                    message: `closing tag </${name}> does not match the open <${open.name}> (line ${String(open.line)})`,
                    line: p.line,
                    column: p.column,
                });
                // Recover by popping to the matching open element when there is
                // one, so a single mistake does not cascade into an error per
                // remaining tag.
                const idx = stack.map((n) => n.name).lastIndexOf(name);
                if (idx !== -1) stack.length = idx;
                else stack.pop();
            } else {
                stack.pop();
            }
            i = gt + 1;
            continue;
        }

        const node = make('element', lt, name, '', attrsOf(raw));
        append(node);
        elements.push(node);
        if (!selfClosing) stack.push(node);
        i = gt + 1;
    }

    for (const unclosed of stack) {
        errors.push({
            message: `<${unclosed.name}> is never closed`,
            line: unclosed.line,
            column: unclosed.column,
        });
    }
    return { roots, elements, errors };
}

// `ancestors` and `documentElement` used to live here. Finding 11 of the third
// completion review: both were exported, called by nothing, and bundled into
// the per-`.svg`-write dispatch chunk — own-orphans of this same diff, which
// `minimal-safe-diff` says the diff that made them removes. `XmlNode.parent`
// is the primitive either would have been built on and it is still here.
