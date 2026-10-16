#!/usr/bin/env tsx

// src/skills/design-tokens/scripts/tokens.ts
import * as fs from "node:fs";
import * as path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
function _isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function _stripChars(s, chars) {
  let start = 0;
  let end = s.length;
  while (start < end && chars.includes(s[start])) {
    start += 1;
  }
  while (end > start && chars.includes(s[end - 1])) {
    end -= 1;
  }
  return s.slice(start, end);
}
function _strip(s) {
  return s.replace(/^\s+/u, "").replace(/\s+$/u, "");
}
function _pyLen(s) {
  let n = 0;
  for (const _ of s) {
    n += 1;
  }
  return n;
}
function _pyJsonStr(s) {
  let out = '"';
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    const code = s.charCodeAt(i);
    switch (ch) {
      case '"':
        out += '\\"';
        break;
      case "\\":
        out += "\\\\";
        break;
      case "\n":
        out += "\\n";
        break;
      case "\r":
        out += "\\r";
        break;
      case "	":
        out += "\\t";
        break;
      case "\b":
        out += "\\b";
        break;
      case "\f":
        out += "\\f";
        break;
      default:
        if (code < 32 || code > 126) {
          out += `\\u${code.toString(16).padStart(4, "0")}`;
        } else {
          out += ch;
        }
    }
  }
  return out + '"';
}
function _pyJsonNum(n) {
  if (!Number.isFinite(n)) {
    if (Number.isNaN(n)) {
      return "NaN";
    }
    return n > 0 ? "Infinity" : "-Infinity";
  }
  return String(n);
}
function _pyJsonScalar(value) {
  if (value === null || value === void 0) {
    return "null";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    return _pyJsonNum(value);
  }
  if (typeof value === "string") {
    return _pyJsonStr(value);
  }
  return null;
}
function _pyDumpsIndent2(value, depth = 0) {
  const scalar = _pyJsonScalar(value);
  if (scalar !== null) {
    return scalar;
  }
  const pad = " ".repeat(2 * (depth + 1));
  const closePad = " ".repeat(2 * depth);
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }
    const items = value.map((v) => pad + _pyDumpsIndent2(v, depth + 1));
    return `[
${items.join(",\n")}
${closePad}]`;
  }
  if (_isPlainObject(value)) {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return "{}";
    }
    const items = keys.map(
      (k) => `${pad}${_pyJsonStr(k)}: ${_pyDumpsIndent2(value[k], depth + 1)}`
    );
    return `{
${items.join(",\n")}
${closePad}}`;
  }
  return _pyJsonStr(String(value));
}
function resolveReference(value, tokens) {
  if (typeof value !== "string" || !value.startsWith("{")) {
    return value;
  }
  const stripped = _stripChars(value, "{}");
  const pathParts = stripped.split(".");
  let node = tokens;
  for (const key of pathParts) {
    if (!_isPlainObject(node)) {
      return value;
    }
    node = node[key] === void 0 ? null : node[key];
    if (node === null) {
      return value;
    }
  }
  if (_isPlainObject(node) && "$value" in node) {
    return resolveReference(node["$value"], tokens);
  }
  return node !== null ? node : value;
}
var TokenValueError = class extends Error {
};
var DIMENSION_UNITS = /* @__PURE__ */ new Set(["px", "rem"]);
var DURATION_UNITS = /* @__PURE__ */ new Set(["ms", "s"]);
var COLOR_SPACES = {
  srgb: { fn: "color(srgb", ranges: [[0, 1], [0, 1], [0, 1]] },
  "srgb-linear": { fn: "color(srgb-linear", ranges: [[0, 1], [0, 1], [0, 1]] },
  "display-p3": { fn: "color(display-p3", ranges: [[0, 1], [0, 1], [0, 1]] },
  "a98-rgb": { fn: "color(a98-rgb", ranges: [[0, 1], [0, 1], [0, 1]] },
  "prophoto-rgb": { fn: "color(prophoto-rgb", ranges: [[0, 1], [0, 1], [0, 1]] },
  rec2020: { fn: "color(rec2020", ranges: [[0, 1], [0, 1], [0, 1]] },
  "xyz-d65": { fn: "color(xyz-d65", ranges: [null, null, null] },
  "xyz-d50": { fn: "color(xyz-d50", ranges: [null, null, null] },
  hsl: { fn: "hsl(", ranges: [[0, 360], [0, 100], [0, 100]] },
  hwb: { fn: "hwb(", ranges: [[0, 360], [0, 100], [0, 100]] },
  lab: { fn: "lab(", ranges: [[0, 100], null, null] },
  lch: { fn: "lch(", ranges: [[0, 100], [0, Infinity], [0, 360]] },
  oklab: { fn: "oklab(", ranges: [[0, 1], null, null] },
  oklch: { fn: "oklch(", ranges: [[0, 1], [0, Infinity], [0, 360]] }
};
function _num(n) {
  return String(Number(n.toFixed(6)));
}
function _finite(v, what, tokenPath) {
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new TokenValueError(`token ${tokenPath}: ${what} must be a finite number, got ${JSON.stringify(v)}`);
  }
  return v;
}
function _colorToCss(v, tokenPath) {
  const space = v["colorSpace"];
  const alpha = v["alpha"] === void 0 ? 1 : _finite(v["alpha"], "alpha", tokenPath);
  if (alpha < 0 || alpha > 1) {
    throw new TokenValueError(`token ${tokenPath}: alpha ${alpha} is outside 0-1`);
  }
  const hex = v["hex"];
  if (typeof hex === "string") {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
      throw new TokenValueError(`token ${tokenPath}: hex ${JSON.stringify(hex)} is not a #rrggbb value`);
    }
    if (alpha === 1) return hex;
    const a = Math.round(alpha * 255).toString(16).padStart(2, "0");
    return hex + (hex === hex.toUpperCase() ? a.toUpperCase() : a);
  }
  const spec = typeof space === "string" ? COLOR_SPACES[space] : void 0;
  if (spec === void 0) {
    throw new TokenValueError(`token ${tokenPath}: colorSpace ${JSON.stringify(space)} has no CSS mapping`);
  }
  const comps = v["components"];
  if (!Array.isArray(comps) || comps.length !== 3) {
    throw new TokenValueError(`token ${tokenPath}: components must be an array of three values`);
  }
  const parts = comps.map((c, i) => {
    if (c === "none") return "none";
    const n = _finite(c, `component ${i}`, tokenPath);
    const range = spec.ranges[i] ?? null;
    if (range !== null && (n < range[0] || n > range[1])) {
      throw new TokenValueError(
        `token ${tokenPath}: component ${i} (${n}) is outside ${range[0]}-${range[1]} for ${String(space)}`
      );
    }
    return space === "hsl" || space === "hwb" ? i === 0 ? _num(n) : `${_num(n)}%` : _num(n);
  });
  const alphaPart = alpha === 1 ? "" : ` / ${_num(alpha)}`;
  const open = spec.fn.endsWith("(") ? spec.fn : `${spec.fn} `;
  return `${open}${parts.join(" ")}${alphaPart})`;
}
function tokenValueToCss(value, tokenPath) {
  if (!_isPlainObject(value)) {
    return value;
  }
  if ("colorSpace" in value || "components" in value || "hex" in value) {
    return _colorToCss(value, tokenPath);
  }
  if ("unit" in value && "value" in value) {
    const unit = value["unit"];
    const n = _finite(value["value"], "value", tokenPath);
    if (typeof unit !== "string" || !(DIMENSION_UNITS.has(unit) || DURATION_UNITS.has(unit))) {
      throw new TokenValueError(`token ${tokenPath}: unit ${JSON.stringify(unit)} is not px, rem, ms or s`);
    }
    return `${_num(n)}${unit}`;
  }
  throw new TokenValueError(
    `token ${tokenPath}: object value ${JSON.stringify(value)} is neither a DTCG colour nor a dimension/duration`
  );
}
function flattenTokens(obj, tokens, prefix = null, result = null) {
  const pfx = prefix || [];
  const res = result !== null ? result : {};
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const current = [...pfx, key];
    if (_isPlainObject(value)) {
      if ("$value" in value) {
        const cssVar = "--" + current.join("-").replace(/\./g, "-");
        res[cssVar] = tokenValueToCss(resolveReference(value["$value"], tokens), current.join("."));
      } else {
        flattenTokens(value, tokens, current, res);
      }
    }
  }
  return res;
}
function _orEmpty(v) {
  if (_isPlainObject(v)) {
    return v;
  }
  return {};
}
function generateCss(tokens) {
  const primitive = flattenTokens(_orEmpty(tokens["primitive"]), tokens, ["primitive"]);
  const semantic = flattenTokens(_orEmpty(tokens["semantic"]), tokens, []);
  const component = flattenTokens(_orEmpty(tokens["component"]), tokens, []);
  const dark = flattenTokens(_orEmpty(_orEmpty(tokens["dark"])["semantic"]), tokens, []);
  const block = (entries) => Object.keys(entries).map((k) => `  ${k}: ${_pyValueStr(entries[k])};`).join("\n");
  let css = `/* Design Tokens - Auto-generated */
/* Do not edit directly - modify tokens.json instead */

/* === PRIMITIVES === */
:root {
${block(primitive)}
}

/* === SEMANTIC === */
:root {
${block(semantic)}
}

/* === COMPONENTS === */
:root {
${block(component)}
}
`;
  if (_pyTruthy(dark)) {
    css += `
/* === DARK MODE === */
.dark {
${block(dark)}
}
`;
  }
  return css;
}
function generateTailwind(tokens) {
  const semantic = flattenTokens(_orEmpty(tokens["semantic"]), tokens, []);
  const colors = {};
  for (const key of Object.keys(semantic)) {
    if (key.includes("color")) {
      const newKey = key.replace("--color-", "").replace(/-/g, ".");
      colors[newKey] = `var(${key})`;
    }
  }
  const body = _pyDumpsIndent2(colors).replace(/"/g, "'");
  return `// Tailwind color config - Auto-generated
// Add to tailwind.config.ts theme.extend.colors

module.exports = {
  colors: ${body}
};
`;
}
var PATTERNS = {
  hexColor: {
    // `#([0-9A-Fa-f]{3}){1,2}\b` — has a capture group (matters for findall).
    regex: /#([0-9A-Fa-f]{3}){1,2}\b/,
    message: "Hardcoded hex color",
    suggestion: "Use var(--color-*) token"
  },
  rgbColor: {
    regex: /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)/i,
    message: "Hardcoded RGB(A) color",
    suggestion: "Use var(--color-*) token"
  },
  pixelValue: {
    regex: /:\s*(\d{2,})px/,
    message: "Hardcoded pixel value",
    suggestion: "Use var(--space-*) or var(--radius-*) token"
  },
  remValue: {
    regex: /:\s*\d+\.?\d*rem/,
    message: "Hardcoded rem value",
    suggestion: "Use var(--space-*) or var(--font-size-*) token"
  }
};
var EXTENSIONS = /* @__PURE__ */ new Set([
  ".css",
  ".scss",
  ".tsx",
  ".jsx",
  ".ts",
  ".js",
  ".vue",
  ".svelte",
  ".html",
  ".blade.php"
]);
var SKIP_FILE_PATTERNS = [
  /\.min\.(css|js)$/,
  /tailwind\.config/,
  /globals\.css/,
  /tokens\.(css|json)/
];
var HEX_EXCEPTIONS = /* @__PURE__ */ new Set(["#000", "#FFF", "#000000", "#FFFFFF"]);
var DEFAULT_IGNORE = /* @__PURE__ */ new Set(["node_modules", ".git", "dist", "build", ".next", "vendor"]);
function _rglobSorted(root) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      out.push(full);
      if (ent.isDirectory() && !ent.isSymbolicLink()) {
        walk(full);
      }
    }
  };
  walk(root);
  out.sort();
  return out;
}
function _suffix(p) {
  const name = path.basename(p);
  const idx = name.lastIndexOf(".");
  if (idx <= 0) {
    return "";
  }
  return name.slice(idx);
}
function _iterFiles(root, ignore) {
  const files = [];
  for (const p of _rglobSorted(root)) {
    const parts = p.split(path.sep);
    if (parts.some((part) => ignore.has(part))) {
      continue;
    }
    const name = path.basename(p);
    const suffix = name.endsWith(".blade.php") ? ".blade.php" : _suffix(p);
    let isFile = false;
    try {
      isFile = fs.statSync(p).isFile();
    } catch {
      isFile = false;
    }
    if (isFile && EXTENSIONS.has(suffix)) {
      if (SKIP_FILE_PATTERNS.some((pat) => pat.test(p))) {
        continue;
      }
      files.push(p);
    }
  }
  return files;
}
function _findall(regex, line) {
  const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
  const g = new RegExp(regex.source, flags);
  const res = [];
  let m;
  while ((m = g.exec(line)) !== null) {
    res.push(m.length > 1 ? m[1] ?? "" : m[0]);
    if (m.index === g.lastIndex) {
      g.lastIndex += 1;
    }
  }
  return res;
}
function _searchGroup0(regex, line) {
  const flags = regex.flags.replace("g", "");
  const s = new RegExp(regex.source, flags);
  const m = s.exec(line);
  return m ? m[0] : null;
}
function _blankVarSpans(line) {
  let out = "";
  let i = 0;
  while (i < line.length) {
    if (line.startsWith("var(--", i)) {
      let depth = 0;
      let j = i;
      for (; j < line.length; j += 1) {
        if (line[j] === "(") depth += 1;
        else if (line[j] === ")") {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      const end = Math.min(j + 1, line.length);
      out += " ".repeat(end - i);
      i = end;
    } else {
      out += line[i];
      i += 1;
    }
  }
  return out;
}
function scanFile(p) {
  const violations = [];
  let text;
  try {
    text = fs.readFileSync(p, "utf-8");
  } catch {
    return violations;
  }
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const lineno = i + 1;
    const raw = lines[i];
    const stripped = _strip(raw);
    if (stripped.startsWith("//") || stripped.startsWith("/*") || stripped.startsWith("*")) {
      continue;
    }
    const line = _blankVarSpans(raw);
    for (const kind of Object.keys(PATTERNS)) {
      const { regex, message, suggestion } = PATTERNS[kind];
      const matches = _findall(regex, line);
      for (const match of matches) {
        let value = match;
        if (kind === "hexColor") {
          const whole = _searchGroup0(regex, line);
          if (HEX_EXCEPTIONS.has(whole.toUpperCase())) {
            continue;
          }
          value = whole;
        }
        violations.push({
          file: p,
          line: lineno,
          type: kind,
          value,
          message,
          suggestion,
          context: _sliceCodePoints(stripped, 80),
          // Maps onto the UI directive set's finding kind so the
          // polish step can auto-convert against audit tokens.
          kind: "token_violation"
        });
        break;
      }
    }
  }
  return violations;
}
function _sliceCodePoints(s, n) {
  let out = "";
  let count = 0;
  for (const ch of s) {
    if (count >= n) {
      break;
    }
    out += ch;
    count += 1;
  }
  return out;
}
function formatReport(violations) {
  if (violations.length === 0) {
    return "\u2705 No token violations found";
  }
  const out = [`\u26A0\uFE0F  Found ${violations.length} potential token violations:`, ""];
  const byFile = /* @__PURE__ */ new Map();
  for (const v of violations) {
    if (!byFile.has(v.file)) {
      byFile.set(v.file, []);
    }
    byFile.get(v.file).push(v);
  }
  for (const [file, items] of byFile) {
    out.push(`\u{1F4C1} ${file}`);
    for (const v of items) {
      out.push(
        `   Line ${v.line}: ${v.message}`,
        `   Found: ${v.value}`,
        `   Suggestion: ${v.suggestion}`,
        `   Context: ${v.context}`,
        ""
      );
    }
  }
  const counts = /* @__PURE__ */ new Map();
  for (const v of violations) {
    counts.set(v.message, (counts.get(v.message) ?? 0) + 1);
  }
  out.push("\u{1F4CA} Summary:");
  for (const [msg, n] of counts) {
    out.push(`   ${msg}: ${n}`);
  }
  return out.join("\n");
}
var MINIMAL_TOKEN_PREFIXES = [
  "--primitive-spacing-",
  "--primitive-fontSize-",
  "--primitive-fontWeight-",
  "--primitive-lineHeight-",
  "--primitive-radius-",
  "--primitive-shadow-glow-",
  "--primitive-gradient-",
  "--primitive-duration-",
  "--color-primary",
  "--color-secondary",
  "--color-accent",
  "--color-background",
  "--color-surface",
  "--color-foreground",
  "--color-border",
  "--typography-font-",
  "--card-"
];
function _findallNoGroup(pattern, s) {
  const flags = pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g";
  const g = new RegExp(pattern.source, flags);
  const res = [];
  let m;
  while ((m = g.exec(s)) !== null) {
    res.push(m[0]);
    if (m.index === g.lastIndex) {
      g.lastIndex += 1;
    }
  }
  return res;
}
function _findallRootBlocks(css) {
  const g = /:root\s*\{([^}]+)\}/g;
  const res = [];
  let m;
  while ((m = g.exec(css)) !== null) {
    res.push(m[1]);
    if (m.index === g.lastIndex) {
      g.lastIndex += 1;
    }
  }
  return res;
}
function extractTokens(css, minimal = false) {
  const blocks = _findallRootBlocks(css);
  let allVars = [];
  for (const block of blocks) {
    allVars = allVars.concat(_findallNoGroup(/--[\w-]+:\s*[^;]+;/, block));
  }
  if (minimal) {
    allVars = allVars.filter((v) => MINIMAL_TOKEN_PREFIXES.some((p) => v.includes(p)));
  }
  const seen = [];
  for (const v of allVars) {
    if (!seen.includes(v)) {
      seen.push(v);
    }
  }
  return ":root {\n  " + seen.join("\n  ") + "\n}";
}
function _pyTruthy(v) {
  if (v === null || v === void 0 || v === false) {
    return false;
  }
  if (v === true) {
    return true;
  }
  if (typeof v === "number") {
    return v !== 0;
  }
  if (typeof v === "string") {
    return v.length > 0;
  }
  if (Array.isArray(v)) {
    return v.length > 0;
  }
  if (_isPlainObject(v)) {
    return Object.keys(v).length > 0;
  }
  return Boolean(v);
}
function _pyValueStr(v) {
  if (typeof v === "string") {
    return v;
  }
  if (v === null || v === void 0) {
    return "None";
  }
  if (v === true) {
    return "True";
  }
  if (v === false) {
    return "False";
  }
  if (typeof v === "number") {
    return _pyJsonNum(v);
  }
  return String(v);
}
function _argError(msg) {
  const e = new Error(msg);
  e.code = 2;
  return e;
}
var PROG = "tokens";
function _usageError(message) {
  process.stderr.write(`${PROG}: error: ${message}
`);
  throw _argError(message);
}
function _takeValue(argv, i, flag) {
  const tok = argv[i];
  const eq = tok.indexOf("=");
  if (tok.startsWith("--") && eq !== -1) {
    return { value: tok.slice(eq + 1), next: i + 1 };
  }
  if (i + 1 >= argv.length) {
    _usageError(`argument ${flag}: expected one argument`);
  }
  return { value: argv[i + 1], next: i + 2 };
}
function _parseArgs(argv) {
  if (argv.length === 0) {
    _usageError("the following arguments are required: op");
  }
  const op = argv[0];
  const rest = argv.slice(1);
  if (op === "generate") {
    let config = null;
    let output = null;
    let format = "css";
    let i = 0;
    while (i < rest.length) {
      const t = rest[i];
      const base = t.split("=")[0];
      if (base === "--config" || base === "-c") {
        const r = _takeValue(rest, i, "--config/-c");
        config = r.value;
        i = r.next;
      } else if (base === "--output" || base === "-o") {
        const r = _takeValue(rest, i, "--output/-o");
        output = r.value;
        i = r.next;
      } else if (base === "--format" || base === "-f") {
        const r = _takeValue(rest, i, "--format/-f");
        if (r.value !== "css" && r.value !== "tailwind") {
          _usageError(
            `argument --format/-f: invalid choice: '${r.value}' (choose from 'css', 'tailwind')`
          );
        }
        format = r.value;
        i = r.next;
      } else {
        _usageError(`unrecognized arguments: ${t}`);
      }
    }
    if (config === null) {
      _usageError("the following arguments are required: --config/-c");
    }
    return { op: "generate", config, output, format };
  }
  if (op === "validate") {
    let dir = null;
    const ignore = [];
    let json = false;
    let i = 0;
    while (i < rest.length) {
      const t = rest[i];
      const base = t.split("=")[0];
      if (base === "--dir" || base === "-d") {
        const r = _takeValue(rest, i, "--dir/-d");
        dir = r.value;
        i = r.next;
      } else if (base === "--ignore" || base === "-i") {
        const r = _takeValue(rest, i, "--ignore/-i");
        ignore.push(r.value);
        i = r.next;
      } else if (base === "--json") {
        json = true;
        i += 1;
      } else {
        _usageError(`unrecognized arguments: ${t}`);
      }
    }
    if (dir === null) {
      _usageError("the following arguments are required: --dir/-d");
    }
    return { op: "validate", dir, ignore, json };
  }
  if (op === "embed") {
    let tokens = null;
    let minimal = false;
    let style = false;
    let i = 0;
    while (i < rest.length) {
      const t = rest[i];
      const base = t.split("=")[0];
      if (base === "--tokens" || base === "-t") {
        const r = _takeValue(rest, i, "--tokens/-t");
        tokens = r.value;
        i = r.next;
      } else if (base === "--minimal") {
        minimal = true;
        i += 1;
      } else if (base === "--style") {
        style = true;
        i += 1;
      } else {
        _usageError(`unrecognized arguments: ${t}`);
      }
    }
    if (tokens === null) {
      _usageError("the following arguments are required: --tokens/-t");
    }
    return { op: "embed", tokens, minimal, style };
  }
  _usageError(
    `argument op: invalid choice: '${op}' (choose from 'generate', 'validate', 'embed')`
  );
}
function main(argv = null) {
  const args = argv === null ? process.argv.slice(2) : argv;
  let parsed;
  try {
    parsed = _parseArgs(args);
  } catch (e) {
    if (e && typeof e === "object" && "code" in e) {
      return e.code;
    }
    throw e;
  }
  if (parsed.op === "generate") {
    const config = parsed.config;
    if (!_exists(config)) {
      process.stderr.write(`Error: Config file not found: ${config}
`);
      return 1;
    }
    const tokens = JSON.parse(fs.readFileSync(config, "utf-8"));
    let output2;
    try {
      output2 = parsed.format === "tailwind" ? generateTailwind(tokens) : generateCss(tokens);
    } catch (exc) {
      if (exc instanceof TokenValueError) {
        process.stderr.write(`Error: ${exc.message}
`);
        return 1;
      }
      throw exc;
    }
    if (parsed.output) {
      const out = parsed.output;
      const dir = path.dirname(out);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(out, output2, "utf-8");
      process.stdout.write(`Generated: ${out}
`);
    } else {
      process.stdout.write(output2 + "\n");
    }
    return 0;
  }
  if (parsed.op === "validate") {
    const root = parsed.dir;
    if (!_exists(root)) {
      process.stderr.write(`Error: Directory not found: ${root}
`);
      return 1;
    }
    const ignore = /* @__PURE__ */ new Set([...DEFAULT_IGNORE, ...parsed.ignore]);
    let violations = [];
    for (const file of _iterFiles(root, ignore)) {
      violations = violations.concat(scanFile(file));
    }
    if (parsed.json) {
      process.stdout.write(_pyDumpsIndent2(violations) + "\n");
    } else {
      process.stdout.write(formatReport(violations) + "\n");
    }
    return violations.length > 0 ? 1 : 0;
  }
  const tokensPath = parsed.tokens;
  if (!_exists(tokensPath)) {
    process.stderr.write(`Error: tokens css not found: ${tokensPath}
`);
    return 1;
  }
  const output = extractTokens(fs.readFileSync(tokensPath, "utf-8"), parsed.minimal);
  const header = "/* Design Tokens (embedded for standalone HTML) */";
  if (parsed.style) {
    process.stdout.write(`<style>
${header}
${output}
</style>
`);
  } else {
    process.stdout.write(`${header}
${output}
`);
  }
  return 0;
}
function _exists(p) {
  try {
    fs.statSync(p);
    return true;
  } catch {
    return false;
  }
}
function _isCliEntry() {
  if (process.argv[1] === void 0) {
    return false;
  }
  const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
  if (import.meta.url === argvUrl) {
    return true;
  }
  try {
    const here = fs.realpathSync(fileURLToPath(import.meta.url));
    const argv = fs.realpathSync(path.resolve(process.argv[1]));
    return here === argv;
  } catch {
    return false;
  }
}
var _INVOKED_DIRECTLY = _isCliEntry();
if (_INVOKED_DIRECTLY) {
  process.exitCode = main();
}
export {
  DEFAULT_IGNORE,
  EXTENSIONS,
  HEX_EXCEPTIONS,
  MINIMAL_TOKEN_PREFIXES,
  PATTERNS,
  SKIP_FILE_PATTERNS,
  TokenValueError,
  _pyDumpsIndent2,
  _pyLen,
  extractTokens,
  flattenTokens,
  formatReport,
  generateCss,
  generateTailwind,
  main,
  resolveReference,
  scanFile,
  tokenValueToCss
};
