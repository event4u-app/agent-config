import { validateConfig } from './validate.mjs';

export function loadConfig(input = {}) {
  validateConfig(input);
  return {
    maxItems: input.maxItems || 50,
    newestFirst: input.newestFirst ?? true,
  };
}
