/**
 * The paths the brand resolver searches for a project's DTCG `tokens.json`,
 * in its order. First hit wins. ONE declaration, three readers.
 *
 * Why here, and not a re-export from either side: this list was declared twice — once in the UI scaffold directive
 * (`agent-src/templates/scripts/work_engine/directives/ui/scaffold.ts`) and
 * once in the asset renderer's types module (`cli/commands/uiRenderAssetTypes.ts`)
 * — and the two had already drifted: the renderer built its last entry with
 * `path.join`, so on Windows it searched `agents\settings\brand\tokens.json`
 * while the scaffold searched the forward-slash form. Two answers to "what
 * counts as this project's brand" is the defect; which separator wins is only
 * how it showed.
 *
 * A re-export from the renderer into the scaffold was tried first and reverted
 * (`cli/commands/uiAudit.ts` records the same class for the coverage
 * vocabulary): it creates a RUNTIME edge from the compiled CLI into the
 * work-engine TEMPLATE tree, which ships as `.ts` beside the bundle rather than
 * inside it, so the published package fails to resolve it at import time.
 *
 * `src/shared/` is the one home both trees can reach at runtime, and the SAME
 * relative specifier resolves in both projections:
 *
 *   - `src/cli/commands/*` compiles under `rootDir: src`, so `../../shared/…`
 *     lands on `dist/shared/brandTokenPaths.js`.
 *   - the work-engine tree runs under tsx from `src/agent-src/templates/…` and
 *     is projected byte-identically to `dist/agent-src/templates/…`;
 *     `../../../../../../shared/…` is `src/shared/brandTokenPaths.ts` in the
 *     first and `dist/shared/brandTokenPaths.js` in the second.
 *
 * Keep this module dependency-free. It imports nothing — not even `node:path`,
 * which is what let the two copies disagree in the first place. These are
 * repo-relative *conventional* paths written with forward slashes; a caller
 * joins them onto a root with `path.join`, which accepts that form on every
 * platform.
 */

/** The four paths the brand resolver searches, in its order. First hit wins. */
export const BRAND_TOKEN_PATHS: ReadonlyArray<string> = [
    'tokens.json',
    'assets/tokens.json',
    'resources/tokens.json',
    'agents/settings/brand/tokens.json',
];
