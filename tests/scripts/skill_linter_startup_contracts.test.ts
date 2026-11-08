// A startup contract lives at `startup-contracts/rules/<id>.md` — under a
// `rules/` segment, which made the linter treat it as a rule and demand
// frontmatter and an H1. It is a section of its rule, gated by
// check_startup_contracts, so the linter leaves it alone; real rules stay rules.
import { describe, expect, it } from 'vitest';

import { detect_artifact_type } from '../../src/scripts/skill_linter.js';

describe('skill_linter — startup contract files are not rules', () => {
    it('does not classify a contract file as a rule', () => {
        expect(detect_artifact_type('dist/agent-src/startup-contracts/rules/tool-safety.md', '## Startup contract\n')).not.toBe('rule');
        expect(detect_artifact_type('src/agent-src/startup-contracts/rules/tool-safety.md', '## Startup contract\n')).not.toBe('rule');
    });
    it('still classifies a rule file as a rule', () => {
        expect(detect_artifact_type('dist/agent-src/rules/tool-safety.md', '---\ntype: "auto"\n---\n# Tool Safety\n')).toBe('rule');
    });
});
