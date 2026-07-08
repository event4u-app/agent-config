#!/usr/bin/env tsx
/**
 * CLI twin surface of {@link module:install/rule_scope} for the bash
 * installer (road-to-request-scoped-rule-load Phase 1b).
 *
 * Prints one EXCLUDED rule basename per line for the given rules source
 * dir + consumer settings file. `install.sh` consumes this to replace its
 * dead hardcoded `EXCLUDE_RULES` list; on any failure the caller falls back
 * to the static compat exclusion (fail-safe: over-ship, never under-ship).
 *
 * Usage:
 *   rule_scope_cli.ts --rules-dir <dist/agent-src/rules> [--settings <file>]
 *
 * Exit codes: 0 ok (list on stdout, possibly empty) · 2 usage error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { load_agent_settings } from '../scripts/_lib/agent_settings.js';

import { excludedRuleBasenames, ruleScopeFromSettings, LEGACY_ALL } from './rule_scope.js';

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    let rulesDir = '';
    let settingsFile = '';
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--rules-dir') {
            rulesDir = argv[i + 1] ?? '';
            i += 1;
        } else if (arg === '--settings') {
            settingsFile = argv[i + 1] ?? '';
            i += 1;
        } else {
            process.stderr.write(`rule_scope_cli: unknown argument: ${arg}\n`);
            return 2;
        }
    }
    if (rulesDir === '') {
        process.stderr.write('usage: rule_scope_cli.ts --rules-dir <dir> [--settings <file>]\n');
        return 2;
    }

    let scope = LEGACY_ALL;
    if (settingsFile !== '' && fs.existsSync(settingsFile)) {
        try {
            const settings = load_agent_settings({ project_path: settingsFile });
            scope = ruleScopeFromSettings(settings as Record<string, unknown>);
        } catch {
            // Unreadable settings → legacy-all (fail-safe: over-ship).
            scope = LEGACY_ALL;
        }
    }

    for (const name of excludedRuleBasenames(path.resolve(rulesDir), scope)) {
        process.stdout.write(`${name}\n`);
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) ===
            fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
