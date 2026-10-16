/**
 * The rule table is the only place a raw-key prefix is spelled (road-to-one-
 * detector-and-the-senders-we-own step 2.2). Every non-test TypeScript file under
 * src/scripts and src/cli is read; a code line outside egress_rules.ts that spells
 * one of the table's declared prefixes at a token start fails.
 *
 * What this sees and what it does not: it sees a prefix written as a literal, in
 * a string or a regex (backslash escapes removed first, so `ya29\.` counts). It
 * does not see a prefix spelled through a character class (`gh[pousr]_`) or a
 * keyword assignment (`password =`), which carry no vendor literal; those are
 * named in the roadmap as the step's open remainder.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { CREDENTIAL_PREFIXES } from './egress_rules.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const SCAN_DIRS = ['src/scripts', 'src/cli'];
const OWNER = 'src/scripts/_lib/egress_rules.ts';

function walk(dir: string, out: string[]): void {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (e.name === 'node_modules' || e.name === 'fixtures') continue;
            walk(p, out);
        } else if (/\.(ts|mts)$/.test(e.name) && !/\.(test|spec)\.ts$/.test(e.name)) {
            out.push(p);
        }
    }
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A prefix at a token start; `task-` does not spell `sk-`. */
function prefixSpelling(prefixes: readonly string[]): RegExp {
    const alt = [...prefixes].sort((a, b) => b.length - a.length).map(escapeRe).join('|');
    return new RegExp(`(?<![A-Za-z0-9])(?:${alt})`);
}

// A line that names a prefix in prose or as an inert fake value, not as a
// pattern, carries this marker with a reason; a bare marker does not mute.
const NOT_A_PATTERN = /not-a-credential-pattern: \S/;

/** Lines that spell a prefix, comments and reasoned markers excluded. */
function offendingLines(text: string, prefixes: readonly string[]): number[] {
    const re = prefixSpelling(prefixes);
    const out: number[] = [];
    text.split('\n').forEach((line, i) => {
        const code = line.trim();
        if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*')) return;
        if (NOT_A_PATTERN.test(code)) return;
        if (re.test(code.replace(/\\/g, ''))) out.push(i + 1);
    });
    return out;
}

describe('one place spells a raw-key prefix', () => {
    it('the table declares prefixes', () => {
        expect(CREDENTIAL_PREFIXES.length).toBeGreaterThan(5);
    });

    it('the scanner refuses a second spelling (sensitivity)', () => {
        expect(offendingLines("const RE = /sk-ant-[A-Za-z0-9]{20,}/;", CREDENTIAL_PREFIXES)).toEqual([1]);
        expect(offendingLines("const P = ['ya29\\\\.', 'AIza'];", CREDENTIAL_PREFIXES)).toEqual([1]);
        expect(offendingLines('// sk-ant- in a comment\nconst task = "task-runner";', CREDENTIAL_PREFIXES)).toEqual([]);
        expect(offendingLines("const k = 'sk-x'; // not-a-credential-pattern:", CREDENTIAL_PREFIXES)).toEqual([1]);
        expect(offendingLines("const k = 'sk-x'; // not-a-credential-pattern: fake", CREDENTIAL_PREFIXES)).toEqual([]);
    });

    it('no file outside the table spells one', () => {
        const files: string[] = [];
        for (const d of SCAN_DIRS) walk(path.join(ROOT, d), files);
        expect(files.length).toBeGreaterThan(100);
        const hits: string[] = [];
        for (const f of files) {
            const rel = path.relative(ROOT, f).split(path.sep).join('/');
            if (rel === OWNER) continue;
            for (const line of offendingLines(fs.readFileSync(f, 'utf-8'), CREDENTIAL_PREFIXES)) {
                hits.push(`${rel}:${line}`);
            }
        }
        expect(hits).toEqual([]);
    });
});
