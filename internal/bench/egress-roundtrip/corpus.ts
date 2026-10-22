/**
 * Two corpora for PREREG (c), identifier half.
 *
 * W1 is the frozen identifier corpus the PREREG names (`tests/fixtures/
 * egress-detection/w1-identifiers.json`, seed 20261019): one phrase per
 * document, five types. W1x is generated at run time from a fixed seed and adds
 * what W1 does not carry: the US SSN and North American phone rows, several
 * identifiers per document, the same value twice, a second spelling of one
 * entity (spaced vs compact), and prose, code, YAML, .env and JSON carriers.
 * Every value is synthetic; checksums are computed, never copied.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { RoundTripDoc } from './scorer.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const W1_PATH = path.join(REPO, 'tests', 'fixtures', 'egress-detection', 'w1-identifiers.json');
export const W1X_SEED = 20261022;
export const W1X_PER_TYPE = 120;

export function loadW1(): RoundTripDoc[] {
    const raw = JSON.parse(fs.readFileSync(W1_PATH, 'utf8')) as {
        documents: Array<{ type: string; text: string; start: number; end: number }>;
    };
    return raw.documents.map((d) => ({ type: d.type, text: d.text, values: [d.text.slice(d.start, d.end)] }));
}

function rng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

interface Value {
    /** The spelling planted first. */
    readonly a: string;
    /** A second spelling of the same entity, or the same bytes when the type has one form. */
    readonly b: string;
}

function makers(r: () => number): Record<string, () => Value> {
    const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)] as T;
    const digits = (n: number): string => Array.from({ length: n }, () => String(Math.floor(r() * 10))).join('');
    const lower = (n: number): string => Array.from({ length: n }, () => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(r() * 26)]).join('');
    const group4 = (s: string): string => s.replace(/(.{4})/g, '$1 ').trim();

    const ibanCheck = (country: string, bban: string): string => {
        let rest = 0;
        for (const ch of `${bban}${country}00`) {
            const n = ch <= '9' ? ch.charCodeAt(0) - 48 : ch.charCodeAt(0) - 55;
            rest = n > 9 ? (rest * 100 + n) % 97 : (rest * 10 + n) % 97;
        }
        return String(98 - rest).padStart(2, '0');
    };
    const luhn = (body: string): string => {
        let sum = 0;
        for (let i = 0; i < body.length; i += 1) {
            let d = body.charCodeAt(body.length - 1 - i) - 48;
            if (i % 2 === 0) {
                d *= 2;
                if (d > 9) d -= 9;
            }
            sum += d;
        }
        return body + String((10 - (sum % 10)) % 10);
    };
    const taxId = (): string => {
        for (;;) {
            const first = digits(10).replace(/^0/, '1');
            const counts = new Map<string, number>();
            for (const ch of first) counts.set(ch, (counts.get(ch) ?? 0) + 1);
            const rep = [...counts.values()].filter((c) => c > 1);
            if (rep.length !== 1 || (rep[0] as number) > 3) continue;
            let product = 10;
            for (const ch of first) {
                let sum = (ch.charCodeAt(0) - 48 + product) % 10;
                if (sum === 0) sum = 10;
                product = (sum * 2) % 11;
            }
            return first + String((11 - product) % 10);
        }
    };
    const ssn = (): string => {
        for (;;) {
            const area = digits(3);
            const group = digits(2);
            const serial = digits(4);
            if (area === '000' || area === '666' || area.startsWith('9') || group === '00' || serial === '0000') continue;
            return `${area}-${group}-${serial}`;
        }
    };
    const nanpPart = (): string => `${String(2 + Math.floor(r() * 8))}${digits(2)}`;

    return {
        IBAN: () => {
            const [country, len] = pick([['DE', 18], ['AT', 16], ['NL', 14], ['FR', 23], ['CH', 17], ['BE', 12]] as const);
            const bban = country === 'NL' ? `${lower(4).toUpperCase()}${digits(10)}` : digits(len);
            const compact = `${country}${ibanCheck(country, bban)}${bban}`;
            return { a: group4(compact), b: compact };
        },
        CARD: () => {
            const n = luhn(`${pick(['4', '51', '52', '55', '37'])}${digits(14)}`.slice(0, 15));
            return { a: n, b: pick([group4(n), n.replace(/(.{4})(?!$)/g, '$1-')]) };
        },
        EMAIL: () => {
            const v = `${lower(5)}.${lower(7)}@${lower(6)}-${pick(['mail', 'post', 'shop', 'kunde'])}.${pick(['de', 'com', 'net', 'eu', 'at'])}`;
            return { a: v, b: v };
        },
        PHONE: () => {
            const intl = `+${pick(['49', '43', '41'])} ${String(1 + Math.floor(r() * 9))}${digits(2)} ${digits(4)} ${digits(3)}`;
            return { a: intl, b: intl.replace(/ /g, '') };
        },
        PHONE_NANP: () => {
            const v = `(${nanpPart()}) ${nanpPart()}-${digits(4)}`;
            return { a: v, b: v.replace(/[() ]/g, '').replace(/-/g, '.').replace(/^(\d{3})/, '$1.') };
        },
        TAXID: () => {
            const v = taxId();
            return { a: v, b: v };
        },
        SSN: () => {
            const v = ssn();
            return { a: v, b: v };
        },
    };
}

/** Carriers per type; each names the value twice — once `a`, once `b` — with the context word its rule wants. */
const CARRIERS: Readonly<Record<string, ReadonlyArray<(v: Value) => string>>> = {
    IBAN: [
        (v) => `Hi team,\n\nthe customer asked us to refund to IBAN ${v.a}. Their earlier mail quoted ${v.b} as well.\n\nThanks,\nSupport`,
        (v) => `billing:\n  iban: "${v.a}"\n  fallback_iban: ${v.b}\n`,
        (v) => `const payout = { iban: '${v.a}', normalized: '${v.b}' };\n`,
        (v) => JSON.stringify({ account: { iban: v.a, iban_compact: v.b } }, null, 2),
    ],
    CARD: [
        (v) => `Customer says the credit card ${v.a} was charged twice; the second card entry reads ${v.b}.`,
        (v) => `payment:\n  card: "${v.a}"\n  card_alt: "${v.b}"\n`,
        (v) => `PAYMENT_CARD=${v.a}\n# visa on file: ${v.b}\n`,
        (v) => JSON.stringify({ payment: { card: v.a, card_display: v.b } }),
    ],
    EMAIL: [
        (v) => `From: ${v.a}\nTo: support@acme-help.de\n\nPlease update my address, write to ${v.b}.\n`,
        (v) => `contact:\n  email: ${v.a}\n  cc: "${v.b}"\n`,
        (v) => `await sendMail({ to: '${v.a}', replyTo: "${v.b}" });\n`,
        (v) => JSON.stringify({ customer: { email: v.a, notify: [v.b] } }),
    ],
    PHONE: [
        (v) => `Call me back on ${v.a} after 5pm, or mobile ${v.b}.`,
        (v) => `contact:\n  phone: "${v.a}"\n  mobile: "${v.b}"\n`,
        (v) => `SUPPORT_PHONE="${v.a}"\nSUPPORT_PHONE_E164=${v.b}\n`,
        (v) => JSON.stringify({ phone: v.a, phone_e164: v.b }),
    ],
    PHONE_NANP: [
        (v) => `Customer phone: ${v.a}. Left a voicemail; call ${v.b} tomorrow.`,
        (v) => `contact:\n  phone: "${v.a}"\n  fax: "${v.b}"\n`,
        (v) => `// phone ${v.a}\nconst cell = 'phone ${v.b}';\n`,
        (v) => JSON.stringify({ note: `phone ${v.a}`, alt: `call ${v.b}` }),
    ],
    TAXID: [
        (v) => `Sehr geehrte Damen und Herren,\nIhre Steuer-ID ${v.a} liegt vor. Bitte die Steuer-ID ${v.b} auf der Rechnung angeben.`,
        (v) => `employee:\n  tax_id: "${v.a}"  # Tax ID\n  steuer-id: ${v.b}\n`,
        (v) => `TAX_ID=${v.a}\n# tax id again: ${v.b}\n`,
        (v) => JSON.stringify({ note: `Tax ID ${v.a}`, idnr: `IdNr ${v.b}` }),
    ],
    SSN: [
        (v) => `Applicant SSN ${v.a} was verified; HR record lists ${v.b}.`,
        (v) => `applicant:\n  ssn: "${v.a}"\n  ssn_confirm: "${v.b}"\n`,
        (v) => `const ssn = '${v.a}'; // matches ${v.b}\n`,
        (v) => JSON.stringify({ ssn: v.a, history: [v.b] }),
    ],
};

/** One mixed document per row: every type in one support-ticket body. */
function mixed(gen: Record<string, () => Value>): RoundTripDoc {
    const v = Object.fromEntries(Object.entries(gen).map(([k, g]) => [k, g()])) as Record<string, Value>;
    const g = (k: string): Value => v[k] as Value;
    const text =
        `Ticket #4471\nCustomer e-mail ${g('EMAIL').a}, phone ${g('PHONE').a}.\n` +
        `Refund to IBAN ${g('IBAN').a}; the credit card ${g('CARD').a} is to be closed.\n` +
        `Steuer-ID ${g('TAXID').a}. US applicant SSN ${g('SSN').a}, office phone ${g('PHONE_NANP').a}.\n` +
        `Repeat for audit: ${g('EMAIL').b}, IBAN ${g('IBAN').b}.\n`;
    const values = Object.values(v).map((x) => x.a).concat([g('EMAIL').b, g('IBAN').b]);
    return { type: 'MIXED', text, values };
}

export function w1x(seed: number = W1X_SEED, perType: number = W1X_PER_TYPE): RoundTripDoc[] {
    const r = rng(seed);
    const gen = makers(r);
    const out: RoundTripDoc[] = [];
    for (const [type, make] of Object.entries(gen)) {
        const carriers = CARRIERS[type] as ReadonlyArray<(v: Value) => string>;
        for (let i = 0; i < perType; i += 1) {
            const v = make();
            const carrier = carriers[i % carriers.length] as (v: Value) => string;
            out.push({ type, text: carrier(v), values: [v.a, v.b] });
        }
    }
    for (let i = 0; i < perType; i += 1) out.push(mixed(gen));
    return out;
}
