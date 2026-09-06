// AC-4 — every generated host bridge is byte-identical to its golden.
//
// The bindings that drive these files moved out of five private constants in
// install.ts into `src/scripts/hooks/host_lowering.yaml`. A transcription slip
// there is invisible to a shape assertion: a wrong native event name, or a
// re-ordered slot list (the emitted JSON is keyed by native event, so order is
// bytes) both still produce a well-formed bridge. Only a byte comparison
// catches them.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { generateProjectBridges } from '../_lib/host_bridges.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const GOLDEN = path.join(REPO_ROOT, 'tests', 'fixtures', 'host_bridges', 'project_bridges.json');

let tmpRoot: string;
let project: string;

beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-golden-'));
    project = path.join(tmpRoot, 'consumer');
    fs.mkdirSync(project);
    const shim = path.join(project, 'agent-config');
    fs.writeFileSync(shim, '#!/usr/bin/env bash\nexit 0\n');
    fs.chmodSync(shim, 0o755);
});

afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('generated host bridges', () => {
    it('are byte-identical to the golden', () => {
        const golden = JSON.parse(fs.readFileSync(GOLDEN, 'utf8')) as Record<string, string>;
        const actual = generateProjectBridges(project);
        expect(Object.keys(actual).sort()).toEqual(Object.keys(golden).sort());
        for (const key of Object.keys(golden).sort()) {
            expect(actual[key], `${key} drifted from its golden`).toBe(golden[key]);
        }
    });
});
