/**
 * `init` install-front-end routing (road-to-single-install-source-of-truth
 * § Phase 4 follow-up).
 *
 * `init` is the consumer install entry point. When the browser wizard can
 * actually be used, `init` opens it and lets it drive the whole install via
 * `/api/v1/wizard/apply` → `scripts/install.py --apply-payload` — no CLI
 * tool-picker, one installer. Otherwise `init` falls back to the bash CLI
 * install. These pure helpers make that decision (and the GUI option mapping)
 * unit-testable, separate from the self-executing CLI entry point.
 */

import { isHeadless, type runUiServe } from './commands/uiServe.js';

/**
 * Whether `init` should open the browser wizard instead of the non-interactive
 * CLI install. Returns false (→ delegate to the bash CLI install) when ANY of
 * these hold:
 *   - CI env set, or AGENT_CONFIG_NO_UI set
 *   - stdin/stdout is not a TTY (piped / curl|bash)
 *   - headless host (SSH / Linux without DISPLAY)
 *   - a CLI-mode flag is present (--no-ui / --tools / --ai / --yes / --quiet /
 *     --dry-run / --minimal / --settings-only / --list-tools) — the caller
 *     already knows what to install and doesn't want the picker.
 *
 * `rest` is argv without the leading `init` token.
 */
export function shouldInitLaunchGui(rest: readonly string[]): boolean {
    const ci = (process.env['CI'] ?? '').trim();
    if (ci && ci !== '0') return false;
    const envNoUi = (process.env['AGENT_CONFIG_NO_UI'] ?? '').trim();
    if (envNoUi && envNoUi !== '0') return false;
    if (process.stdin.isTTY !== true || process.stdout.isTTY !== true) return false;
    if (isHeadless()) return false;
    const cliSignals = new Set([
        '--no-ui', '--tools', '--ai', '--yes', '-y', '--quiet', '-q',
        '--dry-run', '--minimal', '--settings-only', '--list-tools',
    ]);
    for (const arg of rest) {
        const flag = arg.split('=', 1)[0];
        if (flag !== undefined && cliSignals.has(flag)) return false;
    }
    return true;
}

/**
 * Translate the GUI-compatible subset of `init` flags into `runUiServe`
 * options. Lands on the install wizard (Step 1 / AI tools). `rest` is argv
 * without the leading `init` token.
 */
export function buildInitGuiOptions(rest: readonly string[]): Parameters<typeof runUiServe>[0] {
    const forwarded: Parameters<typeof runUiServe>[0] = {
        initialRoute: '/wizard',
        extendedSteps: true,
        initialStep: 0,
        wizardMode: 'install',
    };
    for (let i = 0; i < rest.length; i += 1) {
        const arg = rest[i];
        if (arg === undefined) continue;
        if (arg === '--no-open') {
            forwarded.open = false;
        } else if (arg === '--allow-headless') {
            forwarded.allowHeadless = true;
        } else if (arg === '--port' || arg === '--project-root' || arg === '--ui-dist') {
            const value = rest[i + 1];
            if (value !== undefined) {
                i += 1;
                if (arg === '--port') {
                    const n = Number.parseInt(value, 10);
                    if (!Number.isNaN(n)) forwarded.port = n;
                } else if (arg === '--project-root') {
                    forwarded.projectRoot = value;
                } else {
                    forwarded.uiDist = value;
                }
            }
        } else if (arg.startsWith('--port=')) {
            const n = Number.parseInt(arg.slice('--port='.length), 10);
            if (!Number.isNaN(n)) forwarded.port = n;
        } else if (arg.startsWith('--project-root=')) {
            forwarded.projectRoot = arg.slice('--project-root='.length);
        } else if (arg.startsWith('--ui-dist=')) {
            forwarded.uiDist = arg.slice('--ui-dist='.length);
        }
    }
    return forwarded;
}
