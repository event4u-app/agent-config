// CLI reference, generated from the CLI's own sources so the site cannot list a
// command the binary does not have, or miss one it gained. Runs in prebuild,
// after sync-docs.mjs (which rebuilds the generated/ subtree from scratch).
//
// Two inputs, both read as text so this script needs no TypeScript loader:
//   • src/cli/help.ts      — HELP_GROUPS, the task-grouped front page of `--help`
//   • src/cli/registry.ts  — REGISTRY, every subcommand with its synopsis
// Commands on the help front page are listed by group with the help wording;
// every other registered command follows in one alphabetical table.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const OUT = path.join(HERE, 'src', 'content', 'docs', 'generated', 'reference', 'cli.md');
const HELP_SRC = 'src/cli/help.ts';
const REGISTRY_SRC = 'src/cli/registry.ts';
const GH = 'https://github.com/event4u-app/agent-config';

const STR = String.raw`(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")`;
const unquote = (m, i) => (m[i] ?? m[i + 1] ?? '').replace(/\\(.)/g, '$1');

/** REGISTRY entries: { name, disposition, synopsis }. */
export function parseRegistry(text) {
  const re = new RegExp(String.raw`\{\s*name:\s*${STR},\s*disposition:\s*${STR}(?:,\s*synopsis:\s*${STR})?\s*\}`, 'g');
  const out = [];
  for (const m of text.matchAll(re)) out.push({ name: unquote(m, 1), disposition: unquote(m, 3), synopsis: unquote(m, 5) });
  if (out.length === 0) throw new Error(`${REGISTRY_SRC}: no REGISTRY entries parsed`);
  return out;
}

/** HELP_GROUPS: [{ heading, rows: [{ name, text }] }]. */
export function parseHelpGroups(text) {
  const start = text.indexOf('HELP_GROUPS');
  if (start === -1) throw new Error(`${HELP_SRC}: HELP_GROUPS not found`);
  const body = text.slice(start);
  const groups = [];
  const headRe = new RegExp(String.raw`heading:\s*${STR}`, 'g');
  const heads = [...body.matchAll(headRe)];
  heads.forEach((h, i) => {
    const seg = body.slice(h.index, i + 1 < heads.length ? heads[i + 1].index : body.indexOf('];'));
    const rowRe = new RegExp(String.raw`\{\s*name:\s*${STR},\s*text:\s*${STR}\s*\}`, 'g');
    const rows = [...seg.matchAll(rowRe)].map((m) => ({ name: unquote(m, 1), text: unquote(m, 3) }));
    groups.push({ heading: unquote(h, 1).replace(/:$/, ''), rows });
  });
  if (groups.length === 0) throw new Error(`${HELP_SRC}: no help groups parsed`);
  return groups;
}

/** Table-cell safe: no raw `|`, no `<` that Markdown would read as HTML. */
export function cell(s) {
  return s.replace(/\|/g, '\\|').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const anchor = (name) => name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();

export function render(groups, registry) {
  const known = new Set(registry.map((e) => e.name));
  const front = new Set();
  const lines = [
    '---',
    'title: "CLI reference"',
    'description: "Every agent-config terminal command, generated from the CLI\'s own command registry and help groups."',
    'slug: "reference/cli"',
    `editUrl: "${GH}/edit/main/${REGISTRY_SRC}"`,
    '---',
    '',
    `<!-- GENERATED from ${HELP_SRC} and ${REGISTRY_SRC} by site/gen-cli-reference.mjs — edit the source, not this file. -->`,
    '',
    ':::note[Generated page]',
    `Generated from [\`${HELP_SRC}\`](${GH}/blob/main/${HELP_SRC}) and [\`${REGISTRY_SRC}\`](${GH}/blob/main/${REGISTRY_SRC}) at build time — edit the source, not this page.`,
    ':::',
    '',
    'Every terminal command the `agent-config` binary accepts. Run any of them with `--help` for its flags:',
    '',
    '```bash',
    'npx -y @event4u/agent-config --help',
    'npx -y @event4u/agent-config init --help',
    '```',
    '',
    'After a global install the binary is on your `PATH` as `agent-config`. These are terminal commands; the slash commands your AI tool runs in chat are listed on [All slash commands](/agent-config/workflows/commands/).',
    '',
    '## The commands you will use',
    '',
    'The same groups `agent-config --help` prints.',
    '',
  ];
  for (const g of groups) {
    lines.push(`### ${g.heading}`, '', '| Command | What it does |', '|---|---|');
    for (const r of g.rows) {
      if (!known.has(r.name)) throw new Error(`${HELP_SRC}: help row \`${r.name}\` is not in the registry`);
      front.add(r.name);
      lines.push(`| \`${r.name}\` | ${cell(r.text)} |`);
    }
    lines.push('');
  }
  const rest = registry.filter((e) => !front.has(e.name)).sort((a, b) => a.name.localeCompare(b.name));
  lines.push(
    '## Every other command',
    '',
    'Advanced, maintenance and internal commands, with the synopsis the registry carries. `agent-config help --tier=all` prints the same set in the terminal; some are hook entry points your AI tool calls, not commands you type.',
    '',
    '| Command | Synopsis |',
    '|---|---|',
  );
  for (const e of rest) lines.push(`| <span id="${anchor(e.name)}"></span>\`${e.name}\` | ${cell(e.synopsis || '—')} |`);
  lines.push('');
  return lines.join('\n');
}

export function main() {
  const groups = parseHelpGroups(fs.readFileSync(path.join(REPO, HELP_SRC), 'utf8'));
  const registry = parseRegistry(fs.readFileSync(path.join(REPO, REGISTRY_SRC), 'utf8'));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, render(groups, registry));
  const listed = groups.reduce((n, g) => n + g.rows.length, 0);
  console.log(`gen-cli-reference: ${registry.length} registered command(s), ${listed} on the help front page → ${path.relative(HERE, OUT)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
