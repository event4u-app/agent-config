
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import type { Node} from '../../src/scripts/sync_yaml_rt.js';
import { emit, heal_user_block, merge, parse, sync } from '../../src/scripts/sync_yaml_rt.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const RT_FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'sync_yaml_rt');
const SPIKE_FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'spikes', 'fixtures', 'yaml-rt');

function read(dir: string, name: string): string {
  return readFileSync(path.join(dir, name), 'utf-8');
}

// =====================================================================
// Phase 2: round-trip property (user-line preservation)
// =====================================================================

describe('round-trip — user-line preservation', () => {
  for (const fixture of [
    'with-custom-comments.yml',
    'with-legacy-_user.yml',
    'non-ascii.yml',
    'mixed-indent.yml',
    'inline-and-block-lists.yml',
    'current-real.yml',
  ]) {
    it(`${fixture}: emit(parse(x)) is byte-equal to source`, () => {
      const text = read(RT_FIXTURE_DIR, fixture);
      const tree = parse(text);
      expect(emit(tree)).toBe(text);
    });
  }

  it("empty file: parse('') -> root-only tree, emit -> ''", () => {
    const tree = parse('');
    expect(tree.children).toEqual([]);
    expect(emit(tree)).toBe('');
  });
});

// =====================================================================
// Phase 5: preservation under full sync
// =====================================================================

describe('preservation under full sync', () => {
  it('custom comments unchanged — every user line intact', () => {
    const userText = read(RT_FIXTURE_DIR, 'with-custom-comments.yml');
    const templateText = read(RT_FIXTURE_DIR, 'template-basic.yml');
    const out = sync(userText, templateText);
    const outLines = out.split('\n');
    for (const line of userText.split('\n')) {
      expect(outLines).toContain(line);
    }
  });

  it('custom comments retain relative order after sync', () => {
    const userText = read(RT_FIXTURE_DIR, 'with-custom-comments.yml');
    const templateText = read(RT_FIXTURE_DIR, 'template-basic.yml');
    const out = sync(userText, templateText);
    const userLines = userText.split('\n');
    const outLines = out.split('\n');
    let cursor = 0;
    for (const ln of userLines) {
      const idx = outLines.indexOf(ln, cursor);
      expect(idx, `User line lost or reordered after sync: ${JSON.stringify(ln)}`).toBeGreaterThanOrEqual(0);
      cursor = idx + 1;
    }
  });
});

// =====================================================================
// Phase 3: additive merge
// =====================================================================

describe('additive merge', () => {
  it('missing leaf inserted under the right parent, siblings untouched', () => {
    const userText = 'personal:\n  ide: phpstorm\n  user_name: Matze\n';
    const templateText = "personal:\n  ide: ''\n  open_edited_files: false\n  user_name: ''\n";
    const out = sync(userText, templateText);
    expect(out).toContain('open_edited_files: false');
    expect(out.indexOf('ide: phpstorm')).toBeLessThan(out.indexOf('user_name: Matze'));
    const idePos = out.indexOf('ide: phpstorm');
    const newPos = out.indexOf('open_edited_files: false');
    const userPos = out.indexOf('user_name: Matze');
    expect(idePos).toBeLessThan(newPos);
    expect(newPos).toBeLessThan(userPos);
  });

  it('missing top section appended at EOF with one blank', () => {
    const userText = 'personal:\n  ide: phpstorm\n';
    const templateText = "personal:\n  ide: ''\n\nonboarding:\n  onboarded: false\n";
    const out = sync(userText, templateText);
    expect(out.startsWith('personal:\n  ide: phpstorm\n')).toBe(true);
    expect(out).toContain('onboarding:');
    expect(out).toContain('onboarded: false');
    expect(out).toContain('\n\nonboarding:');
    expect(out).not.toContain('\n\n\nonboarding:');
  });

  it('user reordered keys (a, c, b) — template d goes after b', () => {
    const userText = 'section:\n  a: 1\n  c: 3\n  b: 2\n';
    const templateText = 'section:\n  a: 0\n  b: 0\n  c: 0\n  d: 0\n';
    const out = sync(userText, templateText);
    const a = out.indexOf('a: 1');
    const c = out.indexOf('c: 3');
    const b = out.indexOf('b: 2');
    const d = out.indexOf('d: 0');
    expect(a).toBeLessThan(c);
    expect(c).toBeLessThan(b);
    expect(b).toBeLessThan(d);
  });

  it('inserts new key between existing siblings (b2 after user b)', () => {
    const userText = 'section:\n  a: 1\n  c: 3\n  b: 2\n';
    const templateText = 'section:\n  a: 0\n  b: 0\n  b2: x\n  c: 0\n';
    const out = sync(userText, templateText);
    expect(out.indexOf('b: 2')).toBeLessThan(out.indexOf('b2: x'));
  });

  it('three-level nested missing leaf inserted as sibling', () => {
    const userText = 'a:\n  x:\n    p: 1\n';
    const templateText = 'a:\n  x:\n    p: 0\n    q: 9\n';
    const out = sync(userText, templateText);
    expect(out).toContain('p: 1');
    expect(out).toContain('q: 9');
    expect(out.indexOf('p: 1')).toBeLessThan(out.indexOf('q: 9'));
  });

  it("scalar value not overwritten by section template (personal: null)", () => {
    const userText = 'personal: null\nrule_loading_tier: minimal\n';
    const templateText = "rule_loading_tier: minimal\npersonal:\n  ide: ''\n  user_name: ''\n";
    const out = sync(userText, templateText);
    expect(out).toContain('personal: null\n');
    expect(out).not.toContain('personal: null\n  ide');
    expect(out).not.toContain('personal: null\n  user_name');
    expect(out).toContain('rule_loading_tier: minimal');
  });

  it('scalar value with quoted string not overwritten', () => {
    const userText = 'personal: ""\n';
    const templateText = "personal:\n  ide: ''\n";
    const out = sync(userText, templateText);
    expect(out).toContain('personal: ""\n');
    expect(out).not.toContain('personal: ""\n  ide');
  });

  it('empty section still populated by template', () => {
    const userText = 'personal:\n';
    const templateText = "personal:\n  ide: ''\n  user_name: ''\n";
    const out = sync(userText, templateText);
    expect(out).toContain("ide: ''");
    expect(out).toContain("user_name: ''");
  });

  it('CRLF user + LF template → uniform user EOL', () => {
    const userText = 'personal:\r\n  ide: phpstorm\r\n';
    const templateText = "personal:\n  ide: ''\n  user_name: ''\n";
    const out = sync(userText, templateText);
    expect(out).toContain('  ide: phpstorm\r\n');
    expect(out).toContain("  user_name: ''\r\n");
    let bareLf = 0;
    for (let i = 0; i < out.length; i++) {
      if (out[i] === '\n' && (i === 0 || out[i - 1] !== '\r')) {
        bareLf++;
      }
    }
    expect(bareLf, `mixed EOL: ${bareLf} bare LF in output`).toBe(0);
  });

  it('synthetic header no-value with comment uses 2 spaces', () => {
    const userText = '_user:\n  custom_orphan:  # only a comment\n';
    const templateText = '';
    const out = sync(userText, templateText);
    expect(out).toContain('custom_orphan:  # only a comment');
    expect(out).not.toContain('custom_orphan:   # only a comment');
  });
});

// =====================================================================
// Phase 4: _user healer
// =====================================================================

describe('_user healer', () => {
  it('strips multi-prefix corruption', () => {
    const userText = read(RT_FIXTURE_DIR, 'with-legacy-_user.yml');
    const templateText = read(RT_FIXTURE_DIR, 'template-basic.yml');
    const out = sync(userText, templateText);
    expect(out).not.toContain('_user._user');
    expect(out).not.toContain('_user:\n  _user:');
  });

  it('re-homes known keys, keeps orphans single-level', () => {
    const userText =
      '_user:\n' +
      '  _user:\n' +
      '    rule_loading_tier: balanced\n' +
      '  custom_orphan_key: keep\n';
    const templateText = 'rule_loading_tier: minimal\n';
    const out = sync(userText, templateText);
    expect(out).toContain('rule_loading_tier: balanced');
    expect(out).toContain('custom_orphan_key: keep');
    expect(out).not.toContain('_user._user');
    expect(out).not.toContain('_user:\n  _user:');
  });

  it('heal_user_block is idempotent (unit)', () => {
    const userText = read(RT_FIXTURE_DIR, 'with-legacy-_user.yml');
    const templateText = read(RT_FIXTURE_DIR, 'template-basic.yml');
    const userTree = parse(userText);
    const templateTree = parse(templateText);
    heal_user_block(userTree, templateTree);
    const once = emit(userTree);
    heal_user_block(userTree, templateTree);
    const twice = emit(userTree);
    expect(once).toBe(twice);
  });
});

// =====================================================================
// Phase 5: idempotency
// =====================================================================

describe('idempotency', () => {
  for (const fixture of ['with-custom-comments.yml', 'with-legacy-_user.yml', 'current-real.yml']) {
    it(`${fixture}: second sync against first output is a no-op`, () => {
      const userText = read(RT_FIXTURE_DIR, fixture);
      const templateText = read(RT_FIXTURE_DIR, 'template-basic.yml');
      const once = sync(userText, templateText);
      const twice = sync(once, templateText);
      expect(once).toBe(twice);
    });
  }
});

// =====================================================================
// Phase 2: parser edge cases
// =====================================================================

describe('parser edge cases', () => {
  it('duplicate keys: last wins', () => {
    const text = 'a: 1\na: 2\n';
    const tree = parse(text);
    const keys = tree.children.filter((c) => c.key !== null).map((c) => c.key);
    expect(keys.filter((k) => k === 'a').length).toBe(1);
    const aNode = tree.children.find((c) => c.key === 'a') as Node;
    expect(aNode.raw_value).toBe('2');
  });

  it('comment between key and value', () => {
    const text = 'section:  # leading comment on parent\n  child: value\n';
    const tree = parse(text);
    const section = tree.children.find((c) => c.key === 'section') as Node;
    expect(section.inline_comment).not.toBeNull();
    expect(section.inline_comment).toContain('leading comment on parent');
    const child = section.children.find((c) => c.key === 'child') as Node;
    expect(child.raw_value).toBe('value');
  });

  it('blank lines preserved in emit', () => {
    const text = 'a: 1\n\nb: 2\n';
    expect(emit(parse(text))).toBe(text);
  });

  it('null scalars preserved verbatim', () => {
    for (const token of ['~', 'null', 'None']) {
      const text = `a: ${token}\n`;
      const tree = parse(text);
      const a = tree.children.find((c) => c.key === 'a') as Node;
      expect(a.raw_value).toBe(token);
    }
  });

  it('quoted keys kept quoted', () => {
    const text = '"yes": x\n';
    expect(emit(parse(text))).toBe(text);
  });

  it('CRLF line endings preserved', () => {
    const text = 'a: 1\r\nb: 2\r\n';
    expect(emit(parse(text))).toBe(text);
  });

  it('tabs in indent raise with line number', () => {
    const text = 'section:\n\tchild: value\n';
    expect(() => parse(text)).toThrow(/line 2/);
  });

  it('inline list preserved verbatim', () => {
    const text = 'items: [a, b, c]\n';
    expect(emit(parse(text))).toBe(text);
  });

  it('rejects inconsistent dedent (over-indent)', () => {
    expect(() => parse('a:\n  b: 1\n    c: 2\n      d: 3\n')).not.toThrow();
    expect(() => parse('a:\n  b:\n    c: 1\n   d: 2\n')).toThrow(/over-indent/);
  });
});

// =====================================================================
// API surface sanity
// =====================================================================

describe('module API surface', () => {
  it('exports parse / emit / merge / heal_user_block / sync', () => {
    expect(typeof parse).toBe('function');
    expect(typeof emit).toBe('function');
    expect(typeof merge).toBe('function');
    expect(typeof heal_user_block).toBe('function');
    expect(typeof sync).toBe('function');
  });
});
