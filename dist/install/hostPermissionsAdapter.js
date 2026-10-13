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
            // "A `*` at the end, with a space before it, also matches the bare
            // command. `Bash(ls *)` matches `ls`, and `Bash(git log *)` matches
            // `git log`. That holds only when the trailing `*` is the rule's
            // only wildcard: `Bash(* --help *)` matches `npm --help x` but not
            // `npm --help`."
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
 * A COMMAND BECOMES TWO ROWS, and the reason is NOT the one an earlier version
 * of this comment gave. It claimed `Bash(x *)` never matches the bare `x`; the
 * page says the opposite one line above the sentence that was read — "A `*` at
 * the end, with a space before it, also matches the bare command." A review
 * caught it, and it had reached the roadmap as that step's "one non-obvious
 * finding", so the correction is recorded rather than quietly applied.
 *
 * The real reason is the page's own qualifier: the bare-command match "holds
 * only when the trailing `*` is the rule's only wildcard". A consumer token
 * carrying its own `*` breaks that, and the exact row is what still guards the
 * plain command then. One row would be right for most tokens and silently
 * wrong for those — Risk 3 in the register, "a rule in the wrong syntax is
 * accepted by the file and enforced by nothing".
 *
 * A READ no-go renders `Read(...)` AND `Edit(...)`. The `Read` deny covers the
 * Edit and Write tools on the same path, but the page names the exception:
 * "NotebookEdit isn't covered, so add an `Edit` deny rule for paths no tool may
 * change." A read no-go over a directory holding notebooks would otherwise
 * leave NotebookEdit able to change it.
 */
export function denyRulesFor(host, c) {
    if (syntaxFor(host) === null || c.action === null || c.token === null)
        return [];
    if (c.kind === 'command')
        return [`Bash(${c.token})`, `Bash(${c.token} *)`];
    if (c.kind === 'path') {
        const spec = pathSpec(c.token);
        return c.action === 'read' ? [`Read(${spec})`, `Edit(${spec})`] : [`Edit(${spec})`];
    }
    return [];
}
//# sourceMappingURL=hostPermissionsAdapter.js.map