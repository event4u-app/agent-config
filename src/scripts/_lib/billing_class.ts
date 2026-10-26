/**
 * billing_class — does this Claude Code session bill per token?
 *
 * A key in the environment or an `apiKeyHelper` in the host settings can make
 * the session bill at API rates instead of the plan, and nothing told the user.
 * This reads PRESENCE only — a variable that is set, a settings key that
 * exists — and never a value, so no credential passes through it.
 *
 * `metered` is a possibility, not a proof: an interactive login may have
 * declined the key. Every caller words its notice that way and points at
 * `/status`, which shows the auth source the host actually used.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export interface BillingClassReading {
    readonly billing_class: 'plan' | 'metered';
    /** What made it metered, by name only; `null` for `plan`. */
    readonly source: string | null;
}

const KEY_VARS = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'] as const;
const CLOUD_VARS = ['CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX'] as const;

function truthy(v: string | undefined): boolean {
    return v !== undefined && ['1', 'true', 'yes'].includes(v.trim().toLowerCase());
}

/** The host settings files an `apiKeyHelper` can live in, user layer first. */
export function hostSettingsPaths(env: NodeJS.ProcessEnv, projectDir: string | null): string[] {
    const home = env['CLAUDE_CONFIG_DIR'] ?? path.join(env['HOME'] ?? os.homedir(), '.claude');
    const out = [path.join(home, 'settings.json')];
    if (projectDir) {
        out.push(path.join(projectDir, '.claude', 'settings.json'), path.join(projectDir, '.claude', 'settings.local.json'));
    }
    return out;
}

function hasApiKeyHelper(file: string): boolean {
    try {
        const o = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown> | null;
        const helper = o?.['apiKeyHelper'];
        return typeof helper === 'string' && helper.trim() !== '';
    } catch {
        return false;
    }
}

export function readBillingClass(env: NodeJS.ProcessEnv, settingsPaths: readonly string[]): BillingClassReading {
    for (const name of KEY_VARS) {
        if ((env[name] ?? '').trim() !== '') return { billing_class: 'metered', source: name };
    }
    for (const name of CLOUD_VARS) {
        if (truthy(env[name])) return { billing_class: 'metered', source: name };
    }
    for (const file of settingsPaths) {
        if (hasApiKeyHelper(file)) return { billing_class: 'metered', source: 'apiKeyHelper' };
    }
    return { billing_class: 'plan', source: null };
}
