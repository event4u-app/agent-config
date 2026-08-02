#!/usr/bin/env tsx
/**
 * Print the diff base a content check should compare HEAD against.
 *
 * A resolver, not a gate — it decides nothing and blocks nothing. It exists so
 * the shell-side checks in `.github/workflows/skill-lint.yml` resolve their
 * scope from the same source as `skill_linter --changed`, instead of hardcoding
 * `origin/${base_ref}` and going blind on a release PR (the "0 changed corpus
 * files, INCONCLUSIVE" outcome).
 *
 * Usage:
 *   resolve_lint_scope [--base-ref <ref>] [--json]
 *
 * Prints the base ref on stdout and the reason on stderr, so a caller can do
 *   BASE="$(./scripts-run src/scripts/resolve_lint_scope --base-ref "origin/$X")"
 * and still see the explanation in the log.
 *
 * Exit codes: 0 always — a resolver that cannot widen reports the ordinary
 * base and says why. Failing here would turn an unresolvable tag into a red
 * release for the wrong reason; the emptiness decision belongs to the gate.
 */
import { resolveContentLintScope } from './_lib/release_scope.js';

export function main(argv: string[]): number {
    let baseRef: string | undefined;
    let asJson = false;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--base-ref') {
            baseRef = argv[i + 1];
            i += 1;
        } else if (a.startsWith('--base-ref=')) {
            baseRef = a.slice('--base-ref='.length);
        } else if (a === '--json') {
            asJson = true;
        }
    }

    const scope = resolveContentLintScope(baseRef === undefined ? {} : { baseRef });
    if (asJson) {
        process.stdout.write(`${JSON.stringify(scope)}\n`);
        return 0;
    }
    process.stderr.write(`resolve_lint_scope: ${scope.reason}\n`);
    process.stdout.write(`${scope.base}\n`);
    return 0;
}

const invokedDirectly =
    process.argv[1] !== undefined && /resolve_lint_scope\.ts$/.test(process.argv[1]);
if (invokedDirectly) {
    process.exit(main(process.argv.slice(2)));
}
