import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { KERNEL_RULE_IDS } from '../../src/scripts/_lib/kernel_rules.js';
import { digestFor } from '../../src/scripts/hooks/subagent_constraints_hook.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('a package worker that skips project instructions', () => {
    // road-to-a-cold-start-paid-once 2.5: the shipped definitions, not a brief no
    // production path builds. The host runs the projected file; the floor rides in
    // its body and the consumer's CLAUDE.md arrives through SubagentStart.
    it('skipping-worker-carries-kernel-and-constraints on the host Agent path', () => {
        const planted = 'PLANTED-CONSTRAINT-2a5c: never write under vendor/.';
        const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cold-start-2-5-')));
        const config = fs.mkdtempSync(path.join(os.tmpdir(), 'cold-start-2-5-cfg-'));
        try {
            fs.mkdirSync(path.join(root, '.git'));
            fs.mkdirSync(path.join(root, '.claude', 'agents'), { recursive: true });
            fs.writeFileSync(path.join(root, 'CLAUDE.md'), `# Consumer project\n\n${planted}\n`);
            for (const name of ['ac-worker', 'ac-researcher']) {
                const shipped = fs.readFileSync(path.join(REPO, 'docs', 'wedge', name, `${name}.md`), 'utf-8');
                fs.writeFileSync(path.join(root, '.claude', 'agents', `${name}.md`), shipped);
                const fm = /^---\n([\s\S]*?)\n---\n/.exec(shipped)?.[1] ?? '';
                expect(fm).toMatch(/^omitClaudeMd: true$/m);
                for (const id of KERNEL_RULE_IDS) expect(shipped).toContain(id);
                const digest = digestFor(
                    { event: 'subagent_start', workspace_root: root, payload: { agent_type: name } },
                    { CLAUDE_CONFIG_DIR: config },
                );
                expect(digest).toContain(planted);
            }
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
            fs.rmSync(config, { recursive: true, force: true });
        }
    });
});
