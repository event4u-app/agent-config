/**
 * Tests for `parseUserMd` / `composeUserMd` in `@shared/userMd/utils`.
 *
 * Contract gates (`docs/contracts/agent-user-schema.md`):
 *   - parse returns `{ data, content }` with empty defaults
 *   - compose emits YAML in BLOCK style for list-valued fields like
 *     `identity.role` so git diffs stay line-oriented
 *   - compose ↔ parse is a stable round-trip
 *   - empty frontmatter omits the leading `---\n---\n` fence
 */
import { describe, expect, it } from 'vitest';
import { composeUserMd, parseUserMd } from '@shared/userMd/utils.js';

describe('parseUserMd', () => {
    it('returns empty data + content when no frontmatter is present', () => {
        const result = parseUserMd('# Hello\n\nplain body.');
        expect(result.data).toEqual({});
        expect(result.content).toBe('# Hello\n\nplain body.');
    });

    it('parses valid YAML frontmatter into a typed object', () => {
        const body = '---\nidentity:\n  name: Matze\n  role:\n    - founder\n    - engineer\n---\n\n# About\n';
        const result = parseUserMd(body);
        expect(result.data).toEqual({
            identity: { name: 'Matze', role: ['founder', 'engineer'] },
        });
        expect(result.content).toBe('\n# About\n');
    });
});

describe('composeUserMd', () => {
    it('emits list-valued fields in block style (one entry per line)', () => {
        const composed = composeUserMd({
            data: { identity: { name: 'Matze', role: ['founder', 'engineer'] } },
            content: '\n# About\n',
        });
        // Block style — each role on its own line behind a leading `- `.
        // Flow style (`role: [founder, engineer]`) is the regression we
        // guard against; this assertion catches it.
        expect(composed).toContain('  role:\n    - founder\n    - engineer');
        expect(composed).not.toContain('role: [');
    });

    it('omits the fence when data is empty', () => {
        const composed = composeUserMd({ data: {}, content: '# Hello\n' });
        expect(composed).toBe('# Hello\n');
        expect(composed.startsWith('---')).toBe(false);
    });

    it('round-trips parse → compose → parse without drift', () => {
        const original = '---\nidentity:\n  name: Matze\n  role:\n    - founder\n    - engineer\n---\n\n# About\n';
        const reparsed = parseUserMd(composeUserMd(parseUserMd(original)));
        expect(reparsed.data).toEqual({
            identity: { name: 'Matze', role: ['founder', 'engineer'] },
        });
        expect(reparsed.content).toBe('\n# About\n');
    });
});
