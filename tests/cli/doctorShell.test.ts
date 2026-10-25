import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { checkNode } from '../../src/cli/commands/doctorShell.js';

const engines = JSON.parse(
    fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'package.json'), 'utf-8'),
).engines as { node: string };

describe('doctor-shell node check', () => {
    it('takes its floor from engines.node, not a hard-coded major', () => {
        expect(checkNode('20.11.0', engines.node).ok).toBe(false);
        expect(checkNode('22.5.1', engines.node).ok).toBe(false);
        expect(checkNode('22.6.0', engines.node).ok).toBe(true);
        expect(checkNode('24.0.0', engines.node).ok).toBe(true);
    });

    it('names the declared range when the runtime falls short', () => {
        expect(checkNode('20.11.0', engines.node).detail).toContain(engines.node);
    });

    it('fails rather than passes when the range cannot be read', () => {
        expect(checkNode('22.6.0', null).ok).toBe(false);
    });
});
