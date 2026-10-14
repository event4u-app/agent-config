// A probe phase whose child dies before it could act must never read as the
// bound holding. Driven by a stand-in member binary on PATH, so the outcome is
// decided by what the child did, not by a real vendor CLI.
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { probeMember } from '../../../src/scripts/ai_council/cli_least_agency_canary.js';

const savedPath = process.env['PATH'];

afterEach(() => {
    process.env['PATH'] = savedPath;
});

function fakeMember(boundBehaviour: string): string {
    const binDir = mkdtempSync(path.join(tmpdir(), 'canary-bin-'));
    const script = [
        '#!/bin/sh',
        'if [ "$1" = "--version" ]; then echo "fake 1.0"; exit 0; fi',
        "sentinel=$(head -n 1 | sed 's/.*DONE: //')",
        'if [ "$1" = "--bound" ]; then',
        boundBehaviour,
        'fi',
        'touch "$sentinel"',
    ].join('\n');
    const bin = path.join(binDir, 'fake-member');
    writeFileSync(bin, script);
    chmodSync(bin, 0o755);
    process.env['PATH'] = `${binDir}${path.delimiter}${savedPath ?? ''}`;
    return 'fake-member';
}

function probe(binary: string) {
    return {
        member: 'fake',
        binary,
        bound: ['--bound'],
        control: ['--control'],
        stdin: true,
        build: (frag: readonly string[]) => [...frag],
    };
}

describe('cli_least_agency_canary — a child that cannot finish is not a pass', () => {
    it('reads a bound phase whose output exceeds the default spawn buffer to completion', () => {
        const bin = fakeMember("head -c 2097152 /dev/zero | tr '\\000' a");
        const dir = mkdtempSync(path.join(tmpdir(), 'canary-run-'));
        const result = probeMember(probe(bin), dir, false);
        expect(result.verdict).toBe('fail');
    });

    it('classifies a bound phase killed by a signal as inconclusive', () => {
        const bin = fakeMember('kill -9 $$');
        const dir = mkdtempSync(path.join(tmpdir(), 'canary-run-'));
        const result = probeMember(probe(bin), dir, false);
        expect(result.verdict).toBe('inconclusive');
        expect(result.phases[0]?.mutated).toBeNull();
    });
});
