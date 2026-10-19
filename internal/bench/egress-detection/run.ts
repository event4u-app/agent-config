/**
 * PREREG endpoints (a) recall per class and (b) precision on code, for the
 * identifier rows of the egress rule table.
 *
 *   node_modules/.bin/tsx internal/bench/egress-detection/run.ts --write-corpus   # once, freezes the corpus
 *   node_modules/.bin/tsx internal/bench/egress-detection/run.ts                  # self-test, then score
 *
 * The corpus is generated from a fixed seed and frozen under
 * `tests/fixtures/egress-detection/`; scoring reads the frozen files, never a
 * fresh generation. Before a reading counts, the scorer must reject a planted
 * defect: the IBAN row with its checksum disabled has to fail endpoint (b).
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { detect, EGRESS_RULES, type EgressRule, IDENTIFIER_RULES } from '../../../src/scripts/_lib/egress_rules.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const CORPUS = path.join(REPO, 'tests', 'fixtures', 'egress-detection');
const SEED = 20261019;
const PER_TYPE = 200;

interface Planted {
    readonly type: string;
    readonly text: string;
    readonly start: number;
    readonly end: number;
}
interface Negative {
    readonly label: string;
    readonly text: string;
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

function generate(): { w1: Planted[]; negatives: Negative[] } {
    const r = rng(SEED);
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
    const iban = (): string => {
        const [country, len] = pick([['DE', 18], ['AT', 16], ['NL', 14], ['FR', 23], ['CH', 17]] as const);
        const bban = country === 'NL' ? `${word(4).toUpperCase()}${digits(10)}` : digits(len);
        const compact = `${country}${ibanCheck(country, bban)}${bban}`;
        return r() < 0.5 ? compact : compact.replace(/(.{4})/g, '$1 ').trim();
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
    const card = (): string => {
        const n = luhnComplete(`${pick(['4', '51', '52', '37'])}${digits(14)}`.slice(0, 15));
        return r() < 0.5 ? n : n.replace(/(.{4})/g, '$1 ').trim();
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
    const email = (): string => `${word(5)}.${word(6)}@${word(7)}-${pick(['mail', 'post', 'kunde'])}.${pick(['de', 'com', 'net', 'eu', 'io'])}`;
    const phoneIntl = (): string => `+${pick(['49', '43', '41', '33', '1'])} ${digits(3)} ${digits(4)} ${digits(3)}`;
    const phoneNational = (): string => `0${digits(3).replace(/^0/, '3')} ${digits(4)} ${digits(3)}`;

    const templates: ReadonlyArray<readonly [string, () => string, readonly string[]]> = [
        ['IBAN', iban, ['Please transfer the refund to {v} by Friday.', 'Bank: {v}\nReference: INV-2041', 'Kontoinhaber Muster, IBAN {v}.']],
        ['EMAIL', email, ['Reply to {v} with the signed form.', 'Contact: {v}', 'Ticket opened by {v} (customer).']],
        ['CARD', card, ['The card number on file is {v}.', 'Kreditkarte: {v}, gültig bis 09/29.', 'Payment with Visa {v} failed.']],
        ['PHONE', phoneIntl, ['Call me back on {v} after 5pm.', 'Mobile: {v}', 'Reachable at {v}.']],
        ['PHONE', phoneNational, ['Tel. {v} (Zentrale)', 'Telefon: {v}', 'Phone {v}, ask for billing.']],
        ['TAXID', taxId, ['Steuer-ID {v} liegt vor.', 'Tax ID: {v}', 'Ihre Identifikationsnummer {v} wurde geprüft.']],
    ];
    const w1: Planted[] = [];
    for (const [type, gen, phrases] of templates) {
        for (let i = 0; i < PER_TYPE; i += 1) {
            const v = gen();
            const phrase = pick(phrases);
            const at = phrase.indexOf('{v}');
            const text = phrase.replace('{v}', v);
            w1.push({ type, text, start: at, end: at + v.length });
        }
    }
    const badIban = (): string => {
        const good = iban().replace(/ /g, '');
        const check = good.slice(2, 4);
        return `${good.slice(0, 2)}${check === '99' ? '98' : String(Number(check) + 1).padStart(2, '0')}${good.slice(4)}`;
    };
    const negatives: Negative[] = [];
    for (let i = 0; i < 40; i += 1) {
        negatives.push({ label: 'iban-bad-checksum', text: `Account ${badIban()} on the form.` });
        negatives.push({ label: 'fixture-address', text: `user${i}@${pick(['example.com', 'example.org', 'corp.example', 'ci.test', 'localhost'])}` });
        negatives.push({ label: 'no-reply', text: `From: ${pick(['noreply', 'no-reply', 'donotreply'])}@${word(6)}.com` });
        negatives.push({ label: 'commit-identity', text: `${digits(8)}+${word(6)}@users.noreply.github.com` });
        negatives.push({ label: 'card-shaped-no-context', text: `const id = '${card().replace(/ /g, '')}';` });
        negatives.push({ label: 'hash', text: `sha256: ${Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(r() * 16)]).join('')}` });
        negatives.push({ label: 'uuid', text: `id ${word(8)}-4${digits(3)}-a${digits(3)}-${digits(12)}` });
        negatives.push({ label: 'diff-date', text: `as decided on\n+2026-${String(1 + (i % 12)).padStart(2, '0')}-1${i % 10}` });
        negatives.push({ label: 'retina-asset', text: `<img src="logo@2x.png">` });
        negatives.push({ label: 'git-remote', text: `git clone git@github.com:acme/${word(6)}.git` });
    }
    return { w1, negatives };
}

interface Reading {
    readonly recall: Record<string, { found: number; total: number }>;
    readonly negativeHits: Record<string, number>;
    readonly tree: { files: number; withHit: number };
}

function score(rules: readonly EgressRule[], w1: readonly Planted[], negatives: readonly Negative[], withTree: boolean): Reading {
    const recall: Record<string, { found: number; total: number }> = {};
    for (const p of w1) {
        const row = (recall[p.type] ??= { found: 0, total: 0 });
        row.total += 1;
        if (detect(p.text, rules).some((s) => s.type === p.type && s.start <= p.start && p.end <= s.end)) row.found += 1;
    }
    const negativeHits: Record<string, number> = {};
    for (const n of negatives) {
        const hits = detect(n.text, rules).filter((s) => s.class === 'identifier').length;
        negativeHits[n.label] = (negativeHits[n.label] ?? 0) + hits;
    }
    let files = 0;
    let withHit = 0;
    if (withTree) {
        const listed = execFileSync('git', ['-C', REPO, 'ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
        for (const f of listed) {
            if (f.startsWith('tests/fixtures/egress-detection/')) continue;
            let body: Buffer;
            try {
                body = fs.readFileSync(path.join(REPO, f));
            } catch {
                continue;
            }
            if (body.length > 2_000_000 || body.includes(0)) continue;
            files += 1;
            if (detect(body.toString('utf8'), rules).some((s) => s.class === 'identifier')) withHit += 1;
        }
    }
    return { recall, negativeHits, tree: { files, withHit } };
}

/** The bars of PREREG (a) and (b). */
function verdicts(r: Reading): { a: boolean; b: boolean } {
    const at = (t: string): number => (r.recall[t] ? r.recall[t].found / r.recall[t].total : 0);
    const a = at('EMAIL') >= 0.99 && at('IBAN') >= 0.99;
    const emailIbanNegatives = Object.values(r.negativeHits).reduce((x, y) => x + y, 0);
    const b = emailIbanNegatives === 0 && (r.tree.files === 0 || r.tree.withHit / r.tree.files < 0.01);
    return { a, b };
}

function main(): void {
    if (process.argv.includes('--write-corpus')) {
        fs.mkdirSync(CORPUS, { recursive: true });
        const { w1, negatives } = generate();
        fs.writeFileSync(path.join(CORPUS, 'w1-identifiers.json'), JSON.stringify({ seed: SEED, documents: w1 }, null, 2) + '\n');
        fs.writeFileSync(path.join(CORPUS, 'w4-negatives.json'), JSON.stringify({ seed: SEED, documents: negatives }, null, 2) + '\n');
        process.stdout.write(`corpus written: ${w1.length} planted, ${negatives.length} negatives\n`);
        return;
    }
    const w1 = (JSON.parse(fs.readFileSync(path.join(CORPUS, 'w1-identifiers.json'), 'utf8')) as { documents: Planted[] }).documents;
    const negatives = (JSON.parse(fs.readFileSync(path.join(CORPUS, 'w4-negatives.json'), 'utf8')) as { documents: Negative[] }).documents;

    const broken = EGRESS_RULES.map((r) => (r.rule === 'iban' ? { ...r, validator: () => true } : r));
    const planted = verdicts(score(broken, w1, negatives, false));
    if (planted.b) {
        process.stderr.write('self-test FAILED: the scorer passed endpoint (b) with the IBAN checksum disabled\n');
        process.exit(1);
    }
    process.stdout.write('self-test passed: the IBAN checksum disabled fails endpoint (b)\n');

    const reading = score(EGRESS_RULES, w1, negatives, true);
    const v = verdicts(reading);
    process.stdout.write(
        JSON.stringify({ identifierRules: IDENTIFIER_RULES.map((r) => r.rule), ...reading, verdicts: v }, null, 2) + '\n',
    );
}

main();
