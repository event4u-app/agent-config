#!/usr/bin/env tsx
/**
 * Thin CLI wrapper: emit the daily update-check banner to stderr.
 *
 * TypeScript twin of `src/scripts/check_update_banner.py` (ADR-089,
 * Phase 4 / Wave 4c). CLI contract mirrored EXACTLY — `--installed-version`,
 * `--cwd`, `--help`/`-h` flags; never raises, never exits non-zero;
 * banner (when emitted) goes to stderr; all other output suppressed.
 *
 * Invoked by the `scripts/agent-config` dispatcher AFTER a subcommand
 * finishes. See `src/scripts/_lib/update_check.py` for the decision logic.
 *
 * Usage:
 *     check_update_banner [--installed-version X.Y.Z]
 *
 * When `--installed-version` is omitted, reads `package.json` next to the
 * package root (`$PACKAGE_ROOT/package.json`).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as agent_settings from './_lib/agent_settings.js';
import * as update_check from './_lib/update_check.js';

const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

const DOC = `Thin CLI wrapper: emit the daily update-check banner to stderr.

Invoked by the \`scripts/agent-config\` dispatcher **after** a
subcommand finishes. Never raises, never exits non-zero — banner is
best-effort. See \`scripts/_lib/update_check.py\` for the decision
logic.

Usage:
    python3 scripts/check_update_banner.py [--installed-version X.Y.Z]

When \`--installed-version\` is omitted, reads \`package.json\` next to
the package root (\`$PACKAGE_ROOT/package.json\`).`;

function _read_installed_version(package_root: string): string {
    const candidate = path.join(package_root, 'package.json');
    try {
        const data = JSON.parse(fs.readFileSync(candidate, 'utf-8')) as Record<string, unknown>;
        const version = data['version'];
        if (typeof version === 'string' && version.trim()) {
            return version.trim();
        }
    } catch {
        // OSError / ValueError / JSONDecodeError → fall through.
    }
    return '';
}

function _read_settings_flag(cwd: string): boolean {
    let settings: agent_settings.SettingsDict;
    try {
        settings = agent_settings.load_agent_settings({ cwd });
    } catch {
        return true;
    }
    const block = settings['update_check'];
    if (block && typeof block === 'object' && !Array.isArray(block)) {
        if ((block as Record<string, unknown>)['enabled'] === false) {
            return false;
        }
    }
    return true;
}

interface ParsedArgs {
    installed_version: string;
    cwd: string;
    help: boolean;
}

function parse_args(argv: readonly string[]): ParsedArgs {
    // add_help=False; only the flags below are recognized. Unknown args are
    // tolerated (Python uses parse_known_args).
    let installed_version = '';
    let cwd = process.cwd();
    let help = false;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (arg === '--installed-version') {
            installed_version = argv[++i] ?? '';
        } else if (arg.startsWith('--installed-version=')) {
            installed_version = arg.slice('--installed-version='.length);
        } else if (arg === '--cwd') {
            cwd = argv[++i] ?? cwd;
        } else if (arg.startsWith('--cwd=')) {
            cwd = arg.slice('--cwd='.length);
        } else if (arg === '--help' || arg === '-h') {
            help = true;
        }
        // unknown → ignored (parse_known_args)
    }
    return { installed_version, cwd, help };
}

async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
    const args = parse_args(argv);
    if (args.help) {
        process.stdout.write(DOC + '\n');
        return 0;
    }

    const installed = args.installed_version || _read_installed_version(ROOT);
    if (!installed) {
        return 0;
    }

    let cwd: string;
    try {
        cwd = path.resolve(args.cwd);
    } catch {
        cwd = ROOT;
    }
    const enabled = _read_settings_flag(cwd);

    let banner: string | null;
    try {
        banner = await update_check.check_for_update(installed, { settings_enabled: enabled });
    } catch {
        return 0;
    }

    if (banner) {
        process.stderr.write(banner + '\n');
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    void main().then((code) => process.exit(code));
}

export { ROOT, _read_installed_version, _read_settings_flag, parse_args, main };
