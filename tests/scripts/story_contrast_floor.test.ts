import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
    AA_NORMAL,
    checkStoryFile,
    contrastRatio,
    declaredPairs,
    luminance,
} from '../../src/skills/storybook-workshop/scripts/story_contrast_floor';

const STORIES = path.join(
    'tests', 'fixtures', 'library', 'ui-lib-vite', 'source-consumed', 'src', 'Button', 'Button.stories.tsx',
);

const tmpStory = (body: string): string => {
    const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'story-contrast-')), 'X.stories.tsx');
    fs.writeFileSync(f, body, 'utf8');
    return f;
};

describe('story_contrast_floor', () => {
    describe('the step verify — one a11y violation from the fixture', () => {
        it('yields exactly one violation, in the (rule, selector, severity) shape', () => {
            const v = checkStoryFile(STORIES);
            expect(v).toHaveLength(1);
            expect(v[0]?.rule).toBe('color-contrast');
            expect(v[0]?.selector).toBe('story:LowContrast');
            expect(v[0]?.severity).toBe('error');
            // The measured ratio is carried so a reader sees HOW far off it is, not only that
            // it failed — 1.23 against a 4.5 floor is a different conversation from 4.4.
            expect(v[0]?.ratio).toBeLessThan(1.5);
        });

        it('the passing stories in the same file yield nothing', () => {
            // Sensitivity in the other direction: a check that flagged everything would also
            // return exactly one violation from a one-story file.
            const only = checkStoryFile(STORIES).map((x) => x.selector);
            expect(only).not.toContain('story:Default');
            expect(only).not.toContain('story:LongLabel');
        });
    });

    describe('the contrast maths', () => {
        it('black on white is 21:1 and a colour on itself is 1:1', () => {
            expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
            expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 2);
        });

        it('is symmetric — order of the pair does not change the ratio', () => {
            const a = contrastRatio('#123456', '#abcdef');
            const b = contrastRatio('#abcdef', '#123456');
            expect(a).toBeCloseTo(b as number, 6);
        });

        it('expands shorthand hex', () => {
            expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 1);
        });

        it('returns null for an unreadable colour rather than 0', () => {
            // 0 would compare as "worst possible contrast" and produce a false violation.
            expect(contrastRatio('rebeccapurple', '#fff')).toBeNull();
            expect(luminance('not-a-colour')).toBeNull();
        });

        it('a pair just above the AA floor is not flagged', () => {
            const f = tmpStory(
                "export const Ok: StoryObj<T> = {\n  args: { color: '#595959', background: '#ffffff' },\n};\n",
            );
            expect(contrastRatio('#595959', '#ffffff')).toBeGreaterThan(AA_NORMAL);
            expect(checkStoryFile(f)).toEqual([]);
        });
    });

    describe('what it cannot see, asserted so nobody assumes otherwise', () => {
        it('a colour behind a token indirection is invisible', () => {
            // Stated in the module and asserted here: pretending to check this would be worse
            // than the gap, because the caller would believe the story was covered.
            const f = tmpStory(
                "export const Tokenised: StoryObj<T> = {\n  args: { color: 'var(--fg)', background: 'var(--bg)' },\n};\n",
            );
            expect(declaredPairs(fs.readFileSync(f, 'utf8'))).toEqual([]);
            expect(checkStoryFile(f)).toEqual([]);
        });

        it('a story declaring only one of the two colours is not guessed at', () => {
            const f = tmpStory("export const Half: StoryObj<T> = {\n  args: { color: '#000000' },\n};\n");
            expect(checkStoryFile(f)).toEqual([]);
        });

        it('a missing file is empty, not a throw', () => {
            expect(checkStoryFile(path.join(os.tmpdir(), 'absent.stories.tsx'))).toEqual([]);
        });
    });
});
