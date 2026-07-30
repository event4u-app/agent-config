/**
 * Pure parse / compose helpers for `.agent-user.yml`.
 *
 * Shared between the Fastify server (route validation, wizard finish) and
 * the Vite-bundled UI (round-trip between structured form and YAML text).
 * Lives under `src/shared/` and MUST stay free of Node-only APIs
 * (`fs`, `path`, `crypto`, `process`, …) — ESLint enforces it.
 *
 * Parser choice: `js-yaml`. Pure JS, no `Buffer` / `process` dependency,
 * bundles cleanly into the Vite UI output. (An earlier `gray-matter`
 * attempt crashed in the browser with `ReferenceError: Buffer is not
 * defined`, which silently broke the wizard's userMd step.)
 *
 * Compose choice: `yaml.dump` with `flowLevel: -1` emits **block style**
 * at every depth. Block-style is required by the schema contract
 * (`docs/contracts/agent-user-schema.md`): `role` and other list-valued
 * fields produce clean, line-oriented git diffs that way; flow style
 * (`role: [a, b]`) is allowed by the parser but rejected by the contract.
 *
 * Legacy bridge: `parseLegacyUserMd` accepts the old fenced-frontmatter
 * `.agent-user.md` body and returns the same shape as `parseUserIdentity`
 * so the server can read pre-migration files during the wizard finish.
 * Drop once no consumer ships the legacy file.
 */

import yaml from 'js-yaml';

/** Frontmatter fence used by the legacy `.agent-user.md` format. */
const FRONTMATTER_FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * Parse a `.agent-user.yml` body into a plain object. Throws on
 * malformed YAML — callers that need a soft failure (HTTP 422 in
 * routes, form-level error in the UI) should pre-validate via
 * `userIdentitySchema` in `./schema.ts`. An empty / whitespace-only
 * body parses to `{}` so callers can layer defaults on top.
 */
export function parseUserIdentity(body: string): Record<string, unknown> {
    const trimmed = body.trim();
    if (trimmed === '') return {};
    const loaded = yaml.load(body);
    if (loaded === null || loaded === undefined) return {};
    if (typeof loaded !== 'object' || Array.isArray(loaded)) {
        throw new Error('.agent-user.yml must parse to an object');
    }
    return loaded as Record<string, unknown>;
}

/**
 * Compose a plain object back into a `.agent-user.yml` body, emitting
 * YAML in block style (no flow `[a, b]`, no inline maps) so list-valued
 * fields like `role` produce one entry per line and diff cleanly in git.
 *
 * `yaml.dump` always terminates with `\n`; the result is returned as-is
 * so atomicWrite preserves the trailing newline (POSIX-friendly).
 */
export function composeUserIdentity(data: Record<string, unknown>): string {
    return yaml.dump(data, {
        flowLevel: -1,
        lineWidth: -1,
        noRefs: true,
    });
}

/**
 * Parse a legacy `.agent-user.md` body (fenced YAML frontmatter +
 * optional markdown body). The frontmatter becomes the identity object;
 * any non-empty markdown body is captured under `notes` so prose is
 * preserved across the migration. Returns `{}` when neither fence nor
 * usable body is present.
 *
 * Drop once `.agent-user.md` files are no longer in circulation.
 */
export function parseLegacyUserMd(body: string): Record<string, unknown> {
    const match = FRONTMATTER_FENCE.exec(body);
    if (match === null) {
        const trimmed = body.trim();
        return trimmed === '' ? {} : { notes: trimmed };
    }
    const yamlText = match[1] ?? '';
    const tail = body.slice(match[0].length).trim();
    const loaded = yaml.load(yamlText);
    const data: Record<string, unknown> =
        loaded !== null && typeof loaded === 'object' && !Array.isArray(loaded)
            ? { ...(loaded as Record<string, unknown>) }
            : {};
    if (tail !== '' && data.notes === undefined) {
        data.notes = tail;
    }
    return data;
}

/**
 * Compose a legacy `.agent-user.md` body (fenced YAML frontmatter + a body
 * tail) from a plain object — the write-side counterpart to
 * `parseLegacyUserMd`. Used by
 * `agent_user_profile.applyObservationToGlobalProfile` (road-to-global-user-memory
 * Phase 2) to write the accepted-observation profile back in the same shape
 * it was read in.
 *
 * `notes` renders as the body tail verbatim, WITHOUT an added `# Notes`
 * heading — `parseLegacyUserMd` captures everything after the closing fence
 * as `notes` as-is (it does not strip a heading back out), so adding one
 * here would not round-trip: re-parsing the composed file would return
 * `"# Notes\n\n<text>"` instead of `<text>`. (The convention of putting a
 * literal `# Notes` heading in a hand-authored `.agent-user.md` — see
 * `docs/examples/agent-user.example.md` — is an authoring style, not a
 * structural marker the parser recognises; a file authored that way simply
 * has that heading as the leading line of ITS `notes` value.) Every other
 * key stays in the frontmatter block, in block style (matches
 * `composeUserIdentity`'s diff-friendliness rationale).
 *
 * Drop alongside `parseLegacyUserMd` once `.agent-user.md`-shaped files are
 * no longer in circulation.
 */
export function composeLegacyUserMd(data: Record<string, unknown>): string {
    const { notes, ...frontmatter } = data;
    const yamlBody = yaml.dump(frontmatter, { flowLevel: -1, lineWidth: -1, noRefs: true });
    const notesText = typeof notes === 'string' ? notes.trim() : '';
    const notesSection = notesText === '' ? '' : `\n${notesText}\n`;
    return `---\n${yamlBody}---\n${notesSection}`;
}
