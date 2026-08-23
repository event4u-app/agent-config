// A story is the library's own executable documentation. Present here so Phase 2 has a real
// artefact to read rather than a described one.
import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
    title: 'Primitives/Button',
    component: Button,
};
export default meta;

export const Default: StoryObj<typeof Button> = {
    args: { label: 'Press me' },
};

export const LongLabel: StoryObj<typeof Button> = {
    args: { label: 'A label long enough to wrap in a narrow container' },
};

/**
 * @summary DELIBERATELY LOW CONTRAST — the negative control for the a11y floor.
 *
 * `#8a8a8a` on `#9a9a9a` is about 1.2:1 against a 4.5:1 AA floor. It exists so the
 * contrast check has something to find; a check that has only ever seen passing input has
 * unknown sensitivity.
 */
export const LowContrast: StoryObj<typeof Button> = {
    args: { label: 'Barely visible', color: '#8a8a8a', background: '#9a9a9a' },
};
