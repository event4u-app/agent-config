/**
 * Permanent wizard-recommendation dismissals, persisted at
 * `~/.event4u/agent-config/wizard-dismissals.json`.
 *
 * A dismissed recommendation (e.g. `"agent-switch"`) never returns — there
 * is deliberately NO un-dismiss function (S0.1 council verdict, 2026-07-28:
 * a passive row the user closed once stays closed). The file lives in the
 * user-global config root, not inside the installed package, so a
 * dismissal survives package updates.
 *
 * `AGENT_CONFIG_WIZARD_DISMISSALS` overrides the path (tests only).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, dirname } from 'node:path';

function wizardDismissalsPath(): string {
    const override = process.env['AGENT_CONFIG_WIZARD_DISMISSALS'];
    if (override !== undefined && override.length > 0) return override;
    return resolve(homedir(), '.event4u', 'agent-config', 'wizard-dismissals.json');
}

interface DismissalsFile {
    dismissed?: unknown;
}

/**
 * Return the recorded dismissal ids, or `[]` when absent / unreadable.
 * Best-effort: a missing or corrupted file behaves as "nothing dismissed
 * yet" rather than throwing.
 */
export function readDismissedRecommendations(): readonly string[] {
    try {
        const raw = readFileSync(wizardDismissalsPath(), 'utf8');
        const parsed = JSON.parse(raw) as DismissalsFile;
        return Array.isArray(parsed.dismissed)
            ? parsed.dismissed.filter((d): d is string => typeof d === 'string')
            : [];
    } catch {
        return [];
    }
}

/**
 * Record `id` as permanently dismissed. Idempotent — a repeat call for an
 * already-dismissed id is a no-op.
 */
export function dismissRecommendation(id: string): void {
    try {
        const existing = readDismissedRecommendations();
        if (existing.includes(id)) return;
        const path = wizardDismissalsPath();
        mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
        const record = { dismissed: [...existing, id] };
        writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    } catch {
        // Best-effort: a failed write just means the recommendation may
        // resurface on the next load — never throw out of a dismiss action.
    }
}
