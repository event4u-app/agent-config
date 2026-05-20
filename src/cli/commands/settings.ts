/**
 * `agent-config settings` — open the local Settings GUI.
 *
 * Thin wrapper around `runUiServe` that lands on the `#/settings`
 * route instead of the wizard. Per roadmap
 * `unified-setup-and-settings-gui.md` § 2.4, the only difference vs
 * `ui:serve` is the initial URL hash; the server stack is shared.
 *
 * Flags:
 *   --port <n>     Override the auto-picked port.
 *   --no-open      Do not launch the browser.
 *   --ui-dist <p>  Override the dist/ui directory.
 *   --allow-headless  Start even when SSH/no-DISPLAY is detected.
 *   --project-root    Override the project root.
 */

import { runUiServe, type UiServeOptions } from './uiServe.js';

export interface SettingsCommandOptions {
    port?: number;
    open?: boolean;
    uiDist?: string;
    allowHeadless?: boolean;
    projectRoot?: string;
}

export async function runSettings(opts: SettingsCommandOptions): Promise<number> {
    const forwarded: UiServeOptions = {
        initialRoute: '/settings',
    };
    if (opts.port !== undefined) forwarded.port = opts.port;
    if (opts.open !== undefined) forwarded.open = opts.open;
    if (opts.uiDist !== undefined) forwarded.uiDist = opts.uiDist;
    if (opts.allowHeadless !== undefined) forwarded.allowHeadless = opts.allowHeadless;
    if (opts.projectRoot !== undefined) forwarded.projectRoot = opts.projectRoot;
    return runUiServe(forwarded);
}
