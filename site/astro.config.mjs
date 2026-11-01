// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightThemeRapide from 'starlight-theme-rapide';
import mermaid from 'astro-mermaid';

// Docs site for Agent Config. Three page origins coexist:
//   • Authored pages under src/content/docs/** — the user-facing docs.
//   • Synced pages listed in docs-manifest.json, projected from the canonical
//     docs/*.md by sync-docs.mjs (prebuild) into the gitignored
//     src/content/docs/generated/ subtree; each page's `slug` frontmatter sets
//     its route and its `editUrl` points at the docs/ source.
//   • The CLI reference, written by gen-cli-reference.mjs from the CLI's own
//     command registry and help groups (prebuild), into the same subtree.
// Visual identity matches the sibling event4u docs (rapide theme + orange
// accents + info-banner under the hero).

const SITE = 'https://event4u-app.github.io';
const BASE = '/agent-config';
// Ruling 0.2 of the docs-that-sell decision note: every embed of the banner carries
// this caption; an Open Graph image cannot carry a visible caption, so it rides as the alt text.
const BANNER_CAPTION =
  'Installs into your user-level AI tool configuration; your repository only gets an `agents/overrides/` folder for your own changes. Works with 20 AI coding tools.';

export default defineConfig({
  site: SITE,
  base: BASE,
  outDir: './dist',
  // Public URLs that moved in the 2026-11 rebuild. Old links keep working.
  redirects: {
    '/getting-started/quick-start': `${BASE}/getting-started/first-task/`,
    '/getting-started/profiles-and-packs': `${BASE}/getting-started/choose-a-profile/`,
    '/agent-commands/overview': `${BASE}/workflows/commands/`,
    '/agent-commands/clusters': `${BASE}/workflows/commands/`,
    '/agent-commands/key-commands': `${BASE}/workflows/commands/`,
    '/cli/overview': `${BASE}/reference/cli/`,
    '/cli/agent-config-reference': `${BASE}/reference/cli/`,
  },
  integrations: [
    // astro-mermaid must precede Starlight — it registers the rehype pass +
    // client renderer that turns ```mermaid fences into diagrams. Peers astro >=4.
    mermaid({ theme: 'default', autoTheme: true }),
    starlight({
      title: 'Agent Config',
      description: 'Skills, rules, slash commands and subagents for AI coding agents — teach them to check their work before they say done.',
      logo: { src: './src/assets/logo.svg', alt: 'Agent Config' },
      favicon: '/favicon.svg',
      head: [
        { tag: 'meta', attrs: { property: 'og:image', content: `${SITE}${BASE}/og.png` } },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1280' } },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '640' } },
        { tag: 'meta', attrs: { property: 'og:image:alt', content: `Agent Config banner. ${BANNER_CAPTION}` } },
        { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
        { tag: 'meta', attrs: { name: 'twitter:image', content: `${SITE}${BASE}/og.png` } },
      ],
      customCss: ['./src/styles/custom.css'],
      plugins: [starlightThemeRapide()],
      social: [
        {
          icon: 'heart',
          label: 'Sponsor',
          href: 'https://github.com/sponsors/event4u-app',
        },
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
        {
          label: 'Get started',
          collapsed: false,
          items: [
            { label: 'Introduction', slug: 'getting-started/introduction' },
            { label: 'Install', slug: 'getting-started/installation' },
            { label: 'Your first task', slug: 'getting-started/first-task' },
            { label: 'Choose a profile', slug: 'getting-started/choose-a-profile' },
            { label: 'Requirements', slug: 'getting-started/requirements' },
            { label: 'Update', slug: 'getting-started/update' },
            { label: 'Uninstall', slug: 'getting-started/uninstall' },
          ],
        },
        {
          label: 'Workflows',
          collapsed: true,
          items: [
            { label: 'Implement a change', slug: 'workflows/implement' },
            { label: 'Review before the PR', slug: 'workflows/review' },
            { label: 'Plan with roadmaps', slug: 'workflows/roadmaps' },
            { label: 'Commit and open a PR', slug: 'workflows/commit-and-pr' },
            { label: 'All slash commands', slug: 'workflows/commands' },
          ],
        },
        {
          label: 'Your tool',
          collapsed: true,
          items: [
            { label: 'Which install do I get?', slug: 'tools/overview' },
            { label: 'Full install', slug: 'tools/full-install' },
            { label: 'Plugin', slug: 'tools/plugin' },
            { label: 'Skill bundle', slug: 'tools/bundle' },
            { label: 'Export only', slug: 'tools/export-only' },
            { label: 'Works with agent-switch', slug: 'works-with-agent-switch' },
          ],
        },
        {
          label: 'Features',
          collapsed: true,
          items: [
            { label: 'Code map', slug: 'features/code-map' },
            { label: 'Security', slug: 'features/security' },
            { label: 'Cost and budget', slug: 'features/cost' },
            { label: 'Second opinion', slug: 'features/second-opinion' },
            { label: 'Memory', slug: 'features/memory' },
            { label: 'Design system', slug: 'features/design-system' },
          ],
        },
        {
          label: 'Configure',
          collapsed: true,
          items: [
            { label: 'Settings file', slug: 'configuration/overview' },
            { label: 'The four profiles', slug: 'configuration/profiles' },
            { label: 'Skill sets for your role', slug: 'configuration/packs' },
          ],
        },
        {
          label: 'Trust & cost',
          collapsed: true,
          items: [
            { label: 'Benchmark & cost, explained', slug: 'trust/benchmark-and-cost' },
            { label: 'What leaves your machine', slug: 'trust/network' },
            { label: 'What each tool can block', slug: 'trust/enforcement-by-host' },
            { label: 'Check our claims', slug: 'trust/check-our-claims' },
          ],
        },
        {
          label: 'Reference',
          collapsed: true,
          items: [
            { label: 'CLI reference', slug: 'reference/cli' },
            { label: 'Settings reference', slug: 'configuration/settings-reference' },
            { label: 'Glossary', slug: 'reference/glossary' },
            { label: 'Verify it yourself', slug: 'proof' },
            { label: 'Discipline benchmark', slug: 'benchmark' },
            { label: 'Claims ledger', slug: 'claims' },
            { label: 'Catalog', slug: 'catalog' },
          ],
        },
        {
          label: 'Maintainers',
          collapsed: true,
          items: [
            { label: 'Architecture', slug: 'architecture/overview' },
            { label: 'Kernel & router', slug: 'architecture/kernel-and-router' },
            { label: 'Trust & safety layer', slug: 'architecture/trust-and-safety' },
            { label: 'Source of truth', slug: 'architecture/source-of-truth' },
            { label: 'Taskfile reference', slug: 'cli/taskfile-reference' },
          ],
        },
      ],
    }),
  ],
});
