/**
 * Pure parse / compose helpers for `.agent-user.md` bodies.
 *
 * Shared between the Fastify server (route validation, wizard finish) and
 * the Vite-bundled UI (round-trip between structured form and markdown).
 * Per the council verdict (2026-05-19), this module lives under
 * `src/shared/` and MUST stay free of Node-only APIs (`fs`, `path`,
 * `crypto`, `process`, …) — ESLint enforces it.
 *
 * Parser choice: a small fenced-frontmatter splitter plus `js-yaml`.
 * `js-yaml` is pure JS, has no `Buffer` / `process` dependency, and
 * bundles cleanly into the Vite UI output. (The previous `gray-matter`
 * implementation crashed in the browser with `ReferenceError: Buffer
 * is not defined`, which silently broke the wizard's userMd step.)
 *
 * Compose choice: `yaml.dump` with `flowLevel: -1` emits **block style**
 * at every depth. Block-style is required by the schema contract
 * (`docs/contracts/agent-user-schema.md`): `identity.role` and other
 * list-valued fields produce clean, line-oriented git diffs that way;
 * flow style (`role: [a, b]`) is allowed by the parser but rejected
 * by the contract.
 */

import yaml from 'js-yaml';

/**
 * Structured view of `.agent-user.md`.
 *
 * `data` is the parsed YAML frontmatter (empty object when no
 * frontmatter is present). `content` is the markdown body following the
 * frontmatter fence (or the entire input when no fence exists).
 */
export interface ParsedUserMd {
    data: Record<string, unknown>;
    content: string;
}

/**
 * Frontmatter fence: leading `---` on its own line, YAML body, trailing
 * `---` on its own line. Matches `gray-matter`'s default delimiter
 * behaviour so existing files round-trip identically.
 */
const FRONTMATTER_FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * Parse an `.agent-user.md` body into its frontmatter object and the
 * markdown content that follows.
 *
 * Throws on malformed YAML — callers that need a soft failure
 * (HTTP 422 in routes, form-level error in the UI) should pre-validate
 * via the Zod schema in `./schema.ts`. A body without a frontmatter
 * fence parses to `{ data: {}, content: body }`.
 */
export function parseUserMd(body: string): ParsedUserMd {
    const match = FRONTMATTER_FENCE.exec(body);
    if (match === null) {
        return { data: {}, content: body };
    }
    const yamlText = match[1] ?? '';
    const content = body.slice(match[0].length);
    const loaded = yaml.load(yamlText);
    const data: Record<string, unknown> =
        loaded !== null && typeof loaded === 'object' && !Array.isArray(loaded)
            ? (loaded as Record<string, unknown>)
            : {};
    return { data, content };
}

/**
 * Compose a structured `ParsedUserMd` back into an `.agent-user.md`
 * body, emitting YAML frontmatter in block style (no flow `[a, b]`,
 * no inline maps) so list-valued fields like `identity.role` produce
 * one entry per line and diff cleanly in git.
 *
 * When `data` is empty, the leading `---\n---\n` fence is omitted.
 */
export function composeUserMd(parsed: ParsedUserMd): string {
    if (Object.keys(parsed.data).length === 0) {
        return parsed.content;
    }
    const dumped = yaml.dump(parsed.data, {
        flowLevel: -1,
        lineWidth: -1,
        noRefs: true,
    });
    // `yaml.dump` always terminates with `\n`; strip and re-add inside
    // the fence so the body shape stays `---\n<yaml>\n---\n<content>`.
    const trimmed = dumped.endsWith('\n') ? dumped.slice(0, -1) : dumped;
    return `---\n${trimmed}\n---\n${parsed.content}`;
}
