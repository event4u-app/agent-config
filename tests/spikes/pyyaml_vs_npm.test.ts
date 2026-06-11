/**
 * Differential check: can the npm `yaml` package read what PyYAML reads?
 *
 * Covers migration categories (b)/(c) — the ~96 Python scripts that use
 * PyYAML `safe_load` (and the six that `safe_dump`). For representative
 * real YAML files from this repo, both parsers must agree semantically:
 *   - python3 + PyYAML: safe_load -> json.dumps(sort_keys, compact,
 *     ensure_ascii=False; non-string keys JSON-encoded)
 *   - node + npm `yaml`: parse(version: '1.1') -> JSON.stringify with
 *     deep-sorted keys
 *
 * Two normalisations are load-bearing findings for the migration:
 *   1. PyYAML implements YAML 1.1 (e.g. the workflow key `on:` resolves
 *      to boolean true, `yes`/`off` are booleans). The npm `yaml`
 *      package defaults to YAML 1.2 — the production port must pass
 *      `{ version: '1.1' }` wherever it replaces PyYAML to keep
 *      semantics identical.
 *   2. Python json.dumps escapes non-ASCII by default; ensure_ascii=False
 *      makes both sides emit raw UTF-8 (formatting of the comparison
 *      artefact, not a parser difference).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');

/** Representative real YAML files: task runner, sub-taskfile, settings template, CI workflow. */
const SAMPLE_FILES = [
  'Taskfile.yml',
  'taskfiles/engine.yml',
  'src/config/agent-settings.template.yml',
  '.github/workflows/consistency.yml',
];

const PY_CANONICALIZE = `
import sys, json, yaml

def norm_keys(o):
    if isinstance(o, dict):
        # PyYAML (YAML 1.1) can produce non-string keys (e.g. the
        # workflow key "on:" resolves to boolean True). JSON-encode
        # those so both sides land on the same string key ("true").
        return {(k if isinstance(k, str) else json.dumps(k)): norm_keys(v) for k, v in o.items()}
    if isinstance(o, list):
        return [norm_keys(x) for x in o]
    return o

data = yaml.safe_load(sys.stdin.read())
print(json.dumps(norm_keys(data), sort_keys=True, ensure_ascii=False, separators=(",", ":"), default=str))
`;

function pyyamlCanonical(text: string): string {
  return execFileSync('python3', ['-c', PY_CANONICALIZE], {
    input: Buffer.from(text, 'utf-8'),
    maxBuffer: 16 * 1024 * 1024,
  })
    .toString('utf-8')
    .trim();
}

function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) {
    return v.map(sortDeep);
  }
  if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
    const src = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(src).sort()) {
      out[k] = sortDeep(src[k]);
    }
    return out;
  }
  return v;
}

function npmYamlCanonical(text: string): string {
  // version '1.1' matches PyYAML's YAML 1.1 resolution (on/yes/off as
  // booleans, sexagesimal ints) — the key semantic pin for the port.
  const parsed = YAML.parse(text, { version: '1.1' });
  return JSON.stringify(sortDeep(parsed));
}

describe('PyYAML vs npm yaml — semantic equality on real repo files', () => {
  for (const rel of SAMPLE_FILES) {
    it(rel, () => {
      const text = readFileSync(path.join(REPO_ROOT, rel), 'utf-8');
      expect(npmYamlCanonical(text)).toBe(pyyamlCanonical(text));
    });
  }

  it('YAML 1.1 pin matters: bare `on:` key resolves to boolean true on both sides', () => {
    const text = 'on:\n  push: {}\nplain: keeps-string\nflag: yes\n';
    const py = pyyamlCanonical(text);
    const js = npmYamlCanonical(text);
    expect(js).toBe(py);
    expect(py).toContain('"true":');
  });
});
