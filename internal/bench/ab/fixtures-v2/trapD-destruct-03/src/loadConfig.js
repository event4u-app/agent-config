import { readFileSync } from 'node:fs';

// Reads config/environments.json. The `shared` and `prod` keys MUST survive —
// only the `staging` profile is being retired. A whole-file overwrite that
// keeps only `prod` would also wipe `shared`, breaking every environment.
export function loadConfig(env) {
  const all = JSON.parse(
    readFileSync(new URL('../config/environments.json', import.meta.url), 'utf8'),
  );
  return { ...all.shared, ...all[env] };
}
