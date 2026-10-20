/**
 * The concern-invocation type, in a module that imports nothing.
 *
 * `hooks/lazy_concern.ts` needs the type and `concern_registry.ts` needs the
 * loader, so the type cannot live in either without a cycle. It is five lines,
 * so it gets its own file rather than a `import type` indirection nobody can
 * follow.
 */

/** A concern `main` — argv-taking or not; both shapes exist. */
export type ConcernMain = (argv?: string[]) => number | undefined | void;
