/**
 * Gate-R2 settings escape hatch, shared by the validator and the dispatcher.
 *
 * It lives here rather than in either script because BOTH R2 enforcement layers
 * must honour it: `check_completion_review` (the gate) and
 * `dispatch_r2_reviewer --verify` / `--verify-current` (the manifest
 * re-derivation CI step). A reader that only the gate consulted left the second,
 * blocking layer firing with the gate nominally switched off. `check_*` already
 * imports the scope hash from `dispatch_*`, so putting the predicate in either
 * one would make the import cycle back on itself.
 *
 * Fail-open by design: an unreadable or unparseable settings file, or a missing
 * key, leaves the gate ACTIVE (`=== false` is the only disabling value).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { parse as parseYaml } from 'yaml';

function planningFlagIsFalse(settingsDir: string, key: string): boolean {
    const settingsPath = path.join(settingsDir, '.agent-settings.yml');
    let raw: string;
    try {
        raw = fs.readFileSync(settingsPath, 'utf-8');
    } catch {
        return false;
    }
    try {
        const parsed = parseYaml(raw) as unknown;
        if (parsed === null || typeof parsed !== 'object') return false;
        const planning = (parsed as Record<string, unknown>)['planning'];
        if (planning === null || typeof planning !== 'object') return false;
        return (planning as Record<string, unknown>)[key] === false;
    } catch {
        return false;
    }
}

/** `planning.completion_review === false` in `<dir>/.agent-settings.yml`. */
export function completionReviewDisabled(settingsDir: string): boolean {
    return planningFlagIsFalse(settingsDir, 'completion_review');
}
