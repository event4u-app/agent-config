/**
 * The scoped table and the resolver cannot drift apart
 * (`road-to-touched-file-quality-that-says-when-it-did-not-look` Phase 3).
 *
 * The resolver is the single authority (D2 of the parent roadmap), so parity is
 * asserted by RUNNING it (D3) over fixture roots that make it emit every command
 * it can, and reading the table's own keys — never by matching a hand-copied
 * list against source text, which is two copies of one fact.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resolve_toolchain } from '../../src/agent-src/templates/scripts/work_engine/stack/runner.js';
import {
    MUTATING_COMMANDS,
    SCOPED_FORM_COMMANDS,
    TYPE_CHECK_COMMANDS,
    UNSCOPED_ON_PURPOSE,
} from '../../src/scripts/_lib/touched_file_quality.js';

/** One fixture root per stack, each carrying every manifest signal it reads. */
const STACKS: Record<string, Record<string, string>> = {
    php: {
        'composer.json': JSON.stringify({
            'require-dev': { 'phpstan/phpstan': '*', 'laravel/pint': '*' },
        }),
    },
    js: {
        'package.json': JSON.stringify({
            devDependencies: { typescript: '*', eslint: '*' },
        }),
    },
    python: { 'pyproject.toml': '[tool.ruff]\n[tool.mypy]\n' },
    go: { 'go.mod': 'module example.com/fixture\n' },
    rust: { 'Cargo.toml': '[package]\nname = "fixture"\n' },
};

let base: string;
const emitted = new Set<string>();
const perStack = new Map<string, number>();

beforeAll(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'tfq-parity-'));
    for (const [stack, files] of Object.entries(STACKS)) {
        const root = path.join(base, stack);
        fs.mkdirSync(root, { recursive: true });
        for (const [name, body] of Object.entries(files)) {
            fs.writeFileSync(path.join(root, name), body);
        }
        const quality = resolve_toolchain(root).quality;
        perStack.set(stack, quality.length);
        for (const command of quality) emitted.add(command);
    }
});

afterAll(() => {
    fs.rmSync(base, { recursive: true, force: true });
});

describe('the resolver is the only authority', () => {
    it('the fixtures make the resolver emit something per stack', () => {
        // Guards the two assertions below from passing over an empty set.
        for (const stack of Object.keys(STACKS)) {
            expect(perStack.get(stack), `the ${stack} fixture made the resolver emit nothing`).toBeGreaterThan(0);
        }
    });

    it('every table key is a command the resolver emitted', () => {
        for (const key of [...SCOPED_FORM_COMMANDS, ...MUTATING_COMMANDS, ...UNSCOPED_ON_PURPOSE]) {
            expect(emitted, `table names '${key}', which the resolver never emitted`).toContain(key);
        }
    });

    it('every emitted command is classified', () => {
        const known = new Set([...SCOPED_FORM_COMMANDS, ...MUTATING_COMMANDS, ...UNSCOPED_ON_PURPOSE]);
        for (const command of emitted) {
            expect(known, `resolver emits '${command}' with no row and no unscoped entry`).toContain(
                command,
            );
        }
    });

    it('every type-check command is one the resolver emitted', () => {
        for (const key of TYPE_CHECK_COMMANDS) expect(emitted).toContain(key);
    });

    it('no command is classified twice', () => {
        const all = [...SCOPED_FORM_COMMANDS, ...MUTATING_COMMANDS, ...UNSCOPED_ON_PURPOSE];
        expect(new Set(all).size).toBe(all.length);
    });
});
