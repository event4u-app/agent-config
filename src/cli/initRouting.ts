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

/** Flags that mean "the caller already knows what to install" → no picker. */
const CLI_SIGNALS: ReadonlySet<string> = new Set([
    '--no-ui', '--tools', '--ai', '--yes', '-y', '--quiet', '-q',
    '--dry-run', '--minimal', '--settings-only', '--list-tools',
    '--validate-only', '--fleet', '--project',
]);

/** The explicit GUI opt-in documented in the README. */
const GUI_FLAG = '--gui';

/** `--flag=value` and `--flag value` both normalize to `--flag`. */
function flagOf(arg: string): string | undefined {
    return arg.split('=', 1)[0];
}

/** Whether the explicit `--gui` opt-in is present in `rest`. */
export function hasGuiFlag(rest: readonly string[]): boolean {
    return rest.some((arg) => flagOf(arg) === GUI_FLAG);
}

/**
 * `rest` with every `--gui` token removed. The bash installer's argument loop
 * ends in `*) err "Unknown argument: $1"; exit 1`, so `--gui` must never reach
 * it — `--gui` is an `init` front-end flag with no installer counterpart.
 */
export function withoutGuiFlag(args: readonly string[]): string[] {
    return args.filter((arg) => flagOf(arg) !== GUI_FLAG);
}

/**
 * The conflict, if any, between an explicit `--gui` and an opt-out that beats
 * it — returns a one-line reason, or `null` when there is no conflict.
 *
 * `--gui` overrides the *capability* probes (TTY, headless) but yields to the
 * *intent* guards (`CI`, `AGENT_CONFIG_NO_UI`, and the CLI-mode flags). When
 * intent wins, the explicit request is never discarded silently: the caller
 * asked for the GUI in so many words, so `init` fails loudly instead of
 * quietly doing the opposite (AI council 2026-07-31, Q1 option B + Q2).
 *
 * `rest` is argv without the leading `init` token.
 */
export function findInitGuiConflict(rest: readonly string[]): string | null {
    if (!hasGuiFlag(rest)) return null;
    for (const arg of rest) {
        const flag = flagOf(arg);
        if (flag !== undefined && CLI_SIGNALS.has(flag)) {
            return `--gui conflicts with ${flag}; drop one`;
        }
    }
    const ci = (process.env['CI'] ?? '').trim();
    if (ci && ci !== '0') {
        return '--gui conflicts with CI=' + ci + ' in the environment; unset CI or drop --gui';
    }
    const envNoUi = (process.env['AGENT_CONFIG_NO_UI'] ?? '').trim();
    if (envNoUi && envNoUi !== '0') {
        return '--gui conflicts with AGENT_CONFIG_NO_UI=' + envNoUi + ' in the environment; unset it or drop --gui';
    }
    return null;
}

/**
 * Whether `init` should open the browser wizard instead of the non-interactive
 * CLI install. Returns false (→ delegate to the bash CLI install) when ANY of
 * these hold:
 *   - CI env set, or AGENT_CONFIG_NO_UI set
 *   - stdin/stdout is not a TTY (piped / curl|bash)
 *   - headless host (SSH / Linux without DISPLAY)
 *   - a CLI-mode flag is present (--no-ui / --tools / --ai / --yes / --quiet /
 *     --dry-run / --minimal / --settings-only / --list-tools /
 *     --validate-only) — the caller already knows what to install and
 *     doesn't want the picker.
 *
 * An explicit `--gui` suppresses the two *capability* probes (TTY, headless)
 * only. It does not defeat `CI`, `AGENT_CONFIG_NO_UI`, or a CLI-mode flag —
 * those combinations are rejected up-front by `findInitGuiConflict`, so a
 * `--gui` that reaches here and still loses is impossible.
 *
 * `--gui` deliberately does NOT imply `--allow-headless`: on a headless host
 * `runUiServe` refuses with an actionable error naming `--allow-headless`,
 * which beats booting a server that then waits for a browser that cannot
 * arrive (AI council 2026-07-31, Q3).
 *
 * `rest` is argv without the leading `init` token.
 */
export function shouldInitLaunchGui(rest: readonly string[]): boolean {
    const ci = (process.env['CI'] ?? '').trim();
    if (ci && ci !== '0') return false;
    const envNoUi = (process.env['AGENT_CONFIG_NO_UI'] ?? '').trim();
    if (envNoUi && envNoUi !== '0') return false;
    const forced = hasGuiFlag(rest);
    if (!forced) {
        if (process.stdin.isTTY !== true || process.stdout.isTTY !== true) return false;
        if (isHeadless()) return false;
    }
    for (const arg of rest) {
        const flag = flagOf(arg);
        if (flag !== undefined && CLI_SIGNALS.has(flag)) return false;
    }
    return true;
}

/**
 * `init --project` — project-surface initialization (road-to-setup-experience
 * § Phase 1.3). Writes the minimal ADR-020 consumer surface (bridge marker +
 * overrides scaffold + managed `.gitignore` block) via the `refresh --project`
 * writer instead of opening the GUI or running the global install. Returns
 * the args to forward to the Bash dispatcher (`refresh --project [...]`), or
 * `null` when `--project` is absent. `rest` is argv without the leading
 * `init` token.
 */
export function buildProjectInitDelegation(rest: readonly string[]): string[] | null {
    if (!rest.includes('--project')) return null;
    const forwarded = rest.filter((arg) => arg !== '--project');
    return ['refresh', '--project', ...forwarded];
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
