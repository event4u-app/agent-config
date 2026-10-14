#!/usr/bin/env tsx

// src/skills/react-shadcn-ui/scripts/shadcn_add.ts
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
var ShadcnInstaller = class {
  projectRoot;
  dryRun;
  componentsJson;
  constructor(projectRoot = null, dryRun = false) {
    this.projectRoot = projectRoot ?? process.cwd();
    this.dryRun = dryRun;
    this.componentsJson = path.join(this.projectRoot, "components.json");
  }
  /** Check if shadcn is initialized — components.json exists. */
  checkShadcnConfig() {
    return fs.existsSync(this.componentsJson);
  }
  /** Get list of already installed components (unsorted, mirrors .py). */
  getInstalledComponents() {
    if (!this.checkShadcnConfig()) {
      return [];
    }
    try {
      const config = JSON.parse(fs.readFileSync(this.componentsJson, "utf-8"));
      const aliasesRaw = config && typeof config === "object" && "aliases" in config ? config.aliases : void 0;
      const aliases = aliasesRaw && typeof aliasesRaw === "object" ? aliasesRaw : {};
      const componentsAlias = typeof aliases.components === "string" ? aliases.components : "components";
      const componentsDir = path.join(this.projectRoot, componentsAlias.replace("@/", ""));
      const uiDir = path.join(componentsDir, "ui");
      if (!fs.existsSync(uiDir)) {
        return [];
      }
      return _globTsxStems(uiDir);
    } catch {
      return [];
    }
  }
  /** Add shadcn/ui components → [success, message]. */
  addComponents(components, overwrite = false) {
    if (components.length === 0) {
      return [false, "No components specified"];
    }
    if (!this.checkShadcnConfig()) {
      return [false, "shadcn not initialized. Run 'npx shadcn@latest init' first"];
    }
    const installed = this.getInstalledComponents();
    const alreadyInstalled = components.filter((c) => installed.includes(c));
    if (alreadyInstalled.length > 0 && !overwrite) {
      return [
        false,
        `Components already installed: ${alreadyInstalled.join(", ")}. Use --overwrite to reinstall`
      ];
    }
    const cmd = ["npx", "shadcn@latest", "add", ...components];
    if (overwrite) {
      cmd.push("--overwrite");
    }
    if (this.dryRun) {
      return [true, `Would run: ${cmd.join(" ")}`];
    }
    return this._runAdd(cmd, `Successfully added components: ${components.join(", ")}`);
  }
  /** Add all available shadcn/ui components → [success, message]. */
  addAllComponents(overwrite = false) {
    if (!this.checkShadcnConfig()) {
      return [false, "shadcn not initialized. Run 'npx shadcn@latest init' first"];
    }
    const cmd = ["npx", "shadcn@latest", "add", "--all"];
    if (overwrite) {
      cmd.push("--overwrite");
    }
    if (this.dryRun) {
      return [true, `Would run: ${cmd.join(" ")}`];
    }
    return this._runAdd(cmd, "Successfully added all components", true);
  }
  /**
   * Mirror the subprocess.run(..., check=True) try/except for both add paths.
   * `failAll` toggles the "Failed to add all components" vs "Failed to add
   * components" prefix.
   */
  _runAdd(cmd, successBase, failAll = false) {
    const result = spawnSync(cmd[0], cmd.slice(1), {
      cwd: this.projectRoot,
      encoding: "utf-8"
    });
    if (result.error && result.error.code === "ENOENT") {
      return [false, "npx not found. Ensure Node.js is installed"];
    }
    const stdout = result.stdout ?? "";
    const stderr = result.stderr ?? "";
    const status = result.status;
    if (status === 0) {
      let successMsg = successBase;
      if (stdout) {
        successMsg += `

Output:
${stdout}`;
      }
      return [true, successMsg];
    }
    const detail = stderr || stdout || _calledProcessError(cmd, status, result.signal);
    const prefix = failAll ? "Failed to add all components" : "Failed to add components";
    return [false, `${prefix}: ${detail}`];
  }
  /** List installed components → [success, message]. */
  listInstalled() {
    if (!this.checkShadcnConfig()) {
      return [false, "shadcn not initialized"];
    }
    const installed = this.getInstalledComponents();
    if (installed.length === 0) {
      return [true, "No components installed"];
    }
    const sorted = [...installed].sort(_pyStrCmp);
    return [true, "Installed components:\n" + sorted.map((c) => `  - ${c}`).join("\n")];
  }
};
function _pyStrCmp(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}
function _globTsxStems(uiDir) {
  let entries;
  try {
    entries = fs.readdirSync(uiDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries) {
    if (!e.name.endsWith(".tsx")) {
      continue;
    }
    let isFile = e.isFile();
    if (e.isSymbolicLink()) {
      try {
        isFile = fs.statSync(path.join(uiDir, e.name)).isFile();
      } catch {
        isFile = false;
      }
    }
    if (isFile) {
      out.push(e.name.slice(0, -".tsx".length));
    }
  }
  return out;
}
function _calledProcessError(cmd, status, signal) {
  const cmdRepr = "[" + cmd.map((c) => `'${c}'`).join(", ") + "]";
  if (signal) {
    return `Command ${cmdRepr} died with ${signal}.`;
  }
  return `Command ${cmdRepr} returned non-zero exit status ${status}.`;
}
var PROG = "shadcn_add";
var HELP = `usage: ${PROG} [-h] [--all] [--overwrite] [--dry-run] [--list]
                     [--project-root PROJECT_ROOT]
                     [components ...]

Add shadcn/ui components to your project

positional arguments:
  components            Component names to add (e.g., button, card, dialog)

optional arguments:
  -h, --help            show this help message and exit
  --all                 Add all available components
  --overwrite           Overwrite existing components
  --dry-run             Show what would be done without executing
  --list                List installed components
  --project-root PROJECT_ROOT
                        Project root directory (default: current directory)

Examples:
  # Add single component
  node <skills-root>/react-shadcn-ui/scripts/shadcn_add.mjs button

  # Add multiple components
  node <skills-root>/react-shadcn-ui/scripts/shadcn_add.mjs button card dialog

  # Add all components
  node <skills-root>/react-shadcn-ui/scripts/shadcn_add.mjs --all

  # Overwrite existing components
  node <skills-root>/react-shadcn-ui/scripts/shadcn_add.mjs button --overwrite

  # Dry run (show what would be done)
  node <skills-root>/react-shadcn-ui/scripts/shadcn_add.mjs button card --dry-run

  # List installed components
  node <skills-root>/react-shadcn-ui/scripts/shadcn_add.mjs --list
        
`;
var USAGE = `usage: ${PROG} [-h] [--all] [--overwrite] [--dry-run] [--list]
                     [--project-root PROJECT_ROOT]
                     [components ...]
`;
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
function parseArgs(argv) {
  const args = {
    components: [],
    all: false,
    overwrite: false,
    dry_run: false,
    list: false,
    project_root: null
  };
  let i = 0;
  while (i < argv.length) {
    let a = argv[i];
    let inlineValue = null;
    const eq = a.indexOf("=");
    if (a.startsWith("--") && eq !== -1) {
      inlineValue = a.slice(eq + 1);
      a = a.slice(0, eq);
    }
    if (a === "-h" || a === "--help") {
      process.stdout.write(HELP);
      throw new ArgExit(0);
    } else if (a === "--all") {
      args.all = true;
    } else if (a === "--overwrite") {
      args.overwrite = true;
    } else if (a === "--dry-run") {
      args.dry_run = true;
    } else if (a === "--list") {
      args.list = true;
    } else if (a === "--project-root") {
      const v = inlineValue ?? argv[++i];
      if (v === void 0) {
        argError("argument --project-root: expected one argument");
      }
      args.project_root = v;
    } else if (a.startsWith("-") && a !== "-") {
      argError(`unrecognized arguments: ${argv[i]}`);
    } else {
      args.components.push(argv[i]);
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
  const installer = new ShadcnInstaller(args.project_root, args.dry_run);
  if (args.list) {
    const [success2, message2] = installer.listInstalled();
    process.stdout.write(`${message2}
`);
    return success2 ? 0 : 1;
  }
  if (args.all) {
    const [success2, message2] = installer.addAllComponents(args.overwrite);
    process.stdout.write(`${message2}
`);
    return success2 ? 0 : 1;
  }
  if (args.components.length === 0) {
    process.stdout.write(HELP);
    return 1;
  }
  const [success, message] = installer.addComponents(args.components, args.overwrite);
  process.stdout.write(`${message}
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
  ShadcnInstaller,
  main
};
