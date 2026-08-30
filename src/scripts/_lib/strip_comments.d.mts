/**
 * Type declaration for the plain-`.mjs` comment stripper.
 *
 * The implementation is `.mjs` rather than `.ts` because its consumer,
 * `src/scripts/prepack-check.mjs`, is run directly by node with no build step.
 * This file exists so the parity test can import it under `tsc`.
 */
export declare function stripCommentsMjs(source: string): string;
