import { UsageError } from '../errors.mjs';

// name -> { takesValue, metavar, help }
export const OPTIONS = {
  level: { takesValue: true, metavar: '<lvl>', help: 'only records at this level or above (debug|info|warn|error)' },
  sort: { takesValue: true, metavar: 'time|level', help: 'sort order (default: time)' },
  format: { takesValue: true, metavar: 'text|json', help: 'output format (default: text)' },
  help: { takesValue: false, help: 'show this help' },
};

export function parseArgs(argv) {
  const raw = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new UsageError(`unexpected argument: ${arg}`);
    let name = arg.slice(2);
    let value;
    const eq = name.indexOf('=');
    if (eq !== -1) {
      value = name.slice(eq + 1);
      name = name.slice(0, eq);
    }
    const spec = OPTIONS[name];
    if (!spec) throw new UsageError(`unknown option: --${name}`);
    if (spec.takesValue) {
      if (value === undefined) {
        value = argv[++i];
        if (value === undefined) throw new UsageError(`missing value for --${name}`);
      }
      raw[name] = value;
    } else {
      if (value !== undefined) throw new UsageError(`--${name} takes no value`);
      raw[name] = true;
    }
  }
  return raw;
}
