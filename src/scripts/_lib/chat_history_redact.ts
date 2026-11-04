import { loadEgressEngine } from '../hooks/egress_engine_loader.js';

type Entry = Record<string, unknown>;

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && Object.getPrototypeOf(v) === Object.prototype;
}

/**
 * Every string leaf with its credentials replaced by egress placeholders
 * (OQ-34, option 1). One scope per entry, never persisted, so a placeholder is
 * not resolvable by anything, here or later. A leaf whose credential extent
 * cannot be proven, or any leaf when the engine cannot load, is withheld whole:
 * an unscanned write is the exposure this exists to close.
 */
export function redact_credentials(entry: Entry): Entry {
    const load = loadEgressEngine();
    const scope = load.ok ? new load.engine.TokenScope() : null;
    const leaf = (text: string): string => {
        if (!load.ok || scope === null) return `[chat-history: text withheld (egress engine ${load.ok ? 'error' : load.reason})]`;
        try {
            return load.engine.replaceValues(text, scope, 'credential');
        } catch (exc) {
            return `[chat-history: text withheld (${exc instanceof load.engine.EgressRefusedError ? exc.rule : 'error'})]`;
        }
    };
    const walk = (v: unknown): unknown => {
        if (typeof v === 'string') return leaf(v);
        if (Array.isArray(v)) return v.map(walk);
        if (isPlainObject(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
        return v;
    };
    const out: Entry = {};
    for (const [k, v] of Object.entries(entry)) out[k] = k === 't' || k === 'ts' || k === 's' ? v : walk(v);
    return out;
}
