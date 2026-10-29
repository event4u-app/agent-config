// Claude Code does not read AGENTS.md on its own: it reads CLAUDE.md, and only
// an `@AGENTS.md` import (or a symlink) pulls AGENTS.md into context. A link
// sentence is opened at the agent's discretion, so the docs that tell a consumer
// how to wire the stub must say import, not link.
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

describe('CLAUDE.md stub is documented as an @AGENTS.md import', () => {
    it('agents-md-anatomy shows the stub as an import and says why a link is not enough', () => {
        const text = read('src/agent-src/contexts/contracts/agents-md-anatomy.md');
        expect(text).toMatch(/^@AGENTS\.md$/m);
        expect(text).toMatch(/discretion/i);
    });

    it('/agents init does not claim Claude Code reads AGENTS.md unconditionally', () => {
        const text = read('src/domains/meta/agents/init/command.md');
        expect(text).not.toMatch(/honoured by Claude Code/);
        expect(text).toMatch(/`@AGENTS\.md` import/);
    });
});
