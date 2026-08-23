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
