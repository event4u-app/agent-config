/**
 * The user brake on the rule layer: `install --full` writes one field into the
 * install receipt, `runtime/carrier.json`, and the layer-form decision is the
 * only reader that acts on it. No settings key, schema entry or wizard question
 * carries it — the brake exists so a user can keep today's full layer without
 * the package growing a setting for it.
 *
 * Sticky by design: a later plain `install` or upgrade leaves the field in
 * place, because a brake that an upgrade silently released would not be one.
 * `agent-config uninstall --global --purge` removes the runtime directory and
 * the field with it; a plain uninstall keeps both.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export const RECEIPT_FILE = 'carrier.json';
export const USER_PIN_FIELD = 'user_pin';

export interface UserPin {
    readonly form: 'full';
    readonly set_at: string;
}

function readReceipt(runtimeRoot: string): Record<string, unknown> {
    try {
        const raw = JSON.parse(fs.readFileSync(path.join(runtimeRoot, RECEIPT_FILE), 'utf8')) as unknown;
        return typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    } catch {
        return {};
    }
}

/** The pin, or `null`. A field that is present but unreadable still reads as a pin: a brake fails on. */
export function readUserPin(runtimeRoot: string): UserPin | null {
    const v = readReceipt(runtimeRoot)[USER_PIN_FIELD];
    if (v === undefined || v === null) return null;
    const o = typeof v === 'object' ? (v as Record<string, unknown>) : {};
    return { form: 'full', set_at: typeof o['set_at'] === 'string' ? o['set_at'] : 'unknown' };
}

/** Write the pin into the receipt, keeping every other field the receipt holds. */
export function writeUserPin(runtimeRoot: string, now: Date = new Date()): UserPin {
    fs.mkdirSync(runtimeRoot, { recursive: true });
    const receipt = readReceipt(runtimeRoot);
    const pin: UserPin = { form: 'full', set_at: now.toISOString().slice(0, 10) };
    receipt[USER_PIN_FIELD] = pin;
    fs.writeFileSync(path.join(runtimeRoot, RECEIPT_FILE), `${JSON.stringify(receipt, null, 2)}\n`);
    return pin;
}

export function describeUserPin(pin: UserPin | null): string | null {
    return pin === null
        ? null
        : `rule layer pinned full by \`install --full\` (since ${pin.set_at}) — the package will not thin it on this machine`;
}

/**
 * `install --enrol`: this machine may be promoted to the thinned layer while
 * the shipped promotion switch is off — the maintainer arm the frozen
 * comparison needs (owner decision E2, 2026-10-28). The decision function
 * still has to say `thinned`; demotion runs unchanged; `--full` wins.
 */
export const ENROLMENT_FIELD = 'enrolment';

export interface Enrolment {
    readonly set_at: string;
}

export function readEnrolment(runtimeRoot: string): Enrolment | null {
    const v = readReceipt(runtimeRoot)[ENROLMENT_FIELD];
    if (v === undefined || v === null) return null;
    const o = typeof v === 'object' ? (v as Record<string, unknown>) : {};
    return { set_at: typeof o['set_at'] === 'string' ? o['set_at'] : 'unknown' };
}

export function writeEnrolment(runtimeRoot: string, now: Date = new Date()): Enrolment {
    fs.mkdirSync(runtimeRoot, { recursive: true });
    const receipt = readReceipt(runtimeRoot);
    const e: Enrolment = { set_at: now.toISOString().slice(0, 10) };
    receipt[ENROLMENT_FIELD] = e;
    fs.writeFileSync(path.join(runtimeRoot, RECEIPT_FILE), `${JSON.stringify(receipt, null, 2)}\n`);
    return e;
}

export function describeEnrolment(e: Enrolment | null, pinned: boolean): string | null {
    if (e === null) return null;
    return pinned
        ? `rule layer enrolled (since ${e.set_at}) but pinned full by \`install --full\` — the pin wins`
        : `rule layer enrolled by \`install --enrol\` (since ${e.set_at}) — a session may thin it once the layer-form decision holds`;
}
