// Intent tests for the py2ts work_engine `stack/detect` twin (ADR-094 / ADR-200).
//
// Was a python3-vs-tsx byte-parity rig; the python side is dropped — this now
// exercises the `.ts` module's own contract in-process. `detect.ts` is a leaf
// module (stdlib-only, no intra-`work_engine` imports) so the detection logic
// can be driven directly via the imported `detect_stack` / `latest_manifest_mtime`
// without spawning anything.
//
// Each block builds a fake project tree (composer.json / package.json /
// components.json) in a tmp dir and asserts the deterministic detection label
// plus the `mtime == 0.0` / `mtime > 0.0` discriminator that the
// cache-invalidation contract actually depends on. The serialised view is
// `{frontend, has_mtime}` rather than the raw `mtime` float, whose exact
// byte-repr is filesystem-derived and not part of the detection contract.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    DEFAULT_STACK,
    KNOWN_STACKS,
    StackResult,
    detect_stack,
    latest_manifest_mtime,
} from '../../../src/agent-src/templates/scripts/work_engine/stack/detect.js';

/** Detection result rendered to the deterministic `{frontend, has_mtime}` view. */
function detectView(root: string): string {
    const r = detect_stack(root);
    return JSON.stringify({ frontend: r.frontend, has_mtime: r.mtime > 0.0 });
}

let tmp: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p2t-detect-'));
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function write(rel: string, body: string): void {
    const p = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body, 'utf8');
}

describe('stack/detect — module constants parity', () => {
    it('DEFAULT_STACK matches the Python value', () => {
        expect(DEFAULT_STACK).toBe('plain');
    });

    it('KNOWN_STACKS carries exactly the four Python labels', () => {
        expect([...KNOWN_STACKS].sort()).toEqual(
            ['blade-livewire-flux', 'plain', 'react-shadcn', 'vue'].sort(),
        );
    });

    it('StackResult is a frozen-style value carrier', () => {
        const r = new StackResult({ frontend: 'plain', mtime: 0.0 });
        expect(r.frontend).toBe('plain');
        expect(r.mtime).toBe(0.0);
    });
});

describe('stack/detect — detection logic', () => {
    it('blade-livewire-flux: composer has livewire + flux', () => {
        write('composer.json', JSON.stringify({ require: { 'livewire/livewire': '^3', 'livewire/flux': '^1' } }));
        expect(detectView(tmp)).toBe('{"frontend":"blade-livewire-flux","has_mtime":true}');
    });

    it('blade-livewire-flux: flux in require-dev still counts', () => {
        write(
            'composer.json',
            JSON.stringify({ require: { 'livewire/livewire': '^3' }, 'require-dev': { 'livewire/flux': '^1' } }),
        );
        expect(detectView(tmp)).toBe('{"frontend":"blade-livewire-flux","has_mtime":true}');
    });

    it('NOT blade-livewire-flux: livewire without flux falls through', () => {
        write('composer.json', JSON.stringify({ require: { 'livewire/livewire': '^3' } }));
        // No package.json → next branch fails too → plain.
        expect(detectView(tmp)).toBe('{"frontend":"plain","has_mtime":true}');
    });

    it('react-shadcn: react + @radix-ui/* dependency', () => {
        write('package.json', JSON.stringify({ dependencies: { react: '^18', '@radix-ui/react-slot': '^1' } }));
        expect(detectView(tmp)).toBe('{"frontend":"react-shadcn","has_mtime":true}');
    });

    it('react-shadcn: react + shadcn-ui package', () => {
        write('package.json', JSON.stringify({ dependencies: { react: '^18', 'shadcn-ui': '^0' } }));
        expect(detectView(tmp)).toBe('{"frontend":"react-shadcn","has_mtime":true}');
    });

    it('react-shadcn: react + components.json marker file', () => {
        write('package.json', JSON.stringify({ dependencies: { react: '^18' } }));
        write('components.json', '{}');
        expect(detectView(tmp)).toBe('{"frontend":"react-shadcn","has_mtime":true}');
    });

    it('NOT react-shadcn: components.json present but no react → plain', () => {
        write('package.json', JSON.stringify({ dependencies: { lodash: '^4' } }));
        write('components.json', '{}');
        expect(detectView(tmp)).toBe('{"frontend":"plain","has_mtime":true}');
    });

    it('NOT react-shadcn: react alone (no radix/shadcn/components) → plain', () => {
        write('package.json', JSON.stringify({ dependencies: { react: '^18' } }));
        expect(detectView(tmp)).toBe('{"frontend":"plain","has_mtime":true}');
    });

    it('vue: package lists vue, no react', () => {
        write('package.json', JSON.stringify({ dependencies: { vue: '^3' } }));
        expect(detectView(tmp)).toBe('{"frontend":"vue","has_mtime":true}');
    });

    it('vue via devDependencies', () => {
        write('package.json', JSON.stringify({ devDependencies: { vue: '^2' } }));
        expect(detectView(tmp)).toBe('{"frontend":"vue","has_mtime":true}');
    });

    it('precedence: blade wins over react when both manifests qualify', () => {
        write('composer.json', JSON.stringify({ require: { 'livewire/livewire': '^3', 'livewire/flux': '^1' } }));
        write('package.json', JSON.stringify({ dependencies: { react: '^18', '@radix-ui/x': '^1' } }));
        expect(detectView(tmp)).toBe('{"frontend":"blade-livewire-flux","has_mtime":true}');
    });

    it('precedence: react-shadcn wins over vue when both react+radix and vue present', () => {
        write(
            'package.json',
            JSON.stringify({ dependencies: { react: '^18', '@radix-ui/x': '^1', vue: '^3' } }),
        );
        expect(detectView(tmp)).toBe('{"frontend":"react-shadcn","has_mtime":true}');
    });

    it('greenfield: no manifests → plain, mtime 0.0', () => {
        expect(detectView(tmp)).toBe('{"frontend":"plain","has_mtime":false}');
    });

    it('malformed composer.json degrades to {} (no crash) → plain', () => {
        write('composer.json', '{ this is not json');
        expect(detectView(tmp)).toBe('{"frontend":"plain","has_mtime":true}');
    });

    it('non-dict JSON payload (a list) degrades to {} → plain', () => {
        write('package.json', '[1, 2, 3]');
        expect(detectView(tmp)).toBe('{"frontend":"plain","has_mtime":true}');
    });

    it('non-dict dependency section (require is a string) is ignored', () => {
        write('composer.json', JSON.stringify({ require: 'not-a-dict' }));
        expect(detectView(tmp)).toBe('{"frontend":"plain","has_mtime":true}');
    });

    it('latest_manifest_mtime: only composer/package count, not components.json', () => {
        // components.json carries no mtime weight; with only it present mtime
        // stays 0.0.
        write('components.json', '{}');
        expect(latest_manifest_mtime(tmp)).toBe(0.0);
    });
});
