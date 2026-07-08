/**
 * `agent-config config` — open the local configuration GUI.
 *
 * The canonical settings entry point (road-to-setup-experience § Phase 1).
 * Default scope is GLOBAL: lands on the `#/settings` hub that edits the
 * global `.agent-settings.yml`. Inside a bridged project the GUI shows a
 * scope switcher; `--project` lands directly on the project surface
 * (`#/project`) instead.
 *
 * `agent-config settings` stays as a compatible alias of the default
 * (global) scope.
 *
 * Flags:
 *   --project         Land on the project configuration surface.
 *   --port <n>        Override the auto-picked port.
 *   --no-open         Do not launch the browser.
 *   --ui-dist <p>     Override the dist/ui directory.
 *   --allow-headless  Start even when SSH/no-DISPLAY is detected.
 *   --project-root    Override the project root.
 *   --dry-run         Boot with all writes suppressed (preview-only).
 */

import { runUiServe, type UiServeOptions } from './uiServe.js';

export interface ConfigCommandOptions {
    /** Land on the project configuration surface instead of global settings. */
    project?: boolean;
    port?: number;
    open?: boolean;
    uiDist?: string;
    allowHeadless?: boolean;
    projectRoot?: string;
    /** Boot in dry-run mode — no writes, preview only. */
    dryRun?: boolean;
}

export async function runConfig(opts: ConfigCommandOptions): Promise<number> {
    const forwarded: UiServeOptions = {
        initialRoute: opts.project === true ? '/project' : '/settings',
    };
    if (opts.port !== undefined) forwarded.port = opts.port;
    if (opts.open !== undefined) forwarded.open = opts.open;
    if (opts.uiDist !== undefined) forwarded.uiDist = opts.uiDist;
    if (opts.allowHeadless !== undefined) forwarded.allowHeadless = opts.allowHeadless;
    if (opts.projectRoot !== undefined) forwarded.projectRoot = opts.projectRoot;
    if (opts.dryRun !== undefined) forwarded.dryRun = opts.dryRun;
    return runUiServe(forwarded);
}
