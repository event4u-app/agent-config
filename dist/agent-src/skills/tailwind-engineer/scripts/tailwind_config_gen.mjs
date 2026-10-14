#!/usr/bin/env tsx

// src/skills/tailwind-engineer/scripts/tailwind_config_gen.ts
import * as fs from "node:fs";
import * as path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
var PROG = "tailwind_config_gen";
var USAGE = `usage: ${PROG} [-h] [--framework {react,vue,svelte,nextjs}]
                              [--js] [--output OUTPUT]
                              [--colors [NAME:VALUE ...]]
                              [--fonts [TYPE:FAMILY ...]]
                              [--spacing [NAME:VALUE ...]]
                              [--breakpoints [NAME:WIDTH ...]] [--plugins]
                              [--validate-only]
`;
function jsonDumpsIndent2(obj) {
  const pad = "  ";
  function enc(value, depth) {
    if (value === null) return "null";
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "number") return String(value);
    if (typeof value === "string") return encStr(value);
    if (Array.isArray(value)) {
      if (value.length === 0) return "[]";
      const inner2 = value.map((v) => pad.repeat(depth + 1) + enc(v, depth + 1));
      return "[\n" + inner2.join(",\n") + "\n" + pad.repeat(depth) + "]";
    }
    const o = value;
    const keys = Object.keys(o);
    if (keys.length === 0) return "{}";
    const inner = keys.map(
      (k) => pad.repeat(depth + 1) + encStr(k) + ": " + enc(o[k], depth + 1)
    );
    return "{\n" + inner.join(",\n") + "\n" + pad.repeat(depth) + "}";
  }
  function encStr(s) {
    let out = '"';
    for (const ch of s) {
      const cp = ch.codePointAt(0);
      if (ch === '"') out += '\\"';
      else if (ch === "\\") out += "\\\\";
      else if (ch === "\n") out += "\\n";
      else if (ch === "\r") out += "\\r";
      else if (ch === "	") out += "\\t";
      else if (ch === "\b") out += "\\b";
      else if (ch === "\f") out += "\\f";
      else if (cp < 32) out += "\\u" + cp.toString(16).padStart(4, "0");
      else if (cp < 127) out += ch;
      else if (cp > 65535) {
        const v = cp - 65536;
        const hi = 55296 + (v >> 10);
        const lo = 56320 + (v & 1023);
        out += "\\u" + hi.toString(16).padStart(4, "0");
        out += "\\u" + lo.toString(16).padStart(4, "0");
      } else {
        out += "\\u" + cp.toString(16).padStart(4, "0");
      }
    }
    return out + '"';
  }
  return enc(obj, 0);
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
var TailwindConfigGenerator = class {
  typescript;
  framework;
  outputPath;
  config;
  constructor(typescript = true, framework = "react", outputPath = null) {
    this.typescript = typescript;
    this.framework = framework;
    this.outputPath = outputPath ?? this._defaultOutputPath();
    this.config = this._baseConfig();
  }
  /** Determine default output path — Path.cwd() / `tailwind.config.{ext}`. */
  _defaultOutputPath() {
    const ext = this.typescript ? "ts" : "js";
    return path.join(process.cwd(), `tailwind.config.${ext}`);
  }
  /** Create base configuration structure. */
  _baseConfig() {
    return {
      darkMode: ["class"],
      content: this._defaultContentPaths(),
      theme: {
        extend: {}
      },
      plugins: []
    };
  }
  /** Get default content paths for framework. */
  _defaultContentPaths() {
    const paths = {
      react: ["./src/**/*.{js,jsx,ts,tsx}", "./index.html"],
      vue: ["./src/**/*.{vue,js,ts,jsx,tsx}", "./index.html"],
      svelte: ["./src/**/*.{svelte,js,ts}", "./src/app.html"],
      nextjs: [
        "./app/**/*.{js,ts,jsx,tsx}",
        "./pages/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}"
      ]
    };
    return paths[this.framework] ?? paths["react"];
  }
  _extend() {
    return this.config["theme"]["extend"];
  }
  /** Add custom colors to theme (dict.update — insertion order preserved). */
  addColors(colors) {
    const extend = this._extend();
    if (!("colors" in extend)) {
      extend["colors"] = {};
    }
    const target = extend["colors"];
    for (const [k, v] of Object.entries(colors)) {
      target[k] = v;
    }
  }
  /** Add full color palette (50-950 shades) for a base color. */
  addColorPalette(name, _baseColor) {
    const extend = this._extend();
    if (!("colors" in extend)) {
      extend["colors"] = {};
    }
    extend["colors"][name] = {
      "50": `var(--color-${name}-50)`,
      "100": `var(--color-${name}-100)`,
      "200": `var(--color-${name}-200)`,
      "300": `var(--color-${name}-300)`,
      "400": `var(--color-${name}-400)`,
      "500": `var(--color-${name}-500)`,
      "600": `var(--color-${name}-600)`,
      "700": `var(--color-${name}-700)`,
      "800": `var(--color-${name}-800)`,
      "900": `var(--color-${name}-900)`,
      "950": `var(--color-${name}-950)`
    };
  }
  /** Add custom font families. */
  addFonts(fonts) {
    const extend = this._extend();
    if (!("fontFamily" in extend)) {
      extend["fontFamily"] = {};
    }
    const target = extend["fontFamily"];
    for (const [k, v] of Object.entries(fonts)) {
      target[k] = v;
    }
  }
  /** Add custom spacing values. */
  addSpacing(spacing) {
    const extend = this._extend();
    if (!("spacing" in extend)) {
      extend["spacing"] = {};
    }
    const target = extend["spacing"];
    for (const [k, v] of Object.entries(spacing)) {
      target[k] = v;
    }
  }
  /** Add custom breakpoints. */
  addBreakpoints(breakpoints) {
    const extend = this._extend();
    if (!("screens" in extend)) {
      extend["screens"] = {};
    }
    const target = extend["screens"];
    for (const [k, v] of Object.entries(breakpoints)) {
      target[k] = v;
    }
  }
  /** Add plugin requirements (skip duplicates, preserve order). */
  addPlugins(plugins) {
    const arr = this.config["plugins"];
    for (const plugin of plugins) {
      if (!arr.includes(plugin)) {
        arr.push(plugin);
      }
    }
  }
  /** Get plugin recommendations based on configuration. */
  recommendPlugins() {
    const recommendations = [];
    recommendations.push("tailwindcss-animate");
    if (this.framework === "nextjs") {
      recommendations.push("@tailwindcss/typography");
    }
    return recommendations;
  }
  /** Generate configuration file content. */
  generateConfigString() {
    if (this.typescript) {
      return this._generateTypescript();
    }
    return this._generateJavascript();
  }
  /** Generate TypeScript configuration. */
  _generateTypescript() {
    const pluginsStr = this._formatPlugins();
    const configObj = { ...this.config };
    delete configObj["plugins"];
    const configJson = jsonDumpsIndent2(configObj);
    return `import type { Config } from 'tailwindcss'

const config: Config = {
${this._indentJson(configJson, 1)}
  plugins: [${pluginsStr}],
}

export default config
`;
  }
  /** Generate JavaScript configuration. */
  _generateJavascript() {
    const pluginsStr = this._formatPlugins();
    const configObj = { ...this.config };
    delete configObj["plugins"];
    const configJson = jsonDumpsIndent2(configObj);
    return `/** @type {import('tailwindcss').Config} */
module.exports = {
${this._indentJson(configJson, 1)}
  plugins: [${pluginsStr}],
}
`;
  }
  /** Format plugins array for config. */
  _formatPlugins() {
    const arr = this.config["plugins"];
    if (arr.length === 0) {
      return "";
    }
    const pluginRequires = arr.map((plugin) => `require('${plugin}')`);
    return pluginRequires.join(", ");
  }
  /** Add indentation to JSON string (skip first and last brace lines). */
  _indentJson(jsonStr, level) {
    const indent = "  ".repeat(level);
    const lines = jsonStr.split("\n");
    const indented = lines.slice(1, lines.length - 1).map((line) => indent + line);
    return indented.join("\n");
  }
  /** Write configuration to file → [success, message]. */
  writeConfig() {
    try {
      const configContent = this.generateConfigString();
      fs.writeFileSync(this.outputPath, configContent);
      return [true, `Configuration written to ${this.outputPath}`];
    } catch (e) {
      return [false, `Failed to write config: ${osErrorMessage(e)}`];
    }
  }
  /** Validate configuration → [valid, message]. */
  validateConfig() {
    if (this.config["content"].length === 0) {
      return [false, "No content paths specified"];
    }
    if (Object.keys(this._extend()).length === 0) {
      return [true, "Warning: No theme extensions defined"];
    }
    return [true, "Configuration valid"];
  }
};
function osErrorMessage(e) {
  if (e && typeof e === "object" && "message" in e) {
    return String(e.message);
  }
  return String(e);
}
var ArgExit = class extends Error {
  constructor(code) {
    super("argexit");
    this.code = code;
  }
  code;
};
function argError(message) {
  process.stderr.write(USAGE);
  process.stderr.write(`${PROG}: error: ${message}
`);
  throw new ArgExit(2);
}
var FRAMEWORK_CHOICES = ["react", "vue", "svelte", "nextjs"];
function parseArgs(argv) {
  const args = {
    framework: "react",
    js: false,
    output: null,
    colors: null,
    fonts: null,
    spacing: null,
    breakpoints: null,
    plugins: false,
    validate_only: false
  };
  const starFlags = /* @__PURE__ */ new Set(["--colors", "--fonts", "--spacing", "--breakpoints"]);
  let i = 0;
  while (i < argv.length) {
    let a = argv[i];
    let inlineValue = null;
    const eq = a.indexOf("=");
    if (a.startsWith("--") && eq !== -1) {
      inlineValue = a.slice(eq + 1);
      a = a.slice(0, eq);
    }
    if (a === "--js") {
      args.js = true;
    } else if (a === "--plugins") {
      args.plugins = true;
    } else if (a === "--validate-only") {
      args.validate_only = true;
    } else if (a === "--framework") {
      const v = inlineValue ?? argv[++i];
      if (v === void 0) {
        argError("argument --framework: expected one argument");
      }
      if (!FRAMEWORK_CHOICES.includes(v)) {
        argError(
          `argument --framework: invalid choice: '${v}' (choose from 'react', 'vue', 'svelte', 'nextjs')`
        );
      }
      args.framework = v;
    } else if (a === "--output") {
      const v = inlineValue ?? argv[++i];
      if (v === void 0) {
        argError("argument --output: expected one argument");
      }
      args.output = v;
    } else if (starFlags.has(a)) {
      const collected = [];
      if (inlineValue !== null) {
        collected.push(inlineValue);
      } else {
        while (i + 1 < argv.length && !argv[i + 1].startsWith("-")) {
          collected.push(argv[++i]);
        }
      }
      const key = a.slice(2);
      args[key] = collected;
    } else {
      argError(`unrecognized arguments: ${a}`);
    }
    i += 1;
  }
  return args;
}
function main(argv = process.argv.slice(2)) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    if (e instanceof ArgExit) {
      return e.code;
    }
    throw e;
  }
  const generator = new TailwindConfigGenerator(!args.js, args.framework, args.output);
  if (args.colors) {
    const colors = {};
    for (const colorSpec of args.colors) {
      const idx = colorSpec.indexOf(":");
      if (idx === -1) {
        process.stderr.write(`Invalid color spec: ${colorSpec}
`);
        return 1;
      }
      const name = colorSpec.slice(0, idx);
      const value = colorSpec.slice(idx + 1);
      colors[name] = value;
    }
    generator.addColors(colors);
  }
  if (args.fonts) {
    const fonts = {};
    for (const fontSpec of args.fonts) {
      const idx = fontSpec.indexOf(":");
      if (idx === -1) {
        process.stderr.write(`Invalid font spec: ${fontSpec}
`);
        return 1;
      }
      const fontType = fontSpec.slice(0, idx);
      const family = fontSpec.slice(idx + 1);
      fonts[fontType] = family.split(",").map((f) => _stripChars(f.trim(), `'"`));
    }
    generator.addFonts(fonts);
  }
  if (args.spacing) {
    const spacing = {};
    for (const spacingSpec of args.spacing) {
      const idx = spacingSpec.indexOf(":");
      if (idx === -1) {
        process.stderr.write(`Invalid spacing spec: ${spacingSpec}
`);
        return 1;
      }
      const name = spacingSpec.slice(0, idx);
      const value = spacingSpec.slice(idx + 1);
      spacing[name] = value;
    }
    generator.addSpacing(spacing);
  }
  if (args.breakpoints) {
    const breakpoints = {};
    for (const bpSpec of args.breakpoints) {
      const idx = bpSpec.indexOf(":");
      if (idx === -1) {
        process.stderr.write(`Invalid breakpoint spec: ${bpSpec}
`);
        return 1;
      }
      const name = bpSpec.slice(0, idx);
      const width = bpSpec.slice(idx + 1);
      breakpoints[name] = width;
    }
    generator.addBreakpoints(breakpoints);
  }
  if (args.plugins) {
    const recommended = generator.recommendPlugins();
    generator.addPlugins(recommended);
    process.stdout.write(`Added recommended plugins: ${recommended.join(", ")}
`);
    process.stdout.write("\nInstall with:\n");
    process.stdout.write(`  npm install -D ${recommended.join(" ")}
`);
  }
  const [valid, message] = generator.validateConfig();
  if (!valid) {
    process.stderr.write(`Validation failed: ${message}
`);
    return 1;
  }
  if (message.startsWith("Warning")) {
    process.stdout.write(`${message}
`);
  }
  if (args.validate_only) {
    process.stdout.write("Configuration valid\n");
    process.stdout.write("\nGenerated config:\n");
    process.stdout.write(`${generator.generateConfigString()}
`);
    return 0;
  }
  const [success, writeMsg] = generator.writeConfig();
  process.stdout.write(`${writeMsg}
`);
  return success ? 0 : 1;
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
var _invokedDirectly = _isCliEntry();
if (_invokedDirectly) {
  process.exitCode = main();
}
export {
  TailwindConfigGenerator,
  main
};
