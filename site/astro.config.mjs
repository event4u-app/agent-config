// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightThemeRapide from 'starlight-theme-rapide';
import mermaid from 'astro-mermaid';

// Docs + proof site for agent-config. Two page origins coexist:
//   • Authored pages under src/content/docs/** (Getting Started, Configuration,
//     CLI Commands, Agent Commands, Architecture) — the project documentation.
//   • Synced pages (proof / benchmark / claims / catalog) projected from the
//     canonical docs/*.md by sync-docs.mjs (prebuild) so they never drift.
// Visual identity matches the sibling event4u docs (rapide theme + orange
// accents + banner). IA is overview-first: concise sections that link out to
// the exhaustive canonical docs for depth. (The earlier ≤5-section proof-site
// cap was superseded when the site was expanded into full project docs.)
export default defineConfig({
  site: 'https://event4u-app.github.io',
  base: '/agent-config',
  outDir: './dist',
  integrations: [
    // astro-mermaid must precede Starlight — it registers the rehype pass +
    // client renderer that turns ```mermaid fences into diagrams. Peers astro >=4.
    mermaid({ theme: 'default', autoTheme: true }),
    starlight({
      title: 'agent-config',
      description:
        'A governed skill/rule/command suite for AI coding tools — every claim machine-checked, including zero runtime.',
      favicon: '/favicon.svg',
      customCss: ['./src/styles/custom.css'],
      plugins: [starlightThemeRapide()],
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/event4u-app/agent-config',
        },
      ],
      editLink: {
        baseUrl: 'https://github.com/event4u-app/agent-config/edit/main/site/',
      },
      sidebar: [
        { label: 'Start', items: [{ label: 'Overview', link: '/' }] },
        {
          label: 'Getting Started',
          collapsed: false,
          items: [
            { label: 'Introduction', slug: 'getting-started/introduction' },
            { label: 'Installation', slug: 'getting-started/installation' },
            { label: 'Requirements', slug: 'getting-started/requirements' },
            { label: 'Quick Start', slug: 'getting-started/quick-start' },
            { label: 'Profiles & Packs', slug: 'getting-started/profiles-and-packs' },
          ],
        },
        {
          label: 'Configuration',
          collapsed: true,
          items: [
            { label: 'Overview', slug: 'configuration/overview' },
            { label: 'Settings Reference', slug: 'configuration/settings-reference' },
            { label: 'Profiles', slug: 'configuration/profiles' },
            { label: 'Packs & Workspaces', slug: 'configuration/packs' },
          ],
        },
        {
          label: 'CLI Commands',
          collapsed: true,
          items: [
            { label: 'Overview', slug: 'cli/overview' },
            { label: 'agent-config Reference', slug: 'cli/agent-config-reference' },
            { label: 'Taskfile Reference', slug: 'cli/taskfile-reference' },
          ],
        },
        {
          label: 'Agent Commands',
          collapsed: true,
          items: [
            { label: 'Overview', slug: 'agent-commands/overview' },
            { label: 'Command Clusters', slug: 'agent-commands/clusters' },
            { label: 'Key Commands', slug: 'agent-commands/key-commands' },
          ],
        },
        {
          label: 'Architecture',
          collapsed: true,
          items: [
            { label: 'Overview', slug: 'architecture/overview' },
            { label: 'Kernel & Router', slug: 'architecture/kernel-and-router' },
            { label: 'Source of Truth', slug: 'architecture/source-of-truth' },
            { label: 'Trust & Safety', slug: 'architecture/trust-and-safety' },
          ],
        },
        {
          label: 'Reference',
          collapsed: true,
          items: [
            { label: 'Verify it yourself', slug: 'proof' },
            { label: 'Discipline-axis benchmark', slug: 'benchmark' },
            { label: 'Claims ledger', slug: 'claims' },
            { label: 'Catalog', slug: 'catalog' },
          ],
        },
      ],
    }),
  ],
});
