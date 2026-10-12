/**
 * How a browser reads the URLs and names in an SVG, for the safety rules in
 * `svg_rules.ts`: references decoded, controls stripped, CSS escapes resolved,
 * and an element prefix stripped only where it is bound to the SVG namespace.
 * Its own module so `svg_rules.ts` stays under the source-size ceiling.
 */

/** Prefixes the document binds to the SVG namespace (`xmlns:svg="…/2000/svg"`). */
export function svgPrefixes(content: string): Set<string> {
    const out = new Set<string>();
    const re = /xmlns:([\w.-]+)\s*=\s*["']http:\/\/www\.w3\.org\/2000\/svg["']/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) out.add((m[1] ?? '').toLowerCase());
    return out;
}

/** The SVG local name: `svg:script` is a `script` where `svg` is bound to SVG; `foo:script` is not. */
export function localName(name: string, prefixes: ReadonlySet<string>): string {
    const colon = name.indexOf(':');
    return colon !== -1 && prefixes.has(name.slice(0, colon)) ? name.slice(colon + 1) : name;
}

/** Attributes read from the raw tag, unquoted values included — HTML parses those. */
export function rawAttrs(raw: string): Record<string, string> {
    const out: Record<string, string> = {};
    const re = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"'`=]+))/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) out[(m[1] ?? '').toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
    return out;
}

/** Attributes whose value is followed as a URL. */
export const URL_ATTRS = new Set(['href', 'xlink:href', 'src']);


/** A URL that executes or opens a document when followed. */
export const isActiveUrl = (raw: string): boolean => /^(javascript:|data:text\/html)/i.test(resolvedUrl(raw));

const NAMED_URL_ENTITIES: Record<string, string> = {
    colon: ':', sol: '/', tab: '\t', newline: '\n', period: '.', lpar: '(', rpar: ')', amp: '&',
};

/**
 * The URL a browser would actually resolve from an attribute value: character
 * references decoded, leading/trailing C0 controls and spaces stripped, tab and
 * newline removed anywhere. The trailing `;` of a reference is optional on
 * purpose: an `.svg` parsed as XML needs it, but the same graphic inlined in an
 * HTML host is parsed by the HTML tokenizer, which decodes `&#106avascript:`
 * too — over-reading XML here costs precision, under-reading HTML costs a miss.
 * The raw value is attacker-chosen, so a scheme test
 * against it is a test of one spelling — ` https:`, `ht\ttps:`, `&#106;avascript:`
 * all load, and all passed.
 */
export function resolvedUrl(raw: string): string {
    const decoded = raw.replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));?/gi, (m, hex, dec, name) => {
        const cp = hex ? parseInt(hex, 16) : dec ? parseInt(dec, 10) : NaN;
        if (!Number.isNaN(cp)) return cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
        return NAMED_URL_ENTITIES[(name as string).toLowerCase()] ?? m;
    });
    return decoded.replace(/^[\u0000- ]+|[\u0000- ]+$/g, '').replace(/[\t\n\r]/g, '');
}

/** CSS escapes decoded: `\\68 ` and `\\h` both read `h`. */
export function cssUnescape(raw: string): string {
    return raw.replace(/\\([0-9a-f]{1,6})\s?|\\(.)/gi, (m, hex, ch) => {
        if (hex) {
            const cp = parseInt(hex, 16);
            return cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
        }
        return ch as string;
    });
}
