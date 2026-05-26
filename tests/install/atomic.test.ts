import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { atomicAppendLine, atomicWriteFile } from '../../src/install/atomic.js';

describe('atomic — atomicWriteFile', () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'atomic-'));
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it('writes the payload to the target path', () => {
        const target = join(root, 'a.txt');
        atomicWriteFile(target, 'hello');
        expect(readFileSync(target, 'utf8')).toBe('hello');
    });

    it('creates parent directories recursively', () => {
        const target = join(root, 'deep', 'nested', 'b.txt');
        atomicWriteFile(target, 'yo');
        expect(readFileSync(target, 'utf8')).toBe('yo');
    });

    it('overwrites an existing file in place', () => {
        const target = join(root, 'c.txt');
        writeFileSync(target, 'old');
        atomicWriteFile(target, 'new');
        expect(readFileSync(target, 'utf8')).toBe('new');
    });

    it('accepts Buffer payloads', () => {
        const target = join(root, 'd.bin');
        atomicWriteFile(target, Buffer.from([1, 2, 3]));
        expect(readFileSync(target)).toEqual(Buffer.from([1, 2, 3]));
    });

    it('leaves no .tmp.* siblings after success', () => {
        const target = join(root, 'e.txt');
        atomicWriteFile(target, 'x');
        const siblings = readdirSync(root).filter((n) => n.startsWith('.tmp.'));
        expect(siblings).toEqual([]);
    });
});

describe('atomic — atomicAppendLine', () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'atomic-'));
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it('creates the file on first append', () => {
        const target = join(root, 'log.jsonl');
        atomicAppendLine(target, '{"a":1}');
        expect(readFileSync(target, 'utf8')).toBe('{"a":1}\n');
    });

    it('appends with a leading newline when prior content lacks one', () => {
        const target = join(root, 'log.jsonl');
        writeFileSync(target, '{"a":1}');
        atomicAppendLine(target, '{"a":2}');
        expect(readFileSync(target, 'utf8')).toBe('{"a":1}\n{"a":2}\n');
    });

    it('chains multiple appends without losing entries', () => {
        const target = join(root, 'log.jsonl');
        atomicAppendLine(target, '1');
        atomicAppendLine(target, '2');
        atomicAppendLine(target, '3');
        expect(readFileSync(target, 'utf8')).toBe('1\n2\n3\n');
    });
});
