import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { descendantsNamed, parseXml, XmlRefused } from '../../../src/scripts/code_graph/lanes/interfaces/xml.js';

const EVIL = path.resolve(__dirname, '..', '..', 'fixtures', 'code-graph', 'interfaces', 'p5', 'resources', 'wsdl', 'evil.wsdl');

function refusal(text: string, cap?: number): string | null {
    try {
        parseXml(text, cap);
        return null;
    } catch (e) {
        return e instanceof XmlRefused ? e.reason : `other: ${String(e)}`;
    }
}

describe('contract XML reader', () => {
    it('parses elements, prefixes, attributes and start lines', () => {
        const root = parseXml('<?xml version="1.0"?>\n<a:root x="1">\n  <!-- c -->\n  <a:child name="n &amp; m"/>\n  <b><![CDATA[<raw>]]></b>\n</a:root>\n');
        expect(root.name).toBe('root');
        expect(root.prefix).toBe('a');
        expect(root.attrs['x']).toBe('1');
        const child = descendantsNamed(root, 'child')[0];
        expect(child?.attrs['name']).toBe('n & m');
        expect(child?.line).toBe(4);
        expect(descendantsNamed(root, 'b')[0]?.text).toBe('<raw>');
    });

    it('refuses the entity-expansion and external-entity WSDL fixture', () => {
        expect(refusal(fs.readFileSync(EVIL, 'utf8'))).toMatch(/entity/);
    });

    it('refuses an external entity alone', () => {
        expect(refusal('<!DOCTYPE r [<!ENTITY x SYSTEM "file:///etc/hosts">]><r>&x;</r>')).toMatch(/entity/);
    });

    it('keeps an undeclared entity reference as literal text', () => {
        expect(parseXml('<r>&ghost;</r>').text).toBe('&ghost;');
    });

    it('skips a DOCTYPE without entity declarations', () => {
        expect(parseXml('<!DOCTYPE r><r>t</r>').text).toBe('t');
    });

    it('refuses input above the size cap before parsing', () => {
        expect(refusal(`<r>${'a'.repeat(200)}</r>`, 100)).toMatch(/larger than 100 bytes/);
    });

    it('refuses malformed input', () => {
        expect(refusal('<r><a></r>')).toMatch(/mismatched/);
        expect(refusal('<r>')).toMatch(/unclosed/);
        expect(refusal('just text')).toMatch(/no root/);
    });
});
