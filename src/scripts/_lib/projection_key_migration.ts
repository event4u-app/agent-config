/**
 * The one-release-window read of the projection keys ADR-293 removed.
 *
 * WHAT A REMOVED KEY MAY STILL DO, AND WHAT IT MAY NOT. A consumer who wrote
 * `lean_projection.mode: eager-all` or `projection.mode: legacy-all` asked for
 * one thing — keep the full rule layer — and the package can still honour that
 * intent without the key: it is exactly what the install receipt's `user_pin`
 * expresses. So for one window those two values are read once and converted
 * into the pin. Every OTHER prior value is dropped, because every other value
 * asked for a form the package now decides for itself from machine evidence,
 * and applying it would reinstate the key under another name.
 *
 * BOTH DISPOSITIONS ARE PRINTED. A value silently honoured and a value silently
 * dropped are indistinguishable to the consumer who wrote it, and the dropped
 * case is the one that changes what their machine does. {@link migrationLines}
 * emits one line per leftover key whichever way it went.
 *
 * THE WINDOW IS NAMED IN THE OUTPUT, NOT ONLY IN A COMMENT. After it closes
 * this module goes and `REMOVED_KEYS` is what remains: a leftover key is then
 * named as ignored by the loader's own deprecation line, with no conversion.
 * That is a deliberate narrowing — the conversion exists to carry an intent
 * across one upgrade, not to become a second settings reader with a longer
 * life than the key it replaced.
 *
 * Pure: it takes a merged settings tree and returns a verdict. It reads no
 * file, writes none, and never throws on a malformed branch — a settings layer
 * nothing can parse must not fail an install.
 */

type SettingsDict = Record<string, unknown>;

/**
 * The release window this conversion is open for, as it appears in every line
 * the module prints. Delete this module when the window closes; the tombstones
 * in `REMOVED_KEYS` carry the keys from then on.
 */
export const MIGRATION_WINDOW = 'one release window after the 2026-10 key removal';

/**
 * Per removed key, the ONE prior value that meant "keep the full layer". Both
 * are the value an absent key already resolved to, which is why they are the
 * only two that survive: honouring them changes nothing about the machine, and
 * dropping them would silently thin a consumer who had asked not to be.
 */
export const LEGACY_FULL_VALUE: Readonly<Record<string, string>> = Object.freeze({
    'lean_projection.mode': 'eager-all',
    'projection.mode': 'legacy-all',
});

export type Disposition = 'pin' | 'dropped';

export interface LegacyRow {
    readonly key: string;
    /** The value as written, trimmed; never normalised onto a known enum. */
    readonly value: string;
    readonly disposition: Disposition;
}

export interface LegacyProjectionIntent {
    /** The receipt pin this upgrade should write, if any leftover asked for the full form. */
    readonly pin: boolean;
    /** One row per leftover key found, in the order of {@link LEGACY_FULL_VALUE}. */
    readonly rows: readonly LegacyRow[];
}

/** One dotted path out of a merged settings tree; `undefined` when absent or unreachable. */
function readDotted(root: SettingsDict, dotted: string): unknown {
    let node: unknown = root;
    for (const part of dotted.split('.')) {
        if (typeof node !== 'object' || node === null || Array.isArray(node)) return undefined;
        node = (node as SettingsDict)[part];
    }
    return node;
}

/**
 * What the leftover projection keys in `merged` ask for, and what is done about
 * it. A key whose value is not a string is not a value this package ever wrote,
 * so it yields no row rather than a guess.
 */
export function readLegacyProjectionIntent(merged: SettingsDict): LegacyProjectionIntent {
    const rows: LegacyRow[] = [];
    let pin = false;
    for (const [key, full] of Object.entries(LEGACY_FULL_VALUE)) {
        const raw = readDotted(merged, key);
        if (typeof raw !== 'string') continue;
        const value = raw.trim();
        if (value === '') continue;
        const disposition: Disposition = value.toLowerCase() === full ? 'pin' : 'dropped';
        if (disposition === 'pin') pin = true;
        rows.push({ key, value, disposition });
    }
    return { pin, rows };
}

/** One line per leftover key, naming what was done with it and for how long this happens. */
export function migrationLines(intent: LegacyProjectionIntent): string[] {
    return intent.rows.map((row) =>
        row.disposition === 'pin'
            ? `${row.key}: "${row.value}" was removed (ADR-293); read once as a request to keep the rule layer full, ` +
              `and kept as the install receipt's pin — ${MIGRATION_WINDOW}.`
            : `${row.key}: "${row.value}" was removed (ADR-293); ignored — the package decides the layer form from ` +
              `machine evidence, and \`doctor --check layer-form\` says which form it chose and why — ${MIGRATION_WINDOW}.`,
    );
}

/**
 * The installer's whole use of this module: read the leftover keys out of the
 * machine's own settings, print what was done with each, and say whether the
 * receipt pin should be written. Returns `false` on any unreadable layer — a
 * settings file nothing can parse states no preference, and the absence of a
 * preference is the full form either way.
 */
export function legacyProjectionPin(
    merged: SettingsDict | null,
    emit: (line: string) => void,
): boolean {
    if (merged === null) return false;
    const intent = readLegacyProjectionIntent(merged);
    for (const line of migrationLines(intent)) emit(line);
    return intent.pin;
}
