/**
 * The identifier rows: each detects its class only where its proof holds.
 *
 * Every planted value is assembled at runtime, so this file adds nothing to the
 * identifier census over `src/`, and assertions compare by boolean so a failure
 * never prints a planted value.
 */
import { describe, expect, it } from 'vitest';

import {
    CREDENTIAL_RULES,
    detect,
    EGRESS_RULES,
    emailAllowlistDigest,
    IDENTIFIER_RULES,
    isValidGermanTaxId,
    isValidIban,
    isValidUsSsn,
    passesLuhn,
} from './egress_rules.js';

const j = (...parts: string[]): string => parts.join('');
const IBAN = j('DE89', '3704', '0044', '0532', '0130', '00');
const IBAN_SPACED = j('DE89 ', '3704 ', '0044 ', '0532 ', '0130 ', '00');
const IBAN_GB = j('GB82', 'WEST', '1234', '5698', '7654', '32');
const CARD = j('4111', '1111', '1111', '1111');
const CARD_SPACED = j('4111 ', '1111 ', '1111 ', '1111');
const TAX_ID = j('8609', '5742', '719');
const SSN = j('123', '-45-', '6789');
const EMAIL = j('jane.doe', '@', 'galawork-customer', '.de');

const rulesOf = (text: string): string[] => detect(text).map((s) => s.rule);
const has = (text: string, rule: string): boolean => rulesOf(text).includes(rule);

describe('identifier rows — positives', () => {
    it('an IBAN, compact or in groups of four, is one IBAN span covering the value', () => {
        for (const v of [IBAN, IBAN_SPACED, IBAN_GB]) {
            const text = `Bank: ${v}.`;
            const spans = detect(text).filter((s) => s.rule === 'iban');
            expect(spans.length === 1 && text.slice(spans[0]!.start, spans[0]!.end) === v).toBe(true);
        }
    });

    it('a card number with a card word nearby', () => {
        expect(has(`Visa card ${CARD_SPACED}`, 'payment-card')).toBe(true);
        expect(has(`Kreditkarte: ${CARD}`, 'payment-card')).toBe(true);
    });

    it('an e-mail address at a real domain, a .md country domain included', () => {
        expect(has(`write to ${EMAIL} today`, 'email')).toBe(true);
        expect(has(j('contact ', 'person', '@company.md'), 'email')).toBe(true);
    });

    it('a phone number with a country code, or a national one with a phone word', () => {
        expect(has(j('call +49 30 ', '1234 5678'), 'phone-international')).toBe(true);
        expect(has(j('Tel. 030 ', '1234 5678'), 'phone-national')).toBe(true);
        expect(has(j('Telefon: (0221) ', '98765-43'), 'phone-national')).toBe(true);
        expect(has(j('call +49 (30) ', '1234 5678'), 'phone-international')).toBe(true);
        expect(has(j('phone (212) ', '555-0142'), 'phone-nanp')).toBe(true);
    });

    it('a German tax ID with a tax word, and an SSN', () => {
        expect(has(`Steuer-ID ${TAX_ID}`, 'de-tax-id')).toBe(true);
        expect(has(`SSN ${SSN}`, 'us-ssn')).toBe(true);
    });
});

describe('identifier rows — negatives', () => {
    it('a wrong IBAN checksum, a wrong length or an unknown country', () => {
        expect(isValidIban(IBAN.replace('89', '88'))).toBe(false);
        expect(isValidIban(IBAN.slice(0, -1))).toBe(false);
        expect(isValidIban(`ZZ${IBAN.slice(2)}`)).toBe(false);
        expect(has(`Bank: ${IBAN.replace('89', '88')}`, 'iban')).toBe(false);
    });

    it('a Luhn-valid number with no card word, and a card word with a Luhn-invalid number', () => {
        expect(has(`id ${CARD}`, 'payment-card')).toBe(false);
        expect(has(`card ${CARD.replace(/1$/, '2')}`, 'payment-card')).toBe(false);
        expect(passesLuhn(j('0000', '0000', '0000', '0000'))).toBe(false);
    });

    it('a millisecond timestamp and a long numeric id are not cards', () => {
        expect(has(`created ${j('1760', '9120', '00000')} card`, 'payment-card')).toBe(false);
    });

    it('documentation, reserved, no-reply, git remote and file-name addresses are not reported', () => {
        for (const addr of [
            j('alice', '@example.com'),
            j('bob', '@corp.example'),
            j('ci', '@host.test'),
            j('noreply', '@vendor.io'),
            j('do-not-reply', '@vendor.io'),
            j('123+bot', '@users.noreply.github.com'),
            j('git', '@github.com'),
            j('logo', '@2x.png'),
        ]) {
            expect(has(`mail ${addr} now`, 'email'), addr).toBe(false);
        }
    });

    it("the repository's own published identities are allowlisted by digest", () => {
        expect(has(j('dev', '@event4u.app'), 'email')).toBe(false);
        expect(emailAllowlistDigest(j('DEV', '@EVENT4U.APP'))).toBe(emailAllowlistDigest(j('dev', '@event4u.app')));
        expect(has(j('dev2', '@event4u.app'), 'email')).toBe(true);
    });

    it('a decorator after an escaped newline is not an address', () => {
        expect(has('AuditLog\\n\\n@admin.register', 'email')).toBe(false);
    });

    it('an unbalanced parenthesis is not part of a number', () => {
        for (const text of [j('call +49 (30 ', '12345678'), j('call +49 30) ', '12345678')]) {
            const span = detect(text).find((s) => s.type === 'PHONE');
            const covered = span === undefined ? '' : text.slice(span.start, span.end);
            expect(covered.includes('(') || covered.includes(')'), text).toBe(false);
        }
    });

    it('the SSN validator answers false on any input that is not the shape', () => {
        for (const v of ['', '123456789', '123-45-678', 'abc-de-fghi']) expect(isValidUsSsn(v), v).toBe(false);
        expect(isValidUsSsn(SSN)).toBe(true);
    });

    it('a national number with no phone word, and a date after a diff marker', () => {
        expect(has(j('ref 030 ', '1234 5678'), 'phone-national')).toBe(false);
        expect(has('decided on\n+2026-10-01 by the council', 'phone-international')).toBe(false);
    });

    it('a tax ID with no tax word, a broken check digit, or a non-structured run', () => {
        expect(has(`ref ${TAX_ID}`, 'de-tax-id')).toBe(false);
        expect(isValidGermanTaxId(TAX_ID.replace(/9$/, '8'))).toBe(false);
        expect(isValidGermanTaxId(j('1234', '5678', '901'))).toBe(false);
    });

    it('an SSN in a reserved range', () => {
        for (const v of [j('000', '-45-6789'), j('666', '-45-6789'), j('912', '-45-6789'), j('123', '-00-6789'), j('123', '-45-0000')]) {
            expect(has(`SSN ${v}`, 'us-ssn'), v).toBe(false);
        }
    });
});

describe('identifier rows — table invariants', () => {
    it('every identifier row is class identifier and carries a validator, a context or exclusions', () => {
        expect(IDENTIFIER_RULES.length).toBe(8);
        for (const r of IDENTIFIER_RULES) {
            expect(r.class).toBe('identifier');
            expect(r.validator !== undefined || r.context !== undefined || r.exclusions !== undefined, r.rule).toBe(true);
        }
        expect(CREDENTIAL_RULES.length + IDENTIFIER_RULES.length).toBe(EGRESS_RULES.length);
    });

    it('a credential wins an overlap with an identifier', () => {
        const uri = j('postgres://dbuser:', 's3cr3tpassword', '@db.internal.acme.de/x');
        expect(rulesOf(uri)).toEqual(['db-connection-uri']);
    });

    it('stays linear on pathological inputs', () => {
        const inputs = [
            '+' + '1 '.repeat(20_000),
            '0'.repeat(50_000),
            'a'.repeat(30_000) + '@' + 'b.'.repeat(20_000),
            'DE89 '.repeat(20_000),
            '1-'.repeat(30_000),
            'Tel 0' + '12 '.repeat(20_000),
        ];
        for (const text of inputs) {
            const started = Date.now();
            detect(text, IDENTIFIER_RULES);
            expect(Date.now() - started, text.slice(0, 12)).toBeLessThan(2_000);
        }
    });
});
