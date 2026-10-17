/**
 * Is this text a DTCG token document? The question every reader of a brand
 * token file has to answer before it uses one, declared once.
 *
 * `brand:status` answered it first and kept the answer in the CLI, so the two
 * other readers — the UI scaffold's `token_seed` line and the asset renderer's
 * background read — fell back to `isFile()`. A malformed `tokens.json` beside a
 * valid `assets/tokens.json` then seeded the plan from the broken one and the
 * renderer skipped straight to its fallback background, while `brand:status`
 * reported the valid file as the brand. Three readers, three answers.
 *
 * It lives beside `brandTokenPaths.ts` for the same reason: `src/shared/` is
 * the one home the compiled CLI, the tsx-run work-engine tree and the bundled
 * delegates all reach at runtime. Keep it dependency-free — it takes TEXT, not
 * a path, so nothing here touches the filesystem and every caller keeps its own
 * read, its own error handling and its own notion of a root.
 */

/** Depth bound: a token tree this deep is pathological, not a document. */
const MAX_DEPTH = 64;

function hasDtcgToken(node: unknown, depth = 0): boolean {
    if (depth > MAX_DEPTH || typeof node !== 'object' || node === null || Array.isArray(node)) return false;
    if ('$value' in node) return true;
    return Object.values(node as Record<string, unknown>).some((v) => hasDtcgToken(v, depth + 1));
}

/**
 * Parse before present: `null` when the text is a DTCG token document, else the
 * reason it is not one. A file that merely exists is not a brand.
 */
export function tokenDocumentError(text: string): string | null {
    let doc: unknown;
    try {
        doc = JSON.parse(text);
    } catch (exc) {
        return `not JSON: ${exc instanceof Error ? exc.message : String(exc)}`;
    }
    if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
        return 'not a DTCG document: the root is not an object';
    }
    if (!hasDtcgToken(doc)) {
        return 'not a DTCG document: no token carries a `$value`';
    }
    return null;
}
