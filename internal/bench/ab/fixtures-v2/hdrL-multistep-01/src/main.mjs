import { parseArgs } from './cli/options.mjs';
import { helpText } from './cli/help.mjs';
import { buildConfig } from './config/validate.mjs';
import { runQuery } from './exec/query.mjs';
import { render } from './output/format.mjs';
import { UsageError } from './errors.mjs';

// Returns { code, stdout, stderr } instead of touching the process, so it is testable.
export function run(argv, records) {
  try {
    const config = buildConfig(parseArgs(argv));
    if (config.help) return { code: 0, stdout: helpText(), stderr: '' };
    const result = runQuery(config, records);
    return { code: 0, stdout: render(result, config.format), stderr: '' };
  } catch (err) {
    if (err instanceof UsageError) return { code: 2, stdout: '', stderr: `logq: ${err.message}` };
    throw err;
  }
}
