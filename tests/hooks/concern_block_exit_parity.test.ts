// Every concern that refuses must use the DISPATCHER's block code, not its own.
//
// Why this test exists, stated plainly because it is a repeat offence.
//
// The dispatcher's internal ladder is `0 allow / 1 block / 2 warn`
// (`dispatch_hook.ts`). That is NOT the shape a PreToolUse guard reads
// naturally from Claude's own native contract, where exit 2 + stderr is the
// documented way to deny a tool call. A guard author who reaches for "2 means
// refuse" writes a constant the dispatcher reduces to WARN — the concern
// reports `Blocked: …`, the dispatcher emits it as `additionalContext`, and
// the operation goes through.
//
// This exact inversion was fixed once at the transport layer (#1180). It came
// back at the AUTHORING layer: `block-unauthorized-git` and
// `evidence-independence` both shipped with `EXIT_BLOCK = 2`, so two gates
// declared `severity: blocking` in the manifest and refused nothing. It was
// found by driving a real envelope through the built dispatcher, not by their
// unit tests — those called `decide()` directly and asserted the concern's own
// constant against itself, which is true no matter what the constant is.
//
// So this test does the one thing those could not: it compares each concern's
// refusal code against the dispatcher's exported constant.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';

import { EXIT_ALLOW, EXIT_BLOCK, EXIT_WARN } from '../../src/scripts/hooks/dispatch_hook.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const MANIFEST = path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml');

interface Concern {
    script?: string;
    severity?: string;
}

function concerns(): Record<string, Concern> {
    const doc = parseYaml(fs.readFileSync(MANIFEST, 'utf8')) as { concerns?: Record<string, Concern> };
    return doc.concerns ?? {};
}

/** Source of every concern the manifest declares `severity: blocking`. */
function blockingSources(): Array<{ name: string; file: string; source: string }> {
    return Object.entries(concerns())
        .filter(([, c]) => c.severity === 'blocking')
        .map(([name, c]) => {
            const file = c.script as string;
            return { name, file, source: fs.readFileSync(path.join(REPO_ROOT, file), 'utf8') };
        });
}

describe('concern block-exit parity', () => {
    it('the dispatcher ladder is the one this test pins against', () => {
        // If these ever move, every concern below moves with them — which is
        // the whole point of reading them from the export rather than typing 1.
        expect(EXIT_ALLOW).toBe(0);
        expect(EXIT_BLOCK).toBe(1);
        expect(EXIT_WARN).toBe(2);
        expect(EXIT_BLOCK).not.toBe(EXIT_WARN);
    });

    it('there is at least one blocking concern to check', () => {
        expect(blockingSources().length).toBeGreaterThan(0);
    });

    it('no blocking concern defines a refusal code that differs from the dispatcher', () => {
        const wrong: string[] = [];
        for (const { name, file, source } of blockingSources()) {
            // Concerns that never name a refusal constant are out of scope here —
            // they either return the dispatcher's own value or do not refuse.
            const m = /const\s+EXIT_BLOCK\s*=\s*(\d+)\s*;/.exec(source);
            if (m === null) {
                continue;
            }
            const declared = Number(m[1]);
            if (declared !== EXIT_BLOCK) {
                wrong.push(`${name} (${file}): EXIT_BLOCK = ${declared}, dispatcher uses ${EXIT_BLOCK}`);
            }
        }
        expect(wrong).toEqual([]);
    });

    it('no blocking concern uses the WARN code as its refusal code', () => {
        // The specific inversion that shipped: 2 reads as advisory, so the
        // guard reports a block and the operation proceeds.
        const inverted = blockingSources()
            .filter(({ source }) => new RegExp(`const\\s+EXIT_BLOCK\\s*=\\s*${EXIT_WARN}\\s*;`).test(source))
            .map(({ name }) => name);
        expect(inverted).toEqual([]);
    });
});
