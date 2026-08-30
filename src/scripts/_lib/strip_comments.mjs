/**
 * Strip comments before scanning for import specifiers.
 *
 * A doc comment can carry a perfectly well-formed `from './x'` as an EXAMPLE,
 * and this scanner had no way to tell one from a real import. Measured: a
 * comment in `src/cli/commands/uiAudit.ts` explaining why an `index.tsx` full
 * of re-exports is a barrel made prepack-check report an unresolvable import in
 * a module nobody imports, and the identical construct in a SECOND scanner
 * (`parseRelativeSpecifiers` in consumer_matrix.ts) failed four other jobs on
 * the same day. Fixing one and not the other is fixing an instance.
 *
 * Quote state resets at each newline; block-comment state does not. Carrying
 * quote state across the file is what broke the first attempt at the twin: an
 * apostrophe in comment prose opened a string that swallowed every later `/*`.
 *
 * TWIN of `stripComments` in `src/scripts/consumer_matrix.ts`, duplicated
 * because that one is TypeScript and this file is plain `.mjs` run directly by
 * node with no build step. `tests/scripts/strip_comments_parity.test.ts` asserts
 * the two agree, so a divergence is a named test failure rather than one gate
 * going red while its twin stays green.
 */
export function stripCommentsMjs(source) {
    const out = [];
    let inBlock = false;
    for (const rawLine of source.split('\n')) {
        let line = '';
        let i = 0;
        let quote = null;
        while (i < rawLine.length) {
            const c = rawLine[i];
            const next = rawLine[i + 1];
            if (inBlock) {
                if (c === '*' && next === '/') {
                    inBlock = false;
                    i += 2;
                    continue;
                }
                i += 1;
                continue;
            }
            if (quote !== null) {
                line += c;
                if (c === '\\' && next !== undefined) {
                    line += next;
                    i += 2;
                    continue;
                }
                if (c === quote) quote = null;
                i += 1;
                continue;
            }
            if (c === '/' && next === '/') break;
            if (c === '/' && next === '*') {
                inBlock = true;
                i += 2;
                continue;
            }
            if (c === "'" || c === '"' || c === '`') quote = c;
            line += c;
            i += 1;
        }
        out.push(line);
    }
    return out.join('\n');
}
