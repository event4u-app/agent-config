/**
 * Coarse-bucket helpers — collapse precise values into the small fixed
 * enums defined in `telemetry-schema.md`. Buckets exist so the wire
 * format cannot leak sub-bucket precision (e.g. `duration_ms`).
 */

import type {
    DurationBucket,
    ErrorClass,
    HostAgentFamily,
    NodeMajor,
    OsFamily,
} from './types.js';

const VSCODE_FAMILY = new Set(['cursor', 'copilot', 'windsurf', 'vscode']);
const JETBRAINS_FAMILY = new Set(['jetbrains', 'phpstorm', 'intellij', 'webstorm', 'pycharm']);
const CLI_FAMILY = new Set(['cli', 'claude-cli', 'aider', 'codex']);
const BROWSER_FAMILY = new Set(['browser', 'claude.ai', 'chatgpt']);

export function hostAgentFamilyOf(rawHostAgent: string | undefined): HostAgentFamily {
    if (rawHostAgent === undefined || rawHostAgent.length === 0) {
        return 'unknown';
    }
    const lower = rawHostAgent.toLowerCase();
    if (VSCODE_FAMILY.has(lower)) return 'vscode';
    if (JETBRAINS_FAMILY.has(lower)) return 'jetbrains';
    if (CLI_FAMILY.has(lower)) return 'cli';
    if (BROWSER_FAMILY.has(lower)) return 'browser';
    return 'unknown';
}

export function osFamilyOf(platform: NodeJS.Platform): OsFamily {
    if (platform === 'darwin') return 'macos';
    if (platform === 'win32') return 'windows';
    return 'linux';
}

export function nodeMajorOf(versionString: string): NodeMajor {
    // versionString shaped like 'v22.4.1' or '22.4.1'.
    const stripped = versionString.startsWith('v') ? versionString.slice(1) : versionString;
    const major = stripped.split('.')[0];
    if (major === '22') return '22';
    return '20';
}

export function durationBucketOf(durationMs: number): DurationBucket {
    if (durationMs < 30_000) return '<30s';
    if (durationMs < 120_000) return '30s-2m';
    if (durationMs < 600_000) return '2m-10m';
    return '>10m';
}

const NETWORK_PATTERNS = [/ENOTFOUND/, /ECONNREFUSED/, /ETIMEDOUT/, /fetch failed/i];
const FILESYSTEM_PATTERNS = [/ENOENT/, /EACCES/, /EISDIR/, /ENOTDIR/, /EROFS/];
const CONFIG_PATTERNS = [/invalid config/i, /schema/i, /yaml/i, /json parse/i];
const DEPENDENCY_PATTERNS = [/cannot find module/i, /missing dependency/i, /peer dep/i];

/**
 * Classify a raw `Error` into one of five enum buckets. Never returns the
 * original message or stack; the schema forbids it. Defaults to `unknown`.
 */
export function errorClassOf(err: unknown): ErrorClass {
    const probe = errorProbe(err);
    if (NETWORK_PATTERNS.some((p) => p.test(probe))) return 'network';
    if (FILESYSTEM_PATTERNS.some((p) => p.test(probe))) return 'filesystem';
    if (CONFIG_PATTERNS.some((p) => p.test(probe))) return 'config_invalid';
    if (DEPENDENCY_PATTERNS.some((p) => p.test(probe))) return 'dependency';
    return 'unknown';
}

function errorProbe(err: unknown): string {
    if (err instanceof Error) {
        const code = (err as Error & { code?: string }).code ?? '';
        return `${code} ${err.message}`;
    }
    if (typeof err === 'string') return err;
    return '';
}
