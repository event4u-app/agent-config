/**
 * Differential test for the YAML round-trip spike.
 *
 * For every fixture in tests/spikes/fixtures/yaml-rt/:
 *   (a) the TS spike's parse -> emit output is byte-identical to the
 *       input (user-line-preservation / round-trip property), and
 *   (b) the TS output is byte-identical to the Python reference
 *       (src/scripts/sync_yaml_rt.py parse -> emit) for the same input,
 *       invoked via tests/spikes/yaml_rt_py_driver.py.
 *
 * Exception: the duplicate-keys fixture is round-trip LOSSY by design
 * (last wins — the earlier line and its leading comment block are
 * dropped). For that fixture we assert TS == Python (differential) and
 * idempotence (a second round-trip is a fixed point) instead of
 * input-identity.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { parse, emit, roundTrip } from './yaml_rt_spike';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.join(HERE, 'fixtures', 'yaml-rt');
const PY_DRIVER = path.join(HERE, 'yaml_rt_py_driver.py');

/** Fixtures that are round-trip lossy by design (duplicate keys: last wins). */
const LOSSY_FIXTURES = new Set(['08-duplicate-keys.yml']);

function pythonRoundTrip(input: string): string {
  const out = execFileSync('python3', [PY_DRIVER], {
    input: Buffer.from(input, 'utf-8'),
    maxBuffer: 16 * 1024 * 1024,
  });
  return out.toString('utf-8');
}

const fixtures = readdirSync(FIXTURE_DIR)
  .filter((name) => name.endsWith('.yml'))
  .sort();

describe('yaml_rt spike — fixture corpus sanity', () => {
  it('has the expected corpus size (8-12 fixtures)', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(8);
    expect(fixtures.length).toBeLessThanOrEqual(12);
  });

  it('includes a CRLF fixture', () => {
    const crlf = fixtures.find((f) => f.includes('crlf'));
    expect(crlf).toBeDefined();
    const text = readFileSync(path.join(FIXTURE_DIR, crlf!), 'utf-8');
    expect(text).toContain('\r\n');
  });
});

describe('yaml_rt spike — TS round-trip property (emit(parse(x)) === x)', () => {
  for (const name of fixtures) {
    if (LOSSY_FIXTURES.has(name)) continue;
    it(name, () => {
      const input = readFileSync(path.join(FIXTURE_DIR, name), 'utf-8');
      expect(roundTrip(input)).toBe(input);
    });
  }

  it('08-duplicate-keys.yml — lossy by design, but idempotent', () => {
    const input = readFileSync(path.join(FIXTURE_DIR, '08-duplicate-keys.yml'), 'utf-8');
    const once = roundTrip(input);
    // Last-wins: the surviving values are the later ones.
    expect(once).toContain('mode: second');
    expect(once).not.toContain('mode: first');
    expect(once).toContain('inner: b');
    expect(once).not.toContain('inner: a\n');
    // Second pass is a fixed point.
    expect(roundTrip(once)).toBe(once);
  });
});

describe('yaml_rt spike — differential TS vs Python reference', () => {
  for (const name of fixtures) {
    it(name, () => {
      const input = readFileSync(path.join(FIXTURE_DIR, name), 'utf-8');
      const tsOut = roundTrip(input);
      const pyOut = pythonRoundTrip(input);
      expect(tsOut).toBe(pyOut);
    });
  }
});

describe('yaml_rt spike — parser behaviour parity (spot checks)', () => {
  it('empty input round-trips to empty output', () => {
    expect(roundTrip('')).toBe('');
    expect(pythonRoundTrip('')).toBe('');
  });

  it('rejects tabs in indent, like Python', () => {
    expect(() => parse('a:\n\tb: 1\n')).toThrow(/tab character in indent/);
  });

  it('rejects inconsistent dedent (over-indent), like Python', () => {
    // Deeper-than-previous lines open a child block — allowed.
    expect(() => parse('a:\n  b: 1\n    c: 2\n      d: 3\n')).not.toThrow();
    // Dedent to a level no parent expects — rejected.
    expect(() => parse('a:\n  b:\n    c: 1\n   d: 2\n')).toThrow(/over-indent/);
  });

  it('preserves per-line endings in mixed-EOL input (TS == Python)', () => {
    const mixed = 'a: 1\r\nb: 2\nc: 3\r\n';
    expect(roundTrip(mixed)).toBe(mixed);
    expect(pythonRoundTrip(mixed)).toBe(mixed);
  });

  it('attaches leading comments to the following node (verbatim)', () => {
    const input = '# head\n\n# for-key\nkey: value  # inline\n';
    const tree = parse(input);
    expect(tree.children).toHaveLength(1);
    const first = tree.children[0];
    if (first === undefined) {
      throw new Error('expected exactly one child node');
    }
    expect(first.leading).toEqual(['# head\n', '\n', '# for-key\n']);
    expect(first.inlineComment).toBe('# inline');
    expect(emit(tree)).toBe(input);
  });
});
