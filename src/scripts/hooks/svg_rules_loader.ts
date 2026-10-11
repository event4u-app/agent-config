/**
 * The conditional chunk — step 0.1 of `road-to-svg-rules-in-the-dispatch-path`.
 *
 * WHY A CHUNK AND NOT AN IMPORT. `src/scripts/_lib/svg_rules.ts` costs 30,924
 * bytes when it is statically imported into `dist/hooks/dispatch.js`, the one
 * bundle every hook event loads on every dispatch. An AI council of two
 * providers refused a ceiling raise for it 2/2 on 2026-10-11 and both seats
 * asked for this to be tried first: emit the rule set beside the bundle and
 * load it only when the written path ends in `.svg`.
 *
 * WHY `require` AND NOT `await import`. `ConcernMain` is
 * `(argv?) => number | undefined | void` — synchronous. A concern that returned
 * a Promise would have its exit code read as an object, so the chunk has to be
 * loadable without an `await`. It is therefore emitted as CJS and pulled with
 * `createRequire`, which is synchronous. This is a constraint of the dispatch
 * contract, not a style choice; making it `async` means making every concern
 * async, which is a different change than this one.
 *
 * WHY THE SPECIFIER IS COMPUTED AT RUNTIME. A literal `import()` or `require()`
 * argument is analyzable, and esbuild would inline the module — which is
 * exactly the 30,924 bytes this avoids. Both branches build their specifier
 * from `import.meta.url`, so neither is a static edge in the bundle's graph.
 *
 * THE TWO BRANCHES.
 *
 *   bundled   — `import.meta.url` is `dist/hooks/dispatch.js` (esbuild keeps
 *               `import.meta.url` in ESM output and the banner resolves the
 *               real path through a symlink), so the chunk is its sibling
 *               `dist/hooks/svg_rules.chunk.cjs`.
 *   unbundled — running from source under `tsx`, where `require` of a `.ts`
 *               file resolves through tsx's CJS hook. Measured working
 *               2026-10-11; there is no chunk on this path and none is built.
 *
 * FAILURE IS NULL, NEVER A THROW. A missing chunk in a consumer install, a
 * chunk packed to another path, or a module that throws on load all return
 * `null` and the caller reports the rules as unavailable. The dispatch bundle
 * handles every hook event in one process: a throw that escaped here would
 * break events that never touched an `.svg`, which is the containment
 * `design_pass_svg.test.ts` pins.
 */
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Finding as SvgFinding, ScanOptions } from '../_lib/svg_rules.js';

/** The signature `scanSvg` exports. Type-only, so no bytes reach the bundle. */
export type SvgScan = (text: string, file: string, opts?: ScanOptions) => SvgFinding[];

/** The emitted sibling's name. `build:hook-chunks` writes exactly this. */
export const CHUNK_BASENAME = 'svg_rules.chunk.cjs';

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;

/** True when this code is running from `dist/hooks/dispatch.js`. */
export function isBundled(): boolean {
    return typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__;
}

/**
 * Where to load the rules from, given this module's own URL.
 *
 * Exported so a test can pin both branches without a bundle: the path algebra
 * is the half that breaks silently in a consumer install, and a probe that can
 * only run against a built bundle would not be run.
 */
export function rulesSpecifier(selfUrl: string, bundled: boolean): string {
    const selfPath = fileURLToPath(selfUrl);
    const dir = path.dirname(selfPath);
    if (bundled) return path.join(dir, CHUNK_BASENAME);
    // From source: `.../src/scripts/hooks/` → `.../src/scripts/_lib/`. The
    // extension follows this file's own, so a compiled-to-JS tree resolves too.
    const ext = selfPath.endsWith('.ts') ? '.ts' : '.js';
    return path.join(dir, '..', '_lib', `svg_rules${ext}`);
}

let cached: SvgScan | null | undefined;

/**
 * The rule set, or `null` when it could not be loaded.
 *
 * Cached including the failure: a consumer whose install is missing the chunk
 * would otherwise pay a failed module resolution on every `.svg` write.
 */
export function loadSvgScan(selfUrl: string = import.meta.url): SvgScan | null {
    if (cached !== undefined) return cached;
    cached = loadSvgScanUncached(selfUrl);
    return cached;
}

/**
 * The uncached load. Separate so a test can exercise a failure and a success.
 *
 * `bundled` is an explicit override rather than always `isBundled()`: under a
 * test runner the define is absent, so the bundled branch — the one that
 * breaks silently in a consumer install — would otherwise be unreachable from
 * any test that does not first build a bundle, and a probe that expensive does
 * not get run. The hook path never passes it.
 */
export function loadSvgScanUncached(
    selfUrl: string = import.meta.url,
    bundled: boolean = isBundled(),
): SvgScan | null {
    try {
        const req = createRequire(selfUrl);
        const mod = req(rulesSpecifier(selfUrl, bundled)) as Record<string, unknown>;
        const scan = mod['scanSvg'];
        return typeof scan === 'function' ? (scan as SvgScan) : null;
    } catch {
        return null;
    }
}

/** Test seam: forget a cached verdict. Never called by the hook path. */
export function _resetSvgScanCache(): void {
    cached = undefined;
}
