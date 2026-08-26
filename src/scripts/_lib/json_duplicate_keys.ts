/**
 * Find duplicate object keys in a JSON document, with both line numbers.
 *
 * `JSON.parse` silently keeps the LAST value for a repeated key. In an eval
 * specification that is not a cosmetic problem: one case becomes a
 * byte-identical clone of another and the intended fixture is never loaded, so
 * the suite reports the same coverage while measuring less. The file parses,
 * every schema check passes, and nothing downstream can tell.
 *
 * Reporting BOTH positions is the point rather than a nicety. A single
 * "duplicate key `id`" line sends the reader hunting through a file where the
 * word appears fifty times; the pair says which two entries collided.
 *
 * A hand-written scanner rather than a parser dependency: the input is
 * machine-generated-shaped JSON, the property needed is positional, and a
 * dependency that must be installed before a gate can run is a gate that does
 * not run in the environment that matters.
 */

/** One collision: the key, and the 1-based lines of the first and later occurrence. */
export interface DuplicateKey {
    key: string;
    /** Line of the occurrence that JSON.parse discards. */
    firstLine: number;
    /** Line of the occurrence that wins. */
    laterLine: number;
    /** Dotted path of the containing object, `""` for the document root. */
    container: string;
}

interface Frame {
    kind: 'object' | 'array';
    /** Keys seen so far in this object, mapped to the line they appeared on. */
    seen: Map<string, number>;
    path: string;
    /** Index of the next array element, for path construction. */
    index: number;
}

/**
 * Scan a JSON document for repeated keys within the same object.
 *
 * Returns every collision, in document order. An unparseable document returns
 * an empty list rather than throwing — the caller runs `JSON.parse` for that
 * verdict, and a scanner that also reports syntax errors would give two
 * different messages for one defect.
 */
export function findDuplicateKeys(source: string): DuplicateKey[] {
    const out: DuplicateKey[] = [];
    const stack: Frame[] = [];
    let line = 1;
    let i = 0;
    // The key most recently read at the current object level, awaiting its `:`.
    let pendingKey: { name: string; line: number } | null = null;

    const readString = (): { value: string; startLine: number } | null => {
        const startLine = line;
        let value = '';
        i += 1; // opening quote
        while (i < source.length) {
            const ch = source[i];
            if (ch === '\\') {
                // Copy the escape verbatim; the KEY text only needs to be
                // stable, not decoded — two keys that collide do so as written.
                value += ch + (source[i + 1] ?? '');
                if (source[i + 1] === '\n') line += 1;
                i += 2;
                continue;
            }
            if (ch === '"') {
                i += 1;
                return { value, startLine };
            }
            if (ch === '\n') line += 1;
            value += ch;
            i += 1;
        }
        return null;
    };

    while (i < source.length) {
        const ch = source[i];
        if (ch === '\n') {
            line += 1;
            i += 1;
            continue;
        }
        if (ch === '"') {
            const str = readString();
            if (str === null) return out; // unterminated — let JSON.parse report it
            const top = stack[stack.length - 1];
            if (top?.kind === 'object' && pendingKey === null) {
                pendingKey = { name: str.value, line: str.startLine };
            }
            continue;
        }
        if (ch === ':') {
            const top = stack[stack.length - 1];
            if (top !== undefined && pendingKey !== null) {
                const prior = top.seen.get(pendingKey.name);
                if (prior !== undefined) {
                    out.push({
                        key: pendingKey.name,
                        firstLine: prior,
                        laterLine: pendingKey.line,
                        container: top.path,
                    });
                }
                top.seen.set(pendingKey.name, pendingKey.line);
            }
            i += 1;
            continue;
        }
        if (ch === '{' || ch === '[') {
            const parent = stack[stack.length - 1];
            let path = '';
            if (parent === undefined) {
                path = '';
            } else if (parent.kind === 'array') {
                path = `${parent.path}[${String(parent.index)}]`;
                parent.index += 1;
            } else {
                path = pendingKey === null ? parent.path : joinPath(parent.path, pendingKey.name);
            }
            stack.push({ kind: ch === '{' ? 'object' : 'array', seen: new Map(), path, index: 0 });
            pendingKey = null;
            i += 1;
            continue;
        }
        if (ch === '}' || ch === ']') {
            stack.pop();
            pendingKey = null;
            i += 1;
            continue;
        }
        if (ch === ',') {
            const top = stack[stack.length - 1];
            if (top?.kind === 'array') top.index += 1;
            pendingKey = null;
            i += 1;
            continue;
        }
        i += 1;
    }
    return out;
}

function joinPath(parent: string, key: string): string {
    return parent === '' ? key : `${parent}.${key}`;
}
