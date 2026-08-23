// Storybook config as a committed artefact — Phase 2 reads it rather than assuming it.
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
    stories: ['../src/**/*.stories.@(ts|tsx)'],
    framework: { name: '@storybook/react-vite', options: {} },
};
export default config;
