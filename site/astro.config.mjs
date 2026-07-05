// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// Docs + proof site for agent-config. IA is capped at <=5 top sections
// (per road-to-final-state-and-market-readiness B4). Content under
// src/content/docs/ is SYNCED from the canonical docs/*.md by sync-docs.mjs
// (prebuild step) so the site can never drift from the source of truth.
export default defineConfig({
  site: 'https://event4u-app.github.io',
  base: '/agent-config',
  outDir: './dist',
  integrations: [
    starlight({
      title: 'agent-config',
      description:
        'A governed skill/rule/command suite for AI coding tools — every claim machine-checked, including zero runtime.',
      sidebar: [
        { label: 'Start', items: [{ label: 'Overview', link: '/' }] },
        {
          label: 'Proof',
          items: [{ label: 'Verify it yourself', link: '/proof/' }],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Catalog', link: '/catalog/' },
            { label: 'Discipline-axis benchmark', link: '/benchmark/' },
            { label: 'Claims ledger', link: '/claims/' },
          ],
        },
      ],
    }),
  ],
});
