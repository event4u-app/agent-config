/**
 * A minimal XML reader for contract files (WSDL, XSD).
 *
 * It never expands an entity and never resolves anything outside the text it is
 * given: a DOCTYPE that declares an entity is refused outright (XXE and
 * entity-expansion bombs both need one), any other DOCTYPE is skipped, and a
 * reference to an undeclared entity stays literal text. Only the five
 * predefined entities and numeric character references are decoded, which
 * cannot grow the input. Input above the size cap is refused before parsing.
 */

export const XML_SIZE_CAP = 2 * 1024 * 1024;

export interface XmlElement {
    /** local name, prefix stripped */
    name: string;
    prefix: string | null;
    attrs: Record<string, string>;
    children: XmlElement[];
    text: string;
    /** 1-based line of the start tag */
    line: number;
}

export class XmlRefused extends Error {
    constructor(readonly reason: string) {
        super(reason);
    }
}

const PREDEFINED: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

function decode(s: string): string {
    return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[A-Za-z_][\w.-]*);/g, (whole, ref: string) => {
        if (ref.startsWith('#x')) return String.fromCodePoint(Number.parseInt(ref.slice(2), 16));
        if (ref.startsWith('#')) return String.fromCodePoint(Number.parseInt(ref.slice(1), 10));
        return PREDEFINED[ref] ?? whole;
    });
}

function splitName(raw: string): { name: string; prefix: string | null } {
    const i = raw.indexOf(':');
    return i < 0 ? { name: raw, prefix: null } : { name: raw.slice(i + 1), prefix: raw.slice(0, i) };
}

/** Parses `text` into its root element; throws `XmlRefused` on anything unsafe or malformed. */
export function parseXml(text: string, sizeCap = XML_SIZE_CAP): XmlElement {
    if (Buffer.byteLength(text, 'utf8') > sizeCap) throw new XmlRefused(`larger than ${String(sizeCap)} bytes`);
    const doctype = /<!DOCTYPE/i.exec(text);
    if (doctype) {
        if (/<!ENTITY/i.test(text)) throw new XmlRefused('DOCTYPE declares an entity');
    }
    let pos = 0;
    let line = 1;
    const advance = (to: number): void => {
        for (let i = pos; i < to; i++) if (text.charCodeAt(i) === 10) line++;
        pos = to;
    };
    const root: XmlElement = { name: '#document', prefix: null, attrs: {}, children: [], text: '', line: 1 };
    const stack: XmlElement[] = [root];
    while (pos < text.length) {
        const lt = text.indexOf('<', pos);
        const top = stack[stack.length - 1] as XmlElement;
        if (lt < 0) {
            top.text += decode(text.slice(pos));
            break;
        }
        if (lt > pos) top.text += decode(text.slice(pos, lt));
        advance(lt);
        if (text.startsWith('<!--', pos)) {
            const end = text.indexOf('-->', pos + 4);
            if (end < 0) throw new XmlRefused('unterminated comment');
            advance(end + 3);
            continue;
        }
        if (text.startsWith('<![CDATA[', pos)) {
            const end = text.indexOf(']]>', pos + 9);
            if (end < 0) throw new XmlRefused('unterminated CDATA');
            top.text += text.slice(pos + 9, end);
            advance(end + 3);
            continue;
        }
        if (text.startsWith('<?', pos)) {
            const end = text.indexOf('?>', pos + 2);
            if (end < 0) throw new XmlRefused('unterminated processing instruction');
            advance(end + 2);
            continue;
        }
        if (/^<!DOCTYPE/i.test(text.slice(pos, pos + 9))) {
            const bracket = text.indexOf('[', pos);
            const close = text.indexOf('>', pos);
            if (close < 0) throw new XmlRefused('unterminated DOCTYPE');
            if (bracket >= 0 && bracket < close) {
                const end = text.indexOf(']>', bracket);
                if (end < 0) throw new XmlRefused('unterminated DOCTYPE subset');
                advance(end + 2);
            } else {
                advance(close + 1);
            }
            continue;
        }
        if (text.startsWith('</', pos)) {
            const end = text.indexOf('>', pos);
            if (end < 0) throw new XmlRefused('unterminated end tag');
            const { name } = splitName(text.slice(pos + 2, end).trim());
            const open = stack.pop();
            if (!open || open === root || open.name !== name) throw new XmlRefused(`mismatched end tag </${name}>`);
            advance(end + 1);
            continue;
        }
        const m = /^<([A-Za-z_][\w.:-]*)((?:\s+[A-Za-z_][\w.:-]*\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/.exec(text.slice(pos));
        if (!m) throw new XmlRefused(`malformed tag at line ${String(line)}`);
        const startLine = line;
        const { name, prefix } = splitName(m[1] as string);
        const attrs: Record<string, string> = {};
        for (const a of (m[2] ?? '').matchAll(/([A-Za-z_][\w.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
            attrs[a[1] as string] = decode(a[2] ?? a[3] ?? '');
        }
        const el: XmlElement = { name, prefix, attrs, children: [], text: '', line: startLine };
        top.children.push(el);
        advance(pos + m[0].length);
        if (m[3] !== '/') stack.push(el);
    }
    if (stack.length !== 1) throw new XmlRefused('unclosed element');
    const first = root.children[0];
    if (!first) throw new XmlRefused('no root element');
    return first;
}

export function childrenNamed(el: XmlElement, name: string): XmlElement[] {
    return el.children.filter((c) => c.name === name);
}

export function descendantsNamed(el: XmlElement, name: string, out: XmlElement[] = []): XmlElement[] {
    for (const c of el.children) {
        if (c.name === name) out.push(c);
        descendantsNamed(c, name, out);
    }
    return out;
}

/** `tns:Foo` → `Foo` */
export function localRef(qname: string | undefined): string {
    if (!qname) return '';
    const i = qname.indexOf(':');
    return i < 0 ? qname : qname.slice(i + 1);
}
