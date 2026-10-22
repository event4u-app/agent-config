/**
 * Task set and scorers for PREREG endpoint (e), paired task quality.
 *
 * Every identifier is synthetic and checksum-valid, drawn from a fixed seed, so
 * the whole set is regenerated rather than stored: nothing here or in the
 * results file holds a value the seed does not reproduce.
 *
 * Two families. `review`: a snippet carrying identifiers and exactly one planted
 * defect whose kind has nothing to do with any identifier's value; the answer
 * must name the defect's line and kind. `coding`: a function spec whose worked
 * example carries identifiers; the answer is executed against fresh values the
 * prompt never showed, so a solution that copies the example fails.
 */
import * as vm from 'node:vm';

export const SEED = 20261022;

export const DEFECT_KINDS = ['off-by-one', 'wrong-operator', 'missing-await', 'swapped-arguments', 'wrong-status-code'] as const;
export type DefectKind = (typeof DEFECT_KINDS)[number];

export interface PlantedValue {
    readonly type: 'IBAN' | 'EMAIL' | 'CARD' | 'PHONE' | 'TAXID';
    readonly value: string;
}

export interface ReviewTask {
    readonly id: string;
    readonly family: 'review';
    readonly prompt: string;
    readonly planted: readonly PlantedValue[];
    readonly line: number;
    readonly kind: DefectKind;
}

export interface CodingCase {
    readonly args: readonly unknown[];
    readonly expected: unknown;
}

export interface CodingTask {
    readonly id: string;
    readonly family: 'coding';
    readonly prompt: string;
    readonly planted: readonly PlantedValue[];
    readonly fn: string;
    readonly cases: readonly CodingCase[];
}

export type Task = ReviewTask | CodingTask;

export function rng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export interface Gen {
    iban(spaced?: boolean): string;
    email(): string;
    card(spaced?: boolean): string;
    phone(): string;
    taxId(): string;
    pick<T>(xs: readonly T[]): T;
}

export function generators(r: () => number): Gen {
    const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)] as T;
    const digits = (n: number): string => Array.from({ length: n }, () => String(Math.floor(r() * 10))).join('');
    const word = (n: number): string => Array.from({ length: n }, () => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(r() * 26)]).join('');
    const ibanCheck = (country: string, bban: string): string => {
        let rest = 0;
        for (const ch of `${bban}${country}00`) {
            const n = ch <= '9' ? ch.charCodeAt(0) - 48 : ch.charCodeAt(0) - 55;
            rest = n > 9 ? (rest * 100 + n) % 97 : (rest * 10 + n) % 97;
        }
        return String(98 - rest).padStart(2, '0');
    };
    const luhnComplete = (body: string): string => {
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
    return {
        pick,
        iban(spaced = r() < 0.5) {
            const [country, len] = pick([['DE', 18], ['AT', 16], ['FR', 23], ['CH', 17]] as const);
            const bban = digits(len);
            const compact = `${country}${ibanCheck(country, bban)}${bban}`;
            return spaced ? compact.replace(/(.{4})/g, '$1 ').trim() : compact;
        },
        email: () => `${word(5)}.${word(6)}@${word(7)}-${pick(['mail', 'post', 'kunde'])}.${pick(['de', 'com', 'net', 'eu'])}`,
        card(spaced = r() < 0.5) {
            const n = luhnComplete(`4${digits(14)}`);
            return spaced ? n.replace(/(.{4})/g, '$1 ').trim() : n;
        },
        phone: () => `+${pick(['49', '43', '41', '33'])} ${digits(3)} ${digits(4)} ${digits(3)}`,
        taxId() {
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
        },
    };
}

/** A snippet: `{IBAN}`-style slots are filled per instance; `defect` is the 1-based line. */
interface Snippet {
    readonly name: string;
    readonly kind: DefectKind;
    readonly defect: number;
    readonly lines: readonly string[];
}

const SNIPPETS: readonly Snippet[] = [
    {
        name: 'export-rows',
        kind: 'off-by-one',
        defect: 9,
        lines: [
            'const customers = [',
            "  { name: 'Muster', email: '{EMAIL}', iban: '{IBAN}' },",
            "  { name: 'Beispiel', email: '{EMAIL}', iban: '{IBAN}' },",
            "  { name: 'Probe', email: '{EMAIL}', iban: '{IBAN}' },",
            '];',
            '',
            'export function exportRows(list) {',
            '  const rows = [];',
            '  for (let i = 0; i <= list.length; i++) {',
            '    rows.push(`${list[i].name};${list[i].email};${list[i].iban}`);',
            '  }',
            "  return rows.join('\\n');",
            '}',
            '',
            'console.log(exportRows(customers));',
        ],
    },
    {
        name: 'approval-limit',
        kind: 'wrong-operator',
        defect: 11,
        lines: [
            'interface Payment { iban: string; amountCents: number; }',
            'declare function notifyApprover(iban: string): void;',
            'const MAX_TRANSFER_CENTS = 1_000_000;',
            'const payments: Payment[] = [',
            "  { iban: '{IBAN}', amountCents: 25_000 },",
            "  { iban: '{IBAN}', amountCents: 2_500_000 },",
            '];',
            '',
            '/** Transfers above the limit need a second approver. */',
            'export function needsApproval(p: Payment): boolean {',
            '  return p.amountCents < MAX_TRANSFER_CENTS;',
            '}',
            '',
            'for (const p of payments) {',
            '  if (needsApproval(p)) notifyApprover(p.iban);',
            '}',
        ],
    },
    {
        name: 'remind-customer',
        kind: 'missing-await',
        defect: 11,
        lines: [
            "import { sendMail } from './mailer';",
            "import { customers } from './db';",
            '',
            '// fixture customer: {EMAIL}, phone {PHONE}',
            '',
            'async function loadCustomer(id: string): Promise<{ email: string; name: string }> {',
            '  return customers.findById(id);',
            '}',
            '',
            'export async function remindCustomer(id: string): Promise<void> {',
            '  const customer = loadCustomer(id);',
            "  await sendMail(customer.email, 'Your invoice is due', `Hello ${customer.name}`);",
            '}',
        ],
    },
    {
        name: 'refund',
        kind: 'swapped-arguments',
        defect: 10,
        lines: [
            'declare function transfer(fromIban: string, toIban: string, amountCents: number): Promise<void>;',
            '',
            "const COMPANY_ACCOUNT = '{IBAN}';",
            '',
            '// Test customer account: {IBAN}',
            '',
            '/** Money goes from the company account back to the customer. */',
            'export async function refund(customerIban: string, amountCents: number): Promise<void> {',
            '  if (amountCents <= 0) return;',
            '  await transfer(customerIban, COMPANY_ACCOUNT, amountCents);',
            '}',
        ],
    },
    {
        name: 'customer-by-tax-id',
        kind: 'wrong-status-code',
        defect: 6,
        lines: [
            '// seed data: Steuer-ID {TAXID}, contact {EMAIL}',
            '',
            "app.get('/customers/:taxId', async (req, res) => {",
            '  const customer = await repo.findByTaxId(req.params.taxId);',
            '  if (!customer) {',
            "    return res.status(200).json({ error: 'customer not found' });",
            '  }',
            '  return res.status(200).json(customer);',
            '});',
        ],
    },
    {
        name: 'mask-card',
        kind: 'off-by-one',
        defect: 5,
        lines: [
            "// card on file for the demo account: {CARD}",
            '',
            '/** Shows only the last four digits of a card number. */',
            'export function maskCard(cardNumber: string): string {',
            "  const lastFour = cardNumber.replace(/\\D/g, '').slice(-5);",
            "  return '**** **** **** ' + lastFour;",
            '}',
        ],
    },
    {
        name: 'external-recipients',
        kind: 'wrong-operator',
        defect: 9,
        lines: [
            "const INTERNAL_DOMAIN = 'acme-intern.example';",
            'const recipients = [',
            "  '{EMAIL}',",
            "  '{EMAIL}',",
            "  '{EMAIL}',",
            '];',
            '',
            '/** Only recipients outside the company get the newsletter. */',
            "export const external = recipients.filter((r) => r.split('@')[1] === INTERNAL_DOMAIN);",
        ],
    },
    {
        name: 'charge-all',
        kind: 'missing-await',
        defect: 11,
        lines: [
            'interface Order { card: string; cents: number; }',
            'declare function chargeCard(card: string, cents: number): Promise<{ id: string }>;',
            '',
            "// payment fixture, card {CARD}",
            "const orders: Order[] = [{ card: '{CARD}', cents: 1999 }];",
            '',
            'export async function chargeAll(list: Order[]): Promise<string[]> {',
            '  const ids: string[] = [];',
            '  for (const o of list) {',
            '    if (o.cents === 0) continue;',
            '    const receipt = chargeCard(o.card, o.cents);',
            '    ids.push(receipt.id);',
            '  }',
            '  return ids;',
            '}',
        ],
    },
    {
        name: 'sms-notify',
        kind: 'swapped-arguments',
        defect: 8,
        lines: [
            'declare function sendSms(phone: string, message: string): Promise<void>;',
            '',
            "const ON_CALL_PHONE = '{PHONE}';",
            "const BACKUP_PHONE = '{PHONE}';",
            '',
            'export async function page(message: string, primary = true): Promise<void> {',
            '  const to = primary ? ON_CALL_PHONE : BACKUP_PHONE;',
            '  await sendSms(message, to);',
            '}',
        ],
    },
    {
        name: 'auth-guard',
        kind: 'wrong-status-code',
        defect: 6,
        lines: [
            '// support contact for locked accounts: {EMAIL}',
            '',
            'export function requireToken(req, res, next) {',
            "  const token = req.headers['authorization'];",
            '  if (!token) {',
            "    return res.status(500).send('missing bearer token');",
            '  }',
            '  req.token = token;',
            '  return next();',
            '}',
        ],
    },
    {
        name: 'paginate',
        kind: 'off-by-one',
        defect: 9,
        lines: [
            'const contacts = [',
            "  { email: '{EMAIL}', phone: '{PHONE}' },",
            "  { email: '{EMAIL}', phone: '{PHONE}' },",
            '];',
            '',
            '/** Returns page `page` (1-based) of `size` rows. */',
            'export function pageOf<T>(rows: T[], page: number, size: number): T[] {',
            '  if (page < 1 || size < 1) return [];',
            '  const start = (page - 1) * size + 1;',
            '  return rows.slice(start, start + size);',
            '}',
        ],
    },
    {
        name: 'retry-webhook',
        kind: 'wrong-operator',
        defect: 9,
        lines: [
            'declare function post(url: string, body: unknown): Promise<boolean>;',
            'const MAX_RETRIES = 3;',
            '',
            "const payload = { iban: '{IBAN}', notify: '{EMAIL}' };",
            '',
            '/** Retries the webhook up to MAX_RETRIES times. */',
            'export async function deliver(url: string): Promise<boolean> {',
            '  let attempt = 0;',
            '  while (attempt > MAX_RETRIES) {',
            '    if (await post(url, payload)) return true;',
            '    attempt += 1;',
            '  }',
            '  return false;',
            '}',
        ],
    },
    {
        name: 'format-contact',
        kind: 'swapped-arguments',
        defect: 9,
        lines: [
            '/** "Name <email>" for the address header. */',
            'function formatContact(name: string, email: string): string {',
            '  return `${name} <${email}>`;',
            '}',
            '',
            "const owner = { name: 'Erika Muster', email: '{EMAIL}', phone: '{PHONE}' };",
            '',
            'export function headerFor(o: typeof owner): string {',
            '  return formatContact(o.email, o.name);',
            '}',
        ],
    },
    {
        name: 'save-invoice',
        kind: 'missing-await',
        defect: 8,
        lines: [
            'declare function saveInvoice(iban: string, cents: number): Promise<void>;',
            'declare const log: { error(e: unknown): void };',
            '',
            "const DEFAULT_PAYER = '{IBAN}';",
            '',
            'export async function book(cents: number, iban = DEFAULT_PAYER): Promise<boolean> {',
            '  try {',
            '    saveInvoice(iban, cents);',
            '    return true;',
            '  } catch (e) {',
            '    log.error(e);',
            '    return false;',
            '  }',
            '}',
        ],
    },
    {
        name: 'validate-iban-route',
        kind: 'wrong-status-code',
        defect: 6,
        lines: [
            '// example request body: { "iban": "{IBAN}", "email": "{EMAIL}" }',
            '',
            "app.post('/mandates', async (req, res) => {",
            '  const { iban, email } = req.body;',
            '  if (!isValidIban(iban)) {',
            "    return res.status(500).json({ error: 'invalid iban' });",
            '  }',
            '  const mandate = await mandates.create({ iban, email });',
            '  return res.status(201).json(mandate);',
            '});',
        ],
    },
    {
        name: 'iban-country',
        kind: 'off-by-one',
        defect: 5,
        lines: [
            "const SUPPORTED = new Set(['DE', 'AT', 'CH', 'FR']);",
            "const sample = '{IBAN}';",
            '',
            'export function isSupported(iban: string): boolean {',
            "  const country = iban.replace(/\\s+/g, '').slice(0, 3).toUpperCase(); // ISO 3166 alpha-2",
            '  return SUPPORTED.has(country);',
            '}',
            '',
            'console.log(isSupported(sample));',
        ],
    },
];

function fill(lines: readonly string[], g: Gen): { text: string; planted: PlantedValue[] } {
    const planted: PlantedValue[] = [];
    const out = lines.map((l) =>
        l.replace(/\{(IBAN|EMAIL|CARD|PHONE|TAXID)\}/g, (_m, t: PlantedValue['type']) => {
            const value = t === 'IBAN' ? g.iban() : t === 'EMAIL' ? g.email() : t === 'CARD' ? g.card() : t === 'PHONE' ? g.phone() : g.taxId();
            planted.push({ type: t, value });
            return value;
        }),
    );
    return { text: out.map((l, i) => `${String(i + 1).padStart(2, ' ')}| ${l}`).join('\n'), planted };
}

export function reviewPrompt(snippet: string): string {
    return [
        'Review the following code. It contains exactly one defect, of one of these kinds:',
        DEFECT_KINDS.join(', ') + '.',
        'Each line is prefixed with its line number.',
        '',
        snippet,
        '',
        'Reply with exactly one line of JSON and nothing else: {"line": <line number of the defect>, "kind": "<one of the kinds above>"}',
    ].join('\n');
}

interface CodingTemplate {
    readonly name: string;
    readonly fn: string;
    readonly spec: (g: Gen) => { text: string; planted: PlantedValue[] };
    readonly cases: (g: Gen) => CodingCase[];
}

const sortKeys = (o: Record<string, number>): Record<string, number> =>
    Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));

const CODING: readonly CodingTemplate[] = [
    {
        name: 'format-contact',
        fn: 'formatContact',
        spec(g) {
            const email = g.email();
            const phone = g.phone();
            return {
                text:
                    'Write `formatContact(record)`. `record` has `name`, `email` and `phone`; return the string `"<name> <<email>>"` (name, a space, the email in angle brackets) and ignore the phone.\n' +
                    `Example: formatContact({ name: 'Erika Muster', email: '${email}', phone: '${phone}' }) returns 'Erika Muster <${email}>'.`,
                planted: [{ type: 'EMAIL', value: email }, { type: 'PHONE', value: phone }],
            };
        },
        cases(g) {
            return ['Max Beispiel', 'Ana Probe', 'Li Test'].map((name) => {
                const email = g.email();
                return { args: [{ name, email, phone: g.phone() }], expected: `${name} <${email}>` };
            });
        },
    },
    {
        name: 'normalize-phone',
        fn: 'normalizePhone',
        spec(g) {
            const phone = g.phone();
            return {
                text:
                    'Write `normalizePhone(s)`: remove every space, dot, dash, slash and parenthesis from the phone number `s` and keep everything else, including a leading `+`.\n' +
                    `Example: normalizePhone('${phone}') returns '${phone.replace(/[\s().\-/]+/g, '')}'.`,
                planted: [{ type: 'PHONE', value: phone }],
            };
        },
        cases(g) {
            return [0, 1, 2].map((i) => {
                const p = g.phone();
                const spelled = i === 1 ? p.replace(/ /g, '-') : i === 2 ? p.replace(' ', ' (').replace(/ (\d{4})/, ') $1') : p;
                return { args: [spelled], expected: spelled.replace(/[\s().\-/]+/g, '') };
            });
        },
    },
    {
        name: 'iban-country',
        fn: 'ibanCountry',
        spec(g) {
            const iban = g.iban(true);
            return {
                text:
                    'Write `ibanCountry(iban)`: return the two-letter country code an IBAN starts with, upper-cased, ignoring leading whitespace.\n' +
                    `Example: ibanCountry('${iban}') returns '${iban.slice(0, 2)}'.`,
                planted: [{ type: 'IBAN', value: iban }],
            };
        },
        cases(g) {
            return [g.iban(true), `  ${g.iban(false)}`, g.iban(false).toLowerCase()].map((s) => ({ args: [s], expected: s.trim().slice(0, 2).toUpperCase() }));
        },
    },
    {
        name: 'group-by-domain',
        fn: 'countByDomain',
        spec(g) {
            const a = g.email();
            const b = g.email();
            const c = `${a.split('@')[0]}x@${a.split('@')[1]}`;
            const counts: Record<string, number> = {};
            for (const e of [a, b, c]) counts[e.split('@')[1] as string] = (counts[e.split('@')[1] as string] ?? 0) + 1;
            return {
                text:
                    'Write `countByDomain(emails)`: given an array of e-mail addresses, return an object mapping each domain (the part after `@`, lower-cased) to how many addresses use it.\n' +
                    `Example: countByDomain(['${a}', '${b}', '${c}']) returns ${JSON.stringify(sortKeys(counts))}.`,
                planted: [{ type: 'EMAIL', value: a }, { type: 'EMAIL', value: b }, { type: 'EMAIL', value: c }],
            };
        },
        cases(g) {
            return [0, 1].map(() => {
                const list = [g.email(), g.email(), g.email(), g.email()];
                list.push(list[0]!.replace('@', '1@').toUpperCase());
                const counts: Record<string, number> = {};
                for (const e of list) {
                    const d = (e.split('@')[1] as string).toLowerCase();
                    counts[d] = (counts[d] ?? 0) + 1;
                }
                return { args: [list], expected: sortKeys(counts) };
            });
        },
    },
    {
        name: 'last-four',
        fn: 'lastFour',
        spec(g) {
            const card = g.card(true);
            return {
                text:
                    'Write `lastFour(cardNumber)`: return the last four digits of a payment card number as a string, ignoring spaces and dashes.\n' +
                    `Example: for the card number '${card}', lastFour returns '${card.replace(/\D/g, '').slice(-4)}'.`,
                planted: [{ type: 'CARD', value: card }],
            };
        },
        cases(g) {
            return [g.card(true), g.card(false).replace(/(\d{2})$/, ' $1'), g.card(true).replace(/ /g, '-')].map((c) => ({ args: [c], expected: c.replace(/\D/g, '').slice(-4) }));
        },
    },
    {
        name: 'total-by-iban',
        fn: 'totalByIban',
        spec(g) {
            const a = g.iban(true);
            const b = g.iban(false);
            const ca = a.replace(/\s+/g, '');
            return {
                text:
                    'Write `totalByIban(payments)`: `payments` is an array of `{ iban, cents }`; return an object mapping each IBAN, with spaces removed and upper-cased, to the sum of its `cents`.\n' +
                    `Example: totalByIban([{ iban: '${a}', cents: 100 }, { iban: '${b}', cents: 50 }, { iban: '${ca}', cents: 25 }]) returns ${JSON.stringify(sortKeys({ [ca]: 125, [b]: 50 }))}.`,
                planted: [{ type: 'IBAN', value: a }, { type: 'IBAN', value: b }],
            };
        },
        cases(g) {
            return [0, 1].map(() => {
                const x = g.iban(true);
                const y = g.iban(false);
                const cx = x.replace(/\s+/g, '');
                return {
                    args: [[{ iban: x, cents: 300 }, { iban: y, cents: 7 }, { iban: cx.toLowerCase(), cents: 1 }, { iban: y, cents: 3 }]],
                    expected: sortKeys({ [cx]: 301, [y]: 10 }),
                };
            });
        },
    },
];

export function codingPrompt(fn: string, spec: string): string {
    return [
        spec,
        '',
        `Reply with one \`\`\`javascript code block that defines \`function ${fn}(...)\` in plain JavaScript (no imports, no TypeScript, no tests), and nothing else.`,
    ].join('\n');
}

/** The full task set: 16 snippets × 3 instances, then 6 coding templates × 2 instances. */
export function generateTasks(seed: number = SEED): Task[] {
    const g = generators(rng(seed));
    const tasks: Task[] = [];
    for (let inst = 0; inst < 3; inst += 1) {
        for (const s of SNIPPETS) {
            const { text, planted } = fill(s.lines, g);
            tasks.push({ id: `review-${s.name}-${String(inst)}`, family: 'review', prompt: reviewPrompt(text), planted, line: s.defect, kind: s.kind });
        }
    }
    for (let inst = 0; inst < 2; inst += 1) {
        for (const c of CODING) {
            const { text, planted } = c.spec(g);
            tasks.push({ id: `coding-${c.name}-${String(inst)}`, family: 'coding', prompt: codingPrompt(c.fn, text), planted, fn: c.fn, cases: c.cases(g) });
        }
    }
    return tasks;
}

/** Strict: one JSON object, optionally inside one ```json fence, naming exactly the planted line and kind. */
export function scoreReview(answer: string, task: Pick<ReviewTask, 'line' | 'kind'>): boolean {
    let body = answer.trim();
    const fence = body.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
    if (fence) body = (fence[1] as string).trim();
    if (body.split('\n').length !== 1) return false;
    let parsed: unknown;
    try {
        parsed = JSON.parse(body);
    } catch {
        return false;
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return false;
    const o = parsed as Record<string, unknown>;
    if (Object.keys(o).sort().join(',') !== 'kind,line') return false;
    return o['line'] === task.line && o['kind'] === task.kind;
}

function canonical(v: unknown): string {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        return `{${Object.keys(v as object)
            .sort()
            .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
            .join(',')}}`;
    }
    if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
    return JSON.stringify(v) ?? 'undefined';
}

/** Runs the answer's last javascript block in a fresh context and checks every case. */
export function scoreCoding(answer: string, task: Pick<CodingTask, 'fn' | 'cases'>): boolean {
    const blocks = [...answer.matchAll(/```(?:javascript|js)\s*\n([\s\S]*?)```/g)];
    const code = blocks.at(-1)?.[1];
    if (code === undefined) return false;
    try {
        const sandbox: Record<string, unknown> = {};
        vm.runInNewContext(`${code}\n;globalThis.__fn = typeof ${task.fn} === 'function' ? ${task.fn} : undefined;`, sandbox, { timeout: 1000 });
        const f = sandbox['__fn'];
        if (typeof f !== 'function') return false;
        for (const c of task.cases) {
            const args = JSON.parse(JSON.stringify(c.args)) as unknown[];
            const got: unknown = vm.runInNewContext('__f(...__a)', { __f: f, __a: args }, { timeout: 1000 });
            if (canonical(JSON.parse(JSON.stringify(got ?? null))) !== canonical(c.expected)) return false;
        }
        return true;
    } catch {
        return false;
    }
}

export function score(answer: string, task: Task): boolean {
    return task.family === 'review' ? scoreReview(answer, task) : scoreCoding(answer, task);
}
