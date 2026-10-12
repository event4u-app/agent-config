/**
 * How each host spells a permission deny rule, and where that spelling was
 * read from.
 *
 * `road-to-a-project-contract-written-down` step 2.1 named
 * `src/scripts/hooks/host_lowering.yaml` as the home for this pin. It is not
 * the home, and the departure is recorded in the roadmap's Decisions table
 * rather than taken quietly. The measurement that forced it:
 *
 *   - That table is keyed `(host, surface, slot)` and its own header states
 *     its subject — "how each host lowers a dispatcher verdict into its own
 *     hook contract". A permission deny rule has no slot and no verdict; it is
 *     consulted BEFORE a tool runs, not after a hook dispatches.
 *   - `_structure()` there reads only named hook keys, so a `permissions:`
 *     block added to the YAML would be dropped from the typed table and read
 *     by nobody, while still moving the compiled body's fingerprint.
 *
 * Put to the AI council on 2026-10-13 (anthropic + openai, 2/2 present, both
 * seats converging): place the fact here, keep the classifier host-neutral,
 * and let a provenance gate stand in for the plumbing ratification the hook
 * table would have carried.
 *
 * ```
 * THE CLASSIFIER DECIDES WHAT A BULLET MEANS. THIS DECIDES HOW A HOST SPELLS IT.
 * A HOST ABSENT FROM THE TABLE IS A HOST NOBODY ESTABLISHED — NEVER A REFUSAL.
 * ```
 */
export const HOST_PERMISSION_SYNTAX = {
    claude: {
        host: 'claude',
        docs_url: 'https://code.claude.com/docs/en/permissions.md',
        docs_at: '2026-10-13',
        expires: '2027-10-13',
        deny_key: 'permissions.deny',
        examples: [
            // "Claude Code checks file permissions against `Edit(path)` and
            // `Read(path)` rules only. … Use `Edit(docs/**)` in place of
            // `Write(docs/**)`, `NotebookEdit(docs/**)`, or `MultiEdit(docs/**)`."
            'Edit(docs/**)',
            // "To block Claude's file tools from reading a file or directory,
            // add a `Read` deny rule for its path, such as `Read(./.env)` or
            // `Read(./secrets/**)`."
            'Read(./secrets/**)',
            // "`Bash(npm run build)` | Matches the exact command `npm run build`"
            'Bash(npm run build)',
            // "The space before a trailing `*` is part of the rule.
            // `Bash(ls *)` requires a space after `ls`, so `lsof` doesn't match."
            'Bash(ls *)',
        ],
    },
};
/** The row for `host`, or `null` when nothing is established for it. */
export function syntaxFor(host) {
    return HOST_PERMISSION_SYNTAX[host] ?? null;
}
/**
 * The path spec a rule carries.
 *
 * A trailing `/` means the directory's contents, which the host spells `/**`.
 * Everything else is passed through as the consumer wrote it: "a deny or ask
 * rule whose path isn't usable as a gitignore pattern still guards that exact
 * path", and widening `src/generated` to `src/generated/**` on a guess would be
 * the same guess the classifier refuses.
 */
function pathSpec(token) {
    return token.endsWith('/') ? `${token}**` : token;
}
/**
 * The deny rows `c` becomes on `host`. Empty for prose, and empty for a host
 * with no established row.
 *
 * A COMMAND BECOMES TWO ROWS, not one. `Bash(x *)` requires a space after `x`,
 * so it never matches the bare `x`; a single with-arguments row would be
 * accepted by the settings file and would leave the plain command running —
 * Risk 3 in the roadmap's register, "a rule in the wrong syntax is accepted by
 * the file and enforced by nothing".
 *
 * A READ no-go renders `Read(...)`, which the host also applies to the Edit and
 * Write tools on the same path — the stronger of the two, and the one the
 * documentation names for a path that must not be read.
 */
export function denyRulesFor(host, c) {
    if (syntaxFor(host) === null || c.action === null || c.token === null)
        return [];
    if (c.kind === 'command')
        return [`Bash(${c.token})`, `Bash(${c.token} *)`];
    if (c.kind === 'path') {
        const tool = c.action === 'read' ? 'Read' : 'Edit';
        return [`${tool}(${pathSpec(c.token)})`];
    }
    return [];
}
//# sourceMappingURL=hostPermissionsAdapter.js.map