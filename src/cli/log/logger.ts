/**
 * Sanctioned logger for the TS CLI shell.
 *
 * Per ADR-012, plain `console.log` is banned outside this file. Tests
 * and the Vitest reporter override the ban via the `.eslintrc.cjs`
 * `overrides` block.
 *
 * Output rules:
 *   - Level `error` → stderr, prefixed `agent-config: error:`.
 *   - Level `warn`  → stderr, prefixed `agent-config: warn:`.
 *   - Level `info`  → stdout, no prefix (this is the user-visible
 *     pass-through line for native commands).
 *   - Level `debug` → stderr, only when `AGENT_CONFIG_LOG=debug`.
 *
 * No colour codes. Detecting a TTY and switching to colour belongs to
 * downstream commands that genuinely want it (none today).
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function envLevel(): LogLevel {
    const raw = process.env.AGENT_CONFIG_LOG?.toLowerCase();
    if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') return raw;
    return 'info';
}

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function emit(level: LogLevel, message: string): void {
    if (ORDER[level] < ORDER[envLevel()]) return;
    if (level === 'info') {
        process.stdout.write(`${message}\n`);
        return;
    }
    const prefix = level === 'debug' ? '' : `agent-config: ${level}: `;
    process.stderr.write(`${prefix}${message}\n`);
}

export const logger = {
    debug: (msg: string): void => emit('debug', msg),
    info: (msg: string): void => emit('info', msg),
    warn: (msg: string): void => emit('warn', msg),
    error: (msg: string): void => emit('error', msg),
};
